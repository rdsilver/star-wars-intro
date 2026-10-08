// s03_spring — THE PETTY GRIEVANCES (0:26–1:17, spring_day).
// The long trio dialogue scene that plants every running gag: Barry's chart, the spare orange,
// "tradition", "nothing is free", Doreen's one thought, Gerald landing on Barry's head, "no reason",
// "I have glasses". Reaction shots and listening faces carry it.
//
// STAGING (shot index → camera):
//   0 barry_cu   chart: the board thunks into the rock, the zigzag draws on, frowny face; Barry
//                taps it twice with his snout, eyes on Sunny ("see?")
//   1 sunny_cu   "Bro. There's no thermostat." — Barry at the right edge: eye-roll on "Bro", then
//                he turns to face Sunny
//   2 barry_cu   "Then who's touching it?" (facing Sunny, chart behind him)
//   3 trio       Doreen dips her snout and nudges the spare orange across to Barry; Sunny watches it
//                glide; "Who decided oranges go on our heads?" — eyes: the orange, Doreen's orange,
//                his own bare head
//   4 sunny_cu   "It's tradition, bro." — Barry snaps round to Sunny, eye-roll on "bro"
//   5 barry_cu   "Tradition is just a meeting nobody wrote down!" → turns to Doreen (camera eases
//                across); "where do the oranges even come from?" glances up toward Mount Snooze
//                (plant); "Nothing is free, Doreen!" flicks the orange back with his snout (skip +
//                splash)
//   6 doreen_cu  the orange bumps home under her chin; "I had a thought once…" eyes drift up,
//                a cloud crosses at "Back in March", a little shudder, "Didn't care for it." blissful;
//                Barry's deadpan glance to camera at the left edge
//   7 trio       opens wide on Mount Snooze; Gerald flaps in from the crater side (downstrokes on
//                the flaps sfx), flares while the camera pushes in on Barry;
//                Sunny + Doreen watch him delighted, Barry stares ahead and braces
//   8 barry_cu   THUMP on the land sfx (squash), Gerald turns to face front; Barry's eyes roll
//                slowly up and stay there (slow push-in)
//   9 doreen_cu  "Aw. He likes you." (looks up at Gerald, tilts her head)
//  10 barry_cu   "That's a reservation." (Gerald nestles in) / "Six weeks…" indignant head
//                jabs up at him on "sit / guy / introduce / yourself"
//  11 gerald_cu  "Gerald." polite nod; Barry's upturned eyes below
//  12 barry_cu   "Thank you! Was that so hard?" (smug, up) / "Why my head, Gerald?"
//  13 gerald_cu  "Oh…" glances off toward the volcano … "no reason." back down at Barry
//  14 barry_cu   rant: deadpan → worried → panic, accelerating push-in, lift on "reason!"
//  15 sunny_cu   "Bro. Chill." — eye-roll, then Barry (and Gerald) turn to Sunny
//  16 barry_cu   "Chill is for animals with nothing to lose, Sunny." … chin up on "I have
//                glasses." — a cartoon glint sweeps the lens; Gerald peers down at them.
'use strict';
const K = require('../lib/kit');
const U = require('../lib/util');
const P = require('../lib/props');
const ES = require('../lib/env_spring');
const CAP = require('../lib/capybara');

const { clamp, lerp, ease, smoothstep } = U;
const SP = ES.SPRING;
const B0 = SP.swimSpots.barry;                 // {650, 600}
const EYE_DX = 53, EYE_Y = 550;                // Barry's bob-free eye offset (scale 1)
const SUNNY_EYE = { x: 435, y: 528 };
const DOREEN_EYE = { x: 889, y: 535 };
const DOREEN_ORANGE = { x: 900, y: 492 };
const GROVE = { x: 790, y: 330 };               // Mount Snooze's orange grove (the "where from?")
const ROCK = SP.barryRock.top;                  // {794, 532}
const CHART = { x: ROCK.x + 7, y: ROCK.y + 8, scale: 0.86 };
const CHART_C = { x: CHART.x, y: CHART.y - 74 * CHART.scale };
const O_HOME = { x: 826, y: 603 };              // spare orange: under Doreen's snout
const O_BARRY = { x: 779, y: 611 };             // … in front of Barry's snout
const O_RET = { x: 832, y: 604 };               // … back home after the flick

const fin = (v, d = 0) => (Number.isFinite(v) ? v : d);
const sinBump = (t, t0, dur) => K.bump(t, t0, dur);

// ───────────────────────────────────────────────────────────── timing table (memoised per timeline)
const MEMO = new WeakMap();
function timesOf(S) {
  let m = MEMO.get(S.tl);
  if (!m) { m = {}; MEMO.set(S.tl, m); }
  if (m[S.id]) return m[S.id];
  const ln = (who, txt) => {
    const l = K.lineWith(S, who, txt);
    if (!l) throw new Error(`s03_spring: no ${who} line "${txt}"`);
    return l;
  };
  const L = {
    sunny1: ln('sunny', 'no thermostat'), barry1: ln('barry', "who's touching"),
    doreen1: ln('doreen', 'put an orange'), barry2: ln('barry', 'who decided'),
    sunny2: ln('sunny', "it's tradition"), barry3: ln('barry', 'meeting nobody'),
    barry4: ln('barry', 'nothing is free'), doreen2: ln('doreen', 'thought once'),
    doreen3: ln('doreen', 'he likes you'), barry5: ln('barry', 'reservation'),
    barry6: ln('barry', 'six weeks'), gerald1: ln('gerald', 'gerald.'),
    barry7: ln('barry', 'thank you'), barry8: ln('barry', 'why my head'),
    gerald2: ln('gerald', 'no reason'), barry9: ln('barry', 'somebody with'),
    sunny3: ln('sunny', 'whole species'), barry10: ln('barry', 'i have glasses'),
  };
  const T = { L };
  T.chart = S.cue('barry_chart');
  T.tap1 = T.chart + 0.9; T.tap2 = T.chart + 1.2;          // snout contacts with the board
  T.turn1 = L.sunny1.ls + 1.1;                              // after the "Bro." eye-roll → Sunny
  T.turn2 = L.doreen1.ls + 0.3;                             // → Doreen ("Honey…")
  T.turn3 = L.sunny2.ls + 0.24;                             // snaps → Sunny ("tradition")
  T.turn4 = L.barry4.ls - 0.32;                             // → Doreen ("And where…")
  T.turn5 = L.sunny3.ls + 1.06;                             // after "Bro." → Sunny
  T.nudge = L.doreen1.ls + 0.6;                             // Doreen's snout touches the orange
  T.flick = L.barry4.ls + 2.5;                              // "…is free" — snout flicks it back
  T.skipLand = T.flick + 0.3;
  T.home = T.flick + 1.24;                                  // bumps home under Doreen's chin
  T.flaps = K.sfxTimes(S, 'flaps')[0] ?? S.cue('vulture_lands');
  T.touch = K.sfxTimes(S, 'land')[0] ?? S.cue('barry_looks_up');
  T.lookUp = S.cue('barry_looks_up');
  // the flaps sfx: 5 strokes (max push 0.08 s after each start), feathers settle at 1.3 s
  T.strokes = [0, 0.28, 0.55, 0.82, 1.1].map((s) => T.flaps + s + 0.08);
  // Doreen's thought (line-relative, from the lip-sync envelope)
  T.thought = L.doreen2.ls + 1.45;                          // "I had a thought once."
  T.march = L.doreen2.ls + 2.78;                            // "Back in March."
  T.shudder = L.doreen2.ls + 3.55;                          // the pause before "Didn't care for it."
  T.didnt = L.doreen2.ls + 3.78;                            // "Didn't care for it."
  T.reason1 = L.barry9.ls + 0.55;                           // after "No reason."
  T.somebody = L.barry9.ls + 1.68;                          // "Somebody…"
  T.withReason = L.barry9.ls + 2.33;                        // "…with a reason!"
  T.glasses = L.barry10.ls + 3.04;                          // "…glasses." — the lens glint
  T.jabs = ['sit', 'guy', 'introduce', 'yourself'].map((w) => K.wordTime(S, L.barry6, w)).filter((x) => x != null);
  m[S.id] = T;
  return T;
}

// ───────────────────────────────────────────────────────────── helpers
// weight-map blend of moods (string | map)
function moodMap(m) { return m && typeof m === 'object' ? m : { [m]: 1 }; }
function blendMood(a, b, k) {
  const A = moodMap(a), Bm = moodMap(b), w = {};
  for (const n in A) w[n] = (w[n] || 0) + A[n] * (1 - k);
  for (const n in Bm) w[n] = (w[n] || 0) + Bm[n] * k;
  for (const n in w) if (w[n] < 1e-3) delete w[n];
  return w;
}
// windowed override: kit mood outside, keyed moods inside, crossfaded at both edges
function windowMood(S, who, t, t0, t1, keys, fade = 0.25) {
  const w = K.fadeWindow(t, t0, t1, fade, fade);
  if (w <= 0) return undefined;
  const mine = typeof keys === 'string' ? keys : CAP.capyMood(t, keys, 0.25);
  if (w >= 1) return mine;
  return blendMood(K.moodAt(S, who).weights, mine, ease.inOutSine(w));
}
function lookTo(from, to, flip) {
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy);
  if (!(d > 4)) return { x: 0.3, y: 0 };
  const f = flip ? -1 : 1;
  return { x: clamp((f * dx / d) * 1.25, -1, 1), y: clamp((dy / d) * 1.4, -1, 1) };
}
// keyed gaze: [[t, target, dur=.12], ...]; target = {x,y} local look | fn(t) → local look
function keyedLook(t, keys) {
  let i = -1;
  for (let k = 0; k < keys.length; k++) if (keys[k][0] <= t) i = k;
  if (i < 0) i = 0;
  const val = (k) => { const v = keys[k][1]; return typeof v === 'function' ? v(t) : v; };
  const cur = val(i);
  if (i === 0) return cur;
  const dur = keys[i][2] ?? 0.12;
  const u = (t - keys[i][0]) / Math.max(1e-3, dur);
  if (u >= 1) return cur;
  const prev = val(i - 1), k = ease.inOutSine(clamp(u));
  return { x: lerp(prev.x, cur.x, k), y: lerp(prev.y, cur.y, k) };
}
// small neurotic eye darts layered on a held gaze
function dart(t, amt = 1) {
  const P0 = 0.95, u = (t + 0.21) / P0, slot = Math.floor(u), ph = u - slot;
  const h = (n) => U.hash1(n);
  const jx = (h(slot * 3.1 + 0.7) - 0.5) * 0.36, jy = (h(slot * 5.7 + 0.2) - 0.5) * 0.24;
  const px = (h((slot - 1) * 3.1 + 0.7) - 0.5) * 0.36, py = (h((slot - 1) * 5.7 + 0.2) - 0.5) * 0.24;
  const k = smoothstep(0, 0.09, ph * P0);
  return { x: lerp(px, jx, k) * amt, y: lerp(py, jy, k) * amt };
}
// Barry's facing from the keys (flip flips half-way through the .3 s squash turn)
function facingKeys(T) {
  return [[0, 'right'], [T.turn1, 'left'], [T.turn2, 'right'], [T.turn3, 'left'], [T.turn4, 'right'], [T.turn5, 'left']];
}
function barryFlip(T, t) {
  let f = false;
  for (const [kt, v] of facingKeys(T)) if (t >= kt + 0.15) f = v === 'left';
  return f;
}
// damped tap: anticipation pull-back, jab, settle (0 → 1 at contact → 0)
function jab(t, tc, pre = 0.12, post = 0.2) {
  const u = t - tc;
  if (u < -pre - 0.06 || u > post) return 0;
  if (u < -pre) return -0.25 * ease.inOutSine((u + pre + 0.06) / 0.06);
  if (u < 0) return lerp(-0.25, 1, ease.inCubic((u + pre) / pre));
  return ease.inOutSine(1 - u / post);
}

// ───────────────────────────────────────────────────────────── the spare orange
function orangeAt(T, t) {
  let x, y, air = 0, rot, bob = 1;
  if (t < T.nudge) {
    x = O_HOME.x; y = O_HOME.y; rot = 0.25;
  } else if (t < T.flick) {
    const k = ease.outCubic(clamp((t - T.nudge) / 1.25));
    // tiny overshoot bump against Barry's chin, then rest
    const b = 2.5 * Math.sin(Math.PI * clamp((t - T.nudge - 1.0) / 0.5)) * (t > T.nudge + 1.0 ? 1 : 0);
    x = lerp(O_HOME.x, O_BARRY.x, k) + b; y = lerp(O_HOME.y, O_BARRY.y, k);
    rot = 0.25 - 1.1 * k;
  } else if (t < T.skipLand) {
    const k = (t - T.flick) / (T.skipLand - T.flick);
    x = lerp(O_BARRY.x, 806, k); y = lerp(O_BARRY.y, 607, k);
    air = 22 * 4 * k * (1 - k);
    rot = -0.85 + 2.2 * k; bob = 0;
  } else {
    const k = ease.outCubic(clamp((t - T.skipLand) / (T.home - T.skipLand)));
    const back = t > T.home ? -3 * Math.sin(Math.PI * clamp((t - T.home) / 0.45)) : 0;
    x = lerp(806, O_RET.x, k) + back; y = lerp(607, O_RET.y, k);
    rot = 1.35 + (U.TAU + 0.25 - 1.35) * k;              // rolls home, leaf back on top
  }
  return { x, y, air, rot, bob };
}
function drawSpareOrange(ctx, st, T) {
  const t = st.t, o = orangeAt(T, t);
  const bobY = o.bob * Math.sin(st.T * 2.1 + 0.7) * 1.3;
  const r = 15;
  // contact splashes: Doreen's nudge, Barry's flick, the skip landing
  P.drawOrange(ctx, { x: o.x, y: o.y - r * 0.62 + bobY - o.air, r, rot: o.rot, t: st.T, seed: 3, grade: 'day' });
}
function drawOrangeFx(ctx, st, T) {
  const t = st.t;
  const o = orangeAt(T, t);
  if (t > T.flick - 0.02 && t < T.flick + 1.0) P.drawWaterSplash(ctx, { x: O_BARRY.x + 4, y: O_BARRY.y, r: 13, t: t - T.flick, seed: 7, grade: 'day' });
  if (t > T.skipLand - 0.02 && t < T.skipLand + 1.2) P.drawWaterSplash(ctx, { x: 806, y: 607, r: 15, t: t - T.skipLand, seed: 11, grade: 'day' });
  if (t > T.nudge - 0.02 && t < T.nudge + 0.9) P.drawWaterSplash(ctx, { x: O_HOME.x - 6, y: O_HOME.y, r: 9, t: t - T.nudge, seed: 5, grade: 'day', part: 'front' });
  // motion lines while it skates across
  if (t > T.skipLand && t < T.skipLand + 0.45) {
    P.drawMotionLines(ctx, { x: o.x - 18, y: o.y - 9, angle: 0, len: 26, count: 3, spread: 14, gap: 6, width: 1.8, alpha: 0.7 * (1 - (t - T.skipLand) / 0.45), t: st.T, seed: 4 });
  }
}

// ───────────────────────────────────────────────────────────── chart on the rock
function chartState(T, t) {
  const u = t - T.chart;
  // thunk: planted from a few units up with a little bounce, then the zigzag draws on
  const drop = u < 0.16 ? -10 * (1 - ease.inQuad(clamp(u / 0.16))) : 1.6 * Math.sin(Math.PI * clamp((u - 0.16) / 0.18));
  let rot = -0.045 + K.wobble(t, T.chart + 0.16, { amp: 0.05, freq: 3.2, decay: 6 });
  rot += K.wobble(t, T.tap1, { amp: 0.085, freq: 3.4, decay: 5 }) + K.wobble(t, T.tap2, { amp: 0.1, freq: 3.4, decay: 4.5 });
  const progress = clamp((u - 0.18) / 0.62);
  return { dy: drop, rot, progress: ease.inOutSine(progress) };
}
function drawChartProp(ctx, st, T) {
  const c = chartState(T, st.t);
  P.drawChart(ctx, { x: CHART.x, y: CHART.y + c.dy, scale: CHART.scale, rot: c.rot, progress: c.progress, grade: 'day' });
  // the frowny face lands with a little pop ring
  const pu = st.t - (T.chart + 0.8);
  if (pu > 0 && pu < 0.35) {
    const a = CHART.scale, fx = CHART.x + 33 * a, fy = CHART.y + c.dy - 97 * a;
    ctx.save();
    ctx.strokeStyle = `rgba(226,56,47,${0.8 * (1 - pu / 0.35)})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(fx, fy, Math.max(0.5, 5 + pu * 40), 0, U.TAU);
    ctx.stroke();
    ctx.restore();
  }
}

// ───────────────────────────────────────────────────────────── Gerald's wing beats (flaps sfx)
function geraldFlap(T, t) {
  const s = T.strokes, per = 0.275, PEAK = 0.27;        // downstroke mid-point = max push
  if (t < s[0]) return PEAK - (s[0] - t) / per;
  for (let i = 0; i < s.length - 1; i++) {
    if (t < s[i + 1]) return i + PEAK + (t - s[i]) / (s[i + 1] - s[i]);
  }
  const last = s.length - 1 + PEAK;
  const up = s.length;                                  // wings up (integer phase) for the flare
  const k = clamp((t - s[s.length - 1]) / 0.2);
  return lerp(last, up, ease.outQuad(k));
}

// ───────────────────────────────────────────────────────────── cast
function barryCfg(S, T, t) {
  const L = T.L;
  const flip = barryFlip(T, t);
  const eye = { x: B0.x + (flip ? -EYE_DX : EYE_DX), y: EYE_Y };
  const to = (p) => () => lookTo(eye, p, flip);
  const UP = { x: 0.22, y: -1 };
  const BACK = { x: -1, y: -0.12 };                       // over the shoulder (facing away)
  const orangeLook = () => { const o = orangeAt(T, t); return lookTo(eye, { x: o.x, y: o.y - 9 - o.air }, flip); };
  const keys = [
    [0, to(CHART_C)],
    [T.chart + 0.5, BACK, 0.14],                          // "see?" — at Sunny while tapping
    [T.turn1 + 0.1, to(SUNNY_EYE), 0.1],
    [L.doreen1.ls + 0.12, BACK, 0.1],                     // Doreen speaks behind him
    [T.turn2 + 0.12, to(DOREEN_EYE), 0.1],
    [T.nudge - 0.1, orangeLook, 0.14],                    // watches it come
    [L.doreen1.le - 0.35, to(DOREEN_EYE), 0.12],
    [L.barry2.ls, orangeLook, 0.1],                       // "Who decided…" (at the orange)
    [L.barry2.ls + 0.5, to(DOREEN_ORANGE), 0.1],          // "…oranges…" (at hers)
    [L.barry2.ls + 1.16, UP, 0.16],                       // "…on our heads?" (his own bare head)
    [L.barry2.le + 0.2, to(DOREEN_EYE), 0.14],
    [L.sunny2.ls + 0.08, BACK, 0.1],
    [T.turn3 + 0.1, to(SUNNY_EYE), 0.1],
    [T.turn4 + 0.12, to(DOREEN_EYE), 0.1],
    [L.barry4.ls + 0.5, orangeLook, 0.12],                // "…the oranges…"
    [L.barry4.ls + 1.05, to(GROVE), 0.2],                 // "…even come from?" (up at the mountain)
    [L.barry4.ls + 2.0, orangeLook, 0.1],                 // "Nothing is free…"
    [T.flick + 0.2, to(DOREEN_EYE), 0.1],                 // "…Doreen!"
    [L.barry4.le + 0.1, orangeLook, 0.14],                // watches it go home
    [L.doreen2.ls + 0.1, to(DOREEN_EYE), 0.14],
    [T.didnt, { x: 0.05, y: 0.04 }, 0.22],                // "Didn't care for it." — glance at us
    [L.doreen2.le + 0.25, { x: 0.38, y: 0.04 }, 0.2],     // braced, dead ahead (the landing)
    [T.lookUp + 0.12, UP, 0.55],                          // the slow roll up … and stays
    [L.barry5.ls - 0.12, to(DOREEN_EYE), 0.14],           // "That's not affection, Doreen."
    [L.barry5.ls + 1.62, UP, 0.14],                       // "…That's a reservation."
    [L.barry5.le + 0.05, to(DOREEN_EYE), 0.14],
    [L.barry6.ls + 0.06, UP, 0.12],                       // "Six weeks on my head!"
    [L.barry6.ls + 1.25, to(DOREEN_EYE), 0.12],           // "You sit on a guy,…"
    [L.barry6.ls + 1.95, UP, 0.12],                       // "…you introduce yourself!"
    [L.barry9.ls + 0.48, to(DOREEN_EYE), 0.1],            // "You know who says no reason?"
    [T.withReason - 0.1, UP, 0.1],                        // "…with a reason!"
    [L.sunny3.ls + 0.1, BACK, 0.1],
    [T.turn5 + 0.1, to(SUNNY_EYE), 0.1],
  ];
  let look = keyedLook(t, keys);
  // neurotic micro-darts while holding a gaze (not during the dead-still landing / roll-up)
  const still = Math.max(K.fadeWindow(t, T.thought - 0.2, L.barry5.ls - 0.15, 0.3, 0.1),
    0.7 * K.fadeWindow(t, L.barry10.ls - 0.2, S.duration + 1, 0.3, 0.1));
  const d = dart(t, 1 - still);
  look = { x: clamp(look.x + d.x), y: clamp(look.y + d.y, -1, 1) };

  // moods: chart "see?" (smug edge) · deadpan from Doreen's thought through the landing ·
  // the rant (deadpan → worried → panic)
  let mood;
  mood = mood || windowMood(S, 'barry', t, T.chart + 0.75, T.chart + 1.75, { worried: 0.55, smug: 0.45 });
  mood = mood || windowMood(S, 'barry', t, T.thought - 0.2, L.barry5.ls + 0.1, 'deadpan', 0.35);
  mood = mood || windowMood(S, 'barry', t, L.barry9.ls - 0.15, L.barry9.le + 0.75,
    [[0, 'worried'], [L.barry9.ls - 0.05, 'deadpan'], [T.reason1, 'worried'], [T.somebody, { worried: 0.5, panic: 0.5 }], [T.withReason - 0.05, 'panic']], 0.2);

  // head business
  let tilt = 0, dx = 0, sx = 1, sy = 1, dy = 0;
  // chart taps: snout jabs up-forward into the board
  const j = jab(t, T.tap1) + jab(t, T.tap2);
  tilt += 17 * j; dx += 7 * j; dy -= 5 * j;
  // "Then who's touching it?" — a pointed little jab at Sunny
  tilt -= 5 * sinBump(t, L.barry1.ls + 0.3, 0.32);
  // "…nobody wrote down!" emphatic nod
  tilt -= 5 * sinBump(t, L.barry3.ls + 1.45, 0.35) + 4 * sinBump(t, L.barry3.ls + 2.0, 0.3);
  // the flick: dip to the orange, then an upward flick
  const fu = t - T.flick;
  if (fu > -0.4 && fu < 0.55) {
    const dip = fu < 0 ? ease.inOutSine(clamp((fu + 0.4) / 0.34)) : 1 - ease.outCubic(clamp(fu / 0.22));
    const lift = fu > 0 ? Math.sin(Math.PI * clamp(fu / 0.5)) : 0;
    tilt += -22 * dip + 8 * lift; dx += 6 * dip;
  }
  // landing: THUMP (squash + sink), damped
  const lu = t - T.touch;
  if (lu >= 0 && lu < 0.7) {
    const s = 0.16 * Math.exp(-lu * 6.5) * Math.cos(lu * 18);
    sy *= 1 - s; sx *= 1 + s * 0.5; dy += 26 * s;
  }
  // "…with a reason!" — lifts and stretches
  const tk = K.take(t, T.withReason, { amount: 0.55, anticipation: 0.12, stretch: 0.14, settle: 0.5 });
  sx *= tk.sx; sy *= tk.sy; dy += tk.dy;
  tilt += 6 * K.fadeWindow(t, T.withReason - 0.05, L.barry9.le + 0.3, 0.12, 0.4);
  // "You sit on a guy, you introduce yourself!" — indignant little head-jabs up at Gerald
  for (const w of T.jabs) tilt += 6 * sinBump(t, w - 0.04, 0.26);
  // "I have glasses." — chin up, proud (the lens glint is drawn over him)
  tilt += 5 * K.fadeWindow(t, T.glasses - 0.15, S.duration + 1, 0.3, 0.1);
  const cfg = {
    facing: facingKeys(T), look, tiltAdd: tilt, squash: { sx, sy, dy },
    x: B0.x + dx * (flip ? -1 : 1),
  };
  if (mood) cfg.mood = mood;
  return cfg;
}

function sunnyCfg(S, T, t) {
  const L = T.L;
  const cfg = {};
  // the spare orange gliding past · Gerald coming in
  const o = orangeAt(T, t);
  if (t > T.nudge + 0.05 && t < T.nudge + 1.1) cfg.lookAt = { x: o.x, y: o.y - 10 };
  if (t > T.flaps + 0.2 && t < T.touch + 0.6) cfg.lookAt = 'gerald';
  const m = windowMood(S, 'sunny', t, T.flaps + 0.3, L.doreen3.ls + 0.4, 'happy', 0.4);
  if (m) cfg.mood = m;
  // a slow lazy nod of approval at the landing
  cfg.tiltAdd = -4 * sinBump(t, T.touch + 0.1, 0.8);
  return cfg;
}

function doreenCfg(S, T, t) {
  const L = T.L;
  const cfg = {};
  let tilt = 0, dx = 0;
  // the nudge: snout dips onto the orange and pushes it across
  const nu = t - T.nudge;
  if (nu > -0.35 && nu < 0.6) {
    const dip = nu < 0 ? ease.inOutSine(clamp((nu + 0.35) / 0.3)) : 1 - ease.inOutSine(clamp(nu / 0.5));
    tilt -= 16 * dip; dx -= 7 * dip;
  }
  if (t > T.nudge - 0.45 && t < T.nudge + 0.25) cfg.lookAt = { x: O_HOME.x, y: O_HOME.y - 10 };
  // the orange comes home: a glance down
  if (t > T.home - 0.12 && t < T.home + 0.3) cfg.lookAt = { x: O_RET.x, y: O_RET.y - 10 };
  // "I had a thought once. Back in March." — eyes drift up and away, a cloud passes; shudder
  const up = K.fadeWindow(t, T.thought - 0.05, T.didnt + 0.05, 0.3, 0.2);
  if (up > 0) cfg.look = { x: lerp(-0.6, 0.05, 1 - up), y: lerp(-0.85, -0.05, 1 - up) };
  const m = windowMood(S, 'doreen', t, T.thought - 0.1, L.doreen2.le + 0.6,
    [[0, 'happy'], [T.thought, { happy: 0.55, neutral: 0.45 }], [T.march, { worried: 0.6, happy: 0.4 }], [T.didnt, 'happy']], 0.3);
  if (m) cfg.mood = m;
  const sh = K.fadeWindow(t, T.shudder - 0.1, T.shudder + 0.32, 0.05, 0.12);
  if (sh > 0) { dx += 2.2 * Math.sin(t * 2 * Math.PI * 9) * sh; tilt += 2.5 * Math.sin(t * 2 * Math.PI * 7 + 1) * sh; }
  // contented eyes-closed at "…care for it."
  const cl = K.fadeWindow(t, L.doreen2.le - 0.45, L.doreen2.le + 0.7, 0.25, 0.3);
  if (cl > 0) cfg.eyes = lerp(0.92, 0.06, cl);
  // the landing + "Aw." — delighted, looks up at Gerald, head tilts
  if ((t > T.flaps + 0.35 && t < T.touch + 0.7) || (t > L.doreen3.ls - 0.15 && t < L.doreen3.ls + 0.38)) cfg.lookAt = 'gerald';
  const dm = windowMood(S, 'doreen', t, T.flaps + 0.4, L.doreen3.ls + 0.2, 'happy', 0.3);
  if (dm && !m) cfg.mood = dm;
  tilt += 8 * K.fadeWindow(t, L.doreen3.ls - 0.1, L.doreen3.le + 0.5, 0.2, 0.4);
  cfg.tiltAdd = tilt;
  cfg.x = SP.swimSpots.doreen.x + dx;
  return cfg;
}

function geraldCfg(S, T, t) {
  const L = T.L;
  const g = { on: 'barry', land: { beat: 'vulture_lands', from: { x: 1110, y: 120 }, touch: T.touch } };
  if (t < T.touch + 0.02) g.flapPhase = geraldFlap(T, t);
  // "That's a reservation." — he nestles in; up again for his introduction
  const settle = K.fadeWindow(t, L.barry5.ls + 1.45, L.barry6.le + 0.1, 0.5, 0.4);
  if (settle > 0) { g.settle = 0.55 * settle; g.mantle = 0.12 * settle; }
  // "Gerald." — a polite little bow
  const nod = sinBump(t, L.gerald1.ls - 0.02, 0.7);
  if (nod > 0) { g.nod = nod; g.crouch = 0.35 * nod; }
  // "Oh…" — a glance off toward the mountain … "no reason." back down
  const away = K.fadeWindow(t, L.gerald2.ls - 0.08, L.gerald2.ls + 0.48, 0.14, 0.14);
  if (away > 0) {
    g.look = { x: lerp(0.45, 0.95, away), y: lerp(0.95, -0.7, away) };
    g.mood = { smug: 1 - 0.6 * away, neutral: 0.6 * away };       // lids up: the glance reads
  }
  // the glint catches his eye: he peers down at the glasses and stays curious to the end
  const peer = K.ramp(t, T.glasses + 0.12, 0.25, 'inOutSine');
  if (peer > 0) { g.look = { x: 0.55, y: lerp(0.4, 1, peer) }; g.nod = 0.35 * peer; }
  return g;
}

// ───────────────────────────────────────────────────────────── cameras
// World camera centres. Barry faces R (toward Doreen) or L (toward Sunny); "g" = Gerald on his head.
const CU = {
  chart: { x: 748, y: 512, zoom: 2.9 },
  bareL: { x: 626, y: 561, zoom: 2.8 },
  bareR: { x: 676, y: 561, zoom: 2.8 },
  gR: { x: 700, y: 518, zoom: 2.75 },
  gL: { x: 600, y: 518, zoom: 2.75 },
  sunny: { x: 506, y: 538, zoom: 2.5 },
  doreen: { x: 858, y: 546, zoom: 2.95 },
  doreenG: { x: 846, y: 532, zoom: 2.7 },
};
// Gerald close-up: his head in the upper third, Barry's upturned eyes just above the subtitles
function geraldCU(I) {
  const gh = I.st && I.st.gerald && I.st.gerald.perchHead ? I.st.gerald.perchHead : { x: 698, y: 432 };
  const z = 3.35;
  return { x: gh.x - 10, y: gh.y + (360 - 178) / z, zoom: z, push: 0.012 };
}
function framings(S, T) {
  const L = T.L;
  const byShot = (I) => {
    const t = I.S.t, sh = I.shot;
    switch (sh.index) {
      case 0: return { ...CU.chart, push: 0.012 };
      case 1: case 4: return { ...CU.sunny, push: 0.008 };
      case 2: return { ...CU.bareL, push: 0.01 };
      case 3: {
        // the orange business: drift toward Barry + Doreen as the orange crosses
        const base = K.trioFrame(I, { zoom: 1.6, waterlineY: 592 });
        const k = ease.inOutSine(clamp((t - sh.t0 - 0.4) / (sh.dur - 0.4)));
        return { x: lerp(base.x, 708, k), y: lerp(base.y, base.y + 14, k), zoom: lerp(1.6, 1.8, k), foliage: lerp(0.55, 0.35, k), push: 0, drift: 0.5 };
      }
      case 5: {
        // follows Barry's turn from Sunny to Doreen with a gentle ease
        const k = ease.inOutSine(clamp((t - (T.turn4 + 0.06)) / 1.15));
        return { x: lerp(CU.bareL.x, CU.bareR.x, k), y: CU.bareL.y, zoom: CU.bareL.zoom, push: 0.007 };
      }
      case 6: return { ...CU.doreen, push: 0.008 };
      case 7: {
        // Gerald comes in from the mountain: open wide on the crater, push in on Barry's head as he
        // descends (lands on the cut)
        const k = ease.inOutSine(clamp((t - sh.t0) / (sh.dur + 0.1)));
        return { x: lerp(676, 676, k), y: lerp(410, 470, k), zoom: lerp(1.28, 1.72, k), foliage: lerp(0.8, 0.4, k), push: 0, drift: 0.3 };
      }
      case 8: {
        // the look-up: slow push in on the eyes
        const k = ease.inOutSine(clamp((t - sh.t0 - 0.12) / (sh.dur - 0.12)));
        return { x: lerp(CU.gR.x, 702, k), y: lerp(CU.gR.y, 524, k), zoom: lerp(2.6, 3.1, k), push: 0, drift: 0.25 };
      }
      case 9: return { ...CU.doreenG, push: 0.008 };
      case 10: case 12: return { ...CU.gR, push: 0.008 };
      case 11: case 13: return geraldCU(I);
      case 14: {
        // the rant: an accelerating push, a punch on "…reason!"
        const k = ease.inQuad(clamp((t - L.barry9.ls) / (T.withReason - L.barry9.ls)));
        const punch = 0.045 * sinBump(t, T.withReason - 0.04, 0.45);
        return { x: lerp(CU.gR.x, 704, k), y: lerp(CU.gR.y, 526, k), zoom: lerp(2.62, 3.15, k) * (1 + punch), push: 0, drift: 0.4 };
      }
      case 15: return { ...CU.sunny, push: 0.008 };
      case 16: return { ...CU.gL, push: 0.009 };
      default: return K.trioFrame(I);
    }
  };
  return { barry_cu: byShot, sunny_cu: byShot, doreen_cu: byShot, gerald_cu: byShot, trio: byShot };
}

// "I have glasses." — a cartoon glint sweeps the near lens and a sparkle pops on the rim
function drawGlint(ctx, st, T) {
  const u = st.t - T.glasses;
  if (u < 0 || u > 0.7) return;
  const b = st.cast.barry;
  if (!b) return;
  const e = b.anchors.eye, sc = b.opts.scale || 1, f = b.opts.flip ? -1 : 1;
  const R = 19.5 * sc;
  ctx.save();
  // sheen band across the lens
  const k = clamp(u / 0.28);
  if (k < 1) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(e.x, e.y, R, 0, U.TAU);
    ctx.clip();
    const cx = e.x + f * lerp(-1.6, 1.6, ease.inOutSine(k)) * R;
    ctx.translate(cx, e.y);
    ctx.rotate(f * 0.6);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(-R * 0.22, -R * 1.6, R * 0.44, R * 3.2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(R * 0.32, -R * 1.6, R * 0.14, R * 3.2);
    ctx.restore();
  }
  // four-point sparkle at the upper-front of the rim
  const sp = clamp((u - 0.16) / 0.5);
  if (sp > 0 && sp < 1) {
    const s = Math.sin(Math.PI * sp) * 13 * sc;
    const x = e.x + f * R * 0.62, y = e.y - R * 0.68;
    ctx.translate(x, y);
    ctx.rotate(sp * 1.2);
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(255,255,230,0.9)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    const w = Math.max(0.5, s * 0.16);
    ctx.moveTo(0, -s); ctx.quadraticCurveTo(w, -w, s, 0); ctx.quadraticCurveTo(w, w, 0, s);
    ctx.quadraticCurveTo(-w, w, -s, 0); ctx.quadraticCurveTo(-w, -w, 0, -s);
    ctx.fill();
  }
  ctx.restore();
}

// ───────────────────────────────────────────────────────────── render
module.exports = {
  render(ctx, t, S) {
    const T = timesOf(S);
    K.drawSpringStage(ctx, t, S, {
      env: { volcanoSmoke: 0.35, waterHeat: 0.24 },
      cast: { barry: barryCfg(S, T, t), sunny: sunnyCfg(S, T, t), doreen: doreenCfg(S, T, t) },
      gerald: geraldCfg(S, T, t),
      items: [{
        x: orangeAt(T, t).x, y: orangeAt(T, t).y, water: { w: 34, depth: 14 },
        draw: (c, st) => drawSpareOrange(c, st, T),
      }],
      framings: framings(S, T),
      hooks: {
        behind: (c, st) => drawChartProp(c, st, T),
        afterCast: (c, st) => { drawOrangeFx(c, st, T); drawGlint(c, st, T); },
      },
    });
  },
};
