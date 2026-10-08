// CHILL CAPYBARA — capybara character rig (Barry, Sunny, Doreen, extras). See DESIGN.md §6.
//
// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────
// drawCapybara(ctx, o)        draws one capybara (side profile, faces RIGHT unless flip)
// capyAnchors(o) -> anchors   attachment points in the CALLER's coordinate space
// CAPY                        constants: { LENGTH, HEIGHT, MOODS: [...], POSES: [...] }
// lab                         asset-lab sheets: cast, moods, moods_others, poses, talk,
//                             accessories, anchors, scales_flip, closeup, turn, lighting
//                             (node src/lab.js capybara <sheet> out.png [--frames 8 --dt .1])
//
// o = {
//   x, y            origin = centre of the body at the waterline (swim) / centre of mass.
//                   Standing poses put the ground at ≈ y + 58*scale (see anchors.ground).
//   scale = 1       scale 1 → body+head ≈ 232 units long, ≈ 150 tall standing (incl. head).
//   flip = false    true → faces LEFT (mirror). Anchors mirror too.
//   rot = 0         whole-body rotation in RADIANS (caller space).
//   who             'barry' | 'sunny' | 'doreen' | 'extra'  (palette, build, default accessories)
//   seed            extras: varies colour / size / build / default mood + head item.
//   color           optional base fur colour override (hex).
//   t               global time (s) → idle motion: breathing, blinks, ear twitch, swim bob.
//   talk 0..1       jaw open (lip-sync envelope); adds a small head bob.
//   mood            'neutral'|'worried'|'panic'|'chill'|'happy'|'smug'|'deadpan'|'shock'|'sad'|'sleepy'
//                   default: barry neutral, sunny chill, doreen happy, extras sleepy/chill.
//   look {x,y}      pupil direction −1..1 (x=+1 → toward the snout, y=+1 → down).
//   eyes 0..1       override the mood's upper-lid openness (1 = wide open, 0 = shut);
//                   idle blinks still apply unless blink:false.
//   blink = true    deterministic idle blinks (per-character rhythm); false disables.
//   headTilt        DEGREES, + = snout UP (looks up), − = snout down.
//   headTurn 0..1   0 = profile; ≥ .5 = a dedicated 3/4 head turned toward the camera
//                   (both eyes / both lenses, nose pad, front mouth) — a pose-to-pose switch,
//                   so just cut 0 → 1 (or tween quickly). Pupils default to looking at camera.
//   pose            'swim' (default) | 'stand' | 'walk' | 'run' | 'sit' | 'lie'
//                   swim: no legs, the full upper body is drawn (the env's translucent front
//                         water covers it) unless `waterline` clips it.
//                   lie:  lying on the belly (couch), chin resting on the front paws.
//   walkPhase       leg cycle in CYCLES (1.0 = one full stride) for walk / run.
//   waterline       LOCAL y (unscaled units relative to the origin): nothing is drawn below it.
//                   The clip line is horizontal in caller space (y + waterline*scale).
//   pawUp 0..1      raise the near front paw (gesture / holding something). Defaults to 1
//                   when the thermometer is held in the paw.
//   pawAt {x,y}     LOCAL target for the raised paw (default ≈ just in front of the chin).
//   tremble         multiplier for the mood's trembling (panic / shock), default 1.
//   tint {color, amount=.3}  mix a light colour into the fur palette (sunset / lava glow).
//   rim             colour of the rim-light crescent along the top edges (default warm sky).
//   Line weight scales gently with size (thinner in close-ups, bolder when small).
//   accessories {   merged over the character's defaults (pass false to remove a default)
//     glasses: bool        thick black round Woody-Allen frames (Barry: always on by default)
//     orange: bool|'squashed'   orange on the head; 'squashed' = flattened splat + drips
//     helmet: bool         tiny red bike helmet (vents + chin strap); an orange stacks on top
//     flower: bool         pink hibiscus behind the ear (Doreen default)
//     necklace: bool       puka-shell necklace (Sunny default)
//     backpack: bool       Barry's go-bag
//     bird: bool           tiny songbird napping on the head (extras)
//     soot 0..1            sooty smudges + singed tufts (+ smoke wisps above .5)
//     juice 0..1           orange-juice drips running down from the crown
//     sweat 0..1           sweat drops (animated; panic adds flying drops). Moods add their
//                          own sweat (worried/panic/shock); sweat: 0 suppresses it.
//     fog 0..1             fogged-up lenses
//     thermometer: false | true | 'mouth' | 'paw' | {at:'mouth'|'paw', level:0..1, broken:0..1}
//                          true = 'mouth' (clenched like a cigar). level = red column height.
//   }
// }
//
// capyAnchors(o) — same options, returns points in caller space that include x/y/scale/
// flip/rot, pose, headTilt, headTurn, talk bob and breathing/idle motion at time t:
//   headTop  {x,y,angle}  top of the skull (top of the helmet when worn) — perch Gerald here.
//                          angle (radians, caller space) = rotation for an object resting on it.
//   stackTop {x,y,angle}  top of whatever sits on the head (orange / bird), else = headTop.
//   mouth {x,y}  front of the mouth between the lips (follows the jaw).
//   eye {x,y}    eye centre.          snout {x,y}  front of the nose pad.
//   ear {x,y}    ear.                 chin {x,y}   underside of the chin.
//   back {x,y}   middle of the back, on the fur surface (seat a passenger here).
//   rump {x,y}   top of the rump.     neck {x,y}   neck pivot.
//   paw {x,y}    near front paw (the raised paw when pawUp > 0).
//   ground {x,y} ground contact under the body (stand/walk/run/sit/lie; swim: belly bottom).
//   waterline {y}  caller-space y of the waterline (o.waterline, or local 0).
//   scale, flip, facing (+1 right / −1 left), headAngle (radians, caller space)
'use strict';

const U = require('./util');
const { TAU, clamp, lerp, mix, shade, rgba, ellipse, circle, blob, curve, hash1, noise1, smoothstep } = U;

const K = 0.9;               // internal design scale → scale 1 ≈ 232 units long
const D2R = Math.PI / 180;
const GROUND = 64;           // local y of the ground in standing poses (pre-K units)
// line-weight factor for the call in progress: outlines thin out in close-ups and stay
// readable when small (set at the start of drawCapybara, reset at the end)
let LWK = 1;

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
    build: { len: 0.86, h: 0.82 }, head: 1.12, size: 0.94, neck: 0.78,
    eye: [36, -22], lensR: 18, dome: 5,
    seed: 3.7, breath: 2.6, blinkEvery: 2.6, blinkDur: 0.13,
    pupil: 3.4, iris: false, lids: 0, lashes: false, blush: 0, tuft: true,
    acc: { glasses: true }, mood: 'neutral',
    moodMod: {
      neutral: { browTilt: 8, browY: 1, mouth: -0.14, lidSlope: 4 },
      chill: { browTilt: 3, pupil: 1.3, lid: 0.5 }, deadpan: { browTilt: 1, pupil: 1.3, lid: 0.47 },
      happy: { browTilt: 14 }, smug: { pupil: 1.2, lid: 0.42 }, sleepy: { pupil: 1.25 }, sad: { pupil: 1.2 },
    },
  },
  sunny: {
    base: '#B8834F', dark: '#8E6036', belly: '#D9B184', topTint: '#FFD88A', lowTint: '#5A3A40',
    build: { len: 1.1, h: 1.17 }, head: 1.07, size: 1.06, neck: 1.08,
    seed: 8.1, breath: 4.4, blinkEvery: 4.8, blinkDur: 0.6,
    pupil: 6.6, iris: true, lids: 0.5, lashes: false, blush: 0.25, tuft: false,
    acc: { necklace: true, orange: true }, mood: 'chill',
    moodMod: {
      neutral: { lid: 0.46, mouth: 0.6, low: 0.3, bulge: 3, browY: 2, arch: 0.6, sway: 0.5 },
      chill: { lid: 0.54, low: 0.36, bulge: 4, browY: 3, browTilt: 6, arch: 0.85, mouth: 1, blush: 0.45, sway: 1 },
      happy: { lid: 0.1, low: 0.42 }, smug: { lid: 0.56, bulge: 2 },
      deadpan: { lid: 0.6, bulge: -1 }, sleepy: { lid: 0.84 }, worried: { lid: 0.16 }, sad: { lid: 0.48 },
    },
  },
  doreen: {
    base: '#A86A4C', dark: '#844C33', belly: '#CFA07E', topTint: '#FFD6B8', lowTint: '#5A3048',
    build: { len: 1.0, h: 1.02 }, head: 0.99, size: 0.97, neck: 0.96,
    seed: 5.3, breath: 3.5, blinkEvery: 3.4, blinkDur: 0.17,
    pupil: 6.4, iris: true, lids: 0.1, lashes: true, blush: 0.6, tuft: false,
    acc: { flower: true, orange: true }, mood: 'happy',
    moodMod: { neutral: { mouth: 0.55, low: 0.16, lid: 0.16 }, chill: { mouth: 0.85, low: 0.3, bulge: 2.5 } },
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
  sway: 0, lookX: 0.3, lookY: 0, flat: 0, wavy: 0, sly: 0, askew: 0,
};
const MOODS = {
  neutral: {},
  worried: { lid: 0.06, lidSlope: 16, low: 0.1, eyeS: 1.04, pupil: 0.82, browY: 6, browTilt: 30, arch: 0.1, mouth: -0.55, wavy: 1, tilt: -1, tremble: 0.15, sweat: 0.25 },
  panic: { lid: 0, lidSlope: 6, low: 0, eyeS: 1.24, pupil: 0.55, browY: 12, browTilt: 32, arch: 0.3, mouth: -0.8, open: 0.62, tilt: 4, tremble: 1, sweat: 0.8, teeth: 1, tuftUp: 0.7 },
  chill: { lid: 0.52, lidSlope: -2, bulge: 2, low: 0.22, pupil: 1.05, browY: 1, browTilt: 8, arch: 0.55, mouth: 0.75, tilt: 3 },
  happy: { lid: 0.04, closed: -1, low: 0.45, eyeS: 1.02, pupil: 1.08, browY: 7, browTilt: 10, arch: 0.7, mouth: 1, open: 0.3, tilt: 5, blush: 0.65, teeth: 1 },
  smug: { lid: 0.44, lidSlope: -8, low: 0.26, browY: 15, browTilt: -18, arch: 1, mouth: 0.8, sly: 1, tilt: 7, lookX: 0.75 },
  deadpan: { lid: 0.52, bulge: -2.2, low: 0.2, pupil: 0.9, browY: -2, browTilt: 0, arch: 0, mouth: 0, flat: 1, lookX: 0.1 },
  shock: { lid: 0, eyeS: 1.45, pupil: 0.42, browY: 18, browTilt: 10, arch: 0.5, mouth: -0.3, open: 1, jawX: 7, tilt: 7, tremble: 0.55, sweat: 0.3, askew: 1, teeth: 1, tuftUp: 1, earUp: 1 },
  sad: { lid: 0.38, lidSlope: 18, low: 0.12, eyeS: 1.02, pupil: 1.15, browY: 3, browTilt: 28, arch: -0.15, mouth: -0.9, tilt: -8, droop: 1, lookY: 0.6, lookX: 0.2 },
  sleepy: { lid: 0.8, lidSlope: -4, bulge: 1.5, low: 0.18, browY: -4, browTilt: -4, arch: 0.2, mouth: 0.25, open: 0.06, tilt: -4, droop: 0.5 },
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

function resolveAcc(c, o) {
  const a = { ...c.acc, ...(o.accessories || {}) };
  let th = a.thermometer;
  if (th === true) th = { at: 'mouth' };
  else if (typeof th === 'string') th = { at: th };
  else if (th && typeof th === 'object') th = { at: 'mouth', ...th };
  else th = null;
  a.thermometer = th;
  a.soot = clamp(+a.soot || 0);
  a.juice = clamp(+a.juice || 0);
  a.fog = clamp(+a.fog || 0);
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
const RUN = { A: 23, duty: 0.34, H: 15 };
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
  const lod = o.lod != null ? clamp(o.lod) : clamp((0.72 - s / K) / 0.4);

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
    const air = 7 * Math.max(0, ext) + 1.5 * Math.max(0, -ext);
    Bpose = mChain(
      mT(tx + 4 + ext * 3, ty + (GROUND - 30) - bodyY - air + 3),
      mAbout(-34, 10, mR(-ext * 3.5 * D2R)),
      mAbout(-34, 20, mS(1 + 0.1 * ext, 0.93 - 0.045 * ext)),
    );
    headBase = -5 + ext * 3;
    neckOff = [7 + ext * 6, 6];
  } else if (pose === 'sit') {
    // on the haunches: body tipped up ~22° about the rump, chest held high, head level
    Bpose = mChain(mT(tx + 4, ty + 31), mAbout(-96, 26, mR(-22 * D2R)));
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
  const px = nk.x + neckOff[0] * len, py = nk.y + neckOff[1] - talk * 2.2 - br * 0.9;
  const hs = c.head;
  const H = mChain(mT(px, py), mR(headAngle), mS(hs));
  const front = turn >= 0.5; // 3/4 head (pose-to-pose switch)

  // jaw
  const mo = m.open || 0;
  const open = clamp(mo + talk * (1 - mo * 0.55));
  const jawA = open * 22 * D2R + (m.jawX || 0) * D2R * open;

  // eyes
  const bl = o.blink !== false ? blinkAt(t, seed, c.blinkEvery, c.blinkDur) : 0;
  let lid = m.lid;
  if (o.eyes != null) lid = 1 - clamp(o.eyes);
  lid = lid + (1 - lid) * bl;
  const look = o.look || (front ? { x: 0, y: m.lookY || 0 } : { x: m.lookX, y: m.lookY || 0 });

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
    const hip = bp(hx, hy), elb = bp(ex, ey);
    const wr = rotV(-1, -9, fa);
    legs.push({ kind: 'front', far, pts: [hip, elb, { x: foot.x + wr.x, y: foot.y + wr.y }], ws: [14 * w, 11.5 * w, 7.6 * w], foot, fa, fs: 0.95 });
  };
  // hind leg: hip (in the haunch) → knee (front of the haunch, at the belly line) → hock → paw
  const hindLeg = (hx, hy, kx, ky, foot, far, fa = 0, w = 1) => {
    const hip = bp(hx, hy), knee = bp(kx, ky);
    const hk = rotV(-9, -12.5, fa);
    legs.push({ kind: 'hind', far, pts: [hip, knee, { x: foot.x + hk.x, y: foot.y + hk.y }], ws: [18 * w, 12.5 * w, 7.4 * w], foot, fa, fs: 1.05, long: true });
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
      const fx = h.x + (kind === 'front' ? 8 : 2) + RUN.A * g.x;
      const foot = { x: fx, y: G0 - RUN.H * g.lift };
      // reaching paw points forward/up, trailing paw points back (toes down)
      const fa = kind === 'front' ? (g.lift > 0 ? (g.x > 0 ? -0.25 : 0.9) * g.lift : 0) : (g.lift > 0 ? (g.x < 0 ? 0.6 : -0.3) * g.lift : 0);
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
    legs.push({ kind: 'paw', far: true, pts: [s1, { x: s1.x + 34, y: G0 - 8 }, { x: 108, y: G0 - 6.5 }], ws: [13, 10.5, 7.5], foot: { x: 112, y: G0 }, fa: 0, fs: 0.95 });
    legs.push({ kind: 'paw', far: false, pts: [s2, { x: s2.x + 36, y: G0 - 8 }, { x: 124, y: G0 - 6.5 }], ws: [13, 10.5, 7.5], foot: { x: 128, y: G0 }, fa: 0, fs: 0.95 });
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
      sh = bp(40, 4); l1 = 30; l2 = 34;
      rest = { x: sh.x + 10, y: sh.y + 58 };
      tgt = o.pawAt || { x: chin.x + 20, y: chin.y - 26 };
    } else if (pose === 'lie') {
      // the chin-rest paw lifts off the couch; the elbow stays planted
      sh = bp(25, 26); l1 = 36; l2 = 40;
      rest = { x: 124, y: G0 - 6.5 };
      tgt = o.pawAt || { x: chin.x + 18, y: chin.y - 34 };
      elbowFix = { x: sh.x + 36, y: G0 - 8 };
    } else {
      sh = bp(28, 12); l1 = 32; l2 = 36;
      rest = { x: sh.x + 4, y: G0 - 8 };
      tgt = o.pawAt || { x: chin.x + 22, y: chin.y - 26 };
    }
    arm = { sh, goal: { x: lerp(rest.x, tgt.x, k), y: lerp(rest.y, tgt.y, k) }, l1, l2, elbowFix, k };
    const near = legs.findIndex((l) => !l.far && (l.kind === 'front' || l.kind === 'paw'));
    if (near >= 0) legs.splice(near, 1);
  }

  return {
    o, c, m, t, pose, mood, moods, acc, talk, s, flip, rot, seed, G, B, H, hs, headAngle, px, py, nk,
    open, jawA, lid, bl, look, earA, legs, arm, pawUp, br, len, bh, turn, front, lod, ext, geo: c.geo,
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
  if (r.front) return { perch: [F34.crown[0], F34.crown[1]], orange: [32, F34.crown[1]], helmet: [HELMET_X, -57] };
  const g = r.geo;
  return {
    perch: [PERCH_X, g.topY(PERCH_X)],
    orange: [ORANGE_X, g.topY(ORANGE_X)],
    helmet: [HELMET_X, -57 - g.helmetLift],
  };
}
// helmet / orange placement in HEAD space: {x, y (origin = middle of the bottom rim), top}
function helmetPlace(r) { const p = crownPos(r).helmet; return { x: p[0], y: p[1], top: p[1] - 24 }; }
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
  ctx.save();
  apply(ctx, r.B);
  blobTo(ctx, BODY_PTS, 1);
  ctx.restore();
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
  ctx.save();
  pathFn();
  ctx.clip();
  ctx.fillStyle = hi;
  ctx.fillRect(-500, -500, 1000, 1000);
  ctx.save();
  ctx.translate(rim[0], rim[1]);
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  pathFn();
  ctx.fill();
  ctx.restore();
  if (shadow) {
    const sg = ctx.createLinearGradient(0, shadowY0, 0, shadowY1);
    sg.addColorStop(0, rgba(shadow, 0));
    sg.addColorStop(1, rgba(shadow, shadowA));
    ctx.fillStyle = sg;
    ctx.fillRect(-500, shadowY0, 1000, 1000);
  }
  if (extra) extra();
  ctx.restore();
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
  ctx.save();
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
  ctx.restore();
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
  ctx.save();
  ctx.lineJoin = 'round';
  if (merge) {
    ctx.save();
    bodyClip(ctx, r, true);
    path();
    ctx.fillStyle = grad();
    ctx.fill();
    ctx.strokeStyle = P.line;
    ctx.lineWidth = (2) * LWK;
    ctx.stroke();
    ctx.restore();
    ctx.save();
    bodyClip(ctx, r, false);
    const j = l.pts[1];
    const g = ctx.createLinearGradient(0, j.y - 15, 0, j.y + 1);
    g.addColorStop(0, rgba(topC, 0));
    g.addColorStop(1, rgba(topC, 1));
    path();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
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
    ctx.save();
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
    ctx.restore();
  }
  drawFoot(ctx, r, l.foot.x - 1, l.foot.y, far, l.fs, l.fa || 0, !!l.long);
  ctx.restore();
}

function bodyPath(ctx) { blob(ctx, BODY_PTS, 1); }

function drawBody(ctx, r) {
  const P = r.c.pal;
  ctx.save();
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
  ctx.restore();
}

function drawNeck(ctx, r) {
  const P = r.c.pal;
  const a = mAp(r.B, 24, -18);
  const b = mAp(r.H, 4, 8);
  ctx.save();
  const nw = r.c.neck || 1;
  limbPath(ctx, a.x, a.y, b.x, b.y, 25 * nw, 23 * r.hs * nw);
  ctx.fillStyle = mix(P.base, P.dark, 0.18);
  ctx.fill();
  ctx.restore();
}

function drawHeadShadowOnBody(ctx, r) {
  const P = r.c.pal;
  const p = mAp(r.H, 16, 26);
  ctx.save();
  ctx.save();
  apply(ctx, r.B);
  bodyPath(ctx);
  ctx.restore();
  ctx.clip();
  const R = 38 * r.hs;
  const g = ctx.createRadialGradient(p.x, p.y + 4, 2, p.x, p.y + 4, R);
  g.addColorStop(0, rgba(P.low, 0.55));
  g.addColorStop(1, rgba(P.low, 0));
  ctx.fillStyle = g;
  ctx.fillRect(p.x - R, p.y + 4 - R, 2 * R, 2 * R);
  ctx.restore();
}

// folded thigh for sit / lie, merged into the body: outside the body it extends the silhouette
// (same paint as the body → no seam); inside only a soft crease + light show the thigh.
function drawHaunch(ctx, r, sit) {
  const P = r.c.pal;
  const cx = sit ? -70 : -72, cy = sit ? 14 : 18, rx = sit ? 31 : 28, ry = sit ? 27 : 24, ang = sit ? -0.15 : -0.2;
  const hp = () => ellipse(ctx, cx, cy, rx, ry, ang);
  ctx.save();
  bodyClip(ctx, r, true);
  apply(ctx, r.B);
  ctx.save();
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
  ctx.restore();
  hp();
  ctx.strokeStyle = P.line;
  ctx.lineWidth = (2.4) * LWK;
  ctx.stroke();
  ctx.restore();
  // inside: thigh light + crease along the front/top of the thigh
  ctx.save();
  apply(ctx, r.B);
  ctx.save();
  hp();
  ctx.clip();
  const lg = ctx.createRadialGradient(cx - 8, cy - 10, 2, cx - 4, cy - 4, rx);
  lg.addColorStop(0, rgba('#FFF0D8', 0.18));
  lg.addColorStop(1, rgba('#FFF0D8', 0));
  ctx.fillStyle = lg;
  ctx.fillRect(cx - rx, cy - ry, 2 * rx, 2 * ry);
  ctx.restore();
  ctx.strokeStyle = rgba(P.dark, 0.7);
  ctx.lineWidth = (2.1) * LWK;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, ang, sit ? -2.2 : -2.0, sit ? 0.55 : 0.4);
  ctx.stroke();
  flicks(ctx, [[cx - 12, cy - 16, 11, 1.9, 2.2], [cx - 4, cy - 18, 10, 1.85, 2]], P.fur);
  ctx.restore();
}

// raised near front paw: tapered upper arm + forearm, wrist, paw pad. Returns the paw pose.
function drawArm(ctx, r) {
  if (!r.arm) return null;
  const P = r.c.pal;
  const sol = armSolve(r.arm);
  const { elbow, paw, ang } = sol;
  const sh = r.arm.sh;
  const wrist = { x: paw.x - Math.cos(ang) * 6, y: paw.y - Math.sin(ang) * 6 };
  const l = { kind: 'arm', far: false, pts: [sh, elbow, wrist], ws: r.pose === 'swim' ? [12, 10, 7] : [13, 10.5, 7.2] };
  const path = () => taperPath(ctx, l.pts, l.ws);
  const topC = mix(mix(P.base, P.dark, 0.3), P.low, 0.15);
  ctx.save();
  ctx.lineJoin = 'round';
  const g = ctx.createLinearGradient(sh.x, sh.y, paw.x, paw.y);
  g.addColorStop(0, topC);
  g.addColorStop(1, mix(P.top, P.base, 0.4));
  const swim = r.pose === 'swim';
  if (!swim) {
    ctx.save();
    bodyClip(ctx, r, true);
    path(); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = P.line; ctx.lineWidth = (2) * LWK; ctx.stroke();
    ctx.restore();
    ctx.save();
    bodyClip(ctx, r, false);
    const fg = ctx.createLinearGradient(sh.x, sh.y, elbow.x, elbow.y);
    fg.addColorStop(0, rgba(topC, 0));
    fg.addColorStop(0.8, rgba(topC, 1));
    path(); ctx.fillStyle = fg; ctx.fill();
    ctx.restore();
  } else {
    path(); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = P.line; ctx.lineWidth = (2) * LWK; ctx.stroke();
  }
  // elbow crease + forearm light
  ctx.save();
  path();
  ctx.clip();
  ctx.strokeStyle = rgba(P.hi, 0.3);
  ctx.lineWidth = (3) * LWK;
  ctx.lineCap = 'round';
  const nx = -Math.sin(ang), ny = Math.cos(ang);
  ctx.beginPath();
  ctx.moveTo(elbow.x - nx * 7, elbow.y - ny * 7);
  ctx.lineTo(wrist.x - nx * 5, wrist.y - ny * 5);
  ctx.stroke();
  ctx.restore();
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
  ctx.restore();
  return { paw, ang };
}
// the "thumb": a little curl of the paw drawn OVER a held prop so it reads as gripped
function drawThumb(ctx, r, paw, ang) {
  const P = r.c.pal;
  ctx.save();
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
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────── head
function headPath(ctx, r) { blob(ctx, r ? r.geo.pts : HEAD_PTS, 0.95); }
function jawPath(ctx) { blob(ctx, JAW_PTS, 0.9); }

function drawEar(ctx, r, far) {
  const P = r.c.pal;
  ctx.save();
  const bx = EAR_BASE[0] + (far ? 13 : 0), by = EAR_BASE[1] + (far ? -4 : 0);
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
  ctx.restore();
}

function drawMouthInterior(ctx, r) {
  const open = r.jawA;
  if (open < 0.015) return;
  const top = JAW_TOP.map((p) => rotAbout(p, HINGE, open));
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(LIP[0][0], LIP[0][1]);
  for (const p of LIP) ctx.lineTo(p[0], p[1]);
  ctx.lineTo(97, 9);
  ctx.lineTo(top[0][0] + 2, top[0][1] + 1);
  for (const p of top) ctx.lineTo(p[0], p[1]);
  ctx.closePath();
  ctx.fillStyle = '#4A1C22';
  ctx.fill();
  ctx.clip();
  const tg = rotAbout([76, 18], HINGE, open * 0.9);
  ellipse(ctx, tg[0], tg[1], 18, 7, open * 0.85);
  ctx.fillStyle = '#D9716F';
  ctx.fill();
  ellipse(ctx, tg[0] + 4, tg[1] - 2.5, 8, 2, open * 0.85);
  ctx.fillStyle = 'rgba(255,205,195,0.4)';
  ctx.fill();
  const g = ctx.createLinearGradient(46, 0, 72, 0);
  g.addColorStop(0, 'rgba(25,8,10,0.8)');
  g.addColorStop(1, 'rgba(25,8,10,0)');
  ctx.fillStyle = g;
  ctx.fillRect(36, -10, 40, 60);
  ctx.restore();
}

function drawTeeth(ctx, r, minVis) {
  const P = r.c.pal;
  const vis = Math.max(clamp(r.jawA / (14 * D2R)), minVis || 0);
  if (vis < 0.05) return;
  const L = 3 + 8 * vis;
  ctx.save();
  ctx.lineWidth = (1.2) * LWK;
  ctx.strokeStyle = mix(P.line, '#8A8070', 0.35);
  U.roundRect(ctx, 83.6, 7.4, 5.4, L, 1.7);
  ctx.fillStyle = '#E6DECD';
  ctx.fill();
  ctx.stroke();
  U.roundRect(ctx, 88.4, 6.8, 6, L + 0.6, 1.9);
  ctx.fillStyle = '#FFFDF6';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawJaw(ctx, r) {
  const P = r.c.pal;
  ctx.save();
  ctx.translate(HINGE[0], HINGE[1]);
  ctx.rotate(r.jawA);
  ctx.translate(-HINGE[0], -HINGE[1]);
  paintShape(ctx, () => jawPath(ctx), {
    top: mix(P.base, P.belly, 0.35), bottom: mix(P.base, P.dark, 0.2), y0: 10, y1: 27, hi: mix(P.belly, '#FFFFFF', 0.2), rim: [0, 1.4],
    shadow: null, line: P.line, lw: 2.1,
  });
  ctx.restore();
}

// mouth line under the snout with a mood-shaped corner (continuous in every mood parameter,
// so blended moods morph smoothly)
function drawMouthLine(ctx, r) {
  const P = r.c.pal, m = r.m;
  const lod = r.lod || 0;
  const openK = clamp(r.jawA / (10 * D2R));
  const smile = clamp((m.mouth || 0) * (1 + 0.35 * lod), -1.2, 1.3);
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
    end = [C[0] - 10 - k * 3, C[1] - 2 - k * 11];
    cp1 = [C[0] - 5, C[1] + 0.5];
    cp2 = [end[0] + 1 + k, end[1] + 6 + k * 3];
  } else {
    const k = -smile;
    end = [C[0] - 9 + k, Math.min(21.6, C[1] + 2.5 + 5 * k)];
    cp1 = [C[0] - 4, C[1] + 0.3];
    cp2 = [C[0] - 8, C[1] + 0.8 + 1.5 * k];
  }
  if (flat > 0) {
    end = L(end, [C[0] - 11, C[1] + 0.6], flat);
    cp1 = L(cp1, [C[0] - 4, C[1] + 0.2], flat);
    cp2 = L(cp2, [C[0] - 8, C[1] + 0.5], flat);
  }
  ctx.save();
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
  ctx.restore();
}

function drawUpperHead(ctx, r) {
  const P = r.c.pal;
  paintShape(ctx, () => headPath(ctx, r), {
    top: P.top, bottom: mix(P.base, P.dark, 0.32), y0: -58, y1: 31, hi: P.hi, rim: [1.2, 4],
    shadow: P.low, shadowY0: 4, shadowY1: 33, shadowA: 0.5, line: P.line, lw: 2.4,
    extra: () => {
      // nose pad: darker bare skin over the top-front of the snout
      ctx.save();
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
      ctx.restore();
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
  ctx.save();
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
  ctx.restore();
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
// lid 0..~0.62 lowers the upper lid; beyond that the lower lid rises to meet it and the lash
// line morphs into the mood's closed shape (◡ relaxed / ︵ happy) a little below the centre.
function eyeLids(r, e) {
  const m = r.m;
  const lid = clamp(r.lid);
  const closeK = smoothstep(0.62, 1, lid);
  const low = clamp(m.low || 0) * (1 - r.bl * 0.4);
  const W = e.rx + 3;
  const k = Math.tan((m.lidSlope || 0) * D2R) * (1 - closeK * 0.75);
  const yMeet = e.y + e.ry * 0.3;
  const yl = lerp(e.y - e.ry + 2 * e.ry * Math.min(lid, 0.62), yMeet, closeK);
  const bulgeOpen = 2.4 + lid * 1.6 + (m.bulge || 0);
  const bulgeShut = lerp(-7, 4.5, clamp(((m.closed == null ? 1 : m.closed) + 1) / 2));
  const bulge = lerp(bulgeOpen, bulgeShut, closeK);
  const up = { yA: yl + k * W, yB: yl - k * W, yC: yl + bulge };
  const yloOpen = e.y + e.ry - 2 * e.ry * low;
  const lo0 = { yA: yloOpen + 2, yB: yloOpen + 2, yC: yloOpen - 4 * low - 1 };
  const lo = { yA: lerp(lo0.yA, up.yA + 0.6, closeK), yB: lerp(lo0.yB, up.yB + 0.6, closeK), yC: lerp(lo0.yC, up.yC + 0.6, closeK) };
  const at = (c, x) => { const u = clamp((x - (e.x - W)) / (2 * W)); return (1 - u) * (1 - u) * c.yA + 2 * u * (1 - u) * c.yC + u * u * c.yB; };
  return { lid, closeK, low, W, up, lo, at };
}
function lidCurve(ctx, e, W, c, back) { // traced front→back (back=false) or back→front
  if (!back) { ctx.lineTo(e.x + W, c.yB); ctx.quadraticCurveTo(e.x, c.yC, e.x - W, c.yA); }
  else { ctx.lineTo(e.x - W, c.yA); ctx.quadraticCurveTo(e.x, c.yC, e.x + W, c.yB); }
}

function drawEye(ctx, r, eo, mirror) {
  const P = r.c.pal, m = r.m, c = r.c;
  const e = eo || eyeGeom(r);
  if (mirror) { ctx.save(); ctx.translate(e.x, 0); ctx.scale(-1, 1); ctx.translate(-e.x, 0); r = { ...r, look: { x: -(r.look.x || 0), y: r.look.y || 0 } }; }
  const lod = r.lod || 0;
  const Ld = eyeLids(r, e);
  const { lid, closeK, low, W, up, lo } = Ld;
  const eyePath = () => ellipse(ctx, e.x, e.y, e.rx, e.ry);
  ctx.save();
  // socket shadow (fades as the eye shuts, so a closed eye never reads as a button)
  ellipse(ctx, e.x, e.y + 0.6, e.rx + 2.6, e.ry + 2.6);
  ctx.fillStyle = rgba(P.low, 0.32 * (1 - 0.75 * closeK));
  ctx.fill();
  ctx.save();
  eyePath();
  ctx.clip();
  if (closeK < 0.999) {
    const sg = ctx.createLinearGradient(0, e.y - e.ry, 0, e.y + e.ry);
    sg.addColorStop(0, '#E4D8CA');
    sg.addColorStop(0.42, '#FFFBF3');
    sg.addColorStop(1, '#FFF6E8');
    ctx.fillStyle = sg;
    ctx.fillRect(e.x - e.rx, e.y - e.ry, 2 * e.rx, 2 * e.ry);
    // pupil / iris — kept peeking out between the lids (never fully hidden by a heavy lid)
    let pr = c.pupil * (m.pupil || 1);
    if (c.iris) pr = Math.min(pr, e.rx - 2);
    if (lod > 0) pr = lerp(pr, Math.max(pr, c.iris ? 6.8 : 4.8), lod);
    const lx = clamp(r.look.x == null ? 0 : r.look.x, -1, 1), ly = clamp(r.look.y == null ? 0 : r.look.y, -1, 1);
    const ppx = e.x + lx * (e.rx - pr - 1.4);
    let ppy = e.y + ly * (e.ry - pr - 1.4) + (c.iris ? 1 : 0);
    const yTop = Ld.at(up, ppx) + 0.5 * up.yC * 0 , yBot = Ld.at(lo, ppx);
    const lidEdge = Ld.at(up, ppx) + (lid > 0.01 ? 0 : -99), lowEdge = low > 0.01 || closeK > 0 ? yBot : 99;
    const ellBot = e.y + e.ry * Math.sqrt(Math.max(0, 1 - ((ppx - e.x) / e.rx) ** 2));
    const hiLim = Math.min(lowEdge, ellBot) - pr * 0.35;
    const loLim = lidEdge + pr * 0.35;
    if (hiLim >= loLim) ppy = clamp(ppy, loLim, hiLim);
    else ppy = (lidEdge + Math.min(lowEdge, ellBot)) / 2;
    void yTop;
    if (c.iris) {
      circle(ctx, ppx, ppy, pr);
      const ig = ctx.createRadialGradient(ppx, ppy + pr * 0.35, 0.5, ppx, ppy, pr);
      ig.addColorStop(0, '#7A4A2A');
      ig.addColorStop(1, '#2A150D');
      ctx.fillStyle = ig;
      ctx.fill();
      circle(ctx, ppx, ppy, pr * 0.56);
      ctx.fillStyle = '#100705';
      ctx.fill();
    } else {
      circle(ctx, ppx, ppy, pr);
      ctx.fillStyle = '#130906';
      ctx.fill();
    }
    ctx.fillStyle = '#FFFFFF';
    const hy = Math.max(ppy - pr * 0.4, Ld.at(up, ppx + pr * 0.36) + 1.4);
    circle(ctx, ppx + pr * 0.36, hy, Math.max(1.1, pr * 0.34));
    ctx.fill();
    if (c.iris) { circle(ctx, ppx - pr * 0.4, ppy + pr * 0.38, pr * 0.13); ctx.fill(); }
  }
  // upper lid (skin): fur-coloured, a touch darker toward the lash line
  const furTop = furAt(r, e.y - e.ry), furMid = furAt(r, e.y);
  if (lid > 0.01) {
    ctx.beginPath();
    ctx.moveTo(e.x - W, e.y - e.ry - 20);
    ctx.lineTo(e.x + W, e.y - e.ry - 20);
    lidCurve(ctx, e, W, up, false);
    ctx.closePath();
    const lg = ctx.createLinearGradient(0, e.y - e.ry, 0, Math.max(up.yC, e.y - e.ry + 2));
    lg.addColorStop(0, mix(furTop, P.lid, 0.45 * (1 - closeK)));
    lg.addColorStop(1, mix(mix(P.lid, P.dark, 0.3), furMid, 0.55 * closeK));
    ctx.fillStyle = lg;
    ctx.fill();
  } else {
    const shg = ctx.createLinearGradient(0, e.y - e.ry, 0, e.y - e.ry + 6);
    shg.addColorStop(0, 'rgba(90,60,50,0.28)');
    shg.addColorStop(1, 'rgba(90,60,50,0)');
    ctx.fillStyle = shg;
    ctx.fillRect(e.x - W, e.y - e.ry, 2 * W, 7);
  }
  const lowOn = low > 0.01 || closeK > 0;
  if (lowOn) {
    ctx.beginPath();
    ctx.moveTo(e.x - W, e.y + e.ry + 20);
    ctx.lineTo(e.x + W, e.y + e.ry + 20);
    lidCurve(ctx, e, W, lo, false);
    ctx.closePath();
    ctx.fillStyle = mix(mix(P.lid, P.belly, 0.25), furAt(r, e.y + e.ry * 0.6), closeK);
    ctx.fill();
  }
  ctx.restore();
  // eye outline: crisp below the lash line, softer over the lid; fades out as the eye shuts
  const topA = 1 - 0.8 * smoothstep(0.3, 1, lid);
  const botA = 1 - 0.88 * closeK;
  ctx.lineWidth = (1.8 + 0.6 * lod) * LWK;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(e.x - W - 4, e.y + e.ry + 30);
  ctx.lineTo(e.x + W + 4, e.y + e.ry + 30);
  ctx.lineTo(e.x + W + 4, up.yB);
  lidCurve(ctx, { ...e, x: e.x }, W, up, false);
  ctx.lineTo(e.x - W - 4, up.yA);
  ctx.closePath();
  ctx.clip();
  eyePath();
  ctx.strokeStyle = rgba(P.line, botA);
  ctx.stroke();
  ctx.restore();
  if (lid > 0.01) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(e.x - W - 4, e.y - e.ry - 30);
    ctx.lineTo(e.x + W + 4, e.y - e.ry - 30);
    ctx.lineTo(e.x + W + 4, up.yB);
    lidCurve(ctx, e, W, up, false);
    ctx.lineTo(e.x - W - 4, up.yA);
    ctx.closePath();
    ctx.clip();
    eyePath();
    ctx.strokeStyle = rgba(P.line, topA);
    ctx.stroke();
    ctx.restore();
  }
  // lash lines (clipped to a slightly grown eye so the ends taper into the outline)
  ctx.strokeStyle = P.line;
  ctx.lineCap = 'round';
  if (lid > 0.01) {
    ctx.save();
    ellipse(ctx, e.x, e.y, e.rx + 1.6 + closeK * 1.5, e.ry + 1.6 + closeK * 1.5);
    ctx.clip();
    ctx.lineWidth = (3.2 + 0.4 * closeK + 1.2 * lod) * LWK;
    ctx.beginPath();
    ctx.moveTo(e.x + W, up.yB);
    ctx.quadraticCurveTo(e.x, up.yC, e.x - W, up.yA);
    ctx.stroke();
    ctx.restore();
  }
  if (lowOn && closeK < 0.95) {
    ctx.save();
    ellipse(ctx, e.x, e.y, e.rx + 1.6, e.ry + 1.6);
    ctx.clip();
    ctx.strokeStyle = rgba(P.line, 1 - closeK);
    ctx.lineWidth = (1.7) * LWK;
    ctx.beginPath();
    ctx.moveTo(e.x + W, lo.yB);
    ctx.quadraticCurveTo(e.x, lo.yC, e.x - W, lo.yA);
    ctx.stroke();
    ctx.restore();
  }
  // lashes (Doreen): three flicks at the back corner of the lid line; a relaxed shut eye
  // (◡) gets two small lashes hanging from the lash line for everyone
  const flick = (list) => {
    ctx.beginPath();
    for (const [bx, by, len, ang] of list) {
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + Math.cos(ang) * len * 0.6, by + Math.sin(ang) * len * 0.6 - 1, bx + Math.cos(ang) * len, by + Math.sin(ang) * len);
    }
    ctx.stroke();
  };
  const ellTop = (x) => e.y - e.ry * Math.sqrt(Math.max(0, 1 - ((x - e.x) * (x - e.x)) / (e.rx * e.rx)));
  if (c.lashes) {
    ctx.lineWidth = (2) * LWK;
    const pts = [[-e.rx * 0.98, 7, -2.6], [-e.rx * 0.78, 6.5, -2.25], [-e.rx * 0.5, 5.5, -1.95]].map(([dx, len, ang]) => {
      const bx = e.x + dx, by = Math.max(Ld.at(up, bx), ellTop(bx));
      const a2 = lerp(ang, -ang - 0.2, closeK * (m.closed >= 0 ? 1 : 0));
      return [bx, by, len, a2];
    });
    flick(pts);
  } else if (closeK > 0.5 && (m.closed == null || m.closed >= 0)) {
    ctx.save();
    ctx.globalAlpha = smoothstep(0.5, 1, closeK);
    ctx.lineWidth = (1.6) * LWK;
    flick([[e.x - e.rx * 0.55, Ld.at(up, e.x - e.rx * 0.55) + 0.5, 3.6, 1.9], [e.x - e.rx * 0.15, Ld.at(up, e.x - e.rx * 0.15) + 0.8, 3.2, 1.7]]);
    ctx.restore();
  }
  ctx.restore();
  if (mirror) ctx.restore();
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
  let by = onFrames ? e.y - (e.lensR || LENS_R) - 4.2 - browY * 0.5 : e.y - e.ry - 6 - browY;
  const bx = e.x + 1.5;
  const tilt = (m.browTilt || 0) * D2R * (1 + 0.5 * lod);
  const half = 13.5 * (e.bw || 1) * (1 + 0.1 * lod), arch = (m.arch || 0) * 6 * (1 + 0.5 * lod), th = 3.1 * (1 + 0.5 * lod);
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
  if (mirror) { ctx.save(); ctx.translate(e.x, 0); ctx.scale(-1, 1); ctx.translate(-e.x, 0); }
  ctx.save();
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
  ctx.restore();
  if (mirror) ctx.restore();
}

function drawTuft(ctx, r) {
  // Barry's frazzled crown tuft: a few curly locks
  const P = r.c.pal, t = r.t;
  const up = r.m.tuftUp || 0;
  ctx.save();
  const locks = [[6, -52, -13, -10, 5.6], [12, -54.5, -6, -15, 6.2], [18.5, -56, 2, -16, 6.2], [25, -56.8, 9, -13, 5.6]];
  locks.forEach(([x, y, dx, dy, w], i) => {
    const wob = noise1(t * 1.1 + i * 3.7 + r.seed) * 1.6 + (up ? noise1(t * 9 + i * 5) * 1.5 * up : 0);
    const ex = x + lerp(dx, dx * 0.3, up) + wob, ey = y + lerp(dy, -21, up);
    const curl = (i % 2 ? 1 : -1) * 4 * (1 - up);
    ctx.beginPath();
    ctx.moveTo(x - w * 0.6, y + 3);
    ctx.bezierCurveTo(x - w * 0.6 + dx * 0.15, y + dy * 0.45, ex - curl - 3, ey + 6, ex, ey);
    ctx.bezierCurveTo(ex + curl * 0.6, ey + 5, x + w * 0.5 + dx * 0.2, y + dy * 0.35, x + w * 0.6, y + 3);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? P.tuft : mix(P.tuft, P.base, 0.35);
    ctx.fill();
    ctx.strokeStyle = P.line;
    ctx.lineWidth = (1.7) * LWK;
    ctx.stroke();
  });
  ctx.restore();
}

function glassesXform(ctx, r) {
  if (!r.m.askew) return;
  const px = EAR_BASE[0] + 2, py = EAR_BASE[1] + 2;
  ctx.translate(px, py);
  ctx.rotate(0.3);
  ctx.translate(-px, -py - 12);
}

function drawGlasses(ctx, r) {
  const e = eyeGeom(r);
  const fog = r.acc.fog;
  ctx.save();
  glassesXform(ctx, r);
  const R = LENS_R, cx = e.x + 0.5, cy = e.y - 0.5;
  const FR = '#16131A';
  ctx.strokeStyle = FR;
  ctx.lineCap = 'round';
  // temple arm back to the ear
  ctx.lineWidth = (3.6) * LWK;
  ctx.beginPath();
  ctx.moveTo(cx - R + 1, cy - 5);
  ctx.quadraticCurveTo(cx - R - 6, cy - 9, EAR_BASE[0] + 1, EAR_BASE[1] + 2);
  ctx.stroke();
  // bridge over the top of the snout
  ctx.lineWidth = (4.2) * LWK;
  ctx.beginPath();
  ctx.moveTo(cx + R - 2, cy - 8);
  ctx.quadraticCurveTo(cx + R + 5, cy - 11, cx + R + 8, cy - 17);
  ctx.stroke();
  // lens
  circle(ctx, cx, cy, R);
  ctx.fillStyle = rgba('#D4ECFF', 0.14 + fog * 0.75);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // lens glint: a soft diagonal sheen in the upper-right of the lens
  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.beginPath();
  ctx.moveTo(cx + R * 0.18, cy - R); ctx.lineTo(cx + R * 0.62, cy - R); ctx.lineTo(cx + R, cy - R * 0.5); ctx.lineTo(cx + R, cy - R * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.95, cy + R * 0.25); ctx.lineTo(cx - R * 0.75, cy + R * 0.05); ctx.lineTo(cx - R * 0.2, cy + R); ctx.lineTo(cx - R * 0.55, cy + R);
  ctx.closePath();
  ctx.fill();
  if (fog > 0) {
    ctx.fillStyle = rgba('#F2F7FA', fog * 0.88);
    ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  }
  ctx.restore();
  circle(ctx, cx, cy, R);
  ctx.strokeStyle = FR;
  ctx.lineWidth = (5.6) * LWK;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = (1.4) * LWK;
  ctx.beginPath();
  ctx.arc(cx, cy, R + 0.4, -2.7, -1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, R - 0.2, 0.5, 0.9);
  ctx.stroke();
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────── accessories
function drawOrange(ctx, x, y, R, t, seed) {
  ctx.save();
  circle(ctx, x, y, R);
  const g = ctx.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R * 1.05);
  g.addColorStop(0, '#FFC867');
  g.addColorStop(0.45, '#FF9A1F');
  g.addColorStop(1, '#E06F0C');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
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
  ctx.restore();
  ellipse(ctx, x - R * 0.38, y - R * 0.42, R * 0.3, R * 0.17, -0.6);
  ctx.fillStyle = 'rgba(255,250,230,0.78)';
  ctx.fill();
  circle(ctx, x - R * 0.06, y - R * 0.64, R * 0.065);
  ctx.fill();
  circle(ctx, x, y, R);
  ctx.strokeStyle = '#B85A0A';
  ctx.lineWidth = (1.8) * LWK;
  ctx.stroke();
  // stem + leaf
  ctx.fillStyle = '#6B5A2A';
  circle(ctx, x + R * 0.05, y - R * 0.97, R * 0.1);
  ctx.fill();
  ctx.save();
  ctx.translate(x + R * 0.1, y - R * 0.98);
  ctx.rotate(-0.5 + Math.sin(t * 1.7 + (seed || 0)) * 0.06);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(R * 0.35, -R * 0.58, R * 0.98, -R * 0.36);
  ctx.quadraticCurveTo(R * 0.5, R * 0.12, 0, 0);
  ctx.closePath();
  const lg = ctx.createLinearGradient(0, -R * 0.5, R, 0);
  lg.addColorStop(0, '#86CF6C');
  lg.addColorStop(1, '#3E8E44');
  ctx.fillStyle = lg;
  ctx.fill();
  ctx.strokeStyle = '#2F6B35';
  ctx.lineWidth = (1.2) * LWK;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(R * 0.05, -R * 0.03);
  ctx.quadraticCurveTo(R * 0.45, -R * 0.3, R * 0.85, -R * 0.34);
  ctx.strokeStyle = 'rgba(220,255,200,0.6)';
  ctx.lineWidth = (0.9) * LWK;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function drawSquashedOrange(ctx, x, y, R) {
  // a flattened, burst orange sitting on the crown with a juicy splash ring
  ctx.save();
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
  g.addColorStop(0, '#FFB848');
  g.addColorStop(1, '#E8740E');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#B85A0A';
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
  ctx.fillStyle = '#FFD98A';
  ctx.fill();
  ctx.strokeStyle = '#D9771A';
  ctx.lineWidth = (1) * LWK;
  ctx.stroke();
  // bent leaf
  ctx.save();
  ctx.translate(x + R * 0.9, y - R * 0.35);
  ctx.rotate(0.5);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(R * 0.4, -R * 0.45, R * 0.9, -R * 0.1);
  ctx.quadraticCurveTo(R * 0.45, R * 0.2, 0, 0);
  ctx.fillStyle = '#5DA84F';
  ctx.fill();
  ctx.strokeStyle = '#2F6B35';
  ctx.lineWidth = (1) * LWK;
  ctx.stroke();
  ctx.restore();
  // flung droplets
  ctx.fillStyle = '#FFA42E';
  for (const [dx, dy, s, a] of [[-2.1, -1.1, 0.16, -0.9], [2.0, -1.3, 0.13, 0.8], [2.6, -0.4, 0.1, 1.2], [-2.7, -0.3, 0.1, -1.2], [0.4, -1.8, 0.12, 0.1]]) {
    teardrop(ctx, x + dx * R, y + dy * R, R * s, a);
    ctx.fill();
  }
  ellipse(ctx, x - R * 0.5, y - R * 0.45, R * 0.3, R * 0.08, -0.15);
  ctx.fillStyle = 'rgba(255,250,230,0.85)';
  ctx.fill();
  ctx.restore();
}

function drawJuice(ctx, r, amt) {
  if (amt <= 0.01) return;
  const t = r.t;
  ctx.save();
  // glossy juice coating hugging the crown
  ctx.save();
  if (r.front) head34Path(ctx); else headPath(ctx, r);
  ctx.clip();
  const cw = 40 * clamp(amt * 1.4);
  ellipse(ctx, 28, -58, cw, 6.5, 0.03);
  ctx.fillStyle = rgba('#FFA235', 0.75);
  ctx.fill();
  ellipse(ctx, 24, -55.5, cw * 0.6, 1.3, 0.03);
  ctx.fillStyle = 'rgba(255,245,215,0.7)';
  ctx.fill();
  ctx.restore();
  // rivulets: [x, y0, length, width, bend]
  const drips = [[46, -55, 24, 4.2, 2], [16, -55, 30, 4.6, -1.5], [62, -53, 13, 3.4, 1], [-2, -50, 17, 3.6, -2]];
  drips.forEach(([x, y, L, w, bend], i) => {
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
    g.addColorStop(0, '#FFBE55');
    g.addColorStop(1, '#F07F12');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(184,90,10,0.75)';
    ctx.lineWidth = (0.9) * LWK;
    ctx.stroke();
    circle(ctx, ex - R * 0.35, ey - R * 0.05, R * 0.3);
    ctx.fillStyle = 'rgba(255,250,230,0.9)';
    ctx.fill();
  });
  ctx.restore();
}

function drawSweat(ctx, r, amt) {
  if (amt <= 0.02) return;
  const t = r.t;
  const spots = [[58, -54, 0], [-10, -34, 0.37], [76, -50, 0.71], [12, -51, 0.18], [90, -45, 0.55]];
  const n = Math.max(1, Math.round(amt * spots.length));
  ctx.save();
  for (let i = 0; i < n; i++) {
    const [x, y, off] = spots[i];
    const cyc = ((t * 0.6 + off) % 1 + 1) % 1;
    const slide = cyc * 13;
    ctx.globalAlpha = cyc < 0.85 ? 1 : 1 - (cyc - 0.85) / 0.15;
    const s = 3.4 + (i % 2) * 0.7;
    teardrop(ctx, x, y + slide, s, 0);
    const g = ctx.createLinearGradient(x - s, 0, x + s, 0);
    g.addColorStop(0, '#E8FBFF');
    g.addColorStop(1, '#8FD3F2');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#4C9CC6';
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
      ctx.fillStyle = '#BFEAFF';
      ctx.fill();
      ctx.strokeStyle = '#4C9CC6';
      ctx.lineWidth = (1) * LWK;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function sootBlobs(ctx, spots, amt, seed, clipPath) {
  if (amt <= 0.01) return;
  const rr = U.rng(seed);
  ctx.save();
  clipPath();
  ctx.clip();
  // overall ashy dimming, heavier on top (ash fell from above)
  const tg = ctx.createLinearGradient(0, -90, 0, 50);
  tg.addColorStop(0, rgba('#3A3436', 0.42 * amt));
  tg.addColorStop(1, rgba('#3A3436', 0.12 * amt));
  ctx.fillStyle = tg;
  ctx.fillRect(-200, -200, 400, 400);
  for (const [x, y, R] of spots) {
    const g = ctx.createRadialGradient(x, y, R * 0.1, x, y, R * 1.6);
    g.addColorStop(0, rgba('#221B1D', 0.42 * amt));
    g.addColorStop(1, rgba('#221B1D', 0));
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.65);
    ctx.translate(-x, -y);
    ctx.fillRect(x - R * 1.7, y - R * 1.7, R * 3.4, R * 3.4);
    ctx.restore();
    // a few ash flecks
    ctx.fillStyle = rgba('#B8B0AE', 0.55 * amt);
    for (let i = 0; i < 3; i++) { circle(ctx, x + rr.range(-R, R), y + rr.range(-R, R) * 0.6, rr.range(0.7, 1.3)); ctx.fill(); }
  }
  ctx.restore();
}
function singed(ctx, x, y, n, amt, seed = 1) {
  // a little clump of frizzled, singed fur standing up
  if (amt <= 0.3) return;
  const rr = U.rng(seed);
  const k = 0.6 + amt * 0.4;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - n * 3.4, y + 1.5);
  for (let i = 0; i < n * 2; i++) {
    const px = x - n * 3.4 + ((i + 0.5) / (n * 2)) * n * 6.8;
    const h = i % 2 ? rr.range(2, 4) : rr.range(7, 11) * k;
    ctx.lineTo(px + rr.range(-1.5, 1.5), y - h);
  }
  ctx.lineTo(x + n * 3.4, y + 1.5);
  ctx.closePath();
  ctx.fillStyle = rgba('#2A2224', 0.92 * amt);
  ctx.fill();
  ctx.strokeStyle = rgba('#7E7678', 0.6 * amt);
  ctx.lineWidth = (0.8) * LWK;
  ctx.stroke();
  ctx.restore();
}

function drawHelmetStrap(ctx) {
  ctx.save();
  ctx.strokeStyle = '#2A2A30';
  ctx.lineWidth = (2.6) * LWK;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(6, -54);
  ctx.lineTo(9, -12);
  ctx.moveTo(18, -57);
  ctx.lineTo(9, -12);
  ctx.lineTo(16, 30);
  ctx.stroke();
  U.roundRect(ctx, 5.5, -16, 7.5, 6.5, 1.6);
  ctx.fillStyle = '#55555F';
  ctx.fill();
  ctx.restore();
}
function drawHelmet(ctx) {
  // tiny aero road-bike helmet: pointed tail, long vent slots, little visor
  ctx.save();
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
    top: '#F66B5E', bottom: '#C42E28', y0: -81, y1: -53, hi: '#FFA294', rim: [1.2, 3], shadow: null, line: '#7A1B18', lw: 1.9,
    extra: () => {
      // long vent slots following the dome
      const vents = [[52, -70, -0.62, 15], [37, -74.5, -0.12, 17], [21, -72.5, 0.3, 16], [8, -67, 0.55, 11]];
      for (const [x, y, a, L] of vents) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        U.roundRect(ctx, -L / 2, -2.6, L, 5.2, 2.6);
        ctx.fillStyle = '#4E1210';
        ctx.fill();
        U.roundRect(ctx, -L / 2 + 1.5, -2.2, L - 3, 1.4, 0.7);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fill();
        ctx.restore();
      }
      // white side stripe + specular
      ctx.strokeStyle = '#FFF4E8';
      ctx.lineWidth = (2.4) * LWK;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-2, -61);
      ctx.bezierCurveTo(16, -63.5, 46, -64.5, 67, -60);
      ctx.stroke();
      ellipse(ctx, 40, -77.5, 10, 2, -0.05);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fill();
    },
  });
  // rim band
  ctx.beginPath();
  ctx.moveTo(3, -51);
  ctx.bezierCurveTo(24, -58.5, 48, -59, 68, -53);
  ctx.strokeStyle = '#30303A';
  ctx.lineWidth = (3) * LWK;
  ctx.lineCap = 'round';
  ctx.stroke();
  // visor
  ctx.beginPath();
  ctx.moveTo(64, -59);
  ctx.quadraticCurveTo(75, -59.5, 80, -53);
  ctx.quadraticCurveTo(72, -54.5, 65, -54);
  ctx.closePath();
  ctx.fillStyle = '#2A2A32';
  ctx.fill();
  ctx.restore();
}

function drawFlower(ctx, r) {
  const t = r.t;
  ctx.save();
  ctx.translate(-11, -50);
  ctx.rotate(-0.3 + Math.sin(t * 1.1 + 2) * 0.03);
  ctx.scale(1.08, 1.08);
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate((i / 5) * TAU);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-7.5, -4, -8.5, -13.5, -2, -15.5);
    ctx.bezierCurveTo(2.5, -17, 7.5, -14, 6.2, -9);
    ctx.bezierCurveTo(6, -5, 3, -2, 0, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, -15);
    g.addColorStop(0, '#D93A7A');
    g.addColorStop(0.4, '#FF6FA6');
    g.addColorStop(1, '#FFB4D2');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#B02A63';
    ctx.lineWidth = (1.1) * LWK;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(190,30,90,0.45)';
    ctx.beginPath();
    ctx.moveTo(0, -2); ctx.lineTo(0, -10);
    ctx.stroke();
    ctx.restore();
  }
  circle(ctx, 0, 0, 3);
  ctx.fillStyle = '#9E1F55';
  ctx.fill();
  ctx.strokeStyle = '#E8B23A';
  ctx.lineWidth = (1.5) * LWK;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(6, -3, 11, -9);
  ctx.stroke();
  ctx.fillStyle = '#FFD84A';
  for (const [dx, dy] of [[11, -9], [12.6, -7], [9.4, -10.6], [12.2, -10.6]]) { circle(ctx, dx, dy, 1.4); ctx.fill(); }
  ctx.restore();
}

function drawNecklace(ctx, r) {
  ctx.save();
  apply(ctx, r.B);
  curve(ctx, [[8, -40], [14, -14], [24, 4], [38, 13], [50, 10]], 1);
  ctx.strokeStyle = '#6B4B2E';
  ctx.lineWidth = (1.5) * LWK;
  ctx.stroke();
  const shells = [[13.5, -18], [17.5, -5], [24.5, 5], [33, 11], [43.5, 12.6]];
  shells.forEach(([x, y], i) => {
    const R = i % 2 ? 4.4 : 5.2;
    ellipse(ctx, x, y, R, R * 0.8, i * 0.7);
    ctx.fillStyle = i % 3 === 1 ? '#F3E6CF' : '#FFF8EA';
    ctx.fill();
    ctx.strokeStyle = '#9E8266';
    ctx.lineWidth = (1.1) * LWK;
    ctx.stroke();
    circle(ctx, x + 0.5, y + 0.4, 1.2);
    ctx.fillStyle = '#8D6E52';
    ctx.fill();
  });
  circle(ctx, 38.5, 12.8, 3);
  ctx.fillStyle = '#3FB8B0';
  ctx.fill();
  ctx.strokeStyle = '#227A74';
  ctx.lineWidth = (1) * LWK;
  ctx.stroke();
  ctx.restore();
}

function drawBackpack(ctx, r) {
  ctx.save();
  apply(ctx, r.B);
  ctx.save();
  ctx.translate(-28, -66);
  ctx.rotate(0.08);
  const CD = '#2C5F7A', LN = '#1B3B4D';
  U.roundRect(ctx, -26, -18, 48, 13, 6.5);
  ctx.fillStyle = '#C8A26A';
  ctx.fill();
  ctx.strokeStyle = '#7A5C34';
  ctx.lineWidth = (1.6) * LWK;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-14, -18); ctx.lineTo(-14, -5);
  ctx.moveTo(10, -18); ctx.lineTo(10, -5);
  ctx.stroke();
  const pack = () => U.roundRect(ctx, -31, -8, 56, 32, 10);
  paintShape(ctx, pack, {
    top: '#5A9CBE', bottom: CD, y0: -8, y1: 24, hi: '#8CC4DD', rim: [1, 2.6], shadow: null, line: LN, lw: 1.9,
    extra: () => {
      ctx.beginPath();
      ctx.moveTo(-31, -1);
      ctx.quadraticCurveTo(-3, 13, 25, -1);
      ctx.lineTo(25, -10);
      ctx.lineTo(-31, -10);
      ctx.closePath();
      ctx.fillStyle = CD;
      ctx.fill();
      ctx.strokeStyle = LN;
      ctx.lineWidth = (1.4) * LWK;
      ctx.stroke();
      U.roundRect(ctx, -18, 11, 25, 11, 3);
      ctx.fillStyle = rgba(LN, 0.32);
      ctx.fill();
    },
  });
  U.roundRect(ctx, -6, 4, 6.5, 6.5, 1.2);
  ctx.fillStyle = '#E3C25A';
  ctx.fill();
  ctx.strokeStyle = '#8A6A1E';
  ctx.lineWidth = (1) * LWK;
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#263540';
  ctx.lineWidth = (4.6) * LWK;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-6, -60);
  ctx.bezierCurveTo(14, -50, 26, -22, 34, 14);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = (1.3) * LWK;
  ctx.stroke();
  ctx.restore();
}

function drawBird(ctx, r, x, y) {
  const t = r.t;
  ctx.save();
  ctx.translate(x, y);
  const C = '#F2C33F';
  ctx.beginPath();
  ctx.moveTo(-6, -5); ctx.lineTo(-15, -10); ctx.lineTo(-14, -3);
  ctx.closePath();
  ctx.fillStyle = '#C7932A';
  ctx.fill();
  ellipse(ctx, 0, -7, 9, 7);
  ctx.fillStyle = C;
  ctx.fill();
  ctx.strokeStyle = '#9A6E1C';
  ctx.lineWidth = (1.1) * LWK;
  ctx.stroke();
  circle(ctx, 5.5, -14, 5);
  ctx.fillStyle = C;
  ctx.fill();
  ctx.stroke();
  ellipse(ctx, -1.5, -6, 5, 3.3, 0.3);
  ctx.fillStyle = '#D9A12E';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(10, -15); ctx.lineTo(14.5, -13.5); ctx.lineTo(10, -12.2);
  ctx.closePath();
  ctx.fillStyle = '#F07A2A';
  ctx.fill();
  ctx.strokeStyle = '#2A1A10';
  ctx.lineWidth = (1.2) * LWK;
  ctx.lineCap = 'round';
  ctx.beginPath(); // sleepy closed eye
  ctx.arc(7, -15, 1.6, 0.2, Math.PI - 0.2);
  ctx.stroke();
  circle(ctx, 9, -12.5, 1.3);
  ctx.fillStyle = 'rgba(255,120,100,0.5)';
  ctx.fill();
  ctx.restore();
}

function drawThermometer(ctx, len, level, broken) {
  ctx.save();
  const w = 6.4;
  U.roundRect(ctx, 0, -w / 2, len, w, w / 2);
  ctx.fillStyle = 'rgba(238,249,255,0.96)';
  ctx.fill();
  ctx.strokeStyle = '#6E8494';
  ctx.lineWidth = (1.3) * LWK;
  ctx.stroke();
  const colL = (len - 8) * clamp(level);
  ctx.fillStyle = '#E2382F';
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
    ctx.strokeStyle = '#6E8494';
    ctx.beginPath();
    ctx.moveTo(1, -3.2); ctx.lineTo(-4, -6); ctx.lineTo(-2, -1); ctx.lineTo(-7, 1); ctx.lineTo(-1, 3.2); ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    circle(ctx, -1.5, 0, 5);
    ctx.fillStyle = '#E2382F';
    ctx.fill();
    ctx.strokeStyle = '#8E1E18';
    ctx.lineWidth = (1.2) * LWK;
    ctx.stroke();
    circle(ctx, -3, -1.8, 1.4);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────── 3/4 head (headTurn ≥ .5)
const HEAD34_PTS = [
  [-18, -24], [-10, -44], [6, -55], [28, -60], [52, -59], [72, -53], [87, -42], [95, -26],
  [98, -8], [96, 10], [89, 23], [75, 30], [54, 32], [30, 33], [8, 30], [-8, 20], [-17, 2],
];
const F34 = {
  eyeN: [22, -27], eyeF: [63, -35], earN: [-4, -45], earF: [58, -55], crown: [30, -60],
  nose: [80, -19], mouth: [77, 5], chin: [77, 30],
};
function head34Path(ctx) { blob(ctx, HEAD34_PTS, 0.95); }
function eyes34(r) {
  const m = r.m, glasses = !!r.acc.glasses;
  const es = (m.eyeS || 1) * (glasses ? 1.04 : 1);
  return {
    n: { x: F34.eyeN[0], y: F34.eyeN[1], rx: 12.2 * es, ry: 13.4 * es, es, glasses, lensR: LENS_R },
    f: { x: F34.eyeF[0], y: F34.eyeF[1], rx: 9.4 * es, ry: 12.6 * es, es, glasses, lensR: 18.5, bw: 0.82 },
  };
}
function drawEar34(ctx, r, far) {
  const P = r.c.pal;
  const [ex, ey] = far ? F34.earF : F34.earN;
  ctx.save();
  ctx.translate(ex, ey + 6);
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
  ctx.restore();
}
function drawGlasses34(ctx, r, E) {
  const fog = r.acc.fog;
  ctx.save();
  glassesXform(ctx, r);
  const FR = '#16131A';
  ctx.strokeStyle = FR;
  ctx.lineCap = 'round';
  const n = E.n, f = E.f;
  // temple arm (near) and bridge
  ctx.lineWidth = (3.6) * LWK;
  ctx.beginPath();
  ctx.moveTo(n.x - LENS_R + 1, n.y - 4);
  ctx.quadraticCurveTo(n.x - LENS_R - 6, n.y - 9, F34.earN[0] + 4, F34.earN[1] + 6);
  ctx.stroke();
  ctx.lineWidth = (4.6) * LWK;
  ctx.beginPath();
  ctx.moveTo(n.x + LENS_R - 2, n.y - 7);
  ctx.quadraticCurveTo((n.x + f.x) / 2 + 1, n.y - 14, f.x - 15, f.y - 3);
  ctx.stroke();
  const lens = (cx, cy, rx, ry) => {
    ellipse(ctx, cx, cy, rx, ry);
    ctx.fillStyle = rgba('#D4ECFF', 0.14 + fog * 0.75);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.beginPath();
    ctx.moveTo(cx + rx * 0.18, cy - ry); ctx.lineTo(cx + rx * 0.62, cy - ry); ctx.lineTo(cx + rx, cy - ry * 0.5); ctx.lineTo(cx + rx, cy - ry * 0.1);
    ctx.closePath();
    ctx.fill();
    if (fog > 0) { ctx.fillStyle = rgba('#F2F7FA', fog * 0.88); ctx.fillRect(cx - rx, cy - ry, 2 * rx, 2 * ry); }
    ctx.restore();
    ellipse(ctx, cx, cy, rx, ry);
    ctx.strokeStyle = FR;
    ctx.lineWidth = (5.6) * LWK;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = (1.4) * LWK;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 0.4, ry + 0.4, 0, -2.7, -1.5);
    ctx.stroke();
  };
  lens(f.x + 0.5, f.y - 0.5, 15.5, 18.5);
  lens(n.x + 0.5, n.y - 0.5, LENS_R, LENS_R);
  ctx.restore();
}
function drawMouth34(ctx, r) {
  const P = r.c.pal, m = r.m;
  const [mx, my] = F34.mouth;
  const openK = clamp(r.jawA / (22 * D2R));
  const k = m.flat ? 0 : clamp(m.mouth || 0, -1, 1) * (m.sly ? 1.2 : 1);
  const hw = 15;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (openK > 0.04) {
    const h = 4 + openK * 20;
    ctx.beginPath();
    ctx.moveTo(mx - hw + 2, my + 1 - k * 5);
    ctx.quadraticCurveTo(mx, my - 3, mx + hw - 2, my + 1 - k * 5);
    ctx.bezierCurveTo(mx + hw - 1, my + h * 0.8, mx + 7, my + h, mx, my + h);
    ctx.bezierCurveTo(mx - 7, my + h, mx - hw + 1, my + h * 0.8, mx - hw + 2, my + 1 - k * 5);
    ctx.closePath();
    ctx.fillStyle = '#4A1C22';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ellipse(ctx, mx, my + h + 1, 10, 6);
    ctx.fillStyle = '#D9716F';
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = P.line;
    ctx.lineWidth = (2.4) * LWK;
    ctx.stroke();
  }
  // buck teeth
  if (openK > 0.04 || m.teeth) {
    const L = 5 + 6 * Math.max(openK, m.teeth ? 0.3 : 0);
    ctx.lineWidth = (1.2) * LWK;
    ctx.strokeStyle = mix(P.line, '#8A8070', 0.35);
    U.roundRect(ctx, mx - 6, my - 1.5, 5.8, L, 1.8);
    ctx.fillStyle = '#FFFDF6';
    ctx.fill();
    ctx.stroke();
    U.roundRect(ctx, mx + 0.4, my - 1.5, 5.8, L, 1.8);
    ctx.fillStyle = '#F4EFE4';
    ctx.fill();
    ctx.stroke();
  }
  // philtrum + lip line ("ω" smile / frown / flat)
  ctx.strokeStyle = P.line;
  ctx.lineWidth = (2.6) * LWK;
  ctx.beginPath();
  ctx.moveTo(mx, F34.nose[1] + 8);
  ctx.lineTo(mx, my - 1);
  if (openK <= 0.04) {
    if (m.flat) {
      ctx.moveTo(mx - hw, my + 1);
      ctx.lineTo(mx + hw, my + 1);
    } else {
      const wv = m.wavy ? 2.2 : 0;
      ctx.moveTo(mx, my - 1);
      ctx.bezierCurveTo(mx - 4, my + 6 + wv, mx - hw + 4, my + 4 - k * 2 - wv, mx - hw, my + 1 - k * 6);
      ctx.moveTo(mx, my - 1);
      ctx.bezierCurveTo(mx + 4, my + 6 + wv, mx + hw - 4, my + 4 - k * 2 - wv, mx + hw, my + 1 - k * (m.sly ? 9 : 6));
    }
  }
  ctx.stroke();
  ctx.restore();
}
function drawHead34(ctx, r) {
  const a = r.acc, c = r.c, P = c.pal;
  const E = eyes34(r);
  const openK = clamp(r.jawA / (22 * D2R));
  drawEar34(ctx, r, true);
  // chin drops when the mouth opens
  paintShape(ctx, () => ellipse(ctx, F34.chin[0], F34.chin[1] - 5 + openK * 17, 17, 7.5), {
    top: mix(P.base, P.belly, 0.35), bottom: mix(P.base, P.dark, 0.2), y0: 18, y1: 34 + openK * 17, hi: mix(P.belly, '#FFFFFF', 0.2), rim: [0, 1.2],
    shadow: null, line: P.line, lw: 2.1,
  });
  paintShape(ctx, () => head34Path(ctx), {
    top: P.top, bottom: mix(P.base, P.dark, 0.32), y0: -60, y1: 33, hi: P.hi, rim: [1.2, 4],
    shadow: P.low, shadowY0: 8, shadowY1: 35, shadowA: 0.45, line: P.line, lw: 2.4,
    extra: () => {
      // muzzle front plane catches more light
      const fg = ctx.createRadialGradient(80, -4, 4, 80, -4, 34);
      fg.addColorStop(0, rgba(P.belly, 0.55));
      fg.addColorStop(1, rgba(P.belly, 0));
      ctx.fillStyle = fg;
      ctx.fillRect(40, -40, 70, 76);
      // plane break between cheek and muzzle
      ctx.strokeStyle = rgba(P.dark, 0.45);
      ctx.lineWidth = (1.9) * LWK;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(48, -16);
      ctx.bezierCurveTo(44, 0, 46, 14, 56, 24);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(8, -6);
      ctx.bezierCurveTo(8, 10, 18, 20, 32, 22);
      ctx.stroke();
      const bl = Math.max(c.blush, r.m.blush || 0);
      if (bl > 0) {
        for (const [bx, by] of [[30, -6], [92, -6]]) {
          const bg = ctx.createRadialGradient(bx, by, 1, bx, by, 12);
          bg.addColorStop(0, rgba('#F27868', 0.5 * bl));
          bg.addColorStop(1, rgba('#F27868', 0));
          ctx.fillStyle = bg;
          ctx.fillRect(bx - 14, by - 14, 28, 28);
        }
      }
      flicks(ctx, [[-11, -30, 10, 1.9, 2.2], [-5, -36, 9, 1.85, 2], [16, 8, 9, 1.9, 2]], P.fur);
    },
  });
  // nose pad + nostrils
  const [nx, ny] = F34.nose;
  ctx.save();
  blob(ctx, [[nx - 17, ny - 4], [nx - 6, ny - 11], [nx + 9, ny - 11], [nx + 17, ny - 4], [nx + 12, ny + 7], [nx, ny + 9], [nx - 12, ny + 7]], 1);
  const ng = ctx.createLinearGradient(0, ny - 11, 0, ny + 9);
  ng.addColorStop(0, mix(P.muzzle, '#8A7A7A', 0.3));
  ng.addColorStop(1, shade(P.muzzle, -0.2));
  ctx.fillStyle = ng;
  ctx.fill();
  ctx.strokeStyle = P.line;
  ctx.lineWidth = (1.8) * LWK;
  ctx.stroke();
  ctx.fillStyle = shade(P.muzzle, -0.6);
  ellipse(ctx, nx - 7.5, ny + 0.5, 3.8, 2.3, 0.45); ctx.fill();
  ellipse(ctx, nx + 7.5, ny + 0.5, 3.8, 2.3, -0.45); ctx.fill();
  ellipse(ctx, nx - 2, ny - 7.5, 6, 1.6, -0.05);
  ctx.fillStyle = 'rgba(255,245,235,0.35)';
  ctx.fill();
  // whiskers on both sides
  ctx.strokeStyle = rgba(P.line, 0.42);
  ctx.lineWidth = (0.9) * LWK;
  ctx.beginPath();
  ctx.moveTo(96, 0); ctx.quadraticCurveTo(108, -3, 116, -1);
  ctx.moveTo(96, 4); ctx.quadraticCurveTo(107, 6, 114, 10);
  ctx.moveTo(58, 0); ctx.quadraticCurveTo(48, -2, 40, 0);
  ctx.moveTo(58, 4); ctx.quadraticCurveTo(49, 7, 43, 11);
  ctx.stroke();
  ctx.restore();
  drawMouth34(ctx, r);
  if (a.soot > 0) sootBlobs(ctx, [[30, 4, 11], [86, 0, 9], [56, -48, 9]], a.soot, 77, () => head34Path(ctx));
  if (a.helmet) drawHelmetStrap(ctx);
  drawEye(ctx, r, E.f, true);
  drawEye(ctx, r, E.n, false);
  if (a.flower) drawFlower(ctx, r);
  drawEar34(ctx, r, false);
  if (c.tuft && !a.helmet) { ctx.save(); ctx.translate(8, -2); drawTuft(ctx, r); ctx.restore(); }
  if (a.helmet) drawHelmet(ctx);
  if (a.glasses) drawGlasses34(ctx, r, E);
  if (!a.helmet) { drawBrow(ctx, r, E.f, true); drawBrow(ctx, r, E.n, false); }
  singed(ctx, 40, -57, 3, a.soot, 5);
}

// ─────────────────────────────────────────────────────────────── head assembly
function drawHead(ctx, r) {
  const a = r.acc, c = r.c;
  ctx.save();
  apply(ctx, r.H);
  if (r.front) drawHead34(ctx, r);
  else {
    drawEar(ctx, r, true);
    drawMouthInterior(ctx, r);
    drawTeeth(ctx, r, 0);
    drawJaw(ctx, r);
    drawUpperHead(ctx, r);
    if (r.m.teeth && r.jawA < 0.06) drawTeeth(ctx, r, 0.25);
    drawMouthLine(ctx, r);
    if (a.soot > 0) sootBlobs(ctx, [[58, -2, 11], [94, -26, 8], [66, -46, 9], [6, -26, 10]], a.soot, 77, () => headPath(ctx, r));
    if (a.helmet) drawHelmetStrap(ctx);
    drawEye(ctx, r);
    if (a.flower) drawFlower(ctx, r);
    drawEar(ctx, r, false);
    if (c.tuft && !a.helmet) drawTuft(ctx, r);
    if (a.helmet) drawHelmet(ctx);
    if (a.glasses) drawGlasses(ctx, r);
    if (!a.helmet) drawBrow(ctx, r);
    singed(ctx, 52, -54, 3, a.soot, 5);
  }
  const crown = r.front ? F34.crown : CROWN;
  const crownY = a.helmet ? -81 : crown[1];
  if (a.orange === 'squashed') drawSquashedOrange(ctx, crown[0], crownY - 1, 15);
  else if (a.orange) drawOrange(ctx, crown[0] + 2, crownY - 16.5, 18, r.t, r.seed);
  else if (a.bird) drawBird(ctx, r, crown[0], crownY + 1.5);
  if (a.helmet) { if (r.front) { const E = eyes34(r); drawBrow(ctx, r, E.f, true); drawBrow(ctx, r, E.n, false); } else drawBrow(ctx, r); }
  drawJuice(ctx, r, a.juice);
  const sw = a.sweat == null ? (r.m.sweat || 0) : Math.max(+a.sweat || 0, a.sweat === 0 ? 0 : r.m.sweat || 0);
  drawSweat(ctx, r, sw);
  if (a.thermometer && a.thermometer.at === 'mouth') {
    ctx.save();
    if (!r.front) {
      ctx.translate(HINGE[0], HINGE[1]);
      ctx.rotate(r.jawA * 0.5);
      ctx.translate(-HINGE[0], -HINGE[1]);
    }
    if (r.front) { ctx.translate(F34.mouth[0] + 12, F34.mouth[1] + 3); ctx.rotate(-0.25); }
    else { ctx.translate(80, 12); ctx.rotate(-0.2); }
    drawThermometer(ctx, 48, a.thermometer.level == null ? 0.55 : a.thermometer.level, a.thermometer.broken || 0);
    ctx.restore();
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────── main
function drawCapybara(ctx, o) {
  const r = rig(o);
  const a = r.acc;
  LWK = clamp(Math.pow(Math.max(0.05, r.s / K), -0.33), 0.62, 1.6);
  try { drawCapybaraInner(ctx, r, o, a); } finally { LWK = 1; }
}
function drawCapybaraInner(ctx, r, o, a) {
  ctx.save();
  if (o.waterline != null) {
    const wy = (o.y || 0) + o.waterline * r.s;
    ctx.beginPath();
    ctx.rect(-1e5, -1e5, 2e5, 1e5 + wy);
    ctx.clip();
  }
  apply(ctx, r.G);
  ctx.lineJoin = 'round';
  for (const l of r.legs) if (l.far) drawLeg(ctx, r, l);
  drawBody(ctx, r);
  if (a.soot > 0) {
    ctx.save();
    apply(ctx, r.B);
    sootBlobs(ctx, [[-40, -50, 18], [-96, -16, 14], [4, -30, 12], [-66, 18, 14]], a.soot, 31, () => bodyPath(ctx));
    singed(ctx, -66, -63, 4, a.soot, 2); singed(ctx, -14, -60, 3, a.soot, 3);
    ctx.restore();
  }
  for (const l of r.legs) if (!l.far && (l.kind === 'hind' || l.kind === 'hindSit' || l.kind === 'hindTuck')) drawLeg(ctx, r, l);
  if (r.pose === 'sit') drawHaunch(ctx, r, true);
  if (r.pose === 'lie') drawHaunch(ctx, r, false);
  if (a.backpack) drawBackpack(ctx, r);
  drawNeck(ctx, r);
  drawHeadShadowOnBody(ctx, r);
  if (a.necklace) drawNecklace(ctx, r);
  for (const l of r.legs) if (!l.far && (l.kind === 'front' || l.kind === 'paw')) drawLeg(ctx, r, l);
  drawHead(ctx, r);
  const arm = drawArm(ctx, r);
  if (arm && a.thermometer && a.thermometer.at === 'paw') {
    ctx.save();
    ctx.translate(arm.paw.x + 3, arm.paw.y - 1);
    ctx.rotate(-Math.PI / 2 + 0.14);
    drawThermometer(ctx, 62, a.thermometer.level == null ? 0.55 : a.thermometer.level, a.thermometer.broken || 0);
    ctx.restore();
    ctx.save();
    ellipse(ctx, arm.paw.x + 4.5, arm.paw.y - 3, 5.5, 4.5, 0.3);
    ctx.fillStyle = r.c.pal.paw;
    ctx.fill();
    ctx.strokeStyle = r.c.pal.line;
    ctx.lineWidth = (1.5) * LWK;
    ctx.stroke();
    ctx.restore();
  }
  if (a.soot > 0.5) {
    const p = mAp(r.H, 40, -62);
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const cyc = ((r.t * 0.5 + i / 3) % 1 + 1) % 1;
      circle(ctx, p.x + Math.sin(cyc * 6 + i * 2) * 6 + (i - 1) * 10, p.y - cyc * 42, 4 + cyc * 8);
      ctx.fillStyle = rgba('#5E585A', (a.soot - 0.5) * 0.9 * (1 - cyc));
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
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

const lab = {
  cast(ctx, t) {
    bg(ctx);
    ctx.fillStyle = '#5FAF6A';
    ctx.fillRect(0, 330, 1280, 90);
    pool(ctx, 400);
    swimmer(ctx, { who: 'extra', seed: 3, x: 140, y: 452, scale: 0.6, t });
    swimmer(ctx, { who: 'extra', seed: 8, x: 1150, y: 455, scale: 0.62, flip: true, t });
    swimmer(ctx, { who: 'sunny', x: 300, y: 590, scale: 1.12, t });
    swimmer(ctx, { who: 'barry', x: 650, y: 605, scale: 1.12, mood: 'worried', t, accessories: { thermometer: { at: 'paw', level: 0.7 } } });
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
      ctx.fillStyle = 'rgba(60,110,70,0.35)';
      ctx.fillRect(cx - 190, A.ground.y - 1, 380, 4);
      drawCapybara(ctx, o);
      label(ctx, pose.toUpperCase(), cx, cy + 115, 18);
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
      ['helmet+orange', { helmet: true, orange: true, glasses: true }], ['flower', { flower: true }], ['necklace', { necklace: true }], ['backpack', { backpack: true, glasses: true }],
      ['soot 1', { soot: 1, glasses: true }], ['juice 1', { juice: 1 }], ['sweat 1', { sweat: 1 }], ['thermo mouth', { thermometer: 'mouth', glasses: true }],
      ['thermo paw', { thermometer: { at: 'paw', level: 0.8 }, glasses: true }], ['fog', { fog: 1, glasses: true }], ['bird', { bird: true }],
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
      { who: 'barry', x: 650, y: 540, scale: 0.85, pose: 'lie', flip: true },
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
      dot(ctx, A.headTop, '#FF3B3B', 'top');
      dot(ctx, A.stackTop, '#FFB000', 'stack');
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
};

lab.turn = (ctx, t) => {
  bg(ctx, '#C9E6F2', '#F6E7CF');
  const row = [
    ['barry', 'deadpan', {}], ['barry', 'worried', { talk: 0.5 }], ['barry', 'smug', { accessories: { helmet: true } }],
    ['sunny', 'chill', {}], ['doreen', 'happy', { talk: 0.3 }], ['barry', 'chill', { accessories: { orange: true } }],
  ];
  row.forEach(([who, mood, extra], i) => {
    const cx = 230 + (i % 3) * 410, cy = 230 + Math.floor(i / 3) * 330;
    drawCapybara(ctx, { who, mood, x: cx - 30, y: cy, scale: 1.05, t, headTurn: 1, ...extra });
    label(ctx, `${who} ${mood} (headTurn 1)`, cx, cy + 95, 16);
  });
};
lab.lighting = (ctx, t) => {
  bg(ctx, '#C9E6F2', '#F6E7CF');
  const L = [
    ['day (default)', {}], ['sunset', { tint: { color: '#FF7A3A', amount: 0.25 }, rim: '#FFD08A' }],
    ['dusk', { tint: { color: '#7A5AA8', amount: 0.3 }, rim: '#FFB0C8' }], ['eruption', { tint: { color: '#E0301A', amount: 0.35 }, rim: '#FF8A3A', accessories: { soot: 0.6 } }],
  ];
  L.forEach(([name, o], i) => {
    const cx = 180 + i * 310;
    drawCapybara(ctx, { who: 'barry', x: cx - 20, y: 250, scale: 0.95, t, ...o });
    drawCapybara(ctx, { who: 'sunny', x: cx - 20, y: 540, scale: 0.85, t, ...o });
    label(ctx, name, cx, 650, 16);
  });
};

module.exports = { drawCapybara, capyAnchors, CAPY: { LENGTH: 232, HEIGHT: 150, MOODS: MOOD_NAMES, POSES }, lab };
