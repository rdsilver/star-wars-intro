// CHILL CAPYBARA — props & small FX (see DESIGN.md §6). Flat-vector storybook style that
// matches the characters: soft gradients, a rim-light crescent on the top-left edges, thin
// darker same-hue outlines, rounded shapes. Every function is a pure function of its options
// (time `t` included): deterministic, no Math.random, ctx state restored on exit.
// Cost at 1920×1080 (typical sizes): most props 0.3-1.5 ms; two-plank sign ≈3.5 ms; raft
// ≈9 ms; burning sign ≈11 ms; close-up orange (r=120) ≈4.5 ms.
//
// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API   (all coordinates in 1280×720 design units; angles in RADIANS)
// ─────────────────────────────────────────────────────────────────────────────
// Common options: x, y (origin, see each prop), scale=1, rot=0, flip=false (mirror
// horizontally), alpha=1. Outlines thin out gently when a prop is drawn big (close-ups).
// "t = seconds since X" FX draw nothing for t < 0 and nothing once finished, so they can
// be called every frame with S.since('cue').
//
// drawOrange(ctx, {x, y, r=16, rot, squash=0, t, seed, leaf=true, leaves=1, alpha})
//     Glossy dimpled orange with stem + leaf. (x,y) = centre of the round orange; the
//     bottom point (x, y+r) stays put while squashing. squash 0..1 morphs into a flattened
//     burst orange with exposed pulp and a juice puddle (pair with drawJuiceSplat at impact).
// drawJuiceSplat(ctx, {x, y, r=24, t, seed, rot, life=1.2, gravity=1, puddle=false, floor=0, alpha})
//     Animated orange-juice burst. t = seconds since impact: splat star (0-0.4 s), mist ring,
//     ballistic droplets, peel chips, pulp flecks (gone after `life`). puddle:true adds a
//     growing juice puddle at y + floor.
// drawHelmet(ctx, {x, y, scale=1, rot, flip, strap=true})
//     Barry's tiny red aero bike helmet. Origin = centre of the bottom rim; visor faces right.
//     Scale 1 ≈ the helmet the capybara rig wears (≈74 units long). (Use for the helmet
//     set down on a rock / held in a paw; when worn, the capybara rig draws its own.)
// drawThermometer(ctx, {x, y, scale=1, rot, flip, level=0.5, reading=null, showTag=true,
//                       tagSide='right', tagSize=13, labels=auto, broken=0, breakAt='bulb',
//                       surge=true, length=100, t})
//     Glass thermometer, VERTICAL, bulb at the bottom. Origin = bulb centre; the tube runs
//     up to y - length*scale. level 0..1 = red column (thermoLevel(°C) maps 30 °C → 0,
//     45 °C → 1). reading '39.4' + showTag → big upright readable tag "39.4°" pointing at the
//     top of the column (stays upright whatever rot/flip). labels (default on at scale ≥ 2.2)
//     = printed 30/35/40/45 scale numbers on a frosted decal. broken 0..1 = the break beat:
//     0-0.14 the column SURGES to the top (surge:false keeps level) while the bulb swells,
//     trembles and cracks; 0.16 POP (flash, glass shards, red spray); the column drains;
//     1 = jagged empty stub. breakAt:'top' blows the top cap off instead (red geyser).
//     Drive it with broken = S.prog('thermo_pops').
// thermoLevel(celsius, lo=30, hi=45) → level 0..1
// thermoAnchors(o) → {bulb, top, column (top of red column), tag} caller-space points
// drawSign(ctx, {x, y, text | lines, style='wood'|'arrow', arrowDir='left'|'right', w, h,
//                size=24, sizes, weight=700, scale=1, rot, burn=0, t, seed, paint, board,
//                stake=30, drive=1, ground=true, wrap=true, glyph, drips=0})
//     Hand-made wooden sign with painted Fredoka lettering on a stake in the ground.
//     Origin (x,y) = the GROUND point under the stake; the board sits above it (rot pivots
//     there — use signWobble(dt) for a post-hammer-hit wobble). text: 'A / B', 'A — B',
//     'A -- B' or '\n' split lines; long single lines (>16 chars) auto-wrap at '. ' / ', '
//     (wrap:false disables). Lines after the first that contain lowercase get 0.66 size
//     (sizes:[...] overrides, relative to `size`). Nails are kept off the lettering.
//     'wood': one plank per line (signs wider than 210 get two posts). 'arrow': one board cut
//     to a point toward arrowDir (multi-line ok: lines:['EVACUATION','ROUTE']). w/h optional:
//     auto-sized from the text when omitted, else the text is fitted. paint = letter colour
//     ('#FFF3D9'); board = paint colour for the whole board (e.g. '#D9473C'), default natural
//     wood. glyph:true (wood, 1 line) adds a painted arrow toward arrowDir. drive 0..1: how far
//     the stake is hammered in (0 → board ~28 units higher). drips 0..1: opt-in paint drips
//     under E/L/Z (close-ups only; they read as accents when small). burn 0..1: char creeps up
//     from the bottom behind a glowing ember front, letters blacken, flames + smoke (uses t).
//     Tested texts: 'EXIT', 'EVACUATION ROUTE', 'NO, REALLY. THIS WAY.', 'YES, YOU, SUNNY',
//     'SNOOZE SPRINGS / No Worries Allowed', 'SNOOZE SPRINGS 2 / Barry Approved',
//     'S.S. TOLD YOU SO', lines:['SPRING RULES','1. Introduce yourself','2. Say goodbye',
//     '3. No vultures on heads'].
// signLayout(o) → {w, h, lines, sizes, ...} (unscaled)
// signAnchors(o) → {top (Gerald lands here), center, ground, left, right, w, h} caller space
// signWobble(dt, amp=0.08) → rot (radians) of a sign hit dt seconds ago (damped wobble).
// drawRaft(ctx, {x, y, scale=1, t, flip, flagText='S.S. TOLD YOU SO', flagShow, build=1,
//                bob=0, rock=0, wind=0.6, flagDir=1, paddle=true, wake=0, dir=-1, wet, alpha})
//     Reed-bundle raft: 3 lashed bundles with upturned tips, rope lashings, a bamboo mast with
//     stays and a swallowtail banner painted with flagText, a steering oar at the stern
//     (the end opposite `dir`, so by default on the right for a raft heading left).
//     Origin = centre at the WATERLINE; hull ≈388 long (tips at x ±194, deck y ≈ -42),
//     mast top ≈ 272 above the waterline, banner ≈250 long streaming from the mast top
//     (scale 1). build 0..1 assembles it for the montage: bundles drop in one by one
//     (0-0.42), lashings wrap (0.42-0.7), mast rises (0.7-0.82), banner unfurls (0.82-0.95),
//     oar (0.95-1). bob 0..1 floating bob/roll (0 = on land); rock = extra roll (radians).
//     wind 0..1 banner flutter; flagDir ±1 = caller-space side the banner streams to.
//     wake 0..1 with dir ±1 (direction of travel, caller space): bow foam + wake lines.
//     flagShow = number of flagText characters painted (e.g. 4 → just 'S.S.'), for when
//     Gerald sits on the banner (draw him after the raft at raftAnchors().flagCover).
// raftAnchors(o) → {seats:[4 deck points, stern→bow], deck, mastTop (Gerald perches),
//                   flag (banner centre), flagWords:[{text,x,y,w,h}], flagCover ({x,y,w,h}
//                   over 'TOLD YOU SO' — everything after the first word), tipL, tipR,
//                   waterline, angle} in caller space (bob/rock included). Pass the same o.
// drawBackpack(ctx, {x, y, scale=1, rot, flip, open=0})
//     Barry's teal go-bag with a bedroll strapped under it and a first-aid patch.
//     Origin = bottom centre (≈72 wide × 100 tall). open 0..1 flips the flap up/back and shows
//     the mouth. backpackAnchors(o) → {mouth (items fly in here), top, bottom, strap}.
// drawHammer(ctx, {x, y, scale=1, rot, flip})        origin = grip (paw); head up, face → right.
//     hammerAnchors(o) → {face, head, grip, butt}. Swing by animating rot about the grip.
// drawSuitcase(ctx, {x, y, scale=1, rot, flip, color, sticker=true})
//     tiny leather suitcase; origin = top of the handle (hangs from a fin/paw), ≈44×38.
// drawRock(ctx, {x, y, r=20, glow=0, rot, trail=0, dir=π/2, t, seed})
//     volcanic rock. glow 0..1 → glowing cracks + red-hot tint + halo. trail 0..1 → fiery
//     streak + smoke behind it, opposite to dir (= direction of travel, default falling down).
// drawWhistle(ctx, {x, y, scale=1, rot, flip, cord=true})        origin = barrel centre.
// drawFlashlight(ctx, {x, y, scale=1, rot, flip, on=false, beam=220, t})  origin = body
//     centre, lens → right; on draws a soft beam cone.
// drawBandage(ctx, {x, y, scale=1, rot, flip, type='roll'|'strip'|'cross'})
// drawMap(ctx, {x, y, scale=1, rot, flip})            folded treasure-style escape map.
// drawCandle(ctx, {x, y, scale=1, rot, t, lit=true, label='Serenity'})  jar candle,
//     origin = bottom centre.
// drawNotepad(ctx, {x, y, scale=1, rot, flip, lines, scribble=1, pencil=false})
//     spiral pad, origin = centre; lines = array of short handwritten strings.
// drawChart(ctx, {x, y, scale=1, rot, progress=1})   Barry's hand-drawn "temperature is
//     going up" zigzag graph ending in a frowny face, on a board with a handle (origin =
//     bottom of the handle). progress 0..1 draws the line on.
// drawSweatDrop(ctx, {x, y, r=6, rot, alpha})         tip up (before rot).
// drawMotionLines(ctx, {x, y, angle=0, len=70, count=4, spread=44, gap=14, width=3.2,
//                       color='#FFFFFF', alpha=0.9, t, seed, arc})
//     speed lines trailing behind (x,y) for an object moving toward `angle`.
//     arc:{r, a0, a1} instead draws swoosh arcs around (x,y) for a swing from a0 to a1.
// drawStars(ctx, {x, y, r=34, t, count=4, size=9, tilt=0.34, speed=1.4, layer='both'})
//     dizzy stars orbiting (x,y). layer 'back' / 'front' lets you sandwich a head.
// drawZzz(ctx, {x, y, t, scale=1, count=3, period=2.6, color, line})  rising Z's.
// drawSteamPuff(ctx, {x, y, r=20, life, t, seed, alpha=0.9, rise=1})
// drawSmokePuff(ctx, {x, y, r=24, life, t, seed, alpha=1, rise=1,
//                     tone='grey'|'dark'|'dust'|'white'|'soot'})
//     cartoon cloud puffs. life 0..1 = age (grows, rises, fades); omit for a static puff.
//     'dust' for scramble/launch puffs, 'dark' for volcanic smoke.
// drawWaterSplash(ctx, {x, y, r=24, t, seed, big=false, alpha, colors:{top,mid,base,line,foam}})
//     water crown + droplets + ripple rings where something drops in; (x,y) = entry point on
//     the surface, t = seconds since entry (done by ~1.4 s). big:true adds a tall centre jet
//     (raft launch, big plops). Orange plop ≈ r 16-22; falling rock ≈ r 26-34. colors overrides
//     the water palette (e.g. a darker teal at dusk; or rely on env's drawSpringOverlay grade).
// drawImpactBurst(ctx, {x, y, r=56, text='BONK!', t, rot=-0.08, seed})
//     comic starburst; t = seconds since impact (pops in 0-0.14 s, fades 0.55-0.8 s);
//     omit t for a static burst.
// drawSpeechBubble(ctx, {x, y, text, w=240, size=22, to:{x,y}, style='speech'|'thought'|'shout'})
//     (x,y) = bubble centre; tail points at `to`. Returns {w, h}.
// PROP_COLORS — shared palette.   RAFT — raft geometry constants.
// lab — sheets (node src/lab.js props <sheet> out.png [--frames 8 --dt 0.1]):
//     all, orange, thermometer, thermo_pop, raft, raft_context, signs, fx, closeup, context,
//     context_erupt
'use strict';

const U = require('./util');
const { TAU, clamp, lerp, smoothstep, ease, rng, hash1, noise1, mix, rgba, ellipse, circle, roundRect, blob } = U;

const PI = Math.PI;
const FONT = 'Fredoka';
const frac = (v) => v - Math.floor(v);
// outline weight factor: lines thicken slower than the prop when it is scaled up
const lwf = (s) => Math.pow(Math.max(0.05, Math.abs(s)), -0.42);

const PROP_COLORS = {
  orange: { light: '#FFC867', base: '#FF9A1F', dark: '#E06F0C', line: '#B85A0A', pulp: '#FFD98A', juice: '#FFA62B', juiceLine: '#D9771A' },
  wood: { light: '#D7A26C', base: '#B57E4C', dark: '#82552F', deep: '#5E3B22', hi: '#ECC48F' },
  helmet: { top: '#F66B5E', bottom: '#C42E28', hi: '#FFA294', line: '#7A1B18' },
  red: '#E2382F', glass: '#6E8494', paint: '#FFF3D9', rope: '#D2A562', ropeLine: '#7A5428',
  reed: { top: '#F0D88A', mid: '#D9B65C', bottom: '#A9843A', line: '#7A5A24', hi: '#FFF1BD' },
  teal: { top: '#5A9CBE', bottom: '#2C5F7A', hi: '#8CC4DD', line: '#1B3B4D' },
  rock: { top: '#6E6874', bottom: '#3A3640', hi: '#9C96A3', line: '#24212A' },
  ink: '#2E3440',
};

// ───────────────────────────────────────────────────────────── text measuring (cached)
let _mc = null;
function mctx() {
  if (!_mc) { const { createCanvas } = require('@napi-rs/canvas'); _mc = createCanvas(8, 8).getContext('2d'); }
  return _mc;
}
const _wcache = new Map();
// per-character widths at size 100 (pure function of the constant inputs → cached)
function charWidths(text, weight = 700, font = FONT) {
  const key = weight + '|' + font + '|' + text;
  let v = _wcache.get(key);
  if (v) return v;
  const c = mctx();
  c.font = `${weight} 100px ${font}`;
  const chars = Array.from(text), ws = [];
  let w = 0;
  for (const ch of chars) { const cw = c.measureText(ch).width; ws.push(cw); w += cw; }
  v = { chars, ws, w };
  if (_wcache.size > 3000) _wcache.clear();
  _wcache.set(key, v);
  return v;
}
const textW = (text, size, weight = 700, font = FONT) => (charWidths(text, weight, font).w * size) / 100;

// ───────────────────────────────────────────────────────────── drawing helpers
function begin(ctx, o, defScale = 1) {
  const s = o.scale != null ? o.scale : defScale;
  ctx.save();
  ctx.translate(o.x || 0, o.y || 0);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(o.flip ? -s : s, s);
  if (o.alpha != null && o.alpha < 1) ctx.globalAlpha *= clamp(o.alpha);
  return { s, k: lwf(s), rim: rimVec(o), f: o.flip ? -1 : 1 };
}
// rim-light offset in local coordinates so the light always comes from the top-left
function rimVec(o, a = 1.1, b = 2.3) {
  const r = -(o.rot || 0), c = Math.cos(r), s = Math.sin(r);
  let dx = a * c - b * s;
  const dy = a * s + b * c;
  if (o.flip) dx = -dx;
  return [dx, dy];
}
// local → caller-space point for anchors
function xform(o, defScale = 1) {
  const x = o.x || 0, y = o.y || 0, s = o.scale != null ? o.scale : defScale, f = o.flip ? -1 : 1;
  const c = Math.cos(o.rot || 0), sn = Math.sin(o.rot || 0);
  return (lx, ly) => { const px = lx * s * f, py = ly * s; return { x: x + px * c - py * sn, y: y + px * sn + py * c }; };
}
function lin(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  const n = stops.length;
  stops.forEach((s, i) => (Array.isArray(s) ? g.addColorStop(s[0], s[1]) : g.addColorStop(n === 1 ? 0 : i / (n - 1), s)));
  return g;
}
// Fill a shape with the character "paint" look: rim highlight crescent (hi colour peeking
// out where the offset gradient body doesn't cover), optional shade overlay, extra details
// clipped inside, then a thin darker outline.
function paint(ctx, path, o) {
  const { fill, hi, rim, shadow, line, lw = 1.6, extra } = o;
  ctx.save();
  path();
  ctx.clip();
  if (hi) { ctx.fillStyle = hi; ctx.fillRect(-3000, -3000, 6000, 6000); }
  ctx.save();
  if (hi && rim) ctx.translate(rim[0], rim[1]);
  ctx.fillStyle = fill;
  path();
  ctx.fill();
  ctx.restore();
  if (shadow) { ctx.fillStyle = shadow; ctx.fillRect(-3000, -3000, 6000, 6000); }
  if (extra) extra();
  ctx.restore();
  if (line) {
    path();
    ctx.strokeStyle = line;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}
// teardrop, tip pointing up before rotation; tail = tip length in radii.
// sub=true appends to the current path (for unions of several drops).
function dropPath(ctx, x, y, r, ang = 0, tail = 2.1, sub = false, neck = 0.42) {
  const s = Math.sin(ang), c = Math.cos(ang);
  const P = (px, py) => [x + px * c - py * s, y + px * s + py * c];
  const seg = (a, b, d) => { const A = P(a[0], a[1]), B = P(b[0], b[1]), D = P(d[0], d[1]); ctx.bezierCurveTo(A[0], A[1], B[0], B[1], D[0], D[1]); };
  const tt = r * tail;
  if (!sub) ctx.beginPath();
  const p = P(0, -tt);
  ctx.moveTo(p[0], p[1]);
  seg([r * neck, -tt * 0.55], [r * 1.02, -r * 0.5 - (neck < 0.3 ? r * 0.6 : 0)], [r, r * 0.1]);
  seg([r * 0.98, r * 0.78], [r * 0.52, r * 1.1], [0, r * 1.1]);
  seg([-r * 0.52, r * 1.1], [-r * 0.98, r * 0.78], [-r, r * 0.1]);
  seg([-r * 1.02, -r * 0.5 - (neck < 0.3 ? r * 0.6 : 0)], [-r * neck, -tt * 0.55], [0, -tt]);
  ctx.closePath();
}
// organic liquid splash: central blob + arms ending in round drops (tails point inward).
// Fills with `fill`, outline drawn as an outer-only stroke so arms merge cleanly.
function splashShape(ctx, R, seed, fill, line, lw, sx = 1, sy = 0.85) {
  const Rn = rng(seed * 3.3 + 1);
  const n = 8;
  const path = () => {
    ctx.beginPath();
    const pts = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const rr = R * 0.5 * (0.85 + 0.3 * hash1(seed * 1.9 + i));
      pts.push([Math.cos(a) * rr * sx, Math.sin(a) * rr * sy]);
    }
    const b = pts;
    ctx.moveTo((b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2);
    for (let i = 1; i <= b.length; i++) {
      const p0 = b[i % b.length], p1 = b[(i + 1) % b.length];
      ctx.quadraticCurveTo(p0[0], p0[1], (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
    }
    ctx.closePath();
    const R2 = rng(seed * 3.3 + 1);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + R2.range(-0.25, 0.25);
      const long = i % 3 !== 1;
      const L = R * (long ? R2.range(0.95, 1.4) : R2.range(0.62, 0.8));
      const dr = R * (long ? R2.range(0.1, 0.15) : R2.range(0.16, 0.21));
      const cx = Math.cos(a) * L * sx, cy = Math.sin(a) * L * sy;
      const ang = Math.atan2(-Math.cos(a), Math.sin(a));
      dropPath(ctx, cx, cy, dr, ang, Math.max(1.6, (L * 0.78) / dr), true, long ? 0.16 : 0.4);
      if (long && R2() < 0.6) {
        const L2 = L + dr * R2.range(2.2, 3.2), d2 = dr * R2.range(0.45, 0.7);
        ctx.moveTo(Math.cos(a) * L2 * sx + d2, Math.sin(a) * L2 * sy);
        ctx.arc(Math.cos(a) * L2 * sx, Math.sin(a) * L2 * sy, d2, 0, TAU);
      }
    }
  };
  void Rn;
  path();
  if (line) { ctx.strokeStyle = line; ctx.lineWidth = lw * 2; ctx.lineJoin = 'round'; ctx.stroke(); }
  ctx.fillStyle = fill;
  ctx.fill();
}
// rotation that makes a dropPath's tail trail behind a velocity (vx, vy)
const trailAng = (vx, vy) => Math.atan2(-vx, vy);

// per-letter painted text, centred on (x, y). Returns the drawn width.
function paintText(ctx, text, x, y, size, o = {}) {
  const { weight = 700, font = FONT, color = PROP_COLORS.paint, shadow = null, shOff = [0.045, 0.07], seed = 1,
    jitter = 1, maxW = 0, outline = null, outlineW = 0, spacing = 0, drips = 0, dy0 = 0.03 } = o;
  const m = charWidths(text, weight, font);
  const k = size / 100, sp = spacing * size;
  const w = m.w * k + sp * Math.max(0, m.chars.length - 1);
  const sx = maxW && w > maxW ? maxW / w : 1;
  ctx.save();
  ctx.translate(x, y - size * dy0);
  ctx.scale(sx, 1);
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const pass = (fn) => {
    let cx = -w / 2;
    for (let i = 0; i < m.chars.length; i++) {
      const ch = m.chars[i], cw = m.ws[i] * k;
      if (ch !== ' ') {
        ctx.save();
        ctx.translate(cx + cw / 2, (hash1(seed + i * 7.1) - 0.5) * size * 0.07 * jitter);
        ctx.rotate((hash1(seed + i * 3.3) - 0.5) * 0.1 * jitter);
        fn(ch, cw, i);
        ctx.restore();
      }
      cx += cw + sp;
    }
  };
  // hand-painted drips: only under letters with a flat/round bottom, attached to the stroke
  const DRIP_OK = 'ELZ2'; // flat-bottomed letters only (a drip under O reads as Q)
  const drip = (ch, cw, i, ox, oy) => {
    if (!drips || DRIP_OK.indexOf(ch) < 0 || hash1(seed * 1.7 + i * 5.3) >= drips) return;
    const wide = 'EZL'.indexOf(ch) >= 0;
    const dx = ox + (wide ? 0.05 + 0.2 * hash1(seed + i * 2.9) : (hash1(seed + i * 2.9) - 0.5) * 0.16) * cw;
    const y0 = oy + size * 0.22, L = size * (0.3 + 0.2 * hash1(seed * 3.1 + i));
    const w0 = size * 0.06, w1 = size * 0.032, br = size * 0.055;
    ctx.beginPath();
    ctx.moveTo(dx - w0, y0);
    ctx.quadraticCurveTo(dx - w1, y0 + L * 0.35, dx - w1, y0 + L);
    ctx.arc(dx, y0 + L, br, PI * 0.85, PI * 0.15, true);
    ctx.quadraticCurveTo(dx + w1, y0 + L * 0.35, dx + w0, y0);
    ctx.closePath();
    ctx.fill();
  };
  if (shadow) {
    ctx.fillStyle = shadow;
    pass((ch, cw, i) => { ctx.fillText(ch, size * shOff[0], size * shOff[1]); drip(ch, cw, i, size * shOff[0], size * shOff[1]); });
  }
  if (outline) {
    ctx.strokeStyle = outline; ctx.lineWidth = outlineW; ctx.lineJoin = 'round';
    pass((ch) => ctx.strokeText(ch, 0, 0));
  }
  ctx.fillStyle = color;
  pass((ch, cw, i) => { ctx.fillText(ch, 0, 0); drip(ch, cw, i, 0, 0); });
  ctx.restore();
  return w * sx;
}

// layered flame tongue rising from (x, y)
function flame(ctx, x, y, h, w, t, seed, a = 1) {
  if (h < 0.5 || a <= 0) return;
  const f = 0.8 + 0.28 * noise1(t * 9 + seed * 3.1);
  const H = h * f, sway = noise1(t * 4.3 + seed * 1.7) * w * 0.5;
  const layer = (sc, col, lift) => {
    const hw = w * 0.5 * sc, hh = H * sc, yb = y - lift;
    ctx.beginPath();
    ctx.moveTo(x - hw, yb);
    ctx.bezierCurveTo(x - hw * 1.15, yb - hh * 0.42, x + sway * 0.35 - hw * 0.4, yb - hh * 0.72, x + sway, yb - hh);
    ctx.bezierCurveTo(x + sway * 0.35 + hw * 0.5, yb - hh * 0.66, x + hw * 1.15, yb - hh * 0.4, x + hw, yb);
    ctx.quadraticCurveTo(x, yb + hw * 0.7, x - hw, yb);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
  };
  layer(1, rgba('#F2471C', 0.9 * a), 0);
  layer(0.74, rgba('#FF8A22', a), 0);
  layer(0.5, rgba('#FFC73F', a), h * 0.02);
  layer(0.26, rgba('#FFF4C8', a), h * 0.03);
}

// cloud-cluster puff (smoke / steam / dust)
const PUFF_PAL = {
  steam: { base: '#FFFFFF', dark: '#E1EDF2', light: '#FFFFFF', line: '#C3D7E0' },
  white: { base: '#FAFBFC', dark: '#DCE3EA', light: '#FFFFFF', line: '#B5C1CC' },
  grey: { base: '#B4B0BA', dark: '#94909E', light: '#D6D2DC', line: '#7C7886' },
  dark: { base: '#706C78', dark: '#57535F', light: '#8F8B98', line: '#423E4A' },
  dust: { base: '#E2CDA6', dark: '#C8AD84', light: '#F5E9D0', line: '#A88E64' },
  soot: { base: '#7E7A84', dark: '#6E6A76', light: '#97939E', line: '#6A6672' },
};
const PUFF_SHAPES = new Map();
function puffShape(seed) {
  const key = Math.round(seed * 1000);
  let c = PUFF_SHAPES.get(key);
  if (c) return c;
  const R = rng(seed * 7.13 + 1);
  c = [[0, 0.04, 0.58]];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = PI * 1.06 + (i / (n - 1)) * PI * 0.88 + R.range(-0.12, 0.12);
    const d = R.range(0.42, 0.56);
    c.push([Math.cos(a) * d * 1.12, Math.sin(a) * d * 0.9 + 0.06, R.range(0.27, 0.4)]);
  }
  c.push([-0.48, 0.22, R.range(0.27, 0.32)], [0.5, 0.2, R.range(0.27, 0.32)], [-0.15, 0.3, 0.33], [0.2, 0.3, 0.32]);
  PUFF_SHAPES.set(key, c);
  return c;
}
function puff(ctx, x, y, r, seed, pal, a = 1, lw = 1.4, churn = 0) {
  if (r <= 0.3 || a <= 0.005) return;
  const cs = puffShape(seed);
  // every layer is ONE union fill (no per-circle strokes), so a translucent puff never
  // shows the seams of its overlapping circles
  const path = (sc = 1, dx = 0, dy = 0, from = 0, to = cs.length, grow = 0) => {
    ctx.beginPath();
    for (let i = from; i < to; i++) {
      const [cx, cy, cr] = cs[i];
      const wob = churn ? 1 + 0.05 * Math.sin(churn * 2.1 + i * 1.7) : 1;
      const px = x + (cx * r + dx), py = y + (cy * r + dy), pr = cr * r * sc * wob + grow;
      ctx.moveTo(px + pr, py);
      ctx.arc(px, py, pr, 0, TAU);
    }
  };
  ctx.save();
  const ga = ctx.globalAlpha;
  // outline = the union inflated by the line width, drawn under the body
  ctx.globalAlpha = ga * a * a;
  path(1, 0, 0, 0, cs.length, lw);
  ctx.fillStyle = pal.line;
  ctx.fill();
  // body: one gradient fill (lit top → shaded bottom); no clip needed (cheap)
  ctx.globalAlpha = ga * a;
  path();
  const g = ctx.createLinearGradient(0, y - r * 0.55, 0, y + r * 0.6);
  g.addColorStop(0, pal.base);
  g.addColorStop(0.55, pal.base);
  g.addColorStop(1, pal.dark);
  ctx.fillStyle = g;
  ctx.fill();
  // highlight lobes: the upper circles shrunk + nudged up-left, always inside the body
  path(0.6, -r * 0.05, -r * 0.085, 1, 8);
  ctx.fillStyle = pal.light;
  ctx.fill();
  ctx.restore();
}

function starPath(ctx, x, y, R, ri = 0.48, n = 5, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot - PI / 2 + (i / (n * 2)) * TAU;
    const rr = i % 2 ? R * ri : R;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}
function burstPath(ctx, n, rO, rI, seed, jag = 0.22, sx = 1, sy = 1) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * TAU - PI / 2 + (hash1(seed + i * 1.7) - 0.5) * 0.16;
    const rr = i % 2 === 0 ? rO * (1 - jag + jag * 2 * hash1(seed * 2.3 + i)) : rI * (0.88 + 0.24 * hash1(seed * 5.1 + i));
    const px = Math.cos(a) * rr * sx, py = Math.sin(a) * rr * sy;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}
// soft radial glow (no shadowBlur)
function glow(ctx, x, y, r, col, a) {
  if (a <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(0.4, rgba(col, a * 0.45));
  g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// ═════════════════════════════════════════════════════════════════════ ORANGE
function juicePuddle(ctx, cx, cy, rx, ry, seed, amt, k) {
  const R = rng(seed * 5.7 + 2);
  const pts = [];
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const sp = i % 2 ? R.range(0.72, 0.9) : R.range(1.0, 1.0 + 0.35 * amt);
    pts.push([cx + Math.cos(a) * rx * sp, cy + Math.sin(a) * ry * sp]);
  }
  const C = PROP_COLORS.orange;
  blob(ctx, pts, 0.8);
  const g = ctx.createRadialGradient(cx - rx * 0.2, cy - ry * 0.3, 0, cx, cy, rx);
  g.addColorStop(0, '#FFC64F');
  g.addColorStop(1, rgba(C.juice, 0.95));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = C.juiceLine;
  ctx.lineWidth = 1.1 * k;
  ctx.stroke();
  ellipse(ctx, cx - rx * 0.45, cy - ry * 0.25, rx * 0.16, ry * 0.18, -0.1);
  ctx.fillStyle = 'rgba(255,250,225,0.8)';
  ctx.fill();
  // beads around the puddle
  for (let i = 0; i < 5; i++) {
    const a = R.range(0, TAU), d = R.range(1.15, 1.45);
    const br = Math.max(0.6, ry * R.range(0.12, 0.22) * amt);
    circle(ctx, cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d * 1.2, br);
    ctx.fillStyle = C.juice;
    ctx.fill();
  }
}

function orangeLeaf(ctx, len, ang, k, sway, small) {
  ctx.save();
  ctx.rotate(ang + sway);
  const L = len * (small ? 0.7 : 1);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(L * 0.25, -L * 0.42, L * 0.7, -L * 0.48, L, -L * 0.2);
  ctx.bezierCurveTo(L * 0.7, L * 0.12, L * 0.3, L * 0.14, 0, 0);
  ctx.closePath();
  ctx.fillStyle = lin(ctx, 0, -L * 0.4, L * 0.6, L * 0.1, ['#9BDB78', '#4FA24C', '#357F3B']);
  ctx.fill();
  ctx.strokeStyle = '#2B6332';
  ctx.lineWidth = 1.1 * k;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(L * 0.06, -L * 0.02);
  ctx.quadraticCurveTo(L * 0.5, -L * 0.2, L * 0.92, -L * 0.19);
  ctx.strokeStyle = 'rgba(225,255,205,0.65)';
  ctx.lineWidth = 0.8 * k;
  ctx.stroke();
  ctx.beginPath();
  for (const u of [0.35, 0.6]) {
    ctx.moveTo(L * u, -L * 0.13 - u * 0.06 * L);
    ctx.lineTo(L * (u + 0.12), -L * 0.3);
  }
  ctx.strokeStyle = 'rgba(225,255,205,0.35)';
  ctx.lineWidth = 0.6 * k;
  ctx.stroke();
  ctx.restore();
}

function drawOrange(ctx, o = {}) {
  const { x = 0, y = 0, r = 16, rot = 0, t = 0, seed = 0, leaf = true, leaves = 1 } = o;
  const s = clamp(o.squash || 0);
  const se = ease.outCubic(s);
  const C = PROP_COLORS.orange;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (o.alpha != null && o.alpha < 1) ctx.globalAlpha *= clamp(o.alpha);
  const k = Math.pow(r / 16, 0.6);
  const rx = r * (1.04 + 0.5 * se), ryTop = r * (0.97 - 0.6 * se);
  const ryBot = ryTop * lerp(1, 0.78, s);
  const cy = r - ryBot;
  const top = cy - ryTop;
  const burst = smoothstep(0.22, 0.75, s);
  if (s > 0.12) {
    const pa = smoothstep(0.12, 0.6, s);
    juicePuddle(ctx, 0, r - 0.6, rx * (0.75 + 0.55 * pa), r * (0.1 + 0.16 * pa), seed + 1, pa, k);
  }
  const path = () => {
    const n = 20, pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, ca = Math.cos(a), sa = Math.sin(a);
      const j = 1 + (hash1(seed * 3.17 + i * 1.31) - 0.5) * (0.03 + 0.05 * burst);
      pts.push([ca * rx * j * (sa > 0 ? 1 + 0.05 * s : 1), cy + sa * (sa > 0 ? ryBot : ryTop) * j]);
    }
    blob(ctx, pts, 1);
  };
  // body
  ctx.save();
  path();
  const g = ctx.createRadialGradient(-rx * 0.34, cy - ryTop * 0.42, r * 0.06, 0, cy, Math.max(rx, ryTop) * 1.08);
  g.addColorStop(0, C.light);
  g.addColorStop(0.48, C.base);
  g.addColorStop(1, C.dark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  // peel pores: fine pits, each with a light lip on the lower right
  const R = rng(11 + seed);
  const nP = Math.round(clamp(r / 16, 0.6, 3) * 42);
  const dots = [];
  for (let i = 0; i < nP; i++) {
    const u = R() * 2 - 1, v = R() * 2 - 1;
    if (u * u + v * v > 0.9) continue;
    if ((u + 0.38) * (u + 0.38) + (v + 0.44) * (v + 0.44) < 0.06) continue;
    dots.push([u * rx * 0.95, cy + v * (v > 0 ? ryBot : ryTop) * 0.95, r * (0.016 + 0.01 * R())]);
  }
  ctx.beginPath();
  for (const [px, py, dr] of dots) { ctx.moveTo(px + dr * 1.4, py + dr * 0.5); ctx.arc(px + dr * 0.4, py + dr * 0.5, dr, 0, TAU); }
  ctx.fillStyle = 'rgba(255,214,150,0.45)';
  ctx.fill();
  ctx.beginPath();
  for (const [px, py, dr] of dots) { ctx.moveTo(px + dr, py); ctx.arc(px, py, dr, 0, TAU); }
  ctx.fillStyle = 'rgba(176,74,6,0.3)';
  ctx.fill();
  // core shadow (lower right) + warm bounce light along the bottom + light rim top-left
  const sg = ctx.createRadialGradient(rx * 0.55, cy + ryBot * 0.7, 0, rx * 0.55, cy + ryBot * 0.7, r * 1.25);
  sg.addColorStop(0, 'rgba(170,58,0,0.36)');
  sg.addColorStop(1, 'rgba(170,58,0,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(-rx * 1.2, cy - ryTop * 1.2, rx * 2.4, ryTop + ryBot * 2.4);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(0, cy, rx * 0.84, ryBot * 0.8, 0, 0.18 * PI, 0.72 * PI);
  ctx.strokeStyle = 'rgba(255,196,110,0.5)';
  ctx.lineWidth = r * 0.07;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, cy, rx * 0.9, ryTop * 0.9, 0, 1.08 * PI, 1.5 * PI);
  ctx.strokeStyle = 'rgba(255,238,200,0.55)';
  ctx.lineWidth = r * 0.055;
  ctx.stroke();
  ctx.restore();
  // gloss
  const gl = 1 - burst;
  if (gl > 0.02) {
    ellipse(ctx, -rx * 0.4, cy - ryTop * 0.44, rx * 0.26, ryTop * 0.14, -0.6);
    ctx.fillStyle = rgba('#FFFCEC', 0.85 * gl);
    ctx.fill();
    circle(ctx, -rx * 0.1, cy - ryTop * 0.67, r * 0.055);
    ctx.fill();
  }
  path();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1.7 * k;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // burst open: the top splits into a juicy cross-section with ragged peel flaps
  let leafX = 0, leafY = top + r * 0.04, leafA = -0.5;
  if (burst > 0) {
    const ccx = 0, ccy = top + ryTop * 0.3 + r * 0.04;
    const crx = rx * 0.86 * burst, cry = Math.max(r * 0.12, crx * 0.3);
    // ragged peel flaps around the rim
    ctx.beginPath();
    const nf = 13;
    for (let i = 0; i <= nf * 2; i++) {
      const a = (i / (nf * 2)) * TAU;
      const sp = i % 2 ? 1.0 : 1.12 + 0.12 * hash1(seed + i * 2.3);
      const px = ccx + Math.cos(a) * crx * sp, py = ccy + Math.sin(a) * cry * sp * (Math.sin(a) < 0 ? 1.25 : 1);
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = C.base;
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1.3 * k;
    ctx.lineJoin = 'round';
    ctx.stroke();
    // pith ring + pulp
    ellipse(ctx, ccx, ccy, crx * 0.93, cry * 0.9);
    ctx.fillStyle = '#FFF1D2';
    ctx.fill();
    ellipse(ctx, ccx, ccy + cry * 0.03, crx * 0.84, cry * 0.8);
    const pg = ctx.createRadialGradient(ccx - crx * 0.2, ccy - cry * 0.2, 0, ccx, ccy, crx);
    pg.addColorStop(0, '#FFCF6A');
    pg.addColorStop(1, '#FF9F2A');
    ctx.fillStyle = pg;
    ctx.fill();
    // segment wedges (membranes)
    ctx.beginPath();
    const nseg = 10;
    for (let i = 0; i < nseg; i++) {
      const a = (i / nseg) * TAU + 0.15;
      ctx.moveTo(ccx + Math.cos(a) * crx * 0.12, ccy + Math.sin(a) * cry * 0.12);
      ctx.lineTo(ccx + Math.cos(a) * crx * 0.82, ccy + Math.sin(a) * cry * 0.78);
    }
    ctx.strokeStyle = 'rgba(255,240,205,0.95)';
    ctx.lineWidth = Math.max(0.6, r * 0.045) * burst;
    ctx.stroke();
    ellipse(ctx, ccx, ccy, crx * 0.13, cry * 0.15);
    ctx.fillStyle = '#FFF4D8';
    ctx.fill();
    // juicy glints
    ctx.fillStyle = 'rgba(255,255,240,0.85)';
    for (let i = 0; i < 4; i++) {
      const a = 3.6 + i * 0.5;
      ellipse(ctx, ccx + Math.cos(a) * crx * 0.5, ccy + Math.sin(a) * cry * 0.45, r * 0.06 * burst, r * 0.03 * burst, 0.1);
      ctx.fill();
    }
    // drips running down the peel
    for (let i = 0; i < 3; i++) {
      const dx = (i - 1) * crx * 0.55 + (hash1(seed + i) - 0.5) * r * 0.2;
      const L = r * (0.15 + 0.25 * hash1(seed * 3 + i)) * burst;
      dropPath(ctx, dx, ccy + cry * 0.9 + L, r * 0.06 * burst + 0.3, 0, (L / (r * 0.06 * burst + 0.3)) * 0.9);
      ctx.fillStyle = '#FFB13B';
      ctx.fill();
    }
    leafX = -crx * 0.95;
    leafY = ccy - cry * 0.4;
    leafA = -2.2 - burst * 0.9;
  }
  // stem + leaf
  if (leaf) {
    ctx.save();
    ctx.translate(leafX, leafY);
    const sway = Math.sin(t * 1.7 + seed) * 0.06;
    if (burst < 0.5) {
      starPath(ctx, 0, 0, r * 0.13, 0.45, 5, 0.3);
      ctx.fillStyle = '#6E7A2E';
      ctx.fill();
      ctx.strokeStyle = '#3F4A18';
      ctx.lineWidth = 0.8 * k;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(r * 0.03, -r * 0.14, r * 0.1, -r * 0.2);
      ctx.strokeStyle = '#5C4A22';
      ctx.lineWidth = r * 0.07;
      ctx.lineCap = 'round';
      ctx.stroke();
      if (leaves > 1) orangeLeaf(ctx, r * 0.95, -2.4, k, -sway, true);
      ctx.translate(r * 0.08, -r * 0.15);
      orangeLeaf(ctx, r * 0.95, -0.5, k, sway, false);
    } else {
      orangeLeaf(ctx, r * 0.9, leafA + PI * 0.15, k, sway * 0.3, false);
    }
    ctx.restore();
  }
  ctx.restore();
}

// ═════════════════════════════════════════════════════════════════════ JUICE SPLAT
function drawJuiceSplat(ctx, o = {}) {
  const { x = 0, y = 0, r = 24, t = 0.15, seed = 3, rot = 0, life = 1.2, gravity = 1 } = o;
  if (t < 0) return;
  const C = PROP_COLORS.orange;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (o.alpha != null && o.alpha < 1) ctx.globalAlpha *= clamp(o.alpha);
  const k = Math.pow(r / 24, 0.6);
  const g = 15 * r * gravity;
  if (o.puddle) {
    const pp = ease.outCubic(clamp(t / 0.3));
    juicePuddle(ctx, 0, o.floor || 0, r * (0.5 + 1.3 * pp), r * (0.12 + 0.26 * pp), seed + 7, 1, k);
  }
  // mist ring
  if (t < 0.3) {
    const p = t / 0.3;
    ellipse(ctx, 0, 0, r * (0.7 + 1.5 * ease.outCubic(p)), r * (0.5 + 1.0 * ease.outCubic(p)));
    ctx.strokeStyle = rgba('#FFE3A0', 0.6 * (1 - p));
    ctx.lineWidth = r * 0.09 * (1 - p);
    ctx.stroke();
  }
  // the splash itself: pops out, then shrinks back into droplets
  const grow = ease.outBack(clamp(t / 0.07), 1.6);
  const fade = 1 - smoothstep(0.1, 0.36, t);
  if (fade > 0) {
    ctx.save();
    ctx.globalAlpha *= Math.min(1, fade * 1.6);
    const sc = (0.3 + 0.75 * grow) * (0.7 + 0.3 * fade);
    const gg = ctx.createRadialGradient(-r * 0.15, -r * 0.15, 0, 0, 0, r * sc * 1.3);
    gg.addColorStop(0, '#FFF0B0');
    gg.addColorStop(0.4, '#FFC447');
    gg.addColorStop(1, C.juice);
    splashShape(ctx, r * sc, seed, gg, C.juiceLine, 1.1 * k, 1.15, 0.8);
    ellipse(ctx, -r * sc * 0.16, -r * sc * 0.14, r * sc * 0.2, r * sc * 0.09, -0.35);
    ctx.fillStyle = 'rgba(255,255,240,0.8)';
    ctx.fill();
    ctx.restore();
  }
  const tl = t / life;
  if (tl < 1) {
    const R = rng(seed * 13.7 + 5);
    // droplets
    for (let i = 0; i < 16; i++) {
      const a = -PI / 2 + R.range(-1.45, 1.45) + (i % 6 === 0 ? R.range(-0.6, 0.6) : 0);
      const v = r * R.range(3, 8.5);
      const dr = r * R.range(0.055, 0.13);
      const lag = R.range(0, 0.04);
      const tt = t - lag;
      if (tt <= 0) continue;
      const vx = Math.cos(a) * v, vy0 = Math.sin(a) * v;
      const px = vx * tt, py = vy0 * tt + 0.5 * g * tt * tt;
      const vy = vy0 + g * tt;
      const sz = dr * (1 - tl * 0.6);
      const spd = Math.hypot(vx, vy) / r;
      dropPath(ctx, px, py, sz, trailAng(vx, vy), 1.6 + Math.min(2.4, spd * 0.22));
      ctx.fillStyle = i % 3 ? C.juice : '#FFBE45';
      ctx.fill();
      ctx.strokeStyle = rgba(C.juiceLine, 0.8);
      ctx.lineWidth = 0.7 * k;
      ctx.stroke();
      circle(ctx, px - sz * 0.35, py - sz * 0.3, sz * 0.3);
      ctx.fillStyle = 'rgba(255,255,235,0.85)';
      ctx.fill();
    }
    // pulp flecks
    const fa = 1 - smoothstep(0.25, 0.6, t);
    if (fa > 0) {
      for (let i = 0; i < 7; i++) {
        const a = -PI / 2 + R.range(-1.6, 1.6), v = r * R.range(2, 5);
        const px = Math.cos(a) * v * t, py = Math.sin(a) * v * t + 0.5 * g * 0.8 * t * t;
        ellipse(ctx, px, py, r * 0.07, r * 0.035, a + t * 6);
        ctx.fillStyle = rgba('#FFF0BC', fa);
        ctx.fill();
      }
    }
    // two peel chips tumbling away
    const ca = 1 - smoothstep(0.45, 0.75, t);
    for (let i = 0; i < 2 && ca > 0; i++) {
      const a = -PI / 2 + (i ? 1 : -1) * R.range(0.5, 1.0), v = r * R.range(4, 5.5);
      const px = Math.cos(a) * v * t, py = Math.sin(a) * v * t + 0.5 * g * t * t;
      ctx.save();
      ctx.globalAlpha *= ca;
      ctx.translate(px, py);
      ctx.rotate(a + t * R.range(8, 14) * (i % 2 ? 1 : -1));
      const cr = r * R.range(0.18, 0.24);
      ctx.beginPath();
      ctx.arc(0, cr * 0.6, cr, -PI * 0.85, -PI * 0.15);
      ctx.arc(0, cr * 0.95, cr * 0.85, -PI * 0.2, -PI * 0.8, true);
      ctx.closePath();
      ctx.fillStyle = C.base;
      ctx.fill();
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 0.9 * k;
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

// ═════════════════════════════════════════════════════════════════════ HELMET
function drawHelmet(ctx, o = {}) {
  const B = begin(ctx, o);
  const C = PROP_COLORS.helmet;
  ctx.scale(0.82, 0.82);
  const k = B.k / 0.82;
  if (o.strap !== false) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#26262E';
    ctx.lineWidth = 2.8 * k;
    ctx.beginPath();
    ctx.moveTo(-15, -4);
    ctx.bezierCurveTo(-14, 10, -4, 22, 2, 26);
    ctx.moveTo(23, -3);
    ctx.bezierCurveTo(22, 10, 14, 22, 8, 26);
    ctx.stroke();
    roundRect(ctx, -1.5, 23, 12, 7, 2);
    ctx.fillStyle = '#5A5A66';
    ctx.fill();
    ctx.strokeStyle = '#26262E';
    ctx.lineWidth = 1 * k;
    ctx.stroke();
    ctx.restore();
  }
  const shell = () => {
    ctx.beginPath();
    ctx.moveTo(-43, -4);
    ctx.bezierCurveTo(-35, -21, -14, -34, 8, -34);
    ctx.bezierCurveTo(29, -34, 42, -22, 42, -7);
    ctx.quadraticCurveTo(42, -1, 36, -1.5);
    ctx.bezierCurveTo(18, -7.5, -12, -8.5, -36, 0);
    ctx.quadraticCurveTo(-42, 1, -43, -4);
    ctx.closePath();
  };
  // inner padding peeking under the rim
  ctx.beginPath();
  ctx.moveTo(-34, 0.5);
  ctx.bezierCurveTo(-12, -6, 18, -5, 35, 0);
  ctx.strokeStyle = '#3A3A44';
  ctx.lineWidth = 3.2 * k;
  ctx.lineCap = 'round';
  ctx.stroke();
  paint(ctx, shell, {
    fill: lin(ctx, 0, -34, 0, 0, [C.top, '#E2463F', C.bottom]), hi: C.hi, rim: B.rim, line: C.line, lw: 1.9 * k,
    extra: () => {
      const vents = [[-24, -19, -0.72, 15], [-8, -26.5, -0.32, 17], [10.5, -28.5, 0.06, 17], [27, -23, 0.52, 14], [36, -13, 1.05, 8]];
      for (const [vx, vy, a, L] of vents) {
        ctx.save();
        ctx.translate(vx, vy);
        ctx.rotate(a);
        roundRect(ctx, -L / 2, -2.7, L, 5.4, 2.7);
        ctx.fillStyle = '#4E1210';
        ctx.fill();
        roundRect(ctx, -L / 2 + 1.6, 0.6, L - 3.2, 1.5, 0.75);
        ctx.fillStyle = 'rgba(255,170,160,0.35)';
        ctx.fill();
        ctx.restore();
      }
      // lower body shade
      ctx.fillStyle = lin(ctx, 0, -12, 0, 0, ['rgba(120,10,10,0)', 'rgba(120,10,10,0.3)']);
      ctx.fillRect(-50, -14, 100, 16);
      // white racing stripe
      ctx.beginPath();
      ctx.moveTo(-38, -6.5);
      ctx.bezierCurveTo(-16, -13.5, 18, -15, 41, -10);
      ctx.strokeStyle = '#FFF4E8';
      ctx.lineWidth = 2.6 * k;
      ctx.lineCap = 'round';
      ctx.stroke();
      ellipse(ctx, 2, -30, 12, 2.4, -0.04);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
    },
  });
  // rim band
  ctx.beginPath();
  ctx.moveTo(-37, -0.6);
  ctx.bezierCurveTo(-12, -9, 18, -8, 36, -2);
  ctx.strokeStyle = '#2F2F38';
  ctx.lineWidth = 2.8 * k;
  ctx.lineCap = 'round';
  ctx.stroke();
  // visor
  ctx.beginPath();
  ctx.moveTo(35, -13);
  ctx.quadraticCurveTo(47, -14, 53, -7.5);
  ctx.quadraticCurveTo(45, -8.5, 38, -6.5);
  ctx.closePath();
  ctx.fillStyle = '#2B2B33';
  ctx.fill();
  ctx.strokeStyle = '#17171C';
  ctx.lineWidth = 1 * k;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(38, -12);
  ctx.quadraticCurveTo(46, -12.5, 50, -9);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 0.9 * k;
  ctx.stroke();
  ctx.restore();
}

// ═════════════════════════════════════════════════════════════════════ THERMOMETER
const thermoLevel = (c, lo = 30, hi = 45) => clamp((c - lo) / (hi - lo));
const TH = { hw: 5.6, rb: 9.6, bore: 1.75 };
function thermoGeom(o) {
  const L = o.length || 100;
  const yLo = -15, yHi = -L + 10;
  return { L, yLo, yHi, yc: (lv) => lerp(yLo, yHi, clamp(lv)) };
}
function thermoState(o) {
  const b = clamp(o.broken || 0);
  const popAt = 0.16;
  const atTop = o.breakAt === 'top';
  let level = clamp(o.level != null ? o.level : 0.5);
  // the column surges to the top before the pop (surge:false keeps the given level)
  if (o.surge !== false) level = lerp(level, 1, smoothstep(0, popAt * 0.85, b));
  if (!atTop) level *= 1 - smoothstep(popAt, 0.62, b);
  return { b, popAt, atTop, level, popped: b >= popAt, tau: b >= popAt ? (b - popAt) / (1 - popAt) : 0 };
}
function thermoAnchors(o = {}) {
  const P = xform(o), G = thermoGeom(o), st = thermoState(o);
  const yc = G.yc(st.level);
  return { bulb: P(0, 0), top: P(0, -G.L), column: P(0, yc), tag: P((o.tagSide === 'left' ? -1 : 1) * (TH.hw + 8), yc) };
}
function glassShards(ctx, cx, cy, tau, seed, k, n, spread, upBias, speed = 1) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = upBias + R.range(-spread, spread);
    const v = R.range(50, 125) * speed;
    const px = cx + Math.cos(a) * (TH.rb * 0.7 + v * tau), py = cy + Math.sin(a) * (TH.rb * 0.7 + v * tau) + 0.5 * 260 * tau * tau;
    const sz = R.range(2.2, 4.6);
    const al = 1 - smoothstep(0.7, 1, tau);
    if (al <= 0) continue;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(R.range(0, TAU) + tau * R.range(-14, 14));
    ctx.beginPath();
    ctx.moveTo(0, -sz);
    ctx.lineTo(sz * R.range(0.5, 0.9), sz * R.range(0.2, 0.7));
    ctx.lineTo(-sz * R.range(0.4, 0.8), sz * R.range(0.3, 0.8));
    ctx.closePath();
    ctx.fillStyle = rgba('#E6F6FF', 0.85 * al);
    ctx.fill();
    ctx.strokeStyle = rgba(PROP_COLORS.glass, al);
    ctx.lineWidth = 0.7 * k;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-sz * 0.2, -sz * 0.5);
    ctx.lineTo(sz * 0.15, sz * 0.2);
    ctx.strokeStyle = rgba('#FFFFFF', al);
    ctx.stroke();
    ctx.restore();
  }
}
function redSpray(ctx, cx, cy, tau, seed, k, n, spread, dirA, speed = 1) {
  const R = rng(seed);
  const red = PROP_COLORS.red;
  for (let i = 0; i < n; i++) {
    const a = dirA + R.range(-spread, spread);
    const v = R.range(40, 160) * speed;
    const vx = Math.cos(a) * v, vy0 = Math.sin(a) * v;
    const px = cx + vx * tau, py = cy + vy0 * tau + 0.5 * 280 * tau * tau;
    const sz = R.range(0.9, 2.3) * (1 - tau * 0.55);
    const al = 1 - smoothstep(0.75, 1, tau);
    if (al <= 0) continue;
    dropPath(ctx, px, py, sz, trailAng(vx, vy0 + 280 * tau), 1.8 + v / 70);
    ctx.fillStyle = rgba(i % 3 ? red : '#FF6A55', al);
    ctx.fill();
  }
}
function drawThermometer(ctx, o = {}) {
  const B = begin(ctx, o);
  const k = B.k;
  const G = thermoGeom(o), st = thermoState(o);
  const { hw, rb, bore } = TH;
  const t = o.t || 0;
  const labels = o.labels != null ? o.labels : B.s >= 2.2;
  const glassLine = PROP_COLORS.glass;
  const red = PROP_COLORS.red;
  // trembling + swelling right before the pop
  const pre = st.popped ? 0 : smoothstep(0.02, st.popAt, st.b);
  const jig = pre * 0.9;
  const topY = -G.L;
  const breakTop = st.atTop && st.popped;
  const breakBulb = !st.atTop && st.popped;
  ctx.save();
  if (jig) ctx.translate(noise1(t * 60 + 1) * jig, noise1(t * 57 + 7) * jig * 0.6);
  // ---- tube glass
  const tubeTop = breakTop ? topY + 12 : topY;
  const tube = () => {
    ctx.beginPath();
    ctx.moveTo(-hw, -4);
    if (breakTop) {
      ctx.lineTo(-hw, tubeTop + 1);
      const jag = [[-hw, tubeTop + 1], [-2.6, tubeTop - 3.5], [-0.8, tubeTop + 0.5], [1.4, tubeTop - 4.5], [3.1, tubeTop], [hw, tubeTop - 2]];
      for (const [jx, jy] of jag) ctx.lineTo(jx, jy);
    } else {
      ctx.lineTo(-hw, topY + hw);
      ctx.arc(0, topY + hw, hw, PI, 0);
    }
    ctx.lineTo(hw, -4);
    ctx.closePath();
  };
  tube();
  ctx.fillStyle = lin(ctx, -hw, 0, hw, 0, [[0, 'rgba(176,206,224,0.95)'], [0.3, 'rgba(244,251,255,0.95)'], [0.7, 'rgba(232,245,252,0.95)'], [1, 'rgba(170,198,216,0.95)']]);
  ctx.fill();
  // scale ticks
  ctx.beginPath();
  const nT = 15;
  for (let i = 0; i <= nT; i++) {
    const yy = lerp(G.yLo, G.yHi, i / nT);
    const long = i % 5 === 0;
    ctx.moveTo(bore + 0.9, yy);
    ctx.lineTo(bore + (long ? 3.8 : 2.4), yy);
  }
  ctx.strokeStyle = 'rgba(70,95,115,0.75)';
  ctx.lineWidth = 0.6 * k;
  ctx.stroke();
  // bore
  roundRect(ctx, -bore, G.yHi - 4, bore * 2, -G.yHi, bore);
  ctx.fillStyle = 'rgba(205,225,238,0.9)';
  ctx.fill();
  // red column
  const yc = G.yc(st.level);
  if (st.level > 0.004 || !breakBulb) {
    const yBottom = breakBulb ? -3 : 0;
    roundRect(ctx, -bore, yc, bore * 2, yBottom - yc, bore);
    ctx.fillStyle = lin(ctx, -bore, 0, bore, 0, ['#FF7A6E', red, '#B32019']);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-bore * 0.35, yc + 2);
    ctx.lineTo(-bore * 0.35, yBottom - 2);
    ctx.strokeStyle = 'rgba(255,200,190,0.75)';
    ctx.lineWidth = 0.6 * k;
    ctx.stroke();
  }
  // glass highlights + outline
  ctx.beginPath();
  ctx.moveTo(-hw * 0.55, -12);
  ctx.lineTo(-hw * 0.55, tubeTop + 7);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 1.3 * k;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(hw * 0.62, -16);
  ctx.lineTo(hw * 0.62, -G.L * 0.45);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 0.7 * k;
  ctx.stroke();
  tube();
  ctx.strokeStyle = glassLine;
  ctx.lineWidth = 1.25 * k;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // little hanging ring at the top
  if (!breakTop) {
    ctx.beginPath();
    ctx.arc(0, topY - 2.6, 2.4, 0, TAU);
    ctx.strokeStyle = '#9AA6B0';
    ctx.lineWidth = 1.1 * k;
    ctx.stroke();
  }
  // printed numbers
  if (labels) {
    ctx.fillStyle = '#3C5062';
    ctx.font = `600 5.2px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 3; i++) {
      const yy = lerp(G.yLo, G.yHi, i / 3);
      ctx.save();
      ctx.translate(-hw - 1.6, yy);
      if (o.flip) ctx.scale(-1, 1);
      ctx.textAlign = o.flip ? 'left' : 'right';
      // printed on a frosted decal so the numbers read over any background
      ctx.strokeStyle = 'rgba(236,247,253,0.85)';
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.strokeText(String(30 + i * 5), 0, 0);
      ctx.fillText(String(30 + i * 5), 0, 0);
      ctx.restore();
    }
  }
  // ---- bulb
  if (!breakBulb) {
    const sw = 1 + pre * 0.14 + (pre > 0 ? Math.sin(t * 70) * 0.025 * pre : 0);
    ctx.save();
    ctx.scale(sw, sw);
    circle(ctx, 0, 0, rb);
    ctx.fillStyle = 'rgba(232,246,255,0.95)';
    ctx.fill();
    circle(ctx, 0, 0, rb - 1.9);
    const bg = ctx.createRadialGradient(-2.5, -2.8, 0.5, 0, 0, rb);
    bg.addColorStop(0, '#FF8C80');
    bg.addColorStop(0.55, red);
    bg.addColorStop(1, '#A51D16');
    ctx.fillStyle = bg;
    ctx.fill();
    circle(ctx, 0, 0, rb);
    ctx.strokeStyle = glassLine;
    ctx.lineWidth = 1.25 * k;
    ctx.stroke();
    ellipse(ctx, -3.2, -3.4, 2.6, 1.5, -0.7);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    circle(ctx, 3.6, 3.3, 0.9);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
    if (pre > 0.15 && !st.atTop) {
      // cracks spreading over the bulb
      const cr = smoothstep(0.15, 1, pre);
      ctx.beginPath();
      const cracks = [[-1, -rb, 1, -3, -2, 2], [rb * 0.9, -3, 3, -1, 4, 3], [-rb * 0.8, 3, -3, 1, -1, 5]];
      for (const [ax, ay, bx, by, cx2, cy2] of cracks) {
        ctx.moveTo(ax, ay);
        ctx.lineTo(lerp(ax, bx, cr), lerp(ay, by, cr));
        if (cr > 0.5) ctx.lineTo(lerp(bx, cx2, (cr - 0.5) * 2), lerp(by, cy2, (cr - 0.5) * 2));
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 0.8 * k;
      ctx.stroke();
    }
    ctx.restore();
  } else {
    // jagged broken stub where the bulb was
    ctx.beginPath();
    ctx.moveTo(-hw, -6);
    const jag = [[-hw - 1.4, -1], [-3, -3.6], [-1.2, 1.6], [0.8, -2.6], [2.8, 0.8], [hw + 1, -2.2], [hw, -6]];
    for (const [jx, jy] of jag) ctx.lineTo(jx, jy);
    ctx.closePath();
    ctx.fillStyle = 'rgba(232,246,255,0.95)';
    ctx.fill();
    ctx.strokeStyle = glassLine;
    ctx.lineWidth = 1.1 * k;
    ctx.stroke();
    // drips while draining
    const tau = st.tau;
    for (let i = 0; i < 3; i++) {
      const p = frac(tau * 2.4 + i / 3);
      const on = 1 - smoothstep(0.45, 0.7, tau);
      if (on <= 0) break;
      dropPath(ctx, (i - 1) * 1.6, 1 + p * p * 34, 1.5 * on, 0, 2.2);
      ctx.fillStyle = rgba(red, on * (1 - p * 0.5));
      ctx.fill();
    }
  }
  // ---- the pop
  if (st.popped) {
    const tau = st.tau;
    const cx = 0, cy = breakTop ? tubeTop - 2 : 0;
    if (tau < 0.2) {
      const p = tau / 0.2;
      glow(ctx, cx, cy, rb * (2.5 + 2 * p), '#FFF6D0', 0.9 * (1 - p));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(0.2);
      burstPath(ctx, 8, rb * (1.2 + 1.5 * ease.outCubic(p)), rb * (0.45 + 0.4 * p), 4.2, 0.3);
      ctx.fillStyle = rgba('#FFFDF0', 1 - p);
      ctx.fill();
      ctx.restore();
    }
    if (tau < 0.34) {
      const p = tau / 0.34;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalAlpha *= 1 - smoothstep(0.5, 1, p);
      const sc = 0.6 + 1.1 * ease.outCubic(p);
      splashShape(ctx, rb * sc, 9.1, lin(ctx, 0, -rb, 0, rb, ['#FF7A6E', red]), '#8E1E18', 0.8 * k, 1.1, breakTop ? 1.1 : 0.85);
      ctx.restore();
    }
    if (breakTop) {
      // the cap flies off, spinning
      const cxp = Math.sin(1.3) * 40 * tau, cyp = cy - 120 * tau + 0.5 * 300 * tau * tau;
      if (tau < 0.9) {
        ctx.save();
        ctx.translate(cxp, cyp);
        ctx.rotate(tau * 16);
        ctx.beginPath();
        ctx.moveTo(-hw, 4);
        ctx.lineTo(-hw, -2);
        ctx.arc(0, -2, hw, PI, 0);
        ctx.lineTo(hw, 3);
        ctx.lineTo(1.5, 5);
        ctx.lineTo(-1, 2.5);
        ctx.closePath();
        ctx.fillStyle = 'rgba(232,246,255,0.95)';
        ctx.fill();
        ctx.strokeStyle = glassLine;
        ctx.lineWidth = 1 * k;
        ctx.stroke();
        ctx.restore();
      }
      redSpray(ctx, cx, cy, tau, 31, k, 24, 0.55, -PI / 2, 1.3);
      glassShards(ctx, cx, cy, tau, 17, k, 7, 1.0, -PI / 2, 0.9);
    } else {
      redSpray(ctx, cx, cy, tau, 29, k, 26, 1.9, -PI / 2, 1);
      glassShards(ctx, cx, cy, tau, 13, k, 11, 2.2, -PI / 2, 1);
    }
  }
  ctx.restore();
  // ---- reading tag (kept upright)
  if (o.reading != null && o.showTag !== false) {
    const side = o.tagSide === 'left' ? -1 : 1;
    const txt = String(o.reading) + '°';
    const fs = o.tagSize || 13;
    const tw = textW(txt, fs, 700);
    const ax = side * (hw + 1.5), ay = yc;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.scale(B.f, 1);
    ctx.rotate(-(o.rot || 0));
    const sd = side * B.f;
    const bw = tw + fs * 0.9, bh = fs * 1.45, bx = sd > 0 ? fs * 0.55 : -fs * 0.55 - bw;
    // pointer + card
    const card = () => {
      roundRect(ctx, bx, -bh / 2, bw, bh, bh * 0.32);
    };
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(bx + (sd > 0 ? 1 : bw - 1), -bh * 0.26);
    ctx.lineTo(bx + (sd > 0 ? 1 : bw - 1), bh * 0.26);
    ctx.closePath();
    ctx.fillStyle = '#B32019';
    ctx.fill();
    roundRect(ctx, bx + 0.8, -bh / 2 + 1.4, bw, bh, bh * 0.32);
    ctx.fillStyle = 'rgba(60,20,20,0.25)';
    ctx.fill();
    paint(ctx, card, {
      fill: lin(ctx, 0, -bh / 2, 0, bh / 2, ['#FFFFFF', '#FFF1E6']), hi: '#FFFFFF', rim: [0.6, 1.2], line: '#B32019', lw: 1.3 * B.k,
    });
    paintText(ctx, txt, bx + bw / 2, 0.5, fs, { color: '#C42A20', jitter: 0, seed: 3, dy0: 0.02 });
    ctx.restore();
  }
  ctx.restore();
}

// ═════════════════════════════════════════════════════════════════════ SIGN
function splitLines(o) {
  let lines;
  if (o.lines) lines = o.lines.map(String);
  else lines = String(o.text != null ? o.text : 'EXIT').split(/\n|\s+(?:\/|—|–|--)\s+/);
  lines = lines.map((s) => s.trim()).filter((s) => s.length);
  if (!lines.length) lines = [''];
  if (o.wrap !== false && !o.lines && lines.length === 1 && lines[0].length > 16) {
    const L = lines[0];
    let best = -1;
    const re = /[.,!?]\s+/g;
    let m;
    while ((m = re.exec(L))) {
      const at = m.index + 1;
      if (best < 0 || Math.abs(at - L.length / 2) < Math.abs(best - L.length / 2)) best = at;
    }
    if (best > 0) lines = [L.slice(0, best).trim(), L.slice(best).trim()];
  }
  return lines;
}
function signLayout(o = {}) {
  const lines = splitLines(o);
  const style = o.style || 'wood';
  const arrow = style === 'arrow';
  const glyph = !arrow && !!o.glyph && lines.length === 1;
  const weight = o.weight || 700;
  const rel = lines.map((l, i) => (o.sizes && o.sizes[i] != null ? o.sizes[i] : i > 0 && /[a-z]/.test(l) ? 0.66 : 1));
  const w1 = lines.map((l, i) => textW(l, 1, weight) * rel[i]);
  const h1 = rel.map((r) => r * 1.16);
  const sumH1 = h1.reduce((a, b) => a + b, 0);
  const maxW1 = Math.max(0.0001, ...w1.map((w, i) => w + (glyph && i === 0 ? 1.25 : 0)));
  let base = o.size || 24;
  const padXk = 0.62, padYk = arrow ? 0.34 : 0.3;
  const planks = !arrow && lines.length > 1;
  const gapsK = planks ? 0.12 * (lines.length - 1) : 0;
  const pointK = (h) => (arrow ? h * 0.42 : 0);
  let w = o.w, h = o.h;
  if (h != null && w == null) {
    base = h / (sumH1 + 2 * padYk * (planks ? lines.length : 1) + gapsK);
  } else if (w != null && h == null) {
    const hEst = (b) => b * (sumH1 + 2 * padYk * (planks ? lines.length : 1) + gapsK);
    base = Math.min(base * 1.3, (w - pointK(hEst(base))) / (maxW1 + 2 * padXk));
  } else if (w != null && h != null) {
    const bh = h / (sumH1 + 2 * padYk * (planks ? lines.length : 1) + gapsK);
    const bw = (w - pointK(h)) / (maxW1 + 2 * padXk);
    base = Math.min(bh, bw);
  }
  if (h == null) h = base * (sumH1 + 2 * padYk * (planks ? lines.length : 1) + gapsK);
  const point = pointK(h);
  if (w == null) w = base * (maxW1 + 2 * padXk) + point;
  return { lines, rel, sizes: rel.map((r) => r * base), base, w, h, point, arrow, glyph, planks, weight, gap: base * 0.12 };
}
function signStake(o, L) {
  const s = o.stake != null ? o.stake : 30;
  const drive = o.drive != null ? clamp(o.drive) : 1;
  return s + (1 - drive) * 28 + (L.h > 90 ? 6 : 0);
}
function signAnchors(o = {}) {
  const L = signLayout(o), P = xform(o);
  const yb = -signStake(o, L);
  return { top: P(0, yb - L.h), center: P(0, yb - L.h / 2), ground: P(0, 0), left: P(-L.w / 2, yb - L.h / 2), right: P(L.w / 2, yb - L.h / 2), w: L.w * (o.scale || 1), h: L.h * (o.scale || 1) };
}
function signWobble(dt, amp = 0.08) {
  if (dt < 0) return 0;
  return amp * Math.exp(-dt * 5) * Math.sin(dt * 26);
}
function woodGrain(ctx, x0, x1, y0, y1, seed, k, col) {
  const R = rng(seed * 9.1 + 3);
  const h = y1 - y0;
  ctx.beginPath();
  const n = Math.max(2, Math.round(h / 7));
  for (let i = 0; i < n; i++) {
    const gy = y0 + ((i + 0.6 + R.range(-0.2, 0.2)) / n) * h;
    const xa = x0 + R.range(2, 14), xb = x1 - R.range(4, (x1 - x0) * 0.35);
    ctx.moveTo(xa, gy);
    ctx.bezierCurveTo(lerp(xa, xb, 0.33), gy + R.range(-2.5, 2.5), lerp(xa, xb, 0.66), gy + R.range(-2.5, 2.5), xb, gy + R.range(-1, 1));
  }
  ctx.strokeStyle = col;
  ctx.lineWidth = 0.9 * k;
  ctx.lineCap = 'round';
  ctx.stroke();
  // a knot
  if ((x1 - x0) > 60 && R() < 0.85) {
    const kx = lerp(x0, x1, R.range(0.12, 0.88)), ky = lerp(y0, y1, R.range(0.3, 0.7));
    ellipse(ctx, kx, ky, 4.2, 2.2);
    ctx.strokeStyle = col;
    ctx.lineWidth = 0.9 * k;
    ctx.stroke();
    ellipse(ctx, kx, ky, 1.6, 0.9);
    ctx.fillStyle = col;
    ctx.fill();
  }
}
function arrowGlyph(ctx, cx, cy, w, h, dirL, color, shadow) {
  const draw = (dx, dy, col) => {
    ctx.save();
    ctx.translate(cx + dx, cy + dy);
    if (!dirL) ctx.scale(-1, 1);
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(-w / 2 + h * 0.62, -h * 0.5);
    ctx.lineTo(-w / 2 + h * 0.62, -h * 0.2);
    ctx.lineTo(w / 2, -h * 0.16);
    ctx.lineTo(w / 2 - h * 0.05, h * 0.18);
    ctx.lineTo(-w / 2 + h * 0.62, h * 0.2);
    ctx.lineTo(-w / 2 + h * 0.62, h * 0.5);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    ctx.restore();
  };
  if (shadow) draw(h * 0.05, h * 0.07, shadow);
  draw(0, 0, color);
}
function drawSign(ctx, o = {}) {
  const L = signLayout(o);
  const B = begin(ctx, o);
  const k = B.k, t = o.t || 0, seed = o.seed != null ? o.seed : 7;
  const burn = clamp(o.burn || 0);
  const dripP = o.drips != null ? clamp(o.drips) * 0.5 : 0; // opt-in paint drips (close-ups)
  const W = PROP_COLORS.wood;
  const dirL = (o.arrowDir || 'left') !== 'right';
  const yb = -signStake(o, L);
  const top = yb - L.h;
  const xL = -L.w / 2, xR = L.w / 2;
  const charC = '#24160F';
  const charMix = (c) => mix(c, '#2A1A12', burn * 0.55);
  const boardCol = o.board || null;
  // text-area centre (arrow boards shift away from the point)
  const tcx = L.arrow ? (dirL ? L.point / 2 : -L.point / 2) : 0;
  // ---- posts
  const posts = !L.arrow && L.w > 210 ? [-(L.w / 2 - Math.max(24, L.w * 0.13)), L.w / 2 - Math.max(24, L.w * 0.13)] : [L.arrow ? tcx * 0.6 : 0];
  const pw = L.w > 210 ? 13 : 11;
  for (const px of posts) {
    const ptop = posts.length > 1 || !L.arrow ? top - 7 : top + L.h * 0.3;
    const post = () => roundRect(ctx, px - pw / 2, ptop, pw, -ptop + 2, 3);
    paint(ctx, post, {
      fill: lin(ctx, px - pw / 2, 0, px + pw / 2, 0, [charMix(W.light), charMix(W.base), charMix(W.dark)]), hi: charMix(W.hi), rim: [B.rim[0] * 0.8, 0], line: W.deep, lw: 1.4 * k,
      extra: () => {
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const gx = px - pw * 0.25 + i * pw * 0.22;
          ctx.moveTo(gx, ptop + 6 + i * 5);
          ctx.lineTo(gx + 0.5, -4 - i * 3);
        }
        ctx.strokeStyle = rgba(W.deep, 0.35);
        ctx.lineWidth = 0.8 * k;
        ctx.stroke();
        // dirt line at the bottom
        ctx.fillStyle = lin(ctx, 0, -10, 0, 0, ['rgba(60,35,20,0)', 'rgba(60,35,20,0.55)']);
        ctx.fillRect(px - pw, -10, pw * 2, 12);
      },
    });
    if (posts.length > 1 || !L.arrow) {
      ellipse(ctx, px, ptop + 0.5, pw / 2 - 0.6, 1.6);
      ctx.fillStyle = charMix('#E3B47D');
      ctx.fill();
    }
    // ground mound + grass
    if (o.ground !== false) {
      const mw = pw * 1.7;
      ctx.beginPath();
      ctx.moveTo(px - mw, 1.5);
      ctx.bezierCurveTo(px - mw * 0.6, -4.5, px + mw * 0.6, -4.5, px + mw, 1.5);
      ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, -4, 0, 2, ['#8A6240', '#5E3F27']);
      ctx.fill();
      ctx.strokeStyle = '#4A3020';
      ctx.lineWidth = 0.9 * k;
      ctx.stroke();
      circle(ctx, px - mw * 0.55, -0.4, 1.5);
      circle(ctx, px + mw * 0.62, 0, 1.2);
      ctx.fillStyle = '#B7A48C';
      ctx.fill();
      ctx.beginPath();
      const blades = [[-mw - 2, -0.1, -9, 0.2], [-mw + 1, 0.2, -7, -0.35], [mw + 1.5, -0.1, -8, -0.25], [mw - 1, 0.2, -6, 0.35], [-mw * 0.2, -2, -5, 0.15]];
      for (const [bx, a, hgt, lean] of blades) {
        ctx.moveTo(px + bx - 1.4, 1);
        ctx.quadraticCurveTo(px + bx + lean * 6, hgt * 0.6, px + bx + lean * 10, hgt + a);
        ctx.quadraticCurveTo(px + bx + lean * 4, hgt * 0.4, px + bx + 1.4, 1);
      }
      ctx.fillStyle = '#4E9A57';
      ctx.fill();
    }
  }
  // ---- board(s)
  const boards = [];
  if (L.arrow) {
    const pt = L.point, r = 3.5;
    const pts = dirL
      ? [[xL + pt, top], [xR, top], [xR, yb], [xL + pt, yb], [xL, (top + yb) / 2]]
      : [[xL, top], [xR - pt, top], [xR, (top + yb) / 2], [xR - pt, yb], [xL, yb]];
    const jit = pts.map((p, i) => [p[0] + (hash1(seed + i * 3.7) - 0.5) * 2.4, p[1] + (hash1(seed * 2 + i * 1.9) - 0.5) * 1.6]);
    boards.push({
      path: () => {
        ctx.beginPath();
        const n = jit.length;
        const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const m0 = mid(jit[n - 1], jit[0]);
        ctx.moveTo(m0[0], m0[1]);
        for (let i = 0; i < n; i++) {
          const p = jit[i], q = jit[(i + 1) % n], m = mid(p, q);
          ctx.arcTo(p[0], p[1], m[0], m[1], r);
        }
        ctx.closePath();
      },
      y0: top, y1: yb, x0: xL, x1: xR, rot: 0, lines: L.lines.map((_, i) => i),
    });
  } else if (L.planks) {
    const n = L.lines.length;
    const totalRel = L.rel.reduce((a, b) => a + b, 0) * 1.16 + n * 2 * 0.3;
    const avail = L.h - L.gap * (n - 1);
    let yy = top;
    for (let i = 0; i < n; i++) {
      const ph = avail * ((L.rel[i] * 1.16 + 0.6) / totalRel);
      const wj = 1 + (hash1(seed + i * 5.3) - 0.5) * 0.05 - (i > 0 ? 0.04 * (1 - L.rel[i]) : 0);
      const pw2 = L.w * wj, dx = (hash1(seed * 3 + i) - 0.5) * 4;
      const y0 = yy, rr = (hash1(seed * 7 + i) - 0.5) * 0.03;
      boards.push({ path: () => roundRect(ctx, dx - pw2 / 2, y0, pw2, ph, 4), y0, y1: y0 + ph, x0: dx - pw2 / 2, x1: dx + pw2 / 2, rot: rr, cy: y0 + ph / 2, lines: [i] });
      yy += ph + L.gap;
    }
  } else {
    boards.push({ path: () => roundRect(ctx, xL, top, L.w, L.h, 4.5), y0: top, y1: yb, x0: xL, x1: xR, rot: (hash1(seed) - 0.5) * 0.025, lines: L.lines.map((_, i) => i) });
  }
  // vertical centre of text line li on board bd
  const lineCY = (bd, li) => {
    if (L.planks) return bd.cy;
    const hsum = L.sizes.reduce((a, s2) => a + s2 * 1.16, 0);
    let acc = (bd.y0 + bd.y1) / 2 - hsum / 2;
    for (let j = 0; j < li; j++) acc += L.sizes[j] * 1.16;
    return acc + L.sizes[li] * 0.58;
  };
  // char frontier (board coords): y below which the wood is charred
  const edgeK = (x) => smoothstep(L.w / 2 - 34, L.w / 2 + 4, Math.abs(x));
  const front = (x) => yb + 4 - burn * (L.h + 20) * (0.86 + 0.2 * noise1(x * 0.031 + seed * 1.3) + 0.09 * noise1(x * 0.13 + seed * 4.1) + 0.025 * Math.sin(t * 3 + x * 0.1)) - burn * L.h * 0.45 * edgeK(x);
  const paintCol = o.paint || (boardCol ? '#FFFFFF' : PROP_COLORS.paint);
  for (const bd of boards) {
    ctx.save();
    const bcx = (bd.x0 + bd.x1) / 2, bcy = (bd.y0 + bd.y1) / 2;
    if (bd.rot) { ctx.translate(bcx, bcy); ctx.rotate(bd.rot); ctx.translate(-bcx, -bcy); }
    // drop shadow under the plank onto the post
    ctx.save();
    ctx.translate(1.2, 2.2);
    bd.path();
    ctx.fillStyle = 'rgba(40,22,10,0.25)';
    ctx.fill();
    ctx.restore();
    const base = boardCol || W.base;
    const fill = boardCol
      ? lin(ctx, 0, bd.y0, 0, bd.y1, [mix(boardCol, '#FFFFFF', 0.12), boardCol, mix(boardCol, '#000000', 0.22)])
      : lin(ctx, 0, bd.y0, 0, bd.y1, ['#CF9A63', W.base, '#986338']);
    paint(ctx, bd.path, {
      fill, hi: boardCol ? mix(boardCol, '#FFFFFF', 0.45) : W.hi, rim: B.rim, line: boardCol ? mix(boardCol, '#000000', 0.55) : W.deep, lw: 1.6 * k,
      extra: () => {
        woodGrain(ctx, bd.x0, bd.x1, bd.y0, bd.y1, seed + bd.y0 * 0.37, k, boardCol ? rgba(mix(boardCol, '#000000', 0.45), 0.35) : rgba(W.dark, 0.55));
        if (boardCol) {
          // chipped paint showing the wood
          const R = rng(seed * 4.4 + bd.y0);
          ctx.fillStyle = W.base;
          for (let i = 0; i < 5; i++) {
            const onTop = R() < 0.5;
            const cx = lerp(bd.x0 + 6, bd.x1 - 6, R()), cy = onTop ? bd.y0 + R.range(0, 2) : bd.y1 - R.range(0, 2);
            ellipse(ctx, cx, cy, R.range(2, 5), R.range(1, 2.4), R.range(-0.3, 0.3));
            ctx.fill();
          }
        }
        // lower plank shade
        ctx.fillStyle = lin(ctx, 0, bd.y0 + (bd.y1 - bd.y0) * 0.55, 0, bd.y1, ['rgba(60,30,10,0)', 'rgba(60,30,10,0.22)']);
        ctx.fillRect(bd.x0 - 10, bd.y0, bd.x1 - bd.x0 + 20, bd.y1 - bd.y0 + 2);
      },
    });
    // lettering is painted outside the clip (text under an AA clip is ~2x slower);
    // it always sits inside the board anyway
    for (const li of bd.lines) {
      const txt = L.lines[li];
      const sz = L.sizes[li];
      const cy = lineCY(bd, li);
      const lc = mix(paintCol, '#2A1A12', burn * 0.5);
      const sh = boardCol ? rgba(mix(boardCol, '#000000', 0.6), 0.45) : 'rgba(58,32,14,0.45)';
      const maxW = (bd.x1 - bd.x0) - (L.arrow ? L.point : 0) - sz * 0.7;
      if (L.glyph) {
        const gw = sz * 1.15, tw = textW(txt, sz, L.weight);
        const total = tw + gw + sz * 0.35;
        const gx = dirL ? tcx - total / 2 + gw / 2 : tcx + total / 2 - gw / 2;
        const tx = dirL ? gx + gw / 2 + sz * 0.35 + tw / 2 : gx - gw / 2 - sz * 0.35 - tw / 2;
        ctx.save();
        ctx.scale(B.f, 1);
        arrowGlyph(ctx, gx * B.f, cy, gw, sz * 0.78, B.f > 0 ? dirL : !dirL, lc, sh);
        paintText(ctx, txt, tx * B.f, cy, sz, { color: lc, shadow: sh, seed: seed + li * 13, weight: L.weight, drips: dripP });
        ctx.restore();
      } else {
        ctx.save();
        ctx.scale(B.f, 1);
        paintText(ctx, txt, tcx * B.f, cy, sz, { color: lc, shadow: sh, seed: seed + li * 13, weight: L.weight, maxW, drips: L.rel[li] < 0.9 ? 0 : dripP });
        ctx.restore();
      }
    }
    if (burn > 0) {
      ctx.save();
      bd.path();
      ctx.clip();
      // char from the bottom up with a glowing ember front
      {
      const x0 = bd.x0 - 4, x1 = bd.x1 + 4;
      const charPoly = () => {
        ctx.beginPath();
        ctx.moveTo(x0, bd.y1 + 10);
        for (let xx = x0; xx <= x1 + 0.1; xx += 4) ctx.lineTo(xx, front(xx));
        ctx.lineTo(x1, bd.y1 + 10);
        ctx.closePath();
      };
      // ash band just behind the ember front
      ctx.save();
      ctx.translate(0, -3.5);
      charPoly();
      ctx.fillStyle = 'rgba(92,72,62,0.85)';
      ctx.fill();
      ctx.restore();
      charPoly();
      ctx.fillStyle = lin(ctx, 0, bd.y0, 0, bd.y1, ['#3B2417', '#1E130D']);
      ctx.fill();
      ctx.save();
      charPoly();
      ctx.clip();
      // charcoal texture: soft ash mottling + irregular cracks (dark), the cracks nearest
      // the ember front still glowing
      const fl = 0.75 + 0.25 * Math.sin(t * 6 + seed);
      const R = rng(seed * 3.7 + bd.y0 * 0.13);
      const bw2 = bd.x1 - bd.x0, bh2 = bd.y1 - bd.y0;
      ctx.fillStyle = 'rgba(120,96,84,0.16)';
      for (let i = 0; i < Math.round(bw2 / 22); i++) {
        ellipse(ctx, lerp(bd.x0, bd.x1, R()), lerp(bd.y0, bd.y1, R()), R.range(6, 16), R.range(2, 4), R.range(-0.2, 0.2));
        ctx.fill();
      }
      ctx.beginPath();
      const nCr = Math.round((bw2 * bh2) / 260);
      for (let i = 0; i < nCr; i++) {
        let cx = lerp(bd.x0 - 4, bd.x1 + 4, R()), cy = lerp(bd.y0, bd.y1, R());
        ctx.moveTo(cx, cy);
        const segs = 2 + Math.floor(R() * 3), dir = R() < 0.5 ? -1 : 1;
        for (let q = 0; q < segs; q++) {
          cx += dir * R.range(3, 8);
          cy += R.range(-2.2, 2.2);
          ctx.lineTo(cx, cy);
          if (R() < 0.35) { ctx.lineTo(cx + R.range(-1.5, 1.5), cy + R.range(2.5, 5)); ctx.moveTo(cx, cy); }
        }
      }
      ctx.strokeStyle = 'rgba(8,4,2,0.75)';
      ctx.lineWidth = 1.1 * k;
      ctx.lineJoin = 'round';
      ctx.stroke();
      const fAvg = front((bd.x0 + bd.x1) / 2);
      const gl = ctx.createLinearGradient(0, fAvg - 6, 0, fAvg + 22);
      gl.addColorStop(0, rgba('#FF7A22', 0.95 * fl));
      gl.addColorStop(1, rgba('#FF7A22', 0));
      ctx.strokeStyle = gl;
      ctx.lineWidth = 0.9 * k;
      ctx.stroke();
      // glowing burnt edges of the board
      bd.path();
      ctx.strokeStyle = rgba('#FF8A2A', 0.7 * fl);
      ctx.lineWidth = 2.6 * k;
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      for (let xx = x0; xx <= x1 + 0.1; xx += 4) (xx === x0 ? ctx.moveTo(xx, front(xx)) : ctx.lineTo(xx, front(xx)));
      ctx.strokeStyle = 'rgba(255,120,30,0.4)';
      ctx.lineWidth = 6 * k;
      ctx.stroke();
      ctx.strokeStyle = '#FF9A2E';
      ctx.lineWidth = 2.2 * k;
      ctx.stroke();
      ctx.strokeStyle = '#FFE58F';
      ctx.lineWidth = 0.9 * k;
      ctx.stroke();
      }
      ctx.restore();
    }
    if (burn > 0) {
      // charred, eaten edges
      bd.path();
      ctx.strokeStyle = rgba(charC, burn * 0.8);
      ctx.lineWidth = (1.6 + 2.6 * burn) * k;
      ctx.stroke();
    }
    // nails
    for (const px of posts) {
      if (px < bd.x0 + 4 || px > bd.x1 - 4) continue;
      // keep nails off the lettering: if the text spans the post, nail into the margins
      const bh = bd.y1 - bd.y0;
      let half = 0;
      for (const li of bd.lines) half = Math.max(half, textW(L.lines[li], L.sizes[li], L.weight) / 2 + 4 + (L.glyph ? L.sizes[li] : 0));
      const covered = Math.abs(px - tcx) < half;
      let ys;
      if (!covered) ys = bh > 34 ? [bd.y0 + 7, bd.y1 - 7] : [(bd.y0 + bd.y1) / 2];
      else {
        const l0 = bd.lines[0], l1 = bd.lines[bd.lines.length - 1];
        const tTop = lineCY(bd, l0) - L.sizes[l0] * 0.4;
        const tBot = lineCY(bd, l1) + L.sizes[l1] * (/[gjpqy]/.test(L.lines[l1]) ? 0.52 : 0.4);
        ys = [];
        // hug the board edge, and only where there is a clear gap (a nail just above a letter
        // reads as a dot/accent)
        if (tTop - bd.y0 >= 10) ys.push(bd.y0 + 4);
        if (bd.y1 - tBot >= 10) ys.push(bd.y1 - 4);
      }
      for (const ny of ys) {
        circle(ctx, px, ny, 1.9);
        ctx.fillStyle = '#4A3A30';
        ctx.fill();
        circle(ctx, px - 0.5, ny - 0.6, 0.7);
        ctx.fillStyle = 'rgba(255,240,220,0.7)';
        ctx.fill();
      }
    }
    ctx.restore();
  }
  // ---- fire + smoke
  if (burn > 0) {
    const nf = 2 + Math.round(burn * 6);
    const ft = [];
    for (let j = 0; j < nf; j++) {
      const fx = lerp(xL + 6, xR - 6, (j + 0.5) / nf + (hash1(seed + j * 3.1) - 0.5) * 0.12);
      const fy = Math.max(top + 1, front(fx) + 1);
      const fh = (12 + 30 * Math.pow(burn, 0.7)) * (0.6 + 0.65 * hash1(seed * 2 + j));
      ft.push([fx, fy, fh, 10 + 9 * burn * hash1(j + seed)]);
    }
    // smoke columns rising off the flames (oldest puff first so newer ones overlap it)
    const cols = Math.min(L.w > 200 ? 3 : 2, nf);
    const NP = 4;
    for (let c = 0; c < cols; c++) {
      const cx = ft[Math.floor((c + 0.5) * nf / cols)][0];
      const ps = [];
      for (let i = 0; i < NP; i++) ps.push([frac(t * 0.36 + i / NP + c * 0.37), i]);
      ps.sort((A, Bq) => Bq[0] - A[0]);
      for (const [p, i] of ps) {
        const sx = cx + p * 34 + Math.sin(t * 0.9 + i + c) * 5;
        const al = burn * 0.8 * (1 - smoothstep(0.45, 1, p)) * smoothstep(0, 0.12, p);
        puff(ctx, sx, top - 14 - p * 140, 12 + p * 34, i + c * 4 + seed, PUFF_PAL.soot, al, 0.8 * k, t);
      }
    }
    ctx.save();
    ctx.translate(0, (top + yb) / 2);
    ctx.scale(1, 0.6);
    glow(ctx, 0, 0, L.w * 0.7, '#FF7A2E', 0.3 * burn);
    ctx.restore();
    for (const [fx, fy, fh, fw] of ft) flame(ctx, fx, fy, fh, fw, t, fx * 0.1 + seed, Math.min(1, burn * 3));
    // small licks on the char surface
    for (let j = 0; j < 4 * burn; j++) {
      const fx = lerp(xL + 10, xR - 10, hash1(seed * 5 + j));
      const fy = Math.min(yb - 2, Math.max(top + 4, front(fx) + 10 + hash1(j) * 10));
      flame(ctx, fx, fy, 7 + 6 * burn, 5, t, j * 2.7 + seed, Math.min(1, burn * 2));
    }
    // embers
    for (let i = 0; i < 10 * burn; i++) {
      const p = frac(t * 0.8 + i * 0.137);
      const ex = lerp(xL, xR, hash1(i * 7.7 + seed)) + Math.sin(t * 3 + i) * 6 + p * 14;
      circle(ctx, ex, top - p * 80, 1.4 * (1 - p) + 0.3);
      ctx.fillStyle = rgba('#FFC04A', 1 - p);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ═════════════════════════════════════════════════════════════════════ RAFT
const RAFT = {
  bundles: [ // back → front: centre y, thickness, half length, tip curl
    { cy: -45, d: 30, hl: 166, curl: 16 },
    { cy: -31, d: 32, hl: 175, curl: 20 },
    { cy: -12, d: 38, hl: 186, curl: 27 },
  ],
  taper: 60, mastX: 34, mastBase: -50, mastTop: -262, flagW: 250, flagH: 50,
  lashX: [-118, -40, 40, 118],
  seats: [-128, -44, 44, 126], seatY: -42,
};
function bundleGeom(b) {
  const r = b.d / 2, T = RAFT.taper, X = b.hl + 8;
  const u = (x) => clamp((Math.abs(x) - (b.hl - T)) / (T + 8));
  const cyAt = (x) => b.cy - (r * 0.35 + b.curl) * Math.pow(u(x), 2.1);
  const halfAt = (x) => r * (1 - 0.76 * Math.pow(u(x), 1.3));
  return { r, X, cyAt, halfAt };
}
function bundlePath(ctx, b, G) {
  const xs = [];
  const T = RAFT.taper;
  for (let i = 0; i <= 12; i++) xs.push(-(b.hl - T) - (T + 8) * (1 - i / 12));
  xs.push(b.hl - T);
  for (let i = 1; i <= 12; i++) xs.push(b.hl - T + ((T + 8) * i) / 12);
  ctx.beginPath();
  xs.forEach((x, i) => (i ? ctx.lineTo(x, G.cyAt(x) - G.halfAt(x)) : ctx.moveTo(x, G.cyAt(x) - G.halfAt(x))));
  const tr = G.halfAt(G.X);
  ctx.arc(G.X, G.cyAt(G.X), tr, -PI / 2, PI / 2);
  for (let i = xs.length - 1; i >= 0; i--) ctx.lineTo(xs[i], G.cyAt(xs[i]) + G.halfAt(xs[i]));
  ctx.arc(-G.X, G.cyAt(-G.X), tr, PI / 2, PI * 1.5);
  ctx.closePath();
  return xs;
}
function rope(ctx, x0, y0, x1, y1, bulge, k, w = 3) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo((x0 + x1) / 2 + bulge, (y0 + y1) / 2, x1, y1);
  ctx.strokeStyle = PROP_COLORS.ropeLine;
  ctx.lineWidth = (w + 1.7) * k;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.strokeStyle = PROP_COLORS.rope;
  ctx.lineWidth = w * k;
  ctx.stroke();
}
function ropeTicks(ctx, x0, y0, x1, y1, k, n, w = 3) {
  ctx.beginPath();
  for (let i = 1; i < n; i++) {
    const u = i / n, x = lerp(x0, x1, u), y = lerp(y0, y1, u);
    ctx.moveTo(x - w * 0.45, y - w * 0.3);
    ctx.lineTo(x + w * 0.45, y + w * 0.3);
  }
  ctx.strokeStyle = 'rgba(122,84,40,0.75)';
  ctx.lineWidth = 0.75 * k;
  ctx.stroke();
}
function raftPose(o) {
  const t = o.t || 0, bob = o.bob || 0;
  const by = (Math.sin(t * 1.7) * 2.6 + Math.sin(t * 0.93 + 1.3) * 1.6) * bob;
  const ang = (Math.sin(t * 1.25 + 0.4) * 0.02 + Math.sin(t * 0.61 + 2) * 0.01) * bob + (o.rock || 0);
  return { by, ang };
}
function raftAnchors(o = {}) {
  const pz = raftPose(o);
  const s = o.scale != null ? o.scale : 1;
  const P = xform({ ...o, y: (o.y || 0) + pz.by * s, rot: (o.rot || 0) + pz.ang });
  const bF = RAFT.bundles[2], G = bundleGeom(bF);
  const fd = (o.flip ? -1 : 1) * (o.flagDir === -1 ? -1 : 1);
  // painted name on the banner: per-word centres (for the "Gerald covers TOLD YOU SO" gag)
  const FL = flagTextLayout(o), FWv = flagWave(o, o.t || 0);
  const my = RAFT.mastTop + 4;
  const along2u = (al) => (fd * (o.flip ? -1 : 1) > 0 ? FL.u0 + al / RAFT.flagW : FL.u0 + (FL.tw - al) / RAFT.flagW);
  const spanPt = (a0, a1) => {
    const u = along2u((a0 + a1) / 2);
    const p = P(RAFT.mastX + fd * (2 + u * RAFT.flagW), my + RAFT.flagH / 2 + FWv.dy(u) + 0.5);
    return { x: p.x, y: p.y, w: (a1 - a0) * s, h: FL.fs * 0.8 * s };
  };
  const flagWords = [];
  let acc = 0, wStart = null, wText = '';
  FL.m.chars.forEach((ch, i) => {
    const cw = (FL.m.ws[i] * FL.fs) / 100;
    if (ch !== ' ') { if (wStart == null) wStart = acc; wText += ch; }
    acc += cw;
    if ((ch === ' ' || i === FL.m.chars.length - 1) && wStart != null) {
      flagWords.push({ text: wText, ...spanPt(wStart, ch === ' ' ? acc - cw : acc) });
      wStart = null; wText = '';
    }
  });
  const firstEnd = FL.m.chars.indexOf(' ');
  let coverA0 = 0;
  for (let i = 0; i <= firstEnd; i++) coverA0 += (FL.m.ws[i] * FL.fs) / 100;
  const flagCover = firstEnd > 0 ? spanPt(coverA0, FL.tw) : spanPt(0, FL.tw);
  return {
    seats: RAFT.seats.map((sx) => P(sx, RAFT.seatY)),
    deck: P(0, RAFT.seatY),
    mastTop: P(RAFT.mastX, RAFT.mastTop - 9.6),
    flag: P(RAFT.mastX + fd * RAFT.flagW * 0.5, RAFT.mastTop + 4 + RAFT.flagH / 2),
    flagWords, flagCover,
    tipL: P(-G.X, G.cyAt(-G.X)), tipR: P(G.X, G.cyAt(G.X)),
    waterline: (o.y || 0) + pz.by * s,
    angle: (o.rot || 0) + pz.ang,
  };
}
function drawSteeringOar(ctx, k, rimv) {
  // steering oar over the stern: handle on deck, blade trailing in the water
  ctx.save();
  ctx.translate(-150, -100);
  ctx.rotate(Math.atan2(104, -88) - PI / 2);
  // local: shaft runs down +y from the handle (0,0) to the blade
  const shaft = () => roundRect(ctx, -2.9, -4, 5.8, 104, 2.9);
  paint(ctx, shaft, { fill: lin(ctx, -3, 0, 3, 0, ['#E8BA84', '#C08A55', '#93602F']), hi: '#F4D4A6', rim: [rimv[0] * 0.5, 0], line: '#6A4426', lw: 1.2 * k });
  roundRect(ctx, -4.4, -7, 8.8, 9, 3.5);
  ctx.fillStyle = '#7A4F2E';
  ctx.fill();
  const blade = () => {
    ctx.beginPath();
    ctx.moveTo(-3, 96);
    ctx.bezierCurveTo(-11, 106, -11, 128, -6, 140);
    ctx.quadraticCurveTo(0, 145, 6, 140);
    ctx.bezierCurveTo(11, 128, 11, 106, 3, 96);
    ctx.closePath();
  };
  paint(ctx, blade, {
    fill: lin(ctx, -10, 0, 10, 0, ['#E2B27C', '#BF8750', '#9A6838']), hi: '#F4D4A6', rim: [rimv[0] * 0.5, rimv[1] * 0.5], line: '#6A4426', lw: 1.3 * k,
    extra: () => {
      ctx.fillStyle = '#D9473C';
      ctx.fillRect(-14, 128, 28, 20);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(-14, 128, 28, 2.4);
      ctx.beginPath();
      ctx.moveTo(0, 100); ctx.lineTo(0, 126);
      ctx.strokeStyle = 'rgba(106,68,38,0.35)';
      ctx.lineWidth = 1 * k;
      ctx.stroke();
    },
  });
  ctx.restore();
}
function drawRaft(ctx, o = {}) {
  const t = o.t || 0;
  const build = o.build != null ? clamp(o.build) : 1;
  const bob = o.bob || 0;
  const pz = raftPose(o);
  const s = o.scale != null ? o.scale : 1;
  const f = o.flip ? -1 : 1;
  ctx.save();
  ctx.translate(o.x || 0, (o.y || 0) + pz.by * s);
  ctx.rotate((o.rot || 0) + pz.ang);
  ctx.scale(s * f, s);
  if (o.alpha != null && o.alpha < 1) ctx.globalAlpha *= clamp(o.alpha);
  const k = lwf(s);
  const rim = rimVec({ rot: (o.rot || 0) + pz.ang, flip: o.flip });
  const C = PROP_COLORS.reed;
  const wet = o.wet != null ? o.wet : bob > 0;
  const dirLocal = (o.dir === 1 ? 1 : -1) * f;
  const wake = clamp(o.wake || 0);
  const NB = RAFT.bundles.length;
  // ---- wake lines behind the stern (on the water)
  if (wake > 0 && build >= 1) {
    const sx = -dirLocal * 200;
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const p = frac(t * 1.6 + i / 6);
      const len = (60 + 130 * wake) * (0.5 + 0.5 * hash1(i));
      const yy = 3 + (i % 2 ? 7 : -1) + p * 6;
      const x0 = sx - dirLocal * (p * 100 * wake);
      ctx.beginPath();
      ctx.moveTo(x0, yy);
      ctx.lineTo(x0 - dirLocal * len, yy + (i % 2 ? 5 : -2) * p);
      ctx.strokeStyle = rgba('#FFFFFF', 0.75 * wake * (1 - p));
      ctx.lineWidth = (4 - p * 3) * k;
      ctx.stroke();
    }
    ctx.restore();
  }
  // ---- bundles (back → front), steering oar tucked between the last two
  const appear = (i) => clamp((build - i * 0.13) / 0.12);
  const oarA = clamp((build - 0.95) / 0.05);
  for (let i = 0; i < NB; i++) {
    if (i === NB - 1 && o.paddle !== false && oarA > 0) {
      ctx.save();
      ctx.translate(0, (1 - ease.outBounce(oarA)) * -40);
      ctx.globalAlpha *= Math.min(1, oarA * 3);
      // the steering oar trails at the STERN (opposite the direction of travel)
      if (dirLocal < 0) ctx.scale(-1, 1);
      drawSteeringOar(ctx, k, dirLocal < 0 ? [-rim[0], rim[1]] : rim);
      ctx.restore();
    }
    const a = appear(i);
    if (a <= 0) continue;
    const b = RAFT.bundles[i], G = bundleGeom(b);
    ctx.save();
    ctx.translate(0, (1 - ease.outBounce(a)) * -80);
    if (a < 1) ctx.globalAlpha *= Math.min(1, a * 3);
    let xs;
    const path = () => { xs = bundlePath(ctx, b, G); };
    paint(ctx, path, {
      fill: lin(ctx, 0, b.cy - G.r, 0, b.cy + G.r, [C.top, C.mid, C.bottom]), hi: C.hi, rim: [rim[0] * 1.2, rim[1] * 1.3], line: C.line, lw: 1.8 * k,
      extra: () => {
        // reed strands
        ctx.beginPath();
        for (let j = 1; j <= 3; j++) {
          const v = j / 4 - 0.5;
          xs.forEach((x, n) => {
            const yy = G.cyAt(x) + 2 * G.halfAt(x) * v + Math.sin(x * 0.045 + j * 2 + i) * 0.7;
            if (n) ctx.lineTo(x, yy); else ctx.moveTo(x, yy);
          });
        }
        ctx.strokeStyle = 'rgba(122,90,36,0.4)';
        ctx.lineWidth = 1 * k;
        ctx.stroke();
        ctx.beginPath();
        xs.forEach((x, n) => {
          const yy = G.cyAt(x) - G.halfAt(x) * 0.5;
          if (n) ctx.lineTo(x, yy); else ctx.moveTo(x, yy);
        });
        ctx.strokeStyle = 'rgba(255,248,210,0.55)';
        ctx.lineWidth = 1.3 * k;
        ctx.stroke();
        // short reed-joint ticks
        const R = rng(17 + i);
        ctx.beginPath();
        for (let q = 0; q < 16; q++) {
          const x = R.range(-b.hl + 40, b.hl - 40), v = R.range(-0.6, 0.5);
          const yy = b.cy + G.r * v;
          ctx.moveTo(x, yy - 1.6);
          ctx.lineTo(x + 0.6, yy + 1.6);
        }
        ctx.strokeStyle = 'rgba(122,90,36,0.35)';
        ctx.lineWidth = 0.8 * k;
        ctx.stroke();
        // underside shade
        ctx.fillStyle = lin(ctx, 0, b.cy + G.r * 0.2, 0, b.cy + G.r, ['rgba(110,70,20,0)', 'rgba(110,70,20,0.28)']);
        ctx.fillRect(-260, b.cy, 520, G.r + 2);
        // occlusion where the next (nearer) bundle overlaps
        if (i < NB - 1) {
          const nb = RAFT.bundles[i + 1];
          const yTop = nb.cy - nb.d / 2;
          ctx.fillStyle = lin(ctx, 0, yTop - 8, 0, yTop + 1, ['rgba(90,60,20,0)', 'rgba(90,60,20,0.42)']);
          ctx.fillRect(-260, yTop - 8, 520, 10);
        }
        // waterline wetness
        if (wet && i === NB - 1) {
          ctx.fillStyle = lin(ctx, 0, -5, 0, 7, ['rgba(40,90,100,0)', 'rgba(40,90,100,0.5)']);
          ctx.fillRect(-260, -5, 520, 16);
        }
      },
    });
    // reed tufts poking out of both tips
    ctx.beginPath();
    for (const sgn of [-1, 1]) {
      const tx = sgn * G.X, ty = G.cyAt(tx);
      const base = sgn > 0 ? -0.75 : PI + 0.75;
      for (let q = 0; q < 5; q++) {
        const an = base + (q - 2) * 0.28 * sgn;
        const L = (5 + 4 * hash1(i * 7 + q + sgn)) * (b.d / 30);
        ctx.moveTo(tx + Math.cos(an) * G.halfAt(tx) * 0.6, ty + Math.sin(an) * G.halfAt(tx) * 0.6);
        ctx.lineTo(tx + Math.cos(an) * (G.halfAt(tx) + L), ty + Math.sin(an) * (G.halfAt(tx) + L));
      }
    }
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1.3 * k;
    ctx.lineCap = 'round';
    ctx.stroke();
    // tip wraps (tight rope rings near both ends)
    const wa = clamp((build - 0.42 - i * 0.02) / 0.08);
    if (wa > 0) {
      for (const sgn of [-1, 1]) {
        for (let w = 0; w < 2; w++) {
          const x = sgn * (b.hl - RAFT.taper * (0.3 + w * 0.2));
          const hh = G.halfAt(x) * wa + 0.3, cy = G.cyAt(x);
          rope(ctx, x, cy - hh, x + sgn * 1.4, cy + hh, sgn * 2, k, 2.8);
        }
      }
    }
    ctx.restore();
  }
  // ---- cross lashings binding all bundles (columns)
  const b0 = RAFT.bundles[0], fb = RAFT.bundles[NB - 1];
  RAFT.lashX.forEach((lx, j) => {
    const a = clamp((build - 0.48 - j * 0.05) / 0.06);
    if (a <= 0) return;
    const yT = b0.cy - b0.d / 2 + 1;
    const yB = lerp(yT, fb.cy + fb.d / 2 - 2, ease.outCubic(a));
    for (const dx of [-3.8, 3.8]) {
      rope(ctx, lx + dx - 1.5, yT, lx + dx + 1.5, yB, 2.6, k, 3.4);
      ropeTicks(ctx, lx + dx - 1.5, yT, lx + dx + 1.5, yB, k, 12, 3.4);
    }
    if (a >= 1) {
      // knot + dangling end
      ellipse(ctx, lx, fb.cy + 2, 5, 4);
      ctx.fillStyle = PROP_COLORS.rope;
      ctx.fill();
      ctx.strokeStyle = PROP_COLORS.ropeLine;
      ctx.lineWidth = 1.2 * k;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(lx + 1.5, fb.cy + 5);
      ctx.quadraticCurveTo(lx + 4, fb.cy + 12, lx + 1.5 + Math.sin(t * 2 + j) * 1.6, fb.cy + 17);
      ctx.strokeStyle = PROP_COLORS.ropeLine;
      ctx.lineWidth = 3 * k;
      ctx.stroke();
      ctx.strokeStyle = PROP_COLORS.rope;
      ctx.lineWidth = 1.7 * k;
      ctx.stroke();
    }
  });
  // ---- mast, stays, flag
  const ma = clamp((build - 0.7) / 0.12);
  if (ma > 0) {
    const mx = RAFT.mastX, mb = RAFT.mastBase;
    const hgt = (mb - RAFT.mastTop) * ease.outBack(ma, 1.2);
    const mt = mb - hgt;
    if (ma >= 1) {
      const G = bundleGeom(b0);
      for (const sgn of [-1, 1]) {
        const ex = sgn * (G.X - 12), ey = G.cyAt(ex) - 2;
        ctx.beginPath();
        ctx.moveTo(mx, mt + 26);
        ctx.quadraticCurveTo((mx + ex) / 2, (mt + 26 + ey) / 2 + 9, ex, ey);
        ctx.strokeStyle = 'rgba(110,80,40,0.9)';
        ctx.lineWidth = 1.2 * k;
        ctx.stroke();
      }
    }
    const pole = () => {
      ctx.beginPath();
      ctx.moveTo(mx - 4.4, mb + 2);
      ctx.lineTo(mx - 3.3, mt);
      ctx.lineTo(mx + 3.3, mt);
      ctx.lineTo(mx + 4.4, mb + 2);
      ctx.closePath();
    };
    paint(ctx, pole, {
      fill: lin(ctx, mx - 4, 0, mx + 4, 0, ['#E7C27E', '#C49452', '#946634']), hi: '#F6DDA8', rim: [rim[0] * 0.6, 0], line: '#5E3F1E', lw: 1.3 * k,
      extra: () => {
        ctx.beginPath();
        for (let yy = mb - 30; yy > mt + 8; yy -= 38) {
          ctx.moveTo(mx - 4.5, yy);
          ctx.quadraticCurveTo(mx, yy + 1.8, mx + 4.5, yy);
        }
        ctx.strokeStyle = 'rgba(94,63,30,0.8)';
        ctx.lineWidth = 1.3 * k;
        ctx.stroke();
      },
    });
    for (let w = 0; w < 3; w++) rope(ctx, mx - 6.5, mb - 4 - w * 3.4, mx + 6.5, mb - 3 - w * 3.4, 1.5, k, 2.4);
    circle(ctx, mx, mt - 4.5, 5.4);
    ctx.fillStyle = lin(ctx, 0, mt - 10, 0, mt, ['#FF7A6E', '#C42E28']);
    ctx.fill();
    ctx.strokeStyle = '#7A1B18';
    ctx.lineWidth = 1.1 * k;
    ctx.stroke();
    circle(ctx, mx - 1.6, mt - 6.4, 1.6);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
    const fa = clamp((build - 0.82) / 0.13);
    if (fa > 0 && ma >= 1) drawRaftFlag(ctx, o, mx, mt + 4, fa, t, k, f);
  }
  // ---- water interaction: ripples + bow foam
  if (bob > 0 && build >= 1) {
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const p = frac(t * 0.45 + i / 6);
      const side = i % 2 ? 1 : -1;
      const x0 = side * (150 + p * 80) + (i - 3) * 6;
      ctx.beginPath();
      ctx.moveTo(x0 - 18 - p * 16, 8 + p * 5);
      ctx.quadraticCurveTo(x0, 5 + p * 5, x0 + 18 + p * 16, 8 + p * 5);
      ctx.strokeStyle = rgba('#FFFFFF', 0.6 * (1 - p) * Math.min(1, bob * 2));
      ctx.lineWidth = 2.2 * k;
      ctx.stroke();
    }
    ctx.restore();
  }
  if (wake > 0 && build >= 1) {
    const bxp = dirLocal * 186;
    for (let i = 0; i < 5; i++) {
      const p = frac(t * 2.2 + i / 5);
      puff(ctx, bxp + dirLocal * (6 + p * 14) - dirLocal * i * 7, 5 - p * 12, (7 + p * 9) * (0.6 + wake * 0.6), i + 3, PUFF_PAL.white, (1 - p) * wake, 0.9 * k, t);
    }
  }
  ctx.restore();
}
// banner wave + painted-name layout shared by drawRaftFlag and raftAnchors
function flagWave(o, t) {
  const wind = o.wind != null ? o.wind : 0.6;
  const ph = t * (3.6 + wind * 3.4);
  const amp = 1.2 + 4.8 * wind;
  return {
    wind, ph, amp,
    dy: (u) => Math.sin(u * 2.3 * PI - ph) * u * amp + u * u * (1 - wind) * 6,
  };
}
function flagTextLayout(o) {
  const txt = o.flagText != null ? String(o.flagText) : 'S.S. TOLD YOU SO';
  const m = charWidths(txt, 700);
  const avail = RAFT.flagW * 0.77;
  const fs = Math.min(25, (avail / Math.max(1, m.w)) * 100);
  const tw = (m.w * fs) / 100;
  const u0 = 0.065 + (0.77 - tw / RAFT.flagW) / 2;
  return { txt, m, fs, tw, u0 };
}
function drawRaftFlag(ctx, o, mx, my, unfurl, t, k, f) {
  const flagDir = o.flagDir === -1 ? -1 : 1;
  const side = flagDir * f; // local x direction the banner extends to
  const fw = RAFT.flagW * ease.outCubic(unfurl), fh = RAFT.flagH;
  if (fw < 2) return;
  const { wind, ph, amp, dy } = flagWave(o, t);
  const slope = (u) => Math.cos(u * 2.3 * PI - ph) * 2.3 * PI * u * amp / fw + Math.sin(u * 2.3 * PI - ph) * amp / fw;
  const N = 16;
  const X = (u) => mx + side * (2 + u * fw);
  const notch = 0.13;
  const outline = () => {
    ctx.beginPath();
    for (let i = 0; i <= N; i++) { const u = i / N; ctx.lineTo(X(u), my + dy(u) + u * 1.5); }
    ctx.lineTo(X(1 - notch), my + fh * 0.5 + dy(1 - notch));
    ctx.lineTo(X(1), my + fh - 1.5 + dy(1));
    for (let i = N; i >= 0; i--) { const u = i / N; ctx.lineTo(X(u), my + fh - u * 1.5 + dy(u)); }
    ctx.closePath();
  };
  // shading follows the ripple
  const g = ctx.createLinearGradient(X(0), 0, X(1), 0);
  for (let i = 0; i <= 10; i++) {
    const u = i / 10, c = Math.cos(u * 2.3 * PI - ph) * Math.min(1, u * 3);
    g.addColorStop(i / 10, mix('#FFF8E6', '#D8C49C', clamp(0.5 - c * 0.5 * wind - 0.1)));
  }
  paint(ctx, outline, {
    fill: g, hi: '#FFFFFF', rim: [0, 1.4], line: '#9C7C4C', lw: 1.3 * k,
    extra: () => {
      // red trim stripes
      ctx.beginPath();
      for (let i = 0; i <= N; i++) { const u = i / N; ctx.lineTo(X(u), my + 5 + dy(u) + u * 1.5); }
      ctx.moveTo(X(0), my + fh - 5 + dy(0));
      for (let i = 0; i <= N; i++) { const u = i / N; ctx.lineTo(X(u), my + fh - 5 - u * 1.5 + dy(u)); }
      ctx.strokeStyle = '#E2463F';
      ctx.lineWidth = 3 * k;
      ctx.stroke();
    },
  });
  // painted name drawn outside the clip (cheaper; it always sits inside the banner)
  // painted name, letter by letter riding the wave (reads left→right in caller space)
  const { m, fs, tw, u0 } = flagTextLayout(o);
  ctx.font = `700 ${fs}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let acc = 0;
  const worldLR = flagDir > 0; // banner extends to the right in caller space
  for (let i = 0; i < m.chars.length; i++) {
    const cw = (m.ws[i] * fs) / 100;
    const along = acc + cw / 2;
    acc += cw;
    if (m.chars[i] === ' ' || (o.flagShow != null && i >= o.flagShow)) continue;
    const uu = worldLR ? u0 + along / RAFT.flagW : u0 + (tw - along) / RAFT.flagW;
    const u = uu * (RAFT.flagW / Math.max(fw, 1)) * (fw / RAFT.flagW);
    if (u > unfurl) continue;
    const px = mx + side * (2 + uu * fw), py = my + fh / 2 + dy(uu) + 0.5;
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(f, 1);
    ctx.rotate(Math.atan(slope(uu)) * flagDir + (hash1(i * 3.1) - 0.5) * 0.08);
    ctx.fillStyle = 'rgba(120,30,20,0.25)';
    ctx.fillText(m.chars[i], fs * 0.05, fs * 0.07);
    ctx.fillStyle = '#C8322A';
    ctx.fillText(m.chars[i], 0, 0);
    ctx.restore();
  }
  // ties to the mast
  for (const yy of [my + 4, my + fh - 4]) {
    ellipse(ctx, mx, yy, 4.6, 2.4);
    ctx.fillStyle = PROP_COLORS.rope;
    ctx.fill();
    ctx.strokeStyle = PROP_COLORS.ropeLine;
    ctx.lineWidth = 1 * k;
    ctx.stroke();
  }
}

// ═════════════════════════════════════════════════════════════════════ BACKPACK
function backpackAnchors(o = {}) {
  const P = xform(o);
  return { mouth: P(0, -86), top: P(0, -94), bottom: P(0, 0), strap: P(-30, -70) };
}
function drawBackpack(ctx, o = {}) {
  const B = begin(ctx, o);
  const k = B.k, C = PROP_COLORS.teal;
  const open = clamp(o.open || 0);
  const hingeY = -87;
  const flap = () => {
    ctx.beginPath();
    ctx.moveTo(-25, -85);
    ctx.quadraticCurveTo(0, -95, 25, -85);
    ctx.bezierCurveTo(28, -76, 28, -64, 26, -56);
    ctx.quadraticCurveTo(0, -48, -26, -56);
    ctx.bezierCurveTo(-28, -64, -28, -76, -25, -85);
    ctx.closePath();
  };
  // shoulder strap peeking out behind
  ctx.beginPath();
  ctx.moveTo(-22, -84);
  ctx.bezierCurveTo(-44, -72, -42, -38, -30, -18);
  ctx.strokeStyle = '#1E3442';
  ctx.lineWidth = 7 * k;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.strokeStyle = '#2E4C5E';
  ctx.lineWidth = 4.5 * k;
  ctx.stroke();
  // flap flipped back behind the bag (second half of opening)
  if (open > 0.5) {
    const sy = -(open - 0.5) * 2 * 0.62;
    ctx.save();
    ctx.translate(0, hingeY + 2);
    ctx.scale(1, sy);
    ctx.translate(0, -hingeY);
    paint(ctx, flap, { fill: lin(ctx, 0, -95, 0, -50, ['#1F4A60', '#2C5F7A']), hi: '#3F7EA0', rim: [0, -1.5], line: C.line, lw: (1.6 * k) / Math.max(0.3, Math.abs(sy)) });
    ctx.restore();
  }
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-28, -12);
    ctx.bezierCurveTo(-35, -38, -33, -70, -25, -84);
    ctx.quadraticCurveTo(0, -93, 25, -84);
    ctx.bezierCurveTo(33, -70, 35, -38, 28, -12);
    ctx.quadraticCurveTo(0, -6, -28, -12);
    ctx.closePath();
  };
  paint(ctx, body, {
    fill: lin(ctx, 0, -90, 0, -8, [C.top, '#4A8CAE', C.bottom]), hi: C.hi, rim: B.rim, line: C.line, lw: 1.8 * k,
    extra: () => {
      ctx.fillStyle = lin(ctx, -30, 0, 30, 0, ['rgba(255,255,255,0.08)', 'rgba(0,0,0,0)', 'rgba(10,30,45,0.28)']);
      ctx.fillRect(-40, -100, 80, 100);
      ctx.beginPath();
      ctx.moveTo(-31, -40); ctx.lineTo(-24, -40);
      ctx.moveTo(31, -40); ctx.lineTo(24, -40);
      ctx.strokeStyle = '#1F4255';
      ctx.lineWidth = 3 * k;
      ctx.stroke();
    },
  });
  // the open mouth with a drawstring
  const mo = smoothstep(0.15, 0.8, open);
  if (mo > 0) {
    ellipse(ctx, 0, -86, 23, 1 + 7 * mo);
    ctx.fillStyle = lin(ctx, 0, -93, 0, -79, ['#0E2430', '#1B3B4D']);
    ctx.fill();
    ctx.strokeStyle = '#6FAACB';
    ctx.lineWidth = 2.6 * k;
    ctx.stroke();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1 * k;
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha *= mo;
    ctx.beginPath();
    ctx.moveTo(-3, -79);
    ctx.quadraticCurveTo(-6, -72, -4, -64);
    ctx.moveTo(3, -79);
    ctx.quadraticCurveTo(5, -71, 6, -65);
    ctx.strokeStyle = '#E3D5B8';
    ctx.lineWidth = 1.4 * k;
    ctx.stroke();
    for (const [tx, ty] of [[-4, -63], [6, -64]]) {
      roundRect(ctx, tx - 2, ty - 1, 4, 5, 1.5);
      ctx.fillStyle = '#E2463F';
      ctx.fill();
    }
    ctx.restore();
  }
  // front pocket with zipper
  const pocket = () => roundRect(ctx, -19, -45, 38, 27, 8);
  paint(ctx, pocket, {
    fill: lin(ctx, 0, -45, 0, -18, ['#4F93B6', '#2F6683']), hi: '#86BCD6', rim: [B.rim[0] * 0.6, B.rim[1] * 0.6], line: C.line, lw: 1.4 * k,
    extra: () => {
      ctx.beginPath();
      ctx.moveTo(-15, -40);
      ctx.quadraticCurveTo(0, -42.5, 15, -40);
      ctx.strokeStyle = '#173444';
      ctx.lineWidth = 2.2 * k;
      ctx.stroke();
      ctx.setLineDash([1.2, 1.4]);
      ctx.strokeStyle = '#C8D6DE';
      ctx.lineWidth = 1.4 * k;
      ctx.stroke();
      ctx.setLineDash([]);
    },
  });
  ctx.beginPath();
  ctx.moveTo(10, -41);
  ctx.lineTo(12, -34);
  ctx.strokeStyle = '#D9B54A';
  ctx.lineWidth = 2.2 * k;
  ctx.lineCap = 'round';
  ctx.stroke();
  // flap in front, lifting (first half of opening)
  if (open < 0.5) {
    const ca = Math.cos(open * PI);
    ctx.save();
    ctx.translate(0, hingeY);
    ctx.scale(1, ca);
    ctx.translate(0, -hingeY);
    paint(ctx, flap, {
      fill: lin(ctx, 0, -95, 0, -50, ['#4787AA', '#2C5F7A']), hi: '#7CB6D2', rim: B.rim, line: C.line, lw: (1.6 * k) / Math.max(0.3, ca),
      extra: () => {
        circle(ctx, -9, -72, 7.2);
        ctx.fillStyle = '#FFF7EC';
        ctx.fill();
        ctx.strokeStyle = '#B9A88E';
        ctx.lineWidth = 0.9 * k;
        ctx.stroke();
        ctx.fillStyle = '#E2463F';
        ctx.fillRect(-11.2, -77, 4.4, 10);
        ctx.fillRect(-14, -74.2, 10, 4.4);
        ctx.beginPath();
        ctx.moveTo(-22, -58.5);
        ctx.quadraticCurveTo(0, -51.5, 22, -58.5);
        ctx.setLineDash([2, 2]);
        ctx.strokeStyle = 'rgba(200,230,240,0.5)';
        ctx.lineWidth = 0.9 * k;
        ctx.stroke();
        ctx.setLineDash([]);
      },
    });
    // strap tab down to the buckle
    if (open < 0.2) {
      roundRect(ctx, 6, -60, 7, 15, 2);
      ctx.fillStyle = '#21485C';
      ctx.fill();
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1 * k;
      ctx.stroke();
    }
    ctx.restore();
    if (open < 0.2) {
      ctx.beginPath();
      ctx.moveTo(-6, -91);
      ctx.quadraticCurveTo(0, -101, 6, -91);
      ctx.strokeStyle = '#1F4255';
      ctx.lineWidth = 2.6 * k;
      ctx.stroke();
    }
  }
  roundRect(ctx, 4.5, -48, 10, 7, 1.8);
  ctx.fillStyle = lin(ctx, 0, -48, 0, -41, ['#F5DA78', '#C9A23C']);
  ctx.fill();
  ctx.strokeStyle = '#7E6420';
  ctx.lineWidth = 1 * k;
  ctx.stroke();
  // bedroll strapped underneath
  const roll = () => roundRect(ctx, -36, -18, 72, 18, 9);
  paint(ctx, roll, {
    fill: lin(ctx, 0, -18, 0, 0, ['#E2C08A', '#C8A26A', '#9C7A46']), hi: '#F4DDB0', rim: B.rim, line: '#7A5C34', lw: 1.5 * k,
    extra: () => {
      ctx.beginPath();
      for (const yy of [-12, -6]) { ctx.moveTo(-34, yy); ctx.lineTo(28, yy + 0.5); }
      ctx.strokeStyle = 'rgba(122,92,52,0.35)';
      ctx.lineWidth = 0.8 * k;
      ctx.stroke();
    },
  });
  ellipse(ctx, 31.5, -9, 4.4, 8.4);
  ctx.fillStyle = '#D8B47C';
  ctx.fill();
  ctx.strokeStyle = '#7A5C34';
  ctx.lineWidth = 1.1 * k;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(31.5, -9, 2.6, 5.2, 0, -PI / 2, PI);
  ctx.ellipse(31.5, -9.6, 1.2, 2.6, 0, PI, TAU);
  ctx.strokeStyle = 'rgba(122,92,52,0.8)';
  ctx.lineWidth = 0.8 * k;
  ctx.stroke();
  for (const sx of [-19, 15]) {
    roundRect(ctx, sx - 2.6, -19.5, 5.2, 21, 1.5);
    ctx.fillStyle = '#3B3026';
    ctx.fill();
  }
  ctx.restore();
}

// ═════════════════════════════════════════════════════════════════════ HAMMER
function hammerAnchors(o = {}) {
  const P = xform(o);
  return { face: P(22, -58), head: P(0, -58), grip: P(0, 0), butt: P(0, 18) };
}
function drawHammer(ctx, o = {}) {
  const B = begin(ctx, o);
  const k = B.k;
  const W = PROP_COLORS.wood;
  // handle
  const handle = () => {
    ctx.beginPath();
    ctx.moveTo(-3, -50);
    ctx.lineTo(3, -50);
    ctx.bezierCurveTo(3.4, -20, 4.8, 4, 4.8, 15);
    ctx.quadraticCurveTo(4.8, 20, 0, 20);
    ctx.quadraticCurveTo(-4.8, 20, -4.8, 15);
    ctx.bezierCurveTo(-4.8, 4, -3.4, -20, -3, -50);
    ctx.closePath();
  };
  paint(ctx, handle, {
    fill: lin(ctx, -5, 0, 5, 0, [W.light, W.base, W.dark]), hi: W.hi, rim: [B.rim[0] * 0.8, 0], line: W.deep, lw: 1.3 * k,
    extra: () => {
      ctx.beginPath();
      ctx.moveTo(-1, -46); ctx.bezierCurveTo(-1.5, -20, -2, 0, -2.2, 10);
      ctx.moveTo(1.6, -40); ctx.bezierCurveTo(1.4, -24, 1.8, -10, 2, -2);
      ctx.strokeStyle = rgba(W.deep, 0.35);
      ctx.lineWidth = 0.7 * k;
      ctx.stroke();
      // red rubber grip
      ctx.fillStyle = lin(ctx, -5, 0, 5, 0, ['#F06A5E', '#D9473C', '#9E2820']);
      ctx.fillRect(-6, -4, 12, 25);
      ctx.beginPath();
      for (let yy = -1; yy < 18; yy += 3.4) { ctx.moveTo(-5, yy); ctx.lineTo(5, yy + 0.8); }
      ctx.strokeStyle = 'rgba(110,20,15,0.5)';
      ctx.lineWidth = 0.8 * k;
      ctx.stroke();
    },
  });
  // head
  const head = () => {
    ctx.beginPath();
    ctx.moveTo(-6, -64);
    ctx.lineTo(16, -64.5);
    ctx.quadraticCurveTo(18, -66.5, 22.5, -66);
    ctx.lineTo(22.5, -50);
    ctx.quadraticCurveTo(18, -49.5, 16, -51.5);
    ctx.lineTo(-6, -52);
    // claw
    ctx.bezierCurveTo(-14, -52, -22, -48, -28, -40);
    ctx.lineTo(-30, -42);
    ctx.bezierCurveTo(-26, -54, -18, -63, -6, -64);
    ctx.closePath();
  };
  paint(ctx, head, {
    fill: lin(ctx, 0, -66, 0, -48, ['#E4EBF0', '#A9B5C0', '#6E7B88']), hi: '#FFFFFF', rim: B.rim, line: '#3C4650', lw: 1.4 * k,
    extra: () => {
      ctx.beginPath();
      ctx.moveTo(-4, -61);
      ctx.lineTo(15, -61.4);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1.3 * k;
      ctx.stroke();
      // claw split
      ctx.beginPath();
      ctx.moveTo(-8, -58);
      ctx.bezierCurveTo(-16, -56, -22, -51, -27, -43);
      ctx.strokeStyle = 'rgba(40,50,60,0.6)';
      ctx.lineWidth = 0.9 * k;
      ctx.stroke();
    },
  });
  // striking face
  ellipse(ctx, 22.5, -58, 2.2, 8.2);
  ctx.fillStyle = '#C9D3DC';
  ctx.fill();
  ctx.strokeStyle = '#3C4650';
  ctx.lineWidth = 1.1 * k;
  ctx.stroke();
  // wedge
  ctx.beginPath();
  ctx.moveTo(-2.6, -64.5); ctx.lineTo(2.6, -64.5);
  ctx.strokeStyle = '#7A4F2E';
  ctx.lineWidth = 1.6 * k;
  ctx.stroke();
  ctx.restore();
}

// ═════════════════════════════════════════════════════════════════════ SUITCASE
function drawSuitcase(ctx, o = {}) {
  const B = begin(ctx, o);
  const k = B.k;
  const col = o.color || '#B9763E';
  const line = mix(col, '#000000', 0.55);
  // handle
  ctx.beginPath();
  ctx.moveTo(-8, 8);
  ctx.lineTo(-8, 3);
  ctx.quadraticCurveTo(-8, 0, -5, 0);
  ctx.lineTo(5, 0);
  ctx.quadraticCurveTo(8, 0, 8, 3);
  ctx.lineTo(8, 8);
  ctx.strokeStyle = '#3A2414';
  ctx.lineWidth = 4.4 * k;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.strokeStyle = '#6A4226';
  ctx.lineWidth = 2.4 * k;
  ctx.stroke();
  const body = () => roundRect(ctx, -22, 7, 44, 31, 5);
  paint(ctx, body, {
    fill: lin(ctx, 0, 7, 0, 38, [mix(col, '#FFFFFF', 0.12), col, mix(col, '#000000', 0.2)]), hi: mix(col, '#FFFFFF', 0.45), rim: B.rim, line, lw: 1.5 * k,
    extra: () => {
      // lid seam
      ctx.beginPath();
      ctx.moveTo(-22, 14.5); ctx.lineTo(22, 14.5);
      ctx.strokeStyle = rgba(line, 0.6);
      ctx.lineWidth = 1 * k;
      ctx.stroke();
      // straps
      ctx.fillStyle = mix(col, '#2A1608', 0.5);
      ctx.fillRect(-14, 6, 5, 33);
      ctx.fillRect(9, 6, 5, 33);
      if (o.sticker !== false) {
        // round travel sticker
        circle(ctx, -1, 26, 6.6);
        ctx.fillStyle = '#FFF2D2';
        ctx.fill();
        ctx.strokeStyle = '#E2463F';
        ctx.lineWidth = 1.4 * k;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-5, 29.5); ctx.lineTo(3, 29.5);
        ctx.strokeStyle = '#3E9A5A';
        ctx.lineWidth = 1.2 * k;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-1.2, 29.5);
        ctx.quadraticCurveTo(-1.6, 25, 0.6, 21.8);
        ctx.strokeStyle = '#8A5A2E';
        ctx.lineWidth = 1 * k;
        ctx.stroke();
        for (const a of [-2.6, -1.6, -0.5, 0.4]) {
          ctx.beginPath();
          ctx.moveTo(0.6, 21.8);
          ctx.quadraticCurveTo(0.6 + Math.cos(a) * 2.5, 21.8 + Math.sin(a) * 2.5 - 0.8, 0.6 + Math.cos(a) * 4.2, 21.8 + Math.sin(a) * 4.2 + 1);
          ctx.strokeStyle = '#3E9A5A';
          ctx.lineWidth = 1.1 * k;
          ctx.stroke();
        }
        // rectangular sticker
        ctx.save();
        ctx.translate(15.5, 23);
        ctx.rotate(0.25);
        roundRect(ctx, -4.5, -6, 9, 12, 1.5);
        ctx.fillStyle = '#4FA3D9';
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-4.5, -1.2, 9, 2.4);
        ctx.restore();
      }
    },
  });
  // brass corners + latches
  ctx.fillStyle = '#E3C25A';
  ctx.strokeStyle = '#8A6A1E';
  ctx.lineWidth = 0.8 * k;
  for (const [cx, cy] of [[-19.5, 9.5], [19.5, 9.5], [-19.5, 35.5], [19.5, 35.5]]) { circle(ctx, cx, cy, 2.2); ctx.fill(); ctx.stroke(); }
  for (const cx of [-11.5, 11.5]) { roundRect(ctx, cx - 2.2, 12.5, 4.4, 4.6, 1); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}

// ═════════════════════════════════════════════════════════════════════ ROCK
const ROCK_SHAPES = new Map();
function rockShape(seed) {
  const key = Math.round(seed * 1000);
  let v = ROCK_SHAPES.get(key);
  if (v) return v;
  const R = rng(seed * 3.7 + 11);
  const n = 8, pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + R.range(-0.22, 0.22);
    const rr = R.range(0.78, 1.06);
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.84]);
  }
  const pores = [];
  for (let i = 0; i < 11; i++) pores.push([R.range(-0.6, 0.6), R.range(-0.45, 0.55), R.range(0.035, 0.07)]);
  // cracks: branching polylines from near the centre toward the rim
  const cracks = [];
  for (let i = 0; i < 4; i++) {
    let a = (i / 4) * TAU + R.range(-0.4, 0.4);
    let px = Math.cos(a) * 0.12, py = Math.sin(a) * 0.1;
    const line = [[px, py]];
    for (let j = 0; j < 4; j++) {
      a += R.range(-0.6, 0.6);
      const L = R.range(0.16, 0.26);
      px += Math.cos(a) * L; py += Math.sin(a) * L * 0.85;
      line.push([px, py]);
    }
    cracks.push(line);
    if (R() < 0.7) {
      const at = line[2], b2 = a + R.range(0.7, 1.2) * (R() < 0.5 ? -1 : 1);
      cracks.push([at, [at[0] + Math.cos(b2) * 0.2, at[1] + Math.sin(b2) * 0.17], [at[0] + Math.cos(b2) * 0.34, at[1] + Math.sin(b2) * 0.3]]);
    }
  }
  v = { pts, pores, cracks };
  ROCK_SHAPES.set(key, v);
  return v;
}
function roundedPoly(ctx, pts, rr) {
  const n = pts.length;
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  ctx.beginPath();
  const m0 = mid(pts[n - 1], pts[0]);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i], m = mid(p, pts[(i + 1) % n]);
    ctx.arcTo(p[0], p[1], m[0], m[1], rr);
  }
  ctx.closePath();
}
function drawRock(ctx, o = {}) {
  const { x = 0, y = 0, r = 20, rot = 0, t = 0, seed = 1 } = o;
  const glowA = clamp(o.glow || 0), trail = clamp(o.trail || 0);
  const dir = o.dir != null ? o.dir : PI / 2;
  const C = PROP_COLORS.rock;
  const k = Math.pow(r / 20, 0.6);
  ctx.save();
  ctx.translate(x, y);
  if (o.alpha != null && o.alpha < 1) ctx.globalAlpha *= clamp(o.alpha);
  // trail (drawn in world-aligned space so it always streams behind the motion)
  if (trail > 0) {
    const back = dir + PI;
    const L = r * (2.6 + 4.6 * trail);
    ctx.save();
    ctx.rotate(back);
    // smoke puffs
    for (let i = 0; i < 9; i++) {
      const p = frac(t * 2.4 + i / 9);
      const d = r * 0.6 + p * L * 1.35;
      puff(ctx, d, Math.sin(t * 3 + i * 2) * r * 0.22 * p, r * (0.5 + 0.8 * p) * (0.6 + 0.4 * trail), i + seed * 3, PUFF_PAL.soot, (1 - p) * 0.75 * trail * Math.min(1, p * 6 + 0.2), 0.8 * k, t);
    }
    const fl = 0.85 + 0.15 * noise1(t * 11 + seed);
    const streak = (w, len, cols) => {
      ctx.beginPath();
      ctx.moveTo(0, -w);
      ctx.bezierCurveTo(len * 0.35, -w * 0.95, len * 0.75, -w * 0.25, len, 0);
      ctx.bezierCurveTo(len * 0.75, w * 0.25, len * 0.35, w * 0.95, 0, w);
      ctx.arc(0, 0, w, PI / 2, PI * 1.5);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, len, 0);
      cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
      ctx.fillStyle = g;
      ctx.fill();
    };
    streak(r * 1.05, L * fl, [rgba('#FF5A1F', 0.9 * trail), rgba('#FF3A1F', 0.5 * trail), rgba('#C8221A', 0)]);
    streak(r * 0.72, L * 0.7 * fl, [rgba('#FFB13B', trail), rgba('#FF7A2E', 0.6 * trail), rgba('#FF5A1F', 0)]);
    streak(r * 0.42, L * 0.42 * fl, [rgba('#FFF2B0', trail), rgba('#FFD06A', 0.5 * trail), rgba('#FFB13B', 0)]);
    // sparks
    for (let i = 0; i < 6; i++) {
      const p = frac(t * 3.1 + i * 0.173);
      const sx = r + p * L * 0.9, sy = (hash1(i + seed) - 0.5) * r * 1.6 * (0.4 + p);
      circle(ctx, sx, sy, r * 0.06 * (1 - p) + 0.4);
      ctx.fillStyle = rgba('#FFE08A', (1 - p) * trail);
      ctx.fill();
    }
    ctx.restore();
  }
  if (glowA > 0) glow(ctx, 0, 0, r * 2.2, '#FF6A22', 0.45 * glowA);
  ctx.rotate(rot);
  const S = rockShape(seed);
  const path = () => roundedPoly(ctx, S.pts.map(([px, py]) => [px * r, py * r]), r * 0.24);
  const hot = glowA;
  paint(ctx, path, {
    fill: lin(ctx, 0, -r, 0, r, [mix(C.top, '#8A5048', hot * 0.35), mix('#4C4752', '#5A3430', hot * 0.4), mix(C.bottom, '#6A2418', hot * 0.6)]),
    hi: mix(C.hi, '#FFB070', hot * 0.6), rim: rimVec({ rot }, 1.4 * r / 20, 2.6 * r / 20), line: mix(C.line, '#3A140C', hot * 0.5), lw: 1.7 * k,
    extra: () => {
      // facets
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, -r * 0.2);
      ctx.lineTo(-r * 0.2, -r * 0.62);
      ctx.lineTo(r * 0.35, -r * 0.5);
      ctx.lineTo(r * 0.05, -r * 0.1);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.09)';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(r * 0.05, -r * 0.1);
      ctx.lineTo(r * 0.35, -r * 0.5);
      ctx.lineTo(r * 0.85, -r * 0.1);
      ctx.lineTo(r * 0.4, r * 0.3);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fill();
      // vesicles
      for (const [px, py, pr] of S.pores) {
        ellipse(ctx, px * r, py * r, pr * r, pr * r * 0.8);
        ctx.fillStyle = 'rgba(20,16,24,0.45)';
        ctx.fill();
        ellipse(ctx, px * r + pr * r * 0.3, py * r + pr * r * 0.35, pr * r * 0.6, pr * r * 0.4);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fill();
      }
      // hot underside
      if (hot > 0) {
        const hd = dir - rot;
        const gx = Math.cos(hd) * r, gy = Math.sin(hd) * r;
        const hg = ctx.createRadialGradient(gx, gy, 0, gx, gy, r * 1.6);
        hg.addColorStop(0, rgba('#FF6A22', 0.75 * hot));
        hg.addColorStop(1, rgba('#FF6A22', 0));
        ctx.fillStyle = hg;
        ctx.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 3);
      }
      // cracks: dark when cold, glowing when hot
      ctx.beginPath();
      for (const line of S.cracks) line.forEach(([cx2, cy2], j) => (j ? ctx.lineTo(cx2 * r, cy2 * r) : ctx.moveTo(cx2 * r, cy2 * r)));
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (hot > 0) {
        const fl = 0.8 + 0.2 * noise1(t * 7 + seed);
        ctx.strokeStyle = rgba('#FF5A1F', 0.45 * hot * fl);
        ctx.lineWidth = r * 0.17;
        ctx.stroke();
        ctx.strokeStyle = rgba('#FFB13B', hot * fl);
        ctx.lineWidth = r * 0.075;
        ctx.stroke();
        ctx.strokeStyle = rgba('#FFF2B0', hot * fl);
        ctx.lineWidth = r * 0.025;
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(20,16,24,0.5)';
        ctx.lineWidth = 1 * k;
        ctx.stroke();
      }
    },
  });
  ctx.restore();
}

// ═════════════════════════════════════════════════════════════════════ SMALL PROPS
function drawWhistle(ctx, o = {}) {
  const B = begin(ctx, o);
  const k = B.k;
  if (o.cord !== false) {
    ctx.beginPath();
    ctx.moveTo(9, 9);
    ctx.bezierCurveTo(16, 26, 4, 40, -8, 34);
    ctx.bezierCurveTo(-18, 28, -10, 14, 0, 10);
    ctx.strokeStyle = '#8E1E18';
    ctx.lineWidth = 3.2 * k;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.strokeStyle = '#E2463F';
    ctx.lineWidth = 2 * k;
    ctx.stroke();
  }
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(-26, -9.5);
    ctx.lineTo(-2, -9.5);
    ctx.arc(2, 0.5, 11, -1.95, PI * 0.95 + 1.2);
    ctx.lineTo(-7, -1);
    ctx.lineTo(-26, -1);
    ctx.quadraticCurveTo(-28.5, -1, -28.5, -3.5);
    ctx.lineTo(-28.5, -7);
    ctx.quadraticCurveTo(-28.5, -9.5, -26, -9.5);
    ctx.closePath();
  };
  paint(ctx, shape, {
    fill: lin(ctx, 0, -11, 0, 11, ['#F4F7FA', '#B9C4CE', '#7A8794']), hi: '#FFFFFF', rim: B.rim, line: '#3E4A56', lw: 1.4 * k,
    extra: () => {
      ctx.beginPath();
      ctx.moveTo(-25, -7.2); ctx.lineTo(-4, -7.2);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.2 * k;
      ctx.stroke();
      ellipse(ctx, 6, 3, 3.6, 2, -0.5);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fill();
    },
  });
  // air slot + ring
  roundRect(ctx, -6.5, -10.6, 6, 3.4, 1);
  ctx.fillStyle = '#2A323A';
  ctx.fill();
  circle(ctx, 9, 9, 3.2);
  ctx.strokeStyle = '#6E7B88';
  ctx.lineWidth = 1.4 * k;
  ctx.stroke();
  ctx.restore();
}
function drawFlashlight(ctx, o = {}) {
  const B = begin(ctx, o);
  const k = B.k;
  if (o.on) {
    const L = o.beam || 220;
    const fl = 0.92 + 0.08 * noise1((o.t || 0) * 13);
    ctx.beginPath();
    ctx.moveTo(26, -8);
    ctx.lineTo(26 + L, -L * 0.32);
    ctx.quadraticCurveTo(26 + L * 1.08, 0, 26 + L, L * 0.32);
    ctx.lineTo(26, 8);
    ctx.closePath();
    const g = ctx.createLinearGradient(26, 0, 26 + L, 0);
    g.addColorStop(0, rgba('#FFF4C2', 0.7 * fl));
    g.addColorStop(1, rgba('#FFF4C2', 0));
    ctx.fillStyle = g;
    ctx.fill();
    glow(ctx, 27, 0, 22, '#FFF6D0', 0.9 * fl);
  }
  // body
  const body = () => roundRect(ctx, -30, -6.5, 42, 13, 4);
  paint(ctx, body, {
    fill: lin(ctx, 0, -7, 0, 7, ['#FFE07A', '#FFC23C', '#D9961A']), hi: '#FFF2B8', rim: B.rim, line: '#8A5A10', lw: 1.3 * k,
    extra: () => {
      ctx.fillStyle = '#2E2F36';
      for (let i = 0; i < 4; i++) ctx.fillRect(-25 + i * 5, -7, 2.4, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(-30, -4.6, 42, 1.6);
    },
  });
  // head
  const head = () => {
    ctx.beginPath();
    ctx.moveTo(11, -6.5);
    ctx.lineTo(18, -10);
    ctx.lineTo(25, -10);
    ctx.quadraticCurveTo(27, -10, 27, -8);
    ctx.lineTo(27, 8);
    ctx.quadraticCurveTo(27, 10, 25, 10);
    ctx.lineTo(18, 10);
    ctx.lineTo(11, 6.5);
    ctx.closePath();
  };
  paint(ctx, head, { fill: lin(ctx, 0, -10, 0, 10, ['#5A5C66', '#2E2F36', '#1A1B20']), hi: '#8A8C96', rim: B.rim, line: '#121216', lw: 1.3 * k });
  ellipse(ctx, 27, 0, 2.2, 8.6);
  ctx.fillStyle = o.on ? '#FFFBE6' : '#CFE3EE';
  ctx.fill();
  ctx.strokeStyle = '#121216';
  ctx.lineWidth = 1 * k;
  ctx.stroke();
  // switch
  roundRect(ctx, -4, -9.5, 7, 4, 1.6);
  ctx.fillStyle = '#E2463F';
  ctx.fill();
  ctx.strokeStyle = '#7A1B18';
  ctx.lineWidth = 0.9 * k;
  ctx.stroke();
  // lanyard loop at the tail
  ctx.beginPath();
  ctx.arc(-33, 0, 3.4, 0, TAU);
  ctx.strokeStyle = '#2E2F36';
  ctx.lineWidth = 1.4 * k;
  ctx.stroke();
  ctx.restore();
}
function bandStrip(ctx, k, rimv) {
  const strip = () => roundRect(ctx, -24, -6.5, 48, 13, 6.5);
  paint(ctx, strip, {
    fill: lin(ctx, 0, -7, 0, 7, ['#F2C79A', '#E2AE7C', '#C98F5C']), hi: '#FFE2C2', rim: rimv, line: '#A06A3C', lw: 1.2 * k,
    extra: () => {
      ctx.fillStyle = '#B98455';
      for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) for (let j = -1; j <= 1; j += 2) { circle(ctx, sx * (15 + i * 3), j * 2.4, 0.55); ctx.fill(); }
    },
  });
  roundRect(ctx, -9, -5, 18, 10, 2.5);
  ctx.fillStyle = '#FFF4E6';
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,106,60,0.5)';
  ctx.lineWidth = 0.8 * k;
  ctx.stroke();
}
function drawBandage(ctx, o = {}) {
  const B = begin(ctx, o);
  const k = B.k;
  const type = o.type || 'roll';
  if (type === 'strip') bandStrip(ctx, k, B.rim);
  else if (type === 'cross') {
    ctx.save(); ctx.rotate(0.75); bandStrip(ctx, k, B.rim); ctx.restore();
    ctx.save(); ctx.rotate(-0.75); bandStrip(ctx, k, B.rim); ctx.restore();
  } else {
    // loose tail
    ctx.beginPath();
    ctx.moveTo(-8, 12);
    ctx.bezierCurveTo(4, 18, 18, 10, 30, 18);
    ctx.lineTo(31, 27);
    ctx.bezierCurveTo(18, 20, 4, 28, -8, 22);
    ctx.closePath();
    ctx.fillStyle = '#F4F2EA';
    ctx.fill();
    ctx.strokeStyle = '#A7AEB6';
    ctx.lineWidth = 1.1 * k;
    ctx.stroke();
    ctx.beginPath();
    for (let i = 1; i < 6; i++) { ctx.moveTo(-6 + i * 6, 15 + (i % 2)); ctx.lineTo(-6 + i * 6, 23 + (i % 2)); }
    ctx.strokeStyle = 'rgba(167,174,182,0.5)';
    ctx.lineWidth = 0.6 * k;
    ctx.stroke();
    // roll body (cylinder seen 3/4)
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(-18, -12);
      ctx.lineTo(8, -12);
      ctx.ellipse(8, 5, 6.5, 17, 0, -PI / 2, PI / 2);
      ctx.lineTo(-18, 22);
      ctx.closePath();
    };
    paint(ctx, body, {
      fill: lin(ctx, 0, -12, 0, 22, ['#FFFFFF', '#EEF0EE', '#C9CFD4']), hi: '#FFFFFF', rim: B.rim, line: '#8E99A4', lw: 1.3 * k,
      extra: () => {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) { ctx.moveTo(-15 + i * 5, -12); ctx.lineTo(-15 + i * 5, 22); }
        ctx.strokeStyle = 'rgba(160,170,180,0.25)';
        ctx.lineWidth = 0.7 * k;
        ctx.stroke();
      },
    });
    ellipse(ctx, -18, 5, 6.5, 17);
    ctx.fillStyle = '#F7F8F6';
    ctx.fill();
    ctx.strokeStyle = '#8E99A4';
    ctx.lineWidth = 1.3 * k;
    ctx.stroke();
    ctx.beginPath();
    for (const rr of [0.75, 0.5]) { ctx.ellipse(-18, 5, 6.5 * rr, 17 * rr, 0, 0, TAU); }
    ctx.strokeStyle = 'rgba(142,153,164,0.55)';
    ctx.lineWidth = 0.7 * k;
    ctx.stroke();
    ellipse(ctx, -18, 5, 2, 5.5);
    ctx.fillStyle = '#C8CDD2';
    ctx.fill();
    // little red cross print
    ctx.fillStyle = '#E2463F';
    ctx.fillRect(-4, -1, 3, 10);
    ctx.fillRect(-7.5, 2.5, 10, 3);
  }
  ctx.restore();
}
function drawMap(ctx, o = {}) {
  const B = begin(ctx, o);
  const k = B.k;
  const W = 66, H = 46, n = 3, pw = W / n;
  // panels zig-zag fold
  for (let i = 0; i < n; i++) {
    const x0 = -W / 2 + i * pw;
    const up = i % 2 === 0;
    const sk = 2.4;
    const panel = () => {
      ctx.beginPath();
      ctx.moveTo(x0, -H / 2 + (up ? 0 : sk));
      ctx.lineTo(x0 + pw, -H / 2 + (up ? sk : 0));
      ctx.lineTo(x0 + pw, H / 2 + (up ? sk : 0));
      ctx.lineTo(x0, H / 2 + (up ? 0 : sk));
      ctx.closePath();
    };
    paint(ctx, panel, {
      fill: lin(ctx, x0, 0, x0 + pw, 0, up ? ['#FFF2CF', '#F0DBA8'] : ['#E8CF98', '#F6E6BC']), hi: '#FFF8E4', rim: [0, B.rim[1] * 0.6], line: '#9C7C4C', lw: 1.1 * k,
      extra: () => {
        if (i === 0) {
          ctx.fillStyle = '#9CCB7A';
          blob(ctx, [[x0 + 3, -12], [x0 + 12, -17], [x0 + 20, -10], [x0 + 16, 2], [x0 + 5, 0]], 1);
          ctx.fill();
        }
        if (i === 2) {
          // the volcano
          ctx.beginPath();
          ctx.moveTo(x0 + 4, -2); ctx.lineTo(x0 + 11, -15); ctx.lineTo(x0 + 15, -15); ctx.lineTo(x0 + 21, -2); ctx.closePath();
          ctx.fillStyle = '#8E8FA6';
          ctx.fill();
          ctx.fillStyle = '#FF7A2E';
          ctx.fillRect(x0 + 11, -16, 4, 2);
          ctx.fillStyle = 'rgba(110,110,130,0.6)';
          circle(ctx, x0 + 14, -19, 2.4); ctx.fill();
          circle(ctx, x0 + 16.5, -21.5, 1.8); ctx.fill();
        }
      },
    });
  }
  // river + dotted escape route + X
  ctx.beginPath();
  ctx.moveTo(-W / 2 + 2, 14);
  ctx.bezierCurveTo(-18, 6, -6, 18, 8, 12);
  ctx.strokeStyle = '#5CA9D6';
  ctx.lineWidth = 2.6 * k;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(20, 2);
  ctx.bezierCurveTo(10, 10, 0, -8, -14, 0);
  ctx.bezierCurveTo(-20, 4, -24, 10, -26, 12);
  ctx.setLineDash([2.2, 2.4]);
  ctx.strokeStyle = '#D9473C';
  ctx.lineWidth = 1.4 * k;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(-29, 9); ctx.lineTo(-24, 15);
  ctx.moveTo(-24, 9); ctx.lineTo(-29, 15);
  ctx.strokeStyle = '#B8211A';
  ctx.lineWidth = 1.9 * k;
  ctx.stroke();
  ctx.restore();
}
function drawCandle(ctx, o = {}) {
  const B = begin(ctx, o);
  const k = B.k, t = o.t || 0;
  const lit = o.lit !== false;
  if (lit) glow(ctx, 0, -48, 44, '#FFC56A', 0.28 + 0.04 * noise1(t * 5));
  const jar = () => {
    ctx.beginPath();
    ctx.moveTo(-15, -40);
    ctx.lineTo(15, -40);
    ctx.quadraticCurveTo(17.5, -40, 17.5, -37);
    ctx.lineTo(17.5, -4);
    ctx.quadraticCurveTo(17.5, 0, 13.5, 0);
    ctx.lineTo(-13.5, 0);
    ctx.quadraticCurveTo(-17.5, 0, -17.5, -4);
    ctx.lineTo(-17.5, -37);
    ctx.quadraticCurveTo(-17.5, -40, -15, -40);
    ctx.closePath();
  };
  paint(ctx, jar, {
    fill: lin(ctx, -18, 0, 18, 0, ['#B9A2DC', '#D8C8F0', '#A88ED0']), hi: '#F1E9FF', rim: B.rim, line: '#6E5A96', lw: 1.3 * k,
    extra: () => {
      // wax top + glass rim
      ellipse(ctx, 0, -34, 14.5, 3);
      ctx.fillStyle = '#EDE3FA';
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(-17.5, -40, 35, 4);
      // label band
      ctx.fillStyle = '#FFF7EA';
      ctx.fillRect(-18, -27, 36, 17);
      ctx.fillStyle = 'rgba(160,130,200,0.5)';
      ctx.fillRect(-18, -27, 36, 1.2);
      ctx.fillRect(-18, -11.2, 36, 1.2);
      // glass shine
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(-13, -38, 2.6, 34);
    },
  });
  ctx.save();
  ctx.scale(B.f, 1);
  ctx.font = `400 8.6px Yeseva`;
  ctx.fillStyle = '#6A4C9C';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lbl = o.label != null ? String(o.label) : 'Serenity';
  const lw = textW(lbl, 8.6, 400, 'Yeseva');
  const sx = lw > 32 ? 32 / lw : 1;
  ctx.save();
  ctx.translate(0, -18.4);
  ctx.scale(sx, 1);
  ctx.fillText(lbl, 0, 0);
  ctx.restore();
  ctx.restore();
  // little sprig on the label
  ctx.beginPath();
  ctx.moveTo(-14, -13);
  ctx.quadraticCurveTo(-11, -16, -8.5, -14.8);
  ctx.strokeStyle = '#7FAE6A';
  ctx.lineWidth = 0.8 * k;
  ctx.stroke();
  // wick + flame
  ctx.beginPath();
  ctx.moveTo(0, -35);
  ctx.lineTo(0.4, -40);
  ctx.strokeStyle = '#3A2A20';
  ctx.lineWidth = 1.2 * k;
  ctx.stroke();
  if (lit) flame(ctx, 0.4, -39.5, 14, 6.4, t, 3.3);
  ctx.restore();
}
function drawNotepad(ctx, o = {}) {
  const B = begin(ctx, o);
  const k = B.k;
  const pad = () => roundRect(ctx, -26, -32, 52, 66, 3);
  ctx.save();
  ctx.translate(1.6, 2.4);
  pad();
  ctx.fillStyle = '#5E4A3A';
  ctx.fill();
  ctx.restore();
  paint(ctx, pad, {
    fill: lin(ctx, 0, -32, 0, 34, ['#FFFDF4', '#F6EFDB']), hi: '#FFFFFF', rim: B.rim, line: '#8C8370', lw: 1.2 * k,
    extra: () => {
      ctx.beginPath();
      for (let yy = -18; yy < 32; yy += 6) { ctx.moveTo(-26, yy); ctx.lineTo(26, yy); }
      ctx.strokeStyle = 'rgba(110,160,210,0.55)';
      ctx.lineWidth = 0.6 * k;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-17, -32); ctx.lineTo(-17, 34);
      ctx.strokeStyle = 'rgba(226,90,80,0.6)';
      ctx.lineWidth = 0.7 * k;
      ctx.stroke();
      if (o.lines && o.lines.length) {
        ctx.save();
        ctx.scale(B.f, 1);
        o.lines.slice(0, 7).forEach((ln, i) => {
          paintText(ctx, String(ln), 3 * B.f, -21 + i * 6 + 0.6, 5.4, { color: '#2B3A66', weight: 600, font: 'Nunito', jitter: 0.6, seed: i * 3 + 1, maxW: 40 });
        });
        ctx.restore();
      } else {
        const sc = o.scribble != null ? o.scribble : 1;
        ctx.beginPath();
        const R = rng(5);
        for (let i = 0; i < 6; i++) {
          const yy = -21 + i * 6;
          const len = 36 * sc * R.range(0.4, 1);
          if (len < 1) continue;
          ctx.moveTo(-14, yy);
          for (let x2 = 0; x2 < len; x2 += 2.4) ctx.lineTo(-14 + x2, yy + Math.sin(x2 * 1.3 + i) * 1.3);
        }
        ctx.strokeStyle = '#3A4A7A';
        ctx.lineWidth = 0.9 * k;
        ctx.stroke();
      }
    },
  });
  // spiral coils
  for (let i = 0; i < 9; i++) {
    const cx = -21 + i * 5.25;
    ctx.beginPath();
    ctx.ellipse(cx, -32, 1.9, 4, 0, PI * 0.9, PI * 2.1);
    ctx.strokeStyle = '#7C8590';
    ctx.lineWidth = 1.4 * k;
    ctx.stroke();
    circle(ctx, cx, -29.5, 0.9);
    ctx.fillStyle = '#5E4A3A';
    ctx.fill();
  }
  if (o.pencil) {
    ctx.save();
    ctx.translate(18, 14);
    ctx.rotate(-0.9);
    const pencil = () => {
      ctx.beginPath();
      ctx.moveTo(-26, -3);
      ctx.lineTo(16, -3);
      ctx.lineTo(24, 0);
      ctx.lineTo(16, 3);
      ctx.lineTo(-26, 3);
      ctx.closePath();
    };
    paint(ctx, pencil, { fill: lin(ctx, 0, -3, 0, 3, ['#FFD95A', '#F2B92A']), hi: '#FFF0A8', rim: [0, 0.8], line: '#8A6A10', lw: 1 * k });
    ctx.beginPath();
    ctx.moveTo(16, -3); ctx.lineTo(24, 0); ctx.lineTo(16, 3); ctx.closePath();
    ctx.fillStyle = '#F2D0A0';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(21, -1.1); ctx.lineTo(24, 0); ctx.lineTo(21, 1.1); ctx.closePath();
    ctx.fillStyle = '#3A3A44';
    ctx.fill();
    roundRect(ctx, -31, -3, 6, 6, 1.6);
    ctx.fillStyle = '#F29AA0';
    ctx.fill();
    ctx.fillStyle = '#B9C0C8';
    ctx.fillRect(-26, -3, 3, 6);
    ctx.restore();
  }
  ctx.restore();
}
function drawChart(ctx, o = {}) {
  const B = begin(ctx, o);
  const k = B.k;
  const prog = o.progress != null ? clamp(o.progress) : 1;
  const W = PROP_COLORS.wood;
  // handle
  const handle = () => roundRect(ctx, -4.5, -40, 9, 42, 3);
  paint(ctx, handle, { fill: lin(ctx, -5, 0, 5, 0, [W.light, W.base, W.dark]), hi: W.hi, rim: [B.rim[0] * 0.8, 0], line: W.deep, lw: 1.2 * k });
  const board = () => roundRect(ctx, -48, -112, 96, 76, 5);
  paint(ctx, board, { fill: lin(ctx, 0, -112, 0, -36, ['#CF9A63', W.base, '#986338']), hi: W.hi, rim: B.rim, line: W.deep, lw: 1.5 * k });
  const paper = () => roundRect(ctx, -41, -105, 82, 62, 2);
  paint(ctx, paper, {
    fill: '#FFFCF2', hi: '#FFFFFF', rim: [0.5, 1], line: '#B5A98E', lw: 1 * k,
    extra: () => {
      ctx.beginPath();
      for (let gx = -30; gx < 40; gx += 10) { ctx.moveTo(gx, -100); ctx.lineTo(gx, -50); }
      for (let gy = -95; gy < -48; gy += 10) { ctx.moveTo(-34, gy); ctx.lineTo(38, gy); }
      ctx.strokeStyle = 'rgba(120,170,210,0.35)';
      ctx.lineWidth = 0.6 * k;
      ctx.stroke();
    },
  });
  // axes
  ctx.beginPath();
  ctx.moveTo(-33, -99); ctx.lineTo(-33, -50); ctx.lineTo(36, -50);
  ctx.strokeStyle = '#2B3A66';
  ctx.lineWidth = 1.4 * k;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.save();
  ctx.scale(B.f, 1);
  paintText(ctx, '°C', -26 * B.f, -95, 7, { color: '#2B3A66', weight: 700, jitter: 0.5, seed: 2 });
  ctx.restore();
  // zig-zag rising line, drawn progressively
  const pts = [[-30, -56], [-21, -60], [-14, -57], [-6, -67], [1, -64], [9, -76], [16, -73], [24, -88], [30, -94]];
  const nSeg = pts.length - 1, upto = prog * nSeg;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i <= nSeg; i++) {
    const u = clamp(upto - (i - 1));
    if (u <= 0) break;
    ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u));
  }
  ctx.strokeStyle = '#E2382F';
  ctx.lineWidth = 2.2 * k;
  ctx.stroke();
  if (prog >= 0.98) {
    // frowny face at the top
    circle(ctx, 33, -97, 5.4);
    ctx.fillStyle = '#FFF0C0';
    ctx.fill();
    ctx.strokeStyle = '#2B3A66';
    ctx.lineWidth = 1.1 * k;
    ctx.stroke();
    ctx.fillStyle = '#2B3A66';
    circle(ctx, 31.2, -98.4, 0.8); ctx.fill();
    circle(ctx, 34.8, -98.4, 0.8); ctx.fill();
    ctx.beginPath();
    ctx.arc(33, -93.4, 2.2, -PI * 0.85, -PI * 0.15);
    ctx.stroke();
  }
  // a nail at each top corner
  for (const nx of [-43, 43]) { circle(ctx, nx, -107, 1.6); ctx.fillStyle = '#4A3A30'; ctx.fill(); }
  ctx.restore();
}

// ═════════════════════════════════════════════════════════════════════ FX
function drawSweatDrop(ctx, o = {}) {
  const { x = 0, y = 0, r = 6, rot = 0 } = o;
  ctx.save();
  if (o.alpha != null && o.alpha < 1) ctx.globalAlpha *= clamp(o.alpha);
  const k = Math.pow(r / 6, 0.6);
  dropPath(ctx, x, y, r, rot, 2.1);
  const g = ctx.createLinearGradient(x - r, y - r * 2, x + r, y + r);
  g.addColorStop(0, '#E4F6FF');
  g.addColorStop(0.5, '#9ED8F7');
  g.addColorStop(1, '#5BB4E6');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#3485B8';
  ctx.lineWidth = 1.1 * k;
  ctx.stroke();
  const c = Math.cos(rot), s = Math.sin(rot);
  const P = (px, py) => [x + px * c - py * s, y + px * s + py * c];
  const h1 = P(-r * 0.38, -r * 0.05);
  ellipse(ctx, h1[0], h1[1], r * 0.2, r * 0.42, rot + 0.25);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();
  const h2 = P(r * 0.35, r * 0.55);
  circle(ctx, h2[0], h2[1], r * 0.12);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fill();
  ctx.restore();
}
function drawMotionLines(ctx, o = {}) {
  const { x = 0, y = 0, angle = 0, len = 70, count = 4, spread = 44, gap = 14, width = 3.2, color = '#FFFFFF', alpha = 0.9, t = 0, seed = 2 } = o;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  if (o.arc) {
    const { r = 60, a0 = -PI / 2, a1 = 0 } = o.arc;
    const span = a1 - a0;
    for (let i = 0; i < Math.max(1, count - 1); i++) {
      const rr = r + (i - (count - 2) / 2) * (width * 3.2);
      const aStart = a0 + span * (0.12 * i + 0.05 * hash1(seed + i));
      const wMax = width * (1 - i * 0.18);
      const N = 18;
      ctx.beginPath();
      for (let j = 0; j <= N; j++) {
        const u = j / N, a = lerp(aStart, a1, u), w = wMax * u;
        ctx.lineTo(Math.cos(a) * (rr + w / 2), Math.sin(a) * (rr + w / 2));
      }
      for (let j = N; j >= 0; j--) {
        const u = j / N, a = lerp(aStart, a1, u), w = wMax * u;
        ctx.lineTo(Math.cos(a) * (rr - w / 2), Math.sin(a) * (rr - w / 2));
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  ctx.rotate(angle);
  for (let i = 0; i < count; i++) {
    const u = count === 1 ? 0 : i / (count - 1) - 0.5;
    const off = u * spread + (hash1(seed + i * 5.1) - 0.5) * spread * 0.18;
    const L = len * (0.55 + 0.45 * hash1(seed + i * 2.1)) * (0.88 + 0.12 * noise1(t * 7 + i * 3));
    const x0 = -gap - hash1(seed * 3 + i) * 10 - Math.abs(u) * 12;
    const w = width * (0.75 + 0.5 * hash1(seed * 7 + i));
    ctx.beginPath();
    ctx.moveTo(x0, off - w / 2);
    ctx.lineTo(x0 - L, off);
    ctx.lineTo(x0, off + w / 2);
    ctx.arc(x0, off, w / 2, PI / 2, -PI / 2, true);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
function drawStars(ctx, o = {}) {
  const { x = 0, y = 0, r = 34, t = 0, count = 4, size = 9, tilt = 0.34, speed = 1.4, layer = 'both' } = o;
  ctx.save();
  ctx.translate(x, y);
  if (o.alpha != null && o.alpha < 1) ctx.globalAlpha *= clamp(o.alpha);
  const k = Math.pow(size / 9, 0.6);
  const items = [];
  for (let i = 0; i < count; i++) {
    const a = TAU * (t * speed * 0.6 + i / count);
    items.push({ i, a, d: Math.sin(a) });
  }
  items.sort((p, q) => p.d - q.d);
  for (const it of items) {
    const front = it.d > 0;
    if ((layer === 'back' && front) || (layer === 'front' && !front)) continue;
    const px = Math.cos(it.a) * r, py = Math.sin(it.a) * r * tilt;
    const sz = size * (0.72 + 0.28 * (it.d + 1) / 2);
    ctx.save();
    ctx.globalAlpha *= 0.65 + 0.35 * (it.d + 1) / 2;
    // little motion trail along the orbit
    ctx.beginPath();
    for (let j = 0; j <= 8; j++) {
      const aa = it.a - j * 0.07;
      ctx.lineTo(Math.cos(aa) * r, Math.sin(aa) * r * tilt);
    }
    ctx.strokeStyle = 'rgba(255,240,170,0.5)';
    ctx.lineWidth = sz * 0.3;
    ctx.lineCap = 'round';
    ctx.stroke();
    starPath(ctx, px, py, sz, 0.48, 5, t * 3 + it.i * 1.3);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#D98C12';
    ctx.lineWidth = sz * 0.34;
    ctx.stroke();
    ctx.fillStyle = '#FFD84A';
    ctx.fill();
    starPath(ctx, px - sz * 0.08, py - sz * 0.1, sz * 0.5, 0.5, 5, t * 3 + it.i * 1.3);
    ctx.fillStyle = '#FFF2A8';
    ctx.fill();
    circle(ctx, px - sz * 0.22, py - sz * 0.3, sz * 0.12);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
  }
  // twinkles
  if (layer !== 'back') {
    for (let i = 0; i < 3; i++) {
      const p = frac(t * 1.3 + i / 3);
      const a = TAU * (i / 3 + 0.17 + t * 0.2);
      const tx = Math.cos(a) * r * 1.25, ty = Math.sin(a) * r * tilt * 1.4 - 4;
      const ts = size * 0.5 * Math.sin(p * PI);
      ctx.beginPath();
      ctx.moveTo(tx, ty - ts); ctx.quadraticCurveTo(tx, ty, tx + ts, ty);
      ctx.quadraticCurveTo(tx, ty, tx, ty + ts); ctx.quadraticCurveTo(tx, ty, tx - ts, ty);
      ctx.quadraticCurveTo(tx, ty, tx, ty - ts);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();
    }
  }
  void k;
  ctx.restore();
}
function drawZzz(ctx, o = {}) {
  const { x = 0, y = 0, t = 0, scale = 1, count = 3, period = 2.6, color = '#F2F6FF', line = '#41507A' } = o;
  ctx.save();
  ctx.translate(x, y);
  if (o.alpha != null && o.alpha < 1) ctx.globalAlpha *= clamp(o.alpha);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < count; i++) {
    const p = frac(t / period + i / count);
    const px = (p * 40 + Math.sin(p * PI * 2 + i) * 5) * scale;
    const py = -p * 64 * scale;
    const sz = (12 + p * 15) * scale;
    const a = Math.min(1, p * 5) * (1 - smoothstep(0.7, 1, p));
    if (a <= 0) continue;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(px, py);
    ctx.rotate(-0.22 + Math.sin(p * PI * 2 + i) * 0.14);
    ctx.font = `700 ${sz}px ${FONT}`;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = line;
    ctx.lineWidth = sz * 0.2;
    ctx.strokeText('Z', 0, 0);
    ctx.fillStyle = color;
    ctx.fillText('Z', 0, 0);
    ctx.restore();
  }
  ctx.restore();
}
function puffLife(o, r) {
  if (o.life == null) return { rr: r, dy: 0, a: 1 };
  const L = clamp(o.life);
  return { rr: r * (0.45 + 0.75 * ease.outCubic(L)), dy: -r * 1.3 * L * (o.rise != null ? o.rise : 1), a: (1 - Math.pow(L, 1.6)) * Math.min(1, L * 8 + 0.15) };
}
function drawSteamPuff(ctx, o = {}) {
  const { x = 0, y = 0, r = 20, seed = 1, t = 0 } = o;
  const L = puffLife(o, r);
  const a = (o.alpha != null ? o.alpha : 0.9) * L.a;
  puff(ctx, x + Math.sin(t * 1.3 + seed) * r * 0.08, y + L.dy, L.rr, seed, PUFF_PAL.steam, a, 1.1 * Math.pow(r / 20, 0.5), t);
}
function drawSmokePuff(ctx, o = {}) {
  const { x = 0, y = 0, r = 24, seed = 2, t = 0, tone = 'grey' } = o;
  const L = puffLife(o, r);
  const a = (o.alpha != null ? o.alpha : 1) * L.a;
  puff(ctx, x + Math.sin(t * 1.1 + seed) * r * 0.06, y + L.dy, L.rr, seed, PUFF_PAL[tone] || PUFF_PAL.grey, a, 1.3 * Math.pow(r / 24, 0.5), t);
}
// Water splash where something drops into the pool/river. (x, y) = entry point ON the
// water surface; t = seconds since entry (nothing for t < 0, done after ~1.4 s).
// r ≈ half-width of the crown. big:true adds a tall centre jet (raft launch, big plops).
const WATER_DEF = { top: '#C9F4EE', mid: '#7FDCDC', base: '#5CC9C9', deep: '#2E8F9E', line: '#2A7F8C', foam: '#FFFFFF' };
function drawWaterSplash(ctx, o = {}) {
  const { x = 0, y = 0, r = 24, t = 0, seed = 4, big = false } = o;
  if (t < 0 || t > 1.6) return;
  const WATER = o.colors ? { ...WATER_DEF, ...o.colors } : WATER_DEF;
  const k = Math.pow(r / 24, 0.55);
  const R = rng(seed * 5.1 + 1);
  ctx.save();
  ctx.translate(x, y);
  if (o.alpha != null && o.alpha < 1) ctx.globalAlpha *= clamp(o.alpha);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // ripple rings on the surface (perspective ellipses)
  for (let i = 0; i < 3; i++) {
    const p = clamp((t - i * 0.16) / 1.25);
    if (p <= 0 || p >= 1) continue;
    const rx = r * (0.7 + 2.3 * ease.outCubic(p));
    ellipse(ctx, 0, 0, rx, rx * 0.24);
    ctx.strokeStyle = rgba(WATER.foam, 0.75 * (1 - p));
    ctx.lineWidth = (2.6 - 1.6 * p) * k;
    ctx.stroke();
  }
  // crown: a continuous water wall with a few splayed peaks (back half, then the front lip)
  const pc = clamp(t / 0.62);
  if (pc < 1) {
    const hgt = r * (big ? 1.45 : 1.1) * Math.sin(PI * Math.pow(pc, 0.65));
    const spread = r * (0.5 + 0.7 * ease.outCubic(pc));
    const wall = (backSide) => {
      const n = backSide ? 5 : 4;
      const sgn = backSide ? -1 : 1;
      const peaks = [];
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n;                       // 0..1 along the arc, left → right
        const a = PI - u * PI;                          // PI..0
        const bx = Math.cos(a) * spread, by = sgn * Math.sin(a) * spread * 0.26;
        const mid = 1 - Math.abs(u - 0.5) * 0.7; // taller toward the middle
        const h = hgt * mid * (backSide ? 0.5 + 0.5 * hash1(seed + i * 3.3) : 0.36 + 0.26 * hash1(seed * 2 + i));
        const lean = (hash1(seed * 1.3 + i * 7.7) - 0.5) * 0.3 * h;
        peaks.push({ bx, by, h, tx: bx * (1 + 0.6 * h / Math.max(1, r)) + lean, ty: by - h });
      }
      const base = (u) => { const a = PI - u * PI; return [Math.cos(a) * spread * 1.04, sgn * Math.sin(a) * spread * 0.27]; };
      const outline = () => {
        ctx.beginPath();
        let p0 = base(0);
        ctx.moveTo(p0[0], p0[1]);
        peaks.forEach((pk, i) => {
          const prevU = i / n, v = base(prevU);
          const vy = (i === 0 ? p0[1] : v[1] - hgt * (backSide ? 0.22 : 0.14));
          const vx = i === 0 ? p0[0] : v[0];
          ctx.quadraticCurveTo(lerp(vx, pk.tx, 0.6), vy, pk.tx, pk.ty);
          const nu = (i + 1) / n, nv = base(nu);
          const ny = i === n - 1 ? nv[1] : nv[1] - hgt * (backSide ? 0.22 : 0.14);
          ctx.quadraticCurveTo(lerp(nv[0], pk.tx, 0.6), ny, nv[0], ny);
        });
        // back along the base ellipse
        for (let j = 12; j >= 0; j--) { const q = base(j / 12); ctx.lineTo(q[0], q[1] + 1.5); }
        ctx.closePath();
      };
      outline();
      const gr = ctx.createLinearGradient(0, -hgt, 0, spread * 0.27);
      gr.addColorStop(0, WATER.top);
      gr.addColorStop(0.6, WATER.mid);
      gr.addColorStop(1, backSide ? WATER.base : WATER.mid);
      ctx.strokeStyle = WATER.line;
      ctx.lineWidth = 2.2 * k;
      ctx.stroke();
      ctx.fillStyle = gr;
      ctx.fill();
      // glossy streaks up the peaks
      ctx.beginPath();
      peaks.forEach((pk) => {
        ctx.moveTo(lerp(pk.bx, pk.tx, 0.15) - spread * 0.06, pk.by - pk.h * 0.12);
        ctx.quadraticCurveTo(lerp(pk.bx, pk.tx, 0.45) - spread * 0.07, pk.by - pk.h * 0.55, lerp(pk.bx, pk.tx, 0.92), pk.ty + pk.h * 0.1);
      });
      ctx.strokeStyle = rgba(WATER.foam, 0.9);
      ctx.lineWidth = 1.4 * k;
      ctx.stroke();
      // beads pinching off the tallest peaks
      peaks.forEach((pk, i) => {
        if (!backSide || hash1(seed * 5 + i * 1.9) < 0.45 || pc < 0.22) return;
        const lift = r * (0.12 + 0.3 * smoothstep(0.22, 0.9, pc)) * (0.6 + 0.4 * hash1(seed + i));
        const br = r * (0.06 + 0.03 * hash1(seed * 3 + i)) * (1 - pc * 0.4);
        circle(ctx, pk.tx * (1 + 0.15 * pc), pk.ty - br - lift, br);
        ctx.fillStyle = WATER.top;
        ctx.fill();
        ctx.strokeStyle = WATER.line;
        ctx.lineWidth = 1.1 * k;
        ctx.stroke();
      });
    };
    wall(true);
    // foam in the middle
    ellipse(ctx, 0, 0, spread * 0.85, spread * 0.2);
    ctx.fillStyle = rgba(WATER.foam, 0.9 * (1 - pc));
    ctx.fill();
    // centre jet (Worthington column) for big splashes
    if (big) {
      const pj = clamp((t - 0.12) / 0.6);
      if (pj > 0 && pj < 1) {
        const jh = r * 2.3 * Math.sin(PI * pj), jw = r * 0.2 * (1 - pj * 0.4);
        ctx.beginPath();
        ctx.moveTo(-jw * 1.4, 2);
        ctx.bezierCurveTo(-jw * 0.4, -jh * 0.3, -jw * 0.6, -jh * 0.8, 0, -jh);
        ctx.bezierCurveTo(jw * 0.6, -jh * 0.8, jw * 0.4, -jh * 0.3, jw * 1.4, 2);
        ctx.closePath();
        const gj = ctx.createLinearGradient(0, -jh, 0, 0);
        gj.addColorStop(0, WATER.top);
        gj.addColorStop(1, WATER.mid);
        ctx.strokeStyle = WATER.line;
        ctx.lineWidth = 2 * k;
        ctx.stroke();
        ctx.fillStyle = gj;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-jw * 0.35, -jh * 0.15);
        ctx.quadraticCurveTo(-jw * 0.45, -jh * 0.6, -jw * 0.1, -jh * 0.88);
        ctx.strokeStyle = rgba(WATER.foam, 0.9);
        ctx.lineWidth = 1.4 * k;
        ctx.stroke();
        circle(ctx, 0, -jh - jw * 0.9 - pj * r * 0.45, jw * 1.05);
        ctx.fillStyle = WATER.top;
        ctx.fill();
        ctx.strokeStyle = WATER.line;
        ctx.lineWidth = 1.2 * k;
        ctx.stroke();
      }
    }
    wall(false);
  }
  // flying droplets
  const nd = big ? 16 : 10;
  for (let i = 0; i < nd; i++) {
    const t0 = 0.04 + R() * 0.12;
    const tt = t - t0;
    if (tt <= 0) continue;
    const a = -PI / 2 + R.range(-1.1, 1.1);
    const v = r * R.range(4, 7.5) * (big ? 1.25 : 1);
    const vx = Math.cos(a) * v, vy = Math.sin(a) * v, g = r * 22;
    const px = vx * tt, py = vy * tt + 0.5 * g * tt * tt;
    if (py > r * 0.1) continue; // fell back in
    const dr = r * R.range(0.05, 0.1);
    dropPath(ctx, px, py, dr, trailAng(vx, vy + g * tt), 1.6, false, 0.5);
    ctx.fillStyle = WATER.top;
    ctx.fill();
    ctx.strokeStyle = WATER.line;
    ctx.lineWidth = 0.9 * k;
    ctx.stroke();
  }
  ctx.restore();
}
function drawImpactBurst(ctx, o = {}) {
  const { x = 0, y = 0, r = 56, text = 'BONK!', rot = -0.08, seed = 5 } = o;
  const t = o.t;
  let sc = 1, a = 1;
  if (t != null) {
    if (t < 0) return;
    sc = ease.outBack(clamp(t / 0.14), 2.2) * (1 - 0.15 * smoothstep(0.55, 0.8, t));
    a = 1 - smoothstep(0.55, 0.8, t);
    if (a <= 0) return;
  }
  const tt = t || 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot + (t != null ? Math.sin(tt * 30) * 0.03 * (1 - clamp(tt / 0.3)) : 0));
  ctx.globalAlpha *= a;
  ctx.scale(sc, sc);
  const k = Math.pow(r / 56, 0.6);
  // speed rays
  if (t == null || tt < 0.4) {
    const p = t == null ? 0.5 : clamp(tt / 0.4);
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const an = (i / 12) * TAU + 0.13;
      const r0 = r * (1.1 + p * 0.4), r1 = r * (1.4 + p * 0.55 + 0.2 * hash1(i + seed));
      ctx.moveTo(Math.cos(an) * r0, Math.sin(an) * r0);
      ctx.lineTo(Math.cos(an) * r1, Math.sin(an) * r1);
    }
    ctx.strokeStyle = rgba('#FFF4C8', 1 - p);
    ctx.lineWidth = 3 * k;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  burstPath(ctx, 12, r, r * 0.68, seed, 0.2, 1.12, 0.92);
  ctx.fillStyle = '#E2463F';
  ctx.fill();
  ctx.strokeStyle = '#7A1B18';
  ctx.lineWidth = 2.4 * k;
  ctx.lineJoin = 'round';
  ctx.stroke();
  burstPath(ctx, 12, r * 0.8, r * 0.56, seed + 3, 0.18, 1.12, 0.92);
  const g = ctx.createRadialGradient(-r * 0.1, -r * 0.15, 0, 0, 0, r * 0.85);
  g.addColorStop(0, '#FFFBD6');
  g.addColorStop(0.45, '#FFE45C');
  g.addColorStop(1, '#FFB52E');
  ctx.fillStyle = g;
  ctx.fill();
  if (text) {
    const tw = textW(text, 100, 700);
    const fs = Math.min(r * 0.5, (r * 1.5 / tw) * 100);
    paintText(ctx, text, 0, 0, fs, { color: '#C42A20', outline: '#FFFFFF', outlineW: fs * 0.22, shadow: '#7A1B18', shOff: [0.05, 0.08], jitter: 1.4, seed: seed + 1, dy0: 0.02 });
  }
  ctx.restore();
}
function wrapText(text, size, weight, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (cur && textW(test, size, weight) > maxW) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawSpeechBubble(ctx, o = {}) {
  const { x = 0, y = 0, text = '...', w = 240, size = 22, style = 'speech' } = o;
  const weight = 600;
  const lines = wrapText(text, size, weight, w - size * 1.4);
  const tw = Math.max(...lines.map((l) => textW(l, size, weight)));
  const bw = Math.max(size * 3, Math.min(w, tw + size * 1.6)), bh = lines.length * size * 1.22 + size * 1.1;
  const to = o.to || { x: x - bw * 0.28, y: y + bh / 2 + 34 };
  const ink = PROP_COLORS.ink;
  ctx.save();
  if (o.alpha != null && o.alpha < 1) ctx.globalAlpha *= clamp(o.alpha);
  const lwk = 2.2;
  if (style === 'thought') {
    const R = rng(9);
    const cl = [];
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      cl.push([x + Math.cos(a) * bw * 0.5, y + Math.sin(a) * bh * 0.52, Math.min(bw, bh) * R.range(0.22, 0.3)]);
    }
    const path = () => {
      ctx.beginPath();
      ellipse(ctx, x, y, bw * 0.5, bh * 0.52);
      for (const [cx, cy, cr] of cl) { ctx.moveTo(cx + cr, cy); ctx.arc(cx, cy, cr, 0, TAU); }
    };
    path();
    ctx.strokeStyle = ink;
    ctx.lineWidth = lwk * 2;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const u = 0.55 + i * 0.17;
      const cx = lerp(x, to.x, u), cy = lerp(y + bh * 0.4, to.y, u);
      circle(ctx, cx, cy, size * (0.42 - i * 0.11));
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = lwk;
      ctx.stroke();
    }
  } else {
    // body + tail as one outline
    const ang = Math.atan2(to.y - y, to.x - x);
    const bx = x + Math.cos(ang) * bw * 0.32, by = y + Math.sin(ang) * bh * 0.3;
    const perp = ang + PI / 2, tw2 = size * 0.55;
    const body = () => {
      if (style === 'shout') {
        ctx.save();
        ctx.translate(x, y);
        burstPath(ctx, 16, bw * 0.62, bw * 0.5, 3, 0.12, 1, bh / bw * 1.05);
        ctx.restore();
      } else roundRect(ctx, x - bw / 2, y - bh / 2, bw, bh, Math.min(bh * 0.48, size * 1.1));
    };
    const tail = () => {
      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(perp) * tw2, by + Math.sin(perp) * tw2);
      ctx.quadraticCurveTo(lerp(bx, to.x, 0.6) + Math.cos(perp) * tw2 * 0.3, lerp(by, to.y, 0.6) + Math.sin(perp) * tw2 * 0.3, to.x, to.y);
      ctx.quadraticCurveTo(lerp(bx, to.x, 0.5), lerp(by, to.y, 0.5), bx - Math.cos(perp) * tw2, by - Math.sin(perp) * tw2);
      ctx.closePath();
    };
    ctx.strokeStyle = ink;
    ctx.lineWidth = lwk * 2;
    ctx.lineJoin = 'round';
    body(); ctx.stroke();
    tail(); ctx.stroke();
    const fill = lin(ctx, 0, y - bh / 2, 0, y + bh / 2, ['#FFFFFF', '#FFFFFF', '#EEF1F5']);
    ctx.fillStyle = fill;
    body(); ctx.fill();
    tail(); ctx.fill();
  }
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, x, y + (i - (lines.length - 1) / 2) * size * 1.22 + size * 0.04));
  ctx.restore();
  return { w: bw, h: bh };
}

// ═════════════════════════════════════════════════════════════════════ LAB SHEETS
function sheetBg(ctx, a = '#CFE6F0', b = '#F4E7CF') {
  ctx.save();
  ctx.fillStyle = lin(ctx, 0, 0, 0, 720, [a, b]);
  ctx.fillRect(0, 0, 1280, 720);
  ctx.restore();
}
function lbl(ctx, text, x, y, size = 14, col = '#3A4250') {
  ctx.save();
  ctx.font = `600 ${size}px ${FONT}`;
  ctx.fillStyle = col;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}
function groundStrip(ctx, x0, x1, y) {
  ctx.save();
  ctx.fillStyle = lin(ctx, 0, y - 6, 0, y + 30, ['#7DBF6A', '#5FAF6A', '#3F8A55']);
  roundRect(ctx, x0, y - 4, x1 - x0, 34, 10);
  ctx.fill();
  ctx.restore();
}
function waterStrip(ctx, x0, x1, y, h = 60) {
  ctx.save();
  ctx.fillStyle = lin(ctx, 0, y, 0, y + h, ['#5CC9C9', '#2E8F9E']);
  ctx.fillRect(x0, y, x1 - x0, h);
  ctx.fillStyle = 'rgba(201,244,238,0.7)';
  ctx.fillRect(x0, y, x1 - x0, 2);
  ctx.restore();
}

const lab = {
  all(ctx, t) {
    sheetBg(ctx);
    const cw = 1280 / 7, ch = 720 / 5;
    const cell = (i, name, fn) => {
      const cx = (i % 7) * cw + cw / 2, cy = Math.floor(i / 7) * ch + ch / 2;
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      roundRect(ctx, cx - cw / 2 + 5, cy - ch / 2 + 5, cw - 10, ch - 10, 12);
      ctx.fill();
      ctx.restore();
      fn(cx, cy - 10);
      lbl(ctx, name, cx, cy + ch / 2 - 16, 13);
    };
    let i = 0;
    cell(i++, 'drawOrange', (x, y) => drawOrange(ctx, { x, y, r: 26, t }));
    cell(i++, 'orange squash .6 / 1', (x, y) => { drawOrange(ctx, { x: x - 42, y: y + 8, r: 17, squash: 0.6, t, seed: 2 }); drawOrange(ctx, { x: x + 40, y: y + 8, r: 17, squash: 1, t, seed: 3 }); });
    cell(i++, 'drawJuiceSplat t=.18', (x, y) => drawJuiceSplat(ctx, { x, y: y + 10, r: 26, t: 0.18 }));
    cell(i++, 'drawHelmet', (x, y) => drawHelmet(ctx, { x, y: y + 10, scale: 1.2 }));
    cell(i++, 'drawThermometer', (x, y) => drawThermometer(ctx, { x: x - 20, y: y + 42, scale: 0.85, level: thermoLevel(39.2), reading: '39.2' }));
    cell(i++, 'drawSign arrow', (x, y) => drawSign(ctx, { x, y: y + 40, text: 'EXIT', style: 'arrow', scale: 0.95 }));
    cell(i++, 'drawSign wood', (x, y) => drawSign(ctx, { x, y: y + 44, text: 'SNOOZE SPRINGS / No Worries Allowed', size: 17, scale: 0.82 }));
    cell(i++, 'drawRaft', (x, y) => drawRaft(ctx, { x: x - 16, y: y + 42, scale: 0.3, t }));
    cell(i++, 'drawBackpack', (x, y) => drawBackpack(ctx, { x, y: y + 44, scale: 0.9 }));
    cell(i++, 'backpack open', (x, y) => drawBackpack(ctx, { x, y: y + 44, scale: 0.9, open: 1 }));
    cell(i++, 'drawHammer', (x, y) => drawHammer(ctx, { x, y: y + 30, scale: 1.05, rot: 0.5 }));
    cell(i++, 'drawSuitcase', (x, y) => drawSuitcase(ctx, { x, y: y - 22, scale: 1.4 }));
    cell(i++, 'drawRock', (x, y) => drawRock(ctx, { x, y, r: 28, rot: 0.3 }));
    cell(i++, 'rock glow + trail', (x, y) => drawRock(ctx, { x: x + 26, y: y + 22, r: 14, glow: 1, trail: 0.4, dir: 2.3, t }));
    cell(i++, 'drawWhistle', (x, y) => drawWhistle(ctx, { x: x + 6, y: y - 8, scale: 1.4 }));
    cell(i++, 'drawFlashlight on', (x, y) => drawFlashlight(ctx, { x: x - 36, y, scale: 1.05, on: true, beam: 70, t }));
    cell(i++, 'drawBandage roll/strip', (x, y) => { drawBandage(ctx, { x: x - 36, y: y - 6, scale: 1.1 }); drawBandage(ctx, { x: x + 46, y, scale: 1, type: 'strip', rot: -0.4 }); });
    cell(i++, 'drawMap', (x, y) => drawMap(ctx, { x, y, scale: 1.4, rot: -0.06 }));
    cell(i++, 'drawCandle', (x, y) => drawCandle(ctx, { x, y: y + 36, scale: 1.25, t }));
    cell(i++, 'drawNotepad', (x, y) => drawNotepad(ctx, { x, y: y + 2, scale: 1, pencil: true }));
    cell(i++, 'drawChart', (x, y) => drawChart(ctx, { x, y: y + 52, scale: 0.75 }));
    cell(i++, 'drawSweatDrop', (x, y) => { drawSweatDrop(ctx, { x: x - 20, y, r: 12 }); drawSweatDrop(ctx, { x: x + 22, y: y + 6, r: 8, rot: 0.5 }); });
    cell(i++, 'drawMotionLines', (x, y) => { drawMotionLines(ctx, { x: x + 50, y, angle: 0, t, color: '#FFFFFF' }); drawRock(ctx, { x: x + 56, y, r: 12 }); });
    cell(i++, 'drawStars', (x, y) => drawStars(ctx, { x, y, t }));
    cell(i++, 'drawZzz', (x, y) => drawZzz(ctx, { x: x - 20, y: y + 30, t: t + 1 }));
    cell(i++, 'drawSteamPuff', (x, y) => drawSteamPuff(ctx, { x, y, r: 30, t }));
    cell(i++, 'drawSmokePuff', (x, y) => { drawSmokePuff(ctx, { x: x - 30, y, r: 26, t }); drawSmokePuff(ctx, { x: x + 36, y, r: 22, t, tone: 'dark', seed: 4 }); });
    cell(i++, 'drawWaterSplash t=.25', (x, y) => drawWaterSplash(ctx, { x, y: y + 34, r: 30, t: 0.25, big: true }));
    cell(i++, 'drawImpactBurst', (x, y) => drawImpactBurst(ctx, { x, y: y + 4, r: 40, t: 0.3 }));
    cell(i++, 'drawSpeechBubble', (x, y) => drawSpeechBubble(ctx, { x, y: y - 8, text: 'No reason.', w: 160, size: 18, to: { x: x - 50, y: y + 40 } }));
    cell(i++, 'thought / shout', (x, y) => { drawSpeechBubble(ctx, { x: x - 44, y: y - 10, text: 'hm', w: 70, size: 16, style: 'thought', to: { x: x - 70, y: y + 40 } }); drawSpeechBubble(ctx, { x: x + 46, y: y - 6, text: 'RUN!', w: 90, size: 18, style: 'shout', to: { x: x + 30, y: y + 44 } }); });
    cell(i++, 'sign burn .4', (x, y) => drawSign(ctx, { x, y: y + 46, text: 'EXIT', style: 'arrow', burn: 0.4, t, scale: 0.75 }));
    cell(i++, 'thermo broken .3', (x, y) => drawThermometer(ctx, { x, y: y + 42, scale: 0.85, level: 0.7, broken: 0.3, t }));
    cell(i++, 'raft build .55', (x, y) => drawRaft(ctx, { x, y: y + 30, scale: 0.36, t, build: 0.55 }));
    cell(i++, 'hammer swing', (x, y) => { drawMotionLines(ctx, { x: x - 30, y: y + 30, t, count: 3, arc: { r: 62, a0: -2.2, a1: -0.5 } }); drawHammer(ctx, { x: x - 30, y: y + 30, rot: 0.9, scale: 0.9 }); drawImpactBurst(ctx, { x: x + 40, y: y + 34, r: 22, text: '', t: 0.1 }); });
  },
  orange(ctx, t) {
    sheetBg(ctx);
    const sq = [0, 0.15, 0.3, 0.5, 0.75, 1];
    sq.forEach((s, i) => {
      const x = 130 + i * 205;
      drawOrange(ctx, { x, y: 180, r: 60, squash: s, t, seed: i });
      lbl(ctx, `squash ${s}`, x, 290);
    });
    // juice splat over time
    [0, 0.05, 0.12, 0.25, 0.45, 0.8].forEach((tt, i) => {
      const x = 130 + i * 205;
      drawJuiceSplat(ctx, { x, y: 470, r: 40, t: tt, puddle: true, floor: 50 });
      lbl(ctx, `splat t=${tt}`, x, 600);
    });
    drawOrange(ctx, { x: 640, y: 660, r: 16, t, rot: 0.3 });
    drawOrange(ctx, { x: 700, y: 664, r: 12, t, leaves: 2, seed: 4 });
    drawOrange(ctx, { x: 580, y: 662, r: 14, t, seed: 9, rot: -0.5 });
  },
  thermometer(ctx, t) {
    sheetBg(ctx, '#D7EEF4', '#EFE3CC');
    // levels
    [0, 0.25, thermoLevel(38.6), thermoLevel(39.2), thermoLevel(39.8), 1].forEach((lv, i) => {
      drawThermometer(ctx, { x: 50 + i * 62, y: 300, scale: 1.5, level: lv });
      lbl(ctx, `${lv.toFixed(2)}`, 50 + i * 62, 334, 13);
    });
    lbl(ctx, 'level (thermoLevel(°C))', 205, 356, 14);
    // close-up with reading tag + printed scale
    ctx.save();
    ctx.fillStyle = lin(ctx, 0, 420, 0, 720, ['#5CC9C9', '#2E8F9E']);
    ctx.fillRect(400, 430, 330, 290);
    ctx.restore();
    drawThermometer(ctx, { x: 470, y: 660, scale: 4.4, level: thermoLevel(39.4), reading: '39.4', t });
    lbl(ctx, 'close-up: reading tag (over water)', 565, 708, 14, '#FFFFFF');
    drawThermometer(ctx, { x: 790, y: 250, scale: 1.4, level: 0.62, reading: '38.6', rot: -1.2, t });
    lbl(ctx, 'rot -1.2 (tag upright)', 830, 290, 13);
    drawThermometer(ctx, { x: 1010, y: 300, scale: 1.6, level: thermoLevel(39.8), reading: '39.8', flip: true, tagSide: 'left', t });
    lbl(ctx, 'flip + tagSide left', 990, 334, 13);
    // breaking sequence (bulb), and the animated pop driven by t
    const seq = [0, 0.08, 0.14, 0.18, 0.26, 0.4, 0.62, 1];
    seq.forEach((b, i) => {
      const x = 800 + i * 62;
      drawThermometer(ctx, { x, y: 640, scale: 1.25, level: 0.96, broken: b, t: t + i * 0.013 });
      lbl(ctx, `${b}`, x, 676, 12);
    });
    lbl(ctx, 'broken 0..1  (pops at 0.16)', 1015, 700, 14);
    const bb = clamp((t % 1.6) / 1.2);
    drawThermometer(ctx, { x: 1190, y: 400, scale: 1.6, level: lerp(thermoLevel(39.8), 1, smoothstep(0, 0.15, bb)), broken: bb, t });
    lbl(ctx, `animated: broken ${bb.toFixed(2)}`, 1170, 434, 12);
  },
  thermo_pop(ctx, t) {
    sheetBg(ctx, '#2B2440', '#6B4C8A');
    const b = clamp(t / 1.2);
    drawThermometer(ctx, { x: 400, y: 600, scale: 4.2, level: thermoLevel(39.8), broken: b, reading: b < 0.03 ? '39.8' : null, t });
    drawThermometer(ctx, { x: 900, y: 620, scale: 3.6, level: 0.6, broken: b, breakAt: 'top', t });
    lbl(ctx, `bulb  broken=${b.toFixed(2)}`, 400, 680, 18, '#FFFFFF');
    lbl(ctx, 'breakAt top', 900, 680, 18, '#FFFFFF');
  },
  raft(ctx, t) {
    sheetBg(ctx, '#BFE3F0', '#F2E3C6');
    const stages = [0.06, 0.2, 0.4, 0.55, 0.68, 0.78, 0.9, 1];
    stages.forEach((b, i) => {
      const x = 150 + (i % 4) * 318, y = 300 + Math.floor(i / 4) * 330;
      groundStrip(ctx, x - 145, x + 145, y + 4);
      drawRaft(ctx, { x, y, scale: 0.56, t, build: b });
      lbl(ctx, `build ${b}`, x, y + 20, 14, '#FFFFFF');
    });
    lbl(ctx, 'bundles drop in 0-.42 · lashings .42-.7 · mast .7-.82 · banner .82-.95 · oar .95-1', 640, 40, 15);
  },
  raft_context(ctx, t) {
    sheetBg(ctx, '#F7A26B', '#6B4C8A');
    waterStrip(ctx, 0, 1280, 470, 250);
    const ro = { x: 560, y: 520, scale: 1.2, t, bob: 1, wake: 0.7, dir: -1 };
    drawRaft(ctx, ro);
    const A = raftAnchors(ro);
    let chars = null;
    try { chars = require('./characters'); } catch (e) { chars = null; }
    if (chars && chars.drawCapybara) {
      const sc = 0.6;
      const who = ['sunny', 'barry', 'doreen'];
      [A.seats[0], A.seats[1], A.seats[2]].forEach((p, i) => {
        try {
          chars.drawCapybara(ctx, { x: p.x + 20 * i, y: p.y - 58 * sc, scale: sc, who: who[i], pose: 'stand', t, mood: i === 1 ? 'smug' : 'chill', flip: i === 2, accessories: i === 1 ? { glasses: true, helmet: true } : {} });
        } catch (e) { /* sibling WIP */ }
      });
    }
    for (const p of [...A.seats, A.mastTop, A.flag, A.tipL, A.tipR]) { circle(ctx, p.x, p.y, 3.5); ctx.fillStyle = '#FF3B7F'; ctx.fill(); }
    // the flagCover anchor: where Gerald sits to hide "TOLD YOU SO"
    const c = A.flagCover;
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = '#FF3B7F';
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h);
    ctx.restore();
    lbl(ctx, 'flagCover', c.x, c.y - c.h / 2 - 12, 13, '#FFFFFF');
    lbl(ctx, 'raftAnchors: seats, mastTop, flag, tips (pink dots) · bob 1 · wake .7 heading left', 640, 700, 15, '#FFFFFF');
    // small flipped raft heading right, flag streaming the other way
    drawRaft(ctx, { x: 1110, y: 600, scale: 0.42, t, bob: 1, flip: true, wake: 1, dir: 1, flagDir: -1 });
    lbl(ctx, 'flip, flagDir -1', 1110, 640, 13, '#FFFFFF');
    drawRaft(ctx, { x: 1080, y: 300, scale: 0.36, t, bob: 1, flagShow: 4 });
    lbl(ctx, 'flagShow: 4', 1080, 330, 13, '#FFFFFF');
  },
  // props placed in Snooze Springs (uses env.js / characters.js when available)
  context(ctx, t) {
    let E = null, C = null;
    try { E = require('./env'); } catch (e) { E = null; }
    try { C = require('./characters'); } catch (e) { C = null; }
    const S = (E && E.SPRING) || { exitSignSpots: [{ x: 182, y: 452 }, { x: 290, y: 449 }, { x: 400, y: 446 }], raftMoor: { x: 70, y: 597 }, thermometerSpot: { x: 770, y: 598 } };
    if (E && E.drawSpringDay) E.drawSpringDay(ctx, t, {}); else { sheetBg(ctx); waterStrip(ctx, 0, 1280, 458, 262); }
    const ex = S.exitSignSpots;
    drawSign(ctx, { x: ex[0].x, y: ex[0].y, text: 'EXIT', style: 'arrow', scale: 0.62, seed: 1, t });
    drawSign(ctx, { x: ex[1].x, y: ex[1].y, lines: ['EVACUATION', 'ROUTE'], style: 'arrow', scale: 0.5, seed: 2, t });
    drawSign(ctx, { x: ex[2].x, y: ex[2].y, lines: ['NO, REALLY.', 'THIS WAY.'], style: 'arrow', scale: 0.5, seed: 3, t });
    drawSign(ctx, { x: 520, y: 452, text: 'YES, YOU, SUNNY', style: 'arrow', scale: 0.36, size: 20, seed: 5, t });
    drawSign(ctx, { x: 700, y: 452, lines: ['SPRING RULES', '1. Introduce yourself', '2. Say goodbye', '3. No vultures on heads'], scale: 0.42, seed: 9, t });
    drawRaft(ctx, { x: S.raftMoor.x, y: S.raftMoor.y, scale: 0.5, t, bob: 0.6 });
    const th = S.thermometerSpot;
    drawThermometer(ctx, { x: th.x, y: th.y - 6, scale: 0.75, rot: 0.12, level: thermoLevel(39.4), t });
    if (C && C.drawCapybara) {
      try { C.drawCapybara(ctx, { who: 'barry', x: 650, y: 600, t, pose: 'swim', mood: 'worried', accessories: { glasses: true, helmet: true } }); } catch (e) { /* sibling WIP */ }
      try { C.drawCapybara(ctx, { who: 'sunny', x: 360, y: 590, t, pose: 'swim', mood: 'chill', accessories: { orange: true, necklace: true } }); } catch (e) { /* sibling WIP */ }
      try { C.drawCapybara(ctx, { who: 'doreen', x: 945, y: 588, scale: 0.97, flip: true, t, pose: 'swim', mood: 'happy', accessories: { orange: true, flower: true } }); } catch (e) { /* sibling WIP */ }
    }
    if (E && E.drawWaterFront) { try { E.drawWaterFront(ctx, t, {}); } catch (e) { /* sibling WIP */ } }
    drawOrange(ctx, { x: 810, y: 640, r: 15, t, rot: 0.3 });
    drawHelmet(ctx, { x: 1050, y: 470, scale: 0.8, rot: -0.15 });
    drawBackpack(ctx, { x: 1110, y: 468, scale: 0.5, open: 0.3, rot: 0.08 });
    drawSteamPuff(ctx, { x: 560, y: 520, r: 22, life: frac(t * 0.3), t, seed: 2 });
    drawZzz(ctx, { x: 990, y: 520, t, scale: 0.8 });
  },
  // the eruption beats: orange/rock rain into the boiling spring, the bonk on Doreen's
  // orange, the rock bouncing off Barry's helmet, a sign catching fire
  context_erupt(ctx, t) {
    let E = null, C = null;
    try { E = require('./env'); } catch (e) { E = null; }
    try { C = require('./characters'); } catch (e) { C = null; }
    const eo = { setting: 'evening', dusk: 0.2, erupt: 0.5, waterHeat: 0.9, rumble: 0.5 };
    if (E && E.drawSpringEvening) E.drawSpringEvening(ctx, t, eo); else { sheetBg(ctx, '#F7A26B', '#6B4C8A'); waterStrip(ctx, 0, 1280, 458, 262); }
    const S = (E && E.SPRING) || { exitSignSpots: [{ x: 182, y: 452 }, { x: 290, y: 449 }, { x: 400, y: 446 }] };
    const ex = S.exitSignSpots;
    drawSign(ctx, { x: ex[0].x, y: ex[0].y, text: 'EXIT', style: 'arrow', scale: 0.62, seed: 1, t });
    drawSign(ctx, { x: ex[1].x, y: ex[1].y, lines: ['EVACUATION', 'ROUTE'], style: 'arrow', scale: 0.5, seed: 2, t });
    drawSign(ctx, { x: ex[2].x, y: ex[2].y, lines: ['NO, REALLY.', 'THIS WAY.'], style: 'arrow', scale: 0.5, seed: 3, t, burn: 0.35 });
    if (C && C.drawCapybara) {
      try { C.drawCapybara(ctx, { who: 'barry', x: 650, y: 600, t, pose: 'swim', mood: 'deadpan', accessories: { glasses: true, helmet: true } }); } catch (e) { /* sibling WIP */ }
      try { C.drawCapybara(ctx, { who: 'doreen', x: 945, y: 588, scale: 0.97, flip: true, t, pose: 'swim', mood: 'shock', accessories: { orange: 'squashed', flower: true, juice: 1 } }); } catch (e) { /* sibling WIP */ }
    }
    if (E && E.drawWaterFront) { try { E.drawWaterFront(ctx, t, eo); } catch (e) { /* sibling WIP */ } }
    // rain: a loop of falling oranges and hot rocks with splashes
    const loop = 1.8;
    const drops = [[300, 560, 'orange', 0], [480, 520, 'rock', 0.5], [820, 540, 'orange', 0.9], [1100, 560, 'rock', 1.3]];
    for (const [dx, dy, kind, off] of drops) {
      const tt = frac((t + off) / loop) * loop;
      const fallT = 0.55;
      if (tt < fallT) {
        const p = tt / fallT;
        const px = dx + (1 - p) * 120, py = dy - (1 - p * p) * 420;
        if (kind === 'orange') drawOrange(ctx, { x: px, y: py, r: 13, rot: t * 4 + off, t });
        else drawRock(ctx, { x: px, y: py, r: 15, glow: 1, trail: 0.7, dir: Math.atan2(840 * p, -120), t, rot: t * 3, seed: off * 10 });
      } else {
        drawWaterSplash(ctx, { x: dx, y: dy, r: kind === 'rock' ? 30 : 20, t: tt - fallT, seed: off * 7 + 1 });
      }
    }
    // bonk + juice on Doreen's orange, rock bouncing off Barry's helmet
    const tb = frac(t / 1.2) * 1.2;
    drawJuiceSplat(ctx, { x: 930, y: 488, r: 26, t: tb });
    drawImpactBurst(ctx, { x: 905, y: 430, r: 34, text: 'SPLAT!', t: tb, seed: 3 });
    const tr = frac((t + 0.4) / 1.2) * 1.2;
    drawImpactBurst(ctx, { x: 640, y: 470, r: 30, text: 'TINK!', t: tr, rot: 0.1 });
    drawRock(ctx, { x: 640 + tr * 160, y: 470 - tr * 220 + 0.5 * 500 * tr * tr, r: 11, rot: tr * 8, seed: 7 });
    drawMotionLines(ctx, { x: 640 + tr * 160, y: 470 - tr * 220 + 0.5 * 500 * tr * tr, angle: Math.atan2(-220 + 500 * tr, 160), len: 40, count: 3, spread: 22, t });
    for (let i = 0; i < 3; i++) drawSmokePuff(ctx, { x: 160 + i * 40, y: 470, r: 18, life: frac(t * 0.8 + i / 3), t, seed: i + 3, tone: 'dust' });
    // the env's colour grade sits over everything (props included)
    if (E && E.drawSpringOverlay) { try { E.drawSpringOverlay(ctx, t, { ...eo, grade: 1 }); } catch (e) { /* sibling WIP */ } }
  },
  signs(ctx, t) {
    sheetBg(ctx, '#BFE3F0', '#E9F2D8');
    groundStrip(ctx, 0, 1280, 220);
    groundStrip(ctx, 0, 1280, 470);
    groundStrip(ctx, 0, 1280, 690);
    // row 1: the montage's escape-route arrows (one per hammer hit)
    drawSign(ctx, { x: 90, y: 220, text: 'EXIT', style: 'arrow', seed: 1 });
    drawSign(ctx, { x: 315, y: 220, text: 'EVACUATION ROUTE', style: 'arrow', seed: 2 });
    drawSign(ctx, { x: 610, y: 220, text: 'NO, REALLY. THIS WAY.', style: 'arrow', seed: 3 });
    drawSign(ctx, { x: 830, y: 220, text: 'YES, YOU, SUNNY', style: 'arrow', size: 15, seed: 5 });
    drawSign(ctx, { x: 1005, y: 220, text: 'EXIT', style: 'wood', glyph: true, board: '#D9473C', seed: 4 });
    drawSign(ctx, { x: 1175, y: 220, lines: ['EVACUATION', 'ROUTE'], style: 'arrow', size: 18, seed: 12 });
    // row 2: planked signs
    drawSign(ctx, { x: 160, y: 470, text: 'SNOOZE SPRINGS / No Worries Allowed', seed: 6 });
    drawSign(ctx, { x: 450, y: 470, text: 'SNOOZE SPRINGS 2 / Barry Approved', seed: 7, size: 22 });
    drawSign(ctx, { x: 720, y: 470, text: 'S.S. TOLD YOU SO', size: 20, seed: 8 });
    drawSign(ctx, { x: 965, y: 470, lines: ['SPRING RULES', '1. Introduce yourself', '2. Say goodbye', '3. No vultures on heads'], size: 22, seed: 9 });
    // hammered in: drive 0→1 + post-hit wobble (animated with t)
    const hit = t % 1.4;
    drawSign(ctx, { x: 1180, y: 470, text: 'EXIT', style: 'arrow', drive: clamp(hit / 0.25), rot: signWobble(hit - 0.25), seed: 10 });
    lbl(ctx, 'drive + signWobble', 1180, 490, 12);
    // row 3: burning
    [0.2, 0.45, 0.7, 1].forEach((b, i) => {
      drawSign(ctx, { x: 170 + i * 310, y: 690, text: i % 2 ? 'SNOOZE SPRINGS / No Worries Allowed' : 'EVACUATION ROUTE', style: i % 2 ? 'wood' : 'arrow', burn: b, t, seed: 11 + i, size: 21 });
      lbl(ctx, `burn ${b}`, 170 + i * 310, 708, 12);
    });
  },
  fx(ctx, t) {
    sheetBg(ctx, '#9FD3E8', '#F3E2C4');
    const tt = frac(t / 1.2) * 1.2;
    drawJuiceSplat(ctx, { x: 120, y: 140, r: 34, t: tt });
    lbl(ctx, `juice splat t=${tt.toFixed(2)}`, 120, 250);
    drawImpactBurst(ctx, { x: 360, y: 130, r: 58, t: tt });
    lbl(ctx, 'impact burst', 360, 250);
    drawStars(ctx, { x: 580, y: 140, r: 50, t, size: 12 });
    lbl(ctx, 'dizzy stars', 580, 250);
    drawZzz(ctx, { x: 760, y: 200, t, scale: 1.3 });
    lbl(ctx, 'zzz', 790, 250);
    drawSweatDrop(ctx, { x: 920, y: 110 + frac(t) * 60, r: 12, alpha: 1 - frac(t) * 0.5 });
    drawSweatDrop(ctx, { x: 975, y: 140, r: 9, rot: 0.6 });
    lbl(ctx, 'sweat', 950, 250);
    const fall = frac(t / 1.5);
    drawRock(ctx, { x: 1090 + fall * 100, y: 60 + fall * 160, r: 18, glow: 1, trail: 1, dir: Math.atan2(160, 100), t, rot: t * 3 });
    lbl(ctx, 'falling hot rock', 1160, 250);
    for (let i = 0; i < 4; i++) {
      const life = frac(t * 0.5 + i / 4);
      drawSteamPuff(ctx, { x: 70 + i * 62, y: 400, r: 24, life, t, seed: i + 1 });
      drawSmokePuff(ctx, { x: 350 + i * 62, y: 400, r: 27, life, t, seed: i + 5, tone: 'dark' });
      drawSmokePuff(ctx, { x: 640 + i * 55, y: 400, r: 22, life, t, seed: i + 9, tone: 'dust' });
    }
    lbl(ctx, 'steam puffs (life)', 160, 460);
    lbl(ctx, 'smoke (dark)', 445, 460);
    lbl(ctx, 'dust', 720, 460);
    drawMotionLines(ctx, { x: 960, y: 360, angle: -0.3, t, len: 90 });
    drawRock(ctx, { x: 970, y: 356, r: 16, rot: t });
    drawMotionLines(ctx, { x: 1130, y: 420, t, count: 3, color: '#FFFFFF', arc: { r: 60, a0: -2.6, a1: -0.6 } });
    lbl(ctx, 'motion lines / swoosh', 1050, 460);
    // water splashes (t = seconds since entry), looping
    waterStrip(ctx, 0, 1280, 620, 100);
    const ts = frac(t / 1.6) * 1.6;
    drawWaterSplash(ctx, { x: 160, y: 640, r: 22, t: ts, seed: 2 });
    drawOrange(ctx, { x: 160, y: 640 - 160 + Math.min(160, 160 * Math.pow(clamp((ts + 0.3) / 0.3), 2)), r: 12, t, alpha: ts < 0.02 ? 1 : 0 });
    lbl(ctx, 'splash (orange plop)', 160, 700, 14, '#FFFFFF');
    drawWaterSplash(ctx, { x: 480, y: 650, r: 34, t: ts, seed: 5 });
    lbl(ctx, 'splash r34', 480, 700, 14, '#FFFFFF');
    drawWaterSplash(ctx, { x: 840, y: 660, r: 48, t: ts, big: true, seed: 8 });
    lbl(ctx, 'big splash', 840, 708, 14, '#FFFFFF');
    drawSign(ctx, { x: 1150, y: 600, text: 'EXIT', style: 'arrow', burn: 0.6, t, scale: 0.8 });
  },
  closeup(ctx, t) {
    sheetBg(ctx, '#CDE8F2', '#F6E6C8');
    drawOrange(ctx, { x: 180, y: 200, r: 120, t });
    drawHelmet(ctx, { x: 560, y: 240, scale: 4.2 });
    drawBackpack(ctx, { x: 930, y: 330, scale: 3, open: 0 });
    drawRock(ctx, { x: 1160, y: 200, r: 90, glow: 0.7, t });
    drawSign(ctx, { x: 260, y: 720, text: 'NO, REALLY. THIS WAY.', style: 'arrow', scale: 2.2, drips: 1 });
    drawCandle(ctx, { x: 620, y: 690, scale: 3.4, t });
    drawRaft(ctx, { x: 1060, y: 660, scale: 1.1, t, build: 1 });
  },
};

module.exports = {
  drawOrange, drawJuiceSplat, drawHelmet,
  drawThermometer, thermoLevel, thermoAnchors,
  drawSign, signLayout, signAnchors, signWobble,
  drawRaft, raftAnchors,
  drawBackpack, backpackAnchors, drawHammer, hammerAnchors, drawSuitcase, drawRock,
  drawWhistle, drawFlashlight, drawBandage, drawMap, drawCandle, drawNotepad, drawChart,
  drawSweatDrop, drawMotionLines, drawStars, drawZzz, drawSteamPuff, drawSmokePuff,
  drawImpactBurst, drawSpeechBubble, drawWaterSplash,
  PROP_COLORS, RAFT,
  lab,
};
