// CHILL CAPYBARA — props & small FX (see DESIGN.md §6). Flat-vector storybook style that
// matches the characters: soft gradients, a rim-light crescent on the top-left edges, thin
// darker same-hue outlines, rounded shapes. Every function is a pure function of its options
// (time `t` included): deterministic, no Math.random, ctx state restored on exit.
//
// Cost at 1920×1080 (min of 3×100 runs, flushed, machine under load): most props 0.3-1 ms;
// orange r14 ≈0.2 ms (12 for orange rain ≈2.6 ms); hot rock + trail r14 ≈0.8 ms; SPRING RULES
// sign at .42 ≈1.7 ms; raft ≈3.4 / 7.4 ms at scale .6 / 1.2 (hull layers are cached bitmaps;
// an ANIMATED grade (kit lightFor during the eruption) adds only ≈+15-25%: the cache is
// untinted and re-tinted on a copy); raft while building ≈6 ms at .5 (live, splashes);
// burning sign ≈11 ms at scale 2 (≈2.5 ms each at .6); thermometer close-up s 4.2 ≈3.8 ms, its
// pop ≈4.5 ms at scale 5 (in air or under water); splat / splash / burst ≈1 ms.
//
// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API   (all coordinates in 1280×720 design units; angles in RADIANS)
// ─────────────────────────────────────────────────────────────────────────────
// Common options: x, y (origin, see each prop), scale=1, rot=0, flip=false (mirror
// horizontally), alpha=1 (fades the prop as ONE layer — never see-through outlines).
// Outlines thin out gently when a prop is drawn big (close-ups). Level of detail follows the
// prop's ON-SCREEN size (camera zoom and output scale included).
// "t = seconds since X" FX draw nothing for t < 0 and nothing once finished, so they can
// be called every frame with S.since('cue').
//
// LIGHT (every prop): o.grade = 'day' | 'gold' (= 'evening' / 'spring_evening') | 'dusk' |
//   'erupt' | 'sunset' (= 'river_sunset') | 'office' | 'new' (= 'new_spring'); or o.light =
//   {tint:{color, amount}, rim} — exactly the scene kit's lightFor() object (or o.tint + o.rim
//   like drawCapybara). Mixes the light into the prop's colours and the rim crescents; grade
//   also picks the WATER palette for submerged tints, contact ripples and drawWaterSplash.
//   Default: daylight, untinted (pass the grade of the active setting; GRADES has them all).
// WATER (drawOrange, drawThermometer, drawRock; drawRaft does it by itself when floating):
//   o.waterY = caller-space y of the water surface. Everything below it is tinted with the
//   water colour (stronger with depth; o.waterDepth, o.waterAlpha), a bright meniscus hugs the
//   prop where it pierces the surface and little ripple rings spread from it. Draw floating
//   props AFTER the env's front water layer (they submerge themselves). Without o.grade /
//   o.water the tint is a neutral cool shade that reads as "under water" over any water.
//   o.water = {top, mid, base, deep, line, foam} overrides the palette.
//
// drawOrange(ctx, {x, y, r=16, rot, squash=0, bounce=0, t, seed, leaf=true, leaves=1, flip,
//                  waterY, grade|light, alpha})
//     THE SAME ORANGE AS THE RIG'S HEAD ORANGE (capybara.drawCapyOrange; a faithful port is
//     used below ~24 device px, minus sub-pixel pores). (x,y) = centre; the bottom point
//     (x, y+r) stays put while squashing.
//     squash 0..1 = the SMASH, one continuous morph: 0-.12 the whole glossy orange flattens on
//       impact (pores + highlight kept, juice starts to pool), from .12 the peel tears into
//       uneven flaps (back flaps stand up showing pith, front flaps fold over the cup) while the
//       pores and highlight wear off, lumpy pulp bulges out (loose segment chunks only late),
//       .55-1 keeps slumping/spreading (body ≤ 1.3× the orange's width). The leaf glides from
//       the top of the dome onto a peel flap — no jumps anywhere.
//     bounce -1..1 = SQUASH & STRETCH for hops / landings (s04 orange_rolls), separate from the
//       smash: scale (1 + .35 b, 1 - .5 b) about the base point (b > 0 squash, b < 0 stretch;
//       pores, highlight and an undistorted leaf kept) — the rig's drawCapyOrange squash < .5
//       uses the same scale. Ignored while squash > 0.
//     ONE squashed orange: the worn accessories.orange:'squashed' and drawCapyOrange squash ≥ .5
//     ARE this squash 1 (the rig delegates to props). At the doreen_splat impact switch the
//     accessory on the hit frame and cover it with drawJuiceSplat(t = since impact, r ≈ 1.75 ×
//     the orange radius): its hit frame is its biggest.
// drawJuiceSplat(ctx, {x, y, r=24, t, seed, rot, life=1.2, gravity=1, puddle=false, floor=0,
//                      grade|light, alpha})
//     Orange-juice burst. t = seconds since impact. The HIT FRAME (t < 1/24) is already the
//     biggest (1.15 r; its body covers an orange of radius ≤ r/1.6), it settles, then SHRINKS
//     into the spray (gone by 0.34 s) — no fade. The splat is wet: a lumpy body, arms fat at
//     the base that taper to a neck and end in teardrop drops, detached drops, pulp sacs and
//     glossy specular glints; a quick ring of mist droplets (0-0.14 s); ballistic glossy
//     droplets that shrink out by `life`; pulp flecks; one small peel fleck. puddle:true adds a
//     growing juice puddle at y + floor.
// drawHelmet(ctx, {x, y, scale=1, rot, flip, strap=true, soot=0, grade|light, alpha})
//     THE RIG'S HELMET (capybara.drawCapyHelmet): identical worn / on a rock / in a paw.
//     Origin = middle of the bottom rim, visor → +x. scale 1 = the helmet on a scale-1 head:
//     pass capyAnchors(o).helmet.scale to match a worn one. strap: open chin strap dangling.
// drawThermometer(ctx, {x, y, scale=1, rot, flip, level=0.5, reading=null, showTag=true,
//                       tagPop=true, tagSide='right', tagSize=13, labels=auto, length=100, t,
//                       waterY, broken=0, popAt=0.16, dur=1.3, surgeEnd=0.92, surge=true,
//                       since, popTime=0.9, breakAt='bulb'|'top', grade|light, alpha})
//     BARRY'S THERMOMETER = THE RIG'S (capybara.drawCapyThermometer draws glass, column, ticks,
//     bulb; props adds the rest). VERTICAL, bulb at the bottom; origin = bulb centre; the tube
//     runs up to y - 102*scale (length 100). level 0..1 = red column (thermoLevel(°C): 30 °C → 0,
//     45 °C → 1); the column's FLAT top sits on the level line (its rounded meniscus above it).
//     reading + showTag → big upright readable tag "39.4°" pointing at that flat top:
//       reading:'auto' = the CURRENT animated column, formatted (39.8) every frame — it counts
//         up during a creep or the surge. s04 thermo_check ("the red line creeps up and settles
//         on 39.8"): level: U.tween(S.since('thermo_check'), 0, 1.35, thermoLevel(39.4),
//         thermoLevel(39.8), ease.outCubic), reading: 'auto'  (the paw thermometer passes
//         accessories.thermometer.reading straight through, so 'auto' works there too).
//       reading:'39.8' = that number; during a break, once the surging column passes it, the
//         tag counts up with the column, trembles while the bulb strains and POPS OFF with the
//         glass (flies away, keeping the peak reading) — callers never hide it by hand
//         (tagPop:false keeps it on).
//     labels (default on at scale ≥ 2.2, close-ups): the printed 30/35/40/45 scale on a real
//     °C grid — major ticks at 30/35/40/45, a minor tick every 1 °C, painted over the glass
//     highlight (the close-up tube is the rig's art, ported, with this scale).
//     THE BREAK — two ways to drive it:
//       broken 0..1 over `dur` s, popping at popAt (fraction). s07 thermo_pops (1.3 s beat,
//         glass_pop sfx at 0.9 s):  broken: S.prog('thermo_pops'), popAt: 0.9 / 1.3
//       since = seconds since the beat start, pop at popTime s:
//         since: S.since('thermo_pops'), popTime: 0.9
//     The column eases up to the top across the whole run-up (done at surgeEnd of it; surge:
//     false keeps level), the bulb swells (to 1.32×), cracks and trembles over the last 45%,
//     then — timed in SECONDS from the pop — a 2-frame white-hot comic flash, a red splat
//     ~1.9× the swollen bulb that punches out and breaks up into a ballistic spray + glass
//     shards (all gone by ≈0.32 s), the column drains (≈0.45 s) leaving the rig's jagged stub.
//     breakAt:'top' blows the cap off instead: a red geyser + the rounded glass cap (jagged
//     break, red residue) on ONE ballistic arc up and away (it clears the frame in a close-up).
//     WITH waterY: in-air spray / shards / cap only above the surface (anything below is
//     culled); a bulb popping UNDER the surface makes a muffled shock ring, a red INK CLOUD that
//     blooms and slowly drifts up (≈2 s), bubbles rising to the surface and glass shards that
//     sink slowly — all water-coloured — plus a small bump/splash on the surface above it.
// thermoLevel(celsius, lo=30, hi=45) → level 0..1
// thermoAnchors(o) → {bulb, top, column (flat top of the red column), tag, reading (the number
//                    the tag shows now, e.g. '39.8' — the tag adds '°' — or null)} caller-space
// drawSign(ctx, {x, y, text | lines, style='wood'|'arrow'|'board', arrowDir='left'|'right',
//                w, h, size=24, sizes, weight=700, scale=1, rot, burn=0, t, seed, paint,
//                paint2, board, stake=30, drive=1, ground=true, wrap=true, glyph, drips=0,
//                notice=auto, align='left', highlight, highlightK=1, grade|light, alpha})
//     Hand-made wooden sign with painted Fredoka lettering on a stake in the ground — the same
//     sign-maker as env's SNOOZE SPRINGS sign (wood, post caps, cream titles, MINT secondary
//     lines). Origin (x,y) = the GROUND point under the stake; the board sits above it (rot
//     pivots there — use signWobble(dt) for a post-hammer-hit wobble). text: 'A / B', 'A — B',
//     'A -- B' or '\n' split lines; long single lines (>16 chars) auto-wrap at '. ' / ', '
//     (wrap:false disables). Arrows in the text ('EXIT →', '← EXIT', '->', '<-', '⇒') become
//     a painted arrow: arrow boards point that way, wood signs get glyph + arrowDir. Characters
//     the font lacks are dropped (never drawn as boxes).
//     'wood': one plank per line; 3+ lines = a NOTICE: title plank + one tall board with the
//       rest as a left-aligned list (align:'center' to centre; notice:false = one plank per
//       line). Secondary (lowercase) lines are 0.82 of the title on notices, 0.72 on 2-line
//       signs (sizes:[...] overrides, relative to `size`), painted in paint2 (mint; = paint
//       on coloured boards). 'arrow': one board cut to a point toward arrowDir (multi-line ok).
//       'board': every line on one board. Signs wider than 210 get two posts.
//     w/h optional: auto-sized from the text when omitted, else the text is fitted.
//     paint = title colour ('#FFF4DA'); board = paint colour for the whole board (e.g.
//     '#D9473C'), default natural wood. glyph:true (1 line) adds a painted arrow toward
//     arrowDir. drive 0..1: how far the stake is hammered in (0 → board ~28 units higher).
//     drips 0..1: opt-in paint drips (close-ups). burn 0..1: char creeps up from the bottom
//     behind a glowing ember front, letters blacken (uses t). The FIRE is world-up whatever
//     the sign's rot / flip / signWobble: separate licking flames of uneven height and phase
//     below ≈.55, merging into a continuous flame sheet with flickering tongues above it;
//     smoke starts at the flame tips, dark and dense near the source, billowing, merging and
//     drifting with noise (smokeWind=0.35 leans it right; negative = left); embers rise.
//     highlight = line index (e.g. 2 → '2. Say goodbye' for Gerald's glance), highlightK 0..1
//     wipes in a painted underline + a warm wash behind that line.
//     Tested texts: 'EXIT', 'EVACUATION ROUTE', 'NO, REALLY. THIS WAY.', 'YES, YOU, SUNNY',
//     'SNOOZE SPRINGS / No Worries Allowed', 'SNOOZE SPRINGS 2 / Barry Approved',
//     'S.S. TOLD YOU SO', lines:['SPRING RULES','1. Introduce yourself','2. Say goodbye',
//     '3. No vultures on heads'] (rule text ≈8.6 design px tall at the kit's scale .42).
// signLayout(o) → {w, h, lines, sizes, groups, ...} (unscaled)
// signAnchors(o) → {top (Gerald lands here), center, ground, left, right, w, h,
//                   lines: [{text, x, y, w, h, size}] (centre + extent of each painted line)}
// signWobble(dt, amp=0.08) → rot (radians) of a sign hit dt seconds ago (damped wobble).
// drawRaft(ctx, {x, y, scale=1, t, flip, layer='both'|'back'|'front', flagText='S.S. TOLD
//                YOU SO', flagShow, flagPerch, build=1, buildDur=1.3, bob=0, rock=0, wind=0.6,
//                flagDir=1, paddle=true, wake=0, dir=-1, wet, submerge, waterY, cache=true,
//                grade|light, alpha})
//     Reed-bundle raft: 3 lashed bundles with upturned tips (the near one rides ~1/3 under
//     water), rope lashings, a bamboo mast with stays and a swallowtail banner painted with
//     flagText, a steering oar at the stern (the end opposite `dir`).
//     Origin = centre at the WATERLINE; hull ≈388 long (tips at x ±194, deck y ≈ -42), mast top
//     ≈272 above the waterline, banner ≈250 long streaming from the mast top (scale 1).
//     LAYERS for passengers: draw layer:'back' (wake, rear bundles, oar, mast, stays, banner)
//       → the passengers with their ground (capyAnchors(o).ground) on raftAnchors(o).sits[i]
//       → layer:'front' (front bundle, its lashings + knots, waterline foam, bow foam). The
//       front bundle hides their bottoms/feet so they sit IN the raft. 'both' = the old order.
//     build 0..1 assembles it for the montage: bundles drop in one by one (0-0.42, opaque),
//       lashings wrap (0.42-0.7), mast rises (0.7-0.82), banner unfurls (0.82-0.95), oar
//       (0.95-1). AFLOAT (bob > 0 or waterY — the moored montage raft) each bundle falls INTO
//       the river: it smacks in with a long splash (buildDur = seconds build 0→1 takes, for the
//       splash timing; all splashes are over by build 1), dips under and settles, and floats at
//       its own depth at once — its own submerged tint, foam line and ripples ramp in over ≈4
//       frames as it lands (the back bundles' are then hidden by the nearer ones). The hull
//       switches to the cached bitmap at build 1 with the same rim / line weight / tint: no pop.
//       On land (bob 0, no waterY) bundles drop and bounce. s06 build_raft: build:
//       S.prog('build_raft', 1.3) on drawMooredRaft (bob .6).
//       bob 0..1 floating bob/roll (0 = on land); rock = extra roll.
//     Floating (bob > 0 or waterY): the hull below the waterline is water-tinted (submerge:false
//       disables), a foam line + lapping ripples run along the waterline. wind 0..1 banner
//       flutter; flagDir ±1 = caller-space side the banner streams to. wake 0..1 with dir ±1
//       (direction of travel): bow foam + wake lines. flagShow = number of flagText characters
//       painted (e.g. 4 → just 'S.S.').
//     flagPerch {k=1, w=48, at}: GERALD SITS ON THE BANNER (s08 gerald_covers_flag). His SEAT
//       (raftAnchors(o).flagPerch) is just past the first word 'S.S.' and is the SAME point for
//       every k — only its height follows the banner's sag as he settles — so tween him from
//       mastTop to flagPerch (k = 0: lands on the flat banner), then animate k 0→1. His weight
//       gathers the cloth into a crumple zone that grows OUTWARD from his feet (opaque pleats
//       swallow the letters; the rest stays flat and readable and slides toward him) until all
//       of 'TOLD YOU SO' is a pile ≈w wide under him and the banner reads 'S.S.'. Draw him after
//       the raft with scale raftAnchors(o).geraldScale (lab sheets 'flag_perch', 'gag_flag').
//     Static hull layers are cached as bitmaps per device resolution (cache:false = live).
// raftAnchors(o) → {seats:[4 deck points, stern→bow] (deck top, y -42), sits:[4 points]
//                   (passenger ground for the layer sandwich, y = RAFT.sitY), deck,
//                   mastTop (Gerald perches), flag (banner centre), flagWords:[{text,x,y,w,h}],
//                   flagCover ({x,y,w,h} over 'TOLD YOU SO'; with o.flagPerch its bottom-centre
//                   IS the seat for every k — kit on:'flag' stays put), flagPerch ({x, y, angle,
//                   w (current crumple width), k, geraldScale} — ALWAYS returned, k = 0 too),
//                   geraldScale (Gerald matching the passengers ≈ .62 × raft scale),
//                   tipL, tipR, waterline, angle, sitY, seatY, scale} in caller space (bob/rock
//                   included). Pass the same o.
// drawBackpack(ctx, {x, y, scale=1, rot, flip, open=0})
//     Barry's teal go-bag with a bedroll strapped under it and a first-aid patch.
//     Origin = bottom centre (≈72 wide × 100 tall). open 0..1 flips the flap up/back and shows
//     the mouth. backpackAnchors(o) → {mouth (items fly in here), top, bottom, strap}.
// drawHammer(ctx, {x, y, scale=1, rot, flip})        origin = grip (paw); head up, face → right.
//     hammerAnchors(o) → {face, head, grip, butt}. Swing by animating rot about the grip.
// drawSuitcase(ctx, {x, y, scale=1, rot, flip, color, sticker=true})
//     tiny leather suitcase; origin = top of the handle (hangs from a fin/paw), ≈44×38.
// drawRock(ctx, {x, y, r=20, glow=0, rot, trail=0, dir=π/2, t, seed, waterY, grade|light})
//     volcanic rock. glow 0..1 → glowing cracks + red-hot tint + halo. trail 0..1 → fiery
//     streak + smoke behind it, opposite to dir (= direction of travel, default falling down).
//     Below ~30 device px it draws a lighter version (3 puffs, one streak, no vesicles).
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
//     (all of the above also take grade|light and alpha)
// drawSweatDrop(ctx, {x, y, r=6, rot, alpha})         tip up (before rot).
// drawMotionLines(ctx, {x, y, angle=0, len=70, count=4, spread=44, gap=14, width=3.2,
//                       color='#FFFFFF', alpha=0.9, t, seed, arc})
//     speed lines trailing behind (x,y) for an object moving toward `angle`.
//     arc:{r, a0, a1} instead draws swoosh arcs around (x,y) for a swing from a0 to a1.
// drawStars(ctx, {x, y, r=34, t, count=4, size=9, tilt=0.34, speed=1.4, layer='both'})
//     dizzy stars orbiting (x,y). layer 'back' / 'front' lets you sandwich a head.
// drawZzz(ctx, {x, y, t, scale=1, count=3, period=2.6, color, line})  rising Z's.
// drawSteamPuff(ctx, {x, y, r=20, life, t, seed, alpha=0.9, rise=1, grade|light})
// drawSmokePuff(ctx, {x, y, r=24, life, t, seed, alpha=1, rise=1,
//                     tone='grey'|'dark'|'dust'|'white'|'soot', grade|light})
//     cartoon cloud puffs. life 0..1 = age (grows, rises, fades AS ONE LAYER); omit for a
//     static puff. 'dust' for scramble/launch puffs, 'dark' for volcanic smoke.
// drawWaterSplash(ctx, {x, y, r=24, t, seed, big=false, w=0, part='both', alpha, grade, water,
//                       colors})
//     water crown + droplets + ripple rings where something drops in; (x,y) = entry point on
//     the surface, t = seconds since entry (done by ~1.4 s). The water is SEE-THROUGH: a
//     translucent crown (whitewater at the crest, clear at the surface — the water behind
//     shows through) with white foam rims and teardrop foam tips, no dark outline; foam stays
//     near-white under every grade. big:true adds a Worthington jet: thick at the base,
//     tapering, swelling a drop at its tip and pinching off 3 teardrops that sail up and fall
//     back in (raft launch, big plops). w = half-length of a LONG entry (a reed bundle, the
//     raft): crown, foam and rings stretch into a stadium. part 'back' | 'front' splits it
//     around an object sitting in the splash (far wall + foam + jet behind, near wall +
//     droplets in front). Orange plop ≈ r 16-22; falling rock ≈ r 26-34. grade picks the water
//     palette of the setting; colors (or water) overrides it.
// drawImpactBurst(ctx, {x, y, r=56, text='BONK!', t, rot=-0.08, seed, grade|light})
//     comic starburst; t = seconds since impact: the HIT FRAME (t < 1/24, the bonk sfx frame)
//     is the peak (1.18× overshoot), it settles with a quick damped wobble, holds, then
//     squashes to nothing over 0.55-0.68 s (3 frames, no fade); omit t for a static burst.
// drawSpeechBubble(ctx, {x, y, text, w=240, size=22, to:{x,y}, style='speech'|'thought'|'shout'})
//     (x,y) = bubble centre; tail points at `to`. Returns {w, h}.
// PROP_COLORS — shared palette.   RAFT — raft geometry constants.   GRADES — light + water
// palettes per setting.
// lab — sheets (node src/lab.js props <sheet> out.png [--frames 8 --dt 0.1]):
//     all, orange (smash, bounce, splat, worn vs loose squashed), thermometer, thermo_pop
//     (--frames 12 --dt 0.0417 --t 0.95: the pop at 24 fps, in air / top / under water),
//     thermo_check (reading:'auto' creep, --frames 8 --dt 0.2), raft (build stages),
//     raft_build (moored in the river at 24 fps: --frames 16 --dt 0.0417), raft_context
//     (layer sandwich with the real cast), gag_flag (Gerald covers the flag), flag_perch
//     (k 0 → 1 with the seat point), signs, burn (world-up fire on tilted / flipped / wobbling
//     signs), rules (SPRING RULES at trio scale + highlight + line anchors), signs_env (env's
//     sign beside props signs; arrow text), fx, dupes (worn vs loose at the same scale),
//     grades (lighting + water per setting), closeup, context, context_erupt
'use strict';

const U = require('./util');
const { Path2D } = require('@napi-rs/canvas');
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
  red: '#E2382F', glass: '#6E8494', paint: '#FFF4DA', paint2: '#C4F2E6', rope: '#D2A562', ropeLine: '#7A5428',
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
  stops.forEach((s, i) => (Array.isArray(s) ? g.addColorStop(s[0], tc(s[1])) : g.addColorStop(n === 1 ? 0 : i / (n - 1), tc(s))));
  return g;
}
// Fill a shape with the character "paint" look: rim highlight crescent (hi colour peeking
// out where the offset gradient body doesn't cover), optional shade overlay, extra details
// clipped inside, then a thin darker outline.
function paint(ctx, path, o) {
  const { fill, rim, shadow, line, lw = 1.6, extra } = o;
  let hi = o.hi;
  // lit scene: the rim crescent picks up the scene's rim-light colour
  if (RIM && typeof hi === 'string' && hi[0] === '#') hi = mix(hi, RIM, 0.55);
  hi = tc(hi);
  ctx.save();
  path();
  ctx.clip();
  if (hi) { ctx.fillStyle = hi; ctx.fillRect(-3000, -3000, 6000, 6000); }
  ctx.save();
  if (hi && rim) ctx.translate(rim[0], rim[1]);
  ctx.fillStyle = tc(fill);
  path();
  ctx.fill();
  ctx.restore();
  if (shadow) { ctx.fillStyle = shadow; ctx.fillRect(-3000, -3000, 6000, 6000); }
  if (extra) extra();
  ctx.restore();
  if (line) {
    path();
    ctx.strokeStyle = tc(line);
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
  // small on screen: one run per pass (the per-letter hand-painted wobble is invisible there)
  if (!drips && !sp && o.batch !== false && size * devScale(ctx) < 34) {
    if (shadow) { ctx.fillStyle = tc(shadow); ctx.fillText(text, size * shOff[0], size * shOff[1]); }
    if (outline) { ctx.strokeStyle = tc(outline); ctx.lineWidth = outlineW; ctx.lineJoin = 'round'; ctx.strokeText(text, 0, 0); }
    ctx.fillStyle = tc(color);
    ctx.fillText(text, 0, 0);
    ctx.restore();
    return w * sx;
  }
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
    ctx.fillStyle = tc(shadow);
    pass((ch, cw, i) => { ctx.fillText(ch, size * shOff[0], size * shOff[1]); drip(ch, cw, i, size * shOff[0], size * shOff[1]); });
  }
  if (outline) {
    ctx.strokeStyle = tc(outline); ctx.lineWidth = outlineW; ctx.lineJoin = 'round';
    pass((ch) => ctx.strokeText(ch, 0, 0));
  }
  ctx.fillStyle = tc(color);
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

// batched flames: [{x, y, h, w, seed, a}] → 4 fills total (one per colour layer)
function flames(ctx, list, t) {
  if (!list.length) return;
  const cols = [['#F2471C', 0.9, 1, 0], ['#FF8A22', 1, 0.74, 0], ['#FFC73F', 1, 0.5, 0.02], ['#FFF4C8', 1, 0.26, 0.03]];
  // alpha buckets: most flames are fully opaque; the rest share a bucket per 0.25
  const buckets = new Map();
  for (const f of list) {
    if (f.h < 0.5 || f.a <= 0) continue;
    const q = Math.min(1, Math.ceil(f.a * 4) / 4);
    (buckets.get(q) || buckets.set(q, []).get(q)).push(f);
  }
  for (const [qa, fl] of buckets) {
    for (const [col, ca, sc, lift] of cols) {
      ctx.beginPath();
      for (const { x, y, h, w, seed } of fl) {
        const fr = 0.8 + 0.28 * noise1(t * 9 + seed * 3.1);
        const H = h * fr, sway = noise1(t * 4.3 + seed * 1.7) * w * 0.5;
        const hw = w * 0.5 * sc, hh = H * sc, yb = y - h * lift;
        ctx.moveTo(x - hw, yb);
        ctx.bezierCurveTo(x - hw * 1.15, yb - hh * 0.42, x + sway * 0.35 - hw * 0.4, yb - hh * 0.72, x + sway, yb - hh);
        ctx.bezierCurveTo(x + sway * 0.35 + hw * 0.5, yb - hh * 0.66, x + hw * 1.15, yb - hh * 0.4, x + hw, yb);
        ctx.quadraticCurveTo(x, yb + hw * 0.7, x - hw, yb);
        ctx.closePath();
      }
      ctx.fillStyle = rgba(col, ca * qa);
      ctx.fill();
    }
  }
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
function puff(ctx, x, y, r, seed, pal, a = 1, lw = 1.4, churn = 0, single = false) {
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
  if (single) {
    // ONE union fill (cheap; fades cleanly)
    ctx.globalAlpha = ga * a;
    path();
    const g1 = ctx.createLinearGradient(0, y - r * 0.55, 0, y + r * 0.6);
    g1.addColorStop(0, tc(pal.light));
    g1.addColorStop(0.5, tc(pal.base));
    g1.addColorStop(1, tc(pal.dark));
    ctx.fillStyle = g1;
    ctx.fill();
    ctx.restore();
    return;
  }
  // outline = the union inflated by the line width, drawn under the body
  ctx.globalAlpha = ga * a * a;
  path(1, 0, 0, 0, cs.length, lw);
  ctx.fillStyle = tc(pal.line);
  ctx.fill();
  // body: one gradient fill (lit top → shaded bottom); no clip needed (cheap)
  ctx.globalAlpha = ga * a;
  path();
  const g = ctx.createLinearGradient(0, y - r * 0.55, 0, y + r * 0.6);
  g.addColorStop(0, tc(pal.base));
  g.addColorStop(0.55, tc(pal.base));
  g.addColorStop(1, tc(pal.dark));
  ctx.fillStyle = g;
  ctx.fill();
  // highlight lobes: the upper circles shrunk + nudged up-left, always inside the body
  path(0.6, -r * 0.05, -r * 0.085, 1, 8);
  ctx.fillStyle = tc(RIM ? mix(pal.light, RIM, 0.3) : pal.light);
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

// ───────────────────────────────────────────────────────────── device scale / LOD
// device pixels per local unit for the current transform (LOD decisions: a prop's on-screen
// size = its size × devScale(ctx), so camera zoom and the 1080p output scale are included)
function devScale(ctx) {
  const m = ctx.getTransform();
  return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
}

// ───────────────────────────────────────────────────────────── light / grade
// Shared lighting so props sit in the same light as the characters (same format as the
// scene kit's lightFor(): {tint:{color, amount}, rim}). grade presets mirror the env palettes.
// water = the palette used for submerged tints, contact ripples and drawWaterSplash.
const WATER_DEF = { top: '#C9F4EE', mid: '#7FDCDC', base: '#5CC9C9', deep: '#2E8F9E', line: '#2A7F8C', foam: '#FFFFFF' };
const GRADES = {
  day: { light: null, water: WATER_DEF },
  gold: {
    light: { tint: { color: '#FFAA66', amount: 0.12 }, rim: '#FFD08A' },
    water: { top: '#FFECC6', mid: '#A9D2C2', base: '#87C6BB', deep: '#2F6F87', line: '#2C6576', foam: '#FFF4DE' },
  },
  dusk: {
    light: { tint: { color: '#B07AA8', amount: 0.18 }, rim: '#F0A0C0' },
    water: { top: '#FFD2C8', mid: '#9AA6C4', base: '#7593B1', deep: '#304B73', line: '#2C3F66', foam: '#FFE6E2' },
  },
  erupt: {
    light: { tint: { color: '#FF5A2A', amount: 0.24 }, rim: '#FF8A3A' },
    water: { top: '#FFC49A', mid: '#8A8478', base: '#5E7470', deep: '#22394A', line: '#2A2C30', foam: '#FFD8B8' },
  },
  sunset: {
    light: { tint: { color: '#E07A86', amount: 0.17 }, rim: '#FFB27A' },
    water: { top: '#FFD6B0', mid: '#C77A86', base: '#A65E80', deep: '#5A3870', line: '#4A2C5E', foam: '#FFE2C8' },
  },
  office: { light: { tint: { color: '#FFC07A', amount: 0.06 }, rim: '#FFE2B8' }, water: WATER_DEF },
  new: {
    light: { tint: { color: '#FFF0C0', amount: 0.04 }, rim: '#FFF4D8' },
    water: { top: '#E6FFFB', mid: '#9CE8E0', base: '#6CD9D3', deep: '#2C92A6', line: '#2A8296', foam: '#FFFFFF' },
  },
};
GRADES.evening = GRADES.gold; GRADES.spring_evening = GRADES.gold; GRADES.spring_day = GRADES.day;
GRADES.eruption = GRADES.erupt; GRADES.river_sunset = GRADES.sunset; GRADES.therapy_office = GRADES.office;
GRADES.new_spring = GRADES.new;
// resolve o.light / o.tint+o.rim / o.grade → {tint, rim} | null
function lightOf(o) {
  if (!o) return null;
  if (o.light === false) return null;
  if (o.light && (o.light.tint || o.light.rim)) return o.light;
  if (o.tint && o.tint.color) return { tint: o.tint, rim: o.rim || null };
  const G = o.grade && GRADES[o.grade];
  return G ? G.light : null;
}
// submerged tint when the caller gave neither grade nor water palette: a neutral cool shade
// that reads as "under water" over any water colour (day cyan, sunset pink, lava murk)
const WATER_NEUTRAL = { top: '#EAF4F2', mid: '#5E8C92', base: '#3C6670', deep: '#2A4250', line: '#2A4650', foam: '#FFFFFF', neutral: true };
function subPal(o) { return o && (o.grade || o.water) ? waterPal(o) : WATER_NEUTRAL; }
// water palette for a prop: o.water (palette object, merged over the grade's) | grade | day
function waterPal(o) {
  const G = (o && o.grade && GRADES[o.grade]) || GRADES.day;
  const base = G.water || WATER_DEF;
  return o && o.water && typeof o.water === 'object' ? { ...base, ...o.water } : base;
}
// module-level light while a lit prop is drawing (set/reset by withLight; never leaks out of
// a call). RIM: paint()'s rim crescent picks up the rim colour. TINT ("vector" mode, used by the
// big props: raft, signs, rocks): colours are mixed with the tint as they are set — lin()
// stops, paint() colours and tc(...) — so no offscreen layer is needed.
let RIM = null, TINT = null;
const _tcCache = new Map();
function tc(c) {
  if (!TINT || typeof c !== 'string') return c;
  const key = c + '|' + TINT.color + '|' + TINT.amount;
  let v = _tcCache.get(key);
  if (v !== undefined) return v;
  const a = clamp(TINT.amount);
  if (c[0] === '#') v = mix(c, TINT.color, a);
  else {
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (m) {
      const p = m[1].split(',').map(Number), T = U.hexToRgb(TINT.color);
      v = `rgba(${Math.round(lerp(p[0], T[0], a))},${Math.round(lerp(p[1], T[1], a))},${Math.round(lerp(p[2], T[2], a))},${p.length > 3 ? p[3] : 1})`;
    } else v = c;
  }
  if (_tcCache.size > 4000) _tcCache.clear();
  _tcCache.set(key, v);
  return v;
}
function withLight(o, fn, vector = false) {
  const L = lightOf(o);
  const pr = RIM, pt = TINT;
  RIM = L && L.rim ? L.rim : null;
  if (vector) TINT = L && L.tint && L.tint.amount > 0 ? L.tint : null;
  try { return fn(vector && L ? { ...L, tint: null } : L); } finally { RIM = pr; TINT = pt; }
}

// ───────────────────────────────────────────────────────────── offscreen layer
// Draws fn(ctx2) into a scratch canvas (same transform, cropped to the device-space bbox of
// `box` = [x0, y0, x1, y1] in the CURRENT space), applies post effects to the drawn pixels
// only, then blits it back in one go:
//   fx.tint {color, amount}   colour mix over everything drawn (lighting)
//   fx.water {y, pal, a0, a1, depth}   submerged tint below the horizontal line y (current
//                             space): water colour from a0 at the surface to a1 at y + depth
//   fx.alpha                  whole-layer opacity — a multi-layer shape fades as ONE layer
//                             (no see-through outlines / overlaps)
// Fully off-canvas → nothing is drawn (free culling). Scratch canvases are reused per nesting
// depth; every call clears what it uses, so output stays a pure function of the inputs.
// Scratch canvases come from a small pool bucketed by size (a canvas is snapshotted when it is
// blitted, and the copy costs ~5 ns per pixel of the WHOLE canvas, so they must fit tightly).
const _scrPool = new Map();
let _scrDepth = 0;
function scratchCanvas(w, h) {
  const W = Math.ceil(w / 48) * 48, H = Math.ceil(h / 48) * 48;
  const key = _scrDepth + ':' + W + 'x' + H;
  let s = _scrPool.get(key);
  if (s) { _scrPool.delete(key); _scrPool.set(key, s); return s; }
  const { createCanvas } = require('@napi-rs/canvas');
  const c = createCanvas(W, H);
  s = { c, x: c.getContext('2d'), px: W * H };
  _scrPool.set(key, s);
  // bounded memory: ≤ 24 canvases and ≤ ~12 Mpx (≈48 MB) in total, least recently used first
  let tot = 0;
  for (const v of _scrPool.values()) tot += v.px;
  while (_scrPool.size > 1 && (_scrPool.size > 24 || tot > 12e6)) {
    const k0 = _scrPool.keys().next().value;
    tot -= _scrPool.get(k0).px;
    _scrPool.delete(k0);
  }
  return s;
}
function offscreen(ctx, box, fx, fn) {
  const m = ctx.getTransform();
  let X0 = Infinity, Y0 = Infinity, X1 = -Infinity, Y1 = -Infinity;
  for (const [px, py] of [[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]]) {
    const dx = m.a * px + m.c * py + m.e, dy = m.b * px + m.d * py + m.f;
    if (dx < X0) X0 = dx; if (dx > X1) X1 = dx; if (dy < Y0) Y0 = dy; if (dy > Y1) Y1 = dy;
  }
  const cw = (ctx.canvas && ctx.canvas.width) || 4096, ch = (ctx.canvas && ctx.canvas.height) || 4096;
  const x0 = Math.max(0, Math.floor(X0) - 2), y0 = Math.max(0, Math.floor(Y0) - 2);
  const x1 = Math.min(cw, Math.ceil(X1) + 2), y1 = Math.min(ch, Math.ceil(Y1) + 2);
  if (!(x1 > x0 && y1 > y0)) return;
  const w = x1 - x0, h = y1 - y0;
  const S = scratchCanvas(w, h), s = S.x;
  _scrDepth++;
  try {
    s.save();
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalCompositeOperation = 'source-over';
    s.globalAlpha = 1;
    s.clearRect(0, 0, w, h);
    s.setTransform(m.a, m.b, m.c, m.d, m.e - x0, m.f - y0);
    fn(s);
    s.globalCompositeOperation = 'source-atop';
    s.globalAlpha = 1;
    if (fx.tint && fx.tint.amount > 0) {
      s.fillStyle = rgba(fx.tint.color, clamp(fx.tint.amount));
      s.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
    }
    if (fx.water && fx.water.y < box[3]) {
      const W = fx.water, P = W.pal || WATER_DEF, dep = W.depth || 30;
      const g = s.createLinearGradient(0, W.y, 0, W.y + dep);
      g.addColorStop(0, rgba(P.base, W.a0 != null ? W.a0 : 0.42));
      g.addColorStop(1, rgba(P.deep, W.a1 != null ? W.a1 : 0.8));
      s.fillStyle = g;
      const yy = Math.max(W.y, box[1]);
      s.fillRect(box[0], yy, box[2] - box[0], box[3] - yy);
    }
    s.restore();
  } finally { _scrDepth--; }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (fx.alpha != null && fx.alpha < 1) ctx.globalAlpha *= clamp(fx.alpha);
  ctx.drawImage(S.c, 0, 0, w, h, x0, y0, w, h);
  ctx.restore();
}
// run fn either directly or through an offscreen layer when lighting / water / a whole-layer
// fade is requested. box = bbox in the CURRENT space.
function layered(ctx, box, fx, fn) {
  const tinted = fx.tint && fx.tint.amount > 0, faded = fx.alpha != null && fx.alpha < 1;
  if (faded && fx.alpha <= 0.003) return;
  if (!tinted && !faded && fx.water) {
    // water only: draw normally, then overdraw just the submerged band tinted (cheap: the
    // offscreen layer covers only the band below the waterline)
    fn(ctx);
    if (fx.water.y < box[3]) offscreen(ctx, [box[0], Math.max(box[1], fx.water.y), box[2], box[3]], { water: fx.water }, fn);
    return;
  }
  if (!tinted && !faded) { fn(ctx); return; }
  offscreen(ctx, box, fx, fn);
}
// standard wrapper for a public draw function: lighting (o.light / o.grade / o.tint) and
// whole-layer alpha (o.alpha) through one offscreen layer; otherwise draws directly.
function fxWrap(ctx, o, box, body) {
  withLight(o, (L) => {
    const fx = {};
    if (L && L.tint) fx.tint = L.tint;
    if (o.alpha != null && o.alpha < 1) fx.alpha = o.alpha;
    layered(ctx, box, fx, body);
  });
}
// submerged-prop helpers: contact meniscus + animated ripple rings at the waterline (same style
// as env waterlineRipple: thin perspective ellipses, back half then front half)
function waterContact(ctx, x, wy, hw, t, pal, k = 1, amp = 1, part = 'both', opt = {}) {
  if (hw <= 0.3) return;
  const ryK = opt.ryK || 0.2, men = opt.meniscus !== false, spread = opt.spread || 1.3;
  const P = pal || WATER_DEF;
  ctx.save();
  ctx.lineCap = 'round';
  const sc = clamp(hw / 40, 0.35, 1.6);
  for (let i = 0; i < 3; i++) {
    const q = frac(t * 0.5 + i / 3);
    const rx = hw * 1.05 + 2 + q * Math.min(hw, opt.maxSpread || 1e9) * spread * amp;
    const ry = rx * ryK;
    const a = (1 - q) * Math.min(1, q * 5) * 0.65 * Math.min(1, amp);
    if (a <= 0.01) continue;
    ctx.strokeStyle = rgba(P.foam, a);
    ctx.lineWidth = (1 + 1.3 * (1 - q)) * sc * k;
    ctx.beginPath();
    if (part !== 'front') ctx.ellipse(x, wy, rx, ry, 0, PI + 0.1, TAU - 0.1);
    if (part !== 'back') { ctx.moveTo(x + rx * Math.cos(0.1), wy + ry * Math.sin(0.1)); ctx.ellipse(x, wy, rx, ry, 0, 0.1, PI - 0.1); }
    ctx.stroke();
  }
  // meniscus: a bright lip hugging the prop where it pierces the surface
  if (!men) { ctx.restore(); return; }
  ctx.beginPath();
  ctx.ellipse(x, wy, hw + 1.2 * sc, Math.max(0.8, hw * 0.16), 0, 0, PI);
  ctx.strokeStyle = rgba(P.foam, 0.85);
  ctx.lineWidth = 1.6 * sc * k;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, wy, hw + 0.4 * sc, Math.max(0.6, hw * 0.12), 0, PI, TAU);
  ctx.strokeStyle = rgba(P.top, 0.6);
  ctx.lineWidth = 1 * sc * k;
  ctx.stroke();
  ctx.restore();
}
// fx object for a prop: lighting + optional water line (caller space)
function propFx(o, L, waterBox) {
  const fx = {};
  if (L && L.tint) fx.tint = L.tint;
  if (o.waterY != null && waterBox !== false) {
    const pal = subPal(o);
    fx.water = { y: o.waterY, pal, a0: o.waterAlpha != null ? o.waterAlpha : pal.neutral ? 0.34 : 0.42, a1: pal.neutral ? 0.62 : 0.78, depth: o.waterDepth || 26 };
  }
  if (o.alpha != null && o.alpha < 1) fx.alpha = o.alpha;
  return fx;
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

// The round orange IS the capybara rig's head orange (capybara.drawCapyOrange) so a loose
// orange and a worn one are the same object. Below ~24 device px a faithful port is used
// instead (identical art minus the sub-pixel pores: ~4x cheaper for orange rain).
// rig art, centred at (0,0), radius R; lk = line-weight factor (the rig's LWK)
function orangeArt(ctx, R, t, seed, lk, pores) {
  orangeBody(ctx, R, seed, lk, pores);
  orangeStemLeaf(ctx, R, t, seed, lk);
}
// the round body (peel, pores, shading, highlight, outline) — no stem / leaf
function orangeBody(ctx, R, seed, lk, pores, gloss = 1, noLine = false, poreA = 1) {
  circle(ctx, 0, 0, R);
  const g = ctx.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R * 1.05);
  g.addColorStop(0, '#FFC867');
  g.addColorStop(0.45, '#FF9A1F');
  g.addColorStop(1, '#E06F0C');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (pores) {
    const rr = rng(7 + (seed || 0));
    ctx.beginPath();
    for (let i = 0; i < 18; i++) {
      const a = rr() * TAU, d = Math.sqrt(rr()) * R * 0.92;
      const px = Math.cos(a) * d, py = Math.sin(a) * d;
      ctx.moveTo(px + R * 0.045, py);
      ctx.arc(px, py, R * 0.045, 0, TAU);
    }
    ctx.fillStyle = `rgba(190,85,10,${0.32 * poreA})`;
    ctx.fill();
  }
  const sg = ctx.createLinearGradient(-R, -R, R * 0.6, R);
  sg.addColorStop(0.5, 'rgba(170,60,0,0)');
  sg.addColorStop(1, 'rgba(170,60,0,0.32)');
  ctx.fillStyle = sg;
  ctx.fillRect(-R, -R, 2 * R, 2 * R);
  ctx.restore();
  ellipse(ctx, -R * 0.38, -R * 0.42, R * 0.3, R * 0.17, -0.6);
  ctx.fillStyle = `rgba(255,250,230,${0.78 * gloss})`;
  ctx.fill();
  circle(ctx, -R * 0.06, -R * 0.64, R * 0.065);
  ctx.fill();
  if (noLine) return;
  circle(ctx, 0, 0, R);
  ctx.strokeStyle = '#B85A0A';
  ctx.lineWidth = 1.8 * lk;
  ctx.stroke();
}
function orangeStemLeaf(ctx, R, t, seed, lk, ang = -0.5) {
  ctx.fillStyle = '#6B5A2A';
  circle(ctx, R * 0.05, -R * 0.97, R * 0.1);
  ctx.fill();
  ctx.save();
  ctx.translate(R * 0.1, -R * 0.98);
  rigLeaf(ctx, R, ang + Math.sin(t * 1.7 + (seed || 0)) * 0.06, lk);
  ctx.restore();
}
// the rig's leaf (origin = stem), angle a
function rigLeaf(ctx, R, a, lk) {
  ctx.save();
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(R * 0.35, -R * 0.58, R * 0.98, -R * 0.36);
  ctx.quadraticCurveTo(R * 0.5, R * 0.12, 0, 0);
  ctx.closePath();
  const lg = ctx.createLinearGradient(0, -R * 0.5, R, 0);
  lg.addColorStop(0, '#86CF6C');
  lg.addColorStop(1, '#3E8E44');
  ctx.fillStyle = lg;
  ctx.fill();
  ctx.strokeStyle = '#2F6B35';
  ctx.lineWidth = 1.2 * lk;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(R * 0.05, -R * 0.03);
  ctx.quadraticCurveTo(R * 0.45, -R * 0.3, R * 0.85, -R * 0.34);
  ctx.strokeStyle = 'rgba(220,255,200,0.6)';
  ctx.lineWidth = 0.9 * lk;
  ctx.stroke();
  ctx.restore();
}
// the rig's line-weight factor for an orange of radius r (caller units)
const orangeLK = (r) => clamp(Math.pow(Math.max(0.05, r / 18 / 0.9), -0.33), 0.62, 1.6);

// SQUASH 0..1 — a smashed fruit, not a slice: the orange flattens on impact (0-0.2), the peel
// tears open in uneven flaps (0.15-0.55) and lumpy pulp with loose segment chunks bulges out,
// juice pools; 0.55-1 keeps slumping, flattening and spreading. Body ≤ 1.3× the orange's width.
// The leaf stays on a peel flap. Drawn in units of r around the orange centre; base at y = r.
function squashedOrange(ctx, r, s, t, seed, lk, leaf, pores = true) {
  const C = PROP_COLORS.orange;
  const e1 = ease.outCubic(clamp(s / 0.45));
  const e2 = smoothstep(0.45, 1, s);
  const tear = smoothstep(0.12, 0.5, s);
  const rx = r * (1 + 0.14 * e1 + 0.12 * e2);                 // cup half-width ≤ 1.26 r
  const H = r * 2 * (1 - 0.42 * e1 - 0.2 * e2);                // silhouette height (2r → 0.76r)
  const ryBot = Math.min(H * 0.5, r * (1 - 0.35 * e1 - 0.15 * e2));
  const cy = r - ryBot;                                         // ellipse centre
  const ryTop = H - ryBot;
  const R = rng(seed * 7.7 + 3);
  // ---- juice puddle
  if (s > 0.08) {
    const pa = smoothstep(0.08, 0.7, s) + 0.25 * e2;
    juicePuddle(ctx, 0, r - 0.5, rx * (0.9 + 0.5 * pa), r * (0.08 + 0.12 * pa), seed + 1, Math.min(1, pa), lk);
  }
  // tear line: the cup's top edge drops as it tears (uneven, seeded)
  const tearY = cy - ryTop * (1 - 0.95 * tear);
  const nJ = 9;
  const jag = [];
  for (let i = 0; i <= nJ; i++) {
    const u = i / nJ;
    const xx = lerp(-rx * 0.96, rx * 0.96, u);
    // follow the dome until torn, then a ragged rim
    const dome = cy - ryTop * Math.sqrt(Math.max(0, 1 - (xx / rx) ** 2));
    const rim = tearY + (i % 2 ? -1 : 1) * r * 0.09 * tear * (0.6 + 0.8 * R()) + Math.abs(u - 0.5) * r * 0.25 * tear;
    jag.push([xx, Math.max(dome, lerp(dome, rim, tear))]);
  }
  // torn peel flaps: BACK flaps stand up behind the pulp (their pale inner pith faces us),
  // FRONT flaps fold down over the cup (orange skin out). Uneven lengths, splaying as it bursts.
  const flaps = [];
  const rimY = (bx) => {
    const dome = cy - ryTop * Math.sqrt(Math.max(0, 1 - (bx / rx) ** 2));
    return lerp(dome, Math.max(dome, tearY), tear);
  };
  const BACK = [[-0.62, 0.9], [-0.1, 0.62], [0.5, 0.8]], FRONT = [[-0.78, 1], [0.12, 0.7], [0.82, 0.95]];
  BACK.forEach(([u, lk2], i) => {
    const bx = rx * u * 0.95, side = Math.sign(u) || 1;
    const len = r * (0.32 + 0.4 * lk2 * (0.8 + 0.4 * hash1(seed * 3.1 + i))) * tear;
    const open = tear * (0.5 + 0.5 * hash1(seed * 1.3 + i)) + e2 * 0.5;
    flaps.push({ bx, by: rimY(bx) + r * 0.02, a: -PI / 2 + side * (0.15 + open * 0.75) + u * 0.3, len, w: r * (0.36 + 0.1 * hash1(seed + i * 5.3)), back: true, i });
  });
  FRONT.forEach(([u, lk2], i) => {
    const bx = rx * u * 0.92, side = Math.sign(u) || 1;
    const len = r * (0.3 + 0.32 * lk2 * (0.8 + 0.4 * hash1(seed * 2.1 + i))) * tear;
    const open = tear * (0.7 + 0.3 * hash1(seed * 1.7 + i)) + e2 * 0.3;
    // starts pointing up (still closed) and folds outward + down over the cup wall
    flaps.push({ bx, by: rimY(bx) + r * 0.05, a: -PI / 2 + side * open * (1.6 + 0.5 * Math.abs(u)) + (u === 0.12 ? open * 1.1 : 0), len, w: r * (0.4 + 0.1 * hash1(seed + i * 7.1)), back: false, i: i + 3 });
  });
  const flapPath = (f) => {
    const ca = Math.cos(f.a), sa = Math.sin(f.a), nx = -sa, ny = ca;
    const tx = f.bx + ca * f.len, ty = f.by + sa * f.len;
    const hw = f.w / 2;
    const kink = (hash1(seed + f.i * 9.1) - 0.5) * f.w * 0.5;
    ctx.beginPath();
    ctx.moveTo(f.bx - nx * hw, f.by - ny * hw);
    ctx.quadraticCurveTo(f.bx + ca * f.len * 0.55 - nx * hw * 1.05 + nx * kink, f.by + sa * f.len * 0.55 - ny * hw * 1.05 + ny * kink, tx - nx * hw * 0.3, ty - ny * hw * 0.3);
    // torn ragged tip
    ctx.lineTo(tx + ca * f.w * 0.18 - nx * hw * 0.05, ty + sa * f.w * 0.18 - ny * hw * 0.05);
    ctx.lineTo(tx + ca * f.w * 0.02 + nx * hw * 0.15, ty + sa * f.w * 0.02 + ny * hw * 0.15);
    ctx.lineTo(tx + ca * f.w * 0.14 + nx * hw * 0.42, ty + sa * f.w * 0.14 + ny * hw * 0.42);
    ctx.quadraticCurveTo(f.bx + ca * f.len * 0.55 + nx * hw * 0.95 + nx * kink, f.by + sa * f.len * 0.55 + ny * hw * 0.95 + ny * kink, f.bx + nx * hw, f.by + ny * hw);
    ctx.closePath();
  };
  const drawFlap = (f) => {
    if (f.len < r * 0.05) return;
    const ca = Math.cos(f.a), sa = Math.sin(f.a);
    flapPath(f);
    if (f.back) {
      // inner side: pale pith with a thin skin rim
      ctx.fillStyle = '#F7922A';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.translate(ca * f.w * 0.04, sa * f.w * 0.04);
      ctx.scale(1, 1);
      const sh = 0.82;
      ctx.translate(f.bx * (1 - sh), f.by * (1 - sh));
      ctx.scale(sh, sh);
      flapPath(f);
      ctx.fillStyle = lin(ctx, f.bx, f.by, f.bx + ca * f.len, f.by + sa * f.len, ['#FFE7BF', '#FFF6E2']);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = lin(ctx, f.bx, f.by, f.bx + ca * f.len, f.by + sa * f.len, ['#FF9A1F', '#FFB347']);
      ctx.fill();
      // pale pith peeking along the torn tip only
      const tx = f.bx + ca * f.len, ty = f.by + sa * f.len, nx = -sa, ny = ca, hw = f.w / 2;
      ctx.save();
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(tx - nx * hw * 0.3, ty - ny * hw * 0.3);
      ctx.lineTo(tx + ca * f.w * 0.18 - nx * hw * 0.05, ty + sa * f.w * 0.18 - ny * hw * 0.05);
      ctx.lineTo(tx + ca * f.w * 0.02 + nx * hw * 0.15, ty + sa * f.w * 0.02 + ny * hw * 0.15);
      ctx.lineTo(tx + ca * f.w * 0.14 + nx * hw * 0.42, ty + sa * f.w * 0.14 + ny * hw * 0.42);
      ctx.strokeStyle = '#FFEBC4';
      ctx.lineWidth = f.w * 0.2;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }
    flapPath(f);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1.4 * lk;
    ctx.lineJoin = 'round';
    ctx.stroke();
  };
  // back flaps (behind the pulp)
  for (const f of flaps) if (f.back) drawFlap(f);
  // ---- peel cup
  const cupPath = () => {
    ctx.beginPath();
    ctx.moveTo(jag[0][0], jag[0][1]);
    for (let i = 1; i < jag.length; i++) ctx.lineTo(jag[i][0], jag[i][1]);
    ctx.ellipse(0, cy, rx, ryBot, 0, -0.02, PI + 0.02);
    ctx.closePath();
  };
  // the cup IS the round orange squashed (same gradients, pores and highlight under the same
  // scale about the base point), so the hand-off from the squash-and-stretch phase is seamless;
  // pores and the round highlight wear off as it tears
  const sxE = rx / r, syE = (ryTop + ryBot) / (2 * r);
  cupPath();
  ctx.save();
  ctx.clip();
  ctx.save();
  ctx.translate(0, r);
  ctx.scale(sxE, syE);
  ctx.translate(0, -r);
  ctx.scale(r / 18, r / 18);
  orangeBody(ctx, 18, seed, 0, pores && tear < 0.5, 1 - smoothstep(0.05, 0.45, tear), true, 1 - smoothstep(0.05, 0.5, tear));
  ctx.restore();
  // dents where it took the hit
  if (tear > 0.01) {
    ctx.beginPath();
    ctx.ellipse(0, cy + ryBot * 0.55, rx * 0.8, ryBot * 0.35, 0, PI * 1.1, PI * 1.9);
    ctx.strokeStyle = `rgba(170,70,0,${0.25 * smoothstep(0, 0.4, tear)})`;
    ctx.lineWidth = r * 0.06;
    ctx.stroke();
  }
  ctx.restore();
  // gloss survives on the lower peel
  const lg = smoothstep(0.05, 0.4, tear);
  if (lg > 0) {
    ellipse(ctx, -rx * 0.45, cy + ryBot * 0.1 - (1 - tear) * ryTop * 0.4, rx * 0.22, Math.max(0.6, ryBot * 0.12), -0.35);
    ctx.fillStyle = `rgba(255,250,230,${0.7 * lg})`;
    ctx.fill();
  }
  cupPath();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1.8 * lk;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // ---- pulp bursting out of the tear (lumpy, irregular; loose segment chunks)
  if (tear > 0.02) {
    const ph = r * (0.55 * tear - 0.25 * e2);                  // mound height above the rim
    const pw = rx * (0.78 + 0.18 * e2);
    const pts = [];
    const n = 11;
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = PI + u * PI;
      const lump = 0.78 + 0.4 * hash1(seed * 4.3 + i * 1.9);
      pts.push([Math.cos(a) * pw * (0.9 + 0.12 * hash1(seed + i)), tearY + Math.sin(a) * Math.max(r * 0.06, ph) * lump]);
    }
    pts.push([pw * 0.7, tearY + r * 0.1], [0, tearY + r * 0.16], [-pw * 0.7, tearY + r * 0.1]);
    blob(ctx, pts, 0.9);
    const pg = ctx.createLinearGradient(0, tearY - ph, 0, tearY + r * 0.15);
    pg.addColorStop(0, '#FFDC7A');
    pg.addColorStop(0.5, '#FFC04A');
    pg.addColorStop(1, '#F59A28');
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.strokeStyle = '#C8640E';
    ctx.lineWidth = 1.3 * lk;
    ctx.stroke();
    // juice-sac texture: loose elongated vesicles (no radial wedges)
    ctx.save();
    blob(ctx, pts, 0.9);
    ctx.clip();
    ctx.beginPath();
    const RV = rng(seed * 5.5 + 9);
    for (let i = 0; i < 14; i++) {
      const vx = RV.range(-pw, pw), vy = tearY - RV.range(-0.1, 1) * ph * 0.9;
      const va = RV.range(-PI, PI), vl = r * RV.range(0.07, 0.13), vw = vl * 0.38;
      ctx.moveTo(vx + Math.cos(va) * vl, vy + Math.sin(va) * vl);
      ctx.ellipse(vx, vy, vl, vw, va, 0, TAU);
    }
    ctx.fillStyle = 'rgba(255,240,190,0.6)';
    ctx.fill();
    // shadow where the pulp sinks into the cup
    ctx.fillStyle = lin(ctx, 0, tearY - r * 0.05, 0, tearY + r * 0.16, ['rgba(200,90,10,0)', 'rgba(200,90,10,0.45)']);
    ctx.fillRect(-pw - 2, tearY - r * 0.05, pw * 2 + 4, r * 0.25);
    ctx.restore();
    // two loose segment chunks tipped out at odd angles (deeper orange, pale membrane edge)
    const nc = 2;
    for (let i = 0; i < nc; i++) {
      const u = i ? 0.68 + 0.1 * hash1(seed + 2) : 0.22 + 0.1 * hash1(seed + 1);
      const cx2 = lerp(-pw * 0.8, pw * 0.8, u);
      const cy2 = tearY - ph * (0.55 + 0.25 * hash1(seed * 6.1 + i)) * Math.sin(PI * u);
      const cr = r * (0.2 + 0.05 * hash1(seed + i * 3.3)) * smoothstep(0.35, 0.85, tear);
      if (cr < r * 0.02) continue;
      ctx.save();
      ctx.translate(cx2, cy2);
      ctx.rotate((i ? 0.9 : -1.1) + (hash1(seed * 8.8 + i) - 0.5) * 0.6);
      ctx.beginPath();
      ctx.moveTo(-cr, cr * 0.25);
      ctx.quadraticCurveTo(-cr * 0.85, -cr * 0.75, 0, -cr * 0.8);
      ctx.quadraticCurveTo(cr * 0.95, -cr * 0.7, cr, cr * 0.25);
      ctx.quadraticCurveTo(0, cr * 0.55, -cr, cr * 0.25);
      ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, -cr, 0, cr * 0.5, ['#FFE48E', '#FFB640']);
      ctx.fill();
      ctx.strokeStyle = '#D9771A';
      ctx.lineWidth = 1.1 * lk;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-cr * 0.45, -cr * 0.35);
      ctx.quadraticCurveTo(0, -cr * 0.58, cr * 0.4, -cr * 0.32);
      ctx.strokeStyle = 'rgba(255,255,240,0.8)';
      ctx.lineWidth = 1 * lk;
      ctx.stroke();
      ctx.restore();
    }
    // wet glints
    ctx.fillStyle = 'rgba(255,255,240,0.85)';
    for (let i = 0; i < 3; i++) {
      const u = 0.25 + i * 0.22 + 0.06 * hash1(seed + i * 4.4);
      ellipse(ctx, lerp(-pw, pw, u), tearY - ph * 0.55 * Math.sin(PI * u) - r * 0.02, r * 0.07, r * 0.03, -0.2);
      ctx.fill();
    }
    // juice running down the peel
    for (let i = 0; i < 3; i++) {
      const dx = (i - 1) * rx * 0.55 + (hash1(seed + i) - 0.5) * r * 0.2;
      const yTop = jag[Math.round(clamp((dx / rx + 1) / 2) * nJ)][1];
      const L = r * (0.12 + 0.3 * hash1(seed * 3 + i)) * tear;
      const dr = r * 0.055 * tear + 0.25;
      dropPath(ctx, dx, yTop + L + dr, dr, 0, (L / dr) * 0.9);
      ctx.fillStyle = '#FFB13B';
      ctx.fill();
    }
  }
  // front flaps (over the pulp)
  for (const f of flaps) if (!f.back) drawFlap(f);
  // stem + leaf: from the top of the squashed dome, gliding onto a peel flap (top-left one) as it
  // tears — one continuous move, no jump
  if (leaf) {
    const f = flaps[0];
    const ca = Math.cos(f.a), sa = Math.sin(f.a);
    const w = ease.inOutSine(smoothstep(0, 0.55, tear));
    const x0 = rx * 0.1, y0 = r - 1.98 * r * syE;
    ctx.save();
    ctx.translate(lerp(x0, f.bx + ca * f.len * 0.75, w), lerp(y0, f.by + sa * f.len * 0.75, w));
    ctx.fillStyle = '#6B5A2A';
    circle(ctx, -r * 0.05, r * 0.01, r * 0.1);
    ctx.fill();
    rigLeaf(ctx, r, lerp(-0.5, f.a + 0.4, w) + Math.sin(t * 1.7 + seed) * 0.06, lk);
    ctx.restore();
  }
}
// squash below SQ_TEAR is still the whole, glossy orange — squashed about its base point exactly
// to the torn cup's silhouette (squashedOrange takes over seamlessly from there)
const SQ_TEAR = 0.12;
function squashScale(s) {
  const e1 = ease.outCubic(clamp(s / 0.45)), e2 = smoothstep(0.45, 1, s);
  return [1 + 0.14 * e1 + 0.12 * e2, 1 - 0.42 * e1 - 0.2 * e2];
}
// the round orange scaled (sx, sy) about its base point (0, r); stem + leaf ride the top unscaled
function orangeScaled(c, r, sx, sy, t, seed, lk, pores, leaf, leaves) {
  c.save();
  c.translate(0, r);
  c.scale(sx, sy);
  c.translate(0, -r);
  c.scale(r / 18, r / 18);
  orangeBody(c, 18, seed, lk, pores);
  c.restore();
  if (!leaf) return;
  c.save();
  // stem point (0.1r, -0.98r) mapped by the squash; the leaf itself is not distorted
  c.translate(0.1 * r * sx - 0.1 * r, r - 1.98 * r * sy + 0.98 * r);
  c.scale(r / 18, r / 18);
  orangeStemLeaf(c, 18, t, seed, lk);
  if (leaves > 1) {
    c.translate(18 * 0.02, -18 * 0.98);
    c.scale(-0.8, 0.8);
    rigLeaf(c, 18, -0.4 - Math.sin(t * 1.7 + seed) * 0.06, lk / 0.8);
  }
  c.restore();
}
function drawOrange(ctx, o = {}) {
  const { x = 0, y = 0, r = 16, rot = 0, t = 0, seed = 0, leaf = true } = o;
  const s = clamp(o.squash || 0);
  const b = s > 0 ? 0 : clamp(o.bounce || 0, -1, 1);
  withLight(o, (L) => {
    const reach = r * (s > 0 || b > 0 ? 1.7 : b < 0 ? 1.9 : 1.6);
    const box = [x - reach - 4, y - reach - 4, x + reach + 4, y + r * 1.3 + 4];
    const fx = propFx(o, L);
    if (fx.water) fx.water.depth = o.waterDepth || Math.max(14, r * 1.4);
    const draw = (c) => {
      c.save();
      c.translate(x, y);
      if (rot) c.rotate(rot);
      if (o.flip) c.scale(-1, 1);
      const dpx = r * devScale(c);
      const lk = orangeLK(r);
      const pores = dpx >= 24;
      if (s <= 0 && !b) {
        const rig = capRig();
        if (rig && rig.drawCapyOrange && dpx >= 24 && leaf && (o.leaves || 1) === 1) rig.drawCapyOrange(c, { x: 0, y: 0, r, t, seed });
        else {
          // faithful port of the rig art (pores dropped below ~24 px)
          c.save();
          c.scale(r / 18, r / 18);
          orangeArtNoLeaf(c, 18, t, seed, lk, pores, leaf, o.leaves || 1);
          c.restore();
        }
      } else if (s <= 0) {
        // bounce: squash (b > 0) / stretch (b < 0) about the base point — the rig's
        // drawCapyOrange squash < .5 uses the same scale (1 + .35 b, 1 - .5 b)
        orangeScaled(c, r, 1 + 0.35 * b, 1 - 0.5 * b, t, seed, lk, pores, leaf, o.leaves || 1);
      } else if (s <= SQ_TEAR) {
        // the impact: the whole orange flattens (pores + highlight kept), juice starts to pool
        const [sx, sy] = squashScale(s);
        if (s > 0.08) {
          const pa = smoothstep(0.08, 0.7, s);
          juicePuddle(c, 0, r - 0.5, r * sx * (0.9 + 0.5 * pa), r * (0.08 + 0.12 * pa), seed + 1, Math.min(1, pa), lk * (r / 18));
        }
        orangeScaled(c, r, sx, sy, t, seed, lk, pores, leaf, 1);
      } else {
        squashedOrange(c, r, s, t, seed, lk * (r / 18), leaf, pores);
      }
      c.restore();
    };
    layered(ctx, box, fx, draw);
    if (o.waterY != null) {
      const dy = o.waterY - y;
      if (Math.abs(dy) < r * 0.98) waterContact(ctx, x, o.waterY, Math.sqrt(r * r - dy * dy), t + seed, subPal(o), Math.pow(r / 16, 0.5), 0.9);
    }
  });
}
// port body with optional leaf / second leaf (leaves:2)
function orangeArtNoLeaf(ctx, R, t, seed, lk, pores, leaf, leaves) {
  if (leaf) { orangeArt(ctx, R, t, seed, lk, pores); }
  else {
    ctx.save();
    // draw the art without the leaf: clip away nothing, just skip by drawing then the stem only
    circle(ctx, 0, 0, R);
    const g = ctx.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R * 1.05);
    g.addColorStop(0, '#FFC867'); g.addColorStop(0.45, '#FF9A1F'); g.addColorStop(1, '#E06F0C');
    ctx.fillStyle = g;
    ctx.fill();
    ellipse(ctx, -R * 0.38, -R * 0.42, R * 0.3, R * 0.17, -0.6);
    ctx.fillStyle = 'rgba(255,250,230,0.78)';
    ctx.fill();
    circle(ctx, 0, 0, R);
    ctx.strokeStyle = '#B85A0A';
    ctx.lineWidth = 1.8 * lk;
    ctx.stroke();
    ctx.fillStyle = '#6B5A2A';
    circle(ctx, R * 0.05, -R * 0.97, R * 0.1);
    ctx.fill();
    ctx.restore();
  }
  if (leaf && leaves > 1) {
    ctx.save();
    ctx.translate(R * 0.02, -R * 0.98);
    ctx.scale(-0.8, 0.8);
    rigLeaf(ctx, R, -0.4 - Math.sin(t * 1.7 + seed) * 0.06, lk / 0.8);
    ctx.restore();
  }
}

// ═════════════════════════════════════════════════════════════════════ JUICE SPLAT
function drawJuiceSplat(ctx, o = {}) {
  const { x = 0, y = 0, r = 24, t = 0.15 } = o;
  if (t < 0 || t > (o.life || 1.2) + 0.05) { if (!(o.puddle && t >= 0)) return; }
  fxWrap(ctx, o, [x - r * 11, y - r * 4, x + r * 11, y + r * 12], (c) => juiceSplatBody(c, o));
}
// the wet splat shape (radius R): a lumpy body, arms that are FAT where they leave it, pinch to a
// neck and end in a round drop, two short lobes, and a few detached drops. One union path.
function juiceSplatPath(ctx, R, seed, reach = 1) {
  const Rn = rng(seed * 4.7 + 3);
  ctx.beginPath();
  // body
  const n = 14, pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = R * 0.6 * (0.86 + 0.26 * hash1(seed * 2.3 + i * 1.7));
    pts.push([Math.cos(a) * rr * 1.08, Math.sin(a) * rr * 0.9]);
  }
  ctx.moveTo((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
  for (let i = 1; i <= n; i++) {
    const p0 = pts[i % n], p1 = pts[(i + 1) % n];
    ctx.quadraticCurveTo(p0[0], p0[1], (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
  }
  ctx.closePath();
  // arms: uneven directions (hit from above: juice flies out sideways and up), uneven lengths
  // and weights — fat where they leave the body, a curved taper to a neck, a teardrop end
  const arms = [];
  const NA = 7;
  for (let i = 0; i < NA; i++) {
    const a = -PI / 2 + ((i + 0.5) / NA - 0.5) * TAU * 0.98 + Rn.range(-0.32, 0.32);
    const side = Math.abs(Math.cos(a));
    const long = Rn() < 0.6;
    const L = R * (long ? 1.05 + 0.45 * side + Rn.range(-0.1, 0.2) : Rn.range(0.72, 0.9)) * reach;
    const wb = R * (long ? Rn.range(0.17, 0.24) : Rn.range(0.24, 0.3));
    const rb = R * (long ? Rn.range(0.1, 0.15) : Rn.range(0.15, 0.19)), wn = rb * (long ? 0.55 : 0.8);
    arms.push({ a, L, wb, rb });
    const c = Math.cos(a), sn = Math.sin(a);
    const T = (px, py) => [px * c - py * sn, (px * sn + py * c) * 0.92];
    const d0 = R * 0.38, mx = d0 + (L - d0) * 0.42;
    const p0 = T(d0, -wb), q0 = T(mx, -wn * 1.05), p1 = T(L, -wn), p2 = T(L, wn), q1 = T(mx, wn * 1.05), p3 = T(d0, wb);
    ctx.moveTo(p0[0], p0[1]);
    ctx.quadraticCurveTo(q0[0], q0[1], p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.quadraticCurveTo(q1[0], q1[1], p3[0], p3[1]);
    ctx.closePath();
    const e = T(L, 0);
    ctx.moveTo(e[0] + rb, e[1]);
    ctx.arc(e[0], e[1], rb, 0, TAU);
    // a detached drop beyond some arms
    if (long && Rn() < 0.6) {
      const f = T(L + rb * Rn.range(1.9, 2.7), 0), d2 = rb * Rn.range(0.45, 0.65);
      ctx.moveTo(f[0] + d2, f[1]);
      ctx.arc(f[0], f[1], d2, 0, TAU);
    }
    arms[i].e = e;
  }
  // two short round lobes between arms
  for (let j = 0; j < 2; j++) {
    const a = arms[j * 3 + 1].a + PI / NA, rr = R * 0.2;
    const cx = Math.cos(a) * R * 0.55, cy = Math.sin(a) * R * 0.5;
    ctx.moveTo(cx + rr, cy);
    ctx.arc(cx, cy, rr, 0, TAU);
  }
  return arms;
}
function juiceSplatBody(ctx, o) {
  const { x = 0, y = 0, r = 24, t = 0.15, seed = 3, rot = 0, life = 1.2, gravity = 1 } = o;
  const C = PROP_COLORS.orange;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  const k = Math.pow(r / 24, 0.6);
  const g = 15 * r * gravity;
  if (o.puddle) {
    const pp = ease.outCubic(clamp(t / 0.3));
    juicePuddle(ctx, 0, o.floor || 0, r * (0.5 + 1.3 * pp), r * (0.12 + 0.26 * pp), seed + 7, 1, k);
  }
  // spray mist: a fast ring of tiny droplets + a soft puff (gone within ~0.14 s)
  if (t < 0.14) {
    const p = t / 0.14;
    const rr = r * (1.1 + 1.2 * p);
    const gp = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
    gp.addColorStop(0, rgba('#FFD27A', 0.5 * (1 - p)));
    gp.addColorStop(1, rgba('#FFD27A', 0));
    ctx.fillStyle = gp;
    ellipse(ctx, 0, 0, rr * 1.15, rr * 0.85);
    ctx.fill();
    ctx.beginPath();
    const RM = rng(seed * 2.9 + 7);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + RM.range(-0.15, 0.15);
      const d = r * (0.9 + RM.range(1.0, 1.6) * ease.outCubic(p));
      const dr = r * RM.range(0.025, 0.05) * (1 - p);
      if (dr < 0.15) continue;
      const px = Math.cos(a) * d * 1.15, py = Math.sin(a) * d * 0.8;
      ctx.moveTo(px + dr, py);
      ctx.arc(px, py, dr, 0, TAU);
    }
    ctx.fillStyle = '#FFB840';
    ctx.fill();
  }
  // the splat: the HIT FRAME (t < 1/24) is already the biggest (1.15 r: it covers the orange during
  // the accessory swap), it settles, then breaks up — it SHRINKS into the droplets (no fade)
  const sc = t < 1 / 24 ? 1.15 : lerp(1.15, 1.04, ease.outCubic(clamp((t - 1 / 24) / 0.06)));
  const shrink = 1 - ease.inCubic(clamp((t - 0.1) / 0.24));
  if (shrink > 0.02) {
    ctx.save();
    const R = r * sc * shrink;
    ctx.translate(0, r * 0.25 * (1 - shrink) * gravity);
    const reach = 1 + 0.12 * clamp((t - 1 / 24) / 0.08);
    // outline (outer only), then the juicy fill
    const arms = juiceSplatPath(ctx, R, seed, reach);
    ctx.strokeStyle = C.juiceLine;
    ctx.lineWidth = 2.2 * k;
    ctx.lineJoin = 'round';
    ctx.stroke();
    const gg = ctx.createRadialGradient(-R * 0.2, -R * 0.22, R * 0.05, 0, 0, R * 1.4);
    gg.addColorStop(0, '#FFC94A');
    gg.addColorStop(0.45, '#FFAA2C');
    gg.addColorStop(1, '#F58B14');
    ctx.fillStyle = gg;
    ctx.fill();
    // pulp sacs + a darker juicy core
    ctx.beginPath();
    const RV = rng(seed * 6.1 + 2);
    for (let i = 0; i < 6; i++) {
      const a = RV.range(0, TAU), d = R * RV.range(0.05, 0.42), va = RV.range(-PI, PI), vl = R * RV.range(0.07, 0.12);
      const px = Math.cos(a) * d, py = Math.sin(a) * d * 0.85;
      ctx.moveTo(px + Math.cos(va) * vl, py + Math.sin(va) * vl);
      ctx.ellipse(px, py, vl, vl * 0.4, va, 0, TAU);
    }
    ctx.fillStyle = 'rgba(255,226,140,0.75)';
    ctx.fill();
    // wet specular: a crescent on the body, a glint on each drop end
    ctx.beginPath();
    ctx.ellipse(-R * 0.2, -R * 0.24, R * 0.26, R * 0.1, -0.45, 0, TAU);
    ctx.moveTo(R * 0.17 + R * 0.05, -R * 0.36);
    ctx.arc(R * 0.17, -R * 0.36, R * 0.05, 0, TAU);
    for (const A of arms) {
      const bx = A.e[0] - A.rb * 0.35, by = A.e[1] - A.rb * 0.35;
      ctx.moveTo(bx + A.rb * 0.32, by);
      ctx.arc(bx, by, A.rb * 0.32, 0, TAU);
    }
    ctx.fillStyle = 'rgba(255,255,240,0.92)';
    ctx.fill();
    ctx.restore();
  }
  const tl = t / life;
  if (tl < 1) {
    const R = rng(seed * 13.7 + 5);
    // droplets (glossy: a glint on each)
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
      const sz = dr * (1 - tl * tl);
      if (sz < 0.2) continue;
      const spd = Math.hypot(vx, vy) / r;
      dropPath(ctx, px, py, sz, trailAng(vx, vy), 1.6 + Math.min(2.4, spd * 0.22));
      ctx.fillStyle = i % 3 ? C.juice : '#FFBE45';
      ctx.fill();
      ctx.strokeStyle = C.juiceLine;
      ctx.lineWidth = 0.7 * k;
      ctx.stroke();
      circle(ctx, px - sz * 0.35, py - sz * 0.3, sz * 0.3);
      ctx.fillStyle = 'rgba(255,255,235,0.9)';
      ctx.fill();
    }
    // pulp flecks
    const fa = 1 - smoothstep(0.25, 0.6, t);
    if (fa > 0) {
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = -PI / 2 + R.range(-1.6, 1.6), v = r * R.range(2, 5);
        const px = Math.cos(a) * v * t, py = Math.sin(a) * v * t + 0.5 * g * 0.8 * t * t;
        const an = a + t * 6;
        ctx.moveTo(px + Math.cos(an) * r * 0.07 * fa, py + Math.sin(an) * r * 0.07 * fa);
        ctx.ellipse(px, py, r * 0.07 * fa, r * 0.035 * fa, an, 0, TAU);
      }
      ctx.fillStyle = '#FFEBB0';
      ctx.fill();
    }
    // one small fleck of peel tumbling away (flat chip: skin side + pale pith edge)
    const ca = 1 - smoothstep(0.4, 0.7, t);
    if (ca > 0 && t > 0.02) {
      const a = -PI / 2 + R.range(0.5, 0.9), v = r * R.range(4, 5);
      const px = Math.cos(a) * v * t, py = Math.sin(a) * v * t + 0.5 * g * t * t;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a + t * 11);
      ctx.scale(ca, ca * (0.55 + 0.45 * Math.abs(Math.cos(t * 17))));
      const cw = r * 0.15, chh = r * 0.09;
      roundRect(ctx, -cw, -chh, cw * 2, chh * 2, chh * 0.8);
      ctx.fillStyle = C.base;
      ctx.fill();
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 0.8 * k;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-cw * 0.6, chh * 0.45);
      ctx.lineTo(cw * 0.6, chh * 0.45);
      ctx.strokeStyle = '#FFE7BF';
      ctx.lineWidth = chh * 0.5;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

// ═════════════════════════════════════════════════════════════════════ HELMET
// Barry's helmet IS the rig's helmet (capybara.drawCapyHelmet): the same object whether it is
// worn (accessories.helmet), sitting on a rock or in a paw. Origin = middle of the bottom rim,
// visor → +x. Scale 1 = the helmet on a scale-1 head (capyAnchors(o).helmet.scale ≈ 1.05 for
// Barry). strap (default true): the open chin strap dangling (loose helmet). soot 0..1.
function drawHelmet(ctx, o = {}) {
  const x = o.x || 0, y = o.y || 0, sc = o.scale != null ? o.scale : 1;
  const R = 70 * Math.abs(sc);
  fxWrap(ctx, o, [x - R, y - R, x + R, y + R], (c) => {
    const rig = capRig();
    if (rig && rig.drawCapyHelmet) rig.drawCapyHelmet(c, { x, y, scale: sc, rot: o.rot || 0, flip: !!o.flip, soot: o.soot || 0, strap: o.strap !== false });
    else helmetFallback(c, o);
  });
}
// pre-unification art, used only if the rig module can't be loaded
function helmetFallback(ctx, o = {}) {
  const B = begin(ctx, { ...o, alpha: null });
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
// Barry's thermometer IS the capybara rig's thermometer: the glass, column, ticks and bulb are
// drawn by capybara.drawCapyThermometer (a faithful port is used only if the rig can't load),
// so the paw/mouth thermometer and this loose / close-up one never swap designs on a cut.
// props adds: the big reading tag, the printed scale (close-ups), the surge → swell → POP
// break, waterline treatment and lighting.
const thermoLevel = (c, lo = 30, hi = 45) => clamp((c - lo) / (hi - lo));
const TH_G = 100 / 62;                       // props units per rig unit (scale 1, length 100)
const TH = { hw: 3.2 * TH_G, rb: 5 * TH_G, bore: 1.3 * TH_G, yo: -1.5 * TH_G };
let _rig;
function capRig() {
  if (_rig === undefined) { try { _rig = require('./capybara'); } catch (e) { _rig = null; } }
  return _rig && _rig.drawCapyThermometer ? _rig : null;
}
function thermoGeom(o) {
  const L = o.length || 100, len = 0.62 * L;   // rig tube length (rig units)
  const yc = (lv) => TH.yo - (2 + (len - 8) * clamp(lv)) * TH_G;
  return { L, len, top: TH.yo - len * TH_G, yLo: yc(0), yHi: yc(1), yc };
}
// break timing. broken mode: b = broken 0..1 over `dur` seconds (default 1.3 = the s07 beat),
// popping at popAt (fraction, default 0.16). since mode: since = seconds since the beat start,
// pop at popTime seconds (default 0.9). The column surges across 0..surgeEnd (default 92% of
// the way to the pop), the bulb swells/trembles over the last 45%, then everything after the
// pop runs in SECONDS (flash ≈2 frames, spray done by ≈0.32 s, drained by ≈0.45 s).
function thermoState(o) {
  let pre, ts, b;
  if (o.since != null) {
    const pt = o.popTime != null ? o.popTime : 0.9;
    const s = o.since;
    if (s <= 0) { pre = 0; ts = -1; } else if (s < pt) { pre = s / pt; ts = -1; } else { pre = 1; ts = s - pt; }
    b = s > 0 ? 1e-6 : 0;
  } else {
    b = clamp(o.broken || 0);
    const popAt = clamp(o.popAt != null ? o.popAt : 0.16, 0.01, 0.99);
    const dur = o.dur || 1.3;
    if (b <= 0) { pre = 0; ts = -1; } else if (b < popAt) { pre = b / popAt; ts = -1; } else { pre = 1; ts = (b - popAt) * dur + (b >= 1 ? 10 : 0); }
  }
  const active = b > 0 || pre > 0;
  const atTop = o.breakAt === 'top';
  let level = clamp(o.level != null ? o.level : 0.5);
  let peak = level;
  if (active) {
    const se = clamp(o.surgeEnd != null ? o.surgeEnd : 0.92);
    if (o.surge !== false) { level = lerp(level, 1, ease.inOutCubic(clamp(pre / Math.max(0.05, se)))); peak = lerp(peak, 1, ease.inOutCubic(clamp(1 / Math.max(0.05, se)))); }
    if (ts >= 0 && !atTop) level *= 1 - smoothstep(0, 0.45, ts);
    if (ts >= 0 && atTop) level = lerp(level, 0.82, smoothstep(0.1, 0.8, ts));
  }
  return { pre, ts, popped: ts >= 0, atTop, level, peak, active, swell: active && ts < 0 ? smoothstep(0.55, 1, pre) : 0 };
}
// the reading the tag shows right now: 'auto' = the animated column (counts up during a creep or
// the surge); a number/string = that reading, except that during a break, once the surging column
// passes it, the tag counts up with the column (it never points at the wrong number).
function thermoReading(o, st) {
  if (o.reading == null || o.reading === '') return null;
  // after the pop the tag keeps the peak it reached (it flies off with it)
  const cur = 30 + 15 * (st.popped ? st.peak : st.level);
  if (o.reading === 'auto') return cur.toFixed(1);
  const v = parseFloat(o.reading);
  if (st.active && Number.isFinite(v) && cur > v + 0.05) return cur.toFixed(1);
  return String(o.reading);
}
function thermoAnchors(o = {}) {
  const P = xform(o), G = thermoGeom(o), st = thermoState(o);
  const yc = G.yc(st.level);
  return { bulb: P(0, 0), top: P(0, G.top), column: P(0, yc), tag: P((o.tagSide === 'left' ? -1 : 1) * (TH.hw + 8), yc), reading: thermoReading(o, st) };
}
// port of the rig's thermometer art (capybara.js drawThermometer, rig units, +x = up the tube):
// used only when the rig module can't be loaded
function thermoPort(ctx, len, level, broken, k) {
  const w = 6.4;
  roundRect(ctx, 0, -w / 2, len, w, w / 2);
  ctx.fillStyle = 'rgba(238,249,255,0.96)';
  ctx.fill();
  ctx.strokeStyle = '#6E8494';
  ctx.lineWidth = 1.3 * k;
  ctx.stroke();
  roundRect(ctx, 2, -1.3, Math.max(2.6, (len - 8) * clamp(level)), 2.6, 1.3);
  ctx.fillStyle = '#E2382F';
  ctx.fill();
  ctx.strokeStyle = 'rgba(80,100,115,0.7)';
  ctx.lineWidth = 0.8 * k;
  ctx.beginPath();
  for (let i = 1; i < 8; i++) { const x = 6 + (i * (len - 10)) / 8; ctx.moveTo(x, -w / 2); ctx.lineTo(x, -w / 2 + (i % 2 ? 1.6 : 2.6)); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 1 * k;
  ctx.beginPath(); ctx.moveTo(5, -2); ctx.lineTo(len - 4, -2); ctx.stroke();
  if (broken > 0.5) {
    ctx.fillStyle = 'rgba(238,249,255,0.95)';
    ctx.strokeStyle = '#6E8494';
    ctx.beginPath();
    ctx.moveTo(1, -3.2); ctx.lineTo(-4, -6); ctx.lineTo(-2, -1); ctx.lineTo(-7, 1); ctx.lineTo(-1, 3.2); ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else thermoBulb(ctx, 1, k);
}
// the rig's bulb (rig units, centred at (-1.5, 0)); sw = swell factor
function thermoBulb(ctx, sw, k, crack = 0) {
  ctx.save();
  ctx.translate(-1.5, 0);
  ctx.scale(sw, sw);
  circle(ctx, 0, 0, 5);
  ctx.fillStyle = '#E2382F';
  ctx.fill();
  if (sw > 1.01) {
    // straining: hot core
    const g = ctx.createRadialGradient(-1, -1, 0, 0, 0, 5);
    g.addColorStop(0, rgba('#FF8A70', clamp((sw - 1) * 4)));
    g.addColorStop(1, 'rgba(226,56,47,0)');
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.strokeStyle = '#8E1E18';
  ctx.lineWidth = (1.2 * k) / sw;
  ctx.stroke();
  circle(ctx, -1.5, -1.8, 1.4);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
  if (crack > 0) {
    ctx.beginPath();
    const cr = crack;
    const C = [[-0.5, -5, 0.6, -1.8, -1, 1.2], [4.6, -1.4, 1.6, -0.2, 2.2, 2.4], [-4.2, 1.8, -1.6, 0.4, -0.3, 3.4]];
    for (const [ax, ay, bx, by, cx, cy] of C) {
      ctx.moveTo(ax, ay);
      ctx.lineTo(lerp(ax, bx, Math.min(1, cr * 2)), lerp(ay, by, Math.min(1, cr * 2)));
      if (cr > 0.5) ctx.lineTo(lerp(bx, cx, (cr - 0.5) * 2), lerp(by, cy, (cr - 0.5) * 2));
    }
    ctx.strokeStyle = 'rgba(255,240,235,0.95)';
    ctx.lineWidth = (0.55 * k) / sw;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.restore();
}
// ballistic spray (local units, seconds). Each drop exits by shrinking to nothing at the end of
// its life — no translucent leftovers drifting about.
function thermoSpray(ctx, cx, cy, ts, seed, k, n, spread, dirA, speed, scale) {
  const R = rng(seed);
  const red = PROP_COLORS.red, gr = 1500 * scale;
  ctx.beginPath();
  const glints = [];
  for (let i = 0; i < n; i++) {
    const a = dirA + R.range(-spread, spread);
    const v = R.range(0.35, 1) * 430 * speed * scale;
    const life = R.range(0.2, 0.34);
    const sz0 = R.range(0.9, 2.2) * scale * (i % 5 === 0 ? 1.5 : 1);
    if (ts >= life) continue;
    const vx = Math.cos(a) * v, vy0 = Math.sin(a) * v;
    const px = cx + vx * ts, py = cy + vy0 * ts + 0.5 * gr * ts * ts;
    const q = ts / life;
    const sz = sz0 * (1 - q * q);
    if (sz < 0.15) continue;
    dropPath(ctx, px, py, sz, trailAng(vx, vy0 + gr * ts), 1.7 + Math.min(2.5, v / (170 * scale)), true);
    if (i % 3 === 0) glints.push([px - sz * 0.3, py - sz * 0.3, sz * 0.3]);
  }
  ctx.fillStyle = red;
  ctx.fill();
  ctx.fillStyle = 'rgba(255,190,180,0.9)';
  for (const [gx, gy, gr2] of glints) { circle(ctx, gx, gy, gr2); ctx.fill(); }
}
function thermoShards(ctx, cx, cy, ts, seed, k, n, spread, dirA, speed, scale) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = dirA + R.range(-spread, spread);
    const v = R.range(0.4, 1) * 320 * speed * scale;
    const life = R.range(0.26, 0.42);
    const sz0 = R.range(1.6, 3.4) * scale;
    const spin = R.range(-18, 18), r0 = R.range(0, TAU);
    const j1 = R.range(0.5, 0.9), j2 = R.range(0.2, 0.7), j3 = R.range(0.4, 0.8), j4 = R.range(0.3, 0.8);
    if (ts >= life) continue;
    const q = ts / life;
    const sz = sz0 * (1 - q * q * q);
    const vx = Math.cos(a) * v, vy = Math.sin(a) * v;
    const px = cx + vx * ts, py = cy + vy * ts + 0.5 * 1300 * scale * ts * ts;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(r0 + spin * ts);
    ctx.beginPath();
    ctx.moveTo(0, -sz);
    ctx.lineTo(sz * j1, sz * j2);
    ctx.lineTo(-sz * j3, sz * j4);
    ctx.closePath();
    ctx.fillStyle = 'rgba(232,247,255,0.95)';
    ctx.fill();
    ctx.strokeStyle = PROP_COLORS.glass;
    ctx.lineWidth = 0.55 * k * scale;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-sz * 0.2, -sz * 0.45);
    ctx.lineTo(sz * 0.12, sz * 0.15);
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    ctx.restore();
  }
}
// the pop itself at (cx, cy) in local units. ts = seconds since the pop. up = spray direction.
function thermoPop(ctx, cx, cy, ts, k, top) {
  const rb = TH.rb;
  // 1. flash: white-hot comic star + glow, two frames
  if (ts < 0.09) {
    const p = ts / 0.09;
    glow(ctx, cx, cy, rb * (5 + 2 * p), '#FFF6D0', 0.95 * (1 - p));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(0.2 + p * 0.3);
    const sc = 1 - smoothstep(0.6, 1, p) * 0.6;
    burstPath(ctx, 9, rb * (3 + 1.6 * ease.outCubic(p)) * sc, rb * (1.5 + 0.6 * p) * sc, 4.2, 0.3);
    ctx.fillStyle = '#FFF3B0';
    ctx.fill();
    ctx.strokeStyle = '#FFB84A';
    ctx.lineWidth = 1.4 * k;
    ctx.lineJoin = 'round';
    ctx.stroke();
    burstPath(ctx, 9, rb * (2 + 1.1 * ease.outCubic(p)) * sc, rb * (1 + 0.4 * p) * sc, 7.7, 0.25);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
  }
  // 2. the red splat: bigger than the swollen bulb on the very first frame, punches out, then
  //    breaks up (shrinks into the spray) — never alpha-faded
  if (ts < 0.2) {
    const sc = ts < 0.05 ? lerp(1.9, 2.7, ease.outBack(ts / 0.05, 1.4)) : 2.7 * (1 - ease.inCubic((ts - 0.05) / 0.15));
    if (sc > 0.05) {
      ctx.save();
      ctx.translate(cx, cy + (top ? 0 : 1200 * 0.5 * Math.max(0, ts - 0.05) ** 2 * 0.3));
      splashShape(ctx, rb * sc, top ? 5.3 : 9.1, lin(ctx, 0, -rb * sc, 0, rb * sc, ['#FF8A7C', PROP_COLORS.red, '#C42A20']), '#8E1E18', 0.8 * k, 1.1, top ? 1.15 : 0.9);
      ellipse(ctx, -rb * sc * 0.18, -rb * sc * 0.16, rb * sc * 0.22, rb * sc * 0.1, -0.35);
      ctx.fillStyle = 'rgba(255,225,220,0.85)';
      ctx.fill();
      ctx.restore();
    }
  }
  // 3. spray + glass
  if (top) {
    thermoSpray(ctx, cx, cy, ts, 31, k, 30, 0.6, -PI / 2, 1.25, 1);
    thermoShards(ctx, cx, cy, ts, 17, k, 7, 1.0, -PI / 2, 0.9, 1);
  } else {
    thermoSpray(ctx, cx, cy, ts, 29, k, 34, 1.75, -PI / 2, 1, 1);
    thermoShards(ctx, cx, cy, ts, 13, k, 12, 2.1, -PI / 2, 1, 1);
  }
}
// A bulb popping UNDER WATER (local units, ts = seconds since the pop): a muffled pale shock
// ring, a red ink cloud that blooms and slowly drifts up, bubbles rising to the surface and glass
// shards that sink slowly. Colours are pre-mixed with the water palette (it is all under water).
function thermoUnderPop(ctx, cx, cy, ts, k, pal, seed = 3) {
  const rb = TH.rb;
  const ink = mix(PROP_COLORS.red, pal.base, 0.22), inkDark = mix('#9E1F18', pal.deep, 0.3);
  // shock ring + hot core (2-3 frames)
  if (ts < 0.14) {
    const p = ts / 0.14;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rb * (1.3 + 4.5 * ease.outCubic(p)), rb * (1.3 + 4.5 * ease.outCubic(p)) * 0.9, 0, 0, TAU);
    ctx.strokeStyle = rgba(mix('#FFFFFF', pal.top, 0.3), 0.75 * (1 - p));
    ctx.lineWidth = (2.4 - 1.6 * p) * k;
    ctx.stroke();
  }
  // ink cloud: soft overlapping blooms
  const fade = 1 - smoothstep(0.55, 2.0, ts);
  if (fade > 0) {
    const R = rng(seed * 7.3 + 2);
    for (let j = 0; j < 5; j++) {
      const a = -PI / 2 + R.range(-1.9, 1.9), d = rb * R.range(0.6, 2.0), sz = R.range(0.75, 1.2);
      const grow = ease.outCubic(clamp(ts / 0.6));
      const px = cx + Math.cos(a) * d * grow + noise1(ts * 0.9 + j * 3.1) * rb * 0.7;
      const py = cy + Math.sin(a) * d * grow * 0.8 - ts * rb * 1.1;
      const rr = rb * (0.9 + 2.5 * ease.outCubic(clamp(ts / 0.8))) * sz;
      const al = 0.8 * fade * Math.min(1, 0.35 + ts / 0.05);
      const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
      g.addColorStop(0, rgba(j ? ink : inkDark, al));
      g.addColorStop(0.55, rgba(ink, al * 0.55));
      g.addColorStop(1, rgba(ink, 0));
      ctx.fillStyle = g;
      ctx.fillRect(px - rr, py - rr, rr * 2, rr * 2);
    }
  }
  // glass shards: burst out against the water's drag, then sink slowly, turning
  {
    const R = rng(seed * 3.1 + 9);
    const glass = mix('#EAF7FF', pal.base, 0.3), edge = mix(PROP_COLORS.glass, pal.deep, 0.3);
    for (let i = 0; i < 9; i++) {
      const a = R.range(0, TAU), v = rb * R.range(5, 11), sz0 = R.range(1.5, 3.2), spin = R.range(-4, 4), r0 = R.range(0, TAU);
      const j1 = R.range(0.5, 0.9), j2 = R.range(0.2, 0.7), j3 = R.range(0.4, 0.8), j4 = R.range(0.3, 0.8);
      const life = R.range(1.4, 2.0);
      if (ts >= life) continue;
      const out = (1 - Math.exp(-6 * ts)) / 6;               // drag-limited burst
      const px = cx + Math.cos(a) * v * out, py = cy + Math.sin(a) * v * out * 0.8 + rb * 1.6 * Math.max(0, ts - 0.1);
      const sz = sz0 * (1 - smoothstep(life - 0.25, life, ts));
      if (sz < 0.1) continue;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(r0 + spin * out * 3 + ts * spin * 0.3);
      ctx.beginPath();
      ctx.moveTo(0, -sz); ctx.lineTo(sz * j1, sz * j2); ctx.lineTo(-sz * j3, sz * j4); ctx.closePath();
      ctx.fillStyle = rgba(glass, 0.9);
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 0.5 * k;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }
  }
  // bubbles rising (the surface clip pops them)
  {
    const R = rng(seed * 5.9 + 4);
    const rim = rgba(mix('#FFFFFF', pal.top, 0.2), 0.85), body = rgba(pal.top, 0.25);
    for (let i = 0; i < 11; i++) {
      const t0 = R.range(0, 0.3), vy = rb * R.range(4, 8), br = rb * R.range(0.1, 0.3), ox = R.range(-1, 1) * rb, ph = R.range(0, TAU);
      const tt = ts - t0;
      if (tt <= 0) continue;
      const px = cx + ox * (1 + tt * 0.6) + Math.sin(tt * 9 + ph) * rb * 0.25, py = cy - rb * 0.3 - vy * tt;
      const rr = br * Math.min(1, tt / 0.06) * (1 + tt * 0.25);
      circle(ctx, px, py, rr);
      ctx.fillStyle = body;
      ctx.fill();
      ctx.strokeStyle = rim;
      ctx.lineWidth = 0.7 * k;
      ctx.stroke();
      circle(ctx, px - rr * 0.35, py - rr * 0.35, rr * 0.28);
      ctx.fillStyle = rim;
      ctx.fill();
    }
  }
}
// the cap blown off by breakAt:'top' — the rounded glass end of the tube with a jagged break,
// on ONE ballistic arc up and away (it clears the frame in the close-up), spinning steadily
function thermoCap(ctx, x0, y0, ts, k, side) {
  if (ts >= 0.95) return;
  const vx = 80 * side, vy = -520, g = 900;
  const x = x0 + vx * ts, y = y0 + vy * ts + 0.5 * g * ts * ts;
  const sc = 1 - smoothstep(0.8, 0.95, ts);
  const hw = TH.hw;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(side * ts * 10);
  ctx.scale(sc, sc);
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(-hw, 6);
    ctx.lineTo(-hw, 0);
    ctx.arc(0, 0, hw, PI, 0);
    ctx.lineTo(hw, 7);
    ctx.lineTo(hw * 0.5, 5);
    ctx.lineTo(hw * 0.15, 8.5);
    ctx.lineTo(-hw * 0.35, 5.5);
    ctx.lineTo(-hw * 0.7, 8);
    ctx.closePath();
  };
  shape();
  ctx.fillStyle = 'rgba(238,249,255,0.96)';
  ctx.fill();
  // red residue in the bottom + glassy highlight
  ctx.save();
  shape();
  ctx.clip();
  ctx.fillStyle = PROP_COLORS.red;
  ctx.fillRect(-TH.bore * 1.6, 3, TH.bore * 3.2, 8);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(-hw * 0.45, 5);
  ctx.lineTo(-hw * 0.45, -hw * 0.25);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 1.4 * k;
  ctx.lineCap = 'round';
  ctx.stroke();
  shape();
  ctx.strokeStyle = PROP_COLORS.glass;
  ctx.lineWidth = 1.3 * k;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}
// The close-up tube (labels on): the rig's glass art, ported, with a REAL printed °C scale —
// major ticks at 30/35/40/45, a minor tick every 1 °C, painted over the highlight stripe on the
// same G.yc grid as the labels — and the column's FLAT top on the level line. Props units.
function thermoTube(ctx, G, level, broken, lw) {
  const hw = TH.hw, top = G.top, base = TH.yo;
  roundRect(ctx, -hw, top, hw * 2, base - top, hw);
  ctx.fillStyle = 'rgba(238,249,255,0.96)';
  ctx.fill();
  ctx.strokeStyle = '#6E8494';
  ctx.lineWidth = 1.3 * lw * TH_G;
  ctx.stroke();
  // column: flat top at yc(level), a rounded meniscus above it
  const cw = 1.3 * TH_G, y0 = base - 2 * TH_G, yf = Math.min(y0 - 0.01, G.yc(level));
  ctx.beginPath();
  ctx.moveTo(-cw, y0 + cw);
  ctx.lineTo(-cw, yf);
  ctx.arc(0, yf, cw, PI, 0);
  ctx.lineTo(cw, y0 + cw);
  ctx.closePath();
  ctx.fillStyle = PROP_COLORS.red;
  ctx.fill();
  // highlight stripe (the rig's), then the scale painted ON TOP of it
  ctx.beginPath();
  ctx.moveTo(-2 * TH_G, base - 5 * TH_G);
  ctx.lineTo(-2 * TH_G, top + 4 * TH_G);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 1 * lw * TH_G;
  ctx.stroke();
  ctx.beginPath();
  for (let c = 30; c <= 45; c++) {
    const yy = G.yc((c - 30) / 15), major = c % 5 === 0;
    ctx.moveTo(-hw + 0.2, yy);
    ctx.lineTo(-hw + (major ? 2.3 : 1.25) * TH_G, yy);
  }
  ctx.strokeStyle = 'rgba(60,84,104,0.9)';
  ctx.lineWidth = 0.55 * lw * TH_G;
  ctx.lineCap = 'butt';
  ctx.stroke();
  if (!broken) {
    ctx.save();
    ctx.translate(0, base);
    ctx.rotate(-PI / 2);
    ctx.scale(TH_G, TH_G);
    thermoBulb(ctx, 1, lw);
    ctx.restore();
  }
}
function drawThermometer(ctx, o = {}) {
  withLight(o, (L) => {
    const G = thermoGeom(o), s = o.scale != null ? o.scale : 1;
    const P = xform(o);
    const st = thermoState(o);
    const bb = (pts) => [Math.min(...pts.map((p) => p.x)), Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.y))];
    // the glass (+ printed scale): a TIGHT box, so the submerged-band pass stays cheap
    const lab = (o.labels != null ? o.labels : s >= 2.2) ? 26 : 0;
    const gbox = bb([P(-TH.rb * 1.6 - 3 - lab, TH.rb * 1.6 + 3), P(TH.rb * 1.6 + 3, TH.rb * 1.6 + 3), P(-TH.rb * 1.6 - 3 - lab, G.top - 22), P(TH.rb * 1.6 + 3, G.top - 22)]);
    const fx = propFx(o, L);
    if (fx.water) fx.water.depth = o.waterDepth || 26 * Math.max(1, s * 0.7);
    const wy = o.waterY;
    st.under = wy != null && P(0, st.atTop ? G.top + 4 : 0).y > wy;
    layered(ctx, gbox, fx, (c) => thermoBody(c, o, G, st));
    if (wy != null) {
      // where the tube (or bulb) pierces the surface
      const b = P(0, 0), tp = P(0, G.top);
      if ((b.y - wy) * (tp.y - wy) < 0 || Math.abs(b.y - wy) < TH.rb * s) {
        const u = clamp((wy - b.y) / ((tp.y - b.y) || 1e-6));
        const px = lerp(b.x, tp.x, u);
        const cosr = Math.max(0.3, Math.abs(Math.cos(o.rot || 0)));
        const near = Math.abs(b.y - wy) < TH.rb * s ? Math.sqrt(Math.max(0, (TH.rb * s) ** 2 - (b.y - wy) ** 2)) : 0;
        waterContact(ctx, Math.abs(b.y - wy) < TH.rb * s ? b.x : px, wy, Math.max(near, (TH.hw * s) / cosr), o.t || 0, subPal(o), Math.pow(s, 0.4), 0.8);
      }
    }
    // ---- the pop (drawn outside the glass layer: never double-drawn or water-tinted by the band)
    if (st.popped && st.ts < 2.1) {
      const top = st.atTop;
      const pl = top ? [0, G.top + 4] : [0, 0];
      const pc = P(pl[0], pl[1]);
      const under = wy != null && pc.y > wy;
      const k = lwf(s);
      const fxBox = bb([P(-110, 110), P(110, 110), P(-110, G.top - 160), P(110, G.top - 160)]);
      const lit = L && L.tint ? { tint: L.tint } : {};
      layered(ctx, fxBox, lit, (c) => {
        if (under) {
          if (st.ts < 2.1) {
            c.save();
            if (wy != null) { c.beginPath(); c.rect(-1e5, wy, 2e5, 1e5); c.clip(); }
            const B = begin(c, o);
            thermoUnderPop(c, pl[0], pl[1], st.ts, B.k, subPal(o), 3);
            c.restore();
            c.restore();
          }
        } else if (st.ts < 0.6) {
          c.save();
          if (wy != null) { c.beginPath(); c.rect(-1e5, -1e5, 2e5, wy + 1e5); c.clip(); }
          const B = begin(c, o);
          thermoPop(c, pl[0], pl[1], st.ts, B.k, top);
          c.restore();
          c.restore();
        }
        if (top && st.ts < 0.95) {
          c.save();
          if (wy != null) { c.beginPath(); c.rect(-1e5, -1e5, 2e5, wy + 1e5); c.clip(); }
          begin(c, o);
          thermoCap(c, 0, G.top + 5, st.ts, k, o.flip ? -1 : 1);
          c.restore();
          c.restore();
        }
      });
      // a bulb popping just under the surface bumps it
      if (under && !top && st.ts < 1.4 && pc.y < wy + TH.rb * s * 4) {
        drawWaterSplash(ctx, { x: pc.x, y: wy, r: 7 * s, t: st.ts, seed: 6, grade: o.grade, water: o.water });
      }
    }
    // ---- reading tag (upright, lit like the prop; counts with the column; pops off at the break)
    const txt = o.showTag !== false ? thermoReading(o, st) : null;
    if (txt != null) {
      const pt = TINT;
      TINT = L && L.tint && L.tint.amount > 0 ? L.tint : null;
      try { thermoTag(ctx, o, G, st, txt); } finally { TINT = pt; }
    }
  });
}
function thermoTag(ctx, o, G, st, num) {
  const txt = num + '°';
  const B = begin(ctx, o);
  const t = o.t || 0;
  const side = o.tagSide === 'left' ? -1 : 1;
  const fs = o.tagSize || 13;
  const yc = G.yc(st.level);
  // pops off with the glass (tagPop:false keeps it)
  let fly = null;
  if (st.popped && o.tagPop !== false) {
    const tt = st.ts;
    if (tt > 0.34) { ctx.restore(); return; }
    fly = { tt, sc: tt < 0.05 ? 1 + 0.15 * Math.sin((tt / 0.05) * PI) : 1 - ease.inCubic(clamp((tt - 0.12) / 0.22)) };
    if (fly.sc <= 0.02) { ctx.restore(); return; }
  }
  const w = TH.hw + 1.5;
  const ax = side * w, ay = yc;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.scale(B.f, 1);
  ctx.rotate(-(o.rot || 0) * B.f);
  const sd = side * B.f;
  // tremble while the bulb strains
  const jig = st.swell * 1.4 + (st.active && !st.popped ? smoothstep(0.8, 1, st.pre) * 1.2 : 0);
  if (jig) ctx.translate(noise1(t * 55 + 3) * jig, noise1(t * 61 + 9) * jig * 0.7);
  const tw = textW(txt, fs, 700);
  const bw = tw + fs * 0.9, bh = fs * 1.45, bx = sd > 0 ? fs * 0.55 : -fs * 0.55 - bw;
  if (fly) {
    const tt = fly.tt;
    ctx.translate(sd * (bw * 0.5 + fs * 0.55) + sd * 70 * tt, -150 * tt + 0.5 * 700 * tt * tt);
    ctx.rotate(sd * tt * 7);
    ctx.scale(fly.sc, fly.sc);
    ctx.translate(-sd * (bw * 0.5 + fs * 0.55), 0);
  }
  const card = () => roundRect(ctx, bx, -bh / 2, bw, bh, bh * 0.32);
  if (!fly) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(bx + (sd > 0 ? 1 : bw - 1), -bh * 0.26);
    ctx.lineTo(bx + (sd > 0 ? 1 : bw - 1), bh * 0.26);
    ctx.closePath();
    ctx.fillStyle = tc('#B23A2E');
    ctx.fill();
  }
  roundRect(ctx, bx + 0.8, -bh / 2 + 1.4, bw, bh, bh * 0.32);
  ctx.fillStyle = 'rgba(60,20,20,0.25)';
  ctx.fill();
  paint(ctx, card, {
    fill: lin(ctx, 0, -bh / 2, 0, bh / 2, ['#FFFEF8', '#FFF4E4']), hi: '#FFFFFF', rim: [0.6, 1.2], line: '#B23A2E', lw: 1.3 * B.k,
  });
  paintText(ctx, txt, bx + bw / 2, 0.5, fs, { color: '#B23A2E', jitter: 0, seed: 3, dy0: 0.02 });
  ctx.restore();
  ctx.restore();
}
function thermoBody(ctx, o, G, st) {
  const B = begin(ctx, o);
  const k = B.k;
  const t = o.t || 0;
  const labels = o.labels != null ? o.labels : B.s >= 2.2;
  const red = PROP_COLORS.red;
  const breakTop = st.atTop && st.popped, breakBulb = !st.atTop && st.popped;
  // tremble while straining
  const jig = st.swell * 1.2 + (st.active && !st.popped ? smoothstep(0.85, 1, st.pre) * 0.8 : 0);
  ctx.save();
  if (jig) ctx.translate(noise1(t * 60 + 1) * jig, noise1(t * 57 + 7) * jig * 0.5);
  const lenDraw = breakTop ? G.len - 7 : G.len;
  const rig = capRig();
  if (labels) {
    // close-up: the ported tube with a real °C scale (the rig's generic ticks don't line up)
    const G2 = breakTop ? { ...G, top: TH.yo - lenDraw * TH_G } : G;
    thermoTube(ctx, G2, st.level, breakBulb, 0.825);
    if (breakBulb) { ctx.save(); ctx.translate(0, TH.yo); ctx.rotate(-PI / 2); ctx.scale(TH_G, TH_G); thermoStub(ctx, 0.825); ctx.restore(); }
  } else {
    // ---- the rig's thermometer art (tube up = rig +x); level → its column's FLAT top
    ctx.save();
    ctx.translate(0, TH.yo);
    const lvRig = st.level + (st.level > 0 ? 1.3 / (G.len - 8) : 0);
    if (rig) {
      rig.drawCapyThermometer(ctx, { x: 0, y: 0, scale: TH_G / 0.9, rot: 0, length: lenDraw, level: lvRig, broken: breakBulb ? 1 : 0 });
    } else {
      ctx.rotate(-PI / 2);
      ctx.scale(TH_G, TH_G);
      thermoPort(ctx, lenDraw, lvRig, breakBulb ? 1 : 0, k / TH_G * 1.4);
    }
    ctx.restore();
  }
  // jagged broken top (cap blown off)
  if (breakTop) {
    const yT = G.top + 7 * TH_G, hw = TH.hw;
    ctx.beginPath();
    ctx.moveTo(-hw, yT + 5);
    const jag = [[-hw, yT + 1], [-hw * 0.5, yT - 4], [-hw * 0.15, yT + 1], [hw * 0.3, yT - 5], [hw * 0.6, yT], [hw, yT - 2.5], [hw, yT + 5]];
    for (const [jx, jy] of jag) ctx.lineTo(jx, jy);
    ctx.closePath();
    ctx.fillStyle = 'rgba(238,249,255,0.96)';
    ctx.fill();
    ctx.strokeStyle = PROP_COLORS.glass;
    ctx.lineWidth = 1.2 * k;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  // ---- swelling bulb (drawn over the rig's bulb in the rig's own style)
  if (!st.popped && st.swell > 0) {
    ctx.save();
    ctx.translate(0, TH.yo);
    ctx.rotate(-PI / 2);
    ctx.scale(TH_G, TH_G);
    const sw = 1 + 0.32 * st.swell + Math.sin(t * 70) * 0.03 * st.swell;
    thermoBulb(ctx, sw, (k / TH_G) * 1.3, st.atTop ? 0 : smoothstep(0.3, 1, st.swell));
    ctx.restore();
  }
  // column bulging against the top cap right before a top break
  if (!st.popped && st.atTop && st.swell > 0) {
    ellipse(ctx, 0, G.top + 6, TH.hw * (1 + 0.25 * st.swell), 4 + 3 * st.swell);
    ctx.fillStyle = rgba(red, 0.9 * st.swell);
    ctx.fill();
  }
  // ---- printed scale (close-ups): 30/35/40/45 beside the tube's major ticks
  if (labels) {
    ctx.save();
    ctx.font = `600 5.6px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 3; i++) { const yy = G.yc(i / 3); ctx.moveTo(-TH.hw - 0.4, yy); ctx.lineTo(-TH.hw - 2.6, yy); }
    ctx.strokeStyle = 'rgba(70,95,115,0.85)';
    ctx.lineWidth = 0.7 * k;
    ctx.stroke();
    for (let i = 0; i <= 3; i++) {
      const yy = G.yc(i / 3);
      ctx.save();
      ctx.translate(-TH.hw - 3.4, yy);
      if (o.flip) ctx.scale(-1, 1);
      ctx.textAlign = o.flip ? 'left' : 'right';
      ctx.strokeStyle = 'rgba(236,247,253,0.9)';
      ctx.lineWidth = 1.6;
      ctx.strokeText(String(30 + i * 5), 0, 0);
      ctx.fillStyle = '#3C5062';
      ctx.fillText(String(30 + i * 5), 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }
  // ---- draining drips from the stub (in air; under water it all goes into the ink cloud)
  if (breakBulb && !st.under && st.ts < 0.7) {
    for (let i = 0; i < 3; i++) {
      const p = frac(st.ts * 2.6 + i / 3);
      const on = 1 - smoothstep(0.35, 0.7, st.ts);
      const r0 = 1.5 * on * (1 - p * 0.4);
      if (r0 < 0.2) continue;
      dropPath(ctx, (i - 1) * 1.7, 4 + p * p * 30, r0, 0, 2.2);
      ctx.fillStyle = red;
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.restore();
}
// the rig's broken-bulb stub (rig units, as capybara.js drawThermometer's broken > .5)
function thermoStub(ctx, k) {
  ctx.fillStyle = 'rgba(238,249,255,0.95)';
  ctx.strokeStyle = '#6E8494';
  ctx.lineWidth = 1.3 * k;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(1, -3.2); ctx.lineTo(-4, -6); ctx.lineTo(-2, -1); ctx.lineTo(-7, 1); ctx.lineTo(-1, 3.2); ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// ═════════════════════════════════════════════════════════════════════ SIGN
// glyph coverage: Fredoka has no arrows / dingbats; anything it lacks would print as a box
const _glyphOK = new Map();
let _notdefW = null;
function hasGlyph(ch) {
  const cp = ch.codePointAt(0);
  if (cp >= 0x20 && cp <= 0x7e) return true;
  let v = _glyphOK.get(ch);
  if (v !== undefined) return v;
  const c = mctx();
  c.font = `700 100px ${FONT}`;
  if (_notdefW == null) _notdefW = c.measureText('\uE000').width;
  v = Math.abs(c.measureText(ch).width - _notdefW) > 0.05;
  _glyphOK.set(ch, v);
  return v;
}
const cleanText = (s) => Array.from(String(s)).filter(hasGlyph).join('');
// '→' / '->' / '⇒' (or '←' / '<-' / '⇐') anywhere in a sign's text become a painted arrow
// (glyph:true + arrowDir) — the font has no arrow glyphs
const ARROW_R = /\s*(?:->|=>|[\u2192\u21D2\u2794\u27A1\u279C\u27F6])\s*/g, ARROW_L = /\s*(?:<-|<=|[\u2190\u21D0\u2B05\u27F5])\s*/g;
function splitLines(o) {
  let lines;
  if (o.lines) lines = o.lines.map(String);
  else lines = String(o.text != null ? o.text : 'EXIT').split(/\n|\s+(?:\/|\u2014|\u2013|--)\s+/);
  let dir = null;
  lines = lines.map((l) => {
    if (ARROW_R.test(l)) dir = 'right';
    ARROW_R.lastIndex = 0;
    if (ARROW_L.test(l)) dir = 'left';
    ARROW_L.lastIndex = 0;
    return cleanText(l.replace(ARROW_R, ' ').replace(ARROW_L, ' ')).trim();
  });
  lines = lines.filter((s) => s.length);
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
  return { lines, dir };
}
// layout: lines grouped onto boards. 'arrow' = one pointed board; 'board' = one board for all
// lines; 'wood' = one plank per line, except 3+ lines = a NOTICE: title plank + one tall board
// carrying the rest (tighter, so rule lines can be bigger: 0.82 of the title by default).
function signLayout(o = {}) {
  const sp = splitLines(o);
  const lines = sp.lines;
  const style = o.style || 'wood';
  const arrow = style === 'arrow';
  const dirL = (sp.dir || o.arrowDir || 'left') !== 'right';
  const glyph = !arrow && (!!o.glyph || !!sp.dir) && lines.length === 1;
  const weight = o.weight || 700;
  const notice = !arrow && style !== 'board' && lines.length >= 3 && o.notice !== false;
  const rel = lines.map((l, i) => (o.sizes && o.sizes[i] != null ? o.sizes[i] : i > 0 && /[a-z]/.test(l) ? (lines.length >= 3 ? 0.82 : 0.72) : 1));
  let groups;
  if (arrow || style === 'board' || lines.length === 1) groups = [lines.map((_, i) => i)];
  else if (notice) groups = [[0], lines.slice(1).map((_, i) => i + 1)];
  else groups = lines.map((_, i) => [i]);
  const padYk = arrow ? 0.34 : 0.3;
  const lhOf = (g) => (g.length > 1 ? 1.1 : 1.16);
  const padOf = (g) => (g.length > 1 ? 0.24 : padYk);
  const gH1 = groups.map((g) => g.reduce((a, i) => a + rel[i] * lhOf(g), 0) + 2 * padOf(g));
  const gapK = 0.12;
  const totH1 = gH1.reduce((a, b) => a + b, 0) + gapK * (groups.length - 1);
  const w1 = lines.map((l, i) => textW(l, 1, weight) * rel[i]);
  const maxW1 = Math.max(0.0001, ...w1.map((w, i) => w + (glyph && i === 0 ? 1.25 : 0)));
  let base = o.size || 24;
  const padXk = notice ? 0.5 : 0.62;
  const pointK = (h) => (arrow ? h * 0.42 : 0);
  let w = o.w, h = o.h;
  if (h != null && w == null) base = h / totH1;
  else if (w != null && h == null) base = Math.min(base * 1.3, (w - pointK(base * totH1)) / (maxW1 + 2 * padXk));
  else if (w != null && h != null) base = Math.min(h / totH1, (w - pointK(h)) / (maxW1 + 2 * padXk));
  if (h == null) h = base * totH1;
  const point = pointK(h);
  if (w == null) w = base * (maxW1 + 2 * padXk) + point;
  return { lines, rel, sizes: rel.map((r) => r * base), base, w, h, point, arrow, glyph, planks: groups.length > 1, groups, gH1, lhOf, weight, gap: base * gapK, dirL, notice, padXk };
}
// board + line geometry shared by drawSign and signAnchors (sign-local units, before scale)
function signGeom(o, L) {
  const seed = o.seed != null ? o.seed : 7;
  const yb = -signStake(o, L), top = yb - L.h, xL = -L.w / 2, xR = L.w / 2;
  const tcx = L.arrow ? (L.dirL ? L.point / 2 : -L.point / 2) : 0;
  const boards = [];
  if (L.arrow) {
    const pt = L.point;
    const pts = L.dirL
      ? [[xL + pt, top], [xR, top], [xR, yb], [xL + pt, yb], [xL, (top + yb) / 2]]
      : [[xL, top], [xR - pt, top], [xR, (top + yb) / 2], [xR - pt, yb], [xL, yb]];
    const jit = pts.map((p, i) => [p[0] + (hash1(seed + i * 3.7) - 0.5) * 2.4, p[1] + (hash1(seed * 2 + i * 1.9) - 0.5) * 1.6]);
    boards.push({ kind: 'arrow', pts: jit, y0: top, y1: yb, x0: xL, x1: xR, rot: 0, lines: L.groups[0] });
  } else {
    const n = L.groups.length;
    const tot = L.gH1.reduce((a, b) => a + b, 0);
    const avail = L.h - L.gap * (n - 1);
    let yy = top;
    L.groups.forEach((g, gi) => {
      const ph = avail * (L.gH1[gi] / tot);
      const single = n === 1;
      const wj = single ? 1 : 1 + (hash1(seed + gi * 5.3) - 0.5) * 0.05 - (gi > 0 && g.length === 1 ? 0.04 * (1 - L.rel[g[0]]) : 0);
      const pw2 = L.w * wj, dx = single ? 0 : (hash1(seed * 3 + gi) - 0.5) * 4;
      const rr = single ? (hash1(seed) - 0.5) * 0.025 : (hash1(seed * 7 + gi) - 0.5) * (g.length > 1 ? 0.012 : 0.03);
      boards.push({ kind: 'plank', x0: dx - pw2 / 2, x1: dx + pw2 / 2, y0: yy, y1: yy + ph, rot: rr, lines: g, r: single ? 4.5 : 4 });
      yy += ph + L.gap;
    });
  }
  // vertical centre (and horizontal centre) of every line; a notice body is a left-aligned
  // list (the block itself stays centred on the board)
  const lineY = [], lineX = [];
  for (const bd of boards) {
    const list = L.notice && bd.lines.length > 1 && o.align !== 'center';
    const ws = bd.lines.map((li) => textW(L.lines[li], L.sizes[li], L.weight));
    const maxW = (bd.x1 - bd.x0) - L.sizes[bd.lines[0]] * 0.7;
    const blockW = Math.min(maxW, Math.max(...ws));
    bd.lines.forEach((li, j) => { lineX[li] = list ? tcx + (bd.x0 + bd.x1) / 2 - blockW / 2 + Math.min(ws[j], maxW) / 2 : tcx + (L.arrow ? 0 : (bd.x0 + bd.x1) / 2 * 0); });
    const lh = L.lhOf(bd.lines);
    const hsum = bd.lines.reduce((a, li) => a + L.sizes[li] * lh, 0);
    let acc = (bd.y0 + bd.y1) / 2 - hsum / 2;
    for (const li of bd.lines) { lineY[li] = acc + L.sizes[li] * lh * 0.5; acc += L.sizes[li] * lh; }
  }
  return { boards, yb, top, xL, xR, tcx, lineY, lineX, seed };
}
function signStake(o, L) {
  const s = o.stake != null ? o.stake : 30;
  const drive = o.drive != null ? clamp(o.drive) : 1;
  return s + (1 - drive) * 28 + (L.h > 90 ? 6 : 0);
}
function signAnchors(o = {}) {
  const L = signLayout(o), P = xform(o), G = signGeom(o, L);
  const yb = G.yb, sc = Math.abs(o.scale != null ? o.scale : 1);
  // per-line anchors (for glances / highlights): centre of the painted text + its extent
  const lines = L.lines.map((txt, li) => {
    const bd = G.boards.find((b) => b.lines.includes(li));
    const cx0 = (bd.x0 + bd.x1) / 2, cy0 = (bd.y0 + bd.y1) / 2;
    const c = Math.cos(bd.rot), sn = Math.sin(bd.rot);
    const lx = G.lineX[li] - cx0, ly = G.lineY[li] - cy0;
    const p = P(cx0 + lx * c - ly * sn, cy0 + lx * sn + ly * c);
    const maxW = (bd.x1 - bd.x0) - (L.arrow ? L.point : 0) - L.sizes[li] * 0.7;
    const tw = Math.min(maxW, textW(txt, L.sizes[li], L.weight));
    return { text: txt, x: p.x, y: p.y, w: tw * sc, h: L.sizes[li] * sc, size: L.sizes[li] * sc };
  });
  return { top: P(0, yb - L.h), center: P(0, yb - L.h / 2), ground: P(0, 0), left: P(-L.w / 2, yb - L.h / 2), right: P(L.w / 2, yb - L.h / 2), w: L.w * sc, h: L.h * sc, lines };
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
  withLight(o, () => {
    if (o.alpha != null && o.alpha < 1) {
      const A = signAnchors(o), sc = Math.abs(o.scale != null ? o.scale : 1);
      const R = Math.max(A.w, A.h) * 0.8 + 60 * sc;
      offscreen(ctx, [A.center.x - R, A.center.y - R - (o.burn ? 160 * sc : 0), A.center.x + R, A.ground.y + 20 * sc], { alpha: o.alpha }, (c) => signBody(c, { ...o, alpha: null }));
    } else signBody(ctx, o);
  }, true);
}
function signBody(ctx, o) {
  const L = signLayout(o);
  const B = begin(ctx, o);
  const k = B.k, t = o.t || 0, seed = o.seed != null ? o.seed : 7;
  const burn = clamp(o.burn || 0);
  const dripP = o.drips != null ? clamp(o.drips) * 0.5 : 0; // opt-in paint drips (close-ups)
  const W = PROP_COLORS.wood;
  const G = signGeom(o, L);
  const dirL = L.dirL;
  const yb = G.yb;
  const top = G.top;
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
    const ptop = posts.length > 1 || !L.arrow ? top - 11 : top + L.h * 0.3;
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
      ctx.fillStyle = tc(charMix('#E3B47D'));
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
      ctx.fillStyle = tc('#4E9A57');
      ctx.fill();
    }
  }
  // ---- board(s)
  const boards = G.boards.map((g) => {
    if (g.kind === 'arrow') {
      const jit = g.pts, r = 3.5;
      return {
        ...g,
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
      };
    }
    return { ...g, path: () => roundRect(ctx, g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0, g.r) };
  });
  const lineCY = (bd, li) => G.lineY[li];
  // char frontier (board coords): y below which the wood is charred
  const edgeK = (x) => smoothstep(L.w / 2 - 34, L.w / 2 + 4, Math.abs(x));
  const front = (x) => yb + 4 - burn * (L.h + 20) * (0.86 + 0.2 * noise1(x * 0.031 + seed * 1.3) + 0.09 * noise1(x * 0.13 + seed * 4.1) + 0.025 * Math.sin(t * 3 + x * 0.1)) - burn * L.h * 0.45 * edgeK(x);
  const paintCol = o.paint || (boardCol ? '#FFFFFF' : PROP_COLORS.paint);
  // secondary (lowercase) lines in the welcome sign's mint, like env's SNOOZE SPRINGS sign
  const paint2 = o.paint2 || (o.paint || boardCol ? paintCol : PROP_COLORS.paint2);
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
      const secondary = li > 0 && L.rel[li] < 0.95;
      const lc = mix(secondary ? paint2 : paintCol, '#2A1A12', burn * 0.5);
      const sh = boardCol ? rgba(mix(boardCol, '#000000', 0.6), 0.45) : 'rgba(58,32,14,0.45)';
      const maxW = (bd.x1 - bd.x0) - (L.arrow ? L.point : 0) - sz * 0.7;
      const hl = o.highlight === li ? clamp(o.highlightK != null ? o.highlightK : 1) : 0;
      const tw = Math.min(maxW, textW(txt, sz, L.weight));
      if (hl > 0) {
        // a warm wash behind the line it's about
        ctx.save();
        ctx.translate(G.lineX[li], cy);
        ctx.scale(1, 0.42);
        glow(ctx, 0, 0, tw * 0.62 + sz, '#FFE58A', 0.5 * hl);
        ctx.restore();
      }
      if (L.glyph) {
        const gw = sz * 1.15, tw2 = textW(txt, sz, L.weight);
        const total = tw2 + gw + sz * 0.35;
        const gx = dirL ? tcx - total / 2 + gw / 2 : tcx + total / 2 - gw / 2;
        const tx = dirL ? gx + gw / 2 + sz * 0.35 + tw2 / 2 : gx - gw / 2 - sz * 0.35 - tw2 / 2;
        ctx.save();
        ctx.scale(B.f, 1);
        arrowGlyph(ctx, gx * B.f, cy, gw, sz * 0.78, B.f > 0 ? dirL : !dirL, lc, sh);
        paintText(ctx, txt, tx * B.f, cy, sz, { color: lc, shadow: sh, seed: seed + li * 13, weight: L.weight, drips: dripP });
        ctx.restore();
      } else {
        ctx.save();
        ctx.scale(B.f, 1);
        paintText(ctx, txt, G.lineX[li] * B.f, cy, sz, { color: lc, shadow: sh, seed: seed + li * 13, weight: L.weight, maxW, drips: L.rel[li] < 0.9 ? 0 : dripP });
        ctx.restore();
      }
      if (hl > 0) {
        // hand-painted underline swipe, wiping in left → right
        ctx.save();
        ctx.scale(B.f, 1);
        const x0 = G.lineX[li] * B.f - tw / 2 - sz * 0.1, x1 = x0 + (tw + sz * 0.2) * ease.outCubic(hl), yU = cy + sz * 0.52;
        ctx.beginPath();
        ctx.moveTo(x0, yU + sz * 0.02);
        ctx.quadraticCurveTo((x0 + x1) / 2, yU - sz * 0.06, x1, yU + sz * 0.03);
        ctx.strokeStyle = tc('#FFD23F');
        ctx.lineWidth = sz * 0.13;
        ctx.lineCap = 'round';
        ctx.stroke();
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
      {
      // charcoal texture (no nested clip: marks are only placed below the ember front):
      // soft ash mottling + irregular dark cracks, the ones nearest the front still glowing
      const fl = 0.75 + 0.25 * Math.sin(t * 6 + seed);
      const R = rng(seed * 3.7 + bd.y0 * 0.13);
      const bw2 = bd.x1 - bd.x0, bh2 = bd.y1 - bd.y0;
      const below = (xx, yy, m = 2) => yy > front(xx) + m;
      ctx.fillStyle = 'rgba(120,96,84,0.16)';
      ctx.beginPath();
      for (let i = 0; i < Math.round(bw2 / 22); i++) {
        const ex = lerp(bd.x0, bd.x1, R()), ey = lerp(bd.y0, bd.y1, R()), erx = R.range(6, 16), ery = R.range(2, 4), ea = R.range(-0.2, 0.2);
        if (!below(ex, ey, ery + 1)) continue;
        ctx.moveTo(ex + erx * Math.cos(ea), ey + erx * Math.sin(ea));
        ctx.ellipse(ex, ey, erx, ery, ea, 0, TAU);
      }
      ctx.fill();
      const nCr = Math.round(Math.min(70, (bw2 * bh2) / 260) * clamp(burn * 1.8));
      const dark = new Path2D(), hot = new Path2D();
      for (let i = 0; i < nCr; i++) {
        let cx = lerp(bd.x0 - 4, bd.x1 + 4, R()), cy = lerp(bd.y0, bd.y1, R());
        const segs = 2 + Math.floor(R() * 3), dir = R() < 0.5 ? -1 : 1;
        const pts = [[cx, cy]], br = [];
        for (let q = 0; q < segs; q++) {
          cx += dir * R.range(3, 8);
          cy += R.range(-2.2, 2.2);
          pts.push([cx, cy]);
          if (R() < 0.35) br.push([cx, cy, cx + R.range(-1.5, 1.5), cy + R.range(2.5, 5)]);
        }
        if (!below(pts[0][0], pts[0][1], 2.5)) continue;
        const P2 = pts[0][1] - front(pts[0][0]) < 16 ? hot : dark;
        P2.moveTo(pts[0][0], pts[0][1]);
        for (let q = 1; q < pts.length; q++) P2.lineTo(pts[q][0], Math.max(pts[q][1], front(pts[q][0]) + 1.5));
        for (const [ax, ay, bx2, by2] of br) { P2.moveTo(ax, Math.max(ay, front(ax) + 1.5)); P2.lineTo(bx2, by2); }
      }
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(8,4,2,0.75)';
      ctx.lineWidth = 1.1 * k;
      ctx.stroke(dark);
      ctx.strokeStyle = rgba('#FF7A22', 0.9 * fl);
      ctx.stroke(hot);
      }
      ctx.beginPath();
      for (let xx = x0; xx <= x1 + 0.1; xx += 4) (xx === x0 ? ctx.moveTo(xx, front(xx)) : ctx.lineTo(xx, front(xx)));
      ctx.strokeStyle = 'rgba(255,120,30,0.45)';
      ctx.lineWidth = 5 * k;
      ctx.stroke();
      ctx.strokeStyle = '#FFB13B';
      ctx.lineWidth = 1.8 * k;
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
    // warm light on the surroundings: an ellipse hugging the board (its area is the cost)
    {
      const gx = L.w * 0.56, gy = L.h * 0.7 + 14;
      ctx.save();
      ctx.translate(0, (top + yb) / 2 - 4);
      ctx.scale(1, gy / gx);
      const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, gx);
      gg.addColorStop(0, rgba('#FF7A2E', 0.3 * burn));
      gg.addColorStop(0.45, rgba('#FF7A2E', 0.13 * burn));
      gg.addColorStop(1, rgba('#FF7A2E', 0));
      ctx.fillStyle = gg;
      circle(ctx, 0, 0, gx);
      ctx.fill();
      ctx.restore();
    }
    signFire(ctx, o, L, B, { xL, xR, top, yb, front, burn, t, seed, k });
  }
  ctx.restore();
}
// cheap smoke billows (4-lobe unions, solid fill + one lit lobe each): ONE union fill for the
// whole list (so overlapping billows merge instead of showing seams), one for the lit lobes
const SMOKE_LOBES = [[0, 0.1, 0.56], [-0.42, 0.12, 0.38], [0.42, 0.1, 0.4], [0.02, -0.28, 0.44]];
function smokeBlobs(ctx, list, pal, a) {
  if (!list.length || a <= 0.005) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.beginPath();
  for (const [x, y, r, id] of list) {
    const mir = hash1(id * 3.3) < 0.5 ? -1 : 1, sq = 0.85 + 0.25 * hash1(id * 5.1);
    for (const [cx, cy, cr] of SMOKE_LOBES) {
      const px = x + cx * r * mir * sq, py = y + cy * r, pr = cr * r;
      ctx.moveTo(px + pr, py);
      ctx.arc(px, py, pr, 0, TAU);
    }
  }
  ctx.fillStyle = tc(pal.base);
  ctx.fill();
  ctx.beginPath();
  for (const [x, y, r, id] of list) {
    const mir = hash1(id * 3.3) < 0.5 ? -1 : 1, sq = 0.85 + 0.25 * hash1(id * 5.1);
    // the top lobe, shrunk and nudged up-left: a lit cap on each billow
    const hx = x + (0.02 * mir * sq - 0.08) * r, hy = y - 0.34 * r, hr = 0.34 * r;
    ctx.moveTo(hx + hr, hy);
    ctx.arc(hx, hy, hr, 0, TAU);
  }
  ctx.fillStyle = tc(mix(pal.base, RIM ? mix(pal.light, RIM, 0.3) : pal.light, 0.6));
  ctx.fill();
  ctx.restore();
}
// Fire on a burning sign. Base points sit on the char front (board space), but flames, smoke and
// embers are drawn in a WORLD-UP frame (counter-rotated: a tilted or wobbling sign still burns
// straight up). Below burn ≈.55: separate licking flames of uneven height and phase; above it they
// merge into a continuous flame sheet with tongues. Smoke starts AT the flame tips: dark and dense
// near the source, growing, merging and drifting with noise as it rises.
function signFire(ctx, o, L, B, F) {
  const { xL, xR, top, yb, front, burn, t, seed, k } = F;
  const rot = o.rot || 0, f = B.f;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const W = (lx, ly) => [cr * f * lx - sr * ly, sr * f * lx + cr * ly];   // board → world-up frame
  ctx.save();
  ctx.scale(f, 1);
  ctx.rotate(-rot);
  const baseY = (x) => Math.min(yb - 2, Math.max(top + 1, front(x) + 1));
  // ---- flame sheet (merged fire) along the front
  const sheetK = smoothstep(0.5, 0.85, burn);
  const N = Math.max(8, Math.round((xR - xL) / 7));
  const Hs = (10 + 22 * burn) * sheetK;
  const tongues = [];
  {
    const R = rng(seed * 9.7 + 5);
    const nt = 2 + Math.round((xR - xL) / 55);
    for (let j = 0; j < nt; j++) tongues.push({ x: lerp(xL + 8, xR - 8, (j + 0.5) / nt + R.range(-0.3, 0.3) / nt), h: R.range(0.7, 1.5), w: R.range(10, 18), ph: R.range(0, 10) });
  }
  if (sheetK > 0.01) {
    const bot = [], hts = [];
    for (let i = 0; i <= N; i++) {
      const lx = lerp(xL + 3, xR - 3, i / N);
      bot.push(W(lx, baseY(lx)));
      let h = 0.32 + 0.22 * (0.5 + 0.5 * noise1(lx * 0.045 + t * 2.1 + seed));
      for (const tg of tongues) {
        const u = (lx - tg.x) / tg.w;
        if (Math.abs(u) < 1) h += tg.h * (0.75 + 0.35 * noise1(t * 6 + tg.ph)) * Math.pow(1 - u * u, 2);
      }
      // ends taper
      h *= smoothstep(0, 0.12, i / N) * smoothstep(0, 0.12, 1 - i / N) * 0.85 + 0.15;
      hts.push(h * Hs);
    }
    const layer = (sc, col, a) => {
      ctx.beginPath();
      ctx.moveTo(bot[0][0], bot[0][1] + 2);
      const tp = [];
      for (let i = 0; i <= N; i++) {
        const sway = noise1(t * 3.1 + i * 0.7 + seed) * 2.5 * sc * (hts[i] / Math.max(1, Hs));
        tp.push([bot[i][0] + sway, bot[i][1] - hts[i] * sc]);
      }
      // smooth flickering edge (quadratics through the midpoints)
      ctx.lineTo(tp[0][0], tp[0][1]);
      for (let i = 1; i < N; i++) ctx.quadraticCurveTo(tp[i][0], tp[i][1], (tp[i][0] + tp[i + 1][0]) / 2, (tp[i][1] + tp[i + 1][1]) / 2);
      ctx.lineTo(tp[N][0], tp[N][1]);
      ctx.lineTo(bot[N][0], bot[N][1] + 2);
      for (let i = N; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1] + 2);
      ctx.closePath();
      ctx.fillStyle = rgba(col, a);
      ctx.fill();
    };
    layer(1, '#F2471C', 0.9);
    layer(0.74, '#FF8A22', 1);
    layer(0.5, '#FFC73F', 1);
    layer(0.24, '#FFF4C8', 1);
  }
  // ---- separate flames (licking up from the front; uneven heights / phases / spacing)
  const nf = 2 + Math.round(burn * 6);
  const fl = [];
  const tips = [];
  {
    const R = rng(seed * 2.3 + 11);
    for (let j = 0; j < nf; j++) {
      const lx = lerp(xL + 6, xR - 6, clamp((j + 0.5) / nf + R.range(-0.32, 0.32) / nf));
      const [wx, wy] = W(lx, baseY(lx));
      const big = R() < 0.35;
      const fh = (10 + 26 * Math.pow(burn, 0.7)) * (big ? R.range(1.0, 1.35) : R.range(0.45, 0.85)) * (1 - 0.35 * sheetK);
      const fw = (8 + 9 * burn) * R.range(0.7, 1.15);
      fl.push({ x: wx, y: wy, h: fh, w: fw, seed: j * 3.7 + seed * 1.3 + R(), a: Math.min(1, burn * 3) });
      tips.push([wx, wy - fh * 0.9 - Hs * 0.6]);
    }
    // small licks on the char surface
    for (let j = 0; j < 4 * burn; j++) {
      const lx = lerp(xL + 10, xR - 10, hash1(seed * 5 + j));
      const ly = Math.min(yb - 2, Math.max(top + 4, front(lx) + 10 + hash1(j) * 10));
      const [wx, wy] = W(lx, ly);
      fl.push({ x: wx, y: wy, h: 6 + 6 * burn * hash1(j * 2.2), w: 5, seed: j * 2.7 + seed, a: Math.min(1, burn * 2) });
    }
  }
  // ---- smoke from the flame tips (drawn first: it rises behind the fire)
  {
    const cols = Math.min(L.w > 200 ? 3 : 2, tips.length);
    const NP = 7;
    const wind = o.smokeWind != null ? o.smokeWind : 0.35;
    // sources: the tallest tips spread across the sign
    const order = tips.map((p, i) => [p, i]).sort((A, Bq) => A[0][1] - Bq[0][1]).slice(0, cols).map((q) => q[0]);
    // billows bucketed by opacity + tone: each bucket is ONE union fill (neighbouring billows
    // merge into a column instead of stacking as separate clouds; and it is cheap)
    const buckets = new Map();
    for (let c = 0; c < order.length; c++) {
      const [sx0, sy0] = order[c];
      for (let i = 0; i < NP; i++) {
        const ph = t * 0.36 + i / NP + c * 0.29, p = frac(ph), id = (Math.floor(ph) * NP + i) % 23;
        // accelerates as it leaves the fire; billows out (grows), wanders, leans downwind
        const rise = Math.pow(p, 1.25) * (90 + 85 * burn);
        const px = sx0 + noise1(p * 2.6 + c * 7.1 + t * 0.35) * 20 * p + (hash1(id * 1.7 + c) - 0.5) * (4 + 14 * p) + wind * p * p * 60;
        const py = sy0 + 4 - rise;
        const rr = (5 + p * 34) * (1 + 0.25 * Math.min(1, burn * 1.5));
        const al = burn * Math.min(1, 0.45 + burn) * smoothstep(0, 0.05, p) * (1 - smoothstep(0.55, 1, p)) * (0.92 - 0.4 * p);
        if (al <= 0.02) continue;
        const dark = p < 0.3, qa = Math.max(1, Math.round(al * 6)) / 6;
        const key = (dark ? 'd' : 's') + qa;
        (buckets.get(key) || buckets.set(key, { dark, qa, list: [] }).get(key)).list.push([px, py, rr, id + c * 31 + seed]);
      }
    }
    // farthest (lightest) first so the dense smoke near the fire sits on top
    const bl = [...buckets.values()].sort((A, Bq) => (A.dark - Bq.dark) || (A.qa - Bq.qa));
    for (const bk of bl) smokeBlobs(ctx, bk.list, bk.dark ? PUFF_PAL.dark : PUFF_PAL.soot, bk.qa);
  }
  flames(ctx, fl, t);
  // ---- embers rising in world space (shrink as they rise; one fill)
  ctx.beginPath();
  for (let i = 0; i < 12 * burn; i++) {
    const p = frac(t * 0.8 + i * 0.137);
    const lx = lerp(xL, xR, hash1(i * 7.7 + seed));
    const [bx, by] = W(lx, baseY(lx));
    const ex = bx + Math.sin(t * 3 + i) * 6 + p * 14, ey = by - 10 - p * 90;
    const er = 1.5 * (1 - p) + 0.2;
    ctx.moveTo(ex + er, ey);
    ctx.arc(ex, ey, er, 0, TAU);
  }
  ctx.fillStyle = '#FFC04A';
  ctx.fill();
  ctx.restore();
}

// ═════════════════════════════════════════════════════════════════════ RAFT
const RAFT = {
  bundles: [ // back → front: centre y, thickness, half length, tip curl
    { cy: -45, d: 30, hl: 166, curl: 16 },
    { cy: -31, d: 32, hl: 175, curl: 20 },
    { cy: -8, d: 46, hl: 186, curl: 27 },   // the near bundle rides deep: ≈1/3 under water
  ],
  taper: 60, mastX: 34, mastBase: -50, mastTop: -262, flagW: 250, flagH: 50,
  lashX: [-118, -40, 40, 118],
  seats: [-128, -44, 44, 126], seatY: -42,
  // passengers drawn BETWEEN layer:'back' and layer:'front' put their ground (bottom) on this
  // line: the front bundle (flat top at y = frontTop) then hides their feet / bottom
  sitY: -24, frontTop: -31,
  hullBox: [-268, -122, 268, 34],   // local bbox of the hull layers (oar included)
  partBox: { back: [-268, -124, 268, 26], front: [-222, -60, 222, 30] },
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
// batched ropes: collect segments, then 2 strokes (outline + fill) + 1 for the twist ticks
function ropeBatch() { return []; }
function ropeAdd(B, x0, y0, x1, y1, bulge, w, ticks = 0) { B.push([x0, y0, x1, y1, bulge, w, ticks]); }
function ropeFlush(ctx, B, k) {
  if (!B.length) return;
  ctx.save();
  ctx.lineCap = 'round';
  const byW = new Map();
  for (const r of B) { const a = byW.get(r[5]) || []; a.push(r); byW.set(r[5], a); }
  for (const pass of [0, 1]) {
    for (const [w, list] of byW) {
      ctx.beginPath();
      for (const [x0, y0, x1, y1, bulge] of list) { ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + bulge, (y0 + y1) / 2, x1, y1); }
      ctx.strokeStyle = tc(pass ? PROP_COLORS.rope : PROP_COLORS.ropeLine);
      ctx.lineWidth = (pass ? w : w + 1.7) * k;
      ctx.stroke();
    }
  }
  ctx.beginPath();
  for (const [x0, y0, x1, y1, , w, n] of B) {
    for (let i = 1; i < n; i++) {
      const u = i / n, x = lerp(x0, x1, u), y = lerp(y0, y1, u);
      ctx.moveTo(x - w * 0.45, y - w * 0.3);
      ctx.lineTo(x + w * 0.45, y + w * 0.3);
    }
  }
  ctx.strokeStyle = 'rgba(122,84,40,0.75)';
  ctx.lineWidth = 0.75 * k;
  ctx.stroke();
  ctx.restore();
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
// ---- banner geometry (shared by drawRaftFlag and raftAnchors) -------------------------------
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
// flagPerch {k=1, w=48, at}: Gerald's weight on the banner. Material coordinate u (0 = mast …
// 1 = tail) maps to a physical position p(u) along the banner. His SEAT is fixed at uS (just past
// the first word 'S.S.', so it is the same point for every k): the cloth under and beyond him
// gathers into a crumple zone that grows OUTWARD from his feet (left to uL, right to zEnd)
// while the rest of the banner stays flat and readable and slides toward him (the tail). The
// zone is painted as opaque pleats over the lettering, so letters are swallowed by the folds,
// never squeezed or striped. At k = 1 all of 'TOLD YOU SO' is in a pile ≈w wide → 'S.S.'.
const PLEAT = 6;
function flagGeom(o, t, unfurl = 1) {
  const W = flagWave(o, t), FL = flagTextLayout(o);
  const P = o.flagPerch;
  const k = P ? clamp(P.k != null ? P.k : 1) : 0;
  let uA;
  if (P && P.at != null) uA = clamp(P.at, 0.05, 0.9);
  else {
    const firstEnd = FL.m.chars.indexOf(' ');
    let a0 = 0;
    for (let i = 0; i < (firstEnd > 0 ? firstEnd : FL.m.chars.length); i++) a0 += (FL.m.ws[i] * FL.fs) / 100;
    uA = clamp(FL.u0 + (a0 + FL.fs * 0.3) / RAFT.flagW, 0.05, 0.9);
  }
  const wPile = P && P.w != null ? Math.max(12, P.w) : 48;
  const hU = Math.min((1 - uA) / 2, wPile / 2 / RAFT.flagW);
  const uS = uA + hU;                                       // the seat (fixed)
  const e = ease.inOutSine(k);
  const uR = lerp(uS, 1, e);                                // cloth gathered so far (right side)
  const cz = hU * (1 - Math.exp(-(uR - uS) / hU));          // its physical width
  const comp = uR - uS > 1e-6 ? cz / (uR - uS) : 1;
  const uL = lerp(uS, uA, smoothstep(0, 0.45, k));          // crumpled under him (left side)
  const zEnd = uS + cz;
  const p = (u) => (u <= uS ? u : u <= uR ? uS + (u - uS) * comp : zEnd + (u - uR));
  const fw = RAFT.flagW * ease.outCubic(clamp(unfurl));
  const D = 17 * k;
  const zoneK = (pp) => (k <= 0 ? 0 : smoothstep(uL - 0.04, uL, pp) * (1 - smoothstep(zEnd, zEnd + 0.03, pp)));
  // weight: the banner sags toward the seat; the tail hangs off the pile
  const sag = (pp) => (k <= 0 ? 0 : D * (pp <= uS ? smoothstep(uA - 0.08, uS, pp) : 1 + 0.9 * smoothstep(zEnd, zEnd + 0.35, pp)));
  const damp = (pp) => 1 - k * (pp <= uL ? 0.6 * smoothstep(uA - 0.1, uL, pp) : pp <= zEnd ? 0.9 : 0.55);
  // accordion edges: a fold every PLEAT units of the pile (physical, measured from the seat:
  // new folds enter at the growing edges, none ever pops)
  const tri = (x) => 1 - 4 * Math.abs(x - Math.floor(x + 0.5));
  const phase = (u) => Math.abs(p(u) - uS) * RAFT.flagW / PLEAT;
  const zig = (u) => (k <= 0 ? 0 : tri(phase(u) / 2) * 1.8 * Math.min(1, k * 4) * zoneK(p(u)));
  const yT = (u) => { const pp = p(u); return W.dy(pp) * damp(pp) + pp * 1.5 + sag(pp) + zig(u); };
  const yB = (u) => { const pp = p(u); return RAFT.flagH - pp * 1.5 + W.dy(pp) * damp(pp) + sag(pp) * 1.45 + 5 * k * zoneK(pp) - zig(u); };
  // slope of the mid line vs physical x (for letter tilt)
  const slope = (u) => {
    const e2 = 0.004;
    return ((yT(u + e2) + yB(u + e2)) - (yT(u - e2) + yB(u - e2))) / 2 / (Math.max(1, fw) * (p(u + e2) - p(u - e2)) || 1);
  };
  return { W, FL, k, uA, uS, uR, uL, zEnd, comp, p, fw, yT, yB, slope, wPile, zoneK, phase };
}
function raftAnchors(o = {}) {
  const pz = raftPose(o);
  const s = o.scale != null ? o.scale : 1;
  const P = xform({ ...o, y: (o.y || 0) + pz.by * s, rot: (o.rot || 0) + pz.ang });
  const bF = RAFT.bundles[2], G = bundleGeom(bF);
  const flagDir = o.flagDir === -1 ? -1 : 1;
  const f = o.flip ? -1 : 1;
  const side = flagDir * f;
  const FG = flagGeom(o, o.t || 0);
  const FL = FG.FL;
  const my = RAFT.mastTop + 4;
  const X = (u) => RAFT.mastX + side * (2 + FG.p(u) * RAFT.flagW);
  const along2u = (al) => (flagDir > 0 ? FL.u0 + al / RAFT.flagW : FL.u0 + (FL.tw - al) / RAFT.flagW);
  const spanPt = (a0, a1) => {
    const u = along2u((a0 + a1) / 2), ua = along2u(a0), ub = along2u(a1);
    const p = P(X(u), my + (FG.yT(u) + FG.yB(u)) / 2 + 0.5);
    return { x: p.x, y: p.y, w: Math.abs(X(ub) - X(ua)) * s, h: FL.fs * 0.8 * s };
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
  let flagCover = firstEnd > 0 ? spanPt(coverA0, FL.tw) : spanPt(0, FL.tw);
  // Gerald's seat on the banner: ALWAYS returned (k = 0 included) and fixed along the banner for
  // every k — only its height follows the sag as he settles. Feet at the banner's mid height.
  const ps = P(X(FG.uS), my + lerp(FG.yT(FG.uS), FG.yB(FG.uS), 0.5));
  const flagPerch = { x: ps.x, y: ps.y, angle: (o.rot || 0) + pz.ang, w: Math.max(0, FG.zEnd - FG.uL) * RAFT.flagW * s, k: FG.k, geraldScale: 0.62 * s };
  // with flagPerch the cover IS the seat (kit on:'flag' puts Gerald's feet at its bottom-centre):
  // continuous for every k
  if (o.flagPerch) flagCover = { x: ps.x, y: ps.y - flagCover.h / 2, w: lerp(flagCover.w, FG.wPile * s, FG.k), h: flagCover.h };
  return {
    seats: RAFT.seats.map((sx) => P(sx, RAFT.seatY)),
    sits: RAFT.seats.map((sx) => P(sx, RAFT.sitY)),
    deck: P(0, RAFT.seatY),
    mastTop: P(RAFT.mastX, RAFT.mastTop - 9.6),
    flag: P(RAFT.mastX + side * RAFT.flagW * 0.5, RAFT.mastTop + 4 + RAFT.flagH / 2),
    flagWords, flagCover, flagPerch,
    geraldScale: 0.62 * s,
    tipL: P(-G.X * f, G.cyAt(G.X)), tipR: P(G.X * f, G.cyAt(G.X)),
    waterline: (o.y || 0) + pz.by * s,
    angle: (o.rot || 0) + pz.ang,
    sitY: RAFT.sitY, seatY: RAFT.seatY, scale: s,
  };
}
function drawSteeringOar(ctx, k, rimv) {
  // steering oar over the stern: handle on deck, blade trailing in the water
  ctx.save();
  ctx.translate(-150, -100);
  ctx.rotate(Math.atan2(104, -88) - PI / 2);
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
// ---- build timing (fractions of build 0..1). Bundle i starts at i·STEP; afloat it falls FALL,
// smacks into the river at land(i) (splash), dips and settles over SETTLE; on land it drops in
// and bounces (the old montage look).
const RB = { step: 0.13, win: 0.12, fall: 0.055, settle: 0.11, drop: 64 };
const raftLand = (i) => i * RB.step + RB.fall;
// each bundle floats at its own depth: its own waterline (≈1/3 of it under water). The back
// bundles' waterlines are hidden behind the nearer bundles once those land.
const BUNDLE_WL = RAFT.bundles.map((b, i, A) => (i === A.length - 1 ? 0 : b.cy + b.d / 2 - b.d / 3));
// half-width where each bundle's underside crosses its waterline
const BUNDLE_WET = RAFT.bundles.map((b, i) => {
  const G = bundleGeom(b);
  let x = 0;
  while (x < G.X && G.cyAt(x) + G.halfAt(x) > BUNDLE_WL[i] + 0.5) x += 1;
  return x;
});
// bundle i's motion at `build`: null (not yet) | {dy, sc}
function bundleMotion(i, build, float) {
  const b0 = i * RB.step;
  if (build <= b0) return null;
  if (!float) {
    const a = clamp((build - b0) / RB.win);
    return { dy: (1 - ease.outBounce(a)) * -80, sc: a < 1 ? lerp(0.55, 1, ease.outBack(clamp(a / 0.4), 2)) : 1 };
  }
  const land = b0 + RB.fall;
  if (build < land) {
    const q = (build - b0) / RB.fall;
    return { dy: -RB.drop * (1 - q * q), sc: lerp(0.72, 1, ease.outCubic(q)) };
  }
  // smack → dips under (≈4.4 units) → pops back up a hair → still
  const q = clamp((build - land) / RB.settle);
  return { dy: 8 * Math.sin(1.5 * PI * q) * Math.pow(1 - q, 1.5), sc: 1 };
}
// submerged tint of a BACK bundle (raft-local, below its own waterline; world-horizontal line).
// F.sub = {pal, a0, a1, angL}; drawn clipped to the bundle (its offset transform is current),
// the line itself lives in the raft frame M0.
function bundleSubTint(ctx, i, b, G, M0, sub) {
  ctx.save();
  bundlePath(ctx, b, G);
  ctx.clip();
  ctx.setTransform(M0);
  ctx.translate(0, BUNDLE_WL[i]);
  ctx.rotate(sub.angL);
  const g = ctx.createLinearGradient(0, 0, 0, 16);
  g.addColorStop(0, rgba(sub.pal.base, sub.a0));
  g.addColorStop(1, rgba(sub.pal.deep, sub.a1));
  ctx.fillStyle = g;
  ctx.fillRect(-260, 0, 520, 90);
  ctx.restore();
}
// one reed bundle (i = 0 back … 2 front) with tufts + tip wraps. mo = bundleMotion (build);
// F (live build only): {float, sub} — afloat, a back bundle gets its own submerged tint
function drawBundle(ctx, i, mo, build, k, rim, wet, F) {
  const C = PROP_COLORS.reed, NB = RAFT.bundles.length;
  const b = RAFT.bundles[i], G = bundleGeom(b);
  const M0 = F && F.sub && i < NB - 1 ? ctx.getTransform() : null;
  ctx.save();
  if (mo && (mo.dy || mo.sc !== 1)) {
    // drops in from above and pops to size (opaque the whole way: no see-through fade)
    ctx.translate(0, mo.dy);
    ctx.translate(0, b.cy);
    ctx.scale(mo.sc, mo.sc);
    ctx.translate(0, -b.cy);
  }
  // no clip: every layer is either the bundle path itself or a stroke that stays inside it
  // (AA clips were most of the raft's cost)
  const xs = bundlePath(ctx, b, G);
  ctx.fillStyle = lin(ctx, 0, b.cy - G.r, 0, b.cy + G.r, [C.top, C.mid, C.bottom]);
  ctx.fill();
  // underside shade + occlusion under the nearer bundle + waterline wetness: one extra fill
  {
    const y0 = b.cy - G.r, y1 = b.cy + G.r, H = y1 - y0;
    const st = [[0, 'rgba(90,60,20,0)']];
    if (i < NB - 1) {
      const nb = RAFT.bundles[i + 1];
      const yTop = nb.cy - nb.d / 2;
      const u0 = clamp((yTop - 8 - y0) / H), u1 = clamp((yTop + 1 - y0) / H);
      st.push([u0, 'rgba(90,60,20,0)'], [u1, 'rgba(90,60,20,0.42)']);
    } else {
      st.push([0.55, 'rgba(110,70,20,0)'], [1, 'rgba(110,70,20,0.3)']);
    }
    if (wet && i === NB - 1) {
      // underside shade + darker wet reeds near the waterline (y = 0)
      const uw = clamp((-13 - y0) / H);
      st.length = 0;
      st.push([0, 'rgba(90,60,20,0)'], [uw, 'rgba(70,70,45,0.05)'], [clamp((3 - y0) / H), 'rgba(60,72,60,0.45)'], [1, 'rgba(60,72,60,0.5)']);
    }
    const g2 = ctx.createLinearGradient(0, y0, 0, y1);
    for (const [u, c2] of st) g2.addColorStop(u, c2);
    ctx.fillStyle = g2;
    ctx.fill();
  }
  const edge = (v, dy = 0) => {
    ctx.beginPath();
    xs.forEach((x, n) => {
      const yy = G.cyAt(x) + 2 * G.halfAt(x) * v + dy;
      if (n) ctx.lineTo(x, yy); else ctx.moveTo(x, yy);
    });
  };
  // rim light: a crescent just inside the top edge (lit from the top-left)
  edge(-0.5, 1.9 + Math.max(0, rim[1] - 2) * 0.3);
  ctx.strokeStyle = tc(RIM ? mix(C.hi, RIM, 0.55) : C.hi);
  ctx.lineWidth = 2.4 * k;
  ctx.lineCap = 'round';
  ctx.stroke();
  // reed strands + short reed-joint ticks (one stroke)
  ctx.beginPath();
  for (let j = 1; j <= 3; j++) {
    const v = j / 4 - 0.5;
    xs.forEach((x, n) => {
      const yy = G.cyAt(x) + 2 * G.halfAt(x) * v + Math.sin(x * 0.045 + j * 2 + i) * 0.7;
      if (n) ctx.lineTo(x, yy); else ctx.moveTo(x, yy);
    });
  }
  const R = rng(17 + i);
  for (let q = 0; q < 16; q++) {
    const x = R.range(-b.hl + 40, b.hl - 40), v = R.range(-0.6, 0.5);
    const yy = b.cy + G.r * v;
    ctx.moveTo(x, yy - 1.6);
    ctx.lineTo(x + 0.6, yy + 1.6);
  }
  ctx.strokeStyle = 'rgba(122,90,36,0.4)';
  ctx.lineWidth = 0.9 * k;
  ctx.stroke();
  edge(-0.25);
  if (wet && i === NB - 1) { ctx.moveTo(-170, -6); ctx.lineTo(170, -6); }
  ctx.strokeStyle = 'rgba(255,248,210,0.5)';
  ctx.lineWidth = 1.2 * k;
  ctx.stroke();
  // afloat during the build: the back bundle's own submerged part (hidden behind the nearer
  // bundles once they land, so the cached final hull never needs it)
  if (M0) bundleSubTint(ctx, i, b, G, M0, F.sub);
  bundlePath(ctx, b, G);
  ctx.strokeStyle = tc(C.line);
  ctx.lineWidth = 1.8 * k;
  ctx.lineJoin = 'round';
  ctx.stroke();
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
  ctx.strokeStyle = tc(C.line);
  ctx.lineWidth = 1.3 * k;
  ctx.lineCap = 'round';
  ctx.stroke();
  // tip wraps (tight rope rings near both ends)
  const wa = clamp((build - 0.42 - i * 0.02) / 0.08);
  if (wa > 0) {
    const RB = ropeBatch();
    for (const sgn of [-1, 1]) {
      for (let w = 0; w < 2; w++) {
        const x = sgn * (b.hl - RAFT.taper * (0.3 + w * 0.2));
        const hh = G.halfAt(x) * wa + 0.3, cy = G.cyAt(x);
        ropeAdd(RB, x, cy - hh, x + sgn * 1.4, cy + hh, sgn * 2, 2.8);
      }
    }
    ropeFlush(ctx, RB, k);
  }
  ctx.restore();
}
// cross lashings binding the bundles. part 'upper' = over the back bundles (back layer),
// 'lower' = over the front bundle + knots (front layer)
function drawLashings(ctx, part, build, k, t) {
  const NB = RAFT.bundles.length;
  const b0 = RAFT.bundles[0], fb = RAFT.bundles[NB - 1];
  const yT = b0.cy - b0.d / 2 + 1, yM = fb.cy - fb.d / 2, yE = fb.cy + fb.d / 2 - 2;
  const RB = ropeBatch(), knots = [];
  RAFT.lashX.forEach((lx, j) => {
    const a = clamp((build - 0.48 - j * 0.05) / 0.06);
    if (a <= 0) return;
    const reach = lerp(yT, yE, ease.outCubic(a));
    if (part === 'upper') {
      const y1 = Math.min(reach, yM + 4);
      for (const dx of [-3.8, 3.8]) ropeAdd(RB, lx + dx - 1.5, yT, lx + dx - 0.1, y1, 1.2, 3.4, 6);
    } else if (reach > yM - 2) {
      for (const dx of [-3.8, 3.8]) ropeAdd(RB, lx + dx - 0.1, yM - 2, lx + dx + 1.5, reach, 1.4, 3.4, 6);
      if (a >= 1) knots.push([lx, j]);
    }
  });
  ropeFlush(ctx, RB, k);
  if (knots.length) {
    // knots + dangling ends (batched)
    ctx.beginPath();
    for (const [lx] of knots) { ctx.moveTo(lx + 5, fb.cy + 2); ctx.ellipse(lx, fb.cy + 2, 5, 4, 0, 0, TAU); }
    ctx.fillStyle = tc(PROP_COLORS.rope);
    ctx.fill();
    ctx.strokeStyle = tc(PROP_COLORS.ropeLine);
    ctx.lineWidth = 1.2 * k;
    ctx.stroke();
    ctx.beginPath();
    for (const [lx, j] of knots) {
      ctx.moveTo(lx + 1.5, fb.cy + 5);
      // static (the cached final hull has them too: no pop when the build completes)
      ctx.quadraticCurveTo(lx + 4, fb.cy + 12, lx + 1.5 + Math.sin(j * 2.3) * 1.2, fb.cy + 17);
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = tc(PROP_COLORS.ropeLine);
    ctx.lineWidth = 3 * k;
    ctx.stroke();
    ctx.strokeStyle = tc(PROP_COLORS.rope);
    ctx.lineWidth = 1.7 * k;
    ctx.stroke();
  }
}
// hull layer in raft-local space: 'back' = rear bundles + oar + upper lashings,
// 'front' = front bundle + lower lashings + knots. F (live build, optional) = {float, sub,
// extras, splash(i)}: afloat, each BACK bundle gets its own waterline (tint, foam, ripples,
// landing splash) right after it is drawn, so the next bundle covers it.
function drawHullPart(ctx, part, build, k, rim, dirLocal, t, wet, paddle, F) {
  const float = !!(F && F.float);
  const bundle = (i) => {
    const mo = bundleMotion(i, build, float);
    if (!mo) return;
    const backFx = F && F.extras && float && i < RAFT.bundles.length - 1;
    if (backFx) F.splash(ctx, i, 'back');
    drawBundle(ctx, i, mo, build, k, rim, wet, F);
    if (F && F.extras && float && i < RAFT.bundles.length - 1) F.backWater(ctx, i);
  };
  if (part === 'back') {
    for (let i = 0; i < 2; i++) bundle(i);
    const oarA = clamp((build - 0.95) / 0.05);
    if (paddle && oarA > 0) {
      ctx.save();
      ctx.translate(0, (1 - ease.outBounce(oarA)) * -40);
      // the steering oar trails at the STERN (opposite the direction of travel)
      if (dirLocal < 0) ctx.scale(-1, 1);
      drawSteeringOar(ctx, k, dirLocal < 0 ? [-rim[0], rim[1]] : rim);
      ctx.restore();
    }
    drawLashings(ctx, 'upper', build, k, t);
  } else {
    bundle(2);
    drawLashings(ctx, 'lower', build, k, t);
  }
}
// Static hull layers are cached as bitmaps: a pure function of constant params (part, device
// resolution (quantised to 1/8 octave), flip/oar side, wet, line weight, rim colour (quantised))
// drawn UNTINTED; the scene tint is applied at blit time on a cheap tinted copy (re-tinted in
// place when the quantised tint changes), so an animated light (the eruption grade) never
// re-renders the hull (only a rim-colour step of 24/255 does).
const HULL_CACHE = new Map(), HULL_TINT = new Map();
const quantHex = (hex, step) => U.rgbToHex(U.hexToRgb(hex).map((v) => Math.round(v / step) * step));
const hullRim = (flip) => [1.1 * (flip ? -1 : 1), 2.3];   // live path uses the same rim vector
const hullK = (s) => Math.round(lwf(s) * 50) / 50;         // ... and the same line weight
function hullBitmap(part, q, flip, dirLocal, wet, paddle, k) {
  const qq = Math.pow(2, Math.ceil(Math.log2(q) * 8) / 8);
  const rimQ = RIM ? quantHex(RIM, 24) : '';
  const key = [part, qq.toFixed(4), flip ? 1 : 0, dirLocal, wet ? 1 : 0, paddle ? 1 : 0, k, rimQ].join('|');
  let e = HULL_CACHE.get(key);
  if (e) { HULL_CACHE.delete(key); HULL_CACHE.set(key, e); return e; }
  const [X0, Y0, X1, Y1] = RAFT.partBox[part];
  const { createCanvas } = require('@napi-rs/canvas');
  const c = createCanvas(Math.ceil((X1 - X0) * qq), Math.ceil((Y1 - Y0) * qq));
  const x = c.getContext('2d');
  x.setTransform(qq, 0, 0, qq, -X0 * qq, -Y0 * qq);
  const pr = RIM, pt = TINT;
  RIM = rimQ || null; TINT = null;
  try { drawHullPart(x, part, 1, k, hullRim(flip), dirLocal, 0, wet, paddle); } finally { RIM = pr; TINT = pt; }
  e = { c, X0, Y0, w: X1 - X0, h: Y1 - Y0, key };
  HULL_CACHE.set(key, e);
  while (HULL_CACHE.size > 8) HULL_CACHE.delete(HULL_CACHE.keys().next().value);
  return e;
}
// the bitmap with the scene tint mixed in (source-atop fill == mixing every colour, as tc() does).
// One tinted copy per bitmap, re-tinted in place when the (quantised) tint changes.
function hullTinted(e, tint) {
  if (!tint || !(tint.amount > 0)) return e.c;
  // quantised (invisible: ≤ 3/255 per channel, ≤ 0.005 amount) so an animated grade re-tints
  // only every few frames
  const amt = Math.round(clamp(tint.amount) * 100) / 100;
  const col = quantHex(tint.color, 6);
  const tkey = col + '@' + amt;
  let v = HULL_TINT.get(e.key);
  if (!v) {
    const { createCanvas } = require('@napi-rs/canvas');
    const c = createCanvas(e.c.width, e.c.height);
    v = { c, x: c.getContext('2d'), tkey: null };
    HULL_TINT.set(e.key, v);
    while (HULL_TINT.size > 8) HULL_TINT.delete(HULL_TINT.keys().next().value);
  }
  if (v.tkey !== tkey) {
    const x = v.x;
    x.globalCompositeOperation = 'copy';
    x.drawImage(e.c, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = rgba(col, amt);
    x.fillRect(0, 0, v.c.width, v.c.height);
    x.globalCompositeOperation = 'source-over';
    v.tkey = tkey;
  }
  return v.c;
}
// x where the front bundle's underside crosses the waterline (local y = 0)
const HULL_WET_X = BUNDLE_WET[RAFT.bundles.length - 1];
function drawRaft(ctx, o = {}) {
  withLight(o, (L) => {
    if (o.alpha != null && o.alpha < 1) {
      const s = Math.abs(o.scale != null ? o.scale : 1), x = o.x || 0, y = o.y || 0;
      offscreen(ctx, [x - 300 * s, y - 330 * s, x + 300 * s, y + 60 * s], { alpha: o.alpha }, (c) => raftBody(c, { ...o, alpha: null }, L));
    } else raftBody(ctx, o, L);
  }, true);
}
function raftBody(ctx, o, L) {
  const t = o.t || 0;
  const layer = o.layer || 'both';
  const build = o.build != null ? clamp(o.build) : 1;
  const bob = o.bob || 0;
  const pz = raftPose(o);
  const s = o.scale != null ? o.scale : 1;
  const f = o.flip ? -1 : 1;
  const ang = (o.rot || 0) + pz.ang;
  const wl = (o.y || 0) + pz.by * s;                      // waterline (caller space)
  const toLocal = (c) => { c.translate(o.x || 0, wl); c.rotate(ang); c.scale(s * f, s); };
  const k = lwf(s);
  const kH = hullK(s), rimH = hullRim(o.flip);            // hull: identical live / cached
  const rim = rimVec({ rot: ang, flip: o.flip });
  const wet = o.wet != null ? o.wet : bob > 0;
  const dirLocal = (o.dir === 1 ? 1 : -1) * f;
  const wake = clamp(o.wake || 0);
  const paddle = o.paddle !== false;
  const floating = bob > 0 || o.waterY != null;
  const submerge = o.submerge != null ? !!o.submerge : floating;
  const pal = waterPal(o), spal = subPal(o);
  const water = submerge ? { y: o.waterY != null ? o.waterY : wl, pal: spal, a0: spal.neutral ? 0.42 : 0.55, a1: spal.neutral ? 0.8 : 0.9, depth: 16 * s } : null;
  const dur = o.buildDur > 0 ? o.buildDur : 1.3;
  const NB = RAFT.bundles.length, land2 = raftLand(NB - 1);
  // afloat: how far the front bundle's waterline treatment has ramped in (≈4 frames after it lands)
  const frontWet = build >= 1 ? 1 : ease.outCubic(clamp((build - land2) / 0.1));
  // caller-space bbox of a local box
  const P = xform({ x: o.x || 0, y: wl, rot: ang, scale: s, flip: o.flip });
  const cbox = (b) => {
    const pts = [P(b[0], b[1]), P(b[2], b[1]), P(b[0], b[3]), P(b[2], b[3])];
    return [Math.min(...pts.map((p) => p.x)), Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.y))];
  };
  // landing splash of bundle i (raft-local, sped up so all of it is over by build 1)
  const splash = (c, i, part) => {
    const tt = (build - raftLand(i)) * dur * 1.4;
    if (!(tt >= 0) || tt > 1.25 || build >= 1) return;
    const al = 1 - smoothstep(0.75, 1.2, tt);
    drawWaterSplash(c, { x: 0, y: BUNDLE_WL[i] + 1, w: BUNDLE_WET[i] * 0.8, r: 32 + 4 * i, t: tt, seed: i * 5 + 1, alpha: al, part, grade: o.grade, water: o.water });
  };
  // a back bundle's own waterline while the raft is being built (raft-local)
  const backWater = (c, i) => {
    const mo = bundleMotion(i, build, true);
    if (!mo || build < raftLand(i)) return;
    const on = ease.outCubic(clamp((build - raftLand(i)) / 0.1)) * (1 - smoothstep(raftLand(i + 1), raftLand(i + 1) + 0.12, build));
    if (on > 0.01) {
      const hw = BUNDLE_WET[i], wy = BUNDLE_WL[i];
      c.save();
      c.lineCap = 'round';
      c.beginPath();
      for (let q = 0; q <= 20; q++) {
        const xx = lerp(-hw, hw, q / 20);
        const yy = wy + 0.6 + Math.sin(xx * 0.09 + t * 2.6) * 0.9;
        if (q) c.lineTo(xx, yy); else c.moveTo(xx, yy);
      }
      c.strokeStyle = rgba(pal.foam, 0.8 * on);
      c.lineWidth = 2.2 * k;
      c.stroke();
      waterContact(c, 0, wy + 1, hw + 14, t * 0.8, pal, 1 / Math.sqrt(Math.max(0.05, Math.abs(s))), 0.55 * on, 'front', { ryK: 0.07, meniscus: false, spread: 0.35, maxSpread: 120 });
      c.restore();
    }
    splash(c, i, 'front');
  };
  const hull = (part) => {
    const dev = devScale(ctx) * Math.abs(s);
    const useCache = build >= 1 && dev <= 4.2 && o.cache !== false;
    let pass = 0;
    layered(ctx, cbox(RAFT.partBox[part]), { water }, (c) => {
      // water-only layers draw twice (normal + the submerged band): translucent extras
      // (foam, ripples, splashes) only on the first pass
      const extras = pass++ === 0;
      c.save();
      toLocal(c);
      if (useCache) {
        const e = hullBitmap(part, Math.max(0.25, devScale(c)), !!o.flip, dirLocal, wet, paddle, kH);
        c.imageSmoothingEnabled = true;
        c.imageSmoothingQuality = 'low';
        c.drawImage(hullTinted(e, TINT), e.X0, e.Y0, e.w, e.h);
      } else {
        const F = floating ? { float: true, extras, backWater, splash, sub: submerge ? { pal: spal, a0: water.a0, a1: water.a1, angL: -ang * f } : null } : null;
        drawHullPart(c, part, build, kH, rimH, dirLocal, 0, wet, paddle, F);
      }
      c.restore();
    });
  };
  // ================= BACK
  if (layer !== 'front') {
    // wake lines behind the stern (on the water)
    if (wake > 0 && build >= 1) {
      ctx.save();
      toLocal(ctx);
      ctx.lineCap = 'round';
      const sx = -dirLocal * 200;
      for (let i = 0; i < 6; i++) {
        const p = frac(t * 1.6 + i / 6);
        const len = (60 + 130 * wake) * (0.5 + 0.5 * hash1(i));
        const yy = 3 + (i % 2 ? 7 : -1) + p * 6;
        const x0 = sx - dirLocal * (p * 100 * wake);
        ctx.beginPath();
        ctx.moveTo(x0, yy);
        ctx.lineTo(x0 - dirLocal * len, yy + (i % 2 ? 5 : -2) * p);
        ctx.strokeStyle = rgba(pal.foam, 0.75 * wake * (1 - p));
        ctx.lineWidth = (4 - p * 3) * k;
        ctx.stroke();
      }
      ctx.restore();
    }
    hull('back');
    // mast, stays, banner (live: the banner waves)
    const ma = clamp((build - 0.7) / 0.12);
    if (ma > 0) {
      ctx.save();
      toLocal(ctx);
      drawMast(ctx, o, ma, build, k, rim, t, f);
      ctx.restore();
    }
  }
  // ================= FRONT
  if (layer !== 'back') {
    if (floating && build < 1) {
      // the front bundle's landing splash: the far wall goes behind it
      ctx.save();
      toLocal(ctx);
      splash(ctx, NB - 1, 'back');
      ctx.restore();
    }
    hull('front');
    if (floating && frontWet > 0) {
      // meniscus foam where the hull meets the water + lapping ripples (ramps in as the front
      // bundle lands during the build)
      ctx.save();
      const wy = water ? water.y : wl;
      const cx = o.x || 0, hw = HULL_WET_X * Math.abs(s);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const xx = lerp(cx - hw, cx + hw, i / 24);
        const yy = wy + 0.6 * s + Math.sin(xx / s * 0.09 + t * 2.6) * 0.9 * s;
        if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
      }
      ctx.strokeStyle = rgba(pal.foam, 0.8 * frontWet);
      ctx.lineWidth = 2.2 * k * s;
      ctx.stroke();
      for (const sg of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const fx2 = cx + sg * (hw + 2 * s + i * 5 * s), fy = wy + 1 * s + Math.sin(t * 4 + i * 2 + sg) * 0.8 * s;
          ellipse(ctx, fx2, fy, (4.5 - i) * s, (2 - i * 0.35) * s);
          ctx.fillStyle = rgba(pal.foam, (0.8 - i * 0.18) * frontWet);
          ctx.fill();
        }
      }
      const amp = 0.55 * Math.min(1, bob) * frontWet;
      if (amp > 0) waterContact(ctx, cx, wy + 1 * s, hw + 14 * s, t * 0.8, pal, Math.pow(Math.abs(s), 0.5), amp, 'front', { ryK: 0.07, meniscus: false, spread: 0.35, maxSpread: 120 * Math.abs(s) });
      ctx.restore();
    }
    if (floating && build < 1) {
      // the front bundle's landing splash (over the hull)
      ctx.save();
      toLocal(ctx);
      splash(ctx, NB - 1, 'front');
      ctx.restore();
    }
    if (wake > 0 && build >= 1) {
      ctx.save();
      toLocal(ctx);
      const bxp = dirLocal * 186;
      for (let i = 0; i < 5; i++) {
        const p = frac(t * 2.2 + i / 5);
        puff(ctx, bxp + dirLocal * (6 + p * 14) - dirLocal * i * 7, 5 - p * 12, (7 + p * 9) * (0.6 + wake * 0.6) * (1 - p * 0.5), i + 3, PUFF_PAL.white, Math.min(1, (1 - p) * 2) * wake, 0.9 * k, t);
      }
      ctx.restore();
    }
  }
}
function drawMast(ctx, o, ma, build, k, rim, t, f) {
  const b0 = RAFT.bundles[0];
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
function drawRaftFlag(ctx, o, mx, my, unfurl, t, k, f) {
  const flagDir = o.flagDir === -1 ? -1 : 1;
  const side = flagDir * f; // local x direction the banner extends to
  const FG = flagGeom(o, t, unfurl);
  const fw = FG.fw, fh = RAFT.flagH;
  if (fw < 2) return;
  const X = (u) => mx + side * (2 + FG.p(u) * fw);
  const notch = 0.13;
  const bunched = FG.k > 0.003;
  // material samples: even along the flat parts, at every pleat crease in the crumple zone
  const us = [];
  const flat = (u0, u1, n) => { for (let i = 0; i <= n; i++) us.push(lerp(u0, u1, i / n)); };
  const creases = [];
  if (bunched) {
    flat(0, FG.uL, Math.max(4, Math.round(16 * FG.uL)));
    // creases where the pleat phase hits a half-integer (left zone: from the seat leftwards)
    const left = [], right = [];
    for (let j = 1; ; j++) { const u = FG.uS - (j * PLEAT) / RAFT.flagW; if (u <= FG.uL) break; left.push(u); }
    for (let j = 1; ; j++) { const pp = FG.uS + (j * PLEAT) / RAFT.flagW; if (pp >= FG.zEnd) break; right.push(FG.uS + (pp - FG.uS) / FG.comp); }
    left.reverse();
    for (const u of left) { us.push(u); creases.push(u); }
    us.push(FG.uS); creases.push(FG.uS);
    for (const u of right) { us.push(u); creases.push(u); }
    if (FG.uR < 1) flat(FG.uR, 1, Math.max(3, Math.round(16 * (1 - FG.uR))));
    else us.push(1);
  } else flat(0, 1, 18);
  const outline = () => {
    ctx.beginPath();
    for (const u of us) ctx.lineTo(X(u), my + FG.yT(u));
    ctx.lineTo(X(1 - notch), my + (FG.yT(1 - notch) + FG.yB(1 - notch)) / 2);
    ctx.lineTo(X(1), my + FG.yB(1) - 1.5);
    for (let i = us.length - 1; i >= 0; i--) ctx.lineTo(X(us[i]), my + FG.yB(us[i]));
    ctx.closePath();
  };
  // shading follows the ripple
  const g = ctx.createLinearGradient(X(0), 0, X(1), 0);
  for (let i = 0; i <= 10; i++) {
    const u = i / 10, c = Math.cos(u * 2.3 * PI - FG.W.ph) * Math.min(1, u * 3) * (1 - FG.k);
    g.addColorStop(i / 10, tc(mix('#FFF8E6', '#D8C49C', clamp(0.5 - c * 0.5 * FG.W.wind - 0.1))));
  }
  const stripes = () => {
    ctx.beginPath();
    for (let i = 0; i < us.length; i++) { const u = us[i]; ctx.lineTo(X(u), my + 5 + FG.yT(u)); }
    ctx.moveTo(X(0), my + FG.yB(0) - 5);
    for (let i = 0; i < us.length; i++) { const u = us[i]; ctx.lineTo(X(u), my + FG.yB(u) - 5); }
    ctx.strokeStyle = tc('#E2463F');
    ctx.lineWidth = 3 * k;
    ctx.stroke();
  };
  // (no clip: fill, inner top-edge highlight, trim stripes, outline)
  outline();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < us.length; i++) { const u = us[i]; ctx.lineTo(X(u), my + FG.yT(u) + 1.6); }
  ctx.strokeStyle = tc(RIM ? mix('#FFFFFF', RIM, 0.4) : '#FFFFFF');
  ctx.lineWidth = 1.6 * k;
  ctx.lineJoin = 'round';
  ctx.stroke();
  stripes();
  // painted name, letter by letter riding the wave (reads left→right in caller space); letters
  // keep their shape — the ones in the crumple zone are covered by the pleats below
  const { m, fs, tw, u0 } = FG.FL;
  ctx.font = `700 ${fs}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let acc = 0;
  const worldLR = flagDir > 0;
  const shadowOn = fs * devScale(ctx) > 14;
  const zoneL = FG.uL, zoneR = FG.uR;
  for (let i = 0; i < m.chars.length; i++) {
    const cw = (m.ws[i] * fs) / 100;
    const along = acc + cw / 2;
    acc += cw;
    if (m.chars[i] === ' ' || (o.flagShow != null && i >= o.flagShow)) continue;
    const uu = worldLR ? u0 + along / RAFT.flagW : u0 + (tw - along) / RAFT.flagW;
    if (FG.p(uu) > ease.outCubic(clamp(unfurl)) + 0.001 && unfurl < 1) continue;
    // fully swallowed by the folds: skip
    const hw = cw / 2 / RAFT.flagW;
    if (bunched && uu - hw > zoneL && uu + hw < zoneR) continue;
    const px = X(uu), py = my + (FG.yT(uu) + FG.yB(uu)) / 2 + 0.5;
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(f, 1);
    ctx.rotate(Math.atan(FG.slope(uu) * side) * flagDir + (hash1(i * 3.1) - 0.5) * 0.08);
    if (shadowOn) {
      ctx.fillStyle = 'rgba(120,30,20,0.25)';
      ctx.fillText(m.chars[i], fs * 0.05, fs * 0.07);
    }
    ctx.fillStyle = tc('#C8322A');
    ctx.fillText(m.chars[i], 0, 0);
    ctx.restore();
  }
  // the crumple zone: OPAQUE pleats (lit narrow faces, shaded wide faces) over the lettering,
  // growing outward from Gerald's feet; broken trim stripes + a few crumpled paint scraps
  if (bunched && FG.zEnd - FG.uL > 0.002) {
    const zs = [FG.uL, ...creases.filter((u) => u > FG.uL && u < FG.uR), Math.min(1, FG.uR)];
    const quad = (ua, ub, ex = 0) => {
      ctx.beginPath();
      ctx.moveTo(X(ua), my + FG.yT(ua) - ex);
      ctx.lineTo(X(ub), my + FG.yT(ub) - ex);
      ctx.lineTo(X(ub), my + FG.yB(ub) + ex);
      ctx.lineTo(X(ua), my + FG.yB(ua) + ex);
      ctx.closePath();
    };
    ctx.save();
    outline();
    ctx.clip();
    const lit = tc('#FFF6E0'), shd = tc('#CDB58A'), mid = tc('#E8D9B8');
    for (let j = 0; j < zs.length - 1; j++) {
      const ua = zs[j], ub = zs[j + 1];
      // each fold: a lit sliver then a shaded face (alternating which side catches the light)
      const sp = j % 2 ? 0.38 : 0.62;
      const um = lerp(ua, ub, sp);
      quad(ua, um, 2);
      ctx.fillStyle = j % 2 ? lit : mid;
      ctx.fill();
      quad(um, ub, 2);
      ctx.fillStyle = j % 2 ? shd : lit;
      ctx.fill();
      // trim stripe scraps on the lit face
      const ul = j % 2 ? ua : um, ur = j % 2 ? um : ub;
      ctx.beginPath();
      ctx.moveTo(X(ul), my + 5 + FG.yT(ul)); ctx.lineTo(X(ur), my + 5 + FG.yT(ur));
      ctx.moveTo(X(ul), my + FG.yB(ul) - 5); ctx.lineTo(X(ur), my + FG.yB(ur) - 5);
      ctx.strokeStyle = tc('#E2463F');
      ctx.lineWidth = 2.6 * k;
      ctx.stroke();
      // crumpled paint: a scrap of red lettering caught in a fold (unreadable)
      if (hash1(j * 4.7 + 1.3) < 0.55 && Math.abs(X(ur) - X(ul)) > 2) {
        const yy = my + lerp(FG.yT(ul), FG.yB(ul), 0.35 + 0.3 * hash1(j * 2.1));
        ctx.beginPath();
        ctx.moveTo(X(ul) + side * 0.6, yy);
        ctx.lineTo(X(ur) - side * 0.4, yy + (hash1(j) - 0.5) * 6);
        ctx.strokeStyle = tc('#C8322A');
        ctx.lineWidth = 2.4 * k;
        ctx.stroke();
      }
    }
    // creases + soft shadow where the cloth dives into the folds
    ctx.beginPath();
    for (let j = 0; j < zs.length; j++) {
      const u = zs[j];
      ctx.moveTo(X(u), my + FG.yT(u) - 1);
      ctx.lineTo(X(u) + side * 0.6, my + FG.yB(u) + 1);
    }
    ctx.strokeStyle = rgba(tc('#8C6C40'), 0.75);
    ctx.lineWidth = 1 * k;
    ctx.stroke();
    for (const [ue, dir] of [[FG.uL, -1], [FG.uR, 1]]) {
      if (ue >= 1) continue;
      const xe = X(ue);
      ctx.fillStyle = lin(ctx, xe, 0, xe + side * dir * 9, 0, [rgba('#8C6C40', 0.35 * Math.min(1, FG.k * 3)), rgba('#8C6C40', 0)]);
      ctx.fillRect(Math.min(xe, xe + side * dir * 9), my - 20, 9, fh + 60);
    }
    ctx.restore();
  }
  outline();
  ctx.strokeStyle = tc('#9C7C4C');
  ctx.lineWidth = 1.3 * k;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // ties to the mast
  for (const yy of [my + 4, my + fh - 4]) {
    ellipse(ctx, mx, yy, 4.6, 2.4);
    ctx.fillStyle = tc(PROP_COLORS.rope);
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
function backpackBody(ctx, o = {}) {
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
function hammerBody(ctx, o = {}) {
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
function suitcaseBody(ctx, o = {}) {
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
  const { x = 0, y = 0, r = 20 } = o;
  withLight(o, (L) => {
    const trailL = r * (2.6 + 4.6 * clamp(o.trail || 0)) * 1.4 + r * 2;
    const box = [x - trailL, y - trailL, x + trailL, y + trailL];
    const fx = propFx(o, L);
    if (fx.water) fx.water.depth = o.waterDepth || Math.max(12, r * 1.2);
    layered(ctx, box, fx, (c) => rockBody(c, o));
    if (o.waterY != null) {
      const dy = o.waterY - y;
      if (Math.abs(dy) < r * 0.9) waterContact(ctx, x, o.waterY, Math.sqrt(r * r * 0.81 - dy * dy), (o.t || 0) + (o.seed || 1), subPal(o), Math.pow(r / 20, 0.5), 0.8);
    }
  }, true);
}
function rockBody(ctx, o) {
  const { x = 0, y = 0, r = 20, rot = 0, t = 0, seed = 1 } = o;
  const glowA = clamp(o.glow || 0), trail = clamp(o.trail || 0);
  const dir = o.dir != null ? o.dir : PI / 2;
  const C = PROP_COLORS.rock;
  const k = Math.pow(r / 20, 0.6);
  ctx.save();
  ctx.translate(x, y);
  // level of detail from the on-screen size (camera zoom + output scale included)
  const rs = r * devScale(ctx);
  const small = rs < 30;
  // trail (drawn in world-aligned space so it always streams behind the motion)
  if (trail > 0) {
    const back = dir + PI;
    const L = r * (2.6 + 4.6 * trail);
    ctx.save();
    ctx.rotate(back);
    // smoke puffs: single-layer unions (fade cleanly); fewer when small on screen
    const NPf = small ? 3 : 6;
    for (let i = 0; i < NPf; i++) {
      const p = frac(t * 2.4 + i / NPf);
      const d = r * 0.6 + p * L * 1.35;
      puff(ctx, d, Math.sin(t * 3 + i * 2) * r * 0.22 * p, r * (0.5 + 0.8 * p) * (0.6 + 0.4 * trail), i + seed * 3, PUFF_PAL.soot, (1 - p) * 0.75 * trail * Math.min(1, p * 6 + 0.2), 0, t, true);
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
    if (small) {
      // one streak with the hot core baked into its gradient
      streak(r * 0.95, L * fl, [rgba('#FFF2B0', trail), rgba('#FFB13B', 0.95 * trail), rgba('#FF5A1F', 0.6 * trail), rgba('#C8221A', 0)]);
    } else {
      streak(r * 1.05, L * fl, [rgba('#FF5A1F', 0.9 * trail), rgba('#FF3A1F', 0.5 * trail), rgba('#C8221A', 0)]);
      streak(r * 0.72, L * 0.7 * fl, [rgba('#FFB13B', trail), rgba('#FF7A2E', 0.6 * trail), rgba('#FF5A1F', 0)]);
      streak(r * 0.42, L * 0.42 * fl, [rgba('#FFF2B0', trail), rgba('#FFD06A', 0.5 * trail), rgba('#FFB13B', 0)]);
    }
    // sparks (one fill; they shrink out)
    ctx.beginPath();
    for (let i = 0; i < (small ? 3 : 6); i++) {
      const p = frac(t * 3.1 + i * 0.173);
      const sx = r + p * L * 0.9, sy = (hash1(i + seed) - 0.5) * r * 1.6 * (0.4 + p);
      const sr = (r * 0.06 + 0.4) * (1 - p) + 0.15;
      ctx.moveTo(sx + sr, sy);
      ctx.arc(sx, sy, sr, 0, TAU);
    }
    ctx.fillStyle = rgba('#FFE08A', trail);
    ctx.fill();
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
      if (!small) {
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
        // vesicles (two batched fills)
        ctx.beginPath();
        for (const [px, py, pr] of S.pores) { ctx.moveTo(px * r + pr * r, py * r); ctx.ellipse(px * r, py * r, pr * r, pr * r * 0.8, 0, 0, TAU); }
        ctx.fillStyle = 'rgba(20,16,24,0.45)';
        ctx.fill();
        ctx.beginPath();
        for (const [px, py, pr] of S.pores) { const ex = px * r + pr * r * 0.3, ey = py * r + pr * r * 0.35; ctx.moveTo(ex + pr * r * 0.6, ey); ctx.ellipse(ex, ey, pr * r * 0.6, pr * r * 0.4, 0, 0, TAU); }
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
        if (!small) {
          ctx.strokeStyle = rgba('#FF5A1F', 0.45 * hot * fl);
          ctx.lineWidth = r * 0.17;
          ctx.stroke();
        }
        ctx.strokeStyle = rgba('#FFB13B', hot * fl);
        ctx.lineWidth = r * (small ? 0.1 : 0.075);
        ctx.stroke();
        if (!small) {
          ctx.strokeStyle = rgba('#FFF2B0', hot * fl);
          ctx.lineWidth = r * 0.025;
          ctx.stroke();
        }
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
function whistleBody(ctx, o = {}) {
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
function flashlightBody(ctx, o = {}) {
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
function bandageBody(ctx, o = {}) {
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
function mapBody(ctx, o = {}) {
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
function candleBody(ctx, o = {}) {
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
function notepadBody(ctx, o = {}) {
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
function chartBody(ctx, o = {}) {
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


// lighting (o.light / o.grade / o.tint) + whole-layer alpha for the small props: through one
// offscreen layer only when asked for, else a direct call (no overhead)
function withFx(body, R) {
  return (ctx, o = {}) => {
    const s = Math.abs(o.scale != null ? o.scale : 1), x = o.x || 0, y = o.y || 0, rr = R * s + 8;
    fxWrap(ctx, o, [x - rr, y - rr, x + rr, y + rr], (c) => body(c, o.alpha != null && o.alpha < 1 ? { ...o, alpha: null } : o));
  };
}
const drawBackpack = withFx(backpackBody, 110);
const drawHammer = withFx(hammerBody, 90);
const drawSuitcase = withFx(suitcaseBody, 60);
const drawWhistle = withFx(whistleBody, 50);
const drawFlashlight = withFx(flashlightBody, 280);
const drawBandage = withFx(bandageBody, 60);
const drawMap = withFx(mapBody, 80);
const drawCandle = withFx(candleBody, 90);
const drawNotepad = withFx(notepadBody, 80);
const drawChart = withFx(chartBody, 150);

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
// a fading puff fades as ONE layer: through an offscreen layer when it is big on screen,
// as a single union fill when small (either way no inner outlines show through)
function puffFaded(ctx, o, x, y, rr, seed, pal, a, lw, t) {
  if (a <= 0.004) return;
  if (a >= 0.985) { puff(ctx, x, y, rr, seed, pal, 1, lw, t); return; }
  if (rr * devScale(ctx) < 20) { puff(ctx, x, y, rr, seed, pal, a, 0, t, true); return; }
  offscreen(ctx, [x - rr * 1.3, y - rr * 1.1, x + rr * 1.3, y + rr * 1.1], { alpha: a }, (c) => puff(c, x, y, rr, seed, pal, 1, lw, t));
}
function drawSteamPuff(ctx, o = {}) {
  const { x = 0, y = 0, r = 20, seed = 1, t = 0 } = o;
  const L = puffLife(o, r);
  const a = (o.alpha != null ? o.alpha : 0.9) * L.a;
  withLight(o, () => puffFaded(ctx, o, x + Math.sin(t * 1.3 + seed) * r * 0.08, y + L.dy, L.rr, seed, PUFF_PAL.steam, a, 1.1 * Math.pow(r / 20, 0.5), t), true);
}
function drawSmokePuff(ctx, o = {}) {
  const { x = 0, y = 0, r = 24, seed = 2, t = 0, tone = 'grey' } = o;
  const L = puffLife(o, r);
  const a = (o.alpha != null ? o.alpha : 1) * L.a;
  withLight(o, () => puffFaded(ctx, o, x + Math.sin(t * 1.1 + seed) * r * 0.06, y + L.dy, L.rr, seed, PUFF_PAL[tone] || PUFF_PAL.grey, a, 1.3 * Math.pow(r / 24, 0.5), t), true);
}
// Water splash where something drops into the pool/river. (x, y) = entry point ON the
// water surface; t = seconds since entry (nothing for t < 0, done after ~1.4 s).
// r ≈ half-width of the crown. big:true adds a tall centre jet (raft launch, big plops).
// w = half-length of a LONG entry (a reed bundle, the raft): the crown, foam and rings stretch
// into a stadium 2w longer. Water is see-through: translucent crown body (the water behind
// shows through), near-white foam rims / tips / beads, no dark outlines.
// stadium point at angle th (y+ = front, toward the viewer), half-length w, radii rx, ry
const stadPt = (th, w, rx, ry) => { const c = Math.cos(th); return [c * rx + (c > 0 ? w : c < 0 ? -w : 0), Math.sin(th) * ry]; };
// point at arc-length fraction u (0 = left end → 1 = right end) along the front (sgn 1) or back
// (sgn -1) half of that stadium
function stadU(u, w, rx, ry, sgn) {
  const q = (PI / 2) * Math.sqrt((rx * rx + ry * ry) / 2), L = 2 * q + 2 * w, d = u * L;
  if (d < q) { const th = PI - (d / q) * (PI / 2); return [Math.cos(th) * rx - w, sgn * Math.sin(th) * ry]; }
  if (d > q + 2 * w) { const th = (PI / 2) * (1 - (d - q - 2 * w) / q); return [Math.cos(th) * rx + w, sgn * Math.sin(th) * ry]; }
  return [d - q - w, sgn * ry];
}
function drawWaterSplash(ctx, o = {}) {
  const { x = 0, y = 0, r = 24, t = 0, seed = 4, big = false } = o;
  const w = Math.max(0, o.w || 0);
  const part = o.part || 'both', doBack = part !== 'front', doFront = part !== 'back';
  if (t < 0 || t > 1.6) return;
  if (o.alpha != null && o.alpha <= 0.003) return;
  const WP = o.colors ? { ...waterPal(o), ...o.colors } : waterPal(o);
  // light grade only: the splash is mostly white water + see-through body
  const foam = mix(WP.foam, '#FFFFFF', 0.6);
  const bodyTop = mix(WP.top, '#FFFFFF', 0.3), bodyMid = mix(WP.mid, WP.top, 0.25);
  const k = Math.pow(r / 24, 0.55);
  const R = rng(seed * 5.1 + 1);
  ctx.save();
  ctx.translate(x, y);
  if (o.alpha != null && o.alpha < 1) ctx.globalAlpha *= clamp(o.alpha);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const ring = (rx, ry, th0 = 0, th1 = TAU) => {
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const p = stadPt(lerp(th0, th1, i / n), w, rx, ry);
      if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
    }
  };
  // ripple rings on the surface (perspective)
  for (let i = 0; i < 3; i++) {
    const p = clamp((t - i * 0.16) / 1.25);
    if (p <= 0 || p >= 1) continue;
    const rx = r * (0.7 + 2.3 * ease.outCubic(p));
    ctx.beginPath();
    if (part === 'both') ring(rx, rx * 0.24); else ring(rx, rx * 0.24, doBack ? PI : 0, doBack ? TAU : PI);
    ctx.strokeStyle = rgba(foam, 0.7 * (1 - p));
    ctx.lineWidth = (2.6 - 1.6 * p) * k;
    ctx.stroke();
  }
  const pc = clamp(t / 0.62);
  if (pc < 1) {
    const hgt = r * (big ? 1.45 : w > 0 ? 1.3 : 1.1) * Math.sin(PI * Math.pow(pc, 0.65));
    const spread = r * (0.5 + 0.7 * ease.outCubic(pc));
    const crownA = 1 - smoothstep(0.7, 1, pc);
    // crown wall: back half (behind the entry point) then the front lip
    const wall = (backSide) => {
      const sgn = backSide ? -1 : 1;
      const n = Math.max(backSide ? 5 : 4, Math.round((backSide ? 5 : 4) + (2 * w) / (r * (backSide ? 1.1 : 1.2))));
      const base = (u) => (w > 0 ? stadU(u, w, spread * 1.04, spread * 0.27, sgn) : stadPt(PI + sgn * u * PI, 0, spread * 1.04, spread * 0.27));
      const peaks = [];
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5 + (hash1(seed * 3.7 + i) - 0.5) * (w > 0 ? 0.7 : 0.35)) / n;
        const [bx, by] = base(u);
        const mid = w > 0 ? 0.45 + 0.55 * Math.pow(hash1(seed * 9.1 + i), 1.2) : 1 - Math.abs(u - 0.5) * 0.7;
        const h = hgt * mid * (backSide ? 0.5 + 0.5 * hash1(seed + i * 3.3) : (w > 0 ? 0.55 : 0.36) + 0.3 * hash1(seed * 2 + i));
        // tips splay OUTWARD from the core (the entry segment for long splashes)
        const cx = clamp(bx, -w, w), ox = bx - cx;
        const lean = (hash1(seed * 1.3 + i * 7.7) - 0.5) * 0.3 * h;
        peaks.push({ bx, by, h, tx: bx + ox * 0.6 * h / Math.max(1, r) + lean, ty: by - h });
      }
      // valleys between the peaks: a lace for a round plop, a solid curtain for a long entry
      const dip = hgt * (w > 0 ? 0.38 : backSide ? 0.22 : 0.14);
      const top = () => {
        let p0 = base(0);
        ctx.moveTo(p0[0], p0[1]);
        peaks.forEach((pk, i) => {
          const v = base(i / n), nv = base((i + 1) / n);
          const vy = i === 0 ? p0[1] : v[1] - dip, vx = v[0];
          ctx.quadraticCurveTo(lerp(vx, pk.tx, 0.6), vy, pk.tx, pk.ty);
          const ny = i === n - 1 ? nv[1] : nv[1] - dip;
          ctx.quadraticCurveTo(lerp(nv[0], pk.tx, 0.6), ny, nv[0], ny);
        });
      };
      ctx.beginPath();
      top();
      const nb = 16 + Math.round(w / r * 4);
      for (let j = nb; j >= 0; j--) { const q = base(j / nb); ctx.lineTo(q[0], q[1] + 1.5); }
      ctx.closePath();
      // whitewater at the crest → see-through body → clear at the surface
      const gr = ctx.createLinearGradient(0, -hgt, 0, spread * 0.27);
      gr.addColorStop(0, rgba(foam, 0.9 * crownA));
      gr.addColorStop(0.3, rgba(bodyTop, 0.72 * crownA));
      gr.addColorStop(0.75, rgba(bodyTop, 0.42 * crownA));
      gr.addColorStop(1, rgba(bodyMid, (backSide ? 0.25 : 0.4) * crownA));
      ctx.fillStyle = gr;
      ctx.fill();
      // a slightly darker lower edge where the wall meets the surface (front lip only)
      if (!backSide) {
        ctx.beginPath();
        for (let j = 0; j <= nb; j++) { const q = base(j / nb); if (j) ctx.lineTo(q[0], q[1] + 1); else ctx.moveTo(q[0], q[1] + 1); }
        ctx.strokeStyle = rgba(WP.deep, 0.22 * crownA);
        ctx.lineWidth = 1.4 * k;
        ctx.stroke();
      }
      // white foam rim along the torn top edge + glossy streaks up the peaks
      ctx.beginPath();
      top();
      ctx.strokeStyle = rgba(foam, 0.6 * crownA);
      ctx.lineWidth = (backSide ? 1 : 1.3) * k;
      ctx.stroke();
      ctx.beginPath();
      peaks.forEach((pk) => {
        ctx.moveTo(lerp(pk.bx, pk.tx, 0.12) - spread * 0.05, pk.by - pk.h * 0.12);
        ctx.quadraticCurveTo(lerp(pk.bx, pk.tx, 0.45) - spread * 0.06, pk.by - pk.h * 0.55, lerp(pk.bx, pk.tx, 0.85), pk.ty + pk.h * 0.16);
      });
      ctx.strokeStyle = rgba('#FFFFFF', (w > 0 ? 0.22 : 0.4) * crownA);
      ctx.lineWidth = 1.1 * k;
      ctx.stroke();
      // foam tips + beads pinching off the tallest peaks
      ctx.beginPath();
      peaks.forEach((pk, i) => {
        // foam cap: a small white teardrop riding each tip
        const tr = r * 0.06 * (0.7 + 0.6 * hash1(seed * 4.1 + i)) * (1 - pc * 0.4);
        dropPath(ctx, pk.tx, pk.ty + tr * 0.6, tr, Math.atan2(pk.tx - pk.bx, pk.by - pk.ty), 2.2, true, 0.5);
        if (!backSide || hash1(seed * 5 + i * 1.9) < 0.45 || pc < 0.22) return;
        const lift = r * (0.12 + 0.3 * smoothstep(0.22, 0.9, pc)) * (0.6 + 0.4 * hash1(seed + i));
        const br = r * (0.06 + 0.03 * hash1(seed * 3 + i)) * (1 - pc * 0.4);
        const bx2 = pk.tx * (1 + 0.15 * pc), by2 = pk.ty - br - lift;
        ctx.moveTo(bx2 + br, by2);
        ctx.arc(bx2, by2, br, 0, TAU);
      });
      ctx.fillStyle = rgba(foam, 0.95 * crownA);
      ctx.fill();
    };
    if (doBack) {
      wall(true);
      // churned white water in the middle
      ctx.beginPath();
      ring(spread * 0.85, spread * 0.2);
      ctx.fillStyle = rgba(foam, 0.85 * (1 - pc));
      ctx.fill();
    }
    // centre jet (Worthington column) for big splashes: thick at the base, tapering, pinching
    // off 3 teardrop drops that sail up a little higher and fall back in
    if (big && doBack) {
      const g = r * 20, H = r * 2.3;
      const tau = t - 0.08;
      if (tau > 0) {
        const pj = clamp(tau / 0.95);
        const jh = H * Math.pow(Math.sin(PI * pj), 0.85);
        if (jh > 1 && pj < 1) {
          const wb = r * 0.42 * (1 - 0.3 * pj), wt = r * 0.12;
          ctx.beginPath();
          ctx.moveTo(-wb * 1.5, 2);
          ctx.bezierCurveTo(-wb * 0.55, -jh * 0.08, -wt * 1.4, -jh * 0.5, -wt, -jh + wt);
          ctx.arc(0, -jh + wt, wt, PI, 0);
          ctx.bezierCurveTo(wt * 1.4, -jh * 0.5, wb * 0.55, -jh * 0.08, wb * 1.5, 2);
          ctx.closePath();
          // the next drop swelling at the tip
          const bR = wt * (1.15 + 0.35 * smoothstep(0.1, 0.4, pj));
          ctx.moveTo(bR, -jh + bR * 0.9);
          ctx.arc(0, -jh + bR * 0.9, bR, 0, TAU);
          const gj = ctx.createLinearGradient(0, -jh, 0, 0);
          gj.addColorStop(0, rgba(bodyTop, 0.8));
          gj.addColorStop(1, rgba(bodyMid, 0.5));
          ctx.fillStyle = gj;
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(-wb * 0.45, -jh * 0.06);
          ctx.quadraticCurveTo(-wt * 1.6, -jh * 0.45, -wt * 0.4, -jh * 0.9);
          ctx.strokeStyle = rgba('#FFFFFF', 0.75);
          ctx.lineWidth = 1.5 * k;
          ctx.stroke();
          ellipse(ctx, 0, 1, wb * 1.6, wb * 0.35);
          ctx.fillStyle = rgba(foam, 0.8);
          ctx.fill();
        }
        // drops pinched off the top: ballistic from the column top at τj
        const vTop = (tt) => (H * PI / 0.95) * 0.85 * Math.cos(PI * clamp(tt / 0.95));
        for (let j = 0; j < 3; j++) {
          const tj = 0.2 + j * 0.09;
          const dt = tau - tj;
          if (dt <= 0) continue;
          const y0 = -H * Math.pow(Math.sin(PI * clamp(tj / 0.95)), 0.85);
          const v0 = Math.max(r * 2, vTop(tj) * 1.25);
          const vx = (j - 1) * r * 0.35;
          const px = vx * dt, py = y0 - v0 * dt + 0.5 * g * dt * dt;
          if (py > -r * 0.05) continue;   // fell back in
          const dr = r * [0.12, 0.095, 0.075][j];
          dropPath(ctx, px, py, dr, trailAng(vx, -v0 + g * dt), 1.9, false, 0.45);
          ctx.fillStyle = rgba(bodyTop, 0.92);
          ctx.fill();
          circle(ctx, px - dr * 0.35, py - dr * 0.25, dr * 0.32);
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.fill();
        }
      }
    }
    if (doFront) wall(false);
  }
  // flying droplets (along the whole entry for long splashes)
  const nd = !doFront ? 0 : (big ? 16 : 10) + Math.round(w / r * 3);
  ctx.beginPath();
  const hl = [];
  for (let i = 0; i < nd; i++) {
    const t0 = 0.04 + R() * 0.12;
    const a = -PI / 2 + R.range(-1.1, 1.1);
    const v = r * R.range(4, 7.5) * (big ? 1.25 : 1);
    const x0 = w ? R.range(-w, w) : 0;
    const dr = r * R.range(0.05, 0.1);
    const tt = t - t0;
    if (tt <= 0) continue;
    const vx = Math.cos(a) * v, vy = Math.sin(a) * v, g = r * 22;
    const px = x0 + vx * tt, py = vy * tt + 0.5 * g * tt * tt;
    if (py > r * 0.1) continue; // fell back in
    dropPath(ctx, px, py, dr, trailAng(vx, vy + g * tt), 1.6, true, 0.5);
    hl.push([px - dr * 0.35, py - dr * 0.2, dr * 0.34]);
  }
  ctx.fillStyle = rgba(bodyTop, 0.92);
  ctx.fill();
  ctx.beginPath();
  for (const [hx, hy, hr] of hl) { ctx.moveTo(hx + hr, hy); ctx.arc(hx, hy, hr, 0, TAU); }
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fill();
  ctx.restore();
}
function drawImpactBurst(ctx, o = {}) {
  if (o.t != null && (o.t < 0 || o.t > 0.7)) return;
  const r = o.r || 56;
  fxWrap(ctx, o, [(o.x || 0) - r * 2.2, (o.y || 0) - r * 2.2, (o.x || 0) + r * 2.2, (o.y || 0) + r * 2.2], (c) => burstBody(c, o));
}
function burstBody(ctx, o) {
  const { x = 0, y = 0, r = 56, text = 'BONK!', rot = -0.08, seed = 5 } = o;
  const t = o.t;
  let sx = 1, sy = 1;
  if (t != null) {
    // the HIT FRAME is the peak (t in [0, 1/24) → 1.18× overshoot, on the bonk sfx), then it
    // settles with a quick damped wobble, holds, and exits by squashing to nothing in ~3 frames
    // (0.55-0.68 s) — never alpha-faded, so its layers never show through each other
    const pin = 1 + 0.18 * Math.exp(-t * 14) * Math.cos(t * 40);
    const e = clamp((t - 0.55) / 0.13);
    const out = e < 0.3 ? 1 + 0.08 * (e / 0.3) : 1.08 * (1 - ease.inCubic((e - 0.3) / 0.7));
    sx = pin * out;
    sy = pin * out * (1 - 0.35 * e);
    if (sx <= 0.02) return;
  }
  const tt = t || 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot + (t != null ? Math.sin(tt * 30) * 0.03 * (1 - clamp(tt / 0.3)) : 0));
  ctx.scale(sx, sy);
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
  ctx.fillText(cleanText(text), x, y);
  ctx.restore();
}
function sheetBg2(ctx, x, y, w, h, a = '#CFE6F0', b = '#F4E7CF') {
  ctx.save();
  ctx.fillStyle = lin(ctx, 0, y, 0, y + h, [a, b]);
  ctx.fillRect(x, y, w, h);
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
    cell(i++, 'orange squash .5 / 1', (x, y) => { drawOrange(ctx, { x: x - 40, y: y + 8, r: 20, squash: 0.5, t, seed: 2 }); drawOrange(ctx, { x: x + 40, y: y + 8, r: 20, squash: 1, t, seed: 3 }); });
    cell(i++, 'drawJuiceSplat t=.18', (x, y) => drawJuiceSplat(ctx, { x, y: y + 10, r: 26, t: 0.18 }));
    cell(i++, 'drawHelmet', (x, y) => drawHelmet(ctx, { x, y: y + 10, scale: 1.2 }));
    cell(i++, 'drawThermometer', (x, y) => drawThermometer(ctx, { x: x - 20, y: y + 46, scale: 0.85, level: thermoLevel(39.2), reading: '39.2' }));
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
    cell(i++, 'thermo pop (since .93)', (x, y) => drawThermometer(ctx, { x, y: y + 46, scale: 0.85, level: 0.7, since: 0.93, popTime: 0.9, t }));
    cell(i++, 'raft flagPerch (Gerald gag)', (x, y) => drawRaft(ctx, { x: x - 14, y: y + 44, scale: 0.3, t, flagPerch: { k: 1 } }));
    cell(i++, 'hammer swing', (x, y) => { drawMotionLines(ctx, { x: x - 30, y: y + 30, t, count: 3, arc: { r: 62, a0: -2.2, a1: -0.5 } }); drawHammer(ctx, { x: x - 30, y: y + 30, rot: 0.9, scale: 0.9 }); drawImpactBurst(ctx, { x: x + 40, y: y + 34, r: 22, text: '', t: 0.1 }); });
  },
  orange(ctx, t) {
    sheetBg(ctx);
    const sq = [0, 0.05, 0.12, 0.18, 0.25, 0.4, 0.55, 0.75, 1];
    sq.forEach((s, i) => {
      const x = 75 + i * 141;
      drawOrange(ctx, { x, y: 150, r: 46, squash: s, t, seed: 2 });
      lbl(ctx, `squash ${s}`, x, 225);
    });
    // bounce (squash & stretch, separate from the smash) — the s04 orange_rolls hops
    [-0.5, -0.25, 0, 0.25, 0.5, 0.8].forEach((b, i) => {
      const x = 80 + i * 105;
      drawOrange(ctx, { x, y: 320, r: 34, bounce: b, t, seed: 2 });
      lbl(ctx, `bounce ${b}`, x, 372, 13);
    });
    // juice splat over time (t = 0 is the HIT frame: already the biggest)
    [0, 0.05, 0.12, 0.25, 0.45, 0.8].forEach((tt, i) => {
      const x = 130 + i * 205;
      drawJuiceSplat(ctx, { x, y: 500, r: 40, t: tt, puddle: true, floor: 50 });
      lbl(ctx, `splat t=${tt}`, x, 620);
    });
    drawOrange(ctx, { x: 760, y: 330, r: 16, t, rot: 0.3 });
    drawOrange(ctx, { x: 820, y: 334, r: 12, t, leaves: 2, seed: 4 });
    drawOrange(ctx, { x: 700, y: 332, r: 14, t, seed: 9, rot: -0.5 });
    // the swap at doreen_splat: the worn orange → rig orange:'squashed' (= squash 1), covered by
    // the splat's hit frame (r ≈ 1.75 × the orange radius)
    const C = capRig();
    if (C && C.drawCapyOrange) {
      C.drawCapyOrange(ctx, { x: 920, y: 330, r: 18, t });
      C.drawCapyOrange(ctx, { x: 1010, y: 330, r: 18, t, squash: 1 });
      drawOrange(ctx, { x: 1100, y: 330, r: 18, t, squash: 1 });
      drawJuiceSplat(ctx, { x: 1200, y: 330, r: 18 * 1.75, t: 0 });
      lbl(ctx, 'rig | rig squash 1 | props squash 1 | splat t=0', 1060, 372, 12);
    }
  },
  thermometer(ctx, t) {
    sheetBg(ctx, '#D7EEF4', '#EFE3CC');
    // levels
    [0, 0.25, thermoLevel(38.6), thermoLevel(39.2), thermoLevel(39.8), 1].forEach((lv, i) => {
      drawThermometer(ctx, { x: 46 + i * 58, y: 300, scale: 1.45, level: lv, t });
      lbl(ctx, `${lv.toFixed(2)}`, 46 + i * 58, 334, 13);
    });
    lbl(ctx, 'level = thermoLevel(°C)', 190, 356, 14);
    // same scale: the rig's paw thermometer vs props (one design)
    const rig = capRig();
    if (rig) rig.drawCapyThermometer(ctx, { x: 420, y: 300, scale: 1.45 * TH_G / 0.9, level: 0.6, length: 62 });
    drawThermometer(ctx, { x: 470, y: 300 - TH.yo * 1.45 + 1.5 * TH_G * 1.45 * 0, scale: 1.45, level: 0.6, t });
    lbl(ctx, 'rig | props', 445, 334, 13);
    // close-up: stuck in the water, reading tag + printed scale
    waterStrip(ctx, 560, 880, 520, 200);
    drawThermometer(ctx, { x: 640, y: 690, scale: 4.2, rot: 0.08, level: thermoLevel(39.4), reading: '39.4', t, waterY: 520 });
    lbl(ctx, 'close-up, waterY (bulb under water)', 720, 708, 13, '#FFFFFF');
    drawThermometer(ctx, { x: 960, y: 250, scale: 1.4, level: 0.62, reading: '38.6', rot: -1.2, t });
    lbl(ctx, 'rot -1.2 (tag upright)', 990, 290, 13);
    drawThermometer(ctx, { x: 1180, y: 300, scale: 1.6, level: thermoLevel(39.8), reading: '39.8', flip: true, tagSide: 'left', t });
    lbl(ctx, 'flip + tagSide left', 1160, 334, 13);
    // the s07 beat: thermo_pops 1.3 s, glass_pop sfx at 0.9 s → popAt 0.9/1.3
    const seq = [0, 0.3, 0.55, 0.75, 0.85, 0.9, 0.93, 0.97, 1.02, 1.1, 1.3];
    seq.forEach((tt, i) => {
      const x = 40 + i * 47;
      drawThermometer(ctx, { x, y: 560, scale: 1.05, level: thermoLevel(39.8), broken: tt / 1.3, popAt: 0.9 / 1.3, t: t + i * 0.013 });
      lbl(ctx, `${tt}s`, x, 590, 11);
    });
    lbl(ctx, 's07: broken = S.prog("thermo_pops"), popAt: 0.9/1.3  (pop on the glass_pop sfx)', 270, 615, 12);
    // animated: since mode
    const ss = (t % 1.8) - 0.2;
    drawThermometer(ctx, { x: 1050, y: 640, scale: 2.2, level: thermoLevel(39.8), since: ss, popTime: 0.9, t, reading: ss < 0.9 ? null : null });
    lbl(ctx, `since ${ss.toFixed(2)}`, 1050, 676, 12);
    drawThermometer(ctx, { x: 1200, y: 640, scale: 2.2, level: thermoLevel(39.8), since: ss, popTime: 0.9, breakAt: 'top', t });
    lbl(ctx, 'breakAt top', 1200, 676, 12);
  },
  // the s07 thermo_pops insert at 24 fps (--frames 12 --dt 0.0417 --t 0.95): reading '39.8' counts
  // up with the surging column and pops off with the glass (no hand-hiding); breakAt top with the
  // bulb under water (the s07 framing); a bulb popping UNDER water (ink cloud, bubbles, shards)
  thermo_pop(ctx, t) {
    sheetBg(ctx, '#2B2440', '#6B4C8A');
    const ss = t - 0.1;
    waterStrip(ctx, 0, 1280, 560, 160);
    drawThermometer(ctx, { x: 200, y: 520, scale: 4.2, level: thermoLevel(39.8), since: ss, popTime: 0.9, reading: '39.8', t });
    drawThermometer(ctx, { x: 640, y: 690, scale: 4.2, level: thermoLevel(39.8), since: ss, popTime: 0.9, breakAt: 'top', reading: '39.8', t, waterY: 560 });
    drawThermometer(ctx, { x: 1000, y: 660, scale: 4.2, level: thermoLevel(39.8), since: ss, popTime: 0.9, t, waterY: 560 });
    lbl(ctx, `bulb in air, reading '39.8'  since=${ss.toFixed(2)}`, 230, 700, 15, '#FFFFFF');
    lbl(ctx, "breakAt top, bulb under water", 700, 548, 15, '#FFFFFF');
    lbl(ctx, 'bulb pops under water', 1100, 700, 15, '#FFFFFF');
  },
  // s04 thermo_check: the line creeps up and settles on 39.8 — level tween + reading:'auto'
  thermo_check(ctx, t) {
    sheetBg(ctx, '#CFE6F0', '#F4E7CF');
    const lv = U.tween(t % 2, 0.1, 1.35, thermoLevel(39.4), thermoLevel(39.8), ease.outCubic);
    drawThermometer(ctx, { x: 470, y: 640, scale: 5.2, level: lv, reading: 'auto', t, tagSize: 12 });
    lbl(ctx, `t ${(t % 2).toFixed(2)}  level tween 39.4 → 39.8 + reading:'auto'`, 640, 30, 16);
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
  // s06 build_raft, moored in the river (bob .6) at 24 fps: build = (t % 1.6) / 1.3 — the
  // bundles smack into the water one by one, then lashings, mast, banner, oar
  raft_build(ctx, t) {
    sheetBg(ctx, '#BFE3F0', '#F2E3C6');
    waterStrip(ctx, 0, 1280, 380, 340);
    const b = clamp((t % 1.6) / 1.3);
    drawRaft(ctx, { x: 640, y: 560, scale: 1.25, t, bob: 0.6, wind: 0.5, build: b, buildDur: 1.3 });
    lbl(ctx, `build ${b.toFixed(3)}  (buildDur 1.3, bob .6)`, 640, 700, 16, '#FFFFFF');
  },
  raft_context(ctx, t) {
    sheetBg(ctx, '#F7A26B', '#6B4C8A');
    waterStrip(ctx, 0, 1280, 470, 250);
    let chars = null, crit = null;
    try { chars = require('./capybara'); } catch (e) { chars = null; }
    try { crit = require('./critters'); } catch (e) { crit = null; }
    // layer sandwich: back → passengers (ground on raftAnchors().sits) → front
    const ro = { x: 520, y: 540, scale: 1.15, t, bob: 1, wake: 0.6, dir: -1, grade: 'sunset' };
    drawRaft(ctx, { ...ro, layer: 'back' });
    const A = raftAnchors(ro);
    if (chars && chars.drawCapybara) {
      const who = ['sunny', 'barry', 'doreen'], seat = [0, 1, 2];
      who.forEach((w, i) => {
        try {
          const sc = 0.66, flip = i === 2;
          const p = A.sits[seat[i]];
          const gy = chars.capyAnchors({ who: w, x: 0, y: 0, scale: sc, pose: 'sit', t, flip }).ground.y;
          chars.drawCapybara(ctx, { who: w, x: p.x + (i === 2 ? 50 : 0), y: p.y - gy, scale: sc, pose: 'sit', t, flip, rot: A.angle, mood: i === 1 ? 'deadpan' : 'chill', tint: { color: '#E07A86', amount: 0.17 }, rim: '#FFB27A', accessories: i === 1 ? { glasses: true, helmet: true, soot: 0.3 } : { orange: true } });
        } catch (e) { /* sibling WIP */ }
      });
    }
    drawRaft(ctx, { ...ro, layer: 'front' });
    if (crit && crit.drawVulture) { try { crit.drawVulture(ctx, { x: A.mastTop.x, y: A.mastTop.y, scale: A.geraldScale, t, rot: A.angle }); } catch (e) { /* WIP */ } }
    for (const p of [...A.sits, A.mastTop, A.tipL, A.tipR]) { circle(ctx, p.x, p.y, 3.5); ctx.fillStyle = '#FF3B7F'; ctx.fill(); }
    lbl(ctx, "layer:'back' → capybaras on raftAnchors().sits → layer:'front'  ·  grade 'sunset' · bob 1 · wake .6", 520, 700, 15, '#FFFFFF');
    drawRaft(ctx, { x: 1110, y: 600, scale: 0.42, t, bob: 1, flip: true, wake: 1, dir: 1, flagDir: -1 });
    lbl(ctx, 'flip, flagDir -1, heading right', 1110, 650, 13, '#FFFFFF');
    drawRaft(ctx, { x: 1110, y: 330, scale: 0.4, t, bob: 1, flagShow: 4 });
    lbl(ctx, 'flagShow: 4', 1110, 370, 13, '#FFFFFF');
  },
  // s08 gerald_covers_flag, proven with the real Gerald: he leaves the mast top, settles on the
  // banner and his weight bunches 'TOLD YOU SO' into a crumpled pile under him → reads 'S.S.'
  gag_flag(ctx, t) {
    sheetBg(ctx, '#F7A26B', '#8A5A8E');
    let crit = null;
    try { crit = require('./critters'); } catch (e) { crit = null; }
    const panels = [
      ['before: Gerald on mastTop', 0, 'mast'],
      ['flagPerch {k: .5} (settling)', 0.5, 'flag'],
      ['flagPerch {k: 1}: reads "S.S."', 1, 'flag'],
    ];
    panels.forEach(([name, k, where], i) => {
      ctx.save();
      ctx.beginPath(); ctx.rect(i * 427, 0, 426, 720); ctx.clip();
      waterStrip(ctx, i * 427, i * 427 + 427, 560, 160);
      const ro = { x: i * 427 + 150, y: 600, scale: 1.05, t, bob: 1, grade: 'sunset', flagPerch: k > 0 ? { k } : null };
      drawRaft(ctx, ro);
      const A = raftAnchors(ro);
      const p = where === 'mast' ? A.mastTop : A.flagPerch;
      if (crit && crit.drawVulture) { try { crit.drawVulture(ctx, { x: p.x, y: p.y, scale: A.geraldScale, t, rot: A.angle, mood: 'smug', crouch: where === 'flag' ? 0.3 : 0 }); } catch (e) { /* WIP */ } }
      ctx.restore();
      lbl(ctx, name, i * 427 + 213, 690, 15, '#FFFFFF');
    });
    // close framing of the payoff (the gerald_flag shot)
    ctx.save();
    ctx.beginPath(); ctx.rect(860, 20, 400, 300); ctx.clip();
    ctx.fillStyle = lin(ctx, 0, 20, 0, 320, ['#F7A26B', '#C97A86']); ctx.fillRect(860, 20, 400, 300);
    ctx.translate(1060, 170); ctx.scale(1.9, 1.9); ctx.translate(-150 - 427 * 2 - 70, -330);
    const ro = { x: 427 * 2 + 150, y: 600, scale: 1.05, t, bob: 1, grade: 'sunset', flagPerch: { k: 1 } };
    drawRaft(ctx, ro);
    const A = raftAnchors(ro);
    if (crit && crit.drawVulture) { try { crit.drawVulture(ctx, { x: A.flagPerch.x, y: A.flagPerch.y, scale: A.geraldScale, t, rot: A.angle, mood: 'smug', crouch: 0.3 }); } catch (e) { /* WIP */ } }
    ctx.restore();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.strokeRect(860, 20, 400, 300);
  },
  // burning signs: fire + smoke + embers stay WORLD-UP on a tilted / flipped / wobbling sign
  burn(ctx, t) {
    sheetBg(ctx, '#BFE3F0', '#E9F2D8');
    groundStrip(ctx, 0, 1280, 690);
    drawSign(ctx, { x: 150, y: 690, text: 'EVACUATION ROUTE', style: 'arrow', burn: 0.7, rot: 0.7, t, scale: 0.8, seed: 2 });
    lbl(ctx, 'burn .7 rot .7', 150, 708, 13);
    drawSign(ctx, { x: 420, y: 690, text: 'EXIT', style: 'arrow', burn: 0.55, flip: true, t, seed: 1 });
    lbl(ctx, 'flip, burn .55', 420, 708, 13);
    const hit = t % 1.6;
    drawSign(ctx, { x: 640, y: 690, text: 'NO, REALLY. THIS WAY.', style: 'arrow', burn: 0.9, rot: signWobble(hit, 0.12), t, scale: 0.7, seed: 3 });
    lbl(ctx, 'burn .9 + signWobble', 640, 708, 13);
    drawSign(ctx, { x: 1000, y: 690, text: 'SNOOZE SPRINGS / No Worries Allowed', burn: clamp((t % 4) / 3.2), t, scale: 1.6, seed: 6 });
    lbl(ctx, `close-up, burn ${clamp((t % 4) / 3.2).toFixed(2)}`, 1000, 708, 13);
  },
  // s08 gerald_covers_flag frame by frame: k 0 → 1. The seat (flagPerch) is the same point for
  // every k (only its height follows the sag); the crumple zone grows outward from his feet.
  flag_perch(ctx, t) {
    sheetBg(ctx, '#F7A26B', '#8A5A8E');
    let crit = null;
    try { crit = require('./critters'); } catch (e) { crit = null; }
    const ks = [0, 0.1, 0.2, 0.35, 0.5, 0.7, 0.85, 1];
    const showG = !(t < 0);
    ks.forEach((k, i) => {
      const cx = (i % 4) * 320, cy = Math.floor(i / 4) * 360;
      ctx.save();
      ctx.beginPath(); ctx.rect(cx, cy, 320, 360); ctx.clip();
      ctx.translate(cx + 160, cy + 200);
      ctx.scale(1.3, 1.3);
      ctx.translate(-700, -330);
      const ro = { x: 560, y: 600, scale: 1.05, t: 2, bob: 1, grade: 'sunset', flagPerch: { k } };
      drawRaft(ctx, { ...ro, layer: 'back' });
      const A = raftAnchors(ro);
      if (showG && crit && crit.drawVulture) { try { crit.drawVulture(ctx, { x: A.flagPerch.x, y: A.flagPerch.y, scale: A.geraldScale, t: 2, rot: A.angle, mood: 'smug', crouch: 0.3 * k }); } catch (e) { /* WIP */ } }
      circle(ctx, A.flagPerch.x, A.flagPerch.y, 2.5); ctx.fillStyle = '#FF3B7F'; ctx.fill();
      ctx.restore();
      lbl(ctx, `k ${k}  perch ${A.flagPerch.x.toFixed(1)}, ${A.flagPerch.y.toFixed(1)}`, cx + 160, cy + 340, 13, '#FFFFFF');
    });
  },
  // props placed in Snooze Springs (uses env_spring.js / capybara.js when available).
  // ORDER: background → signs / moored raft / helmet on the rock (behind) → swimmers → the env's
  // front water → floating props WITH waterY (they tint their own submerged part, so they go
  // after the front water layer) → FX.
  context(ctx, t) {
    let E = null, C = null;
    try { E = require('./env_spring'); } catch (e) { E = null; }
    try { C = require('./capybara'); } catch (e) { C = null; }
    const S = (E && E.SPRING) || { exitSignSpots: [{ x: 400, y: 446 }, { x: 292, y: 449 }, { x: 184, y: 452 }], raftMoor: { x: 70, y: 597 }, thermometerSpot: { x: 770, y: 598 }, rulesSignSpot: { x: 604, y: 452 }, barryRock: { x: 798, y: 552, top: { x: 794, y: 532 } } };
    if (E && E.drawSpringDay) E.drawSpringDay(ctx, t, {}); else { sheetBg(ctx); waterStrip(ctx, 0, 1280, 458, 262); }
    const ex = S.exitSignSpots;
    drawSign(ctx, { x: ex[0].x, y: ex[0].y, text: 'EXIT', style: 'arrow', scale: 0.62, seed: 1, t });
    drawSign(ctx, { x: ex[1].x, y: ex[1].y, lines: ['NO, REALLY.', 'THIS WAY.'], style: 'arrow', scale: 0.5, seed: 3, t });
    drawSign(ctx, { x: ex[2].x, y: ex[2].y, text: 'YES, YOU, SUNNY', style: 'arrow', scale: 0.42, size: 20, seed: 5, t });
    const rs = S.rulesSignSpot || { x: 604, y: 452 };
    drawSign(ctx, { x: rs.x, y: rs.y, lines: ['SPRING RULES', '1. Introduce yourself', '2. Say goodbye', '3. No vultures on heads'], scale: 0.42, seed: 9, t });
    drawRaft(ctx, { x: S.raftMoor.x, y: S.raftMoor.y, scale: 0.5, t, bob: 0.6 });
    const br = S.barryRock || { top: { x: 794, y: 532 } };
    drawHelmet(ctx, { x: br.top.x + 6, y: br.top.y + 1, scale: 0.9, rot: -0.12 });
    if (C && C.drawCapybara) {
      try { C.drawCapybara(ctx, { who: 'barry', x: 650, y: 600, t, pose: 'swim', mood: 'worried', accessories: { glasses: true } }); } catch (e) { /* sibling WIP */ }
      try { C.drawCapybara(ctx, { who: 'sunny', x: 360, y: 590, t, pose: 'swim', mood: 'chill', accessories: { orange: true, necklace: true } }); } catch (e) { /* sibling WIP */ }
      try { C.drawCapybara(ctx, { who: 'doreen', x: 945, y: 588, scale: 0.97, flip: true, t, pose: 'swim', mood: 'happy', accessories: { orange: true, flower: true } }); } catch (e) { /* sibling WIP */ }
    }
    if (E && E.drawWaterFront) { try { E.drawWaterFront(ctx, t, {}); } catch (e) { /* sibling WIP */ } }
    const th = S.thermometerSpot;
    drawThermometer(ctx, { x: th.x, y: th.y + 22, scale: 0.75, rot: 0.12, level: thermoLevel(39.4), t, waterY: th.y });
    drawOrange(ctx, { x: 845, y: 628 + Math.sin(t * 1.6) * 1.5, r: 15, t, rot: 0.3 + Math.sin(t * 1.1) * 0.08, waterY: 634 });
    drawRock(ctx, { x: 520, y: 652, r: 13, rot: 0.4, t, waterY: 650, seed: 3 });
    drawSteamPuff(ctx, { x: 560, y: 520, r: 22, life: frac(t * 0.3), t, seed: 2 });
    drawZzz(ctx, { x: 990, y: 520, t, scale: 0.8 });
  },
  // worn (the capybara rig) vs loose (props) at the same scale: one design per object
  dupes(ctx, t) {
    sheetBg(ctx, '#CFE6F0', '#F4E7CF');
    let C = null;
    try { C = require('./capybara'); } catch (e) { C = null; }
    if (!C) { lbl(ctx, 'capybara.js not available', 640, 360, 20); return; }
    const row = (y, name) => lbl(ctx, name, 640, y, 15);
    // helmet
    const bo = { who: 'barry', x: 200, y: 200, scale: 1.25, pose: 'swim', t, mood: 'deadpan', accessories: { glasses: true, helmet: true } };
    C.drawCapybara(ctx, bo);
    const H = C.capyAnchors(bo).helmet;
    drawHelmet(ctx, { x: 470, y: H.y + 6, scale: H.scale, strap: false });
    drawHelmet(ctx, { x: 640, y: H.y + 6, scale: H.scale });
    drawHelmet(ctx, { x: 820, y: H.y + 6, scale: H.scale, rot: -0.25, soot: 0.6 });
    row(250, 'worn (rig)  |  drawHelmet same scale, strap:false  |  default (strap dangling)  |  rot + soot .6');
    // orange
    const doo = { who: 'doreen', x: 1080, y: 210, scale: 1.1, pose: 'swim', t, flip: true, accessories: { orange: true, flower: true } };
    C.drawCapybara(ctx, doo);
    const O = C.capyAnchors(doo).orange;
    drawOrange(ctx, { x: 1180, y: 80, r: O.r, t });
    lbl(ctx, 'worn | loose (same r)', 1110, 250, 13);
    // thermometer: rig paw thermometer vs props (scale s ↔ rig scale s / 0.558)
    for (let i = 0; i < 3; i++) {
      const lv = [0.3, thermoLevel(39.4), 0.9][i];
      C.drawCapyThermometer(ctx, { x: 120 + i * 110, y: 520, scale: 2.2, level: lv, length: 62 });
      drawThermometer(ctx, { x: 160 + i * 110, y: 520 + TH.yo * 2.2 * 0.558 * 0, scale: 2.2 * 0.558, level: lv, t });
    }
    row(560, 'thermometer: rig drawCapyThermometer | props drawThermometer (pairs)');
    drawThermometer(ctx, { x: 520, y: 540, scale: 2.2 * 0.558, level: thermoLevel(39.4), reading: '39.4', t });
    lbl(ctx, '+ reading tag', 545, 580, 12);
    // squash: ONE squashed orange — the worn orange:'squashed' IS props squash 1 (the rig
    // delegates); at the impact cover the swap with drawJuiceSplat's hit frame
    const d2 = { who: 'doreen', x: 900, y: 560, scale: 1.1, pose: 'swim', t, flip: true, accessories: { orange: 'squashed', flower: true, juice: 0.6 } };
    C.drawCapybara(ctx, d2);
    const O2 = C.capyAnchors({ ...d2, accessories: { orange: true, flower: true } }).orange;
    drawOrange(ctx, { x: 1160, y: 470, r: O2.r, t, squash: 1 });
    lbl(ctx, "worn orange:'squashed' (rig) | loose squash:1 (props)", 1000, 640, 13);
  },
  // lighting + water: the same props under every grade (o.grade), floating with waterY
  grades(ctx, t) {
    const names = ['day', 'gold', 'dusk', 'erupt', 'sunset'];
    const SKY = { day: ['#8ED1F0', '#FDEBC8'], gold: ['#7E82C4', '#FFD994'], dusk: ['#46397A', '#F7A26B'], erupt: ['#2A1216', '#FF7A35'], sunset: ['#FF9E5E', '#5B3A7A'] };
    const cw = 256;
    names.forEach((g, i) => {
      const x0 = i * cw, W = GRADES[g].water;
      ctx.save();
      ctx.beginPath(); ctx.rect(x0, 0, cw, 720); ctx.clip();
      ctx.fillStyle = lin(ctx, 0, 0, 0, 420, SKY[g]); ctx.fillRect(x0, 0, cw, 420);
      ctx.fillStyle = lin(ctx, 0, 420, 0, 720, [W.mid, W.base, W.deep]); ctx.fillRect(x0, 420, cw, 300);
      ctx.fillStyle = rgba(W.top, 0.8); ctx.fillRect(x0, 420, cw, 2);
      const cx = x0 + cw / 2;
      drawSign(ctx, { x: cx - 50, y: 300, text: 'EXIT', style: 'arrow', scale: 0.7, grade: g, t, seed: 1 });
      drawHelmet(ctx, { x: cx + 60, y: 300, scale: 0.9, grade: g });
      drawOrange(ctx, { x: cx - 70, y: 470, r: 18, t, grade: g, waterY: 476 });
      drawRock(ctx, { x: cx + 6, y: 478, r: 16, t, grade: g, waterY: 476, seed: 2 });
      drawThermometer(ctx, { x: cx + 70, y: 520, scale: 0.9, level: 0.6, t, grade: g, waterY: 476 });
      drawWaterSplash(ctx, { x: cx - 40, y: 580, r: 26, t: 0.22 + (t % 1.2), grade: g, seed: 3 });
      drawRaft(ctx, { x: cx + 10, y: 670, scale: 0.42, t, bob: 1, grade: g });
      drawSmokePuff(ctx, { x: cx + 70, y: 380, r: 24, t, tone: g === 'erupt' ? 'dark' : 'grey', grade: g });
      ctx.restore();
      lbl(ctx, `grade '${g}'`, cx, 30, 16, g === 'day' || g === 'gold' ? '#3A4250' : '#FFFFFF');
    });
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
    drawSign(ctx, { x: ex[0].x, y: ex[0].y, text: 'EXIT', style: 'arrow', scale: 0.62, seed: 1, t, grade: 'erupt' });
    drawSign(ctx, { x: ex[1].x, y: ex[1].y, lines: ['EVACUATION', 'ROUTE'], style: 'arrow', scale: 0.5, seed: 2, t, grade: 'erupt' });
    drawSign(ctx, { x: ex[2].x, y: ex[2].y, lines: ['NO, REALLY.', 'THIS WAY.'], style: 'arrow', scale: 0.5, seed: 3, t, burn: 0.35, grade: 'erupt' });
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
        if (kind === 'orange') drawOrange(ctx, { x: px, y: py, r: 13, rot: t * 4 + off, t, grade: 'erupt' });
        else drawRock(ctx, { x: px, y: py, r: 15, glow: 1, trail: 0.7, dir: Math.atan2(840 * p, -120), t, rot: t * 3, seed: off * 10, grade: 'erupt' });
      } else {
        drawWaterSplash(ctx, { x: dx, y: dy, r: kind === 'rock' ? 30 : 20, t: tt - fallT, seed: off * 7 + 1, grade: 'erupt' });
      }
    }
    // bonk + juice on Doreen's orange, rock bouncing off Barry's helmet
    const tb = frac(t / 1.2) * 1.2;
    drawJuiceSplat(ctx, { x: 930, y: 488, r: 26, t: tb, grade: 'erupt' });
    drawImpactBurst(ctx, { x: 905, y: 430, r: 34, text: 'SPLAT!', t: tb, seed: 3 });
    const tr = frac((t + 0.4) / 1.2) * 1.2;
    drawImpactBurst(ctx, { x: 640, y: 470, r: 30, text: 'TINK!', t: tr, rot: 0.1 });
    drawRock(ctx, { x: 640 + tr * 160, y: 470 - tr * 220 + 0.5 * 500 * tr * tr, r: 11, rot: tr * 8, seed: 7, grade: 'erupt' });
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
  // the SPRING RULES sign at the scale the trio shots use (kit: scale .42), with Gerald on the top
  // edge, and the per-line highlight Gerald's glances use (signAnchors().lines[i])
  rules(ctx, t) {
    let E = null, CR = null;
    try { E = require('./env_spring'); } catch (e) { E = null; }
    try { CR = require('./critters'); } catch (e) { CR = null; }
    const RS = { lines: ['SPRING RULES', '1. Introduce yourself', '2. Say goodbye', '3. No vultures on heads'], seed: 9 };
    const spot = (E && E.SPRING && E.SPRING.rulesSignSpot) || { x: 604, y: 452 };
    const hk = clamp((t % 2) / 0.6);
    // left: in the set at the real scale (trio framing ≈ camera zoom 1)
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, 640, 360); ctx.clip();
    ctx.translate(320 - spot.x, 250 - spot.y);
    if (E && E.drawSpringEvening) E.drawSpringEvening(ctx, t, { dusk: 0.15 }); else sheetBg(ctx);
    const so = { ...RS, x: spot.x, y: spot.y, scale: 0.42, t, highlight: 2, highlightK: hk, grade: 'gold' };
    drawSign(ctx, so);
    const A = signAnchors(so);
    if (CR && CR.drawVulture) { try { CR.drawVulture(ctx, { x: A.top.x + 8, y: A.top.y + 2, scale: 0.42, t, look: { x: 0.3, y: 0.9 }, nod: hk * 0.5 }); } catch (e) { /* WIP */ } }
    ctx.restore();
    lbl(ctx, 'scale .42 in the set, grade gold, highlight: 2', 320, 345, 14, '#FFFFFF');
    // right: the same at 1080p pixel density, 3x (what a viewer sees on a big screen)
    ctx.save();
    ctx.beginPath(); ctx.rect(640, 0, 640, 360); ctx.clip();
    ctx.translate(960, 190); ctx.scale(3, 3); ctx.translate(-spot.x, -(spot.y - 55));
    if (E && E.drawSpringEvening) E.drawSpringEvening(ctx, t, { dusk: 0.15 }); else sheetBg(ctx);
    drawSign(ctx, so);
    if (CR && CR.drawVulture) { try { CR.drawVulture(ctx, { x: A.top.x + 8, y: A.top.y + 2, scale: 0.42, t, look: { x: 0.3, y: 0.9 }, nod: hk * 0.5 }); } catch (e) { /* WIP */ } }
    // per-line anchors
    for (const ln of A.lines) {
      ctx.strokeStyle = 'rgba(255,60,120,0.8)'; ctx.lineWidth = 0.4;
      ctx.strokeRect(ln.x - ln.w / 2, ln.y - ln.h / 2, ln.w, ln.h);
    }
    ctx.restore();
    lbl(ctx, '3x zoom: rule text ≈ 8.6 design px tall at .42 (was 6.6); pink = anchors.lines[i]', 960, 345, 13, '#FFFFFF');
    // bottom: highlight wipe frames at scale 1
    sheetBg2(ctx, 0, 360, 1280, 360);
    [0, 0.3, 0.6, 1].forEach((k, i) => {
      drawSign(ctx, { ...RS, x: 165 + i * 316, y: 690, scale: 0.86, highlight: 1, highlightK: k, t });
      lbl(ctx, `highlight: 1, highlightK ${k}`, 165 + i * 316, 708, 12);
    });
  },
  // the env's own welcome sign next to props signs: one sign-maker (same wood, post caps,
  // cream titles + mint secondary lines)
  signs_env(ctx, t) {
    let E = null;
    try { E = require('./env_spring'); } catch (e) { E = null; }
    sheetBg(ctx, '#BFE3F0', '#E9F2D8');
    groundStrip(ctx, 0, 1280, 330);
    groundStrip(ctx, 0, 1280, 680);
    if (E && E.drawSnoozeSign) E.drawSnoozeSign(ctx, t, { x: 200, y: 330, scale: 1 });
    drawSign(ctx, { text: 'SNOOZE SPRINGS / No Worries Allowed', x: 520, y: 330, seed: 6, t });
    drawSign(ctx, { text: 'EXIT \u2190', style: 'arrow', x: 790, y: 330, seed: 1, t });
    drawSign(ctx, { lines: ['SPRING RULES', '1. Introduce yourself', '2. Say goodbye', '3. No vultures on heads'], x: 1080, y: 330, scale: 0.8, seed: 9, t });
    lbl(ctx, 'env.drawSnoozeSign', 200, 350, 13);
    lbl(ctx, 'props.drawSign (same text)', 520, 350, 13);
    lbl(ctx, "'EXIT \u2190' (arrow char → arrowDir)", 790, 350, 13);
    if (E && E.drawSnoozeSign) E.drawSnoozeSign(ctx, t, { x: 200, y: 680, scale: 1, lines: ['SNOOZE SPRINGS 2', 'Barry Approved'], check: true });
    drawSign(ctx, { text: 'EXIT \u2192', x: 470, y: 680, seed: 4, t });
    drawSign(ctx, { text: '\u2605 NO WORRIES \u2605', x: 700, y: 680, seed: 5, size: 20, t });
    drawSign(ctx, { text: 'EVACUATION ROUTE ->', style: 'arrow', x: 1010, y: 680, seed: 2, size: 20, t });
    lbl(ctx, "'EXIT \u2192' → glyph", 470, 700, 13);
    lbl(ctx, 'missing glyphs dropped', 700, 700, 13);
    lbl(ctx, "'... ->' → arrowDir right", 1010, 700, 13);
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
  PROP_COLORS, RAFT, GRADES,
  lab,
};
