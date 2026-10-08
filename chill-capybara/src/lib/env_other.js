// CHILL CAPYBARA — environments: therapy office, river sunset, title cards, captions.
// See DESIGN.md §5. Everything is drawn in 1280x720 design/world units, is a pure function of
// its inputs (time included), never uses Math.random, and restores all ctx state it touches.
// Environments extend ≥300 units past every frame edge (camera zoom ≥ 0.75 shows no void).
//
// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────
// drawTherapyOffice(ctx, t, o)       Dr. Shelley's office inside a giant hollow log: one-point
//                                    perspective log tunnel with carved rib arches, growth-ring
//                                    back wall, round window (jungle + tiny Mount Snooze beyond,
//                                    swaying leaves, light beam + dust motes), framed diploma
//                                    'Swamp University — PhD in Feelings', a Rorschach inkblot that
//                                    looks like an erupting volcano, alcove bookshelf, hanging
//                                    pothos, potted fern, standing lamp + glow pool, 70s rug,
//                                    teal log-couch (LEFT), oxblood wingback (RIGHT), side table with
//                                    the 'Serenity' candle (lit) and the fee bowl of oranges.
//   o.volcanoSmoke 0..1 (0.35)  smoke wisps from Mount Snooze in the window (>0.6 adds crater glow)
//   o.puff 0..1         (0)     progress of a big dark smoke puff in the window (beat
//                               'window_puff'): grows fast, lingers, fades out by 1
//   o.candle   bool     (true)  candle flame + glow
//   o.hourglass 0..1 | null     null/undefined → no hourglass; a number shows a small hourglass
//                               on the side table, value = fraction of sand fallen (1 = time's up)
//   o.oranges  int      (6)     oranges in the fee bowl (0..6)
//   o.dust     bool     (true)  dust motes floating in the window light beam
//   o.cache    bool     (true)  the static room is cached as resolution-matched tiles (≈4–15 ms
//                               per 1080p frame instead of ≈100 ms). false = draw directly.
// drawTherapyOfficeFront(ctx, t, o)  draw AFTER the characters: the couch cushion's front face
//                                    (sinks Barry's belly into the cushion) + the wingback's near
//                                    arm (hides Shelley's lower shell / legs).
// OFFICE                              anchors (world units):
//   couch {x:368,y:486}  origin for Barry, drawCapybara({pose:'lie', scale:1}) facing RIGHT
//                        (head on the raised head-end); cushion top = OFFICE.couchSeatY (540)
//   chair {x:978,y:532}  tortoise SEAT origin: drawTortoise({x,y, flip:true, scale:1}) faces LEFT
//                        towards Barry; everything below OFFICE.armTopY (506) is hidden by the arm
//   window {x:930,y:270,r:84}  glass centre/radius — Shelley's head sits just below it, so a
//                        'window' shot (zoom ≈2.5 on {930,300}) frames Mount Snooze behind him
//   diploma {x,y,w,h}, candle {x,y} (flame base), lamp {x,y} (shade bottom centre),
//   table {x,y} (top centre), oranges {x,y} (top of pile), hourglass {x,y} (base),
//   alcove {x,y}, fern {x,y} (pot rim), floorY (back floor edge), vp {x,y}, backR
//   Suggested framings: office_wide {640,360,z 0.9–1}; barry_couch {400,470,z 2};
//   shelley_cu {940,430,z 2}; window {930,300,z 2.5}.
//
// drawRiverSunset(ctx, t, o)        aftermath: wide calm river at sunset (#FF9E5E → #5B3A7A sky),
//                                    low sun + shimmering reflection column, layered silhouetted
//                                    jungle banks with mirrored reflections, distant Mount Snooze
//                                    still smoking with a faint red crater glow + lava scar, lit
//                                    stratus clouds, first stars, birds, lily pads, drifting
//                                    ash/embers, ripples drifting with the current.
//   o.ash 0..1        (0.35)  drifting ash flakes + glowing embers
//   o.smoke 0..1      (1)     Mount Snooze smoke column
//   o.glow 0..1       (1)     Mount Snooze crater/lava glow
//   o.sunset 0..1     (0)     0 = sun resting on the horizon; 1 = sun sunk ~40 units lower
//   o.flow            (1)     ripple drift speed multiplier
//   o.birds           (true)  three tiny distant birds
//   o.raft            (true)  dark raft shadow + back halves of the wake rings at the raft position
//   o.raftX/raftY/raftW       raft waterline centre / width (default RIVER.raftPos, 330)
// drawRiverFront(ctx, t, o)         draw AFTER the raft + cast: translucent water band that
//                                    submerges the raft's lower edge (seamless: it re-renders the
//                                    same water), waterline glints + foam, front halves of the wake
//                                    rings, a few near ash flakes/embers, dark foreground reeds +
//                                    cattails (bottom corners) and a drooping palm frond (top-left).
//   o.raftX (640) o.raftY (520) o.raftW (330)  raft waterline centre / width (move with the raft)
//   o.foreground (true)  foreground silhouettes;  o.wake (true)  wake rings + foam
//   o.ash (0.35)  same as above;  o.grade 0..1 (0)  optional sunset colour grade over the whole
//                 frame (lilac multiply + warm backlight) — sits daylight-coloured characters into
//                 the sunset; costs ≈10 ms at 1080p, so use it for held shots / close-ups.
// drawRiverReflection(ctx, t, o, fn) mirror-draws fn(ctx2) (e.g. the raft + cast) into the water as
//                                    a rippled, fading reflection. Call after drawRiverSunset and
//                                    BEFORE drawing the raft. fn is called ONCE (into a scratch
//                                    canvas with the same transform), then blitted in 26 strips.
//   o.y (RIVER.raftPos.y)  waterline / mirror axis;  o.x0, o.x1  horizontal extent (world units)
//   o.depth (150)  how far below the waterline it reaches;  o.alpha (0.45)
//   (assumes the camera is not rotated by more than shake-level amounts)
// RIVER                               anchors: raftPos {640,520} (raft waterline centre),
//   waterY 392 (= horizonY, far water edge; water spans waterY → bottom), sun {x,y,r},
//   volcano {x,y} (crater), banks {left,right} (where each bank meets the far water).
//   Cast on the raft reads best at scale ≈0.7–0.8. Suggested framings: raft_wide {640,360,z1};
//   barry_cu {600,440,z2}; volcano {360,290,z2.5}.
//
// drawTitleCard(ctx, t, o)          full-frame title card; t = seconds since the card began.
//   o.style  'woody' (default) | 'groovy'
//   o.lines  strings or {text, size, font, color, spacing, gap}
//            woody: pure black card, white Yeseva caps, centred, generous letter-spacing; first
//                   line is the big one (o.size, default 74), following lines default 0.5x.
//                   No animation except fades. Default lines ['CHILL CAPYBARA'].
//            groovy: end-title treatment — lines[0] = title (default 'Chill Capybara', Shrikhand,
//                   sunset gradient + extruded shadow, letters pop in one by one then gently wave),
//                   lines[1] (or o.sub) = subtitle (default 'THE END'). A striped 70s sun rises,
//                   a capybara silhouette surfaces in front of it and an orange bounces onto its
//                   head (t≈1.3–2.1), subtitle fades up at t≈2.
//   o.fadeIn (0) / o.fadeOut (0) seconds; o.dur (Infinity) card length (fadeOut ends at dur)
//   o.size   title font size (woody 74, groovy 108 — auto-shrinks to fit);  o.bg (groovy bg colour)
// drawCaption(ctx, t, o)            animated caption overlay (e.g. 'THREE WEEKS LATER')
//   o.text ('THREE WEEKS LATER'), o.style 'plank' (wooden sign drops in on ropes with a springy
//   bounce + swing, yanked back up on exit) | 'banner' (70s stripes sweep across, a cream pill
//   pops in with sparkles; everything wipes out to the right)
//   o.inT (0) entrance start, o.outT (Infinity) exit start (same clock as t); o.x (640),
//   o.y (plank 112 / banner 110), o.scale (1). Draws nothing outside [inT, outT + 0.75].
//
// lab sheets: office, office_cast, office_framings, office_live (real cast when available),
//             river, river_framings, river_live (cast + reflection + grade), titles,
//             titles_groovy (single card; use --frames), caption (use --t / --frames)
'use strict';

const U = require('./util');
const {
  TAU, clamp, lerp, smoothstep, ease, rng, hash1, noise1, noise2,
  mix, shade, rgba, ellipse, circle, roundRect, blob, curve, withCamera,
} = U;

let _napi = null;
const napi = () => _napi || (_napi = require('@napi-rs/canvas'));

// ════════════════════════════════════════════════════════════════════ helpers
function lg(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
function rg(ctx, x, y, r0, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
// soft elliptical glow / contact shadow (radial gradient squashed to an ellipse)
function glow(ctx, x, y, rx, ry, color, a, comp) {
  if (a <= 0.001) return;
  ctx.save();
  if (comp) ctx.globalCompositeOperation = comp;
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = rg(ctx, 0, 0, 0, rx, [[0, rgba(color, a)], [0.35, rgba(color, a * 0.62)], [0.7, rgba(color, a * 0.2)], [1, rgba(color, 0)]]);
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
}
function fillStroke(ctx, fill, stroke, lw) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
}
// fill text centred at x, shrinking the font until it fits maxW
function fitText(ctx, text, x, y, maxW, weight, size, family) {
  let sz = size;
  ctx.font = `${weight} ${sz}px ${family}`;
  const w = ctx.measureText(text).width;
  if (w > maxW) { sz = (size * maxW) / w; ctx.font = `${weight} ${sz}px ${family}`; }
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
  return sz;
}
function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}
function line(ctx, x0, y0, x1, y1) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
// pointed leaf (length along +x before rotation)
function leafPath(ctx, x, y, len, wid, ang, bend = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.25, -wid * 1.05 + bend * len * 0.1, len * 0.7, -wid * 0.8 + bend * len * 0.25, len, bend * len * 0.3);
  ctx.bezierCurveTo(len * 0.7, wid * 0.8 + bend * len * 0.25, len * 0.25, wid * 1.05 + bend * len * 0.1, 0, 0);
  ctx.closePath();
  ctx.restore();
}
function drawOrangeFruit(ctx, x, y, r, rot = 0, leaf = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  circle(ctx, 0, 0, r);
  ctx.fillStyle = rg(ctx, -r * 0.35, -r * 0.4, r * 0.1, r * 1.25, [[0, '#FFC164'], [0.45, '#FF9A1F'], [1, '#D86A10']]);
  ctx.fill();
  ctx.strokeStyle = '#B55A12';
  ctx.lineWidth = Math.max(0.8, r * 0.09);
  ctx.stroke();
  circle(ctx, -r * 0.38, -r * 0.4, r * 0.22);
  ctx.fillStyle = 'rgba(255,240,200,0.65)';
  ctx.fill();
  // navel dimple
  circle(ctx, r * 0.1, -r * 0.82, r * 0.09);
  ctx.fillStyle = '#9C5214';
  ctx.fill();
  if (leaf) {
    leafPath(ctx, r * 0.1, -r * 0.85, r * 0.9, r * 0.28, -0.5, -0.1);
    ctx.fillStyle = '#5FAF6A';
    ctx.fill();
    ctx.strokeStyle = '#2F6B45';
    ctx.lineWidth = Math.max(0.6, r * 0.06);
    ctx.stroke();
  }
  ctx.restore();
}

// ════════════════════════════════════════════════════════ tile cache (static)
// Static layers are rasterised once per (layer, pixel-scale level, tile) into small
// canvases that exactly match the current device scale (quantised upward), then blitted.
// The content of a tile is a pure function of constant inputs, so this is a valid
// memo and frames stay deterministic whatever order they render in.
const TILE = 256, TPAD = 3;
const T_X0 = -512, T_Y0 = -512, T_COLS = 10, T_ROWS = 8; // world x −512…2048, y −512…1536
const LEVELS = [0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1, 1.125, 1.25, 1.375, 1.5, 1.625, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 4, 4.5, 5, 6];
const _tiles = new Map();
let _tileBytes = 0;
const TILE_BUDGET = 320 * 1024 * 1024;

function levelFor(s) {
  for (const l of LEVELS) if (l >= s * 0.995) return l;
  return LEVELS[LEVELS.length - 1];
}
function getTile(key, L, c, r, drawFn) {
  const k = key + '|' + L + '|' + c + '|' + r;
  const hit = _tiles.get(k);
  if (hit) { _tiles.delete(k); _tiles.set(k, hit); return hit; }
  const px = Math.round(TILE * L) + 2 * TPAD;
  const cv = napi().createCanvas(px, px);
  const tc = cv.getContext('2d');
  const x0 = T_X0 + c * TILE, y0 = T_Y0 + r * TILE;
  tc.setTransform(L, 0, 0, L, TPAD - x0 * L, TPAD - y0 * L);
  tc.beginPath();
  tc.rect(x0 - TPAD / L, y0 - TPAD / L, TILE + (2 * TPAD) / L, TILE + (2 * TPAD) / L);
  tc.clip();
  drawFn(tc);
  _tiles.set(k, cv);
  _tileBytes += px * px * 4;
  while (_tileBytes > TILE_BUDGET && _tiles.size > 1) {
    const [fk, fv] = _tiles.entries().next().value;
    _tiles.delete(fk);
    _tileBytes -= fv.width * fv.height * 4;
  }
  return cv;
}
function drawCached(ctx, key, drawFn) {
  const m = ctx.getTransform();
  const det = m.a * m.d - m.b * m.c;
  const s = Math.sqrt(Math.abs(det));
  if (!(s > 1e-6)) return;
  const L = levelFor(s);
  const cw = (ctx.canvas && ctx.canvas.width) || 1920, ch = (ctx.canvas && ctx.canvas.height) || 1080;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [px, py] of [[0, 0], [cw, 0], [0, ch], [cw, ch]]) {
    const dx = px - m.e, dy = py - m.f;
    const wx = (m.d * dx - m.c * dy) / det, wy = (-m.b * dx + m.a * dy) / det;
    x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); y0 = Math.min(y0, wy); y1 = Math.max(y1, wy);
  }
  const c0 = Math.max(0, Math.floor((x0 - T_X0) / TILE)), c1 = Math.min(T_COLS - 1, Math.floor((x1 - T_X0) / TILE));
  const r0 = Math.max(0, Math.floor((y0 - T_Y0) / TILE)), r1 = Math.min(T_ROWS - 1, Math.floor((y1 - T_Y0) / TILE));
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const tile = getTile(key, L, c, r, drawFn);
      const wx = T_X0 + c * TILE - TPAD / L, wy = T_Y0 + r * TILE - TPAD / L;
      ctx.drawImage(tile, wx, wy, tile.width / L, tile.height / L);
    }
  }
  ctx.restore();
}

// ════════════════════════════════════════════════════════════ THERAPY OFFICE
const VP = { x: 640, y: 330 };
const RB = 430;                                   // back-wall (log end) radius
const FLOOR_Y = 560;                              // back floor edge
const FH = FLOOR_Y - VP.y;                        // 230
const FHW = Math.sqrt(RB * RB - FH * FH);         // ≈ 363
const FSLOPE = FHW / FH;
const floorX = (y, side) => VP.x + side * FSLOPE * (y - VP.y);

const OFFICE = {
  vp: { ...VP }, backR: RB, floorY: FLOOR_Y,
  couch: { x: 368, y: 486 },
  couchSeatY: 540,
  chair: { x: 978, y: 532 },
  chairSeatY: 528,
  armTopY: 506,
  window: { x: 930, y: 270, r: 84 },
  diploma: { x: 412, y: 222, w: 156, h: 116 },
  alcove: { x: 640, y: 372 },
  table: { x: 784, y: 532 },
  candle: { x: 728, y: 492 },
  hourglass: { x: 766, y: 530 },
  oranges: { x: 820, y: 478 },
  lamp: { x: 1182, y: 296 },
  fern: { x: 98, y: 622 },
};

const WOOD = {
  wall: '#D69C63', wallHi: '#EDB97F', wallLo: '#B27445', ring: '#8E5530',
  tunnel: '#A9693D', tunnelLo: '#5A301B', grainD: '#6B3A1F', grainL: '#D79A63',
  floor: '#9C6440', floorLo: '#5F361E', seam: '#4A2814',
  walnut: '#6A3E22', walnutHi: '#9A6440', walnutLo: '#4A2915',
};

// ---------------------------------------------------------------- tunnel walls
function officeTunnel(ctx) {
  // base: dark at the outside (towards camera), warm near the back wall
  ctx.fillStyle = rg(ctx, VP.x, VP.y, RB * 0.95, 1300, [[0, '#B87A4A'], [0.22, '#9E6038'], [0.55, '#7A4428'], [1, '#4E2A17']]);
  ctx.fillRect(-700, -700, 2800, 2500);
  // grain: thin wedges radiating from the VP (lines along the log's length)
  const R = rng(41);
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * TAU + R.range(-0.02, 0.02);
    const dark = R() < 0.62;
    const segs = 1 + Math.floor(R() * 3);
    let r = RB + 8 + R() * 30;
    for (let k = 0; k < segs && r < 1500; k++) {
      const len = R.range(120, 520);
      const r2 = Math.min(1600, r + len);
      const w = R.range(0.0014, 0.0042);
      const wob = R.range(-1, 1) * 0.012;
      ctx.beginPath();
      const n = 7;
      for (let j = 0; j <= n; j++) {
        const rr = lerp(r, r2, j / n);
        const aa = a + Math.sin(rr * 0.006 + i) * wob - w * (j === 0 || j === n ? 0.2 : 1);
        if (j === 0) ctx.moveTo(VP.x + Math.cos(aa) * rr, VP.y + Math.sin(aa) * rr);
        else ctx.lineTo(VP.x + Math.cos(aa) * rr, VP.y + Math.sin(aa) * rr);
      }
      for (let j = n; j >= 0; j--) {
        const rr = lerp(r, r2, j / n);
        const aa = a + Math.sin(rr * 0.006 + i) * wob + w * (j === 0 || j === n ? 0.2 : 1);
        ctx.lineTo(VP.x + Math.cos(aa) * rr, VP.y + Math.sin(aa) * rr);
      }
      ctx.closePath();
      ctx.fillStyle = dark ? rgba(WOOD.grainD, R.range(0.18, 0.4)) : rgba(WOOD.grainL, R.range(0.1, 0.22));
      ctx.fill();
      r = r2 + R.range(30, 160);
    }
  }
  // knots (foreshortened along the depth direction)
  const knots = [[3.55, 610], [2.55, 700], [5.95, 690], [4.4, 900], [0.42, 1040], [2.2, 1100], [3.2, 980]];
  for (const [a, r] of knots) {
    const x = VP.x + Math.cos(a) * r, y = VP.y + Math.sin(a) * r;
    const sz = r * 0.03;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + Math.PI / 2);
    for (let k = 3; k >= 0; k--) {
      ellipse(ctx, 0, 0, sz * (1 + k * 0.7), sz * 0.45 * (1 + k * 0.55));
      ctx.strokeStyle = rgba(WOOD.grainD, 0.25 + 0.1 * (3 - k));
      ctx.lineWidth = sz * 0.12;
      ctx.stroke();
    }
    ellipse(ctx, 0, 0, sz, sz * 0.45);
    ctx.fillStyle = rgba('#4A2412', 0.7);
    ctx.fill();
    ctx.restore();
  }
  // structural rib arches (the log's carved ribs), outer one only seen when zoomed out
  const thetaF = Math.asin(FH / RB);
  for (const k of [1.95, 1.36]) {
    const r = RB * k, w = 26 * k;
    ctx.save();
    ctx.beginPath();
    ctx.arc(VP.x, VP.y, r + w / 2, Math.PI - thetaF, TAU + thetaF);
    ctx.arc(VP.x, VP.y, r - w / 2, TAU + thetaF, Math.PI - thetaF, true);
    ctx.closePath();
    ctx.fillStyle = rg(ctx, VP.x, VP.y, r - w / 2, r + w / 2, [[0, '#A8653A'], [0.25, '#8C5230'], [1, '#5E3219']]);
    ctx.fill();
    ctx.strokeStyle = '#43220F';
    ctx.lineWidth = 2;
    ctx.stroke();
    // lit inner bevel
    ctx.beginPath();
    ctx.arc(VP.x, VP.y, r - w / 2 + 2.5, Math.PI - thetaF + 0.02, TAU + thetaF - 0.02);
    ctx.strokeStyle = rgba('#F0B67C', 0.55);
    ctx.lineWidth = 3;
    ctx.stroke();
    // grain on the rib
    ctx.beginPath();
    ctx.arc(VP.x, VP.y, r + w * 0.12, Math.PI - thetaF + 0.03, TAU + thetaF - 0.03);
    ctx.strokeStyle = rgba('#4A2412', 0.35);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // pegs
    for (let j = 0; j < 9; j++) {
      const a = Math.PI - thetaF + 0.12 + (j / 8) * (Math.PI + 2 * thetaF - 0.24);
      const px = VP.x + Math.cos(a) * r, py = VP.y + Math.sin(a) * r;
      circle(ctx, px, py, 3.2 * k);
      ctx.fillStyle = '#4E2A15';
      ctx.fill();
      circle(ctx, px - 0.8 * k, py - 0.8 * k, 1.3 * k);
      ctx.fillStyle = rgba('#E6A870', 0.6);
      ctx.fill();
    }
    ctx.restore();
  }
  // ambient occlusion where the tunnel meets the back wall
  ctx.beginPath();
  ctx.arc(VP.x, VP.y, RB + 90, 0, TAU);
  ctx.fillStyle = rg(ctx, VP.x, VP.y, RB, RB + 90, [[0, 'rgba(46,20,8,0.55)'], [0.4, 'rgba(46,20,8,0.22)'], [1, 'rgba(46,20,8,0)']]);
  ctx.fill();
}

// ---------------------------------------------------------------- back wall (log end grain)
function officeBackWall(ctx) {
  ctx.save();
  circle(ctx, VP.x, VP.y, RB);
  ctx.clip();
  ctx.fillStyle = rg(ctx, 780, 300, 20, RB + 80, [[0, '#DDA066'], [0.45, '#C7844C'], [1, '#93542C']]);
  ctx.fillRect(VP.x - RB, VP.y - RB, RB * 2, RB * 2);
  // growth rings around an off-centre pith
  const P = { x: 626, y: 388 };
  const R = rng(7);
  let r = 10;
  let i = 0;
  while (r < RB + 120) {
    const wob = 0.018 + R() * 0.02;
    const ph = R() * TAU;
    ctx.beginPath();
    const n = 64;
    for (let j = 0; j <= n; j++) {
      const a = (j / n) * TAU;
      const rr = r * (1 + wob * Math.sin(a * 3 + ph) + wob * 0.6 * noise1(a * 2.2 + i * 3.1));
      const x = P.x + Math.cos(a) * rr, y = P.y + Math.sin(a) * rr * 0.97;
      if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    const band = R();
    if (band < 0.3) {
      ctx.strokeStyle = rgba('#F4C891', 0.2);
      ctx.lineWidth = 5 + R() * 5;
      ctx.stroke();
    } else if (band < 0.55) {
      ctx.strokeStyle = rgba('#8E4E26', 0.1);
      ctx.lineWidth = 6 + R() * 6;
      ctx.stroke();
    }
    ctx.strokeStyle = rgba(WOOD.ring, 0.16 + R() * 0.16);
    ctx.lineWidth = 1 + R() * 1.6;
    ctx.stroke();
    r += 9 + R() * 17 + r * 0.02;
    i++;
  }
  // drying checks (radial cracks)
  for (const [a, r0, r1] of [[-0.75, 70, 200], [2.3, 60, 200], [3.9, 120, 330], [1.1, 300, 420]]) {
    ctx.beginPath();
    const n = 8;
    for (let j = 0; j <= n; j++) {
      const rr = lerp(r0, r1, j / n);
      const aa = a + Math.sin(j * 1.7) * 0.012 - 0.006 * Math.sin((j / n) * Math.PI);
      if (j === 0) ctx.moveTo(P.x + Math.cos(aa) * rr, P.y + Math.sin(aa) * rr);
      else ctx.lineTo(P.x + Math.cos(aa) * rr, P.y + Math.sin(aa) * rr);
    }
    for (let j = n; j >= 0; j--) {
      const rr = lerp(r0, r1, j / n);
      const aa = a + Math.sin(j * 1.7) * 0.012 + 0.006 * Math.sin((j / n) * Math.PI);
      ctx.lineTo(P.x + Math.cos(aa) * rr, P.y + Math.sin(aa) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = rgba('#5A2E15', 0.28);
    ctx.fill();
  }
  // sapwood rim + bark-side shadow at the seam
  circle(ctx, VP.x, VP.y, RB - 7);
  ctx.strokeStyle = rgba('#9A5A30', 0.55);
  ctx.lineWidth = 14;
  ctx.stroke();
  circle(ctx, VP.x, VP.y, RB - 15);
  ctx.strokeStyle = rgba('#F7C68E', 0.5);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  circle(ctx, VP.x, VP.y, RB);
  ctx.strokeStyle = '#5A3019';
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

// ---------------------------------------------------------------- window frame (static part)
function officeWindowFrame(ctx) {
  const { x, y, r } = OFFICE.window;
  // recess shadow
  glow(ctx, x + 4, y + 8, r + 40, r + 40, '#3A1A08', 0.4);
  // frame ring
  ctx.beginPath();
  ctx.arc(x, y, r + 20, 0, TAU);
  ctx.arc(x, y, r - 1, 0, TAU, true);
  ctx.fillStyle = lg(ctx, x - r, y - r, x + r, y + r, [[0, '#B87442'], [0.5, '#8E5530'], [1, '#6A3B1F']]);
  ctx.fill();
  circle(ctx, x, y, r + 20);
  ctx.strokeStyle = '#4A2611';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // carved grooves
  circle(ctx, x, y, r + 10);
  ctx.strokeStyle = rgba('#4A2611', 0.55);
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // lit bevels (lamp light from the right, daylight from the glass)
  ctx.beginPath();
  ctx.arc(x, y, r + 18, -2.6, -0.7);
  ctx.strokeStyle = rgba('#FFD39A', 0.6);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r + 1.5, 0.3, 2.2);
  ctx.strokeStyle = rgba('#FFE3B0', 0.55);
  ctx.lineWidth = 2;
  ctx.stroke();
  // little sill + trailing plant
  roundRect(ctx, x - 62, y + r + 16, 124, 11, 5);
  ctx.fillStyle = lg(ctx, 0, y + r + 16, 0, y + r + 27, [[0, '#C0804C'], [1, '#7A4526']]);
  ctx.fill();
  ctx.strokeStyle = '#4A2611';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // tiny pot with a trailing plant on the sill
  const px = x + 38, py = y + r + 16;
  poly(ctx, [[px - 11, py - 18], [px + 11, py - 18], [px + 8, py], [px - 8, py]]);
  fillStroke(ctx, '#D27B4E', '#8E4426', 1.4);
  const R = rng(3);
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + R.range(-1.5, 1.5);
    const L = R.range(8, 16);
    leafPath(ctx, px + R.range(-4, 4), py - 18, L, L * 0.32, a, 0);
    ctx.fillStyle = i % 2 ? '#4E9A5E' : '#3F8A55';
    ctx.fill();
  }
  // trailing vine
  ctx.beginPath();
  ctx.moveTo(px + 9, py - 6);
  ctx.bezierCurveTo(px + 22, py + 6, px + 18, py + 26, px + 26, py + 38);
  ctx.strokeStyle = '#3F7A4A';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const k = i / 4;
    const vx = lerp(px + 12, px + 26, k) + Math.sin(k * 5) * 3, vy = lerp(py - 2, py + 38, k);
    leafPath(ctx, vx, vy, 7, 2.6, i % 2 ? 0.4 : 2.6, 0);
    ctx.fillStyle = '#4E9A5E';
    ctx.fill();
  }
}

// ---------------------------------------------------------------- window view (live)
function officeWindowView(ctx, t, o) {
  const { x, y, r } = OFFICE.window;
  const smoke = o.volcanoSmoke == null ? 0.35 : o.volcanoSmoke;
  const puff = clamp(o.puff || 0);
  ctx.save();
  circle(ctx, x, y, r);
  ctx.clip();
  // sky
  ctx.fillStyle = lg(ctx, 0, y - r, 0, y + r, [[0, '#6FC0EA'], [0.55, '#B9E3F2'], [1, '#FCE9C6']]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  glow(ctx, x + 50, y - 50, 70, 70, '#FFF6D8', 0.7);
  // clouds drifting
  for (let i = 0; i < 2; i++) {
    const cx = x - r - 40 + (((t * 3.2 + i * 97) % (r * 2 + 80)) + r * 2 + 80) % (r * 2 + 80);
    const cy = y - 46 + i * 22;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [dx, dy, rr] of [[0, 0, 9], [10, -4, 11], [21, 0, 8], [-9, 2, 6]]) { circle(ctx, cx + dx, cy + dy, rr * (i ? 0.8 : 1)); ctx.fill(); }
  }
  // Mount Snooze, small and far
  const vx = x + 20, vy = y + 6; // crater centre
  const pv = clamp(puff * 3) * (1 - smoothstep(0.75, 1, puff));
  // smoke behind the cone top
  const nP = 7;
  for (let i = 0; i < nP; i++) {
    const ph = ((t * 0.22 + i / nP) % 1 + 1) % 1;
    const a = smoke * (1 - ph) * 0.8 * smoothstep(0, 0.1, ph);
    if (a < 0.01) continue;
    const sx = vx + ph * 26 + Math.sin(ph * 5 + i) * 3, sy = vy - 4 - ph * 70;
    circle(ctx, sx, sy, 4 + ph * 13);
    ctx.fillStyle = rgba('#D9D3DE', a);
    ctx.fill();
  }
  if (pv > 0.01) {
    const g = ease.outCubic(clamp(puff / 0.45));
    const cy = vy - 10 - g * 40;
    const R = rng(77);
    ctx.fillStyle = rgba('#4E4A58', 0.92 * pv);
    for (let k = 0; k < 9; k++) {
      const ang = R() * TAU, d = R() * 26 * g;
      circle(ctx, vx + Math.cos(ang) * d * 1.3 + g * 8, cy + Math.sin(ang) * d * 0.7, (10 + R() * 14) * (0.35 + g * 0.75));
      ctx.fill();
    }
    ctx.fillStyle = rgba('#6E6878', 0.9 * pv);
    for (let k = 0; k < 5; k++) {
      const ang = R() * TAU, d = R() * 18 * g;
      circle(ctx, vx + Math.cos(ang) * d + g * 4 - 4, cy - 6 + Math.sin(ang) * d * 0.6, (7 + R() * 9) * (0.35 + g * 0.7));
      ctx.fill();
    }
    // column
    poly(ctx, [[vx - 6, vy], [vx + 6, vy], [vx + 10 * g, cy + 10], [vx - 10 * g, cy + 10]]);
    ctx.fillStyle = rgba('#4E4A58', 0.9 * pv);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(vx - 90, y + r);
  ctx.lineTo(vx - 70, vy + 58);
  ctx.bezierCurveTo(vx - 40, vy + 34, vx - 22, vy + 10, vx - 12, vy);
  ctx.lineTo(vx + 12, vy);
  ctx.bezierCurveTo(vx + 24, vy + 12, vx + 46, vy + 36, vx + 84, vy + 58);
  ctx.lineTo(vx + 110, y + r);
  ctx.closePath();
  ctx.fillStyle = lg(ctx, vx - 60, 0, vx + 60, 0, [[0, '#A3A3BC'], [0.48, '#9293AE'], [0.52, '#787A94'], [1, '#6C6F86']]);
  ctx.fill();
  ctx.strokeStyle = rgba('#555870', 0.7);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // ridge lines (matches the Snooze Springs volcano design)
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = rgba('#5E6078', 0.45);
  ctx.lineWidth = 1;
  for (const dx of [-8, -3, 3, 9]) {
    ctx.beginPath();
    ctx.moveTo(vx + dx, vy + 2);
    ctx.lineTo(vx + dx * 5.5, vy + 60);
    ctx.stroke();
  }
  ctx.restore();
  ellipse(ctx, vx, vy + 1, 12, 2.5);
  ctx.fillStyle = '#5A5C72';
  ctx.fill();
  if (pv > 0.01 || smoke > 0.6) glow(ctx, vx, vy, 16, 8, '#FF7A2E', Math.max(pv * 0.9, (smoke - 0.6) * 1.2));
  // green lower slopes
  ctx.fillStyle = '#6DB873';
  ctx.beginPath();
  ctx.moveTo(vx - 100, y + r);
  for (let i = 0; i <= 10; i++) {
    const xx = vx - 90 + i * 20;
    ctx.lineTo(xx, vy + 44 + Math.sin(i * 1.9) * 4 + Math.abs(i - 5) * 1.5);
  }
  ctx.lineTo(vx + 120, y + r);
  ctx.closePath();
  ctx.fill();
  // far canopy
  ctx.fillStyle = '#4C9A5C';
  for (let i = 0; i < 9; i++) { circle(ctx, x - r + i * 22, y + 58 + Math.sin(i * 2.3) * 5, 16); ctx.fill(); }
  ctx.fillStyle = '#3B7F4E';
  for (let i = 0; i < 8; i++) { circle(ctx, x - r + 10 + i * 24, y + 78 + Math.sin(i * 1.3) * 5, 18); ctx.fill(); }
  // swaying jungle leaves framing the window
  const leaves = [
    [x - r - 4, y - r + 14, 70, 17, 0.55, '#2F6B45'],
    [x - r + 8, y - r - 4, 62, 14, 0.95, '#3F8A55'],
    [x + 24, y - r - 6, 58, 13, 1.75, '#2F6B45'],
    [x + r + 6, y - 20, 74, 16, 2.75, '#3F8A55'],
    [x + r, y + 26, 60, 14, 3.25, '#2F6B45'],
    [x - r - 6, y + 40, 64, 15, -0.35, '#3F8A55'],
  ];
  leaves.forEach(([lx, ly, L, W, a, col], i) => {
    const sway = Math.sin(t * 1.1 + i * 1.7) * 0.07 + noise1(t * 0.6 + i * 9) * 0.04;
    leafPath(ctx, lx, ly, L, W, a + sway, 0.18);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(a + sway);
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.quadraticCurveTo(L * 0.5, L * 0.06, L * 0.95, L * 0.05);
    ctx.strokeStyle = rgba('#8CCB7A', 0.7);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  });
  // inner reveal shadow + glass sheen
  circle(ctx, x, y, r);
  ctx.fillStyle = rg(ctx, x - 6, y - 8, r * 0.72, r + 2, [[0, 'rgba(60,30,10,0)'], [1, 'rgba(60,30,10,0.45)']]);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 6;
  line(ctx, x - 58, y - 8, x - 8, y - 58);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  line(ctx, x - 50, y + 8, x + 8, y - 50);
  ctx.stroke();
  ctx.restore();
  // mullions
  const mw = 7;
  ctx.fillStyle = '#7A4526';
  ctx.fillRect(x - mw / 2, y - r, mw, r * 2);
  ctx.fillRect(x - r, y - mw / 2, r * 2, mw);
  ctx.fillStyle = rgba('#E9AE73', 0.7);
  ctx.fillRect(x - mw / 2, y - r, 1.6, r * 2);
  ctx.fillRect(x - r, y - mw / 2, r * 2, 1.6);
  circle(ctx, x, y, 7);
  fillStroke(ctx, '#8A5230', '#4A2611', 1.5);
  ctx.restore();
}

// ---------------------------------------------------------------- diploma
function officeDiploma(ctx) {
  const { x, y, w, h } = OFFICE.diploma;
  // nail + string
  ctx.strokeStyle = '#5A3A22';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.32, y - h / 2 + 4);
  ctx.lineTo(x, y - h / 2 - 34);
  ctx.lineTo(x + w * 0.32, y - h / 2 + 2);
  ctx.stroke();
  circle(ctx, x, y - h / 2 - 34, 3);
  ctx.fillStyle = '#6E6E78';
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.035);
  // shadow on wall
  roundRect(ctx, -w / 2 + 5, -h / 2 + 7, w, h, 5);
  ctx.fillStyle = 'rgba(70,32,10,0.28)';
  ctx.fill();
  // frame
  roundRect(ctx, -w / 2, -h / 2, w, h, 4);
  ctx.fillStyle = lg(ctx, 0, -h / 2, 0, h / 2, [[0, '#6E4024'], [1, '#43230F']]);
  ctx.fill();
  ctx.strokeStyle = '#2E1608';
  ctx.lineWidth = 2;
  ctx.stroke();
  roundRect(ctx, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 3);
  ctx.strokeStyle = rgba('#C98E5C', 0.6);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // gold fillet + paper
  const pw = w - 22, ph = h - 22;
  ctx.fillStyle = '#D9B45A';
  ctx.fillRect(-pw / 2 - 2, -ph / 2 - 2, pw + 4, ph + 4);
  ctx.fillStyle = lg(ctx, -pw / 2, -ph / 2, pw / 2, ph / 2, [[0, '#FBF2DC'], [1, '#EBDDBA']]);
  ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
  // ornamental inner border
  ctx.strokeStyle = rgba('#B08A4A', 0.8);
  ctx.lineWidth = 0.8;
  ctx.strokeRect(-pw / 2 + 4, -ph / 2 + 4, pw - 8, ph - 8);
  // text
  ctx.fillStyle = '#4A3426';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = '0.6px';
  fitText(ctx, 'SWAMP UNIVERSITY', 0, -ph / 2 + 21, pw - 16, 400, 12.5, 'Yeseva');
  ctx.letterSpacing = '0px';
  ctx.fillStyle = '#7A6248';
  fitText(ctx, 'confers upon Dr. Shelley the degree of', 0, -ph / 2 + 34, pw - 22, 'italic 700', 7, 'Nunito');
  ctx.fillStyle = '#7A2E34';
  fitText(ctx, 'PhD in Feelings', 0, -ph / 2 + 55, pw - 14, 400, 15, 'Shrikhand');
  // divider
  ctx.strokeStyle = rgba('#B08A4A', 0.9);
  ctx.lineWidth = 0.8;
  line(ctx, -36, -ph / 2 + 64, 36, -ph / 2 + 64);
  ctx.stroke();
  // signature
  ctx.strokeStyle = '#3E3A5E';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-pw / 2 + 12, ph / 2 - 12);
  ctx.bezierCurveTo(-pw / 2 + 18, ph / 2 - 22, -pw / 2 + 22, ph / 2 - 4, -pw / 2 + 28, ph / 2 - 14);
  ctx.bezierCurveTo(-pw / 2 + 32, ph / 2 - 20, -pw / 2 + 36, ph / 2 - 8, -pw / 2 + 48, ph / 2 - 13);
  ctx.stroke();
  line(ctx, -pw / 2 + 10, ph / 2 - 8, -pw / 2 + 52, ph / 2 - 8);
  ctx.strokeStyle = rgba('#7A6248', 0.6);
  ctx.stroke();
  // gold seal + ribbons
  const sx = pw / 2 - 20, sy = ph / 2 - 15;
  ctx.fillStyle = '#B5413E';
  poly(ctx, [[sx - 5, sy + 4], [sx - 10, sy + 18], [sx - 5, sy + 15], [sx - 2, sy + 19], [sx, sy + 4]]);
  ctx.fill();
  poly(ctx, [[sx + 1, sy + 4], [sx + 4, sy + 19], [sx + 7, sy + 15], [sx + 11, sy + 18], [sx + 6, sy + 4]]);
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU, rr = i % 2 ? 9 : 11;
    if (i === 0) ctx.moveTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
    else ctx.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
  }
  ctx.closePath();
  fillStroke(ctx, '#E2B64C', '#9C7424', 0.8);
  circle(ctx, sx, sy, 5.5);
  ctx.strokeStyle = '#9C7424';
  ctx.stroke();
  // glass sheen
  ctx.save();
  ctx.beginPath();
  ctx.rect(-pw / 2, -ph / 2, pw, ph);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  poly(ctx, [[-pw / 2 + 10, ph / 2], [-pw / 2 + 52, -ph / 2], [-pw / 2 + 70, -ph / 2], [-pw / 2 + 28, ph / 2]]);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

// ---------------------------------------------------------------- Rorschach inkblot (it's a volcano)
function officeInkblot(ctx) {
  const x = 640, y = 198, w = 84, h = 70;
  ctx.save();
  roundRect(ctx, x - w / 2 + 4, y - h / 2 + 6, w, h, 3);
  ctx.fillStyle = 'rgba(60,26,8,0.3)';
  ctx.fill();
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 3);
  fillStroke(ctx, '#2A2226', '#140E10', 1.6);
  ctx.fillStyle = '#F7F1E4';
  ctx.fillRect(x - w / 2 + 6, y - h / 2 + 6, w - 12, h - 12);
  // one half of the blot, mirrored → a symmetric, suspiciously volcano-shaped blot
  const half = [
    [0, 24], [28, 24], [24, 20], [19, 14], [13, 7], [8, 1], [6, -3], [7, -5], [12, -6], [17, -11], [15, -16], [20, -21], [12, -24], [7, -20], [4, -25], [0, -22],
  ];
  ctx.fillStyle = '#1C1A22';
  for (const sgn of [1, -1]) {
    ctx.beginPath();
    half.forEach(([hx, hy], i) => {
      const px = x + sgn * hx, py = y + hy;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
  }
  const R = rng(13);
  for (let i = 0; i < 10; i++) {
    const dx = R.range(8, 30), dy = R.range(-26, 22), r = R.range(0.8, 2.2);
    for (const sgn of [1, -1]) { circle(ctx, x + sgn * dx, y + dy, r); ctx.fill(); }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  poly(ctx, [[x - w / 2 + 6, y + 6], [x - 14, y - h / 2 + 6], [x - 2, y - h / 2 + 6], [x - w / 2 + 6, y + 22]]);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- hanging plant (macramé), hangs from the ceiling
function officeHangingPlant(ctx) {
  const x = 206, py = 92, ring = 18;
  ctx.save();
  ctx.strokeStyle = '#EAD7B0';
  ctx.lineWidth = 2;
  line(ctx, x, -420, x, ring);
  ctx.stroke();
  circle(ctx, x, ring, 5);
  ctx.strokeStyle = '#C9B488';
  ctx.lineWidth = 2;
  ctx.stroke();
  // macramé cords with knots
  ctx.strokeStyle = '#EAD7B0';
  ctx.lineWidth = 1.8;
  for (const dx of [-32, -12, 12, 32]) {
    ctx.beginPath();
    ctx.moveTo(x, ring + 4);
    ctx.quadraticCurveTo(x + dx * 0.5, py - 30, x + dx, py - 2);
    ctx.stroke();
    circle(ctx, x + dx * 0.55, py - 36, 2.2);
    ctx.fillStyle = '#D9C49A';
    ctx.fill();
  }
  // trailing pothos behind the pot
  const R = rng(23);
  const vines = [[-24, 120], [-6, 160], [14, 104], [30, 140]];
  for (const [vx, len] of vines) {
    const pts = [];
    for (let i = 0; i <= 8; i++) pts.push([x + vx + Math.sin(i * 0.9 + vx) * 6, py + 8 + (i / 8) * len]);
    curve(ctx, pts);
    ctx.strokeStyle = '#2F6B45';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    for (let i = 1; i <= 8; i++) {
      const [lx, ly] = pts[i];
      const sz = 11 - i * 0.6;
      const side = i % 2 ? 1 : -1;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(side * 0.9 + Math.PI / 2 + R.range(-0.2, 0.2));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(sz * 0.4, -sz * 0.7, sz * 1.1, -sz * 0.4, sz * 1.2, 0);
      ctx.bezierCurveTo(sz * 1.1, sz * 0.4, sz * 0.4, sz * 0.7, 0, 0);
      ctx.fillStyle = i % 3 === 0 ? '#5FAF6A' : '#3F8A55';
      ctx.fill();
      ctx.restore();
    }
  }
  // pot
  ctx.beginPath();
  ctx.moveTo(x - 34, py - 4);
  ctx.bezierCurveTo(x - 34, py + 30, x - 16, py + 38, x, py + 38);
  ctx.bezierCurveTo(x + 16, py + 38, x + 34, py + 30, x + 34, py - 4);
  ctx.closePath();
  ctx.fillStyle = lg(ctx, x - 34, 0, x + 34, 0, [[0, '#F4E6CC'], [0.6, '#D9C4A0'], [1, '#A88E68']]);
  ctx.fill();
  ctx.strokeStyle = '#7A6448';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.strokeStyle = rgba('#B5413E', 0.8);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 33, py + 10);
  ctx.quadraticCurveTo(x, py + 16, x + 33, py + 10);
  ctx.stroke();
  // cords over the pot
  ctx.strokeStyle = '#EAD7B0';
  ctx.lineWidth = 1.8;
  for (const dx of [-32, -12, 12, 32]) {
    ctx.beginPath();
    ctx.moveTo(x + dx, py - 2);
    ctx.quadraticCurveTo(x + dx * 0.7, py + 24, x, py + 42);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(x, py + 40);
  ctx.lineTo(x - 3, py + 64);
  ctx.moveTo(x, py + 40);
  ctx.lineTo(x + 3, py + 62);
  ctx.moveTo(x, py + 40);
  ctx.lineTo(x, py + 66);
  ctx.stroke();
  // foliage tufts over the rim
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.34;
    const sz = R.range(12, 18);
    ctx.save();
    ctx.translate(x + (i - 4) * 6, py - 2);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-sz * 0.6, -sz * 0.4, -sz * 0.4, -sz * 1.1, 0, -sz * 1.2);
    ctx.bezierCurveTo(sz * 0.4, -sz * 1.1, sz * 0.6, -sz * 0.4, 0, 0);
    ctx.fillStyle = i % 2 ? '#4E9A5E' : '#3F8A55';
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- alcove bookshelf
function officeAlcove(ctx) {
  const cx = 640, top = 300, bot = 470, hw = 76;
  const shelfY = 398;
  const arch = (inset) => {
    ctx.beginPath();
    ctx.moveTo(cx - hw + inset, bot);
    ctx.lineTo(cx - hw + inset, top + hw);
    ctx.arc(cx, top + hw, hw - inset, Math.PI, TAU);
    ctx.lineTo(cx + hw - inset, bot);
    ctx.closePath();
  };
  // carved rim
  arch(-8);
  ctx.fillStyle = lg(ctx, cx - hw, top, cx + hw, bot, [[0, '#F2C28A'], [1, '#B87A48']]);
  ctx.fill();
  ctx.strokeStyle = rgba('#7A4526', 0.7);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // niche interior
  arch(0);
  ctx.fillStyle = lg(ctx, 0, top, 0, bot, [[0, '#4A2614'], [1, '#6E3E22']]);
  ctx.fill();
  ctx.save();
  arch(0);
  ctx.clip();
  // inner shadow from the top rim
  ctx.fillStyle = lg(ctx, 0, top, 0, top + 60, [[0, 'rgba(25,10,3,0.55)'], [1, 'rgba(25,10,3,0)']]);
  ctx.fillRect(cx - hw, top, hw * 2, 70);
  // back-of-niche grain
  ctx.strokeStyle = rgba('#8A5230', 0.35);
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const yy = top + 40 + i * 24;
    ctx.beginPath();
    ctx.moveTo(cx - hw, yy);
    ctx.bezierCurveTo(cx - 20, yy + 6, cx + 20, yy - 6, cx + hw, yy + 2);
    ctx.stroke();
  }
  // books on the upper shelf
  const books = [
    [-66, 13, 58, '#2E6E6A', 0], [-52, 11, 52, '#D9A441', 0], [-40, 15, 62, '#9C3D45', 0],
    [-24, 12, 49, '#EAD7B0', 0], [-11, 14, 56, '#4F6D8F', 0], [4, 11, 46, '#6E8A3E', 0.0],
    [17, 13, 54, '#B85A3C', 0.22],
  ];
  for (const [bx, bw, bh, col, lean] of books) {
    ctx.save();
    ctx.translate(cx + bx + (lean ? bh * 0.12 : 0), shelfY);
    ctx.rotate(lean);
    roundRect(ctx, 0, -bh, bw, bh, 2);
    ctx.fillStyle = lg(ctx, 0, 0, bw, 0, [[0, shade(col, 0.12)], [0.5, col], [1, shade(col, -0.25)]]);
    ctx.fill();
    ctx.strokeStyle = shade(col, -0.45);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = rgba(shade(col, 0.55), 0.85);
    ctx.fillRect(1.5, -bh + 7, bw - 3, 2.2);
    ctx.fillRect(1.5, -12, bw - 3, 2.2);
    ctx.fillStyle = rgba(shade(col, -0.4), 0.6);
    ctx.fillRect(bw / 2 - 1.5, -bh + 16, 3, bh * 0.4);
    ctx.restore();
  }
  // succulent pot on the upper shelf
  const sx = cx + 52;
  poly(ctx, [[sx - 10, shelfY - 16], [sx + 10, shelfY - 16], [sx + 7, shelfY], [sx - 7, shelfY]]);
  fillStroke(ctx, '#E0E4E6', '#8A9196', 1.2);
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.42;
    leafPath(ctx, sx, shelfY - 15, 11 - Math.abs(i - 3) * 1.2, 4, a, 0);
    ctx.fillStyle = i % 2 ? '#7FB98A' : '#5E9E70';
    ctx.fill();
  }
  // lower shelf: stacked books + scroll
  const stack = [[-56, 66, 10, '#4F6D8F'], [-52, 58, 9, '#D9A441'], [-58, 62, 10, '#9C3D45']];
  let yy = bot;
  for (const [bx, bw, bh, col] of stack) {
    yy -= bh;
    roundRect(ctx, cx + bx, yy, bw, bh, 2);
    ctx.fillStyle = lg(ctx, 0, yy, 0, yy + bh, [[0, shade(col, 0.15)], [1, shade(col, -0.2)]]);
    ctx.fill();
    ctx.strokeStyle = shade(col, -0.45);
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.fillStyle = rgba('#F6EBD0', 0.8);
    ctx.fillRect(cx + bx + bw - 6, yy + 2, 3, bh - 4);
  }
  // little tortoise-shell paperweight on top of the stack
  ctx.beginPath();
  ctx.ellipse(cx - 24, yy, 12, 9, 0, Math.PI, TAU);
  ctx.closePath();
  fillStroke(ctx, '#7A8A4A', '#4E5A2A', 1.2);
  ctx.strokeStyle = rgba('#4E5A2A', 0.8);
  ctx.lineWidth = 0.8;
  line(ctx, cx - 24, yy - 9, cx - 24, yy);
  ctx.stroke();
  // rolled scroll
  ctx.save();
  ctx.translate(cx + 38, bot - 7);
  ctx.rotate(-0.08);
  roundRect(ctx, -22, -7, 44, 14, 7);
  fillStroke(ctx, '#F0E2C0', '#A08660', 1.1);
  ctx.fillStyle = '#B5413E';
  ctx.fillRect(-3, -7.5, 5, 15);
  ellipse(ctx, 22, 0, 3, 7);
  fillStroke(ctx, '#E3D0A6', '#A08660', 1);
  ctx.restore();
  ctx.restore();
  // shelf plank
  roundRect(ctx, cx - hw - 2, shelfY, hw * 2 + 4, 8, 2);
  ctx.fillStyle = lg(ctx, 0, shelfY, 0, shelfY + 8, [[0, '#C98A54'], [1, '#7A4526']]);
  ctx.fill();
  ctx.strokeStyle = '#4A2611';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // sill
  roundRect(ctx, cx - hw - 10, bot - 1, hw * 2 + 20, 12, 3);
  ctx.fillStyle = lg(ctx, 0, bot, 0, bot + 12, [[0, '#D4935C'], [1, '#7A4526']]);
  ctx.fill();
  ctx.strokeStyle = '#4A2611';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ---------------------------------------------------------------- floor + rug
function officeFloor(ctx) {
  const yB = FLOOR_Y, yF = 1300;
  const L0 = floorX(yB, -1), R0 = floorX(yB, 1), L1 = floorX(yF, -1), R1 = floorX(yF, 1);
  poly(ctx, [[L0, yB], [R0, yB], [R1, yF], [L1, yF]]);
  ctx.fillStyle = lg(ctx, 0, yB, 0, 900, [[0, '#A56B44'], [0.35, '#8C5634'], [1, '#5A321C']]);
  ctx.fill();
  ctx.save();
  poly(ctx, [[L0, yB], [R0, yB], [R1, yF], [L1, yF]]);
  ctx.clip();
  // planks (lines through the VP)
  const N = 9, step = FHW / N;
  const R = rng(19);
  for (let i = -N; i < N; i++) {
    const a = i * step, b = (i + 1) * step;
    const tone = R.range(-1, 1);
    const k = (FLOOR_Y - VP.y);
    const s1 = (yF - VP.y) / k;
    poly(ctx, [[VP.x + a, yB], [VP.x + b, yB], [VP.x + b * s1, yF], [VP.x + a * s1, yF]]);
    ctx.fillStyle = tone > 0 ? rgba('#E8A870', tone * 0.12) : rgba('#3A1C0A', -tone * 0.14);
    ctx.fill();
    // grain streaks inside the plank
    for (let g = 0; g < 2; g++) {
      const f = R.range(0.2, 0.8);
      const sA = R.range(1.0, 1.4), sB = sA + R.range(0.2, 0.7);
      const xa = VP.x + lerp(a, b, f);
      ctx.beginPath();
      ctx.moveTo(VP.x + (xa - VP.x) * sA, VP.y + k * sA);
      ctx.lineTo(VP.x + (xa - VP.x) * sB, VP.y + k * sB);
      ctx.strokeStyle = rgba('#4A2814', 0.22);
      ctx.lineWidth = 1.1 * sA;
      ctx.stroke();
    }
    // cross joints
    for (let j = 0; j < 2; j++) {
      const s = R.range(1.05, 2.2);
      ctx.beginPath();
      ctx.moveTo(VP.x + a * s, VP.y + k * s);
      ctx.lineTo(VP.x + b * s, VP.y + k * s);
      ctx.strokeStyle = rgba(WOOD.seam, 0.55);
      ctx.lineWidth = 1.3 * s;
      ctx.stroke();
    }
  }
  for (let i = -N + 1; i < N; i++) {
    const a = i * step;
    const s1 = (yF - VP.y) / FH;
    ctx.beginPath();
    ctx.moveTo(VP.x + a, yB);
    ctx.lineTo(VP.x + a * s1, yF);
    ctx.strokeStyle = rgba(WOOD.seam, 0.6);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(VP.x + a + 1.5, yB);
    ctx.lineTo(VP.x + (a + 1.5) * s1 + 2, yF);
    ctx.strokeStyle = rgba('#D9995E', 0.2);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  // contact shadow along the back wall
  ctx.fillStyle = lg(ctx, 0, yB, 0, yB + 34, [[0, 'rgba(40,18,6,0.5)'], [1, 'rgba(40,18,6,0)']]);
  ctx.fillRect(L0 - 50, yB, R0 - L0 + 100, 36);
  ctx.restore();
  // floor/wall edge lines
  ctx.strokeStyle = rgba('#3A1C0A', 0.6);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(L1, yF); ctx.lineTo(L0, yB); ctx.lineTo(R0, yB); ctx.lineTo(R1, yF);
  ctx.stroke();
}

function officeRug(ctx) {
  const cx = 668, cy = 654, rx = 478, ry = 58;
  // fringe
  ctx.strokeStyle = '#E3CBA0';
  ctx.lineWidth = 1.6;
  for (const side of [-1, 1]) {
    for (let i = -6; i <= 6; i++) {
      const a = (side < 0 ? Math.PI : 0) + i * 0.035;
      const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      line(ctx, x, y, x + side * 9, y + i * 0.6);
      ctx.stroke();
    }
  }
  glow(ctx, cx, cy + 6, rx + 10, ry + 10, '#2A1206', 0.35);
  const bands = [
    [1, '#9C4E3A'], [0.955, '#E3CBA0'], [0.93, '#4A7F84'], [0.7, '#E3CBA0'], [0.675, '#CF9D45'],
    [0.54, '#9C4E3A'], [0.44, '#E3CBA0'], [0.4, '#4A7F84'], [0.22, '#9C4E3A'],
  ];
  for (const [k, col] of bands) {
    ellipse(ctx, cx, cy, rx * k, ry * k);
    ctx.fillStyle = col;
    ctx.fill();
  }
  // zigzag band in the outer teal ring
  ctx.beginPath();
  const n = 72;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const k = i % 2 ? 0.86 : 0.77;
    const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#E3CBA0';
  ctx.lineWidth = 2.6;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // centre medallion
  poly(ctx, [[cx - rx * 0.17, cy], [cx, cy - ry * 0.15], [cx + rx * 0.17, cy], [cx, cy + ry * 0.15]]);
  ctx.fillStyle = '#E3CBA0';
  ctx.fill();
  poly(ctx, [[cx - rx * 0.09, cy], [cx, cy - ry * 0.08], [cx + rx * 0.09, cy], [cx, cy + ry * 0.08]]);
  ctx.fillStyle = '#CF9D45';
  ctx.fill();
  // dots in the terracotta ring
  ctx.fillStyle = '#E3CBA0';
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU;
    ellipse(ctx, cx + Math.cos(a) * rx * 0.61, cy + Math.sin(a) * ry * 0.61, 3.2, 1.2);
    ctx.fill();
  }
  // lighting: warm lamp side, shadowed left side, sun patch handled by the beam
  ellipse(ctx, cx, cy, rx, ry);
  ctx.fillStyle = lg(ctx, cx - rx, 0, cx + rx, 0, [[0, 'rgba(40,16,8,0.38)'], [0.5, 'rgba(40,16,8,0.06)'], [1, 'rgba(255,214,140,0.14)']]);
  ctx.fill();
  ellipse(ctx, cx, cy, rx, ry);
  ctx.strokeStyle = rgba('#5E2A1C', 0.6);
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

// ---------------------------------------------------------------- fern
function officeFern(ctx) {
  const { x, y } = OFFICE.fern;
  glow(ctx, x + 4, y + 70, 64, 10, '#1E0C04', 0.5);
  const R = rng(5);
  const frond = (ang, L, col, hi) => {
    const bx = x + Math.cos(ang) * 6, by = y - 4;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const k = i / 12;
      const droop = k * k * L * 0.55 * (0.4 + Math.abs(dx));
      pts.push([bx + dx * L * k, by + dy * L * k * (1 - k * 0.35) + droop]);
    }
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    ctx.strokeStyle = shade(col, -0.3);
    ctx.lineWidth = 1.8;
    ctx.stroke();
    for (let i = 1; i < 12; i++) {
      const [px, py] = pts[i];
      const [qx, qy] = pts[i + 1];
      const ta = Math.atan2(qy - py, qx - px);
      const sz = (1 - i / 13) * 15 + 4;
      for (const s of [-1, 1]) {
        leafPath(ctx, px, py, sz, sz * 0.3, ta + s * 1.05, 0.05 * s);
        ctx.fillStyle = s < 0 ? hi : col;
        ctx.fill();
      }
    }
  };
  // back fronds (darker)
  for (let i = 0; i < 11; i++) {
    const a = -Math.PI / 2 + (i - 5) * 0.3 + R.range(-0.08, 0.08);
    frond(a, R.range(130, 175), '#2F6B45', '#3B7F4E');
  }
  // pot
  const top = y, h = 68;
  poly(ctx, [[x - 40, top + 10], [x + 40, top + 10], [x + 30, top + h], [x - 30, top + h]]);
  ctx.fillStyle = lg(ctx, x - 40, 0, x + 40, 0, [[0, '#D9784A'], [0.6, '#C2603A'], [1, '#8E4426']]);
  ctx.fill();
  ctx.strokeStyle = '#7A3A1E';
  ctx.lineWidth = 2;
  ctx.stroke();
  roundRect(ctx, x - 46, top - 4, 92, 18, 6);
  ctx.fillStyle = lg(ctx, 0, top - 4, 0, top + 14, [[0, '#E8895A'], [1, '#B4552F']]);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = rgba('#FFD0A8', 0.45);
  ctx.fillRect(x - 32, top + 18, 5, h - 26);
  // painted band on the pot
  ctx.strokeStyle = rgba('#F3DDB0', 0.75);
  ctx.lineWidth = 2;
  line(ctx, x - 37, top + 30, x + 37, top + 30);
  ctx.stroke();
  for (let i = -3; i <= 3; i++) {
    circle(ctx, x + i * 10, top + 40, 2);
    ctx.fillStyle = rgba('#F3DDB0', 0.75);
    ctx.fill();
  }
  // front fronds (lighter), spilling over the rim
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.4 + R.range(-0.1, 0.1);
    frond(a, R.range(105, 150), '#4E9A5E', '#6DB873');
  }
  for (const a of [-2.8, -0.35]) frond(a, 135, '#5FAF6A', '#8CCB7A');
}

// ---------------------------------------------------------------- couch
const COUCH = { x0: 176, x1: 552, seat: 540, base: 640 };
function couchCushionFront(ctx, onlyLip) {
  const x0 = COUCH.x0 + 2, x1 = 474, top = COUCH.seat + 8, bot = 580;
  ctx.beginPath();
  ctx.moveTo(x0, bot - 6);
  ctx.lineTo(x0, top + 8);
  ctx.quadraticCurveTo(x0, top, x0 + 10, top - 1);
  const nb = 6;
  for (let i = 0; i < nb; i++) {
    const xa = lerp(x0 + 10, x1, i / nb), xb = lerp(x0 + 10, x1, (i + 1) / nb);
    ctx.quadraticCurveTo((xa + xb) / 2, top - 4.5, xb, top - 0.5);
  }
  // continue under the raised head end, hugging the scroll arm's front contour
  ctx.lineTo(557, top - 0.5);
  ctx.bezierCurveTo(557.5, top + 10, 556.5, bot - 10, 556, bot - 2);
  ctx.lineTo(x0 + 6, bot);
  ctx.closePath();
  ctx.fillStyle = lg(ctx, 0, top - 4, 0, bot, [[0, '#4A9A90'], [0.18, '#2F7A72'], [1, '#1E5753']]);
  ctx.fill();
  ctx.strokeStyle = '#163F3C';
  ctx.lineWidth = 2;
  ctx.stroke();
  // highlight on the lip
  ctx.beginPath();
  ctx.moveTo(x0 + 8, top + 1);
  for (let i = 0; i < nb; i++) {
    const xa = lerp(x0 + 10, x1, i / nb), xb = lerp(x0 + 10, x1, (i + 1) / nb);
    ctx.quadraticCurveTo((xa + xb) / 2, top - 3, xb - 2, top + 1);
  }
  ctx.lineTo(553, top + 1);
  ctx.strokeStyle = rgba('#9FDCD0', 0.55);
  ctx.lineWidth = 2;
  ctx.stroke();
  // tufting buttons + pinch creases
  for (let i = 0; i <= nb; i++) {
    const bx = lerp(x0 + 10, x1, i / nb), by = top + 16;
    if (i > 0 && i < nb) {
      ctx.strokeStyle = rgba('#123634', 0.55);
      ctx.lineWidth = 1.2;
      for (const [dx, dy] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) {
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + dx * 0.5, by + dy * 0.2, bx + dx, by + dy * 0.8);
        ctx.stroke();
      }
      circle(ctx, bx, by, 2.6);
      fillStroke(ctx, '#1C4C48', '#0F2E2C', 1);
      circle(ctx, bx - 0.8, by - 0.9, 0.9);
      ctx.fillStyle = 'rgba(200,255,240,0.6)';
      ctx.fill();
    }
  }
  // piping at the bottom
  ctx.beginPath();
  ctx.moveTo(x0 + 6, bot - 3);
  ctx.lineTo(554, bot - 3);
  ctx.strokeStyle = rgba('#7CC4B8', 0.5);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (onlyLip) return;
}
function couchPillow(ctx) {
  ctx.save();
  ctx.translate(524, 490);
  ctx.rotate(-0.42);
  const h = 25;
  ctx.beginPath();
  ctx.moveTo(-h, -h);
  ctx.quadraticCurveTo(0, -h + 6, h, -h);
  ctx.quadraticCurveTo(h - 6, 0, h, h);
  ctx.quadraticCurveTo(0, h - 6, -h, h);
  ctx.quadraticCurveTo(-h + 6, 0, -h, -h);
  ctx.closePath();
  ctx.fillStyle = rg(ctx, -8, -10, 3, 40, [[0, '#F8D08A'], [0.6, '#E2A84A'], [1, '#B57E2E']]);
  ctx.fill();
  ctx.strokeStyle = '#7A521A';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  // woven diamond motif
  ctx.strokeStyle = rgba('#B5413E', 0.85);
  ctx.lineWidth = 2;
  poly(ctx, [[0, -12], [12, 0], [0, 12], [-12, 0]]);
  ctx.stroke();
  circle(ctx, 0, 0, 3);
  ctx.fillStyle = '#B5413E';
  ctx.fill();
  ctx.strokeStyle = rgba('#7A521A', 0.4);
  ctx.lineWidth = 1;
  poly(ctx, [[0, -19], [19, 0], [0, 19], [-19, 0]]);
  ctx.stroke();
  // corner tassels
  for (const [cx, cy] of [[-h, -h], [h, -h], [h, h], [-h, h]]) {
    circle(ctx, cx, cy, 2.6);
    ctx.fillStyle = '#B5413E';
    ctx.fill();
  }
  ctx.restore();
}
// folded cable-knit blanket on the foot end of the couch
function couchThrow(ctx) {
  const x0 = 186, x1 = 258, yb = COUCH.seat;
  const H = 26;
  glow(ctx, (x0 + x1) / 2 + 4, yb, 46, 5, '#0F2E2C', 0.5);
  // body of the folded stack (soft rounded fold on the right)
  ctx.beginPath();
  ctx.moveTo(x0, yb);
  ctx.lineTo(x0 + 2, yb - H + 6);
  ctx.quadraticCurveTo(x0 + 3, yb - H, x0 + 10, yb - H);
  ctx.lineTo(x1 - 12, yb - H);
  ctx.bezierCurveTo(x1 + 2, yb - H, x1 + 4, yb, x1 - 10, yb);
  ctx.closePath();
  ctx.fillStyle = lg(ctx, 0, yb - H, 0, yb, [[0, '#EBBE5E'], [0.5, '#D9A441'], [1, '#A87A28']]);
  ctx.fill();
  ctx.strokeStyle = '#6E4E14';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // fold lines (layers)
  ctx.strokeStyle = rgba('#7A5418', 0.6);
  ctx.lineWidth = 1.2;
  for (const yy of [yb - 9, yb - 17]) {
    ctx.beginPath();
    ctx.moveTo(x0 + 2, yy);
    ctx.lineTo(x1 - 10, yy);
    ctx.bezierCurveTo(x1 - 4, yy, x1 - 2, yy + 3, x1 - 4, yy + 6);
    ctx.stroke();
  }
  // cable-knit braids on the top layer
  ctx.strokeStyle = rgba('#FFE7A8', 0.55);
  ctx.lineWidth = 1.2;
  for (let xx = x0 + 10; xx < x1 - 14; xx += 9) {
    ctx.beginPath();
    ctx.moveTo(xx, yb - H + 2);
    ctx.quadraticCurveTo(xx + 4, yb - H + 5, xx, yb - H + 8);
    ctx.moveTo(xx + 4, yb - H + 2);
    ctx.quadraticCurveTo(xx, yb - H + 5, xx + 4, yb - H + 8);
    ctx.stroke();
  }
  // cream stripe near the edge
  ctx.strokeStyle = rgba('#F6E6C4', 0.85);
  ctx.lineWidth = 2.2;
  line(ctx, x0 + 4, yb - 4, x1 - 12, yb - 4);
  ctx.stroke();
  // fringe on the end
  ctx.strokeStyle = '#C08A30';
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 5; i++) {
    const yy = yb - H + 6 + i * 4;
    line(ctx, x0 + 1, yy, x0 - 6, yy + 1.5);
    ctx.stroke();
  }
}
function officeCouch(ctx) {
  const { x0, x1, seat, base } = COUCH;
  glow(ctx, (x0 + x1) / 2, base + 2, (x1 - x0) / 2 + 30, 16, '#1A0A04', 0.55);
  // stubby stump feet
  for (const fx of [210, 520]) {
    roundRect(ctx, fx - 12, base - 26, 24, 28, 5);
    ctx.fillStyle = lg(ctx, fx - 12, 0, fx + 12, 0, [[0, '#7A4A2A'], [1, '#4A2915']]);
    ctx.fill();
    ctx.strokeStyle = '#2E1608';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  // split-log base with bark
  const bx0 = x0 + 6, bx1 = x1 - 4, by0 = 570, by1 = 626;
  roundRect(ctx, bx0, by0, bx1 - bx0, by1 - by0, 24);
  ctx.fillStyle = lg(ctx, 0, by0, 0, by1, [[0, '#8C5A36'], [0.5, '#6B4128'], [1, '#4A2B17']]);
  ctx.fill();
  ctx.save();
  roundRect(ctx, bx0, by0, bx1 - bx0, by1 - by0, 24);
  ctx.clip();
  const R = rng(11);
  for (let xx = bx0 + 6; xx < bx1; xx += 7 + R() * 6) {
    const yy = by0 + R() * 10;
    ctx.beginPath();
    ctx.moveTo(xx, yy);
    ctx.bezierCurveTo(xx + 3, yy + 15, xx - 3, yy + 30, xx + R.range(-2, 2), by1);
    ctx.strokeStyle = rgba('#3A1E0E', 0.5);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(xx + 2.4, yy + 4);
    ctx.bezierCurveTo(xx + 5, yy + 15, xx - 1, yy + 26, xx + 2, by1 - 8);
    ctx.strokeStyle = rgba('#B47A4E', 0.35);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();
  roundRect(ctx, bx0, by0, bx1 - bx0, by1 - by0, 24);
  ctx.strokeStyle = '#2E1608';
  ctx.lineWidth = 2;
  ctx.stroke();
  // cut log ends (rings)
  for (const ex of [bx0 + 12, bx1 - 12]) {
    ellipse(ctx, ex, (by0 + by1) / 2, 12, (by1 - by0) / 2 - 2);
    ctx.fillStyle = lg(ctx, ex - 12, 0, ex + 12, 0, [[0, '#E3AA70'], [1, '#C28450']]);
    ctx.fill();
    ctx.strokeStyle = '#5A3019';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    for (const k of [0.66, 0.36]) {
      ellipse(ctx, ex, (by0 + by1) / 2, 12 * k, ((by1 - by0) / 2 - 2) * k);
      ctx.strokeStyle = rgba('#8E5530', 0.6);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  // cushion body incl. the raised head end (scroll arm)
  ctx.beginPath();
  ctx.moveTo(x0, 578);
  ctx.lineTo(x0, seat + 8);
  ctx.quadraticCurveTo(x0, seat - 2, x0 + 12, seat - 2);
  ctx.lineTo(462, seat - 2);
  ctx.bezierCurveTo(492, seat - 4, 506, 490, 522, 462);
  ctx.bezierCurveTo(530, 446, 548, 438, 562, 444);
  ctx.bezierCurveTo(578, 452, 580, 474, 568, 486);
  ctx.bezierCurveTo(562, 500, 560, 540, 556, 578);
  ctx.closePath();
  ctx.fillStyle = lg(ctx, 0, 440, 0, 580, [[0, '#3E8C84'], [0.5, '#2C7069'], [1, '#1E5753']]);
  ctx.fill();
  ctx.strokeStyle = '#163F3C';
  ctx.lineWidth = 2;
  ctx.stroke();
  // seat top surface (seen from slightly above)
  ctx.beginPath();
  ctx.moveTo(x0 + 6, seat + 4);
  ctx.quadraticCurveTo(x0 + 8, seat - 1, x0 + 18, seat - 1);
  ctx.lineTo(462, seat - 1);
  ctx.strokeStyle = rgba('#8FD2C6', 0.5);
  ctx.lineWidth = 2;
  ctx.stroke();
  // incline tufting
  ctx.strokeStyle = rgba('#123634', 0.5);
  ctx.lineWidth = 1.2;
  for (const [ax, ay] of [[496, 512], [514, 482], [536, 460]]) {
    circle(ctx, ax, ay, 2.3);
    ctx.fillStyle = '#1C4C48';
    ctx.fill();
  }
  // scroll rosette on the arm face
  const rx = 560, ry = 466;
  circle(ctx, rx, ry, 15);
  ctx.fillStyle = rg(ctx, rx - 4, ry - 4, 2, 16, [[0, '#4FA096'], [1, '#215E59']]);
  ctx.fill();
  ctx.strokeStyle = '#163F3C';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = i * 0.42, rr = 1.5 + i * 0.3;
    const px = rx + Math.cos(a) * rr, py = ry + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = rgba('#0F2E2C', 0.6);
  ctx.lineWidth = 1.1;
  ctx.stroke();
  // square throw pillow leaning on the incline (Barry's head rests in front of it)
  couchPillow(ctx);
  // front face of the seat cushion
  couchCushionFront(ctx);
  couchThrow(ctx);
}

// ---------------------------------------------------------------- armchair (wingback, faces LEFT)
const CH = { x0: 872, x1: 1130, seat: 528, base: 650, armTop: 506 };
const VELVET = { base: '#8E3A44', hi: '#C0636A', lo: '#5E2230', line: '#3E121C', rim: '#FFC08A' };
// near arm of the wingback: rolled scroll at the front, side panel back to the chair back
function chairArmParts(ctx, pass) {
  const top = CH.armTop, bot = 598;
  const sx = 902, sy = top + 21, sr = 21;
  const shapes = [
    () => { roundRect(ctx, sx, top, 1066 - sx, bot - top, 14); },
    () => { ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); },
    () => {
      ctx.beginPath();
      ctx.moveTo(sx - sr + 3, sy + 6);
      ctx.bezierCurveTo(sx - sr + 9, sy + 34, sx - 14, bot - 22, sx - 10, bot);
      ctx.lineTo(sx + 30, bot);
      ctx.lineTo(sx + 30, sy);
      ctx.closePath();
    },
  ];
  if (pass === 'outline') {
    ctx.strokeStyle = VELVET.line;
    ctx.lineWidth = 4;
    for (const s of shapes) { s(); ctx.stroke(); }
    return;
  }
  const fill = lg(ctx, 0, top - 4, 0, bot, [[0, '#B4525C'], [0.22, VELVET.base], [1, VELVET.lo]]);
  for (const s of shapes) { s(); ctx.fillStyle = fill; ctx.fill(); }
}
function chairArm(ctx) {
  const top = CH.armTop, bot = 598;
  const sx = 902, sy = top + 21, sr = 21;
  chairArmParts(ctx, 'outline');
  chairArmParts(ctx, 'fill');
  // soft top highlight along the arm
  ctx.beginPath();
  ctx.moveTo(sx + 6, top + 2.2);
  ctx.lineTo(1052, top + 2.2);
  ctx.strokeStyle = rgba('#F2A0A0', 0.5);
  ctx.lineWidth = 2.4;
  ctx.stroke();
  // side panel piping + a gentle fold
  roundRect(ctx, sx + 34, top + 18, 1066 - sx - 50, bot - top - 30, 10);
  ctx.strokeStyle = rgba('#3E121C', 0.3);
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sx + 30, top + 6);
  ctx.quadraticCurveTo(sx + 40, top + 40, sx + 34, bot - 4);
  ctx.strokeStyle = rgba('#3E121C', 0.25);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // scroll face with rosette
  circle(ctx, sx, sy, sr - 1);
  ctx.fillStyle = rg(ctx, sx - 6, sy - 8, 2, sr + 4, [[0, '#CF6E76'], [0.6, VELVET.base], [1, VELVET.lo]]);
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i <= 34; i++) {
    const a = i * 0.47, rr = 1.2 + i * 0.4;
    const px = sx + Math.cos(a) * rr, py = sy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = rgba('#3E121C', 0.5);
  ctx.lineWidth = 1.1;
  ctx.stroke();
  circle(ctx, sx, sy, 2.4);
  fillStroke(ctx, '#E8C070', '#7A5A1A', 0.8);
  // brass nailheads around the scroll
  for (let i = 0; i < 9; i++) {
    const a = -2.9 + i * 0.5;
    circle(ctx, sx + Math.cos(a) * (sr - 3.5), sy + Math.sin(a) * (sr - 3.5), 1.3);
    ctx.fillStyle = '#F0CC7A';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(sx, sy, sr - 1, -2.6, -1.2);
  ctx.strokeStyle = rgba('#FFB0A8', 0.55);
  ctx.lineWidth = 2;
  ctx.stroke();
}
function officeChair(ctx) {
  glow(ctx, 1004, CH.base + 2, 170, 16, '#1A0A04', 0.55);
  // turned walnut legs with brass caps
  for (const [lx, lean] of [[906, -0.1], [1112, 0.1]]) {
    ctx.save();
    ctx.translate(lx, 608);
    ctx.rotate(lean);
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(7, 0);
    ctx.bezierCurveTo(6, 12, 3, 24, 3.5, 36);
    ctx.lineTo(-3.5, 36);
    ctx.bezierCurveTo(-3, 24, -6, 12, -7, 0);
    ctx.closePath();
    fillStroke(ctx, lg(ctx, -7, 0, 7, 0, [[0, '#9A6440'], [1, '#4A2915']]), '#2E1608', 1.5);
    roundRect(ctx, -4.5, 33, 9, 8, 2);
    fillStroke(ctx, '#D9A84A', '#7A5A1A', 1);
    ctx.restore();
  }
  // back: a slim, slightly reclined slab with the (far) wing sweeping forward
  ctx.beginPath();
  ctx.moveTo(1046, 596);
  ctx.lineTo(1050, 486);
  ctx.bezierCurveTo(1030, 474, 1012, 450, 1010, 414);
  ctx.bezierCurveTo(1008, 380, 1022, 352, 1046, 340);
  ctx.bezierCurveTo(1068, 326, 1104, 324, 1122, 338);
  ctx.bezierCurveTo(1138, 350, 1138, 378, 1134, 410);
  ctx.bezierCurveTo(1130, 450, 1130, 520, 1128, 596);
  ctx.closePath();
  ctx.fillStyle = lg(ctx, 1008, 0, 1138, 0, [[0, '#A84C58'], [0.5, VELVET.base], [1, VELVET.lo]]);
  ctx.fill();
  ctx.strokeStyle = VELVET.line;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  // wing panel seam (where the wing meets the back)
  ctx.beginPath();
  ctx.moveTo(1066, 590);
  ctx.lineTo(1068, 486);
  ctx.bezierCurveTo(1066, 430, 1070, 380, 1094, 352);
  ctx.strokeStyle = rgba('#3E121C', 0.4);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // wing highlight (catches the window light)
  ctx.beginPath();
  ctx.moveTo(1046, 474);
  ctx.bezierCurveTo(1022, 456, 1014, 430, 1014, 410);
  ctx.bezierCurveTo(1014, 384, 1024, 360, 1046, 346);
  ctx.strokeStyle = rgba('#F09898', 0.45);
  ctx.lineWidth = 2.2;
  ctx.stroke();
  // tufting on the back panel
  for (const [bx, by] of [[1088, 384], [1112, 382], [1098, 418], [1120, 420], [1090, 452], [1114, 456], [1100, 490], [1120, 494]]) {
    circle(ctx, bx, by, 2.2);
    fillStroke(ctx, '#5E2230', '#3E121C', 0.8);
  }
  ctx.strokeStyle = rgba('#3E121C', 0.28);
  ctx.lineWidth = 1;
  for (const [ax, ay, bx2, by2] of [[1088, 384, 1098, 418], [1112, 382, 1098, 418], [1098, 418, 1090, 452], [1120, 420, 1114, 456], [1090, 452, 1100, 490], [1114, 456, 1100, 490]]) {
    line(ctx, ax, ay, bx2, by2);
    ctx.stroke();
  }
  // warm lamp rim light down the back edge
  ctx.beginPath();
  ctx.moveTo(1096, 328);
  ctx.bezierCurveTo(1112, 328, 1132, 340, 1134, 366);
  ctx.bezierCurveTo(1136, 392, 1131, 430, 1130, 470);
  ctx.lineTo(1128, 590);
  ctx.strokeStyle = rgba(VELVET.rim, 0.65);
  ctx.lineWidth = 3;
  ctx.stroke();
  // seat cushion top peeking between arm and back
  roundRect(ctx, 920, CH.seat, 136, 30, 12);
  ctx.fillStyle = lg(ctx, 0, CH.seat, 0, CH.seat + 30, [[0, '#B85A62'], [1, VELVET.lo]]);
  ctx.fill();
  // skirt with box pleats + brass nailhead trim
  roundRect(ctx, 884, 592, 248, 22, 6);
  ctx.fillStyle = lg(ctx, 0, 592, 0, 614, [[0, '#7A2E3A'], [1, '#4E1A26']]);
  ctx.fill();
  ctx.strokeStyle = VELVET.line;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.strokeStyle = rgba('#2E0A12', 0.5);
  ctx.lineWidth = 1.2;
  for (let xx = 906; xx < 1124; xx += 27) { line(ctx, xx, 596, xx, 612); ctx.stroke(); }
  for (let xx = 890; xx < 1128; xx += 7) {
    circle(ctx, xx, 595, 1.2);
    ctx.fillStyle = '#E8C070';
    ctx.fill();
  }
  chairArm(ctx);
}

// ---------------------------------------------------------------- side table + props
function officeTable(ctx, o, live) {
  const { x, y } = OFFICE.table;
  if (!live) {
    glow(ctx, x, 620, 78, 9, '#1A0A04', 0.5);
    // tripod feet
    ctx.strokeStyle = '#2E1608';
    for (const [fx, fy] of [[x - 40, 618], [x + 40, 618], [x + 6, 624]]) {
      ctx.beginPath();
      ctx.moveTo(x - 4, 594);
      ctx.quadraticCurveTo(x + (fx - x) * 0.4, 606, fx, fy);
      ctx.lineTo(fx + 2, fy - 4);
      ctx.quadraticCurveTo(x + (fx - x) * 0.4 + 4, 600, x + 4, 590);
      ctx.closePath();
      fillStroke(ctx, '#5A3320', '#2E1608', 1.4);
    }
    // turned pedestal
    ctx.beginPath();
    ctx.moveTo(x - 6, 540);
    ctx.bezierCurveTo(x - 12, 556, x - 4, 566, x - 9, 580);
    ctx.bezierCurveTo(x - 12, 590, x - 8, 596, x - 6, 600);
    ctx.lineTo(x + 6, 600);
    ctx.bezierCurveTo(x + 8, 596, x + 12, 590, x + 9, 580);
    ctx.bezierCurveTo(x + 4, 566, x + 12, 556, x + 6, 540);
    ctx.closePath();
    fillStroke(ctx, lg(ctx, x - 12, 0, x + 12, 0, [[0, '#9A6440'], [0.4, '#7A4A2A'], [1, '#4A2915']]), '#2E1608', 1.5);
    // top
    ctx.beginPath();
    ctx.ellipse(x, y + 5, 72, 9, 0, 0, Math.PI);
    ctx.lineTo(x - 72, y);
    ctx.ellipse(x, y, 72, 9, 0, Math.PI, 0, true);
    ctx.closePath();
    fillStroke(ctx, lg(ctx, 0, y, 0, y + 14, [[0, '#7A4A2A'], [1, '#4A2915']]), '#2E1608', 1.6);
    ellipse(ctx, x, y, 72, 9);
    fillStroke(ctx, lg(ctx, x - 72, 0, x + 72, 0, [[0, '#A06A44'], [0.6, '#B67A4E'], [1, '#C88A58']]), '#2E1608', 1.6);
    ctx.beginPath();
    ctx.ellipse(x, y, 66, 7, 0, Math.PI * 1.1, Math.PI * 1.75);
    ctx.strokeStyle = rgba('#F3C08A', 0.6);
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // candle jar (static part)
    const c = OFFICE.candle;
    const jx = c.x, jtop = y - 40, jw = 32;
    glow(ctx, jx, y + 1, 20, 3, '#1A0A04', 0.4);
    roundRect(ctx, jx - jw / 2, jtop, jw, 40, 6);
    ctx.fillStyle = rgba('#F6E3C2', 0.95);
    ctx.fill();
    ctx.save();
    roundRect(ctx, jx - jw / 2, jtop, jw, 40, 6);
    ctx.clip();
    ctx.fillStyle = lg(ctx, jx - jw / 2, 0, jx + jw / 2, 0, [[0, '#FFF3DC'], [1, '#E2C99E']]);
    ctx.fillRect(jx - jw / 2, jtop + 8, jw, 34);
    ellipse(ctx, jx, jtop + 8, jw / 2, 3.2);
    ctx.fillStyle = '#FFF6E4';
    ctx.fill();
    // lavender label
    ctx.fillStyle = '#B79BD0';
    ctx.fillRect(jx - jw / 2, jtop + 18, jw, 14);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'italic 800 7.2px Nunito';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Serenity', jx, jtop + 25.5);
    ctx.restore();
    roundRect(ctx, jx - jw / 2, jtop, jw, 40, 6);
    ctx.strokeStyle = rgba('#8A7A66', 0.9);
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(jx - jw / 2 + 4, jtop + 4, 3, 30);
    // wick
    ctx.strokeStyle = '#2E2420';
    ctx.lineWidth = 1.4;
    line(ctx, jx, jtop + 8, jx + 0.5, jtop + 2);
    ctx.stroke();
  }
  if (live) {
    // fee bowl + oranges (live so the count can change)
    const bx = OFFICE.oranges.x, by = y - 2;
    const n = clamp(Math.round(o.oranges == null ? 6 : o.oranges), 0, 6);
    glow(ctx, bx, y + 1, 36, 4, '#1A0A04', 0.4);
    const spots = [[-17, -12, 12, 0.2], [17, -12, 12, -0.3], [0, -14, 12.5, 0.6], [-8, -31, 12, 1.1], [10, -30, 12, -0.8], [1, -48, 12, 0.1]];
    // back oranges (inside bowl)
    for (let i = 0; i < n; i++) {
      const [dx, dy, r, rot] = spots[i];
      drawOrangeFruit(ctx, bx + dx, by + dy, r, rot, i === n - 1 && n > 2);
    }
    // bowl front
    ctx.beginPath();
    ctx.moveTo(bx - 34, by - 14);
    ctx.bezierCurveTo(bx - 32, by + 2, bx - 18, by + 4, bx - 10, by + 4);
    ctx.lineTo(bx + 10, by + 4);
    ctx.bezierCurveTo(bx + 18, by + 4, bx + 32, by + 2, bx + 34, by - 14);
    ctx.closePath();
    fillStroke(ctx, lg(ctx, bx - 34, 0, bx + 34, 0, [[0, '#5FB0AA'], [0.5, '#3E8A86'], [1, '#2A6662']]), '#1E4C4A', 1.6);
    ellipse(ctx, bx, by - 14, 34, 4);
    ctx.strokeStyle = '#1E4C4A';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.strokeStyle = rgba('#F3DDB0', 0.8);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx - 28, by - 7);
    ctx.quadraticCurveTo(bx, by - 2, bx + 28, by - 7);
    ctx.stroke();
    roundRect(ctx, bx - 10, by + 3, 20, 4, 1.5);
    fillStroke(ctx, '#2A6662', '#1E4C4A', 1);
    // hourglass
    if (o.hourglass != null) drawHourglass(ctx, OFFICE.hourglass.x, y - 1, clamp(o.hourglass), 0);
    // candle flame
    if (o.candle !== false) {
      const c = OFFICE.candle;
      const f1 = noise1(c.x + (o._t || 0) * 7.3), f2 = noise1(c.y + (o._t || 0) * 5.1);
      const fh = 13 + f1 * 2.2, sway = f2 * 1.6;
      glow(ctx, c.x, c.y - 8, 46, 46, '#FFC86A', 0.32 + f1 * 0.04);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y + 1);
      ctx.bezierCurveTo(c.x - 5.5, c.y - 2, c.x - 3 + sway * 0.5, c.y - fh * 0.6, c.x + sway, c.y - fh);
      ctx.bezierCurveTo(c.x + 3 + sway * 0.5, c.y - fh * 0.6, c.x + 5.5, c.y - 2, c.x, c.y + 1);
      ctx.fillStyle = lg(ctx, 0, c.y - fh, 0, c.y + 1, [[0, '#FFE9A0'], [0.5, '#FFC24A'], [1, '#FF8A2A']]);
      ctx.fill();
      ellipse(ctx, c.x + sway * 0.25, c.y - 3, 1.8, 3.6);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill();
    }
  }
}
function drawHourglass(ctx, x, yBase, k, rot) {
  ctx.save();
  ctx.translate(x, yBase);
  ctx.rotate(rot || 0);
  const h = 44, w = 22;
  // glass bulbs
  const bulb = () => {
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 3, -h + 5);
    ctx.bezierCurveTo(-w / 2 + 2, -h / 2 - 8, -2, -h / 2 - 3, -1.5, -h / 2);
    ctx.bezierCurveTo(-2, -h / 2 + 3, -w / 2 + 2, -h / 2 + 8, -w / 2 + 3, -5);
    ctx.lineTo(w / 2 - 3, -5);
    ctx.bezierCurveTo(w / 2 - 2, -h / 2 + 8, 2, -h / 2 + 3, 1.5, -h / 2);
    ctx.bezierCurveTo(2, -h / 2 - 3, w / 2 - 2, -h / 2 - 8, w / 2 - 3, -h + 5);
    ctx.closePath();
  };
  bulb();
  ctx.fillStyle = 'rgba(230,245,250,0.35)';
  ctx.fill();
  ctx.save();
  bulb();
  ctx.clip();
  // top sand (shrinking)
  const top = (1 - k);
  if (top > 0.01) {
    const sy = -h / 2 - 2 - top * (h / 2 - 9);
    ctx.fillStyle = '#E8B860';
    ctx.fillRect(-w / 2, sy, w, -h / 2 - 2 - sy + 4);
  }
  // bottom sand (growing mound)
  const bh = k * (h / 2 - 8);
  ctx.beginPath();
  ctx.moveTo(-w / 2, -5);
  ctx.lineTo(-w / 2, -5 - bh * 0.6);
  ctx.quadraticCurveTo(0, -5 - bh * 1.6, w / 2, -5 - bh * 0.6);
  ctx.lineTo(w / 2, -5);
  ctx.closePath();
  ctx.fillStyle = '#E8B860';
  ctx.fill();
  if (k > 0 && k < 1) {
    ctx.fillStyle = '#E8B860';
    ctx.fillRect(-0.6, -h / 2, 1.2, h / 2 - 5 - bh);
  }
  ctx.restore();
  bulb();
  ctx.strokeStyle = 'rgba(120,140,150,0.8)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(-w / 2 + 4, -h + 8, 1.5, 9);
  // caps + posts
  for (const yy of [-h, -5]) {
    roundRect(ctx, -w / 2 - 2, yy, w + 4, 5, 2);
    fillStroke(ctx, '#7A4A2A', '#3A1C0A', 1);
  }
  ctx.fillStyle = '#5A3320';
  ctx.fillRect(-w / 2 - 1, -h + 4, 2, h - 9);
  ctx.fillRect(w / 2 - 1, -h + 4, 2, h - 9);
  ctx.restore();
}

// ---------------------------------------------------------------- lamp
function officeLampGlowWall(ctx) {
  const { x, y } = OFFICE.lamp;
  // light falloff: the room darkens away from the lamp + window (right) and towards the ceiling
  ctx.save();
  ctx.fillStyle = rg(ctx, 1000, 330, 100, 1100, [[0, 'rgba(34,14,4,0)'], [0.3, 'rgba(34,14,4,0.12)'], [0.6, 'rgba(34,14,4,0.32)'], [1, 'rgba(34,14,4,0.55)']]);
  ctx.fillRect(-700, -700, 2800, 2500);
  ctx.fillStyle = lg(ctx, 0, -300, 0, 300, [[0, 'rgba(34,14,4,0.45)'], [1, 'rgba(34,14,4,0)']]);
  ctx.fillRect(-700, -700, 2800, 1000);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  glow(ctx, x - 10, y - 10, 460, 400, '#FFAA4A', 0.36);
  glow(ctx, x, y - 20, 170, 150, '#FFE0A0', 0.32);
  // soft cone of light below the shade (stacked low-alpha cones = soft edges)
  for (let i = 0; i < 4; i++) {
    const k = 0.55 + i * 0.22;
    poly(ctx, [[x - 50 * k, y + 2], [x + 50 * k, y + 2], [x + 260 * k, 700], [x - 280 * k, 700]]);
    ctx.fillStyle = lg(ctx, 0, y, 0, 700, [[0, 'rgba(255,214,140,0.1)'], [1, 'rgba(255,214,140,0)']]);
    ctx.fill();
  }
  // window daylight on the wall around the window
  const w = OFFICE.window;
  glow(ctx, w.x, w.y, 230, 210, '#FFF0C8', 0.26);
  ctx.restore();
}
function officeLamp(ctx) {
  const { x, y } = OFFICE.lamp;
  glow(ctx, x - 20, 670, 240, 30, '#FFD27A', 0.25, 'screen');
  glow(ctx, x, 672, 40, 6, '#1A0A04', 0.5);
  // base
  ctx.beginPath();
  ctx.ellipse(x, 668, 32, 7, 0, Math.PI, 0);
  ctx.bezierCurveTo(x + 24, 656, x + 8, 654, x + 4, 650);
  ctx.lineTo(x - 4, 650);
  ctx.bezierCurveTo(x - 8, 654, x - 24, 656, x - 32, 668);
  ctx.closePath();
  fillStroke(ctx, lg(ctx, x - 32, 0, x + 32, 0, [[0, '#8A6A2A'], [0.6, '#D9A84A'], [1, '#FFE08A']]), '#5A3E10', 1.6);
  // pole
  ctx.fillStyle = lg(ctx, x - 3, 0, x + 3, 0, [[0, '#8A6A2A'], [0.5, '#D9A84A'], [1, '#FFE6A0']]);
  ctx.fillRect(x - 2.6, y + 4, 5.2, 650 - y - 4);
  ctx.strokeStyle = '#5A3E10';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 2.6, y + 4, 5.2, 650 - y - 4);
  circle(ctx, x, 480, 5);
  fillStroke(ctx, '#D9A84A', '#5A3E10', 1.2);
  // pull chain
  ctx.strokeStyle = '#B08A3A';
  ctx.lineWidth = 1;
  line(ctx, x + 22, y, x + 22, y + 26);
  ctx.stroke();
  circle(ctx, x + 22, y + 28, 2.4);
  fillStroke(ctx, '#D9A84A', '#5A3E10', 0.8);
  // shade (lit from inside)
  const tw = 36, bw = 62, ty = y - 74;
  poly(ctx, [[x - tw, ty], [x + tw, ty], [x + bw, y], [x - bw, y]]);
  ctx.fillStyle = lg(ctx, 0, ty, 0, y, [[0, '#F2D7A2'], [0.6, '#FBE6BA'], [1, '#FFF4D2']]);
  ctx.fill();
  ctx.save();
  poly(ctx, [[x - tw, ty], [x + tw, ty], [x + bw, y], [x - bw, y]]);
  ctx.clip();
  ctx.strokeStyle = rgba('#D9B47A', 0.45);
  ctx.lineWidth = 1;
  for (let i = -5; i <= 5; i++) { line(ctx, x + i * tw / 5.5, ty, x + i * bw / 5.5, y); ctx.stroke(); }
  glow(ctx, x, y + 6, 70, 40, '#FFFFFF', 0.5);
  ctx.restore();
  poly(ctx, [[x - tw, ty], [x + tw, ty], [x + bw, y], [x - bw, y]]);
  ctx.strokeStyle = '#B08A50';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // trim bands
  roundRect(ctx, x - tw - 1, ty - 2, tw * 2 + 2, 5, 2);
  fillStroke(ctx, '#C9572E', '#7A2E14', 1);
  roundRect(ctx, x - bw - 2, y - 4, bw * 2 + 4, 6, 2);
  fillStroke(ctx, '#C9572E', '#7A2E14', 1);
  // glowing opening underneath
  ellipse(ctx, x, y + 3, bw - 2, 5);
  ctx.fillStyle = '#FFF6DA';
  ctx.fill();
  // finial
  circle(ctx, x, ty - 6, 4);
  fillStroke(ctx, '#D9A84A', '#5A3E10', 1);
}

// ---------------------------------------------------------------- window light beam
const BEAM = (() => {
  const w = OFFICE.window;
  const d = { x: -0.6, y: 0.8 }, n = { x: 0.8, y: 0.6 };
  const L = 470;
  const p1 = [w.x + n.x * w.r, w.y + n.y * w.r], p2 = [w.x - n.x * w.r, w.y - n.y * w.r];
  return { d, n, L, p1, p2, q1: [p1[0] + d.x * L, p1[1] + d.y * L], q2: [p2[0] + d.x * L * 0.8, p2[1] + d.y * L * 0.8] };
})();
function officeBeam(ctx) {
  const { p1, p2, q1, q2 } = BEAM;
  const w = OFFICE.window;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  poly(ctx, [p2, p1, q1, q2]);
  ctx.fillStyle = lg(ctx, w.x, w.y, (q1[0] + q2[0]) / 2, (q1[1] + q2[1]) / 2, [[0, 'rgba(255,244,214,0.2)'], [0.6, 'rgba(255,244,214,0.08)'], [1, 'rgba(255,244,214,0)']]);
  ctx.fill();
  // sun patch with the window cross on the rug/floor
  const sx = (q1[0] + q2[0]) / 2 + 10, sy = 662;
  glow(ctx, sx, sy, 120, 20, '#FFF0C8', 0.28);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = '#5A2A10';
  ctx.lineWidth = 3;
  line(ctx, sx - 70, sy, sx + 70, sy);
  ctx.stroke();
  line(ctx, sx + 6, sy - 14, sx - 6, sy + 14);
  ctx.stroke();
  ctx.restore();
}
function officeDust(ctx, t) {
  const { p2, d, n } = BEAM;
  const w = OFFICE.window;
  ctx.save();
  for (let i = 0; i < 22; i++) {
    const u = (hash1(i * 3.1) * 0.85 + 0.08 + t * 0.006 * (0.5 + hash1(i * 7.7))) % 1;
    const v = hash1(i * 5.3) * 2 - 1;
    const along = u * BEAM.L * 0.9;
    const across = v * w.r * 0.9 * (1 - u * 0.2);
    const x = w.x + d.x * along + n.x * across + noise1(t * 0.3 + i * 4.1) * 6;
    const y = w.y + d.y * along + n.y * across + noise1(t * 0.27 + i * 2.3) * 6;
    const tw = 0.5 + 0.5 * Math.sin(t * (1.3 + hash1(i) * 1.7) + i * 2.1);
    const a = (0.25 + 0.45 * tw) * (1 - u * 0.7);
    circle(ctx, x, y, 0.9 + hash1(i * 9.1) * 1.3);
    ctx.fillStyle = rgba('#FFF6DD', a);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- assemble
function officeStatic(ctx) {
  officeTunnel(ctx);
  officeBackWall(ctx);
  officeAlcove(ctx);
  officeInkblot(ctx);
  officeDiploma(ctx);
  officeWindowFrame(ctx);
  officeFloor(ctx);
  officeLampGlowWall(ctx);
  officeRug(ctx);
  officeBeam(ctx);
  officeFern(ctx);
  officeCouch(ctx);
  officeTable(ctx, {}, false);
  officeChair(ctx);
  officeLamp(ctx);
  officeHangingPlant(ctx);
}

function drawTherapyOffice(ctx, t = 0, o = {}) {
  ctx.save();
  if (o.cache === false) officeStatic(ctx);
  else drawCached(ctx, 'office', officeStatic);
  officeWindowView(ctx, t, o);
  officeTable(ctx, { ...o, _t: t }, true);
  if (o.dust !== false) officeDust(ctx, t);
  ctx.restore();
}

function drawTherapyOfficeFront(ctx, t = 0, o = {}) {
  ctx.save();
  couchCushionFront(ctx, true);
  chairArm(ctx);
  ctx.restore();
}

// ════════════════════════════════════════════════════════════ RIVER SUNSET
const HY = 392;                                      // horizon / far water edge
const RIVER = {
  raftPos: { x: 640, y: 520 },
  waterY: HY,
  horizonY: HY,
  sun: { x: 790, y: 352, r: 46 },
  volcano: { x: 330, y: 282 },
  banks: { left: { x: 600, y: HY + 3 }, right: { x: 990, y: HY + 3 } },
};
const SKY = { top: '#2A1D4A', hi: '#5B3A7A', mid: '#A24E7C', low: '#E0716C', hor: '#FF9E5E' };
const RIV = {
  far: '#C06A84', tree: '#7E3F6E', bankL: '#55295A', bankR: '#4E2654', near: '#22132C',
  water0: '#FFAF72', water1: '#DE8278', water2: '#A65E80', water3: '#6E4276', water4: '#3C2858',
};

// canopy built from rounded tree crowns (pure functions of constants, memoised)
const leftEdge = (x) => HY + 3 + Math.max(0, 600 - x) * 0.085;
const rightEdge = (x) => HY + 3 + Math.max(0, x - 990) * 0.075;
function crownsFor(side) {
  const R = rng(side < 0 ? 71 : 93);
  const out = [];
  if (side < 0) {
    let x = 600;
    while (x > -560) {
      const big = x < 140;
      const r = big ? R.range(46, 78) : R.range(15, 27) * (1 + (600 - x) / 900);
      const top = big ? lerp(300, 70, clamp((140 - x) / 600)) + R.range(-25, 20) : lerp(381, 338, clamp((600 - x) / 460)) + R.range(-8, 8);
      out.push([x, Math.min(top + r, leftEdge(x) - r * 0.45), r]);
      if (R() < 0.7) { const x2 = x + r * R.range(0.3, 0.6), r2 = r * R.range(0.5, 0.7); out.push([x2, Math.min(top + r * R.range(0.55, 0.85), leftEdge(x2) - r2 * 0.45), r2]); }
      x -= r * (big ? 0.95 : 1.15);
    }
  } else {
    let x = 990;
    while (x < 1840) {
      const big = x > 1170;
      const r = big ? R.range(46, 78) : R.range(15, 26) * (1 + (x - 990) / 900);
      const top = big ? lerp(312, 80, clamp((x - 1170) / 560)) + R.range(-25, 20) : lerp(380, 340, clamp((x - 990) / 180)) + R.range(-8, 8);
      out.push([x, Math.min(top + r, rightEdge(x) - r * 0.45), r]);
      if (R() < 0.7) { const x2 = x - r * R.range(0.3, 0.6), r2 = r * R.range(0.5, 0.7); out.push([x2, Math.min(top + r * R.range(0.55, 0.85), rightEdge(x2) - r2 * 0.45), r2]); }
      x += r * (big ? 0.95 : 1.15);
    }
  }
  return out;
}
const CROWNS = { L: crownsFor(-1), R: crownsFor(1) };
// clip to the region above (side=-1) or below (side=+1) both banks' water edges
function edgeClip(ctx, below) {
  ctx.beginPath();
  ctx.moveTo(-600, below ? 1200 : -700);
  for (let x = -600; x <= 1900; x += 20) ctx.lineTo(x, x < 800 ? leftEdge(x) : rightEdge(x));
  ctx.lineTo(1900, below ? 1200 : -700);
  ctx.closePath();
  ctx.clip();
}
function riverBankReflections(ctx) {
  ctx.save();
  const sh = '#3A1F4A';
  ctx.fillStyle = lg(ctx, 0, HY, 0, HY + 300, [[0, mix(RIV.water1, sh, 0.55)], [0.1, mix(RIV.water1, sh, 0.5)], [0.42, mix(RIV.water2, sh, 0.42)], [0.85, mix(RIV.water3, sh, 0.3)], [1, mix(RIV.water3, sh, 0.25)]]);
  bankFill(ctx, CROWNS.L, leftEdge, true);
  bankFill(ctx, CROWNS.R, rightEdge, true);
  ctx.restore();
}
function bankFill(ctx, crowns, edgeFn, mirror, squash = 0.55) {
  const yOf = (x, y) => (mirror ? edgeFn(x) + (edgeFn(x) - y) * squash : y);
  const sorted = crowns.slice().sort((a, b) => a[0] - b[0]);
  ctx.beginPath();
  ctx.moveTo(sorted[0][0], edgeFn(sorted[0][0]));
  for (const [x, y] of sorted) ctx.lineTo(x, yOf(x, Math.min(y, edgeFn(x))));
  ctx.lineTo(sorted[sorted.length - 1][0], edgeFn(sorted[sorted.length - 1][0]));
  ctx.closePath();
  ctx.fill();
  for (const [x, y, r] of crowns) {
    if (mirror) ellipse(ctx, x, yOf(x, y), r, r * squash);
    else circle(ctx, x, y, r);
    ctx.fill();
  }
}
function riverBanks(ctx, t) {
  ctx.save();
  ctx.save();
  edgeClip(ctx, false);
  ctx.fillStyle = RIV.bankL;
  bankFill(ctx, CROWNS.L, leftEdge, false);
  ctx.fillStyle = RIV.bankR;
  bankFill(ctx, CROWNS.R, rightEdge, false);
  ctx.restore();
  // palms on the jungle masses
  for (const [px, h, lean, sw] of [[-40, 190, 0.1, 0.035], [96, 150, -0.12, 0.04], [455, 62, 0.12, 0.06], [1060, 58, -0.1, 0.06], [1250, 160, 0.1, 0.04], [1420, 200, -0.08, 0.035]]) {
    const left = px < 640;
    const base = left ? leftEdge(px) - 10 : rightEdge(px) - 10;
    palm(ctx, px, base - (h > 100 ? 60 : 0), h, lean, left ? '#3E1C48' : '#3A1A44', h > 100 ? 2 : 1.3, t, sw);
  }
  // banana-leaf clusters poking out of the canopy
  for (const [cr, n] of [[CROWNS.L, 0], [CROWNS.R, 1]]) {
    cr.forEach(([x, y, r], i) => {
      if (r < 40 || i % 3 !== n) return;
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + (k - 1) * 0.6 + Math.sin(t * 0.7 + i + k) * 0.03;
        leafPath(ctx, x + (k - 1) * r * 0.3, y - r * 0.7, r * 0.9, r * 0.2, a, k === 1 ? 0 : (k - 1) * 0.6);
        ctx.fillStyle = x < 640 ? '#3E1C48' : '#3A1A44';
        ctx.fill();
      }
    });
  }
  ctx.restore();
  // warm rim light on the crowns facing the sun
  ctx.save();
  ctx.lineWidth = 2;
  for (const [cr, a] of [[CROWNS.L, 0.18], [CROWNS.R, 0.32]]) {
    ctx.strokeStyle = rgba('#FF9E6E', a);
    for (const [x, y, r] of cr) {
      ctx.beginPath();
      ctx.arc(x, y, r - 1, x < 640 ? -1.9 : -2.6, x < 640 ? -0.6 : -1.3);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function riverSky(ctx, t, o) {
  const sun = sunPos(o);
  ctx.fillStyle = lg(ctx, 0, -320, 0, HY, [[0, SKY.top], [0.3, SKY.hi], [0.6, SKY.mid], [0.84, SKY.low], [1, SKY.hor]]);
  ctx.fillRect(-500, -500, 2300, HY + 520);
  // warm glow around the sun
  ctx.save();
  ctx.beginPath();
  ctx.rect(-500, -500, 2300, HY + 500);
  ctx.clip();
  glow(ctx, sun.x, sun.y + 10, 520, 300, '#FFC27A', 0.45);
  glow(ctx, sun.x, sun.y, 150, 120, '#FFE6B0', 0.55);
  ctx.restore();
  // first stars
  for (let i = 0; i < 26; i++) {
    const x = -300 + hash1(i * 7.13) * 1900, y = -280 + hash1(i * 3.71) * 360;
    const tw = 0.5 + 0.5 * Math.sin(t * (0.8 + hash1(i) * 1.5) + i);
    circle(ctx, x, y, 0.8 + hash1(i * 1.3) * 1.1);
    ctx.fillStyle = rgba('#FFF4E0', (0.25 + 0.55 * tw) * clamp((120 - y) / 200));
    ctx.fill();
  }
  // long stratus clouds as stacked soft pills, lit from below, drifting slowly
  const clouds = [
    [170, 92, 300, 22, 0.5], [600, 44, 360, 26, 0.35], [1060, 120, 380, 24, 0.65], [1300, 26, 260, 20, 0.3],
    [700, 206, 220, 12, 1], [1120, 258, 240, 11, 1.1], [-140, 170, 280, 18, 0.7],
  ];
  clouds.forEach(([cx, cy, w, h, warm], i) => {
    const x = cx + t * (1.2 + (i % 3) * 0.5);
    const body = mix('#4E2C6A', '#B0507A', clamp(warm * 0.7 + (cy - 40) / 420));
    const lit = mix('#FF9E7A', '#FFD08A', clamp(warm - 0.25));
    const R = rng(100 + i);
    const bars = [[x - w / 2, cy, w, h], [x - w / 2 + R.range(0.1, 0.35) * w, cy - h * 0.62, w * R.range(0.4, 0.6), h * 0.85], [x - w / 2 - R.range(0.05, 0.2) * w, cy + h * 0.6, w * R.range(0.45, 0.7), h * 0.7]];
    for (const [bx, by, bw, bh] of bars) {
      const lip = Math.max(2.2, bh * 0.2);
      roundRect(ctx, bx + 2, by - bh / 2 + lip, bw - 2, bh, bh / 2);
      ctx.fillStyle = lit;
      ctx.fill();
      roundRect(ctx, bx, by - bh / 2, bw, bh, bh / 2);
      ctx.fillStyle = body;
      ctx.fill();
    }
  });
}
// sky colour at height y (matches the riverSky gradient)
const SKY_STOPS = [[-320, SKY.top], [-320 + 0.3 * (HY + 320), SKY.hi], [-320 + 0.6 * (HY + 320), SKY.mid], [-320 + 0.84 * (HY + 320), SKY.low], [HY, SKY.hor]];
function skyAt(y) {
  if (y <= SKY_STOPS[0][0]) return SKY_STOPS[0][1];
  for (let i = 1; i < SKY_STOPS.length; i++) {
    if (y <= SKY_STOPS[i][0]) {
      const [y0, c0] = SKY_STOPS[i - 1], [y1, c1] = SKY_STOPS[i];
      return mix(c0, c1, (y - y0) / (y1 - y0));
    }
  }
  return SKY.hor;
}
function sunPos(o) {
  const k = clamp(o.sunset || 0);
  return { x: RIVER.sun.x, y: RIVER.sun.y + k * 38, r: RIVER.sun.r };
}
function riverSun(ctx, t, o) {
  const s = sunPos(o);
  circle(ctx, s.x, s.y, s.r);
  ctx.fillStyle = rg(ctx, s.x - 10, s.y - 12, 4, s.r, [[0, '#FFFBE6'], [0.55, '#FFE7A6'], [1, '#FFC46E']]);
  ctx.fill();
  // subtle horizontal bands (heat haze) across the lower disc
  ctx.save();
  circle(ctx, s.x, s.y, s.r);
  ctx.clip();
  for (let i = 0; i < 3; i++) {
    const y = s.y + 18 + i * 9 + Math.sin(t * 1.3 + i) * 1.2;
    ctx.fillStyle = 'rgba(255,170,100,0.35)';
    ctx.fillRect(s.x - s.r, y, s.r * 2, 2 + i);
  }
  ctx.restore();
}
function riverVolcano(ctx, t, o) {
  const v = RIVER.volcano;
  const smoke = o.smoke == null ? 1 : o.smoke, gl = o.glow == null ? 1 : o.glow;
  // smoke column (behind the cone), drifting right with the wind. Opaque flat puffs whose
  // colour dissolves into the sky colour behind them (no alpha rims where puffs overlap).
  const N = 24;
  for (let j = N - 1; j >= 0; j--) {
    const p = ((t * 0.045 + j / N) % 1 + 1) % 1;
    const vis = smoke * Math.pow(1 - p, 0.9) * smoothstep(0, 0.05, p);
    if (vis < 0.02) continue;
    const x = v.x + p * 170 + Math.sin(p * 6 + j) * 6 + p * p * 80, y = v.y - 4 - p * 230 + p * p * 60;
    const r = (7 + p * 46) * smoothstep(0, 0.08, p + 0.02);
    const sky = skyAt(y);
    circle(ctx, x, y, r);
    ctx.fillStyle = mix(sky, mix('#4E3058', '#7A4E7E', p), clamp(vis * 1.1));
    ctx.fill();
    circle(ctx, x + r * 0.22, y + r * 0.22, r * 0.7);
    ctx.fillStyle = mix(sky, '#B0607E', clamp(vis * 0.75));
    ctx.fill();
  }
  // cone
  ctx.beginPath();
  ctx.moveTo(v.x - 190, HY + 2);
  ctx.bezierCurveTo(v.x - 110, HY - 24, v.x - 46, v.y + 46, v.x - 14, v.y);
  ctx.lineTo(v.x + 14, v.y + 1);
  ctx.bezierCurveTo(v.x + 46, v.y + 46, v.x + 116, HY - 26, v.x + 200, HY + 2);
  ctx.closePath();
  ctx.fillStyle = lg(ctx, v.x - 120, 0, v.x + 140, 0, [[0, '#8A527E'], [0.55, '#9A5C86'], [1, '#B06C8A']]);
  ctx.fill();
  // faint glowing scar of lava down the flank
  ctx.beginPath();
  ctx.moveTo(v.x - 4, v.y + 3);
  ctx.bezierCurveTo(v.x - 10, v.y + 30, v.x + 6, v.y + 50, v.x - 6, HY - 6);
  ctx.strokeStyle = rgba('#FF6A3A', 0.35 * gl);
  ctx.lineWidth = 2.2;
  ctx.stroke();
  // crater glow (pulsing)
  const pulse = 0.75 + 0.25 * Math.sin(t * 1.7) + 0.1 * noise1(t * 3);
  glow(ctx, v.x, v.y - 2, 46, 26, '#FF5A2A', 0.55 * gl * pulse, 'screen');
  ellipse(ctx, v.x, v.y + 1, 12, 2.6);
  ctx.fillStyle = rgba('#FF8A4A', 0.85 * gl);
  ctx.fill();
}
function riverFar(ctx) {
  // hazy far hills along the horizon
  ctx.beginPath();
  ctx.moveTo(-500, HY + 2);
  for (let x = -500; x <= 1800; x += 30) ctx.lineTo(x, HY - 14 - (noise1(x * 0.006 + 1.3) * 0.5 + 0.5) * 26);
  ctx.lineTo(1800, HY + 2);
  ctx.closePath();
  ctx.fillStyle = RIV.far;
  ctx.fill();
  // far treeline (with a few palms)
  ctx.beginPath();
  ctx.moveTo(-500, HY + 2);
  for (let x = -500; x <= 1800; x += 9) ctx.lineTo(x, HY - 8 - (noise1(x * 0.045 + 7) * 0.5 + 0.5) * 9 - (noise1(x * 0.011) * 0.5 + 0.5) * 6);
  ctx.lineTo(1800, HY + 2);
  ctx.closePath();
  ctx.fillStyle = RIV.tree;
  ctx.fill();
  for (const [px, h, lean] of [[120, 34, 0.15], [470, 28, -0.1], [905, 30, 0.12], [1180, 36, -0.08]]) palm(ctx, px, HY - 8, h, lean, RIV.tree, 0.55);
}
// palm tree silhouette (trunk + fronds), base at (x, y)
function palm(ctx, x, y, h, lean, col, s = 1, t = 0, sway = 0) {
  const tx = x + lean * h, ty = y - h;
  ctx.beginPath();
  ctx.moveTo(x - 2.4 * s, y);
  ctx.quadraticCurveTo(x + lean * h * 0.3 - 2 * s, y - h * 0.6, tx - 1.2 * s, ty);
  ctx.lineTo(tx + 1.2 * s, ty);
  ctx.quadraticCurveTo(x + lean * h * 0.3 + 2 * s, y - h * 0.6, x + 2.4 * s, y);
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
  const fronds = [-2.9, -2.4, -1.9, -1.2, -0.7, -0.25];
  fronds.forEach((a, i) => {
    const sw = sway ? Math.sin(t * 0.9 + i) * sway : 0;
    const L = h * (0.55 + 0.12 * Math.sin(i * 2.1));
    leafPath(ctx, tx, ty, L, L * 0.13, a + sw, 0.45 * (a < -1.57 ? -1 : 1));
    ctx.fillStyle = col;
    ctx.fill();
  });
}
// water surface (gradient + ripples + sun column); used again by drawRiverFront inside a clip
function waterBase(ctx) {
  ctx.fillStyle = lg(ctx, 0, HY, 0, 900, [[0, RIV.water0], [0.06, RIV.water1], [0.25, RIV.water2], [0.5, RIV.water3], [1, RIV.water4]]);
  ctx.fillRect(-500, HY, 2300, 900);
}
function waterDetail(ctx, t, o) {
  const sun = sunPos(o);
  const flow = o.flow == null ? 1 : o.flow;
  const B = o._band;           // optional cull box {x0,x1,y0,y1} (used by drawRiverFront)
  const inB = (xa, xb, y) => !B || (y > B.y0 - 6 && y < B.y1 + 6 && xb > B.x0 && xa < B.x1);
  if (!B) {
  // far-water reflection of the treeline + Mount Snooze
  ctx.fillStyle = rgba('#7E3F6E', 0.5);
  ctx.fillRect(-500, HY, 2300, 5);
  const v = RIVER.volcano;
  ctx.beginPath();
  ctx.moveTo(v.x - 130, HY + 1);
  ctx.bezierCurveTo(v.x - 60, HY + 12, v.x - 30, HY + 40, v.x - 10, HY + 60);
  ctx.lineTo(v.x + 10, HY + 60);
  ctx.bezierCurveTo(v.x + 30, HY + 40, v.x + 70, HY + 12, v.x + 140, HY + 1);
  ctx.closePath();
  ctx.fillStyle = rgba('#8A527E', 0.35);
  ctx.fill();
  ctx.fillStyle = rgba('#FF6A3A', 0.25 * (o.glow == null ? 1 : o.glow));
  ctx.fillRect(v.x - 4, HY + 44, 8, 22);
  }
  // faint reflections of the lit cloud undersides
  ctx.save();
  ctx.lineCap = 'round';
  for (const [cx, cy, w] of [[170, 92, 300], [600, 44, 360], [1060, 120, 380], [700, 206, 220], [1120, 258, 240], [-140, 170, 280]]) {
    const ry = HY + (HY - cy) * 0.42;
    line(ctx, cx - w * 0.45, ry, cx + w * 0.45, ry);
    ctx.strokeStyle = rgba('#FFB38A', 0.12);
    ctx.lineWidth = 3 + (ry - HY) * 0.02;
    ctx.stroke();
  }
  ctx.restore();
  // broad soft glow column under the sun
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.beginPath();
  ctx.rect(-600, HY, 2500, 1000);
  ctx.clip();
  glow(ctx, sun.x, HY + 6, 170, 360, '#FFC27A', 0.42);
  glow(ctx, sun.x, HY + 2, 260, 40, '#FFD9A0', 0.5);
  ctx.restore();
  // surface ripples drifting with the current (perspective-spaced rows)
  ctx.lineCap = 'round';
  const rows = 34;
  for (let i = 0; i < rows; i++) {
    const k = i / (rows - 1);
    const y = HY + 6 + Math.pow(k, 1.7) * 520;
    const persp = 0.25 + k * 1.6;
    const n = 6 + Math.floor(hash1(i * 1.7) * 4);
    for (let j = 0; j < n; j++) {
      const span = 2400;
      const x0 = -500 + (hash1(i * 13.1 + j * 7.7) * span + t * 9 * persp * flow + j * (span / n)) % span;
      const len = (14 + hash1(i * 3.3 + j) * 46) * persp;
      const yy = y + Math.sin(t * 1.3 + j * 2 + i) * 0.8 * persp;
      if (!inB(x0, x0 + len, yy)) continue;
      line(ctx, x0, yy, x0 + len, yy);
      const light = (i + j) % 3 !== 0;
      ctx.strokeStyle = light ? rgba('#FFC6A8', 0.16 + 0.08 * k) : rgba('#2E1A48', 0.22);
      ctx.lineWidth = 0.8 + persp * 1.1;
      ctx.stroke();
    }
  }
  // shimmering reflection column of the sun
  const N = 30;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < N; i++) {
    const k = i / (N - 1);
    const y = HY + 3 + Math.pow(k, 1.55) * 330;
    const w = 26 + k * 150;
    const persp = 0.35 + k * 1.3;
    const pieces = 1 + Math.floor(hash1(i * 4.1) * 3);
    for (let j = 0; j < pieces; j++) {
      const sh = noise1(t * 2.2 + i * 1.7 + j * 5.3);
      const sh2 = noise1(t * 1.6 + i * 2.9 + j * 1.1 + 40);
      const cx = sun.x + (hash1(i * 7.3 + j * 3.1) - 0.5) * w * 0.9 + sh2 * 6 * persp;
      const len = w * (0.22 + 0.4 * hash1(i * 2.2 + j)) * (0.65 + 0.35 * sh);
      const a = clamp(0.5 + 0.5 * sh) * (1 - k * 0.55);
      if (!inB(cx - len / 2, cx + len / 2, y)) continue;
      line(ctx, cx - len / 2, y, cx + len / 2, y);
      ctx.strokeStyle = rgba(k < 0.35 ? '#FFF0C0' : '#FFC27A', a * 0.9);
      ctx.lineWidth = 1 + persp * 1.6;
      ctx.stroke();
    }
  }
  ctx.restore();
}
function riverLilies(ctx, t) {
  const pads = [[90, 640, 40], [170, 686, 30], [1130, 660, 42], [1215, 700, 34], [40, 720, 46], [1060, 708, 26]];
  pads.forEach(([x, y, r], i) => {
    const bob = Math.sin(t * 0.9 + i) * 1.2;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.3, 0, 0.2, TAU - 0.2);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fillStyle = '#3A2A4A';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.3, 0, Math.PI * 1.05, Math.PI * 1.9);
    ctx.strokeStyle = rgba('#FFA07A', 0.4);
    ctx.lineWidth = 1.4;
    ctx.stroke();
    if (i === 0 || i === 2) {
      // a lotus bud catching the light
      ctx.beginPath();
      ctx.moveTo(-4, -2);
      ctx.quadraticCurveTo(-6, -12, 0, -18);
      ctx.quadraticCurveTo(6, -12, 4, -2);
      ctx.closePath();
      ctx.fillStyle = '#E58AA6';
      ctx.fill();
    }
    ctx.restore();
  });
}
function riverAsh(ctx, t, amt, front) {
  if (amt <= 0) return;
  const nAsh = Math.round((front ? 14 : 90) * amt), nEmb = Math.round((front ? 6 : 24) * amt);
  const W = 2000, H = 1500, X0 = -360, Y0 = -380;
  const seed = front ? 500 : 0;
  for (let i = 0; i < nAsh; i++) {
    const h1 = hash1(i * 3.17 + seed), h2 = hash1(i * 7.31 + seed), h3 = hash1(i * 1.93 + seed);
    const sp = front ? 1.6 : 0.6 + h3 * 0.7;
    const x = X0 + ((h1 * W + t * (10 + h2 * 10) * sp) % W + W) % W + Math.sin(t * (0.6 + h3) + i) * 12;
    const y = Y0 + ((h2 * H + t * (9 + h1 * 9) * sp) % H + H) % H;
    const s = (front ? 3.5 : 1.8) + h3 * (front ? 3 : 2.4);
    const rot = t * (1 + h1 * 2) + i;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.sin(t * 2 + i)));
    poly(ctx, [[-s, -s * 0.4], [s * 0.6, -s * 0.7], [s, s * 0.3], [-s * 0.3, s * 0.6]]);
    ctx.fillStyle = rgba(front ? '#3A2A40' : '#D9C6D2', front ? 0.7 : 0.55 + h2 * 0.3);
    ctx.fill();
    ctx.restore();
  }
  for (let i = 0; i < nEmb; i++) {
    const h1 = hash1(i * 5.77 + seed + 99), h2 = hash1(i * 2.41 + seed + 99), h3 = hash1(i * 9.13 + seed + 99);
    const x = X0 + ((h1 * W + t * (12 + h2 * 10)) % W + W) % W + Math.sin(t * 1.3 + i * 2) * 10;
    const y = Y0 + H - ((h2 * H + t * (8 + h3 * 10)) % H + H) % H;
    const fl = 0.55 + 0.45 * Math.sin(t * (5 + h3 * 4) + i * 3);
    const r = (front ? 2.4 : 1.3) + h3 * 1.2;
    circle(ctx, x, y, r * 3.2);
    ctx.fillStyle = rgba('#FF7A2E', 0.16 * fl);
    ctx.fill();
    circle(ctx, x, y, r);
    ctx.fillStyle = rgba('#FFD27A', 0.95 * fl);
    ctx.fill();
  }
}
function riverBirds(ctx, t) {
  for (let i = 0; i < 3; i++) {
    const x = 860 + ((t * 7 + i * 26) % 900) - 300 + i * 14, y = 226 + i * 9 + Math.sin(t * 0.7 + i) * 4;
    const f = Math.sin(t * 7 + i * 2);
    const s = 5 - i;
    ctx.beginPath();
    ctx.moveTo(x - s, y - f * s * 0.6);
    ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.2, x, y);
    ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.2, x + s, y - f * s * 0.6);
    ctx.strokeStyle = rgba('#3A2148', 0.85);
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }
}
function raftShadow(ctx, t, o) {
  const x = o.raftX == null ? RIVER.raftPos.x : o.raftX, y = o.raftY == null ? RIVER.raftPos.y : o.raftY, w = o.raftW || 330;
  // dark reflection / shadow of the raft on the water
  ellipse(ctx, x, y + 14, w * 0.56, 18);
  ctx.fillStyle = rgba('#2A1840', 0.35);
  ctx.fill();
  // back halves of the wake rings
  for (let i = 0; i < 3; i++) {
    const p = ((t * 0.28 + i / 3) % 1 + 1) % 1;
    ctx.beginPath();
    ctx.ellipse(x, y + 2, w * 0.5 + 16 + p * 130, 9 + p * 26, 0, Math.PI, TAU);
    ctx.strokeStyle = rgba('#FFC6A8', (1 - p) * 0.3);
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
}

function drawRiverSunset(ctx, t = 0, o = {}) {
  ctx.save();
  riverSky(ctx, t, o);
  riverSun(ctx, t, o);
  riverVolcano(ctx, t, o);
  riverFar(ctx);
  waterBase(ctx);
  riverBankReflections(ctx);
  waterDetail(ctx, t, o);
  riverBanks(ctx, t);
  if (o.birds !== false) riverBirds(ctx, t);
  riverLilies(ctx, t);
  if (o.raft !== false) raftShadow(ctx, t, o);
  riverAsh(ctx, t, o.ash == null ? 0.35 : o.ash, false);
  ctx.restore();
}

function riverForeground(ctx, t) {
  const col = RIV.near;
  // reeds + cattails, bottom-left and bottom-right
  const clumps = [[-120, 1], [60, 0.8], [1180, 1.1], [1360, 0.9]];
  clumps.forEach(([cx, sc], ci) => {
    const R = rng(300 + ci);
    for (let i = 0; i < 9; i++) {
      const bx = cx + R.range(-70, 70), by = 760;
      const h = R.range(160, 300) * sc;
      const lean = R.range(-0.35, 0.35) + (cx < 640 ? 0.12 : -0.12);
      const sw = Math.sin(t * 0.8 + i * 1.3 + ci) * 0.03;
      const tipx = bx + Math.sin(lean + sw) * h, tipy = by - Math.cos(lean + sw) * h;
      ctx.beginPath();
      ctx.moveTo(bx - 5 * sc, 1120);            // stems continue below frame (camera margin)
      ctx.lineTo(bx - 5 * sc, by);
      ctx.quadraticCurveTo(bx + (tipx - bx) * 0.3, by - h * 0.6, tipx, tipy);
      ctx.quadraticCurveTo(bx + (tipx - bx) * 0.3 + 3, by - h * 0.6, bx + 5 * sc, by);
      ctx.lineTo(bx + 5 * sc, 1120);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      if (i % 3 === 0) {
        // cattail
        const kx = bx + (tipx - bx) * 0.82, ky = by + (tipy - by) * 0.82;
        ctx.save();
        ctx.translate(kx, ky);
        ctx.rotate(lean + sw);
        roundRect(ctx, -5 * sc, -18 * sc, 10 * sc, 36 * sc, 5 * sc);
        ctx.fillStyle = '#2E1A2A';
        ctx.fill();
        ctx.strokeStyle = rgba('#FF9E6E', 0.35);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(4 * sc, -16 * sc);
        ctx.lineTo(4 * sc, 16 * sc);
        ctx.stroke();
        ctx.restore();
      }
    }
  });
  // drooping coconut frond hanging into the top-left corner
  const sway = Math.sin(t * 0.55) * 0.025;
  ctx.save();
  ctx.translate(-150, -70);
  ctx.rotate(sway);
  // stem continues off towards the (unseen) palm crown so camera margins never show its end
  ctx.beginPath();
  ctx.moveTo(-320, -260);
  ctx.quadraticCurveTo(-120, -90, 0, 0);
  ctx.strokeStyle = col;
  ctx.lineWidth = 9;
  ctx.stroke();
  const P0 = [0, 0], P1 = [250, -40], P2 = [400, 120];
  const at = (k) => [(1 - k) * (1 - k) * P0[0] + 2 * (1 - k) * k * P1[0] + k * k * P2[0], (1 - k) * (1 - k) * P0[1] + 2 * (1 - k) * k * P1[1] + k * k * P2[1]];
  ctx.beginPath();
  ctx.moveTo(P0[0], P0[1]);
  ctx.quadraticCurveTo(P1[0], P1[1], P2[0], P2[1]);
  ctx.strokeStyle = col;
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.fillStyle = col;
  for (let i = 2; i <= 30; i++) {
    const k = i / 30;
    const [px, py] = at(k), [qx, qy] = at(Math.min(1, k + 0.02));
    const tan = Math.atan2(qy - py, qx - px);
    const L = (130 - k * 70) * (0.85 + 0.3 * hash1(i * 3.3));
    const flutter = Math.sin(t * 1.4 + i * 0.7) * 0.03;
    leafPath(ctx, px, py, L, 6.5 - k * 2.5, tan + 1.25 + flutter + hash1(i) * 0.15, 0.25);
    ctx.fill();
    leafPath(ctx, px, py, L * 0.9, 6 - k * 2.5, tan + 2.0 + flutter + hash1(i * 7) * 0.15, -0.25);
    ctx.fill();
  }
  ctx.restore();
}

function drawRiverFront(ctx, t = 0, o = {}) {
  const x = o.raftX == null ? RIVER.raftPos.x : o.raftX;
  const y = o.raftY == null ? RIVER.raftPos.y : o.raftY;
  const w = o.raftW || 330;
  const x0 = x - w / 2 - 50, x1 = x + w / 2 + 50;
  ctx.save();
  // translucent water band over the raft's lower edge (re-renders the same water, so it is seamless)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, y + 8);
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const xx = lerp(x0 + 20, x1 - 20, i / n);
    const yy = y + 3 + Math.sin(xx * 0.06 + t * 2.4) * 1.6 + Math.sin(xx * 0.13 - t * 3.1) * 0.9;
    ctx.lineTo(xx, yy);
  }
  ctx.lineTo(x1, y + 8);
  ctx.lineTo(x1, y + 90);
  ctx.lineTo(x0, y + 90);
  ctx.closePath();
  ctx.clip();
  ctx.globalAlpha = 0.82;
  waterBase(ctx);
  waterDetail(ctx, t, { ...o, _band: { x0, x1, y0: y - 4, y1: y + 90 } });
  ctx.restore();
  // waterline glints + foam lapping at the raft
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const xx = lerp(x - w / 2 + 6, x + w / 2 - 6, (i + 0.5) / 16) + Math.sin(t * 1.7 + i) * 3;
    const yy = y + 3 + Math.sin(xx * 0.06 + t * 2.4) * 1.6;
    const a = 0.35 + 0.35 * Math.sin(t * 3.1 + i * 1.9);
    line(ctx, xx - 6, yy, xx + 6, yy);
    ctx.strokeStyle = rgba('#FFE2B8', a);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (o.wake !== false) {
    for (let i = 0; i < 3; i++) {
      const p = ((t * 0.28 + i / 3) % 1 + 1) % 1;
      ctx.beginPath();
      ctx.ellipse(x, y + 2, w * 0.5 + 16 + p * 130, 9 + p * 26, 0, 0, Math.PI);
      ctx.strokeStyle = rgba('#FFC6A8', (1 - p) * 0.4);
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const fx = x + side * (w / 2 + 2 + i * 7), fy = y + 4 + Math.sin(t * 4 + i * 2 + side) * 1.5;
        ellipse(ctx, fx, fy, 5 - i, 2.4 - i * 0.4);
        ctx.fillStyle = rgba('#FFE8D6', 0.75 - i * 0.15);
        ctx.fill();
      }
    }
  }
  ctx.restore();
  riverAsh(ctx, t, o.ash == null ? 0.35 : o.ash, true);
  if (o.foreground !== false) riverForeground(ctx, t);
  if (o.grade) riverGrade(ctx, t, o, o.grade);
  ctx.restore();
}
// sunset colour grade over everything already drawn (sits characters into the light):
// a lilac multiply that deepens away from the sun + a warm backlight bloom around it.
function riverGrade(ctx, t, o, k) {
  const sun = sunPos(o);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = lg(ctx, 0, -100, 0, 820, [[0, mix('#FFFFFF', '#B89AD0', k * 0.55)], [0.5, mix('#FFFFFF', '#E8A8B8', k * 0.35)], [1, mix('#FFFFFF', '#9A86C8', k * 0.6)]]);
  ctx.fillRect(-600, -600, 2500, 2000);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  glow(ctx, sun.x, sun.y + 20, 420, 260, '#FFB070', 0.35 * k);
  ctx.restore();
}

// Mirror-draw fn into the water as a rippled reflection (scratch canvas; fn called once).
let _scratch = null;
function drawRiverReflection(ctx, t, o, fn) {
  const m = ctx.getTransform();
  const cw = (ctx.canvas && ctx.canvas.width) || 1920, ch = (ctx.canvas && ctx.canvas.height) || 1080;
  if (!_scratch || _scratch.width !== cw || _scratch.height !== ch) _scratch = napi().createCanvas(cw, ch);
  const sx = _scratch.getContext('2d');
  sx.save();
  sx.setTransform(1, 0, 0, 1, 0, 0);
  sx.clearRect(0, 0, cw, ch);
  sx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
  fn(sx);
  sx.restore();
  const yW = o.y == null ? RIVER.raftPos.y : o.y;
  const depth = o.depth || 150;
  const alpha = o.alpha == null ? 0.45 : o.alpha;
  const sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
  const wy = m.b * 640 + m.d * yW + m.f;                // device-space waterline (assumes ~no rotation)
  const dd = depth * sc;
  const xa = o.x0 == null ? 0 : Math.max(0, m.a * o.x0 + m.e), xb = o.x1 == null ? cw : Math.min(cw, m.a * o.x1 + m.e);
  const strips = 26;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingQuality = 'low';
  for (let i = 0; i < strips; i++) {
    const y0 = wy + (i * dd) / strips, h = dd / strips + 1;
    const srcTop = 2 * wy - (y0 + h);
    if (srcTop < 0 || srcTop + h > ch || y0 > ch) continue;
    const off = (Math.sin(t * 2.1 + i * 0.85) * 1.5 + Math.sin(t * 1.3 + i * 1.7)) * (0.6 + (i / strips) * 2) * sc;
    ctx.globalAlpha = alpha * (1 - i / strips) * (i % 3 === 2 ? 0.55 : 1);
    ctx.save();
    ctx.translate(off, y0 + h);
    ctx.scale(1, -1);
    ctx.drawImage(_scratch, xa, srcTop, xb - xa, h, xa, 0, xb - xa, h);
    ctx.restore();
  }
  ctx.restore();
}

// ════════════════════════════════════════════════════════════ TITLE CARDS
function cardAlpha(t, o) {
  const fi = o.fadeIn || 0, fo = o.fadeOut || 0, dur = o.dur == null ? Infinity : o.dur;
  let a = 1;
  if (fi > 0) a = Math.min(a, clamp(t / fi));
  if (fo > 0 && isFinite(dur)) a = Math.min(a, clamp((dur - t) / fo));
  if (isFinite(dur) && t > dur) a = 0;
  return a;
}
const lineObj = (l) => (typeof l === 'string' ? { text: l } : l || { text: '' });
// draw text centred with letter spacing (compensates the trailing space)
function spacedText(ctx, text, x, y, spacing) {
  ctx.letterSpacing = spacing + 'px';
  const w = ctx.measureText(text).width;
  ctx.textAlign = 'left';
  ctx.fillText(text, x - (w - spacing) / 2, y);
  ctx.letterSpacing = '0px';
  return w - spacing;
}
function woodyCard(ctx, t, o, a) {
  ctx.fillStyle = '#000';
  ctx.fillRect(-600, -600, 2480, 1920);
  const lines = (o.lines && o.lines.length ? o.lines : ['CHILL CAPYBARA']).map(lineObj);
  const big = o.size || 74;
  const sizes = lines.map((l, i) => l.size || (i === 0 ? big : big * 0.5));
  const gaps = lines.map((l, i) => (l.gap != null ? l.gap : i === 0 ? 0 : sizes[i] * 1.05 + sizes[i - 1] * 0.32));
  const total = sizes[0] * 0.72 + gaps.slice(1).reduce((s, g) => s + g, 0);
  let y = 360 - total / 2 + sizes[0] * 0.72;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => {
    if (i > 0) y += gaps[i];
    let sz = sizes[i];
    const spacing = l.spacing != null ? l.spacing : sz * 0.16;
    ctx.font = `400 ${sz}px ${l.font || 'Yeseva'}`;
    ctx.letterSpacing = spacing + 'px';
    const w = ctx.measureText(l.text).width;
    ctx.letterSpacing = '0px';
    if (w > 1120) { sz *= 1120 / w; ctx.font = `400 ${sz}px ${l.font || 'Yeseva'}`; }
    ctx.fillStyle = l.color || '#FFFFFF';
    spacedText(ctx, l.text, 640, y, l.spacing != null ? l.spacing : sz * 0.16);
  });
  ctx.restore();
}

// cute sitting capybara silhouette (faces right), origin = ground under its middle.
// rim = colour of a thin back-light along the top contour (null = none).
function capySilhouettePath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-80, 0);
  ctx.bezierCurveTo(-102, -20, -102, -82, -62, -98);
  ctx.bezierCurveTo(-30, -112, 20, -108, 50, -96);
  ctx.bezierCurveTo(56, -108, 70, -114, 92, -112);
  ctx.lineTo(116, -108);
  ctx.bezierCurveTo(130, -106, 136, -96, 135, -84);
  ctx.lineTo(134, -70);
  ctx.bezierCurveTo(133, -62, 126, -58, 118, -58);
  ctx.bezierCurveTo(104, -57, 92, -56, 82, -50);
  ctx.bezierCurveTo(72, -44, 66, -34, 64, -20);
  ctx.lineTo(64, 0);
  ctx.closePath();
  ctx.moveTo(82, -114);
  ctx.ellipse(74, -114, 8, 6, -0.3, 0, TAU);
}
function capySilhouette(ctx, x, y, s, col, rim) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  capySilhouettePath(ctx);
  ctx.fillStyle = col;
  ctx.fill();
  if (rim) {
    ctx.save();
    capySilhouettePath(ctx);
    ctx.clip();
    ctx.translate(0, 3.5);
    capySilhouettePath(ctx);
    ctx.lineWidth = 3;
    ctx.strokeStyle = rim;
    ctx.translate(0, -3.5);
    ctx.stroke();
    // re-cover everything but a thin top crescent
    ctx.translate(0, 3);
    capySilhouettePath(ctx);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
function groovyTitleFill(ctx, y0, y1) {
  return lg(ctx, 0, y0, 0, y1, [[0, '#FFF0A8'], [0.35, '#FFC85A'], [0.7, '#FF8A50'], [1, '#F0566E']]);
}
function groovyCard(ctx, t, o, a) {
  const lines = o.lines && o.lines.length ? o.lines.map(lineObj) : [];
  const title = (lines[0] && lines[0].text) || 'Chill Capybara';
  const sub = o.sub != null ? o.sub : lines[1] ? lines[1].text : 'THE END';
  const bg = o.bg || '#1E0F2A';
  ctx.save();
  // background
  ctx.fillStyle = bg;
  ctx.fillRect(-600, -600, 2480, 1920);
  const HZ = 488, SX = 640;
  ctx.fillStyle = rg(ctx, SX, HZ - 40, 40, 900, [[0, '#5A2458'], [0.45, '#3A1846'], [1, bg]]);
  ctx.fillRect(-600, -600, 2480, 1920);
  // slow sunburst rays
  ctx.save();
  ctx.translate(SX, HZ);
  ctx.rotate(t * 0.035);
  for (let i = 0; i < 18; i++) {
    const a0 = (i / 18) * TAU, a1 = a0 + TAU / 36;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 1400, a0, a1);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,190,140,0.045)';
    ctx.fill();
  }
  ctx.restore();
  // sun rising behind the horizon (70s striped)
  const rise = ease.outCubic(clamp(t / 1.5));
  const R0 = 196, sy = HZ + (1 - rise) * (R0 + 30);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-600, -600, 2480, HZ + 600);
  ctx.clip();
  glow(ctx, SX, sy, R0 * 1.9, R0 * 1.5, '#FF8A5A', 0.35 * rise, 'screen');
  ctx.beginPath();
  ctx.arc(SX, sy, R0, 0, TAU);
  ctx.clip();
  const sunFill = lg(ctx, 0, sy - R0, 0, HZ, [[0, '#FFE88A'], [0.45, '#FFB04E'], [0.8, '#FF7458'], [1, '#E8506E']]);
  ctx.fillStyle = sunFill;
  // stripes: gaps grow towards the horizon, and scroll down slowly
  let yy = sy - R0;
  const gapStart = HZ - 120;
  ctx.fillRect(SX - R0, yy, R0 * 2, gapStart - yy);
  const scroll = (t * 6) % 22;
  for (let i = 0; i < 8; i++) {
    const ya = gapStart + i * 22 + scroll - 22;
    const gap = 2 + i * 1.6;
    ctx.fillRect(SX - R0, Math.max(ya, gapStart), R0 * 2, 22 - gap - Math.max(0, gapStart - ya));
  }
  ctx.restore();
  // horizon line
  ctx.fillStyle = lg(ctx, 120, 0, 1160, 0, [[0, 'rgba(255,214,160,0)'], [0.5, 'rgba(255,214,160,0.9)'], [1, 'rgba(255,214,160,0)']]);
  ctx.fillRect(120, HZ - 1, 1040, 2.5);
  // shimmering reflection below the horizon
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const ry = HZ + 14 + i * 14;
    const w = (300 - i * 44) * rise * (0.85 + 0.15 * Math.sin(t * 2 + i * 1.3));
    line(ctx, SX - w / 2, ry, SX + w / 2, ry);
    ctx.strokeStyle = rgba(mix('#FFB04E', '#E8506E', i / 5), (0.75 - i * 0.1) * rise);
    ctx.lineWidth = 5 - i * 0.5;
    ctx.stroke();
  }
  ctx.restore();
  // capybara silhouette on the horizon, wearing an orange that drops in
  const cs = 1.05, cx0 = SX - 24;
  // the capybara surfaces out of the water (clipped at the horizon), with a little splash ring
  const pop = clamp((t - 0.35) / 0.8);
  const capyY = HZ + (1 - ease.outBack(pop, 1.6)) * 135 * cs;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-600, -600, 2480, HZ + 600);
  ctx.clip();
  capySilhouette(ctx, cx0, capyY, cs, '#24102E', rgba('#FFC870', 0.9 * rise));
  ctx.restore();
  if (pop > 0 && pop < 1) {
    const rr = 40 + pop * 120;
    ctx.beginPath();
    ctx.ellipse(cx0 + 20, HZ + 2, rr, rr * 0.08, 0, 0, TAU);
    ctx.strokeStyle = rgba('#FFD6A0', (1 - pop) * 0.8);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const drop = clamp((t - 1.25) / 0.9);
  if (drop > 0) {
    const R = 23;
    const oy = lerp(-200, HZ - 111 * cs - R + 2, ease.outBounce(drop));
    const squash = drop > 0.34 && drop < 0.5 ? 0.88 : 1;
    ctx.save();
    ctx.translate(cx0 + 100 * cs, oy + (1 - squash) * R);
    ctx.scale(1 / squash, squash);
    drawOrangeFruit(ctx, 0, 0, R, 0.15, true);
    ctx.restore();
  }
  // title: per-letter pop-in with a gentle wave afterwards
  const fontSize = o.size || 108;
  ctx.font = `400 ${fontSize}px Shrikhand`;
  let total = ctx.measureText(title).width;
  let fs = fontSize;
  if (total > 1100) { fs = (fontSize * 1100) / total; ctx.font = `400 ${fs}px Shrikhand`; total = ctx.measureText(title).width; }
  const baseY = 214;
  const chars = [...title];
  let acc = 0;
  const pos = chars.map((ch) => {
    const w = ctx.measureText(ch).width;
    const before = ctx.measureText(title.slice(0, acc)).width;
    acc += ch.length;
    return { ch, x: 640 - total / 2 + before, w };
  });
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  const depth = Math.max(4, fs * 0.07);
  pos.forEach((p, i) => {
    if (p.ch === ' ') return;
    const k = clamp((t - 0.35 - i * 0.055) / 0.5);
    if (k <= 0) return;
    const sc = ease.outBack(k, 2.2);
    const wave = Math.sin(t * 2.2 - i * 0.45) * 3 * smoothstep(1.5, 2.5, t);
    ctx.save();
    ctx.translate(p.x + p.w / 2, baseY + wave - (1 - k) * 30);
    ctx.scale(sc, sc);
    ctx.rotate((1 - k) * -0.3);
    ctx.globalAlpha = clamp(k * 3);
    // extruded 3D shadow
    for (let d = depth; d >= 1; d -= 1) {
      ctx.fillStyle = d === depth ? '#14081C' : mix('#7A2A5A', '#C2406A', 1 - d / depth);
      ctx.fillText(p.ch, -p.w / 2 + d * 0.7, d);
    }
    ctx.strokeStyle = '#2A0F33';
    ctx.lineWidth = fs * 0.075;
    ctx.strokeText(p.ch, -p.w / 2, 0);
    ctx.fillStyle = groovyTitleFill(ctx, -fs * 0.78, fs * 0.05);
    ctx.fillText(p.ch, -p.w / 2, 0);
    // glossy highlight stripe
    ctx.save();
    ctx.beginPath();
    ctx.rect(-p.w, -fs * 0.62, p.w * 2, fs * 0.09);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,240,0.55)';
    ctx.fillText(p.ch, -p.w / 2, 0);
    ctx.restore();
    ctx.restore();
  });
  // subtitle
  const ks = clamp((t - 2.0) / 0.7);
  if (ks > 0 && sub) {
    ctx.save();
    ctx.globalAlpha = ease.outCubic(ks);
    ctx.font = '600 34px Fredoka';
    ctx.fillStyle = '#FCE9C6';
    const w = spacedText(ctx, sub, 640, 646 + (1 - ease.outCubic(ks)) * 16, 12);
    // little flanking stars
    for (const sgn of [-1, 1]) {
      const sx = 640 + sgn * (w / 2 + 34), syy = 634;
      ctx.save();
      ctx.translate(sx, syy);
      ctx.rotate(t * 0.8 * sgn);
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const r = k % 2 ? 3 : 10, ang = (k / 8) * TAU;
        if (k === 0) ctx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r); else ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
      }
      ctx.closePath();
      ctx.fillStyle = '#FFC85A';
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
  // fades go to black
  if (a < 1) {
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${1 - a})`;
    ctx.fillRect(-600, -600, 2480, 1920);
    ctx.restore();
  }
}
function drawTitleCard(ctx, t = 0, o = {}) {
  const a = cardAlpha(t, o);
  ctx.save();
  if ((o.style || 'woody') === 'groovy') groovyCard(ctx, t, o, a);
  else woodyCard(ctx, t, o, a);
  ctx.restore();
}

// ════════════════════════════════════════════════════════════ CAPTIONS
function plankCaption(ctx, t, o) {
  const text = o.text || 'THREE WEEKS LATER';
  const inT = o.inT || 0, outT = o.outT == null ? Infinity : o.outT;
  const k = t - inT, ko = t - outT;
  const x = o.x == null ? 640 : o.x, yT = o.y == null ? 112 : o.y, s = o.scale || 1;
  // spring drop + exit yank
  const drop = -260 * Math.exp(-5.5 * k) * Math.cos(9 * k);
  const exit = ko > 0 ? -320 * ease.inBack(clamp(ko / 0.55)) : 0;
  const swing = 0.11 * Math.exp(-2.6 * k) * Math.sin(7.5 * k + 0.4) + 0.012 * Math.sin(t * 1.4);
  ctx.save();
  ctx.translate(x, yT + (drop + exit) * s);
  ctx.scale(s, s);
  ctx.font = '700 40px Fredoka';
  ctx.letterSpacing = '4px';
  const tw = ctx.measureText(text).width - 4;
  ctx.letterSpacing = '0px';
  const W = tw + 92, H = 74;
  // ropes (from far above, pivot at the top)
  ctx.save();
  ctx.translate(0, -400);
  ctx.rotate(swing);
  ctx.translate(0, 400);
  for (const sgn of [-1, 1]) {
    const ax = sgn * W * 0.34;
    ctx.strokeStyle = '#8A6E44';
    ctx.lineWidth = 5;
    line(ctx, ax, -500, ax, -H / 2 + 8);
    ctx.stroke();
    ctx.strokeStyle = '#E3CBA0';
    ctx.lineWidth = 3;
    line(ctx, ax, -500, ax, -H / 2 + 8);
    ctx.stroke();
    ctx.strokeStyle = rgba('#8A6E44', 0.8);
    ctx.lineWidth = 1.2;
    for (let yy = -H / 2 - 6; yy > -400; yy -= 9) { line(ctx, ax - 2.5, yy, ax + 2.5, yy - 4); ctx.stroke(); }
  }
  // a little leaf on the left rope
  leafPath(ctx, -W * 0.34, -H / 2 - 26, 22, 7, -2.6, 0.2);
  ctx.fillStyle = '#5FAF6A';
  ctx.fill();
  ctx.strokeStyle = '#2F6B45';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // shadow
  roundRect(ctx, -W / 2 + 4, -H / 2 + 8, W, H, 14);
  ctx.fillStyle = 'rgba(30,12,4,0.35)';
  ctx.fill();
  // plank (with visible thickness underneath)
  const plankPath = (dy) => {
    ctx.beginPath();
    ctx.moveTo(-W / 2 + 12, -H / 2 + dy);
    ctx.lineTo(W / 2 - 16, -H / 2 + 1 + dy);
    ctx.quadraticCurveTo(W / 2, -H / 2 + 2 + dy, W / 2 - 1, -H / 2 + 14 + dy);
    ctx.lineTo(W / 2 + 2, H / 2 - 12 + dy);
    ctx.quadraticCurveTo(W / 2 + 1, H / 2 + dy, W / 2 - 14, H / 2 - 1 + dy);
    ctx.lineTo(-W / 2 + 10, H / 2 + dy);
    ctx.quadraticCurveTo(-W / 2 - 1, H / 2 - 1 + dy, -W / 2, H / 2 - 12 + dy);
    ctx.lineTo(-W / 2 + 2, -H / 2 + 12 + dy);
    ctx.quadraticCurveTo(-W / 2 + 1, -H / 2 + 1 + dy, -W / 2 + 12, -H / 2 + dy);
    ctx.closePath();
  };
  plankPath(7);
  ctx.fillStyle = '#6E3E1E';
  ctx.fill();
  ctx.strokeStyle = '#4A2410';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-W / 2 + 12, -H / 2);
  ctx.lineTo(W / 2 - 16, -H / 2 + 1);
  ctx.quadraticCurveTo(W / 2, -H / 2 + 2, W / 2 - 1, -H / 2 + 14);
  ctx.lineTo(W / 2 + 2, H / 2 - 12);
  ctx.quadraticCurveTo(W / 2 + 1, H / 2, W / 2 - 14, H / 2 - 1);
  ctx.lineTo(-W / 2 + 10, H / 2);
  ctx.quadraticCurveTo(-W / 2 - 1, H / 2 - 1, -W / 2, H / 2 - 12);
  ctx.lineTo(-W / 2 + 2, -H / 2 + 12);
  ctx.quadraticCurveTo(-W / 2 + 1, -H / 2 + 1, -W / 2 + 12, -H / 2);
  ctx.closePath();
  ctx.fillStyle = lg(ctx, 0, -H / 2, 0, H / 2, [[0, '#D9A066'], [0.5, '#BE8148'], [1, '#9A6232']]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // grain
  const R = rng(8);
  for (let i = 0; i < 7; i++) {
    const yy = -H / 2 + 8 + i * 10 + R.range(-2, 2);
    ctx.beginPath();
    ctx.moveTo(-W / 2, yy);
    for (let xx = -W / 2; xx <= W / 2; xx += W / 8) ctx.lineTo(xx, yy + Math.sin(xx * 0.03 + i) * 2.5);
    ctx.strokeStyle = rgba('#7A4526', 0.3);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  // knot
  ellipse(ctx, W * 0.36, H * 0.18, 9, 4);
  ctx.strokeStyle = rgba('#7A4526', 0.5);
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ellipse(ctx, W * 0.36, H * 0.18, 4, 1.8);
  ctx.fillStyle = rgba('#6A3A1E', 0.6);
  ctx.fill();
  // top highlight
  ctx.fillStyle = 'rgba(255,230,180,0.35)';
  ctx.fillRect(-W / 2, -H / 2, W, 4);
  ctx.restore();
  ctx.strokeStyle = '#5A3018';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // nails
  for (const sgn of [-1, 1]) {
    circle(ctx, sgn * W * 0.34, -H / 2 + 12, 4);
    fillStroke(ctx, '#9AA0A6', '#4A4E52', 1.2);
    circle(ctx, sgn * W * 0.34 - 1.2, -H / 2 + 10.8, 1.3);
    ctx.fillStyle = '#E6EAEE';
    ctx.fill();
  }
  // burned-in lettering
  ctx.font = '700 40px Fredoka';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,226,170,0.55)';
  spacedText(ctx, text, 0, 8 + 1.5, 4);
  ctx.fillStyle = '#4A2410';
  spacedText(ctx, text, 0, 8, 4);
  ctx.restore();
  ctx.restore();
}
function bannerCaption(ctx, t, o) {
  const text = o.text || 'THREE WEEKS LATER';
  const inT = o.inT || 0, outT = o.outT == null ? Infinity : o.outT;
  const k = t - inT, ko = t - outT;
  const x = o.x == null ? 640 : o.x, y = o.y == null ? 110 : o.y, s = o.scale || 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.font = '400 38px Shrikhand';
  ctx.letterSpacing = '2px';
  const tw = ctx.measureText(text).width - 2;
  ctx.letterSpacing = '0px';
  const W = tw + 110, H = 76;
  // stripes sweep across (left → right), exit continues to the right
  const cols = ['#5A2A1E', '#C9572E', '#E2803A', '#F2B544'];
  cols.forEach((c, i) => {
    const d = i * 0.06;
    const a0 = ease.inOutCubic(clamp((k - d) / 0.55)), b0 = ko > 0 ? ease.inOutCubic(clamp((ko - d * 0.5) / 0.5)) : 0;
    const xa = -1300 + b0 * 2600, xb = -1300 + a0 * 2600;
    if (xb <= xa) return;
    const yy = -H / 2 + 2 + i * 18 - 6;
    ctx.fillStyle = c;
    ctx.fillRect(xa, yy, xb - xa, 15);
  });
  // pill
  const pk = clamp((k - 0.35) / 0.45), po = ko > 0 ? clamp(ko / 0.3) : 0;
  if (pk > 0 && po < 1) {
    const sc = ease.outBack(pk, 2.4) * (1 - ease.inBack(po));
    const wob = Math.sin(t * 2.4) * 0.012;
    ctx.save();
    ctx.rotate(-0.03 + wob);
    ctx.scale(sc, sc);
    roundRect(ctx, -W / 2 + 5, -H / 2 + 7, W, H, H / 2);
    ctx.fillStyle = 'rgba(20,8,20,0.4)';
    ctx.fill();
    roundRect(ctx, -W / 2, -H / 2, W, H, H / 2);
    ctx.fillStyle = '#4A2050';
    ctx.fill();
    roundRect(ctx, -W / 2 + 6, -H / 2 + 6, W - 12, H - 12, (H - 12) / 2);
    ctx.fillStyle = lg(ctx, 0, -H / 2, 0, H / 2, [[0, '#FFF3DA'], [1, '#F6D9A8']]);
    ctx.fill();
    // little sparkles on the ends
    for (const sgn of [-1, 1]) {
      const sx = sgn * (W / 2 - 28), sy = 0;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(t * 1.5 * sgn);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 ? 2.6 : 9, a = (i / 8) * TAU;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fillStyle = '#E2803A';
      ctx.fill();
      ctx.restore();
    }
    ctx.font = '400 38px Shrikhand';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#E2803A';
    spacedText(ctx, text, 2, 6, 2);
    ctx.fillStyle = '#4A2050';
    spacedText(ctx, text, 0, 4, 2);
    ctx.restore();
  }
  ctx.restore();
}
function drawCaption(ctx, t = 0, o = {}) {
  const inT = o.inT || 0, outT = o.outT == null ? Infinity : o.outT;
  if (t < inT || t > outT + 0.75) return;
  ctx.save();
  if ((o.style || 'plank') === 'banner') bannerCaption(ctx, t, o);
  else plankCaption(ctx, t, o);
  ctx.restore();
}

// ════════════════════════════════════════════════════════════ LAB
function placeholderCapy(ctx, x, y, flip, label, col) {
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.fillStyle = rgba(col, 0.55);
  ctx.strokeStyle = rgba('#FFFFFF', 0.85);
  ctx.lineWidth = 2;
  ellipse(ctx, -10, 10, 100, 46);
  ctx.fill(); ctx.stroke();
  roundRect(ctx, 50, -40, 72, 58, 18);
  ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = '700 14px Fredoka';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y - 66);
  circle(ctx, x, y, 4);
  ctx.fill();
  ctx.restore();
}
function placeholderTortoise(ctx, x, y0, label) {
  // origin = seat point (bottom of the shell), like critters.drawTortoise
  const y = y0 - 72;
  ctx.save();
  ctx.fillStyle = rgba('#7A8A4A', 0.6);
  ctx.strokeStyle = rgba('#FFFFFF', 0.85);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x + 10, y + 10, 62, 70, 0.15, 0, TAU);
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 40, y - 20);
  ctx.quadraticCurveTo(x - 80, y - 60, x - 100, y - 54);
  ctx.lineWidth = 16;
  ctx.strokeStyle = rgba('#9AA88A', 0.7);
  ctx.stroke();
  ellipse(ctx, x - 112, y - 58, 22, 16);
  ctx.fillStyle = rgba('#9AA88A', 0.75);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '700 14px Fredoka';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y - 90);
  circle(ctx, x, y0, 4);
  ctx.fill();
  ctx.restore();
}
function labPanel(ctx, px, py, pw, ph, label, fn) {
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(pw / 1280, ph / 720);
  ctx.beginPath();
  ctx.rect(0, 0, 1280, 720);
  ctx.clip();
  fn();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(px, py, pw, 24);
  ctx.fillStyle = '#fff';
  ctx.font = '700 15px Fredoka';
  ctx.fillText(label, px + 8, py + 17);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, pw, ph);
  ctx.restore();
}
// stand-in background for caption tests (sunny sky + hills)
function drawNewSpringStub(ctx) {
  ctx.fillStyle = lg(ctx, 0, 0, 0, 720, [[0, '#8ED1F0'], [1, '#FDEBC8']]);
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = '#8CCB7A';
  ellipse(ctx, 300, 760, 700, 300);
  ctx.fill();
  ctx.fillStyle = '#5FAF6A';
  ellipse(ctx, 1000, 800, 700, 320);
  ctx.fill();
}
// stand-in reed raft for lab sheets (the real one lives in props.js)
function labRaft(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 1.2) * 1.5);
  ctx.rotate(Math.sin(t * 0.9) * 0.012);
  for (let i = 0; i < 3; i++) {
    roundRect(ctx, -165, -26 + i * 9, 330, 16, 8);
    ctx.fillStyle = ['#C9A25E', '#B58C4A', '#9E763A'][i];
    ctx.fill();
    ctx.strokeStyle = '#5A4020';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  for (const lx of [-120, -40, 40, 120]) { ctx.fillStyle = '#6E4E24'; ctx.fillRect(lx - 3, -28, 6, 32); }
  ctx.strokeStyle = '#5A4020';
  ctx.lineWidth = 4;
  line(ctx, 130, -24, 130, -190);
  ctx.stroke();
  poly(ctx, [[132, -188], [232, -170], [132, -146]]);
  ctx.fillStyle = '#F4E6CC';
  ctx.fill();
  ctx.fillStyle = '#B5413E';
  ctx.font = '700 9px Fredoka';
  ctx.textAlign = 'left';
  ctx.fillText('S.S. TOLD', 136, -170);
  ctx.fillText('YOU SO', 136, -158);
  ctx.restore();
}
function tryChars() {
  try { return require('./characters'); } catch (e) { return null; }
}

const lab = {
  office(ctx, t) {
    drawTherapyOffice(ctx, t, { hourglass: 0.6 });
    drawTherapyOfficeFront(ctx, t, {});
  },
  office_cast(ctx, t) {
    drawTherapyOffice(ctx, t, {});
    placeholderCapy(ctx, OFFICE.couch.x, OFFICE.couch.y, false, 'couch (Barry, lie)', '#9A6A45');
    placeholderTortoise(ctx, OFFICE.chair.x, OFFICE.chair.y, 'chair (Shelley)');
    drawTherapyOfficeFront(ctx, t, {});
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.font = '700 13px Fredoka';
    for (const k of ['window', 'diploma', 'candle', 'lamp', 'table', 'oranges', 'hourglass', 'alcove', 'fern']) {
      const p = OFFICE[k];
      circle(ctx, p.x, p.y, 4);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeText(k, p.x + 7, p.y - 6);
      ctx.fillText(k, p.x + 7, p.y - 6);
    }
    ctx.restore();
  },
  office_framings(ctx, t) {
    const shots = [
      ['barry_couch: zoom 2 on couch', { x: 400, y: 470, zoom: 2 }],
      ['shelley_cu: zoom 2 on chair', { x: 930, y: 420, zoom: 2 }],
      ['office_wide: zoom 0.9', { x: 640, y: 360, zoom: 0.9 }],
      ['window: zoom 2.6', { x: 930, y: 300, zoom: 2.6 }],
    ];
    shots.forEach(([label, cam], i) => {
      labPanel(ctx, (i % 2) * 640, Math.floor(i / 2) * 360, 640, 360, label, () => {
        withCamera(ctx, cam, () => {
          drawTherapyOffice(ctx, t, { puff: i === 3 ? 0.4 : 0, volcanoSmoke: 0.5, hourglass: 0.3 });
          placeholderCapy(ctx, OFFICE.couch.x, OFFICE.couch.y, false, 'Barry', '#9A6A45');
          placeholderTortoise(ctx, OFFICE.chair.x, OFFICE.chair.y, 'Shelley');
          drawTherapyOfficeFront(ctx, t, {});
        });
      });
    });
  },
  river(ctx, t) {
    drawRiverSunset(ctx, t, { ash: 0.5 });
    // placeholder raft at the anchor
    const r = RIVER.raftPos;
    ctx.save();
    roundRect(ctx, r.x - 165, r.y - 22, 330, 30, 8);
    ctx.fillStyle = rgba('#9A6A45', 0.8);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    drawRiverFront(ctx, t, { ash: 0.5 });
  },
  river_framings(ctx, t) {
    const shots = [
      ['raft_wide: zoom 1', { x: 640, y: 360, zoom: 1 }],
      ['barry_cu: zoom 2 on raft', { x: 600, y: 440, zoom: 2 }],
      ['wide: zoom 0.9', { x: 640, y: 360, zoom: 0.9 }],
      ['volcano: zoom 2.5', { x: 360, y: 290, zoom: 2.5 }],
    ];
    shots.forEach(([label, cam], i) => {
      labPanel(ctx, (i % 2) * 640, Math.floor(i / 2) * 360, 640, 360, label, () => {
        withCamera(ctx, cam, () => {
          drawRiverSunset(ctx, t, { ash: 0.5 });
          const r = RIVER.raftPos;
          roundRect(ctx, r.x - 165, r.y - 22, 330, 30, 8);
          ctx.fillStyle = rgba('#9A6A45', 0.85);
          ctx.fill();
          drawRiverFront(ctx, t, { ash: 0.5 });
        });
      });
    });
  },
  river_live(ctx, t) {
    const C = tryChars();
    let P = null;
    try { P = require('./props'); } catch (e) { /* sibling WIP */ }
    const r = RIVER.raftPos;
    const deck = r.y - 16;
    const cast = (c) => {
      if (P && P.drawRaft) P.drawRaft(c, { x: r.x, y: r.y, t, flagText: 'S.S. TOLD YOU SO' });
      else labRaft(c, r.x, r.y, t);
      if (C && C.drawCapybara) {
        try {
          C.drawCapybara(c, { who: 'doreen', x: r.x - 105, y: deck - 52, pose: 'sit', t, mood: 'sad', scale: 0.82 });
          C.drawCapybara(c, { who: 'barry', x: r.x + 10, y: deck - 50, pose: 'stand', t, mood: 'smug', scale: 0.82, accessories: { helmet: true } });
          C.drawCapybara(c, { who: 'sunny', x: r.x + 120, y: deck - 54, pose: 'sit', t, mood: 'sad', scale: 0.86, flip: true });
        } catch (e) { /* sibling WIP */ }
      }
    };
    drawRiverSunset(ctx, t, { ash: 0.4 });
    drawRiverReflection(ctx, t, { y: r.y + 4, x0: r.x - 300, x1: r.x + 300, depth: 140 }, cast);
    cast(ctx);
    drawRiverFront(ctx, t, { ash: 0.4, grade: 1 });
  },
  titles(ctx, t) {
    labPanel(ctx, 0, 0, 640, 360, 'woody: CHILL CAPYBARA', () => drawTitleCard(ctx, t, { style: 'woody' }));
    labPanel(ctx, 640, 0, 640, 360, 'woody: credit card (2 lines)', () => drawTitleCard(ctx, t, { style: 'woody', lines: [{ text: 'with', size: 30 }, { text: 'MOUNT SNOOZE', size: 56 }, { text: 'as itself (dormant)', size: 30 }] }));
    labPanel(ctx, 0, 360, 640, 360, 'groovy t=1.0', () => drawTitleCard(ctx, 1.0, { style: 'groovy' }));
    labPanel(ctx, 640, 360, 640, 360, 'groovy t=4 (settled)', () => drawTitleCard(ctx, 4 + t, { style: 'groovy' }));
  },
  titles_groovy(ctx, t) {
    drawTitleCard(ctx, t, { style: 'groovy', dur: 8, fadeOut: 1 });
  },
  caption(ctx, t) {
    drawNewSpringStub(ctx);
    drawCaption(ctx, t, { style: 'plank', text: 'THREE WEEKS LATER', inT: 0, outT: 3 });
    drawCaption(ctx, t, { style: 'banner', text: 'THREE WEEKS LATER', inT: 0, outT: 3, y: 560 });
  },
  office_live(ctx, t) {
    const C = tryChars();
    drawTherapyOffice(ctx, t, { hourglass: 0.5 });
    if (C && C.drawCapybara) {
      try { C.drawCapybara(ctx, { who: 'barry', x: OFFICE.couch.x, y: OFFICE.couch.y, pose: 'lie', t, mood: 'worried' }); } catch (e) { /* sibling WIP */ }
    } else placeholderCapy(ctx, OFFICE.couch.x, OFFICE.couch.y, false, 'Barry', '#9A6A45');
    if (C && C.drawTortoise) {
      try { C.drawTortoise(ctx, { x: OFFICE.chair.x, y: OFFICE.chair.y, flip: true, t, write: 0.3 }); } catch (e) { /* sibling WIP */ }
    } else placeholderTortoise(ctx, OFFICE.chair.x, OFFICE.chair.y, 'Shelley');
    drawTherapyOfficeFront(ctx, t, {});
  },
};

module.exports = {
  _envOtherPrivate: {
    drawCached, officeStatic, officeWindowView, officeTable, officeDust,
    riverSky, riverSun, riverVolcano, riverFar, waterBase, riverBankReflections, waterDetail, riverBanks, riverBirds, riverLilies, raftShadow, riverAsh, riverForeground,
    bankFill, palm, CROWNS, leftEdge, rightEdge, edgeClip,
  },
  drawTherapyOffice, drawTherapyOfficeFront, OFFICE,
  drawRiverSunset, drawRiverFront, drawRiverReflection, RIVER,
  drawTitleCard, drawCaption,
  lab,
};
