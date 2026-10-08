// Math, easing, colour, randomness and camera helpers. Everything is pure.
'use strict';

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const invLerp = (a, b, x) => clamp((x - a) / (b - a));
const remap = (x, a, b, c, d) => lerp(c, d, invLerp(a, b, x));
const smoothstep = (a, b, x) => { const t = invLerp(a, b, x); return t * t * (3 - 2 * t); };
const deg = (d) => (d * Math.PI) / 180;

const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  inBack: (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t,
  outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
  outBounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

// Tween helper: value at time t going from a to b between t0 and t1 with easing.
function tween(t, t0, t1, a, b, fn = ease.inOutCubic) {
  if (t <= t0) return a;
  if (t >= t1) return b;
  return lerp(a, b, fn((t - t0) / (t1 - t0)));
}

// Keyframes: [[t, value], ...] (values may be numbers or arrays of numbers).
function keys(t, frames, fn = ease.inOutCubic) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    const [t1, v1] = frames[i];
    if (t <= t1) {
      const [t0, v0] = frames[i - 1];
      const k = fn((t - t0) / (t1 - t0 || 1));
      if (Array.isArray(v0)) return v0.map((v, j) => lerp(v, v1[j], k));
      return lerp(v0, v1, k);
    }
  }
  return frames[frames.length - 1][1];
}

// ---------------------------------------------------------------- randomness
// mulberry32 seeded PRNG
function rng(seed = 1) {
  let a = (Math.floor(seed * 2654435761) ^ 0x9e3779b9) >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (a0, b0) => a0 + (b0 - a0) * next();
  next.int = (a0, b0) => Math.floor(a0 + (b0 - a0 + 1) * next());
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  return next;
}
// hash → [0,1)
function hash1(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
// smooth 1D value noise in [-1, 1]
function noise1(x) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash1(i), hash1(i + 1), u) * 2 - 1;
}
function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy) * 2 - 1;
}

// ---------------------------------------------------------------- colour
function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex([r, g, b]) {
  const c = (v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
// mix two hex colours
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex([lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]);
}
const shade = (hex, amt) => (amt < 0 ? mix(hex, '#000000', -amt) : mix(hex, '#ffffff', amt));
function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ---------------------------------------------------------------- drawing
function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU);
}
function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.abs(r), 0, TAU);
}
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
// Smooth closed blob through points [[x,y],...] (Catmull-Rom → Bezier).
function blob(ctx, pts, tension = 1) {
  const n = pts.length;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension, c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension;
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension, c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension;
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2[0], p2[1]);
  }
  ctx.closePath();
}
// Open smooth curve through points.
function curve(ctx, pts, tension = 1) {
  const n = pts.length;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension, c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension;
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension, c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension;
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2[0], p2[1]);
  }
}
function withState(ctx, fn) {
  ctx.save();
  try { fn(); } finally { ctx.restore(); }
}

// ---------------------------------------------------------------- camera
// Centre design point (x, y) on screen at `zoom` (1 = the full 1280x720 view).
function withCamera(ctx, cam, fn) {
  const { x = 640, y = 360, zoom = 1, rot = 0, shake = 0, t = 0 } = cam;
  ctx.save();
  let sx = 0, sy = 0, sr = 0;
  if (shake > 0) {
    sx = noise1(t * 23.1 + 3.3) * shake;
    sy = noise1(t * 19.7 + 9.1) * shake;
    sr = noise1(t * 11.3 + 1.7) * shake * 0.002;
  }
  ctx.translate(640 + sx, 360 + sy);
  ctx.rotate(rot + sr);
  ctx.scale(zoom, zoom);
  ctx.translate(-x, -y);
  try { fn(); } finally { ctx.restore(); }
}
// Interpolate between two camera framings.
function camLerp(a, b, k) {
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), zoom: Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), k)), rot: lerp(a.rot || 0, b.rot || 0, k) };
}
// Slow cinematic drift for a held shot: tiny push-in + float.
function drift(cam, tShot, amount = 1) {
  return { ...cam, zoom: cam.zoom * (1 + 0.006 * amount * tShot), x: cam.x + Math.sin(tShot * 0.3) * 3 * amount, y: cam.y + Math.sin(tShot * 0.23 + 1) * 2 * amount };
}

module.exports = {
  TAU, clamp, lerp, invLerp, remap, smoothstep, deg, ease, tween, keys,
  rng, hash1, hash2, noise1, noise2,
  hexToRgb, rgbToHex, mix, shade, rgba,
  ellipse, circle, roundRect, blob, curve, withState,
  withCamera, camLerp, drift,
};
