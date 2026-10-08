'use strict';
/* eslint-disable no-mixed-operators */
/*
 * env_spring.js — SNOOZE SPRINGS (spring_day / spring_evening / eruption / new_spring)
 * ===================================================================================
 * All drawing is in 1280x720 design ("world") units; the default framing is camera (640,360)
 * zoom 1. Backgrounds paint the world rect x -420..1700, y -440..1140 (SPRING.world) so the
 * camera can zoom out to ~0.8 or pan ~300 units without showing void.
 * Every function is a pure function of its inputs (t = seconds, any clock; it only drives idle
 * motion). Randomness is seeded; static geometry is baked once into Path2D objects at load.
 * ctx state is always restored. Cost at 1920x1080: ~15-25 ms per background frame.
 *
 * LAYERING (per frame, inside the scene's withCamera):
 *   1. drawSpringDay / drawSpringEvening / drawNewSpring    everything BEHIND the swimmers
 *   2. scene draws EXIT signs, raft, characters (optionally waterlineRipple(...{part:'back'}) first)
 *   3. drawWaterFront(ctx, t, {setting, swimmers, ...same o})  translucent front water
 *   4. drawSpringOverlay(ctx, t, {setting, ...same o})        optional: front steam, ash, embers,
 *                                                             rumble dust, eruption flash/grade
 *   5. (outside withCamera) drawForegroundFoliage(ctx, t, o)  optional screen-edge framing leaves
 *
 * COMMON OPTIONS `o` (all optional):
 *   volcanoSmoke 0..1 (default 0.3)  lazy smoke wisp from Mount Snooze (0 = none)
 *   waterHeat    0..1 (default 0.2)  steam density + bubbles; ~0.5 simmering; 1 = rolling boil
 *                                    with big bubble domes and splashes
 *   rumble       0..1 (default 0)    shaking leaves, falling dust & leaves, ripple rings on the water
 *                                    (camera shake is the scene's job: withCamera({shake}))
 *   erupt        0..1 (default 0)    0 dormant | .05-.2 crater glow + thick smoke | .2-.6 explosive
 *                                    plume, lava fountains, red-orange sky, flashes (big flash spike
 *                                    at erupt≈0.21) | .6-1 glowing lava rivers down the left flank
 *   lava         0..1 (default 0)    lava reaches the back-right bank (0-.3), pours over the rim
 *                                    (.3-.45) and spreads over the pool as hissing crust (.45-1)
 *   signBurn     0..1 (default 0)    sets the "No Worries Allowed" sign on fire
 *   dusk         0..1 (evening)      0 golden hour → 1 dusky pink/purple
 *   sign         bool (default true) draw the wooden sign on the right bank
 *   moorPost     bool                stake + rope on the river bank at raftMoor (default false;
 *                                    true for drawNewSpring)
 *   birds        bool (default true) tiny birds in the day sky (auto-off while erupting)
 *   skyTint      [hex, amount]       extra colour mixed into the sky
 *
 * EXPORTS
 *   drawSpringDay(ctx, t, o)      morning Snooze Springs (everything behind the swimmers)
 *   drawSpringEvening(ctx, t, o)  same place at golden hour; o.dusk 0..1 → dusky pink/purple
 *   drawNewSpring(ctx, t, o)      epilogue: rolling hills, flowers, pretty rim, a tiny innocent hill
 *                                 (no volcano), sign "SNOOZE SPRINGS 2 — Barry Approved" + painted
 *                                 check, river + mooring post at the left. o: waterHeat, rumble,
 *                                 moorPost (default true), raft (default false; true draws
 *                                 props.drawRaft at NEW_SPRING.raftMoor if props.js provides it),
 *                                 hillPuff 0..1 (gag: the tiny hill burps one tiny smoke puff)
 *   drawWaterFront(ctx, t, o)     FRONT water layer, drawn AFTER characters. o.setting: 'day'|'evening'|
 *                                 'new' (or 'spring_day'|'spring_evening'|'new_spring') + the same o as
 *                                 the background (dusk/erupt/lava/waterHeat/rumble).
 *                                 o.swimmers: [{x, y, w, depth, scale, ripple}] — y = that body's
 *                                 waterline, w = body width at the waterline (default 270*scale),
 *                                 depth = how far below the waterline is covered (default 190*scale),
 *                                 scale defaults to SPRING.depthScale(y). Default = the trio's swim
 *                                 spots. o.opacity (0.7) = water opacity over submerged bodies.
 *                                 Adds a waterline highlight, contact shadow, refraction bands and
 *                                 front ripple rings per swimmer (ripple:false to skip).
 *   waterlineRipple(ctx, x, y, w, t, {amp=1, speed=1, part='front'|'back'|'both', color})
 *                                 rings spreading from a body of width w floating at waterline y.
 *                                 'back' goes BEFORE the character, 'front' after (drawWaterFront
 *                                 already does 'front' for its swimmers).
 *   drawSpringOverlay(ctx, t, o)  in front of characters: front steam veil (waterHeat > .35), ash +
 *                                 embers (erupt/lava), rumble dust, eruption flashes. o.grade 0..1
 *                                 (default 0) multiplies a setting colour grade over everything.
 *   drawForegroundFoliage(ctx, t, o)  SCREEN-SPACE framing leaves (call outside withCamera).
 *                                 o: sides 'both'|'left'|'right', top bool (default false), amount 0..1,
 *                                 setting/dusk/erupt (colour), rumble.
 *   drawMountSnooze(ctx, t, o)    the volcano alone (+smoke/eruption) for other settings: o.x, o.y
 *                                 (where the PEAK goes), o.scale, erupt, volcanoSmoke, setting, dusk.
 *   drawEruption(ctx, t, o)       only the eruption elements (smoke, plume, fountains, lava rivers) in
 *                                 Snooze Springs coordinates, for custom compositions.
 *   drawSnoozeSign(ctx, t, o)     the wooden sign alone: {x, y (ground under the posts), scale, burn,
 *                                 lines:[big, small], check:bool, setting, dusk}.
 *   fallingRocks(t, {t0, count, area:{x0,x1,yTop,yGround}, seed, dur, size:[r0,r1], g})
 *                                 → [{i, x, y, r, rot, glow, active, landed, impactT, start, inWater,
 *                                 sink, vx, vy, landX, landY}]. Rock i starts at t0 + rand*dur, lands
 *                                 at impactT (sync 'bonk' sfx to it). yGround: number or [min,max].
 *   drawFallingRocks(ctx, t, opts)  draws them (smoke trail, glow, splash in the pool / dust puff on
 *                                 land); returns the same array. opts as fallingRocks + {splash}.
 *   drawAsh(ctx, t, {density=1, area:{x0,x1,y0,y1}, wind})    drifting ash flakes
 *   drawEmbers(ctx, t, {density=1, area:{x0,x1,y0,y1}})        rising glowing embers
 *   drawSteam(ctx, t, {x, y, w, amount, h, scale, color, seed}) steam rising from a strip centred at
 *                                 x, w wide, surface at y; amount 0..2
 *   drawBubbles(ctx, t, {x, y, w, h, amount, scale, seed, color})  bubbles in a band centred (x,y);
 *                                 amount > 0.55 adds big boiling domes + splashes
 *   inPool(x, y)                  true if (x,y) is on the water (pool or outflow river)
 *   SPRING / NEW_SPRING           world anchors (below); SPRING.depthScale(y) → suggested character
 *                                 scale for a swimmer whose waterline is at y (1.0 at y=600)
 *   lab                           showcase sheets for src/lab.js
 *
 * ANCHORS (SPRING; NEW_SPRING shares the pool coordinates):
 *   waterY 458 = back edge of the pool surface; pool x≈160..1197, front edge y≈812 (off frame)
 *   swimSpots: sunny {360,590}  barry {650,600}  doreen {945,588, flip}  (y = waterline; each has a
 *              suggested scale & flip) + extras: 4 spots near the back of the pool
 *   riverMouth {150,596}  raftMoor {70,596}  moorPost {122,548}
 *   exitSignSpots: 3 ground points on the back-left bank (x 182..400, y 452..446) — signs point left
 *   escapePath: [{x,y}...] pool centre → past the EXIT signs → raft
 *   signPos {1150,446} (ground under the sign; the board spans ≈ y 318..410, x 1043..1257)
 *   volcanoPeak {860,150}  craterPos {860,150,w:110}  lavaEntry {990,468}  thermometerSpot {770,598}
 */

const { Path2D } = require('@napi-rs/canvas');
const U = require('./util');
const { TAU, clamp, lerp, smoothstep, rng, hash1, hash2, noise1, mix, rgba, ellipse, circle, roundRect, blob, withCamera } = U;

const WX0 = -420, WX1 = 1700, WY0 = -440, WY1 = 1140;
const PI = Math.PI;
const KAPPA = 0.5522847498;

// =====================================================================================
// geometry helpers (work on a CanvasRenderingContext2D or a Path2D)
// =====================================================================================
function splineTo(p, pts, tension = 1) {
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    p.bezierCurveTo(
      p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension,
      p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension,
      p2[0], p2[1]);
  }
}
function polyTo(p, pts) { for (let i = 0; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); }
function polyP(p, pts, ox = 0, oy = 0) {
  p.moveTo(pts[0][0] + ox, pts[0][1] + oy);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0] + ox, pts[i][1] + oy);
  p.closePath();
}
function circleP(p, x, y, r) {
  const k = r * KAPPA;
  p.moveTo(x + r, y);
  p.bezierCurveTo(x + r, y + k, x + k, y + r, x, y + r);
  p.bezierCurveTo(x - k, y + r, x - r, y + k, x - r, y);
  p.bezierCurveTo(x - r, y - k, x - k, y - r, x, y - r);
  p.bezierCurveTo(x + k, y - r, x + r, y - k, x + r, y);
  p.closePath();
}
function ellipseP(p, x, y, rx, ry) {
  const kx = rx * KAPPA, ky = ry * KAPPA;
  p.moveTo(x + rx, y);
  p.bezierCurveTo(x + rx, y + ky, x + kx, y + ry, x, y + ry);
  p.bezierCurveTo(x - kx, y + ry, x - rx, y + ky, x - rx, y);
  p.bezierCurveTo(x - rx, y - ky, x - kx, y - ry, x, y - ry);
  p.bezierCurveTo(x + kx, y - ry, x + rx, y - ky, x + rx, y);
  p.closePath();
}
// closed smooth blob through points (no beginPath — appends to p)
function blobP(p, pts, ox = 0, oy = 0) {
  const n = pts.length;
  p.moveTo(pts[0][0] + ox, pts[0][1] + oy);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    p.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6 + ox, p1[1] + (p2[1] - p0[1]) / 6 + oy,
      p2[0] - (p3[0] - p1[0]) / 6 + ox, p2[1] - (p3[1] - p1[1]) / 6 + oy, p2[0] + ox, p2[1] + oy);
  }
  p.closePath();
}
function newPath(fn) { const p = new Path2D(); fn(p); return p; }
function closedSpline(pts, n) {
  const N = pts.length, out = [];
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    for (let k = 0; k < n; k++) {
      const s = k / n, u = 1 - s, a = u * u * u, b = 3 * u * u * s, c = 3 * u * s * s, d = s * s * s;
      out.push([a * p1[0] + b * c1x + c * c2x + d * p2[0], a * p1[1] + b * c1y + c * c2y + d * p2[1]]);
    }
  }
  return out;
}
function openSpline(pts, n) {
  const N = pts.length, out = [];
  for (let i = 0; i < N - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(N - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    for (let k = 0; k < n; k++) {
      const s = k / n, u = 1 - s, a = u * u * u, b = 3 * u * u * s, c = 3 * u * s * s, d = s * s * s;
      out.push([a * p1[0] + b * c1x + c * c2x + d * p2[0], a * p1[1] + b * c1y + c * c2y + d * p2[1]]);
    }
  }
  out.push(pts[N - 1].slice());
  return out;
}
function pointInPoly(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// Sutherland–Hodgman clip of a polygon to the slab y0 <= y <= y1
function clipEdge(pts, inside, inter) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i], prev = pts[(i + pts.length - 1) % pts.length];
    const ci = inside(cur), pi = inside(prev);
    if (ci) { if (!pi) out.push(inter(prev, cur)); out.push(cur); } else if (pi) out.push(inter(prev, cur));
  }
  return out;
}
const atY = (y) => (a, b) => [a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]), y];
function slab(poly, y0, y1) {
  const a = clipEdge(poly, (q) => q[1] >= y0, atY(y0));
  return a.length ? clipEdge(a, (q) => q[1] <= y1, atY(y1)) : a;
}
// horizontal colour bands of a polygon (baked): [{y (centre), path}]
function bandsOf(poly, y0, y1, step) {
  // step: number (uniform) or an explicit array of band edges
  const edges = Array.isArray(step) ? step : [];
  if (!edges.length) for (let y = y0; y <= y1; y += step) edges.push(y);
  const out = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const a = edges[i], b = edges[i + 1];
    const pts = slab(poly, a - 0.9, b + 0.9);
    if (pts.length >= 3) out.push({ y: (a + b) / 2, path: newPath((p) => polyP(p, pts)) });
  }
  return out;
}
function polyLength(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return cum;
}
function partial(pts, cum, p) {
  if (p >= 1) return pts;
  const L = cum[cum.length - 1] * clamp(p);
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (cum[i] <= L) { out.push(pts[i]); continue; }
    const k = (L - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    out.push([lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]);
    break;
  }
  return out;
}
function qpt(x0, y0, cx, cy, x1, y1, s) {
  const u = 1 - s;
  return [u * u * x0 + 2 * u * s * cx + s * s * x1, u * u * y0 + 2 * u * s * cy + s * s * y1];
}
function qtan(x0, y0, cx, cy, x1, y1, s) {
  const u = 1 - s;
  const dx = 2 * u * (cx - x0) + 2 * s * (x1 - cx), dy = 2 * u * (cy - y0) + 2 * s * (y1 - cy);
  const d = Math.hypot(dx, dy) || 1;
  return [dx / d, dy / d];
}
// tapered ribbon along a polyline (appends a closed subpath)
function ribbonP(p, pts, w0, w1, wfn) {
  const n = pts.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const q = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const s = i / Math.max(1, n - 1);
    const w = (wfn ? wfn(s) : lerp(w0, w1, s)) / 2;
    L.push([q[0] - dy * w, q[1] + dx * w]); R.push([q[0] + dy * w, q[1] - dx * w]);
  }
  p.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) p.lineTo(L[i][0], L[i][1]);
  for (let i = n - 1; i >= 0; i--) p.lineTo(R[i][0], R[i][1]);
  p.closePath();
}
function ribbon(ctx, pts, w0, w1, wfn) { ctx.beginPath(); ribbonP(ctx, pts, w0, w1, wfn); }
// Serrated (or smooth) leaf along a quadratic spine. Returns {A, B, S} edge point arrays.
function leafPts(x0, y0, cx, cy, x1, y1, W, n, serr, prof) {
  const S = [], A = [], B = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const q = qpt(x0, y0, cx, cy, x1, y1, s), tn = qtan(x0, y0, cx, cy, x1, y1, s);
    const nx = -tn[1], ny = tn[0];
    S.push(q);
    if (i === 0 || i === n) continue;
    const w = W * (prof ? prof(s) : Math.pow(Math.sin(PI * Math.min(1, s * 1.06)), 0.65) * (1 - s * 0.2));
    if (serr) {
      const tip = i % 2 === 1, k = tip ? 1 : 0.3, back = tip ? w * 0.5 : 0;
      A.push([q[0] + nx * w * k + tn[0] * back, q[1] + ny * w * k + tn[1] * back]);
      B.push([q[0] - nx * w * k + tn[0] * back, q[1] - ny * w * k + tn[1] * back]);
    } else {
      A.push([q[0] + nx * w, q[1] + ny * w]);
      B.push([q[0] - nx * w, q[1] - ny * w]);
    }
  }
  return { S, A, B };
}
// add a two-tone leaf to paths: full shape → dark, the upward-facing half → light, spine → rib
function addLeaf(dark, light, rib, L) {
  const { S, A, B } = L;
  const n = S.length - 1;
  dark.moveTo(S[0][0], S[0][1]); polyTo(dark, A); dark.lineTo(S[n][0], S[n][1]);
  for (let i = B.length - 1; i >= 0; i--) dark.lineTo(B[i][0], B[i][1]);
  dark.closePath();
  const mid = A.length >> 1;
  const up = A[mid][1] < B[mid][1] ? A : B;
  light.moveTo(S[0][0], S[0][1]); polyTo(light, up); light.lineTo(S[n][0], S[n][1]);
  for (let i = n - 1; i >= 1; i--) light.lineTo(S[i][0], S[i][1]);
  light.closePath();
  if (rib) { rib.moveTo(S[0][0], S[0][1]); polyTo(rib, S.slice(1)); }
}
function sway(t, seed, amp, freq, rumble = 0) {
  return Math.sin(t * freq + seed * 1.37) * amp + noise1(t * freq * 0.41 + seed * 3.7) * amp * 0.7 +
    (rumble > 0 ? noise1(t * 19 + seed * 7.1) * rumble * 0.09 : 0);
}
const frac = (x) => x - Math.floor(x);
const bump = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (w * w));
function stopsColor(stops, y) {
  if (y <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (y <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (y - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
  }
  return stops[stops.length - 1][1];
}

// =====================================================================================
// palettes
// =====================================================================================
// base (ungraded, daylight) colours; P.g(hex, far) grades them for the current light
const C = {
  mtn: '#93B9C6', hillFar: '#76AA95', volcLit: '#9C9DB5', volcLitLo: '#878BA3', volcShade: '#5B5D78',
  volcDark: '#44465E', volcRim: '#C4C3D6', crater: '#2E2836',
  jDeep: '#2C6643', jMid: '#3F8A55', jLight: '#5FAF6A', jPale: '#8CCB7A', jLime: '#B4DC7E', jTeal: '#2F7A5E',
  jFar: '#4C8F72', jFarDeep: '#3D7A61',
  trunk: '#6E5646', trunkDark: '#4A3B33', trunkLight: '#9C826B', palm: '#A68A6A', palmDark: '#7A634C', palmRing: '#665140',
  ground: '#86BF68', groundMid: '#6CAA57', groundDark: '#548F4B', dirt: '#93724F',
  rock: '#ADA392', rockShade: '#857B6E', rockDark: '#5F574F', rockLight: '#D8CFBD', moss: '#77AE57', mossLight: '#A8D372',
  wood: '#B57E4C', woodDark: '#82552F', woodLight: '#D9A46E', woodDeep: '#5A3820', paint: '#FFF4DA', paint2: '#C4F2E6',
  fPink: '#FF8DB0', fYellow: '#FFD54A', fWhite: '#FFF8EE', fPurple: '#B9A0FF', fRed: '#FF6A55', fOrange: '#FFA03A',
  coconut: '#6E5034',
};
const PAL = {
  day: {
    skyTop: '#4FA8E0', skyMid: '#8CCEEE', skyBot: '#F7EBCF', sunX: 300, sunY: -40, sunCol: '#FFF7D6', sunA: 0.55, sunDisc: 0,
    haze: '#C4E2EA', hazeAmt: 0.85, tint: '#FFFFFF', tintAmt: 0, shadow: '#1A2238', dark: 0,
    rim: '#FFF6D8', rimA: 0.32, cloud: '#FFFFFF', cloudShade: '#D2E4F1',
    w0: '#A9EAE0', w1: '#66CFCA', w2: '#3CADB5', w3: '#2A8697', wHi: '#DCFBF5', wRefl: '#2C7A73',
    steam: '#FFFFFF', rays: 1, glow: 0,
  },
  gold: {
    skyTop: '#7E82C4', skyMid: '#EFAD88', skyBot: '#FFD994', sunX: 330, sunY: 236, sunCol: '#FFE3A0', sunA: 0.75, sunDisc: 1,
    haze: '#EEC298', hazeAmt: 0.8, tint: '#FF9C45', tintAmt: 0.17, shadow: '#2A1838', dark: 0.07,
    rim: '#FFD98A', rimA: 0.78, cloud: '#FFE2B6', cloudShade: '#DE9A92',
    w0: '#F5CC9E', w1: '#87C6BB', w2: '#4E9AA5', w3: '#2F6F87', wHi: '#FFECC6', wRefl: '#34565E',
    steam: '#FFF2DE', rays: 0.85, glow: 0.4,
  },
  dusk: {
    skyTop: '#46397A', skyMid: '#B4668E', skyBot: '#F7A26B', sunX: 330, sunY: 318, sunCol: '#FF9C6C', sunA: 0.55, sunDisc: 0.55,
    haze: '#A5759C', hazeAmt: 0.85, tint: '#7D4A8C', tintAmt: 0.3, shadow: '#1B1330', dark: 0.24,
    rim: '#FFA48E', rimA: 0.55, cloud: '#F2A6A2', cloudShade: '#7A5A8A',
    w0: '#E2A2AA', w1: '#7593B1', w2: '#4D6C93', w3: '#304B73', wHi: '#FFD2C8', wRefl: '#2B2F52',
    steam: '#F8E4EE', rays: 0.2, glow: 0.2,
  },
  fresh: {
    skyTop: '#47ACEA', skyMid: '#8DD6F5', skyBot: '#FFF3D4', sunX: 520, sunY: 92, sunCol: '#FFF6CF', sunA: 0.6, sunDisc: 1,
    haze: '#D0EAF0', hazeAmt: 0.8, tint: '#FFF1C8', tintAmt: 0.05, shadow: '#1A2238', dark: 0,
    rim: '#FFF8DC', rimA: 0.35, cloud: '#FFFFFF', cloudShade: '#D3E7F4',
    w0: '#B6F1E7', w1: '#6CD9D3', w2: '#40B9C0', w3: '#2C92A6', wHi: '#E6FFFB', wRefl: '#3A8C84',
    steam: '#FFFFFF', rays: 0.6, glow: 0,
  },
};
function lerpPal(a, b, k) {
  const out = {};
  for (const key in a) {
    const va = a[key], vb = b[key];
    out[key] = typeof va === 'number' ? lerp(va, vb, k) : mix(va, vb, k);
  }
  return out;
}
const palCache = new Map();
// setting: 'day' | 'evening' | 'new'. Cached per quantised input (pure function of constants).
function palette(setting, dusk = 0, erupt = 0, skyTint) {
  const q = (v) => Math.round(clamp(v) * 64);
  const key = setting + '|' + q(dusk) + '|' + q(erupt) + '|' + (skyTint ? skyTint[0] + q(skyTint[1]) : '');
  let P = palCache.get(key);
  if (P) return P;
  if (setting === 'evening') P = lerpPal(PAL.gold, PAL.dusk, q(dusk) / 64);
  else if (setting === 'new') P = Object.assign({}, PAL.fresh);
  else P = Object.assign({}, PAL.day);
  const er = q(erupt) / 64;
  const E = smoothstep(0.1, 0.5, er);
  P.E = E;
  P.erupt = er;
  if (E > 0) {
    P.skyTop = mix(P.skyTop, '#2A1216', 0.88 * E);
    P.skyMid = mix(P.skyMid, '#7A2A1E', 0.82 * E);
    P.skyBot = mix(P.skyBot, '#FF7A35', 0.78 * E);
    P.haze = mix(P.haze, '#7A3A34', E);
    P.hazeAmt = lerp(P.hazeAmt, 0.6, E);
    P.tint = mix(P.tint, '#C8381C', E);
    P.tintAmt = lerp(P.tintAmt, 0.24, E);
    P.shadow = mix(P.shadow, '#22080E', E);
    P.dark = lerp(P.dark, 0.5, E);
    P.cloud = mix(P.cloud, '#6A4440', E);
    P.cloudShade = mix(P.cloudShade, '#3A2428', E);
    P.rim = mix(P.rim, '#FF8A3A', E);
    P.rimA = lerp(P.rimA, 0.7, E);
    P.w0 = mix(P.w0, '#E07A44', 0.75 * E);
    P.w1 = mix(P.w1, '#4E5E5A', 0.65 * E);
    P.w2 = mix(P.w2, '#30464C', 0.65 * E);
    P.w3 = mix(P.w3, '#1C2C36', 0.65 * E);
    P.wHi = mix(P.wHi, '#FFB27A', 0.7 * E);
    P.wRefl = mix(P.wRefl, '#2A1A1A', 0.6 * E);
    P.steam = mix(P.steam, '#E8D6D0', E);
    P.sunA *= 1 - E; P.sunDisc *= 1 - E; P.rays *= 1 - E;
    P.glow = Math.max(P.glow, E);
  }
  if (skyTint) {
    const [c, a] = skyTint;
    P.skyTop = mix(P.skyTop, c, a); P.skyMid = mix(P.skyMid, c, a); P.skyBot = mix(P.skyBot, c, a);
  }
  const memo = new Map();
  P.g = (hex, far = 0) => {
    const k = hex + far;
    let v = memo.get(k);
    if (v !== undefined) return v;
    let c = hex;
    if (far > 0) c = mix(c, P.haze, clamp(far * P.hazeAmt));
    if (P.tintAmt > 0) c = mix(c, P.tint, P.tintAmt);
    if (P.dark > 0) c = mix(c, P.shadow, P.dark * (1 - far * 0.6));
    memo.set(k, c);
    return c;
  };
  P.hl = (hex, far = 0, k = 1) => {
    const kk = 'h' + hex + far + '|' + k;
    let v = memo.get(kk);
    if (v !== undefined) return v;
    v = mix(P.g(hex, far), P.rim, clamp(P.rimA * k * (1 - far * 0.5)));
    memo.set(kk, v);
    return v;
  };
  // banded gradients (cheap solid fills instead of gradient shaders)
  const skyStops = [[-60, P.skyTop], [232, P.skyMid], [456, P.skyBot]];
  const pall = smoothstep(0.22, 0.6, er);
  P.skyBands = SKY_BANDS.map((b) => {
    const yc = b[0] + b[1] / 2, c = stopsColor(skyStops, yc);
    return pall > 0 ? mix(c, '#24141A', pall * 0.75 * clamp(1 - (yc + 60) / 360)) : c;
  });
  if (pall > 0) P.skyTop = mix(P.skyTop, '#24141A', pall * 0.75);
  const wStops = [[456, P.w0], [494, P.w1], [620, P.w2], [812, P.w3]];
  P.waterBand = (y) => stopsColor(wStops, y);
  P.poolCols = POOL_BANDS.map((b) => P.waterBand(b.y));
  P.riverCols = RIVER_BANDS.map((b) => P.waterBand(b.y));
  if (palCache.size > 4000) palCache.clear();
  palCache.set(key, P);
  return P;
}
function normSetting(s) {
  if (!s) return 'day';
  if (s === 'spring_evening' || s === 'evening') return 'evening';
  if (s === 'new_spring' || s === 'new') return 'new';
  return 'day';
}
function opts(o, setting) {
  o = o || {};
  return {
    setting,
    volcanoSmoke: o.volcanoSmoke ?? 0.3,
    waterHeat: clamp(o.waterHeat ?? 0.2),
    rumble: clamp(o.rumble ?? 0),
    erupt: clamp(o.erupt ?? 0),
    lava: clamp(o.lava ?? 0),
    signBurn: clamp(o.signBurn ?? 0),
    dusk: clamp(o.dusk ?? 0),
    sign: o.sign !== false,
    moorPost: o.moorPost ?? setting === 'new',
    birds: o.birds ?? true,
    skyTint: o.skyTint,
    raft: !!o.raft,
    hillPuff: clamp(o.hillPuff ?? 0),
    grade: o.grade ?? 0,
  };
}

// =====================================================================================
// world layout + anchors
// =====================================================================================
const POOL_PTS = [
  [158, 544], [192, 514], [258, 492], [350, 475], [470, 464], [610, 458], [760, 456], [900, 458],
  [1020, 463], [1104, 473], [1160, 491], [1190, 526], [1197, 588], [1185, 655], [1158, 722],
  [1100, 778], [900, 804], [640, 812], [400, 806], [268, 778], [226, 730], [208, 684], [166, 652],
];
const POOL_DENSE = closedSpline(POOL_PTS, 12);
const RIVER_TOP = [[238, 534], [180, 556], [112, 562], [20, 565], [-120, 568], [-470, 574]];
const RIVER_BOT = [[-470, 640], [-120, 634], [20, 630], [110, 628], [176, 634], [236, 662]];
const RIVER_DENSE = openSpline(RIVER_TOP, 6).concat(openSpline(RIVER_BOT, 6));
function inPool(x, y) { return pointInPoly(POOL_DENSE, x, y) || pointInPoly(RIVER_DENSE, x, y); }
const SPAN = (() => {
  const tab = [];
  for (let y = 450; y <= 820; y += 2) {
    let x0 = Infinity, x1 = -Infinity;
    for (let i = 0, j = POOL_DENSE.length - 1; i < POOL_DENSE.length; j = i++) {
      const a = POOL_DENSE[i], b = POOL_DENSE[j];
      if ((a[1] > y) !== (b[1] > y)) {
        const x = a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      }
    }
    tab.push(x0 < x1 ? [x0, x1] : null);
  }
  return tab;
})();
function poolSpan(y) { const i = Math.round((y - 450) / 2); return i >= 0 && i < SPAN.length ? SPAN[i] : null; }
const BACK = (() => {
  const tab = [];
  for (let x = 100; x <= 1240; x += 4) {
    let best = Infinity;
    for (const p of POOL_DENSE) if (Math.abs(p[0] - x) < 6 && p[1] < 640) best = Math.min(best, p[1]);
    tab.push(best === Infinity ? null : best);
  }
  return tab;
})();
function backY(x) { const i = Math.round((x - 100) / 4); return i >= 0 && i < BACK.length && BACK[i] != null ? BACK[i] : 470; }
const depthScale = (y) => clamp(1 + (y - 600) * 0.0028, 0.55, 1.3);

const SPRING = {
  world: { x0: WX0, x1: WX1, y0: WY0, y1: WY1 },
  waterY: 458,
  pool: { x0: 160, x1: 1197, backY: 456, frontY: 812 },
  depthScale,
  swimSpots: {
    sunny: { x: 360, y: 590, scale: 1.0, flip: false },
    barry: { x: 650, y: 600, scale: 1.0, flip: false },
    doreen: { x: 945, y: 588, scale: 0.97, flip: true },
    extras: [
      { x: 240, y: 540, scale: 0.76, flip: false },
      { x: 506, y: 514, scale: 0.68, flip: true },
      { x: 806, y: 510, scale: 0.68, flip: false },
      { x: 1090, y: 532, scale: 0.75, flip: true },
    ],
  },
  riverMouth: { x: 150, y: 596 },
  raftMoor: { x: 70, y: 597 },
  moorPost: { x: 118, y: 558 },
  exitSignSpots: [
    { x: 182, y: 452, dir: 'left' },
    { x: 290, y: 449, dir: 'left' },
    { x: 400, y: 446, dir: 'left' },
  ],
  escapePath: [{ x: 650, y: 600 }, { x: 470, y: 540 }, { x: 330, y: 476 }, { x: 200, y: 476 }, { x: 128, y: 530 }, { x: 70, y: 596 }],
  signPos: { x: 1150, y: 446 },
  volcanoPeak: { x: 860, y: 150 },
  craterPos: { x: 860, y: 150, w: 110 },
  lavaEntry: { x: 990, y: 468 },
  thermometerSpot: { x: 770, y: 598 },
};
const NEW_SPRING = Object.assign({}, SPRING, {
  signPos: { x: 1150, y: 446 },
  tinyHill: { x: 880, y: 330 },   // top of the innocent little hill where Mount Snooze would be
  hillPuffPos: { x: 900, y: 322 },
  volcanoPeak: null, craterPos: null, lavaEntry: null,
});

// =====================================================================================
// baked scenery (constant geometry → Path2D, built once at load)
// =====================================================================================
const SKY_BANDS = [];
for (let y = -64; y < 440; y += 14) SKY_BANDS.push([y, 14]);
const POOL_BANDS = bandsOf(POOL_DENSE, 0, 0, [450, 460, 469, 478, 488, 499, 512, 528, 548, 572, 600, 632, 668, 708, 752, 820]);
const RIVER_BANDS = bandsOf(RIVER_DENSE, 0, 0, [528, 548, 572, 600, 632, 668]);

// clouds (moving; shapes constant)
const CLOUDS = (() => {
  const r = rng(77), list = [];
  for (let i = 0; i < 10; i++) {
    const far = i < 4;
    const s = far ? r.range(0.4, 0.6) : r.range(0.7, 1.25);
    const y = far ? r.range(262, 316) : [-210, -60, 40, 110, 70, -150][i - 4] + r.range(-20, 20);
    const n = far ? r.int(3, 4) : r.int(4, 6);
    const puffs = [];
    let x = 0;
    for (let k = 0; k < n; k++) {
      const edge = k === 0 || k === n - 1;
      const rr = r.range(26, 44) * (edge ? 0.62 : 1) * (k === Math.floor(n / 2) ? 1.3 : 1);
      puffs.push([x, -rr * r.range(0.75, 1.05), rr]);
      x += rr * r.range(1.0, 1.25);
    }
    const w = x;
    list.push({ x0: [80, 700, 1240, 1600, -200, 560, 1000, 300, 1420, 1900][i] + r.range(-40, 40), y, s, v: r.range(3, 6) * (far ? 0.5 : 1), far, w, puffs: puffs.map((p) => [p[0] - w / 2 + 8, p[1], p[2]]) });
  }
  return list;
})();
function cloudShape(p, c, ox, oy, k, lift) {
  for (const [px, py, pr] of c.puffs) circleP(p, ox + px, oy + py + lift, pr * k);
  const first = c.puffs[0], last = c.puffs[c.puffs.length - 1];
  const h = Math.min(first[2], last[2]) * k * 0.9;
  p.moveTo(ox + first[0], oy - h + lift); p.lineTo(ox + last[0], oy - h + lift); p.lineTo(ox + last[0], oy + lift * 0.3);
  p.lineTo(ox + first[0], oy + lift * 0.3); p.closePath();
}

function ridgePts(seed, y0, amp, freq, step, shape) {
  const pts = [];
  for (let x = WX0 - 60; x <= WX1 + 60; x += step) pts.push([x, y0 + noise1(x * freq + seed) * amp + (shape ? shape(x) : 0)]);
  return pts;
}
function ridgePath(pts, bumpH, yBot) {
  return newPath((p) => {
    p.moveTo(pts[0][0], yBot); p.lineTo(pts[0][0], pts[0][1]);
    if (bumpH > 0) {
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
        p.bezierCurveTo(x1, Math.min(y1, y2) - bumpH, x2, Math.min(y1, y2) - bumpH, x2, y2);
      }
    } else splineTo(p, pts);
    p.lineTo(pts[pts.length - 1][0], yBot); p.closePath();
  });
}
const MTN = ridgePath(ridgePts(3.3, 288, 52, 0.0036, 46, (x) => 70 * bump(x, 900, 260) - 30 * bump(x, 260, 260)), 0, 372);
const FAR_HILLS = ridgePath(ridgePts(8.1, 352, 20, 0.007, 30, (x) => 18 * bump(x, 880, 280)), 7, 404);

// --- Mount Snooze -------------------------------------------------------------------
const VOLC_OUT = [[430, 488], [512, 446], [580, 405], [640, 357], [692, 303], [738, 249], [775, 201], [800, 169], [812, 156],
  [836, 147], [860, 150], [884, 146], [908, 153], [922, 167], [950, 203], [988, 249], [1032, 297], [1084, 345],
  [1140, 387], [1204, 423], [1270, 451], [1344, 484]];
const VOLC_DENSE = openSpline(VOLC_OUT, 8);
const VOLC_POLY = [[430, 440]].concat(VOLC_DENSE.map(([x, y]) => [x, Math.min(y, 440)]), [[1344, 440]]);
function volcY(x) {
  if (x <= VOLC_DENSE[0][0] || x >= VOLC_DENSE[VOLC_DENSE.length - 1][0]) return 560;
  for (let i = 1; i < VOLC_DENSE.length; i++) {
    const a = VOLC_DENSE[i - 1], b = VOLC_DENSE[i];
    if (x <= b[0]) return lerp(a[1], b[1], (x - a[0]) / Math.max(1e-6, b[0] - a[0]));
  }
  return 560;
}
const VOLC_SIL = newPath((p) => polyP(p, VOLC_POLY));
const VOLC_BANDS = bandsOf(VOLC_POLY, 140, 440, 20);
const VOLC_RIDGE = openSpline([[858, 156], [864, 196], [874, 246], [892, 300], [916, 352], [946, 404], [982, 470], [1000, 540]], 4);
const VOLC_SHADOW = (() => {
  const i0 = VOLC_DENSE.findIndex((q) => q[0] >= 858);
  const right = VOLC_DENSE.slice(i0).reverse();
  return newPath((p) => polyP(p, VOLC_RIDGE.filter((q) => q[1] < 440).concat([[960, 440], [1344, 440]], right)));
})();
// ridges radiating from the crater: [polyline, litSide]
const RIDGES = [
  [[[818, 162], [800, 202], [776, 248], [748, 294], [720, 338], [694, 376]], 1],
  [[[836, 160], [828, 208], [816, 258], [802, 308], [790, 356], [780, 396]], 1],
  [[[798, 178], [762, 220], [724, 266], [686, 310], [650, 350], [618, 384]], 1],
  [[[852, 162], [854, 216], [860, 272], [868, 328], [878, 384]], 1],
  [[[896, 162], [914, 208], [938, 256], [964, 304], [992, 348], [1020, 388]], 0],
  [[[914, 166], [948, 206], [990, 250], [1036, 294], [1086, 338], [1132, 372]], 0],
];
const RIDGE_PATHS = (() => {
  const lit = new Path2D(), dark = new Path2D();
  for (const [pts] of RIDGES) {
    const sp = openSpline(pts, 4);
    const n = sp.length;
    const w = (i) => lerp(2, 20, i / (n - 1));
    ribbonP(lit, sp.map(([x, y], i) => [x - w(i) * 0.5, y]), 0, 0, (u) => lerp(1.5, 16, u));
    ribbonP(dark, sp.map(([x, y], i) => [x + w(i) * 0.55, y]), 0, 0, (u) => lerp(1.5, 18, u));
  }
  return { lit, dark };
})();
const GULLY_DATA = RIDGES;
const STRATA = newPath((p) => {
  for (let i = 0; i < 3; i++) {
    const y0 = 214 + i * 40;
    let pen = false;
    for (let x = 560; x <= 1180; x += 12) {
      const y = y0 + Math.sin(x * 0.025 + i * 2) * 3 + (x - 860) * (x - 860) * 0.00002 * (i + 1);
      if (y > volcY(x) + 8) { if (!pen) p.moveTo(x, y); else p.lineTo(x, y); pen = true; } else pen = false;
    }
  }
});
// vegetation skirt on the lower slopes: scalloped top that stays inside the silhouette
function vegPath(yOff, seed, step) {
  const r = rng(seed);
  return newPath((p) => {
    let x = 440, y = Math.max(volcY(x) + 3, 380);
    p.moveTo(440, 440); p.lineTo(x, y);
    while (x < 1336) {
      const st = step * r.range(0.75, 1.3);
      const nx = Math.min(1336, x + st);
      let base = 350 + yOff + noise1(nx * 0.02 + seed) * 14 + (nx < 640 ? (640 - nx) * 0.1 : 0) + (nx > 1080 ? (nx - 1080) * 0.07 : 0);
      base -= 30 * bump(nx, 752, 22) + 26 * bump(nx, 812, 16) + 26 * bump(nx, 962, 20) + 20 * bump(nx, 1046, 22);
      const lim = volcY(nx) + 4;
      if (base < lim + st * 0.5) { p.lineTo(nx, Math.max(base, lim)); } else {
        const h = st * 0.42 * r.range(0.8, 1.2);
        p.bezierCurveTo(x, Math.min(y, base) - h, nx, Math.min(y, base) - h, nx, base);
      }
      x = nx; y = Math.max(base, lim);
    }
    p.lineTo(1336, 440); p.closePath();
  });
}
const VEG_A = vegPath(0, 11, 30), VEG_B = vegPath(34, 12, 24);
const VOLC_EDGE = newPath((p) => { p.moveTo(VOLC_OUT[0][0], VOLC_OUT[0][1]); splineTo(p, VOLC_OUT); });

// lava paths
const LAVA_A = openSpline([[812, 160], [792, 196], [770, 234], [744, 272], [716, 308], [688, 342], [660, 374], [636, 404], [618, 432]], 5);
const LAVA_B = openSpline([[846, 162], [838, 204], [833, 250], [840, 296], [856, 338], [878, 374], [904, 402], [930, 430]], 5);
const LAVA_C = openSpline([[902, 160], [928, 202], [960, 244], [990, 286], [1022, 326], [1050, 360]], 5);
const LAVA_P1 = openSpline([[916, 412], [930, 428], [948, 442], [968, 454], [988, 463], [996, 472]], 6);
const LAVA_P2 = openSpline([[1104, 420], [1116, 438], [1128, 456], [1136, 474], [1140, 486]], 6);
const LAVA_A_L = polyLength(LAVA_A), LAVA_B_L = polyLength(LAVA_B), LAVA_C_L = polyLength(LAVA_C);
const LAVA_P1_L = polyLength(LAVA_P1), LAVA_P2_L = polyLength(LAVA_P2);

// --- jungle canopy bands (scalloped silhouettes with rim light + inner rows) -----------
// Scalloped canopy band, baked as x-chunks (so Skia culls the off-screen parts cheaply).
const CHUNKS = [[-1e9, -10], [-40, 650], [620, 1300], [1270, 1e9]];
function scallopBand(seed, top, step, bumpK, bottom, x0 = WX0 - 40, x1 = WX1 + 40) {
  const r = rng(seed);
  const bumps = [];
  let x = x0, y = top(x);
  while (x < x1) {
    const st = step(x) * r.range(0.6, 1.45);
    const nx = Math.min(x1, x + st), ny = top(nx);
    const h = st * bumpK * r.range(0.75, 1.25);
    const m = Math.min(y, ny);
    bumps.push([x, y, x - st * 0.08, m - h, nx + st * 0.08, m - h, nx, ny]);
    x = nx; y = ny;
  }
  const bot = (bx) => (typeof bottom === 'function' ? bottom(bx) : bottom);
  const chunks = CHUNKS.map(([c0, c1]) => {
    const sel = bumps.filter((q) => q[6] > c0 && q[0] < c1);
    if (!sel.length) return null;
    const p = new Path2D();
    p.moveTo(sel[0][0], sel[0][1]);
    for (const q of sel) p.bezierCurveTo(q[2], q[3], q[4], q[5], q[6], q[7]);
    const xa = sel[0][0], xb = sel[sel.length - 1][6];
    for (let bx = xb; bx > xa; bx -= 40) p.lineTo(bx, bot(bx));
    p.lineTo(xa, bot(xa));
    p.closePath();
    return p;
  }).filter(Boolean);
  return { chunks };
}
const profA = (x) => (x < 430 ? 282 : x < 570 ? lerp(282, 386, smoothstep(430, 570, x)) : x < 1150 ? 388 : x < 1260 ? lerp(388, 300, smoothstep(1150, 1260, x)) : 296) + noise1(x * 0.011 + 3) * (x > 570 && x < 1150 ? 5 : 20);
const profB = (x) => (x < 460 ? 338 : x < 590 ? lerp(338, 410, smoothstep(460, 590, x)) : x < 1160 ? 410 : x < 1250 ? lerp(410, 344, smoothstep(1160, 1250, x)) : 340) + noise1(x * 0.013 + 9) * (x > 590 && x < 1160 ? 4 : 14);
const stepA = (x) => (x > 590 && x < 1140 ? 30 : 58);
const stepB = (x) => (x > 600 && x < 1150 ? 25 : 46);
const underB = (x) => Math.max(profB(x) + 34, 360);
const JUNGLE = {
  A: scallopBand(101, profA, stepA, 0.5, underB),
  A1: scallopBand(102, (x) => profA(x) + 36, stepA, 0.45, underB),
  B: scallopBand(201, profB, stepB, 0.52, 452),
  B1: scallopBand(202, (x) => profB(x) + 30, stepB, 0.46, 452),
  C: scallopBand(301, (x) => 426 + noise1(x * 0.02) * 8 + noise1(x * 0.005 + 2) * 6, () => 26, 0.5, 462),
  C1: scallopBand(302, (x) => 445 + noise1(x * 0.02 + 4) * 4, () => 21, 0.45, 462),
};
// emergent umbrella trees + far palms poking out of band A
const EMERGENT = (() => {
  const crowns = new Path2D(), trunks = new Path2D(), lit = new Path2D();
  const trees = [[214, 248, 62], [-130, 236, 66], [1440, 228, 64], [380, 232, 44]];
  for (const [x, y, w] of trees) {
    trunks.moveTo(x - 5, 420); trunks.quadraticCurveTo(x - 2, (y + 420) / 2, x - 2, y + 8); trunks.lineTo(x + 3, y + 8); trunks.quadraticCurveTo(x + 4, (y + 420) / 2, x + 7, 420); trunks.closePath();
    // umbrella crown: flat-bottomed cluster
    for (let k = -2; k <= 2; k++) ellipseP(crowns, x + k * w * 0.32, y - (2 - Math.abs(k)) * 7, w * 0.3, 15 + (2 - Math.abs(k)) * 3);
    for (let k = -2; k <= 1; k++) ellipseP(lit, x + k * w * 0.32 - 3, y - (2 - Math.abs(k)) * 7 - 5, w * 0.18, 8);
  }
  return { crowns, trunks, lit };
})();
const FAR_PALMS = (() => {
  const dark = new Path2D(), light = new Path2D(), trunks = new Path2D();
  const palms = [[96, 372, 120, -16, 46], [536, 420, 116, 10, 40], [1056, 418, 96, 14, 34], [1352, 360, 128, -12, 46]];
  for (const [x, y, h, lean, len] of palms) {
    const tx = x + lean, ty = y - h;
    trunks.moveTo(x - 3, y); trunks.quadraticCurveTo(x + lean * 0.2 + 6, y - h * 0.5, tx - 2, ty); trunks.lineTo(tx + 2, ty); trunks.quadraticCurveTo(x + lean * 0.2 + 10, y - h * 0.5, x + 3, y); trunks.closePath();
    for (let i = 0; i < 7; i++) {
      const a = -PI + (i / 6) * PI;
      const L = len * (i === 0 || i === 6 ? 0.85 : 1);
      const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.55 + L * 0.5;
      addLeaf(dark, light, null, leafPts(tx, ty, tx + Math.cos(a) * L * 0.5, ty + Math.sin(a) * L * 0.5 - L * 0.22, ex, ey, L * 0.15, 14, true));
    }
  }
  return { dark, light, trunks };
})();

// --- big framing canopies (top corners) ------------------------------------------------
function canopyPath(pts, seed, lobe, inset, corner) {
  // pts: outline of the canopy's free edge (from one off-screen point around to another); lobes on it
  const r = rng(seed);
  return newPath((p) => {
    const dense = openSpline(pts, 6);
    const cum = polyLength(dense);
    const L = cum[cum.length - 1];
    p.moveTo(dense[0][0], dense[0][1]);
    let s = 0, prev = dense[0];
    const at = (d) => { const q = partial(dense, cum, d / L); return q[q.length - 1]; };
    while (s < L) {
      const st = lobe * r.range(0.55, 1.6);
      const ns = Math.min(L, s + st);
      const q = at(ns);
      // outward normal = left of travel direction
      const dx = q[0] - prev[0], dy = q[1] - prev[1], d = Math.hypot(dx, dy) || 1;
      const nx = dy / d, ny = -dx / d;
      const h = st * 0.55 * r.range(0.8, 1.2);
      p.bezierCurveTo(prev[0] + nx * h * inset, prev[1] + ny * h * inset, q[0] + nx * h * inset, q[1] + ny * h * inset, q[0], q[1]);
      prev = q; s = ns;
    }
    p.lineTo(corner[0], corner[1]); p.closePath();
  });
}
const CANOPY_L_EDGE = [[-470, 190], [-300, 170], [-150, 168], [-20, 160], [80, 138], [170, 112], [250, 80], [318, 38], [360, -20], [384, -110], [392, -460]];
const CANOPY_L = {
  base: canopyPath(CANOPY_L_EDGE, 41, 62, -1, [-900, -900]),
  inner: canopyPath(CANOPY_L_EDGE.map(([x, y]) => [x - 26, y - 34]), 42, 54, -1, [-900, -900]),
  inner2: canopyPath(CANOPY_L_EDGE.map(([x, y]) => [x - 50, y - 74]), 43, 48, -1, [-900, -900]),
};
const CANOPY_R_EDGE = [[1150, -460], [1166, -120], [1182, -40], [1214, 14], [1268, 52], [1340, 84], [1430, 108], [1560, 120], [1760, 128]].reverse();
const CANOPY_R = {
  base: canopyPath(CANOPY_R_EDGE, 51, 58, 1, [2400, -900]),
  inner: canopyPath(CANOPY_R_EDGE.map(([x, y]) => [x + 26, y - 34]), 52, 50, 1, [2400, -900]),
  inner2: canopyPath(CANOPY_R_EDGE.map(([x, y]) => [x + 50, y - 72]), 53, 46, 1, [2400, -900]),
};
const VINES = [
  { x: 120, y: 132, len: 220, seed: 1 }, { x: 176, y: 108, len: 150, seed: 2 }, { x: 240, y: 80, len: 250, seed: 3 },
  { x: 306, y: 40, len: 150, seed: 4 }, { x: 40, y: 150, len: 120, seed: 5 },
  { x: 1214, y: 20, len: 200, seed: 6 }, { x: 1262, y: 50, len: 140, seed: 7 }, { x: 1320, y: 80, len: 220, seed: 8 },
];

// --- ground (baked bands) ---------------------------------------------------------------
const GROUND_POLY = (() => {
  const pts = [[WX0, WY1]];
  for (let x = WX0; x <= WX1; x += 40) pts.push([x, 440 + noise1(x * 0.03 + 7) * 4]);
  pts.push([WX1, WY1]);
  return pts;
})();
const GROUND_BANDS = bandsOf(GROUND_POLY, 0, 0, [430, 452, 480, 520, 580, 660, 760, 1140]);

// --- rocks ---------------------------------------------------------------------------------
function makeRock(cx, cy, rx, ry, seed, moss) {
  const n = rx > 30 ? 9 : 7, pts = [];
  const rr = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rr.range(-0.12, 0.12);
    const k = rr.range(0.86, 1.08);
    let y = Math.sin(a) * ry * k;
    if (y > ry * 0.5) y = ry * 0.5 + (y - ry * 0.5) * 0.3;
    pts.push([Math.cos(a) * rx * k, y]);
  }
  const kin = Math.max(0.8, 1 - 1.5 / Math.min(rx, ry));
  const inner = pts.map(([x, y]) => [x * kin, y * kin]);
  const lit = pts.map(([x, y]) => [x * 0.84 - rx * 0.07, y * 0.78 - ry * 0.16]);
  const hl = pts.map(([x, y]) => [x * 0.34 - rx * 0.36, y * 0.28 - ry * 0.46]);
  let mossPts = null;
  if (moss) {
    const top = pts.filter(([, y]) => y < -ry * 0.1).sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
    if (top.length >= 3) {
      mossPts = top.map(([x, y]) => [x * 0.97, y * 0.97 - 0.6]);
      const l = mossPts[0], rg = mossPts[mossPts.length - 1];
      for (let j = 5; j >= 0; j--) {
        const s = j / 5;
        mossPts.push([lerp(l[0], rg[0], s), -ry * 0.12 + Math.sin(s * 9 + seed) * ry * 0.13 + ry * 0.08]);
      }
    }
  }
  return { x: cx, y: cy, rx, ry, pts, inner, lit, hl, moss: mossPts };
}
function bakeRocks(list, nGroups, glints) {
  const groups = [];
  for (let g = 0; g < nGroups; g++) groups.push({ out: new Path2D(), shade: new Path2D(), lit: new Path2D(), hl: new Path2D(), moss: new Path2D(), mossHl: new Path2D(), shadeS: new Path2D(), hlS: new Path2D(), mossHlS: new Path2D() });
  const glint = new Path2D();
  list.forEach((rk, i) => {
    const G = groups[i % nGroups];
    const small = rk.rx < 24;
    blobP(G.out, rk.pts, rk.x, rk.y);
    blobP(small ? G.shadeS : G.shade, rk.inner, rk.x, rk.y);
    blobP(G.lit, rk.lit, rk.x, rk.y);
    blobP(small ? G.hlS : G.hl, rk.hl, rk.x, rk.y);
    if (rk.moss) {
      blobP(G.moss, rk.moss, rk.x, rk.y);
      ellipseP(small ? G.mossHlS : G.mossHl, rk.x - rk.rx * 0.28, rk.y - rk.ry * 0.66, rk.rx * 0.3, rk.ry * 0.14);
    }
    if (glints && inPool(rk.x, rk.y + rk.ry * 0.75)) {
      const rx = rk.rx * 0.92, ry = rk.ry * 0.26, cy = rk.y + rk.ry * 0.44, th = 0.8 + rk.rx * 0.02;
      glint.moveTo(rk.x + Math.cos(0.3) * rx, cy + Math.sin(0.3) * ry);
      for (let a = 0.3; a <= PI - 0.3 + 1e-6; a += 0.2) glint.lineTo(rk.x + Math.cos(a) * rx, cy + Math.sin(a) * ry);
      for (let a = PI - 0.3; a >= 0.3 - 1e-6; a -= 0.2) glint.lineTo(rk.x + Math.cos(a) * (rx + th * 0.6), cy + Math.sin(a) * (ry + th * Math.sin(a) * 1.6));
      glint.closePath();
    }
  });
  return { groups, glint };
}
const RIM_LIST = (() => {
  const r = rng(909), out = [];
  const d = POOL_DENSE, n = d.length;
  let acc = 0, next = 0;
  for (let i = 0; i < n; i++) {
    const p = d[i], q = d[(i + 1) % n];
    acc += Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (acc < next) continue;
    const [x, y] = p;
    if (x < 200 && y > 520 && y < 670) { next = acc + 4; continue; } // the river mouth gap
    const k = clamp((y - 455) / 350);
    const big = r() < 0.18;
    const rx = lerp(14, 52, Math.pow(k, 0.85)) * r.range(0.75, 1.2) * (big ? 1.6 : 1);
    const ry = rx * lerp(0.6, 0.72, k) * r.range(0.88, 1.12);
    let nx = q[1] - d[(i - 1 + n) % n][1], ny = -(q[0] - d[(i - 1 + n) % n][0]);
    const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    if (pointInPoly(d, x + nx * 6, y + ny * 6)) { nx = -nx; ny = -ny; }
    out.push(makeRock(x + nx * rx * 0.3, y + ny * ry * 0.5 + ry * 0.1, rx, ry, 1000 + i, y < 560 ? r() < 0.6 : r() < 0.35));
    next = acc + rx * r.range(1.05, 1.5);
  }
  // big rocks flanking the river mouth
  out.push(makeRock(184, 534, 40, 25, 77, true));
  out.push(makeRock(150, 548, 22, 14, 80, false));
  out.push(makeRock(196, 662, 48, 30, 78, true));
  out.push(makeRock(150, 640, 24, 15, 81, true));
  out.push(makeRock(232, 716, 30, 20, 79, false));
  return out.sort((a, b) => a.y - b.y);
})();
const RIM_ROCKS = bakeRocks(RIM_LIST, 2, true);
const RIVER_ROCKS = bakeRocks((() => {
  const r = rng(321), out = [];
  for (let x = -450; x < 170; x += r.range(46, 76)) {
    out.push(makeRock(x, 562 + (x + 460) * 0.004 + r.range(-2, 2), r.range(11, 18), r.range(6, 10), 3000 + x, r() < 0.45));
    out.push(makeRock(x + 28, 638 - (x + 460) * 0.006 + r.range(-1, 3), r.range(14, 24), r.range(8, 13), 4000 + x, r() < 0.3));
  }
  return out.sort((a, b) => a.y - b.y);
})(), 2, true);
const BANK_LIST = [
  makeRock(-60, 716, 60, 38, 52, true), makeRock(60, 746, 74, 46, 51, true), makeRock(150, 792, 54, 34, 53, false),
  makeRock(-210, 768, 80, 50, 58, true), makeRock(1262, 642, 52, 36, 54, true), makeRock(1360, 702, 70, 44, 56, false),
  makeRock(1236, 754, 76, 48, 55, true), makeRock(1252, 520, 24, 16, 57, true), makeRock(1490, 622, 64, 40, 59, false),
].sort((a, b) => a.y - b.y);
const BANK_ROCKS = bakeRocks(BANK_LIST, 2, false);

// --- undergrowth, tufts, flowers ----------------------------------------------------------
function bakeFerns(list, groups) {
  const out = [];
  for (let g = 0; g < groups; g++) out.push({ dark: new Path2D(), light: new Path2D(), rib: new Path2D() });
  list.forEach((f, i) => {
    const G = out[i % groups];
    for (let j = 0; j < f.n; j++) {
      const a = f.ang + (j - (f.n - 1) / 2) * 0.5;
      const L = f.len * (1 - Math.abs(j - (f.n - 1) / 2) * 0.12);
      const ex = f.x + Math.cos(a) * L, ey = f.y + Math.sin(a) * L + L * 0.38;
      const cx = f.x + Math.cos(a) * L * 0.55, cy = f.y + Math.sin(a) * L * 0.55 - L * 0.22;
      addLeaf(G.dark, G.light, G.rib, leafPts(f.x, f.y, cx, cy, ex, ey, L * 0.2, f.seg || 14, true, (s) => Math.pow(Math.sin(PI * Math.min(1, s * 1.04)), 0.5) * (1 - s * 0.55)));
    }
  });
  return out;
}
function bakeHearts(list) {
  const dark = new Path2D(), light = new Path2D(), stem = new Path2D();
  for (const h of list) {
    for (let j = 0; j < h.n; j++) {
      const a = -PI / 2 + (j - (h.n - 1) / 2) * 0.75 + (h.tilt || 0);
      const L = h.s * (j === (h.n >> 1) ? 2.5 : 2.0);
      const bx = h.x + Math.cos(a) * L, by = h.y + Math.sin(a) * L;
      stem.moveTo(h.x, h.y); stem.quadraticCurveTo(h.x + Math.cos(a) * L * 0.4, h.y + Math.sin(a) * L * 0.7, bx, by);
      // heart blade hanging forward/down from the stem tip
      const dir = a + PI * 0.62 * (Math.cos(a) >= 0 ? 1 : -1) * 0.55;
      const len = h.s * 1.5, wid = h.s * 0.85;
      const tx = bx + Math.cos(dir) * len, ty = by + Math.sin(dir) * len;
      const nx = -Math.sin(dir), ny = Math.cos(dir);
      const shape = (P, side) => {
        P.moveTo(bx, by);
        P.bezierCurveTo(bx + nx * wid * 0.9 * side - Math.cos(dir) * wid * 0.5, by + ny * wid * 0.9 * side - Math.sin(dir) * wid * 0.5,
          bx + nx * wid * 1.1 * side + Math.cos(dir) * len * 0.55, by + ny * wid * 1.1 * side + Math.sin(dir) * len * 0.55, tx, ty);
        P.lineTo(bx + Math.cos(dir) * len * 0.15, by + Math.sin(dir) * len * 0.15);
        P.closePath();
      };
      const up = ny < 0 ? 1 : -1;
      shape(dark, -up); shape(light, up);
    }
  }
  return { dark, light, stem };
}
const BACK_FERNS = bakeFerns((() => {
  const r = rng(2024), out = [];
  for (let x = WX0 + 10; x < WX1; x += r.range(84, 140)) {
    if (x > 1060 && x < 1240) continue; // keep the sign clean
    const ledge = x > 140 && x < 450;
    out.push({ x, y: 448 + r.range(-3, 4), len: ledge ? r.range(28, 36) : r.range(38, 54), ang: -PI / 2 + r.range(-0.4, 0.4), n: r.int(3, 4), seg: 10 });
  }
  return out;
})(), 3);
const BACK_HEARTS = bakeHearts([
  { x: 560, y: 452, s: 15, n: 3 }, { x: 700, y: 450, s: 13, n: 3 }, { x: 1004, y: 452, s: 15, n: 3 },
  { x: 1300, y: 456, s: 18, n: 3 }, { x: -60, y: 470, s: 20, n: 3 }, { x: 860, y: 450, s: 12, n: 2 },
]);
const FRONT_FERNS = bakeFerns([
  { x: 18, y: 708, len: 92, ang: -1.25, n: 5 }, { x: -50, y: 770, len: 110, ang: -1.0, n: 5 },
  { x: 1252, y: 604, len: 80, ang: -1.95, n: 5 }, { x: 1292, y: 726, len: 112, ang: -2.0, n: 5 },
  { x: 1460, y: 680, len: 100, ang: -1.6, n: 5 }, { x: -230, y: 700, len: 90, ang: -1.4, n: 4 },
], 2);
const FRONT_HEARTS = bakeHearts([{ x: 196, y: 772, s: 26, n: 3 }, { x: 1222, y: 698, s: 24, n: 3 }, { x: -140, y: 820, s: 30, n: 3 }]);
function grassTuft(p, x, y, s, seed) {
  for (let k = 0; k < 3; k++) {
    const a = -PI / 2 + (k - 1) * 0.42 + (hash1(seed + k) - 0.5) * 0.3;
    const h = s * (0.75 + 0.5 * hash1(seed * 3 + k));
    p.moveTo(x - s * 0.1 + k * s * 0.1, y);
    p.quadraticCurveTo(x + Math.cos(a) * h * 0.3, y + Math.sin(a) * h * 0.6, x + Math.cos(a) * h, y + Math.sin(a) * h);
    p.lineTo(x + s * 0.08 + k * s * 0.1, y);
    p.closePath();
  }
}
function bakeTufts(seed, count, avoidBack) {
  const r = rng(seed), dark = new Path2D(), light = new Path2D();
  for (let i = 0; i < count; i++) {
    const x = r.range(-420, 1700), y = r.range(444, 1100);
    if (inPool(x, y) || pointInPoly(POOL_DENSE, x, y - 12) || pointInPoly(RIVER_DENSE, x, y - 10)) continue;
    if (avoidBack && y < 476 && x > 460 && x < 1080) continue;
    const s = lerp(6, 18, clamp((y - 430) / 400)) * r.range(0.8, 1.2);
    grassTuft(dark, x, y, s, i);
    if (i % 2 === 0) grassTuft(light, x + s * 0.2, y, s * 0.7, i + 50);
  }
  return { dark, light };
}
const TUFTS = bakeTufts(77, 170, true);
function bakeFlowers(seed, count, cols, region) {
  const r = rng(seed), byCol = new Map(), centres = new Path2D();
  for (let i = 0; i < count; i++) {
    const x = r.range(region[0], region[1]), y = r.range(region[2], region[3]);
    if (inPool(x, y) || pointInPoly(POOL_DENSE, x, y - 12) || pointInPoly(RIVER_DENSE, x, y - 10)) continue;
    if (y < 476 && x > 460 && x < 1080) continue;
    const s = lerp(2.2, 5.5, clamp((y - 430) / 400));
    const c = cols[r.int(0, cols.length - 1)];
    if (!byCol.has(c)) byCol.set(c, new Path2D());
    const P = byCol.get(c);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU + i;
      ellipseP(P, x + Math.cos(a) * s * 0.9, y + Math.sin(a) * s * 0.7, s * 0.62, s * 0.5);
    }
    circleP(centres, x, y, s * 0.45);
  }
  return { byCol, centres };
}
const FLOWERS = bakeFlowers(99, 70, [C.fPink, C.fYellow, C.fWhite, C.fPurple], [-420, 1700, 444, 1100]);
const SHIMMER = (() => {
  const r = rng(555), out = [];
  for (let i = 0; i < 110; i++) {
    const k = Math.pow(r(), 1.35);
    const y = lerp(470, 800, k);
    const span = poolSpan(y);
    if (!span) continue;
    const x = lerp(span[0] + 24, span[1] - 24, r());
    out.push({ x, y, len: lerp(10, 66, k) * r.range(0.6, 1.3), k, ph: r.range(0, TAU), sp: r.range(0.5, 1.2), bin: k < 0.3 ? 0 : k < 0.65 ? 1 : 2 });
  }
  return out;
})();

// =====================================================================================
// sky, clouds, hills
// =====================================================================================
function drawSky(ctx, t, P) {
  ctx.fillStyle = P.skyTop;
  ctx.fillRect(WX0, WY0, WX1 - WX0, -64 - WY0 + 1);
  for (let i = 0; i < SKY_BANDS.length; i++) {
    ctx.fillStyle = P.skyBands[i];
    ctx.fillRect(WX0, SKY_BANDS[i][0], WX1 - WX0, SKY_BANDS[i][1] + 1);
  }
  ctx.fillStyle = P.skyBot;
  ctx.fillRect(WX0, SKY_BANDS[SKY_BANDS.length - 1][0] + 14, WX1 - WX0, 40);
  // stylised sun: concentric soft halos (+ disc in the evening)
  if (P.sunA > 0.01) {
    if (P.sunDisc > 0.01) {
      const R = 400;
      const g = ctx.createRadialGradient(P.sunX, P.sunY, 30, P.sunX, P.sunY, R);
      g.addColorStop(0, rgba(P.sunCol, P.sunA * 0.85)); g.addColorStop(0.25, rgba(P.sunCol, P.sunA * 0.35)); g.addColorStop(1, rgba(P.sunCol, 0));
      ctx.fillStyle = g;
      ctx.fillRect(P.sunX - R, P.sunY - R, 2 * R, Math.min(2 * R, 450 - (P.sunY - R)));
    } else {
      for (const r of [300, 190, 110]) {
        ctx.fillStyle = rgba(P.sunCol, P.sunA * 0.17);
        ctx.beginPath(); circleP(ctx, P.sunX, P.sunY, r); ctx.fill();
      }
    }
  }
  if (P.sunDisc > 0.01) {
    ctx.fillStyle = rgba(mix(P.sunCol, '#FFFFFF', 0.5), P.sunDisc);
    ctx.beginPath(); circleP(ctx, P.sunX, P.sunY, 46); ctx.fill();
  }
  if (P.erupt > 0.04) {
    const gl = smoothstep(0.04, 0.3, P.erupt);
    const R = 220 + 160 * gl;
    const g = ctx.createRadialGradient(860, 190, 0, 860, 190, R);
    g.addColorStop(0, `rgba(255,130,50,${0.5 * gl})`); g.addColorStop(0.45, `rgba(255,90,40,${0.2 * gl})`); g.addColorStop(1, 'rgba(255,80,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(860 - R, 190 - R, 2 * R, Math.min(2 * R, 460 - (190 - R)));
  }
}
function drawClouds(ctx, t, P) {
  const span = WX1 - WX0 + 700;
  for (const c of CLOUDS) {
    const x = WX0 - 350 + ((((c.x0 - WX0 + 350 + t * c.v) % span) + span) % span);
    ctx.save();
    ctx.translate(x, c.y);
    ctx.scale(c.s, c.s * (c.far ? 0.75 : 1));
    ctx.fillStyle = c.far ? mix(P.cloudShade, P.skyBot, 0.35) : P.cloudShade;
    ctx.beginPath(); cloudShape(ctx, c, 0, 0, 1, 0); ctx.fill();
    ctx.fillStyle = c.far ? mix(P.cloud, P.skyBot, 0.3) : P.cloud;
    ctx.beginPath(); cloudShape(ctx, c, -4, 0, 0.9, -10); ctx.fill();
    ctx.restore();
  }
}
function drawBirds(ctx, t, P) {
  ctx.save();
  ctx.strokeStyle = P.g('#3E4C5E', 0.55);
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const x = WX0 + ((t * (18 + i * 5) + i * 610) % 2200);
    const y = 130 + i * 30 + Math.sin(t * 0.5 + i) * 8;
    const f = Math.sin(t * 7 + i * 2.1) * 3.4;
    const s = 1 - i * 0.18;
    ctx.moveTo(x - 7 * s, y - f * s);
    ctx.quadraticCurveTo(x - 3 * s, y - 2 * s, x, y + 1);
    ctx.quadraticCurveTo(x + 3 * s, y - 2 * s, x + 7 * s, y - f * s);
  }
  ctx.stroke();
  ctx.restore();
}
function fillOff(ctx, path, col, dx, dy) {
  ctx.fillStyle = col;
  if (dx || dy) { ctx.translate(dx, dy); ctx.fill(path); ctx.translate(-dx, -dy); } else ctx.fill(path);
}
function drawFarHills(ctx, t, P) {
  fillOff(ctx, MTN, P.g(C.mtn, 0.92));
  fillOff(ctx, FAR_HILLS, P.hl(C.hillFar, 0.66, 0.6), -2, -2);
  fillOff(ctx, FAR_HILLS, P.g(C.hillFar, 0.72));
}

// =====================================================================================
// Mount Snooze
// =====================================================================================
function drawVolcano(ctx, t, P, o) {
  const glowK = smoothstep(0.03, 0.2, o.erupt);
  const far = 0.32;
  const stops = [[146, P.g('#8E8DA8', far)], [178, P.g(C.volcRim, far)], [262, P.g(C.volcLit, far)], [430, P.g(C.volcLitLo, far + 0.06)]];
  for (const b of VOLC_BANDS) { ctx.fillStyle = stopsColor(stops, b.y); ctx.fill(b.path); }
  ctx.strokeStyle = rgba(P.g(C.volcDark, far), 0.16); ctx.lineWidth = 2; ctx.stroke(STRATA);
  fillOff(ctx, RIDGE_PATHS.dark, rgba(P.g(C.volcDark, far), 0.3));
  fillOff(ctx, RIDGE_PATHS.lit, rgba(P.hl(C.volcRim, far, 1.2), 0.55));
  // vegetation skirt
  fillOff(ctx, VEG_A, P.hl(C.jLight, 0.42, 0.9), -2, -2.5);
  fillOff(ctx, VEG_A, P.g(C.jMid, 0.44));
  fillOff(ctx, VEG_B, P.hl(C.jMid, 0.42, 0.7), -2, -2.5);
  fillOff(ctx, VEG_B, P.g(C.jDeep, 0.42));
  // shadow side
  fillOff(ctx, VOLC_SHADOW, rgba(P.g(C.volcShade, far), 0.5));
  // fissure glow (pre-eruption)
  if (glowK > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,110,40,${0.55 * glowK * (0.75 + 0.25 * noise1(t * 6))})`;
    ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [pts] of [GULLY_DATA[1], GULLY_DATA[3], GULLY_DATA[4]]) { const sp = openSpline(pts.slice(0, 3), 4); ctx.moveTo(sp[0][0], sp[0][1]); polyTo(ctx, sp); }
    ctx.stroke();
    ctx.restore();
  }
  // outline
  ctx.strokeStyle = rgba(P.g(C.volcDark, far), 0.45); ctx.lineWidth = 1.6; ctx.stroke(VOLC_EDGE);
  // crater
  ctx.fillStyle = P.g(mix(C.volcRim, C.volcLit, 0.5), far);
  ctx.beginPath(); ellipseP(ctx, 860, 152, 50, 9.5); ctx.fill();
  ctx.fillStyle = mix(P.g(C.crater, far), '#FF6A22', glowK);
  ctx.beginPath(); ellipseP(ctx, 860, 154.5, 41, 6.2); ctx.fill();
  if (glowK > 0) {
    ctx.fillStyle = rgba('#FFD25A', glowK * (0.75 + 0.25 * noise1(t * 9)));
    ctx.beginPath(); ellipseP(ctx, 860, 155, 30, 3.8); ctx.fill();
  }
  ctx.strokeStyle = P.hl(C.volcRim, far, 1.2); ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.ellipse(860, 152, 50, 9.5, 0, 0.15, PI - 0.15); ctx.stroke();
  if (glowK > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const a = glowK * (0.8 + 0.2 * noise1(t * 7 + 3));
    for (const [r, al] of [[95, 0.12], [60, 0.18], [34, 0.25]]) {
      ctx.fillStyle = `rgba(255,130,50,${al * a})`;
      ctx.beginPath(); ellipseP(ctx, 860, 146, r * 1.2, r * 0.8); ctx.fill();
    }
    ctx.restore();
  }
}
// lazy smoke wisp (+ thicker, darker pre-eruption smoke). Puffs are unioned per alpha bucket so
// overlapping translucent discs never stack into rings.
function drawCraterSmoke(ctx, t, P, o) {
  const thick = smoothstep(0.03, 0.2, o.erupt);
  const amt = clamp(o.volcanoSmoke + thick * 1.2);
  if (amt <= 0.01) return;
  const N = 18;
  const L = lerp(9, 4.5, thick);
  const H = lerp(210, 420, thick) * (0.55 + 0.45 * Math.min(1, amt));
  const light = mix(P.g('#F6F4F8', 0.12), '#6E6064', thick * 0.8);
  const shadeC = mix(P.g('#CBC9D8', 0.18), '#3E3438', thick * 0.8);
  const SH = [new Path2D(), new Path2D(), new Path2D()], LI = [new Path2D(), new Path2D(), new Path2D()];
  for (let i = 0; i < N; i++) {
    const k = frac(t / L + i / N);
    const x = 864 + k * H * lerp(0.62, 0.32, thick) + Math.sin(k * 5.5 + i * 0.7 + t * 0.25) * 10 * k;
    const y = 146 - k * H + k * k * H * 0.28;
    const r = (7 + k * 38) * (0.6 + 0.5 * Math.min(1, amt)) * (1 + thick * 0.35);
    const fade = smoothstep(0, 0.08, k) * Math.pow(1 - k, 1.1);
    const bkt = fade > 0.6 ? 2 : fade > 0.3 ? 1 : 0;
    if (fade < 0.05) continue;
    circleP(SH[bkt], x, y, r);
    circleP(LI[bkt], x - r * 0.16, y - r * 0.2, r * 0.8);
  }
  const A = Math.min(1, amt * 1.3) * (0.6 + 0.25 * thick);
  for (let b = 0; b < 3; b++) {
    const a = A * [0.3, 0.6, 0.92][b];
    ctx.fillStyle = rgba(shadeC, a); ctx.fill(SH[b]);
    ctx.fillStyle = rgba(light, a); ctx.fill(LI[b]);
  }
}
// erupt .2-.6: explosive billowing plume that fills the sky above the volcano (opaque puffs)
function drawPlume(ctx, t, P, o) {
  const G = smoothstep(0.17, 0.5, o.erupt);
  if (G <= 0) return;
  const cx = 860, cy = 150;
  const Ht = 520 * Math.pow(G, 0.7);
  const N = 44;
  const list = [];
  for (let i = 0; i < N; i++) {
    const h = frac(i / N + t * 0.04);
    if (h > 0.12 + 0.88 * G) continue; // the plume has not reached that far yet
    const cap = smoothstep(0.22, 1, h);
    const side = (hash1(i * 13.7) - 0.5) * 1.3;
    const x = cx + (side * (60 + 300 * h + 900 * cap * cap) + 90 * h + noise1(t * 0.35 + i * 1.3) * 22 * h) * (0.15 + 0.85 * G);
    const y = cy - h * Ht + cap * cap * 150 * G + (hash1(i * 5.9) - 0.5) * 40 * h * G;
    const shrink = 1 - smoothstep(0.92, 1, h);
    const r = (34 + 210 * Math.pow(h, 0.5)) * (0.3 + 0.7 * G) * (1 + 0.07 * Math.sin(t * 1.7 + i * 2.1)) * shrink * smoothstep(0, 0.05, h + 0.02);
    if (r > 2) list.push({ x, y, r, h });
  }
  const dark = mix('#241C20', P.skyTop, 0.1), mid = '#41363A', lit = mix('#66585A', P.rim, 0.2);
  const fl = 0.75 + 0.25 * noise1(t * 5.1);
  const glowP = new Path2D(), darkP = new Path2D(), midP = new Path2D(), litP = new Path2D();
  for (const p of list) {
    if (p.h < 0.4) circleP(glowP, p.x + p.r * 0.04, p.y + p.r * 0.14, p.r * 0.97);
    circleP(darkP, p.x, p.y, p.r);
    circleP(midP, p.x - p.r * 0.1, p.y - p.r * 0.14, p.r * 0.84);
    if (p.r > 30) circleP(litP, p.x - p.r * 0.36, p.y - p.r * 0.42, p.r * 0.34);
  }
  ctx.fillStyle = mix(dark, '#FF5A1E', 0.75 * fl); ctx.fill(glowP);
  ctx.fillStyle = dark; ctx.fill(darkP);
  ctx.fillStyle = mid; ctx.fill(midP);
  ctx.fillStyle = lit; ctx.fill(litP);
  // volcanic lightning
  const ph = smoothstep(0.25, 0.32, o.erupt) * (1 - smoothstep(0.62, 0.8, o.erupt));
  const slot = Math.floor(t * 2.3);
  if (ph > 0.2 && frac(t * 2.3) < 0.2 && hash1(slot * 7.31) > 0.5) {
    const r = rng(slot);
    let x = cx + r.range(-160, 200), y = cy - r.range(150, 300);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,244,226,0.95)'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += r.range(-26, 26); y += r.range(14, 26); ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,170,120,0.35)'; ctx.lineWidth = 9; ctx.stroke();
    ctx.restore();
  }
}
function drawAshPall(ctx, t, P, o) {
  const k = smoothstep(0.3, 0.75, o.erupt);
  if (k <= 0) return;
  const cols = [0.8, 0.6, 0.42, 0.26, 0.12];
  for (let i = 0; i < cols.length; i++) {
    ctx.fillStyle = `rgba(36,20,22,${cols[i] * k * 0.55})`;
    ctx.fillRect(WX0, WY0, WX1 - WX0, -40 + i * 60 - WY0);
  }
}
function drawFountains(ctx, t, P, o) {
  const I = smoothstep(0.2, 0.3, o.erupt) * (1 - 0.45 * smoothstep(0.7, 1, o.erupt));
  if (I <= 0) return;
  const cx = 860, cy = 150;
  ctx.save();
  const jh = (70 + 60 * I) * (0.85 + 0.15 * noise1(t * 8));
  const jg = ctx.createLinearGradient(0, cy, 0, cy - jh);
  jg.addColorStop(0, 'rgba(255,230,140,0.95)'); jg.addColorStop(0.5, 'rgba(255,140,50,0.7)'); jg.addColorStop(1, 'rgba(255,80,30,0)');
  ctx.fillStyle = jg;
  ctx.beginPath();
  ctx.moveTo(cx - 26, cy + 2);
  ctx.quadraticCurveTo(cx - 10, cy - jh * 0.5, cx + noise1(t * 3) * 10, cy - jh);
  ctx.quadraticCurveTo(cx + 12, cy - jh * 0.5, cx + 26, cy + 2);
  ctx.closePath(); ctx.fill();
  const N = Math.round(80 * I);
  const glowP = new Path2D(), hot = new Path2D(), warm = new Path2D(), cool = new Path2D();
  for (let i = 0; i < N; i++) {
    const per = 1.3 + hash1(i * 3.1) * 1.3;
    const age = frac(t / per + hash1(i * 7.7)) * per;
    const vx = (hash1(i * 5.3) - 0.5) * 300;
    const vy = -(200 + hash1(i * 9.1) * 300) * (0.75 + 0.35 * I);
    const x = cx + (hash1(i * 2.3) - 0.5) * 50 + vx * age;
    const y = cy + vy * age + 210 * age * age;
    if (y > cy + 260) continue;
    const heat = 1 - age / per;
    const r = (2.2 + hash1(i * 4.4) * 3.6) * (0.75 + 0.5 * heat);
    if (heat > 0.4) circleP(glowP, x, y, r * 1.9);
    circleP(heat > 0.55 ? hot : heat > 0.25 ? warm : cool, x, y, r);
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,120,40,0.3)'; ctx.fill(glowP);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#B8381A'; ctx.fill(cool);
  ctx.fillStyle = '#FF9A30'; ctx.fill(warm);
  ctx.fillStyle = '#FFE07A'; ctx.fill(hot);
  ctx.restore();
}
// lava flow along a polyline: tapered ribbon w0 → w1 with crust edge, hot core and moving glints
function strokeLava(ctx, t, pts, w, seed = 0, w0) {
  if (pts.length < 2) return;
  const a = w0 ?? w * 0.45;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,90,30,0.16)'; ribbon(ctx, pts, a * 3, w * 3.4); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#6A160C'; ribbon(ctx, pts, a * 1.25, w * 1.3); ctx.fill();
  ctx.fillStyle = '#E8441A'; ribbon(ctx, pts, a, w); ctx.fill();
  ctx.fillStyle = '#FF9A2E'; ribbon(ctx, pts, a * 0.55, w * 0.55); ctx.fill();
  ctx.fillStyle = '#FFE08A'; ribbon(ctx, pts, a * 0.18, w * 0.2); ctx.fill();
  ctx.lineCap = 'round';
  ctx.setLineDash([w * 0.8, w * 2.2]);
  ctx.lineDashOffset = -t * 30 - seed * 7;
  ctx.strokeStyle = 'rgba(255,240,170,0.9)'; ctx.lineWidth = Math.max(1.2, w * 0.14);
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); polyTo(ctx, pts); ctx.stroke();
  ctx.setLineDash([]);
  const e = pts[pts.length - 1];
  ctx.fillStyle = '#FFB13B';
  ctx.beginPath(); circleP(ctx, e[0], e[1], w * 0.5); ctx.fill();
  ctx.restore();
}
function drawLavaRivers(ctx, t, P, o) {
  const p = smoothstep(0.58, 0.97, o.erupt);
  if (p <= 0) return;
  strokeLava(ctx, t, partial(LAVA_A, LAVA_A_L, p), 13, 1, 4);
  strokeLava(ctx, t, partial(LAVA_B, LAVA_B_L, clamp(p * 1.1)), 16, 2, 5);
  strokeLava(ctx, t, partial(LAVA_C, LAVA_C_L, clamp(p * 0.9 - 0.1)), 9, 3, 3);
}

// =====================================================================================
// jungle
// =====================================================================================
function jitter(t, seed, rumble) {
  return rumble > 0 ? [noise1(t * 23 + seed) * rumble * 1.6, noise1(t * 19 + seed * 3) * rumble * 1.0] : [0, 0];
}
function band(ctx, B, rim, base, jx, jy, ox = -2.5, oy = -3) {
  if (rim) { ctx.translate(jx + ox, jy + oy); ctx.fillStyle = rim; for (const c of B.chunks) ctx.fill(c); ctx.translate(-jx - ox, -jy - oy); }
  ctx.translate(jx, jy); ctx.fillStyle = base; for (const c of B.chunks) ctx.fill(c); ctx.translate(-jx, -jy);
}
function drawJungleBands(ctx, t, P, o) {
  const [jx, jy] = jitter(t, 1, o.rumble);
  // emergent trees and far palms behind band A
  fillOff(ctx, EMERGENT.trunks, P.g(C.trunk, 0.5), jx, 0);
  fillOff(ctx, EMERGENT.crowns, P.g(C.jFarDeep, 0.52), jx, 0);
  fillOff(ctx, EMERGENT.lit, P.hl(C.jFar, 0.5, 0.8), jx, 0);
  // band A (far)
  band(ctx, JUNGLE.A, P.hl(C.jPale, 0.5, 1), P.g(C.jFar, 0.5), jx, jy);
  band(ctx, JUNGLE.A1, null, P.g(C.jFarDeep, 0.47), jx, jy);
  // far palms between the bands
  fillOff(ctx, FAR_PALMS.trunks, P.g(C.palmDark, 0.38), jx, 0);
  fillOff(ctx, FAR_PALMS.dark, P.g(C.jDeep, 0.38), jx, 0);
  fillOff(ctx, FAR_PALMS.light, P.hl(C.jMid, 0.36, 0.8), jx, 0);
  // band B (mid)
  band(ctx, JUNGLE.B, P.hl(C.jLight, 0.28, 1.2), P.g(C.jMid, 0.28), jx, jy, -3, -3.5);
  band(ctx, JUNGLE.B1, P.hl(C.jMid, 0.26, 0.8), P.g('#327346', 0.26), jx, jy, -3, -3.5);
}
function drawBushBand(ctx, t, P, o) {
  const [jx, jy] = jitter(t, 2, o.rumble);
  band(ctx, JUNGLE.C, P.hl(C.jPale, 0.1, 1.1), P.g('#55A162', 0.1), jx, jy, -3, -3.5);
  band(ctx, JUNGLE.C1, null, P.g(C.jMid, 0.08), jx, jy);
}
function drawFernSet(ctx, t, P, set, far, o, seed) {
  set.forEach((G, i) => {
    const sx = sway(t, seed + i * 2.3, 1.2, 0.9, 0) + (o.rumble ? noise1(t * 22 + i * 5 + seed) * o.rumble * 2.2 : 0);
    ctx.translate(sx, 0);
    ctx.fillStyle = P.g(C.jDeep, far); ctx.fill(G.dark);
    ctx.fillStyle = P.hl(C.jLight, far, 0.9); ctx.fill(G.light);
    ctx.translate(-sx, 0);
  });
}
function drawHeartSet(ctx, t, P, H, far, o, seed) {
  const sx = sway(t, seed, 1, 0.8, 0) + (o.rumble ? noise1(t * 21 + seed) * o.rumble * 2 : 0);
  ctx.translate(sx, 0);
  ctx.strokeStyle = P.g(C.jMid, far); ctx.lineWidth = 2; ctx.stroke(H.stem);
  ctx.fillStyle = P.g(C.jTeal, far); ctx.fill(H.dark);
  ctx.fillStyle = P.hl(C.jLight, far, 0.9); ctx.fill(H.light);
  ctx.translate(-sx, 0);
}
function drawPalm(ctx, t, P, p, rumble) {
  const far = p.far || 0;
  const sw = sway(t, p.seed, 0.022, 0.7, rumble);
  const tx = p.tx + sw * 120, ty = p.ty + Math.abs(sw) * 10;
  const cx = (p.x + tx) / 2 + (p.bend || 0), cy = (p.y + ty) / 2;
  const n = 14, L = [], R = [], mid = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const pt = qpt(p.x, p.y, cx, cy, tx, ty, s), tn = qtan(p.x, p.y, cx, cy, tx, ty, s);
    const w = (lerp(p.w0, p.w1, Math.pow(s, 0.8)) / 2) * (i === 0 ? 1.3 : 1);
    L.push([pt[0] + tn[1] * w, pt[1] - tn[0] * w]); R.push([pt[0] - tn[1] * w, pt[1] + tn[0] * w]); mid.push([pt, tn, w]);
  }
  ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); polyTo(ctx, L); for (let i = n; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]); ctx.closePath();
  ctx.fillStyle = P.g(C.palmDark, far); ctx.fill();
  const lit = L[0][0] < R[0][0] ? L : R;
  ctx.beginPath(); ctx.moveTo(lit[0][0], lit[0][1]); polyTo(ctx, lit);
  for (let i = n; i >= 0; i--) ctx.lineTo(lerp(mid[i][0][0], lit[i][0], -0.15), lerp(mid[i][0][1], lit[i][1], -0.15));
  ctx.closePath();
  ctx.fillStyle = P.hl(C.palm, far, 0.7); ctx.fill();
  ctx.strokeStyle = rgba(P.g(C.palmRing, far), 0.8); ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 1; i < n; i += 1) {
    const [pt, tn, w] = mid[i];
    const nx = tn[1], ny = -tn[0];
    ctx.moveTo(pt[0] + nx * w * 0.95, pt[1] + ny * w * 0.95);
    ctx.quadraticCurveTo(pt[0] + tn[0] * 3, pt[1] + tn[1] * 3, pt[0] - nx * w * 0.95, pt[1] - ny * w * 0.95);
  }
  ctx.stroke();
  const layer = (back) => {
    const dark = new Path2D(), light = new Path2D(), rib = new Path2D();
    p.fronds.forEach((f, i) => {
      if (!!f[3] !== back) return;
      const a = f[0] + sway(t, p.seed + i * 3.1, 0.055, 1.1, rumble);
      const len = p.len * f[1];
      const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len + len * 0.28 * f[2];
      const qx = tx + Math.cos(a) * len * 0.55, qy = ty + Math.sin(a) * len * 0.55 - len * 0.22;
      addLeaf(dark, light, null, leafPts(tx, ty, qx, qy, ex, ey, len * 0.17, 14, true));
    });
    ctx.fillStyle = P.g(back ? '#255C3C' : C.jDeep, far); ctx.fill(dark);
    ctx.fillStyle = P.hl(back ? C.jMid : C.jLight, far, 0.9); ctx.fill(light);
  };
  layer(true);
  ctx.fillStyle = P.g(C.coconut, far);
  ctx.beginPath(); for (let k = 0; k < 3; k++) circleP(ctx, tx - 7 + k * 7, ty + 6 + (k % 2) * 3, 6); ctx.fill();
  ctx.fillStyle = rgba(P.rim, 0.35);
  ctx.beginPath(); for (let k = 0; k < 3; k++) circleP(ctx, tx - 9 + k * 7, ty + 4 + (k % 2) * 3, 2.3); ctx.fill();
  layer(false);
}
// palm fronds: [angle, lengthFactor, droop, back?]
const FRONDS_A = [[-2.75, 1, 0.9, 1], [-2.2, 0.95, 0.6, 1], [-1.65, 0.8, 0.2, 1], [-1.05, 0.9, 0.5, 1], [-0.45, 1, 0.9, 1],
  [-3.05, 0.95, 1.3, 0], [0.05, 0.95, 1.3, 0], [-2.5, 0.85, 0.4, 0], [-0.75, 0.85, 0.45, 0], [2.6, 0.7, 1.4, 0], [0.6, 0.7, 1.4, 0]];
const PALMS = [
  { x: 486, y: 456, tx: 434, ty: 214, bend: 34, w0: 20, w1: 11, len: 126, fronds: FRONDS_A, seed: 21, far: 0.1 },
  { x: 1300, y: 476, tx: 1216, ty: 138, bend: 40, w0: 24, w1: 12, len: 140, fronds: FRONDS_A, seed: 37, far: 0.04 },
];
function drawBanana(ctx, P, x, y, s, t, seed, rumble, far, flip = 1) {
  ctx.fillStyle = P.g('#6E9A4A', far);
  ctx.beginPath(); ctx.moveTo(x - 6 * s, y); ctx.lineTo(x - 3 * s, y - 70 * s); ctx.lineTo(x + 3 * s, y - 70 * s); ctx.lineTo(x + 6 * s, y); ctx.closePath(); ctx.fill();
  const leaves = [[-2.5, 1, 0.5], [-1.85, 1.1, 0.25], [-1.2, 1.05, 0.25], [-0.6, 0.95, 0.5], [-2.1, 0.8, 0.1], [-1.0, 0.8, 0.1]];
  const dark = new Path2D(), light = new Path2D(), rib = new Path2D();
  leaves.forEach(([a0, lf, dr], i) => {
    const a = (flip > 0 ? a0 : -PI - a0) + sway(t, seed + i * 1.3, 0.05, 0.9, rumble);
    const L = 95 * s * lf, W = 22 * s;
    const x0 = x, y0 = y - 66 * s;
    const ex = x0 + Math.cos(a) * L, ey = y0 + Math.sin(a) * L + L * dr;
    const cx = x0 + Math.cos(a) * L * 0.5, cy = y0 + Math.sin(a) * L * 0.5 - L * 0.18;
    const lp = leafPts(x0, y0, cx, cy, ex, ey, W, 16, false, (u) => Math.pow(Math.sin(PI * Math.min(1, u * 1.02)), 0.55) * (u < 0.08 ? u / 0.08 : 1));
    // tears in the blade (banana leaves split)
    for (const k of [5, 9, 12]) if (lp.A[k]) { const S = lp.S[k + 1]; lp.A[k] = [lerp(S[0], lp.A[k][0], 0.25), lerp(S[1], lp.A[k][1], 0.25)]; }
    addLeaf(dark, light, rib, lp);
  });
  ctx.fillStyle = P.g('#2E6E44', far); ctx.fill(dark);
  ctx.fillStyle = P.hl(C.jLight, far, 0.9); ctx.fill(light);
  ctx.strokeStyle = P.g(C.jPale, far); ctx.lineWidth = 1.5; ctx.stroke(rib);
}
function drawVines(ctx, t, P, list, rumble) {
  const stem = new Path2D(), lv = new Path2D(), lv2 = new Path2D();
  for (const v of list) {
    const a = sway(t, v.seed, 0.06, 0.8, rumble);
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const s = i / 12;
      pts.push([v.x + Math.sin(a * s * 2.2) * v.len * 0.35 * s + Math.sin(s * 5 + v.seed) * 6, v.y + s * v.len]);
    }
    stem.moveTo(pts[0][0], pts[0][1]); polyTo(stem, pts.slice(1));
    for (let i = 1; i <= 12; i++) {
      const dir = i % 2 ? 1 : -1, s = 0.7 + 0.5 * hash1(v.seed * 9 + i), [x, y] = pts[i];
      const P2 = i % 3 === 0 ? lv2 : lv;
      P2.moveTo(x, y);
      P2.quadraticCurveTo(x + dir * 5 * s, y - 7 * s, x + dir * 13 * s, y + 2 * s);
      P2.quadraticCurveTo(x + dir * 5 * s, y + 6 * s, x, y);
      P2.closePath();
    }
  }
  ctx.strokeStyle = P.g('#355E36'); ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.stroke(stem);
  ctx.fillStyle = P.hl(C.jMid, 0, 0.8); ctx.fill(lv);
  ctx.fillStyle = P.hl(C.jLight, 0, 1.1); ctx.fill(lv2);
}
function drawCanopy(ctx, t, P, cn, side, o) {
  const sx = sway(t, side * 7 + 1, 2.2, 0.45, o.rumble) + (o.rumble ? noise1(t * 20 + side) * o.rumble * 2 : 0);
  const dk = (c, k) => mix(P.g(c), P.g('#10261A'), k);
  ctx.translate(sx, 0);
  fillOff(ctx, cn.base, rgba(P.rim, 0.45 + 0.3 * P.rimA), side ? 3 : -3, -3);
  fillOff(ctx, cn.base, dk(C.jDeep, 0.35));
  fillOff(ctx, cn.inner, P.hl(C.jDeep, 0, 0.5), side ? 2 : -2, -2);
  fillOff(ctx, cn.inner, dk(C.jMid, 0.28));
  fillOff(ctx, cn.inner2, dk(C.jMid, 0.15));
  ctx.translate(-sx, 0);
}
function drawBigTreeLeft(ctx, t, P, o) {
  ctx.fillStyle = P.g(C.trunkDark);
  ctx.beginPath();
  ctx.moveTo(-70, 558); ctx.quadraticCurveTo(-24, 520, 0, 480); ctx.lineTo(16, 492); ctx.quadraticCurveTo(-8, 532, -30, 560); ctx.closePath();
  ctx.moveTo(150, 556); ctx.quadraticCurveTo(90, 528, 64, 482); ctx.lineTo(50, 494); ctx.quadraticCurveTo(74, 534, 104, 560); ctx.closePath();
  ctx.fill();
  const L = [[-30, 556], [-14, 480], [-2, 380], [8, 270], [16, 150], [24, 20], [30, -150]];
  const R = [[66, -150], [62, 20], [58, 150], [54, 270], [56, 380], [70, 480], [106, 558]];
  ctx.beginPath();
  ctx.moveTo(L[0][0], L[0][1]); splineTo(ctx, L); ctx.lineTo(R[0][0], R[0][1]); splineTo(ctx, R);
  ctx.quadraticCurveTo(40, 548, -30, 556); ctx.closePath();
  ctx.fillStyle = P.g('#3E312A'); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(L[0][0], L[0][1]); splineTo(ctx, L);
  ctx.lineTo(44, -150); splineTo(ctx, [[44, -150], [42, 20], [36, 150], [30, 270], [26, 380], [30, 480], [20, 556]]);
  ctx.closePath();
  ctx.fillStyle = P.g(C.trunk); ctx.fill();
  ctx.strokeStyle = rgba(P.rim, 0.4 + P.rimA * 0.35); ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(L[1][0] + 2, L[1][1]); splineTo(ctx, L.slice(1).map(([x, y]) => [x + 2, y])); ctx.stroke();
  ctx.strokeStyle = rgba(P.g('#2C221D'), 0.5); ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) { const x = 12 + i * 10; ctx.moveTo(x, 530 - i * 6); ctx.bezierCurveTo(x - 6, 400, x + 4, 260, x - 2 + i, 60 - i * 20); }
  ctx.stroke();
  ctx.fillStyle = P.g(C.trunkDark);
  ribbon(ctx, openSpline([[40, 170], [110, 124], [200, 96], [286, 70]], 4), 22, 6);
  ctx.fill();
  drawCanopy(ctx, t, P, CANOPY_L, 0, o);
}
function drawBigTreeRight(ctx, t, P, o) {
  ctx.fillStyle = P.g('#3E312A');
  ctx.beginPath();
  ctx.moveTo(1384, 540); ctx.quadraticCurveTo(1398, 260, 1394, -100); ctx.lineTo(1450, -100); ctx.quadraticCurveTo(1448, 260, 1474, 544); ctx.closePath();
  ctx.fill();
  ribbon(ctx, openSpline([[1400, 120], [1330, 84], [1250, 60]], 4), 20, 6);
  ctx.fill();
  drawCanopy(ctx, t, P, CANOPY_R, 1, o);
}
function drawLightRays(ctx, t, P) {
  if (P.rays <= 0.02) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const sx = P.sunX + 40, sy = P.sunY + 40;
  for (let i = 0; i < 4; i++) {
    const ang = 0.64 + i * 0.15 + noise1(t * 0.07 + i * 3) * 0.015;
    const sp = 0.012 + hash1(i * 1.3) * 0.016;
    const len = 620 + hash1(i * 2.2) * 260;
    ctx.fillStyle = rgba(P.sunCol, (0.018 + hash1(i * 3.1) * 0.02) * P.rays * (0.75 + 0.25 * Math.sin(t * 0.35 + i * 1.7)));
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(ang - sp) * len, sy + Math.sin(ang - sp) * len);
    ctx.lineTo(sx + Math.cos(ang + sp) * len * 0.96, sy + Math.sin(ang + sp) * len * 0.96);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// =====================================================================================
// ground, rocks, water
// =====================================================================================
function drawGround(ctx, t, P) {
  const stops = [[440, P.g(C.ground, 0.06)], [520, P.g(C.groundMid)], [820, P.g(C.groundDark)]];
  for (const b of GROUND_BANDS) { ctx.fillStyle = stopsColor(stops, b.y); ctx.fill(b.path); }
}
// device pixels per world unit (level-of-detail decisions; 1.5 = 1080p at camera zoom 1)
function devScale(ctx) { const m = ctx.getTransform(); return Math.hypot(m.a, m.b); }
function drawRocks(ctx, P, R, style, lod = 9) {
  const st = style || ROCK_STYLE;
  const detail = lod >= 2.4;
  for (const G of R.groups) {
    if (detail) { ctx.fillStyle = P.g(st.dark); ctx.fill(G.out); ctx.fillStyle = P.g(st.shade); ctx.fill(G.shade); ctx.fill(G.shadeS); } else { ctx.fillStyle = mix(P.g(st.shade), P.g(st.dark), 0.3); ctx.fill(G.out); }
    ctx.fillStyle = P.g(st.base); ctx.fill(G.lit);
    ctx.fillStyle = P.hl(st.light, 0, 0.9); ctx.fill(G.hl); if (detail) ctx.fill(G.hlS);
    if (st.moss) {
      ctx.fillStyle = P.g(st.moss); ctx.fill(G.moss);
      ctx.fillStyle = P.hl(st.mossLight, 0, 0.9); ctx.fill(G.mossHl); if (detail) ctx.fill(G.mossHlS);
    }
  }
  ctx.fillStyle = rgba(P.wHi, 0.65); ctx.fill(R.glint);
}
const ROCK_STYLE = { shade: C.rockShade, dark: C.rockDark, base: C.rock, light: C.rockLight, moss: C.moss, mossLight: C.mossLight };
const ROCK_STYLE_NEW = { shade: '#C9A58C', dark: '#9A7462', base: '#EBCDB0', light: '#FFF2E0', moss: '#8FCB6A', mossLight: '#C2E886' };
function drawWaterBands(ctx, P, heat = 0) {
  const k = heat > 0.3 ? (heat - 0.3) * 0.22 : 0;
  for (let i = 0; i < RIVER_BANDS.length; i++) { ctx.fillStyle = k ? mix(P.riverCols[i], '#F4FFFC', k) : P.riverCols[i]; ctx.fill(RIVER_BANDS[i].path); }
  for (let i = 0; i < POOL_BANDS.length; i++) { ctx.fillStyle = k ? mix(P.poolCols[i], '#F4FFFC', k) : P.poolCols[i]; ctx.fill(POOL_BANDS[i].path); }
}
// surface detail shared by the back water and the front water (must match exactly)
function drawWaterSurface(ctx, t, P, o) {
  const heat = o.waterHeat, rum = o.rumble;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = P.wHi;
  const jit = rum * 3 + heat * heat * 3;
  for (let bin = 0; bin < 3; bin++) {
    ctx.globalAlpha = [0.45, 0.55, 0.6][bin];
    ctx.lineWidth = [1.2, 2, 3][bin];
    ctx.beginPath();
    for (const s of SHIMMER) {
      if (s.bin !== bin) continue;
      const x = s.x + Math.sin(t * 0.5 * s.sp + s.ph) * 10 * (0.4 + s.k) + (jit ? noise1(t * 9 + s.ph * 5) * jit : 0);
      const len = s.len * (0.55 + 0.45 * Math.sin(t * 1.1 * s.sp + s.ph * 2));
      if (len < 2) continue;
      const y = s.y + Math.sin(t * 1.3 + s.ph) * 1.2;
      ctx.moveTo(x - len / 2, y); ctx.lineTo(x + len / 2, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (rum > 0.02) {
    const n = Math.round(6 + 14 * rum);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const per = 0.9 + hash1(i * 3.7) * 0.6;
      const tt = t / per + hash1(i * 1.9);
      const cyc = Math.floor(tt), k = tt - cyc;
      const y = lerp(476, 790, Math.pow(hash2(i, cyc), 1.2));
      const sp = poolSpan(y);
      if (!sp) continue;
      const x = lerp(sp[0] + 30, sp[1] - 30, hash2(i * 7, cyc + 3));
      const sc = depthScale(y);
      const r = (6 + k * 46) * sc;
      ctx.globalAlpha = (1 - k) * 0.6 * rum;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.2, 0, 0, TAU); ctx.ellipse(x, y, r * 0.55, r * 0.11, 0, TAU, 0, true); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (heat > 0.18) {
    const a = smoothstep(0.18, 1, heat);
    for (const row of BUBBLE_ROWS) drawBubbles(ctx, t, { x: row.x, y: row.y, w: row.w, h: row.h, amount: a, scale: row.s, seed: row.seed, color: P.wHi });
  }
}
const BUBBLE_ROWS = [
  { x: 660, y: 484, w: 760, h: 22, s: 0.6, seed: 1 },
  { x: 680, y: 532, w: 930, h: 40, s: 0.75, seed: 2 },
  { x: 690, y: 602, w: 960, h: 60, s: 0.9, seed: 3 },
  { x: 690, y: 700, w: 900, h: 80, s: 1.1, seed: 4 },
];
function drawPoolWater(ctx, t, P, o) {
  drawWaterBands(ctx, P, o.waterHeat);
  ctx.save();
  // reflection band under the back rim
  ctx.beginPath();
  ctx.moveTo(196, backY(196));
  for (let x = 196; x <= 1188; x += 12) ctx.lineTo(x, backY(x) - 1);
  for (let x = 1188; x >= 196; x -= 12) ctx.lineTo(x, backY(x) + 13 + Math.sin(x * 0.045 + t * 1.2) * 2.5 + Math.sin(x * 0.11 - t) * 1.5);
  ctx.closePath();
  ctx.fillStyle = rgba(P.wRefl, 0.34);
  ctx.fill();
  // soft sky reflections (two pale streaks)
  ctx.fillStyle = rgba(P.wHi, 0.13);
  ctx.beginPath(); ellipseP(ctx, 520 + Math.sin(t * 0.2) * 10, 506, 300, 5); ellipseP(ctx, 860 + Math.sin(t * 0.17 + 1) * 10, 538, 240, 6); ellipseP(ctx, 600 + Math.sin(t * 0.13 + 2) * 12, 660, 380, 8); ctx.fill();
  // river flow lines (moving left) + foam at the mouth
  ctx.strokeStyle = P.wHi; ctx.lineCap = 'round'; ctx.globalAlpha = 0.6; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const y = 572 + hash1(i * 2.7) * 52;
    const x = 190 - ((t * (40 + hash1(i) * 30) + hash1(i * 5.1) * 640) % 640);
    const len = 14 + hash1(i * 3.3) * 30;
    ctx.moveTo(x, y); ctx.lineTo(x + len, y + 0.4);
  }
  ctx.stroke();
  ctx.globalAlpha = 0.75; ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const y = 570 + i * 11, x = 172 + Math.sin(t * 3 + i * 2) * 3;
    ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 6, y - 3, x - 12, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
  if (P.sunDisc > 0.05 && o.setting === 'evening') {
    // golden glitter path below the low sun
    ctx.save();
    ctx.fillStyle = rgba(mix(P.sunCol, '#FFFFFF', 0.3), 0.75 * P.sunDisc);
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      const y = 474 + Math.pow(i / 26, 1.3) * 300;
      const sp = 14 + (y - 470) * 0.32;
      const x = P.sunX + 20 + (hash1(i * 7.3) - 0.5) * sp * 2 + Math.sin(t * 1.3 + i) * 6;
      const len = (10 + (y - 470) * 0.14) * (0.5 + 0.5 * Math.sin(t * 2.1 + i * 1.7));
      const th = 1 + (y - 470) * 0.008;
      if (len > 2) ellipseP(ctx, x, y, len, th);
    }
    ctx.fill();
    ctx.restore();
  }
  drawWaterSurface(ctx, t, P, o);
  if (o.erupt > 0.05) {
    const k = smoothstep(0.05, 0.4, o.erupt);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [rx, ry, a] of [[460, 70, 0.08], [300, 46, 0.1], [160, 26, 0.12]]) {
      ctx.fillStyle = `rgba(255,110,40,${a * k})`;
      ctx.beginPath(); ellipseP(ctx, 860, 488, rx, ry); ctx.fill();
    }
    ctx.restore();
  }
}
function drawMoorPost(ctx, P, x, y) {
  ctx.save();
  ctx.fillStyle = P.g(C.woodDark);
  roundRect(ctx, x - 6, y - 46, 12, 52, 4); ctx.fill();
  ctx.fillStyle = P.hl(C.wood, 0, 0.6);
  roundRect(ctx, x - 6, y - 46, 6, 52, 3); ctx.fill();
  ctx.fillStyle = P.g(C.woodLight);
  ellipse(ctx, x, y - 46, 6, 2.4); ctx.fill();
  ctx.strokeStyle = P.g('#D8C08A'); ctx.lineWidth = 2;
  ctx.beginPath();
  for (let k = 0; k < 3; k++) { ctx.moveTo(x + 8, y - 30 + k * 4); ctx.ellipse(x, y - 30 + k * 4, 8, 2.6, 0, 0, TAU); }
  ctx.stroke();
  ctx.restore();
}

// =====================================================================================
// sign
// =====================================================================================
const GLYPHS = new Map(); // layout cache: pure function of (text, size, weight, seed)
function paintText(ctx, text, x, y, size, weight, color, shadow, seed, maxW) {
  ctx.font = `${weight} ${size}px Fredoka`;
  const key = text + '|' + size + '|' + weight + '|' + seed;
  let L = GLYPHS.get(key);
  if (!L) {
    const w = ctx.measureText(text).width;
    let cx = -w / 2;
    const glyphs = [];
    for (let i = 0; i < text.length; i++) {
      const cw = ctx.measureText(text[i]).width;
      if (text[i] !== ' ') glyphs.push([text[i], cx + cw / 2, (hash1(seed + i * 7.1) - 0.5) * size * 0.07, (hash1(seed + i * 3.3) - 0.5) * 0.09, cw]);
      cx += cw;
    }
    L = { w, glyphs };
    if (GLYPHS.size < 200) GLYPHS.set(key, L);
  }
  const sc = maxW && L.w > maxW ? maxW / L.w : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sc, 1);
  ctx.textBaseline = 'middle';
  for (const pass of shadow ? [0, 1] : [1]) {
    ctx.fillStyle = pass ? color : shadow;
    const ox = pass ? 0 : size * 0.04, oy = pass ? 0 : size * 0.06;
    for (const [ch, gx, dy, rot, cw] of L.glyphs) {
      const c = Math.cos(rot), s = Math.sin(rot);
      ctx.transform(c, s, -s, c, gx, dy);
      ctx.fillText(ch, -cw / 2 + ox, oy);
      ctx.transform(c, -s, s, c, -gx * c - dy * s, gx * s - dy * c);
    }
  }
  ctx.restore();
}
function drawFlame(ctx, x, y, h, w, t, seed) {
  const f = 0.75 + 0.35 * noise1(t * 9 + seed * 3.1);
  const H = h * f, sx = noise1(t * 4 + seed) * w * 0.6;
  const layer = (k, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - w * k, y);
    ctx.bezierCurveTo(x - w * k * 1.1, y - H * k * 0.5, x + sx * k - w * 0.25 * k, y - H * k * 0.7, x + sx, y - H * k);
    ctx.bezierCurveTo(x + sx * k + w * 0.3 * k, y - H * k * 0.6, x + w * k * 1.1, y - H * k * 0.4, x + w * k, y);
    ctx.quadraticCurveTo(x, y + w * k * 0.4, x - w * k, y);
    ctx.fill();
  };
  layer(1, 'rgba(232,64,26,0.92)');
  layer(0.68, '#FF9A2E');
  layer(0.36, '#FFE58A');
}
function drawSnoozeSignImpl(ctx, t, P, o) {
  const burn = o.burn || 0;
  const lines = o.lines || ['SNOOZE SPRINGS', 'No Worries Allowed'];
  const sc = o.scale || 1;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(sc, sc);
  const ch = (c) => (burn > 0 ? mix(P.g(c), '#1E120C', burn * 0.75) : P.g(c));
  // posts
  ctx.fillStyle = ch(C.woodDark);
  ctx.beginPath(); for (const px of [-74, 74]) { ctx.rect(px - 7, -126, 14, 130); } ctx.fill();
  ctx.fillStyle = ch(C.wood);
  ctx.beginPath(); for (const px of [-74, 74]) { ctx.rect(px - 7, -126, 6, 130); } ctx.fill();
  ctx.fillStyle = ch(C.woodLight);
  ctx.beginPath(); for (const px of [-74, 74]) ellipseP(ctx, px, -126, 7, 2.6); ctx.fill();
  // shadow under the board on the posts
  ctx.fillStyle = rgba('#000000', 0.18);
  ctx.beginPath(); for (const px of [-74, 74]) ctx.rect(px - 7, -32, 14, 8); ctx.fill();
  const plank = (py, h, rot, w, seed) => {
    ctx.save();
    ctx.translate(0, py);
    ctx.rotate(rot);
    roundRect(ctx, -w / 2, -h / 2, w, h, 6);
    ctx.fillStyle = ch(C.wood); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = ch(C.woodDeep); ctx.stroke();
    ctx.strokeStyle = rgba(ch(C.woodDark), 0.5); ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const gy = -h / 2 + (k + 0.8) * (h / 4.4);
      ctx.moveTo(-w / 2 + 8, gy);
      ctx.bezierCurveTo(-w / 6, gy + (hash1(seed + k) - 0.5) * 6, w / 6, gy - (hash1(seed + k * 2) - 0.5) * 6, w / 2 - 10 - hash1(seed * 3 + k) * 30, gy + 1);
    }
    ctx.stroke();
    ctx.fillStyle = rgba(P.hl(C.woodLight, 0, 1), 0.7);
    roundRect(ctx, -w / 2 + 4, -h / 2 + 2, w - 8, 4, 2); ctx.fill();
    ctx.fillStyle = ch('#4A3A30');
    ctx.beginPath(); circleP(ctx, -74, 0, 2.4); circleP(ctx, 74, 0, 2.4); ctx.fill();
    ctx.restore();
  };
  plank(-92, 44, -0.025, 214, 3);
  plank(-50, 34, 0.018, 196, 9);
  const paint = burn > 0 ? mix(P.g(C.paint), '#3A2A22', burn * 0.6) : P.g(C.paint);
  const sh = rgba('#4A2A14', 0.45);
  ctx.save(); ctx.rotate(-0.025);
  paintText(ctx, lines[0], 0, -92, 27, 700, paint, sh, 11, 190);
  ctx.restore();
  ctx.save(); ctx.rotate(0.018);
  const c2 = o.check ? paint : (burn > 0 ? mix(P.g(C.paint2), '#3A2A22', burn * 0.6) : P.g(C.paint2));
  paintText(ctx, lines[1] || '', o.check ? -16 : 0, -50, 18, 600, c2, sh, 23, o.check ? 146 : 176);
  ctx.restore();
  if (o.check) {
    ctx.save();
    ctx.translate(76, -52);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = rgba('#20401A', 0.45); ctx.lineWidth = 7.5;
    ctx.beginPath(); ctx.moveTo(-10, 1); ctx.lineTo(-3, 9); ctx.quadraticCurveTo(4, -6, 17, -17); ctx.stroke();
    ctx.strokeStyle = P.g('#5BD15A'); ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-11, -1); ctx.lineTo(-4, 7); ctx.quadraticCurveTo(3, -8, 16, -19); ctx.stroke();
    ctx.strokeStyle = rgba('#D8FFC8', 0.7); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-10, -3); ctx.lineTo(-5, 3); ctx.stroke();
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(86, -110); ctx.rotate(-0.2);
    ctx.fillStyle = rgba(paint, 0.85);
    ctx.font = '700 11px Fredoka'; ctx.fillText('z', 0, 0);
    ctx.font = '700 8px Fredoka'; ctx.fillText('z', 8, -6);
    ctx.restore();
  }
  if (burn > 0) {
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const k = frac(t * 0.5 + i / 6);
      ctx.globalAlpha = burn * (1 - k) * 0.45;
      ctx.fillStyle = '#3A3034';
      ctx.beginPath(); circleP(ctx, -40 + i * 16 + k * 30, -120 - k * 140, 10 + k * 26); ctx.fill();
    }
    ctx.restore();
    const n = Math.round(4 + burn * 9);
    for (let i = 0; i < n; i++) {
      const fx = -96 + (i / Math.max(1, n - 1)) * 192 + (hash1(i * 4.1) - 0.5) * 14;
      const fy = (i % 3 === 0 ? -30 : -36) - burn * 20 * hash1(i * 2.2);
      const h = (16 + 70 * burn) * (0.6 + 0.6 * hash1(i * 5.5));
      drawFlame(ctx, fx, fy, h, 9 + 7 * burn, t, i * 1.7);
    }
    if (burn > 0.5) { drawFlame(ctx, -74, -100, 40 * burn, 10, t, 41); drawFlame(ctx, 74, -96, 46 * burn, 10, t, 43); }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [r, a] of [[160, 0.1], [100, 0.14]]) {
      ctx.fillStyle = `rgba(255,120,40,${a * burn})`;
      ctx.beginPath(); circleP(ctx, 0, -70, r); ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

// =====================================================================================
// lava into the pool
// =====================================================================================
function lavaBlobPts(cx, cy, rx, ry, t, seed) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const k = 1 + 0.16 * noise1(i * 1.7 + seed + t * 0.25) + 0.08 * Math.sin(a * 3 + seed);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}
const LAVA_PLATES = (() => {
  const r = rng(616), out = [];
  for (let i = 0; i < 46; i++) {
    const a = r() * TAU, d = Math.sqrt(r());
    const pts = [];
    const n = 6, rr = r.range(0.07, 0.13);
    for (let k = 0; k < n; k++) { const b = (k / n) * TAU + r.range(-0.2, 0.2); pts.push([Math.cos(b) * rr * r.range(0.7, 1.15), Math.sin(b) * rr * r.range(0.7, 1.15)]); }
    out.push({ u: Math.cos(a) * d * 0.86, v: Math.sin(a) * d * 0.8, pts, sh: r.range(0, 1) });
  }
  return out;
})();
function drawLavaPool(ctx, t, cx, cy, rx, ry, sd) {
  const pts = lavaBlobPts(cx, cy, rx, ry, t, sd);
  ctx.fillStyle = 'rgba(255,110,40,0.22)';
  ctx.beginPath(); blobP(ctx, pts.map(([x, y]) => [cx + (x - cx) * 1.18, cy + (y - cy) * 1.4])); ctx.fill();
  ctx.fillStyle = '#7A1C0E'; ctx.beginPath(); blobP(ctx, pts.map(([x, y]) => [x, y + 2])); ctx.fill();
  ctx.fillStyle = '#FF6A22'; ctx.beginPath(); blobP(ctx, pts); ctx.fill();
  ctx.fillStyle = '#FFB13B'; ctx.beginPath(); blobP(ctx, pts.map(([x, y]) => [cx + (x - cx) * 0.8, cy + (y - cy) * 0.72])); ctx.fill();
  // dark crust plates drifting on the melt, cooling toward the edges
  const crust = new Path2D(), crustHi = new Path2D();
  for (const pl of LAVA_PLATES) {
    const px = cx + pl.u * rx + Math.sin(t * 0.3 + pl.sh * 6) * 3, py = cy + pl.v * ry;
    const s = Math.max(rx, ry * 3) * (0.9 + 0.3 * (Math.abs(pl.u) + Math.abs(pl.v)));
    const k = ry / Math.max(1, rx) * 2.2;
    crust.moveTo(px + pl.pts[0][0] * s, py + pl.pts[0][1] * s * k);
    for (const [u, v] of pl.pts) crust.lineTo(px + u * s, py + v * s * k);
    crust.closePath();
    crustHi.moveTo(px + pl.pts[3][0] * s * 0.6, py + pl.pts[3][1] * s * k * 0.6 - 1);
    crustHi.lineTo(px + pl.pts[4][0] * s * 0.6, py + pl.pts[4][1] * s * k * 0.6 - 1);
    crustHi.lineTo(px + pl.pts[5][0] * s * 0.6, py + pl.pts[5][1] * s * k * 0.6 - 1);
  }
  ctx.save();
  ctx.beginPath(); blobP(ctx, pts.map(([x, y]) => [cx + (x - cx) * 0.94, cy + (y - cy) * 0.9])); ctx.clip();
  ctx.fillStyle = '#3A1E1A'; ctx.fill(crust);
  ctx.strokeStyle = '#6A3A30'; ctx.lineWidth = 1.2; ctx.stroke(crustHi);
  ctx.restore();
  ctx.strokeStyle = `rgba(255,236,160,${0.75 + 0.25 * noise1(t * 4 + sd)})`; ctx.lineWidth = 2;
  ctx.beginPath(); blobP(ctx, pts); ctx.stroke();
}
function drawLavaToPool(ctx, t, P, o) {
  const L = o.lava;
  if (L <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [r, a] of [[220, 0.08], [130, 0.12]]) {
    ctx.fillStyle = `rgba(255,110,40,${a * Math.min(1, L * 2)})`;
    ctx.beginPath(); ellipseP(ctx, 1010, 458, r * 1.3, r * 0.6); ctx.fill();
  }
  ctx.restore();
  const fb = smoothstep(0.03, 0.3, L);
  if (fb > 0) {
    [[900, 426, 1], [936, 432, 2], [1004, 440, 3], [1070, 432, 4], [1096, 440, 5], [872, 424, 6], [1160, 446, 7], [960, 420, 8]].forEach(([fx, fy, s], i) => {
      const k = clamp(fb * 1.6 - i * 0.1);
      if (k > 0) drawFlame(ctx, fx, fy, 34 * k, 10, t, s);
    });
  }
  const p1 = clamp(L / 0.3), p2 = clamp((L - 0.12) / 0.3);
  strokeLava(ctx, t, partial(LAVA_P1, LAVA_P1_L, p1), 26, 4, 14);
  if (p2 > 0) strokeLava(ctx, t, partial(LAVA_P2, LAVA_P2_L, p2), 18, 5, 10);
  const pour = smoothstep(0.26, 0.4, L);
  if (pour > 0) {
    const yb = lerp(462, 488, pour);
    ctx.fillStyle = '#E8441A';
    ctx.beginPath(); ctx.moveTo(980, 462); ctx.quadraticCurveTo(988, 474, 976, yb); ctx.lineTo(1012, yb); ctx.quadraticCurveTo(1006, 472, 1004, 462); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FFB13B';
    ctx.beginPath(); ctx.moveTo(986, 463); ctx.quadraticCurveTo(992, 474, 986, yb - 2); ctx.lineTo(998, yb - 2); ctx.quadraticCurveTo(1000, 472, 996, 463); ctx.closePath(); ctx.fill();
  }
  const k = smoothstep(0.3, 1, L);
  if (k > 0) {
    ctx.save();
    ctx.beginPath(); blobP(ctx, POOL_PTS); ctx.clip();
    drawLavaPool(ctx, t, lerp(996, 952, k), lerp(480, 502, k), 20 + 240 * k, 7 + 42 * k, 1);
    const k2 = clamp((L - 0.4) / 0.6);
    if (k2 > 0.05) drawLavaPool(ctx, t, 1138, lerp(488, 520, k2), 12 + 100 * k2, 6 + 36 * k2, 2);
    ctx.restore();
    drawSteam(ctx, t, { x: lerp(990, 930, k), y: lerp(482, 524, k), w: 140 + 440 * k, amount: 0.6 + 0.8 * k, h: 230, scale: 1.5, color: P.steam, seed: 41 });
  }
}

// =====================================================================================
// particles
// =====================================================================================
function drawSteam(ctx, t, o = {}) {
  const x = o.x ?? 640, y = o.y ?? 520, w = o.w ?? 600, amount = clamp(o.amount ?? 0.5, 0, 2);
  const h = o.h ?? 120, scale = o.scale ?? 1, color = o.color || '#FFFFFF', seed = o.seed ?? 1;
  if (amount <= 0.001) return;
  const N = Math.max(1, Math.round((amount * w) / (60 * scale)));
  const [cr, cg, cb] = U.hexToRgb(color);
  const A = 0.16 + 0.16 * Math.min(1, amount);
  for (let i = 0; i < N; i++) {
    const L = 3 + hash1(seed * 31 + i * 1.7) * 2.4;
    const tt = t / L + hash1(seed * 17 + i * 3.3);
    const cyc = Math.floor(tt), k = tt - cyc;
    const px = x - w / 2 + w * hash2(i + seed * 7, cyc * 1.31);
    const yy = y - k * h * scale * (0.7 + 0.6 * hash1(i * 9.7 + seed));
    const xx = px + Math.sin(k * 4 + i) * 9 * scale * k + 10 * k * scale;
    const r = (14 + 34 * k) * scale * (0.75 + 0.3 * Math.min(1, amount));
    const a = Math.sin(PI * Math.min(1, k * 1.15)) * A;
    if (a < 0.01) continue;
    const g = ctx.createRadialGradient(xx, yy, 0, xx, yy, r);
    g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`); g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(xx - r, yy - r, 2 * r, 2 * r);
  }
  // stylised curly wisps
  const M = Math.max(1, Math.round((amount * w) / 220));
  const inner = new Path2D(), outer = new Path2D();
  for (let i = 0; i < M; i++) {
    const L = 3.6 + hash1(seed * 13 + i * 2.9) * 2;
    const tt = t / L + hash1(seed * 5 + i * 1.1);
    const cyc = Math.floor(tt), k = tt - cyc;
    const px = x - w / 2 + w * hash2(i * 3 + seed, cyc * 2.7 + 1);
    const hh = h * scale * 0.6;
    const pts = [];
    for (let j = 0; j <= 10; j++) {
      const s = j / 10;
      pts.push([px + Math.sin(s * 6.5 + k * 3 + i) * 7 * scale * (0.5 + s), y - 6 * scale - k * hh * 0.7 - s * hh * 0.5]);
    }
    const a = Math.sin(PI * k);
    ribbonP(a > 0.5 ? inner : outer, pts, 0, 0, (s) => Math.sin(PI * s) * 4 * scale);
  }
  ctx.fillStyle = `rgba(${cr},${cg},${cb},${0.16 * Math.min(1, amount + 0.4)})`; ctx.fill(outer);
  ctx.fillStyle = `rgba(${cr},${cg},${cb},${0.32 * Math.min(1, amount + 0.4)})`; ctx.fill(inner);
}
function drawBubbles(ctx, t, o = {}) {
  const x = o.x ?? 640, y = o.y ?? 560, w = o.w ?? 400, h = o.h ?? 30, amount = clamp(o.amount ?? 0.5);
  const scale = o.scale ?? 1, seed = o.seed ?? 3, color = o.color || '#DAFAF4';
  if (amount <= 0.001) return;
  ctx.save();
  const N = Math.round((amount * w) / 16);
  const body = new Path2D(), spec = new Path2D(), rings = new Path2D();
  for (let i = 0; i < N; i++) {
    const L = 0.8 + hash1(seed * 7 + i * 1.3) * 0.9;
    const tt = t / L + hash1(seed * 3 + i * 7.7);
    const cyc = Math.floor(tt), k = tt - cyc;
    const bx = x - w / 2 + w * hash2(i + seed * 11, cyc * 1.7);
    const by = y - h / 2 + h * hash2(i * 5 + seed, cyc * 3.1 + 2);
    if (!inPool(bx, by)) continue;
    const rmax = (2 + 3.5 * hash1(i * 4.3 + cyc)) * scale * (0.7 + 0.5 * amount);
    if (k < 0.75) {
      const r = rmax * Math.sqrt(k / 0.75);
      ellipseP(body, bx, by - r * 0.3, r, r * 0.8);
      circleP(spec, bx - r * 0.35, by - r * 0.65, r * 0.25);
    } else {
      const kk = (k - 0.75) / 0.25;
      ellipseP(rings, bx, by, rmax * (1 + kk * 2), rmax * 0.3 * (1 + kk * 2));
    }
  }
  ctx.lineWidth = 1.1 * scale;
  ctx.fillStyle = rgba(color, 0.3); ctx.fill(body);
  ctx.strokeStyle = rgba(color, 0.9); ctx.stroke(body);
  ctx.fillStyle = '#FFFFFF'; ctx.fill(spec);
  ctx.strokeStyle = rgba(color, 0.5); ctx.stroke(rings);
  if (amount > 0.55) {
    const bk = (amount - 0.55) / 0.45;
    const M = Math.round((bk * w) / 50);
    const domes = new Path2D(), drops = new Path2D(), dRings = new Path2D(), shine = new Path2D();
    for (let i = 0; i < M; i++) {
      const L = 1.1 + hash1(seed * 19 + i * 2.3) * 0.8;
      const tt = t / L + hash1(seed * 23 + i * 5.9);
      const cyc = Math.floor(tt), k = tt - cyc;
      const bx = x - w / 2 + w * hash2(i * 3 + seed * 5, cyc * 1.9 + 7);
      const by = y - h / 2 + h * hash2(i * 9 + seed, cyc * 2.3 + 1);
      if (!inPool(bx, by)) continue;
      const R = (9 + 16 * hash1(i * 6.1 + cyc)) * scale * (0.6 + 0.5 * bk);
      if (k < 0.55) {
        const gk = Math.sin((k / 0.55) * PI * 0.5);
        const hh = R * 0.75 * gk, rr = R * (0.6 + 0.4 * gk);
        domes.moveTo(bx + rr, by); domes.ellipse(bx, by, rr, hh, 0, 0, PI, true); domes.closePath();
        shine.moveTo(bx - rr * 0.5, by - hh * 0.3); shine.quadraticCurveTo(bx - rr * 0.4, by - hh * 0.8, bx - rr * 0.05, by - hh * 0.85);
        ellipseP(dRings, bx, by, R * 1.2, R * 0.22);
      } else {
        const kk = (k - 0.55) / 0.45;
        for (let d = 0; d < 6; d++) {
          const ang = -PI / 2 + (d - 2.5) * 0.42 + (hash1(i * 13 + d + cyc) - 0.5) * 0.3;
          const v = R * (2.4 + hash1(d * 3.1 + i) * 1.6);
          circleP(drops, bx + Math.cos(ang) * v * kk, by + Math.sin(ang) * v * kk * 1.4 + 3.2 * R * kk * kk, (1.6 + R * 0.08) * (1 - kk * 0.5));
        }
        ellipseP(dRings, bx, by, R * (1 + kk * 1.8), R * 0.25 * (1 + kk * 1.8));
      }
    }
    ctx.fillStyle = rgba(color, 0.45); ctx.fill(domes);
    ctx.strokeStyle = rgba(color, 0.95); ctx.lineWidth = 1.4 * scale; ctx.stroke(domes);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.8 * scale; ctx.lineCap = 'round'; ctx.stroke(shine);
    ctx.strokeStyle = rgba(color, 0.6); ctx.lineWidth = 1.1 * scale; ctx.stroke(dRings);
    ctx.fillStyle = rgba(color, 0.9); ctx.fill(drops);
  }
  ctx.restore();
}
function drawAsh(ctx, t, o = {}) {
  const density = o.density ?? 1;
  if (density <= 0) return;
  const a = Object.assign({ x0: WX0, x1: WX1, y0: WY0, y1: WY1 }, o.area || {});
  const W = a.x1 - a.x0, H = a.y1 - a.y0;
  const N = Math.round(density * 520 * Math.min(1, (W * H) / (2120 * 1580)) + density * 60);
  const wind = o.wind ?? 14;
  ctx.save();
  const groups = [['#4A4044', 0.75], ['#8A7E7E', 0.7], ['#2E2628', 0.8]];
  for (let gi = 0; gi < 3; gi++) {
    ctx.fillStyle = rgba(groups[gi][0], groups[gi][1]);
    ctx.beginPath();
    for (let i = gi; i < N; i += 3) {
      const sp = 24 + hash1(i * 1.9) * 36;
      const x = a.x0 + frac(hash1(i * 3.7) + (t * wind + Math.sin(t * 0.7 + i) * 18) / W) * W;
      const y = a.y0 + frac(hash1(i * 5.3) + (t * sp) / H) * H;
      const s = 1.2 + hash1(i * 7.1) * 2.4;
      const r = t * (1 + hash1(i)) + i;
      ctx.moveTo(x + Math.cos(r) * s, y + Math.sin(r) * s * 0.6);
      ctx.lineTo(x - Math.sin(r) * s * 0.7, y + Math.cos(r) * s);
      ctx.lineTo(x - Math.cos(r) * s, y - Math.sin(r) * s * 0.5);
      ctx.closePath();
    }
    ctx.fill();
  }
  ctx.restore();
}
function drawEmbers(ctx, t, o = {}) {
  const density = o.density ?? 1;
  if (density <= 0) return;
  const a = Object.assign({ x0: WX0, x1: WX1, y0: -100, y1: 820 }, o.area || {});
  const W = a.x1 - a.x0, H = a.y1 - a.y0;
  const N = Math.round(density * 90 * Math.max(0.2, Math.min(1, (W * H) / (2120 * 920))));
  const glow = new Path2D(), core = new Path2D(), core2 = new Path2D();
  for (let i = 0; i < N; i++) {
    const sp = 30 + hash1(i * 2.1) * 60;
    const y = a.y1 - frac(hash1(i * 4.3) + (t * sp) / H) * H;
    const x = a.x0 + frac(hash1(i * 6.7) + (t * 6) / W) * W + Math.sin(t * 2 + i) * 6;
    const fl = Math.sin(t * 11 + i * 3.3);
    const r = 1.2 + hash1(i * 8.1) * 1.8;
    circleP(glow, x, y, r * 3);
    circleP(fl > 0 ? core : core2, x, y, r);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,110,40,0.2)'; ctx.fill(glow);
  ctx.fillStyle = 'rgba(255,236,150,0.95)'; ctx.fill(core);
  ctx.fillStyle = 'rgba(255,150,60,0.8)'; ctx.fill(core2);
  ctx.restore();
}
function drawRumbleDust(ctx, t, rumble) {
  if (rumble <= 0.02) return;
  const N = Math.round(70 * rumble);
  const dust = new Path2D(), leaves = new Path2D();
  for (let i = 0; i < N; i++) {
    const per = 1.4 + hash1(i * 2.9) * 1.2;
    const tt = t / per + hash1(i * 3.1);
    const cyc = Math.floor(tt), k = tt - cyc;
    const zone = i % 3;
    const x0 = zone === 0 ? lerp(-100, 380, hash2(i, cyc)) : zone === 1 ? lerp(1150, 1500, hash2(i, cyc)) : lerp(380, 1150, hash2(i, cyc));
    const y0 = zone === 2 ? lerp(300, 380, hash2(i * 3, cyc)) : lerp(-20, 160, hash2(i * 3, cyc));
    const x = x0 + Math.sin(k * 6 + i) * 8, y = y0 + k * k * 380;
    if (k > 0.85) continue;
    if (i % 5 === 0) {
      const a = t * 4 + i, c = Math.cos(a), s = Math.sin(a);
      leaves.moveTo(x + c * 4, y + s * 4); leaves.quadraticCurveTo(x - s * 2, y + c * 2, x - c * 4, y - s * 4); leaves.quadraticCurveTo(x + s * 2, y - c * 2, x + c * 4, y + s * 4);
    } else circleP(dust, x, y, 1 + hash1(i) * 1.5);
  }
  ctx.save();
  ctx.globalAlpha = 0.8 * rumble;
  ctx.fillStyle = '#7A6650'; ctx.fill(dust);
  ctx.fillStyle = '#5C8A3E'; ctx.fill(leaves);
  ctx.restore();
}
function drawFireflies(ctx, t, k) {
  if (k <= 0) return;
  const glow = new Path2D(), core = new Path2D();
  for (let i = 0; i < 26; i++) {
    const f = Math.sin(t * 1.6 + i * 2.7);
    if (f < 0.2) continue;
    const x = lerp(-200, 1500, hash1(i * 3.3)) + Math.sin(t * 0.4 + i) * 30;
    const y = lerp(360, 470, hash1(i * 5.1)) + Math.sin(t * 0.7 + i * 2) * 14;
    circleP(glow, x, y, 6 * f); circleP(core, x, y, 1.8);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgba(230,255,140,${0.22 * k})`; ctx.fill(glow);
  ctx.fillStyle = `rgba(250,255,200,${0.9 * k})`; ctx.fill(core);
  ctx.restore();
}

function fallingRocks(t, o = {}) {
  const t0 = o.t0 ?? 0, count = o.count ?? 8, seed = o.seed ?? 1, dur = o.dur ?? 2, g = o.g ?? 900;
  const size = o.size || [7, 16];
  const area = Object.assign({ x0: 160, x1: 1150, yTop: -80, yGround: [520, 700] }, o.area || {});
  const r = rng(seed * 101 + 7);
  const out = [];
  for (let i = 0; i < count; i++) {
    const start = t0 + r() * dur;
    const x0 = lerp(area.x0, area.x1, r());
    const yG = Array.isArray(area.yGround) ? lerp(area.yGround[0], area.yGround[1], r()) : area.yGround;
    const vx = (r() - 0.5) * 140;
    const rad = lerp(size[0], size[1], r());
    const spin = (r() - 0.5) * 9;
    const yTop = area.yTop - r() * 80;
    const fallT = Math.sqrt((2 * Math.max(1, yG - yTop)) / g);
    const impactT = start + fallT;
    const landX = x0 + vx * fallT;
    const tau = t - start;
    const inWater = inPool(landX, yG);
    let x = x0, y = yTop, landed = false, vy = 0, sink = 0;
    if (tau >= 0 && tau < fallT) { x = x0 + vx * tau; y = yTop + 0.5 * g * tau * tau; vy = g * tau; } else if (tau >= fallT) {
      landed = true;
      const af = tau - fallT;
      x = landX + (inWater ? 0 : vx * 0.2 * Math.min(af, 0.4));
      const hop = af < 0.4 ? Math.sin((af / 0.4) * PI) * (1 - af / 0.4) * rad * 1.6 : 0;
      y = yG - (inWater ? 0 : hop);
      sink = inWater ? clamp(af / 0.45) : 0;
    }
    out.push({
      i, x, y, r: rad, rot: spin * clamp(tau, 0, fallT + 0.4), glow: clamp(1 - Math.max(0, tau) / (fallT + 1.6)),
      active: tau >= 0, landed, impactT, start, inWater, sink, vx, vy, landX, landY: yG,
    });
  }
  return out;
}
function drawFallingRocks(ctx, t, o = {}) {
  const rocks = fallingRocks(t, o);
  ctx.save();
  for (const k of rocks) {
    if (!k.active) continue;
    const af = t - k.impactT;
    if (k.landed && af < 0.8 && o.splash !== false) {
      const e = af / 0.8;
      if (k.inWater) {
        ctx.strokeStyle = `rgba(225,250,245,${0.85 * (1 - e)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ellipseP(ctx, k.x, k.y, k.r * (1.2 + e * 4), k.r * 0.3 * (1 + e * 4)); ctx.stroke();
        ctx.fillStyle = `rgba(230,252,248,${0.95 * (1 - e)})`;
        ctx.beginPath();
        for (let d = 0; d < 8; d++) {
          const ang = -PI / 2 + (d - 3.5) * 0.3;
          const v = k.r * (5 + hash1(d + k.i * 3) * 4);
          circleP(ctx, k.x + Math.cos(ang) * v * e, k.y + Math.sin(ang) * v * e * 1.3 + 9 * k.r * e * e, (1.5 + k.r * 0.15) * (1 - e * 0.5));
        }
        ctx.fill();
        if (e < 0.5) {
          ctx.fillStyle = `rgba(230,252,248,${0.8 * (1 - e * 2)})`;
          ctx.beginPath();
          ctx.moveTo(k.x - k.r * 1.6, k.y);
          ctx.quadraticCurveTo(k.x - k.r * 1.2, k.y - k.r * 3 * (0.5 + e), k.x - k.r * 0.4, k.y - k.r * 1.2);
          ctx.quadraticCurveTo(k.x, k.y - k.r * 4 * (0.5 + e), k.x + k.r * 0.4, k.y - k.r * 1.2);
          ctx.quadraticCurveTo(k.x + k.r * 1.2, k.y - k.r * 3 * (0.5 + e), k.x + k.r * 1.6, k.y);
          ctx.closePath(); ctx.fill();
        }
      } else {
        ctx.fillStyle = `rgba(150,130,110,${0.5 * (1 - e)})`;
        ctx.beginPath();
        for (let d = 0; d < 4; d++) circleP(ctx, k.landX + (d - 1.5) * k.r * (0.8 + e), k.landY - k.r * 0.4 - e * k.r * 1.5 * ((d % 2) + 0.5), k.r * (0.6 + e * 1.4));
        ctx.fill();
      }
    }
    if (k.inWater && k.sink >= 1) continue;
    if (!k.landed) {
      const tx = k.x - k.vx * 0.14, ty = k.y - k.vy * 0.14;
      ctx.fillStyle = 'rgba(90,76,72,0.4)';
      ribbon(ctx, [[tx, ty], [lerp(tx, k.x, 0.5), lerp(ty, k.y, 0.5)], [k.x, k.y]], 1, k.r * 1.5);
      ctx.fill();
      if (k.glow > 0.1) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,130,50,${0.4 * k.glow})`;
        ribbon(ctx, [[lerp(tx, k.x, 0.4), lerp(ty, k.y, 0.4)], [k.x, k.y]], 0.5, k.r * 0.9);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.save();
    ctx.translate(k.x, k.y + k.sink * k.r);
    ctx.globalAlpha = 1 - k.sink;
    ctx.rotate(k.rot);
    const pts = [];
    for (let j = 0; j < 7; j++) {
      const a = (j / 7) * TAU, rr = k.r * (0.8 + 0.3 * hash1(k.i * 13 + j));
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    if (k.glow > 0.15) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,110,40,${0.35 * k.glow})`;
      ctx.beginPath(); circleP(ctx, 0, 0, k.r * 2); ctx.fill();
      ctx.restore();
    }
    blob(ctx, pts); ctx.fillStyle = '#3E3434'; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = '#241C1C'; ctx.stroke();
    blob(ctx, pts.map(([x, y]) => [x * 0.7 - k.r * 0.12, y * 0.7 - k.r * 0.15])); ctx.fillStyle = '#5E5250'; ctx.fill();
    if (k.glow > 0.05) {
      ctx.strokeStyle = `rgba(255,${150 + Math.round(80 * k.glow)},60,${k.glow})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-k.r * 0.6, -k.r * 0.1); ctx.lineTo(-k.r * 0.1, k.r * 0.15); ctx.lineTo(k.r * 0.4, -k.r * 0.3);
      ctx.moveTo(-k.r * 0.1, k.r * 0.15); ctx.lineTo(0, k.r * 0.6);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
  return rocks;
}

// =====================================================================================
// front water
// =====================================================================================
const wave = (x, t) => 1.6 * Math.sin(x * 0.07 + t * 2.6) + 0.8 * Math.sin(x * 0.13 - t * 1.7);
function defaultSwimmers() {
  const s = SPRING.swimSpots;
  return [s.sunny, s.barry, s.doreen].map((p) => ({ x: p.x, y: p.y, scale: p.scale }));
}
function drawWaterFront(ctx, t, o = {}) {
  const setting = normSetting(o.setting);
  const op = opts(o, setting);
  const P = palette(setting, op.dusk, op.erupt, op.skyTint);
  const sw = (o.swimmers || defaultSwimmers()).map((s) => {
    const sc = s.scale ?? depthScale(s.y);
    return { x: s.x, y: s.y, w: s.w ?? 270 * sc, depth: s.depth ?? 190 * sc, sc, ripple: s.ripple !== false };
  });
  if (!sw.length) return;
  ctx.save();
  ctx.beginPath();
  for (const s of sw) {
    const x0 = s.x - s.w / 2, x1 = s.x + s.w / 2;
    ctx.moveTo(x0, s.y + wave(x0, t));
    for (let xx = x0 + 6; xx < x1; xx += 6) ctx.lineTo(xx, s.y + wave(xx, t));
    ctx.lineTo(x1, s.y + wave(x1, t));
    ctx.lineTo(x1, s.y + s.depth); ctx.lineTo(x0, s.y + s.depth); ctx.closePath();
  }
  ctx.clip();
  ctx.globalAlpha = o.opacity ?? 0.7;
  drawWaterBands(ctx, P, op.waterHeat);
  ctx.globalAlpha = 1;
  for (const s of sw) {
    // contact shadow just under the waterline
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = rgba(P.w3, 0.16);
      ctx.fillRect(s.x - s.w / 2, s.y - 3, s.w, (8 + k * 8) * s.sc);
    }
    // refraction bands
    ctx.strokeStyle = rgba(P.wHi, 0.22);
    ctx.lineWidth = 2 * s.sc;
    ctx.beginPath();
    for (let b = 0; b < 3; b++) {
      const yy = s.y + (20 + b * 24) * s.sc;
      ctx.moveTo(s.x - s.w / 2, yy);
      for (let xx = s.x - s.w / 2; xx <= s.x + s.w / 2; xx += 10) ctx.lineTo(xx, yy + Math.sin(xx * 0.06 + t * 2 + b * 2) * 3 * s.sc);
    }
    ctx.stroke();
  }
  drawWaterSurface(ctx, t, P, op);
  ctx.restore();
  ctx.save();
  for (const s of sw) {
    const hw = s.w * 0.44;
    ctx.fillStyle = rgba(P.wHi, 0.88);
    ctx.beginPath();
    ctx.moveTo(s.x - hw, s.y + wave(s.x - hw, t));
    for (let xx = s.x - hw; xx <= s.x + hw; xx += 6) ctx.lineTo(xx, s.y + wave(xx, t) - 1.7 * (1 - ((xx - s.x) / hw) ** 2) * s.sc);
    for (let xx = s.x + hw; xx >= s.x - hw; xx -= 6) ctx.lineTo(xx, s.y + wave(xx, t) + 1.4 * (1 - ((xx - s.x) / hw) ** 2) * s.sc);
    ctx.closePath();
    ctx.fill();
    if (s.ripple) waterlineRipple(ctx, s.x, s.y + 1, s.w * 0.8, t + s.x * 0.01, { amp: 1, part: 'front', color: P.wHi });
  }
  ctx.restore();
}
function waterlineRipple(ctx, x, y, w, t, o = {}) {
  const amp = o.amp ?? 1, part = o.part || 'front', color = o.color || '#E2FBF6', speed = o.speed ?? 1;
  const sc = clamp(w / 220, 0.4, 1.6);
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const k = frac(t * 0.45 * speed + i / 3);
    const rx = w * 0.5 + 4 + k * w * 0.42 * (0.6 + 0.4 * amp);
    const ry = rx * 0.17;
    const a = (1 - k) * Math.min(1, k * 5) * 0.6 * Math.min(1, amp);
    ctx.strokeStyle = rgba(color, a);
    ctx.lineWidth = (1.2 + 1.4 * (1 - k)) * sc;
    ctx.beginPath();
    if (part === 'front' || part === 'both') ctx.ellipse(x, y, rx, ry, 0, 0.08, PI - 0.08);
    if (part === 'back' || part === 'both') { ctx.moveTo(x + rx * Math.cos(PI + 0.08), y + ry * Math.sin(PI + 0.08)); ctx.ellipse(x, y, rx, ry, 0, PI + 0.08, TAU - 0.08); }
    ctx.stroke();
  }
  ctx.restore();
}

// =====================================================================================
// overlay & foreground
// =====================================================================================
function eruptFlash(t, erupt) {
  const onset = Math.exp(-Math.pow((erupt - 0.215) / 0.022, 2));
  let flick = 0;
  if (erupt > 0.22 && erupt < 0.68) {
    const slot = Math.floor(t * 2.6), ph = t * 2.6 - slot;
    if (hash1(slot * 3.17 + 0.5) > 0.62) flick = Math.exp(-ph * 9) * 0.42 * (1 - smoothstep(0.55, 0.68, erupt));
  }
  return clamp(onset * 0.85 + flick);
}
function drawSpringOverlay(ctx, t, o = {}) {
  const setting = normSetting(o.setting);
  const op = opts(o, setting);
  const P = palette(setting, op.dusk, op.erupt, op.skyTint);
  ctx.save();
  if (op.waterHeat > 0.35) drawSteam(ctx, t, { x: 680, y: 770, w: 1300, amount: (op.waterHeat - 0.35) * 1.3, h: 280, scale: 1.8, color: P.steam, seed: 77 });
  drawRumbleDust(ctx, t, op.rumble);
  const ashK = smoothstep(0.28, 0.65, op.erupt);
  if (ashK > 0) drawAsh(ctx, t, { density: ashK });
  const embK = Math.max(smoothstep(0.3, 0.6, op.erupt) * 0.7, op.lava);
  if (embK > 0) drawEmbers(ctx, t, { density: embK });
  if (op.grade > 0) {
    let col = null, a = 0;
    if (setting === 'evening') { col = mix('#FFB070', '#8A5AA0', op.dusk); a = 0.22 + 0.18 * op.dusk; }
    if (P.E > 0) { col = col ? mix(col, '#FF6A3A', P.E) : '#FF6A3A'; a = Math.max(a, 0.3 * P.E); }
    if (col) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = rgba(col, a * op.grade);
      ctx.fillRect(WX0, WY0, WX1 - WX0, WY1 - WY0);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  const fl = eruptFlash(t, op.erupt);
  if (fl > 0.01) {
    ctx.fillStyle = `rgba(255,224,190,${0.75 * fl})`;
    ctx.fillRect(WX0, WY0, WX1 - WX0, WY1 - WY0);
  }
  ctx.restore();
}
function drawForegroundFoliage(ctx, t, o = {}) {
  const setting = normSetting(o.setting);
  const P = palette(setting, o.dusk || 0, o.erupt || 0, o.skyTint);
  const sides = o.sides || 'both';
  const amt = o.amount ?? 1;
  const rum = o.rumble || 0;
  const dark = (c, k = 0.45) => mix(P.g(c), '#0B1A12', k);
  const k = lerp(0.6, 1, amt);
  ctx.save();
  const leaf = (x, y, len, wid, ang, seed, col, colL) => {
    const a = ang + sway(t, seed, 0.035, 0.8, rum);
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
    const cx = x + Math.cos(a) * len * 0.5 - Math.sin(a) * len * 0.1, cy = y + Math.sin(a) * len * 0.5 - len * 0.16;
    const lp = leafPts(x, y, cx, cy, ex, ey, wid, 16, false, (u) => Math.pow(Math.sin(PI * Math.min(1, u * 1.02)), 0.62));
    const d = new Path2D(), l = new Path2D(), r = new Path2D();
    addLeaf(d, l, r, lp);
    ctx.fillStyle = col; ctx.fill(d);
    ctx.fillStyle = colL; ctx.fill(l);
    ctx.strokeStyle = rgba(P.rim, 0.22 + 0.2 * P.rimA); ctx.lineWidth = 1.6; ctx.stroke(r);
    ctx.strokeStyle = rgba('#000000', 0.14); ctx.lineWidth = 1.2;
    ctx.beginPath();
    const { S, A, B } = lp;
    for (let i = 2; i < S.length - 2; i += 2) {
      ctx.moveTo(S[i][0], S[i][1]); ctx.lineTo(lerp(S[i + 1][0], A[i][0], 0.85), lerp(S[i + 1][1], A[i][1], 0.85));
      ctx.moveTo(S[i][0], S[i][1]); ctx.lineTo(lerp(S[i + 1][0], B[i][0], 0.85), lerp(S[i + 1][1], B[i][1], 0.85));
    }
    ctx.stroke();
  };
  const d1 = dark(C.jDeep), d2 = dark(C.jMid, 0.4), d3 = dark('#1F4A33', 0.5);
  if (sides !== 'right') {
    leaf(-60, 830, 310 * k, 50, -0.62, 1, d3, d1);
    leaf(-80, 700, 270 * k, 42, -0.18, 2, d1, d2);
    leaf(-40, 870, 230 * k, 38, -1.05, 3, d1, d2);
    if (o.top) { leaf(-50, -40, 240 * k, 40, 0.55, 4, d3, d1); leaf(60, -60, 190 * k, 32, 1.1, 5, d1, d2); }
  }
  if (sides !== 'left') {
    leaf(1340, 830, 310 * k, 50, PI + 0.62, 6, d3, d1);
    leaf(1360, 690, 260 * k, 42, PI + 0.2, 7, d1, d2);
    leaf(1310, 880, 230 * k, 38, PI + 1.05, 8, d1, d2);
    if (o.top) { leaf(1330, -40, 240 * k, 40, PI - 0.55, 9, d3, d1); leaf(1220, -60, 190 * k, 32, PI - 1.1, 10, d1, d2); }
  }
  ctx.restore();
}

// =====================================================================================
// main backgrounds
// =====================================================================================
function drawSpring(ctx, t, o, setting) {
  const op = opts(o, setting);
  const P = palette(setting, op.dusk, op.erupt, op.skyTint);
  ctx.save();
  drawSky(ctx, t, P);
  drawClouds(ctx, t, P);
  if (setting === 'day' && op.birds && op.erupt < 0.05) drawBirds(ctx, t, P);
  drawFarHills(ctx, t, P);
  drawVolcano(ctx, t, P, op);
  drawLavaRivers(ctx, t, P, op);
  drawCraterSmoke(ctx, t, P, op);
  drawPlume(ctx, t, P, op);
  drawFountains(ctx, t, P, op);
  drawJungleBands(ctx, t, P, op);
  drawLightRays(ctx, t, P);
  drawGround(ctx, t, P);
  drawBigTreeRight(ctx, t, P, op);
  drawPalm(ctx, t, P, PALMS[1], op.rumble);
  drawBigTreeLeft(ctx, t, P, op);
  drawVines(ctx, t, P, VINES, op.rumble);
  drawBushBand(ctx, t, P, op);
  drawBanana(ctx, P, 86, 486, 0.9, t, 5, op.rumble, 0.04);
  drawPalm(ctx, t, P, PALMS[0], op.rumble);
  drawBanana(ctx, P, 1262, 458, 1.05, t, 9, op.rumble, 0.04, -1);
  drawFernSet(ctx, t, P, BACK_FERNS, 0.06, op, 3);
  drawHeartSet(ctx, t, P, BACK_HEARTS, 0.05, op, 4);
  if (op.sign) drawSnoozeSignImpl(ctx, t, P, { x: SPRING.signPos.x, y: SPRING.signPos.y, burn: op.signBurn });
  drawBankDetails(ctx, P);
  drawPoolWater(ctx, t, P, op);
  const lod = devScale(ctx);
  drawRocks(ctx, P, RIVER_ROCKS, null, lod);
  drawRocks(ctx, P, RIM_ROCKS, null, lod);
  if (op.moorPost) drawMoorPost(ctx, P, SPRING.moorPost.x, SPRING.moorPost.y);
  drawLavaToPool(ctx, t, P, op);
  const heat = op.waterHeat;
  drawSteam(ctx, t, { x: 680, y: 480, w: 900, amount: 0.3 + heat * 0.9, h: 120, scale: 0.75, color: P.steam, seed: 3 });
  drawSteam(ctx, t, { x: 680, y: 566, w: 1000, amount: 0.2 + heat * 0.9, h: 150, scale: 1.0, color: P.steam, seed: 5 });
  if (heat > 0.3) drawSteam(ctx, t, { x: 680, y: 666, w: 1000, amount: (heat - 0.3) * 1.2, h: 170, scale: 1.3, color: P.steam, seed: 7 });
  drawFrontBanks(ctx, t, P, op);
  if (setting === 'evening') drawFireflies(ctx, t, smoothstep(0.25, 0.8, op.dusk) * (1 - P.E));
  ctx.restore();
}
function drawBankDetails(ctx, P) {
  ctx.fillStyle = P.g(C.groundDark); ctx.fill(TUFTS.dark);
  ctx.fillStyle = P.hl(C.jPale, 0, 0.6); ctx.fill(TUFTS.light);
  for (const [c, path] of FLOWERS.byCol) { ctx.fillStyle = P.g(c); ctx.fill(path); }
  ctx.fillStyle = P.g('#FFB02E'); ctx.fill(FLOWERS.centres);
}
function drawFrontBanks(ctx, t, P, o, style) {
  drawRocks(ctx, P, BANK_ROCKS, style);
  drawFernSet(ctx, t, P, FRONT_FERNS, 0, o, 11);
  drawHeartSet(ctx, t, P, FRONT_HEARTS, 0, o, 12);
}
function drawSpringDay(ctx, t, o) { drawSpring(ctx, t, o, 'day'); }
function drawSpringEvening(ctx, t, o) { drawSpring(ctx, t, o, 'evening'); }
function drawEruption(ctx, t, o = {}) {
  const setting = normSetting(o.setting);
  const op = opts(o, setting);
  const P = palette(setting, op.dusk, op.erupt, op.skyTint);
  ctx.save();
  drawLavaRivers(ctx, t, P, op);
  drawCraterSmoke(ctx, t, P, op);
  drawPlume(ctx, t, P, op);
  drawFountains(ctx, t, P, op);
  ctx.restore();
}
function drawMountSnooze(ctx, t, o = {}) {
  const setting = normSetting(o.setting);
  const op = opts(o, setting);
  const P = palette(setting, op.dusk, op.erupt, op.skyTint);
  const s = o.scale ?? 1;
  ctx.save();
  ctx.translate(o.x ?? 860, o.y ?? 150);
  ctx.scale(s, s);
  ctx.translate(-860, -150);
  drawVolcano(ctx, t, P, op);
  drawLavaRivers(ctx, t, P, op);
  drawCraterSmoke(ctx, t, P, op);
  drawPlume(ctx, t, P, op);
  drawFountains(ctx, t, P, op);
  ctx.restore();
}
function drawSnoozeSign(ctx, t, o = {}) {
  const P = palette(normSetting(o.setting), o.dusk || 0, o.erupt || 0);
  drawSnoozeSignImpl(ctx, t, P, { x: o.x ?? SPRING.signPos.x, y: o.y ?? SPRING.signPos.y, scale: o.scale, burn: o.burn ?? o.signBurn ?? 0, lines: o.lines, check: o.check });
}

// =====================================================================================
// new spring (epilogue)
// =====================================================================================
const NEW_HILLS = [
  { path: ridgePath(ridgePts(41, 300, 40, 0.0028, 50, (x) => -24 * bump(x, 300, 300) + 30 * bump(x, 880, 200)), 0, 520), col: '#8CCB96', far: 0.4 },
  { path: ridgePath(ridgePts(43, 350, 30, 0.004, 40, (x) => 34 * bump(x, 880, 220)), 0, 520), col: '#62B960', far: 0.12 },
  { path: ridgePath(ridgePts(47, 396, 20, 0.006, 32), 0, 520), col: '#4FA449', far: 0.03 },
];
const NEW_HILL_PTS = [ridgePts(41, 300, 40, 0.0028, 50, (x) => -24 * bump(x, 300, 300) + 30 * bump(x, 880, 200)), ridgePts(43, 350, 30, 0.004, 40, (x) => 34 * bump(x, 880, 220)), ridgePts(47, 396, 20, 0.006, 32)];
function ridgeYAt(pts, x) {
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]));
  return pts[pts.length - 1][1];
}
const NEW_TREES = (() => {
  const r = rng(808);
  const layers = [1, 2].map(() => ({ trunk: new Path2D(), dark: new Path2D(), lit: new Path2D() }));
  for (let i = 0; i < 90; i++) {
    const li = r.int(0, 1), layer = li + 1;
    const x = r.range(WX0, WX1);
    if (x > 760 && x < 1000) continue; // keep the little hill clear
    const y = ridgeYAt(NEW_HILL_PTS[layer], x) + r.range(6, 22);
    const rr = r.range(7, 12) * (layer === 2 ? 1.3 : 1);
    const L = layers[li];
    L.trunk.rect(x - 1.5, y - 2, 3, rr * 0.9);
    circleP(L.dark, x, y - rr * 0.4, rr);
    circleP(L.lit, x - rr * 0.2, y - rr * 0.65, rr * 0.66);
  }
  return layers;
})();
const HILL_FLOWERS = (() => {
  const r = rng(909), cols = ['#FFE27A', '#FFB3CF', '#FFFFFF', '#D9B8FF'], byCol = new Map();
  for (let p = 0; p < 9; p++) {
    const cx = r.range(-300, 1600), layer = r.int(1, 2), c = cols[r.int(0, 3)];
    if (cx > 740 && cx < 1020) continue;
    if (!byCol.has(c)) byCol.set(c, new Path2D());
    for (let i = 0; i < 26; i++) {
      const x = cx + r.range(-60, 60), y = ridgeYAt(NEW_HILL_PTS[layer], x) + r.range(8, 40);
      circleP(byCol.get(c), x, y, layer === 2 ? 2.2 : 1.6);
    }
  }
  return byCol;
})();
const FIELD_STRIPES = newPath((p) => { for (let k = 0; k < 14; k++) { const x0 = -200 + k * 130; p.moveTo(x0, 470); p.quadraticCurveTo(x0 + 40, 400, x0 + 120, 340); } });
const NEW_SHRUBS = (() => {
  const r = rng(31), dark = new Path2D(), base = new Path2D(), lit = new Path2D();
  for (let x = WX0; x < WX1; x += r.range(50, 80)) {
    if (x > 1060 && x < 1250) continue;
    const y = 434 + r.range(-4, 4), rr = r.range(18, 28);
    for (const [dx, dy, k] of [[0, 0, 1], [-0.75, 0.25, 0.7], [0.75, 0.25, 0.68]]) {
      circleP(dark, x + dx * rr, y + dy * rr, rr * k);
      circleP(base, x + dx * rr - rr * 0.07, y + dy * rr - rr * 0.11, rr * k * 0.86);
    }
    circleP(lit, x - rr * 0.32, y - rr * 0.38, rr * 0.36);
  }
  return { dark, base, lit };
})();
const BLOSSOM = [[-140, -40, 150], [20, 0, 120], [170, 30, 90], [270, 70, 60], [-60, 110, 90], [90, 120, 70]];
const BLOSSOM_PATHS = (() => {
  const dark = new Path2D(), base = new Path2D(), lit = new Path2D(), pink = new Path2D(), white = new Path2D();
  BLOSSOM.forEach(([x, y, r]) => {
    circleP(dark, x, y, r);
    circleP(base, x - r * 0.07, y - r * 0.1, r * 0.88);
    circleP(lit, x - r * 0.4, y - r * 0.46, r * 0.26);
  });
  const br = rng(17);
  for (let i = 0; i < 90; i++) {
    const [bx, by, rr] = BLOSSOM[i % BLOSSOM.length];
    const a = br() * TAU, d = Math.sqrt(br()) * rr * 0.9;
    const x = bx + Math.cos(a) * d, y = by + Math.sin(a) * d * 0.9, s = 3 + br() * 3.5;
    for (let k = 0; k < 5; k++) { const aa = (k / 5) * TAU; circleP(pink, x + Math.cos(aa) * s * 0.7, y + Math.sin(aa) * s * 0.7, s * 0.55); }
    if (i % 2) circleP(white, x, y, s * 0.4);
  }
  return { dark, base, lit, pink, white };
})();
const NEW_FLOWERS = bakeFlowers(4242, 240, [C.fPink, C.fYellow, C.fWhite, C.fPurple, C.fRed, C.fOrange], [-420, 1700, 444, 1100]);
const RIM_FLOWERS = (() => {
  const r = rng(5151), byCol = new Map(), centres = new Path2D();
  const cols = [C.fPink, C.fYellow, C.fWhite, C.fPurple];
  for (let i = 0; i < RIM_LIST.length; i += 2) {
    const rk = RIM_LIST[i];
    if (rk.y > 760) continue;
    const c = cols[r.int(0, 3)], x = rk.x + rk.rx * 0.85, y = rk.y - rk.ry * 0.45, s = 2.2 + rk.rx * 0.07;
    if (!byCol.has(c)) byCol.set(c, new Path2D());
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; ellipseP(byCol.get(c), x + Math.cos(a) * s * 0.9, y + Math.sin(a) * s * 0.7, s * 0.62, s * 0.5); }
    circleP(centres, x, y, s * 0.45);
  }
  return { byCol, centres };
})();
const CORNER_FLOWERS = bakeFlowers(6161, 90, [C.fPink, C.fYellow, C.fWhite, C.fPurple, C.fRed], [-300, 1600, 560, 1000]);
const RAINBOW = (() => {
  const cols = ['#FF7A7A', '#FFB86A', '#FFE680', '#9EE38A', '#7FC8FF', '#B79CFF'];
  return cols.map((c, i) => {
    const r1 = 420 - i * 11, r0 = r1 - 11.5;
    const p = new Path2D();
    p.moveTo(900 - r1, 470); p.arc(900, 470, r1, PI, TAU); p.lineTo(900 + r0, 470); p.arc(900, 470, r0, TAU, PI, true); p.closePath();
    return { c, p };
  });
})();
const BUTTERFLIES = [{ x: 300, y: 420, c: '#FFB3D1', s: 1 }, { x: 1000, y: 400, c: '#FFE07A', s: 0.9 }, { x: 620, y: 432, c: '#B7E3FF', s: 0.8 }];
function drawButterflies(ctx, t, P) {
  for (let i = 0; i < BUTTERFLIES.length; i++) {
    const b = BUTTERFLIES[i];
    const x = b.x + Math.sin(t * 0.33 + i * 2) * 120 + noise1(t * 0.5 + i * 7) * 40;
    const y = b.y + Math.sin(t * 0.9 + i) * 26 + noise1(t * 0.8 + i * 3) * 18;
    const f = Math.abs(Math.sin(t * 12 + i * 1.3));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(b.s, b.s);
    ctx.fillStyle = P.g(b.c);
    ctx.beginPath();
    for (const d of [-1, 1]) {
      ctx.ellipse(d * 5 * f, -3, 6 * f + 1, 5, d * 0.5, 0, TAU); ctx.closePath();
      ctx.ellipse(d * 4 * f, 3, 4 * f + 0.8, 3.4, -d * 0.4, 0, TAU); ctx.closePath();
    }
    ctx.fill();
    ctx.fillStyle = P.g('#4A3A40');
    ctx.beginPath(); ellipseP(ctx, 0, 0, 1.4, 4.5); ctx.fill();
    ctx.restore();
  }
}
function drawTinyHill(ctx, t, P, o) {
  const x = 880, y = 330;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - 150, 430);
  ctx.bezierCurveTo(x - 110, 360, x - 50, y, x, y);
  ctx.bezierCurveTo(x + 50, y, x + 110, 360, x + 150, 430);
  ctx.closePath();
  ctx.fillStyle = P.hl('#7CC46C', 0.3, 0.6); ctx.fill();
  ctx.fillStyle = rgba(P.g('#3E7A50', 0.35), 0.3);
  ctx.beginPath(); ctx.moveTo(x + 4, y); ctx.bezierCurveTo(x + 50, y, x + 110, 360, x + 150, 430); ctx.lineTo(x + 40, 430); ctx.bezierCurveTo(x + 40, 390, x + 30, 350, x + 4, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.g(C.trunk, 0.3);
  ctx.fillRect(x - 2, y - 22, 4, 22);
  ctx.fillStyle = P.g(C.jMid, 0.3); ctx.beginPath(); circleP(ctx, x, y - 30, 14); ctx.fill();
  ctx.fillStyle = P.hl(C.jLight, 0.3, 1); ctx.beginPath(); circleP(ctx, x - 3, y - 34, 9); ctx.fill();
  ctx.restore();
  if (o.hillPuff > 0) {
    const k = o.hillPuff, a = Math.sin(PI * k);
    ctx.save();
    ctx.globalAlpha = a * 0.95;
    ctx.fillStyle = '#D9D6DE'; ctx.beginPath(); circleP(ctx, x + 22 + k * 10, y - 4 - k * 40, 4 + k * 9); ctx.fill();
    ctx.fillStyle = '#F6F4F8'; ctx.beginPath(); circleP(ctx, x + 20 + k * 10, y - 6 - k * 40, 3 + k * 7); ctx.fill();
    ctx.restore();
  }
}
function drawNewSpring(ctx, t, o) {
  const op = opts(o, 'new');
  const P = palette('new', 0, 0, op.skyTint);
  ctx.save();
  drawSky(ctx, t, P);
  // sun rays
  ctx.save();
  ctx.translate(P.sunX, P.sunY);
  ctx.rotate(t * 0.03);
  ctx.fillStyle = rgba('#FFF8DC', 0.22);
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ctx.moveTo(Math.cos(a - 0.07) * 58, Math.sin(a - 0.07) * 58);
    ctx.lineTo(Math.cos(a) * 150, Math.sin(a) * 150);
    ctx.lineTo(Math.cos(a + 0.07) * 58, Math.sin(a + 0.07) * 58);
    ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.2;
  for (const b of RAINBOW) { ctx.fillStyle = b.c; ctx.fill(b.p); }
  ctx.restore();
  drawClouds(ctx, t, P);
  if (op.birds) drawBirds(ctx, t, P);
  NEW_HILLS.forEach((h, i) => {
    fillOff(ctx, h.path, P.hl(h.col, h.far, 0.9), -2, -3);
    fillOff(ctx, h.path, P.g(h.col, h.far));
    if (i === 0) drawTinyHill(ctx, t, P, op);
    if (i === 1) { ctx.save(); ctx.clip(h.path); ctx.strokeStyle = rgba(P.g('#B2DE90', 0.4), 0.45); ctx.lineWidth = 7; ctx.stroke(FIELD_STRIPES); ctx.restore(); }
    if (i === 2) for (const [c, path] of HILL_FLOWERS) { ctx.fillStyle = P.g(c, 0.2); ctx.fill(path); }
    if (i >= 1) {
      const L = NEW_TREES[i - 1];
      ctx.fillStyle = P.g(C.trunk, h.far); ctx.fill(L.trunk);
      ctx.fillStyle = P.g(C.jMid, h.far); ctx.fill(L.dark);
      ctx.fillStyle = P.hl(C.jLight, h.far, 0.9); ctx.fill(L.lit);
    }
  });
  drawGround(ctx, t, P);
  // blossom tree (left)
  ctx.fillStyle = P.g(C.trunk);
  ctx.beginPath(); ctx.moveTo(10, 540); ctx.quadraticCurveTo(40, 300, 30, 120); ctx.lineTo(70, 120); ctx.quadraticCurveTo(70, 320, 92, 542); ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.hl(C.trunkLight, 0, 0.6);
  ctx.beginPath(); ctx.moveTo(14, 536); ctx.quadraticCurveTo(42, 300, 32, 124); ctx.lineTo(44, 124); ctx.quadraticCurveTo(54, 300, 34, 536); ctx.closePath(); ctx.fill();
  ctx.fillStyle = P.g(C.trunk);
  ribbon(ctx, openSpline([[50, 200], [130, 150], [220, 120]], 4), 18, 6); ctx.fill();
  const bsx = sway(t, 3, 1.5, 0.4, op.rumble);
  ctx.translate(bsx, 0);
  ctx.fillStyle = P.g('#4E9A58'); ctx.fill(BLOSSOM_PATHS.dark);
  ctx.fillStyle = P.g('#68B866'); ctx.fill(BLOSSOM_PATHS.base);
  ctx.fillStyle = P.hl(C.jPale, 0, 1); ctx.fill(BLOSSOM_PATHS.lit);
  ctx.fillStyle = P.g('#FFB6D0'); ctx.fill(BLOSSOM_PATHS.pink);
  ctx.fillStyle = P.g('#FFF4D0'); ctx.fill(BLOSSOM_PATHS.white);
  ctx.translate(-bsx, 0);
  drawPalm(ctx, t, P, PALMS[1], op.rumble);
  fillOff(ctx, NEW_SHRUBS.dark, P.g(C.jMid, 0.08));
  fillOff(ctx, NEW_SHRUBS.base, P.g(C.jLight, 0.08));
  fillOff(ctx, NEW_SHRUBS.lit, P.hl(C.jPale, 0.08, 1));
  drawFernSet(ctx, t, P, BACK_FERNS, 0.04, op, 3);
  if (op.sign) drawSnoozeSignImpl(ctx, t, P, { x: NEW_SPRING.signPos.x, y: NEW_SPRING.signPos.y, lines: ['SNOOZE SPRINGS 2', 'Barry Approved'], check: true });
  drawBankDetails(ctx, P);
  for (const [c, path] of NEW_FLOWERS.byCol) { ctx.fillStyle = P.g(c); ctx.fill(path); }
  ctx.fillStyle = P.g('#FFB02E'); ctx.fill(NEW_FLOWERS.centres);
  drawPoolWater(ctx, t, P, op);
  // sparkles
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < 9; i++) {
    const ph = t * 0.7 + hash1(i * 3.1), k = frac(ph), a = Math.sin(PI * k);
    if (a < 0.05) continue;
    const y = lerp(492, 760, hash1(i * 7.7)), sp = poolSpan(y);
    if (!sp) continue;
    const x = lerp(sp[0] + 40, sp[1] - 40, hash1(i * 5.9 + Math.floor(ph)));
    const s = 7 * a * depthScale(y);
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.22, y - s * 0.22); ctx.lineTo(x + s, y); ctx.lineTo(x + s * 0.22, y + s * 0.22);
    ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.22, y + s * 0.22); ctx.lineTo(x - s, y); ctx.lineTo(x - s * 0.22, y - s * 0.22); ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  const lod = devScale(ctx);
  drawRocks(ctx, P, RIVER_ROCKS, ROCK_STYLE_NEW, lod);
  drawRocks(ctx, P, RIM_ROCKS, ROCK_STYLE_NEW, lod);
  for (const [c, path] of RIM_FLOWERS.byCol) { ctx.fillStyle = P.g(c); ctx.fill(path); }
  ctx.fillStyle = P.g('#FFB02E'); ctx.fill(RIM_FLOWERS.centres);
  if (op.moorPost) drawMoorPost(ctx, P, NEW_SPRING.moorPost.x, NEW_SPRING.moorPost.y);
  if (op.raft) {
    try {
      const props = require('./props');
      if (props.drawRaft) props.drawRaft(ctx, { x: NEW_SPRING.raftMoor.x, y: NEW_SPRING.raftMoor.y, scale: 0.8, t, flagText: 'S.S. TOLD YOU SO' });
    } catch (e) { /* props.js not available */ }
  }
  const heat = op.waterHeat;
  drawSteam(ctx, t, { x: 680, y: 480, w: 900, amount: 0.2 + heat * 0.9, h: 120, scale: 0.75, color: P.steam, seed: 3 });
  drawSteam(ctx, t, { x: 680, y: 566, w: 1000, amount: 0.12 + heat * 0.9, h: 150, scale: 1.0, color: P.steam, seed: 5 });
  drawFrontBanks(ctx, t, P, op, ROCK_STYLE_NEW);
  for (const [c, path] of CORNER_FLOWERS.byCol) { ctx.fillStyle = P.g(c); ctx.fill(path); }
  ctx.fillStyle = P.g('#FFB02E'); ctx.fill(CORNER_FLOWERS.centres);
  drawButterflies(ctx, t, P);
  ctx.restore();
}

// =====================================================================================
// lab sheets
// =====================================================================================
function tile(ctx, i, cols, rows, label, fn) {
  const tw = 1280 / cols, th = 720 / rows;
  const tx = (i % cols) * tw, ty = Math.floor(i / cols) * th;
  ctx.save();
  ctx.beginPath(); ctx.rect(tx, ty, tw, th); ctx.clip();
  ctx.translate(tx, ty); ctx.scale(tw / 1280, th / 720);
  ctx.fillStyle = '#FF00FF'; ctx.fillRect(0, 0, 1280, 720);
  fn();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.strokeRect(tx, ty, tw, th);
  if (label) {
    ctx.font = '600 14px Nunito';
    const w = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(tx + 4, ty + 4, w + 10, 20);
    ctx.fillStyle = '#fff'; ctx.fillText(label, tx + 9, ty + 19);
  }
  ctx.restore();
}
function labCapy(ctx, t, s, flip, who) {
  try {
    const cap = require('./capybara');
    if (cap.drawCapybara) { cap.drawCapybara(ctx, { x: s.x, y: s.y, scale: s.scale || 1, flip, who, t, pose: 'swim', mood: who === 'barry' ? 'worried' : 'chill' }); return; }
  } catch (e) { /* placeholder below */ }
  const sc = s.scale || 1;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.scale(flip ? -sc : sc, sc);
  ctx.fillStyle = '#9A6A45';
  ellipse(ctx, -10, 10, 110, 52); ctx.fill();
  roundRect(ctx, 40, -78, 86, 70, 26); ctx.fill();
  ctx.fillStyle = '#7A4F33'; circle(ctx, 66, -82, 8); ctx.fill();
  ctx.fillStyle = '#222'; circle(ctx, 80, -56, 4); ctx.fill();
  ctx.restore();
}
function trio(ctx, t, S) {
  labCapy(ctx, t, S.sunny, false, 'sunny'); labCapy(ctx, t, S.barry, false, 'barry'); labCapy(ctx, t, S.doreen, true, 'doreen');
}
const lab = {
  day(ctx, t) { drawSpringDay(ctx, t, {}); },
  day_overlay(ctx, t) {
    drawSpringDay(ctx, t, {});
    const S = SPRING;
    ctx.save();
    ctx.font = '600 13px Nunito';
    const mark = (x, y, w, h, col, label) => {
      ctx.fillStyle = rgba(col, 0.35); ctx.strokeStyle = col; ctx.lineWidth = 2;
      ellipse(ctx, x, y, w / 2, h / 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 3;
      ctx.strokeText(label, x - w / 2, y - h / 2 - 4); ctx.fillText(label, x - w / 2, y - h / 2 - 4);
    };
    for (const k of ['sunny', 'barry', 'doreen']) {
      const s = S.swimSpots[k];
      mark(s.x, s.y - 30 * s.scale, 230 * s.scale, 110 * s.scale, '#FFD27A', `${k} (${s.x},${s.y})`);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(s.x - 130, s.y); ctx.lineTo(s.x + 130, s.y); ctx.stroke();
    }
    S.swimSpots.extras.forEach((s, i) => mark(s.x, s.y - 24 * s.scale, 230 * s.scale, 100 * s.scale, '#9FE3A8', `extra${i}`));
    S.exitSignSpots.forEach((s, i) => {
      ctx.fillStyle = 'rgba(255,90,60,0.7)'; ctx.fillRect(s.x - 3, s.y - 70, 6, 70); ctx.fillRect(s.x - 34, s.y - 82, 68, 24);
      ctx.fillStyle = '#fff'; ctx.fillText('EXIT ' + i, s.x - 26, s.y - 65);
    });
    mark(S.raftMoor.x, S.raftMoor.y, 150, 44, '#C9B8FF', 'raftMoor');
    mark(S.thermometerSpot.x, S.thermometerSpot.y, 14, 14, '#FF6B6B', 'thermo');
    mark(S.lavaEntry.x, S.lavaEntry.y, 20, 12, '#FF9A1F', 'lavaEntry');
    mark(S.riverMouth.x, S.riverMouth.y, 20, 20, '#A8D8FF', 'riverMouth');
    mark(S.moorPost.x, S.moorPost.y, 12, 12, '#FFFFFF', 'moorPost');
    mark(S.signPos.x, S.signPos.y, 16, 8, '#FFFFFF', 'signPos');
    mark(S.craterPos.x, S.craterPos.y, S.craterPos.w, 16, '#FF9A1F', 'crater');
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
    ctx.beginPath(); S.escapePath.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    ctx.restore();
  },
  swim(ctx, t) {
    drawSpringDay(ctx, t, {});
    const S = SPRING.swimSpots;
    S.extras.forEach((s) => labCapy(ctx, t, s, s.flip, 'extra'));
    trio(ctx, t, S);
    drawWaterFront(ctx, t, { setting: 'day', swimmers: [...S.extras, S.sunny, S.barry, S.doreen] });
    drawSpringOverlay(ctx, t, {});
  },
  evening(ctx, t) { drawSpringEvening(ctx, t, { dusk: 0.15 }); },
  evening_dusk(ctx, t) {
    [0, 0.33, 0.66, 1].forEach((d, i) => tile(ctx, i, 2, 2, `dusk ${d}`, () => drawSpringEvening(ctx, t, { dusk: d })));
  },
  eruption(ctx, t) {
    [0, 0.1, 0.18, 0.22, 0.35, 0.5, 0.75, 1].forEach((e, i) => tile(ctx, i, 4, 2, `erupt ${e}`, () => {
      const o = { setting: 'evening', dusk: 0.2, erupt: e, waterHeat: 0.3 + e * 0.7, rumble: e > 0.1 ? 0.6 : 0 };
      drawSpringEvening(ctx, t, o); drawSpringOverlay(ctx, t, o);
    }));
  },
  erupt_peak(ctx, t) {
    const o = { setting: 'evening', dusk: 0.2, erupt: 0.45, waterHeat: 0.8, rumble: 0.7 };
    drawSpringEvening(ctx, t, o); drawSpringOverlay(ctx, t, o);
  },
  erupt_flow(ctx, t) {
    const o = { setting: 'evening', dusk: 0.2, erupt: 0.9, waterHeat: 1, rumble: 0.5, lava: 0.2 };
    drawSpringEvening(ctx, t, o); drawSpringOverlay(ctx, t, o);
  },
  lava(ctx, t) {
    [0.15, 0.4, 0.7, 1].forEach((l, i) => tile(ctx, i, 2, 2, `lava ${l}`, () => {
      const o = { setting: 'evening', dusk: 0.2, erupt: 1, waterHeat: 1, rumble: 0.4, lava: l, signBurn: clamp(l * 1.5) };
      drawSpringEvening(ctx, t, o); drawSpringOverlay(ctx, t, o);
    }));
  },
  lava_full(ctx, t) {
    const o = { setting: 'evening', dusk: 0.2, erupt: 1, waterHeat: 1, rumble: 0.4, lava: 0.75, signBurn: 0.8 };
    drawSpringEvening(ctx, t, o); drawSpringOverlay(ctx, t, o);
  },
  boil(ctx, t) {
    [0, 0.4, 0.7, 1].forEach((h, i) => tile(ctx, i, 2, 2, `waterHeat ${h}`, () => {
      drawSpringDay(ctx, t, { waterHeat: h });
      trio(ctx, t, SPRING.swimSpots);
      drawWaterFront(ctx, t, { setting: 'day', waterHeat: h });
      drawSpringOverlay(ctx, t, { waterHeat: h });
    }));
  },
  boil_full(ctx, t) {
    const o = { waterHeat: 1, rumble: 0.3 };
    drawSpringDay(ctx, t, o);
    trio(ctx, t, SPRING.swimSpots);
    drawWaterFront(ctx, t, o);
    drawSpringOverlay(ctx, t, o);
  },
  rumble(ctx, t) { drawSpringDay(ctx, t, { rumble: 1, volcanoSmoke: 0.7 }); drawSpringOverlay(ctx, t, { rumble: 1 }); },
  new_spring(ctx, t) { drawNewSpring(ctx, t, { raft: true }); },
  new_swim(ctx, t) {
    drawNewSpring(ctx, t, { raft: true });
    trio(ctx, t, NEW_SPRING.swimSpots);
    drawWaterFront(ctx, t, { setting: 'new' });
  },
  sign(ctx, t) {
    const P = palette('day');
    ctx.fillStyle = '#7DB765'; ctx.fillRect(0, 0, 1280, 720);
    [0, 0.3, 0.65, 1].forEach((b, i) => drawSnoozeSignImpl(ctx, t, P, { x: 170 + i * 310, y: 300, burn: b, scale: 1.25 }));
    drawSnoozeSignImpl(ctx, t, palette('new'), { x: 320, y: 640, scale: 1.5, lines: ['SNOOZE SPRINGS 2', 'Barry Approved'], check: true });
    drawSnoozeSignImpl(ctx, t, palette('evening', 0.3), { x: 900, y: 640, scale: 1.5 });
  },
  particles(ctx, t) {
    ctx.fillStyle = '#2B3A4A'; ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = '#3FAFB5'; ctx.fillRect(0, 470, 640, 250);
    ctx.font = '600 14px Nunito'; ctx.fillStyle = '#fff';
    ctx.fillText('steam (amount .3 / .7 / 1.2)', 20, 30);
    drawSteam(ctx, t, { x: 110, y: 260, w: 180, amount: 0.3, h: 140 });
    drawSteam(ctx, t, { x: 320, y: 260, w: 180, amount: 0.7, h: 140 });
    drawSteam(ctx, t, { x: 530, y: 260, w: 180, amount: 1.2, h: 160 });
    ctx.fillStyle = '#fff';
    ctx.fillText('bubbles (.3 / .7 / 1) + waterlineRipple', 20, 490);
    drawBubbles(ctx, t, { x: 110, y: 560, w: 180, h: 50, amount: 0.3 });
    drawBubbles(ctx, t, { x: 320, y: 560, w: 180, h: 50, amount: 0.7 });
    drawBubbles(ctx, t, { x: 530, y: 560, w: 180, h: 50, amount: 1, scale: 1.2 });
    waterlineRipple(ctx, 320, 670, 160, t, { part: 'both' });
    ctx.fillStyle = '#fff';
    ctx.fillText('fallingRocks (loops every 3s) / ash / embers', 660, 30);
    ctx.save();
    ctx.beginPath(); ctx.rect(640, 0, 640, 720); ctx.clip();
    ctx.fillStyle = '#6E9A5A'; ctx.fillRect(640, 600, 640, 120);
    drawFallingRocks(ctx, t % 3, { t0: 0, count: 10, seed: 3, dur: 1.2, area: { x0: 700, x1: 1220, yTop: -40, yGround: [610, 690] } });
    drawAsh(ctx, t, { density: 1, area: { x0: 640, x1: 1280, y0: 0, y1: 720 } });
    drawEmbers(ctx, t, { density: 1, area: { x0: 640, x1: 1280, y0: 0, y1: 720 } });
    ctx.restore();
  },
  framings(ctx, t) {
    const S = SPRING.swimSpots;
    const views = [
      ['wide z0.85', { x: 640, y: 360, zoom: 0.85 }],
      ['sunny z2.2', { x: S.sunny.x, y: S.sunny.y, zoom: 2.2 }],
      ['barry z2.2', { x: S.barry.x, y: S.barry.y, zoom: 2.2 }],
      ['doreen z2.2', { x: S.doreen.x, y: S.doreen.y, zoom: 2.2 }],
      ['volcano z2', { x: 860, y: 230, zoom: 2 }],
      ['wide z0.8 erupt .5', { x: 640, y: 340, zoom: 0.8 }],
    ];
    views.forEach(([label, cam], i) => tile(ctx, i, 3, 2, label, () => withCamera(ctx, cam, () => {
      const o = i === 5 ? { setting: 'day', erupt: 0.5, waterHeat: 0.8 } : {};
      drawSpringDay(ctx, t, o);
      if (i === 5) drawSpringOverlay(ctx, t, o);
    })));
  },
  framings_more(ctx, t) {
    const views = [
      ['evening wide z0.85', { x: 640, y: 360, zoom: 0.85 }],
      ['raft z2', { x: 110, y: 560, zoom: 2 }],
      ['exit signs z2', { x: 300, y: 430, zoom: 2 }],
      ['sign z2.5', { x: 1150, y: 380, zoom: 2.5 }],
      ['volcano z2 erupt .7', { x: 860, y: 230, zoom: 2 }],
      ['new spring z0.85', { x: 640, y: 360, zoom: 0.85 }],
    ];
    views.forEach(([label, cam], i) => tile(ctx, i, 3, 2, label, () => withCamera(ctx, cam, () => {
      if (i === 5) drawNewSpring(ctx, t, {});
      else drawSpringEvening(ctx, t, i === 4 ? { erupt: 0.7, dusk: 0.3 } : { dusk: 0.3 });
    })));
  },
  foreground(ctx, t) {
    drawSpringDay(ctx, t, {});
    drawForegroundFoliage(ctx, t, { top: true });
  },
};

module.exports = {
  drawSpringDay, drawSpringEvening, drawNewSpring, drawEruption, drawMountSnooze, drawSnoozeSign,
  drawWaterFront, waterlineRipple, drawSpringOverlay, drawForegroundFoliage,
  fallingRocks, drawFallingRocks, drawAsh, drawEmbers, drawSteam, drawBubbles,
  inPool, SPRING, NEW_SPRING, lab,
};
