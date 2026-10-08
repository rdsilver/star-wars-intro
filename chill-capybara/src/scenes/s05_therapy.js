// s05_therapy — INT. DR. SHELLEY'S OFFICE (a hollow log). 1:47–2:26, fades in from s04.
//
// Barry lies on the teal log-couch (pose 'lie') with Gerald perched on his head the whole session;
// Dr. Shelley (ancient tortoise, tiny spectacles, notepad) sits in the oxblood wingback. The comedy
// is SLOWNESS: every Shelley move is glacial and held; Barry's are quick and neurotic; Gerald is
// politely, maddeningly comfortable (and, being a vulture, quietly knows what the window means).
//
// STAGING (scene-local seconds, from build/timeline.json)
//   office_wide #1  0.00  establishing through the fade-in.
//   barry_couch #1  0.40  barry_to_camera: Barry turns his face to us (kit turnToCamera) for the whole
//                         "This is Doctor Shelley…" line; his eyes slide over to Shelley on "He's a
//                         tortoise." and back to us for "childhood". Gerald looks out at us too, then
//                         gives the doctor a little nod. "Doc, a vulture is using my head as a BENCH…":
//                         Barry's eyes roll up at Gerald, and on "bench" Gerald settles down onto him
//                         like a park bench (settle + a fluff) and stays settled for the session;
//                         "…and I'm the crazy one?" — the paw comes out, palm up.
//   shelley_cu #1  10.18  "Is this vulture… in the room with us… right now?" — the slow therapist
//                         lean-in, one notch per phrase of the read, then the slow return.
//   office_wide #2 15.12  medium-wide: "He's on my head!" — a take + paw jab, Gerald grips and
//                         bristles; "Hello." with a courtly nod; the long pause (Shelley stares at the
//                         vulture, eye level); "…Hello." with a glacial nod back; Barry turns to us.
//   shelley_cu #2  19.11  Shelley + notepad: he writes "NUTS" and underlines it twice, in sync with
//                         the 1.5 s paper_scribble, then looks up: "You're… catastrophizing."
//   window #1      23.33  window_puff: Shelley in the foreground closing his eyes in self-satisfied
//                         bliss while Mount Snooze puffs a big dark billow in the porthole above him.
//   barry_couch #2 24.93  tighter, lead room: "Doc. Turn around." — eyes on the window, paw pointing;
//                         Gerald calmly looks at the window too.
//   window #2      26.06  shelley_turns: eyes open, a beat of nothing, then the impossibly slow crane
//                         up (glacial start); the billow lingers, is blown out of the pane and the last
//                         wisp leaves just before his head arrives; he stares at the empty blue sky…
//   shelley_cu #3  28.46  …and is still sinking back down INTO the close-up as he starts
//                         "…We're out of time." (the side-table hourglass runs out on "time").
//   office_wide #3 30.91  two-shot: "That'll be… forty oranges." — Barry's shock take a beat after
//                         "forty" (glasses knocked askew, Gerald jolted), then "Forty oranges? That's
//                         two oranges a word!" with the paw going; Shelley does not move a muscle.
//   shelley_cu #4  36.80  tight button: "…Forty-two." — then a slow, smug settle into a smirk.
'use strict';

const K = require('../lib/kit');
const U = require('../lib/util');

const { clamp, lerp } = U;

// ───────────────────────────────────────────────────────────── timing helpers
const win = (t, a, b, fi = 0.2, fo = 0.2) => (b > a ? K.fadeWindow(t, a, b, fi, fo) : 0);
const rampE = (t, t0, dur, fn = 'inOutSine') => K.ramp(t, t0, dur, fn);
function addW(w, k, v) { if (v > 0) w[k] = (w[k] || 0) + v; }
// blend a mood weight map toward `mood` by k (0..1)
function towardMood(w, mood, k) {
  k = clamp(k);
  if (k <= 0) return w;
  const r = {};
  for (const n in w) addW(r, n, w[n] * (1 - k));
  addW(r, mood, k);
  return r;
}
const lerpLook = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });
const clampLook = (l) => ({ x: clamp(l.x, -1, 1), y: clamp(l.y, -1, 1) });

// every timing of the scene, resolved once per timeline (derived from S only → pure)
const MEMO = new WeakMap();
function times(S) {
  let m = MEMO.get(S.tl);
  if (m) return m;
  const L = S.lines().slice().sort((a, b) => a.ls - b.ls);
  const by = (who, n) => L.filter((l) => l.char === who)[n];
  const wt = (line, w, n = 0, d = 0) => { const v = K.wordTime(S, line, w, n); return (v == null ? line.ls : v) + d; };
  m = {
    intro: by('barry', 0),        // "This is Doctor Shelley…"
    bench: by('barry', 1),        // "Doc, a vulture is using my head as a bench…"
    inRoom: by('shelley', 0),     // "Is this vulture… in the room with us… right now?"
    onHead: by('barry', 2),       // "He's on my head!"
    hello: by('gerald', 0),       // "Hello."
    hello2: by('shelley', 1),     // "...Hello."
    catas: by('shelley', 2),      // "You're... catastrophizing."
    turnAround: by('barry', 3),   // "Doc. Turn around."
    outOfTime: by('shelley', 3),  // "...We're out of time."
    forty: by('shelley', 4),      // "That'll be... forty oranges."
    twoAWord: by('barry', 4),     // "Forty oranges? That's two oranges a word!"
    fortyTwo: by('shelley', 5),   // "...Forty-two."
    writes: K.beat(S, 'shelley_writes'),
    puffT: S.cue('window_puff'), puffDur: S.cueDur('window_puff'),
    turnT: S.cue('shelley_turns'), turnDur: S.cueDur('shelley_turns'),
  };
  m.wTortoise = wt(m.intro, 'tortoise', 0, -0.25);
  m.wAlmost = wt(m.intro, 'almost', 0, -0.1);
  m.wVulture = wt(m.bench, 'vulture');
  m.wBench = wt(m.bench, 'bench');
  m.wCrazy = wt(m.bench, 'crazy', 0, -0.2);
  // Shelley's phrases, read off the lip-sync envelope (the pauses ARE the performance)
  m.wRoom = m.inRoom.ls + 1.83;        // "…in the room with us…"
  m.wRight = m.inRoom.ls + 3.58;       // "…right now?"
  m.wForty = m.forty.ls + 1.58;        // "…forty oranges." after "That'll be…"
  // the swivel (shelley_turns): eyes open, a beat, a glacial crane up, a stare, sinks back down
  const T0 = m.turnT;
  m.turnUp0 = T0 + 0.3; m.turnUp1 = T0 + 1.96;
  m.turnDn0 = T0 + 2.2; m.turnDn1 = m.outOfTime.ls + 0.2;
  // the window puff (env.puff): formed over window_puff, lingers through the cut-away, and is blown
  // out of the pane during the crane so the LAST wisp leaves just before his head arrives
  const a = m.puffT, ad = m.puffDur;
  m.puffKeys = [[a, 0], [a + ad, 0.55], [T0 - 0.001, 0.6], [T0, 0.62], [T0 + 0.95, 0.69],
    [T0 + 1.38, 0.84], [T0 + 1.6, 0.95], [T0 + 2.0, 1]];
  // the hourglass on the side table runs out exactly on "time"
  m.sandEnd = wt(m.outOfTime, 'time', 0, 0.05);
  // Shelley's 1.5 s slow blinks, PLACED (per-shot clock offsets, see shelleyClock)
  m.cams = S.tl.cams.filter((c) => c.scene === S.id).map((c) => c.time - S.scene.start);
  const blinkAt = [
    m.cams[1] + 0.05,               // 0 office_wide   — none (lands in the cut-away)
    null, m.wRight - 1.1,           // 2 shelley_cu    — "…in the room with us… [blink] …right now?"
    m.hello.le - 0.3,               // 3 office_wide   — the pause between "Hello." and "...Hello."
    m.cams[5] + 0.05,               // 4 shelley_cu    — none: eyes on the pad, then on Barry
    m.cams[6] + 0.05,               // 5 window        — none (eyes shut in bliss anyway)
    null, m.cams[8] + 0.05,         // 7 window        — none: the swivel
    m.cams[9] + 0.05,               // 8 shelley_cu    — none: "We're out of time."
    m.twoAWord.ls + 0.7,            // 9 office_wide   — impassive, through Barry's rant
    S.duration + 0.05,              // 10 shelley_cu   — none: the button
  ];
  m.clock = blinkAt.map((b) => (b == null ? 0 : blinkDelta(S.scene.start + b)));
  MEMO.set(S.tl, m);
  return m;
}
// critters' tortoise eye: blinkAmt(t, 6.5, 1.5, seed .61) — a blink STARTS when t/6.5 + .61 is an
// integer n, unless hash1(n + .61·7.3) < .18 (skipped). Returns the clock offset that starts one at T.
const SH_PHASE = 3.3;                       // kit PHASE.shelley (shelleyOpts' t = S.T + 3.3)
function blinkDelta(T) {
  const base = T + SH_PHASE;
  let n = Math.ceil(base / 6.5 + 0.61);
  for (let k = 0; k < 8; k++, n++) if (U.hash1(n + 0.61 * 7.3) >= 0.18) return (n - 0.61) * 6.5 - base;
  return 0;
}
// Shelley's idle clock: per shot (he is off-screen in both barry_couch shots, and a cut hides the
// breathing-phase change), offset so his slow blinks land on the beats above and nowhere else
function shelleyClock(S, M) {
  return S.T + SH_PHASE + (M.clock[K.shot(S).index] || 0);
}

// ───────────────────────────────────────────────────────────── Shelley
function shelleyTurn(t, M) {
  if (t <= M.turnUp0 || t >= M.turnDn1) return 0;
  if (t < M.turnUp1) return Math.pow(clamp((t - M.turnUp0) / (M.turnUp1 - M.turnUp0)), 1.6);  // glacial start
  if (t < M.turnDn0) return 1;
  return 1 - clamp((t - M.turnDn0) / (M.turnDn1 - M.turnDn0));     // the rig eases it (inOutSine)
}
function shelleyCfg(S, t, M) {
  let mood = K.moodAt(S, 'shelley').weights;
  let neck = 0;
  let look = null;          // null → the kit's gaze (speaker / addressee)
  // "Is this vulture… in the room with us… right now?" — the slow therapist lean-in, one notch per phrase
  const L33 = M.inRoom;
  neck += 0.15 * rampE(t, L33.ls + 0.1, 1.1) + 0.13 * rampE(t, M.wRoom - 0.2, 1.2) + 0.14 * rampE(t, M.wRight - 0.3, 0.9);
  neck *= 1 - rampE(t, L33.le + 0.4, 1.6);
  // Gerald's "Hello.": he stares at the vulture (eye level) through the pause; "...Hello." + a glacial nod
  const H = M.hello, H2 = M.hello2;
  const stareK = win(t, M.onHead.le - 0.05, H2.le + 0.25, 0.14, 0.3);
  if (stareK > 0) look = lerpLook({ x: 0.55, y: 0.2 }, { x: 0.95, y: 0.02 }, stareK);
  neck += 0.3 * K.bump(t, H2.ls + 0.1, 1.6);
  // the writing (shelley_writes, synced to paper_scribble): head down to the pad, then looks up
  const W = M.writes;
  const writeK = win(t, W.t0 - 0.3, W.t1 + 0.15, 0.3, 0.3);
  neck += 0.3 * writeK;
  if (writeK > 0) look = lerpLook(look || { x: 0.55, y: 0.15 }, { x: 0.35, y: 1 }, writeK);
  // "You're... catastrophizing." → window_puff: self-satisfied, eyes closing in bliss;
  // shelley_turns: the eyes open again (slowly) before anything else moves
  const blissK = rampE(t, M.catas.le + 0.15, 1.0) * (1 - rampE(t, M.turnT + 0.02, 0.32));
  mood = towardMood(mood, 'happy', 0.92 * blissK);
  neck -= 0.1 * blissK;
  // at the top of the swivel: a flat, unimpressed look at the clear blue sky
  const topK = win(t, M.turnUp1 - 0.3, M.turnDn0 + 0.3, 0.25, 0.3);
  mood = towardMood(mood, 'deadpan', 0.6 * topK);
  // the last button: "...Forty-two." then a slow, smug settle into a smirk
  const F = M.fortyTwo;
  mood = towardMood(mood, 'smug', 0.8 * rampE(t, F.le + 0.1, 0.65));
  const out = { t: shelleyClock(S, M), mood, neck: clamp(neck, -1, 1), turn: shelleyTurn(t, M) };
  if (look) out.look = clampLook(look);
  // the note: "NUTS", written in sync with the scribble, then underlined twice
  if (t >= W.t0 - 0.05) { out.note = 'NUTS'; out.write = clamp((t - W.t0) / W.dur); }
  return out;
}

// ───────────────────────────────────────────────────────────── Barry
// paw targets (rig-local, pre-scale; x → toward the snout, y → down): every gesture stays IN FRONT
// of the snout so the forearm never crosses his face
const PAW = { palm: { x: 156, y: 12 }, jab: { x: 146, y: -54 }, point: { x: 146, y: -44 } };
function barryCfg(S, t, M, base) {
  const rest = [[0, 'worried'], [M.hello2.ls - 0.1, 'deadpan'], [M.catas.ls, 'worried']];
  const e = { rest };
  const look0 = base.look || { x: 0.3, y: 0 };
  let look = null, tilt = 0, pawUp = 0, pawAt = null, headTurn = null, mood = null;
  // 1) direct address: the eyes slide over to Shelley on "He's a tortoise." and back to us
  const tortK = win(t, M.wTortoise, M.wAlmost, 0.18, 0.22);
  if (tortK > 0) look = lerpLook({ x: 0, y: 0 }, { x: 1, y: 0.08 }, tortK);
  // 2) "a vulture… using my head as a bench" — eyes roll up at Gerald, then back to the doc
  const upK = win(t, M.wVulture + 0.05, M.wCrazy - 0.1, 0.16, 0.2);
  if (upK > 0) look = lerpLook(look || look0, { x: 0.15, y: -1 }, upK);
  //    "…and I'm the crazy one?" — the paw comes out in front of him, palm up, a little pump
  const crazyK = win(t, M.wCrazy, M.bench.le + 0.3, 0.22, 0.35);
  if (crazyK > 0) {
    pawUp = 0.9 * crazyK;
    pawAt = { x: PAW.palm.x, y: PAW.palm.y - 7 * Math.abs(Math.sin((t - M.wCrazy) * 6.5)) };
    tilt += 4 * crazyK;
  }
  // 3) "He's on my head!" — a take, the head up, the paw jabbing upward
  const oh = M.onHead;
  const jabK = win(t, oh.ls - 0.04, oh.le + 0.35, 0.12, 0.3);
  if (jabK > 0) {
    pawUp = Math.max(pawUp, jabK);
    pawAt = { x: PAW.jab.x, y: PAW.jab.y + 9 * Math.abs(Math.sin((t - oh.ls) * 11)) };
    look = lerpLook(look || look0, { x: 0.1, y: -1 }, jabK);
    tilt += 10 * jabK;
  }
  let squash = K.take(t, oh.ls + 0.02, { amount: 0.8 });
  // Gerald's "Hello." → Barry's eyes go up to him (kit); "...Hello." → he slowly turns to us:
  // can you believe this guy?
  const H2 = M.hello2;
  const toUs = rampE(t, H2.ls + 0.3, 0.5) * (1 - rampE(t, M.catas.ls - 0.6, 0.4));
  if (toUs > 0) headTurn = toUs;
  // 4) "Doc. Turn around." — eyes locked on the window, paw pointing at it, urgent
  const ta = M.turnAround;
  const urgeK = win(t, ta.ls - 0.3, ta.le + 0.6, 0.15, 0.3);
  if (urgeK > 0) {
    look = lerpLook(look || look0, { x: 0.85, y: -0.8 }, urgeK);
    const ptK = win(t, ta.ls + 0.15, ta.le + 0.6, 0.18, 0.3);
    pawUp = Math.max(pawUp, ptK);
    pawAt = { x: PAW.point.x, y: PAW.point.y + 6 * Math.sin((t - ta.ls) * 9) };
    tilt += 7 * urgeK;
    mood = towardMood(K.moodAt(S, 'barry', rest).weights, 'panic', 0.35 * urgeK);
  }
  // 5) "forty oranges" — the shock take a beat after "forty" (glasses fly askew), then the rant
  const tk = M.wForty + 0.24;
  const fK = rampE(t, tk - 0.05, 0.1, 'outQuad') * (1 - rampE(t, M.twoAWord.ls + 0.3, 0.35));
  if (fK > 0) mood = towardMood(K.moodAt(S, 'barry', rest).weights, 'shock', fK);
  const ft = K.take(t, tk, { amount: 1.15 });
  const tw = M.twoAWord;
  const rantK = win(t, tw.ls + 0.1, tw.le + 0.4, 0.2, 0.4);
  if (rantK > 0) {
    pawUp = Math.max(pawUp, rantK);
    const b = Math.sin((t - tw.ls) * 8.5);
    pawAt = { x: lerp(PAW.palm.x, PAW.jab.x, 0.5 + 0.5 * b), y: lerp(PAW.palm.y, PAW.jab.y + 10, 0.5 + 0.5 * b) };
    tilt += 8 * rantK;
  }
  // takes combine multiplicatively; identity outside both
  const sq = { sx: squash.sx * ft.sx, sy: squash.sy * ft.sy, dy: (squash.dy || 0) + (ft.dy || 0) };
  if (Math.abs(sq.sx - 1) > 1e-4 || Math.abs(sq.sy - 1) > 1e-4 || Math.abs(sq.dy) > 1e-4) e.squash = sq;
  if (look) e.look = clampLook(look);
  if (headTurn != null) e.headTurn = clamp(headTurn);
  if (mood) e.mood = mood;
  if (pawUp > 0.001) { e.pawUp = clamp(pawUp); e.pawAt = pawAt || PAW.palm; }
  if (tilt) e.tiltAdd = tilt;
  return e;
}

// ───────────────────────────────────────────────────────────── Gerald
function geraldCfg(S, t, M) {
  const g = { on: 'barry' };
  // "…using my head as a bench" — he settles onto Barry like a park bench, with a fluff, and stays
  const settleK = rampE(t, M.wBench - 0.05, 0.8, 'outCubic');
  const fluff = K.bump(t, M.wBench + 0.05, 0.75);
  // the jolts: "He's on my head!" and the "forty" take — grips, bristles, half-unsettles
  const jolt = Math.max(K.bump(t, M.onHead.ls - 0.02, 0.8), K.bump(t, M.wForty + 0.2, 0.85));
  g.settle = clamp(0.78 * settleK * (1 - 0.65 * jolt));
  g.grip = clamp(1.1 * jolt);
  g.ruffle = clamp(Math.max(0.9 * jolt, 0.45 * fluff));
  g.crouch = clamp(0.35 * fluff);
  // …and enjoys it: a contented closed-eye moment, like a man lowering himself into a warm bath
  const comfy = K.bump(t, M.wBench + 0.15, 1.7);
  if (comfy > 0) g.mood = towardMood(K.moodAt(S, 'gerald').weights, 'happy', 0.95 * Math.min(1, comfy * 1.6));
  // nods: to the doctor at "He's a tortoise.", the courtly "Hello.", and once more at "...Hello."
  g.nod = clamp(Math.max(
    0.5 * K.bump(t, M.wTortoise + 0.4, 0.7),
    K.bump(t, M.hello.ls + 0.05, 0.85),
    0.55 * K.bump(t, M.hello2.le - 0.1, 0.8),
  ));
  // direct address: he looks out at us as well (a beat after Barry), then at the doc on "tortoise"
  const camK = win(t, M.intro.ls + 0.6, M.wTortoise + 0.1, 0.35, 0.25);
  let look = null;
  if (camK > 0) look = { x: lerp(0.5, -0.05, camK), y: lerp(0.45, 0.05, camK) };
  // "Doc. Turn around." — he calmly follows Barry's eyes to the window (a vulture knows that sign)
  const ta = M.turnAround;
  const winK = win(t, ta.ls + 0.25, ta.le + 0.5, 0.3, 0.3);
  if (winK > 0) look = lerpLook(look || { x: 0.4, y: 0.4 }, { x: 1, y: -0.55 }, winK);
  if (look) g.look = clampLook(look);
  return g;
}

// ───────────────────────────────────────────────────────────── framings
// cams list: 0 office_wide · 1 barry_couch · 2 shelley_cu · 3 office_wide · 4 shelley_cu · 5 window ·
//            6 barry_couch · 7 window · 8 shelley_cu · 9 office_wide · 10 shelley_cu
const EYE_S = { x: 931.6, y: 349.6 };      // Shelley's eye at rest (turn 0, neck 0)
const FRAMINGS = {
  office_wide: (I) => {
    const i = I.shot.index;
    if (i === 0) return { x: 640, y: 372, zoom: 0.98, push: 0.004 };       // establishing (fade-in)
    if (i === 3) return { x: 668, y: 404, zoom: 1.28, push: 0.006 };       // the "Hello." exchange
    return { x: 664, y: 408, zoom: 1.24, push: 0.008 };                     // the bill
  },
  barry_couch: (I) => {
    const b = I.L && I.L.chars.barry;
    const ex = b ? b.eye.x : 422, ey = b ? b.eye.y : 452;
    if (I.shot.index === 1) return { x: ex + 32, y: ey - 22, zoom: 2.6, push: 0.005 };   // to-camera: face centred
    return { x: ex + 66, y: ey - 30, zoom: 2.5, push: 0.012 };                          // lead room → window
  },
  shelley_cu: (I) => {
    const i = I.shot.index;
    if (i === 4) return { x: EYE_S.x + 10, y: 398, zoom: 2.9, push: 0.006 };   // head + notepad (NUTS)
    if (i === 8) return { x: 884, y: 396, zoom: 2.2, push: 0.004 };             // + the hourglass
    if (i === 10) return { x: EYE_S.x - 16, y: EYE_S.y + 28, zoom: 3.9, push: 0.012 }; // the button: his face (+ NUTS)
    return { x: EYE_S.x + 2, y: EYE_S.y + 27, zoom: 2.8, push: 0.009 };        // "in the room with us"
  },
  window: { x: 912, y: 286, zoom: 2.05, push: 0.004 },
};

module.exports = {
  render(ctx, t, S) {
    const M = times(S);
    const bBase = K.castOpts(S, 'barry', {});
    K.drawOfficeStage(ctx, t, S, {
      env: { hourglass: clamp(0.3 + 0.7 * (t / Math.max(1, M.sandEnd))), oranges: 6 },
      puff: M.puffKeys,
      shelley: shelleyCfg(S, t, M),
      cast: { barry: barryCfg(S, t, M, bBase) },
      gerald: geraldCfg(S, t, M),
      framings: FRAMINGS,
    });
  },
};
