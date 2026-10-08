// s06_montage — "HE WAS EARLY": Barry gets ready (2:26–2:46, spring_day, wipe in, montage music).
//
// SHOTS (cams)                              BEATS / SYNC
//  signs   0.00–3.90  the EXIT row, Barry     hammer_signs: BANG bang BANG on a bare stake → the board
//          on the bank in front of it, Sunny   boings up on the 3rd (accent) knock: EXIT 0.94, NO, REALLY.
//          dozing lower right; the camera      THIS WAY. 2.34; Barry scampers between stakes.
//          tracks left and pushes in on        sunny_sign_planted: a gentle tap → YES, YOU, SUNNY pops (pop
//          the little sign                     sfx 2.85), he boops it with his snout, glances at Sunny.
//  rules   3.90–8.10  the SPRING RULES sign    rules_sign: 3 knocks (4.22 4.69 5.16 accent → board boings
//          + Barry beside it                   up), he steps back, admires it. gerald_ignores_rules: flap
//                                              (6.30) → lands on the top edge (land 6.90), reads the rules
//                                              while Barry taps '3. No vultures on heads' with the hammer,
//                                              looks at Barry, hops onto his head anyway.
//  raft    8.10–11.4  the river mouth: Barry   build_raft: bundles smack into the river as Barry heaves,
//          on the bank, the raft in front      two rope tugs (lashings), mast up, halyard yank → the S.S.
//                                              TOLD YOU SO banner snaps out (9.40), proud salute; Gerald
//                                              hops onto the deck (10.1), test-bounces on the thuds
//                                              (10.5, 10.9), nods.
//  helmet  11.4–13.4  medium on Barry standing helmet_on: he flips the helmet up, it lands on his head
//          in the shallows, Sunny + Doreen     (snap), cinches the strap on the zip (12.3–12.77) and lowers
//          at the edges                        himself into the spring with great dignity; Sunny + Doreen
//                                              glance at the signs and the raft, share a pitying look.
//  trio    13.4–17.8  "Bro. A helmet. In a hot tub." / "Honey, it's a little paranoid."
//  barry_cu 17.8–end  "I'm not paranoid. I'm early." (smug) → a glint on the helmet.
'use strict';

const K = require('../lib/kit');
const P = require('../lib/props');
const CAP = require('../lib/capybara');
const ES = require('../lib/env_spring');
const U = require('../lib/util');

const { clamp, lerp, ease, TAU } = U;
const SP = ES.SPRING;
const PI = Math.PI;
const fin = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const posv = (v, d = 1, m = 1e-3) => { v = fin(v, d); return v < m ? m : v; };

// ═══════════════════════════════════════════════════════════════════ timing (memoised per timeline)
const TM = new Map();
function timing(S) {
  const key = S.id + '|' + S.scene.start + '|' + S.tl.duration;
  let T = TM.get(key);
  if (T) return T;
  const KN = [0, 0.46875, 0.9375];                       // a hammer's three knocks (128 bpm)
  const ham = K.sfxTimes(S, 'hammer');
  const cut = {};
  for (const c of S._cams) { const tt = c.time - S.scene.start; if (cut[c.name] == null) cut[c.name] = tt; }
  const thuds = K.sfxTimes(S, 'thud');
  T = {
    knocks: [ham[0], ham[1]].flatMap((h) => KN.map((k) => h + k)),       // EXIT ×3, REALLY ×3
    rk: KN.map((k) => ham[2] + k),                                       // the rules sign ×3
    pop: K.sfxTimes(S, 'pop')[0],
    flap: K.sfxTimes(S, 'flap')[0],
    land: K.sfxTimes(S, 'land')[0],
    thuds,
    zip: K.sfxTimes(S, 'zip')[0],
    hs: K.beat(S, 'hammer_signs'), sun: K.beat(S, 'sunny_sign_planted'), rules: K.beat(S, 'rules_sign'),
    ign: K.beat(S, 'gerald_ignores_rules'), raft: K.beat(S, 'build_raft'), helm: K.beat(S, 'helmet_on'),
    cut,
  };
  T.zipEnd = T.zip + 0.47;
  T.flag = T.raft.t0 + 1.3;                                 // the banner snaps out
  T.hop2 = T.raft.t0 + 2.0;                                 // Gerald → the raft deck
  T.hopRules = T.ign.t0 + 1.2;                              // Gerald: rules sign → Barry's head
  TM.set(key, T);
  return T;
}

// ═══════════════════════════════════════════════════════════════════ small tools
// keyframe track: keys = [[t, value | [values]], ...], per-segment easing in key[2] (ease of the
// segment ENDING at that key; default inOutSine)
function track(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i];
    if (t <= k1[0]) {
      const k0 = keys[i - 1];
      const fn = typeof k1[2] === 'function' ? k1[2] : ease[k1[2] || 'inOutSine'];
      const u = fn(clamp((t - k0[0]) / Math.max(1e-6, k1[0] - k0[0])));
      if (Array.isArray(k0[1])) return k0[1].map((v, j) => lerp(v, k1[1][j], u));
      return lerp(k0[1], k1[1], u);
    }
  }
  return keys[keys.length - 1][1];
}
const after = (t, t0) => t >= t0;
// squash-stretch "boing" of a board springing up out of its stake (u = s since the hit)
function boing(u) {
  if (!(u >= 0)) return { sx: 0, sy: 0 };
  if (u > 0.6) return { sx: 1, sy: 1 };
  const k = 1 - Math.exp(-u * 15) * Math.cos(u * 29);
  return { sx: 1 + (1 - k) * 0.45, sy: Math.max(0.02, k) };
}

// ═══════════════════════════════════════════════════════════════════ signs
const SIGN = (() => {
  const o = {};
  for (const e of K.EXIT_SIGNS) {
    const sp = SP.exitSignSpots[e.spot];
    const so = { ...e, x: sp.x, y: sp.y };
    delete so.key; delete so.spot;
    o[e.key] = so;
  }
  o.rules = { ...K.RULES_SIGN, x: SP.rulesSignSpot.x, y: SP.rulesSignSpot.y };
  return o;
})();
const SIGN_GEO = {};
function signGeo(key) {
  if (SIGN_GEO[key]) return SIGN_GEO[key];
  const so = SIGN[key], s = so.scale ?? 1, L = P.signLayout(so);
  let posts;
  if (L.arrow) posts = [so.x + (L.dirL ? L.point / 2 : -L.point / 2) * 0.6 * s];
  else if (L.w > 210) { const d = L.w / 2 - Math.max(24, L.w * 0.13); posts = [so.x - d * s, so.x + d * s]; }
  else posts = [so.x];
  const bottom = (drive) => { const A = P.signAnchors({ ...so, drive }); return A.center.y + A.h / 2; };
  SIGN_GEO[key] = { posts, pw: (L.w > 210 ? 13 : 11) * s, bottom, b1: bottom(1), b0: bottom(0), s };
  return SIGN_GEO[key];
}
// a sign mid-planting: st = {drive, u (s since the board sprang up; < 0 / null = still a bare stake), rot}
function drawPlanted(ctx, key, T, st) {
  const so = SIGN[key], G = signGeo(key);
  const drive = clamp(fin(st.drive, 1));
  if (st.u != null && st.u > 0.6) { P.drawSign(ctx, { ...so, t: T, drive, rot: fin(st.rot, 0) }); return; }
  const yb = G.bottom(drive);
  // the bare stake(s): the sign's own posts, cut at the board line, with a sawn top
  ctx.save();
  ctx.beginPath(); ctx.rect(so.x - 400, yb + 0.25, 800, 300); ctx.clip();
  P.drawSign(ctx, { ...so, t: T, drive });
  ctx.restore();
  for (const px of G.posts) {
    ctx.save();
    U.ellipse(ctx, px, yb + 0.6, Math.max(0.5, G.pw / 2 - 0.5 * G.s), Math.max(0.3, 1.7 * G.s));
    ctx.fillStyle = '#E3B47D'; ctx.fill();
    ctx.strokeStyle = '#5E3B22'; ctx.lineWidth = 1.1 * G.s; ctx.stroke();
    ctx.restore();
  }
  if (st.u == null || !(st.u > 0)) return;
  // the board springs up out of the stake (scaled about the stake top, never below the ground)
  const b = boing(st.u);
  const px = G.posts.reduce((a, v) => a + v, 0) / G.posts.length;
  ctx.save();
  ctx.beginPath(); ctx.rect(so.x - 400, so.y - 600, 800, 600 + 1.5 * G.s); ctx.clip();
  ctx.translate(px, yb); ctx.scale(Math.max(0.02, b.sx), Math.max(0.02, b.sy)); ctx.translate(-px, -yb);
  P.drawSign(ctx, { ...so, t: T, drive, rot: fin(st.rot, 0) });
  ctx.restore();
}
// little white impact ticks + a dust puff at a hit point
function drawImpact(ctx, x, y, u, s, big) {
  if (!(u >= 0) || u > 0.35) return;
  const k = clamp(u / 0.12);
  ctx.save();
  if (u < 0.12) {
    ctx.strokeStyle = `rgba(255,252,235,${(1 - k) * 0.95})`;
    ctx.lineCap = 'round';
    ctx.lineWidth = (big ? 2.4 : 1.7) * s;
    const n = big ? 6 : 4, r0 = (big ? 7 : 5) * s + k * 6 * s, r1 = r0 + (big ? 11 : 7) * s * (1 - k * 0.5);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = -PI + (i + 0.5) * (PI / n);
      ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.8);
      ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1 * 0.8);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════ Barry with the hammer
const BS = 0.5;                       // Barry's scale on the banks (montage)
const HS = 0.85;                      // hammer scale relative to Barry
const PAWK = 0.846;                   // rig: caller units per pawAt unit at scale 1 (K × Barry's size)
let G0 = null;                        // stand pose: ground below the origin at scale 1
function groundOff() {
  if (G0 == null) { const a = CAP.capyAnchors({ who: 'barry', x: 0, y: 0, scale: 1, pose: 'stand', t: 0 }); G0 = fin(a.ground && a.ground.y, 54); }
  return G0;
}
// hammer face offset from the grip at angle a (facing-right frame), × world hammer scale
const faceOff = (a, hw) => ({ x: (22 * Math.cos(a) + 58 * Math.sin(a)) * hw, y: (22 * Math.sin(a) - 58 * Math.cos(a)) * hw });
const A_HIT = 1.2, A_UP = -0.95, A_CARRY = -0.35;
const CX = 64;                        // paw reach forward at the strike (caller units, scale 1)
// where Barry stands to hit a stake top (facing LEFT): {x, y (origin), pawHit (pawAt local)}
function strikeSetup(postX, stubY, groundY, s = BS) {
  const hw = HS * s, fo = faceOff(A_HIT, hw);
  const oy = groundY - groundOff() * s;
  const x = postX + CX * s + fo.x;
  const cy = (stubY - fo.y - oy) / s;
  return { x, y: oy, ground: groundY, pawHit: { x: CX / PAWK, y: cy / PAWK } };
}
function drawHammerAt(ctx, paw, a, s, flip) {
  P.drawHammer(ctx, { x: paw.x, y: paw.y, scale: HS * s, rot: flip ? -a : a, flip });
}

// ═══════════════════════════════════════════════════════════════════ SHOT 1 — signs
const GROUND_ROW = { exit: 470, really: 471, sunny: 476 };
function signsPlan(T) {
  if (T._signs) return T._signs;
  const kn = T.knocks;
  const ge = signGeo('exit'), gr = signGeo('really'), gs = signGeo('sunny');
  const dEx = [0.3, 0.62, 0.86, 1], dRe = [0.3, 0.62, 0.86, 1];
  const stub = (G, d) => G.bottom(d);
  const strikes = [];
  for (let i = 0; i < 3; i++) strikes.push({ t: kn[i], key: 'exit', ...strikeSetup(ge.posts[0], stub(ge, dEx[i]), GROUND_ROW.exit), accent: i === 2 });
  for (let i = 0; i < 3; i++) strikes.push({ t: kn[3 + i], key: 'really', ...strikeSetup(gr.posts[0], stub(gr, dRe[i]), GROUND_ROW.really), accent: i === 2 });
  const tap = { t: T.pop, key: 'sunny', ...strikeSetup(gs.posts[0], stub(gs, 0.7), GROUND_ROW.sunny), gentle: true };
  // one standing x per sign (the first strike's) — the paw height adapts per knock
  for (const s of strikes) { const f = strikes.find((q) => q.key === s.key); s.x = f.x; s.y = f.y; }
  T._signs = { strikes, tap, dEx, dRe };
  return T._signs;
}
// Barry's body position on the sign row: {x, y, pose, walkPhase, run}
function signsBody(T, t) {
  const pl = signsPlan(T);
  const xE = pl.strikes[0].x, xR = pl.strikes[3].x, xS = pl.tap.x;
  const yE = pl.strikes[0].y, yR = pl.strikes[3].y, yS = pl.tap.y;
  const r1 = [T.knocks[2] + 0.07, T.knocks[3] - 0.13], r2 = [T.knocks[5] + 0.07, T.pop - 0.2];
  const leg = (r, x0, x1, y0, y1) => {
    const k = clamp((t - r[0]) / (r[1] - r[0]));
    const e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
    return { x: lerp(x0, x1, e), y: lerp(y0, y1, e), k, e, dist: Math.abs(x1 - x0) * e };
  };
  let b;
  if (t < r1[0]) b = { x: xE, y: yE, pose: 'stand', wp: 0 };
  else if (t < r1[1]) { const l = leg(r1, xE, xR, yE, yR); b = { x: l.x, y: l.y, pose: 'run', wp: K.gaitPhase(l.dist, { who: 'barry', scale: BS, pose: 'run' }), run: l.k }; }
  else if (t < r2[0]) b = { x: xR, y: yR, pose: 'stand', wp: 0 };
  else if (t < r2[1]) { const l = leg(r2, xR, xS, yR, yS); b = { x: l.x, y: l.y, pose: 'run', wp: K.gaitPhase(l.dist, { who: 'barry', scale: BS, pose: 'run' }), run: l.k }; }
  else b = { x: xS, y: yS, pose: 'stand', wp: 0 };
  return b;
}
// hammer arm state for a list of strikes: {a, paw (pawAt local), pawUp}
const PAW_UP = { x: 46 / PAWK, y: -54 / PAWK }, PAW_CARRY = { x: 50 / PAWK, y: -30 / PAWK };
function hammerArm(t, strikes, o = {}) {
  // find the next strike and the previous one
  let prev = null, next = null;
  for (const s of strikes) { if (s.t <= t) prev = s; else if (!next) next = s; }
  const carry = { a: A_CARRY, p: PAW_CARRY };
  const hitOf = (s) => ({ a: s.gentle ? 0.95 : A_HIT, p: s.pawHit });
  const upOf = (s) => (s.gentle ? { a: 0.15, p: { x: s.pawHit.x - 6, y: s.pawHit.y - 22 } } : { a: A_UP, p: PAW_UP });
  const mixP = (A, B, k) => ({ a: lerp(A.a, B.a, k), p: { x: lerp(A.p.x, B.p.x, k), y: lerp(A.p.y, B.p.y, k) } });
  // pose after the previous hit (recoil), as a function of time since it
  const recoilOf = (s, u) => {
    const H = hitOf(s);
    const amt = s.gentle ? 0.25 : s.accent ? 0.9 : 0.45;
    const R = { a: H.a - amt, p: { x: H.p.x - 4, y: H.p.y - (s.accent ? 26 : 12) } };
    return mixP(H, R, ease.outQuad(clamp(u / (s.accent ? 0.12 : 0.08))));
  };
  let cur;
  if (!prev && !next) return { ...carry };
  if (next) {
    const sd = next.gentle ? 0.16 : 0.1;                 // strike duration
    const tS = next.t - sd;
    const from = prev ? recoilOf(prev, Math.min(t, tS) - prev.t) : carry;
    const tw0 = prev ? prev.t + (prev.accent ? 0.12 : 0.08) : -9;
    const up = upOf(next);
    if (t < tS) {
      // wind up from the recoil (or the carry pose) to the top of the swing, a beat of anticipation
      const tw = Math.max(tw0, tS - (next.gentle ? 0.22 : 0.26));
      const k = clamp((t - tw) / Math.max(1e-3, tS - tw));
      const base = prev && t < tw ? recoilOf(prev, t - prev.t) : from;
      cur = t < tw ? base : mixP(base, { a: up.a - (next.gentle ? 0 : 0.12 * Math.sin(PI * k)), p: up.p }, ease.inOutSine(k));
      if (o.carryUntil != null && t < o.carryUntil) cur = mixP(carry, cur, 0);
    } else {
      const k = clamp((t - tS) / sd);
      cur = mixP(up, hitOf(next), ease.inQuad(k));
    }
  } else {
    cur = recoilOf(prev, t - prev.t);
  }
  return cur;
}

// ═══════════════════════════════════════════════════════════════════ render
module.exports = {
  render(ctx, t, S) {
    const T = timing(S);
    const cam = S.cam();
    if (cam === 'signs') return shotSigns(ctx, t, S, T);
    return shotSigns(ctx, t, S, T);
  },
};

// ───────────────────────────────────────────────────────────────── shot: signs
function signsState(T, t) {
  const pl = signsPlan(T);
  const kn = T.knocks;
  const dAt = (ks, ds) => {
    // drive sinks quickly (2 frames) on each knock
    let d = ds[0];
    for (let i = 0; i < ks.length; i++) if (t >= ks[i]) d = lerp(ds[i], ds[i + 1], ease.outQuad(clamp((t - ks[i]) / 0.05)));
    return d;
  };
  return {
    exit: { drive: dAt(kn.slice(0, 3), pl.dEx), u: t - kn[2] },
    really: { drive: dAt(kn.slice(3, 6), pl.dRe), u: t - kn[5] },
    sunny: { drive: t >= T.pop ? lerp(0.7, 1, ease.outQuad(clamp((t - T.pop) / 0.05))) : 0.7, u: t - T.pop },
  };
}
function shotSigns(ctx, t, S, T) {
  const pl = signsPlan(T);
  const body = signsBody(T, t);
  const all = [...pl.strikes, pl.tap];
  const arm = hammerArm(t, all);
  const st = signsState(T, t);
  const lastHit = all.filter((s) => s.t <= t).pop();
  const uHit = lastHit ? t - lastHit.t : 9;
  const sq = uHit < 0.2 ? { sx: 1 + 0.05 * (1 - uHit / 0.2) * (lastHit.gentle ? 0.3 : 1), sy: 1 - 0.07 * (1 - uHit / 0.2) * (lastHit.gentle ? 0.3 : 1), dy: 0 } : { sx: 1, sy: 1, dy: 0 };
  const barry = {
    x: body.x, y: body.y, scale: BS, flip: true, pose: body.pose, walkPhase: body.wp, inWater: false, turn: false,
    pawUp: 1, pawAt: arm.p, hold: (c, paw) => drawHammerAt(c, paw, arm.a, BS, true),
    look: { x: 0.7, y: 0.75 }, squash: sq, tiltAdd: -4,
  };
  K.drawSpringStage(ctx, t, S, {
    env: { volcanoSmoke: 0.45 },
    cast: { barry, sunny: { eyes: 0, mood: 'sleepy' } },
    hooks: {
      behind: (c, s2) => {
        drawPlanted(c, 'exit', s2.T, st.exit);
        drawPlanted(c, 'really', s2.T, st.really);
        if (t >= T.pop - 0.6) drawPlanted(c, 'sunny', s2.T, st.sunny);
        K.drawRulesSign(c, s2.T, {});
      },
      afterCast: (c) => {
        for (const s of all) {
          const G = signGeo(s.key);
          drawImpact(c, G.posts[0], G.bottom(0.5), t - s.t, 1, !!s.accent);
        }
      },
    },
    framings: { signs: { x: 330, y: 430, zoom: 2.3, push: 0, drift: 0 } },
    cam: { shakeTable: {} },
  });
}
