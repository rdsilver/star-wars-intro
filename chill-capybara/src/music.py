#!/usr/bin/env python3
"""music.py -- the synthesized score of CHILL CAPYBARA (DESIGN.md section 7).

Everything here is made from scratch with numpy/scipy: additive / FM / polyBLEP /
Karplus-Strong instruments, a small mixer with an FFT-convolution reverb, and
nine composed cues.

Public API
----------
    STYLES                                   list of style names
    render_music(style, duration, seed=0, hit_at=None, fade_out=None, tail=None)
          -> float32 (n, 2) @ 48 kHz, peak <= 0.9
    music_anchors(style, duration, seed=0, hit_at=None, tail=None) -> dict of musical anchors
          (bpm, bar length, downbeat times, melody entry and, for cues that compose their own
          ending, the time of the final hit and of the picture cut)

Endings
-------
* Looping cues (lounge, tension, therapy, montage, serene, action, sunset and long jazz_title
  beds) play at full level to the very end of the render and finish with a short de-click
  fade of `fade_out` seconds (default DEFAULT_FADE_OUT = 0.04 s).  build_audio.py does the
  musical crossfades and hard music-outs itself, so the module must not pre-fade.  Pass
  e.g. fade_out=1.5 for a musical fade when auditioning stand-alone.
* jazz_end always, and jazz_title when it is short (<= JAZZ_TITLE_TAG_MAX = 12 s) or when
  `hit_at` is given, compose an ending: tune -> stop-time tag -> "ba-DUM" button whose
  downbeat lands exactly at `hit_at` seconds.  The default hit is
  duration - tail - lead, where `tail` is the part of the render that lies past the picture
  (build_audio renders the last segment 1.5 s long and every other one by the next cue's
  crossfade, 0.8 s by default) and lead is how far before the cut the button lands:
      jazz_end   : tail 1.5, lead 0.50  (button on the end card's cut to black, 0.5 s before
                                         the film ends)
      jazz_title : tail 0.8, lead 0.25  (light button just before the cut to scene 3)
  The picture cut is duration - tail (anchor `picture_cut`).  jazz_end's button rings out
  *to the picture cut* (a natural, choked decay reaching -45 dB there) and the overhang past
  it is digital silence -- the film's last sample is 0.  jazz_title's button rings on through
  the crossfade overhang into the next cue.  A longer ring for jazz_end needs a longer tail
  in the script (s10_end) *and* ENDING_LEAD['jazz_end'] raised to match, so the button stays
  on the cut to black.  Pass tail=0 for a stand-alone render that ends `lead` s after the hit.
* Composed endings are loudness-calibrated at their real length (in-picture part), so a 5 s
  title card or 8 s end card meets TARGET_LUFS like a 60 s bed does.

Mix conventions
---------------
* Reverb sends are high-passed per style (WET_HP, 4th order, 160-300 Hz) and the IR's low band
  decays faster than its mids, so the room never muddies the bass; piano / upright-bass notes
  below G3 are centred and kept nearly dry (play(), LOW_CENTRED).
* Accompaniment voicings are melody-aware: voice(..., avoid=sounding(tune, t0, t1)) drops the
  chord tones a semitone under a sounding melody note and bans m2/m9 against it; sustained
  parts in tension are kept out of m2/m9 rubs with each other (rubs(), safe_pitch()).

CLI (auditioning)
-----------------
    python src/music.py <style> <seconds> out.wav [--seed N] [--hit-at S] [--tail S]
                                                  [--fade-out S] [--schedule]
    python src/music.py all <seconds> <out_dir>   # every style
    python src/music.py calibrate [seconds]       # re-measure the loudness calibration

Styles: jazz_title, lounge, tension, therapy, montage, serene, action, sunset, jazz_end.
Shared motifs: the "chill theme" (lounge vibes melody) is quoted by serene and
sunset; the title tune (jazz_title clarinet) is reprised by jazz_end.
Loudness is calibrated per style on BS.1770 integrated loudness (TARGET_LUFS).
"""
import math
import os
import sys
import time
import zlib

import numpy as np
from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d
from scipy.signal import butter, lfilter, oaconvolve, sosfilt

SR = 48000
F32 = np.float32
TWO_PI = 2.0 * np.pi

STYLES = ["jazz_title", "lounge", "tension", "therapy", "montage",
          "serene", "action", "sunset", "jazz_end"]

# target integrated loudness (BS.1770 LUFS, 60 s render) per style.  Calm cues sit under
# dialogue; therapy is the most dialogue-dense scene; montage carries the punchline
# dialogue; action is the loudest (~2 LU over the jazz).
TARGET_LUFS = {"jazz_title": -14.0, "jazz_end": -14.0, "montage": -16.9, "action": -12.5,
               "lounge": -17.6, "therapy": -18.2, "serene": -17.8, "sunset": -17.6,
               "tension": -17.6}
DEFAULT_FADE_OUT = 0.04       # s, de-click only (build_audio does the musical fades)
JAZZ_TITLE_TAG_MAX = 12.0     # s, jazz_title renders up to this long compose a tag ending
ENDING_TAIL = {"jazz_end": 1.5, "jazz_title": 0.8}   # default render overhang past the picture
ENDING_LEAD = {"jazz_end": 0.5, "jazz_title": 0.25}  # button lands this long before the cut


# =============================================================================
# basic helpers
# =============================================================================
def mtof(m):
    return 440.0 * 2.0 ** ((np.asarray(m, dtype=np.float64) - 69.0) / 12.0)


_LETTER = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]


def N(name):
    """'C#4' -> 61, 'Bb3' -> 58 (C4 = 60)."""
    name = name.strip()
    pc = _LETTER[name[0].upper()]
    i = 1
    while i < len(name) and name[i] in "#b":
        pc += 1 if name[i] == "#" else -1
        i += 1
    octave = int(name[i:])
    return 12 * (octave + 1) + pc


def nname(m):
    m = int(round(m))
    return f"{_NAMES[m % 12]}{m // 12 - 1}"


def _seed_of(*keys):
    return zlib.crc32("|".join(str(k) for k in keys).encode()) & 0xFFFFFFFF


def rng_for(*keys):
    return np.random.default_rng(_seed_of(*keys))


def smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


def db2lin(d):
    return 10.0 ** (d / 20.0)


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(np.square(x, dtype=np.float64))) + 1e-12)


# =============================================================================
# filters
# =============================================================================
def biquad(kind, f0, q=0.7071, gain_db=0.0):
    """RBJ cookbook biquad -> (b, a)."""
    f0 = float(min(max(f0, 5.0), SR * 0.49))
    w0 = TWO_PI * f0 / SR
    cw, sw = math.cos(w0), math.sin(w0)
    alpha = sw / (2.0 * q)
    A = 10.0 ** (gain_db / 40.0)
    if kind == "lp":
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "hp":
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "bp":  # 0 dB peak gain
        b = [alpha, 0.0, -alpha]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "peak":
        b = [1 + alpha * A, -2 * cw, 1 - alpha * A]
        a = [1 + alpha / A, -2 * cw, 1 - alpha / A]
    elif kind in ("ls", "hs"):
        sq = 2 * math.sqrt(A) * alpha
        if kind == "ls":
            b = [A * ((A + 1) - (A - 1) * cw + sq), 2 * A * ((A - 1) - (A + 1) * cw),
                 A * ((A + 1) - (A - 1) * cw - sq)]
            a = [(A + 1) + (A - 1) * cw + sq, -2 * ((A - 1) + (A + 1) * cw),
                 (A + 1) + (A - 1) * cw - sq]
        else:
            b = [A * ((A + 1) + (A - 1) * cw + sq), -2 * A * ((A - 1) + (A + 1) * cw),
                 A * ((A + 1) + (A - 1) * cw - sq)]
            a = [(A + 1) - (A - 1) * cw + sq, 2 * ((A - 1) - (A + 1) * cw),
                 (A + 1) - (A - 1) * cw - sq]
    else:
        raise ValueError(kind)
    b = np.array(b) / a[0]
    a = np.array(a) / a[0]
    return b, a


def filt(x, *specs):
    """Apply a chain of biquads: specs are tuples (kind, f0[, q[, gain_db]])."""
    y = x
    for s in specs:
        b, a = biquad(*s)
        y = lfilter(b, a, y, axis=0)
    return y.astype(F32)


def onepole_lp(x, fc):
    p = math.exp(-TWO_PI * fc / SR)
    return lfilter([1 - p], [1, -p], x).astype(F32)


def upsample_lin(ctrl, hop, n):
    """Linear interpolation of a control-rate signal (one value per hop) to n samples."""
    ctrl = np.asarray(ctrl, dtype=F32)
    nxt = np.append(ctrl[1:], ctrl[-1])
    ramp = (np.arange(hop, dtype=F32) / hop)[None, :]
    y = (ctrl[:, None] + (nxt - ctrl)[:, None] * ramp).ravel()
    if len(y) < n:
        y = np.pad(y, (0, n - len(y)), mode="edge")
    return y[:n]


# =============================================================================
# oscillators
# =============================================================================
def phase_cycles(freq):
    """Integrate a per-sample frequency (Hz) into phase in cycles (float64, wrapped)."""
    ph = np.cumsum(np.asarray(freq, dtype=np.float64) / SR)
    ph -= ph[0]
    return ph % 1.0


def harmonic_sum(ph, amps, hop_amps=None, n=None):
    """sum_k amps[k-1] * sin(2 pi k ph).  amps entries: scalar or control-rate arrays
    (then hop_amps gives the hop size)."""
    n = len(ph) if n is None else n
    th = (ph.astype(F32) * F32(TWO_PI))
    out = np.zeros(n, dtype=F32)
    for k, a in enumerate(amps, 1):
        if np.isscalar(a):
            if a == 0:
                continue
            out += F32(a) * np.sin(th * F32(k))
        else:
            out += upsample_lin(a, hop_amps, n) * np.sin(th * F32(k))
    return out


def partial_bank(freqs, amps, t60s, n, phases=None, t0=0.0, floor_db=None):
    """Sum of exponentially decaying sinusoids (inharmonic allowed).

    floor_db: if given, each partial is only computed until it has decayed `floor_db` dB
    below the loudest partial's initial amplitude (an inaudible -90 dB step), which makes
    long, slowly decaying notes (piano aftersound) cheap: the upper partials die early."""
    t = np.arange(n, dtype=np.float64) / SR + t0
    t32 = t.astype(F32)
    out = np.zeros(n, dtype=F32)
    amax = max((abs(a) for a in amps), default=0.0) if floor_db else 0.0
    for i, (f, a, T) in enumerate(zip(freqs, amps, t60s)):
        if f >= SR * 0.47 or a == 0:
            continue
        m = n
        if floor_db:
            life = T * (floor_db + 20.0 * math.log10(abs(a) / amax)) / 60.0
            if life <= 0:
                continue
            m = min(n, int(life * SR) + 1)
        x = f * t[:m]
        if phases is not None:
            x = x + phases[i]
        x -= np.floor(x)
        s = np.sin(x.astype(F32) * F32(TWO_PI))
        out[:m] += F32(a) * s * np.exp(t32[:m] * F32(-6.9078 / T))
    return out


def saw_blep(freq, phase0=0.0):
    """Band-limited sawtooth (polyBLEP) for a per-sample frequency array."""
    freq = np.asarray(freq, dtype=np.float64)
    dt = freq / SR
    ph = (np.cumsum(dt) - dt[0] + phase0) % 1.0
    y = 2.0 * ph - 1.0
    m = ph < dt
    x = ph[m] / dt[m]
    y[m] -= x + x - x * x - 1.0
    m = ph > 1.0 - dt
    x = (ph[m] - 1.0) / dt[m]
    y[m] -= x * x + x + x + 1.0
    return y.astype(F32)


def noise(rng, n):
    return rng.uniform(-1.0, 1.0, n).astype(F32)


def exp_env(n, t60, t0=0.0):
    t = (np.arange(n, dtype=F32) / SR) + F32(t0)
    return np.exp(t * F32(-6.9078 / t60))


def ramp_in(x, ms=1.5):
    k = min(len(x), max(1, int(ms * 1e-3 * SR)))
    w = (0.5 - 0.5 * np.cos(np.linspace(0, np.pi, k))).astype(F32)
    x[:k] *= w if x.ndim == 1 else w[:, None]
    return x


def ramp_out(x, ms=5.0):
    k = min(len(x), max(1, int(ms * 1e-3 * SR)))
    w = (0.5 + 0.5 * np.cos(np.linspace(0, np.pi, k))).astype(F32)
    x[-k:] *= w if x.ndim == 1 else w[:, None]
    return x


def release_tail(x, start_s, rel_s):
    """Copy of x cut to start_s + ~5*rel and exponentially damped from start_s on."""
    i0 = max(0, int(start_s * SR))
    L = min(len(x), i0 + int(rel_s * 5.0 * SR))
    y = x[:L].copy()
    if L > i0:
        m = L - i0
        tt = np.arange(m, dtype=F32) / SR
        e = np.exp(-tt / F32(rel_s))
        e *= (0.5 + 0.5 * np.cos(np.linspace(0, np.pi, m))).astype(F32) ** 0.5
        y[i0:] *= e if y.ndim == 1 else e[:, None]
    elif len(y) > 16:
        ramp_out(y, 4.0)
    return y


# =============================================================================
# instrument cache
# =============================================================================
_CACHE = {}
_CACHE_BYTES = [0]


def cached(key, fn):
    v = _CACHE.get(key)
    if v is None:
        v = fn()
        v.setflags(write=False)
        _CACHE[key] = v
        _CACHE_BYTES[0] += v.nbytes
        if _CACHE_BYTES[0] > 7e8:  # keep memory bounded
            _CACHE.clear()
            _CACHE_BYTES[0] = 0
    return v


def _vlayer(vel, steps=4):
    """Quantise velocity to a sampler-style layer; return (layer, residual gain)."""
    vel = float(np.clip(vel, 0.05, 1.0))
    layer = max(1, round(vel * steps)) / steps
    return layer, vel / layer


# =============================================================================
# Karplus-Strong plucked string (block-vectorised, Lagrange-tuned)
# =============================================================================
def _lagrange3(d):
    h = np.ones(4)
    for k in range(4):
        for m in range(4):
            if m != k:
                h[k] *= (d - m) / (k - m)
    return h


def ks_string(freq, length, t60=2.0, damp=0.18, pick=0.2, exc_fc=3000.0, seed=0,
              exc_gain=1.0, exc_len=1.0):
    """Plucked string.  damp in [0, 0.25] (0 = bright/no loss filter)."""
    n = int(length * SR)
    P = SR / freq
    Nd = int(math.floor(P)) - 2
    d = P - Nd - 1.0
    while d < 1.0:
        Nd -= 1
        d += 1.0
    taps = np.convolve([damp, 1 - 2 * damp, damp], _lagrange3(d))
    # per-period loss for the target T60 at the fundamental
    w = TWO_PI / P
    loss_fir = abs(1 - 2 * damp + 2 * damp * math.cos(w))
    g = (10.0 ** (-3.0 / (freq * t60))) / max(loss_fir, 1e-3)
    g = min(g, 0.99995)
    taps = taps * g
    rng = rng_for("ks", seed)
    Lx = max(4, int(round(P * exc_len)))
    # periodic (circularly filtered) excitation -> no seam when the loop takes over
    X = np.fft.rfft(rng.uniform(-1, 1, Lx))
    fr = np.fft.rfftfreq(Lx, 1.0 / SR)
    X *= 1.0 / (1.0 + (fr / (exc_fc * 1.3)) ** 4)
    X[0] = 0.0
    exc = np.fft.irfft(X, Lx)
    sh = max(1, int(round(pick * P)))
    exc = exc - np.roll(exc, sh)  # pluck-position comb
    exc *= exc_gain / (np.abs(exc).max() + 1e-9)
    # the excitation *is* the first period (string displacement); the periodic pre-roll gives
    # the loop a seamless history so the first recirculation does not double up.
    off = Lx + Nd + 8
    y = np.zeros(n + off)
    y[off - Lx:off] = exc
    y[off:off + min(Lx, n)] = exc[:min(Lx, n)]
    ntap = len(taps)
    s = off + min(Lx, n)
    end = n + off
    blk = Nd
    check = 0
    while s < end:
        e = min(s + blk, end)
        acc = y[s:e].copy()
        for j in range(ntap):
            acc += taps[j] * y[s - Nd - j:e - Nd - j]
        y[s:e] = acc
        s = e
        check += 1
        if check % 64 == 0 and s > off + 6 * Lx:
            if np.abs(acc).max() < 1e-5:
                break
    return y[off:].astype(F32)


# =============================================================================
# melodic instruments (each returns mono float32, cached where it pays)
# =============================================================================
def piano_note(midi, vel, length, tone=0.6, variant=0):
    """Additive piano: inharmonic partials, two-stage (prompt + aftersound) decay, detuned
    unisons, hammer.  Sustain is voiced like a real grand: the aftersound carries ~half of
    each partial's amplitude; fundamental T60 ~11 s at C4, ~5 s at A5 (prompt decay 0.3x)."""
    layer, res = _vlayer(vel)
    Lq = math.ceil(length * 2) / 2.0

    def make():
        rng = rng_for("piano", midi, layer, tone, variant)
        n = int(Lq * SR)
        f0 = float(mtof(midi))
        B = 4e-4 * 2 ** ((midi - 60) / 14.0)
        bright = 0.25 + 0.75 * layer * (0.5 + tone)
        fc = 500 + 5200 * bright ** 2
        T = min(26.0, 25.0 * 2 ** (-(midi - 36) / 24.0))
        freqs, amps, t60s = [], [], []
        k = 1
        while True:
            fk = k * f0 * math.sqrt(1 + B * k * k)
            if fk > 15000 or k > 42:
                break
            a = (1.0 / k) / (1 + (fk / fc) ** 2) * (0.25 + 0.75 * abs(math.sin(math.pi * k / 7.3)))
            Tk = T / (1 + fk / 3000.0)
            if k <= 7:  # three-string unison -> two slightly detuned components
                det = 2 ** ((0.4 + 0.5 * rng.random()) / 1200.0)
                for ff, aa in ((fk, 0.55 * a), (fk * det, 0.45 * a)):
                    freqs += [ff, ff]
                    amps += [aa * 0.52, aa * 0.48]
                    t60s += [Tk * 0.3, Tk]
            else:
                freqs += [fk, fk]
                amps += [a * 0.6, a * 0.4]
                t60s += [Tk * 0.3, Tk * 0.8]
            k += 1
        ph = np.repeat(rng.random(len(freqs) // 2 + 1), 2)[:len(freqs)] * 0.05  # pairs share phase
        y = partial_bank(freqs, amps, t60s, n, phases=ph, floor_db=90.0)
        # hammer knock + soundboard thump
        nk = int(0.012 * SR)
        knock = noise(rng, nk) * exp_env(nk, 0.012)
        knock = onepole_lp(knock, 900 + 2500 * layer)
        y[:nk] += knock * (0.10 * layer)
        y = ramp_out(ramp_in(y, 1.0), 40)
        return y / 1.3

    return cached(("piano", midi, layer, tone, Lq, variant), make), res


def rhodes_note(midi, vel, length):
    layer, res = _vlayer(vel)
    Lq = math.ceil(length * 2) / 2.0

    def make():
        n = int(Lq * SR)
        f = float(mtof(midi))
        t = np.arange(n, dtype=np.float64) / SR
        t32 = t.astype(F32)
        ph = ((f * t) % 1.0).astype(F32) * F32(TWO_PI)
        idx = (0.25 + 1.5 * layer ** 1.6) * np.exp(-t32 / F32(0.22)) + F32(0.18 + 0.35 * layer)
        car = np.sin(ph + idx * np.sin(ph))
        T = 4.5 * 2 ** (-(midi - 60) / 18.0)
        env = 0.55 * np.exp(t32 * F32(-6.9 / (T * 0.3))) + 0.45 * np.exp(t32 * F32(-6.9 / T))
        y = car * env
        if 15 * f < 19000:
            ph14 = ((14 * f * t) % 1.0).astype(F32) * F32(TWO_PI)
            i2 = (0.4 + 1.4 * layer) * np.exp(-t32 / F32(0.025))
            tine = np.sin(ph + i2 * np.sin(ph14)) - np.sin(ph)
            y += F32(0.5) * tine * np.exp(-t32 / F32(0.18))
        # pickup asymmetry -> a little even-harmonic "bark"
        y = y + F32(0.12 + 0.2 * layer) * y * y
        y = filt(y, ("hp", 40), ("lp", 7000))
        return ramp_out(ramp_in(y.astype(F32), 1.5), 40) * F32(0.6)

    return cached(("rhodes", midi, layer, Lq), make), res


def vibes_note(midi, vel, length):
    layer, res = _vlayer(vel)
    Lq = math.ceil(length * 2) / 2.0

    def make():
        n = int(Lq * SR)
        f = float(mtof(midi))
        T = min(7.0, 5.0 * 2 ** (-(midi - 65) / 18.0))
        y = partial_bank([f, f * 3.984, f * 9.92], [1.0, 0.10 + 0.22 * layer, 0.03 * layer],
                         [T, 0.9, 0.25], n)
        rng = rng_for("vib", midi, layer)
        nk = int(0.006 * SR)
        y[:nk] += onepole_lp(noise(rng, nk), 1600) * exp_env(nk, 0.006) * F32(0.05 * layer)
        return ramp_out(ramp_in(y, 2.0 - layer), 40) * F32(0.55)

    return cached(("vibes", midi, layer, Lq), make), res


def glock_note(midi, vel):
    layer, res = _vlayer(vel, 3)

    def make():
        n = int(2.0 * SR)
        f = float(mtof(midi))
        y = partial_bank([f, f * 2.76, f * 5.40, f * 8.93], [1, 0.35, 0.12, 0.05],
                         [2.2, 0.8, 0.35, 0.15], n)
        return ramp_out(ramp_in(y, 0.6), 40) * F32(0.4)

    return cached(("glock", midi, layer), make), res


def harp_note(midi, vel, variant=0):
    layer, res = _vlayer(vel, 3)

    def make():
        rng = rng_for("harp", midi, variant)
        f = float(mtof(midi))
        T = min(9.0, 7.0 * 2 ** (-(midi - 48) / 16.0))
        n = int(min(T, 6.0) * SR)
        beta = 0.11 + 0.04 * rng.random()
        ks = np.arange(1, 15)
        fk = f * ks * (1 + 0.00005 * ks ** 2)
        a = np.abs(np.sin(np.pi * ks * beta)) / ks ** 1.5 * (0.6 + 0.4 * layer) ** (ks / 4)
        a[0] = max(a[0], 0.6)
        Tk = T / (1 + 0.35 * (ks - 1))
        y = partial_bank(fk, a, Tk, n, phases=rng.random(len(ks)) * 0.1)
        nk = int(0.004 * SR)
        y[:nk] += onepole_lp(noise(rng, nk), 3000) * F32(0.05)
        return ramp_out(ramp_in(y, 1.0), 60) * F32(0.5)

    return cached(("harp", midi, layer, variant), make), res


def nylon_note(midi, vel, variant=0):
    layer, res = _vlayer(vel, 3)

    def make():
        f = float(mtof(midi))
        T = min(4.5, 3.6 * 2 ** (-(midi - 52) / 22.0))
        y = ks_string(f, min(T, 4.0), t60=T, damp=0.20, pick=0.17 + 0.03 * variant,
                      exc_fc=1800 + 1600 * layer, seed=("nyl", midi, layer, variant))
        y = filt(y, ("hp", 70), ("peak", 105, 1.2, 4.0), ("peak", 230, 1.4, 3.0),
                 ("peak", 3200, 0.9, -3.0), ("hs", 5500, 0.7, -6.0))
        return ramp_out(ramp_in(y, 0.8), 40) * F32(0.45)

    return cached(("nylon", midi, layer, variant), make), res


def banjo_note(midi, vel, variant=0):
    layer, res = _vlayer(vel, 3)

    def make():
        f = float(mtof(midi))
        y = ks_string(f, 1.6, t60=1.2, damp=0.07, pick=0.09, exc_fc=6000 + 2000 * layer,
                      seed=("banjo", midi, layer, variant))
        n = len(y)
        e = 0.55 * exp_env(n, 0.25) + 0.45
        y = y * e
        y = filt(y, ("hp", 160), ("peak", 1250, 2.0, 7.0), ("peak", 420, 1.5, 2.0),
                 ("peak", 3500, 1.0, 2.0), ("hs", 7500, 0.7, -5.0))
        return ramp_out(ramp_in(y, 0.4), 40) * F32(0.32)

    return cached(("banjo", midi, layer, variant), make), res


def uke_note(midi, vel, variant=0):
    layer, res = _vlayer(vel, 3)

    def make():
        f = float(mtof(midi))
        y = ks_string(f, 1.6, t60=1.3, damp=0.17, pick=0.2, exc_fc=2600 + 2200 * layer,
                      seed=("uke", midi, layer, variant))
        y = filt(y, ("hp", 180), ("peak", 460, 1.3, 4.0), ("peak", 2100, 1.2, 2.0),
                 ("hs", 6000, 0.7, -5.0))
        return ramp_out(ramp_in(y, 0.5), 40) * F32(0.45)

    return cached(("uke", midi, layer, variant), make), res


def pizz_note(midi, vel, variant=0):
    """Orchestral pizzicato (violin..cello depending on register)."""
    layer, res = _vlayer(vel, 3)

    def make():
        f = float(mtof(midi))
        T = 0.9 if midi < 55 else 0.6
        y = ks_string(f, T * 1.2, t60=T, damp=0.22, pick=0.3, exc_fc=1400 + 900 * layer,
                      seed=("pizz", midi, layer, variant))
        if midi < 55:
            y = filt(y, ("hp", 50), ("peak", 230, 1.0, 4.0), ("peak", 1200, 1.2, 2.0),
                     ("hs", 4000, 0.7, -6.0))
        else:
            y = filt(y, ("hp", 150), ("peak", 450, 1.2, 3.0), ("peak", 2900, 1.4, 4.0), ("lp", 9000, 0.6),
                     ("hs", 6000, 0.7, -6.0))
        return ramp_out(ramp_in(y, 0.7), 40) * F32(0.6)

    return cached(("pizz", midi, layer, variant), make), res


def upright_note(midi, vel, variant=0):
    """Upright bass pizz: warm additive partials with finger thump (full ring; cut later)."""
    layer, res = _vlayer(vel, 3)

    def make():
        rng = rng_for("ubass", midi, layer, variant)
        f = float(mtof(midi))
        n = int(2.6 * SR)
        ks = np.arange(1, 25)
        fk = f * ks * (1 + 0.00012 * ks ** 2)
        beta = 0.21 + 0.03 * variant
        a = (np.abs(np.sin(np.pi * ks * beta)) + 0.15) / ks ** (1.25 - 0.25 * layer)
        a[0] *= 1.4
        a = a / (1 + (fk / (900 + 900 * layer)) ** 2)
        Tk = 2.4 / (1 + 0.45 * (ks - 1))
        y = partial_bank(fk, a, Tk, n, phases=rng.random(len(ks)) * 0.02)
        # quick initial drop (finger) + sustained body
        t32 = np.arange(n, dtype=F32) / SR
        y *= F32(0.65) + F32(0.35) * np.exp(-t32 / F32(0.09))
        nk = int(0.03 * SR)
        thump = onepole_lp(noise(rng, nk), 500) * exp_env(nk, 0.03)
        y[:nk] += thump * F32(0.25 * layer)
        y = filt(y, ("hp", 32), ("peak", 95, 1.0, 2.0), ("lp", 4000))
        return ramp_out(ramp_in(y, 2.5), 40) * F32(0.55)

    return cached(("ubass", midi, layer, variant), make), res


def sub_note(midi, length, vel=1.0):
    """Soft sine/triangle-ish synth bass for pads."""
    def make():
        n = int(length * SR)
        f = float(mtof(midi))
        y = partial_bank([f, 2 * f, 3 * f], [1.0, 0.18, 0.05], [30, 20, 10], n)
        return ramp_out(ramp_in(y, 5), 40) * F32(0.5)
    return cached(("sub", midi, round(length, 2)), make), vel


# -------------------------------------------------------------- legato voices
def _pitch_curve(notes, t0, n, glide=0.045, scoop=None, vib=None, rng=None):
    """Build per-sample midi pitch for a phrase. notes: list of dict(t, d, m, ...)."""
    hop = 32
    nc = n // hop + 2
    tc = t0 + np.arange(nc) * hop / SR
    m = np.full(nc, float(notes[0]["m"]))
    for i, nt in enumerate(notes):
        if i == 0:
            continue
        prev = notes[i - 1]
        gl = nt.get("glide", glide)
        tb = nt["t"]
        if nt.get("gliss"):  # long glissando that *arrives* at the note start
            x = np.clip((tc - (tb - gl)) / gl, 0, 1) ** 1.6
            m = np.where(tc >= tb - gl, m + (nt["m"] - prev["m"]) * x, m)
            continue
        x = smoothstep((tc - (tb - gl * 0.5)) / max(gl, 1e-3))
        m = np.where(tc >= tb - gl * 0.5, m + (nt["m"] - prev["m"]) * x, m)
    # scoops and falls
    for nt in notes:
        sc = nt.get("scoop", 0.0)
        if sc:
            dur = nt.get("scoop_t", 0.07)
            x = (tc - nt["t"]) / dur
            mask = (x >= 0) & (x < 1)
            m[mask] -= sc * (1 - smoothstep(x[mask]))
        fl = nt.get("fall", 0.0)
        if fl:
            tf = nt["t"] + nt["d"] - nt.get("fall_t", 0.25)
            x = (tc - tf) / nt.get("fall_t", 0.25)
            mask = x >= 0
            m[mask] -= fl * np.clip(x[mask], 0, 1.4) ** 2
    # vibrato (cents) fading in on long notes
    if vib is not None:
        depth = np.zeros(nc)
        for nt in notes:
            vd = nt.get("vib", vib["depth"])
            if nt["d"] < vib.get("min_len", 0.3) or vd <= 0:
                continue
            on = nt["t"] + vib.get("delay", 0.18)
            x = smoothstep((tc - on) / vib.get("rise", 0.35))
            x *= (tc < nt["t"] + nt["d"]).astype(float)
            depth = np.maximum(depth, vd * x)
        rate = vib["rate"] * (1 + 0.04 * np.sin(TWO_PI * 0.37 * (tc - t0) + (rng.random() * 6 if rng is not None else 0)))
        vph = np.cumsum(rate * hop / SR) * TWO_PI
        m = m + depth / 100.0 * np.sin(vph)
    # slow drift
    if rng is not None:
        dr = np.cumsum(rng.normal(0, 1, nc))
        dr = uniform_filter1d(dr, 300) if nc > 300 else dr * 0
        dr = dr - dr.mean()
        dr = dr / (np.abs(dr).max() + 1e-9)
        m = m + 0.03 * dr
    return upsample_lin(m.astype(F32), hop, n).astype(np.float64)


def _amp_curve(notes, t0, n, attack=0.03, release=0.09, tongue_dip=0.6, hop=32):
    nc = n // hop + 2
    tc = t0 + np.arange(nc) * hop / SR
    a = np.zeros(nc)
    for i, nt in enumerate(notes):
        legato_in = i > 0 and nt.get("slur", False)
        att = nt.get("attack", attack)
        s, e = nt["t"], nt["t"] + nt["d"]
        rel = nt.get("release", release)
        v = nt.get("v", 0.8)
        # note body with a gentle swell/decay shape
        x = (tc - s)
        body = np.where(x >= 0, 1.0, 0.0)
        if not legato_in:
            body = body * smoothstep(x / att)
        sw = nt.get("swell", 0.0)
        if sw:
            body = body * (1 + sw * np.sin(np.pi * np.clip(x / max(nt["d"], 1e-3), 0, 1)))
        tp = nt.get("taper", 0.0)
        if tp:  # phrase-final note dies away instead of stopping flat
            body = body * (1 - tp * np.clip(x / max(nt["d"], 1e-3), 0, 1) ** 1.5)
        tail = np.where(tc > e, np.exp(-(tc - e) / rel), 1.0)
        a = np.maximum(a, v * body * tail * (tc >= s - 1e-9))
        if i > 0 and not legato_in:
            # articulation dip at tongued note boundaries (smooth, centred on the onset)
            d = np.exp(-((tc - s + 0.006) / 0.016) ** 2)
            a = a * (1 - (1 - tongue_dip) * d)
    # de-zipper: ~8 ms smoothing so velocity changes between slurred notes never step
    a = uniform_filter1d(a, size=max(3, int(0.008 * SR / hop)), mode="nearest")
    return a.astype(F32)


_CLAR_SOFT = [1.0, 0.035, 0.32, 0.03, 0.14, 0.022, 0.06, 0.016, 0.03, 0.01, 0.014, 0.006, 0.006]
_CLAR_LOUD = [1.0, 0.08, 0.62, 0.07, 0.42, 0.06, 0.26, 0.05, 0.16, 0.05, 0.11, 0.04, 0.07,
              0.03, 0.045, 0.02, 0.03, 0.012, 0.018, 0.008]


def clarinet_phrase(notes, rng, vib_depth=22.0, vib_rate=5.4, bright=0.7, breath=0.035):
    """Render one legato/tongued clarinet phrase. notes: list of dicts with absolute
    times t (s), duration d (s), midi m, velocity v, optional slur/scoop/fall/vib.
    Returns (start_time, mono)."""
    t0 = notes[0]["t"] - 0.03
    t1 = notes[-1]["t"] + notes[-1]["d"] + 0.6
    n = int((t1 - t0) * SR)
    mcur = _pitch_curve(notes, t0, n, glide=0.04,
                        vib=dict(depth=vib_depth, rate=vib_rate, delay=0.16, rise=0.3), rng=rng)
    f = 440.0 * 2 ** ((mcur - 69) / 12.0)
    ph = phase_cycles(f)
    hop = 32
    amp = _amp_curve(notes, t0, n, attack=0.035, release=0.085, tongue_dip=0.55, hop=hop)
    nc = len(amp)
    fc_ctrl = f[::hop][:nc]
    if len(fc_ctrl) < nc:
        fc_ctrl = np.pad(fc_ctrl, (0, nc - len(fc_ctrl)), mode="edge")
    dyn = np.clip(amp * bright, 0, 1)
    K = int(min(20, 15000 / f.max()))
    amps = []
    for k in range(1, K + 1):
        s0 = _CLAR_SOFT[k - 1] if k <= len(_CLAR_SOFT) else 0.0
        s1 = _CLAR_LOUD[k - 1] if k <= len(_CLAR_LOUD) else 0.0
        if k % 2 == 0:  # even partials appear in the upper register
            reg = np.clip((fc_ctrl - 400) / 600.0, 0, 1)
            s0 = s0 * (1 + 3 * reg)
            s1 = s1 * (1 + 2.5 * reg)
        a = (s0 + (s1 - s0) * dyn) * amp
        a = a / (1 + (k * fc_ctrl / 5500.0) ** 4)
        a = np.where(k * fc_ctrl > 19000, 0, a)
        amps.append(a.astype(F32))
    y = harmonic_sum(ph, amps, hop_amps=hop, n=n)
    # breath noise
    br = noise(rng, n)
    br = filt(br, ("bp", 2400, 0.8), ("lp", 6000))
    ampu = upsample_lin(amp, hop, n)
    y += br * F32(breath) * (ampu ** 1.5 + 0.6 * np.maximum(0, np.gradient(ampu) * 400).clip(0, 1))
    y = filt(y, ("hp", 120), ("peak", 1500, 1.0, 1.5), ("hs", 7000, 0.7, -4.0))
    return t0, ramp_out(ramp_in(y, 2), 20) * F32(0.5)


_BASSOON_FORMANTS = [(480, 160, 0.0), (1150, 260, -7.0), (2500, 500, -20.0)]


def bassoon_phrase(notes, rng, vib_depth=6.0, breath=0.03):
    """Bassoon: reed source shaped by fixed body formants (~480 Hz / 1.15 kHz)."""
    t0 = notes[0]["t"] - 0.03
    t1 = notes[-1]["t"] + notes[-1]["d"] + 0.5
    n = int((t1 - t0) * SR)
    mcur = _pitch_curve(notes, t0, n, glide=0.03,
                        vib=dict(depth=vib_depth, rate=5.0, delay=0.2, rise=0.3, min_len=0.4), rng=rng)
    f = 440.0 * 2 ** ((mcur - 69) / 12.0)
    ph = phase_cycles(f)
    hop = 32
    amp = _amp_curve(notes, t0, n, attack=0.025, release=0.06, tongue_dip=0.4, hop=hop)
    nc = len(amp)
    fcc = f[::hop][:nc]
    if len(fcc) < nc:
        fcc = np.pad(fcc, (0, nc - len(fcc)), mode="edge")
    K = int(min(30, 9000 / f.max()))
    amps = []
    for k in range(1, K + 1):
        fk = k * fcc
        e = np.full(nc, 0.02)
        for (F, bw, adb) in _BASSOON_FORMANTS:
            e = e + db2lin(adb) / (1 + ((fk - F) / bw) ** 2)
        e = e / k ** 0.35 * (1 + 0.6 * amp)  # brighter when louder
        e = np.where(fk > 12000, 0, e)
        amps.append((e * amp).astype(F32))
    y = harmonic_sum(ph, amps, hop_amps=hop, n=n)
    ampu = upsample_lin(amp, hop, n)
    y += filt(noise(rng, n), ("bp", 1200, 1.0)) * ampu * F32(breath)
    y = filt(y, ("hp", 50), ("hs", 4000, 0.7, -6.0))
    return t0, ramp_out(ramp_in(y, 2), 20) * F32(0.35)


def whistle_phrase(notes, rng, vib_depth=28.0):
    t0 = notes[0]["t"] - 0.04
    t1 = notes[-1]["t"] + notes[-1]["d"] + 0.4
    n = int((t1 - t0) * SR)
    for nt in notes:  # whistlers slide into most notes
        nt.setdefault("scoop", 0.5)
        nt.setdefault("scoop_t", 0.05)
    mcur = _pitch_curve(notes, t0, n, glide=0.05,
                        vib=dict(depth=vib_depth, rate=5.8, delay=0.12, rise=0.2, min_len=0.25), rng=rng)
    f = 440.0 * 2 ** ((mcur - 69) / 12.0)
    ph = phase_cycles(f)
    hop = 32
    amp = _amp_curve(notes, t0, n, attack=0.025, release=0.06, tongue_dip=0.25, hop=hop)
    y = harmonic_sum(ph, [amp, amp * F32(0.05), amp * F32(0.012)], hop_amps=hop, n=n)
    ampu = upsample_lin(amp, hop, n)
    # breathy noise centred on the pitch: narrow-band noise * carrier
    nb = sosfilt(butter(4, 90, "lp", fs=SR, output="sos"), noise(rng, n)).astype(F32)
    nb /= (np.sqrt(np.mean(nb ** 2)) * 3 + 1e-9)
    y += nb * np.sin((ph.astype(F32) * F32(TWO_PI))) * ampu * F32(0.2)
    hiss = filt(noise(rng, n), ("hp", 4000), ("lp", 9000))
    y += hiss * ampu ** 2 * F32(0.012)
    return t0, ramp_out(ramp_in(y, 3), 20) * F32(0.4)


_FORMANTS = {  # (freq, bandwidth, amp dB) -- soprano-ish 'a' and 'o'
    "a": [(800, 80, 0), (1150, 90, -6), (2900, 120, -32), (3900, 130, -20), (4950, 140, -50)],
    "o": [(450, 70, 0), (800, 80, -11), (2830, 100, -22), (3800, 130, -22), (4950, 135, -50)],
    "u": [(325, 50, 0), (700, 60, -16), (2700, 170, -35), (3800, 180, -40), (4950, 200, -60)],
}


def _formant_env(freqs, vowel):
    e = np.zeros_like(freqs) + 0.004
    for F, bw, adb in _FORMANTS[vowel]:
        e += db2lin(adb) / (1 + ((freqs - F) / (bw * 0.9)) ** 2)
    return e


def choir_note(midi, length, vel=0.7, vowel="a", voices=3, attack=1.2, release=1.6, seed=0):
    """Formant-shaped 'aah' choir section on one pitch."""
    key = ("choir", midi, round(length, 2), round(vel, 2), vowel, voices, attack, release, seed)

    def make():
        rng = rng_for(*key)
        n = int((length + release * 1.5) * SR)
        f0 = float(mtof(midi))
        out = np.zeros(n, F32)
        t = np.arange(n) / SR
        for v in range(voices):
            det = (v - (voices - 1) / 2) * 7.0 + rng.normal(0, 2)
            vr = 4.8 + rng.random() * 0.9
            vph = rng.random() * TWO_PI
            vib = (13 + 5 * rng.random()) * np.sin(TWO_PI * vr * t + vph) * smoothstep((t - 0.3) / 0.8)
            drift = 4 * np.sin(TWO_PI * (0.13 + 0.1 * rng.random()) * t + rng.random() * 6)
            f = f0 * 2 ** ((det + vib + drift) / 1200.0)
            ph = phase_cycles(f)
            ph = (ph + rng.random()) % 1.0
            K = int(min(28, 6000 / f0))
            ks = np.arange(1, K + 1)
            env = _formant_env(ks * f0 * 1.0, vowel) / ks ** 0.5
            out += harmonic_sum(ph, list(env))
        out /= voices
        # breath
        br = filt(noise(rng, n), ("bp", _FORMANTS[vowel][0][0], 4.0)) + \
            filt(noise(rng, n), ("bp", _FORMANTS[vowel][1][0], 4.0))
        out += br * F32(0.035)
        t32 = t.astype(F32)
        a = smoothstep(t32 / attack) ** 1.2
        a *= np.where(t32 > length, np.exp(-(t32 - length) / F32(release * 0.45)), 1.0).astype(F32)
        out *= a
        out = filt(out, ("hp", 150), ("hs", 5000, 0.7, -6.0))
        return ramp_out(out * F32(1.2), 10)

    return cached(key, make)


def bowed_note(midi, length, vel=0.7, kind="cello", attack=0.25, release=0.35, voices=1,
               vib=12.0, seed=0, bright=0.5):
    """Bowed string (solo or section): polyBLEP saws + body EQ + bow noise."""
    key = ("bow", midi, round(length, 3), round(vel, 2), kind, attack, release, voices, vib, seed, bright)

    def make():
        rng = rng_for(*key)
        n = int((length + release * 2.5) * SR)
        f0 = float(mtof(midi))
        t = np.arange(n) / SR
        y = np.zeros(n, F32)
        for v in range(voices):
            det = 0.0 if voices == 1 else (v - (voices - 1) / 2) * (9.0 / max(1, voices - 1)) * 2 + rng.normal(0, 1.5)
            vr = 5.2 + rng.random() * 0.8
            vd = vib * smoothstep((t - 0.15 - 0.1 * rng.random()) / 0.4)
            m = det + vd * np.sin(TWO_PI * vr * t + rng.random() * 6)
            f = f0 * 2 ** (m / 1200.0)
            y += saw_blep(f, rng.random())
        y /= math.sqrt(voices)
        t32 = t.astype(F32)
        a = smoothstep(t32 / attack) ** 0.8
        a *= np.where(t32 > length, np.exp(-(t32 - length) / F32(release * 0.5)), 1.0).astype(F32)
        y *= a
        fc = (1400 + 3500 * vel * bright) if kind in ("cello", "bass") else (2500 + 5000 * vel * bright)
        if kind == "bass":
            y = filt(y, ("hp", 35), ("lp", fc * 0.6, 0.7), ("peak", 110, 1.0, 3.0), ("peak", 700, 1.0, -3.0))
        elif kind == "cello":
            y = filt(y, ("hp", 55), ("lp", fc, 0.7), ("lp", fc * 1.6, 0.7), ("peak", 230, 1.2, 4.0),
                     ("peak", 1100, 1.0, 1.0), ("peak", 2900, 1.5, -4.0))
        elif kind == "viola":
            y = filt(y, ("hp", 110), ("lp", fc, 0.7), ("lp", fc * 1.6, 0.7), ("peak", 350, 1.2, 3.0),
                     ("peak", 1600, 1.2, 2.0))
        else:  # violin
            y = filt(y, ("hp", 180), ("lp", fc, 0.7), ("lp", fc * 1.6, 0.7), ("peak", 460, 1.2, 3.0),
                     ("peak", 2900, 1.5, 3.0), ("hs", 7000, 0.7, -6.0))
        bn = filt(noise(rng, n), ("bp", 2500 if kind != "bass" else 900, 0.7))
        y += bn * a * F32(0.012) + bn * np.exp(-t32 / F32(0.05)) * F32(0.05 * vel)
        return ramp_out(ramp_in(y * F32(0.35), 2), 10)

    return cached(key, make)


def pad_note(midi, length, vel=0.6, voices=4, attack=1.4, release=2.0, fc=2200, seed=0):
    """Lush string-machine/orchestral pad voice: detuned saws through a soft lowpass."""
    key = ("pad", midi, round(length, 2), round(vel, 2), voices, attack, release, fc, seed)

    def make():
        rng = rng_for(*key)
        n = int((length + release * 2) * SR)
        f0 = float(mtof(midi))
        t = np.arange(n) / SR
        y = np.zeros(n, F32)
        for v in range(voices):
            det = (v - (voices - 1) / 2) * 6.0 + rng.normal(0, 1.0)
            m = det + 6 * np.sin(TWO_PI * (4.6 + rng.random()) * t + rng.random() * 6) * smoothstep(t / 2) \
                + 3 * np.sin(TWO_PI * 0.2 * t + rng.random() * 6)
            y += saw_blep(f0 * 2 ** (m / 1200.0), rng.random())
        y /= math.sqrt(voices)
        y = filt(y, ("lp", min(fc, f0 * 9), 0.6), ("lp", min(fc * 1.5, f0 * 14), 0.6), ("hp", 60),
                 ("peak", 400, 1.0, 2.0))
        t32 = t.astype(F32)
        a = smoothstep(t32 / attack)
        a *= np.where(t32 > length, np.exp(-(t32 - length) / F32(release * 0.45)), 1.0).astype(F32)
        return ramp_out(y * a * F32(0.3 * vel), 10)

    return cached(key, make)


def brass_note(midi, length, vel=0.8, kind="trumpet", voices=2, seed=0, scoop=0.35, fall=0.0):
    """Brass: saws morphing between a dark and a bright lowpass (envelope 'blat')."""
    key = ("brass", midi, round(length, 3), round(vel, 2), kind, voices, seed, scoop, fall)

    def make():
        rng = rng_for(*key)
        rel = 0.09 if kind != "horn" else 0.15
        n = int((length + rel * 4 + 0.05) * SR)
        f0 = float(mtof(midi))
        t = np.arange(n) / SR
        t32 = t.astype(F32)
        y_d = np.zeros(n, F32)
        y_b = np.zeros(n, F32)
        if kind == "trumpet":
            fd, fb, att = f0 * 3.0 + 400, min(11000, f0 * 9 + 2500 * vel), 0.022
        elif kind == "trombone":
            fd, fb, att = f0 * 3.0 + 250, min(8000, f0 * 9 + 1500 * vel), 0.03
        else:  # horn (only the action cue uses it: needs to cut through a full orchestra)
            fd, fb, att = f0 * 2.2 + 250, min(5500, f0 * 6.5 + 1600 * vel), 0.045
        sc = -100 * scoop * np.exp(-t / 0.035)
        fl = np.zeros(n)
        if fall:
            tf = max(0.0, length - 0.2)
            fl = -fall * 100 * np.clip((t - tf) / 0.3, 0, 1.5) ** 2
        for v in range(voices):
            det = (v - (voices - 1) / 2) * 5.0 + rng.normal(0, 1.5)
            vib = 10 * np.sin(TWO_PI * (5.2 + rng.random() * 0.6) * t + rng.random() * 6) * smoothstep((t - 0.3) / 0.4)
            f = f0 * 2 ** ((det + sc + vib + fl) / 1200.0)
            s = saw_blep(f, rng.random())
            y_d += filt(s, ("lp", fd, 0.6), ("lp", fd * 1.3, 0.6))
            y_b += filt(s, ("lp", fb, 0.7), ("lp", fb * 1.2, 0.6))
        b = vel * (0.4 + 0.6 * np.exp(-np.maximum(t32 - att, 0) / F32(0.12)))
        b = b * smoothstep(t32 / (att * 1.5))
        y = y_d + (y_b - y_d) * b.astype(F32)
        a = smoothstep(t32 / att)
        a *= np.where(t32 > length, np.exp(-(t32 - length) / F32(rel)), 1.0).astype(F32)
        y *= a / math.sqrt(voices)
        bn = filt(noise(rng, n), ("bp", 1800, 0.8)) * a * F32(0.02)
        y += bn
        if kind == "trumpet":
            y = filt(y, ("hp", 180), ("peak", 1300, 1.0, 3.0), ("hs", 8000, 0.7, -6))
        elif kind == "trombone":
            y = filt(y, ("hp", 70), ("peak", 600, 1.0, 2.0), ("hs", 6000, 0.7, -6))
        else:
            y = filt(y, ("hp", 70), ("peak", 350, 1.0, 1.0), ("peak", 1500, 0.9, 2.5), ("hs", 4500, 0.7, -5))
        return ramp_out(ramp_in(y * F32(0.4), 2), 8)

    return cached(key, make)


# =============================================================================
# drums & percussion (mono, cached with a few round-robin variants)
# =============================================================================
def kick(vel=0.8, kind="soft", variant=0):
    layer, res = _vlayer(vel, 3)

    def make():
        rng = rng_for("kick", layer, kind, variant)
        n = int(0.5 * SR)
        t = np.arange(n) / SR
        if kind == "soft":
            f = 48 + 55 * np.exp(-t / 0.035)
            T = 0.32
        else:
            f = 50 + 110 * np.exp(-t / 0.025)
            T = 0.4
        ph = phase_cycles(f)
        y = np.sin(ph.astype(F32) * F32(TWO_PI)) * exp_env(n, T)
        nk = int(0.004 * SR)
        y[:nk] += onepole_lp(noise(rng, nk), 2500 if kind == "soft" else 5000) * F32(0.2 * layer)
        return ramp_out(ramp_in(y, 0.5), 30) * F32(0.8)

    return cached(("kick", layer, kind, variant), make), res


def snare(vel=0.8, kind="stick", variant=0):
    layer, res = _vlayer(vel, 4)

    def make():
        rng = rng_for("snare", layer, kind, variant)
        n = int(0.4 * SR)
        body = partial_bank([182 * (1 + 0.01 * variant), 335, 450], [1.0, 0.5, 0.25], [0.09, 0.06, 0.04], n,
                            phases=[0.25, 0.1, 0.4])
        nz = filt(noise(rng, n), ("hp", 1500), ("peak", 4500, 0.8, 3), ("lp", 11000))
        nz *= exp_env(n, 0.2 if kind == "stick" else 0.35)
        if kind == "march":
            nz *= 1.3
        y = body * F32(0.6 + 0.3 * layer) + nz * F32(0.55 + 0.35 * layer)
        nk = int(0.003 * SR)
        y[:nk] += noise(rng, nk) * F32(0.3 * layer)
        return ramp_out(ramp_in(y, 0.3), 20) * F32(0.5)

    return cached(("snare", layer, kind, variant), make), res


def brush_tap(vel=0.6, variant=0):
    layer, res = _vlayer(vel, 3)

    def make():
        rng = rng_for("btap", layer, variant)
        n = int(0.25 * SR)
        y = filt(noise(rng, n), ("hp", 1800), ("lp", 9000), ("peak", 4000, 0.7, 3))
        t32 = np.arange(n, dtype=F32) / SR
        e = smoothstep(t32 / 0.004) * np.exp(-t32 / F32(0.05))
        body = partial_bank([190, 340], [0.3, 0.15], [0.06, 0.04], n)
        return ((y * e) * F32(0.6) + body * F32(0.4 * layer)) * F32(0.6)

    return cached(("btap", layer, variant), make), res


def brush_swish(length, vel=0.5, variant=0):
    key = ("bswish", round(length, 3), variant)

    def make():
        rng = rng_for(*key)
        n = int(length * SR)
        y = filt(noise(rng, n), ("hp", 1500), ("lp", 7000), ("peak", 3000, 0.7, 2))
        x = np.linspace(0, 1, n, dtype=F32)
        e = np.sin(np.pi * x) ** 2 * (0.6 + 0.4 * x)
        return y * e * F32(0.25)

    return cached(key, make), vel


def _metal(rng, n, fmin, fmax, count, t60_range, emph=None):
    freqs = np.exp(rng.uniform(np.log(fmin), np.log(fmax), count))
    amps = rng.uniform(0.3, 1.0, count) / np.sqrt(freqs / fmin) ** 0.5
    if emph is not None:
        amps *= 1 + 2.0 * np.exp(-((np.log(freqs) - np.log(emph)) / 0.35) ** 2)
    t60 = rng.uniform(*t60_range, count)
    return partial_bank(freqs, amps / count ** 0.5, t60, n, phases=rng.random(count))


def ride(vel=0.6, variant=0):
    layer, res = _vlayer(vel, 3)

    def make():
        rng = rng_for("ride", variant)
        n = int(2.2 * SR)
        y = _metal(rng, n, 380, 11000, 70, (0.8, 2.6), emph=3800)
        nz = filt(noise(rng, n), ("hp", 5000)) * exp_env(n, 0.5) * F32(0.12)
        ping = partial_bank([2950, 4480, 5320], [0.4, 0.3, 0.2], [0.25, 0.2, 0.15], n)
        y = y * F32(0.8) + nz + ping * F32(0.35 + 0.3 * layer)
        nk = int(0.002 * SR)
        y[:nk] += noise(rng, nk) * F32(0.4)
        y = filt(y, ("hp", 300), ("hs", 9000, 0.7, -3))
        return ramp_out(ramp_in(y, 0.3), 200) * F32(0.35)

    return cached(("ride", layer, variant), make), res


def crash(vel=0.9, variant=0):
    layer, res = _vlayer(vel, 2)

    def make():
        rng = rng_for("crash", variant)
        n = int(3.0 * SR)
        y = _metal(rng, n, 300, 12000, 90, (0.8, 2.2), emph=5000)
        nz = filt(noise(rng, n), ("hp", 2500), ("lp", 13000)) * (exp_env(n, 1.6) * 0.7 + exp_env(n, 0.15) * 0.6)
        t32 = np.arange(n, dtype=F32) / SR
        y = (y * F32(0.7) + nz * F32(0.45)) * smoothstep(t32 / 0.006)
        y = filt(y, ("hp", 250), ("hs", 10000, 0.7, -3))
        return ramp_out(y, 300) * F32(0.45)

    return cached(("crash", layer, variant), make), res


def hat(vel=0.5, kind="chick", variant=0):
    layer, res = _vlayer(vel, 3)

    def make():
        rng = rng_for("hat", kind, variant)
        n = int(0.25 * SR)
        y = _metal(rng, n, 3000, 14000, 30, (0.05, 0.25))
        nz = filt(noise(rng, n), ("hp", 6000))
        T = 0.04 if kind == "chick" else 0.12
        y = (y * F32(0.5) + nz * F32(0.6)) * exp_env(n, T)
        if kind == "chick":
            y = filt(y, ("peak", 7000, 1.0, -3))
        return ramp_out(ramp_in(y, 1.0), 10) * F32(0.35)

    return cached(("hat", layer, kind, variant), make), res


def rim(vel=0.6, variant=0):
    layer, res = _vlayer(vel, 3)

    def make():
        rng = rng_for("rim", variant)
        n = int(0.12 * SR)
        y = partial_bank([520, 1660, 2530, 3350], [0.6, 1.0, 0.5, 0.3], [0.04, 0.03, 0.02, 0.015], n,
                         phases=rng.random(4))
        nk = int(0.003 * SR)
        y[:nk] += filt(noise(rng, nk), ("hp", 2000), ("lp", 9000)) * exp_env(nk, 0.0025) * F32(0.9)
        return ramp_out(ramp_in(y, 0.2), 10) * F32(0.4)

    return cached(("rim", layer, variant), make), res


def shaker(vel=0.5, variant=0):
    layer, res = _vlayer(vel, 3)

    def make():
        rng = rng_for("shaker", layer, variant)
        n = int(0.11 * SR)
        y = filt(noise(rng, n), ("hp", 4500), ("lp", 12000), ("peak", 7500, 1.0, 3))
        t32 = np.arange(n, dtype=F32) / SR
        e = smoothstep(t32 / 0.018) * np.exp(-np.maximum(t32 - 0.018, 0) / F32(0.025))
        return y * e * F32(0.4)

    return cached(("shaker", layer, variant), make), res


def clap(vel=0.8, variant=0):
    layer, res = _vlayer(vel, 3)

    def make():
        rng = rng_for("clap", variant)
        n = int(0.35 * SR)
        y = np.zeros(n, F32)
        for c in range(3):  # three clappers
            base = int(rng.uniform(0, 0.012) * SR)
            for b in range(3):
                s = base + int((0.0085 * b + rng.uniform(-0.001, 0.001)) * SR)
                L = int(0.012 * SR)
                if s + L > n:
                    continue
                burst = noise(rng, L) * exp_env(L, 0.012)
                y[s:s + L] += burst * F32(rng.uniform(0.6, 1.0))
            s = base + int(0.025 * SR)
            L = n - s
            y[s:] += noise(rng, L) * exp_env(L, 0.16) * F32(0.5)
        y = filt(y, ("hp", 700), ("peak", 1400, 1.2, 5), ("lp", 7500))
        return ramp_out(y, 20) * F32(0.25)

    return cached(("clap", layer, variant), make), res


def woodblock(vel=0.5, high=True, variant=0):
    layer, res = _vlayer(vel, 3)

    def make():
        rng = rng_for("wb", high, variant)
        n = int(0.15 * SR)
        f = 1850 if high else 1380
        y = partial_bank([f, f * 2.73, f * 0.53], [1.0, 0.25, 0.3], [0.05, 0.02, 0.03], n, phases=[0.25, 0, 0])
        nk = int(0.0025 * SR)
        y[:nk] += filt(noise(rng, nk), ("lp", 4500), ("lp", 6000), ("hp", 800)) * exp_env(nk, 0.002) * F32(0.6)
        return ramp_out(ramp_in(y, 0.7), 10) * F32(0.35)

    return cached(("wb", layer, high, variant), make), res


def timpani(midi, vel=0.8, variant=0):
    layer, res = _vlayer(vel, 4)

    def make():
        rng = rng_for("timp", midi, layer, variant)
        n = int(3.0 * SR)
        f = float(mtof(midi))
        t = np.arange(n) / SR
        ratios = [1.0, 1.504, 1.742, 2.0, 2.245, 2.494, 2.8]
        amps = [1.0, 0.55, 0.25, 0.35, 0.15, 0.12, 0.06]
        T60 = [2.6, 1.6, 1.0, 1.1, 0.8, 0.7, 0.5]
        y = np.zeros(n, F32)
        glide = 1 + 0.012 * np.exp(-t / 0.08)
        for r, a, T in zip(ratios, amps, T60):
            ph = phase_cycles(f * r * glide)
            y += F32(a * (0.5 + 0.5 * layer) ** (r - 1)) * np.sin(ph.astype(F32) * F32(TWO_PI)) * exp_env(n, T)
        thud = np.sin(phase_cycles(f * 0.55 * glide).astype(F32) * F32(TWO_PI)) * exp_env(n, 0.25)
        y += thud * F32(0.6)
        nk = int(0.01 * SR)
        y[:nk] += onepole_lp(noise(rng, nk), 1500 + 2000 * layer) * F32(0.4 * layer)
        y = filt(y, ("hp", 30), ("lp", 5000))
        return ramp_out(ramp_in(y, 0.8), 100) * F32(0.6)

    return cached(("timp", midi, layer, variant), make), res


# =============================================================================
# reverb + mastering
# =============================================================================
def make_ir(t60=1.6, predelay=0.018, damp=0.5, seed=1, er_gain=0.5, length=None):
    key = ("ir", t60, predelay, damp, seed, er_gain, length)

    def make():
        rng = rng_for(*key)
        L = int((length or min(4.5, t60 * 1.15)) * SR)
        t = np.arange(L, dtype=F32) / SR
        out = []
        for ch in range(2):
            nz = noise(rng, L)
            low = filt(nz, ("lp", 450))
            high = filt(nz, ("hp", 3800))
            mid = nz - low - high
            # low band decays a little *faster* than the mids (no LF boom/mud in the tail)
            ir = (low * np.exp(t * F32(-6.9 / (t60 * 0.9))) +
                  mid * np.exp(t * F32(-6.9 / t60)) +
                  high * np.exp(t * F32(-6.9 / (t60 * (0.35 + 0.4 * (1 - damp)))))) * F32(1.0)
            ir *= smoothstep(t / 0.012)
            # sparse early reflections
            er = np.zeros(L, F32)
            for k in range(10):
                d = rng.uniform(0.004, 0.05)
                i = int(d * SR)
                er[i] += rng.uniform(0.4, 1.0) * (1 if rng.random() > 0.3 else -1) * math.exp(-d / 0.04)
            er = filt(er, ("lp", 6000))
            ir = ir / np.sqrt(np.sum(ir ** 2)) + er * F32(er_gain) / (np.sqrt(np.sum(er ** 2)) + 1e-9) * F32(0.35)
            ir = np.concatenate([np.zeros(int(predelay * SR), F32), ir])
            out.append(ir.astype(F32))
        return np.stack(out, axis=1)

    return cached(key, make)


def limiter(x, ceiling=0.89, look=0.004, release=0.12):
    """Look-ahead peak limiter.  `ceiling` is a scalar or a per-sample array.

    Gain reduction ramps in over the `look` seconds before an over-ceiling peak (short
    centred min-filter + moving average, which never under-reduces at the peak), holds
    through it and then releases exponentially (time constant `release`) *after* it --
    a backward-looking peak-hold computed at control rate in the log domain."""
    x = np.asarray(x, dtype=F32)
    peak = np.max(np.abs(x), axis=1).astype(np.float64)
    need = np.minimum(1.0, np.asarray(ceiling, dtype=np.float64) / np.maximum(peak, 1e-9))
    if need.min() >= 1.0:
        return x
    La = max(3, int(look * SR))
    g = minimum_filter1d(need, size=2 * La + 1)
    g = uniform_filter1d(g, size=La)          # attack ramp; still <= need at every peak
    red = 1.0 - g
    hop = 32
    nb = (len(red) + hop - 1) // hop
    blk = np.pad(red, (0, nb * hop - len(red))).reshape(nb, hop).max(axis=1)
    # r[i] = max_{j<=i} blk[j] * a^(i-j): exponential release that only looks backwards
    la = -hop / (release * SR)
    idx = np.arange(nb, dtype=np.float64)
    lr = np.maximum.accumulate(np.log(np.maximum(blk, 1e-12)) - idx * la) + idx * la
    r = np.where(lr > math.log(1e-9), np.exp(lr), 0.0)
    rel = np.interp(np.arange(len(red), dtype=np.float64), idx * hop + (hop - 1), r)
    red = np.maximum(red, rel)                # never less reduction than needed
    return (x * (1.0 - red)[:, None].astype(F32)).astype(F32)


def lufs(x):
    """Integrated loudness (ITU-R BS.1770-4, gated) of a stereo float array."""
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    y = lfilter(b2, a2, lfilter(b1, a1, x, axis=0), axis=0)
    p = np.sum(y * y, axis=1)
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    if len(p) < blk:
        return float(-0.691 + 10 * np.log10(np.mean(p) + 1e-15))
    cs = np.concatenate([[0.0], np.cumsum(p)])
    st = np.arange(0, len(p) - blk + 1, hop)
    z = (cs[st + blk] - cs[st]) / blk
    L = -0.691 + 10 * np.log10(z + 1e-15)
    g = z[L > -70]
    if len(g) == 0:
        return -99.0
    thr = -0.691 + 10 * np.log10(np.mean(g)) - 10
    g = z[(L > -70) & (L > thr)]
    return float(-0.691 + 10 * np.log10(np.mean(g)))


# =============================================================================
# mixer / render context
# =============================================================================
class Ctx:
    """Render context for one cue: stereo dry + reverb-send buses, event log.
    Parts listed in PART_EQ[style] are mixed on their own sub-bus and equalised at
    mastering time (cheaper than EQ'ing every note, and the reverb send is EQ'd too)."""

    def __init__(self, style, duration, seed):
        self.style = style
        self.D = float(duration)
        self.n = max(1, int(round(self.D * SR)))
        self.seed = seed
        self.rng = rng_for("style", style, seed)
        self.dry = np.zeros((self.n, 2), F32)
        self.wet = np.zeros((self.n, 2), F32)
        self.log = []      # (t, part, text)
        self.chords = []   # (t0, t1, name)
        self.melody = []   # (t, d, midi)
        self.anchors = {}
        self.energy = {}   # per-part energy (balancing aid)
        self.part = None
        self.parts = {} if os.environ.get("MUSIC_DEBUG_PARTS") else None
        self.onsets = []
        self.pgain = {k: db2lin(v) for k, v in PART_DB.get(style, {}).items()}
        self.peq = PART_EQ.get(style, {})
        self.pbus = {}     # part -> [dry, wet] sub-buses for EQ'd parts
        self.ceiling = None
        self.hit_at = None
        self.tail = None
        self.hit = None
        self.cut = None
        self.post_gain = None

    def hum(self, sd=0.006, lim=0.015):
        return float(np.clip(self.rng.normal(0, sd), -lim, lim))

    def place(self, x, t, gain=1.0, pan=0.0, send=0.2, part=None):
        """Mix mono (n,) or stereo (n,2) audio at time t (s)."""
        if gain == 0 or x is None or len(x) == 0:
            return
        part = part or self.part
        gain = gain * self.pgain.get(part, 1.0)
        i0 = int(round(t * SR))
        if i0 >= self.n:
            return
        if i0 < 0:
            x = x[-i0:]
            i0 = 0
        m = min(len(x), self.n - i0)
        if m <= 0:
            return
        th = (np.clip(pan, -1, 1) + 1) * np.pi / 4
        gl, gr = math.cos(th) * math.sqrt(2), math.sin(th) * math.sqrt(2)
        seg = x[:m]
        if seg.ndim == 1:
            st = np.empty((m, 2), F32)
            st[:, 0] = seg * F32(gain * gl)
            st[:, 1] = seg * F32(gain * gr)
        else:
            st = seg * np.array([gain * gl, gain * gr], F32)
        if part in self.peq:
            bus = self.pbus.get(part)
            if bus is None:
                bus = self.pbus[part] = [np.zeros((self.n, 2), F32), np.zeros((self.n, 2), F32)]
            dry, wet = bus
        else:
            dry, wet = self.dry, self.wet
        dry[i0:i0 + m] += st
        if self.parts is not None:
            buf = self.parts.setdefault(part or "?", np.zeros((self.n, 2), F32))
            buf[i0:i0 + m] += st
            self.onsets.append(i0 / SR)
        if part is not None:
            self.energy[part] = self.energy.get(part, 0.0) + float(np.sum(np.square(st, dtype=np.float64)))
        if send:
            wet[i0:i0 + m] += st * F32(send)

    def flush_parts(self):
        """EQ the part sub-buses and fold them into the main dry/wet buses."""
        for part, (dry, wet) in self.pbus.items():
            spec = self.peq[part]
            self.dry += filt(dry, *spec)
            self.wet += filt(wet, *spec)
            if self.parts is not None and part in self.parts:
                self.parts[part] = filt(self.parts[part], *spec)
        self.pbus = {}

    def automate(self, points):
        """Gain automation (dB) of everything mixed so far: points = [(t, dB), ...],
        linear in dB between points, held flat outside them."""
        self.flush_parts()
        ts = np.array([p[0] for p in points], dtype=np.float64)
        ds = np.array([p[1] for p in points], dtype=np.float64)
        t = np.arange(self.n, dtype=np.float64) / SR
        gcurve = (10.0 ** (np.interp(t, ts, ds) / 20.0)).astype(F32)[:, None]
        self.dry *= gcurve
        self.wet *= gcurve
        if self.parts is not None:
            for k in self.parts:
                self.parts[k] *= gcurve

    def note(self, part, t, text):
        self.log.append((t, part, text))


# reverb send high-pass (Hz, 4th-order Butterworth) per style: the low end stays dry and
# centred; the room only blooms above the bass register
WET_HP = {"jazz_title": 170, "jazz_end": 170, "lounge": 180, "tension": 200, "therapy": 200,
          "montage": 170, "serene": 300, "action": 180, "sunset": 260}


def _master(ctx, ir, style, tone=None):
    ctx.flush_parts()
    y = ctx.dry
    if ir is not None:
        sos_w = butter(4, WET_HP.get(style, 180), "hp", fs=SR, output="sos")
        wet_in = sosfilt(sos_w, ctx.wet, axis=0).astype(F32)
        wet = np.empty_like(ctx.wet)
        for c in range(2):
            wet[:, c] = oaconvolve(wet_in[:, c], ir[:, c])[:ctx.n]
        if ctx.parts is not None:   # analysis aid (MUSIC_DEBUG_PARTS): the reverb return
            ctx.wet_ret = wet
        y = y + wet
    sos = butter(2, 28, "hp", fs=SR, output="sos")
    y = sosfilt(sos, y, axis=0).astype(F32)
    if ctx.post_gain is not None:      # composed ending: ring-out damping (see _ring_out)
        y = y * ctx.post_gain[:, None]
    if tone:
        y = filt(y, *tone)
    ctx.pre = y
    gain = _cal_gain(style)
    if ctx.anchors.get("own_ending"):
        # composed endings are calibrated at their real length: a short title / end-card cue
        # is mostly tag + button, so the 60 s calibration would leave it ~1 LU short.  Measure
        # the in-picture part and aim it at TARGET_LUFS (within +-4 dB of the 60 s calibration).
        i1 = max(int(0.4 * SR), int((ctx.cut or ctx.D) * SR))
        L = lufs(y[:i1])
        if L > -70.0:
            cal_db = 20.0 * math.log10(gain)
            gain = db2lin(float(np.clip(TARGET_LUFS[style] - L, cal_db - 4.0, cal_db + 4.0)))
    ctx.master_gain = gain
    y = y * F32(gain)
    y = limiter(y, ceiling=0.89 if ctx.ceiling is None else ctx.ceiling)
    return y


# pad voices (lowest first): the bottom voice sits near the centre, upper voices spread out
PAD_PANS = [-0.08, 0.42, -0.42, 0.2, -0.2]

# per-style mix trims (dB) by part name
PART_DB = {
    # (piano trimmed 2.5 dB in r3: the re-voiced piano sustains more inside its short comps)
    "jazz_title": {"bass": -1.5, "piano": -0.5, "drums": 3.0},
    "jazz_end": {"bass": -1.5, "piano": -1.2, "drums": 3.0, "banjo": 9.0, "trombone": 5.0},
    "lounge": {"vibes": 1.5, "guitar": -1.7, "perc": 3.5},
    "tension": {"drone": -5.0, "pizz": 1.0, "clock": 11.0, "violins": 4.0, "glock": 10.0, "bassoon": 0.0},
    "therapy": {"piano": -3.5},
    "montage": {"whistle": -4.5, "uke": -2.5, "bass": -6.0, "drums": 5.0, "banjo": 6.0, "glock": 4.0},
    "serene": {"vibes": 4.3, "harp": 1.6, "bass": -5.5, "choir": -1.0},
    "action": {"stabs": 4.0, "horns": -1.0, "strings": 0.5, "drums": 2.0},
    "sunset": {"clarinet": 1.2, "pad": 1.0, "bass": 2.0},
}

# per-style, per-part EQ (biquad chains, see filt()) applied on the part's sub-bus
PART_EQ = {
    # carve a dialogue pocket: the strummed/rolled strings own 1.6-6.4 kHz in the montage
    # (the strings get their 300-700 Hz body back: the cue's mids were thin under bass + kick;
    # bass and kick lose their sub-50 Hz)
    "montage": {"uke": [("peak", 320, 1.0, 2.5), ("peak", 480, 0.9, 3.0), ("peak", 1100, 0.8, -6.0),
                        ("peak", 2400, 0.9, -4.5), ("hs", 3500, 0.7, -6.5)],
                "banjo": [("peak", 300, 1.0, 4.0), ("peak", 520, 1.0, 3.0), ("peak", 1250, 1.6, -4.0),
                          ("peak", 2800, 1.0, -3.5), ("hs", 5000, 0.7, -2.0)],
                "drums": [("hp", 45, 0.7), ("hs", 4000, 0.7, -2.5)],
                "bass": [("hp", 50, 0.7), ("peak", 110, 1.0, -1.5)]},
    # action: tame the 20-80 Hz pile-up of bass-section saws, timpani and kick
    "action": {"strings": [("ls", 80, 0.7, -4.5), ("hp", 32, 0.7), ("peak", 140, 0.9, -2.0)],
               "drums": [("hp", 40, 0.7), ("ls", 80, 0.7, -4.0), ("peak", 115, 1.0, -2.5),
                         ("peak", 3500, 0.8, -3.5), ("hs", 9000, 0.7, 2.0)]},
}

# per-style calibration: pre-gain integrated loudness (LUFS) of a 60 s render (mean of seeds
# 0 and 1), measured by `python src/music.py calibrate`; the master gain maps it to TARGET_LUFS.
# (Cues with a composed ending -- jazz_end, short jazz_title -- are instead measured at their
# real length, in-picture part only; CAL then only bounds that make-up gain to +-4 dB.)
CAL = {'jazz_title': -6.59, 'lounge': -9.39, 'tension': -12.66, 'therapy': -12.9, 'montage': -15.17,
       'serene': -9.66, 'action': -11.04, 'sunset': -12.45, 'jazz_end': -4.81}


def _cal_gain(style):
    return db2lin(TARGET_LUFS[style] - CAL.get(style, -10.0))


# =============================================================================
# harmony: chord symbols, voicings, voice leading
# =============================================================================
#  quality: (chord tones, comping voicing, melody tensions)   -- semitones above root
QUALITIES = {
    "":        ([0, 4, 7], [0, 4, 7, 12], [2, 9, 11]),
    "6":       ([0, 4, 7, 9], [4, 7, 9, 12], [2]),
    "6/9":     ([0, 4, 7, 9, 14], [4, 9, 14, 19], []),
    "maj7":    ([0, 4, 7, 11], [4, 7, 11, 14], [2, 6, 9]),
    "maj9":    ([0, 4, 7, 11, 14], [4, 7, 11, 14], [6, 9]),
    "maj7#11": ([0, 4, 7, 11, 18], [4, 11, 14, 18], [2, 9]),
    "m":       ([0, 3, 7], [0, 3, 7, 12], [2, 5, 10]),
    "m6":      ([0, 3, 7, 9], [3, 7, 9, 12], [2, 5]),
    "m7":      ([0, 3, 7, 10], [3, 7, 10, 14], [2, 5]),
    "m9":      ([0, 3, 7, 10, 14], [3, 7, 10, 14], [5]),
    "madd9":   ([0, 3, 7, 14], [3, 7, 12, 14], [5, 10]),
    "m(maj7)": ([0, 3, 7, 11], [3, 7, 11, 14], [2]),
    "7":       ([0, 4, 7, 10], [4, 7, 10, 12], [2, 9]),
    "9":       ([0, 4, 7, 10, 14], [4, 10, 14, 19], [9]),
    "13":      ([0, 4, 7, 10, 14, 21], [4, 10, 14, 21], [2, 9]),
    "7b9":     ([0, 4, 7, 10, 13], [4, 10, 13, 19], [3, 8]),
    "9#11":    ([0, 4, 7, 10, 14, 18], [4, 10, 14, 18], [9]),
    "7sus4":   ([0, 5, 7, 10], [5, 10, 14, 19], [2, 9]),
    "13sus":   ([0, 5, 7, 10, 14, 21], [5, 10, 14, 21], [2]),
    "7b5":     ([0, 4, 6, 10], [4, 6, 10, 12], [2]),
    "dim7":    ([0, 3, 6, 9], [0, 3, 6, 9], [2, 5, 8, 11]),
    "m7b5":    ([0, 3, 6, 10], [3, 6, 10, 12], [5, 8]),
}


class Chord:
    def __init__(self, sym):
        self.sym = sym
        main, _, bass = sym.partition("/") if "/" in sym and not sym.endswith("6/9") else (sym, "", "")
        if sym.endswith("6/9"):
            main, bass = sym, ""
        i = 1
        while i < len(main) and main[i] in "#b":
            i += 1
        self.root = (_LETTER[main[0]] + sum(1 if c == "#" else -1 for c in main[1:i])) % 12
        q = main[i:]
        if q not in QUALITIES:
            raise ValueError(f"unknown chord quality {q!r} in {sym}")
        self.q = q
        tones, comp, tens = QUALITIES[q]
        self.tones = [(self.root + x) % 12 for x in tones]
        self.comp = [(self.root + x) % 12 for x in comp]
        self.allowed = set(self.tones) | {(self.root + x) % 12 for x in tens}
        if bass:
            j = 1
            while j < len(bass) and bass[j] in "#b":
                j += 1
            self.bass = (_LETTER[bass[0]] + sum(1 if c == "#" else -1 for c in bass[1:j])) % 12
        else:
            self.bass = self.root
        self.third = next((x for x in self.tones if (x - self.root) % 12 in (3, 4, 5)), self.root)
        self.fifth = next((x for x in self.tones if (x - self.root) % 12 in (6, 7, 8)), (self.root + 7) % 12)

    def __repr__(self):
        return self.sym


_CHORD_CACHE = {}


def C(sym):
    c = _CHORD_CACHE.get(sym)
    if c is None:
        c = _CHORD_CACHE[sym] = Chord(sym)
    return c


def nearest(pc, ref, lo=0, hi=127):
    """Midi note with pitch class pc nearest to ref, within [lo, hi]."""
    base = ref + ((pc - ref) % 12)
    cands = [base - 12, base, base - 24, base + 12]
    cands = [c for c in cands if lo <= c <= hi] or [lo + ((pc - lo) % 12)]
    return min(cands, key=lambda c: abs(c - ref))


def _melody_safe_pcs(pcs, avoid, keep_min=2):
    """Drop the chord tones that sit a semitone below a sounding melody note (they would
    make a m2 / m9 under it -- e.g. the resolution note under an appoggiatura, the maj7
    under a root melody, the 9th under a minor-3rd melody), keeping at least keep_min."""
    if not avoid:
        return list(pcs)
    apc = {int(a) % 12 for a in avoid}
    keep = [p for p in pcs if not any((a - p) % 12 == 1 for a in apc)]
    return keep if len(keep) >= keep_min else list(pcs)


def voice(pcs, lo, hi, prev=None, center=None, max_span=19, low_gap=52, avoid=None):
    """Choose a voicing of the pitch classes in [lo, hi] with smooth voice leading.
    avoid: midi notes of the melody sounding over this chord -- no voice may sit a m2 or
    m9 below one of them or a m2 above it (pitch classes that cannot avoid that are dropped
    first, see _melody_safe_pcs)."""
    pcs = list(dict.fromkeys(_melody_safe_pcs(pcs, avoid)))
    av = sorted({int(a) for a in avoid}) if avoid else []
    opts = [[m for m in range(lo, hi + 1) if m % 12 == pc] for pc in pcs]
    best, bestc = None, 1e9
    import itertools
    center = (lo + hi) / 2 if center is None else center
    for combo in itertools.product(*opts):
        v = sorted(combo)
        if len(set(v)) < len(v) or v[-1] - v[0] > max_span:
            continue
        cost = 0.0
        if v[0] < low_gap and len(v) > 1 and v[1] - v[0] < 3:
            cost += 8
        # seconds at the bottom of a voicing below middle C sound muddy
        if len(v) > 1 and v[0] < 60 and v[1] - v[0] < 3:
            cost += 6 if v[1] - v[0] == 1 else 3.5
        for a_, b_ in zip(v[:-1], v[1:]):
            if b_ - a_ == 1 and a_ < 60:
                cost += 7
        if len(v) > 2 and v[0] < low_gap - 5 and v[2] - v[0] < 7:
            cost += 4
        # avoid minor-2nd on top
        if len(v) > 1 and v[-1] - v[-2] == 1:
            cost += 3
        if av:
            for x in v:
                for a in av:
                    if a - x in (1, 13) or x - a == 1:
                        cost += 60      # m2/m9 under (or m2 over) the melody: effectively banned
                    elif x > a:
                        cost += 2       # mild: keep the accompaniment under the tune
        if prev:
            p = sorted(prev)
            if len(p) == len(v):
                cost += sum(abs(a - b) for a, b in zip(v, p))
            else:
                cost += sum(min(abs(a - b) for b in p) for a in v)
            cost += 0.15 * abs(np.mean(v) - center)
        else:
            cost += abs(np.mean(v) - center)
        if cost < bestc:
            best, bestc = v, cost
    if best is None:
        return voice(pcs, lo - 6, hi + 6, prev, center, max_span + 5, low_gap, avoid)
    return best


def sounding(notes, t0, t1, min_d=0.25, min_ov=0.1):
    """Midi notes of a melody (list of (t, d, m)) that sound over [t0, t1] -- notes at least
    min_d long overlapping the window by at least min_ov seconds."""
    out = []
    for (t, d, m) in notes:
        if d >= min_d and min(t1, t + d) - max(t0, t) >= min_ov:
            out.append(int(m))
    return out


# =============================================================================
# time grids
# =============================================================================
class Grid:
    """Bars/beats -> seconds, with swing and an optional rubato tempo curve."""

    def __init__(self, bpm, bpb=4, swing=0.5, offset=0.0, rubato=None, bars=200):
        self.bpm, self.bpb, self.swing, self.offset = bpm, bpb, swing, offset
        self.beat_s = 60.0 / bpm
        self.bar_s = self.bpb * self.beat_s
        self._map = None
        if rubato is not None:
            # rubato(beat) -> tempo factor; integrate seconds per beat on a fine grid
            res = 64
            b = np.arange(0, bars * bpb * res + 1) / res
            spb = self.beat_s / np.array([rubato(x) for x in b])
            sec = np.concatenate([[0.0], np.cumsum((spb[1:] + spb[:-1]) * 0.5 / res)])
            self._map = (b, sec)

    def _swing(self, beats):
        fb = math.floor(beats + 1e-9)
        fr = beats - fb
        s = self.swing
        if abs(s - 0.5) > 1e-6:
            fr = fr / 0.5 * s if fr < 0.5 else s + (fr - 0.5) / 0.5 * (1 - s)
        return fb + fr

    def t(self, bar, beat=0.0):
        b = self._swing(bar * self.bpb + beat)
        if self._map is None:
            return self.offset + b * self.beat_s
        bb, sec = self._map
        if b < 0:
            return self.offset + b * self.beat_s
        return self.offset + float(np.interp(b, bb, sec))

    def d(self, bar, beat, dur):
        return self.t(bar, beat + dur) - self.t(bar, beat)


# =============================================================================
# part helpers
# =============================================================================
LOW_CENTRED = ("piano_note", "upright_note")   # instruments whose low notes are kept centred & dry


def play(ctx, fn, t, midi, vel, dur, rel=0.25, gain=1.0, pan=0.0, send=0.2, **kw):
    """Render a (cached, full-ring) note, damp it after dur, and mix it.
    Mix rule: piano / upright-bass notes below G3 (55) slide to the centre (fully centred at
    G2 and below) and get at most a 0.08 reverb send, so the low end is mono and dry."""
    if midi < 55 and getattr(fn, "__name__", "") in LOW_CENTRED:
        pan = pan * max(0.0, (midi - 43) / 12.0)
        send = min(send, 0.08)
    x, res = fn(midi, vel, **kw) if kw else fn(midi, vel)
    y = release_tail(x, dur, rel) if dur is not None else x
    ctx.place(y, t, gain * res, pan, send)


def am_lfo(n, t0, rate, depth, phase=0.0):
    t = (np.arange(n, dtype=np.float64) / SR + t0)
    return (1.0 - depth * (0.5 + 0.5 * np.sin(TWO_PI * rate * t + phase))).astype(F32)


def place_autopan(ctx, x, t, gain, pan, send, rate=3.2, depth=0.35):
    """Rhodes-style stereo tremolo, phase-locked to absolute time."""
    n = len(x)
    tt = (np.arange(n, dtype=np.float64) / SR + t)
    lfo = np.sin(TWO_PI * rate * tt).astype(F32) * F32(depth)
    st = np.empty((n, 2), F32)
    st[:, 0] = x * (1 - lfo)
    st[:, 1] = x * (1 + lfo)
    ctx.place(st, t, gain, pan, send)


def bar_chords(spec):
    """'Dmaj9' or 'F#m7|B7b9' -> list of (beat, Chord) for a 4/4 bar."""
    parts = spec.split("|")
    step = 4.0 / len(parts)
    return [(i * step, C(p)) for i, p in enumerate(parts)]


def chord_at(chart_bar, beat):
    cur = chart_bar[0][1]
    for b, c in chart_bar:
        if beat + 1e-6 >= b:
            cur = c
    return cur


def melody_notes(spec):
    """'0 F#5 1; 1.5 E5 1; ...' or list of tuples -> list of (beat, midi, dur)."""
    if isinstance(spec, str):
        out = []
        for item in spec.split(";"):
            item = item.strip()
            if not item:
                continue
            b, nm, d = item.split()[:3]
            out.append((float(b), N(nm), float(d)))
        return out
    return list(spec)


def _melody_to_phrases(ctx, grid, bar, spec, transpose=0, vel=0.75, gap_split=0.6):
    """Convert one bar of melody text to absolute note dicts."""
    out = []
    for (b, m, d) in melody_notes(spec):
        t = grid.t(bar, b)
        out.append(dict(t=t, d=grid.d(bar, b, d), m=m + transpose, v=vel, beat=(bar, b)))
    return out


def _split_phrases(notes, gap=0.35):
    phrases, cur = [], []
    for nt in sorted(notes, key=lambda x: x["t"]):
        if cur and nt["t"] - (cur[-1]["t"] + cur[-1]["d"]) > gap:
            phrases.append(cur)
            cur = []
        cur.append(nt)
    if cur:
        phrases.append(cur)
    return phrases


def _log_chart(ctx, grid, nbars, chart_fn):
    for bar in range(nbars):
        for (b, c) in chart_fn(bar):
            t = grid.t(bar, b)
            if t < ctx.D:
                ctx.chords.append((t, c))
                ctx.note("chord", t, c.sym)


def _log_melody(ctx, notes, part="melody"):
    for nt in notes:
        if nt["t"] < ctx.D:
            ctx.melody.append((nt["t"], nt["d"], nt["m"]))
            ctx.note(part, nt["t"], f"{nname(nt['m'])} {nt['d']:.2f}s")


def _bars_needed(ctx, grid, extra=1):
    return int(math.ceil((ctx.D - grid.offset) / grid.bar_s)) + extra


# =============================================================================
# THE CHILL THEME (lounge / serene / sunset share it) -- D major
# =============================================================================
CHILL_CHART = ["Dmaj9", "E9/D", "Em9", "A13", "Dmaj9", "Gmaj9", "F#m7|B7b9", "Em9|A13"]
CHILL_A = ["0 F#5 1; 1.5 E5 1; 2.5 C#5 1.5",
           "0 G#5 1; 1.5 F#5 1; 2.5 D5 1.5",
           "0 G5 1; 1.5 F#5 1; 2.5 D5 1.5",
           "0 F#5 1; 1.5 E5 1; 2.5 C#5 1.5",
           "0 A5 1.5; 1.5 F#5 .5; 2 E5 2",
           "0 F#5 1.5; 1.5 D5 1; 2.5 B4 1.5",
           "0 A4 1; 1 C#5 .5; 1.5 E5 .5; 2 D#5 1; 3 C5 1",
           "0 B4 2; 2.5 C#5 .5; 3 E5 1"]
CHILL_A2 = CHILL_A[:4] + ["0 A5 1.5; 1.5 B5 .5; 2 A5 .5; 2.5 F#5 1.5",
                          "0 F#5 1; 1 E5 .5; 1.5 D5 1; 2.5 B4 1.5",
                          "0 C#5 1; 1 A4 1; 2 F#5 1; 3 D#5 1",
                          "0 G5 1.5; 1.5 F#5 .5; 2 E5 2"]


def style_lounge(ctx):
    g = _grid_for("lounge", ctx.D)
    nb = _bars_needed(ctx, g)
    rng = ctx.rng
    intro = 2

    def k_of(bar):
        return None if bar < intro else (bar - intro) % 24

    def chart(bar):
        k = k_of(bar)
        return bar_chords(CHILL_CHART[(bar if k is None else k) % 8])

    _log_chart(ctx, g, nb, chart)
    ctx.anchors.update(bpm=124, bar=g.bar_s, melody_in=g.t(intro, 0))

    # ---- melody (vibes) ----
    mel = []
    for bar in range(nb):
        k = k_of(bar)
        if k is None:
            continue
        if k < 8:
            spec, v = CHILL_A[k], 0.62
        elif k < 16:
            spec, v = CHILL_A2[k - 8], 0.6
        elif k == 20:
            spec, v = CHILL_A[0], 0.45
        elif k == 21:
            spec, v = "0 F#5 1; 1.5 E5 1; 2.5 B4 1.5", 0.42
        else:
            continue
        mel += _melody_to_phrases(ctx, g, bar, spec, vel=v)
    _log_melody(ctx, mel, "vibes")
    mel_t = [(nt["t"], nt["d"], nt["m"]) for nt in mel]
    ctx.part = "vibes"
    for i, nt in enumerate(mel):
        v = nt["v"] * (1.08 if g.t(*nt["beat"]) == g.t(nt["beat"][0], 0) else 1.0) + ctx.hum(0.03, 0.06)
        x, res = vibes_note(nt["m"], v, nt["d"] + 1.2)
        y = release_tail(x, nt["d"] + 0.15, 0.35)
        y = y * am_lfo(len(y), nt["t"], 5.3, 0.22)
        ctx.place(y, nt["t"] + ctx.hum(0.004), 0.55 * res, 0.22, 0.32)

    # ---- Rhodes pads with bossa anticipations ----
    segs = []
    for bar in range(nb):
        for (b, c) in chart(bar):
            segs.append([bar * 4 + b, c])
    strikes = []
    for i, (beat, c) in enumerate(segs):
        st = beat
        if i > 0 and beat % 4 == 0 and segs[i - 1][1].sym != c.sym and rng.random() < 0.55:
            st = beat - 0.5
        strikes.append((st, c))
    prev = None
    ctx.part = "rhodes"
    for i, (st, c) in enumerate(strikes):
        en = strikes[i + 1][0] if i + 1 < len(strikes) else st + 4
        t = g.t(0, st)
        if t > ctx.D:
            break
        dur = g.t(0, en) - t - 0.05
        v = voice(c.comp, 52, 70, prev, center=61, avoid=sounding(mel_t, t, t + dur))
        prev = v
        for j, m in enumerate(v):
            vel = 0.36 + 0.05 * (j == len(v) - 1) + ctx.hum(0.03, 0.05)
            x, res = rhodes_note(m, vel, dur + 0.8)
            y = release_tail(x, dur, 0.18)
            place_autopan(ctx, y, t + 0.007 * j + ctx.hum(0.003), 0.42 * res, -0.15, 0.22, rate=3.1, depth=0.3)

    # ---- nylon guitar bossa comp + thumb ----
    gprev = None
    ctx.part = "guitar"
    for bar in range(nb):
        hits = [0, 1.5, 3] if bar % 2 == 0 else [1, 2.5]
        cb = chart(bar)
        for h in hits:
            c = chord_at(cb, h)
            t = g.t(bar, h)
            if t > ctx.D:
                break
            nxt = [x for x in hits if x > h]
            dur = g.d(bar, h, min(1.2, (nxt[0] - h) if nxt else 1.0))
            v = voice(c.comp, 52, 71, gprev, center=63, max_span=14, avoid=sounding(mel_t, t, t + dur))
            gprev = v
            for j, m in enumerate(v[-3:]):
                play(ctx, nylon_note, t + 0.004 * j + ctx.hum(0.003), m, 0.42 + ctx.hum(0.04, 0.08), dur,
                     rel=0.08, gain=0.8, pan=-0.35, send=0.18)
        for h in (0, 2):
            c = chord_at(cb, h)
            ref = 45
            # thumb: the bass note, then the chord's *own* fifth (B for E9/D -- never bass + 7)
            m = nearest(c.bass if h == 0 or len(cb) > 1 else c.fifth, ref, 40, 52)
            play(ctx, nylon_note, g.t(bar, h) + ctx.hum(0.003), m, 0.38, g.d(bar, h, 1.8), rel=0.15,
                 gain=0.42, pan=-0.3, send=0.12)

    # ---- upright bass: bossa surdo pattern ----
    ctx.part = "bass"
    last = 38
    for bar in range(nb):
        cb = chart(bar)
        # surdo pattern on the bass note and the chord's own fifth (slash chords: E9/D takes
        # D and B -- an A would rub against the G#)
        if len(cb) == 1:
            c = cb[0][1]
            r = c.bass
            f = c.fifth
            pat = [(0, r, 1.35, 0.85), (1.5, r, 0.42, 0.45), (2, f, 1.35, 0.75), (3.5, f, 0.42, 0.4)]
        else:
            c1, c2 = cb[0][1], cb[1][1]
            pat = [(0, c1.bass, 1.35, 0.85), (1.5, c1.fifth, 0.42, 0.45),
                   (2, c2.bass, 1.35, 0.8), (3.5, c2.fifth, 0.42, 0.4)]
        for (b, pc, d, v) in pat:
            m = nearest(pc, last if b in (1.5, 3.5) else 38, 33, 50)
            last = m
            play(ctx, upright_note, g.t(bar, b) + ctx.hum(0.004), m, v + ctx.hum(0.03, 0.05), g.d(bar, b, d),
                 rel=0.07, gain=0.5, pan=0.0, send=0.06)

    # ---- percussion: shaker 16ths, rim clave, soft kick ----
    ctx.part = "perc"
    acc = [0.55, 0.22, 0.38, 0.28]
    for bar in range(nb):
        for i in range(16):
            b = i * 0.25
            x, res = shaker(acc[i % 4] + ctx.hum(0.04, 0.08), variant=int(rng.integers(3)))
            ctx.place(x, g.t(bar, b) + ctx.hum(0.004), 0.42 * res, 0.5, 0.08)
        for h in ([0, 1.5, 3] if bar % 2 == 0 else [1, 2.5]):
            x, res = rim(0.5 + ctx.hum(0.05, 0.1), variant=int(rng.integers(3)))
            ctx.place(x, g.t(bar, h) + ctx.hum(0.003), 0.3 * res, -0.25, 0.15)
        for h in (0, 2):
            x, res = kick(0.4, "soft")
            ctx.place(x, g.t(bar, h), 0.22 * res, 0.0, 0.0)
    return make_ir(1.7, 0.02, 0.55, seed=11)


# =============================================================================
# shared jazz machinery
# =============================================================================
def walk_bass(chords, rng, start=41, lo=28, hi=50):
    """Walking bass, one note per beat. chords: list (per beat) of Chord."""
    out = []
    cur = start
    nb = len(chords)
    starts = [i == 0 or chords[i] is not chords[i - 1] or i % 4 == 0 for i in range(nb)]
    for i in range(nb):
        c = chords[i]
        if starts[i]:
            m = nearest(c.bass, cur, lo, hi)
            if m == cur and i > 0:
                alt = [x for x in (m - 12, m + 12) if lo <= x <= hi]
                m = min(alt, key=lambda x: abs(x - 38)) if alt and rng.random() < 0.5 else m
            out.append(m)
            cur = m
            continue
        j = next((k for k in range(i + 1, nb) if starts[k]), None)
        if j is None:
            tgt = cur
        else:
            tgt = nearest(chords[j].bass, cur, lo, hi)
        if j == i + 1:
            # approach note into the next chord root
            r = rng.random()
            if r < 0.6:
                m = tgt - 1 if cur < tgt else tgt + 1
            elif r < 0.85:
                m = tgt + 1 if cur < tgt else tgt - 1
            else:
                m = tgt + 7 if tgt + 7 <= hi else tgt - 5
            if m == cur:
                m = tgt - 1 if m != tgt - 1 else tgt + 1
        else:
            # passing chord tone, heading for the target
            pcs = c.tones
            cands = []
            for pc in pcs:
                for mm in range(lo, hi + 1):
                    if mm % 12 == pc and 1 <= abs(mm - cur) <= 7:
                        cands.append(mm)
            steps_left = j - i if j is not None else 2
            ideal = cur + (tgt - cur) / (steps_left + 1) if j is not None else cur + rng.choice([-3, 3])
            if cur > hi - 5:
                ideal = cur - 4
            if cur < lo + 4:
                ideal = cur + 4
            m = min(cands, key=lambda x: abs(x - ideal) + 0.3 * rng.random()) if cands else cur + 2
        m = int(np.clip(m, lo, hi))
        out.append(m)
        cur = m
    return out


def jazz_articulate(notes, rng, chorus=0):
    """Trad-jazz clarinet phrasing: legato swing eighths, scoops, vibrato on long notes."""
    for i, nt in enumerate(notes):
        bar, b = nt["beat"]
        off = abs((b % 1.0) - 0.5) < 1e-6
        nxt = notes[i + 1] if i + 1 < len(notes) else None
        if nxt is not None and nxt["t"] - (nt["t"] + nt["d"]) < 0.06:
            nt["d"] = nxt["t"] - nt["t"]  # legato
        else:
            nt["d"] *= 0.94
        prev = notes[i - 1] if i > 0 else None
        if prev is not None and abs(prev["t"] + prev["d"] - nt["t"]) < 0.01 and not off:
            nt["slur"] = True
        nt["v"] = nt.get("v", 0.8) + (0.06 if off else 0.0) + float(rng.normal(0, 0.03))
        if nt["d"] > 0.55:
            if rng.random() < 0.65:
                nt["scoop"] = 0.5 + 0.4 * rng.random()
                nt["scoop_t"] = 0.07 + 0.04 * rng.random()
            nt["swell"] = 0.12
            nt["vib"] = 26.0 + 8 * rng.random()
    return notes


def jazz_grace(notes, rng, prob=0.4):
    """Chorus-2 ornamentation: chromatic grace notes into long notes."""
    out = []
    for nt in notes:
        if nt["d"] > 0.5 and rng.random() < prob and not nt.get("gliss"):
            g = dict(nt)
            g["m"] = nt["m"] - (1 if rng.random() < 0.6 else 2)
            g["d"] = 0.07
            g["t"] = nt["t"] - 0.07
            g.pop("vib", None)
            g.pop("scoop", None)
            out.append(g)
            nt = dict(nt)
            nt["slur"] = True
        out.append(nt)
    return out


JAZZ_CHART = ["F6", "D7", "G7", "C7", "F6", "Bb6|Bdim7", "F/C|D7", "G7|C7",
              "F6", "D7", "G7", "C7", "Bb6|Bbm6", "F/C|D7", "G7|C7", "F6|C7"]
_JM = ["0 A4 .5; .5 C5 .5; 1 D5 .5; 1.5 F5 2; 3.5 E5 1",
       ".5 Eb5 .5; 1 D5 2; 3.5 F#4 .5",
       "0 G4 .5; .5 B4 .5; 1 D5 .5; 1.5 F5 2; 3.5 E5 1",
       ".5 Eb5 .5; 1 D5 1; 2 Bb4 .5; 2.5 B4 .5; 3 C5 .5; 3.5 C#5 .5"]
JAZZ_MEL = _JM + ["0 D5 1; 1 F5 1; 2 A5 2",
                  "0 G5 .5; .5 F5 .5; 1 D5 1; 2 Ab4 .5; 2.5 B4 .5; 3 D5 .5; 3.5 F5 .5",
                  "0 A5 1; 1 G5 .5; 1.5 F5 .5; 2 F#5 .5; 2.5 A5 .5; 3 C6 .5; 3.5 A5 .5",
                  "0 G5 .5; .5 F5 .5; 1 D5 .5; 1.5 B4 .5; 2 C5 1; 3.5 G#4 .5"] + _JM + \
           ["0 D5 1; 1 F5 .5; 1.5 Bb5 1; 2.5 G5 .5; 3 F5 .5; 3.5 Db5 .5",
            "0 C5 1.5; 2 A4 .5; 2.5 C5 .5; 3 Eb5 .5; 3.5 D5 .5",
            "0 F5 1; 1 D5 .5; 1.5 B4 .5; 2 Bb4 .5; 2.5 C5 .5; 3 E5 .5; 3.5 G5 .5",
            "0 F5 2; 3.5 G#4 .5"]
JAZZ_FILLS = {1: "2 A5 .5; 2.5 F#5 .5; 3 C6 .5", 9: "2 A5 .5; 2.5 F#5 .5; 3 C6 .5",
              7: "2.5 E5 .5; 3 G5 .5", 15: "2 C6 .5; 2.5 A5 .5; 3 G5 .5"}
JAZZ_PICKUP = "3.5 G#4 .5"


def _jazz_band(ctx, g, bars, full=False):
    """bars: list of (bar_index, chart_spec, melody_spec_or_None, fill_spec_or_None, flags).
    Renders clarinet, piano, walking bass, drums (+ trombone & banjo when full)."""
    rng = ctx.rng
    beats = []
    for (bar, spec, mel, fill, fl) in bars:
        cb = bar_chords(spec)
        for k in range(4):
            beats.append((bar, k, chord_at(cb, k), fl))
        for (b, c) in cb:
            t = g.t(bar, b)
            if t < ctx.D:
                ctx.chords.append((t, c))
                ctx.note("chord", t, c.sym)
    # ---------------- clarinet ----------------
    notes = []
    for (bar, spec, mel, fill, fl) in bars:
        if mel:
            chorus = fl.get("chorus", 0)
            ns = _melody_to_phrases(ctx, g, bar, mel, vel=0.8 + 0.05 * full)
            for nt in ns:
                nt["chorus"] = chorus
            notes += ns
    notes.sort(key=lambda x: x["t"])
    notes = [nt for nt in notes if nt["t"] < ctx.D + 0.05]
    extra = getattr(ctx, "extra_clar", [])
    notes = jazz_articulate(notes, rng)
    for i, nt in enumerate(notes):
        if nt.get("chorus", 0) % 2 == 1:
            notes[i]["orn"] = True
    orn = [nt for nt in notes if nt.get("orn")]
    if orn:
        notes = [nt for nt in notes if not nt.get("orn")] + jazz_grace(orn, rng)
        notes.sort(key=lambda x: x["t"])
    notes = notes + extra
    notes.sort(key=lambda x: x["t"])
    _log_melody(ctx, notes, "clarinet")
    mel_t = [(nt["t"], nt["d"], nt["m"]) for nt in notes]
    ctx.part = "clarinet"
    for ph in _split_phrases(notes, gap=0.3):
        t0, y = clarinet_phrase(ph, rng, vib_depth=24.0, bright=0.8 + 0.1 * full)
        ctx.place(y, t0, 0.62, 0.06, 0.26)
    # ---------------- piano: stride oom-pah + fills ----------------
    ctx.part = "piano"
    prev = None
    for (bar, k, c, fl) in beats:
        if fl.get("tacet_comp") or k >= fl.get("stop_at", 9):
            continue
        t = g.t(bar, k) + ctx.hum(0.006)
        if t > ctx.D:
            break
        if t < -0.02:   # pickup bar: nothing that would start before the cue does
            continue
        if k in (0, 2):
            m = nearest(c.bass if k == 0 else (c.fifth if c.bass == c.root else c.bass), 40, 36, 50)
            for mm in (m, m + 12) if full else (m + 12,):
                play(ctx, piano_note, t, mm, 0.42 + ctx.hum(0.03, 0.05), g.beat_s * 0.8, rel=0.12,
                     gain=0.5, pan=-0.3, send=0.15, length=1.5, tone=0.6)
        else:
            v = voice(c.comp, 53, 70, prev, center=61,
                      avoid=sounding(mel_t, t, t + g.beat_s * 0.42, min_d=0.2, min_ov=0.06))
            prev = v
            for j, mm in enumerate(v):
                play(ctx, piano_note, t + 0.004 * j, mm, 0.48 + ctx.hum(0.04, 0.06), g.beat_s * 0.42,
                     rel=0.1, gain=0.42, pan=-0.2 + 0.03 * j, send=0.15, length=1.5, tone=0.6)
    for (bar, spec, mel, fill, fl) in bars:
        if fill:
            for nt in _melody_to_phrases(ctx, g, bar, fill, vel=0.55):
                for mm, gn in ((nt["m"], 0.42), (nt["m"] - 12, 0.3)):
                    play(ctx, piano_note, nt["t"] + ctx.hum(0.004), mm, 0.55, nt["d"] * 0.9, rel=0.12,
                         gain=gn, pan=-0.15, send=0.2, length=1.5, tone=0.7)
    # ---------------- walking bass ----------------
    ctx.part = "bass"
    line = walk_bass([b[2] for b in beats], rng, start=41)
    for (bar, k, c, fl), m in zip(beats, line):
        if fl.get("no_walk") or k >= fl.get("stop_at", 9):
            continue
        t = g.t(bar, k) + ctx.hum(0.004)
        if t < -0.02:
            continue
        v = (0.78 if k in (0, 2) else 0.68) + ctx.hum(0.03, 0.05)
        play(ctx, upright_note, t, m, v, g.beat_s * 0.92, rel=0.06, gain=0.62, pan=0.05, send=0.08,
             variant=int(rng.integers(2)))
    # ---------------- drums ----------------
    ctx.part = "drums"
    for (bar, k, c, fl) in beats:
        if fl.get("no_drums") or k >= fl.get("stop_at", 9):
            continue
        t = g.t(bar, k)
        if t > ctx.D:
            break
        if t < -0.02:
            continue
        # ride: 1, 2, 2a, 3, 4, 4a
        for (b, v) in ((0, 0.45), (0.5, 0.38)) if k in (1, 3) else ((0, 0.42),):
            x, res = ride(v + ctx.hum(0.03, 0.05), variant=int(rng.integers(3)))
            ctx.place(x, g.t(bar, k + b) + ctx.hum(0.003), (0.55 if full else 0.48) * res, 0.4, 0.12)
        if full:
            if k in (1, 3):
                x, res = snare(0.42 + ctx.hum(0.04, 0.06), "stick", variant=int(rng.integers(3)))
                ctx.place(x, t + ctx.hum(0.003), 0.36 * res, -0.1, 0.12)
        else:
            x, res = brush_swish(g.beat_s * 0.95, variant=int(rng.integers(4)))
            ctx.place(x, t, 0.55 * res, -0.15 + 0.1 * (k % 2), 0.1)
            if k in (1, 3):
                x, res = brush_tap(0.62 + ctx.hum(0.04, 0.06), variant=int(rng.integers(3)))
                ctx.place(x, t + ctx.hum(0.003), 0.6 * res, -0.1, 0.12)
        if k in (1, 3):
            x, res = hat(0.5, "chick", variant=int(rng.integers(3)))
            ctx.place(x, t + 0.004, 0.45 * res, 0.3, 0.05)
        x, res = kick(0.3, "soft")
        ctx.place(x, t, (0.25 if not full else 0.35) * res, 0.0, 0.0)
    if full:
        # ---------------- banjo: four to the bar ----------------
        ctx.part = "banjo"
        bprev = None
        for (bar, k, c, fl) in beats:
            if fl.get("tacet_comp") or k >= fl.get("stop_at", 9):
                continue
            t = g.t(bar, k)
            if t > ctx.D:
                break
            if t < -0.02:
                continue
            v = voice(c.comp, 55, 71, bprev, center=63, max_span=15,
                      avoid=sounding(mel_t, t, t + g.beat_s * 0.6, min_d=0.2, min_ov=0.06))
            bprev = v
            for j, mm in enumerate(v):
                play(ctx, banjo_note, t + 0.006 * j + ctx.hum(0.003), mm, (0.6 if k in (1, 3) else 0.5),
                     g.beat_s * 0.6, rel=0.06, gain=0.55, pan=0.42, send=0.15, variant=j % 2)
        # ---------------- trombone: tailgate guide tones ----------------
        ctx.part = "trombone"
        tprev = 53
        segs = []
        for (bar, spec, mel, fill, fl) in bars:
            if fl.get("tacet_comp"):
                continue
            for (b, c) in bar_chords(spec):
                if b < fl.get("stop_at", 9):
                    segs.append((bar, b, c, min(4.0 / len(bar_chords(spec)), fl.get("stop_at", 9) - b)))
        for (bar, b, c, d) in segs:
            t = g.t(bar, b)
            if t > ctx.D:
                break
            if t < -0.02:
                continue
            guide = [c.third] + [x for x in c.tones if (x - c.root) % 12 in (10, 9, 11)]
            m = min((nearest(pc, tprev, 46, 60) for pc in guide), key=lambda x: abs(x - tprev))
            sc = 2.5 if (rng.random() < 0.35 and d >= 4) else 0.4
            y = brass_note(m, g.beat_s * d * 0.92, 0.55, "trombone", voices=1, seed=bar, scoop=sc)
            ctx.place(y, t + ctx.hum(0.006), 0.42, 0.25, 0.25)
            tprev = m


def style_jazz_title(ctx):
    if ctx.hit is not None:          # title-card length (or an explicit hit_at): tune + tag + button
        return _jazz_with_ending(ctx, "jazz_title", full=False)
    g = _grid_for("jazz_title", ctx.D)
    nb = _bars_needed(ctx, g)
    bars = [(-1, "C7", JAZZ_PICKUP, None, dict(no_walk=True, tacet_comp=True, no_drums=True))]
    for bar in range(nb):
        k = bar % 16
        bars.append((bar, JAZZ_CHART[k], JAZZ_MEL[k], JAZZ_FILLS.get(k), dict(chorus=bar // 16)))
    _jazz_band(ctx, g, bars, full=False)
    # pickup fill on brushes
    ctx.part = "drums"
    for i, b in enumerate((3.0, 3.333, 3.667)):
        x, res = brush_tap(0.45 + 0.12 * i, variant=i)
        ctx.place(x, g.t(-1, 0) + b * g.beat_s, 0.6 * res, -0.1, 0.12)
    ctx.anchors.update(bpm=116, bar=g.bar_s, first_downbeat=g.t(0, 0),
                       bars=[g.t(b, 0) for b in range(nb) if g.t(b, 0) < ctx.D])
    return make_ir(1.15, 0.012, 0.5, seed=21, er_gain=0.7)


TAG_T1 = "0 D5 .5; .5 F5 .5; 1 Bb5 1; 2 Ab5 1; 3 F5 .5; 3.5 D5 .5"
TAG_T2 = "0 C5 4"
TAG_SHORT = "0 F5 1; 1 D5 .5; 1.5 B4 .5; 2 C5 2"


def _jazz_end_plan(H):
    """Pick a tempo so the final button lands on a downbeat with a short pickup."""
    best = None
    for bpm in range(100, 133):
        bar_s = 240.0 / bpm
        B = H / bar_s
        whole = int(math.floor(B + 1e-9))
        frac = B - whole
        cost = abs(bpm - 116) * 0.15 + (frac * 2 if frac <= 0.5 else 10 + frac)
        if whole < 1:
            cost += 5
        if best is None or cost < best[0]:
            best = (cost, bpm, whole, frac)
    return best[1:]


def _ending_hit(style, duration, hit_at=None, tail=None):
    """Time (s) of the final button for cues that compose their own ending, else None."""
    if style not in ENDING_TAIL:
        return None
    duration = float(max(0.05, duration))
    if hit_at is not None:
        return float(np.clip(hit_at, 0.05, duration))
    if style == "jazz_title" and duration > JAZZ_TITLE_TAG_MAX:
        return None                   # long title bed: loops like the other cues
    lead = ENDING_LEAD[style]
    tl = ENDING_TAIL[style] if tail is None else max(0.0, float(tail))
    H = duration - tl - lead
    if H < 0.5 * duration:            # too short for the overhang to make sense
        H = max(0.5 * duration, duration - lead)
    return float(np.clip(H, 0.05, duration))


def _ending_cut(style, duration, hit_at=None, tail=None):
    """Where the picture ends inside a composed-ending render (s): duration - tail, i.e. the
    part of the render build_audio adds past the picture is excluded.  With an explicit
    hit_at and no tail, or when the render is too short for the default overhang, the whole
    render is 'picture'."""
    duration = float(max(0.05, duration))
    H = _ending_hit(style, duration, hit_at, tail)
    if H is None:
        return duration
    if hit_at is not None:
        tl = 0.0 if tail is None else max(0.0, float(tail))
    else:
        tl = ENDING_TAIL[style] if tail is None else max(0.0, float(tail))
        if duration - tl - ENDING_LEAD[style] < 0.5 * duration:   # _ending_hit's short fallback
            tl = 0.0
    return float(min(duration, max(H + 0.12, duration - tl)))


def _final_hit(duration, hit_at=None, tail=None):
    """jazz_end's button time (kept for backward compatibility)."""
    return _ending_hit("jazz_end", duration, hit_at, tail)


def _grid_for(style, duration, hit_at=None, seed=0, tail=None):
    """The time grid each cue is composed on (shared by render and music_anchors)."""
    if style == "lounge":
        return Grid(124, swing=0.5)
    if style in ("jazz_title", "jazz_end"):
        H = _ending_hit(style, duration, hit_at, tail)
        if H is None:
            g = Grid(116, swing=0.64)
            g.offset = g.beat_s  # one-beat pickup
            g.whole, g.hit = None, None
            return g
        bpm, whole, frac = _jazz_end_plan(H)
        g = Grid(bpm, swing=0.64)
        g.offset = H - whole * g.bar_s  # bar `whole` downbeat == the button
        g.whole, g.hit = whole, H
        return g
    if style == "tension":
        return Grid(92, swing=0.5)
    if style == "therapy":
        return Grid(64, swing=0.5, rubato=_therapy_rubato_fn(seed), bars=int(duration / 3.0) + 8)
    if style == "montage":
        return Grid(128, swing=0.54)
    if style == "serene":
        return Grid(60, swing=0.5)
    if style == "action":
        return Grid(150, swing=0.5)
    if style == "sunset":
        return Grid(72, swing=0.5)
    raise ValueError(style)


MELODY_IN_BAR = {"lounge": 2, "jazz_title": 0, "jazz_end": 0, "tension": 0, "therapy": 0, "montage": 1,
                 "serene": 1, "action": 0, "sunset": 2}

JAZZ_BAND_CEILING = 0.76   # jazz_end: the band is limited lower so the button is the cue's true peak


def _jazz_tag_form(whole):
    """How many tune bars (K) precede a 1- or 2-bar tag, given `whole` bars before the button."""
    if whole <= 0:
        return 0, 0
    if whole == 1:
        return 0, 1
    K = whole - 1
    last = JAZZ_CHART[(K - 1) % 16].split("|")[-1]
    if last.startswith(("D7", "F6", "G7", "Bdim7", "Bbm6")):
        return K, 1                     # ... -> G7|C7 (stop) -> F
    return whole - 2, 2                 # after C7: Bb6|Bdim7 -> F/C|C7 (stop) -> F


def _jazz_with_ending(ctx, style, full):
    """Title tune for as many bars as fit, a stop-time tag and a 'ba-DUM' button landing at
    ctx.hit.  full=True: the end-titles band (banjo, trombone, sticks) and a BIG button;
    full=False: the title trio (clarinet, piano, bass, brushes) and a light button."""
    H = ctx.hit
    g = _grid_for(style, ctx.D, ctx.hit_at, ctx.seed, ctx.tail)
    bpm, whole = g.bpm, g.whole
    K, ntag = _jazz_tag_form(whole)
    bars = []
    if g.offset > 0.12:
        bars.append((-1, "C7", JAZZ_PICKUP if K > 0 else None, None,
                     dict(no_walk=K == 0, tacet_comp=g.offset < g.bar_s * 0.6, no_drums=True)))
    for k in range(K):
        bars.append((k, JAZZ_CHART[k % 16], JAZZ_MEL[k % 16], JAZZ_FILLS.get(k % 16), dict(chorus=k // 16)))
    if ntag == 2:
        prevc = JAZZ_CHART[(K - 1) % 16].split("|")[-1] if K > 0 else "F6"
        t1 = "Gm7|Bdim7" if prevc.startswith("D7") else "Bb6|Bdim7"
        bars.append((K, t1, TAG_T1, None, dict()))
        bars.append((K + 1, "F/C|C7", TAG_T2, None, dict(stop_at=2)))
    elif ntag == 1:
        spec = "G7|C7" if K > 0 else "F/C|C7"
        bars.append((K, spec, TAG_SHORT if K > 0 else TAG_T2, None, dict(stop_at=2)))
    if ntag >= 1:
        if full:   # clarinet rip from the held C up to high F, landing on the button
            ctx.extra_clar = [dict(t=H, d=0.3, m=N("F6"), v=0.98, gliss=True, glide=g.beat_s * 1.9,
                                   slur=True, release=0.12, beat=(whole, 0))]
        else:      # a neat little scoop onto F
            ctx.extra_clar = [dict(t=H, d=0.34, m=N("F5"), v=0.86, scoop=0.8, scoop_t=0.07,
                                   release=0.12, beat=(whole, 0))]
    _jazz_band(ctx, g, bars, full=full)
    if g.offset > 0.25 and K > 0:
        ctx.part = "drums"
        for i, b in enumerate((3.0, 3.333, 3.667)):
            if full:
                x, res = snare(0.35 + 0.15 * i, "stick", variant=i)
                ctx.place(x, g.t(-1, 0) + b * g.beat_s, 0.4 * res, -0.1, 0.15)
            else:
                x, res = brush_tap(0.45 + 0.12 * i, variant=i)
                ctx.place(x, g.t(-1, 0) + b * g.beat_s, 0.6 * res, -0.1, 0.12)

    tlast = g.t(whole - 1, 0) if whole >= 1 else max(0.0, H - g.bar_s)   # stop-time bar downbeat
    tb = g.t(whole - 1, 2) if whole >= 1 else max(0.0, H - 2 * g.beat_s)  # the hold (beat 3)
    tba = H - g.beat_s * (1 - 0.64)                                      # swung and-of-4: "ba"
    # ---- stop-time bar: the band drops (subito piano), then crescendos back into the button
    if whole >= 1 and ntag:
        duck = -5.5 if full else -3.0
        pre = [(tlast - g.bar_s * 0.75, 0.0), (tlast - 0.1, -1.5)] if full else [(tlast - 0.1, 0.0)]
        ctx.automate(pre + [(tlast + 0.06, duck), (tb + 0.15, duck), (H - 0.02, 0.0 if full else -1.0)])
    ctx.part = "ending"
    c7 = C("C7")
    c7v = voice(c7.comp, 55, 72, None, center=63)
    if ntag >= 1 and tba - tb > 0.2:
        # hold chord on beat 3 + a roll that really crescendos (-15 dB -> 0 dB)
        for j, m in enumerate(c7v):
            play(ctx, piano_note, tb + 0.006 * j, m, 0.5, g.beat_s * 1.3, rel=0.1, gain=0.34 if full else 0.3,
                 pan=-0.2, send=0.2, length=2.0, tone=0.6)
        play(ctx, upright_note, tb, N("C2"), 0.7, g.beat_s * 1.4, rel=0.06, gain=0.55)
        if full:
            y = brass_note(N("E3"), g.beat_s * 1.4, 0.6, "trombone", voices=1, seed=99, scoop=1.5)
            y = y * np.linspace(0.45, 1.25, len(y), dtype=F32)        # swell
            ctx.place(y, tb, 0.45, 0.25, 0.25)
        span = tba - 0.03 - tb
        n_roll = max(3, int(span / (0.045 if full else 0.06)))
        ctx.part = "roll"
        for i in range(n_roll):
            x01 = i / max(1, n_roll - 1)
            db = -15.0 + 15.0 * x01 ** 1.2
            if full:
                x, res = snare(0.3 + 0.55 * x01, "stick", variant=i % 3)
                ctx.place(x, tb + span * i / n_roll + ctx.hum(0.003, 0.006), 0.5 * res * db2lin(db),
                          -0.1 + 0.05 * (i % 2), 0.15)
            else:
                x, res = brush_tap(0.35 + 0.5 * x01, variant=i % 3)
                ctx.place(x, tb + span * i / n_roll + ctx.hum(0.003, 0.006), 0.75 * res * db2lin(db),
                          -0.1 + 0.05 * (i % 2), 0.12)
    ctx.part = "ending"
    if H > 0.25 and ntag >= 1:
        # "ba" -- the and-of-4 pickup hit
        for j, m in enumerate(c7v):
            play(ctx, piano_note, tba + 0.004 * j, m, 0.65, 0.12, rel=0.06, gain=0.34 if full else 0.28,
                 pan=-0.2, send=0.2, length=1.0, tone=0.8)
        play(ctx, upright_note, tba, N("C2"), 0.75, 0.15, rel=0.05, gain=0.5)
        if full:
            for j, m in enumerate((N("E3"), N("G3"), N("Bb3"), N("C4"))):
                play(ctx, banjo_note, tba + 0.006 * j, m, 0.75, 0.12, rel=0.05, gain=0.5, pan=0.42, send=0.15,
                     variant=j % 2)
            x, res = snare(0.75, "stick", 1)
            ctx.place(x, tba, 0.42 * res, -0.1, 0.15)
            x, res = kick(0.6, "hard")
            ctx.place(x, tba, 0.35 * res, 0.0, 0.0)
        else:
            x, res = brush_tap(0.8, variant=1)
            ctx.place(x, tba, 0.7 * res, -0.1, 0.12)
            x, res = kick(0.45, "soft")
            ctx.place(x, tba, 0.3 * res, 0.0, 0.0)
    # ---- THE BUTTON ("DUM") ----
    ctx.chords.append((H, C("F6")))
    ctx.note("chord", H, "F6 (button)")
    if full:
        F6v = [N("A4"), N("C5"), N("D5"), N("F5"), N("A5")]
        # a dense, sustained tutti (loud for its peak) rather than one huge transient
        for j, m in enumerate([N("F2"), N("F3")] + F6v + [N("F6")]):
            play(ctx, piano_note, H + 0.003 * j, m, 1.0, 0.42, rel=0.12, gain=0.72, pan=-0.25 + 0.06 * j,
                 send=0.25, length=1.0, tone=0.85)
        play(ctx, upright_note, H, N("F1"), 1.0, 0.45, rel=0.08, gain=0.9)
        play(ctx, upright_note, H + 0.004, N("F2"), 0.9, 0.45, rel=0.08, gain=0.5)
        for j, m in enumerate([N("F3"), N("A3"), N("D4"), N("F4"), N("A4")]):
            play(ctx, banjo_note, H + 0.007 * j, m, 1.0, 0.42, rel=0.08, gain=0.85, pan=0.42, send=0.2,
                 variant=j % 2)
        for m, gn, pn, sd in ((N("F3"), 0.95, 0.25, 7), (N("A3"), 0.7, 0.12, 8), (N("C4"), 0.62, 0.35, 9)):
            y = brass_note(m, 0.44, 0.95, "trombone", voices=1, seed=sd, scoop=0.5)
            ctx.place(y, H + 0.003 * (sd - 7), gn, pn, 0.3)
        x, res = kick(1.0, "hard")
        ctx.place(x, H, 0.85 * res, 0.0, 0.05)
        x, res = snare(1.0, "stick", 2)
        ctx.place(x, H, 0.6 * res, -0.1, 0.2)
        x, res = crash(1.0, 0)
        ctx.place(x, H, 0.8 * res, 0.35, 0.25)
        x, res = crash(0.8, 1)
        ctx.place(x, H + 0.004, 0.55 * res, -0.4, 0.25)
        # the band is limited lower than the button, so the button is the cue's true peak
        c = np.full(ctx.n, JAZZ_BAND_CEILING, dtype=np.float64)
        c[max(0, int((H - 0.006) * SR)):] = 0.89
        ctx.ceiling = c
    else:
        for j, m in enumerate([N("F2"), N("C3"), N("A4"), N("C5"), N("D5"), N("F5")]):
            play(ctx, piano_note, H + 0.004 * j, m, 0.8, 0.28, rel=0.12, gain=0.42, pan=-0.25 + 0.06 * j,
                 send=0.22, length=1.0, tone=0.7)
        play(ctx, upright_note, H, N("F2"), 0.95, 0.32, rel=0.08, gain=0.7)
        x, res = kick(0.75, "soft")
        ctx.place(x, H, 0.55 * res, 0.0, 0.05)
        x, res = brush_tap(1.0, variant=2)
        ctx.place(x, H, 0.85 * res, -0.1, 0.15)
        x, res = ride(0.7, variant=1)
        ctx.place(x, H, 0.5 * res, 0.4, 0.2)
    # ring-out.  jazz_end: the film ends at the picture cut, so the button is damped to
    # -45 dB *at the cut* (linear-in-dB = a natural, choked decay) and the overhang past the
    # picture is silent.  jazz_title: the overhang is build_audio's crossfade into the next
    # cue, so the button rings on through it, reaching -45 dB at the end of the render.
    cut = ctx.cut if full else ctx.D
    ctx.flush_parts()
    _ring_out(ctx, H + min(0.22, 0.45 * (cut - H)), cut, floor_db=45.0)
    ctx.anchors.update(bpm=bpm, bar=g.bar_s, final_hit=H, own_ending=True, first_downbeat=g.t(0, 0),
                       stop_time=tb, tag_bar=tlast, picture_cut=ctx.cut,
                       bars=[g.t(b, 0) for b in range(-1, whole + 1) if 0 <= g.t(b, 0) <= ctx.D])
    return make_ir(1.15, 0.012, 0.5, seed=21, er_gain=0.7)


def _ring_out(ctx, t0, t1, floor_db=45.0):
    """Schedule the ending's damping (applied by _master to the *mixed* signal, after the
    reverb, so the room tail dies with the band): from t0 an exponential (linear-in-dB)
    decay reaching -floor_db at t1, then a 15 ms cosine to true silence; zero after t1."""
    i0 = int(max(0.0, t0) * SR)
    i1 = int(min(ctx.D, max(t1, t0 + 0.02)) * SR)
    if i0 >= ctx.n:
        return
    i1 = min(i1, ctx.n)
    w = np.ones(ctx.n, dtype=np.float64)
    w[i0:] = 0.0
    k = i1 - i0
    if k > 0:
        x = np.arange(k) / k
        w[i0:i1] = 10.0 ** (-floor_db * x ** 1.3 / 20.0)   # damping firms up as it goes
        kf = min(k, int(0.015 * SR))
        w[i1 - kf:i1] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, kf))
    ctx.post_gain = w.astype(F32)


def style_jazz_end(ctx):
    return _jazz_with_ending(ctx, "jazz_end", full=True)


# =============================================================================
# TENSION -- comedic suspense: line-cliche pizzicato, drone, ticking clock
# =============================================================================
TENSION_CHART = ["Dm", "Dm(maj7)/C#", "Dm7/C", "Bm7b5", "Bbmaj7", "A7sus4|A7", "Dm", "A7b9"]
TENSION_UP = [("F4", "A4"), ("F4", "A4"), ("F4", "A4"), ("F4", "A4"), ("F4", "A4"),
              ("E4", "G4"), ("F4", "A4"), ("E4", "G4")]
# cello line: F (2 bars) -> D (2 bars, root of Dm7/C and 3rd of Bm7b5 -- an E here rubbed
# a semitone against the bassoon's / pizzicato's F) -> F (5th of Bbmaj7) -> D, C# -> D -> E
TENSION_CELLO = [[(0, "F3", 8)], [], [(0, "D3", 8)], [], [(0, "F3", 4)], [(0, "D3", 2), (2, "C#3", 2)],
                 [(0, "D3", 4)], [(0, "E3", 4)]]
TENSION_BASSOON = {2: "1 D3 .5; 1.5 E3 .5; 2 F3 .5; 3 E3 .5; 3.5 C3 .5",
                   3: "0 B2 1; 1.5 D3 .5; 2 F3 .5; 2.5 A3 .5; 3 G#3 .5; 3.5 A3 .5",
                   6: "1 A2 .5; 1.5 D3 .5; 2 F3 .5; 2.5 A3 1",
                   7: "0 G3 .5; .5 E3 .5; 1 C#3 .5; 1.5 Bb2 1; 3 A2 .5"}
RUB_IVS = (1, 13)          # minor 2nd / minor 9th: the intervals sustained parts must not hold


def rubs(m, t0, t1, book, min_ov=0.1, ivs=RUB_IVS, skip=None):
    """Entries of `book` [(t0, t1, midi, part)] overlapping [t0, t1] by >= min_ov seconds
    that make one of the intervals `ivs` (absolute semitones) with midi note m."""
    return [b for b in book if b[3] != skip and min(t1, b[1]) - max(t0, b[0]) >= min_ov
            and abs(m - b[2]) in ivs]


def safe_pitch(m, t0, t1, book, pcs, lo, hi, **kw):
    """m if it does not rub against `book` over [t0, t1], else the nearest pitch in [lo, hi]
    whose pitch class is in pcs and which does not; None if there is none."""
    if not rubs(m, t0, t1, book, **kw):
        return m
    cands = [x for x in range(lo, hi + 1) if x % 12 in pcs and not rubs(x, t0, t1, book, **kw)]
    return min(cands, key=lambda x: (abs(x - m), x)) if cands else None


def style_tension(ctx):
    g = _grid_for("tension", ctx.D)
    nb = _bars_needed(ctx, g)
    rng = ctx.rng

    def chart(bar):
        return bar_chords(TENSION_CHART[bar % 8])

    def tones_over(t0, t1):
        """Pitch classes common to every chord sounding over [t0, t1)."""
        pcs = None
        for bar in range(max(0, int((t0 - g.offset) // g.bar_s) - 1), nb + 1):
            for (b, c) in chart(bar):
                cs, ce = g.t(bar, b), g.t(bar, b + 4.0 / len(chart(bar)))
                if ce > t0 + 0.05 and cs < t1 - 0.05:
                    pcs = set(c.tones) if pcs is None else pcs & set(c.tones)
        return pcs or set()

    _log_chart(ctx, g, nb, chart)
    ctx.anchors.update(bpm=92, bar=g.bar_s)
    # Every sustained part goes into one book, in order of priority (bassoon tune, cello
    # line, drone, pizzicato); each later part is kept out of m2/m9 rubs with the earlier.
    book = []
    bassoon = {}
    for bar in range(2, nb):
        bs = TENSION_BASSOON.get(bar % 8)
        if not bs or g.t(bar, 0) > ctx.D:
            continue
        ns = _melody_to_phrases(ctx, g, bar, bs, vel=0.7)
        for nt in ns:
            nt["d"] = min(nt["d"], g.beat_s * 0.42) if nt["d"] < g.beat_s * 0.6 else nt["d"] * 0.9
            nt["release"] = 0.05
            book.append((nt["t"], nt["t"] + nt["d"] + 0.05, nt["m"], "bassoon"))
        bassoon[bar] = ns
    cello = []
    for bar in range(4, nb):
        for (b, nm, d) in TENSION_CELLO[bar % 8]:
            t0 = g.t(bar, b)
            if t0 > ctx.D:
                continue
            L = g.d(bar, b, d) * 0.97
            m = safe_pitch(N(nm), t0, t0 + L + 0.15, book, tones_over(t0, t0 + L), N("C3"), N("A3"))
            if m is not None:
                cello.append((t0, L, m))
                book.append((t0, t0 + L + 0.15, m, "cello"))
    drone = []
    for bar in range(0, nb, 2):
        k = bar % 8
        t0 = g.t(bar, 0)
        if t0 > ctx.D:
            break
        for m, gn in ((N("D2"), 0.55), (N("A2"), 0.22 if k != 4 else 0.0)):
            if gn == 0:
                continue
            L = g.bar_s * 2
            if rubs(m, t0, t0 + L + 0.3, book):
                L = g.bar_s            # re-bow after one bar instead of holding into the rub
                if rubs(m, t0, t0 + L + 0.3, book):
                    continue
            drone.append((t0, L, m, gn, k))
            book.append((t0, t0 + L + 0.3, m, "drone"))
    for (t0, L, m, gn, k) in drone:
        ctx.part = "drone"
        y = bowed_note(m, L, 0.6, "bass", attack=1.2, release=0.8, voices=3, vib=5.0, seed=k)
        ctx.place(y, t0, gn, 0.0, 0.15)
    for (t0, L, m) in cello:
        ctx.part = "cello"
        y = bowed_note(m, L, 0.55, "cello", attack=0.6, release=0.5, voices=2, vib=9.0, seed=int(m))
        ctx.place(y, t0, 0.36, -0.15, 0.3)
        ctx.note("cello", t0, f"{nname(m)} {L:.2f}s")

    for bar in range(nb):
        k = bar % 8
        cyc = bar // 8
        cb = chart(bar)
        t0 = g.t(bar, 0)
        if t0 > ctx.D:
            break
        # clock: tick-tock on every beat
        ctx.part = "clock"
        for b in range(4):
            x, res = woodblock(0.42 + 0.05 * (b % 2 == 0) + ctx.hum(0.02, 0.03), high=(b % 2 == 0),
                               variant=int(rng.integers(3)))
            ctx.place(x, g.t(bar, b), 0.32 * res, -0.35 if b % 2 == 0 else 0.35, 0.12)
        # pizzicato: bass line on 1 & 3, tiptoe chord tones on 2 & 4 ... and creeping pickups
        ctx.part = "pizz"
        c0 = cb[0][1]
        lb = nearest(c0.bass, N("C3"), N("A2"), N("D3"))
        up1, up2 = N(TENSION_UP[k][0]), N(TENSION_UP[k][1])
        # beat 3: the chord's own fifth (F over Bm7b5, A over Dm(maj7)/C#), never bass + 7
        fifth = nearest(c0.fifth, lb + 7, lb + 3, lb + 9)
        seq = [(0, lb, 0.75), (1, up1, 0.5), (2, fifth if fifth < up1 else fifth - 12, 0.55), (3, up2, 0.5)]
        if len(cb) > 1:
            seq[2] = (2, nearest(cb[1][1].bass, lb, N("G2"), N("D3")), 0.55)
        if bar == 0:
            seq = [seq[0], seq[2]]
        for (b, m, v) in seq:
            t = g.t(bar, b)
            c = chord_at(cb, b)
            # a pizz rings ~0.45 s: keep it out of m2/m9 rubs with the sustained parts
            m = safe_pitch(m, t - 0.03, t + 0.45, book, set(c.tones), m - 7, m + 7, skip="pizz")
            if m is None:
                continue
            book.append((t, t + 0.45, m, "pizz"))
            x, res = pizz_note(m, v + ctx.hum(0.04, 0.06), variant=int(rng.integers(2)))
            ctx.place(x, t + ctx.hum(0.006), 0.85 * res, -0.2 if m < 55 else 0.25, 0.25)
        if k in (3, 7) or (cyc > 0 and k == 5):
            # creeping chromatic pickup into the next bass note (a whole step if the half step
            # would ring against a sustained part entering on that note)
            nxt = nearest(chart(bar + 1)[0][1].bass, lb, N("A2"), N("D3"))
            tp = g.t(bar, 3.5)
            mp = next((x for x in (nxt - 1, nxt - 2) if not rubs(x, tp, tp + 0.45, book, skip="pizz")), None)
            if mp is not None:
                x, res = pizz_note(mp, 0.4)
                ctx.place(x, tp + ctx.hum(0.006), 0.7 * res, -0.2, 0.25)
        if bar >= 1 and k in (1, 3, 5, 7) and cyc >= 0:
            ctx.part = "timp"
            x, res = timpani(N("D2") if k != 7 else N("A1"), 0.32 + 0.05 * cyc)
            ctx.place(x, g.t(bar, 0), 0.45 * res, 0.0, 0.2)
        # high violins harmonic (second time round)
        if cyc >= 1 and k % 4 == 0:
            ctx.part = "violins"
            y = bowed_note(N("A5"), g.bar_s * 3.6, 0.35, "violin", attack=2.0, release=1.5, voices=4,
                           vib=4.0, seed=bar, bright=0.3)
            ctx.place(y, t0, 0.1, 0.3, 0.45)
        # sneaky staccato bassoon answers the pizzicato (bars 3-4 and 7-8 of the cycle)
        ns = bassoon.get(bar)
        if ns:
            ctx.part = "bassoon"
            _log_melody(ctx, ns, "bassoon")
            for ph_ in _split_phrases(ns, gap=0.6):
                t0b, yb = bassoon_phrase(ph_, rng)
                ctx.place(yb, t0b, 0.55, 0.15, 0.3)
        if k == 7:
            ctx.part = "glock"
            for m in (N("C#6"), N("G6")):   # the A7 tritone, resolving into the Dm
                x, res = glock_note(m, 0.4)
                ctx.place(release_tail(x, 0.6, 0.3), g.t(bar, 3.5), 0.12 * res, 0.4, 0.4)
    return make_ir(1.9, 0.02, 0.7, seed=31)


# =============================================================================
# THERAPY -- rubato solo clarinet + soft piano (G minor)
# =============================================================================
THERAPY_CHART = ["Gm", "Gm/F", "Ebmaj7", "D7sus4|D7", "Cm7", "F7", "Bbmaj7", "A7b5|D7",
                 "Gm", "Gm/F", "Em7b5", "A7b9", "Cm6", "D7b9", "Gm", "D7sus4|D7"]
# The clarinet sings 1-2 bar phrases and *breathes* (rests >= ~0.3 beat) between them; the
# piano answers in the clarinet's rests (bars 3, 6-7, 9 and 15 of the 16-bar form).
THERAPY_MEL = ["1 Bb4 .5; 1.5 C5 .5; 2 D5 1.55",
               "0 Eb5 1.5; 1.5 D5 .5; 2 Bb4 1; 3 A4 1",
               "0 G4 2.6",
               "3 D5 1",
               "0 Eb5 1.5; 1.5 D5 .5; 2 C5 1; 3 Bb4 .65",
               "0 A4 2.6",
               "",
               "",
               "0 Bb4 3",
               "",
               "1 G4 .5; 1.5 Bb4 .5; 2 D5 1; 3 E5 .65",
               "0 C#5 2; 2 Bb4 1; 3 A4 .65",
               "0 A4 1; 1 C5 .5; 1.5 Eb5 .5; 2 G5 1.6",
               "0 F#5 1; 1 Eb5 1; 2 C5 1; 3 A4 .65",
               "0 Bb4 2; 2 A4 .5; 2.5 G4 1.4",
               ""]
THERAPY_FILLS = {2: "3 Bb4 .5; 3.5 G4 .5", 5: "3 C5 .5; 3.5 Eb5 .5", 3: "0 A4 .5; .5 D5 .5; 1 G5 1; 2 F#5 1",
                 9: "0 D5 .5; .5 F5 .5; 1 A5 1.5; 2.5 G5 .5; 3 F5 1",
                 15: "0 G4 .5; .5 C5 .5; 1 D5 1; 2 C5 .5; 2.5 A4 .5; 3 F#4 1"}
# the piano takes the tune itself while the clarinet rests
THERAPY_PIANO_MEL = {6: "1 D5 .5; 1.5 F5 .5; 2 A5 2", 7: "0 G5 1.5; 1.5 Eb5 .5; 2 D5 1; 3 C5 1"}


def _therapy_rubato_fn(seed):
    """Seeded rubato: every 2-bar phrase gets its own tempo, push/pull (random phase),
    a ritardando into its last beat and sometimes a mid-phrase linger."""
    rng = rng_for("therapy-rubato", seed)
    P = 64
    base = rng.uniform(0.95, 1.05, P)
    amp = rng.uniform(0.02, 0.07, P)
    phs = rng.uniform(-1.6, 1.6, P)
    rit = rng.uniform(0.06, 0.2, P)
    pos = rng.uniform(0.86, 0.95, P)
    rit2 = rng.uniform(0.0, 0.11, P) * (rng.random(P) < 0.5)
    pos2 = rng.uniform(0.38, 0.5, P)

    def f(b):
        p = int(b // 8) % P
        x = (b % 8) / 8.0
        v = (base[p] * (1.0 + amp[p] * math.sin(TWO_PI * x + phs[p]))
             - rit[p] * math.exp(-((x - pos[p]) / 0.06) ** 2)
             - rit2[p] * math.exp(-((x - pos2[p]) / 0.05) ** 2))
        return max(v, 0.6)
    return f


def _phrase_arch(ph, base=0.5, rise=0.2, taper=0.45):
    """Phrase-level dynamics: crescendo to the phrase's peak note, diminuendo after it, and
    taper the last note away."""
    n = len(ph)
    if not n:
        return
    pk = max(range(n), key=lambda i: (ph[i]["m"] + 3.0 * min(ph[i]["d"], 1.5), -i))
    for i, nt in enumerate(ph):
        x = (i + 1) / (pk + 1) if i <= pk else 1.0 - (i - pk) / (n - pk)
        nt["v"] = base + rise * smoothstep(x) + nt.get("v_jit", 0.0)
    ph[-1]["taper"] = taper
    if n == 1:
        ph[0]["v"] = base + rise * 0.6


def style_therapy(ctx):
    g = _grid_for("therapy", ctx.D, seed=ctx.seed)
    nb = _bars_needed(ctx, g, extra=3)
    rng = ctx.rng

    def chart(bar):
        return bar_chords(THERAPY_CHART[bar % 16])

    _log_chart(ctx, g, nb, chart)
    ctx.anchors.update(bpm=64, bar=g.bar_s, rubato=True)
    # clarinet
    notes = []
    for bar in range(nb):
        spec = THERAPY_MEL[bar % 16]
        if spec:
            notes += _melody_to_phrases(ctx, g, bar, spec, vel=0.6)
    notes = [n for n in notes if n["t"] < ctx.D]
    for i, nt in enumerate(notes):
        nxt = notes[i + 1] if i + 1 < len(notes) else None
        if nxt is not None and nxt["t"] - (nt["t"] + nt["d"]) < 0.08:
            nt["d"] = nxt["t"] - nt["t"]
            nxt["slur"] = rng.random() < 0.7
        nt["v_jit"] = float(rng.normal(0, 0.02))
        nt["swell"] = 0.22 if nt["d"] > 0.9 else 0.0
        nt["vib"] = 12.0 if nt["d"] > 0.8 else 0.0
        nt["release"] = 0.22
        nt["attack"] = 0.06
    phrases = _split_phrases(notes, gap=0.2)
    for ph in phrases:
        _phrase_arch(ph, base=0.47, rise=0.2, taper=0.5)
    _log_melody(ctx, notes, "clarinet")
    ctx.part = "clarinet"
    for ph in phrases:
        t0, y = clarinet_phrase(ph, rng, vib_depth=12.0, vib_rate=5.0, bright=0.45, breath=0.05)
        ctx.place(y, t0, 0.55, 0.1, 0.32)
    tune = [(nt["t"], nt["d"], nt["m"]) for nt in notes]
    # ---- piano.  Played with the sustain pedal: every chord rings until the next chord
    # (pedal change ~0.1 s after it), the left hand re-strikes softly at mid-bar (half-pedal),
    # and the right hand's answers are pedalled legato.  The voicings keep clear of every
    # melody note sounding over them (no m2/m9 under the clarinet or the piano's own tune).
    ctx.part = "piano"
    TONE, LEN = 0.3, 8.0
    pmel = []      # the piano's own tune: (t, d, m, vel, is_answer)
    for bar in range(nb):
        if g.t(bar, 0) > ctx.D:
            break
        k = bar % 16
        fill = THERAPY_FILLS.get(k)
        if fill:
            for nt in _melody_to_phrases(ctx, g, bar, fill, vel=0.32):
                pmel.append((nt["t"], nt["d"], nt["m"] + 12 if nt["m"] < 64 else nt["m"], 0.3, False))
        pm = THERAPY_PIANO_MEL.get(k)
        if pm:   # the answer: the tune in the piano's right hand, singing a little louder
            pn = _melody_to_phrases(ctx, g, bar, pm, vel=0.4)
            _log_melody(ctx, pn, "piano")
            for i, nt in enumerate(pn):
                arch = 0.06 * math.sin(math.pi * (i + 0.5) / len(pn))
                pmel.append((nt["t"], nt["d"], nt["m"], 0.36 + arch, True))
    pmel.sort(key=lambda x: x[0])
    tune_all = tune + [(t, d, m) for (t, d, m, v, a) in pmel]
    segs = []      # (t_start, t_end, chord, bar, beat, beats)
    for bar in range(nb):
        cb = chart(bar)
        if g.t(bar, 0) > ctx.D:
            break
        for (b, c) in cb:
            seg = 4.0 / len(cb)
            segs.append((g.t(bar, b), g.t(bar, b + seg), c, bar, b, seg))
    prev = None
    for (ts, te, c, bar, b, seg) in segs:
        k = bar % 16
        answering = k in THERAPY_PIANO_MEL or k in THERAPY_FILLS
        hold = te - ts + 0.1                      # pedal change just after the next chord
        # left hand: the bass note, pedalled through the chord
        m = nearest(c.bass, N("D2"), N("C2"), N("C3"))
        play(ctx, piano_note, ts + ctx.hum(0.008), m, 0.38, hold, rel=0.35, gain=0.5, pan=0.0,
             send=0.08, length=LEN, tone=TONE)
        if seg >= 4:   # half-pedal: a soft fifth (or octave) re-struck at mid-bar keeps the bed alive
            th = g.t(bar, b + 2)
            m5 = nearest(c.fifth, m + 7, m + 3, m + 9)
            if any(a - m5 in (1, 13) for a in sounding(tune_all, th, te, min_d=0.3)):
                m5 = m + 12
            play(ctx, piano_note, th + ctx.hum(0.01), m5, 0.27, te - th + 0.1, rel=0.35, gain=0.42,
                 pan=0.0, send=0.08, length=LEN, tone=TONE)
        # right hand: rolled chord on the off-beat, pedalled to the next chord
        tr0 = g.t(bar, b + 0.5)
        v = voice(c.comp, 55, 70, prev, center=62, avoid=sounding(tune_all, tr0, te, min_d=0.3))
        prev = v
        for j, mm in enumerate(v):
            tr = tr0 + 0.07 * j + ctx.hum(0.01)
            play(ctx, piano_note, tr, mm, 0.24 + 0.03 * j + ctx.hum(0.02, 0.04), te - tr + 0.1,
                 rel=0.4, gain=0.4, pan=-0.2 + 0.08 * j, send=0.3, length=LEN, tone=TONE)
        if seg >= 4 and rng.random() < 0.5 and not answering:
            mm = v[min(len(v) - 1, 1 + int(rng.integers(len(v) - 1)))] + 12
            th = g.t(bar, b + 2.5)
            if not any(a - mm in (1, 13) or mm - a == 1 for a in sounding(tune_all, th, te, min_d=0.2)):
                play(ctx, piano_note, th + ctx.hum(0.01), mm, 0.22, te - th + 0.1, rel=0.4,
                     gain=0.35, pan=0.1, send=0.32, length=LEN, tone=TONE)
    # the piano's tune (answers + fills), pedalled legato: each note holds into the next one
    # and the last note of a group rings to the next pedal change
    changes = [x[1] for x in segs]
    for i, (t, d, m, vel, ans) in enumerate(pmel):
        nxt = pmel[i + 1][0] if i + 1 < len(pmel) else None
        pedal = next((ce for ce in changes if ce > t + d - 0.05), t + d) + 0.1
        if nxt is not None and nxt - (t + d) < 0.3:      # inside a group: legato into the next note
            hold = max(d * 1.05, min(nxt + 0.08, pedal) - t)
        else:                                          # last of a group: rings to the pedal change
            hold = max(d * 1.05, pedal - t)
        play(ctx, piano_note, t + ctx.hum(0.012 if ans else 0.01), m, vel + ctx.hum(0.02, 0.04), hold,
             rel=0.45, gain=0.55 if ans else 0.45, pan=0.05, send=0.33, length=LEN, tone=TONE)
    return make_ir(1.7, 0.018, 0.65, seed=41)


# =============================================================================
# MONTAGE -- banjo/uke, claps, whistled tune (G major, 128)
# =============================================================================
MONTAGE_CHART = ["G", "G", "C", "G", "Em", "A7", "D7", "D7",
                 "G", "G7", "C", "Cm", "G/D", "E7", "A7|D7", "G"]
_MM1 = "0 D5 .5; .5 G5 .5; 1 A5 .5; 1.5 B5 1; 2.5 A5 .5; 3 G5 1"
_MM3 = "0 E5 .5; .5 G5 .5; 1 C6 1; 2 B5 .5; 2.5 A5 .5; 3 G5 1"
MONTAGE_MEL = [_MM1, "1 B5 .5; 1.5 A5 .5; 2 G5 .5; 2.5 E5 .5; 3 D5 1", _MM3,
               "0 B5 1.5; 1.5 A5 .5; 2 G5 1; 3.5 D5 .5",
               "0 G5 .5; .5 B5 .5; 1 E6 1; 2 D6 .5; 2.5 B5 .5; 3 G5 1",
               "0 A5 .5; .5 C#6 .5; 1 E6 1; 2 C#6 .5; 2.5 A5 .5; 3 G5 1",
               "0 F#5 1; 1 A5 .5; 1.5 D6 1; 2.5 C6 .5; 3 A5 1",
               "0 F#5 2; 2.5 A5 .5; 3 F#5 .5; 3.5 E5 .5",
               _MM1, "1 B5 .5; 1.5 A5 .5; 2 G5 .5; 2.5 F5 .5; 3 D5 1", _MM3,
               "0 Eb6 1.5; 1.5 D6 .5; 2 C6 1; 3 G5 1",
               "0 B5 1; 1 D6 .5; 1.5 B5 .5; 2 G5 1; 3 D5 1",
               "0 G#5 1; 1 B5 .5; 1.5 D6 1; 2.5 B5 .5; 3 G#5 1",
               "0 A5 .5; .5 C#6 .5; 1 E6 1; 2 C6 .5; 2.5 A5 .5; 3 F#5 1",
               "0 G5 .5; .5 D5 .5; 1 G5 1"]


def _four_strings(c, lo, hi, prev):
    v = voice(c.tones[:4], lo, hi, prev, center=(lo + hi) / 2, max_span=12)
    if len(v) < 4:
        v = sorted(v + [v[0] + 12 if v[0] + 12 <= hi + 3 else v[-1] - 12])
    return v


def style_montage(ctx):
    g = _grid_for("montage", ctx.D)
    nb = _bars_needed(ctx, g)
    rng = ctx.rng
    intro = 1

    def k_of(bar):
        return None if bar < intro else (bar - intro) % 16

    def chart(bar):
        k = k_of(bar)
        return bar_chords("G" if k is None else MONTAGE_CHART[k])

    _log_chart(ctx, g, nb, chart)
    ctx.anchors.update(bpm=128, bar=g.bar_s, melody_in=g.t(intro, 0))
    # whistle melody.  The whistler states the 4-bar hook, then the tune becomes
    # call-and-response: whistle on the even bars, the banjo answers the odd bars an octave
    # lower.  Keeps the 0.6-1.3 kHz speech band clear half the time once dialogue can land.
    def response(k):
        return k is not None and k >= 4 and k % 2 == 1

    notes = []
    for bar in range(nb):
        k = k_of(bar)
        if k is None or response(k):
            continue
        notes += _melody_to_phrases(ctx, g, bar, MONTAGE_MEL[k], vel=0.75)
    notes = [n for n in notes if n["t"] < ctx.D]
    for i, nt in enumerate(notes):
        nxt = notes[i + 1] if i + 1 < len(notes) else None
        if nxt is not None and nxt["t"] - (nt["t"] + nt["d"]) < 0.05:
            nt["d"] = (nxt["t"] - nt["t"]) * (0.8 if nt["d"] < 0.3 else 0.95)
        nt["v"] = 0.72 + 0.08 * (abs(nt["beat"][1] % 1) < 1e-6) + float(rng.normal(0, 0.03))
    _log_melody(ctx, notes, "whistle")
    ctx.part = "whistle"
    for ph in _split_phrases(notes, gap=0.2):
        t0, y = whistle_phrase(ph, rng)
        hook = k_of(ph[0]["beat"][0]) < 4    # the first statement of the hook is featured
        ctx.place(y, t0, 0.5 * (1.33 if hook else 1.0), 0.08, 0.25)
    # glockenspiel doubles the second half
    ctx.part = "glock"
    for nt in notes:
        bar = nt["beat"][0]
        if k_of(bar) is not None and k_of(bar) >= 8:
            x, res = glock_note(nt["m"] + 12, 0.5)
            ctx.place(release_tail(x, nt["d"] + 0.2, 0.25), nt["t"], 0.09 * res, 0.35, 0.3)
    # ukulele strum
    ctx.part = "uke"
    prev = None
    pat = [(0, "D", 0.7), (1, "D", 0.6), (1.5, "U", 0.45), (2.5, "U", 0.45), (3, "D", 0.6), (3.5, "U", 0.45)]
    for bar in range(nb):
        cb = chart(bar)
        for i, (b, dr, v) in enumerate(pat):
            t = g.t(bar, b)
            if t > ctx.D:
                break
            c = chord_at(cb, b)
            vs = _four_strings(c, 60, 77, prev)
            prev = vs
            order = vs if dr == "D" else vs[::-1]
            nb_ = pat[i + 1][0] if i + 1 < len(pat) else 4.0
            dur = g.d(bar, b, nb_ - b) + 0.02
            spread = 0.011 if dr == "D" else 0.008
            for j, m in enumerate(order):
                play(ctx, uke_note, t + spread * j + ctx.hum(0.003), m, v * (1 - 0.06 * j) + ctx.hum(0.04, 0.06),
                     dur, rel=0.05, gain=0.55, pan=0.38, send=0.15, variant=j % 2)
    # banjo forward rolls (from bar 5)
    ctx.part = "banjo"
    bprev = None
    roll = [2, 1, 0, 2, 1, 0, 2, 0]
    for bar in range(5, nb):
        cb = chart(bar)
        if response(k_of(bar)):
            ans = _melody_to_phrases(ctx, g, bar, MONTAGE_MEL[k_of(bar)], transpose=-12, vel=0.7)
            _log_melody(ctx, ans, "banjo")
            for i, nt in enumerate(ans):
                if nt["t"] > ctx.D:
                    break
                acc = 0.08 * (abs(nt["beat"][1] % 1) < 1e-6)
                play(ctx, banjo_note, nt["t"] + ctx.hum(0.004), nt["m"], 0.68 + acc + ctx.hum(0.03, 0.05),
                     nt["d"] * 0.9, rel=0.12, gain=0.62, pan=-0.3, send=0.18, variant=i % 2)
                if nt["d"] >= g.beat_s * 0.9:   # banjo players fill long notes with a quick re-pick
                    play(ctx, banjo_note, g.t(nt["beat"][0], nt["beat"][1] + 0.5), nt["m"], 0.5, nt["d"] * 0.45, rel=0.1,
                         gain=0.5, pan=-0.3, send=0.18, variant=(i + 1) % 2)
            continue
        for e in range(8):
            b = e * 0.5
            t = g.t(bar, b)
            if t > ctx.D:
                break
            c = chord_at(cb, b)
            v3 = voice(c.tones[:3], 55, 70, bprev, center=62, max_span=12)
            bprev = v3
            # 5th-string G drone + two fretted strings (the drone re-tunes to the chord's fifth
            # when G would rub against it, e.g. against the F# of D7)
            drone = N("G4") if 7 in c.allowed else nearest(c.fifth, N("G4"), N("E4"), N("B4"))
            strings = [drone] + v3[::-1][:2]
            m = strings[roll[e]]
            play(ctx, banjo_note, t + ctx.hum(0.004), m, 0.55 + 0.12 * (e % 2 == 0) + ctx.hum(0.04, 0.06),
                 g.beat_s * 0.9, rel=0.1, gain=0.6, pan=-0.4, send=0.15, variant=e % 2)
    # bouncy bass: root on 1, fifth on 3, and a chromatic walk-up into the next downbeat.  The
    # walk-up aims at the octave the next downbeat will actually be played in (same rule as
    # the downbeat), approaching from below when that stays in range, else from above.
    ctx.part = "bass"
    LO, HI = N("C2"), N("E3")

    def downbeat_note(c):
        return nearest(c.bass, N("G2"), LO, HI)
    last = N("G2")
    for bar in range(nb):
        cb = chart(bar)
        for (b, kind) in ((0, "R"), (2, "F")):
            c = chord_at(cb, b)
            if kind == "R" or len(cb) > 1:
                m = downbeat_note(c) if kind == "R" else nearest(c.bass, last, LO, HI)
            else:
                m = nearest(c.fifth if c.bass == c.root else c.root, last, LO, HI)
            last = m
            play(ctx, upright_note, g.t(bar, b) + ctx.hum(0.003), m, 0.82, g.beat_s * 0.55, rel=0.05,
                 gain=0.6, pan=0.0, send=0.06)
        nxt = chart(bar + 1)[0][1]
        if bar % 2 == 1 or chart(bar)[-1][1].sym != nxt.sym:
            tgt = downbeat_note(nxt)
            step = -1 if tgt - 2 >= LO else 1          # approach from below unless out of range
            for (b, mm) in ((3, tgt + 2 * step), (3.5, tgt + step)):
                play(ctx, upright_note, g.t(bar, b) + ctx.hum(0.003), int(np.clip(mm, LO, HI)), 0.6,
                     g.beat_s * 0.4, rel=0.04, gain=0.5, pan=0.0, send=0.06)
    # drums: kick 1 & 3, claps 2 & 4, shaker 8ths
    ctx.part = "drums"
    for bar in range(nb):
        for b in range(4):
            t = g.t(bar, b)
            if t > ctx.D:
                break
            if b in (0, 2):
                x, res = kick(0.7, "soft")
                ctx.place(x, t, 0.33 * res, 0.0, 0.0)
            elif bar >= intro:
                x, res = clap(0.8 + ctx.hum(0.04, 0.08), variant=int(rng.integers(3)))
                ctx.place(x, t + ctx.hum(0.003), 0.8 * res, 0.0, 0.3)
                x, res = snare(0.3, "stick", variant=int(rng.integers(3)))
                ctx.place(x, t, 0.18 * res, -0.1, 0.1)
            for h in (0, 0.5):
                if bar >= intro:
                    x, res = shaker(0.55 if h == 0 else 0.4, variant=int(rng.integers(3)))
                    ctx.place(x, g.t(bar, b + h) + ctx.hum(0.003), 0.3 * res, 0.45, 0.08)
        if bar % 8 == 7 and bar >= intro:
            for h in (3.5, 3.75):
                x, res = clap(0.6, variant=1)
                ctx.place(x, g.t(bar, h), 0.7 * res, 0.05, 0.3)
    return make_ir(1.3, 0.012, 0.45, seed=51)


# =============================================================================
# SERENE -- the blissful exhale: harp gliss, pads, choir, chill theme on vibes
# =============================================================================
SERENE_CHART = ["Dmaj9", "E9/D", "Em9", "A13sus|A13", "Dmaj9/F#", "Gmaj9", "Em9", "A13sus|A13"]
SERENE_MEL = CHILL_A[:6] + ["0 G5 1.5; 1.5 F#5 .5; 2 E5 2", "0 E5 2; 2 C#5 2"]


def style_serene(ctx):
    g = _grid_for("serene", ctx.D)
    nb = _bars_needed(ctx, g)
    intro = 1

    def chart(bar):
        return bar_chords("Dmaj9" if bar < intro else SERENE_CHART[(bar - intro) % 8])

    _log_chart(ctx, g, nb, chart)
    ctx.anchors.update(bpm=60, bar=g.bar_s, melody_in=g.t(intro, 0))
    # harp glissando up (the exhale) + rolling arpeggios
    ctx.part = "harp"
    gl = [m for m in range(N("D3"), N("E6") + 1) if m % 12 in (2, 4, 6, 9, 1)]
    T = 1.5
    for i, m in enumerate(gl):
        x = i / (len(gl) - 1)
        t = T * (1 - (1 - x) ** 1.7) * 0.95
        play(ctx, harp_note, t, m, 0.35 + 0.35 * x, None, gain=0.5, pan=-0.5 + x, send=0.5, variant=i % 2)
    # the chill theme (vibes) is planned first so the harp, pad and choir keep out of its way;
    # a vibes note rings ~0.8 s past its written length
    mel = []
    for bar in range(intro, nb):
        mel += _melody_to_phrases(ctx, g, bar, SERENE_MEL[(bar - intro) % 8], vel=0.5)
    tune = [(nt["t"], nt["d"] + 0.8, nt["m"]) for nt in mel]
    for bar in range(nb):
        cb = chart(bar)
        for (b0, c) in cb:
            seg = 4.0 / len(cb)
            ts = g.t(bar, b0)
            pcs = _melody_safe_pcs(c.tones[1:] + [c.root], sounding(tune, ts, g.t(bar, b0 + seg) + 1.0), 3)
            arp = sorted({nearest(pc, ref, N("F#3"), N("A5")) for pc in pcs for ref in (N("A3"), N("E4"), N("B4"))})
            arp = arp[:7]
            seq = arp + arp[-2:0:-1]
            steps = int(seg * 2)
            if bar == 0 and b0 == 0:
                continue
            for e in range(steps):
                m = seq[e % len(seq)]
                t = g.t(bar, b0 + e * 0.5) + ctx.hum(0.006)
                if t > ctx.D:
                    break
                play(ctx, harp_note, t, m, 0.3 + 0.08 * (e == 0) + ctx.hum(0.03, 0.05), None, gain=0.42,
                     pan=-0.3 + 0.6 * (m - 55) / 26, send=0.45, variant=e % 2)
    # string pad + choir + soft sub bass
    prev = None
    cprev = None
    for bar in range(nb):
        cb = chart(bar)
        for (b0, c) in cb:
            seg = 4.0 / len(cb)
            t = g.t(bar, b0)
            if t > ctx.D:
                break
            dur = g.d(bar, b0, seg)
            snd = sounding(tune, t, t + dur + 0.4)
            ctx.part = "pad"
            v = voice(c.comp, 50, 70, prev, center=60, avoid=snd)
            prev = v
            for j, m in enumerate(v):
                y = pad_note(m, dur + 0.4, 0.55, voices=4, attack=1.6 if bar else 2.2, release=2.0, fc=2000,
                             seed=j)
                ctx.place(y, t, 0.55, PAD_PANS[j % len(PAD_PANS)], 0.38)
            ctx.part = "choir"
            cv = voice(c.comp, 62, 77, cprev, center=69, max_span=14, avoid=snd)
            cprev = cv
            for j, m in enumerate(cv[-3:]):
                y = choir_note(m, dur + 0.3, 0.6, "a", voices=3, attack=1.8 if bar else 2.5, release=2.0, seed=j)
                ctx.place(y, t + (0.8 if bar == 0 else 0.0), 0.32, 0.5 - 0.35 * j, 0.6)
            ctx.part = "bass"
            x, _ = sub_note(nearest(c.bass, N("D2"), N("A1"), N("G#2")), dur + 1.5)
            y = x.copy()
            y *= smoothstep(np.arange(len(y), dtype=F32) / (0.8 * SR))
            ctx.place(release_tail(y, dur + 0.2, 0.5), t, 0.5, 0.0, 0.04)
    # chill theme on vibes, slow
    ctx.part = "vibes"
    _log_melody(ctx, mel, "vibes")
    for nt in mel:
        if nt["t"] > ctx.D:
            break
        x, res = vibes_note(nt["m"], 0.5 + ctx.hum(0.03, 0.05), nt["d"] + 2.5)
        y = release_tail(x, nt["d"] + 0.8, 0.6)
        y = y * am_lfo(len(y), nt["t"], 4.5, 0.15)
        ctx.place(y, nt["t"], 0.5 * res, 0.15, 0.55)
    return make_ir(3.2, 0.03, 0.6, seed=61, er_gain=0.3)


# =============================================================================
# ACTION -- eruption chase (D minor, 150)
# =============================================================================
ACTION_CHART = ["Dm", "Dm", "Bb", "C", "Dm", "Dm", "Bb|C", "A7",
                "Gm", "Dm", "Gm", "A7", "Bb", "C", "Dm/A", "A7"]
ACTION_MEL = ["0 D4 1; 1 F4 .5; 1.5 A4 2.5", "0 G4 .5; .5 F4 .5; 1 E4 .5; 1.5 F4 .5; 2 D4 2",
              "0 D4 1; 1 F4 .5; 1.5 Bb4 2.5", "0 C5 1.5; 1.5 Bb4 .5; 2 A4 .5; 2.5 G4 .5; 3 E4 1",
              "0 F4 1; 1 A4 .5; 1.5 D5 2.5", "0 C5 .5; .5 Bb4 .5; 1 A4 .5; 1.5 Bb4 .5; 2 A4 2",
              "0 Bb4 1; 1 D5 1; 2 C5 1; 3 E5 1", "0 E5 2; 2 C#5 1; 3 A4 1",
              "0 G4 1; 1 Bb4 .5; 1.5 D5 2.5", "0 F5 .5; .5 E5 .5; 1 D5 .5; 1.5 C5 .5; 2 A4 2",
              "0 Bb4 1; 1 D5 .5; 1.5 G5 2.5", "0 E5 .5; .5 F5 .5; 1 E5 .5; 1.5 D5 .5; 2 C#5 2",
              "0 D5 1; 1 F5 1; 2 Bb5 2", "0 C5 1; 1 E5 1; 2 G5 2",
              "0 A5 1.5; 1.5 G5 .5; 2 F5 .5; 2.5 E5 .5; 3 D5 1", "0 C#5 1.5; 1.5 E5 .5; 2 A5 2"]


def style_action(ctx):
    g = _grid_for("action", ctx.D)
    nb = _bars_needed(ctx, g)
    rng = ctx.rng

    def chart(bar):
        return bar_chords(ACTION_CHART[bar % 16])

    _log_chart(ctx, g, nb, chart)
    ctx.anchors.update(bpm=150, bar=g.bar_s)
    # opening slam
    ctx.part = "hits"
    x, res = crash(1.0, 0)
    ctx.place(x, 0.0, 0.7 * res, 0.3, 0.3)
    # melody: horns (A), horns + trumpets 8va (B)
    notes = []
    for bar in range(nb):
        notes += _melody_to_phrases(ctx, g, bar, ACTION_MEL[bar % 16], vel=0.8)
    notes = [n for n in notes if n["t"] < ctx.D]
    _log_melody(ctx, notes, "horns")
    ctx.part = "horns"
    mel_t = []          # every sounding tune note (horns + trumpet doubling): the stabs avoid them
    for i, nt in enumerate(notes):
        nxt = notes[i + 1] if i + 1 < len(notes) else None
        d = min(nt["d"], (nxt["t"] - nt["t"]) if nxt else nt["d"]) * 0.92
        sec = (nt["beat"][0] % 16) >= 8
        y = brass_note(nt["m"], d, 0.8 if not sec else 0.9, "horn", voices=3, seed=i % 3, scoop=0.2)
        ctx.place(y, nt["t"] + ctx.hum(0.004), 0.62, -0.25, 0.3)
        mel_t.append((nt["t"], d + 0.1, nt["m"]))
        if sec:  # B section: trumpets double the tune an octave up
            mt = nt["m"] + 12 if nt["m"] < N("E5") else nt["m"]
            y = brass_note(mt, d, 0.7, "trumpet", voices=2, seed=i % 3, scoop=0.15)
            ctx.place(y, nt["t"] + ctx.hum(0.004), 0.3, 0.25, 0.3)
            mel_t.append((nt["t"], d + 0.1, mt))
    # low strings gallop ostinato
    ctx.part = "strings"
    for bar in range(nb):
        cb = chart(bar)
        for b in range(4):
            t = g.t(bar, b)
            if t > ctx.D:
                break
            c = chord_at(cb, b)
            r = nearest(c.bass, N("D3"), N("A2"), N("G#3"))
            for (o, d, v) in ((0, 0.45, 0.95), (0.5, 0.2, 0.7), (0.75, 0.2, 0.75)):
                for m, kind, gn in ((r, "cello", 0.45), (r - 12, "bass", 0.4)):
                    y = bowed_note(m, g.beat_s * d, v, kind, attack=0.008, release=0.05, voices=2, vib=0.0,
                                   seed=int(o * 4), bright=0.9)
                    ctx.place(y, g.t(bar, b + o) + ctx.hum(0.003), gn, -0.1 if kind == "cello" else 0.1, 0.18)
        if bar % 8 == 7:
            run = [N("A4") + i for i in range(8)]
            for i, m in enumerate(run):
                y = bowed_note(m, g.beat_s * 0.22, 0.6 + 0.04 * i, "violin", attack=0.006, release=0.04,
                               voices=3, vib=0.0, seed=i % 2, bright=0.9)
                ctx.place(y, g.t(bar, 2 + i * 0.25), 0.4, 0.3, 0.25)
    # brass stabs (trumpets + trombones) in the melody's gaps.  The beat-3.5 stab anticipates
    # the next bar's chord while the tune may still hold the old chord's note, so every stab
    # is voiced without the pitch classes a semitone from a sounding tune note (falling back
    # to root + fifth): no A4/Bb4 or C#5/D5 crunches against the horns.
    ctx.part = "stabs"
    tprev = None
    for bar in range(nb):
        if bar % 2 == 0:
            continue
        cb = chart(bar)
        for (b, d) in ((2.5, 0.22), (3.5, 0.4)):
            t = g.t(bar, b)
            if t > ctx.D:
                break
            c = chord_at(chart(bar + 1), 0) if b == 3.5 else chord_at(cb, b)
            snd = sounding(mel_t, t, t + g.beat_s * d + 0.05, min_d=0.1, min_ov=0.03)

            def ok(pc):
                return not any((a - pc) % 12 in (1, 11) for a in snd)
            pcs = [p_ for p_ in c.tones[:3] if ok(p_)]
            if len(pcs) < 2:
                pcs = [p_ for p_ in (c.root, c.fifth) if ok(p_)]
            if pcs:
                tv = voice(pcs, N("A4"), N("F5") + 4, tprev, center=N("D5"), avoid=snd)
                tprev = tv
                for j, m in enumerate(tv):
                    y = brass_note(m, g.beat_s * d, 0.95, "trumpet", voices=1, seed=j, scoop=0.1)
                    ctx.place(y, t + 0.003 * j, 0.28 * (1.0 if len(tv) > 2 else 1.15), 0.2 + 0.1 * j, 0.25)
            for m in (nearest(c.root, N("D3"), N("A2"), N("A3")), nearest(c.fifth, N("A3"), N("E3"), N("E4"))):
                if not ok(m % 12):
                    continue
                y = brass_note(m, g.beat_s * d, 0.9, "trombone", voices=1, seed=5, scoop=0.1)
                ctx.place(y, t, 0.3, -0.2, 0.25)
    # percussion
    ctx.part = "drums"
    for bar in range(nb):
        cb = chart(bar)
        t0 = g.t(bar, 0)
        if t0 > ctx.D:
            break
        c = cb[0][1]
        tm = nearest(c.root, N("D2"), N("A1"), N("F2"))
        # timpani: dampened after ~a beat so the low end doesn't pile up into a wash
        x, res = timpani(tm, 0.85)
        ctx.place(release_tail(x, g.beat_s * 1.2, 0.18), t0, 0.62 * res, 0.0, 0.3)
        if bar % 2 == 1:
            x, res = timpani(nearest(c.fifth, N("A1"), N("F#1"), N("D2")), 0.7)
            ctx.place(release_tail(x, g.beat_s * 1.2, 0.18), g.t(bar, 2), 0.5 * res, 0.0, 0.3)
        if bar % 8 == 0 and bar > 0:
            x, res = crash(0.9, bar // 8 % 2)
            ctx.place(x, t0, 0.55 * res, -0.3, 0.3)
        for b in range(4):
            t = g.t(bar, b)
            if b in (0, 2) or (b == 3 and bar % 2 == 1):
                x, res = kick(0.85, "hard")   # short, punchy: no 50 Hz boom under the gallop
                ctx.place(release_tail(x, 0.11, 0.05), t, (0.42 if b != 3 else 0.32) * res, 0.0, 0.0)
            if b in (1, 3):
                x, res = snare(0.75 + ctx.hum(0.04, 0.06), "march", variant=int(rng.integers(3)))
                ctx.place(x, t + ctx.hum(0.002), 0.5 * res, -0.08, 0.2)
            for o in (0.25, 0.75):
                if bar % 8 == 7 and b >= 2:
                    continue
                x, res = snare(0.2 + ctx.hum(0.03, 0.05), "march", variant=int(rng.integers(3)))
                ctx.place(x, g.t(bar, b + o), 0.28 * res, -0.08, 0.15)
            x, res = hat(0.45, "open" if b % 2 else "chick", variant=int(rng.integers(3)))
            ctx.place(x, g.t(bar, b + 0.5), 0.3 * res, 0.35, 0.1)
        if bar % 8 == 7:
            n_roll = 16
            for i in range(n_roll):
                v = 0.3 + 0.6 * i / n_roll
                x, res = snare(v, "march", variant=i % 3)
                ctx.place(x, g.t(bar, 2 + i * 0.125), 0.45 * res, -0.08, 0.2)
            x, res = timpani(N("A1"), 0.7)
            for i in range(8):
                ctx.place(x, g.t(bar, 2 + i * 0.25), (0.25 + 0.05 * i) * res, 0.0, 0.3)
    return make_ir(1.6, 0.015, 0.55, seed=71)


# =============================================================================
# SUNSET -- fingerpicked nylon guitar, warm pad, clarinet quoting the chill theme
# =============================================================================
def style_sunset(ctx):
    g = _grid_for("sunset", ctx.D)
    nb = _bars_needed(ctx, g)
    rng = ctx.rng
    intro = 2

    def chart(bar):
        return bar_chords(CHILL_CHART[bar if bar < intro else (bar - intro) % 8])

    _log_chart(ctx, g, nb, chart)
    ctx.anchors.update(bpm=72, bar=g.bar_s, melody_in=g.t(intro, 0))
    # clarinet quotes the chill theme (Barry's instrument, finally chill) -- planned first so
    # the guitar and pad voicings can keep out of its way
    notes = []
    for bar in range(intro, nb):
        k = (bar - intro) % 24
        if k < 8:
            spec = CHILL_A[k]
        elif 16 <= k < 24:
            spec = CHILL_A2[k - 16]
        else:
            continue
        notes += _melody_to_phrases(ctx, g, bar, spec, transpose=0, vel=0.5)
    notes = [n for n in notes if n["t"] < ctx.D]
    for i, nt in enumerate(notes):
        nxt = notes[i + 1] if i + 1 < len(notes) else None
        if nxt is not None and nxt["t"] - (nt["t"] + nt["d"]) < 0.08:
            nt["d"] = nxt["t"] - nt["t"]
            nxt["slur"] = True
        nt["swell"] = 0.2 if nt["d"] > 0.9 else 0.0
        nt["release"] = 0.3
        nt["attack"] = 0.07
    tune = [(nt["t"], nt["d"], nt["m"]) for nt in notes]
    # guitar arpeggios
    ctx.part = "guitar"
    prev = None
    for bar in range(nb):
        cb = chart(bar)
        for (b0, c) in cb:
            seg = 4.0 / len(cb)
            ts, te = g.t(bar, b0), g.t(bar, b0 + seg)
            v = voice(c.comp, 55, 72, prev, center=63, avoid=sounding(tune, ts, te + 0.3))
            prev = v
            while len(v) < 4:     # a melody-clashing tone was dropped: double an inner note
                v = sorted(v + [v[1] + 12 if len(v) > 1 and v[1] + 12 <= 74 else v[0] - 12])
            bass = nearest(c.bass, N("D3"), N("E2"), N("E3"))
            # the chord's own fifth (B over E9/D -- an A would rub against the G#)
            fifth = nearest(c.fifth, bass + 7, bass + 3, bass + 9)
            pat = [bass, v[0], v[1], v[2], fifth, v[3], v[2], v[1]]
            for e in range(int(seg * 2)):
                t = g.t(bar, b0 + e * 0.5)
                if t > ctx.D:
                    break
                m = pat[e]
                vel = (0.55 if e in (0, 4) else 0.4) + ctx.hum(0.04, 0.06)
                ring = g.beat_s * (1.6 if e in (0, 4) else 1.2)
                capped = ring > te - t + 0.06            # left hand lifts at the chord change
                play(ctx, nylon_note, t + ctx.hum(0.008), m, vel, te - t + 0.06 if capped else ring,
                     rel=0.1 if capped else 0.25, gain=0.85, pan=-0.25 + 0.04 * (e % 4), send=0.3,
                     variant=e % 2)
    # warm pad
    ctx.part = "pad"
    pprev = None
    for bar in range(nb):
        for (b0, c) in chart(bar):
            seg = 4.0 / len(chart(bar))
            t = g.t(bar, b0)
            if t > ctx.D:
                break
            dur = g.d(bar, b0, seg) + 0.3
            v = voice(c.comp, 52, 69, pprev, center=60, avoid=sounding(tune, t, t + dur))
            pprev = v
            for j, m in enumerate(v):
                y = pad_note(m, dur, 0.42, voices=3, attack=1.5, release=1.8, fc=1600, seed=j)
                ctx.place(y, t, 0.5, PAD_PANS[j % len(PAD_PANS)], 0.36)
    # soft upright on half notes (bass note, then the chord's own fifth)
    ctx.part = "bass"
    for bar in range(nb):
        cb = chart(bar)
        for b in (0, 2):
            c = chord_at(cb, b)
            pc = c.bass if (b == 0 or len(cb) > 1) else c.fifth
            m = nearest(pc, N("D2"), N("A1"), N("C#3"))
            play(ctx, upright_note, g.t(bar, b), m, 0.55, g.beat_s * 1.9, rel=0.1, gain=0.5, pan=0.0, send=0.08)
    _log_melody(ctx, notes, "clarinet")
    ctx.part = "clarinet"
    for ph in _split_phrases(notes, gap=0.3):
        t0, y = clarinet_phrase(ph, rng, vib_depth=13.0, vib_rate=5.0, bright=0.35, breath=0.045)
        ctx.place(y, t0, 0.42, 0.15, 0.38)
    return make_ir(2.3, 0.025, 0.65, seed=81)


# =============================================================================
# public API
# =============================================================================
STYLE_FUNCS = {"lounge": style_lounge, "jazz_title": style_jazz_title, "jazz_end": style_jazz_end,
               "tension": style_tension, "therapy": style_therapy, "montage": style_montage,
               "serene": style_serene, "action": style_action, "sunset": style_sunset}


def _render(style, duration, seed=0, hit_at=None, fade_out=None, tail=None):
    if style not in STYLE_FUNCS:
        raise ValueError(f"unknown music style {style!r}; choose from {STYLES}")
    duration = float(max(0.05, duration))
    ctx = Ctx(style, duration, seed)
    ctx.hit_at, ctx.tail = hit_at, tail
    ctx.hit = _ending_hit(style, duration, hit_at, tail)
    ctx.cut = _ending_cut(style, duration, hit_at, tail)
    ir = STYLE_FUNCS[style](ctx)
    tone = None
    if isinstance(ir, tuple):
        ir, tone = ir
    y = _master(ctx, ir, style, tone)
    # clean edges
    y = ramp_in(y, 3.0)
    if ctx.anchors.get("own_ending"):
        y = ramp_out(y, 8.0)
    else:
        # de-click only: the cue plays at full level to the end (build_audio crossfades /
        # cuts the music itself); fade_out > ~0.3 s gives a musical fade for auditioning
        fo = DEFAULT_FADE_OUT if fade_out is None else max(0.0, float(fade_out))
        k = min(len(y), max(1, int(round(fo * SR))))
        w = np.cos(np.linspace(0, np.pi / 2, k)) ** 2
        y[-k:] *= w[:, None].astype(F32)
    y = np.clip(y, -0.9, 0.9).astype(F32)
    return y, ctx


def render_music(style, duration, seed=0, hit_at=None, fade_out=None, tail=None):
    """Render `duration` seconds of music style `style` -> float32 (n, 2) at 48 kHz, peak <= 0.9.

    Any duration works (0.3 s .. several minutes): cues are composed bar by bar and loop by
    whole bars.  Looping cues play at full level right to the end and finish with a
    `fade_out`-second de-click (default DEFAULT_FADE_OUT = 0.04 s), so the caller's own
    crossfades and hard music-outs land on full-level music.

    jazz_end (always) and jazz_title (when duration <= JAZZ_TITLE_TAG_MAX, or whenever
    `hit_at` is given) compose their own ending: the title tune, a stop-time tag and a
    "ba-DUM" button whose downbeat lands at `hit_at` seconds.  Default hit_at = duration -
    tail - lead with tail defaulting to the overhang build_audio adds past the picture
    (jazz_end 1.5 s, jazz_title 0.8 s) and lead 0.5 s (jazz_end) / 0.25 s (jazz_title); pass
    tail=0 for stand-alone use.  jazz_end's button is damped to silence exactly at the picture
    cut (duration - tail) and the overhang is silent; jazz_title's rings through its overhang.
    Deterministic for a given (style, duration, seed, hit_at, fade_out, tail).
    """
    y, _ = _render(style, duration, seed, hit_at, fade_out, tail)
    return y


def music_anchors(style, duration, seed=0, hit_at=None, tail=None):
    """Musical landmarks of a cue (seconds from the cue start) for syncing visuals:
    bpm, beats_per_bar, bar (s), first_downbeat, downbeats [..], melody_in (when the
    main tune enters), rubato flag and, for cues with a composed ending (jazz_end, short
    jazz_title), final_hit and picture_cut (= duration - tail: where jazz_end falls silent).
    Cheap: no audio is rendered."""
    if style not in STYLE_FUNCS:
        raise ValueError(f"unknown music style {style!r}; choose from {STYLES}")
    duration = float(max(0.05, duration))
    g = _grid_for(style, duration, hit_at, seed, tail)
    downs = []
    b = 0 if g.offset <= 1e-9 else -1
    while True:
        t = g.t(b, 0)
        if t > duration + 1e-9:
            break
        if t >= -1e-9:
            downs.append(round(t, 4))
        b += 1
        if b > 10000:
            break
    out = dict(style=style, bpm=g.bpm, beats_per_bar=g.bpb, bar=round(g.bar_s, 4),
               first_downbeat=round(g.t(0, 0), 4), downbeats=downs,
               melody_in=round(g.t(MELODY_IN_BAR[style], 0), 4), rubato=g._map is not None)
    H = _ending_hit(style, duration, hit_at, tail)
    if H is not None:
        out["final_hit"] = round(H, 4)
        out["picture_cut"] = round(_ending_cut(style, duration, hit_at, tail), 4)
    return out


def _calibrate(seconds=60.0, seeds=(0, 1)):
    """Measure the pre-gain integrated loudness (LUFS) of each style (paste into CAL)."""
    res = {}
    for st in STYLES:
        vals = []
        for sd in seeds:
            _, ctx = _render(st, seconds, sd)
            vals.append(lufs(ctx.pre))
        res[st] = round(float(np.mean(vals)), 2)
    return res


def _main(argv):
    import argparse
    ap = argparse.ArgumentParser(description="Audition CHILL CAPYBARA music cues.")
    ap.add_argument("style", help="a style name, 'all', or 'calibrate'")
    ap.add_argument("seconds", type=float, nargs="?", default=30.0)
    ap.add_argument("out", nargs="?", default=None, help="output .wav (or directory for 'all')")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--hit-at", type=float, default=None, help="jazz_end/jazz_title: time of the final button")
    ap.add_argument("--tail", type=float, default=None,
                    help="jazz_end/jazz_title: seconds of the render past the picture (default 1.5 / 0.8)")
    ap.add_argument("--fade-out", type=float, default=None,
                    help=f"end fade of looping cues in seconds (default {DEFAULT_FADE_OUT})")
    ap.add_argument("--schedule", action="store_true", help="print the musical event schedule")
    a = ap.parse_args(argv)
    import soundfile as sf
    if a.style == "calibrate":
        print("CAL =", _calibrate(a.seconds))
        return
    styles = STYLES if a.style == "all" else [a.style]
    for st in styles:
        t0 = time.time()
        y, ctx = _render(st, a.seconds, a.seed, a.hit_at, a.fade_out, a.tail)
        el = time.time() - t0
        if a.style == "all":
            out = os.path.join(a.out or ".", f"{st}.wav")
        else:
            out = a.out or f"{st}.wav"
        if os.path.dirname(os.path.abspath(out)):
            os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
        sf.write(out, y, SR)
        print(f"{st:11s} {a.seconds:6.1f}s rendered in {el:5.2f}s  peak={np.abs(y).max():.3f}  "
              f"rms={rms_db(y):6.1f} dBFS  {lufs(y):6.1f} LUFS  -> {out}")
        if a.schedule:
            for (t, part, text) in sorted(ctx.log, key=lambda e: e[0]):
                if t >= 0:
                    print(f"   {t:8.3f}  {part:10s} {text}")
            print("   anchors:", music_anchors(st, a.seconds, a.seed, a.hit_at, a.tail))


if __name__ == "__main__":
    _main(sys.argv[1:])
