// CHILL CAPYBARA — scene KIT: shared staging so every scene is consistent and "directed".
// Scene animators build on this; it wraps the asset libraries (capybara, critters, props,
// env_spring, env_other) into one-liners. Everything is a PURE function of (S, t, cfg): no state
// between frames, seeded noise only; per-scene schedules (moods, gazes, turns) are memoised per
// timeline + scene and never depend on render order (safe for --final workers).
//
//   const K = require('../lib/kit');              // from src/scenes/<id>.js
//   module.exports = { render(ctx, t, S) {
//     K.drawSpringStage(ctx, t, S, { gerald: { on: 'barry' } });   // that's a whole scene
//   } };
//
// Times anywhere in the kit (land.t0, move.at, rest / facing keys...) may be scene-local seconds
// OR cue references: 'vulture_lands', 'helmet_on+0.5', 'eruption-0.2', 'board_raft@end'
// (K.keyTime; a typo throws, like S.cue).
//
// ═════════════════════════════════════════════════════════════════════════════ STAGES
// drawSpringStage(ctx, t, S, cfg) → st      spring_day | spring_evening | new_spring
//   Draw order (all inside the camera except 'screen'):
//     env background (drawSpringDay/Evening/NewSpring with cfg.env)
//     → Gerald when his layer is 'behind' (perched on the rules sign: the board covers his tail)
//     → hooks.behind(ctx, st)                 signs, raft, props on the banks
//     → DEPTH-SORTED swimmers/items (by waterline y, far → near). For each one in the water:
//         back ripple (env palette colour) → draw → its own translucent front water (a nearer head
//         is never covered by the water of one further back). Gerald is drawn right after his
//         host, his feet exactly on the host's DRAWN head top (turns / takes included); he takes
//         half of the host's squash himself.
//     → hooks.afterCast(ctx, st)              in front of everyone (flying oranges, splats…)
//     → drawSpringOverlay (front steam veil, ash, embers, rumble dust, eruption flash)
//     → hooks.afterWater(ctx, st)             above every water/steam layer
//     → foreground framing foliage (screen-space with parallax; auto on wide framings)
//     → hooks.screen(ctx, st)                 SCREEN space (captions, flashes, title overlays)
//   cfg = {
//     setting   default S.scene.setting
//     env       {volcanoSmoke, waterHeat, rumble, erupt, lava, dusk, signBurn, puffs, ...} or
//               fn(S) → obj. rumble defaults to K.rumbleLevel(S) (from rumble/explosion sfx).
//     cast      { barry: {...}, sunny: {...}, doreen: {...} } per-character castOpts extras (any
//               drawCapybara option + kit options, see CAST). false = not in the scene,
//               {hidden: true} = not drawn this frame. Positions default to SPRING.swimSpots
//               (the same spots in new_spring); x/y/scale/pose override per frame.
//               inWater (default pose==='swim') → ripples + front water.
//     extras    false (default) | true / 'back' (EXTRAS.back: 4 dozers along the back of the pool,
//               clear of the trio) | 'open' (EXTRAS.open — s01: the extras ARE the pool, a bird on
//               one's head, an orange hat on another; use with cast {sunny: false, doreen: false})
//               | [{x, y, scale, flip, seed, mood, eyes, accessories, ...}]
//     gerald    null/false | GERALD cfg (below)
//     items     [{ y, x, draw(ctx, st), water: false | true | {w, depth} }] custom depth-sorted
//               drawables (a floating orange, the thermometer in the water, a splash)
//     hooks     { behind, afterCast, afterWater, screen }  fn(ctx, st)
//     framings  {name: framing} merged over SPRING_FRAMINGS;  camera: cam obj | fn(S, st)
//               (bypasses the rig; still clamped to the painted world, cam.shake made smooth)
//     cam       cameraFor opts (moves, shake, shakeGain, push, drift, name, fallback, trioFrom)
//     overlay   true | false | {extra overlay opts};  foliage 'auto' | true | false | number |
//               {sides, amount, top};  waterOpacity
//     light     false | {tint:{color, amount}, rim}  (default per setting / eruption, K.lightFor)
//   }
//   st = { S, t, T, setting, kind, A (SPRING / NEW_SPRING), env, cam, layout,
//          cast: {who: {opts, anchors (squashed, = what is drawn), extra}},
//          gerald: {opts, anchors, host, layer, mode, perch, perchHead} | null, extras: [{opts}],
//          culled: [...], toScreen(p), toWorld(p) }   (office: + st.shelley; river: + st.raft)
//   EXAMPLE
//     K.drawSpringStage(ctx, t, S, {
//       env: { volcanoSmoke: 0.5 },
//       gerald: { on: 'barry', land: { beat: 'vulture_lands', from: { x: 1380, y: 40 } } },
//       hooks: { behind: (c, st) => K.drawRulesSign(c, st.T, { setting: st.setting }) },
//     });
//
// GERALD cfg (all stages) — `on` is where he is perched at rest:
//     on: 'barry' | 'sunny' | 'doreen'   on that head (rot = head angle, scale .75 × host, faces
//                                     with the host). A HIDDEN / cast:false host leaves him where
//                                     its head would be at its default spot (s09: left hanging
//                                     in mid-air when Sunny bolts) — add pose:'fly' to flap.
//     on: 'rules'                     spring: top edge of the standard SPRING RULES sign (setting-
//                                     aware, scale .6, layer 'behind'; dx nudges along the edge,
//                                     sign: {...} for a non-standard sign)
//     on: 'mast' | 'flag'             raft: the mast top / sitting on the banner. 'flag' drives
//                                     props' flagPerch, so his weight bunches the banner to "S.S."
//     on: {x, y, scale, flip, rot}    free perch anywhere (or x/y/scale directly in the cfg);
//                                     depthY = where he sorts among the swimmers (default front)
//     on: castOpts object             on that exact (standalone) capybara
//   choreography (critters' continuous geraldLanding / geraldTakeoff / geraldHop rigs):
//     land:    {t0 | beat, dur, from: {x, y} (world) | {dx, dy} (critters-relative), touch}
//              glide → flare → braking flaps → touch-down → absorb → fold. The TOUCH-DOWN syncs to
//              a 'land'/'thud' sfx inside the beat (else t0 + dur − .42; touch: time|false to
//              override); the approach starts ≥ 1 s before it. He arrives facing his travel
//              direction and, if the perch faces the other way, does a quick on-the-spot turn
//              (x-squash) after settling. dur defaults to the cue's dur at t0, else 1.6.
//     takeoff: {t0 | beat, dur = 1.5, to: {x, y} | {dx, dy}}  unfold + crouch, leap on the first
//              downstroke, accelerating climb (turns on the perch first if `to` is behind him).
//              Gone after t0 + dur.
//     hop:     {t0 | beat, dur = .9, from: perch} → hops INTO `on`;  {..., to: perch} → hops OUT
//              of `on`. Perches as above ('rules', 'barry', 'mast', 'flag', {x,y}...), live (a
//              moving host is followed). style: 'shuffle' = low, half-folded sidle (s08: shuffles
//              down the pole onto the flag). Turns as needed (before leaving / after landing).
//   + any drawVulture / geraldOpts option (mood, look, lookAt, talk, wing, nod, crouch, ruffle,
//     pose ...) wins; layer: 'behind' forces the behind-the-props layer; hidden: true.
//   EXAMPLES
//     gerald: { on: 'barry', hop: { t0: 'gerald_ignores_rules+1.0', dur: 0.8, from: 'rules' } }
//     gerald: { on: 'flag', hop: { t0: 'gerald_covers_flag+0.5', dur: 0.85, from: 'mast', style: 'shuffle' } }
//     gerald: { on: 'rules', takeoff: { beat: 'vulture_leaves', to: { x: 1500, y: -200 } } }
//
// drawOfficeStage(ctx, t, S, cfg) → st      therapy_office
//   office bg (cfg.env: puff (auto, below), volcanoSmoke, hourglass, oranges, clear) → Gerald if
//   layer 'behind' → hooks.behind → Dr. Shelley (shelleyOpts + cfg.shelley) → Barry lying on the
//   couch (castOpts + cfg.cast.barry; pose 'lie') → Gerald (cfg.gerald, default {on:'barry'})
//   → cfg.items (y order) → hooks.afterCast → drawTherapyOfficeFront → hooks.afterWater → screen.
//   Framings: OFFICE_FRAMINGS. cfg.shelley: shelleyOpts overrides (neck, look, note…) | false.
//   WINDOW PUFF (env.puff) is keyed so the gag plays ON CAMERA (K.PUFF_KEYS, K.officePuffKeys):
//     window_puff start → end: 0 → .55 (two little "pff"s, the big dark billow forms in shot)
//     → shelley_turns: .55 → .60 (lingers through the barry_couch cut-away)
//     → shelley_turns + 70 %: .62 → .97 (blown out of the pane; clear sky just before his eye
//     arrives) → 1. cfg.puff: number | fn(S) | [[t, v]...] | {formed, linger, blow, clear,
//     turnFrac} (retime the anchors).
//   EXAMPLE  K.drawOfficeStage(ctx, t, S, { shelley: { neck: -0.8 * K.bump(S.t, S.cue('shelley_turns'), 2.4) } });
//
// drawRaftStage(ctx, t, S, cfg) → st        river_sunset
//   river bg (env.volcano = the barry_cu cheat for that shot) → hooks.behind → [reflection pass]
//   → raft layer 'back' (mast, banner, rear bundles) → hooks.onRaft → passengers (ground on the
//   deck's sit line) → raft layer 'front' (the front bundle hides their bottoms: they sit IN the
//   raft) → Gerald → cfg.items (y order) → hooks.afterCast → drawRiverFront (cfg.grade) →
//   hooks.afterWater → hooks.screen.
//   cfg.reflection: 'auto' (default: zoom < 2.2) | true | false. It uses env_other's drawSource
//   path, so the raft + cast are rendered ONCE per frame (items with reflect:true are mirrored).
//   cfg.raft: props.drawRaft overrides {x, y, scale (1.1), bob (1), wake, dir (+1: drifting RIGHT,
//   away from the volcano), flagText, flagShow, flagPerch (auto from gerald 'flag'; false = off)}.
//   BLOCKING (K.RAFT_SEATS, deck-local): Sunny −158 stern (faces right), Doreen −30 amidships
//   (faces left, toward Sunny), Barry +84 at the bow facing AHEAD — the mast rises between Doreen's
//   and Barry's backs, never out of a head. cfg.cast[who].seatX / pose ('sit') / scale (.55–.58)
//   / flip override. Auto-turns are OFF on the raft (turn: true opts in); Barry answers people
//   behind him with his eyes. Defaults: soot .35 on everyone (cfg.soot), Doreen's juice .4
//   (cfg.juice), Barry's helmet. Off-screen passengers are culled (st.culled).
//   Framings: RIVER_FRAMINGS.  st.raft = {opts, anchors, rest (bob-free anchors)}.
//   EXAMPLE  K.drawRaftStage(ctx, t, S, { gerald: cover ? { on: 'flag', hop: {...from: 'mast'} } : { on: 'mast' },
//              cast: { barry: { accessories: { orange: orangeOn } } } });
//
// ═════════════════════════════════════════════════════════════════════════════ CAST
// castOpts(S, who, extra) → drawCapybara options for 'barry'|'sunny'|'doreen'|'extra' NOW:
//   talk     S.talk(who) × extra.talkGain                      (extra.talk overrides)
//   mood     the active line's mood, eased in over .22 s starting .1 s before the voice, held
//            .7 s after the line, then eased (.6 s) to the resting mood. Continuous everywhere (a
//            line that starts mid-ease blends from the actual mix). Resting moods: REST_MOOD
//            (barry worried, sunny chill, doreen chill, gerald smug, shelley neutral) unless
//            SCENE_DEFAULTS says otherwise (below). extra.rest: 'mood' | [[t | 'cue+0.3', 'mood'],
//            ...] (keyed, crossfaded .5 s) | fn(t). extra.mood overrides everything (string or
//            {name: weight}).
//   look     speakers look at their addressee (line.to), listeners glance at whoever speaks
//            (per-character reaction delay .12–.34 s), .14 s saccades; Barry darts his eyes when
//            idle (not when chill/sleepy). Gerald on your own head → look up (he looks down).
//            extra.lookAt: 'sunny'|'barry'|'doreen'|'gerald'|'shelley'|'volcano'|'camera'|'up'|
//            'down'|{x,y};  extra.look = {x,y} overrides;  extra.dart:false.
//   headTilt tilts toward what they look at, chill listeners (Sunny/Doreen) nod when addressed,
//            a speech accent + a lift on '!'/'?' lines; extra.headTilt absolute, extra.tiltAdd
//            additive, extra.nod:false.
//   reactions Barry rolls his eyes on each "bro" Sunny says (word time from the lip-sync
//            envelope). The roll's weight = 1 − (share of chill/happy/smug/sleepy in his current
//            mood blend), × (1 − his turn) — it fades in/out, never pops. extra.reactions:false.
//   facing   Barry turns toward whom he addresses (.2 s before his line) and toward whoever
//            addresses him (.3 s after they start; deferred past a 'bro' eye-roll): a .3 s
//            squash-and-stretch turn swinging through the rig's 3/4 head (headTurn bump masks the
//            mirror flip) + a .16 s overshoot. RULES: a turn never starts < .35 s before a cut,
//            never spans one and never starts < .12 s after one — it moves .2 s into the new shot
//            (or happens AT the cut, unsquashed, if that shot is too short); it is SKIPPED when
//            he is calm (his line's mood, or his mood when addressed, is chill/sleepy) unless
//            extra.turn === 'always'. Sides come from the DEFAULT blocking (moving someone never
//            rewrites the history → no instant flips); extra.turnSides:'live' uses live x.
//            Others keep their blocking (Sunny → right, Doreen → left). A scene that MOVES a
//            capybara (runs, re-blocks) passes flip (fixed facing) or extra.facing =
//            [[t | 'cue', 'left'|'right'], ...] (keyed squash turns); extra.turn: false/true.
//   toCamera Barry's 'barry_to_camera' cue/beat (s01, s05) → headTurn via turnToCamera (wins over
//            a facing turn).
//   squash   extra.squash = {sx, sy, dy} (e.g. a K.take) multiplies into the turn squash.
//   light    per-setting tint/rim (golden hour → lava glow with env.erupt, sunset, lamp);
//            extra.tint / extra.rim override.
//   + any drawCapybara option in extra wins (pose, eyes, pawUp, scale, x, y, ...); accessories
//   are merged. Kit metadata: o.kit = {sx, sy, dy, face, gaze, moodName, inWater, turning}.
//   EXAMPLE (without a stage)
//     const b = K.castOpts(S, 'barry', { accessories: { helmet: true }, rest: 'deadpan' });
//     K.drawCast(ctx, b);
//     CR.drawVulture(ctx, K.geraldOpts(S, { on: b }));     // perched on that exact head
// SCENE_DEFAULTS (merged UNDER each cast entry; whatever the scene passes wins):
//   s07_eruption  barry rest worried → 'barry_orange+1.6' chill (the 12 seconds) → 'barry_eyes_open+0.3' worried
//   s08_aftermath barry rest deadpan → 'doreen_orange+0.6' chill; no eye-rolls ("Welcome to chill, bro.")
//   s09_epilogue  barry rest chill, no eye-rolls (no addressed turns while blissed out);
//                 sunny + doreen rest worried
// drawCast(ctx, o)          drawCapybara + the kit squash/turn/take (NaN-guarded).
// castAnchors(o)            capyAnchors exactly where drawCast draws them (squash about the
//                           origin, then dy·scale·sy): K.castAnchors(st.cast.barry.opts).paw.
// squashPoint(o, p)         one rig point → where drawCast draws it.
// geraldOpts(S, extra)      drawVulture options: talk, mood (held / rest 'smug'), look at the
//   speaker or his addressee (down at the host when the host speaks). extra.on = 'barry' | a
//   castOpts object → perched on that head; any vulture option in extra wins.
// shelleyOpts(S, extra)     drawTortoise options: in the chair (OFFICE.chair, flip), talk, mood,
//   look at whoever speaks (Barry; up at Gerald when Gerald speaks), write = beat progress of
//   'shelley_writes' (undefined before it). extra wins (neck, look, note, notepad...).
// landTiming(S, land) → {t0, dur, touch, end}   the resolved landing schedule (see GERALD).
// turnEnv(t, t0, fromFlip, toFlip, dur=.26) → {flip, sx, lift, active}   quick on-the-spot turn
//   (x-squash through ~.2, flip at the middle). EXAMPLE: withSquash(ctx, o.x, o.y, e.sx, 1, draw).
// geraldFlight(t, f) → {x, y, pose, pose2, poseMix, legs, wing, fold, flip, rot, u}  LOW-LEVEL arc
//   (f = {t0, dur, from, to, mode:'land'|'takeoff', arc}); poses blend continuously, he faces his
//   travel direction. Prefer cfg.gerald land/takeoff/hop.
// turnToCamera(S, name='barry_to_camera', o) → {headTurn, k, active, tIn, tOut, sx, sy}
//   headTurn 0→1 over o.inDur (.5 s) from the cue, held to the end of who's next line (+ o.tail
//   .25 s; o.until overrides). If the next cut / the scene end comes within o.holdCut (1.2 s)
//   after that, the stare is HELD through it (the button never eases back on screen); o.hold:
//   'cut' always holds to the next cut, false never. Back over o.outDur (.4 s). The rig's headTurn
//   is continuous (profile in-betweens 0–.47, a quick .47–.53 dissolve, then the 3/4 head), so
//   the .5 s turn reads as a turn with one smear frame; sx/sy = a small squash pop at the swap.
// moodAt(S, who, rest?, t?) → {weights, name}     gazeAt(S, who, L, me, mood, o) → {x, y, target}
// facingAt(S, who, L, cc, t?) → {flip, face (−1..1 smoothed), sx, sy, turning, headTurn, k}
// buildLayout(S, cfg) → L = {setting, kind, chars: {who: {x, y, home, scale, flip, face, eye,
//   eyeSmooth, headTop, headTopSmooth, rest (raft), cc...}}, gerald: {host, head}, points, raft}.
//   Anchor offsets are BOB-FREE (mean over the idle cycle): cameras built on them never float.
// lightFor(setting, env) → {tint, rim} | null
//
// ═════════════════════════════════════════════════════════════════════════════ CAMERA
// cameraFor(S, framings, opts) → {x, y, zoom, rot, shake: 0, shakeAmp, t, name, tShot, base, foliage}
//   (ready for U.withCamera). The stages call it for you; use cfg.cam to pass opts.
//   framing = {x, y, zoom, rot?, push?, drift?, shake?, foliage?, move?, moves?} or fn(I) →
//   framing, with I = {S, L (layout), st (resolved cast/gerald/shelley/env), shot, kind, name, opts}.
//   * hard cuts on S.cam() changes; every held shot gets a subtle push (+0.6 %/s wide, +0.9 %/s
//     close, capped +6 %) and a slow float that alternates direction per shot. push:0 / drift:0.
//   * moves: {to: {x,y,zoom} | 'base' | fn(I), from?, at? (time or 'cue+0.2') | delay? (s after
//     the cut), dur? (default: to the next cut), ease: 'inOutCubic'} — one or an array, applied
//     in order. opts.moves = {shotName: move | [moves]}.
//   * shake: amplitude (screen px) from the scene's sfx (SHAKE_SFX: rumble_small 5, rumble_big 13,
//     explosion 22, boil, bonk, thud, land, hammer, big_splash, splat, glass_pop) × opts.shakeGain;
//     opts.shake: false | number | fn(S) adds; framing.shake adds. Rendered as a smooth 2-octave
//     rumble (K.shakeOffset: value noise at 7 Hz + 1.5 Hz, consecutive frames correlated; rotation
//     ≤ 0.8°) folded into x/y/rot — cam.shake is 0, the amplitude is cam.shakeAmp.
//   * clamped to the painted world (WORLD[kind]) with the shake + rotation margin; close framings
//     (zoom ≥ 1.5) in the spring stay inside WORLD_CLOSE (finished art: y ≥ −150, x ≤ 1450).
//   * unknown names → opts.fallback | 'wide' | 'trio' + a one-time console warning.
//   opts.name forces a framing; opts.setting / opts.kind pick world bounds; opts.trioFrom
//   'default' (the swimSpots) | 'live' (live, visible, in-pool swimmers); opts.trioWho [names].
//   EXAMPLE  K.drawSpringStage(ctx, t, S, { cam: { moves: { signs: { at: 'sunny_sign_planted',
//              dur: 0.6, to: { x: 230, y: 447, zoom: 2.7 } } }, shakeGain: 1.4 } });
// SPRING_FRAMINGS
//   establishing (full view, push) · establishing_push (wide → Barry over the whole shot) ·
//   extras (pan along the extras' row; pair with extras:'open') · wide ·
//   trio (fits the DEFAULT swimSpots, waterline at screen y 610: never re-fits when someone moves,
//   bolts or hides; opts.trioFrom:'live' to follow) · two_shot_sunny / two_shot_doreen ·
//   barry_cu / sunny_cu / doreen_cu (faces, scale-normalised, face-smoothed; wider + lower when
//   Gerald sits on that head) · gerald_cu (his PERCH — landing target / take-off perch / the
//   hop's perch for this shot — never the flight: he flies in/out of a locked frame) ·
//   volcano (holds the 'orange_rolls' beat: tilts from the grove down to the back-right of the
//   pool + the SNOOZE SPRINGS board; else the crater with sky for sneeze puffs; pulls back as
//   env.erupt grows) · fish (left rim + river outlet) · thermometer (SPRING.thermometerSpot, z4.4)
//   · signs (the EXIT row at z2.4, Sunny's face lower right, above the subtitles) · rules (the
//   rules sign + Barry's head below it, both above the subtitles; new_spring aware) · raft (the
//   moored raft) · helmet (a medium on Barry) · escape (rides the runners — cast out of the water
//   — along the bank to the raft) · sign (spring: the SNOOZE SPRINGS board + Doreen below it;
//   new_spring: SNOOZE SPRINGS 2 + the rules sign beside it).
// OFFICE_FRAMINGS  office_wide, barry_couch, shelley_cu, window (Shelley + the porthole behind
//   him, the whole puff gag), gerald_cu.
// RIVER_FRAMINGS   raft_wide · barry_cu (z4 on Barry at the bow, open water ahead; Mount Snooze
//   CHEATED via env.volcano to peek over his head-back, smoking out of frame — fixed per shot,
//   framed on his bob-free seat) · sunny_cu · doreen_cu · gerald_flag (mast top + banner + Gerald
//   only; the passengers' heads stay below the frame) · gerald_cu · fish · volcano (distant Mount
//   Snooze, cast below the frame) · wide.
// faceFrame(L, who, {zoom, eyeY=330, k=.75, dx, norm=.8}) → close-up framing on who's face: eye at
//   screen y eyeY, camera k of the way body → eye, zoom given for scale 1 and divided by
//   scale^norm. EXAMPLE: framings: { barry_cu: (I) => K.faceFrame(I.L, 'barry', { zoom: 3.2, eyeY: 320 }) }
// trioFrame(I, {who, zoom, waterlineY}) → the group framing (see trio).
// toScreen(cam, p) / toWorld(cam, p)   world ⇄ 1280x720 screen (st.toScreen(p) in hooks).
// clampCam(cam, kind, marginPx) · shakeOffset(T, amp) → {x, y, rot}
// auditFramings(S, cfg?, names?) → [{name, cam, issues}]  every framing of the scene's stage at S:
//   flags a cast eye inside the subtitle strip (screen y > SUB_Y) or a head cropped there.
// WORLD / WORLD_CLOSE  painted / finished-art bounds per kind.
//
// ═════════════════════════════════════════════════════════════════════════════ GAGS / TIMING
// take(t, t0, o) → {sx, sy, dy, k, phase}   cartoon take: anticipation squash before t0
//   (o.anticipation .1 s), stretch with overshoot (o.stretch .12 s), damped settle (o.settle
//   .45 s); o.amount 1, o.lift 1. EXAMPLE: cast: { barry: { squash: K.take(S.t, K.sfxTimes(S,
//   'record_scratch')[0]) } }   (a missing t0 returns the identity)
// popIn(t, t0, dur=.3, overshoot=1.7) → 0 → ~1.1 → 1 scale;  popOut(t, t0, dur=.25) → 1 (swells
//   a touch) → 0.  EXAMPLE: K.drawRulesSign(c, st.T, { pop: K.ramp(S.t, S.cue('rules_sign'), 1) })
// wobble(t, t0, {amp=.12, freq=3, decay=4}) → damped oscillation (radians) for a hit sign/orange
// withSquash(ctx, px, py, sx, sy, fn)   scale about a pivot, run fn, restore.
// shakeEnv(t, t0, dur, attack=.04) → 0..1;  sfxShake(S, table=SHAKE_SFX, {t}) → px amplitude now
// rumbleLevel(S, t?) → 0..1 env rumble from rumble_small/rumble_big/explosion/boil sfx (the spring
//   stage feeds it to env.rumble unless you set one).
// sfxTimes(S, 'pop' | ['pop','splash'] | /bonk/) → sorted scene-local times (offsets included).
//   EXAMPLE: shake a prop on each hammer hit: K.wobble(S.t, K.sfxTimes(S, 'hammer').filter((h) => h <= S.t).pop() ?? -9)
// beat(S, name, dur?) → {t0, dur, t1, u (= t − t0), k (0..1), active, before, after}  (throws on
//   typos, like S.cue).  EXAMPLE: const b = K.beat(S, 'fish_leave'); if (b.active) ...
// keyTime(S, 12.5 | 'cue+0.3' | 'cue@end') → scene-local seconds
// ramp(t, t0, dur, ease='inOutCubic') → 0..1;  bump(t, t0, dur) → 0→1→0 (sin²);
//   fadeWindow(t, t0, t1, fadeIn=.2, fadeOut=.2) → 0..1 plateau;  stepKeys(t, [[t, v]...], def)
// shot(S, at?) → {name, index, t0, t1, dur, t (since the cut), k}
// lineWith(S, who, 'text') → that line (scene-local ls/le) | null;  linesOf(S, who);
//   lastLineBefore(S, who, t);  wordTime(S, line, 'bro', n=0) → when that word is spoken.
// pathAt(pts, k) → {x, y, angle, dir, len, dist}   point at arc-length fraction k along [{x,y}...]
// gaitPhase(dist, {who, scale, pose:'run'|'walk'}) → walkPhase that keeps the feet planted.
//   EXAMPLE: const p = K.pathAt(SPRING.escapePath, k), sc = SPRING.depthScale(p.y) * 0.85;
//            cast: { sunny: { x: p.x, y: p.y - 30, scale: sc, pose: 'run', inWater: false, flip: true,
//                    walkPhase: K.gaitPhase(p.dist, { who: 'sunny', scale: sc }) } }
// officePuff(S, o?) → 0..1 window puff now;  officePuffKeys(S, o?) → [[t, v]...];  PUFF_KEYS.
//
// ═════════════════════════════════════════════════════════════════════════════ SPRING PROPS
// drawRulesSign(ctx, t, o) → signAnchors (top = Gerald's perch). o.setting ('new_spring' → beside
//   the SNOOZE SPRINGS 2 sign), o.pop (0..1 pop-in), o.rot (e.g. PROPS.signWobble(dt)), ...
// rulesSignAnchors(o) → the same anchors without drawing (resolve perches before the stage).
// drawExitSigns(ctx, t, o) → {exit, really, sunny: signAnchors}: EXIT, NO, REALLY. THIS WAY. and
//   YES, YOU, SUNNY (end of the row, x 184) on SPRING.exitSignSpots. o.show = {exit, really,
//   sunny} 0..1 pop-in progress (default 1), o.burn = number | {key: 0..1}, o.rot = {key: rad},
//   o.only = ['exit', ...].
// drawMooredRaft(ctx, t, o) → raftAnchors   the S.S. TOLD YOU SO at SPRING.raftMoor (scale .5);
//   any drawRaft option (build, x, wake, flagShow...). mooredRaftAnchors(t, o) → same, no draw
//   (e.g. Gerald's hop target: on: { x: A.deck.x, y: A.deck.y, scale: .5 }).
// RULES_SIGN, EXIT_SIGNS, MOORED_RAFT, EXTRAS   the standard placements (shared by s01/s06/s07/s09).
// REST_MOOD, SCENE_DEFAULTS, RAFT_SEATS, SUB_Y (= 600, subtitle strip top, screen px)
//
// PERFORMANCE (1920x1080, wall time per frame incl. Skia's raster flush + readback; interleaved A/B
//   vs the previous kit on identical frames, shared box at load 1.9–2.9, so medians swing):
//   spring trio with 3 capybaras + Gerald min 44–49 / median 51–99 ms (the env background is most
//   of it; same as before), barry_cu 50 / 61–89; raft_wide 70–72 / 82–122 (was 104–109 / 134–167:
//   the raft + cast are no longer rendered twice for the reflection), raft barry_cu 58–63 / 70–94
//   (was 80–82 / 91–128; off-screen passengers culled). The kit's own JS (layout, moods, gazes,
//   turns, Gerald) < 1 ms. build/kit_demo/perf_kit_ab.js re-measures.
// lab sheets (node src/lab.js kit <sheet> out.png): framings, office, raft, turn (turn + take
//   frames with the host's drawn head top (green) under Gerald's feet (magenta)), gerald (landing,
//   hop, take-off through the kit), audit (framing audit text), envelopes (+ the shake curve).
// Regression checks: node build/kit_demo/regress.js
'use strict';

const U = require('./util');
const { TAU, clamp, lerp, smoothstep, ease, noise1, hash1, mix } = U;
const CAP = require('./capybara');
const CRIT = require('./critters');
const PROPS = require('./props');
const ES = require('./env_spring');
const EO = require('./env_other');

const DW = 1280, DH = 720;
const SUB_Y = 600;            // top of the subtitle strip (screen px)

// ═════════════════════════════════════════════════════════════════════════════ small utils
const fin = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const posv = (v, d = 1, min = 1e-3) => { v = fin(v, d); return v < min ? min : v; };
const warned = new Set();
function warnOnce(key, msg) {
  if (warned.has(key)) return;
  warned.add(key);
  try { process.stderr.write('[kit] ' + msg + '\n'); } catch (e) { /* ignore */ }
}
const MEMO = new WeakMap();
function memo(S, key, fn) {
  let m = MEMO.get(S.tl);
  if (!m) { m = new Map(); MEMO.set(S.tl, m); }
  const k = S.id + '|' + key;
  if (!m.has(k)) {
    if (m.size > 20000) m.clear();
    m.set(k, fn());
  }
  return m.get(k);
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
const easeFn = (e) => (typeof e === 'function' ? e : ease[e] || ease.inOutCubic);
const CAPY_CAST = ['sunny', 'barry', 'doreen'];
const SPEAKERS = ['barry', 'sunny', 'doreen', 'gerald', 'shelley'];
const REST_MOOD = { barry: 'worried', sunny: 'chill', doreen: 'chill', gerald: 'smug', shelley: 'neutral', extra: null };
// Per-scene automation defaults, merged UNDER each cast entry (anything the scene passes wins).
// rest keys may be scene-local seconds or cue names ('cue', 'cue+0.6', 'cue@end-0.2').
const SCENE_DEFAULTS = {
  // the 12 seconds of chill: orange on, eyes shut → until his eyes open
  s07_eruption: { barry: { rest: [[0, 'worried'], ['barry_orange+1.6', 'chill'], ['barry_eyes_open+0.3', 'worried']] } },
  // vindicated: flat between lines, chill once the orange is on the helmet; no eye-rolls at 'bro'
  s08_aftermath: { barry: { rest: [[0, 'deadpan'], ['doreen_orange+0.6', 'chill']], reactions: false } },
  // roles reversed: blissful Barry, worried Sunny + Doreen
  s09_epilogue: { barry: { rest: 'chill', reactions: false }, sunny: { rest: 'worried' }, doreen: { rest: 'worried' } },
};
const SIZE = { barry: 0.94, sunny: 1.06, doreen: 0.97, extra: 0.95 };   // rig body size factors
const PHASE = { barry: 0, sunny: 1.37, doreen: 2.71, extra: 0.5, gerald: 0.77, shelley: 3.3 };
const SEED = { barry: 1.1, sunny: 2.3, doreen: 3.7, gerald: 4.9, shelley: 6.1, extra: 7.3 };
// default gaze per mood (mirrors the rig's lookX/lookY so blending to "forward" is seamless)
const FWD_LOOK = { smug: [0.75, 0], deadpan: [0.1, 0], sad: [0.2, 0.6], sleepy: [0.3, 0.2] };
const fwdLook = (mood) => { const v = FWD_LOOK[mood] || [0.3, 0]; return { x: v[0], y: v[1] }; };
const MOOD_HOLD = 0.7, MOOD_IN = 0.22, MOOD_OUT = 0.6, MOOD_LEAD = 0.1;
const TURN_LEAD = 0.2, TURN_DUR = 0.3, TURN_SETTLE = 0.16, ADDRESSED_DELAY = 0.3, FACE_SMOOTH = 0.9;
const TURN_SPAN = TURN_DUR + TURN_SETTLE;
const XY_LIM = 20000;

// ═════════════════════════════════════════════════════════════════════════════ timing
function ramp(t, t0, dur, fn) {
  if (!(dur > 0)) return t >= t0 ? 1 : 0;
  return easeFn(fn)(clamp((t - t0) / dur));
}
function bump(t, t0, dur) {
  const u = (t - t0) / Math.max(1e-6, dur);
  if (!(u > 0) || u >= 1) return 0;
  const s = Math.sin(Math.PI * u);
  return s * s;
}
function fadeWindow(t, t0, t1, fadeIn = 0.2, fadeOut = 0.2) {
  if (t < t0 || t > t1) return 0;
  const a = fadeIn > 0 ? smoothstep(t0, t0 + fadeIn, t) : 1;
  const b = fadeOut > 0 ? 1 - smoothstep(t1 - fadeOut, t1, t) : 1;
  return Math.min(a, b);
}
function stepKeys(t, keys, def) {
  let v = def;
  for (const [kt, kv] of keys) if (t >= kt) v = kv;
  return v;
}
// scene-local time from a number or a cue reference: 'cue', 'cue+0.5', 'cue-0.2', 'cue@end',
// 'cue@end+0.3' (throws on a cue typo, like S.cue)
function keyTime(S, k) {
  if (typeof k === 'number') return fin(k, 0);
  if (typeof k !== 'string') return fin(+k, 0);
  const m = /^\s*([A-Za-z0-9_]+)\s*(@end)?\s*(?:([+-])\s*([\d.]+))?\s*$/.exec(k);
  if (!m) { warnOnce('keyTime:' + k, `scene ${S.id}: cannot parse time "${k}"`); return 0; }
  let t = S.cue(m[1]);
  if (m[2]) t += S.cueDur(m[1]);
  if (m[3]) t += (m[3] === '-' ? -1 : 1) * parseFloat(m[4]);
  return t;
}
function beat(S, name, dur) {
  const t0 = S.cue(name);
  const d = dur != null ? dur : S.cueDur(name);
  const u = S.t - t0;
  return { t0, dur: d, t1: t0 + d, u, k: d > 0 ? clamp(u / d) : u >= 0 ? 1 : 0, active: u >= 0 && u < d, before: u < 0, after: u >= d };
}
function cueList(S) {
  return memo(S, 'cues', () => S.tl.cues.filter((c) => c.scene === S.id).map((c) => ({ name: c.name, t: c.time - S.scene.start, dur: c.dur || 0 })));
}
function cueAt(S, t, eps = 0.02) { return cueList(S).find((c) => Math.abs(c.t - t) < eps) || null; }
function camList(S) {
  return memo(S, 'cams', () => S.tl.cams.filter((c) => c.scene === S.id).map((c) => ({ name: c.name, t: c.time - S.scene.start })));
}
function cutTimes(S) { return memo(S, 'cuts', () => camList(S).map((c) => c.t).filter((t) => t > 0.01)); }
function shot(S, at) {
  const t = at != null ? at : S.t;
  const cams = camList(S);
  let i = -1;
  for (let k = 0; k < cams.length; k++) if (cams[k].t <= t + 1e-6) i = k;
  const t0 = i >= 0 ? cams[i].t : 0;
  const t1 = i + 1 < cams.length ? cams[i + 1].t : S.duration;
  const name = i >= 0 ? cams[i].name : cams.length ? cams[0].name : 'default';
  return { name, index: Math.max(0, i), t0, t1, dur: Math.max(1e-3, t1 - t0), t: t - t0, k: clamp((t - t0) / Math.max(1e-3, t1 - t0)) };
}
function sceneLines(S) {
  return memo(S, 'lines', () => S.lines().slice().sort((a, b) => a.ls - b.ls));
}
function linesOf(S, who) {
  return memo(S, 'lines:' + who, () => sceneLines(S).filter((l) => l.char === who));
}
function lineWith(S, who, text) {
  const q = String(text).toLowerCase();
  const l = linesOf(S, who).find((x) => x.text.toLowerCase().includes(q));
  if (!l) warnOnce(`lineWith:${S.id}:${who}:${text}`, `scene ${S.id}: no ${who} line containing "${text}"`);
  return l || null;
}
function lastLineBefore(S, who, t) {
  let best = null;
  for (const l of linesOf(S, who)) if (l.ls <= t) best = l;
  return best;
}
// Estimated scene-local time at which `word` (n-th occurrence) is spoken in `line`: the
// character offset is mapped through the line's mouth-energy envelope (pauses are skipped).
function wordTime(S, line, word, n = 0) {
  if (!line) return null;
  const re = new RegExp('\\b' + String(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
  let m, k = 0, idx = -1;
  while ((m = re.exec(line.text))) { if (k++ === n) { idx = m.index; break; } }
  if (idx < 0) return null;
  const frac = idx / Math.max(1, line.text.length);
  const dur = line.le - line.ls;
  const env = line.env || [];
  if (env.length < 3) return line.ls + frac * dur;
  let tot = 0;
  for (const e of env) tot += Math.max(0.03, e);
  let acc = 0;
  for (let i = 0; i < env.length; i++) {
    acc += Math.max(0.03, env[i]);
    if (acc / tot >= frac) return line.ls + Math.min(dur, i / 24);
  }
  return line.ls + frac * dur;
}
function sfxTimes(S, name) {
  const key = 'sfx:' + (name instanceof RegExp ? 're:' + name.source : [].concat(name).join(','));
  return memo(S, key, () => {
    const test = name instanceof RegExp ? (n) => name.test(n) : Array.isArray(name) ? (n) => name.includes(n) : (n) => n === name;
    return S.tl.sfx.filter((x) => x.scene === S.id && test(x.name)).map((x) => x.time - S.scene.start).sort((a, b) => a - b);
  });
}

// Point at arc-length fraction k (0..1) along a polyline [{x,y}...] → {x, y, angle, dir (+1 → moving
// right), len (total length), dist (arc length travelled)}.
function pathAt(pts, k) {
  const P = pts.map((p) => (Array.isArray(p) ? { x: p[0], y: p[1] } : p));
  if (P.length < 2) return { ...(P[0] || { x: 0, y: 0 }), angle: 0, dir: 1, len: 0, dist: 0 };
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y));
  const L = cum[cum.length - 1], d = clamp(fin(k, 0)) * L;
  let i = 1;
  while (i < P.length - 1 && cum[i] < d) i++;
  const a = P[i - 1], b = P[i], u = clamp((d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]));
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), angle: ang, dir: b.x >= a.x ? 1 : -1, len: L, dist: d };
}
// walkPhase that keeps the feet planted when a character has travelled `dist` caller units
function gaitPhase(dist, o) {
  const a = CAP.capyAnchors({ who: o.who, scale: o.scale ?? 1, pose: o.pose === 'walk' ? 'walk' : 'run', x: 0, y: 0, t: 0 });
  return fin(dist, 0) / Math.max(1, a.stride || 100);
}

// ═════════════════════════════════════════════════════════════════════════════ gag envelopes
// Cartoon take: anticipation squash → stretch with overshoot → damped settle.
function take(t, t0, o = {}) {
  const A = o.anticipation ?? 0.1, St = o.stretch ?? 0.12, Se = o.settle ?? 0.45, amt = o.amount ?? 1;
  const u = t - t0;
  let sy = 1, phase = 'idle';
  if (!Number.isFinite(u)) return { sx: 1, sy: 1, dy: 0, k: 0, phase };
  if (u >= -A && u < 0) {
    phase = 'anticipate';
    sy = 1 - 0.12 * amt * ease.inOutSine((u + A) / A);
  } else if (u >= 0 && u < St) {
    phase = 'stretch';
    sy = lerp(1 - 0.12 * amt, 1 + 0.18 * amt, ease.outCubic(u / St));
  } else if (u >= St && u < St + Se) {
    phase = 'settle';
    const k = (u - St) / Se;
    sy = 1 + 0.18 * amt * Math.cos(k * Math.PI * 3) * Math.exp(-k * 4.2) * (1 - k);
  } else if (u >= St + Se) phase = 'done';
  const sx = 1 / Math.sqrt(Math.max(0.2, sy));
  const dy = -(sy - 1) * 40 * amt * (o.lift ?? 1);   // design units at scale 1 (× the character's scale)
  return { sx, sy, dy, k: clamp((u + A) / (A + St + Se)), phase };
}
function popIn(t, t0, dur = 0.3, overshoot = 1.7) {
  if (!(t > t0)) return 0;
  const k = (t - t0) / Math.max(1e-6, dur);
  if (k >= 1) return 1;
  return Math.max(0, ease.outBack(k, overshoot));
}
function popOut(t, t0, dur = 0.25) {
  if (!(t > t0)) return 1;
  const k = (t - t0) / Math.max(1e-6, dur);
  if (k >= 1) return 0;
  return Math.max(0, 1 - ease.inBack(k, 2.2));
}
function wobble(t, t0, o = {}) {
  const u = t - t0;
  if (!(u >= 0)) return 0;
  const amp = o.amp ?? 0.12, f = o.freq ?? 3, d = o.decay ?? 4;
  return amp * Math.sin(u * f * TAU) * Math.exp(-u * d);
}
function withSquash(ctx, px, py, sx, sy, fn) {
  sx = fin(sx, 1); sy = fin(sy, 1); px = fin(px, 0); py = fin(py, 0);
  if (Math.abs(sx - 1) < 1e-4 && Math.abs(sy - 1) < 1e-4) { fn(); return; }
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(Math.max(0.02, Math.abs(sx)) * Math.sign(sx || 1), Math.max(0.02, sy));
  ctx.translate(-px, -py);
  try { fn(); } finally { ctx.restore(); }
}

// ═════════════════════════════════════════════════════════════════════════════ shake
// amp = screen px at peak, dur = seconds; gain from the timeline mixes in at 50 %.
const SHAKE_SFX = {
  rumble_small: { amp: 5, dur: 1.7, attack: 0.15 },
  rumble_big: { amp: 13, dur: 2.0, attack: 0.1 },
  explosion: { amp: 22, dur: 2.6, attack: 0.03 },
  boil: { amp: 2.5, dur: 1.4, attack: 0.3 },
  bonk: { amp: 3, dur: 0.3 },
  thud: { amp: 3, dur: 0.3 },
  land: { amp: 1.5, dur: 0.25 },
  hammer: { amp: 1.6, dur: 0.22 },
  big_splash: { amp: 4, dur: 0.6 },
  splat: { amp: 1.5, dur: 0.2 },
  glass_pop: { amp: 1.5, dur: 0.2 },
};
const RUMBLE_SFX = { rumble_small: 0.7, rumble_big: 1, explosion: 1, boil: 0.35 };
const SHAKE_ROT_MAX = 0.014;     // ≈ 0.8°
function shakeEnv(t, t0, dur, attack = 0.04) {
  const u = t - t0;
  if (!(u >= 0) || u > dur) return 0;
  if (u < attack) return u / attack;
  const k = (u - attack) / Math.max(1e-6, dur - attack);
  return (1 - k) * (1 - k);
}
function sfxShake(S, table = SHAKE_SFX, opts = {}) {
  const t = opts.t != null ? opts.t : S.t;
  const list = memo(S, 'sfxlist', () => S.tl.sfx.filter((x) => x.scene === S.id).map((x) => ({ name: x.name, t: x.time - S.scene.start, gain: x.gain == null ? 1 : x.gain })));
  let a = 0;
  for (const e of list) {
    const d = table[e.name];
    if (!d) continue;
    a += d.amp * (0.5 + 0.5 * e.gain) * shakeEnv(t, e.t, d.dur, d.attack ?? 0.04);
  }
  return a;
}
function rumbleLevel(S, t) {
  t = t != null ? t : S.t;
  let r = 0;
  for (const name in RUMBLE_SFX) {
    const d = SHAKE_SFX[name];
    for (const t0 of sfxTimes(S, name)) r = Math.max(r, RUMBLE_SFX[name] * shakeEnv(t, t0, d.dur + 0.4, d.attack ?? 0.1));
  }
  return clamp(r);
}
// Smooth camera shake for amplitude `amp` (screen px) at time T: a 2-octave rumble (value noise at 7 Hz + 1.5 Hz,
// so consecutive frames are correlated) → {x, y (screen px), rot (rad, ≤ 0.8°)}.
function shakeOffset(T, amp) {
  amp = clamp(fin(amp, 0), 0, 80);
  if (amp <= 0) return { x: 0, y: 0, rot: 0 };
  const nx = 0.7 * noise1(T * 7.1 + 3.3) + 0.4 * noise1(T * 1.55 + 11.7);
  const ny = 0.7 * noise1(T * 6.3 + 9.1) + 0.4 * noise1(T * 1.35 + 5.2);
  const nr = 0.8 * noise1(T * 3.1 + 1.7) + 0.2 * noise1(T * 0.9 + 4.4);
  return { x: nx * amp, y: ny * amp, rot: clamp(nr * amp * 0.0009, -SHAKE_ROT_MAX, SHAKE_ROT_MAX) };
}
const shakeMarginPx = (amp) => (amp > 0 ? amp * 1.12 + Math.min(SHAKE_ROT_MAX, amp * 0.0009) * 735 : 0);

// ═════════════════════════════════════════════════════════════════════════════ settings
function kindOf(setting) {
  if (setting === 'therapy_office') return 'office';
  if (setting === 'river_sunset') return 'river';
  if (setting === 'spring_day' || setting === 'spring_evening' || setting === 'new_spring') return 'spring';
  return 'other';
}
function springAnchors(setting) { return setting === 'new_spring' ? ES.NEW_SPRING : ES.SPRING; }
const WORLD = {
  spring: { x0: -410, x1: 1690, y0: -430, y1: 1130 },
  office: { x0: -290, x1: 1570, y0: -290, y1: 1010 },
  river: { x0: -290, x1: 1570, y0: -290, y1: 1010 },
  other: { x0: -200, x1: 1480, y0: -200, y1: 920 },
};
// close framings (zoom ≥ CLOSE_ZOOM) stay where the spring is FINISHED art: the canopy corners
// above y ≈ −150 and right of x ≈ 1450 are flat framing blobs (fine in a wide, empty in a CU)
const WORLD_CLOSE = { spring: { x0: -300, x1: 1450, y0: -150, y1: 1130 } };
const CLOSE_ZOOM = 1.5;
// default character lighting per setting (tint mixes a light colour into the fur; rim = rim-light)
function lightFor(setting, env = {}) {
  if (setting === 'spring_evening') {
    const d = clamp(fin(+env.dusk, 0)), e = clamp(fin(+env.erupt, 0) * 1.6), lv = clamp(fin(+env.lava, 0));
    const hot = Math.max(e, lv);
    return {
      tint: { color: mix(mix('#FFAA66', '#B07AA8', d), '#FF5A2A', hot), amount: 0.12 + 0.06 * d + 0.12 * hot },
      rim: mix(mix('#FFD08A', '#F0A0C0', d), '#FF8A3A', hot),
    };
  }
  if (setting === 'river_sunset') return { tint: { color: '#E07A86', amount: 0.17 }, rim: '#FFB27A' };
  if (setting === 'therapy_office') return { tint: { color: '#FFC07A', amount: 0.06 }, rim: '#FFE2B8' };
  if (setting === 'new_spring') return { tint: { color: '#FFF0C0', amount: 0.04 }, rim: '#FFF4D8' };
  return null;
}
// the water highlight colour of the env's own palette (the same rings env.drawSwimmers draws)
function rippleColor(envShort) {
  try {
    const P = ES._internals.palette(envShort.setting, envShort.dusk || 0, envShort.erupt || 0, undefined, envShort.lava || 0);
    if (P && typeof P.wHi === 'string') return P.wHi;
  } catch (e) { /* fall back */ }
  return '#E2FBF6';
}

// ═════════════════════════════════════════════════════════════════════════════ scene defaults
function withSceneDefaults(S, who, extra) {
  const d = SCENE_DEFAULTS[S.id] && SCENE_DEFAULTS[S.id][who];
  if (!d) return extra || {};
  const out = { ...d, ...(extra || {}) };
  for (const k in d) if (extra && extra[k] === undefined && k in extra) out[k] = d[k];
  return out;
}
function defaultRest(S, who) {
  const d = SCENE_DEFAULTS[S.id] && SCENE_DEFAULTS[S.id][who];
  return d && d.rest !== undefined ? d.rest : REST_MOOD[who];
}

// ═════════════════════════════════════════════════════════════════════════════ layout
// Positions (+ facing, eyes, head tops) of everyone in the scene right now. Used by castOpts for
// gazes, by the stages for drawing and by framings for close-ups. Anchor offsets are BOB-FREE
// (the mean over the idle cycle), so cameras built on them never float with a character's bob.
const POS_KEYS = ['x', 'y', 'scale', 'flip', 'pose', 'rot', 'inWater', 'turn', 'facing', 'hidden'];
const BASE_MEMO = new Map();
function baseAnchors(c) {
  const helmet = !!(c.accessories && c.accessories.helmet);
  const key = `${c.who}|${(+c.scale).toFixed(3)}|${c.pose}|${helmet}`;
  let r = BASE_MEMO.get(key);
  if (!r) {
    const N = 9;
    let ex = 0, ey = 0, tx = 0, ty = 0, gy = 0;
    for (let i = 0; i < N; i++) {
      const a = CAP.capyAnchors({ who: c.who, x: 0, y: 0, scale: c.scale, pose: c.pose, t: i * 0.713, flip: false, blink: false, accessories: helmet ? { helmet: true } : undefined });
      ex += a.eye.x; ey += a.eye.y; tx += a.headTop.x; ty += a.headTop.y; gy += a.ground.y;
    }
    r = { eyeDX: ex / N, eyeDY: ey / N, topDX: tx / N, topDY: ty / N, groundDY: gy / N };
    if (BASE_MEMO.size > 4000) BASE_MEMO.clear();
    BASE_MEMO.set(key, r);
  }
  return r;
}
function raftDefaults(S, cfg = {}) {
  const r = { x: EO.RIVER.raftPos.x, y: EO.RIVER.raftPos.y, scale: 1.1, t: S.T, bob: 1, wake: 0.35, dir: 1, wind: 0.6, flagText: 'S.S. TOLD YOU SO', ...finiteOpts(cfg.raft || {}) };
  r.scale = clamp(posv(r.scale, 1.1, 0.05), 0.05, 8);
  r.x = clamp(r.x, -XY_LIM, XY_LIM); r.y = clamp(r.y, -XY_LIM, XY_LIM);
  return r;
}
// local raft deck point → world (rides the bob + roll)
function raftPoint(ro, RA, lx, ly) {
  const s = ro.scale ?? 1, a = RA.angle || 0, f = ro.flip ? -1 : 1;
  const x = lx * f * s, y = ly * s;
  return { x: ro.x + x * Math.cos(a) - y * Math.sin(a), y: RA.waterline + x * Math.sin(a) + y * Math.cos(a) };
}
// deck-local seats (raft units, raft scale 1.1): Sunny at the stern facing Doreen, Doreen amidships
// facing Sunny, Barry at the bow facing AHEAD — the mast rises between Doreen's back and Barry's, so it
// never grows out of anyone's head, and a Barry close-up has open water in front of him.
const RAFT_SEATS = { sunny: -158, doreen: -30, barry: 84 };
const RAFT_FLIP = { sunny: false, doreen: true, barry: false };
const RAFT_CAST_SCALE = { sunny: 0.55, barry: 0.58, doreen: 0.56 };

function castCfgOf(S, cfg, who) { return withSceneDefaults(S, who, (cfg.cast && cfg.cast[who]) || {}); }
function buildLayout(S, cfg = {}) {
  const setting = cfg.setting || S.scene.setting;
  const kind = kindOf(setting);
  const T = S.T;
  const L = { S, setting, kind, chars: {}, points: {}, gerald: null, raft: null, T };
  const castCfg = cfg.cast || {};
  const want = (who) => castCfg[who] !== false && !(castCfg[who] && castCfg[who].hidden);
  const add = (who, base) => {
    const over = {};
    const cc = castCfgOf(S, cfg, who);
    for (const k of POS_KEYS) if (cc[k] !== undefined) over[k] = cc[k];
    const acc = { ...(base.accessories || {}), ...(cc.accessories || {}) };
    const c = { who, ...base, ...over, accessories: acc };
    c.x = clamp(fin(c.x, 640), -XY_LIM, XY_LIM); c.y = clamp(fin(c.y, 600), -XY_LIM, XY_LIM); c.scale = clamp(posv(c.scale, 1, 0.05), 0.05, 12);
    c.home = { x: fin(base.x, c.x), y: fin(base.y, c.y) };   // the default blocking (turn sides use it)
    c.explicitFlip = cc.flip !== undefined;
    c.baseFlip = !!c.flip;
    c.cc = cc;
    Object.assign(c, baseAnchors(c));
    L.chars[who] = c;
  };
  if (kind === 'spring') {
    const A = springAnchors(setting);
    for (const who of CAPY_CAST) {
      if (!want(who)) continue;
      const sp = A.swimSpots[who];
      add(who, { x: sp.x, y: sp.y, scale: sp.scale, flip: !!sp.flip, pose: 'swim', inWater: true, turn: who === 'barry' });
    }
    L.points.volcano = A.volcanoPeak || A.tinyHill || { x: 880, y: 330 };
  } else if (kind === 'office') {
    if (want('barry')) add('barry', { x: EO.OFFICE.couch.x, y: EO.OFFICE.couch.y, scale: 1, flip: false, pose: 'lie', inWater: false, turn: false });
    const so = { x: EO.OFFICE.chair.x, y: EO.OFFICE.chair.y, flip: true, scale: 1, t: T, ...pickPos(cfg.shelley) };
    const sa = CRIT.tortoiseAnchors(so);
    L.points.shelley = sa.eye;
    L.shelleyBase = so;
    L.points.volcano = EO.OFFICE.crater;
  } else if (kind === 'river') {
    const ro = raftDefaults(S, cfg);
    const RA = PROPS.raftAnchors(ro);
    const RA0 = PROPS.raftAnchors({ ...ro, bob: 0, rock: 0 });
    L.raft = { opts: ro, anchors: RA, rest: RA0 };
    for (const who of CAPY_CAST) {
      if (!want(who)) continue;
      const cc = castCfgOf(S, cfg, who);
      const pose = cc.pose || 'sit';
      const sc = cc.scale ?? RAFT_CAST_SCALE[who];
      const seatX = fin(cc.seatX, RAFT_SEATS[who]);
      const helmet = who === 'barry' && !(cc.accessories && cc.accessories.helmet === false);
      const g = baseAnchors({ who, scale: sc, pose, accessories: helmet ? { helmet: true } : null }).groundDY;
      const seat = raftPoint(ro, RA, seatX, RA.sitY ?? -24);
      const seat0 = raftPoint(ro, RA0, seatX, RA0.sitY ?? -24);
      add(who, { x: seat.x, y: seat.y - g, rest: { x: seat0.x, y: seat0.y - g }, scale: sc, flip: RAFT_FLIP[who], pose, rot: RA.angle, inWater: false, turn: false, accessories: helmet ? { helmet: true } : {} });
    }
    L.points.volcano = EO.RIVER.volcano;
  } else {
    for (const who of CAPY_CAST) if (castCfg[who]) add(who, { x: 640, y: 600, scale: 1, flip: false, pose: 'swim', inWater: false, turn: false });
  }
  // facing (turns) needs everyone's base positions
  for (const who in L.chars) {
    const c = L.chars[who];
    const f = facingAt(S, who, L, c.cc);
    c.flip = f.flip; c.face = f.face; c.sx = f.sx; c.sy = f.sy; c.turning = f.turning; c.turnHT = f.headTurn; c.turnK = f.k;
    const fx = c.flip ? -1 : 1;
    c.eye = { x: c.x + fx * c.eyeDX, y: c.y + c.eyeDY };
    c.headTop = { x: c.x + fx * c.topDX, y: c.y + c.topDY };
    // smoothed facing (cameras: no whip-pan when Barry turns)
    c.eyeSmooth = { x: c.x + c.face * c.eyeDX, y: c.y + c.eyeDY };
    c.headTopSmooth = { x: c.x + c.face * c.topDX, y: c.y + c.topDY };
  }
  // Gerald (roughly — the stage refines this with the real anchors)
  const g = cfg.gerald;
  if (g && g !== false) {
    const host = typeof g.on === 'string' && L.chars[g.on] ? g.on : null;
    if (g.on === 'rules' && kind === 'spring') {
      const top = rulesSignAnchors({ setting }).top;
      L.gerald = { host: null, head: { x: top.x, y: top.y - 62 } };
    } else if (host) {
      const h = L.chars[host];
      L.gerald = { host, head: { x: h.headTop.x + (h.flip ? -1 : 1) * 4 * h.scale, y: h.headTop.y - 78 * h.scale * 0.75 } };
    } else if (g.x != null) {
      L.gerald = { host: null, head: { x: g.x, y: g.y - 80 * (g.scale ?? 0.75) } };
    } else if (kind === 'river' && L.raft) {
      const p = L.raft.anchors.mastTop;
      L.gerald = { host: null, head: { x: p.x, y: p.y - 60 } };
    }
  }
  return L;
}
function pickPos(o) {
  const r = {};
  if (!o) return r;
  for (const k of ['x', 'y', 'scale', 'flip']) if (o[k] !== undefined) r[k] = o[k];
  return r;
}

// ═════════════════════════════════════════════════════════════════════════════ facing / turns
// which side each other capybara is on, as seen from `me` ('L' | 'R' | '0' too close | '-' absent).
// Uses the DEFAULT blocking (home spots), so moving someone mid-scene never rewrites the turn
// history (no instant flips); cc.turnSides === 'live' uses the live positions instead.
function sideSig(L, me, live) {
  const P = (c) => (live ? c : c.home || c);
  return CAPY_CAST.map((w) => {
    const o = L.chars[w];
    if (!o || w === me.who) return '-';
    const ox = P(o).x, mx = P(me).x;
    if (Math.abs(ox - mx) < 20) return '0';
    return ox < mx ? 'L' : 'R';
  }).join('');
}
function restSig(rest) {
  if (rest === undefined) return 'd';
  if (typeof rest === 'function') return 'f' + hashStr(String(rest));
  try { return 'j' + JSON.stringify(rest); } catch (e) { return 'x'; }
}
const isCalm = (m) => m === 'chill' || m === 'sleepy';
// Barry's turn schedule for this scene + blocking: [{t, from, to, instant}]. Pure (memoised per
// side signature, rest and mode).
function facingTurns(S, who, L, cc) {
  const me = L.chars[who];
  const sides = sideSig(L, me, cc.turnSides === 'live');
  const mode = cc.turn === 'always' ? 'always' : 'auto';
  const key = `turns:${who}:${sides}:${me.baseFlip}:${L.kind}:${restSig(cc.rest)}:${mode}`;
  return memo(S, key, () => {
    const sideOf = (other) => { const ch = sides[CAPY_CAST.indexOf(other)]; return ch === 'L' ? true : ch === 'R' ? false : null; };
    const rolls = cc.reactions === false ? [] : reactionList(S, who).filter((r) => r.kind === 'eyeroll');
    const ev = [];
    for (const l of sceneLines(S)) {
      if (l.char === who && l.to && l.to !== who) {
        const f = sideOf(l.to);
        if (f == null) continue;
        if (mode !== 'always' && isCalm(l.mood)) continue;
        ev.push({ t: l.ls - TURN_LEAD, flip: f });
      } else if (l.char !== who && l.to === who && CAPY_CAST.includes(l.char)) {
        const f = sideOf(l.char);
        if (f == null) continue;
        let t = l.ls + ADDRESSED_DELAY;
        for (const r of rolls) if (t > r.t0 - TURN_SPAN && t < r.t0 + r.dur) t = r.t0 + r.dur + 0.05;   // after the eye-roll
        if (mode !== 'always' && isCalm(moodAt(S, who, cc.rest, t).name)) continue;
        ev.push({ t, flip: f });
      }
    }
    ev.sort((a, b) => a.t - b.t);
    let start = me.baseFlip;
    let state = start;
    let turns = [];
    for (const e of ev) {
      if (e.flip === state) continue;
      if (e.t < 0.4 && !turns.length) { start = e.flip; state = e.flip; continue; }   // settled at the head of the scene
      turns.push({ t: e.t, to: e.flip });
      state = e.flip;
    }
    // never across / right on a cut: a turn starting < .35 s before a cut, overlapping it, or < .12 s
    // after it is moved .2 s into the new shot (or, in a shot too short for it, happens AT the cut)
    const cuts = cutTimes(S);
    for (const tr of turns) {
      for (let i = 0; i < cuts.length; i++) {
        const tc = cuts[i];
        if ((tr.t > tc - 0.35 && tr.t < tc + 0.12) || (tr.t < tc && tr.t + TURN_SPAN > tc)) {
          const next = i + 1 < cuts.length ? cuts[i + 1] : S.duration;
          if (tc + 0.2 + TURN_SPAN < next - 0.05) tr.t = tc + 0.2;
          else { tr.t = tc; tr.instant = true; }
          break;
        }
      }
    }
    turns.sort((a, b) => a.t - b.t);
    const out = [];
    state = start;
    for (const tr of turns) {
      if (tr.to === state) continue;
      const prev = out[out.length - 1];
      let t = tr.t;
      if (prev && !prev.instant && !tr.instant && t < prev.t + TURN_SPAN + 0.05) t = prev.t + TURN_SPAN + 0.05;
      out.push({ t, from: state, to: tr.to, instant: !!tr.instant });
      state = tr.to;
    }
    return { start, turns: out };
  });
}
function facingAt(S, who, L, cc = {}, tAt) {
  const me = L.chars[who];
  const t = tAt != null ? tAt : S.t;
  const sgn = (f) => (f ? -1 : 1);
  const still = (flip) => ({ flip, face: sgn(flip), sx: 1, sy: 1, turning: false, headTurn: 0, k: 0 });
  if (!me) return still(false);
  if (me.explicitFlip) return still(me.baseFlip);
  let turns, start;
  if (Array.isArray(cc.facing)) {
    // keyed facing: [[t | 'cue+0.2', 'left'|'right'|bool], ...] → squash turns at those times
    start = me.baseFlip;
    turns = [];
    let st = start;
    for (const [kt0, kv] of cc.facing) {
      const kt = keyTime(S, kt0);
      const f = kv === 'left' || kv === true;
      if (f !== st) { if (kt <= 0) { st = f; start = f; } else { turns.push({ t: kt, from: st, to: f }); st = f; } }
    }
  } else {
    const enabled = cc.turn != null ? !!cc.turn : !!me.turn;
    if (!enabled) return still(me.baseFlip);
    ({ turns, start } = facingTurns(S, who, L, cc));
  }
  let flip = start, face = sgn(start), sx = 1, sy = 1, turning = false, headTurn = 0, k = 0;
  for (const tr of turns) {
    if (t < tr.t) break;
    if (tr.instant) { flip = tr.to; face = sgn(tr.to); sx = 1; sy = 1; turning = false; headTurn = 0; k = 0; continue; }
    const u = (t - tr.t) / TURN_DUR;
    flip = u < 0.5 ? tr.from : tr.to;
    const fk = ease.inOutCubic(clamp((t - tr.t) / FACE_SMOOTH));
    face = lerp(sgn(tr.from), sgn(tr.to), fk);
    sx = 1; sy = 1; turning = false; headTurn = 0; k = 0;
    if (u < 1) {
      // squash through the rig's 3/4 camera-facing head at mid-turn (masks the mirror flip);
      // headTurn is continuous in the rig (in-betweens + a .47–.53 dissolve)
      turning = true;
      const s = Math.sin(Math.PI * u);
      sx = 1 - 0.4 * s;
      sy = 1 + 0.05 * s;
      headTurn = clamp(s * 1.3);
      k = s;
    } else if (u < 1 + TURN_SETTLE / TURN_DUR) {
      const v = (u - 1) / (TURN_SETTLE / TURN_DUR);
      sx = 1 + 0.06 * Math.sin(Math.PI * v);
      sy = 1 - 0.03 * Math.sin(Math.PI * v);
    }
  }
  return { flip, face, sx, sy, turning, headTurn, k };
}

// ═════════════════════════════════════════════════════════════════════════════ moods
function normRest(S, rest) {
  if (!Array.isArray(rest)) return rest;
  return rest.map(([k, v]) => [keyTime(S, k), v]).sort((a, b) => a[0] - b[0]);
}
function restAt(rest, t) {
  if (typeof rest === 'function') return { mood: rest(t), t0: -Infinity };
  if (Array.isArray(rest)) {
    let m = null, t0 = -Infinity, prev = null;
    for (const [kt, kv] of rest) if (t >= kt) { prev = m; m = kv; t0 = kt; }
    if (m == null) m = rest.length ? rest[0][1] : null;
    return { mood: m, t0, prev };
  }
  return { mood: rest, t0: -Infinity };
}
function addW(w, name, k) { if (name && k > 0) w[name] = (w[name] || 0) + k; }
function domMood(w) {
  let best = null, bw = -1;
  for (const k in w) if (w[k] > bw) { bw = w[k]; best = k; }
  return best;
}
function blendW(a, b, k) {
  const w = {};
  for (const n in a) addW(w, n, a[n] * (1 - k));
  for (const n in b) addW(w, n, b[n] * k);
  return w;
}
// → {weights: {mood: w}, name: dominant}. Continuous everywhere (a line that starts while the
// previous one is still easing out blends from the actual mix at that moment).
function moodAt(S, who, rest, t, depth = 0) {
  t = t != null ? t : S.t;
  const R0 = rest !== undefined ? rest : defaultRest(S, who);
  const R = normRest(S, R0);
  const segs = memo(S, 'moodsegs:' + who, () => linesOf(S, who).filter((l) => l.mood).map((l) => ({ t0: l.ls - MOOD_LEAD, t1: l.le + MOOD_HOLD, mood: l.mood })));
  let i = -1;
  for (let k = 0; k < segs.length; k++) if (segs[k].t0 <= t) i = k;
  let w = {};
  const seg = i >= 0 ? segs[i] : null;
  if (seg && t < seg.t1) {
    const k = ease.inOutSine(clamp((t - seg.t0) / MOOD_IN));
    let from;
    if (k >= 1) from = {};
    else if (depth < 4) from = moodAt(S, who, R, seg.t0 - 1e-4, depth + 1).weights;
    else from = { [restAt(R, seg.t0).mood || seg.mood]: 1 };
    w = blendW(from, { [seg.mood]: 1 }, k);
  } else {
    const r = restAt(R, t);
    const endT = seg ? seg.t1 : -Infinity;
    if (r.t0 > endT && r.prev && r.t0 > -Infinity) {          // keyed rest switched after the line
      const k = ease.inOutSine(clamp((t - r.t0) / 0.5));
      addW(w, r.prev, 1 - k); addW(w, r.mood, k);
    } else if (seg) {
      const k = ease.inOutSine(clamp((t - endT) / MOOD_OUT));
      addW(w, seg.mood, 1 - k); addW(w, r.mood || seg.mood, k);
    } else addW(w, r.mood, 1);
  }
  if (!Object.keys(w).length && R) addW(w, typeof R === 'string' ? R : 'neutral', 1);
  return { weights: w, name: domMood(w) };
}

// ═════════════════════════════════════════════════════════════════════════════ gaze
function gazeSegments(S, who) {
  return memo(S, 'gaze:' + who, () => {
    const ev = [];
    const seed = SEED[who] || 1;
    for (const l of sceneLines(S)) {
      if (l.char === 'narrator') continue;
      if (l.char === who) ev.push({ t0: l.ls - 0.15, t1: l.le + 0.35, target: l.to && l.to !== who ? l.to : 'fwd', pri: 3 });
      else {
        const d = 0.12 + hash1(l.id * 7.31 + seed) * 0.22;
        ev.push({ t0: l.ls + d, t1: l.le + 0.5 + hash1(l.id * 3.7 + seed) * 0.4, target: l.char, pri: l.to === who ? 2 : 1 });
      }
    }
    const bounds = [...new Set([0, ...ev.flatMap((e) => [e.t0, e.t1])])].sort((a, b) => a - b);
    const segs = [];
    for (let i = 0; i < bounds.length; i++) {
      const a = bounds[i], b = i + 1 < bounds.length ? bounds[i + 1] : Infinity;
      const mid = b === Infinity ? a + 1 : (a + b) / 2;
      let best = null;
      for (const e of ev) if (e.t0 <= mid && e.t1 > mid && (!best || e.pri > best.pri || (e.pri === best.pri && e.t0 > best.t0))) best = e;
      const target = best ? best.target : 'idle';
      if (segs.length && segs[segs.length - 1].target === target) segs[segs.length - 1].t1 = b;
      else segs.push({ t0: a, t1: b, target });
    }
    if (!segs.length) segs.push({ t0: -Infinity, t1: Infinity, target: 'idle' });
    segs[0].t0 = -Infinity;
    return segs;
  });
}
// where is `name` (a point) from the point of view of `me`
function pointOf(L, name, meWho) {
  if (!name) return null;
  if (typeof name === 'object') return name;
  if (name === 'gerald') {
    if (!L.gerald) return null;
    if (L.gerald.host === meWho) return 'up';
    return L.gerald.head;
  }
  if (L.chars[name]) {
    if (meWho === 'gerald' && L.gerald && L.gerald.host === name) return 'down';
    return L.chars[name].eye;
  }
  if (name === 'shelley') return L.points.shelley || null;
  if (name === 'volcano') return L.points.volcano || null;
  return null;
}
function lookVec(L, me, target, moodName) {
  const fwd = fwdLook(moodName);
  if (!target || target === 'fwd' || target === 'idle') return fwd;
  if (target === 'camera') return { x: 0, y: 0 };
  const p = pointOf(L, target, me.who);
  if (p === 'up' || target === 'up') return { x: 0.3, y: -1 };
  if (p === 'down' || target === 'down') return { x: 0.45, y: 0.95 };
  if (!p || !me.eye) return fwd;
  const dx = p.x - me.eye.x, dy = p.y - me.eye.y, d = Math.hypot(dx, dy);
  if (!(d > 8)) return fwd;
  const f = me.flip ? -1 : 1;
  return { x: clamp((f * dx / d) * 1.2, -1, 1), y: clamp((dy / d) * 1.4, -1, 1) };
}
function gazeAt(S, who, L, me, moodName, o = {}) {
  const t = S.t;
  if (o.look) return { x: o.look.x, y: o.look.y, target: 'override' };
  if (o.lookAt) { const v = lookVec(L, me, o.lookAt, moodName); return { ...v, target: o.lookAt }; }
  const segs = gazeSegments(S, who);
  let i = 0;
  for (let k = 0; k < segs.length; k++) if (segs[k].t0 <= t) i = k;
  const cur = segs[i], prev = i > 0 ? segs[i - 1] : null;
  let v = lookVec(L, me, cur.target, moodName);
  if (prev) {
    const k = smoothstep(cur.t0, cur.t0 + 0.14, t);
    if (k < 1) {
      const pv = lookVec(L, me, prev.target, moodName);
      v = { x: lerp(pv.x, v.x, k), y: lerp(pv.y, v.y, k) };
    }
  }
  // Barry's neurotic eye darts when nobody is talking to/with him
  if (who === 'barry' && cur.target === 'idle' && o.dart !== false && !isCalm(moodName)) {
    const P = 1.15, u = (t + 0.37) / P, slot = Math.floor(u), ph = u - slot;
    const jx = (hash1(slot * 3.1 + 0.7) - 0.5) * 0.8, jy = (hash1(slot * 5.7 + 0.2) - 0.5) * 0.55;
    const px = (hash1((slot - 1) * 3.1 + 0.7) - 0.5) * 0.8, py = (hash1((slot - 1) * 5.7 + 0.2) - 0.5) * 0.55;
    const k = smoothstep(0, 0.08 / P, ph);
    v = { x: clamp(v.x + lerp(px, jx, k)), y: clamp(v.y + lerp(py, jy, k), -1, 1) };
  }
  return { x: v.x, y: v.y, target: cur.target };
}

// ═════════════════════════════════════════════════════════════════════════════ reactions
function reactionList(S, who) {
  return memo(S, 'react:' + who, () => {
    const out = [];
    for (const l of sceneLines(S)) {
      if (who === 'barry' && l.char === 'sunny') {
        for (let n = 0; n < 4; n++) {
          const wt = wordTime(S, l, 'bro', n);
          if (wt == null) break;
          out.push({ kind: 'eyeroll', t0: wt + 0.12, dur: 0.85 });
        }
      }
      if ((who === 'sunny' || who === 'doreen') && l.char !== who && l.to === who && SPEAKERS.includes(l.char)) {
        const d = l.le - l.ls;
        if (d > 0.9) out.push({ kind: 'nod', t0: l.ls + d * 0.35, dur: 0.6 });
        if (d > 2.2) out.push({ kind: 'nod', t0: l.ls + d * 0.75, dur: 0.6 });
      }
    }
    return out;
  });
}
const EYEROLL = [[0, null], [0.22, [0.65, -1]], [0.58, [-0.7, -0.9]], [1, null]];
function eyerollLook(u, base) {
  const pts = EYEROLL.map(([k, v]) => [k, v || [base.x, base.y]]);
  return U.keys(u, pts, ease.inOutSine);
}

// ═════════════════════════════════════════════════════════════════════════════ to camera
// headTurn 0→1 from the cue over inDur, held through who's next line (+ tail), back over outDur.
// If the next cut / the scene end comes within holdCut (1.2 s) after that, the stare is held
// through it (never eases back in the last frames of a button). o.hold: 'cut' → always hold to
// the next cut; false → never auto-hold. The rig's headTurn is continuous (profile in-betweens,
// a quick .47–.53 dissolve, then the 3/4 head), so a .5 s turn reads as a turn with one smear frame.
function turnToCamera(S, name = 'barry_to_camera', o = {}) {
  const none = { headTurn: 0, k: 0, active: false, sx: 1, sy: 1, tIn: null, tOut: null };
  if (!S.has(name)) return none;
  const who = o.who || 'barry';
  const t0 = S.cue(name);
  const inDur = o.inDur ?? 0.5, outDur = o.outDur ?? 0.4;
  const next = linesOf(S, who).find((l) => l.ls >= t0 - 0.05);
  let tOut = o.until != null ? o.until : next ? next.le + (o.tail ?? 0.25) : t0 + Math.max(S.cueDur(name), 0.9) + 1;
  if (o.hold !== false && o.until == null) {
    const cuts = cutTimes(S).filter((c) => c > t0 + 0.05).concat([S.duration]);
    const nextCut = cuts.find((c) => c >= tOut - 1e-6) ?? S.duration;
    if (o.hold === 'cut') tOut = Math.max(tOut, cuts.find((c) => c > t0 + inDur) ?? S.duration);
    else if (nextCut - tOut <= (o.holdCut ?? 1.2)) tOut = nextCut + 0.05;
  }
  const t = S.t;
  let k = 0;
  if (t >= t0 && t < tOut) k = ease.inOutCubic(clamp((t - t0) / inDur));
  else if (t >= tOut) k = 1 - ease.inOutCubic(clamp((t - tOut) / outDur));
  const p = Math.max(bump(t, t0 + inDur * 0.5 - 0.06, 0.2), bump(t, tOut + outDur * 0.5 - 0.06, 0.2));
  return { headTurn: k, k, active: k > 0, sx: 1 - 0.035 * p, sy: 1 + 0.045 * p, tIn: t0, tOut };
}

// ═════════════════════════════════════════════════════════════════════════════ castOpts
const KIT_KEYS = ['layout', 'rest', 'lookAt', 'talkGain', 'turn', 'turnSides', 'facing', 'tiltAdd', 'reactions', 'setting', 'squash', 'inWater', 'hidden', 'seatX', 'toCamera', 'dart', 'nod', 'water', 'env'];
function castOpts(S, who, extraIn = {}) {
  if (who === 'extra') return extraOpts(S, extraIn || {});
  const extra = withSceneDefaults(S, who, extraIn || {});
  const L = extra.layout || buildLayout(S, { setting: extra.setting, cast: { [who]: extra } });
  let c = L.chars[who];
  if (!c) {
    // not part of the layout (hidden, or a non-cast setting): place from extra
    const tmp = buildLayout(S, { setting: 'custom', cast: { [who]: { x: 640, y: 600, ...extra, hidden: undefined } } });
    c = tmp.chars[who];
  }
  const t = S.t, T = S.T;
  const o = {
    who, x: c.x, y: c.y, scale: c.scale, flip: c.flip, pose: c.pose || 'swim', rot: c.rot || 0,
    t: T + (PHASE[who] || 0), blink: true,
  };
  if (c.accessories && Object.keys(c.accessories).length) o.accessories = { ...c.accessories };
  // talk
  const talk = clamp(fin(S.talk(who), 0) * (extra.talkGain ?? 1));
  o.talk = talk;
  // mood
  const M = moodAt(S, who, extra.rest);
  let weights = M.weights;
  const me = { who, eye: c.eye, flip: c.flip };
  // gaze
  const g = gazeAt(S, who, L, me, M.name, extra);
  let look = { x: g.x, y: g.y };
  let tilt = 0;
  if (g.y < 0) tilt += -g.y * 7; else tilt -= g.y * 3;
  // speech accent: gentle head motion while talking, a lift at the start of exclaimed lines
  const ln = S.line(who);
  if (ln) {
    tilt += 2.2 * noise1(T * 1.7 + (SEED[who] || 1) * 10) * clamp(talk * 2);
    if (/[!?]/.test(ln.text)) tilt += 4 * bump(T, ln.start - 0.05, 0.4);
  }
  // reactions (eye-roll weight fades with the calm moods' share and during a turn: no pops)
  if (extra.reactions !== false) {
    const calmW = clamp((weights.chill || 0) + (weights.happy || 0) + (weights.smug || 0) + (weights.sleepy || 0));
    for (const r of reactionList(S, who)) {
      const u = (t - r.t0) / r.dur;
      if (!(u > 0) || u >= 1) continue;
      if (r.kind === 'eyeroll') {
        const rw = (1 - calmW) * (1 - (c.turnK || 0));
        if (rw <= 0.001) continue;
        const v = eyerollLook(u, look);
        look = { x: lerp(look.x, v[0], rw), y: lerp(look.y, v[1], rw) };
        tilt += 4 * Math.sin(Math.PI * u) * rw;
        const dw = 0.6 * Math.sin(Math.PI * u) * rw;
        const nw = {};
        for (const k in weights) nw[k] = weights[k] * (1 - dw);
        addW(nw, 'deadpan', dw);
        weights = nw;
      } else if (r.kind === 'nod' && extra.nod !== false) {
        tilt -= 5 * Math.sin(Math.PI * u) ** 2;
      }
    }
  }
  // to camera (wins over the turn's 3/4 head)
  let tsx = 1, tsy = 1, ht = c.turnHT || 0;
  if (who === 'barry' || extra.toCamera) {
    const tc = turnToCamera(S, extra.toCamera || 'barry_to_camera', { who });
    if (tc.active) {
      ht = Math.max(ht, tc.headTurn);
      tilt *= 1 - tc.k;
      tsx = tc.sx; tsy = tc.sy;
    }
  }
  if (ht > 0) {
    o.headTurn = ht;
    if (ht >= 0.5) look = null;          // the 3/4 head looks at the camera by default
  }
  if (look) o.look = { x: clamp(fin(look.x, 0.3), -1, 1), y: clamp(fin(look.y, 0), -1, 1) };
  o.headTilt = tilt + (extra.tiltAdd || 0);
  o.mood = Object.keys(weights).length === 1 ? Object.keys(weights)[0] : weights;
  // lighting
  const lt = lightFor(L.setting, extra.env || {});
  if (lt) { o.tint = lt.tint; o.rim = lt.rim; }
  // squash: turn × toCamera × user
  const us = extra.squash || {};
  const kit = {
    sx: c.sx * tsx * fin(us.sx, 1), sy: c.sy * tsy * fin(us.sy, 1), dy: fin(us.dy, 0),
    face: c.face, gaze: g.target, moodName: M.name, inWater: c.inWater !== false && (o.pose === 'swim'), turning: !!c.turning,
  };
  // user overrides win
  for (const k in extra) {
    if (KIT_KEYS.includes(k) || k === 'accessories') continue;
    if (extra[k] === undefined) continue;
    o[k] = extra[k];
  }
  if (extra.accessories) o.accessories = { ...(o.accessories || {}), ...extra.accessories };
  if (extra.mood) kit.moodName = typeof extra.mood === 'string' ? extra.mood : domMood(extra.mood);
  if (extra.inWater != null) kit.inWater = !!extra.inWater;
  const r = sanitize(o);
  r.kit = kit;
  return r;
}
function extraOpts(S, e = {}) {
  const i = e.index ?? 0;
  const o = {
    who: 'extra', seed: e.seed ?? i * 3 + 1, x: fin(e.x, 640), y: fin(e.y, 540), scale: posv(e.scale, 0.72), flip: !!e.flip,
    pose: e.pose || 'swim', t: S.T + i * 1.71 + 0.3, blink: true,
  };
  const lt = lightFor(S.scene.setting, e.env || {});
  if (lt) { o.tint = lt.tint; o.rim = lt.rim; }
  for (const k in e) if (!['index', 'env', 'water', 'inWater'].includes(k) && e[k] !== undefined) o[k] = e[k];
  const r = sanitize(o);
  r.kit = { sx: 1, sy: 1, dy: 0, face: r.flip ? -1 : 1, inWater: e.inWater !== false && r.pose === 'swim' };
  return r;
}
function sanitize(o) {
  const r = { ...o };
  r.x = clamp(fin(r.x, 640), -XY_LIM, XY_LIM); r.y = clamp(fin(r.y, 600), -XY_LIM, XY_LIM);
  r.scale = clamp(posv(r.scale, 1, 0.02), 0.02, 12); r.rot = fin(r.rot, 0);
  r.t = fin(r.t, 0); r.talk = clamp(fin(r.talk, 0)); r.headTilt = fin(r.headTilt, 0);
  if (r.headTurn != null) r.headTurn = clamp(fin(r.headTurn, 0));
  if (r.look) r.look = { x: clamp(fin(r.look.x, 0.3), -1, 1), y: clamp(fin(r.look.y, 0), -1, 1) };
  if (r.walkPhase != null) r.walkPhase = fin(r.walkPhase, 0);
  for (const k of ['eyes', 'pawUp', 'tremble']) if (r[k] != null) r[k] = clamp(fin(r[k], 0), 0, k === 'tremble' ? 4 : 1);
  if (r.pawAt) r.pawAt = { x: fin(r.pawAt.x, 60), y: fin(r.pawAt.y, 0) };
  if (r.waterline != null && !Number.isFinite(r.waterline)) delete r.waterline;
  if (r.tint && r.tint.amount != null) r.tint = { ...r.tint, amount: clamp(fin(r.tint.amount, 0.3)) };
  return r;
}
const NUM_ENV = new Set(['volcanoSmoke', 'waterHeat', 'rumble', 'erupt', 'lava', 'signBurn', 'dusk', 'hillPuff', 'grade', 'puff', 'ash', 'smoke', 'glow', 'sunset', 'flow', 'raftX', 'raftY', 'raftW', 'hourglass', 'oranges', 'groveShake', 'flash', 'opacity', 'scale', 'x', 'y', 'bob', 'wake', 'wind', 'rock', 'build', 'clear', 'shelleyLight']);
// drop non-finite numbers from an env/options object (env libs clamp, but NaN slips through clamp)
function finiteOpts(o) {
  const r = {};
  for (const k in o || {}) {
    const v = o[k];
    if (typeof v === 'number' && !Number.isFinite(v)) continue;
    if (NUM_ENV.has(k) && typeof v !== 'number') continue;
    r[k] = v;
  }
  return r;
}
function drawCast(ctx, o) {
  const s = sanitize(o);
  const k = o.kit || {};
  withSquash(ctx, s.x, s.y, fin(k.sx, 1), fin(k.sy, 1), () => {
    if (k.dy) { ctx.save(); ctx.translate(0, fin(k.dy, 0) * s.scale); }
    try { CAP.drawCapybara(ctx, s); } finally { if (k.dy) ctx.restore(); }
  });
}
// where drawCast puts a point p of the unsquashed rig (squash about the origin, then dy·scale·sy)
function squashPoint(o, p) {
  const k = o.kit || {};
  const sx = fin(k.sx, 1), sy = fin(k.sy, 1), dy = fin(k.dy, 0) * (o.scale ?? 1);
  return { ...p, x: o.x + (p.x - o.x) * sx, y: o.y + (p.y + dy - o.y) * sy };
}
function castAnchors(o) {
  const a = CAP.capyAnchors(sanitize(o));
  const out = {};
  for (const key in a) {
    const v = a[key];
    out[key] = v && typeof v === 'object' && 'x' in v ? squashPoint(o, v) : v;
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════ Gerald & Shelley
// Gerald's drawVulture options at a given position (x, y, scale, flip, rot): talk, mood, gaze.
function geraldAt(S, L, pos, extra = {}, hostWho = null, inFlight = false) {
  const M = moodAt(S, 'gerald', extra.rest);
  const o = { t: S.T + PHASE.gerald, pose: 'perch', talk: clamp(fin(S.talk('gerald'), 0) * (extra.talkGain ?? 1)), mood: M.name || 'smug', scale: 0.75, ...pos };
  const va = CRIT.vultureAnchors(sanitizeV(o));
  const me = { who: 'gerald', eye: va.eye, flip: !!o.flip };
  const Lg = { ...L, gerald: { host: hostWho, head: va.head } };
  if (!inFlight || extra.look || extra.lookAt) {
    const g = gazeAt(S, 'gerald', Lg, me, o.mood, extra);
    o.look = { x: g.x, y: g.y };
  }
  for (const k in extra) {
    if (GERALD_KIT_KEYS.includes(k) || ['layout', 'rest', 'lookAt', 'talkGain', 'x', 'y', 'scale', 'flip', 'rot'].includes(k)) continue;
    if (extra[k] !== undefined) o[k] = extra[k];
  }
  return sanitizeV(o);
}
// standalone: perched on a castOpts object / cast name, or at extra.x/y
function geraldOpts(S, extra = {}) {
  extra = extra || {};
  const L = extra.layout || buildLayout(S, { gerald: typeof extra.on === 'string' ? { on: extra.on } : extra });
  let host = null;
  if (extra.on) host = typeof extra.on === 'object' ? extra.on : castOpts(S, extra.on, { layout: L });
  const pos = { scale: 0.75 };
  let hostWho = null;
  if (host) {
    const a = castAnchors(host);
    Object.assign(pos, { x: a.headTop.x, y: a.headTop.y, rot: fin(a.headTop.angle, 0), scale: 0.75 * (host.scale ?? 1), flip: !!host.flip });
    hostWho = host.who || null;
  }
  for (const k of ['x', 'y', 'scale', 'flip', 'rot']) if (extra[k] !== undefined) pos[k] = extra[k];
  return geraldAt(S, L, pos, extra, hostWho);
}
function sanitizeV(o) {
  const r = { ...o };
  r.x = clamp(fin(r.x, 640), -XY_LIM, XY_LIM); r.y = clamp(fin(r.y, 400), -XY_LIM, XY_LIM);
  r.scale = clamp(posv(r.scale, 0.75, 0.02), 0.02, 12); r.rot = fin(r.rot, 0); r.t = fin(r.t, 0);
  r.talk = clamp(fin(r.talk, 0));
  if (r.look) r.look = { x: clamp(fin(r.look.x, 0), -1, 1), y: clamp(fin(r.look.y, 0), -1, 1) };
  for (const k of ['wing', 'poseMix', 'fold', 'crouch', 'ruffle', 'nod', 'flare']) if (r[k] != null) r[k] = clamp(fin(r[k], 0));
  if (r.legs != null) r.legs = clamp(fin(r.legs, 0), -0.3, 1);
  if (r.flapPhase != null) r.flapPhase = fin(r.flapPhase, 0);
  return r;
}
function shelleyOpts(S, extra = {}) {
  extra = extra || {};
  const L = extra.layout || buildLayout(S, { setting: 'therapy_office' });
  const M = moodAt(S, 'shelley', extra.rest);
  const o = { x: EO.OFFICE.chair.x, y: EO.OFFICE.chair.y, flip: true, scale: 1, t: S.T + PHASE.shelley, talk: clamp(fin(S.talk('shelley'), 0) * (extra.talkGain ?? 1)), mood: M.name || 'neutral' };
  for (const k of ['x', 'y', 'scale', 'flip']) if (extra[k] !== undefined) o[k] = extra[k];
  if (S.has('shelley_writes')) {
    const b = beat(S, 'shelley_writes');
    if (!b.before) o.write = b.k;
  }
  const ta = CRIT.tortoiseAnchors(o);
  const me = { who: 'shelley', eye: ta.eye, flip: !!o.flip };
  const g = gazeAt(S, 'shelley', L, me, o.mood, extra);
  o.look = { x: g.x, y: g.y };
  for (const k in extra) {
    if (['layout', 'rest', 'lookAt', 'talkGain', 'x', 'y', 'scale', 'flip'].includes(k)) continue;
    if (extra[k] !== undefined) o[k] = extra[k];
  }
  const r = sanitizeV(o);
  if (r.write != null) r.write = clamp(fin(r.write, 0));
  if (r.neck != null) r.neck = clamp(fin(r.neck, 0), -1, 1);
  return r;
}
// LOW-LEVEL arc helper (the stages use critters' geraldLanding / geraldTakeoff / geraldHop):
// Gerald along a quadratic arc from `from` to `to` (feet origin), poses blended continuously
// (fly → flare → land → perch for 'land'; perch → takeoff → fly for 'takeoff'). He faces the
// direction of travel throughout; turn him yourself (K.turnEnv) if he must end facing the other way.
function geraldFlight(t, f) {
  const t0 = f.t0 ?? 0, dur = Math.max(0.05, f.dur ?? 1.4), mode = f.mode || 'land';
  const from = f.from || { x: 1400, y: 60 }, to = f.to || { x: 640, y: 400 };
  const arc = f.arc ?? 90;
  const u = clamp((t - t0) / dur);
  const dir = to.x < from.x ? -1 : 1;
  const flip = dir < 0;
  const quad = (a, b, k, h) => {
    const cx = (a.x + b.x) / 2, cy = Math.min(a.y, b.y) - h;
    const v = 1 - k;
    return { x: v * v * a.x + 2 * v * k * cx + k * k * b.x, y: v * v * a.y + 2 * v * k * cy + k * k * b.y };
  };
  if (mode === 'land') {
    const k = ease.outCubic(u);
    const p = quad(from, to, k, arc * 0.4);
    const flare = smoothstep(0.5, 0.85, u), settle = smoothstep(0.86, 1, u);
    const air = settle <= 0;
    return {
      x: p.x, y: p.y, pose: air ? 'fly' : 'land', pose2: air ? 'land' : 'perch', poseMix: air ? flare : settle,
      legs: air ? lerp(0.1, 1, smoothstep(0.6, 0.86, u)) : lerp(1, 0, settle), wing: 1, fold: settle, flip, rot: dir * -0.08 * (1 - k), u,
    };
  }
  const P = 0.22;
  if (u < P) {
    const k = u / P;
    return { x: from.x, y: from.y, pose: 'perch', pose2: 'takeoff', poseMix: ease.inOutSine(k), legs: lerp(0, 0.6, k), fold: 1 - k, wing: 1, flip, rot: 0, u };
  }
  const k = ease.inQuad((u - P) / (1 - P));
  const p = quad(from, to, k, arc);
  return { x: p.x, y: p.y, pose: 'takeoff', pose2: 'fly', poseMix: smoothstep(0, 0.35, k), legs: lerp(0.6, 0, smoothstep(0, 0.4, k)), fold: 0, wing: 1, flip, rot: dir * 0.1 * k, u };
}
// A quick on-the-spot turn (x squash through ~0.15 at the flip): {flip, sx, lift (0..1), active}.
function turnEnv(t, t0, from, to, dur = 0.26) {
  if (!!from === !!to || !(t >= t0)) return { flip: !!from, sx: 1, lift: 0, active: false };
  const u = (t - t0) / Math.max(0.05, dur);
  if (u >= 1) return { flip: !!to, sx: 1, lift: 0, active: false };
  const s = Math.sin(Math.PI * u);
  return { flip: u < 0.5 ? !!from : !!to, sx: 1 - 0.8 * s, lift: s, active: true };
}

// ═════════════════════════════════════════════════════════════════════════════ camera
const toScreen = (cam, p) => ({ x: (p.x - cam.x) * cam.zoom + 640, y: (p.y - cam.y) * cam.zoom + 360 });
const toWorld = (cam, p) => ({ x: (p.x - 640) / cam.zoom + cam.x, y: (p.y - 360) / cam.zoom + cam.y });
// Close-up framing on who's face: eye at screen y `eyeY`; horizontally the camera sits `k` of the
// way from the body origin to the eye. Uses the SMOOTHED facing and bob-free anchors, so when Barry
// turns the camera eases across over ~0.9 s instead of whip-panning, and it never bobs with him.
function faceFrame(L, who, o = {}) {
  const c = L && L.chars[who];
  if (!c) return null;
  const zoom = Math.min(4.6, (o.zoom ?? 2.8) / Math.pow(Math.max(0.2, c.scale), o.norm ?? 0.8));
  const eyeY = o.eyeY ?? 330, k = o.k ?? 0.75;
  const f = c.face ?? (c.flip ? -1 : 1);
  return { x: c.x + f * c.eyeDX * k + (o.dx || 0), y: c.eye.y + (360 - eyeY) / zoom, zoom };
}
function resolveFraming(f, I) {
  let r = typeof f === 'function' ? f(I) : f;
  if (!r) return null;
  if (typeof r === 'string') return null;
  return { ...r };
}
function applyMove(cam, m, I, base) {
  const sh = I.shot;
  const at = m.at != null ? keyTime(I.S, m.at) : sh.t0 + (m.delay || 0);
  const dur = m.dur != null ? m.dur : Math.max(0.1, sh.t1 - at);
  const k = easeFn(m.ease)(clamp((I.S.t - at) / Math.max(1e-3, dur)));
  if (k <= 0) return cam;
  const res = (v) => (v === 'base' ? base : typeof v === 'function' ? v(I) : v);
  const from = m.from ? { ...cam, ...res(m.from) } : cam;
  const to = { ...cam, ...res(m.to) };
  return { ...cam, ...U.camLerp({ zoom: 1, ...from }, { zoom: 1, ...to }, k) };
}
// Keep the view (+ a shake margin in screen px) inside the painted world of `kind`.
function clampCam(cam, kind, marginPx = 0) {
  const Wd = WORLD[kind] || WORLD.other;
  cam.rot = fin(cam.rot, 0);
  cam.t = fin(cam.t, 0);
  const minZ = Math.max(DW / (Wd.x1 - Wd.x0), DH / (Wd.y1 - Wd.y0));
  cam.zoom = clamp(fin(cam.zoom, 1), minZ * 1.001, 40);
  const Wc = cam.zoom >= CLOSE_ZOOM && WORLD_CLOSE[kind] ? WORLD_CLOSE[kind] : Wd;
  const m = Math.max(fin(marginPx, 0), fin(cam.shake, 0) * 1.2) / cam.zoom;
  const hw = DW / 2 / cam.zoom + m, hh = DH / 2 / cam.zoom + m;
  cam.x = clamp(fin(cam.x, 640), Wc.x0 + hw, Math.max(Wc.x0 + hw, Wc.x1 - hw));
  cam.y = clamp(fin(cam.y, 360), Wc.y0 + hh, Math.max(Wc.y0 + hh, Wc.y1 - hh));
  // a close bound that is narrower than the view falls back to the painted world
  cam.x = clamp(cam.x, Wd.x0 + hw, Math.max(Wd.x0 + hw, Wd.x1 - hw));
  cam.y = clamp(cam.y, Wd.y0 + hh, Math.max(Wd.y0 + hh, Wd.y1 - hh));
  return cam;
}
// clamp with the shake margin, then fold the smooth shake into x / y / rot (cam.shake → 0, the
// amplitude stays in cam.shakeAmp). Used for the kit's cameras and for cfg.camera objects.
function finishCam(cam, kind, T, amp) {
  amp = clamp(fin(amp, 0), 0, 80);
  cam.shake = 0;
  clampCam(cam, kind, shakeMarginPx(amp));
  if (amp > 0) {
    const s = shakeOffset(T, amp);
    cam.x += s.x / cam.zoom; cam.y += s.y / cam.zoom; cam.rot += s.rot;
  }
  cam.shakeAmp = amp;
  cam.t = fin(T, 0);
  return cam;
}
function cameraFor(S, framings, opts = {}) {
  const sh = shot(S);
  const name = opts.name || (typeof S.cam === 'function' ? S.cam() : null) || sh.name;
  const kind = opts.kind || kindOf(opts.setting || S.scene.setting);
  const I = { S, L: opts.layout || null, st: opts.st || null, shot: { ...sh, name }, kind, name, opts };
  let f = framings[name];
  if (!f) {
    const fb = opts.fallback && framings[opts.fallback] ? opts.fallback : framings.wide ? 'wide' : framings.trio ? 'trio' : null;
    warnOnce(`cam:${S.id}:${name}`, `scene ${S.id}: no framing named "${name}" — using ${fb || 'the full frame'}`);
    f = fb ? framings[fb] : { x: 640, y: 360, zoom: 1 };
  }
  let base = resolveFraming(f, I) || { x: 640, y: 360, zoom: 1 };
  base.zoom = posv(base.zoom, 1, 0.2);
  let cam = { ...base };
  const moves = [].concat(base.move || [], base.moves || [], (opts.moves && opts.moves[name]) || []);
  for (const m of moves) cam = applyMove(cam, m, I, base);
  // drift / push (per held shot)
  const tShot = Math.max(0, sh.t);
  const push = fin(base.push ?? opts.push, cam.zoom > 1.9 ? 0.009 : 0.006);
  const drift = fin(base.drift ?? opts.drift, 1);
  const dirSeed = hash1(sh.index * 1.93 + S.scene.start * 0.37);
  cam.zoom *= 1 + Math.min(0.06, push * tShot);
  if (drift) {
    const ph = dirSeed * TAU;
    const dirx = dirSeed < 0.5 ? -1 : 1;
    cam.x += ((dirx * 2.2 * tShot) / Math.max(1, Math.sqrt(1 + tShot * 0.3)) + Math.sin(tShot * 0.31 + ph) * 2.5) * drift / cam.zoom;
    cam.y += (Math.sin(tShot * 0.23 + ph * 1.7) * 2) * drift / cam.zoom;
  }
  // shake amplitude (screen px)
  let shake = fin(base.shake, 0);
  if (opts.shake !== false) {
    shake += sfxShake(S, opts.shakeTable || SHAKE_SFX) * (opts.shakeGain ?? 1);
    if (typeof opts.shake === 'number') shake += opts.shake;
    if (typeof opts.shake === 'function') shake += fin(opts.shake(S), 0);
  }
  cam.rot = fin(cam.rot, 0);
  finishCam(cam, kind, S.T, shake);
  cam.name = name; cam.tShot = tShot; cam.base = base; cam.foliage = base.foliage;
  return cam;
}
// user camera (cfg.camera object or fn) → clamped + smooth shake
function userCamera(S, cfg, st, kind) {
  const c = typeof cfg.camera === 'function' ? cfg.camera(S, st) : cfg.camera;
  const cam = { x: 640, y: 360, zoom: 1, ...(c || {}) };
  const amp = fin(cam.shake, 0);
  finishCam(cam, kind, S.T, amp);
  cam.name = cam.name || 'custom'; cam.base = cam.base || { ...c }; cam.tShot = shot(S).t;
  return cam;
}

// ─────────────────────────────────────────────────────────────── framings
const SP = ES.SPRING, NSP = ES.NEW_SPRING;
// close-up: tighter when the head is bare, a little wider (and lower) when Gerald sits on it
const cu = (who, bare, withG) => (I) => {
  const g = I.L && I.L.gerald && I.L.gerald.host === who;
  return faceFrame(I.L, who, g ? withG : bare);
};
// swimmer points for the group framings: the scene's DEFAULT blocking (swimSpots) unless
// opts.trioFrom === 'live' (then: the live, visible, in-pool swimmers)
function groupPoints(I, who) {
  const from = (I.opts && I.opts.trioFrom) || 'default';
  const L = I.L;
  if (from === 'live' && L) {
    return Object.values(L.chars).filter((c) => (!who || who.includes(c.who)) && c.pose === 'swim' && (L.kind !== 'spring' || ES.inPool(c.x, c.y)))
      .map((c) => ({ x: c.x, y: c.y, scale: c.scale, who: c.who }));
  }
  const A = springAnchors(L ? L.setting : 'spring_day');
  const list = who || (I.opts && I.opts.trioWho) || CAPY_CAST;
  return list.map((w) => A.swimSpots[w] && { ...A.swimSpots[w], who: w }).filter(Boolean);
}
function trioFrame(I, o = {}) {
  const pts = groupPoints(I, o.who);
  if (!pts.length) return { x: 652, y: 448, zoom: 1.3 };
  let x0 = Infinity, x1 = -Infinity, wl = 0;
  for (const c of pts) { x0 = Math.min(x0, c.x - 150 * c.scale); x1 = Math.max(x1, c.x + 150 * c.scale); wl += c.y; }
  wl /= pts.length;
  const zoom = o.zoom ?? clamp(DW / ((x1 - x0) * 0.96), 1.2, 1.75);
  const wlY = o.waterlineY ?? 610;
  return { x: (x0 + x1) / 2, y: wl + (360 - wlY) / zoom, zoom, foliage: 0.65 };
}
function twoShot(I, a, b, dx) {
  const pts = groupPoints(I, [a, b]);
  if (pts.length < 2) return trioFrame(I);
  return { x: (pts[0].x + pts[1].x) / 2 + dx, y: (pts[0].y + pts[1].y) / 2 - 95, zoom: 1.85 };
}
// gerald_cu: framed on his PERCH (the landing target / the take-off perch / the hop's perch for
// this shot), never on the flight — he flies in and out of a locked frame. Follows a host only
// through the host's bob-free, face-smoothed head.
function geraldFrame(I, zoom = 2.5, eyeY = 250) {
  const st = I.st;
  let head = st && st.gerald && st.gerald.perchHead ? st.gerald.perchHead : null;
  let flip = st && st.gerald && st.gerald.perchFlip != null ? st.gerald.perchFlip : false;
  if (!head && I.L && I.L.gerald) head = I.L.gerald.head;
  if (!head) {
    const b = I.L && I.L.chars.barry;
    if (!b) return null;
    head = { x: b.headTop.x, y: b.headTop.y - 60 * b.scale };
    flip = b.flip;
  }
  const f = flip ? -1 : 1;
  return { x: head.x + f * 0.08 * (DW / zoom), y: head.y + 14 + (360 - eyeY) / zoom, zoom };
}
// volcano (spring): follows the rolling orange down to the pool when the shot holds 'orange_rolls',
// frames the crater with sky for the sneeze puffs otherwise, pulls back as env.erupt grows
function volcanoFrame(I) {
  const e = smoothstep(0.04, 0.35, (I.st && I.st.env && I.st.env.erupt) || 0);
  const S = I.S, sh = I.shot;
  if (e <= 0 && S.has('orange_rolls')) {
    const r0 = S.cue('orange_rolls'), rd = Math.max(0.5, S.cueDur('orange_rolls') || 1.8);
    if (r0 < sh.t1 - 0.05 && r0 + rd > sh.t0) {
      return { x: 815, y: 292, zoom: 1.85, push: 0, drift: 0.5, move: { at: r0 + 0.1, dur: rd + 0.1, to: { x: 925, y: 425, zoom: 1.7 }, ease: 'inOutSine' } };
    }
  }
  return { x: lerp(872, 860, e), y: lerp(214, 196, e), zoom: lerp(1.65, 1.38, e), push: 0.01 };
}
// escape: rides the runners (live, visible, out-of-the-water cast) along the bank to the raft
function escapeFrame(I) {
  const L = I.L;
  const run = L ? Object.values(L.chars).filter((c) => c.pose !== 'swim') : [];
  if (!run.length) return { x: 330, y: 480, zoom: 1.55, foliage: 0.4 };
  let cx = 0, cy = 0;
  for (const c of run) { cx += c.x; cy += c.y; }
  cx /= run.length; cy /= run.length;
  return { x: clamp(lerp(330, cx, 0.7), 160, 620), y: clamp(cy - 45, 400, 520), zoom: 1.85, foliage: 0.35, push: 0.003 };
}
const SPRING_FRAMINGS = {
  establishing: { x: 660, y: 330, zoom: 0.94, push: 0.008, foliage: 1 },
  establishing_push: { x: 650, y: 350, zoom: 1.0, foliage: 1, push: 0, move: { to: { x: 652, y: 500, zoom: 1.55 }, ease: 'inOutSine' } },
  // slow pan along the extras' row (s01 'Birds perch on it...': pair with extras:'open')
  extras: { x: 400, y: 486, zoom: 1.95, push: 0.004, foliage: 0.5, move: { to: { x: 900, y: 478, zoom: 2.0 }, ease: 'inOutSine' } },
  wide: { x: 640, y: 360, zoom: 1.0, foliage: 1 },
  trio: (I) => trioFrame(I),
  two_shot_sunny: (I) => twoShot(I, 'sunny', 'barry', 10),
  two_shot_doreen: (I) => twoShot(I, 'barry', 'doreen', -10),
  barry_cu: cu('barry', { zoom: 3.0, eyeY: 330 }, { zoom: 2.5, eyeY: 418 }),
  sunny_cu: cu('sunny', { zoom: 2.75, eyeY: 345 }, { zoom: 2.35, eyeY: 418 }),
  doreen_cu: cu('doreen', { zoom: 2.95, eyeY: 335 }, { zoom: 2.45, eyeY: 418 }),
  gerald_cu: (I) => geraldFrame(I),
  volcano: volcanoFrame,
  fish: { x: 250, y: 548, zoom: 2.0 },
  thermometer: { x: SP.thermometerSpot.x + 4, y: SP.thermometerSpot.y - 40, zoom: 4.4, push: 0.012 },
  // the EXIT row (EXIT · NO, REALLY. THIS WAY. · YES, YOU, SUNNY) on the back-left bank
  signs: { x: 292, y: 445, zoom: 2.4, push: 0.005 },
  // the SPRING RULES sign + Barry's head below it (Gerald's hop target), both above the subtitles
  rules: (I) => {
    const ns = I.L && I.L.setting === 'new_spring';
    return ns ? { x: NSP.rulesSignSpot.x + 10, y: 432, zoom: 1.9 } : { x: SP.rulesSignSpot.x + 26, y: 425, zoom: 1.9 };
  },
  raft: { x: SP.raftMoor.x + 70, y: 520, zoom: 2.15 },
  // a medium on Barry (the chin strap), neighbours cropped
  helmet: (I) => faceFrame(I.L, 'barry', { zoom: 2.25, eyeY: 315, k: 0.4 }) || { x: 670, y: 470, zoom: 2.25 },
  escape: escapeFrame,
  // spring_day/evening: the SNOOZE SPRINGS board; new_spring: SNOOZE SPRINGS 2 + the rules sign
  // beside it, Doreen's frown at the chart in the lower left (heads above the subtitles)
  sign: (I) => (I.L && I.L.setting === 'new_spring'
    ? { x: 1085, y: 418, zoom: 1.75, push: 0.006 }
    : { x: SP.signPos.x - 45, y: 436, zoom: 2.05, push: 0.006 }),
};
const OF = EO.OFFICE;
const OFFICE_FRAMINGS = {
  office_wide: { x: 640, y: 372, zoom: 0.98, push: 0.005 },
  barry_couch: (I) => {
    const b = I.L && I.L.chars.barry;
    if (!b) return { x: 420, y: 450, zoom: 2.1 };
    return { x: b.eye.x - 30, y: b.eye.y - 22, zoom: 2.2 };
  },
  shelley_cu: (I) => {
    const p = (I.st && I.st.shelley && I.st.shelley.anchors.eye) || OF.shelleyHead;
    return { x: p.x - 18, y: p.y + (360 - 285) / 2.9, zoom: 2.9 };
  },
  window: { x: 912, y: 286, zoom: 2.05, push: 0.004 },
  gerald_cu: (I) => geraldFrame(I, 2.6, 260),
};
// river barry_cu: Barry sits at the bow facing ahead, so a 4x close-up keeps Doreen's face out of
// frame and the mast behind his back. Mount Snooze is CHEATED (env.volcano, fixed for the shot — it is
// part of the cached background) to peek over his head-back, smoke rising out of frame. Framed on
// his REST seat (no raft bob in the camera) and on his facing for this shot; a mid-shot turn pans
// with the smoothed face. The stage passes cam.base.envVolcano to the background.
const RIVER_CU = { zoom: 4.0, eyeX: 500, eyeY: 455, vol: { x: -14, y: -80 } };
function riverBarryCU(I) {
  const L = I.L, b = L && L.chars.barry;
  if (!b) return { ...EO.RIVER.framings.barry_cu };
  const sh = I.shot;
  const fRef = facingAt(I.S, 'barry', L, b.cc || {}, Math.min(sh.t1 - 0.01, sh.t0 + 0.7));
  const sgn = fRef.flip ? -1 : 1;
  const rest = b.rest || b;
  const z = RIVER_CU.zoom;
  const eyeY = rest.y + b.eyeDY;
  const eyeRefX = rest.x + sgn * b.eyeDX;
  const eyeNowX = rest.x + b.face * b.eyeDX;
  const sx = lerp(DW - RIVER_CU.eyeX, RIVER_CU.eyeX, clamp((b.face + 1) / 2));
  return {
    x: eyeNowX + (640 - sx) / z, y: eyeY + (360 - RIVER_CU.eyeY) / z, zoom: z, push: 0.004,
    envVolcano: { x: Math.round(eyeRefX + sgn * RIVER_CU.vol.x), y: Math.round(eyeY + RIVER_CU.vol.y) },
  };
}
const RIVER_FRAMINGS = {
  raft_wide: (I) => {
    const r = I.L && I.L.raft ? I.L.raft.opts : { x: 640, y: 520 };
    return { x: r.x + 20, y: r.y - 152, zoom: 1.5, push: 0.005 };
  },
  barry_cu: riverBarryCU,
  sunny_cu: cu('sunny', { zoom: 2.4, eyeY: 360, k: 0.2 }, { zoom: 2.1, eyeY: 400 }),
  doreen_cu: cu('doreen', { zoom: 2.45, eyeY: 355, k: 0.2 }, { zoom: 2.15, eyeY: 395 }),
  // the mast top + banner + Gerald only: the passengers' heads stay below the frame
  gerald_flag: (I) => {
    const RA = I.L && I.L.raft && (I.L.raft.rest || I.L.raft.anchors);
    if (!RA) return { x: 760, y: 250, zoom: 2.6 };
    return { x: RA.mastTop.x + 96 * (RA.scale || 1), y: RA.mastTop.y + 18, zoom: 2.75, push: 0.004 };
  },
  gerald_cu: (I) => geraldFrame(I, 2.6, 260),
  fish: (I) => {
    const r = I.L && I.L.raft ? I.L.raft.opts : { x: 640, y: 520 };
    return { x: r.x - 150, y: r.y + 10, zoom: 1.9 };
  },
  volcano: { x: EO.RIVER.volcano.x - 6, y: EO.RIVER.volcano.y - 68, zoom: 3.0 },
  wide: { x: 640, y: 360, zoom: 1.0 },
};

// ═════════════════════════════════════════════════════════════════════════════ stages
function runHook(hooks, name, ctx, st) {
  const h = hooks && hooks[name];
  if (typeof h === 'function') { ctx.save(); try { h(ctx, st); } finally { ctx.restore(); } }
}
function stageBase(S, t, setting, kind, L, env) {
  const st = { S, t, T: S.T, setting, kind, env, layout: L, cast: {}, gerald: null, extras: [] };
  st.toScreen = (p) => toScreen(st.cam, p);
  st.toWorld = (p) => toWorld(st.cam, p);
  return st;
}
// one cast member for a stage: castOpts + the stage light. The exact extra object is stored, so
// a later re-aim (regaze) rebuilds the SAME character (accessories, rest, squash...).
function castEntry(S, who, extra, cfg, light) {
  const o = castOpts(S, who, extra);
  if (cfg.light === false) { delete o.tint; delete o.rim; } else if (light) { if (!extra.tint) o.tint = light.tint; if (!extra.rim) o.rim = light.rim; }
  return { opts: o, anchors: castAnchors(o), extra };
}

// ── Gerald on a stage: perches, landing, take-off, hops (critters choreography)
const GERALD_KIT_KEYS = ['on', 'land', 'takeoff', 'hop', 'hidden', 'preVisible', 'layer', 'sign', 'dx', 'depthY'];
function movTiming(S, m, defDur) {
  let t0 = m.t0, dur = m.dur;
  if (m.beat) { if (t0 == null) t0 = S.cue(m.beat); if (dur == null) dur = S.cueDur(m.beat); }
  t0 = keyTime(S, t0 == null ? 0 : t0);
  if (dur == null || !(dur > 0)) { const c = cueAt(S, t0); dur = c && c.dur > 0.3 ? c.dur : defDur; }
  return { t0, dur: Math.max(0.2, fin(dur, defDur)) };
}
// landing: critters' geraldLanding touches down at dur − 0.42. The touch-down is synced to a 'land' /
// 'thud' sfx inside the beat when there is one (else t0 + dur − 0.42); the flight starts early
// enough to have ≥ 1 s of approach.
function landTiming(S, land) {
  const m = movTiming(S, land, 1.6);
  let touch = land.touch != null && land.touch !== false ? keyTime(S, land.touch) : null;
  if (touch == null && land.touch !== false) {
    const c = sfxTimes(S, ['land', 'thud']).filter((x) => x >= m.t0 + 0.3 && x <= m.t0 + m.dur + 0.6);
    if (c.length) touch = c[0];
  }
  if (touch == null) touch = m.t0 + m.dur - 0.42;
  const cd = Math.max(1.0, touch + 0.42 - m.t0);
  return { t0: touch + 0.42 - cd, dur: cd, touch, end: touch + 0.42 };
}
// a perch → {x, y (feet), rot, scale, flip, host, layer, kind, headFrame (bob-free head for framing)}
function perchOf(S, st, p, gcfg) {
  if (p == null || p === false) return null;
  const L = st.layout;
  if (typeof p === 'string') {
    let entry = st.cast[p];
    if (!entry && CAPY_CAST.includes(p)) {
      // host hidden / not in the scene: he stays where its head would be at its default spot
      // (s09: left hanging in mid-air where Sunny's head used to be)
      const cc = castCfgOf(S, { cast: st.cfgCast || {} }, p);
      const ghost = castOpts(S, p, { rest: cc.rest, accessories: cc.accessories, setting: st.setting });
      const a = castAnchors(ghost);
      return { x: a.headTop.x, y: a.headTop.y, rot: fin(a.headTop.angle, 0), scale: 0.75 * ghost.scale, flip: !!ghost.flip, host: null, kind: 'ghost', layer: null };
    }
    if (entry) {
      const h = entry.opts, a = entry.anchors;
      const c = L && L.chars[p];
      return {
        x: a.headTop.x, y: a.headTop.y, rot: fin(a.headTop.angle, 0), scale: 0.75 * (h.scale ?? 1), flip: !!h.flip, host: p, kind: 'host',
        frameTop: c ? c.headTopSmooth : { x: a.headTop.x, y: a.headTop.y }, frameFlip: c ? c.face < 0 : !!h.flip,
      };
    }
    if (p === 'rules' && st.kind === 'spring') {
      const top = rulesSignAnchors({ setting: st.setting, ...(gcfg.sign || {}) }).top;
      return { x: top.x + (gcfg.dx || 0), y: top.y + 2, rot: 0, scale: 0.6, flip: false, host: null, layer: 'behind', kind: 'rules' };
    }
    if ((p === 'mast' || p === 'flag') && st.raft) {
      const RA = st.raft.anchors;
      if (p === 'mast') return { x: RA.mastTop.x, y: RA.mastTop.y, rot: RA.angle, scale: RA.geraldScale || 0.62, flip: false, host: null, kind: 'mast' };
      const fp = RA.flagPerch || { x: RA.flagCover.x, y: RA.flagCover.y + RA.flagCover.h * 0.5 };
      return { x: fp.x, y: fp.y, rot: RA.angle, scale: RA.geraldScale || 0.62, flip: false, host: null, kind: 'flag', crouch: 0.3 };
    }
    warnOnce(`perch:${S.id}:${p}`, `scene ${S.id}: Gerald perch "${p}" is not available here`);
    return null;
  }
  if (typeof p === 'object') {
    if (p.kit && p.who) {   // a castOpts object
      const a = castAnchors(p);
      return { x: a.headTop.x, y: a.headTop.y, rot: fin(a.headTop.angle, 0), scale: 0.75 * (p.scale ?? 1), flip: !!p.flip, host: null, kind: 'free' };
    }
    return { x: fin(p.x, 640), y: fin(p.y, 400), rot: fin(p.rot, gcfg.rot ?? 0), scale: posv(p.scale ?? gcfg.scale, 0.75), flip: !!(p.flip ?? gcfg.flip), host: null, kind: 'free' };
  }
  return null;
}
// Gerald's perched head (bob-free) at a perch, for gerald_cu
function perchHeadOf(pr, T) {
  if (!pr) return null;
  const base = pr.frameTop || { x: pr.x, y: pr.y };
  const flip = pr.frameFlip != null ? pr.frameFlip : pr.flip;
  const va = CRIT.vultureAnchors({ x: 0, y: 0, scale: pr.scale, flip, rot: 0, t: 0, pose: 'perch' });
  return { head: { x: base.x + va.head.x, y: base.y + va.head.y }, flip };
}
function resolveGerald(S, st, gcfgIn) {
  if (!gcfgIn || gcfgIn.hidden) return null;
  const gcfg = { ...gcfgIn };
  const t = S.t;
  const extra = {};
  for (const k in gcfg) if (!GERALD_KIT_KEYS.includes(k)) extra[k] = gcfg[k];
  let onSpec = gcfg.on;
  if (onSpec === undefined && gcfg.x != null) onSpec = { x: gcfg.x, y: gcfg.y, scale: gcfg.scale, flip: gcfg.flip, rot: gcfg.rot };
  const on = perchOf(S, st, onSpec, gcfg);
  if (on && typeof onSpec === 'string') for (const k of ['x', 'y', 'scale', 'flip', 'rot']) if (gcfg[k] !== undefined) on[k] = gcfg[k];
  let pos = null, host = null, layer = null, sx = 1, framePerch = on, inFlight = false, mode = 'perch';
  const perched = (pr, flip, lift = 0) => ({ x: pr.x, y: pr.y - lift * 7 * pr.scale, rot: pr.rot, scale: pr.scale, flip, ...(pr.crouch ? { crouch: pr.crouch } : {}) });
  if (gcfg.hop) {
    const hp = gcfg.hop;
    const H = movTiming(S, hp, 0.9);
    const other = perchOf(S, st, hp.from != null ? hp.from : hp.to, gcfg);
    const src = hp.from != null ? other : on, dst = hp.from != null ? on : other;
    if (src && dst) {
      const sh = shot(S);
      framePerch = sh.t0 < H.t0 + H.dur * 0.5 ? src : dst;
      const travel = Math.abs(dst.x - src.x) < 4 ? !!dst.flip : dst.x < src.x;
      const tEnd = H.t0 + H.dur;
      const p = (t - H.t0) / H.dur;
      if (p < 0) {
        pos = perched(src, src.flip); host = src.host; layer = src.layer || null;
      } else if (p >= 1) {
        const te = turnEnv(t, tEnd - 0.04, travel, dst.flip);
        pos = perched(dst, te.flip, te.lift); sx = te.sx; host = dst.host; layer = dst.layer || null;
        mode = te.active ? 'turn' : 'perch';
      } else {
        const ts = turnEnv(t, H.t0, src.flip, travel, Math.min(0.2, H.dur * 0.25));
        const kk = smoothstep(0.15, 0.85, p);
        const sc = lerp(src.scale, dst.scale, kk);
        const o = CRIT.geraldHop(p, { x: src.x, y: src.y, to: { x: dst.x, y: dst.y }, scale: sc, dur: H.dur, flip: travel });
        if (hp.style === 'shuffle') {
          const lineY = lerp(src.y, dst.y, ease.inOutSine(clamp((p * H.dur - 0.16) / Math.max(0.1, H.dur - 0.38))));
          o.y = lineY + (o.y - lineY) * 0.3;
          o.fold = 1 - (1 - fin(o.fold, 1)) * 0.45;
          o.wing = Math.min(fin(o.wing, 1), 0.6);
        }
        pos = { ...pickChoreo(o), x: o.x, y: o.y, scale: sc, rot: lerp(src.rot, dst.rot, kk), flip: ts.flip };
        sx = ts.sx;
        const tOff = 0.16 / H.dur, tOn = (H.dur - 0.22) / H.dur;
        if (p < tOff) { host = src.host; layer = src.layer || null; } else if (p >= tOn) { host = dst.host; layer = dst.layer || null; }
        mode = 'hop';
      }
    }
  }
  if (!pos && gcfg.land && on) {
    const Ld = landTiming(S, gcfg.land);
    if (t < Ld.t0 && !gcfg.preVisible) return null;
    const fr = gcfg.land.from || { dx: -240, dy: -170 };
    let travel = !!on.flip, from;
    const s = Math.max(0.05, on.scale);
    if (fr.x != null) {
      travel = Math.abs(fr.x - on.x) < 4 ? !!on.flip : fr.x > on.x;
      const fx = travel ? -1 : 1;
      from = { dx: ((fin(fr.x, on.x) - on.x) / s) * fx, dy: (fin(fr.y, on.y - 170) - on.y) / s };
    } else from = { dx: fin(fr.dx, -240), dy: fin(fr.dy, -170) };
    framePerch = on;
    if (t < Ld.t0 + Ld.dur) {
      const p = clamp((t - Ld.t0) / Ld.dur);
      const o = CRIT.geraldLanding(p, { x: on.x, y: on.y, scale: s, flip: travel, dur: Ld.dur, from });
      pos = { ...pickChoreo(o), x: o.x, y: o.y, scale: s, flip: travel, rot: on.rot * smoothstep(Ld.touch - 0.15, Ld.touch + 0.1, t) };
      inFlight = t < Ld.touch;
      host = t >= Ld.touch ? on.host : null;
      layer = t >= Ld.touch ? on.layer || null : null;
      mode = 'land';
    } else {
      const te = turnEnv(t, Ld.t0 + Ld.dur - 0.04, travel, on.flip);
      pos = perched(on, te.flip, te.lift); sx = te.sx; host = on.host; layer = on.layer || null;
      mode = te.active ? 'turn' : 'perch';
    }
  }
  if (!pos && gcfg.takeoff && on) {
    const Tk = movTiming(S, gcfg.takeoff, 1.5);
    framePerch = on;
    if (t >= Tk.t0 + Tk.dur) return null;
    if (t < Tk.t0) { pos = perched(on, on.flip); host = on.host; layer = on.layer || null; } else {
      const to = gcfg.takeoff.to || { dx: 520, dy: -380 };
      const s = Math.max(0.05, on.scale);
      let travel = !!on.flip, rel;
      if (to.x != null) {
        travel = Math.abs(to.x - on.x) < 4 ? !!on.flip : to.x < on.x;
        const fx = travel ? -1 : 1;
        rel = { dx: ((fin(to.x, on.x) - on.x) / s) * fx, dy: (fin(to.y, on.y - 380) - on.y) / s };
      } else rel = { dx: fin(to.dx, 520), dy: fin(to.dy, -380) };
      const p = clamp((t - Tk.t0) / Tk.dur);
      const o = CRIT.geraldTakeoff(p, { x: on.x, y: on.y, scale: s, flip: travel, dur: Tk.dur, to: rel });
      const te = turnEnv(t, Tk.t0, on.flip, travel, 0.2);
      const leapt = (t - Tk.t0) > 0.36;
      pos = { ...pickChoreo(o), x: o.x, y: o.y, scale: s, flip: te.flip, rot: on.rot * (1 - smoothstep(0.3, 0.6, t - Tk.t0)) };
      sx = te.sx;
      inFlight = leapt;
      host = leapt ? null : on.host; layer = leapt ? null : on.layer || null;
      mode = 'takeoff';
    }
  }
  if (!pos) {
    if (!on) return null;
    pos = perched(on, on.flip); host = on.host; layer = on.layer || null;
  }
  if (gcfg.layer) layer = gcfg.layer;
  const opts = geraldAt(S, st.layout, pos, extra, host, inFlight);
  const ph = perchHeadOf(framePerch, S.T);
  return {
    opts, anchors: CRIT.vultureAnchors(opts), host, layer, depthY: gcfg.depthY, sx, mode,
    perch: framePerch, perchHead: ph && ph.head, perchFlip: ph && ph.flip,
  };
}
const CHOREO_KEYS = ['pose', 'pose2', 'poseMix', 'flapPhase', 'legs', 'fold', 'wing', 'crouch', 'ruffle', 'flare', 'glide'];
function pickChoreo(o) {
  const r = {};
  for (const k of CHOREO_KEYS) if (o[k] !== undefined) r[k] = o[k];
  return r;
}
// After Gerald is resolved: store his real head in the layout and recompute the cast members who
// are looking at him (his perch was only estimated when their gazes were first computed). Each one
// is rebuilt from the exact extra object the stage used (accessories, soot, juice, helmet...).
function regaze(S, st, L, cfg, light) {
  const g = st.gerald;
  if (!g) return;
  L.gerald = { host: g.host || (L.gerald && L.gerald.host) || null, head: g.anchors.head };
  for (const who in st.cast) {
    if (who === g.host) continue;
    const e = st.cast[who];
    const ex = e.extra || {};
    if (e.opts.kit.gaze !== 'gerald' && ex.lookAt !== 'gerald') continue;
    st.cast[who] = castEntry(S, who, { ...ex, layout: L }, cfg, light);
  }
}
function drawGeraldEntry(ctx, st, g) {
  if (!g) return;
  const o = g.opts;
  let sx = fin(g.sx, 1), sy = 1;
  if (g.host && st.cast[g.host]) {
    // riding the host's head: his feet are already on the DRAWN (squashed) head top; he takes half
    // of the host's squash himself (turns / takes)
    const k = st.cast[g.host].opts.kit || {};
    sx *= 1 - (1 - fin(k.sx, 1)) * 0.5; sy *= 1 - (1 - fin(k.sy, 1)) * 0.5;
  }
  withSquash(ctx, o.x, o.y, sx, sy, () => CRIT.drawVulture(ctx, o));
}
function autoFoliage(cam, cfgF) {
  if (cfgF === false) return 0;
  if (typeof cfgF === 'number') return cfgF;
  if (cfgF && typeof cfgF === 'object') return cfgF.amount ?? 1;
  if (cfgF === true) return 1;
  if (cam.foliage != null) return cam.foliage;
  return cam.zoom <= 1.25 ? 1 : 0;
}

// ───────────────────────────────────────────────────────────── extras
// back: four dozers along the back of the pool (clear of the trio's silhouettes and the rules sign)
// open: s01 — the extras ARE the pool (use with cast: {sunny: false, doreen: false}): a bird on
//       one's head, an orange hat on another, everyone asleep
const EXTRAS = {
  back: [
    { x: 236, y: 548, scale: 0.72, flip: false, seed: 1 },
    { x: 540, y: 500, scale: 0.62, flip: false, seed: 4 },
    { x: 792, y: 500, scale: 0.62, flip: true, seed: 7 },
    { x: 1080, y: 540, scale: 0.74, flip: true, seed: 10 },
  ],
  open: [
    { x: 300, y: 566, scale: 0.86, flip: false, seed: 2, mood: 'sleepy', accessories: { bird: true } },
    { x: 470, y: 520, scale: 0.7, flip: true, seed: 5, mood: 'sleepy' },
    { x: 858, y: 520, scale: 0.72, flip: false, seed: 8, mood: 'chill', eyes: 0 },
    { x: 1000, y: 574, scale: 0.88, flip: true, seed: 11, mood: 'sleepy', accessories: { orange: true } },
    { x: 1120, y: 528, scale: 0.68, flip: true, seed: 13, mood: 'sleepy' },
  ],
};

// ───────────────────────────────────────────────────────────── spring
function drawSpringStage(ctx, t, S, cfg = {}) {
  const setting = cfg.setting || S.scene.setting;
  const kind = 'spring';
  const A = springAnchors(setting);
  const T = S.T;
  const env = finiteOpts({ volcanoSmoke: 0.3, ...(setting === 'spring_evening' ? { dusk: 0.15 } : {}), ...(typeof cfg.env === 'function' ? cfg.env(S) : cfg.env || {}) });
  if (env.rumble == null) env.rumble = rumbleLevel(S);
  const envShort = { ...env, setting: setting === 'spring_evening' ? 'evening' : setting === 'new_spring' ? 'new' : 'day' };
  const L = buildLayout(S, { ...cfg, setting });
  const st = stageBase(S, t, setting, kind, L, envShort);
  st.A = A;
  st.cfgCast = cfg.cast || {};
  const light = cfg.light === false ? null : cfg.light || lightFor(setting, env);
  for (const who of Object.keys(L.chars)) st.cast[who] = castEntry(S, who, { ...castCfgOf(S, cfg, who), layout: L, env }, cfg, light);
  // extras
  if (cfg.extras) {
    const list = Array.isArray(cfg.extras) ? cfg.extras : EXTRAS[cfg.extras === 'open' ? 'open' : 'back'];
    list.forEach((e, i) => {
      const o = extraOpts(S, { index: i, ...e, env });
      if (light && !e.tint) { o.tint = light.tint; o.rim = light.rim; }
      st.extras.push({ opts: o });
    });
  }
  // Gerald (+ re-aim anyone looking at him now that his real position is known)
  st.gerald = resolveGerald(S, st, cfg.gerald);
  regaze(S, st, L, cfg, light);
  // camera
  const framings = { ...SPRING_FRAMINGS, ...(cfg.framings || {}) };
  st.cam = cfg.camera ? userCamera(S, cfg, st, kind) : cameraFor(S, framings, { ...(cfg.cam || {}), layout: L, st, setting });
  const bg = setting === 'spring_evening' ? ES.drawSpringEvening : setting === 'new_spring' ? ES.drawNewSpring : ES.drawSpringDay;
  const ripCol = rippleColor(envShort);
  U.withCamera(ctx, st.cam, () => {
    bg(ctx, T, envShort);
    if (st.gerald && st.gerald.layer === 'behind') drawGeraldEntry(ctx, st, st.gerald);
    runHook(cfg.hooks, 'behind', ctx, st);
    // depth-sorted swimmers + items
    const items = [];
    st.extras.forEach((e) => items.push({ y: e.opts.y, x: e.opts.x, kind: 'extra', entry: e, water: e.opts.kit.inWater, w: 250 * e.opts.scale * SIZE.extra, sc: e.opts.scale }));
    for (const who in st.cast) {
      const o = st.cast[who].opts;
      items.push({ y: o.y, x: o.x, kind: 'cast', who, water: o.kit.inWater, w: 255 * o.scale * (SIZE[who] || 1), sc: o.scale });
    }
    for (const it of cfg.items || []) {
      if (!it || typeof it.draw !== 'function') continue;
      const wo = it.water && typeof it.water === 'object' ? it.water : {};
      items.push({ y: clamp(fin(it.y, 600), -XY_LIM, XY_LIM), x: clamp(fin(it.x, 640), -XY_LIM, XY_LIM), kind: 'item', item: it, water: !!it.water, w: clamp(posv(wo.w, 60, 2), 2, 3000), depth: wo.depth != null ? clamp(posv(wo.depth, 30, 1), 1, 2000) : undefined, sc: 1 });
    }
    if (st.gerald && !(st.gerald.host && st.cast[st.gerald.host]) && st.gerald.layer !== 'behind') items.push({ y: fin(st.gerald.depthY, 10000), x: st.gerald.opts.x, kind: 'gerald' });
    items.sort((a, b) => a.y - b.y || a.x - b.x);
    // view culling: skip swimmers (and their water) whose generous bbox is fully off-screen
    const vw = (DW / 2) / st.cam.zoom + 40, vh = (DH / 2) / st.cam.zoom + 40;
    const visible = (it) => {
      if (it.kind !== 'cast' && it.kind !== 'extra') return true;
      const sc = it.sc || 1, hw = 175 * sc, top = 230 * sc, bot = 140 * sc;
      if (it.kind === 'cast' && st.gerald && st.gerald.host === it.who) return true;   // Gerald rides on it
      return !(it.x + hw < st.cam.x - vw || it.x - hw > st.cam.x + vw || it.y + bot < st.cam.y - vh || it.y - top > st.cam.y + vh);
    };
    st.culled = [];
    for (const it of items) {
      if (!visible(it)) { st.culled.push(it.who || it.kind); continue; }
      if (it.water) ES.waterlineRipple(ctx, it.x, it.y + 1, it.w * 0.78, T + it.x * 0.01, { part: 'back', color: ripCol });
      if (it.kind === 'extra') drawCast(ctx, it.entry.opts);
      else if (it.kind === 'cast') drawCast(ctx, st.cast[it.who].opts);
      else if (it.kind === 'item') { ctx.save(); try { it.item.draw(ctx, st); } finally { ctx.restore(); } }
      else if (it.kind === 'gerald') drawGeraldEntry(ctx, st, st.gerald);
      if (it.water) {
        const sw = { x: it.x, y: it.y, w: it.w, scale: it.sc };
        if (it.depth) sw.depth = it.depth;
        ES.drawWaterFront(ctx, T, { ...envShort, swimmers: [sw], opacity: cfg.waterOpacity });
      }
      if (it.kind === 'cast' && st.gerald && st.gerald.host === it.who && st.gerald.layer !== 'behind') drawGeraldEntry(ctx, st, st.gerald);
    }
    runHook(cfg.hooks, 'afterCast', ctx, st);
    if (cfg.overlay !== false) ES.drawSpringOverlay(ctx, T, { ...envShort, ...(typeof cfg.overlay === 'object' ? cfg.overlay : {}) });
    runHook(cfg.hooks, 'afterWater', ctx, st);
  });
  const fa = autoFoliage(st.cam, cfg.foliage);
  if (fa > 0) {
    const fo = typeof cfg.foliage === 'object' && cfg.foliage ? cfg.foliage : {};
    const b = st.cam.base || st.cam;
    const dx = clamp(-(st.cam.x - fin(b.x, st.cam.x)) * st.cam.zoom * 0.6, -60, 60), dy = clamp(-(st.cam.y - fin(b.y, st.cam.y)) * st.cam.zoom * 0.6, -40, 40);
    const sc = clamp(1 + (st.cam.zoom / Math.max(0.2, fin(b.zoom, st.cam.zoom)) - 1) * 1.5, 0.5, 3);
    ctx.save();
    ctx.translate(640 + dx, 360 + dy); ctx.scale(sc, sc); ctx.translate(-640, -360);
    ES.drawForegroundFoliage(ctx, T, { ...envShort, amount: fa, sides: fo.sides || 'both', top: !!fo.top });
    ctx.restore();
  }
  runHook(cfg.hooks, 'screen', ctx, st);
  return st;
}

// ───────────────────────────────────────────────────────────── office
// The window puff (env.puff) is keyed so the gag plays ON CAMERA: the billow forms across the
// window_puff beat (0 → .55), lingers through the cut-away (.55 → .6), then blows out of the pane
// over the first 70 % of shelley_turns (.62 → .97 = clear sky just before his head gets there).
const PUFF_KEYS = { formed: 0.55, linger: 0.6, blow: 0.62, clear: 0.97, turnFrac: 0.7 };
function officePuffKeys(S, o = {}) {
  if (!S.has('window_puff')) return null;
  const P = { ...PUFF_KEYS, ...o };
  const a = S.cue('window_puff'), ad = Math.max(0.3, S.cueDur('window_puff') || 1.6);
  const b = S.has('shelley_turns') ? S.cue('shelley_turns') : a + ad + 1.2;
  const bd = S.has('shelley_turns') ? Math.max(0.3, S.cueDur('shelley_turns') || 2.4) : 2.4;
  const tc = b + bd * P.turnFrac;
  return [[a, 0], [a + ad, P.formed], [b - 0.001, P.linger], [b, P.blow], [tc, P.clear], [tc + 0.4, 1]];
}
function officePuff(S, o) {
  const keys = Array.isArray(o) ? o : officePuffKeys(S, o || {});
  if (!keys) return 0;
  const t = S.t;
  if (t <= keys[0][0]) return 0;
  for (let i = 1; i < keys.length; i++) {
    if (t < keys[i][0]) {
      const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
      const k = (t - t0) / Math.max(1e-6, t1 - t0);
      return lerp(v0, v1, i === 1 ? ease.outQuad(k) : k);
    }
  }
  return keys[keys.length - 1][1];
}
function drawOfficeStage(ctx, t, S, cfg = {}) {
  const setting = 'therapy_office', kind = 'office';
  const T = S.T;
  const puff = typeof cfg.puff === 'function' ? fin(cfg.puff(S), 0) : typeof cfg.puff === 'number' ? cfg.puff : officePuff(S, cfg.puff);
  const env = finiteOpts({ volcanoSmoke: 0.35, puff, ...(typeof cfg.env === 'function' ? cfg.env(S) : cfg.env || {}) });
  const gcfg = cfg.gerald === undefined ? { on: 'barry' } : cfg.gerald;
  const L = buildLayout(S, { ...cfg, setting, gerald: gcfg });
  const st = stageBase(S, t, setting, kind, L, env);
  st.A = EO.OFFICE;
  st.cfgCast = cfg.cast || {};
  const light = cfg.light === false ? null : cfg.light || lightFor(setting, env);
  for (const who of Object.keys(L.chars)) st.cast[who] = castEntry(S, who, { ...castCfgOf(S, cfg, who), layout: L, env }, cfg, light);
  if (cfg.shelley !== false) {
    const so = sanitizeV(shelleyOpts(S, { ...(cfg.shelley || {}), layout: L }));
    st.shelley = { opts: so, anchors: CRIT.tortoiseAnchors(so) };
  }
  st.gerald = resolveGerald(S, st, gcfg);
  regaze(S, st, L, cfg, light);
  const framings = { ...OFFICE_FRAMINGS, ...(cfg.framings || {}) };
  st.cam = cfg.camera ? userCamera(S, cfg, st, kind) : cameraFor(S, framings, { ...(cfg.cam || {}), layout: L, st, setting });
  U.withCamera(ctx, st.cam, () => {
    EO.drawTherapyOffice(ctx, T, env);
    if (st.gerald && st.gerald.layer === 'behind') drawGeraldEntry(ctx, st, st.gerald);
    runHook(cfg.hooks, 'behind', ctx, st);
    if (st.shelley) CRIT.drawTortoise(ctx, st.shelley.opts);
    for (const who in st.cast) {
      drawCast(ctx, st.cast[who].opts);
      if (st.gerald && st.gerald.host === who && st.gerald.layer !== 'behind') drawGeraldEntry(ctx, st, st.gerald);
    }
    for (const it of (cfg.items || []).slice().sort((a, b) => fin(a.y, 0) - fin(b.y, 0))) if (it && typeof it.draw === 'function') { ctx.save(); try { it.draw(ctx, st); } finally { ctx.restore(); } }
    if (st.gerald && !(st.gerald.host && st.cast[st.gerald.host]) && st.gerald.layer !== 'behind') drawGeraldEntry(ctx, st, st.gerald);
    runHook(cfg.hooks, 'afterCast', ctx, st);
    EO.drawTherapyOfficeFront(ctx, T, env);
    runHook(cfg.hooks, 'afterWater', ctx, st);
  });
  runHook(cfg.hooks, 'screen', ctx, st);
  return st;
}

// ───────────────────────────────────────────────────────────── raft / river
// how far Gerald's weight has bunched the banner (props flagPerch.k) for this frame's gerald cfg
function flagK(S, gcfg) {
  if (!gcfg) return 0;
  const isFlag = (p) => p === 'flag';
  if (gcfg.hop) {
    const hp = gcfg.hop, H = movTiming(S, hp, 0.9);
    const toFlag = hp.from != null ? isFlag(gcfg.on) : isFlag(hp.to);
    const fromFlag = hp.from != null ? isFlag(hp.from) : isFlag(gcfg.on);
    const tl = H.t0 + H.dur - 0.22;              // touch-down of the hop
    if (toFlag) return ease.inOutSine(clamp((S.t - tl + 0.1) / 0.55));
    if (fromFlag) return 1 - ease.inOutSine(clamp((S.t - H.t0 - 0.1) / 0.4));
    return 0;
  }
  if (!isFlag(gcfg.on)) return 0;
  if (gcfg.land) { const Ld = landTiming(S, gcfg.land); return ease.inOutSine(clamp((S.t - Ld.touch + 0.05) / 0.5)); }
  if (gcfg.takeoff) { const Tk = movTiming(S, gcfg.takeoff, 1.5); return 1 - ease.inOutSine(clamp((S.t - Tk.t0 - 0.3) / 0.4)); }
  return 1;
}
function drawRaftStage(ctx, t, S, cfg = {}) {
  const setting = 'river_sunset', kind = 'river';
  const T = S.T;
  const gcfg = cfg.gerald === undefined ? { on: 'mast' } : cfg.gerald;
  const gForLayout = gcfg && (gcfg.on === 'mast' || gcfg.on === 'flag' || gcfg.hop) ? { ...gcfg, on: null } : gcfg;
  const soot = cfg.soot ?? 0.35, juice = cfg.juice ?? 0.4;
  // Gerald on the banner bunches it (props flagPerch) unless the scene drives the flag itself
  const raftCfg = { ...(cfg.raft || {}) };
  const fk = flagK(S, gcfg);
  if (raftCfg.flagPerch === undefined && fk > 0.001) raftCfg.flagPerch = { k: fk };
  if (raftCfg.flagPerch === false) delete raftCfg.flagPerch;
  const L = buildLayout(S, { ...cfg, raft: raftCfg, setting, gerald: gForLayout });
  const ro = L.raft.opts, RA = L.raft.anchors;
  const env = finiteOpts({ ash: 0.35, raftX: ro.x, raftY: ro.y, raftW: Math.round(360 * ro.scale), ...(typeof cfg.env === 'function' ? cfg.env(S) : cfg.env || {}) });
  const st = stageBase(S, t, setting, kind, L, env);
  st.A = EO.RIVER;
  st.raft = L.raft;
  st.cfgCast = cfg.cast || {};
  const light = cfg.light === false ? null : cfg.light || lightFor(setting, env);
  for (const who of Object.keys(L.chars)) {
    const cc = castCfgOf(S, cfg, who);
    const acc = { soot, ...(who === 'barry' ? { helmet: true } : {}), ...(who === 'doreen' ? { juice } : {}), ...(cc.accessories || {}) };
    st.cast[who] = castEntry(S, who, { ...cc, accessories: acc, layout: L, env }, cfg, light);
  }
  st.gerald = resolveGerald(S, st, gcfg);
  regaze(S, st, L, cfg, light);
  const framings = { ...RIVER_FRAMINGS, ...(cfg.framings || {}) };
  st.cam = cfg.camera ? userCamera(S, cfg, st, kind) : cameraFor(S, framings, { ...(cfg.cam || {}), layout: L, st, setting });
  // the river barry_cu's volcano cheat (fixed per shot) unless the scene sets env.volcano
  if (st.cam.base && st.cam.base.envVolcano && env.volcano === undefined) env.volcano = st.cam.base.envVolcano;
  const order = Object.keys(st.cast).sort((a, b) => (a === 'barry') - (b === 'barry'));
  const g = st.gerald;
  const items = (cfg.items || []).filter((it) => it && typeof it.draw === 'function').sort((a, b) => fin(a.y, 0) - fin(b.y, 0));
  // layer sandwich: raft back (mast, banner, rear bundles) → passengers with their ground on the
  // deck's sit line → raft front bundle (hides their bottoms: they sit IN the raft) → Gerald
  // view culling (a passenger fully off-screen is skipped — its reflection is off-screen too)
  const vw = (DW / 2) / st.cam.zoom + 30, vh = (DH / 2) / st.cam.zoom + 30;
  st.culled = order.filter((who) => {
    const o = st.cast[who].opts, sc = o.scale;
    return o.x + 170 * sc < st.cam.x - vw || o.x - 170 * sc > st.cam.x + vw || o.y + 120 * sc < st.cam.y - vh || o.y - 240 * sc > st.cam.y + vh;
  });
  const drawn = order.filter((w) => !st.culled.includes(w));
  const drawRaftAndCast = (c, reflection) => {
    PROPS.drawRaft(c, { ...ro, layer: 'back' });
    runHook(cfg.hooks, 'onRaft', c, st);
    for (const who of drawn) drawCast(c, st.cast[who].opts);
    PROPS.drawRaft(c, { ...ro, layer: 'front' });
    if (g && g.layer !== 'behind') drawGeraldEntry(c, st, g);
    for (const it of items) if (!reflection || it.reflect) { c.save(); try { it.draw(c, st); } finally { c.restore(); } }
  };
  U.withCamera(ctx, st.cam, () => {
    EO.drawRiverSunset(ctx, T, env);
    if (g && g.layer === 'behind') drawGeraldEntry(ctx, st, g);
    runHook(cfg.hooks, 'behind', ctx, st);
    // 'auto' (default): the mirrored raft only where it can be seen (zoom < 2.2); drawSource makes
    // the reflection pass composite the raft + cast too, so they are rendered ONCE per frame
    const refl = cfg.reflection === undefined || cfg.reflection === 'auto' ? st.cam.zoom < 2.2 : !!cfg.reflection;
    if (refl) {
      const reflItems = items.some((it) => it.reflect);
      EO.drawRiverReflection(ctx, T, { y: RA.waterline + 4, x0: ro.x - 260 * ro.scale - 60, x1: ro.x + 300 * ro.scale + 60, depth: 150, drawSource: !reflItems }, (c) => drawRaftAndCast(c, true));
      if (reflItems) drawRaftAndCast(ctx, false);
      else for (const it of items) if (!it.reflect) { ctx.save(); try { it.draw(ctx, st); } finally { ctx.restore(); } }
    } else drawRaftAndCast(ctx, false);
    runHook(cfg.hooks, 'afterCast', ctx, st);
    EO.drawRiverFront(ctx, T, { ...env, grade: cfg.grade ?? 0 });
    runHook(cfg.hooks, 'afterWater', ctx, st);
  });
  runHook(cfg.hooks, 'screen', ctx, st);
  return st;
}

// ═════════════════════════════════════════════════════════════════════════════ spring props
const RULES_SIGN = { lines: ['SPRING RULES', '1. Introduce yourself', '2. Say goodbye', '3. No vultures on heads'], scale: 0.42, seed: 9 };
const EXIT_SIGNS = [
  { key: 'exit', text: 'EXIT', style: 'arrow', arrowDir: 'left', scale: 0.62, seed: 1, spot: 0 },
  { key: 'really', lines: ['NO, REALLY.', 'THIS WAY.'], style: 'arrow', arrowDir: 'left', scale: 0.5, seed: 3, spot: 1 },
  { key: 'sunny', text: 'YES, YOU, SUNNY', style: 'arrow', arrowDir: 'left', scale: 0.42, size: 20, seed: 5, spot: 2 },
];
const MOORED_RAFT = { scale: 0.5, bob: 0.6, wind: 0.5 };
function popSign(ctx, o, k) {
  if (!(k > 0)) return null;
  const s = (o.scale ?? 1) * Math.max(0.001, k);
  const so = { ...o, scale: s };
  PROPS.drawSign(ctx, so);
  return PROPS.signAnchors(so);
}
function rulesSignOpts(o = {}) {
  const A = o.setting === 'new_spring' ? NSP : SP;
  const so = { ...RULES_SIGN, x: A.rulesSignSpot.x, y: A.rulesSignSpot.y, ...o };
  delete so.setting; delete so.pop;
  return so;
}
// anchors of the standard rules sign (same options as drawRulesSign) without drawing it:
// .top is Gerald's perch on the top edge (the three rules stay readable below his feet)
function rulesSignAnchors(o = {}) { return PROPS.signAnchors(rulesSignOpts(o)); }
function drawRulesSign(ctx, t, o = {}) {
  const so = { t, ...rulesSignOpts(o) };
  const k = o.pop != null ? (o.pop >= 1 ? 1 : popIn(o.pop, 0, 1)) : 1;
  return popSign(ctx, so, k);
}
function drawExitSigns(ctx, t, o = {}) {
  const out = {};
  const show = o.show || {};
  for (const e of EXIT_SIGNS) {
    if (o.only && !o.only.includes(e.key)) continue;
    const spot = SP.exitSignSpots[e.spot];
    const kRaw = show[e.key] != null ? show[e.key] : 1;
    const k = kRaw >= 1 ? 1 : popIn(kRaw, 0, 1);
    const so = { ...e, x: spot.x, y: spot.y, t, burn: (o.burn && o.burn[e.key]) || (typeof o.burn === 'number' ? o.burn : 0), rot: (o.rot && o.rot[e.key]) || 0 };
    delete so.key; delete so.spot;
    out[e.key] = popSign(ctx, so, k);
  }
  return out;
}
function drawMooredRaft(ctx, t, o = {}) {
  const ro = { x: SP.raftMoor.x, y: SP.raftMoor.y, t, ...MOORED_RAFT, ...o };
  PROPS.drawRaft(ctx, ro);
  return PROPS.raftAnchors(ro);
}
// anchors of the moored raft (same options) without drawing: .mastTop / .deck / .seats for hops
function mooredRaftAnchors(t, o = {}) { return PROPS.raftAnchors({ x: SP.raftMoor.x, y: SP.raftMoor.y, t, ...MOORED_RAFT, ...o }); }

// ═════════════════════════════════════════════════════════════════════════════ audit
// Every framing of a stage at scene time t (default layout + cfg): where each cast eye lands on
// screen and whether a face sits in the subtitle strip / is cropped by the bottom edge.
// → [{name, cam, issues: ['barry eye in subtitles (y 640)', ...]}]
function auditFramings(S, cfg = {}, names) {
  const setting = cfg.setting || S.scene.setting;
  const kind = kindOf(setting);
  const framings = kind === 'office' ? OFFICE_FRAMINGS : kind === 'river' ? RIVER_FRAMINGS : SPRING_FRAMINGS;
  const all = { ...framings, ...(cfg.framings || {}) };
  const out = [];
  for (const name of names || Object.keys(all)) {
    let st = null;
    const stub = { ...cfg, cam: { ...(cfg.cam || {}), name }, hooks: {}, items: [] };
    const fn = kind === 'office' ? drawOfficeStage : kind === 'river' ? drawRaftStage : drawSpringStage;
    try { st = fn(auditCtx(), S.t, S, stub); } catch (e) { out.push({ name, issues: ['ERR ' + e.message] }); continue; }
    const issues = [];
    for (const who in st.cast) {
      const a = st.cast[who].anchors;
      const e = toScreen(st.cam, a.eye), top = toScreen(st.cam, a.headTop);
      const inX = e.x > 30 && e.x < DW - 30;
      if (!inX) continue;
      if (e.y > SUB_Y && e.y < DH + 10) issues.push(`${who} eye in subtitles (y ${e.y.toFixed(0)})`);
      else if (top.y < DH && e.y >= DH + 10 && top.y > SUB_Y - 40) issues.push(`${who} head-top cropped at the bottom (y ${top.y.toFixed(0)})`);
    }
    out.push({ name, cam: { x: +st.cam.x.toFixed(1), y: +st.cam.y.toFixed(1), zoom: +st.cam.zoom.toFixed(2) }, issues });
  }
  return out;
}
let _auditCv = null;
function auditCtx() {
  if (!_auditCv) _auditCv = require('@napi-rs/canvas').createCanvas(32, 18);
  const c = _auditCv.getContext('2d');
  c.setTransform(32 / DW, 0, 0, 18 / DH, 0, 0);
  return c;
}

// ═════════════════════════════════════════════════════════════════════════════ lab
let _labTl = null;
function labS(sceneId, tLocal) {
  if (!_labTl) { const { Timeline } = require('./timeline'); _labTl = new Timeline(); }
  const sc = _labTl.byScene[sceneId];
  return _labTl.sceneTime(sceneId, sc.start + clamp(tLocal, 0, sc.end - sc.start - 0.01));
}
function tile(ctx, i, cols, rows, label, fn) {
  const w = DW / cols, h = DH / rows, x = (i % cols) * w, y = Math.floor(i / cols) * h;
  const sc = Math.min(1 / cols, 1 / rows), ox = x + (w - DW * sc) / 2, oy = y + (h - DH * sc) / 2;
  ctx.save();
  ctx.fillStyle = '#111'; ctx.fillRect(x, y, w, h);
  ctx.beginPath(); ctx.rect(ox, oy, DW * sc, DH * sc); ctx.clip();
  ctx.translate(ox, oy); ctx.scale(sc, sc);
  try { fn(); } finally { ctx.restore(); }
  ctx.save();
  ctx.font = '700 14px Nunito';
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y, ctx.measureText(label).width + 12, 20);
  ctx.fillStyle = '#fff'; ctx.fillText(label, x + 6, y + 15);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = 'rgba(255,60,60,0.12)'; ctx.fillRect(x, y + h * (SUB_Y / DH), w, h * (1 - SUB_Y / DH));
  ctx.restore();
}
// a cross at world point p, drawn in screen space (hooks.screen)
function crosshair(ctx, st, p, col) {
  const s = toScreen(st.cam, p);
  ctx.save();
  ctx.strokeStyle = col; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(s.x - 44, s.y); ctx.lineTo(s.x + 44, s.y); ctx.moveTo(s.x, s.y - 44); ctx.lineTo(s.x, s.y + 44); ctx.stroke();
  ctx.restore();
}
const lab = {
  framings(ctx, t) {
    const S = labS('s03_spring', 30.5 + t);
    const names = ['establishing', 'trio', 'barry_cu', 'sunny_cu', 'doreen_cu', 'gerald_cu', 'volcano', 'fish', 'thermometer', 'signs', 'rules', 'raft', 'helmet', 'escape', 'sign', 'extras'];
    names.forEach((n, i) => tile(ctx, i, 4, 4, n, () => drawSpringStage(ctx, S.t, S, {
      gerald: { on: 'barry' }, cam: { name: n }, extras: n === 'extras' ? 'open' : false,
      cast: n === 'extras' ? { sunny: false, doreen: false } : undefined,
      hooks: { behind: (c, st) => { drawRulesSign(c, st.T); drawExitSigns(c, st.T); drawMooredRaft(c, st.T); } },
    })));
  },
  office(ctx, t) {
    const S = labS('s05_therapy', 6 + t);
    ['office_wide', 'barry_couch', 'shelley_cu', 'window'].forEach((n, i) => tile(ctx, i, 2, 2, n, () => drawOfficeStage(ctx, S.t, S, { cam: { name: n } })));
  },
  raft(ctx, t) {
    const S = labS('s08_aftermath', 8 + t);
    ['raft_wide', 'barry_cu', 'gerald_flag', 'fish'].forEach((n, i) => tile(ctx, i, 2, 2, n, () => drawRaftStage(ctx, S.t, S, { cam: { name: n } })));
  },
  // Barry's squash-and-stretch turn (s03 ~14.94) and a take, frame by frame, with Gerald riding
  // the drawn head: green cross = the host's DRAWN head top, magenta = Gerald's feet
  turn(ctx, t) {
    const cases = [];
    for (let i = 0; i < 6; i++) cases.push({ tt: 14.92 + i * (1 / 24) + t, label: 'turn' });
    for (let i = 0; i < 6; i++) cases.push({ tt: 16.0 + i * 0.05 + t, label: 'take', take: 16.05 });
    cases.forEach((c, i) => {
      const S = labS('s03_spring', c.tt);
      tile(ctx, i, 4, 3, `${c.label} t=${S.t.toFixed(3)}`, () => {
        const cast = c.take ? { barry: { squash: take(S.t, c.take, { amount: 1 }) } } : undefined;
        drawSpringStage(ctx, S.t, S, {
          gerald: { on: 'barry' }, cam: { name: 'barry_cu' }, cast,
          hooks: { screen: (cx, st) => {
            if (!st.gerald) return;
            crosshair(cx, st, st.cast.barry.anchors.headTop, '#3CFF6A');
            crosshair(cx, st, { x: st.gerald.opts.x, y: st.gerald.opts.y }, '#FF3BDF');
          } },
        });
      });
    });
  },
  // Gerald's choreography through the kit: s03 landing on Barry, a hop sign → head, take-off
  gerald(ctx, t) {
    const frames = [];
    const S0 = labS('s03_spring', 0);
    const ld = landTiming(S0, { t0: S0.cue('vulture_lands'), dur: S0.cueDur('vulture_lands') });
    for (let i = 0; i < 8; i++) frames.push({ id: 's03_spring', tt: ld.t0 + (i / 7) * (ld.end - ld.t0 + 0.3) + t, cfg: (S) => ({ gerald: { on: 'barry', land: { t0: S.cue('vulture_lands'), dur: S.cueDur('vulture_lands'), from: { x: 1380, y: 40 } } }, cam: { name: 'trio' } }) });
    for (let i = 0; i < 4; i++) frames.push({ id: 's06_montage', tt: 7.0 + i * 0.25 + t, cfg: () => ({ gerald: { on: 'barry', hop: { t0: 7.1, dur: 0.9, from: 'rules' } }, cam: { name: 'rules' }, hooks: { behind: (c, st) => drawRulesSign(c, st.T) } }) });
    for (let i = 0; i < 4; i++) frames.push({ id: 's07_eruption', tt: 15.3 + i * 0.3 + t, cfg: () => ({ gerald: { on: 'rules', takeoff: { t0: 15.4, dur: 1.4, to: { x: 1500, y: -200 } } }, cam: { name: 'gerald_cu' }, hooks: { behind: (c, st) => drawRulesSign(c, st.T) } }) });
    frames.forEach((f, i) => {
      const S = labS(f.id, f.tt);
      tile(ctx, i, 4, 4, `${f.id.slice(0, 3)} t=${S.t.toFixed(2)}`, () => drawSpringStage(ctx, S.t, S, f.cfg(S)));
    });
  },
  // framing audit (text): every spring / river / office framing at a representative time
  audit(ctx) {
    ctx.fillStyle = '#1d232b'; ctx.fillRect(0, 0, DW, DH);
    ctx.font = '600 13px Nunito';
    let y = 22;
    const runs = [['s03_spring', 20], ['s09_epilogue', 4], ['s06_montage', 6], ['s08_aftermath', 20], ['s05_therapy', 12]];
    for (const [id, tt] of runs) {
      const S = labS(id, tt);
      for (const r of auditFramings(S)) {
        ctx.fillStyle = r.issues.length ? '#FF8A8A' : '#9FE3A8';
        ctx.fillText(`${id} ${r.name.padEnd(16)} ${r.cam ? JSON.stringify(r.cam) : ''} ${r.issues.join('; ') || 'ok'}`, 12 + (y > 700 ? 640 : 0), y > 700 ? y - 690 : y);
        y += 15;
      }
    }
  },
  envelopes(ctx) {
    ctx.fillStyle = '#1d232b'; ctx.fillRect(0, 0, DW, DH);
    const plots = [
      ['take sy', (u) => take(u, 0.3).sy, 0.7, 1.3],
      ['take sx', (u) => take(u, 0.3).sx, 0.7, 1.3],
      ['popIn', (u) => popIn(u, 0.2, 0.3), -0.1, 1.3],
      ['popOut', (u) => popOut(u, 0.2, 0.25), -0.1, 1.3],
      ['wobble', (u) => wobble(u, 0.1), -0.15, 0.15],
      ['shakeOffset x (amp 10, 1.6 s)', (u) => shakeOffset(u, 10).x, -12, 12],
    ];
    plots.forEach(([name, fn, lo, hi], i) => {
      const x0 = 40 + (i % 3) * 410, y0 = 40 + Math.floor(i / 3) * 330, w = 380, h = 280;
      ctx.strokeStyle = '#4a5560'; ctx.strokeRect(x0, y0, w, h);
      ctx.fillStyle = '#fff'; ctx.font = '700 16px Nunito'; ctx.fillText(name, x0 + 8, y0 + 20);
      ctx.strokeStyle = '#9FE3A8'; ctx.lineWidth = 2.5; ctx.beginPath();
      for (let k = 0; k <= 200; k++) {
        const u = (k / 200) * 1.6;
        const v = fn(u);
        const px = x0 + (u / 1.6) * w, py = y0 + h - ((v - lo) / (hi - lo)) * h;
        if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
      if (i === 5) for (let k = 0; k <= 38; k++) { const u = k / 24, v = fn(u); ctx.fillStyle = '#FFD27A'; ctx.fillRect(x0 + (u / 1.6) * w - 2, y0 + h - ((v - lo) / (hi - lo)) * h - 2, 4, 4); }
    });
  },
};

module.exports = {
  // stages
  drawSpringStage, drawOfficeStage, drawRaftStage,
  // cast
  castOpts, drawCast, castAnchors, squashPoint, geraldOpts, shelleyOpts, geraldFlight, turnEnv, turnToCamera,
  moodAt, gazeAt, facingAt, buildLayout, lightFor, landTiming,
  // camera
  cameraFor, faceFrame, trioFrame, toScreen, toWorld, clampCam, shakeOffset, auditFramings,
  SPRING_FRAMINGS, OFFICE_FRAMINGS, RIVER_FRAMINGS, WORLD, WORLD_CLOSE,
  // gags & timing
  take, popIn, popOut, wobble, withSquash, shakeEnv, sfxShake, rumbleLevel, sfxTimes, SHAKE_SFX,
  beat, ramp, bump, fadeWindow, stepKeys, keyTime, shot, lineWith, wordTime, linesOf, lastLineBefore, pathAt, gaitPhase,
  officePuff, officePuffKeys, PUFF_KEYS,
  // spring props
  drawRulesSign, rulesSignAnchors, drawExitSigns, drawMooredRaft, mooredRaftAnchors, RULES_SIGN, EXIT_SIGNS, MOORED_RAFT, EXTRAS,
  // constants
  REST_MOOD, SCENE_DEFAULTS, SUB_Y, RAFT_SEATS,
  lab,
};
