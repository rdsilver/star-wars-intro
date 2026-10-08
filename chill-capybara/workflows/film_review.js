export const meta = {
  name: 'chill-capybara-film-review',
  description: 'Whole-film review of CHILL CAPYBARA (continuity, comedy staging, technical QA) then per-scene fixes',
  phases: [
    { title: 'Review', detail: '3 reviewers with different lenses over the whole film' },
    { title: 'Fix', detail: 'one fixer per scene with issues (+ libraries if needed)' },
  ],
}

const ROOT = '/home/user/star-wars-intro/chill-capybara'
const CTX = `
Project: "CHILL CAPYBARA", a 5:08 2D animated comedy short rendered entirely in code (Node + @napi-rs/canvas → ffmpeg, 24 fps, 1280x720 design units, final at 1920x1080). Premise: capybaras are the chillest animals on Earth; Barry (capybara in thick round Woody-Allen glasses) is a neurotic Woody Allen / Larry David type who keeps noticing things are wrong at Snooze Springs; everyone tells him to chill; HE WAS RIGHT — the "dormant" volcano Mount Snooze erupts and his ridiculed preparations save everyone.
Read: ${ROOT}/DESIGN.md, ${ROOT}/SCREENPLAY.md, ${ROOT}/CONTINUITY.md, ${ROOT}/src/script.py (docstring = callback map), ${ROOT}/build/timeline.json (final timing — never change script.py or the timeline). Scenes: src/scenes/s01_open … s10_end.js, built on src/lib/kit.js and the asset libraries.
Tools (cd ${ROOT}):
  node src/render.js --sheet <scene_id> out.png --n 24          contact sheet of a scene
  node src/render.js --stills t1,t2,... out.png [--cols 6]        grid of frames at absolute times
  node src/render.js --range T0 T1 out.mp4 [--size 640x360]       clip with audio
  ffmpeg -i clip.mp4 -vf fps=8,scale=480:-1,tile=6x4 grid.png     frame grids from a clip
LOOK at every PNG you make with the Read tool. Put your files in ${ROOT}/build/film_review/<your-lens>/.
`

const ISSUES = {
  type: 'object',
  properties: {
    overall_score: { type: 'number', description: '0-10 for the film through your lens' },
    issues: { type: 'array', items: { type: 'object', properties: {
      scene: { type: 'string', description: 'scene id (s01_open...s10_end) or "lib:<module>" for a library-level problem' },
      time: { type: 'string', description: 'absolute time or range' },
      severity: { type: 'string', enum: ['high', 'medium', 'low'] },
      issue: { type: 'string' },
      fix: { type: 'string' } }, required: ['scene', 'time', 'severity', 'issue', 'fix'] } },
  },
  required: ['overall_score', 'issues'],
}

const LENSES = [
  { key: 'continuity', text: `LENS: CONTINUITY & FLOW. Check every scene boundary (render stills from 1.0 s before to 1.0 s after each scene start, every ~0.15 s) for transition quality (cut/fade/wipe as specified), and check CONTINUITY.md state scene by scene: who wears what (Barry's glasses always; helmet from s06 helmet_on; orange states; soot/juice after the eruption), where Gerald is in every shot, thermometer readings (39.4 / 39.8 / pops / 39.2), which signs/props exist, lighting progression (day → golden hour → eruption red → sunset → bright new spring), consistent character scale/design/colours between scenes, the trio's fixed blocking (Sunny left, Barry centre, Doreen right). Also cross-check repeated motifs (sneeze puffs in s04 and s09, "Was that so hard?" beats, the S.S. TOLD YOU SO flag).` },
  { key: 'comedy', text: `LENS: COMEDY STAGING & STORY CLARITY. You are the film's director watching for laughs. Go through SCREENPLAY.md joke by joke; for every punchline and visual gag, render dense stills (0.1-0.2 s apart) across the setup → punch → reaction and judge: does it READ in one glance for a first-time viewer? Is the framing right (who is on screen when the line lands; is the reaction shot there)? Is the timing right (holds long enough, no stepping on laughs)? Are characters acting (expressions match the line's mood, listeners react, Barry's deadpan face on the deadpan lines, Sunny's blissed face)? Is "he was RIGHT" unmistakable in s07-s08 (each of Barry's warnings visibly pays off)? Flag dead stretches and anything confusing.` },
  { key: 'technical', text: `LENS: TECHNICAL QA. (1) Render the whole film at 640x360 (node src/render.js --range 0 308.6 build/film_review/technical/full.mp4 --size 640x360, run with env STRICT=1 so scene errors throw) and make frame grids of it; (2) look for any frame that shows an error placeholder, unpainted void at frame edges, popping (objects jumping between consecutive frames), flicker, z-order glitches, characters frozen while speaking (no lip-sync), subtitles covering faces or key action, illegible text; (3) check sfx-picture sync: for every sfx in timeline.json render stills at the sfx time ±0.1 s and confirm the matching visible action (bonk/splat/pop/hammer/flaps/land/explosion/glass_pop/splash/whoosh) happens on it; (4) measure ms/frame per scene at 1920x1080 (sample 12 frames per scene) and flag any scene over 250 ms/frame; (5) memory: note @napi-rs/canvas leaks Path2D objects — the final render runs in 20 s segments so this only matters if a single 20 s segment exceeds ~2.5 GB RSS; check the heaviest segment (s07 around 190-230 s).` },
]

phase('Review')
const reviews = await parallel(LENSES.map(l => () => agent(
  `${CTX}\n${l.text}\n\nDo NOT edit any source files — only report. Be specific (scene id + absolute time) and constructive; prioritise what an audience would notice.`,
  { label: `review:${l.key}`, phase: 'Review', schema: ISSUES })))

const all = []
reviews.forEach((r, i) => { if (r) for (const x of r.issues) all.push({ ...x, lens: LENSES[i].key }) })
const actionable = all.filter(x => x.severity !== 'low')
log(`review scores: ${reviews.map((r, i) => `${LENSES[i].key}=${r ? r.overall_score : 'n/a'}`).join(', ')}; ${all.length} issues (${actionable.length} high/medium)`)
const byScene = {}
for (const x of all) (byScene[x.scene] = byScene[x.scene] || []).push(x)
const targets = Object.keys(byScene).filter(k => byScene[k].some(x => x.severity !== 'low')).sort()
if (Object.keys(byScene).some(k => !targets.includes(k))) log(`low-only (fixers still see them if they also have high/medium): ${Object.keys(byScene).filter(k => !targets.includes(k)).join(', ')}`)

phase('Fix')
const libTargets = targets.filter(k => k.startsWith('lib:'))
const sceneTargets = targets.filter(k => !k.startsWith('lib:'))
const fixes = await parallel([
  ...libTargets.map(k => () => agent(
    `${CTX}\nYou own ${ROOT}/src/lib/${k.slice(4)}.js. Whole-film reviewers found these library-level issues:\n` +
    byScene[k].map(x => `- [${x.severity}] (${x.lens}) @${x.time}: ${x.issue} → ${x.fix}`).join('\n') +
    `\n\nFix the high and medium ones without breaking the public API (scene files depend on it — re-render sheets of every scene that uses the module and LOOK at them to confirm nothing regressed). Return what you changed.`,
    { label: `fix:${k}`, phase: 'Fix' })),
  ...sceneTargets.map(k => () => agent(
    `${CTX}\nYou own ${ROOT}/src/scenes/${k}.js (edit only this file; library owners are done — work around library limits inside your scene). Whole-film reviewers found these issues in your scene:\n` +
    byScene[k].map(x => `- [${x.severity}] (${x.lens}) @${x.time}: ${x.issue} → ${x.fix}`).join('\n') +
    `\n\nFix every high and medium issue (low where cheap; decline only with a reason). Re-render the affected moments (dense stills) and the scene's contact sheet and LOOK at them to verify each fix and that nothing else regressed; confirm the scene renders with STRICT=1 (STRICT=1 node src/render.js --range <scene start> <scene end> /tmp/x.mp4 --size 320x180 --noaudio). Return what you changed and declined.`,
    { label: `fix:${k}`, phase: 'Fix' })),
])
return { scores: reviews.map((r, i) => ({ lens: LENSES[i].key, score: r && r.overall_score })), issues: all.length, fixes: fixes.map(f => String(f).slice(0, 1500)) }
