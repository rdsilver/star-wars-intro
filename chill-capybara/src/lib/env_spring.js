'use strict';
/* eslint-disable no-mixed-operators */
/*
 * env_spring.js — SNOOZE SPRINGS (spring_day / spring_evening / eruption / new_spring)
 * ===================================================================================
 * All drawing is in 1280x720 design ("world") units; the default framing is camera (640,360)
 * zoom 1. The painted world is SPRING.world = x -1500..1950, y -440..1140: the outflow river runs
 * on to the far left (a bend with rapids around x -560..-880) so a camera can follow the raft
 * (SPRING.riverPath); SPRING.clampCam(cam) keeps any framing inside the painted area.
 * Every function is a pure function of its inputs (t = seconds; it only drives idle motion).
 * Randomness is seeded; ctx state is always restored.
 *
 * PERFORMANCE MODEL
 *   Static scenery (sky, far hills, Mount Snooze, jungle wall, ground, trunks, water body, rocks,
 *   the sign, bananas, front ferns) is rasterised once into tiles / sprites and blitted. The cache
 *   is a pure function of constant inputs (layer, variant, light corner, pixel-scale level, tile),
 *   so frames are identical whatever order they render in. Pixel-scale levels form a x1.04 ladder.
 *   Blits are nearest-neighbour onto device-pixel-snapped rects (also under a shake's small
 *   rotation, up to ~1.7 deg; bilinear beyond). Lighting is quantised into "corners": o.dusk in
 *   1/20 steps x eruption light (eruptLight = smoothstep(.08, .42, erupt), so held erupt >= .42
 *   uses one corner). Fractional corners are cached blends (alpha quantised to 1/32); while the
 *   light is ramping the two corners are drawn interleaved instead of rebuilding blends.
 *   Budget: SPRING_CACHE_MB env (default 420 MB per process, LRU). The first frame of a new
 *   framing / level builds its tiles (~0.15-0.35 s at 1080p); then, 1080p CPU ms, flushed:
 *     calm day ~17-20 | + trio front water + overlay ~22 | evening ~22 | new spring ~19
 *     close-up z2.2 ~16 | volcano z2 ~13 | boil 1.0 ~39 | erupt .45 ~45 | erupt + rocks ~51
 *     lava finale ~57 | wide z0.8 erupt + shake ~51 | frames during an eruption-light ramp ~68
 *   (climax frames are raster-bound on large translucent plume / lava / steam shapes.)
 *
 * LAYERING (per frame, inside the scene's withCamera):
 *   1. drawSpringDay / drawSpringEvening / drawNewSpring    everything BEHIND the swimmers
 *   2. scene draws EXIT signs, raft, props, characters …
 *      swimmers: drawSwimmers(ctx, t, [{x, y, scale, draw(ctx)}], o) depth-sorts them and draws each
 *      one's back ripple → character → its own front water (or call drawWaterFront yourself, one
 *      swimmer at a time, back to front).
 *   3. drawSpringOverlay(ctx, t, {setting, ...same o})  optional, in front of everything: a low front
 *      steam veil (waterHeat > .45, kept below the swimmers' faces), ash + embers (erupt/lava),
 *      rumble dust, eruption flash/grade
 *   4. (outside withCamera) drawForegroundFoliage(ctx, t, o)  optional screen-edge framing leaves
 *
 * COMMON OPTIONS `o` (all optional; pass the same o to every call of a frame):
 *   volcanoSmoke 0..1 (default 0.3)  lazy smoke wisp from Mount Snooze (0 = none)
 *   waterHeat    0..1 (default 0.2)  progressive boil: .25+ steam thickens + fizz pops all over;
 *                                    .5+ churning foam sheets, turbulence rings, bubble domes, soft
 *                                    steam billows; .75–1 rolling boil (big domes r 20–40 bursting
 *                                    into droplet crowns and spits, heavy billows)
 *   rumble       0..1 (default 0)    shaking leaves/palms/grove, distant scenery trembles, falling dust
 *                                    & leaves, ripple rings on the water (camera shake = the scene's)
 *   erupt        0..1 (default 0)    0 dormant | .03-.2 crater heats up (one smooth radial glow, hot
 *                                    throat, glowing fissures) + thick dark smoke column | .18-.6
 *                                    explosive plume that mushrooms into a canopy whose fire-lit
 *                                    underside hangs at y≈20..160 (reads at zoom 1), lava fountain in
 *                                    front of it (fat parabolic streams breaking into blobs, bombs with
 *                                    motion trails), red-orange sky, lightning, an automatic white
 *                                    flash at erupt≈.215; the jungle goes to dark silhouettes rim-lit
 *                                    only on the volcano-facing edges | .58-1 tapered lava rivers
 *                                    (noisy width, braided side channels, crusted edges, drifting crust
 *                                    rafts, bulbous advancing head) down the flanks, running on behind
 *                                    the treeline, lava light on the jungle
 *   flash        0..1                override the automatic eruption flash (0 = none)
 *   lava         0..1 (default 0)    0-.26 lava oozes out from under the burning undergrowth at the
 *                                    back-right and curtains over the rim rocks (bright molten core,
 *                                    lumpy crust edges, drips; a 2nd pour by the sign from .12);
 *                                    .2-.4 a steam explosion where each pour hits the water; .24-1 a
 *                                    crust shelf spreads over the pool (irregular Voronoi crust plates,
 *                                    perspective-squashed, glowing seams, crusted levee, orange glow on
 *                                    the water around it, hissing steam + spits along the contact line)
 *   signBurn     0..1 (default 0)    the "No Worries Allowed" sign chars from the bottom up and burns
 *   dusk         0..1 (evening)      0 golden hour (sun low between the palm and the volcano) → 1 dusky
 *                                    pink/purple. Foliage stays green; warmth is in rims/top light and
 *                                    a ~20% warm multiply grade; shadows go cool
 *   puffs        [{k, size=1, dark=0, seed, rise, hang, drift}]  discrete crater puffs ("the sneeze"),
 *                                    k = 0..1 life (see drawVolcanoPuff)
 *   groveTaken   int (default 0)     oranges missing from the grove, in SPRING.groveOranges order (the
 *                                    first is the one that rolls into the pool in s04)
 *   groveShake   0..1                shake the grove (also driven by rumble / erupt)
 *   sign         bool (default true) draw the wooden sign on the right bank
 *   barryRock    bool (default true) the flat boulder in the pool (SPRING.barryRock)
 *   moorPost     bool                stake + rope at the river (default false; true for drawNewSpring)
 *   birds        bool (default true) tiny birds in the day sky (auto-off while erupting)
 *   skyTint      [hex, amount]       extra colour mixed into the sky
 *
 * EXPORTS
 *   drawSpringDay(ctx, t, o)      morning Snooze Springs (everything behind the swimmers)
 *   drawSpringEvening(ctx, t, o)  same place at golden hour; o.dusk 0..1 → dusky pink/purple
 *   drawNewSpring(ctx, t, o)      epilogue: a DIFFERENT, sunnier hot spring in meadow country, same pool
 *                                 coordinates (swim spots carry over): rolling hills, a rainbow over ONE
 *                                 innocent little hill (own silhouette, sunlit rim) where the volcano
 *                                 was, weeping willow (left), bamboo grove behind the sign "SNOOZE
 *                                 SPRINGS 2 — Barry Approved" + painted check, flat river stones with
 *                                 grassy gaps and a sandy lip, lily pads, stepping stones + cattails
 *                                 (front-left), a little wooden deck with a towel (front-right), a
 *                                 bamboo spout trickling into the pool, flowering bushes, butterflies.
 *                                 o: waterHeat, rumble, moorPost (default true), barryRock, sign, raft
 *                                 (default false; true draws props.drawRaft at NEW_SPRING.raftMoor,
 *                                 scale .5), puffs [{k, size, dark, seed}] (the hill sneeze: drawn with
 *                                 drawVolcanoPuff at NEW_SPRING.hillPuffPos, sizes × hillPuffScale .62),
 *                                 hillPuff 0..1 (shorthand: one small puff, life k)
 *   drawWaterFront(ctx, t, o)     FRONT water, drawn AFTER characters. o.setting: 'day'|'evening'|'new'
 *                                 (or 'spring_day'|'spring_evening'|'new_spring') + the same o as the
 *                                 background. o.swimmers: [{x, y, w, depth, scale, ripple}] — y = that
 *                                 body's waterline, w = width at the waterline (default 280*scale),
 *                                 depth = covered depth below it (default 110*scale), scale defaults
 *                                 to SPRING.depthScale(y). Default = the trio's swim spots. o.opacity
 *                                 (0.72), o.clip (default true: clipped to open water — pool + river,
 *                                 never the rim rocks, grass or roots). Soft-edged translucent water +
 *                                 waterline highlight, contact shade, refraction bands, front ripples.
 *   drawSwimmers(ctx, t, list, o) list: [{x, y, scale?, w?, depth?, ripple?, draw(ctx)}] — depth-sorted
 *                                 back ripple → draw() → front water for each (see LAYERING)
 *   waterlineRipple(ctx, x, y, w, t, {amp=1, speed=1, part='front'|'back'|'both', color, clip=true})
 *                                 rings spreading from a body of width w floating at waterline y
 *                                 (clipped to open water unless clip:false)
 *   drawSpringOverlay(ctx, t, o)  see LAYERING 3. o.grade 0..1 (default 0) multiplies a setting grade.
 *   drawForegroundFoliage(ctx, t, o)  SCREEN-SPACE framing leaves (call outside withCamera).
 *                                 o: sides 'both'|'left'|'right', top bool (default false), amount 0..1,
 *                                 setting/dusk/erupt (colour), rumble.
 *   drawMountSnooze(ctx, t, o)    the volcano alone (+grove, smoke, puffs, eruption) for other settings:
 *                                 o.x, o.y (where the PEAK goes), o.scale, erupt, volcanoSmoke, setting,
 *                                 dusk, puffs, groveTaken (vector, not cached)
 *   drawEruption(ctx, t, o)       only the eruption elements (crater heat, lava rivers, smoke, plume,
 *                                 fountains) in Snooze Springs coordinates, for custom compositions
 *   drawVolcanoPuff(ctx, t, {k, size=1, dark=0, x=860, y=146, seed, rise=26, hang=.62, drift=34})
 *                                 one crater puff. It pops out (outBack), rises `rise` units during the
 *                                 first (1-hang) of its life (independent of size), then HANGS over the
 *                                 crater swelling slowly and drifting `drift` units sideways, and fades
 *                                 over the last 28%. A size-1.4 puff fits kit's volcano framing {860,236}
 *                                 z1.9 (see SPRING.volcanoCam for roomier ones).
 *   drawSnoozeSign(ctx, t, o)     the wooden sign alone: {x, y (ground under the posts), scale, burn,
 *                                 lines:[big, small], check:bool, setting, dusk, erupt}
 *   drawBarryRock(ctx, t, o)      Barry's rock alone (pass barryRock:false to the background and call
 *                                 this yourself if a swimmer must go BEHIND it)
 *   fallingRocks(t, opts) → [{i, x, y, r, rot, glow, active, landed, impactT, landT, start, inWater,
 *                                 sink, vx, vy, landX, landY, scale, baseR, target, bounced, phase}]
 *                                 Volleys: {t0, count, area:{x0,x1,yTop,yGround}, seed, dur, size:[r0,r1],
 *                                 g=900, from, flight}. Rock i starts at t0 + rand*dur and lands at
 *                                 impactT. yGround: number or [min,max]. from {x,y} (e.g.
 *                                 SPRING.craterPos) → ballistic arcs from that point (rocks grow from
 *                                 .35x to full size as they come closer), flight [min,max] s.
 *                                 TARGETED rocks: targets [{x, y, impactT, r=11, from?, flight?, drop?,
 *                                 bounce?: {vx, vy, landY} | false, seed?, glow?}] hit (x, y) EXACTLY at
 *                                 impactT (sync 'bonk'); no `from` = a fast drop from `drop` (260) units
 *                                 above in `flight` (.35) s; then they bounce off (default {vx ±70,
 *                                 vy -170}, landY y+90) and land at landT (sync 'splash'), or stop there
 *                                 with bounce:false. phase: 'wait'|'fall'|'bounce'|'landed'.
 *   drawFallingRocks(ctx, t, opts)  draws them (smoke trail, glow, contact burst on targets, splash in
 *                                 the pool / dust puff on land); returns the same array. opts + {splash}
 *   drawAsh(ctx, t, {density=1, area:{x0,x1,y0,y1}, wind=14})   drifting ash flakes (world-anchored
 *                                 cells: constant density per area, stable under camera moves)
 *   drawEmbers(ctx, t, {density=1, area:{x0,x1,y0,y1}})        rising glowing embers (same cells)
 *   drawSteam(ctx, t, {x, y, w, amount 0..2, h, scale, color, seed, maxWisps=12, billows=true})
 *                                 wisps (+ soft billows above amount .35) rising from a strip centred
 *                                 at x, w wide, surface y
 *   drawSteamBurst(ctx, t, {x, y, w, amount, scale, seed, color, h=190, spacing=60, points, maxPuffs=10})
 *                                 soft radial-gradient steam billows along a strip, or from emitter
 *                                 points [[x,y]...]
 *   drawBubbles(ctx, t, {x, y, w, h, amount, scale, seed, color, shade, pool, domeR:[min,max],
 *                                 domeSpacing}) bubbles in a band centred (x,y); amount > .55 adds
 *                                 boiling domes that burst into droplet crowns + spits; pool:true = only
 *                                 on open water
 *   drawFlames(ctx, t, [{x, y, h, w, seed}], {glow})  batched cartoon flames (base at x,y)
 *   inPool(x, y)                  true if (x,y) is on the water (pool or outflow river)
 *   freeWater(x, y, margin=0)     true if (x,y) is OPEN water at least `margin` from the rim rocks
 *   clampCam(cam, world=SPRING.world)  camera {x,y,zoom,shake} clamped so the view stays painted
 *   SPRING / NEW_SPRING           world anchors (below); SPRING.depthScale(y) → suggested character
 *                                 scale for a swimmer whose waterline is at y (1.0 at y=600)
 *   lab                           showcase sheets for src/lab.js: day, day_overlay (anchors + an
 *                                 assertion that every swim spot sits on open water), swim, evening,
 *                                 evening_dusk, eruption, eruption_day, erupt_peak, erupt_flow, lava,
 *                                 lava_full, boil, boil_full, rumble, puffs (the sneeze through kit's
 *                                 volcano framing), hill_sneeze, grove, new_spring, new_swim, sign,
 *                                 particles, rocks (volley + targeted rocks), framings, framings_more,
 *                                 framings_world (raft follow down the river, world edges), foreground
 *
 * ANCHORS (SPRING; NEW_SPRING shares the pool coordinates):
 *   world {x0:-1500, x1:1950, y0:-440, y1:1140}   clampCam(cam)
 *   waterY 458 = back edge of the pool surface; pool x≈160..1197, front edge y≈812 (off frame)
 *   swimSpots: sunny {360,590}  barry {650,600}  doreen {945,588, flip}  (y = waterline; each has a
 *              suggested scale & flip) + extras: {326,548} {500,516,flip} {884,510} {1068,540,flip}
 *              (all on open water: day_overlay asserts it)
 *   barryRock {798,552, rx 38, ry 21, top {794,532}}   thermometerSpot {770,598}
 *   riverMouth {150,596}  raftMoor {70,597}  moorPost {118,558}
 *   riverPath [{x,y}…] centreline from the mouth to x -1580 (raft escape route); rapids {x0:-880,x1:-560}
 *   exitSignSpots: 4 ground points on the back-left bank, nearest the pool first (x 400, 292, 184 at
 *              y≈446-452, size 1; and a small one {148,500, size .6}); all point LEFT
 *   rulesSignSpot (= rulesSignPos) {604,452} (SPRING RULES sign, back bank) — NEW_SPRING {990,452}
 *   escapePath: [{x,y}...] pool centre → past the EXIT signs → raft
 *   signPos {1150,446} (ground under the sign; the board spans ≈ y 318..410, x 1043..1257)
 *   volcanoPeak {860,150}  craterPos {860,150,w:110}  grove {768,346,w:100} (orange grove, lower-left
 *   flank)  grovePos = groveOranges[0] (the orange that shakes loose)  groveOranges [{x,y}×32] (removal
 *   order for o.groveTaken)  orangeRoll [bounce points grove → back-right of the pool]
 *   lavaEntry {990,468}  lavaEntry2 {1140,488}
 *   fishHop [{300,562} → over the LEFT rim rocks {200,520} → river {120,600} → off left {-140,606}]
 *   volcanoCam {dormant {860,214,z1.75}, sneeze {872,196,z1.6}, erupting {860,160,z1.05}}
 *   NEW_SPRING: tinyHill {880,322}  hillPuffPos {880,318}  hillPuffScale .62  hillCam {880,300,z2.2}
 *              (volcano/lava/grove anchors are null there)
 */
const { Path2D, createCanvas } = require('@napi-rs/canvas');
const U = require('./util');
const { TAU, clamp, lerp, smoothstep, rng, hash1, hash2, noise1, mix, rgba, ellipse, circle, roundRect, blob, withCamera } = U;

const WX0 = -1500, WX1 = 1950, WY0 = -440, WY1 = 1140;
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
    if (pts.length >= 3) out.push({ y: (a + b) / 2, y0: a, y1: b, path: newPath((p) => polyP(p, pts)) });
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
  mtn: '#93B9C6', hillFar: '#76AA95', volcLit: '#8E8FA6', volcBase: '#6C6F86', volcShade: '#4E506A',
  volcDark: '#3A3B52', volcRim: '#B9B8CE', crater: '#2A2433',
  jDeep: '#2C6643', jMid: '#3F8A55', jLight: '#5FAF6A', jPale: '#8CCB7A', jLime: '#B4DC7E', jTeal: '#2F7A5E',
  jFar: '#4C8F72', jFarDeep: '#3D7A61',
  trunk: '#6E5646', trunkDark: '#4A3B33', trunkLight: '#9C826B', palm: '#A68A6A', palmDark: '#7A634C', palmRing: '#665140',
  ground: '#86BF68', groundMid: '#6CAA57', groundDark: '#548F4B', dirt: '#93724F',
  rock: '#ADA392', rockShade: '#857B6E', rockDark: '#5F574F', rockLight: '#D8CFBD', moss: '#77AE57', mossLight: '#A8D372',
  wood: '#B57E4C', woodDark: '#82552F', woodLight: '#D9A46E', woodDeep: '#5A3820', paint: '#FFF4DA', paint2: '#C4F2E6',
  fPink: '#FF8DB0', fYellow: '#FFD54A', fWhite: '#FFF8EE', fPurple: '#B9A0FF', fRed: '#FF6A55', fOrange: '#FFA03A',
  coconut: '#6E5034',
};
// tint = colour mixed in, mul = warm multiply grade, shadow = cool darkening, rim = rim/top light
const PAL = {
  day: {
    skyTop: '#4FA8E0', skyMid: '#8CCEEE', skyBot: '#F7EBCF', sunX: 300, sunY: -40, sunCol: '#FFF7D6', sunA: 0.55, sunDisc: 0,
    haze: '#C4E2EA', hazeAmt: 0.85, tint: '#FFFFFF', tintAmt: 0, mul: '#FFFFFF', mulA: 0, shadow: '#1A2238', dark: 0,
    rim: '#FFF6D8', rimA: 0.32, cloud: '#FFFFFF', cloudShade: '#D2E4F1',
    w0: '#A9EAE0', w1: '#66CFCA', w2: '#3CADB5', w3: '#2A8697', wHi: '#DCFBF5', wRefl: '#2C7A73',
    steam: '#FFFFFF', rays: 1, glow: 0,
  },
  gold: {
    skyTop: '#7A86C8', skyMid: '#F0B08C', skyBot: '#FFDB98', sunX: 618, sunY: 302, sunCol: '#FFE6A8', sunA: 0.85, sunDisc: 1,
    haze: '#EBC6A6', hazeAmt: 0.72, tint: '#FF9C45', tintAmt: 0.06, mul: '#FFD8AE', mulA: 0.2, shadow: '#22305E', dark: 0.1,
    rim: '#FFD98A', rimA: 0.46, cloud: '#FFE4BC', cloudShade: '#DCA0A0',
    w0: '#F5CC9E', w1: '#87C6BB', w2: '#4E9AA5', w3: '#2F6F87', wHi: '#FFECC6', wRefl: '#34565E',
    steam: '#FFF2DE', rays: 0.85, glow: 0.4,
  },
  dusk: {
    skyTop: '#46397A', skyMid: '#B4668E', skyBot: '#F7A26B', sunX: 618, sunY: 338, sunCol: '#FFA070', sunA: 0.65, sunDisc: 0.7,
    haze: '#9C7AA6', hazeAmt: 0.8, tint: '#7D4A8C', tintAmt: 0.1, mul: '#ECBACB', mulA: 0.24, shadow: '#1A1A40', dark: 0.26,
    rim: '#FFA48E', rimA: 0.4, cloud: '#F2A6A2', cloudShade: '#7A5A8A',
    w0: '#E2A2AA', w1: '#7593B1', w2: '#4D6C93', w3: '#304B73', wHi: '#FFD2C8', wRefl: '#2B2F52',
    steam: '#F8E4EE', rays: 0.2, glow: 0.2,
  },
  fresh: {
    skyTop: '#3FA6EA', skyMid: '#88D4F6', skyBot: '#FFF4D8', sunX: 330, sunY: 96, sunCol: '#FFF6CF', sunA: 0.7, sunDisc: 1,
    haze: '#D0EAF0', hazeAmt: 0.75, tint: '#FFF1C8', tintAmt: 0.04, mul: '#FFFFFF', mulA: 0, shadow: '#1A2238', dark: 0,
    rim: '#FFF8DC', rimA: 0.35, cloud: '#FFFFFF', cloudShade: '#D3E7F4',
    w0: '#B6F1E7', w1: '#6CD9D3', w2: '#40B9C0', w3: '#2C92A6', wHi: '#E6FFFB', wRefl: '#3A8C84',
    steam: '#FFFFFF', rays: 0.6, glow: 0,
  },
};
// what the eruption light pushes every palette toward (weighted by P.EL)
const ERUPT_PAL = {
  skyTop: ['#24101A', 0.9], skyMid: ['#6A2218', 0.86], skyBot: ['#FF7432', 0.8], haze: ['#3E2440', 1], hazeAmt: [0.45, 1],
  tint: ['#C8381C', 1], tintAmt: [0, 1], mul: ['#FFB090', 1], mulA: [0.06, 1], shadow: ['#0C1A26', 1], dark: [0.6, 1],
  cloud: ['#6A4440', 1], cloudShade: ['#3A2428', 1], rim: ['#FF7A30', 1], rimA: [0.24, 1],
  w0: ['#E07A44', 0.75], w1: ['#4E5E5A', 0.65], w2: ['#30464C', 0.65], w3: ['#1C2C36', 0.65], wHi: ['#FFB27A', 0.7],
  wRefl: ['#2A1A1A', 0.6], steam: ['#E8D6D0', 1],
};
function lerpPal(a, b, k) {
  const out = {};
  for (const key in a) {
    const va = a[key], vb = b[key];
    out[key] = typeof va === 'number' ? lerp(va, vb, k) : mix(va, vb, k);
  }
  return out;
}
function mulCol(hex, m, a) {
  if (a <= 0) return hex;
  const c = U.hexToRgb(hex), q = U.hexToRgb(m);
  return U.rgbToHex([c[0] * (1 - a * (1 - q[0] / 255)), c[1] * (1 - a * (1 - q[1] / 255)), c[2] * (1 - a * (1 - q[2] / 255))]);
}
// eruption light: 0 dormant → 1 full eruption grading (sky red, jungle dark with volcano-lit rims)
const eruptLight = (erupt) => smoothstep(0.08, 0.42, erupt);
const palCache = new Map();
// setting: 'day' | 'evening' | 'new'. Cached per quantised input (pure function of constants).
// el (optional) overrides the eruption light (used for the cached slab corners: 0 or 1).
function palette(setting, dusk = 0, erupt = 0, skyTint, lava = 0, el) {
  const q = (v) => Math.round(clamp(v) * 64);
  const EL = el != null ? clamp(el) : eruptLight(q(erupt) / 64);
  const key = setting + '|' + q(dusk) + '|' + q(erupt) + '|' + Math.round(EL * 256) + '|' + (skyTint ? skyTint[0] + q(skyTint[1]) : '') + '|' + q(lava);
  let P = palCache.get(key);
  if (P) return P;
  if (setting === 'evening') P = lerpPal(PAL.gold, PAL.dusk, q(dusk) / 64);
  else if (setting === 'new') P = Object.assign({}, PAL.fresh);
  else P = Object.assign({}, PAL.day);
  const er = q(erupt) / 64;
  P.E = EL;
  P.EL = EL;
  P.erupt = er;
  P.setting = setting;
  if (EL > 0) {
    for (const k in ERUPT_PAL) {
      const [v, a] = ERUPT_PAL[k];
      P[k] = typeof v === 'number' ? lerp(P[k], v, EL * a) : mix(P[k], v, EL * a);
    }
    P.sunA *= 1 - EL; P.sunDisc *= 1 - EL; P.rays *= 1 - EL;
    P.glow = Math.max(P.glow, EL);
  }
  const murk = smoothstep(0.28, 1, q(lava) / 64) * 0.32;
  if (murk > 0) for (const k of ['w0', 'w1', 'w2', 'w3']) P[k] = mix(P[k], '#4E3A38', murk);
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
    if (P.mulA > 0) c = mulCol(c, P.mul, P.mulA * (1 - far * 0.5));
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
  P.skyStops = [[WY0, P.skyTop], [-60, P.skyTop], [232, P.skyMid], [456, P.skyBot]];
  const wStops = [[456, P.w0], [494, P.w1], [620, P.w2], [812, P.w3]];
  P.wStops = wStops;
  P.waterBand = (y) => stopsColor(wStops, y);
  if (palCache.size > 4000) palCache.clear();
  palCache.set(key, P);
  return P;
}
// vertical linear gradient from [[y, colour], ...] stops (world units)
function vGrad(ctx, stops, alpha = 1) {
  const y0 = stops[0][0], y1 = stops[stops.length - 1][0];
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [y, c] of stops) g.addColorStop(clamp((y - y0) / (y1 - y0)), alpha < 1 ? rgba(c, alpha) : c);
  return g;
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
    barryRock: o.barryRock !== false,
    birds: o.birds ?? true,
    skyTint: o.skyTint,
    raft: !!o.raft,
    hillPuff: clamp(o.hillPuff ?? 0),
    grade: o.grade ?? 0,
    puffs: o.puffs || null,
    groveTaken: Math.max(0, Math.floor(o.groveTaken ?? 0)),
    groveShake: clamp(o.groveShake ?? 0),
    flash: o.flash,
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
const POOL_PATH = newPath((p) => blobP(p, POOL_PTS));
// the outflow river: leaves the pool at the left, bends toward the viewer around x -700 (rapids)
// and runs off the painted world at x -1580
const RIVER_TOP = [[238, 534], [180, 556], [112, 562], [20, 566], [-120, 571], [-290, 579], [-460, 594], [-620, 613],
  [-770, 627], [-930, 632], [-1090, 627], [-1290, 619], [-1580, 614]];
const RIVER_BOT = [[-1580, 702], [-1290, 708], [-1090, 716], [-930, 721], [-770, 715], [-620, 699], [-460, 676],
  [-290, 654], [-120, 637], [20, 631], [110, 628], [176, 634], [236, 662]];
const RIVER_TOP_D = openSpline(RIVER_TOP, 6), RIVER_BOT_D = openSpline(RIVER_BOT, 6);
const RIVER_DENSE = RIVER_TOP_D.concat(RIVER_BOT_D);
const RIVER_PATH = newPath((p) => polyP(p, RIVER_DENSE));
function inPool(x, y) { return pointInPoly(POOL_DENSE, x, y) || pointInPoly(RIVER_DENSE, x, y); }
// river top / bottom bank y at x (x < 240)
function riverEdge(D, x) {
  for (let i = 1; i < D.length; i++) {
    const a = D[i - 1], b = D[i];
    if ((x - a[0]) * (x - b[0]) <= 0 && a[0] !== b[0]) return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0]));
  }
  return null;
}
const riverTopY = (x) => riverEdge(RIVER_TOP_D, x) ?? 560, riverBotY = (x) => riverEdge(RIVER_BOT_D, x) ?? 640;
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
      { x: 326, y: 548, scale: 0.74, flip: false },
      { x: 500, y: 516, scale: 0.68, flip: true },
      { x: 884, y: 510, scale: 0.66, flip: false },
      { x: 1068, y: 540, scale: 0.74, flip: true },
    ],
  },
  // Barry's rock: a flat-topped boulder in the water between Barry and Doreen (a little behind
  // them) for the chart board / helmet / thermometer. top = where a prop rests on it.
  barryRock: { x: 798, y: 552, rx: 38, ry: 21, top: { x: 794, y: 532 } },
  thermometerSpot: { x: 770, y: 598 },
  riverMouth: { x: 150, y: 596 },
  raftMoor: { x: 70, y: 597 },
  moorPost: { x: 118, y: 558 },
  // centreline of the outflow river, mouth → off the world at the left (the raft's escape route)
  riverPath: [{ x: 150, y: 597 }, { x: 20, y: 598 }, { x: -120, y: 604 }, { x: -290, y: 616 }, { x: -460, y: 635 },
    { x: -620, y: 656 }, { x: -770, y: 671 }, { x: -930, y: 676 }, { x: -1090, y: 671 }, { x: -1290, y: 663 }, { x: -1580, y: 658 }],
  rapids: { x0: -880, x1: -560 },
  // ground points (bottom of the post) on the back-left bank, nearest the pool first; all point LEFT.
  // suggested order of the montage gags: EXIT, EVACUATION ROUTE, NO, REALLY. THIS WAY., YES, YOU, SUNNY
  exitSignSpots: [
    { x: 400, y: 446, dir: 'left', size: 1 },
    { x: 292, y: 449, dir: 'left', size: 1 },
    { x: 184, y: 452, dir: 'left', size: 1 },
    { x: 148, y: 500, dir: 'left', size: 0.6 },
  ],
  rulesSignSpot: { x: 604, y: 452 },      // the SPRING RULES sign on the back bank (behind the swimmers)
  escapePath: [{ x: 650, y: 600 }, { x: 470, y: 540 }, { x: 340, y: 474 }, { x: 200, y: 476 }, { x: 128, y: 532 }, { x: 70, y: 596 }],
  signPos: { x: 1150, y: 446 },
  volcanoPeak: { x: 860, y: 150 },
  craterPos: { x: 860, y: 150, w: 110 },
  grove: { x: 768, y: 346, w: 100 },       // orange grove on the lower-left flank
  // bounce points for the orange that shakes loose and plops into the back-right of the pool
  orangeRoll: [{ x: 796, y: 330 }, { x: 838, y: 370 }, { x: 884, y: 404 }, { x: 930, y: 432 }, { x: 968, y: 452 }, { x: 994, y: 480 }],
  lavaEntry: { x: 990, y: 468 },
  lavaEntry2: { x: 1140, y: 488 },
  // the fish hop out of the pool over the LEFT rim rocks into the river outlet and away (s04)
  fishHop: [{ x: 300, y: 562 }, { x: 200, y: 520 }, { x: 120, y: 600 }, { x: -140, y: 606 }],
  // suggested cameras on Mount Snooze (the sneeze puffs hang inside 'sneeze'; 'erupting' frames the plume)
  volcanoCam: {
    dormant: { x: 860, y: 214, zoom: 1.75 },
    sneeze: { x: 872, y: 196, zoom: 1.6 },
    erupting: { x: 860, y: 160, zoom: 1.05 },
  },
};
SPRING.rulesSignPos = SPRING.rulesSignSpot;   // alias (script notes)
const NEW_SPRING = Object.assign({}, SPRING, {
  signPos: { x: 1150, y: 446 },
  rulesSignSpot: { x: 990, y: 452 },     // planted beside the SNOOZE SPRINGS 2 sign
  tinyHill: { x: 880, y: 322 },   // top of the innocent little hill where Mount Snooze would be
  hillPuffPos: { x: 880, y: 318 },
  hillPuffScale: 0.62,            // puff sizes are multiplied by this (the hill is small and far)
  hillCam: { x: 880, y: 300, zoom: 2.2 },
  volcanoPeak: null, craterPos: null, lavaEntry: null, lavaEntry2: null, grove: null, grovePos: null, groveOranges: null,
  orangeRoll: null, volcanoCam: null, rapids: null,
});
NEW_SPRING.rulesSignPos = NEW_SPRING.rulesSignSpot;
// Clamp a camera {x, y, zoom, shake} so the 1280x720 view (plus the shake margin) stays inside the
// painted world. Returns a new object.
function clampCam(cam, world = SPRING.world) {
  const out = Object.assign({ x: 640, y: 360, zoom: 1 }, cam);
  const minZ = Math.max(1280 / (world.x1 - world.x0), 720 / (world.y1 - world.y0));
  out.zoom = Math.max(minZ * 1.001, out.zoom);
  const m = ((out.shake || 0) * 1.2) / out.zoom;
  const hw = 640 / out.zoom + m, hh = 360 / out.zoom + m;
  out.x = clamp(out.x, world.x0 + hw, Math.max(world.x0 + hw, world.x1 - hw));
  out.y = clamp(out.y, world.y0 + hh, Math.max(world.y0 + hh, world.y1 - hh));
  return out;
}
SPRING.clampCam = (cam) => clampCam(cam, SPRING.world);
NEW_SPRING.clampCam = SPRING.clampCam;

// =====================================================================================
// baked scenery (constant geometry → Path2D, built once at load)
// =====================================================================================
// faint lighter stripes on the water (the storybook "banded" water, over a smooth gradient)
const POOL_STRIPES = bandsOf(POOL_DENSE, 0, 0, [469, 478, 499, 512, 548, 572, 632, 668, 752, 820]).filter((_, i) => i % 2 === 0);

// clouds (moving; shapes constant)
// clouds: `far` ones sit low behind the hills and are baked into the static sky; the others drift
function makeClouds(seed, farXs, nearList) {
  const r = rng(seed), list = [];
  const make = (far, x0, y, s, v) => {
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
    list.push({ x0, y, s, v, far, w, puffs: puffs.map((p) => [p[0] - w / 2 + 8, p[1], p[2]]) });
  };
  for (const x of farXs) make(true, x + r.range(-40, 40), r.range(262, 312), r.range(0.4, 0.6), 0);
  for (const [x, y] of nearList) make(false, x + r.range(-40, 40), y + r.range(-15, 15), r.range(0.7, 1.2), r.range(3, 6));
  return list;
}
const CLOUDS = makeClouds(77, [-1180, -560, 80, 1250, 1600],
  [[-200, 20], [560, -60], [1000, 40], [300, -210], [1420, 70], [1900, -150], [-900, -40], [-1400, 60]]);
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
// far blue range: peaks well away from Mount Snooze and drops BEHIND it (no ghost double outline)
const MTN_PTS = ridgePts(3.3, 300, 30, 0.0036, 46, (x) => 150 * bump(x, 880, 400) - 40 * bump(x, 300, 190) - 52 * bump(x, 1450, 200) - 26 * bump(x, -760, 260) + 22 * bump(x, -1150, 200));
const MTN = ridgePath(MTN_PTS, 0, 420);
const MTN_RIM = newPath((p) => { p.moveTo(MTN_PTS[0][0], MTN_PTS[0][1]); splineTo(p, MTN_PTS); for (let i = MTN_PTS.length - 1; i >= 0; i--) p.lineTo(MTN_PTS[i][0] + 3, MTN_PTS[i][1] + 5); p.closePath(); });
const FAR_HILLS = ridgePath(ridgePts(8.1, 352, 20, 0.007, 30, (x) => 26 * bump(x, 880, 260)), 7, 404);

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
const VOLC_BANDS = bandsOf(VOLC_POLY, 0, 0, [140, 160, 176, 190, 204, 220, 238, 258, 280, 304, 330, 358, 388, 414, 442]);
const VOLC_RIDGE = openSpline([[858, 156], [864, 196], [874, 246], [892, 300], [916, 352], [946, 404], [982, 470], [1000, 540]], 4);
// shadow (right) side, bounded by the main ridge; a softer half-shadow band hugs the ridge
const VOLC_SHADOW = (() => {
  const i0 = VOLC_DENSE.findIndex((q) => q[0] >= 858);
  const right = VOLC_DENSE.slice(i0).reverse();
  return newPath((p) => polyP(p, VOLC_RIDGE.filter((q) => q[1] < 440).concat([[960, 440], [1344, 440]], right)));
})();
const VOLC_HALFSHADE = newPath((p) => {
  const L = VOLC_RIDGE.filter((q) => q[1] < 440);
  polyP(p, L.map(([x, y]) => [x - 4 - (y - 150) * 0.1, y]).concat(L.slice().reverse()));
});
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
    ribbonP(lit, sp.map(([x, y], i) => [x - w(i) * 0.6, y]), 0, 0, (u) => lerp(1.5, 22, Math.pow(u, 0.8)));
    ribbonP(dark, sp.map(([x, y], i) => [x + w(i) * 0.75, y]), 0, 0, (u) => lerp(1.5, 28, Math.pow(u, 0.8)));
  }
  return { lit, dark };
})();
const GULLY_DATA = RIDGES;
// dark ash cap around the summit (scalloped lower edge), crater geometry, old lava scars
const VOLC_CAP = newPath((p) => {
  // ash-dark summit with drippy streaks running down the cone
  p.moveTo(770, volcY(770) - 2);
  for (let x = 770; x <= 954; x += 4) p.lineTo(x, volcY(x) - 2);
  const r = rng(515);
  for (let x = 954; x >= 770; x -= 9) {
    const base = Math.max(volcY(x) + 10, 186 + 0.0035 * (x - 862) * (x - 862));
    const drip = r() < 0.45 ? r.range(14, 34) : r.range(0, 6);
    p.lineTo(x + 2.5, base);
    p.quadraticCurveTo(x, base + drip * 1.15, x - 2.5, base);
  }
  p.closePath();
});
function jaggedEllipse(cx, cy, rx, ry, seed, amp, n = 22) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, front = Math.sin(a) > 0 ? 1 : 0.35;
    const k = 1 + (hash1(seed + i * 1.37) - 0.5) * amp * front;
    out.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return out;
}
const CRATER = {
  lip: newPath((p) => blobP(p, jaggedEllipse(860, 151.5, 50, 10.5, 3, 0.16))),
  wall: newPath((p) => blobP(p, jaggedEllipse(860, 151, 42, 7.6, 7, 0.14))),
  throat: newPath((p) => blobP(p, jaggedEllipse(860, 153.4, 32, 4.6, 11, 0.12))),
  rimHi: newPath((p) => { const q = jaggedEllipse(860, 151.5, 50, 10.5, 3, 0.16); const sel = q.filter((_, i) => i >= 2 && i <= 9); p.moveTo(sel[0][0], sel[0][1]); splineTo(p, sel); }),
};
const SCARS = (() => {
  const p = new Path2D();
  ribbonP(p, openSpline([[806, 176], [784, 214], [760, 252], [734, 290], [708, 326], [684, 358]], 4), 0, 0, (u) => lerp(2, 9, u) * (1 - 0.5 * Math.sin(u * 9) * 0.3));
  ribbonP(p, openSpline([[848, 178], [842, 222], [842, 266], [852, 308], [866, 344]], 4), 0, 0, (u) => lerp(2, 8, u));
  return p;
})();
// boulders & ledges on the slopes (small lit/dark pairs)
const VOLC_ROCKS = (() => {
  const dark = new Path2D(), lit = new Path2D();
  [[742, 232, 9], [790, 286, 7], [700, 300, 8], [930, 236, 8], [990, 300, 10], [1050, 330, 7], [884, 262, 6], [830, 330, 7], [660, 345, 6], [960, 352, 6]]
    .forEach(([x, y, r]) => {
      ellipseP(dark, x, y + r * 0.25, r * 1.5, r * 0.62);
      ellipseP(lit, x - r * 0.25, y - r * 0.05, r * 1.05, r * 0.42);
    });
  return { dark, lit };
})();
// the orange grove on the lower-left flank (between the two left lava channels)
const GROVE_TREES = [[724, 344, 10.5], [748, 334, 11.5], [772, 340, 10], [796, 332, 9.5], [736, 362, 11], [762, 358, 12], [788, 360, 10.5], [812, 352, 9]];
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

// crags, ledges and rubble on the lower slopes (so the z2 close-up has some geology)
const CRAGS = (() => {
  const lip = new Path2D(), ledgeSh = new Path2D(), pebble = new Path2D();
  const r = rng(4040);
  // strata ledges: short contour arcs (sagging toward the viewer like contours on a cone)
  for (let i = 0; i < 26; i++) {
    const y0 = r.range(250, 384), half = (y0 - 140) * 1.12;
    const cx = 860 + r.range(-0.8, 0.8) * half, len = r.range(16, 40) * (0.6 + (y0 - 190) / 300);
    if (cx > 700 && cx < 830 && y0 > 312) continue; // keep the grove clean
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const x = cx - len / 2 + (k / 6) * len, u = (x - 860) / Math.max(40, half);
      const y = y0 + 16 * (1 - u * u) * (y0 - 140) / 240;
      if (y > volcY(x) + 6) pts.push([x, y]);
    }
    if (pts.length < 4) continue;
    lip.moveTo(pts[0][0], pts[0][1]); polyTo(lip, pts.slice(1));
    ledgeSh.moveTo(pts[0][0], pts[0][1] + 1.5); polyTo(ledgeSh, pts.slice(1).map(([x, y]) => [x, y + 1.5]));
  }
  for (let i = 0; i < 46; i++) {
    const x = r.range(560, 1180), y = r.range(320, 400);
    if (y < volcY(x) + 8) continue;
    ellipseP(pebble, x, y, r.range(1.5, 3.2), r.range(0.9, 1.8));
  }
  // chunky outcrops low on the slopes, half sunk into the vegetation skirt (same build as the rocks)
  const list = [[646, 352, 18, 11], [702, 318, 11, 7], [936, 322, 14, 8], [992, 302, 10, 6], [1046, 346, 17, 10],
    [1104, 376, 15, 9], [606, 388, 15, 9], [966, 366, 13, 8], [862, 314, 8, 5], [1150, 396, 12, 7]]
    .map(([x, y, rx, ry], i) => makeRock(x, y, rx, ry, 7100 + i, false));
  return { lip, ledgeSh, pebble, rocks: bakeRocks(list, 1, false, 2000) };
})();
// lit (left) half of the cone, bounded by the main ridge → the light/shadow terminator
const VOLC_LITSIDE = (() => {
  const i0 = VOLC_DENSE.findIndex((q) => q[0] >= 858);
  const left = VOLC_DENSE.slice(0, i0);
  return newPath((p) => polyP(p, left.concat(VOLC_RIDGE.filter((q) => q[1] < 440), [[960, 440], [430, 440]])));
})();

// lava paths (centrelines; drawn tapered with noisy width, crust edges and a lobe at the end, and
// clipped at the treeline so they run on BEHIND the jungle)
const LAVA_A = openSpline([[812, 160], [792, 196], [770, 234], [744, 272], [716, 308], [688, 342], [660, 374], [636, 404], [618, 432]], 5);
const LAVA_B = openSpline([[846, 162], [838, 204], [833, 250], [840, 296], [856, 338], [878, 374], [904, 402], [930, 430]], 5);
const LAVA_C = openSpline([[902, 160], [928, 202], [960, 244], [990, 286], [1022, 326], [1050, 360], [1070, 392]], 5);
const LAVA_A_L = polyLength(LAVA_A), LAVA_B_L = polyLength(LAVA_B), LAVA_C_L = polyLength(LAVA_C);
// braided side channels: [river, from u, to u, lateral offset (+ = right of travel), width k]
const LAVA_BRAIDS = [[LAVA_A, 0.34, 0.72, -16, 0.42, 7], [LAVA_B, 0.42, 0.86, 15, 0.4, 8], [LAVA_A, 0.62, 0.95, 13, 0.32, 9]];
// the two lava tongues that come out of the jungle at the back-right and pour into the pool
const LAVA_P1 = openSpline([[981, 438], [985, 450], [990, 462], [996, 477]], 6);
const LAVA_P2 = openSpline([[1127, 444], [1131, 457], [1136, 470], [1141, 489]], 6);
const LAVA_P1_L = polyLength(LAVA_P1), LAVA_P2_L = polyLength(LAVA_P2);

// --- jungle canopy bands (scalloped silhouettes with rim light + inner rows) -----------
// Scalloped canopy band, baked as x-chunks (so Skia culls the off-screen parts cheaply).
const CHUNKS = [[-1e9, -10], [-40, 650], [620, 1300], [1270, 1e9]];
function scallopBand(seed, top, step, bumpK, bottom, rimOff = [-2.5, -3], x0 = WX0 - 40, x1 = WX1 + 40) {
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
  // rim-light crescents: the band's top edge shifted by rimOff, closed back along the edge (only
  // the thin sliver above the band survives once the band itself is filled over it)
  const rimsFor = ([ox, oy]) => CHUNKS.map(([c0, c1]) => {
    const sel = bumps.filter((q) => q[6] > c0 && q[0] < c1);
    if (!sel.length) return null;
    const p = new Path2D();
    p.moveTo(sel[0][0] + ox, sel[0][1] + oy);
    for (const q of sel) p.bezierCurveTo(q[2] + ox, q[3] + oy, q[4] + ox, q[5] + oy, q[6] + ox, q[7] + oy);
    const last = sel[sel.length - 1];
    p.lineTo(last[6], last[7] + 6);
    for (let i = sel.length - 1; i >= 0; i--) { const q = sel[i]; p.bezierCurveTo(q[4], q[5] + 6, q[2], q[3] + 6, q[0], q[1] + 6); }
    p.closePath();
    return p;
  }).filter(Boolean);
  const rims = rimsFor(rimOff);
  // the same crescents lit from the volcano: right side for the part left of it, left side beyond
  const rimsV = rimsFor([3, -3.5]).concat(rimsFor([-3, -3.5]));
  // everything ABOVE the band's top edge (clip region for things that disappear behind it)
  const above = new Path2D();
  above.moveTo(bumps[0][0], WY0 - 10); above.lineTo(bumps[0][0], bumps[0][1]);
  for (const q of bumps) above.bezierCurveTo(q[2], q[3], q[4], q[5], q[6], q[7]);
  above.lineTo(bumps[bumps.length - 1][6], WY0 - 10); above.closePath();
  return { chunks, rims, rimsV, above, bumps };
}
const profA = (x) => (x < 430 ? 282 : x < 570 ? lerp(282, 386, smoothstep(430, 570, x)) : x < 1150 ? 388 : x < 1260 ? lerp(388, 300, smoothstep(1150, 1260, x)) : 296) + noise1(x * 0.011 + 3) * (x > 570 && x < 1150 ? 5 : 20);
const profB = (x) => (x < 460 ? 338 : x < 590 ? lerp(338, 410, smoothstep(460, 590, x)) : x < 1160 ? 410 : x < 1250 ? lerp(410, 344, smoothstep(1160, 1250, x)) : 340) + noise1(x * 0.013 + 9) * (x > 590 && x < 1160 ? 4 : 14);
const stepA = (x) => (x > 590 && x < 1140 ? 30 : 58);
const stepB = (x) => (x > 600 && x < 1150 ? 25 : 46);
const underB = (x) => Math.max(profB(x) + 34, 360);
const JUNGLE = {
  A: scallopBand(101, profA, stepA, 0.5, underB),
  A1: scallopBand(102, (x) => profA(x) + 36, stepA, 0.45, underB),
  B: scallopBand(201, profB, stepB, 0.52, 452, [-3, -3.5]),
  B1: scallopBand(202, (x) => profB(x) + 30, stepB, 0.46, 452, [-3, -3.5]),
  C: scallopBand(301, (x) => 426 + noise1(x * 0.02) * 8 + noise1(x * 0.005 + 2) * 6, () => 26, 0.5, 462, [-3, -3.5]),
  C1: scallopBand(302, (x) => 445 + noise1(x * 0.02 + 4) * 4, () => 21, 0.45, 462),
};
// emergent umbrella trees + far palms poking out of band A
const EMERGENT = (() => {
  const crowns = new Path2D(), trunks = new Path2D(), lit = new Path2D();
  const trees = [[214, 248, 62], [-130, 236, 66], [1440, 228, 64], [380, 232, 44], [-560, 230, 60], [-980, 244, 72], [-1360, 226, 56]];
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
  const palms = [[96, 372, 120, -16, 46], [536, 420, 116, 10, 40], [1056, 418, 96, 14, 34], [1352, 360, 128, -12, 46],
    [-420, 380, 126, 10, 44], [-830, 372, 118, -14, 42], [-1240, 378, 124, 12, 44]];
  for (const [x, y, h, lean, len] of palms) {
    const tx = x + lean, ty = y - h;
    trunks.moveTo(x - 3, y); trunks.quadraticCurveTo(x + lean * 0.2 + 6, y - h * 0.5, tx - 2, ty); trunks.lineTo(tx + 2, ty); trunks.quadraticCurveTo(x + lean * 0.2 + 10, y - h * 0.5, x + 3, y); trunks.closePath();
    for (let i = 0; i < 7; i++) {
      const a = -PI + (i / 6) * PI;
      const L = len * (i === 0 || i === 6 ? 0.85 : 1);
      const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.55 + L * 0.5;
      addLeaf(dark, light, null, leafPts(tx, ty, tx + Math.cos(a) * L * 0.5, ty + Math.sin(a) * L * 0.5 - L * 0.22, ex, ey, L * 0.15, 10, true));
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
const CANOPY_L_EDGE = [[-1640, 178], [-1450, 152], [-1270, 170], [-1120, 124], [-1010, 66], [-910, 44], [-800, 78], [-690, 146],
  [-580, 182], [-470, 190], [-300, 170], [-150, 168], [-20, 160], [80, 138], [170, 112], [250, 80], [318, 38], [360, -20], [384, -110], [392, -460]];
const CANOPY_L = {
  base: canopyPath(CANOPY_L_EDGE, 41, 62, -1, [-1900, -900]),
  inner: canopyPath(CANOPY_L_EDGE.map(([x, y]) => [x - 26, y - 34]), 42, 54, -1, [-1900, -900]),
  inner2: canopyPath(CANOPY_L_EDGE.map(([x, y]) => [x - 50, y - 74]), 43, 48, -1, [-1900, -900]),
};
const CANOPY_R_EDGE = [[1150, -460], [1166, -120], [1182, -40], [1214, 14], [1268, 52], [1340, 84], [1430, 108], [1560, 120], [1700, 112], [1820, 146], [2060, 150]].reverse();
const CANOPY_R = {
  base: canopyPath(CANOPY_R_EDGE, 51, 58, 1, [2400, -900]),
  inner: canopyPath(CANOPY_R_EDGE.map(([x, y]) => [x + 26, y - 34]), 52, 50, 1, [2400, -900]),
  inner2: canopyPath(CANOPY_R_EDGE.map(([x, y]) => [x + 50, y - 72]), 53, 46, 1, [2400, -900]),
};
const VINES = [
  { x: 120, y: 132, len: 220, seed: 1 }, { x: 176, y: 108, len: 150, seed: 2 }, { x: 240, y: 80, len: 250, seed: 3 },
  { x: 306, y: 40, len: 150, seed: 4 }, { x: 40, y: 150, len: 120, seed: 5 },
  { x: 1214, y: 20, len: 200, seed: 6 }, { x: 1262, y: 50, len: 140, seed: 7 }, { x: 1320, y: 80, len: 220, seed: 8 },
  { x: -640, y: 158, len: 190, seed: 9 }, { x: -740, y: 120, len: 240, seed: 10 }, { x: -1130, y: 130, len: 210, seed: 11 },
  { x: -1300, y: 160, len: 150, seed: 12 }, { x: -1200, y: 150, len: 120, seed: 13 },
];

// --- ground (baked bands) ---------------------------------------------------------------
const GROUND_POLY = (() => {
  const pts = [[WX0, WY1]];
  for (let x = WX0; x <= WX1; x += 40) pts.push([x, 440 + noise1(x * 0.03 + 7) * 4]);
  pts.push([WX1, WY1]);
  return pts;
})();
const GROUND_PATH = newPath((p) => polyP(p, GROUND_POLY));

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
function bakeRocks(list, nGroups, glints, sectorW = 320) {
  // groups = (x sector) × (alternating index), each with a bbox so off-screen sectors are skipped
  const groups = [];
  const minX = Math.min(...list.map((r) => r.x - r.rx));
  const glint = new Path2D();
  list.forEach((rk, i) => {
    const gi = Math.floor((rk.x - minX) / sectorW) * nGroups + (i % nGroups);
    if (!groups[gi]) groups[gi] = { out: new Path2D(), shade: new Path2D(), lit: new Path2D(), hl: new Path2D(), moss: new Path2D(), mossHl: new Path2D(), shadeS: new Path2D(), hlS: new Path2D(), mossHlS: new Path2D(), x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    const G = groups[gi];
    G.x0 = Math.min(G.x0, rk.x - rk.rx * 1.2); G.x1 = Math.max(G.x1, rk.x + rk.rx * 1.2);
    G.y0 = Math.min(G.y0, rk.y - rk.ry * 1.2); G.y1 = Math.max(G.y1, rk.y + rk.ry * 1.2);
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
  return { groups: groups.filter(Boolean), glint };
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
const RIVER_LIST = (() => {
  const r = rng(321), out = [];
  for (let x = WX0 - 40; x < 170; x += r.range(46, 76)) {
    const k = clamp((x + 460) / 600);    // rocks get a little bigger toward the viewer (left = nearer bend)
    out.push(makeRock(x, riverTopY(x) - 3 + r.range(-2, 2), r.range(11, 18) * (1.15 - 0.15 * k), r.range(6, 10), 3000 + x, r() < 0.45));
    const xb = x + 28;
    out.push(makeRock(xb, riverBotY(xb) + 6 + r.range(-1, 3), r.range(14, 24) * (1.2 - 0.2 * k), r.range(8, 13), 4000 + x, r() < 0.3));
  }
  // boulders in the rapids
  [[-602, 654, 18, 11], [-668, 676, 22, 13], [-736, 652, 15, 9], [-790, 690, 26, 15], [-846, 668, 16, 10], [-710, 700, 12, 8]]
    .forEach(([x, y, rx, ry], i) => out.push(makeRock(x, y, rx, ry, 5000 + i, i % 2 === 0)));
  return out.sort((a, b) => a.y - b.y);
})();
const RAPID_ROCKS = RIVER_LIST.filter((rk) => rk.x < -580 && rk.x > -870 && rk.y > riverTopY(rk.x) + 14 && rk.y < riverBotY(rk.x) - 10);
const RIVER_ROCKS = bakeRocks(RIVER_LIST, 2, true);
// Barry's rock (flat-topped, half-submerged)
const BARRY_ROCK = (() => {
  const b = SPRING.barryRock;
  const rk = makeRock(b.x, b.y, b.rx, b.ry, 4321, true);
  const flat = (pts) => pts.map(([x, y]) => [x, Math.max(y, -b.ry * 0.62)]);
  rk.pts = flat(rk.pts); rk.inner = flat(rk.inner);
  return bakeRocks([rk], 1, false);
})();
const BANK_LIST = [
  makeRock(-60, 716, 60, 38, 52, true), makeRock(60, 746, 74, 46, 51, true), makeRock(150, 792, 54, 34, 53, false),
  makeRock(-210, 768, 80, 50, 58, true), makeRock(1262, 642, 52, 36, 54, true), makeRock(1360, 702, 70, 44, 56, false),
  makeRock(1236, 754, 76, 48, 55, true), makeRock(1252, 520, 24, 16, 57, true), makeRock(1490, 622, 64, 40, 59, false),
  makeRock(-560, 800, 72, 44, 60, true), makeRock(-930, 812, 84, 50, 61, false), makeRock(-1220, 790, 70, 44, 62, true),
  makeRock(-1420, 770, 60, 38, 63, true), makeRock(-380, 760, 46, 30, 64, false),
].sort((a, b) => a.y - b.y);
const BANK_ROCKS = bakeRocks(BANK_LIST, 2, false);

// --- free water: the water surface NOT covered by rim rocks (for live water details + clipping) ----
const FREE_SPAN = (() => {
  const tab = [];
  for (let y = 450; y <= 820; y += 2) {
    const sp = poolSpan(y);
    if (!sp) { tab.push(null); continue; }
    let [x0, x1] = sp;
    for (const rk of RIM_LIST) {
      const dy = y - rk.y, ry = dy > 0 ? rk.ry * 0.62 : rk.ry;
      if (Math.abs(dy) >= ry) continue;
      const hw = rk.rx * Math.sqrt(1 - (dy / ry) * (dy / ry)) * 1.02;
      if (rk.y < backY(rk.x) + 20 && rk.x > 300 && rk.x < 1080) continue; // back-edge rocks: see FREE_BACK
      if (rk.x < 680) x0 = Math.max(x0, rk.x + hw); else x1 = Math.min(x1, rk.x - hw);
    }
    tab.push(x0 + 2 < x1 ? [x0 + 2, x1 - 2] : null);
  }
  return tab;
})();
const FREE_BACK = (() => {
  const tab = [];
  for (let x = 100; x <= 1240; x += 4) {
    let b = backY(x);
    for (const rk of RIM_LIST) {
      if (rk.y > 540 || Math.abs(x - rk.x) >= rk.rx) continue;
      const u = (x - rk.x) / rk.rx;
      b = Math.max(b, rk.y + rk.ry * 0.62 * Math.sqrt(1 - u * u) + 1.5);
    }
    tab.push(b);
  }
  return tab;
})();
function freeBack(x) { const i = Math.round((x - 100) / 4); return i >= 0 && i < FREE_BACK.length ? FREE_BACK[i] : 470; }
function freeSpan(y) { const i = Math.round((y - 450) / 2); return i >= 0 && i < FREE_SPAN.length ? FREE_SPAN[i] : null; }
// is (x, y) open water (pool or river), at least m units away from the rocks?
function freeWater(x, y, m = 0) {
  if (x < 200) {
    const top = riverTopY(x), bot = riverBotY(x);
    if (y > top + 12 + m && y < bot - 14 - m) return true;
  }
  const sp = freeSpan(y);
  if (!sp || x < sp[0] + m || x > sp[1] - m) return false;
  return y > freeBack(x) + m * 0.35;
}
// clip region = free pool water ∪ the river channel (both wound the same way → nonzero union)
const FREE_WATER_PATH = (() => {
  const left = [], right = [];
  for (let y = 452; y <= 820; y += 4) {
    const sp = freeSpan(y);
    if (!sp) continue;
    left.push([sp[0], y]); right.push([sp[1], y]);
  }
  const top = [];
  for (let x = Math.ceil(left[0][0] / 4) * 4; x <= right[0][0]; x += 4) top.push([x, Math.max(left[0][1], freeBack(x))]);
  const poly = top.concat(right, [[right[right.length - 1][0], 900], [left[left.length - 1][0], 900]], left.slice().reverse());
  const river = RIVER_TOP_D.map(([x, y]) => [x, y + 8]).concat(RIVER_BOT_D.map(([x, y]) => [x, y - 9]));
  const area = (pts) => { let a = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]); return a; };
  if (Math.sign(area(poly)) !== Math.sign(area(river))) river.reverse();
  return newPath((p) => { polyP(p, poly); polyP(p, river); });
})();

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
const FRONT_FERN_LIST = ([
  { x: 18, y: 708, len: 92, ang: -1.25, n: 5 }, { x: -50, y: 770, len: 110, ang: -1.0, n: 5 },
  { x: 1252, y: 604, len: 80, ang: -1.95, n: 5 }, { x: 1292, y: 726, len: 112, ang: -2.0, n: 5 },
  { x: 1460, y: 680, len: 100, ang: -1.6, n: 5 }, { x: -230, y: 700, len: 90, ang: -1.4, n: 4 },
  { x: -480, y: 770, len: 96, ang: -1.3, n: 5 }, { x: -1000, y: 790, len: 110, ang: -1.7, n: 5 }, { x: -1320, y: 770, len: 96, ang: -1.2, n: 4 },
  { x: -660, y: 580, len: 54, ang: -1.6, n: 4 }, { x: -1040, y: 600, len: 58, ang: -1.5, n: 4 },
]);
const FRONT_FERNS = bakeFerns(FRONT_FERN_LIST, 2);
const FRONT_HEART_LIST = [{ x: 196, y: 772, s: 26, n: 3 }, { x: 1222, y: 698, s: 24, n: 3 }, { x: -140, y: 820, s: 30, n: 3 },
  { x: -760, y: 800, s: 28, n: 3 }, { x: -1160, y: 812, s: 26, n: 3 }];
const FRONT_HEARTS = bakeHearts(FRONT_HEART_LIST);
// union of overlapping boxes → disjoint-ish rect list for a sprite layer
function mergeRects(list) {
  const out = list.map((r) => r.slice());
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < out.length && !changed; i++) for (let j = i + 1; j < out.length && !changed; j++) {
      const a = out[i], b = out[j];
      if (a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]) {
        out[i] = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
        out.splice(j, 1); changed = true;
      }
    }
  }
  return out;
}
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
    const x = r.range(WX0, WX1), y = r.range(444, 1100);
    if (inPool(x, y) || pointInPoly(POOL_DENSE, x, y - 12) || pointInPoly(RIVER_DENSE, x, y - 10)) continue;
    if (avoidBack && y < 476 && x > 460 && x < 1080) continue;
    const s = lerp(6, 18, clamp((y - 430) / 400)) * r.range(0.8, 1.2);
    grassTuft(dark, x, y, s, i);
    if (i % 2 === 0) grassTuft(light, x + s * 0.2, y, s * 0.7, i + 50);
  }
  return { dark, light };
}
const TUFTS = bakeTufts(77, 260, true);
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
const FLOWERS = bakeFlowers(99, 110, [C.fPink, C.fYellow, C.fWhite, C.fPurple], [WX0, WX1, 444, 1100]);
const SHIMMER = (() => {
  const r = rng(555), out = [];
  for (let i = 0; i < 160 && out.length < 110; i++) {
    const k = Math.pow(r(), 1.35);
    const y = lerp(476, 800, k);
    const span = freeSpan(y);
    if (!span) continue;
    const len = lerp(10, 66, k) * r.range(0.6, 1.3);
    const x = lerp(span[0] + len / 2 + 16, span[1] - len / 2 - 16, r());
    if (!freeWater(x - len / 2 - 10, y, 4) || !freeWater(x + len / 2 + 10, y, 4)) continue;
    out.push({ x, y, len, k, ph: r.range(0, TAU), sp: r.range(0.5, 1.2), bin: k < 0.3 ? 0 : k < 0.65 ? 1 : 2 });
  }
  return out;
})();

// reflections on the pool: Mount Snooze (compressed mirror image) and the jungle wall
const REFL_K = 0.3;
const VOLC_REFL = newPath((p) => {
  const pts = VOLC_DENSE.filter(([x]) => x > 470 && x < 1300).map(([x, y]) => [x, 458 + (440 - Math.min(y, 440)) * REFL_K]);
  p.moveTo(pts[0][0], 458); for (const q of pts) p.lineTo(q[0], q[1]); p.lineTo(pts[pts.length - 1][0], 458); p.closePath();
});
const JUNGLE_REFL = (() => {
  const top = [], bot = [];
  for (let x = 190; x <= 1192; x += 8) top.push([x, backY(x) - 2]);
  for (let x = 1192; x >= 190; x -= 26) {
    const taper = smoothstep(190, 300, x) * (1 - smoothstep(1110, 1192, x));
    const h = (16 + 8 * noise1(x * 0.018 + 5) + 4 * noise1(x * 0.05 + 1)) * taper + 2;
    bot.push([x, backY(x) + h]);
  }
  const path = newPath((p) => { p.moveTo(top[0][0], top[0][1]); polyTo(p, top); p.lineTo(bot[0][0], bot[0][1]); splineTo(p, bot); p.closePath(); });
  return { path, bot: bot.slice().reverse() };
})();
// (only the part of Mount Snooze above the treeline is mirrored, so it starts below the jungle's
// own reflection and clear of the back rim rocks; x is limited to the open water)
const VOLC_REFL_SLICES = (() => {
  const pts = [[470, 458]].concat(VOLC_DENSE.filter(([x]) => x > 470 && x < 1300).map(([x, y]) => [x, 458 + (440 - Math.min(y, 440)) * REFL_K]), [[1300, 458]]);
  const out = [];
  for (let i = 0; i < 10; i++) {
    const y0 = 476 + i * 7.4, poly = slab(pts, y0, y0 + 5.8 - i * 0.1).map(([x, y]) => [clamp(x, 470, 1110), y]);
    if (poly.length >= 3) out.push({ i, path: newPath((p) => polyP(p, poly)) });
  }
  return out;
})();
// small twinkle glints on the water (positions fixed, phases animate)
const GLINTS = (() => {
  const r = rng(4747), out = [];
  for (let i = 0; i < 60 && out.length < 40; i++) {
    const k = Math.pow(r(), 1.2), y = lerp(486, 790, k), sp = freeSpan(y);
    if (!sp) continue;
    const x = lerp(sp[0] + 30, sp[1] - 30, r());
    if (!freeWater(x, y, 16)) continue;
    out.push({ x, y, s: lerp(3, 8, k), ph: r(), sp: r.range(0.35, 0.8) });
  }
  return out;
})();

// =====================================================================================
// static-layer tile cache
// =====================================================================================
// Everything that does not move (sky, far hills, Mount Snooze's body, the jungle wall, ground,
// water body, rocks, the sign) is rasterised into tiles and blitted. Tiles are a pure function of
// constant inputs: (layer, variant, light corner, pixel-scale level, tile index), so frames stay
// deterministic in any render order. Each tile is rendered on its own with a fixed transform.
//  * Levels: a geometric ladder (x1.08) around the 1080p zoom-1 scale (1.5 px/unit); a frame uses the
//    nearest level (within ±3.9% of the device scale). Blits are BILINEAR onto device-pixel-snapped
//    destination rects whose source rect is the exact (fractional) pre-image, so the background
//    moves sub-pixel exactly like the live layers and adjacent tiles never seam. Only a pixel-exact
//    frame (device scale on a level, translation on the pixel grid — e.g. a held zoom-1 wide) uses the
//    cheaper nearest-neighbour blit, which is then identical. Rotated frames (camera shake) blit
//    bilinear tiles with a 1-pixel overlap. A level change during a push is a sub-pixel AA change only
//    (measured mean frame diff 1.7 at the switch vs 1.3 for an ordinary push step), so no cross-fade.
//  * Light corners: the eruption light (0 or 1) and, for the evening, dusk keys [0 .15 .3 .5 .75 1].
//    Between corners the tiles are cross-faded directly in the frame (A, then B with alpha w) —
//    no blend canvases are ever built.
//  * Memory: @napi-rs/canvas never frees a canvas that has been passed to drawImage, so tile canvases
//    are POOLED: a fixed number of identical 516x516 canvases (SPRING_CACHE_MB, default 420 MB per
//    process) is allocated on demand and recycled (LRU) — never garbage-collected. Nothing else in
//    this module creates canvases except the tiny constant glow sprites (one per colour, kept).
const TPX = 512, TGUT = 2, TSZ = TPX + 2 * TGUT, LADDER = 1.08;
const TILE_BUDGET = (+process.env.SPRING_CACHE_MB || 420) * 1048576;
const MAX_TILES = Math.max(180, Math.floor(TILE_BUDGET / (TSZ * TSZ * 4)));
const _tiles = new Map();        // key → canvas, in LRU order
const _pool = [];                // free canvases (recycled, never released)
const TSTAT = { builds: 0, evicts: 0, allocated: 0, maxTiles: MAX_TILES };
function levelOf(ds) { const q = Math.log(ds / 1.5) / Math.log(LADDER); const k = Math.round(q); return { k, L: 1.5 * Math.pow(LADDER, k), q }; }
function takeCanvas() {
  if (_pool.length) return _pool.pop();
  if (TSTAT.allocated < MAX_TILES) { TSTAT.allocated++; return createCanvas(TSZ, TSZ); }
  const [k, cv] = _tiles.entries().next().value;   // recycle the least recently used tile
  _tiles.delete(k);
  TSTAT.evicts++;
  return cv;
}
// drop every cached tile back into the pool (memory stays allocated; used by tests)
function flushTiles() { for (const cv of _tiles.values()) _pool.push(cv); _tiles.clear(); }
// layer = {id, rects: [[x0, y0, x1, y1]...] (disjoint content bounds, world units), draw(g, P, variant)}
function cornerTile(layer, variant, c, k, L, i, j) {
  const key = layer.id + '|' + variant + '|' + c.key + '|' + k + '|' + i + '|' + j;
  let cv = _tiles.get(key);
  if (cv) { _tiles.delete(key); _tiles.set(key, cv); return cv; }
  cv = takeCanvas();
  const g = cv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, TSZ, TSZ);
  g.save();
  g.setTransform(L, 0, 0, L, TGUT - i * TPX, TGUT - j * TPX);
  layer.draw(g, c.P, variant);
  g.restore();
  TSTAT.builds++;
  _tiles.set(key, cv);
  return cv;
}
// blit one level of a layer (all its light corners, cross-faded) with an overall alpha
function blitLevel(ctx, layer, corners, variant, m, k, L, alpha, V, nn, rot) {
  const tw = TPX / L, e = 1 / L;
  for (const R of layer.rects) {
    const x0 = Math.max(R[0], V.x0), y0 = Math.max(R[1], V.y0), x1 = Math.min(R[2], V.x1), y1 = Math.min(R[3], V.y1);
    if (x1 <= x0 || y1 <= y0) continue;
    for (let j = Math.floor(y0 / tw); j <= Math.floor(y1 / tw); j++) {
      for (let i = Math.floor(x0 / tw); i <= Math.floor(x1 / tw); i++) {
        const wx0 = i * tw, wy0 = j * tw;
        // only the part of the tile inside this rect (and the view) is blitted
        const sx0 = Math.max(wx0, R[0], V.x0), sy0 = Math.max(wy0, R[1], V.y0), sx1 = Math.min(wx0 + tw, R[2], V.x1), sy1 = Math.min(wy0 + tw, R[3], V.y1);
        if (sx1 <= sx0 || sy1 <= sy0) continue;
        for (let ci = 0; ci < corners.length; ci++) {
          const c = corners[ci];
          const cv = cornerTile(layer, variant, c, k, L, i, j);
          ctx.globalAlpha = (ci === 0 ? 1 : c.a) * alpha;
          if (!rot) {
            // device-pixel-snapped destination; the source rect is the exact pre-image of it
            const X0 = Math.round(m.a * sx0 + m.e), Y0 = Math.round(m.d * sy0 + m.f);
            const X1 = Math.round(m.a * sx1 + m.e), Y1 = Math.round(m.d * sy1 + m.f);
            if (X1 <= X0 || Y1 <= Y0) continue;
            const ux0 = ((X0 - m.e) / m.a - wx0) * L + TGUT, uy0 = ((Y0 - m.f) / m.d - wy0) * L + TGUT;
            const ux1 = ((X1 - m.e) / m.a - wx0) * L + TGUT, uy1 = ((Y1 - m.f) / m.d - wy0) * L + TGUT;
            ctx.drawImage(cv, ux0, uy0, ux1 - ux0, uy1 - uy0, X0, Y0, X1 - X0, Y1 - Y0);
          } else {
            const ax0 = Math.max(wx0 - e, sx0 - e), ay0 = Math.max(wy0 - e, sy0 - e), ax1 = Math.min(wx0 + tw + e, sx1 + e), ay1 = Math.min(wy0 + tw + e, sy1 + e);
            ctx.drawImage(cv, (ax0 - wx0) * L + TGUT, (ay0 - wy0) * L + TGUT, (ax1 - ax0) * L, (ay1 - ay0) * L, ax0, ay0, ax1 - ax0, ay1 - ay0);
          }
        }
      }
    }
  }
}
function drawLayer(ctx, layer, corners, variant = '') {
  const m = ctx.getTransform();
  const det = m.a * m.d - m.b * m.c;
  if (!(Math.abs(det) > 1e-9)) return;
  const ds = Math.sqrt(Math.abs(det));
  const { k, L } = levelOf(ds);
  const rot = Math.abs(m.b) > 1e-7 || Math.abs(m.c) > 1e-7 || m.a < 0 || m.d < 0;
  const V = viewRect(ctx);
  // pixel-exact frame → nearest-neighbour (identical result, ~2x cheaper)
  const fr = (v) => Math.abs(v - Math.round(v));
  const nn = !rot && Math.abs(ds / L - 1) < 4e-4 && fr(m.e) < 0.02 && fr(m.f) < 0.02;
  ctx.save();
  if (!rot) ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = !nn;
  ctx.imageSmoothingQuality = 'low';
  // (no cross-fade between levels: with bilinear blits a level change is a sub-pixel AA difference —
  // measured mean frame diff 1.7 at the switch vs 1.3 for an ordinary push step)
  blitLevel(ctx, layer, corners, variant, m, k, L, 1, V, nn, rot);
  ctx.restore();
}
// light corners for a frame: weights over (dusk key, eruption light 0|1). Dusk keys are uneven so the
// kit's default evening dusk (.15) lands exactly on one; while the eruption light ramps, dusk snaps
// to the nearest key so at most two corners cross-fade. a = progressive alpha (1 for the first).
const DUSK_KEYS = [0, 0.15, 0.3, 0.5, 0.75, 1];
function lightCorners(setting, dusk, erupt, skyTint) {
  const EL = Math.round(eruptLight(erupt) * 64) / 64;
  let d0 = 0, d1 = 0, fd = 0;
  if (setting === 'evening') {
    const d = clamp(dusk);
    let i = 0;
    while (i < DUSK_KEYS.length - 2 && d > DUSK_KEYS[i + 1]) i++;
    d0 = i; d1 = i + 1; fd = (d - DUSK_KEYS[i]) / (DUSK_KEYS[i + 1] - DUSK_KEYS[i]);
    fd = Math.round(fd * 48) / 48;
    if (fd < 0.02 || (EL > 0 && EL < 1 && fd < 0.5)) fd = 0;
    else if (fd > 0.98 || (EL > 0 && EL < 1)) fd = 1;
  }
  const list = [];
  const add = (di, el, w) => {
    if (w < 0.004) return;
    const tint = skyTint ? skyTint[0] + Math.round(skyTint[1] * 64) : '';
    const dq = DUSK_KEYS[di];
    list.push({ key: setting + dq + 'e' + el + tint, P: palette(setting, dq, el ? 0.6 : 0, skyTint, 0, el), w });
  };
  add(d0, 0, (1 - fd) * (1 - EL)); if (d1 !== d0) add(d1, 0, fd * (1 - EL));
  add(d0, 1, (1 - fd) * EL); if (d1 !== d0) add(d1, 1, fd * EL);
  list.sort((a, b) => b.w - a.w);
  let acc = 0;
  for (const c of list) { acc += c.w; c.a = clamp(c.w / acc); }
  list[0].a = 1;
  return list.filter((c, i) => i === 0 || c.a > 0.004);
}

// =====================================================================================
// sky, clouds, hills
// =====================================================================================
function drawSkyStatic(g, P) {
  g.fillStyle = vGrad(g, P.skyStops);
  g.fillRect(WX0 - 10, WY0 - 10, WX1 - WX0 + 20, 500 - WY0);
  if (P.sunA > 0.01) {
    // soft sun bloom (one radial gradient) + disc in the evening
    const R = P.sunDisc > 0.01 ? 430 : 520;
    const gr = g.createRadialGradient(P.sunX, P.sunY, 0, P.sunX, P.sunY, R);
    gr.addColorStop(0, rgba(P.sunCol, P.sunA * 0.9)); gr.addColorStop(0.12, rgba(P.sunCol, P.sunA * 0.55));
    gr.addColorStop(0.4, rgba(P.sunCol, P.sunA * 0.18)); gr.addColorStop(1, rgba(P.sunCol, 0));
    g.fillStyle = gr;
    g.fillRect(P.sunX - R, P.sunY - R, 2 * R, 2 * R);
  }
  if (P.sunDisc > 0.01) {
    const r = P.setting === 'new' ? 30 : 40;
    const gr = g.createRadialGradient(P.sunX, P.sunY, r * 0.4, P.sunX, P.sunY, r);
    gr.addColorStop(0, rgba(mix(P.sunCol, '#FFFFFF', 0.7), P.sunDisc)); gr.addColorStop(1, rgba(mix(P.sunCol, '#FFFFFF', 0.35), P.sunDisc));
    g.fillStyle = gr;
    g.beginPath(); circleP(g, P.sunX, P.sunY, r); g.fill();
  }
  if (P.EL > 0) {
    // the sky glows behind Mount Snooze (one smooth gradient; the live layer adds the flicker)
    const R = 620;
    const gr = g.createRadialGradient(860, 190, 0, 860, 190, R);
    gr.addColorStop(0, `rgba(255,120,48,${0.5 * P.EL})`); gr.addColorStop(0.35, `rgba(255,96,40,${0.22 * P.EL})`); gr.addColorStop(1, 'rgba(255,80,30,0)');
    g.fillStyle = gr;
    g.fillRect(860 - R, 190 - R, 2 * R, 2 * R);
  }
  drawClouds(g, 0, P, true);
}
function drawClouds(ctx, t, P, far, list = CLOUDS, V = null) {
  const span = WX1 - WX0 + 700;
  for (const c of list) {
    if (c.far !== far) continue;
    const x = far ? c.x0 : WX0 - 350 + ((((c.x0 - WX0 + 350 + t * c.v) % span) + span) % span);
    if (V && !vis(V, x - (c.w / 2 + 60) * c.s, c.y - 130 * c.s, x + (c.w / 2 + 60) * c.s, c.y + 10)) continue;
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
  for (let i = 0; i < 4; i++) {
    const x = WX0 + ((t * (18 + i * 5) + i * 810) % (WX1 - WX0 + 200));
    const y = 120 + (i % 3) * 30 + Math.sin(t * 0.5 + i) * 8;
    const f = Math.sin(t * 7 + i * 2.1) * 3.4;
    const s = 1 - (i % 3) * 0.18;
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
function drawFarHills(g, P) {
  fillOff(g, MTN_RIM, P.hl(C.mtn, 0.8, 1.4));
  fillOff(g, MTN, P.g(C.mtn, 0.9));
  fillOff(g, FAR_HILLS, P.hl(C.hillFar, 0.66, 0.6), -2, -2);
  fillOff(g, FAR_HILLS, P.g(C.hillFar, 0.72));
}

// =====================================================================================
// Mount Snooze
// =====================================================================================
function drawVolcanoStatic(g, P) {
  const far = 0.14;
  const EL = P.EL;
  // body: shade-side gradient everywhere, then the lit half → a clear terminator along the ridge
  g.fillStyle = vGrad(g, [[140, P.g('#4E4C66', far)], [250, P.g(C.volcShade, far)], [440, P.g('#606880', far + 0.14)]]);
  g.fill(VOLC_SIL);
  g.fillStyle = vGrad(g, [[140, P.hl('#727290', far, 0.5)], [240, P.hl(C.volcLit, far, 0.75)], [440, P.g('#8890A6', far + 0.14)]]);
  g.fill(VOLC_LITSIDE);
  // everything on the cone's surface stays inside its silhouette (no ghost bands along the flanks)
  g.save();
  g.clip(VOLC_SIL);
  fillOff(g, VOLC_HALFSHADE, rgba(P.g(C.volcBase, far), 0.75));
  // ash-dark summit, radiating ridges (lit edge / shadowed groove), old lava scars
  fillOff(g, VOLC_CAP, rgba(P.g('#3E3B52', far), 0.55));
  fillOff(g, RIDGE_PATHS.dark, rgba(P.g(C.volcDark, far), 0.28));
  fillOff(g, RIDGE_PATHS.lit, rgba(P.hl(C.volcRim, far, 1.1), 0.3 * (1 - 0.65 * EL)));
  fillOff(g, SCARS, rgba(P.g('#3A3248', far), 0.3));
  // geology: strata ledges, rubble and chunky outcrops on the lower slopes
  g.lineCap = 'round';
  g.strokeStyle = rgba(P.g(C.volcDark, far), 0.3); g.lineWidth = 2; g.stroke(CRAGS.ledgeSh);
  g.strokeStyle = rgba(P.hl('#A4A4BC', far, 1), 0.45); g.lineWidth = 1.2; g.stroke(CRAGS.lip);
  fillOff(g, CRAGS.pebble, rgba(P.g(C.volcDark, far), 0.5));
  g.restore();
  drawRocks(g, P, CRAGS.rocks, { dark: '#3E3F55', shade: '#56586F', base: '#7E7F98', light: '#A6A6BE' });
  // sky rim light along the lit (left) silhouette
  g.save();
  g.beginPath(); g.rect(400, 100, 462, 400); g.clip();
  g.strokeStyle = rgba(P.hl('#C8C8DC', far, 1.4), 0.75); g.lineWidth = 2.4; g.stroke(VOLC_EDGE);
  g.restore();
  if (EL > 0) {
    // lit from above by the crater and the burning plume
    g.save();
    g.clip(VOLC_SIL);
    const gr = g.createRadialGradient(860, 150, 0, 860, 150, 300);
    gr.addColorStop(0, `rgba(255,110,40,${0.55 * EL})`); gr.addColorStop(0.5, `rgba(255,80,30,${0.18 * EL})`); gr.addColorStop(1, 'rgba(255,70,30,0)');
    g.fillStyle = gr; g.fillRect(560, -150, 600, 600);
    g.restore();
  }
  // vegetation skirt
  fillOff(g, VEG_A, P.hl(C.jLight, 0.42, 0.9), -2, -2.5);
  fillOff(g, VEG_A, P.g(C.jMid, 0.44));
  fillOff(g, VEG_B, P.hl(C.jMid, 0.42, 0.7), -2, -2.5);
  fillOff(g, VEG_B, P.g(C.jDeep, 0.42));
  // crater (dormant state; the live layer heats it up)
  g.fillStyle = P.hl('#9896B2', far, 0.7); g.fill(CRATER.lip);
  g.fillStyle = P.g('#4E4866', far); g.fill(CRATER.wall);
  g.fillStyle = P.g(C.crater, far); g.fill(CRATER.throat);
  g.strokeStyle = P.hl(C.volcRim, far, 1.4); g.lineWidth = 2; g.lineCap = 'round'; g.stroke(CRATER.rimHi);
}
// crater heat (single gradients, no stacked discs), fissures. glowK = smoothstep(.03,.2,erupt)
function drawCraterHeat(ctx, t, P, o) {
  const glowK = smoothstep(0.03, 0.2, o.erupt);
  if (glowK <= 0) return;
  const fl = 0.82 + 0.18 * noise1(t * 7 + 3);
  ctx.save();
  // sky/smoke glow above the summit (smooth radial falloff)
  ctx.globalCompositeOperation = 'lighter';
  const R = 70 + 80 * glowK;
  let gr = ctx.createRadialGradient(860, 150, 0, 860, 150, R);
  gr.addColorStop(0, `rgba(255,130,50,${0.42 * glowK * fl})`); gr.addColorStop(0.3, `rgba(255,100,40,${0.16 * glowK * fl})`); gr.addColorStop(1, 'rgba(255,90,30,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(860 - R, 150 - R, 2 * R, 2 * R);
  ctx.globalCompositeOperation = 'source-over';
  // inside of the crater heats up
  ctx.fillStyle = rgba('#B8441E', 0.85 * glowK); ctx.fill(CRATER.wall);
  gr = ctx.createRadialGradient(860, 156, 2, 860, 156, 34);
  gr.addColorStop(0, '#FFE6A0'); gr.addColorStop(0.5, '#FF9A30'); gr.addColorStop(1, '#E2501C');
  ctx.globalAlpha = glowK; ctx.fillStyle = gr; ctx.fill(CRATER.throat); ctx.globalAlpha = 1;
  ctx.strokeStyle = rgba('#FFB060', 0.7 * glowK * fl); ctx.lineWidth = 1.6; ctx.stroke(CRATER.rimHi);
  // glowing fissures down the gullies
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(255,110,40,${0.55 * glowK * (0.75 + 0.25 * noise1(t * 6))})`;
  ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [pts] of [GULLY_DATA[1], GULLY_DATA[3], GULLY_DATA[4]]) { const sp = openSpline(pts.slice(0, 3), 4); ctx.moveTo(sp[0][0], sp[0][1]); polyTo(ctx, sp); }
  ctx.stroke();
  ctx.restore();
}
// little round orange trees; they shiver with o.rumble / o.groveShake (and while erupting).
// o.groveTaken removes that many oranges, in SPRING.groveOranges order.
const GROVE_ORANGES = (() => {
  const out = [];
  GROVE_TREES.forEach(([x, y, r], i) => {
    for (let k = 0; k < 4; k++) {
      const a = 0.6 + k * 1.55 + i, d = r * (0.42 + 0.22 * hash1(i * 7 + k));
      out.push({ tree: i, x: Math.cos(a) * d, y: -r * 0.55 + Math.sin(a) * d * 0.85 });
    }
  });
  // removal order: start with the orange nearest the top of the roll path, then pseudo-random
  const s = SPRING.orangeRoll[0];
  const keyed = out.map((q, i) => ({ q, i, d: Math.hypot(GROVE_TREES[q.tree][0] + q.x - s.x, GROVE_TREES[q.tree][1] + q.y - s.y) }));
  const first = keyed.reduce((a, b) => (b.d < a.d ? b : a));
  const rest = keyed.filter((k) => k !== first).sort((a, b) => hash1(a.i * 3.7) - hash1(b.i * 3.7));
  return [first].concat(rest).map((k) => k.q);
})();
SPRING.groveOranges = GROVE_ORANGES.map((q) => ({ x: Math.round((GROVE_TREES[q.tree][0] + q.x) * 10) / 10, y: Math.round((GROVE_TREES[q.tree][1] + q.y) * 10) / 10 }));
SPRING.grovePos = SPRING.groveOranges[0];
function groveShake(o) { return Math.max(o.rumble || 0, o.groveShake || 0, smoothstep(0.05, 0.3, o.erupt || 0) * 0.8); }
function drawGrove(ctx, t, P, o) {
  const far = 0.3, shake = t == null ? 0 : groveShake(o);
  const trunk = new Path2D(), dark = new Path2D(), lit = new Path2D(), fruit = new Path2D(), shine = new Path2D();
  const off = GROVE_TREES.map(([x, y, r], i) => {
    const jx = shake > 0 ? noise1(t * 21 + i * 3.3) * shake * 1.8 : 0, jy = shake > 0 ? noise1(t * 17 + i * 5.1) * shake * 0.8 : 0;
    trunk.rect(x - 1.6, y - 2, 3.2, r * 0.95);
    const cx = x + jx, cy = y - r * 0.55 + jy;
    circleP(dark, cx, cy, r);
    circleP(dark, cx - r * 0.62, cy + r * 0.22, r * 0.62);
    circleP(dark, cx + r * 0.64, cy + r * 0.2, r * 0.6);
    circleP(lit, cx - r * 0.3, cy - r * 0.34, r * 0.5);
    return [jx, jy];
  });
  const taken = o.groveTaken || 0;
  GROVE_ORANGES.forEach((q, n) => {
    if (n < taken) return;
    const [x, y] = GROVE_TREES[q.tree], [jx, jy] = off[q.tree];
    const fx = x + q.x + jx, fy = y + q.y + jy;
    circleP(fruit, fx, fy, 2.3);
    circleP(shine, fx - 0.7, fy - 0.8, 0.8);
  });
  ctx.fillStyle = P.g(C.trunk, far); ctx.fill(trunk);
  ctx.fillStyle = P.g('#3E8250', far - 0.1); ctx.fill(dark);
  ctx.fillStyle = P.hl('#5FA662', far - 0.1, 0.8); ctx.fill(lit);
  ctx.fillStyle = P.g('#FF9A1F', 0.08); ctx.fill(fruit);
  ctx.fillStyle = rgba('#FFF2C8', 0.8); ctx.fill(shine);
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
// A discrete smoke puff from the crater (the "sneeze" gag). k 0..1 = life of the puff.
// {k, size=1, dark=0, x=860, y=146, seed, rise=26, hang=0.62, drift=34}
// It pops out of the crater, rises `rise` units (independent of size) during the first (1-hang)
// of its life, then HANGS over the crater, swelling slowly and drifting sideways, and fades.
function drawVolcanoPuff(ctx, t, o = {}) {
  const k = clamp(o.k ?? 0.5);
  if (k <= 0 || k >= 1) return;
  const size = o.size ?? 1, dark = clamp(o.dark ?? 0), seed = o.seed ?? 1;
  const cx = o.x ?? 860, cy = o.y ?? 146;
  const hang = clamp(o.hang ?? 0.62, 0, 0.95), riseK = 1 - hang;
  const rise = o.rise ?? 26, drift = o.drift ?? 34;
  const grow = U.ease.outBack(Math.min(1, k / Math.min(0.22, riseK)), 2.2);
  const kr = U.ease.outCubic(Math.min(1, k / riseK)), kh = smoothstep(riseK, 1, k);
  const R = 26 * size * (0.25 + 0.75 * grow) * (1 + 0.18 * kr + 0.12 * kh);
  const fade = 1 - smoothstep(0.72, 1, k);
  const x = cx + drift * (0.25 * kr + 0.75 * kh) + Math.sin(t * 0.9 + seed) * 2 * kh;
  const y = cy - 12 * size * grow - rise * kr - 4 * kh;
  const lobes = [[0, 0, 1], [-0.85, 0.22, 0.68], [0.88, 0.2, 0.72], [-0.36, -0.46, 0.62], [0.42, -0.42, 0.64], [0, 0.36, 0.7], [-1.32, 0.34, 0.46], [1.36, 0.3, 0.48]];
  const base = new Path2D(), lit = new Path2D(), under = new Path2D();
  lobes.forEach(([dx, dy, rr], i) => {
    const wob = 1 + 0.05 * Math.sin(t * 1.3 + i * 2.1 + seed) * kh;
    circleP(base, x + dx * R, y + dy * R, rr * R * wob);
    circleP(lit, x + dx * R - rr * R * 0.22, y + dy * R - rr * R * 0.26, rr * R * 0.7 * wob);
    if (dy > 0) circleP(under, x + dx * R + rr * R * 0.1, y + dy * R + rr * R * 0.18, rr * R * 0.72);
  });
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.fillStyle = mix('#B9B4C4', '#2E2830', dark); ctx.fill(base);
  ctx.fillStyle = mix('#F4F2F8', '#5C5056', dark); ctx.fill(lit);
  // stem: a short tapering tail back down to the crater while the puff is young
  if (k < riseK * 1.1) {
    const a = (1 - k / (riseK * 1.1)) * 0.8;
    ctx.globalAlpha = fade * a;
    ctx.fillStyle = mix('#DCD8E2', '#4A4044', dark);
    ribbon(ctx, [[cx, cy + 2], [lerp(cx, x, 0.5), lerp(cy, y, 0.6)], [x, y + R * 0.3]], R * 0.45, R * 0.9);
    ctx.fill();
  }
  ctx.restore();
}
// erupt .2-.6: explosive billowing plume: a column out of the crater that mushrooms into a wide
// canopy whose curling underside hangs down to y ≈ 20..160 (reads at zoom 1)
function plumePuffs(t, G) {
  const cx = 860, cy = 150, list = [];
  const cG = smoothstep(0.15, 1, G);
  const top = lerp(cy - 70, -40, Math.pow(G, 0.6));        // canopy centre (rises while it grows)
  const Wc = 70 + 420 * cG;                                // canopy half width
  // column out of the crater
  for (let i = 0; i < 22; i++) {
    const u = frac(i / 22 + t * 0.08 + hash1(i * 3.1) * 0.03);
    const y = lerp(cy, top + 30, Math.pow(u, 0.85));
    const side = (hash1(i * 13.7) - 0.5) * 2;
    const w = 10 + (cy - y) * 0.36;
    const x = cx + side * w + noise1(t * 0.4 + i * 1.3) * 6 * u + (cy - y) * 0.1;
    const r = (18 + (cy - y) * 0.24) * (0.6 + 0.4 * G) * (1 + 0.06 * Math.sin(t * 1.7 + i * 2.1)) * smoothstep(0, 0.06, u + 0.01);
    if (r > 3) list.push({ x, y, r, hgt: cy - y });
  }
  if (cG > 0) {
    // the mushroom canopy: puffs drift outward from the column top and curl down at the rim
    for (let i = 0; i < 46; i++) {
      const ph = frac((i / 46) * 2.7 + t * 0.03 + hash1(i * 7.7) * 0.4);
      const dir = i % 2 ? 1 : -1;
      const a = dir * (0.06 + 0.94 * Math.pow(ph, 0.85));
      const A = Math.abs(a), lay = hash1(i * 4.3);          // lay 0 = underside … 1 = top
      const droop = 150 * Math.pow(Math.max(0, A - 0.3) / 0.7, 1.6) * cG;
      const x = cx + 30 * cG + a * Wc + noise1(t * 0.3 + i) * 10;
      const y = top + lerp(55, -75, lay) * (1 - 0.5 * A * A) * (0.4 + 0.6 * cG) + droop;
      const r = (40 + 42 * cG) * (0.8 + 0.3 * (1 - A)) * (0.85 + 0.25 * lay) * smoothstep(0, 0.1, ph) * (1 - 0.3 * smoothstep(0.85, 1, ph));
      if (r > 4) list.push({ x, y, r, hgt: cy - y, rim: lay < 0.45 ? 1 : 0 });
    }
  }
  list.top = top; list.Wc = Wc;
  return list;
}
function drawPlume(ctx, t, P, o) {
  const G = smoothstep(0.18, 0.5, o.erupt);
  if (G <= 0) return;
  const list = plumePuffs(t, G);
  const fl = 0.75 + 0.25 * noise1(t * 5.1);
  const glowP = new Path2D(), darkP = new Path2D(), midP = new Path2D(), litP = new Path2D();
  for (const p of list) {
    if (p.rim !== 0) circleP(glowP, p.x + p.r * 0.03, p.y + p.r * 0.14, p.r * 1.0);   // only the underside can show it
    circleP(darkP, p.x, p.y, p.r);
    circleP(midP, p.x - p.r * 0.1, p.y - p.r * 0.14, p.r * 0.84);
    if (p.r > 24 && p.y < list.top + 20) circleP(litP, p.x - p.r * 0.22, p.y - p.r * 0.3, p.r * 0.56);
  }
  const young = 0.4 * (1 - smoothstep(0.2, 0.5, G));
  // fire light from below, strongest near the vent (one radial gradient on the cloud's underside)
  let gr = ctx.createRadialGradient(860, 150, 0, 860, 150, 520);
  gr.addColorStop(0, rgba('#FF8A30', 0.95 * fl)); gr.addColorStop(0.45, rgba('#E0521C', 0.6 * fl)); gr.addColorStop(1, 'rgba(200,60,30,0)');
  ctx.fillStyle = gr; ctx.fill(glowP);
  ctx.fillStyle = mix('#2A2026', '#4E4448', young * 0.6); ctx.fill(darkP);
  // mid tone, warmed near the fountain (one gradient)
  gr = ctx.createRadialGradient(860, 140, 0, 860, 140, 420);
  const midC = mix('#3A3034', '#6A5E62', young * 0.6);
  gr.addColorStop(0, mix(midC, '#C0502A', 0.5 * fl)); gr.addColorStop(0.45, mix(midC, '#8A3A26', 0.2 * fl)); gr.addColorStop(1, midC);
  ctx.fillStyle = gr; ctx.fill(midP);
  // top light from the burning sky, fading down the cloud
  gr = ctx.createLinearGradient(0, list.top - 140, 0, list.top + 90);
  gr.addColorStop(0, rgba(mix('#6A5A58', P.rim, 0.12), 0.95)); gr.addColorStop(1, rgba('#4A3F43', 0));
  ctx.fillStyle = gr; ctx.fill(litP);
  // volcanic lightning
  const ph = smoothstep(0.25, 0.32, o.erupt) * (1 - smoothstep(0.62, 0.8, o.erupt));
  const slot = Math.floor(t * 2.3);
  if (ph > 0.2 && frac(t * 2.3) < 0.2 && hash1(slot * 7.31) > 0.5) {
    const r = rng(slot);
    let x = 880 + r.range(-0.6, 0.6) * list.Wc, y = list.top + r.range(-50, 10);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,244,226,0.95)'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += r.range(-26, 26); y += r.range(14, 26); ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,170,120,0.35)'; ctx.lineWidth = 9; ctx.stroke();
    ctx.restore();
  }
}
// lava fountain: a central jet, parabolic streams arcing out sideways (they break into drops at the
// end) and bombs on ballistic paths with short motion trails. Drawn IN FRONT of the plume base.
function drawFountains(ctx, t, P, o) {
  const I = smoothstep(0.2, 0.3, o.erupt) * (1 - 0.45 * smoothstep(0.75, 1, o.erupt));
  if (I <= 0) return;
  const cx = 860, cy = 152, g = 420;
  ctx.save();
  // vent glow: one radial gradient
  ctx.globalCompositeOperation = 'lighter';
  const gr = ctx.createRadialGradient(cx, cy - 20, 0, cx, cy - 20, 110);
  gr.addColorStop(0, `rgba(255,150,60,${0.5 * I})`); gr.addColorStop(0.4, `rgba(255,110,40,${0.18 * I})`); gr.addColorStop(1, 'rgba(255,90,30,0)');
  ctx.fillStyle = gr; ctx.fillRect(cx - 110, cy - 130, 220, 220);
  ctx.globalCompositeOperation = 'source-over';
  const outer = new Path2D(), core = new Path2D(), drops = new Path2D(), dropsHot = new Path2D(), glowR = new Path2D();
  // central jet: a thick, wobbling column of lava
  {
    const H = (95 + 70 * I) * (0.85 + 0.15 * noise1(t * 6.3));
    const pts = [];
    for (let k = 0; k <= 10; k++) { const s = k / 10; pts.push([cx + Math.sin(s * 4 + t * 8) * 4 * s + noise1(t * 2 + 9) * 10 * s, cy + 2 - s * H]); }
    ribbonP(glowR, pts, 0, 0, (u) => (1 - u) * 60 + 14);
    ribbonP(outer, pts, 0, 0, (u) => Math.pow(1 - u, 0.8) * 30 + 4);
    ribbonP(core, pts.slice(0, 9), 0, 0, (u) => (1 - u) * 13 + 2);
    for (let d = 0; d < 6; d++) {
      const s = 1 + d * 0.06 + 0.05 * frac(t * 3 + d * 0.37);
      circleP(d < 3 ? dropsHot : drops, cx + noise1(t * 3 + d * 5) * 16, cy + 2 - s * H, 4.6 - d * 0.5);
    }
  }
  // fat streams arcing out sideways, breaking into blobs as they fall back onto the cone
  const NS = 6;
  for (let j = 0; j < NS; j++) {
    const side = j % 2 ? 1 : -1, rank = j >> 1;
    const ang = -PI / 2 + side * (0.3 + rank * 0.26 + 0.05 * noise1(t * 1.1 + j * 3));
    const v = (215 + 50 * hash1(j * 3.3) + 40 * noise1(t * 1.7 + j * 2.1)) * (0.75 + 0.3 * I);
    const vx = Math.cos(ang) * v, vy = Math.sin(ang) * v;
    const S = ((-vy + Math.sqrt(vy * vy + 2 * g * 40)) / g) * (0.7 + 0.1 * noise1(t * 2.3 + j));
    const pts = [];
    for (let k = 0; k <= 12; k++) { const s = (k / 12) * S; pts.push([cx + side * 6 + vx * s, cy + vy * s + 0.5 * g * s * s]); }
    const w0 = 14 - rank * 3;
    ribbonP(glowR, pts, 0, 0, (u) => w0 * 2.4 * (1 - u * 0.6));
    ribbonP(outer, pts, 0, 0, (u) => w0 * Math.pow(1 - u, 0.55) + 2);
    ribbonP(core, pts.slice(0, 9), 0, 0, (u) => w0 * 0.4 * (1 - u) + 1);
    for (let d = 0; d < 5; d++) {
      const s = S * (1.03 + d * 0.07 + 0.05 * frac(t * 2.5 + j * 0.3 + d * 0.21));
      const x = cx + vx * s, y = cy + vy * s + 0.5 * g * s * s;
      if (y > volcY(x) + 2) continue;
      circleP(d < 2 ? dropsHot : drops, x, y, Math.max(1.4, w0 * 0.4 - d * 0.6));
    }
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgba(255,110,40,${0.22 * I})`; ctx.fill(glowR);
  ctx.globalCompositeOperation = 'source-over';
  // bombs
  const N = Math.round(34 * I);
  const trail = new Path2D(), smoke = new Path2D(), hot = new Path2D(), warm = new Path2D(), cool = new Path2D(), halo = new Path2D();
  for (let i = 0; i < N; i++) {
    const big = i % 7 === 0;
    const per = (big ? 2.4 : 1.5) + hash1(i * 3.1) * 0.9;
    const cyc = Math.floor(t / per + hash1(i * 7.7));
    const age = (t / per + hash1(i * 7.7) - cyc) * per;
    const vx = (hash2(i, cyc) - 0.5) * (big ? 460 : 340);
    const vy = -(240 + hash2(i * 5, cyc) * 260) * (0.8 + 0.3 * I) * (big ? 1.1 : 1);
    const pos = (a) => [cx + (hash1(i * 2.3) - 0.5) * 24 + vx * a, cy + vy * a + 0.5 * g * a * a];
    const [x, y] = pos(age);
    if (y > volcY(x) + 4 || y > 420) continue;   // landed on the cone (or below the treeline)
    const heat = 1 - age / per;
    const r = (big ? 4.6 + hash1(i) * 2.6 : 1.8 + hash1(i * 4.4) * 2.2) * (0.85 + 0.3 * heat);
    // motion trail along the ballistic path (last ~0.1 s)
    const T = [];
    for (let s = 4; s >= 0; s--) T.push(pos(Math.max(0, age - s * 0.028)));
    ribbonP(trail, T, 0, 0, (u) => u * r * 1.7);
    if (big) { const S2 = []; for (let s = 6; s >= 1; s--) S2.push(pos(Math.max(0, age - s * 0.06))); ribbonP(smoke, S2, 0, 0, (u) => (0.3 + u) * r * 2.4); }
    if (big && heat > 0.4) circleP(halo, x, y, r * 2.4);
    circleP(heat > 0.6 ? hot : heat > 0.3 ? warm : cool, x, y, r);
  }
  ctx.fillStyle = 'rgba(64,46,46,0.35)'; ctx.fill(smoke);
  ctx.fillStyle = 'rgba(255,120,40,0.55)'; ctx.fill(trail);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,120,40,0.22)'; ctx.fill(halo);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#E04A1A'; ctx.fill(outer);
  ctx.fillStyle = '#FFB13B'; ctx.fill(drops);
  ctx.fillStyle = '#FFE48A'; ctx.fill(core); ctx.fill(dropsHot);
  ctx.fillStyle = '#9E2C18'; ctx.fill(cool);
  ctx.fillStyle = '#FF8A2A'; ctx.fill(warm);
  ctx.fillStyle = '#FFE07A'; ctx.fill(hot);
  ctx.restore();
}
// ---- lava flows -------------------------------------------------------------------------------
// resample a polyline every `step` units → [{x, y, nx, ny, s}] (s = arc length)
function resample(pts, step) {
  const cum = polyLength(pts), L = cum[cum.length - 1], out = [];
  const n = Math.max(2, Math.ceil(L / step));
  let j = 1;
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * L;
    while (j < pts.length - 1 && cum[j] < s) j++;
    const a = pts[j - 1], b = pts[j];
    const k = (s - cum[j - 1]) / Math.max(1e-6, cum[j] - cum[j - 1]);
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    out.push({ x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k), nx: -dy, ny: dx, s });
  }
  return out;
}
// closed outline of a flow: left edge (offsets wl) down, rounded head, right edge (wr) back
function flowOutline(p, R, wl, wr, head) {
  const n = R.length;
  p.moveTo(R[0].x + R[0].nx * wl[0], R[0].y + R[0].ny * wl[0]);
  for (let i = 1; i < n; i++) p.lineTo(R[i].x + R[i].nx * wl[i], R[i].y + R[i].ny * wl[i]);
  const e = R[n - 1], tx = e.ny, ty = -e.nx;
  if (head > 0) {
    p.bezierCurveTo(e.x + e.nx * wl[n - 1] + tx * head, e.y + e.ny * wl[n - 1] + ty * head,
      e.x - e.nx * wr[n - 1] + tx * head, e.y - e.ny * wr[n - 1] + ty * head, e.x - e.nx * wr[n - 1], e.y - e.ny * wr[n - 1]);
  }
  for (let i = n - 1; i >= 0; i--) p.lineTo(R[i].x - R[i].nx * wr[i], R[i].y - R[i].ny * wr[i]);
  p.closePath();
}
// One lava flow (river or tongue). pts: full centreline; p: visible fraction (from the source);
// wfn(u): half... full width at u along the FULL length. Layers: glow, dark crusted edge, body, core,
// incandescent thread, cooled crust plates drifting downstream, a bulbous head while advancing.
function drawLavaFlow(ctx, t, pts, cum, p, wfn, seed, o = {}) {
  if (p <= 0.01) return;
  const vis = partial(pts, cum, p);
  if (vis.length < 2) return;
  const Ltot = cum[cum.length - 1];
  const R = resample(vis, o.step ?? 7);
  const n = R.length;
  const W = R.map((q) => wfn(q.s / Ltot) / 2);
  const nz = (q, f, sd) => noise1((q.s / 7) * f + seed * 11.3 + sd);
  const advancing = p < 0.999;
  const headK = advancing ? 0.7 : (o.endLobe ? 1.1 : 0.6);
  // widen the last few samples into a lobe
  const lobe = (i) => (advancing || o.endLobe ? 1 + (o.lobeK ?? 0.25) * smoothstep(n - 5, n - 1, i) : 1);
  const edge = (k, sdA, sdB, amp) => [R.map((q, i) => W[i] * lobe(i) * k * (1 + amp * nz(q, 1, sdA))), R.map((q, i) => W[i] * lobe(i) * k * (1 + amp * nz(q, 1, sdB)))];
  const flow = speedOf(o);
  ctx.save();
  if (o.glow !== false) {
    ctx.globalCompositeOperation = 'lighter';
    const g1 = new Path2D();
    const [a1, b1] = edge(2.1, 1, 2, 0.1);
    flowOutline(g1, R, a1, b1, W[n - 1] * 1.7);
    ctx.fillStyle = `rgba(255,100,34,${0.16 * (o.glowK ?? 1)})`; ctx.fill(g1);
    ctx.globalCompositeOperation = 'source-over';
  }
  const crust = new Path2D(), body = new Path2D(), coreP = new Path2D(), hotP = new Path2D();
  const [cl, cr] = edge(1.3, 5, 6, 0.32);
  // lumpy cooled edge: extra bumps
  for (let i = 0; i < n; i++) { cl[i] *= 1 + 0.18 * Math.max(0, noise1(R[i].s / 3.1 + seed * 5)); cr[i] *= 1 + 0.18 * Math.max(0, noise1(R[i].s / 2.9 + seed * 7)); }
  flowOutline(crust, R, cl, cr, W[n - 1] * headK * 1.25);
  const [bl, br] = edge(0.98, 7, 8, 0.22);
  flowOutline(body, R, bl, br, W[n - 1] * headK);
  // the core meanders inside the body
  const shift = R.map((q) => noise1(q.s / 22 + seed * 3 - t * 0.2) * 0.3);
  const Rc = R.map((q, i) => ({ ...q, x: q.x + q.nx * W[i] * shift[i], y: q.y + q.ny * W[i] * shift[i] }));
  const [kl, kr] = edge(0.5, 9, 10, 0.35);
  flowOutline(coreP, Rc, kl, kr, W[n - 1] * headK * 0.4);
  const [hl, hr] = edge(0.16, 11, 12, 0.6);
  flowOutline(hotP, Rc, hl.map((v, i) => v * (0.6 + 0.4 * Math.sin(R[i].s / 9 - t * flow / 6 + seed))), hr.map((v, i) => v * (0.6 + 0.4 * Math.sin(R[i].s / 9 - t * flow / 6 + seed + 1))), 0);
  ctx.fillStyle = o.crustCol || '#3A120C'; ctx.fill(crust);
  if (o.gradBody) {
    // a pour: one smooth gradient across the flow (no stripes), molten in the middle
    const a = R[0], b = R[n - 1];
    let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, hw = Math.max(...W) * 1.1;
    const gr = ctx.createLinearGradient(mx + dy * hw, my - dx * hw, mx - dy * hw, my + dx * hw);
    gr.addColorStop(0, '#B8301A'); gr.addColorStop(0.28, '#F2621E'); gr.addColorStop(0.5, '#FFC24A'); gr.addColorStop(0.72, '#F2621E'); gr.addColorStop(1, '#B8301A');
    ctx.fillStyle = gr; ctx.fill(body);
    // lumps of cooling crust clinging to the edges
    const lumps = new Path2D();
    for (let i = 1; i < n - 1; i += 2) {
      for (const side of [1, -1]) {
        const q = R[i], w = (side > 0 ? bl[i] : br[i]) * 0.86;
        const r = W[i] * (0.18 + 0.16 * hash1(i * 3.3 + side + seed));
        const tt = noise1(q.s / 6 + seed + side * 3);
        if (tt < -0.2) continue;
        ellipseP(lumps, q.x + q.nx * w * side, q.y + q.ny * w * side, r * 1.3, r);
      }
    }
    ctx.fillStyle = rgba('#4A160E', 0.92); ctx.fill(lumps);
  } else {
    ctx.fillStyle = '#D93A16'; ctx.fill(body);
    ctx.fillStyle = '#FF8E2A'; ctx.fill(coreP);
    ctx.fillStyle = '#FFE08A'; ctx.fill(hotP);
  }
  // cooled crust plates riding the flow downstream (never on the hot head)
  const plates = new Path2D(), platesHi = new Path2D();
  const Lv = R[n - 1].s, sp = Math.max(10, W[Math.floor(n / 2)] * 2.6);
  const off = (t * flow) % sp;
  for (let s = off; s < Lv - W[n - 1] * 1.8; s += sp) {
    const i = Math.min(n - 1, Math.round((s / Lv) * (n - 1)));
    const q = R[i], w = W[i];
    const kk = Math.round((s - off) / sp) - Math.floor((t * flow) / sp);
    const side = (hash1(kk * 7.1 + seed) - 0.5) * 1.1;
    const sz = w * (0.22 + 0.22 * hash1(kk * 3.3 + seed));
    const px = q.x + q.nx * w * side * 0.8, py = q.y + q.ny * w * side * 0.8;
    const tx = q.ny, ty = -q.nx;
    const pp = [];
    for (let v = 0; v < 5; v++) {
      const a = (v / 5) * TAU + hash1(kk + v * 1.7) * 0.6;
      const rr = sz * (0.7 + 0.4 * hash1(kk * 2 + v));
      pp.push([px + (Math.cos(a) * tx * 2.2 + Math.sin(a) * q.nx) * rr, py + (Math.cos(a) * ty * 2.2 + Math.sin(a) * q.ny) * rr]);
    }
    polyP(plates, pp);
    platesHi.moveTo(pp[3][0], pp[3][1]); platesHi.lineTo(pp[4][0], pp[4][1]); platesHi.lineTo(pp[0][0], pp[0][1]);
  }
  ctx.fillStyle = rgba('#6A2414', 0.62); ctx.fill(plates);
  ctx.strokeStyle = rgba('#A04A26', 0.55); ctx.lineWidth = 0.9; ctx.stroke(platesHi);
  ctx.restore();
}
const speedOf = (o) => o.speed ?? 26;
// lava rivers down Mount Snooze (erupt .58-1): tapered, noisy width, braided side channels, crusted
// edges; clipped at the treeline (they continue behind the jungle)
const RIVER_W = [(u) => lerp(3.5, 28, Math.pow(u, 0.85)) * (1 + 0.32 * noise1(u * 7 + 1)), (u) => lerp(4, 30, Math.pow(u, 0.85)) * (1 + 0.32 * noise1(u * 7 + 4)), (u) => lerp(3, 18, Math.pow(u, 0.85)) * (1 + 0.32 * noise1(u * 7 + 8))];
function drawLavaRivers(ctx, t, P, o, clip = true) {
  const p = smoothstep(0.58, 0.97, o.erupt);
  if (p <= 0) return;
  ctx.save();
  if (clip) ctx.clip(JUNGLE.A.above);
  const rivers = [[LAVA_A, LAVA_A_L, p, 0], [LAVA_B, LAVA_B_L, clamp(p * 1.1), 1], [LAVA_C, LAVA_C_L, clamp(p * 0.9 - 0.1), 2]];
  // braids first (under the main channels)
  for (const [pts, u0, u1, offs, wk, sd] of LAVA_BRAIDS) {
    const main = rivers.find((r) => r[0] === pts);
    const cum = main[1];
    const a = partial(pts, cum, u1), b = partial(pts, cum, u0);
    const seg = [b[b.length - 1]].concat(a.slice(b.length - 1));
    if (seg.length < 2) continue;
    const R = resample(seg, 6);
    const bp = R.map((q, i) => { const s = i / (R.length - 1), k = Math.sin(PI * s); return [q.x + q.nx * offs * k, q.y + q.ny * offs * k]; });
    const bc = polyLength(bp);
    const vis = clamp((main[2] - u0) / (u1 - u0));
    const wf = RIVER_W[main[3]];
    drawLavaFlow(ctx, t, bp, bc, vis, (u) => wf(lerp(u0, u1, u)) * wk * (0.5 + 0.5 * Math.sin(PI * clamp(u * 1.1))), sd, { glow: false, speed: 18 });
  }
  for (const [pts, cum, pp, i] of rivers) drawLavaFlow(ctx, t, pts, cum, pp, RIVER_W[i], 20 + i * 3, { speed: 24 + i * 3, endLobe: true });
  ctx.restore();
}
// lava light spilling over the jungle where the rivers disappear behind it (drawn after the jungle)
function drawLavaGlow(ctx, t, P, o) {
  const p = smoothstep(0.62, 1, o.erupt), q = smoothstep(0.02, 0.3, o.lava);
  if (p <= 0 && q <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const fl = 0.85 + 0.15 * noise1(t * 3.3);
  for (const [x, y, r, k] of [[630, 410, 120, p], [930, 414, 130, Math.max(p, q)], [1100, 420, 110, Math.max(p * 0.7, q * smoothstep(0.1, 0.4, o.lava))]]) {
    if (k <= 0) continue;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,120,40,${0.32 * k * fl})`); g.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  ctx.restore();
}

// =====================================================================================
// jungle
// =====================================================================================
function bandStatic(g, P, B, rimHex, far, baseHex, rimK, seed, rimOn = true) {
  if (rimOn) {
    if (P.EL < 0.5) {
      g.fillStyle = P.hl(rimHex, far, rimK);
      for (const c of B.rims) g.fill(c);
    } else {
      // eruption: only the volcano-facing edges catch the fire light; intensity falls off with
      // distance from Mount Snooze and varies along the band (no uniform "egg-crate" rims)
      const gr = g.createLinearGradient(WX0, 0, WX1, 0);
      for (let x = WX0; x <= WX1; x += 64) {
        const fall = Math.exp(-(((x - 880) / 560) ** 2));
        const a = clamp((0.08 + 0.92 * fall) * (0.45 + 0.55 * Math.max(0, noise1(x * 0.013 + seed * 7.3))));
        gr.addColorStop((x - WX0) / (WX1 - WX0), rgba(mix('#E8541E', '#FFB050', fall), a * 0.95));
      }
      g.fillStyle = gr;
      const half = B.rimsV.length / 2;
      g.save(); g.beginPath(); g.rect(WX0 - 50, WY0, 880 - WX0 + 50, 1000); g.clip();
      for (let i = 0; i < half; i++) g.fill(B.rimsV[i]);
      g.restore();
      g.save(); g.beginPath(); g.rect(880, WY0, WX1 - 830, 1000); g.clip();
      for (let i = half; i < B.rimsV.length; i++) g.fill(B.rimsV[i]);
      g.restore();
    }
  }
  g.fillStyle = P.g(baseHex, far);
  for (const c of B.chunks) g.fill(c);
}
function drawJungleStatic(g, P) {
  fillOff(g, EMERGENT.trunks, P.g(C.trunk, 0.5));
  fillOff(g, EMERGENT.crowns, P.g(C.jFarDeep, 0.52));
  fillOff(g, EMERGENT.lit, P.hl(C.jFar, 0.5, 1.2));
  bandStatic(g, P, JUNGLE.A, C.jPale, 0.5, C.jFar, 1.8, 1);
  bandStatic(g, P, JUNGLE.A1, C.jPale, 0.47, C.jFarDeep, 0, 2, false);
  fillOff(g, FAR_PALMS.trunks, P.g(C.palmDark, 0.38));
  fillOff(g, FAR_PALMS.dark, P.g(C.jDeep, 0.38));
  fillOff(g, FAR_PALMS.light, P.hl(C.jMid, 0.36, 0.9));
  bandStatic(g, P, JUNGLE.B, C.jLight, 0.28, C.jMid, 1.9, 3);
  bandStatic(g, P, JUNGLE.B1, C.jMid, 0.26, '#327346', 1.3, 4, P.EL < 0.5);
}
// sun shafts through the canopy (static): they fall on the left jungle, never across the volcano
const NOT_VOLCANO = newPath((p) => { p.rect(WX0 - 50, WY0 - 50, WX1 - WX0 + 100, WY1 - WY0 + 100); polyP(p, VOLC_POLY.slice().reverse()); });
function drawRays(g, P) {
  if (P.rays <= 0.02) return;
  g.save();
  g.clip(NOT_VOLCANO, 'evenodd');     // light shafts stop at Mount Snooze
  g.globalCompositeOperation = 'lighter';
  const sx = P.sunX + 40, sy = Math.max(-20, P.sunY + 40);
  for (let i = 0; i < 5; i++) {
    const ang = 1.08 + i * 0.085;
    const sp = 0.012 + hash1(i * 1.3) * 0.014;
    const len = 380 + hash1(i * 2.2) * 120;
    const gr = g.createLinearGradient(sx, sy, sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
    const a = (0.05 + hash1(i * 3.1) * 0.035) * P.rays;
    gr.addColorStop(0, rgba(P.sunCol, a)); gr.addColorStop(0.7, rgba(P.sunCol, a * 0.6)); gr.addColorStop(1, rgba(P.sunCol, 0));
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(sx + Math.cos(ang - sp) * len, sy + Math.sin(ang - sp) * len);
    g.lineTo(sx + Math.cos(ang + sp) * len * 0.96, sy + Math.sin(ang + sp) * len * 0.96);
    g.closePath(); g.fill();
  }
  g.restore();
}
function drawBushBand(g, P) {
  bandStatic(g, P, JUNGLE.C, C.jPale, 0.1, '#55A162', 1.4, 5);
  bandStatic(g, P, JUNGLE.C1, C.jPale, 0.08, C.jMid, 0, 6, false);
}
function drawFernSet(ctx, t, P, set, far, o, seed) {
  set.forEach((G, i) => {
    const sx = t == null ? 0 : sway(t, seed + i * 2.3, 1.2, 0.9, 0) + (o.rumble ? noise1(t * 22 + i * 5 + seed) * o.rumble * 2.2 : 0);
    ctx.translate(sx, 0);
    ctx.fillStyle = P.g(C.jDeep, far); ctx.fill(G.dark);
    ctx.fillStyle = P.hl(C.jLight, far, 0.9); ctx.fill(G.light);
    ctx.translate(-sx, 0);
  });
}
function drawHeartSet(ctx, t, P, H, far, o, seed) {
  const sx = t == null ? 0 : sway(t, seed, 1, 0.8, 0) + (o.rumble ? noise1(t * 21 + seed) * o.rumble * 2 : 0);
  ctx.translate(sx, 0);
  ctx.strokeStyle = P.g(C.jMid, far); ctx.lineWidth = 2; ctx.stroke(H.stem);
  ctx.fillStyle = P.g(C.jTeal, far); ctx.fill(H.dark);
  ctx.fillStyle = P.hl(C.jLight, far, 0.9); ctx.fill(H.light);
  ctx.translate(-sx, 0);
}
function palmCrown(ctx, P, p, t, rumble, tx, ty) {
  const far = p.far || 0;
  const layer = (back) => {
    const dark = new Path2D(), light = new Path2D();
    p.fronds.forEach((f, i) => {
      if (!!f[3] !== back) return;
      const a = f[0] + (t == null ? 0 : sway(t, p.seed + i * 3.1, 0.055, 1.1, rumble));
      const len = p.len * f[1];
      const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len + len * 0.28 * f[2];
      const qx = tx + Math.cos(a) * len * 0.55, qy = ty + Math.sin(a) * len * 0.55 - len * 0.22;
      addLeaf(dark, light, null, leafPts(tx, ty, qx, qy, ex, ey, len * 0.17, 12, true));
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
// palm: live bending trunk + live crown (every frond sways on its own)
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
  palmCrown(ctx, P, p, t, rumble, tx, ty);
}
// palm fronds: [angle, lengthFactor, droop, back?]
const FRONDS_A = [[-2.75, 1, 0.9, 1], [-2.2, 0.95, 0.6, 1], [-1.65, 0.8, 0.2, 1], [-1.05, 0.9, 0.5, 1], [-0.45, 1, 0.9, 1],
  [-3.05, 0.95, 1.3, 0], [0.05, 0.95, 1.3, 0], [-2.5, 0.85, 0.4, 0], [-0.75, 0.85, 0.45, 0], [2.6, 0.7, 1.4, 0], [0.6, 0.7, 1.4, 0]];
const PALMS = [
  { x: 486, y: 456, tx: 434, ty: 214, bend: 34, w0: 20, w1: 11, len: 126, fronds: FRONDS_A, seed: 21, far: 0.1 },
  { x: 1300, y: 476, tx: 1216, ty: 138, bend: 40, w0: 24, w1: 12, len: 140, fronds: FRONDS_A, seed: 37, far: 0.04 },
  // the extended world (river bend, far left; beyond the right edge)
  { x: -520, y: 560, tx: -470, ty: 300, bend: -30, w0: 20, w1: 11, len: 124, fronds: FRONDS_A, seed: 53, far: 0.06 },
  { x: -1160, y: 572, tx: -1230, ty: 322, bend: 36, w0: 20, w1: 11, len: 120, fronds: FRONDS_A, seed: 61, far: 0.06 },
  { x: 1720, y: 520, tx: 1660, ty: 220, bend: 30, w0: 22, w1: 12, len: 132, fronds: FRONDS_A, seed: 71, far: 0.04 },
];
// banana plant geometry (constant): {stem, dark, light, rib} Path2Ds in world units
function bakeBanana(x, y, s, seed, flip = 1) {
  const stem = new Path2D();
  stem.moveTo(x - 6 * s, y); stem.lineTo(x - 3 * s, y - 70 * s); stem.lineTo(x + 3 * s, y - 70 * s); stem.lineTo(x + 6 * s, y); stem.closePath();
  const leaves = [[-2.5, 1, 0.5], [-1.85, 1.1, 0.25], [-1.2, 1.05, 0.25], [-0.6, 0.95, 0.5], [-2.1, 0.8, 0.1], [-1.0, 0.8, 0.1]];
  const dark = new Path2D(), light = new Path2D(), rib = new Path2D();
  leaves.forEach(([a0, lf, dr], i) => {
    const a = (flip > 0 ? a0 : -PI - a0);
    const L = 95 * s * lf, W = 22 * s;
    const x0 = x, y0 = y - 66 * s;
    const ex = x0 + Math.cos(a) * L, ey = y0 + Math.sin(a) * L + L * dr;
    const cx = x0 + Math.cos(a) * L * 0.5, cy = y0 + Math.sin(a) * L * 0.5 - L * 0.18;
    const lp = leafPts(x0, y0, cx, cy, ex, ey, W, 16, false, (u) => Math.pow(Math.sin(PI * Math.min(1, u * 1.02)), 0.55) * (u < 0.08 ? u / 0.08 : 1));
    // tears in the blade (banana leaves split)
    for (const k of [5, 9, 12]) if (lp.A[k]) { const S = lp.S[k + 1]; lp.A[k] = [lerp(S[0], lp.A[k][0], 0.25), lerp(S[1], lp.A[k][1], 0.25)]; }
    addLeaf(dark, light, rib, lp);
  });
  return { stem, dark, light, rib };
}
function drawBananaPaths(ctx, P, B, far) {
  ctx.fillStyle = P.g('#6E9A4A', far); ctx.fill(B.stem);
  ctx.fillStyle = P.g('#2E6E44', far); ctx.fill(B.dark);
  ctx.fillStyle = P.hl(C.jLight, far, 0.9); ctx.fill(B.light);
  ctx.strokeStyle = P.g(C.jPale, far); ctx.lineWidth = 1.5; ctx.stroke(B.rib);
}
function drawVines(ctx, t, P, list, rumble, V) {
  const stem = new Path2D(), lv = new Path2D(), lv2 = new Path2D();
  for (const v of list) {
    if (V && !vis(V, v.x - 60, v.y - 10, v.x + 60 + v.len * 0.4, v.y + v.len + 20)) continue;
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
  fillOff(ctx, cn.base, rgba(P.rim, 0.35 + 0.35 * P.rimA), side ? 3 : -3, -3);
  fillOff(ctx, cn.base, dk(C.jDeep, 0.35));
  fillOff(ctx, cn.inner, P.hl(C.jDeep, 0, 0.6), side ? 2 : -2, -2);
  fillOff(ctx, cn.inner, dk(C.jMid, 0.28));
  fillOff(ctx, cn.inner2, dk(C.jMid, 0.15));
  ctx.translate(-sx, 0);
}
// trunks of the framing trees (static) — the canopies sway live
function trunkL(g, P, ox, sc) {
  g.save();
  g.translate(ox, 0);
  if (sc !== 1) { g.translate(40, 560); g.scale(sc, 1); g.translate(-40, -560); }
  g.fillStyle = P.g(C.trunkDark);
  g.beginPath();
  g.moveTo(-70, 558); g.quadraticCurveTo(-24, 520, 0, 480); g.lineTo(16, 492); g.quadraticCurveTo(-8, 532, -30, 560); g.closePath();
  g.moveTo(150, 556); g.quadraticCurveTo(90, 528, 64, 482); g.lineTo(50, 494); g.quadraticCurveTo(74, 534, 104, 560); g.closePath();
  g.fill();
  const L = [[-30, 556], [-14, 480], [-2, 380], [8, 270], [16, 150], [24, 20], [30, -150]];
  const R = [[66, -150], [62, 20], [58, 150], [54, 270], [56, 380], [70, 480], [106, 558]];
  g.beginPath();
  g.moveTo(L[0][0], L[0][1]); splineTo(g, L); g.lineTo(R[0][0], R[0][1]); splineTo(g, R);
  g.quadraticCurveTo(40, 548, -30, 556); g.closePath();
  g.fillStyle = P.g('#3E312A'); g.fill();
  g.beginPath();
  g.moveTo(L[0][0], L[0][1]); splineTo(g, L);
  g.lineTo(44, -150); splineTo(g, [[44, -150], [42, 20], [36, 150], [30, 270], [26, 380], [30, 480], [20, 556]]);
  g.closePath();
  g.fillStyle = P.g(C.trunk); g.fill();
  g.strokeStyle = rgba(P.rim, 0.35 + P.rimA * 0.35); g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(L[1][0] + 2, L[1][1]); splineTo(g, L.slice(1).map(([x, y]) => [x + 2, y])); g.stroke();
  g.strokeStyle = rgba(P.g('#2C221D'), 0.5); g.lineWidth = 1.6;
  g.beginPath();
  for (let i = 0; i < 5; i++) { const x = 12 + i * 10; g.moveTo(x, 530 - i * 6); g.bezierCurveTo(x - 6, 400, x + 4, 260, x - 2 + i, 60 - i * 20); }
  g.stroke();
  g.fillStyle = P.g(C.trunkDark);
  ribbon(g, openSpline([[40, 170], [110, 124], [200, 96], [286, 70]], 4), 22, 6);
  g.fill();
  g.restore();
}
function drawTrunks(g, P) {
  trunkL(g, P, 0, 1);
  trunkL(g, P, -742, -0.8);   // a second big tree on the far left bank (behind the river bend)
  g.fillStyle = P.g('#3E312A');
  g.beginPath();
  g.moveTo(1384, 540); g.quadraticCurveTo(1398, 260, 1394, -100); g.lineTo(1450, -100); g.quadraticCurveTo(1448, 260, 1474, 544); g.closePath();
  g.fill();
  ribbon(g, openSpline([[1400, 120], [1330, 84], [1250, 60]], 4), 20, 6);
  g.fill();
}

// =====================================================================================
// ground, rocks, water
// =====================================================================================
function drawGround(g, P) {
  g.fillStyle = vGrad(g, [[436, P.g(C.ground, 0.06)], [520, P.g(C.groundMid)], [820, P.g(C.groundDark)], [1140, P.g(C.groundDark)]]);
  g.fill(GROUND_PATH);
}
// device pixels per world unit (level-of-detail decisions; 1.5 = 1080p at camera zoom 1)
function devScale(ctx) { const m = ctx.getTransform(); return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)); }
function drawRocks(ctx, P, R, style, lod = 9, V = null) {
  const st = style || ROCK_STYLE;
  const detail = lod >= 1.2;
  for (const G of R.groups) {
    if (V && !vis(V, G.x0, G.y0, G.x1, G.y1)) continue;
    if (detail) { ctx.fillStyle = P.g(st.dark); ctx.fill(G.out); ctx.fillStyle = P.g(st.shade); ctx.fill(G.shade); ctx.fill(G.shadeS); } else { ctx.fillStyle = mix(P.g(st.shade), P.g(st.dark), 0.3); ctx.fill(G.out); }
    ctx.fillStyle = P.g(st.base); ctx.fill(G.lit);
    if (st.moss) { ctx.fillStyle = P.g(st.moss); ctx.fill(G.moss); }
    ctx.fillStyle = P.hl(st.light, 0, 0.9); ctx.fill(G.hl); if (detail) ctx.fill(G.hlS);
    if (st.moss && detail) { ctx.fillStyle = P.hl(st.mossLight, 0, 0.9); ctx.fill(G.mossHl); ctx.fill(G.mossHlS); }
  }
  ctx.fillStyle = rgba(P.wHi, 0.65); ctx.fill(R.glint);
}
function drawBarryRockImpl(ctx, t, P, style) {
  const b = SPRING.barryRock;
  drawRocks(ctx, P, BARRY_ROCK, style);
  // submerged lower part + waterline
  const wl = b.y + b.ry * 0.3;
  ctx.save();
  ctx.beginPath(); ctx.rect(b.x - b.rx * 1.3, wl + wave(b.x, t) * 0.5, b.rx * 2.6, b.ry * 2); ctx.clip();
  ctx.fillStyle = rgba(P.waterBand(wl + 6), 0.78);
  ctx.beginPath(); ellipseP(ctx, b.x, b.y + 2, b.rx * 1.15, b.ry * 1.2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = rgba(P.wHi, 0.85); ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(b.x, wl + wave(b.x, t) * 0.5, b.rx * 1.02, b.ry * 0.28, 0, 0.15, PI - 0.15); ctx.stroke();
  waterlineRipple(ctx, b.x, wl + 1, b.rx * 2, t + 3.3, { amp: 0.5, part: 'both', color: P.wHi, speed: 0.7, clip: false });
}
const ROCK_STYLE = { shade: C.rockShade, dark: C.rockDark, base: C.rock, light: C.rockLight, moss: C.moss, mossLight: C.mossLight };
const ROCK_STYLE_NEW = { shade: '#A99F94', dark: '#7C7268', base: '#CFC6B6', light: '#F2ECDF', moss: '#86C062', mossLight: '#BCE27E' };
// the body of the water (static): smooth gradients + faint lighter stripes, the jungle's reflection
// and soft sky streaks
function drawWaterStatic(g, P, setting) {
  g.fillStyle = vGrad(g, P.wStops);
  g.fill(RIVER_PATH);
  g.fill(POOL_PATH);
  g.fillStyle = rgba(P.wHi, setting === 'new' ? 0.07 : 0.055);
  for (const b of POOL_STRIPES) g.fill(b.path);
  // jungle wall reflection
  const jc = rgba(mix(P.g(setting === 'new' ? '#5FAF6A' : C.jMid, 0.1), P.w2, 0.4), 0.5);
  g.fillStyle = jc;
  g.fill(JUNGLE_REFL.path);
  g.fillStyle = rgba(P.wHi, 0.12);
  g.beginPath(); ellipseP(g, 520, 506, 300, 5); ellipseP(g, 860, 538, 240, 6); ellipseP(g, 600, 660, 380, 8); g.fill();
}
// animated surface detail (drawn after the static water + rocks; stays on open water)
function drawWaterLive(ctx, t, P, o, V) {
  const heat = o.waterHeat, rum = o.rumble;
  ctx.save();
  if (o.setting !== 'new' && vis(V, 470, 470, 1120, 560)) {
    // Mount Snooze mirrored, sliced into wobbling strips by the ripples
    const rc = mix(P.g('#7A7A9C', 0.2), P.w1, 0.3);
    for (const sl of VOLC_REFL_SLICES) {
      const dx = Math.sin(t * 1.25 + sl.i * 1.1) * (1 + sl.i * 0.4);
      ctx.fillStyle = rgba(rc, 0.5 * (1 - sl.i / 12));
      ctx.translate(dx, 0); ctx.fill(sl.path); ctx.translate(-dx, 0);
    }
    const gk = smoothstep(0.03, 0.25, o.erupt);
    if (gk > 0) {
      // glitter streak: the crater / fountain glow reflected on the rippled water
      ctx.globalCompositeOperation = 'lighter';
      const fl = 0.8 + 0.2 * noise1(t * 7);
      const hot = new Path2D(), warm = new Path2D();
      for (let i = 0; i < 34; i++) {
        const k = i / 33, y = 520 + k * k * 200 + Math.sin(t * 2 + i) * 1.5;
        const spread = 10 + 70 * k * (0.5 + gk * 0.6);
        const x = 866 + (hash1(i * 7.3 + Math.floor(t * 3) * 0.37) - 0.5) * spread * 2;
        const len = (8 + 26 * k) * (0.55 + 0.45 * Math.sin(t * 2.4 + i * 1.9)) * gk;
        if (len < 1.5) continue;
        ellipseP(k < 0.45 ? hot : warm, x, y, len, 1 + k * 1.6);
      }
      ctx.fillStyle = `rgba(255,170,90,${0.55 * fl * gk})`; ctx.fill(hot);
      ctx.fillStyle = `rgba(255,110,50,${0.45 * fl * gk})`; ctx.fill(warm);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  // ripple-broken lower edge of the jungle reflection
  ctx.fillStyle = rgba(mix(P.g(o.setting === 'new' ? '#5FAF6A' : C.jMid, 0.1), P.w2, 0.4), 0.45);
  ctx.beginPath();
  const B = JUNGLE_REFL.bot;
  for (let i = 1; i < B.length - 1; i++) {
    const [x, y] = B[i], w = 12 + 14 * hash1(i * 3.3), dx = Math.sin(t * 1.4 + i) * 3;
    if (!freeWater(x - w / 2 + dx, y + 3, 1) || !freeWater(x + w / 2 + dx, y + 3, 1)) continue;
    ctx.rect(x - w / 2 + dx, y + 2.5 + hash1(i) * 3, w, 1.8);
  }
  ctx.fill();
  // river: flow lines (moving left), foam at the mouth, white water in the rapids
  if (V.x0 < 240 && V.y1 > 540) {
    ctx.strokeStyle = P.wHi; ctx.lineCap = 'round'; ctx.globalAlpha = 0.6; ctx.lineWidth = 2;
    ctx.beginPath();
    const x0 = Math.max(WX0, V.x0 - 40), span = 240 - x0;
    const n = Math.min(90, Math.round(span / 26));
    for (let i = 0; i < n; i++) {
      const sp = 40 + hash1(i) * 30;
      const x = 200 - (((t * sp + hash1(i * 5.1) * span) % span) + span) % span;
      const top = riverTopY(x), bot = riverBotY(x);
      const y = lerp(top + 16, bot - 18, hash1(i * 2.7));
      const len = 14 + hash1(i * 3.3) * 30;
      if (!freeWater(x, y, 3) || !freeWater(x + len, y, 3)) continue;
      ctx.moveTo(x, y); ctx.lineTo(x + len, y + 0.4);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.75; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const y = 576 + i * 9, x = 172 + Math.sin(t * 3 + i * 2) * 3;
      ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 6, y - 3, x - 12, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    const rp = SPRING.rapids;
    if (V.x0 < rp.x1 + 60 && V.x1 > rp.x0 - 60) drawRapids(ctx, t, P);
  }
  if (P.sunDisc > 0.05 && o.setting === 'evening') {
    // golden glitter path below the low sun
    ctx.fillStyle = rgba(mix(P.sunCol, '#FFFFFF', 0.3), 0.75 * P.sunDisc);
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      const y = 480 + Math.pow(i / 26, 1.3) * 300;
      const sp = 14 + (y - 470) * 0.32;
      const x = P.sunX + 10 + (hash1(i * 7.3) - 0.5) * sp * 2 + Math.sin(t * 1.3 + i) * 6;
      const len = (10 + (y - 470) * 0.14) * (0.5 + 0.5 * Math.sin(t * 2.1 + i * 1.7));
      const th = 1 + (y - 470) * 0.008;
      if (len > 2 && freeWater(x - len, y, 2) && freeWater(x + len, y, 2)) ellipseP(ctx, x, y, len, th);
    }
    ctx.fill();
  }
  // shimmer dashes as thin filled bars
  ctx.fillStyle = P.wHi;
  const jit = rum * 3 + heat * heat * 3;
  for (let bin = 0; bin < 3; bin++) {
    ctx.globalAlpha = [0.45, 0.55, 0.6][bin];
    const lw = [1.2, 2, 3][bin];
    ctx.beginPath();
    for (const s of SHIMMER) {
      if (s.bin !== bin) continue;
      const x = s.x + Math.sin(t * 0.5 * s.sp + s.ph) * 8 * (0.4 + s.k) + (jit ? noise1(t * 9 + s.ph * 5) * jit : 0);
      const len = s.len * (0.55 + 0.45 * Math.sin(t * 1.1 * s.sp + s.ph * 2));
      if (len < 2) continue;
      const y = s.y + Math.sin(t * 1.3 + s.ph) * 1.2;
      ctx.rect(x - len / 2, y - lw / 2, len, lw);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (rum > 0.02) {
    // ripple rings cross the water
    const n = Math.round(6 + 14 * rum);
    ctx.strokeStyle = P.wHi;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < n; i++) {
      const per = 0.9 + hash1(i * 3.7) * 0.6;
      const tt = t / per + hash1(i * 1.9);
      const cyc = Math.floor(tt), k = tt - cyc;
      const y = lerp(486, 790, Math.pow(hash2(i, cyc), 1.2));
      const sp = freeSpan(y);
      if (!sp) continue;
      const sc = depthScale(y), R = 52 * sc;
      if (sp[1] - sp[0] < 2 * R + 20) continue;
      const x = lerp(sp[0] + R + 10, sp[1] - R - 10, hash2(i * 7, cyc + 3));
      const r = (6 + k * 46) * sc;
      ctx.globalAlpha = (1 - k) * 0.6 * rum;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.2, 0, 0, TAU); ctx.ellipse(x, y, r * 0.55, r * 0.11, 0, TAU, 0, true); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // twinkling glints
  if (P.sunA > 0.05 || o.setting === 'new') {
    ctx.fillStyle = rgba(mix(P.wHi, '#FFFFFF', 0.6), 0.9);
    ctx.beginPath();
    for (const gl of GLINTS) {
      const k = frac(t * gl.sp + gl.ph), a = Math.sin(PI * k);
      if (a < 0.25) continue;
      const s = gl.s * a, x = gl.x + Math.sin(t * 0.4 + gl.ph * 9) * 6, y = gl.y;
      ctx.moveTo(x, y - s * 0.6); ctx.lineTo(x + s * 0.16, y - s * 0.12); ctx.lineTo(x + s, y); ctx.lineTo(x + s * 0.16, y + s * 0.12);
      ctx.lineTo(x, y + s * 0.6); ctx.lineTo(x - s * 0.16, y + s * 0.12); ctx.lineTo(x - s, y); ctx.lineTo(x - s * 0.16, y - s * 0.12); ctx.closePath();
    }
    ctx.fill();
  }
  ctx.restore();
  drawBoil(ctx, t, P, o, V);
}
// white water in the river bend: foam streaks wrapping the boulders, standing waves
function drawRapids(ctx, t, P) {
  const rp = SPRING.rapids;
  ctx.save();
  const foam = new Path2D(), foam2 = new Path2D();
  for (let i = 0; i < 46; i++) {
    const sp = 70 + hash1(i * 1.7) * 40;
    const span = rp.x1 - rp.x0 + 160;
    const x = rp.x1 + 60 - (((t * sp + hash1(i * 3.9) * span) % span) + span) % span;
    const top = riverTopY(x), bot = riverBotY(x);
    const y = lerp(top + 14, bot - 14, hash1(i * 5.3));
    const len = 10 + hash1(i * 2.1) * 26, th = 1.4 + hash1(i * 4.4) * 1.8;
    const fade = smoothstep(rp.x0 - 80, rp.x0 + 40, x) * (1 - smoothstep(rp.x1 - 20, rp.x1 + 60, x));
    if (fade < 0.2 || !freeWater(x, y, 2)) continue;
    ellipseP(i % 3 ? foam : foam2, x, y + Math.sin(t * 5 + i) * 1.2, len * fade, th);
  }
  for (const rk of RAPID_ROCKS) {
    // foam cushion + trailing wake (downstream = left)
    for (let k = 0; k < 3; k++) {
      const ph = frac(t * 1.4 + k / 3 + rk.x * 0.01);
      ellipseP(foam, rk.x - rk.rx * (0.9 + ph * 2.2), rk.y + rk.ry * 0.45 + Math.sin(t * 3 + k) * 1.5, rk.rx * (0.7 - ph * 0.3), 2.2);
    }
    ellipseP(foam2, rk.x + rk.rx * 0.95, rk.y + rk.ry * 0.3, rk.rx * 0.35, rk.ry * 0.35);
  }
  ctx.fillStyle = rgba(P.wHi, 0.7); ctx.fill(foam);
  ctx.fillStyle = rgba('#FFFFFF', 0.85); ctx.fill(foam2);
  ctx.restore();
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
  if (devScale(ctx) * size < 64) {
    // small on screen: one run per line (the per-glyph hand-painted wobble is invisible anyway)
    const w = ctx.measureText(text).width, sc = maxW && w > maxW ? maxW / w : 1;
    ctx.save();
    ctx.translate(x, y); ctx.scale(sc, 1);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    if (shadow) { ctx.fillStyle = shadow; ctx.fillText(text, size * 0.04, size * 0.06); }
    ctx.fillStyle = color; ctx.fillText(text, 0, 0);
    ctx.restore();
    return;
  }
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
// ---- fire: batched multi-tongue cartoon flames ------------------------------------------
function tongueP(p, x, y, w, H, sx) {
  p.moveTo(x - w, y);
  p.bezierCurveTo(x - w * 1.18, y - H * 0.45, x + sx * 0.35 - w * 0.4, y - H * 0.74, x + sx, y - H);
  p.bezierCurveTo(x + sx * 0.35 + w * 0.5, y - H * 0.7, x + w * 1.18, y - H * 0.42, x + w, y);
  p.quadraticCurveTo(x, y + w * 0.55, x - w, y);
  p.closePath();
}
// flames: [{x, y (base), h, w, seed}] — drawn in one batch (glow, red, orange, yellow, licks)
function drawFlames(ctx, t, flames, o = {}) {
  if (!flames.length) return;
  const L = [new Path2D(), new Path2D(), new Path2D()], licks = new Path2D();
  const glows = [];
  for (const f of flames) {
    const sd = f.seed || 0;
    const fl = 0.78 + 0.3 * noise1(t * 8.5 + sd * 3.1);
    const tongues = [[0, 1, 1], [-0.55, 0.68, 0.62], [0.6, 0.6, 0.58]];
    tongues.forEach(([dx, hk, wk], j) => {
      const H = f.h * hk * (j ? 0.75 + 0.35 * noise1(t * 11 + sd * 5 + j * 7) : fl);
      const sx = noise1(t * 4.3 + sd + j * 2.2) * f.w * 0.7 + dx * f.w * 0.4;
      const bx = f.x + dx * f.w, w = f.w * wk;
      for (let k = 0; k < 3; k++) {
        const sc = [1, 0.66, 0.36][k];
        tongueP(L[k], bx + sx * 0.08 * k, f.y + w * 0.18 * k, w * sc, H * (k === 0 ? 1 : sc * 1.12), sx * sc);
      }
    });
    const lk = noise1(t * 6.1 + sd * 9.7);
    if (lk > 0.05) {
      const ly = f.y - f.h * (1.08 + 0.4 * frac(t * 1.7 + sd * 0.37)), lx = f.x + noise1(t * 3 + sd) * f.w * 0.6;
      tongueP(licks, lx, ly, f.w * 0.22 * lk, f.h * 0.22 * lk, 0);
    }
    glows.push(f);
  }
  ctx.save();
  if (o.glow !== false) {
    ctx.globalCompositeOperation = 'lighter';
    const gp = new Path2D();
    for (const f of glows) ellipseP(gp, f.x, f.y - f.h * 0.35, f.w * 2.2 + f.h * 0.3, f.h * 0.7);
    ctx.fillStyle = 'rgba(255,96,30,0.1)'; ctx.fill(gp);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.fillStyle = 'rgba(226,58,24,0.95)'; ctx.fill(L[0]); ctx.fill(licks);
  ctx.fillStyle = '#FF8A26'; ctx.fill(L[1]);
  ctx.fillStyle = '#FFE27A'; ctx.fill(L[2]);
  ctx.restore();
}
function drawFlame(ctx, x, y, h, w, t, seed) { drawFlames(ctx, t, [{ x, y, h, w, seed }], { glow: false }); }
// dark smoke rising from fires: sources [{x, y, s}]
function drawFireSmoke(ctx, t, sources, amount = 1) {
  if (amount <= 0) return;
  ctx.save();
  sources.forEach((src, i) => {
    for (let k = 0; k < 3; k++) {
      const ph = frac(t * 0.4 + k / 3 + hash1(i * 3.7) * 0.2);
      const x = src.x + ph * 50 * src.s + Math.sin(ph * 4 + i) * 7 * src.s, y = src.y - ph * 190 * src.s;
      const r = (16 + ph * 52) * src.s;
      const a = 0.55 * amount * Math.sin(PI * Math.min(1, ph * 1.3 + 0.08));
      if (a < 0.02) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(44,34,38,${a})`); g.addColorStop(0.6, `rgba(44,34,38,${a * 0.6})`); g.addColorStop(1, 'rgba(44,34,38,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); circleP(ctx, x, y, r); ctx.fill();
    }
  });
  ctx.restore();
}
function drawSnoozeSignImpl(ctx, t, P, o) {
  const burn = o.overlayOnly ? 0 : o.burn || 0;
  if (o.overlayOnly) { drawSignBurn(ctx, t, P, o); return; }
  drawSignBase(ctx, t, P, o, burn);
  if (o.burn > 0) drawSignBurn(ctx, t, P, o);
}
function drawSignBase(ctx, t, P, o, burn) {
  const lines = o.lines || ['SNOOZE SPRINGS', 'No Worries Allowed'];
  const sc = o.scale || 1;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(sc, sc);
  const ch = (c) => (burn > 0 ? mix(P.g(c), '#2A1810', burn * 0.3) : P.g(c));
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
  const paint = burn > 0 ? mix(P.g(C.paint), '#3A2A22', burn * 0.25) : P.g(C.paint);
  const sh = rgba('#4A2A14', 0.45);
  ctx.save(); ctx.rotate(-0.025);
  paintText(ctx, lines[0], 0, -92, 27, 700, paint, sh, 11, 190);
  ctx.restore();
  ctx.save(); ctx.rotate(0.018);
  const c2 = o.check ? paint : (burn > 0 ? mix(P.g(C.paint2), '#3A2A22', burn * 0.25) : P.g(C.paint2));
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
  ctx.restore();
}
// the burning: char creeping up the boards from the bottom, a glowing ember front, smoke, flames.
// Drawn over the (cached) unburnt sign.
function drawSignBurn(ctx, t, P, o) {
  const burn = o.burn || 0;
  if (burn <= 0) return;
  const sc = o.scale || 1;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(sc, sc);
  {
    const front = lerp(-22, -132, Math.pow(burn, 0.85));
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, -107, -114, 214, 44, 6); roundRect(ctx, -98, -67, 196, 34, 6);
    for (const px of [-74, 74]) ctx.rect(px - 7, -126, 14, 130);
    ctx.clip();
    ctx.fillStyle = rgba('#2A1810', burn * 0.3); ctx.fillRect(-120, -140, 240, 160);
    const g = ctx.createLinearGradient(0, front - 14, 0, front + 40);
    g.addColorStop(0, 'rgba(46,26,18,0)'); g.addColorStop(0.3, 'rgba(46,26,18,0.72)'); g.addColorStop(1, 'rgba(34,20,14,0.86)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-120, 20);
    for (let x = -120; x <= 120; x += 8) ctx.lineTo(x, front - 14 + Math.sin(x * 0.11 + 1.3) * 6 + noise1(x * 0.05 + 4) * 8);
    ctx.lineTo(120, 20); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,120,40,${0.75 + 0.25 * noise1(t * 6)})`; ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let x = -110; x <= 110; x += 6) { const y = front - 2 + Math.sin(x * 0.17 + t * 2) * 3 + noise1(x * 0.2 + t) * 3; x === -110 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.restore();
    // smoke, flames along the char front and up the posts, warm glow
    drawFireSmoke(ctx, t, [{ x: -40, y: front - 30, s: 1 }, { x: 50, y: front - 36, s: 1.1 }], burn);
    const n = Math.round(4 + burn * 5), fl = [];
    for (let i = 0; i < n; i++) {
      const fx = -98 + (i / Math.max(1, n - 1)) * 196 + (hash1(i * 4.1) - 0.5) * 16;
      fl.push({ x: fx, y: Math.min(-30, front + 8 + hash1(i * 2.2) * 10), h: (18 + 62 * burn) * (0.55 + 0.6 * hash1(i * 5.5)), w: 8 + 6 * burn, seed: i * 1.7 });
    }
    if (burn > 0.4) { fl.push({ x: -74, y: -106, h: 46 * burn, w: 9, seed: 41 }); fl.push({ x: 74, y: -100, h: 52 * burn, w: 9, seed: 43 }); }
    drawFlames(ctx, t, fl);
  }
  ctx.restore();
}

// =====================================================================================
// lava into the pool
// =====================================================================================
// The lava spreading over the water is drawn in a FLAT ground-plane space (u right, v toward the
// viewer) and mapped to the screen with y squashed by LAVA_SQ (perspective). Entry 1 = the main
// tongue at the back-right, entry 2 = the smaller one by the sign.
const LAVA_SQ = 0.38;
const LAVA_E = [{ x: 997, y: 478, th: 2.25, R0: 30, R1: 500, k0: 0 }, { x: 1141, y: 490, th: 1.95, R0: 20, R1: 210, k0: 0.16 }];
// lobe radius in flat space along direction th (cos → u, sin → v)
function lobeR(E, i, k, th, t) {
  const kk = clamp((k - E.k0) / (1 - E.k0));
  if (kk <= 0) return 0;
  const R = E.R0 + E.R1 * kk;
  const bias = 0.34 + 0.66 * Math.pow(0.5 + 0.5 * Math.cos(th - E.th), 0.8);
  const fing = 0.2 * Math.pow(Math.max(0, Math.sin(th * 5 + i * 2 + 1)), 2) + 0.1 * Math.pow(Math.max(0, Math.sin(th * 9 + i * 3)), 3);
  const c = Math.cos(th), s = Math.sin(th);
  return R * bias * (1 + 0.28 * U.noise2(c * 1.3 + 5 + i * 9, s * 1.3 + 2) + 0.12 * U.noise2(c * 3.2 + 1 + i * 4, s * 3.2 + 7) + fing + 0.02 * Math.sin(t * 0.6 + th * 3));
}
const LOBE_N = 72;
// lobe outline points in FLAT space relative to entry i (scale s shrinks it toward the entry)
function lobePts(i, k, t, s = 1) {
  const E = LAVA_E[i], out = [];
  for (let j = 0; j < LOBE_N; j++) {
    const th = (j / LOBE_N) * TAU;
    const r = lobeR(E, i, k, th, t) * s;
    out.push([Math.cos(th) * r, Math.sin(th) * r]);
  }
  return out;
}
// Voronoi-ish crust plates over the flat lava field around entry 1 (computed once)
function clipHalf(poly, px, py, nx, ny) {
  // keep the part of poly with (q - p)·n <= 0
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = (a[0] - px) * nx + (a[1] - py) * ny, db = (b[0] - px) * nx + (b[1] - py) * ny;
    if (da <= 0) out.push(a);
    if ((da <= 0) !== (db <= 0)) { const k = da / (da - db); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); }
  }
  return out;
}
const LAVA_PLATES = (() => {
  const r = rng(818), seeds = [];
  const SX = 50, SY = 44;
  for (let v = -80; v <= 640; v += SY) for (let u = -620; u <= 420; u += SX) seeds.push([u + r.range(-0.36, 0.36) * SX, v + r.range(-0.36, 0.36) * SY]);
  const out = [];
  seeds.forEach(([sx, sy], i) => {
    let poly = [[sx - SX * 1.6, sy - SY * 1.6], [sx + SX * 1.6, sy - SY * 1.6], [sx + SX * 1.6, sy + SY * 1.6], [sx - SX * 1.6, sy + SY * 1.6]];
    for (let j = 0; j < seeds.length; j++) {
      if (j === i) continue;
      const [qx, qy] = seeds[j];
      if (Math.abs(qx - sx) > SX * 2.6 || Math.abs(qy - sy) > SY * 2.6) continue;
      poly = clipHalf(poly, (sx + qx) / 2, (sy + qy) / 2, qx - sx, qy - sy);
      if (poly.length < 3) break;
    }
    if (poly.length < 3) return;
    const cx = poly.reduce((m, q) => m + q[0], 0) / poly.length, cy = poly.reduce((m, q) => m + q[1], 0) / poly.length;
    const sh = r.range(0.8, 0.88);
    out.push({ cx, cy, th: Math.atan2(cy, cx), d: Math.hypot(cx, cy), pts: poly.map(([x, y]) => [cx + (x - cx) * sh, cy + (y - cy) * sh]) });
  });
  return out;
})();
// is flat point (u, v) (relative to entry 0) inside lobe i scaled by s?
function inLobe(i, k, t, u, v, s) {
  const E = LAVA_E[i], E0 = LAVA_E[0];
  const du = u - (E.x - E0.x), dv = v - (E.y - E0.y) / LAVA_SQ;
  const th = Math.atan2(dv, du);
  return Math.hypot(du, dv) < lobeR(E, i, k, th < 0 ? th + TAU : th, t) * s;
}
// soft steam billows bursting up: along a strip {x, y, w} or from emitter points o.points [[x,y]...]
// {x, y, w, amount, scale, seed, color, h (rise height), points, maxPuffs, spacing}
// Each billow is one soft radial-gradient puff (no hard discs, no rings).
function drawSteamBurst(ctx, t, o = {}) {
  const x = o.x ?? 640, y = o.y ?? 520, w = o.w ?? 300, amount = clamp(o.amount ?? 1, 0, 2), sc = o.scale ?? 1, seed = o.seed ?? 5;
  if (amount <= 0) return;
  const pts = o.points;
  const N = pts ? Math.round(Math.min(o.maxPuffs ?? 10, pts.length) * Math.min(1.5, amount)) : Math.round((amount * w) / (o.spacing ?? 60));
  const rise = (o.h ?? 190) * sc;
  const col = o.color || '#F2ECEA';
  const [cr, cg, cb] = U.hexToRgb(col);
  const A = 0.55 * Math.min(1, amount);
  ctx.save();
  for (let i = 0; i < N; i++) {
    const L = 2.2 + hash1(seed * 7 + i * 1.9) * 1.6;
    const tt = t / L + hash1(seed + i * 3.7), cyc = Math.floor(tt), k = tt - cyc;
    let bx, by;
    if (pts) { const q = pts[Math.floor(hash2(i * 3 + seed, cyc * 1.7) * pts.length)]; bx = q[0]; by = q[1]; } else { bx = x - w / 2 + w * hash2(i * 5 + seed, cyc * 1.3); by = y; }
    const px = bx + k * 34 * sc * (hash1(i + cyc) - 0.3), py = by - Math.pow(k, 0.75) * rise;
    const r = (22 + 62 * Math.pow(k, 0.6)) * sc;
    const a = Math.sin(PI * Math.min(1, k * 1.15 + 0.06)) * A;
    if (a < 0.02) continue;
    const g = ctx.createRadialGradient(px - r * 0.15, py - r * 0.2, r * 0.05, px, py, r);
    g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`); g.addColorStop(0.55, `rgba(${cr},${cg},${cb},${a * 0.62})`); g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); circleP(ctx, px, py, r); ctx.fill();
  }
  ctx.restore();
}
// white-hot spits where lava hits water: droplets flung up and falling back
function drawHiss(ctx, t, points, amount, seed = 3) {
  if (amount <= 0 || !points.length) return;
  const drops = new Path2D(), hot = new Path2D();
  const N = Math.round(points.length * 1.5 * amount);
  for (let i = 0; i < N; i++) {
    const per = 0.55 + hash1(i * 2.3 + seed) * 0.5;
    const tt = t / per + hash1(i * 5.1 + seed), cyc = Math.floor(tt), k = tt - cyc;
    const q = points[(i * 3 + cyc) % points.length];
    const vx = (hash2(i, cyc) - 0.5) * 70, vy = -(60 + 90 * hash2(i * 3, cyc));
    const s = k * per;
    const x = q[0] + vx * s, y = q[1] + vy * s + 0.5 * 400 * s * s;
    if (y > q[1] + 4) continue;
    circleP(k < 0.3 ? hot : drops, x, y, 1.4 + 1.2 * (1 - k));
  }
  ctx.fillStyle = rgba('#FFF4E8', 0.85); ctx.fill(drops);
  ctx.fillStyle = rgba('#FFC870', 0.95); ctx.fill(hot);
}
function drawLavaToPool(ctx, t, P, o) {
  const Lv = o.lava;
  if (Lv <= 0) return;
  // the bushes along its path catch fire
  const fb = smoothstep(0.03, 0.3, Lv);
  if (fb > 0) {
    const spots = [[884, 444, 1], [914, 437, 2], [950, 447, 3], [1034, 449, 4], [1066, 441, 5], [1098, 448, 6], [1178, 452, 7], [1210, 445, 8], [866, 452, 9]];
    const fl = [];
    spots.forEach(([fx, fy, sd], i) => {
      const k = clamp(fb * 1.7 - i * 0.09);
      if (k > 0) fl.push({ x: fx, y: fy, h: (26 + 16 * hash1(sd * 3.3)) * k, w: 8 + 3 * hash1(sd), seed: sd });
    });
    drawFireSmoke(ctx, t, [{ x: 930, y: 400, s: 1.2 }, { x: 1080, y: 404, s: 1.1 }], fb * 0.9);
    drawFlames(ctx, t, fl);
  }
  // the tongues: out of the burning undergrowth, widening as they ooze down the bank
  // the pours: lava oozes out from under the burning undergrowth and curtains over the rim rocks,
  // widening as it goes (lumpy crust edges, bright core, drips)
  const p1 = clamp(Lv / 0.26), p2 = clamp((Lv - 0.12) / 0.26);
  drawLavaFlow(ctx, t, LAVA_P1, LAVA_P1_L, p1, (u) => lerp(20, 44, Math.pow(u, 0.7)) * (1 + 0.12 * noise1(u * 4 + 2)), 31, { speed: 22, glowK: 1.3, step: 4, lobeK: 0.12, gradBody: true });
  if (p2 > 0) drawLavaFlow(ctx, t, LAVA_P2, LAVA_P2_L, p2, (u) => lerp(14, 30, Math.pow(u, 0.7)) * (1 + 0.12 * noise1(u * 4 + 7)), 37, { speed: 20, glowK: 1.2, step: 4, lobeK: 0.12, gradBody: true });
  const drips = new Path2D(), dripGlow = new Path2D();
  [[LAVA_P1, p1, 40], [LAVA_P2, p2, 26]].forEach(([pts, pp, w], j) => {
    if (pp < 0.5) return;
    const e = pts[pts.length - 1];
    for (let d = 0; d < 4; d++) {
      const ph = frac(t * 1.6 + d * 0.27 + j * 0.13);
      const x = e[0] + (hash1(d * 3.1 + j + Math.floor(t * 1.6 + d * 0.27 + j * 0.13)) - 0.5) * w * 0.8, y = e[1] - 10 + ph * ph * 22;
      circleP(drips, x, y, 2.6 * (1 - ph * 0.5)); circleP(dripGlow, x, y, 6);
    }
  });
  ctx.save();
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,120,40,0.25)'; ctx.fill(dripGlow);
  ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#FFB13B'; ctx.fill(drips);
  ctx.restore();
  // drips off the tongue's edge over the rim
  const k = smoothstep(0.24, 1, Lv);
  const entering = [smoothstep(0.2, 0.27, Lv), smoothstep(0.32, 0.39, Lv)];
  const E0 = LAVA_E[0];
  if (k > 0) {
    ctx.save();
    ctx.clip(POOL_PATH);
    // lava in flat space
    ctx.translate(E0.x, E0.y); ctx.scale(1, LAVA_SQ);
    const off2 = [LAVA_E[1].x - E0.x, (LAVA_E[1].y - E0.y) / LAVA_SQ];
    const outline = (s) => {
      const p = new Path2D();
      polyP(p, lobePts(0, k, t, s));
      if (k > LAVA_E[1].k0) polyP(p, lobePts(1, k, t, s), off2[0], off2[1]);
      return p;
    };
    const outer = outline(1), inner = outline(0.9);
    // fiery glow on the water hugging the lava edge (soft band along the outline, perspective-squashed)
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(244,108,44,0.26)'; ctx.lineWidth = 84; ctx.stroke(outer);
    ctx.fillStyle = '#3A1A14'; ctx.fill(outer);            // cooled crust levee along the edge
    const hot = ctx.createRadialGradient(0, 0, 0, 0, 0, 40 + 380 * k);
    hot.addColorStop(0, '#FFD45A'); hot.addColorStop(0.15, '#FF9A2A'); hot.addColorStop(0.5, '#F05A1C'); hot.addColorStop(1, '#C8361A');
    ctx.fillStyle = hot; ctx.fill(inner);
    // crust plates (never at the hot entries, never on the levee): clipped to the inner lobe
    ctx.save();
    ctx.clip(inner);
    const plates = new Path2D(), platesHi = new Path2D();
    for (const pl of LAVA_PLATES) {
      const creep = 1 + 0.06 * k;
      const cx = pl.cx * creep, cy = pl.cy * creep;
      if (Math.hypot(cx, cy) < 30 + 40 * k) continue;
      if (Math.hypot(cx - off2[0], cy - off2[1]) < 26 + 20 * k) continue;
      if (!inLobe(0, k, t, cx, cy, 0.97) && !(k > LAVA_E[1].k0 && inLobe(1, k, t, cx, cy, 0.97))) continue;
      const dx = cx - pl.cx, dy = cy - pl.cy;
      const pts = pl.pts;
      plates.moveTo(pts[0][0] + dx, pts[0][1] + dy);
      for (let i = 1; i < pts.length; i++) plates.lineTo(pts[i][0] + dx, pts[i][1] + dy);
      plates.closePath();
      // lit top edge of each plate (the edges facing up-screen)
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if (b[0] < a[0] && Math.abs(b[1] - a[1]) < Math.abs(b[0] - a[0]) * 0.8) { platesHi.moveTo(a[0] + dx, a[1] + dy); platesHi.lineTo(b[0] + dx, b[1] + dy); }
      }
    }
    ctx.fillStyle = '#3C2724'; ctx.fill(plates);
    ctx.strokeStyle = 'rgba(122,84,72,0.9)'; ctx.lineWidth = 2.4; ctx.stroke(platesHi);
    // incandescent glints wandering along the seams
    ctx.fillStyle = `rgba(255,236,160,${0.8 + 0.2 * noise1(t * 4)})`;
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      const pl = LAVA_PLATES[(i * 37) % LAVA_PLATES.length];
      const a = t * 0.8 + i * 2.3;
      const x = pl.cx + Math.cos(a) * 20, y = pl.cy + Math.sin(a) * 18;
      if (!inLobe(0, k, t, x, y, 0.9)) continue;
      ellipseP(ctx, x, y, 4 + 3 * hash1(i), 2.6);
    }
    ctx.fill();
    ctx.restore();
    ctx.restore();
    // steam + hissing spits along the lava/water contact line (world space)
    const contact = [];
    const add = (i, ox, oy) => {
      const pts = lobePts(i, k, t, 1.02);
      for (let j = 0; j < pts.length; j += 2) {
        const x = E0.x + ox + pts[j][0], y = E0.y + (oy + pts[j][1]) * LAVA_SQ;
        if (freeWater(x, y, 6)) contact.push([x, y]);
      }
    };
    add(0, 0, 0);
    if (k > LAVA_E[1].k0) add(1, off2[0], off2[1]);
    if (contact.length) {
      drawSteamBurst(ctx, t, { points: contact, amount: 0.7 + 0.5 * k, scale: 0.7 + 0.5 * k, seed: 23, color: P.steam, h: 150, maxPuffs: 9 });
      drawHiss(ctx, t, contact, 0.6 + 0.4 * k, 5);
    }
  }
  // steam explosions where each tongue first hits the water
  for (let i = 0; i < 2; i++) {
    const ek = entering[i];
    if (ek <= 0) continue;
    const E = LAVA_E[i];
    const boom = 1 - smoothstep(0, 0.12, (i ? Lv - 0.39 : Lv - 0.27));
    drawSteamBurst(ctx, t, { x: E.x - 6, y: E.y + 4, w: i ? 60 : 90, amount: (0.9 + 0.8 * boom) * ek, scale: (i ? 0.9 : 1.2) + 0.6 * boom, seed: 61 + i, color: P.steam, h: 230, spacing: 24 });
    drawHiss(ctx, t, [[E.x - 20, E.y + 4], [E.x, E.y + 6], [E.x + 18, E.y + 3]], ek * (0.8 + boom), 9 + i);
  }
}

// =====================================================================================
// particles
// =====================================================================================
// Progressive boil of the spring (waterHeat): calm bubbles → .35 fizz → .65 churning rings + foam
// patches + whitening → .85 big domes bursting into droplet crowns + steam billows rolling off
const BUBBLE_ROWS = [
  { x: 670, y: 506, w: 860, h: 50, s: 0.68, seed: 2 },
  { x: 690, y: 600, w: 960, h: 90, s: 0.92, seed: 3 },
  { x: 690, y: 712, w: 900, h: 90, s: 1.12, seed: 4 },
];
function randWater(i, cyc, seed, m = 6) {
  // a pseudo-random open-water point for particle i in cycle cyc (perspective-weighted toward the back)
  for (let a = 0; a < 3; a++) {
    const y = lerp(478, 800, Math.pow(hash2(i * 3 + a * 17 + seed, cyc * 1.37), 1.25));
    const sp = freeSpan(y);
    if (!sp) continue;
    const x = lerp(sp[0] + m, sp[1] - m, hash2(i * 7 + a * 5 + seed * 3, cyc * 2.11 + 1));
    if (freeWater(x, y, m)) return [x, y];
  }
  return null;
}
function drawBoil(ctx, t, P, o, V) {
  const heat = o.waterHeat;
  if (heat <= 0.15) return;
  const lavaK = smoothstep(0.3, 0.8, o.lava || 0), lavaDim = 1 - 0.45 * lavaK;
  const fz = smoothstep(0.25, 0.6, heat), tk = smoothstep(0.5, 0.9, heat) * (1 - 0.7 * lavaK), big = smoothstep(0.75, 1, heat);
  ctx.save();
  if (tk > 0) {
    // the surface whitens in broad churning sheets (a few soft gradient ellipses, perspective-flat)
    for (let i = 0; i < 5; i++) {
      const per = 2.6 + hash1(i * 1.3) * 1.4, tt = t / per + hash1(i * 2.9), cyc = Math.floor(tt), k = tt - cyc;
      const q = randWater(i + 700, cyc, 51, 60);
      if (!q) continue;
      const sc = depthScale(q[1]), rx = (90 + 70 * hash1(i * 4.4 + cyc)) * sc, a = 0.5 * tk * Math.sin(PI * k) * lavaDim;
      if (a < 0.02 || !vis(V, q[0] - rx, q[1] - 30, q[0] + rx, q[1] + 30)) continue;
      ctx.save();
      ctx.translate(q[0], q[1]); ctx.scale(1, 0.22);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, rgba('#F4FFFC', a)); g.addColorStop(0.6, rgba('#F4FFFC', a * 0.5)); g.addColorStop(1, rgba('#F4FFFC', 0));
      ctx.fillStyle = g; ctx.fillRect(-rx, -rx, 2 * rx, 2 * rx);
      ctx.restore();
    }
    // churning turbulence rings + foam patches across the whole pool
    const rings = new Path2D(), foam = new Path2D(), foamHi = new Path2D();
    const NR = Math.round(12 * tk);
    for (let i = 0; i < NR; i++) {
      const per = 0.7 + hash1(i * 2.9) * 0.6;
      const tt = t / per + hash1(i * 4.1), cyc = Math.floor(tt), k = tt - cyc;
      const q = randWater(i, cyc, 11, 30);
      if (!q || !vis(V, q[0] - 60, q[1] - 20, q[0] + 60, q[1] + 20)) continue;
      const sc = depthScale(q[1]), r = (8 + 34 * k) * sc;
      rings.moveTo(q[0] + r, q[1]); rings.ellipse(q[0], q[1], r, r * 0.24, 0, 0, TAU);
      const r2 = r * 0.6; rings.moveTo(q[0] + r2, q[1]); rings.ellipse(q[0], q[1], r2, r2 * 0.24, 0, 0, TAU);
    }
    const NF = Math.round(34 * tk);
    for (let i = 0; i < NF; i++) {
      const per = 1.6 + hash1(i * 3.3) * 1.2;
      const tt = t / per + hash1(i * 6.7), cyc = Math.floor(tt), k = tt - cyc;
      const q = randWater(i + 100, cyc, 23, 34);
      if (!q || !vis(V, q[0] - 60, q[1] - 20, q[0] + 60, q[1] + 20)) continue;
      const sc = depthScale(q[1]), sz = (18 + 22 * hash1(i * 5.5)) * sc * Math.sin(PI * k) * (1 + 0.15 * Math.sin(t * 9 + i));
      if (sz < 2) continue;
      for (const [dx, dy, rr] of [[0, 0, 1], [-0.9, 0.1, 0.62], [0.85, 0.05, 0.7], [0.3, -0.12, 0.5]]) ellipseP(foam, q[0] + dx * sz, q[1] + dy * sz * 0.3, sz * rr, sz * rr * 0.32);
      ellipseP(foamHi, q[0] - sz * 0.2, q[1] - sz * 0.08, sz * 0.45, sz * 0.12);
    }
    ctx.strokeStyle = rgba('#F4FFFC', 0.35 * tk * lavaDim); ctx.lineWidth = 1.4; ctx.stroke(rings);
    ctx.fillStyle = rgba('#F2FFFB', 0.42 * tk * lavaDim); ctx.fill(foam);
    ctx.fillStyle = rgba('#FFFFFF', 0.6 * tk * lavaDim); ctx.fill(foamHi);
  }
  if (fz > 0) {
    // fizz: tiny bubbles popping all over the surface
    const fizz = new Path2D(), fizzHi = new Path2D();
    const N = Math.round(130 * fz);
    for (let i = 0; i < N; i++) {
      const per = 0.35 + hash1(i * 1.7) * 0.4;
      const tt = t / per + hash1(i * 9.1), cyc = Math.floor(tt), k = tt - cyc;
      const q = randWater(i + 300, cyc, 37, 8);
      if (!q || q[0] < V.x0 || q[0] > V.x1 || q[1] < V.y0 || q[1] > V.y1) continue;
      const sc = depthScale(q[1]), r = (1.2 + 1.8 * hash1(i * 3.9)) * sc * Math.sin(PI * k);
      if (r < 0.5) continue;
      if (k < 0.7) circleP(fizz, q[0], q[1] - r * 0.5, r);
      else { fizzHi.moveTo(q[0] + r * 2.4, q[1]); fizzHi.ellipse(q[0], q[1], r * 2.4, r * 0.7, 0, 0, TAU); }
    }
    ctx.fillStyle = rgba('#F4FFFC', 0.85 * fz); ctx.fill(fizz);
    ctx.strokeStyle = rgba('#FFFFFF', 0.7 * fz); ctx.lineWidth = 1.1; ctx.stroke(fizzHi);
  }
  // bubbles → domes
  const a = smoothstep(0.18, 1, heat) * lavaDim * (1 - 0.35 * lavaK);
  for (const row of BUBBLE_ROWS) {
    if (!vis(V, row.x - row.w / 2 - 40, row.y - row.h - 60, row.x + row.w / 2 + 40, row.y + row.h)) continue;
    drawBubbles(ctx, t, {
      x: row.x, y: row.y, w: row.w, h: row.h, amount: row.s < 0.7 ? Math.min(a, 0.62) : a, scale: row.s, seed: row.seed, color: P.wHi, shade: P.w3, domeCol: mix(P.w1, '#EFFFFA', 0.38), pool: true,
      domeR: big > 0 ? [lerp(11, 20, big), lerp(30, 40, big)] : null, domeSpacing: lerp(70, 66, big),
    });
  }
  ctx.restore();
  const bil = smoothstep(0.45, 1, heat) * (1 - lavaK);
  if (bil > 0.02) {
    // broad soft billows rolling off the boiling surface (behind the swimmers)
    for (const [y, w, s, sd] of [[548, 940, 1.1, 71]]) {
      if (!vis(V, 680 - w / 2, y - 220, 680 + w / 2, y + 10)) continue;
      drawSteamBurst(ctx, t, { x: 680, y, w, amount: 0.9 * bil * lavaDim, scale: s, seed: sd, color: P.steam, h: 160, spacing: 70 });
    }
  }
}
// camera zoom relative to the frame's design scale (1 = the full 1280x720 view), from the transform
function zoomRel(ctx) {
  const cw = (ctx.canvas && ctx.canvas.width) || 1920;
  return devScale(ctx) / (cw / 1280);
}
// closed ribbon along a polyline with ROUND ends (appends a subpath); wfn(u) = full width at u
function roundRibbonP(p, pts, wfn) {
  const n = pts.length, Lp = [], Rp = [], W = [];
  let a0 = 0, a1 = 0;
  for (let i = 0; i < n; i++) {
    const q = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    if (i === 0) a0 = Math.atan2(dy, dx);
    if (i === n - 1) a1 = Math.atan2(dy, dx);
    const w = Math.max(0.05, wfn(i / (n - 1)) / 2);
    W.push(w);
    Lp.push([q[0] - dy * w, q[1] + dx * w]); Rp.push([q[0] + dy * w, q[1] - dx * w]);
  }
  p.moveTo(Lp[0][0], Lp[0][1]);
  for (let i = 1; i < n; i++) p.lineTo(Lp[i][0], Lp[i][1]);
  p.arc(pts[n - 1][0], pts[n - 1][1], W[n - 1], a1 + PI / 2, a1 - PI / 2, true);
  for (let i = n - 2; i >= 0; i--) p.lineTo(Rp[i][0], Rp[i][1]);
  p.arc(pts[0][0], pts[0][1], W[0], a0 - PI / 2, a0 - 1.5 * PI, true);
  p.closePath();
}
// Rising steam from a strip centred at x, w wide, surface y:
//  * wisps (the ♨ motif): soft S-curved ribbons with rounded ends, three nested layers (wide+faint →
//    narrow+denser) so the cross-section is soft; a vertical alpha ramp fades the base in and the tip
//    out; each wisp's alpha is a smooth envelope over its life (0 at both ends) so nothing ever pops.
//    In close-ups (camera zoom > 2) the wisps thin and fade so they never become glass shards.
//  * billows (amount > .35, billows !== false): soft radial-gradient puffs, alpha 0 at both ends.
function drawSteam(ctx, t, o = {}) {
  const x = o.x ?? 640, y = o.y ?? 520, w = o.w ?? 600, amount = clamp(o.amount ?? 0.5, 0, 2);
  const h = o.h ?? 120, scale = o.scale ?? 1, color = o.color || '#FFFFFF', seed = o.seed ?? 1;
  if (amount <= 0.001) return;
  const [cr, cg, cb] = U.hexToRgb(color);
  const col = (a) => `rgba(${cr},${cg},${cb},${a})`;
  const zr = zoomRel(ctx);
  const zw = zr > 2 ? Math.pow(2 / zr, 0.6) : 1, za = 1 - 0.5 * smoothstep(2, 5, zr);
  ctx.save();
  if (amount > 0.35 && o.billows !== false) {
    const N = Math.min(6, Math.round(((amount - 0.35) * w) / (100 * scale)));
    const A = (0.16 + 0.12 * Math.min(1, amount - 0.35)) * za;
    for (let i = 0; i < N; i++) {
      const L = 3 + hash1(seed * 31 + i * 1.7) * 2.4;
      const tt = t / L + hash1(seed * 17 + i * 3.3);
      const cyc = Math.floor(tt), k = tt - cyc;
      const a = Math.sin(PI * Math.min(1, k * 1.12)) * A;
      if (a < 0.004) continue;
      const px = x - w / 2 + w * ((i + 0.2 + 0.6 * hash2(i + seed * 7, cyc * 1.31)) / N);
      const yy = y - k * h * scale * (0.7 + 0.6 * hash1(i * 9.7 + seed));
      const xx = px + Math.sin(k * 4 + i) * 9 * scale * k + 10 * k * scale;
      const r = (26 + 48 * k) * scale;
      for (const [dx, dy, rr, ak] of [[0, 0, 1, 1], [-0.62, 0.22, 0.72, 0.8], [0.66, 0.18, 0.66, 0.75]]) {
        const cx = xx + dx * r, cy = yy + dy * r, R = rr * r;
        const g = ctx.createRadialGradient(cx - R * 0.15, cy - R * 0.2, R * 0.05, cx, cy, R);
        g.addColorStop(0, col(a * ak)); g.addColorStop(0.55, col(a * ak * 0.55)); g.addColorStop(1, col(0));
        ctx.fillStyle = g;
        ctx.beginPath(); circleP(ctx, cx, cy, R); ctx.fill();
      }
    }
  }
  // wisps
  const M = Math.max(1, Math.min(o.maxWisps ?? 12, Math.round((amount * w) / (80 * Math.max(0.7, scale)))));
  const Am = Math.min(1.25, 0.45 + amount * 0.6) * za;
  const LAY = [[1, 0.2], [0.6, 0.24], [0.28, 0.3]];
  for (let i = 0; i < M; i++) {
    const L = 3.2 + hash1(seed * 13 + i * 2.9) * 2.4;
    const tt = t / L + hash1(seed * 5 + i * 1.1);
    const cyc = Math.floor(tt), k = tt - cyc;
    const env = smoothstep(0, 0.24, k) * (1 - smoothstep(0.5, 1, k));
    if (env < 0.01) continue;
    const px = x - w / 2 + w * ((i + 0.15 + 0.7 * hash2(i * 3 + seed, cyc * 2.7 + 1)) / M);
    const hh = h * scale * (0.6 + 0.4 * hash1(i * 5.3 + cyc));
    const curl = hash1(i * 7.7 + cyc) > 0.5 ? 1 : -1;
    const ph = hash1(i * 2.1 + cyc) * TAU;
    const lift = k * hh * 0.5, len = hh * (0.35 + 0.5 * Math.min(1, k * 1.6));
    const pts = [];
    const y0 = y - 3 * scale - lift;
    for (let j = 0; j <= 10; j++) {
      const sj = j / 10;
      const yy = y0 - sj * len;
      const xx = px + Math.sin(sj * 6.6 + ph + t * 1.1) * 6.5 * scale * (0.5 + sj * 0.8) + curl * Math.pow(sj, 2.5) * 12 * scale * (0.4 + k);
      pts.push([xx, yy]);
    }
    const W = (6 + 8 * k) * scale * zw;
    const g = ctx.createLinearGradient(0, y0 + 2 * scale, 0, y0 - len - W * 0.5);
    g.addColorStop(0, col(0)); g.addColorStop(0.24, col(1)); g.addColorStop(0.62, col(0.8)); g.addColorStop(1, col(0));
    ctx.fillStyle = g;
    for (const [wf, af] of LAY) {
      ctx.globalAlpha = clamp(af * Am * env);
      ctx.beginPath();
      roundRibbonP(ctx, pts, (u) => W * wf * (0.42 + 0.58 * Math.pow(Math.sin(PI * Math.min(1, 0.06 + u * 0.98)), 0.75)));
      ctx.fill();
    }
  }
  ctx.restore();
}
// {x, y, w, h, amount, scale, seed, color, pool (only on open water), domeR: [min, max], domeSpacing}
function drawBubbles(ctx, t, o = {}) {
  const x = o.x ?? 640, y = o.y ?? 560, w = o.w ?? 400, h = o.h ?? 30, amount = clamp(o.amount ?? 0.5);
  const scale = o.scale ?? 1, seed = o.seed ?? 3, color = o.color || '#DAFAF4';
  const keep = o.pool ? (px, py, m) => freeWater(px, py, m) : () => true;
  if (amount <= 0.001) return;
  ctx.save();
  const N = Math.round((amount * w) / 30);
  const body = new Path2D(), small = new Path2D(), spec = new Path2D(), rings = new Path2D();
  for (let i = 0; i < N; i++) {
    const L = 0.8 + hash1(seed * 7 + i * 1.3) * 0.9;
    const tt = t / L + hash1(seed * 3 + i * 7.7);
    const cyc = Math.floor(tt), k = tt - cyc;
    const bx = x - w / 2 + w * hash2(i + seed * 11, cyc * 1.7);
    const by = y - h / 2 + h * hash2(i * 5 + seed, cyc * 3.1 + 2);
    const rmax = (2 + 3.5 * hash1(i * 4.3 + cyc)) * scale * (0.7 + 0.5 * amount);
    if (!keep(bx, by, rmax * 3 + 2)) continue;
    if (k < 0.75) {
      const r = rmax * Math.sqrt(k / 0.75);
      if (r < 2.6) { circleP(small, bx, by - r * 0.3, r); continue; }
      ellipseP(body, bx, by - r * 0.3, r, r * 0.8);
      circleP(spec, bx - r * 0.35, by - r * 0.65, r * 0.25);
    } else if (i % 3 === 0) {
      const kk = (k - 0.75) / 0.25;
      ellipseP(rings, bx, by, rmax * (1 + kk * 2), rmax * 0.3 * (1 + kk * 2));
    }
  }
  ctx.lineWidth = 1.1 * scale;
  ctx.fillStyle = rgba(color, 0.7); ctx.fill(small);
  ctx.fillStyle = rgba(color, 0.55); ctx.fill(body);
  ctx.fillStyle = '#FFFFFF'; ctx.fill(spec);
  ctx.strokeStyle = rgba(color, 0.5); ctx.stroke(rings);
  if (amount > 0.55) {
    const bk = (amount - 0.55) / 0.45;
    const M = Math.round((bk * w) / (o.domeSpacing ?? 64));
    const dR = o.domeR || [11, 30];
    const domes = new Path2D(), domeHi = new Path2D(), drops = new Path2D(), dRings = new Path2D(), spit = new Path2D(), domeSh = new Path2D(), domeEdge = new Path2D();
    for (let i = 0; i < M; i++) {
      const L = 1.1 + hash1(seed * 19 + i * 2.3) * 0.8;
      const tt = t / L + hash1(seed * 23 + i * 5.9);
      const cyc = Math.floor(tt), k = tt - cyc;
      const bx = x - w / 2 + w * hash2(i * 3 + seed * 5, cyc * 1.9 + 7);
      const by = y - h / 2 + h * hash2(i * 9 + seed, cyc * 2.3 + 1);
      const R = lerp(dR[0], dR[1], hash1(i * 6.1 + cyc)) * scale * (0.6 + 0.5 * bk);
      if (!keep(bx, by, R * 1.6 + 4)) continue;
      if (k < 0.55) {
        const gk = Math.sin((k / 0.55) * PI * 0.5);
        const hh = R * 0.75 * gk, rr = R * (0.6 + 0.4 * gk);
        const dome = (P2, a, b) => { P2.moveTo(bx + a, by); P2.bezierCurveTo(bx + a, by - b * KAPPA, bx + a * KAPPA, by - b, bx, by - b); P2.bezierCurveTo(bx - a * KAPPA, by - b, bx - a, by - b * KAPPA, bx - a, by); P2.closePath(); };
        dome(domes, rr, hh);
        ellipseP(domeSh, bx + rr * 0.08, by + rr * 0.06, rr * 1.25, rr * 0.24);
        domeEdge.moveTo(bx - rr * 0.92, by - hh * 0.32); domeEdge.bezierCurveTo(bx - rr * 0.8, by - hh * 1.04, bx + rr * 0.3, by - hh * 1.12, bx + rr * 0.72, by - hh * 0.62);
        ellipseP(domeHi, bx - rr * 0.3, by - hh * 0.62, rr * 0.42, hh * 0.22 + 0.6);
      } else {
        // burst: a crown of droplets flung up and out, a spit in the middle, spreading ring
        const kk = (k - 0.55) / 0.45;
        const nd = R > 18 ? 7 : 5;
        for (let d = 0; d < nd; d++) {
          const ang = -PI / 2 + (d - (nd - 1) / 2) * (2.6 / nd) + (hash1(i * 13 + d + cyc) - 0.5) * 0.3;
          const v = R * (2.4 + hash1(d * 3.1 + i) * 1.6);
          circleP(drops, bx + Math.cos(ang) * v * kk, by + Math.sin(ang) * v * kk * 1.4 + 3.2 * R * kk * kk, (1.6 + R * 0.08) * (1 - kk * 0.5));
        }
        if (R > 16) {
          // a short spit of droplets straight up out of the burst
          for (let d = 0; d < 3; d++) {
            const v = R * (3.2 + d * 0.9), s2 = kk * 0.55;
            const yy = by - v * s2 + 4.2 * R * s2 * s2 - d * R * 0.35 * (1 - kk);
            if (yy < by) circleP(spit, bx + (d - 1) * 1.2, yy, (2.2 + R * 0.06) * (1 - kk * 0.4) * (1 - d * 0.18));
          }
        }
        ellipseP(dRings, bx, by, R * (1 + kk * 1.8), R * 0.25 * (1 + kk * 1.8));
      }
    }
    ctx.fillStyle = rgba(o.shade || '#1E6A78', 0.22); ctx.fill(domeSh);
    ctx.fillStyle = rgba(o.domeCol || color, 0.72); ctx.fill(domes);
    ctx.strokeStyle = rgba('#FFFFFF', 0.85); ctx.lineWidth = 1.5 * scale; ctx.lineCap = 'round'; ctx.stroke(domeEdge);
    ctx.fillStyle = rgba('#FFFFFF', 0.7); ctx.fill(domeHi);
    ctx.strokeStyle = rgba(color, 0.4); ctx.lineWidth = 1.1 * scale; ctx.stroke(dRings);
    ctx.fillStyle = rgba(mix(color, '#FFFFFF', 0.5), 0.95); ctx.fill(drops); ctx.fill(spit);
  }
  ctx.restore();
}
// world-cell particle field: particles live in fixed 400-unit cells (stable under camera moves,
// constant density per area, only visible cells are drawn)
const PCELL = 400;
function cellsFor(ctx, area) {
  const V = viewRect(ctx);
  const x0 = Math.max(area.x0, V.x0 - 10), x1 = Math.min(area.x1, V.x1 + 10), y0 = Math.max(area.y0, V.y0 - 10), y1 = Math.min(area.y1, V.y1 + 10);
  const out = [];
  if (x1 <= x0 || y1 <= y0) return out;
  for (let cy = Math.floor(y0 / PCELL); cy <= Math.floor(y1 / PCELL); cy++) for (let cx = Math.floor(x0 / PCELL); cx <= Math.floor(x1 / PCELL); cx++) out.push([cx, cy]);
  return { cells: out, x0, x1, y0, y1 };
}
function drawAsh(ctx, t, o = {}) {
  const density = o.density ?? 1;
  if (density <= 0) return;
  const a = Object.assign({ x0: WX0, x1: WX1, y0: WY0, y1: WY1 }, o.area || {});
  const C2 = cellsFor(ctx, a);
  if (!C2.cells) return;
  const wind = o.wind ?? 14;
  const N = Math.round(20 * density);
  const groups = [new Path2D(), new Path2D(), new Path2D()];
  for (const [cx, cy] of C2.cells) {
    const sd = cx * 7.13 + cy * 3.77;
    for (let i = 0; i < N; i++) {
      const sp = 24 + hash1(i * 1.9 + sd) * 36;
      const x = cx * PCELL + frac(hash1(i * 3.7 + sd) + (t * wind + Math.sin(t * 0.7 + i) * 18) / PCELL) * PCELL;
      const y = cy * PCELL + frac(hash1(i * 5.3 + sd) + (t * sp) / PCELL) * PCELL;
      if (x < C2.x0 || x > C2.x1 || y < C2.y0 || y > C2.y1) continue;
      const s = 1.2 + hash1(i * 7.1 + sd) * 2.4;
      const r = t * (1 + hash1(i + sd)) + i;
      const P2 = groups[i % 3];
      P2.moveTo(x + Math.cos(r) * s, y + Math.sin(r) * s * 0.6);
      P2.lineTo(x - Math.sin(r) * s * 0.7, y + Math.cos(r) * s);
      P2.lineTo(x - Math.cos(r) * s, y - Math.sin(r) * s * 0.5);
      P2.closePath();
    }
  }
  ctx.save();
  [['#4A4044', 0.75], ['#8A7E7E', 0.7], ['#2E2628', 0.8]].forEach(([c, al], gi) => { ctx.fillStyle = rgba(c, al); ctx.fill(groups[gi]); });
  ctx.restore();
}
function drawEmbers(ctx, t, o = {}) {
  const density = o.density ?? 1;
  if (density <= 0) return;
  const a = Object.assign({ x0: WX0, x1: WX1, y0: -100, y1: 820 }, o.area || {});
  const C2 = cellsFor(ctx, a);
  if (!C2.cells) return;
  const N = Math.round(9 * density);
  const glow = new Path2D(), core = new Path2D(), core2 = new Path2D();
  for (const [cx, cy] of C2.cells) {
    const sd = cx * 5.31 + cy * 9.17;
    for (let i = 0; i < N; i++) {
      const sp = 30 + hash1(i * 2.1 + sd) * 60;
      const y = cy * PCELL + PCELL - frac(hash1(i * 4.3 + sd) + (t * sp) / PCELL) * PCELL;
      const x = cx * PCELL + frac(hash1(i * 6.7 + sd) + (t * 6) / PCELL) * PCELL + Math.sin(t * 2 + i) * 6;
      if (x < C2.x0 || x > C2.x1 || y < C2.y0 || y > C2.y1) continue;
      const fl = Math.sin(t * 11 + i * 3.3 + sd);
      const r = 1.2 + hash1(i * 8.1 + sd) * 1.8;
      circleP(glow, x, y, r * 3);
      circleP(fl > 0 ? core : core2, x, y, r);
    }
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

// Falling rocks. Random volleys ({t0, count, area, seed, dur, size, g, from, flight}) and/or exact
// TARGETED rocks (o.targets) that hit a given point at a given time — e.g. the rock that bonks
// Doreen's orange or bounces off Barry's helmet:
//   targets: [{x, y, impactT, r=11, from?: {x, y}, flight?, bounce?: {vx, vy, landY} | false, seed?}]
//   * no `from`: drops straight in from `drop` (default 260) units above the target in `flight`
//     (default 0.35) s — "from the top of frame" in a close-up; or pass from: {x, y: frameTop - 20}
//   * `from` (e.g. SPRING.craterPos): a ballistic arc from there, flight default 1.4 s
//   * bounce: after the hit the rock flies off with (vx, vy) and falls to landY (default y + 90),
//     splashing if that is water. Default bounce {vx: ±70, vy: -170}; bounce:false → it stops there.
// Every record: {i, x, y, r, rot, glow, active, landed, impactT, start, inWater, sink, vx, vy, landX,
// landY, scale, baseR, target, bounced, landT, phase: 'wait'|'fall'|'bounce'|'landed'}.
// impactT = first contact (sync 'bonk'); landT = final landing (sync 'splash'/'thud').
function rockAt(rec, t, g) {
  // shared post-launch kinematics for a rock with a launch (sx, sy, vx, vy0) at `start`
  const tau = t - rec.start;
  if (tau < 0) return;
  rec.active = true;
  if (tau < rec.fallT) {
    rec.phase = 'fall';
    rec.x = rec.sx + rec.vx * tau; rec.y = rec.sy + rec.vy0 * tau + 0.5 * g * tau * tau; rec.vy = rec.vy0 + g * tau;
    if (rec.grow) rec.scale = lerp(0.35, 1, Math.pow(tau / rec.fallT, 1.5));
    return;
  }
  rec.scale = 1;
  const af = tau - rec.fallT;
  if (rec.bounce) {
    const b = rec.bounce;
    if (af < rec.bT) {
      rec.phase = 'bounce'; rec.bounced = true;
      rec.x = rec.hitX + b.vx * af; rec.y = rec.hitY + b.vy * af + 0.5 * g * af * af; rec.vx = b.vx; rec.vy = b.vy + g * af;
      return;
    }
    const lf = af - rec.bT;
    rec.phase = 'landed'; rec.landed = true; rec.bounced = true;
    rec.x = rec.landX; rec.y = rec.landY; rec.sink = rec.inWater ? clamp(lf / 0.45) : 0;
    return;
  }
  rec.phase = 'landed'; rec.landed = true;
  const hop = !rec.inWater && rec.hopOnLand && af < 0.4 ? Math.sin((af / 0.4) * PI) * (1 - af / 0.4) * rec.baseR * 1.6 : 0;
  rec.x = rec.landX + (!rec.inWater && rec.hopOnLand ? rec.vx * 0.12 * Math.min(af, 0.4) : 0);
  rec.y = rec.landY - hop;
  rec.sink = rec.inWater ? clamp(af / 0.45) : 0;
}
function fallingRocks(t, o = {}) {
  const t0 = o.t0 ?? 0, count = o.targets && o.count == null ? 0 : (o.count ?? 8), seed = o.seed ?? 1, dur = o.dur ?? 2, g = o.g ?? 900;
  const size = o.size || [8, 18];
  const area = Object.assign({ x0: 160, x1: 1150, yTop: -80, yGround: [520, 700] }, o.area || {});
  const from = o.from || null; // launch point → ballistic arcs (e.g. SPRING.craterPos)
  const flight = o.flight || [1.3, 1.9];
  const r = rng(seed * 101 + 7);
  const out = [];
  for (let i = 0; i < count; i++) {
    const start = t0 + r() * dur;
    const x0 = lerp(area.x0, area.x1, r());
    const yG = Array.isArray(area.yGround) ? lerp(area.yGround[0], area.yGround[1], r()) : area.yGround;
    let vx = (r() - 0.5) * 140;
    const rad = lerp(size[0], size[1], r());
    const spin = (r() - 0.5) * 9;
    const yTop = area.yTop - r() * 80;
    let fallT, landX, sx = x0, sy = yTop, vy0 = 0;
    if (from) {
      fallT = lerp(flight[0], flight[1], r());
      sx = from.x + (r() - 0.5) * 30; sy = from.y;
      landX = x0;
      vx = (landX - sx) / fallT;
      vy0 = (yG - sy - 0.5 * g * fallT * fallT) / fallT;
    } else {
      fallT = Math.sqrt((2 * Math.max(1, yG - yTop)) / g);
      landX = x0 + vx * fallT;
    }
    const rec = {
      i, x: sx, y: sy, r: rad, rot: 0, glow: 0, active: false, landed: false, impactT: start + fallT, landT: start + fallT, start,
      inWater: inPool(landX, yG), sink: 0, vx, vy: 0, vy0, sx, sy, fallT, landX, landY: yG, scale: from ? 0.35 : 1, baseR: rad,
      grow: !!from, hopOnLand: true, bounce: null, bounced: false, target: false, phase: 'wait', spin,
    };
    rockAt(rec, t, g);
    out.push(finishRock(rec, t));
  }
  (o.targets || []).forEach((T, j) => {
    const rr = rng((T.seed ?? j + 1) * 37 + seed);
    const rad = T.r ?? 11;
    let fallT, sx, sy, vx, vy0;
    if (T.from) {
      fallT = T.flight ?? 1.4;
      sx = T.from.x; sy = T.from.y;
      vx = (T.x - sx) / fallT; vy0 = (T.y - sy - 0.5 * g * fallT * fallT) / fallT;
    } else {
      fallT = T.flight ?? 0.35;
      const drop = T.drop ?? 260;
      sx = T.x + (rr() - 0.5) * 20; sy = T.y - drop;
      vx = (T.x - sx) / fallT; vy0 = (drop - 0.5 * g * fallT * fallT) / fallT;
    }
    const start = T.impactT - fallT;
    let bounce = null, bT = 0, landX = T.x, landY = T.y;
    if (T.bounce !== false) {
      const b = Object.assign({ vx: (rr() < 0.5 ? -1 : 1) * 70, vy: -170 }, T.bounce || {});
      landY = b.landY ?? T.y + 90;
      // time to fall from the hit point to landY: y + vy t + g t²/2 = landY
      const A = 0.5 * g, B = b.vy, Cc = T.y - landY;
      bT = (-B + Math.sqrt(Math.max(0, B * B - 4 * A * Cc))) / (2 * A);
      landX = T.x + b.vx * bT;
      bounce = b;
    }
    const rec = {
      i: count + j, x: sx, y: sy, r: rad, rot: 0, glow: 0, active: false, landed: false, impactT: T.impactT, landT: T.impactT + bT, start,
      inWater: inPool(landX, landY), sink: 0, vx, vy: 0, vy0, sx, sy, fallT, landX, landY, scale: 1, baseR: rad, grow: false,
      hopOnLand: false, bounce, bT, hitX: T.x, hitY: T.y, bounced: false, target: true, phase: 'wait', spin: (rr() - 0.5) * 9, glowMax: T.glow ?? 0.5,
    };
    rockAt(rec, t, g);
    out.push(finishRock(rec, t));
  });
  return out;
}
function finishRock(rec, t) {
  const tau = t - rec.start;
  rec.rot = rec.spin * clamp(tau, 0, rec.fallT + (rec.bT || 0) + 0.4);
  rec.glow = (rec.glowMax ?? 1) * clamp(1 - Math.max(0, tau) / (rec.fallT + 1.6));
  rec.r = rec.baseR * rec.scale;
  return rec;
}
function drawFallingRocks(ctx, t, o = {}) {
  const rocks = fallingRocks(t, o);
  ctx.save();
  for (const k of rocks) {
    if (!k.active) continue;
    // contact effects: a puff of dust at the bonk (targets), splash or dust at the final landing
    if (k.target && k.bounced) {
      const e = (t - k.impactT) / 0.35;
      if (e < 1) {
        ctx.strokeStyle = `rgba(255,250,235,${0.9 * (1 - e)})`; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let d = 0; d < 6; d++) {
          const a = -PI / 2 + (d - 2.5) * 0.5, r0 = k.baseR * (1.2 + e * 1.4), r1 = r0 + k.baseR * 0.9 * (1 - e);
          ctx.moveTo(k.hitX + Math.cos(a) * r0, k.hitY + Math.sin(a) * r0 * 0.7); ctx.lineTo(k.hitX + Math.cos(a) * r1, k.hitY + Math.sin(a) * r1 * 0.7);
        }
        ctx.stroke();
      }
    }
    const af = t - k.landT;
    if (k.landed && af < 0.8 && o.splash !== false) {
      const e = af / 0.8;
      const lx = k.landX, ly = k.landY;
      if (k.inWater) {
        ctx.strokeStyle = `rgba(225,250,245,${0.85 * (1 - e)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ellipseP(ctx, lx, ly, k.baseR * (1.2 + e * 4), k.baseR * 0.3 * (1 + e * 4)); ctx.stroke();
        ctx.fillStyle = `rgba(230,252,248,${0.95 * (1 - e)})`;
        ctx.beginPath();
        for (let d = 0; d < 8; d++) {
          const ang = -PI / 2 + (d - 3.5) * 0.3;
          const v = k.baseR * (5 + hash1(d + k.i * 3) * 4);
          circleP(ctx, lx + Math.cos(ang) * v * e, ly + Math.sin(ang) * v * e * 1.3 + 9 * k.baseR * e * e, (1.5 + k.baseR * 0.15) * (1 - e * 0.5));
        }
        ctx.fill();
        if (e < 0.5) {
          ctx.fillStyle = `rgba(230,252,248,${0.8 * (1 - e * 2)})`;
          ctx.beginPath();
          ctx.moveTo(lx - k.baseR * 1.6, ly);
          ctx.quadraticCurveTo(lx - k.baseR * 1.2, ly - k.baseR * 3 * (0.5 + e), lx - k.baseR * 0.4, ly - k.baseR * 1.2);
          ctx.quadraticCurveTo(lx, ly - k.baseR * 4 * (0.5 + e), lx + k.baseR * 0.4, ly - k.baseR * 1.2);
          ctx.quadraticCurveTo(lx + k.baseR * 1.2, ly - k.baseR * 3 * (0.5 + e), lx + k.baseR * 1.6, ly);
          ctx.closePath(); ctx.fill();
        }
      } else {
        ctx.fillStyle = `rgba(150,130,110,${0.5 * (1 - e)})`;
        ctx.beginPath();
        for (let d = 0; d < 4; d++) circleP(ctx, lx + (d - 1.5) * k.baseR * (0.8 + e), ly - k.baseR * 0.4 - e * k.baseR * 1.5 * ((d % 2) + 0.5), k.baseR * (0.6 + e * 1.4));
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
// region under one swimmer's waterline: wavy top, half-ellipse bottom (k shrinks it for soft edges)
function swimRegion(ctx, s, t, k) {
  const hw = (s.w / 2) * k, x0 = s.x - hw, x1 = s.x + hw;
  ctx.beginPath();
  ctx.moveTo(x0, s.y + wave(x0, t));
  for (let xx = x0 + 6; xx < x1; xx += 6) ctx.lineTo(xx, s.y + wave(xx, t));
  ctx.lineTo(x1, s.y + wave(x1, t));
  ctx.ellipse(s.x, s.y + 2, hw, s.depth * (0.75 + 0.25 * k), 0, 0, PI);
  ctx.closePath();
}
// clip to the open water (pool + river, excluding the rim rocks) inside a box. In the pool this is
// a small polygon built from the free-water span table (cheap); near the river mouth it falls back
// to the full water path.
function clipWater(ctx, x0, y0, x1, y1) {
  ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
  if (x0 < 240 || y0 < 478) { ctx.clip(FREE_WATER_PATH); return; }
  const L = [], R = [];
  for (let y = y0; ; y += 4) {
    const yy = Math.min(y, y1), sp = freeSpan(yy);
    if (sp) { L.push([Math.max(x0 - 2, sp[0]), yy]); R.push([Math.min(x1 + 2, sp[1]), yy]); }
    if (yy >= y1) break;
  }
  ctx.beginPath();
  if (!L.length) { ctx.rect(0, 0, 0, 0); ctx.clip(); return; }
  ctx.moveTo(L[0][0], L[0][1]); for (const q of R) ctx.lineTo(q[0], q[1]);
  for (let i = L.length - 1; i >= 0; i--) ctx.lineTo(L[i][0], L[i][1]);
  ctx.closePath(); ctx.clip();
}
// is the box [x0..x1] x [y0..y1] entirely open water? (then no clip is needed)
function boxInWater(x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y += Math.max(4, (y1 - y0) / 6)) {
    if (!freeWater(x0, y, 0) || !freeWater(x1, y, 0)) return false;
  }
  return freeWater(x0, y1, 0) && freeWater(x1, y1, 0) && freeWater((x0 + x1) / 2, y0, 0);
}
function drawWaterFront(ctx, t, o = {}) {
  const setting = normSetting(o.setting);
  const op = opts(o, setting);
  const P = palette(setting, op.dusk, op.erupt, op.skyTint, op.lava);
  const sw = (o.swimmers || defaultSwimmers()).map((s) => {
    const sc = s.scale ?? depthScale(s.y);
    return { x: s.x, y: s.y, w: s.w ?? 280 * sc, depth: s.depth ?? 110 * sc, sc, ripple: s.ripple !== false };
  }).sort((a, b) => a.y - b.y);
  if (!sw.length) return;
  const opacity = clamp(o.opacity ?? 0.72, 0, 0.98);
  const LV = [1, 0.78];
  const V = viewRect(ctx);
  const a1 = 1 - Math.pow(1 - opacity, 1 / LV.length);
  const heatK = op.waterHeat > 0.3 ? (op.waterHeat - 0.3) * 0.22 : 0;
  for (const s of sw) {
    const bx0 = s.x - s.w * 0.75, by0 = s.y - 30 * s.sc, bx1 = s.x + s.w * 0.75, by1 = s.y + s.depth + 10;
    if (!vis(V, bx0, by0, bx1, by1)) continue;
    ctx.save();
    if (o.clip !== false && !boxInWater(bx0, s.y - 6, bx1, by1)) clipWater(ctx, bx0 - 2, by0 - 2, bx1 + 2, by1 + 2);
    // translucent water body in nested, progressively narrower layers → soft sides
    const yA = s.y - 4, yB = s.y + s.depth + 4;
    const g = ctx.createLinearGradient(0, yA, 0, yB);
    for (let q = 0; q <= 4; q++) {
      const yy = lerp(yA, yB, q / 4);
      let c = P.waterBand(yy);
      if (heatK) c = mix(c, '#F4FFFC', heatK);
      g.addColorStop(q / 4, c);
    }
    ctx.fillStyle = g;
    ctx.globalAlpha = a1;
    for (let li = 0; li < LV.length; li++) { swimRegion(ctx, s, t, LV[li]); ctx.fill(); }
    ctx.globalAlpha = 1;
    // contact shade hugging the waterline + refraction bands
    ctx.fillStyle = rgba(P.w3, 0.2);
    ctx.beginPath(); ellipseP(ctx, s.x, s.y + 3 * s.sc, s.w * 0.38, 7 * s.sc); ctx.fill();
    ctx.fillStyle = rgba(P.w3, 0.13);
    ctx.beginPath(); ellipseP(ctx, s.x, s.y + 7 * s.sc, s.w * 0.3, 15 * s.sc); ctx.fill();
    ctx.strokeStyle = rgba(P.wHi, 0.2);
    ctx.lineWidth = 2 * s.sc;
    ctx.beginPath();
    for (let bnd = 0; bnd < 2; bnd++) {
      const yy = s.y + (22 + bnd * 26) * s.sc, hw = s.w * (0.36 - bnd * 0.08);
      ctx.moveTo(s.x - hw, yy);
      for (let xx = s.x - hw; xx <= s.x + hw; xx += 10) ctx.lineTo(xx, yy + Math.sin(xx * 0.06 + t * 2 + bnd * 2) * 3 * s.sc);
    }
    ctx.stroke();
    // bright waterline lens + ripple rings in front
    const hw = s.w * 0.42;
    ctx.fillStyle = rgba(P.wHi, 0.88);
    ctx.beginPath();
    ctx.moveTo(s.x - hw, s.y + wave(s.x - hw, t));
    for (let xx = s.x - hw; xx <= s.x + hw; xx += 6) ctx.lineTo(xx, s.y + wave(xx, t) - 1.7 * (1 - ((xx - s.x) / hw) ** 2) * s.sc);
    for (let xx = s.x + hw; xx >= s.x - hw; xx -= 6) ctx.lineTo(xx, s.y + wave(xx, t) + 1.4 * (1 - ((xx - s.x) / hw) ** 2) * s.sc);
    ctx.closePath();
    ctx.fill();
    if (s.ripple) waterlineRipple(ctx, s.x, s.y + 1, s.w * 0.78, t + s.x * 0.01, { amp: 1, part: 'front', color: P.wHi, clip: false });
    ctx.restore();
  }
}
// Convenience: draw swimmers back-to-front, each followed by its own front water, so a nearer
// swimmer's head is never covered by the water of one further back.
// list: [{x, y, scale?, w?, depth?, draw(ctx)}]  (y = waterline). o: same as drawWaterFront.
function drawSwimmers(ctx, t, list, o = {}) {
  const sorted = list.slice().sort((a, b) => a.y - b.y);
  const P = palette(normSetting(o.setting), o.dusk || 0, o.erupt || 0);
  for (const s of sorted) {
    if (s.ripple !== false) waterlineRipple(ctx, s.x, s.y + 1, (s.w ?? 280 * (s.scale ?? depthScale(s.y))) * 0.78, t + s.x * 0.01, { part: 'back', color: P.wHi });
    if (s.draw) { ctx.save(); s.draw(ctx); ctx.restore(); }
    drawWaterFront(ctx, t, Object.assign({}, o, { swimmers: [s] }));
  }
}
// ripple rings spreading from a body of width w floating at waterline y. Clipped to open water
// (pool / river, not the rocks) unless o.clip === false.
function waterlineRipple(ctx, x, y, w, t, o = {}) {
  const amp = o.amp ?? 1, part = o.part || 'front', color = o.color || '#E2FBF6', speed = o.speed ?? 1;
  const sc = clamp(w / 220, 0.4, 1.6);
  const R = w * 0.5 + 4 + w * 0.42 * (0.6 + 0.4 * amp);
  ctx.save();
  if (o.clip !== false && !boxInWater(x - R, y - R * 0.18, x + R, y + R * 0.18)) clipWater(ctx, x - R - 4, y - R * 0.2 - 4, x + R + 4, y + R * 0.2 + 4);
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
  const onset = Math.exp(-Math.pow((erupt - 0.215) / 0.016, 2));
  let flick = 0;
  if (erupt > 0.22 && erupt < 0.68) {
    const slot = Math.floor(t * 2.6), ph = t * 2.6 - slot;
    if (hash1(slot * 3.17 + 0.5) > 0.62) flick = Math.exp(-ph * 9) * 0.2 * (1 - smoothstep(0.55, 0.68, erupt));
  }
  return clamp(onset * 0.7 + flick);
}
function drawSpringOverlay(ctx, t, o = {}) {
  const setting = normSetting(o.setting);
  const op = opts(o, setting);
  const P = palette(setting, op.dusk, op.erupt, op.skyTint, op.lava);
  ctx.save();
  // front steam veil: low and faint, so it never washes over the swimmers' faces
  if (op.waterHeat > 0.45) drawSteam(ctx, t, { x: 680, y: 830, w: 1300, amount: (op.waterHeat - 0.45) * 1.1, h: 150, scale: 1.6, color: P.steam, seed: 77, maxWisps: 9 });
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
  const fl = o.flash != null ? clamp(o.flash) : eruptFlash(t, op.erupt);
  if (fl > 0.01) {
    ctx.fillStyle = `rgba(255,214,170,${0.75 * fl})`;
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
// world-space rectangle currently visible on the canvas (for culling off-screen elements)
function viewRect(ctx) {
  const m = ctx.getTransform();
  const det = m.a * m.d - m.b * m.c;
  if (!det) return { x0: -1e9, y0: -1e9, x1: 1e9, y1: 1e9 };
  const cw = (ctx.canvas && ctx.canvas.width) || 1920, chh = (ctx.canvas && ctx.canvas.height) || 1080;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [px, py] of [[0, 0], [cw, 0], [0, chh], [cw, chh]]) {
    const dx = px - m.e, dy = py - m.f;
    const wx = (m.d * dx - m.c * dy) / det, wy = (-m.b * dx + m.a * dy) / det;
    x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); y0 = Math.min(y0, wy); y1 = Math.max(y1, wy);
  }
  return { x0: x0 - 8, y0: y0 - 8, x1: x1 + 8, y1: y1 + 8 };
}
const vis = (V, x0, y0, x1, y1) => x1 >= V.x0 && x0 <= V.x1 && y1 >= V.y0 && y0 <= V.y1;
// ---- the cached static layers of Snooze Springs -------------------------------------------------
// (only blitted down to the jungle's opaque valley line, column by column)
const UPPER_RECTS = (() => {
  const out = [], seg = 128;
  for (let x = WX0 - 64; x < WX1 + 64; x += seg) {
    let bot = 0;
    for (const q of JUNGLE.A.bumps) if (q[6] >= x && q[0] <= x + seg) bot = Math.max(bot, q[1], q[7]);
    out.push([x, WY0, x + seg, Math.min(474, (bot || 470) + 3)]);
  }
  return out;
})();
const L_UPPER = {
  id: 'sp-up',
  rects: UPPER_RECTS,
  draw(g, P) { drawSkyStatic(g, P); drawFarHills(g, P); drawVolcanoStatic(g, P); },
};
// rigid sprites (cached, drawn with a sway rotation / offset): bananas, front ferns and leaves
const BANANAS = [
  { x: 86, y: 486, s: 0.9, seed: 5, flip: 1 }, { x: -760, y: 566, s: 0.85, seed: 15, flip: -1 }, { x: 1262, y: 458, s: 1.05, seed: 9, flip: -1 },
  { x: -360, y: 548, s: 0.8, seed: 19, flip: 1 }, { x: -1340, y: 576, s: 0.95, seed: 23, flip: -1 }, { x: 1600, y: 470, s: 0.95, seed: 29, flip: 1 },
].map((b) => Object.assign(b, { paths: bakeBanana(b.x, b.y, b.s, b.seed, b.flip), rect: [b.x - 130 * b.s, b.y - 186 * b.s, b.x + 130 * b.s, b.y + 4] }));
function drawBananaLive(ctx, t, P, b, rumble, V) {
  if (V && !vis(V, b.rect[0], b.rect[1], b.rect[2], b.rect[3])) return;
  const a = sway(t, b.seed, 0.028, 0.9, rumble);
  ctx.save();
  ctx.translate(b.x, b.y); ctx.rotate(a); ctx.translate(-b.x, -b.y);
  drawBananaPaths(ctx, P, b.paths, 0.04);
  ctx.restore();
}
// near layer while erupting: the jungle wall (in front of the lava rivers) + everything near
const L_LOWER = {
  id: 'sp-lo',
  rects: [[WX0, 384, WX1, WY1], [WX0, 196, WX1, 384], [-70, WY0, 310, 196], [-920, WY0, -600, 196], [1236, WY0, 1480, 196]],
  draw(g, P, v) { drawJungleStatic(g, P); drawRays(g, P); drawNear(g, P, v); },
};
// calm Mount Snooze (no eruption, grove still): EVERYTHING static in one layer
const L_ALL = {
  id: 'sp-all',
  rects: [[WX0, WY0, WX1, WY1]],
  draw(g, P, v) {
    drawSkyStatic(g, P); drawFarHills(g, P); drawVolcanoStatic(g, P); drawGrove(g, null, P, { groveTaken: parseInt(v.slice(1), 10) || 0 });
    drawJungleStatic(g, P); drawRays(g, P); drawNear(g, P, v);
  },
};
function drawNear(g, P, v) {
  {
    drawGround(g, P);
    drawBushBand(g, P);
    drawFernSet(g, null, P, BACK_FERNS, 0.06, {}, 3);
    drawHeartSet(g, null, P, BACK_HEARTS, 0.05, {}, 4);
    drawTrunks(g, P);
    drawBankDetails(g, P);
    drawWaterStatic(g, P, P.setting);
    const lod = devScale(g), V = viewRect(g);
    drawRocks(g, P, RIVER_ROCKS, null, lod, V);
    drawRocks(g, P, RIM_ROCKS, null, lod, V);
    drawRocks(g, P, BANK_ROCKS, null, lod, V);
    if (v.includes('M')) drawMoorPost(g, P, SPRING.moorPost.x, SPRING.moorPost.y);
  }
}
// the wooden sign (in front of the swaying palm and banana leaves → its own cached sprite layer)
const L_SIGN = {
  id: 'sp-sign',
  rects: [[1028, 300, 1266, 456]],
  draw(g, P) { drawSnoozeSignImpl(g, 0, P, { x: SPRING.signPos.x, y: SPRING.signPos.y }); },
};
function drawSpring(ctx, t, o, setting) {
  const op = opts(o, setting);
  const P = palette(setting, op.dusk, op.erupt, op.skyTint, op.lava);
  const corners = lightCorners(setting, op.dusk, op.erupt, op.skyTint);
  const V = viewRect(ctx);
  const E = op.erupt, heat = op.waterHeat;
  ctx.save();
  // --- far: sky, hills, Mount Snooze, jungle wall (cached) + everything that lives on the volcano
  const [jx, jy] = op.rumble > 0 ? [noise1(t * 23 + 1) * op.rumble * 1.4, noise1(t * 19 + 3) * op.rumble * 0.9] : [0, 0];
  ctx.translate(jx, jy);
  const calm = E <= 0.19 && groveShake(op) <= 0;
  drawLayer(ctx, calm ? L_ALL : L_UPPER, corners, calm ? 'g' + op.groveTaken + (op.moorPost ? 'M' : '') : '');
  if (V.y0 < 120) drawClouds(ctx, t, P, false, CLOUDS, V);
  if (setting === 'day' && op.birds && E < 0.05 && V.y0 < 260) drawBirds(ctx, t, P);
  if (vis(V, 380, -440, 1340, 470)) {
    drawCraterHeat(ctx, t, P, op);
    if (!calm) {
      if (E > 0.55) drawLavaRivers(ctx, t, P, op, false);
      drawGrove(ctx, t, P, op);
    }
    drawCraterSmoke(ctx, t, P, op);
    if (op.puffs) for (const pf of op.puffs) drawVolcanoPuff(ctx, t, pf);
    if (E > 0.17) drawPlume(ctx, t, P, op);
    if (E > 0.19) drawFountains(ctx, t, P, op);
  }
  ctx.translate(-jx, -jy);
  // --- near: jungle wall, ground, trunks, undergrowth, water body, rocks (cached)
  const burning = op.signBurn > 0;
  if (!calm) drawLayer(ctx, L_LOWER, corners, op.moorPost ? 'M' : '');
  if (E > 0.6 || op.lava > 0) drawLavaGlow(ctx, t, P, op);
  // --- live vegetation
  if (V.x1 > 1130 && V.y0 < 200) drawCanopy(ctx, t, P, CANOPY_R, 1, op);
  if (vis(V, 1050, 0, 1500, 490)) drawPalm(ctx, t, P, PALMS[1], op.rumble);
  if (V.x0 < 420 && V.y0 < 220) drawCanopy(ctx, t, P, CANOPY_L, 0, op);
  if (V.y0 < 400) drawVines(ctx, t, P, VINES, op.rumble, V);
  drawBananaLive(ctx, t, P, BANANAS[0], op.rumble, V);
  drawBananaLive(ctx, t, P, BANANAS[1], op.rumble, V);
  if (vis(V, 300, 60, 640, 470)) drawPalm(ctx, t, P, PALMS[0], op.rumble);
  for (let i = 2; i < PALMS.length; i++) { const p = PALMS[i]; if (vis(V, Math.min(p.x, p.tx) - p.len * 1.2, p.ty - p.len, Math.max(p.x, p.tx) + p.len * 1.2, p.y)) drawPalm(ctx, t, P, p, op.rumble); }
  for (let i = 2; i < BANANAS.length; i++) drawBananaLive(ctx, t, P, BANANAS[i], op.rumble, V);
  if (op.sign && vis(V, 1030, 200, 1270, 460)) {
    drawLayer(ctx, L_SIGN, corners);
    if (burning) drawSnoozeSignImpl(ctx, t, P, { x: SPRING.signPos.x, y: SPRING.signPos.y, burn: op.signBurn, overlayOnly: true });
  }
  // --- water surface life, Barry's rock, lava, steam
  if (V.y1 > 450) {
    drawWaterLive(ctx, t, P, op, V);
  }
  if (op.barryRock && vis(V, 750, 520, 850, 590)) drawBarryRockImpl(ctx, t, P);
  if (op.lava > 0) drawLavaToPool(ctx, t, P, op);
  const bil = heat < 0.8;   // above that the boil's own billows take over
  const mw = heat > 0.6 ? 7 : 10;
  if (vis(V, 230, 300, 1130, 490)) drawSteam(ctx, t, { x: 680, y: 480, w: 900, amount: 0.3 + heat * 0.9, h: 120, scale: 0.75, color: P.steam, seed: 3, billows: bil, maxWisps: mw });
  if (vis(V, 180, 360, 1180, 570)) drawSteam(ctx, t, { x: 680, y: 566, w: 1000, amount: 0.2 + heat * 0.9, h: 150, scale: 1.0, color: P.steam, seed: 5, billows: bil, maxWisps: mw });
  if (heat > 0.3 && vis(V, 180, 400, 1180, 670)) drawSteam(ctx, t, { x: 680, y: 666, w: 1000, amount: (heat - 0.3) * 1.2, h: 170, scale: 1.3, color: P.steam, seed: 7, billows: bil, maxWisps: heat > 0.6 ? 5 : 8 });
  if (V.y1 > 560) drawFrontBanks(ctx, t, P, op, V);
  if (setting === 'evening') drawFireflies(ctx, t, smoothstep(0.25, 0.8, op.dusk) * (1 - P.E));
  ctx.restore();
}
function drawBankDetails(ctx, P) {
  ctx.fillStyle = P.g(C.groundDark); ctx.fill(TUFTS.dark);
  ctx.fillStyle = P.hl(C.jPale, 0, 0.6); ctx.fill(TUFTS.light);
  for (const [c, path] of FLOWERS.byCol) { ctx.fillStyle = P.g(c); ctx.fill(path); }
  ctx.fillStyle = P.g('#FFB02E'); ctx.fill(FLOWERS.centres);
}
// front-corner ferns and big leaves (the front rocks are part of the cached lower layer)
function drawFrontBanks(ctx, t, P, o, V) {
  if (V && !(V.x0 < 300 || V.x1 > 1150)) return;
  drawFernSet(ctx, t, P, FRONT_FERNS, 0, o, 11); drawHeartSet(ctx, t, P, FRONT_HEARTS, 0, o, 12);
}
function drawSpringDay(ctx, t, o) { drawSpring(ctx, t, o, 'day'); }
function drawSpringEvening(ctx, t, o) { drawSpring(ctx, t, o, 'evening'); }
function drawEruption(ctx, t, o = {}) {
  const setting = normSetting(o.setting);
  const op = opts(o, setting);
  const P = palette(setting, op.dusk, op.erupt, op.skyTint, op.lava);
  ctx.save();
  drawCraterHeat(ctx, t, P, op);
  drawLavaRivers(ctx, t, P, op);
  drawCraterSmoke(ctx, t, P, op);
  drawPlume(ctx, t, P, op);
  ctx.save(); ctx.clip(JUNGLE.A.above); drawFountains(ctx, t, P, op); ctx.restore();
  ctx.restore();
}
function drawMountSnooze(ctx, t, o = {}) {
  const setting = normSetting(o.setting);
  const op = opts(o, setting);
  const P = palette(setting, op.dusk, op.erupt, op.skyTint, op.lava);
  const s = o.scale ?? 1;
  ctx.save();
  ctx.translate(o.x ?? 860, o.y ?? 150);
  ctx.scale(s, s);
  ctx.translate(-860, -150);
  drawVolcanoStatic(ctx, P);
  drawCraterHeat(ctx, t, P, op);
  drawLavaRivers(ctx, t, P, op);
  drawGrove(ctx, t, P, op);
  drawCraterSmoke(ctx, t, P, op);
  if (op.puffs) for (const pf of op.puffs) drawVolcanoPuff(ctx, t, pf);
  drawPlume(ctx, t, P, op);
  drawFountains(ctx, t, P, op);
  ctx.restore();
}
function drawBarryRock(ctx, t, o = {}) {
  const setting = normSetting(o.setting);
  const op = opts(o, setting);
  drawBarryRockImpl(ctx, t, palette(setting, op.dusk, op.erupt, op.skyTint), setting === 'new' ? ROCK_STYLE_NEW : null);
}
function drawSnoozeSign(ctx, t, o = {}) {
  const P = palette(normSetting(o.setting), o.dusk || 0, o.erupt || 0);
  drawSnoozeSignImpl(ctx, t, P, { x: o.x ?? SPRING.signPos.x, y: o.y ?? SPRING.signPos.y, scale: o.scale, burn: o.burn ?? o.signBurn ?? 0, lines: o.lines, check: o.check });
}

// =====================================================================================
// new spring (epilogue): a different, sunnier hot spring in rolling meadow country
// =====================================================================================
// Same pool coordinates as Snooze Springs (the trio's swim spots carry over), completely re-dressed:
// willow on the left, bamboo grove behind the sign, flat river stones with grassy gaps and a sandy
// lip, lily pads, stepping stones + cattails front-left, a little wooden deck front-right, a bamboo
// spout trickling into the pool, and ONE innocent little hill where the volcano used to be.
const NEW_HILL_PTS = [
  ridgePts(41, 296, 34, 0.0026, 50, (x) => -30 * bump(x, 300, 320) + 26 * bump(x, 880, 260) - 18 * bump(x, 1450, 260)),
  ridgePts(43, 356, 22, 0.0042, 40, (x) => 30 * bump(x, 880, 200) - 20 * bump(x, 420, 220)),
  ridgePts(47, 402, 12, 0.006, 32, (x) => -6 * bump(x, 600, 200)),
];
const NEW_HILLS = [
  { path: ridgePath(NEW_HILL_PTS[0], 0, 520), col: '#8DCBA4', far: 0.42 },
  { path: ridgePath(NEW_HILL_PTS[1], 0, 520), col: '#6CC06A', far: 0.14 },
  { path: ridgePath(NEW_HILL_PTS[2], 0, 520), col: '#56AE4E', far: 0.03 },
];
function ridgeYAt(pts, x) {
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]));
  return pts[pts.length - 1][1];
}
// the innocent little hill (in front of the mid hills; its foot hidden by the near hill line)
const TINY_HILL = (() => {
  const x = 880, y = 318;
  const out = [[x - 170, 420], [x - 132, 392], [x - 96, 360], [x - 60, 334], [x - 26, y + 1], [x, y], [x + 26, y + 1], [x + 62, 336], [x + 100, 364], [x + 138, 394], [x + 176, 422]];
  const body = newPath((p) => { p.moveTo(out[0][0], out[0][1]); splineTo(p, out); p.closePath(); });
  const rim = newPath((p) => { const L = out.slice(0, 6); p.moveTo(L[0][0], L[0][1]); splineTo(p, L); for (let i = L.length - 1; i >= 0; i--) p.lineTo(L[i][0] + 3, L[i][1] + 5); p.closePath(); });
  const shade = newPath((p) => { const Rr = out.slice(5); p.moveTo(x + 4, y); splineTo(p, Rr); p.lineTo(x + 50, 422); p.bezierCurveTo(x + 50, 390, x + 34, 350, x + 4, y); p.closePath(); });
  const tufts = new Path2D();
  [[x - 100, 372], [x - 40, 342], [x + 30, 348], [x + 90, 380], [x - 130, 398], [x + 120, 398]].forEach(([tx, ty], i) => grassTuft(tufts, tx, ty, 7, 900 + i));
  return { body, rim, shade, tufts, x, y };
})();
const NEW_TREES = (() => {
  const r = rng(808);
  const layers = [1, 2].map(() => ({ trunk: new Path2D(), dark: new Path2D(), lit: new Path2D(), cyp: new Path2D(), cypLit: new Path2D() }));
  for (let i = 0; i < 110; i++) {
    const li = r.int(0, 1), layer = li + 1;
    const x = r.range(WX0, WX1);
    if (x > 700 && x < 1060) continue; // keep the little hill clear
    const y = ridgeYAt(NEW_HILL_PTS[layer], x) + r.range(6, 22);
    const rr = r.range(7, 12) * (layer === 2 ? 1.3 : 1);
    const L = layers[li];
    if (r() < 0.25) {
      // slim cypress
      L.cyp.moveTo(x, y - rr * 3.2); L.cyp.quadraticCurveTo(x + rr * 0.75, y - rr * 1.2, x, y + 2); L.cyp.quadraticCurveTo(x - rr * 0.75, y - rr * 1.2, x, y - rr * 3.2); L.cyp.closePath();
      L.cypLit.moveTo(x, y - rr * 3.1); L.cypLit.quadraticCurveTo(x - rr * 0.62, y - rr * 1.3, x - 0.5, y - rr * 0.2); L.cypLit.quadraticCurveTo(x - rr * 0.2, y - rr * 1.5, x, y - rr * 3.1); L.cypLit.closePath();
      continue;
    }
    L.trunk.rect(x - 1.5, y - 2, 3, rr * 0.9);
    circleP(L.dark, x, y - rr * 0.4, rr);
    circleP(L.lit, x - rr * 0.22, y - rr * 0.66, rr * 0.62);
  }
  return layers;
})();
const HILL_FLOWERS = (() => {
  const r = rng(909), cols = ['#FFE27A', '#FFB3CF', '#FFFFFF', '#D9B8FF'], byCol = new Map();
  for (let p = 0; p < 14; p++) {
    const cx = r.range(WX0 + 100, 1600), layer = r.int(1, 2), c = cols[r.int(0, 3)];
    if (cx > 700 && cx < 1060) continue;
    if (!byCol.has(c)) byCol.set(c, new Path2D());
    for (let i = 0; i < 26; i++) {
      const x = cx + r.range(-60, 60), y = ridgeYAt(NEW_HILL_PTS[layer], x) + r.range(8, 40);
      circleP(byCol.get(c), x, y, layer === 2 ? 2.2 : 1.6);
    }
  }
  return byCol;
})();
const FIELD_STRIPES = newPath((p) => { for (let k = 0; k < 20; k++) { const x0 = -1300 + k * 150; p.moveTo(x0, 470); p.quadraticCurveTo(x0 + 40, 410, x0 + 120, 350); } });
const NEW_CLOUDS = makeClouds(313, [-1100, -420, 300, 1450], [[-640, -40], [180, -150], [640, 10], [1150, -90], [1720, 30], [-1250, -120]]);
const RAINBOW = (() => {
  const cols = ['#FF7A7A', '#FFB86A', '#FFE680', '#9EE38A', '#7FC8FF', '#B79CFF'];
  return cols.map((c, i) => {
    const r1 = 430 - i * 11, r0 = r1 - 11.5;
    const p = new Path2D();
    p.moveTo(890 - r1, 470); p.arc(890, 470, r1, PI, TAU); p.lineTo(890 + r0, 470); p.arc(890, 470, r0, TAU, PI, true); p.closePath();
    return { c, p };
  });
})();
// flowering bushes along the back bank (hydrangea-ish: leafy mound + blossom clusters)
const NEW_SHRUBS = (() => {
  const r = rng(31), dark = new Path2D(), base = new Path2D(), lit = new Path2D(), bloom = new Map(), bloomHi = new Path2D();
  const cols = ['#B8A4FF', '#FFB0CC', '#9CC8FF', '#FFFFFF'];
  for (let x = WX0; x < WX1; x += r.range(54, 86)) {
    if (x > 1066 && x < 1240) continue;   // the sign
    if (x > 930 && x < 1050) continue;    // the rules sign
    const y = 436 + r.range(-4, 4), rr = r.range(18, 28);
    for (const [dx, dy, k] of [[0, 0, 1], [-0.75, 0.25, 0.7], [0.75, 0.25, 0.68]]) {
      circleP(dark, x + dx * rr, y + dy * rr, rr * k);
      circleP(base, x + dx * rr - rr * 0.07, y + dy * rr - rr * 0.11, rr * k * 0.86);
    }
    circleP(lit, x - rr * 0.32, y - rr * 0.38, rr * 0.36);
    if (r() < 0.6) {
      const c = cols[r.int(0, 3)];
      if (!bloom.has(c)) bloom.set(c, new Path2D());
      for (let k = 0; k < 3; k++) {
        const bx = x + r.range(-0.7, 0.7) * rr, by = y - rr * r.range(0.2, 0.8), br = rr * r.range(0.22, 0.32);
        circleP(bloom.get(c), bx, by, br);
        circleP(bloomHi, bx - br * 0.3, by - br * 0.35, br * 0.4);
      }
    }
  }
  return { dark, base, lit, bloom, bloomHi };
})();
const NEW_FLOWERS = bakeFlowers(4242, 300, [C.fPink, C.fYellow, C.fWhite, C.fPurple, C.fRed, C.fOrange], [WX0, WX1, 444, 1100]);
// flat river stones around the rim, with gaps of grass between them (not the volcanic necklace)
const NEW_RIM_LIST = (() => {
  const r = rng(6262), out = [];
  const d = POOL_DENSE, n = d.length;
  let acc = 0, next = 30;
  for (let i = 0; i < n; i++) {
    const p = d[i], q = d[(i + 1) % n];
    acc += Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (acc < next) continue;
    const [x, y] = p;
    if (x < 200 && y > 520 && y < 670) { next = acc + 4; continue; } // the river mouth
    if (x > 1150 && y > 520 && y < 600) { next = acc + 4; continue; } // the bamboo spout
    const k = clamp((y - 455) / 350);
    const rx = lerp(16, 50, Math.pow(k, 0.85)) * r.range(0.8, 1.25);
    const ry = rx * lerp(0.4, 0.5, k) * r.range(0.9, 1.1);
    let nx = q[1] - d[(i - 1 + n) % n][1], ny = -(q[0] - d[(i - 1 + n) % n][0]);
    const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    if (pointInPoly(d, x + nx * 6, y + ny * 6)) { nx = -nx; ny = -ny; }
    out.push(makeRock(x + nx * rx * 0.25, y + ny * ry * 0.4 + ry * 0.15, rx, ry, 8000 + i, r() < 0.25));
    next = acc + rx * r.range(1.6, 3.0);   // gaps between the stones
  }
  out.push(makeRock(176, 540, 34, 15, 8801, true));
  out.push(makeRock(186, 664, 42, 18, 8802, false));
  return out.sort((a, b) => a.y - b.y);
})();
const NEW_RIM = bakeRocks(NEW_RIM_LIST, 2, true);
const RIM_FLOWERS = (() => {
  const r = rng(5151), byCol = new Map(), centres = new Path2D();
  const cols = [C.fPink, C.fYellow, C.fWhite, C.fPurple];
  for (let i = 0; i < NEW_RIM_LIST.length; i++) {
    const rk = NEW_RIM_LIST[i];
    if (rk.y > 760 || r() < 0.4) continue;
    const c = cols[r.int(0, 3)], x = rk.x + rk.rx * (r() < 0.5 ? 1.05 : -1.05), y = rk.y - rk.ry * 0.2, s = 2.4 + rk.rx * 0.06;
    if (inPool(x, y + 2)) continue;
    if (!byCol.has(c)) byCol.set(c, new Path2D());
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; ellipseP(byCol.get(c), x + Math.cos(a) * s * 0.9, y + Math.sin(a) * s * 0.7, s * 0.62, s * 0.5); }
    circleP(centres, x, y, s * 0.45);
  }
  return { byCol, centres };
})();
// big flat stepping stones front-left, leading into the water
const STEPPING = bakeRocks([makeRock(232, 742, 50, 17, 8901, false), makeRock(150, 770, 46, 16, 8902, true), makeRock(296, 790, 54, 18, 8903, false), makeRock(66, 742, 40, 14, 8904, true)], 1, true);
const LILY_PADS = (() => {
  const pads = new Path2D(), padsLit = new Path2D(), veins = new Path2D(), lotus = new Path2D(), lotusHi = new Path2D();
  [[262, 600, 15], [292, 622, 11], [236, 640, 13], [1110, 610, 14], [1136, 640, 12], [1080, 660, 10], [520, 500, 9], [470, 512, 7], [1040, 512, 8], [700, 760, 18], [742, 786, 13]]
    .forEach(([x, y, s], i) => {
      const a = hash1(i * 3.3) * TAU, notch = 0.35;
      const ry = s * 0.4;
      pads.moveTo(x, y);
      pads.ellipse(x, y, s, ry, 0, a + notch, a + TAU - notch);
      pads.closePath();
      padsLit.moveTo(x, y);
      padsLit.ellipse(x - s * 0.1, y - ry * 0.12, s * 0.8, ry * 0.7, 0, a + notch + 0.2, a + TAU - notch - 0.2);
      padsLit.closePath();
      veins.moveTo(x - s * 0.6, y); veins.lineTo(x + s * 0.6, y);
      if (i % 3 === 0) {
        for (let k = 0; k < 5; k++) { const pa = -PI / 2 + (k - 2) * 0.42; ellipseP(lotus, x + Math.cos(pa) * s * 0.28, y - ry * 0.6 + Math.sin(pa) * s * 0.24, s * 0.16, s * 0.32); }
        circleP(lotusHi, x, y - ry * 0.7, s * 0.1);
      }
    });
  return { pads, padsLit, veins, lotus, lotusHi };
})();
const CATTAILS = (() => {
  const stems = new Path2D(), heads = new Path2D(), blades = new Path2D(), bladesLit = new Path2D();
  const r = rng(77);
  for (let i = 0; i < 9; i++) {
    const x = -70 + i * 14 + r.range(-5, 5), y = 716 + r.range(-6, 8), h = r.range(120, 190), lean = r.range(-14, 16);
    stems.moveTo(x - 1.4, y); stems.quadraticCurveTo(x + lean * 0.3, y - h * 0.5, x + lean, y - h); stems.lineTo(x + lean + 2.4, y - h); stems.quadraticCurveTo(x + lean * 0.3 + 2.4, y - h * 0.5, x + 1.4, y); stems.closePath();
    if (i % 2 === 0) ellipseP(heads, x + lean * 0.92, y - h * 0.84, 4.2, 15);
    const bl = (p, side, len, w) => { p.moveTo(x, y); p.quadraticCurveTo(x + side * len * 0.3, y - len * 0.6, x + side * len * 0.55, y - len); p.quadraticCurveTo(x + side * len * 0.2 + w, y - len * 0.55, x + w, y); p.closePath(); };
    bl(blades, i % 2 ? 1 : -1, r.range(80, 130), 5);
    bl(bladesLit, i % 2 ? -1 : 1, r.range(60, 100), 4);
  }
  return { stems, heads, blades, bladesLit };
})();
// the little wooden deck in the front-right corner
const DECK = (() => {
  const top = new Path2D(), gaps = new Path2D(), front = new Path2D(), posts = new Path2D(), towel = new Path2D(), stripes = new Path2D();
  // trapezoid in perspective: back edge y 692 (x 1128..1700), front edge y 840 (x 1052..1700)
  const back = 692, fr = 840, xl = (y) => lerp(1128, 1052, (y - back) / (fr - back));
  top.moveTo(xl(back), back); top.lineTo(1700, back); top.lineTo(1700, fr); top.lineTo(xl(fr), fr); top.closePath();
  for (let k = 1; k < 7; k++) { const y = lerp(back, fr, Math.pow(k / 7, 1.15)); gaps.moveTo(xl(y) + 2, y); gaps.lineTo(1700, y); }
  front.moveTo(xl(back), back); front.lineTo(xl(fr), fr); front.lineTo(xl(fr) - 2, fr + 16); front.lineTo(xl(back) - 2, back + 12); front.closePath();
  for (const y of [back + 10, (back + fr) / 2 + 6]) posts.rect(xl(y) - 10, y, 9, 40 + (y - back) * 0.12);
  // folded striped towel
  { const x = 1236, y = 724, w = 84, h = 26, r = 6; towel.moveTo(x + r, y); towel.arcTo(x + w, y, x + w, y + h, r); towel.arcTo(x + w, y + h, x, y + h, r); towel.arcTo(x, y + h, x, y, r); towel.arcTo(x, y, x + w, y, r); towel.closePath(); }
  for (let k = 0; k < 4; k++) stripes.rect(1244 + k * 20, 724, 8, 26);
  return { top, gaps, front, posts, towel, stripes, back, fr, xl };
})();
// bamboo spout trickling into the pool from the right bank
const SPOUT = { x0: 1236, y0: 520, x1: 1178, y1: 538, wy: 586 };
// weeping willow (left): trunk + dome are static; the hanging curtain sways
let WILLOW_STRANDS_DK = null;
const WILLOW = (() => {
  const trunk = new Path2D(), trunkLit = new Path2D(), dome = new Path2D(), domeLit = new Path2D(), domeDk = new Path2D();
  trunk.moveTo(-120, 474); trunk.bezierCurveTo(-96, 380, -70, 260, -40, 150); trunk.lineTo(-8, 154); trunk.bezierCurveTo(-30, 270, -44, 380, -40, 478); trunk.closePath();
  trunk.moveTo(-52, 230); trunk.bezierCurveTo(0, 190, 60, 150, 120, 110); trunk.lineTo(126, 120); trunk.bezierCurveTo(60, 168, 10, 206, -44, 250); trunk.closePath();
  trunkLit.moveTo(-112, 470); trunkLit.bezierCurveTo(-90, 380, -66, 262, -36, 152); trunkLit.lineTo(-28, 153); trunkLit.bezierCurveTo(-54, 268, -74, 380, -94, 474); trunkLit.closePath();
  const r = rng(515);
  // canopy dome: many small lobes along an arc + a solid core (no big polka highlights)
  const core = [[-330, 230], [-300, 120], [-220, 40], [-110, 0], [10, 6], [120, 44], [210, 120], [240, 210], [120, 250], [-80, 262], [-260, 262]];
  blobP(domeDk, core, 0, 8);
  blobP(dome, core);
  for (let i = 0; i < 30; i++) {
    const u = i / 29, a = PI * (1.02 + 0.98 * u);
    const x = -50 + Math.cos(a) * 270 + r.range(-10, 10), y = 150 + Math.sin(a) * 140 + r.range(-8, 8);
    const rr = r.range(30, 46);
    circleP(domeDk, x, y + 8, rr);
    circleP(dome, x - 2, y, rr * 0.94);
    if (u < 0.62) { domeLit.moveTo(x - rr * 0.9, y - rr * 0.1); domeLit.quadraticCurveTo(x - rr * 0.4, y - rr * 1.02, x + rr * 0.5, y - rr * 0.8); domeLit.quadraticCurveTo(x - rr * 0.2, y - rr * 0.55, x - rr * 0.9, y - rr * 0.1); domeLit.closePath(); }
  }
  // hanging tresses: tapered, gently curving ribbons in three tones
  const strands = new Path2D(), strandsLit = new Path2D(), strandsDk = new Path2D();
  for (let i = 0; i < 44; i++) {
    const sx = -310 + i * 12.8 + r.range(-5, 5);
    const top = 230 + r.range(-20, 30) - Math.pow(Math.abs(sx + 40) / 290, 2) * 70;
    const len = r.range(110, 230) * (1 - Math.pow(Math.abs(sx + 40) / 330, 2) * 0.6);
    const pts = [];
    for (let k = 0; k <= 8; k++) { const s2 = k / 8; pts.push([sx + Math.sin(s2 * 2.4 + i) * 5 * s2 + s2 * s2 * 6, top + s2 * len]); }
    const tone = i % 3 === 0 ? strandsLit : i % 3 === 1 ? strands : strandsDk;
    ribbonP(tone, pts, 0, 0, (u) => lerp(6, 1.4, u) * (1 + 0.25 * Math.sin(u * 23 + i)));
  }
  WILLOW_STRANDS_DK = strandsDk;
  return { trunk, trunkLit, dome, domeLit, domeDk, strands, strandsLit };
})();
// bamboo grove behind the sign (right)
const BAMBOO = (() => {
  const stalks = new Path2D(), stalkLit = new Path2D(), nodes = new Path2D(), leaves = new Path2D(), leavesLit = new Path2D();
  const r = rng(4646);
  for (let i = 0; i < 9; i++) {
    const x = 1196 + i * 22 + r.range(-8, 8), lean = r.range(-30, 24), w = r.range(7, 10.5);
    const yb = 452 + r.range(-6, 4), yt = -320;
    stalks.moveTo(x - w / 2, yb); stalks.lineTo(x + lean - w / 2.4, yt); stalks.lineTo(x + lean + w / 2.4, yt); stalks.lineTo(x + w / 2, yb); stalks.closePath();
    stalkLit.moveTo(x - w / 2, yb); stalkLit.lineTo(x + lean - w / 2.4, yt); stalkLit.lineTo(x + lean - w / 8, yt); stalkLit.lineTo(x - w / 8, yb); stalkLit.closePath();
    for (let y = yb - 30; y > yt; y -= r.range(52, 70)) {
      const k = (yb - y) / (yb - yt), nx = x + lean * k;
      nodes.rect(nx - w / 2 - 1, y - 1.6, w + 2, 3.2);
      if (y < 300 && r() < 0.75) {
        // a spray of slender leaves
        for (let j = 0; j < 4; j++) {
          const a = (r() < 0.5 ? PI : 0) + r.range(-0.5, 0.6) * (j % 2 ? 1 : -1) + 0.35, L = r.range(34, 52);
          const ex = nx + Math.cos(a) * L, ey = y + Math.sin(a) * L * 0.5 + L * 0.35;
          addLeaf(leaves, leavesLit, null, leafPts(nx, y, nx + Math.cos(a) * L * 0.5, y + Math.sin(a) * L * 0.25, ex, ey, 5.5, 8, false));
        }
      }
    }
  }
  return { stalks, stalkLit, nodes, leaves, leavesLit };
})();
function drawNewUpper(g, P) {
  drawSkyStatic(g, P);
  // rainbow arching over the little hill
  g.save(); g.globalAlpha = 0.2;
  for (const b of RAINBOW) { g.fillStyle = b.c; g.fill(b.p); }
  g.restore();
  drawClouds(g, 0, P, true, NEW_CLOUDS);
  NEW_HILLS.forEach((h, i) => {
    fillOff(g, h.path, P.hl(h.col, h.far, 1.2), -2, -3);
    g.fillStyle = vGrad(g, [[ridgeYAt(NEW_HILL_PTS[i], 640) - 40, P.g(h.col, h.far)], [470, P.g(mix(h.col, '#2E7A40', 0.3), h.far)]]);
    g.fill(h.path);
    if (i === 1) {
      g.save(); g.clip(h.path); g.strokeStyle = rgba(P.g('#B2DE90', 0.3), 0.4); g.lineWidth = 7; g.stroke(FIELD_STRIPES); g.restore();
      // the innocent little hill: its own silhouette, a sunlit rim and form shading
      const T = TINY_HILL;
      fillOff(g, T.rim, P.hl('#C8F09A', 0.08, 1.4));
      g.fillStyle = vGrad(g, [[T.y, P.g('#86D46E', 0.08)], [420, P.g('#5FB257', 0.08)]]);
      g.fill(T.body);
      fillOff(g, T.shade, rgba(P.g('#2E7A40', 0.1), 0.28));
      fillOff(g, T.tufts, P.g('#4E9E48', 0.08));
      g.fillStyle = rgba(P.g('#3E8A44', 0.08), 0.45);
      g.beginPath(); ellipseP(g, T.x, T.y + 3, 9, 2.2); g.fill();
    }
    if (i >= 1) {
      const L = NEW_TREES[i - 1];
      g.fillStyle = P.g(C.trunk, h.far); g.fill(L.trunk);
      g.fillStyle = P.g(C.jMid, h.far); g.fill(L.dark); g.fill(L.cyp);
      g.fillStyle = P.hl(C.jLight, h.far, 0.9); g.fill(L.lit); g.fill(L.cypLit);
    }
    if (i === 2) for (const [c, path] of HILL_FLOWERS) { g.fillStyle = P.g(c, 0.2); g.fill(path); }
  });
}
function drawNewLower(g, P, v) {
  drawGround(g, P);
  // flowering bushes on the back bank
  fillOff(g, NEW_SHRUBS.dark, P.g('#3E8A4E', 0.06));
  fillOff(g, NEW_SHRUBS.base, P.g('#5EAE5C', 0.06));
  fillOff(g, NEW_SHRUBS.lit, P.hl(C.jPale, 0.06, 1));
  for (const [c, path] of NEW_SHRUBS.bloom) { g.fillStyle = P.g(c, 0.04); g.fill(path); }
  g.fillStyle = rgba('#FFFFFF', 0.6); g.fill(NEW_SHRUBS.bloomHi);
  // willow trunk + dome
  fillOff(g, WILLOW.trunk, P.g('#6A5440'));
  fillOff(g, WILLOW.trunkLit, P.hl('#8E7458', 0, 0.7));
  fillOff(g, WILLOW.domeDk, P.g('#3E7A3A'));
  fillOff(g, WILLOW.dome, P.g('#62A64C'));
  fillOff(g, WILLOW.domeLit, P.hl('#8CC862', 0, 1));
  drawBankDetails(g, P);
  for (const [c, path] of NEW_FLOWERS.byCol) { g.fillStyle = P.g(c); g.fill(path); }
  g.fillStyle = P.g('#FFB02E'); g.fill(NEW_FLOWERS.centres);
  // sandy lip where the meadow meets the water, then the water
  g.strokeStyle = P.g('#E8D2A0'); g.lineWidth = 12; g.lineJoin = 'round'; g.stroke(POOL_PATH);
  g.strokeStyle = P.g('#E8D2A0'); g.lineWidth = 10; g.stroke(RIVER_PATH);
  drawWaterStatic(g, P, 'new');
  // lily pads
  fillOff(g, LILY_PADS.pads, P.g('#4E9E52'));
  fillOff(g, LILY_PADS.padsLit, P.hl('#7CC468', 0, 0.8));
  g.strokeStyle = rgba(P.g('#2E6E3A'), 0.5); g.lineWidth = 1; g.stroke(LILY_PADS.veins);
  fillOff(g, LILY_PADS.lotus, P.g('#FF9EC4'));
  fillOff(g, LILY_PADS.lotusHi, P.g('#FFE27A'));
  const lod = devScale(g), V = viewRect(g);
  drawRocks(g, P, RIVER_ROCKS, ROCK_STYLE_NEW, lod, V);
  drawRocks(g, P, NEW_RIM, ROCK_STYLE_NEW, lod, V);
  for (const [c, path] of RIM_FLOWERS.byCol) { g.fillStyle = P.g(c); g.fill(path); }
  g.fillStyle = P.g('#FFB02E'); g.fill(RIM_FLOWERS.centres);
  drawRocks(g, P, STEPPING, ROCK_STYLE_NEW, lod, V);
  // deck
  g.fillStyle = P.g('#7A5234'); g.fill(DECK.posts);
  g.fillStyle = P.g('#9A6A42'); g.fill(DECK.front);
  g.fillStyle = vGrad(g, [[DECK.back, P.hl('#D8A874', 0, 0.5)], [DECK.fr, P.g('#C08C5A')]]); g.fill(DECK.top);
  g.strokeStyle = rgba(P.g('#7A5234'), 0.75); g.lineWidth = 2; g.stroke(DECK.gaps);
  g.fillStyle = P.g('#FFFFFF'); g.fill(DECK.towel);
  g.fillStyle = P.g('#4FB0E8'); g.fill(DECK.stripes);
  g.strokeStyle = rgba(P.g('#2E7AA8'), 0.4); g.lineWidth = 1.5; g.stroke(DECK.towel);
  // bamboo spout
  g.lineCap = 'round';
  g.strokeStyle = P.g('#6E9A3E'); g.lineWidth = 11; g.beginPath(); g.moveTo(SPOUT.x0 + 40, SPOUT.y0 - 22); g.lineTo(SPOUT.x1, SPOUT.y1); g.stroke();
  g.strokeStyle = P.hl('#A8D46A', 0, 0.8); g.lineWidth = 4; g.beginPath(); g.moveTo(SPOUT.x0 + 40, SPOUT.y0 - 26); g.lineTo(SPOUT.x1, SPOUT.y1 - 4); g.stroke();
  g.fillStyle = P.g('#4E7A2E'); g.beginPath(); ellipseP(g, SPOUT.x1, SPOUT.y1, 4.5, 6); g.fill();
  g.fillStyle = P.g('#5E4630'); g.fillRect(SPOUT.x0 + 8, SPOUT.y0 - 12, 6, 40); g.fillRect(SPOUT.x0 + 30, SPOUT.y0 - 26, 6, 52);
  if (v.includes('M')) drawMoorPost(g, P, NEW_SPRING.moorPost.x, NEW_SPRING.moorPost.y);
}
const N_UPPER = { id: 'ns-up', rects: [[WX0, WY0, WX1, 474]], draw: (g, P) => drawNewUpper(g, P) };
const N_LOWER = { id: 'ns-lo', rects: [[WX0, 384, WX1, WY1], [-330, WY0, 270, 384]], draw: (g, P, v) => drawNewLower(g, P, v) };
const N_SIGN = {
  id: 'ns-sign',
  rects: [[1028, 300, 1266, 456]],
  draw(g, P) { drawSnoozeSignImpl(g, 0, P, { x: NEW_SPRING.signPos.x, y: NEW_SPRING.signPos.y, lines: ['SNOOZE SPRINGS 2', 'Barry Approved'], check: true }); },
};
const N_STRANDS = { id: 'ns-willow', rect: [-330, 150, 300, 500], draw(g, P) { fillOff(g, WILLOW_STRANDS_DK, P.g('#3E8640')); fillOff(g, WILLOW.strands, P.g('#5EA548')); fillOff(g, WILLOW.strandsLit, P.hl('#8ACB5E', 0, 0.9)); } };
const N_BAMBOO = {
  id: 'ns-bamboo', rect: [1140, -330, 1450, 456],
  draw(g, P) {
    fillOff(g, BAMBOO.stalks, P.g('#5E9A3A', 0.04)); fillOff(g, BAMBOO.stalkLit, P.hl('#9ACB5A', 0.04, 0.8));
    fillOff(g, BAMBOO.nodes, P.g('#41702A', 0.04));
    fillOff(g, BAMBOO.leaves, P.g('#3E8A3E', 0.04)); fillOff(g, BAMBOO.leavesLit, P.hl('#7CC45E', 0.04, 0.9));
  },
};
const N_CATTAILS = {
  id: 'ns-cat', rect: [-200, 500, 80, 724],
  draw(g, P) {
    fillOff(g, CATTAILS.blades, P.g('#4E9440')); fillOff(g, CATTAILS.bladesLit, P.hl('#86C45A', 0, 0.8));
    fillOff(g, CATTAILS.stems, P.g('#5E8A3A')); fillOff(g, CATTAILS.heads, P.g('#7A4E2E'));
  },
};
function drawSpoutWater(ctx, t, P) {
  ctx.save();
  const x = SPOUT.x1 - 3, y = SPOUT.y1 + 2;
  ctx.fillStyle = rgba(P.wHi, 0.85);
  ctx.beginPath();
  ctx.moveTo(x - 3, y);
  ctx.quadraticCurveTo(x - 10, y + 20, x - 8 + Math.sin(t * 9) * 1.2, SPOUT.wy);
  ctx.lineTo(x - 2 + Math.sin(t * 9 + 1) * 1.2, SPOUT.wy);
  ctx.quadraticCurveTo(x - 2, y + 18, x + 3, y);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = rgba('#FFFFFF', 0.7);
  ctx.beginPath();
  for (let i = 0; i < 4; i++) { const k = frac(t * 2.3 + i / 4); ellipseP(ctx, x - 6 + (i - 1.5) * 4 * k, SPOUT.wy - 2 - Math.sin(PI * k) * 6, 1.6, 1.6); }
  ctx.fill();
  ctx.restore();
  waterlineRipple(ctx, x - 5, SPOUT.wy + 1, 30, t, { amp: 0.6, part: 'both', color: P.wHi, speed: 1.4, clip: false });
}
function drawTinyHillPuffs(ctx, t, op) {
  const A = NEW_SPRING, sc = A.hillPuffScale;
  if (op.puffs) for (const pf of op.puffs) drawVolcanoPuff(ctx, t, Object.assign({ x: A.hillPuffPos.x, y: A.hillPuffPos.y, rise: 30, drift: 22 }, pf, { size: (pf.size ?? 1) * sc }));
  if (op.hillPuff > 0) drawVolcanoPuff(ctx, t, { k: op.hillPuff, size: 0.7 * sc, x: A.hillPuffPos.x, y: A.hillPuffPos.y, rise: 26, drift: 18, seed: 7 });
}
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
function drawNewSpring(ctx, t, o) {
  const op = opts(o, 'new');
  const P = palette('new', 0, 0, op.skyTint);
  const corners = lightCorners('new', 0, 0, op.skyTint);
  const V = viewRect(ctx);
  ctx.save();
  const [jx, jy] = op.rumble > 0 ? [noise1(t * 23 + 1) * op.rumble * 1.4, noise1(t * 19 + 3) * op.rumble * 0.9] : [0, 0];
  ctx.translate(jx, jy);
  drawLayer(ctx, N_UPPER, corners);
  if (V.y0 < 120) drawClouds(ctx, t, P, false, NEW_CLOUDS, V);
  if (op.birds) drawBirds(ctx, t, P);
  if (vis(V, 760, 120, 1000, 340)) drawTinyHillPuffs(ctx, t, op);
  ctx.translate(-jx, -jy);
  drawLayer(ctx, N_LOWER, corners, op.moorPost ? 'M' : '');
  // live: bamboo (behind the sign), the sign, willow curtain, cattails
  if (vis(V, 1140, -330, 1450, 456)) {
    const a = sway(t, 31, 0.012, 0.5, op.rumble);
    ctx.save(); ctx.translate(1290, 452); ctx.rotate(a); ctx.translate(-1290, -452); N_BAMBOO.draw(ctx, P); ctx.restore();
  }
  if (op.sign && vis(V, 1030, 200, 1270, 460)) drawLayer(ctx, N_SIGN, corners);
  if (vis(V, -320, 120, 300, 480)) {
    const sx = sway(t, 17, 2.4, 0.5, op.rumble);
    ctx.save(); ctx.translate(sx, 0); N_STRANDS.draw(ctx, P); ctx.restore();
  }
  if (V.y1 > 450) drawWaterLive(ctx, t, P, op, V);
  if (vis(V, 1140, 500, 1260, 600)) drawSpoutWater(ctx, t, P);
  // sparkles
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < 9; i++) {
    const ph = t * 0.7 + hash1(i * 3.1), k = frac(ph), a = Math.sin(PI * k);
    if (a < 0.05) continue;
    const y = lerp(492, 760, hash1(i * 7.7)), sp = freeSpan(y);
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
  if (op.barryRock && vis(V, 750, 520, 850, 590)) drawBarryRockImpl(ctx, t, P, ROCK_STYLE_NEW);
  if (op.raft) {
    try {
      const props = require('./props');
      if (props.drawRaft) props.drawRaft(ctx, { x: NEW_SPRING.raftMoor.x, y: NEW_SPRING.raftMoor.y, scale: 0.5, t, flagText: 'S.S. TOLD YOU SO' });
    } catch (e) { /* props.js not available */ }
  }
  const heat = op.waterHeat;
  if (vis(V, 230, 300, 1130, 490)) drawSteam(ctx, t, { x: 680, y: 480, w: 900, amount: 0.18 + heat * 0.9, h: 120, scale: 0.75, color: P.steam, seed: 3, maxWisps: 8 });
  if (vis(V, 180, 360, 1180, 570)) drawSteam(ctx, t, { x: 680, y: 566, w: 1000, amount: 0.1 + heat * 0.9, h: 150, scale: 1.0, color: P.steam, seed: 5, maxWisps: 8 });
  if (vis(V, -200, 500, 80, 724)) {
    const sx = sway(t, 23, 2, 0.7, op.rumble);
    ctx.save(); ctx.translate(-60, 720); ctx.rotate(sx * 0.01); ctx.translate(60, -720); N_CATTAILS.draw(ctx, P); ctx.restore();
  }
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
function labCapy(ctx, t, s, flip, who, seed) {
  try {
    const cap = require('./capybara');
    if (cap.drawCapybara) { cap.drawCapybara(ctx, { x: s.x, y: s.y, scale: s.scale || 1, flip, who, seed, t, pose: 'swim', mood: who === 'barry' ? 'worried' : who === 'extra' ? 'sleepy' : 'chill' }); return; }
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
// everyone in the pool, depth-sorted, each with its own front water
function labSwimmers(ctx, t, S, o, extras = true) {
  const list = [
    { ...S.sunny, draw: (c) => labCapy(c, t, S.sunny, false, 'sunny') },
    { ...S.barry, draw: (c) => labCapy(c, t, S.barry, false, 'barry') },
    { ...S.doreen, draw: (c) => labCapy(c, t, S.doreen, true, 'doreen') },
  ];
  if (extras) S.extras.forEach((e, i) => list.push({ ...e, draw: (c) => labCapy(c, t, e, e.flip, 'extra', i * 3 + 1) }));
  drawSwimmers(ctx, t, list, o);
}
const ERUPT_O = (e) => ({ setting: 'evening', dusk: 0.2, erupt: e, waterHeat: clamp(0.3 + e * 0.8), rumble: e > 0.04 ? 0.6 : 0 });
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
      const k = s.size;
      ctx.fillStyle = 'rgba(255,90,60,0.75)'; ctx.fillRect(s.x - 3 * k, s.y - 70 * k, 6 * k, 70 * k);
      ctx.beginPath(); ctx.moveTo(s.x - 44 * k, s.y - 70 * k); ctx.lineTo(s.x - 30 * k, s.y - 82 * k); ctx.lineTo(s.x + 34 * k, s.y - 82 * k); ctx.lineTo(s.x + 34 * k, s.y - 58 * k); ctx.lineTo(s.x - 30 * k, s.y - 58 * k); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText('EXIT ' + i, s.x - 24 * k, s.y - 65 * k);
    });
    ctx.fillStyle = 'rgba(255,240,200,0.8)'; ctx.fillRect(S.rulesSignSpot.x - 55, S.rulesSignSpot.y - 96, 110, 66); ctx.fillRect(S.rulesSignSpot.x - 3, S.rulesSignSpot.y - 30, 6, 30);
    ctx.fillStyle = '#333'; ctx.fillText('SPRING RULES', S.rulesSignSpot.x - 46, S.rulesSignSpot.y - 70);
    mark(S.raftMoor.x, S.raftMoor.y, 150, 44, '#C9B8FF', 'raftMoor');
    mark(S.thermometerSpot.x, S.thermometerSpot.y, 14, 14, '#FF6B6B', 'thermo');
    mark(S.barryRock.top.x, S.barryRock.top.y, 16, 8, '#FFFFFF', 'barryRock.top');
    mark(S.lavaEntry.x, S.lavaEntry.y, 20, 12, '#FF9A1F', 'lavaEntry');
    mark(S.riverMouth.x, S.riverMouth.y, 20, 20, '#A8D8FF', 'riverMouth');
    mark(S.moorPost.x, S.moorPost.y, 12, 12, '#FFFFFF', 'moorPost');
    mark(S.signPos.x, S.signPos.y, 16, 8, '#FFFFFF', 'signPos');
    mark(S.craterPos.x, S.craterPos.y, S.craterPos.w, 16, '#FF9A1F', 'crater');
    mark(S.grove.x, S.grove.y, S.grove.w, 40, '#FFB13B', 'grove');
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
    ctx.beginPath(); S.escapePath.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,170,60,0.95)';
    ctx.beginPath(); S.orangeRoll.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,220,255,0.95)';
    ctx.beginPath(); S.fishHop.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,180,255,0.9)';
    ctx.beginPath(); S.riverPath.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    ctx.setLineDash([]);
    S.groveOranges.slice(0, 6).forEach((q, i) => mark(q.x, q.y, 5, 5, i ? '#FFB13B' : '#FF2020', i ? '' : 'grovePos'));
    mark(S.lavaEntry2.x, S.lavaEntry2.y, 16, 10, '#FF9A1F', 'lavaEntry2');
    // assertion: every swim spot's body (x ± w/2 at its waterline) must sit on open water
    const bad = [];
    for (const [name, sp] of [['sunny', S.swimSpots.sunny], ['barry', S.swimSpots.barry], ['doreen', S.swimSpots.doreen]].concat(S.swimSpots.extras.map((e, i) => ['extra' + i, e]))) {
      const hw = 115 * (sp.scale || 1);
      const ok = freeWater(sp.x - hw, sp.y, 0) && freeWater(sp.x + hw, sp.y, 0) && freeWater(sp.x, sp.y, 0);
      ctx.fillStyle = ok ? '#3BE07A' : '#FF3030';
      ctx.fillRect(sp.x - hw, sp.y - 2, 2 * hw, 4);
      if (!ok) bad.push(name);
    }
    if (bad.length) console.warn('env_spring: swim spots not on open water:', bad.join(', '));
    ctx.restore();
  },
  swim(ctx, t) {
    drawSpringDay(ctx, t, {});
    labSwimmers(ctx, t, SPRING.swimSpots, { setting: 'day' });
    drawSpringOverlay(ctx, t, {});
  },
  evening(ctx, t) {
    const o = { dusk: 0.15 };
    drawSpringEvening(ctx, t, o);
    labSwimmers(ctx, t, SPRING.swimSpots, { setting: 'evening', ...o }, false);
    drawSpringOverlay(ctx, t, { setting: 'evening', ...o });
  },
  evening_dusk(ctx, t) {
    [0, 0.33, 0.66, 1].forEach((d, i) => tile(ctx, i, 2, 2, `dusk ${d}`, () => drawSpringEvening(ctx, t, { dusk: d })));
  },
  eruption(ctx, t) {
    [0, 0.1, 0.18, 0.25, 0.35, 0.5, 0.75, 1].forEach((e, i) => tile(ctx, i, 4, 2, `erupt ${e}`, () => {
      const o = { ...ERUPT_O(e), flash: 0 };
      drawSpringEvening(ctx, t, o); drawSpringOverlay(ctx, t, o);
    }));
  },
  eruption_day(ctx, t) {
    [0.12, 0.3, 0.6, 1].forEach((e, i) => tile(ctx, i, 2, 2, `day erupt ${e}`, () => {
      const o = { erupt: e, waterHeat: 0.3 + e * 0.7, rumble: 0.5, flash: 0 };
      drawSpringDay(ctx, t, o); drawSpringOverlay(ctx, t, o);
    }));
  },
  erupt_peak(ctx, t) { const o = ERUPT_O(0.45); drawSpringEvening(ctx, t, o); drawSpringOverlay(ctx, t, o); },
  erupt_flow(ctx, t) { const o = { ...ERUPT_O(0.9), lava: 0.2 }; drawSpringEvening(ctx, t, o); drawSpringOverlay(ctx, t, o); },
  lava(ctx, t) {
    [0.15, 0.4, 0.7, 1].forEach((l, i) => tile(ctx, i, 2, 2, `lava ${l}  signBurn ${clamp(l * 1.5).toFixed(2)}`, () => {
      const o = { ...ERUPT_O(1), waterHeat: 1, rumble: 0.4, lava: l, signBurn: clamp(l * 1.5) };
      drawSpringEvening(ctx, t, o); drawSpringOverlay(ctx, t, o);
    }));
  },
  lava_full(ctx, t) {
    const o = { ...ERUPT_O(1), waterHeat: 1, rumble: 0.4, lava: 0.75, signBurn: 0.8 };
    drawSpringEvening(ctx, t, o);
    labSwimmers(ctx, t, SPRING.swimSpots, o, false);
    drawSpringOverlay(ctx, t, o);
  },
  boil(ctx, t) {
    [0, 0.4, 0.7, 1].forEach((h, i) => tile(ctx, i, 2, 2, `waterHeat ${h}`, () => {
      drawSpringDay(ctx, t, { waterHeat: h });
      labSwimmers(ctx, t, SPRING.swimSpots, { setting: 'day', waterHeat: h }, false);
      drawSpringOverlay(ctx, t, { waterHeat: h });
    }));
  },
  boil_full(ctx, t) {
    const o = { waterHeat: 1, rumble: 0.3 };
    drawSpringDay(ctx, t, o);
    labSwimmers(ctx, t, SPRING.swimSpots, o, false);
    drawSpringOverlay(ctx, t, o);
  },
  rumble(ctx, t) { drawSpringDay(ctx, t, { rumble: 1, volcanoSmoke: 0.7 }); drawSpringOverlay(ctx, t, { rumble: 1 }); },
  puffs(ctx, t) {
    // the s04 sneeze through the kit's volcano framing {860,236} z1.9: little puff (0s), little puff
    // (.5s), then the big one (1.4s) that hangs over the crater (scenes map beat time → puff life k)
    const seq = (tt) => [{ k: tt / 1.3, size: 0.5, seed: 1 }, { k: (tt - 0.5) / 1.3, size: 0.55, seed: 2 }, { k: (tt - 1.4) / 3.2, size: 1.4, dark: 0.35, seed: 3 }];
    [0.25, 0.7, 1.2, 1.6, 2.1, 2.8, 3.6, 4.4].forEach((tt, i) => tile(ctx, i, 4, 2, `sneeze t=${tt}`, () => withCamera(ctx, { x: 860, y: 236, zoom: 1.9 }, () => {
      drawSpringDay(ctx, t + tt, { volcanoSmoke: 0.15, puffs: seq(tt) });
    })));
  },
  hill_sneeze(ctx, t) {
    // s09: the innocent little hill does the exact same sneeze (o.puffs on drawNewSpring)
    const seq = (tt) => [{ k: tt / 1.3, size: 0.5, seed: 1 }, { k: (tt - 0.35) / 1.3, size: 0.55, seed: 2 }, { k: (tt - 0.8) / 3.2, size: 1.4, seed: 3 }];
    [0.2, 0.55, 1.0, 1.4, 2.2, 3.4].forEach((tt, i) => tile(ctx, i, 3, 2, `hill t=${tt}` + (i === 5 ? ' (wide)' : ''), () => withCamera(ctx, i === 5 ? { x: 640, y: 360, zoom: 1 } : NEW_SPRING.hillCam, () => {
      drawNewSpring(ctx, t + tt, { puffs: seq(tt) });
    })));
  },
  grove(ctx, t) {
    // groveTaken removes oranges (first = SPRING.grovePos, the one that rolls in s04); groveShake
    [[0, 0], [1, 0], [8, 0], [1, 1]].forEach(([n, sh], i) => tile(ctx, i, 2, 2, `groveTaken ${n}  groveShake ${sh}`, () => withCamera(ctx, { x: 768, y: 340, zoom: 4.5 }, () => {
      drawSpringDay(ctx, t, { groveTaken: n, groveShake: sh });
    })));
  },
  new_spring(ctx, t) { drawNewSpring(ctx, t, { raft: true }); },
  new_swim(ctx, t) {
    drawNewSpring(ctx, t, { raft: true });
    labSwimmers(ctx, t, NEW_SPRING.swimSpots, { setting: 'new' }, false);
  },
  sign(ctx, t) {
    const P = palette('day');
    ctx.fillStyle = '#7DB765'; ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = '#3A2228'; ctx.fillRect(0, 0, 1280, 360);
    [0, 0.3, 0.65, 1].forEach((b, i) => drawSnoozeSignImpl(ctx, t, palette('evening', 0.2, 1), { x: 170 + i * 310, y: 300, burn: b, scale: 1.25 }));
    drawSnoozeSignImpl(ctx, t, palette('new'), { x: 320, y: 640, scale: 1.5, lines: ['SNOOZE SPRINGS 2', 'Barry Approved'], check: true });
    drawSnoozeSignImpl(ctx, t, P, { x: 900, y: 640, scale: 1.5 });
  },
  particles(ctx, t) {
    ctx.fillStyle = '#2B3A4A'; ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = '#3FAFB5'; ctx.fillRect(0, 300, 640, 420);
    ctx.font = '600 14px Nunito'; ctx.fillStyle = '#fff';
    ctx.fillText('drawSteam amount .3 / .7 / 1.2', 20, 24);
    drawSteam(ctx, t, { x: 110, y: 300, w: 180, amount: 0.3, h: 160 });
    drawSteam(ctx, t, { x: 320, y: 300, w: 180, amount: 0.7, h: 160 });
    drawSteam(ctx, t, { x: 530, y: 300, w: 180, amount: 1.2, h: 180 });
    ctx.fillStyle = '#fff';
    ctx.fillText('drawBubbles .3 / .7 / 1   +  waterlineRipple (both)', 20, 330);
    drawBubbles(ctx, t, { x: 110, y: 400, w: 180, h: 50, amount: 0.3 });
    drawBubbles(ctx, t, { x: 320, y: 400, w: 180, h: 50, amount: 0.7 });
    drawBubbles(ctx, t, { x: 530, y: 400, w: 180, h: 50, amount: 1, scale: 1.2 });
    waterlineRipple(ctx, 160, 520, 160, t, { part: 'both', clip: false });
    ctx.fillStyle = '#fff'; ctx.fillText('drawSteamBurst  /  drawFlames', 330, 500);
    drawSteamBurst(ctx, t, { x: 480, y: 700, w: 160, amount: 1, scale: 0.8 });
    drawFlames(ctx, t, [{ x: 600, y: 700, h: 60, w: 14, seed: 1 }, { x: 570, y: 702, h: 40, w: 10, seed: 2 }]);
    ctx.fillStyle = '#fff';
    ctx.fillText('fallingRocks from the crater (loops every 3s) / ash / embers', 660, 24);
    ctx.save();
    ctx.beginPath(); ctx.rect(640, 0, 640, 720); ctx.clip();
    ctx.fillStyle = '#6E9A5A'; ctx.fillRect(640, 560, 640, 160);
    ctx.fillStyle = '#4FA8B5'; ctx.beginPath(); ellipseP(ctx, 1080, 640, 180, 50); ctx.fill();
    ctx.fillStyle = '#5B5D78'; ctx.beginPath(); ctx.moveTo(700, 560); ctx.lineTo(800, 330); ctx.lineTo(840, 330); ctx.lineTo(940, 560); ctx.closePath(); ctx.fill();
    drawFallingRocks(ctx, (t + 1.1) % 3, { t0: 0, count: 10, seed: 3, dur: 1.2, from: { x: 820, y: 330 }, area: { x0: 900, x1: 1240, yGround: [580, 680] } });
    drawAsh(ctx, t, { density: 1, area: { x0: 640, x1: 1280, y0: 0, y1: 720 } });
    drawEmbers(ctx, t, { density: 1, area: { x0: 640, x1: 1280, y0: 0, y1: 720 } });
    ctx.restore();
  },
  rocks(ctx, t) {
    // eruption rock rain in situ (scenes sync 'bonk'/'splash' to rock.impactT / rock.landT), plus two
    // TARGETED rocks: one bonks Doreen's orange at 0.6 s, one bounces off a helmet on Barry at 1.0 s
    const D = SPRING.swimSpots.doreen, B = SPRING.swimSpots.barry;
    const targets = [{ x: D.x - 40, y: D.y - 128, impactT: 0.6, r: 10 }, { x: B.x + 50, y: B.y - 140, impactT: 1.0, r: 11, bounce: { vx: 150, vy: -230 } }];
    [0.3, 0.62, 0.9, 1.08, 1.3, 1.8].forEach((tt, i) => tile(ctx, i, 3, 2, `rocks t=${tt}`, () => {
      const o = ERUPT_O(0.6);
      drawSpringEvening(ctx, t + tt, o);
      drawFallingRocks(ctx, tt, { t0: 0, count: 12, seed: 7, dur: 0.9, from: SPRING.craterPos, area: { x0: 220, x1: 1150, yGround: [500, 700] }, targets });
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
      for (const q of targets) { ctx.beginPath(); ellipseP(ctx, q.x, q.y, 14, 14); ctx.stroke(); }
      ctx.restore();
      drawSpringOverlay(ctx, t + tt, o);
    }));
  },
  framings(ctx, t) {
    const S = SPRING.swimSpots;
    const views = [
      ['wide z0.85', { x: 640, y: 360, zoom: 0.85 }],
      ['sunny z2.2', { x: S.sunny.x, y: S.sunny.y, zoom: 2.2 }],
      ['barry z2.2', { x: S.barry.x, y: S.barry.y, zoom: 2.2 }],
      ['doreen z2.2', { x: S.doreen.x, y: S.doreen.y, zoom: 2.2 }],
      ['volcano z2', { x: 860, y: 230, zoom: 2 }],
      ['wide z0.8 erupt .5 (shake)', { x: 640, y: 340, zoom: 0.8, shake: 12, t }],
    ];
    views.forEach(([label, cam], i) => tile(ctx, i, 3, 2, label, () => withCamera(ctx, cam, () => {
      const o = i === 5 ? { setting: 'day', erupt: 0.5, waterHeat: 0.8, rumble: 0.8, flash: 0 } : {};
      drawSpringDay(ctx, t, o);
      if (i >= 1 && i <= 3) labSwimmers(ctx, t, S, { setting: 'day' }, i === 1);
      drawSpringOverlay(ctx, t, o);
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
  framings_world(ctx, t) {
    // the extended world: following the raft down the river to the left (s07 raft_launch) + edges
    const R = SPRING.riverPath;
    const views = [
      ['raft follow x=0 z1.6', { x: 0, y: 560, zoom: 1.6 }], ['raft follow x=-400 z1.6', { x: -400, y: 580, zoom: 1.6 }],
      ['rapids x=-720 z1.4', { x: -720, y: 590, zoom: 1.4 }], ['far left x=-1000 z1.4', { x: -1000, y: 560, zoom: 1.4 }],
      ['clampCam(-1400, z1.2)', SPRING.clampCam({ x: -1400, y: 500, zoom: 1.2 })], ['right edge x=1400 z1.5', { x: 1400, y: 300, zoom: 1.5 }],
    ];
    views.forEach(([label, cam], i) => tile(ctx, i, 3, 2, label, () => withCamera(ctx, cam, () => {
      const o = { setting: 'evening', dusk: 0.2, erupt: 1, lava: 0.8, waterHeat: 1, rumble: 0.3 };
      drawSpringEvening(ctx, t, i === 5 ? { dusk: 0.2 } : o);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (const p of R) { ctx.beginPath(); ellipseP(ctx, p.x, p.y, 4, 4); ctx.fill(); }
      drawSpringOverlay(ctx, t, i === 5 ? { setting: 'evening', dusk: 0.2 } : o);
    })));
  },
  foreground(ctx, t) {
    drawSpringDay(ctx, t, {});
    drawForegroundFoliage(ctx, t, { top: true });
  },
};

// every exported drawing function leaves the context exactly as it found it
const guard = (fn) => function guarded(ctx, ...args) { ctx.save(); try { return fn(ctx, ...args); } finally { ctx.restore(); } };
module.exports = {
  drawSpringDay: guard(drawSpringDay), drawSpringEvening: guard(drawSpringEvening), drawNewSpring: guard(drawNewSpring),
  drawEruption: guard(drawEruption), drawMountSnooze: guard(drawMountSnooze), drawSnoozeSign: guard(drawSnoozeSign),
  drawWaterFront: guard(drawWaterFront), drawSwimmers: guard(drawSwimmers), drawBarryRock: guard(drawBarryRock),
  drawVolcanoPuff: guard(drawVolcanoPuff), drawSteamBurst: guard(drawSteamBurst), drawFlames: guard(drawFlames),
  waterlineRipple: guard(waterlineRipple), drawSpringOverlay: guard(drawSpringOverlay), drawForegroundFoliage: guard(drawForegroundFoliage),
  fallingRocks, drawFallingRocks: guard(drawFallingRocks), drawAsh: guard(drawAsh), drawEmbers: guard(drawEmbers),
  drawSteam: guard(drawSteam), drawBubbles: guard(drawBubbles),
  inPool, freeWater, clampCam, SPRING, NEW_SPRING, lab,
  // internals for the kit / tests (not part of the stable API)
  _internals: { palette, TSTAT, flushTiles },
};
