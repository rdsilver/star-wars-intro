// CHILL CAPYBARA — critters: Gerald (vulture), Dr. Shelley (tortoise), fish, and the narrator's
// extras (tropical bird, sleepy monkey). See DESIGN.md §6.
//
// All functions draw in 1280x720 design units, are pure functions of their inputs (time
// included; seeded hashes only, never Math.random), wrap everything in ctx.save()/restore()
// and default to facing RIGHT (flip:true faces LEFT). `scale` multiplies everything,
// including outline widths.
//
// TRANSFORMS (same for every critter): translate(x, y) · rotate(rot) · scale(flip ? -s : s, s).
//   `rot` (radians) is therefore a WORLD rotation about the origin for both facings, so a critter
//   resting on a capybara uses rot = capyAnchors(host).headTop.angle whether the host is flipped
//   or not. Every *Anchors(o) function applies the identical transform (rot and flip included).
// LIGHTING: the key light is always world upper-left; side-lit gradients are mirrored for flipped
//   characters, so a flipped critter is lit like everyone else in the shot.
//
// MOODS (every critter): o.mood is a name OR a weight map ({smug: 0.7, shock: 0.3} — e.g.
//   kit moodAt(S, who).weights); o.mood2 + o.moodMix 0..1 cross-fades toward a second mood. Every
//   face (and Gerald's posture) field is numeric, so expression changes blend and never pop.
//
// ─────────────────────────────────────────────────────────────────────────────
// drawVulture(ctx, o)  — GERALD. Polite, faintly ominous British turkey/king vulture.
//   ORIGIN = the feet contact point (the perch surface) in EVERY pose.
//   Size at scale 1: ≈ 100 units feet→head-top perched, wingspan ≈ 290 in flight.
//   On a capybara: x/y = capyAnchors(o).headTop, rot = headTop.angle, scale ≈ 0.75 × capy scale.
//   All poses are one continuous rig, so any pose change can be tweened (see helpers below).
//   o = {
//     x, y, scale=1, flip=false, rot=0, t (s, idle: breathing, slow blinks, head drift)
//     talk 0..1        opens the hooked beak (lower mandible) + small head bob
//     pose 'perch' (default) | 'fly' | 'land' | 'takeoff'
//          perch:   hunched, folded wings like a tail-coat, talons wrapped over the surface
//          fly:     body level, big fingered wings, feet tucked. Flap cycle: the downstroke
//                   sweeps the near wing forward and down (never past ~60° below horizontal —
//                   no cape), the far wing slides behind the body; where the near wing passes its
//                   own chord it is drawn as a tapered blade with the fingers fanned + motion arcs
//          land:    the flare — body pitched up from level to ~45°, head carried forward, feet
//                   thrown forward of the hips, tail fanned (6 feathers) as an airbrake, wings up
//          takeoff: body pitched forward, legs pushing off the origin, wings flapping
//     pose2, poseMix 0..1   blend ANY two poses continuously (body pitch & shape, head, legs,
//                      wings). e.g. {pose:'takeoff', pose2:'fly', poseMix: k} for the climb-out.
//     flare 0..1       shorthand for {pose:'fly', pose2:'land', poseMix: flare} (fly → land)
//     wing 0..1        fly/land/takeoff (default 1): span AND flap amplitude/elevation (low =
//                      half-tucked, e.g. a fast dive; land/takeoff wing 0 = wings lowered out).
//                      perch (default 0): opens the wings into the HERALDIC / SUNNING SPREAD at 1
//                      (both wings up and out, near underside to camera, fingers fanned — "Took
//                      your time."); perch fold = 1 - wing, so it opens/closes continuously
//                      (lift first, then spread — never downward).
//     fold 0..1        tuck the spread wings into the folded tail-coat (any pose). The joints
//                      close first, then the wing lowers into place, then it dissolves into the
//                      folded art; in reverse (unfolding) the wing is RAISED first, then opens.
//                      Default: perch 1 - wing, other poses 0.
//     flapPhase        flap cycle in CYCLES (0 = wings up, 0.5 = wings down; downstroke 55%).
//                      Omitted → automatic 2.3 Hz from t. A held value = wings held (glide).
//                      In perch with wing > 0, passing flapPhase adds balancing flaps.
//     glide bool       fly: soaring, wings held out in a shallow V, no flapping
//     legs -0.3..1     land/takeoff: leg extension (1 = full reach / push; 0 = perched height;
//                      < 0 = crouch, e.g. absorbing a landing or the anticipation of a leap)
//     crouch 0..1      perch: knees bend, body dips (test-bounces, anticipation)
//     nod 0..1         head dips forward (the tidy nod at the rules sign)
//     GESTURES (perch):
//     preen 0..1       the head swings back over the shoulder (turning through 3/4) and buries the
//                      beak in the folded wing; coverts ruffle, beak tip hidden by covert tips
//     settle 0..1      sinks onto the perch: body lowered over the feet (legs hidden), feathers
//                      puffed (≈ +13 %), wings slightly mantled (mantle defaults to .55 × settle)
//     mantle 0..1      wings draped low and wide over whatever he sits on (near wing back along
//                      the perch, far wing forward past the chest). settle 1 + mantle 1 ≈ 1.6×
//                      the perched width: ≈ 215 × 120 units at scale 1, spanning local x −133…+81
//                      (perched: 131 wide, −55…+76) — enough to hide what is under him (the TOLD
//                      YOU SO flag words; size him so the words fit inside that span)
//     cling 0..1       hugging a VERTICAL pole just in front of the feet (origin = grip point on
//                      the pole's near face): body hangs behind it, toes wrap it vertically, tail
//                      braced against it. Move y yourself for the shuffle down the pole.
//     grip 0..1        toes clench, talons dig in (bigger), he sinks a touch and trembles
//     floor bool       (default true) spread wings and tail stay above the perch line while
//                      standing on it (legs ≤ 0 / perched) — never sweep across a host's face
//     mood 'smug' (default: politely knowing) | 'neutral' | 'happy' | 'sad' | 'shock' | 'worried'
//          | 'panic' | 'deadpan' | 'chill' | 'sleepy' — or a weight map / mood2 + moodMix.
//          Moods carry POSTURE so they read at in-shot sizes: smug = chest puffed, chin up,
//          leaning back, one brow high; worried = hunched, head sunk, ruff raised; sad = slumped,
//          head low; shock = recoil + bristle; deadpan / chill / sleepy = head lower, heavy lids;
//          happy = closed smiling eyes, small fluff + head bob.
//     look {x,y} -1..1 pupil direction (x+ = toward the beak, y+ = down); also nudges the head.
//                      Omitted → the mood's own glance.
//     ruffle 0..1      feathers bristle (stray tufts, fluffed ruff). shock/panic default 0.85
//   }
// vultureAnchors(o) → { beak, head, headCenter, eye, feet, body, wingTip|null }  world points for
//   the same options (beak = beak tip: aim speech/glints; head = top of the skull).
// CHOREOGRAPHY HELPERS — one number per beat → a complete option set; spread your own base
//   options in (x, y = the perch point; scale, flip, t, mood, talk, look …) and draw the result:
//     drawVulture(ctx, geraldLanding(S.prog('vulture_lands'), { x, y, scale, flip, t, mood }))
//   geraldLanding(p, o)  p 0..1 over o.dur s (default 1.6): glides in from o.from {dx, dy}
//                        (scale-1 units relative to his facing; default {dx:-240, dy:-170} =
//                        behind & above), decelerates to a hover ~18 units above the perch, flares
//                        (pitch up, tail fan, 2 braking flaps ending wings-UP), throws the feet
//                        forward and reaches only in the last 0.25 s, touches down on (o.x, o.y)
//                        at dur-0.42 s, absorbs, folds (joints, then lowered), settles (ruffle).
//   geraldTakeoff(p, o)  p 0..1 over o.dur s (default 1.5): the folded wings RAISE, then open
//                        upward + crouch (anticipation); springs at ~0.42 s on the first
//                        downstroke with a quick up-and-forward pop (outQuad, body pitched
//                        forward), then climbs away, accelerating, to o.to {dx, dy}
//                        (default {dx:520, dy:-380} — make it big to exit frame).
//   geraldHop(p, o)      p 0..1 over o.dur s (default 0.9): perch (o.x, o.y) → perch o.to {x, y}
//                        (WORLD coords): crouch, spring, one eased arc, absorb, fold. Short hops keep
//                        the wings half open; > ~60 units (scale 1) open fully with one downstroke.
//   Each returns { ...o, pose, pose2, poseMix, flapPhase, legs, fold, wing, crouch?, ruffle?, x, y }.
// drawFeather(ctx, {x, y, scale, rot})  one charcoal feather (the one that spins down when he
//   leaves). Animate x/y/rot yourself.
//
// ─────────────────────────────────────────────────────────────────────────────
// drawTortoise(ctx, o)  — DR. SHELLEY. Ancient tortoise therapist sitting upright like a person.
//   ORIGIN = seat contact point (bottom of the shell on the cushion). The office env draws the
//   chair: use OFFICE.chair with flip:true (faces left toward the couch), scale 1.
//   Size at scale 1: shell ≈ 145 tall × 85 deep, ≈ 215 seat→head-top (≈ 235 with turn 1).
//   o = {
//     x, y, scale=1, flip=false, rot=0, t (very slow breathing, neck sway, ~6.5 s slow blinks)
//     talk 0..1        opens the beak slowly (gentle jaw)
//     mood 'neutral' (heavy-lidded) | 'happy' (closed upturned smiling eyes, crow's feet, smile
//          line up from the beak, chin up) | 'smug' (brow down, side glance, smirk) | 'sad' |
//          'worried' | 'deadpan' (flat lids) | 'chill' | 'sleepy' | 'shock' | 'panic'
//          — or a weight map / mood2 + moodMix (blends)
//     write 0..1       writing progress (e.g. S.prog('shelley_writes')). The pencil hand follows
//                      the pen tip; omitted → resting pencil, page already has some scribbles.
//     note 'TEXT'      optional: instead of scribbles, write this word (0→0.72 of `write`) and
//                      underline it twice (0.72→1). Readable in a close-up.
//     notepad=true     the far hand grips the pad's outer edge (thumb on the page), the near hand
//                      writes. false → no pad/pencil; hands clasped on the belly
//     look {x,y}       pupils (x+ toward the beak). Omitted → the mood's own glance.
//     neck -1..1       neck lean: + cranes forward/down (look at the hourglass), − pulls back
//                      (clamped to ±1)
//     turn 0..1        s05 'shelley_turns': cranes the long neck UP toward something above him (the
//                      office window): the neck straightens and lengthens, the head pitches up to
//                      ~65°; the eye leads (pupils are there by turn ≈ 0.3). Key it slowly 0→1→0.
//     neckLen          neck extension multiplier (default 1; shock/panic pull it in a bit)
//   }
// tortoiseAnchors(o) → { notepad, head, headCenter, beak, eye, seat }
//
// ─────────────────────────────────────────────────────────────────────────────
// drawFish(ctx, o)  — cute round fish ("the fish are leaving").
//   o = {
//     x, y, scale=1 (≈ 46 long incl. tail), flip, rot, t, seed (blink / wave rhythm)
//     color 'orange' (default) | 'teal' | any '#hex'
//     swim (default when neither `hop` nor `stand` is given): ORIGIN = body centre; tail wags,
//          gentle bob. swim:false → still.
//     stand bool       upright on its tail, ORIGIN = ground; gentle idle sway, no squash/stretch
//                      (resting on the s08 lily pad).
//     hop: phase       hop along the ground standing on its tail. ORIGIN = ground contact
//          (cycles; 0 = landed/squash, 0.5 = apex ≈ 22 units up). Advance it yourself,
//          e.g. hop = t * 1.6, and move x with fishHopX (feet stay planted between hops).
//     suitcase         true: a tiny leather suitcase with travel stickers, carried in the near
//                      fin (swings with hops; also while waving). 'down': set down on the ground
//                      beside him (stand/hop).
//     wave 0..1        goodbye wave: a fin raised from the upper back BEHIND the head waves above
//                      it (−1.5 rad ± 0.36 swing, wrist lag, motion ticks; ticks:false hides them).
//                      It is drawn behind the body, so it can never cover the eye or mouth
//                      (lab.fish_wave measures it: 0 %). wave → 0 tucks it away.
//     mood 'neutral' | 'happy' | 'worried' | 'sad' | 'solemn' | 'shock' | 'panic' | 'chill' |
//          'smug' | 'deadpan' | 'sleepy'   (bold brows + pupil size read at fish-cam size)
//          — or a weight map / mood2 + moodMix (blends)
//     nod 0..1         head dips forward (the "one slow solemn nod")
//     look {x,y}       pupils
//   }
// fishAnchors(o) → { center, mouth, eye, top }
// fishHopX(hop, stride=30) → x offset (scale-1 units × your scale) that only advances in the air.
// drawTinySuitcase(ctx, x, y, s=1, rot=0)  the suitcase alone (origin = top of the handle).
//
// ─────────────────────────────────────────────────────────────────────────────
// drawBird(ctx, o)  — small tropical bird (kiskadee-style: yellow belly, white brow + throat,
//   black mask). ORIGIN = feet contact (perch). Size at scale 1 ≈ 34 tall perched — sits on a
//   capybara headTop at ≈ 1.0 × capy scale (rot = headTop.angle).
//   o = { x, y, scale, flip, rot, t, seed (twitch/blink rhythm), pose 'perch' | 'fly',
//         flapPhase (fly; default fast from t), chirp: bool (auto) | 0..1 (beak open + chirp
//         ticks), look {x,y} }
// birdAnchors(o) → { beak, head, eye, feet }
// drawMonkey(ctx, o)  — small capuchin asleep belly-down, draped along a capybara's back with
//   arms/legs dangling and tail curled. ORIGIN = belly contact point (use capyAnchors().back,
//   scale ≈ 0.9 × capy scale).
//   o = { x, y, scale, flip (head toward −x), rot, t, sleep=true (false → awake, eyes open;
//         asleep → slow breathing), drape 0..1.5 (how far the limbs hang) }
// monkeyAnchors(o) → { head, face, belly }   (head ≈ where to put a "Zzz")
//
// lab sheets: gerald (moods + poses), gerald_cycle (12 flap phases + in-film scale),
//   gerald_gestures (preen / settle / mantle / cling / grip / mood cross-fade), gerald_moods (face
//   close-ups), gerald_flap (--frames 8 --dt 0.1), gerald_land (--frames 24 --dt 0.0667: landing,
//   takeoff, hop), shelley (incl. turn), shelley_moods, fish, fish_wave (12 wave phases × both
//   facings, measures face coverage), extras, anchors (rot/flip regression for every *Anchors),
//   context (critters on the real capybara rig, flipped host included).
// Perf (1920x1080, forced flush per draw — ≈ 1.25 ms of each figure is the flush — on a busy
//   shared machine): Gerald perched / flying / landing ≈ 7–8.5 ms (close-up at 4x ≈ 19 ms),
//   Shelley ≈ 10–12 ms, fish / bird / monkey ≈ 3–4 ms.
'use strict';
const { Path2D, DOMMatrix } = require('@napi-rs/canvas');
const U = require('./util');
const { TAU, clamp, lerp, mix, shade, rgba, hash1, noise1, smoothstep, ease } = U;

// ============================================================== drawing kit
// The key light is always WORLD upper-left. LX is the light side in the character's local
// (post-flip) frame: -1 = local left (unflipped), +1 = local right (flipped). LROT is the rotation
// of the current sub-frame (e.g. Gerald's pitched body) relative to the character frame, so rim /
// shadow crescents and side-lit gradients can be expressed in the character frame.
let LX = -1;
let LROT = 0;
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
// Gradient coordinates are authored for the unflipped character (lit from the left). When the
// character is flipped they are mirrored about the shape's centre (across the character-frame
// vertical, expressed in the current sub-frame), so the key light stays world upper-left.
function litPts(path, pts) {
  if (LX !== 1) return pts;
  const b = path.computeTightBounds();
  const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  const ax = Math.sin(LROT), ay = Math.cos(LROT); // character-frame vertical in this sub-frame
  return pts.map(([x, y]) => {
    const dx = x - cx, dy = y - cy, d = dx * ax + dy * ay;
    return [cx + 2 * d * ax - dx, cy + 2 * d * ay - dy];
  });
}
// crescent offset authored in the character frame → current sub-frame
const lOff = (dx, dy) => (LROT ? rot2(dx, dy, -LROT) : [dx, dy]);
function paint(ctx, path, c, o = {}) {
  let fs = c.base;
  if (o.lg) {
    const [[x0, y0], [x1, y1]] = litPts(path, [[o.lg[0], o.lg[1]], [o.lg[2], o.lg[3]]]);
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, c.hi); g.addColorStop(o.mid == null ? 0.5 : o.mid, c.base); g.addColorStop(1, c.lo);
    fs = g;
  } else if (o.rg) {
    const [[cx, cy]] = litPts(path, [[o.rg[0], o.rg[1]]]);
    const r = o.rg[2];
    const g = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
    g.addColorStop(0, c.hi); g.addColorStop(o.mid == null ? 0.55 : o.mid, c.base); g.addColorStop(1, c.lo);
    fs = g;
  }
  ctx.fillStyle = fs;
  ctx.fill(path);
  if (o.sh) { const [dx, dy] = lOff(LX * 0.45 * o.sh, -o.sh); crescent(ctx, path, dx, dy, c.sh || rgba(c.lo, 0.55)); }
  if (o.rim) { const [dx, dy] = lOff(-LX * 0.55 * o.rim, o.rim); crescent(ctx, path, dx, dy, c.rim || 'rgba(255,255,255,0.22)'); }
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

// ============================================================== mood blending (all critters)
// o.mood is a name OR a weight map ({smug: 0.7, shock: 0.3}, e.g. kit moodAt().weights); o.mood2 +
// o.moodMix (0..1) cross-fades toward a second mood. Every face / posture field is numeric (flags
// count as 0/1), so any mix is a plain weighted average and expression changes never pop.
function moodWeights(TABLE, o, def) {
  const w = {};
  const m = o.mood;
  if (m && typeof m === 'object') { for (const k in m) if (TABLE[k] && +m[k] > 0) w[k] = (w[k] || 0) + +m[k]; }
  else if (TABLE[m]) w[m] = 1;
  let tot = 0;
  for (const n in w) tot += w[n];
  if (!(tot > 0)) { for (const n in w) delete w[n]; w[def] = 1; tot = 1; }
  for (const n in w) w[n] /= tot;
  if (o.mood2 && TABLE[o.mood2] && o.moodMix > 0) {
    const k = clamp(o.moodMix);
    for (const n in w) w[n] *= 1 - k;
    w[o.mood2] = (w[o.mood2] || 0) + k;
  }
  return w;
}
const FACE_CACHE = new Map();
function blendFace(TABLE, DEF, w) {
  const F = {};
  for (const key in DEF) if (key !== 'look') F[key] = 0;
  let lx = 0, ly = 0, best = null, bw = -1;
  for (const n in w) {
    const f = TABLE[n], k = w[n];
    if (k > bw) { bw = k; best = n; }
    for (const key in F) F[key] += k * +(f[key] == null ? DEF[key] : f[key]);
    const L = f.look || DEF.look;
    lx += L.x * k; ly += L.y * k;
  }
  F.look = { x: lx, y: ly }; F.name = best; F.weights = w;
  return F;
}
function resolveFace(TABLE, DEF, o, def, tag) {
  if ((o.mood == null || typeof o.mood !== 'object') && !(o.mood2 && o.moodMix > 0)) {
    const name = TABLE[o.mood] ? o.mood : def;
    let F = FACE_CACHE.get(tag + name);
    if (!F) { F = blendFace(TABLE, DEF, { [name]: 1 }); FACE_CACHE.set(tag + name, F); }
    return F;
  }
  return blendFace(TABLE, DEF, moodWeights(TABLE, o, def));
}

// ============================================================== GERALD (vulture)
const GC = {
  body: { base: '#2E2A33', hi: '#453E4D', lo: '#1E1B23', line: '#121015', rim: 'rgba(182,170,214,0.36)', sh: 'rgba(6,4,10,0.30)' },
  vest: 'rgba(120,104,128,0.30)',
  wing: { base: '#2B2731', hi: '#413A49', lo: '#1B1820', line: '#121015', rim: 'rgba(182,170,214,0.32)', sh: 'rgba(6,4,10,0.32)' },
  edge: '#5A5066',
  wingFar: { base: '#1E1B23', hi: '#2A2630', lo: '#16141A', line: '#0E0C10' },
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
  // flight feathers: top side (charcoal) and underside (silver), shoulder → tip
  ftTop: ['#433C4C', '#2C2832'], ftUnder: ['#8F8A99', '#D2CDDA'],
  fingTop: ['#3E3846', '#24212A'], fingUnder: ['#A6A1AF', '#5E5967'],
};
// Faces + posture. lid: upper-lid closure · lo: lower lid pushed up · brow: rotation (+ = front end
// down) · browUp: height · arch: brow curvature (1 = default, − = sagging) · smile: gape corner (+ up)
// · curl: smirk crease · eye / pupil: scales · tilt: head pitch (− = chin up) · hdx/hdy: head offset
// · flat: straight lid edge · gape: beak hangs open · happy: closed smiling eyes · back: recoil ·
// droop: slump · POSTURE (reads at in-shot size): puff (chest out) · lean (body pitch, − = back) ·
// hunch (shoulders up, head sunk) · ruffUp (ruff raised) · bob (happy head bob) · ruffle (bristle)
const GFACE_DEF = {
  lid: 0, lo: 0, brow: 0, browUp: 0, arch: 1, smile: 0, curl: 0, tilt: 0, hdx: 0, hdy: 0, eye: 1, pupil: 1,
  ruffle: 0, gape: 0, happy: 0, flat: 0, back: 0, droop: 0, puff: 0, lean: 0, hunch: 0, ruffUp: 0, bob: 0,
  look: { x: 0.35, y: 0.3 },
};
const GFACE = {
  neutral: { lid: 0.2, lo: 0, brow: 0, browUp: 0.2, arch: 0.45, smile: 0.08, look: { x: 0.45, y: 0.15 } },
  smug: { lid: 0.34, lo: 0.28, brow: 0.38, browUp: 4.2, arch: 2.3, smile: 0.9, curl: 1, tilt: -0.27, hdy: -3, hdx: -2, puff: 0.9, lean: -0.09, look: { x: 1, y: 0.05 } },
  happy: { lid: 0.5, brow: -0.12, browUp: 2.6, arch: 1.1, smile: 1, curl: 0.5, happy: 1, tilt: -0.12, hdy: -1, puff: 0.4, ruffle: 0.14, bob: 1 },
  sad: { lid: 0.55, lo: 0.05, brow: -0.66, browUp: 1.8, arch: -0.6, smile: -1, tilt: 0.32, hdy: 7, hdx: 2.5, droop: 1, hunch: 0.35, lean: 0.07, look: { x: 0.2, y: 1 } },
  shock: { lid: 0, brow: -0.15, browUp: 4.4, arch: 1.4, smile: -0.5, eye: 1.3, pupil: 0.5, tilt: -0.14, ruffle: 0.85, back: 1, gape: 0.32, puff: 0.5, lean: -0.1, look: { x: 0.2, y: 0 } },
  deadpan: { lid: 0.6, lo: 0.18, brow: 0.06, browUp: -0.5, arch: 0.05, smile: 0, flat: 1, tilt: 0.06, hdy: 3.5, hdx: 1, look: { x: 0.75, y: 0 } },
  chill: { lid: 0.52, lo: 0.3, brow: -0.08, browUp: 0.8, arch: 0.8, smile: 0.8, curl: 0.3, tilt: 0.02, hdy: 3, lean: -0.05, puff: 0.2, look: { x: 0.3, y: 0.1 } },
  sleepy: { lid: 0.86, lo: 0.2, brow: -0.1, browUp: 0, arch: 0.25, smile: -0.1, tilt: 0.18, hdy: 5, droop: 0.5, hunch: 0.3, look: { x: 0.2, y: 0.7 } },
  worried: { lid: 0.04, brow: -0.6, browUp: 3, arch: -0.4, smile: -0.7, eye: 1.12, pupil: 0.68, tilt: 0.1, hunch: 1, ruffUp: 0.9, lean: 0.05, look: { x: 0.55, y: 0.05 } },
};
GFACE.panic = { ...GFACE.shock, brow: -0.55, arch: -0.35, smile: -0.85, gape: 0.45, hunch: 0.35, ruffUp: 0.6 };

// ---- rig geometry. Everything body-attached lives in an UPRIGHT BODY FRAME (origin = body pivot,
// perched orientation). The drawn body = that frame scaled by `bs` (puff / settle), rotated by `pitch`
// and placed at (bx, by). Level flight is the same frame pitched forward by G_TF with the body shape
// morphed to a streamlined one, so every pose (and every blend between poses) is one continuous rig.
const G_C = [-6, -46];        // perch body pivot (perch-local = drawVulture local coords)
const G_FC = [-5, -52];       // body centre in level flight
const G_TF = 1.38;            // pitch of level flight
const G_L = 128, G_SW = 0.45; // full wing length; arm (shoulder → wrist) fraction
// screen projection of the toward-camera axis (cheated, slightly elevated 3/4 view). The near wing's
// elevation flattens as it lowers (WPY_LO) so a lowered wing never hangs like a cape.
const WPX = -0.05, WPY = 0.62, WPY_LO = 0.36, WPY_FAR = 0.5;
const upP = (q) => [q[0] - G_C[0], q[1] - G_C[1]];
const upF = (q) => rot2(q[0] - G_FC[0], q[1] - G_FC[1], -G_TF);
const upFv = (v) => rot2(v[0], v[1], -G_TF);
const G_BODY_PERCH = [[-6, -85], [-24, -81], [-38, -65], [-43, -42], [-36, -20], [-16, -8], [8, -10], [24, -25], [29, -45], [23, -63], [11, -77]];
const G_BODY_FLY = [[24, -62], [6, -68], [-16, -67], [-36, -59], [-42, -51], [-30, -42], [-8, -37], [14, -39], [27, -46], [32, -55]];
// dense samples of the closed Catmull-Rom blob (same curve bl() draws); idx[i] = sample of vertex i
function denseClosed(pts, per = 12) {
  const n = pts.length, out = [], idx = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    idx.push(out.length);
    for (let k = 0; k < per; k++) {
      const t = k / per, m = 1 - t, a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t;
      out.push([a * p1[0] + b * c1[0] + c * c2[0] + d * p2[0], a * p1[1] + b * c1[1] + c * c2[1] + d * p2[1]]);
    }
  }
  return { pts: out, idx };
}
// resample between landmark vertices: lm = [[vertexIndex, pointsInSection], ...] (closed)
function resampleSections(D, lm) {
  const res = [], N = D.pts.length;
  for (let j = 0; j < lm.length; j++) {
    const a = D.idx[lm[j][0]], b = D.idx[lm[(j + 1) % lm.length][0]], cnt = lm[j][1];
    const poly = [];
    for (let i = a; ; i = (i + 1) % N) { poly.push(D.pts[i]); if (i === b) break; }
    const cum = [0];
    for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
    const tot = cum[cum.length - 1];
    let s = 1;
    for (let k = 0; k < cnt; k++) {
      const d = (tot * k) / cnt;
      while (s < cum.length - 1 && cum[s] < d) s++;
      const f = (d - cum[s - 1]) / (cum[s] - cum[s - 1] || 1);
      res.push(lerp2(poly[s - 1], poly[s], clamp(f)));
    }
  }
  return res;
}
// corresponding landmarks: 0 nape · 4 tail base · 5 vent · 8 chest
const G_LM = [[0, 6], [4, 2], [5, 5], [8, 4]];
const G_MORPH_P = resampleSections(denseClosed(G_BODY_PERCH.map(upP)), G_LM);
const G_MORPH_F = resampleSections(denseClosed(G_BODY_FLY.map(upF)), G_LM);
const KPU_P = { N: upP([12, -71]), S: upP([-6, -79]), H: upP([-2, -12]) };
const KPU_F = { N: upF([27, -56]), S: upF([4, -62]), H: upF([-18, -41]) };
// tail: base (upright frame) + rest angle / length, perch & flight
const G_TAILB_P = upP([-28, -16]), G_TAILB_F = upF([-32, -52]);
const G_TAIL_ANG_P = 1.94, G_TAIL_ANG_F = 1.73;
// chest feather rows [ax, ay, bx, by, bulgeX, bulgeY]
const G_ROWS_P = [0, 1, 2, 3].map((r) => { const y = -62 + r * 12; return [...upP([13 - (r > 1 ? 2 : 0), y + 1]), ...upP([29 - Math.abs(r - 1.2) * 1.8, y - 2]), 1.4, 3.6]; });
const G_ROWS_F = [0, 1, 2, 3].map((r) => [...upF([5 - r * 8, -41 + r * 0.8]), ...upF([27 - r * 4, -50 + r * 2]), ...upFv([3, 1.2])]);
const G_VEST = [upP([24, -40]), upF([18, -44])];
const G_THIGH = [upP([-1, -12.5]), upF([-17, -40])];
// the folded wing's exact silhouette (upright frame): shoulder → wrist, wrist → coat-tail tips
const G_FOLD_A = [3, 56], G_FOLD_H = [-30, 31];
// wing parameters: phi = elevation (+ up), beta = sweep (+ back), hs = hand length, sp = finger
// spread, chord = chord angle, flex = finger flex with the stroke, len = overall length,
// fbeta / fphi = far-wing offsets (lets the two wings separate, e.g. mantling, the heraldic spread)
const G_FOLD3 = { phiA: -1.42, phiH: -0.6, betaA: 0.15, betaH: 0.95, hs: 0.65, sp: 0, chord: 0, flex: 0, len: 1, fbeta: 0, fphi: 0, twist: 0 };
const G_WKEYS = Object.keys(G_FOLD3);
const G_ELEV = { phiA: 1, phiH: 1, betaH: 1, fphi: 1 };   // fold late (the hand closes like a fan first, then the wing lowers)
const G_POSES = ['perch', 'fly', 'land', 'takeoff'];
// perched spreads: the heraldic / sunning spread (wing:1) and mantling (settle / mantle)
const G_HERALD = { phiA: 0.98, phiH: 1.28, betaA: 0.22, betaH: 0.5, hs: 1, sp: 1, chord: -0.08, flex: 0, len: 0.94, fbeta: -0.42, fphi: 0.08, twist: 0 };
const G_MANTLE = { phiA: -0.22, phiH: -0.5, betaA: 0.66, betaH: 1.08, hs: 1, sp: 0.6, chord: 0.05, flex: 0, len: 0.97, fbeta: -1.55, fphi: 0.15, twist: 0 };

// pose vector for one named pose (everything continuous so poses can be blended)
function geraldPose(name, S) {
  const { F, fl, breath, legs, o } = S;
  const { sn, cs, up } = fl;
  const w = clamp(Number.isFinite(o.wing) ? o.wing : (name === 'perch' ? 0 : 1));
  const V = {
    pitch: 0, shapeK: 0, bx: G_C[0], by: G_C[1] + breath * 0.5, hox: 26, hoy: -9, hr: 0,
    knee: 0.4, legW: 5.4, open: 0, tuck: 0, fold: 0, fan: 0, nA: [1, -2], fA: [-4, -3],
    phiA: 0, phiH: 0, betaA: 0.1, betaH: 0.2, hs: 1, sp: 1, chord: 0, flex: 1, len: 1, fbeta: 0, fphi: 0, twist: 0,
  };
  const L = legs;
  if (name === 'perch') {
    const bal = Number.isFinite(o.flapPhase) ? 1 : 0;
    const cr = clamp(o.crouch || 0);
    const mm = clamp(o.mantle == null ? 0.55 * clamp(o.settle || 0) : o.mantle);
    V.pitch = 0.05 * F.droop - 0.04 * F.back + cr * 0.06;
    V.by += cr * 6 - 2 * F.back - 1.5 * sn * bal * w;
    V.knee = 0.4 + cr * 3;
    const open = Math.max(w, mm);
    V.fold = 1 - open;
    // spread target: heraldic (wing) ↔ mantle; balancing flaps rock the raised wings
    const km = open > 0 ? mm / (w + mm || 1) : 0;
    for (const k of G_WKEYS) V[k] = lerp(G_HERALD[k], G_MANTLE[k], km);
    V.phiA += bal * 0.32 * cs * (1 - km); V.phiH += bal * (0.26 * cs + 0.18 * sn) * (1 - km);
    V.flex = bal;
  } else if (name === 'fly') {
    const gl = S.glide;
    V.shapeK = 1;
    V.pitch = G_TF - (gl ? 0 : 0.04 * cs);
    V.bx = G_FC[0]; V.by = G_FC[1] - (gl ? 0 : sn * 3.5 * w) + breath * 0.3;
    V.hox = 22; V.hoy = -3; V.hr = 0.08;
    V.legW = 4.4; V.tuck = 1; V.knee = 1.8;
    const body = (q) => { const r = rot2(q[0], q[1], V.pitch); return [V.bx + r[0], V.by + r[1]]; };
    V.nA = body(upF([-34, -42])); V.fA = body(upF([-38, -43.5]));
    if (gl) {
      V.phiA = 0.08 + 0.04 * Math.sin(S.t * 1.3); V.phiH = V.phiA + 0.14;
      V.betaA = 0.16; V.betaH = 0.4; V.flex = 0; V.chord = 0.02;
      V.sp = lerp(0.35, 1, w); V.len = lerp(0.78, 1, w); V.hs = lerp(0.7, 1, w);
    } else {
      // downstroke: the arm sweeps forward and down (never past ~55° below horizontal), the hand
      // trails so the fingers fan back; upstroke: the wrist flexes, the hand swings back and up
      const dn = smoothstep(0.1, 1, -cs);
      V.phiA = lerp(-0.3, 0.22 + 0.9 * cs, w); V.phiH = V.phiA + 0.28 * sn * w - 0.1 * dn * w;
      V.betaA = 0.06 + 0.16 * up * w - 0.6 * dn * w; V.betaH = 0.18 + 0.55 * up * w - 0.1 * dn * w + (1 - w) * 0.55;
      V.twist = -0.42 * dn * w; // screen-space nudge forward at the bottom (no extra foreshortening)
      V.hs = (1 - 0.3 * up) * lerp(0.62, 1, w); V.sp = lerp(0.3, 1, w) * (1 - 0.3 * up);
      V.len = lerp(0.8, 1, w) * (1 - 0.04 * dn); V.chord = -0.03 * cs + 0.12 * dn; V.flex = w;
    }
  } else if (name === 'land') {
    const Lc = clamp(L);
    // flare: the body is pitched up from level flight to ~45° (not bolt upright), the feet are
    // thrown forward (hips ride behind and above them), the head carried forward, tail fanned
    V.pitch = 0.3 + 0.25 * Lc - 0.5 * Math.min(0, L);
    const hip = L >= 0 ? [-2 - 17 * Lc, -12 - 17 * Lc] : [-2 + 6 * L, -12 - 20 * L];
    const hr = rot2(KPU_P.H[0], KPU_P.H[1], V.pitch);
    V.bx = hip[0] - hr[0]; V.by = hip[1] - hr[1] - sn * 2 * Lc * w + breath * 0.3;
    V.hox = lerp(27, 31, Lc); V.hoy = lerp(-8, -7, Lc);
    V.legW = 5; V.open = Lc; V.knee = L >= 0 ? -2.5 * Lc : -3 * L;
    V.nA = [0, -3]; V.fA = [-2.5, -4]; V.fan = 1;
    V.phiA = lerp(-0.3, 1.08 + 0.32 * cs, w); V.phiH = V.phiA + 0.3 * sn * w;
    V.betaA = lerp(0.1, -0.12, w); V.betaH = -0.05 + 0.45 * up * w + (1 - w) * 0.4;
    V.hs = 1 - 0.2 * up; V.sp = lerp(0.5, 1, w); V.chord = -0.12 * Lc;
  } else { // takeoff
    V.pitch = L >= 0 ? 0.55 * L : -0.4 * L; V.bx = G_C[0] + 8 * L; V.by = G_C[1] - 12 * L - sn * 2 * clamp(L) * w + breath * 0.3;
    if (L < 0) { V.bx = G_C[0] - 6 * L; V.by = G_C[1] - 20 * L + breath * 0.3; }
    V.hox = lerp(26, 25, L); V.hoy = lerp(-9, -2, L); V.hr = 0.05 * L;
    V.legW = 5; V.open = 0.25 * clamp(L); V.knee = L >= 0 ? 7 * L : -3 * L;
    V.nA = [0, -3]; V.fA = [-2.5, -4];
    const dn = smoothstep(0.1, 1, -cs);
    V.phiA = lerp(-0.3, 0.42 + 0.92 * cs, w); V.phiH = V.phiA + 0.45 * sn * w;
    V.betaA = 0.05 + 0.2 * up * w - 0.45 * dn * w; V.betaH = 0.15 + 0.6 * up * w + 0.35 * dn * w + (1 - w) * 0.4;
    V.hs = 1 - 0.3 * up; V.sp = lerp(0.5, 1, w); V.chord = 0.25 * clamp(L);
  }
  return V;
}
function lerpPose(A, B, k) {
  const R = {};
  for (const key in A) {
    const a = A[key], b = B[key];
    R[key] = Array.isArray(a) ? [lerp(a[0], b[0], k), lerp(a[1], b[1], k)] : lerp(a, b, k);
  }
  return R;
}
const G_FLAP_HZ = 2.3;

// pose/rig solver shared by drawVulture and vultureAnchors
function geraldRig(o) {
  const t = Number.isFinite(o.t) ? o.t : 0;
  const pose = G_POSES.includes(o.pose) ? o.pose : 'perch';
  let pose2 = null, mk = 0;
  if (G_POSES.includes(o.pose2) && o.poseMix > 0) { pose2 = o.pose2; mk = clamp(o.poseMix); }
  else if (pose === 'fly' && o.flare > 0) { pose2 = 'land'; mk = clamp(o.flare); }
  const F = resolveFace(GFACE, GFACE_DEF, o, 'smug', 'g:');
  const talk = clamp(o.talk || 0);
  const breath = Math.sin(t * 1.7);
  const legs = clamp(Number.isFinite(o.legs) ? o.legs : 1, -0.3, 1);
  // flap cycle: phase 0 = wings at the top, 0.5 = bottom (downstroke = first 55% of the cycle)
  const fp = Number.isFinite(o.flapPhase) ? o.flapPhase : t * G_FLAP_HZ;
  const p = fp - Math.floor(fp);
  const wv = p < 0.55 ? (p / 0.55) * 0.5 : 0.5 + ((p - 0.55) / 0.45) * 0.5;
  const th = TAU * wv, sn = Math.sin(th), cs = Math.cos(th);
  const fl = { p, fp, sn, cs, up: Math.max(0, -sn) };
  const S = { F, fl, breath, legs, o, t, glide: !!o.glide };
  let V = geraldPose(pose, S);
  if (pose2) V = lerpPose(V, geraldPose(pose2, S), mk);
  const R = V;
  const perchW = (pose === 'perch' ? 1 - mk : 0) + (pose2 === 'perch' ? mk : 0);
  Object.assign(R, { pose, pose2, mix: mk, mood: F.name, F, talk, t, legs, flap: fl, glide: S.glide, perchW });
  // ---- gestures (perch)
  const settle = clamp(o.settle || 0) * perchW, preen = clamp(o.preen || 0), grip = clamp(o.grip || 0);
  const cling = clamp(o.cling || 0) * perchW;
  R.settle = settle; R.preen = preen; R.grip = grip; R.cling = cling;
  // mood posture (strongest when perched): lean, hunch, puff
  R.pitch += (F.lean + 0.07 * F.hunch) * perchW;
  R.by += 7 * settle;
  if (cling > 0) {
    // hugging a vertical pole just in front of the feet: body hangs behind it, legs reach forward
    R.bx = lerp(R.bx, G_C[0] - 25, cling); R.by = lerp(R.by, G_C[1] + 14, cling); R.pitch = lerp(R.pitch, -0.2, cling);
    R.knee = lerp(R.knee, 5, cling);
  }
  if (grip > 0) { // clench: sink onto the feet a touch + tremble
    R.by += 2 * grip; R.knee += 1.5 * grip;
    const tr = grip * 0.55;
    R.bx += noise1(t * 31 + 2) * tr; R.by += noise1(t * 27 + 9) * tr * 0.7; R.pitch += noise1(t * 23 + 4) * 0.012 * grip;
  }
  R.bs = 1 + 0.045 * F.puff * perchW + 0.13 * settle;
  R.fan = smoothstep(0.45, 0.9, R.fan);
  R.fold = clamp(Number.isFinite(o.fold) ? o.fold : V.fold);
  // tuck order: the joints close first (sweep, hand, fingers), then the wing lowers into place —
  // and in reverse (unfolding) the folded wing is raised first, then opens: it never opens downward
  R.W = {};
  const fJ = smoothstep(0, 0.6, R.fold), fE = smoothstep(0.3, 0.92, R.fold);
  for (const k of G_WKEYS) R.W[k] = lerp(V[k], G_FOLD3[k], G_ELEV[k] ? fE : fJ);
  // raised but still folding: the hand keeps its direction and closes like a fan (shorter, fingers
  // together) — it never swings edge-on through the camera axis
  const mid = fJ * (1 - fE);
  R.W.hs *= 1 - 0.3 * mid; R.W.sp *= 1 - 0.7 * mid;
  // spread wings stay above the perch while standing on it (never sweep across a host's face)
  const gw = (pose === 'perch' ? 1 - mk : 0) + (pose2 === 'perch' ? mk : 0);
  const lw = ((pose === 'land' || pose === 'takeoff') ? 1 - mk : 0) + ((pose2 === 'land' || pose2 === 'takeoff') ? mk : 0);
  R.floorW = clamp(gw + lw * (1 - smoothstep(0, 0.35, legs))) * (o.floor === false ? 0 : 1);
  R.floorY = -5;
  const k = R.shapeK;
  R.KP = { N: lerp2(KPU_P.N, KPU_F.N, k), S: lerp2(KPU_P.S, KPU_F.S, k), H: lerp2(KPU_P.H, KPU_F.H, k) };
  R.B = (x, y) => { const r = rot2(x * R.bs, y * R.bs, R.pitch); return [R.bx + r[0], R.by + r[1]]; };
  // spread wings show the slimmer body (no folded-wing cloak)
  R.slim = lerp(lerp(0.84, 1, smoothstep(0.55, 1, R.fold)), 1, k);
  // ---- head
  const look = o.look || F.look;
  const nod = clamp(o.nod || 0);
  const bob = F.bob * Math.max(0, Math.sin(t * 7.5)) * 1.6;
  let hox = V.hox + F.hdx + 3 * nod - 2.5 * F.hunch - 4 * F.back + Math.min(1, F.droop * 2);
  const mantleK = clamp(o.mantle || 0) * perchW;
  hox += 3 * mantleK;
  let hoy = V.hoy + F.hdy + 6 * nod + 5 * F.hunch - 6 * F.back + 2 * F.droop - bob - 2 * settle + 5 * mantleK;
  const nb = R.B(R.KP.N[0], R.KP.N[1]);
  R.neckBase = nb;
  R.look = look;
  R.hx = nb[0] + hox + (look.x || 0) * 1.2;
  R.hy = nb[1] + hoy + (look.y || 0) * 1.5 + talk * 0.8 + breath * 0.3;
  R.hr = F.tilt + 0.04 * noise1(t * 0.35 + 3) - talk * 0.05 + V.hr + (look.y || 0) * 0.08 + nod * 0.42;
  R.hs = 1.3; R.hsx = 1;
  if (preen > 0) {
    // the head swings back over the shoulder and tucks the beak into the folded wing
    const kp = ease.inOutSine(smoothstep(0, 0.75, preen));
    R.pitch -= 0.06 * kp; // a little twist back toward the wing
    const tgt = R.B(1, -27);
    const nib = 0.6 * Math.sin(t * 9) * smoothstep(0.75, 1, preen);
    R.hx = lerp(R.hx, tgt[0], kp); R.hy = lerp(R.hy, tgt[1] + nib, kp);
    R.hr = lerp(R.hr, -0.6 + 0.05 * nib, kp);
    const turn = smoothstep(0.2, 0.62, preen);
    R.hsx = turn < 0.5 ? lerp(1, 0.5, turn * 2) : lerp(-0.5, -1, turn * 2 - 1);
  }
  return R;
}
// head-local → gerald-local
function gHead(R, x, y) {
  const [rx, ry] = rot2(x * R.hs * R.hsx, y * R.hs, R.hr);
  return [R.hx + rx, R.hy + ry];
}

function geraldHead(ctx, R) {
  const { F, talk } = R;
  ctx.save();
  ctx.translate(R.hx, R.hy);
  const hf = R.hsx < 0;
  ctx.rotate(R.hr);
  ctx.scale(R.hs * R.hsx, R.hs);
  const lrot = LROT, llx = LX; LROT = R.hr; if (hf) LX = -LX;
  // --- beak geometry: the upper mandible lifts a touch, the lower mandible swings down about
  // the gape. The mouth cavity is built from the two mandibles' real tomial edges, so it never
  // pokes outside the beak.
  const open = clamp(talk + F.gape);
  const jaw = open * 0.42, ua = -open * 0.08;
  const UPm = (x, y) => { const [rx, ry] = rot2(x - 12, y + 2, ua); return [12 + rx, -2 + ry]; };
  const LOm = (x, y) => { const [rx, ry] = rot2(x - 12.5, y - 2.5, jaw); return [12.5 + rx, 2.5 + ry]; };
  if (open > 0.02) {
    const cav = new Path2D();
    cv([[10.5, 3.2], [16, 2.4], [21, 1.7], [25.6, 2.2], [27.4, 3.6]].map((q) => UPm(q[0], q[1])), 1, cav);
    cv([[26.0, 2.5], [22, 2.1], [17, 2.35], [11, 2.3]].map((q) => LOm(q[0], q[1])), 1, cav, false);
    cav.closePath();
    ctx.fillStyle = GC.mouth; ctx.fill(cav);
    ctx.save(); ctx.clip(cav);
    const [tx, ty] = LOm(17.5, 1.4);
    ctx.fillStyle = '#C8606A'; ctx.beginPath(); ctx.ellipse(tx, ty, 5.2, 2.3, jaw * 0.85, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(30,6,10,0.35)';
    const [sx, sy] = UPm(19, 2.2); ctx.beginPath(); ctx.ellipse(sx, sy + 0.6, 8, 1.6, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(12.5, 2.5); ctx.rotate(jaw); ctx.translate(-12.5, -2.5);
  const lo = new Path2D();
  lo.moveTo(11, 2.3);
  lo.bezierCurveTo(17, 2.5, 22.5, 2.0, 26.2, 2.5);
  lo.bezierCurveTo(24.6, 6.0, 18.5, 8.0, 12, 7.8);
  lo.closePath();
  paint(ctx, lo, { ...GC.beak, base: '#DCCFAE', hi: '#EEE5CC' }, { lg: [0, 2, 0, 8], lw: 1.1 });
  ctx.restore();
  // --- skull (domed, bald)
  const skull = bl([[-15.5, 2], [-15, -9], [-8, -18.5], [4, -19], [13, -13], [16.5, -3], [14, 7.5], [3, 12], [-8, 11]]);
  paint(ctx, skull, GC.head, { rg: [2, -10, 27], rim: 1.7, sh: 2.4, lw: 1.5, mid: 0.5 });
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
  ctx.translate(12, -2); ctx.rotate(ua); ctx.translate(-12, 2);
  const up = new Path2D();
  up.moveTo(11.5, -8.5);
  up.bezierCurveTo(19, -11, 27, -9.5, 30.5, -3.8);
  up.bezierCurveTo(32.6, -0.2, 31.8, 5.2, 28.6, 7.8);
  up.bezierCurveTo(28.6, 4.8, 28, 2.8, 25.8, 2.2);
  up.bezierCurveTo(21, 1.4, 16, 2.3, 10.5, 3.2);
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
  // --- gape (mouth corner): up-curl = pleased, down-turn = sad; smug adds a crease
  const sm = F.smile;
  const gx = 8.0, gy = 2.6 - sm * 2.6;
  const gp = new Path2D();
  gp.moveTo(13.5, 2.8);
  gp.quadraticCurveTo(10.4, 3.3 + sm * 0.5, gx, gy);
  strokeP(ctx, gp, '#7E322C', 1.6);
  const curl = F.curl;
  if (curl > 0.02) {
    const ck = new Path2D();
    ck.moveTo(gx + 0.4, gy - 0.2); ck.quadraticCurveTo(gx - 2.4, gy - 1.2 * curl, gx - 2.6, gy - 3.8 * curl);
    strokeP(ctx, ck, rgba('#7E322C', Math.min(1, curl * 1.5)), 1.35);
    const cr = new Path2D();
    cr.moveTo(gx - 1.2, gy + 2.2); cr.quadraticCurveTo(gx - 4.2, gy + 0.6, gx - 4.6, gy - 2.8 * curl);
    strokeP(ctx, cr, rgba('#8A3A33', 0.55 * curl), 1);
  }
  if (sm < -0.3) {
    const dn = new Path2D();
    dn.moveTo(gx + 0.2, gy); dn.quadraticCurveTo(gx - 1.6, gy + 0.4, gx - 2.2, gy + 2.2 * -sm);
    strokeP(ctx, dn, rgba('#7E322C', smoothstep(0.3, 0.5, -sm)), 1.3);
  }
  // --- eye (happy weight closes it into a smiling arc)
  const eyeS = F.eye;
  const ex = 4.6, ey = -5.4, erx = 4.9 * eyeS, ery = 5.5 * eyeS;
  const blink = o_blink(R);
  const hw = F.happy;
  const openA = 1 - smoothstep(0.82, 1, hw);
  if (openA > 0.003) {
    ctx.save(); ctx.globalAlpha *= openA;
    const eye = el(ex, ey, erx, ery);
    ctx.fillStyle = '#FFF8EC'; ctx.fill(eye);
    const lk = R.look;
    const pr = 2.85 * F.pupil;
    const px = ex + 0.6 + clamp(lk.x || 0, -1, 1) * (erx - pr - 1.2), py = ey + 0.9 + clamp(lk.y || 0, -1, 1) * (ery - pr - 1.6);
    ctx.save(); ctx.clip(eye);
    ctx.fillStyle = '#2B1A17';
    ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(px - pr * 0.32, py - pr * 0.36, Math.max(0.55, pr * 0.3), 0, TAU); ctx.fill();
    const lid = clamp(lerp(Math.max(clamp(F.lid + (1 - F.lid) * blink), 0.6 * smoothstep(0.5, 1, R.preen)), 1, smoothstep(0.3, 0.82, hw)));
    if (lid > 0.01) {
      const ly = ey - ery + lid * ery * 2.1;
      const bow = lerp(1.6, 0.1, F.flat);
      const lp = new Path2D();
      lp.moveTo(ex - erx - 2, ey - ery - 3);
      lp.lineTo(ex + erx + 2, ey - ery - 3);
      lp.lineTo(ex + erx + 2, ly - 0.8);
      lp.quadraticCurveTo(ex, ly + bow, ex - erx - 2, ly - 0.2);
      lp.closePath();
      ctx.fillStyle = GC.lid; ctx.fill(lp);
      const ll = new Path2D();
      ll.moveTo(ex - erx - 1, ly - 0.2); ll.quadraticCurveTo(ex, ly + bow, ex + erx + 1, ly - 0.8);
      strokeP(ctx, ll, '#4A1E1C', 1.7);
    }
    // lower lid pushed up by the cheek (smug / chill / knowing)
    const lo2 = F.lo + hw * 0.25;
    if (lo2 > 0.01) {
      const by = ey + ery - lo2 * ery * 2;
      const lp2 = new Path2D();
      lp2.moveTo(ex - erx - 2, ey + ery + 3); lp2.lineTo(ex + erx + 2, ey + ery + 3);
      lp2.lineTo(ex + erx + 2, by + 0.6); lp2.quadraticCurveTo(ex, by - 1.8, ex - erx - 2, by + 0.2); lp2.closePath();
      ctx.fillStyle = '#D87363'; ctx.fill(lp2);
      const l2 = new Path2D(); l2.moveTo(ex - erx - 1, by + 0.2); l2.quadraticCurveTo(ex, by - 1.8, ex + erx + 1, by + 0.6);
      strokeP(ctx, l2, 'rgba(120,40,36,0.75)', 1.1);
    }
    ctx.restore();
    ctx.lineWidth = 1; ctx.strokeStyle = '#8A3A33'; ctx.stroke(eye);
    const bag = new Path2D();
    bag.moveTo(ex - erx + 0.5, ey + ery + 0.8); bag.quadraticCurveTo(ex + 0.5, ey + ery + 3.2, ex + erx, ey + ery - 0.2);
    strokeP(ctx, bag, 'rgba(135,56,50,0.6)', 0.9);
    ctx.restore();
  }
  if (hw > 0.35) {
    ctx.save(); ctx.globalAlpha *= smoothstep(0.35, 0.8, hw);
    const hp = new Path2D();
    hp.moveTo(0.1, -3.8); hp.quadraticCurveTo(4.5, -10.2, 9.0, -4.0);
    strokeP(ctx, hp, '#3A1A1A', 2);
    const cr = new Path2D(); cr.moveTo(-0.6, -1.4); cr.quadraticCurveTo(2.5, 0.8, 6.2, -0.2);
    strokeP(ctx, cr, 'rgba(135,56,50,0.65)', 1);
    ctx.fillStyle = 'rgba(255,120,130,0.38)';
    ctx.beginPath(); ctx.ellipse(6, 2.5, 4.5, 2.6, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // brow (bold fleshy ridge — it carries the acting at in-shot sizes)
  ctx.save();
  ctx.translate(ex + 0.6, ey - ery - 1.6 - F.browUp * 0.95);
  ctx.rotate(F.brow);
  const A = F.arch;
  const br = new Path2D();
  br.moveTo(-6.6, 1.0); br.quadraticCurveTo(0, -1.6 - 1.9 * A, 6.4, 0.3); br.quadraticCurveTo(0, 1.9 - 1.9 * A, -6.6, 1.0); br.closePath();
  ctx.fillStyle = '#9A3E35'; ctx.fill(br);
  ctx.lineWidth = 1.3; ctx.strokeStyle = '#5E231F'; ctx.lineJoin = 'round'; ctx.stroke(br);
  ctx.restore();
  LROT = lrot; LX = llx;
  ctx.restore();
}
function o_blink(R) { return R.F.lid > 0.6 ? blinkAmt(R.t, 5.3, 0.45, 0.37) : blinkAmt(R.t, 4.6, 0.32, 0.37); }

function geraldRuff(ctx, R, ruffle) {
  const k = R.shapeK;
  const [cx, cy] = R.KP.N;
  const ru = R.F.ruffUp + 0.3 * R.F.hunch;
  const n = 14 + Math.round(ruffle * 4);
  const rr = lerp(1.1, 1.5 - G_TF, k);
  const p = scallop(cx + 1 - ru * 1.5, cy - ru * 3, 18 + ruffle * 3 + ru * 3, 11.5 + ruffle * 3 + ru * 3.5, rr, n, 2.6 + ruffle * 2.4 + ru * 0.8, 11);
  const [gx, gy] = lerp2([8, 15], upFv([8, 15]), k);
  paint(ctx, p, GC.ruff, { lg: [cx - gx, cy - gy, cx + gx, cy + gy], rim: 1.6, sh: 3.4, lw: 1.3 });
  const f = new Path2D();
  const fr = lerp(0, 0.4 - G_TF, k);
  for (let i = 0; i < 6; i++) {
    const [ax, ay] = rot2(-9 + (i % 2) * 3, (i - 2.5) * 4.6, fr);
    const [dx, dy] = rot2(3, 1.2, fr), [ex, ey] = rot2(5.5, 3.5, fr);
    f.moveTo(cx + ax, cy + ay);
    f.quadraticCurveTo(cx + ax + dx, cy + ay + dy, cx + ax + ex, cy + ay + ey);
  }
  strokeP(ctx, f, 'rgba(140,128,160,0.5)', 0.9);
}

// near folded wing (perch-local coordinates: draw inside the body frame shifted by -G_C)
function geraldFoldedWing(ctx, R) {
  const rf = smoothstep(0.45, 0.9, R.preen);
  for (const [x0, y0, x1, y1] of [[-27, -26, -57, 4], [-23, -21, -52, 8], [-19, -18, -46, 9.5]]) {
    const pf = leaf(x0, y0, x1, y1, 4.4, undefined, 0.38);
    paint(ctx, pf, GC.wing, { lg: [x0, y0, x1, y1], rim: 1.1, lw: 1.3 });
  }
  const W = bl([[-6, -86.5], [6, -82], [14.5, -69], [15, -51], [9, -33], [-4, -21], [-20, -13], [-34, -12], [-41, -26], [-42.5, -46], [-39, -66], [-25, -82]], 0.95);
  paint(ctx, W, GC.wing, { lg: [-24, -88, -6, -8], rim: 2.4, sh: 3, lw: 1.6 });
  ctx.save();
  ctx.clip(W);
  const rows = [
    { g: [[17, -49], [-4, -50], [-24, -46], [-46, -38]], n: 4, d: 10, c: 1 },
    { g: [[16, -67], [-2, -70], [-20, -69], [-42, -61]], n: 5, d: 7, c: 0.55 },
  ];
  for (let ri = 0; ri < rows.length; ri++) {
    const { g, n, d, c } = rows[ri];
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
      const dk = d * (0.85 + hash1(i + ri * 5) * 0.3) + rf * 2.2 * noise1(R.t * 14 + i * 2.3 + ri);
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
  const sl = new Path2D();
  for (let i = 0; i < 5; i++) {
    const x = 8 - i * 9;
    sl.moveTo(x, -38 + i * 1.6);
    sl.quadraticCurveTo(x - 3, -27 + i * 1.2, x - 9, -16 + i * 0.6);
  }
  ctx.save(); ctx.translate(0.8, 0.8); strokeP(ctx, sl, rgba(GC.edge, 0.8), 1.4); ctx.restore();
  strokeP(ctx, sl, 'rgba(12,10,16,0.75)', 1);
  ctx.restore();
  if (rf > 0.15) {
    // ruffled coverts where the beak is working
    const tf = new Path2D();
    for (let i = 0; i < 4; i++) {
      const x = -24 + i * 6, y = -64 + (i % 2) * 5;
      const a = -2.2 + noise1(R.t * 12 + i * 3) * 0.5;
      leaf(x, y, x + Math.cos(a) * 9 * rf, y + Math.sin(a) * 9 * rf, 1.8, tf);
    }
    ctx.fillStyle = GC.wing.hi; ctx.fill(tf);
    ctx.lineWidth = 1; ctx.strokeStyle = GC.wing.line; ctx.stroke(tf);
  }
}

// ---- spread wing: a 3D arm + hand (elevation phi, sweep beta) projected to a cheated, slightly
// elevated 3/4 view, then art-directed so it always reads as a wing:
//  · near wing: as a segment turns toward the camera it swings BACK past the shoulder instead of
//    shrinking to a stub (the stroke passes through "swept back"); where the wing lines up with
//    its own chord it is drawn as a deliberate tapered blade (narrow chord, fingers fanned at the
//    tip) and drawVulture adds motion arcs — never a knot of feathers at the shoulder.
//  · far wing: shows above the back while raised; as it lowers it slides behind the body.
//  · fold 0..1: tweens the 3D pose toward the tuck, then (last 30%) onto the exact folded-wing
//    silhouette; drawVulture cross-fades to the folded art over the last ~15%.
function wingProj(phi, beta, near) {
  const cb = Math.cos(beta);
  const z = Math.cos(phi) * cb * (near ? 1 : -1);
  const py = near ? lerp(WPY_LO, WPY, smoothstep(-0.45, 0.55, phi)) : WPY_FAR;
  return [-Math.sin(beta) + z * WPX, -Math.sin(phi) * cb + z * py];
}
function sweepBack(v, amt) {
  const d = Math.max(0, 0.8 - Math.hypot(v[0], v[1]));
  return [v[0] - d * 1.1 * amt, v[1] - d * 0.12 * amt];
}
function geraldWingGeom(R, near) {
  const W = R.W, fold = R.fold;
  const kp = R.KP.S;
  const S0 = R.B(kp[0] + (near ? 0 : 5), kp[1] + (near ? 0 : -2.5));
  const dip = (1 - 0.22 * Math.sin(Math.PI * fold)) * W.len;
  const la = G_L * G_SW * dip, lh = G_L * (1 - G_SW) * W.hs * dip;
  const fb = near ? 0 : W.fbeta, fph = near ? 0 : W.fphi;
  let a = wingProj(W.phiA + fph, W.betaA + fb, near), h = wingProj(W.phiH + fph, W.betaH + fb, near);
  const k2 = smoothstep(0.7, 1, fold);
  if (near) {
    a = sweepBack(a, 1 - k2); h = sweepBack(h, 1 - k2);
    if (W.twist) { a = rot2(a[0], a[1], W.twist); h = rot2(h[0], h[1], W.twist); }
  }
  let Va = [a[0] * la, a[1] * la], Vh = [h[0] * lh, h[1] * lh];
  if (k2 > 0) {
    Va = lerp2(Va, rot2(G_FOLD_A[0] * R.bs, G_FOLD_A[1] * R.bs, R.pitch), k2);
    Vh = lerp2(Vh, rot2(G_FOLD_H[0] * R.bs, G_FOLD_H[1] * R.bs, R.pitch), k2);
  }
  let C = [Math.cos(W.chord), Math.sin(W.chord)];
  const D = [Va[0] + Vh[0], Va[1] + Vh[1]], Dn = Math.hypot(D[0], D[1]) || 1;
  const cr = (C[0] * D[1] - C[1] * D[0]) / Dn; // sin(angle chord → span): 0 = edge-on
  // last part of the tuck: the spread wing shrinks inside the folded-wing art that covers it
  const k3 = smoothstep(0.8, 0.95, fold);
  if (k3 > 0) { Va = [Va[0] * (1 - 0.12 * k3), Va[1] * (1 - 0.12 * k3)]; Vh = [Vh[0] * (1 - 0.12 * k3), Vh[1] * (1 - 0.12 * k3)]; }
  let cw = lerp(1, 0.96, k2) * (1 - 0.42 * k3), uc = -3 * k3, e = 0, alpha = 1;
  if (near) {
    e = (1 - smoothstep(0.14, 0.55, Math.abs(cr))) * (1 - k2);
    if (e > 0.001) {
      // blade: chord turned toward perpendicular, narrowed and centred on the span line
      const sg = cr >= 0 ? 1 : -1;
      const Cp = [(sg * D[1]) / Dn, (-sg * D[0]) / Dn];
      const c2 = lerp2(C, Cp, e), cn = Math.hypot(c2[0], c2[1]) || 1;
      C = [c2[0] / cn, c2[1] / cn];
      cw *= lerp(1, 0.36, e); uc = 8 * e;
    }
  } else {
    // far wing: visible while it points up (above the back); lowering → it slides behind the body
    const upk = -D[1] / Dn;
    const vis = Math.max(smoothstep(-0.05, 0.5, upk), clamp(W.fbeta < -0.8 ? (-W.fbeta - 0.8) * 2 : 0));
    // tucking: it shrinks into the shoulder (behind the body) instead of fading (no ghosting)
    const sk = lerp(0.3, 1, vis) * lerp(1, 0.3, smoothstep(0.3, 0.8, fold));
    Va = [Va[0] * sk, Va[1] * sk]; Vh = [Vh[0] * sk, Vh[1] * sk];
    alpha = smoothstep(0, 0.45, vis);
  }
  const under = near ? smoothstep(0.08, -0.4, cr) * (1 - k2) : 0;
  return { S0, Va, Vh, C, cw, uc, e, sp: W.sp, flex: W.flex, near, under, alpha, k3 };
}
const G_FING = [
  [[-21, 0.74], [-34, 0.92]], [[-15, 0.75], [-26, 1.01]], [[-9, 0.76], [-17, 1.07]],
  [[-3, 0.75], [-8, 1.1]], [[3, 0.73], [1.5, 1.08]], [[8, 0.70], [9.5, 1.0]],
];
function softFloor(y, f, k = 7) { return y < f - k ? y : f - k * Math.exp(-(y - (f - k)) / k); }
function geraldWingDraw(ctx, R, G) {
  const { S0, Va, Vh, C, cw, uc, sp, near, under, e } = G;
  const cux = C[0] * cw, cuy = C[1] * cw;
  const Wr = [S0[0] + Va[0], S0[1] + Va[1]];
  const fw = R.floorW, fy = R.floorY;
  const top = 1 - (G.k3 || 0);
  const M = (u, s) => {
    u += uc;
    if (s < 0) s *= top;
    let x, y;
    if (s <= G_SW) { const f = s / G_SW; x = S0[0] + u * cux + f * Va[0]; y = S0[1] + u * cuy + f * Va[1]; }
    else { const f = (s - G_SW) / (1 - G_SW); x = Wr[0] + u * cux + f * Vh[0]; y = Wr[1] + u * cuy + f * Vh[1]; }
    if (fw > 0 && y > fy - 7) y = lerp(y, softFloor(y, fy), fw);
    return [x, y];
  };
  const dim = near ? 0 : 0.5;
  const dk = (c) => mix(c, '#121016', dim);
  const ft = [dk(mix(GC.ftTop[0], GC.ftUnder[0], under)), dk(mix(GC.ftTop[1], GC.ftUnder[1], under))];
  const fg = [dk(mix(GC.fingTop[0], GC.fingUnder[0], under)), dk(mix(GC.fingTop[1], GC.fingUnder[1], under))];
  const line = GC.wing.line;
  // span density: feathers keep their spacing when the wing is foreshortened
  const dens = clamp(Math.hypot(Va[0], Va[1]) / (G_L * G_SW), 0.35, 1.1);
  // primaries ("fingers"), inner → outer; tips flex against the air with the stroke; in the blade
  // they keep a wide fan at the tip
  const fan = lerp(1, 2.3, e);
  for (let i = 0; i < G_FING.length; i++) {
    const [b, tp] = G_FING[i];
    const tu = lerp(-12 + (tp[0] + 12) * 0.25, tp[0], sp), ts = lerp(0.98, tp[1], sp);
    const B0 = M(b[0], b[1]);
    const T0 = M((tu + 12) * fan - 12 - uc * (fan - 1), ts);
    const flex = R.flap.sn * 3.5 * (0.4 + i * 0.12) * G.flex;
    const T1 = [T0[0], T0[1] - flex];
    const fp = strip(B0[0], B0[1], T1[0], T1[1], 4.2 * lerp(1, 0.85, e), 3.0);
    const g = ctx.createLinearGradient(B0[0], B0[1], T1[0], T1[1]);
    g.addColorStop(0, fg[0]); g.addColorStop(1, fg[1]);
    ctx.fillStyle = g; ctx.fill(fp);
    ctx.lineWidth = 1.15 * LW; ctx.strokeStyle = line; ctx.lineJoin = 'round'; ctx.stroke(fp);
    const rp = new Path2D(); rp.moveTo(B0[0], B0[1]); rp.quadraticCurveTo(lerp(B0[0], T1[0], 0.5) + 0.6, lerp(B0[1], T1[1], 0.5), lerp(B0[0], T1[0], 0.82), lerp(B0[1], T1[1], 0.82));
    strokeP(ctx, rp, rgba('#ffffff', 0.08 + under * 0.14), 0.7);
  }
  // membrane base: leading edge → finger bases → trailing edge
  const te = [];
  for (let k = 0; k <= 9; k++) { const s = 0.72 - k * (0.76 / 9); te.push([-31 + (s > 0.62 ? 5 : 0), s]); }
  const memPts = [[14, -0.04], [16, 0.14], [17, 0.3], [16, 0.45], [11, 0.6], [6, 0.71], [-3, 0.77], [-13, 0.78], [-21, 0.75], ...te, [-24, -0.08], [-6, -0.15]];
  const mem = bl(memPts.map(([u, s]) => M(u, s)), 0.9);
  {
    // base fill shades across the chord (leading edge darker → trailing edge lighter), so the gaps
    // between feathers never read as dark stripes
    const L0 = M(12, 0.42), L1 = M(-32, 0.4);
    const g = ctx.createLinearGradient(L0[0], L0[1], L1[0], L1[1]);
    g.addColorStop(0, dk(mix(GC.ftTop[0], '#7E7989', under))); g.addColorStop(1, dk(mix(GC.ftTop[1], '#C3BECB', under)));
    ctx.fillStyle = g; ctx.fill(mem);
  }
  ctx.lineWidth = 1.4 * LW; ctx.strokeStyle = line; ctx.lineJoin = 'round'; ctx.stroke(mem);
  // secondaries: individual overlapping feathers, fanned toward the body, each shading from the
  // covert band to a pale tip (silver underneath) with a rounded tip → a scalloped trailing edge.
  // In the blade they dissolve into the one smooth shape.
  const NS = 7;
  const fa = 1 - smoothstep(0.15, 0.7, e);
  if (fa > 0.01) {
    const shafts = new Path2D();
    const c3 = [mix(GC.ftTop[0], '#8A8595', under), mix('#433C4C', '#B9B4C3', under), mix(GC.ftTop[1], '#E2DEE8', under)].map(dk);
    ctx.save(); ctx.globalAlpha *= fa;
    for (let k = NS - 1; k >= 0; k--) {
      const f = k / (NS - 1);
      const s = 0.03 + f * 0.62;
      const tl = -31 - (k % 2) * 1.6 + (s > 0.6 ? 3 : 0) - 1.5 * Math.sin(f * Math.PI);
      const A0 = M(-4, s + 0.03), T0 = M(tl, s - 0.07 + f * 0.06);
      const wdt = 5.4 * dens;
      const fp = strip(A0[0], A0[1], T0[0], T0[1], wdt * 0.7, wdt * 1.1);
      const g = ctx.createLinearGradient(A0[0], A0[1], T0[0], T0[1]);
      g.addColorStop(0, c3[0]); g.addColorStop(0.6, c3[1]); g.addColorStop(1, c3[2]);
      ctx.fillStyle = g; ctx.fill(fp);
      ctx.lineWidth = 0.85 * LW; ctx.strokeStyle = rgba(line, lerp(0.75, 0.5, under)); ctx.stroke(fp);
      const m = lerp2(A0, T0, 0.5);
      shafts.moveTo(lerp(A0[0], T0[0], 0.15), lerp(A0[1], T0[1], 0.15));
      shafts.quadraticCurveTo(m[0] + cuy * 1.4, m[1] - cux * 1.4, lerp(A0[0], T0[0], 0.84), lerp(A0[1], T0[1], 0.84));
    }
    strokeP(ctx, shafts, under > 0.5 ? 'rgba(255,255,255,0.28)' : rgba('#8C8496', 0.3), 0.6);
    ctx.restore();
  }
  if (near && under > 0.05) {
    // under-wing coverts: a soft mid-tone shadow just below the charcoal band
    const r2 = [];
    for (let k = 0; k <= 8; k++) { const s = 0.66 - k * (0.72 / 8); r2.push(M(-9 + (k % 2 ? -3 : 0) + (s > 0.5 ? 4 : 0), s)); }
    const sh = new Path2D();
    sh.moveTo(r2[0][0], r2[0][1]);
    for (let i = 1; i < r2.length; i++) sh.lineTo(r2[i][0], r2[i][1]);
    ctx.save(); ctx.globalAlpha *= under * 0.35 * fa;
    strokeP(ctx, sh, '#3A3542', 3.2 * dens);
    ctx.restore();
  }
  // coverts band (charcoal leading edge) with scalloped feather tips
  const cvPts = [[14, -0.04], [16, 0.14], [17, 0.3], [16, 0.45], [11, 0.6], [6, 0.7]];
  const back = [];
  for (let k = 0; k <= 8; k++) {
    const s = 0.68 - k * (0.74 / 8);
    back.push([-8 + (k % 2 ? -3 : 0) + (s > 0.5 ? 4 : 0), s]);
  }
  const cov = bl([...cvPts, ...back, [-6, -0.1], [5, -0.12]].map(([u, s]) => M(u, s)), 0.9);
  paint(ctx, cov, near ? GC.wing : GC.wingFar, { rim: near ? 1.8 : 0, lw: 1.2 });
  if (near) R.wingTip = M(-8, 1.1);
}
function geraldSpreadWing(ctx, R, near, alpha) {
  const G = geraldWingGeom(R, near);
  const a = alpha * G.alpha;
  if (a <= 0.003) return G;
  ctx.save();
  ctx.globalAlpha *= a;
  geraldWingDraw(ctx, R, G);
  ctx.restore();
  return G;
}
// motion arcs behind a fast-moving near wing tip (blade / passing frames)
function geraldMotionArcs(ctx, R, o) {
  if (R.glide || R.fold > 0.5 || (R.pose === 'perch' && R.pose2 == null && !Number.isFinite(o.flapPhase))) return;
  const fp = R.flap.fp;
  const R0 = geraldRig({ ...o, flapPhase: fp - 0.05 });
  const G1 = geraldWingGeom(R, true), G0 = geraldWingGeom(R0, true);
  const tip = (G) => [G.S0[0] + G.Va[0] + G.Vh[0], G.S0[1] + G.Va[1] + G.Vh[1]];
  const T1 = tip(G1), T0 = tip(G0);
  const d = Math.hypot(T1[0] - T0[0], T1[1] - T0[1]);
  const k = smoothstep(22, 45, d) * (1 - R.fold * 2);
  if (k <= 0.02) return;
  const S = G1.S0;
  const a1 = Math.atan2(T1[1] - S[1], T1[0] - S[0]);
  let a0 = Math.atan2(T0[1] - S[1], T0[0] - S[0]);
  while (a0 - a1 > Math.PI) a0 -= TAU;
  while (a1 - a0 > Math.PI) a0 += TAU;
  const r1 = Math.hypot(T1[0] - S[0], T1[1] - S[1]);
  const p = new Path2D();
  for (const [rk, span] of [[1.04, 0.85], [0.9, 0.65], [0.76, 0.45]]) {
    const r = r1 * rk;
    const b0 = a1 + (a0 - a1) * 0.12, b1 = a1 + (a0 - a1) * span;
    p.moveTo(S[0] + Math.cos(b0) * r, S[1] + Math.sin(b0) * r);
    p.arc(S[0], S[1], r, b0, b1, b1 < b0);
  }
  strokeP(ctx, p, `rgba(255,255,255,${(0.62 * k).toFixed(3)})`, 1.9);
}

// ---- legs & feet (continuous: grip ↔ open ↔ tucked)
const G_TOE_GRIP = [[[0, -0.2], [7, 0.2], [12.5, 2.8]], [[0, 0.4], [5.5, 3], [9, 5.4]], [[-0.5, 0], [-6, 1.2], [-9.5, 3.2]]];
const G_TOE_GRIP_A = [0.6, 0.9, 2.5];
const G_TOE_TUCK = [[[0, 0], [2.2, 2.4], [2.6, 5]], [[0, 0], [0.8, 2.6], [0.6, 5.2]], [[0, 0], [-1.6, 1.8], [-2, 4]]];
const G_TOE_TUCK_A = [1.9, 2.0, 2.3];
function geraldToes(ctx, A, Lg, pitch, c, far) {
  const L = Lg.open, gr = Lg.grip || 0, cl = Lg.cling || 0;
  const OPEN = [[[0, 0], [7, -1 - 3 * L], [12, -6 * L]], [[0, 0], [7, 2], [12, 4 - 2 * L]], [[0, 0], [-5, 2], [-9, 1 - 3 * L]]];
  const OPEN_A = [0.1 - 0.6 * L, 0.6 - 0.4 * L, 2.7 + 0.4 * L];
  const tk = Lg.tuck;
  for (let i = 0; i < 3; i++) {
    const pts = [];
    for (let j = 0; j < 3; j++) {
      let q = lerp2(G_TOE_GRIP[i][j], OPEN[i][j], clamp(L * 1.4));
      if (gr > 0 && j > 0) { q = [q[0] * (1 - 0.1 * gr), q[1] + gr * (j === 2 ? 2.2 : 1)]; }
      if (cl > 0) q = lerp2(q, rot2(q[0], q[1], -1.45), cl);
      if (tk > 0) q = lerp2(q, rot2(G_TOE_TUCK[i][j][0], G_TOE_TUCK[i][j][1], pitch), tk);
      pts.push([A[0] + q[0], A[1] + q[1]]);
    }
    let ang = lerp(G_TOE_GRIP_A[i], OPEN_A[i], clamp(L * 1.4)) + gr * (i === 2 ? -0.5 : 0.5) - cl * 1.45;
    if (tk > 0) ang = lerp(ang, G_TOE_TUCK_A[i] + pitch, tk);
    limb(ctx, pts, lerp(3.8, 3.2, tk), c.base, c.line, 1.1);
    talon(ctx, pts[2][0] + (i === 2 ? -0.6 : 0.6) * (1 - L), pts[2][1], ang, 0.95 * (1 - 0.25 * tk) * (1 + 0.3 * gr));
    if (!far && L < 0.3 && tk < 0.3) {
      const kn = new Path2D();
      for (const k of [0.45, 0.8]) {
        const P = k < 0.5 ? lerp2(pts[0], pts[1], k * 2) : lerp2(pts[1], pts[2], (k - 0.5) * 2);
        const d = k < 0.5 ? [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]] : [pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]];
        const l = Math.hypot(d[0], d[1]) || 1, nx = (-d[1] / l) * 1.7, ny = (d[0] / l) * 1.7;
        kn.moveTo(P[0] + nx, P[1] + ny); kn.lineTo(P[0] - nx, P[1] - ny);
      }
      strokeP(ctx, kn, rgba('#6A5753', 0.55 * (1 - L / 0.3)), 0.7);
    }
  }
}
function geraldLeg(ctx, R, far) {
  const c = far ? GC.legFar : GC.leg;
  const H = R.KP.H;
  const hip = R.B(H[0] + (far ? -4 : 0), H[1]);
  const ank = far ? R.fA : R.nA;
  const dx = ank[0] - hip[0], dy = ank[1] - hip[1], d = Math.hypot(dx, dy) || 1;
  const knee = [(hip[0] + ank[0]) / 2 + (dy / d) * R.knee, (hip[1] + ank[1]) / 2 - (dx / d) * R.knee];
  limb(ctx, [hip, knee, ank], R.legW, c.base, c.line, 1.3);
  geraldToes(ctx, ank, { open: clamp(R.open), tuck: clamp(R.tuck), grip: R.grip, cling: R.cling }, R.pitch, c, far);
}
function talon(ctx, x, y, a, s = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s);
  const p = new Path2D();
  p.moveTo(-1.7, -1.3); p.quadraticCurveTo(2.9, -1.7, 4.3, 3.6); p.quadraticCurveTo(2.2, 0.9, -1.5, 1.5); p.closePath();
  ctx.fillStyle = GC.talon; ctx.fill(p);
  ctx.restore();
}

// tail: 3 strips at rest; fanned into 6 braking feathers in the landing flare (R.fan)
function geraldTail(ctx, R) {
  const k = R.shapeK, fan = R.fan;
  const base = lerp2(G_TAILB_P, G_TAILB_F, k);
  const a0 = lerp(G_TAIL_ANG_P, G_TAIL_ANG_F, k) - 0.55 * R.cling;
  const n = fan > 0.02 ? 6 : 3;
  // tail tips stay above the perch line while standing / reaching for it (world y ≤ floor)
  const fw = R.floorW > 0 ? R.floorW : (R.pose === 'land' || R.pose2 === 'land' ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const f = n === 3 ? i - 1 : (i - 2.5) / 2.5;
    const spread = n === 3 ? 0.11 : lerp(0.11 * 1.2, 0.3, fan);
    const a = a0 - f * spread - fan * 0.12;
    const len = lerp(27, 31, k) * (1 - 0.05 * Math.abs(f)) * (n === 3 ? 1 : lerp(1, 1.08, fan));
    const bx = base[0] + f * 3.5 * (n === 3 ? 1 : 0.7), by = base[1] + f * 1.5;
    let [x0, y0] = [bx, by], [x1, y1] = [bx + Math.cos(a) * len, by + Math.sin(a) * len];
    // into the drawing frame (inBody already applies bs / pitch / bx / by)
    if (fw > 0) {
      const W1 = R.B(x1, y1);
      const yy = softFloor(W1[1], -3, 6);
      if (yy < W1[1] - 0.01) {
        const tgt = [W1[0], lerp(W1[1], yy, fw)];
        const inv = rot2(tgt[0] - R.bx, tgt[1] - R.by, -R.pitch);
        x1 = inv[0] / R.bs; y1 = inv[1] / R.bs;
      }
    }
    paint(ctx, strip(x0, y0, x1, y1, n === 3 ? 4.6 : 4.2, n === 3 ? 3.8 : 4.2), GC.dark, { lg: [x0, y0, x1, y1], lw: 1.3 });
  }
}

function geraldBody(ctx, R, ruffle) {
  const k = R.shapeK, sl = R.slim;
  const pf = 1 + 0.035 * R.F.puff * R.perchW;
  const pts = G_MORPH_P.map((p, i) => {
    const f = G_MORPH_F[i];
    let x = lerp(p[0], f[0], k), y = lerp(p[1], f[1], k);
    x = -2 + (x + 2) * sl;
    if (x > 0) x *= pf; // chest out
    if (ruffle > 0) {
      const j = noise1(R.t * 22 + i * 3.1) * ruffle * 1.4;
      x += x * 0.05 * ruffle + j; y += y * 0.04 * ruffle + j * 0.6;
    }
    return [x, y];
  });
  const body = bl(pts, 1);
  const g0 = [-24, -42, 16, 40], g1 = [...upF([0, -70]), ...upF([0, -36])];
  paint(ctx, body, GC.body, { lg: g0.map((v, i) => lerp(v, g1[i], k)), rim: 2.5, sh: 3.2, lw: 1.7 });
  // waistcoat chest: soft lighter breast + feather scallops
  ctx.save(); ctx.clip(body);
  const [cx, cy] = lerp2(G_VEST[0], G_VEST[1], k);
  const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, 24);
  g.addColorStop(0, GC.vest); g.addColorStop(1, 'rgba(120,104,128,0)');
  ctx.fillStyle = g; ctx.fillRect(cx - 30, cy - 30, 60, 60);
  const ch = new Path2D();
  for (let r = 0; r < 4; r++) {
    const P = G_ROWS_P[r], Q = G_ROWS_F[r];
    const q = P.map((v, i) => lerp(v, Q[i], k));
    scallopRow(linePts([q[0] * pf, q[1]], [q[2] * pf, q[3]], 3), q[4], q[5], ch);
  }
  const sh = lOff(0, 1.1);
  ctx.save(); ctx.translate(sh[0], sh[1]); strokeP(ctx, ch, rgba(GC.edge, 0.45), 1.2); ctx.restore();
  strokeP(ctx, ch, 'rgba(10,8,14,0.45)', 1);
  ctx.restore();
  // feathered thigh
  const [tx, ty] = lerp2(G_THIGH[0], G_THIGH[1], k);
  const th = scallop(tx, ty, 10.5 * (1 - 0.2 * k), 6.5, lerp(0.15, 0.15 - G_TF * 0.6, k), 9, 1.7, 4);
  paint(ctx, th, GC.body, { lg: [tx, ty - 7.5, tx, ty + 6.5], rim: 1.2, lw: 1.3 });
  if (ruffle > 0.2) {
    const tf = new Path2D();
    const tufts = [[-26, -28, -2.3], [-34, -6, -2.9], [33, 6, -0.2], [-14, -38, -1.9], [-33, 16, -3.0]];
    for (const [x0, y0, a0] of tufts) {
      const x = x0 * sl, y = y0, a = a0;
      const j = noise1(R.t * 18 + x0) * 0.25;
      leaf(x, y, x + Math.cos(a + j) * 9 * ruffle, y + Math.sin(a + j) * 9 * ruffle, 1.6, tf);
    }
    ctx.fillStyle = GC.body.base; ctx.fill(tf);
    ctx.lineWidth = 1.1; ctx.strokeStyle = GC.body.line; ctx.stroke(tf);
  }
}

function drawVulture(ctx, o = {}) {
  const R = geraldRig(o);
  const s = o.scale == null ? 1 : o.scale;
  const ruffle = clamp(o.ruffle != null ? o.ruffle : R.F.ruffle + 0.35 * R.settle + 0.25 * R.preen * (1 - R.preen));
  ctx.save();
  ctx.translate(o.x || 0, o.y || 0);
  if (o.rot) ctx.rotate(o.rot);           // rot = WORLD rotation (same for both facings)
  ctx.scale(o.flip ? -s : s, s);
  LX = o.flip ? 1 : -1; LW = 1.4; LROT = 0;
  const fold = R.fold;
  // end of the tuck: the folded-wing art fades in OVER the (opaque) spread wing, then whatever
  // of the spread wing still pokes out fades away — no see-through ghosting
  const artA = smoothstep(0.8, 0.9, fold), sprA = 1 - smoothstep(0.9, 0.97, fold);
  const farA = 1 - smoothstep(0.66, 0.8, fold); // it has shrunk behind the body by then
  const inBody = (fn) => {
    ctx.save(); ctx.translate(R.bx, R.by); ctx.rotate(R.pitch); ctx.scale(R.bs, R.bs); LROT = R.pitch;
    fn();
    LROT = 0; ctx.restore();
  };
  // ---------- far side
  if (farA > 0) geraldSpreadWing(ctx, R, false, farA);
  inBody(() => {
    if (artA > 0) {
      ctx.save(); ctx.globalAlpha *= artA; ctx.translate(-G_C[0], -G_C[1]);
      for (const [x0, y0, x1, y1] of [[-33, -30, -41, 8], [-30, -26, -35, 10.5]]) {
        paint(ctx, leaf(x0, y0, x1, y1, 3.6, undefined, 0.4), GC.wingFar, { lw: 1.2 });
      }
      ctx.restore();
    }
  });
  inBody(() => geraldTail(ctx, R));
  geraldLeg(ctx, R, true);
  // ---------- body
  inBody(() => geraldBody(ctx, R, ruffle));
  geraldLeg(ctx, R, false);
  const preenBack = R.preen > 0.5; // the head works in front of the folded wing
  if (sprA > 0) { geraldMotionArcs(ctx, R, o); geraldSpreadWing(ctx, R, true, sprA); }
  if (artA > 0) inBody(() => { ctx.globalAlpha *= artA; ctx.translate(-G_C[0], -G_C[1]); geraldFoldedWing(ctx, R); });
  // ---------- neck, ruff, head
  const nb = R.neckBase;
  const hn = gHead(R, -6, 5);
  const mid = [lerp(nb[0], hn[0], 0.5), lerp(nb[1], hn[1], 0.5) + 1 - 10 * R.preen];
  limb(ctx, [[nb[0] - 2, nb[1] + 2], mid, hn], 12, GC.head.base, GC.head.line, 1.3);
  inBody(() => geraldRuff(ctx, R, ruffle));
  geraldHead(ctx, R);
  if (preenBack && artA > 0) {
    // a few covert tips fall over the beak: it is buried in the feathers
    const k = smoothstep(0.6, 0.9, R.preen) * artA;
    const bt = gHead(R, 24, 3);
    const tf = new Path2D();
    for (let i = 0; i < 4; i++) {
      const x = bt[0] - 7 + i * 4.5, y = bt[1] - 5 + (i % 2) * 2.5;
      const a = 1.9 + noise1(R.t * 10 + i * 2.1) * 0.25;
      leaf(x, y, x + Math.cos(a) * 11, y + Math.sin(a) * 11, 2.8, tf);
    }
    ctx.save(); ctx.globalAlpha *= k;
    ctx.fillStyle = GC.wing.hi; ctx.fill(tf); ctx.lineWidth = 1.1; ctx.strokeStyle = GC.wing.line; ctx.stroke(tf);
    ctx.restore();
  }
  ctx.restore();
}

// local (character) point → world, matching drawVulture/drawTortoise/... transform order:
// translate(x, y) · rotate(rot) · scale(flip ? -s : s, s)
function worldPt(o, x, y) {
  const s = o.scale == null ? 1 : o.scale;
  const lx = x * s * (o.flip ? -1 : 1), ly = y * s;
  const [rx, ry] = o.rot ? rot2(lx, ly, o.rot) : [lx, ly];
  return { x: (o.x || 0) + rx, y: (o.y || 0) + ry };
}
// Anchors in world coords: beak tip, head (top of skull), eye, feet (origin), body centre, wingTip.
function vultureAnchors(o = {}) {
  const R = geraldRig(o);
  const W = ([x, y]) => worldPt(o, x, y);
  let tip = null;
  if (R.fold < 1) { const G = geraldWingGeom(R, true); tip = [G.S0[0] + G.Va[0] + G.Vh[0] * 1.15, G.S0[1] + G.Va[1] + G.Vh[1] * 1.15]; }
  return {
    beak: W(gHead(R, 31, 3)),
    head: W(gHead(R, 0, -19)),
    headCenter: W(gHead(R, 0, -2)),
    eye: W(gHead(R, 4.5, -5.5)),
    feet: W([0, 0]),
    body: W(R.B(0, -4)),
    wingTip: tip ? W(tip) : null,
  };
}

// ---- choreography helpers: one number per beat → a complete option set (spread over your own
// base options: drawVulture(ctx, geraldLanding(p, { x, y, scale, flip, t, mood }))).
const smooth01 = (a, b, x) => smoothstep(a, b, x);
function qBez(P0, P1, P2, k) {
  const m = 1 - k;
  return [m * m * P0[0] + 2 * m * k * P1[0] + k * k * P2[0], m * m * P0[1] + 2 * m * k * P1[1] + k * k * P2[1]];
}
// LANDING: glides in from o.from (offset in scale-1 units, relative to his facing; default from
// behind and above), flares (body pitches back, head forward, tail fanned, braking flaps that end
// with the wings UP), hovers with the feet tucked ~18 units above the perch, throws the feet
// forward and reaches for it in the last 0.25 s, touches down on (o.x, o.y), absorbs, folds the
// wings (joints first, then lowered) and settles. p 0..1 over o.dur seconds (default 1.6).
function geraldLanding(p, o = {}) {
  const dur = o.dur || 1.6;
  const T = clamp(p) * dur;
  const from = o.from || { dx: -240, dy: -170 };
  const tTouch = dur - 0.42;
  const tF0 = tTouch - 0.62, tF1 = tTouch - 0.18;
  const tFold0 = tTouch + 0.06, tFold1 = tTouch + 0.36;
  const tReach = tTouch - 0.25, tDrop = tTouch - 0.16;
  const s = o.scale == null ? 1 : o.scale, fx = o.flip ? -1 : 1;
  // feet path: glides down from behind/above and flattens out a little above the perch (hover),
  // then drops onto it
  // approach a little higher (the level-flight downstroke must clear the perch), sink to an
  // 18-unit hover as the flare pitches him up, then the drop
  const flareK = smooth01(tF0, tF1, T);
  const hov = lerp(52, 18, flareK);
  const k = ease.outCubic(clamp(T / tDrop));
  const dx = from.dx * (1 - k);
  const drop = ease.inQuad(clamp((T - tDrop) / (tTouch - tDrop)));
  const dy = (from.dy + 52) * Math.pow(1 - k, 1.7) - hov * (1 - drop);
  // flap phase: glide (wings held, phase 0.3) → braking flaps → wings UP (phase 2.0) at touch-down
  const rate = 2.7, D = (2.0 - 0.3) / rate, tFl0 = tTouch - D - 0.06;
  let flapPhase;
  if (T <= tFl0) flapPhase = 0.3;
  else if (T < tTouch) { const z = clamp((T - tFl0) / (tTouch - tFl0)); flapPhase = 0.3 + 1.7 * (z * z * (3 - 2 * z) * 0.35 + z * 0.65); }
  else flapPhase = 2.0;
  const flare = smooth01(tF0, tF1, T);
  const settle = smooth01(tTouch, tFold1, T);
  let legs;
  if (T < tTouch) legs = lerp(0.12, 1, ease.outCubic(clamp((T - tReach) / 0.2)));
  else { const a = T - tTouch; legs = a < 0.1 ? lerp(1, -0.18, ease.outQuad(a / 0.1)) : lerp(-0.18, 0, ease.inOutSine(clamp((a - 0.1) / 0.25))); }
  const fold = ease.inOutSine(smooth01(tFold0, tFold1, T));
  const ruffle = 0.35 * Math.sin(Math.PI * smooth01(tFold1 - 0.08, dur, T)) + (o.ruffle || 0);
  const base = T < tTouch
    ? { pose: 'fly', pose2: 'land', poseMix: flare }
    : { pose: 'land', pose2: 'perch', poseMix: settle };
  return {
    ...o, ...base, flapPhase, legs, fold, ruffle: clamp(ruffle), wing: 1,
    x: (o.x || 0) + dx * s * fx, y: (o.y || 0) + dy * s,
  };
}
// TAKEOFF: from the perch at (o.x, o.y): the folded wings RAISE, then open upward + crouch
// (anticipation); he springs on the first downstroke (~0.42 s) with a quick up-and-forward pop
// (body pitched forward), then climbs away, accelerating, toward o.to (offset, scale-1 units;
// default forward and up, far off-screen). p 0..1 over o.dur seconds (default 1.5).
function geraldTakeoff(p, o = {}) {
  const dur = o.dur || 1.5;
  const T = clamp(p) * dur;
  const to = o.to || { dx: 520, dy: -380 };
  const s = o.scale == null ? 1 : o.scale, fx = o.flip ? -1 : 1;
  const tUnf = 0.3, tLeap = 0.42, tPop = 0.15, tFly0 = 0.5, tFly1 = 0.95;
  const fold = 1 - ease.inOutSine(smooth01(0.02, tUnf, T));
  // wings rise to the top of the stroke while they open, the leap rides the first downstroke
  const rate = 2.6, tFl = tLeap - 0.1;
  const flapPhase = T < tFl ? 0 : rate * (T - tFl);
  let legs;
  if (T < tFl) legs = lerp(0, -0.25, ease.inOutSine(clamp(T / tFl)));
  else legs = lerp(-0.25, 1, ease.outCubic(clamp((T - tFl) / 0.14)));
  // pop: up and a little forward (outQuad), then the accelerating climb
  const u = T - tLeap;
  let dx = 0, dy = 0;
  if (u > -0.06) {
    const kp = ease.outQuad(clamp((u + 0.06) / (tPop + 0.06)));
    const pop = [Math.abs(to.dx) * 0.06 * Math.sign(to.dx || 1), -38];
    const kc = ease.inQuad(clamp((u - tPop * 0.5) / (dur - tLeap - tPop * 0.5)));
    const [cx, cy] = qBez([0, 0], [to.dx * 0.15, to.dy * 0.6], [to.dx - pop[0], to.dy - pop[1]], kc);
    dx = pop[0] * kp + cx; dy = pop[1] * kp + cy;
  }
  const climb = smooth01(tFly0, tFly1, T);
  const base = T < tFl
    ? { pose: 'perch', pose2: 'takeoff', poseMix: smooth01(0, tFl, T) }
    : { pose: 'takeoff', pose2: 'fly', poseMix: climb };
  return {
    ...o, ...base, flapPhase, legs, fold, wing: 1, crouch: clamp(-legs * 3),
    x: (o.x || 0) + dx * s * fx, y: (o.y || 0) + dy * s,
  };
}
// HOP between two perches (e.g. Barry's head → the raft, the sign → Barry's head): crouch, spring,
// arc over, absorb, fold. Short hops keep the wings half open; longer ones (> ~60 units at scale 1)
// open them fully and give one real downstroke. o.to = {x, y} WORLD target perch point.
// p 0..1 over o.dur seconds (default 0.9).
function geraldHop(p, o = {}) {
  const dur = o.dur || 0.9;
  const T = clamp(p) * dur;
  const A = [o.x || 0, o.y || 0], B = o.to ? [o.to.x, o.to.y] : [A[0] + 60, A[1]];
  const s = o.scale == null ? 1 : o.scale;
  const dist = Math.hypot(B[0] - A[0], B[1] - A[1]) / Math.max(0.05, s);
  const big = smooth01(40, 90, dist);
  const t0 = 0.16, t1 = dur - 0.22; // in the air between t0 and t1
  const air = clamp((T - t0) / (t1 - t0));
  const k = ease.inOutSine(air);      // one ease on the travel (no double easing)
  const h = (24 + dist * 0.16) * s;
  const x = lerp(A[0], B[0], k), y = lerp(A[1], B[1], k) - h * Math.sin(Math.PI * air);
  let legs;
  if (T < t0) legs = lerp(0, -0.22, ease.inOutSine(T / t0));
  else if (T < t1) legs = lerp(-0.22, 0.7, ease.outCubic(clamp((T - t0) / 0.12)));
  else { const a = T - t1; legs = a < 0.08 ? lerp(0.7, -0.15, ease.outQuad(a / 0.08)) : lerp(-0.15, 0, ease.inOutSine(clamp((a - 0.08) / 0.2))); }
  const openEnv = Math.sin(Math.PI * smooth01(t0 - 0.1, t1 + 0.14, T));
  const open = openEnv * lerp(0.6, 1, big);
  const fold = 1 - open;
  // big hops: wings rise as they open (phase 0), one downstroke through the arc, then held up
  // for the landing; small hops: wings held half-raised
  const flapPhase = lerp(0.12, 0, big) + big * lerp(0, 1, ease.inOutSine(smooth01(t0, t1 - 0.04, T)));
  const out = {
    ...o, pose: 'land', pose2: 'perch', poseMix: 1 - open, flapPhase, legs, fold, wing: lerp(0.55, 1, big),
    crouch: clamp(-legs * 3), x, y,
  };
  delete out.to;
  return out;
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
// up: upper-lid closure · lo: lower lid raise · mouth: corner (+ smile / − frown) · brow: fold
// (+ front end down / − front end up) · crinkle: closed smiling eyes + crow's feet · smirk: one-sided
// cheek crease · flat: straight lid edges · tilt: head pitch (− = chin up) · gape: jaw hangs open ·
// pupil: scale · droop / back: slump / recoil. All numeric → moods blend (see moodWeights).
const SFACE_DEF = { up: 0.36, lo: 0.08, mouth: 0, brow: 0, crinkle: 0, smirk: 0, flat: 0, tilt: 0, gape: 0, pupil: 1, droop: 0, back: 0, look: { x: 0.45, y: 0.15 } };
const SFACE = {
  neutral: { up: 0.36, lo: 0.08, mouth: 0, brow: 0, look: { x: 0.45, y: 0.15 } },
  chill: { up: 0.52, lo: 0.16, mouth: 0.5, brow: -0.1, tilt: -0.04, look: { x: 0.35, y: 0.2 } },
  happy: { up: 0.4, lo: 0.3, mouth: 1, brow: -0.3, crinkle: 1, tilt: -0.12, look: { x: 0.4, y: 0 } },
  smug: { up: 0.47, lo: 0.2, mouth: 0.55, brow: 0.45, smirk: 1, tilt: -0.1, look: { x: 1, y: 0.25 } },
  sad: { up: 0.54, lo: 0.06, mouth: -0.9, brow: -0.7, droop: 1, look: { x: 0.3, y: 0.85 } },
  worried: { up: 0.16, lo: 0.04, mouth: -0.6, brow: -0.8, pupil: 0.78, look: { x: 0.6, y: 0 } },
  deadpan: { up: 0.54, lo: 0.26, mouth: 0, brow: 0.12, flat: 1, look: { x: 0.75, y: 0.1 } },
  sleepy: { up: 0.84, lo: 0.2, mouth: -0.1, brow: 0, droop: 0.6, look: { x: 0.3, y: 0.6 } },
  shock: { up: 0.05, lo: 0, mouth: -0.4, brow: -0.85, back: 1, gape: 0.35, pupil: 0.6, look: { x: 0.2, y: 0 } },
  panic: { up: 0.03, lo: 0, mouth: -0.7, brow: -0.95, back: 1, gape: 0.55, pupil: 0.52, look: { x: 0.2, y: 0 } },
};
// tube with per-point widths
function tubeW(pts, ws, p = new Path2D()) {
  const n = pts.length, Lp = [], Rp = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d, w = ws[i] / 2;
    Lp.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
    Rp.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
  }
  cv(Lp, 1, p);
  cv(Rp.reverse(), 1, p, false);
  p.closePath();
  return p;
}
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

// neck curve (from inside the shell opening): resting S-curve forward, and the craned "turn" pose
const S_NECK = [[0, 0], [3, -22], [11, -40], [23, -51]];
const S_NECK_TURN = [[0, 0], [1, -25], [2, -50], [5, -72]];
function shelleyRig(o) {
  const t = o.t || 0;
  const F = resolveFace(SFACE, SFACE_DEF, o, 'neutral', 's:');
  const talk = clamp(o.talk || 0);
  const breath = Math.sin(t * 0.9);
  // turn 0..1: cranes the long neck up toward something above (the office window) — the neck
  // straightens and lengthens, the head pitches up; the eye leads (it gets there first)
  const turn = clamp(o.turn || 0), tk = ease.inOutSine(turn);
  const lean = (clamp(o.neck || 0, -1, 1) + 0.12 * F.droop - 0.12 * F.back) * (1 - tk);
  let look = o.look || F.look;
  const ek = smoothstep(0, 0.3, turn);
  if (ek > 0) look = { x: lerp(look.x || 0, lerp(0.35, 0.9, tk), ek), y: lerp(look.y || 0, lerp(-1, -0.25, tk), ek) };
  const R = { t, mood: F.name, F, talk: clamp(talk + F.gape), breath, lean, look, turn };
  const len = (1 - 0.14 * F.back) * (o.neckLen == null ? 1 : o.neckLen);
  const sway = (0.03 * Math.sin(t * 0.45) + 0.02 * noise1(t * 0.3 + 7)) * (1 - 0.6 * tk);
  const base = [6, -116 + breath * 0.6];
  R.neck = S_NECK.map(([x0, y0], i) => {
    const k = i / (S_NECK.length - 1);
    const x = lerp(x0, S_NECK_TURN[i][0], tk), y = lerp(y0, S_NECK_TURN[i][1], tk);
    const [rx, ry] = rot2(x * len, y * len, (lean * 0.9 + sway) * k);
    return [base[0] + rx, base[1] + ry];
  });
  const top = R.neck[R.neck.length - 1];
  const hr0 = lean * 0.55 + sway * 0.6 - talk * 0.04 + 0.07 * F.droop - 0.08 * F.back + F.tilt;
  R.hr = lerp(hr0, -1.12, tk);
  R.hs = 1.42;
  const [ox, oy] = rot2(10, -6, R.hr);
  R.hx = top[0] + lerp(ox, 2, tk);
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
    const g = ctx.createRadialGradient(hx + 5 * LX, hy - 7, 2, hx, hy, Math.max(rx, ry) * 1.2);
    g.addColorStop(0, SC.scute.hi); g.addColorStop(0.6, SC.scute.base); g.addColorStop(1, SC.scute.lo);
    ctx.fillStyle = g; ctx.fill(hp);
    ctx.lineWidth = 2.2; ctx.strokeStyle = SC.groove; ctx.lineJoin = 'round'; ctx.stroke(hp);
    for (const k of [0.68, 0.38]) {
      const rp = bl(pts.map(([x, y]) => [hx + (x - hx) * k, hy + (y - hy) * k]), 0.45);
      strokeP(ctx, rp, SC.ring, 1);
    }
  }
  // soft gloss on the dome (polished old shell)
  const glx = -30 + 8 * LX;
  const gl = ctx.createRadialGradient(glx, -124, 2, glx, -124, 40);
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
  if (!far) {
    // soft contact shadow where the thigh tucks under the plastron
    ctx.fillStyle = 'rgba(70,58,24,0.28)';
    ctx.beginPath(); ctx.ellipse(6, -21, 15, 5, -0.08, 0, TAU); ctx.fill();
  }
  // thick elephantine thigh with a rounded hip (no cut end)
  const p = bl([[-9, -12.5], [-6, -21.5], [4, -24.5], [18, -23.5], [29, -21.5], [33, -12], [29, -2.5], [16, -1], [2, -0.8], [-6, -3.5]].map(([x, y]) => [x + o[0], y + o[1]]), 1);
  paint(ctx, p, c, { lg: [0, o[1] - 25, 0, o[1]], lw: 1.6, rim: far ? 0 : 1.4, sh: far ? 0 : 1.8 });
  if (!far) {
    const kc = new Path2D();
    kc.moveTo(22, -21); kc.quadraticCurveTo(25, -15, 22.5, -8);
    kc.moveTo(-2, -20.5); kc.quadraticCurveTo(-5.5, -13, -2.5, -5);
    strokeP(ctx, kc, SC.wrinkle, 1.1);
  }
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
  const lrot = LROT; LROT = R.hr;
  // lower jaw (opens slowly). The mouth cavity is built from the real edges (skull underside /
  // beak above, the rotated jaw's top edge below) so it never pokes outside the head.
  const jaw = talk * 0.28;
  const LOj = (x, y) => { const [rx, ry] = rot2(x + 4, y - 8, jaw); return [-4 + rx, 8 + ry]; };
  if (talk > 0.02) {
    const m = new Path2D();
    cv([[-6, 10.5], [4, 10.3], [12, 9.7], [18.5, 9.4], [25.2, 9.4]], 1, m);
    cv([[23.6, 8.7], [16, 8.9], [8, 8.8], [-2, 8.2], [-7, 7.8]].map((q) => LOj(q[0], q[1])), 1, m, false);
    m.closePath();
    ctx.fillStyle = '#4C2C2C'; ctx.fill(m);
    ctx.save(); ctx.clip(m);
    const [tx, ty] = LOj(9, 8.2);
    ctx.fillStyle = '#B86A6A'; ctx.beginPath(); ctx.ellipse(tx, ty, 8, 2.4, jaw * 0.8, 0, TAU); ctx.fill();
    ctx.restore();
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
  // mouth line: long, gentle; the corner lifts into a soft laugh line (smile) or sags (frown)
  const sm = F.mouth;
  const ml = new Path2D();
  const mcx = -5.5, mcy = 7.6 - sm * 5.2;
  ml.moveTo(17.5, 9.4); ml.bezierCurveTo(10, 10.2 + Math.max(0, sm) * 1.6 + Math.min(0, sm) * -0.4, 0, 10.4 - sm * 0.2, mcx, mcy);
  strokeP(ctx, ml, '#3F4834', 1.7);
  if (sm > 0.15) {
    const k = smoothstep(0.15, 0.85, sm);
    const sl = new Path2D(); sl.moveTo(mcx + 1.4, mcy + 0.3); sl.quadraticCurveTo(mcx - 2.2, mcy - 1.2, mcx - 3.4, mcy - 5.4 * k);
    strokeP(ctx, sl, rgba('#3F4834', 0.6 * k), 1.25);
    ctx.fillStyle = rgba('#C9D3B4', 0.34 * k);
    ctx.beginPath(); ctx.ellipse(mcx + 5.5, mcy - 2.6, 5.2, 2.8, -0.25, 0, TAU); ctx.fill();
  } else if (sm < -0.3) {
    const dn = new Path2D(); dn.moveTo(mcx + 0.5, mcy); dn.quadraticCurveTo(mcx - 1.6, mcy + 0.6, mcx - 2.4, mcy + 2.6 * -sm);
    strokeP(ctx, dn, rgba('#3F4834', smoothstep(0.3, 0.55, -sm)), 1.3);
  }
  if (F.smirk > 0.02) {
    const sk2 = new Path2D(); sk2.moveTo(mcx - 1, mcy - 4.6); sk2.quadraticCurveTo(mcx - 3.4, mcy - 2, mcx - 3, mcy + 1.2);
    strokeP(ctx, sk2, rgba('#3F4834', 0.5 * F.smirk), 1);
  }
  ctx.fillStyle = '#3B4231';
  ctx.beginPath(); ctx.ellipse(25.2, -2.6, 1, 0.75, 0.3, 0, TAU); ctx.fill();
  // wrinkles
  const wr = new Path2D();
  cv([[-12.5, -7], [-11, -0.5], [-12.5, 6]], 1, wr);
  cv([[-7.5, 3], [-4.5, 6]], 1, wr);
  cv([[14.5, -11], [18, -8.5]], 1, wr);
  cv([[13, -6.5], [15.5, -4.5]], 1, wr);
  strokeP(ctx, wr, SC.wrinkle, 1);
  // eye: big, heavy upper lid + lower lid (very slow blinks); happiness closes it into a smiling arc
  const ex = 4.5, ey = -7, erx = 6, ery = 6.4;
  const bk = blinkAmt(t, 6.5, 1.5, 0.61);
  const hw = F.crinkle;
  const up = clamp(lerp(clamp(F.up + (1 - F.up) * bk * 1.15), 1, smoothstep(0.3, 0.85, hw))), lo = F.lo + 0.2 * hw;
  // socket shadow
  ctx.fillStyle = 'rgba(70,82,56,0.28)';
  ctx.beginPath(); ctx.ellipse(ex, ey, erx + 2.6, ery + 2.4, 0, 0, TAU); ctx.fill();
  const openA = 1 - smoothstep(0.82, 1, hw);
  if (openA > 0.003) {
    ctx.save(); ctx.globalAlpha *= openA;
    const eye = el(ex, ey, erx, ery);
    ctx.fillStyle = '#FBF5E4'; ctx.fill(eye);
    ctx.save(); ctx.clip(eye);
    const lk = R.look;
    const pk = F.pupil;
    const px = ex + 1 + clamp(lk.x || 0, -1, 1) * (2.4 + (1 - pk) * 1.5), py = ey + 1.6 + clamp(lk.y || 0, -1, 1) * 2.2;
    ctx.fillStyle = '#5A4522'; ctx.beginPath(); ctx.arc(px, py, 3.7 * pk, 0, TAU); ctx.fill();
    ctx.fillStyle = '#17120A'; ctx.beginPath(); ctx.arc(px, py, 2.2 * pk, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.beginPath(); ctx.arc(px - 1.2 * pk, py - 1.3 * pk, Math.max(0.6, pk), 0, TAU); ctx.fill();
    const ly = ey - ery + up * ery * 2;
    const bow = lerp(2.6, 0.3, F.flat);
    const ul = new Path2D();
    ul.moveTo(ex - erx - 2, ey - ery - 3); ul.lineTo(ex + erx + 2, ey - ery - 3); ul.lineTo(ex + erx + 2, ly - 1.2); ul.quadraticCurveTo(ex, ly + bow, ex - erx - 2, ly - 0.2); ul.closePath();
    const lg = ctx.createLinearGradient(0, ey - ery, 0, ly + 2);
    lg.addColorStop(0, '#A7B091'); lg.addColorStop(1, '#8A9476');
    ctx.fillStyle = lg; ctx.fill(ul);
    const ll = ey + ery - lo * ery * 2;
    const lbow = lerp(lerp(-1.8, -0.2, F.flat), -3.6, hw);
    const lp = new Path2D();
    lp.moveTo(ex - erx - 2, ey + ery + 3); lp.lineTo(ex + erx + 2, ey + ery + 3); lp.lineTo(ex + erx + 2, ll + 0.6); lp.quadraticCurveTo(ex, ll + lbow, ex - erx - 2, ll + 0.2); lp.closePath();
    ctx.fillStyle = '#939D7F'; ctx.fill(lp);
    ctx.restore();
    const le = new Path2D(); le.moveTo(ex - erx - 1, ly - 0.2); le.quadraticCurveTo(ex, ly + bow, ex + erx + 1, ly - 1.2);
    strokeP(ctx, le, '#363E2C', 1.8);
    const le2 = new Path2D(); le2.moveTo(ex - erx, ll + 0.2); le2.quadraticCurveTo(ex, ll + lbow, ex + erx, ll + 0.6);
    const lk2 = Math.max(F.flat, hw);
    strokeP(ctx, le2, `rgba(56,64,46,${lerp(0.6, 0.9, lk2).toFixed(3)})`, lerp(1, 1.4, lk2));
    ctx.lineWidth = 1.1; ctx.strokeStyle = '#4C5541'; ctx.stroke(eye);
    ctx.restore();
  }
  if (hw > 0.35) {
    // closed, upturned smiling eye + a lifted cheek line under it
    ctx.save(); ctx.globalAlpha *= smoothstep(0.35, 0.8, hw);
    const ha = new Path2D(); ha.moveTo(ex - erx + 0.2, ey + 1.6); ha.quadraticCurveTo(ex + 0.3, ey - 6.4, ex + erx - 0.2, ey + 1.4);
    strokeP(ctx, ha, '#363E2C', 2.1);
    const ck = new Path2D(); ck.moveTo(ex - erx + 1.5, ey + 4.6); ck.quadraticCurveTo(ex + 0.5, ey + 2.4, ex + erx - 1, ey + 4.4);
    strokeP(ctx, ck, 'rgba(60,70,50,0.5)', 1.1);
    ctx.restore();
  }
  // brow: a fleshy fold over the eye (front end down = stern/knowing, up = worried/sad)
  const b = F.brow;
  const bx0 = ex - erx - 2.5, by0 = ey - ery + 0.5 - Math.min(0, b) * -0.6 + Math.max(0, b) * 0.4;
  const bx1 = ex + erx + 2.5, by1 = ey - ery + 0.8 + b * 4.6;
  const bmy = ey - ery - 3.4 + b * 1.4;
  const brw = new Path2D();
  brw.moveTo(bx0, by0); brw.quadraticCurveTo(ex, bmy - 1.6, bx1, by1);
  brw.quadraticCurveTo(ex + 0.5, bmy + 1.4, bx0, by0); brw.closePath();
  ctx.fillStyle = '#7F8A6C'; ctx.fill(brw);
  ctx.lineWidth = 1.2; ctx.strokeStyle = '#3F4834'; ctx.lineJoin = 'round'; ctx.stroke(brw);
  const fold = new Path2D();
  fold.moveTo(ex - erx + 0.5, ey + ery + 1.8); fold.quadraticCurveTo(ex + 0.5, ey + ery + 4.6, ex + erx, ey + ery + 1.4);
  fold.moveTo(ex - erx + 2.5, ey + ery + 4.8); fold.quadraticCurveTo(ex + 0.5, ey + ery + 6.6, ex + erx - 1.5, ey + ery + 4.4);
  strokeP(ctx, fold, 'rgba(60,70,50,0.62)', 1.1);
  if (hw > 0.02) {
    // crow's feet fanning back from the outer corner
    const cf = new Path2D();
    cf.moveTo(ex - erx - 1.5, ey - 1.5); cf.quadraticCurveTo(ex - erx - 4, ey - 2.6, ex - erx - 6.4, ey - 4.6);
    cf.moveTo(ex - erx - 2, ey + 0.8); cf.quadraticCurveTo(ex - erx - 4.5, ey + 0.8, ex - erx - 7, ey + 0.4);
    cf.moveTo(ex - erx - 1.6, ey + 3); cf.quadraticCurveTo(ex - erx - 4, ey + 4, ex - erx - 6, ey + 6);
    strokeP(ctx, cf, rgba('#3C4632', 0.7 * hw), 1.1);
  }
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
  LROT = lrot;
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

// skin fold where a limb leaves the shell (instead of a ball joint)
function skinCollar(ctx, x, y, rx, ry, rot, c, seed, near) {
  const p = scallop(x, y, rx, ry, rot, 7, 1.1, seed);
  paint(ctx, p, c, { rg: [x - 2, y - 3, rx * 1.4], lw: 1.3, rim: near ? 1.1 : 0 });
  const w = new Path2D();
  const [ax, ay] = rot2(-rx * 0.6, -ry * 0.05, rot), [bx, by] = rot2(rx * 0.55, ry * 0.1, rot);
  w.moveTo(x + ax, y + ay); w.quadraticCurveTo(x, y + ry * 0.6, x + bx, y + by);
  const [cx2, cy2] = rot2(-rx * 0.35, ry * 0.4, rot), [dx2, dy2] = rot2(rx * 0.3, ry * 0.5, rot);
  w.moveTo(x + cx2, y + cy2); w.quadraticCurveTo(x, y + ry * 0.95, x + dx2, y + dy2);
  strokeP(ctx, w, SC.wrinkle, 1);
}
// tapered arm: upper arm → elbow → a little forearm bulge → wrist
function shelleyArm(ctx, R, near, geom) {
  const c = near ? SC.skin : SC.skinFar;
  const { sh, elb, hand } = geom;
  const cl = [sh, lerp2(sh, elb, 0.5), elb, lerp2(elb, hand, 0.38), lerp2(elb, hand, 0.72), hand];
  const p = tubeW(cl, [16.5, 15.5, 13.2, 14.6, 12, 9.6]);
  paint(ctx, p, c, { lg: [0, sh[1] - 10, 0, elb[1] + 9], lw: 1.5, rim: near ? 1.3 : 0, sh: near ? 2 : 0 });
  if (near) {
    ctx.save(); ctx.clip(p);
    ctx.fillStyle = 'rgba(70,80,60,0.24)';
    for (let i = 0; i < 8; i++) {
      const a = along(cl, 0.12 + i * 0.1);
      const d = ((i % 3) - 1) * 3.2;
      ctx.beginPath(); ctx.ellipse(a.x + a.nx * d, a.y + a.ny * d, 2.2 + (i % 2) * 0.5, 1.6, Math.atan2(a.ty, a.tx), 0, TAU); ctx.fill();
    }
    const ef = new Path2D(); ef.moveTo(elb[0] - 6, elb[1] - 5); ef.quadraticCurveTo(elb[0] - 1, elb[1] + 1, elb[0] + 5, elb[1] - 3);
    ef.moveTo(elb[0] - 4, elb[1] - 9); ef.quadraticCurveTo(elb[0], elb[1] - 5, elb[0] + 3, elb[1] - 7);
    const wa = along(cl, 0.9);
    ef.moveTo(wa.x + wa.nx * 4.5, wa.y + wa.ny * 4.5); ef.quadraticCurveTo(wa.x + wa.tx * 1.5, wa.y + wa.ty * 1.5, wa.x - wa.nx * 4.5, wa.y - wa.ny * 4.5);
    strokeP(ctx, ef, SC.wrinkle, 1);
    ctx.restore();
  }
  skinCollar(ctx, sh[0], sh[1] + 1.5, 9.8, 7.8, 0.5, c, near ? 21 : 23, near);
  R[near ? 'nearHand' : 'farHand'] = hand;
  return hand;
}
function nail(ctx, x, y, a, s = 1) {
  const n = el(x, y, 1.7 * s, 1.2 * s, a);
  ctx.fillStyle = SC.nail; ctx.fill(n); ctx.lineWidth = 0.7; ctx.strokeStyle = 'rgba(90,84,60,0.8)'; ctx.stroke(n);
}
function shelleyHand(ctx, R, near, hand) {
  const c = near ? SC.skin : SC.skinFar;
  const [hx, hy] = hand;
  const hp = el(hx, hy, near ? 7 : 5.5, near ? 6 : 6.5, near ? 0.3 : 0);
  paint(ctx, hp, c, { rg: [hx - 2, hy - 2, 9], lw: 1.4 });
  const claws = near ? [[-4, 4.5, 1.9], [-0.5, 5.6, 1.6], [3, 5.2, 1.3]] : [[2.6, -3, -0.6], [3.4, 1, 0], [2.6, 4.5, 0.6]];
  for (const [dx, dy, a] of claws) nail(ctx, hx + dx, hy + dy, a);
}
// the far hand holds the pad from behind at its outer edge: palm + fingertips peek past the edge
// (drawn before the pad), the thumb presses on the front of the page (drawn after it)
function shelleyFarGrip(ctx, R, P, front) {
  const c = SC.skinFar;
  const [hx, hy] = padToLocal(P, P.w / 2 + 1.2, -8.5);
  if (!front) {
    const hp = el(hx, hy, 5.8, 7, P.rot);
    paint(ctx, hp, c, { rg: [hx - 2, hy - 2, 9], lw: 1.4 });
    for (const [u, v, a] of [[4.6, -4.2, -0.5], [5.4, -0.4, 0], [4.8, 3.4, 0.5]]) {
      const [x, y] = padToLocal(P, P.w / 2 + 1.2 + u, -8.5 + v);
      nail(ctx, x, y, a + P.rot);
    }
    return;
  }
  const [tx, ty] = padToLocal(P, P.w / 2 - 2.6, -11);
  const th = el(tx, ty, 4.2, 2.7, P.rot - 0.45);
  paint(ctx, th, { ...SC.skin, base: mix(SC.skin.base, SC.skinFar.base, 0.4) }, { lw: 1.2 });
  const [nx, ny] = padToLocal(P, P.w / 2 - 6, -12.6);
  nail(ctx, nx, ny, P.rot - 0.45, 0.9);
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
  LX = o.flip ? 1 : -1; LW = 1.35; LROT = 0;
  const showPad = o.notepad !== false;
  shelleyLegs(ctx, R, true);
  shelleyShell(ctx, R);
  shelleyNeck(ctx, R);
  shelleyPlastron(ctx, R);
  shelleyHead(ctx, R, o);
  shelleyLegs(ctx, R, false);
  if (showPad) {
    // geometry first (pencil tip drives the writing hand)
    const P = (R.pad = shelleyPadGeom(R));
    const fh = padToLocal(P, P.w / 2 + 1.2, -8.5);
    const fsh = [8, -103];
    shelleyArm(ctx, R, false, { sh: fsh, elb: [lerp(fsh[0], fh[0], 0.38), Math.max(fsh[1], fh[1]) + 11], hand: fh });
    shelleyFarGrip(ctx, R, P, false);
    shelleyPad(ctx, R, o);
    shelleyFarGrip(ctx, R, P, true);
    const tip = R.pencilTip;
    const writing = o.write != null && o.write > 0 && o.write < 1;
    const wig = writing ? Math.sin(o.write * 160) * 0.8 : 0;
    // the hand sits to the world lower-right of the pencil tip so the writing stays visible
    const nh = [tip[0] + (8 + wig) * (R.mir || 1), tip[1] + 8.5];
    const nsh = [14, -100];
    const nearHand = shelleyArm(ctx, R, true, { sh: nsh, elb: [lerp(nsh[0], nh[0], 0.35) + 1, Math.max(nsh[1], nh[1]) + 12], hand: nh });
    shelleyHand(ctx, R, true, nearHand);
    shelleyPencil(ctx, R);
    // thumb wraps over the pencil
    const th = el(nearHand[0] - 2.6, nearHand[1] - 3.2, 3.2, 2.4, -0.7);
    paint(ctx, th, SC.skin, { lw: 1.1 });
  } else {
    // hands clasped on the belly, therapist-style: near fingers laced over the far hand
    R.pencilTip = [34, -64]; R.pad = shelleyPadGeom(R);
    const b = R.breath * 0.4;
    shelleyArm(ctx, R, false, { sh: [8, -103], elb: [7, -78], hand: [30, -63 + b] });
    paint(ctx, el(30, -63 + b, 6.5, 5.6, 0.3), SC.skinFar, { rg: [28, -65, 9], lw: 1.4 });
    for (const [x, y] of [[35.5, -66.5], [37, -62.6]]) {
      paint(ctx, el(x, y + b, 3.2, 2.2, 0.35), SC.skinFar, { lw: 1.1 });
      nail(ctx, x + 2.4, y + 0.9 + b, 0.35, 0.85);
    }
    shelleyArm(ctx, R, true, { sh: [14, -100], elb: [12, -73], hand: [24, -59 + b] });
    paint(ctx, el(24, -59 + b, 7, 6, 0.4), SC.skin, { rg: [22, -61, 9], lw: 1.4 });
    for (const [x, y, a] of [[29.5, -63.5, 0.75], [31.6, -59.6, 0.55], [31.8, -55.6, 0.35]]) {
      paint(ctx, el(x, y + b, 4.2, 2.4, a), SC.skin, { lw: 1.1 });
      nail(ctx, x + Math.cos(a) * 3.4, y + Math.sin(a) * 3.4 + b, a, 0.9);
    }
  }
  ctx.restore();
}
function tortoiseAnchors(o = {}) {
  const R = shelleyRig(o);
  const W = ([x, y]) => worldPt(o, x, y);
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
// lid · brow (tilt: + = front end up, worried) · browUp (raise) · mouth (+ smile / − frown) ·
// pupil / eye (scales) · o (round "O" mouth) · wavy (wobbly mouth) · sweat · happy (closed arcs)
const FFACE_DEF = { lid: 0, brow: 0, browUp: 0, mouth: 0.35, pupil: 1, eye: 1, o: 0, wavy: 0, sweat: 0, happy: 0, look: { x: 0.3, y: 0 } };
const FFACE = {
  neutral: { lid: 0, mouth: 0.35 },
  happy: { brow: -0.2, browUp: 0.6, mouth: 1, happy: true },
  worried: { lid: 0, brow: 1, browUp: 0.6, mouth: -0.6, wavy: true, pupil: 0.62, eye: 1.06 },
  sad: { lid: 0.34, brow: 0.9, browUp: 0.2, mouth: -0.85, pupil: 0.9 },
  solemn: { lid: 0.5, brow: -0.15, browUp: 0, mouth: -0.15 },
  shock: { lid: 0, brow: 0.15, browUp: 2.4, mouth: -1, pupil: 0.4, eye: 1.24, o: 1 },
};
Object.assign(FFACE, {
  panic: { ...FFACE.shock, brow: 1.1, browUp: 1.6, pupil: 0.36, o: 1.25, sweat: true },
  chill: { lid: 0.45, brow: -0.1, browUp: 0.2, mouth: 0.9 },
  smug: { lid: 0.4, brow: -0.45, browUp: 0.4, mouth: 0.6, look: { x: 1, y: 0.2 } },
  deadpan: { lid: 0.5, brow: -0.05, browUp: -0.2, mouth: 0 },
  sleepy: { lid: 0.75, brow: 0, browUp: 0, mouth: -0.1 },
});
// fish-local → local point (shared by drawFish/fishAnchors)
function fishRig(o) {
  const t = o.t || 0;
  const stand = !!o.stand && !o.swim;
  const hopMode = stand || (o.hop != null && !o.swim);
  const F = resolveFace(FFACE, FFACE_DEF, o, 'neutral', 'f:');
  let look = o.look;
  if (!look) {
    // moods without their own glance look where the pose suggests (ahead / down at the ground)
    const md = hopMode ? { x: 0.6, y: stand ? 0.2 : 0.55 } : { x: 0.3, y: 0 };
    let lx = 0, ly = 0;
    for (const n in F.weights) { const L = FFACE[n].look || md; lx += L.x * F.weights[n]; ly += L.y * F.weights[n]; }
    look = { x: lx, y: ly };
  }
  const R = { t, hopMode, stand, F, nod: clamp(o.nod || 0), wave: clamp(o.wave || 0), look };
  if (stand) {
    // upright on the tail, origin = ground; gentle idle sway, no squash & stretch
    R.ph = 0; R.air = 0; R.contact = 0;
    R.ang = -Math.PI / 2 + 0.32 + 0.05 * Math.sin(t * 1.7 + (o.seed || 0)) + R.nod * 0.45;
    R.sx = 1; R.sy = 1 + 0.015 * Math.sin(t * 2.4 + (o.seed || 0));
    R.tailRot = -(R.ang + Math.PI / 2);
    R.gx = 0; R.gy = -12.6;
    R.pivot = [14, 0];
  } else if (hopMode) {
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
function tinySuitcase(ctx, x, y, s = 1, rot = 0) {
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
// standalone suitcase (e.g. the stack on the s08 lily pad): lit from the world upper-left
function drawTinySuitcase(ctx, x, y, s = 1, rot = 0) {
  LX = -1; LROT = 0;
  tinySuitcase(ctx, x, y, s, rot);
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
  LX = o.flip ? 1 : -1; LW = 1.3; LROT = 0;
  // ground shadow while hopping / standing
  if (R.hopMode) {
    ctx.fillStyle = `rgba(0,0,0,${0.18 * (1 - R.air * 0.5)})`;
    ctx.beginPath(); ctx.ellipse(1, 1, 14 * (1 - R.air * 0.3), 2.6, 0, 0, TAU); ctx.fill();
  }
  const w = R.wave;
  const finCol = { base: C.fin, hi: shade(C.fin, 0.25), lo: C.finLo, line: C.line };
  const caseDown = o.suitcase === 'down' && R.hopMode;
  if (caseDown) tinySuitcase(ctx, -25, -16, 0.95, 0); // set down on the ground beside him
  // waving: a fin raised from the upper back, BEHIND the head, waving above it — it can never
  // cover the eye or mouth (the body is drawn over its root)
  if (w > 0.01) fishWaveFin(ctx, R, o, finCol, w, C);
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
  const hw = F.happy;
  const openA = 1 - smoothstep(0.8, 1, hw);
  if (openA > 0.003) {
    ctx.save(); ctx.globalAlpha *= openA;
    const es = F.eye;
    const eye = el(ex, ey, 5.4 * es, 5.8 * es);
    ctx.fillStyle = '#FFFFFF'; ctx.fill(eye);
    ctx.save(); ctx.clip(eye);
    const lk = R.look;
    const pr = 3.4 * F.pupil;
    const free = 5.4 * es - pr - 0.6;
    const px = ex + 0.6 + clamp(lk.x || 0, -1, 1) * Math.min(free, 1.6 + (1 - F.pupil) * 3), py = ey + 0.4 + clamp(lk.y || 0, -1, 1) * Math.min(free, 1.6 + (1 - F.pupil) * 3);
    ctx.fillStyle = '#1E1A22'; ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(px - pr * 0.35, py - pr * 0.4, pr * 0.36, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(px + pr * 0.35, py + pr * 0.4, pr * 0.16, 0, TAU); ctx.fill();
    const lid = clamp(lerp(F.lid + (1 - F.lid) * bk, 1, smoothstep(0.3, 0.8, hw)));
    if (lid > 0.01) {
      const ly = ey - 5.8 + lid * 11.6;
      ctx.fillStyle = C.body; ctx.fillRect(ex - 7, ey - 8, 14, ly - (ey - 8));
      ctx.lineWidth = 1.3; ctx.strokeStyle = C.line; ctx.beginPath(); ctx.moveTo(ex - 6, ly); ctx.lineTo(ex + 6, ly); ctx.stroke();
    }
    ctx.restore();
    ctx.lineWidth = 1.2; ctx.strokeStyle = C.line; ctx.stroke(eye);
    ctx.restore();
  }
  if (hw > 0.35) {
    ctx.save(); ctx.globalAlpha *= smoothstep(0.35, 0.8, hw);
    const hp = new Path2D(); hp.moveTo(ex - 4.2, ey + 1.2); hp.quadraticCurveTo(ex, ey - 4.6, ex + 4.2, ey + 1.2);
    strokeP(ctx, hp, '#2A1A14', 1.6);
    ctx.restore();
  }
  const bA = Math.min(1, (Math.abs(F.brow) + Math.abs(F.browUp)) * 4);
  if (bA > 0.01) {
    // bold little brows: they carry the acting at fish-cam size
    const es = F.eye, up = F.browUp * 1.4 + (es - 1) * 6, bt = F.brow;
    const b = new Path2D();
    b.moveTo(ex - 4.6, ey - 7.4 * es - up + bt * 1.7); b.quadraticCurveTo(ex, ey - 9.6 * es - up - Math.abs(bt) * 0.4, ex + 4.2, ey - 7.8 * es - up - bt * 2);
    strokeP(ctx, b, rgba(C.line, bA), 2.1);
  }
  if (F.sweat > 0.02) {
    const [sx, sy] = [ex - 9, ey - 9];
    const d = new Path2D(); d.moveTo(sx, sy - 4); d.quadraticCurveTo(sx + 2.6, sy + 0.4, sx, sy + 1.6); d.quadraticCurveTo(sx - 2.6, sy + 0.4, sx, sy - 4); d.closePath();
    ctx.save(); ctx.globalAlpha *= F.sweat;
    ctx.fillStyle = '#BFEFFF'; ctx.fill(d); ctx.lineWidth = 0.9; ctx.strokeStyle = '#3A8FB0'; ctx.stroke(d);
    ctx.restore();
  }
  // mouth (little pout at the nose): line ↔ wobbly line ↔ round "O"
  const mx = 17.2, my = 3.4;
  const oA = smoothstep(0.15, 0.6, F.o), lineA = 1 - oA;
  if (oA > 0.01) {
    const os = Math.max(0.4, F.o);
    ctx.save(); ctx.globalAlpha *= oA;
    ctx.fillStyle = '#7A2A2A'; ctx.beginPath(); ctx.ellipse(mx - 0.8, my + 0.4, 1.9 * os, 2.5 * os, 0, 0, TAU); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = C.line; ctx.stroke();
    ctx.restore();
  }
  if (lineA > 0.01) {
    ctx.save(); ctx.globalAlpha *= lineA;
    const wv = F.wavy;
    if (wv > 0.01) {
      const m = new Path2D();
      m.moveTo(mx + 1, my - 0.2); m.quadraticCurveTo(mx - 0.4, my - 1.6, mx - 1.6, my); m.quadraticCurveTo(mx - 2.8, my + 1.6, mx - 4.2, my + 0.4);
      ctx.save(); ctx.globalAlpha *= wv; strokeP(ctx, m, C.line, 1.2); ctx.restore();
    }
    if (wv < 0.99) {
      ctx.save(); ctx.globalAlpha *= 1 - wv;
      const m = new Path2D();
      m.moveTo(mx + 1, my - 1); m.quadraticCurveTo(mx - 1.5, my + 1.6 * F.mouth, mx - 3.8, my - 0.4 - F.mouth * 1.4);
      strokeP(ctx, m, C.line, 1.2);
      ctx.fillStyle = rgba(C.lo, 0.9); ctx.beginPath(); ctx.ellipse(mx + 0.6, my - 0.4, 1.3, 1.6, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
  // ---- near pectoral fin: suitcase carrier / idle paddle
  const finBase = R.P(2, 5);
  let finAng = R.ang + 2.6 + 0.22 * Math.sin(t * 9 + 1);
  if (o.suitcase && !caseDown) {
    // fin reaches down to the handle; the case swings with the hop
    const swing = R.hopMode && !R.stand ? -0.35 * Math.cos(TAU * R.ph) : Math.sin(t * 2.1 + 1) * 0.08;
    const hx = finBase[0] + 2;
    let hy = finBase[1] + 10.5;
    if (R.hopMode) hy = Math.min(hy, -15.4); // the case rests on the ground, never sinks into it
    tinySuitcase(ctx, hx, hy - 0.6, 0.95, swing);
    finAng = Math.atan2(hy - finBase[1], hx - finBase[0]);
  }
  ctx.save();
  ctx.translate(finBase[0], finBase[1]); ctx.rotate(finAng);
  const pf = new Path2D();
  pf.moveTo(0, -2.4); pf.quadraticCurveTo(7, -5.2, 11.5, -2.2); pf.quadraticCurveTo(12.4, 0.6, 10.6, 2.6); pf.quadraticCurveTo(6, 4.2, 0, 2.4); pf.closePath();
  paint(ctx, pf, finCol, { lg: [0, 0, 12, 0], lw: 1.1 });
  const fr = new Path2D(); fr.moveTo(1.5, -0.4); fr.lineTo(10, -2); fr.moveTo(1.5, 0.8); fr.lineTo(10.4, 1.4);
  strokeP(ctx, fr, rgba(C.line, 0.35), 0.7);
  ctx.restore();
  ctx.restore();
}
// the waving fin (drawn behind the body): rooted on the upper back just behind the head, raised
// above the head (−1.25 rad ± 0.45 swing, local frame), wrist lag; tucks away as wave → 0
function fishWaveFin(ctx, R, o, finCol, w, C) {
  const base = R.P(5, -11.5);
  const wt = R.t * 9.5 + (o.seed || 0);
  const a1 = lerp(-0.2, -1.52, w) + 0.36 * Math.sin(wt) * w;
  const a2 = a1 + Math.sin(wt - 1.1) * 0.45 * w - 0.12 * w;
  const fs = lerp(0.4, 1.45, w);
  const J = [base[0] + Math.cos(a1) * 7 * fs, base[1] + Math.sin(a1) * 7 * fs];
  const T = [J[0] + Math.cos(a2) * 7.5 * fs, J[1] + Math.sin(a2) * 7.5 * fs];
  const n1 = [-Math.sin(a1), Math.cos(a1)], n2 = [-Math.sin(a2), Math.cos(a2)];
  const tw = 4.6 * fs, ux = Math.cos(a2), uy = Math.sin(a2);
  // a fan: narrow wrist, wide frilled tip
  const pf = bl([
    [base[0] + n1[0] * 2.4, base[1] + n1[1] * 2.4], [J[0] + n1[0] * 2.4, J[1] + n1[1] * 2.4],
    [T[0] + n2[0] * tw, T[1] + n2[1] * tw], [T[0] + ux * 2.4 + n2[0] * 2.2, T[1] + uy * 2.4 + n2[1] * 2.2],
    [T[0] + ux * 1.4, T[1] + uy * 1.4], [T[0] + ux * 2.4 - n2[0] * 2.2, T[1] + uy * 2.4 - n2[1] * 2.2],
    [T[0] - n2[0] * tw, T[1] - n2[1] * tw], [J[0] - n1[0] * 2.2, J[1] - n1[1] * 2.2],
    [base[0] - n1[0] * 2.2, base[1] - n1[1] * 2.2],
  ], 0.85);
  paint(ctx, pf, { ...finCol, base: shade(finCol.base, 0.1), hi: shade(finCol.base, 0.35) }, { lg: [base[0], base[1], T[0], T[1]], lw: 1.15, rim: 0.8 });
  const fr = new Path2D();
  for (const k of [-1, 0, 1]) { fr.moveTo(J[0] + n1[0] * k * 0.8, J[1] + n1[1] * k * 0.8); fr.lineTo(T[0] + n2[0] * k * tw * 0.75, T[1] + n2[1] * k * tw * 0.75); }
  strokeP(ctx, fr, rgba(C.line, 0.4), 0.7);
  // motion ticks beside the tip, strongest mid-swing (also behind the body: never on the face)
  const vel = Math.abs(Math.cos(wt)) * w, dir = Math.cos(wt) > 0 ? 1 : -1;
  if (vel > 0.35 && o.ticks !== false) {
    const tk = new Path2D();
    for (const k of [0, 1]) {
      const r = 15.5 * fs + k * 3.2, a0 = a1 - dir * (0.3 + k * 0.08);
      tk.moveTo(base[0] + Math.cos(a0) * r, base[1] + Math.sin(a0) * r);
      tk.arc(base[0], base[1], r, a0, a0 - dir * 0.32, dir > 0);
    }
    strokeP(ctx, tk, rgba(C.line, 0.7 * (vel - 0.35) / 0.65 + 0.15), 1.1);
  }
  return { base, a1, fs, tip: T, vel, dir };
}
// horizontal travel for a hopping fish: the foot stays planted on the ground between hops.
// x = x0 + fishHopX(hop, stride) * (flip ? -1 : 1)
function fishHopX(hop, stride = 30) {
  const n = Math.floor(hop), f = hop - n;
  return stride * (n + smoothstep(0.08, 0.92, f));
}
function fishAnchors(o = {}) {
  const R = fishRig(o);
  const W = ([x, y]) => worldPt(o, x, y);
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
  LX = o.flip ? 1 : -1; LW = 1.25; LROT = 0;
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
  const P = (x, y) => { const [rx, ry] = rot2(x, y + 12, R.rot); return worldPt(o, rx, ry - 12 - R.lift); };
  return { beak: P(16.4, -24.4), head: P(2, -33), eye: P(3.6, -24.2), feet: worldPt(o, 0, 0) };
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
  LX = o.flip ? 1 : -1; LW = 1.35; LROT = 0;
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
  return { head: worldPt(o, 29, -20), face: worldPt(o, 29, -8), belly: worldPt(o, 0, 0) };
}

// single drifting feather (e.g. the one Gerald leaves behind)
function drawFeather(ctx, o = {}) {
  const s = o.scale == null ? 1 : o.scale;
  ctx.save();
  ctx.translate(o.x || 0, o.y || 0);
  ctx.rotate(o.rot || 0);
  ctx.scale(s, s);
  LW = 1; LX = -1; LROT = 0;
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
const G_MOODS = ['neutral', 'smug', 'happy', 'sad', 'shock', 'worried', 'panic', 'deadpan', 'chill', 'sleepy'];
// all Gerald moods (perched on a capybara-head stand-in) + every pose
lab.gerald = (ctx, t) => {
  labBg(ctx);
  G_MOODS.forEach((m, i) => {
    const x = 66 + i * 127, y = 200;
    capyHeadStub(ctx, x, y + 2, 0.5);
    drawVulture(ctx, { x, y, scale: 1.0, t, mood: m });
    label(ctx, m + (m === 'smug' ? ' (default)' : ''), x, 250, 13);
  });
  const fly = [
    { pose: 'fly', flapPhase: 0.0, l: 'fly (top)' }, { pose: 'fly', flapPhase: 0.22, l: 'fly 0.22 (blade)' },
    { pose: 'fly', flapPhase: 0.48, l: 'fly (bottom)' }, { pose: 'fly', flapPhase: 0.75, l: 'fly 0.75 (upstroke)' },
    { pose: 'fly', glide: true, l: 'fly glide' }, { pose: 'fly', flapPhase: 0.1, flare: 0.55, l: 'flare .55' },
  ];
  fly.forEach((p, i) => {
    const x = 105 + i * 214, y = 440;
    drawVulture(ctx, { x, y, scale: 0.78, t, ...p });
    label(ctx, p.l, x, 470, 13);
  });
  const ground = [
    { pose: 'land', legs: 1, flapPhase: 0.05, l: 'land (legs 1)' }, { pose: 'takeoff', legs: 1, flapPhase: 0.12, l: 'takeoff (push)' },
    { pose: 'takeoff', legs: -0.25, flapPhase: 0, l: 'crouch (legs -.25)' },
    { pose: 'perch', wing: 1, l: 'perch wing 1 (spread)' }, { pose: 'perch', settle: 1, mantle: 1, l: 'settle+mantle' },
    { pose: 'perch', talk: 0.8, mood: 'neutral', look: { x: -0.6, y: 0.8 }, l: 'talk + look' },
    { pose: 'perch', preen: 1, mood: 'neutral', l: 'preen 1' },
  ];
  ground.forEach((p, i) => {
    const x = 90 + i * 183, y = 690;
    ctx.fillStyle = 'rgba(120,80,40,0.5)'; ctx.fillRect(x - 60, y, 120, 6);
    const o = { x, y, scale: 0.9, t, ...p };
    drawVulture(ctx, o);
    const A = vultureAnchors(o);
    dot(ctx, A.beak, '#FF3B7F'); dot(ctx, A.head, '#3BA0FF');
    label(ctx, p.l, x, 713, 13);
  });
  label(ctx, 'dots: vultureAnchors().beak (pink) / .head (blue)', 1110, 20, 12);
};
// the flap cycle at 12 phases (static) — no cape at the bottom, a blade (not a knot) where the
// near wing passes its own chord, the far wing slides behind the body on the downstroke
lab.gerald_cycle = (ctx, t) => {
  labBg(ctx);
  for (let i = 0; i < 12; i++) {
    const x = 120 + (i % 6) * 205, y = 190 + Math.floor(i / 6) * 230;
    drawVulture(ctx, { x, y, scale: 0.95, t, pose: 'fly', flapPhase: i / 12 });
    label(ctx, `flapPhase ${(i / 12).toFixed(3)}`, x - 20, y + 70, 13);
  }
  for (let i = 0; i < 6; i++) {
    const x = 120 + i * 205, y = 640;
    drawVulture(ctx, { x, y, scale: 0.55, t, pose: 'fly', flapPhase: i / 6 + 0.04 });
    label(ctx, `in-film scale .55 · ${(i / 6 + 0.04).toFixed(2)}`, x - 10, y + 50, 12);
  }
};
// animation check (use --frames 8 --dt 0.1): flap cycle, landing/takeoff helpers, balance flaps, talk
lab.gerald_flap = (ctx, t) => {
  labBg(ctx);
  drawVulture(ctx, { x: 250, y: 230, scale: 1.3, t, pose: 'fly', flapPhase: t * 2.3 });
  label(ctx, 'fly (2.3 Hz)', 250, 300, 20);
  const pl = (t / 1.6) % 1;
  ctx.fillStyle = 'rgba(120,80,40,0.6)'; ctx.fillRect(760, 380, 140, 8);
  drawVulture(ctx, geraldLanding(pl, { x: 830, y: 380, scale: 1.05, t, flip: true, from: { dx: -150, dy: -150 } }));
  label(ctx, 'geraldLanding (flip)', 830, 410, 18);
  const pt = (t / 1.5) % 1;
  ctx.fillRect(1060, 380, 140, 8);
  drawVulture(ctx, geraldTakeoff(pt, { x: 1100, y: 380, scale: 0.9, t, to: { dx: 160, dy: -330 } }));
  label(ctx, 'geraldTakeoff', 1130, 410, 18);
  capyHeadStub(ctx, 330, 672, 1.1);
  drawVulture(ctx, { x: 330, y: 670, scale: 1.2, t, pose: 'perch', wing: 0.85, flapPhase: t * 1.6, mood: 'shock' });
  label(ctx, 'perch balance flaps (wing .85 + flapPhase)', 330, 705, 16);
  capyHeadStub(ctx, 820, 662, 1.1);
  drawVulture(ctx, { x: 820, y: 660, scale: 1.5, t: t * 4, pose: 'perch', talk: clamp(0.5 + 0.5 * Math.sin(t * 13)) });
  label(ctx, 'perch idle + talk (t x4)', 820, 705, 16);
  drawFeather(ctx, { x: 1110, y: 520 + (t * 40) % 140, rot: Math.sin(t * 3) * 0.8, scale: 2 });
  label(ctx, 'drawFeather', 1110, 705, 16);
};
// the whole 1.6 s landing, 1.5 s takeoff and a 0.9 s hop (use --frames 24 --dt 0.0667)
lab.gerald_land = (ctx, t) => {
  labBg(ctx);
  capyHeadStub(ctx, 330, 522, 1.6);
  drawVulture(ctx, geraldLanding(clamp(t / 1.6), { x: 330, y: 520, scale: 1.2, t, from: { dx: -260, dy: -260 } }));
  label(ctx, `geraldLanding p=${clamp(t / 1.6).toFixed(2)}`, 330, 640, 20);
  capyHeadStub(ctx, 760, 522, 1.6);
  drawVulture(ctx, geraldTakeoff(clamp(t / 1.5), { x: 760, y: 520, scale: 1.2, t, to: { dx: 220, dy: -420 } }));
  label(ctx, `geraldTakeoff p=${clamp(t / 1.5).toFixed(2)}`, 760, 640, 20);
  ctx.fillStyle = 'rgba(120,80,40,0.6)'; ctx.fillRect(990, 560, 70, 8); ctx.fillRect(1170, 520, 70, 8);
  drawVulture(ctx, geraldHop(clamp((t % 1.2) / 0.9), { x: 1025, y: 560, scale: 0.9, t, to: { x: 1205, y: 520 } }));
  label(ctx, 'geraldHop (180 units)', 1110, 640, 20);
};
// gestures for the scripted beats: preen (s08 flag), settle + mantle (covers the flag words),
// cling (shuffle down the pole), grip (s04 rumble: talons dig in + tremble), mood cross-fades
lab.gerald_gestures = (ctx, t) => {
  labBg(ctx);
  const row1 = [
    { preen: 0.4, l: 'preen .4' }, { preen: 1, l: 'preen 1' }, { settle: 0.6, l: 'settle .6' },
    { settle: 1, l: 'settle 1' }, { settle: 1, mantle: 1, l: 'settle 1 + mantle 1' },
  ];
  row1.forEach((p, i) => {
    const x = 120 + i * 255, y = 300;
    ctx.fillStyle = 'rgba(120,80,40,0.55)'; ctx.fillRect(x - 110, y, 220, 7);
    drawVulture(ctx, { x, y, scale: 1.3, t, mood: 'smug', ...p });
    label(ctx, p.l, x, y + 30, 15);
  });
  // cling: a vertical pole just in front of the feet
  for (let i = 0; i < 2; i++) {
    const x = 120 + i * 255, y = 520;
    ctx.fillStyle = '#B08A52'; ctx.fillRect(i ? x - 9 : x + 1, 360, 8, 330);
    drawVulture(ctx, { x, y: y + Math.sin(t * 6) * 3 * i, scale: 1.2, t, cling: 1, mood: i ? 'deadpan' : 'smug', flip: i === 1 });
    label(ctx, i ? 'cling (flip)' : 'cling 1', x, 708, 15);
  }
  // grip
  capyHeadStub(ctx, 640, 600, 1.1);
  drawVulture(ctx, { x: 640, y: 598, scale: 1.3, t, grip: 1, mood: 'worried' });
  label(ctx, 'grip 1 (worried)', 640, 708, 15);
  // mood blends: smug → shock in 5 steps (moodMix), small scale
  for (let i = 0; i < 5; i++) {
    const x = 860 + (i % 3) * 140, y = 560 + Math.floor(i / 3) * 130;
    capyHeadStub(ctx, x, y + 2, 0.4);
    drawVulture(ctx, { x, y, scale: 0.85, t, mood: 'smug', mood2: 'shock', moodMix: i / 4 });
    label(ctx, `smug-shock mix ${(i / 4).toFixed(2)}`, x, y + 22, 12);
  }
};
lab.gerald_moods = (ctx, t) => {
  labBg(ctx);
  G_MOODS.forEach((m, i) => {
    const cx = 128 + (i % 5) * 256, cy = 170 + Math.floor(i / 5) * 360;
    ctx.save();
    ctx.beginPath(); ctx.rect(cx - 126, cy - 168, 252, 352); ctx.clip();
    const A = vultureAnchors({ x: 0, y: 0, scale: 3, t, mood: m });
    drawVulture(ctx, { x: cx - 10 - A.headCenter.x, y: cy - A.headCenter.y, scale: 3, t, mood: m });
    ctx.restore();
    label(ctx, m, cx, cy + 165, 18);
  });
};
lab.shelley = (ctx, t) => {
  labBg(ctx, '#C98F5A', '#7A4E2E');
  const moods = ['neutral', 'happy', 'sad', 'smug', 'shock'];
  moods.forEach((m, i) => {
    const x = 105 + i * 250, y = 300;
    ctx.fillStyle = '#7A3E2E'; U.roundRect(ctx, x - 80, y, 160, 26, 10); ctx.fill();
    drawTortoise(ctx, { x, y, scale: 1.15, t, mood: m, talk: m === 'happy' ? 0.6 : 0, flip: i % 2 === 1 });
    label(ctx, m + (m === 'happy' ? ' + talk' : '') + (i % 2 ? ' (flip)' : ''), x, y + 46);
  });
  const ex = [
    { l: 'write 0.5 (scribble)', write: 0.5 }, { l: "note:'NUTS' write .95", note: 'NUTS', write: 0.95, flip: true },
    { l: 'turn .5 (cranes up)', turn: 0.5, flip: true }, { l: 'turn 1 (to the window)', turn: 1, flip: true, mood: 'worried' }, { l: 'notepad:false', notepad: false, mood: 'chill' },
  ];
  ex.forEach((e, i) => {
    const x = 105 + i * 250, y = 680;
    ctx.fillStyle = '#7A3E2E'; U.roundRect(ctx, x - 80, y, 160, 26, 10); ctx.fill();
    const o = { x, y, scale: 1.15, t, ...e };
    drawTortoise(ctx, o);
    if (i === 0) { const A = tortoiseAnchors(o); dot(ctx, A.notepad, '#FF3B7F'); dot(ctx, A.head, '#3BA0FF'); dot(ctx, A.beak, '#FFD23B'); }
    label(ctx, e.l, x, y + 34);
  });
};
lab.shelley_moods = (ctx, t) => {
  labBg(ctx, '#C98F5A', '#7A4E2E');
  const ms = ['neutral', 'happy', 'smug', 'sad', 'worried', 'deadpan', 'chill', 'sleepy', 'shock', 'panic'];
  ms.forEach((m, i) => {
    const cx = 128 + (i % 5) * 256, cy = 170 + Math.floor(i / 5) * 360;
    ctx.save();
    ctx.beginPath(); ctx.rect(cx - 126, cy - 168, 252, 352); ctx.clip();
    const o = { x: 0, y: 0, scale: 2.6, t, mood: m, flip: true };
    const A = tortoiseAnchors(o);
    drawTortoise(ctx, { ...o, x: cx + 10 - A.headCenter.x, y: cy - A.headCenter.y });
    ctx.restore();
    label(ctx, m, cx, cy + 165, 18);
  });
};
lab.fish = (ctx, t) => {
  labBg(ctx, '#BFE7F2', '#E9D9B0');
  ctx.fillStyle = 'rgba(92,201,201,0.55)'; ctx.fillRect(0, 0, 1280, 300);
  const moods = ['neutral', 'happy', 'worried', 'sad', 'solemn', 'shock', 'panic'];
  moods.forEach((m, i) => {
    drawFish(ctx, { x: 95 + i * 180, y: 110, scale: 2.4, t, mood: m, color: i % 2 ? 'teal' : 'orange', swim: true });
    label(ctx, m, 95 + i * 180, 190);
  });
  drawFish(ctx, { x: 420, y: 255, scale: 1.8, t, color: '#B48CFF', suitcase: true, swim: true });
  label(ctx, 'custom colour + suitcase (swim)', 420, 292);
  drawFish(ctx, { x: 860, y: 255, scale: 1.8, t, color: 'teal', swim: true, wave: 1, mood: 'happy' });
  label(ctx, 'swim + wave', 860, 292);
  // the s08 lily pad: standing, waving
  ctx.fillStyle = '#4E9A5A'; ctx.beginPath(); ctx.ellipse(330, 470, 230, 46, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#5FAF6A'; ctx.beginPath(); ctx.ellipse(330, 464, 224, 40, 0, 0, TAU); ctx.fill();
  drawFish(ctx, { x: 200, y: 466, scale: 2.2, t, stand: true, wave: 1, color: 'orange', mood: 'happy', seed: 0 });
  drawFish(ctx, { x: 330, y: 466, scale: 2.2, t, stand: true, wave: 1, color: 'teal', mood: 'neutral', seed: 1.3, suitcase: true });
  drawFish(ctx, { x: 460, y: 466, scale: 2.2, t, stand: true, wave: 1, color: 'orange', mood: 'solemn', seed: 2.1, suitcase: 'down' });
  label(ctx, "stand:true + wave (s08 'Oh, now they wave') · suitcase true / 'down'", 330, 506, 13);
  drawFish(ctx, { x: 900, y: 466, scale: 2.2, t, stand: true, color: 'teal', mood: 'worried', suitcase: true });
  drawFish(ctx, { x: 1050, y: 466, scale: 2.2, t, stand: true, color: 'orange', mood: 'shock', flip: true });
  label(ctx, 'stand idle (+ suitcase) · flip', 975, 506, 13);
  ctx.fillStyle = '#A8885E'; ctx.fillRect(0, 650, 1280, 70);
  for (let i = 0; i < 6; i++) {
    const x = 110 + i * 210;
    drawFish(ctx, { x, y: 670, scale: 1.6, t, hop: i / 6 + t * 1.5, suitcase: true, color: i % 2 ? 'teal' : 'orange', mood: i === 5 ? 'solemn' : 'worried', nod: i === 5 ? 0.6 : 0 });
    label(ctx, i === 5 ? 'hop + nod .6 (solemn)' : 'hop ' + (i / 6).toFixed(2), x, 700, 13);
  }
};
// regression for the s08 'fish_float_by' wave: 12 wave phases × both facings. The waving fin is
// raised from the upper back BEHIND the head, so it can never cover the eye or mouth — each cell
// measures it (pixels of the eye/mouth that change when the wave is switched on).
lab.fish_wave = (ctx, t) => {
  labBg(ctx, '#BFE7F2', '#E9D9B0');
  const { createCanvas } = require('@napi-rs/canvas');
  const cover = (o) => {
    let worst = 0;
    const A = fishAnchors(o);
    for (const [k, r] of [['eye', 6 * o.scale], ['mouth', 2.5 * o.scale]]) {
      const grab = (oo) => {
        const c = createCanvas(240, 240), g = c.getContext('2d');
        g.fillStyle = '#88ccee'; g.fillRect(0, 0, 240, 240);
        drawFish(g, { ...oo, x: oo.x - A[k].x + 120, y: oo.y - A[k].y + 120 });
        return g.getImageData(Math.round(120 - r), Math.round(120 - r), Math.round(2 * r), Math.round(2 * r)).data;
      };
      const a = grab(o), b = grab({ ...o, wave: 0 });
      let d = 0;
      for (let j = 0; j < a.length; j += 4) if (Math.abs(a[j] - b[j]) + Math.abs(a[j + 1] - b[j + 1]) + Math.abs(a[j + 2] - b[j + 2]) > 30) d++;
      worst = Math.max(worst, d / (a.length / 4));
    }
    return worst;
  };
  let worstAll = 0;
  for (let i = 0; i < 24; i++) {
    const flip = i >= 12, ph = i % 12;
    const x = 85 + (i % 8) * 155 + (flip ? 30 : 0), y = 150 + Math.floor(i / 8) * 225;
    const o = { x, y, scale: 2.4, t: t + (ph / 12) * (TAU / 9.5), stand: true, wave: 1, flip, color: ph % 2 ? 'teal' : 'orange', mood: ['happy', 'sad', 'solemn'][ph % 3] };
    drawFish(ctx, o);
    const c = cover(o);
    worstAll = Math.max(worstAll, c);
    label(ctx, `${flip ? 'flip ' : ''}phase ${ph}/12 · face ${(c * 100).toFixed(1)}%`, x, y + 28, 12, c > 0.03 ? '#FF4040' : '#ffffff');
  }
  label(ctx, `worst eye/mouth coverage by the waving fin: ${(worstAll * 100).toFixed(2)}% (AA edge noise < 3%)`, 640, 700, 18, worstAll > 0.03 ? '#FF4040' : '#ffffff');
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
// regression: every critter's anchors at rot -0.5 / 0 / +0.5, unflipped and flipped. Dots must sit
// on the features (pink = beak/mouth, blue = head/top, yellow = eye, green = notepad/feet/belly).
lab.anchors = (ctx, t) => {
  labBg(ctx);
  const rows = [
    ['vulture', drawVulture, vultureAnchors, { scale: 0.62, t, talk: 0.4 }, ['beak', 'head', 'eye', 'feet'], 38],
    ['vulture fly', drawVulture, vultureAnchors, { scale: 0.42, t, pose: 'fly', flapPhase: 0.3 }, ['beak', 'head', 'eye', 'wingTip'], 0],
    ['tortoise', drawTortoise, tortoiseAnchors, { scale: 0.42, t }, ['beak', 'head', 'eye', 'notepad'], 50],
    ['fish hop', drawFish, fishAnchors, { scale: 1.4, t, hop: 0.35, suitcase: true }, ['mouth', 'top', 'eye', 'center'], 30],
    ['bird', drawBird, birdAnchors, { scale: 1.6, t, chirp: 0.6 }, ['beak', 'head', 'eye', 'feet'], 30],
    ['monkey', drawMonkey, monkeyAnchors, { scale: 1.1, t }, ['face', 'head', null, 'belly'], 10],
  ];
  const cols = [[false, -0.5], [false, 0], [false, 0.5], [true, -0.5], [true, 0], [true, 0.5]];
  const cw = 1280 / 6, ch = 720 / rows.length;
  const colrs = ['#FF3B7F', '#3BA0FF', '#FFD23B', '#2BD07A'];
  rows.forEach(([name, draw, anc, base, keys, dy], r) => {
    cols.forEach(([flip, rot], c) => {
      const o = { ...base, x: c * cw + cw / 2, y: r * ch + ch / 2 + dy, flip, rot };
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(o.x - 1, o.y - 1, 2, 2);
      draw(ctx, o);
      const A = anc(o);
      keys.forEach((k, i) => { if (k && A[k]) dot(ctx, A[k], colrs[i]); });
      if (c === 0) label(ctx, name, 50, r * ch + 16, 12, '#123');
      if (r === 0) label(ctx, `${flip ? 'flip' : 'unflip'} rot ${rot}`, c * cw + cw / 2, 12, 11, '#123');
    });
  });
};
// integration check with the real capybara rig (if capybara.js is present): rot = headTop.angle
// works for both facings
lab.context = (ctx, t) => {
  labBg(ctx);
  let K = null;
  try { K = require('./capybara'); } catch (e) { K = null; }
  if (!K || !K.drawCapybara) { label(ctx, 'capybara.js not available', 640, 360, 24); return; }
  const barry = { who: 'barry', x: 330, y: 520, scale: 1.15, t, pose: 'swim', mood: 'deadpan', headTilt: 10 * Math.sin(t * 1.3) };
  K.drawCapybara(ctx, barry);
  const A = K.capyAnchors(barry);
  drawVulture(ctx, { x: A.headTop.x, y: A.headTop.y, rot: A.headTop.angle, scale: 0.75 * barry.scale, t, mood: 'smug', talk: clamp(Math.sin(t * 11)) * 0.6 });
  label(ctx, 'Gerald on Barry: scale = 0.75 x capy scale, rot = headTop.angle', 330, 690, 15);
  const sunny = { who: 'sunny', x: 920, y: 520, scale: 1.1, t, pose: 'swim', mood: 'worried', flip: true, accessories: { orange: false }, headTilt: -12 * Math.sin(t * 1.1 + 1), talk: clamp(Math.sin(t * 9)) * 0.7 };
  K.drawCapybara(ctx, sunny);
  const B = K.capyAnchors(sunny);
  drawVulture(ctx, { x: B.headTop.x, y: B.headTop.y, rot: B.headTop.angle, scale: 0.75 * sunny.scale, t, mood: 'smug', flip: true });
  label(ctx, 'flipped host (s09 Sunny): same recipe', 920, 690, 15);
  const ex = { who: 'extra', seed: 3, x: 640, y: 300, scale: 0.7, t, pose: 'swim', accessories: { orange: false, bird: false } };
  K.drawCapybara(ctx, ex);
  const E = K.capyAnchors(ex);
  drawMonkey(ctx, { x: E.back.x - 8, y: E.back.y + 2, scale: 0.9 * ex.scale, t, rot: 0 });
  drawBird(ctx, { x: E.headTop.x, y: E.headTop.y, rot: E.headTop.angle, scale: 1.0 * ex.scale, t, chirp: Math.sin(t * 2) > 0.6 });
  label(ctx, 'extras: monkey on back (0.9 x), bird on headTop (1.0 x)', 640, 395, 14);
};

module.exports = {
  drawVulture, vultureAnchors, geraldLanding, geraldTakeoff, geraldHop, drawTortoise, tortoiseAnchors, drawFish, fishAnchors, fishHopX, drawTinySuitcase,
  drawBird, birdAnchors, drawMonkey, monkeyAnchors, drawFeather, lab,
};
