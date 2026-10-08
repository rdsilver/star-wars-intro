#!/usr/bin/env python3
"""CHILL CAPYBARA -- sound effects & ambiences, synthesised from scratch.

No samples, no network: numpy + scipy only.  Everything is 48 kHz float32 stereo
shaped (n, 2), deterministic for a given (name, seed).

Public API (DESIGN.md section 7)
--------------------------------
    render_sfx(name, seed=0)                         -> np.ndarray (n, 2) float32, natural length
    render_ambience(name, duration, seed=0, loop=False) -> np.ndarray (round(duration*SR), 2) float32
    NAMES      list of sfx names            AMBIENCES  list of ambience names
    ANCHORS    {name: {event: seconds | [seconds]}}  -- sync points inside each sfx
               (seed-independent; e.g. ANCHORS["hammer"]["knocks"] == [0.0, 0.42, 0.84])
    describe(name) -> one-line description

CLI
---
    python src/sfx.py <name> out.wav [--seed N] [--duration SEC] [--loop]
    python src/sfx.py --list

Levels
------
* sfx are mastered to a per-effect loudness (max 300 ms K-weighted loudness,
  table LEVELS, -9.5 LUFS for the explosion down to -27 for the crickets) under a
  0.9 peak ceiling (look-ahead limiter for the big ones).  Calibrated so that at
  mixer gain 1.0 (build_audio's sfx bus x0.8) the comic hits (record_scratch,
  bonk, stings) land about level with Kokoro dialogue (~-13 LUFS momentary), the
  explosion ~2 dB above it and foley (flaps, scribble, zip, crickets) well under.
  Use the event `gain` option to taste.
* ambiences are mastered to a fixed integrated loudness per bed (AMB_LEVELS,
  -22..-28 LUFS, peaks <= 0.6), so every scene's bed has the same level whatever
  its length; with build_audio's 0.5 x 0.35 ambience gain they sit ~20 dB under
  the dialogue.  They start/end in steady state (no fades -- the mixer fades).

Timing: every effect starts on its sync point at t=0 (attack within a few ms)
unless ANCHORS says otherwise (e.g. rock_whistle's silent "impact" at 2.0 s,
glass_ping's peak at 1.42 s).  Natural lengths include a short reverb tail.
"""
from __future__ import annotations

import functools
import sys
import zlib

import numpy as np
from scipy.interpolate import PchipInterpolator
from scipy.ndimage import maximum_filter1d, uniform_filter1d
from scipy.fft import irfft as _irfft
from scipy.signal import butter, lfilter, oaconvolve, sosfilt

SR = 48000
TAU = 2.0 * np.pi
NYQ = SR / 2.0


# =============================================================================
#  basic helpers
# =============================================================================
def _n(sec):
    return max(1, int(round(float(sec) * SR)))


def _time(n):
    return np.arange(n, dtype=np.float64) / SR


def _rng_for(name, seed, salt=0):
    return np.random.default_rng([zlib.crc32(name.encode()), int(seed) & 0x7FFFFFFF, int(salt)])


def midi_hz(m):
    return 440.0 * 2.0 ** ((np.asarray(m, dtype=np.float64) - 69.0) / 12.0)


def _db(d):
    return 10.0 ** (d / 20.0)


def _phase(freq, n=None, ph0=0.0):
    """Running phase (radians) for a scalar or per-sample frequency."""
    if np.ndim(freq) == 0:
        return ph0 + TAU * float(freq) * _time(n)
    f = np.asarray(freq, dtype=np.float64)
    ph = np.cumsum(f) * (TAU / SR)
    return ph0 + ph - ph[0]          # start exactly at ph0


def _ramp(n, a):
    """Smooth (sin^2) attack ramp of length a seconds, then 1."""
    t = _time(n)
    if a <= 0:
        return np.ones(n)
    u = np.clip(t / a, 0.0, 1.0)
    return np.sin(u * np.pi / 2) ** 2


def _taper(n, frac=0.2):
    """1 everywhere except a cos^2 fade over the last `frac` of the array (kills truncation clicks)."""
    w = np.ones(n)
    k = int(n * frac)
    if k > 1:
        w[-k:] = np.cos(np.linspace(0, np.pi / 2, k)) ** 2
    return w


def _decay(n, tau, attack=0.0006):
    return np.exp(-_time(n) / tau) * _ramp(n, attack) * _taper(n)


def _fade_edges(x, fin=0.002, fout=0.02):
    x = np.array(x, dtype=np.float64, copy=True)
    a, b = min(len(x), _n(fin)), min(len(x), _n(fout))
    if a > 1:
        w = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
        x[:a] *= w if x.ndim == 1 else w[:, None]
    if b > 1:
        w = np.cos(np.linspace(0, np.pi / 2, b)) ** 2
        x[-b:] *= w if x.ndim == 1 else w[:, None]
    return x


def _cos_env(points, n):
    """Envelope through (time, value) points with raised-cosine segments (C1-smooth-ish)."""
    ts = np.array([p[0] for p in points], dtype=np.float64)
    vs = np.array([p[1] for p in points], dtype=np.float64)
    t = _time(n)
    i = np.clip(np.searchsorted(ts, t, side="right") - 1, 0, len(ts) - 2)
    span = np.maximum(ts[i + 1] - ts[i], 1e-9)
    u = np.clip((t - ts[i]) / span, 0.0, 1.0)
    u = 0.5 - 0.5 * np.cos(np.pi * u)
    out = vs[i] + (vs[i + 1] - vs[i]) * u
    out[t >= ts[-1]] = vs[-1]
    out[t <= ts[0]] = vs[0]
    return out


def _smooth_noise(n, rng, rate):
    """Zero-mean ~unit control noise with features at `rate` Hz (smoothstep value noise)."""
    k = int(n / SR * rate) + 4
    v = rng.standard_normal(k)
    u = _time(n) * rate
    i = np.floor(u).astype(np.int64)
    f = u - i
    f = f * f * (3 - 2 * f)
    return v[i] * (1 - f) + v[i + 1] * f


def _to_stereo(x):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        return np.stack([x, x], axis=1)
    return x


def _pan(mono, pan=0.0):
    """Constant-power pan; pan in [-1, 1] (scalar or per-sample). Centre = unity per channel."""
    a = (np.clip(pan, -1.0, 1.0) + 1.0) * (np.pi / 4)
    g = np.sqrt(2.0)
    return np.stack([mono * np.cos(a) * g, mono * np.sin(a) * g], axis=1)


def _add(buf, t0, clip, gain=1.0):
    """Mix clip (mono or stereo) into stereo buf at time t0 (seconds)."""
    i = int(round(t0 * SR))
    clip = _to_stereo(clip)
    if i < 0:
        clip = clip[-i:]
        i = 0
    m = min(len(clip), len(buf) - i)
    if m > 0:
        seg = clip[:m] * gain
        k = min(m // 4, _n(0.002))
        if k > 1:
            seg[-k:] *= (np.cos(np.linspace(0, np.pi / 2, k)) ** 2)[:, None]
        buf[i:i + m] += seg


def _widen(mono, rng, width=0.6, ms=(7.0, 11.0)):
    """Mono -> stereo with gentle decorrelation (short comb delays, opposite polarity)."""
    d1, d2 = _n(ms[0] / 1000.0), _n(ms[1] / 1000.0)
    a = np.zeros_like(mono)
    b = np.zeros_like(mono)
    a[d1:] = mono[:-d1]
    b[d2:] = mono[:-d2]
    side = 0.5 * (a - b) * width
    return np.stack([mono + side, mono - side], axis=1)


# =============================================================================
#  filters
# =============================================================================
@functools.lru_cache(maxsize=512)
def _sos(kind, f1, f2=0.0, order=2):
    if kind == "bp":
        lo = max(5.0, f1)
        hi = min(f2, NYQ * 0.97)
        return butter(order, [lo, hi], btype="bandpass", fs=SR, output="sos")
    f1 = min(max(5.0, f1), NYQ * 0.97)
    return butter(order, f1, btype="lowpass" if kind == "lp" else "highpass", fs=SR, output="sos")


def lp(x, f, order=2):
    return sosfilt(_sos("lp", float(f), 0.0, order), x, axis=0)


def hp(x, f, order=2):
    return sosfilt(_sos("hp", float(f), 0.0, order), x, axis=0)


def bp(x, f1, f2, order=2):
    return sosfilt(_sos("bp", float(f1), float(f2), order), x, axis=0)


def _rbj(kind, f, q):
    w = TAU * min(max(f, 10.0), NYQ * 0.95) / SR
    cw, sw = np.cos(w), np.sin(w)
    al = sw / (2 * q)
    if kind == "lp":
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
    elif kind == "hp":
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]
    else:  # bp, 0 dB peak
        b = [al, 0.0, -al]
    a = [1 + al, -2 * cw, 1 - al]
    return np.array(b) / a[0], np.array(a) / a[0]


def shelf(x, f0, gain_db, kind="low", s=1.0):
    """RBJ shelving filter (low or high shelf), gain_db at the shelf, slope s."""
    A = 10.0 ** (gain_db / 40.0)
    w = TAU * f0 / SR
    cw, sw = np.cos(w), np.sin(w)
    al = sw / 2.0 * np.sqrt((A + 1.0 / A) * (1.0 / s - 1.0) + 2.0)
    sa = 2.0 * np.sqrt(A) * al
    if kind == "low":
        b = [A * ((A + 1) - (A - 1) * cw + sa), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - sa)]
        a = [(A + 1) + (A - 1) * cw + sa, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - sa]
    else:
        b = [A * ((A + 1) + (A - 1) * cw + sa), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sa)]
        a = [(A + 1) - (A - 1) * cw + sa, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sa]
    b, a = np.array(b) / a[0], np.array(a) / a[0]
    return lfilter(b, a, x, axis=0)


def _tvf(x, kind, fc, q=0.707, block=32):
    """Time-varying RBJ biquad (coefficients updated every `block` samples)."""
    x = np.asarray(x, dtype=np.float64)
    fc = np.broadcast_to(np.asarray(fc, dtype=np.float64), (len(x),))
    y = np.empty_like(x)
    zi = np.zeros(2) if x.ndim == 1 else np.zeros((2, x.shape[1]))
    for s in range(0, len(x), block):
        e = min(len(x), s + block)
        b, a = _rbj(kind, fc[(s + e) // 2], q)
        y[s:e], zi = lfilter(b, a, x[s:e], axis=0, zi=zi)
    return y


# =============================================================================
#  noise
# =============================================================================
def _cgauss(rng, shape):
    z = rng.standard_normal(tuple(shape) + (2,), dtype=np.float32)
    return z.view(np.complex64)[..., 0] * np.float32(np.sqrt(0.5))


def _spec_noise(n, rng, mask, nfft=1024, nch=2, corr=0.0):
    """Gaussian noise with a (time-varying) spectral amplitude envelope.

    mask(tc, f) -> amplitude, broadcastable to (frames, bins); tc is (F, 1) frame-centre
    times in seconds, f is (1, B) Hz.  Synthesised by overlap-adding random-phase
    spectra (Hann, 75 % overlap).  A mask of 1 everywhere gives unit-variance white noise.
    corr: inter-channel correlation (0 = independent, 1 = identical).
    """
    hop = nfft // 4
    nb = nfft // 2 + 1
    f = np.fft.rfftfreq(nfft, 1.0 / SR)[None, :]
    win = 0.5 - 0.5 * np.cos(TAU * np.arange(nfft) / nfft)
    scale = np.sqrt(nfft / 1.5)
    nfr = int(np.ceil((n + nfft) / hop)) + 1
    buf = np.zeros((nfr + 3, hop, nch))
    step = max(8, (1 << 19) // nb)
    cw, iw = np.sqrt(corr), np.sqrt(1.0 - corr)
    for c0 in range(0, nfr, step):
        c1 = min(nfr, c0 + step)
        F = c1 - c0
        tc = ((np.arange(c0, c1) * hop - nfft) + nfft / 2) / SR
        M = np.array(np.broadcast_to(mask(tc[:, None], f), (F, nb)), dtype=np.float32)
        M[:, 0] = 0.0
        act = np.nonzero(M.max(axis=0) > 1e-5 * (M.max() + 1e-30))[0]   # only synthesise audible bins
        if len(act) == 0:
            continue
        Ma = M[:, act]
        common = _cgauss(rng, (F, len(act))) if corr > 0 else None
        for ch in range(nch):
            Z = _cgauss(rng, (F, len(act)))
            if common is not None:
                Z = cw * common + iw * Z
            X = np.zeros((F, nb), dtype=np.complex64)
            X[:, act] = Ma * Z
            fr = (_irfft(X, nfft, axis=1) * scale * win).reshape(F, 4, hop)
            for k in range(4):
                buf[c0 + k:c1 + k, :, ch] += fr[:, k, :]
    out = buf.reshape(-1, nch)[nfft:nfft + n]
    return out if nch > 1 else out[:, 0]


# spectral-mask building blocks (all take f in Hz, return amplitude)
def m_band(f, lo, hi, slope_lo=12.0, slope_hi=12.0):
    f = np.maximum(f, 1.0)
    g = np.ones_like(f * 1.0)
    if lo > 0:
        g = g / np.sqrt(1 + (lo / f) ** (2 * slope_lo / 6.02))
    if hi > 0:
        g = g / np.sqrt(1 + (f / hi) ** (2 * slope_hi / 6.02))
    return g


def m_peak(f, fc, bw_oct):
    f = np.maximum(f, 1.0)
    return np.exp(-0.5 * (np.log2(f / fc) / bw_oct) ** 2)


def m_tilt(f, db_per_oct, ref=1000.0):
    f = np.maximum(f, 1.0)
    return 10 ** (db_per_oct * np.log2(f / ref) / 20)


def _interp_at(tc, n, curve):
    """Sample a per-sample control curve at frame times tc (any shape; nearest sample)."""
    idx = np.clip(np.rint(np.asarray(tc) * SR).astype(np.int64), 0, len(curve) - 1)
    return np.asarray(curve)[idx]


def _crackle(n, rng, rate, lo=900.0, hi=5000.0, tau=0.0018, alpha=1.6, kernels=4):
    """Sparse random crackles: rate (events/s, scalar or per-sample) -> mono signal."""
    rate = np.broadcast_to(np.asarray(rate, dtype=np.float64), (n,))
    hits = rng.random(n) < rate / SR
    hits[max(0, n - _n(tau * 8 + 0.004)):] = False
    idx = np.nonzero(hits)[0]
    out = np.zeros(n)
    if len(idx) == 0:
        return out
    amps = np.minimum((rng.pareto(alpha, len(idx)) + 1.0) * 0.25, 3.0) * rng.choice([-1.0, 1.0], len(idx))
    group = rng.integers(0, kernels, len(idx))
    for g in range(kernels):
        sel = idx[group == g]
        if len(sel) == 0:
            continue
        imp = np.zeros(n)
        imp[sel] = amps[group == g]
        kl = _n(tau * 6)
        tk = _time(kl)
        ker = rng.standard_normal(kl) * np.exp(-tk / (tau * rng.uniform(0.6, 1.5)))
        ker[0] += 1.5
        out += oaconvolve(imp, ker)[:n]
    return bp(out, lo, hi)


# =============================================================================
#  reverb
# =============================================================================
_IR_SPECS = {
    # name: (length s, RT60 at low f, RT60 at high f, predelay s, early-reflection taps, hf cutoff)
    "room": (0.7, 0.42, 0.22, 0.004, 6, 7000.0),
    "wood": (0.6, 0.35, 0.16, 0.003, 7, 5500.0),
    "outdoor": (1.6, 1.10, 0.45, 0.018, 4, 6500.0),
    "hall": (2.6, 2.10, 0.90, 0.022, 8, 8000.0),
    "big": (3.6, 3.00, 1.10, 0.030, 5, 5000.0),
}


@functools.lru_cache(maxsize=8)
def _ir(kind):
    length, rt_lo, rt_hi, pre, ntaps, fhi = _IR_SPECS[kind]
    rng = np.random.default_rng(zlib.crc32(("ir:" + kind).encode()))
    n = _n(length)

    def mask(tc, f):
        lf = np.clip((np.log2(np.maximum(f, 1.0) / 200.0)) / np.log2(8000.0 / 200.0), 0, 1)
        rt = rt_lo * (rt_hi / rt_lo) ** lf
        tt = np.maximum(tc - pre, 0.0)
        onset = 1.0 - np.exp(-tt / 0.012)
        return (10 ** (-3.0 * tt / rt)) * onset * (tc > pre) * m_band(f, 60.0, fhi, 12, 12)

    ir = _spec_noise(n, rng, mask, nfft=1024, nch=2, corr=0.0)
    # early reflections
    for ch in range(2):
        for k in range(ntaps):
            d = pre + rng.uniform(0.003, 0.045)
            i = _n(d)
            if i < n:
                ir[i, ch] += rng.uniform(0.3, 0.9) * rng.choice([-1, 1]) * np.sqrt(0.02 / (d + 0.01))
    ir = lp(ir, fhi * 1.2)
    ir = _fade_edges(ir, 0.0, 0.05)
    ir /= np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True)) + 1e-12
    return ir


def _reverb(x, kind="outdoor", wet=0.2, send_hp=150.0, send_lp=9000.0):
    """Returns dry + wet (stereo), longer than x by the IR length."""
    x = _to_stereo(x)
    ir = _ir(kind)
    send = bp(x.mean(axis=1), send_hp, send_lp)
    w = np.stack([oaconvolve(send, ir[:, 0]), oaconvolve(send, ir[:, 1])], axis=1)
    out = w * wet
    out[:len(x)] += x
    return out


# =============================================================================
#  loudness / mastering
# =============================================================================
_KB1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
_KA1 = [1.0, -1.69065929318241, 0.73248077421585]
_KB2 = [1.0, -2.0, 1.0]
_KA2 = [1.0, -1.99004745483398, 0.99007225036621]


def kweight(x):
    x = _to_stereo(x)
    return lfilter(_KB2, _KA2, lfilter(_KB1, _KA1, x, axis=0), axis=0)


def loudness_max(x, win=0.3):
    """Max short-window (default 300 ms) K-weighted loudness, LUFS-like (stereo sum)."""
    y = kweight(x)
    p = np.sum(y * y, axis=1)
    w = _n(win)
    if len(p) < w:
        p = np.concatenate([p, np.zeros(w - len(p))])
    c = np.concatenate([[0.0], np.cumsum(p)])
    ms = (c[w:] - c[:-w]) / w
    return -0.691 + 10 * np.log10(ms.max() + 1e-15)


#: small-speaker model (laptop / phone): 4th-order Butterworth high-pass at 150 Hz
_HP_SMALL = butter(4, 150.0, btype="highpass", fs=SR, output="sos")


def loudness_small(x, win=0.4):
    """Max momentary (400 ms) K-weighted loudness on a small speaker (HP 150 Hz, 4th order).

    This is the second level measure used for the low-end effects (explosion, rumbles):
    plain K-weighting still counts most of a sub-bass rumble, which a laptop or phone
    simply does not reproduce."""
    return loudness_max(sosfilt(_HP_SMALL, _to_stereo(x), axis=0), win)


def loudness_integrated(x):
    """BS.1770-style gated integrated loudness (400 ms blocks, 75 % overlap)."""
    y = kweight(x)
    p = np.sum(y * y, axis=1)
    w, h = _n(0.4), _n(0.1)
    if len(p) < w:
        return -0.691 + 10 * np.log10(p.mean() + 1e-15)
    c = np.concatenate([[0.0], np.cumsum(p)])
    st = np.arange(0, len(p) - w + 1, h)
    ms = (c[st + w] - c[st]) / w
    lk = -0.691 + 10 * np.log10(ms + 1e-15)
    g = ms[lk > -70]
    if len(g) == 0:
        return -99.0
    rel = -0.691 + 10 * np.log10(g.mean()) - 10
    g2 = ms[(lk > -70) & (lk > rel)]
    return -0.691 + 10 * np.log10(g2.mean() + 1e-15)


def _limit(x, ceiling, attack=0.003, release=0.035):
    """Look-ahead peak limiter; gain never exceeds what the peak needs (symmetric smoothing)."""
    a = np.abs(x).max(axis=1)
    wa = 2 * _n(attack) + 1
    wr = 2 * _n(release) + 1
    pk = maximum_filter1d(a, size=wa)
    d = 1.0 - np.minimum(1.0, ceiling / np.maximum(pk, 1e-12))
    d = uniform_filter1d(maximum_filter1d(d, size=wa), size=wa)
    d = uniform_filter1d(maximum_filter1d(d, size=wr), size=wr)
    return x * (1.0 - d)[:, None]


def _trim(x, floor_db=-62.0, pad=0.03, fout=0.03):
    """Trim trailing near-silence and fade out."""
    a = np.abs(x).max(axis=1) if x.ndim == 2 else np.abs(x)
    pk = a.max()
    if pk <= 0:
        return x
    env = maximum_filter1d(a, size=_n(0.01))
    idx = np.nonzero(env > pk * _db(floor_db))[0]
    end = min(len(x), (idx[-1] if len(idx) else len(x)) + _n(pad))
    return _fade_edges(x[:end], 0.0, fout)


def _master(x, lufs, ceiling=0.9, max_limit_db=4.0, trim=True, floor_db=-62.0, fout=0.03, small=None,
            max_len=None):
    """Level an effect to its target and keep it under the peak ceiling.

    lufs  : target max 300 ms K-weighted loudness (full range).
    small : optional target for the small-speaker measure (loudness_small).  When given,
            the effect is levelled on that measure and `lufs` becomes a full-range CAP
            (the gain is the smaller of the two), so a sub-heavy render can never come
            out boomier than intended.  Two passes, so peak limiting does not leave the
            effect short of its target.
    """
    x = _to_stereo(x)
    x = x - x.mean(axis=0, keepdims=True)
    x = hp(x, 18.0, order=2)
    if trim:
        x = _trim(x, floor_db=floor_db, fout=fout)
    if max_len is not None and len(x) > _n(max_len):
        x = _fade_edges(x[:_n(max_len)], 0.0, 0.08)
    x = _fade_edges(x, 0.0015, 0.0)

    def gain_db(y):
        g = lufs - loudness_max(y)
        if small is not None:
            g = min(g, small - loudness_small(y))
        return g

    def limit(y):
        pk = np.abs(y).max()
        if pk > ceiling:
            allowed = ceiling * _db(max_limit_db)
            if pk > allowed:
                y = y * (allowed / pk)
            y = _limit(y, ceiling * 0.985)
            y = np.clip(y, -ceiling, ceiling)
        return y

    g = gain_db(x)
    y = limit(x * _db(g))
    if small is not None:
        # second pass: make up what the limiter took (bounded by the limiter budget)
        g2 = float(np.clip(gain_db(y), 0.0, 1.5))
        if g2 > 0.05:
            y = limit(x * _db(g + g2))
    return y


# =============================================================================
#  instrument & texture building blocks
# =============================================================================
def _bubble(f0, tau, rise=0.7, amp=1.0):
    """Minnaert bubble 'bloop': decaying sine with rising pitch."""
    n = _n(tau * 7)
    t = _time(n)
    f = f0 * (1 + rise * (1 - np.exp(-t / (tau * 1.6))))
    return amp * np.sin(_phase(f)) * _decay(n, tau, max(0.0012, 0.8 / f0))


def _pebble(rng, size=1.0, amp=1.0):
    """Small stone/debris tick: a few inharmonic modes + click."""
    n = _n(0.07 * size)
    t = _time(n)
    base = rng.uniform(1100, 3200) / size
    y = np.zeros(n)
    for r, a in ((1.0, 1.0), (rng.uniform(1.4, 1.9), 0.6), (rng.uniform(2.3, 3.4), 0.35)):
        y += a * np.sin(TAU * base * r * t) * np.exp(-t / (rng.uniform(0.003, 0.009) * size))
    click = bp(rng.standard_normal(n) * np.exp(-t / 0.0007), 800, 8000)
    y = (y * _ramp(n, 0.0003) + 0.8 * click) * amp * _taper(n, 0.3)
    return y


def _bounce_seq(buf, rng, t0, amp, pan, size=1.0, nb=None):
    nb = nb or int(rng.integers(2, 5))
    gap = rng.uniform(0.06, 0.16)
    t = t0
    for k in range(nb):
        _add(buf, t, _pan(_pebble(rng, size, amp * (0.55 ** k)), pan))
        t += gap
        gap *= rng.uniform(0.55, 0.75)


def _harmonic_tone(n, f, amps, rng=None):
    """Additive tone; amps = list of per-harmonic amplitudes (scalars or arrays)."""
    ph = _phase(f, n)
    y = np.zeros(n)
    fmax = float(np.max(f))
    for k, a in enumerate(amps, start=1):
        if k * fmax > NYQ * 0.9:
            break
        off = 0.0 if rng is None else rng.uniform(0, TAU)
        y += a * np.sin(k * ph + off)
    return y


def _brass(midi, dur, rng, vel=1.0, rel=0.09, amp_pts=None, vib=0.0, bright=1.0, detune=0.0):
    """Brass-like note: band-limited saw with an envelope-driven low-pass (computed additively)."""
    f0 = float(midi_hz(midi)) * 2 ** (detune / 1200)
    n = _n(dur + rel)
    t = _time(n)
    if amp_pts is None:
        amp_pts = [(0, 0), (0.018, 1.0), (0.07, 0.78), (dur, 0.7), (dur + rel, 0.0)]
    env = _cos_env(amp_pts, n) * vel
    vib_env = np.clip((t - 0.25) / 0.3, 0, 1) * vib
    cents = -45 * np.exp(-t / 0.022) + vib_env * 14 * np.sin(TAU * 5.4 * t + rng.uniform(0, TAU))
    cents += 3 * _smooth_noise(n, rng, 3.0)
    f = f0 * 2 ** (cents / 1200)
    ph = _phase(f)
    fc = f0 * (1.2 + 7.5 * bright * env ** 1.4) + 250.0
    kmax = int(min(NYQ * 0.85 / f0, 5.0 * fc.max() / f0 + 2))
    y = np.zeros(n)
    for k in range(1, max(2, kmax) + 1):
        hk = 1.0 / k / np.sqrt(1 + (k * f0 / fc) ** 4)
        y += hk * np.sin(k * ph)
    # breath / rasp on the attack
    br = bp(rng.standard_normal(n), f0 * 2, min(f0 * 12, 9000)) * np.exp(-t / 0.03) * 0.08
    return (y + br) * env


def _organ(midi, dur, rng, vel=1.0, rel=0.12, trem=0.0, amp_pts=None):
    f0 = float(midi_hz(midi))
    n = _n(dur + rel)
    t = _time(n)
    env = _cos_env(amp_pts or [(0, 0), (0.012, 1.0), (dur, 1.0), (dur + rel, 0.0)], n) * vel
    y = np.zeros(n)
    for ratio, a in ((0.5, 0.45), (1.0, 1.0), (2.0, 0.55), (3.0, 0.3), (4.0, 0.22), (6.0, 0.08)):
        if f0 * ratio < NYQ * 0.8:
            y += a * np.sin(TAU * f0 * ratio * t + rng.uniform(0, TAU))
    if trem:
        y *= 1 + trem * np.sin(TAU * 6.2 * t)
    return y * env


def _timpani(midi, vel=1.0, dur=2.8, rng=None):
    f0 = float(midi_hz(midi))
    n = _n(dur)
    t = _time(n)
    glide = 1 + 0.025 * np.exp(-t / 0.03)
    y = np.zeros(n)
    for r, a, tau in ((1.0, 1.0, 0.75), (1.505, 0.45, 0.45), (1.99, 0.28, 0.3), (2.44, 0.16, 0.22), (2.9, 0.08, 0.15)):
        y += a * np.sin(_phase(f0 * r * glide)) * np.exp(-t / tau)
    thump = lp(rng.standard_normal(n) * np.exp(-t / 0.012), 600) * 0.9
    return (y * _ramp(n, 0.002) + thump) * vel * _taper(n, 0.35)


def _cymbal(dur, rng, tau=0.9, vel=1.0):
    n = _n(dur)
    t = _time(n)

    def mask(tc, f):
        return m_band(f, 3000, 11000, 18, 12) * (np.exp(-tc / tau) * 0.8 + 0.2 * np.exp(-tc / 0.08))

    y = _spec_noise(n, rng, mask, nfft=512, nch=2, corr=0.3)
    ring = np.zeros(n)
    for _ in range(14):
        ring += np.sin(TAU * rng.uniform(3200, 8500) * t + rng.uniform(0, TAU)) * np.exp(-t / rng.uniform(0.2, 0.6))
    y += _widen(ring * 0.02, rng, 0.8)
    return y * (_ramp(n, 0.001) * _taper(n, 0.35))[:, None] * vel


def _bar(midi, rng, vel=1.0, kind="marimba", dur=None):
    """Struck bar (marimba / glockenspiel)."""
    f0 = float(midi_hz(midi))
    if kind == "marimba":
        modes = ((1.0, 1.0, 0.3 * (440 / f0) ** 0.4), (3.99, 0.14 * vel, 0.045), (9.9, 0.03 * vel, 0.015))
    else:  # glock
        modes = ((1.0, 1.0, 0.6), (2.756, 0.28, 0.15), (5.404, 0.1, 0.04))
    dur = dur or max(m[2] for m in modes) * 6
    n = _n(dur)
    t = _time(n)
    y = np.zeros(n)
    for r, a, tau in modes:
        if f0 * r < NYQ * 0.85:
            y += a * np.sin(TAU * f0 * r * t) * np.exp(-t / tau)
    mallet = bp(rng.standard_normal(n) * np.exp(-t / 0.002), 150, 2500 if kind == "marimba" else 6000) * 0.15
    return (y * _ramp(n, 0.0012) + mallet) * vel * _taper(n, 0.3)


# vowel formants (F, bandwidth, amp dB)
_VOWELS = {
    "a": ((750, 110, 0), (1180, 120, -6), (2550, 170, -18), (3400, 250, -28)),
    "o": ((480, 90, 0), (850, 110, -8), (2500, 170, -26), (3300, 250, -32)),
    "u": ((320, 70, 0), (800, 100, -14), (2300, 170, -32), (3200, 250, -38)),
}


def _formant_gain(freq, vowel):
    g = 0.0
    for F, B, A in _VOWELS[vowel]:
        g = g + _db(A) / np.sqrt(1 + ((freq - F) / (B / 2)) ** 2)
    return g


def _vox(n, f0, vowel_mix, rng, breath=0.25):
    """Additive formant voice. f0 per-sample; vowel_mix: list of (vowel, weight array)."""
    ph = _phase(f0)
    y = np.zeros(n)
    fmin = float(np.min(f0))
    K = int(4200 / fmin)
    for k in range(1, K + 1):
        fk = k * f0
        g = 0.0
        for v, w in vowel_mix:
            g = g + w * _formant_gain(fk, v)
        tilt = 1.0 / k ** 0.9
        y += g * tilt * np.sin(k * ph + rng.uniform(0, 0.3))
    noise = rng.standard_normal(n)
    nz = 0.0
    for v, w in vowel_mix:
        for F, B, A in _VOWELS[v][:3]:
            nz = nz + w * _db(A) * bp(noise, F - B, F + B, 2)
    return y + breath * nz * 3.0


# bird call synthesis -------------------------------------------------------
def _syllables(sylls, harm=(0.1, 0.025)):
    end = max(s[0] + s[1] for s in sylls) + 0.03
    n = _n(end)
    out = np.zeros(n)
    for (t0, d, fa, fb, a, *rest) in sylls:
        curve = rest[0] if len(rest) > 0 else 1.0
        fm, fmd = (rest[1], rest[2]) if len(rest) > 2 else (0.0, 0.0)
        m = _n(d)
        tt = _time(m)
        u = tt / d
        f = fa + (fb - fa) * u ** curve
        if fm:
            f = f + fmd * np.sin(TAU * fm * tt)
        ph = _phase(f)
        y = np.sin(ph) + harm[0] * np.sin(2 * ph) + harm[1] * np.sin(3 * ph)
        att = min(0.012, d * 0.3)
        env = _ramp(m, att) * _ramp(m, att)[::-1]
        i0 = _n(t0)
        mm = min(m, n - i0)
        out[i0:i0 + mm] += (a * env * y)[:mm]
    return out


def _bird_call(kind, rng, ps=1.0):
    r = lambda lo, hi: rng.uniform(lo, hi)  # noqa: E731
    if kind == "wheeto":
        s = [(0.0, r(0.09, 0.12), 2200 * ps, 3300 * ps, 0.8, 0.7),
             (r(0.14, 0.17), r(0.18, 0.24), 3500 * ps, 2350 * ps, 1.0, 1.4)]
    elif kind == "trill":
        s = [(0.0, r(0.28, 0.42), 4100 * ps, 3800 * ps, 0.7, 1.0, r(22, 30), r(400, 600))]
    elif kind == "chirps":
        k = int(rng.integers(3, 6))
        gap = r(0.075, 0.1)
        s = [(i * gap, 0.042, 5200 * ps, 3000 * ps, 1.0 - 0.12 * i, 0.6) for i in range(k)]
    elif kind == "warble":
        notes = [r(1700, 1900), r(2150, 2400), r(1850, 2000), r(2500, 2800), r(2000, 2200)]
        s, t = [], 0.0
        for i in range(len(notes) - 1):
            d = r(0.08, 0.13)
            s.append((t, d, notes[i] * ps, notes[i + 1] * ps, 0.9, 2.5))
            t += d + 0.012
    elif kind == "coo":
        f = r(520, 600) * ps
        s = [(0.0, 0.2, f * 0.96, f, 0.8, 0.5), (0.3, 0.16, f * 0.98, f, 0.7, 0.5),
             (0.55, 0.42, f * 1.02, f * 0.9, 0.9, 1.0)]
        return _syllables(s, harm=(0.06, 0.0))
    elif kind == "kiskadee":
        s = [(0.0, 0.06, 2900 * ps, 3400 * ps, 0.8, 1.0), (0.11, 0.06, 2700 * ps, 3200 * ps, 0.75, 1.0),
             (0.22, 0.2, 2500 * ps, 3500 * ps, 1.0, 0.5)]
    else:  # "peep"
        s = [(0.0, 0.06, 3600 * ps, 4200 * ps, 1.0, 0.8)]
    return _syllables(s)


BIRD_KINDS = ("wheeto", "trill", "chirps", "warble", "coo", "kiskadee", "peep")


# flaps ---------------------------------------------------------------------
def _flap(rng, size=1.0, amp=1.0):
    """One wing down-stroke whoosh (mono)."""
    dur = 0.36 * size
    n = _n(dur)
    tp = 0.075 * size                      # moment of max air push
    env = _cos_env([(0, 0), (tp, 1.0), (tp + 0.05 * size, 0.55), (dur, 0.0)], n)
    centre = _cos_env([(0, 300 / size), (tp, 650 / size), (dur, 380 / size)], n)

    def mask(tc, f):
        e = _interp_at(tc, n, env)
        c = _interp_at(tc, n, centre)
        body = m_peak(f, c, 1.1) + 0.55 * m_band(f, 70, 260, 12, 18)
        air = 0.18 * m_band(f, 1500, 7000, 12, 12)
        return e * (body + air)

    y = _spec_noise(n, rng, mask, nfft=512, nch=1)
    # feather rustle: high grains during the stroke
    gr = _crackle(n, rng, 900 * env + 50, lo=2500, hi=8000, tau=0.0008, alpha=2.5) * 0.25
    return _fade_edges((y + gr * env) * amp, 0.0, 0.03)


# big low-end events --------------------------------------------------------
def _duck_env(n, times, depth_db=-4.0, pre=0.15, ramp=0.06, recover=0.1):
    """1 everywhere, dipping to depth_db for `pre` seconds before each time (then back up).

    Pulling the bed down just before a boom makes the boom read as a real onset."""
    env = np.ones(n)
    t = _time(n)
    d = 1.0 - _db(depth_db)
    for tb in times:
        a, b, c = tb - pre - ramp, tb - pre, tb + recover
        w = np.zeros(n)
        m = (t > a) & (t < b)
        w[m] = np.sin(0.5 * np.pi * (t[m] - a) / ramp) ** 2
        w[(t >= b) & (t <= tb)] = 1.0
        m = (t > tb) & (t < c)
        w[m] = np.cos(0.5 * np.pi * (t[m] - tb) / (c - tb)) ** 2
        env *= 1.0 - d * w
    return env


def _boom_hit(rng, size=1.0, sub=1.0, mid=1.0, crack=1.0, debris=1.0, width=0.45):
    """One 'boom' you can hear on any speaker (stereo, ~1.2 s, attack at t=0).

    sub   : 70 -> 38 Hz sine drop (the cinema part)
    mid   : saturated 120-900 Hz noise thump (what a laptop / phone actually plays)
    crack : short 300-3500 Hz burst on the attack
    debris: a burst of stone ticks / rattles in the 1-4 kHz range just after the hit
    """
    dur = 1.0 + 0.3 * size
    n = _n(dur)
    t = _time(n)
    f = (36.0 + 34.0 * np.exp(-t / 0.08)) / size ** 0.15
    y_sub = np.sin(_phase(f)) * _decay(n, 0.32 * size, 0.004)
    z = bp(rng.standard_normal(n), 110.0, 900.0, order=2)
    z /= np.std(z) + 1e-12
    e_mid = _decay(n, 0.075 * size, 0.0015) * 0.8 + _decay(n, 0.3 * size, 0.004) * 0.2
    body = np.tanh(1.8 * z * e_mid)
    body = lp(body, 2600.0, order=2)
    knock = np.sin(_phase(150.0 * (1 + 0.6 * np.exp(-t / 0.012)))) * _decay(n, 0.06, 0.001)
    cr = bp(rng.standard_normal(n), 300.0, 3500.0) * _decay(n, 0.014, 0.0006)
    mono = y_sub * sub + (body * 0.9 + knock * 0.35) * mid + cr * 0.75 * crack
    out = _widen(mono, rng, width)
    if debris > 0:
        burst = _crackle(n, rng, 900.0 * np.exp(-t / 0.05), lo=900, hi=4000, tau=0.0018, alpha=1.8)
        out += _widen(burst * 0.22 * debris, rng, 0.9)
        for _ in range(int(round(5 * debris))):
            _bounce_seq(out, rng, rng.uniform(0.03, 0.22), 0.3 * debris * rng.uniform(0.4, 1.0),
                        rng.uniform(-0.85, 0.85), size=rng.uniform(0.8, 1.4))
    return out


def _rock_grind(n, rng, env, rate=26.0, lo=150.0, hi=800.0):
    """Lumpy low-mid 'rocks grinding' noise (stereo): band noise with a grainy amplitude."""
    g = bp(rng.standard_normal((n, 2)), lo, hi, order=2)
    g /= np.std(g) + 1e-12
    grain = np.stack([np.abs(_smooth_noise(n, rng, rate)) ** 1.6 for _ in range(2)], axis=1)
    grain = 0.35 + grain / (np.mean(grain) + 1e-12) * 0.65
    return g * grain * np.asarray(env)[:, None]


def _knock(rng, scale=1.0, amp=1.0):
    """Mallet-on-stake knock (mono)."""
    n = _n(0.45)
    t = _time(n)
    y = np.zeros(n)
    modes = ((205, 1.0, 0.055), (530, 0.6, 0.032), (1140, 0.4, 0.02), (2180, 0.22, 0.012), (3450, 0.1, 0.008))
    for f, a, tau in modes:
        y += a * np.sin(TAU * f * scale * rng.uniform(0.985, 1.015) * t) * np.exp(-t / tau)
    y *= _ramp(n, 0.0004)
    y += bp(rng.standard_normal(n), 300 * scale, 2500 * scale) * _decay(n, 0.012, 0.0003) * 0.9
    thud = np.sin(_phase(85 + 45 * np.exp(-t / 0.01))) * _decay(n, 0.045, 0.001) * 0.8
    click = bp(rng.standard_normal(n) * np.exp(-t / 0.0011), 1500, 7500) * 0.9
    return (y + thud + click) * amp * _taper(n, 0.3)


# =============================================================================
#  SFX registry
# =============================================================================
_SFX = {}

#: loudness targets (max 300 ms K-weighted loudness, LUFS) -- the mix balance lives here.
#: For the effects that also appear in LEVELS_SMALL this is a full-range cap.
LEVELS = {}

#: small-speaker loudness targets (loudness_small: max 400 ms K-weighted loudness after a
#: 4th-order 150 Hz high-pass) for the low-end effects; see the module docstring.
LEVELS_SMALL = {}

#: seed-independent sync points inside each effect (seconds from the start of the clip)
ANCHORS = {}


def _register(name, lufs, desc, anchors=None, ceiling=0.9, limit_db=4.0, small=None, max_len=None):
    def deco(fn):
        _SFX[name] = dict(fn=fn, lufs=lufs, desc=desc, ceiling=ceiling, limit_db=limit_db, small=small,
                          max_len=max_len)
        LEVELS[name] = lufs
        if small is not None:
            LEVELS_SMALL[name] = small
        ANCHORS[name] = anchors or {}
        return fn
    return deco


# ---------------------------------------------------------------- record scratch
@_register("record_scratch", -12.5, "vinyl scratch: grab, pull back, push forward, stop (~0.6 s)",
           anchors=dict(grab=0.04, back=0.09, forward=0.22, back2=0.36, stop=0.47))
def _sfx_record_scratch(rng):
    # the 'record': a warm lounge chord + an 'aah' voice + a little brushed noise
    ns = _n(2.4)
    ts = _time(ns)
    src = np.zeros(ns)
    for m, a in ((41, 0.5), (53, 0.55), (57, 0.5), (60, 0.45), (64, 0.45), (69, 0.3)):
        f = float(midi_hz(m))
        amps = [a / k ** 1.25 for k in range(1, int(5200 / f) + 1)]
        src += _harmonic_tone(ns, f * (1 + 0.002 * rng.standard_normal()), amps, rng=rng)
    vib = 1 + 0.006 * np.sin(TAU * 5.0 * ts)
    src += 0.9 * _vox(ns, 220.0 * vib, [("a", 1.0)], rng, breath=0.1)
    src += 0.25 * bp(rng.standard_normal(ns), 3000, 7000) * (0.5 + 0.5 * np.sin(TAU * 3.7 * ts) ** 8)
    src = lp(src, 5200, order=4)
    src /= np.abs(src).max()

    # hand motion: playback speed (1 = normal) -> pitch & level follow speed
    pts = [(0.0, 1.0), (0.03, 1.0), (0.05, 0.0), (0.085, -2.7), (0.135, -2.1), (0.175, 0.0),
           (0.215, 3.3), (0.27, 2.5), (0.31, 0.0), (0.345, -2.0), (0.40, -1.1), (0.44, 0.0),
           (0.47, 0.35), (0.50, 0.0), (0.62, 0.0)]
    n = _n(0.62)
    t = _time(n)
    v = PchipInterpolator([p[0] for p in pts], [p[1] for p in pts])(t)
    pos = 1.2 + np.cumsum(v) / SR
    y = np.interp(pos * SR, np.arange(ns), src)
    speed = np.abs(v)
    y *= np.minimum(speed, 2.4) ** 0.85
    y = _tvf(y, "lp", 1800 + 2600 * np.minimum(speed, 2.5), 0.8, block=32)
    # stylus friction + surface crackle
    fric = bp(rng.standard_normal(n), 900, 4500) * speed * 0.07
    crack = _crackle(n, rng, 35, lo=1500, hi=7000, tau=0.0005) * 0.08 * np.minimum(speed, 1.0) ** 0.5
    # hand thump when the record is grabbed
    grab = np.zeros(n)
    i0 = _n(0.04)
    tg = _time(n - i0)
    grab[i0:] = np.sin(TAU * 140 * tg) * np.exp(-tg / 0.02) * 0.25 * _ramp(n - i0, 0.002)
    mono = y + fric + crack + grab
    st = _widen(mono, rng, 0.35)
    return _reverb(st, "room", 0.12)


# ---------------------------------------------------------------- rumbles & explosion
def _rumble(rng, dur, heavy):
    n = _n(dur)
    t = _time(n)
    if heavy:
        env = _cos_env([(0, 0), (0.25, 0.55), (0.9, 1.0), (2.6, 0.9), (3.3, 0.55), (dur, 0.0)], n)
    else:
        env = _cos_env([(0, 0), (0.22, 0.7), (0.65, 1.0), (1.5, 0.75), (dur, 0.0)], n)
    shud = 1 + 0.38 * _smooth_noise(n, rng, 8.0) + 0.22 * _smooth_noise(n, rng, 19.0)
    shud = np.clip(shud, 0.15, None)
    # sub noise (fairly mono) + a wandering sub tone
    sub = bp(rng.standard_normal((n, 2)), 30, 110 if heavy else 95, order=3)
    sub = 0.75 * sub + 0.25 * sub[:, ::-1]
    sub /= np.std(sub) + 1e-12
    fs = (39.0 if heavy else 45.0) + 4 * _smooth_noise(n, rng, 0.8)
    tone = np.sin(_phase(fs)) * 1.1
    low = (sub + tone[:, None]) * (env * shud)[:, None]
    # growl: asymmetric saturation adds 2nd/3rd harmonics so small speakers hear it
    drive = 2.6 if heavy else 1.8
    low = low / (np.abs(low).max() + 1e-9)
    growl = np.tanh(drive * (low + 0.35 * low ** 2))
    growl = growl - growl.mean(axis=0)
    # grinding rocks: lumpy low-mid noise
    lump = np.clip(0.4 + 0.6 * np.abs(_smooth_noise(n, rng, 13.0)) ** 1.5, 0, 2)
    grind = bp(rng.standard_normal((n, 2)), 90, 520 if heavy else 380, order=2)
    grind = grind / (np.std(grind) + 1e-12) * (env * lump * shud)[:, None]
    # crackle and debris
    crack = _crackle(n, rng, (70 if heavy else 28) * env ** 1.5, lo=600, hi=4200, tau=0.0025) * np.sqrt(env)
    crack = _widen(crack, rng, 0.9)
    deb = np.zeros((n, 2))
    nd = 26 if heavy else 11
    for _ in range(nd):
        td = rng.uniform(0.15, dur - 0.5)
        e = float(np.interp(td, t, env))
        _bounce_seq(deb, rng, td, 0.5 * e * rng.uniform(0.3, 1.0), rng.uniform(-0.9, 0.9),
                    size=rng.uniform(0.8, 1.6))
    out = growl * 1.0 + grind * 0.11 + crack[:, :] * 0.10 + deb * 0.35
    if heavy:
        # deep boom accents
        for tb, a in ((0.35, 0.7), (1.45, 1.0), (2.45, 0.8)):
            m = _n(1.0)
            tt = _time(m)
            boom = np.sin(_phase(40 + 35 * np.exp(-tt / 0.08))) * _decay(m, 0.35, 0.004)
            boom += lp(rng.standard_normal(m), 220) * _decay(m, 0.12, 0.003) * 0.6
            _add(out, tb, boom * a * 0.9)
    return _reverb(out, "outdoor", 0.14, send_hp=80)


@_register("rumble_small", -15.5, "deep sub rumble with crackle and pebble rattle (~2.5 s)",
           anchors=dict(peak=0.65, end=2.5))
def _sfx_rumble_small(rng):
    return _rumble(rng, 2.5, heavy=False)


@_register("rumble_big", -13.0, "violent ground rumble, booms, grinding, lots of debris (~4 s)",
           anchors=dict(booms=[0.35, 1.45, 2.45], peak=1.45, end=4.0))
def _sfx_rumble_big(rng):
    return _rumble(rng, 4.0, heavy=True)


@_register("explosion", -9.5, "volcanic eruption boom: crack, sub drop, crackling roar tail (~6 s)",
           anchors=dict(boom=0.0, secondary=[0.55, 1.3], debris=[0.8, 4.5], end=5.5), limit_db=6.0)
def _sfx_explosion(rng):
    dur = 5.6
    n = _n(dur)
    t = _time(n)
    out = np.zeros((n, 2))
    # 1. transient crack
    crack = bp(rng.standard_normal(n) * np.exp(-t / 0.005), 700, 9000) * 1.4
    crack += lp(rng.standard_normal(n) * np.exp(-t / 0.002), 3000) * 1.0
    out += _widen(crack, rng, 0.3)
    # 2. punch: low-passed noise body
    body = lp(rng.standard_normal((n, 2)), 1400) * _decay(n, 0.07, 0.002)[:, None] * 1.6
    body += lp(rng.standard_normal((n, 2)), 380, order=3) * _decay(n, 0.45, 0.004)[:, None] * 2.4
    body += bp(rng.standard_normal((n, 2)), 70, 260, order=2) * _decay(n, 0.9, 0.006)[:, None] * 1.6
    out += body
    # 3. sub drop
    fsub = 34 + 60 * np.exp(-t / 0.33)
    sub = np.sin(_phase(fsub)) * _decay(n, 1.0, 0.003) * 1.4
    sub += 0.5 * np.sin(_phase(fsub * 2.01)) * _decay(n, 0.35, 0.003)
    out += sub[:, None]
    # 4. billowing roar tail
    turb = np.clip(1 + 0.45 * _smooth_noise(n, rng, 2.5) + 0.25 * _smooth_noise(n, rng, 7.0), 0.2, None)
    renv = _cos_env([(0, 0), (0.06, 1.0), (dur, 0.0)], n) * (0.45 * np.exp(-t / 0.5) + 0.55 * np.exp(-t / 2.6)) * turb
    fcut = 260 + 3400 * np.exp(-t / 0.7)

    def mask(tc, f):
        e = _interp_at(tc, n, renv)
        fc = _interp_at(tc, n, fcut)
        return e * m_tilt(f, -3.0, 200) / np.sqrt(1 + (f / fc) ** 4) * m_band(f, 28, 0, 18, 0)

    roar = _spec_noise(n, rng, mask, nfft=2048, nch=2, corr=0.2)
    out += roar * 1.6
    # 5. crackling (dense at first)
    crate = 260 * np.exp(-t / 0.6) + 25 * np.exp(-t / 2.5)
    cr = _crackle(n, rng, crate, lo=700, hi=5000, tau=0.002, alpha=1.4)
    cr2 = _crackle(n, rng, crate * 0.8, lo=700, hi=5000, tau=0.002, alpha=1.4)
    out += np.stack([cr, cr2], axis=1) * 0.5
    # 6. secondary booms (lava fountains)
    for tb, a in ((0.55, 0.55), (1.3, 0.4)):
        m = _n(1.2)
        tt = _time(m)
        b = np.sin(_phase(38 + 34 * np.exp(-tt / 0.1))) * _decay(m, 0.4, 0.004)
        b += lp(rng.standard_normal(m), 300) * _decay(m, 0.15, 0.004) * 0.8
        _add(out, tb, b * a * 1.6)
    # 7. debris rain: rock thuds + pebbles
    for _ in range(28):
        td = 0.8 + 3.7 * rng.random() ** 1.3
        a = 0.45 * (1 - (td - 0.8) / 4.2) * rng.uniform(0.3, 1.0)
        _bounce_seq(out, rng, td, a, rng.uniform(-0.9, 0.9), size=rng.uniform(0.9, 1.8))
    for _ in range(7):
        td = rng.uniform(0.9, 3.5)
        m = _n(0.3)
        tt = _time(m)
        th = np.sin(_phase(rng.uniform(90, 170) * (1 + 0.4 * np.exp(-tt / 0.01)))) * _decay(m, 0.05, 0.001)
        th += lp(rng.standard_normal(m), 900) * _decay(m, 0.02, 0.0005) * 0.5
        _add(out, td, _pan(th * rng.uniform(0.3, 0.7), rng.uniform(-0.7, 0.7)))
    out = np.tanh(out * 0.9)
    return _reverb(out, "big", 0.28, send_hp=90)


# ---------------------------------------------------------------- impacts
@_register("bonk", -15.0, "cartoon bonk: hollow coconut/woodblock knock with quick pitch drop",
           anchors=dict(hit=0.0))
def _sfx_bonk(rng):
    n = _n(0.55)
    t = _time(n)
    f = 385 + 285 * np.exp(-t / 0.032)
    body = np.sin(_phase(f)) * _decay(n, 0.12, 0.0005)
    body += 0.33 * np.sin(_phase(f * 2.37)) * _decay(n, 0.04, 0.0005)
    body += 0.12 * np.sin(_phase(f * 3.91)) * _decay(n, 0.022, 0.0005)
    # plastic helmet shell 'tick'
    shell = sum(np.sin(TAU * fr * t) * np.exp(-t / 0.018) for fr in (1830, 2470, 3320)) * 0.08
    thump = np.sin(_phase(110 + 70 * np.exp(-t / 0.015))) * _decay(n, 0.05, 0.001) * 0.55
    click = bp(rng.standard_normal(n) * np.exp(-t / 0.0012), 1800, 7000) * 0.5
    y = body + shell + thump + click
    return _reverb(_pan(y, 0.0), "room", 0.12)


@_register("splat", -16.0, "wet juicy orange splat with squelch and droplets",
           anchors=dict(hit=0.0))
def _sfx_splat(rng):
    n = _n(0.75)
    t = _time(n)
    out = np.zeros((n, 2))
    thump = np.sin(_phase(150 * (0.5 + 0.5 * np.exp(-t / 0.03)))) * _decay(n, 0.06, 0.001)
    thump += lp(rng.standard_normal(n), 700) * _decay(n, 0.04, 0.001) * 0.8
    sq = _tvf(rng.standard_normal(n), "bp", 520 + 3200 * np.exp(-t / 0.045), 1.6, block=32)
    wet_grain = 0.6 + 0.4 * np.abs(_smooth_noise(n, rng, 90))
    sq *= _decay(n, 0.075, 0.0015) * wet_grain * 1.6
    spray = bp(rng.standard_normal((n, 2)), 2500, 9000) * _decay(n, 0.09, 0.003)[:, None] * 0.35
    out += _pan(thump * 1.1 + sq, 0.0) + spray
    for _ in range(14):
        td = 0.02 + 0.45 * rng.random() ** 1.6
        a = 0.35 * (1 - td / 0.5) * rng.uniform(0.4, 1.0)
        _add(out, td, _pan(_bubble(rng.uniform(1100, 2600), rng.uniform(0.006, 0.014), rise=1.0, amp=a),
                           rng.uniform(-0.8, 0.8)))
    return _reverb(out, "room", 0.1)


@_register("thud", -16.0, "dull heavy thud", anchors=dict(hit=0.0))
def _sfx_thud(rng):
    n = _n(0.6)
    t = _time(n)
    f = 55 + 65 * np.exp(-t / 0.035)
    y = np.sin(_phase(f)) * _decay(n, 0.12, 0.002) * 1.2
    y += 0.35 * np.sin(_phase(2.02 * f)) * _decay(n, 0.06, 0.002)
    y += lp(rng.standard_normal(n), 650, order=3) * _decay(n, 0.05, 0.001) * 1.1
    y += bp(rng.standard_normal(n), 120, 420) * _decay(n, 0.08, 0.002) * 1.0
    y += bp(rng.standard_normal(n) * np.exp(-t / 0.001), 1000, 4000) * 0.25
    y = np.tanh(1.6 * y / np.abs(y).max())
    out = _pan(y, 0.0)
    for _ in range(4):
        _bounce_seq(out, rng, rng.uniform(0.04, 0.2), 0.08, rng.uniform(-0.6, 0.6), size=1.2, nb=2)
    return _reverb(out, "outdoor", 0.08, send_hp=100)


@_register("hammer", -15.5, "wooden mallet on a stake, three knocks",
           anchors=dict(knocks=[0.0, 0.42, 0.84]))
def _sfx_hammer(rng):
    out = np.zeros((_n(1.4), 2))
    for i, (tk, sc, a) in enumerate(((0.0, 1.0, 0.85), (0.42, 0.965, 0.92), (0.84, 0.93, 1.0))):
        _add(out, tk, _pan(_knock(rng, sc, a), -0.05 + 0.03 * i))
    return _reverb(out, "outdoor", 0.12)


@_register("pop", -18.0, "cartoon mouth-pop / cork 'pwop'", anchors=dict(hit=0.0))
def _sfx_pop(rng):
    n = _n(0.22)
    t = _time(n)
    f = 260 + 900 * (1 - np.exp(-t / 0.012))
    y = np.sin(_phase(f)) * _decay(n, 0.03, 0.0015)
    y += 0.25 * np.sin(2 * _phase(f)) * _decay(n, 0.015, 0.0015)
    y += bp(rng.standard_normal(n) * np.exp(-t / 0.0008), 1500, 6000) * 0.25
    return _reverb(_pan(y, 0.0), "room", 0.08)


# ---------------------------------------------------------------- wings
_FLAP_TIMES = [0.0, 0.28, 0.55, 0.82, 1.1]


@_register("flap", -18.5, "one big wing flap whoosh", anchors=dict(stroke=0.075))
def _sfx_flap(rng):
    y = _flap(rng, 1.0)
    return _reverb(_widen(y, rng, 0.4), "outdoor", 0.1)


@_register("flaps", -16.0, "five big vulture wing flaps (take-off / landing), ~1.5 s",
           anchors=dict(strokes=[round(x + 0.08, 3) for x in _FLAP_TIMES], end=1.5))
def _sfx_flaps(rng):
    out = np.zeros((_n(1.9), 2))
    amps = (0.8, 1.0, 0.95, 0.85, 0.7)
    for i, (tf, a) in enumerate(zip(_FLAP_TIMES, amps)):
        y = _flap(rng, rng.uniform(1.0, 1.15), a)
        _add(out, tf, _pan(y, -0.35 + 0.15 * i))
    # feathers settling
    n = _n(0.35)
    rust = _crackle(n, rng, 600 * np.exp(-_time(n) / 0.1), lo=2500, hi=8000, tau=0.0008, alpha=2.5) * np.exp(-_time(n) / 0.12)
    _add(out, 1.3, _pan(rust * 0.12, 0.25))
    return _reverb(out, "outdoor", 0.1)


@_register("land", -18.5, "soft feathery landing thump + settle", anchors=dict(touch=0.0))
def _sfx_land(rng):
    n = _n(0.7)
    t = _time(n)
    y = np.sin(_phase(88 + 45 * np.exp(-t / 0.02))) * _decay(n, 0.06, 0.004) * 0.8
    y += lp(rng.standard_normal(n), 1300) * _decay(n, 0.045, 0.003) * 0.9
    rust = _crackle(n, rng, 1500 * np.exp(-t / 0.12), lo=2200, hi=8000, tau=0.0009, alpha=2.5) * 0.35 * np.exp(-t / 0.15)
    rust += bp(rng.standard_normal(n), 1800, 6000) * _decay(n, 0.12, 0.01) * 0.12
    out = _pan(y + rust, 0.0)
    # tiny settling flutter
    for tf, a in ((0.16, 0.22), (0.27, 0.15)):
        _add(out, tf, _pan(_flap(rng, 0.6, a), 0.15))
    return _reverb(out, "outdoor", 0.08)


# ---------------------------------------------------------------- glass / thermometer
@_register("glass_ping", -20.0, "tense rising glass whine as the thermometer climbs (~1.45 s)",
           anchors=dict(ping=0.0, peak=1.42))
def _sfx_glass_ping(rng):
    T = 1.45
    n = _n(T)
    t = _time(n)
    out = np.zeros(n)
    f0 = 1568.0
    for r, a, tau in ((1.0, 1.0, 0.5), (2.32, 0.35, 0.2), (4.25, 0.12, 0.08)):
        out += a * np.sin(TAU * f0 * r * t) * np.exp(-t / tau)
    out *= _ramp(n, 0.001) * 0.45
    u = np.clip((t - 0.12) / (T - 0.12), 0, 1)
    f = 880 * (2500 / 880) ** (u ** 1.5)
    amp = (u ** 1.6) * _ramp(n, 0.2)
    ph = _phase(f)
    whine = np.sin(ph) + 0.8 * np.sin(_phase(f * 1.0045)) + 0.12 * np.sin(2 * ph)
    whine *= amp * (1 + 0.15 * np.sin(TAU * (6 + 10 * u) * t))
    stress = _crackle(n, rng, 30 * u ** 3, lo=2000, hi=7000, tau=0.0006, alpha=3.0) * 0.05 * u
    y = out + whine * 0.55 + stress
    y = _fade_edges(y, 0.0, 0.03)
    return _reverb(_widen(y, rng, 0.3), "room", 0.15)


def _shard(rng, amp, hi=1.0):
    n = _n(0.45)
    t = _time(n)
    base = rng.uniform(2600, 7500) * hi
    y = np.zeros(n)
    for r, a in ((1.0, 1.0), (rng.uniform(1.5, 2.9), 0.5), (rng.uniform(3.0, 4.6), 0.25)):
        fr = base * r
        if fr < 15000:
            y += a * np.sin(TAU * fr * t) * np.exp(-t / rng.uniform(0.02, 0.09))
    return y * _ramp(n, 0.0003) * amp * _taper(n, 0.3)


@_register("glass_pop", -17.0, "thermometer bulb pops, then a tinkle of glass (~1 s)",
           anchors=dict(pop=0.0))
def _sfx_glass_pop(rng):
    n = _n(1.5)
    t = _time(n)
    out = np.zeros((n, 2))
    pop = np.sin(_phase(450 + 900 * np.exp(-t / 0.006))) * _decay(n, 0.014, 0.0004) * 0.8
    pop += bp(rng.standard_normal(n) * np.exp(-t / 0.003), 700, 6000) * 1.0
    pop += lp(rng.standard_normal(n), 1500) * _decay(n, 0.025, 0.001) * 0.35
    out += _pan(pop, 0.0)
    crunch = _crackle(n, rng, 5000 * np.exp(-t / 0.012), lo=3000, hi=10000, tau=0.0004, alpha=2.0) * 0.3
    out += _widen(crunch, rng, 0.6)
    for _ in range(12):
        _add(out, 0.004 + 0.05 * rng.random() ** 2, _pan(_shard(rng, rng.uniform(0.2, 0.45)), rng.uniform(-0.5, 0.5)))
    for _ in range(18):
        u = rng.random() ** 1.7
        _add(out, 0.08 + 0.72 * u, _pan(_shard(rng, 0.3 * (1 - u) ** 1.2 * rng.uniform(0.4, 1.0), 1.1),
                                        rng.uniform(-0.8, 0.8)))
    return _reverb(out, "room", 0.15)


# ---------------------------------------------------------------- water
def _splash(rng, big):
    dur = 3.0 if big else 1.4
    n = _n(dur)
    t = _time(n)
    out = np.zeros((n, 2))
    # plunge cavity 'ploonk' (rising) + slap
    if big:
        f = 70 + 110 * (1 - np.exp(-t / 0.06))
        pl = np.sin(_phase(f)) * _decay(n, 0.16, 0.003) * 1.0
        pl += lp(rng.standard_normal(n), 400) * _decay(n, 0.09, 0.002) * 1.2
    else:
        f = 190 + 260 * (1 - np.exp(-t / 0.03))
        pl = np.sin(_phase(f)) * _decay(n, 0.07, 0.002) * 0.8
        pl += lp(rng.standard_normal(n), 600) * _decay(n, 0.04, 0.002) * 0.6
    slap = bp(rng.standard_normal(n), 300, 7000) * _decay(n, 0.05 if big else 0.03, 0.0008) * 1.4
    out += _pan(pl + slap, 0.0)
    # spray / sheet of water
    tau_s = 0.55 if big else 0.22
    senv = _cos_env([(0, 0), (0.02, 1.0), (dur, 0.0)], n) * np.exp(-t / tau_s)
    senv *= np.clip(1 + 0.4 * _smooth_noise(n, rng, 25), 0.1, None)

    def smask(tc, f):
        return _interp_at(tc, n, senv) * m_peak(f, 2200, 1.3) * m_band(f, 400, 9500, 12, 18)

    out += _spec_noise(n, rng, smask, nfft=512, nch=2, corr=0.25) * (1.0 if big else 0.75)
    if big:
        wenv = _cos_env([(0, 0), (0.2, 0.0), (0.55, 1.0), (dur, 0.0)], n)

        def wmask(tc, f):
            return _interp_at(tc, n, wenv) * m_band(f, 150, 1400, 12, 12)

        out += _spec_noise(n, rng, wmask, nfft=1024, nch=2, corr=0.1) * 0.6
    # droplets falling back
    nd = 70 if big else 22
    span = 2.2 if big else 0.9
    for _ in range(nd):
        u = rng.random() ** 1.5
        td = 0.12 + span * u
        a = 0.3 * (1 - u) ** 1.3 * rng.uniform(0.3, 1.0)
        _add(out, td, _pan(_bubble(rng.uniform(900, 3800), rng.uniform(0.005, 0.016), 1.1, a), rng.uniform(-0.9, 0.9)))
    for _ in range(15 if big else 6):
        td = rng.uniform(0.1, 0.4 * dur)
        _add(out, td, _pan(_bubble(rng.uniform(300, 900), rng.uniform(0.02, 0.05), 0.6,
                                   rng.uniform(0.05, 0.15)), rng.uniform(-0.6, 0.6)))
    return _reverb(out, "outdoor", 0.14 if big else 0.1)


@_register("splash", -16.5, "medium splash: plunk, spray, droplets (~1.3 s)", anchors=dict(hit=0.0))
def _sfx_splash(rng):
    return _splash(rng, False)


@_register("big_splash", -13.5, "big splash: deep plunge, wash, rain of droplets (~3 s)", anchors=dict(hit=0.0))
def _sfx_big_splash(rng):
    return _splash(rng, True)


_BUBBLE_TIMES = [0.0, 0.17, 0.29, 0.52, 0.63, 0.71, 0.95, 1.12, 1.2, 1.41, 1.62]


@_register("bubbles", -21.0, "a run of cartoon 'blub' bubbles (~1.8 s)", anchors=dict(blubs=_BUBBLE_TIMES))
def _sfx_bubbles(rng):
    out = np.zeros((_n(2.4), 2))
    for i, tb in enumerate(_BUBBLE_TIMES):
        big = rng.random() < 0.4
        f0 = rng.uniform(240, 420) if big else rng.uniform(450, 950)
        tau = rng.uniform(0.04, 0.07) if big else rng.uniform(0.02, 0.035)
        y = _bubble(f0, tau, rise=rng.uniform(0.5, 0.9), amp=1.0 if big else 0.7)
        y2 = _bubble(f0 * 2.1, tau * 0.5, 0.6)
        y[:len(y2)] += 0.15 * y2
        _add(out, tb, _pan(y, rng.uniform(-0.5, 0.5)))
    return _reverb(out, "room", 0.12)


@_register("boil", -19.0, "vigorous boiling water (~3 s, eased in/out)", anchors=dict(full=0.3, fade=2.4, end=3.0))
def _sfx_boil(rng):
    dur = 3.0
    n = _n(dur)
    env = _cos_env([(0, 0), (0.3, 1.0), (dur - 0.6, 1.0), (dur, 0.0)], n)
    out = _boil_bed(n, rng, 1.0)
    return _reverb(out * env[:, None], "outdoor", 0.1)


def _boil_bed(n, rng, intensity=1.0):
    t = _time(n)
    dur = n / SR
    out = np.zeros((n, 2))
    see = np.clip(1 + 0.5 * _smooth_noise(n, rng, 9), 0.2, None)

    def mask(tc, f):
        return _interp_at(tc, n, see) * m_peak(f, 900, 1.4) * m_band(f, 150, 4000, 12, 12)

    out += _spec_noise(n, rng, mask, nfft=1024, nch=2, corr=0.2) * 0.12 * intensity
    for count, (flo, fhi), (tlo, thi), amp in (
            (int(110 * dur * intensity), (700, 2800), (0.004, 0.012), 0.12),
            (int(16 * dur * intensity), (220, 650), (0.02, 0.05), 0.3),
            (int(3 * dur * intensity), (90, 180), (0.05, 0.09), 0.45)):
        for _ in range(count):
            y = _bubble(rng.uniform(flo, fhi), rng.uniform(tlo, thi), rng.uniform(0.4, 1.0), amp * rng.uniform(0.4, 1.0))
            _add(out, rng.uniform(0, dur), _pan(y, rng.uniform(-0.8, 0.8)))
    return out


# ---------------------------------------------------------------- air
@_register("whoosh", -17.0, "fast swish passing left to right (~0.6 s)", anchors={"pass": 0.27})
def _sfx_whoosh(rng):
    dur = 0.62
    n = _n(dur)
    tc0 = 0.27
    env = _cos_env([(0, 0), (tc0, 1.0), (tc0 + 0.06, 0.8), (dur, 0.0)], n) ** 1.3
    cen = _cos_env([(0, 450), (tc0, 1500), (dur, 650)], n)

    def mask(tc, f):
        e = _interp_at(tc, n, env)
        c = _interp_at(tc, n, cen)
        return e * (m_peak(f, c, 0.85) + 0.25 * m_peak(f, 2 * c, 0.12) + 0.12 * m_band(f, 200, 8000, 6, 12))

    y = _spec_noise(n, rng, mask, nfft=512, nch=1)
    pan = np.clip((_time(n) - tc0) / 0.25, -1, 1) * 0.75
    return _reverb(_pan(y, pan), "outdoor", 0.1)


ROCK_WHISTLE_LEN = 1.4


@_register("rock_whistle", -17.0, "falling bomb whistle, descending 1.4 s, ends abruptly (then nothing)",
           anchors=dict(impact=ROCK_WHISTLE_LEN))
def _sfx_rock_whistle(rng):
    T = ROCK_WHISTLE_LEN
    n = _n(T)
    t = _time(n)
    u = t / T
    f = 620 + (1900 - 620) * (1 - u ** 1.25)
    f *= 1 + 0.004 * np.sin(TAU * 5.5 * t)
    ph = _phase(f)
    y = np.sin(ph) + 0.08 * np.sin(2 * ph)
    breath = _tvf(_tvf(rng.standard_normal(n), "bp", f, 5.0, block=64), "bp", f, 5.0, block=64) * 0.9
    amp = _db(-15 + 15 * u ** 0.9) * (1 + 0.05 * _smooth_noise(n, rng, 12))
    y = (y + breath) * amp * _ramp(n, 0.06)
    y = _fade_edges(y, 0.0, 0.012)
    pan = 0.25 - 0.4 * u
    return _pan(y, pan)  # no reverb: it must stop dead


# ---------------------------------------------------------------- heat
@_register("sizzle", -21.0, "hot sizzle / frying crackle (~2.2 s)", anchors=dict(peak=0.05))
def _sfx_sizzle(rng):
    dur = 2.2
    n = _n(dur)
    t = _time(n)
    env = _cos_env([(0, 0), (0.05, 1.0), (1.5, 0.45), (dur, 0.0)], n)
    fl = np.clip(1 + 0.35 * _smooth_noise(n, rng, 4), 0.2, None)

    def mask(tc, f):
        return _interp_at(tc, n, env * fl) * m_peak(f, 5200, 0.9) * m_band(f, 2000, 10000, 18, 24)

    hiss = _spec_noise(n, rng, mask, nfft=1024, nch=2, corr=0.3) * 0.35
    fry = np.clip(0.5 + 0.5 * _smooth_noise(n, rng, 40), 0, None)
    hiss *= fry[:, None] ** 0.5
    # frying: a dense carpet of tiny, similar-sized crackles (light-tailed amplitudes)
    cr = np.stack([_crackle(n, rng, 2600 * env, 2200, 9000, 0.00025, 4.0) for _ in range(2)], axis=1) * 0.28
    pops = np.stack([_crackle(n, rng, 5 * env, 700, 3500, 0.0025, 3.0) for _ in range(2)], axis=1) * 0.2
    cr *= np.sqrt(env)[:, None]
    pops *= np.sqrt(env)[:, None]
    return _reverb(hiss + cr + pops, "room", 0.08)


@_register("lava_hiss", -16.0, "lava hits water: big steam hiss + glugs + sizzle (~3.5 s)", anchors=dict(peak=0.5))
def _sfx_lava_hiss(rng):
    dur = 3.5
    n = _n(dur)
    t = _time(n)
    env = _cos_env([(0, 0), (0.12, 0.7), (0.5, 1.0), (1.6, 0.75), (dur, 0.0)], n)
    turb = np.clip(1 + 0.35 * _smooth_noise(n, rng, 5) + 0.2 * _smooth_noise(n, rng, 13), 0.2, None)

    def mask(tc, f):
        e = _interp_at(tc, n, env * turb)
        return e * (m_band(f, 700, 6500, 12, 18) + 0.45 * m_band(f, 100, 500, 12, 12))

    steam = _spec_noise(n, rng, mask, nfft=1024, nch=2, corr=0.2) * 0.8
    bub = _boil_bed(n, rng, 0.8) * env[:, None]
    cr = np.stack([_crackle(n, rng, 250 * env, 2000, 9000, 0.0005, 1.8) for _ in range(2)], axis=1) * 0.35
    cr *= np.sqrt(env)[:, None]
    for _ in range(7):
        y = _bubble(rng.uniform(80, 160), rng.uniform(0.06, 0.1), 0.5, 0.5)
        _add(bub, rng.uniform(0.1, 2.6), _pan(y, rng.uniform(-0.5, 0.5)))
    return _reverb(steam + bub + cr, "outdoor", 0.15)


# ---------------------------------------------------------------- foley
@_register("paper_scribble", -25.0, "pencil scribbling on a notepad (~1.4 s)", anchors=dict(underline=1.05))
def _sfx_paper_scribble(rng):
    dur = 1.45
    n = _n(dur)
    out = np.zeros(n)
    t = 0.05
    strokes = []
    while t < 0.95:
        d = rng.uniform(0.06, 0.17)
        strokes.append((t, d, rng.uniform(0.6, 1.0)))
        t += d + rng.uniform(0.015, 0.07)
    strokes.append((1.05, 0.26, 1.0))     # final underline
    for (ts, d, a) in strokes:
        m = _n(d)
        tt = _time(m)
        env = _ramp(m, 0.012) * _ramp(m, 0.02)[::-1] * a
        grit = 0.55 + 0.45 * np.abs(_smooth_noise(m, rng, rng.uniform(35, 70)))
        c = rng.uniform(3000, 4300) * (1 + 0.18 * np.sin(TAU * rng.uniform(5, 9) * tt))
        z = rng.standard_normal(m)
        y = _tvf(_tvf(z, "bp", c, 1.6, block=64), "bp", c * 1.1, 1.2, block=64) * 1.4 + bp(z, 1000, 2000, 2) * 0.12
        y += _crackle(m, rng, 260, 2500, 8000, 0.0003, 3.0) * 0.3
        i0 = _n(ts)
        out[i0:i0 + m] += (y * env * grit)[:len(out) - i0]
    tap = np.zeros(n)
    tap[:_n(0.03)] = bp(rng.standard_normal(_n(0.03)) * np.exp(-_time(_n(0.03)) / 0.002), 1500, 5000) * 0.6
    out = hp(out + tap, 700, order=2)
    return _reverb(_pan(out, 0.1), "wood", 0.15)


@_register("zip", -21.0, "backpack zipper 'zzzip' (~0.5 s)", anchors=dict(end=0.47))
def _sfx_zip(rng):
    dur = 0.55
    n = _n(dur)
    t = _time(n)
    rate = _cos_env([(0, 40), (0.06, 140), (0.33, 430), (0.44, 260), (0.47, 0.0), (dur, 0.0)], n)
    ph = np.cumsum(rate) / SR
    teeth = np.floor(ph)
    hits = np.nonzero(np.diff(teeth) > 0)[0] + 1
    level = np.clip(rate / 300, 0, 1.2) ** 0.7
    # each tooth: a tiny plastic/metal tick; 4 kernel variants
    kl = _n(0.004)
    tk = _time(kl)
    y = np.zeros(n)
    grp = rng.integers(0, 4, len(hits))
    for g in range(4):
        ker = np.zeros(kl)
        for f, tau, a in ((rng.uniform(2100, 2600), 0.0009, 1.0), (rng.uniform(3400, 4000), 0.0006, 0.7),
                          (rng.uniform(5200, 6200), 0.0004, 0.4)):
            ker += a * np.sin(TAU * f * tk) * np.exp(-tk / tau)
        ker += 0.4 * rng.standard_normal(kl) * np.exp(-tk / 0.0003)
        imp = np.zeros(n)
        sel = hits[grp == g]
        imp[sel] = rng.uniform(0.6, 1.0, len(sel)) * level[sel]
        y += oaconvolve(imp, ker)[:n]
    y += bp(rng.standard_normal(n), 2500, 8000) * level * 0.04
    y = _fade_edges(y, 0.004, 0.01)
    # the slider bumping the end stop
    out = _pan(y, -0.1)
    _add(out, 0.472, _pan(_pebble(rng, 0.8, 0.25), -0.1))
    return _reverb(out, "room", 0.08)


# ---------------------------------------------------------------- musical stings
def _chord_hit(out, t0, notes, dur, rng, vel=1.0, amp_pts=None, vib=0.0, bright=1.0, organ=0.35, trem=0.0):
    for m in notes:
        for det in (-7.0, 6.0):
            y = _brass(m, dur, rng, vel=vel, amp_pts=amp_pts, vib=vib, bright=bright, detune=det + rng.uniform(-2, 2))
            pan = np.clip((m - 55) / 30.0, -0.6, 0.6) + (0.12 if det > 0 else -0.12)
            _add(out, t0, _pan(y * 0.5, pan))
        if organ:
            _add(out, t0, _pan(_organ(m, dur, rng, vel * organ, trem=trem, amp_pts=amp_pts), 0.0) * 0.6)


STING_BAD_HITS = [0.0, 0.3, 0.6]
#: (time, chord name, midi notes) -- Dm, Dm, G#dim7 (A drops to G#, bass falls a tritone)
STING_BAD_SCORE = [(0.0, "Dm", [38, 45, 50, 53, 57, 62]),
                   (0.3, "Dm", [38, 45, 50, 53, 57, 62]),
                   (0.6, "G#dim7", [32, 44, 50, 53, 56, 59, 62])]


@_register("sting_bad", -12.0, "comedic 'dun dun DUUUN' brass + organ + timpani (~2.6 s + hall tail)",
           anchors=dict(hits=STING_BAD_HITS, end=2.6))
def _sfx_sting_bad(rng):
    out = np.zeros((_n(3.8), 2))
    stab = [(0, 0), (0.015, 1.0), (0.08, 0.6), (0.17, 0.5), (0.24, 0.0)]
    for (t0, _, notes), vel in zip(STING_BAD_SCORE[:2], (0.85, 0.95)):
        _chord_hit(out, t0, notes, 0.17, rng, vel=vel, amp_pts=stab, bright=1.0, organ=0.25)
    long_pts = [(0, 0), (0.02, 1.1), (0.25, 0.62), (0.85, 0.85), (1.25, 0.62), (2.0, 0.0)]
    _chord_hit(out, STING_BAD_SCORE[2][0], STING_BAD_SCORE[2][2], 1.92, rng, vel=1.0, amp_pts=long_pts,
               vib=1.0, bright=0.9, organ=0.4, trem=0.12)
    for t0, m, v in ((0.0, 38, 0.8), (0.3, 38, 0.9), (0.6, 44, 1.1)):
        _add(out, t0, _pan(_timpani(m, v, rng=rng), 0.1))
    # timpani roll under the last chord
    for k in range(14):
        tk = 0.72 + k * 0.065
        _add(out, tk, _pan(_timpani(44, 0.18 + 0.03 * np.sin(k), dur=0.4, rng=rng), 0.1))
    return _reverb(out, "hall", 0.22)


STING_GOOD_HITS = [0.0, 0.16]
STING_GOOD_SCORE = [(0.0, "G", [43, 55, 59, 62, 67]), (0.16, "C", [36, 48, 60, 64, 67, 72, 76])]


@_register("sting_good", -13.0, "bright brass 'ta-DA!' with glockenspiel sparkle and cymbal (~1.8 s)",
           anchors=dict(hits=STING_GOOD_HITS))
def _sfx_sting_good(rng):
    out = np.zeros((_n(5.0), 2))
    ta = [(0, 0), (0.012, 1.0), (0.06, 0.7), (0.1, 0.6), (0.15, 0.0)]
    da = [(0, 0), (0.014, 1.15), (0.12, 0.85), (0.7, 0.75), (1.5, 0.0)]
    _chord_hit(out, 0.0, STING_GOOD_SCORE[0][2], 0.1, rng, vel=0.8, amp_pts=ta, bright=1.3, organ=0.0)
    _chord_hit(out, 0.16, STING_GOOD_SCORE[1][2], 1.42, rng, vel=1.0, amp_pts=da, vib=0.6, bright=1.4, organ=0.15)
    for k, m in enumerate((84, 88, 91, 96)):
        _add(out, 0.16 + 0.045 * k, _pan(_bar(m, rng, 0.22, "glock"), -0.3 + 0.2 * k))
    _add(out, 0.16, _cymbal(1.8, rng, 0.8, 0.22))
    _add(out, 0.0, _pan(_timpani(43, 0.5, 0.6, rng), 0.0))
    _add(out, 0.16, _pan(_timpani(36, 0.9, 2.4, rng), 0.0))
    return _reverb(out, "hall", 0.2)


@_register("laugh_chuckle", -18.0, "warm marimba 'heh-heh-heh' chuckle (tasteful laugh substitute)",
           anchors=dict(notes=[0.0, 0.1, 0.2, 0.3, 0.48]))
def _sfx_laugh_chuckle(rng):
    out = np.zeros((_n(3.6), 2))
    score = [(0.0, (76, 72)), (0.1, (74, 71)), (0.2, (72, 69)), (0.3, (71, 67)), (0.48, (67, 64, 60))]
    for i, (t0, notes) in enumerate(score):
        vel = 0.85 if i < 4 else 0.75
        for j, m in enumerate(notes):
            _add(out, t0 + 0.006 * j, _pan(_bar(m, rng, vel * (1.0 if j == 0 else 0.7)), -0.25 + 0.25 * j))
    # soft roll on the last dyad
    for k in range(4):
        _add(out, 0.56 + 0.07 * k, _pan(_bar(67, rng, 0.22 - 0.04 * k), 0.1))
        _add(out, 0.56 + 0.07 * k, _pan(_bar(64, rng, 0.18 - 0.03 * k), -0.1))
    return _reverb(out, "wood", 0.2)


# ---------------------------------------------------------------- voices
@_register("crowd_gasp", -18.0, "small crowd gasp into an airy 'oooh' swell (formant synthesis)",
           anchors=dict(gasp=0.0, ooh=0.3))
def _sfx_crowd_gasp(rng):
    dur = 2.0
    n = _n(dur)
    out = np.zeros((n, 2))
    # gasp: breathy inhales with 'ah' formants
    for v in range(8):
        m = _n(0.32)
        z = rng.standard_normal(m)
        y = 0.0
        sh = rng.uniform(0.9, 1.15)
        for F, B, A in _VOWELS["a"][:3]:
            y = y + _db(A) * bp(z, F * sh - B, F * sh + B, 1)
        y += 0.25 * bp(z, 2500, 6000)
        env = _cos_env([(0, 0), (0.07, 1.0), (0.15, 0.9), (0.2, 0.0), (0.32, 0.0)], m)
        _add(out, rng.uniform(0.0, 0.06), _pan(y * env * rng.uniform(0.6, 1.0), rng.uniform(-0.7, 0.7)))
    # 'ooh': voiced, breathy, small crowd
    for v in range(7):
        m = _n(1.6)
        tt = _time(m)
        base = rng.choice([110, 130, 165, 196, 220, 247, 262]) * rng.uniform(0.97, 1.03)
        contour = 1 + 0.06 * np.exp(-((tt - 0.35) / 0.25) ** 2) - 0.05 * np.clip(tt - 0.6, 0, 1)
        f0 = base * contour * (1 + 0.012 * np.sin(TAU * rng.uniform(4.5, 6) * tt) * np.clip(tt / 0.5, 0, 1))
        w_o = np.clip(1 - tt / 0.6, 0, 1)
        y = _vox(m, f0, [("o", w_o), ("u", 1 - w_o)], rng, breath=0.3)
        env = _cos_env([(0, 0), (0.35, 1.0), (0.9, 0.8), (1.6, 0.0)], m)
        _add(out, 0.25 + rng.uniform(0, 0.08), _pan(y * env * 0.12 * rng.uniform(0.6, 1.0), rng.uniform(-0.8, 0.8)))
    out = lp(out, 7000)
    return _reverb(out, "room", 0.25)


# ---------------------------------------------------------------- nature
def _cricket_chirp(rng, f0, pulses, amp):
    pd, gap = 0.017, 0.013
    n = _n(pulses * (pd + gap) + 0.02)
    y = np.zeros(n)
    for k in range(pulses):
        m = _n(pd)
        tt = _time(m)
        f = f0 * (1 - 0.012 * tt / pd)
        env = np.sin(np.pi * tt / pd) ** 1.5
        ph = _phase(f)
        y[_n(k * (pd + gap)):_n(k * (pd + gap)) + m] += (np.sin(ph) + 0.08 * np.sin(2 * ph)) * env * (0.85 + 0.15 * (k == 0))
    return y * amp


CRICKET_CHIRPS = [0.1, 0.72, 1.34, 1.96]


@_register("cricket", -27.0, "awkward-silence crickets: chirp... chirp... (~2.6 s)",
           anchors=dict(chirps=CRICKET_CHIRPS))
def _sfx_cricket(rng):
    dur = 2.8
    n = _n(dur)
    out = np.zeros((n, 2))
    fA = 4300 * rng.uniform(0.98, 1.02)
    for tc in CRICKET_CHIRPS:
        _add(out, tc, _pan(_cricket_chirp(rng, fA, 3, 1.0), -0.35))
    fB = 3750 * rng.uniform(0.98, 1.02)
    for tc in (0.42, 1.15, 1.7, 2.3):
        _add(out, tc + rng.uniform(-0.02, 0.02), _pan(_cricket_chirp(rng, fB, 4, 0.3), 0.55))
    night = _fade_edges(lp(rng.standard_normal((n, 2)), 1500) * 0.003, 0.15, 0.4)
    out = out + night
    return _reverb(out, "outdoor", 0.25)


@_register("birds", -23.0, "a few tropical bird chirps (~3 s)", anchors=dict(calls=[0.0, 0.45, 1.1, 1.55, 2.25]))
def _sfx_birds(rng):
    out = np.zeros((_n(3.2), 2))
    plan = [(0.0, "chirps", -0.4, 1.0), (0.45, "wheeto", 0.5, 0.9), (1.1, "trill", -0.1, 0.45),
            (1.55, "kiskadee", 0.3, 0.8), (2.25, "chirps", -0.65, 0.6)]
    for t0, kind, pan, a in plan:
        y = _bird_call(kind, rng, rng.uniform(0.93, 1.07))
        _add(out, t0, _pan(y * a, pan))
    return _reverb(out, "outdoor", 0.3)


# =============================================================================
#  ambiences
# =============================================================================
_AMB = {}
AMB_LEVELS = {}


def _amb(name, lufs, desc):
    def deco(fn):
        _AMB[name] = dict(fn=fn, lufs=lufs, desc=desc)
        AMB_LEVELS[name] = lufs
        return fn
    return deco


def _events(rng, dur, rate, margin=0.0):
    """Poisson event times in [-margin, dur)."""
    k = rng.poisson(rate * (dur + margin))
    return np.sort(rng.uniform(-margin, dur, k))


@_amb("jungle", -24.0, "distant tropical birds, insects, leaf rustle in gentle gusts")
def _amb_jungle(n, rng):
    dur = n / SR
    t = _time(n)
    out = np.zeros((n, 2))
    gust = np.clip(0.5 + 0.35 * _smooth_noise(n, rng, 0.1) + 0.15 * _smooth_noise(n, rng, 0.4), 0.1, None)

    def air(tc, f):
        g = _interp_at(tc, n, gust)
        return (0.35 + 0.65 * g) * m_tilt(f, -4.5, 300) * m_band(f, 120, 5000, 12, 18)

    out += _spec_noise(n, rng, air, nfft=1024, nch=2, corr=0.2) * 0.022

    def leaf(tc, f):
        g = _interp_at(tc, n, gust)
        return g ** 2 * m_peak(f, 4200, 0.9)

    gran = np.clip(0.2 + 0.8 * np.abs(_smooth_noise(n, rng, 22.0)) ** 2, 0, 2.5)
    out += _spec_noise(n, rng, leaf, nfft=512, nch=2, corr=0.1) * (gran * 0.022)[:, None]
    rust = np.stack([_crackle(n, rng, 90 * gust ** 3, 2200, 8000, 0.0008, 3.0) for _ in range(2)], axis=1)
    out += rust * 0.02
    # insects: buzzing choirs (narrow bands, pulsed) with slow swells
    for fc, rate_am, sharp, lvl in ((4600, 92.0, 3.0, 0.03), (6300, 27.0, 2.0, 0.016)):
        swell = np.clip(0.5 + 0.5 * _smooth_noise(n, rng, 0.06), 0.05, 1.0) ** 1.5

        def ins(tc, f, fc=fc, swell=swell):
            return _interp_at(tc, n, swell) * m_peak(f, fc, 0.04)

        z = _spec_noise(n, rng, ins, nfft=4096, nch=2, corr=0.3)
        am = (0.5 + 0.5 * np.sin(TAU * rate_am * t + 1.5 * _smooth_noise(n, rng, 0.4))) ** sharp
        out += z * (0.15 + am)[:, None] * lvl
    # katydid-ish 'tsk tsk tsk' phrases, far away
    kat = np.zeros((n + _n(2.0), 2))
    for tp in _events(rng, dur, 0.12, margin=1.0):
        pan = rng.uniform(-0.9, 0.9)
        fk = rng.uniform(6500, 7800)
        for k in range(int(rng.integers(3, 8))):
            m = _n(0.014)
            tt = _time(m)
            y = np.sin(TAU * fk * tt) * np.sin(np.pi * tt / 0.014) ** 2
            _add(kat, tp + k * 0.16, _pan(y * 0.012, pan))
    out += kat[:n]
    # distant birds (+ the odd tree frog)
    birds = np.zeros((n + _n(2.0), 2))
    for tb in _events(rng, dur, 0.45, margin=1.0):
        kind = BIRD_KINDS[int(rng.integers(0, len(BIRD_KINDS)))]
        y = _bird_call(kind, rng, rng.uniform(0.85, 1.15))
        y = lp(y, rng.uniform(3000, 6500)) * _db(rng.uniform(-21, -9))
        _add(birds, tb, _pan(y, rng.uniform(-0.95, 0.95)))
    for tb in _events(rng, dur, 0.06, margin=1.0):
        s = [(0.0, 0.06, 1050, 1250, 0.7, 1.0), (0.09, 0.11, 1900, 2350, 1.0, 0.6)]
        _add(birds, tb, _pan(_syllables(s, (0.15, 0.04)) * _db(rng.uniform(-22, -14)), rng.uniform(-0.8, 0.8)))
    birds = _reverb(birds, "outdoor", 0.7)
    out += birds[:n] * 0.09
    return out


@_amb("water", -26.0, "gentle hot-spring bubbling and lapping")
def _amb_water(n, rng):
    dur = n / SR
    out = np.zeros((n + _n(2.0), 2))
    # soft fizz / trickle bed
    fizz = np.clip(0.7 + 0.3 * _smooth_noise(n, rng, 0.3), 0.2, None)

    def bed(tc, f):
        return _interp_at(tc, n, fizz) * m_peak(f, 1600, 0.9) * m_band(f, 500, 5000, 12, 18)

    gran = np.clip(0.15 + 0.85 * np.abs(_smooth_noise(n, rng, 35.0)) ** 2, 0, 3)
    out[:n] += _spec_noise(n, rng, bed, nfft=1024, nch=2, corr=0.2) * (gran * 0.02)[:, None]
    # gentle laps against the rocks: a cluster of gurgles + a soft wash on each little wave
    for tl in _events(rng, dur, 0.6, margin=1.0):
        d = rng.uniform(0.35, 0.7)
        m = _n(d)
        pan = rng.uniform(-0.8, 0.8)
        lvl = rng.uniform(0.5, 1.0)
        env = _cos_env([(0, 0), (d * 0.35, 1.0), (d, 0.0)], m) ** 2
        wash = bp(rng.standard_normal(m), 350, 1800) * env * 0.035
        clip = _pan(wash, pan)
        for _ in range(int(rng.integers(5, 13))):
            tp = d * np.clip(rng.normal(0.38, 0.12), 0.05, 0.85)
            _add(clip, tp, _pan(_bubble(rng.uniform(220, 950), rng.uniform(0.008, 0.03), rng.uniform(0.2, 0.7),
                                        rng.uniform(0.01, 0.04)), pan + rng.uniform(-0.2, 0.2)))
        _add(out, tl, clip * lvl)
    # bubbles rising from the spring
    for tb in _events(rng, dur, 3.0, margin=0.2):
        big = rng.random() < 0.25
        y = _bubble(rng.uniform(180, 420) if big else rng.uniform(450, 1100),
                    rng.uniform(0.03, 0.06) if big else rng.uniform(0.01, 0.025), rng.uniform(0.4, 0.9),
                    rng.uniform(0.012, 0.04))
        _add(out, tb, _pan(y, rng.uniform(-0.7, 0.7)))
    return _reverb(out, "outdoor", 0.15)[:n]


@_amb("fire", -21.0, "crackling, roaring fire / burning jungle")
def _amb_fire(n, rng):
    dur = n / SR
    t = _time(n)
    und = np.clip(0.75 + 0.25 * _smooth_noise(n, rng, 0.4) + 0.15 * _smooth_noise(n, rng, 2.5), 0.2, None)
    flick = np.clip(1 + 0.4 * _smooth_noise(n, rng, 6.0), 0.2, None)

    def roar(tc, f):
        u = _interp_at(tc, n, und)
        fl = _interp_at(tc, n, flick)
        return u * (m_tilt(f, -4.5, 150) * m_band(f, 35, 1200, 12, 12) + 0.35 * fl * m_peak(f, 700, 1.0))

    out = _spec_noise(n, rng, roar, nfft=2048, nch=2, corr=0.3) * 0.45
    burst = np.clip(0.4 + 0.8 * np.maximum(_smooth_noise(n, rng, 1.3), 0) ** 2, 0, None)
    cr = np.stack([_crackle(n, rng, 34 * burst, 800, 6000, 0.0015, 2.2) for _ in range(2)], axis=1)
    out += cr * 0.4
    pop = np.zeros((n, 2))
    for tp in _events(rng, dur, 0.6):
        m = _n(0.12)
        tt = _time(m)
        y = bp(rng.standard_normal(m) * np.exp(-tt / 0.004), 400, 5000) + np.sin(TAU * rng.uniform(150, 300) * tt) * np.exp(-tt / 0.02) * 0.4
        _add(pop, tp, _pan(y * rng.uniform(0.15, 0.4), rng.uniform(-0.8, 0.8)))
    out += pop
    out += bp(rng.standard_normal((n, 2)), 4000, 9000) * 0.01 * und[:, None]
    return _reverb(out, "outdoor", 0.15)[:n]


@_amb("river", -22.0, "wide, steadily flowing river with babble and gurgles")
def _amb_river(n, rng):
    dur = n / SR
    mods = [np.clip(1 + 0.25 * _smooth_noise(n, rng, r), 0.3, None) for r in (0.07, 0.25)]

    def flow(tc, f):
        a = _interp_at(tc, n, mods[0])
        b = _interp_at(tc, n, mods[1])
        return a * m_tilt(f, -4.0, 400) * m_band(f, 70, 3500, 12, 18) + 0.6 * b * m_peak(f, 750, 0.9)

    out = _spec_noise(n, rng, flow, nfft=1024, nch=2, corr=0.1) * 0.12
    # babble: mid-band water texture with a choppy, gurgling amplitude
    for ch_seed in range(2):
        chop = np.clip(0.25 + 0.75 * np.abs(_smooth_noise(n, rng, 26.0)) ** 2, 0, 3)

        def bab(tc, f):
            return m_peak(f, 1200, 0.8) * m_band(f, 300, 4000, 12, 18)

        z = _spec_noise(n, rng, bab, nfft=512, nch=1)
        out[:, ch_seed] += z * chop * 0.1
    gur = np.zeros((n + _n(0.5), 2))
    for tb in _events(rng, dur, 90, margin=0.2):
        y = _bubble(rng.uniform(300, 1800), rng.uniform(0.008, 0.025), rng.uniform(0.3, 1.0), rng.uniform(0.02, 0.07))
        _add(gur, tb, _pan(y, rng.uniform(-0.9, 0.9)))
    out += gur[:n]
    return out


@_amb("room", -28.0, "quiet room tone with a slow wooden clock tick-tock (1 per second)")
def _amb_room(n, rng):
    dur = n / SR

    def tone(tc, f):
        return m_tilt(f, -5.0, 200) * m_band(f, 40, 1200, 12, 12) + 0.03 * m_band(f, 1200, 8000, 6, 12)

    out = _spec_noise(n, rng, tone, nfft=2048, nch=2, corr=0.4) * 0.006
    ticks = np.zeros((n + _n(1.0), 2))
    k = 0
    tk = 0.35
    while tk < dur:
        m = _n(0.07)
        tt = _time(m)
        modes = ((2650, 0.006, 1.0), (4100, 0.004, 0.45), (1750, 0.009, 0.6), (330, 0.012, 0.35)) if k % 2 == 0 else \
                ((2250, 0.006, 1.0), (3550, 0.004, 0.4), (1500, 0.009, 0.6), (300, 0.012, 0.35))
        y = sum(a * np.sin(TAU * f * tt) * np.exp(-tt / tau) for f, tau, a in modes) * _ramp(m, 0.0003)
        y += bp(rng.standard_normal(m) * np.exp(-tt / 0.0005), 1500, 7000) * 0.5
        _add(ticks, tk, _pan(y * _taper(m, 0.3) * (0.1 if k % 2 == 0 else 0.085), 0.35))
        k += 1
        tk += 1.0
    out += _reverb(ticks, "wood", 0.35)[:n]
    # the jungle, faintly, through the round window
    far = np.zeros((n + _n(1.0), 2))
    for tb in _events(rng, dur, 0.1):
        y = lp(_bird_call(BIRD_KINDS[int(rng.integers(0, 5))], rng), 2500) * 0.006
        _add(far, tb, _pan(y, -0.6))
    out += far[:n]
    return out


# =============================================================================
#  public API
# =============================================================================
NAMES = list(_SFX.keys())
AMBIENCES = list(_AMB.keys())

ALIASES = {
    "scratch": "record_scratch", "rumble": "rumble_small", "boom": "explosion", "eruption": "explosion",
    "flutter": "flaps", "crickets": "cricket", "bird": "birds", "gasp": "crowd_gasp", "ooh": "crowd_gasp",
    "laugh": "laugh_chuckle", "chuckle": "laugh_chuckle", "ping": "glass_ping", "thermometer_pop": "glass_pop",
    "steam": "lava_hiss", "scribble": "paper_scribble", "zipper": "zip", "dun_dun": "sting_bad",
    "tada": "sting_good", "ta_da": "sting_good", "knock": "hammer", "swoosh": "whoosh", "bubble": "bubbles",
}


def _resolve(name):
    key = str(name).strip().lower().replace("-", "_").replace(" ", "_")
    return ALIASES.get(key, key)


def describe(name):
    key = _resolve(name)
    if key in _SFX:
        return _SFX[key]["desc"]
    if key in _AMB:
        return _AMB[key]["desc"]
    raise KeyError(name)


def render_sfx(name: str, seed: int = 0) -> np.ndarray:
    """Render one effect at its natural length -> float32 (n, 2), 48 kHz, peak <= 0.9."""
    key = _resolve(name)
    if key not in _SFX:
        raise KeyError(f"unknown sfx {name!r}; known: {', '.join(NAMES)}")
    spec = _SFX[key]
    rng = _rng_for(key, seed)
    x = spec["fn"](rng)
    x = _master(x, spec["lufs"], ceiling=spec["ceiling"], max_limit_db=spec["limit_db"])
    return np.ascontiguousarray(x, dtype=np.float32)


def render_ambience(name: str, duration: float, seed: int = 0, loop: bool = False) -> np.ndarray:
    """Render an ambience bed of exactly round(duration*SR) samples -> float32 (n, 2).

    The bed starts and ends in steady state (no fade); pass loop=True to make the
    end flow seamlessly into the start (tail cross-faded into the head).
    """
    key = _resolve(name)
    if key not in _AMB:
        raise KeyError(f"unknown ambience {name!r}; known: {', '.join(AMBIENCES)}")
    spec = _AMB[key]
    n = max(1, int(round(float(duration) * SR)))
    rng = _rng_for("amb:" + key, seed)
    xf = min(_n(2.0), n // 3) if loop else 0
    pre = _n(0.5)                                   # settle filters / reverbs
    y = _to_stereo(spec["fn"](n + xf + pre, rng))[pre:pre + n + xf]
    if xf > 0:
        w = np.sin(np.linspace(0, np.pi / 2, xf))[:, None]
        head = y[:xf] * w + y[n:n + xf] * np.cos(np.linspace(0, np.pi / 2, xf))[:, None]
        y = y[:n].copy()
        y[:xf] = head
    y = y - y.mean(axis=0, keepdims=True)
    pad = min(_n(0.2), n)
    # pre-roll for the DC-blocker: the wrapped tail when looping (seamless), else a mirror
    head = y[-pad:] if loop else y[:pad][::-1]
    y = hp(np.concatenate([head, y]), 25.0)[pad:]
    L = loudness_integrated(y) if n >= _n(0.4) else loudness_max(y)
    y = y * _db(spec["lufs"] - L)
    pk = np.abs(y).max()
    if pk > 0.6:
        if pk > 0.6 * _db(6.0):
            y *= 0.6 * _db(6.0) / pk
        if loop:   # limit cyclically so the gain is continuous across the seam
            k = min(_n(0.1), n)
            y = _limit(np.concatenate([y[-k:], y, y[:k]]), 0.59, attack=0.002, release=0.02)[k:k + n]
        else:
            y = _limit(y, 0.59, attack=0.002, release=0.02)
        y = np.clip(y, -0.6, 0.6)
    return np.ascontiguousarray(y, dtype=np.float32)


# =============================================================================
#  CLI
# =============================================================================
def _main(argv):
    import argparse

    ap = argparse.ArgumentParser(description="CHILL CAPYBARA sfx / ambience renderer")
    ap.add_argument("name", nargs="?")
    ap.add_argument("out", nargs="?")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--duration", type=float, default=20.0, help="ambience length (s)")
    ap.add_argument("--loop", action="store_true", help="ambience: make it loop seamlessly")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args(argv)
    if a.list or not a.name:
        print("sfx:")
        for k in NAMES:
            print(f"  {k:<16} {_SFX[k]['desc']}")
        print("ambiences:")
        for k in AMBIENCES:
            print(f"  {k:<16} {_AMB[k]['desc']}")
        return 0
    import soundfile as sf
    key = _resolve(a.name)
    if key in _AMB:
        x = render_ambience(key, a.duration, a.seed, loop=a.loop)
    else:
        x = render_sfx(key, a.seed)
    out = a.out or f"{key}.wav"
    sf.write(out, x, SR, subtype="FLOAT")
    print(f"wrote {out}: {len(x) / SR:.2f}s peak {np.abs(x).max():.3f}")
    return 0


if __name__ == "__main__":
    sys.exit(_main(sys.argv[1:]))
