// CHILL CAPYBARA — environments: therapy office, river sunset, title cards, captions.
// See DESIGN.md §5. Everything is drawn in 1280x720 design/world units, is a pure function of
// its inputs (time included), never uses Math.random, and restores all ctx state it touches.
// Environments extend ≥300 units past every frame edge (camera zoom ≥ 0.75 shows no void).
// Every public entry point sanitises its inputs: t / numeric options that are NaN, ±Infinity,
// strings… fall back to their defaults, a null/non-object `o` means {}, and a non-finite camera
// transform draws nothing (a NaN reaching Skia would abort the process with a Rust panic).
//
// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────
// drawTherapyOffice(ctx, t, o)       Dr. Shelley's office inside a giant hollow log: one-point
//                                    perspective log tunnel with carved rib arches, growth-ring
//                                    back wall, round window (jungle + Mount Snooze beyond — the
//                                    same silhouette as env_spring's — swaying leaves, light beam +
//                                    dust motes), framed diploma 'Swamp University — PhD in
//                                    Feelings', a volcano-shaped Rorschach inkblot, alcove bookshelf,
//                                    hanging pothos, potted fern, a LIT standing lamp (glowing
//                                    shade, warm halo + up/down light cones on the wall, a floor pool
//                                    that catches the rug's edge, warm wash on the wingback), 70s
//                                    rug, teal log-couch (LEFT), oxblood wingback (RIGHT), side table
//                                    with the 'Serenity' candle (lit) and the fee bowl of oranges.
//   o.volcanoSmoke 0..1 (0.35)  smoke from Mount Snooze in the window: 0.35 = a thin dark wisp that
//                               reads at zoom 1; ≥0.6 a thicker column + crater glow; 0 = none
//   o.puff 0..1         (0)     beat 'window_puff' progress (the kit runs it from window_puff to
//                               60 % into shelley_turns): two quick little "pff"s, then a big dark
//                               three-tier billow fills the upper-right pane (crater glow under
//                               it), lingers, and from 0.62 is blown up-and-right OUT of the pane
//                               (it slides behind the frame while thinning) — gone by ≈0.95. Its tail
//                               (0.8 → 0.97) also stops the ambient wisp, so at puff ≥ 0.97 the
//                               window shows a CLEAR BLUE SKY (+ two small white clouds). Keep puff
//                               at 1 for the rest of s05 (the kit does) and the sky stays clear.
//   o.clear 0..1        (0)     NEW: explicit override that suppresses the volcano wisp + glow
//                               (1 = clear sky whatever volcanoSmoke says)
//   o.candle   bool     (true)  candle flame + glow
//   o.hourglass 0..1 | null     null/undefined → no hourglass; a number shows a small hourglass
//                               on the side table, value = fraction of sand fallen (1 = time's up)
//   o.oranges  int      (6)     oranges in the fee bowl (0..6)
//   o.dust     bool     (true)  dust motes floating in the window light beam
//   o.cache    bool     (true)  static room (incl. the view through the window) is cached (see
//                               PERFORMANCE). false = draw everything directly (≈100 ms/frame).
// drawTherapyOfficeFront(ctx, t, o)  draw AFTER the characters: the couch cushion's front face
//                                    (sinks Barry's belly into the cushion), the wingback's near arm
//                                    (hides Shelley's lower shell / legs) and a soft daylight pool
//                                    from the window on Shelley's head.
//   o.shelleyLight 0..2 (1)     strength of that window light (0 = off)
// OFFICE                              anchors (world units):
//   couch {x:368,y:486}  origin for Barry, drawCapybara({pose:'lie', scale:1}) facing RIGHT; the
//                        raised head-end has NO pillow, so the space in front of his snout is clear
//                        for the direct-address close-up; cushion top = OFFICE.couchSeatY (540)
//   chair {x:978,y:532}  tortoise SEAT origin: drawTortoise({x,y, flip:true, scale:1}) faces LEFT
//                        towards Barry; everything below OFFICE.armTopY (506) is hidden by the arm
//   window {x:905,y:217,r:80}  glass centre/radius (CHANGED: was {905,196,90} — smaller and lower so
//                        one frame holds the whole porthole AND Shelley's head). Carved frame ring
//                        out to OFFICE.windowOuterR (≈98): frame top ≈119, bottom ≈315, ≈13 units
//                        clear of Shelley's head top (≈328; OFFICE.shelleyHead {935,354}). The view is
//                        scaled with the window, so the composition inside is unchanged: transom set
//                        high, OFFICE.crater {938,233} (CHANGED) = Mount Snooze's crater in the
//                        lower-right pane, its smoke rises into the clear upper-right pane.
//   diploma {x,y,w,h}, candle {x,y} (flame base), lamp {x,y} (shade bottom centre),
//   table {x,y} (top centre), oranges {x,y} (top of pile), hourglass {x,y} (base),
//   alcove {x,y}, fern {x,y} (pot rim), floorY (back floor edge), vp {x,y}, backR
//   OFFICE.framings (withCamera objects): office_wide {640,360,z1} (z0.9 also clean),
//     barry_couch {400,470,z2}, shelley_cu {935,400,z2}, window {914,268,z2.0} (CHANGED: the whole
//     porthole + Shelley's head and neck swivel). The kit's own window framing {912,286,z2.05}
//     (+push 0.004) also holds both: frame top ≥ 6 units inside the frame for the whole beat.
//
// drawRiverSunset(ctx, t, o)        aftermath: wide calm river at sunset (#FF9E5E → #5B3A7A sky),
//                                    low sun + shimmering reflection column, layered silhouetted
//                                    jungle banks with broken-up mirrored reflections, a TINY distant
//                                    Mount Snooze (env_spring's silhouette, dusk-tinted and hazed
//                                    toward the sky, ≈105 wide above the far treeline, crater at
//                                    RIVER.volcano, cooled lava tongue, faint red crater glow) LEFT of
//                                    the raft: its smoke rises ≈80 units nearly straight, then bends
//                                    up-LEFT into a soft drifting plume (away from cast, mast, flag and
//                                    sun). Lit stratus lenses, first stars, birds, lily pads,
//                                    ash/embers, ripples drifting with the current. Nothing with x
//                                    in 440…860 stands above the horizon except the low far hills /
//                                    scrub line (that band is behind the raft's cast in every shot).
//   o.ash 0..1        (0.35)  drifting ash flakes + glowing embers
//   o.smoke 0..1      (1)     Mount Snooze smoke column (0 = none)
//   o.glow 0..1       (1)     Mount Snooze crater glow
//   o.volcano {x,y}           NEW, optional per-shot CHEAT of the crater position (default
//                             RIVER.volcano; x clamped 120…1180, y 300…372, rounded). Keep it FIXED
//                             within a shot (it is part of the cached background, like o.sun) — e.g.
//                             {x: 598, y: 352} tucks it right behind Barry's shoulder in a tight CU.
//   o.sun {x,y} | o.sunX / o.sunY   sun position (default RIVER.sun {955,350}: clear of the cast;
//                             e.g. {x:645,y:356} puts it right behind Barry for 'Am I chill?').
//                             x is clamped to the river opening 600…1040. The sky glow is part of the
//                             cached background, so keep it fixed within a shot (changing it per
//                             frame re-renders the background every frame).
//   o.sunset 0..1     (0)     0 = sun resting on the horizon; 1 = sunk ~38 units, tucked behind the
//                             far hills (may be animated freely)
//   o.flow            (1)     ripple drift speed multiplier
//   o.birds           (true)  three tiny distant birds (high in the sky, clear of Gerald's perch)
//   o.raft            (true)  soft raft shadow + back halves of the wake rings at the raft position
//   o.raftX/raftY/raftW       raft waterline centre / width (default RIVER.raftPos, 330)
//   o.cache           (true)  static background cache (false = draw directly)
// drawRiverFront(ctx, t, o)         draw AFTER the raft + cast: a THIN lapping strip just under the
//                                    waterline (≈15 units, feathered down and at both ends) that
//                                    hides the raft's submerged edge without hiding its reflection,
//                                    waterline glints + foam, front halves of the wake rings, near
//                                    ash, foreground reeds + cattails and a drooping palm frond.
//   o.raftX (640) o.raftY (520) o.raftW (330)  raft waterline centre / width (move with the raft;
//                 raftW 0 = no strip/wake)
//   o.foreground (true)  foreground silhouettes;  o.wake (true)  wake rings + foam
//   o.ash (0.35)  same as above;  o.grade 0..1 (0)  sunset colour grade over the whole frame (one
//                 cached multiply: warm near the sun, lilac away from it) — sits daylight-coloured
//                 characters into the sunset; ≈3 ms at 1080p.
// drawRiverReflection(ctx, t, o, fn) mirror-draws fn(ctx2) (e.g. the raft + cast) into the water as
//                                    a rippled, fading reflection. fn is called ONCE into a scratch
//                                    canvas with the same transform, then blitted in whole-pixel
//                                    strips (3–4 device px, so close-ups stay smooth), each offset by
//                                    a smooth function of depth (gentler in close-ups) and faded
//                                    continuously — strongest right under the waterline.
//   o.y (RIVER.raftPos.y)  waterline / mirror axis;  o.x0, o.x1  horizontal extent (world units)
//   o.depth (150)  how far below the waterline it reaches;  o.alpha (0.45)
//   o.drawSource (false)  NEW: ALSO composite fn's own un-mirrored drawing at 1:1 afterwards, so the
//                 caller does NOT call fn a second time. Recommended pipeline:
//                   drawRiverSunset → drawRiverReflection(…, {…, drawSource:true}, raftAndCast)
//                   → drawRiverFront
//                 Pixel-equivalent to drawing fn directly (same device transform, integer blit;
//                 fn must use source-over drawing only — the characters/props do) and it halves
//                 the cost of the raft + cast in every raft shot (they were rendered twice).
//   (assumes the camera is not rotated by more than shake-level amounts)
// riverFrameVolcano(cam, keep, margin = 14, volcano)  NEW, pure: returns a copy of camera
//   {x,y,zoom,...} shifted as little as possible (zoomed out only if it cannot fit) so that the
//   smoking volcano box (RIVER.volcanoBox, or the box of a cheated `volcano` {x,y}) plus every
//   {x0,y0,x1,y1} in `keep` (e.g. Barry's head) is in frame with `margin` units to spare.
// RIVER                               anchors: raftPos {640,520} (raft waterline centre),
//   waterY 392 (= horizonY, far water edge; water spans waterY → bottom), sun {x:955,y:350,r:46},
//   volcano {x:404,y:338} (crater; CHANGED: was 450,280 — smaller, lower, left of the cast and
//   clear of the kit's gerald_flag frame), volcanoTop {x:391,y:262} (NEW: top of the readable smoke
//   column, ≈76 above the crater), volcanoBox {x0:348,y0:252,x1:462,y1:380} (NEW: cone above the treeline + readable smoke — a
//   close-up that contains it reads as "tiny Mount Snooze, still smoking"), banks {left,right}.
//   The cast sits on the raft at scale ≈0.55–0.6 (the kit's layout). RIVER.framings:
//   raft_wide {640,360,z1}, barry_cu {572,372,z2.35} (CHANGED: Barry + the smoking volcano over his
//   shoulder), gerald_flag {680,300,z2.4}, fish {640,540,z2}, volcano {398,312,z2.6} (CHANGED).
//   RIVER.volcanoCU {barryFacingRight, barryFacingLeft}: {volcano, cam} close-up cheats (NEW) — pass
//   .volcano as o.volcano for that shot and frame with .cam: tiny Mount Snooze right behind
//   Barry's shoulder, smoke rising out of frame (lab sheet river_kit, bottom-right).
//   NOTE for the kit: a scale-normalised Barry CU at zoom ≈4 with his eye at screen y≈335 only
//   shows world y ≥ ≈340, i.e. ≤50 units of sky above the horizon — no background element can
//   appear "over his shoulder" there. Use RIVER.volcanoCU (eye at screen y≈430, zoom 3.3 + the
//   o.volcano cheat), RIVER.framings.barry_cu (wider, default volcano) or riverFrameVolcano.
//
// drawTitleCard(ctx, t, o)          full-frame title card; t = seconds since the card began.
//   o.style  'woody' (default) | 'groovy'
//   o.lines  strings or {text, size, font, color, spacing, gap, at, fade, wrap}
//            woody: white serif (Yeseva) on pure black, centred, no animation except fades. All-caps
//                   lines are tracked (0.14em); mixed / lower-case lines are set solid (0.01em).
//                   Long lines wrap with balanced breaks at o.wrap (980) / line.wrap (a break after
//                   . , ; : is preferred; '\n' forces one). lines[0] uses o.size (74), later lines
//                   default to max(40, 0.55·size). line.at (s) + line.fade (0.5) reveal a line later
//                   on the same card without moving the others (s10: 'CHILL CAPYBARA', then
//                   {text:'THE END', at:0.9}). A missing/null text renders as ''. o.bg (#000) colour,
//                   or o.bg:false = no background, so cards can be layered. Default ['CHILL CAPYBARA'].
//                   The exact s02/s10 cards are rendered in lab sheet 'titles_script'.
//            groovy: end-title treatment — lines[0] = title (default 'Chill Capybara', Shrikhand,
//                   sunset gradient + extruded shadow, letters pop in one by one then gently wave),
//                   lines[1] (or o.sub) = subtitle (default 'THE END', fades up at t≈2.3). A striped
//                   70s sun rises, a capybara silhouette surfaces and an orange arcs in from off-frame
//                   right — always below the title — landing on its head at t=2.0 with two small
//                   bounces (≤20 units) and squash keyed to each contact.
//   o.fadeIn (0) / o.fadeOut (0) seconds; o.dur (Infinity) card length (fadeOut ends at dur)
//   o.size   title font size (woody 74, groovy 108 — auto-shrinks to fit);  o.wrap (woody, 980)
//   o.cache  (groovy, true) backdrop + finished title letters are cached bitmaps (false = direct)
// drawCaption(ctx, t, o)            animated caption overlay (e.g. 'THREE WEEKS LATER')
//   o.text ('THREE WEEKS LATER'), o.style 'plank' (wooden sign drops in on ropes with a springy
//   bounce + swing, yanked back up on exit) | 'banner' (70s stripes sweep across, a cream pill
//   pops in with sparkles; everything wipes out to the right)
//   o.inT (0) entrance start, o.outT (Infinity) exit start (same clock as t); o.x (640),
//   o.y (plank 112 / banner 110), o.scale (1). Draws nothing outside [inT, outT + 0.75].
// prewarm(which = 'all' | 'office' | 'river', outScale = 1.5)  optional: builds the static-layer
//   tiles for the OFFICE/RIVER framings up front (≈1 s for all at 1080p) so the first frame of each
//   shot doesn't pay it. outScale = output px per design unit (1.5 for 1080p).
//
// PERFORMANCE (1920x1080, flushed, measured through the kit's stages with its drift + push on —
// how scenes call it — on this shared, busy 4-core box): office ≈15–18 ms (window shot with the
// puff ≈17.5, was ≈22–27) + front ≈2–3 ms; river sunset ≈19–22 ms + front ≈3 ms (+≈3 ms grade);
// reflection ≈2 ms + one render of fn — with o.drawSource the kit's raft_wide frame drops from
// ≈109 to ≈70–84 ms because the raft + cast are no longer rendered twice; groovy title ≈14 ms
// (was ≈24). Static layers are cached three ways:
//   · grid-aligned TILES per zoom level (built once; the first frame at a new level pays one
//     static render, ≈0.1–0.5 s — see prewarm());
//   · a per-shot COMPOSITE: the tiles covering the view (snapped to a 128-unit grid) copied once
//     into one canvas, so a moving camera costs ONE filtered drawImage per frame (≈10–12 ms at
//     1080p — the floor of Skia's bilinear resampling of a full frame on this box; ≈15–20 %
//     cheaper than blitting the ~15–20 tiles, which turned out NOT to be the main cost);
//   · from the 2nd frame of a truly held shot, a full-frame snapshot at that exact transform (one
//     1:1 blit, ≈3 ms).
// The window view (live layer) is drawn into a small exact-size device-space scratch and masked
// once instead of drawing ~20 shapes through an anti-aliased even-odd clip (11.8 → ≈3–6 ms).
// Caches are pure memos keyed by constant inputs: frames are bit-identical whatever order or
// process renders them (verified: a frame rendered alone == the same frame after 29 others).
//
// lab sheets: office, office_cast (anchors), office_framings, office_window (puff sequence +
//             volcanoSmoke levels), office_live, office_kit (the REAL kit s05 window shots incl. the
//             neck swivel), river, river_framings, river_kit (the REAL kit s08 shots: kit framings
//             vs RIVER.framings.barry_cu / riverFrameVolcano), river_live (cast + reflection +
//             grade), river_reflection (solid test block at z1/z2/z3), river_sun (sun options),
//             titles, titles_script (exact s02/s10 cards), titles_groovy (use --frames), caption
//             (use --t / --frames)
'use strict';

const U = require('./util');
const {
  TAU, clamp, lerp, smoothstep, ease, rng, hash1, noise1, noise2,
  mix, shade, rgba, ellipse, circle, roundRect, blob, curve, withCamera,
} = U;

let _napi = null;
const napi = () => _napi || (_napi = require('@napi-rs/canvas'));

// ════════════════════════════════════════════════════════════════════ input hygiene
// Every public entry point normalises its inputs: a non-finite number (NaN from a 0/0 tween,
// Infinity, a string…) falls back to the default instead of reaching Skia, where a NaN
// coordinate can abort the whole process with an uncatchable Rust panic.
const fin = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const optsOf = (o) => (o && typeof o === 'object' ? o : {});
function finiteCtx(ctx) {
  if (!ctx || typeof ctx.getTransform !== 'function') return false;
  const m = ctx.getTransform();
  return Number.isFinite(m.a) && Number.isFinite(m.b) && Number.isFinite(m.c) && Number.isFinite(m.d) && Number.isFinite(m.e) && Number.isFinite(m.f) && Math.abs(m.a * m.d - m.b * m.c) > 1e-12;
}
const frac = (x) => x - Math.floor(x);

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
    ctx.fill();
  });
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

// ════════════════════════════════════════════════════════ static-layer caches
// Static layers (everything that does not move) are rasterised once and blitted. Two levels:
//  1. TILES — per (layer, pixel-scale level, tile): small canvases matching the device scale
//     (quantised upward to LEVELS). Missing tiles of a frame are rendered in ONE batch (one
//     drawFn call for their bounding box, then sliced), so the first frame at a new zoom costs
//     one static draw, not one per tile. Used for moving cameras (drift, shake, push-ins).
//  2. FRAMES — a held shot repeats the exact same transform for many frames. The 2nd time a
//     transform is seen, the layer is composed once into a full-frame canvas at that exact
//     transform; later frames are a single 1:1 blit (≈2–3 ms at 1080p instead of ≈10 ms of
//     filtered tile blits).
// Cached content is a pure function of constant inputs (layer key + pixel grid), so frames stay
// deterministic whatever order they render in.
const TILE = 256, TPAD = 3;
const T_X0 = -512, T_Y0 = -512, T_COLS = 10, T_ROWS = 8; // world x −512…2048, y −512…1536
const LEVELS = [0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1, 1.125, 1.25, 1.375, 1.5, 1.625, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 4, 4.5, 5, 6];
const _tiles = new Map();
let _tileBytes = 0;
const TILE_BUDGET = 224 * 1024 * 1024;
const _frames = new Map();           // frame key → canvas | null (seen once)
const FRAME_SLOTS = 6;               // full-frame canvases kept (≈8 MB each at 1080p)

function levelFor(s) {
  for (const l of LEVELS) if (l >= s * 0.995) return l;
  return LEVELS[LEVELS.length - 1];
}
function tileKey(key, L, c, r) { return key + '|' + L + '|' + c + '|' + r; }
function storeTile(k, cv) {
  _tiles.set(k, cv);
  _tileBytes += cv.width * cv.height * 4;
  while (_tileBytes > TILE_BUDGET && _tiles.size > 1) {
    const [fk, fv] = _tiles.entries().next().value;
    _tiles.delete(fk);
    _tileBytes -= fv.width * fv.height * 4;
  }
}
// Tiles are rendered in fixed, grid-aligned SUPER-BLOCKS (SB x SB tiles, SB chosen from the level
// so a block canvas stays ≈1.5k px): one drawFn call fills a whole block, then it is sliced. The
// block a tile belongs to never depends on what was rendered before, which keeps tiles bit-exact
// across processes/render order (Skia's AA is not translation-invariant at the bit level).
const sbFor = (L) => clamp(Math.floor(1600 / (TILE * L)), 1, 4);
function buildTiles(key, L, c0, c1, r0, r1, drawFn) {
  const SB = sbFor(L), tpx = Math.round(TILE * L);
  for (let sr = Math.floor(r0 / SB) * SB; sr <= r1; sr += SB) {
    for (let sc = Math.floor(c0 / SB) * SB; sc <= c1; sc += SB) {
      const ce = Math.min(T_COLS - 1, sc + SB - 1), re = Math.min(T_ROWS - 1, sr + SB - 1);
      let missing = false;
      for (let r = sr; r <= re && !missing; r++) for (let c = sc; c <= ce; c++) if (!_tiles.has(tileKey(key, L, c, r))) { missing = true; break; }
      if (!missing) continue;
      const bx0 = T_X0 + sc * TILE, by0 = T_Y0 + sr * TILE;
      const big = napi().createCanvas((ce - sc + 1) * tpx + 2 * TPAD, (re - sr + 1) * tpx + 2 * TPAD);
      const bc = big.getContext('2d');
      bc.setTransform(L, 0, 0, L, TPAD - bx0 * L, TPAD - by0 * L);
      drawFn(bc);
      for (let r = sr; r <= re; r++) for (let c = sc; c <= ce; c++) {
        const k = tileKey(key, L, c, r);
        if (_tiles.has(k)) continue;
        const cv = napi().createCanvas(tpx + 2 * TPAD, tpx + 2 * TPAD);
        cv.getContext('2d').drawImage(big, (c - sc) * tpx, (r - sr) * tpx, tpx + 2 * TPAD, tpx + 2 * TPAD, 0, 0, tpx + 2 * TPAD, tpx + 2 * TPAD);
        storeTile(k, cv);
      }
    }
  }
}
// level + tile block covering a canvas of cw x ch under transform m
function tileBlock(m, cw, ch) {
  const det = m.a * m.d - m.b * m.c;
  const s = Math.sqrt(Math.abs(det));
  if (!(s > 1e-6)) return null;
  const L = levelFor(s);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [px, py] of [[0, 0], [cw, 0], [0, ch], [cw, ch]]) {
    const dx = px - m.e, dy = py - m.f;
    const wx = (m.d * dx - m.c * dy) / det, wy = (-m.b * dx + m.a * dy) / det;
    x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); y0 = Math.min(y0, wy); y1 = Math.max(y1, wy);
  }
  const c0 = Math.max(0, Math.floor((x0 - T_X0) / TILE)), c1 = Math.min(T_COLS - 1, Math.floor((x1 - T_X0) / TILE));
  const r0 = Math.max(0, Math.floor((y0 - T_Y0) / TILE)), r1 = Math.min(T_ROWS - 1, Math.floor((y1 - T_Y0) / TILE));
  if (c1 < c0 || r1 < r0) return null;
  return { L, c0, c1, r0, r1 };
}
function drawTiles(ctx, key, drawFn, m, cw, ch) {
  const B = tileBlock(m, cw, ch);
  if (!B) return;
  const { L, c0, c1, r0, r1 } = B;
  buildTiles(key, L, c0, c1, r0, r1, drawFn);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const k = tileKey(key, L, c, r);
      let tile = _tiles.get(k);
      if (!tile) { buildTiles(key, L, c, c, r, r, drawFn); tile = _tiles.get(k); }
      else { _tiles.delete(k); _tiles.set(k, tile); }
      const wx = T_X0 + c * TILE - TPAD / L, wy = T_Y0 + r * TILE - TPAD / L;
      ctx.drawImage(tile, wx, wy, tile.width / L, tile.height / L);
    }
  }
  ctx.restore();
}
// 3. SHOT COMPOSITES — a moving camera (drift, push, shake) never repeats a transform, so every
//    frame used to blit ≈15–20 filtered tiles. Instead the tiles covering the view plus a drift
//    margin are copied ONCE (integer offsets at the tile level: an exact copy) into one canvas, and
//    each frame is a single filtered drawImage of it (≈15–20 % cheaper; the floor is Skia's
//    bilinear resampling of a full 1080p frame, ≈10–12 ms on this box). Its rect is snapped to a
//    coarse grid from the frame's own view, so it is rebuilt only when the view crosses a grid line
//    or the level changes, and its content is a pure function of (layer, level, rect).
const _comps = [];                   // [{key, L, x0, y0, x1, y1, cv}] most recent last
const COMP_SLOTS = 3;
function compositeFor(key, drawFn, m, cw, ch) {
  const det = m.a * m.d - m.b * m.c;
  const sc = Math.sqrt(Math.abs(det));
  if (!(sc > 1e-6)) return null;
  const L = levelFor(sc);
  let vx0 = Infinity, vy0 = Infinity, vx1 = -Infinity, vy1 = -Infinity;
  for (const [px, py] of [[0, 0], [cw, 0], [0, ch], [cw, ch]]) {
    const dx = px - m.e, dy = py - m.f;
    const wx = (m.d * dx - m.c * dy) / det, wy = (-m.b * dx + m.a * dy) / det;
    vx0 = Math.min(vx0, wx); vx1 = Math.max(vx1, wx); vy0 = Math.min(vy0, wy); vy1 = Math.max(vy1, wy);
  }
  // only the tiled world can be covered (views zoomed out past it show the plain fill beyond)
  const WX0 = T_X0, WY0 = T_Y0, WX1 = T_X0 + T_COLS * TILE, WY1 = T_Y0 + T_ROWS * TILE;
  vx0 = Math.max(vx0, WX0); vy0 = Math.max(vy0, WY0); vx1 = Math.min(vx1, WX1); vy1 = Math.min(vy1, WY1);
  if (vx1 <= vx0 || vy1 <= vy0) return null;
  // The composite's rect is a pure function of THIS frame's view (view + a small pad, snapped
  // outward to a coarse 128-unit grid), so a frame resamples exactly the same canvas whatever was
  // rendered before it (bit-identical across render order / processes). A slow drift or push
  // keeps the same rect for many frames; crossing a grid line simply builds the next one.
  const g = 128, pad = 4 / sc + 6;
  const x0 = Math.max(WX0, Math.floor((vx0 - pad) / g) * g), y0 = Math.max(WY0, Math.floor((vy0 - pad) / g) * g);
  const x1 = Math.min(WX1, Math.ceil((vx1 + pad) / g) * g), y1 = Math.min(WY1, Math.ceil((vy1 + pad) / g) * g);
  for (let i = _comps.length - 1; i >= 0; i--) {
    const C = _comps[i];
    if (C.key === key && C.L === L && C.x0 === x0 && C.y0 === y0 && C.x1 === x1 && C.y1 === y1) {
      if (i !== _comps.length - 1) { _comps.splice(i, 1); _comps.push(C); }
      return C;
    }
  }
  const W = Math.round((x1 - x0) * L), H = Math.round((y1 - y0) * L);
  if (W < 1 || H < 1 || W * H > 24e6) return null;
  const cv = napi().createCanvas(W, H);
  const cc = cv.getContext('2d');
  cc.setTransform(L, 0, 0, L, -x0 * L, -y0 * L);
  drawTiles(cc, key, drawFn, cc.getTransform(), W, H);
  const C = { key, L, x0, y0, x1, y1, cv };
  _comps.push(C);
  while (_comps.length > COMP_SLOTS) _comps.shift();
  return C;
}
function drawComposite(ctx, key, drawFn, m, cw, ch) {
  const C = compositeFor(key, drawFn, m, cw, ch);
  if (!C) { drawTiles(ctx, key, drawFn, m, cw, ch); return; }
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';
  ctx.drawImage(C.cv, C.x0, C.y0, C.cv.width / C.L, C.cv.height / C.L);
  ctx.restore();
}
function drawCached(ctx, key, drawFn) {
  if (!finiteCtx(ctx)) return;
  const m = ctx.getTransform();
  const cw = (ctx.canvas && ctx.canvas.width) || 0, ch = (ctx.canvas && ctx.canvas.height) || 0;
  if (!cw || !ch) { drawTiles(ctx, key, drawFn, m, 1920, 1080); return; }
  const q = (v) => Math.round(v * 4096) / 4096;
  const fk = key + '|' + cw + 'x' + ch + '|' + q(m.a) + ',' + q(m.b) + ',' + q(m.c) + ',' + q(m.d) + ',' + q(m.e) + ',' + q(m.f);
  let fr = _frames.get(fk);
  if (fr === undefined) {
    // first sighting: draw through the shot composite, remember the transform
    _frames.set(fk, null);
    if (_frames.size > 96) for (const [k, v] of _frames) { if (v === null) { _frames.delete(k); break; } }
    drawComposite(ctx, key, drawFn, m, cw, ch);
    return;
  }
  if (fr === null) {
    // second sighting: this is a held shot → compose a full-frame snapshot once (from the same
    // composite, so held and moving frames resample identically)
    fr = napi().createCanvas(cw, ch);
    const fc = fr.getContext('2d');
    fc.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    drawComposite(fc, key, drawFn, m, cw, ch);
    let n = 0;
    for (const v of _frames.values()) if (v) n++;
    if (n >= FRAME_SLOTS) for (const [k, v] of _frames) { if (v) { _frames.delete(k); break; } }
  }
  _frames.delete(fk);
  _frames.set(fk, fr);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(fr, 0, 0);
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
  window: { x: 905, y: 217, r: 80 },
  crater: { x: 938, y: 233 },        // Mount Snooze's crater as seen through the window (set below)
  shelleyHead: { x: 935, y: 354 },   // where Dr. Shelley's head sits (on plain wall, below the window)
  diploma: { x: 412, y: 222, w: 156, h: 116 },
  alcove: { x: 640, y: 372 },
  table: { x: 784, y: 532 },
  candle: { x: 728, y: 492 },
  hourglass: { x: 766, y: 530 },
  oranges: { x: 820, y: 478 },
  lamp: { x: 1182, y: 296 },
  fern: { x: 98, y: 622 },
};

// The window view is authored in legacy coordinates (WIN0: the window as first designed) and
// mapped onto OFFICE.window by winXf (uniform scale about the glass centre), so the volcano, the
// smoke, the leaves and the mullions keep their composition whatever the window's size/position.
const WIN0 = { x: 905, y: 196, r: 90 };
const CRATER0 = { x: 942, y: 214 };
const WIN_K = OFFICE.window.r / WIN0.r;
function winXf(ctx) {
  ctx.translate(OFFICE.window.x, OFFICE.window.y);
  ctx.scale(WIN_K, WIN_K);
  ctx.translate(-WIN0.x, -WIN0.y);
}
OFFICE.crater = { x: OFFICE.window.x + (CRATER0.x - WIN0.x) * WIN_K, y: OFFICE.window.y + (CRATER0.y - WIN0.y) * WIN_K };
OFFICE.windowOuterR = (WIN0.r + 20) * WIN_K;     // glass + carved frame ring (top of frame = y − this)

// suggested camera framings (withCamera objects) for the s05 shots
OFFICE.framings = {
  office_wide: { x: 640, y: 360, zoom: 1 },
  barry_couch: { x: 400, y: 470, zoom: 2 },
  shelley_cu: { x: 935, y: 400, zoom: 2 },
  // the whole porthole (frame top ≈119) AND Shelley's head below it, incl. his neck swivel toward
  // the window. The kit's {912,286,z2.05} (+push) also holds both (frame top ≥ 6 units inside).
  window: { x: 914, y: 268, zoom: 2.0 },
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
  const { x, y, r } = WIN0;
  ctx.save();
  winXf(ctx);
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
  // brass latch on the left of the frame (no sill: Dr. Shelley's head sits on clear wall below)
  roundRect(ctx, x - r - 19, y - 9, 9, 18, 3);
  fillStroke(ctx, lg(ctx, x - r - 19, 0, x - r - 10, 0, [[0, '#F0CC7A'], [1, '#9C7424']]), '#6A4A12', 1.1);
  circle(ctx, x - r - 14.5, y, 1.8);
  ctx.fillStyle = '#6A4A12';
  ctx.fill();
  // four pegs around the ring
  for (const a of [-2.36, -0.79, 0.79, 2.36]) {
    circle(ctx, x + Math.cos(a) * (r + 10), y + Math.sin(a) * (r + 10), 2.6);
    fillStroke(ctx, '#5A3019', null);
    circle(ctx, x + Math.cos(a) * (r + 10) - 0.7, y + Math.sin(a) * (r + 10) - 0.7, 1);
    ctx.fillStyle = rgba('#F0B67C', 0.7);
    ctx.fill();
  }
  ctx.restore();
}

// ════════════════════════════════════════════ Mount Snooze silhouette (shared with the river)
// Same design as env_spring's Mount Snooze (broad flat-topped cone, oval crater rim, radiating
// ridges), traced from its outline so the audience reads it as the same mountain in every setting.
// Spring coordinates: crater centre (860,150); drawn scaled by s about the crater → (cx,cy).
const SNOOZE_OUT = [[430, 488], [512, 446], [580, 405], [640, 357], [692, 303], [738, 249], [775, 201], [800, 169], [812, 156],
  [836, 147], [860, 150], [884, 146], [908, 153], [922, 167], [950, 203], [988, 249], [1032, 297], [1084, 345],
  [1140, 387], [1204, 423], [1270, 451], [1344, 484]];
const SNOOZE_RIDGES = [
  [[818, 162], [800, 202], [776, 248], [748, 294], [720, 338], [694, 376]],
  [[836, 160], [828, 208], [816, 258], [802, 308], [790, 356], [780, 396]],
  [[798, 178], [762, 220], [724, 266], [686, 310], [650, 350], [618, 384]],
  [[852, 162], [854, 216], [860, 272], [868, 328], [878, 384]],
  [[896, 162], [914, 208], [938, 256], [964, 304], [992, 348], [1020, 388]],
  [[914, 166], [948, 206], [990, 250], [1036, 294], [1086, 338], [1132, 372]],
];
const SNOOZE_LAVA = [[846, 162], [838, 204], [833, 250], [840, 296], [856, 338], [878, 374], [904, 402], [930, 430]];
// Catmull-Rom spline appended to the current path (starts at pts[0], which must be current)
function splineTo(ctx, pts) {
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
}
// tapered ribbon along a polyline (width w0 → w1), offset sideways by `side` × half width
function ribbonPath(ctx, pts, w0, w1, side = 0) {
  const n = pts.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const d = Math.hypot(nx, ny) || 1;
    nx /= d; ny /= d;
    const w = lerp(w0, w1, i / (n - 1)) / 2;
    const ox = pts[i][0] + nx * w * side, oy = pts[i][1] + ny * w * side;
    L.push([ox + nx * w, oy + ny * w]);
    R.push([ox - nx * w, oy - ny * w]);
  }
  ctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath();
}
function snoozeXf(cx, cy, s) { return (p) => [cx + (p[0] - 860) * s, cy + (p[1] - 150) * s]; }
function snoozeOutlineTrace(ctx, cx, cy, s, yBase) {
  const pts = SNOOZE_OUT.map(snoozeXf(cx, cy, s));
  ctx.moveTo(pts[0][0], Math.max(pts[0][1], yBase));
  ctx.lineTo(pts[0][0], pts[0][1]);
  splineTo(ctx, pts);
  ctx.lineTo(pts[pts.length - 1][0], Math.max(pts[pts.length - 1][1], yBase));
  ctx.closePath();
}
function snoozeConePath(ctx, cx, cy, s, yBase) {
  const X = snoozeXf(cx, cy, s);
  const pts = SNOOZE_OUT.map(X);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], Math.max(pts[0][1], yBase));
  ctx.lineTo(pts[0][0], pts[0][1]);
  splineTo(ctx, pts);
  ctx.lineTo(pts[pts.length - 1][0], Math.max(pts[pts.length - 1][1], yBase));
  ctx.closePath();
}
// P = palette {lit, mid, shade, light (+1 lit from the right, -1 from the left), ridgeLit,
//   ridgeDark, edge, rim, rimLit, crater, baseTint?, extra?(ctx, X, s)}
function drawSnoozeCone(ctx, cx, cy, s, yBase, P) {
  const X = snoozeXf(cx, cy, s);
  const half = 330 * s;
  ctx.save();
  snoozeConePath(ctx, cx, cy, s, yBase);
  const g = P.light > 0
    ? [[0, P.shade], [0.47, P.mid], [0.53, P.lit], [1, shade(P.lit, 0.08)]]
    : [[0, shade(P.lit, 0.08)], [0.47, P.lit], [0.53, P.mid], [1, P.shade]];
  ctx.fillStyle = lg(ctx, cx - half * 0.55, 0, cx + half * 0.55, 0, g);
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (P.baseTint) {
    ctx.fillStyle = lg(ctx, 0, cy, 0, yBase, [[0, rgba(P.baseTint, 0)], [0.45, rgba(P.baseTint, 0.1)], [1, rgba(P.baseTint, 0.55)]]);
    ctx.fillRect(cx - half * 1.4, cy - 10, half * 2.8, yBase - cy + 20);
  }
  // radiating ridges: lit edge towards the light, shadowed edge away from it
  for (const rp of SNOOZE_RIDGES) {
    const pts = rp.map(X);
    ctx.beginPath();
    ribbonPath(ctx, pts, 0.6 * s * 2.5, 15 * s, -P.light);
    ctx.fillStyle = P.ridgeLit;
    ctx.fill();
    ctx.beginPath();
    ribbonPath(ctx, pts, 0.6 * s * 2.5, 17 * s, P.light);
    ctx.fillStyle = P.ridgeDark;
    ctx.fill();
  }
  if (P.extra) P.extra(ctx, X, s);
  ctx.restore();
  // thin darker same-hue outline
  snoozeConePath(ctx, cx, cy, s, yBase);
  ctx.strokeStyle = P.edge;
  ctx.lineWidth = Math.max(0.8, 4 * s);
  ctx.stroke();
  // oval crater: outer lip, dark throat, lit near lip
  ellipse(ctx, cx, cy + 2 * s, 50 * s, 9.5 * s);
  ctx.fillStyle = P.rim;
  ctx.fill();
  ellipse(ctx, cx, cy + 4.5 * s, 41 * s, 6.2 * s);
  ctx.fillStyle = P.crater;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2 * s, 50 * s, 9.5 * s, 0, 0.15, Math.PI - 0.15);
  ctx.strokeStyle = P.rimLit;
  ctx.lineWidth = Math.max(0.8, 5 * s);
  ctx.stroke();
  ctx.restore();
}

// Soft billowing smoke: blobs (noise-displaced outlines) unioned into ONE path per tone, so
// overlapping puffs never stack into rings or coin edges. puffs: [{x, y, r, sx?, sy?, seed}]
function blobsPath(ctx, puffs, k = 1, dx = 0, dy = 0, t = 0) {
  ctx.beginPath();
  for (const p of puffs) {
    const r = p.r * k;
    if (r < 0.3) continue;
    const n = 9, pts = [];
    const sx = p.sx || 1, sy = p.sy || 1;
    for (let j = 0; j < n; j++) {
      const a = (j / n) * TAU + p.seed;
      const rr = r * (1 + 0.16 * noise1(p.seed * 7.3 + j * 1.91 + t * 0.35));
      pts.push([p.x + dx * p.r + Math.cos(a) * rr * sx, p.y + dy * p.r + Math.sin(a) * rr * sy]);
    }
    ctx.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
    for (let j = 0; j < n; j++) {
      const a = pts[j], b = pts[(j + 1) % n];
      ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    ctx.closePath();
  }
}

// ---------------------------------------------------------------- window view (live)
// Composition (deliberate): Mount Snooze's crater sits in the clear LOWER-RIGHT pane, its smoke
// rises into the UPPER-RIGHT pane (the transom is set high so the crater has room under it), and
// foreground leaves stay on the LEFT rim, away from the plume. Dr. Shelley's head sits on plain
// wall just below the frame, so the 'window_puff' gag reads in office_wide, window and shelley_cu.
const WIN_SNOOZE = {
  lit: '#B3B2CA', mid: '#9C9BB5', shade: '#7D7F98', light: -1,
  ridgeLit: rgba('#D0CFE0', 0.5), ridgeDark: rgba('#5E6078', 0.3), edge: rgba('#5A5C74', 0.5),
  rim: '#A7A6BF', rimLit: '#D9D8E8', crater: '#4E4A60', baseTint: '#C9E6EE',
};
// lazy smoke wisp (same look as env_spring's crater smoke, a touch darker so it reads at zoom 1)
function windowWisp(ctx, t, cx, cy, amt) {
  if (amt <= 0.01) return;
  const N = 28, Lp = 7;
  const a = Math.min(1.2, amt);
  const H = 72 + 30 * Math.min(1, a), W = 22 + 16 * Math.min(1, a);
  const thick = 0.55 + 0.9 * a;
  const puffs = [];
  for (let i = 0; i < N; i++) {
    const k = frac(t / Lp + i / N);
    const x = cx + W * Math.pow(k, 1.5) + Math.sin(k * 5 + i * 0.7 + t * 0.3) * 2.2 * k;
    const y = cy - 1 - H * k + H * 0.12 * k * k;
    const r = (2.2 + 7 * Math.pow(k, 0.85)) * thick * (1 - smoothstep(0.8, 1, k)) * smoothstep(0, 0.05, k + 0.01);
    puffs.push({ x, y, r, seed: i * 1.37 });
  }
  const a0 = Math.min(0.92, 0.5 + 0.5 * a);
  const gx1 = cx + W, gy1 = cy - H * 0.95;
  ctx.save();
  blobsPath(ctx, puffs, 1, 0, 0, t);
  ctx.fillStyle = lg(ctx, cx, cy, gx1, gy1, [[0, rgba('#5A566C', a0)], [0.5, rgba('#6E6A82', a0 * 0.8)], [1, rgba('#8A86A0', 0)]]);
  ctx.fill();
  blobsPath(ctx, puffs, 0.6, -0.3, -0.34, t);
  ctx.fillStyle = lg(ctx, cx, cy, gx1, gy1, [[0, rgba('#8E8AA2', a0 * 0.85)], [0.5, rgba('#A6A2B8', a0 * 0.6)], [1, rgba('#BEBACE', 0)]]);
  ctx.fill();
  ctx.restore();
}
// the big dark puff for beat 'window_puff' (p 0..1): two quick little "pff"s, then a big
// three-tier billow that fills the upper-right pane and pushes past both mullions, lingers, then
// (p 0.62 → 0.95) is blown up and to the right, sliding out of the pane behind the frame while
// it thins — gone by p ≈ 0.95 (the wisp is suppressed by then too: clear blue sky).
const PUFF_LOBES = [
  // birth, grow, dx, dy, r  (final offsets from the crater, window units)
  [0.00, 0.12, 3, -9, 6.5], [0.08, 0.12, -3, -12, 7.5],
  [0.19, 0.24, 0, -14, 12], [0.21, 0.26, -12, -26, 13], [0.22, 0.26, 13, -28, 14],
  [0.25, 0.28, -3, -40, 17], [0.28, 0.30, -26, -42, 14], [0.29, 0.30, 23, -46, 16],
  [0.32, 0.32, 4, -60, 20], [0.35, 0.34, -21, -64, 16], [0.36, 0.34, 28, -66, 15],
  [0.39, 0.36, 9, -80, 18], [0.42, 0.36, -12, -86, 14], [0.43, 0.36, 30, -82, 12],
];
function windowPuff(ctx, t, cx, cy, p) {
  const A = 1 - smoothstep(0.82, 0.96, p);
  if (p <= 0 || A <= 0.002) return;
  const lift = smoothstep(0.45, 1, p);
  const go = ease.inOutSine(smoothstep(0.62, 0.95, p));
  const ox = lift * 12 + go * 104, oy = -lift * 16 - go * 64, grow = 1 + 0.14 * lift + 0.12 * go;
  const puffs = [];
  PUFF_LOBES.forEach(([b, d, dx, dy, r], i) => {
    const g = clamp((p - b) / d);
    if (g <= 0) return;
    const e = ease.outCubic(g);
    const rise = 0.35 + 0.65 * e;
    puffs.push({
      x: cx + dx * rise + ox * (0.4 + 0.6 * -dy / 86), y: cy + dy * rise + oy * (0.4 + 0.6 * -dy / 86),
      r: r * Math.pow(e, 0.7) * grow * (1 + 0.05 * Math.sin(t * 2.1 + i * 1.7)), seed: i * 2.13,
    });
  });
  ctx.save();
  ctx.globalAlpha = A;
  // hot underside: the crater lights the bottom of the cloud
  const hot = clamp(p / 0.1) * (1 - smoothstep(0.35, 0.8, p));
  blobsPath(ctx, puffs, 1, 0.06, 0.16, t);
  ctx.fillStyle = mix('#3A3444', '#C2552E', 0.75 * hot);
  ctx.fill();
  blobsPath(ctx, puffs, 1, 0, 0, t);
  ctx.fillStyle = '#3B3746';
  ctx.fill();
  // lit upper-left of every lobe (sun from the upper left), merged so it reads as one cloud
  blobsPath(ctx, puffs, 0.88, -0.11, -0.15, t);
  ctx.fillStyle = '#4D4859';
  ctx.fill();
  blobsPath(ctx, puffs.filter((q) => q.r > 8), 0.7, -0.24, -0.3, t);
  ctx.fillStyle = '#625C6E';
  ctx.fill();
  blobsPath(ctx, puffs.filter((q) => q.r > 13 && q.y < cy - 30), 0.42, -0.42, -0.5, t);
  ctx.fillStyle = '#7A7486';
  ctx.fill();
  ctx.restore();
}
const WIN_TRANSOM = -16;                     // transom (horizontal bar) offset from the centre: set high
const WIN_MW = 6;                            // mullion width
const WIN_LEAVES = [
  [-6, -40, 58, 13, 0.62, '#2F6B45'],
  [-4, -6, 64, 15, 0.18, '#3F8A55'],
  [2, 38, 54, 13, -0.42, '#2F6B45'],
  [34, 90 + 4, 44, 11, -1.35, '#3F8A55'],
  [18, -90 + 6, 40, 10, 1.0, '#3F8A55'],
];
// STATIC part of the window (cached with the room): sky, distant ridge, Mount Snooze, canopy,
// palms, reveal shadow, sheen, mullions.
function officeWindowStatic(ctx) {
  const { x, y, r } = WIN0;
  const { x: vx, y: vy } = CRATER0;
  const ty = y + WIN_TRANSOM;
  ctx.save();
  winXf(ctx);
  circle(ctx, x, y, r);
  ctx.clip();
  ctx.fillStyle = lg(ctx, 0, y - r, 0, y + r, [[0, '#6FC0EA'], [0.55, '#B9E3F2'], [1, '#FCE9C6']]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  glow(ctx, x - 48, y - 52, 70, 70, '#FFF6D8', 0.75);
  // pale distant ridge behind the volcano
  ctx.beginPath();
  ctx.moveTo(x - r, y + r);
  for (let i = 0; i <= 12; i++) {
    const xx = x - r + (i / 12) * r * 2;
    ctx.lineTo(xx, y + 34 - Math.sin(i * 0.9 + 1) * 6 - (i < 6 ? i * 1.5 : (12 - i) * 1.5));
  }
  ctx.lineTo(x + r, y + r);
  ctx.closePath();
  ctx.fillStyle = '#A9D3C4';
  ctx.fill();
  drawSnoozeCone(ctx, vx, vy, 0.42, y + r + 4, WIN_SNOOZE);
  // jungle canopy in front of the volcano's foot (three rows, far → near)
  const rows = [[y + 64, 11, '#6DB27A', 1.3], [y + 74, 14, '#4E9A5E', 2.1], [y + 86, 17, '#3B7F4E', 0.7]];
  for (const [ry, rr, col, ph] of rows) {
    ctx.beginPath();
    for (let i = 0; i <= Math.ceil((r * 2 + 40) / (rr * 1.5)); i++) {
      const cxp = x - r - 20 + i * rr * 1.5, cyp = ry + Math.sin(i * 2.3 + ph) * 3.5;
      ctx.moveTo(cxp + rr, cyp);
      ctx.arc(cxp, cyp, rr, 0, TAU);
    }
    ctx.rect(x - r, ry, r * 2, r);
    ctx.fillStyle = col;
    ctx.fill();
  }
  // a couple of palm silhouettes poking out of the canopy (left half, clear of the plume)
  palm(ctx, x - 52, y + 70, 30, 0.12, '#3B7F4E', 0.6);
  palm(ctx, x - 22, y + 74, 22, -0.1, '#346F45', 0.5);
  // inner reveal shadow + glass sheen (upper-left, away from the plume)
  circle(ctx, x, y, r);
  ctx.fillStyle = rg(ctx, x - 6, y - 8, r * 0.74, r + 2, [[0, 'rgba(60,30,10,0)'], [1, 'rgba(60,30,10,0.42)']]);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = 'rgba(255,255,255,0.26)';
  ctx.lineWidth = 6;
  line(ctx, x - 62, y - 14, x - 16, y - 60);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  line(ctx, x - 56, y + 4, x - 4, y - 48);
  ctx.stroke();
  ctx.restore();
  // mullions: centred vertical bar, transom set high
  const mw = WIN_MW;
  ctx.fillStyle = '#7A4526';
  ctx.fillRect(x - mw / 2, y - r, mw, r * 2);
  ctx.fillRect(x - r, ty - mw / 2, r * 2, mw);
  ctx.fillStyle = rgba('#E9AE73', 0.7);
  ctx.fillRect(x - mw / 2, y - r, 1.5, r * 2);
  ctx.fillRect(x - r, ty - mw / 2, r * 2, 1.5);
  ctx.fillStyle = rgba('#3A1A08', 0.35);
  ctx.fillRect(x + mw / 2, y - r, 1.2, r * 2);
  ctx.fillRect(x - r, ty + mw / 2, r * 2, 1.2);
  circle(ctx, x, ty, 5.5);
  fillStroke(ctx, '#8A5230', '#4A2611', 1.3);
  ctx.restore();
}
// LIVE part: drifting clouds, the smoke wisp + puff (rising out of the crater, behind nothing but
// the cone), swaying leaves on the left rim, then the crater glow.
// Performance: drawing ~20 shapes inside an anti-aliased even-odd pane clip cost 9–12 ms at 1080p
// (Skia re-masks the clip for every draw). Instead the view is drawn UNCLIPPED into a small
// device-space scratch canvas (same transform, integer offset), masked once (panes = glass minus
// mullions, cone cut out of the smoke) and blitted 1:1 — pixel-equivalent, ≈3–4 ms.
let _winScratch = null;
function windowPuffClear(o, puff) {
  // the big puff's tail (puff 0.8 → 0.97) also stops the ambient wisp: clear blue sky by the end
  return Math.max(clamp(fin(o.clear, 0)), smoothstep(0.8, 0.97, puff));
}
function officeWindowLive(ctx, t, o) {
  const smoke0 = clamp(fin(o.volcanoSmoke, 0.35), 0, 1.5);
  const puff = clamp(fin(o.puff, 0));
  const clr = windowPuffClear(o, puff);
  const smoke = smoke0 * (1 - clr);
  const W = OFFICE.window;
  const m = ctx.getTransform();
  // device-space bounding box of the glass
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  const R = W.r + 3;
  for (const [px, py] of [[W.x - R, W.y - R], [W.x + R, W.y - R], [W.x - R, W.y + R], [W.x + R, W.y + R]]) {
    const dx = m.a * px + m.c * py + m.e, dy = m.b * px + m.d * py + m.f;
    bx0 = Math.min(bx0, dx); bx1 = Math.max(bx1, dx); by0 = Math.min(by0, dy); by1 = Math.max(by1, dy);
  }
  const cw = (ctx.canvas && ctx.canvas.width) || Infinity, ch = (ctx.canvas && ctx.canvas.height) || Infinity;
  bx0 = Math.max(0, Math.floor(bx0)); by0 = Math.max(0, Math.floor(by0));
  bx1 = Math.min(cw, Math.ceil(bx1), bx0 + 4096); by1 = Math.min(ch, Math.ceil(by1), by0 + 4096);
  const bw = bx1 - bx0, bh = by1 - by0;
  if (bw >= 1 && bh >= 1) {
    // exactly bw×bh (re-used only at the same size): Skia's output must not depend on what a
    // previous frame left behind, so frames stay bit-identical whatever order they render in
    if (!_winScratch || _winScratch.width !== bw || _winScratch.height !== bh) _winScratch = napi().createCanvas(bw, bh);
    const c = _winScratch.getContext('2d');
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.clearRect(0, 0, bw, bh);
    c.setTransform(m.a, m.b, m.c, m.d, m.e - bx0, m.f - by0);
    winXf(c);
    windowViewLive(c, t, smoke, puff, clr);
    c.restore();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(_winScratch, 0, 0, bw, bh, bx0, by0, bw, bh);
    ctx.restore();
  }
  // crater glow: from volcanoSmoke 0.6 up, and flaring with the puff (stays visible under it). It
  // sits well inside the lower-right pane, so it needs no clip; 'screen' needs the real background.
  const { x: vx, y: vy } = CRATER0;
  const pg = clamp(puff / 0.06) * (1 - smoothstep(0.55, 0.95, puff));
  const cg = Math.max(clamp((smoke - 0.55) * 1.6, 0, 0.8), pg * (0.85 + 0.15 * Math.sin(t * 9)));
  if (cg > 0.01) {
    ctx.save();
    winXf(ctx);
    ctx.globalCompositeOperation = 'screen';
    glow(ctx, vx, vy + 1, 24, 10, '#FF7A2E', 0.9 * cg);
    ctx.globalCompositeOperation = 'source-over';
    ellipse(ctx, vx, vy + 1.6, 15, 2.2);
    ctx.fillStyle = rgba('#FF9A4A', 0.9 * cg);
    ctx.fill();
    ctx.restore();
  }
}
// draws the live window view in WIN0 coordinates onto a TRANSPARENT scratch, then masks it
function windowViewLive(c, t, smoke, puff, clr) {
  const { x, y, r } = WIN0;
  const { x: vx, y: vy } = CRATER0;
  // 1. smoke (nearest of the sky layers), cut by the cone so it rises out of the crater
  windowWisp(c, t, vx, vy, (smoke + 0.35 * clamp(puff * 4) * (1 - puff)) * (1 - clr));
  windowPuff(c, t, vx, vy, puff);
  c.save();
  c.globalCompositeOperation = 'destination-out';
  c.beginPath();
  snoozeOutlineTrace(c, vx, vy, 0.42, y + r + 4);
  c.fillStyle = '#000';
  c.fill();
  // 2. BEHIND the smoke: the view darkens a touch while the big puff shades the sun …
  c.globalCompositeOperation = 'destination-over';
  const dim = smoothstep(0.25, 0.5, puff) * (1 - smoothstep(0.75, 1, puff));
  if (dim > 0.005) {
    c.fillStyle = rgba('#4A5878', 0.16 * dim);
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // … and two small clouds drift slowly across the upper panes (under the dim)
  for (let i = 0; i < 2; i++) {
    const span = r * 2 + 90;
    const cxl = x - r - 45 + frac((t * 2.4 + i * 131) / span) * span;
    const cyl = y - 58 + i * 26;
    const s = i ? 0.75 : 1;
    c.fillStyle = 'rgba(200,220,240,0.6)';
    c.fillRect(cxl - 14 * s, cyl + 4 * s, 44 * s, 3.5 * s);
    c.fillStyle = 'rgba(255,255,255,0.88)';
    c.beginPath();
    for (const [dx, dy, rr] of [[0, 0, 9], [11, -4, 11], [23, 0, 8], [-10, 2, 6.5]]) { c.moveTo(cxl + dx * s + rr * s, cyl + dy * s); c.arc(cxl + dx * s, cyl + dy * s, rr * s, 0, TAU); }
    c.fill();
  }
  c.restore();
  // 3. swaying jungle leaves framing the LEFT rim only (in front of everything)
  WIN_LEAVES.forEach(([dx, dy, L, Wd, a, col], i) => {
    const lx = x - r + dx, ly = y + dy;
    const sway = Math.sin(t * 1.1 + i * 1.7) * 0.07 + noise1(t * 0.6 + i * 9) * 0.04;
    leafPath(c, lx, ly, L, Wd, a + sway, 0.18);
    c.fillStyle = col;
    c.fill();
    c.save();
    c.translate(lx, ly);
    c.rotate(a + sway);
    c.beginPath();
    c.moveTo(2, 0);
    c.quadraticCurveTo(L * 0.5, L * 0.06, L * 0.95, L * 0.05);
    c.strokeStyle = rgba('#8CCB7A', 0.7);
    c.lineWidth = 1.2;
    c.stroke();
    c.restore();
  });
  // re-darken the rim over the leaves (the frame's reveal shadow)
  circle(c, x, y, r - 4);
  c.strokeStyle = 'rgba(60,30,10,0.3)';
  c.lineWidth = 9;
  c.stroke();
  // 4. mask to the panes: cut away everything outside the glass, then the mullions + hub.
  // (destination-out only — @napi-rs/canvas mis-bounds the unbounded 'destination-in' under a
  // translated transform and wipes the whole canvas)
  const ty = y + WIN_TRANSOM, mw = WIN_MW + 0.6;
  c.save();
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = '#000';
  c.beginPath();
  c.rect(x - r - 80, y - r - 80, r * 2 + 160, r * 2 + 160);
  c.moveTo(x + r, y);
  c.arc(x, y, r, 0, TAU);
  c.fill('evenodd');
  c.beginPath();
  c.rect(x - mw / 2, y - r - 2, mw, r * 2 + 4);
  c.rect(x - r - 2, ty - mw / 2, r * 2 + 4, mw);
  c.moveTo(x + 6, ty);
  c.arc(x, ty, 6, 0, TAU);
  c.fill();
  c.restore();
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
  // (no throw pillow: the space in front of Barry's snout stays clear for his direct-address close-up)
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
  const backPath = () => {
    ctx.beginPath();
    ctx.moveTo(1046, 596);
    ctx.lineTo(1050, 486);
    ctx.bezierCurveTo(1030, 474, 1012, 450, 1010, 414);
    ctx.bezierCurveTo(1008, 380, 1022, 352, 1046, 340);
    ctx.bezierCurveTo(1068, 326, 1104, 324, 1122, 338);
    ctx.bezierCurveTo(1138, 350, 1138, 378, 1134, 410);
    ctx.bezierCurveTo(1130, 450, 1130, 520, 1128, 596);
    ctx.closePath();
  };
  backPath();
  ctx.fillStyle = lg(ctx, 1008, 0, 1138, 0, [[0, '#A84C58'], [0.5, VELVET.base], [1, VELVET.lo]]);
  ctx.fill();
  // warm wash from the standing lamp on the right of the back (strongest up near the shade)
  ctx.fillStyle = rg(ctx, OFFICE.lamp.x - 10, OFFICE.lamp.y - 20, 30, 240, [[0, rgba('#FF9E58', 0.5)], [0.45, rgba('#F07A50', 0.24)], [1, rgba('#F07A50', 0)]]);
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
  glow(ctx, x - 10, y - 10, 460, 400, '#FFAA4A', 0.4);
  // warm halo on the wall around the shade
  glow(ctx, x, y - 38, 230, 200, '#FFC870', 0.42);
  glow(ctx, x, y - 34, 120, 105, '#FFE6B0', 0.5);
  // light escaping through the shade's top opening: a soft cone up the wall
  for (let i = 0; i < 5; i++) {
    const k = 0.6 + i * 0.18;
    poly(ctx, [[x - 34, y - 74], [x + 34, y - 74], [x + 150 * k, y - 330], [x - 140 * k, y - 330]]);
    ctx.fillStyle = lg(ctx, 0, y - 74, 0, y - 330, [[0, 'rgba(255,214,150,0.13)'], [0.5, 'rgba(255,214,150,0.045)'], [1, 'rgba(255,214,150,0)']]);
    ctx.fill();
  }
  // and the wider cone below the shade, down to the floor (stacked low-alpha cones = soft edges)
  for (let i = 0; i < 7; i++) {
    const k = 0.5 + i * 0.13;
    poly(ctx, [[x - 58 * k, y + 2], [x + 58 * k, y + 2], [x + 230 * k, 700], [x - 300 * k, 700]]);
    ctx.fillStyle = lg(ctx, 0, y, 0, 700, [[0, 'rgba(255,214,140,0.1)'], [0.6, 'rgba(255,214,140,0.04)'], [1, 'rgba(255,214,140,0.012)']]);
    ctx.fill();
  }
  // window daylight on the wall around the window
  const w = OFFICE.window;
  glow(ctx, w.x, w.y, 230, 210, '#FFF0C8', 0.26);
  ctx.restore();
}
// warm pool of lamplight on the floorboards, catching the rug's right edge (drawn after the rug)
function officeLampPool(ctx) {
  const { x } = OFFICE.lamp;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  glow(ctx, x - 40, 672, 250, 44, '#FFB060', 0.5);
  glow(ctx, x - 26, 670, 150, 26, '#FFD898', 0.55);
  glow(ctx, x - 14, 668, 70, 12, '#FFF0C8', 0.45);
  ctx.restore();
}
function officeLamp(ctx) {
  const { x, y } = OFFICE.lamp;
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
  // translucent fabric lit from inside: hot core, warmer at the rims, pleats as faint shadows
  poly(ctx, [[x - tw, ty], [x + tw, ty], [x + bw, y], [x - bw, y]]);
  ctx.fillStyle = lg(ctx, 0, ty, 0, y, [[0, '#FFD992'], [0.45, '#FFEBB8'], [1, '#FFF6DC']]);
  ctx.fill();
  ctx.save();
  poly(ctx, [[x - tw, ty], [x + tw, ty], [x + bw, y], [x - bw, y]]);
  ctx.clip();
  ctx.fillStyle = lg(ctx, x - bw, 0, x + bw, 0, [[0, 'rgba(232,140,60,0.32)'], [0.22, 'rgba(255,200,120,0)'], [0.78, 'rgba(255,200,120,0)'], [1, 'rgba(232,140,60,0.32)']]);
  ctx.fillRect(x - bw, ty, bw * 2, y - ty);
  glow(ctx, x, y - 30, 46, 40, '#FFFFFF', 0.55);
  ctx.strokeStyle = rgba('#E0A860', 0.4);
  ctx.lineWidth = 1;
  for (let i = -5; i <= 5; i++) { line(ctx, x + i * tw / 5.5, ty, x + i * bw / 5.5, y); ctx.stroke(); }
  glow(ctx, x, y + 6, 70, 40, '#FFFFFF', 0.6);
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
  ctx.fillStyle = '#FFF8E4';
  ctx.fill();
  // finial
  circle(ctx, x, ty - 6, 4);
  fillStroke(ctx, '#D9A84A', '#5A3E10', 1);
  // the lit shade blooms softly into the room
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  glow(ctx, x, y - 32, 96, 74, '#FFD890', 0.3);
  glow(ctx, x, y + 4, 74, 14, '#FFF2D0', 0.5);
  ctx.restore();
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
  officeLampPool(ctx);
  officeBeam(ctx);
  officeFern(ctx);
  officeCouch(ctx);
  officeTable(ctx, {}, false);
  officeChair(ctx);
  officeLamp(ctx);
  officeHangingPlant(ctx);
  officeWindowStatic(ctx);           // last: the view through the glass is not tinted by room light
}

function drawTherapyOffice(ctx, t, o) {
  t = fin(t, 0);
  o = optsOf(o);
  if (!finiteCtx(ctx)) return;
  ctx.save();
  if (o.cache === false) officeStatic(ctx);
  else drawCached(ctx, 'office', officeStatic);
  officeWindowLive(ctx, t, o);
  officeTable(ctx, { candle: o.candle, hourglass: o.hourglass == null ? null : clamp(fin(o.hourglass, 0)), oranges: fin(o.oranges, 6), _t: t }, true);
  if (o.dust !== false) officeDust(ctx, t);
  ctx.restore();
}

function drawTherapyOfficeFront(ctx, t, o) {
  t = fin(t, 0);
  o = optsOf(o);
  if (!finiteCtx(ctx)) return;
  ctx.save();
  // soft daylight from the window above, falling on Dr. Shelley's head and shoulders
  const k = clamp(fin(o.shelleyLight, 1), 0, 2);
  if (k > 0) {
    const h = OFFICE.shelleyHead;
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    glow(ctx, h.x + 6, h.y - 18, 78, 56, '#FFF2D0', 0.55 * k);
    ctx.globalCompositeOperation = 'screen';
    glow(ctx, h.x + 2, h.y - 30, 46, 22, '#FFE9C0', 0.16 * k);
    ctx.restore();
  }
  couchCushionFront(ctx, true);
  chairArm(ctx);
  ctx.restore();
}

// ════════════════════════════════════════════════════════════ RIVER SUNSET
// Layering: one cached STATIC layer (sky gradient + sun glow, far hills, Mount Snooze, water,
// far reflections, jungle banks + their reflections) blitted per frame, then the LIVE layer:
// stars, drifting stratus, the sun disc (clipped behind the far hills so it can sink), the smoke
// column, crater glow, ripples + sun shimmer (culled to open water), palms, birds, lilies, raft
// shadow, ash. The static layer is keyed by the sun position, so keep o.sun fixed within a shot.
const HY = 392;                                      // horizon / far water edge
const RB_X = 1040;                                   // right bank meets the far water here
// Mount Snooze, tiny and far: crater at VOLC, drawn at RIVER_SNOOZE_S and squashed vertically by
// RIVER_SNOOZE_K (reads broader and farther away). It sits LEFT of the raft's cast band (x 440–860
// stays clear of silhouettes above the horizon), low enough that its crater + the first ≈80 units
// of smoke fit in a close-up of Barry, and the smoke drifts up-LEFT, away from the cast, mast and sun.
const VOLC = { x: 404, y: 338 };
const RIVER_SNOOZE_S = 0.26, RIVER_SNOOZE_K = 0.8;
const RIVER = {
  raftPos: { x: 640, y: 520 },
  waterY: HY,
  horizonY: HY,
  sun: { x: 955, y: 350, r: 46 },
  volcano: { ...VOLC },                               // crater centre
  volcanoTop: { x: VOLC.x - 13, y: VOLC.y - 76 },     // top of the readable smoke column (≈76 above the crater)
  volcanoBox: { x0: VOLC.x - 56, y0: VOLC.y - 86, x1: VOLC.x + 58, y1: VOLC.y + 42 }, // cone above the treeline + readable smoke
  banks: { left: { x: 600, y: HY + 3 }, right: { x: RB_X, y: HY + 3 } },
};
// suggested camera framings for the s08 shots (all verified against the default raft + cast)
RIVER.framings = {
  raft_wide: { x: 640, y: 360, zoom: 1 },
  // Barry (on the raft at RIVER.raftPos) with tiny smoking Mount Snooze over his shoulder
  barry_cu: { x: 572, y: 372, zoom: 2.35 },
  gerald_flag: { x: 680, y: 300, zoom: 2.4 },
  fish: { x: 640, y: 540, zoom: 2 },
  volcano: { x: 398, y: 312, zoom: 2.6 },
};
// Close-up CHEATS (verified with the kit's raft layout: raft at RIVER.raftPos, Sunny/Barry/Doreen at
// seats −126/+6/+128): pass `volcano` as o.volcano to drawRiverSunset for that shot only and use
// `cam` (or any CU with Barry's eye at screen y ≈ 430). The mountain then sits right behind Barry's
// shoulder (clear of the mast, the rigging and the others' oranges) and its smoke rises out of frame.
RIVER.volcanoCU = {
  barryFacingRight: { volcano: { x: 598, y: 352 }, cam: { x: 645, y: 395, zoom: 3.3 } },
  barryFacingLeft: { volcano: { x: 712, y: 350 }, cam: { x: 620, y: 395, zoom: 3.3 } },
};
// Shift (and only if it cannot fit, zoom out) a camera {x,y,zoom,...} as little as possible so that
// RIVER.volcanoBox — plus every box in `keep` ({x0,y0,x1,y1}, e.g. Barry's head) — is inside the
// frame with `margin` design units to spare. Pure; returns a new camera object.
const volcanoBoxAt = (v) => ({ x0: v.x - 56, y0: v.y - 86, x1: v.x + 58, y1: v.y + 42 });
function riverFrameVolcano(cam, keep, margin = 14, volcano) {
  cam = cam && typeof cam === 'object' ? cam : {};
  const vb = volcano && typeof volcano === 'object' ? volcanoBoxAt({ x: fin(volcano.x, VOLC.x), y: fin(volcano.y, VOLC.y) }) : RIVER.volcanoBox;
  const boxes = [vb].concat(Array.isArray(keep) ? keep : keep ? [keep] : []);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of boxes) {
    if (!b) continue;
    x0 = Math.min(x0, fin(b.x0, Infinity)); y0 = Math.min(y0, fin(b.y0, Infinity));
    x1 = Math.max(x1, fin(b.x1, -Infinity)); y1 = Math.max(y1, fin(b.y1, -Infinity));
  }
  const m = clamp(fin(margin, 14), 0, 200);
  x0 -= m; y0 -= m; x1 += m; y1 += m;
  let zoom = Math.max(0.05, fin(cam.zoom, 1));
  zoom = Math.min(zoom, 1280 / Math.max(1, x1 - x0), 720 / Math.max(1, y1 - y0));
  const hw = 640 / zoom, hh = 360 / zoom;
  const cx = fin(cam.x, 640), cy = fin(cam.y, 360);
  const x = clamp(cx, x1 - hw, x0 + hw), y = clamp(cy, y1 - hh, y0 + hh);
  return { ...cam, x, y, zoom };
}
const SKY = { top: '#2A1D4A', hi: '#5B3A7A', mid: '#A24E7C', low: '#E0716C', hor: '#FF9E5E' };
const RIV = {
  far: '#C06A84', tree: '#7E3F6E', bankL: '#55295A', bankR: '#4E2654', near: '#22132C',
  water0: '#FFAF72', water1: '#DE8278', water2: '#A65E80', water3: '#6E4276', water4: '#3C2858',
};
const WATER_STOPS = [[0, RIV.water0], [0.06, RIV.water1], [0.25, RIV.water2], [0.5, RIV.water3], [1, RIV.water4]];
function waterColorAt(y) {
  const k = clamp((y - HY) / (900 - HY));
  for (let i = 1; i < WATER_STOPS.length; i++) {
    if (k <= WATER_STOPS[i][0]) {
      const [k0, c0] = WATER_STOPS[i - 1], [k1, c1] = WATER_STOPS[i];
      return mix(c0, c1, (k - k0) / (k1 - k0));
    }
  }
  return RIV.water4;
}

// canopy built from rounded tree crowns (pure functions of constants, memoised)
const leftEdge = (x) => HY + 3 + Math.max(0, 600 - x) * 0.085;
const rightEdge = (x) => HY + 3 + Math.max(0, x - RB_X) * 0.075;
const edgeAt = (x) => (x < 820 ? leftEdge(x) : rightEdge(x));
function crownsFor(side) {
  const R = rng(side < 0 ? 71 : 93);
  const out = [];
  if (side < 0) {
    // jungle wall on the far left, falling to a LOW scrub spit (x ≈ 330…600) at the river mouth so
    // the sky behind the cast and around Mount Snooze stays clear
    let x = 604;
    while (x > -560) {
      const big = x < 140;
      let r, top;
      if (big) {
        r = R.range(46, 78);
        top = lerp(300, 70, clamp((140 - x) / 600)) + R.range(-25, 20);
      } else if (x > 330) {
        r = R.range(7, 12);
        top = lerp(385, 374, (604 - x) / 274) + R.range(-2, 2);
      } else {
        const w = (330 - x) / 190;
        r = lerp(12, 30, w) * R.range(0.85, 1.15);
        top = lerp(374, 312, ease.inOutSine(w)) + R.range(-6, 6) * w;
      }
      out.push([x, Math.min(top + r, leftEdge(x) - r * 0.45), r]);
      if (R() < 0.7) { const x2 = x + r * R.range(0.3, 0.6), r2 = r * R.range(0.5, 0.7); out.push([x2, Math.min(top + r * R.range(0.55, 0.85), leftEdge(x2) - r2 * 0.45), r2]); }
      x -= r * (big ? 0.95 : 1.15);
    }
  } else {
    let x = RB_X;
    while (x < 1840) {
      const big = x > RB_X + 180;
      const r = big ? R.range(46, 78) : R.range(15, 26) * (1 + (x - RB_X) / 900);
      const top = big ? lerp(312, 80, clamp((x - RB_X - 180) / 560)) + R.range(-25, 20) : lerp(380, 340, clamp((x - RB_X) / 180)) + R.range(-8, 8);
      out.push([x, Math.min(top + r, rightEdge(x) - r * 0.45), r]);
      if (R() < 0.7) { const x2 = x - r * R.range(0.3, 0.6), r2 = r * R.range(0.5, 0.7); out.push([x2, Math.min(top + r * R.range(0.55, 0.85), rightEdge(x2) - r2 * 0.45), r2]); }
      x += r * (big ? 0.95 : 1.15);
    }
  }
  return out;
}
const CROWNS = { L: crownsFor(-1), R: crownsFor(1) };
function bankPath(ctx, crowns, edgeFn, mirror, squash = 0.55) {
  const yOf = (x, y) => (mirror ? edgeFn(x) + (edgeFn(x) - y) * squash : y);
  const sorted = crowns.slice().sort((a, b) => a[0] - b[0]);
  ctx.moveTo(sorted[0][0], edgeFn(sorted[0][0]));
  for (const [x, y] of sorted) ctx.lineTo(x, yOf(x, Math.min(y, edgeFn(x))));
  ctx.lineTo(sorted[sorted.length - 1][0], edgeFn(sorted[sorted.length - 1][0]));
  ctx.closePath();
  for (const [x, y, r] of crowns) {
    if (mirror) { ctx.moveTo(x + r, yOf(x, y)); ctx.ellipse(x, yOf(x, y), r, r * squash, 0, 0, TAU); }
    else { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
  }
}
function bankFill(ctx, crowns, edgeFn, mirror, squash = 0.55) {
  ctx.beginPath();
  bankPath(ctx, crowns, edgeFn, mirror, squash);
  ctx.fill();
}
function edgeClip(ctx, below) {
  ctx.beginPath();
  ctx.moveTo(-600, below ? 1200 : -700);
  for (let x = -600; x <= 1900; x += 20) ctx.lineTo(x, edgeAt(x));
  ctx.lineTo(1900, below ? 1200 : -700);
  ctx.closePath();
  ctx.clip();
}
function riverBankReflections(ctx) {
  ctx.save();
  const sh = '#3A1F4A';
  ctx.fillStyle = lg(ctx, 0, HY, 0, HY + 300, [[0, mix(RIV.water1, sh, 0.55)], [0.1, mix(RIV.water1, sh, 0.5)], [0.42, mix(RIV.water2, sh, 0.42)], [0.85, mix(RIV.water3, sh, 0.3)], [1, mix(RIV.water3, sh, 0.25)]]);
  ctx.beginPath();
  bankPath(ctx, CROWNS.L, leftEdge, true);
  bankPath(ctx, CROWNS.R, rightEdge, true);
  ctx.fill();
  // break the mirrored canopy up with thin horizontal water streaks so it reads as a reflection
  ctx.clip();
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let k = 0; k < 30; k++) {
    const y = HY + 6 + 320 * Math.pow(k / 29, 1.6);
    for (let x = -520 + hash1(k * 3.1) * 120; x < 1820;) {
      const len = (30 + hash1(x * 0.37 + k) * 140) * (0.6 + k / 29);
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y);
      x += len + (20 + hash1(x * 0.11 + k * 7) * 90) * (0.6 + k / 29);
    }
  }
  ctx.strokeStyle = rgba(RIV.water1, 0.3);
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.restore();
}
// bank palms: nothing between x 440 and 860 (that band is behind the raft's cast in every shot)
const BANK_PALMS = [[-40, 190, 0.1, 0.035], [96, 150, -0.12, 0.04], [284, 50, 0.12, 0.05], [1085, 56, -0.1, 0.06], [1270, 160, 0.1, 0.04], [1440, 200, -0.08, 0.035]];
function riverBanksStatic(ctx) {
  ctx.save();
  ctx.save();
  edgeClip(ctx, false);
  ctx.fillStyle = RIV.bankL;
  bankFill(ctx, CROWNS.L, leftEdge, false);
  ctx.fillStyle = RIV.bankR;
  bankFill(ctx, CROWNS.R, rightEdge, false);
  ctx.restore();
  // banana-leaf clusters poking out of the canopy
  for (const [cr, n] of [[CROWNS.L, 0], [CROWNS.R, 1]]) {
    cr.forEach(([x, y, r], i) => {
      if (r < 40 || i % 3 !== n) return;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + (k - 1) * 0.6;
        leafPath(ctx, x + (k - 1) * r * 0.3, y - r * 0.7, r * 0.9, r * 0.2, a, k === 1 ? 0 : (k - 1) * 0.6);
        ctx.fillStyle = x < 640 ? '#3E1C48' : '#3A1A44';
        ctx.fill();
      }
    });
  }
  // warm rim light on the crowns facing the sun
  ctx.lineWidth = 2;
  for (const [cr, a] of [[CROWNS.L, 0.18], [CROWNS.R, 0.32]]) {
    ctx.strokeStyle = rgba('#FF9E6E', a);
    ctx.beginPath();
    for (const [x, y, r] of cr) {
      const a0 = x < 640 ? -1.9 : -2.6, a1 = x < 640 ? -0.6 : -1.3;
      ctx.moveTo(x + Math.cos(a0) * (r - 1), y + Math.sin(a0) * (r - 1));
      ctx.arc(x, y, r - 1, a0, a1);
    }
    ctx.stroke();
  }
  ctx.restore();
}
function riverPalms(ctx, t) {
  for (const [px, h, lean, sw] of BANK_PALMS) {
    const left = px < 640;
    const ground = (left ? leftEdge(px) : rightEdge(px)) + 1;
    const base = ground - 11 - (h > 100 ? 60 : 0), s = h > 100 ? 2 : 1.3;
    const col = left ? '#3E1C48' : '#3A1A44';
    // the trunk always reaches down to the bank's water edge (never ends on top of the bushes)
    // (one path with the palm's own trunk base, overlapping it, so there is no AA seam)
    ctx.beginPath();
    ctx.moveTo(px - 2.4 * s + lean * 6, base - 6);
    ctx.lineTo(px - 2.9 * s, ground);
    ctx.lineTo(px + 2.9 * s, ground);
    ctx.lineTo(px + 2.4 * s + lean * 6, base - 6);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    palm(ctx, px, base, h, lean, col, s, t, sw);
  }
}

// sky ---------------------------------------------------------------------------------
function sunOf(o) {
  const s = o.sun && typeof o.sun === 'object' ? o.sun : {};
  const x = clamp(fin(o.sunX, fin(s.x, RIVER.sun.x)), 600, 1040);
  const y = clamp(fin(o.sunY, fin(s.y, RIVER.sun.y)), -200, HY + 20);
  return { x, y, r: RIVER.sun.r };
}
function riverSkyStatic(ctx, sun) {
  ctx.fillStyle = lg(ctx, 0, -320, 0, HY, [[0, SKY.top], [0.3, SKY.hi], [0.6, SKY.mid], [0.84, SKY.low], [1, SKY.hor]]);
  ctx.fillRect(-520, -520, 2340, HY + 540);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-520, -520, 2340, HY + 520);
  ctx.clip();
  glow(ctx, sun.x, sun.y + 10, 540, 300, '#FFC27A', 0.45);
  glow(ctx, sun.x, sun.y, 160, 125, '#FFE6B0', 0.55);
  ctx.restore();
}
function riverStars(ctx, t) {
  ctx.save();
  for (let i = 0; i < 28; i++) {
    const x = -240 + hash1(i * 7.13) * 1800, y = -280 + hash1(i * 3.71) * 340;
    const tw = 0.5 + 0.5 * Math.sin(t * (0.8 + hash1(i) * 1.5) + i);
    const a = (0.25 + 0.55 * tw) * clamp((90 - y) / 200);
    if (a < 0.02) continue;
    circle(ctx, x, y, 0.8 + hash1(i * 1.3) * 1.1);
    ctx.fillStyle = rgba('#FFF4E0', a);
    ctx.fill();
  }
  ctx.restore();
}
// long stratus lenses: billowy top, ragged flattish underside, tapered ends; lit from below by the
// low sun, with a warm rim that is thick on the sun-facing end and dies out on the far end
const CLOUDS = [
  // x, y, w, h, warm (0 = high & cool … 1 = low & sun-lit), drift speed, lumpiness
  [600, 60, 420, 17, 0.25, 1.3, 0.5], [1230, 22, 330, 13, 0.2, 1.0, 0.3], [-160, 112, 340, 22, 0.45, 1.6, 0.9],
  [1110, 128, 400, 19, 0.55, 1.8, 0.8], [245, 196, 230, 12, 0.8, 2.1, 1], [790, 226, 190, 8, 0.95, 2.4, 0.4],
  [1270, 252, 260, 10, 1, 2.2, 0.7],
];
const WISPS = [[470, 104, 340, 2.6], [930, 176, 300, 2.2], [1390, 168, 250, 2.6], [120, 52, 300, 2.4], [700, 264, 200, 1.8], [-60, 214, 230, 2]];
function stratusPath(ctx, x, y, w, h, seed, lump = 0.6, dx = 0, dy = 0) {
  const n = 24, top = [], bot = [];
  const skew = 0.38 + 0.24 * hash1(seed * 3.3);          // where the lens is thickest
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const v = u < skew ? 0.5 * (u / skew) : 0.5 + 0.5 * ((u - skew) / (1 - skew));
    const env = Math.pow(Math.sin(Math.PI * v), 0.85);
    const bump = 1 - lump * (0.42 - 0.3 * Math.abs(Math.sin(u * 6.3 + seed * 1.7)) - 0.22 * Math.abs(Math.sin(u * 14.1 + seed * 2.9)));
    const px = x - w / 2 + u * w + dx;
    top.push([px, y + dy - h * env * bump]);
    const rag = 0.22 + 0.2 * (noise1(u * 9 + seed * 3) * 0.5 + 0.5);
    bot.push([px, y + dy + h * rag * Math.pow(Math.sin(Math.PI * v), 1.4)]);
  }
  ctx.moveTo(top[0][0], top[0][1]);
  splineTo(ctx, top);
  const rb = bot.reverse();
  ctx.lineTo(rb[0][0], rb[0][1]);
  splineTo(ctx, rb);
  ctx.closePath();
}
function riverClouds(ctx, t, sun) {
  ctx.save();
  WISPS.forEach(([cx, cy, w, h], i) => {
    const x = cx + t * (1.4 + (i % 3) * 0.4);
    ctx.beginPath();
    stratusPath(ctx, x, cy, w, h, 40 + i, 0.2);
    ctx.fillStyle = rgba(mix('#B86A9A', '#FFB08A', clamp((cy - 40) / 240)), 0.4);
    ctx.fill();
  });
  CLOUDS.forEach(([cx, cy, w, h, warm, sp, lump], i) => {
    const x = cx + t * sp;
    const toSun = clamp(1 - Math.abs(x - sun.x) / 900);
    const dir = Math.sign(sun.x - x) || 1;
    const rimW = 1.4 + 2.2 * warm + 1.8 * toSun;
    const top = mix('#3E2560', '#7A3A70', warm), bottom = mix('#7A3E78', '#C2567A', warm);
    const lit = mix('#FF9A7E', '#FFD28E', clamp(warm * 0.8 + toSun * 0.4));
    // warm rim (thick at the sun-facing end, fading out at the far end)
    ctx.beginPath();
    stratusPath(ctx, x, cy, w, h, i, lump, dir * (1 + 2 * toSun), rimW);
    ctx.fillStyle = lg(ctx, x - dir * w * 0.5, 0, x + dir * w * 0.5, 0, [[0, rgba(lit, 0.12)], [0.45, rgba(lit, 0.6)], [1, rgba(lit, 0.98)]]);
    ctx.fill();
    // body: soft translucent top, denser warm underside
    ctx.beginPath();
    stratusPath(ctx, x, cy, w, h, i, lump);
    ctx.fillStyle = lg(ctx, 0, cy - h, 0, cy + h * 0.45, [[0, rgba(top, 0.72)], [0.5, rgba(mix(top, bottom, 0.5), 0.9)], [1, rgba(bottom, 0.97)]]);
    ctx.fill();
  });
  ctx.restore();
}
// far hills + treeline (their silhouettes are also used to tuck the sinking sun behind them)
const HILL_STEP = 30, TREE_STEP = 9;
// the far hills dip around Mount Snooze so its cone reads down to the treeline
const hillRaw = (x, vx = VOLC.x) => HY - 14 - (noise1(x * 0.006 + 1.3) * 0.5 + 0.5) * 26 * lerp(0.15, 1, smoothstep(55, 175, Math.abs(x - vx)));
const treeRaw = (x) => HY - 8 - (noise1(x * 0.045 + 7) * 0.5 + 0.5) * 9 - (noise1(x * 0.011) * 0.5 + 0.5) * 6;
function sampled(fn, step, x, a) {
  const i = Math.floor((x + 500) / step), x0 = -500 + i * step;
  return lerp(fn(x0, a), fn(x0 + step, a), (x - x0) / step);
}
const horizonTop = (x, vx = VOLC.x) => Math.min(sampled(hillRaw, HILL_STEP, x, vx), sampled(treeRaw, TREE_STEP, x));
const FAR_PALMS = [[120, 34, 0.15], [1180, 36, -0.08], [1330, 30, 0.12]];
function riverFarStatic(ctx, sun, vol) {
  ctx.beginPath();
  ctx.moveTo(-500, HY + 2);
  for (let x = -500; x <= 1800; x += HILL_STEP) ctx.lineTo(x, hillRaw(x, vol.x));
  ctx.lineTo(1800, HY + 2);
  ctx.closePath();
  ctx.fillStyle = RIV.far;
  ctx.fill();
  // warm rim on the hill tops near the sun
  ctx.save();
  ctx.beginPath();
  for (let x = sun.x - 300; x <= sun.x + 300; x += HILL_STEP) {
    const xs = Math.floor((x + 500) / HILL_STEP) * HILL_STEP - 500;
    if (x === sun.x - 300) ctx.moveTo(xs, hillRaw(xs, vol.x)); else ctx.lineTo(xs, hillRaw(xs, vol.x));
  }
  ctx.strokeStyle = lg(ctx, sun.x - 300, 0, sun.x + 300, 0, [[0, rgba('#FFC890', 0)], [0.5, rgba('#FFC890', 0.7)], [1, rgba('#FFC890', 0)]]);
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(-500, HY + 2);
  for (let x = -500; x <= 1800; x += TREE_STEP) ctx.lineTo(x, treeRaw(x));
  ctx.lineTo(1800, HY + 2);
  ctx.closePath();
  ctx.fillStyle = RIV.tree;
  ctx.fill();
  for (const [px, h, lean] of FAR_PALMS) palm(ctx, px, HY - 8, h, lean, RIV.tree, 0.55);
}
function riverSunDisc(ctx, t, sun, sink, vol = VOLC) {
  const y = sun.y + sink * 38, r = sun.r;
  ctx.save();
  // tucked behind the far hills / treeline, so it can sink below them
  ctx.beginPath();
  const x0 = sun.x - r - 24, x1 = sun.x + r + 24;
  ctx.moveTo(x0, -600);
  for (let x = x0; x <= x1; x += 3) ctx.lineTo(x, horizonTop(x, vol.x));
  ctx.lineTo(x1, -600);
  ctx.closePath();
  ctx.clip();
  glow(ctx, sun.x, y, r * 1.8, r * 1.6, '#FFE6B0', 0.35 * sink);
  circle(ctx, sun.x, y, r);
  ctx.fillStyle = rg(ctx, sun.x - 10, y - 12, 4, r, [[0, '#FFFBE6'], [0.55, '#FFE7A6'], [1, '#FFC46E']]);
  ctx.fill();
  // subtle heat-haze bands across the lower disc
  circle(ctx, sun.x, y, r);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,170,100,0.32)';
  for (let i = 0; i < 3; i++) ctx.fillRect(sun.x - r, y + 18 + i * 9 + Math.sin(t * 1.3 + i) * 1.2, r * 2, 2 + i);
  ctx.restore();
}

// Mount Snooze, tiny and far, still smoking ------------------------------------------
const RIVER_SNOOZE = {
  lit: '#BC7A98', mid: '#A26488', shade: '#7A4878', light: 1,
  ridgeLit: rgba('#F4A6A2', 0.34), ridgeDark: rgba('#4E2654', 0.3), edge: rgba('#4E2654', 0.6),
  rim: '#A86B90', rimLit: '#F6AE92', crater: '#3A1C3C', baseTint: '#C97C92',
  extra(ctx, X, s) {
    // cooled lava tongue down the flank (dark crust, faint glowing cracks)
    const pts = SNOOZE_LAVA.map(X);
    ctx.beginPath();
    ribbonPath(ctx, pts, 10 * s, 40 * s, 0);
    ctx.fillStyle = rgba('#FF6A3A', 0.16);
    ctx.fill();
    ctx.beginPath();
    ribbonPath(ctx, pts, 7 * s, 30 * s, 0);
    ctx.fillStyle = rgba('#5A2A4C', 0.62);
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const j = (hash1(i * 3.7) - 0.5) * 2.4 * s * 3;
      ctx.moveTo(ax, ay);
      ctx.lineTo((ax + bx) / 2 + j, (ay + by) / 2);
      ctx.lineTo(bx, by);
    }
    ctx.strokeStyle = rgba('#FF7A40', 0.5);
    ctx.lineWidth = Math.max(0.5, 2.6 * s);
    ctx.stroke();
    // the burnt orange grove: a scorched patch low on the left flank
    const [gx, gy] = X([700, 330]);
    glow(ctx, gx, gy, 90 * s, 22 * s, '#3A1838', 0.55);
  },
};
// crater position: RIVER.volcano, or o.volcano {x,y} (a per-shot cheat, e.g. to put the mountain
// right behind Barry's shoulder in a tight close-up). Rounded so the static-layer cache key is stable.
function volcOf(o) {
  const v = o.volcano && typeof o.volcano === 'object' ? o.volcano : {};
  return { x: Math.round(clamp(fin(v.x, VOLC.x), 120, 1180)), y: Math.round(clamp(fin(v.y, VOLC.y), 300, 372)) };
}
// the cone, squashed vertically about the crater by RIVER_SNOOZE_K
function riverVolcanoXf(ctx, vol) {
  ctx.translate(vol.x, vol.y);
  ctx.scale(1, RIVER_SNOOZE_K);
  ctx.translate(-vol.x, -vol.y);
}
const volcBase = (vol) => vol.y + (HY + 6 - vol.y) / RIVER_SNOOZE_K;   // base line in the squashed space
function riverVolcanoStatic(ctx, vol) {
  ctx.save();
  riverVolcanoXf(ctx, vol);
  drawSnoozeCone(ctx, vol.x, vol.y, RIVER_SNOOZE_S, volcBase(vol), RIVER_SNOOZE);
  ctx.restore();
  // aerial perspective: a hazy sky-coloured veil over the far cone, thicker towards its foot
  ctx.save();
  ctx.beginPath();
  ctx.save();
  riverVolcanoXf(ctx, vol);
  snoozeOutlineTrace(ctx, vol.x, vol.y, RIVER_SNOOZE_S, volcBase(vol));
  ctx.restore();
  ctx.fillStyle = lg(ctx, 0, vol.y - 6, 0, HY, [[0, rgba('#F08C80', 0.06)], [1, rgba('#F7A07A', 0.3)]]);
  ctx.fill();
  ctx.restore();
}
// smoke column: noise-edged blobs merged into one path per tone, filled with gradients that fade
// to alpha 0 along the column (composited over the real sky). Puffs are born tiny in the crater
// mouth, rise ≈80 units almost straight up (so a close-up holds crater + column), then bend
// downwind to the upper LEFT — away from the raft, mast, flag and sun — spreading into a soft
// drifting plume; puffs shrink to nothing before they recycle — no popping.
const RSM = { N: 50, Lp: 18, CX: -8, CY: -190, EX: -205, EY: -158 };
// centre line: quadratic from the crater (straight up first) bending into a slightly sagging plume
function riverSmokePuffs(t, amt, v) {
  const { N, Lp, CX, CY, EX, EY } = RSM;
  const puffs = [];
  for (let i = 0; i < N; i++) {
    const k = frac(t / Lp + (i + 0.7 * hash1(i * 4.3)) / N);
    const a = Math.pow(k, 1.4);
    const u = 1 - a;
    const px = 2 * a * u * CX + a * a * EX, py = u * u * -2 + 2 * a * u * CY + a * a * EY;
    // tangent → perpendicular for a lateral wobble that grows with the puff
    const tx = 2 * u * CX + 2 * a * (EX - CX), ty = 2 * u * (CY + 2) + 2 * a * (EY - CY);
    const tl = Math.hypot(tx, ty) || 1;
    const size = (0.74 + 0.5 * hash1(i * 9.7)) * (0.72 + 0.28 * Math.min(1, amt));
    const r = (5.8 + 20 * Math.pow(a, 0.85)) * size * (1 - smoothstep(0.82, 1, k)) * smoothstep(0, 0.012, k);
    const wob = (noise1(i * 3.7 + t * 0.15) * 0.6 + (hash1(i * 6.1) - 0.5)) * r * 0.7 * smoothstep(0.02, 0.3, a);
    const bend = smoothstep(0.3, 0.85, a);
    puffs.push({
      x: v.x + px - (ty / tl) * wob, y: v.y + py + (tx / tl) * wob,
      r, sx: 1 + 0.8 * bend, sy: 1 - 0.22 * bend, seed: i * 1.91,
    });
  }
  // a permanent stem so the column always grows out of the crater mouth
  const sz = 0.72 + 0.28 * Math.min(1, amt);
  puffs.push({ x: v.x + noise1(t * 0.9) * 0.8, y: v.y - 3, r: 4.6 * sz, sx: 1.25, sy: 0.75, seed: 91.3 });
  puffs.push({ x: v.x - 1 + noise1(t * 0.8 + 5) * 1.2, y: v.y - 9, r: 5.4 * sz, seed: 77.7 });
  return puffs;
}
function riverSmoke(ctx, t, o, v = volcOf(o)) {
  const amt = clamp(fin(o.smoke, 1), 0, 1.5);
  if (amt <= 0.005) return;
  const puffs = riverSmokePuffs(t, amt, v);
  const a = Math.min(1, amt);
  const gx0 = v.x, gy0 = v.y, gx1 = v.x + RSM.EX * 0.95, gy1 = v.y + RSM.EY * 1.05;
  const fade = (c, m) => [[0, rgba(c, a * m)], [0.3, rgba(c, a * m * 0.9)], [0.7, rgba(c, a * m * 0.42)], [1, rgba(c, 0)]];
  ctx.save();
  // soft outer haze (softens the scalloped edge), body, shadowed core, warm sun-side (right)
  blobsPath(ctx, puffs, 1.22, 0, 0, t);
  ctx.fillStyle = lg(ctx, gx0, gy0, gx1, gy1, fade('#7A4A72', 0.22));
  ctx.fill();
  blobsPath(ctx, puffs, 1, 0, 0, t);
  ctx.fillStyle = lg(ctx, gx0, gy0, gx1, gy1, fade('#52325A', 0.8));
  ctx.fill();
  blobsPath(ctx, puffs, 0.6, 0.34, -0.1, t);
  ctx.fillStyle = lg(ctx, gx0, gy0, gx1, gy1, fade('#D9837A', 0.42));
  ctx.fill();
  ctx.restore();
}
function riverCraterGlow(ctx, t, o, v = volcOf(o)) {
  const gl = clamp(fin(o.glow, 1), 0, 2);
  if (gl <= 0.01) return;
  const s = RIVER_SNOOZE_S / 0.36;
  const pulse = 0.75 + 0.25 * Math.sin(t * 1.7) + 0.1 * noise1(t * 3);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  glow(ctx, v.x, v.y - 3, 40 * s, 22 * s, '#FF5A2A', 0.55 * gl * pulse);
  ctx.restore();
  ellipse(ctx, v.x, v.y + 1, 10, 1.5);
  ctx.fillStyle = rgba('#FF8A4A', clamp(0.9 * gl));
  ctx.fill();
}

// water ----------------------------------------------------------------------------------
function waterStatic(ctx, sun, vol) {
  ctx.fillStyle = lg(ctx, 0, HY, 0, 900, WATER_STOPS);
  ctx.fillRect(-520, HY, 2340, 920);
  // far-water reflection of the treeline + Mount Snooze (+ a faint lava streak)
  ctx.fillStyle = rgba('#7E3F6E', 0.5);
  ctx.fillRect(-520, HY, 2340, 5);
  const v = vol;
  ctx.beginPath();
  ctx.moveTo(v.x - 62, HY + 1);
  ctx.bezierCurveTo(v.x - 32, HY + 7, v.x - 16, HY + 20, v.x - 6, HY + 30);
  ctx.lineTo(v.x + 6, HY + 30);
  ctx.bezierCurveTo(v.x + 17, HY + 20, v.x + 36, HY + 7, v.x + 66, HY + 1);
  ctx.closePath();
  ctx.fillStyle = rgba('#8A527E', 0.26);
  ctx.fill();
  ctx.fillStyle = rgba('#FF6A3A', 0.2);
  ctx.fillRect(v.x - 2, HY + 24, 4, 12);
  // faint reflections of the lit cloud undersides
  ctx.save();
  ctx.lineCap = 'round';
  for (const [cx, cy, w] of CLOUDS) {
    const ry = HY + (HY - cy) * 0.42;
    line(ctx, cx - w * 0.42, ry, cx + w * 0.42, ry);
    ctx.strokeStyle = rgba('#FFB38A', 0.1);
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
}
// ripples drifting with the current + the shimmering sun column (only on open water)
function waterLive(ctx, t, o, sun, band) {
  const flow = clamp(fin(o.flow, 1), -20, 20);
  const B = band;   // optional cull box {x0,x1,y0,y1}
  const inB = (xa, xb, y) => !B || (y > B.y0 - 6 && y < B.y1 + 6 && xb > B.x0 && xa < B.x1);
  const open = (xa, xb, y) => y > edgeAt(xa) + 1.5 && y > edgeAt(xb) + 1.5;
  ctx.save();
  ctx.lineCap = 'round';
  const rows = 34;
  const light = [], dark = [];
  for (let i = 0; i < rows; i++) {
    const k = i / (rows - 1);
    const y = HY + 6 + Math.pow(k, 1.7) * 520;
    const persp = 0.25 + k * 1.6;
    const n = 6 + Math.floor(hash1(i * 1.7) * 4);
    for (let j = 0; j < n; j++) {
      const span = 2400;
      const x0 = -500 + ((hash1(i * 13.1 + j * 7.7) * span + t * 9 * persp * flow + j * (span / n)) % span + span) % span;
      const len = (14 + hash1(i * 3.3 + j) * 46) * persp;
      const yy = y + Math.sin(t * 1.3 + j * 2 + i) * 0.8 * persp;
      if (!inB(x0, x0 + len, yy) || !open(x0, x0 + len, yy)) continue;
      ((i + j) % 3 !== 0 ? light : dark).push([x0, yy, len, k, persp]);
    }
  }
  // batch by style (fewer state changes): light rows grouped in 3 alpha bands
  for (let b = 0; b < 3; b++) {
    ctx.beginPath();
    let lw = 0, cnt = 0;
    for (const [x0, yy, len, k, persp] of light) {
      if (Math.min(2, Math.floor(k * 3)) !== b) continue;
      ctx.moveTo(x0, yy); ctx.lineTo(x0 + len, yy);
      lw += 0.8 + persp * 1.1; cnt++;
    }
    if (!cnt) continue;
    ctx.strokeStyle = rgba('#FFC6A8', 0.17 + 0.08 * (b + 0.5) / 3);
    ctx.lineWidth = lw / cnt;
    ctx.stroke();
  }
  for (let b = 0; b < 3; b++) {
    ctx.beginPath();
    let lw = 0, cnt = 0;
    for (const [x0, yy, len, k, persp] of dark) {
      if (Math.min(2, Math.floor(k * 3)) !== b) continue;
      ctx.moveTo(x0, yy); ctx.lineTo(x0 + len, yy);
      lw += 0.8 + persp * 1.1; cnt++;
    }
    if (!cnt) continue;
    ctx.strokeStyle = rgba('#2E1A48', 0.22);
    ctx.lineWidth = lw / cnt;
    ctx.stroke();
  }
  // shimmering reflection column of the sun
  ctx.globalCompositeOperation = 'screen';
  const N = 30;
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
      if (a < 0.02 || !inB(cx - len / 2, cx + len / 2, y) || !open(cx - len / 2, cx + len / 2, y)) continue;
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
  if (!(amt > 0)) return;
  amt = Math.min(amt, 3);
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
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const x = 860 + ((t * 7 + i * 26) % 900) - 300 + i * 14, y = 162 + i * 8 + Math.sin(t * 0.7 + i) * 4;
    const f = Math.sin(t * 7 + i * 2);
    const s = 5 - i;
    ctx.moveTo(x - s, y - f * s * 0.6);
    ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.2, x, y);
    ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.2, x + s, y - f * s * 0.6);
  }
  ctx.strokeStyle = rgba('#3A2148', 0.85);
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.restore();
}
function raftOpts(o) {
  return {
    x: clamp(fin(o.raftX, RIVER.raftPos.x), -2000, 4000),
    y: clamp(fin(o.raftY, RIVER.raftPos.y), -2000, 4000),
    w: clamp(fin(o.raftW, 330), 0, 3000),
  };
}
function raftShadow(ctx, t, o) {
  const { x, y, w } = raftOpts(o);
  if (w <= 0) return;
  ellipse(ctx, x, y + 12, w * 0.54, 14);
  ctx.fillStyle = rgba('#2A1840', 0.22);
  ctx.fill();
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const p = frac(t * 0.28 + i / 3);
    ctx.beginPath();
    ctx.ellipse(x, y + 2, w * 0.5 + 16 + p * 130, 9 + p * 26, 0, Math.PI, TAU);
    ctx.strokeStyle = rgba('#FFC6A8', (1 - p) * 0.3);
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  ctx.restore();
}

function riverStatic(ctx, sun, vol = VOLC) {
  riverSkyStatic(ctx, sun);
  riverVolcanoStatic(ctx, vol);
  riverFarStatic(ctx, sun, vol);
  waterStatic(ctx, sun, vol);
  riverBankReflections(ctx);
  riverBanksStatic(ctx);
}
function drawRiverSunset(ctx, t, o) {
  t = fin(t, 0);
  o = optsOf(o);
  if (!finiteCtx(ctx)) return;
  const sun = sunOf(o);
  const sink = clamp(fin(o.sunset, 0));
  ctx.save();
  const vol = volcOf(o);
  if (o.cache === false) riverStatic(ctx, sun, vol);
  else drawCached(ctx, 'river|' + sun.x + ',' + sun.y + '|' + vol.x + ',' + vol.y, (c) => riverStatic(c, sun, vol));
  riverStars(ctx, t);
  riverSunDisc(ctx, t, sun, sink, vol);
  riverClouds(ctx, t, sun);
  riverSmoke(ctx, t, o, vol);
  riverCraterGlow(ctx, t, o, vol);
  waterLive(ctx, t, o, sun, null);
  riverPalms(ctx, t);
  if (o.birds !== false) riverBirds(ctx, t);
  riverLilies(ctx, t);
  if (o.raft !== false) raftShadow(ctx, t, o);
  riverAsh(ctx, t, clamp(fin(o.ash, 0.35), 0, 3), false);
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
  ctx.beginPath();
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

function drawRiverFront(ctx, t, o) {
  t = fin(t, 0);
  o = optsOf(o);
  if (!finiteCtx(ctx)) return;
  const { x, y, w } = raftOpts(o);
  ctx.save();
  if (w > 0) {
    // thin lapping strip just under the waterline: hides the raft's submerged edge, feathered
    // downwards and at both ends so the reflection below stays strongest right under the raft
    const hw = w / 2 + 26, depth = 15;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x - hw, y + depth);
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const xx = lerp(x - hw, x + hw, i / n);
      ctx.lineTo(xx, y + 2.5 + Math.sin(xx * 0.06 + t * 2.4) * 1.5 + Math.sin(xx * 0.13 - t * 3.1) * 0.8);
    }
    ctx.lineTo(x + hw, y + depth);
    ctx.closePath();
    ctx.translate(x, y + 1);
    ctx.scale(hw / depth, 1);
    const wc = mix(waterColorAt(y + 6), '#3A1F4A', 0.18);
    ctx.fillStyle = rg(ctx, 0, 0, 0, depth, [[0, rgba(wc, 0.86)], [0.5, rgba(wc, 0.72)], [0.8, rgba(wc, 0.3)], [1, rgba(wc, 0)]]);
    ctx.fill();
    ctx.restore();
    // waterline glints + foam lapping at the raft
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      const xx = lerp(x - w / 2 + 6, x + w / 2 - 6, (i + 0.5) / 16) + Math.sin(t * 1.7 + i) * 3;
      const yy = y + 3 + Math.sin(xx * 0.06 + t * 2.4) * 1.5;
      const a = 0.35 + 0.35 * Math.sin(t * 3.1 + i * 1.9);
      line(ctx, xx - 6, yy, xx + 6, yy);
      ctx.strokeStyle = rgba('#FFE2B8', a);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (o.wake !== false) {
      for (let i = 0; i < 3; i++) {
        const p = frac(t * 0.28 + i / 3);
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
  }
  riverAsh(ctx, t, clamp(fin(o.ash, 0.35), 0, 3), true);
  if (o.foreground !== false) riverForeground(ctx, t);
  const gr = clamp(fin(o.grade, 0), 0, 1);
  if (gr > 0) riverGrade(ctx, t, o, gr);
  ctx.restore();
}
// sunset colour grade over everything already drawn (sits daylight-coloured characters into the
// light): ONE multiply pass — near-white warm around the sun, deepening to lilac away from it.
// The full-strength grade is rendered once per (canvas size, sun position on screen, snapped to
// 16 px) into a screen-space canvas and blitted with alpha = strength (multiply at alpha k equals
// multiplying by mix(white, grade, k)), so it costs one 1:1 blit (≈2 ms at 1080p) instead of a
// full-frame radial-gradient fill (≈10 ms), also during camera drift.
const _grades = new Map();
function riverGrade(ctx, t, o, k) {
  const sun = sunOf(o);
  const m = ctx.getTransform();
  const cw = (ctx.canvas && ctx.canvas.width) || 0, ch = (ctx.canvas && ctx.canvas.height) || 0;
  const sxD = m.a * sun.x + m.c * (sun.y + 30) + m.e, syD = m.b * sun.x + m.d * (sun.y + 30) + m.f;
  const scl = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
  const stops = [[0, '#FFF0DE'], [0.25, mix('#FFFFFF', '#F6CCC6', 0.8)], [0.6, mix('#FFFFFF', '#C8A6D6', 0.7)], [1, mix('#FFFFFF', '#9C88C8', 0.75)]];
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = clamp(k);
  if (!cw || !ch) {
    ctx.fillStyle = rg(ctx, sun.x, sun.y + 30, 40, 1150, stops);
    ctx.fillRect(-700, -700, 2700, 2200);
    ctx.restore();
    return;
  }
  const qx = Math.round(sxD / 16) * 16, qy = Math.round(syD / 16) * 16, qs = Math.round(scl * 8) / 8;
  const key = cw + 'x' + ch + '|' + qx + ',' + qy + '|' + qs;
  let g = _grades.get(key);
  if (!g) {
    g = napi().createCanvas(cw, ch);
    const gx = g.getContext('2d');
    gx.fillStyle = rg(gx, qx, qy, 40 * qs, 1150 * qs, stops);
    gx.fillRect(0, 0, cw, ch);
    _grades.set(key, g);
    if (_grades.size > 3) _grades.delete(_grades.keys().next().value);
  } else { _grades.delete(key); _grades.set(key, g); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(g, 0, 0);
  ctx.restore();
}

// Mirror-draw fn into the water as a rippled reflection (scratch canvas; fn called once).
// The mirrored image is blitted in thin strips (≈3.5 device px each, so close-ups stay smooth),
// each shifted by a smooth function of depth (no stair-steps) and faded continuously.
let _scratch = null;
function drawRiverReflection(ctx, t, o, fn) {
  t = fin(t, 0);
  o = optsOf(o);
  if (!finiteCtx(ctx) || typeof fn !== 'function') return;
  const m = ctx.getTransform();
  const cw = (ctx.canvas && ctx.canvas.width) || 1920, ch = (ctx.canvas && ctx.canvas.height) || 1080;
  if (!_scratch || _scratch.width !== cw || _scratch.height !== ch) _scratch = napi().createCanvas(cw, ch);
  const sx = _scratch.getContext('2d');
  sx.save();
  sx.setTransform(1, 0, 0, 1, 0, 0);
  sx.clearRect(0, 0, cw, ch);
  sx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
  try { fn(sx); } finally { sx.restore(); }
  // o.drawSource: also composite fn's own (un-mirrored) drawing at 1:1 after the reflection, so the
  // caller does not render the raft + cast a second time (pixel-equivalent: same device transform,
  // integer blit; only source-over drawing is assumed, which the characters/props use)
  const blitSource = () => {
    if (!o.drawSource) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(_scratch, 0, 0);
    ctx.restore();
  };
  const yW = fin(o.y, RIVER.raftPos.y);
  const depth = clamp(fin(o.depth, 150), 0, 2000);
  const alpha = clamp(fin(o.alpha, 0.45));
  if (depth <= 0 || alpha <= 0) { blitSource(); return; }
  const sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
  const wy = m.b * 640 + m.d * yW + m.f;                // device-space waterline (assumes ~no rotation)
  const dd = depth * sc;
  let xa = o.x0 == null ? 0 : m.a * fin(o.x0, 0) + m.e, xb = o.x1 == null ? cw : m.a * fin(o.x1, 1280) + m.e;
  if (xa > xb) [xa, xb] = [xb, xa];
  xa = Math.max(0, Math.floor(xa)); xb = Math.min(cw, Math.ceil(xb));
  if (xb - xa < 1) { blitSource(); return; }
  const hs = sc > 2.2 ? 4 : 3;                          // whole device rows: no overlap, no seams
  const wyi = Math.round(wy);
  const strips = Math.min(600, Math.ceil(dd / hs));
  const damp = 1 / (1 + 0.35 * Math.max(0, sc - 1.5));   // gentler wobble in close-ups
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';
  for (let i = 0; i < strips; i++) {
    const y0 = wyi + i * hs;
    if (y0 >= ch) break;
    const h = hs;
    const srcTop = 2 * wyi - (y0 + h);
    if (srcTop < 0 || srcTop + h > ch || y0 + h < 0) continue;
    const k = (i * hs) / dd;
    const yu = (i * hs) / sc;                           // world units below the waterline
    const off = (Math.sin(yu * 0.42 - t * 2.3) * 0.65 + Math.sin(yu * 0.17 + t * 1.4 + 1.3) * 0.35) * (0.25 + 2.6 * k) * sc * damp;
    const a = alpha * Math.pow(1 - k, 1.3) * (0.9 + 0.1 * Math.sin(yu * 0.31 + t * 1.7));
    if (a < 0.004) continue;
    ctx.globalAlpha = a;
    ctx.save();
    ctx.translate(off, y0 + h);
    ctx.scale(1, -1);
    ctx.drawImage(_scratch, xa, srcTop, xb - xa, h, xa, 0, xb - xa, h);
    ctx.restore();
  }
  ctx.restore();
  blitSource();
}

// ════════════════════════════════════════════════════════════ TITLE CARDS
const numOr = (v, d) => (typeof v === 'number' && !Number.isNaN(v) ? v : d);   // allows ±Infinity
function cardAlpha(t, o) {
  const fi = Math.max(0, fin(o.fadeIn, 0)), fo = Math.max(0, fin(o.fadeOut, 0)), dur = numOr(o.dur, Infinity);
  let a = 1;
  if (fi > 0) a = Math.min(a, clamp(t / fi));
  if (fo > 0 && isFinite(dur)) a = Math.min(a, clamp((dur - t) / fo));
  if (isFinite(dur) && t > dur) a = 0;
  return a;
}
const lineObj = (l) => {
  if (l == null) return { text: '' };
  if (typeof l !== 'object') return { text: String(l) };
  return { ...l, text: l.text == null ? '' : String(l.text) };
};
// draw text centred with letter spacing (compensates the trailing space)
function spacedText(ctx, text, x, y, spacing) {
  ctx.letterSpacing = spacing + 'px';
  const w = ctx.measureText(text).width;
  ctx.textAlign = 'left';
  ctx.fillText(text, x - (w - spacing) / 2, y);
  ctx.letterSpacing = '0px';
  return w - spacing;
}
const isCaps = (s) => /[A-Z]/.test(s) && s === s.toUpperCase();
// width of `text` at the current font with letter spacing `sp` (trailing space excluded)
function spacedWidth(ctx, text, sp) {
  ctx.letterSpacing = sp + 'px';
  const w = ctx.measureText(text).width - (text ? sp : 0);
  ctx.letterSpacing = '0px';
  return w;
}
// balanced line breaking: as few rows as fit maxW, then the break set with the most even widths
// (a break after . , ; : — is preferred). Explicit '\n' always breaks.
function wrapBalanced(ctx, text, maxW, sp) {
  const out = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    const W = (i, j) => spacedWidth(ctx, words.slice(i, j).join(' '), sp);
    if (W(0, words.length) <= maxW) { out.push(words.join(' ')); continue; }
    // dynamic programming over break positions: cost = squared slack + punctuation bonus
    const n = words.length, best = new Array(n + 1).fill(Infinity), prev = new Array(n + 1).fill(0), rows = new Array(n + 1).fill(0);
    best[0] = 0;
    let total = W(0, n);
    for (let j = 1; j <= n; j++) {
      for (let i = j - 1; i >= 0; i--) {
        const w = W(i, j);
        if (w > maxW && j - i > 1) break;
        const target = total / Math.max(1, Math.ceil(total / maxW));
        const punct = /[.,;:!?—]$/.test(words[j - 1]) && j < n ? -0.35 : 0;
        const c = best[i] + Math.pow((target - Math.min(w, maxW)) / maxW, 2) + 0.6 + punct * 0.5;
        if (c < best[j]) { best[j] = c; prev[j] = i; rows[j] = rows[i] + 1; }
      }
    }
    const segs = [];
    for (let j = n; j > 0; j = prev[j]) segs.unshift(words.slice(prev[j], j).join(' '));
    out.push(...segs);
  }
  return out;
}
// Woody-Allen card: white serif on black, centred. All-caps lines are tracked (~0.14em), mixed /
// lower-case lines are set nearly solid (0.01em). Long lines wrap (balanced) at o.wrap (980).
// Per-line {at, fade} reveal a line later on the same card (e.g. 'THE END' after the title).
function woodyCard(ctx, t, o, a) {
  if (o.bg !== false) {
    ctx.fillStyle = typeof o.bg === 'string' ? o.bg : '#000';
    ctx.fillRect(-600, -600, 2480, 1920);
  }
  const lines = (Array.isArray(o.lines) && o.lines.length ? o.lines : ['CHILL CAPYBARA']).map(lineObj);
  const big = clamp(fin(o.size, 74), 8, 300);
  const maxW = clamp(fin(o.wrap, 980), 200, 1240);
  const fam = (l) => (typeof l.font === 'string' ? l.font : 'Yeseva');
  // lay out every line (rows, sizes) up-front so late lines never shift the earlier ones
  const L = lines.map((l, i) => {
    let sz = clamp(fin(l.size, i === 0 ? big : Math.max(40, big * 0.55)), 6, 300);
    const caps = isCaps(l.text);
    const spK = () => (l.spacing != null ? fin(l.spacing, 0) : sz * (caps ? 0.14 : 0.01));
    ctx.font = `400 ${sz}px ${fam(l)}`;
    let rows = wrapBalanced(ctx, l.text, clamp(fin(l.wrap, maxW), 100, 1240), spK());
    // a single unbreakable row that is still too wide shrinks to fit
    const widest = Math.max(1, ...rows.map((r) => spacedWidth(ctx, r, spK())));
    if (widest > 1180) { sz *= 1180 / widest; ctx.font = `400 ${sz}px ${fam(l)}`; rows = wrapBalanced(ctx, l.text, 1180, spK()); }
    return { l, sz, rows, sp: spK() };
  });
  let y = 0;
  const base = [];
  L.forEach((e, i) => {
    e.rows.forEach((r, j) => {
      if (i === 0 && j === 0) y = e.sz * 0.72;
      else if (j === 0) y += e.l.gap != null ? fin(e.l.gap, 0) : L[i - 1].sz * 0.32 + e.sz * 1.02;
      else y += e.sz * 1.24;
      base.push([i, r, y]);
    });
  });
  const total = y + L[L.length - 1].sz * 0.24;
  const y0 = 360 - total / 2;
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  for (const [i, r, yy] of base) {
    const e = L[i];
    let la = 1;
    if (e.l.at != null) la = clamp((t - fin(e.l.at, 0)) / Math.max(0.01, fin(e.l.fade, 0.5)));
    if (la <= 0 || !r) continue;
    ctx.globalAlpha = a * la;
    ctx.font = `400 ${e.sz}px ${fam(e.l)}`;
    ctx.fillStyle = typeof e.l.color === 'string' ? e.l.color : '#FFFFFF';
    spacedText(ctx, r, 640, y0 + yy, e.sp);
  }
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
// One title letter (extruded shadow, outline, sunset gradient, gloss stripe) is ~10 large text
// draws; the finished letter is a pure function of (char, size, device scale), so it is rendered
// once into a small bitmap at device resolution and then only blitted (pop-in scale/rotation and
// the wave are applied to the blit). ~23 ms → ~8 ms per frame for the groovy card at 1080p.
const _glyphs = new Map();
function groovyLetter(ch, fs, w, dev) {
  dev = Math.min(dev, 2400 / Math.max(1, fs * 1.6));         // keep the bitmap a sane size
  const key = ch + '|' + fs.toFixed(2) + '|' + dev.toFixed(3);
  let g = _glyphs.get(key);
  if (g) return g;
  const depth = Math.max(4, fs * 0.07);
  const padX = fs * 0.12, top = fs * 1.02, bot = fs * 0.42 + depth;
  const x0 = -w / 2 - padX, x1 = w / 2 + padX + depth;
  const cw = Math.max(1, Math.ceil((x1 - x0) * dev)), chh = Math.max(1, Math.ceil((top + bot) * dev));
  const cv = napi().createCanvas(cw, chh);
  const c = cv.getContext('2d');
  c.setTransform(dev, 0, 0, dev, -x0 * dev, top * dev);
  c.font = `400 ${fs}px Shrikhand`;
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  c.lineJoin = 'round';
  for (let d = depth; d >= 1; d -= 1) {
    c.fillStyle = d === depth ? '#14081C' : mix('#7A2A5A', '#C2406A', 1 - d / depth);
    c.fillText(ch, -w / 2 + d * 0.7, d);
  }
  c.strokeStyle = '#2A0F33';
  c.lineWidth = fs * 0.075;
  c.strokeText(ch, -w / 2, 0);
  c.fillStyle = groovyTitleFill(c, -fs * 0.78, fs * 0.05);
  c.fillText(ch, -w / 2, 0);
  c.save();
  c.beginPath();
  c.rect(-w, -fs * 0.62, w * 2, fs * 0.09);
  c.clip();
  c.fillStyle = 'rgba(255,255,240,0.55)';
  c.fillText(ch, -w / 2, 0);
  c.restore();
  g = { cv, x0, y0: -top, w: (x1 - x0), h: top + bot };
  _glyphs.set(key, g);
  if (_glyphs.size > 160) _glyphs.delete(_glyphs.keys().next().value);
  return g;
}
// the card's static backdrop (flat colour + radial glow, + the risen sun's halo once it has
// settled): cached like the environments
const G_R0 = 196;
function groovySunGlow(ctx, SX, sy, HZ, a) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(-600, -600, 2480, HZ + 600);
  ctx.clip();
  glow(ctx, SX, sy, G_R0 * 1.9, G_R0 * 1.5, '#FF8A5A', 0.35 * a, 'screen');
  ctx.restore();
}
function groovyBackdrop(ctx, bg, SX, HZ, sunUp) {
  drawCached(ctx, 'groovybg|' + bg + (sunUp ? '|sun' : ''), (c) => {
    c.fillStyle = bg;
    c.fillRect(-600, -600, 2480, 1920);
    c.fillStyle = rg(c, SX, HZ - 40, 40, 900, [[0, '#5A2458'], [0.45, '#3A1846'], [1, bg]]);
    c.fillRect(-600, -600, 2480, 1920);
    if (sunUp) groovySunGlow(c, SX, HZ, HZ, 1);
  });
}
// the 70s striped sun as ONE analytic path (bands intersected with the disc): no AA path clip
function sunBandsPath(ctx, SX, sy, R, bands) {
  ctx.beginPath();
  for (let [ya, yb] of bands) {
    ya = Math.max(ya, sy - R); yb = Math.min(yb, sy + R);
    if (yb - ya < 0.05) continue;
    const pa = Math.asin(clamp((ya - sy) / R, -1, 1)), pb = Math.asin(clamp((yb - sy) / R, -1, 1));
    ctx.moveTo(SX + R * Math.cos(pa), ya);
    ctx.arc(SX, sy, R, pa, pb, false);
    ctx.lineTo(SX - R * Math.cos(pb), yb);
    ctx.arc(SX, sy, R, Math.PI - pb, Math.PI - pa, false);
    ctx.closePath();
  }
}
// orange flight for the groovy card: {u (flight 0..1), b (bounce height), sq (squash), rot} or null
const HOP = { t0: 1.3, ti: 2.0, bounces: [[0.07, 0.34, 20], [0.06, 0.2, 7], [0.05, 0.12, 2.5]] };
function orangeHop(t) {
  if (t < HOP.t0) return null;
  if (t < HOP.ti) {
    const u = (t - HOP.t0) / (HOP.ti - HOP.t0);
    return { u, b: 0, sq: -0.07 * smoothstep(0.75, 1, u), rot: 0.15 - 4 * (1 - u) };
  }
  let tau = t - HOP.ti, b = 0, sq = 0;
  for (const [hold, per, amp] of HOP.bounces) {
    if (tau < hold) { sq = (amp / 20) * 0.2 * Math.sin(Math.PI * tau / hold); tau = -1; break; }
    tau -= hold;
    if (tau < per) { b = amp * Math.sin(Math.PI * tau / per); sq = -0.04 * (amp / 20) * Math.sin(Math.PI * tau / per); tau = -1; break; }
    tau -= per;
  }
  const since = t - HOP.ti;
  return { u: 1, b, sq, rot: 0.15 + 0.12 * Math.exp(-3 * since) * Math.sin(since * 12) };
}
function groovyCard(ctx, t, o, a) {
  const lines = o.lines && o.lines.length ? o.lines.map(lineObj) : [];
  const title = (lines[0] && lines[0].text) || 'Chill Capybara';
  const sub = o.sub != null ? o.sub : lines[1] ? lines[1].text : 'THE END';
  const bg = o.bg || '#1E0F2A';
  ctx.save();
  // background
  const HZ = 488, SX = 640;
  const rise = ease.outCubic(clamp(t / 1.5));
  const R0 = G_R0, sy = HZ + (1 - rise) * (R0 + 30);
  if (o.cache === false) {
    ctx.fillStyle = bg;
    ctx.fillRect(-600, -600, 2480, 1920);
    ctx.fillStyle = rg(ctx, SX, HZ - 40, 40, 900, [[0, '#5A2458'], [0.45, '#3A1846'], [1, bg]]);
    ctx.fillRect(-600, -600, 2480, 1920);
  } else groovyBackdrop(ctx, bg, SX, HZ, rise >= 1);
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
  if (o.cache === false || rise < 1) groovySunGlow(ctx, SX, sy, HZ, rise);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-600, -600, 2480, HZ + 600);
  ctx.clip();
  const sunFill = lg(ctx, 0, sy - R0, 0, HZ, [[0, '#FFE88A'], [0.45, '#FFB04E'], [0.8, '#FF7458'], [1, '#E8506E']]);
  ctx.fillStyle = sunFill;
  // stripes: gaps grow towards the horizon, and scroll down slowly
  const gapStart = HZ - 120;
  const bands = [[sy - R0, gapStart]];
  const scroll = (t * 6) % 22;
  for (let i = 0; i < 8; i++) {
    const ya = gapStart + i * 22 + scroll - 22;
    const gap = 2 + i * 1.6;
    bands.push([Math.max(ya, gapStart), ya + 22 - gap]);
  }
  sunBandsPath(ctx, SX, sy, R0, bands);
  ctx.fill();
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
  // the orange arcs in from off-frame right, always below the title, lands on the capybara's head
  // (impact t = 2.0), then two small bounces (max rebound 20) with squash keyed to each contact
  const op = orangeHop(t);
  if (op) {
    const R = 23;
    const Lx = cx0 + 100 * cs, Ly = HZ - 111 * cs - R + 2;
    const x = op.u < 1 ? lerp(1430, Lx, op.u) : Lx;
    const y = op.u < 1 ? lerp(332, Ly, op.u) - 4 * 61 * op.u * (1 - op.u) : Ly - op.b;
    ctx.save();
    ctx.translate(x, y + R);
    ctx.scale(1 + op.sq * 0.85, 1 - op.sq);
    ctx.translate(0, -R);
    drawOrangeFruit(ctx, 0, 0, R, op.rot, true);
    ctx.restore();
  }
  // title: per-letter pop-in with a gentle wave afterwards
  const fontSize = clamp(fin(o.size, 108) || 108, 8, 400);
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
  const mt = ctx.getTransform();
  const dev = Math.min(8, Math.max(0.25, Math.round(Math.sqrt(Math.abs(mt.a * mt.d - mt.b * mt.c)) * 1.15 * 8) / 8));
  pos.forEach((p, i) => {
    if (p.ch === ' ') return;
    const k = clamp((t - 0.35 - i * 0.055) / 0.5);
    if (k <= 0) return;
    const sc = ease.outBack(k, 2.2);
    const wave = Math.sin(t * 2.2 - i * 0.45) * 3 * smoothstep(1.5, 2.5, t);
    // extruded 3D shadow + outline + gradient + gloss, pre-rendered (see groovyLetter)
    const g = groovyLetter(p.ch, fs, p.w, dev);
    ctx.save();
    ctx.translate(p.x + p.w / 2, baseY + wave - (1 - k) * 30);
    ctx.scale(sc, sc);
    ctx.rotate((1 - k) * -0.3);
    ctx.globalAlpha = clamp(k * 3);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(g.cv, g.x0, g.y0, g.w, g.h);
    ctx.restore();
  });
  // subtitle
  const ks = clamp((t - 2.3) / 0.7);
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
function drawTitleCard(ctx, t, o) {
  t = fin(t, 0);
  o = optsOf(o);
  if (!finiteCtx(ctx)) return;
  const so = { ...o, size: fin(o.size, undefined) };
  const a = cardAlpha(t, so);
  ctx.save();
  if ((so.style || 'woody') === 'groovy') groovyCard(ctx, t, so, a);
  else woodyCard(ctx, t, so, a);
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
function drawCaption(ctx, t, o) {
  t = fin(t, 0);
  o = optsOf(o);
  if (!finiteCtx(ctx)) return;
  const inT = fin(o.inT, 0), outT = numOr(o.outT, Infinity);
  if (t < inT || t > outT + 0.75) return;
  const so = {
    ...o, inT, outT,
    text: o.text == null || o.text === '' ? 'THREE WEEKS LATER' : String(o.text),
    x: fin(o.x, undefined), y: fin(o.y, undefined), scale: clamp(fin(o.scale, 1), 0.05, 10) || 1,
  };
  ctx.save();
  if ((so.style || 'plank') === 'banner') bannerCaption(ctx, t, so);
  else plankCaption(ctx, t, so);
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

const CARDS = {
  s02_title: { lines: ['CHILL CAPYBARA'] },
  s02_credit: { lines: [{ text: 'with', size: 36 }, { text: 'MOUNT SNOOZE', size: 62 }, { text: 'as itself (dormant)', size: 40 }] },
  s10_end: { lines: ['CHILL CAPYBARA', { text: 'THE END', size: 40, at: 0.9, fade: 0.4 }] },
  s10_volcano: { lines: [{ text: 'MOUNT SNOOZE', size: 62 }, { text: 'appeared as itself', size: 40 }, { text: '(no longer dormant)', size: 40 }] },
  s10_fish: { lines: [{ text: 'No fish were harmed in the making of this film.', size: 44 }, { text: 'They left early.', size: 44, at: 1.2, fade: 0.35 }] },
  s10_fish_auto: { lines: [{ text: 'No fish were harmed in the making of this film. They left early.', size: 44 }] },
};
function officeCast(ctx, t, o = {}) {
  const C = o.real ? tryChars() : null;
  let ok = false;
  if (C && C.drawCapybara && C.drawTortoise) {
    try {
      C.drawCapybara(ctx, { who: 'barry', x: OFFICE.couch.x, y: OFFICE.couch.y, pose: 'lie', t, mood: 'worried' });
      C.drawTortoise(ctx, { x: OFFICE.chair.x, y: OFFICE.chair.y, flip: true, t, write: 0.3 });
      ok = true;
    } catch (e) { /* sibling WIP */ }
  }
  if (!ok) {
    placeholderCapy(ctx, OFFICE.couch.x, OFFICE.couch.y, false, 'Barry', '#9A6A45');
    placeholderTortoise(ctx, OFFICE.chair.x, OFFICE.chair.y, 'Shelley');
  }
}
// lab stand-in for the s08 raft: the same raft options and seating as the scene kit (Sunny left,
// Barry centre in his helmet, Doreen right facing him) so framings are judged on the real layout
function riverCastFn(t, real) {
  const C = real ? tryChars() : null;
  let P = null;
  if (real) { try { P = require('./props'); } catch (e) { /* sibling WIP */ } }
  const r = RIVER.raftPos;
  return (c) => {
    const ro = { x: r.x, y: r.y, t, scale: 0.95, bob: 1, wake: 0.35, dir: -1, wind: 0.6, flagText: 'S.S. TOLD YOU SO' };
    if (P && P.drawRaft) P.drawRaft(c, ro);
    else labRaft(c, r.x, r.y, t);
    if (!(C && C.drawCapybara)) return;
    try {
      const RA = P && P.raftAnchors ? P.raftAnchors(ro) : null;
      const wl = RA ? RA.waterline : r.y, ang = (RA && RA.angle) || 0;
      for (const [who, sx, sc, flip, mood, acc] of [['sunny', -126, 0.55, false, 'sad', {}], ['barry', 6, 0.58, false, 'deadpan', { helmet: true, soot: 0.35 }], ['doreen', 128, 0.56, true, 'sad', { juice: 0.4 }]]) {
        const lx = sx * ro.scale, ly = -42 * ro.scale;
        const x = r.x + lx * Math.cos(ang) - ly * Math.sin(ang), y = wl + lx * Math.sin(ang) + ly * Math.cos(ang);
        const g = C.capyAnchors ? C.capyAnchors({ who, x: 0, y: 0, scale: sc, pose: 'sit', t, flip: false }).ground.y : 0;
        C.drawCapybara(c, { who, x, y: y - g, scale: sc, pose: 'sit', t, flip, rot: ang, mood, accessories: acc });
      }
    } catch (e) { /* sibling WIP */ }
  };
}
function riverScene(ctx, t, o = {}, cast) {
  drawRiverSunset(ctx, t, o);
  const r = RIVER.raftPos;
  drawRiverReflection(ctx, t, { y: r.y, x0: r.x - 320, x1: r.x + 320, depth: 150, drawSource: true }, cast);
  drawRiverFront(ctx, t, o);
}
function grid(ctx, items, cols, draw) {
  const rows = Math.ceil(items.length / cols), pw = 1280 / cols, ph = 720 / rows;
  items.forEach((it, i) => labPanel(ctx, (i % cols) * pw, Math.floor(i / cols) * ph, pw, ph, it.label, () => draw(it, i)));
}

const lab = {
  office(ctx, t) {
    drawTherapyOffice(ctx, t, { hourglass: 0.6 });
    drawTherapyOfficeFront(ctx, t, {});
  },
  office_cast(ctx, t) {
    drawTherapyOffice(ctx, t, {});
    officeCast(ctx, t, { real: false });
    drawTherapyOfficeFront(ctx, t, {});
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.font = '700 13px Fredoka';
    for (const k of ['window', 'crater', 'shelleyHead', 'diploma', 'candle', 'lamp', 'table', 'oranges', 'hourglass', 'alcove', 'fern']) {
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
    const F = OFFICE.framings;
    grid(ctx, [
      { label: 'barry_couch ' + JSON.stringify(F.barry_couch), cam: F.barry_couch, o: {} },
      { label: 'shelley_cu ' + JSON.stringify(F.shelley_cu), cam: F.shelley_cu, o: {} },
      { label: 'office_wide (zoom 0.9 shown)', cam: { x: 640, y: 360, zoom: 0.9 }, o: {} },
      { label: 'window ' + JSON.stringify(F.window) + ' puff .55', cam: F.window, o: { puff: 0.55 } },
    ], 2, (it) => withCamera(ctx, it.cam, () => {
      drawTherapyOffice(ctx, t, it.o);
      officeCast(ctx, t, { real: true });
      drawTherapyOfficeFront(ctx, t, it.o);
    }));
  },
  office_window(ctx, t) {
    const items = [];
    for (let i = 0; i < 8; i++) items.push({ label: 'puff ' + (i / 7).toFixed(2), o: { puff: i / 7 }, cam: OFFICE.framings.window });
    for (const v of [0, 0.35, 0.6, 1]) items.push({ label: 'volcanoSmoke ' + v + ' (wide)', o: { volcanoSmoke: v }, cam: { x: 820, y: 300, zoom: 1.6 } });
    grid(ctx, items, 4, (it) => withCamera(ctx, it.cam, () => {
      drawTherapyOffice(ctx, t, it.o);
      officeCast(ctx, t, { real: true });
      drawTherapyOfficeFront(ctx, t, it.o);
    }));
  },
  office_live(ctx, t) {
    drawTherapyOffice(ctx, t, { hourglass: 0.5 });
    officeCast(ctx, t, { real: true });
    drawTherapyOfficeFront(ctx, t, {});
  },
  river(ctx, t) {
    riverScene(ctx, t, { ash: 0.5 }, riverCastFn(t, false));
  },
  river_framings(ctx, t) {
    const F = RIVER.framings;
    const cast = riverCastFn(t, true);
    // a tight close-up on Barry (eye ≈ 646,420), widened just enough to hold the smoking volcano
    const tight = riverFrameVolcano({ x: 662, y: 430, zoom: 4 }, [{ x0: 610, y0: 378, x1: 712, y1: 452 }]);
    const r1 = (c) => ({ ...c, x: Math.round(c.x), y: Math.round(c.y), zoom: +c.zoom.toFixed(2) });
    grid(ctx, [
      { label: 'raft_wide ' + JSON.stringify(F.raft_wide), cam: F.raft_wide },
      { label: 'barry_cu ' + JSON.stringify(F.barry_cu), cam: F.barry_cu },
      { label: 'riverFrameVolcano(z4 CU, Barry head) = ' + JSON.stringify(r1(tight)), cam: tight },
      { label: 'volcano ' + JSON.stringify(F.volcano), cam: F.volcano },
    ], 2, (it) => withCamera(ctx, it.cam, () => riverScene(ctx, t, { ash: 0.4 }, cast)));
  },
  // the REAL s08 stages from the scene kit (lazy, optional): kit framings vs this module's
  river_kit(ctx, t) {
    let K = null, tl = null;
    try { K = require('./kit'); const { Timeline } = require('./timeline'); tl = new Timeline(); } catch (e) { K = null; }
    if (!K || !tl || !tl.byScene.s08_aftermath) { drawRiverSunset(ctx, t, {}); return; }
    const sc = tl.byScene.s08_aftermath;
    const S = (tt) => tl.sceneTime('s08_aftermath', sc.start + tt);
    const items = [
      { label: 'kit raft_wide', tt: 4.5, cfg: { cam: { name: 'raft_wide' } } },
      { label: 'kit barry_cu (as is)', tt: 1, cfg: { cam: { name: 'barry_cu' } } },
      { label: 'RIVER.framings.barry_cu', tt: 1, cfg: { camera: { ...RIVER.framings.barry_cu } } },
    ];
    const C = RIVER.volcanoCU.barryFacingRight;
    items.push({ label: 'RIVER.volcanoCU.barryFacingRight (o.volcano cheat)', tt: 1, cfg: { camera: { ...C.cam }, env: { volcano: C.volcano } } });
    grid(ctx, items, 2, (it) => { const s0 = S(it.tt); K.drawRaftStage(ctx, s0.t, s0, it.cfg); });
  },
  office_kit(ctx, t) {
    let K = null, tl = null;
    try { K = require('./kit'); const { Timeline } = require('./timeline'); tl = new Timeline(); } catch (e) { K = null; }
    if (!K || !tl || !tl.byScene.s05_therapy) { drawTherapyOffice(ctx, t, {}); return; }
    const sc = tl.byScene.s05_therapy;
    const S = (tt) => tl.sceneTime('s05_therapy', sc.start + tt);
    grid(ctx, [
      { label: 'kit window: window_puff +0.9s', tt: 24.2, cfg: { cam: { name: 'window' } } },
      { label: 'kit window: shelley_turns +0.2s (neck −1)', tt: 26.3, cfg: { cam: { name: 'window' }, shelley: { neck: -1, look: { x: -1, y: -1 } } } },
      { label: 'kit window: shelley_turns +0.9s', tt: 27.0, cfg: { cam: { name: 'window' }, shelley: { neck: -1, look: { x: -1, y: -1 } } } },
      { label: 'OFFICE.framings.window: turns +1.4s', tt: 27.5, cfg: { camera: { ...OFFICE.framings.window }, shelley: { neck: -1, look: { x: -1, y: -1 } } } },
    ], 2, (it) => { const s0 = S(it.tt); K.drawOfficeStage(ctx, s0.t, s0, it.cfg); });
  },
  river_live(ctx, t) {
    riverScene(ctx, t, { ash: 0.4, grade: 1 }, riverCastFn(t, true));
  },
  river_reflection(ctx, t) {
    // solid-colour test block on the raft anchor: the reflection must be strongest right under the
    // waterline and fade smoothly with depth (no bands, no rectangle from the front strip)
    const r = RIVER.raftPos;
    const block = (c) => { c.fillStyle = '#2050F0'; c.fillRect(r.x - 150, r.y - 120, 300, 128); c.fillStyle = '#F0D020'; c.fillRect(r.x - 150, r.y - 120, 300, 18); };
    grid(ctx, [
      { label: 'test block z1', cam: { x: 640, y: 420, zoom: 1 } },
      { label: 'test block z2', cam: { x: 640, y: 540, zoom: 2 } },
      { label: 'test block z3 (close-up)', cam: { x: 640, y: 540, zoom: 3 } },
      { label: 'real cast z2', cam: { x: 600, y: 470, zoom: 2 }, real: true },
    ], 2, (it) => withCamera(ctx, it.cam, () => riverScene(ctx, t, { ash: 0 }, it.real ? riverCastFn(t, true) : block)));
  },
  river_sun(ctx, t) {
    const cast = riverCastFn(t, true);
    grid(ctx, [
      { label: 'default sun (clear of the cast)', o: {} },
      { label: "sun:{x:645,y:356} — behind Barry ('Am I chill?')", o: { sun: { x: 645, y: 356 } }, cam: RIVER.framings.barry_cu },
      { label: 'sunset 0.5', o: { sunset: 0.5 } },
      { label: 'sunset 1 + smoke 0.4, ash 1', o: { sunset: 1, smoke: 0.4, ash: 1 } },
    ], 2, (it) => withCamera(ctx, it.cam || { x: 640, y: 360, zoom: 1 }, () => riverScene(ctx, t, it.o, cast)));
  },
  titles(ctx, t) {
    labPanel(ctx, 0, 0, 640, 360, 'woody: CHILL CAPYBARA', () => drawTitleCard(ctx, t, { style: 'woody' }));
    labPanel(ctx, 640, 0, 640, 360, 'woody: s02 credit', () => drawTitleCard(ctx, t, CARDS.s02_credit));
    labPanel(ctx, 0, 360, 640, 360, 'groovy t=1.65 (orange in flight)', () => drawTitleCard(ctx, 1.65, { style: 'groovy' }));
    labPanel(ctx, 640, 360, 640, 360, 'groovy t=4 (settled)', () => drawTitleCard(ctx, 4 + t, { style: 'groovy' }));
  },
  titles_script(ctx, t) {
    // the exact s02 / s10 card texts from script.py (t+2 so per-line reveals have happened)
    grid(ctx, [
      { label: 's02 title_card', c: CARDS.s02_title, t: 1 },
      { label: 's02 title_credit', c: CARDS.s02_credit, t: 1 },
      { label: "s10 end_card t=0.5 ('THE END' not yet)", c: CARDS.s10_end, t: 0.5 },
      { label: 's10 end_card t=2', c: CARDS.s10_end, t: 2 },
      { label: 's10 end_credit_volcano', c: CARDS.s10_volcano, t: 1 },
      { label: 's10 end_credit_fish (at:1.2 reveal) t=2', c: CARDS.s10_fish, t: 2 },
      { label: 'fish card as ONE string (auto-wrap)', c: CARDS.s10_fish_auto, t: 1 },
      { label: 'MOUNT SNOOZE… as ONE string', c: { lines: [{ text: 'MOUNT SNOOZE appeared as itself (no longer dormant)', size: 46 }] }, t: 1 },
      { label: 'layered: bg:false over the river', c: { lines: ['THE END'], bg: false, fadeIn: 0.5 }, t: 1, under: true },
    ], 3, (it) => {
      if (it.under) drawRiverSunset(ctx, t, {});
      drawTitleCard(ctx, it.t + t, it.c);
    });
  },
  titles_groovy(ctx, t) {
    drawTitleCard(ctx, t, { style: 'groovy', dur: 8, fadeOut: 1 });
  },
  caption(ctx, t) {
    drawNewSpringStub(ctx);
    drawCaption(ctx, t, { style: 'plank', text: 'THREE WEEKS LATER', inT: 0, outT: 3 });
    drawCaption(ctx, t, { style: 'banner', text: 'THREE WEEKS LATER', inT: 0, outT: 3, y: 560 });
  },
};

// Build the static-layer tiles for the named framings ahead of time (optional; otherwise the
// first frame at each new zoom level pays ≈0.1–0.3 s once). outScale = output px per design unit
// (1.5 for 1920x1080, 0.5 for 640x360 previews).
function prewarm(which = 'all', outScale = 1.5) {
  const sc = fin(outScale, 1.5);
  const cw = Math.round(1280 * sc), ch = Math.round(720 * sc);
  const jobs = [];
  if (which === 'all' || which === 'office') for (const f of Object.values(OFFICE.framings)) jobs.push(['office', officeStatic, f]);
  if (which === 'all' || which === 'river') {
    const sun = sunOf({});
    const vol = volcOf({});
    for (const f of Object.values(RIVER.framings)) jobs.push(['river|' + sun.x + ',' + sun.y + '|' + vol.x + ',' + vol.y, (c) => riverStatic(c, sun, vol), f]);
  }
  for (const [key, fn, f] of jobs) {
    const z = f.zoom * sc;
    const B = tileBlock({ a: z, b: 0, c: 0, d: z, e: cw / 2 - f.x * z, f: ch / 2 - f.y * z }, cw, ch);
    if (B) buildTiles(key, B.L, B.c0, B.c1, B.r0, B.r1, fn);
  }
}

module.exports = {
  _envOtherPrivate: {
    drawCached, officeStatic, officeWindowStatic, officeWindowLive, officeTable, officeDust, drawSnoozeCone, blobsPath,
    riverSmokePuffs, riverStatic, riverSkyStatic, riverStars, riverSunDisc, riverClouds, riverSmoke, riverCraterGlow,
    riverVolcanoStatic, riverFarStatic, waterStatic, waterLive, riverBankReflections, riverBanksStatic,
    riverPalms, riverBirds, riverLilies, raftShadow, riverAsh, riverForeground, riverGrade,
    bankFill, bankPath, palm, CROWNS, leftEdge, rightEdge, edgeAt, edgeClip, sunOf, horizonTop, waterColorAt,
  },
  drawTherapyOffice, drawTherapyOfficeFront, OFFICE,
  drawRiverSunset, drawRiverFront, drawRiverReflection, riverFrameVolcano, RIVER,
  drawTitleCard, drawCaption,
  prewarm,
  lab,
};
