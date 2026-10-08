export const meta = {
  name: 'chill-capybara-scenes',
  description: 'Animate CHILL CAPYBARA scenes: per-scene animator, two rounds of adversarial direction + revision',
  phases: [
    { title: 'Animate', detail: 'one animator per scene' },
    { title: 'Direct 1', detail: 'adversarial animation director' },
    { title: 'Revise 1' },
    { title: 'Direct 2' },
    { title: 'Revise 2' },
  ],
}

const ROOT = '/home/user/star-wars-intro/chill-capybara'
const PY = '/tmp/claude-0/-home-user-star-wars-intro/34651c74-2ed0-5286-bc53-ab12f3f7ca2d/scratchpad/venv/bin/python'

const COMMON = `
You are an animator on "CHILL CAPYBARA", a ~5 minute 2D animated comedy short rendered entirely in code (Node + @napi-rs/canvas → ffmpeg, 24 fps, 1280x720 design units). Premise: capybaras are the chillest animals on Earth; Barry (a capybara in thick round Woody-Allen glasses) is a neurotic Woody Allen / Larry David type who keeps noticing things are wrong at Snooze Springs; everybody tells him to chill; HE WAS RIGHT — the "dormant" volcano Mount Snooze erupts and his ridiculed preparations save everyone.

READ FIRST, in this order:
1. ${ROOT}/DESIGN.md (the contract — §4 scene module API and SceneTime helpers, §5 settings and layout, §6 characters/props).
2. ${ROOT}/SCREENPLAY.md (the film as written), ${ROOT}/src/script.py (the same as data — beats, cues, cams, sfx; its docstring has the CALLBACK MAP and animation notes) and ${ROOT}/CONTINUITY.md (per-scene state: who wears what, where Gerald is, which props exist — other scenes are animated in parallel, so follow it exactly).
3. ${ROOT}/build/timeline.json (FINAL measured timing: lines with mouth envelopes, cues/beats, cams, sfx times). It is final — do not change script.py or the timeline.
4. The header comments of every library module: ${ROOT}/src/lib/kit.js (shared staging helpers — USE THEM for consistency), capybara.js, critters.js, props.js, env_spring.js, env_other.js, util.js, timeline.js. Render their lab sheets (node src/lab.js <module> <sheet> build/lab/x.png; list sheets via the module's lab export) and LOOK at them so you know what the assets look like.
5. ${ROOT}/src/render.js (harness: transitions, subtitles, vignette are handled for you).

HEAD START: the kit's author wrote a quick demo version of every scene in ${ROOT}/build/kit_demo/<scene_id>.js (render it with SCENES_DIR=build/kit_demo node src/render.js --sheet <scene_id> out.png). Start from it (copy it to src/scenes/<scene_id>.js) if it's useful, then make it genuinely great — it is a rough blocking pass, not a finished scene.
CONCURRENT FIXES: kit.js and env_spring.js are receiving a final fix pass IN PARALLEL with your work (APIs stay backward compatible; if a module momentarily fails to load, wait a minute and retry). Known issues being fixed there right now — do NOT build elaborate workarounds for these, just note them under LIB ISSUES if they bite: (kit) Barry mirror-flipping when another capybara is hidden, Gerald riding a host off-screen then teleporting, whip pans after close-up turns, raft-with-passengers on the spring stage (s07 board_raft/raft_launch), escape framing jumps, timed camera moves leaking into later shots of the same name, sfx-driven helpers keyed to old sfx names, s08 raft blocking for doreen_orange; (env_spring) eruption onset glitches, popping steam wisps, clip-art lava, weak plume composition at zoom 1, hard-edged glows, clip-art sign fire, eruption rim-light direction, the s09 hill sneeze look, ')))' marks at the river mouth, climax-frame performance. The full critique files are ${ROOT}/build/wf/critique_kit_r2.md and critique_env_spring_r2.md.

RULES:
- You own exactly one file: ${ROOT}/src/scenes/<scene_id>.js (module.exports = { render(ctx, t, S) }). Do NOT edit any other file (other animators work concurrently; library owners are done). If a library has a bug or lacks something you need, work around it inside your scene file (scene-local drawing code is fine) and report it in your summary under "LIB ISSUES".
- render must be a pure function of time: deterministic, no state across frames, no Math.random.
- @napi-rs/canvas aborts the whole process (Rust panic, uncatchable) on some invalid inputs: guard every radius/size against NaN/negative values and keep ctx.save()/restore() balanced.
- The music, sfx and dialogue are already mixed (build/audio.wav) from the timeline — you only make pictures, but they must sync to that soundtrack.
- Implement EVERY camera name the scene uses (S.cam()) as a deliberate framing (use util.withCamera + a subtle drift; never show unpainted void at frame edges), and animate EVERY beat/cue of the scene within its exact time window (S.cue/S.prog/S.since). Sync visible actions to the sfx times in the timeline (a BONK must hit on the bonk frame; flaps must match wing beats; the hammer must land on each knock).
- Characters must always feel alive: lip-sync (S.talk), moods from the active line (kit helpers do this), blinks, breathing, listeners look at the speaker and react (a small take, a glance, an eye-roll) — comedy lives in reactions. Use anticipation, overshoot and holds (ease.outBack etc.) for gags; take the time to make each joke READ in one glance.
- Subtitles are drawn by the harness in the bottom ~120 px of the frame while someone speaks: keep faces and key action out of that strip during dialogue.
- Text on signs/props must be legible at 1080p.
- Performance: measure ms/frame for your scene at 1920x1080 (e.g. node -e script using render.js makeRenderer) — keep it under ~120 ms.

MANDATORY REVIEW LOOP (do at least 4 passes):
  cd ${ROOT} && node src/render.js --sheet <scene_id> build/review/<scene_id>.png --n 24
  node src/render.js --stills <t1,t2,...> build/review/<scene_id>_beat.png     (absolute times; use dense strips 0.08-0.15 s apart around every gag/beat to check motion)
  node src/render.js --scene <scene_id> build/review/<scene_id>.mp4            (must render without errors)
LOOK at every PNG with the Read tool. Be a demanding director: does every joke land visually? Is it beautiful? Is anything glitchy, frozen, popping, misaligned or off-model?
`

const ISSUE_SCHEMA = {
  type: 'object',
  properties: {
    overall_score: { type: 'number', description: '0-10, 10 = ship it' },
    issues: { type: 'array', items: { type: 'object', properties: {
      severity: { type: 'string', enum: ['high', 'medium', 'low'] },
      time: { type: 'string', description: 'absolute time or range, e.g. 63.2-65.0' },
      issue: { type: 'string' },
      fix_suggestion: { type: 'string' } }, required: ['severity', 'time', 'issue', 'fix_suggestion'] } },
  },
  required: ['overall_score', 'issues'],
}

const scenes = args.scenes

const direct = (round) => (prev, sc) => agent(
  `${COMMON}\n\nYou are the ADVERSARIAL ANIMATION DIRECTOR (round ${round}) reviewing scene ${sc.id} (${sc.summary}). You do NOT edit files — you report. The animator's latest summary:\n${String(prev).slice(0, 5000)}\n\nRender the contact sheet and dense still strips around every beat, cue and punchline yourself (times from build/timeline.json), and LOOK at them. Compare against SCREENPLAY.md shot by shot. Hunt for: beats that are missing or don't read; jokes that are not staged for maximum clarity (wrong framing, too small, too fast, no reaction shot, no hold); dead characters (no lip-sync, no blinks, no listening reactions, frozen poses); off-model or glitchy drawing (accessories detaching, z-order errors, gaps, popping between frames, flipped faces); camera problems (void edges, awkward framing, faces cut off, action under the subtitle strip); continuity errors vs the screenplay (who wears what, where Gerald is, thermometer readings, sign texts); illegible text; sync errors vs sfx times; performance > 120 ms/frame. Assume it is NOT good enough yet; be specific (absolute times) and constructive.`,
  { label: `director${round}:${sc.id}`, phase: `Direct ${round}`, schema: ISSUE_SCHEMA })

const revise = (round) => (crit, sc) => {
  if (!crit) return `no direction notes (round ${round})`
  return agent(
    `${COMMON}\n\nYou own src/scenes/${sc.id}.js (${sc.summary}). The director scored the current cut ${crit.overall_score}/10 with these notes:\n` +
    crit.issues.map(x => `- [${x.severity}] @${x.time}: ${x.issue} → ${x.fix_suggestion}`).join('\n') +
    `\n\nAddress every high and medium note (low ones where cheap; you may decline a note that would make the scene worse — say why). Re-run the review loop and confirm each fix visually. Return: what you changed, what you declined, LIB ISSUES, and the measured ms/frame.`,
    { label: `revise${round}:${sc.id}`, phase: `Revise ${round}` })
}

const results = await pipeline(
  scenes,
  (sc) => agent(`${COMMON}\n\nYOUR SCENE: ${sc.id} — ${sc.summary}\n${sc.notes || ''}\n\nWrite ${ROOT}/src/scenes/${sc.id}.js, then iterate with the review loop until it is genuinely great. Return: a summary of your staging (per camera and beat), LIB ISSUES, and the measured ms/frame.`,
    { label: `animate:${sc.id}`, phase: 'Animate' }),
  direct(1),
  revise(1),
  direct(2),
  revise(2),
)
return scenes.map((s, i) => ({ id: s.id, final: results[i] }))
