// CHILL CAPYBARA — critters: Gerald (vulture), Dr. Shelley (tortoise), fish, and the narrator's
// extras (tropical bird, sleepy monkey). See DESIGN.md §6.
//
// All functions draw in 1280x720 design units, are pure functions of their inputs (time
// included; seeded hashes only, never Math.random), wrap everything in ctx.save()/restore()
// and default to facing RIGHT (flip:true faces LEFT). `scale` multiplies everything,
// including outline widths. `rot` (radians) rotates the whole character about its origin.
//
// ─────────────────────────────────────────────────────────────────────────────
// drawVulture(ctx, o)  — GERALD. Polite, faintly ominous British turkey/king vulture.
//   ORIGIN = the feet contact point (the perch surface) in EVERY pose, so a landing can be
//   animated by moving x/y onto the perch and switching pose 'land' → 'perch'.
//   Size at scale 1: ≈ 100 units feet→head-top perched, wingspan ≈ 290 in flight.
//   On a capybara: x/y = capyAnchors(o).headTop, rot = headTop.angle, scale ≈ 0.75 × capy scale.
//   o = {
//     x, y, scale=1, flip=false, rot=0, t (s, idle: breathing, slow blinks, head drift)
//     talk 0..1         opens the hooked beak (lower mandible) + small head bob
//     pose 'perch' (default) | 'fly' | 'land' | 'takeoff'
//          perch:   hunched, folded wings like a tail-coat, talons wrapped over the surface
//          fly:     body horizontal, big fingered wings (3D flap model), feet tucked
//          land:    body pitched back, wings raised high braking, legs reaching to the origin,
//                   talons open
//          takeoff: body pitched forward, legs pushing off the origin, wings flapping
//     wing 0..1         spread. perch default 0 (folded); perch with wing > 0.06 opens the
//                       wings at the shoulders (sunning / balancing / shrug). fly/land/takeoff
//                       default 1 (lower = half-tucked, e.g. a fast dive away)
//     flapPhase         flap cycle in CYCLES (0 = wings up, 0.5 = wings down; downstroke 55%).
//                       Omitted → automatic 2.3 Hz from t. In perch with wing>0, passing a
//                       flapPhase adds balancing flaps (e.g. during the rumble).
//     glide bool        fly: soaring, wings held out, no flapping
//     legs 0..1         land/takeoff: leg extension (1 = full; tween → 0 to settle into perch)
//     mood 'smug' (default: politely knowing) | 'neutral' | 'happy' | 'sad' | 'shock'
//          (also accepts deadpan, chill, sleepy, worried, panic)
//     look {x,y} -1..1  pupil direction (x+ = toward the beak, y+ = down); also nudges the head
//     ruffle 0..1       feathers bristle (stray tufts, fluffed ruff). shock/panic default 0.85
//   }
// vultureAnchors(o) → { beak, head, headCenter, eye, feet, body }   world {x,y} points for the
//   same options (beak = beak tip: aim speech/glints; head = top of the skull).
// drawFeather(ctx, {x, y, scale, rot})  one charcoal feather (the one that spins down when he
//   leaves). Animate x/y/rot yourself.
//
// ─────────────────────────────────────────────────────────────────────────────
// drawTortoise(ctx, o)  — DR. SHELLEY. Ancient tortoise therapist sitting upright like a person.
//   ORIGIN = seat contact point (bottom of the shell on the cushion). The office env draws the
//   chair: use OFFICE.chair with flip:true (faces left toward the couch), scale 1.
//   Size at scale 1: shell ≈ 145 tall × 85 deep, ≈ 215 seat→head-top.
//   o = {
//     x, y, scale=1, flip=false, rot=0, t (very slow breathing, neck sway, ~6.5 s slow blinks)
//     talk 0..1        opens the beak slowly (gentle jaw)
//     mood 'neutral' (heavy-lidded) | 'happy' | 'sad' | 'smug' | 'shock' | 'chill' | 'worried' |
//          'deadpan' | 'sleepy' | 'panic'
//     write 0..1       writing progress (e.g. S.prog('shelley_writes')). The pencil hand follows
//                      the pen tip; omitted → resting pencil, page already has some scribbles.
//     note 'TEXT'      optional: instead of scribbles, write this word (0→0.72 of `write`) and
//                      underline it twice (0.72→1). Readable in a close-up.
//     notepad=true     false → no pad/pencil; hands clasped on the belly
//     look {x,y}       pupils (x+ toward the beak)
//     neck -1..1       neck lean: + cranes forward/down (look at the hourglass), − pulls back
//     neckLen          neck extension multiplier (default 1; shock/panic pull it in a bit)
//   }
// tortoiseAnchors(o) → { notepad, head, headCenter, beak, eye, seat }
//
// ─────────────────────────────────────────────────────────────────────────────
// drawFish(ctx, o)  — cute round fish ("the fish are leaving").
//   o = {
//     x, y, scale=1 (≈ 46 long incl. tail), flip, rot, t, seed (blink rhythm)
//     color 'orange' (default) | 'teal' | any '#hex'
//     swim (default when `hop` is not given): ORIGIN = body centre; tail wags, gentle bob.
//          swim:false → still (e.g. lying on a lily pad)
//     hop: phase       hop along the ground standing on its tail. ORIGIN = ground contact
//          (cycles; 0 = landed/squash, 0.5 = apex ≈ 22 units up). Advance it yourself,
//          e.g. hop = t * 1.6, and move x with fishHopX (feet stay planted between hops).
//     suitcase bool    carries a tiny leather suitcase with travel stickers (swings with hops)
//     mood 'neutral' | 'happy' | 'worried' | 'sad' | 'solemn' | 'shock' (+ panic/chill/smug/…)
//     nod 0..1         head dips forward (the "one slow solemn nod")
//     wave 0..1        pectoral fin raised above the back, waving
//     look {x,y}       pupils
//   }
// fishAnchors(o) → { center, mouth, eye, top }
// fishHopX(hop, stride=30) → x offset (scale-1 units × your scale) that only advances in the air.
// drawTinySuitcase(ctx, x, y, s=1, rot=0)  the suitcase alone (origin = top of the handle).
//
// ─────────────────────────────────────────────────────────────────────────────
// drawBird(ctx, o)  — small tropical bird (kiskadee-style: yellow belly, white brow + throat,
//   black mask). ORIGIN = feet contact (perch). Size at scale 1 ≈ 34 tall perched — sits on a
//   capybara headTop at ≈ 1.0 × capy scale.
//   o = { x, y, scale, flip, rot, t, seed (twitch/blink rhythm), pose 'perch' | 'fly',
//         flapPhase (fly; default fast from t), chirp: bool (auto) | 0..1 (beak open + chirp
//         ticks), look {x,y} }
// birdAnchors(o) → { beak, head, feet }
// drawMonkey(ctx, o)  — small capuchin asleep belly-down, draped along a capybara's back with
//   arms/legs dangling and tail curled. ORIGIN = belly contact point (use capyAnchors().back,
//   scale ≈ 0.9 × capy scale).
//   o = { x, y, scale, flip (head toward −x), rot, t, sleep=true (false → awake, eyes open;
//         asleep → slow breathing), drape 0..1.5 (how far the limbs hang) }
// monkeyAnchors(o) → { head, belly }   (head ≈ where to put a "Zzz")
//
// lab sheets: gerald, gerald_flap (use --frames 8 --dt 0.1), shelley, fish, extras,
//             context (Gerald/extras on the real capybara rig, if capybara.js is present)
// Perf (1920x1080 scale): Gerald perched ≈ 5 ms (close-up at 5x ≈ 15 ms), Shelley ≈ 9 ms,
//   fish / bird / monkey ≈ 1–1.5 ms each.
'use strict';
const { Path2D, DOMMatrix } = require('@napi-rs/canvas');
const U = require('./util');
const { TAU, clamp, lerp, mix, shade, rgba, hash1, noise1, smoothstep } = U;

// ============================================================== drawing kit
let LX = -1; // light direction in local coords (-1: light from local left). Set per draw call.
let LW = 1;  // outline weight multiplier for the character being drawn. Set per draw call.

function bl(pts, tension = 1, p = new Path2D()) {
  const n = pts.length;
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    p.bezierCurveTo(
      p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension,
      p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension,
      p2[0], p2[1]);
  }
  p.closePath();
  return p;
}
function cv(pts, tension = 1, p = new Path2D(), move = true) {
  const n = pts.length;
  if (move) p.moveTo(pts[0][0], pts[0][1]); else p.lineTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    p.bezierCurveTo(
      p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension,
      p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension,
      p2[0], p2[1]);
  }
  return p;
}
function el(x, y, rx, ry, rot = 0, p = new Path2D()) {
  p.moveTo(x + Math.cos(rot) * Math.abs(rx), y + Math.sin(rot) * Math.abs(rx));
  p.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU);
  p.closePath();
  return p;
}
const MOVE = (dx, dy) => new DOMMatrix([1, 0, 0, 1, dx, dy]);
// fill the part of `path` NOT covered by `path` shifted by (dx,dy)
function crescent(ctx, path, dx, dy, style) {
  const q = new Path2D();
  q.rect(-400, -400, 800, 800);
  q.addPath(path, MOVE(dx, dy));
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = style;
  ctx.fill(q, 'evenodd');
  ctx.restore();
}
// Storybook fill: gradient body + hard shadow crescent + rim-light crescent + thin outline.
// c = {base, hi, lo, line, rim, sh}; o = {lg:[x0,y0,x1,y1] | rg:[cx,cy,r], rim, sh, lw}
function paint(ctx, path, c, o = {}) {
  let fs = c.base;
  if (o.lg) {
    const g = ctx.createLinearGradient(o.lg[0], o.lg[1], o.lg[2], o.lg[3]);
    g.addColorStop(0, c.hi); g.addColorStop(o.mid == null ? 0.5 : o.mid, c.base); g.addColorStop(1, c.lo);
    fs = g;
  } else if (o.rg) {
    const [cx, cy, r] = o.rg;
    const g = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
    g.addColorStop(0, c.hi); g.addColorStop(o.mid == null ? 0.55 : o.mid, c.base); g.addColorStop(1, c.lo);
    fs = g;
  }
  ctx.fillStyle = fs;
  ctx.fill(path);
  if (o.sh) crescent(ctx, path, LX * 0.45 * o.sh, -o.sh, c.sh || rgba(c.lo, 0.55));
  if (o.rim) crescent(ctx, path, -LX * 0.55 * o.rim, o.rim, c.rim || 'rgba(255,255,255,0.22)');
  const lw = (o.lw == null ? 1.6 : o.lw) * LW;
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = c.line;
    ctx.lineJoin = 'round';
    ctx.stroke(path);
  }
}
function strokeP(ctx, path, color, lw, cap = 'round') {
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  ctx.lineCap = cap;
  ctx.lineJoin = 'round';
  ctx.stroke(path);
}
// limb as a double stroke (outline + fill) along a smooth curve
function limb(ctx, pts, w, fill, line, lw = 1.5) {
  const p = cv(pts);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = line; ctx.lineWidth = w + lw * 2 * LW; ctx.stroke(p);
  ctx.strokeStyle = fill; ctx.lineWidth = w; ctx.stroke(p);
  return p;
}
const rot2 = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
// deterministic blink amount 0..1 (1 = closed) — period s, closing duration d
function blinkAmt(t, period, d, seed) {
  const k = t / period + seed;
  const f = (k - Math.floor(k)) * period;
  const jitter = hash1(Math.floor(k) + seed * 7.3);
  if (jitter < 0.18) return 0; // skip some blinks
  if (f > d) return 0;
  return Math.sin((f / d) * Math.PI);
}
function label(ctx, text, x, y, size = 15, color = '#ffffff') {
  ctx.save();
  ctx.font = `600 ${size}px Fredoka`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// pointed leaf / feather from (x0,y0) to (x1,y1), half-width w, bulge position k (0..1)
function leaf(x0, y0, x1, y1, w, p = new Path2D(), k = 0.45, w2) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const mx = x0 + dx * k, my = y0 + dy * k;
  const wb = w2 == null ? w : w2;
  p.moveTo(x0, y0);
  p.quadraticCurveTo(mx + nx * w * 1.6, my + ny * w * 1.6, x1, y1);
  p.quadraticCurveTo(mx - nx * wb * 1.6, my - ny * wb * 1.6, x0, y0);
  p.closePath();
  return p;
}
// rounded strip (finger feather) from base to tip, widths wb (base) and wt (tip)
function strip(x0, y0, x1, y1, wb, wt, p = new Path2D()) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L, ux = dx / L, uy = dy / L;
  p.moveTo(x0 + nx * wb, y0 + ny * wb);
  p.quadraticCurveTo(x0 + dx * 0.6 + nx * (wb + wt) * 0.55, y0 + dy * 0.6 + ny * (wb + wt) * 0.55, x1 + nx * wt, y1 + ny * wt);
  p.bezierCurveTo(x1 + nx * wt + ux * wt * 1.3, y1 + ny * wt + uy * wt * 1.3, x1 - nx * wt + ux * wt * 1.3, y1 - ny * wt + uy * wt * 1.3, x1 - nx * wt, y1 - ny * wt);
  p.quadraticCurveTo(x0 + dx * 0.6 - nx * (wb + wt) * 0.55, y0 + dy * 0.6 - ny * (wb + wt) * 0.55, x0 - nx * wb, y0 - ny * wb);
  p.closePath();
  return p;
}
// scalloped (fluffy) ellipse
function scallop(cx, cy, rx, ry, rot, n, bulge, seed = 1, p = new Path2D(), spike = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash1(seed + i) * 0.25;
    const rr = 1 + (hash1(seed * 3 + i) - 0.5) * 0.12;
    const [x, y] = rot2(Math.cos(a) * rx * rr, Math.sin(a) * ry * rr, rot);
    pts.push([cx + x, cy + y, a]);
  }
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const A = pts[i], B = pts[(i + 1) % n];
    const am = (A[2] + (i === n - 1 ? B[2] + TAU : B[2])) / 2;
    const b = bulge * (1 + spike * (hash1(seed + i * 1.7) - 0.3));
    const [ox, oy] = rot2(Math.cos(am) * (rx + b * 2.2), Math.sin(am) * (ry + b * 2.2), rot);
    if (spike > 0) p.lineTo(cx + ox * (1 + spike * 0.25), cy + oy * (1 + spike * 0.25)), p.lineTo(B[0], B[1]);
    else p.quadraticCurveTo(cx + ox, cy + oy, B[0], B[1]);
  }
  p.closePath();
  return p;
}
// a row of scallop arcs along points (feather tips), bulging toward (bx,by)
function scallopRow(pts, bx, by, p = new Path2D()) {
  for (let i = 0; i < pts.length - 1; i++) {
    const A = pts[i], B = pts[i + 1];
    p.moveTo(A[0], A[1]);
    p.quadraticCurveTo((A[0] + B[0]) / 2 + bx, (A[1] + B[1]) / 2 + by, B[0], B[1]);
  }
  return p;
}
function rrP(x, y, w, h, r, p = new Path2D()) {
  r = Math.min(r, w / 2, h / 2);
  p.moveTo(x + r, y);
  p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r);
  p.closePath();
  return p;
}
const lerp2 = (A, B, k) => [lerp(A[0], B[0], k), lerp(A[1], B[1], k)];
function linePts(A, B, n) { const r = []; for (let i = 0; i <= n; i++) r.push(lerp2(A, B, i / n)); return r; }

// ============================================================== GERALD (vulture)
const GC = {
  body: { base: '#2E2A33', hi: '#453E4D', lo: '#1E1B23', line: '#121015', rim: 'rgba(182,170,214,0.36)', sh: 'rgba(6,4,10,0.30)' },
  vest: 'rgba(120,104,128,0.30)',
  wing: { base: '#2B2731', hi: '#413A49', lo: '#1B1820', line: '#121015', rim: 'rgba(182,170,214,0.32)', sh: 'rgba(6,4,10,0.32)' },
  edge: '#5A5066',
  wingFar: { base: '#1E1B23', hi: '#2A2630', lo: '#16141A', line: '#0E0C10' },
  silver: { base: '#A9A4B2', hi: '#D6D1DC', lo: '#7D7887' },
  topf: { base: '#4C4555', hi: '#625A6C', lo: '#37313E' },
  dark: { base: '#2F2B36', hi: '#45404E', lo: '#211E27', line: '#121015' },
  ruff: { base: '#F2EEE8', hi: '#FFFFFF', lo: '#C6BFD1', line: '#8A839A', rim: 'rgba(255,255,255,0.9)', sh: 'rgba(110,98,140,0.24)' },
  head: { base: '#E07A6A', hi: '#F5AA9A', lo: '#C45C4F', line: '#873832', rim: 'rgba(255,230,216,0.6)', sh: 'rgba(130,40,38,0.24)' },
  lid: '#CD685A',
  wrinkle: 'rgba(140,48,44,0.55)',
  beak: { base: '#ECE2C7', hi: '#FFFAEC', lo: '#C9B992', line: '#7A6B50', rim: 'rgba(255,255,255,0.7)' },
  leg: { base: '#CFBDB7', hi: '#E8DCD7', lo: '#A6908B', line: '#6A5753' },
  legFar: { base: '#A69490', line: '#5A4945' },
  talon: '#2A2429',
  mouth: '#5C1E26',
};
const GFACE = {
  neutral: { lid: 0.40, lo: 0.06, brow: 0.05, browUp: 0, smile: 0.15 },
  smug: { lid: 0.42, lo: 0.18, brow: 0.22, browUp: 1.0, smile: 0.9, tilt: -0.11 },
  happy: { lid: 0.5, brow: -0.1, browUp: 1.8, smile: 1, happy: true, tilt: -0.1 },
  sad: { lid: 0.62, lo: 0.1, brow: -0.5, browUp: 0.8, smile: -0.8, tilt: 0.2, droop: 1 },
  shock: { lid: 0.0, brow: -0.2, browUp: 3.2, smile: -0.5, eye: 1.28, tilt: -0.14, ruffle: 0.85, back: 1 },
};
// the rest of the film's mood vocabulary maps onto Gerald's range
Object.assign(GFACE, {
  deadpan: { ...GFACE.neutral, lid: 0.55, smile: 0 },
  chill: { ...GFACE.smug, lid: 0.55, smile: 0.6 },
  sleepy: { ...GFACE.neutral, lid: 0.78, tilt: 0.08 },
  worried: { ...GFACE.sad, droop: 0, tilt: 0, lid: 0.3, eye: 1.08 },
  panic: { ...GFACE.shock },
});
// perch-space key points (origin = feet, facing right)
const G_C = [-6, -46];        // body pivot
const KP_PERCH = { N: [12, -71], S: [-6, -79], H: [-2, -12], T: [-30, -16] };
const KP_FLY = { N: [27, -56], S: [4, -62], H: [-18, -41], T: [-36, -52] };
const G_BODY_PERCH = [[-6, -85], [-24, -81], [-38, -65], [-43, -42], [-36, -20], [-16, -8], [8, -10], [24, -25], [29, -45], [23, -63], [11, -77]];
const G_BODY_FLY = [[24, -62], [6, -68], [-16, -67], [-36, -59], [-42, -51], [-30, -42], [-8, -37], [14, -39], [27, -46], [32, -55]];

// pose/rig solver shared by drawVulture and vultureAnchors
function geraldRig(o) {
  const t = o.t || 0;
  const pose = ['perch', 'fly', 'land', 'takeoff'].includes(o.pose) ? o.pose : 'perch';
  const mood = GFACE[o.mood] ? o.mood : 'smug';
  const F = GFACE[mood];
  const talk = clamp(o.talk || 0);
  const breath = Math.sin(t * 1.7);
  const wing = clamp(o.wing == null ? (pose === 'perch' ? 0 : 1) : o.wing);
  const legs = clamp(o.legs == null ? 1 : o.legs);
  const look = o.look || { x: 0.35, y: 0.3 };
  const R = { pose, mood, F, talk, t, wing, legs, look, glide: !!o.glide };
  // flap cycle: phase 0 = wings at top, 0.5 = bottom (downstroke = first 55% of the cycle)
  const autoFlap = o.flapPhase == null;
  const fp = autoFlap ? t * 2.3 : o.flapPhase;
  const p = fp - Math.floor(fp);
  const w = p < 0.55 ? (p / 0.55) * 0.5 : 0.5 + ((p - 0.55) / 0.45) * 0.5;
  const th = TAU * w, sn = Math.sin(th), cs = Math.cos(th);
  const up = Math.max(0, -sn);
  R.flap = { p, sn, cs, up };
  R.fly = pose === 'fly';
  R.spread = pose !== 'perch' || wing > 0.06;
  let bx = G_C[0], by = G_C[1] + breath * 0.5, brot = 0, headRot = (F.tilt || 0) + 0.04 * noise1(t * 0.35 + 3) - talk * 0.05;
  if (pose === 'perch') {
    brot = (F.droop ? 0.05 : 0) - (F.back ? 0.04 : 0);
    if (F.back) by -= 2;
    if (R.spread && !autoFlap) by -= 1.5 * sn * wing; // balancing flaps
  } else if (pose === 'fly') {
    bx = 0; by = -sn * 3.5 * (R.glide ? 0 : 1) + breath * 0.3; brot = R.glide ? 0 : -0.04 * cs;
  } else if (pose === 'land') {
    bx = G_C[0] - 8 * legs; by = G_C[1] - 22 * legs - sn * 2 * legs; brot = -0.32 * legs;
  } else if (pose === 'takeoff') {
    bx = G_C[0] + 8 * legs; by = G_C[1] - 12 * legs - sn * 2 * legs; brot = 0.55 * legs;
    headRot += 0.05 * legs;
  }
  R.bx = bx; R.by = by; R.brot = brot;
  const pivot = R.fly ? [0, 0] : G_C;
  R.pivot = pivot;
  R.KP = R.fly ? KP_FLY : KP_PERCH;
  R.B = (x, y) => {
    const [rx, ry] = rot2(x - pivot[0], y - pivot[1], brot);
    return [bx + rx, by + ry];
  };
  const nb = R.B(R.KP.N[0], R.KP.N[1]);
  let hoff = [26, -9];
  if (pose === 'fly') hoff = [22, -3];
  if (pose === 'land') hoff = [22, -12];
  if (pose === 'takeoff') hoff = [25, -2];
  if (F.back) hoff = [hoff[0] - 4, hoff[1] - 6];
  if (F.droop) hoff = [hoff[0] + 1, hoff[1] + 4];
  headRot += (look.y || 0) * 0.08;
  R.neckBase = nb;
  R.hx = nb[0] + hoff[0] + (look.x || 0) * 1.2;
  R.hy = nb[1] + hoff[1] + (look.y || 0) * 1.5 + talk * 0.8 + breath * 0.3;
  R.hr = headRot + (R.fly ? 0.08 : 0);
  R.hs = 1.3;
  R.ruffRot = R.fly ? 1.5 : 1.1 + brot;
  return R;
}
// head-local → gerald-local
function gHead(R, x, y) {
  const [rx, ry] = rot2(x * R.hs, y * R.hs, R.hr);
  return [R.hx + rx, R.hy + ry];
}

function geraldHead(ctx, R) {
  const { F, talk } = R;
  ctx.save();
  ctx.translate(R.hx, R.hy);
  ctx.rotate(R.hr);
  ctx.scale(R.hs, R.hs);
  // --- lower mandible + mouth (behind upper)
  const jaw = talk * 0.42;
  if (talk > 0.02) {
    const m = new Path2D();
    const [lx, ly] = rot2(13.5, 4.5, jaw);
    m.moveTo(12, 1); m.lineTo(26, 1.4); m.lineTo(13 + lx, 2.5 + ly); m.lineTo(11, 6); m.closePath();
    ctx.fillStyle = GC.mouth; ctx.fill(m);
    ctx.fillStyle = '#C8606A'; ctx.beginPath(); ctx.ellipse(16, 5 + talk * 3, 4.5, 2.2, jaw * 0.6, 0, TAU); ctx.fill();
  }
  ctx.save();
  ctx.translate(12.5, 2.5); ctx.rotate(jaw); ctx.translate(-12.5, -2.5);
  const lo = new Path2D();
  lo.moveTo(11.5, 2.2);
  lo.bezierCurveTo(17, 2.4, 22.5, 2.0, 26.2, 2.4);
  lo.bezierCurveTo(24, 5.6, 18.5, 7.4, 12, 7.2);
  lo.closePath();
  paint(ctx, lo, { ...GC.beak, base: '#DCCFAE', hi: '#EEE5CC' }, { lg: [0, 2, 0, 8], lw: 1.1 });
  ctx.restore();
  // --- skull (domed, bald)
  const skull = bl([[-15.5, 2], [-15, -9], [-8, -18.5], [4, -19], [13, -13], [16.5, -3], [14, 7.5], [3, 12], [-8, 11]]);
  paint(ctx, skull, GC.head, { rg: [2, -10, 27], rim: 1.7, sh: 2.4, lw: 1.5, mid: 0.5 });
  // wrinkles / folds
  const wr = new Path2D();
  cv([[-12.5, -5], [-10.5, -0.5], [-11.5, 4.5]], 1, wr);
  cv([[-8.5, 3.5], [-5.5, 6.5], [-1.5, 7.2]], 1, wr);
  cv([[-13, 6.5], [-9, 9.2], [-4.5, 10.2]], 1, wr);
  cv([[-7.5, -12], [-9.8, -8]], 1, wr);
  cv([[9.5, -13], [11.5, -10], [12, -7]], 1, wr);
  strokeP(ctx, wr, GC.wrinkle, 0.9);
  ctx.fillStyle = 'rgba(255,214,200,0.45)';
  for (const [x, y, r] of [[-4, -12, 0.9], [-1, -13.5, 0.7], [-8, -6, 0.7], [1.5, 6, 0.8], [-2, 9, 0.6], [9, 6, 0.7], [-11, -3, 0.6]]) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = 'rgba(110,34,32,0.7)';
  ctx.beginPath(); ctx.ellipse(-6.5, -0.5, 1.3, 1.6, 0, 0, TAU); ctx.fill();
  // --- upper mandible
  ctx.save();
  ctx.translate(12, -2); ctx.rotate(-talk * 0.08); ctx.translate(-12, 2);
  const up = new Path2D();
  up.moveTo(11.5, -8.5);
  up.bezierCurveTo(19, -11, 27, -9.5, 30.5, -3.8);
  up.bezierCurveTo(32.6, -0.2, 31.8, 5.2, 28.6, 7.8);
  up.bezierCurveTo(28.6, 4.8, 28, 2.8, 25.8, 2.2);
  up.bezierCurveTo(21, 1.4, 16, 2.3, 11.5, 3.1);
  up.closePath();
  paint(ctx, up, GC.beak, { lg: [0, -10, 0, 4], rim: 1.1, lw: 1.2 });
  ctx.save(); ctx.clip(up);
  const tip = ctx.createLinearGradient(24, 0, 31, 4);
  tip.addColorStop(0, 'rgba(160,138,96,0)'); tip.addColorStop(1, 'rgba(150,126,84,0.75)');
  ctx.fillStyle = tip; ctx.fillRect(20, -12, 16, 22);
  ctx.restore();
  const cf = new Path2D(); cv([[13.5, -9.2], [15.2, -4], [14.4, 2.5]], 1, cf);
  strokeP(ctx, cf, 'rgba(122,107,80,0.55)', 1);
  ctx.fillStyle = '#5B3C34';
  ctx.beginPath(); ctx.ellipse(19.6, -4.4, 3.1, 1.15, -0.12, 0, TAU); ctx.fill();
  ctx.restore();
  // --- gape line (mouth-corner smile)
  const sm = F.smile;
  const gp = new Path2D();
  gp.moveTo(13.5, 2.6);
  gp.quadraticCurveTo(10.5, 3.2 + sm * 0.4, 8.2, 2.4 - sm * 2.1);
  strokeP(ctx, gp, '#8A3A33', 1.3);
  if (sm > 0.3) {
    const ck = new Path2D();
    const gx = 8.2, gy = 2.4 - sm * 2.1;
    ck.moveTo(gx - 0.6, gy - 2.6); ck.quadraticCurveTo(gx - 2.6, gy - 0.4, gx - 1.2, gy + 2.2);
    strokeP(ctx, ck, rgba('#8A3A33', 0.7 * sm), 1);
  }
  // --- eye
  const eyeS = F.eye || 1;
  const ex = 4.6, ey = -5.4, erx = 4.9 * eyeS, ery = 5.5 * eyeS;
  const blink = o_blink(R);
  if (F.happy) {
    const hp = new Path2D();
    hp.moveTo(0.5, -4.2); hp.quadraticCurveTo(4.5, -9.3, 8.6, -4.4);
    strokeP(ctx, hp, '#3A1A1A', 1.6);
    ctx.fillStyle = 'rgba(255,120,130,0.35)';
    ctx.beginPath(); ctx.ellipse(6, 2.5, 4.5, 2.6, 0, 0, TAU); ctx.fill();
  } else {
    const eye = el(ex, ey, erx, ery);
    ctx.fillStyle = '#FFF8EC'; ctx.fill(eye);
    const lk = R.look;
    const px = ex + 0.6 + clamp(lk.x || 0, -1, 1) * 1.9, py = ey + 0.9 + clamp(lk.y || 0, -1, 1) * 2.0;
    ctx.save(); ctx.clip(eye);
    ctx.fillStyle = '#2B1A17';
    ctx.beginPath(); ctx.arc(px, py, 2.85 * (F.eye ? 0.72 : 1), 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(px - 0.9, py - 1.0, 0.85, 0, TAU); ctx.fill();
    const lid = clamp(F.lid + (1 - F.lid) * blink);
    if (lid > 0.01) {
      const ly = ey - ery + lid * ery * 2.1;
      const lp = new Path2D();
      lp.moveTo(ex - erx - 2, ey - ery - 3);
      lp.lineTo(ex + erx + 2, ey - ery - 3);
      lp.lineTo(ex + erx + 2, ly - 0.8);
      lp.quadraticCurveTo(ex, ly + 1.6, ex - erx - 2, ly - 0.2);
      lp.closePath();
      ctx.fillStyle = GC.lid; ctx.fill(lp);
      const ll = new Path2D();
      ll.moveTo(ex - erx - 1, ly - 0.2); ll.quadraticCurveTo(ex, ly + 1.6, ex + erx + 1, ly - 0.8);
      strokeP(ctx, ll, '#4A1E1C', 1.4);
    }
    // lower lid pushed up by the cheek (smug / knowing)
    const lo = F.lo || 0;
    if (lo > 0.01) {
      const by = ey + ery - lo * ery * 2;
      const lp2 = new Path2D();
      lp2.moveTo(ex - erx - 2, ey + ery + 3); lp2.lineTo(ex + erx + 2, ey + ery + 3);
      lp2.lineTo(ex + erx + 2, by + 0.6); lp2.quadraticCurveTo(ex, by - 1.6, ex - erx - 2, by + 0.2); lp2.closePath();
      ctx.fillStyle = '#D87363'; ctx.fill(lp2);
      const l2 = new Path2D(); l2.moveTo(ex - erx - 1, by + 0.2); l2.quadraticCurveTo(ex, by - 1.6, ex + erx + 1, by + 0.6);
      strokeP(ctx, l2, 'rgba(120,40,36,0.7)', 1);
    }
    ctx.restore();
    ctx.lineWidth = 1; ctx.strokeStyle = '#8A3A33'; ctx.stroke(eye);
    const bag = new Path2D();
    bag.moveTo(ex - erx + 0.5, ey + ery + 0.8); bag.quadraticCurveTo(ex + 0.5, ey + ery + 3.2, ex + erx, ey + ery - 0.2);
    strokeP(ctx, bag, 'rgba(135,56,50,0.6)', 0.9);
  }
  // brow (fleshy ridge)
  ctx.save();
  ctx.translate(ex + 0.6, ey - ery - 1.3 - F.browUp * 0.9);
  ctx.rotate(F.brow);
  const br = new Path2D();
  br.moveTo(-5.8, 0.6); br.quadraticCurveTo(0, -2.6, 5.6, 0.2); br.quadraticCurveTo(0, -0.4, -5.8, 0.6); br.closePath();
  ctx.fillStyle = '#A7473D'; ctx.fill(br);
  ctx.lineWidth = 1.2; ctx.strokeStyle = '#7B2F2A'; ctx.lineJoin = 'round'; ctx.stroke(br);
  ctx.restore();
  ctx.restore();
}
function o_blink(R) { return R.F.lid > 0.6 ? blinkAmt(R.t, 5.3, 0.45, 0.37) : blinkAmt(R.t, 4.6, 0.32, 0.37); }

function geraldRuff(ctx, R, ruffle) {
  const [cx, cy] = R.KP.N;
  const n = 14 + Math.round(ruffle * 4);
  const p = scallop(cx + 1, cy, 18 + ruffle * 3, 11.5 + ruffle * 3, R.fly ? 1.5 : 1.1, n, 2.6 + ruffle * 2.4, 11);
  paint(ctx, p, GC.ruff, { lg: [cx - 8, cy - 15, cx + 8, cy + 15], rim: 1.6, sh: 3.4, lw: 1.3 });
  // inner fluff strokes
  const f = new Path2D();
  for (let i = 0; i < 6; i++) {
    const [ax, ay] = rot2(-9 + (i % 2) * 3, (i - 2.5) * 4.6, R.fly ? 1.5 - 1.1 : 0);
    f.moveTo(cx + ax, cy + ay);
    f.quadraticCurveTo(cx + ax + 3, cy + ay + 1.2, cx + ax + 5.5, cy + ay + 3.5);
  }
  strokeP(ctx, f, 'rgba(140,128,160,0.5)', 0.9);
}

// near folded wing (perch)
function geraldFoldedWing(ctx) {
  // primaries: long pointed feathers -> the "coat tails"
  for (const [x0, y0, x1, y1] of [[-27, -26, -57, 4], [-23, -21, -52, 8], [-19, -18, -46, 9.5]]) {
    const pf = leaf(x0, y0, x1, y1, 4.4, undefined, 0.38);
    paint(ctx, pf, GC.wing, { lg: [x0, y0, x1, y1], rim: 1.1, lw: 1.3 });
  }
  const W = bl([[-6, -86.5], [6, -82], [14.5, -69], [15, -51], [9, -33], [-4, -21], [-20, -13], [-34, -12], [-41, -26], [-42.5, -46], [-39, -66], [-25, -82]], 0.95);
  paint(ctx, W, GC.wing, { lg: [-24, -88, -6, -8], rim: 2.4, sh: 3, lw: 1.6 });
  ctx.save();
  ctx.clip(W);
  // feather rows as overlapping shingles (drawn bottom row first; upper rows overlap)
  const rows = [
    { g: [[17, -49], [-4, -50], [-24, -46], [-46, -38]], n: 4, d: 10, c: 1 },
    { g: [[16, -67], [-2, -70], [-20, -69], [-42, -61]], n: 5, d: 7, c: 0.55 },
  ];
  for (let ri = 0; ri < rows.length; ri++) {
    const { g, n, d, c } = rows[ri];
    // resample guide polyline into n feathers with slight irregularity
    const segL = [];
    let tot = 0;
    for (let i = 0; i < g.length - 1; i++) { const l = Math.hypot(g[i + 1][0] - g[i][0], g[i + 1][1] - g[i][1]); segL.push(l); tot += l; }
    const at = (f) => {
      let dd = f * tot;
      for (let i = 0; i < segL.length; i++) { if (dd <= segL[i] || i === segL.length - 1) return lerp2(g[i], g[i + 1], clamp(dd / segL[i])); dd -= segL[i]; }
      return g[g.length - 1];
    };
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(at(clamp(i / n + (i > 0 && i < n ? (hash1(i * 3.7 + ri) - 0.5) * 0.08 : 0))));
    const band = new Path2D();
    const edge = new Path2D();
    band.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < pts.length - 1; i++) {
      const A = pts[i], B = pts[i + 1];
      const dk = d * (0.85 + hash1(i + ri * 5) * 0.3);
      const cx1 = A[0] + (B[0] - A[0]) * 0.1 - 3, cy1 = A[1] + dk, cx2 = B[0] - (B[0] - A[0]) * 0.25 - 3, cy2 = B[1] + dk * 0.9;
      band.bezierCurveTo(cx1, cy1, cx2, cy2, B[0], B[1]);
      edge.moveTo(A[0], A[1]); edge.bezierCurveTo(cx1, cy1, cx2, cy2, B[0], B[1]);
    }
    band.lineTo(pts[pts.length - 1][0] - 6, -110); band.lineTo(pts[0][0] + 6, -110); band.closePath();
    const top = Math.min(...pts.map((q) => q[1]));
    const gr = ctx.createLinearGradient(0, top - 14, 0, top + d);
    gr.addColorStop(0, '#26222C'); gr.addColorStop(1, mix('#2B2731', '#3E3847', c));
    ctx.fillStyle = gr; ctx.fill(band);
    ctx.save(); ctx.translate(0.3, -1.1); strokeP(ctx, edge, rgba(GC.edge, 0.95 * c), 1.7); ctx.restore();
    strokeP(ctx, edge, rgba('#0C0A10', 0.55 + 0.4 * c), 1.15);
  }
  // secondaries (long feathers down to the lower edge)
  const sl = new Path2D();
  for (let i = 0; i < 5; i++) {
    const x = 8 - i * 9;
    sl.moveTo(x, -38 + i * 1.6);
    sl.quadraticCurveTo(x - 3, -27 + i * 1.2, x - 9, -16 + i * 0.6);
  }
  ctx.save(); ctx.translate(0.8, 0.8); strokeP(ctx, sl, rgba(GC.edge, 0.8), 1.4); ctx.restore();
  strokeP(ctx, sl, 'rgba(12,10,16,0.75)', 1);
  ctx.restore();
}

// spread wing (3D flap model projected to the side view)
function geraldSpreadWing(ctx, R, near, W) {
  const { sp, phiA, phiH, betaA, betaH, hs, chord } = W;
  const S = R.KP.S;
  const pr = R.B(S[0] + (near ? 0 : 5), S[1] + (near ? 0 : -2));
  const cx = Math.cos(chord), cy = Math.sin(chord);
  const ux = cy, uy = -cx;
  const PX = -0.25, PY = 0.38, zs = near ? 1 : -1;
  const dir = (phi, beta) => {
    const cb = Math.cos(beta), sb = Math.sin(beta);
    const a = Math.sin(phi) * cb, b = Math.cos(phi) * cb * zs;
    return [-sb * cx + a * ux + b * PX, -sb * cy + a * uy + b * PY];
  };
  const L = lerp(66, 128, sp);
  const D1 = dir(phiA, betaA), D2 = dir(phiH, betaH);
  const SW = 0.45;
  const wr = [pr[0] + SW * L * D1[0], pr[1] + SW * L * D1[1]];
  const M = (u, s) => {
    if (s <= SW) return [pr[0] + u * cx + s * L * D1[0], pr[1] + u * cy + s * L * D1[1]];
    const k = (s - SW) * L * hs;
    return [wr[0] + u * cx + k * D2[0], wr[1] + u * cy + k * D2[1]];
  };
  const e = 0.42;
  const under = near ? smoothstep(-0.1, 0.14, Math.sin(phiA - e)) : 0;
  const dim = near ? 0 : 0.45;
  const fcol = {
    base: mix(mix(GC.topf.base, GC.silver.base, under), '#121016', dim),
    hi: mix(mix(GC.topf.hi, GC.silver.hi, under), '#121016', dim),
    lo: mix(mix(GC.topf.lo, GC.silver.lo, under), '#121016', dim),
    line: GC.wing.line,
  };
  const tipCol = mix(mix('#26222C', '#3E3A46', under), '#121015', dim);
  // fingers (primaries), inner → outer
  const FING = [
    [[-19, 0.74], [-28, 0.92]], [[-14, 0.75], [-22, 1.01]], [[-9, 0.76], [-15, 1.07]],
    [[-4, 0.75], [-7, 1.1]], [[1, 0.73], [0.5, 1.08]], [[6, 0.70], [7.5, 1.0]],
  ];
  for (let i = 0; i < FING.length; i++) {
    const [b, tp] = FING[i];
    const tu = lerp(-10 + (tp[0] + 10) * 0.3, tp[0], sp), ts = lerp(0.98, tp[1], sp);
    const B0 = M(b[0], b[1]), T0 = M(tu, ts);
    // tips flex against the air: up on the downstroke, down on the upstroke
    const flex = (near ? 1 : 1) * R.flap.sn * 3.5 * (0.4 + i * 0.12) * (R.spreadFlap ? 1 : 0);
    const T1 = [T0[0], T0[1] - flex];
    const fp = strip(B0[0], B0[1], T1[0], T1[1], 3.8, 2.7);
    const g = ctx.createLinearGradient(B0[0], B0[1], T1[0], T1[1]);
    g.addColorStop(0, fcol.base); g.addColorStop(0.6, mix(fcol.base, tipCol, 0.35)); g.addColorStop(1, tipCol);
    ctx.fillStyle = g; ctx.fill(fp);
    ctx.lineWidth = 1.2 * LW; ctx.strokeStyle = fcol.line; ctx.lineJoin = 'round'; ctx.stroke(fp);
    const rp = new Path2D(); rp.moveTo(B0[0], B0[1]); rp.lineTo(lerp(B0[0], T1[0], 0.85), lerp(B0[1], T1[1], 0.85));
    strokeP(ctx, rp, rgba('#ffffff', 0.10 + under * 0.18), 0.7);
  }
  // membrane: leading edge → finger bases → scalloped trailing edge (secondaries)
  const te = [];
  for (let k = 0; k <= 9; k++) {
    const s = 0.72 - k * (0.76 / 9);
    te.push([-28 - (k % 2 ? 0 : 3.4) + (s > 0.62 ? 4 : 0), s]);
  }
  const memPts = [[13, -0.04], [15, 0.14], [16, 0.3], [15, 0.45], [10, 0.6], [5, 0.71], [-4, 0.77], [-13, 0.78], [-20, 0.75], ...te, [-20, -0.06]];
  const mem = bl(memPts.map(([u, s]) => M(u, s)), 0.9);
  paint(ctx, mem, fcol, { lw: 1.4, rim: near ? 1.3 : 0 });
  // secondary feather separations
  ctx.save(); ctx.clip(mem);
  const sl = new Path2D();
  for (let k = 0; k < 9; k++) {
    const s = 0.04 + k * 0.083;
    const A = M(-5, s), Bq = M(-32, s - 0.03);
    sl.moveTo(A[0], A[1]); sl.lineTo(Bq[0], Bq[1]);
  }
  strokeP(ctx, sl, rgba('#15131A', 0.32 + 0.1 * (1 - under)), 0.9);
  ctx.restore();
  // coverts band (charcoal leading edge) with scalloped feather tips
  const cvPts = [[13, -0.04], [15, 0.14], [16, 0.3], [15, 0.45], [10, 0.6], [5, 0.7]];
  const back = [];
  for (let k = 0; k <= 8; k++) {
    const s = 0.68 - k * (0.74 / 8);
    back.push([-6 + (k % 2 ? -3 : 0) + (s > 0.5 ? 4 : 0), s]);
  }
  const cov = bl([...cvPts, ...back, [-4, -0.06]].map(([u, s]) => M(u, s)), 0.9);
  const ctop = near ? GC.wing : GC.wingFar;
  paint(ctx, cov, ctop, { rim: near ? 1.8 : 0, lw: 1.2 });
  R.wingTip = M(-7, 1.1);
}

function geraldLegs(ctx, R, far) {
  const c = far ? GC.legFar : GC.leg;
  const pose = R.pose;
  const H = R.KP.H;
  const hip = R.B(H[0] + (far ? -4 : 0), H[1]);
  const ox = far ? -5 : 0, oy = far ? -1 : 0;
  if (pose === 'perch' || ((pose === 'land' || pose === 'takeoff') && R.legs < 0.05)) {
    limb(ctx, [[hip[0] + ox * 0.3, hip[1]], [ox + 0.6, -6 + oy], [ox + 1, -2 + oy]], 5.4, c.base, c.line, 1.3);
    perchFoot(ctx, ox, oy, c, far);
  } else if (pose === 'fly') {
    if (far) return;
    const k1 = R.B(H[0] - 9, H[1] + 1.5), k2 = R.B(H[0] - 16, H[1] - 1);
    limb(ctx, [hip, k1, k2], 4.4, c.base, c.line, 1.2);
    const ft = new Path2D();
    el(k2[0] - 2.5, k2[1] + 0.5, 4.5, 3.2, -0.2, ft);
    paint(ctx, ft, { base: c.base, line: c.line }, { lw: 1.1 });
    talon(ctx, k2[0] - 6, k2[1] + 1, 2.3, 0.8);
  } else {
    const L = R.legs;
    const fx = ox * 0.5, fy = oy;
    const mid = lerp2(hip, [fx, fy], 0.5);
    const knee = pose === 'land' ? [mid[0] - 7 * L, mid[1] + 1] : [mid[0] + 7 * L, mid[1]];
    limb(ctx, [hip, knee, [fx, fy - 3]], 5, c.base, c.line, 1.3);
    if (pose === 'land') openFoot(ctx, fx, fy, c, L);
    else perchFoot(ctx, fx, fy, c, far);
  }
}
function talon(ctx, x, y, a, s = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s);
  const p = new Path2D();
  p.moveTo(-1.7, -1.3); p.quadraticCurveTo(2.9, -1.7, 4.3, 3.6); p.quadraticCurveTo(2.2, 0.9, -1.5, 1.5); p.closePath();
  ctx.fillStyle = GC.talon; ctx.fill(p);
  ctx.restore();
}
function perchFoot(ctx, ox, oy, c, far) {
  // toes wrap down over the perch surface (tips below y=0 -> visible grip)
  const toes = [
    [[ox + 1, oy - 2.2], [ox + 8, oy - 1.8], [ox + 13.5, oy + 0.8]],
    [[ox + 1, oy - 1.6], [ox + 6.5, oy + 1], [ox + 10, oy + 3.4]],
    [[ox + 0.5, oy - 2], [ox - 5, oy - 0.8], [ox - 8.5, oy + 1.2]],
  ];
  const ang = [0.6, 0.9, 2.5];
  for (let i = 0; i < toes.length; i++) {
    const tp = toes[i];
    limb(ctx, tp, 3.8, c.base, c.line, 1.1);
    talon(ctx, tp[2][0] + (i === 2 ? -0.6 : 0.6), tp[2][1], ang[i], 0.95);
    if (!far) {
      const kn = new Path2D();
      for (const k of [0.45, 0.8]) {
        const A = k < 0.5 ? lerp2(tp[0], tp[1], k * 2) : lerp2(tp[1], tp[2], (k - 0.5) * 2);
        const d = k < 0.5 ? [tp[1][0] - tp[0][0], tp[1][1] - tp[0][1]] : [tp[2][0] - tp[1][0], tp[2][1] - tp[1][1]];
        const L = Math.hypot(d[0], d[1]) || 1, nx = -d[1] / L * 1.7, ny = d[0] / L * 1.7;
        kn.moveTo(A[0] + nx, A[1] + ny); kn.lineTo(A[0] - nx, A[1] - ny);
      }
      strokeP(ctx, kn, 'rgba(106,87,83,0.55)', 0.7);
    }
  }
}
function openFoot(ctx, ox, oy, c, L) {
  const toes = [
    [[ox, oy - 3], [ox + 7, oy - 4 - L * 3], [ox + 12, oy - 3 - L * 6]],
    [[ox, oy - 3], [ox + 7, oy - 1], [ox + 12, oy + 1 - L * 2]],
    [[ox, oy - 3], [ox - 5, oy - 1], [ox - 9, oy - 2 - L * 3]],
  ];
  const ang = [0.1 - L * 0.6, 0.6 - L * 0.4, 2.7 + L * 0.4];
  for (let i = 0; i < 3; i++) {
    limb(ctx, toes[i], 3.4, c.base, c.line, 1.1);
    talon(ctx, toes[i][2][0], toes[i][2][1], ang[i], 0.95);
  }
}

function geraldTail(ctx, R) {
  const list = R.fly
    ? [[-32, -55, -64, -57], [-33, -52, -64, -51], [-32, -49, -61, -45]]
    : [[-31, -18, -44, 7], [-28, -16, -38, 10], [-24, -15, -31, 10]];
  for (const [x0, y0, x1, y1] of list) {
    const p = strip(x0, y0, x1, y1, 4.6, 3.8);
    paint(ctx, p, GC.dark, { lg: [x0, y0, x1, y1], lw: 1.3 });
  }
}

function geraldBody(ctx, R, ruffle) {
  const src = R.fly ? G_BODY_FLY : G_BODY_PERCH;
  // with the wings spread (no folded-wing cloak) the perched body is slimmer
  const slim = !R.fly && R.spread ? 0.84 : 1;
  const pts = src.map((q) => [-8 + (q[0] + 8) * slim, q[1]]);
  if (ruffle > 0) {
    for (let i = 0; i < pts.length; i++) {
      const j = noise1(R.t * 22 + i * 3.1) * ruffle * 1.4;
      pts[i] = [pts[i][0] + (pts[i][0] + 6) * 0.05 * ruffle + j, pts[i][1] + (pts[i][1] + 46) * 0.04 * ruffle + j * 0.6];
    }
  }
  const body = bl(pts, 1);
  paint(ctx, body, GC.body, R.fly ? { lg: [0, -70, 0, -36], rim: 2.4, sh: 3, lw: 1.7 } : { lg: [-30, -88, 10, -6], rim: 2.6, sh: 3.4, lw: 1.7 });
  // waistcoat chest: soft lighter breast + feather scallops
  ctx.save(); ctx.clip(body);
  const cx = R.fly ? 18 : 24, cy = R.fly ? -44 : -40;
  const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, 24);
  g.addColorStop(0, GC.vest); g.addColorStop(1, 'rgba(120,104,128,0)');
  ctx.fillStyle = g; ctx.fillRect(cx - 30, cy - 30, 60, 60);
  const ch = new Path2D();
  if (R.fly) {
    for (let r = 0; r < 3; r++) scallopRow(linePts([4 - r * 9, -41 + r], [26 - r * 4, -50 + r * 2], 3), 3, 1.2, ch);
  } else {
    for (let r = 0; r < 5; r++) {
      const y = -64 + r * 11;
      scallopRow(linePts([13 + (r > 2 ? -2 : 0), y + 1], [29 - Math.abs(r - 2) * 1.6, y - 2], 3), 1.4, 3.6, ch);
    }
  }
  ctx.save(); ctx.translate(0, 1.1); strokeP(ctx, ch, rgba(GC.edge, 0.45), 1.2); ctx.restore();
  strokeP(ctx, ch, 'rgba(10,8,14,0.45)', 1);
  ctx.restore();
  if (!R.fly) {
    const th = scallop(-1, -12.5, 10.5, 6.5, 0.15, 9, 1.7, 4);
    paint(ctx, th, GC.body, { lg: [-1, -20, -1, -6], rim: 1.2, lw: 1.3 });
  }
  if (ruffle > 0.2) {
    const tf = new Path2D();
    const tufts = R.fly ? [[-20, -66, -1.7], [0, -67, -1.4], [-36, -59, -2.4]] : [[-32, -74, -2.3], [-40, -52, -2.9], [27, -40, -0.2], [-20, -84, -1.9], [-39, -30, -3.0]];
    for (const [x, y, a] of tufts) {
      const j = noise1(R.t * 18 + x) * 0.25;
      leaf(x, y, x + Math.cos(a + j) * 9 * ruffle, y + Math.sin(a + j) * 9 * ruffle, 1.6, tf);
    }
    ctx.fillStyle = GC.body.base; ctx.fill(tf);
    ctx.lineWidth = 1.1; ctx.strokeStyle = GC.body.line; ctx.stroke(tf);
  }
}

function geraldWingParams(R, o) {
  const { sn, cs, up } = R.flap;
  const pose = R.pose;
  const W = { sp: R.wing, phiA: 0, phiH: 0, betaA: 0.08, betaH: 0.2, hs: 1, chord: 0 };
  R.spreadFlap = true;
  if (pose === 'perch') {
    const w = R.wing;
    const flap = o.flapPhase == null ? 0 : 1;
    W.chord = -0.12;
    W.phiA = lerp(0.15, 0.95, w) + flap * 0.32 * cs;
    W.phiH = W.phiA - 0.3 + 0.2 * w + flap * 0.25 * sn;
    W.betaA = 0.45 * (1 - w); W.betaH = 0.95 * (1 - w) + 0.12; W.hs = lerp(0.55, 1, w);
    R.spreadFlap = !!flap;
  } else if (pose === 'fly' && R.glide) {
    W.phiA = -0.08 + 0.04 * Math.sin(R.t * 1.3); W.phiH = W.phiA + 0.16; W.betaA = 0.12; W.betaH = 0.42; W.chord = 0.02;
    R.spreadFlap = false;
  } else if (pose === 'fly') {
    W.phiA = 0.3 + 1.0 * cs; W.phiH = W.phiA + 0.28 * sn;
    W.betaA = 0.05 + 0.2 * up; W.betaH = 0.15 + 0.75 * up; W.hs = 1 - 0.35 * up; W.chord = -0.03 * cs;
  } else if (pose === 'land') {
    W.chord = -0.12 * R.legs;
    W.phiA = 0.85 + 0.55 * cs; W.phiH = W.phiA + 0.3 * sn;
    W.betaA = -0.2; W.betaH = -0.2 + 0.5 * up; W.hs = 1 - 0.2 * up;
  } else {
    W.chord = 0.25 * R.legs;
    W.phiA = 0.4 + 1.05 * cs; W.phiH = W.phiA + 0.5 * sn;
    W.betaA = 0.05 + 0.2 * up; W.betaH = 0.15 + 0.7 * up; W.hs = 1 - 0.35 * up;
  }
  return W;
}

function drawVulture(ctx, o = {}) {
  const R = geraldRig(o);
  const s = o.scale == null ? 1 : o.scale;
  const ruffle = clamp(o.ruffle != null ? o.ruffle : R.F.ruffle || 0);
  ctx.save();
  ctx.translate(o.x || 0, o.y || 0);
  ctx.scale(o.flip ? -s : s, s);
  if (o.rot) ctx.rotate(o.rot);
  LX = o.flip ? 1 : -1; LW = 1.4;
  const W = R.spread ? geraldWingParams(R, o) : null;
  const bodyFrame = () => { ctx.translate(R.bx, R.by); ctx.rotate(R.brot); ctx.translate(-R.pivot[0], -R.pivot[1]); };
  // ---------- far side
  if (W) geraldSpreadWing(ctx, R, false, W);
  ctx.save(); bodyFrame();
  if (!W) {
    for (const [x0, y0, x1, y1] of [[-33, -30, -41, 8], [-30, -26, -35, 10.5]]) {
      paint(ctx, leaf(x0, y0, x1, y1, 3.6, undefined, 0.4), GC.wingFar, { lw: 1.2 });
    }
  }
  geraldTail(ctx, R);
  ctx.restore();
  geraldLegs(ctx, R, true);
  // ---------- body
  ctx.save(); bodyFrame(); geraldBody(ctx, R, ruffle); ctx.restore();
  geraldLegs(ctx, R, false);
  if (!W) { ctx.save(); bodyFrame(); geraldFoldedWing(ctx); ctx.restore(); }
  else geraldSpreadWing(ctx, R, true, W);
  // ---------- neck, ruff, head
  const nb = R.neckBase;
  const hn = gHead(R, -6, 5);
  limb(ctx, [[nb[0] - 2, nb[1] + 2], [lerp(nb[0], hn[0], 0.5), lerp(nb[1], hn[1], 0.5) + 1], hn], 12, GC.head.base, GC.head.line, 1.3);
  ctx.save(); bodyFrame(); geraldRuff(ctx, R, ruffle); ctx.restore();
  geraldHead(ctx, R);
  ctx.restore();
}

// Anchors in world coords: beak tip, head (top of skull), eye, feet (origin), body centre.
function vultureAnchors(o = {}) {
  const R = geraldRig(o);
  const s = o.scale == null ? 1 : o.scale, fx = o.flip ? -1 : 1;
  const W = ([x, y]) => {
    const [rx, ry] = o.rot ? rot2(x, y, o.rot) : [x, y];
    return { x: (o.x || 0) + rx * s * fx, y: (o.y || 0) + ry * s };
  };
  return {
    beak: W(gHead(R, 31, 3)),
    head: W(gHead(R, 0, -19)),
    headCenter: W(gHead(R, 0, -2)),
    eye: W(gHead(R, 4.5, -5.5)),
    feet: W([0, 0]),
    body: W(R.B(R.fly ? -6 : G_C[0], R.fly ? -52 : G_C[1])),
  };
}

// ============================================================== DR. SHELLEY (tortoise)
const SC = {
  shell: { base: '#6E7D42', hi: '#8A9A55', lo: '#4F5B2F', line: '#39421F', rim: 'rgba(222,236,170,0.40)', sh: 'rgba(30,36,14,0.30)' },
  scute: { base: '#7A8A4A', hi: '#94A45E', lo: '#62703A', line: '#46512A' },
  groove: '#46512A',
  ring: 'rgba(60,70,32,0.55)',
  marg: { base: '#5E6B38', hi: '#71804A', lo: '#4A5530', line: '#39421F' },
  plas: { base: '#E0D29A', hi: '#F4EBC6', lo: '#BFAE76', line: '#857646', rim: 'rgba(255,255,240,0.7)', sh: 'rgba(120,100,50,0.25)' },
  skin: { base: '#9BA486', hi: '#BCC4A7', lo: '#78826A', line: '#4C5541', rim: 'rgba(240,248,220,0.5)', sh: 'rgba(50,60,40,0.26)' },
  skinFar: { base: '#7D8769', hi: '#8E9879', lo: '#646E54', line: '#434B39' },
  wrinkle: 'rgba(66,76,56,0.55)',
  beak: { base: '#8A8463', hi: '#ABA582', lo: '#6A6549', line: '#3E3B2B' },
  nail: '#E9E1C8',
  wire: '#C9A24A',
  pad: '#FBF6E6',
  padBack: '#9C7A54',
  pencil: '#F2C23A',
};
const SFACE = {
  neutral: { up: 0.44, lo: 0.12, mouth: 0, brow: 0 },
  chill: { up: 0.5, lo: 0.12, mouth: 0.3, brow: 0 },
  happy: { up: 0.42, lo: 0.3, mouth: 1, brow: -0.15 },
  smug: { up: 0.52, lo: 0.18, mouth: 0.55, brow: 0.2 },
  sad: { up: 0.54, lo: 0.1, mouth: -0.7, brow: -0.4, droop: 1 },
  worried: { up: 0.34, lo: 0.08, mouth: -0.5, brow: -0.4 },
  deadpan: { up: 0.56, lo: 0.14, mouth: -0.1, brow: 0.05 },
  sleepy: { up: 0.74, lo: 0.16, mouth: 0, brow: 0, droop: 0.6 },
  shock: { up: 0.1, lo: 0.02, mouth: -0.4, brow: -0.7, back: 1 },
  panic: { up: 0.06, lo: 0.0, mouth: -0.6, brow: -0.8, back: 1 },
};
// tapered tube along a centre line (straight end caps; ends are hidden by other parts)
function tube(pts, w0, w1, p = new Path2D()) {
  const n = pts.length, Lp = [], Rp = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d, w = lerp(w0, w1, i / (n - 1)) / 2;
    Lp.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
    Rp.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
  }
  cv(Lp, 1, p);
  cv(Rp.reverse(), 1, p, false);
  p.closePath();
  return p;
}
// point + normal along a polyline at fraction f
function along(pts, f) {
  const segs = [];
  let tot = 0;
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); segs.push(l); tot += l; }
  let d = clamp(f) * tot;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const k = clamp(d / (segs[i] || 1));
      const A = pts[i], B = pts[i + 1];
      const dx = (B[0] - A[0]) / (segs[i] || 1), dy = (B[1] - A[1]) / (segs[i] || 1);
      return { x: lerp(A[0], B[0], k), y: lerp(A[1], B[1], k), nx: -dy, ny: dx, tx: dx, ty: dy };
    }
    d -= segs[i];
  }
  return { x: pts[0][0], y: pts[0][1], nx: 0, ny: 1, tx: 1, ty: 0 };
}

function shelleyRig(o) {
  const t = o.t || 0;
  const mood = SFACE[o.mood] ? o.mood : 'neutral';
  const F = SFACE[mood];
  const talk = clamp(o.talk || 0);
  const breath = Math.sin(t * 0.9);
  const lean = (o.neck || 0) + (F.droop ? 0.12 * F.droop : 0) - (F.back ? 0.12 : 0);
  const R = { t, mood, F, talk, breath, lean, look: o.look || { x: 0.45, y: 0.15 } };
  const len = (F.back ? 0.86 : 1) * (o.neckLen == null ? 1 : o.neckLen);
  // neck centre line from inside the shell opening up and forward; slow sway
  const sway = 0.03 * Math.sin(t * 0.45) + 0.02 * noise1(t * 0.3 + 7);
  const base = [6, -116 + breath * 0.6];
  const raw = [[0, 0], [3, -22], [11, -40], [23, -51]];
  R.neck = raw.map(([x, y], i) => {
    const k = i / (raw.length - 1);
    const [rx, ry] = rot2(x * len, y * len, (lean * 0.9 + sway) * k);
    return [base[0] + rx, base[1] + ry];
  });
  const top = R.neck[R.neck.length - 1];
  R.hr = lean * 0.55 + sway * 0.6 - talk * 0.04 + (F.droop ? 0.07 : 0) - (F.back ? 0.08 : 0);
  R.hs = 1.42;
  const [ox, oy] = rot2(10, -6, R.hr);
  R.hx = top[0] + ox;
  R.hy = top[1] + oy + talk * 0.6;
  return R;
}
function sHead(R, x, y) {
  const [rx, ry] = rot2(x * R.hs, y * R.hs, R.hr);
  return [R.hx + rx, R.hy + ry];
}

function shelleyShell(ctx, R) {
  const cara = bl([[8, -122], [-6, -140], [-28, -147], [-51, -136], [-66, -112], [-72, -79], [-68, -45], [-56, -17], [-34, -3], [-8, -3], [7, -14], [12, -50], [13, -90], [13, -110]], 1);
  paint(ctx, cara, SC.shell, { lg: [-70, -150, 10, 0], lw: 0 });
  ctx.save();
  ctx.clip(cara);
  // marginal scutes: a band of small plates along the rim
  const rim = bl([[2, -120], [-8, -132], [-28, -138], [-47, -128], [-59, -108], [-64, -78], [-60, -47], [-50, -24], [-32, -12], [-10, -12], [1, -22], [4, -52], [6, -90], [6, -110]], 1);
  ctx.fillStyle = SC.marg.base;
  const mq = new Path2D(); mq.rect(-200, -300, 400, 400); mq.addPath(rim);
  ctx.fill(mq, 'evenodd');
  const md = new Path2D();
  for (let i = 0; i < 14; i++) {
    const a = -1.0 + i * 0.36;
    md.moveTo(-28 + Math.cos(a + 1.6) * 52, -72 + Math.sin(a + 1.6) * 64);
    md.lineTo(-28 + Math.cos(a + 1.6) * 80, -72 + Math.sin(a + 1.6) * 90);
  }
  strokeP(ctx, md, SC.groove, 1.3);
  // costal + vertebral scutes: rounded hexagons with growth rings
  const hexes = [
    [-24, -111, 20, 17, 0.1], [-30, -75, 21, 19, -0.05], [-27, -40, 19, 15, 0.08],
    [-58, -117, 14, 15, 0.5], [-63, -80, 13, 18, 0.0], [-56, -42, 12, 15, -0.4],
  ];
  for (const [hx, hy, rx, ry, rr] of hexes) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = rr + (i / 6) * TAU + Math.PI / 6;
      pts.push([hx + Math.cos(a) * rx, hy + Math.sin(a) * ry]);
    }
    const hp = bl(pts, 0.35);
    const g = ctx.createRadialGradient(hx - 5, hy - 7, 2, hx, hy, Math.max(rx, ry) * 1.2);
    g.addColorStop(0, SC.scute.hi); g.addColorStop(0.6, SC.scute.base); g.addColorStop(1, SC.scute.lo);
    ctx.fillStyle = g; ctx.fill(hp);
    ctx.lineWidth = 2.2; ctx.strokeStyle = SC.groove; ctx.lineJoin = 'round'; ctx.stroke(hp);
    for (const k of [0.68, 0.38]) {
      const rp = bl(pts.map(([x, y]) => [hx + (x - hx) * k, hy + (y - hy) * k]), 0.45);
      strokeP(ctx, rp, SC.ring, 1);
    }
  }
  // soft gloss on the dome (polished old shell)
  const gl = ctx.createRadialGradient(-38, -124, 2, -38, -124, 40);
  gl.addColorStop(0, 'rgba(255,255,230,0.22)'); gl.addColorStop(1, 'rgba(255,255,230,0)');
  ctx.fillStyle = gl; ctx.fillRect(-90, -170, 110, 100);
  ctx.restore();
  crescent(ctx, cara, -LX * 2.4, 2.6, SC.shell.rim);
  crescent(ctx, cara, LX * 3, -3, SC.shell.sh);
  ctx.lineWidth = 2.6; ctx.strokeStyle = SC.shell.line; ctx.lineJoin = 'round'; ctx.stroke(cara);
}

function shelleyPlastron(ctx, R) {
  const plas = bl([[-8, -5], [12, -9], [25, -30], [30, -62], [28, -92], [21, -108], [9, -112], [1, -96], [1, -60], [-1, -24]], 1);
  paint(ctx, plas, SC.plas, { lg: [0, -112, 28, -10], rim: 1.8, sh: 3, lw: 1.6 });
  ctx.save(); ctx.clip(plas);
  const seams = new Path2D();
  for (const y of [-96, -74, -52, -30]) { seams.moveTo(-5, y + 4); seams.quadraticCurveTo(14, y - 2, 34, y + 3); }
  strokeP(ctx, seams, 'rgba(133,118,70,0.75)', 1.3);
  const hi = new Path2D();
  for (const y of [-96, -74, -52, -30]) { hi.moveTo(-5, y + 5.6); hi.quadraticCurveTo(14, y - 0.4, 34, y + 4.6); }
  strokeP(ctx, hi, 'rgba(255,250,225,0.55)', 0.9);
  ctx.restore();
}

function shelleyLegs(ctx, R, far) {
  const c = far ? SC.skinFar : SC.skin;
  const o = far ? [-7, -4] : [0, 0];
  const p = tube([[o[0] - 2, o[1] - 14], [o[0] + 16, o[1] - 12.5], [o[0] + 30, o[1] - 11]], 22, 20);
  paint(ctx, p, c, { lg: [0, o[1] - 25, 0, o[1]], lw: 1.6, rim: far ? 0 : 1.4 });
  const fx = o[0] + 34, fy = o[1] - 12.5;
  const foot = el(fx, fy, 9, 12.5, 0.1);
  paint(ctx, foot, c, { rg: [fx - 3, fy - 5, 15], lw: 1.6, rim: far ? 0 : 1.2 });
  if (!far) {
    ctx.fillStyle = 'rgba(70,80,60,0.22)';
    for (const [x, y, r] of [[6, -18, 2.4], [12, -9, 2], [18, -16, 2.6], [24, -8, 2], [10, -14, 1.6], [23, -19, 1.8]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  }
  for (let i = 0; i < 3; i++) {
    const a = -0.8 + i * 0.52;
    const nx = fx + Math.cos(a) * 8.6, ny = fy + Math.sin(a) * 11.4;
    const n = el(nx, ny, 2.2, 3.1, a);
    ctx.fillStyle = far ? '#C9C1A8' : SC.nail; ctx.fill(n);
    ctx.lineWidth = 0.9; ctx.strokeStyle = 'rgba(90,84,60,0.8)'; ctx.stroke(n);
  }
}

function shelleyNeck(ctx, R) {
  const N = R.neck;
  const hn = sHead(R, -9, 5);
  const pts = [...N.slice(0, -1), hn];
  const p = tube(pts, 30, 23);
  paint(ctx, p, SC.skin, { lg: [N[0][0] - 14, 0, N[0][0] + 16, 0], rim: 1.8, sh: 2.6, lw: 1.6 });
  ctx.save(); ctx.clip(p);
  const w = new Path2D();
  for (let i = 0; i < 8; i++) {
    const a = along(pts, 0.06 + i * 0.115);
    const hw = lerp(13.5, 10, i / 7);
    const sag = 2.4 + (i % 2) * 1.4;
    w.moveTo(a.x + a.nx * hw, a.y + a.ny * hw);
    w.quadraticCurveTo(a.x + a.tx * sag, a.y + a.ty * sag, a.x - a.nx * hw * (0.45 + (i % 2) * 0.2), a.y - a.ny * hw * (0.45 + (i % 2) * 0.2));
  }
  strokeP(ctx, w, SC.wrinkle, 1.1);
  ctx.fillStyle = 'rgba(80,92,64,0.22)';
  for (let i = 0; i < 6; i++) {
    const a = along(pts, 0.12 + i * 0.15);
    ctx.beginPath(); ctx.ellipse(a.x + a.nx * 5, a.y + a.ny * 5, 2.4, 1.6, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // collar of loose skin where the neck leaves the shell
  const col = scallop(N[0][0] + 1, N[0][1] + 4, 16.5, 7.5, -0.2, 7, 1.3, 5);
  paint(ctx, col, SC.skin, { lg: [0, N[0][1] - 6, 0, N[0][1] + 12], lw: 1.4, rim: 1 });
}

function shelleyHead(ctx, R, o) {
  const { F, talk, t } = R;
  ctx.save();
  ctx.translate(R.hx, R.hy); ctx.rotate(R.hr); ctx.scale(R.hs, R.hs);
  // lower jaw (opens slowly)
  const jaw = talk * 0.28;
  if (talk > 0.02) {
    const m = new Path2D();
    m.moveTo(-3, 8); m.lineTo(26, 8.5);
    const [jx, jy] = rot2(28, 1, jaw);
    m.lineTo(-4 + jx, 8 + jy); m.closePath();
    ctx.fillStyle = '#4C2C2C'; ctx.fill(m);
    ctx.fillStyle = '#B86A6A'; ctx.beginPath(); ctx.ellipse(10, 10 + talk * 2.4, 7, 2.2, jaw * 0.5, 0, TAU); ctx.fill();
  }
  ctx.save();
  ctx.translate(-4, 8); ctx.rotate(jaw); ctx.translate(4, -8);
  const lj = bl([[-9, 7.5], [8, 8.8], [24, 8.6], [22, 13.2], [8, 16], [-6, 13.5]], 0.9);
  paint(ctx, lj, SC.skin, { lg: [0, 8, 0, 16], lw: 1.4 });
  const lb = new Path2D(); lb.moveTo(14, 8.9); lb.quadraticCurveTo(20, 8.9, 24, 8.6); lb.quadraticCurveTo(23, 12, 17, 12.4); lb.closePath();
  paint(ctx, lb, SC.beak, { lw: 1 });
  ctx.restore();
  // skull
  const sk = bl([[-16, 6], [-17, -7], [-9, -17], [4, -19.5], [16, -15.5], [24, -8], [27.5, 0], [25.5, 7], [12, 9.5], [-4, 12]], 1);
  paint(ctx, sk, SC.skin, { rg: [4, -11, 30], rim: 1.8, sh: 2.6, lw: 1.5, mid: 0.5 });
  // scale patches on the crown
  ctx.save(); ctx.clip(sk);
  ctx.fillStyle = 'rgba(80,92,64,0.26)';
  for (const [x, y, rx, ry] of [[-4, -13, 3.8, 2.6], [-10, -6, 2.8, 2.4], [3, -16, 2.6, 1.8], [-11, -13, 2.2, 1.8], [11, -15, 2.4, 1.6], [-14, 1, 2, 2.6]]) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0.2, 0, TAU); ctx.fill(); }
  ctx.restore();
  // horny upper beak at the snout tip
  const ub = new Path2D();
  ub.moveTo(18.5, 0.5); ub.quadraticCurveTo(23.5, -2.5, 26.8, -0.5); ub.quadraticCurveTo(29, 3.6, 26.4, 9.6);
  ub.quadraticCurveTo(22, 9.2, 17.5, 9.4); ub.quadraticCurveTo(16.8, 4.4, 18.5, 0.5); ub.closePath();
  paint(ctx, ub, SC.beak, { lg: [0, -2, 0, 9], rim: 0.9, lw: 1.1 });
  // mouth line: long, gentle
  const sm = F.mouth;
  const ml = new Path2D();
  ml.moveTo(17.5, 9.4); ml.bezierCurveTo(10, 9.8 + Math.min(0, sm) * -0.6, 1, 9.6 - sm * 0.8, -5, 7.4 - sm * 5.2);
  strokeP(ctx, ml, '#3F4834', 1.6);
  if (sm > 0.2) { const ck = new Path2D(); ck.moveTo(-3.2, 2.2 - sm * 3.6); ck.quadraticCurveTo(-7.4, 5 - sm * 3.6, -5, 9.4 - sm * 3.6); strokeP(ctx, ck, rgba('#3F4834', 0.6 * sm), 1.1); }
  ctx.fillStyle = '#3B4231';
  ctx.beginPath(); ctx.ellipse(25.2, -2.6, 1, 0.75, 0.3, 0, TAU); ctx.fill();
  // wrinkles
  const wr = new Path2D();
  cv([[-12.5, -7], [-11, -0.5], [-12.5, 6]], 1, wr);
  cv([[-7.5, 3], [-4.5, 6]], 1, wr);
  cv([[14.5, -11], [18, -8.5]], 1, wr);
  cv([[13, -6.5], [15.5, -4.5]], 1, wr);
  strokeP(ctx, wr, SC.wrinkle, 1);
  // eye: big, heavy upper lid + lower lid (very slow blinks)
  const ex = 4.5, ey = -7, erx = 6, ery = 6.4;
  const bk = blinkAmt(t, 6.5, 1.5, 0.61);
  const up = clamp(F.up + (1 - F.up) * bk * 1.15), lo = F.lo;
  // socket shadow
  ctx.fillStyle = 'rgba(70,82,56,0.28)';
  ctx.beginPath(); ctx.ellipse(ex, ey, erx + 2.6, ery + 2.4, 0, 0, TAU); ctx.fill();
  const eye = el(ex, ey, erx, ery);
  ctx.fillStyle = '#FBF5E4'; ctx.fill(eye);
  ctx.save(); ctx.clip(eye);
  const lk = R.look;
  const px = ex + 1 + clamp(lk.x || 0, -1, 1) * 2.4, py = ey + 1.6 + clamp(lk.y || 0, -1, 1) * 2.2;
  ctx.fillStyle = '#5A4522'; ctx.beginPath(); ctx.arc(px, py, 3.7, 0, TAU); ctx.fill();
  ctx.fillStyle = '#17120A'; ctx.beginPath(); ctx.arc(px, py, 2.2, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.beginPath(); ctx.arc(px - 1.2, py - 1.3, 1, 0, TAU); ctx.fill();
  const ly = ey - ery + up * ery * 2;
  const ul = new Path2D();
  ul.moveTo(ex - erx - 2, ey - ery - 3); ul.lineTo(ex + erx + 2, ey - ery - 3); ul.lineTo(ex + erx + 2, ly - 1.2); ul.quadraticCurveTo(ex, ly + 2.6, ex - erx - 2, ly - 0.2); ul.closePath();
  const lg = ctx.createLinearGradient(0, ey - ery, 0, ly + 2);
  lg.addColorStop(0, '#A7B091'); lg.addColorStop(1, '#8A9476');
  ctx.fillStyle = lg; ctx.fill(ul);
  const ll = ey + ery - lo * ery * 2;
  const lp = new Path2D();
  lp.moveTo(ex - erx - 2, ey + ery + 3); lp.lineTo(ex + erx + 2, ey + ery + 3); lp.lineTo(ex + erx + 2, ll + 0.6); lp.quadraticCurveTo(ex, ll - 1.8, ex - erx - 2, ll + 0.2); lp.closePath();
  ctx.fillStyle = '#939D7F'; ctx.fill(lp);
  ctx.restore();
  const le = new Path2D(); le.moveTo(ex - erx - 1, ly - 0.2); le.quadraticCurveTo(ex, ly + 2.6, ex + erx + 1, ly - 1.2);
  strokeP(ctx, le, '#363E2C', 1.8);
  const le2 = new Path2D(); le2.moveTo(ex - erx, ll + 0.2); le2.quadraticCurveTo(ex, ll - 1.8, ex + erx, ll + 0.6);
  strokeP(ctx, le2, 'rgba(58,66,48,0.6)', 1);
  ctx.lineWidth = 1.1; ctx.strokeStyle = '#4C5541'; ctx.stroke(eye);
  // brow fold + bags
  const fold = new Path2D();
  fold.moveTo(ex - erx - 1.5, ey - ery + 1 - F.brow * 0.8); fold.quadraticCurveTo(ex - 0.5, ey - ery - 3.2 + F.brow * 1.6, ex + erx + 2, ey - ery + 1.5 + F.brow * 4.2);
  fold.moveTo(ex - erx + 0.5, ey + ery + 1.8); fold.quadraticCurveTo(ex + 0.5, ey + ery + 4.6, ex + erx, ey + ery + 1.4);
  fold.moveTo(ex - erx + 2.5, ey + ery + 4.8); fold.quadraticCurveTo(ex + 0.5, ey + ery + 6.6, ex + erx - 1.5, ey + ery + 4.4);
  strokeP(ctx, fold, 'rgba(60,70,50,0.62)', 1.1);
  // half-moon reading glasses perched low on the snout (he peers over them)
  const gx = 19.5, gy = -1.6, gw = 6.4, gh = 5.2;
  const farL = new Path2D(); farL.moveTo(gx + 6.6, gy); farL.quadraticCurveTo(gx + 6.8, gy + gh * 1.1, gx + 9.4, gy + gh * 0.9);
  strokeP(ctx, farL, '#A88534', 1.1);
  const lens = new Path2D();
  lens.moveTo(gx - gw, gy); lens.lineTo(gx + gw, gy);
  lens.bezierCurveTo(gx + gw, gy + gh * 1.35, gx - gw, gy + gh * 1.35, gx - gw, gy);
  lens.closePath();
  ctx.fillStyle = 'rgba(214,236,246,0.38)'; ctx.fill(lens);
  ctx.save(); ctx.clip(lens);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(gx - 3.8, gy + 3.6); ctx.lineTo(gx - 0.6, gy - 0.2); ctx.stroke();
  ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(gx - 1.4, gy + 4.4); ctx.lineTo(gx + 1.8, gy + 0.6); ctx.stroke();
  ctx.restore();
  ctx.lineWidth = 1.5; ctx.strokeStyle = SC.wire; ctx.lineJoin = 'round'; ctx.stroke(lens);
  const arm = new Path2D(); arm.moveTo(gx - gw, gy + 0.2); arm.quadraticCurveTo(gx - 14, gy - 2.5, -6, -2.5);
  strokeP(ctx, arm, SC.wire, 1.1);
  const brg = new Path2D(); brg.moveTo(gx + gw, gy); brg.quadraticCurveTo(gx + 7.6, gy - 1.6, gx + 8.6, gy - 0.4);
  strokeP(ctx, brg, SC.wire, 1.1);
  ctx.restore();
}

// notepad in front of the plastron; returns pencil tip position
function shelleyPadGeom(R) {
  const b = R.breath * 0.4;
  return { cx: 47, cy: -84 + b, w: 32, h: 40, rot: -0.1 };
}
function padToLocal(P, u, v) {
  const [rx, ry] = rot2(u, v, P.rot);
  return [P.cx + rx, P.cy + ry];
}
function handwriting(i, u0, u1) {
  const pts = [];
  const n = 18;
  for (let k = 0; k <= n; k++) {
    const u = lerp(u0, u1, k / n);
    const loop = Math.sin(k * 2.3 + i * 1.7) * 1.3 + (hash1(i * 13 + k) - 0.5) * 1.4;
    pts.push([u + Math.sin(k * 2.3 + i) * 0.6, loop]);
  }
  return pts;
}
function shelleyPad(ctx, R, o) {
  const P = shelleyPadGeom(R);
  ctx.save();
  ctx.translate(P.cx, P.cy); ctx.rotate(P.rot);
  // the page faces the camera: un-mirror it when the character is flipped so text reads
  const mir = LX === 1 ? -1 : 1;
  ctx.scale(mir, 1);
  const hw = P.w / 2, hh = P.h / 2;
  // cardboard back peeking + paper
  ctx.fillStyle = SC.padBack; roundRectP(ctx, -hw + 1.8, -hh + 1.8, P.w, P.h, 2.5); ctx.fill();
  ctx.lineWidth = 1.2; ctx.strokeStyle = '#6E5236'; ctx.stroke();
  const pg = ctx.createLinearGradient(0, -hh, 0, hh);
  pg.addColorStop(0, '#FFFDF4'); pg.addColorStop(1, '#F1E9D2');
  ctx.fillStyle = pg; roundRectP(ctx, -hw, -hh, P.w, P.h, 2); ctx.fill();
  ctx.lineWidth = 1.2; ctx.strokeStyle = '#A99878'; ctx.stroke();
  // ruled lines + margin
  ctx.strokeStyle = 'rgba(120,170,210,0.5)'; ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let v = -hh + 11; v < hh - 2; v += 5.2) { ctx.moveTo(-hw + 1.5, v); ctx.lineTo(hw - 1.5, v); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(220,90,90,0.55)'; ctx.beginPath(); ctx.moveTo(-hw + 6, -hh + 5); ctx.lineTo(-hw + 6, hh - 1); ctx.stroke();
  // spiral binding
  ctx.strokeStyle = '#8D8A86'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 7; i++) {
    const x = -hw + 3.5 + i * ((P.w - 7) / 6);
    ctx.beginPath(); ctx.ellipse(x, -hh, 1.4, 2.6, 0, Math.PI * 0.9, Math.PI * 2.4); ctx.stroke();
  }
  // writing
  const write = o.write == null ? null : clamp(o.write);
  let tip = [-hw + 8, -hh + 8.5]; // pencil lifted at the start of the first line
  const ink = '#3B4A6B';
  if (o.note) {
    const txt = String(o.note);
    const pw = write == null ? 1 : write;
    const k1 = clamp(pw / 0.72), k2 = clamp((pw - 0.72) / 0.28);
    ctx.font = 'italic 700 10px Nunito';
    const fs = Math.min(8.5, 10 * (P.w - 11) / Math.max(1, ctx.measureText(txt).width));
    ctx.font = `italic 700 ${fs.toFixed(2)}px Nunito`;
    ctx.textBaseline = 'alphabetic';
    const tw = ctx.measureText(txt).width;
    const tx = -tw / 2 + 2, ty = -1.5;
    ctx.save();
    ctx.beginPath(); ctx.rect(-hw, -hh, (tx + hw) + tw * k1, P.h); ctx.clip();
    ctx.fillStyle = ink; ctx.fillText(txt, tx, ty);
    ctx.restore();
    tip = [tx + tw * k1, ty - 2.5 + Math.sin(pw * 90) * 1.6];
    for (let j = 0; j < 2; j++) {
      const kk = clamp(k2 * 2 - j);
      if (kk <= 0) continue;
      const y = ty + 3 + j * 2.6;
      ctx.strokeStyle = ink; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx - 1, y); ctx.lineTo(tx - 1 + (tw + 2) * kk, y + (j ? -0.4 : 0.5)); ctx.stroke();
      tip = [tx - 1 + (tw + 2) * kk, y];
    }
  } else {
    const lines = 4, wv = write == null ? 0.55 : write;
    const per = 1 / lines;
    for (let i = 0; i < lines; i++) {
      const k = clamp((wv - i * per) / per);
      if (k <= 0) break;
      const v = -hh + 10.2 + i * 5.2 * 1.5;
      const u0 = -hw + 8, u1 = hw - 4 - (i === lines - 1 ? 9 : hash1(i) * 5);
      const pts = handwriting(i, u0, u1).map(([u, dv]) => [u, v + dv * 0.8]);
      const nn = Math.max(2, Math.ceil(pts.length * k));
      const part = pts.slice(0, nn);
      const fr = pts.length * k - (nn - 1);
      if (nn < pts.length) part[nn - 1] = lerp2(pts[nn - 2], pts[nn - 1], clamp(fr));
      const hp = cv(part, 1);
      strokeP(ctx, hp, ink, 0.85);
      tip = part[part.length - 1];
      if (write != null && k < 1) tip = [tip[0], tip[1] + Math.sin(wv * 160) * 1.2];
    }
  }
  ctx.restore();
  R.pencilTip = padToLocal(P, tip[0] * mir, tip[1]);
  R.mir = mir;
  R.pad = P;
}
function roundRectP(ctx, x, y, w, h, r) { U.roundRect(ctx, x, y, w, h, r); }

function shelleyArm(ctx, R, near, o) {
  const c = near ? SC.skin : SC.skinFar;
  const P = R.pad;
  let sh, elb, hand;
  if (near) {
    const tip = R.pencilTip;
    const writing = o.write != null && o.write > 0 && o.write < 1;
    const wig = writing ? Math.sin(o.write * 160) * 0.8 : 0;
    // hand below-right of the pencil tip so the writing stays visible
    // (in world space always to the lower right of the tip, so the written text stays visible)
    hand = [tip[0] + (8 + wig) * (R.mir || 1), tip[1] + 8.5];
    sh = [14, -100];
    elb = [lerp(sh[0], hand[0], 0.35) + 1, Math.max(sh[1], hand[1]) + 12];
  } else {
    hand = padToLocal(P, -P.w / 2 + 2, 6);
    sh = [8, -103];
    elb = [lerp(sh[0], hand[0], 0.45) - 2, Math.max(sh[1], hand[1]) + 13];
  }
  const cl = [sh, lerp2(sh, elb, 0.55), elb, lerp2(elb, hand, 0.5), hand];
  const p = tube(cl, 19, 12);
  paint(ctx, p, c, { lg: [0, sh[1] - 10, 0, elb[1] + 9], lw: 1.5, rim: near ? 1.3 : 0, sh: near ? 2 : 0 });
  // rounded shoulder emerging from the shell opening
  const shp = el(sh[0], sh[1] + 2, 10.5, 9.5, 0.4);
  paint(ctx, shp, c, { rg: [sh[0] - 3, sh[1] - 3, 13], lw: 1.4, rim: near ? 1.3 : 0 });
  if (near) {
    ctx.save(); ctx.clip(p);
    ctx.fillStyle = 'rgba(70,80,60,0.24)';
    for (let i = 0; i < 8; i++) {
      const a = along(cl, 0.12 + i * 0.1);
      const d = ((i % 3) - 1) * 3.4;
      ctx.beginPath(); ctx.ellipse(a.x + a.nx * d, a.y + a.ny * d, 2.2 + (i % 2) * 0.5, 1.6, Math.atan2(a.ty, a.tx), 0, TAU); ctx.fill();
    }
    const ef = new Path2D(); ef.moveTo(elb[0] - 6, elb[1] - 5); ef.quadraticCurveTo(elb[0] - 1, elb[1] + 1, elb[0] + 5, elb[1] - 3);
    ef.moveTo(elb[0] - 4, elb[1] - 9); ef.quadraticCurveTo(elb[0], elb[1] - 5, elb[0] + 3, elb[1] - 7);
    strokeP(ctx, ef, SC.wrinkle, 1);
    ctx.restore();
  }
  R[near ? 'nearHand' : 'farHand'] = hand;
  return hand;
}
function shelleyHand(ctx, R, near, hand) {
  const c = near ? SC.skin : SC.skinFar;
  const [hx, hy] = hand;
  const hp = el(hx, hy, near ? 7 : 5.5, near ? 6 : 6.5, near ? 0.3 : 0);
  paint(ctx, hp, c, { rg: [hx - 2, hy - 2, 9], lw: 1.4 });
  const claws = near ? [[-4, 4.5, 1.9], [-0.5, 5.6, 1.6], [3, 5.2, 1.3]] : [[2.6, -3, -0.6], [3.4, 1, 0], [2.6, 4.5, 0.6]];
  for (const [dx, dy, a] of claws) {
    const n = el(hx + dx, hy + dy, 1.7, 1.2, a);
    ctx.fillStyle = SC.nail; ctx.fill(n); ctx.lineWidth = 0.7; ctx.strokeStyle = 'rgba(90,84,60,0.8)'; ctx.stroke(n);
  }
}
function shelleyPencil(ctx, R) {
  const [tx, ty] = R.pencilTip;
  const h = R.nearHand;
  const ang = Math.atan2(ty - h[1], tx - h[0]);
  ctx.save();
  ctx.translate(tx, ty); ctx.rotate(ang + Math.PI);
  // tip at origin, body along +x
  ctx.fillStyle = '#E8C9A0';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(5, -1.7); ctx.lineTo(5, 1.7); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3A3A3A';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1.8, -0.62); ctx.lineTo(1.8, 0.62); ctx.closePath(); ctx.fill();
  const g = ctx.createLinearGradient(0, -1.7, 0, 1.7);
  g.addColorStop(0, '#FFE07A'); g.addColorStop(0.5, SC.pencil); g.addColorStop(1, '#C7951F');
  ctx.fillStyle = g; ctx.fillRect(5, -1.7, 15, 3.4);
  ctx.fillStyle = '#B8B2A6'; ctx.fillRect(20, -1.8, 2.4, 3.6);
  ctx.fillStyle = '#F08A8A'; U.roundRect(ctx, 22.4, -1.7, 3, 3.4, 1.2); ctx.fill();
  ctx.lineWidth = 0.6; ctx.strokeStyle = '#7A5A1A'; ctx.strokeRect(5, -1.7, 15, 3.4);
  ctx.restore();
}

function drawTortoise(ctx, o = {}) {
  const R = shelleyRig(o);
  const s = o.scale == null ? 1 : o.scale;
  ctx.save();
  ctx.translate(o.x || 0, o.y || 0);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(o.flip ? -s : s, s);
  LX = o.flip ? 1 : -1; LW = 1.35;
  const showPad = o.notepad !== false;
  shelleyLegs(ctx, R, true);
  shelleyShell(ctx, R);
  shelleyNeck(ctx, R);
  shelleyPlastron(ctx, R);
  shelleyHead(ctx, R, o);
  shelleyLegs(ctx, R, false);
  if (showPad) {
    // geometry first (pencil tip drives the writing hand)
    R.pad = shelleyPadGeom(R);
    const farHand = shelleyArm(ctx, R, false, o);
    shelleyPad(ctx, R, o);
    shelleyHand(ctx, R, false, farHand);
    const nearHand = shelleyArm(ctx, R, true, o);
    shelleyHand(ctx, R, true, nearHand);
    shelleyPencil(ctx, R);
    // thumb wraps over the pencil
    const th = el(nearHand[0] - 2.6, nearHand[1] - 3.2, 3.2, 2.4, -0.7);
    paint(ctx, th, SC.skin, { lw: 1.1 });
  } else {
    // hands clasped on the belly, therapist-style
    R.pencilTip = [34, -64]; R.pad = shelleyPadGeom(R);
    for (const near of [false, true]) {
      const c = near ? SC.skin : SC.skinFar;
      const sh = near ? [14, -100] : [8, -103];
      const elb = near ? [17, -76] : [12, -79];
      const hand = near ? [35, -64] : [39, -69];
      paint(ctx, tube([sh, lerp2(sh, elb, 0.55), elb, lerp2(elb, hand, 0.5), hand], 19, 12), c, { lw: 1.5, rim: near ? 1.3 : 0 });
      paint(ctx, el(sh[0], sh[1] + 2, 10.5, 9.5, 0.4), c, { rg: [sh[0] - 3, sh[1] - 3, 13], lw: 1.4, rim: near ? 1.3 : 0 });
      const hp = el(hand[0], hand[1], 7, 6, 0.4);
      paint(ctx, hp, c, { rg: [hand[0] - 2, hand[1] - 2, 9], lw: 1.4 });
      for (const [dx, dy] of [[4.5, -2.5], [5.6, 1], [4.6, 4.2]]) {
        const n = el(hand[0] + dx, hand[1] + dy, 1.7, 1.2, 0.3);
        ctx.fillStyle = SC.nail; ctx.fill(n); ctx.lineWidth = 0.7; ctx.strokeStyle = 'rgba(90,84,60,0.8)'; ctx.stroke(n);
      }
    }
  }
  ctx.restore();
}
function tortoiseAnchors(o = {}) {
  const R = shelleyRig(o);
  const s = o.scale == null ? 1 : o.scale, fx = o.flip ? -1 : 1;
  const W = ([x, y]) => ({ x: (o.x || 0) + x * s * fx, y: (o.y || 0) + y * s });
  const P = shelleyPadGeom(R);
  return {
    notepad: W([P.cx, P.cy]),
    head: W(sHead(R, 4, -20)),
    headCenter: W(sHead(R, 2, -4)),
    beak: W(sHead(R, 28, 4)),
    eye: W(sHead(R, 4.5, -7)),
    seat: W([0, 0]),
  };
}

// ============================================================== FISH
const FISH_PAL = {
  orange: { body: '#FF9A1F', hi: '#FFC45E', lo: '#E06A16', belly: '#FFE3AE', fin: '#FF6A2B', finLo: '#E04E1C', line: '#A84A10', blush: '#FF6F6F' },
  teal: { body: '#2EC4B6', hi: '#86EADC', lo: '#1A9690', belly: '#D2FAF2', fin: '#1E9AA3', finLo: '#147680', line: '#0E5A5C', blush: '#FF9AA8' },
};
function fishPal(c) {
  if (FISH_PAL[c]) return FISH_PAL[c];
  if (typeof c === 'string' && c[0] === '#') {
    return { body: c, hi: shade(c, 0.3), lo: shade(c, -0.18), belly: shade(c, 0.7), fin: shade(c, -0.08), finLo: shade(c, -0.25), line: shade(c, -0.45), blush: '#FF8A8A' };
  }
  return FISH_PAL.orange;
}
const FFACE = {
  neutral: { lid: 0, brow: 0, mouth: 0.3 },
  happy: { lid: 0, brow: -0.2, mouth: 1, happy: true },
  worried: { lid: 0, brow: 0.5, mouth: -0.6, pupil: 0.75 },
  sad: { lid: 0.3, brow: 0.6, mouth: -0.7 },
  solemn: { lid: 0.48, brow: -0.1, mouth: -0.15 },
  shock: { lid: 0, brow: 0.8, mouth: -1, pupil: 0.6, o: true },
};
Object.assign(FFACE, { panic: FFACE.shock, chill: FFACE.happy, smug: { ...FFACE.solemn, mouth: 0.5 }, deadpan: FFACE.solemn, sleepy: { ...FFACE.solemn, lid: 0.7 } });
// fish-local → local point (shared by drawFish/fishAnchors)
function fishRig(o) {
  const t = o.t || 0;
  const hopMode = o.hop != null && !o.swim;
  const R = { t, hopMode, F: FFACE[o.mood] || FFACE.neutral, nod: clamp(o.nod || 0), wave: clamp(o.wave || 0), look: o.look || (hopMode ? { x: 0.6, y: 0.55 } : { x: 0.3, y: 0 }) };
  if (hopMode) {
    const ph = o.hop - Math.floor(o.hop);
    const air = Math.sin(Math.PI * ph);
    const contact = 1 - smoothstep(0, 0.16, Math.min(ph, 1 - ph));
    R.ph = ph; R.air = air; R.contact = contact;
    R.ang = -Math.PI / 2 + 0.5 + (ph < 0.5 ? -0.14 : 0.1) * air + R.nod * 0.5;
    R.sx = 1 + 0.12 * air - 0.12 * contact; // stretch along the body in the air, squash on contact
    R.sy = 1 - 0.06 * air + 0.12 * contact;
    // the tail fin is the foot: it stays level and its fork tips touch the ground at the origin
    R.tailRot = -(R.ang + Math.PI / 2);
    R.gx = 0; R.gy = -air * 22 - 12.6 * (1 - 0.12 * contact);
    R.pivot = [14, 0];
  } else {
    const sw = o.swim === false ? 0 : 1;
    R.gx = 0; R.gy = Math.sin(t * 2.1) * 1.2 * sw;
    R.ang = Math.sin(t * 1.3) * 0.04 * sw + R.nod * 0.4;
    R.sx = 1; R.sy = 1; R.pivot = [0, 0];
    R.swim = sw;
  }
  R.P = (x, y) => {
    const [rx, ry] = rot2((x + R.pivot[0]) * R.sx, y * R.sy, R.ang);
    return [R.gx + rx, R.gy + ry];
  };
  return R;
}
function drawTinySuitcase(ctx, x, y, s = 1, rot = 0) {
  const prevLW = LW;
  LW = 1.2;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  // handle (origin = top of handle)
  const hd = new Path2D(); hd.moveTo(-3.4, 3.2); hd.lineTo(-3.4, 0.8); hd.quadraticCurveTo(0, -1.4, 3.4, 0.8); hd.lineTo(3.4, 3.2);
  strokeP(ctx, hd, '#3E2414', 2.6); strokeP(ctx, hd, '#6E3F22', 1.3);
  const body = rrP(-9, 3, 18, 13, 2.4);
  paint(ctx, body, { base: '#A8673C', hi: '#C98A5A', lo: '#7E4A28', line: '#4A2A16' }, { lg: [0, 3, 0, 16], lw: 1.2, rim: 0.9 });
  ctx.save(); ctx.clip(body);
  ctx.fillStyle = '#6E3F22'; ctx.fillRect(-5.6, 3, 2.2, 13); ctx.fillRect(3.4, 3, 2.2, 13);
  // travel stickers
  ctx.fillStyle = '#FFD84A'; ctx.beginPath(); ctx.arc(-1.2, 9.6, 3.1, 0, TAU); ctx.fill();
  ctx.fillStyle = '#E8533F'; ctx.beginPath(); ctx.arc(-1.2, 10.4, 1.4, Math.PI, TAU); ctx.fill();
  ctx.strokeStyle = '#2F8F5B'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-1.2, 11.6); ctx.lineTo(-1.2, 8.2); ctx.moveTo(-2.4, 8.4); ctx.quadraticCurveTo(-1.2, 7.4, 0, 8.4); ctx.stroke();
  ctx.save(); ctx.translate(5.4, 7.2); ctx.rotate(0.25);
  ctx.fillStyle = '#4FB3E8'; ctx.fillRect(-2.6, -1.8, 5.8, 3.8);
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(-2, 0.6); ctx.quadraticCurveTo(-0.8, -0.6, 0.4, 0.6); ctx.quadraticCurveTo(1.6, 1.6, 2.8, 0.4); ctx.stroke();
  ctx.restore();
  ctx.restore();
  // brass corners + latch
  ctx.fillStyle = '#E8BE52';
  for (const [cx, cy] of [[-8, 4], [8, 4], [-8, 15], [8, 15]]) { ctx.beginPath(); ctx.arc(cx, cy, 1.05, 0, TAU); ctx.fill(); }
  ctx.fillRect(-1.2, 2.6, 2.4, 1.6);
  ctx.restore();
  LW = prevLW;
}
function drawFish(ctx, o = {}) {
  const R = fishRig(o);
  const C = fishPal(o.color || 'orange');
  const s = o.scale == null ? 1 : o.scale;
  const t = R.t;
  ctx.save();
  ctx.translate(o.x || 0, o.y || 0);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(o.flip ? -s : s, s);
  LX = o.flip ? 1 : -1; LW = 1.3;
  // ground shadow while hopping
  if (R.hopMode) {
    ctx.fillStyle = `rgba(0,0,0,${0.18 * (1 - R.air * 0.5)})`;
    ctx.beginPath(); ctx.ellipse(1, 1, 14 * (1 - R.air * 0.3), 2.6, 0, 0, TAU); ctx.fill();
  }
  ctx.save();
  ctx.translate(R.gx, R.gy); ctx.rotate(R.ang); ctx.scale(R.sx, R.sy); ctx.translate(R.pivot[0], R.pivot[1]);
  // tail fin
  const tailRot = R.hopMode ? R.tailRot : Math.sin(t * 7.5) * 0.28 * (R.swim || 0.3);
  ctx.save();
  ctx.translate(-14, 0); ctx.rotate(tailRot);
  const spread = R.hopMode ? 1 + 0.25 * R.contact : 1;
  const tail = new Path2D();
  tail.moveTo(2, -4.5);
  tail.bezierCurveTo(-4, -6, -9, -11 * spread, -13.5, -12.5 * spread);
  tail.bezierCurveTo(-11, -6, -10, -2, -9.5, 0);
  tail.bezierCurveTo(-10, 2, -11, 6, -13.5, 12.5 * spread);
  tail.bezierCurveTo(-9, 11 * spread, -4, 6, 2, 4.5);
  tail.closePath();
  paint(ctx, tail, { base: C.fin, hi: shade(C.fin, 0.25), lo: C.finLo, line: C.line }, { lg: [2, 0, -13, 0], lw: 1.3 });
  const rays = new Path2D();
  for (const k of [-0.75, -0.4, 0.4, 0.75]) { rays.moveTo(0, k * 3); rays.lineTo(-11, k * 13 * spread); }
  strokeP(ctx, rays, rgba(C.line, 0.35), 0.8);
  ctx.restore();
  // far pectoral (peeks behind)
  // dorsal fin
  const dors = new Path2D();
  dors.moveTo(-9, -10); dors.quadraticCurveTo(-6, -20, 3, -19.5); dors.quadraticCurveTo(1, -15, 6, -12.5); dors.closePath();
  paint(ctx, dors, { base: C.fin, hi: shade(C.fin, 0.2), lo: C.finLo, line: C.line }, { lg: [0, -20, 0, -10], lw: 1.2 });
  // anal/pelvic fin
  const pel = new Path2D(); pel.moveTo(-8, 9.5); pel.quadraticCurveTo(-8, 16, -2, 16.5); pel.quadraticCurveTo(-2, 13, 1, 11.5); pel.closePath();
  paint(ctx, pel, { base: C.fin, hi: C.fin, lo: C.finLo, line: C.line }, { lw: 1.1 });
  // body
  const body = bl([[18.5, 1], [15, -8.5], [5, -13.5], [-7, -12], [-15, -4.5], [-16, 2], [-10, 9.5], [2, 12.8], [13.5, 9]], 1);
  const g = ctx.createLinearGradient(0, -14, 0, 13);
  g.addColorStop(0, C.hi); g.addColorStop(0.42, C.body); g.addColorStop(0.7, C.body); g.addColorStop(1, C.belly);
  ctx.fillStyle = g; ctx.fill(body);
  ctx.save(); ctx.clip(body);
  // belly patch + scales + gill
  ctx.fillStyle = rgba(C.belly, 0.85);
  ctx.beginPath(); ctx.ellipse(4, 11, 15, 6.5, -0.05, 0, TAU); ctx.fill();
  const sc = new Path2D();
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const x = -10 + c * 5.2 + (r % 2) * 2.6, y = -6 + r * 5;
    sc.moveTo(x, y - 2.4); sc.quadraticCurveTo(x + 2.8, y, x, y + 2.4);
  }
  strokeP(ctx, sc, rgba(C.lo, 0.55), 0.9);
  const gl = new Path2D(); gl.moveTo(3.5, -8); gl.quadraticCurveTo(-0.5, 0, 3.5, 8.5);
  strokeP(ctx, gl, rgba(C.lo, 0.7), 1.2);
  ctx.restore();
  ctx.save(); ctx.clip(body);
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.beginPath(); ctx.ellipse(-2, -9.2, 6.5, 1.6, -0.12, 0, TAU); ctx.fill();
  ctx.restore();
  crescent(ctx, body, -LX * 0.6, 1.4, 'rgba(255,255,255,0.35)');
  crescent(ctx, body, LX * 0.8, -1.8, rgba(C.lo, 0.35));
  ctx.lineWidth = 1.9; ctx.strokeStyle = C.line; ctx.lineJoin = 'round'; ctx.stroke(body);
  // face
  const F = R.F;
  const ex = 9, ey = -3.5;
  ctx.fillStyle = rgba(C.blush, 0.45);
  ctx.beginPath(); ctx.ellipse(10.5, 4.6, 3.4, 2, 0, 0, TAU); ctx.fill();
  const bk = blinkAmt(t, 3.3, 0.16, hash1((o.seed || 0) + 0.3));
  if (F.happy) {
    const hp = new Path2D(); hp.moveTo(ex - 4.2, ey + 1.2); hp.quadraticCurveTo(ex, ey - 4.6, ex + 4.2, ey + 1.2);
    strokeP(ctx, hp, '#2A1A14', 1.6);
  } else {
    const eye = el(ex, ey, 5.4, 5.8);
    ctx.fillStyle = '#FFFFFF'; ctx.fill(eye);
    ctx.save(); ctx.clip(eye);
    const lk = R.look;
    const pr = 3.4 * (F.pupil || 1);
    const px = ex + 0.6 + clamp(lk.x || 0, -1, 1) * 1.6, py = ey + 0.4 + clamp(lk.y || 0, -1, 1) * 1.6;
    ctx.fillStyle = '#1E1A22'; ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(px - pr * 0.35, py - pr * 0.4, pr * 0.36, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(px + pr * 0.35, py + pr * 0.4, pr * 0.16, 0, TAU); ctx.fill();
    const lid = clamp(F.lid + (1 - F.lid) * bk);
    if (lid > 0.01) {
      const ly = ey - 5.8 + lid * 11.6;
      ctx.fillStyle = C.body; ctx.fillRect(ex - 7, ey - 8, 14, ly - (ey - 8));
      ctx.lineWidth = 1.3; ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(ex - 6, ly); ctx.lineTo(ex + 6, ly); ctx.stroke();
    }
    ctx.restore();
    ctx.lineWidth = 1.2; ctx.strokeStyle = C.line; ctx.stroke(eye);
  }
  if (F.brow) {
    const b = new Path2D();
    b.moveTo(ex - 4.5, ey - 7.2 + F.brow * 1.6); b.quadraticCurveTo(ex, ey - 9.2, ex + 4, ey - 7.6 - F.brow * 1.8);
    strokeP(ctx, b, C.line, 1.3);
  }
  // mouth (little pout at the nose)
  const mx = 17.2, my = 3.4;
  if (F.o) {
    ctx.fillStyle = '#7A2A2A'; ctx.beginPath(); ctx.ellipse(mx - 0.6, my, 1.8, 2.3, 0, 0, TAU); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = C.line; ctx.stroke();
  } else {
    const m = new Path2D();
    m.moveTo(mx + 1, my - 1); m.quadraticCurveTo(mx - 1.5, my + 1.6 * F.mouth, mx - 3.8, my - 0.4 - F.mouth * 1.4);
    strokeP(ctx, m, C.line, 1.2);
    ctx.fillStyle = rgba(C.lo, 0.9); ctx.beginPath(); ctx.ellipse(mx + 0.6, my - 0.4, 1.3, 1.6, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // ---- pectoral fin (near) + suitcase
  const w = R.wave;
  // waving: the fin moves up onto the back and sticks out above it like a little hand
  const finBase = R.P(lerp(0, -3, w), lerp(4, -6, w));
  let finAng = R.ang + 2.6 + 0.22 * Math.sin(t * 9 + 1);
  let finS = 1;
  if (w > 0) { finAng = R.ang + lerp(2.6, -1.45 + Math.sin(t * 11) * 0.45, w); finS = 1 + 0.35 * w; }
  if (o.suitcase && w === 0) {
    // fin reaches down to the handle; the case swings with the hop
    const swing = R.hopMode ? -0.35 * Math.cos(TAU * R.ph) : Math.sin(t * 2.1 + 1) * 0.08;
    const hx = finBase[0] + 2;
    let hy = finBase[1] + 10.5;
    if (R.hopMode) hy = Math.min(hy, -15.4); // the case rests on the ground, never sinks into it
    drawTinySuitcase(ctx, hx, hy - 0.6, 0.95, swing);
    finAng = Math.atan2(hy - finBase[1], hx - finBase[0]);
  }
  ctx.save();
  ctx.translate(finBase[0], finBase[1]); ctx.rotate(finAng); ctx.scale(finS, finS);
  const pf = new Path2D();
  pf.moveTo(0, -2.4); pf.quadraticCurveTo(7, -5.2, 11.5, -2.2); pf.quadraticCurveTo(12.4, 0.6, 10.6, 2.6); pf.quadraticCurveTo(6, 4.2, 0, 2.4); pf.closePath();
  paint(ctx, pf, { base: C.fin, hi: shade(C.fin, 0.25), lo: C.finLo, line: C.line }, { lg: [0, 0, 12, 0], lw: 1.1 });
  const fr = new Path2D(); fr.moveTo(1.5, -0.4); fr.lineTo(10, -2); fr.moveTo(1.5, 0.8); fr.lineTo(10.4, 1.4);
  strokeP(ctx, fr, rgba(C.line, 0.35), 0.7);
  ctx.restore();
  ctx.restore();
}
// horizontal travel for a hopping fish: the foot stays planted on the ground between hops.
// x = x0 + fishHopX(hop, stride) * (flip ? -1 : 1)
function fishHopX(hop, stride = 30) {
  const n = Math.floor(hop), f = hop - n;
  return stride * (n + smoothstep(0.08, 0.92, f));
}
function fishAnchors(o = {}) {
  const R = fishRig(o);
  const s = o.scale == null ? 1 : o.scale, fx = o.flip ? -1 : 1;
  const W = ([x, y]) => ({ x: (o.x || 0) + x * s * fx, y: (o.y || 0) + y * s });
  return { center: W(R.P(0, 0)), mouth: W(R.P(18, 3)), eye: W(R.P(9, -3.5)), top: W(R.P(0, -19)) };
}

// ============================================================== BIRD (small tropical bird, kiskadee-ish)
const BC = {
  yellow: { base: '#FFD23A', hi: '#FFEB8E', lo: '#EDA712', line: '#4A3418' },
  black: '#26222B',
  white: '#FFFDF6',
  wing: { base: '#8C6440', hi: '#AE8258', lo: '#6A4A2E', line: '#4A3418' },
  edge: '#D29A5A',
  beak: '#2A2426',
  leg: '#57494A',
};
function birdRig(o) {
  const t = o.t || 0;
  const fly = o.pose === 'fly';
  const seed = o.seed || 0;
  // twitchy idle: the body snaps between a few small tilts
  const k = Math.floor(t * 1.4 + seed * 3.1);
  const tw = (hash1(k + seed * 17) - 0.5) * 0.3;
  const chirp = typeof o.chirp === 'number' ? clamp(o.chirp) : (o.chirp ? clamp(0.5 + 0.5 * Math.sin(t * 22)) : 0);
  const fp = o.flapPhase != null ? o.flapPhase : t * 7;
  const flap = Math.cos(TAU * (fp - Math.floor(fp)));
  const R = { t, fly, chirp, flap, look: o.look || { x: 0.5, y: 0 }, seed };
  R.rot = fly ? 0.32 : tw - chirp * 0.22;
  R.lift = fly ? 6 - flap * 1.5 : 0;
  return R;
}
function drawBird(ctx, o = {}) {
  const R = birdRig(o);
  const s = o.scale == null ? 1 : o.scale;
  ctx.save();
  ctx.translate(o.x || 0, o.y || 0);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(o.flip ? -s : s, s);
  LX = o.flip ? 1 : -1; LW = 1.25;
  const line = BC.yellow.line;
  // legs (perch): toes wrap the perch at the origin
  if (!R.fly) {
    const lg = new Path2D();
    lg.moveTo(-1.5, -4); lg.lineTo(-1, -0.8); lg.moveTo(2, -4); lg.lineTo(2.4, -0.8);
    strokeP(ctx, lg, BC.leg, 1.4);
    const ft = new Path2D();
    ft.moveTo(-4, 0); ft.quadraticCurveTo(-1, -1.4, 2, 0.6); ft.moveTo(-0.5, 0); ft.quadraticCurveTo(3, -1.4, 5.6, 0.8);
    strokeP(ctx, ft, BC.leg, 1.3);
  }
  ctx.save();
  ctx.translate(0, -12 - R.lift); ctx.rotate(R.rot); ctx.translate(0, 12);
  // flapping wings: a feathered leaf hinged at the shoulder, pointing back
  const flyWing = (ang, L, col, rim) => {
    ctx.save();
    ctx.translate(-3, -19); ctx.rotate(ang);
    const p = new Path2D();
    p.moveTo(3, -2.5);
    p.bezierCurveTo(-L * 0.35, -7, -L * 0.8, -6, -L - 1, -1.5);
    p.lineTo(-L + 2.5, 0.6); p.lineTo(-L + 2, 2.2); p.lineTo(-L + 5.5, 2); p.lineTo(-L + 5.4, 3.8); p.lineTo(-L + 9, 3.4);
    p.bezierCurveTo(-L * 0.4, 5.5, -2, 5, 3, 2.5);
    p.closePath();
    paint(ctx, p, col, { lg: [0, -6, 0, 4], lw: 1.1, rim });
    const ed = new Path2D(); ed.moveTo(-2, 1); ed.quadraticCurveTo(-L * 0.4, 2.4, -L * 0.62, 0.2);
    strokeP(ctx, ed, rgba(BC.edge, 0.9), 0.9);
    ctx.restore();
  };
  const wingAng = 0.2 + 0.95 * R.flap;
  if (R.fly) flyWing(wingAng + 0.12, 19, { ...BC.wing, base: shade(BC.wing.base, -0.25), hi: shade(BC.wing.base, -0.12) }, 0);
  // tail
  const tail = new Path2D();
  tail.moveTo(-7, -7); tail.lineTo(-15.5, 3.5); tail.quadraticCurveTo(-13, 5, -10.5, 4.6); tail.lineTo(-2.5, -3.5); tail.closePath();
  paint(ctx, tail, BC.wing, { lg: [-7, -7, -14, 4], lw: 1.1 });
  // one plump silhouette: head + body
  const sil = bl([[9.5, -26.5], [3, -33.2], [-5, -31.5], [-9.5, -24], [-11.5, -13], [-8, -4.5], [0, -1.6], [7.5, -6.5], [11, -15], [11, -21.5]], 1);
  const g = ctx.createLinearGradient(0, -18, 0, -1);
  g.addColorStop(0, BC.yellow.hi); g.addColorStop(0.45, BC.yellow.base); g.addColorStop(1, BC.yellow.lo);
  ctx.fillStyle = g; ctx.fill(sil);
  ctx.save(); ctx.clip(sil);
  // brown back
  ctx.fillStyle = BC.wing.base; ctx.beginPath(); ctx.ellipse(-12, -15, 7, 12, 0.2, 0, TAU); ctx.fill();
  // kiskadee head: black crown, white brow band, black mask, white throat
  ctx.fillStyle = BC.black; ctx.beginPath(); ctx.ellipse(1, -28, 12, 8, -0.05, 0, TAU); ctx.fill();
  const band = cv([[-11, -26.5], [-1, -29.6], [10, -28.4]], 1);
  strokeP(ctx, band, BC.white, 2.8);
  ctx.fillStyle = BC.white; ctx.beginPath(); ctx.ellipse(6.5, -19.5, 6.5, 3.8, -0.15, 0, TAU); ctx.fill();
  const mask = cv([[-11, -22.5], [0, -24.6], [11, -23.4]], 1);
  strokeP(ctx, mask, BC.black, 3.6, 'butt');
  ctx.restore();
  crescent(ctx, sil, -LX * 0.5, 1.1, 'rgba(255,255,255,0.4)');
  crescent(ctx, sil, LX * 0.7, -1.4, 'rgba(160,100,10,0.28)');
  ctx.lineWidth = 1.3 * LW; ctx.strokeStyle = line; ctx.lineJoin = 'round'; ctx.stroke(sil);
  // folded wing (perch) / flapping near wing (fly)
  if (R.fly) {
    flyWing(wingAng, 23, BC.wing, 0.8);
  } else {
    const w = bl([[-4, -21], [3, -16], [2.5, -10], [-3, -5.5], [-10, -3.5], [-11, -10], [-9.5, -18]], 1);
    paint(ctx, w, BC.wing, { lg: [0, -21, 0, -4], lw: 1.1, rim: 0.8 });
    ctx.save(); ctx.clip(w);
    const ed = new Path2D();
    scallopRow([[2.6, -12.5], [-1, -13.5], [-5, -13], [-9, -12]], -0.6, 2.4, ed);
    scallopRow([[0, -7], [-4, -8], [-8, -7.5]], -0.6, 2.2, ed);
    strokeP(ctx, ed, BC.edge, 1);
    ctx.restore();
  }
  // eye (in the black mask)
  const ex = 3.6, ey = -24.2;
  const bk = blinkAmt(R.t, 2.7, 0.12, 0.2 + R.seed * 0.37);
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(ex, ey, 2.7, 0, TAU); ctx.fill();
  if (bk < 0.5) {
    ctx.fillStyle = '#120E14'; ctx.beginPath(); ctx.arc(ex + 0.3 + (R.look.x || 0) * 0.5, ey + (R.look.y || 0) * 0.5, 1.9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(ex - 0.4, ey - 0.7, 0.65, 0, TAU); ctx.fill();
  } else {
    const c = new Path2D(); c.moveTo(ex - 2.4, ey); c.quadraticCurveTo(ex, ey + 1.6, ex + 2.4, ey); strokeP(ctx, c, '#120E14', 1);
  }
  // beak (opens to chirp)
  const op = R.chirp;
  ctx.save();
  ctx.translate(9.5, -24.4); ctx.rotate(op * 0.45); ctx.translate(-9.5, 24.4);
  ctx.fillStyle = shade(BC.beak, 0.15);
  ctx.beginPath(); ctx.moveTo(9.4, -24.4); ctx.lineTo(15.4, -23.6); ctx.lineTo(9.6, -22.2); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(9.5, -25); ctx.rotate(-op * 0.15); ctx.translate(-9.5, 25);
  ctx.fillStyle = BC.beak;
  ctx.beginPath(); ctx.moveTo(9, -27.2); ctx.quadraticCurveTo(14, -27, 16.6, -24.6); ctx.lineTo(16.2, -23.6); ctx.quadraticCurveTo(13, -24.2, 9.4, -24); ctx.closePath(); ctx.fill();
  ctx.restore();
  if (R.chirp > 0.3) {
    const cl = new Path2D();
    const a = R.chirp;
    cl.moveTo(19, -31); cl.lineTo(22.5, -34.5 - a);
    cl.moveTo(20.5, -26.5); cl.lineTo(25.5, -27.5);
    cl.moveTo(19.5, -21.5); cl.lineTo(23.5, -19.5 + a * 0.5);
    strokeP(ctx, cl, 'rgba(60,50,40,0.65)', 1.1);
  }
  ctx.restore();
  ctx.restore();
}
function birdAnchors(o = {}) {
  const R = birdRig(o);
  const s = o.scale == null ? 1 : o.scale, fx = o.flip ? -1 : 1;
  const P = (x, y) => { const [rx, ry] = rot2(x, y + 12, R.rot); return { x: (o.x || 0) + rx * s * fx, y: (o.y || 0) + (ry - 12 - R.lift) * s }; };
  return { beak: P(16.4, -24.4), head: P(2, -33), feet: { x: o.x || 0, y: o.y || 0 } };
}

// ============================================================== MONKEY (sleepy capuchin, draped belly-down)
const MC = {
  fur: { base: '#7B5235', hi: '#9C6E48', lo: '#5A3A23', line: '#3A2414', rim: 'rgba(255,220,180,0.32)', sh: 'rgba(40,20,8,0.3)' },
  furFar: { base: '#5E3E27', line: '#33200F' },
  cream: { base: '#F1DCB8', hi: '#FFF1D8', lo: '#D6BC92', line: '#8A6A44' },
  cap: '#3A2618',
  skin: '#E7BFA2',
  hand: '#4B3021',
};
function drawMonkey(ctx, o = {}) {
  const t = o.t || 0;
  const s = o.scale == null ? 1 : o.scale;
  const asleep = o.sleep !== false;
  const br = asleep ? Math.sin(t * 1.5) : Math.sin(t * 2.4) * 0.5;
  const d = o.drape == null ? 1 : clamp(o.drape, 0, 1.5);
  ctx.save();
  ctx.translate(o.x || 0, o.y || 0);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(o.flip ? -s : s, s);
  LX = o.flip ? 1 : -1; LW = 1.35;
  // far limbs peek out behind
  limb(ctx, [[-20, -7], [-24, 3 * d], [-23, 11 * d]], 8, MC.furFar.base, MC.furFar.line, 1.2);
  paint(ctx, el(-22.6, 13 * d, 3.6, 3.6), { base: '#3A2418', line: MC.furFar.line }, { lw: 1 });
  limb(ctx, [[14, -8], [19, 2 * d], [20, 10 * d]], 7.5, MC.furFar.base, MC.furFar.line, 1.2);
  paint(ctx, el(20.4, 12 * d, 3.4, 3.4), { base: '#3A2418', line: MC.furFar.line }, { lw: 1 });
  // tail droops off the rump and curls
  const tw = Math.sin(t * 0.7) * 1.6;
  const tail = cv([[-26, -10], [-37, -9], [-44, 2 * d], [-45 + tw, 15 * d], [-40 + tw, 22 * d], [-34 + tw, 20 * d], [-35 + tw, 15 * d]], 1);
  ctx.lineCap = 'round';
  ctx.strokeStyle = MC.fur.line; ctx.lineWidth = 7.4; ctx.stroke(tail);
  ctx.strokeStyle = MC.fur.base; ctx.lineWidth = 4.8; ctx.stroke(tail);
  // torso (furry, breathing) lying along the surface
  ctx.save();
  ctx.translate(0, -1); ctx.scale(1, 1 + br * 0.04); ctx.translate(0, 1);
  const torso = bl([[-30, -5], [-27, -15], [-15, -21], [0, -22], [14, -19], [24, -11], [22, -2], [8, 0.5], [-10, 0.5], [-24, 0]], 1);
  paint(ctx, torso, MC.fur, { lg: [0, -22, 0, 1], rim: 1.8, sh: 2.4, lw: 1.5 });
  ctx.save(); ctx.clip(torso);
  const fur = new Path2D();
  for (const [x, y] of [[-20, -13], [-10, -17], [2, -18], [12, -15], [-16, -6], [-4, -9], [8, -8]]) { fur.moveTo(x, y); fur.quadraticCurveTo(x + 3, y + 2, x + 5.5, y + 0.8); }
  strokeP(ctx, fur, rgba(MC.fur.line, 0.38), 1);
  ctx.restore();
  ctx.restore();
  // near leg + foot dangling over the flank
  limb(ctx, [[-17, -6], [-21, 4 * d], [-20, 13 * d]], 9.5, MC.fur.base, MC.fur.line, 1.3);
  paint(ctx, bl([[-24, 12 * d], [-17, 11.5 * d], [-16, 16 * d], [-20, 19 * d], [-25, 17 * d]]), { base: MC.hand, line: MC.fur.line, hi: '#6A4630', lo: MC.hand }, { lw: 1 });
  // head resting on its cheek, face toward camera
  const hx = 29, hy = -8 + br * 0.4;
  const ears = [[-11.5, -1], [11.5, 0.5]];
  for (const [ex, ey] of ears) paint(ctx, el(hx + ex, hy + ey, 3.8, 4.4), { base: MC.skin, line: MC.fur.line }, { lw: 1.1 });
  const head = el(hx, hy, 12.5, 11.8, 0.12);
  paint(ctx, head, MC.fur, { rg: [hx - 3, hy - 5, 16], rim: 1.5, lw: 1.5 });
  ctx.save(); ctx.clip(head);
  ctx.fillStyle = MC.cap; ctx.beginPath(); ctx.ellipse(hx - 1, hy - 10.5, 10.5, 6.2, 0.12, 0, TAU); ctx.fill();
  ctx.restore();
  const face = bl([[hx - 8.5, hy - 3], [hx - 3, hy - 6.5], [hx + 3, hy - 6.5], [hx + 8.5, hy - 2.5], [hx + 8.5, hy + 5], [hx + 2, hy + 10], [hx - 4.5, hy + 9.5], [hx - 9, hy + 4]], 1);
  paint(ctx, face, MC.cream, { lg: [0, hy - 6, 0, hy + 10], lw: 1 });
  ctx.fillStyle = rgba(MC.skin, 0.8);
  ctx.beginPath(); ctx.ellipse(hx, hy + 0.4, 6.4, 3.4, 0.1, 0, TAU); ctx.fill();
  if (asleep) {
    const eyeL = new Path2D();
    eyeL.moveTo(hx - 5.2, hy - 0.4); eyeL.quadraticCurveTo(hx - 3.1, hy + 1.8, hx - 1, hy - 0.2);
    eyeL.moveTo(hx + 1.5, hy - 0.2); eyeL.quadraticCurveTo(hx + 3.6, hy + 2, hx + 5.7, hy);
    strokeP(ctx, eyeL, '#3A2414', 1.3);
  } else {
    ctx.fillStyle = '#2A1A10';
    ctx.beginPath(); ctx.arc(hx - 3, hy, 1.7, 0, TAU); ctx.arc(hx + 3.5, hy + 0.2, 1.7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(hx - 3.5, hy - 0.6, 0.5, 0, TAU); ctx.arc(hx + 3, hy - 0.4, 0.5, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,120,120,0.3)';
  ctx.beginPath(); ctx.ellipse(hx - 6, hy + 4, 2.4, 1.4, 0, 0, TAU); ctx.ellipse(hx + 6.5, hy + 4.2, 2.4, 1.4, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#5A3A2A'; ctx.beginPath(); ctx.ellipse(hx + 0.6, hy + 4, 1.5, 1, 0, 0, TAU); ctx.fill();
  const m = new Path2D();
  if (asleep) { m.moveTo(hx - 1, hy + 6.8); m.quadraticCurveTo(hx + 0.8, hy + 8.6 + br * 0.5, hx + 2.6, hy + 7); }
  else { m.moveTo(hx - 2, hy + 6.4); m.quadraticCurveTo(hx + 0.8, hy + 8.6, hx + 3.6, hy + 6.4); }
  strokeP(ctx, m, '#5A3A2A', 1.1);
  // near arm dangling, hand limp
  limb(ctx, [[15, -9], [18, 2 * d], [17, 12 * d]], 8.5, MC.fur.base, MC.fur.line, 1.3);
  paint(ctx, bl([[13.5, 11 * d], [20.5, 11 * d], [21, 15.5 * d], [17, 18.5 * d], [13, 16 * d]]), { base: MC.hand, line: MC.fur.line, hi: '#6A4630', lo: MC.hand }, { lw: 1 });
  ctx.restore();
}
function monkeyAnchors(o = {}) {
  const s = o.scale == null ? 1 : o.scale, fx = o.flip ? -1 : 1;
  return { head: { x: (o.x || 0) + 29 * s * fx, y: (o.y || 0) - 20 * s }, belly: { x: o.x || 0, y: o.y || 0 } };
}

// single drifting feather (e.g. the one Gerald leaves behind)
function drawFeather(ctx, o = {}) {
  const s = o.scale == null ? 1 : o.scale;
  ctx.save();
  ctx.translate(o.x || 0, o.y || 0);
  ctx.rotate(o.rot || 0);
  ctx.scale(s, s);
  LW = 1;
  const p = leaf(-10, 0, 12, 0, 3.4, undefined, 0.42, 2.6);
  paint(ctx, p, { base: '#2F2B36', hi: '#4A4453', lo: '#1F1C24', line: '#121015' }, { lg: [0, -4, 0, 4], lw: 0.9 });
  const r = new Path2D(); r.moveTo(-14, 0.4); r.quadraticCurveTo(-1, -0.4, 11, 0);
  strokeP(ctx, r, '#8C8696', 0.8);
  const nicks = new Path2D(); nicks.moveTo(-3, -3.2); nicks.lineTo(-1, -1); nicks.moveTo(4, 2.8); nicks.lineTo(5.5, 0.8);
  strokeP(ctx, nicks, '#121015', 0.8);
  ctx.restore();
}

// ============================================================== lab
function labBg(ctx, top = '#8ED1F0', bot = '#FDEBC8') {
  const g = ctx.createLinearGradient(0, 0, 0, 720);
  g.addColorStop(0, top); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1280, 720);
}
// stand-in for the capybara head top (so the grip can be judged)
function capyHeadStub(ctx, x, y, s = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  const p = bl([[-60, 6], [-40, -2], [0, -4], [40, -1], [62, 10], [70, 50], [-70, 50]]);
  ctx.fillStyle = '#9A6A45'; ctx.fill(p);
  ctx.lineWidth = 2; ctx.strokeStyle = '#6A4529'; ctx.stroke(p);
  ctx.restore();
}

function dot(ctx, P, color) {
  ctx.save();
  ctx.fillStyle = color; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(P.x, P.y, 3.2, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
}

const lab = {};
// all Gerald moods (perched on a capybara-head stand-in) + every pose
lab.gerald = (ctx, t) => {
  labBg(ctx);
  const moods = ['neutral', 'smug', 'happy', 'sad', 'shock'];
  moods.forEach((m, i) => {
    const x = 120 + i * 255, y = 300;
    capyHeadStub(ctx, x, y + 2, 0.9);
    drawVulture(ctx, { x, y, scale: 1.9, t, mood: m });
    label(ctx, m + (m === 'smug' ? ' (default)' : ''), x, 340);
  });
  const poses = [
    { pose: 'fly', flapPhase: 0.0, l: 'fly (up)' }, { pose: 'fly', flapPhase: 0.45, l: 'fly (down)' },
    { pose: 'fly', glide: true, l: 'fly glide' }, { pose: 'land', flapPhase: 0.1, l: 'land' },
    { pose: 'takeoff', flapPhase: 0.05, l: 'takeoff' }, { pose: 'perch', wing: 0.85, l: 'perch wing .85' },
    { pose: 'perch', talk: 0.8, mood: 'neutral', look: { x: -0.6, y: 0.8 }, l: 'talk + look' },
  ];
  poses.forEach((p, i) => {
    const x = 95 + i * 182, y = 655;
    const o = { x, y, scale: 1.0, t, ...p };
    drawVulture(ctx, o);
    const A = vultureAnchors(o);
    dot(ctx, A.beak, '#FF3B7F'); dot(ctx, A.head, '#3BA0FF');
    label(ctx, p.l, x, 702, 14);
  });
  label(ctx, 'dots: vultureAnchors().beak (pink) / .head (blue)', 1120, 395, 12);
};
// animation check (use --frames 8 --dt 0.1): flap cycle, landing flare, takeoff, perched balance flaps
lab.gerald_flap = (ctx, t) => {
  labBg(ctx);
  drawVulture(ctx, { x: 330, y: 380, scale: 1.55, t, pose: 'fly', flapPhase: t * 1.25 });
  label(ctx, 'fly', 330, 420, 22);
  drawVulture(ctx, { x: 820, y: 385, scale: 1.25, t, pose: 'land', flapPhase: t * 1.25 + 0.3, flip: true });
  label(ctx, 'land (flip)', 820, 420, 22);
  drawVulture(ctx, { x: 1110, y: 385, scale: 1.2, t, pose: 'takeoff', flapPhase: t * 1.25 + 0.6 });
  label(ctx, 'takeoff', 1110, 420, 22);
  capyHeadStub(ctx, 330, 662, 1.1);
  drawVulture(ctx, { x: 330, y: 660, scale: 1.6, t, pose: 'perch', wing: 0.6, flapPhase: t * 1.6, mood: 'shock' });
  label(ctx, 'perch balance flaps (wing .6 + flapPhase)', 330, 705, 16);
  capyHeadStub(ctx, 820, 662, 1.1);
  drawVulture(ctx, { x: 820, y: 660, scale: 1.6, t: t * 4, pose: 'perch', talk: clamp(0.5 + 0.5 * Math.sin(t * 13)) });
  label(ctx, 'perch idle + talk (t x4)', 820, 705, 16);
  drawFeather(ctx, { x: 1110, y: 520 + (t * 40) % 140, rot: Math.sin(t * 3) * 0.8, scale: 2 });
  label(ctx, 'drawFeather', 1110, 705, 16);
};
lab.shelley = (ctx, t) => {
  labBg(ctx, '#C98F5A', '#7A4E2E');
  const moods = ['neutral', 'happy', 'sad', 'smug', 'shock'];
  moods.forEach((m, i) => {
    const x = 105 + i * 250, y = 330;
    ctx.fillStyle = '#7A3E2E'; U.roundRect(ctx, x - 80, y, 160, 30, 10); ctx.fill();
    drawTortoise(ctx, { x, y, scale: 1.3, t, mood: m, talk: m === 'happy' ? 0.6 : 0 });
    label(ctx, m + (m === 'happy' ? ' + talk' : ''), x, y + 52);
  });
  const ex = [
    { l: 'write 0.5 (scribble)', write: 0.5 }, { l: "note:'NUTS' write .95", note: 'NUTS', write: 0.95 },
    { l: 'neck +0.8 (lean)', neck: 0.8, mood: 'sleepy' }, { l: 'flip + talk', flip: true, talk: 0.8 }, { l: 'notepad:false', notepad: false, mood: 'smug' },
  ];
  ex.forEach((e, i) => {
    const x = 105 + i * 250, y = 650;
    ctx.fillStyle = '#7A3E2E'; U.roundRect(ctx, x - 80, y, 160, 30, 10); ctx.fill();
    const o = { x, y, scale: 1.3, t, ...e };
    drawTortoise(ctx, o);
    if (i === 0) { const A = tortoiseAnchors(o); dot(ctx, A.notepad, '#FF3B7F'); dot(ctx, A.head, '#3BA0FF'); dot(ctx, A.beak, '#FFD23B'); }
    label(ctx, e.l, x, y + 52);
  });
};
lab.fish = (ctx, t) => {
  labBg(ctx, '#BFE7F2', '#E9D9B0');
  ctx.fillStyle = 'rgba(92,201,201,0.55)'; ctx.fillRect(0, 0, 1280, 300);
  const moods = ['neutral', 'happy', 'worried', 'sad', 'solemn', 'shock'];
  moods.forEach((m, i) => {
    drawFish(ctx, { x: 110 + i * 210, y: 130, scale: 2.6, t, mood: m, color: i % 2 ? 'teal' : 'orange', swim: true });
    label(ctx, m, 110 + i * 210, 220);
  });
  drawFish(ctx, { x: 420, y: 290, scale: 2.2, t, wave: 1, color: 'teal', mood: 'happy' });
  label(ctx, 'wave', 420, 350);
  drawFish(ctx, { x: 860, y: 290, scale: 2.2, t, color: '#B48CFF', suitcase: true, swim: true });
  label(ctx, 'custom colour + suitcase (swim)', 860, 385);
  ctx.fillStyle = '#A8885E'; ctx.fillRect(0, 560, 1280, 160);
  for (let i = 0; i < 6; i++) {
    const x = 110 + i * 210;
    drawFish(ctx, { x, y: 560, scale: 2.6, t, hop: i / 6 + t * 1.5, suitcase: true, color: i % 2 ? 'teal' : 'orange', mood: i === 5 ? 'solemn' : 'worried', nod: i === 5 ? 0.6 : 0 });
    label(ctx, i === 5 ? 'hop + nod .6 (solemn)' : 'hop ' + (i / 6).toFixed(2), x, 610);
  }
};
lab.extras = (ctx, t) => {
  labBg(ctx);
  for (const [x, y] of [[300, 430], [880, 430]]) {
    ctx.fillStyle = '#9A6A45';
    const p = bl([[x - 170, y + 60], [x - 150, y - 10], [x - 60, y - 40], [x + 60, y - 38], [x + 150, y - 5], [x + 170, y + 60]]);
    ctx.fill(p); ctx.lineWidth = 2; ctx.strokeStyle = '#6A4529'; ctx.stroke(p);
  }
  drawMonkey(ctx, { x: 300, y: 392, scale: 2.4, t });
  label(ctx, 'monkey (asleep, draped)', 300, 560);
  drawMonkey(ctx, { x: 880, y: 394, scale: 2.4, t, flip: true, sleep: false });
  drawBird(ctx, { x: 990, y: 384, scale: 2, t, seed: 2 });
  label(ctx, 'monkey awake + flip; bird perched on capy', 880, 560);
  drawBird(ctx, { x: 110, y: 170, scale: 3, t });
  label(ctx, 'bird perch', 110, 205);
  drawBird(ctx, { x: 290, y: 170, scale: 3, t, chirp: true, flip: true });
  label(ctx, 'chirp:true, flip', 290, 205);
  drawBird(ctx, { x: 500, y: 150, scale: 3, t, pose: 'fly', flapPhase: t * 3 });
  drawBird(ctx, { x: 660, y: 150, scale: 3, t, pose: 'fly', flapPhase: t * 3 + 0.5 });
  label(ctx, 'bird fly', 580, 205);
  for (let i = 0; i < 4; i++) drawFeather(ctx, { x: 960 + i * 70, y: 120 + i * 20, rot: -0.4 + i * 0.5 + t, scale: 2 });
  label(ctx, 'drawFeather', 1060, 205);
  drawTinySuitcase(ctx, 1180, 600, 4, Math.sin(t * 2) * 0.1);
  label(ctx, 'drawTinySuitcase', 1180, 700);
};
// integration check with the real capybara rig (if capybara.js is available)
lab.context = (ctx, t) => {
  labBg(ctx);
  let K = null;
  try { K = require('./capybara'); } catch (e) { K = null; }
  if (!K || !K.drawCapybara) { label(ctx, 'capybara.js not available', 640, 360, 24); return; }
  const barry = { who: 'barry', x: 420, y: 520, scale: 1.25, t, pose: 'swim', mood: 'deadpan' };
  K.drawCapybara(ctx, barry);
  const A = K.capyAnchors(barry);
  drawVulture(ctx, { x: A.headTop.x, y: A.headTop.y, rot: A.headTop.angle, scale: 0.75 * barry.scale, t, mood: 'smug', talk: clamp(Math.sin(t * 11)) * 0.6 });
  label(ctx, 'Gerald on Barry: scale = 0.75 x capy scale, rot = headTop.angle', 420, 690, 16);
  const ex = { who: 'extra', seed: 3, x: 980, y: 520, scale: 1.0, t, pose: 'swim', accessories: { orange: false, bird: false } };
  K.drawCapybara(ctx, ex);
  const B = K.capyAnchors(ex);
  drawMonkey(ctx, { x: B.back.x - 10, y: B.back.y + 3, scale: 0.9, t });
  drawBird(ctx, { x: B.headTop.x, y: B.headTop.y, scale: 1.0, t, chirp: Math.sin(t * 2) > 0.6 });
  label(ctx, 'extras: monkey on back (0.9 x), bird on headTop (1.0 x)', 980, 690, 16);
};

module.exports = {
  drawVulture, vultureAnchors, drawTortoise, tortoiseAnchors, drawFish, fishAnchors, fishHopX, drawTinySuitcase,
  drawBird, birdAnchors, drawMonkey, monkeyAnchors, drawFeather, lab,
};
