// s06_montage — Barry gets ready (2:26–2:46, spring_day, wipe in, montage music).
//
// SHOTS (cams)                                 BEATS / SYNC
//  signs    0.00–3.90  the EXIT row from close: hammer_signs: bang, bang on a bare stake → BANG (the accent
//           Barry stands BEHIND the row (the       knock) and the board boings up out of it: EXIT 0.94, NO,
//           boards stay readable in front of       REALLY. THIS WAY. 2.34. He scampers to the next stake.
//           him), the camera tracks left, then     sunny_sign_planted: a gentle tap → YES, YOU, SUNNY pops (pop
//           drops + pushes in on the little sign   2.85), a snout-boop on its top edge, a soft look down at Sunny
//           with Sunny dozing lower right          (asleep, orange on, right below it).
//  rules    3.90–8.10  the SPRING RULES sign,      rules_sign: 3 knocks (4.22, 4.69, 5.16 accent → the notice
//           Barry in front of it on the rocks      boings up), he steps back and admires it.
//                                                  gerald_ignores_rules: flap 6.30 → touch-down on the top edge
//                                                  on the land sfx 6.90; he reads (a dip per line) while Barry
//                                                  taps '3. No vultures on heads' with the hammer; a look at
//                                                  Barry, a polite nod — and he hops onto his head anyway.
//  raft     8.10–11.4  the river mouth: the raft   build_raft: three heaves (the bundles smack in), two rope
//           in the river, Barry on the bank        tugs (lashings), mast up, halyard YANK → the S.S. TOLD YOU SO
//           at its stern                           banner snaps out (9.40), proud salute. Gerald hops onto the
//                                                  deck (10.1), test-bounces on the two thuds (10.5, 10.9) —
//                                                  Barry winces each time — and nods his approval.
//  helmet   11.4–13.4  medium on Barry standing    helmet_on: he flicks the helmet up, it flips once and lands
//           in the shallows, Sunny + Doreen at     on his head (snap), he cinches the strap on the zip
//           the edges                              (12.30–12.77) and lowers himself into the spring with great
//                                                  dignity. Sunny + Doreen glance at the signs, at the raft,
//                                                  and share a pitying look.
//  trio     13.4–17.8  "Bro. A helmet. In a hot tub." / "Honey, it's a little paranoid."
//  barry_cu 17.8–end   "I'm not paranoid. I'm early." — smug; a glint runs over the helmet.
//
// CONTINUITY: signs = the kit's standard EXIT_SIGNS (what s07 draws), rules sign = K.RULES_SIGN at
// SPRING.rulesSignSpot, the raft = s07's moored raft ({x:-20, y:600, scale:.8}, banner streaming left).
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
const bump = (t, t0, dur) => K.bump(t, t0, dur);

// ═══════════════════════════════════════════════════════════════════ timing (memoised per timeline)
const TM = new Map();
function timing(S) {
  const key = S.id + '|' + S.scene.start + '|' + S.scene.end;
  let T = TM.get(key);
  if (T) return T;
  const KN = [0, 0.46875, 0.9375];                       // a hammer's three knocks (128 bpm)
  const ham = K.sfxTimes(S, 'hammer');
  const cut = {};
  for (const c of S._cams) { const tt = c.time - S.scene.start; if (cut[c.name] == null) cut[c.name] = tt; }
  T = {
    knocks: [ham[0], ham[1]].flatMap((h) => KN.map((k) => h + k)),       // EXIT ×3, REALLY ×3
    rk: KN.map((k) => ham[2] + k),                                       // the rules sign ×3
    pop: K.sfxTimes(S, 'pop')[0],
    flap: K.sfxTimes(S, 'flap')[0],
    land: K.sfxTimes(S, 'land')[0],
    thuds: K.sfxTimes(S, 'thud'),
    zip: K.sfxTimes(S, 'zip')[0],
    sun: K.beat(S, 'sunny_sign_planted'), rules: K.beat(S, 'rules_sign'),
    ign: K.beat(S, 'gerald_ignores_rules'), raft: K.beat(S, 'build_raft'), helm: K.beat(S, 'helmet_on'),
    cut,
  };
  T.zipEnd = T.zip + 0.47;
  T.flag = T.raft.t0 + 1.3;                     // the banner snaps out (beat: 1.3 s)
  T.hop2 = T.raft.t0 + 2.0;                     // Gerald: Barry's head → the raft deck (beat: 2.0 s)
  T.hopRules = T.ign.t0 + 1.2;                  // Gerald: the rules sign → Barry's head
  T.tap3 = [T.ign.t0 + 0.86, T.ign.t0 + 1.02];  // Barry taps rule 3 with the hammer
  TM.set(key, T);
  return T;
}

// ═══════════════════════════════════════════════════════════════════ small tools
// keyframe track: keys = [[t, value | [values], ease?], ...] (ease of the segment ENDING at that key)
function track(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i];
    if (t <= k1[0]) {
      const k0 = keys[i - 1];
      const fn = typeof k1[2] === 'function' ? k1[2] : ease[k1[2] || 'inOutSine'];
      const u = fn(clamp((t - k0[0]) / Math.max(1e-6, k1[0] - k0[0])));
      if (Array.isArray(k0[1])) return k0[1].map((v, j) => lerp(v, k1[1][j], u));
      if (typeof k0[1] === 'object') { const o = {}; for (const k in k0[1]) o[k] = lerp(k0[1][k], k1[1][k], u); return o; }
      return lerp(k0[1], k1[1], u);
    }
  }
  return keys[keys.length - 1][1];
}
// squash-stretch "boing" of a board springing up out of its stake (u = s since the hit)
function boing(u) {
  if (!(u >= 0)) return { sx: 0, sy: 0 };
  if (u > 0.6) return { sx: 1, sy: 1 };
  const k = 1 - Math.exp(-u * 15) * Math.cos(u * 29);
  return { sx: 1 + (1 - k) * 0.45, sy: Math.max(0.02, k) };
}
// cartoon squash on a hit (body), u = s since the hit
function hitSquash(u, amt = 1) {
  if (!(u >= 0) || u > 0.22) return { sx: 1, sy: 1, dy: 0 };
  const k = Math.exp(-u * 16) * Math.cos(u * 22);
  return { sx: 1 + 0.045 * amt * k, sy: 1 - 0.07 * amt * k, dy: 0 };
}
const mulSq = (a, b) => ({ sx: a.sx * b.sx, sy: a.sy * b.sy, dy: (a.dy || 0) + (b.dy || 0) });

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
  const cache = {};
  const bottom = (drive) => {
    const k = Math.round(clamp(drive) * 200);
    if (cache[k] == null) { const A = P.signAnchors({ ...so, drive: k / 200 }); cache[k] = A.center.y + A.h / 2; }
    return cache[k];
  };
  SIGN_GEO[key] = { posts, pw: (L.w > 210 ? 13 : 11) * s, bottom, s, w: L.w * s, A: P.signAnchors(so) };
  return SIGN_GEO[key];
}
// a sign mid-planting: st = {drive, u (s since the board sprang up; null/negative = a bare stake), rot}
function drawPlanted(ctx, key, T, st) {
  const so = SIGN[key], G = signGeo(key);
  const drive = clamp(fin(st.drive, 1));
  const rot = fin(st.rot, 0);
  if (st.u != null && st.u > 0.6) { P.drawSign(ctx, { ...so, t: T, drive, rot }); return; }
  const yb = G.bottom(drive);
  // the bare stake(s): the sign's own posts, cut at the board line, with a sawn top
  ctx.save();
  ctx.beginPath(); ctx.rect(so.x - 400, yb + 0.25, 800, 300); ctx.clip();
  P.drawSign(ctx, { ...so, t: T, drive });
  ctx.restore();
  for (const px of G.posts) {
    ctx.save();
    U.ellipse(ctx, px, yb + 0.7, Math.max(0.5, G.pw / 2 - 0.4 * G.s), Math.max(0.3, 1.8 * G.s));
    ctx.fillStyle = '#E8BC86'; ctx.fill();
    ctx.strokeStyle = '#5E3B22'; ctx.lineWidth = 1.2 * G.s; ctx.stroke();
    ctx.restore();
  }
  if (st.u == null || !(st.u > 0)) return;
  // the board springs up out of the stake (scaled about the stake top, never below the ground)
  const b = boing(st.u);
  const px = G.posts.reduce((a, v) => a + v, 0) / G.posts.length;
  ctx.save();
  ctx.beginPath(); ctx.rect(so.x - 400, so.y - 600, 800, 600 + 1.5 * G.s); ctx.clip();
  ctx.translate(px, yb); ctx.scale(Math.max(0.02, b.sx), Math.max(0.02, b.sy)); ctx.translate(-px, -yb);
  P.drawSign(ctx, { ...so, t: T, drive, rot });
  ctx.restore();
}
// white impact ticks fanning up from a hit point (a few frames)
function drawImpact(ctx, x, y, u, s, big) {
  if (!(u >= 0) || u > 0.14) return;
  const k = clamp(u / 0.14);
  ctx.save();
  ctx.strokeStyle = `rgba(255,252,235,${(1 - k) * 0.95})`;
  ctx.lineCap = 'round';
  ctx.lineWidth = (big ? 2.2 : 1.6) * s;
  const n = big ? 7 : 5, r0 = (big ? 8 : 6) * s + k * 7 * s, r1 = r0 + (big ? 12 : 8) * s * (1 - k * 0.4);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = -PI + (i + 0.5) * (PI / n);
    ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.85);
    ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1 * 0.85);
  }
  ctx.stroke();
  ctx.restore();
}
// dust kicked up at a stake's foot
function drawDust(ctx, x, y, u, s, seed) {
  if (!(u >= 0) || u > 0.55) return;
  const life = u / 0.55;
  for (let i = 0; i < 2; i++) {
    const dir = i ? 1 : -1;
    P.drawSmokePuff(ctx, { x: x + dir * (6 + 16 * ease.outCubic(life)) * s, y: y - 2 * s, r: 7 * s, life, t: u, seed: seed + i, tone: 'dust', rise: 0.4, alpha: 0.7 });
  }
}

// ═══════════════════════════════════════════════════════════════════ Barry's hammer (far paw)
// The hammer is held in the FAR paw: drawn just BEHIND Barry, so the handle passes behind his head and
// the hammer head shows above it (wind-up) or past his snout (the strike) — never across his glasses.
// Arm state {a (rad, facing-right frame: 0 = head up, π/2 = head forward / face down), g (grip, local
// caller units at scale 1, facing right)}.
const BS = 0.48;                      // Barry's scale on the banks
const HW = 1.25;                      // hammer scale relative to Barry
const A_HIT = 1.22, A_UP = -0.85, A_CARRY = -0.45, A_SHOULDER = -1.25;
const G_UP = { x: 30, y: -22 }, G_CARRY = { x: 34, y: -10 }, G_SHOULDER = { x: 26, y: -16 };
let G0 = null;
function groundOff() {
  if (G0 == null) { const a = CAP.capyAnchors({ who: 'barry', x: 0, y: 0, scale: 1, pose: 'stand', t: 0 }); G0 = fin(a.ground && a.ground.y, 54); }
  return G0;
}
const faceOff = (a, hw) => ({ x: (22 * Math.cos(a) + 58 * Math.sin(a)) * hw, y: (22 * Math.sin(a) - 58 * Math.cos(a)) * hw });
const headOff = (a, hw) => ({ x: 58 * Math.sin(a) * hw, y: -58 * Math.cos(a) * hw });
const GX_HIT = 50;
// where Barry stands to hit a stake top facing `dir` (-1 = left): {x, y (origin), gHit}
function strikeSetup(postX, stubY, groundY, o = {}) {
  const s = o.s || BS, a = o.a ?? A_HIT, dir = o.dir ?? -1;
  const hw = HW * s, fo = faceOff(a, hw);
  const oy = groundY - groundOff() * s;
  const gx = o.gx ?? GX_HIT;
  const x = postX - dir * (gx * s + fo.x);
  const gy = (stubY - fo.y - oy) / s;
  return { x, y: oy, ground: groundY, gHit: { x: gx, y: gy }, aHit: a };
}
function drawHammer(ctx, bx, by, s, dir, arm, alpha = 1) {
  const g = { x: bx + dir * arm.g.x * s, y: by + arm.g.y * s };
  ctx.save();
  if (alpha < 1) ctx.globalAlpha *= clamp(alpha);
  P.drawHammer(ctx, { x: g.x, y: g.y, scale: HW * s, rot: dir < 0 ? -arm.a : arm.a, flip: dir < 0 });
  ctx.restore();
  return g;
}
// hammer arm over a list of strikes {t, gHit, aHit, gentle, accent}
function hammerArm(t, strikes, o = {}) {
  let prev = null, next = null;
  for (const s of strikes) { if (s.t <= t) prev = s; else if (!next) next = s; }
  const carry = o.carry || { a: A_CARRY, g: G_CARRY };
  const hitOf = (s) => ({ a: s.aHit, g: s.gHit });
  const upOf = (s) => (s.gentle ? { a: s.aHit - 0.9, g: { x: s.gHit.x - 6, y: s.gHit.y - 12 } } : { a: A_UP, g: G_UP });
  const mixA = (A, B, k) => ({ a: lerp(A.a, B.a, k), g: { x: lerp(A.g.x, B.g.x, k), y: lerp(A.g.y, B.g.y, k) } });
  const recDur = (s) => (s.accent ? 0.12 : s.gentle ? 0.1 : 0.08);
  const recoilOf = (s, u) => {
    const H = hitOf(s);
    const amt = s.gentle ? 0.3 : s.accent ? 1.1 : 0.5;
    const R = { a: H.a - amt, g: { x: H.g.x - 3, y: H.g.y - (s.accent ? 14 : 7) } };
    return mixA(H, R, ease.outQuad(clamp(u / recDur(s))));
  };
  if (!prev && !next) return { ...carry };
  if (next && (!o.until || next.t <= o.until + 1e-6)) {
    const sd = next.gentle ? 0.14 : 0.1;                         // the strike itself
    const tS = next.t - sd;
    const up = upOf(next);
    if (t >= tS) return mixA(up, hitOf(next), ease.inQuad(clamp((t - tS) / sd)));
    const wind = next.gentle ? 0.24 : 0.24;
    const tw = Math.max(prev ? prev.t + recDur(prev) : -9, tS - wind, o.free != null ? o.free(next) : -9);
    const base = prev ? recoilOf(prev, Math.min(t, tw) - prev.t) : carry;
    if (t < tw) return o.between ? o.between(t, prev, next, base) : base;
    const k = clamp((t - tw) / Math.max(1e-3, tS - tw));
    const top = { a: up.a - (next.gentle ? 0 : 0.14 * Math.sin(PI * k)), g: up.g };
    return mixA(base, top, ease.inOutSine(k));
  }
  return recoilOf(prev, t - prev.t);
}

// ═══════════════════════════════════════════════════════════════════ shared stage bits
const RAFT = { x: -20, y: 600, scale: 0.8 };       // s07's moored raft (continuity)
function raftBuild(T, t) {
  const u = t - T.raft.t0;
  if (u < 0) return 0;
  const hold = 0.82;
  const tHold = hold * 1.3;
  if (u < tHold) return u / 1.3;
  const tf = T.flag - T.raft.t0;
  if (u < tf) return hold;
  if (u < tf + 0.12) return lerp(hold, 0.95, ease.outCubic((u - tf) / 0.12));
  return Math.min(1, 0.95 + 0.05 * clamp((u - tf - 0.12) / 0.15));
}
function raftOpts(T, t) {
  const b = raftBuild(T, t);
  let dy = 0, rock = 0;
  const df = t - T.flag;
  if (df > 0 && df < 1.5) rock += 0.05 * Math.exp(-df * 4) * Math.sin(df * 15);
  for (const th of T.thuds) {
    const v = t - th;
    if (v > 0 && v < 1.0) { dy += 4.5 * Math.exp(-v * 5) * Math.sin(Math.min(PI, v * 9)); rock += 0.03 * Math.exp(-v * 4) * Math.sin(v * 13); }
  }
  return { x: RAFT.x, y: RAFT.y + dy, scale: RAFT.scale, bob: 0.7, rock, wind: 0.75, flagDir: -1, dir: -1, build: b, buildDur: 1.3 };
}
// Gerald on the raft deck (right of the mast, facing Barry on the bank)
const DECK_X = 66, G_DECK_SCALE = 0.44;
function deckPerch(T, t) {
  const RA = P.raftAnchors({ ...raftOpts(T, Math.max(t, T.flag + 1)), t: 0 });
  const deckY = RA.deck.y;
  return { x: DECK_X, y: deckY + (raftOpts(T, t).y - RAFT.y), scale: G_DECK_SCALE, flip: false };
}

// ═══════════════════════════════════════════════════════════════════ render
module.exports = {
  render(ctx, t, S) {
    const T = timing(S);
    const cam = S.cam();
    if (cam === 'signs') return shotSigns(ctx, t, S, T);
    if (cam === 'rules') return shotRules(ctx, t, S, T);
    if (cam === 'raft') return shotRaft(ctx, t, S, T);
    if (cam === 'helmet') return shotHelmet(ctx, t, S, T);
    return shotTrio(ctx, t, S, T, cam);
  },
};

// ───────────────────────────────────────────────────────────────── SHOT: signs
const ROW_GROUND = 438;            // Barry's ground behind the sign row
function signsPlan(T) {
  if (T._signs) return T._signs;
  const kn = T.knocks;
  const ge = signGeo('exit'), gr = signGeo('really'), gs = signGeo('sunny');
  const dEx = [0.25, 0.6, 0.85, 1], dRe = [0.25, 0.6, 0.85, 1];
  const strikes = [];
  for (let i = 0; i < 3; i++) strikes.push({ t: kn[i], key: 'exit', i, ...strikeSetup(ge.posts[0], ge.bottom(dEx[i]), ROW_GROUND), accent: i === 2 });
  for (let i = 0; i < 3; i++) strikes.push({ t: kn[3 + i], key: 'really', i, ...strikeSetup(gr.posts[0], gr.bottom(dRe[i]), ROW_GROUND + 1), accent: i === 2 });
  const tap = { t: T.pop, key: 'sunny', i: 0, ...strikeSetup(gs.posts[0], gs.bottom(0.7), ROW_GROUND + 2, { a: 1.0, gx: 44 }), gentle: true };
  // one standing spot per sign (the first knock's); the grip height follows the sinking stake
  for (const s of strikes) {
    const f = strikes.find((q) => q.key === s.key);
    const fo = faceOff(s.aHit, HW * BS);
    s.x = f.x; s.y = f.y;
    s.gHit = { x: (s.x - SIGN_GEO[s.key].posts[0] - fo.x) / BS, y: s.gHit.y };
  }
  const runs = [[kn[2] + 0.1, kn[3] - 0.16], [kn[5] + 0.1, T.pop - 0.28]];
  T._signs = { strikes, tap, dEx, dRe, runs, all: [...strikes, tap] };
  return T._signs;
}
function signsBody(T, t) {
  const pl = signsPlan(T);
  const xE = pl.strikes[0].x, xR = pl.strikes[3].x, xS = pl.tap.x;
  const yE = pl.strikes[0].y, yR = pl.strikes[3].y, yS = pl.tap.y;
  const leg = (r, x0, x1, y0, y1) => {
    const k = clamp((t - r[0]) / (r[1] - r[0]));
    const e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
    const dist = Math.abs(x1 - x0) * e;
    return { x: lerp(x0, x1, e), y: lerp(y0, y1, e), pose: 'run', wp: K.gaitPhase(dist, { who: 'barry', scale: BS, pose: 'run' }), k, run: true };
  };
  const [r1, r2] = pl.runs;
  if (t < r1[0]) return { x: xE, y: yE, pose: 'stand', wp: 0 };
  if (t < r1[1]) return leg(r1, xE, xR, yE, yR);
  if (t < r2[0]) return { x: xR, y: yR, pose: 'stand', wp: 0 };
  if (t < r2[1]) return leg(r2, xR, xS, yR, yS);
  return { x: xS, y: yS, pose: 'stand', wp: 0 };
}
function signsState(T, t) {
  const pl = signsPlan(T);
  const kn = T.knocks;
  const dAt = (ks, ds) => {
    let d = ds[0];
    for (let i = 0; i < ks.length; i++) if (t >= ks[i]) d = lerp(ds[i], ds[i + 1], ease.outQuad(clamp((t - ks[i]) / 0.05)));
    return d;
  };
  const boop = T.sun.t0 + 0.68;
  return {
    exit: { drive: dAt(kn.slice(0, 3), pl.dEx), u: t - kn[2], rot: P.signWobble(t - kn[2] - 0.12, 0.05) },
    really: { drive: dAt(kn.slice(3, 6), pl.dRe), u: t - kn[5], rot: P.signWobble(t - kn[5] - 0.12, 0.05) },
    sunny: { drive: t >= T.pop ? lerp(0.7, 1, ease.outQuad(clamp((t - T.pop) / 0.05))) : 0.7, u: t - T.pop, rot: P.signWobble(t - T.pop - 0.1, 0.06) + P.signWobble(t - boop, 0.09) },
    boop,
  };
}
function shotSigns(ctx, t, S, T) {
  const pl = signsPlan(T);
  const body = signsBody(T, t);
  const st = signsState(T, t);
  // hammer: strikes; carried high while scampering; shouldered after the little sign
  const tTapDone = T.pop + 0.22;
  let arm;
  if (t < tTapDone) {
    arm = hammerArm(t, pl.all, {
      between: (tt, prev, next, base) => {
        // a scamper between stakes: hammer held up and back
        const run = pl.runs.find((r) => tt >= r[0] - 0.08 && tt <= r[1] + 0.02);
        return run ? { a: lerp(base.a, A_CARRY, clamp((tt - run[0] + 0.08) / 0.1)), g: G_CARRY } : base;
      },
    });
  } else {
    const k = ease.inOutSine(clamp((t - tTapDone) / 0.25));
    const H = { a: pl.tap.aHit - 0.3, g: pl.tap.gHit };
    arm = { a: lerp(H.a, A_SHOULDER, k), g: { x: lerp(H.g.x, G_SHOULDER.x, k), y: lerp(H.g.y, G_SHOULDER.y, k) } };
  }
  const last = pl.all.filter((s) => s.t <= t).pop();
  let sq = last ? hitSquash(t - last.t, last.gentle ? 0.35 : last.accent ? 1.2 : 0.8) : { sx: 1, sy: 1, dy: 0 };
  // boop + the look down at Sunny
  const boopK = bump(t, st.boop - 0.16, 0.34);
  const lookSunny = ease.inOutSine(clamp((t - (st.boop + 0.22)) / 0.3));
  const sunnyGlance = t > st.boop + 0.2;
  const mood = t < T.knocks[2] ? 'worried' : sunnyGlance ? { worried: 0.45, sad: 0.35, happy: 0.2 } : { worried: 0.7, deadpan: 0.3 };
  const barry = {
    x: body.x - 7 * boopK, y: body.y + 2 * boopK, scale: BS, flip: true, pose: body.pose, walkPhase: body.wp, inWater: false, turn: false,
    look: sunnyGlance ? { x: lerp(0.6, -0.55, lookSunny), y: lerp(0.5, 0.95, lookSunny) } : body.run ? { x: 1, y: 0.1 } : { x: 0.75, y: 0.8 },
    headTurn: 0.32 * lookSunny, headTilt: -12 * boopK - 6 * lookSunny + (body.run ? 4 : -3),
    eyes: boopK > 0.6 ? 0.25 : undefined,
    squash: sq, mood, dart: false, reactions: false,
    accessories: { sweat: body.run ? 0.8 : 0.4 },
  };
  // camera: on EXIT → follow the scamper to REALLY → drop and push in on the little sign + Sunny
  const r1 = pl.runs[0], r2 = pl.runs[1];
  const cam = track(t, [
    [0, { x: 446, y: 416, zoom: 2.75 }],
    [r1[0] - 0.02, { x: 440, y: 416, zoom: 2.75 }],
    [r1[1] + 0.1, { x: 342, y: 418, zoom: 2.75 }, 'inOutCubic'],
    [r2[0], { x: 336, y: 418, zoom: 2.78 }],
    [T.pop + 0.15, { x: 292, y: 452, zoom: 2.95 }, 'inOutCubic'],
    [T.cut.rules, { x: 286, y: 455, zoom: 3.05 }],
  ]);
  const items = [];
  // the signs stand IN FRONT of Barry (he works from behind the row)
  for (const key of ['exit', 'really', 'sunny']) {
    if (key === 'sunny' && t < T.pop - 1.2) continue;
    items.push({ x: SIGN[key].x, y: SIGN[key].y, draw: (c, s2) => drawPlanted(c, key, s2.T, st[key]) });
  }
  // the hammer, just behind Barry (his far paw)
  items.push({ x: body.x, y: body.y - 0.01, draw: () => drawHammer(ctx, barry.x, barry.y + (1 - sq.sy) * 20 * BS, BS, -1, arm) });
  K.drawSpringStage(ctx, t, S, {
    env: { volcanoSmoke: 0.45 },
    cast: { barry, sunny: { eyes: 0, mood: 'sleepy', nod: false }, doreen: { eyes: 0, mood: 'sleepy' } },
    items,
    hooks: {
      afterCast: (c) => {
        for (const s of pl.all) {
          const G = signGeo(s.key);
          const u = t - s.t;
          if (u < 0 || u > 0.6) continue;
          const yTop = G.bottom(s.gentle ? 0.7 : (s.key === 'exit' ? pl.dEx : pl.dRe)[s.i]);
          drawImpact(c, G.posts[0], yTop, u, 1, !!s.accent);
          if (!s.gentle) drawDust(c, G.posts[0], SIGN[s.key].y, u, s.accent ? 1.15 : 0.8, 11 + s.i);
        }
        // boop!
        const ub = t - st.boop;
        if (ub > 0 && ub < 0.25) {
          const A = signGeo('sunny').A;
          c.save();
          c.globalAlpha = 1 - ub / 0.25;
          c.fillStyle = '#FF8FB1';
          const hx = A.top.x + 26, hy = A.top.y - 8 - ub * 26;
          heart(c, hx, hy, 4.2 + ub * 6);
          c.restore();
        }
      },
    },
    camera: () => cam,
    foliage: false,
  });
}
function heart(c, x, y, r) {
  r = Math.max(0.5, r);
  c.beginPath();
  c.moveTo(x, y + r * 0.9);
  c.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.7, y - r * 1.2, x, y - r * 0.45);
  c.bezierCurveTo(x + r * 0.7, y - r * 1.2, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
  c.fill();
}

// ───────────────────────────────────────────────────────────────── SHOT: rules
const RULES_GROUND = 464;
function rulesPlan(T) {
  if (T._rules) return T._rules;
  const G = signGeo('rules');
  const dR = [0.3, 0.62, 0.86, 1];
  const strikes = T.rk.map((tk, i) => ({ t: tk, i, key: 'rules', ...strikeSetup(G.posts[1], G.bottom(dR[i]), RULES_GROUND), accent: i === 2 }));
  for (const s of strikes) {
    const fo = faceOff(s.aHit, HW * BS);
    s.x = strikes[0].x; s.y = strikes[0].y;
    s.gHit = { x: (s.x - G.posts[1] - fo.x) / BS, y: s.gHit.y };
  }
  // rule 3 tap: the hammer face on the end of '3. No vultures on heads'
  const L3 = G.A.lines[3];
  const tapA = 1.38;
  const tapPt = { x: L3.x + L3.w / 2 - 2, y: L3.y + 1 };
  const tapSet = strikeSetup(tapPt.x, tapPt.y, RULES_GROUND, { a: tapA, gx: 48 });
  T._rules = { G, dR, strikes, tapSet, tapPt, xBack: strikes[0].x + 34 };
  return T._rules;
}
function shotRules(ctx, t, S, T) {
  const pl = rulesPlan(T);
  const G = pl.G;
  const pop = T.rk[2];
  const dAt = () => { let d = pl.dR[0]; for (let i = 0; i < 3; i++) if (t >= T.rk[i]) d = lerp(pl.dR[i], pl.dR[i + 1], ease.outQuad(clamp((t - T.rk[i]) / 0.05))); return d; };
  const drive = dAt();
  // Barry: strike spot → steps back (admires) → steps in for the rule-3 taps → Gerald lands on him
  const xS = pl.strikes[0].x, xB = pl.xBack, xT = pl.tapSet.x;
  const tBack = [pop + 0.16, pop + 0.62], tIn = [T.tap3[0] - 0.36, T.tap3[0] - 0.12];
  let x = xS, walkD = 0;
  if (t >= tBack[0]) { const k = ease.inOutSine(clamp((t - tBack[0]) / (tBack[1] - tBack[0]))); x = lerp(xS, xB, k); walkD = -(xB - xS) * k; }
  if (t >= tIn[0]) { const k = ease.inOutSine(clamp((t - tIn[0]) / (tIn[1] - tIn[0]))); x = lerp(xB, xT, k); walkD = -(xB - xS) + (xB - xT) * k; }
  const walking = (t > tBack[0] && t < tBack[1]) || (t > tIn[0] && t < tIn[1]);
  // hammer: strikes → onto the shoulder (proud) → the rule-3 taps → lowered when Gerald hops on
  let arm;
  const tShoulder = pop + 0.2;
  const tapSt = T.tap3.map((tt) => ({ t: tt, aHit: 1.38, gHit: pl.tapSet.gHit, gentle: true }));
  if (t < tShoulder) arm = hammerArm(t, pl.strikes);
  else if (t < tIn[0]) {
    const k = ease.inOutSine(clamp((t - tShoulder) / 0.3));
    const R = hammerArm(tShoulder, pl.strikes);
    arm = { a: lerp(R.a, A_SHOULDER, k), g: { x: lerp(R.g.x, G_SHOULDER.x, k), y: lerp(R.g.y, G_SHOULDER.y, k) } };
  } else if (t < T.tap3[1] + 0.2) {
    arm = hammerArm(t, tapSt, { carry: { a: A_SHOULDER, g: G_SHOULDER } });
  } else {
    const k = ease.inOutSine(clamp((t - T.tap3[1] - 0.2) / 0.3));
    const R = hammerArm(T.tap3[1] + 0.2, tapSt);
    arm = { a: lerp(R.a, 2.4, k), g: { x: lerp(R.g.x, 30, k), y: lerp(R.g.y, 6, k) } };
  }
  const last = pl.strikes.filter((s) => s.t <= t).pop();
  const sq = last ? hitSquash(t - last.t, last.accent ? 1.2 : 0.8) : { sx: 1, sy: 1, dy: 0 };
  // Gerald: lands on the top edge on the 'land' sfx, reads, hops onto Barry's head
  const gS = 0.44;
  const hopT0 = T.hopRules, hopDur = 0.5;
  const rulesTop = G.A.top;
  const readK = clamp((t - (T.land + 0.12)) / 0.5);
  const lineNod = bump(t, T.land + 0.14, 0.2) * 0.5 + bump(t, T.land + 0.34, 0.2) * 0.5 + bump(t, T.land + 0.54, 0.24) * 0.6;
  let gerald = null;
  if (t >= T.ign.t0 - 0.2) {
    if (t < hopT0) {
      gerald = {
        on: 'rules', scale: gS, land: { t0: T.ign.t0, from: { x: 1010, y: 210 } },
        look: t > T.land + 0.1 ? (t < T.tap3[0] - 0.05 ? { x: 0.35, y: 1 } : t < T.tap3[1] + 0.22 ? { x: 0.9, y: 0.9 } : { x: 1, y: 0.2 }) : undefined,
        nod: lineNod + 0.7 * bump(t, T.tap3[1] + 0.2, 0.32), mood: t > T.tap3[1] + 0.15 ? 'smug' : 'neutral',
      };
    } else {
      gerald = { on: 'barry', scale: 0.82 * BS, hop: { t0: hopT0, dur: hopDur, from: { x: rulesTop.x, y: rulesTop.y + 2, scale: gS } }, ...(t < hopT0 + 0.1 ? { layer: 'behind' } : {}) };
    }
  }
  void readK;
  // Barry's acting
  const gOn = t > hopT0 + hopDur - 0.1;
  const proud = t > pop + 0.1 && t < T.ign.t0 + 0.15;
  const mood = gOn ? { deadpan: 0.85, worried: 0.15 }
    : t < pop ? { worried: 0.75, deadpan: 0.25 }
      : proud ? { smug: 0.6, happy: 0.4 }
        : { worried: 0.8, deadpan: 0.2 };
  let look;
  if (gOn) look = { x: 0.2, y: -1 };
  else if (t < pop + 0.1) look = { x: 0.75, y: 0.75 };
  else if (t < T.ign.t0 + 0.12) look = { x: 0.6, y: -0.35 };
  else if (t < T.land) look = { x: -0.8, y: -0.9 };          // the flap behind him, up right
  else if (t < T.tap3[0] - 0.4) look = { x: 0.55, y: -0.85 };
  else if (t < T.tap3[1] + 0.2) look = { x: 0.8, y: 0.25 };
  else look = { x: 0.5, y: -0.9 };
  const barry = {
    x, y: pl.strikes[0].y, scale: BS, flip: true, pose: walking ? 'walk' : 'stand', walkPhase: K.gaitPhase(walkD, { who: 'barry', scale: BS, pose: 'walk' }),
    inWater: false, turn: false, look, mood, dart: false, reactions: false,
    squash: mulSq(sq, hitSquash(t - (hopT0 + hopDur - 0.16), 0.9)),
    tiltAdd: proud ? 6 * ease.inOutSine(clamp((t - pop - 0.1) / 0.3)) * (1 - clamp((t - T.ign.t0) / 0.2)) : gOn ? -4 : 0,
    nod: false,
  };
  K.drawSpringStage(ctx, t, S, {
    env: { volcanoSmoke: 0.45 },
    cast: { barry, sunny: { eyes: 0, mood: 'sleepy' }, doreen: { mood: 'chill', eyes: t > pop && t < pop + 1.1 ? 0.45 : 0, lookAt: 'barry' } },
    gerald,
    items: [{ x, y: pl.strikes[0].y - 0.01, draw: () => drawHammer(ctx, barry.x, barry.y + (1 - sq.sy) * 20 * BS, BS, -1, arm) }],
    hooks: {
      behind: (c, s2) => {
        drawPlanted(c, 'rules', s2.T, { drive, u: t - pop, rot: P.signWobble(t - pop - 0.12, 0.035) });
        K.drawExitSigns(c, s2.T, {});
      },
      afterCast: (c) => {
        for (const s of pl.strikes) {
          const u = t - s.t;
          if (u < 0 || u > 0.6) continue;
          drawImpact(c, G.posts[1], G.bottom(pl.dR[s.i]), u, 1, !!s.accent);
          drawDust(c, G.posts[1], SIGN.rules.y, u, s.accent ? 1.1 : 0.8, 21 + s.i);
          if (s.accent) drawDust(c, G.posts[0], SIGN.rules.y, u, 1.0, 31);
        }
        for (const tt of T.tap3) drawImpact(c, pl.tapPt.x - 2, pl.tapPt.y - 4, t - tt, 0.55, false);
      },
    },
    framings: { rules: { x: 648, y: 400, zoom: 2.25, push: 0.006 } },
    cam: { shakeTable: { land: K.SHAKE_SFX.land } },
  });
}

// ───────────────────────────────────────────────────────────────── SHOT: raft
const RAFT_BANK = { x: 206, ground: 522 };
function shotRaft(ctx, t, S, T) {
  const b0 = T.raft.t0;
  const ro = raftOpts(T, t);
  const RA = P.raftAnchors({ ...ro, t: S.T });
  const bx = RAFT_BANK.x, by = RAFT_BANK.ground - groundOff() * BS;
  // Barry's actions: three heaves (bundles), two tugs (lashings), push (mast), halyard YANK, salute
  const heaves = [b0 + 0.02, b0 + 0.19, b0 + 0.36];
  const tugs = [b0 + 0.66, b0 + 0.86];
  const yank = T.flag;
  const salute = [T.flag + 0.14, T.hop2 - 0.08];
  let pawUp = 1, pawAt = { x: 70, y: 12 }, rope = null, tilt = 0, eyes, mood = { worried: 0.6, deadpan: 0.4 };
  const pa = (x, y) => ({ x: x / 0.846, y: y / 0.846 });
  if (t < heaves[2] + 0.22) {
    // heave: paw swings up-forward and flings
    const h = heaves.filter((h) => h <= t + 0.12).pop() ?? heaves[0];
    const u = clamp((t - (h - 0.12)) / 0.24);
    const sw = Math.sin(PI * u);
    pawAt = pa(lerp(56, 80, u), lerp(10, -36, sw));
    tilt = 6 * sw;
    mood = { worried: 0.5, panic: 0.2, deadpan: 0.3 };
  } else if (t < tugs[1] + 0.25) {
    // rope tugs: paw pulls back toward the chest on each lashing
    const tug = tugs.reduce((a, tt) => a + bump(t, tt - 0.06, 0.2), 0);
    pawAt = pa(lerp(74, 46, tug), lerp(14, 20, tug));
    rope = { taut: tug, slack: 1 - tug };
    tilt = -5 * tug;
  } else if (t < yank - 0.2) {
    // mast up: a push
    const k = clamp((t - (tugs[1] + 0.25)) / (yank - 0.2 - tugs[1] - 0.25));
    pawAt = pa(lerp(70, 60, k), lerp(10, -50, ease.inOutSine(k)));
    tilt = 8 * k;
  } else if (t < salute[0]) {
    // the halyard: reach up, YANK down on the snap
    const k = clamp((t - yank) / 0.08);
    pawAt = pa(lerp(56, 66, k), lerp(-52, 16, ease.outQuad(k)));
    rope = { halyard: true, taut: 1 };
    tilt = lerp(8, -6, k);
  } else if (t < salute[1]) {
    // proud salute to the S.S. TOLD YOU SO
    const k = ease.outBack(clamp((t - salute[0]) / 0.16));
    pawAt = pa(lerp(66, 44, clamp(k)), lerp(16, -50, k));
    tilt = 7;
    eyes = 0.3;
    mood = { smug: 0.8, happy: 0.2 };
  } else {
    pawUp = clamp(1 - (t - salute[1]) / 0.2);
    pawAt = pa(44, -50);
    mood = { worried: 0.85, deadpan: 0.15 };
  }
  // the thuds: Barry winces
  let sq = { sx: 1, sy: 1, dy: 0 };
  for (const th of T.thuds) sq = mulSq(sq, hitSquash(t - th, 0.6));
  const wince = T.thuds.reduce((a, th) => a + bump(t, th - 0.04, 0.3), 0);
  if (wince > 0.02) { eyes = lerp(eyes ?? 0.8, 0.05, clamp(wince)); mood = { worried: 0.6, shock: 0.4 * clamp(wince) + 0, panic: 0 }; }
  const nod = T.thuds[1] + 0.2;
  if (t > nod + 0.12) mood = { happy: 0.55, smug: 0.25, worried: 0.2 };
  const gOff = t >= T.hop2 + 0.1;
  const barry = {
    x: bx, y: by, scale: BS, flip: true, pose: 'stand', inWater: false, turn: false, pawUp, pawAt,
    look: t < salute[0] ? { x: 0.8, y: 0.4 } : t < salute[1] ? { x: 0.7, y: -0.5 } : gOff ? { x: 0.75, y: 0.75 } : { x: 0.5, y: -0.8 },
    tiltAdd: tilt, eyes, mood, squash: sq, dart: false, reactions: false,
  };
  // Gerald: rides Barry's head → hops onto the deck → two test bounces (lands on each thud) → nods
  const deck = deckPerch(T, t);
  let gy = 0, crouch = 0;
  for (const th of T.thuds) {
    const u = t - th;
    if (u > -0.32 && u < 0) { const k = (u + 0.32) / 0.32; crouch = Math.max(crouch, 0.7 * bump(k, 0, 0.4)); gy = -13 * Math.sin(PI * clamp((k - 0.3) / 0.7)); }
    if (u >= 0 && u < 0.3) crouch = Math.max(crouch, 0.8 * Math.exp(-u * 9));
  }
  const gerald = {
    on: { ...deck, y: deck.y + gy }, hop: { t0: T.hop2, dur: 0.42, from: 'barry' },
    crouch, nod: bump(t, nod, 0.36), look: t > T.hop2 + 0.4 ? (t > nod - 0.1 ? { x: 0.9, y: -0.1 } : { x: 0.4, y: 0.9 }) : undefined,
    mood: t > nod ? 'smug' : 'neutral',
  };
  const cam = track(t, [[b0, { x: 40, y: 486, zoom: 2.15 }], [T.hop2 - 0.1, { x: 30, y: 490, zoom: 2.2 }], [T.cut.helmet, { x: 36, y: 496, zoom: 2.3 }]]);
  K.drawSpringStage(ctx, t, S, {
    env: { volcanoSmoke: 0.45 },
    cast: { barry, sunny: { eyes: 0, mood: 'sleepy' }, doreen: { eyes: 0, mood: 'sleepy' } },
    gerald,
    hooks: {
      behind: (c, s2) => {
        K.drawExitSigns(c, s2.T, {});
        P.drawRaft(c, { ...ro, t: s2.T });
      },
      afterCast: (c, s2) => {
        if (!rope) return;
        const paw = K.castAnchors(s2.cast.barry.opts).paw;
        if (rope.halyard) drawRope(c, paw, { x: RA.mastTop.x + 2, y: RA.mastTop.y + 30 }, 0, 1);
        else drawRope(c, paw, { x: RA.tipR.x - 22, y: RA.tipR.y + 4 }, rope.slack, 1);
      },
    },
    camera: () => cam,
    foliage: false,
  });
}
function drawRope(c, a, b, slack, alpha) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + 12 * clamp(slack);
  c.save();
  c.globalAlpha *= clamp(alpha);
  c.lineCap = 'round';
  c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo(mx, my, b.x, b.y);
  c.strokeStyle = '#7A5428'; c.lineWidth = 2.6; c.stroke();
  c.strokeStyle = '#D2A562'; c.lineWidth = 1.5; c.stroke();
  c.restore();
}

// ───────────────────────────────────────────────────────────────── SHOT: helmet
const HELM = { x: 650, wl: 600, y0: 566, y1: 588 };
function shotHelmet(ctx, t, S, T) {
  const h0 = T.helm.t0;
  const tFlick = h0 + 0.36, tLand = h0 + 0.62, tLower = [T.zipEnd + 0.12, T.cut.trio - 0.02];
  const lowerK = ease.inOutSine(clamp((t - tLower[0]) / (tLower[1] - tLower[0])));
  const by = lerp(HELM.y0, HELM.y1, lowerK);
  const strap = t < T.zip ? 0 : ease.inOutSine(clamp((t - T.zip) / (T.zipEnd - T.zip)));
  const worn = t >= tLand;
  const pa = (x, y) => ({ x: x / 0.846, y: y / 0.846 });
  // paw: holds the helmet out → dip → FLICK → to the chin buckle → zips → down
  let pawUp = 1, pawAt = pa(86, 2), hold = null;
  if (t < tFlick) {
    const dip = bump(t, tFlick - 0.16, 0.2);
    pawAt = pa(lerp(84, 88, clamp((t - h0) / 0.2)), 2 + 10 * dip);
    hold = (c, paw) => P.drawHelmet(c, { x: paw.x + 2, y: paw.y - 3, scale: 0.95, rot: -0.15, strap: true });
  } else if (t < tLand + 0.12) {
    const k = ease.outCubic(clamp((t - tFlick) / 0.1));
    pawAt = pa(86, lerp(12, -18, k));
  } else if (t < T.zipEnd + 0.08) {
    const k = ease.inOutSine(clamp((t - tLand - 0.12) / 0.2));
    const tug = t > T.zip ? Math.sin(PI * clamp((t - T.zip) / (T.zipEnd - T.zip))) : 0;
    pawAt = pa(lerp(86, 100, k), lerp(-18, 18 + 6 * tug, k));
  } else {
    pawUp = clamp(1 - (t - T.zipEnd - 0.08) / 0.22);
    pawAt = pa(100, 20);
  }
  const land = t - tLand;
  const sq = hitSquash(land, 1.1);
  const dignity = ease.inOutSine(clamp((t - (T.zipEnd - 0.05)) / 0.3));
  const barryExtra = {
    x: HELM.x, y: by, scale: 1, flip: false, pose: 'stand', inWater: false, turn: false,
    pawUp, pawAt, hold,
    accessories: worn ? { helmet: { strap } } : {},
    squash: sq, dart: false, reactions: false,
    mood: dignity > 0 ? { smug: 0.55 * dignity, deadpan: 0.45 * dignity + (1 - dignity) * 0.6, worried: (1 - dignity) * 0.4 } : { deadpan: 0.6, worried: 0.4 },
    look: t < tFlick ? { x: 0.8, y: 0.45 } : t < tLand ? { x: 0.3, y: -1 } : t < T.zipEnd ? { x: 0.7, y: 0.6 } : { x: 0.6, y: 0 },
    eyes: dignity > 0 ? lerp(0.8, 0.3, dignity) : undefined,
    tiltAdd: t < tLand && t > tFlick ? 10 : 8 * dignity,
  };
  // Sunny + Doreen: glance at the signs, at the raft, at each other (pity), back at Barry
  const g = (keys) => track(t, keys);
  const sunLook = g([[h0, { x: 0.6, y: 0 }], [h0 + 0.3, { x: -1, y: -0.55 }], [h0 + 0.62, { x: -1, y: -0.55 }], [h0 + 0.8, { x: -1, y: 0.15 }],
    [h0 + 1.0, { x: -1, y: 0.15 }], [h0 + 1.15, { x: 1, y: -0.1 }], [tLower[0] + 0.1, { x: 1, y: -0.1 }], [tLower[0] + 0.3, { x: 0.7, y: 0.2 }]]);
  const dorLook = g([[h0, { x: 0.6, y: 0 }], [h0 + 0.4, { x: 1, y: -0.6 }], [h0 + 0.7, { x: 1, y: -0.6 }], [h0 + 0.88, { x: 1, y: 0.1 }],
    [h0 + 1.0, { x: 1, y: 0.1 }], [h0 + 1.15, { x: 1, y: -0.15 }], [tLower[0] + 0.1, { x: 1, y: -0.15 }], [tLower[0] + 0.3, { x: 0.6, y: 0.25 }]]);
  const pity = ease.inOutSine(clamp((t - (h0 + 1.05)) / 0.25));
  const sunny = { look: sunLook, mood: { chill: 1 - 0.6 * pity, sad: 0.4 * pity, happy: 0.2 * pity }, tiltAdd: -6 * pity, dart: false };
  const doreen = { look: dorLook, mood: { chill: 0.3 * (1 - pity), happy: 0.7 - 0.25 * pity, sad: 0.55 * pity }, tiltAdd: -7 * pity, dart: false };
  // the flicked helmet: one flip on a little arc from the paw to the head
  const items = [{ x: HELM.x, y: HELM.wl, water: { w: 250, depth: 120 }, draw: () => {} }];
  let flight = null;
  if (t >= tFlick && t < tLand) {
    const bo = K.castOpts(S, 'barry', { ...barryExtra, setting: 'spring_day' });
    const end = CAP.capyAnchors({ ...bo, accessories: { helmet: { strap: 0 } } }).helmet;
    const start0 = K.castAnchors(K.castOpts(S, 'barry', { ...barryExtra, pawAt: pa(86, 2), hold: null, setting: 'spring_day' })).paw;
    const u = clamp((t - tFlick) / (tLand - tFlick));
    const p = K.lob(t, tFlick, tLand - tFlick, { x: start0.x + 2, y: start0.y - 3 }, end, { h: 70 });
    flight = { x: p.x, y: p.y, rot: lerp(-0.15, -TAU + fin(end.angle, 0), ease.inOutSine(u)), scale: lerp(0.95, end.scale, u), flip: false };
  }
  K.drawSpringStage(ctx, t, S, {
    env: { volcanoSmoke: 0.45 },
    cast: { barry: barryExtra, sunny, doreen },
    gerald: { on: deckPerch(T, t) },
    items,
    hooks: {
      behind: (c, s2) => {
        K.drawExitSigns(c, s2.T, {});
        K.drawRulesSign(c, s2.T, {});
        P.drawRaft(c, { ...raftOpts(T, t), t: s2.T });
      },
      afterCast: (c) => {
        if (flight) {
          P.drawHelmet(c, { ...flight, strap: true });
          P.drawMotionLines(c, { x: flight.x, y: flight.y - 10, angle: -PI / 2 + (t < (tFlick + tLand) / 2 ? 0 : PI), len: 26, count: 3, spread: 22, t, alpha: 0.6 });
        }
        if (land >= 0 && land < 0.14) {
          const a = CAP.capyAnchors(K.castOpts(S, 'barry', { ...barryExtra, setting: 'spring_day' }));
          drawImpact(c, a.helmet.x, a.helmet.y - 26, land, 1.2, true);
        }
      },
    },
    framings: { helmet: { x: 650, y: 488, zoom: 2.05, push: 0.008 } },
    cam: { shakeTable: {} },
  });
}

// ───────────────────────────────────────────────────────────────── SHOT: trio / barry_cu
function shotTrio(ctx, t, S, T, cam) {
  const lineB = K.lineWith(S, 'barry', "I'm not paranoid");
  const glint = lineB ? lineB.le + 0.08 : S.duration - 0.6;
  const barry = {
    accessories: { helmet: { strap: 1 } },
    rest: [[0, 'deadpan'], [T.cut.barry_cu - 0.4, 'smug']],
    tiltAdd: 3,
    eyes: t > glint - 0.05 ? lerp(0.75, 0.35, clamp((t - glint + 0.05) / 0.25)) : undefined,
  };
  K.drawSpringStage(ctx, t, S, {
    env: { volcanoSmoke: 0.45 },
    cast: { barry },
    gerald: { on: deckPerch(T, t) },
    hooks: {
      behind: (c, s2) => {
        K.drawExitSigns(c, s2.T, {});
        K.drawRulesSign(c, s2.T, {});
        P.drawRaft(c, { ...raftOpts(T, t), t: s2.T });
      },
      afterCast: (c, s2) => {
        if (cam !== 'barry_cu') return;
        const u = t - glint;
        if (u < 0 || u > 0.45) return;
        const a = K.castAnchors(s2.cast.barry.opts).helmet;
        drawGlint(c, a.x + 8 * a.scale * (a.flip ? -1 : 1), a.y - 20 * a.scale, u / 0.45, 9 * a.scale);
      },
    },
  });
}
function drawGlint(c, x, y, k, r) {
  const s = Math.sin(PI * clamp(k)) * Math.max(0.5, r);
  if (s < 0.2) return;
  c.save();
  c.translate(x, y);
  c.rotate(k * 0.8);
  c.fillStyle = 'rgba(255,255,245,0.95)';
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? s * 0.22 : s;
    const a = (i / 8) * TAU;
    c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
  c.restore();
}
void posv;
