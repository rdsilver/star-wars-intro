// CHILL CAPYBARA — s10_end (5:00.77–5:08.57): Woody-Allen end cards over black, cut to the
// jazz_end reprise. Bookends s02_title: the same white Yeseva cards on pure black, no camera and
// no motion. The deadpan IS the joke, so the only "animation" is timing.
//
//   end_card            (0.00–1.90)  smash cut on the reprise's first hit: 'CHILL CAPYBARA'
//                                    (identical type to s02's title), then 'THE END' on the
//                                    tune's first downbeat (F6 chord, +1.039 s).
//   end_credit_volcano  (1.90–4.20)  new card on the clarinet's long F5 (+1.895):
//                                    'MOUNT SNOOZE' / 'appeared as itself', then
//                                    '(no longer dormant)' on the next downbeat (D7, +3.126), i.e.
//                                    1.23 s after the card, the same rhythm and the same spacing
//                                    as s02's '(dormant)' afterthought (gap 64).
//   end_credit_fish     (4.20–7.30)  new card on the drum beat (+4.17): 'No fish were harmed in
//                                    the / making of this film.' A blank line later 'They left
//                                    early.' lands on beat 2 of bar 3 (clarinet D5, +5.735), 1.5 s
//                                    to read the stock phrase. The 'ba-DUM' button (+7.3) is a
//                                    hard cut to black, and the ring-out plays over black.
//                                    render.js fades the last scene's final 1.0 s, so the card
//                                    dims to about 50 % over the half second before the button.
//
// The beats are derived from the button (end of end_credit_fish), which is how music.py places
// jazz_end: 115 bpm, 4/4, the button on a downbeat (music_anchors: downbeats 1.039, 3.126,
// 5.213, 7.300). Every cut and reveal is frame-quantised. A new card shows on the frame NEAREST
// its cue, with a one-frame 55 % softening (as in s02) except the smash cut, which is full on
// its first frame. A reveal is 45 % on the frame before its beat and full on the beat frame, so
// it reads as on the hit.
//
// Card 1 options (decided by rendering both, build/review/s10_card1_{woody,groovy}.png):
// env_other's 'groovy' end title is charming, but its sun, letter pops and orange drop need
// about 3 s and would have to run at 1.6x inside this 1.9 s beat. Its capybara also wears an
// orange, which contradicts Barry's last state (helmet on, orange off), and its purple sunset
// card makes the hard cut to the plain black credit cards look like a different film. The
// white serif card rhymes with s02 and keeps the whole run deadpan, as the screenplay asks.
'use strict';
const { drawTitleCard } = require('../lib/env_other');

const FPS = 24;
const BPM = 115;                 // jazz_end tempo for this cue length (music.music_anchors)
const BAR = 240 / BPM;           // 2.087 s
const BEAT_S = 60 / BPM;         // 0.522 s
const CUT_SOFT = 0.55;           // alpha of a new card's first frame (s02 cut softening)
const PRE_HIT = 0.45;            // alpha of a reveal one frame before its beat

const CARD1 = [
  { text: 'CHILL CAPYBARA', size: 74 },              // = s02 title_card
  { text: 'THE END', size: 40, gap: 72 },
];
const CARD2 = [
  { text: 'MOUNT SNOOZE', size: 62 },                // = s02 credit's name line
  { text: 'appeared as itself', size: 40 },
  { text: '(no longer dormant)', size: 40, gap: 64 },  // = s02 '(dormant)' spacing
];
const CARD3 = [
  { text: 'No fish were harmed in the\nmaking of this film.', size: 44 },
  { text: 'They left early.', size: 44, gap: 104 },   // one blank line of air: the beat
];

function drawCard(ctx, lines, alphas) {
  const o = {
    style: 'woody',
    bg: false,
    lines: lines.map((l, i) => {
      const a = Math.max(0, Math.min(1, alphas[i] || 0));
      // layout always includes every line (late lines never shift the others); hidden = alpha 0
      return { ...l, color: `rgba(255,255,255,${a.toFixed(3)})` };
    }),
  };
  drawTitleCard(ctx, 0, o);
}

module.exports = {
  render(ctx, t, S) {
    const start = S.scene.start;
    const cur = Math.round(S.T * FPS);                       // global frame being drawn
    const frameOf = (lt) => Math.round((start + lt) * FPS);  // frame nearest scene time lt
    const reveal = (lt) => {
      const d = cur - frameOf(lt);
      return d >= 0 ? 1 : d === -1 ? PRE_HIT : 0;
    };
    const cutIn = (lt) => (cur === frameOf(lt) ? CUT_SOFT : 1);

    const c2 = S.cue('end_credit_volcano');
    const c3 = S.cue('end_credit_fish');
    const button = c3 + S.cueDur('end_credit_fish');        // 7.300: the 'ba-DUM' downbeat
    const theEnd = button - 3 * BAR;                         // 1.039: tune's first downbeat
    const dormant = button - 2 * BAR;                        // 3.126: D7 downbeat
    const early = button - BAR + BEAT_S;                     // 5.735: beat 2 of bar 3

    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(-20, -20, 1320, 760);
    if (cur >= frameOf(button)) {
      // cut to black on the button; the ring-out plays over black
    } else if (cur >= frameOf(c3)) {
      const a = cutIn(c3);
      drawCard(ctx, CARD3, [a, a * reveal(early)]);
    } else if (cur >= frameOf(c2)) {
      const a = cutIn(c2);
      drawCard(ctx, CARD2, [a, a, a * reveal(dormant)]);
    } else {
      drawCard(ctx, CARD1, [1, reveal(theEnd)]);            // smash cut: full on frame one
    }
    ctx.restore();
  },
};
