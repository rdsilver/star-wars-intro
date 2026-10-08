export const meta = {
  name: 'chill-capybara-assets',
  description: 'Build CHILL CAPYBARA asset modules with adversarial critique-and-fix rounds',
  phases: [
    { title: 'Build', detail: 'one builder per module' },
    { title: 'Critique 1', detail: 'adversarial art director / audio engineer' },
    { title: 'Fix 1' },
    { title: 'Critique 2' },
    { title: 'Fix 2' },
  ],
}

const ROOT = '/home/user/star-wars-intro/chill-capybara'
const PY = '/tmp/claude-0/-home-user-star-wars-intro/34651c74-2ed0-5286-bc53-ab12f3f7ca2d/scratchpad/venv/bin/python'

const COMMON_VISUAL = `
You are building one asset module for "CHILL CAPYBARA", a ~5 minute 2D animated comedy short rendered entirely in code (Node + @napi-rs/canvas → ffmpeg). Premise: capybaras are the chillest animals on Earth; Barry (a capybara in thick round Woody-Allen glasses) is a neurotic Woody Allen / Larry David type who keeps noticing things are wrong at Snooze Springs (warming water, the fish leaving, a vulture sitting on his head, the "dormant" volcano Mount Snooze smoking). Everyone tells him to chill. He was RIGHT: the volcano erupts and his ridiculed preparations (EXIT signs, a raft called "S.S. TOLD YOU SO", a tiny helmet) save everyone.

READ FIRST: ${ROOT}/DESIGN.md (all of it), ${ROOT}/src/lib/util.js (helpers you should use: ease, tween, keys, rng, noise1/2, mix/shade/rgba colours, ellipse/circle/roundRect/blob/curve, withCamera), ${ROOT}/src/lab.js (how your sheets are rendered) and ${ROOT}/src/script_seed.py (a representative draft screenplay — the final one is being written in parallel and will be similar; your assets must support its beats).

QUALITY BAR: this is the visual identity of the film. Aim for a polished, modern flat-vector storybook look (soft gradients, rim highlights, subtle shading, thin darker same-hue outlines, appealing rounded shapes, strong silhouettes, clear readable expressions) — the kind of thing that looks good in a festival animated short. Not clip-art, not programmer art.

TECHNICAL RULES:
- CommonJS, @napi-rs/canvas 2D context (same API as browser canvas). Draw in 1280x720 design units.
- Pure functions of their inputs (time t included): deterministic, no state between calls, never Math.random (use util.rng/hash/noise with fixed seeds).
- ctx.save()/restore() around everything you change.
- Performance: at 1920x1080 scale a full frame must render well under 100 ms in total, so a character should cost a few ms and an environment ~10-25 ms. Avoid shadowBlur and ctx.filter (slow); gradients are fine; cache nothing across calls unless it's a pure function of constant inputs (a module-level cache keyed by constant params is fine).
- Fonts available: 'Fredoka' (400-700), 'Shrikhand', 'Yeseva', 'Nunito' (registered by lab.js/render.js via src/lib/fonts.js).
- Document the public API in a header comment (every exported function and its options) and export a \`lab\` object of showcase sheets: \`lab.sheetName = (ctx, t) => {...}\` (draws onto a 1280x720 canvas; background already filled).
- MANDATORY REVIEW LOOP: render your sheets with \`cd ${ROOT} && node src/lab.js <module> <sheet> build/lab/<module>_<sheet>.png\` (add \`--frames 8 --dt 0.1\` to check animation) and LOOK at the PNGs with the Read tool. Critique like a demanding art director and iterate at least 4 full passes until it genuinely looks great. Time it with a quick node script (draw 100x at 1920x1080 scale).
- Only edit the files you own; other agents are building the other modules concurrently.
`

const COMMON_AUDIO = `
You are building one audio module for "CHILL CAPYBARA", a ~5 minute animated comedy short whose entire soundtrack is synthesized in code (Python 3 + numpy + scipy; no samples, no network). Premise: capybaras are the chillest animals on Earth; Barry is a neurotic Woody Allen / Larry David-type capybara who keeps noticing things are wrong at Snooze Springs; everyone tells him to chill; he was RIGHT — the dormant volcano erupts and his ridiculed preparations save everyone. The film opens and closes with a Woody-Allen-style white-on-black title card with trad jazz.

READ FIRST: ${ROOT}/DESIGN.md (§7 is your contract), ${ROOT}/src/build_audio.py (how your module is called and mixed: music is ducked under dialogue, crossfaded between styles; sfx placed at cue times), and ${ROOT}/src/script_seed.py (a representative draft screenplay; see where each music style and sfx is used).
Python: ${PY} (numpy, scipy, soundfile, pillow available). SR = 48000, float32 stereo arrays shaped (n, 2).

QUALITY BAR: it must sound like real, pleasant, well-produced music/sound design — musical, warm, not harsh or chiptune-y, good stereo image, a touch of reverb glue, sensible loudness. Synthesis tips: band-limited oscillators (additive or polyBLEP), FM electric piano (Rhodes-like), Karplus-Strong plucks (nylon guitar, banjo, ukulele, pizzicato, upright bass), clarinet via odd-harmonic additive + breath noise + vibrato + portamento, brass via saw → envelope-controlled lowpass, string pads via detuned saws + slow attack + lowpass, drums from tuned sines + filtered noise, and a stereo reverb (Schroeder/Freeverb-style or FFT convolution with a decaying-noise IR). Compose real music: write chord progressions and melodies as note data with good voice leading; swing where appropriate.
Rules: deterministic for a given seed; never write outside ${ROOT}/build/audio_lab/ except your own module file; only edit the files you own (other agents are building other modules concurrently).
MANDATORY VERIFY LOOP: render every style/effect to ${ROOT}/build/audio_lab/*.wav, measure peak (≤0.9), RMS/loudness balance, DC offset, clicks (large sample-to-sample jumps, discontinuities at loop seams and segment ends), render spectrogram PNGs with numpy+PIL and LOOK at them with the Read tool, print the musical event schedule to sanity-check harmony, and time the render (60 s of music in < 15 s). Iterate until clean.
`

const tasks = args.tasks
const ISSUE_SCHEMA = {
  type: 'object',
  properties: {
    overall_score: { type: 'number', description: '0-10, 10 = ship it' },
    issues: { type: 'array', items: { type: 'object', properties: {
      severity: { type: 'string', enum: ['high', 'medium', 'low'] },
      issue: { type: 'string' },
      fix_suggestion: { type: 'string' } }, required: ['severity', 'issue', 'fix_suggestion'] } },
  },
  required: ['overall_score', 'issues'],
}

const common = (t) => (t.kind === 'audio' ? COMMON_AUDIO : COMMON_VISUAL)

const critique = (round) => (prev, t) => agent(
  `${common(t)}\n\nYou are an ADVERSARIAL ${t.kind === 'audio' ? 'audio engineer and composer' : 'art director'} reviewing the module(s) ${t.owns.join(', ')} (round ${round}). The original brief was:\n${t.brief}\n\nBuilder's latest summary:\n${String(prev).slice(0, 6000)}\n\n` +
  (t.kind === 'audio'
    ? `Render every style/effect, measure everything listed in the verify loop yourself (do not trust the builder's numbers), look at spectrograms, and read the composition code critically for musicality (harmony, voice leading, rhythm feel, swing, arrangement variety over a 60-90 s loop, how it sits under dialogue), API correctness (any duration from 0.3 s to 120 s; deterministic; shape (n,2); SR 48000), and speed. Assume it is NOT good enough yet and find concrete problems.`
    : `Render every lab sheet (and animation strips with --frames 8), LOOK at them, and write+run a tiny test that calls every exported function with edge-case options (flip, scale 0.5 and 2, rotation, every mood/pose/accessory/stage listed in DESIGN.md, several t values) to catch crashes and glitches. Judge: appeal & polish, anatomy/silhouette readability at small sizes, expressions distinct, palette per DESIGN.md, glitches (gaps, z-order errors, misaligned or detaching accessories when flipped/scaled/rotated, jaggies), animation smoothness (no popping), API completeness vs DESIGN.md and the screenplay's needs, performance. Assume it is NOT good enough yet; be specific and demanding.`) +
  ` Do NOT edit the module files — only report. Use files under ${ROOT}/build/lab or build/audio_lab for your test outputs.`,
  { label: `critic${round}:${t.key}`, phase: `Critique ${round}`, schema: ISSUE_SCHEMA })

const fix = (round) => (crit, t, i) => {
  if (!crit) return `no critique (round ${round})`
  const issues = crit.issues.filter(x => x.severity !== 'low' || crit.issues.length < 12)
  return agent(
    `${common(t)}\n\nYou own ${t.owns.join(', ')}. Original brief:\n${t.brief}\n\nAn adversarial reviewer scored the current version ${crit.overall_score}/10 and raised these issues:\n` +
    issues.map(x => `- [${x.severity}] ${x.issue} → suggestion: ${x.fix_suggestion}`).join('\n') +
    `\n\nFix every high and medium issue (low ones where cheap; you may decline a suggestion if it would make things worse — say why). Re-run the verify/review loop after fixing and confirm each fix visually/numerically. Keep the public API backward compatible (or document changes clearly). Return the updated API summary (signatures, options, anchors/exports) plus what you fixed and declined.`,
    { label: `fix${round}:${t.key}`, phase: `Fix ${round}` })
}

phase('Build')
const results = await pipeline(
  tasks,
  (t) => agent(`${common(t)}\n\nYOUR TASK:\n${t.brief}\n\nFILES YOU OWN (edit only these): ${t.owns.join(', ')}.\n\nReturn: a concise API summary (signatures, key options, exported anchors) that scene animators will use, the list of lab sheets / rendered test files, and known limitations.`,
    { label: `build:${t.key}`, phase: 'Build' }),
  critique(1),
  fix(1),
  critique(2),
  fix(2),
)
return tasks.map((t, i) => ({ key: t.key, final: results[i] }))
