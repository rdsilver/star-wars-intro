// CHILL CAPYBARA — capybara character rig (Barry, Sunny, Doreen, extras). See DESIGN.md §6.
//
// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────
// drawCapybara(ctx, o)        draws one capybara (side profile, faces RIGHT unless flip)
// capyAnchors(o) -> anchors   attachment points in the CALLER's coordinate space
// capyMood(t, keys, fade=.2)  → value for o.mood that crossfades between mood changes:
//                             keys = [[time, mood], ...]; recommended fade 0.15–0.25 s.
//                             e.g. mood: capyMood(t, [[0,'worried'], [4.1,'panic'], [6.3,'worried']])
// drawCapyHelmet(ctx, {x, y, scale=1, rot=0, flip=false, soot=0, strap=false, tint, rim})
//                             the rig's helmet art. Origin = middle of the bottom rim. Pass
//                             capyAnchors(o).helmet (x, y, angle→rot, scale, flip) to land exactly
//                             where accessories.helmet draws it. strap:true = the open chin strap
//                             dangling, identical to accessories.helmet = {strap: 0} → swap to the
//                             worn helmet on arrival with no pop, then animate strap 0 → 1 (cinch).
// drawCapyOrange(ctx, {x, y, r=16, rot=0, t, seed, squash=0, flip, tint, rim})
//                             the rig's head orange. (x,y) = centre; anchors.orange gives x, y, r.
//                             squash ≥ .5 = the 'squashed' orange (props.drawOrange squash 1,
//                             same base point).
// drawCapyThermometer(ctx, {x, y, scale=1, rot=0, level=.55, broken=0, reading, length=62, tint})
//                             the bare glass art (bulb at (x,y), tube UP at rot 0) that
//                             props.drawThermometer is built on. For a loose thermometer or an
//                             INSERT (s07 thermo_pops) use props.drawThermometer — the in-paw
//                             thermometer is drawn with it too, so they always match.
// CAPY                        { LENGTH, HEIGHT, MOODS: [...], POSES: [...], STRIDE: {walk, run} }
// lab                         asset-lab sheets (node src/lab.js capybara <sheet> out.png
//                             [--size 1920x1080] [--frames 8 --dt .1]):
//                             cast, moods, moods_others, poses, gaits, talk, accessories, anchors,
//                             scales_flip, blend, closed, gerald, hold, closeup, lighting,
//                             turn (headTurn 0→1 in-betweens), eyes (eyes .4→0 at 3×),
//                             small / small_others (every mood at trio/wide size — render at
//                             --size 1920x1080), helmet (strap / lift / swap), look (gaze under
//                             heavy lids), edge (bad inputs), props_match (rig vs props.js art)
//
// o = {
//   x, y            origin = centre of the body at the waterline (swim) / centre of mass.
//                   Standing poses put the ground at ≈ y + 58*scale (see anchors.ground); the
//                   lowest drawn pixel (feet / haunch / chin) is within 1 unit of anchors.ground.
//   scale = 1       scale 1 → a medium capybara ≈ 230 units long, ≈ 150 tall standing.
//                   Per character size: Barry 0.94 (scrawny body, big head), Sunny 1.06 (big,
//                   round), Doreen 0.97, extras 0.84–1.06 (seeded).
//   flip = false    true → faces LEFT (mirror). Anchors mirror too.
//   rot = 0         whole-body rotation in RADIANS (caller space).
//   who             'barry' | 'sunny' | 'doreen' | 'extra'  (palette, build, default accessories)
//   seed            extras: varies colour / size / build / default mood + head item.
//   color           optional base fur colour override (hex).
//   t               global time (s) → idle motion: breathing, blinks, ear twitch, swim bob, sway.
//   talk 0..1       jaw open (lip-sync envelope); adds a small head bob.
//   mood            'neutral'|'worried'|'panic'|'chill'|'happy'|'smug'|'deadpan'|'shock'|'sad'|'sleepy'
//                   OR a weight map {worried: .6, panic: .4} — every face/head parameter is
//                   blended (lids, brows, mouth, tilt, sweat, glasses askew…), so moods morph
//                   instead of popping. Use capyMood() for line-to-line crossfades.
//                   default: barry neutral, sunny chill, doreen happy, extras sleepy/chill.
//                   happy = bright open eyes whose lower lid is a ◠ smile arc with the cheek
//                   bunched under it (Sunny: closed ︵ eyes), round raised brows, smile;
//                   smug = heavy lids, one brow up, sly smile; deadpan = flat lids, flat mouth.
//   moodFrom, moodK alternative crossfade: blend moodFrom → mood by moodK 0..1.
//   moodTilt = true false → moods add no head tilt (ease o.headTilt yourself).
//   look {x,y}      pupil direction −1..1 (x=+1 → toward the snout, y=+1 → down). The upper lid
//                   follows vertical gaze (lifts looking up, drops a little looking down) and
//                   the pupil rolls right to the lid edge (≈ half visible): y:−1 under a heavy
//                   lid is a clear eye-roll up at a vulture on your head.
//   eyes 0..1       override the mood's upper-lid openness (1 = wide open, 0 = shut). Closing is
//                   continuous: the open part is always one smooth lens-shaped slit; a narrow
//                   slit becomes a dark band (the iris spreads to fill it — a squint), then a
//                   lash line (◡ relaxed; ︵ for happy) — tween it for "eyes slowly open/close".
//   blink = true    deterministic idle blinks (per-character rhythm); false disables.
//   headTilt        DEGREES, + = snout UP (looks up), − = snout down.
//   headTurn 0..1   0 = profile … 1 = 3/4 head turned toward the camera (both eyes / both lenses,
//                   the blunt muzzle block with the nose pad and mouth on its front). Continuous:
//                   0–.47 profile in-betweens (far ear comes round over the crown, the front of
//                   the nose pad + far nostril appear, pupils drift to camera), .47–.53 a quick
//                   dissolve between the drawings (≈ one smear frame in a .5 s turn), .53–1 the
//                   3/4 head settling (far eye slides out from behind the bridge). Tween it.
//                   Pupils default to the camera when turned.
//   pose            'swim' (default) | 'stand' | 'walk' | 'run' | 'sit' | 'lie'
//                   swim: no legs, the full upper body is drawn (the env's translucent front
//                         water covers it) unless `waterline` clips it.
//                   walk: lateral-sequence walk; run: stretched gallop (body stretches on the
//                         extended flight frame ≈ phase 0, gathers ≈ phase .5).
//                   sit:  on the haunches, chest up, short front legs, hind paws tucked.
//                   lie:  lying on the belly (couch), chin resting on the front paws.
//   walkPhase       leg cycle in CYCLES (1.0 = one full stride) for walk / run. Feet are planted
//                   (linear stance) when the body advances anchors.stride per cycle:
//                   x = x0 + dir * walkPhase * anchors.stride  (walk ≈ 45 × s, run ≈ 124 × s,
//                   s = scale × character size × 0.9 — anchors.stride has the exact value).
//   waterline       LOCAL y (unscaled units relative to the origin): nothing is drawn below it.
//                   The clip line is horizontal in caller space (y + waterline*scale).
//   pawUp 0..1      raise the near front paw (gesture / holding something). Defaults to 1
//                   when the thermometer is held in the paw. swim: the arm comes up out of the
//                   water under the chin (fading in from the waterline); stand/sit: it grows out
//                   of the chest (opaque, no seam); lie: the chin-rest paw lifts (elbow stays on
//                   the couch) and is drawn under the jaw while it is below the mouth.
//   pawAt {x,y}     LOCAL target for the raised paw (default: just in front of / below the chin;
//                   reach ≈ 64 units swim, ≈ 80 stand/sit).
//   hold(ctx, paw)  optional callback: draw a prop in the raised paw. Called in CALLER space
//                   after the arm, before a little "thumb" overlay is drawn over the prop (so it
//                   reads as gripped). paw = {x, y, angle (forearm direction, radians), scale, flip}.
//   tremble         multiplier for the mood's trembling (panic / shock), default 1.
//   tint {color, amount=.3}  scene light: mixed into the fur palette AND the accessories (orange,
//                   helmet, strap, flower, necklace, bag, thermometer, juice, sweat, teeth, eye
//                   whites, lens glint) so nothing glows like a sticker at sunset / in lava light.
//   rim             colour of the rim-light crescent along the top edges (default warm sky);
//                   also used for the rim on the orange and the helmet.
//   lod 0..1        small-size detail level (auto: ramps in below scale × size ≈ .95, full at
//                   ≈ .5). Lighter lens + thinner rim, heavy lids opened a touch (a white sliver
//                   stays), brows lifted off the frames and tilted more, mouth curve and length
//                   exaggerated, bigger pupils — so moods still read at trio / wide sizes.
//   Line weight scales gently with size (thinner in close-ups, bolder when small).
//   Numbers are sanitised (NaN / Infinity → defaults, accessory amounts clamped to 0..1) and a
//   draw that throws restores the caller's ctx state exactly before rethrowing.
//   accessories {   merged over the character's defaults (pass false to remove a default)
//     glasses: bool        thick black round Woody-Allen frames (Barry: always on by default).
//                          Brows sit on the top of the frames. 'shock' knocks them askew: tipped
//                          ~18°, slid down the snout, temple arm off the ear, the popped eye
//                          bulging over the top of the rim.
//     orange: bool|'squashed'   orange on the head; 'squashed' = props.drawOrange's squashed
//                          orange (matches drawJuiceSplat / a loose squashed orange) + juice drips
//     helmet: bool | {strap: 0..1 = 1, lift: 0..1 = 0}
//                          tiny red bike helmet; an orange stacks on top. strap: 0 = chin strap
//                          dangling open, 1 = cinched V (one leg in front of / one behind the ear,
//                          buckle low on the cheek, under the chin, riding the jaw when talking).
//                          lift: raised off the head, tipped back (putting it on / taking it off;
//                          the tuft springs back up). Brows tuck under its rim; soot smudges it.
//     flower: bool         pink hibiscus behind the ear (Doreen default)
//     necklace: bool       puka-shell necklace (Sunny default)
//     backpack: bool       Barry's go-bag — props.drawBackpack's bag (teal, first-aid patch,
//                          bedroll) standing on the back, chest + girth straps around the body;
//                          bounces / lags in walk and run
//     bird: bool           tiny songbird napping on the head (extras)
//     soot 0..1            sooty smudges + singed tufts (+ smoke wisps above .5)
//     juice 0..1           orange-juice drips running down from the crown
//     sweat 0..1           sweat drops (animated; panic adds flying drops). Moods add their
//                          own sweat (worried/panic/shock); sweat: 0 suppresses it.
//     fog 0..1             fogged-up lenses
//     thermometer: false | true | 'mouth' | 'paw' |
//                  {at:'mouth'|'paw', level:0..1, broken:0..1, angle (rad, tilt from the
//                   default), reading:'39.4', tagSize (paw, default 17)}
//                          true = 'mouth' (clenched like a cigar). level = red column height.
//                          paw: drawn with props.drawThermometer (reading card with a pointer to
//                          the column, printed scale when big, broken = the pop); mouth: the same
//                          glass + the same reading card.
//   }
// }
//
// capyAnchors(o) — same options, returns points in caller space that include x/y/scale/
// flip/rot, pose, headTilt, headTurn, mood tilt, talk bob and breathing/idle motion at time t:
//   headTop  {x,y,angle}  perch point on the skull (top of the helmet when worn) — Gerald's
//                          feet go here (scale ≈ .75 × capy scale, rot = angle). It sits over the
//                          back of the skull / the tuft, behind the brows, so a perched vulture
//                          never hides the face. angle = rotation for an object resting on it.
//   stackTop {x,y,angle}  top of whatever sits on the head (orange / bird), else = headTop.
//   helmet {x,y,angle,scale,flip}  where accessories.helmet draws (→ drawCapyHelmet).
//   orange {x,y,r,angle,flip,squashed}  where accessories.orange draws (→ drawCapyOrange).
//   mouth {x,y}  front of the mouth between the lips (follows the jaw).
//   eye {x,y}    eye centre.          snout {x,y}  front of the nose pad.
//   ear {x,y}    ear.                 chin {x,y}   underside of the chin.
//   back {x,y}   middle of the back, on the fur surface (seat a passenger here).
//   rump {x,y}   top of the rump.     neck {x,y}   neck pivot.
//   paw {x,y,angle}  near front paw (the raised paw when pawUp > 0); angle = forearm direction.
//   ground {x,y} ground contact under the body (stand/walk/run/sit/lie; swim: belly bottom).
//   waterline {y}  caller-space y of the waterline (o.waterline, or local 0).
//   stride       caller-space distance per walk / run cycle (planted feet).
//   scale, flip, facing (+1 right / −1 left), headAngle (radians, caller space), mood (dominant)
//   (head anchors follow the dominant drawing: profile below headTurn .5, 3/4 from .5)
//
// Changes (backward compatible unless noted):
//   v2: Barry smaller/scrawnier (size .94, bigger head), eye lower/forward with smaller lenses;
//       headTop moved back over the tuft; mood may be a weight map; paw.angle; anchors helmet /
//       orange / stride; exports capyMood / drawCapy*.
//   v3: eyes rebuilt (single lens-shaped slit, dark band / squint iris when narrow, no ghost
//       socket ring, lashes hang from the lash line); happy redesigned; lids follow look.y;
//       headTurn is continuous (in-betweens + dissolve) and the 3/4 head has a muzzle block
//       (F34 anchor points moved: snout/mouth/chin further forward); raised arm opaque out of
//       the chest in stand/sit/lie; glasses bridge is a short stub; shock tips the frames; tuft
//       grows out of the fur; helmet {strap, lift} + V chin strap (drawCapyHelmet strap:true now
//       draws the same dangling strap); worn backpack = the props go-bag with straps; paw
//       thermometer / squashed orange delegate to props.js; tint/rim reach accessories (+ tint
//       options on drawCapy*); lod starts at a larger size; inputs sanitised.
'use strict';

const U = require('./util');
const { TAU, clamp, lerp, mix, shade, rgba, ellipse, circle, blob, curve, hash1, noise1, smoothstep } = U;

const K = 0.9;               // internal design scale → scale 1 ≈ 232 units long
const D2R = Math.PI / 180;
const GROUND = 64;           // local y of the ground in standing poses (pre-K units)
// line-weight factor for the call in progress: outlines thin out in close-ups and stay
// readable when small (set at the start of drawCapybara, reset at the end)
let LWK = 1;
// save/restore with a depth counter, so a draw call that throws can unwind exactly the states it
// pushed (drawCapybara / drawCapy* restore the caller's ctx even on an exception)
let DEPTH = 0;
const SV = (ctx) => { DEPTH++; ctx.save(); };
const RS = (ctx) => { DEPTH--; ctx.restore(); };
function guarded(ctx, fn) {
  const d0 = DEPTH, lw0 = LWK, t0 = TINT, r0 = RIMC;
  try { return fn(); } catch (e) {
    while (DEPTH > d0) RS(ctx);
    throw e;
  } finally { LWK = lw0; TINT = t0; RIMC = r0; }
}
// scene lighting for accessories / eyes / teeth (set per call from o.tint / o.rim): tc(hex) mixes
// a colour toward the tint (0.6 × amount, like the fur), tca(hex, a) = rgba of it.
let TINT = null, RIMC = null;
const _tcc = new Map();
function tc(hex) {
  if (!TINT) return hex;
  const key = hex + TINT.key;
  let v = _tcc.get(key);
  if (v === undefined) {
    v = mix(hex, TINT.color, TINT.k);
    if (_tcc.size > 3000) _tcc.clear();
    _tcc.set(key, v);
  }
  return v;
}
const tca = (hex, a) => rgba(tc(hex), a);
function setLight(o) {
  const tn = o && o.tint && o.tint.color ? o.tint : null;
  const amt = tn ? clamp(tn.amount == null ? 0.3 : +tn.amount || 0) : 0;
  TINT = amt > 0.001 ? { color: tn.color, k: 0.6 * amt, key: '|' + tn.color + '|' + amt } : null;
  RIMC = o && o.rim ? o.rim : null;
}
const fin = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

// ─────────────────────────────────────────────────────────────── matrices
const mT = (x, y) => [1, 0, 0, 1, x, y];
const mR = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; };
const mS = (sx, sy = sx) => [sx, 0, 0, sy, 0, 0];
function mMul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}
const mChain = (...ms) => ms.reduce(mMul);
const mAp = (m, x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
const mAbout = (px, py, m) => mChain(mT(px, py), m, mT(-px, -py));
const apply = (ctx, m) => ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);

// ─────────────────────────────────────────────────────────────── characters
// eye: eye centre (head space), lensR: glasses lens radius, dome: extra skull height (Barry's
// high Woody-Allen forehead gives his brows room above the frames), neck: neck thickness.
const CHARS = {
  barry: {
    base: '#9A6A45', dark: '#734A33', belly: '#B88A62', topTint: '#F4D6B4', lowTint: '#3B3A58',
    build: { len: 0.86, h: 0.82 }, head: 1.12, size: 0.94, neck: 0.78, legW: 0.9,
    eye: [36, -22], lensR: 18, dome: 5, eyeSize: 0.93, browTh: 1.3,
    seed: 3.7, breath: 2.6, blinkEvery: 2.6, blinkDur: 0.13,
    pupil: 3.4, iris: false, lids: 0, lashes: false, blush: 0, tuft: true,
    acc: { glasses: true }, mood: 'neutral',
    moodMod: {
      neutral: { browTilt: 8, browY: 1, mouth: -0.14, lidSlope: 4 },
      chill: { browTilt: 3, pupil: 1.3, lid: 0.5 }, deadpan: { browTilt: 1, pupil: 1.3, lid: 0.47 },
      happy: { browTilt: 6 }, smug: { pupil: 1.2, lid: 0.42 }, sleepy: { pupil: 1.3, lid: 0.86 }, sad: { pupil: 1.2 },
    },
  },
  sunny: {
    base: '#B8834F', dark: '#8E6036', belly: '#D9B184', topTint: '#FFD88A', lowTint: '#5A3A40',
    build: { len: 1.1, h: 1.17 }, head: 1.07, size: 1.06, neck: 1.08, legW: 1.22,
    seed: 8.1, breath: 4.4, blinkEvery: 4.8, blinkDur: 0.6,
    pupil: 7.6, iris: true, lids: 0.5, lashes: false, blush: 0.25, tuft: false,
    acc: { necklace: true, orange: true }, mood: 'chill',
    moodMod: {
      neutral: { lid: 0.5, mouth: 0.6, low: 0.12, bulge: 3, browY: 3, browTilt: 1, arch: 0.8, sway: 0.5 },
      chill: { lid: 0.68, low: 0.1, bulge: 4, browY: 4, browTilt: -1, arch: 0.95, mouth: 1, blush: 0.45, sway: 1 },
      happy: { lid: 0.94, low: 0.3, lowArch: 1, cheek: 0.8, browY: 7, arch: 1 }, smug: { lid: 0.48, bulge: 2, low: 0.16 },
      deadpan: { lid: 0.52, bulge: -1, low: 0.14 }, sleepy: { lid: 0.84 }, worried: { lid: 0.16 }, sad: { lid: 0.48 },
    },
  },
  doreen: {
    base: '#A86A4C', dark: '#844C33', belly: '#CFA07E', topTint: '#FFD6B8', lowTint: '#5A3048',
    build: { len: 1.0, h: 1.02 }, head: 0.99, size: 0.97, neck: 0.96,
    seed: 5.3, breath: 3.5, blinkEvery: 3.4, blinkDur: 0.17,
    pupil: 6.4, iris: true, lids: 0.1, lashes: true, blush: 0.6, tuft: false,
    acc: { flower: true, orange: true }, mood: 'happy',
    moodMod: { neutral: { mouth: 0.55, low: 0.16, lid: 0.16 }, chill: { mouth: 0.85, low: 0.14, bulge: 2.5 } },
  },
  extra: {
    base: '#946446', dark: null, belly: null,
    build: { len: 1, h: 1 }, head: 1, size: 0.95, neck: 1,
    seed: 1, breath: 4.0, blinkEvery: 5.0, blinkDur: 0.5,
    pupil: 6, iris: true, lids: 0.55, lashes: false, blush: 0.1, tuft: false,
    acc: {}, mood: 'sleepy', moodMod: {},
  },
};
const EXTRA_FUR = ['#8E6243', '#A0714A', '#93684B', '#B07A4E', '#856048', '#A5794F', '#7F5A40', '#9C6B52', '#B3895A', '#8A6A50'];

// mood → face parameters (all numeric, so moods can be blended — see moodWeights)
//   lid: upper-lid closure 0..1   lidSlope: deg (+ = lid edge higher at the front)
//   bulge: extra lid-edge curvature (+ = rounder/droopier, − = flatter)   closed: shape of the
//   lash line when the eye shuts (+1 relaxed ◡, −1 happy ︵)
//   low: lower-lid raise          eyeS: eye scale        pupil: pupil-size multiplier
//   browY: lift   browTilt: deg (+ = front end up = worried)   arch: brow curvature
//   mouth: −1 frown … +1 smile    open: jaw   jawX: extra jaw drop (deg)   tilt: head deg (+ = up)
//   tremble, sweat, blush, droop (ears), earUp, tuftUp, teeth (show incisors), sway (slow head
//   sway), lookX/lookY (default gaze), flat / wavy / sly mouth styles, askew (glasses knocked)
const MOOD_DEFAULTS = {
  lid: 0.14, lidSlope: 0, bulge: 0, closed: 1, low: 0.06, eyeS: 1, pupil: 1, browY: 0, browTilt: 0, arch: 0.25,
  mouth: 0.08, open: 0, jawX: 0, tilt: 0, tremble: 0, sweat: 0, blush: 0, droop: 0, earUp: 0, tuftUp: 0, teeth: 0,
  sway: 0, lookX: 0.3, lookY: 0, flat: 0, wavy: 0, sly: 0, askew: 0, lowArch: 0, cheek: 0,
};
const MOODS = {
  neutral: {},
  worried: { lid: 0.06, lidSlope: 16, low: 0.1, lowArch: -0.2, eyeS: 1.04, pupil: 0.82, browY: 6, browTilt: 30, arch: 0.1, mouth: -0.55, wavy: 1, tilt: -1, tremble: 0.15, sweat: 0.25 },
  panic: { lid: 0, lidSlope: 6, low: 0, eyeS: 1.24, pupil: 0.55, browY: 12, browTilt: 32, arch: 0.3, mouth: -0.8, open: 0.62, tilt: 4, tremble: 1, sweat: 0.8, teeth: 1, tuftUp: 0.7 },
  chill: { lid: 0.52, lidSlope: -2, bulge: 2, low: 0.22, lowArch: -0.35, pupil: 1.05, browY: 1, browTilt: 8, arch: 0.55, mouth: 0.75, tilt: 3 },
  happy: { lid: 0.08, bulge: -1.5, closed: -1, low: 0.3, lowArch: 1, cheek: 1, eyeS: 1.03, pupil: 1.1, browY: 9, browTilt: 4, arch: 0.95, mouth: 1, open: 0.3, tilt: 5, blush: 0.65, teeth: 1, lookX: 0.25 },
  smug: { lid: 0.44, lidSlope: -8, low: 0.26, lowArch: 0.1, browY: 15, browTilt: -18, arch: 1, mouth: 0.8, sly: 1, tilt: 7, lookX: 0.75 },
  deadpan: { lid: 0.52, bulge: -2.2, low: 0.2, pupil: 0.9, browY: -2, browTilt: 0, arch: 0, mouth: 0, flat: 1, lookX: 0.1 },
  shock: { lid: 0, eyeS: 1.45, pupil: 0.42, browY: 18, browTilt: 10, arch: 0.5, mouth: -0.3, open: 1, jawX: 7, tilt: 7, tremble: 0.55, sweat: 0.3, askew: 1, teeth: 1, tuftUp: 1, earUp: 1 },
  sad: { lid: 0.38, lidSlope: 18, low: 0.12, lowArch: -0.3, eyeS: 1.02, pupil: 1.15, browY: 3, browTilt: 28, arch: -0.15, mouth: -0.9, tilt: -8, droop: 1, lookY: 0.6, lookX: 0.2 },
  sleepy: { lid: 0.8, lidSlope: -4, bulge: 1.5, low: 0.18, lowArch: -0.3, browY: -4, browTilt: -4, arch: 0.2, mouth: 0.25, open: 0.06, tilt: -4, droop: 0.5 },
};
const MOOD_NAMES = Object.keys(MOODS);
const POSES = ['swim', 'stand', 'walk', 'run', 'sit', 'lie'];

function profile(o) {
  const who = CHARS[o.who] ? o.who : 'extra';
  const c = { ...CHARS[who], who };
  if (who === 'extra') {
    const seed = o.seed == null ? 1 : o.seed;
    const r = U.rng(seed * 7.31 + 3);
    const b = EXTRA_FUR[Math.floor(r() * EXTRA_FUR.length)];
    c.base = mix(b, r() < 0.5 ? '#C08A5A' : '#6E4B36', r() * 0.2);
    c.size = r.range(0.84, 1.06);
    c.build = { len: r.range(0.94, 1.1), h: r.range(0.92, 1.16) };
    c.head = r.range(0.95, 1.05);
    c.seed = 10 + seed * 3.17;
    c.breath = r.range(3.6, 5);
    c.blinkEvery = r.range(4, 7);
    c.mood = r() < 0.55 ? 'sleepy' : 'chill';
    const roll = r();
    c.acc = { orange: roll < 0.5, bird: roll >= 0.5 && roll < 0.72 };
  }
  if (o.color) { c.base = o.color; c.dark = null; c.belly = null; }
  if (!c.dark) c.dark = shade(c.base, -0.22);
  if (!c.belly) c.belly = mix(c.base, '#F3D2A8', 0.34);
  if (o.tint && o.tint.color) {
    const ta = clamp(o.tint.amount == null ? 0.3 : o.tint.amount);
    c.base = mix(c.base, o.tint.color, ta);
    c.dark = mix(c.dark, o.tint.color, ta * 0.8);
    c.belly = mix(c.belly, o.tint.color, ta);
  }
  c.eye = c.eye || EYE;
  c.lensR = c.lensR || LENS_R;
  c.geo = headGeo(c.dome || 0);
  const base = c.base;
  c.pal = {
    base,
    dark: c.dark,
    belly: c.belly,
    hi: o.rim ? mix(base, o.rim, 0.75) : mix(base, '#FFE9C6', 0.5),
    top: mix(base, c.topTint || '#FFDDB0', who === 'sunny' ? 0.3 : 0.2),
    low: mix(c.dark, c.lowTint || '#4E3346', 0.26),
    line: mix(shade(c.dark, -0.45), '#2A1610', 0.3),
    fur: rgba(shade(c.dark, -0.35), 0.45),
    furLight: rgba(mix(base, '#FFF1DA', 0.6), 0.5),
    muzzle: mix(shade(c.dark, -0.35), '#463A40', 0.3),
    earIn: mix(c.dark, '#C97C78', 0.5),
    brow: mix(shade(c.dark, -0.5), '#3A1E12', 0.45),
    browHi: rgba(mix(base, '#FFE8CC', 0.5), 0.55),
    paw: mix(shade(c.dark, -0.18), '#4E4246', 0.3),
    lid: mix(base, c.dark, 0.18),
    far: mix(c.dark, '#4C3442', 0.14),
    tuft: mix(c.dark, base, 0.25),
  };
  return c;
}

function moodOne(c, mood) {
  const m = { ...MOOD_DEFAULTS, ...MOODS[mood], ...((c.moodMod && c.moodMod[mood]) || {}) };
  if (c.lids && !(c.moodMod && mood in c.moodMod) && !['panic', 'shock', 'happy', 'worried', 'sad'].includes(mood)) m.lid = Math.max(m.lid, c.lids);
  return m;
}
// o.mood: 'name' | {name: weight, ...};  o.moodFrom + o.moodK: crossfade moodFrom → mood.
// → [[name, weight], ...] normalised, heaviest first.
function moodWeights(o, c) {
  const acc = {};
  const add = (n, w) => { if (MOODS[n] && w > 0) acc[n] = (acc[n] || 0) + w; };
  const spec = o.mood;
  if (spec && typeof spec === 'object') for (const k in spec) add(k, +spec[k] || 0);
  else add(spec, 1);
  if (!Object.keys(acc).length) add(c.mood, 1);
  if (o.moodFrom && MOODS[o.moodFrom] && o.moodK != null) {
    const k = clamp(+o.moodK);
    for (const n in acc) acc[n] *= k;
    add(o.moodFrom, 1 - k);
  }
  let list = Object.entries(acc).filter(([, w]) => w > 1e-4);
  if (!list.length) list = [[c.mood, 1]];
  const tot = list.reduce((a, [, w]) => a + w, 0);
  return list.map(([n, w]) => [n, w / tot]).sort((a, b) => b[1] - a[1]);
}
function moodParams(c, list) {
  if (list.length === 1) return moodOne(c, list[0][0]);
  const out = {};
  for (const [name, w] of list) {
    const p = moodOne(c, name);
    for (const k in p) out[k] = (out[k] || 0) + p[k] * w;
  }
  return out;
}

// capyMood(t, keys, fade=0.2) → value for o.mood that crossfades between mood changes.
//   keys: [[time, mood], ...] in time order (mood: name or weight map); each change blends in
//   over `fade` seconds from its time (overlapping changes chain smoothly). Pure function.
//   e.g. mood: capyMood(t, [[0, 'worried'], [4.1, 'panic'], [6.3, 'worried']])
function capyMood(t, keys, fade = 0.2) {
  if (!keys || !keys.length) return undefined;
  let i = -1;
  for (let j = 0; j < keys.length; j++) if (keys[j][0] <= t) i = j;
  if (i <= 0) return keys[0][1];
  const [t1, m1] = keys[i];
  const k = fade > 0 ? U.ease.inOutSine(clamp((t - t1) / fade)) : 1;
  if (k >= 1) return m1;
  const toMap = (m) => (m && typeof m === 'object' ? m : { [m]: 1 });
  const prev = toMap(capyMood(t1, keys.slice(0, i), fade)), next = toMap(m1);
  const out = {};
  for (const n in prev) out[n] = (out[n] || 0) + prev[n] * (1 - k);
  for (const n in next) out[n] = (out[n] || 0) + next[n] * k;
  return out;
}

function resolveAcc(c, o) {
  const a = { ...c.acc, ...(o.accessories || {}) };
  let th = a.thermometer;
  if (th === true) th = { at: 'mouth' };
  else if (typeof th === 'string') th = { at: th };
  else if (th && typeof th === 'object') th = { at: 'mouth', ...th };
  else th = null;
  a.thermometer = th;
  a.soot = clamp(fin(+a.soot));
  a.juice = clamp(fin(+a.juice));
  a.fog = clamp(fin(+a.fog));
  if (a.sweat != null && a.sweat !== false) a.sweat = clamp(fin(+a.sweat));
  // helmet: true | {strap: 0..1 (0 = dangling open, 1 = cinched under the jaw), lift: 0..1}
  if (a.helmet && typeof a.helmet === 'object') {
    a.helmetStrap = clamp(fin(a.helmet.strap, 1));
    a.helmetLift = clamp(fin(a.helmet.lift, 0));
    a.helmet = true;
  } else if (a.helmet) { a.helmetStrap = 1; a.helmetLift = 0; }
  if (a.orange === 'squashed') a.juice = Math.max(a.juice, 0.6);
  return a;
}

// ─────────────────────────────────────────────────────────────── idle timing
function pulse(u) { // blink envelope: quick close, slower open; u in [0,1]
  if (u <= 0 || u >= 1) return 0;
  return u < 0.38 ? smoothstep(0, 0.38, u) : 1 - smoothstep(0.38, 1, u);
}
function blinkAt(t, seed, every, dur) {
  const k = Math.floor(t / every);
  let v = 0;
  for (let j = k - 1; j <= k; j++) {
    const st = j * every + 0.2 + hash1(j * 1.37 + seed * 9.1) * Math.max(0.1, every - dur * 3 - 0.2);
    v = Math.max(v, pulse((t - st) / dur));
    if (hash1(j * 3.11 + seed * 2.3) < 0.24) v = Math.max(v, pulse((t - st - dur * 1.5) / dur));
  }
  return v;
}
function twitchAt(t, seed) {
  const every = 4.3 + hash1(seed) * 2.5;
  const k = Math.floor(t / every);
  const st = k * every + hash1(k * 2.7 + seed * 5.3) * (every - 0.5);
  const u = (t - st) / 0.42;
  if (u < 0 || u > 1) return 0;
  return Math.sin(u * Math.PI * 3) * (1 - u);
}

// ─────────────────────────────────────────────────────────────── geometry (pre-K local units)
// Body (facing right): barrel with a high rounded rump. Build-scaled about BODY_C.
const BODY_PTS = [
  [44, -16], [42, 12], [25, 33], [-10, 43], [-54, 43], [-90, 33], [-109, 9], [-111, -21],
  [-98, -48], [-71, -64], [-36, -65], [-5, -58], [21, -48], [37, -34],
];
const BODY_C = [-34, 43];
const NECK = [30, -30];
// Head (head space: origin = neck pivot, facing right). Boxy skull, tall blunt snout.
const HEAD_PTS = [
  [-20, -16], [-15, -37], [-1, -51], [22, -57], [48, -56.5], [72, -52], [90, -46.5], [100.5, -39],
  [105, -26], [105.5, -10], [102.5, 1.5], [94, 8], [81, 10.5], [67, 13.5], [53, 21], [37, 29.5],
  [15, 31.5], [-3, 26], [-15, 10],
];
const JAW_PTS = [[50, 16.5], [66, 14.5], [80, 12], [91, 10], [94.5, 13.5], [92, 20], [81, 24.5], [65, 26.5], [52, 25], [43, 20]];
const JAW_TOP = [[91, 10], [80, 12], [66, 14.5], [48, 17]];
const LIP = [[46, 19.5], [67, 13.5], [81, 10.5], [94, 8]];
const HINGE = [45, 18];
const EYE = [38, -26];          // default eye centre (per-character override: c.eye)
const EAR = [-1, -48];          // ear centre (head space)
const EAR_BASE = [4, -43];
const PERCH_X = 10;             // headTop: over the back of the skull, behind the brows
const ORANGE_X = 30;            // the head orange sits over the middle of the skull
const HELMET_X = 35.5;          // helmet origin (centre of its bottom rim)
const LENS_R = 20.5;
const ORANGE_R = 18;

// Catmull-Rom (as util.blob) sampled into a polyline — for outline lookups.
function sampleBlob(pts, tension, steps = 10) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension];
    const c2 = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension];
    for (let k = 0; k < steps; k++) {
      const u = k / steps, v = 1 - u;
      out.push([
        v * v * v * p1[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * p2[0],
        v * v * v * p1[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * p2[1],
      ]);
    }
  }
  return out;
}
// Per-dome head geometry (pure function of a constant → cached): dome'd outline points and a
// lookup of the skull's top edge y(x) used to clamp brows and to seat the perch/orange/helmet.
const _geo = new Map();
function headGeo(dome) {
  let g = _geo.get(dome);
  if (g) return g;
  const bump = (x) => smoothstep(-22, 10, x) * (1 - smoothstep(56, 88, x));
  const pts = HEAD_PTS.map(([x, y]) => (y < -28 ? [x, y - dome * bump(x)] : [x, y]));
  const poly = sampleBlob(pts, 0.95, 12);
  const top = new Float32Array(140).fill(0); // x from -20..119 → min y
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if (a[1] > -5 && b[1] > -5) continue;
    const n = Math.ceil(Math.abs(b[0] - a[0])) + 1;
    for (let k = 0; k <= n; k++) {
      const x = lerp(a[0], b[0], k / n), y = lerp(a[1], b[1], k / n);
      const j = Math.round(x) + 20;
      if (j >= 0 && j < 140 && y < top[j]) top[j] = y;
    }
  }
  const topY = (x) => {
    const f = clamp(x + 20, 0, 139), i = Math.floor(f), k = f - i;
    return lerp(top[i], top[Math.min(139, i + 1)], k);
  };
  g = { pts, topY, dome, helmetLift: dome * 0.92 };
  _geo.set(dome, g);
  return g;
}

// ─────────────────────────────────────────────────────────────── rig
// gait: q = phase (cycles), d = duty (stance fraction) → x −1..1 (+ = forward) and lift 0..1.
// During stance the foot moves back LINEARLY, so it stays planted when the body advances by
// `stride` per cycle (see STRIDE / anchors.stride).
function gait(q, d) {
  const u = q - Math.floor(q);
  if (u < d) return { x: 1 - (2 * u) / d, lift: 0 };
  const k = (u - d) / (1 - d);
  return { x: -1 + 2 * U.ease.inOutSine(k), lift: Math.sin(Math.PI * k) };
}
const WALK = { A: 14, duty: 0.62, H: 9 };
const RUN = { A: 21, duty: 0.34, H: 14 };
const STRIDE = { walk: (2 * WALK.A) / WALK.duty, run: (2 * RUN.A) / RUN.duty }; // local units / cycle
const rotV = (x, y, a) => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) });

function rig(o) {
  const c = profile(o);
  const t = o.t || 0;
  const pose = POSES.includes(o.pose) ? o.pose : 'swim';
  const moods = moodWeights(o, c);
  const mood = moods[0][0];
  const m = moodParams(c, moods);
  if (o.moodTilt === false) m.tilt = 0;
  const acc = resolveAcc(c, o);
  const talk = clamp(o.talk || 0);
  const s = (o.scale == null ? 1 : o.scale) * c.size * K;
  const flip = !!o.flip;
  const rot = o.rot || 0;
  const seed = c.seed;
  const len = c.build.len, bh = c.build.h;
  const turn = clamp(o.headTurn || 0);
  // small-size level of detail: 0 at normal sizes → 1 for tiny background/wide-shot figures
  const lod = o.lod != null ? clamp(o.lod) : clamp((0.95 - s / K) / 0.45);

  // idle signals
  const br = Math.sin((TAU * t) / c.breath + seed);
  const tremA = (m.tremble || 0) * (o.tremble == null ? 1 : o.tremble);
  const tx = noise1(t * 27 + seed) * 1.6 * tremA, ty = noise1(t * 31 + seed + 7) * 1.2 * tremA;
  const wp = o.walkPhase || 0;

  const G = mChain(mT(o.x || 0, o.y || 0), mR(rot), mS(flip ? -s : s, s));

  // pose → body matrix (local → local)
  const Sbuild = mAbout(BODY_C[0], BODY_C[1], mS(len, bh));
  const Sbreath = mAbout(BODY_C[0], BODY_C[1], mS(1 + 0.005 * br, 1 + 0.016 * br));
  const bodyY = 43; // belly bottom (pre-build) — build scales about it, so it stays put
  let Bpose = mT(tx, ty);
  let headBase = 0, neckOff = [0, 0];
  let ext = 0; // run: +1 stretched (flight) … −1 gathered
  if (pose === 'swim') {
    // float so that every character's neck pivot sits at the same height above the water
    const nkY0 = BODY_C[1] + (NECK[1] - BODY_C[1]) * bh;
    Bpose = mT(tx, ty + Math.sin((TAU * t) / 4.3 + seed * 1.7) * 1.5 + (-35 - nkY0));
    neckOff = [2, 0];
    headBase = 1;
  } else if (pose === 'stand') {
    Bpose = mT(tx, ty + (GROUND - 21) - bodyY);
  } else if (pose === 'walk') {
    Bpose = mT(tx, ty + (GROUND - 21) - bodyY - 1.3 * Math.cos(TAU * wp * 2) + 0.6);
    headBase = Math.sin(TAU * wp * 2) * 1.2;
  } else if (pose === 'run') {
    const ph = TAU * wp;
    ext = Math.cos(ph);
    const air = 11 * Math.max(0, ext) + 1.5 * Math.max(0, -ext);
    Bpose = mChain(
      mT(tx + 4 + ext * 3, ty + (GROUND - 30) - bodyY - air + 3),
      mAbout(-34, 10, mR(-ext * 3.5 * D2R)),
      mAbout(-34, 20, mS(1 + 0.1 * ext, 0.93 - 0.045 * ext)),
    );
    headBase = -5 + ext * 3;
    neckOff = [7 + ext * 6, 6];
  } else if (pose === 'sit') {
    // on the haunches: body tipped up ~22° about the rump, chest held high, head level
    Bpose = mChain(mT(tx + 4, ty + 29), mAbout(-96, 26, mR(-22 * D2R)));
    headBase = -3;
    neckOff = [2, -2];
  } else if (pose === 'lie') {
    Bpose = mChain(mT(tx, ty + (GROUND - bodyY) - 3), mAbout(BODY_C[0], BODY_C[1], mS(1.03, 0.86)));
    headBase = -2;
    neckOff = [0, 29];
  }
  const B = mChain(Bpose, Sbuild, Sbreath);
  const bp = (x, y) => mAp(B, x, y);

  // head
  const nk = bp(NECK[0], NECK[1]);
  const sway = (m.sway || 0) * Math.sin(t * 0.85 + seed * 1.3) * 3;
  const tiltDeg = (o.headTilt || 0) + (m.tilt || 0) + headBase + sway;
  const nod = noise1(t * 2.3 + seed) * 2.2 * talk;
  const headAngle = (-tiltDeg - talk * 3 + nod - (pose === 'lie' ? talk * 4 : 0)) * D2R;
  const hs = c.head;
  const px = nk.x + neckOff[0] * len;
  // lie: the chin rests on the front paws whatever the build / head size
  const py = (pose === 'lie' ? GROUND - 10 - 29 * hs : nk.y + neckOff[1]) - talk * 2.2 - br * 0.9;
  // headTurn: profile in-betweens (yawP) → dissolve (.47–.53) → 3/4 settling (yawF → 0)
  const front = turn >= 0.5;
  const yawP = smoothstep(0, 0.5, turn), yawF = 1 - smoothstep(0.5, 1, turn);
  const fade34 = smoothstep(0.47, 0.53, turn);
  const Hf = mChain(mT(px, py), mR(headAngle - 3 * D2R * (1 - yawF)), mS(hs));
  const Hp = mChain(mT(px, py), mR(headAngle), mS(hs), mAbout(-12, -10, mS(1 - 0.06 * yawP, 1 + 0.02 * yawP)));
  const H = front ? Hf : Hp;

  // jaw
  const mo = m.open || 0;
  const open = clamp(mo + talk * (1 - mo * 0.55));
  const jawA = open * 22 * D2R + (m.jawX || 0) * D2R * open;

  // eyes
  const bl = o.blink !== false ? blinkAt(t, seed, c.blinkEvery, c.blinkDur) : 0;
  let lid = m.lid;
  if (o.eyes != null) lid = 1 - clamp(o.eyes);
  const look = o.look || (front ? { x: 0, y: m.lookY || 0 } : { x: m.lookX * (1 - yawP), y: m.lookY || 0 });
  // small sizes: heavy (not closing) lids open a touch so a white sliver keeps the eye readable
  if (lod > 0 && lid < 0.75 && o.eyes == null) lid *= 1 - 0.22 * lod;
  // the upper lid follows vertical gaze: lifts when looking up, drops a little looking down
  const gy = clamp(fin(look.y), -1, 1);
  if (gy < 0) lid -= Math.min(lid, 0.7) * 0.3 * -gy;
  else lid += (1 - lid) * 0.1 * gy;
  lid = lid + (1 - lid) * bl;

  // ears
  const tw = twitchAt(t, seed);
  let earA = tw * 16 * D2R - (m.droop || 0) * 30 * D2R + (m.earUp || 0) * 14 * D2R;
  if (pose === 'run') earA -= 45 * D2R;

  // legs (local space). Each leg: joints from the hip down + a foot pad.
  const legs = [];
  const G0 = GROUND;
  const pawUp = clamp(o.pawUp != null ? o.pawUp : acc.thermometer && acc.thermometer.at === 'paw' ? 1 : 0);
  // front leg: shoulder (inside the body) → elbow (at the chest line) → wrist → paw
  const frontLeg = (hx, hy, ex, ey, foot, far, fa = 0, w = 1) => {
    w *= c.legW || 1;
    const hip = bp(hx, hy), elb = bp(ex, ey);
    const wr = rotV(-1, -(1.6 + 7.6 * w), fa);
    legs.push({ kind: 'front', far, pts: [hip, elb, { x: foot.x + wr.x, y: foot.y + wr.y }], ws: [14 * w, 11.5 * w, 7.6 * w], foot, fa, fs: 0.95 * (0.6 + 0.4 * w) });
  };
  // hind leg: hip (in the haunch) → knee (front of the haunch, at the belly line) → hock → paw
  const hindLeg = (hx, hy, kx, ky, foot, far, fa = 0, w = 1) => {
    w *= c.legW || 1;
    const hip = bp(hx, hy), knee = bp(kx, ky);
    const hk = rotV(-9, -Math.max(12.5, 3 + 7.4 * w), fa);
    legs.push({ kind: 'hind', far, pts: [hip, knee, { x: foot.x + hk.x, y: foot.y + hk.y }], ws: [18 * w, 12.5 * w, 7.4 * w], foot, fa, fs: 1.05 * (0.6 + 0.4 * w), long: true });
  };
  if (pose === 'stand' || pose === 'walk') {
    const walk = pose === 'walk';
    const leg = (kind, hx, q, far) => {
      const g = walk ? gait(wp + q, WALK.duty) : { x: 0, lift: 0 };
      const h = bp(hx, 30);
      const fx = h.x + (kind === 'front' ? 3 : 7) + WALK.A * g.x;
      const foot = { x: fx, y: G0 - WALK.H * g.lift };
      const fa = g.lift * (kind === 'front' ? 0.55 : -0.25) + (walk ? g.x * (kind === 'front' ? -0.05 : 0.08) : 0);
      const sw = (fx - h.x) * 0.22;
      if (kind === 'front') frontLeg(hx, 14, hx - 3 + sw, 34, foot, far, fa);
      else hindLeg(hx - 6, 8, hx + 6 + sw, 35, foot, far, fa);
    };
    leg('front', 16, 0.75, true); leg('hind', -84, 0.5, true);
    leg('front', 27, 0.25, false); leg('hind', -72, 0, false);
  } else if (pose === 'run') {
    const leg = (kind, hx, cc, far) => {
      const g = gait(wp - (cc - RUN.duty / 2), RUN.duty);
      const h = bp(hx, 30);
      // foot track measured from the un-stretched body so planted feet don't skate
      const fx = mAp(Sbuild, hx, 30).x + 4 + (kind === 'front' ? 8 : 2) + RUN.A * g.x;
      const foot = { x: fx, y: G0 - RUN.H * g.lift };
      // reaching paw points forward/up, trailing paw points back (toes down)
      const fa = kind === 'front' ? (g.lift > 0 ? (g.x > 0 ? -0.25 : 0.45) * g.lift : 0) : (g.lift > 0 ? (g.x < 0 ? 0.5 : -0.3) * g.lift : 0);
      const sw = (fx - h.x) * 0.3;
      if (kind === 'front') frontLeg(hx, 12, hx - 2 + sw, 32, foot, far, fa, 0.96);
      else hindLeg(hx - 6, 6, hx + 6 + sw, 33, foot, far, fa, 0.96);
    };
    leg('front', 16, 0.39, true); leg('hind', -84, 0.67, true);
    leg('front', 27, 0.33, false); leg('hind', -72, 0.6, false);
  } else if (pose === 'sit') {
    // short front legs straight down from the chest; hind paws tucked under the haunch
    const c1 = bp(16, 30), c2 = bp(26, 30);
    frontLeg(16, 14, 15, 34, { x: c1.x + 3, y: G0 }, true, 0, 0.95);
    frontLeg(26, 14, 25, 34, { x: c2.x + 4, y: G0 }, false, 0, 0.95);
    const hh = bp(-70, 22);
    legs.push({ kind: 'hindTuck', far: true, foot: { x: hh.x + 22, y: G0 }, fs: 1.05, long: true });
    legs.push({ kind: 'hindTuck', far: false, foot: { x: hh.x + 30, y: G0 }, fs: 1.1, long: true });
  } else if (pose === 'lie') {
    const s1 = bp(14, 26), s2 = bp(25, 26);
    const lw = c.legW || 1;
    legs.push({ kind: 'paw', far: true, pts: [s1, { x: s1.x + 34, y: G0 - 1.5 - 10.5 * lw }, { x: 108, y: G0 - 1.5 - 7.5 * lw }], ws: [13 * lw, 10.5 * lw, 7.5 * lw], foot: { x: 112, y: G0 }, fa: 0, fs: 0.95 });
    legs.push({ kind: 'paw', far: false, pts: [s2, { x: s2.x + 36, y: G0 - 1.5 - 10.5 * lw }, { x: 124, y: G0 - 1.5 - 7.5 * lw }], ws: [13 * lw, 10.5 * lw, 7.5 * lw], foot: { x: 128, y: G0 }, fa: 0, fs: 0.95 });
    const hh = bp(-70, 18);
    legs.push({ kind: 'hindTuck', far: false, foot: { x: hh.x + 32, y: G0 }, fs: 1.05, long: true });
  }

  // raised near front paw (gesture / holding things)
  let arm = null;
  if (pawUp > 0.001) {
    const k = U.ease.inOutCubic(pawUp);
    const chin = mAp(H, 84, 27);
    let sh, rest, tgt, l1, l2, elbowFix = null;
    if (pose === 'swim') {
      // the arm comes up out of the water just under the chin
      sh = { x: chin.x - 34, y: chin.y + 44 }; l1 = 30; l2 = 34;
      rest = { x: sh.x + 10, y: sh.y + 58 };
      tgt = o.pawAt || { x: chin.x + 16, y: chin.y - 20 };
    } else if (pose === 'lie') {
      // the chin-rest paw lifts off the couch; the elbow stays planted
      sh = bp(25, 26); l1 = 36; l2 = 40;
      rest = { x: 124, y: G0 - 9 };
      tgt = o.pawAt || { x: chin.x + 34, y: chin.y - 14 };
      elbowFix = { x: sh.x + 36, y: G0 - 12 };
    } else {
      // shoulder well inside the chest: the root is hidden by the body, never in empty space
      sh = bp(22, 2); l1 = 42; l2 = 40;
      rest = { x: sh.x + 4, y: G0 - 8 };
      tgt = o.pawAt || { x: chin.x + 12, y: chin.y - 4 };
    }
    arm = { sh, goal: { x: lerp(rest.x, tgt.x, k), y: lerp(rest.y, tgt.y, k) }, l1, l2, elbowFix, k };
    const near = legs.findIndex((l) => !l.far && (l.kind === 'front' || l.kind === 'paw'));
    if (near >= 0) legs.splice(near, 1);
  }

  return {
    o, c, m, t, pose, mood, moods, acc, talk, s, flip, rot, seed, G, B, H, Hp, Hf, hs, headAngle, px, py, nk,
    open, jawA, lid, bl, look, earA, legs, arm, pawUp, br, len, bh, turn, front, yawP, yawF, fade34, lod, ext, geo: c.geo,
  };
}

const headPt = (r, x, y) => mAp(mMul(r.G, r.H), x, y);
const localPt = (r, x, y) => mAp(r.G, x, y);
const bodyPt = (r, x, y) => mAp(mMul(r.G, r.B), x, y);
function jawPt(r, x, y) {
  return mAp(mChain(r.G, r.H, mAbout(HINGE[0], HINGE[1], mR(r.jawA))), x, y);
}
function armSolve(arm) {
  const { sh, goal, l1, l2 } = arm;
  if (arm.elbowFix) {
    const e = arm.elbowFix;
    return { elbow: e, paw: goal, ang: Math.atan2(goal.y - e.y, goal.x - e.x) };
  }
  const dx = goal.x - sh.x, dy = goal.y - sh.y;
  const d = Math.hypot(dx, dy) || 1;
  const dd = Math.min(d, l1 + l2 - 0.5);
  const a = Math.atan2(dy, dx);
  const b = Math.acos(clamp((l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd), -1, 1));
  const elbow = { x: sh.x + Math.cos(a + b) * l1, y: sh.y + Math.sin(a + b) * l1 };
  const paw = { x: sh.x + Math.cos(a) * dd, y: sh.y + Math.sin(a) * dd };
  return { elbow, paw, ang: Math.atan2(paw.y - elbow.y, paw.x - elbow.x) };
}
// head-space positions of the head-mounted accessories (profile / 3/4)
function crownPos(r) {
  if (r.front) return { perch: [F34.crown[0] - 6, top34(F34.crown[0] - 6)], orange: [32, top34(32)], helmet: [HELMET_X, top34(HELMET_X) + 0.5] };
  const g = r.geo;
  return {
    perch: [PERCH_X, g.topY(PERCH_X)],
    orange: [ORANGE_X, g.topY(ORANGE_X)],
    helmet: [HELMET_X, -57 - g.helmetLift],
  };
}
// helmet / orange placement in HEAD space: {x, y (origin = middle of the bottom rim), top, rot}.
// accessories.helmet.lift 0..1 raises it off the head (tipping back) for putting it on / off.
function helmetPlace(r) {
  const p = crownPos(r).helmet, L = r.acc.helmetLift || 0;
  const y = p[1] - 64 * L;
  return { x: p[0] - 4 * L, y, top: y - 24, rot: -0.22 * L };
}
function orangePlace(r) {
  const a = r.acc;
  const base = a.helmet ? helmetPlace(r).top + 1 : crownPos(r).orange[1] + 1.5;
  const x = crownPos(r).orange[0] + (a.helmet ? -2 : 0);
  if (a.orange === 'squashed') return { x, y: base - 1, r: 15, top: base - 9, squashed: true };
  return { x, y: base - ORANGE_R, r: ORANGE_R, top: base - 2 * ORANGE_R - 2 };
}

// ─────────────────────────────────────────────────────────────── anchors
// angle (caller space) of a head/local-space direction vector
function dirAngle(M, dx, dy) { const a = mAp(M, 0, 0), b = mAp(M, dx, dy); return Math.atan2(b.y - a.y, b.x - a.x); }
function capyAnchors(o) {
  o = sanitize(o);
  const r = rig(o);
  const a = r.acc;
  const F = r.front;
  const GH = mMul(r.G, r.H);
  const cp = crownPos(r);
  const hp = helmetPlace(r);
  const top = a.helmet ? headPt(r, hp.x, hp.top) : headPt(r, cp.perch[0], cp.perch[1]);
  // "up" for an object resting on the head (caller space); 0 = upright
  const angle = dirAngle(GH, 0, -1) + Math.PI / 2;
  let stack = { x: top.x, y: top.y };
  const op = a.orange || a.bird ? orangePlace(r) : null;
  if (a.orange) stack = headPt(r, op.x, op.top);
  else if (a.bird) stack = headPt(r, cp.orange[0], (a.helmet ? hp.top : cp.orange[1]) - 19);
  const openK = clamp(r.jawA / (22 * D2R));
  let mouth, chin;
  if (F) {
    mouth = headPt(r, F34.mouth[0], F34.mouth[1] + 2 + openK * 9);
    chin = headPt(r, F34.chin[0], F34.chin[1] + 2 + openK * 14);
  } else {
    const jf = jawPt(r, 90, 11), lip = headPt(r, 91, 9);
    mouth = { x: (jf.x + lip.x) / 2, y: (jf.y + lip.y) / 2 };
    chin = jawPt(r, 82, 25);
  }
  let paw, pawAngle;
  if (r.arm) {
    const sol = armSolve(r.arm);
    paw = localPt(r, sol.paw.x, sol.paw.y);
    pawAngle = dirAngle(r.G, Math.cos(sol.ang), Math.sin(sol.ang));
  } else {
    const fl = r.legs.find((l) => !l.far && (l.kind === 'front' || l.kind === 'paw'));
    paw = fl ? localPt(r, fl.foot.x + 5, fl.foot.y - 4) : bodyPt(r, 40, 30);
    pawAngle = dirAngle(r.G, 1, 0);
  }
  paw.angle = pawAngle;
  const wl = r.o.waterline != null ? r.o.waterline : 0;
  const hScale = (r.s * r.hs) / K; // head-mounted props: scale relative to a default scale-1 head
  const hel = headPt(r, hp.x, hp.y);
  const orC = headPt(r, orangePlace(r).x, orangePlace(r).y);
  const eye = F ? F34.eyeN : r.c.eye;
  return {
    headTop: { x: top.x, y: top.y, angle },
    stackTop: { x: stack.x, y: stack.y, angle },
    helmet: { x: hel.x, y: hel.y, angle, scale: hScale, flip: r.flip },
    orange: { x: orC.x, y: orC.y, r: orangePlace(r).r * r.s * r.hs, angle, flip: r.flip, squashed: a.orange === 'squashed' },
    mouth,
    eye: headPt(r, eye[0], eye[1]),
    snout: F ? headPt(r, F34.nose[0], F34.nose[1]) : headPt(r, 105, -22),
    ear: F ? headPt(r, F34.earN[0], F34.earN[1]) : headPt(r, EAR[0], EAR[1]),
    chin,
    back: bodyPt(r, -40, -65),
    rump: bodyPt(r, -72, -64),
    neck: localPt(r, r.nk.x, r.nk.y),
    paw,
    ground: r.pose === 'swim' ? bodyPt(r, -34, 43) : localPt(r, -34, GROUND),
    waterline: { y: (r.o.y || 0) + wl * r.s },
    stride: r.pose === 'run' ? STRIDE.run * r.s : STRIDE.walk * r.s,
    scale: r.s / K,
    flip: r.flip,
    facing: r.flip ? -1 : 1,
    headAngle: angle,
    mood: r.mood,
  };
}

// ─────────────────────────────────────────────────────────────── drawing helpers
function limbPath(ctx, x0, y0, x1, y1, w0, w1) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const an = Math.atan2(ny, nx);
  ctx.beginPath();
  ctx.moveTo(x0 + nx * w0, y0 + ny * w0);
  ctx.lineTo(x1 + nx * w1, y1 + ny * w1);
  ctx.arc(x1, y1, w1, an, an + Math.PI, true);
  ctx.lineTo(x0 - nx * w0, y0 - ny * w0);
  ctx.arc(x0, y0, w0, an + Math.PI, an + TAU, true);
  ctx.closePath();
}
// util.blob without beginPath (so shapes can be combined into one clip path)
function blobTo(ctx, pts, tension = 1) {
  const n = pts.length;
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    ctx.bezierCurveTo(p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension,
      p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension, p2[0], p2[1]);
  }
  ctx.closePath();
}
// open Catmull-Rom through pts, continuing the current path (current point = pts[0])
function crTo(ctx, pts, tension = 1) {
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    ctx.bezierCurveTo(p1.x + ((p2.x - p0.x) / 6) * tension, p1.y + ((p2.y - p0.y) / 6) * tension,
      p2.x - ((p3.x - p1.x) / 6) * tension, p2.y - ((p3.y - p1.y) / 6) * tension, p2.x, p2.y);
  }
}
// smooth tapered limb through joints pts [{x,y}...] with half-widths ws; round caps.
function taperPath(ctx, pts, ws) {
  const n = pts.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    L.push({ x: pts[i].x - dy * ws[i], y: pts[i].y + dx * ws[i] });
    R.push({ x: pts[i].x + dy * ws[i], y: pts[i].y - dx * ws[i] });
  }
  const angEnd = Math.atan2(pts[n - 1].y - pts[n - 2].y, pts[n - 1].x - pts[n - 2].x);
  const angStart = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
  ctx.beginPath();
  ctx.moveTo(L[0].x, L[0].y);
  crTo(ctx, L, 1);
  ctx.arc(pts[n - 1].x, pts[n - 1].y, ws[n - 1], angEnd + Math.PI / 2, angEnd - Math.PI / 2, true);
  const Rr = R.slice().reverse();
  ctx.lineTo(Rr[0].x, Rr[0].y);
  crTo(ctx, Rr, 1);
  ctx.arc(pts[0].x, pts[0].y, ws[0], angStart - Math.PI / 2, angStart + Math.PI / 2, true);
  ctx.closePath();
}
// clip to the body silhouette (inside) or to everything outside it
function bodyClip(ctx, r, outside) {
  ctx.beginPath();
  if (outside) ctx.rect(-3000, -3000, 6000, 6000);
  SV(ctx);
  apply(ctx, r.B);
  blobTo(ctx, BODY_PTS, 1);
  RS(ctx);
  ctx.clip(outside ? 'evenodd' : 'nonzero');
}
function teardrop(ctx, x, y, r, ang = 0) { // tip points up (before rotation)
  const s = Math.sin(ang), c = Math.cos(ang);
  const P = (px, py) => [x + px * c - py * s, y + px * s + py * c];
  ctx.beginPath();
  let p = P(0, -r * 2.1);
  ctx.moveTo(p[0], p[1]);
  const seg = (a, b, d) => { const A = P(...a), B = P(...b), D = P(...d); ctx.bezierCurveTo(A[0], A[1], B[0], B[1], D[0], D[1]); };
  seg([r * 0.5, -r * 1.2], [r * 1.05, -r * 0.45], [r, r * 0.15]);
  seg([r * 0.95, r * 0.75], [r * 0.5, r * 1.15], [0, r * 1.15]);
  seg([-r * 0.5, r * 1.15], [-r * 0.95, r * 0.75], [-r, r * 0.15]);
  seg([-r * 1.05, -r * 0.45], [-r * 0.5, -r * 1.2], [0, -r * 2.1]);
  ctx.closePath();
}
function strokes(ctx, list, color, w) {
  ctx.strokeStyle = color;
  ctx.lineWidth = (w) * LWK;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const s of list) {
    ctx.moveTo(s[0], s[1]);
    ctx.quadraticCurveTo(s[2], s[3], s[4], s[5]);
  }
  ctx.stroke();
}
function flicks(ctx, list, color) {
  // tapered hair flicks: [x, y, length, angle(rad), width]
  ctx.fillStyle = color;
  ctx.beginPath();
  for (const [x, y, L, a, w = 2.2] of list) {
    const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    const mx = x + dx * L * 0.45, my = y + dy * L * 0.45;
    ctx.moveTo(x + nx * w * 0.5, y + ny * w * 0.5);
    ctx.quadraticCurveTo(mx + nx * w * 0.9, my + ny * w * 0.9, x + dx * L, y + dy * L);
    ctx.quadraticCurveTo(mx - nx * w * 0.5, my - ny * w * 0.5, x - nx * w * 0.5, y - ny * w * 0.5);
    ctx.closePath();
  }
  ctx.fill();
}
// House style fill: vertical gradient, crisp rim-light crescent on the top edge,
// soft occlusion toward the bottom, optional extra detail (clipped), thin darker outline.
function paintShape(ctx, pathFn, o) {
  const { top, bottom, y0, y1, hi, rim = [1.5, 3.8], shadow, shadowY0, shadowY1, shadowA = 0.55, line, lw = 2.2, extra } = o;
  SV(ctx);
  pathFn();
  ctx.clip();
  ctx.fillStyle = hi;
  ctx.fillRect(-500, -500, 1000, 1000);
  SV(ctx);
  ctx.translate(rim[0], rim[1]);
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  pathFn();
  ctx.fill();
  RS(ctx);
  if (shadow) {
    const sg = ctx.createLinearGradient(0, shadowY0, 0, shadowY1);
    sg.addColorStop(0, rgba(shadow, 0));
    sg.addColorStop(1, rgba(shadow, shadowA));
    ctx.fillStyle = sg;
    ctx.fillRect(-500, shadowY0, 1000, 1000);
  }
  if (extra) extra();
  RS(ctx);
  pathFn();
  ctx.strokeStyle = line;
  ctx.lineWidth = (lw) * LWK;
  ctx.lineJoin = 'round';
  ctx.stroke();
}
function rotAbout(p, c, a) {
  const s = Math.sin(a), co = Math.cos(a), dx = p[0] - c[0], dy = p[1] - c[1];
  return [c[0] + dx * co - dy * s, c[1] + dx * s + dy * co];
}

// ─────────────────────────────────────────────────────────────── body parts
// foot pad: sole flat on y (the outline's bottom edge lands exactly on y), toes → +x.
// ang rotates it about the ankle (lifted / pointing paws); long = hind foot (longer heel).
function drawFoot(ctx, r, x, y, far, scale = 1, ang = 0, long = false) {
  const P = r.c.pal;
  SV(ctx);
  ctx.translate(x, y - 6 * scale);
  ctx.rotate(ang);
  ctx.translate(0, 6 * scale);
  ctx.scale(scale, scale);
  const hb = long ? -13 : -9; // heel
  ctx.beginPath();
  ctx.moveTo(hb, -1);
  ctx.bezierCurveTo(hb - 1, -8, -2, -10.5, 6, -9.5);
  ctx.bezierCurveTo(13, -8.5, 17, -5, 16.5, -2);
  ctx.quadraticCurveTo(16, -1, 13, -1);
  ctx.lineTo(hb + 2, -1);
  ctx.quadraticCurveTo(hb, -1, hb, -1);
  ctx.closePath();
  ctx.fillStyle = far ? shade(P.paw, -0.22) : P.paw;
  ctx.fill();
  ctx.strokeStyle = P.line;
  ctx.lineWidth = (1.9) * LWK / scale;
  ctx.stroke();
  if (!far) {
    ctx.strokeStyle = rgba(shade(P.line, -0.1), 0.65);
    ctx.lineWidth = (1.3) * LWK / scale;
    ctx.beginPath();
    ctx.moveTo(8, -1.5); ctx.lineTo(7.5, -5);
    ctx.moveTo(12.5, -1.5); ctx.lineTo(12, -4.5);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,220,0.22)';
    ctx.beginPath();
    ctx.moveTo(hb + 5, -8); ctx.quadraticCurveTo(3, -10, 9, -8.3);
    ctx.stroke();
  }
  RS(ctx);
}

// tapered, jointed leg. merge: drawn over the body — the part inside the body fades in so the
// limb grows out of the silhouette (no outline across the join).
function drawLeg(ctx, r, l, merge) {
  const P = r.c.pal;
  const far = l.far;
  if (l.kind === 'hindTuck') { drawFoot(ctx, r, l.foot.x, l.foot.y, far, l.fs, 0, true); return; }
  const path = () => taperPath(ctx, l.pts, l.ws);
  const y0 = l.pts[0].y, y1 = l.foot.y;
  const topC = far ? P.far : mix(mix(P.base, P.dark, 0.4), P.low, 0.28);
  const botC = far ? shade(P.far, -0.14) : mix(P.base, P.dark, 0.62);
  const grad = () => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, topC); g.addColorStop(0.45, far ? P.far : mix(P.base, P.dark, 0.38)); g.addColorStop(1, botC); return g; };
  SV(ctx);
  ctx.lineJoin = 'round';
  if (merge) {
    SV(ctx);
    bodyClip(ctx, r, true);
    path();
    ctx.fillStyle = grad();
    ctx.fill();
    ctx.strokeStyle = P.line;
    ctx.lineWidth = (2) * LWK;
    ctx.stroke();
    RS(ctx);
    SV(ctx);
    bodyClip(ctx, r, false);
    const j = l.pts[1];
    const g = ctx.createLinearGradient(0, j.y - 15, 0, j.y + 1);
    g.addColorStop(0, rgba(topC, 0));
    g.addColorStop(1, rgba(topC, 1));
    path();
    ctx.fillStyle = g;
    ctx.fill();
    RS(ctx);
  } else {
    path();
    ctx.fillStyle = grad();
    ctx.fill();
    ctx.strokeStyle = P.line;
    ctx.lineWidth = (2) * LWK;
    ctx.stroke();
  }
  if (!far) {
    // front-edge light + a joint crease (elbow / hock)
    SV(ctx);
    path();
    ctx.clip();
    const [a, b, c] = l.pts;
    ctx.strokeStyle = rgba(P.hi, 0.32);
    ctx.lineWidth = (3) * LWK;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b.x + l.ws[1] - 1.5, b.y);
    ctx.lineTo(c.x + l.ws[2] - 1.5, c.y);
    ctx.stroke();
    ctx.strokeStyle = rgba(P.dark, 0.55);
    ctx.lineWidth = (1.6) * LWK;
    ctx.beginPath();
    if (l.kind === 'hind') { ctx.moveTo(c.x - 4, c.y - 6); ctx.quadraticCurveTo(c.x - 7, c.y - 1, c.x - 5, c.y + 4); }
    else { ctx.moveTo(c.x - 5, c.y - 3); ctx.quadraticCurveTo(c.x - 1, c.y - 1, c.x + 3, c.y - 3); }
    ctx.stroke();
    RS(ctx);
  }
  drawFoot(ctx, r, l.foot.x - 1, l.foot.y, far, l.fs, l.fa || 0, !!l.long);
  RS(ctx);
}

function bodyPath(ctx) { blob(ctx, BODY_PTS, 1); }

function drawBody(ctx, r) {
  const P = r.c.pal;
  SV(ctx);
  apply(ctx, r.B);
  paintShape(ctx, () => bodyPath(ctx), {
    top: P.top, bottom: mix(P.base, P.dark, 0.45), y0: -66, y1: 44, hi: P.hi, rim: [1.4, 4.6],
    shadow: P.low, shadowY0: 4, shadowY1: 46, line: P.line, lw: 2.4,
    extra: () => {
      // belly: lighter underside
      ellipse(ctx, -30, 46, 66, 17);
      ctx.fillStyle = rgba(P.belly, 0.5);
      ctx.fill();
      // haunch volume (soft light on the thigh)
      const hg = ctx.createRadialGradient(-80, -14, 4, -78, -6, 44);
      hg.addColorStop(0, rgba('#FFF0D8', 0.2));
      hg.addColorStop(1, rgba('#FFF0D8', 0));
      ctx.fillStyle = hg;
      ctx.fillRect(-130, -64, 110, 120);
      // haunch crease
      ctx.strokeStyle = rgba(P.dark, 0.6);
      ctx.lineWidth = (2.1) * LWK;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-50, -22);
      ctx.bezierCurveTo(-40, 0, -46, 22, -60, 36);
      ctx.stroke();
      // shoulder crease
      ctx.strokeStyle = rgba(P.dark, 0.4);
      ctx.beginPath();
      ctx.moveTo(12, -34);
      ctx.bezierCurveTo(4, -14, 8, 6, 16, 22);
      ctx.stroke();
      // coarse fur: clusters of tapered flicks (dark) + a few light ones near the top
      const D = 1.95;
      flicks(ctx, [
        [-96, -36, 11, D, 2.6], [-90, -42, 12, D - 0.05, 2.6], [-84, -46, 9, D - 0.1, 2.2],
        [-32, -54, 10, D - 0.1, 2.4], [-25, -54, 8, D - 0.15, 2],
        [-2, -45, 9, D - 0.2, 2.2], [-102, 2, 10, D + 0.1, 2.4], [-18, 18, 9, D, 2.2], [-12, 20, 7, D, 1.8],
      ], P.fur);
      flicks(ctx, [[-70, -60, 12, 0.1, 2.2], [-62, -61, 10, 0.12, 1.8], [-24, -59, 11, 0.25, 2], [-16, -57, 8, 0.3, 1.6]], P.furLight);
    },
  });
  RS(ctx);
}

function drawNeck(ctx, r) {
  const P = r.c.pal;
  const a = mAp(r.B, 24, -18);
  const b = mAp(r.H, 4, 8);
  SV(ctx);
  const nw = r.c.neck || 1;
  limbPath(ctx, a.x, a.y, b.x, b.y, 25 * nw, 23 * r.hs * nw);
  ctx.fillStyle = mix(P.base, P.dark, 0.18);
  ctx.fill();
  RS(ctx);
}

function drawHeadShadowOnBody(ctx, r) {
  const P = r.c.pal;
  const p = mAp(r.H, 16, 26);
  SV(ctx);
  SV(ctx);
  apply(ctx, r.B);
  bodyPath(ctx);
  RS(ctx);
  ctx.clip();
  const R = 38 * r.hs;
  const g = ctx.createRadialGradient(p.x, p.y + 4, 2, p.x, p.y + 4, R);
  g.addColorStop(0, rgba(P.low, 0.55));
  g.addColorStop(1, rgba(P.low, 0));
  ctx.fillStyle = g;
  ctx.fillRect(p.x - R, p.y + 4 - R, 2 * R, 2 * R);
  RS(ctx);
}

// folded thigh for sit / lie, merged into the body: outside the body it extends the silhouette
// (same paint as the body → no seam); inside only a soft crease + light show the thigh.
function drawHaunch(ctx, r, sit) {
  const P = r.c.pal;
  const cx = sit ? -70 : -72, cy = sit ? 14 : 18, rx = sit ? 31 : 28, ry = sit ? 27 : 24, ang = sit ? -0.15 : -0.2;
  const hp = () => ellipse(ctx, cx, cy, rx, ry, ang);
  SV(ctx);
  bodyClip(ctx, r, true);
  apply(ctx, r.B);
  SV(ctx);
  hp();
  ctx.clip();
  ctx.fillStyle = P.hi;
  ctx.fillRect(-200, -100, 300, 200);
  ctx.translate(1.4, 4.6);
  const g = ctx.createLinearGradient(0, -66, 0, 44);
  g.addColorStop(0, P.top);
  g.addColorStop(1, mix(P.base, P.dark, 0.45));
  ctx.fillStyle = g;
  hp();
  ctx.fill();
  ctx.translate(-1.4, -4.6);
  const sg = ctx.createLinearGradient(0, 4, 0, 46);
  sg.addColorStop(0, rgba(P.low, 0));
  sg.addColorStop(1, rgba(P.low, 0.55));
  ctx.fillStyle = sg;
  ctx.fillRect(-200, 4, 300, 100);
  RS(ctx);
  hp();
  ctx.strokeStyle = P.line;
  ctx.lineWidth = (2.4) * LWK;
  ctx.stroke();
  RS(ctx);
  // inside: thigh light + crease along the front/top of the thigh
  SV(ctx);
  apply(ctx, r.B);
  SV(ctx);
  hp();
  ctx.clip();
  const lg = ctx.createRadialGradient(cx - 8, cy - 10, 2, cx - 4, cy - 4, rx);
  lg.addColorStop(0, rgba('#FFF0D8', 0.18));
  lg.addColorStop(1, rgba('#FFF0D8', 0));
  ctx.fillStyle = lg;
  ctx.fillRect(cx - rx, cy - ry, 2 * rx, 2 * ry);
  RS(ctx);
  ctx.strokeStyle = rgba(P.dark, 0.7);
  ctx.lineWidth = (2.1) * LWK;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, ang, sit ? -2.2 : -2.0, sit ? 0.55 : 0.4);
  ctx.stroke();
  flicks(ctx, [[cx - 12, cy - 16, 11, 1.9, 2.2], [cx - 4, cy - 18, 10, 1.85, 2]], P.fur);
  RS(ctx);
}

// raised near front paw: tapered upper arm + forearm, wrist, paw pad. Returns the paw pose.
function drawArm(ctx, r) {
  if (!r.arm) return null;
  const P = r.c.pal;
  const sol = armSolve(r.arm);
  const { elbow, paw, ang } = sol;
  const sh = r.arm.sh;
  const swim = r.pose === 'swim';
  const wrist = { x: paw.x - Math.cos(ang) * 6, y: paw.y - Math.sin(ang) * 6 };
  const l = { kind: 'arm', far: false, pts: [sh, elbow, wrist], ws: swim ? [12, 10, 7] : [13, 10.5, 7.2] };
  const path = () => taperPath(ctx, l.pts, l.ws);
  const topC = mix(mix(P.base, P.dark, 0.3), P.low, 0.15);
  const botC = mix(P.top, P.base, 0.4);
  const dTot = Math.hypot(paw.x - sh.x, paw.y - sh.y) || 1;
  SV(ctx);
  ctx.lineJoin = 'round';
  // fill gradient along the arm; a0 = alpha at the shoulder, fade over the first kf of it
  const grad = (a0, kf, colA, colB, mid) => {
    const g = ctx.createLinearGradient(sh.x, sh.y, paw.x, paw.y);
    g.addColorStop(0, rgba(colA, a0));
    g.addColorStop(kf, mid ? rgba(colA, 1) : colA);
    g.addColorStop(1, colB);
    return g;
  };
  let kf;
  if (swim) {
    // swim: the arm comes up out of the water — it fades in from the shoulder (the water /
    // waterline clip hides the root), outline and highlight fade with it
    const fx = lerp(sh.x, elbow.x, 0.55), fy = lerp(sh.y, elbow.y, 0.55);
    kf = clamp(Math.hypot(fx - sh.x, fy - sh.y) / dTot, 0.05, 0.9);
    path(); ctx.fillStyle = grad(0, kf, topC, botC, true); ctx.fill();
    ctx.strokeStyle = grad(0, kf, P.line, P.line, true); ctx.lineWidth = (2) * LWK; ctx.stroke();
  } else {
    // stand / sit / lie: opaque limb with outline outside the body; inside the chest only a
    // fill that fades in from the shoulder, so it grows out of the silhouette without a seam
    kf = clamp(16 / dTot, 0.05, 0.6);
    SV(ctx);
    bodyClip(ctx, r, true);
    path(); ctx.fillStyle = grad(1, kf, topC, botC); ctx.fill();
    ctx.strokeStyle = P.line; ctx.lineWidth = (2) * LWK; ctx.stroke();
    RS(ctx);
    SV(ctx);
    bodyClip(ctx, r, false);
    path(); ctx.fillStyle = grad(0, kf, topC, botC, true); ctx.fill();
    RS(ctx);
  }
  // forearm light (fades with the same mask as the fill)
  SV(ctx);
  path();
  ctx.clip();
  const hg = ctx.createLinearGradient(sh.x, sh.y, paw.x, paw.y);
  hg.addColorStop(0, rgba(P.hi, 0));
  hg.addColorStop(Math.min(0.95, kf + 0.08), rgba(P.hi, 0.3));
  hg.addColorStop(1, rgba(P.hi, 0.3));
  ctx.strokeStyle = hg;
  ctx.lineWidth = (3) * LWK;
  ctx.lineCap = 'round';
  const nx = -Math.sin(ang), ny = Math.cos(ang);
  ctx.beginPath();
  ctx.moveTo(elbow.x - nx * 7, elbow.y - ny * 7);
  ctx.lineTo(wrist.x - nx * 5, wrist.y - ny * 5);
  ctx.stroke();
  RS(ctx);
  // paw pad
  ctx.translate(paw.x, paw.y);
  ctx.rotate(ang);
  ellipse(ctx, 1.5, 0, 9.5, 8);
  ctx.fillStyle = P.paw;
  ctx.fill();
  ctx.strokeStyle = P.line;
  ctx.lineWidth = (1.9) * LWK;
  ctx.stroke();
  ctx.strokeStyle = rgba(P.line, 0.7);
  ctx.lineWidth = (1.3) * LWK;
  ctx.beginPath();
  ctx.moveTo(6.5, -5); ctx.lineTo(10, -3.2);
  ctx.moveTo(8, 0.5); ctx.lineTo(11.5, 1.2);
  ctx.stroke();
  RS(ctx);
  return { paw, ang };
}
// the "thumb": a little curl of the paw drawn OVER a held prop so it reads as gripped
function drawThumb(ctx, r, paw, ang) {
  const P = r.c.pal;
  SV(ctx);
  ctx.translate(paw.x, paw.y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.ellipse(4.5, -3.5, 6.2, 4.6, 0.5, 0, TAU);
  ctx.fillStyle = mix(P.paw, P.base, 0.15);
  ctx.fill();
  ctx.strokeStyle = P.line;
  ctx.lineWidth = (1.5) * LWK;
  ctx.stroke();
  ctx.strokeStyle = rgba(P.line, 0.6);
  ctx.lineWidth = (1.1) * LWK;
  ctx.beginPath();
  ctx.moveTo(6, -6.5); ctx.lineTo(8.5, -4);
  ctx.stroke();
  RS(ctx);
}

// ─────────────────────────────────────────────────────────────── head
function headPath(ctx, r) { blob(ctx, r ? r.geo.pts : HEAD_PTS, 0.95); }
function jawPath(ctx) { blob(ctx, JAW_PTS, 0.9); }

function drawEar(ctx, r, far) {
  const P = r.c.pal;
  SV(ctx);
  const yp = r.front ? 0 : r.yawP || 0;   // headTurn in-between: the far ear comes round
  const bx = EAR_BASE[0] + (far ? 13 + 24 * yp : 0), by = EAR_BASE[1] + (far ? -4 - 7 * yp : 0);
  ctx.translate(bx, by);
  ctx.rotate(-0.3 + r.earA * (far ? 0.7 : 1));
  const rx = far ? 8 : 9.4, ry = far ? 9.2 : 10.8;
  ctx.translate(-4, -ry * 0.62);
  ellipse(ctx, 0, 0, rx, ry);
  ctx.fillStyle = far ? P.far : mix(P.base, P.dark, 0.25);
  ctx.fill();
  ctx.strokeStyle = P.line;
  ctx.lineWidth = (2.1) * LWK;
  ctx.stroke();
  if (!far) {
    ellipse(ctx, 1.6, 1.6, rx * 0.56, ry * 0.6);
    ctx.fillStyle = P.earIn;
    ctx.fill();
    ellipse(ctx, -3, -4, 2.3, 3.3, -0.3);
    ctx.fillStyle = rgba('#FFF2DC', 0.32);
    ctx.fill();
  }
  RS(ctx);
}

function drawMouthInterior(ctx, r) {
  const open = r.jawA;
  if (open < 0.015) return;
  const top = JAW_TOP.map((p) => rotAbout(p, HINGE, open));
  SV(ctx);
  ctx.beginPath();
  ctx.moveTo(LIP[0][0], LIP[0][1]);
  for (const p of LIP) ctx.lineTo(p[0], p[1]);
  ctx.lineTo(97, 9);
  ctx.lineTo(top[0][0] + 2, top[0][1] + 1);
  for (const p of top) ctx.lineTo(p[0], p[1]);
  ctx.closePath();
  ctx.fillStyle = tc('#4A1C22');
  ctx.fill();
  ctx.clip();
  const tg = rotAbout([76, 18], HINGE, open * 0.9);
  ellipse(ctx, tg[0], tg[1], 18, 7, open * 0.85);
  ctx.fillStyle = tc('#D9716F');
  ctx.fill();
  ellipse(ctx, tg[0] + 4, tg[1] - 2.5, 8, 2, open * 0.85);
  ctx.fillStyle = 'rgba(255,205,195,0.4)';
  ctx.fill();
  const g = ctx.createLinearGradient(46, 0, 72, 0);
  g.addColorStop(0, 'rgba(25,8,10,0.8)');
  g.addColorStop(1, 'rgba(25,8,10,0)');
  ctx.fillStyle = g;
  ctx.fillRect(36, -10, 40, 60);
  RS(ctx);
}

function drawTeeth(ctx, r, minVis) {
  const P = r.c.pal;
  const vis = Math.max(clamp(r.jawA / (14 * D2R)), minVis || 0);
  if (vis < 0.05) return;
  const L = 3 + 8 * vis;
  SV(ctx);
  ctx.lineWidth = (1.2) * LWK;
  ctx.strokeStyle = mix(P.line, tc('#8A8070'), 0.35);
  U.roundRect(ctx, 83.6, 7.4, 5.4, L, 1.7);
  ctx.fillStyle = tc('#E6DECD');
  ctx.fill();
  ctx.stroke();
  U.roundRect(ctx, 88.4, 6.8, 6, L + 0.6, 1.9);
  ctx.fillStyle = tc('#FFFDF6');
  ctx.fill();
  ctx.stroke();
  RS(ctx);
}

function drawJaw(ctx, r) {
  const P = r.c.pal;
  SV(ctx);
  ctx.translate(HINGE[0], HINGE[1]);
  ctx.rotate(r.jawA);
  ctx.translate(-HINGE[0], -HINGE[1]);
  paintShape(ctx, () => jawPath(ctx), {
    top: mix(P.base, P.belly, 0.35), bottom: mix(P.base, P.dark, 0.2), y0: 10, y1: 27, hi: mix(P.belly, '#FFFFFF', 0.2), rim: [0, 1.4],
    shadow: null, line: P.line, lw: 2.1,
  });
  RS(ctx);
}

// mouth line under the snout with a mood-shaped corner (continuous in every mood parameter,
// so blended moods morph smoothly)
function drawMouthLine(ctx, r) {
  const P = r.c.pal, m = r.m;
  const lod = r.lod || 0;
  const openK = clamp(r.jawA / (10 * D2R));
  const smile = clamp((m.mouth || 0) * (1 + 0.7 * lod), -1.5, 1.6);
  const flat = clamp(m.flat || 0), sly = clamp(m.sly || 0);
  const wav = clamp(m.wavy || 0) * (1 - clamp(openK * 2));
  const F = [94, 8.6], C = [58, 17.5];
  const L = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
  const fr = Math.max(0, -smile) * (1 - flat);
  // main line F → C as two cubic segments: straight ↔ wavy, with a slight arch for frowns
  const s1 = [L([89, 9.6], [87, 11.8], wav), L([82.5, 10.575], [81, 8.6], wav), L([76, 11.925], [74, 12.8], wav)];
  const s2 = [L([69.5, 13.275], [67, 16.6], wav), L([63, 15 - 2.5 * fr], [63, 13.6 - 2 * fr], wav), C];
  // corner: smile / frown / flat
  let cp1, cp2, end;
  if (smile >= 0) {
    const k = smile * (1 + 0.25 * sly);
    end = [C[0] - 10 - k * 3 - 5 * lod, C[1] - 2 - k * 11];
    cp1 = [C[0] - 5, C[1] + 0.5];
    cp2 = [end[0] + 1 + k, end[1] + 6 + k * 3];
  } else {
    const k = -smile;
    end = [C[0] - 9 + k - 4 * lod, Math.min(21.6 + 3 * lod, C[1] + 2.5 + 5 * k)];
    cp1 = [C[0] - 4, C[1] + 0.3];
    cp2 = [C[0] - 8, C[1] + 0.8 + 1.5 * k];
  }
  if (flat > 0) {
    end = L(end, [C[0] - 11 - 6 * lod, C[1] + 0.6], flat);
    cp1 = L(cp1, [C[0] - 4, C[1] + 0.2], flat);
    cp2 = L(cp2, [C[0] - 8, C[1] + 0.5], flat);
  }
  SV(ctx);
  ctx.strokeStyle = P.line;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = (2.8 + 1.6 * lod) * LWK;
  ctx.beginPath();
  ctx.moveTo(F[0], F[1]);
  ctx.bezierCurveTo(s1[0][0], s1[0][1], s1[1][0], s1[1][1], s1[2][0], s1[2][1]);
  ctx.bezierCurveTo(s2[0][0], s2[0][1], s2[1][0], s2[1][1], s2[2][0], s2[2][1]);
  ctx.bezierCurveTo(cp1[0], cp1[1], cp2[0], cp2[1], end[0], end[1]);
  ctx.stroke();
  // smile: cheek crease pushed up by the grin
  const ck = clamp((smile - 0.35) / 0.35) * (1 - flat);
  if (ck > 0.01) {
    ctx.lineWidth = (2 + 0.8 * lod) * LWK;
    ctx.strokeStyle = rgba(P.line, 0.6 * ck);
    ctx.beginPath();
    ctx.arc(end[0] - 2.5, end[1] + 3, 5.5, -1.75, -0.35);
    ctx.stroke();
  }
  RS(ctx);
}

function drawUpperHead(ctx, r) {
  const P = r.c.pal;
  paintShape(ctx, () => headPath(ctx, r), {
    top: P.top, bottom: mix(P.base, P.dark, 0.32), y0: -58, y1: 31, hi: P.hi, rim: [1.2, 4],
    shadow: P.low, shadowY0: 4, shadowY1: 33, shadowA: 0.5, line: P.line, lw: 2.4,
    extra: () => {
      // nose pad: darker bare skin over the top-front of the snout
      SV(ctx);
      ctx.beginPath();
      ctx.moveTo(84, -56);
      ctx.bezierCurveTo(86, -40, 92, -26, 112, -22);
      ctx.lineTo(112, -60);
      ctx.closePath();
      const ng = ctx.createLinearGradient(84, -50, 106, -30);
      ng.addColorStop(0, rgba(P.muzzle, 0.55));
      ng.addColorStop(1, rgba(P.muzzle, 0.95));
      ctx.fillStyle = ng;
      ctx.fill();
      RS(ctx);
      // headTurn in-between: the front of the nose pad and the far nostril come round
      const yp = r.front ? 0 : r.yawP || 0;
      if (yp > 0.02) {
        ellipse(ctx, 104.5, -33, 3 + 7 * yp, 11 + 2 * yp, 0.1);
        ctx.fillStyle = rgba(shade(P.muzzle, -0.1), 0.85 * smoothstep(0, 0.5, yp));
        ctx.fill();
        ellipse(ctx, 104 + 2 * yp, -32, 1.2 + 1.6 * yp, 2.4 * yp + 0.4, 0.3);
        ctx.fillStyle = rgba(shade(P.muzzle, -0.6), smoothstep(0.15, 0.6, yp));
        ctx.fill();
      }
      // muzzle shading on the front face
      const mg = ctx.createLinearGradient(80, 0, 106, 0);
      mg.addColorStop(0, rgba(P.muzzle, 0));
      mg.addColorStop(1, rgba(P.muzzle, 0.35));
      ctx.fillStyle = mg;
      ctx.fillRect(76, -22, 34, 36);
      // snout-top sheen
      ellipse(ctx, 66, -49, 20, 3.6, 0.16);
      ctx.fillStyle = rgba('#FFF4E0', 0.2);
      ctx.fill();
      ellipse(ctx, 95, -45, 5, 2, 0.5);
      ctx.fillStyle = rgba('#FFF4E0', 0.28);
      ctx.fill();
      // cheek volume
      const cg = ctx.createRadialGradient(34, 6, 2, 34, 6, 28);
      cg.addColorStop(0, rgba(P.belly, 0.4));
      cg.addColorStop(1, rgba(P.belly, 0));
      ctx.fillStyle = cg;
      ctx.fillRect(4, -22, 60, 56);
      const bl = Math.max(r.c.blush, r.m.blush || 0);
      if (bl > 0) {
        const bg = ctx.createRadialGradient(52, -6, 1, 52, -6, 15);
        bg.addColorStop(0, rgba('#F27868', 0.5 * bl));
        bg.addColorStop(1, rgba('#F27868', 0));
        ctx.fillStyle = bg;
        ctx.fillRect(34, -24, 36, 36);
      }
      // cheek (masseter) contour
      ctx.strokeStyle = rgba(P.dark, 0.55);
      ctx.lineWidth = (1.9) * LWK;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(12, -8);
      ctx.bezierCurveTo(12, 10, 26, 21, 44, 20);
      ctx.stroke();
      flicks(ctx, [[-11, -30, 10, 1.9, 2.2], [-5, -36, 9, 1.85, 2], [62, -50, 7, 1.75, 1.8], [68, -49, 6, 1.7, 1.6], [20, 6, 9, 1.9, 2]], P.fur);
    },
  });
  // nostril
  SV(ctx);
  ctx.strokeStyle = shade(P.muzzle, -0.55);
  ctx.lineWidth = (3) * LWK;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(92, -38.5);
  ctx.quadraticCurveTo(97.5, -40.5, 101, -35);
  ctx.stroke();
  // whiskers
  ctx.strokeStyle = rgba(P.line, 0.42);
  ctx.lineWidth = (0.9) * LWK;
  ctx.beginPath();
  ctx.moveTo(100, -12); ctx.quadraticCurveTo(111, -15, 120, -13);
  ctx.moveTo(101, -7); ctx.quadraticCurveTo(112, -6, 119, -2);
  ctx.moveTo(99, -2); ctx.quadraticCurveTo(107, 2, 113, 8);
  ctx.stroke();
  RS(ctx);
}

function eyeGeom(r) {
  const m = r.m, c = r.c;
  const glasses = !!r.acc.glasses;
  const es = (m.eyeS || 1) * (glasses ? 1.04 : 1) * (c.eyeSize || 1);
  return { x: c.eye[0], y: c.eye[1], rx: 12.2 * es, ry: 13.4 * es, es, glasses, lensR: c.lensR };
}
// fur colour behind the eye (matches the head's base gradient) — closed lids blend into it
function furAt(r, y) {
  const P = r.c.pal;
  return mix(P.top, mix(P.base, P.dark, 0.32), clamp((y - 4 + 58) / 89));
}
// eyelid curves. Upper lid edge: quadratic (x−W, yA) → ctrl (x, yC) → (x+W, yB).
// lid 0..~0.62 lowers the upper lid; beyond that the closing lower lid (parallel to the upper
// one) rises to meet it and the lash line morphs into the mood's closed shape (◡ relaxed /
// ︵ happy) a little below the centre. The mood's own lower lid (low, lowArch: ◠ smiling …
// ◡ relaxed) is limited so the open slit is always ONE smooth lens (never pinched in the
// middle into two slivers). gmax = widest open gap (local units) → narrow slits turn into a
// dark band (no white specks / catchlights in a sliver).
function eyeLids(r, e) {
  const m = r.m;
  const lid = clamp(r.lid);
  const closeK = smoothstep(0.62, 1, lid);
  const low = clamp(m.low || 0) * (1 - r.bl * 0.4);
  const W = e.rx + 3;
  const k = Math.tan((m.lidSlope || 0) * D2R) * (1 - closeK * 0.75);
  const yMeet = e.y + e.ry * 0.3;
  const yl = lerp(e.y - e.ry + 2 * e.ry * Math.min(lid, 0.62), yMeet, closeK);
  const closed = m.closed == null ? 1 : m.closed;
  const bulgeOpen = 2.4 + lid * 1.6 + (m.bulge || 0);
  const bulgeShut = lerp(-7, 4.5, clamp((closed + 1) / 2));
  // happy (︵) eyes take their shut shape early, so a blink never pinches the slit
  const shutK = closed < 0 ? Math.max(closeK, smoothstep(0.2, 0.95, lid) * clamp(-closed)) : closeK;
  const bulge = lerp(bulgeOpen, bulgeShut, shutK);
  const up = { yA: yl + k * W, yB: yl - k * W, yC: yl + bulge };
  // mood lower lid: ym = height at the centre, d = arch (+ = ◠ ends lower than the middle)
  const ym = e.y + e.ry - 2 * e.ry * low;
  const gap = lerp(1.7 * e.ry, 0.6, Math.pow(closeK, 0.85));
  // closing lower lid: widest gap in the middle, converging toward the corners (lens-shaped slit)
  const gE = gap * 0.2;
  const lc = { yA: up.yA + gE, yB: up.yB + gE, yC: up.yC + 2 * gap - gE };
  const at = (c, x) => { const u = clamp((x - (e.x - W)) / (2 * W)); return (1 - u) * (1 - u) * c.yA + 2 * u * (1 - u) * c.yC + u * u * c.yB; };
  const upOn = lid > 0.01, lowOn = low > 0.01, lcOn = closeK > 0.001;
  const ellH = (x) => e.ry * Math.sqrt(Math.max(0, 1 - ((x - e.x) * (x - e.x)) / (e.rx * e.rx)));
  const topAt = (x) => { const t = e.y - ellH(x); return upOn ? Math.max(t, at(up, x)) : t; };
  // the arch is relaxed until the slit is widest in the middle (no pinch → no twin slivers)
  let d = 0.85 * e.ry * (m.lowArch || 0);
  if (lowOn) {
    const prof = (dd) => {
      const L = { yA: ym + dd, yB: ym + dd, yC: ym - dd };
      let gc = 0, gm = -99;
      for (const u of [0, 0.3, -0.3, 0.55, -0.55, 0.78, -0.78]) {
        const x = e.x + u * e.rx;
        const g = Math.min(e.y + ellH(x), at(L, x), lcOn ? at(lc, x) : 99) - topAt(x);
        if (u === 0) gc = g;
        if (g > gm) gm = g;
      }
      return gc >= gm - 1.2 || gm <= 0.5;
    };
    for (let i = 0; i < 10 && !prof(d); i++) d -= 0.25 * e.ry;
  }
  const lo = { yA: ym + d, yB: ym + d, yC: ym - d };
  const lowAt = (x) => Math.min(lowOn ? at(lo, x) : 99, lcOn ? at(lc, x) : 99);
  const botAt = (x) => Math.min(e.y + ellH(x), lowAt(x));
  let gmax = -99, gx = e.x;
  for (let i = 0; i <= 14; i++) {
    const x = e.x + e.rx * (-0.97 + (1.94 * i) / 14);
    const g = botAt(x) - topAt(x);
    if (g > gmax) { gmax = g; gx = x; }
  }
  return { lid, closeK, low, W, up, lo, lc, at, upOn, lowOn, lcOn, topAt, botAt, lowAt, gmax, gx, closed };
}
// region below (side>0) / above (side<0) a lid curve, as a closed path for clipping
function lidRegion(ctx, e, W, c, side) {
  const Y = side > 0 ? e.y + e.ry + 60 : e.y - e.ry - 60;
  ctx.beginPath();
  ctx.moveTo(e.x - W - 6, Y);
  ctx.lineTo(e.x + W + 6, Y);
  ctx.lineTo(e.x + W, c.yB);
  ctx.quadraticCurveTo(e.x, c.yC, e.x - W, c.yA);
  ctx.closePath();
}
// clip to the open part of the eye (ellipse ∩ below the upper lid ∩ above the lower lids)
function clipOpen(ctx, e, Ld, grow = 0) {
  ellipse(ctx, e.x, e.y, e.rx + grow, e.ry + grow);
  ctx.clip();
  if (Ld.upOn) { lidRegion(ctx, e, Ld.W, Ld.up, 1); ctx.clip(); }
  if (Ld.lowOn) { lidRegion(ctx, e, Ld.W, Ld.lo, -1); ctx.clip(); }
  if (Ld.lcOn) { lidRegion(ctx, e, Ld.W, Ld.lc, -1); ctx.clip(); }
}

function drawEye(ctx, r, eo, mirror) {
  const P = r.c.pal, m = r.m, c = r.c;
  const e = eo || eyeGeom(r);
  if (mirror) { SV(ctx); ctx.translate(e.x, 0); ctx.scale(-1, 1); ctx.translate(-e.x, 0); r = { ...r, look: { x: -(r.look.x || 0), y: r.look.y || 0 } }; }
  const lod = r.lod || 0;
  const Ld = eyeLids(r, e);
  const { lid, closeK, low, W, up, lo, lc, gmax } = Ld;
  // narrow slit → one continuous dark band (iris colour), no white specks or catchlight
  const darkK = c.iris ? 1 - smoothstep(4.6, 7.2, gmax) : 1 - smoothstep(1.8, 4.4, gmax);
  const openA = smoothstep(0.05, 0.9, gmax);
  SV(ctx);
  // soft socket shadow, gone once the lids are heavy (no ghost ring around a shut eye)
  const sockA = 0.3 * (1 - smoothstep(0.2, 0.7, lid)) * (1 - closeK);
  if (sockA > 0.01) {
    ellipse(ctx, e.x, e.y + 0.6, e.rx + 2.6, e.ry + 2.6);
    ctx.fillStyle = rgba(P.low, sockA);
    ctx.fill();
  }
  // lid tone: a little darker skin right above the lash line, fading upward
  if (Ld.upOn && closeK < 0.99) {
    SV(ctx);
    ellipse(ctx, e.x, e.y, e.rx, e.ry);
    ctx.clip();
    const yMid = Ld.at(up, e.x);
    const lg = ctx.createLinearGradient(0, yMid, 0, yMid - 6);
    lg.addColorStop(0, rgba(P.dark, 0.2 * (1 - closeK) * smoothstep(0.03, 0.2, lid)));
    lg.addColorStop(1, rgba(P.dark, 0));
    ctx.fillStyle = lg;
    lidRegion(ctx, e, W, up, -1);
    ctx.fill();
    RS(ctx);
  }
  if (gmax > 0.05) {
    SV(ctx);
    clipOpen(ctx, e, Ld);
    const sg = ctx.createLinearGradient(0, e.y - e.ry, 0, e.y + e.ry);
    sg.addColorStop(0, tc('#E4D8CA'));
    sg.addColorStop(0.42, tc('#FFFBF3'));
    sg.addColorStop(1, tc('#FFF6E8'));
    ctx.fillStyle = sg;
    ctx.fillRect(e.x - e.rx, e.y - e.ry, 2 * e.rx, 2 * e.ry);
    // shadow cast by the upper lid onto the eyeball
    if (Ld.upOn) {
      ctx.strokeStyle = 'rgba(90,60,50,0.22)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(e.x + W, up.yB);
      ctx.quadraticCurveTo(e.x, up.yC, e.x - W, up.yA);
      ctx.stroke();
    } else {
      const shg = ctx.createLinearGradient(0, e.y - e.ry, 0, e.y - e.ry + 6);
      shg.addColorStop(0, 'rgba(90,60,50,0.28)');
      shg.addColorStop(1, 'rgba(90,60,50,0)');
      ctx.fillStyle = shg;
      ctx.fillRect(e.x - W, e.y - e.ry, 2 * W, 7);
    }
    // pupil / iris — kept peeking out between the lids
    let pr = c.pupil * (m.pupil || 1);
    if (c.iris) pr = Math.min(pr, e.rx - 2);
    if (lod > 0) pr = lerp(pr, Math.max(pr, c.iris ? 6.8 : 4.8), lod);
    const lx = clamp(r.look.x == null ? 0 : r.look.x, -1, 1), ly = clamp(r.look.y == null ? 0 : r.look.y, -1, 1);
    // squint: in a narrow slit the iris spreads sideways to fill it (no white specks at the
    // corners), the way a squinting eye shows mostly iris
    const sq = c.iris ? 1 - smoothstep(5, 11, gmax) : 0;
    const ppx = lerp(e.x + lx * (e.rx - pr - 1.4), e.x + lx * 2, sq);
    let ppy = e.y + ly * (e.ry - pr - 1.4) + (c.iris ? 1 : 0);
    const lidEdge = Ld.topAt(ppx), lowEdge = Ld.botAt(ppx);
    // gazing into a lid keeps ~half the pupil visible (a clear eye-roll), else ≥ 2/3
    const keepUp = ly < 0 ? lerp(0.35, 0.02, -ly) : 0.35, keepLo = ly > 0 ? lerp(0.35, 0.05, ly) : 0.35;
    const hiLim = lowEdge - pr * keepLo, loLim = lidEdge + pr * keepUp;
    if (hiLim >= loLim) ppy = clamp(ppy, loLim, hiLim);
    else ppy = (lidEdge + lowEdge) / 2;
    if (c.iris) {
      SV(ctx);
      ctx.translate(ppx, ppy);
      ctx.scale(1 + 1.4 * sq, 1);
      circle(ctx, 0, 0, pr);
      const ig = ctx.createRadialGradient(0, pr * 0.35, 0.5, 0, 0, pr);
      ig.addColorStop(0, tc('#7A4A2A'));
      ig.addColorStop(1, '#2A150D');
      ctx.fillStyle = ig;
      ctx.fill();
      RS(ctx);
      circle(ctx, ppx, ppy, pr * 0.56);
      ctx.fillStyle = '#100705';
      ctx.fill();
    } else {
      circle(ctx, ppx, ppy, pr);
      ctx.fillStyle = '#130906';
      ctx.fill();
    }
    // dark slit
    if (darkK > 0.001) {
      ctx.fillStyle = rgba(c.iris ? '#2A150D' : '#1E100B', darkK);
      ctx.fillRect(e.x - e.rx, e.y - e.ry, 2 * e.rx, 2 * e.ry);
    }
    // catchlight (not on tiny pupils — a speck beside a dot reads as a "c")
    const cl = (1 - darkK) * smoothstep(2.0, 3.0, pr) * smoothstep(4.5, 8, gmax);
    if (cl > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${cl})`;
      const hy = Math.max(ppy - pr * 0.4, Ld.topAt(ppx + pr * 0.36) + 1.4);
      circle(ctx, ppx + pr * 0.36, hy, Math.max(1.1, pr * 0.34));
      ctx.fill();
      if (c.iris) { circle(ctx, ppx - pr * 0.4, ppy + pr * 0.38, pr * 0.13); ctx.fill(); }
    }
    RS(ctx);
  }
  // eye outline: crisp around the open part; only a faint trace over the lids, fading to nothing
  ctx.lineWidth = (1.8 + 0.6 * lod) * LWK;
  const eyePath = () => ellipse(ctx, e.x, e.y, e.rx, e.ry);
  const visA = openA * (1 - 0.7 * darkK) * smoothstep(3, 8, gmax);
  if (visA > 0.01) {
    SV(ctx);
    if (Ld.upOn) { lidRegion(ctx, e, W, up, 1); ctx.clip(); }
    if (Ld.lowOn) { lidRegion(ctx, e, W, { yA: lo.yA + 0.8, yB: lo.yB + 0.8, yC: lo.yC + 0.8 }, -1); ctx.clip(); }
    if (Ld.lcOn) { lidRegion(ctx, e, W, { yA: lc.yA + 0.8, yB: lc.yB + 0.8, yC: lc.yC + 0.8 }, -1); ctx.clip(); }
    eyePath();
    ctx.strokeStyle = rgba(P.line, visA);
    ctx.stroke();
    RS(ctx);
  }
  const topA = 0.5 * (1 - smoothstep(0.08, 0.42, lid));
  if (Ld.upOn && topA > 0.01) {
    SV(ctx);
    lidRegion(ctx, e, W, up, -1);
    ctx.clip();
    eyePath();
    ctx.strokeStyle = rgba(P.line, topA);
    ctx.stroke();
    RS(ctx);
  }
  const lowA = 0.28 * (1 - closeK) * (1 - smoothstep(0.1, 0.5, lid));
  if (Ld.lowOn && lowA > 0.01) {
    SV(ctx);
    lidRegion(ctx, e, W, lo, 1);
    ctx.clip();
    eyePath();
    ctx.strokeStyle = rgba(P.line, lowA);
    ctx.stroke();
    RS(ctx);
  }
  // happy: cheek pushed up under a ◠ lower lid (soft light crescent + crease)
  const ck = clamp(m.cheek || 0) * (Ld.lowOn ? 1 : 0) * (Ld.closed < 0 ? 1 - 0.55 * closeK : 1 - closeK);
  if (ck > 0.02) {
    SV(ctx);
    ellipse(ctx, e.x, e.y + 1, e.rx + 1, e.ry + 3);
    ctx.clip();
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(mix(P.belly, '#FFF6E6', 0.5), 0.5 * ck);
    ctx.lineWidth = 3 * LWK;
    ctx.beginPath();
    ctx.moveTo(e.x + W, lo.yB + 3.4);
    ctx.quadraticCurveTo(e.x, lo.yC + 3.4, e.x - W, lo.yA + 3.4);
    ctx.stroke();
    RS(ctx);
  }
  // lash line: a tapered crescent along the upper lid (thick in the middle)
  ctx.lineCap = 'round';
  if (Ld.upOn) {
    SV(ctx);
    ellipse(ctx, e.x, e.y, e.rx + 1.6 + closeK * 1.5, e.ry + 1.6 + closeK * 1.5);
    ctx.clip();
    const th = (1.75 + 0.25 * closeK + 0.7 * lod) * LWK;
    ctx.beginPath();
    ctx.moveTo(e.x + W, up.yB);
    ctx.quadraticCurveTo(e.x, up.yC - 2 * th, e.x - W, up.yA);
    ctx.quadraticCurveTo(e.x, up.yC + 0.5, e.x + W, up.yB);
    ctx.closePath();
    ctx.fillStyle = P.line;
    ctx.fill();
    ctx.strokeStyle = P.line;
    ctx.lineWidth = 1.3 * LWK;
    ctx.stroke();
    RS(ctx);
  }
  // lower lid line(s), fading as the slit narrows / shuts
  const loA = (1 - closeK) * (1 - darkK) * openA;
  if (loA > 0.01 && (Ld.lowOn || closeK > 0.2)) {
    SV(ctx);
    ellipse(ctx, e.x, e.y, e.rx + 1.2, e.ry + 1.2);
    ctx.clip();
    ctx.lineWidth = (1.7 + 0.4 * lod) * LWK;
    ctx.strokeStyle = rgba(P.line, loA);
    ctx.beginPath();
    if (Ld.lowOn) { ctx.moveTo(e.x + W, lo.yB); ctx.quadraticCurveTo(e.x, lo.yC, e.x - W, lo.yA); }
    if (closeK > 0.2) { ctx.moveTo(e.x + W, lc.yB); ctx.quadraticCurveTo(e.x, lc.yC, e.x - W, lc.yA); }
    ctx.stroke();
    RS(ctx);
  }
  // lashes (Doreen): three flicks fanning back from the back end of the lash line; on a
  // relaxed shut eye they swing down to hang from it. Everyone else gets two tiny lashes
  // hanging from a fully shut relaxed eye.
  const flick = (list) => {
    ctx.beginPath();
    for (const [bx, by, len, ang] of list) {
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + Math.cos(ang) * len * 0.6, by + Math.sin(ang) * len * 0.6 - 1, bx + Math.cos(ang) * len, by + Math.sin(ang) * len);
    }
    ctx.stroke();
  };
  const hang = Ld.closed >= 0 ? smoothstep(0.35, 0.9, closeK) : 0;
  if (c.lashes) {
    ctx.strokeStyle = P.line;
    ctx.lineWidth = (2) * LWK;
    const pts = [[-0.97, 7, -2.6], [-0.86, 6.5, -2.25], [-0.7, 5.5, -1.95]].map(([u, len, ang]) => {
      const bx = e.x + u * e.rx;
      const by = Ld.topAt(bx) + 0.6;
      return [bx, by, len * (1 - 0.15 * hang), lerp(ang, -TAU - ang + 0.15, hang)];
    });
    flick(pts);
  } else if (hang > 0.01 && gmax < 1) {
    SV(ctx);
    ctx.globalAlpha = hang * (1 - smoothstep(0, 1, gmax));
    ctx.strokeStyle = P.line;
    ctx.lineWidth = (1.6) * LWK;
    flick([[e.x - e.rx * 0.55, Ld.at(up, e.x - e.rx * 0.55) + 0.5, 3.6, 1.9], [e.x - e.rx * 0.15, Ld.at(up, e.x - e.rx * 0.15) + 0.8, 3.2, 1.7]]);
    RS(ctx);
  }
  RS(ctx);
  if (mirror) RS(ctx);
}

// Brows. With glasses they sit ON the top of the frame rim (Woody Allen) and are drawn before
// the frames so the rim tucks under them. Every brow is clamped to stay ≥ 4.5 units inside the
// skull outline at any lift / tilt (so it never merges with the outline, pokes out, or hides
// under a perched vulture).
function drawBrow(ctx, r, eo, mirror, topFn) {
  const P = r.c.pal, m = r.m;
  const e = eo || eyeGeom(r);
  const lod = r.lod || 0;
  const askew = clamp(m.askew || 0);
  const onFrames = e.glasses && askew < 0.5;
  const browY = m.browY || 0;
  const bt = r.c.browTh || 1;
  let by = onFrames ? e.y - (e.lensR || LENS_R) - 5.6 - browY * 0.5 - 2.5 * lod : e.y - e.ry - 6 - browY;
  const bx = e.x + 1.5;
  const tilt = (m.browTilt || 0) * D2R * (1 + 0.8 * lod);
  const half = 13.5 * (e.bw || 1) * (1 + 0.1 * lod) * (0.85 + 0.15 * bt), arch = (m.arch || 0) * 6 * (1 + 0.5 * lod), th = 3.1 * bt * (1 + 0.5 * lod);
  const top = topFn || r.geo.topY;
  const co = Math.cos(-tilt), si = Math.sin(-tilt);
  let push = -1e9;
  for (const u of [0, 0.25, 0.5, 0.75, 1]) {
    const lx = lerp(-half, half, u);
    const ly = (1 - u) * (1 - u) * 1.5 + 2 * u * (1 - u) * (-arch - th * 1.9);
    const x = bx + lx * co - ly * si, y = by + lx * si + ly * co;
    const hx = mirror ? 2 * e.x - x : x;
    push = Math.max(push, top(hx) + 4.5 - y);
  }
  if (push > 0) by += push;
  if (mirror) { SV(ctx); ctx.translate(e.x, 0); ctx.scale(-1, 1); ctx.translate(-e.x, 0); }
  SV(ctx);
  ctx.translate(bx, by);
  ctx.rotate(-tilt);
  // tapered crescent: thick in the middle, pointed ends
  ctx.beginPath();
  ctx.moveTo(-half, 1.5);
  ctx.quadraticCurveTo(0, -arch - th * 1.9, half, 0);
  ctx.quadraticCurveTo(half + 1.2, 1.6, half - 1.4, 2.4);
  ctx.quadraticCurveTo(0, -arch + th * 1.3, -half + 0.8, 4.2);
  ctx.quadraticCurveTo(-half - 2, 3.4, -half, 1.5);
  ctx.closePath();
  ctx.fillStyle = P.brow;
  ctx.fill();
  ctx.strokeStyle = rgba(shade(P.brow, -0.35), 0.8);
  ctx.lineWidth = (0.9) * LWK;
  ctx.stroke();
  // soft highlight along the top: reads as fur, not as part of the outline
  ctx.strokeStyle = P.browHi;
  ctx.lineWidth = (1.1) * LWK;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-half * 0.55, 0.2 - arch * 0.55 - th * 0.75);
  ctx.quadraticCurveTo(0, -arch - th * 1.25, half * 0.5, -arch * 0.45 - th * 0.55);
  ctx.stroke();
  RS(ctx);
  if (mirror) RS(ctx);
}

// how much higher the skull top is at x than the stock head (Barry's dome); 0 in 3/4 view
function domeDy(r, x) { return r.front || !r.geo.dome ? 0 : r.geo.topY(x) - headGeo(0).topY(x); }

// Barry's frazzled crown tuft. The locks grow out of the fur: their roots sink below the skull
// line, filled with the crown's own fur colour fading into a darker root tone and then the lock
// colour, and only the two side edges are inked (open paths fading in above the root) — no base
// line. Two loose wisps curl off it.
function drawTuft(ctx, r) {
  const P = r.c.pal, t = r.t;
  const up = r.m.tuftUp || 0;
  SV(ctx);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const locks = [[6, -52, -13, -10, 5.6], [12, -54.5, -6, -15, 6.2], [18.5, -56, 2, -16, 6.2], [25, -56.8, 9, -13, 5.6]];
  const rootFur = mix(P.top, P.base, 0.15);
  locks.forEach(([x, y0, dx, dy, w], i) => {
    const y = y0 + domeDy(r, x) + 1;        // skull line here
    const yb = y + 5;                        // root, sunk under the skull line
    const wob = noise1(t * 1.1 + i * 3.7 + r.seed) * 1.6 + (up ? noise1(t * 9 + i * 5) * 1.5 * up : 0);
    const ex = x + lerp(dx, dx * 0.3, up) + wob, ey = y + lerp(dy, -21, up);
    const curl = (i % 2 ? 1 : -1) * 4 * (1 - up);
    const L0 = [x - w * 0.62, yb], R0 = [x + w * 0.62, yb];
    const c1 = [x - w * 0.6 + dx * 0.15, y + dy * 0.45], c2 = [ex - curl - 3, ey + 6];
    const c3 = [ex + curl * 0.6, ey + 5], c4 = [x + w * 0.5 + dx * 0.2, y + dy * 0.35];
    ctx.beginPath();
    ctx.moveTo(L0[0], L0[1]);
    ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], ex, ey);
    ctx.bezierCurveTo(c3[0], c3[1], c4[0], c4[1], R0[0], R0[1]);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, yb, 0, ey);
    const tipC = i % 2 ? P.tuft : mix(P.tuft, P.base, 0.35);
    g.addColorStop(0, rootFur);
    g.addColorStop(clamp(4 / Math.max(6, yb - ey)), mix(P.tuft, P.dark, 0.35));
    g.addColorStop(1, mix(tipC, P.top, 0.25));
    ctx.fillStyle = g;
    ctx.fill();
    // inked side edges only (open), fading in above the root
    const lg = ctx.createLinearGradient(0, yb, 0, y - 4);
    lg.addColorStop(0, rgba(P.line, 0));
    lg.addColorStop(1, P.line);
    ctx.strokeStyle = lg;
    ctx.lineWidth = (1.6) * LWK;
    ctx.beginPath();
    ctx.moveTo(L0[0], L0[1]);
    ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], ex, ey);
    ctx.bezierCurveTo(c3[0], c3[1], c4[0], c4[1], R0[0], R0[1]);
    ctx.stroke();
    // a light strand down the lock
    ctx.strokeStyle = rgba(P.hi, 0.35);
    ctx.lineWidth = (1) * LWK;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.1, y - 1);
    ctx.quadraticCurveTo(lerp(x, ex, 0.45) - curl * 0.3, lerp(y, ey, 0.5), lerp(x, ex, 0.8), lerp(y, ey, 0.8));
    ctx.stroke();
  });
  // loose wisps
  const wb = noise1(t * 1.3 + r.seed * 2) * 1.2;
  const yA = -50 + domeDy(r, 2), yB = -58 + domeDy(r, 30);
  ctx.strokeStyle = P.line;
  ctx.lineWidth = (1.1) * LWK;
  ctx.beginPath();
  ctx.moveTo(3, yA + 1);
  ctx.bezierCurveTo(-3, yA - 8 - 4 * up, -12 + wb, yA - 7 - 6 * up, -11 + wb, yA - 13 - 8 * up);
  ctx.moveTo(29, yB + 2);
  ctx.bezierCurveTo(33, yB - 6 - 4 * up, 37 + wb, yB - 7 - 6 * up, 35 + wb, yB - 12 - 8 * up);
  ctx.stroke();
  RS(ctx);
}

// 'shock' knocks the frames askew: tipped ~18° (temple end up, off the ear) and slid ~5 units
// down the snout, so the popped eye bulges out over the top of the rim
function glassesXform(ctx, r, cx, cy) {
  const k = clamp(r.m.askew || 0);
  if (k < 0.01) return;
  ctx.translate(cx + 3 * k, cy + 5.5 * k);
  ctx.rotate(0.31 * k);
  ctx.translate(-cx, -cy);
}

function lensFill(ctx, cx, cy, rx, ry, fog, lod) {
  ellipse(ctx, cx, cy, rx, ry);
  ctx.fillStyle = tca('#D4ECFF', (0.14 + fog * 0.75) * (1 - 0.6 * lod));
  ctx.fill();
  if (lod > 0.01) {
    // small sizes: a lighter lens keeps the eye from merging with the rim into a dark disc
    ctx.fillStyle = tca('#FFF6E8', 0.22 * lod);
    ctx.fill();
  }
  SV(ctx);
  ctx.clip();
  const gl = 1 - lod * 0.85;
  ctx.fillStyle = tca('#FFFFFF', 0.42 * gl);
  ctx.beginPath();
  ctx.moveTo(cx + rx * 0.18, cy - ry); ctx.lineTo(cx + rx * 0.62, cy - ry); ctx.lineTo(cx + rx, cy - ry * 0.5); ctx.lineTo(cx + rx, cy - ry * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = tca('#FFFFFF', 0.25 * gl);
  ctx.beginPath();
  ctx.moveTo(cx - rx * 0.95, cy + ry * 0.25); ctx.lineTo(cx - rx * 0.75, cy + ry * 0.05); ctx.lineTo(cx - rx * 0.2, cy + ry); ctx.lineTo(cx - rx * 0.55, cy + ry);
  ctx.closePath();
  ctx.fill();
  if (fog > 0) {
    ctx.fillStyle = tca('#F2F7FA', fog * 0.88);
    ctx.fillRect(cx - rx, cy - ry, 2 * rx, 2 * ry);
  }
  RS(ctx);
}
function lensRim(ctx, cx, cy, rx, ry, lod) {
  const gl = 1 - lod * 0.85;
  ellipse(ctx, cx, cy, rx, ry);
  ctx.strokeStyle = '#16131A';
  ctx.lineWidth = (5.4 - 1.5 * lod) * LWK;
  ctx.stroke();
  ctx.strokeStyle = tca('#FFFFFF', 0.35 * gl);
  ctx.lineWidth = (1.4) * LWK;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + 0.4, ry + 0.4, 0, -2.7, -1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - 0.2, ry - 0.2, 0, 0.5, 0.9);
  ctx.stroke();
}

function drawGlasses(ctx, r) {
  const e = eyeGeom(r);
  const fog = r.acc.fog;
  const lod = r.lod || 0;
  const R = e.lensR, cx = e.x + 0.5, cy = e.y - 0.5;
  SV(ctx);
  glassesXform(ctx, r, cx, cy);
  const FR = '#16131A';
  ctx.strokeStyle = FR;
  ctx.lineCap = 'round';
  // temple arm back to the ear
  ctx.lineWidth = (3.6 - 0.6 * lod) * LWK;
  ctx.beginPath();
  ctx.moveTo(cx - R + 1, cy - 5);
  ctx.quadraticCurveTo(cx - R - 6, cy - 9, EAR_BASE[0] + 1, EAR_BASE[1] + 3);
  ctx.stroke();
  // bridge: a short stub forward along the side of the snout (it wraps over the far side),
  // ending in a little nose pad — never rising above the lens
  ctx.lineWidth = (4) * LWK;
  ctx.beginPath();
  ctx.moveTo(cx + R - 1.5, cy - 5.5);
  ctx.quadraticCurveTo(cx + R + 3, cy - 6.5, cx + R + 5.5, cy - 5);
  ctx.stroke();
  ellipse(ctx, cx + R + 5.6, cy - 3.6, 1.9, 2.4, 0.3);
  ctx.fillStyle = FR;
  ctx.fill();
  lensFill(ctx, cx, cy, R, R, fog, lod);
  lensRim(ctx, cx, cy, R, R, lod);
  RS(ctx);
}

// ─────────────────────────────────────────────────────────────── accessories
function drawOrange(ctx, x, y, R, t, seed) {
  SV(ctx);
  circle(ctx, x, y, R);
  const g = ctx.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R * 1.05);
  g.addColorStop(0, tc('#FFC867'));
  g.addColorStop(0.45, tc('#FF9A1F'));
  g.addColorStop(1, tc('#E06F0C'));
  ctx.fillStyle = g;
  ctx.fill();
  SV(ctx);
  ctx.clip();
  const rr = U.rng(7 + (seed || 0));
  ctx.fillStyle = 'rgba(190,85,10,0.32)';
  for (let i = 0; i < 18; i++) {
    const a = rr() * TAU, d = Math.sqrt(rr()) * R * 0.92;
    circle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, R * 0.045);
    ctx.fill();
  }
  // bounce light from below + shadow side
  const sg = ctx.createLinearGradient(x - R, y - R, x + R * 0.6, y + R);
  sg.addColorStop(0.5, 'rgba(170,60,0,0)');
  sg.addColorStop(1, 'rgba(170,60,0,0.32)');
  ctx.fillStyle = sg;
  ctx.fillRect(x - R, y - R, 2 * R, 2 * R);
  RS(ctx);
  if (RIMC) {
    // scene rim light: a crescent along the top-left edge in the rim colour
    SV(ctx);
    circle(ctx, x, y, R);
    ctx.clip();
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.arc(x + R * 0.12, y + R * 0.16, R * 1.02, 0, TAU, true);
    ctx.fillStyle = rgba(RIMC, 0.6);
    ctx.fill();
    RS(ctx);
  }
  ellipse(ctx, x - R * 0.38, y - R * 0.42, R * 0.3, R * 0.17, -0.6);
  ctx.fillStyle = 'rgba(255,250,230,0.78)';
  ctx.fill();
  circle(ctx, x - R * 0.06, y - R * 0.64, R * 0.065);
  ctx.fill();
  circle(ctx, x, y, R);
  ctx.strokeStyle = tc('#B85A0A');
  ctx.lineWidth = (1.8) * LWK;
  ctx.stroke();
  // stem + leaf
  ctx.fillStyle = tc('#6B5A2A');
  circle(ctx, x + R * 0.05, y - R * 0.97, R * 0.1);
  ctx.fill();
  SV(ctx);
  ctx.translate(x + R * 0.1, y - R * 0.98);
  ctx.rotate(-0.5 + Math.sin(t * 1.7 + (seed || 0)) * 0.06);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(R * 0.35, -R * 0.58, R * 0.98, -R * 0.36);
  ctx.quadraticCurveTo(R * 0.5, R * 0.12, 0, 0);
  ctx.closePath();
  const lg = ctx.createLinearGradient(0, -R * 0.5, R, 0);
  lg.addColorStop(0, tc('#86CF6C'));
  lg.addColorStop(1, tc('#3E8E44'));
  ctx.fillStyle = lg;
  ctx.fill();
  ctx.strokeStyle = tc('#2F6B35');
  ctx.lineWidth = (1.2) * LWK;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(R * 0.05, -R * 0.03);
  ctx.quadraticCurveTo(R * 0.45, -R * 0.3, R * 0.85, -R * 0.34);
  ctx.strokeStyle = 'rgba(220,255,200,0.6)';
  ctx.lineWidth = (0.9) * LWK;
  ctx.stroke();
  RS(ctx);
  RS(ctx);
}

// the squashed orange (base point (x, y + 1)): props.drawOrange's squashed orange, so the
// splat on the head matches the one the scene shows at impact (drawJuiceSplat) and any loose
// squashed orange; the old rig art below is only a fallback if props can't load.
function drawSquashedOrange(ctx, x, y, R, t = 0, seed = 0) {
  const PL = propsLib();
  if (PL && PL.drawOrange) {
    PL.drawOrange(ctx, { x, y: y + 1 - ORANGE_R, r: ORANGE_R, squash: 1, t, seed, ...lightOpts() });
    return;
  }
  squashedOrangeArt(ctx, x, y, 15);
}
function squashedOrangeArt(ctx, x, y, R) {
  // a flattened, burst orange sitting on the crown with a juicy splash ring
  SV(ctx);
  const rr = U.rng(41);
  const pts = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    const k = i % 2 ? rr.range(0.7, 0.9) : rr.range(1.1, 1.5);
    pts.push([x + Math.cos(a) * R * 1.75 * k, y + 1 + Math.sin(a) * R * 0.36 * k]);
  }
  blob(ctx, pts, 0.7);
  ctx.fillStyle = 'rgba(255,170,50,0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(190,95,10,0.85)';
  ctx.lineWidth = (1.3) * LWK;
  ctx.stroke();
  // squat peel dome
  ctx.beginPath();
  ctx.moveTo(x - R * 1.25, y + 1);
  ctx.bezierCurveTo(x - R * 1.2, y - R * 0.75, x + R * 1.2, y - R * 0.8, x + R * 1.3, y + 1);
  ctx.quadraticCurveTo(x, y + R * 0.3, x - R * 1.25, y + 1);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y - R * 0.7, 0, y + 2);
  g.addColorStop(0, tc('#FFB848'));
  g.addColorStop(1, tc('#E8740E'));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = tc('#B85A0A');
  ctx.lineWidth = (1.6) * LWK;
  ctx.stroke();
  // burst: pale pulp star in the middle
  ctx.beginPath();
  const cx = x + R * 0.05, cy = y - R * 0.38;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU, k = i % 2 ? 0.22 : 0.55;
    const px = cx + Math.cos(a) * R * k * 1.4, py = cy + Math.sin(a) * R * k * 0.45;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = tc('#FFD98A');
  ctx.fill();
  ctx.strokeStyle = tc('#D9771A');
  ctx.lineWidth = (1) * LWK;
  ctx.stroke();
  // bent leaf
  SV(ctx);
  ctx.translate(x + R * 0.9, y - R * 0.35);
  ctx.rotate(0.5);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(R * 0.4, -R * 0.45, R * 0.9, -R * 0.1);
  ctx.quadraticCurveTo(R * 0.45, R * 0.2, 0, 0);
  ctx.fillStyle = tc('#5DA84F');
  ctx.fill();
  ctx.strokeStyle = tc('#2F6B35');
  ctx.lineWidth = (1) * LWK;
  ctx.stroke();
  RS(ctx);
  // flung droplets
  ctx.fillStyle = tc('#FFA42E');
  for (const [dx, dy, s, a] of [[-2.1, -1.1, 0.16, -0.9], [2.0, -1.3, 0.13, 0.8], [2.6, -0.4, 0.1, 1.2], [-2.7, -0.3, 0.1, -1.2], [0.4, -1.8, 0.12, 0.1]]) {
    teardrop(ctx, x + dx * R, y + dy * R, R * s, a);
    ctx.fill();
  }
  ellipse(ctx, x - R * 0.5, y - R * 0.45, R * 0.3, R * 0.08, -0.15);
  ctx.fillStyle = 'rgba(255,250,230,0.85)';
  ctx.fill();
  RS(ctx);
}

function drawJuice(ctx, r, amt) {
  if (amt <= 0.01) return;
  const t = r.t;
  SV(ctx);
  // glossy juice coating hugging the crown
  SV(ctx);
  if (r.front) head34Path(ctx); else headPath(ctx, r);
  ctx.clip();
  const cw = 40 * clamp(amt * 1.4);
  const dd = domeDy(r, 28);
  ellipse(ctx, 28, -58 + dd, cw, 6.5, 0.03);
  ctx.fillStyle = rgba(tc('#FFA235'), 0.75);
  ctx.fill();
  ellipse(ctx, 24, -55.5 + dd, cw * 0.6, 1.3, 0.03);
  ctx.fillStyle = 'rgba(255,245,215,0.7)';
  ctx.fill();
  RS(ctx);
  // rivulets: [x, y0, length, width, bend]
  const drips = [[46, -55, 24, 4.2, 2], [16, -55, 30, 4.6, -1.5], [62, -53, 13, 3.4, 1], [-2, -50, 17, 3.6, -2]];
  drips.forEach(([x, y0, L, w, bend], i) => {
    const y = y0 + domeDy(r, x);
    const len = L * clamp(amt * 1.35 - i * 0.12) * (0.94 + 0.06 * Math.sin(t * 2.3 + i * 1.7));
    if (len < 3) return;
    const ex = x + bend, ey = y + len;
    const R = w * 0.62;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5, y - 3);
    ctx.bezierCurveTo(x - w * 0.42, y + len * 0.35, ex - w * 0.22, ey - len * 0.35, ex - w * 0.2, ey - R * 1.4);
    // fat drop at the end
    ctx.bezierCurveTo(ex - R * 1.1, ey - R * 0.6, ex - R * 1.1, ey + R, ex, ey + R);
    ctx.bezierCurveTo(ex + R * 1.1, ey + R, ex + R * 1.1, ey - R * 0.6, ex + w * 0.2, ey - R * 1.4);
    ctx.bezierCurveTo(ex + w * 0.22, ey - len * 0.35, x + w * 0.42, y + len * 0.35, x + w * 0.5, y - 3);
    ctx.closePath();
    const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
    g.addColorStop(0, tc('#FFBE55'));
    g.addColorStop(1, tc('#F07F12'));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(184,90,10,0.75)';
    ctx.lineWidth = (0.9) * LWK;
    ctx.stroke();
    circle(ctx, ex - R * 0.35, ey - R * 0.05, R * 0.3);
    ctx.fillStyle = 'rgba(255,250,230,0.9)';
    ctx.fill();
  });
  RS(ctx);
}

function drawSweat(ctx, r, amt) {
  amt = clamp(fin(amt));
  if (amt <= 0.02) return;
  const t = r.t;
  const spots = [[58, -54, 0], [-10, -34, 0.37], [76, -50, 0.71], [12, -51, 0.18], [90, -45, 0.55]];
  const n = Math.max(1, Math.round(amt * spots.length));
  SV(ctx);
  for (let i = 0; i < n; i++) {
    const [x, y0, off] = spots[i];
    const y = y0 + domeDy(r, x);
    const cyc = ((t * 0.6 + off) % 1 + 1) % 1;
    const slide = cyc * 13;
    ctx.globalAlpha = cyc < 0.85 ? 1 : 1 - (cyc - 0.85) / 0.15;
    const s = 3.4 + (i % 2) * 0.7;
    teardrop(ctx, x, y + slide, s, 0);
    const g = ctx.createLinearGradient(x - s, 0, x + s, 0);
    g.addColorStop(0, tc('#E8FBFF'));
    g.addColorStop(1, tc('#8FD3F2'));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = tc('#4C9CC6');
    ctx.lineWidth = (1.2) * LWK;
    ctx.stroke();
    circle(ctx, x - s * 0.35, y + slide - s * 0.1, s * 0.28);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
  }
  if (amt > 0.55) {
    for (let i = 0; i < 3; i++) {
      const cyc = ((t * 1.4 + i * 0.33) % 1 + 1) % 1;
      const x = 40 + (i - 1) * 28 + (i - 1) * cyc * 24, y = -64 - Math.sin(cyc * Math.PI) * 18 + cyc * 8;
      ctx.globalAlpha = 1 - cyc;
      teardrop(ctx, x, y, 2.8, (i - 1) * 0.9);
      ctx.fillStyle = tc('#BFEAFF');
      ctx.fill();
      ctx.strokeStyle = tc('#4C9CC6');
      ctx.lineWidth = (1) * LWK;
      ctx.stroke();
    }
  }
  RS(ctx);
}

function sootBlobs(ctx, spots, amt, seed, clipPath) {
  if (amt <= 0.01) return;
  const rr = U.rng(seed);
  SV(ctx);
  clipPath();
  ctx.clip();
  // overall ashy dimming, heavier on top (ash fell from above)
  const tg = ctx.createLinearGradient(0, -90, 0, 50);
  tg.addColorStop(0, rgba(tc('#3A3436'), 0.42 * amt));
  tg.addColorStop(1, rgba(tc('#3A3436'), 0.12 * amt));
  ctx.fillStyle = tg;
  ctx.fillRect(-200, -200, 400, 400);
  for (const [x, y, R] of spots) {
    const g = ctx.createRadialGradient(x, y, R * 0.1, x, y, R * 1.6);
    g.addColorStop(0, rgba(tc('#221B1D'), 0.42 * amt));
    g.addColorStop(1, rgba(tc('#221B1D'), 0));
    ctx.fillStyle = g;
    SV(ctx);
    ctx.translate(x, y);
    ctx.scale(1, 0.65);
    ctx.translate(-x, -y);
    ctx.fillRect(x - R * 1.7, y - R * 1.7, R * 3.4, R * 3.4);
    RS(ctx);
    // a few ash flecks
    ctx.fillStyle = rgba(tc('#B8B0AE'), 0.55 * amt);
    for (let i = 0; i < 3; i++) { circle(ctx, x + rr.range(-R, R), y + rr.range(-R, R) * 0.6, rr.range(0.7, 1.3)); ctx.fill(); }
  }
  RS(ctx);
}
function singed(ctx, x, y, n, amt, seed = 1) {
  // a little clump of frizzled, singed fur standing up
  if (amt <= 0.3) return;
  const rr = U.rng(seed);
  const k = 0.6 + amt * 0.4;
  SV(ctx);
  ctx.beginPath();
  ctx.moveTo(x - n * 3.4, y + 1.5);
  for (let i = 0; i < n * 2; i++) {
    const px = x - n * 3.4 + ((i + 0.5) / (n * 2)) * n * 6.8;
    const h = i % 2 ? rr.range(2, 4) : rr.range(7, 11) * k;
    ctx.lineTo(px + rr.range(-1.5, 1.5), y - h);
  }
  ctx.lineTo(x + n * 3.4, y + 1.5);
  ctx.closePath();
  ctx.fillStyle = rgba(tc('#2A2224'), 0.92 * amt);
  ctx.fill();
  ctx.strokeStyle = rgba(tc('#7E7678'), 0.6 * amt);
  ctx.lineWidth = (0.8) * LWK;
  ctx.stroke();
  RS(ctx);
}

// chin strap (head space, profile). k: 0 = both legs dangling open from the rim (as
// drawCapyHelmet({strap:true}) draws it), 1 = cinched V — one leg in front of the ear, one
// behind it, meeting at a buckle low on the cheek behind the jaw hinge, then under the chin
// (riding on the jaw when talking). dy = extra rim height (helmet lift).
function strapGeom(k, L, jawA, dy = 0) {
  const lp = (a, b) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
  const FA = [15, -55.5 - L + dy], BA = [-4.5, -58 - L + dy];
  const bkD = [5, -31 - L + dy];
  let bk = lp(bkD, [36, 21]);
  if (k > 0) { const jb = rotAbout(bk, HINGE, jawA * 0.6); bk = lp(bk, jb); }
  const front = [FA, lp([12, -47 - L + dy], [21, -30]), lp([8, -38 - L + dy], [27, -4]), bk];
  const back = [BA, lp([-3, -47 - L + dy], [-4, -24]), lp([2, -38 - L + dy], [12, 6]), bk];
  const jf = rotAbout([66, 27.5], HINGE, jawA), jm = rotAbout([50, 27], HINGE, jawA * 0.8);
  const chin = [bk, lp([bkD[0] + 1, bkD[1] + 5], jm), lp([bkD[0] + 2.5, bkD[1] + 9], jf)];
  return { front, back, chin, bk };
}
function strokeStrap(ctx, G) {
  SV(ctx);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = () => {
    ctx.beginPath();
    for (const leg of [G.front, G.back, G.chin]) {
      ctx.moveTo(leg[0][0], leg[0][1]);
      crTo(ctx, leg.map(([x, y]) => ({ x, y })), 1);
    }
  };
  path();
  ctx.strokeStyle = tc('#25252C');
  ctx.lineWidth = (3) * LWK;
  ctx.stroke();
  ctx.strokeStyle = tca('#6A6A78', 0.7);
  ctx.lineWidth = (1) * LWK;
  ctx.stroke();
  // buckle
  const [bx, by] = G.bk;
  U.roundRect(ctx, bx - 4, by - 3.4, 8, 6.8, 1.8);
  ctx.fillStyle = tc('#5A5A66');
  ctx.fill();
  ctx.strokeStyle = tc('#25252C');
  ctx.lineWidth = (1.2) * LWK;
  ctx.stroke();
  U.roundRect(ctx, bx - 2, by - 1.4, 4, 2.8, 0.8);
  ctx.fillStyle = tca('#C8C8D2', 0.7);
  ctx.fill();
  RS(ctx);
}
function drawHelmetStrap(ctx, r) {
  const a = r.acc, hp = helmetPlace(r);
  const k = (a.helmetStrap == null ? 1 : a.helmetStrap) * (1 - smoothstep(0, 0.25, a.helmetLift || 0));
  SV(ctx);
  if (a.helmetLift > 0) { ctx.translate(hp.x, hp.y); ctx.rotate(hp.rot); ctx.translate(-hp.x, -hp.y); }
  strokeStrap(ctx, strapGeom(k, r.geo.helmetLift, r.jawA, hp.y - (-57 - r.geo.helmetLift)));
  RS(ctx);
}
// helmet art in head units; origin = middle of the bottom rim (HELMET_X, -57). soot 0..1 smudges it.
function drawHelmetAt(ctx, hx, hy, soot, rot) {
  SV(ctx);
  ctx.translate(hx, hy);
  if (rot) ctx.rotate(rot);
  ctx.translate(-HELMET_X, 57);
  drawHelmet(ctx, soot || 0);
  RS(ctx);
}
function drawHelmet(ctx, soot = 0) {
  // tiny aero road-bike helmet: pointed tail, long vent slots, little visor
  SV(ctx);
  const shell = () => {
    ctx.beginPath();
    ctx.moveTo(68, -53);
    ctx.bezierCurveTo(71, -66, 56, -81, 34, -81);
    ctx.bezierCurveTo(16, -81, 2, -74, -9, -63);
    ctx.lineTo(-6, -60);
    ctx.bezierCurveTo(-1, -57, 1, -54, 3, -51);
    ctx.bezierCurveTo(24, -58.5, 48, -59, 68, -53);
    ctx.closePath();
  };
  paintShape(ctx, shell, {
    top: tc('#F66B5E'), bottom: tc('#C42E28'), y0: -81, y1: -53, hi: RIMC ? mix(tc('#FFA294'), RIMC, 0.6) : tc('#FFA294'), rim: [1.2, 3], shadow: null, line: tc('#7A1B18'), lw: 1.9,
    extra: () => {
      // long vent slots following the dome
      const vents = [[52, -70, -0.62, 15], [37, -74.5, -0.12, 17], [21, -72.5, 0.3, 16], [8, -67, 0.55, 11]];
      for (const [x, y, a, L] of vents) {
        SV(ctx);
        ctx.translate(x, y);
        ctx.rotate(a);
        U.roundRect(ctx, -L / 2, -2.6, L, 5.2, 2.6);
        ctx.fillStyle = tc('#4E1210');
        ctx.fill();
        U.roundRect(ctx, -L / 2 + 1.5, -2.2, L - 3, 1.4, 0.7);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fill();
        RS(ctx);
      }
      // white side stripe + specular
      ctx.strokeStyle = tc('#FFF4E8');
      ctx.lineWidth = (2.4) * LWK;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-2, -61);
      ctx.bezierCurveTo(16, -63.5, 46, -64.5, 67, -60);
      ctx.stroke();
      ellipse(ctx, 40, -77.5, 10, 2, -0.05);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fill();
      if (soot > 0.01) {
        for (const [x, y, R] of [[20, -66, 13], [50, -72, 10], [62, -58, 8]]) {
          const g = ctx.createRadialGradient(x, y, R * 0.1, x, y, R);
          g.addColorStop(0, rgba(tc('#221B1D'), 0.55 * soot));
          g.addColorStop(1, rgba(tc('#221B1D'), 0));
          ctx.fillStyle = g;
          ctx.fillRect(x - R, y - R, 2 * R, 2 * R);
        }
        ctx.fillStyle = rgba(tc('#3A3436'), 0.25 * soot);
        ctx.fillRect(-20, -90, 100, 40);
      }
    },
  });
  // rim band
  ctx.beginPath();
  ctx.moveTo(3, -51);
  ctx.bezierCurveTo(24, -58.5, 48, -59, 68, -53);
  ctx.strokeStyle = tc('#30303A');
  ctx.lineWidth = (3) * LWK;
  ctx.lineCap = 'round';
  ctx.stroke();
  // visor
  ctx.beginPath();
  ctx.moveTo(64, -59);
  ctx.quadraticCurveTo(75, -59.5, 80, -53);
  ctx.quadraticCurveTo(72, -54.5, 65, -54);
  ctx.closePath();
  ctx.fillStyle = tc('#2A2A32');
  ctx.fill();
  RS(ctx);
}

function drawFlower(ctx, r) {
  const t = r.t;
  SV(ctx);
  ctx.translate(-11, -50);
  ctx.rotate(-0.3 + Math.sin(t * 1.1 + 2) * 0.03);
  ctx.scale(1.08, 1.08);
  for (let i = 0; i < 5; i++) {
    SV(ctx);
    ctx.rotate((i / 5) * TAU);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-7.5, -4, -8.5, -13.5, -2, -15.5);
    ctx.bezierCurveTo(2.5, -17, 7.5, -14, 6.2, -9);
    ctx.bezierCurveTo(6, -5, 3, -2, 0, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, -15);
    g.addColorStop(0, tc('#D93A7A'));
    g.addColorStop(0.4, tc('#FF6FA6'));
    g.addColorStop(1, tc('#FFB4D2'));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = tc('#B02A63');
    ctx.lineWidth = (1.1) * LWK;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(190,30,90,0.45)';
    ctx.beginPath();
    ctx.moveTo(0, -2); ctx.lineTo(0, -10);
    ctx.stroke();
    RS(ctx);
  }
  circle(ctx, 0, 0, 3);
  ctx.fillStyle = tc('#9E1F55');
  ctx.fill();
  ctx.strokeStyle = tc('#E8B23A');
  ctx.lineWidth = (1.5) * LWK;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(6, -3, 11, -9);
  ctx.stroke();
  ctx.fillStyle = tc('#FFD84A');
  for (const [dx, dy] of [[11, -9], [12.6, -7], [9.4, -10.6], [12.2, -10.6]]) { circle(ctx, dx, dy, 1.4); ctx.fill(); }
  RS(ctx);
}

function drawNecklace(ctx, r) {
  SV(ctx);
  apply(ctx, r.B);
  curve(ctx, [[8, -40], [14, -14], [24, 4], [38, 13], [50, 10]], 1);
  ctx.strokeStyle = tc('#6B4B2E');
  ctx.lineWidth = (1.5) * LWK;
  ctx.stroke();
  const shells = [[13.5, -18], [17.5, -5], [24.5, 5], [33, 11], [43.5, 12.6]];
  shells.forEach(([x, y], i) => {
    const R = i % 2 ? 4.4 : 5.2;
    ellipse(ctx, x, y, R, R * 0.8, i * 0.7);
    ctx.fillStyle = i % 3 === 1 ? tc('#F3E6CF') : tc('#FFF8EA');
    ctx.fill();
    ctx.strokeStyle = tc('#9E8266');
    ctx.lineWidth = (1.1) * LWK;
    ctx.stroke();
    circle(ctx, x + 0.5, y + 0.4, 1.2);
    ctx.fillStyle = tc('#8D6E52');
    ctx.fill();
  });
  circle(ctx, 38.5, 12.8, 3);
  ctx.fillStyle = tc('#3FB8B0');
  ctx.fill();
  ctx.strokeStyle = tc('#227A74');
  ctx.lineWidth = (1) * LWK;
  ctx.stroke();
  RS(ctx);
}

// Barry's go-bag, worn: the same bag as props.drawBackpack (teal pack, first-aid flap patch,
// zip pocket, bedroll strapped underneath) ported into the rig so it takes the scene tint,
// standing on the back over the shoulders, held by a chest strap and a girth strap that wrap
// the body (clipped to it). It bounces / lags a little in walk and run.
function bagArt(ctx) {
  const C = { top: tc('#5A9CBE'), bottom: tc('#2C5F7A'), hi: tc('#8CC4DD'), line: tc('#1B3B4D') };
  // body
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-28, -12);
    ctx.bezierCurveTo(-35, -38, -33, -70, -25, -84);
    ctx.quadraticCurveTo(0, -93, 25, -84);
    ctx.bezierCurveTo(33, -70, 35, -38, 28, -12);
    ctx.quadraticCurveTo(0, -6, -28, -12);
    ctx.closePath();
  };
  paintShape(ctx, body, {
    top: C.top, bottom: C.bottom, y0: -90, y1: -8, hi: C.hi, rim: [1.1, 2.3], shadow: null, line: C.line, lw: 1.8,
    extra: () => {
      const sg = ctx.createLinearGradient(-30, 0, 30, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0.08)');
      sg.addColorStop(0.5, 'rgba(0,0,0,0)');
      sg.addColorStop(1, 'rgba(10,30,45,0.28)');
      ctx.fillStyle = sg;
      ctx.fillRect(-40, -100, 80, 100);
      ctx.beginPath();
      ctx.moveTo(-31, -40); ctx.lineTo(-24, -40);
      ctx.moveTo(31, -40); ctx.lineTo(24, -40);
      ctx.strokeStyle = tc('#1F4255');
      ctx.lineWidth = (3) * LWK;
      ctx.stroke();
    },
  });
  // front pocket with zipper
  paintShape(ctx, () => U.roundRect(ctx, -19, -45, 38, 27, 8), {
    top: tc('#4F93B6'), bottom: tc('#2F6683'), y0: -45, y1: -18, hi: tc('#86BCD6'), rim: [0.7, 1.4], shadow: null, line: C.line, lw: 1.4,
    extra: () => {
      ctx.beginPath();
      ctx.moveTo(-15, -40);
      ctx.quadraticCurveTo(0, -42.5, 15, -40);
      ctx.strokeStyle = tc('#173444');
      ctx.lineWidth = (2.2) * LWK;
      ctx.stroke();
      ctx.setLineDash([1.2, 1.4]);
      ctx.strokeStyle = tc('#C8D6DE');
      ctx.lineWidth = (1.4) * LWK;
      ctx.stroke();
      ctx.setLineDash([]);
    },
  });
  ctx.beginPath();
  ctx.moveTo(10, -41);
  ctx.lineTo(12, -34);
  ctx.strokeStyle = tc('#D9B54A');
  ctx.lineWidth = (2.2) * LWK;
  ctx.lineCap = 'round';
  ctx.stroke();
  // flap with the first-aid patch
  const flap = () => {
    ctx.beginPath();
    ctx.moveTo(-25, -85);
    ctx.quadraticCurveTo(0, -95, 25, -85);
    ctx.bezierCurveTo(28, -76, 28, -64, 26, -56);
    ctx.quadraticCurveTo(0, -48, -26, -56);
    ctx.bezierCurveTo(-28, -64, -28, -76, -25, -85);
    ctx.closePath();
  };
  paintShape(ctx, flap, {
    top: tc('#4787AA'), bottom: tc('#2C5F7A'), y0: -95, y1: -50, hi: tc('#7CB6D2'), rim: [1.1, 2.3], shadow: null, line: C.line, lw: 1.6,
    extra: () => {
      circle(ctx, -9, -72, 7.2);
      ctx.fillStyle = tc('#FFF7EC');
      ctx.fill();
      ctx.strokeStyle = tc('#B9A88E');
      ctx.lineWidth = (0.9) * LWK;
      ctx.stroke();
      ctx.fillStyle = tc('#E2463F');
      ctx.fillRect(-11.2, -77, 4.4, 10);
      ctx.fillRect(-14, -74.2, 10, 4.4);
      ctx.beginPath();
      ctx.moveTo(-22, -58.5);
      ctx.quadraticCurveTo(0, -51.5, 22, -58.5);
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = 'rgba(200,230,240,0.5)';
      ctx.lineWidth = (0.9) * LWK;
      ctx.stroke();
      ctx.setLineDash([]);
    },
  });
  U.roundRect(ctx, 6, -60, 7, 15, 2);
  ctx.fillStyle = tc('#21485C');
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = (1) * LWK;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-6, -91);
  ctx.quadraticCurveTo(0, -101, 6, -91);
  ctx.strokeStyle = tc('#1F4255');
  ctx.lineWidth = (2.6) * LWK;
  ctx.stroke();
  U.roundRect(ctx, 4.5, -48, 10, 7, 1.8);
  const bg = ctx.createLinearGradient(0, -48, 0, -41);
  bg.addColorStop(0, tc('#F5DA78'));
  bg.addColorStop(1, tc('#C9A23C'));
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = tc('#7E6420');
  ctx.lineWidth = (1) * LWK;
  ctx.stroke();
  // bedroll strapped underneath
  paintShape(ctx, () => U.roundRect(ctx, -36, -18, 72, 18, 9), {
    top: tc('#E2C08A'), bottom: tc('#9C7A46'), y0: -18, y1: 0, hi: tc('#F4DDB0'), rim: [1.1, 2.3], shadow: null, line: tc('#7A5C34'), lw: 1.5,
    extra: () => {
      ctx.beginPath();
      for (const yy of [-12, -6]) { ctx.moveTo(-34, yy); ctx.lineTo(28, yy + 0.5); }
      ctx.strokeStyle = 'rgba(122,92,52,0.35)';
      ctx.lineWidth = (0.8) * LWK;
      ctx.stroke();
    },
  });
  ellipse(ctx, 31.5, -9, 4.4, 8.4);
  ctx.fillStyle = tc('#D8B47C');
  ctx.fill();
  ctx.strokeStyle = tc('#7A5C34');
  ctx.lineWidth = (1.1) * LWK;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(31.5, -9, 2.6, 5.2, 0, -Math.PI / 2, Math.PI);
  ctx.ellipse(31.5, -9.6, 1.2, 2.6, 0, Math.PI, TAU);
  ctx.strokeStyle = 'rgba(122,92,52,0.8)';
  ctx.lineWidth = (0.8) * LWK;
  ctx.stroke();
  ctx.fillStyle = tc('#3B3026');
  for (const sx of [-19, 15]) { U.roundRect(ctx, sx - 2.6, -19.5, 5.2, 21, 1.5); ctx.fill(); }
}
function drawBackpack(ctx, r) {
  const wp = r.o.walkPhase || 0;
  // lag / bounce: the bag settles a beat after the body
  const bob = r.pose === 'run' ? -3.5 * Math.cos(TAU * wp - 0.9) : r.pose === 'walk' ? -1.2 * Math.cos(TAU * wp * 2 - 0.8) : 0;
  const sway = r.pose === 'run' ? 0.06 * Math.sin(TAU * wp - 0.9) : r.pose === 'walk' ? 0.025 * Math.sin(TAU * wp * 2 - 0.8) : 0;
  SV(ctx);
  apply(ctx, r.B);
  // straps wrapping the body (clipped to it): chest strap over the shoulder, girth strap
  SV(ctx);
  bodyPath(ctx);
  ctx.clip();
  const strap = (pts) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    crTo(ctx, pts.map(([x, y]) => ({ x, y })), 1);
  };
  ctx.lineCap = 'round';
  for (const pts of [[[-20, -66], [-4, -54], [12, -36], [22, -10], [28, 20], [30, 50]], [[-46, -66], [-49, -36], [-46, -4], [-40, 30], [-36, 50]]]) {
    strap(pts.map(([x, y]) => [x + 1.5, y + 1.5]));
    ctx.strokeStyle = 'rgba(30,20,20,0.18)';
    ctx.lineWidth = (8.5) * LWK;
    ctx.stroke();
    strap(pts);
    ctx.strokeStyle = tc('#1E3442');
    ctx.lineWidth = (7) * LWK;
    ctx.stroke();
    ctx.strokeStyle = tc('#2E5C74');
    ctx.lineWidth = (4.2) * LWK;
    ctx.stroke();
    ctx.setLineDash([1.4, 2.2]);
    ctx.strokeStyle = tca('#9CC4D8', 0.5);
    ctx.lineWidth = (0.8) * LWK;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // strap buckle on the chest strap
  SV(ctx);
  ctx.translate(17, -24);
  ctx.rotate(1.15);
  U.roundRect(ctx, -4.5, -4, 9, 8, 1.8);
  ctx.fillStyle = tc('#C9A23C');
  ctx.fill();
  ctx.strokeStyle = tc('#7E6420');
  ctx.lineWidth = (1) * LWK;
  ctx.stroke();
  RS(ctx);
  RS(ctx);
  // contact shadow under the bedroll
  ellipse(ctx, -33, -64, 23, 4.5, 0.05);
  ctx.fillStyle = 'rgba(40,24,20,0.22)';
  ctx.fill();
  ctx.translate(-33, -63 + bob);
  ctx.rotate(0.04 + sway);
  ctx.scale(0.6, 0.6);
  bagArt(ctx);
  RS(ctx);
}

function drawBird(ctx, r, x, y) {
  const t = r.t;
  SV(ctx);
  ctx.translate(x, y);
  const C = tc('#F2C33F');
  ctx.beginPath();
  ctx.moveTo(-6, -5); ctx.lineTo(-15, -10); ctx.lineTo(-14, -3);
  ctx.closePath();
  ctx.fillStyle = tc('#C7932A');
  ctx.fill();
  ellipse(ctx, 0, -7, 9, 7);
  ctx.fillStyle = C;
  ctx.fill();
  ctx.strokeStyle = tc('#9A6E1C');
  ctx.lineWidth = (1.1) * LWK;
  ctx.stroke();
  circle(ctx, 5.5, -14, 5);
  ctx.fillStyle = C;
  ctx.fill();
  ctx.stroke();
  ellipse(ctx, -1.5, -6, 5, 3.3, 0.3);
  ctx.fillStyle = tc('#D9A12E');
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(10, -15); ctx.lineTo(14.5, -13.5); ctx.lineTo(10, -12.2);
  ctx.closePath();
  ctx.fillStyle = tc('#F07A2A');
  ctx.fill();
  ctx.strokeStyle = tc('#2A1A10');
  ctx.lineWidth = (1.2) * LWK;
  ctx.lineCap = 'round';
  ctx.beginPath(); // sleepy closed eye
  ctx.arc(7, -15, 1.6, 0.2, Math.PI - 0.2);
  ctx.stroke();
  circle(ctx, 9, -12.5, 1.3);
  ctx.fillStyle = 'rgba(255,120,100,0.5)';
  ctx.fill();
  RS(ctx);
}

// little glass thermometer along +x (bulb at the origin end). reading: optional upright tag
// ("39.4") at the top end that stays readable whatever the rotation / flip.
function drawThermometer(ctx, len, level, broken, reading) {
  SV(ctx);
  const w = 6.4;
  U.roundRect(ctx, 0, -w / 2, len, w, w / 2);
  ctx.fillStyle = 'rgba(238,249,255,0.96)';
  ctx.fill();
  ctx.strokeStyle = tc('#6E8494');
  ctx.lineWidth = (1.3) * LWK;
  ctx.stroke();
  const colL = (len - 8) * clamp(level);
  ctx.fillStyle = tc('#E2382F');
  U.roundRect(ctx, 2, -1.3, Math.max(2.6, colL), 2.6, 1.3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(80,100,115,0.7)';
  ctx.lineWidth = (0.8) * LWK;
  ctx.beginPath();
  for (let i = 1; i < 8; i++) { const x = 6 + (i * (len - 10)) / 8; ctx.moveTo(x, -w / 2); ctx.lineTo(x, -w / 2 + (i % 2 ? 1.6 : 2.6)); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = (1) * LWK;
  ctx.beginPath(); ctx.moveTo(5, -2); ctx.lineTo(len - 4, -2); ctx.stroke();
  if (broken > 0.5) {
    ctx.fillStyle = 'rgba(238,249,255,0.95)';
    ctx.strokeStyle = tc('#6E8494');
    ctx.beginPath();
    ctx.moveTo(1, -3.2); ctx.lineTo(-4, -6); ctx.lineTo(-2, -1); ctx.lineTo(-7, 1); ctx.lineTo(-1, 3.2); ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    circle(ctx, -1.5, 0, 5);
    ctx.fillStyle = tc('#E2382F');
    ctx.fill();
    ctx.strokeStyle = tc('#8E1E18');
    ctx.lineWidth = (1.2) * LWK;
    ctx.stroke();
    circle(ctx, -3, -1.8, 1.4);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
  }
  if (reading != null && reading !== '') {
    // reading card, upright on screen, with a pointer to the top of the red column — the same
    // tag props.drawThermometer uses
    SV(ctx);
    ctx.translate(2 + Math.max(2.6, colL), 0);
    const M = ctx.getTransform();
    if (M.a * M.d - M.b * M.c < 0) ctx.scale(1, -1);
    const M2 = ctx.getTransform();
    ctx.rotate(-Math.atan2(M2.b, M2.a));
    const txt = String(reading) + '°';
    const fs = 12.5;
    ctx.font = `700 ${fs}px Fredoka`;
    const tw = ctx.measureText(txt).width;
    const bw = tw + fs * 0.9, bh = fs * 1.45, bx = fs * 0.55 + 4, by = -bh - 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(bx + 2, by + bh - 1);
    ctx.lineTo(bx + 9, by + bh - 1);
    ctx.closePath();
    ctx.fillStyle = tc('#B23A2E');
    ctx.fill();
    U.roundRect(ctx, bx + 0.8, by + 1.4, bw, bh, bh * 0.32);
    ctx.fillStyle = 'rgba(60,20,20,0.25)';
    ctx.fill();
    U.roundRect(ctx, bx, by, bw, bh, bh * 0.32);
    const cg = ctx.createLinearGradient(0, by, 0, by + bh);
    cg.addColorStop(0, tc('#FFFEF8'));
    cg.addColorStop(1, tc('#FFF4E4'));
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.strokeStyle = tc('#B23A2E');
    ctx.lineWidth = (1.3) * LWK;
    ctx.stroke();
    ctx.fillStyle = tc('#B23A2E');
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(txt, bx + bw / 2, by + bh / 2 + 0.5);
    RS(ctx);
  }
  RS(ctx);
}

// ─────────────────────────────────────────────────────────────── 3/4 head (headTurn > .5)
// Head turned ~40° toward the camera: round cranium with both eyes high on it, and the long
// blunt capybara muzzle projecting toward camera-right — a squarish front plane carrying the
// nose pad on top and the mouth below, split from the side of the face by a soft plane break.
const HEAD34_PTS = [
  [-18, -24], [-10, -44], [6, -56], [28, -62], [48, -61], [64, -56], [80, -48], [95, -40], [107, -31],
  [113.5, -17], [114.5, 0], [111.5, 14], [103.5, 25], [90, 32], [71, 35], [50, 36], [28, 35], [8, 30], [-8, 20], [-17, 2],
];
// jaw drop per outline point when the mouth opens (the chin is part of the head shape)
const HEAD34_DROP = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 8, 14, 13, 6, 1, 0, 0, 0];
const F34 = {
  eyeN: [22, -29], eyeF: [64, -38], earN: [-4, -46], earF: [53, -58], crown: [28, -62],
  nose: [97, -24], mouth: [94, 9], chin: [92, 34],
};
let _top34 = null;
function top34(x) {
  if (!_top34) {
    const poly = sampleBlob(HEAD34_PTS, 0.95, 12), top = new Float32Array(160).fill(0);
    for (const [px, py] of poly) { const j = Math.round(px) + 20; if (py < -5 && j >= 0 && j < 160 && py < top[j]) top[j] = py; }
    for (let j = 1; j < 159; j++) if (top[j] === 0 && top[j - 1] < 0 && top[j + 1] < 0) top[j] = (top[j - 1] + top[j + 1]) / 2;
    _top34 = top;
  }
  const f = clamp(x + 20, 0, 159), i = Math.floor(f);
  return lerp(_top34[i], _top34[Math.min(159, i + 1)], f - i);
}
function head34Path(ctx, openK = 0) {
  blob(ctx, openK > 0 ? HEAD34_PTS.map(([x, y], i) => [x, y + HEAD34_DROP[i] * openK]) : HEAD34_PTS, 0.95);
}
// near / far eye. yawF (1 at headTurn .5 → 0 at 1): the far eye is still tucked toward the
// bridge and foreshortened, the near eye a little forward. With glasses the eye always fits
// inside its lens (shock pops it by sliding the frames, not by overflowing them).
function eyes34(r) {
  const m = r.m, glasses = !!r.acc.glasses, c = r.c;
  let es = (m.eyeS || 1) * (glasses ? 1.04 : 1) * (c.eyeSize || 1);
  const lr = c.lensR || LENS_R;
  if (glasses) es = Math.min(es, (lr - 2.2) / 13.4);
  const yw = r.yawF || 0;
  const fw = 1 - 0.3 * yw;
  return {
    n: { x: F34.eyeN[0] + 5 * yw, y: F34.eyeN[1] + 1.5 * yw, rx: 12.2 * es, ry: 13.4 * es, es, glasses, lensR: lr },
    f: { x: F34.eyeF[0] + 6 * yw, y: F34.eyeF[1] - 1 * yw, rx: 9.4 * es * fw, ry: 12.6 * es, es, glasses, lensR: lr * 0.9, lensW: 15.5 * (lr / 20.5) * fw, bw: 0.82 * fw },
  };
}
function drawEar34(ctx, r, far) {
  const P = r.c.pal;
  const [ex, ey] = far ? F34.earF : F34.earN;
  SV(ctx);
  ctx.translate(ex + (far ? 6 * (r.yawF || 0) : 0), ey + 6);
  ctx.rotate((far ? 0.35 : -0.3) + r.earA * (far ? -0.8 : 1));
  const rx = far ? 8.4 : 9.4, ry = far ? 10 : 10.8;
  ctx.translate(0, -ry * 0.62);
  ellipse(ctx, 0, 0, rx, ry);
  ctx.fillStyle = far ? mix(P.base, P.dark, 0.35) : mix(P.base, P.dark, 0.25);
  ctx.fill();
  ctx.strokeStyle = P.line;
  ctx.lineWidth = (2.1) * LWK;
  ctx.stroke();
  ellipse(ctx, far ? -1.2 : 1.4, 1.6, rx * 0.55, ry * 0.6);
  ctx.fillStyle = P.earIn;
  ctx.fill();
  RS(ctx);
}
function drawGlasses34(ctx, r, E) {
  const fog = r.acc.fog;
  const lod = r.lod || 0;
  const n = E.n, f = E.f, NR = n.lensR;
  SV(ctx);
  glassesXform(ctx, r, n.x + 0.5, n.y - 0.5);
  const FR = '#16131A';
  ctx.strokeStyle = FR;
  ctx.lineCap = 'round';
  // temple arm (near) and the bridge over the snout
  ctx.lineWidth = (3.6 - 0.6 * lod) * LWK;
  ctx.beginPath();
  ctx.moveTo(n.x - NR + 1, n.y - 4);
  ctx.quadraticCurveTo(n.x - NR - 6, n.y - 9, F34.earN[0] + 4, F34.earN[1] + 6);
  ctx.stroke();
  ctx.lineWidth = (4.6 - 0.8 * lod) * LWK;
  ctx.beginPath();
  ctx.moveTo(n.x + NR - 2, n.y - 7);
  ctx.quadraticCurveTo((n.x + f.x) / 2 + 1, Math.min(n.y, f.y) - 12, f.x - f.lensW + 0.5, f.y - 3);
  ctx.stroke();
  lensFill(ctx, f.x + 0.5, f.y - 0.5, f.lensW, f.lensR, fog, lod);
  lensRim(ctx, f.x + 0.5, f.y - 0.5, f.lensW, f.lensR, lod);
  lensFill(ctx, n.x + 0.5, n.y - 0.5, NR, NR, fog, lod);
  lensRim(ctx, n.x + 0.5, n.y - 0.5, NR, NR, lod);
  RS(ctx);
}
// 3/4 mouth on the muzzle front: closed = philtrum + "ω" lips (smile / frown / flat / wavy);
// open = a cut into the dropped chin: a wide upturned D for smiles, a rounder O / trapezoid
// with turned-down corners otherwise; buck teeth hang from the top lip.
function drawMouth34(ctx, r, openK) {
  const P = r.c.pal, m = r.m;
  const [mx, my] = F34.mouth;
  const lod = r.lod || 0;
  const flat = (m.flat || 0) > 0.5;
  const sly = clamp(m.sly || 0);
  const k = flat ? 0 : clamp((m.mouth || 0) * (1 + 0.5 * lod), -1, 1) * (1 + 0.2 * sly);
  const sm = Math.max(0, k), fr = Math.max(0, -k);
  const hw = 12.5 + 3 * sm;
  SV(ctx);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (openK > 0.04) {
    const h = 4 + openK * (22 - 6 * sm);
    const cy = my + 1 - k * 6;                 // corner height (up for smiles)
    const ty = my - 2 + sm * 5 - fr * 1;       // top-lip middle (a smile's top lip dips: D shape)
    const w = hw - 2 + sm * 3 - fr * 3 * (1 - openK);
    SV(ctx);
    head34Path(ctx, openK);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(mx - w, cy);
    ctx.quadraticCurveTo(mx, ty, mx + w, cy - sly * 2);
    ctx.bezierCurveTo(mx + w + 1 - sm * 2, my + h * (0.75 - 0.25 * sm), mx + 7 + sm * 6, my + h, mx, my + h);
    ctx.bezierCurveTo(mx - 7 - sm * 6, my + h, mx - w - 1 + sm * 2, my + h * (0.75 - 0.25 * sm), mx - w, cy);
    ctx.closePath();
    ctx.fillStyle = tc('#4A1C22');
    ctx.fill();
    SV(ctx);
    ctx.clip();
    ellipse(ctx, mx, my + h + 1, 10 + 4 * sm, 6.5);
    ctx.fillStyle = tc('#D9716F');
    ctx.fill();
    ellipse(ctx, mx - 2, my + h - 3.5, 4.5, 1.6);
    ctx.fillStyle = tca('#FFCDC3', 0.45);
    ctx.fill();
    // buck teeth from the top lip
    const L = 4.5 + 5 * Math.min(1, openK * 1.6);
    ctx.lineWidth = (1.2) * LWK;
    ctx.strokeStyle = mix(P.line, '#8A8070', 0.35);
    U.roundRect(ctx, mx - 6, ty - 4, 5.8, L + 4, 1.8);
    ctx.fillStyle = tc('#FFFDF6');
    ctx.fill();
    ctx.stroke();
    U.roundRect(ctx, mx + 0.4, ty - 4, 5.8, L + 4, 1.8);
    ctx.fillStyle = tc('#F4EFE4');
    ctx.fill();
    ctx.stroke();
    RS(ctx);
    ctx.strokeStyle = P.line;
    ctx.lineWidth = (2.4) * LWK;
    ctx.stroke();
    // chin crease under the open mouth
    ctx.strokeStyle = rgba(P.dark, 0.5);
    ctx.lineWidth = (1.6) * LWK;
    ctx.beginPath();
    ctx.moveTo(mx - 9, my + h + 7);
    ctx.quadraticCurveTo(mx, my + h + 10, mx + 9, my + h + 7);
    ctx.stroke();
    RS(ctx);
  } else if (m.teeth > 0.5) {
    ctx.lineWidth = (1.2) * LWK;
    ctx.strokeStyle = mix(P.line, '#8A8070', 0.35);
    U.roundRect(ctx, mx - 6, my - 1.5, 5.8, 6.5, 1.8);
    ctx.fillStyle = tc('#FFFDF6');
    ctx.fill();
    ctx.stroke();
    U.roundRect(ctx, mx + 0.4, my - 1.5, 5.8, 6.5, 1.8);
    ctx.fillStyle = tc('#F4EFE4');
    ctx.fill();
    ctx.stroke();
  }
  // philtrum + lip line
  ctx.strokeStyle = P.line;
  ctx.lineWidth = (2.6 + 1.4 * lod) * LWK;
  ctx.beginPath();
  ctx.moveTo(mx, F34.nose[1] + 8);
  if (openK <= 0.04 && flat) {
    // deadpan: philtrum stops short; a short, slightly downturned flat line below it
    ctx.lineTo(mx, my - 2.5);
    ctx.moveTo(mx - hw * 0.75, my + 3);
    ctx.quadraticCurveTo(mx, my + 1, mx + hw * 0.75, my + 3);
  } else if (openK <= 0.04) {
    ctx.lineTo(mx, my - 1);
    const wv = (m.wavy || 0) > 0.5 ? 2.2 : 0;
    ctx.moveTo(mx, my - 1);
    ctx.bezierCurveTo(mx - 4, my + 6 + wv, mx - hw + 4, my + 4 - k * 2 - wv, mx - hw, my + 1 - k * 6);
    ctx.moveTo(mx, my - 1);
    ctx.bezierCurveTo(mx + 4, my + 6 + wv, mx + hw - 4, my + 4 - k * 2 - wv, mx + hw, my + 1 - k * (6 + 3 * sly));
  } else {
    ctx.lineTo(mx, my - 4 + sm * 4);
  }
  ctx.stroke();
  // smile: cheek creases at the corners
  if (sm > 0.3 && openK <= 0.04) {
    ctx.strokeStyle = rgba(P.line, 0.5 * (sm - 0.3) / 0.7);
    ctx.lineWidth = (1.8) * LWK;
    ctx.beginPath();
    ctx.arc(mx - hw - 1.5, my - 3 - k * 2, 4.5, 2.1, 3.6);
    ctx.moveTo(mx + hw + 1.5 + 4.5 * Math.cos(-0.5), my - 3 - k * 2 + 4.5 * Math.sin(-0.5));
    ctx.arc(mx + hw + 1.5, my - 3 - k * 2, 4.5, -0.5, 1.05);
    ctx.stroke();
  }
  RS(ctx);
}
function drawHelmetStrap34(ctx, r) {
  const k = r.acc.helmetStrap == null ? 1 : r.acc.helmetStrap;
  const openK = clamp(r.jawA / (22 * D2R));
  const lp = (a, b) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
  const bk = lp([-9, -24], [1, 12]);
  const chin = [bk, lp([-8, -16], [14, 31 + openK * 6]), lp([-7, -10], [42, 37 + openK * 13]), lp([-6, -6], [70, 38 + openK * 13])];
  const hp = helmetPlace(r), base = crownPos(r).helmet;
  SV(ctx);
  if (r.acc.helmetLift > 0) { ctx.translate(hp.x, hp.y); ctx.rotate(hp.rot); ctx.translate(-hp.x, -base[1]); }
  ctx.strokeStyle = tc('#2A2A30');
  ctx.lineWidth = (2.6) * LWK;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-14, -52);
  ctx.quadraticCurveTo(lerp(-16, -14, k), lerp(-36, -20, k), bk[0], bk[1]);
  ctx.moveTo(6, -57);
  ctx.quadraticCurveTo(lerp(-2, 6, k), lerp(-38, -22, k), bk[0], bk[1]);
  curve(ctx, chin.map((p) => [p[0], p[1]]), 1);
  ctx.stroke();
  U.roundRect(ctx, bk[0] - 3.8, bk[1] - 3.2, 7.5, 6.5, 1.6);
  ctx.fillStyle = tc('#55555F');
  ctx.fill();
  RS(ctx);
}
function drawHead34(ctx, r) {
  const a = r.acc, c = r.c, P = c.pal;
  const E = eyes34(r);
  const openK = clamp(r.jawA / (22 * D2R));
  drawEar34(ctx, r, true);
  paintShape(ctx, () => head34Path(ctx, openK), {
    top: P.top, bottom: mix(P.base, P.dark, 0.32), y0: -62, y1: 35 + openK * 14, hi: P.hi, rim: [1.2, 4],
    shadow: P.low, shadowY0: 8, shadowY1: 37 + openK * 14, shadowA: 0.45, line: P.line, lw: 2.4,
    extra: () => {
      // the muzzle block: its front plane faces camera-right and catches more light
      SV(ctx);
      ctx.beginPath();
      ctx.moveTo(72, -42);
      ctx.bezierCurveTo(68, -14, 70, 14, 80, 40 + openK * 14);
      ctx.lineTo(130, 40 + openK * 14);
      ctx.lineTo(130, -60);
      ctx.closePath();
      const fg = ctx.createLinearGradient(70, 0, 112, 0);
      fg.addColorStop(0, rgba(P.belly, 0.18));
      fg.addColorStop(1, rgba(P.belly, 0.5));
      ctx.fillStyle = fg;
      ctx.fill();
      RS(ctx);
      const mg = ctx.createRadialGradient(100, 2, 4, 100, 2, 30);
      mg.addColorStop(0, rgba('#FFF2DC', 0.22));
      mg.addColorStop(1, rgba('#FFF2DC', 0));
      ctx.fillStyle = mg;
      ctx.fillRect(66, -30, 64, 64);
      // lighter chin / jaw
      const jg = ctx.createRadialGradient(92, 30 + openK * 10, 2, 92, 30 + openK * 10, 22);
      jg.addColorStop(0, rgba(P.belly, 0.4));
      jg.addColorStop(1, rgba(P.belly, 0));
      ctx.fillStyle = jg;
      ctx.fillRect(66, 8, 52, 50);
      // bridge sheen running down the top of the muzzle
      ellipse(ctx, 86, -42, 16, 3.2, 0.5);
      ctx.fillStyle = rgba('#FFF4E0', 0.2);
      ctx.fill();
      // plane break: side of the face | front of the muzzle; cheek contour under the near eye
      ctx.strokeStyle = rgba(P.dark, 0.5);
      ctx.lineWidth = (1.9) * LWK;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(73, -36);
      ctx.bezierCurveTo(69, -12, 70, 10, 78, 26 + openK * 10);
      ctx.moveTo(6, -6);
      ctx.bezierCurveTo(6, 10, 18, 22, 36, 24);
      ctx.stroke();
      const bl = Math.max(c.blush, r.m.blush || 0);
      if (bl > 0) {
        for (const [bx, by, rr] of [[34, -8, 13], [108, -4, 9]]) {
          const bg = ctx.createRadialGradient(bx, by, 1, bx, by, rr);
          bg.addColorStop(0, rgba('#F27868', 0.5 * bl));
          bg.addColorStop(1, rgba('#F27868', 0));
          ctx.fillStyle = bg;
          ctx.fillRect(bx - rr, by - rr, 2 * rr, 2 * rr);
        }
      }
      flicks(ctx, [[-11, -30, 10, 1.9, 2.2], [-5, -36, 9, 1.85, 2], [16, 8, 9, 1.9, 2], [44, 12, 8, 1.95, 1.8]], P.fur);
    },
  });
  // nose pad on the top of the muzzle front + nostrils facing the camera
  const [nx, ny] = F34.nose;
  SV(ctx);
  blob(ctx, [[nx - 17, ny - 2], [nx - 8, ny - 11], [nx + 8, ny - 12], [nx + 16, ny - 5], [nx + 14, ny + 6], [nx + 1, ny + 9], [nx - 12, ny + 7]], 1);
  const ng = ctx.createLinearGradient(0, ny - 11, 0, ny + 9);
  ng.addColorStop(0, mix(P.muzzle, '#8A7A7A', 0.3));
  ng.addColorStop(1, shade(P.muzzle, -0.2));
  ctx.fillStyle = ng;
  ctx.fill();
  ctx.strokeStyle = P.line;
  ctx.lineWidth = (1.8) * LWK;
  ctx.stroke();
  ctx.fillStyle = shade(P.muzzle, -0.6);
  ellipse(ctx, nx - 7, ny + 1, 3.6, 2.3, 0.45); ctx.fill();
  ellipse(ctx, nx + 7.5, ny + 0.5, 3.8, 2.3, -0.45); ctx.fill();
  ellipse(ctx, nx - 1, ny - 7.5, 6, 1.6, -0.1);
  ctx.fillStyle = 'rgba(255,245,235,0.35)';
  ctx.fill();
  // whiskers: far side poking out past the muzzle, near side fanning back over the cheek
  ctx.strokeStyle = rgba(P.line, 0.42);
  ctx.lineWidth = (0.9) * LWK;
  ctx.beginPath();
  ctx.moveTo(110, -2); ctx.quadraticCurveTo(120, -5, 128, -3);
  ctx.moveTo(110, 3); ctx.quadraticCurveTo(119, 5, 126, 10);
  ctx.moveTo(80, -2); ctx.quadraticCurveTo(70, -4, 61, -2);
  ctx.moveTo(80, 3); ctx.quadraticCurveTo(70, 6, 63, 11);
  ctx.stroke();
  RS(ctx);
  drawMouth34(ctx, r, openK);
  if (a.soot > 0) sootBlobs(ctx, [[30, 4, 11], [100, 4, 9], [56, -48, 9]], a.soot, 77, () => head34Path(ctx, openK));
  if (a.helmet && a.helmetLift < 0.6) drawHelmetStrap34(ctx, r);
  // far eye: clipped by the head outline (it sits on the far side of the bridge)
  SV(ctx);
  head34Path(ctx, openK);
  ctx.clip();
  drawEye(ctx, r, E.f, true);
  RS(ctx);
  drawEye(ctx, r, E.n, false);
  if (c.tuft && !(a.helmet && a.helmetLift < 0.08)) { SV(ctx); ctx.translate(8, -4); drawTuft(ctx, r); RS(ctx); }
  if (a.flower) drawFlower(ctx, r);
  drawEar34(ctx, r, false);
  const askew = (r.m.askew || 0) >= 0.5;
  const brows = () => { drawBrow(ctx, r, E.f, true, top34); drawBrow(ctx, r, E.n, false, top34); };
  if (a.helmet || (a.glasses && !askew)) brows();
  if (a.helmet) { const hp = helmetPlace(r); drawHelmetAt(ctx, hp.x, hp.y, a.soot, hp.rot); }
  if (a.glasses) drawGlasses34(ctx, r, E);
  if (!a.helmet) singed(ctx, 40, -59, 3, a.soot, 5);
  return { lateBrows: !(a.helmet || (a.glasses && !askew)) ? brows : null };
}

// ─────────────────────────────────────────────────────────────── head assembly
// profile head (headTurn < .56). yawP 0..1 (headTurn 0 → .5): the in-between toward the 3/4
// head — the far ear slides forward over the crown, the front of the nose pad and the far
// nostril come round onto the snout front, pupils drift toward the camera.
function drawHeadProfile(ctx, r) {
  const a = r.acc, c = r.c;
  let lateBrows = null;
  drawEar(ctx, r, true);
  drawMouthInterior(ctx, r);
  drawTeeth(ctx, r, 0);
  drawJaw(ctx, r);
  drawUpperHead(ctx, r);
  if (r.m.teeth > 0.5 && r.jawA < 0.06) drawTeeth(ctx, r, 0.25);
  drawMouthLine(ctx, r);
  if (a.soot > 0) sootBlobs(ctx, [[58, -2, 11], [94, -26, 8], [66, -46, 9], [6, -26, 10]], a.soot, 77, () => headPath(ctx, r));
  if (a.helmet && a.helmetLift < 0.6) drawHelmetStrap(ctx, r);
  drawEye(ctx, r);
  const helmetOn = a.helmet && a.helmetLift < 0.08;
  if (c.tuft && !helmetOn) drawTuft(ctx, r);
  if (a.flower) drawFlower(ctx, r);
  drawEar(ctx, r, false);
  // brow layering: under the helmet rim; tucked behind the top of the frames (glasses);
  // otherwise drawn after the head items so an orange never hides them
  const askew = (r.m.askew || 0) >= 0.5;
  if (helmetOn || (a.glasses && !askew)) drawBrow(ctx, r);
  else lateBrows = () => drawBrow(ctx, r);
  if (a.helmet) { const hp = helmetPlace(r); drawHelmetAt(ctx, hp.x, hp.y, a.soot, hp.rot); }
  if (a.glasses) drawGlasses(ctx, r);
  if (!helmetOn) singed(ctx, 52, -54 + domeDy(r, 52), 3, a.soot, 5);
  return lateBrows;
}
// things that sit on / come off the head, in the current head space
function drawHeadItems(ctx, r, lateBrows) {
  const a = r.acc;
  if (a.orange || a.bird) {
    const op = orangePlace(r);
    if (a.orange === 'squashed') drawSquashedOrange(ctx, op.x, op.y, op.r, r.t, r.seed);
    else if (a.orange) drawOrange(ctx, op.x, op.y, op.r, r.t, r.seed);
    else drawBird(ctx, r, op.x - 2, (a.helmet ? helmetPlace(r).top : crownPos(r).orange[1]) + 1.5);
  }
  if (lateBrows) lateBrows();
  drawJuice(ctx, r, a.juice);
  const sw = a.sweat == null || a.sweat === false ? (r.m.sweat || 0) : Math.max(a.sweat, a.sweat === 0 ? 0 : r.m.sweat || 0);
  drawSweat(ctx, r, sw);
  if (a.thermometer && a.thermometer.at === 'mouth') {
    SV(ctx);
    if (!r.front) {
      ctx.translate(HINGE[0], HINGE[1]);
      ctx.rotate(r.jawA * 0.5);
      ctx.translate(-HINGE[0], -HINGE[1]);
      ctx.translate(80, 12); ctx.rotate(-0.2 + (a.thermometer.angle || 0));
    } else { ctx.translate(F34.mouth[0] + 12, F34.mouth[1] + 3); ctx.rotate(-0.25 + (a.thermometer.angle || 0)); }
    drawThermometer(ctx, 48, a.thermometer.level == null ? 0.55 : a.thermometer.level, a.thermometer.broken || 0, a.thermometer.reading);
    RS(ctx);
  }
}
// head assembly. headTurn: profile (with in-betweens) up to .44, 3/4 from .56, and a quick
// dissolve between the two drawings over .47–.53 (≈ one smear frame in a .5 s turn)
function drawHead(ctx, r) {
  const f34 = r.fade34;
  if (f34 < 1) {
    const rp = r.front ? { ...r, front: false } : r;
    SV(ctx);
    apply(ctx, r.Hp);
    drawHeadItems(ctx, rp, drawHeadProfile(ctx, rp));
    RS(ctx);
  }
  if (f34 > 0) {
    const rf = r.front ? r : { ...r, front: true };
    SV(ctx);
    apply(ctx, r.Hf);
    if (f34 < 1) ctx.globalAlpha *= f34;
    drawHeadItems(ctx, rf, drawHead34(ctx, rf).lateBrows);
    RS(ctx);
  }
}

// ─────────────────────────────────────────────────────────────── exported accessory drawers
// The same art the rig puts on the head, placeable anywhere — tween a prop onto
// capyAnchors(o).helmet / .orange and swap to the accessory flag on arrival: no pop.
// All take tint {color, amount} / rim (same meaning as drawCapybara's) to sit in scene light.
function withLW(ctx, o, scale, fn) {
  guarded(ctx, () => {
    LWK = clamp(Math.pow(Math.max(0.05, Math.abs(scale)), -0.33), 0.62, 1.6);
    setLight(o);
    fn();
  });
}
// drawCapyHelmet(ctx, {x, y, scale=1, rot=0, flip=false, soot=0, strap=false, tint, rim})
//   origin = middle of the bottom rim (anchors.helmet), visor toward +x (−x when flip).
//   scale 1 = the helmet on a scale-1, default-size head (use anchors.helmet.scale).
//   strap: true → the open chin strap dangling from the rim — exactly the rig's
//   accessories.helmet = {strap: 0}, so a tween onto anchors.helmet can swap to the worn helmet
//   with no pop, then cinch it by animating strap 0 → 1.
function drawCapyHelmet(ctx, o = {}) {
  const sc = o.scale == null ? 1 : fin(o.scale, 1);
  withLW(ctx, o, sc, () => {
    SV(ctx);
    ctx.translate(fin(o.x), fin(o.y));
    ctx.rotate(fin(o.rot));
    ctx.scale((o.flip ? -1 : 1) * sc * K, sc * K);
    if (o.strap) {
      SV(ctx);
      ctx.translate(-HELMET_X, 57);
      strokeStrap(ctx, strapGeom(0, 0, 0));
      RS(ctx);
    }
    drawHelmetAt(ctx, 0, 0, o.soot || 0);
    RS(ctx);
  });
}
// drawCapyOrange(ctx, {x, y, r=16, rot=0, t=0, seed=0, squash=0, flip=false, tint, rim})
//   (x,y) = centre of the round orange (anchors.orange), r = radius in caller units.
//   squash ≥ 0.5 → the flattened burst orange the rig shows for orange:'squashed' (sitting on
//   the same base point; it is props.drawOrange's squashed orange); 0..0.5 squashes the
//   round one vertically toward it.
function drawCapyOrange(ctx, o = {}) {
  const R = o.r == null ? 16 : fin(o.r, 16), k = R / ORANGE_R, sq = clamp(fin(o.squash));
  withLW(ctx, o, k / K, () => {
    SV(ctx);
    ctx.translate(fin(o.x), fin(o.y));
    ctx.rotate(fin(o.rot));
    ctx.scale((o.flip ? -1 : 1) * k, k);
    if (sq >= 0.5) drawSquashedOrange(ctx, 0, ORANGE_R - 1, ORANGE_R, fin(o.t), o.seed || 0);
    else {
      const f = 1 - sq * 0.5;
      ctx.translate(0, ORANGE_R);
      ctx.scale(1 + sq * 0.35, f);
      ctx.translate(0, -ORANGE_R);
      drawOrange(ctx, 0, 0, ORANGE_R, fin(o.t), o.seed || 0);
    }
    RS(ctx);
  });
}
// drawCapyThermometer(ctx, {x, y, scale=1, rot=0, level=0.55, broken=0, reading, length=62, tint})
//   the bare glass art (bulb at (x,y), tube pointing UP at rot 0) that props.drawThermometer is
//   built on. For a loose / close-up / insert thermometer use props.drawThermometer (reading
//   tag with pointer, printed scale in close-ups, the pop) — the in-paw one is drawn with it.
function drawCapyThermometer(ctx, o = {}) {
  const sc = o.scale == null ? 1 : fin(o.scale, 1);
  withLW(ctx, o, sc, () => {
    SV(ctx);
    ctx.translate(fin(o.x), fin(o.y));
    ctx.rotate(fin(o.rot) - Math.PI / 2);
    ctx.scale(sc * K, sc * K);
    drawThermometer(ctx, o.length || 62, o.level == null ? 0.55 : clamp(fin(o.level, 0.55)), o.broken || 0, o.reading);
    RS(ctx);
  });
}
// props.js (lazy: it lazily requires this module too) — for the shared thermometer / orange art
let _props;
function propsLib() {
  if (_props === undefined) { try { _props = require('./props'); } catch (e) { _props = null; } }
  return _props;
}
const lightOpts = () => (TINT ? { tint: { color: TINT.color, amount: TINT.k / 0.6 }, rim: RIMC || undefined } : RIMC ? { rim: RIMC } : {});

// ─────────────────────────────────────────────────────────────── main
// numeric options sanitised (NaN / Infinity → defaults; scale > 0) so bad input never throws
const NUM_OPTS = { x: 0, y: 0, rot: 0, t: 0, talk: 0, headTilt: 0, headTurn: 0, walkPhase: 0 };
function sanitize(o) {
  o = o || {};
  let out = null;
  const fix = (k, v) => { if (!out) out = { ...o }; out[k] = v; };
  for (const k in NUM_OPTS) if (o[k] != null && !Number.isFinite(o[k])) fix(k, Number.isFinite(+o[k]) ? +o[k] : NUM_OPTS[k]);
  for (const k of ['eyes', 'pawUp', 'tremble', 'moodK', 'waterline', 'lod']) if (o[k] != null && !Number.isFinite(o[k])) fix(k, Number.isFinite(+o[k]) ? +o[k] : undefined);
  if (o.scale != null && !(o.scale > 1e-3)) fix('scale', Number.isFinite(o.scale) && o.scale < 0 ? Math.max(1e-3, -o.scale) : 1e-3);
  if (o.look && (!Number.isFinite(o.look.x) || !Number.isFinite(o.look.y))) fix('look', { x: fin(+o.look.x), y: fin(+o.look.y) });
  return out || o;
}
function drawCapybara(ctx, o) {
  o = sanitize(o);
  const r = rig(o);
  const a = r.acc;
  guarded(ctx, () => {
    LWK = clamp(Math.pow(Math.max(0.05, r.s / K), -0.33), 0.62, 1.6);
    setLight(o);
    drawCapybaraInner(ctx, r, o, a);
  });
}
function drawCapybaraInner(ctx, r, o, a) {
  const callerM = o.hold || (a.thermometer && a.thermometer.at === 'paw') ? ctx.getTransform() : null;
  SV(ctx);
  if (o.waterline != null) {
    const wy = (o.y || 0) + o.waterline * r.s;
    ctx.beginPath();
    ctx.rect(-1e5, -1e5, 2e5, 1e5 + wy);
    ctx.clip();
  }
  apply(ctx, r.G);
  ctx.lineJoin = 'round';
  for (const l of r.legs) if (l.far) drawLeg(ctx, r, l, false);
  drawBody(ctx, r);
  if (a.soot > 0) {
    SV(ctx);
    apply(ctx, r.B);
    sootBlobs(ctx, [[-40, -50, 18], [-96, -16, 14], [4, -30, 12], [-66, 18, 14]], a.soot, 31, () => bodyPath(ctx));
    singed(ctx, -66, -63, 4, a.soot, 2); singed(ctx, -14, -60, 3, a.soot, 3);
    RS(ctx);
  }
  for (const l of r.legs) if (!l.far && (l.kind === 'hind' || l.kind === 'hindTuck')) drawLeg(ctx, r, l, true);
  if (r.pose === 'sit') drawHaunch(ctx, r, true);
  if (r.pose === 'lie') drawHaunch(ctx, r, false);
  if (a.backpack) drawBackpack(ctx, r);
  drawNeck(ctx, r);
  drawHeadShadowOnBody(ctx, r);
  if (a.necklace) drawNecklace(ctx, r);
  for (const l of r.legs) if (!l.far && (l.kind === 'front' || l.kind === 'paw')) drawLeg(ctx, r, l, true);
  // raised paw: in front of the face, except a lying paw still below the mouth (under the jaw)
  const armPass = () => {
    const arm = drawArm(ctx, r);
    if (!arm) return;
    const th = a.thermometer && a.thermometer.at === 'paw' ? a.thermometer : null;
    if (th) {
      // the in-paw thermometer IS props.drawThermometer (same glass, reading tag with pointer,
      // printed scale in close-ups, the pop) so it matches the s07 insert; rig art as fallback
      const PL = propsLib();
      const bx = arm.paw.x + 3, by = arm.paw.y - 1, ang = -Math.PI / 2 + 0.14 + fin(th.angle);
      if (PL && PL.drawThermometer) {
        const p = mAp(r.G, bx, by);
        const dir = dirAngle(r.G, Math.cos(ang), Math.sin(ang));
        const lw = LWK;
        SV(ctx);
        ctx.setTransform(callerM);
        PL.drawThermometer(ctx, {
          x: p.x, y: p.y, rot: dir + Math.PI / 2, scale: (r.s * 62) / 100, length: 100,
          level: th.level == null ? 0.55 : clamp(fin(th.level, 0.55)), broken: clamp(fin(th.broken)),
          reading: th.reading != null && th.reading !== '' ? th.reading : null, tagSize: th.tagSize || 17,
          tagSide: r.flip ? 'left' : 'right', t: r.t, ...lightOpts(),
        });
        RS(ctx);
        LWK = lw;
      } else {
        SV(ctx);
        ctx.translate(bx, by);
        ctx.rotate(ang);
        drawThermometer(ctx, 62, th.level == null ? 0.55 : th.level, th.broken || 0, th.reading);
        RS(ctx);
      }
    }
    if (o.hold) {
      const lw = LWK;
      const p = mAp(r.G, arm.paw.x, arm.paw.y);
      SV(ctx);
      ctx.setTransform(callerM);
      o.hold(ctx, { x: p.x, y: p.y, angle: dirAngle(r.G, Math.cos(arm.ang), Math.sin(arm.ang)), scale: r.s / K, flip: r.flip });
      RS(ctx);
      LWK = lw;
    }
    if (th || o.hold) drawThumb(ctx, r, arm.paw, arm.ang);
  };
  let armFirst = false;
  if (r.arm && r.pose === 'lie') {
    const mo = mAp(r.H, 92, 11);
    armFirst = armSolve(r.arm).paw.y > mo.y - 4;
  }
  if (armFirst) armPass();
  drawHead(ctx, r);
  if (!armFirst) armPass();
  if (a.soot > 0.5) {
    const p = mAp(r.H, 40, -62);
    SV(ctx);
    for (let i = 0; i < 3; i++) {
      const cyc = ((r.t * 0.5 + i / 3) % 1 + 1) % 1;
      circle(ctx, p.x + Math.sin(cyc * 6 + i * 2) * 6 + (i - 1) * 10, p.y - cyc * 42, 4 + cyc * 8);
      ctx.fillStyle = rgba('#5E585A', (a.soot - 0.5) * 0.9 * (1 - cyc));
      ctx.fill();
    }
    RS(ctx);
  }
  RS(ctx);
}

// ─────────────────────────────────────────────────────────────── lab sheets
function label(ctx, text, x, y, size = 15, col = 'rgba(40,40,50,0.85)') {
  ctx.save();
  ctx.font = `600 ${size}px Fredoka`;
  ctx.textAlign = 'center';
  ctx.fillStyle = col;
  ctx.fillText(text, x, y);
  ctx.restore();
}
function bg(ctx, top = '#8ED1F0', bot = '#FDEBC8') {
  const g = ctx.createLinearGradient(0, 0, 0, 720);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1280, 720);
}
function pool(ctx, y0) {
  const g = ctx.createLinearGradient(0, y0, 0, 720);
  g.addColorStop(0, '#5CC9C9');
  g.addColorStop(1, '#2E8F9E');
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, 1280, 720 - y0);
}
function ripple(ctx, x, y, w) {
  ctx.save();
  ctx.strokeStyle = 'rgba(201,244,238,0.85)';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(x, y + 1, w / 2, 5, 0, 0.1, Math.PI - 0.1);
  ctx.stroke();
  ctx.restore();
}
function dot(ctx, p, col, txt) {
  ctx.save();
  circle(ctx, p.x, p.y, 4);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (txt) {
    ctx.font = '700 10px Nunito';
    ctx.fillStyle = '#111';
    ctx.fillText(txt, p.x + 6, p.y - 4);
  }
  ctx.restore();
}
function swimmer(ctx, o) {
  drawCapybara(ctx, { pose: 'swim', waterline: 0, ...o });
  ripple(ctx, o.x + (o.flip ? 20 : -20) * (o.scale || 1), o.y, 230 * (o.scale || 1));
}

function groundLine(ctx, x0, x1, y) {
  ctx.save();
  ctx.fillStyle = 'rgba(60,110,70,0.35)';
  ctx.fillRect(x0, y - 1, x1 - x0, 3);
  ctx.restore();
}

const lab = {
  cast(ctx, t) {
    bg(ctx);
    ctx.fillStyle = '#5FAF6A';
    ctx.fillRect(0, 330, 1280, 90);
    pool(ctx, 400);
    swimmer(ctx, { who: 'extra', seed: 3, x: 140, y: 452, scale: 0.6, t });
    swimmer(ctx, { who: 'extra', seed: 8, x: 1150, y: 455, scale: 0.62, flip: true, t });
    swimmer(ctx, { who: 'sunny', x: 300, y: 590, scale: 1.12, t });
    swimmer(ctx, { who: 'barry', x: 650, y: 600, scale: 1.12, mood: 'worried', t, accessories: { thermometer: { at: 'paw', level: 0.7, reading: '39.4' } } });
    swimmer(ctx, { who: 'doreen', x: 1010, y: 590, scale: 1.08, flip: true, t });
    label(ctx, 'SUNNY', 300, 700, 18, '#fff'); label(ctx, 'BARRY', 650, 700, 18, '#fff'); label(ctx, 'DOREEN', 1010, 700, 18, '#fff');
  },
  closeup(ctx, t) {
    bg(ctx, '#BFE3F0', '#F6E7CF');
    drawCapybara(ctx, { who: 'barry', x: 330, y: 520, scale: 2.6, mood: 'worried', t, pose: 'swim' });
    drawCapybara(ctx, { who: 'sunny', x: 980, y: 300, scale: 1.25, t, pose: 'swim' });
    drawCapybara(ctx, { who: 'doreen', x: 980, y: 620, scale: 1.25, t, pose: 'swim' });
  },
  moods(ctx, t) {
    bg(ctx, '#C9E6F2', '#F6E7CF');
    MOOD_NAMES.forEach((mood, i) => {
      const cx = 140 + (i % 5) * 250, cy = 220 + Math.floor(i / 5) * 330;
      drawCapybara(ctx, { who: 'barry', x: cx - 40, y: cy, scale: 0.98, mood, t: t + i * 0.37, pose: 'swim', blink: false });
      label(ctx, mood.toUpperCase(), cx, cy + 100, 20);
    });
  },
  moods_others(ctx, t) {
    bg(ctx, '#C9E6F2', '#F6E7CF');
    MOOD_NAMES.forEach((mood, i) => {
      const cx = 135 + (i % 5) * 252, row = Math.floor(i / 5);
      drawCapybara(ctx, { who: 'sunny', x: cx - 25, y: 110 + row * 176, scale: 0.58, mood, t: t + i * 0.3, pose: 'swim', blink: false });
      label(ctx, 'sunny ' + mood, cx, 160 + row * 176, 14);
      drawCapybara(ctx, { who: 'doreen', x: cx - 25, y: 470 + row * 176, scale: 0.58, mood, t: t + i * 0.3, pose: 'swim', blink: false });
      label(ctx, 'doreen ' + mood, cx, 520 + row * 176, 14);
    });
  },
  poses(ctx, t) {
    bg(ctx, '#BFE3F0', '#F3E4C8');
    POSES.forEach((pose, i) => {
      const cx = 220 + (i % 3) * 420, cy = 210 + Math.floor(i / 3) * 330;
      const o = { who: i % 2 ? 'sunny' : 'barry', x: cx, y: cy, scale: 0.92, pose, walkPhase: t * 1.6, t, mood: pose === 'run' ? 'panic' : pose === 'lie' ? 'deadpan' : undefined };
      const A = capyAnchors(o);
      groundLine(ctx, cx - 190, cx + 190, A.ground.y);
      drawCapybara(ctx, o);
      label(ctx, pose.toUpperCase(), cx, cy + 115, 18);
    });
  },
  // walk / run cycles: 8 phases each; the faint ticks move with the ground at anchors.stride
  // per cycle — planted feet should stay on their tick
  gaits(ctx, t) {
    bg(ctx, '#BFE3F0', '#F3E4C8');
    ['walk', 'run'].forEach((pose, row) => {
      for (let i = 0; i < 4; i++) {
        const wp = i / 4 + (t * 0.8) % 1;
        const o = { who: 'barry', pose, walkPhase: wp, x: 180 + i * 310, y: 200 + row * 330, scale: 1.05, t, mood: pose === 'run' ? 'panic' : 'neutral', tremble: 0 };
        const A = capyAnchors(o);
        groundLine(ctx, o.x - 150, o.x + 150, A.ground.y);
        ctx.save();
        ctx.fillStyle = 'rgba(40,70,50,0.5)';
        const st = A.stride / 4, off = -((wp * A.stride) % st);
        for (let k = -6; k <= 6; k++) ctx.fillRect(o.x + off + k * st, A.ground.y + 2, 2, 6);
        ctx.restore();
        drawCapybara(ctx, o);
        label(ctx, `${pose} phase ${(wp % 1).toFixed(2)}  stride ${A.stride.toFixed(0)}`, o.x, A.ground.y + 30, 13);
      }
    });
  },
  talk(ctx, t) {
    bg(ctx, '#C9E6F2', '#F6E7CF');
    const env = (k) => clamp(0.5 + 0.5 * Math.sin(t * 13 + k) * Math.sin(t * 5.3 + k * 2) + 0.1);
    drawCapybara(ctx, { who: 'barry', x: 320, y: 390, scale: 1.7, mood: 'worried', talk: env(0), t, pose: 'swim' });
    drawCapybara(ctx, { who: 'sunny', x: 900, y: 270, scale: 1.0, mood: 'chill', talk: env(1), t, pose: 'swim' });
    drawCapybara(ctx, { who: 'doreen', x: 900, y: 560, scale: 1.0, mood: 'happy', talk: env(2), t, pose: 'swim' });
    label(ctx, `talk ${env(0).toFixed(2)}`, 320, 560, 18);
  },
  accessories(ctx, t) {
    bg(ctx, '#C9E6F2', '#F6E7CF');
    const items = [
      ['glasses', { glasses: true }], ['orange', { orange: true }], ['squashed', { orange: 'squashed' }], ['helmet', { helmet: true, glasses: true }],
      ['helmet+orange', { helmet: true, orange: true, glasses: true }], ['flower', { flower: true }], ['necklace', { necklace: true }], ['backpack (go-bag)', { backpack: true, glasses: true }],
      ['soot 1 + helmet', { soot: 1, glasses: true, helmet: true }], ['juice 1', { juice: 1 }], ['sweat 1', { sweat: 1 }], ['thermo mouth', { thermometer: 'mouth', glasses: true }],
      ['thermo paw 39.8', { thermometer: { at: 'paw', level: 0.8, reading: '39.8' }, glasses: true }], ['fog', { fog: 1, glasses: true }], ['bird', { bird: true }],
    ];
    items.forEach(([name, acc], i) => {
      const cx = 130 + (i % 5) * 255, cy = 165 + Math.floor(i / 5) * 230;
      drawCapybara(ctx, { who: 'barry', x: cx - 34, y: cy, scale: 0.74, t, pose: 'swim', accessories: { glasses: false, ...acc }, mood: 'neutral' });
      label(ctx, name, cx, cy + 74, 16);
    });
  },
  anchors(ctx, t) {
    bg(ctx, '#DDEFF5', '#F6EBD8');
    const cfgs = [
      { who: 'barry', x: 200, y: 240, scale: 0.95, pose: 'swim', talk: 0.6, accessories: { thermometer: 'paw' } },
      { who: 'sunny', x: 650, y: 240, scale: 0.8, flip: true, headTilt: 15, pose: 'swim' },
      { who: 'doreen', x: 1060, y: 220, scale: 0.85, rot: 0.25, pose: 'stand' },
      { who: 'barry', x: 200, y: 520, scale: 0.8, pose: 'sit', accessories: { helmet: true } },
      { who: 'barry', x: 650, y: 540, scale: 0.85, pose: 'lie', flip: true, pawUp: 1 },
      { who: 'extra', seed: 4, x: 1060, y: 540, scale: 0.85, pose: 'run', walkPhase: t },
    ];
    for (const o of cfgs) {
      const oo = { ...o, t };
      drawCapybara(ctx, oo);
      const A = capyAnchors(oo);
      ctx.save();
      ctx.strokeStyle = 'rgba(0,80,200,0.5)';
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(o.x - 160, A.waterline.y); ctx.lineTo(o.x + 160, A.waterline.y); ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.translate(A.headTop.x, A.headTop.y);
      ctx.rotate(A.headTop.angle);
      ctx.strokeStyle = '#FF3B3B';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -26); ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.translate(A.paw.x, A.paw.y);
      ctx.rotate(A.paw.angle);
      ctx.strokeStyle = '#2962FF';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(22, 0); ctx.stroke();
      ctx.restore();
      dot(ctx, A.headTop, '#FF3B3B', 'top');
      dot(ctx, A.stackTop, '#FFB000', 'stack');
      dot(ctx, A.helmet, '#E2463F', 'helmet');
      dot(ctx, A.mouth, '#FF66CC', 'mouth');
      dot(ctx, A.eye, '#3BFFEC', 'eye');
      dot(ctx, A.snout, '#FFFFFF', 'snout');
      dot(ctx, A.back, '#00C853', 'back');
      dot(ctx, A.paw, '#2962FF', 'paw');
      dot(ctx, A.ground, '#795548', 'ground');
      dot(ctx, A.chin, '#AA00FF', 'chin');
    }
  },
  scales_flip(ctx, t) {
    bg(ctx, '#C9E6F2', '#F6E7CF');
    const ss = [0.35, 0.55, 0.8, 1.1, 1.5];
    let x = 50;
    ss.forEach((s, i) => {
      x += 118 * s + 10;
      drawCapybara(ctx, { who: i % 2 ? 'doreen' : 'barry', x, y: 230, scale: s, t, flip: i % 2 === 1, pose: 'swim' });
      label(ctx, `scale ${s}${i % 2 ? ' flip' : ''}`, x, 280 + 60 * s, 14);
      x += 118 * s;
    });
    for (let i = 0; i < 8; i++) {
      drawCapybara(ctx, { who: 'extra', seed: i + 1, x: 90 + i * 155, y: 560, scale: 0.6, t, flip: i % 3 === 0, pose: i % 2 ? 'stand' : 'swim' });
      label(ctx, `extra ${i + 1}`, 90 + i * 155, 665, 13);
    }
  },
  // mood crossfades (o.mood as a weight map / capyMood): every parameter morphs, no pops
  blend(ctx, t) {
    bg(ctx, '#C9E6F2', '#F6E7CF');
    const pairs = [['worried', 'panic'], ['sad', 'smug'], ['chill', 'deadpan']];
    pairs.forEach(([a, b], row) => [0, 0.25, 0.5, 0.75, 1].forEach((k, i) => {
      const cx = 130 + i * 255, cy = 140 + row * 220;
      drawCapybara(ctx, { who: 'barry', x: cx - 30, y: cy, scale: 0.85, t, pose: 'swim', blink: false, mood: { [a]: 1 - k, [b]: k } });
      label(ctx, `${a} → ${b}  ${k}`, cx, cy + 80, 14);
    }));
  },
  // eyes closing (o.eyes 1 → 0): heavy lids keep the pupil; shut eyes become a lash line
  closed(ctx, t) {
    bg(ctx, '#C9E6F2', '#F6E7CF');
    const ev = [1, 0.6, 0.35, 0.18, 0.07, 0];
    [['barry', 'chill'], ['sunny', 'chill'], ['doreen', 'happy']].forEach(([who, mood], row) => ev.forEach((e, i) => {
      const cx = 110 + i * 212, cy = 150 + row * 225;
      drawCapybara(ctx, { who, mood, eyes: e, x: cx - 40, y: cy, scale: 0.95, t, pose: 'swim', blink: false });
      label(ctx, `${who} ${mood} eyes ${e}`, cx, cy + 85, 13);
    }));
  },
  // Gerald perched on headTop in every mood: brows stay visible (needs critters.js)
  gerald(ctx, t) {
    bg(ctx, '#C9E6F2', '#F6E7CF');
    let V = null;
    try { V = require('./critters'); } catch (e) { V = null; }
    MOOD_NAMES.forEach((mood, i) => {
      const cx = 140 + (i % 5) * 250, cy = 250 + Math.floor(i / 5) * 330;
      const o = { who: 'barry', x: cx - 40, y: cy, scale: 0.95, mood, t: t + i * 0.37, pose: 'swim', blink: false };
      drawCapybara(ctx, o);
      const A = capyAnchors(o);
      if (V && V.drawVulture) V.drawVulture(ctx, { x: A.headTop.x, y: A.headTop.y, rot: A.headTop.angle, scale: 0.75 * o.scale, t, mood: 'smug' });
      label(ctx, mood.toUpperCase(), cx, cy + 95, 18);
    });
  },
  // o.hold(ctx, paw) props + exported accessory drawers placed on the anchors
  hold(ctx, t) {
    bg(ctx, '#C9E6F2', '#F6E7CF');
    const k = 0.5 + 0.5 * Math.sin(t * 1.5);
    const o1 = { who: 'barry', x: 200, y: 250, scale: 1.1, t, pose: 'swim', pawUp: 1, mood: 'worried',
      hold: (c, p) => drawCapyOrange(c, { x: p.x + 4 * p.scale, y: p.y - 14 * p.scale, r: 15 * p.scale, t }) };
    drawCapybara(ctx, o1);
    label(ctx, 'hold: orange (thumb over it)', 200, 360, 14);
    const o2 = { who: 'barry', x: 640, y: 250, scale: 1.1, t, pose: 'swim', mood: 'smug', accessories: { thermometer: { at: 'paw', level: 0.9, reading: '39.8', angle: -0.3 } } };
    drawCapybara(ctx, o2);
    label(ctx, 'thermometer angle -0.3 + reading', 640, 360, 14);
    // helmet put-on: a scene-drawn helmet tweens onto anchors.helmet, then the flag takes over
    const o3 = { who: 'barry', x: 1060, y: 250, scale: 1.1, t, pose: 'swim', mood: 'deadpan' };
    const A3 = capyAnchors({ ...o3, accessories: { helmet: true } });
    drawCapybara(ctx, k > 0.95 ? { ...o3, accessories: { helmet: true } } : o3);
    if (k <= 0.95) drawCapyHelmet(ctx, { x: A3.helmet.x, y: lerp(A3.helmet.y - 90, A3.helmet.y, k / 0.95), rot: A3.helmet.angle * (k / 0.95), scale: A3.helmet.scale, flip: A3.helmet.flip, strap: true });
    label(ctx, 'helmet tween → anchors.helmet', 1060, 360, 14);
    const o4 = { who: 'doreen', x: 220, y: 560, scale: 1.0, t, pose: 'swim', flip: true, accessories: { orange: false } };
    const A4 = capyAnchors({ ...o4, accessories: { orange: true } });
    drawCapybara(ctx, o4);
    drawCapyOrange(ctx, { x: A4.orange.x, y: lerp(A4.orange.y - 80, A4.orange.y, k), r: A4.orange.r, t });
    label(ctx, 'orange tween → anchors.orange', 220, 670, 14);
    const o5 = { who: 'barry', x: 640, y: 600, scale: 1.0, t, pose: 'lie', pawUp: k, mood: 'worried', talk: 0.4 };
    groundLine(ctx, 500, 800, capyAnchors(o5).ground.y);
    drawCapybara(ctx, o5);
    label(ctx, 'lie: chin-rest paw lifts (pawUp)', 640, 680, 14);
    const o6 = { who: 'barry', x: 1060, y: 600, scale: 1.0, t, pose: 'sit', pawUp: 1, mood: 'smug', accessories: { helmet: true },
      hold: (c, p) => drawCapyThermometer(c, { x: p.x + 3 * p.scale, y: p.y - 2 * p.scale, rot: -0.15, scale: p.scale * 0.9, level: 0.95 }) };
    groundLine(ctx, 920, 1200, capyAnchors(o6).ground.y);
    drawCapybara(ctx, o6);
    label(ctx, 'sit + hold thermometer', 1060, 680, 14);
  },
};

// headTurn 0 → 1: profile in-betweens, the .47–.53 dissolve, 3/4 settling; then 3/4 moods
lab.turn = (ctx, t) => {
  bg(ctx, '#C9E6F2', '#F6E7CF');
  const ks = [0, 0.2, 0.4, 0.5, 0.6, 0.8, 1];
  ks.forEach((k, i) => {
    const cx = 95 + i * 180;
    drawCapybara(ctx, { who: 'barry', mood: 'deadpan', x: cx - 20, y: 170, scale: 0.72, t, headTurn: k, blink: false });
    label(ctx, `headTurn ${k}`, cx, 240, 14);
  });
  const row = [
    ['barry', 'deadpan', {}], ['barry', 'worried', { talk: 0.5 }], ['barry', 'happy', { accessories: { helmet: true } }],
    ['sunny', 'chill', {}], ['doreen', 'happy', { talk: 0.6 }], ['barry', 'shock', { talk: 1 }],
  ];
  row.forEach(([who, mood, extra], i) => {
    const cx = 120 + i * 208;
    drawCapybara(ctx, { who, mood, x: cx - 30, y: 470, scale: 0.86, t, headTurn: 1, ...extra });
    label(ctx, `${who} ${mood}`, cx, 560, 14);
  });
  label(ctx, 'profile in-betweens (far ear, nose front, pupils to camera) -> dissolve .47-.53 -> 3/4 (eyes settle)', 640, 300, 14);
};
lab.lighting = (ctx, t) => {
  bg(ctx, '#C9E6F2', '#F6E7CF');
  const L = [
    ['day (default)', {}], ['sunset', { tint: { color: '#FF7A3A', amount: 0.25 }, rim: '#FFD08A' }],
    ['dusk', { tint: { color: '#7A5AA8', amount: 0.3 }, rim: '#FFB0C8' }], ['eruption', { tint: { color: '#E0301A', amount: 0.35 }, rim: '#FF8A3A', accessories: { soot: 0.6, helmet: true, thermometer: { at: 'paw', reading: '41.0', level: 0.8 } } }],
  ];
  L.forEach(([name, o], i) => {
    const cx = 180 + i * 310;
    drawCapybara(ctx, { who: 'barry', x: cx - 20, y: 250, scale: 0.95, t, accessories: { helmet: true, orange: true, thermometer: { at: 'paw', reading: '39.4' } }, ...o });
    drawCapybara(ctx, { who: 'sunny', x: cx - 20, y: 540, scale: 0.85, t, ...o });
    label(ctx, name, cx, 650, 16);
  });
  label(ctx, 'tint / rim reach the accessories too (orange, helmet, thermometer, glasses glint, eye whites)', 640, 700, 13);
};
// eyes 0.4 → 0 (o.eyes) at 3× for the heavy-lidded faces: one smooth slit that darkens into a
// band, then a lash line — never white specks / a "grille of teeth"
lab.eyes = (ctx, t) => {
  bg(ctx, '#C9E6F2', '#F6E7CF');
  const ev = [0.4, 0.3, 0.22, 0.16, 0.1, 0.06, 0.02, 0];
  [['sunny', 'chill', 0], ['extra', 'sleepy', 5], ['doreen', 'happy', 0], ['barry', 'neutral', 0]].forEach(([who, mood, seed], row) => ev.forEach((e, i) => {
    const o = { who, mood, seed, eyes: e, x: 0, y: 0, scale: 2.6, t, blink: false };
    const A = capyAnchors(o);
    const cx = 80 + i * 160, cy = 95 + row * 170;
    ctx.save();
    ctx.beginPath(); ctx.rect(cx - 78, cy - 80, 156, 150); ctx.clip();
    drawCapybara(ctx, { ...o, x: cx - (A.eye.x - 0), y: cy - (A.eye.y - 0) });
    ctx.restore();
    label(ctx, `${who} ${e}`, cx, cy + 62, 12);
  }));
};
// every mood at trio / wide sizes — render with --size 1920x1080 (1.5 px per unit, as at 1080p)
function smallSheet(ctx, t, cfg) {
  bg(ctx, '#C9E6F2', '#F6E7CF');
  let y0 = 0;
  cfg.forEach(([who, sc]) => {
    const rowH = 150 * sc + 40;
    MOOD_NAMES.forEach((mood, i) => {
      const x = 150 + (i % 5) * 250, y = y0 + Math.floor(i / 5) * rowH + 30 + 95 * sc;
      drawCapybara(ctx, { who, mood, x, y, scale: sc, t: t + 0.3, blink: false });
      label(ctx, `${who} ${sc} ${mood}`, x, y + 48 * sc + 16, 12);
    });
    y0 += 2 * rowH;
  });
}
lab.small = (ctx, t) => smallSheet(ctx, t, [['barry', 0.8], ['barry', 0.5]]);
lab.small_others = (ctx, t) => smallSheet(ctx, t, [['sunny', 0.65], ['doreen', 0.55]]);
// chin strap: dangling (strap 0) → cinched V under the jaw (1), lift, talk, the swap from
// drawCapyHelmet({strap:true}) at anchors.helmet, 3/4
lab.helmet = (ctx, t) => {
  bg(ctx, '#C9E6F2', '#F6E7CF');
  const base = { who: 'barry', mood: 'deadpan', scale: 1.15, t, blink: false };
  const cells = [
    ['lift 1 (putting on)', { accessories: { helmet: { lift: 1, strap: 0 } } }], ['lift .3', { accessories: { helmet: { lift: 0.3, strap: 0 } } }],
    ['strap 0 (seated)', { accessories: { helmet: { strap: 0 } } }], ['strap .5 (cinching)', { accessories: { helmet: { strap: 0.5 } } }],
    ['strap 1 = true', { accessories: { helmet: true } }], ['talking', { talk: 0.9, accessories: { helmet: true } }],
    ['drawCapyHelmet strap:true', null], ['3/4', { headTurn: 1, accessories: { helmet: true } }],
  ];
  cells.forEach(([name, ex], i) => {
    const cx = 160 + (i % 4) * 320, cy = 230 + Math.floor(i / 4) * 330;
    const o = { ...base, x: cx - 40, y: cy };
    if (ex) drawCapybara(ctx, { ...o, ...ex });
    else {
      drawCapybara(ctx, o);
      const A = capyAnchors({ ...o, accessories: { helmet: true } });
      drawCapyHelmet(ctx, { x: A.helmet.x, y: A.helmet.y, rot: A.helmet.angle, scale: A.helmet.scale, flip: A.helmet.flip, strap: true });
    }
    label(ctx, name, cx, cy + 100, 15);
  });
};
// o.look under heavy lids: the lid follows the gaze, the pupil rolls to the lid edge
lab.look = (ctx, t) => {
  bg(ctx, '#C9E6F2', '#F6E7CF');
  const L = [['deadpan', { x: 0, y: 0 }], ['deadpan', { x: 0, y: -1 }], ['chill', { x: 0, y: -1 }], ['smug', { x: 0.3, y: -1 }], ['neutral', { x: 0, y: 1 }]];
  L.forEach(([mood, look], i) => {
    const o = { who: 'barry', mood, look, x: 0, y: 0, scale: 2.2, t, blink: false };
    const A = capyAnchors(o);
    const cx = 130 + i * 255, cy = 200;
    ctx.save();
    ctx.beginPath(); ctx.rect(cx - 125, cy - 150, 250, 260); ctx.clip();
    drawCapybara(ctx, { ...o, x: cx - A.eye.x, y: cy - A.eye.y });
    ctx.restore();
    label(ctx, `${mood} look ${look.x},${look.y}`, cx, cy + 135, 14);
  });
  ['sunny', 'doreen'].forEach((who, j) => [-1, 0, 1].forEach((ly, i) => {
    const o = { who, look: { x: 0.2, y: ly }, x: 0, y: 0, scale: 1.6, t, blink: false };
    const A = capyAnchors(o);
    const cx = 120 + (j * 3 + i) * 205, cy = 520;
    ctx.save();
    ctx.beginPath(); ctx.rect(cx - 100, cy - 110, 200, 190); ctx.clip();
    drawCapybara(ctx, { ...o, x: cx - A.eye.x, y: cy - A.eye.y });
    ctx.restore();
    label(ctx, `${who} look.y ${ly}`, cx, cy + 105, 14);
  }));
};
// robustness: out-of-range / NaN inputs must draw something sane, never throw or leak state
lab.edge = (ctx, t) => {
  bg(ctx, '#C9E6F2', '#F6E7CF');
  const tests = [
    ['sweat 5', { accessories: { sweat: 5 } }], ['soot 3 juice -1 fog 9', { accessories: { soot: 3, juice: -1, fog: 9 } }],
    ['talk 5, eyes 3', { talk: 5, eyes: 3 }], ['mood weights >1', { mood: { panic: 3, shock: 2 } }],
    ['NaN x / look', { look: { x: NaN, y: 1 }, talk: NaN }], ['scale -1', { scale: -1 }],
  ];
  tests.forEach(([name, ex], i) => {
    const cx = 140 + (i % 3) * 420, cy = 220 + Math.floor(i / 3) * 300;
    const before = ctx.getTransform();
    let msg = 'ok';
    try { drawCapybara(ctx, { who: 'barry', x: cx - 30, y: cy, scale: 0.9, t, ...ex, ...(name.startsWith('NaN') ? { x: NaN } : {}) }); } catch (e) { msg = 'THROW ' + e.message; }
    const after = ctx.getTransform();
    if (before.a !== after.a || before.e !== after.e || before.f !== after.f) msg += ' / ctx leak';
    label(ctx, `${name}: ${msg}`, cx, cy + 95, 14);
  });
};
// continuity with props.js: the rig's paw thermometer / worn go-bag / squashed orange vs the
// loose props (scenes use props.drawThermometer for inserts and loose thermometers)
lab.props_match = (ctx, t) => {
  bg(ctx, '#C9E6F2', '#F6E7CF');
  let P = null;
  try { P = require('./props'); } catch (e) { P = null; }
  drawCapybara(ctx, { who: 'barry', x: 200, y: 240, scale: 1.1, t, mood: 'worried', accessories: { thermometer: { at: 'paw', reading: '39.4', level: 0.62 } } });
  if (P && P.drawThermometer) P.drawThermometer(ctx, { x: 420, y: 330, scale: 1.3, level: 0.62, reading: '39.4', t });
  label(ctx, 'paw thermometer = props.drawThermometer', 300, 380, 14);
  drawCapybara(ctx, { who: 'barry', x: 760, y: 250, scale: 1.0, pose: 'stand', t, accessories: { backpack: true } });
  if (P && P.drawBackpack) P.drawBackpack(ctx, { x: 1110, y: 330, scale: 1.1 });
  label(ctx, 'worn go-bag vs props.drawBackpack', 900, 380, 14);
  drawCapybara(ctx, { who: 'doreen', x: 250, y: 580, scale: 1.1, t, mood: 'shock', accessories: { orange: 'squashed', juice: 1 } });
  if (P && P.drawOrange) P.drawOrange(ctx, { x: 520, y: 560, r: 18 * 1.1, squash: 1, t });
  if (P && P.drawJuiceSplat) P.drawJuiceSplat(ctx, { x: 640, y: 600, r: 30, t: 0.12 });
  label(ctx, 'orange:\'squashed\' = props.drawOrange squash 1', 400, 690, 14);
  drawCapybara(ctx, { who: 'barry', x: 960, y: 590, scale: 1.1, t, mood: 'smug', accessories: { thermometer: { at: 'mouth', reading: '39.8' } } });
  label(ctx, 'mouth thermometer: same glass + tag style', 980, 690, 14);
};

// internal hooks for tests (not part of the API)
const _test = { gap: (o) => { const r = rig(sanitize({ ...o, x: 0, y: 0, t: 0 })); return eyeLids(r, r.front ? eyes34(r).n : eyeGeom(r)).gmax; } };
module.exports = {
  _test,
  drawCapybara, capyAnchors, capyMood, drawCapyHelmet, drawCapyOrange, drawCapyThermometer,
  CAPY: { LENGTH: 232, HEIGHT: 150, MOODS: MOOD_NAMES, POSES, STRIDE }, lab,
};
