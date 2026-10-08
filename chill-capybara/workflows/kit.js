export const meta = {
  name: 'chill-capybara-kit',
  description: 'Build the shared scene-staging kit (cast automation, camera rigs, layered stages) with adversarial review',
  phases: [
    { title: 'Build kit' },
    { title: 'Review 1' }, { title: 'Fix 1' },
    { title: 'Review 2' }, { title: 'Fix 2' },
  ],
}
const ROOT = '/home/user/star-wars-intro/chill-capybara'
const CONTEXT = `
Project: "CHILL CAPYBARA", a ~5 minute 2D animated comedy short rendered entirely in code (Node + @napi-rs/canvas → ffmpeg, 24 fps, 1280x720 design units). Premise: capybaras are the chillest animals on Earth; Barry (capybara in thick round Woody-Allen glasses) is a neurotic Woody Allen / Larry David type; everybody tells him to chill; HE WAS RIGHT — the dormant volcano erupts and his ridiculed preparations save everyone.

READ: ${ROOT}/DESIGN.md (contract; §4 scene module + SceneTime API), ${ROOT}/SCREENPLAY.md and ${ROOT}/src/script.py (final film — read it all), ${ROOT}/build/timeline.json (final timing; DO NOT modify script.py or the timeline), ${ROOT}/src/render.js (harness; it supports SCENES_DIR=<dir> to load scene modules from another directory), and the header comments + lab sheets of every library: src/lib/capybara.js, critters.js, props.js, env_spring.js, env_other.js, util.js, timeline.js (render sheets with: cd ${ROOT} && node src/lab.js <module> <sheet> build/lab/x.png ; sheet names via require(module).lab). NOTE: the capybara/critters/props/env modules are still receiving final polish from other agents concurrently — their APIs are stable, but if a module momentarily throws because it is mid-edit, wait a minute and retry; never edit them. Also note @napi-rs/canvas aborts the whole process (Rust panic) on some invalid inputs — guard against NaN/negative radii in anything you draw.

THE KIT: ${ROOT}/src/lib/kit.js is the shared staging library that ~10 scene animators (working in parallel next) will build every scene on, so the film is consistent. It must make the common things one-liners and the scenes look directed:
1. Cast automation: castOpts(S, who, extra) → full drawCapybara options for barry/sunny/doreen (+ extras) at the current time: talk from S.talk, mood from the active line (hold the mood ~0.7 s after the line ends, then ease back to a per-character resting mood: Barry worried, Sunny chill, Doreen chill — scenes can override), look direction toward the current speaker or the line's 'to' target (listeners glance at whoever speaks; speakers look at their addressee), blinks, small listening reactions (a slow nod, an eye-roll for Barry when Sunny says "bro") — deterministic. Same idea for geraldOpts(S, extra) and shelleyOpts(S, extra) (critters API).
2. Camera rig: cameraFor(S, framings, opts) → camera for util.withCamera based on S.cam() + S.camTime(): hard cuts, a subtle drift/push on every held shot, optional per-shot moves ({from,to,ease,dur}), shake support, and a safe fallback (warn once) for unknown names. Provide standard framings for the spring (SPRING_FRAMINGS: establishing, extras, wide, trio, barry_cu, sunny_cu, doreen_cu, gerald_cu, volcano, fish, thermometer, signs, rules, raft, helmet, escape, sign…) computed from env_spring anchors, plus OFFICE_FRAMINGS (office_wide, barry_couch, shelley_cu, window) and RIVER_FRAMINGS (raft_wide, barry_cu, gerald_flag, fish). Close-ups must frame faces (not bodies), keep heads out of the bottom subtitle strip (~120 px), and never reveal unpainted void.
3. Layered stages that handle z-order and water: drawSpringStage(ctx, t, S, cfg) for spring_day / spring_evening / new_spring (env background → hook 'behind' → extras → cast sorted by depth with waterline ripples → Gerald perched exactly on a capybara's head anchor (cfg.gerald: {on:'barry'|'sunny'|null, ...geraldOpts}) → hook 'afterCast' → translucent front water → hook 'afterWater' → foreground foliage; all inside the camera; then hook 'screen' in screen space). Cast positions default to SPRING.swimSpots with per-scene overrides; facing logic (Sunny on the left faces right, Doreen on the right faces left, Barry turns toward whom he addresses — with a quick squash-and-stretch turn rather than an instant flip). Equivalent helpers for the office (drawOfficeStage: Barry lying on the couch, Dr. Shelley in the chair, Gerald on Barry's head, front layer) and the river/raft (drawRaftStage: raft via props.drawRaft bobbing on the river, Barry/Sunny/Doreen sitting on it, Gerald on the flagpole top, soot/juice options, front water).
4. Small gag helpers scenes will need repeatedly: a "take" (anticipation-squash-overshoot) envelope, popIn/popOut scale envelopes, a turnToCamera helper for Barry's to-camera beats (barry_to_camera), shake envelopes for rumbles synced to sfx times (sfxTimes(S, name) → scene-local times from timeline.sfx), and timing helpers for beats.
Document every export in a header comment with a short usage example. Export a lab object too.

TESTING: build realistic demo scenes in ${ROOT}/build/kit_demo/<scene_id>.js (NOT in src/scenes — that directory belongs to the scene animators) using the kit, e.g. a quick s03_spring and s05_therapy and s08_aftermath, then render with:
  cd ${ROOT} && SCENES_DIR=build/kit_demo node src/render.js --sheet s03_spring build/kit_demo/s03.png --n 16
  SCENES_DIR=build/kit_demo node src/render.js --stills 30.1,30.3,30.5 build/kit_demo/strip.png
and LOOK at the PNGs with the Read tool. Measure ms/frame at 1920x1080 (the full spring stage with three capybaras + Gerald should stay under ~90 ms).
`
const ISSUE_SCHEMA = {
  type: 'object',
  properties: {
    overall_score: { type: 'number' },
    issues: { type: 'array', items: { type: 'object', properties: {
      severity: { type: 'string', enum: ['high', 'medium', 'low'] }, issue: { type: 'string' }, fix_suggestion: { type: 'string' } },
      required: ['severity', 'issue', 'fix_suggestion'] } },
  },
  required: ['overall_score', 'issues'],
}
phase('Build kit')
let summary = await agent(`${CONTEXT}\n\nYou own ${ROOT}/src/lib/kit.js and ${ROOT}/build/kit_demo/. Build the kit, test it thoroughly with demo scenes, iterate at least 4 visual passes. Return a complete API reference for the scene animators (signatures, options, framings list, examples) and known limitations.`, { label: 'build:kit', phase: 'Build kit' })
for (const round of [1, 2]) {
  const crit = await agent(`${CONTEXT}\n\nYou are an ADVERSARIAL ANIMATION SUPERVISOR reviewing ${ROOT}/src/lib/kit.js (round ${round}) before ten scene animators depend on it. Builder summary:\n${String(summary).slice(0, 6000)}\n\nRender the demo scenes yourself (and write additional quick demo scenes in ${ROOT}/build/kit_review${round}/ for other scenes: s04 rumble shake, s07 eruption evening + escape, s09 new_spring with Gerald on Sunny) and LOOK at them. Check: correctness of anchors (Gerald exactly on heads in every pose/flip/scale; cast on the raft), z-order and water layering, lip-sync and moods actually following the timeline, look-at-speaker logic, Barry's turn animation, every framing for every cam name used anywhere in script.py (no void, faces framed, nothing important under the subtitle strip), drift/shake quality, determinism, API ergonomics and docs, performance at 1920x1080. Do NOT edit kit.js — only report.`, { label: `review${round}:kit`, phase: `Review ${round}`, schema: ISSUE_SCHEMA })
  if (!crit) continue
  summary = await agent(`${CONTEXT}\n\nYou own ${ROOT}/src/lib/kit.js. An adversarial supervisor scored it ${crit.overall_score}/10:\n${crit.issues.map(x => `- [${x.severity}] ${x.issue} → ${x.fix_suggestion}`).join('\n')}\n\nFix every high and medium issue (low where cheap; decline with reasons if a suggestion would make it worse), re-test visually, and return the complete updated API reference for the scene animators plus what you fixed/declined.`, { label: `fix${round}:kit`, phase: `Fix ${round}` })
}
return summary
