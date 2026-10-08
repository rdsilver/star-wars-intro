// s01_open — COLD OPEN, shot like a nature documentary (0:00–0:22, spring_day).
//
//   establishing       crane down from Mount Snooze (grove, faint smoke wisp) to the whole steaming
//                      pool + the SNOOZE SPRINGS sign; the dozers settle in as "The capybara." lands.
//                      Barry is in the pool already — the only one awake, peering at something in
//                      the water (and the only one who glances up at the smoking mountain).
//   extras             slow documentary pan right along three dozers, each one framed on its line:
//                      a bird that hops round on a sleeping head / an orange as a hat / the full stack
//                      (a monkey asleep on its back, an orange on its head, the bird ON the orange,
//                      under the "No Worries Allowed" board) — "And it never asks why." (it peeks,
//                      it doesn't ask, it goes back to sleep).
//   establishing_push  back to the wide, then a long push across the drifting steam (and through the
//                      foreground leaves) onto the one capybara who is not dozing: Barry, glasses on,
//                      staring down at his paw in the water.
//   barry_cu           barry_reveal: he lifts a dripping thermometer out of the water, holds it right
//                      up to his thick glasses (squint), then at arm's length (reading 39.4).
//                      "Thirty-nine point four. Okay." (resigned blink) "Who's been touching the
//                      thermostat?" (suspicious glances at the dozers behind him, a jab of the
//                      thermometer on the question) —
//                      RECORD SCRATCH = FREEZE FRAME: snap zoom + the documentary's still frame
//                      (desaturated, a drip hangs in mid-air, a Zzz stalls, the steam stops), slow
//                      Ken-Burns push while the narrator says "Almost nothing."
//                      barry_to_camera: Barry alone comes back to life (his colour returns, the world
//                      stays frozen): eyes slide to the lens, the head follows round to camera, the
//                      thermometer comes down, a slow deadpan blink — "I heard that." — held to the cut.
'use strict';
const K = require('../lib/kit');
const U = require('../lib/util');
const CAP = require('../lib/capybara');
const CR = require('../lib/critters');
const P = require('../lib/props');
const ES = require('../lib/env_spring');
const { createCanvas } = require('@napi-rs/canvas');
const { clamp, lerp, smoothstep, ease, hash1, noise1 } = U;

const ENV = { volcanoSmoke: 0.2, waterHeat: 0.24 };
const ENV_SHORT = { ...ENV, rumble: 0, setting: 'day' };
const BARRY = { x: 400, y: 606, scale: 1.0 };
const READING = '39.4';
const THERMO_LEVEL = P.thermoLevel(39.4);
const FREEZE_DESAT = 0.62;                 // how grey the freeze frame goes

// ───────────────────────────────────────────────────────────── small helpers
const fin = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const pos = (v, d = 1) => { v = fin(v, d); return v > 1e-3 ? v : 1e-3; };
const EASE = (n) => (typeof n === 'function' ? n : ease[n] || ease.inOutCubic);
// keyed channel: [[t, v], [t, v, ease], ...] — each segment eased with the ease of its END key.
// v may be a number or {x, y}.
function ch(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i];
    if (t <= k1[0]) {
      const k0 = keys[i - 1];
      const u = EASE(k1[2] || 'inOutCubic')(clamp((t - k0[0]) / Math.max(1e-6, k1[0] - k0[0])));
      const a = k0[1], b = k1[1];
      if (typeof a === 'object') return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) };
      return lerp(a, b, u);
    }
  }
  return keys[keys.length - 1][1];
}
// monotone cubic (Fritsch–Carlson) through [[t, v]...]: smooth velocity, never overshoots — for
// camera tracks that linger on each subject without stopping dead.
const MONO = new WeakMap();
function mono(t, keys) {
  let m = MONO.get(keys);
  if (!m) {
    const n = keys.length, d = [], s = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) d.push((keys[i + 1][1] - keys[i][1]) / Math.max(1e-6, keys[i + 1][0] - keys[i][0]));
    s[0] = d[0]; s[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) s[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { s[i] = 0; s[i + 1] = 0; continue; }
      const a = s[i] / d[i], b = s[i + 1] / d[i], h = a * a + b * b;
      if (h > 9) { const k = 3 / Math.sqrt(h); s[i] = k * a * d[i]; s[i + 1] = k * b * d[i]; }
    }
    m = s; MONO.set(keys, m);
  }
  const n = keys.length;
  if (t <= keys[0][0]) return keys[0][1];
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0;
  while (i < n - 2 && t > keys[i + 1][0]) i++;
  const h = keys[i + 1][0] - keys[i][0], u = (t - keys[i][0]) / h;
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * keys[i][1] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * keys[i + 1][1] + (u3 - u2) * h * m[i + 1];
}
const bump = (t, t0, dur) => K.bump(t, t0, dur);

// ───────────────────────────────────────────────────────────── timing (from the timeline)
const TM = new WeakMap();
function times(S) {
  let C = TM.get(S.tl);
  if (C) return C;
  const L = S.lines();
  const nar = L.filter((l) => l.char === 'narrator');
  const bar = L.filter((l) => l.char === 'barry');
  const scr = K.sfxTimes(S, 'record_scratch');
  C = {
    extras: S.camStart('extras') ?? S.cue('extras_chill'),
    push: S.camStart('establishing_push'),
    cu: S.camStart('barry_cu') ?? S.cue('barry_reveal'),
    rev: S.cue('barry_reveal'), revDur: S.cueDur('barry_reveal') || 1.1,
    turn: S.cue('barry_to_camera'), turnDur: S.cueDur('barry_to_camera') || 0.9,
    n0: nar[0], n1: nar[1], n2: nar[2], n3: nar[3],
    b0: bar[0], b1: bar[1],
    end: S.duration,
  };
  C.scr = scr.length ? scr[0] : C.b0.le;
  // phrase onsets inside the narrator's extras line (measured on the lip-sync envelope):
  // "Birds perch on it." · "It wears an orange as a hat." · "And it never asks why."
  const l1 = C.n1.ls;
  C.birds = l1 + 0.13; C.orange = l1 + 1.25; C.why = l1 + 3.04; C.whyWord = l1 + 3.85;
  // Barry's line: "Thirty-nine point four." · "Okay." · "Who's been touching the thermostat?"
  const b = C.b0.ls;
  C.okay = b + 1.25; C.who = b + 1.84; C.touch = b + 2.2; C.stat = b + 2.62;
  // extras pan track (x, y, zoom), lingering on each subject while it is named
  // the stack gag on "And it never asks why.": a sleeping monkey drops onto E3's back on "never",
  // a bird lands on its orange on "why"; it peeks... and goes back to sleep
  C.monkeyLand = C.why + 0.38; C.birdLand = C.whyWord + 0.12; C.peek = C.whyWord + 0.42;
  C.panX = [[C.extras, 788], [C.birds + 0.55, 850], [C.orange + 0.35, 945], [C.orange + 1.05, 1000], [C.why + 0.12, 1076], [C.push, 1092]];
  C.panY = [[C.extras, 468], [C.birds + 0.55, 470], [C.orange + 0.35, 486], [C.orange + 1.05, 482], [C.why + 0.12, 452], [C.push, 446]];
  C.panZ = [[C.extras, 2.78], [C.birds + 0.55, 2.74], [C.orange + 0.35, 2.6], [C.orange + 1.05, 2.58], [C.why + 0.12, 2.62], [C.push, 2.74]];
  TM.set(S.tl, C);
  return C;
}

// ───────────────────────────────────────────────────────────── the dozers
// L1/L2 flank Barry (they are the "suspects" behind him in his close-up); E1–E3 are the documentary's
// three specimens on the right of the pool (the extras pan never sees Barry).
const DOZERS = [
  { id: 'L1', x: 276, y: 552, scale: 0.8, flip: false, seed: 2, ph: 0.4 },
  { id: 'L2', x: 612, y: 515, scale: 0.66, flip: true, seed: 5, ph: 1.9 },
  { id: 'E1', x: 760, y: 521, scale: 0.78, flip: false, seed: 8, ph: 2.6, bird: true },
  { id: 'E2', x: 905, y: 570, scale: 0.88, flip: false, seed: 11, ph: 3.3, orange: true },
  { id: 'E3', x: 1062, y: 532, scale: 0.8, flip: false, seed: 13, ph: 0.9, orange: true, monkey: true, birdOnOrange: true },
];
function dozerOpts(d, S, C, Tw) {
  const tw = Tw - S.scene.start;
  const o = {
    who: 'extra', seed: d.seed, x: d.x, y: d.y, scale: d.scale, flip: d.flip, pose: 'swim',
    t: Tw * 0.8 + d.ph * 3.1, blink: false, eyes: 0, mood: d.id === 'E2' || d.id === 'E3' ? 'chill' : 'sleepy',
    accessories: { orange: !!d.orange, bird: false, glasses: false },
  };
  // a slow, heavy-lidded doze: the head sinks a little and lifts with the breath
  o.headTilt = -3 + 2.2 * Math.sin(Tw * 0.9 + d.ph * 2);
  if (d.id === 'E3') {
    // sat on by a falling monkey: a dip into the water and a damped bob back up
    const um = tw - C.monkeyLand;
    if (um > 0) o.y += 7 * d.scale * Math.exp(-um * 4.5) * Math.sin(um * 12);
    // "And it never asks why.": on "why" one eye drifts half open, rolls up at the stack on its
    // head... and closes again.
    const w = C.peek;
    const open = ch(tw, [[w, 0], [w + 0.16, 0.38, 'outCubic'], [w + 0.5, 0.38], [w + 0.66, 0, 'inOutSine']]);
    if (open > 0.001) { o.eyes = open; o.look = { x: 0.2, y: -1 }; o.mood = { chill: 0.6, deadpan: 0.4 }; }
  }
  return o;
}

// ───────────────────────────────────────────────────────────── Barry
// Barry's clock: real time until the record scratch, frozen with the frame, then — when he breaks
// the freeze at barry_to_camera — running again from the frozen instant (no pop in breath/blinks).
function barryClock(C, t) {
  if (t < C.scr) return t;
  if (t < C.turn) return C.scr;
  return C.scr + (t - C.turn);
}
// The rig eases pawUp → paw position with inOutCubic (very steep around .5), so the paw is animated
// here as a POSITION fraction k (0 = arm at rest under water, 1 = raised) and converted back.
const pawFromK = (k) => { k = clamp(k); return k < 0.5 ? Math.cbrt(k / 4) : 1 - Math.cbrt(2 * (1 - k)) / 2; };
const PAW_K_TIP = 0.318;     // thermometer under water, only the tip of the tube poking out
const PAW_K_LOW = 0.24;      // lowered back into the water at the end
function barryOpts(S, C, t) {
  const tb = barryClock(C, t);
  const R = C.rev, b = C.b0.ls;
  const o = {
    who: 'barry', x: BARRY.x, y: BARRY.y, scale: BARRY.scale, flip: false, pose: 'swim',
    t: S.scene.start + tb + 0.37, blink: true, talk: 0,
    accessories: { glasses: true, thermometer: { at: 'paw', level: THERMO_LEVEL, reading: READING, tagSize: 17 } },
  };
  // ---------------- channels (tb) -----------------------------------------------------------
  // paw: tip in the water → lift (rev) → up to the glasses → arm's length → lowered a touch on
  // "Okay." → back up → the jab on "thermostat?" → (freeze) → lowered as he turns to camera
  // (lift: a little dip of anticipation, then up out of the water and settle at the chin)
  let pk = ch(tb, [
    [R + 0.06, PAW_K_TIP], [R + 0.16, PAW_K_TIP - 0.035, 'inOutSine'], [R + 0.5, 1, 'inOutCubic'],
    [C.okay, 1], [C.okay + 0.3, 0.9], [C.who, 0.92], [C.who + 0.25, 1, 'outCubic'],
  ]);
  const close = { x: 74, y: -42 }, far = { x: 116, y: -22 }, rest = { x: 104, y: -24 };
  o.pawAt = ch(tb, [
    [R + 0.1, rest], [R + 0.5, close, 'outCubic'], [R + 0.8, close], [R + 1.05, far, 'outBack'],
    [C.okay, far], [C.okay + 0.3, rest], [C.stat - 0.1, rest], [C.stat + 0.08, { x: 126, y: -14 }, 'outCubic'], [C.stat + 0.4, { x: 120, y: -18 }],
  ]);
  // little jiggle of the submerged thermometer in the wides (the only thing moving in the pool)
  if (tb < R) pk = PAW_K_TIP + 0.02 * Math.sin(tb * 2.3) + 0.03 * bump(tb, 10.6, 0.5);
  // the reading tag: hidden under water; it POPS when he holds the glass at arm's length (the
  // far-sighted "now I can read it" beat, with the take)
  let tag = K.popIn(tb, R + 0.93, 0.3);
  // head
  const glanceVol = bump(tb, 2.05, 1.5);           // in the establishing wide: a look up at the smoke
  let tilt = ch(tb, [
    [0, -9], [R + 0.02, -9], [R + 0.45, 2, 'outCubic'], [R + 0.75, -3], [R + 1.05, 3, 'outBack'],
    [b, 1], [C.okay, 0], [C.okay + 0.25, -5], [C.okay + 0.5, -2], [C.who, 1], [C.stat, 3], [C.stat + 0.2, 7, 'outBack'],
  ]);
  tilt += glanceVol * 19;
  // speech accent
  // after the question he is left with his mouth a little agape, waiting for an answer — that is
  // what the freeze frame catches
  // (it closes as he comes back to life)
  const agape = tb >= C.stat
    ? 0.3 * smoothstep(C.b0.le - 0.32, C.b0.le - 0.04, Math.min(tb, C.scr)) * (1 - smoothstep(0.05, 0.3, t - C.turn))
    : 0;
  const talk = Math.max(t >= C.scr && t < C.turn ? 0 : S.talk('barry'), agape);
  o.talk = talk;
  if (t < C.scr || t >= C.turn) tilt += 2 * noise1(S.T * 1.7 + 11) * clamp(talk * 2);
  // gaze
  let look = ch(tb, [
    [0, { x: 0.55, y: 0.85 }], [R + 0.05, { x: 0.55, y: 0.85 }], [R + 0.45, { x: 0.95, y: -0.1 }, 'outCubic'],
    [R + 0.75, { x: 1, y: -0.2 }], [R + 1.05, { x: 1, y: -0.25 }],
    [C.okay, { x: 1, y: -0.2 }], [C.okay + 0.3, { x: 0.6, y: 0.4 }],
    [C.who - 0.05, { x: 0.6, y: 0.4 }], [C.who + 0.12, { x: -1, y: -0.15 }, 'outCubic'], [C.touch - 0.05, { x: -1, y: -0.1 }],
    [C.touch + 0.12, { x: 1, y: -0.35 }, 'outCubic'], [C.stat + 0.3, { x: 1, y: -0.3 }],
  ]);
  if (tb < R - 0.2) {
    // eye darts while he frets over the water
    const k = Math.floor(tb * 1.3);
    const dx = (hash1(k * 3.7 + 1) - 0.5) * 0.6, dy = (hash1(k * 5.1 + 2) - 0.5) * 0.25;
    look = { x: clamp(look.x + dx), y: clamp(look.y + dy, -1, 1) };
    if (glanceVol > 0) look = { x: lerp(look.x, 0.85, glanceVol), y: lerp(look.y, -1, glanceVol) };
  }
  // eyes: squint at the glass, widen at the number, resigned blink on "Okay.", suspicious slits
  let eyes = ch(tb, [
    [R + 0.4, 1], [R + 0.6, 0.42, 'outCubic'], [R + 0.85, 0.42], [R + 1.0, 1, 'outBack'],
    [C.okay + 0.05, 1], [C.okay + 0.18, 0.06], [C.okay + 0.5, 0.06], [C.okay + 0.62, 0.9],
    [C.who + 0.05, 0.9], [C.who + 0.2, 0.62], [C.stat, 0.62], [C.stat + 0.2, 0.55],
  ]);
  const ctrlEyes = tb >= R + 0.35;
  // mood
  let mood = { worried: 1 };
  if (tb >= C.okay - 0.1 && tb < C.who + 0.1) {
    const k = bump(tb, C.okay - 0.1, C.who - C.okay + 0.2);
    mood = { worried: 1 - 0.6 * k, deadpan: 0.6 * k };
  } else if (tb >= C.who) {
    const k = smoothstep(C.who, C.who + 0.25, tb);
    mood = { worried: 1 - 0.45 * k, deadpan: 0.45 * k };
  }
  // ---------------- breaking the freeze: to camera ------------------------------------------------
  let headTurn = 0;
  let sx = 1, sy = 1, dy = 0;
  if (t >= C.turn) {
    const u = t - C.turn;
    // eyes first (pupils slide to the lens), a held beat, then the head comes round
    headTurn = ch(u, [[0.04, 0], [0.2, 0.2, 'outCubic'], [0.36, 0.2], [0.86, 1, 'inOutCubic']]);
    const k = smoothstep(0.3, 0.8, u);
    mood = { worried: lerp(0.55, 0, k), deadpan: lerp(0.45, 1, k) };
    tilt = lerp(tilt, -1, smoothstep(0.3, 0.86, u));
    if (headTurn >= 0.5) look = null; else look = { x: lerp(look.x, 0.15, smoothstep(0.04, 0.2, u)), y: lerp(look.y, 0, smoothstep(0.04, 0.2, u)) };
    // the stare; after the line, one slow deadpan blink (the button), then the stare again
    const bl = C.b1.le + 0.12 - C.turn;
    eyes = ch(u, [[0, eyes], [0.3, 0.56], [0.92, 0.5], [bl, 0.5], [bl + 0.12, 0.03, 'inCubic'], [bl + 0.24, 0.03], [bl + 0.42, 0.5, 'outCubic']]);
    // the thermometer goes back down into the water as the head comes round (a clean face for the
    // line); its tag shrinks away as it goes under
    const lower = ease.inOutSine(clamp((u - 0.34) / 0.62));
    pk = lerp(1, PAW_K_LOW, lower);
    o.pawAt = { x: lerp(o.pawAt.x, 104, lower), y: lerp(o.pawAt.y, -24, lower) };
    tag *= 1 - smoothstep(0.2, 0.55, lower);
    // squash pop at the drawing swap + a tiny lean toward the lens on "I heard that."
    const p = bump(u, 0.55, 0.2);
    sx = 1 - 0.03 * p; sy = 1 + 0.04 * p;
    const lean = smoothstep(C.b1.ls - 0.15, C.b1.ls + 0.5, t) * 0.025;
    sx *= 1 + lean; sy *= 1 + lean;
  }
  // a small "!" take when the reading registers (arm's length)
  const tk = K.take(tb, R + 0.95, { amount: 0.35, settle: 0.4 });
  if (t < C.turn) { sx *= tk.sx; sy *= tk.sy; dy += tk.dy; }
  o.pawUp = pawFromK(pk);
  const th = o.accessories.thermometer;
  if (tag > 0.06) th.tagSize = 17 * tag; else th.reading = null;
  o.mood = mood;
  o.headTilt = tilt;
  if (headTurn > 0) o.headTurn = headTurn;
  if (look) o.look = { x: clamp(look.x, -1, 1), y: clamp(look.y, -1, 1) };
  if (ctrlEyes) { o.eyes = clamp(eyes); o.blink = false; }
  if (t >= C.scr && t < C.turn) o.blink = false;
  o.kit = { sx, sy, dy, inWater: true };
  return o;
}

// drips from the thermometer bulb after it leaves the water (world clock, so they freeze too)
const DRIPS = [0.5, 0.62, 0.8, 1.02, 1.3, 1.7, 2.3, 3.1, 4.0, 4.3];   // s after barry_reveal
function drawDrips(ctx, S, C, Tw, sc) {
  const tw = Tw - S.scene.start;
  const tFall = 0.28;
  const drop = (t0, i) => {
    const u = tw - t0;
    if (!(u >= 0) || u > tFall + 0.45) return;
    const ob = barryOpts(S, C, Math.min(t0, C.scr - 1e-3));
    const a = K.castAnchors(ob).paw;
    if (!a || !Number.isFinite(a.x)) return;
    const x0 = a.x + 2 + (hash1(i * 3.3) - 0.5) * 4, y0 = a.y + 6;
    const wy = BARRY.y + 4;
    if (u <= tFall) {
      const y = y0 + 0.5 * 1500 * u * u;
      if (y >= wy) return;
      const r = 1.6 + 0.6 * hash1(i * 7.1);
      ctx.save();
      ctx.fillStyle = 'rgba(214,246,250,0.92)';
      ctx.strokeStyle = 'rgba(40,120,140,0.55)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x0, y - r * 2.2);
      ctx.quadraticCurveTo(x0 + r, y - r * 0.3, x0, y + r);
      ctx.quadraticCurveTo(x0 - r, y - r * 0.3, x0, y - r * 2.2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    } else {
      // a tiny ring where it lands
      const v = (u - tFall) / 0.45;
      ctx.save();
      ctx.globalAlpha = 0.7 * (1 - v);
      ctx.strokeStyle = '#E2FBF6';
      ctx.lineWidth = 1;
      U.ellipse(ctx, x0, wy, 3 + 12 * v, 1 + 3.2 * v);
      ctx.stroke();
      ctx.restore();
    }
  };
  DRIPS.forEach((d, i) => drop(C.rev + d, i));
  // the one hanging in mid-air in the freeze frame
  drop(C.scr - 0.11, 99);
}

// the little plip where the bulb and paw break the surface on the lift
function drawEmergeSplash(ctx, S, C, Tw) {
  const t0 = C.rev + 0.34;
  const u = Tw - S.scene.start - t0;
  if (!(u >= 0) || u > 1.3) return;
  const a = K.castAnchors(barryOpts(S, C, t0)).paw;
  if (!a || !Number.isFinite(a.x)) return;
  P.drawWaterSplash(ctx, { x: a.x + 2, y: BARRY.y + 2, r: 11, t: u, seed: 4, grade: 'day' });
}

// ───────────────────────────────────────────────────────────── soft steam veil (the push)
function steamPuff(ctx, x, y, r, a) {
  if (!(r > 1) || !(a > 0.004)) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(250,253,255,${0.55 * a})`);
  g.addColorStop(0.5, `rgba(246,251,255,${0.3 * a})`);
  g.addColorStop(1, 'rgba(246,251,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
}
function drawSteamVeil(ctx, S, C, Tw, amount) {
  if (!(amount > 0.01)) return;
  const T = Tw;
  ctx.save();
  for (let i = 0; i < 9; i++) {
    const h = hash1(i * 9.7 + 3);
    const life = (T * 0.12 + h) % 1;
    const x = 230 + i * 60 + 40 * Math.sin(i * 1.7) + life * 70;
    const y = 668 - life * 60 + 24 * hash1(i * 2.1);
    const r = (64 + 44 * hash1(i * 4.3)) * (0.7 + 0.6 * life);
    steamPuff(ctx, x, y, r, 0.85 * amount * Math.sin(Math.PI * life) * (0.6 + 0.4 * h));
  }
  ctx.restore();
}

// ───────────────────────────────────────────────────────────── camera
const ESTAB_A = { x: 836, y: 236, zoom: 1.34 };
const ESTAB_B = { x: 646, y: 378, zoom: 0.955 };
const CU = { zoom: 2.72 };
function barryCuBase() {
  // Barry's bob-free eye → screen (606, 318)
  const a = CAP.capyAnchors({ who: 'barry', x: BARRY.x, y: BARRY.y, scale: BARRY.scale, pose: 'swim', t: 0, blink: false });
  return { x: a.eye.x + (640 - 600) / CU.zoom, y: a.eye.y + (360 - 316) / CU.zoom, zoom: CU.zoom };
}
let CU_BASE = null;
function camAt(S, C, t) {
  const name = S.cam();
  const sh = K.shot(S);
  const ts = Math.max(0, sh.t);
  let cam;
  if (name === 'establishing') {
    // crane down off the volcano onto the whole pool (fade-in covers the start)
    const u = ease.inOutSine(clamp((t - 0.25) / 3.1));
    cam = { x: lerp(ESTAB_A.x, ESTAB_B.x, u), y: lerp(ESTAB_A.y, ESTAB_B.y, u), zoom: lerp(ESTAB_A.zoom, ESTAB_B.zoom, u) };
    cam.zoom *= 1 + 0.006 * Math.max(0, t - 3.35);
  } else if (name === 'extras') {
    cam = { x: mono(t, C.panX), y: mono(t, C.panY), zoom: mono(t, C.panZ) };
  } else if (name === 'establishing_push') {
    const u = ease.inOutSine(clamp((t - C.push) / Math.max(0.5, C.cu - C.push)));
    const A = { x: 628, y: 366, zoom: 1.03 }, B = { x: 446, y: 520, zoom: 1.86 };
    // zoom eased in log space so the push speed feels even
    cam = { x: lerp(A.x, B.x, u), y: lerp(A.y, B.y, u), zoom: Math.exp(lerp(Math.log(A.zoom), Math.log(B.zoom), u)) };
  } else {
    // barry_cu: locked off on his face; a slow creep in during the accusation; at the scratch the
    // FREEZE: snap zoom, then a slow Ken-Burns push into the still
    if (!CU_BASE) CU_BASE = barryCuBase();
    cam = { ...CU_BASE };
    const creep = smoothstep(C.who - 0.3, C.scr, t) * 0.035;
    cam.zoom *= 1 + 0.006 * Math.min(ts, 4) + creep;
    cam.x += 0.8 * Math.sin(Math.min(t, C.scr) * 0.4) / cam.zoom;
    cam.y += 0.6 * Math.sin(Math.min(t, C.scr) * 0.31 + 1) / cam.zoom;
    if (t >= C.scr) {
      const u = t - C.scr;
      const snap = ease.outCubic(clamp(u / 0.1)) * 0.075 + 0.012 * Math.sin(Math.PI * clamp(u / 0.22)) * (1 - clamp(u / 0.22));
      const kb = 0.045 * ease.inOutSine(clamp((u - 0.25) / (C.end - C.scr - 0.25)));
      cam.zoom *= 1 + snap + kb;
      // snap toward his face/thermometer (the subject of the still)
      const f = clamp(u / 0.1);
      cam.x += 6 * ease.outCubic(f);
      cam.y -= 3 * ease.outCubic(f);
    }
  }
  // subtle hand-held-on-a-tripod float for the moving shots
  if (name !== 'barry_cu') {
    const ph = sh.index * 1.7;
    cam.x += (1.2 * Math.sin(ts * 0.37 + ph)) / cam.zoom;
    cam.y += (0.9 * Math.sin(ts * 0.29 + ph * 1.3)) / cam.zoom;
  }
  return cam;
}

// E3: a sleeping monkey drops out of the trees onto its back ("never"), limbs flopping down on impact
const MONKEY_FALL = 0.4;
function drawMonkeyDrop(ctx, d, a, tw, C, Tw) {
  const u = tw - C.monkeyLand;
  if (u < -MONKEY_FALL) return;
  const s = 0.86 * d.scale;
  let x = a.back.x - 6 * d.scale, y = a.back.y + 2 * d.scale, drape = 0.9, sx = 1, sy = 1, rot = -0.04;
  if (u < 0) {
    const g = 2 * 230 / (MONKEY_FALL * MONKEY_FALL);
    y -= 0.5 * g * u * u;
    x -= 150 * u;                    // rolled off a palm frond, upper right
    drape = 0.12;                    // still curled up, fast asleep
    sx = 0.94; sy = 1.08;
    rot = -0.04 + 0.25 * u;
  } else {
    drape = lerp(0.12, 0.9, ease.outBack(clamp(u / 0.32)));
    const q = Math.exp(-u * 9);
    sx = 1 + 0.2 * q; sy = 1 - 0.26 * q;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  CR.drawMonkey(ctx, { x: 0, y: 0, scale: s, flip: false, rot, t: Tw, sleep: true, drape });
  ctx.restore();
}
// E3: a bird swoops in from the right and lands on its orange ("why"), then chirps
const BIRD_FLY = 0.5;
function drawBirdLanding(ctx, d, a, tw, C, Tw) {
  const u = tw - C.birdLand;
  if (u < -BIRD_FLY) return;
  const p2 = { x: a.stackTop.x - 1, y: a.stackTop.y + 1 };
  const s = 0.8 * d.scale;
  if (u < 0) {
    const k = ease.outCubic(1 + u / BIRD_FLY);
    const p0 = { x: p2.x + 270, y: p2.y - 30 }, p1 = { x: p2.x + 90, y: p2.y - 75 };
    const x = (1 - k) * (1 - k) * p0.x + 2 * (1 - k) * k * p1.x + k * k * p2.x;
    const y = (1 - k) * (1 - k) * p0.y + 2 * (1 - k) * k * p1.y + k * k * p2.y - 6 * (1 - k);
    CR.drawBird(ctx, { x, y, scale: s, flip: true, t: Tw + 1.7, seed: 9, pose: 'fly', flapPhase: tw * 8.5, rot: -0.25 * k });
    return;
  }
  const q = Math.exp(-u * 10) * Math.sin(u * 30);
  const chirp = bump(u, 0.22, 0.26) + bump(u, 0.52, 0.22);
  ctx.save();
  ctx.translate(p2.x, p2.y);
  ctx.rotate(a.stackTop.angle || 0);
  ctx.scale(1 + 0.12 * Math.max(0, q), 1 - 0.18 * Math.max(0, q));
  CR.drawBird(ctx, { x: 0, y: 0, scale: s, flip: true, t: Tw + 1.7, seed: 9, chirp: clamp(chirp), look: { x: 0.5, y: 0.3 } });
  ctx.restore();
}
// rings on the water where E3 got sat on
function drawDipRings(ctx, S, C, Tw) {
  const u = Tw - S.scene.start - C.monkeyLand;
  if (!(u > 0) || u > 0.9) return;
  const d = DOZERS[4];
  ctx.save();
  ctx.strokeStyle = '#E2FBF6';
  for (let i = 0; i < 2; i++) {
    const v = (u - i * 0.18) / 0.7;
    if (!(v > 0) || v >= 1) continue;
    ctx.globalAlpha = 0.45 * (1 - v) * (1 - v);
    ctx.lineWidth = 1.2 * (1 - v) + 0.4;
    U.ellipse(ctx, d.x + 8, d.y + 2, 105 * d.scale + 60 * v, 12 + 12 * v);
    ctx.stroke();
  }
  ctx.restore();
}

// ───────────────────────────────────────────────────────────── stage items
// generous on-screen test for a swimmer (the stage never culls custom items itself)
function onScreen(cam, x, y, sc, extraTop = 0) {
  const vw = 640 / cam.zoom + 60, vh = 360 / cam.zoom + 60;
  const hw = 180 * sc, top = 240 * sc + extraTop, bot = 150 * sc;
  return !(x + hw < cam.x - vw || x - hw > cam.x + vw || y + bot < cam.y - vh || y - top > cam.y + vh);
}
function dozerItems(S, C, Tw, cam) {
  const tw = Tw - S.scene.start;
  const items = [];
  for (const d of DOZERS) {
    if (!onScreen(cam, d.x, d.y, d.scale, d.id === 'E3' ? 260 : 60)) continue;
    const o = dozerOpts(d, S, C, Tw);
    o.kit = { sx: 1, sy: 1, dy: 0 };
    items.push({
      x: d.x, y: d.y,
      water: { w: 250 * d.scale * 0.95, depth: 110 * d.scale },
      draw: (ctx) => {
        K.drawCast(ctx, o);
        if (!(d.bird || d.monkey || d.birdOnOrange)) return;
        const a = CAP.capyAnchors(o);
        if (d.monkey && a.back) drawMonkeyDrop(ctx, d, a, tw, C, Tw);
        if (d.bird && a.headTop) {
          // "Birds perch on it.": a hop-and-turn round on the sleeping head, then a chirp
          const h0 = C.birds + 0.42, hop = clamp((tw - h0) / 0.3);
          const jump = hop > 0 && hop < 1 ? Math.sin(Math.PI * hop) * 13 * d.scale : 0;
          const flip = tw >= h0 + 0.15;           // faced the tail, turns to face the snout
          const ch1 = bump(tw, C.birds + 0.95, 0.32) + bump(tw, C.birds + 1.32, 0.28);
          const squat = bump(tw, h0 - 0.08, 0.12) * 0.12 + bump(tw, h0 + 0.3, 0.12) * 0.1;
          ctx.save();
          ctx.translate(a.headTop.x, a.headTop.y);
          ctx.rotate(a.headTop.angle || 0);
          ctx.scale(1 + squat * 0.5, 1 - squat);
          CR.drawBird(ctx, { x: 4 * d.scale, y: -jump, scale: 1.08 * d.scale, flip: !flip, t: Tw + 0.3, seed: 3, chirp: clamp(ch1), look: { x: 0.6, y: 0.1 } });
          ctx.restore();
        }
        if (d.birdOnOrange && a.stackTop) drawBirdLanding(ctx, d, a, tw, C, Tw);
      },
    });
  }
  return items;
}
function barryItem(S, C, ob) {
  return {
    x: ob.x, y: ob.y,
    water: { w: 255 * ob.scale * 0.94, depth: 110 * ob.scale },
    draw: (ctx) => K.drawCast(ctx, ob),
  };
}

// Zzz from L1 (behind Barry) while Barry accuses the room — frozen mid-air with the frame
function drawSnore(ctx, S, C, Tw) {
  const tw = Tw - S.scene.start;
  if (tw < C.rev) return;
  const d = DOZERS[0];
  const o = dozerOpts(d, S, C, Tw);
  const a = CAP.capyAnchors(o);
  if (!a.headTop) return;
  P.drawZzz(ctx, { x: a.headTop.x + 6, y: a.headTop.y - 4, t: tw - C.rev + 0.6, scale: 0.6, count: 3, period: 2.4 });
}

// ───────────────────────────────────────────────────────────── foreground leaves (nature-doc framing)
function drawFrameLeaves(ctx, S, C, t, cam, Tw) {
  const name = S.cam();
  let amount = 0, sc = 1, dx = 0, dy = 0;
  if (name === 'establishing') {
    amount = 1;
    // leaves slide in from below as the crane comes down
    const u = ease.inOutSine(clamp((t - 0.25) / 3.1));
    dy = lerp(150, 0, u);
    sc = 1 + 0.15 * (1 - u);
  } else if (name === 'establishing_push') {
    // we push THROUGH them: they grow and slide out of frame
    const u = ease.inOutSine(clamp((t - C.push) / Math.max(0.5, C.cu - C.push)));
    amount = 1;
    sc = 1 + 1.6 * u * u;
    dy = 40 * u;
    if (u > 0.92) return;
  }
  if (!(amount > 0)) return;
  ctx.save();
  ctx.translate(640 + dx, 360 + dy);
  ctx.scale(sc, sc);
  ctx.translate(-640, -360);
  ES.drawForegroundFoliage(ctx, Tw, { ...ENV_SHORT, amount, sides: 'both', top: false });
  ctx.restore();
}

// ───────────────────────────────────────────────────────────── the documentary's lower third
// Pops up with the freeze frame (the silent beat before "Almost nothing."), is wiped away the moment
// Barry breaks the freeze and looks at us.
function drawLowerThird(ctx, C, t) {
  const tin = t - (C.scr + 0.12);
  if (tin < 0) return;
  const tout = t - C.turn;
  const kin = ease.outCubic(clamp(tin / 0.32));
  const kout = tout > 0 ? ease.inCubic(clamp(tout / 0.2)) : 0;
  if (kout >= 1) return;
  const x = 64, y = 600;
  ctx.save();
  // soft backing so it reads over any part of the still
  const g = ctx.createLinearGradient(x - 30, 0, x + 560, 0);
  g.addColorStop(0, `rgba(8,12,18,${0.5 * kin * (1 - kout)})`);
  g.addColorStop(0.6, `rgba(8,12,18,${0.3 * kin * (1 - kout)})`);
  g.addColorStop(1, 'rgba(8,12,18,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 30, y - 62, 590, 104);
  // the rule wipes in from the left, the type follows
  const rw = 380 * kin * (1 - kout);
  ctx.fillStyle = `rgba(255,214,122,${0.95 * (1 - kout)})`;
  ctx.fillRect(x, y - 2, Math.max(0.5, rw), 3);
  const kt = ease.outCubic(clamp((tin - 0.08) / 0.3)) * (1 - kout);
  ctx.globalAlpha = kt;
  ctx.translate(-24 * (1 - kt), 0);
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '600 34px Fredoka';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('THE CAPYBARA', x, y - 14);
  ctx.font = 'italic 700 26px Nunito';
  ctx.fillStyle = '#F2EBDD';
  ctx.fillText('Hydrochoerus neuroticus', x, y + 30);
  ctx.restore();
}

// ───────────────────────────────────────────────────────────── freeze frame look
function freezeGrade(ctx, k) {
  if (!(k > 0.001)) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const W = ctx.canvas ? ctx.canvas.width : 1280, H = ctx.canvas ? ctx.canvas.height : 720;
  ctx.globalCompositeOperation = 'saturation';
  ctx.fillStyle = `rgba(128,128,128,${clamp(k * FREEZE_DESAT)})`;
  ctx.fillRect(0, 0, W, H);
  // a faint warm "print" cast
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = `rgba(214,170,112,${0.35 * k})`;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ───────────────────────────────────────────────────────────── render
module.exports = {
  render(ctx, t, S) {
    const C = times(S);
    const frozen = t >= C.scr;
    const alive = t >= C.turn;              // Barry breaks the freeze
    const Tw = frozen ? S.scene.start + C.scr : S.T;        // world clock
    const SS = frozen ? S.tl.sceneTime(S.id, Tw) : S;       // stage time (frozen world)
    const cam = camAt(S, C, t);
    const ob = barryOpts(S, C, t);
    const name = S.cam();

    const items = dozerItems(S, C, Tw, cam);
    if (onScreen(cam, ob.x, ob.y, ob.scale)) items.push(barryItem(S, C, ob));
    const veil = name === 'establishing_push'
      ? clamp(1.25 - 1.3 * ease.inOutSine(clamp((t - C.push) / Math.max(0.5, C.cu - C.push))))
      : 0;

    const st = K.drawSpringStage(ctx, Tw - S.scene.start, SS, {
      cast: { barry: false, sunny: false, doreen: false },
      env: ENV,
      items,
      camera: cam,
      foliage: false,
      hooks: {
        afterCast: (c) => {
          drawDrips(c, S, C, Tw);
          if (name === 'barry_cu') drawEmergeSplash(c, S, C, Tw);
          if (name === 'extras') drawDipRings(c, S, C, Tw);
          if (name === 'barry_cu') drawSnore(c, S, C, Tw);
        },
        afterWater: (c) => drawSteamVeil(c, S, C, Tw, veil),
      },
    });
    drawFrameLeaves(ctx, S, C, frozen ? C.scr : t, st.cam, Tw);

    if (frozen) {
      // the documentary's still: grey it out on the scratch frame (2-frame ramp)
      const k = smoothstep(0, 0.09, t - C.scr);
      freezeGrade(ctx, k);
    }
    if (alive) {
      // only Barry comes back to life — in colour. The grade above already greyed him with the still;
      // his above-water part is drawn again on top in colour (crossfading in), while everything below
      // his waterline (seen through the water) stays part of the grey world.
      const back = smoothstep(0.02, 0.24, t - C.turn);
      const colourBarry = (c) => U.withCamera(c, st.cam, () => K.drawCast(c, { ...ob, waterline: 0 }));
      if (back >= 0.999) colourBarry(ctx);
      else if (back > 0.001) {
        // crossfade as ONE layer (a multi-shape drawing at partial alpha would go see-through)
        const W = ctx.canvas.width, H = ctx.canvas.height;
        const layer = createCanvas(W, H), lc = layer.getContext('2d');
        lc.setTransform(ctx.getTransform());
        colourBarry(lc);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = back;
        ctx.drawImage(layer, 0, 0);
        ctx.restore();
      }
    }
    if (frozen) drawLowerThird(ctx, C, t);
  },
};
