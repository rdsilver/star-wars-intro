// s07_eruption — THE CLIMAX (spring_evening): twelve seconds of chill, then Mount Snooze.
//
// SHOTS (6 camera names, each a deliberate framing; every one is a pure function of time):
//   trio        1) golden hour: Doreen talks Barry into one orange — the helmet slides off onto his
//                  rock, she flicks the spare orange onto his head with her snout, his eyes close.
//               2) big_rumble: the crater smokes, the spring starts to boil, oranges hop on every head.
//               3) the long eruption two-shot/trio: the orange + rock rain, "Free oranges!" (one lands
//                  on Sunny's orange — a stack), a rock juices Doreen's orange, Barry flicks his orange,
//                  flips the helmet back on off his rock, a rock BONKS off it — he doesn't even blink.
//   barry_cu    the twelve seconds (eyes shut, heavenly glow that dies with the music), the eyes
//               opening, "Knowing? Past tense?", then "Twelve seconds." straight to camera.
//   gerald_cu   the perfect goodbye on the SPRING RULES sign; '2. Say goodbye' lights up, a tidy nod,
//               he flies off LEFT (toward the raft) on the flap sfx strokes; a feather settles.
//   thermometer INSERT on the instrument: the column surges, the bulb pops on the glass_pop frame.
//   volcano     the explosion: tight on the crater → blown back to the whole plume + the burning
//               "No Worries Allowed" sign.
//   escape      run past the EXIT signs, Sunny's sign, the necklace yank, the raft (Gerald already on
//               the mast: "Took your time."), a bomb splash launches the S.S. TOLD YOU SO, pull back
//               to lava pouring into the spring.
'use strict';

const K = require('../lib/kit');
const U = require('../lib/util');
const P = require('../lib/props');
const ES = require('../lib/env_spring');
const CAP = require('../lib/capybara');
const CR = require('../lib/critters');

const SP = ES.SPRING;
const { clamp, lerp, smoothstep, ease, noise1, hash1 } = U;
const PI = Math.PI;
const fin = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const posv = (v, d = 1, m = 0.001) => { v = fin(v, d); return v < m ? m : v; };
const ramp = (t, t0, dur, fn = ease.inOutCubic) => (dur > 0 ? fn(clamp((t - t0) / dur)) : t >= t0 ? 1 : 0);
const win = (t, t0, t1) => t >= t0 && t < t1;
// piecewise keys [[t, v], ...] with per-segment easing (default inOutSine)
function keys(t, ks, fn = ease.inOutSine) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (t < ks[i][0]) {
      const [t0, v0] = ks[i - 1], [t1, v1] = ks[i];
      const f = ks[i][2] ? ease[ks[i][2]] : fn;
      return lerp(v0, v1, f(clamp((t - t0) / Math.max(1e-6, t1 - t0))));
    }
  }
  return ks[ks.length - 1][1];
}
// parabolic hop between two points (h = apex height above the straight line)
function arc(a, b, u, h) {
  return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) - h * 4 * u * (1 - u) };
}
// mood weight crossfade from keyed names: [[t, 'mood'], ...] with fade seconds
function moodKeys(t, ks, fade = 0.25) {
  let cur = ks[0][1], prev = null, t0 = -1e9;
  for (const [kt, m] of ks) if (t >= kt) { prev = cur; cur = m; t0 = kt; }
  const k = clamp((t - t0) / fade);
  if (!prev || prev === cur || k >= 1) return cur;
  const w = {};
  w[prev] = (w[prev] || 0) + (1 - k);
  w[cur] = (w[cur] || 0) + k;
  return w;
}

// ═══════════════════════════════════════════════════════════════════ timing (pure, memoised)
const TMEMO = new WeakMap();
function timing(S) {
  let m = TMEMO.get(S.tl);
  if (!m) { m = {}; TMEMO.set(S.tl, m); }
  if (m[S.id]) return m[S.id];
  const c = (n) => S.cue(n), d = (n) => S.cueDur(n);
  const L = (who, txt) => K.lineWith(S, who, txt);
  const sx = (n) => K.sfxTimes(S, n);
  const T = { end: S.duration };
  T.orange = c('barry_orange'); T.orangeD = d('barry_orange');
  T.leaves = c('vulture_leaves');
  T.flaps = sx('flaps')[0] ?? T.leaves + 0.8;
  T.eyes = c('barry_eyes_open'); T.eyesD = d('barry_eyes_open');
  T.pops = c('thermo_pops'); T.popsD = d('thermo_pops');
  T.pop = sx('glass_pop')[0] ?? T.pops + 0.9;
  T.rumble = c('big_rumble'); T.rumbleD = d('big_rumble');
  T.boil = sx('boil')[0] ?? T.rumble + 0.6;
  T.erupt = c('eruption'); T.eruptD = d('eruption');
  T.rain = c('orange_rain'); T.rainD = d('orange_rain');
  T.whistleHit = (sx('rock_whistle')[0] ?? T.rain) + 1.4;
  T.splat = c('doreen_splat');
  const bonks = sx('bonk');
  T.bonk1 = bonks[0] ?? T.splat + 0.35;
  T.splatHit = sx('splat')[0] ?? T.splat + 0.45;
  T.hb = c('helmet_bonk');
  T.bonk2 = bonks[1] ?? T.hb + 1.0;
  T.run = c('run_to_raft'); T.ssign = c('sunny_sign'); T.board = c('board_raft'); T.boardD = d('board_raft');
  T.launch = c('raft_launch'); T.launchD = d('raft_launch');
  T.bigSplash = sx('big_splash')[0] ?? T.launch;
  T.hiss = sx('lava_hiss')[0] ?? T.launch + 0.8;
  // lines
  T.dL1 = L('doreen', 'One orange. For me');
  T.bL1 = L('barry', "won't enjoy");
  T.bL2 = L('barry', 'Oh, wow');
  T.gL1 = L('gerald', 'Lovely knowing');
  T.bL3 = L('barry', 'proper goodbye');
  T.bL4 = L('barry', 'Past tense');
  T.bL5 = L('barry', 'Twelve seconds');
  T.dL2 = L('doreen', 'having a thought');
  T.sL1 = L('sunny', 'Free oranges');
  T.bL6 = L('barry', 'Nothing is free');
  T.dL3 = L('doreen', 'My orange');
  T.bL7 = L('barry', 'worn a helmet');
  T.sL2 = L('sunny', 'What do we do');
  T.bL8 = L('barry', 'Follow the signs');
  T.sL3 = L('sunny', 'made me a sign');
  T.gL2 = L('gerald', 'Took your time');
  T.wPast = K.wordTime(S, T.bL4, 'Past'); T.wWhy = K.wordTime(S, T.bL4, 'Why');
  T.wFollow = K.wordTime(S, T.bL8, 'Follow'); T.wMade = K.wordTime(S, T.bL8, 'made');
  T.wFree = K.wordTime(S, T.sL1, 'Free');
  // camera cuts
  T.cuts = S.tl.cams.filter((x) => x.scene === S.id).map((x) => ({ name: x.name, t: x.time - S.scene.start }));
  // derived choreography times
  T.orangeLand = T.orange + 1.15;          // the spare orange lands on Barry's head
  T.eyesShut = T.orange + 1.95;            // eyes fully closed
  T.helmetRock = T.orange + 0.62;          // helmet lands on the rock
  T.flick = T.orange + 0.7;                // Doreen's snout flick
  T.leap = T.flaps + 0.08;                 // first downstroke = the leap
  T.stackLand = T.wFree - 0.42;            // a free orange lands on Sunny's orange
  T.helmetOn = T.hb + 0.7;                 // helmet back on
  T.flickOff = T.hb + 0.06;                // Barry's orange leaves his head
  T.sunnyRock = T.sL2.ls - 0.38;           // a rock splashes next to Sunny → "What do we do?"
  T.doreenJump = T.run + 0.58; T.doreenLand = T.doreenJump + 0.42;   // Doreen hops aboard first
  T.barryTurn = T.run + 1.66;              // Barry, at the top of the slope, turns back for Sunny
  T.bite = T.board + 0.2;                  // zip back, bite Sunny's necklace...
  T.yank = T.board + 0.36;                 // ...turn and YANK: both leap for the raft
  T.boardLand = T.board + 1.0;             // Barry + (yanked) Sunny land on the raft
  m[S.id] = T;
  return T;
}
function shotAt(T, t) {
  let s = T.cuts[0], i = 0;
  for (let k = 0; k < T.cuts.length; k++) if (T.cuts[k].t <= t + 1e-6) { s = T.cuts[k]; i = k; }
  const next = T.cuts[i + 1];
  return { name: s.name, t0: s.t, t1: next ? next.t : T.end, i };
}

// ═══════════════════════════════════════════════════════════════════ environment
function envAt(T, t) {
  const env = {};
  env.dusk = keys(t, [[0, 0.06], [T.rumble, 0.2], [T.end, 0.3]]);
  // crater: heat during the rumble, the BLAST on the explosion frame (passes the onset in 3 frames)
  env.erupt = keys(t, [[T.eyes, 0], [T.pops, 0.02], [T.rumble, 0.05], [T.rumble + T.rumbleD, 0.13, 'outCubic'], [T.erupt, 0.15],
    [T.erupt + 0.14, 0.31, 'outCubic'], [T.erupt + T.eruptD, 0.5, 'outQuad'], [T.rain, 0.6], [T.run, 0.78, 'linear'], [T.end, 0.92, 'linear']]);
  // our own flash: white-hot ON the explosion frame, gone in 5 frames; then the env's lightning flicks
  const fe = t - T.erupt;
  let fl = fe >= 0 && fe < 0.17 ? Math.pow(1 - fe / 0.17, 2.5) : 0;
  if (env.erupt > 0.22 && env.erupt < 0.68) {
    const slot = Math.floor(t * 2.6), ph = t * 2.6 - slot;
    if (hash1(slot * 3.17 + 0.5) > 0.62) fl = Math.max(fl, Math.exp(-ph * 9) * 0.2 * (1 - smoothstep(0.55, 0.68, env.erupt)));
  }
  env.flash = fl;
  // (capped below 1: the env's front steam veil greys the close two-shots; the scene adds its own boil)
  env.waterHeat = keys(t, [[0, 0.24], [T.orange + 2, 0.28], [T.eyes, 0.36], [T.rumble, 0.42], [T.boil, 0.58], [T.boil + 1.4, 0.74], [T.erupt + 1, 0.8], [T.rain, 0.82]]);
  env.volcanoSmoke = keys(t, [[0, 0.45], [T.eyes, 0.6], [T.rumble, 0.95], [T.erupt, 1]]);
  env.lava = keys(t, [[T.board, 0], [T.hiss - 0.5, 0.12], [T.hiss, 0.2, 'linear'], [T.end, 0.62, 'outQuad']]);
  env.signBurn = keys(t, [[T.erupt + 1.4, 0], [T.erupt + T.eruptD, 0.28], [T.launch, 0.55, 'linear'], [T.end, 0.72]]);
  env.groveShake = Math.max(keys(t, [[T.erupt - 0.01, 0], [T.erupt + 0.05, 1, 'outQuad'], [T.erupt + 2.5, 0.45], [T.rain, 0.6], [T.rain + T.rainD + 1, 0.25]]), 0);
  // a dark cough from the crater on the rumble (the s04 sneeze, grown up)
  const pk = (t - T.rumble) / 2.6;
  if (pk > 0 && pk < 1 && t < T.erupt) env.puffs = [{ k: pk, size: 1.25, dark: 0.85, seed: 7, rise: 34 }];
  // sustained eruption rumble (leaves / palms / grove) on top of the sfx-driven one
  env.rumbleFloor = t >= T.erupt ? 0.3 : 0;
  return env;
}

// ═══════════════════════════════════════════════════════════════════ the orange + rock rain
// Deterministic list of falling things. Oranges are blasted off the grove (they leave the trees:
// env.groveTaken), rocks fall from the crater; everything lands on open water, splashes, oranges
// then float and bob on the boil, rocks sink with a hiss of steam.
const RAIN_MEMO = new WeakMap();
function rainList(S, T) {
  let m = RAIN_MEMO.get(S.tl);
  if (!m) { m = {}; RAIN_MEMO.set(S.tl, m); }
  if (m[S.id]) return m[S.id];
  const out = [];
  const R = U.rng(707);
  const grove = SP.groveOranges;
  let gi = 1;                        // groveOranges[0] already rolled down in s04
  // the blast knocks a few off the grove (volcano shot): they sail up out of frame
  for (let i = 0; i < 4; i++) {
    const g = grove[gi++];
    out.push({ kind: 'orange', blast: true, t0: T.erupt + 0.06 + i * 0.09, t1: T.erupt + 1.4 + i * 0.1, from: { x: g.x, y: g.y },
      to: { x: g.x - 260 + i * 170, y: -260 }, h: 120 + 30 * i, r: 9, seed: 50 + i });
  }
  // the rain proper: oranges from the grove, landing all over the pool (clear of the trio's faces)
  const spots = [];
  const faceBoxes = [[300, 460, 540, 600], [560, 470, 790, 610], [820, 460, 990, 600]];
  const okSpot = (x, y) => ES.freeWater(x, y, 14) && !faceBoxes.some((b) => x > b[0] && x < b[2] && y > b[1] && y < b[3])
    && spots.every((p) => Math.hypot(p.x - x, (p.y - y) * 1.6) > 44);
  const N = 15;
  for (let i = 0; i < N; i++) {
    let x = 0, y = 0;
    for (let k = 0; k < 60; k++) {
      x = R.range(230, 1150); y = R.range(478, 700);
      if (okSpot(x, y)) break;
    }
    spots.push({ x, y });
    const g = grove[gi++] || grove[grove.length - 1];
    const land = T.rain + 1.05 + (i / N) * 2.6 + R.range(-0.12, 0.12);
    const flight = R.range(0.95, 1.25);
    out.push({ kind: 'orange', t0: land - flight, t1: land, from: { x: g.x, y: g.y }, to: { x, y }, h: R.range(260, 360), r: 13 * SP.depthScale(y), seed: 100 + i });
  }
  // the whistling bomb (rock_whistle: 1.4 s, the impact where the whistle cuts off)
  out.push({ kind: 'rock', big: true, t0: T.rain + 0.1, t1: T.whistleHit, from: { x: 860, y: 150 }, to: { x: 515, y: 622 }, h: 330, r: 17, seed: 3 });
  // more rocks through the shot (one splashes right next to Sunny → "Barry! What do we do?")
  const rocks = [[T.rain + 2.2, 1040, 540], [T.rain + 3.0, 255, 520], [T.splat - 0.5, 470, 500], [T.sunnyRock, 288, 612], [T.sL2.ls + 1.3, 1100, 640],
    [T.bL8.ls + 0.6, 560, 690], [T.bL8.ls + 1.6, 900, 500], [T.bL8.ls + 2.3, 395, 655]];
  rocks.forEach(([land, x, y], i) => {
    const flight = 1.0 + 0.15 * hash1(i + 4);
    out.push({ kind: 'rock', t0: land - flight, t1: land, from: { x: 860 + (hash1(i) - 0.5) * 40, y: 150 }, to: { x, y }, h: 300 + 60 * hash1(i + 9), r: 10 + 4 * hash1(i + 2), seed: 20 + i });
  });
  // a few late oranges keep plopping in during the argument
  for (let i = 0; i < 6; i++) {
    let x = 0, y = 0;
    for (let k = 0; k < 60; k++) { x = R.range(230, 1150); y = R.range(480, 700); if (okSpot(x, y)) break; }
    spots.push({ x, y });
    const g = grove[gi++] || grove[grove.length - 1];
    const land = T.splat + 1.0 + i * 1.3 + R.range(0, 0.4);
    out.push({ kind: 'orange', t0: land - 1.1, t1: land, from: { x: g.x, y: g.y }, to: { x, y }, h: 300, r: 13 * SP.depthScale(y), seed: 200 + i });
  }
  m[S.id] = out;
  return out;
}
// oranges leave the grove as they launch (rainList takes groveOranges in removal order; the
// first one already rolled down in s04)
function groveTaken(rain, t) {
  let n = 1;
  for (const r of rain) if (r.kind === 'orange' && r.t0 <= t) n++;
  return n;
}

// ═══════════════════════════════════════════════════════════════════ Barry
const BARRY_SPOT = SP.swimSpots.barry;
const ROCK_TOP = { x: SP.barryRock.top.x, y: SP.barryRock.top.y + 1 };
const THERMO = { x: 775, y: 632, scale: 0.7, waterY: 640 };   // bulb resting at the surface: an in-air POP
const SPARE = { x: 842, y: 600 };       // Doreen's spare orange, floating by her snout

function barryCfg(S, T, t, shot) {
  const o = {};
  // facing: right (Doreen / his rock) → left for "Nothing is free!" (to Sunny) → right on "My orange!"
  // (the helmet is on his rock) → left when Sunny asks "What do we do?"
  o.facing = [[0, 'right'], [T.bL6.ls - 0.22, 'left'], [T.dL3.ls + 0.05, 'right'], [T.sL2.ls + 0.28, 'left']];
  o.rest = [[0, 'worried'], [T.orangeLand + 0.25, 'chill'], [T.eyes + 0.05, 'neutral'], [T.rumble, 'panic'], [T.erupt, 'worried'],
    [T.splat + 0.8, 'deadpan'], [T.bL7.le + 0.3, 'deadpan']];
  const acc = { glasses: true };
  // helmet: worn → slides off at the beat → back on (flipped up off the rock) at helmet_bonk
  acc.helmet = t < T.orange + 0.16 || t >= T.helmetOn ? (t >= T.helmetOn ? { strap: ramp(t, T.helmetOn + 0.05, 0.2, ease.outCubic) } : true) : false;
  acc.orange = false;                    // his orange is drawn by the scene (lands, hops, is flicked)
  o.accessories = acc;
  let tilt = 0, dy = 0, sx = 1, sy = 1;
  // ── barry_orange: a sigh, tip the head → helmet slides off; orange lands; sink into bliss
  const ob = t - T.orange;
  if (ob > -0.2 && ob < 3) {
    tilt += -16 * ramp(ob, 0.0, 0.28, ease.inOutSine) * (1 - ramp(ob, 0.62, 0.3, ease.inOutSine));
    const sigh = Math.sin(PI * clamp(ob / 0.5));
    sy *= 1 - 0.035 * sigh; sx *= 1 + 0.02 * sigh;
  }
  const ol = t - T.orangeLand;
  if (ol > 0 && ol < 0.6) {
    const tk = K.take(t, T.orangeLand, { amount: 0.45, anticipation: 0.04 });
    sx *= tk.sx; sy *= tk.sy; dy += tk.dy;
  }
  // relaxing: sinks a little lower in the water for the twelve seconds
  const relax = ramp(t, T.orangeLand + 0.3, 1.6, ease.inOutSine) * (1 - ramp(t, T.eyes, 0.5, ease.inOutSine));
  dy += 5 * relax;
  // eyes: wide when the orange lands, then they slowly close; shut ~12 s; slowly open
  if (t >= T.orangeLand && t < T.eyes + T.eyesD + 2.4 && shot.name !== 'thermometer') {
    let e;
    if (t < T.eyes) e = keys(t, [[T.orangeLand, 0.95], [T.orangeLand + 0.25, 0.9], [T.eyesShut, 0, 'inOutSine']]);
    else e = keys(t, [[T.eyes, 0], [T.eyes + T.eyesD, 0.62, 'inOutSine'], [T.wPast, 0.72], [T.wWhy, 1, 'outBack']]);
    if (t < T.pops) { o.eyes = clamp(e); o.blink = false; }
  }
  // ── "Knowing? Past tense? Why is he saying goodbye?" — the penny drops in three steps
  if (t >= T.eyes && t < T.pops) {
    o.mood = moodKeys(t, [[T.eyes, 'chill'], [T.eyes + 0.35, 'neutral'], [T.wPast - 0.05, 'worried'], [T.wWhy, 'shock']], 0.28);
    // eyes: blank ahead → back over his shoulder (where Gerald was) → up at the mountain
    o.look = t < T.bL4.ls + 0.05 ? { x: 0.35, y: 0 } : t < T.wWhy - 0.05 ? { x: -0.95, y: -0.55 } : { x: 0.75, y: -0.95 };
    if (t >= T.bL4.ls + 0.05 && t < T.wWhy - 0.05) tilt += 4;
    if (t >= T.wWhy - 0.05) tilt += 9 * ramp(t, T.wWhy - 0.05, 0.4, ease.outBack);
  }
  // ── the twelve seconds: blissful, a lazy smile (chill with a little happy)
  if (t >= T.orangeLand + 0.3 && t < T.eyes) {
    o.mood = S.speaking('barry') ? { chill: 0.72, happy: 0.28 } : 'chill';
    tilt += 3 * Math.sin(t * 0.9) * 0.5 + 2;
  }
  // ── big rumble (trio): rigid with alarm
  if (t >= T.rumble && t < T.bL5.ls - 0.2) o.tremble = 1.4;
  // ── "Twelve seconds. I was chill for twelve seconds." — straight down the lens
  if (shot.name === 'barry_cu' && t >= T.bL5.ls - 0.3 && t < T.erupt) {
    o.headTurn = ramp(t, shot.t0 + 0.12, 0.5, ease.inOutSine);
    o.mood = 'deadpan';
    o.blink = t > shot.t0 + 1.0;
  }
  // ── the rain: eyes on the sky
  if (t >= T.rain && t < T.sL1.ls) o.lookAt = 'up';
  // ── helmet_bonk: flick the orange (head toss), scoop the helmet off the rock, BONK — stone still
  const hb = t - T.hb;
  if (hb > -0.1 && hb < 1.5) {
    tilt += 16 * Math.sin(PI * clamp((hb + 0.04) / 0.26));                      // the toss
    tilt += -24 * Math.sin(PI * clamp((hb - 0.24) / 0.3));                      // dip to the rock (scoop)
    tilt += 7 * Math.sin(PI * clamp((hb - 0.48) / 0.24));                       // flick it up
    o.mood = hb < 1.25 ? 'deadpan' : moodKeys(t, [[T.hb, 'deadpan'], [T.hb + 1.25, 'smug']], 0.3);
    if (hb > 0.75 && hb < 1.5) { o.blink = false; o.look = { x: 0.15, y: 0 }; o.tremble = 0; }
  }
  // ── "Oh, now you ask? Follow the signs! I made signs!" — indignant, then points the way (left)
  if (t >= T.bL8.ls - 0.1 && t < T.run) {
    o.mood = moodKeys(t, [[T.bL8.ls - 0.1, 'smug'], [T.wFollow - 0.1, 'panic']], 0.2);
    const pk = ramp(t, T.wFollow - 0.15, 0.25, ease.outBack) * (1 - ramp(t, T.wMade + 0.5, 0.3));
    if (pk > 0.001) { o.pawUp = pk; o.pawAt = { x: 78, y: -46 }; }
  }
  o.y = BARRY_SPOT.y + dy;
  o.squash = { sx, sy };
  o.tiltAdd = tilt;
  return o;
}

// ═══════════════════════════════════════════════════════════════════ Doreen + Sunny
function doreenCfg(S, T, t, shot) {
  const o = {};
  o.rest = [[0, 'chill'], [T.orangeLand + 0.1, 'happy'], [T.eyes + 1.2, 'chill'], [T.rumble, 'worried'], [T.erupt, 'panic'],
    [T.splatHit, 'shock'], [T.dL3.le + 0.2, 'deadpan'], [T.sL2.ls, 'panic']];
  let tilt = 0;
  // "One orange. For me." — she nudges the spare toward him with her snout
  tilt += -9 * Math.sin(PI * clamp((t - (T.dL1.ls + 0.85)) / 0.7));
  const ob = t - T.orange;
  // the snout flick: dip to the floating spare (0.4-0.66), snap up (0.66-0.8), watch it land, beam
  if (ob > 0 && ob < 2) {
    tilt += -15 * Math.sin(PI * clamp((ob - 0.38) / 0.56)) * (ob < 0.66 ? 1 : 0)
      + (ob >= 0.66 ? -15 * Math.sin(PI * clamp((0.66 - 0.38) / 0.56)) * (1 - ramp(ob, 0.66, 0.1, ease.outCubic)) : 0);
    tilt += 12 * Math.sin(PI * clamp((ob - 0.66) / 0.4));
    if (ob > 0.6 && ob < 1.25) o.lookAt = { x: 700, y: 470 };
  }
  // orange: rig's until the rumble, then the scene draws it (hops) until it's juiced → squashed
  const acc = {};
  if (t >= T.rumble && t < T.splatHit) acc.orange = false;
  else if (t >= T.splatHit) { acc.orange = 'squashed'; acc.juice = ramp(t, T.splatHit, 0.9, ease.outQuad); }
  o.accessories = acc;
  // juiced: a take on the splat
  if (t >= T.bonk1 - 0.1 && t < T.bonk1 + 0.8) o.squash = K.take(t, T.bonk1, { amount: 0.7 });
  if (t >= T.bL7.ls && t < T.bL7.le + 0.6) o.lookAt = 'barry';
  o.tiltAdd = tilt;
  return o;
}
function sunnyCfg(S, T, t, shot) {
  const o = {};
  o.rest = [[0, 'chill'], [T.rain + 0.6, 'happy'], [T.splatHit + 0.3, 'worried'], [T.sunnyRock, 'panic']];
  const acc = {};
  if (t >= T.rumble) acc.orange = false;
  o.accessories = acc;
  if (t >= T.rain && t < T.stackLand) o.lookAt = 'up';
  if (t >= T.stackLand - 0.05 && t < T.stackLand + 0.6) o.squash = K.take(t, T.stackLand, { amount: 0.35 });
  if (t >= T.sunnyRock - 0.05 && t < T.sunnyRock + 0.7) o.squash = K.take(t, T.sunnyRock + 0.02, { amount: 0.9 });
  return o;
}

// ═══════════════════════════════════════════════════════════════════ head oranges (hop on the boil)
function hopAmp(T, t) {
  // big during the rumble + boil, a nervous jiggle afterwards
  return keys(t, [[T.rumble, 0], [T.rumble + 0.15, 1, 'outQuad'], [T.rumble + T.rumbleD, 0.85], [T.bL5.le, 0.5], [T.erupt + 0.4, 0.7], [T.rain, 0.28], [T.end, 0.2]]);
}
function hop(t, amp, seed, freq = 3.1) {
  if (amp <= 0.001) return { dy: 0, bounce: 0 };
  const ph = (t * freq + seed) % 1;
  const air = 4 * ph * (1 - ph);
  const contact = 1 - clamp(Math.min(ph, 1 - ph) / 0.12);
  const a = amp * (0.75 + 0.25 * noise1(Math.floor(t * freq + seed) * 1.7 + seed));
  return { dy: -a * air, bounce: contact * 0.45 * clamp(amp / 14) };
}

// ═══════════════════════════════════════════════════════════════════ framings
// All framings are functions of time (shot instance from the shot's start), so a move never leaks
// into a later shot of the same name.
function framings(T) {
  return {
    trio: (I) => {
      const t = I.S.t, sh = shotAt(T, t);
      if (sh.t0 < T.rumble - 0.01) {
        // 1) golden hour: trio, then a gentle push toward Barry + his rock for the orange gag
        const k = ramp(t, T.orange - 0.6, 2.2, ease.inOutSine);
        return { x: lerp(652, 718, k), y: lerp(428, 468, k), zoom: lerp(1.5, 1.82, k), push: 0, foliage: 0.6 };
      }
      if (sh.t0 < T.erupt) {
        // 2) the rumble: a little wider so the smoking crater sits at the top of frame
        return { x: 655, y: 392, zoom: 1.34, push: 0.012, foliage: 0.55 };
      }
      // 3) the eruption: wide (fountain + lava up top) → push into Barry + Doreen for the two bonks →
      //    back out for Sunny's panic → drift left toward the signs
      const base = { x: 655, y: 394, zoom: 1.22 };
      const two = { x: 812, y: 492, zoom: 1.98 };
      const trio = { x: 642, y: 438, zoom: 1.5 };
      const left = { x: 590, y: 436, zoom: 1.52 };
      let c = base;
      const a = ramp(t, T.bL6.ls - 0.35, 0.75, ease.inOutCubic);
      c = U.camLerp(c, two, a);
      const b = ramp(t, T.bL7.le + 0.05, 0.65, ease.inOutCubic);
      if (b > 0) c = U.camLerp(two, trio, b);
      const d = ramp(t, T.wFollow - 0.2, 1.6, ease.inOutSine);
      if (d > 0) c = U.camLerp(trio, left, d);
      return { ...c, push: 0, foliage: 0.5 };
    },
    barry_cu: (I) => {
      const t = I.S.t, sh = shotAt(T, t);
      if (sh.t0 >= T.rumble) {
        // "Twelve seconds." — tighter, centred: he looks straight down the lens
        return { x: 716, y: 524, zoom: 2.95, push: 0.01 };
      }
      // the twelve seconds / the penny drops: Barry left of centre, the thermometer + his rock right
      return { x: 742, y: 512, zoom: 2.6, push: 0.009 };
    },
    gerald_cu: { x: 612, y: 358, zoom: 2.85, push: 0.006, foliage: 0 },
    thermometer: (I) => {
      // INSERT: the instrument fills the frame (bulb low, the helmet on its rock peeking in above)
      const t = I.S.t;
      const k = ramp(t, T.pops, T.pop - T.pops, ease.inQuad);
      return { x: THERMO.x + 6, y: THERMO.y - 40 + 4 * k, zoom: 5.0 + 0.45 * k, push: 0, drift: 0.3 };
    },
    volcano: (I) => {
      // tight on the crater for the blast → blown back to the whole plume, the grove and the burning
      // "No Worries Allowed" sign → a slow tilt up with the rising column
      const t = I.S.t;
      const k = ramp(t, T.erupt + 0.03, 1.0, ease.outCubic);
      const p = ramp(t, T.erupt + 1.0, T.eruptD - 1.0, ease.inOutSine);
      return { x: lerp(862, 852, k), y: lerp(180, 236, k) - 16 * p, zoom: lerp(2.2, 1.32, k) * (1 + 0.04 * p), push: 0, drift: 0.6, foliage: 0 };
    },
    escape: (I) => escapeCam(T, I.S.t),
  };
}

// ═══════════════════════════════════════════════════════════════════ the escape
// The moored S.S. TOLD YOU SO, cheated a little bigger than in the montage so three capybaras fit
// (first seen here at a new size; same spot at the river mouth, bow pointing downriver = LEFT).
const RAFT = { x: -20, y: 600, scale: 0.8 };
const RUN_SCALE = 0.46, SEAT_SCALE = 0.42;
const SEAT = { barry: -100, doreen: -8, sunny: 92 };     // world dx from the raft centre (bow = left)
const LANE = { doreen: -7, barry: 6, sunny: 1 };         // depth stagger on the bank (ground y)
const SUNNY_STOP = 298, BARRY_WAIT = 120, BARRY_BITE = 228;
function bankY(x) {
  // the runners' ground: along the front of the EXIT signs, then down the slope to the river
  if (x >= 205) return 478 + (x > 360 ? (x - 360) * 0.08 : 0);
  if (x >= 128) return lerp(512, 478, (x - 128) / 77);
  return 512;
}
const GDY = {};
function groundDY(who, pose, scale) {
  const k = who + pose + scale.toFixed(3);
  if (GDY[k] == null) {
    const a = CAP.capyAnchors({ who, x: 0, y: 0, scale, pose, t: 0, accessories: who === 'barry' ? { helmet: true, glasses: true } : undefined });
    GDY[k] = a.ground ? a.ground.y : 58 * scale;
  }
  return GDY[k];
}
function raftOpts(T, t) {
  const u = t - T.bigSplash;
  let x = RAFT.x, y = RAFT.y, rock = 0, wake = 0;
  // boarding: the raft dips and rocks under each landing
  const rk = (tt, a) => { const v = t - tt; return v > 0 && v < 1.6 ? a * Math.exp(-v * 3.2) * Math.sin(v * 12) : 0; };
  const dp = (tt, a) => { const v = t - tt; return v > 0 && v < 1.2 ? a * Math.exp(-v * 4.5) * Math.sin(Math.min(PI, v * 8)) : 0; };
  rock += rk(T.doreenLand, 0.05) + rk(T.boardLand, -0.08);
  const dip = dp(T.doreenLand, 4) + dp(T.boardLand, 8);
  if (u > 0) {
    x -= 280 * u + 520 * u * u;            // the splash shoves it off downriver, accelerating
    y += 16 * clamp(u / 1.6);
    rock += 0.07 * Math.exp(-u * 4) * Math.sin(u * 10);
    wake = clamp(u * 3);
  }
  // the banner streams LEFT: the blast wind blows away from the volcano (and it keeps clear of the bank signs)
  return { x, y: y + dip, scale: RAFT.scale, bob: 0.7, rock, wake, dir: -1, wind: u > 0 ? 1 : 0.75, flagDir: -1 };
}
// Scripted runner positions (they also drive the escape camera — no feedback from the live cast).
function runner(T, t, who) {
  if (who === 'doreen') {
    // leads (juice and all) and hops aboard first
    const x0 = 236, v = 130;
    if (t < T.doreenJump) return { x: x0 - v * (t - T.run), pose: 'run', flip: true };
    if (t < T.doreenLand) return { leap: true, u: clamp((t - T.doreenJump) / (T.doreenLand - T.doreenJump)), from: { x: x0 - v * (T.doreenJump - T.run) }, flip: true };
    return { aboard: true };
  }
  if (who === 'barry') {
    const x0 = 320, v = 140, tD = T.run + 1.25;
    if (t < tD) return { x: x0 - v * (t - T.run), pose: 'run', flip: true };
    const xd = x0 - v * 1.25;
    if (t < tD + 0.36) {
      const k = clamp((t - tD) / 0.36);
      return { x: xd - (xd - BARRY_WAIT) * (1 - (1 - k) * (1 - k)), pose: 'run', flip: true, skid: k };
    }
    // waits at the top of the slope, turned back toward Sunny (the turn is a squash turn)
    if (t < T.board) return { x: BARRY_WAIT, pose: 'stand', flip: t < T.barryTurn + 0.15 ? true : false, wait: true, turnK: clamp((t - T.barryTurn) / 0.3) };
    // ZIP back to Sunny, bite the necklace, turn, leap for the raft dragging him
    if (t < T.bite) return { x: lerp(BARRY_WAIT, BARRY_BITE, ease.outQuad(clamp((t - T.board) / (T.bite - T.board)))), pose: 'run', flip: false, zip: true };
    if (t < T.yank) return { x: BARRY_BITE, pose: 'stand', flip: t >= T.yank - 0.05, bite: true, turnK: clamp((t - (T.yank - 0.1)) / 0.1) };
    if (t < T.boardLand) return { leap: true, u: clamp((t - T.yank) / (T.boardLand - T.yank)), from: { x: BARRY_BITE }, flip: true };
    return { aboard: true };
  }
  // sunny: lumbers out of the water last, skids to a stop at his sign, gazes, gets yanked
  const x0 = 452, v = 78;
  if (t < T.ssign) return { x: x0 - v * (t - T.run), pose: 'run', flip: true, splashing: t < T.run + 0.5 };
  const x1 = x0 - v * (T.ssign - T.run);
  if (t < T.ssign + 0.34) {
    const k = clamp((t - T.ssign) / 0.34);
    return { x: lerp(x1, SUNNY_STOP, 1 - (1 - k) * (1 - k)), pose: k < 0.7 ? 'run' : 'stand', flip: true, skid: k };
  }
  if (t < T.yank) return { x: SUNNY_STOP, pose: 'stand', flip: true, gaze: t < T.bite, bitten: t >= T.bite };
  if (t < T.boardLand) return { leap: true, u: clamp((t - T.yank) / (T.boardLand - T.yank)), from: { x: SUNNY_STOP }, flip: true, yanked: true };
  return { aboard: true };
}
function seatPoint(who, RO, A) {
  A = A || P.raftAnchors(RO);
  const dx = SEAT[who];
  const ang = A.angle || 0;
  const sy = A.waterline - 24 * RO.scale;    // passenger ground (the deck's sit line)
  return { x: RO.x + dx * Math.cos(ang), y: sy + dx * Math.sin(ang), rot: ang, A };
}
function escapeCam(T, t) {
  const K0 = [
    [T.run, { x: 292, y: 452, zoom: 1.62 }],
    [T.ssign, { x: 222, y: 448, zoom: 1.74 }],
    [T.ssign + 0.6, { x: 274, y: 432, zoom: 2.55 }],
    [T.board, { x: 276, y: 434, zoom: 2.64 }],
    [T.board + 0.85, { x: 40, y: 472, zoom: 1.85 }],
    [T.gL2.ls, { x: 22, y: 478, zoom: 2.02 }],
    [T.launch, { x: 18, y: 480, zoom: 2.12 }],
  ];
  let c = K0[0][1];
  for (let i = 1; i < K0.length; i++) {
    const [t0, a] = K0[i - 1], [t1, b] = K0[i];
    if (t >= t0 && t < t1) { c = U.camLerp(a, b, ease.inOutSine(clamp((t - t0) / (t1 - t0)))); break; }
    if (t >= t1) c = b;
  }
  if (t >= T.launch) {
    // follow the raft a beat as it shoots off, then pull back to the spring: lava pours in
    const u = t - T.launch;
    const kz = ease.inOutCubic(clamp(u / 1.7));
    const kx = ease.inOutCubic(clamp((u - 0.4) / 1.5));
    const follow = -90 * Math.sin(PI * clamp(u / 1.0)) * (1 - kx);
    c = { x: lerp(c.x, 612, kx) + follow, y: lerp(c.y, 372, kz), zoom: lerp(c.zoom, 1.03, kz) };
  }
  return { ...c, push: 0, drift: 0.5, foliage: 0.3 };
}

// ═══════════════════════════════════════════════════════════════════ drawing helpers
// water/props grade of the current frame (set first thing in render from t alone: golden hour → eruption)
const GR = { v: 'gold' };
function lightOf(st) { const b = st.cast.barry || st.cast.doreen || st.cast.sunny; return b ? { tint: b.opts.tint, rim: b.opts.rim } : undefined; }
function drawHeadOrange(ctx, st, who, t, T, extraDy = 0, extra = {}) {
  const e = st.cast[who];
  if (!e) return null;
  const a = e.anchors.orange;
  if (!a) return null;
  const h = hop(st.T, hopAmp(T, t) * 14 * (e.opts.scale || 1), who === 'sunny' ? 0.31 : who === 'doreen' ? 0.67 : 0);
  const r = posv(a.r, 15);
  P.drawOrange(ctx, { x: a.x, y: a.y + h.dy + extraDy, r, rot: fin(a.angle, 0), bounce: extra.bounce ?? h.bounce, squash: extra.squash || 0, t: st.T, flip: !!a.flip, light: lightOf(st) });
  return { x: a.x, y: a.y + h.dy + extraDy, r, top: a.y + h.dy + extraDy - r };
}
// impact burst (comic), drawn in world space
function burst(ctx, x, y, r, text, tt, rot = -0.08, seed = 1) {
  if (tt < 0 || tt > 0.8) return;
  P.drawImpactBurst(ctx, { x, y, r, text, t: tt, rot, seed, grade: 'erupt' });
}

// ═══════════════════════════════════════════════════════════════════ render
module.exports = {
  render(ctx, t, S) {
    const T = timing(S);
    GR.v = t >= T.erupt ? 'erupt' : 'gold';
    const sh = shotAt(T, t);
    const cam = sh.name;
    const env = envAt(T, t);
    const rain = rainList(S, T);
    env.groveTaken = groveTaken(rain, t);
    env.rumble = Math.max(K.rumbleLevel(S), env.rumbleFloor || 0);
    delete env.rumbleFloor;

    // ── cast
    const cast = { barry: barryCfg(S, T, t, sh), doreen: doreenCfg(S, T, t, sh), sunny: sunnyCfg(S, T, t, sh) };
    // inserts / Gerald's close-up: the trio sits below the frame (only their oranges would poke in)
    if (cam === 'thermometer' || cam === 'gerald_cu' || cam === 'volcano') for (const w in cast) cast[w] = { hidden: true };
    const escaping = cam === 'escape';
    const aboard = {};
    if (escaping) {
      for (const who of ['barry', 'doreen', 'sunny']) {
        const r = runner(T, t, who);
        if (r.aboard || r.leap) { aboard[who] = r; cast[who] = { hidden: true }; continue; }
        cast[who] = runnerCfg(S, T, t, who, r);
      }
    }

    // ── Gerald
    let gerald = null;
    if (t < T.leap + 1.4 && cam !== 'escape') {
      const lv = t - T.leaves;
      gerald = { on: 'rules', depthY: 0, takeoff: { t0: T.leap - 0.42, dur: 1.45, to: { x: 120, y: 120 } } };
      if (lv >= 0 && lv < 0.3) gerald.look = { x: 0.15, y: 1 };                        // glance at rule 2
      if (lv >= 0.24 && lv < 0.46) gerald.nod = Math.sin(PI * clamp((lv - 0.24) / 0.22));  // the tidy nod
      if (lv < 0) {
        if (t > T.orange + 1.4 && t < T.cuts[1].t) gerald.lookAt = 'volcano';               // he knows
      }
      if (t >= T.leap - 0.1) {
        gerald.flapPhase = Math.max(0, 0.27 + (t - T.leap) / 0.275);
        gerald.mood = 'neutral';
      }
    }

    // ── items (depth-sorted with the swimmers)
    const items = [];
    // Barry's thermometer, stuck in the water by his rock
    items.push({
      x: THERMO.x, y: THERMO.waterY,
      draw: (c, st) => drawThermo(c, st, T, t),
    });
    // Doreen's spare orange (floats by her snout until she flicks it)
    if (t < T.flick) {
      items.push({
        x: SPARE.x, y: SPARE.y + 1,
        draw: (c, st) => {
          const bob = 1.6 * Math.sin(st.T * 2.1);
          const nudge = 16 * Math.sin(PI * clamp((t - (T.dL1.ls + 0.95)) / 1.1));
          P.drawOrange(c, { x: SPARE.x - nudge, y: SPARE.y - 11 + bob, r: 13, t: st.T, rot: 0.3, seed: 4, waterY: SPARE.y, light: lightOf(st), grade: GR.v });
        },
      });
    }
    // the rain
    for (const r of rain) {
      if (t < r.t0) continue;
      if (r.kind === 'rock' && t > r.t1 + 1.6) continue;
      if (r.blast && t > r.t1) continue;
      items.push({ x: r.to.x, y: r.blast ? -400 : r.to.y, draw: (c, st) => drawRainItem(c, st, r, t, T) });
    }

    // ── hooks
    const hooks = {
      behind: (c, st) => {
        // SPRING RULES (+ '2. Say goodbye' lights up under Gerald's glance; the feather settles on top)
        const hk = ramp(t, T.leaves + 0.04, 0.22, ease.outCubic);
        K.drawRulesSign(c, st.T, hk > 0 ? { highlight: 2, highlightK: hk, grade: GR.v } : { grade: GR.v });
        drawFeather(c, T, t);
        // EXIT · NO, REALLY. THIS WAY. · YES, YOU, SUNNY
        K.drawExitSigns(c, st.T, { burn: { really: keys(t, [[T.run, 0], [T.end, 0.35]]), exit: 0, sunny: 0 } });
        // the boil behind the trio (bubble domes, steam billows)
        if (cam !== 'thermometer') drawBoil(c, st, T, t, 'behind');
        // the helmet on Barry's rock (behind his snout)
        drawRockHelmet(c, st, T, t, 'behind');
        // the raft (moored → launched), with its passengers + Gerald on the mast
        if (escaping || t >= T.run) drawRaftGroup(c, st, S, T, t, aboard, 'behind');
      },
      afterCast: (c, st) => {
        if (cam !== 'thermometer' && cam !== 'escape') drawBoil(c, st, T, t, 'front');
        drawRockHelmet(c, st, T, t, 'front');
        drawHeadOranges(c, st, T, t, cam);
        drawGags(c, st, T, t, cam);
        if (escaping) drawRaftGroup(c, st, S, T, t, aboard, 'front');
      },
      afterWater: (c, st) => {
        if (escaping) drawEscapeFx(c, st, T, t);
      },
      screen: (c, st) => drawScreenFx(c, st, T, t, cam),
    };

    // ── camera shake: the sfx table + a sustained eruption tremor
    const shake = (SS) => {
      let a = 0;
      if (t >= T.erupt + 1) a += 2.2 * ramp(t, T.erupt + 1, 1);
      if (cam === 'escape' && t >= T.run) a *= 0.8;
      return a;
    };

    K.drawSpringStage(ctx, t, S, {
      env, cast, gerald, items, hooks,
      framings: framings(T),
      cam: { shake, shakeGain: cam === 'barry_cu' ? 0.8 : 1 },
      foliage: cam === 'volcano' || cam === 'gerald_cu' || cam === 'thermometer' || cam === 'barry_cu' ? false : 'auto',
    });
  },
};

// ═══════════════════════════════════════════════════════════════════ the boil
// The env's boil is gentle; the scene adds a rolling boil from the boil sfx on: bubble domes behind
// and in front of the trio, a fizz ring around each swimmer, steam billows rising behind them.
const boilK = (T, t) => ramp(t, T.boil - 0.3, 1.3, ease.inOutSine);
function drawBoil(c, st, T, t, layer) {
  const k = boilK(T, t);
  if (k <= 0.001) return;
  const tt = st.T;
  if (layer === 'behind') {
    ES.drawSteamBurst(c, tt, { x: 660, y: 515, w: 980, amount: 0.42 * k, scale: 1, seed: 4, h: 170, spacing: 95, maxPuffs: 7 });
    ES.drawBubbles(c, tt, { x: 690, y: 532, w: 1000, h: 80, amount: 0.3 + 0.6 * k, scale: 0.9, seed: 5, pool: true, domeR: [9, 20], domeSpacing: 70 });
    return;
  }
  for (const who of ['sunny', 'barry', 'doreen']) {
    const e = st.cast[who];
    if (!e || !e.opts.kit || !e.opts.kit.inWater) continue;
    const o = e.opts;
    ES.drawBubbles(c, tt, { x: o.x, y: o.y + 6, w: 300 * o.scale, h: 22, amount: 0.25 + 0.45 * k, scale: 0.9, seed: who.length * 3 + 1, pool: true, domeR: [6, 12], domeSpacing: 90 });
  }
  ES.drawBubbles(c, tt, { x: 660, y: 664, w: 1150, h: 120, amount: 0.3 + 0.64 * k, scale: 1.25, seed: 9, pool: true, domeR: [14, 32], domeSpacing: 80 });
}

// ═══════════════════════════════════════════════════════════════════ props in the set
function drawThermo(c, st, T, t) {
  // creeps up from 39.8 while Barry relaxes (the tag counts it: dramatic irony), surges + pops on cue
  const creep = keys(t, [[T.orangeLand + 1, 39.8], [T.pops, 40.7, 'linear']]);
  const o = {
    x: THERMO.x, y: THERMO.y, scale: THERMO.scale, rot: 0.05, t: st.T, waterY: THERMO.waterY, grade: GR.v,
    level: P.thermoLevel(creep), reading: 'auto', tagSize: 12,
  };
  if (t >= T.pops) {
    Object.assign(o, { since: t - T.pops, popTime: T.pop - T.pops, dur: T.popsD });
    o.level = P.thermoLevel(40.7);
  }
  if (t >= T.pops + 3) { o.since = 3; }
  P.drawThermometer(c, o);
}
function drawRockHelmet(c, st, T, t, layer) {
  // slides off his tipped head → clatters onto the rock → rattles in the rumble → flipped back on
  const b = st.cast.barry;
  const ha = b ? b.anchors.helmet : null;
  const hs = ha ? posv(ha.scale, 0.98) : 0.98;
  const s0 = T.orange + 0.16, s1 = T.helmetRock;
  const f0 = T.hb + 0.3, f1 = T.helmetOn;
  let o = null;
  if (t >= s0 && t < s1 && ha) {
    if (layer !== 'front') return;
    const u = clamp((t - s0) / (s1 - s0));
    const k = ease.inQuad(u);
    const p = arc({ x: ha.x, y: ha.y }, ROCK_TOP, k, 10);
    o = { x: p.x, y: p.y, rot: lerp(fin(ha.angle, 0), 0.5, k) + 0.25 * Math.sin(PI * u), strap: true };
  } else if (t >= s1 && t < f0) {
    if (layer !== 'behind') return;
    const v = t - s1;
    const land = 0.22 * Math.exp(-v * 7) * Math.sin(v * 22);          // clatter + settle
    const rum = hopAmp(T, t) * (0.5 + 0.5 * noise1(st.T * 9));
    const jump = rum > 0.05 ? -Math.abs(Math.sin(st.T * 19)) * 3 * rum : 0;
    o = { x: ROCK_TOP.x, y: ROCK_TOP.y + jump, rot: 0.1 + land + 0.06 * rum * Math.sin(st.T * 23), strap: true };
  } else if (t >= f0 && t < f1 && ha && b) {
    if (layer !== 'front') return;
    const u = clamp((t - f0) / (f1 - f0));
    const p = arc(ROCK_TOP, { x: ha.x, y: ha.y }, ease.inOutSine(u), 70);
    o = { x: p.x, y: p.y, rot: lerp(0.1, fin(ha.angle, 0) - 2 * PI, ease.inOutSine(u)), strap: true };
  }
  if (!o) return;
  P.drawHelmet(c, { x: o.x, y: o.y, scale: hs, rot: o.rot, strap: o.strap, light: lightOf(st) });
}
function drawFeather(c, T, t) {
  // one feather, left behind on the take-off, seesaws down onto the sign's top edge
  const t0 = T.leap + 0.05;
  if (t < t0) return;
  const u = Math.min(t - t0, 1.05);
  const top = K.rulesSignAnchors({}).top;
  const k = clamp(u / 1.05);
  const x = top.x + 6 - 14 * Math.sin(u * 5.2) * (1 - k) + 10 * k;
  const y = lerp(top.y - 34, top.y - 2.2, ease.inOutSine(k));
  // drawFeather lies horizontal at rot 0: seesaw down, settle flat on the board's top edge
  const rot = k >= 1 ? 0.1 : 0.6 * Math.sin(u * 5.2 + 0.6) * (1 - k) + 0.1 * k;
  CR.drawFeather(c, { x, y, scale: 0.75, rot });
}
function drawHeadOranges(c, st, T, t, cam) {
  if (cam === 'thermometer' || cam === 'escape') {
    if (cam === 'escape') drawEscapeOranges(c, st, T, t);
    return;
  }
  // BARRY: Doreen's flicked orange lands → sits → hops in the rumble → flicked off at helmet_bonk
  const b = st.cast.barry;
  if (b && t >= T.orangeLand && t < T.flickOff) {
    const ol = t - T.orangeLand;
    const landB = ol < 0.35 ? 0.55 * Math.exp(-ol * 9) * Math.cos(ol * 26) : 0;
    drawHeadOrange(c, st, 'barry', t, T, 0, { bounce: hopAmp(T, t) > 0.01 ? undefined : landB });
  }
  // SUNNY + DOREEN: the scene draws their oranges from the rumble on (they hop on the boil)
  if (t >= T.rumble) {
    const s = drawHeadOrange(c, st, 'sunny', t, T);
    // the free orange that lands on top of his own (a stack!)
    if (s && t >= T.stackLand) {
      const v = t - T.stackLand;
      const r2 = s.r * 0.86;
      const b2 = v < 0.4 ? 0.6 * Math.exp(-v * 9) * Math.cos(v * 24) : 0;
      const wob = v < 1 ? 0.25 * Math.exp(-v * 4) * Math.sin(v * 15) : 0.04 * Math.sin(st.T * 3);
      P.drawOrange(c, { x: s.x + 2 + 6 * wob, y: s.top - r2 + 3, r: r2, rot: wob, bounce: b2, t: st.T, seed: 9, light: lightOf(st) });
    }
    if (t < T.splatHit) {
      const hitK = t >= T.bonk1 ? clamp((t - T.bonk1) / (T.splatHit - T.bonk1)) : 0;
      drawHeadOrange(c, st, 'doreen', t, T, 0, t >= T.bonk1 ? { squash: 0.08 + 0.1 * hitK, bounce: 0 } : {});
    }
  }
  // the spare orange's flight: Doreen's snout → Barry's head
  if (b && t >= T.flick && t < T.orangeLand) {
    const u = clamp((t - T.flick) / (T.orangeLand - T.flick));
    const a = b.anchors.orange;
    const p = arc({ x: SPARE.x - 4, y: SPARE.y - 12 }, { x: a.x, y: a.y }, u, 92);
    P.drawOrange(c, { x: p.x, y: p.y, r: posv(lerp(13, fin(a.r, 15), u), 13), rot: 0.3 - 5 * u, t: st.T, seed: 4, light: lightOf(st), bounce: -0.18 * Math.sin(PI * u) });
    if (u < 0.35) P.drawWaterSplash(c, { x: SPARE.x - 4, y: SPARE.y, r: 12, t: t - T.flick, seed: 3, grade: GR.v });
  }
}
function drawGags(c, st, T, t, cam) {
  // ── the rock that juices Doreen's orange (drops in from the top of frame: 0-0.35 s)
  const d = st.cast.doreen;
  if (d && t >= T.splat && t < T.splat + 1.6 && cam === 'trio') {
    const a = d.anchors.orange;
    const tgt = { x: a.x + 2, y: a.y - a.r + 2 };
    const tf = T.bonk1 - T.splat;
    if (t < T.bonk1) {
      const u = clamp((t - T.splat) / tf);
      const p = { x: tgt.x + 34 * (1 - u), y: tgt.y - 330 * (1 - ease.inQuad(u)) };
      P.drawRock(c, { x: p.x, y: p.y, r: 12, glow: 0.8, trail: 0.9, dir: Math.atan2(330, -34), t: st.T, rot: u * 6, seed: 11, grade: 'erupt' });
    } else {
      // ricochet off to the right and plop into the water
      const v = t - T.bonk1;
      const p = { x: tgt.x + 120 * v, y: tgt.y - 160 * v + 0.5 * 900 * v * v };
      const landY = 560;
      if (p.y < landY) P.drawRock(c, { x: p.x, y: p.y, r: 12, glow: 0.6, trail: 0.3, dir: Math.atan2(-160 + 900 * v, 120), t: st.T, rot: 6 + v * 9, seed: 11, grade: 'erupt' });
      else {
        const vl = (160 + Math.sqrt(160 * 160 + 2 * 900 * (landY - tgt.y))) / 900;
        P.drawWaterSplash(c, { x: tgt.x + 120 * vl, y: landY, r: 14, t: v - vl, seed: 12, grade: GR.v });
      }
    }
    // SPLAT: juice burst on the splat frame
    if (t >= T.splatHit) P.drawJuiceSplat(c, { x: a.x, y: a.y + 2, r: a.r * 1.75, t: t - T.splatHit, seed: 5, light: lightOf(st) });
  }
  // ── Barry's orange: flicked off his head (head toss) → sails away left, plops
  const b = st.cast.barry;
  if (b && t >= T.flickOff && t < T.flickOff + 1.4 && cam === 'trio') {
    const v = t - T.flickOff;
    const a0 = { x: 678, y: 474 };
    const p = { x: a0.x - 260 * v, y: a0.y - 300 * v + 0.5 * 980 * v * v };
    const landY = 590;
    if (p.y < landY || v < 0.3) P.drawOrange(c, { x: p.x, y: p.y, r: 15, rot: -v * 10, t: st.T, seed: 6, light: lightOf(st) });
    else {
      const vl = (300 + Math.sqrt(300 * 300 + 2 * 980 * (landY - a0.y))) / 980;
      P.drawWaterSplash(c, { x: a0.x - 260 * vl, y: landY, r: 16, t: v - vl, seed: 8, grade: GR.v });
    }
  }
  // ── BONK: a rock drops onto the freshly-strapped helmet and ricochets off. Barry: stone still.
  if (b && t >= T.bonk2 - 0.36 && t < T.bonk2 + 1.4 && cam === 'trio') {
    const top = b.anchors.headTop;
    const tgt = { x: top.x - 2, y: top.y + 2 };
    if (t < T.bonk2) {
      const u = clamp((t - (T.bonk2 - 0.36)) / 0.36);
      const p = { x: tgt.x - 26 * (1 - u), y: tgt.y - 340 * (1 - ease.inQuad(u)) };
      P.drawRock(c, { x: p.x, y: p.y, r: 10, glow: 0.7, trail: 0.8, dir: Math.atan2(340, 26), t: st.T, rot: u * 5, seed: 17, grade: 'erupt' });
    } else {
      const v = t - T.bonk2;
      const p = { x: tgt.x + 150 * v, y: tgt.y - 260 * v + 0.5 * 900 * v * v };
      const landY = 528;
      const vl = (260 + Math.sqrt(260 * 260 + 2 * 900 * (landY - tgt.y))) / 900;
      if (v < vl) P.drawRock(c, { x: p.x, y: p.y, r: 10, glow: 0.5, trail: 0.2, dir: Math.atan2(-260 + 900 * v, 150), t: st.T, rot: 5 + v * 12, seed: 17, grade: 'erupt' });
      else P.drawWaterSplash(c, { x: tgt.x + 150 * vl, y: landY, r: 13, t: v - vl, seed: 19, grade: GR.v });
      burst(c, tgt.x + 4, tgt.y - 32, 34, 'BONK!', v, -0.12, 4);
      // ring lines around the helmet (the helmet took it; Barry didn't)
      if (v < 0.35) {
        c.save();
        c.strokeStyle = `rgba(255,244,214,${0.85 * (1 - v / 0.35)})`;
        c.lineWidth = 2.2;
        c.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const rr = 22 + i * 7 + v * 40;
          c.beginPath();
          c.arc(tgt.x, tgt.y + 10, rr, -PI * 0.92, -PI * 0.62);
          c.stroke();
          c.beginPath();
          c.arc(tgt.x, tgt.y + 10, rr, -PI * 0.38, -PI * 0.08);
          c.stroke();
        }
        c.restore();
      }
    }
  }
}
function drawRainItem(c, st, r, t, T) {
  const lt = lightOf(st);
  if (t < r.t1) {
    const u = clamp((t - r.t0) / (r.t1 - r.t0));
    // ballistic-looking arc: up out of the grove/crater, over, and down into the pool
    const p = { x: lerp(r.from.x, r.to.x, u), y: lerp(r.from.y, r.to.y, u * u * 0.6 + u * 0.4) - r.h * 4 * u * (1 - u) * 0.9 };
    const grow = lerp(0.55, 1, u);
    if (r.kind === 'orange') {
      P.drawOrange(c, { x: p.x, y: p.y, r: r.r * grow, rot: u * 9 + r.seed, t: st.T, seed: r.seed, light: lt });
    } else {
      const u2 = clamp(u + 0.02);
      const p2 = { x: lerp(r.from.x, r.to.x, u2), y: lerp(r.from.y, r.to.y, u2 * u2 * 0.6 + u2 * 0.4) - r.h * 4 * u2 * (1 - u2) * 0.9 };
      P.drawRock(c, { x: p.x, y: p.y, r: r.r * grow, glow: 1, trail: 0.9, dir: Math.atan2(p2.y - p.y, p2.x - p.x), t: st.T, rot: u * 7, seed: r.seed, grade: 'erupt' });
    }
    return;
  }
  if (r.blast) return;
  const v = t - r.t1;
  if (r.kind === 'orange') {
    // floats + bobs on the boil (now and then a dome lifts it)
    const ph = (st.T * 1.3 + r.seed * 0.37) % 1;
    const lift = Math.max(0, Math.sin(PI * ph * 2.2)) * 3 * (ph < 0.45 ? 1 : 0);
    const sink = v < 0.25 ? 10 * (1 - v / 0.25) : 0;
    const dx = 6 * noise1(st.T * 0.4 + r.seed);
    // floating: the plain orange clipped at the waterline + a foam ring (props' waterY submerge pass
    // costs ~6x a plain orange, and two dozen of these float at once)
    const ox = r.to.x + dx, oy = r.to.y - r.r * 0.72 + sink - lift + 1.5 * Math.sin(st.T * 2.3 + r.seed);
    c.save();
    c.beginPath();
    c.rect(ox - r.r * 3, oy - r.r * 4, r.r * 6, r.to.y - (oy - r.r * 4) + 0.5);
    c.clip();
    P.drawOrange(c, { x: ox, y: oy, r: r.r, rot: r.seed + 0.2 * Math.sin(st.T + r.seed), t: st.T, seed: r.seed, light: lt });
    c.restore();
    c.save();
    c.strokeStyle = 'rgba(236,246,240,0.7)';
    c.lineWidth = posv(1.4 * (r.r / 13), 0.6);
    c.beginPath();
    c.ellipse(ox, r.to.y + 0.5, posv(r.r * 1.05, 1), posv(r.r * 0.24, 0.5), 0, 0, PI * 2);
    c.stroke();
    c.restore();
    if (v < 1.4) P.drawWaterSplash(c, { x: r.to.x, y: r.to.y, r: 15 * (r.r / 13), t: v, seed: r.seed, grade: GR.v });
  } else {
    if (v < 1.5) P.drawWaterSplash(c, { x: r.to.x, y: r.to.y, r: r.big ? 34 : 22, t: v, seed: r.seed, big: !!r.big, grade: GR.v });
    if (v > 0.1 && v < 1.6) P.drawSteamPuff(c, { x: r.to.x, y: r.to.y - 6, r: r.big ? 26 : 16, life: clamp((v - 0.1) / 1.5), t: st.T, seed: r.seed, grade: GR.v });
  }
}

// stage cast entry for a runner on the bank
function runnerCfg(S, T, t, who, r) {
  const sc = RUN_SCALE * (who === 'sunny' ? 1.04 : 1);
  const gy = bankY(r.x) + (LANE[who] || 0) - groundDY(who, r.pose, sc);
  const o = {
    x: r.x, y: gy, scale: sc, pose: r.pose, flip: r.flip, inWater: false, turn: false, facing: undefined,
    accessories: ACC[who], rest: undefined, tiltAdd: 0,
    walkPhase: K.gaitPhase(Math.abs(r.x - 460), { who, scale: sc, pose: 'run' }),
    mood: who === 'sunny' ? { happy: 0.5, panic: 0.5 } : 'panic',
  };
  // skids: lean back against the stop
  if (r.skid != null) o.rot = 0.13 * Math.sin(PI * r.skid);
  let sx = 1, sy = 1;
  if (r.turnK > 0 && r.turnK < 1) {
    const s = Math.sin(PI * r.turnK);
    sx = 1 - 0.4 * s; sy = 1 + 0.05 * s;
    o.headTurn = clamp(s * 1.3);
  }
  if (who === 'barry') {
    if (r.wait) {
      // "Come ON!" — waves Sunny on; then the long flat look down the lens through Sunny's moment
      o.mood = t < T.sL3.ls + 0.2 ? 'panic' : 'deadpan';
      if (t >= T.barryTurn + 0.3 && t < T.sL3.ls + 0.1) {
        o.pawUp = 0.55 + 0.45 * Math.abs(Math.sin((t - T.barryTurn) * 8));
        o.pawAt = { x: 62, y: -52 };
        o.lookAt = { x: SUNNY_STOP - 40, y: 440 };
      }
      const ht = ramp(t, T.sL3.ls + 0.45, 0.45, ease.inOutSine) * (1 - ramp(t, T.board - 0.3, 0.25, ease.inOutSine));
      if (ht > 0.001) { o.headTurn = Math.max(o.headTurn || 0, ht); o.blink = ht < 0.9 || t > T.sL3.le - 0.4; }
    }
    if (r.zip) { o.mood = 'deadpan'; o.rot = -0.08; }
    if (r.bite) { o.mood = 'deadpan'; o.talk = 0.35; o.tiltAdd = 10; }
  }
  if (who === 'sunny') {
    if (r.gaze) {
      // touched: gazing at HIS sign
      o.mood = 'happy';
      o.look = { x: 0.95, y: -0.25 };
      o.tiltAdd = 6 + 2 * Math.sin(t * 2.2);
    }
    if (r.bitten) { o.mood = 'shock'; o.eyes = 1; }
  }
  if (sx !== 1 || sy !== 1) o.squash = { sx, sy };
  return o;
}
// ═══════════════════════════════════════════════════════════════════ raft + escape drawing
const ACC = {
  barry: { glasses: true, helmet: true, orange: false },
  doreen: { orange: 'squashed', juice: 1 },
  sunny: { orange: false },
};
// castOpts for someone mid-leap (bank → seat) or seated on the raft
function raftCast(S, T, t, who, r, RO, lt, RA) {
  const seat = seatPoint(who, RO, RA);
  const sc = SEAT_SCALE * (who === 'sunny' ? 1.05 : 1);
  if (r.leap) {
    const k = ease.inOutSine(r.u);
    const fromY = bankY(r.from.x) + (LANE[who] || 0);
    const p = arc({ x: r.from.x, y: fromY }, { x: seat.x, y: seat.y }, k, who === 'doreen' ? 55 : 70);
    const scl = lerp(RUN_SCALE, sc, k);
    const pose = k < 0.85 ? 'run' : 'sit';
    const gy = groundDY(who, pose, scl);
    const ex = {
      x: p.x, y: p.y - gy, scale: scl, pose, flip: true, walkPhase: 0.1 + r.u * 0.35, inWater: false, turn: false, facing: undefined,
      mood: who === 'sunny' ? 'shock' : 'panic', accessories: ACC[who], rot: -0.3 * Math.sin(PI * r.u),
    };
    if (r.yanked) {
      // dragged off his feet by the necklace: stretched out flat behind Barry
      const s = Math.sin(PI * clamp(r.u * 1.25));
      ex.squash = { sx: 1 + 0.22 * s, sy: 1 - 0.1 * s };
      ex.rot = -0.12 * s;
      ex.eyes = 1;
    }
    const o = K.castOpts(S, who, ex);
    o.tint = lt.tint; o.rim = lt.rim;
    return { o, seat, leaping: true };
  }
  const tl = who === 'doreen' ? T.doreenLand : T.boardLand;
  const gy = groundDY(who, 'sit', sc);
  const launched = t - T.bigSplash;
  // the launch throws everyone back (they lean into it), then they settle
  const lean = launched > 0 ? 0.2 * Math.exp(-launched * 2.4) * Math.sin(Math.min(PI, launched * 8)) + 0.04 * clamp(launched * 2) : 0;
  const tk = t - tl < 0.6 ? K.take(t, tl, { amount: 0.6, anticipation: 0.01 }) : null;
  const ex = {
    x: seat.x, y: seat.y - gy, scale: sc, pose: 'sit', flip: true, inWater: false, turn: false, facing: undefined,
    rot: seat.rot + lean, accessories: ACC[who], squash: tk ? { sx: tk.sx, sy: tk.sy, dy: tk.dy } : undefined,
  };
  if (t < T.board) {
    // Doreen, aboard first: anxious, watching for the boys
    if (who === 'doreen') { ex.flip = false; ex.mood = 'worried'; ex.lookAt = { x: 260, y: 440 }; }
  } else if (t >= T.gL2.ls - 0.35 && t < T.launch) {
    // "Took your time." — all eyes up the mast
    ex.lookAt = { x: seat.A.mastTop.x + 6, y: seat.A.mastTop.y - 40 };
    ex.mood = who === 'barry' ? 'deadpan' : who === 'sunny' ? 'happy' : 'sad';
  } else if (t >= T.launch) {
    ex.mood = who === 'sunny' ? { happy: 0.6, shock: 0.4 } : 'shock';
    ex.look = { x: -0.8, y: -0.1 };
  }
  const o = K.castOpts(S, who, ex);
  o.tint = lt.tint; o.rim = lt.rim;
  return { o, seat, leaping: false };
}
function drawRaftGroup(c, st, S, T, t, aboard, layer) {
  const RO = raftOpts(T, t);
  const lt = lightOf(st) || K.lightFor('spring_evening', st.env) || {};
  const ro = { ...RO, t: st.T, light: lt };
  if (layer === 'behind') {
    P.drawRaft(c, { ...ro, layer: 'back' });
    return;
  }
  // seated passengers (stern → bow), the front bundle over their bottoms, Gerald on the mast,
  // then anyone mid-leap in front of it all
  const leapers = [];
  const A = P.raftAnchors(RO);
  for (const who of ['sunny', 'doreen', 'barry']) {
    const r = aboard[who];
    if (!r) continue;
    const e = raftCast(S, T, t, who, r, RO, lt, A);
    if (e.leaping) { leapers.push(e.o); continue; }
    K.drawCast(c, e.o);
  }
  P.drawRaft(c, { ...ro, layer: 'front' });
  // GERALD — already on top of the flagpole (he followed the signs first)
  const gs = posv(A.geraldScale, 0.45) * 1.05;
  const lv = t - T.bigSplash;
  const g = T.gL2;
  const shrug = t >= g.ls - 0.1 && t < g.le + 0.4 ? Math.sin(PI * clamp((t - g.ls + 0.1) / (g.le - g.ls + 0.5))) : 0;
  const go = K.geraldOpts(S, {
    x: A.mastTop.x, y: A.mastTop.y, scale: gs, flip: false, rot: A.angle || 0,
    mood: t >= g.ls - 0.3 ? 'smug' : 'neutral',
    look: t < T.board ? { x: 0.9, y: 0.35 } : t < T.boardLand + 0.2 ? { x: 0.5, y: 0.8 } : { x: -0.2, y: 0.9 },
    wing: 0.55 * shrug, flapPhase: 0.05,
    grip: lv > 0 ? clamp(1.6 - lv) : 0, ruffle: lv > 0 ? clamp(1 - lv * 0.5) : 0,
  });
  go.tint = lt.tint;
  CR.drawVulture(c, go);
  for (const o of leapers) K.drawCast(c, o);
  drawNecklaceYank(c, st, T, t, leapers);
}
function drawNecklaceYank(c, st, T, t, leapers) {
  if (t < T.bite || t >= T.boardLand - 0.06) return;
  // Barry's mouth → Sunny's neck, from whatever is drawn this frame (bank or mid-air)
  const findO = (who) => leapers.find((o) => o.who === who) || (st.cast[who] && st.cast[who].opts);
  const bo = findO('barry'), so = findO('sunny');
  if (!bo || !so) return;
  const ba = K.castAnchors(bo), sa = K.castAnchors(so);
  const m = ba.mouth, n = sa.neck;
  if (!m || !n) return;
  const nx = n.x + (sa.chin ? (sa.chin.x - n.x) * 0.45 : 0), ny = n.y + (sa.chin ? (sa.chin.y - n.y) * 0.45 : 0) + 3;
  const dx = nx - m.x, dy = ny - m.y;
  const len = Math.hypot(dx, dy);
  if (!(len > 1)) return;
  const sag = clamp(10 - len * 0.05, 0, 10);
  const mx = (m.x + nx) / 2, my = (m.y + ny) / 2 + sag;
  c.save();
  c.strokeStyle = 'rgba(70,52,36,0.9)';
  c.lineWidth = 0.9;
  c.beginPath();
  c.moveTo(m.x, m.y);
  c.quadraticCurveTo(mx, my, nx, ny);
  c.stroke();
  const nb = Math.max(2, Math.min(10, Math.round(len / 7)));
  for (let i = 1; i < nb; i++) {
    const u = i / nb;
    const x = (1 - u) * (1 - u) * m.x + 2 * u * (1 - u) * mx + u * u * nx;
    const y = (1 - u) * (1 - u) * m.y + 2 * u * (1 - u) * my + u * u * ny;
    c.fillStyle = i % 3 === 0 ? '#E7C79B' : '#FFF4E2';
    c.beginPath();
    c.ellipse(x, y, 2.1, 1.6, Math.atan2(dy, dx), 0, PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(110,80,50,0.75)';
    c.lineWidth = 0.5;
    c.stroke();
  }
  c.restore();
}
function drawEscapeOranges(c, st, T, t) {
  // Sunny keeps his orange stack on the run (it jounces with his gallop)
  const s = st.cast.sunny;
  if (!s || !s.anchors.orange) return;
  const a = s.anchors.orange;
  const run = s.opts.pose === 'run' ? 1 : 0;
  const ph = (st.T * 3.3) % 1;
  const j = run * 4 * 4 * ph * (1 - ph);
  const lt = lightOf(st);
  P.drawOrange(c, { x: a.x, y: a.y - j, r: a.r, rot: fin(a.angle, 0), t: st.T, flip: !!a.flip, light: lt });
  const r2 = a.r * 0.86;
  const lag = run * 4 * Math.sin(st.T * 3.3 * 2 * PI - 0.8);
  P.drawOrange(c, { x: a.x + lag * 0.6, y: a.y - a.r - r2 + 3 - j * 1.3, r: r2, rot: lag * 0.04, t: st.T, seed: 9, light: lt });
}
function drawHeart(c, x, y, r, a, rot) {
  if (!(r > 0.3) || !(a > 0.01)) return;
  c.save();
  c.translate(x, y); c.rotate(rot); c.scale(r / 10, r / 10);
  c.globalAlpha = clamp(a);
  c.beginPath();
  c.moveTo(0, 8);
  c.bezierCurveTo(-12, 0, -11, -11, -5, -11);
  c.bezierCurveTo(-1.5, -11, 0, -8, 0, -6);
  c.bezierCurveTo(0, -8, 1.5, -11, 5, -11);
  c.bezierCurveTo(11, -11, 12, 0, 0, 8);
  c.closePath();
  c.fillStyle = '#FF7FA6';
  c.fill();
  c.lineWidth = 1.4;
  c.strokeStyle = '#B23A62';
  c.stroke();
  c.beginPath();
  c.ellipse(-4.5, -6.5, 2.2, 1.4, -0.6, 0, PI * 2);
  c.fillStyle = 'rgba(255,255,255,0.8)';
  c.fill();
  c.restore();
}
function drawEscapeFx(c, st, T, t) {
  const lt = lightOf(st);
  // "Aw." — Sunny is touched: two little hearts float up off his head
  const s = st.cast.sunny;
  if (s && !s.opts.hidden && t >= T.sL3.ls - 0.05 && t < T.board + 0.3) {
    const a = s.anchors.eye;
    for (let i = 0; i < 2; i++) {
      const v = t - (T.sL3.ls - 0.05 + i * 0.55);
      if (v < 0 || v > 1.6) continue;
      const u = v / 1.6;
      const pop = v < 0.18 ? ease.outBack(v / 0.18) : 1;
      drawHeart(c, a.x - 6 - i * 14 + 5 * Math.sin(v * 5 + i), a.y - 34 - 46 * u, 6.5 * pop * (1 - 0.3 * u), 1 - smoothstep(0.65, 1, u), 0.2 * Math.sin(v * 4 + i));
    }
  }
  // Sunny splashing up out of the pool at the start of the shot
  if (t >= T.run && t < T.run + 0.9) P.drawWaterSplash(c, { x: 458, y: 492, r: 16, t: t - T.run + 0.25, seed: 33, grade: GR.v });
  // skid dust: Barry at the top of the slope, Sunny at his sign
  const puffs = (x0, y0, t0, dir) => {
    const v = t - t0;
    if (v < 0 || v > 0.9) return;
    for (let i = 0; i < 3; i++) P.drawSmokePuff(c, { x: x0 + dir * i * 14, y: y0 - i * 2, r: 7 + i * 2, life: clamp(v / 0.9 + i * 0.07), t: st.T, seed: 30 + i + x0, tone: 'dust' });
  };
  puffs(SUNNY_STOP - 30, bankY(SUNNY_STOP) + 2, T.ssign + 0.05, 1);
  puffs(BARRY_WAIT - 18, bankY(BARRY_WAIT) + 2, T.run + 1.3, 1);
  // Barry's zip back to Sunny: speed lines + dust
  if (t >= T.board && t < T.bite + 0.25) {
    const k = clamp((t - T.board) / (T.bite - T.board));
    const x = lerp(BARRY_WAIT, BARRY_BITE, ease.outQuad(k));
    P.drawMotionLines(c, { x: x - 40, y: bankY(x) - 22, angle: 0, len: 46 * (1 - clamp((t - T.bite) / 0.25)), count: 3, spread: 22, t: st.T, alpha: 0.75 });
  }
  // Sunny's top orange flies off in the yank and plops into the river
  if (t >= T.yank && t < T.yank + 1.3) {
    const v = t - T.yank;
    const a0 = { x: SUNNY_STOP - 22, y: bankY(SUNNY_STOP) - 92 };
    const p = { x: a0.x + 70 * v, y: a0.y - 160 * v + 0.5 * 900 * v * v };
    const landY = 560;
    const vl = (160 + Math.sqrt(160 * 160 + 2 * 900 * (landY - a0.y))) / 900;
    if (v < vl) P.drawOrange(c, { x: p.x, y: p.y, r: 16, rot: v * 9, t: st.T, seed: 9, light: lt });
    else P.drawWaterSplash(c, { x: a0.x + 70 * vl, y: landY, r: 14, t: v - vl, seed: 36, grade: GR.v });
  }
  // the bomb that launches the raft: whistles down behind the stern → BIG SPLASH
  const bx = 160, by = 606;
  if (t >= T.bigSplash - 0.42 && t < T.bigSplash) {
    const u = clamp((t - (T.bigSplash - 0.42)) / 0.42);
    P.drawRock(c, { x: bx + 70 * (1 - u), y: by - 380 * (1 - ease.inQuad(u)), r: 15, glow: 1, trail: 1, dir: Math.atan2(380, -70), t: st.T, rot: u * 6, seed: 41, grade: 'erupt' });
  }
  if (t >= T.bigSplash && t < T.bigSplash + 1.6) P.drawWaterSplash(c, { x: bx, y: by, r: 36, t: t - T.bigSplash, seed: 42, big: true, grade: GR.v });
  // HISSSS: lava meets the spring — steam erupts off the back-right of the pool
  const hk = ramp(t, T.hiss - 0.15, 0.7, ease.outCubic);
  if (hk > 0.001) {
    ES.drawSteamBurst(c, st.T, { points: [[SP.lavaEntry.x, SP.lavaEntry.y], [SP.lavaEntry2.x, SP.lavaEntry2.y], [1060, 500]], amount: 1.3 * hk, scale: 1.3, seed: 12, h: 300, maxPuffs: 12 });
  }
}
// ═══════════════════════════════════════════════════════════════════ screen-space fx
function drawScreenFx(c, st, T, t, cam) {
  // the twelve seconds: a soft heavenly glow + drifting motes around Barry, cut dead with the music
  if (cam === 'barry_cu' && t < T.eyes + 0.2) {
    const k = ramp(t, T.cuts[1].t - 0.2, 1.2, ease.inOutSine) * (1 - ramp(t, T.eyes - 0.02, 0.12, ease.linear));
    if (k > 0.001) {
      const b = st.cast.barry;
      const p = b ? st.toScreen(b.anchors.eye) : { x: 560, y: 330 };
      c.save();
      c.globalCompositeOperation = 'screen';
      // warm bloom from above his head (screen blend, kept off his face so he doesn't wash out)
      const gx = p.x + 30, gy = Math.max(-40, p.y - 330);
      const g = c.createRadialGradient(gx, gy, 10, gx, gy, 560);
      g.addColorStop(0, `rgba(255,238,196,${0.34 * k})`);
      g.addColorStop(0.5, `rgba(255,214,150,${0.1 * k})`);
      g.addColorStop(1, 'rgba(255,200,140,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 1280, 720);
      // god rays from above
      for (let i = 0; i < 5; i++) {
        const a = -PI / 2 + (i - 2) * 0.16 + 0.03 * Math.sin(st.T * 0.4 + i);
        const len = 760;
        const w = 0.05 + 0.02 * hash1(i);
        const ox = p.x + 40, oy = -60;
        const gr = c.createLinearGradient(ox, oy, ox, oy + len);
        gr.addColorStop(0, `rgba(255,240,200,${0.18 * k})`);
        gr.addColorStop(1, 'rgba(255,240,200,0)');
        c.fillStyle = gr;
        c.beginPath();
        c.moveTo(ox, oy);
        c.lineTo(ox + Math.cos(a + PI - w) * -len * 0 + Math.tan(w + (i - 2) * 0.16) * len, oy + len);
        c.lineTo(ox + Math.tan(-w + (i - 2) * 0.16) * len, oy + len);
        c.closePath();
        c.fill();
      }
      // motes
      for (let i = 0; i < 18; i++) {
        const sp = 0.25 + 0.3 * hash1(i * 3.1);
        const ph = (st.T * sp * 0.12 + hash1(i)) % 1;
        const x = p.x + (hash1(i * 7.7) - 0.5) * 700 + 30 * Math.sin(st.T * 0.5 + i);
        const y = 720 - ph * 820;
        const a = Math.sin(PI * ph) * k * (0.35 + 0.4 * hash1(i * 2.3));
        const r = 1.6 + 2.4 * hash1(i * 5.1);
        const gm = c.createRadialGradient(x, y, 0, x, y, r * 3);
        gm.addColorStop(0, `rgba(255,248,220,${a})`);
        gm.addColorStop(1, 'rgba(255,248,220,0)');
        c.fillStyle = gm;
        c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
      }
      c.restore();
    }
  }
  // explosion: an orange bloom from the crater (the env draws the white-hot flash frames)
  if (cam === 'volcano') {
    const fe = t - T.erupt;
    if (fe >= 0 && fe < 0.7) {
      const p = st.toScreen({ x: 860, y: 150 });
      c.save();
      c.globalCompositeOperation = 'screen';
      const k = Math.pow(1 - fe / 0.7, 2);
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 640);
      g.addColorStop(0, `rgba(255,200,130,${0.32 * k})`);
      g.addColorStop(0.35, `rgba(255,120,50,${0.16 * k})`);
      g.addColorStop(1, 'rgba(255,90,30,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 1280, 720);
      c.restore();
    }
  }
}
