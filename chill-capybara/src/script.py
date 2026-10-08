"""CHILL CAPYBARA -- final shooting script (showrunner polish).

Same format as DESIGN.md section 2. This file is the single source of truth.
Chassis: draft_larry (judges' winner). Grafts from draft_woody and draft_punch,
then a final polish pass against the jokes / payoff / producibility critics.
Measured with real TTS (build_audio.py --timeline-only): 308.56s = 5:08.6, 89 lines, 593 words.

Barry is a Larry David grievance machine with a Woody Allen inner life. Every
"neurotic" observation is correct, and every one is paid off in the eruption.

CALLBACK MAP
  SETUP                                          PAYOFF
  s01 "Who's been touching the thermostat?" 39.4 s03 chart + "Then who's touching it?"; s04 39.8 "It went up
                                                 while you were reassuring me!"; s07 bulb pops; s08 "...The
                                                 mountain."; s09 Sunny asks it, Barry answers with Sunny's line
  s01 narrator "Nothing... bothers the           s05 direct address "We're almost up to my childhood."; s09
      capybara." / "Almost nothing." / "I heard      bookend: narrator repeats "Nothing... bothers the capybara.",
      that." (Barry hears the narrator)              the hill sneezes, and Barry -- chill AND right -- says the
                                                     narrator's correction himself: "Almost nothing."
  s01 orange grove on Mount Snooze (visual)      s04 an orange rolls down from the grove: "See? The mountain
  s03 "And where do the oranges even come from?      provides."; s07 the eruption rains oranges ("Free oranges!"
      Nothing is free, Doreen!"                      "Nothing is free!" + rock bonk)
  s03 tradition / orange on your head            s07 the ONE time Barry wears an orange ("Fine. One orange. I won't
                                                 enjoy it." -> "Oh. Oh, wow."), it erupts ("Twelve seconds. I was
                                                 chill for twelve seconds." -- eyes closed ~12s on the timeline)
  s03 "Bro. Chill." / "I have glasses."          s07 "So this is chill?"; rock bonks the helmet, glasses don't slip;
                                                 s08 "Am I chill?" "Welcome to chill, bro."
  s03 Doreen "I had a thought once. Back in      s07 eruption: "Oh no. I'm having a thought! I don't care for it!";
      March. Didn't care for it."                    s09 she studies Barry's old chart board, worried
  s03 "You sit on a guy, you introduce           s06 SPRING RULES sign "1. Introduce yourself"; s09 Gerald glances
      yourself!" / "Gerald." / "Thank you! Was        at rule 1 and introduces himself to Sunny
      that so hard?"                             s07 "See? A proper goodbye. Was that so hard?"; s08 "The mountain!
                                                 Thank you! Was that so hard?" (third time)
  s03 "That's not affection, Doreen. That's a    s08 "And why was a vulture on my head?" "...The mountain, bro." ->
      reservation." / "Oh... no reason." / "You      Gerald: "Rather a clear sign, I thought." -> Doreen thanks HIM
      know who says no reason? Somebody with a       (stolen thank-you) -> "All he ever said was no reason!";
      reason!"                                       s09 Gerald tells Sunny "no reason", Barry straps on the helmet:
                                                     "No reason." -> everyone bolts
  s03 Doreen "Aw. He likes you."                 s09 Barry says it to Sunny
  s04 fish pack and leave over the LEFT rocks,   s06 rule "2. Say goodbye"; s07 Gerald's perfect goodbye = the alarm
      "not one of them said goodbye" / "unless       ("Lovely knowing you" -> "Knowing? Past tense? Why is he saying
      they smell smoke!"                             goodbye?"); s08 "Oh, now they wave."; s10 card "They left early."
  s04 "It's been asleep for a thousand years."   s07 eruption; s02 card "(dormant)" -> s10 card "(no longer dormant)";
      / "Exactly! It's well rested!" + sneeze        s09 a gentle hill does the exact same sneeze (hill_sneeze)
  s05 "You're... catastrophizing." / window      s05 "Doc. Turn around." -> shelley_turns (the smoke clears just
      puff behind Shelley                            before his eye gets there) -> "...We're out of time."; s08 opens
                                                     on "Is it still catastrophizing if there's a catastrophe?"
  s05 Shelley talks... very... slowly; "forty    s05 "That's two oranges a word!" -> "...Forty-two." (one more word,
      oranges"                                       two more oranges); s08 "Could you say it slower? Like Doctor
                                                     Shelley?" -> "You... were... right... bro." (Sunny's line is
                                                     rendered at Shelley's own TTS speed, 0.72)
  s06 signs (incl. "YES, YOU, SUNNY", own beat)  s07 "Follow the signs! I made signs!" -> "Aw. He made me a sign."
  s06 helmet mocked / "I'm not paranoid. I'm     s07 rock bonks off the helmet: "Should've worn a helmet!";
      early."                                        s09 the helmet is the final button
  s06 Gerald test-bounces the raft               s07 he is already on it: "Took your time."; s08 he takes the credit
  s06 flag "S.S. TOLD YOU SO"                    s08 gerald_covers_flag (own shot): Gerald sits on it, it reads "S.S."

NOTES FOR THE ENV / ANIMATION TEAMS
  * spring_day + spring_evening need a small ORANGE GROVE (3-4 little round trees with
    orange dots) on Mount Snooze's lower-left green flank, ~ (680-760, 330-380), visible
    in every wide, with an o.groveShake 0..1 option and an anchor SPRING.grovePos
    ~ {x:720, y:350}: spawn point for s04 orange_rolls and s07 orange_rain.
  * SPRING RULES sign: SPRING.rulesSignPos ~ {x:600, y:448} on the back bank between the
    trio and the volcano (readable behind every s07 trio shot, clear of the lava entry).
    Gerald perches on its TOP EDGE so the three rules stay readable.
  * Trio blocking is fixed for the whole film: Sunny left (facing right), Barry centre,
    Doreen right (facing left). In close-ups Barry turns with look.x / headTilt, never
    by flipping, so the cut doesn't jump.
  * Thermometer readings (drawThermometer reading): s01 "39.4", s04 "39.8",
    s07 pops, s09 Sunny's reads "39.2". Barry's s03 chart = little board on a stick.
  * Direct address = s01 beat barry_to_camera and s05 cue barry_to_camera: drive
    headTurn toward 1, hold for the next line, then ease back. No line uses to="camera".
  * s05: Gerald perches on Barry's head while Barry is in pose 'lie' on the couch.
    window_puff and shelley_turns share the 'window' framing (Shelley in the
    foreground, round window behind him).
  * s07 ends on raft_launch (music fades). s08 opens on Barry's raft close-up in the
    river_sunset set, so no scrolling-river background is needed in spring_evening.
  * s09 new_spring needs ONE gentle hill with a smoke-puff overlay for hill_sneeze
    (reuse the s04 volcano_sneeze puff drawing), and the SPRING RULES sign visible
    behind the trio.
  * Leading "..." in a line does nothing in this pipeline (edge silence is trimmed);
    reluctant pauses are written as gap= or pause instead.
  * Per-line speed overrides (DESIGN section 2; CAST entries unchanged): chill Barry 0.98
    (s08 "Am I chill?", s09), worried Sunny 1.02 (s09 "Barry..." lines), and Sunny's
    s08 Shelley impression at 0.72.
  * The sfx bus is not ducked under dialogue: s07 rumble_big / boil are pre-attenuated
    (gain 0.5 / 0.6) so "Twelve seconds..." stays on top.
  * Max 6 camera names per scene.
"""

CAST = {
    "narrator": dict(voice="bm_fable", speed=0.92, name="NARRATOR", color="#E8E8E8"),
    "barry": dict(voice="am_fenrir", speed=1.12, name="BARRY", color="#FFD27A"),
    "sunny": dict(voice="am_onyx", speed=0.90, name="SUNNY", color="#9FE3A8"),
    "doreen": dict(voice="af_heart", speed=0.95, name="DOREEN", color="#FFB0C8"),
    "gerald": dict(voice="bm_george", speed=0.95, name="GERALD", color="#C9B8FF"),
    "shelley": dict(voice="bm_lewis", speed=0.72, name="DR. SHELLEY", color="#A8D8FF"),
}

SCENES = [
    # ------------------------------------------------------------------ COLD OPEN
    dict(id="s01_open", setting="spring_day", music="lounge", events=[
        ("cam", "establishing"),
        ("cue", "orange_grove", "Wide on Snooze Springs: the steaming pool, the 'SNOOZE SPRINGS -- No Worries Allowed' sign, and Mount Snooze behind it with a little grove of orange trees on its lower-left green flank. A faint wisp of smoke from the crater"),
        ("pause", 0.6),
        ("say", "narrator", "The capybara. The calmest animal on Earth."),
        ("cam", "extras"),
        ("cue", "extras_chill", "Background capybaras doze in the water, eyes shut: a little bird perches on one's head, another wears an orange as a hat. Nobody moves"),
        ("say", "narrator", "Birds perch on it. It wears an orange as a hat. And it never asks why."),
        ("cam", "establishing_push"),
        ("say", "narrator", "Nothing... bothers the capybara.", dict(gap=0.4)),
        ("pause", 0.3),
        ("cam", "barry_cu"),
        ("beat", "barry_reveal", 1.1, "Barry -- thick round glasses, frazzled tuft -- lifts a thermometer out of the water and squints at it (reading 39.4 visible on it). He speaks with it still held up"),
        ("say", "barry", "Thirty-nine point four. Okay. Who's been touching the thermostat?", dict(mood="worried", gap=0.15)),
        ("sfx", "record_scratch"),
        ("music", None, dict(fade=0.05)),
        ("pause", 0.5),
        ("say", "narrator", "Almost nothing.", dict(gap=0.2)),
        ("beat", "barry_to_camera", 0.9, "Barry slowly turns his face to camera (headTurn 0 -> 1 over 0.5s) and holds the stare"),
        ("say", "barry", "I heard that.", dict(mood="deadpan", gap=0.1)),
        ("pause", 0.3),
    ]),
    dict(id="s02_title", music_gain=1.45, music_fade=0.02, setting="title", music="jazz_title", tail=0.3, events=[
        ("beat", "title_card", 2.4, "White Yeseva serif 'CHILL CAPYBARA' centred on black, Woody-Allen style"),
        ("beat", "title_credit", 2.2, "Second card, same style, smaller: 'with MOUNT SNOOZE as itself (dormant)'"),
    ]),

    # ------------------------------------------------------- THE PETTY GRIEVANCES
    dict(id="s03_spring", setting="spring_day", music="lounge", tail=0.7, events=[
        ("cam", "barry_cu"),
        ("beat", "barry_chart", 1.6, "A little board on a stick (drawChart, progress 0->1) is planted in the rim rock beside Barry's head, facing camera: a hand-drawn graph of the water temperature zigzagging upward to a frowny face. Barry taps it twice with his snout, looking toward Sunny"),
        ("cam", "sunny_cu"),
        ("say", "sunny", "Bro. There's no thermostat. It's a natural spring.", dict(mood="chill", to="barry")),
        ("cam", "barry_cu"),
        ("say", "barry", "Then who's touching it?", dict(mood="worried", to="sunny", gap=0.2)),
        ("cam", "trio"),
        ("cue", "doreen_offers_orange", "Doreen nudges a spare orange across the water toward Barry with her snout (during her line)"),
        ("say", "doreen", "Honey, put an orange on your head.", dict(mood="chill", to="barry")),
        ("say", "barry", "Who decided oranges go on our heads?", dict(mood="worried", to="doreen", gap=0.2)),
        ("cam", "sunny_cu"),
        ("say", "sunny", "It's tradition, bro.", dict(mood="chill", to="barry")),
        ("cam", "barry_cu"),
        ("say", "barry", "Tradition is just a meeting nobody wrote down!", dict(mood="worried", to="sunny", gap=0.2)),
        ("say", "barry", "And where do the oranges even come from? Nothing is free, Doreen!", dict(mood="worried", to="doreen", gap=0.15)),
        ("cam", "doreen_cu"),
        ("say", "doreen", "You think too much, sweetie. I had a thought once. Back in March. Didn't care for it.", dict(mood="happy", to="barry")),
        ("cam", "trio"),
        ("pause", 0.2),
        ("sfx", "flaps"),
        ("beat", "vulture_lands", 1.6, "Gerald the vulture flaps down and settles onto Barry's head, feet gripping his tuft. Barry doesn't look up"),
        ("sfx", "land"),
        ("cam", "barry_cu"),
        ("beat", "barry_looks_up", 1.0, "Barry's pupils roll slowly up toward Gerald (look.y -> -1 over 0.5s) and hold. He says nothing"),
        ("cam", "doreen_cu"),
        ("say", "doreen", "Aw. He likes you.", dict(mood="happy", to="barry")),
        ("cam", "barry_cu"),
        ("say", "barry", "That's not affection, Doreen. That's a reservation.", dict(mood="deadpan", to="doreen", gap=0.2)),
        ("say", "barry", "Six weeks on my head! You sit on a guy, you introduce yourself!", dict(mood="worried", gap=0.15)),
        ("cam", "gerald_cu"),
        ("say", "gerald", "Gerald.", dict(mood="smug", to="barry")),
        ("cam", "barry_cu"),
        ("say", "barry", "Thank you! Was that so hard?", dict(mood="smug", to="gerald", gap=0.15)),
        ("say", "barry", "Why my head, Gerald?", dict(mood="worried", to="gerald", gap=0.15)),
        ("cam", "gerald_cu"),
        ("say", "gerald", "Oh... no reason.", dict(mood="smug", to="barry")),
        ("cam", "barry_cu"),
        ("say", "barry", "No reason. You know who says no reason? Somebody with a reason!", dict(mood="panic", gap=0.2)),
        ("cam", "sunny_cu"),
        ("say", "sunny", "Bro. Chill. Chill is, like, our whole species.", dict(mood="chill", to="barry")),
        ("cam", "barry_cu"),
        ("say", "barry", "Chill is for animals with nothing to lose, Sunny. I have glasses.", dict(mood="deadpan", to="sunny", gap=0.2)),
    ]),

    # ----------------------------------------------------------- THE EVIDENCE
    dict(id="s04_rumble", setting="spring_day", music=None, events=[
        ("cam", "trio"),
        ("sfx", "rumble_small"),
        ("beat", "rumble1", 1.5, "The ground rumbles: ripples cross the water, everyone's oranges wobble, Gerald grips Barry's tuft tighter"),
        ("cam", "volcano"),
        ("sfx", "splash", dict(offset=1.6)),
        ("beat", "orange_rolls", 1.8, "An orange shakes loose from the grove on Mount Snooze's flank, bounces down the slope and plops into the back-right of the pool (where the lava will pour in later)"),
        ("cam", "trio"),
        ("cue", "orange_drifts", "The orange bobs across the water and comes to rest right in front of Barry during Sunny's line"),
        ("say", "sunny", "See? The mountain provides.", dict(mood="happy")),
        ("cam", "volcano"),
        ("music", "tension", dict(fade=0.4)),
        ("sfx", "rumble_small", dict(gain=0.5)),
        ("sfx", "whoosh", dict(offset=1.13, gain=0.7)),
        ("beat", "volcano_sneeze", 2.1, "Mount Snooze sneezes: little puff (0.0s), little puff (0.5s), a held beat, then one big smoke cloud (1.4s, on the whoosh) that hangs over the crater"),
        ("cam", "trio"),
        ("say", "doreen", "Bless you! That's just Mount Snooze, sweetie. It's been asleep for a thousand years.", dict(mood="chill", to="barry")),
        ("cam", "barry_cu"),
        ("say", "barry", "Exactly! It's well rested!", dict(mood="panic", to="doreen", gap=0.15)),
        ("sfx", "glass_ping"),
        ("beat", "thermo_check", 1.4, "Barry yanks the thermometer up beside his glasses; the red line creeps up and settles on 39.8 as the ping peaks (~1.35s). The thermometer stays up through his next line"),
        ("say", "barry", "Thirty-nine point eight! It went up while you were reassuring me!", dict(mood="panic", to="doreen", gap=0.1)),
        ("cam", "fish"),
        ("sfx", "pop"), ("sfx", "pop", dict(offset=0.7)), ("sfx", "pop", dict(offset=1.4)),
        ("beat", "fish_leave", 2.6, "Three little fish, each carrying a tiny suitcase, hop out of the spring one by one (0.0s, 0.7s, 1.4s, one per pop) over the LEFT rim rocks into the river outlet -- the future escape route -- and away"),
        ("cam", "trio"),
        ("say", "barry", "They packed! Fish don't own things! And not one of them said goodbye!", dict(mood="worried", gap=0.2)),
        ("say", "gerald", "Dreadfully rude, the fish.", dict(mood="neutral")),
        ("cam", "barry_cu"),
        ("say", "barry", "Nobody skips a goodbye... unless they smell smoke!", dict(mood="panic", gap=0.2)),
    ]),

    # --------------------------------------------------------------- THERAPY
    dict(id="s05_therapy", setting="therapy_office", music="therapy", transition="fade", tail=0.8, events=[
        ("cam", "office_wide"),
        ("cue", "gerald_on_couch", "Barry lies on the log-couch (pose 'lie'); Gerald is perched on his head for the whole session. Dr. Shelley sits in the armchair with notepad and pencil"),
        ("pause", 0.4),
        ("cam", "barry_couch"),
        ("cue", "barry_to_camera", "Barry turns his face to the camera (headTurn toward 1) for the next line, then back to Shelley"),
        ("say", "barry", "This is Doctor Shelley. I've been seeing him for six years. He's a tortoise. We're almost up to my childhood.", dict(mood="deadpan")),
        ("say", "barry", "Doc, a vulture is using my head as a bench, and I'm the crazy one?", dict(mood="worried", to="shelley", gap=0.2)),
        ("cam", "shelley_cu"),
        ("say", "shelley", "Is this vulture... in the room with us... right now?", dict(to="barry")),
        ("cam", "office_wide"),
        ("say", "barry", "He's on my head!", dict(mood="panic", to="shelley", gap=0.2)),
        ("say", "gerald", "Hello.", dict(mood="neutral", to="shelley")),
        ("pause", 0.5),
        ("say", "shelley", "...Hello.", dict(to="gerald")),
        ("cam", "shelley_cu"),
        ("sfx", "paper_scribble"),
        ("beat", "shelley_writes", 1.5, "Dr. Shelley very slowly writes on his notepad (covers the 1.5s paper_scribble sfx)"),
        ("say", "shelley", "You're... catastrophizing.", dict(to="barry")),
        ("cam", "window"),
        ("beat", "window_puff", 1.6, "Shelley in the foreground; behind him, through the round window, Mount Snooze puffs a big dark smoke cloud. Shelley does not turn around"),
        ("cam", "barry_couch"),
        ("say", "barry", "Doc. Turn around.", dict(mood="worried", to="shelley", gap=0.15)),
        ("cam", "window"),
        ("beat", "shelley_turns", 2.4, "Same framing as window_puff. Shelley starts to swivel his long neck toward the window, impossibly slowly; the smoke cloud finishes, drifts off and clears a split second before his eye gets there. Clear blue sky. He swivels back just as slowly"),
        ("cam", "shelley_cu"),
        ("pause", 0.4),
        ("say", "shelley", "...We're out of time.", dict(to="barry")),
        ("cam", "office_wide"),
        ("say", "shelley", "That'll be... forty oranges.", dict(to="barry")),
        ("say", "barry", "Forty oranges? That's two oranges a word!", dict(mood="panic", to="shelley", gap=0.1)),
        ("pause", 0.4),
        ("cam", "shelley_cu"),
        ("say", "shelley", "...Forty-two.", dict(to="barry")),
    ]),

    # ------------------------------------------------------- PREPARATION MONTAGE
    dict(id="s06_montage", setting="spring_day", music="montage", transition="wipe", tail=0.5, events=[
        ("cam", "signs"),
        ("sfx", "hammer"), ("sfx", "hammer", dict(offset=1.40625)),
        ("beat", "hammer_signs", 2.5, "Barry hammers left-pointing arrow signs into the left bank; each sign pops up on the third (loudest) hit of its hammer sfx: 'EXIT' at 0.94s, 'NO, REALLY. THIS WAY.' at 2.34s"),
        ("sfx", "pop", dict(offset=0.35)),
        ("beat", "sunny_sign_planted", 1.4, "The signs camera pushes in: Barry plants one last little sign at the very end of the row, 'YES, YOU, SUNNY' (pops up at 0.35s), and pats it once with his snout. Hold so it reads"),
        ("cam", "rules"),
        ("sfx", "hammer", dict(offset=0.31875)),
        ("beat", "rules_sign", 2.4, "Barry plants a big sign by the pool and steps back so it can be read: 'SPRING RULES -- 1. Introduce yourself  2. Say goodbye  3. No vultures on heads'"),
        ("sfx", "flap"), ("sfx", "land", dict(offset=0.6)),
        ("beat", "gerald_ignores_rules", 1.8, "Gerald lands on the top edge of the rules sign (the rules stay readable), reads it, then hops onto Barry's head anyway"),
        ("cam", "raft"),
        ("sfx", "thud", dict(offset=2.4, gain=0.6)), ("sfx", "thud", dict(offset=2.8, gain=0.6)),
        ("beat", "build_raft", 3.3, "0-1.3s: a reed raft assembles at the river mouth on the left (drawRaft build 0->1). 1.3s: a little flag snaps up: 'S.S. TOLD YOU SO' (hold, readable). 2.0s: Gerald hops down from Barry's head onto the raft, test-bounces twice (2.4s, 2.8s) and nods approvingly"),
        ("cam", "helmet"),
        ("sfx", "zip", dict(offset=0.9)),
        ("beat", "helmet_on", 2.0, "Barry snaps on a tiny red bike helmet, cinches the chin strap and lowers himself into the spring with great dignity. Behind him, Sunny and Doreen glance at the EXIT signs and the raft and share a pitying look"),
        ("cam", "trio"),
        ("say", "sunny", "Bro. A helmet. In a hot tub.", dict(mood="happy", to="barry")),
        ("say", "doreen", "Honey, it's a little paranoid.", dict(mood="happy", to="barry")),
        ("cam", "barry_cu"),
        ("say", "barry", "I'm not paranoid. I'm early.", dict(mood="smug", to="doreen", gap=0.2)),
    ]),

    # ---------------------------------------------------------------- ERUPTION
    dict(id="s07_eruption", setting="spring_evening", music="lounge", tail=0.5, ambience=["water"], events=[
        ("cam", "trio"),
        ("cue", "gerald_on_sign", "Golden hour. Barry wears his helmet. Gerald is perched on the top edge of the SPRING RULES sign behind them, not on Barry"),
        ("say", "doreen", "Barry, honey. One orange. For me.", dict(mood="happy", to="barry")),
        ("pause", 0.4),
        ("say", "barry", "Fine. One orange. I won't enjoy it.", dict(mood="deadpan", to="doreen")),
        ("beat", "barry_orange", 2.1, "Barry tips his head and the helmet slides off onto the rim rock beside him; Doreen nudges an orange onto his head with her snout; his eyes close"),
        ("music", "serene", dict(fade=1.0)),
        ("cam", "barry_cu"),
        ("say", "barry", "Oh. Oh, wow. So this is chill? No wonder nobody notices anything. I could get used to—", dict(mood="chill", cut=4.67)),
        ("cam", "gerald_cu"),
        ("say", "gerald", "Well. Goodbye, Barry. Lovely knowing you.", dict(mood="neutral", to="barry", gap=-0.1)),
        ("sfx", "flaps", dict(offset=0.8)),
        ("beat", "vulture_leaves", 2.0, "Gerald glances down at '2. Say goodbye' on the rules sign (0-0.5s), gives it a tidy nod (0.5-0.8s), then lifts off (0.8s) and flies away fast without looking back"),
        ("cam", "barry_cu"),
        ("say", "barry", "See? A proper goodbye. Was that so hard?", dict(mood="chill")),
        ("pause", 0.6),
        ("music", None, dict(fade=0.3)),
        ("beat", "barry_eyes_open", 0.8, "Barry's eyes slowly open behind the glasses"),
        ("say", "barry", "Knowing? Past tense? Why is he saying goodbye?", dict(mood="shock", gap=0.1)),
        ("cam", "thermometer"),
        ("sfx", "glass_pop", dict(offset=0.9)),
        ("beat", "thermo_pops", 1.3, "Close on Barry's thermometer, stuck in the water by his rock: the red line shoots past 39.8 to the top (0-0.9s) and the bulb pops at 0.9s"),
        ("cam", "trio"),
        ("sfx", "rumble_big", dict(gain=0.9)), ("sfx", "boil", dict(offset=0.6, gain=0.6)),
        ("beat", "big_rumble", 1.6, "Violent rumble; the water starts to boil around them; oranges bounce on every head"),
        ("cam", "barry_cu"),
        ("say", "barry", "Twelve seconds. I was chill for twelve seconds.", dict(mood="deadpan", gap=0.2)),
        ("cam", "volcano"),
        ("sfx", "explosion"), ("sfx", "eruption_bed"),
        ("music", "action", dict(fade=2.0)),
        ("beat", "eruption", 3.2, "Mount Snooze erupts: smoke plume, lava fountains, the sky goes red; the orange grove on its flank shakes"),
        ("cam", "trio"),
        ("say", "doreen", "Oh no. I'm having a thought! I don't care for it!", dict(mood="panic")),
        ("sfx", "rock_whistle"),
        ("beat", "orange_rain", 1.6, "Oranges from the grove and small rocks arc in from the volcano and rain down into the boiling spring"),
        ("say", "sunny", "Whoa! Free oranges!", dict(mood="happy")),
        ("say", "barry", "Nothing is free!", dict(mood="panic", to="sunny", gap=0.1)),
        ("sfx", "bonk", dict(offset=0.35)), ("sfx", "splat", dict(offset=0.45)),
        ("beat", "doreen_splat", 1.0, "A small rock drops in from the top of frame (0-0.35s) and bonks Doreen's orange into juice (drawJuiceSplat); juice drips through her next line"),
        ("say", "doreen", "My orange!", dict(mood="shock", gap=0.1)),
        ("sfx", "bonk", dict(offset=1.0)),
        ("beat", "helmet_bonk", 1.4, "Barry flicks his orange off (0-0.3s) and snaps the helmet back on (0.3-0.7s); a rock bounces harmlessly off it at 1.0s. He doesn't flinch, and his glasses don't even slip"),
        ("say", "barry", "Should've worn a helmet!", dict(mood="smug", to="doreen", gap=0.1)),
        ("say", "sunny", "Barry! What do we do?", dict(mood="panic", to="barry")),
        ("say", "barry", "Oh, now you ask? Follow the signs! I made signs!", dict(mood="panic", to="sunny", gap=0.1)),
        ("cam", "escape"),
        ("beat", "run_to_raft", 1.8, "Shot opens with everyone already out of the water, running left (pose run) along the bank past the EXIT signs toward the raft"),
        ("beat", "sunny_sign", 1.0, "The escape camera pushes in as Sunny skids to a stop at the little 'YES, YOU, SUNNY' sign and gazes at it, touched, lava glowing behind him; it pulls back out on board_raft"),
        ("say", "sunny", "Aw. He made me a sign.", dict(mood="happy", gap=0.1)),
        ("beat", "board_raft", 1.2, "Barry yanks Sunny along; they all leap onto the raft. Gerald is already sitting on top of the flagpole"),
        ("say", "gerald", "Took your time.", dict(mood="smug", gap=0.1)),
        ("sfx", "big_splash"), ("sfx", "lava_hiss", dict(offset=0.8)),
        ("beat", "raft_launch", 2.2, "The raft shoots off down the river as lava pours into the spring behind them"),
        ("music", None, dict(fade=1.2)),
    ]),

    # --------------------------------------------------------------- AFTERMATH
    dict(id="s08_aftermath", setting="river_sunset", music=None, transition="fade", events=[
        ("cam", "barry_cu"),
        ("cue", "barry_on_raft", "Barry on the drifting raft, helmet on, a little singed, staring flatly ahead; tiny smoking Mount Snooze over his shoulder"),
        ("pause", 0.5),
        ("say", "barry", "Is it still catastrophizing if there's a catastrophe?", dict(mood="deadpan")),
        ("pause", 0.3),
        ("music", "sunset", dict(fade=1.5)),
        ("cam", "raft_wide"),
        ("cue", "gerald_on_flag", "Sunset. The raft drifts downriver; Barry (helmet on), Sunny and Doreen sit on it, a little singed; Gerald perches on top of the flagpole above 'S.S. TOLD YOU SO'"),
        ("say", "sunny", "Barry... you were right.", dict(mood="sad", to="barry", gap=0.4)),
        ("cam", "barry_cu"),
        ("say", "barry", "Could you say it slower? Like Doctor Shelley?", dict(mood="smug", to="sunny", gap=0.15)),
        ("cam", "raft_wide"),
        ("say", "sunny", "You... were... right... bro.", dict(mood="sad", to="barry", speed=0.72)),
        ("cam", "barry_cu"),
        ("say", "barry", "And who was touching the thermostat?", dict(mood="smug", gap=0.15)),
        ("cam", "raft_wide"),
        ("say", "doreen", "...The mountain.", dict(mood="sad", gap=0.75)),
        ("cam", "barry_cu"),
        ("say", "barry", "And why was a vulture on my head?", dict(mood="smug", gap=0.15)),
        ("cam", "raft_wide"),
        ("say", "sunny", "...The mountain, bro.", dict(mood="sad", gap=0.75)),
        ("cam", "barry_cu"),
        ("say", "barry", "The mountain! Thank you! Was that so hard?", dict(mood="happy", gap=0.1)),
        ("cam", "gerald_flag"),
        ("say", "gerald", "I did sit on him. Rather a clear sign, I thought.", dict(mood="smug")),
        ("cam", "raft_wide"),
        ("say", "doreen", "Oh! Thank you, Gerald!", dict(mood="happy", to="gerald")),
        ("cam", "gerald_flag"),
        ("beat", "gerald_covers_flag", 1.5, "Same framing as before: the flag reads 'S.S. TOLD YOU SO'. Gerald preens, shuffles down the pole and settles so his body covers 'TOLD YOU SO'; hold on the flag reading just 'S.S.'"),
        ("cam", "barry_cu"),
        ("say", "barry", "Thank you, Gerald? All he ever said was no reason!", dict(mood="panic", to="doreen", gap=0.15)),
        ("cam", "fish"),
        ("beat", "fish_float_by", 2.2, "The three fish drift past the raft on a lily pad, suitcases stacked, all waving their fins"),
        ("cam", "barry_cu"),
        ("say", "barry", "Oh, now they wave.", dict(mood="deadpan", gap=0.2)),
        ("cam", "raft_wide"),
        ("say", "barry", "My whole life, I wanted to be right. Now I'm right, I'm homeless, and the vulture's getting the credit.", dict(mood="deadpan")),
        ("pause", 0.4),
        ("beat", "doreen_orange", 1.4, "Doreen gently places an orange on top of Barry's helmet. It wobbles once, then stays"),
        ("cam", "barry_cu"),
        ("say", "barry", "Is this it? Am I chill?", dict(mood="chill", speed=0.98)),
        ("cam", "raft_wide"),
        ("say", "sunny", "Welcome to chill, bro.", dict(mood="happy", to="barry")),
        ("pause", 0.6),
    ]),

    # ---------------------------------------------------------------- EPILOGUE
    dict(id="s09_epilogue", setting="new_spring", music="lounge", transition="fade", events=[
        ("cam", "sign"),
        ("beat", "three_weeks_later", 2.1, "Caption 'THREE WEEKS LATER' over the new sign 'SNOOZE SPRINGS 2 -- Barry Approved', with the SPRING RULES sign planted beside it"),
        ("cam", "trio"),
        ("cue", "roles_reversed", "Barry soaks blissfully, eyes closed, wearing Sunny's orange on his head, his helmet on a rock beside him. Sunny's head is bare; he holds the thermometer (it reads 39.2) and looks worried. Doreen studies Barry's old temperature chart board, propped on a rock, with a worried brow. The SPRING RULES sign is visible behind them"),
        ("say", "sunny", "Barry... thirty-nine point two. Who's touching the thermostat?", dict(mood="worried", to="barry", speed=1.02)),
        ("cam", "barry_cu"),
        ("say", "barry", "Nobody, Sunny. It's a natural spring.", dict(mood="chill", to="sunny", speed=0.98)),
        ("cam", "trio"),
        ("sfx", "flaps"),
        ("beat", "gerald_lands_sunny", 1.6, "Gerald flaps down and lands on Sunny's bare head"),
        ("sfx", "land"),
        ("cue", "gerald_reads_rule1", "Gerald glances at '1. Introduce yourself' on the SPRING RULES sign and gives it a tidy nod (mirror of his s07 glance at rule 2)"),
        ("say", "gerald", "Gerald. Pleased to meet you.", dict(mood="smug", to="sunny")),
        ("cam", "sunny_cu"),
        ("say", "sunny", "Barry... there's a vulture on my head.", dict(mood="worried", to="barry", speed=1.02)),
        ("cam", "barry_cu"),
        ("say", "barry", "Aw. He likes you.", dict(mood="chill", to="sunny", speed=0.98)),
        ("cam", "sunny_cu"),
        ("say", "sunny", "Why my head, Gerald?", dict(mood="worried", to="gerald")),
        ("say", "gerald", "Oh... no reason.", dict(mood="smug", to="sunny")),
        ("cam", "barry_cu"),
        ("pause", 0.4),
        ("beat", "barry_eyes_open", 0.9, "Barry's eyes slowly open behind the glasses"),
        ("beat", "helmet_swap", 1.3, "Barry calmly lifts the orange off his head and starts strapping on the red helmet; he is still cinching the chin strap through Sunny's next line"),
        ("cam", "trio"),
        ("say", "sunny", "Barry... why are you putting on the helmet?", dict(mood="panic", to="barry", speed=1.02, gap=0.1)),
        ("cam", "barry_cu"),
        ("say", "barry", "No reason.", dict(mood="smug", to="sunny")),
        ("sfx", "sting_bad"),
        ("music", None, dict(fade=0.05)),
        ("pause", 0.7),
        ("cam", "trio"),
        ("sfx", "whoosh_left"),
        ("beat", "everyone_bolts", 1.8, "0-0.3s: Sunny and Doreen zip out of frame left in a puff of dust (motion lines). Gerald stays hanging in mid-air in perch pose where Sunny's head was, looks down (0.6s), then flaps (1.2s) and hovers. Barry floats on, calm, helmet on, eyes closed"),
        ("cam", "wide"),
        ("say", "narrator", "Nothing... bothers the capybara.", dict(gap=0.3)),
        ("sfx", "rumble_distant", dict(gain=0.9)),
        ("beat", "hill_sneeze", 1.4, "Same wide: Barry floats alone, eyes closed, helmet on, Gerald hovering above. Far behind the new spring, one gentle green hill puffs two tiny smoke clouds (0.0s, 0.35s), then one big one (0.8s) -- the exact Mount Snooze sneeze. Gerald looks at it. Barry does not open his eyes"),
        ("cam", "barry_cu"),
        ("say", "barry", "Almost nothing.", dict(mood="chill", gap=0.2)),
        ("pause", 0.2),
    ]),
    dict(id="s10_end", music_gain=1.45, music_fade=0.02, setting="title", music="jazz_end", transition="cut", tail=0.5, events=[
        ("beat", "end_card", 1.9, "'CHILL CAPYBARA', then 'THE END', white serif on black"),
        ("beat", "end_credit_volcano", 2.3, "Next card, same style: 'MOUNT SNOOZE appeared as itself (no longer dormant)'"),
        ("beat", "end_credit_fish", 3.1, "Last card: 'No fish were harmed in the making of this film. They left early.' Jazz button on the cut to black"),
    ]),
]
