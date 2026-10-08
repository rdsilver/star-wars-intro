// s04_rumble — THE EVIDENCE (spring_day, ~30 s).
// A low rumble (ripples, wobbling head-oranges, Gerald's talons dig in) → an orange shakes loose from
// the grove on Mount Snooze, bounces down the slope and plops into the back-right of the pool → it
// drifts out from behind Doreen's chin and parks under Barry's nose ("See? The mountain provides.")
// → Mount Snooze sneezes (ah… ah… [inhales its own puffs] …CHOO) → the cloud hangs over everyone
// while Doreen reassures → thermometer 39.8 → three fish with tiny suitcases pop out over the LEFT
// rim rocks into the river (the third one looks back… and doesn't say goodbye) → rant, Gerald's
// verdict, "unless they smell smoke!" (sniff, sniff).
'use strict';
const K = require('../lib/kit');
const U = require('../lib/util');
const P = require('../lib/props');
const CR = require('../lib/critters');
const CAP = require('../lib/capybara');
const ES = require('../lib/env_spring');

const SP = ES.SPRING;
const { clamp, lerp, ease, smoothstep, noise1 } = U;
const fin = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const pos = (v, d = 1, m = 0.01) => { v = fin(v, d); return v < m ? m : v; };

// ─────────────────────────────────────────────────────────────── timing (memoised per timeline)
const MEMO = new WeakMap();
function plan(S) {
  let m = MEMO.get(S.tl);
  if (m) return m;
  const one = (n, i = 0, d = null) => { const a = K.sfxTimes(S, n); return a.length > i ? a[i] : d; };
  const roll = S.cue('orange_rolls');
  const splash = one('splash', 0, roll + 1.6);
  const sneeze = S.cue('volcano_sneeze');
  const whoosh = one('whoosh', 0, null);
  const check = S.cue('thermo_check');
  const ping = one('glass_ping', 0, check);
  const fish = S.cue('fish_leave');
  const pops = K.sfxTimes(S, 'pop').filter((p) => p >= fish - 0.05).slice(0, 3);
  while (pops.length < 3) pops.push(fish + pops.length * 0.7);
  const cams = S.tl.cams.filter((c) => c.scene === S.id).map((c) => ({ name: c.name, t: c.time - S.scene.start }));
  const lines = S.lines();
  const L = (who, n) => lines.filter((l) => l.char === who)[n] || null;
  m = {
    rumble: S.cue('rumble1'),
    roll, splash,
    detach: roll + 0.36,
    drift: S.cue('orange_drifts'),
    sneeze,
    puff1: sneeze, puff2: sneeze + 0.5,
    big: whoosh != null ? whoosh + 0.27 : sneeze + 1.4,     // whoosh 'pass' anchor = 0.27 s
    check, ping, settle: ping + 1.36,                           // glass_ping peak at 1.42 s
    fish, pops,
    cams,
    sunnyL: L('sunny', 0), doreenL: L('doreen', 0),
    barryWell: L('barry', 0), barry398: L('barry', 1), barryFish: L('barry', 2), barrySmoke: L('barry', 3),
    geraldL: L('gerald', 0),
  };
  // word / pause landmarks (lip-sync envelopes; word estimates as fallback)
  const W = (l, w, d) => { const v = l ? K.wordTime(S, l, w) : null; return v != null ? v : d; };
  m.thousand = W(m.doreenL, 'thousand', m.doreenL ? m.doreenL.le - 0.8 : 11.6);
  m.mountainW = W(m.sunnyL, 'mountain', m.drift + 0.8);
  m.providesW = W(m.sunnyL, 'provides', m.drift + 1.3);
  m.eight = W(m.barry398, 'eight', m.check + 2.2);
  m.reassuring = W(m.barry398, 'reassuring', m.check + 3.6);
  const gap = innerGap(m.barrySmoke);
  m.sGap0 = gap ? gap[0] : (m.barrySmoke ? m.barrySmoke.ls + 1.25 : 28);
  const unless = gap ? gap[1] : m.sGap0 + 0.15;
  m.smell = unless + 0.54;
  m.smoke = Math.min(unless + 0.88, m.barrySmoke ? m.barrySmoke.le - 0.25 : 29.2);
  // the orange's bounce chain down the slope (contact points; times relative to detach → splash)
  const d = m.detach, sp = m.splash, span = sp - d;
  m.chain = [
    { t: d, x: SP.grovePos.x, y: SP.grovePos.y, h: 0 },                 // hanging in the tree
    { t: d + span * 0.15, x: 797, y: 357, h: 0 },                       // drops to the ground under it
    { t: d + span * 0.38, x: 836, y: 381, h: 17 },
    { t: d + span * 0.58, x: 877, y: 406, h: 14 },
    { t: d + span * 0.75, x: 919, y: 431, h: 11 },
    { t: d + span * 0.89, x: 956, y: 455, h: 8 },                       // skips off the rim rocks
    { t: sp, x: 990, y: 484, h: 7 },                                    // PLOP (the splash sfx)
  ];
  // after the plop it drifts out from behind Doreen's chin and parks under Barry's nose
  // (it first slides down behind Doreen's back — hidden — and comes out past her chin, in front of
  // Barry's rock: no pass "through" anybody)
  m.driftPath = [{ x: 990, y: 484 }, { x: 987, y: 530 }, { x: 942, y: 562 }, { x: 882, y: 576 }, { x: 840, y: 584 }, { x: 822, y: 589 }, { x: 806, y: 606 }];
  m.driftT0 = sp + 0.25;
  m.driftT1 = m.drift + 1.75;
  MEMO.set(S.tl, m);
  return m;
}
// the longest quiet run (mouth envelope < .2 for ≥ 2 frames) strictly inside a line → [t0, t1]
function innerGap(l) {
  if (!l || !l.env || l.env.length < 8) return null;
  const e = l.env, fps = 24;
  let best = null, run0 = -1;
  for (let i = 3; i < e.length - 3; i++) {
    if (e[i] < 0.2) { if (run0 < 0) run0 = i; } else if (run0 >= 0) {
      if (i - run0 >= 2 && (!best || i - run0 > best[1] - best[0])) best = [run0, i];
      run0 = -1;
    }
  }
  return best ? [l.ls + best[0] / fps, l.ls + best[1] / fps] : null;
}
function shotOf(m, t) {
  let i = 0;
  for (let k = 0; k < m.cams.length; k++) if (m.cams[k].t <= t + 1e-6) i = k;
  const c = m.cams[i];
  let n = 0;
  for (let k = 0; k < i; k++) if (m.cams[k].name === c.name) n++;
  return { name: c.name, t0: c.t, t1: i + 1 < m.cams.length ? m.cams[i + 1].t : 1e9, index: i, nth: n };
}

// ─────────────────────────────────────────────────────────────── the orange
const orangeR = (y) => lerp(4.3, 12.5, smoothstep(330, 484, y)) * (y > 484 ? SP.depthScale(y) / SP.depthScale(484) : 1);
// → null (still in the grove, drawn by the env) | {x, y, r, rot, bounce, inWater, wob}
function orangeAt(m, t) {
  const C = m.chain;
  if (t < m.roll) return null;
  if (t < C[0].t) {
    // shakes loose: an accelerating pendulum on its stem
    const k = smoothstep(m.roll, C[0].t, t);
    const sw = Math.sin((t - m.roll) * 26) * (0.25 + 0.75 * k) * 1.1;
    return { x: C[0].x + sw * 0.9, y: C[0].y + Math.abs(sw) * 0.25, r: orangeR(C[0].y), rot: sw * 0.35, bounce: 0, inWater: false };
  }
  if (t < m.splash) {
    let i = 0;
    while (i < C.length - 2 && t >= C[i + 1].t) i++;
    const a = C[i], b = C[i + 1];
    const u = clamp((t - a.t) / Math.max(1e-3, b.t - a.t));
    let x, y;
    if (i === 0) { x = lerp(a.x, b.x, u); y = lerp(a.y, b.y, u * u); }            // free fall
    else { x = lerp(a.x, b.x, u); y = lerp(a.y, b.y, u) - b.h * 4 * u * (1 - u); }
    // squash on each contact, stretch in fast flight
    const since = t - a.t;
    const sq = i > 0 ? 0.55 * Math.exp(-since * 38) * (since < 0.09 ? 1 : 0) : 0;
    const st = -0.22 * Math.sin(Math.PI * u) * (i === 0 ? u : 1);
    const r = orangeR(y);
    const rot = (x - C[0].x) / 6.5;
    return { x, y, r, rot, bounce: clamp(sq + st, -0.35, 0.6), inWater: false };
  }
  // floating
  const k = ease.inOutSine(clamp((t - m.driftT0) / Math.max(0.1, m.driftT1 - m.driftT0)));
  const p = K.pathAt(m.driftPath, k);
  const dt = t - m.splash;
  // plop: dunks under, bobs back up, then a gentle idle bob
  const dunk = dt < 0.6 ? Math.sin(Math.min(1, dt / 0.6) * Math.PI) * Math.exp(-dt * 2) * 0.9 : 0;
  const bob = Math.sin(t * 2.6 + 0.7) * 0.9 + Math.sin(t * 1.3) * 0.5;
  const r = orangeR(p.y);
  return { x: p.x, y: p.y, r, rot: 0.25 + (p.x - 990) / 30 + Math.sin(t * 1.1) * 0.06, bounce: 0, inWater: true, sink: dunk, bob, moving: k > 0 && k < 1 };
}
function drawLooseOrange(ctx, T, o, light) {
  if (!o) return;
  const r = pos(o.r, 4, 0.5);
  if (o.inWater) {
    const wy = o.y;
    const cy = wy - r * 0.62 + r * 0.9 * fin(o.sink) + fin(o.bob) * 0.6;
    P.drawOrange(ctx, { x: o.x, y: cy, r, rot: o.rot, t: T, seed: 4, waterY: wy, grade: 'day', light });
  } else {
    P.drawOrange(ctx, { x: o.x, y: o.y - r, r, rot: o.rot, bounce: fin(o.bounce), t: T, seed: 4, grade: 'day', light, leaf: r > 5 });
  }
}

// the leaf that snaps off with it and flutters down (zig-zag, tumbling)
function drawLeaf(ctx, m, u) {
  const x = SP.grovePos.x + 2 + Math.sin(u * 7.5) * 4 + u * 6;
  const y = SP.grovePos.y - 2 + 16 * u + 6 * u * u;
  const a = Math.sin(u * 7.5 + 0.6) * 0.9;
  ctx.save();
  ctx.globalAlpha = 1 - smoothstep(1.1, 1.6, u);
  ctx.translate(x, y); ctx.rotate(a); ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(u * 7.5)));
  ctx.fillStyle = '#4E9A4A'; ctx.strokeStyle = '#2F6B45'; ctx.lineWidth = 0.35;
  ctx.beginPath(); ctx.moveTo(-2.4, 0); ctx.quadraticCurveTo(0, -1.6, 2.4, 0); ctx.quadraticCurveTo(0, 1.6, -2.4, 0); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────── the sneeze
// little puff (ah), little puff (ah), held beat: the volcano INHALES both little puffs back into the
// crater, then CHOO — one big dark puff that hangs over the crater through Doreen's "asleep".
function sneezePuffs(m, t) {
  const out = [];
  const inhale0 = m.big - 0.55, inhale1 = m.big - 0.06;
  const suck = smoothstep(inhale0, inhale1, t);
  const little = (t0, size, seed) => {
    const fwd = clamp((t - t0) / 1.25);
    if (t < t0) return;
    let k = Math.min(fwd, 0.42);
    if (t > inhale0) k = lerp(Math.min(clamp((inhale0 - t0) / 1.25), 0.42), 0.0, ease.inCubic(suck));
    if (k > 0.004 && t < inhale1) out.push({ k, size, seed, rise: 22, hang: 0.55, drift: 10 });
  };
  little(m.puff1, 0.48, 1);
  little(m.puff2, 0.56, 2);
  if (t >= m.big) {
    // time-warped life: the pop + rise (the first 14 % of its life) BURSTS out in 0.28 s, then it
    // hangs over the crater for ~6 s (through Doreen's "asleep for a thousand years")
    const dt = t - m.big, B = 0.28, L = 6.2;
    const k = dt < B ? 0.14 * ease.outQuad(dt / B) : 0.14 + 0.86 * (dt - B) / (L - B);
    if (k < 1) out.push({ k, size: 1.55, dark: 0.32, seed: 3, rise: 22, hang: 0.86, drift: 46 });
  }
  return out;
}
// the CHOO's spray: a few small soot puffs blown outward from the crater (ballistic, fading)
const SPRAY = [[-1, -0.55, 0.9], [-0.55, -1, 1.1], [0.15, -1.15, 0.8], [0.7, -0.85, 1.0], [1.05, -0.35, 0.85], [-1.15, -0.15, 0.7]];
function drawSneezeSpray(ctx, m, t) {
  const u = t - m.big;
  if (u < 0 || u > 1.3) return;
  SPRAY.forEach(([dx, dy, s], i) => {
    const v = u - i * 0.012;
    if (v <= 0) return;
    const fly = 1 - Math.exp(-v * 4.2);
    const x = 860 + dx * 120 * fly * s, y = 138 + dy * 70 * fly * s + 26 * v * v;
    P.drawSmokePuff(ctx, { x, y, r: 9 + 6 * s, life: clamp(v / 1.3), t: t + i, seed: 40 + i, tone: 'grey', rise: 0.4, grade: 'day' });
  });
}

// ─────────────────────────────────────────────────────────────── the fish
const FISH = {
  E: { x: 224, y: 549 },     // pops out of the pool between the big rim rock and Sunny's rump
  R: { x: 181, y: 504 },     // top of the big mossy rim rock
  W: { x: 112, y: 588 },     // plops into the river outlet
  X: { x: -150, y: 596 },    // and away
};
const FISH_LOOK = [
  { color: 'orange', scale: 0.78, seed: 1 },
  { color: 'teal', scale: 0.74, seed: 2 },
  { color: 'orange', scale: 0.66, seed: 3, lookBack: true },
];
// → {mode: 'hop'|'swim'|'gone', x, y (ground / body centre), hop, flip, splashT, plopT, ...}
function fishAt(m, i, t) {
  const p0 = m.pops[i], F = FISH_LOOK[i];
  const u = t - p0;
  if (u < -0.05) return null;
  const lb = F.lookBack ? 0.42 : 0;
  const t1 = 0.34, t2 = t1 + 0.12 + lb, t3 = t2 + 0.3, t4 = t3 + 1.6;
  const s = F.scale;
  let x, y, hop = 0, flip = true, mode = 'hop', look = null, nod = 0, sub = 0, sx = 1;
  if (u < t1) {
    const k = clamp(u / t1);
    x = lerp(FISH.E.x, FISH.R.x, ease.inOutSine(k));
    y = lerp(FISH.E.y + 14, FISH.R.y, k) - 58 * 4 * k * (1 - k);
    hop = 0.5 * k + 0.12;
    sub = clamp((FISH.E.y + 2 - (y - 10 * s)) / (26 * s));          // still under the surface
  } else if (u < t2) {
    x = FISH.R.x; y = FISH.R.y; hop = 0;
    if (F.lookBack) {
      // turns round, stares back at the pool (at Barry)… and turns away. No wave. No nod.
      const v = (u - t1) / (t2 - t1);
      flip = !(v > 0.2 && v < 0.8);
      look = flip ? null : { x: 0.9, y: 0.15 };
      const tw = Math.max(K.bump(v, 0.14, 0.12), K.bump(v, 0.74, 0.12));   // x-squash masks each flip
      sx = 1 - 0.75 * tw;
    }
  } else if (u < t3) {
    const k = clamp((u - t2) / (t3 - t2));
    x = lerp(FISH.R.x, FISH.W.x, k);
    y = lerp(FISH.R.y, FISH.W.y, k * k) - 26 * 4 * k * (1 - k);
    hop = 0.5 * k;
  } else if (u < t4) {
    const k = clamp((u - t3) / (t4 - t3));
    mode = 'swim';
    x = lerp(FISH.W.x, FISH.X.x, ease.inQuad(k) * 0.55 + k * 0.45);
    y = lerp(FISH.W.y, FISH.X.y, k);
  } else return { mode: 'gone' };
  return { mode, x, y, hop, flip, look, nod, sub, sx, scale: s, color: F.color, seed: F.seed, u, plop: t3, t1, t2 };
}
function drawFishEntry(ctx, T, f, i) {
  if (!f || f.mode === 'gone') return;
  const s = f.scale;
  if (f.mode === 'hop') {
    // the rig adds sin(π·hop)·22 of lift; cancel it — the arc is ours
    const air = Math.sin(Math.PI * (f.hop - Math.floor(f.hop)));
    const y = f.y + air * 22 * s;
    ctx.save();
    if (f.sub > 0) {           // emerging: clip what is still below the surface
      ctx.beginPath(); ctx.rect(f.x - 80, -2000, 160, 2000 + FISH.E.y + 1); ctx.clip();
    }
    if (f.sx !== 1) { ctx.translate(f.x, y); ctx.scale(clamp(fin(f.sx, 1), 0.15, 1), 1); ctx.translate(-f.x, -y); }
    CR.drawFish(ctx, { x: f.x, y, scale: s, flip: f.flip, t: T + i * 1.3, hop: f.hop, suitcase: true, mood: 'solemn', color: f.color, seed: f.seed, look: f.look || undefined, nod: f.nod });
    ctx.restore();
  } else {
    // swimming down the river: only the back + dorsal fin above water, suitcase balanced on the head
    const wy = f.y;
    ctx.save();
    ctx.beginPath(); ctx.rect(f.x - 120, wy - 200, 240, 200); ctx.clip();
    CR.drawFish(ctx, { x: f.x, y: wy + 5 * s, scale: s, flip: true, t: T + i * 1.3, swim: true, mood: 'solemn', color: f.color, seed: f.seed });
    ctx.restore();
    P.drawSuitcase(ctx, { x: f.x - 3 * s, y: wy - 21 * s + Math.sin(T * 7 + i) * 0.8, scale: 0.42 * s, rot: Math.sin(T * 5 + i) * 0.08 });
    ES.waterlineRipple(ctx, f.x, wy, 30 * s, T + i, { amp: 0.6, part: 'both', speed: 1.4 });
  }
}

// ─────────────────────────────────────────────────────────────── gaze & mood helpers
function gazeVec(S, L, who, target, moodName) {
  const c = L.chars[who];
  if (!c) return { x: 0.3, y: 0 };
  if (target && typeof target === 'object' && 'vx' in target) return { x: target.vx, y: target.vy };
  const me = { who, eye: c.eye, flip: c.flip };
  const g = K.gazeAt(S, who, L, me, moodName, target === 'auto' || !target ? {} : { lookAt: target });
  return { x: fin(g.x, 0.3), y: fin(g.y, 0) };
}
// keys: [[t, target, blendDur=.15], ...] (scene-local, sorted). target: 'auto' (kit default) | name |
// {x, y} world point | {vx, vy} literal look vector | fn(t) → any of those
function keyedLook(S, L, who, keys, moodName) {
  const t = S.t;
  let i = -1;
  for (let k = 0; k < keys.length; k++) if (keys[k][0] <= t) i = k;
  const res = (tg) => gazeVec(S, L, who, typeof tg === 'function' ? tg(t) : tg, moodName);
  if (i < 0) return res('auto');
  const cur = res(keys[i][1]);
  const d = keys[i][2] ?? 0.15;
  const k = smoothstep(keys[i][0], keys[i][0] + d, t);
  if (k >= 1) return cur;
  const pv = res(i > 0 ? keys[i - 1][1] : 'auto');
  return { x: lerp(pv.x, cur.x, k), y: lerp(pv.y, cur.y, k) };
}
function blendMood(w, name, k) {
  k = clamp(k);
  if (k <= 0) return w;
  const out = {};
  for (const n in w) out[n] = (out[n] || 0) + w[n] * (1 - k);
  out[name] = (out[name] || 0) + k;
  return out;
}

// ─────────────────────────────────────────────────────────────── head-orange wobble
// The rig's head orange is hidden while it wobbles and redrawn here, rocking about its contact point.
function drawHeadOrange(ctx, st, who, wob, hop) {
  const c = st.cast[who];
  if (!c) return;
  const o = c.opts;
  const a = K.castAnchors({ ...o, accessories: { ...(o.accessories || {}), orange: true } }).orange;
  if (!a) return;
  const r = pos(a.r, 15, 1);
  const ang = fin(a.angle, 0);
  const bx = a.x - Math.sin(ang) * -r, by = a.y + Math.cos(ang) * r;    // contact point under it
  ctx.save();
  ctx.translate(bx, by - fin(hop));
  ctx.rotate(fin(wob));
  ctx.translate(-bx, -by);
  CAP.drawCapyOrange(ctx, { x: a.x, y: a.y, r, rot: ang, t: o.t, seed: o.seed || 0, flip: !!o.flip, tint: o.tint, rim: o.rim });
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────── sniff lines (screen-ish, world space)
function drawSniff(ctx, x, y, k, flip, scale) {
  if (k <= 0.02) return;
  const f = flip ? -1 : 1;
  ctx.save();
  ctx.globalAlpha = clamp(k);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.6 * scale;
  for (let j = 0; j < 3; j++) {
    const yy = y - 6 * scale + j * 6 * scale;
    const x0 = x + f * (16 + j * 3) * scale, x1 = x + f * 5 * scale;
    ctx.beginPath();
    ctx.moveTo(lerp(x1, x0, 1 - 0.35 * (1 - k)), yy + (j - 1) * 2 * scale);
    ctx.quadraticCurveTo(lerp(x0, x1, 0.5), yy - 3 * scale, x1 + f * 2 * scale * (1 - k), yy);
    ctx.stroke();
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────── the button: a whiff of smoke
// On "…smell smoke!" a thin grey wisp (not the spring's white steam) drifts in over the far bank
// behind Barry's head — he's right, again. Kept faint: the audience notices it a beat after he does.
function drawSmokeWhiff(ctx, m, t) {
  const u = t - (m.smell - 0.4);
  if (u < 0) return;
  // a ribbon of small puffs streaming in from the right edge along a lazy S, above the far rim
  for (let i = 0; i < 9; i++) {
    const v = u - i * 0.09;
    if (v <= 0) continue;
    const x = 960 - 95 * v + Math.sin(v * 2.4 + i * 0.6) * 4;
    const y = 446 - 9 * v + Math.sin(v * 3.1 + i * 0.9) * 3.5;
    const a = 0.55 * smoothstep(0, 0.35, v) * (1 - smoothstep(1.6, 2.4, v)) * (1 - i * 0.06);
    if (a <= 0.01) continue;
    P.drawSmokePuff(ctx, { x, y, r: 5.5 + 2 * (i % 3) + 3.5 * v, t: t + i, seed: 60 + i, tone: 'grey', alpha: a, grade: 'day' });
  }
}

// ─────────────────────────────────────────────────────────────── startled birds (the CHOO)
function drawBirds(ctx, m, t) {
  const u = t - m.big - 0.05;
  if (u < 0 || u > 2.2) return;
  const flock = [[760, 352, -1], [790, 348, 1], [742, 360, -1], [818, 356, 1], [700, 372, -1]];
  ctx.save();
  ctx.strokeStyle = '#2E3440';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  flock.forEach(([x0, y0, d], i) => {
    const v = u - i * 0.05;
    if (v < 0) return;
    const x = x0 + d * (40 * v + 22 * v * v) + Math.sin(v * 9 + i) * 2;
    const y = y0 - 70 * v + 8 * v * v * (i % 2 ? 1 : 0.5);
    const w = 8 + (i % 2) * 1.6;
    const fl = Math.sin((v + i * 0.13) * 34);
    ctx.globalAlpha = 1 - smoothstep(1.6, 2.2, v);
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(x - w, y - fl * 3.2);
    ctx.quadraticCurveTo(x - w * 0.45, y - 2 - fl * 1.5, x, y);
    ctx.quadraticCurveTo(x + w * 0.45, y - 2 - fl * 1.5, x + w, y - fl * 3.2);
    ctx.stroke();
  });
  ctx.restore();
}
// a thin shock ring of air + soot around the crater on the CHOO
function drawSneezeRing(ctx, m, t) {
  const u = t - m.big;
  if (u < 0 || u > 0.55) return;
  const k = u / 0.55;
  const R = 30 + 150 * ease.outCubic(k);
  ctx.save();
  ctx.globalAlpha = (1 - k) * 0.55;
  ctx.strokeStyle = '#F4F1F6';
  ctx.lineWidth = Math.max(0.5, 5 * (1 - k));
  // only the flanks of the ring (never across the cloud itself)
  for (const [a0, a1] of [[Math.PI * 0.82, Math.PI * 1.22], [-Math.PI * 0.22, Math.PI * 0.18]]) {
    ctx.beginPath(); ctx.ellipse(860, 150, R, R * 0.32, 0, a0, a1); ctx.stroke();
  }
  ctx.globalAlpha = (1 - k) * 0.35;
  ctx.lineWidth = Math.max(0.5, 3 * (1 - k));
  for (const [a0, a1] of [[Math.PI * 0.85, Math.PI * 1.18], [-Math.PI * 0.18, Math.PI * 0.15]]) {
    ctx.beginPath(); ctx.ellipse(860, 150, R * 0.72, R * 0.24, 0, a0, a1); ctx.stroke();
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────── cameras
function framingsFor(m, S) {
  const t = S.t;
  const sh = shotOf(m, t);
  return {
    // trio: the standard group frame (kit), except the shot right after the sneeze, which opens
    // wider and taller so the big puff still hangs over the crater behind Doreen's "asleep"
    trio: (I) => {
      const base = K.trioFrame(I);
      if (sh.t0 > m.sneeze && sh.t0 < m.check) {
        return { x: 652, y: 370, zoom: 1.06, push: 0.004, drift: 0.6, foliage: 0.9 };
      }
      if (sh.t0 >= m.drift - 0.01 && sh.t0 < m.sneeze) {
        // a gentle push toward Barry as the orange arrives under his nose
        return { ...base, push: 0, move: { at: m.drift + 0.3, dur: 2.0, to: { x: base.x + 34, y: base.y + 8, zoom: base.zoom * 1.07 }, ease: 'inOutSine' } };
      }
      return base;
    },
    volcano: (I) => {
      if (sh.t0 < m.sneeze - 0.01) {
        // tilt from the grove down the slope with the orange, settle on the splash + Barry/Doreen
        const A = { x: 796, y: 322, zoom: 3.9 }, B = { x: 905, y: 440, zoom: 1.86 };
        const k = ease.inOutSine(clamp((t - (m.detach + 0.05)) / (m.splash + 0.08 - m.detach - 0.05)));
        const c = U.camLerp(A, B, k);
        return { ...c, push: 0, drift: 0.4 };
      }
      // the sneeze: crater with sky; slow push on "ah… ah…", recoil on the CHOO
      const A = { x: 866, y: 196, zoom: 1.68 };
      const push = ease.inOutSine(clamp((t - (m.puff1 + 0.1)) / (m.big - m.puff1 - 0.1)));
      const rec = ease.outBack(clamp((t - m.big) / 0.32), 1.4);
      const z = A.zoom * (1 + 0.13 * push) * (1 - 0.15 * rec);
      return { x: A.x - 4 * push, y: A.y - 10 * push - 8 * rec, zoom: z, push: 0, drift: 0.5 };
    },
    barry_cu: (I) => {
      const L = I.L, b = L && L.chars.barry;
      if (!b) return { x: 700, y: 520, zoom: 2.5 };
      const base = K.faceFrame(L, 'barry', { zoom: 2.55, eyeY: 400, k: 0.75, dx: 64 }) || { x: 750, y: 520, zoom: 2.55 };
      if (sh.t0 < m.fish) {
        // the thermometer check: ease in a touch toward the glass while the line creeps
        return { ...base, push: 0.004, move: { at: m.ping + 0.05, dur: 1.3, to: { x: base.x + 10, y: base.y - 6, zoom: base.zoom * 1.08 }, ease: 'inOutSine' } };
      }
      // "…unless they smell smoke!": a slow creep in that tightens on the last words
      return { ...base, push: 0.012 };
    },
    fish: (I) => {
      const k = clamp((t - sh.t0) / Math.max(0.1, sh.t1 - sh.t0));
      return { x: lerp(178, 150, ease.inOutSine(k)), y: 536, zoom: 3.0, push: 0.004, drift: 0.3, foliage: 1 };
    },
  };
}

// ─────────────────────────────────────────────────────────────── render
module.exports = {
  render(ctx, t, S) {
    const m = plan(S);
    const T = S.T;
    const sh = shotOf(m, t);

    // ── env ────────────────────────────────────────────────────────────
    const orange = orangeAt(m, t);
    const groveTaken = t >= m.roll ? 1 : 0;
    const inhale = smoothstep(m.big - 0.6, m.big - 0.1, t) * (t < m.big ? 1 : 0);
    const smoke = (t < m.big ? 0.35 : lerp(0.35, 0.5, smoothstep(m.big + 1.5, m.big + 4, t))) * (1 - 0.8 * inhale);
    const env = {
      volcanoSmoke: smoke,
      puffs: sneezePuffs(m, t),
      groveTaken,
      // the grove shivers harder until the orange lets go, then the branches settle
      groveShake: Math.max(0, t >= m.roll ? (0.55 + 0.45 * smoothstep(m.roll, m.detach, t)) * (1 - smoothstep(m.detach, m.detach + 0.45, t)) : 0,
        K.bump(t, m.big - 0.02, 0.9) * 0.9),
      barryRock: false,
    };
    const rumble = K.rumbleLevel(S);
    env.rumble = Math.max(rumble, K.bump(t, m.big - 0.03, 0.7) * 0.6);

    // ── layout for gaze maths ────────────────────────────────────────
    const gcfg = { on: 'barry' };
    const L = K.buildLayout(S, { gerald: gcfg });
    const orangePt = orange ? { x: orange.x, y: orange.y - (orange.r || 8) } : SP.grovePos;
    const volc = { x: 860, y: 140 };
    const cloud = { x: 890, y: 95 };

    // ── Barry ─────────────────────────────────────────────────────────
    const sl = m.barrySmoke;
    const bRest = [[0, 'worried'], [m.rumble + 0.18, 'shock'], [m.rumble + 0.8, 'worried'],
      [m.drift + 0.25, 'deadpan'], [m.drift + 1.6, 'worried'], [m.big, 'shock'], [m.big + 1.9, 'worried'],
      [m.thousand, 'shock'], [m.check, 'worried'], [m.fish, 'worried'], [m.geraldL.ls + 0.2, 'deadpan']];
    const bM = K.moodAt(S, 'barry', bRest);
    let bMood = bM.weights;
    // the thermometer: yank (the ping), the red line creeps with the whine, settles on 39.8 at its
    // peak → his eyes pop. Drawn in his paw through the rig's hold() so it can rise OUT of the water.
    const yank0 = m.ping - 0.16;
    const yankK = t < yank0 ? 0 : ease.outBack(clamp((t - yank0) / 0.19), 1.9);
    const thermoOn = t >= yank0 && t < m.fish;
    const creep = ease.inOutSine(clamp((t - (m.ping + 0.12)) / (m.settle - m.ping - 0.12)));
    const over = t > m.settle ? 0.04 * Math.sin(clamp((t - m.settle) / 0.3) * Math.PI) * Math.exp(-(t - m.settle) * 3) : 0;
    const level = P.thermoLevel(39.4 + 0.4 * creep + over);
    if (t >= m.ping && t < m.barry398.ls) bMood = blendMood(bMood, 'shock', 0.3 + 0.7 * smoothstep(m.settle - 0.05, m.settle + 0.06, t));
    // "Thirty-nine point eight!" thrusts it toward Doreen; a shake on "reassuring me!"
    const thrust = t >= m.eight - 0.12 ? ease.outBack(clamp((t - (m.eight - 0.12)) / 0.22), 2.2) * (1 - smoothstep(m.barry398.le - 0.1, m.barry398.le + 0.3, t)) : 0;
    const shakeTh = Math.sin(t * 38) * 2.6 * K.bump(t, m.reassuring - 0.1, 0.75);
    const pawAt = { x: lerp(78, 100, yankK) + 16 * thrust + shakeTh, y: lerp(46, -22, yankK) - 3 * thrust + Math.abs(shakeTh) * 0.4 };
    // "…unless they smell smoke!": nose up through "unless they smell" (sniff, sniff), eyes pop on "smoke"
    const sniffT = [m.sGap0 + 0.02, m.smell - 0.02, m.smell + 0.14];
    let sniff = 0;
    for (const s0 of sniffT) sniff = Math.max(sniff, K.bump(t, s0, 0.17));
    const noseUp = sl ? K.fadeWindow(t, m.sGap0 - 0.05, m.smoke + 0.05, 0.18, 0.12) : 0;
    const smokeEyes = sl ? smoothstep(m.smoke - 0.03, m.smoke + 0.06, t) : 0;
    if (sl && t > m.sGap0 - 0.1) bMood = blendMood(blendMood(bMood, 'deadpan', 0.55 * noseUp), 'shock', smokeEyes);
    // takes
    let bSquash = K.take(t, m.rumble + 0.2, { amount: 0.9 });
    if (t > m.splash - 0.2 && t < m.drift) bSquash = K.take(t, m.splash + 0.08, { amount: 0.45, anticipation: 0.04 });
    if (t > m.big && t < m.check) bSquash = K.take(t, m.thousand, { amount: 0.6, anticipation: 0.08 });
    if (t > m.ping - 0.3 && t < m.fish) bSquash = K.take(t, m.settle, { amount: 0.55, anticipation: 0.06 });
    if (sl && t > sl.ls) bSquash = K.take(t, m.smoke, { amount: 0.75 });
    const thermPt = () => {
      const a = K.castAnchors({ ...K.castOpts(S, 'barry', { layout: L }), pawUp: 1, pawAt }).paw;
      return a ? { x: a.x + 6, y: a.y - 30 } : 'fwd';
    };
    const bLookKeys = [
      [0, 'auto'],
      [m.rumble + 0.1, { vx: -0.6, vy: -0.25 }, 0.08], [m.rumble + 0.42, { vx: 0.9, vy: -0.3 }, 0.08], [m.rumble + 0.8, 'up', 0.12],
      [m.roll + 0.15, volc, 0.15],
      [m.detach + 0.2, (tt) => { const o = orangeAt(m, tt); return o ? { x: o.x, y: o.y } : volc; }, 0.15],
      [m.drift + 0.15, () => orangePt, 0.2],
      // "See?" → a glance at Sunny; "…the mountain…" → up at the volcano; "…provides." → back to the orange
      [m.sunnyL.ls + 0.2, 'sunny', 0.12], [m.mountainW + 0.08, volc, 0.2], [m.providesW + 0.25, () => orangePt, 0.2],
      [m.sneeze, volc, 0.2],
      [m.big + 0.3, cloud, 0.3],                                            // still staring at the cloud…
      [m.doreenL.ls + 0.7, 'doreen', 0.35],                                 // …slowly back to "Bless you!"-Doreen
      [m.check - 0.05, 'doreen', 0.1],
      [m.ping - 0.05, () => thermPt(), 0.1],
      [m.barry398.ls + 0.05, 'doreen', 0.1],
      [m.barry398.ls + 1.45, () => thermPt(), 0.1],
      [m.barry398.ls + 1.95, 'doreen', 0.12],
      [m.fish, 'auto'],
      [m.barryFish.ls - 0.05, { vx: -0.85, vy: 0.05 }, 0.12], [m.barryFish.ls + 0.75, 'auto', 0.15],
      [m.geraldL.ls + 0.15, 'up', 0.25],
      [m.barrySmoke.ls - 0.15, { vx: 0.85, vy: 0.05 }, 0.12],
      [m.sGap0, { vx: 0.55, vy: -0.6 }, 0.15],                            // nose up, sniffing the air
      [m.smoke - 0.02, { vx: 0.1, vy: 0.05 }, 0.06],                      // …smoke! (dead ahead, eyes wide)
    ];
    const bLook = keyedLook(S, L, 'barry', bLookKeys, bM.name);
    const barry = {
      rest: bRest, mood: bMood, look: bLook, squash: bSquash,
      accessories: t > m.ping ? { sweat: 0.7 } : undefined,
      tiltAdd: 8 * noseUp + 3 * sniff + 3 * K.bump(t, m.rumble + 0.1, 0.5) - 3 * yankK * (1 - thrust) * (t < m.fish ? 1 : 0),
    };
    if (thermoOn) {
      barry.pawUp = clamp(yankK * 1.05);
      barry.pawAt = pawAt;
      const ang = 0.16 + 0.1 * thrust;
      barry.hold = (c, paw) => {
        const k0 = 0.9 * clamp(fin(paw.scale, 0.94), 0.2, 4);
        P.drawThermometer(c, {
          x: paw.x + 5 * k0, y: paw.y - 1 * k0, rot: 0.14 + ang, scale: k0 * 0.62, length: 100,
          level, reading: 'auto', showTag: yankK > 0.75, tagSize: 25, tagSide: 'right', t: T, waterY: 601, grade: 'day',
        });
      };
    }

    // ── Sunny ─────────────────────────────────────────────────────────
    const sRest = [[0, 'chill'], [m.rumble + 0.2, 'happy'], [m.roll + 0.5, 'chill'], [m.fish - 0.5, 'sleepy'], [m.fish + 2.4, 'chill']];
    const sM = K.moodAt(S, 'sunny', sRest);
    const sLook = keyedLook(S, L, 'sunny', [
      [0, 'auto'],
      [m.drift + 0.1, () => orangePt, 0.25],
      [m.sunnyL.ls + 0.9, 'barry', 0.2],
      [m.sunnyL.le + 0.4, 'auto', 0.2],
    ], sM.name);
    const sunnyEyes = t > m.fish - 0.4 && t < m.fish + 2.6 ? lerp(1, 0.08, smoothstep(m.fish - 0.4, m.fish, t)) : undefined;
    // a slow, solemn nod of agreement with Gerald ("Dreadfully rude, the fish.")
    const sunny = { rest: sRest, look: sLook, tiltAdd: -6 * K.bump(t, m.geraldL.ls + 1.1, 0.9) };
    if (sunnyEyes != null) sunny.eyes = sunnyEyes;

    // ── Doreen ────────────────────────────────────────────────────────
    const dRest = [[0, 'chill'], [m.splash, 'happy'], [m.sneeze + 0.4, 'chill'], [m.barryFish.ls + 1.2, 'sad'], [m.geraldL.ls + 0.4, 'chill']];
    const dM = K.moodAt(S, 'doreen', dRest);
    const dLook = keyedLook(S, L, 'doreen', [
      [0, 'auto'],
      [m.drift + 0.15, () => orangePt, 0.25],
      [m.sunnyL.ls + 0.3, 'sunny', 0.2],
      [m.doreenL.ls - 0.05, cloud, 0.18],
      [m.doreenL.ls + 0.62, 'barry', 0.2],
      [m.doreenL.le + 0.1, 'auto'],
    ], dM.name);
    const doreen = { rest: dRest, look: dLook };

    // ── Gerald (on Barry's head) ──────────────────────────────────────
    const grip = clamp(smoothstep(m.rumble + 0.05, m.rumble + 0.25, t) * (1 - smoothstep(m.roll + 0.6, m.roll + 1.4, t)))
      + K.bump(t, m.big - 0.05, 0.8) * 0.8;
    const gLookKeys = [
      [0, { vx: 0.45, vy: 0.9 }],
      [m.rumble + 0.3, { vx: -0.4, vy: 0.4 }, 0.12], [m.rumble + 0.85, { vx: 0.7, vy: -0.2 }, 0.15],
      [m.detach, (tt) => { const o = orangeAt(m, tt); return o ? { vx: 0.85, vy: o.y > 470 ? 0.5 : -0.25 } : { vx: 0.8, vy: -0.2 }; }, 0.2],
      [m.drift + 0.2, { vx: 0.6, vy: 0.95 }, 0.25],
      [m.sunnyL.ls + 0.3, { vx: -0.8, vy: 0.3 }, 0.2],
      [m.sneeze + 1.8, { vx: 0.85, vy: -0.75 }, 0.3],                       // he looks at the cloud. Knowingly.
      [m.doreenL.ls + 1.6, { vx: 0.9, vy: 0.35 }, 0.25],
      [m.doreenL.ls + 3.3, { vx: 0.35, vy: -0.75 }, 0.4],
      [m.check - 0.1, { vx: 0.9, vy: 0.4 }, 0.15],
      [m.ping, { vx: 0.85, vy: 0.95 }, 0.15],                              // peers down at the glass
      [m.barry398.ls + 0.6, { vx: 0.9, vy: 0.35 }, 0.2],
      [m.fish, { vx: 0.45, vy: 0.9 }],
      [m.barryFish.ls + 0.1, { vx: 0.45, vy: 0.9 }],
      [m.geraldL.ls - 0.1, { vx: -0.85, vy: 0.2 }, 0.2],                   // back toward where the fish went
      [m.geraldL.ls + 1.0, { vx: 0.05, vy: 0.0 }, 0.25],                   // …then to us: "the fish."
      [m.barrySmoke.ls + 0.2, { vx: 0.45, vy: 0.9 }, 0.2],
      [m.smoke - 0.15, { vx: 0.0, vy: 0.05 }, 0.35],                       // a slow look to camera on "smoke"
    ];
    const gLookRaw = keyedLook(S, { ...L, chars: { gerald: { eye: { x: 0, y: 0 }, flip: false } } }, 'gerald', gLookKeys.map(([a, b, c]) => [a, typeof b === 'function' ? b : b, c]), 'smug');
    const gerald = {
      ...gcfg, look: gLookRaw, grip: clamp(grip), ruffle: clamp(grip * 0.6 + K.bump(t, m.big, 0.6) * 0.6),
      nod: 0.35 * K.bump(t, m.geraldL.ls + 1.25, 0.5),
    };
    if (sl && t > m.smoke - 0.2) gerald.mood = 'smug';

    // ── items: Barry's rock, the orange, splashes, fish, wobbling head oranges ─
    const items = [];
    items.push({ y: SP.barryRock.y + 6, x: SP.barryRock.x, draw: (c, st) => ES.drawBarryRock(c, T, st.env) });
    if (orange) {
      items.push({ y: orange.inWater ? orange.y + 0.5 : 300, x: orange.x, draw: (c, st) => drawLooseOrange(c, T, orange, st.cast.barry && st.cast.barry.opts.tint ? { tint: st.cast.barry.opts.tint, rim: st.cast.barry.opts.rim } : undefined) });
    }
    const lf = t - m.detach;
    if (lf > 0 && lf < 1.6) items.push({ y: 301, x: SP.grovePos.x, draw: (c) => drawLeaf(c, m, lf) });
    const spl = t - m.splash;
    if (spl > -0.01 && spl < 1.5) items.push({ y: 484.2, x: 990, draw: (c) => P.drawWaterSplash(c, { x: 990, y: 484, r: 15, t: spl, seed: 7, grade: 'day' }) });
    // the paw breaks the surface on the yank
    const ys = t - (yank0 + 0.02);
    if (ys > 0 && ys < 1.3) items.push({ y: 601, x: 748, draw: (c) => P.drawWaterSplash(c, { x: 748, y: 600, r: 13, t: ys, seed: 11, grade: 'day' }) });
    // fish
    if (t > m.fish - 0.1 && t < m.fish + 4) {
      for (let i = 0; i < 3; i++) {
        const f = fishAt(m, i, t);
        if (!f || f.mode === 'gone') continue;
        const dep = f.mode === 'swim' ? f.y + 1 : f.u < f.t1 ? FISH.E.y + 0.5 : f.x < FISH.R.x + 5 && f.mode === 'hop' && f.u > f.t2 ? 560 : 505;
        items.push({ y: dep, x: f.x, draw: (c) => drawFishEntry(c, T, f, i) });
        const ps = t - m.pops[i];
        if (ps > -0.01 && ps < 1.2) items.push({ y: FISH.E.y + 0.6, x: FISH.E.x, draw: (c) => P.drawWaterSplash(c, { x: FISH.E.x, y: FISH.E.y, r: 11, t: ps, seed: 20 + i, grade: 'day' }) });
        const pl = t - (m.pops[i] + f.plop);
        if (pl > -0.01 && pl < 1.2) items.push({ y: FISH.W.y + 0.6, x: FISH.W.x, draw: (c) => P.drawWaterSplash(c, { x: FISH.W.x, y: FISH.W.y, r: 10, t: pl, seed: 30 + i, grade: 'day' }) });
      }
    }
    // head oranges wobble while the ground shakes (and on the CHOO)
    const wobAmt = clamp(rumble * 1.4 + K.bump(t, m.big, 0.8) * 0.8);
    const wobbling = wobAmt > 0.03;
    if (wobbling) {
      for (const who of ['sunny', 'doreen']) {
        const ph = who === 'sunny' ? 0 : 1.7;
        const w = wobAmt * (0.16 * Math.sin(T * 17 + ph) + 0.08 * noise1(T * 9 + ph * 3));
        const hop = wobAmt * 2.2 * Math.max(0, Math.sin(T * 23 + ph * 2));
        const sy = who === 'sunny' ? 590.01 : 588.01;
        items.push({ y: sy, x: who === 'sunny' ? 360 : 945, draw: (c, st) => drawHeadOrange(c, st, who, w, hop) });
      }
      sunny.accessories = { ...(sunny.accessories || {}), orange: false };
      doreen.accessories = { ...(doreen.accessories || {}), orange: false };
    }

    // ── stage ────────────────────────────────────────────────────────
    K.drawSpringStage(ctx, t, S, {
      env,
      gerald,
      cast: { barry, sunny, doreen },
      items,
      framings: framingsFor(m, S),
      foliage: sh.name === 'fish' ? { sides: 'right', amount: 1 } : undefined,
      cam: { shakeGain: 1, shake: () => 9 * Math.exp(-Math.max(0, t - m.big) * 5) * (t >= m.big && sh.name === 'volcano' ? 1 : 0) },
      hooks: {
        afterCast: (c, st) => {
          if (sh.name === 'volcano' && t >= m.sneeze - 0.1) { drawSneezeRing(c, m, t); drawSneezeSpray(c, m, t); drawBirds(c, m, t); }
          if (sh.name === 'barry_cu' && t > m.fish) drawSmokeWhiff(c, m, t);
          // sniff lines into Barry's nostril
          if (sniff > 0.02 && st.cast.barry) {
            const a = K.castAnchors(st.cast.barry.opts);
            if (a.snout) drawSniff(c, a.snout.x - 2, a.snout.y + 1, sniff, false, st.cast.barry.opts.scale || 1);
          }
        },
      },
    });
  },
};
