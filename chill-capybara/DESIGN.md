# CHILL CAPYBARA — production bible & engineering contract

A ~5 minute (target 4:45–5:15) 2D animated comedy short, rendered entirely in code.

> Capybaras are the chillest animals on Earth. Barry is not. Barry is a neurotic
> capybara (think Woody Allen / Larry David) who keeps noticing that things are
> wrong at Snooze Springs: the water keeps getting warmer, the fish left, a vulture
> keeps sitting on his head, and the dormant volcano behind the spring is smoking.
> Everybody tells him to chill. **He was right.**

This file is the shared contract between everyone working on the film. If you are
an agent building one piece, build to these interfaces exactly so the pieces fit.

---------------------------------------------------------------------------------
## 1. Pipeline

```
src/script.py          screenplay as data (single source of truth)
  │
  ▼  python src/build_audio.py            (TTS via Kokoro, music, sfx, mixing)
build/timeline.json    absolute times of every line / cue / camera cut / sfx
build/audio.wav        final stereo mix, 48 kHz
  │
  ▼  node src/render.js                   (@napi-rs/canvas → raw frames → ffmpeg)
build/chill_capybara.mp4   (copied to ../chill_capybara.mp4 when final)
```

Paths & tools (this machine):
* Project root: `/home/user/star-wars-intro/chill-capybara` (everything below is relative to it)
* Python venv with kokoro-onnx, numpy, scipy, soundfile:
  `/tmp/claude-0/-home-user-star-wars-intro/34651c74-2ed0-5286-bc53-ab12f3f7ca2d/scratchpad/venv/bin/python`
  (referred to as `$PY`). Kokoro model files live in `.../scratchpad/tts/`.
* Node 22 with `@napi-rs/canvas` installed in `src/node_modules`. `ffmpeg` is on PATH.
* Fonts (registered by `src/lib/fonts.js`): `Fredoka` (rounded, bold — signs, captions),
  `Shrikhand` (groovy italic display — the "CHILL CAPYBARA" title), `Yeseva` (serif —
  Woody-Allen-style white-on-black title cards), `Nunito` (subtitles).
* Design canvas is **1280×720 logical units**; render.js scales to the output size
  (1920×1080 final, smaller for previews). Always draw in 1280×720 space.
* Frame rate **24 fps**.

Useful commands:
```
$PY src/build_audio.py                 # TTS (cached) + timeline + mix → build/
$PY src/build_audio.py --timeline-only # just TTS + timeline.json (fast after cache)
node src/render.js --still 12.5 out.png          # one frame at t=12.5s (design res 1280x720)
node src/render.js --sheet s03_therapy out.png   # contact sheet of a scene (grid of frames)
node src/render.js --range 40 52 out.mp4         # preview clip with audio, 640x360
node src/render.js --final                       # full 1920x1080 render
node src/lab.js <file.png> <what>               # asset lab: draws asset showcase sheets (see §6)
```

---------------------------------------------------------------------------------
## 2. Screenplay format — `src/script.py`

```python
CAST = {
  # id: voice (Kokoro voice id, or "a:0.6,b:0.4" blend), speed, display name, subtitle colour
  "narrator": dict(voice="bm_fable",  speed=0.92, name="NARRATOR",    color="#E8E8E8"),
  "barry":    dict(voice="am_fenrir", speed=1.12, name="BARRY",       color="#FFD27A"),
  "sunny":    dict(voice="am_onyx",   speed=0.90, name="SUNNY",       color="#9FE3A8"),
  "doreen":   dict(voice="af_heart",  speed=0.95, name="DOREEN",      color="#FFB0C8"),
  "gerald":   dict(voice="bm_george", speed=0.95, name="GERALD",      color="#C9B8FF"),
  "shelley":  dict(voice="bm_lewis",  speed=0.72, name="DR. SHELLEY", color="#A8D8FF"),
}

SCENES = [
  dict(id="s01_open", setting="spring_day", music="lounge", events=[
      ("cam", "wide"),
      ("pause", 1.5),
      ("say", "narrator", "The capybara."),
      ("say", "barry", "Thirty-nine point two.", dict(mood="worried", gap=0.6)),
      ("sfx", "record_scratch"),
      ("beat", "vulture_lands", 1.4, "Gerald flaps down and lands on Barry's head"),
      ("cue", "barry_turns", "Barry turns to face Doreen"),
      ("music", "tension", dict(fade=0.5)),
      ...
  ]),
  ...
]
```

Event vocabulary (events are processed in order; a running clock `t` advances):

| event | effect on clock | meaning |
|---|---|---|
| `("say", char, text[, opts])` | advances by `gap` (default 0.30 s) + line length | a spoken line (TTS). opts: `gap` (silence before; may be **negative** to overlap/step on the previous line), `cut` (truncate the audio after N seconds — for interruptions; end text with an em dash "—"), `mood` (animation hint: `neutral, worried, panic, chill, happy, smug, deadpan, shock, sad, sleepy`), `to` (who they're talking to), `speed` (override) |
| `("pause", seconds)` | advances | silence / reaction time |
| `("beat", name, seconds, description)` | advances | a named visual action with a duration (animators key off `name`) |
| `("cue", name, description)` | none | an instantaneous named marker at the current time |
| `("cam", shot_name)` | none | camera cut to a named framing (scene animator defines the framings) |
| `("sfx", name[, opts])` | none | sound effect at current time. opts: `gain`, `offset` |
| `("music", style_or_None[, opts])` | none | switch music. opts: `fade` (s), `gain` |

Scene dict keys: `id` (`sNN_name`), `setting` (one of §5 settings), `music` (style at
scene start or `None`), `events`, optional `transition` (`cut` default, `fade`,
`iris`, `wipe`) and `tail` (extra seconds held after the last event, default 0.5).

The **spoken words are the jokes** — keep lines short and punchy, TTS-friendly
(spell numbers as words when the reading matters, avoid ALL CAPS words — use `!`
instead, avoid stage directions inside quotes).

---------------------------------------------------------------------------------
## 3. Timeline — `build/timeline.json` (produced by build_audio.py)

```jsonc
{
  "fps": 24, "duration": 301.2,
  "cast": { "barry": {"name": "BARRY", "color": "#FFD27A"}, ... },
  "scenes": [ {"id": "s01_open", "setting": "spring_day", "start": 0.0, "end": 41.3,
               "transition": "cut"} ],
  "lines":  [ {"id": 0, "scene": "s01_open", "char": "narrator", "text": "The capybara.",
               "start": 1.5, "end": 2.6, "mood": "neutral", "to": null,
               "env": [0.0, 0.31, 0.82, ...] } ],          // mouth-open envelope, 0..1, 1 value per 1/24 s
  "cues":   [ {"scene": "s01_open", "name": "vulture_lands", "time": 30.2, "dur": 1.4,
               "desc": "..."} ],                           // beats AND cues (cue dur = 0)
  "cams":   [ {"scene": "s01_open", "name": "wide", "time": 0.0} ],
  "sfx":    [ {"scene": "s01_open", "name": "record_scratch", "time": 6.0} ],
  "music":  [ {"scene": "s01_open", "style": "lounge", "time": 0.0} ]
}
```

---------------------------------------------------------------------------------
## 4. Renderer contract (Node, CommonJS)

```
src/render.js          harness: CLI, frame loop, ffmpeg piping, subtitles, transitions
src/lib/util.js        math: clamp, lerp, ease*, smoothstep, mix colours, seeded rng, noise1/2
src/lib/timeline.js    Timeline class (below)
src/lib/fonts.js       registers fonts
src/lib/characters.js  index → re-exports capybara.js (drawCapybara, capyAnchors)
                       + critters.js (drawVulture, drawTortoise, drawFish, extras)   (§6)
src/lib/props.js       drawOrange, drawHelmet, drawThermometer, drawSign, drawRaft, ... (§6)
src/lib/env.js         index → re-exports env_spring.js (spring_day, spring_evening,
                       eruption, new_spring, water, particles) + env_other.js
                       (therapy_office, river_sunset, title cards)                    (§5)
src/lab.js             asset lab runner: every lib module exports `lab = {sheet(ctx,t)}`
src/scenes/<scene_id>.js  one file per scene
```

### Scene module
```js
// src/scenes/s01_open.js
module.exports = {
  // ctx is already transformed to 1280x720 design space (NOT camera-transformed).
  // t: seconds since scene start. S: SceneTime helper bound to this scene.
  render(ctx, t, S) { ... }
};
```
`S` (SceneTime, from timeline.js) provides — all times are **scene-local seconds**:
* `S.cue(name)` → start time of the cue/beat (throws if missing — typos fail loudly);
  `S.cueDur(name)`; `S.has(name)`.
* `S.since(name)` → `t - cue(name)` (negative before it); `S.prog(name, dur?)` →
  0..1 progress through the beat (uses beat duration if `dur` omitted), clamped.
* `S.talk(char)` → mouth-open amount 0..1 right now (lip-sync envelope; 0 when silent).
* `S.speaking(char)` → bool; `S.line(char)` → active line object or null (has `mood`, `to`).
* `S.lastLine(char)` → most recent line by that char started at or before now.
* `S.cam()` → name of the active camera shot; `S.camTime()` → seconds since that cut.
* `S.duration` → scene length; `S.t` → current local time; `S.T` → global time.
* `S.rng(seed)` → deterministic random generator.

Rendering must be a **pure function of time** (no state carried between frames —
frames may be rendered out of order or in parallel). Use seeded randomness only.

### Camera helper (in util.js)
`withCamera(ctx, {x, y, zoom, rot=0, shake=0, t}, fn)` — centres design point (x,y) on
screen at the given zoom (1 = whole 1280×720 view), calls `fn()`, restores. `shake` is an
amplitude in design units (noise-driven, deterministic from `t`).

---------------------------------------------------------------------------------
## 5. Settings / environments (src/lib/env.js)

Every environment function draws in **world units** where the default framing is the
1280×720 screen (camera zoom 1 centred at 640,360), but should extend ~300 units beyond
every edge so the camera can pan/zoom out a little without showing void.

| setting | function | notes |
|---|---|---|
| `spring_day` | `drawSpringDay(ctx, t, o)` | Snooze Springs: hot spring pool in a lush jungle clearing, morning-blue sky, **Mount Snooze** volcano in the background (centre-right). Wooden sign "SNOOZE SPRINGS — No Worries Allowed". Steam wisps. Pool water surface y ≈ 470 (front edge ≈ 700). |
| `spring_evening` | `drawSpringEvening(ctx, t, o)` | same place, golden-hour → dusky pink. Supports eruption overlay. |
| eruption | `drawEruption(ctx, t, o)` + `volcano` state | `o.erupt` 0..1 drives crater glow, smoke plume, lava fountains, lava rivers, red sky tint; falling rocks & ash particles helpers |
| `therapy_office` | `drawTherapyOffice(ctx, t, o)` | inside a hollow log: warm wood arch walls, round window to jungle, framed diploma "Swamp University — PhD in Feelings", potted fern, lamp glow, rug, a log-couch (left) and an armchair (right) |
| `river_sunset` | `drawRiverSunset(ctx, t, o)` | wide river at sunset, purple→orange sky, sun reflection, silhouetted jungle banks, Mount Snooze tiny & smoking in the far distance, drifting ash |
| `new_spring` | `drawNewSpring(ctx, t, o)` | a different, sunnier hot spring (no volcano in sight — gentle hills instead). Sign: "SNOOZE SPRINGS 2 — Barry Approved" |
| `title` | `drawTitleCard(ctx, t, o)` | black card, white Yeseva serif text (Woody Allen homage) |

**Snooze Springs layout (spring_day / spring_evening share it — world units):**
* Pool: a wide irregular oval spanning x ≈ 140…1180, surface/back edge y ≈ 455, front
  edge beyond the bottom of the frame (y ≈ 760). Characters "swim" with their waterline
  at y ≈ 520–600 (further back = higher on screen = slightly smaller).
* Mount Snooze: peak ≈ (860, 150), crater width ≈ 110, base spanning ≈ 560…1180 at y ≈ 420.
* The pool drains through a gap in the rocks at the **left** into a small river that
  flows off-screen left (x < 140, y ≈ 520–620). The raft (built in the montage) is moored
  there at ≈ (70, 585). The **EXIT signs** stand on the left bank between x ≈ 150…420,
  y ≈ 440–470 (pointing left). This is the escape route.
* The "SNOOZE SPRINGS — No Worries Allowed" sign stands on the right bank ≈ (1150, 445).
* Lava (eruption) flows down the volcano's left flank and reaches the pool from the
  back-right; the spring boils, then lava pours in.

Common option fields `o`: `{ volcanoSmoke: 0..1, waterHeat: 0..1 (steam/bubbles amount),
rumble: 0..1, erupt: 0..1, lava: 0..1 (how far lava has flowed), skyTint, ... }`.
Pools/water: env exposes `drawWaterFront(ctx, t, o)` — the semi-transparent front water
layer to draw **after** characters so they look submerged, plus `waterlineRipple(ctx, x, y, w, t)`.
Env should export the key world anchors in an object, e.g. `SPRING.waterY`, `SPRING.signPos`,
`SPRING.volcanoPeak`, so scenes can place characters consistently.

Palette (flat, warm, slightly desaturated storybook look, soft gradients, no hard black
outlines except a thin darker-same-hue outline on characters):
* sky day `#8ED1F0 → #FDEBC8`; evening `#F7A26B → #6B4C8A`; sunset `#FF9E5E → #5B3A7A`
* jungle greens `#2F6B45 #3F8A55 #5FAF6A #8CCB7A`; water `#5CC9C9 → #2E8F9E`, highlights `#C9F4EE`
* volcano `#6C6F86` lit side `#8E8FA6`, crater glow `#FF7A2E`, lava `#FF5A1F #FFB13B`
* capybara browns (see §6), oranges `#FF9A1F`

---------------------------------------------------------------------------------
## 6. Characters & props (src/lib/characters.js, src/lib/props.js)

All characters are drawn in **side profile** (the iconic capybara meme pose), default
facing **right**; `flip: true` faces left. Origin = centre of the body at the waterline-ish
centre of mass; `scale: 1` → a capybara body ≈ 230 units long, ≈ 150 units tall incl. head.

### drawCapybara(ctx, o)
```
o = {
  x, y, scale=1, flip=false, rot=0,
  who: 'barry'|'sunny'|'doreen'|'extra',  // picks palette & accessories defaults
  t,                     // global time for idle motion (breathing, blinks) — deterministic
  talk: 0..1,            // jaw open (from S.talk); also adds small head bob
  mood: 'neutral'|'worried'|'panic'|'chill'|'happy'|'smug'|'deadpan'|'shock'|'sad'|'sleepy',
  look: {x:-1..1, y:-1..1},   // pupil direction (x=+1 → toward snout); {x:0,y:0} centre
  eyes: 0..1 (override lid openness), blink: true,
  headTilt: degrees, headTurn: 0..1 (0 = profile; 1 = face turned toward camera — optional nicety),
  pose: 'swim' | 'stand' | 'walk' | 'run' | 'sit' | 'lie',  // swim = only body top + head (legs hidden)
  walkPhase: number,     // leg cycle phase for walk/run
  accessories: { orange: bool|'squashed', glasses: bool, helmet: bool, flower: bool,
                 necklace: bool, backpack: bool, soot: 0..1, juice: 0..1,
                 sweat: 0..1, thermometer: bool  /* held in mouth or paw */ },
}
```
Character designs:
* **Barry** — slightly scrawny, warm brown `#9A6A45` (shade `#7A4F33`, belly `#B88A62`).
  **Thick black round Woody-Allen glasses** (always). Worried brows, small pupils,
  a frazzled tuft of hair on the crown, occasional sweat drop. Never wears an orange
  until the very end. Later: tiny red bike helmet `#E2463F`.
* **Sunny** — big, round, golden `#B8834F`, permanently half-closed blissed-out eyes,
  slow blink, a puka-shell necklace, orange on head. Surfer dude.
* **Doreen** — medium, reddish-brown `#A86A4C`, long lashes, pink hibiscus behind the
  ear, orange on head, warm smile, motherly.
* **extra** — background capybaras, random browns, oranges/birds on heads, all asleep-chill.
* Capybara anatomy (profile): barrel body with high rounded rump, big boxy head with a
  **blunt rectangular snout** (tall flat front), tiny round ears high on the head, small
  eye high and toward the back of the head, nostril near top-front of snout, little mouth
  under the snout with **two white buck teeth** visible when talking. Short stubby legs.
  Coarse fur hinted by a few darker strokes. Expressive brows are a cartoon liberty.

### drawVulture(ctx, o) — **Gerald**
Polite British turkey/king-vulture: charcoal body `#2E2A33`, white fluffy neck ruff,
bald wrinkly pink-red head `#E07A6A`, pale hooked beak, half-lidded knowing eye.
`o = {x, y, scale, flip, t, talk, pose: 'perch'|'fly'|'land'|'takeoff', wing: 0..1 (spread),
flapPhase, mood, look}`. Perches on top of Barry's head (feet gripping).

### drawTortoise(ctx, o) — **Dr. Shelley**
Ancient tortoise therapist: high domed shell with hexagon plates `#7A8A4A`/`#5E6B38`,
wrinkly grey-green head on a long neck, tiny round reading spectacles on the beak,
holding a notepad + pencil. Very slow blinks. `o = {x,y,scale,flip,t,talk,mood,write: 0..1}`.

### drawFish(ctx, o) — small orange/teal fish; `o.suitcase` draws a tiny suitcase; `o.hop` phase.

### props.js
`drawOrange(ctx, {x,y,r,rot,squash})`, `drawJuiceSplat(ctx,{x,y,r,t})`,
`drawHelmet(ctx,{x,y,scale,rot})`, `drawThermometer(ctx,{x,y,scale,rot,level:0..1,
reading:"39.2", broken:0..1})`, `drawSign(ctx,{x,y,w,h,text,lines,rot,style:'wood'|'arrow',
arrowDir})`, `drawRaft(ctx,{x,y,scale,t,flagText:"S.S. TOLD YOU SO",build:0..1, rock})`,
`drawBackpack`, `drawHammer`, `drawSuitcase`, `drawRock(ctx,{x,y,r,glow})`,
`drawSpeechBubble(ctx,{x,y,text})` (rarely needed — subtitles carry dialogue),
`drawSweatDrop`, `drawMotionLines`, `drawStars` (dizzy), `drawZzz`.

### Asset lab — `src/lab.js`
`node src/lab.js out.png characters|props|env:<setting>` renders showcase sheets (all
moods, poses, accessories side by side) so designs can be reviewed as images.

---------------------------------------------------------------------------------
## 7. Audio contract (src/music.py, src/sfx.py, src/build_audio.py)

Sample rate 48000, float32 stereo arrays shaped `(n, 2)`, peak ≤ ~0.9.

`music.py`: `render_music(style: str, duration: float, seed: int = 0) -> np.ndarray`
Styles (all must loop/extend seamlessly to any duration and end cleanly with a short fade):
* `jazz_title` — Woody-Allen-style trad jazz: swung clarinet melody over walking bass,
  brushed snare, piano comping. Bright, wry. (~110 bpm swing)
* `lounge` — the "chill" theme: soft bossa nova, warm electric-piano maj7 chords, nylon
  pluck, shaker, soft upright bass. Sits under dialogue.
* `tension` — uneasy: low drone, slow pizzicato in minor, subtle ticking.
* `therapy` — sparse, wistful solo clarinet + soft piano, rubato-ish.
* `montage` — upbeat, can-do: banjo/ukulele (Karplus-Strong) strumming, claps, whistled
  or kazoo-ish melody, 128 bpm major.
* `serene` — the one time Barry relaxes: lush pads, harp-like arpeggios, heavenly.
* `action` — eruption chase: driving low-string ostinato, timpani, brass stabs, 150 bpm minor.
* `sunset` — gentle aftermath: soft guitar arpeggios, warm pad.
* `jazz_end` — end-titles reprise of `jazz_title`, with a big final button ending.

`sfx.py`: `render_sfx(name: str, seed: int = 0) -> np.ndarray` (stereo, natural length).
Names: `record_scratch, rumble_small, rumble_big, explosion, bonk, splat, flap, flaps,
land, glass_ping, glass_pop, splash, big_splash, bubbles, boil, hammer, whoosh, pop,
thud, crowd_gasp(optional), laugh_chuckle(optional), sizzle, lava_hiss, rock_whistle,
paper_scribble, zip, sting_bad (comedic "dun-dun"), sting_good, cricket, birds`.
Ambience: `render_ambience(name, duration, seed=0)` for `jungle, water, fire, river, room`.

`build_audio.py` runs the script: TTS per line (cached in build/tts/), lays out the
clock, writes timeline.json, renders music per segment with crossfades, ducks music
~-9 dB under dialogue, places sfx, adds ambience per setting, normalises, writes audio.wav.
