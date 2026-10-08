// s08_aftermath — EXT. THE RIVER - SUNSET (3:44–4:28). Larry David vindication, warm and a little
// bittersweet. Raft stage (kit.drawRaftStage): Sunny at the stern facing the bow, Doreen amidships
// facing Sunny (their conversation pair), Barry alone at the bow staring ahead; Gerald on the mast
// top over "S.S. TOLD YOU SO" → shuffles onto the banner (it bunches to "S.S.") and settles there.
//
// CAMERAS (all four names the timeline uses):
//   barry_cu    kit's river CU (Mount Snooze cheated over his shoulder, smoking out of frame),
//               varied per instance: the flat opening stare (his helmet still smoking), the
//               savouring "slower", the cross-examination closing in a notch each question, the
//               triumphant release, the tighter exasperated flail, the deadpan "Oh, now they
//               wave.", and "Am I chill?" as a warm two-shot (Doreen behind him, the orange on the
//               helmet, the sun cheated into the frame ahead of him). After the flag gag every
//               close framing keeps its top edge under the bunched banner (PILE_Y).
//   raft_wide   1st: an establishing wide on the whole river (sun, banks, tiny smoking volcano)
//               dollying in as Sunny speaks; then the kit's 1.5× group framing (Gerald on the mast
//               always in); the monologue creeps in (Gerald still in for "the credit"), then pushes
//               into a two-shot of Barry + Doreen for the orange; the last shot pulls back into the
//               sunset while Sunny scoots up to join them.
//   gerald_flag the kit's locked mast-top + banner framing (identical both times so the change of
//               the banner reads): his line, then preen → shuffle → settle → "S.S.".
//   fish        a low two-level frame: the lily pad with the three fish (suitcases stacked) drifts
//               past in the foreground while the raft passengers react above.
//
// The orange (doreen_orange): Doreen has a fresh orange on her head all scene (her s07 one was
// juiced — juice stains stay). She turns to Barry, scoots up behind him, rears up and tips her head:
// the orange rolls off HER head onto the top of his helmet, rocks once and stays. Head-to-head —
// the way capybaras do it. From then on the scene draws that orange itself (rocking pivot = its
// contact point on the helmet), so there is never a swap pop.
'use strict';
const K = require('../lib/kit');
const CR = require('../lib/critters');
const CAP = require('../lib/capybara');
const P = require('../lib/props');
const U = require('../lib/util');
const { clamp, lerp, ease, smoothstep } = U;

const TAU = Math.PI * 2;
const fin = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const pos = (v, d = 1, m = 1e-3) => { v = fin(v, d); return v < m ? m : v; };

// smooth keyframes for numbers / [x, y] arrays: [[t, v], ...] (inOutSine between keys)
function kf(t, keys, fn = ease.inOutSine) { return U.keys(t, keys, fn); }
// saccade schedule: [[t, [x, y], dur = .14], ...] → look {x, y}
function saccades(t, list) {
  let v = list[0][1];
  for (let i = 1; i < list.length; i++) {
    const [t0, nv, d = 0.14] = list[i];
    if (t < t0) break;
    const k = ease.inOutCubic(clamp((t - t0) / d));
    v = [lerp(v[0], nv[0], k), lerp(v[1], nv[1], k)];
  }
  return { x: clamp(v[0], -1, 1), y: clamp(v[1], -1, 1) };
}
const bump = (t, t0, d) => K.bump(t, t0, d);

// ─────────────────────────────────────────────────────────────── timing (memoised per timeline)
const MEMO = new WeakMap();
function timing(S) {
  let m = MEMO.get(S.tl);
  if (m) return m;
  const L = (who, txt) => {
    const l = K.lineWith(S, who, txt);
    return l ? { s: l.ls, e: l.le, line: l } : { s: -99, e: -98, line: null };
  };
  const w = (ln, word, n = 0) => { const v = ln.line ? K.wordTime(S, ln.line, word, n) : null; return v == null ? ln.s : v; };
  const T = {
    cat: L('barry', 'catastrophizing'),
    right: L('sunny', 'you were right'),
    slower: L('barry', 'slower'),
    slow: L('sunny', 'were... right'),
    thermo: L('barry', 'thermostat'),
    mtn1: L('doreen', 'the mountain'),
    vult: L('barry', 'vulture on my head'),
    mtn2: L('sunny', 'mountain, bro'),
    sohard: L('barry', 'so hard'),
    sign: L('gerald', 'clear sign'),
    thankG: L('doreen', 'thank you, gerald'),
    noReason: L('barry', 'no reason'),
    wave: L('barry', 'now they wave'),
    whole: L('barry', 'my whole life'),
    amChill: L('barry', 'am i chill'),
    welcome: L('sunny', 'welcome to chill'),
  };
  const B = (name) => { const b = K.beat(S, name); return { t0: b.t0, dur: b.dur, t1: b.t1 }; };   // static part only
  T.cover = B('gerald_covers_flag');
  T.fish = B('fish_float_by');
  T.orange = B('doreen_orange');
  // Sunny's slow impression: one savouring nod from Barry per word
  T.slowWords = ['You', 'were', 'right', 'bro'].map((x) => w(T.slow, x));
  T.wRight = w(T.right, 'right');
  T.wHead = w(T.vult, 'head');
  T.wThank = w(T.thankG, 'Thank');
  T.wNoReason = w(T.noReason, 'no');
  T.wCredit = w(T.whole, 'credit');
  T.wHomeless = w(T.whole, 'homeless');
  T.wChill = w(T.amChill, 'chill');
  T.wBro = w(T.welcome, 'bro');
  // the orange: Doreen turns, scoots, rears, tips her head → it rolls onto Barry's helmet
  const o0 = T.orange.t0;
  T.dTurn = o0 - 0.5;                 // squash turn to face Barry (kit keyed facing, .3 s)
  T.dScoot0 = o0 - 0.2; T.dScoot1 = o0 + 0.42;
  T.dRear0 = o0 + 0.1; T.dRear1 = o0 + 0.5;
  T.rel = o0 + 0.56;                  // the orange leaves her head
  T.land = o0 + 0.86;                 // ...and lands on the helmet
  T.dBack0 = o0 + 1.0; T.dBack1 = o0 + 1.9;
  m = T;
  MEMO.set(S.tl, m);
  return m;
}

// ─────────────────────────────────────────────────────────────── cameras
const FR = K.RIVER_FRAMINGS;
// After gerald_covers_flag the bunched banner hangs down to world y ≈ 316 right above Barry: every
// later close framing keeps its top edge below this line so no stray fragment of cloth pokes in.
const PILE_Y = 338;
// Barry close-ups: per instance zoom factor and where his eye sits on screen (kit: z4, eye (500, 455))
function cuStyle(I, T) {
  const t0 = I.shot.t0;
  const near = (x) => Math.abs(t0 - x) < 0.6;
  if (t0 < 0.5) return { z: 0.93, ex: 520, ey: 412, push: 0.012 };                 // the flat opening stare
  if (near(T.slower.s)) return { z: 1.0, ex: 505, ey: 410, push: 0.018 };           // savouring
  if (near(T.thermo.s)) return { z: 1.05, ex: 510, ey: 406, push: 0.01 };           // cross-exam 1
  if (near(T.vult.s)) return { z: 1.13, ex: 515, ey: 402, push: 0.01 };             // cross-exam 2 (a notch closer)
  if (near(T.sohard.s)) return { z: 0.98, ex: 505, ey: 412, push: 0.004 };          // the release
  if (near(T.noReason.s)) return { z: 1.07, ex: 515, ey: 398, push: 0.006 };        // the flail
  if (near(T.wave.s)) return { z: 1.07, ex: 520, ey: 398, push: 0.008 };            // = the opening stare
  if (near(T.amChill.s)) return { z: 0.76, ex: 700, ey: 330, push: 0.014, volcano: { x: 590, y: 352 } };  // Am I chill?
  return { z: 1, ex: 500, ey: 440, push: 0.004 };
}
function framings(T) {
  return {
    barry_cu: (I) => {
      const b = FR.barry_cu(I);
      const st = cuStyle(I, T);
      const eyeX = b.x - (640 - 500) / b.zoom, eyeY = b.y - (360 - 455) / b.zoom;
      const z = b.zoom * st.z;
      let y = eyeY + (360 - st.ey) / z;
      if (I.shot.t0 > T.cover.t0) y = Math.max(y, PILE_Y + 360 / z);
      const out = { x: eyeX + (640 - st.ex) / z, y, zoom: z, push: st.push, drift: 0.6, envVolcano: st.volcano || b.envVolcano };
      return out;
    },
    raft_wide: (I) => {
      const r = I.L && I.L.raft ? I.L.raft.opts : { x: 640, y: 520 };
      const t0 = I.shot.t0;
      const base = { x: r.x + 20, y: r.y - 152, zoom: 1.5, push: 0.005 };
      if (t0 < T.right.s) {
        // establishing: the whole quiet river, then a slow dolly in as Sunny speaks
        return { x: r.x + 30, y: r.y - 178, zoom: 1.16, push: 0, drift: 0.5, moves: [{ delay: 0.15, ease: 'inOutSine', to: { x: r.x + 26, y: r.y - 168, zoom: 1.34 } }] };
      }
      if (Math.abs(t0 - T.whole.s) < 1) {
        // the monologue: a gentle creep (Gerald stays in, smug, for "the credit"), then a push into a
        // two-shot of Barry + Doreen for the orange
        return {
          ...base, push: 0, drift: 0.35, moves: [
            { at: T.whole.s + 0.5, dur: T.whole.e - T.whole.s - 0.7, ease: 'inOutSine', to: { x: r.x + 80, y: r.y - 160, zoom: 1.9 } },
            // (top edge kept below the bunched banner: no stray cloth / tail at the frame edge)
            { at: T.dTurn - 0.2, dur: 1.15, ease: 'inOutSine', to: { x: r.x + 72, y: PILE_Y + 360 / 3.0 + 2, zoom: 3.0 } },
          ],
        };
      }
      if (t0 > T.amChill.e - 0.2) {
        // the end: Sunny scoots up to join them, then a slow pull back into the sunset
        return { ...base, push: 0, drift: 0.3, moves: [{ delay: 0.9, ease: 'inOutSine', to: { x: r.x + 110, y: r.y - 196, zoom: 1.1 } }] };
      }
      return base;
    },
    gerald_flag: (I) => ({ ...FR.gerald_flag(I), push: 0.003, drift: 0.2 }),
    fish: (I) => {
      const r = I.L && I.L.raft ? I.L.raft.opts : { x: 640, y: 520 };
      return { x: r.x - 30, y: r.y - 28, zoom: 2.15, push: 0.008, drift: 0.4 };
    },
  };
}

// ─────────────────────────────────────────────────────────────── the lily pad + fish
const PAD = { y: 606, x0: 805, v: 82 };         // world: drifts LEFT past the raft (the river runs right)
function padPos(S, T) {
  const u = S.t - T.fish.t0;
  return { x: PAD.x0 - PAD.v * u, y: PAD.y + Math.sin(S.T * 1.6) * 1.2, rot: Math.sin(S.T * 1.1) * 0.025 };
}
function drawLilyPad(ctx, x, y, rx, rot, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const ry = rx * 0.3;
  // ripple rings spreading from the pad
  for (let i = 0; i < 3; i++) {
    const ph = ((t * 0.45 + i / 3) % 1);
    ctx.beginPath();
    ctx.ellipse(0, 3, rx * (1.05 + ph * 0.55), ry * (1.05 + ph * 0.55), 0, 0, TAU);
    ctx.strokeStyle = `rgba(255,214,190,${(0.32 * (1 - ph)).toFixed(3)})`;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  // shadow under the pad
  ctx.beginPath();
  ctx.ellipse(2, 5, rx * 1.02, ry * 1.05, 0, 0, TAU);
  ctx.fillStyle = 'rgba(40,20,50,0.35)';
  ctx.fill();
  // the pad (a notch toward the viewer-left)
  const g = ctx.createLinearGradient(0, -ry, 0, ry);
  g.addColorStop(0, '#7FA05A');
  g.addColorStop(1, '#3F6A45');
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.ellipse(0, 0, rx, ry, 0, Math.PI * 0.62, Math.PI * 0.62 + TAU - 0.34);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#2C4A35';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // veins
  ctx.strokeStyle = 'rgba(200,230,150,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * 0.62 + 0.25 + i * ((TAU - 0.84) / 6);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * rx * 0.85, Math.sin(a) * ry * 0.85);
    ctx.stroke();
  }
  // warm sunset rim on the far edge
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, Math.PI * 1.1, Math.PI * 1.85);
  ctx.strokeStyle = 'rgba(255,190,140,0.75)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // a pink water-lily flower at the back
  ctx.translate(rx * 0.78, -ry * 0.05);
  for (let i = -2; i <= 2; i++) {
    ctx.save();
    ctx.rotate(i * 0.38);
    ctx.beginPath();
    ctx.moveTo(-3, 0);
    ctx.quadraticCurveTo(-5, -10, 0, -16);
    ctx.quadraticCurveTo(5, -10, 3, 0);
    ctx.closePath();
    ctx.fillStyle = i === 0 ? '#F6B3C8' : '#E88AA9';
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,60,90,0.6)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, -2, 2.6, 0, TAU);
  ctx.fillStyle = '#FFD86A';
  ctx.fill();
  ctx.restore();
}
function drawFishPad(ctx, st, S, T) {
  const f = T.fish;
  // only around the fish shot
  if (S.t < f.t0 - 0.05 || S.t > f.t1 + 0.05) return;
  const p = padPos(S, T);
  const s = 1.3;
  drawLilyPad(ctx, p.x, p.y, 74 * s, p.rot, S.T);
  // suitcases stacked (big at the bottom), at the back-left of the pad
  const sx = p.x - 40 * s, sy = p.y - 4;
  const cases = [[0, 0, 1.25, -0.02], [1, -14, 1.05, 0.05], [-1, -26, 0.85, -0.06]];
  for (const [dx, dy, sc, r] of cases) CR.drawTinySuitcase(ctx, sx + dx * s, sy + dy * s - 14 * sc, sc * s, r);
  // three fish standing on the pad, all facing right (back toward the raft), waving goodbye
  const fish = [
    { dx: -12, color: 'orange', seed: 1, sc: 0.95 },
    { dx: 22, color: 'teal', seed: 2, sc: 1.0 },
    { dx: 54, color: 'orange', seed: 3, sc: 0.9 },
  ];
  // ...at Barry, the one they never said goodbye to
  const bh = { x: 752, y: 425 };
  fish.forEach((q, i) => {
    const wv = clamp((S.t - f.t0 - 0.15 - i * 0.12) / 0.3);
    const fx = p.x + q.dx * s, dx = bh.x - fx, dy = bh.y - (p.y - 40), d = Math.hypot(dx, dy) || 1;
    CR.drawFish(ctx, {
      x: fx, y: p.y - 2, scale: q.sc * s * 0.92, flip: false, t: S.T + i * 0.7, seed: q.seed,
      color: q.color, stand: true, wave: wv, mood: 'happy', look: { x: clamp((dx / d) * 1.2, -1, 1), y: clamp((dy / d) * 1.4, -1, 1) },
    });
  });
}

// ─────────────────────────────────────────────────────────────── the orange
const ORANGE_SEED_D = 5.3;   // Doreen's rig seed (the worn orange's pores) — keep it through the pass
function orangeState(S, T) {
  if (S.t < T.rel) return 'doreen';
  if (S.t < T.land) return 'flight';
  return 'barry';
}
const LEAF = 0.3;             // the leaf's jaunty tilt once it sits on the helmet
function drawOrangeItem(ctx, st, S, T) {
  const state = orangeState(S, T);
  if (state === 'doreen') return;
  const bo = st.cast.barry && st.cast.barry.opts;
  if (!bo) return;
  const bA = K.castAnchors({ ...bo, accessories: { ...(bo.accessories || {}), orange: true } }).orange;
  if (!bA) return;
  const r = pos(bA.r, 9);
  const ba = fin(bA.angle, 0);
  if (state === 'flight') {
    // frozen start: Doreen's worn orange at the release frame
    const S2 = S.tl.sceneTime(S.id, S.scene.start + T.rel);
    const dOpts = K.castOpts(S2, 'doreen', doreenCfg(S2, T, true));
    const dA = K.castAnchors(dOpts).orange;
    if (!dA) return;
    const u = clamp((S.t - T.rel) / (T.land - T.rel));
    const k = ease.inOutSine(u);
    const p0 = { x: dA.x, y: dA.y }, p2 = { x: bA.x, y: bA.y };
    const p1 = { x: lerp(p0.x, p2.x, 0.5), y: Math.min(p0.y, p2.y) - 14 };
    const x = (1 - k) * (1 - k) * p0.x + 2 * (1 - k) * k * p1.x + k * k * p2.x;
    const y = (1 - k) * (1 - k) * p0.y + 2 * (1 - k) * k * p1.y + k * k * p2.y;
    const rr = lerp(pos(dA.r, r), r, k);
    // one forward roll on the way over, arriving exactly at the resting orientation
    const rot = lerp(fin(dA.angle, 0), ba + LEAF + TAU, k);
    CAP.drawCapyOrange(ctx, { x, y, r: rr, rot, t: S.T, seed: ORANGE_SEED_D, flip: false, tint: bo.tint, rim: bo.rim });
    return;
  }
  // on the helmet: a soft landing squash and one rock about its contact point, then it stays
  const u = S.t - T.land;
  const rock = u >= 0 ? 0.3 * Math.sin(u * 2.3 * TAU) * Math.exp(-u * 5.2) : 0;
  const sq = 0.3 * K.bump(u, 0, 0.16);
  const upx = Math.sin(ba), upy = -Math.cos(ba);
  const bx = bA.x - upx * r, by = bA.y - upy * r;          // contact point on the helmet
  const a = ba + rock;
  const cx = bx + Math.sin(a) * r, cy = by - Math.cos(a) * r;
  CAP.drawCapyOrange(ctx, { x: cx, y: cy, r, rot: a + LEAF, t: S.T, seed: ORANGE_SEED_D, squash: sq, flip: false, tint: bo.tint, rim: bo.rim });
}

// ─────────────────────────────────────────────────────────────── still smoking
// The opening close-up: a thin curl of smoke still rising from the vents of Barry's singed helmet,
// dying out over the shot (a little singed, deadpan, staring ahead).
function drawHelmetSmoke(ctx, st, S) {
  const t = S.t;
  const k = 1 - smoothstep(2.4, 3.6, t);
  if (k <= 0.01 || K.shot(S).index !== 0) return;
  const e = st.cast.barry;
  if (!e) return;
  const a = K.castAnchors(e.opts).headTop;
  const light = e.opts.tint ? { tint: e.opts.tint, rim: e.opts.rim } : undefined;
  for (let i = 0; i < 10; i++) {
    const life = ((t * 0.4 + i / 10) % 1 + 1) % 1;
    const x = a.x - 5 - life * 15 + Math.sin(t * 1.9 + life * 5) * 2.4 * life;
    const y = a.y + 1 - life * 30;
    P.drawSmokePuff(ctx, { x, y, r: 2.4 + life * 3.6, life: Math.min(0.92, life * 0.7 + 0.15), rise: 0.35, t: S.T, seed: 3 + i, alpha: 0.5 * k, tone: 'grey', light });
  }
}

// ─────────────────────────────────────────────────────────────── cast
// Barry's eye target toward a world point (rig look: x+ = toward the snout, he faces right)
const BARRY_EYE = { x: 752, y: 432 };
function lookToward(p, from = BARRY_EYE) {
  const dx = p.x - from.x, dy = p.y - from.y, d = Math.hypot(dx, dy) || 1;
  return [clamp((dx / d) * 1.2, -1, 1), clamp((dy / d) * 1.4, -1, 1)];
}
// Blend authored gaze layers over the kit's own gaze (so an override never pops the pupils):
// layers = [[w 0..1, {x, y} | {at: 'barry' | {x, y}}], ...] applied in order.
function mixLook(S, who, extra, layers) {
  const act = layers.filter(([w]) => w > 0.001);
  if (!act.length) return;
  const clean = { ...extra, look: undefined, lookAt: undefined };
  const base = K.castOpts(S, who, clean).look || { x: 0.3, y: 0 };
  let lx = base.x, ly = base.y;
  for (const [w, spec] of act) {
    let v = spec;
    if (spec.at) v = K.castOpts(S, who, { ...clean, lookAt: spec.at }).look || base;
    lx = lerp(lx, fin(v.x, lx), clamp(w)); ly = lerp(ly, fin(v.y, ly), clamp(w));
  }
  extra.look = { x: clamp(lx, -1, 1), y: clamp(ly, -1, 1) };
}
function barryCfg(S, T) {
  const t = S.t;
  const extra = {
    accessories: { helmet: true, soot: lerp(0.6, 0.42, smoothstep(2.0, 5.0, t)), orange: false },
    reactions: false, dart: false,
    rest: [[0, 'deadpan'], [T.wRight + 0.25, 'smug'], [T.sign.s + 0.3, 'deadpan'], [T.wThank + 0.05, 'shock'], [T.wThank + 0.75, 'worried'],
      [T.noReason.e + 0.5, 'deadpan'], [T.land + 0.35, 'chill']],
  };
  // the fish shot: flat, unimpressed (the panic of "no reason!" is over by the cut)
  if (t >= T.fish.t0 && t < T.wave.s) extra.mood = 'deadpan';
  // gaze — all authored: he never turns round, he answers the people behind him with his eyes
  const BACK = [-0.95, -0.05], FWD = [0.18, 0.08];
  const pad = padPos(S, T);
  const fishLook = lookToward({ x: pad.x + 10, y: pad.y - 20 });
  extra.look = saccades(t, [
    [0, FWD],
    [T.right.s + 0.3, [-0.85, -0.05], 0.3],                 // "Barry..." — he heard
    [T.slower.s - 0.1, [-0.9, -0.05]],                      // "Could you say it slower?"
    [T.slower.s + (T.slower.e - T.slower.s) * 0.55, [0.35, -0.35], 0.3],   // "...Like Doctor Shelley?" savouring
    [T.slow.s + 0.05, [-0.5, -0.3], 0.3],
    [T.thermo.s - 0.1, [0.45, -0.15], 0.2],                 // the question, delivered to the horizon
    [T.thermo.e - 0.35, BACK],                              // ...then the flick back: well?
    [T.mtn1.s + 0.1, [-1, 0.05], 0.12],
    [T.vult.s - 0.1, [0.45, -0.15], 0.2],
    [T.wHead - 0.08, [0.1, -1], 0.14],                      // "...on my HEAD?"
    [T.vult.e - 0.3, BACK, 0.16],
    [T.sohard.s - 0.05, [0.45, -0.65], 0.12],               // to the heavens
    [T.sohard.s + (T.sohard.e - T.sohard.s) * 0.58, BACK, 0.16],   // "Was that so hard?"
    [T.sign.s + 0.6, [-0.5, -0.9], 0.3],                    // (off screen) glaring up at the mast
    [T.wThank + 0.05, [-1, 0], 0.07],                       // the stolen thank-you
    [T.wNoReason - 0.12, [-0.55, -0.95], 0.14],
    [T.noReason.e + 0.15, [-0.4, 0.5], 0.3],
    [T.fish.t0 - 0.02, fishLook, 0.01],
    [T.fish.t0 + 1.0, lookToward({ x: pad.x + 10, y: pad.y - 20 }), 0.6],
    [T.wave.s - 0.1, [-0.55, 0.75], 0.1],                   // "Oh, now they wave."
    [T.wave.e + 0.05, [0.25, 0.3], 0.35],
    [T.wHomeless - 0.15, [0.15, 0.05], 0.3],
    [T.wCredit - 0.6, [-0.5, -0.85], 0.2],                  // "...the vulture's getting the credit"
    [T.whole.e + 0.1, [0.3, 0.35], 0.35],                   // the sigh into the water
    [T.land + 0.06, [0.05, -1], 0.1],                       // boop — what is that?
    [T.amChill.s + 0.5, [0.1, -0.9], 0.25],
    [T.wChill - 0.25, [0.6, -0.15], 0.4],                   // "Am I chill?" — into the sunset
    [T.welcome.s + 0.2, [-0.75, -0.05], 0.3],
    [T.wBro + 0.3, [0.45, -0.05], 0.4],
  ]);
  // lids: savouring Sunny's slow line with his eyes shut; blissed out at the very end
  const sav = K.fadeWindow(t, T.slow.s + 0.2, T.slow.e + 0.05, 0.35, 0.15);
  const end = smoothstep(T.wBro + 0.5, T.wBro + 1.5, t);
  // "...what's on my head?": lids lift for the orange (wider eyes make the upward roll read), then
  // settle back to the chill lids on "Am I chill?"
  const up = K.fadeWindow(t, T.land + 0.02, T.wChill - 0.05, 0.12, 0.45);
  if (sav > 0.001) extra.eyes = lerp(0.58, 0.06, sav);           // smug lids → shut
  else if (end > 0.001) extra.eyes = lerp(0.5, 0.08, end);       // chill lids → shut
  else if (up > 0.001) extra.eyes = lerp(0.52, 0.8, up);
  // head: chin up when vindicated, one savouring nod per slow word, an "mm-hm" per answer,
  // a disbelieving head-shake on "no reason!", the sigh, the orange
  let tilt = 0;
  tilt += 5 * smoothstep(T.wRight, T.wRight + 0.5, t) * (1 - smoothstep(T.slower.e, T.slower.e + 0.4, t));
  tilt += 6 * K.fadeWindow(t, T.slower.s + (T.slower.e - T.slower.s) * 0.5, T.slower.e + 0.1, 0.3, 0.2);
  tilt += 7 * sav;
  for (const wt of T.slowWords) tilt -= 6 * bump(t, wt - 0.05, 0.5);
  tilt += 4 * K.fadeWindow(t, T.thermo.s, T.thermo.e - 0.3, 0.2, 0.25) + 4 * K.fadeWindow(t, T.vult.s, T.wHead, 0.2, 0.2);
  tilt -= 6 * bump(t, T.mtn1.e - 0.15, 0.55) + 6 * bump(t, T.mtn2.e - 0.15, 0.55);
  tilt += 9 * K.fadeWindow(t, T.sohard.s - 0.05, T.sohard.s + (T.sohard.e - T.sohard.s) * 0.6, 0.15, 0.3);
  tilt += 4.5 * Math.sin((t - T.noReason.s) * TAU * 2.4) * K.fadeWindow(t, T.wNoReason - 0.5, T.noReason.e + 0.1, 0.15, 0.2);
  tilt -= 5 * bump(t, T.whole.e + 0.05, 0.9);
  tilt += 7 * bump(t, T.land + 0.04, 0.55) + 5 * K.fadeWindow(t, T.land + 0.3, T.wChill - 0.1, 0.4, 0.4);
  tilt += 3 * smoothstep(T.wChill - 0.3, T.wChill + 0.3, t);
  extra.tiltAdd = tilt;
  // takes: the release, the stolen thank-you, the orange landing ("boop"); the sigh
  const tk0 = K.take(t, T.sohard.s, { amount: 0.4, anticipation: 0.08 });
  const tk1 = K.take(t, T.wThank + 0.05, { amount: 0.8 });
  const tk2 = K.take(t, T.land, { amount: 0.3, anticipation: 0.03 });
  const sigh = bump(t, T.whole.e + 0.05, 0.9);
  extra.squash = {
    sx: tk0.sx * tk1.sx * tk2.sx * (1 + 0.025 * sigh),
    sy: tk0.sy * tk1.sy * tk2.sy * (1 - 0.04 * sigh),
    dy: tk0.dy + tk1.dy + tk2.dy,
  };
  return extra;
}
function sunnyCfg(S, T) {
  const t = S.t;
  const extra = {
    accessories: { orange: false, soot: 0.4 },
    rest: [[0, 'sad'], [T.sohard.e + 0.3, 'chill'], [T.fish.t0 + 0.1, 'happy'], [T.wave.e + 0.5, 'chill'], [T.whole.s + 0.8, 'sad'], [T.land + 0.25, 'happy']],
  };
  // the final shot: he scoots up to join them ("Welcome to chill, bro.")
  const sc0 = T.welcome.s - 0.15, sc1 = T.welcome.s + 0.75;
  const scK = clamp((t - sc0) / (sc1 - sc0));
  extra.seatX = lerp(-168, -108, ease.inOutSine(scK));
  const hop = t > sc0 && t < sc1 ? Math.abs(Math.sin(scK * Math.PI * 2)) : 0;
  // the Shelley impression: heavy lids, one slow nod per word
  const imp = K.fadeWindow(t, T.slow.s - 0.15, T.slow.e + 0.2, 0.25, 0.3);
  if (imp > 0.001) extra.eyes = lerp(0.5, 0.2, imp);
  let tilt = 0;
  for (const wt of T.slowWords) tilt -= 7 * imp * bump(t, wt - 0.1, 0.55);
  // reluctant pause before "...The mountain, bro.": eyes down and away, a sigh
  const rel = K.fadeWindow(t, T.mtn2.s - 0.72, T.mtn2.s + 0.3, 0.18, 0.3);
  tilt -= 6 * rel;
  const sigh = bump(t, T.mtn2.s - 0.62, 0.62);
  // the fish: a big happy "hey, little dudes" — head bobbing down at them
  const wv = K.fadeWindow(t, T.fish.t0 + 0.3, T.fish.t1 + 0.3, 0.25, 0.3);
  if (wv > 0.01) tilt += wv * (-7 + 5 * Math.sin((t - T.fish.t0) * TAU * 1.6));
  const pad = padPos(S, T);
  mixLook(S, 'sunny', extra, [[rel, { x: -0.6, y: 0.85 }], [wv, { at: { x: pad.x, y: pad.y - 30 } }]]);
  extra.tiltAdd = tilt;
  extra.squash = { sx: 1 + 0.03 * sigh, sy: (1 - 0.045 * sigh) * (1 - 0.04 * hop), dy: -7 * hop };
  return extra;
}
function doreenCfg(S, T, forceOrange = false) {
  const t = S.t;
  const hasOrange = forceOrange || t < T.rel;
  const extra = {
    accessories: { orange: hasOrange, juice: 0.3, soot: 0.35 },
    facing: [[0, 'left'], [T.dTurn, 'right']],
    rest: [[0, 'sad'], [T.thankG.s - 0.1, 'happy'], [T.thankG.e + 0.9, 'chill'], [T.fish.t0 + 0.2, 'happy'], [T.wave.e + 0.5, 'chill'],
      [T.whole.s + 0.6, 'sad'], [T.wCredit + 0.3, 'happy']],
  };
  // blocking: amidships facing Sunny → scoots up behind Barry for the orange, then eases back a touch
  extra.seatX = kf(t, [[T.dScoot0, -14], [T.dScoot1, 34], [T.dBack0, 34], [T.dBack1, 16]]);
  const sk = clamp((t - T.dScoot0) / (T.dScoot1 - T.dScoot0));
  const hop = t > T.dScoot0 && t < T.dScoot1 ? Math.abs(Math.sin(sk * Math.PI * 2)) : 0;
  // rearing up behind him (outside it she keeps the raft's own roll from the kit)
  const rear = kf(t, [[T.dRear0, 0], [T.dRear1, -0.36], [T.rel + 0.05, -0.36], [T.land + 0.1, -0.2], [T.dBack1, 0]]);
  if (Math.abs(rear) > 1e-4) extra.rot = rear;
  // the tip of the head that sends the orange rolling, then she watches it land
  let tilt = -16 * bump(t, T.rel - 0.18, 0.5) + 6 * bump(t, T.land + 0.05, 0.9);
  // reluctant pause before "...The mountain.": eyes down and away, a sigh
  const rel = K.fadeWindow(t, T.mtn1.s - 0.72, T.mtn1.s + 0.3, 0.18, 0.3);
  tilt -= 6 * rel;
  const sigh = bump(t, T.mtn1.s - 0.62, 0.62);
  // "Oh! Thank you, Gerald!" — up at him, beaming, a little hop of delight
  tilt += 9 * K.fadeWindow(t, T.thankG.s - 0.15, T.thankG.e + 0.6, 0.2, 0.4);
  const yay = K.take(t, T.thankG.s + 0.02, { amount: 0.35, anticipation: 0.06 });
  // the fish: a warm smile down at them
  const pad = padPos(S, T);
  const fw = K.fadeWindow(t, T.fish.t0 + 0.25, T.fish.t1 + 0.4, 0.15, 0.2);
  // watching the orange go, then Barry
  const ow = K.fadeWindow(t, T.rel - 0.3, T.land + 0.6, 0.12, 0.2);
  const bw = smoothstep(T.land + 0.45, T.land + 0.7, t);
  mixLook(S, 'doreen', extra, [[rel, { x: 0.8, y: 0.85 }], [fw, { at: { x: pad.x, y: pad.y - 30 } }], [ow, { x: 0.85, y: -0.2 }], [bw, { at: 'barry' }]]);
  extra.tiltAdd = tilt;
  extra.squash = { sx: yay.sx * (1 + 0.03 * sigh), sy: yay.sy * (1 - 0.045 * sigh) * (1 - 0.05 * hop), dy: yay.dy - 6 * hop };
  return extra;
}
function geraldCfg(S, T) {
  const t = S.t;
  const c = T.cover;
  if (t < c.t0) {
    // on the mast top: suspiciously interested in the sky after "a vulture on my head?" (the look
    // window opens and closes inside Barry's close-ups, where Gerald is off screen), puffed-up pride
    // and a nod on "Rather a clear sign", a happy little bow when Doreen thanks him
    const g = { on: 'mast' };
    const inno = K.fadeWindow(t, T.vult.e - 0.25, T.mtn2.e + 0.25, 0.3, 0.3);
    if (inno > 0.01) g.look = { x: lerp(0.4, 0.15, inno), y: lerp(0, -0.95, inno) };
    const proud = K.fadeWindow(t, T.sign.s + 1.5, T.sign.e + 0.4, 0.35, 0.4);
    if (proud > 0.01) { g.ruffle = 0.35 * proud; g.nod = 0.55 * bump(t, T.sign.e - 0.55, 0.7); }
    const bow = bump(t, T.wThank + 0.55, 0.75);
    if (t > T.thankG.s + 0.1) { g.mood = 'happy'; g.ruffle = Math.max(g.ruffle || 0, 0.3 * smoothstep(T.thankG.s, T.thankG.s + 0.3, t)); }
    if (bow > 0.01) g.nod = bow;
    return g;
  }
  // gerald_covers_flag: a quick preen, a shuffle-hop down onto the banner, a plop (the banner bunches
  // to "S.S.") and a smug look to camera
  const preen = bump(t, c.t0 + 0.01, 0.38);
  const hop0 = c.t0 + 0.3, hopD = 0.55;
  const settle = smoothstep(hop0 + hopD - 0.1, hop0 + hopD + 0.25, t);
  const g = { on: 'flag', hop: { t0: hop0, dur: hopD, from: 'mast', style: 'shuffle' }, mantle: 0 };
  if (preen > 0.01) g.preen = preen;
  g.ruffle = 0.25 * preen + 0.12 * settle;
  if (settle > 0.01) g.settle = 0.5 * settle;
  if (t > hop0 + hopD) {
    g.mood = 'smug';
    // the look to camera after the plop (held into the next shots only until Barry erupts)
    const cam = K.fadeWindow(t, hop0 + hopD + 0.2, T.noReason.s, 0.15, 0.2);
    if (cam > 0.01) g.look = { x: lerp(0.75, -0.1, cam), y: lerp(0, 0.05, cam) };
    // "...and the vulture's getting the credit": a proud little puff
    const proud = bump(t, T.wCredit + 0.15, 0.9);
    if (proud > 0.01) { g.ruffle = 0.12 + 0.35 * proud; g.nod = 0.6 * proud; }
    // the very end: everybody chill, Gerald dozes
    const doze = smoothstep(T.welcome.s + 0.6, T.welcome.e + 0.6, t);
    if (doze > 0.5) g.mood = 'sleepy';
  }
  return g;
}

// ─────────────────────────────────────────────────────────────── render
module.exports = {
  render(ctx, t, S) {
    const T = timing(S);
    const sh = K.shot(S);
    const env = {
      ash: 0.35,
      sunset: lerp(0.0, 0.42, clamp(t / S.duration)),
    };
    // the per-shot sun cheat (kept fixed within the shot: it is part of the cached background)
    if (sh.name === 'barry_cu' && Math.abs(sh.t0 - T.amChill.s) < 0.6) env.sun = { x: 880, y: 372 };
    const fr = framings(T);
    K.drawRaftStage(ctx, t, S, {
      env,
      raft: { dir: 1, wake: 0.4 },
      cast: { barry: barryCfg(S, T), sunny: sunnyCfg(S, T), doreen: doreenCfg(S, T) },
      gerald: geraldCfg(S, T),
      framings: fr,
      hooks: {
        afterCast: (c, st) => {
          drawHelmetSmoke(c, st, S);
          drawFishPad(c, st, S, T);
          drawOrangeItem(c, st, S, T);
        },
      },
    });
  },
};
