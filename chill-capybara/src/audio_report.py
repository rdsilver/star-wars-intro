#!/usr/bin/env python3
"""Per-scene loudness report of the mix and its stems (run after build_audio.py --stems)."""
import json, os, sys
import numpy as np, soundfile as sf
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, "build")
tl = json.load(open(os.path.join(B, "timeline.json")))
mix, sr = sf.read(os.path.join(B, "audio.wav"), dtype="float32")
stems = {k: sf.read(os.path.join(B, "stems", k + ".wav"), dtype="float32")[0]
         for k in ("dialog", "music", "sfx", "ambience") if os.path.exists(os.path.join(B, "stems", k + ".wav"))}
db = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
pk = lambda x: 20 * np.log10(np.abs(x).max() + 1e-9)
print(f"{'scene':<16}{'mix rms':>8}{'peak':>7} | " + " ".join(f"{k:>9}" for k in stems))
for s in tl["scenes"]:
    a, b = int(s["start"] * sr), int(s["end"] * sr)
    print(f"{s['id']:<16}{db(mix[a:b]):8.1f}{pk(mix[a:b]):7.1f} | " + " ".join(f"{db(v[a:b]):9.1f}" for v in stems.values()))
# dialogue-vs-music while someone speaks
if "dialog" in stems and "music" in stems:
    d, m = [], []
    for l in tl["lines"]:
        a, b = int(l["start"] * sr), int(l["end"] * sr)
        d.append(db(stems["dialog"][a:b])); m.append(db(stems["music"][a:b] + stems.get("ambience", 0 * stems["music"])[a:b]))
    margin = np.array(d) - np.array(m)
    print(f"\ndialogue over music+ambience during lines: median {np.median(margin):.1f} dB, worst {margin.min():.1f} dB "
          f"(line {int(np.argmin(margin))}: {tl['lines'][int(np.argmin(margin))]['text'][:50]!r})")
# loud sfx moments
if "sfx" in stems:
    print("\nsfx events (peak dB / rms over 0.5 s):")
    for e in tl["sfx"]:
        a = int(e["time"] * sr); seg = stems["sfx"][a:a + sr // 2]
        if len(seg): print(f"  {e['time']:7.2f} {e['name']:<15} {pk(seg):6.1f} {db(seg):6.1f}")
