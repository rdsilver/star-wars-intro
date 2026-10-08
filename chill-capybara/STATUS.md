# Chill Capybara — production status (paused)

**Paused on 2026-10-08 at the user's request.** Everything below is committed on
`claude/fervent-faraday-6bvgm1`.

## Done
- **Screenplay** (`SCREENPLAY.md`, `src/script.py`): writers' room (3 drafts → judges → merge →
  adversarial punch-up). Runtime 5:08.6 with the production voices.
- **Voices**: Kokoro TTS. The 89 final takes are archived in `assets/tts/*.flac`, so
  `build_audio.py` reproduces the exact timeline without the TTS model.
- **Score + sound design** (`src/music.py`, `src/sfx.py`): fully synthesized, two critique rounds each.
  Master is -16 LUFS with a -1 dBFS limiter.
- **Characters, props, environments** (`src/lib/*.js`): two adversarial art-direction rounds each,
  plus a final fix round for `kit.js` / `env_spring.js`.
- **Scenes** (`src/scenes/s01…s10.js`): every scene has a first full animation pass and renders
  cleanly. A rough cut (960×540) was delivered.

## Where the scene director passes stopped
Each scene was planned as: animate → director 1 → revise 1 → director 2 → revise 2.

| scene | reached |
|---|---|
| s01_open | director 1 notes written, not yet applied |
| s02_title | director 1 notes written, revise 1 interrupted |
| s03_spring | director 1 notes written, revise 1 interrupted |
| s04_rumble | director 1 notes written, not yet applied |
| s05_therapy | director 1 notes written, revise 1 interrupted |
| s06_montage | animate pass interrupted (renders, but the least polished) |
| s07_eruption | animate done, director 1 interrupted |
| s08_aftermath | director 1 notes written, not yet applied |
| s09_epilogue | animate done, director 1 interrupted |
| s10_end | director 1 notes written, not yet applied |

Director notes live in the workflow journals of the session that produced them; they are not
needed to resume — a fresh director pass re-derives them.

## To resume
1. Environment (a fresh container needs it):
   `cd chill-capybara/src && npm install`; a Python venv with `kokoro-onnx numpy scipy soundfile pillow`
   (Kokoro model files are only needed if a line of dialogue changes).
2. `python src/build_audio.py --stems` → `build/timeline.json` + `build/audio.wav`.
3. Finish the director passes per scene with `workflows/scenes.js` (args: `{scenes:[{id, summary}]}`),
   then the whole-film review + fixes with `workflows/film_review.js`. (All the workflow scripts used
   so far are in `workflows/`.)
4. `node src/render.js --final --workers 4` → `build/chill_capybara.mp4` (renders ~20 s segments in
   a worker pool; ~150 ms/frame at 1080p). Copy to `chill_capybara.mp4` for `index.html`.
