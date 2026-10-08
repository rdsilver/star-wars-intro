#!/usr/bin/env python3
"""Build the soundtrack and timeline for CHILL CAPYBARA.

Reads src/script.py, synthesises every spoken line with Kokoro TTS (cached),
lays the events out on a clock, and writes:

  build/timeline.json  -- absolute times for lines, cues, camera cuts, sfx, music
  build/audio.wav      -- the final stereo mix (48 kHz)

Usage:
  python src/build_audio.py                  # full build
  python src/build_audio.py --timeline-only  # TTS + timeline.json only (no mix)
  python src/build_audio.py --report         # print per-scene runtimes too
"""
import argparse
import hashlib
import importlib
import importlib.util
import json
import os
import sys
import traceback

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BUILD = os.path.join(ROOT, "build")
TTS_CACHE = os.path.join(BUILD, "tts")
MODEL_DIR = os.environ.get(
    "KOKORO_DIR",
    "/tmp/claude-0/-home-user-star-wars-intro/34651c74-2ed0-5286-bc53-ab12f3f7ca2d/scratchpad/tts",
)
SR = 48000
FPS = 24
DEFAULT_GAP = 0.30
STEMS_DIR = None
MOODS = {"neutral", "worried", "panic", "chill", "happy", "smug", "deadpan", "shock", "sad", "sleepy"}

sys.path.insert(0, HERE)


# --------------------------------------------------------------------------- TTS
_kokoro = None


def kokoro():
    global _kokoro
    if _kokoro is None:
        from kokoro_onnx import Kokoro
        _kokoro = Kokoro(os.path.join(MODEL_DIR, "kokoro-v1.0.onnx"),
                         os.path.join(MODEL_DIR, "voices-v1.0.bin"))
    return _kokoro


def voice_style(spec):
    """'am_onyx' or a blend 'am_onyx:0.6,am_michael:0.4'."""
    if ":" not in spec:
        return spec
    k = kokoro()
    style = None
    for part in spec.split(","):
        name, w = part.split(":")
        v = k.get_voice_style(name.strip()) * float(w)
        style = v if style is None else style + v
    return style


def tts(text, voice, speed):
    """Return mono float32 audio at 48 kHz, trimmed of edge silence (cached)."""
    lang = "en-gb" if voice.split(":")[0].strip()[0] == "b" else "en-us"
    key = hashlib.sha1(f"{voice}|{speed}|{lang}|{text}".encode()).hexdigest()[:16]
    path = os.path.join(TTS_CACHE, key + ".wav")
    if os.path.exists(path):
        audio, _ = sf.read(path, dtype="float32")
        return audio
    samples, sr = kokoro().create(text, voice=voice_style(voice), speed=speed, lang=lang)
    samples = np.asarray(samples, dtype=np.float32)
    # trim silence at the edges (keep 40 ms of padding)
    thr = 0.012 * max(1e-6, float(np.abs(samples).max()))
    idx = np.where(np.abs(samples) > thr)[0]
    if len(idx):
        pad = int(0.04 * sr)
        samples = samples[max(0, idx[0] - pad): idx[-1] + pad]
    audio = resample_poly(samples, SR, sr).astype(np.float32)
    os.makedirs(TTS_CACHE, exist_ok=True)
    sf.write(path, audio, SR)
    return audio


def mouth_envelope(audio):
    """One value per video frame (0..1): how open the mouth is."""
    hop = SR // FPS
    n = int(np.ceil(len(audio) / hop))
    rms = np.zeros(n, dtype=np.float32)
    for i in range(n):
        w = audio[i * hop:(i + 1) * hop]
        if len(w):
            rms[i] = np.sqrt(np.mean(w * w))
    if rms.max() <= 0:
        return [0.0] * n
    ref = np.percentile(rms[rms > 0], 90) if np.any(rms > 0) else rms.max()
    env = np.clip(rms / (ref + 1e-9), 0, 1)
    env[env < 0.12] = 0.0
    # smooth: fast attack, gentle release
    out = np.zeros_like(env)
    v = 0.0
    for i, e in enumerate(env):
        v = e if e > v else v * 0.55 + e * 0.45
        out[i] = v
    return [round(float(x), 3) for x in out]


# ------------------------------------------------------------------ script → timeline
def load_script(path=None):
    if path is None:
        import script  # noqa
        importlib.reload(script)
        return script
    spec = importlib.util.spec_from_file_location("script_under_test", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def build_timeline(script, report=False):
    cast = script.CAST
    clock = 0.0
    tl = dict(fps=FPS, cast={k: dict(name=v["name"], color=v["color"]) for k, v in cast.items()},
              scenes=[], lines=[], cues=[], cams=[], sfx=[], music=[])
    clips = []  # (start_sec, mono audio) for the dialogue bus
    ids = set()
    for sc in script.SCENES:
        sid = sc["id"]
        assert sid not in ids, f"duplicate scene id {sid}"
        ids.add(sid)
        start = clock
        if sc.get("music", None) is not None or "music" in sc:
            tl["music"].append(dict(scene=sid, style=sc.get("music"), time=round(start, 3),
                                    fade=sc.get("music_fade", 0.8), gain=sc.get("music_gain", 1.0)))
        t = clock
        last_line_end = clock
        cue_names = set()
        for ev in sc["events"]:
            kind = ev[0]
            if kind == "say":
                _, who, text = ev[:3]
                opts = ev[3] if len(ev) > 3 else {}
                assert who in cast, f"{sid}: unknown character {who!r}"
                mood = opts.get("mood", "neutral")
                assert mood in MOODS, f"{sid}: unknown mood {mood!r}"
                c = cast[who]
                audio = tts(text, c["voice"], opts.get("speed", c["speed"]))
                if "cut" in opts:
                    n = int(opts["cut"] * SR)
                    audio = audio[:n].copy()
                    f = min(len(audio), int(0.03 * SR))
                    audio[-f:] *= np.linspace(1, 0, f, dtype=np.float32)
                gap = opts.get("gap", DEFAULT_GAP)
                ls = max(start, (last_line_end if gap < 0 else t) + gap)
                dur = len(audio) / SR
                clips.append((ls, audio, opts.get("gain", 1.0)))
                tl["lines"].append(dict(id=len(tl["lines"]), scene=sid, char=who, text=text,
                                        start=round(ls, 3), end=round(ls + dur, 3),
                                        mood=mood, to=opts.get("to"), env=mouth_envelope(audio)))
                last_line_end = ls + dur
                t = max(t, ls + dur)
            elif kind == "pause":
                t += float(ev[1])
            elif kind == "beat":
                _, name, dur, desc = ev
                assert name not in cue_names, f"{sid}: duplicate cue {name}"
                cue_names.add(name)
                tl["cues"].append(dict(scene=sid, name=name, time=round(t, 3), dur=float(dur), desc=desc))
                t += float(dur)
            elif kind == "cue":
                _, name = ev[:2]
                assert name not in cue_names, f"{sid}: duplicate cue {name}"
                cue_names.add(name)
                tl["cues"].append(dict(scene=sid, name=name, time=round(t, 3), dur=0.0,
                                       desc=ev[2] if len(ev) > 2 else ""))
            elif kind == "cam":
                tl["cams"].append(dict(scene=sid, name=ev[1], time=round(t, 3)))
            elif kind == "sfx":
                opts = ev[2] if len(ev) > 2 else {}
                tl["sfx"].append(dict(scene=sid, name=ev[1], time=round(t + opts.get("offset", 0.0), 3),
                                      gain=opts.get("gain", 1.0)))
            elif kind == "music":
                opts = ev[2] if len(ev) > 2 else {}
                tl["music"].append(dict(scene=sid, style=ev[1], time=round(t, 3),
                                        fade=opts.get("fade", 0.8), gain=opts.get("gain", 1.0)))
            else:
                raise ValueError(f"{sid}: unknown event {ev!r}")
        end = t + sc.get("tail", 0.5)
        tl["scenes"].append(dict(id=sid, setting=sc["setting"], start=round(start, 3), end=round(end, 3),
                                 transition=sc.get("transition", "cut"), ambience=sc.get("ambience")))
        clock = end
    tl["duration"] = round(clock, 3)
    # make times scene-relative helpers easy: keep absolute, renderer converts
    if report:
        words = 0
        for s in tl["scenes"]:
            n = sum(len(l["text"].split()) for l in tl["lines"] if l["scene"] == s["id"])
            words += n
            print(f"  {s['id']:<22} {s['start']:7.2f} → {s['end']:7.2f}  ({s['end'] - s['start']:6.2f}s, {n} words)")
        print(f"  TOTAL {tl['duration']:.2f}s = {int(tl['duration'] // 60)}:{tl['duration'] % 60:05.2f}, "
              f"{len(tl['lines'])} lines, {words} words")
    return tl, clips


# ------------------------------------------------------------------------ mixing
def _try_import(name):
    try:
        return importlib.import_module(name)
    except Exception:
        print(f"[warn] could not import {name}: using silence\n{traceback.format_exc(limit=1)}")
        return None


def to_stereo(x):
    x = np.asarray(x, dtype=np.float32)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    return x


def add_at(bus, start_sec, clip, gain=1.0):
    i = int(round(start_sec * SR))
    if i >= len(bus) or len(clip) == 0:
        return
    if i < 0:
        clip = clip[-i:]
        i = 0
    n = min(len(clip), len(bus) - i)
    bus[i:i + n] += clip[:n] * gain


def smooth_env(x, attack, release):
    """One-pole envelope follower on a control-rate signal (per sample)."""
    from scipy.signal import lfilter
    # cheap approach: separate attack/release via max of two smoothed versions
    a = np.exp(-1.0 / (attack * SR))
    r = np.exp(-1.0 / (release * SR))
    up = lfilter([1 - a], [1, -a], x)
    down = lfilter([1 - r], [1, -r], x)
    return np.maximum(up, down)


def mix(tl, clips):
    n = int((tl["duration"] + 1.0) * SR)
    dialog = np.zeros((n, 2), np.float32)
    music_bus = np.zeros((n, 2), np.float32)
    sfx_bus = np.zeros((n, 2), np.float32)
    amb_bus = np.zeros((n, 2), np.float32)

    # dialogue (slightly centred, a touch of room)
    presence = np.zeros(n, np.float32)
    for start, audio, gain in clips:
        a = to_stereo(audio) * 0.95 * gain
        add_at(dialog, start, a)
        i = int(start * SR)
        presence[i:i + len(audio)] = 1.0

    music = _try_import("music")
    sfx = _try_import("sfx")

    # music segments
    segs = sorted(tl["music"], key=lambda m: m["time"])
    merged = []
    for m in segs:
        if merged and merged[-1]["style"] == m["style"] and m["style"] is not None and not m.get("restart"):
            continue  # same style keeps playing
        merged.append(m)
    for i, m in enumerate(merged):
        if m["style"] is None:
            continue
        end = merged[i + 1]["time"] if i + 1 < len(merged) else tl["duration"]
        nxt_fade = merged[i + 1]["fade"] if i + 1 < len(merged) else 1.5
        dur = max(0.1, end - m["time"]) + nxt_fade
        if music is None:
            continue
        try:
            seg = to_stereo(music.render_music(m["style"], dur, seed=i))
        except Exception:
            print(f"[warn] music {m['style']} failed:\n{traceback.format_exc(limit=2)}")
            continue
        seg = seg[: int(dur * SR)].copy()
        fi = int(max(0.01, m["fade"]) * SR)
        fo = int(max(0.01, nxt_fade) * SR)
        fi, fo = min(fi, len(seg)), min(fo, len(seg))
        seg[:fi] *= np.linspace(0, 1, fi, dtype=np.float32)[:, None]
        seg[-fo:] *= np.linspace(1, 0, fo, dtype=np.float32)[:, None]
        add_at(music_bus, m["time"], seg, m.get("gain", 1.0))

    # duck music under dialogue (≈ -9 dB)
    duck = smooth_env(presence, 0.08, 0.6)
    music_bus *= (1.0 - 0.62 * np.clip(duck, 0, 1))[:, None]

    # sfx
    if sfx is not None:
        for j, e in enumerate(tl["sfx"]):
            try:
                clip = to_stereo(sfx.render_sfx(e["name"], seed=j))
            except Exception:
                print(f"[warn] sfx {e['name']} failed:\n{traceback.format_exc(limit=2)}")
                continue
            add_at(sfx_bus, e["time"], clip, e.get("gain", 1.0))

    # ambience per scene
    if sfx is not None and hasattr(sfx, "render_ambience"):
        default_amb = {"spring_day": ["jungle", "water"], "spring_evening": ["jungle", "water"],
                       "therapy_office": ["room"], "river_sunset": ["river"], "new_spring": ["jungle", "water"],
                       "title": []}
        for k, s in enumerate(tl["scenes"]):
            names = s.get("ambience") or default_amb.get(s["setting"], [])
            dur = s["end"] - s["start"]
            for name in names:
                try:
                    a = to_stereo(sfx.render_ambience(name, dur + 0.6, seed=k))[: int((dur + 0.6) * SR)].copy()
                except Exception:
                    print(f"[warn] ambience {name} failed:\n{traceback.format_exc(limit=2)}")
                    continue
                f = min(len(a), int(0.3 * SR))
                a[:f] *= np.linspace(0, 1, f, dtype=np.float32)[:, None]
                a[-f:] *= np.linspace(1, 0, f, dtype=np.float32)[:, None]
                add_at(amb_bus, s["start"], a, 0.5)

    stems = dict(dialog=dialog, music=music_bus * 0.55, sfx=sfx_bus * 0.8, ambience=amb_bus * 0.35)
    out = stems["dialog"] + stems["music"] + stems["sfx"] + stems["ambience"]
    # master: loudness-normalise to TARGET_LUFS, then a look-ahead peak limiter
    n_out = int(tl["duration"] * SR)
    out = out[:n_out]
    lufs = integrated_lufs(out)
    g = 10 ** ((TARGET_LUFS - lufs) / 20.0)
    out = limiter(out * g, ceiling=CEILING)
    print(f"master: {lufs:.1f} LUFS -> {integrated_lufs(out):.1f} LUFS (gain {20 * np.log10(g):+.1f} dB), "
          f"peak {20 * np.log10(np.abs(out).max() + 1e-9):.1f} dBFS")
    if STEMS_DIR:
        os.makedirs(STEMS_DIR, exist_ok=True)
        for k, v in stems.items():  # stems at the master gain (pre-limiter)
            sf.write(os.path.join(STEMS_DIR, k + ".wav"), (v[:n_out] * g), SR, subtype="FLOAT")
    return out



# ------------------------------------------------------------------------ mastering
TARGET_LUFS = -16.0   # web/streaming-friendly level for a dialogue-led short
CEILING = 10 ** (-1.0 / 20)  # -1 dBFS


def integrated_lufs(x):
    """ITU-R BS.1770 integrated loudness (K-weighting, 400 ms blocks, gating)."""
    from scipy.signal import lfilter
    # K-weighting stage 1 (high shelf) and stage 2 (high pass), coefficients for 48 kHz
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    y = lfilter(b2, a2, lfilter(b1, a1, x, axis=0), axis=0)
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    if len(y) < blk:
        return -70.0
    ms = np.array([np.mean(y[i:i + blk] ** 2, axis=0).sum() for i in range(0, len(y) - blk + 1, hop)])
    lk = -0.691 + 10 * np.log10(ms + 1e-12)
    ms = ms[lk > -70]
    if not len(ms):
        return -70.0
    rel = -0.691 + 10 * np.log10(ms.mean()) - 10
    lk = -0.691 + 10 * np.log10(ms + 1e-12)
    return float(-0.691 + 10 * np.log10(ms[lk > rel].mean()))


def limiter(x, ceiling=CEILING, lookahead=0.005, release=0.08):
    """Look-ahead brickwall limiter: smooth gain so |x| never exceeds the ceiling."""
    from scipy.ndimage import maximum_filter1d
    from scipy.signal import lfilter
    la = max(1, int(lookahead * SR))
    peak = np.abs(x).max(axis=1)
    need = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
    # look ahead: the gain must already be down when the peak arrives
    need = -maximum_filter1d(-need, size=2 * la + 1)
    # release smoothing (instant attack thanks to the min-filter above)
    r = np.exp(-1.0 / (release * SR))
    smooth = lfilter([1 - r], [1, -r], need - 1.0) + 1.0
    gain = np.minimum(need, smooth)
    return (x * gain[:, None]).astype(np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--timeline-only", action="store_true")
    ap.add_argument("--report", action="store_true")
    ap.add_argument("--script", help="path to an alternative script .py (default src/script.py)")
    ap.add_argument("--out", help="timeline output path (default build/timeline.json)")
    ap.add_argument("--stems", action="store_true", help="also write build/stems/{dialog,music,sfx,ambience}.wav")
    args = ap.parse_args()
    global STEMS_DIR
    if args.stems:
        STEMS_DIR = os.path.join(BUILD, "stems")
    os.makedirs(BUILD, exist_ok=True)
    script = load_script(args.script)
    tl, clips = build_timeline(script, report=True)
    out = args.out or os.path.join(BUILD, "timeline.json")
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, "w") as f:
        json.dump(tl, f, separators=(",", ":"))
    print(f"wrote {out} ({tl['duration']:.2f}s)")
    if args.timeline_only:
        return
    audio = mix(tl, clips)
    sf.write(os.path.join(BUILD, "audio.wav"), audio, SR, subtype="PCM_16")
    print(f"wrote build/audio.wav ({len(audio) / SR:.2f}s)")


if __name__ == "__main__":
    main()
