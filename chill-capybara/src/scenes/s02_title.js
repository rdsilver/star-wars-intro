// CHILL CAPYBARA — s02_title (0:21.6–0:26.5): Woody-Allen-style title cards over black.
//
//   title_card   (2.4 s)  'CHILL CAPYBARA' — tracked white Yeseva caps, dead centre.
//   title_credit (2.2 s + 0.3 tail)  a NEW card: 'with' / 'MOUNT SNOOZE' / 'as itself', and then,
//                one bar-beat later, the parenthetical '(dormant)' on its own line — the setup for
//                s10's '(no longer dormant)' (same layout family as env_other's s10 volcano card).
//
// Staging: no camera, no motion — the homage is a dead-static card. Each card cuts in on its beat
// with a 2-frame softening (CARD_FADE) so the cut reads crisp but never pops; the card change
// therefore shows one near-black frame, i.e. a clean "new card" cut. Timing against build/audio.wav
// (jazz_title, ~115 bpm, measured onsets): the first card is full on the 2nd frame after the
// opening hit (≈21.604 s); '(dormant)' rises on the 4th beat of bar 2 (hit ≈ 25.220 s, scene
// +3.63 s), i.e. ~1.2 s after the credit card appears — time to read the setup, then the button.
// Card 2 holds through the tail and hard-cuts into s03 (the spring's colour is the next joke).
'use strict';
const { drawTitleCard } = require('../lib/env_other');

const CARD_FADE = 0.05;      // s: crisp fade-in at the cut (≈½ on the first frame, full on the 2nd)
const DORMANT_AT = 1.185;    // s after title_credit: '(dormant)' lands on the jazz beat (hit ≈25.220 s)
const DORMANT_FADE = 0.07;   // s: ≈45 % on frame 605 (just before the hit), full on frame 606

const TITLE = { style: 'woody', lines: [{ text: 'CHILL CAPYBARA', size: 74 }], fadeIn: CARD_FADE };
const CREDIT = {
  style: 'woody',
  fadeIn: CARD_FADE,
  lines: [
    { text: 'with', size: 36 },
    { text: 'MOUNT SNOOZE', size: 62 },
    { text: 'as itself', size: 40 },
    { text: '(dormant)', size: 40, gap: 64, at: DORMANT_AT, fade: DORMANT_FADE },  // +10 units of air: an afterthought
  ],
};

module.exports = {
  render(ctx, t, S) {
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(-20, -20, 1320, 760);
    const c1 = S.cue('title_card');
    const c2 = S.cue('title_credit');
    if (t >= c2) drawTitleCard(ctx, t - c2, CREDIT);
    else if (t >= c1) drawTitleCard(ctx, t - c1, TITLE);
    ctx.restore();
  },
};
