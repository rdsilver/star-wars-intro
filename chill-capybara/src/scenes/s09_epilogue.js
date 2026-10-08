// s09_epilogue — EXT. SNOOZE SPRINGS 2 — DAY. "THREE WEEKS LATER". Roles reversed: Barry blissed
// out (eyes shut, Sunny's orange on his head, helmet on his rock); Sunny bare-headed with the
// thermometer at 39.2, worried; Doreen frowning at Barry's old chart. Gerald lands on SUNNY, checks
// rule 1, introduces himself, "no reason" → Barry's eyes open, the orange rolls off into his paw and
// goes on the water, a nudge flips the helmet off the rock onto his head, he cinches the strap,
// "No reason." DUN-DUN (three snap zooms) → Sunny + Doreen zip out of frame left in a puff, Gerald
// left hanging in mid-air → wide: "Nothing... bothers the capybara." → the little hill sneezes
// (ah… ah… [inhale] CHOO, the s04 sneeze in miniature) → Barry, eyes shut: "Almost nothing."
//
// SHOTS (13 cuts, 5 names)
//   sign      the SNOOZE SPRINGS 2 board + the SPRING RULES sign planted beside it, Doreen frowning
//             at the chart below; slow push; THREE WEEKS LATER super (s01's caption style).
//   trio      kit group frame (rules sign in the right third). 1) roles reversed 2) Gerald's flight
//             (wing beats on the five 'flaps' strokes) + touch-down on 'land' + rule-1 glance/nod
//             3) the strap cinch through "why are you putting on the helmet?" 4) the bolt.
//   barry_cu  kit close-up; the swap instance holds a touch wider/right (rock in the action space);
//             the "No reason." instance snaps in on each sting_bad hit (DUN · DUN · DUNNN).
//   sunny_cu  kit close-up with Gerald on the head.
//   wide      the whole new spring, a slow push toward Barry + the hill that settles before the sneeze.
'use strict';
const K = require('../lib/kit');
const P = require('../lib/props');
const CAP = require('../lib/capybara');
const ES = require('../lib/env_spring');
const U = require('../lib/util');

const { clamp, lerp, ease, smoothstep } = U;
const NS = ES.NEW_SPRING;
const PI = Math.PI, TAU = Math.PI * 2;
const fin = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const posv = (v, d = 1, m = 0.001) => { v = fin(v, d); return v < m ? m : v; };
const rampE = (t, t0, dur, fn = ease.inOutCubic) => (dur > 0 ? fn(clamp((t - t0) / dur)) : t >= t0 ? 1 : 0);
const bump = (t, t0, dur) => { const u = (t - t0) / Math.max(1e-6, dur); return u > 0 && u < 1 ? Math.sin(PI * u) : 0; };
const keysE = (t, frames, fn = ease.inOutSine) => U.keys(t, frames, fn);

// ─────────────────────────────────────────────────────────────── set dressing (world units)
// Barry's rock is moved back (the env's spot is exactly the gap between Barry's and Doreen's snouts):
// here it sits in the water behind that gap, so the helmet on it reads clearly above their faces and
// is one snout-flick from his head. Drawn by the scene (env barryRock: false), scaled for depth.
const ENV_ROCK = NS.barryRock;                                    // {798, 552, rx 38, ry 21, top {794, 532}}
const ROCK = { x: 786, y: 510, s: 0.86 };
ROCK.top = { x: ROCK.x + (ENV_ROCK.top.x - ENV_ROCK.x) * ROCK.s, y: ROCK.y + (ENV_ROCK.top.y - ENV_ROCK.y) * ROCK.s };
const HELMET_REST = { x: ROCK.top.x - 6, y: ROCK.top.y + 2, rot: -0.05, scale: 0.92 };
const CHART = { x: ROCK.x + 26, y: ROCK.y + 4, scale: 0.4, rot: 0.16 };   // planted in the rock's right shoulder
const THERMO_READING = '39.2';
const HILL = NS.hillPuffPos;                                      // {880, 318}
// the SPRING RULES sign, planted 20 units further left than the standard new_spring spot: the trio
// frame then holds the whole board (rule 1 is the gag) and cuts cleanly before SNOOZE SPRINGS 2
const RULES = { setting: 'new_spring', x: NS.rulesSignSpot.x - 20 };
const RULES_X0 = K.rulesSignAnchors(RULES).left.x;
const GRADE = 'new';

// ─────────────────────────────────────────────────────────────── timing (memoised per timeline)
const MEMO = new WeakMap();
function timing(S) {
  let m = MEMO.get(S.tl);
  if (m) return m;
  const c = (n) => S.cue(n);
  const L = (who, txt) => K.lineWith(S, who, txt);
  const sfx = (n, def) => { const a = K.sfxTimes(S, n, { warn: false }); return a.length ? a[0] : def; };
  m = {};
  m.roles = c('roles_reversed');
  m.sL1 = L('sunny', 'thirty-nine'); m.bL1 = L('barry', 'natural spring'); m.gL1 = L('gerald', 'pleased');
  m.sL2 = L('sunny', 'vulture'); m.bL2 = L('barry', 'likes you'); m.sL3 = L('sunny', 'why my head');
  m.gL2 = L('gerald', 'no reason'); m.sL4 = L('sunny', 'helmet'); m.bL3 = L('barry', 'no reason');
  m.nL = L('narrator', 'bothers'); m.bL4 = L('barry', 'almost');
  m.wWho = K.wordTime(S, m.sL1, 'touching') - 0.3;
  m.wVulture = K.wordTime(S, m.sL2, 'vulture');
  m.wGerald3 = K.wordTime(S, m.sL3, 'Gerald');
  m.wNo = K.wordTime(S, m.gL2, 'no');
  m.wPleased = K.wordTime(S, m.gL1, 'Pleased');
  m.land = c('gerald_lands_sunny');
  m.touch = sfx('land', m.land + 1.6);
  const fl = sfx('flaps', m.land);
  m.strokes = [0.08, 0.36, 0.63, 0.9, 1.18].map((x) => fl + x);
  m.rule1 = c('gerald_reads_rule1');
  m.eyes = c('barry_eyes_open'); m.eyesD = S.cueDur('barry_eyes_open') || 0.9;
  m.swap = c('helmet_swap');
  const st = sfx('sting_bad', m.bL3 ? m.bL3.le : 24.66);
  m.hits = [st, st + 0.3, st + 0.6];
  m.bolt = c('everyone_bolts');
  m.pass = sfx('whoosh_left', m.bolt) + 0.27;
  m.sneeze = c('hill_sneeze');
  const rd = sfx('rumble_distant', m.sneeze);
  m.puff1 = rd; m.puff2 = rd + 0.35; m.boom = rd + 0.8;
  // the swap (helmet_swap, 1.3 s): orange rolls off into the paw → set on the water → nudge the
  // helmet off the rock → it flips onto his head → paw to the chin strap
  const s0 = m.swap;
  m.sw = {
    paw0: s0, paw1: s0 + 0.2,
    tilt0: s0 + 0.03, tiltDn: s0 + 0.24,
    roll0: s0 + 0.1, catch: s0 + 0.34,
    lower0: s0 + 0.38, release: s0 + 0.58,
    dip0: s0 + 0.5, dip1: s0 + 0.64,
    launch: s0 + 0.64, landH: s0 + 0.98,
    strapPaw: s0 + 1.0,
  };
  // the cinch: three tugs through Sunny's "why are you putting on the helmet?"
  m.tugs = [s0 + 1.22, m.sL4 ? m.sL4.ls + 0.75 : s0 + 1.9, m.sL4 ? m.sL4.ls + 1.45 : s0 + 2.6];
  m.strapDone = m.tugs[2] + 0.12;
  m.pawDown = m.strapDone + 0.25;
  // the bolt
  m.zip0 = m.bolt + 0.1;                         // anticipation → zip
  m.zip1 = Math.max(m.zip0 + 0.12, m.pass - 0.02); // both past the left edge on the whoosh's pass
  m.lookDown = m.bolt + 0.6;
  m.flap = m.bolt + 1.2;
  // Barry's eyes close again on the last DUNNN
  m.reclose0 = m.hits[1] + 0.12; m.reclose1 = m.hits[2] + 0.05;
  // Gerald's hanging perch: Sunny's head top at the bolt, his default spot
  const S2 = S.tl.sceneTime(S.id, S.scene.start + m.bolt - 0.05);
  const g = K.castOpts(S2, 'sunny', { accessories: { orange: false } });
  const a = K.castAnchors(g);
  m.hang = { x: a.headTop.x, y: a.headTop.y, rot: fin(a.headTop.angle, 0), scale: 0.75 * posv(g.scale, 1) };
  MEMO.set(S.tl, m);
  return m;
}

// strap 0..1: seated open (0) → three tugs
function strapAt(m, t) {
  let v = 0;
  const steps = [0.38, 0.72, 1];
  m.tugs.forEach((tt, i) => { v = Math.max(v, lerp(i ? steps[i - 1] : 0, steps[i], ease.outBack(clamp((t - tt) / 0.14), 2.2))); if (t < tt) v = Math.min(v, i ? steps[i - 1] : 0); });
  return clamp(v);
}

// ─────────────────────────────────────────────────────────────── BARRY
function barryCfg(S, m, t, sh) {
  const o = { rest: 'chill', reactions: false, turn: false, blink: true };
  const acc = { glasses: true, orange: t < m.sw.roll0, helmet: false };
  if (t >= m.sw.landH) {
    const lift = 0.3 * (1 - ease.outCubic(clamp((t - m.sw.landH) / 0.12)));
    acc.helmet = { lift, strap: strapAt(m, t) };
  }
  o.accessories = acc;
  let tilt = 0, sx = 1, sy = 1, dy = 0;

  // ── eyes: shut (bliss) → slowly open → deadpan through the swap → smug "No reason." → shut again
  let eyes;
  if (t < m.eyes) eyes = 0;
  else if (t < m.reclose0) eyes = keysE(t, [[m.eyes, 0], [m.eyes + 0.32, 0.18], [m.eyes + 0.5, 0.2], [m.eyes + m.eyesD, 0.52]]);
  else eyes = keysE(t, [[m.reclose0, 0.5], [m.reclose1, 0]]);
  if (eyes != null) o.eyes = eyes;
  if (eyes < 0.08) o.blink = false;

  // ── mood
  const bliss = t < m.eyes || t >= m.reclose0 + 0.1;
  if (t < m.eyes) {
    o.mood = S.speaking('barry') ? { chill: 0.72, happy: 0.28 } : 'chill';
  } else if (t < m.bL3.ls - 0.1) {
    o.mood = CAP.capyMood(t, [[m.eyes, 'chill'], [m.eyes + 0.3, 'deadpan']], 0.3);
  } else if (t < m.reclose0) {
    o.mood = 'smug';
  } else {
    o.mood = CAP.capyMood(t, [[m.reclose0, 'smug'], [m.reclose1, 'chill']], 0.35);
    if (m.bL4 && t > m.bL4.ls - 0.3) o.mood = { chill: 0.75, smug: 0.25 };
  }

  // ── bliss float: head back a touch, sunk a little lower, slow sway
  if (bliss) {
    tilt += 4 + 1.6 * Math.sin(S.T * 0.8);
    dy += 4;
  }
  // ── eyes open: blank ahead → a slow slide back to Gerald on Sunny's head → down to the job
  if (t >= m.eyes && t < m.swap + 0.1) {
    o.look = t < m.eyes + 0.45 ? { x: 0.35, y: 0 } : t < m.swap - 0.05 ? { x: -0.95, y: -0.45 } : { x: 0.5, y: 0.3 };
    tilt += keysE(t, [[m.eyes, 4], [m.eyes + 0.6, 0]]);
  }
  // ── the swap
  const W = m.sw;
  if (t >= W.paw0 - 0.05 && t < m.pawDown + 0.4) {
    // head: forward (orange rolls off) → up → dip to the helmet → flick → level
    // (the helmet sits up and to the right on the rock: a little anticipation dip, then the snout
    // flicks UP into its rim — it flips back onto his head and he nods into it)
    tilt += keysE(t, [[W.tilt0, 0], [W.tiltDn, -15], [W.catch + 0.02, -15], [W.dip0, -3], [W.dip0 + 0.07, -8], [W.dip1, 22], [W.launch + 0.16, 12], [W.landH, -4], [W.landH + 0.22, 0]]);
    o.look = t < W.release ? { x: 0.75, y: 0.75 } : t < W.landH ? { x: 0.95, y: 0.2 } : { x: 0.4, y: 0.55 };
    // paw: up to catch → down to the water (lets go) → up to the chin strap → fiddles → down
    let pawUp, pawAt;
    // (never a partial pawUp below the surface: the arm would show through the water as a stick)
    const tug = m.tugs.reduce((a, tt) => a + bump(t, tt - 0.06, 0.24), 0);
    pawUp = rampE(t, W.paw0, 0.12, ease.outCubic) * (1 - rampE(t, m.pawDown, 0.14, ease.inCubic));
    if (t < W.release) {
      const dn = rampE(t, W.lower0, W.release - W.lower0, ease.inOutSine);
      pawAt = { x: lerp(102, 126, dn), y: lerp(-28, 2, dn) + 8 * bump(t, W.catch, 0.16) };
    } else if (t < W.strapPaw) {
      const up = rampE(t, W.release + 0.04, 0.26, ease.inOutSine);
      pawAt = { x: lerp(126, 98, up), y: lerp(2, -18, up) };
    } else {
      const up = rampE(t, W.strapPaw, 0.2, ease.inOutSine);
      // fiddling with the buckle, a pull down-back on each cinch
      pawAt = { x: lerp(98, 86, up) - 6 * tug + 1.5 * Math.sin(t * 17), y: lerp(-18, -12, up) + 9 * tug };
      tilt += -3 * tug;
    }
    if (pawUp > 0.002) { o.pawUp = clamp(pawUp); o.pawAt = pawAt; }
    // the orange in the paw (the rig draws a thumb over it)
    if (t >= W.catch && t < W.release) {
      o.hold = (c, p) => {
        const s = posv(p.scale, 1);
        CAP.drawCapyOrange(c, { x: p.x + 4 * s, y: p.y - 15 * s, r: 16 * s, t: S.T, rot: 0.6, tint: o.tint });
      };
    }
    // the helmet lands: a small settle
    if (t >= W.landH - 0.02 && t < W.landH + 0.6) {
      const tk = K.take(t, W.landH, { amount: 0.28, anticipation: 0.02 });
      sx *= tk.sx; sy *= tk.sy; dy += tk.dy;
    }
  }
  // ── trio, cinching the strap: busy, eyes on the job
  if (t >= sh.t0 && sh.name === 'trio' && t >= m.swap && t < m.bolt) o.look = { x: 0.45, y: 0.6 };
  // ── "No reason." — chin up, eyes slide to the lens; the DUN-DUN; the eyes close on the DUNNN
  if (t >= m.bL3.ls - 0.25 && t < m.bolt) {
    const k = rampE(t, m.bL3.ls - 0.25, 0.4, ease.inOutSine) * (1 - rampE(t, m.reclose0, 0.3, ease.inOutSine));
    tilt += 4 * k;
    o.headTurn = 0.3 * k;
    o.look = { x: 0.15, y: 0 };
    for (const h of m.hits) {
      const tk = K.take(t, h, { amount: 0.12, anticipation: 0.01, stretch: 0.06, settle: 0.25 });
      sx *= tk.sx; sy *= tk.sy;
    }
  }
  // ── after the bolt: blissful again — the wake rocks him a little
  if (t >= m.zip0) {
    const u = t - m.zip0;
    dy += 3 * Math.sin(u * 7) * Math.exp(-u * 1.6);
    tilt += 2 * Math.sin(u * 6 + 1) * Math.exp(-u * 1.4);
  }
  o.tiltAdd = tilt;
  o.y = NS.swimSpots.barry.y + dy;
  o.squash = { sx, sy };
  return o;
}

// ─────────────────────────────────────────────────────────────── SUNNY
function sunnyCfg(S, m, t, sh) {
  const o = { rest: 'worried' };
  // the thermometer: read close (tilted to his eye), then held up as Exhibit A
  const read = t < m.wWho;
  o.accessories = { orange: false, thermometer: false };
  // ...and lowers it into the water as he finishes the line (it stays out of everyone's close-ups)
  const lower = rampE(t, m.sL1.le - 0.42, 0.32, ease.inOutSine);
  if (lower < 1) {
    o.accessories.thermometer = { at: 'paw', level: P.thermoLevel(39.2), reading: THERMO_READING, angle: (read ? -0.25 : -0.05) + 0.5 * lower };
    o.pawUp = 1 - lower;
  }
  if (t < m.wWho) { o.look = { x: 0.65, y: 0.55 }; o.tiltAdd = -4; }
  // Gerald on approach: the flapping — eyes up and back
  if (t >= m.land + 0.7 && t < m.touch) o.lookAt = 'gerald';
  // touch-down: a take (the weight lands), a beat of shock
  if (t >= m.touch - 0.12 && t < m.touch + 0.9) {
    const tk = K.take(t, m.touch, { amount: 0.75, anticipation: 0.05 });
    o.squash = { sx: tk.sx, sy: tk.sy, dy: tk.dy };
    const w = smoothstep(m.touch - 0.04, m.touch + 0.06, t) * (1 - smoothstep(m.touch + 0.35, m.touch + 0.8, t));
    if (w > 0.01 && !S.speaking('sunny')) o.mood = { shock: w, worried: 1 - w };
    o.look = { x: 0.1, y: -1 };
  }
  // "Barry... there's a vulture on my head." — to Barry, then the eyes roll up at "vulture"
  if (m.sL2 && t >= m.sL2.ls && t < m.sL2.le + 0.4) o.look = t < m.wVulture - 0.1 ? { x: 1, y: -0.1 } : { x: 0.15, y: -1 };
  // after "no reason": a gulp
  if (m.gL2 && t >= m.gL2.le - 0.1 && t < m.bolt) o.accessories.sweat = 0.9;
  // the bolt: anticipation (stretch, eyes wide, already facing left) → zip off left
  if (t >= m.bolt) {
    Object.assign(o, zipCfg(m, t, 'sunny'));
  }
  return o;
}

// ─────────────────────────────────────────────────────────────── DOREEN
function doreenCfg(S, m, t, sh) {
  const o = { rest: 'worried' };
  const chartLook = { x: CHART.x, y: CHART.y - 52 };
  // studies the chart; a glance at Sunny's thermometer; looks at Barry for "Who's touching...?"
  if (t < m.roles + 0.45) { o.lookAt = chartLook; o.tiltAdd = -5; }
  else if (t < m.wWho - 0.2 && t >= m.roles + 0.45) { /* kit: glances at Sunny */ }
  else if (t < m.land + 0.6) { o.lookAt = 'barry'; }
  else if (t < m.touch + 1.4) { o.lookAt = 'gerald'; }
  else if (t < m.eyes) { o.lookAt = t < m.sL2.ls - 0.2 ? 'gerald' : chartLook; if (t >= m.sL2.ls - 0.2) o.tiltAdd = -4; }
  else if (t < m.bolt) { o.lookAt = 'barry'; }
  // the helmet goes on: her alarm grows through Sunny's question
  if (t >= m.swap + 0.6 && t < m.bolt) o.mood = CAP.capyMood(t, [[m.swap + 0.6, 'worried'], [m.tugs[1], 'shock']], 0.4);
  if (t >= m.bolt) Object.assign(o, zipCfg(m, t, 'doreen'));
  return o;
}

// the zip: 0 → .1 s anticipation, then out of frame left on the whoosh's pass
function zipCfg(m, t, who) {
  const home = NS.swimSpots[who];
  const o = { flip: true, mood: 'shock', eyes: 1, blink: false, look: { x: 1, y: 0 } };
  if (t >= m.zip1) return { hidden: true };
  if (t < m.zip0) {
    const k = ease.outCubic(clamp((t - m.bolt) / (m.zip0 - m.bolt)));
    o.x = home.x + 14 * k;
    o.squash = { sx: 1 - 0.14 * k, sy: 1 + 0.16 * k, dy: -6 * k };
    return o;
  }
  const k = clamp((t - m.zip0) / (m.zip1 - m.zip0));
  const dist = home.x + 420;
  o.x = home.x + 14 - dist * ease.inQuad(k);
  o.squash = { sx: 1 + 1.1 * Math.min(1, k * 3), sy: 1 - 0.3 * Math.min(1, k * 3), dy: 4 };
  return o;
}

// ─────────────────────────────────────────────────────────────── GERALD
// wing beats on the 'flaps' strokes (mid-downstroke ≈ phase .25 of each cycle), then wings up for
// the flare into the touch-down
function flapSync(m, t) {
  const s = m.strokes;
  if (t <= s[0]) return 0.3 - (s[0] - t) / 0.28;
  for (let i = 1; i < s.length; i++) if (t < s[i]) return 0.3 + (i - 1) + (t - s[i - 1]) / (s[i] - s[i - 1]);
  const last = s[s.length - 1];
  const k = clamp((t - last) / 0.22);
  return 0.3 + (s.length - 1) + 0.7 * ease.outCubic(k);    // → 5.0 = wings up, held into the flare
}
function geraldCfg(S, m, t, sh) {
  if (t < m.bolt) {
    const g = { on: 'sunny', land: { beat: 'gerald_lands_sunny', from: { x: -120, y: 170 } } };
    if (t < m.touch - 0.05) g.flapPhase = flapSync(m, t);
    // rule 1: glance → tidy nod → down to Sunny for "Gerald. Pleased to meet you."
    const sign = K.rulesSignAnchors(RULES);
    const r0 = m.rule1 + 0.05;
    if (t >= r0 && t < m.wPleased - 0.05) {
      g.lookAt = { x: sign.lines[1].x, y: sign.lines[1].y };
      g.nod = bump(t, r0 + 0.16, 0.26) * 0.9;
    } else if (t >= m.wPleased - 0.05 && t < m.gL1.le + 0.3) {
      g.look = { x: 0.55, y: 1 };
    }
    // "Oh..." — an innocent glance away at the hills, then "no reason." down at Sunny
    if (m.gL2 && t >= m.gL2.ls - 0.1 && t < m.gL2.le + 0.4) {
      g.look = t < m.wNo - 0.08 ? { x: 0.9, y: -0.6 } : { x: 0.5, y: 1 };
    }
    // the strap cinch (trio): he watches Barry
    if (t >= m.swap + 1 && t < m.bolt && sh.name === 'trio') g.lookAt = 'barry';
    return g;
  }
  // ── left hanging where Sunny's head was: perch pose in mid-air → looks down → flaps → hovers
  const H = m.hang;
  const g = { on: { x: H.x, y: H.y, scale: H.scale, flip: false, rot: H.rot }, depthY: 590.5, mood: 'deadpan', blink: true };
  if (t < m.lookDown) g.look = { x: 0.5, y: 0 };
  else if (t < m.flap) { g.look = { x: 0.35, y: 1 }; g.nod = 0.35 * rampE(t, m.lookDown, 0.2, ease.outCubic); g.mood = 'worried'; }
  if (t >= m.flap) {
    const f = t - m.flap;
    // the drop (he notices gravity), the flaps catch him; then a slow hover that drifts over Barry
    const drop = 16 * Math.sin(PI * clamp(f / 0.42));
    const rise = 30 * ease.inOutSine(clamp((f - 0.3) / 1.4));
    const over = ease.inOutSine(clamp((f - 0.9) / 2.8));
    const tx = 610, ty = 432;
    // flap rate 2.6 Hz (catching himself) easing to a lazy 1.7 Hz hover (integrated → continuous phase)
    const u = clamp(f - 0.5, 0, 1.2);
    const ph = f < 0.5 ? f * 2.6 : 1.3 + 2.6 * u - 0.375 * u * u + 1.7 * Math.max(0, f - 1.7);
    const bob = f > 0.4 ? 4 * Math.sin(ph * TAU + 2.2) : 0;
    g.on = { x: lerp(H.x, tx, over), y: lerp(H.y + drop - rise, ty, over) + bob, scale: H.scale, flip: false, rot: 0 };
    g.pose = 'fly'; g.pose2 = 'land'; g.poseMix = 0.55; g.wing = 1;
    g.flapPhase = ph;
    g.mood = f < 0.5 ? 'worried' : 'neutral';
    g.look = { x: 0.6, y: 0.4 };
  }
  // the hill: he looks at it (first puff), flinches at the CHOO, then looks down at Barry
  if (t >= m.puff1 - 0.05) {
    g.lookAt = t < m.boom + 0.5 ? { x: HILL.x, y: HILL.y - 30 } : 'barry';
    if (t >= m.boom && t < m.boom + 0.6) g.ruffle = 0.8 * (1 - clamp((t - m.boom) / 0.6));
  }
  return g;
}

// ─────────────────────────────────────────────────────────────── the hill sneeze (s04, in miniature)
// little puff (ah), little puff (ah), the hill INHALES both, then CHOO — one big puff that hangs
function hillPuffs(m, t) {
  const out = [];
  const inhale0 = m.boom - 0.3, inhale1 = m.boom - 0.04;
  const suck = smoothstep(inhale0, inhale1, t);
  const little = (t0, size, seed) => {
    if (t < t0) return;
    let k = Math.min(clamp((t - t0) / 1.0), 0.42);
    if (t > inhale0) k = lerp(Math.min(clamp((inhale0 - t0) / 1.0), 0.42), 0, ease.inCubic(suck));
    if (k > 0.004 && t < inhale1) out.push({ k, size, seed, rise: 20, hang: 0.55, drift: 8 });
  };
  little(m.puff1, 0.55, 1);
  little(m.puff2, 0.62, 2);
  if (t >= m.boom) {
    const k = (t - m.boom) / 7;
    if (k < 1) out.push({ k, size: 1.6, dark: 0.18, seed: 3, rise: 24, hang: 0.86, drift: 30 });
  }
  return out;
}
const SPRAY = [[-1, -0.55, 0.9], [-0.55, -1, 1.1], [0.15, -1.15, 0.8], [0.7, -0.85, 1.0], [1.05, -0.35, 0.85], [-1.15, -0.15, 0.7]];
function drawHillSpray(ctx, m, t) {
  const u = t - m.boom;
  if (u < 0 || u > 1.3) return;
  SPRAY.forEach(([dx, dy, s], i) => {
    const v = u - i * 0.012;
    if (v <= 0) return;
    const fly = 1 - Math.exp(-v * 4.2);
    const x = HILL.x + dx * 62 * fly * s, y = HILL.y - 8 + dy * 36 * fly * s + 14 * v * v;
    P.drawSmokePuff(ctx, { x, y, r: 5 + 3.5 * s, life: clamp(v / 1.3), t: t + i, seed: 40 + i, tone: 'grey', rise: 0.4, grade: GRADE });
  });
}
function drawHillRing(ctx, m, t) {
  const u = t - m.boom;
  if (u < 0 || u > 0.5) return;
  const k = u / 0.5;
  const R = 16 + 80 * ease.outCubic(k);
  ctx.save();
  ctx.strokeStyle = '#FFFFFF';
  for (const [a, w, sc] of [[0.55, 3.2, 1], [0.35, 2, 0.72]]) {
    ctx.globalAlpha = (1 - k) * a;
    ctx.lineWidth = Math.max(0.4, w * (1 - k));
    for (const [a0, a1] of [[PI * 0.82, PI * 1.22], [-PI * 0.22, PI * 0.18]]) {
      ctx.beginPath(); ctx.ellipse(HILL.x, HILL.y - 4, Math.max(1, R * sc), Math.max(1, R * sc * 0.3), 0, a0, a1); ctx.stroke();
    }
  }
  ctx.restore();
}
function drawHillBirds(ctx, m, t) {
  const u = t - m.boom - 0.04;
  if (u < 0 || u > 2.2) return;
  const flock = [[858, 330, -1], [872, 326, 1], [846, 334, -1], [892, 332, 1]];
  ctx.save();
  ctx.strokeStyle = '#3A4250';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  flock.forEach(([x0, y0, d], i) => {
    const v = u - i * 0.05;
    if (v < 0) return;
    const x = x0 + d * (24 * v + 14 * v * v) + Math.sin(v * 9 + i) * 1.2;
    const y = y0 - 42 * v + 5 * v * v;
    const w = 4.6 + (i % 2);
    const fl = Math.sin((v + i * 0.13) * 34);
    ctx.globalAlpha = 1 - smoothstep(1.6, 2.2, v);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x - w, y - fl * 2);
    ctx.quadraticCurveTo(x - w * 0.45, y - 1.2 - fl, x, y);
    ctx.quadraticCurveTo(x + w * 0.45, y - 1.2 - fl, x + w, y - fl * 2);
    ctx.stroke();
  });
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────── props in the scene
function barryAnch(st, extraAcc) {
  const b = st.cast.barry;
  if (!b) return null;
  const o = b.opts;
  return K.castAnchors({ ...o, accessories: { ...(o.accessories || {}), ...extraAcc } });
}
// the orange: on his head → rolls forward off the crown, over the brow → into the paw (rig hold)
// → let go on the water → floats beside him for the rest of the scene
function drawRollingOrange(c, st, m, t) {
  const W = m.sw;
  if (t < W.roll0 || t >= W.catch) return;
  const A = barryAnch(st, { orange: true });
  if (!A) return;
  const r = fin(A.orange.r, 17);
  const u = clamp((t - W.roll0) / (W.catch - W.roll0));
  const p0 = { x: A.orange.x, y: A.orange.y };
  const p1 = { x: A.snout.x - 2, y: A.snout.y - r - 18 };        // over the brow, off the top of the snout
  const s = posv(A.scale, 1);
  const p2 = { x: A.paw.x + 4 * s, y: A.paw.y - 15 * s };        // into the paw
  let x, y;
  const ka = 0.62;
  if (u < ka) {
    const k = ease.inQuad(u / ka);
    x = lerp(p0.x, p1.x, k);
    y = lerp(p0.y, p1.y, k) - 16 * Math.sin(PI * k);             // rides the curve of the skull
  } else {
    const k = (u - ka) / (1 - ka);
    x = lerp(p1.x, p2.x, k) + 6 * Math.sin(PI * k);
    y = lerp(p1.y, p2.y, ease.inQuad(k));
  }
  const rot = 0.2 + (Math.hypot(x - p0.x, y - p0.y) / r);
  CAP.drawCapyOrange(c, { x, y, r: lerp(r, 16 * s, u), t: st.T, rot, tint: st.cast.barry.opts.tint, rim: st.cast.barry.opts.rim });
}
// the floating orange (after he lets go)
function floatOrangeAt(m, t) {
  const u = t - m.sw.release;
  if (u < 0) return null;
  // set down in front of his chest, drifts slowly forward + right, rocked by the bolt's wake
  const x = 784 + 22 * (1 - Math.exp(-u * 0.35)) + 1.2 * Math.sin(u * 0.9);
  const wake = t > m.zip0 ? 5 * Math.sin((t - m.zip0) * 8) * Math.exp(-(t - m.zip0) * 1.8) : 0;
  const settle = -4 * Math.exp(-u * 5) * Math.cos(u * 14);
  const wy = 612;
  return { x, wy, y: wy - 12 + settle + 1.4 * Math.sin(u * 2.3) + wake, rot: 0.9 + 0.12 * Math.sin(u * 0.7) + 0.3 * (1 - Math.exp(-u * 2)) };
}
// the helmet: on the rock → nudged → one lazy flip up onto his head (then the rig draws it)
function drawFlyingHelmet(c, st, m, t) {
  const W = m.sw;
  if (t < W.launch || t >= W.landH) return;
  const A = barryAnch(st, { helmet: { lift: 0.3, strap: 0 } });
  if (!A) return;
  const u = clamp((t - W.launch) / (W.landH - W.launch));
  const k = ease.inOutSine(u);
  const ax = A.helmet.x, ay = A.helmet.y;
  const x = lerp(HELMET_REST.x, ax, k);
  const y = lerp(HELMET_REST.y, ay, k) - 40 * Math.sin(PI * Math.min(1, u * 1.04));
  const rot = lerp(HELMET_REST.rot, fin(A.helmet.angle, 0) - 0.22 - TAU, ease.inOutSine(u));
  P.drawHelmet(c, { x, y, scale: lerp(HELMET_REST.scale, posv(A.helmet.scale, 1.05), k), rot, strap: true, grade: GRADE });
}

// ─────────────────────────────────────────────────────────────── the bolt: dust + spray + speed lines
function drawBoltFx(c, st, m, t, layer) {
  if (t < m.zip0 - 0.02 || t > m.bolt + 2.4) return;
  for (const who of ['sunny', 'doreen']) {
    const home = NS.swimSpots[who];
    const v = t - m.zip0;
    if (layer === 'back') {
      // a long spray streak along the water where they tore off
      if (v >= 0 && v < 1.4) P.drawWaterSplash(c, { x: home.x - 60, y: home.y + 2, r: 30, t: v, seed: who === 'sunny' ? 3 : 7, w: 120, part: 'back', grade: GRADE });
      continue;
    }
    if (v >= 0 && v < 1.4) P.drawWaterSplash(c, { x: home.x - 60, y: home.y + 2, r: 30, t: v, seed: who === 'sunny' ? 3 : 7, w: 120, part: 'front', grade: GRADE });
    // the cartoon exit puff: a cluster of white cloud puffs where they were
    const puffs = [[-40, -40, 34], [0, -66, 40], [40, -44, 34], [-74, -14, 26], [72, -18, 28], [10, -18, 36]];
    puffs.forEach(([dx, dy, r], i) => {
      const life = (v + 0.02 - i * 0.012) / 1.15;
      if (life <= 0 || life >= 1) return;
      P.drawSmokePuff(c, { x: home.x + dx - 30 * clamp(v * 3), y: home.y + dy, r: r * (who === 'doreen' ? 0.95 : 1.05), life, t: st.T + i, seed: (who === 'sunny' ? 10 : 30) + i, tone: 'white', rise: 0.5, grade: GRADE });
    });
  }
}
function drawSpeedLines(c, st, m, t) {
  if (t < m.zip0 - 0.01 || t > m.zip1 + 0.25) return;
  for (const who of ['sunny', 'doreen']) {
    const e = st.cast[who];
    const home = NS.swimSpots[who];
    const k = clamp((t - m.zip0) / (m.zip1 - m.zip0));
    const fade = 1 - clamp((t - m.zip1) / 0.25);
    const x = e && !e.opts.hidden ? e.opts.x : home.x - (home.x + 420);
    P.drawMotionLines(c, { x: x + 110, y: home.y - 52, angle: PI, len: 140 + 260 * k, count: 5, spread: 70, gap: 16, width: 4, color: '#FFFFFF', alpha: 0.85 * fade, t: st.T, seed: who === 'sunny' ? 2 : 5 });
  }
}

// ─────────────────────────────────────────────────────────────── the caption
function drawCaption(ctx, t) {
  const t0 = 0.3, t1 = 2.02;
  if (t < t0 || t > t1 + 0.05) return;
  const kin = ease.outCubic(clamp((t - t0) / 0.32));
  const kout = ease.inCubic(clamp((t - (t1 - 0.22)) / 0.22));
  if (kout >= 1) return;
  const x = 66, y = 118;
  ctx.save();
  // the gold rule wipes in from the left (s01's caption language), the type follows
  const rw = 372 * kin * (1 - kout);
  ctx.fillStyle = `rgba(60,38,18,${0.45 * (1 - kout)})`;
  ctx.fillRect(x + 2, y + 15, Math.max(0.5, rw), 4);
  ctx.fillStyle = `rgba(255,214,122,${(1 - kout)})`;
  ctx.fillRect(x, y + 12, Math.max(0.5, rw), 4);
  const kt = ease.outCubic(clamp((t - t0 - 0.08) / 0.3)) * (1 - kout);
  ctx.globalAlpha = kt;
  ctx.translate(-24 * (1 - kt), 0);
  ctx.font = '600 46px Fredoka';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(30,18,6,0.45)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.strokeStyle = 'rgba(58,36,16,0.9)';
  ctx.lineWidth = 7;
  ctx.strokeText('THREE WEEKS LATER', x, y);
  ctx.shadowColor = 'rgba(0,0,0,0)';
  ctx.fillStyle = '#FFF7E6';
  ctx.fillText('THREE WEEKS LATER', x, y);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────── cameras
function framings(m) {
  const F = K.SPRING_FRAMINGS;
  return {
    sign: { x: 1080, y: 420, zoom: 1.72, push: 0.008 },
    // shifted right a little: the moored raft's banner stays out of frame (no cropped "YOU SO")
    sunny_cu: (I) => { const b = F.sunny_cu(I); return b ? { ...b, x: b.x + 62 } : b; },
    // the kit's group frame a touch tighter: the rules sign whole on the right, SNOOZE SPRINGS 2 out
    trio: (I) => { const b = K.trioFrame(I, { zoom: 1.6 }); return { ...b, x: 636 }; },
    barry_cu: (I) => {
      const base = F.barry_cu(I);
      if (!base) return base;
      const sh = I.shot;
      // the swap: a touch wider and to the right — the rock and the flip in the action space
      if (sh.t0 <= m.swap && sh.t1 > m.swap) {
        // (right edge kept short of the SPRING RULES board: no half-sign peeking in at the corner)
        // (higher, so the flip's arc stays in frame; right edge short of the SPRING RULES board and the
        // left edge short of Gerald's beak — no half-sign or half-vulture peeking in at a corner)
        const z = base.zoom;
        return { ...base, x: Math.min(base.x + 10, RULES_X0 - 6 - 640 / z), y: base.y - 36, zoom: z, push: 0.007 };
      }
      // "No reason." + DUN · DUN · DUNNN: snap zooms on the hits
      if (sh.t0 <= m.hits[0] && sh.t1 > m.hits[0]) {
        let z = 1;
        m.hits.forEach((h, i) => { z *= 1 + [0.15, 0.15, 0.24][i] * ease.outCubic(clamp((I.S.t - h) / 0.06)); });
        const eye = I.L && I.L.chars.barry ? I.L.chars.barry.eye : { x: base.x, y: base.y };
        const k = (z - 1) / z;
        return { ...base, x: lerp(base.x, eye.x + 6, Math.min(1, k * 1.25)), y: lerp(base.y, eye.y + 14, Math.min(1, k * 1.25)), zoom: base.zoom * z, push: 0.004, drift: 0.4 };
      }
      return base;
    },
    wide: { x: 640, y: 360, zoom: 1.0, foliage: 1, push: 0, move: { at: m.nL ? m.nL.ls - 0.2 : 27.3, dur: Math.max(1, m.puff1 - 0.15 - (m.nL ? m.nL.ls - 0.2 : 27.3)), to: { x: 775, y: 432, zoom: 1.3 }, ease: 'inOutSine' } },
  };
}

// ─────────────────────────────────────────────────────────────── render
module.exports = {
  render(ctx, t, S) {
    const m = timing(S);
    const sh = K.shot(S);
    const cast = {
      barry: barryCfg(S, m, t, sh),
      sunny: sunnyCfg(S, m, t, sh),
      doreen: doreenCfg(S, m, t, sh),
    };
    const gerald = geraldCfg(S, m, t, sh);
    const items = [];
    // the rolling orange + the flying helmet: in front of Barry
    items.push({ x: 650, y: 600.6, draw: (c, st) => { drawRollingOrange(c, st, m, t); drawFlyingHelmet(c, st, m, t); } });
    const fo = floatOrangeAt(m, t);
    if (fo) items.push({ x: fo.x, y: fo.wy, draw: (c) => P.drawOrange(c, { x: fo.x, y: fo.y, r: 15, t: S.T, rot: fo.rot, seed: 3, waterY: fo.wy, grade: GRADE }) });
    // the bolt's spray (back half behind them, front half + puffs in front of everyone)
    if (t >= m.zip0 - 0.02 && t < m.bolt + 2.4) items.push({ x: 360, y: 560, draw: (c, st) => drawBoltFx(c, st, m, t, 'back') });

    K.drawSpringStage(ctx, t, S, {
      env: { waterHeat: 0.22, raft: true, barryRock: false, puffs: hillPuffs(m, t) },
      cast,
      gerald,
      items,
      framings: framings(m),
      hooks: {
        behind: (c, st) => {
          // Barry's rock (moved back, see ROCK)
          c.save(); c.translate(ROCK.x, ROCK.y); c.scale(ROCK.s, ROCK.s); c.translate(-ENV_ROCK.x, -ENV_ROCK.y);
          ES.drawBarryRock(c, st.T, { setting: 'new_spring' });
          c.restore();
          // the SPRING RULES sign beside the SNOOZE SPRINGS 2 board; rule 1 lights up under Gerald's glance
          const hk = rampE(t, m.rule1 + 0.08, 0.24, ease.outCubic) * (1 - rampE(t, m.gL1.le + 0.6, 0.5));
          K.drawRulesSign(c, st.T, hk > 0.001 ? { ...RULES, highlight: 1, highlightK: hk, grade: GRADE } : { ...RULES, grade: GRADE });
          // the hill's sneeze extras (ring, spray, birds)
          drawHillRing(c, m, t); drawHillSpray(c, m, t); drawHillBirds(c, m, t);
          // Barry's old chart, planted in his rock (Doreen's homework)
          P.drawChart(c, { x: CHART.x, y: CHART.y, scale: CHART.scale, rot: CHART.rot, grade: GRADE });
          // the helmet on its rock
          if (t < m.sw.launch) {
            const nudge = t > m.sw.dip1 - 0.08 ? 0.12 * bump(t, m.sw.dip1 - 0.08, 0.16) : 0;
            P.drawHelmet(c, { x: HELMET_REST.x, y: HELMET_REST.y - 3 * nudge, scale: HELMET_REST.scale, rot: HELMET_REST.rot - nudge, strap: true, grade: GRADE });
          }
        },
        afterCast: (c, st) => {
          drawBoltFx(c, st, m, t, 'front');
          drawSpeedLines(c, st, m, t);
        },
        screen: (c) => drawCaption(c, t),
      },
    });
  },
};
