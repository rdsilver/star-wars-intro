"""CHILL CAPYBARA -- final shooting script (showrunner merge).

Same format as DESIGN.md section 2. This file is the single source of truth.
Chassis: draft_larry (judges' winner). Grafts from draft_woody and draft_punch.
Measured with real TTS (build_audio.py --timeline-only): 303.92s = 5:03.9, 89 lines, 604 words.

Barry is a Larry David grievance machine with a Woody Allen inner life. Every
"neurotic" observation is correct, and every one is paid off in the eruption.

CALLBACK MAP
  SETUP                                          PAYOFF
  s01 "Who's been touching the thermostat?" 39.4 s03 chart + "Then who's touching it?"; s04 39.8 "It went up
                                                 while you were reassuring me!"; s07 bulb pops; s08 "...The
                                                 mountain."; s09 Sunny asks it, Barry answers with Sunny's line
  s01 narrator "Almost nothing." / "I heard      s05 direct address "We're almost up to my childhood."
      that." (Barry talks to camera)
  s01 orange grove on Mount Snooze (visual)      s04 an orange rolls down from the grove; s07 the eruption rains
  s03 "Nothing is free, Doreen!"                 oranges ("Free oranges!" "Nothing is free!"); s08 "And the free
                                                 oranges?" "...The mountain, bro."
  s03 tradition / orange on your head            s07 the ONE time Barry wears an orange, it erupts ("Nine seconds.
                                                 I was chill for nine seconds.")
  s03 "Bro. Chill." / "I have glasses."          s07 "So this is chill?"; s08 "Am I chill?" "Welcome to chill, bro."
  s03 Doreen "I had a thought once. Back in      s07 eruption: "Oh no. I'm having a thought! I don't care for it!"
      March. Didn't care for it."
  s03 "You sit on a guy, you introduce           s06 SPRING RULES sign "1. Introduce yourself"; s09 Gerald
      yourself!" / "Gerald." / "Was that so hard?"    introduces himself to Sunny unprompted
  s03 "No reason" / "Somebody with a reason!"    s08 "All he ever said was no reason!"; s09 Gerald tells Sunny
                                                 "no reason", Barry straps on the helmet: "No reason." (button)
  s03 Doreen "Aw. He likes you."                 s09 Barry says it to Sunny
  s04 fish pack and leave "not one of them said  s06 rule "2. Say goodbye"; s07 Gerald's perfect goodbye = the alarm
      goodbye" / Gerald "Dreadfully rude"            ("Was that so hard?" -> "...Why is he saying goodbye?");
                                                 s08 "Oh, now they wave."; s10 card "They left early."
  s04 "It's been asleep for a thousand years."   s07 eruption; s02 card "(dormant)" -> s10 card "(no longer dormant)"
      / "Exactly! It's well rested!"
  s05 "catastrophizing... imagining the worst"   s07 "Is it still catastrophizing if there's a catastrophe?"
      / "...We're out of time."                  (on its own close-up after the raft launches, music out)
  s05 "forty oranges" / "...Forty-one."          (in-scene button)
  s06 signs (incl. "YES, YOU, SUNNY")            s07 "Follow the signs!"; Sunny: "Aw. He made me a sign."
  s06 helmet mocked / "I'm not paranoid. I'm     s07 rock bonks off the helmet: "Should've worn a helmet!";
      early."                                    s09 the helmet is the final button
  s06 Gerald test-bounces the raft               s07 he is already on it: "Took your time."; s08 he takes the credit
  s06 flag "S.S. TOLD YOU SO"                    s08 Gerald sits on the flag so it reads just "S.S."

NOTES FOR THE ENV / ANIMATION TEAMS
  * spring_day + spring_evening need a small ORANGE GROVE (3-4 little trees with
    orange dots) on Mount Snooze's lower-left green flank, visible in every wide.
    s04 orange_rolls drops an orange from it; s07 orange_rain arcs in from it.
  * Thermometer readings (drawThermometer reading): s01 "39.4", s04 "39.8",
    s07 pops, s09 Sunny's reads "39.2".
  * Direct address = the cues named barry_to_camera (s01, s05): drive headTurn
    toward 1 from the cue for the next line, then ease back. No line uses to="camera".
  * s05: Gerald perches on Barry's head while Barry is in pose 'lie' on the couch.
  * Leading "..." in a line does nothing in this pipeline (edge silence is trimmed);
    reluctant pauses are written as gap= or pause instead.
  * Max 6 camera names per scene. s07 reuses barry_cu after raft_launch for the
    raft close-up; the cue barry_on_raft marks the switch.
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
        ("pause", 1.0),
        ("say", "narrator", "The capybara. The calmest animal on Earth."),
        ("cam", "extras"),
        ("cue", "extras_chill", "Background capybaras doze in the water, eyes shut: a little bird perches on one's head, another wears an orange as a hat; two or three small orange fish nose lazily around them. Nobody moves"),
        ("say", "narrator", "Birds perch on it. It wears an orange as a hat. And it never asks why."),
        ("cam", "establishing_push"),
        ("say", "narrator", "Nothing... bothers the capybara.", dict(gap=0.5)),
        ("pause", 0.4),
        ("cam", "barry_cu"),
        ("beat", "barry_reveal", 1.0, "Barry -- thick round glasses, frazzled tuft, one sweat drop -- lifts a thermometer out of the water up to his glasses and squints at it. It reads 39.4"),
        ("say", "barry", "Thirty-nine point four. Okay. Who's been touching the thermostat?", dict(mood="worried", gap=0.1)),
        ("sfx", "record_scratch"),
        ("music", None, dict(fade=0.05)),
        ("pause", 0.5),
        ("say", "narrator", "Almost nothing.", dict(gap=0.2)),
        ("beat", "barry_to_camera", 0.7, "Barry slowly turns his face to the camera (headTurn 0 -> 1 over ~0.5s) and holds a flat stare"),
        ("say", "barry", "I heard that.", dict(mood="deadpan", gap=0.1, speed=0.95)),
        ("pause", 0.3),
    ]),
    dict(id="s02_title", setting="title", music=None, tail=0.3, events=[
        ("music", "jazz_title", dict(fade=0.05)),
        ("beat", "title_card", 2.7, "White Yeseva serif 'CHILL CAPYBARA' centred on black, Woody-Allen style"),
        ("beat", "title_credit", 2.4, "Second card, same style, smaller: 'with MOUNT SNOOZE as itself (dormant)'"),
    ]),

    # ------------------------------------------------------- THE PETTY GRIEVANCES
    dict(id="s03_spring", setting="spring_day", music="lounge", events=[
        ("cam", "trio"),
        ("beat", "barry_chart", 1.3, "Barry snouts a sign-sized wooden board (~150 units wide) upright on his rock and turns it toward Sunny like evidence: a thick red line graph zigzagging upward, ending in a big frowny face. The board stays on the rock, readable, through Sunny's next line"),
        ("say", "sunny", "Bro. There's no thermostat. It's a natural spring.", dict(mood="chill", to="barry")),
        ("cam", "barry_cu"),
        ("say", "barry", "Then who's touching it?", dict(mood="worried", to="sunny", gap=0.2)),
        ("cam", "trio"),
        ("say", "doreen", "Honey, put an orange on your head.", dict(mood="chill", to="barry")),
        ("cue", "doreen_offers_orange", "Doreen nudges a spare orange across the water toward Barry with her snout"),
        ("say", "barry", "Who decided oranges go on our heads?", dict(mood="worried", to="doreen", gap=0.2)),
        ("cam", "sunny_cu"),
        ("say", "sunny", "It's tradition, bro.", dict(mood="chill", to="barry")),
        ("cam", "barry_cu"),
        ("say", "barry", "Tradition is just a meeting nobody wrote down!", dict(mood="worried", to="sunny", gap=0.2)),
        ("say", "barry", "And where do they come from? Nothing is free, Doreen!", dict(mood="worried", to="doreen")),
        ("cam", "doreen_cu"),
        ("say", "doreen", "You think too much, sweetie. I had a thought once. Back in March. Didn't care for it.", dict(mood="happy", to="barry")),
        ("cam", "trio"),
        ("pause", 0.3),
        ("sfx", "flaps"),
        ("beat", "vulture_lands", 1.6, "Gerald the vulture flaps down and settles onto Barry's head, feet gripping his tuft. Barry doesn't look up"),
        ("sfx", "land"),
        ("cam", "barry_cu"),
        ("cue", "barry_looks_up", "Barry's eyes roll slowly upward toward Gerald. He says nothing"),
        ("pause", 0.7),
        ("cam", "doreen_cu"),
        ("say", "doreen", "Aw. He likes you.", dict(mood="happy", to="barry")),
        ("cam", "barry_cu"),
        ("say", "barry", "He's not perching, Doreen. He's pre-boarding.", dict(mood="deadpan", to="doreen", gap=0.2)),
        ("say", "barry", "Six weeks on my head! You sit on a guy, you introduce yourself!", dict(mood="worried")),
        ("cam", "gerald_cu"),
        ("say", "gerald", "Gerald.", dict(mood="smug", to="barry")),
        ("cam", "barry_cu"),
        ("say", "barry", "Thank you! Was that so hard?", dict(mood="smug", to="gerald")),
        ("say", "barry", "Why my head, Gerald?", dict(mood="worried", to="gerald")),
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
        ("music", "tension", dict(fade=0.4)),
        ("sfx", "rumble_small", dict(gain=0.5)),
        ("sfx", "pop", dict(offset=0.2, gain=0.4)), ("sfx", "pop", dict(offset=0.6, gain=0.4)), ("sfx", "whoosh", dict(offset=0.85, gain=0.8)),
        ("beat", "volcano_sneeze", 1.9, "Mount Snooze sneezes: little puff (0.2s), little puff (0.6s), then one big smoke cloud (1.1s, with the whoosh) that hangs there"),
        ("cam", "trio"),
        ("say", "doreen", "Bless you! That's just Mount Snooze, sweetie. It's been asleep for a thousand years.", dict(mood="chill", to="barry")),
        ("cam", "barry_cu"),
        ("say", "barry", "Exactly! It's well rested!", dict(mood="panic", to="doreen", gap=0.15)),
        ("sfx", "glass_ping"),
        ("beat", "thermo_check", 1.3, "Barry dips the thermometer (0-0.3s) and lifts it to his glasses while the red line creeps up with the rising whine; it settles on 39.8 at ~1.0s and holds so it can be read"),
        ("say", "barry", "Thirty-nine point eight! It went up while you were reassuring me!", dict(mood="panic", to="doreen", gap=0.1)),
        ("cam", "fish"),
        ("sfx", "pop", dict(offset=0.2)), ("sfx", "pop", dict(offset=0.8)), ("sfx", "pop", dict(offset=1.4)),
        ("beat", "fish_leave", 2.6, "Three little fish, each carrying a tiny suitcase, hop out of the spring one by one (0.2s, 0.8s, 1.4s) and away LEFT over the drain rocks toward the river -- the route the raft will take"),
        ("cam", "trio"),
        ("say", "barry", "They packed! Fish don't own things! And not one of them said goodbye!", dict(mood="worried")),
        ("say", "gerald", "Dreadfully rude, the fish.", dict(mood="neutral")),
        ("cam", "barry_cu"),
        ("say", "barry", "Nobody skips a goodbye... unless the party's about to be on fire!", dict(mood="panic", gap=0.2)),
    ]),

    # --------------------------------------------------------------- THERAPY
    dict(id="s05_therapy", setting="therapy_office", music="therapy", transition="fade", events=[
        ("cam", "office_wide"),
        ("cue", "gerald_on_couch", "Barry lies on the log-couch (pose 'lie'); Gerald is perched on his head for the whole session. Dr. Shelley sits in the armchair with notepad and pencil"),
        ("pause", 1.6),
        ("cam", "barry_couch"),
        ("cue", "barry_to_camera", "Barry turns his face to the camera (headTurn toward 1) for the next line, then back to Shelley"),
        ("say", "barry", "This is Doctor Shelley. I've been seeing him for six years. He's a tortoise. We're almost up to my childhood.", dict(mood="deadpan")),
        ("say", "barry", "Doc, a vulture is using my head as a bench, and I'm the crazy one?", dict(mood="worried", to="shelley")),
        ("cam", "shelley_cu"),
        ("say", "shelley", "Is this vulture... in the room with us... right now?", dict(to="barry")),
        ("cam", "office_wide"),
        ("say", "barry", "He's on my head!", dict(mood="panic", to="shelley", gap=0.2)),
        ("say", "gerald", "Hello.", dict(mood="neutral", to="shelley")),
        ("pause", 0.5),
        ("say", "shelley", "...Hello.", dict(to="gerald")),
        ("cam", "shelley_cu"),
        ("sfx", "paper_scribble"),
        ("beat", "shelley_writes", 1.0, "Dr. Shelley very slowly writes on his notepad"),
        ("say", "shelley", "You're... catastrophizing. Imagining the worst.", dict(to="barry")),
        ("cam", "window"),
        ("sfx", "rumble_small", dict(gain=0.3)),
        ("beat", "window_puff", 1.6, "Behind Shelley, through the round window, Mount Snooze puffs a big dark smoke cloud. Shelley does not turn around"),
        ("cam", "barry_couch"),
        ("say", "barry", "And what's it called when the worst is actually happening?", dict(mood="worried", to="shelley")),
        ("cam", "shelley_cu"),
        ("pause", 1.0),
        ("say", "shelley", "...We're out of time.", dict(to="barry")),
        ("cam", "office_wide"),
        ("say", "shelley", "That'll be... forty oranges.", dict(to="barry")),
        ("say", "barry", "You charge by the hour, and you talk like that?", dict(mood="panic", to="shelley")),
        ("pause", 0.4),
        ("cam", "shelley_cu"),
        ("say", "shelley", "...Forty-one.", dict(to="barry")),
    ]),

    # ------------------------------------------------------- PREPARATION MONTAGE
    dict(id="s06_montage", setting="spring_day", music="montage", transition="wipe", tail=0.5, events=[
        ("cam", "signs"),
        ("sfx", "hammer", dict(offset=0.4)), ("sfx", "hammer", dict(offset=1.25)), ("sfx", "hammer", dict(offset=2.1)), ("sfx", "pop", dict(offset=3.1, gain=0.6)),
        ("beat", "hammer_signs", 3.9, "Barry mallets left-pointing arrow signs into the left bank at SPRING.exitSignSpots; each hammer sfx is three knocks (0/.42/.84s) = three swings, and each sign pops fully upright on its third knock (1.24s, 2.09s, 2.94s): 'EXIT', 'EVACUATION ROUTE', 'NO, REALLY. THIS WAY.' Then ONE tiny tap (the pop, 3.1s) plants a little sign 'YES, YOU, SUNNY' by the mooring post (~122,548). Hold the finished row to the end"),
        ("cam", "rules"),
        ("sfx", "hammer"),
        ("beat", "rules_sign", 2.6, "Barry plants a big sign by the pool and steps back so it can be read: 'SPRING RULES -- 1. Introduce yourself  2. Say goodbye  3. No vultures on heads'"),
        ("sfx", "flap"), ("sfx", "land", dict(offset=0.5)), ("sfx", "land", dict(offset=1.9, gain=0.7)),
        ("beat", "gerald_ignores_rules", 2.4, "Gerald lands on top of the rules sign (0.5s), leans down and reads it (0.5-1.4s), then hops onto Barry's head anyway (lands 1.9s); Barry's flat look holds"),
        ("cam", "raft"),
        ("sfx", "hammer", dict(offset=0.3)), ("sfx", "thud", dict(offset=2.6, gain=0.6)), ("sfx", "thud", dict(offset=2.9, gain=0.6)),
        ("beat", "build_raft", 3.2, "Barry lashes reeds into a raft moored at the river on the left and raises a little flag: 'S.S. TOLD YOU SO'. Gerald hops down onto the raft, test-bounces twice and nods approvingly"),
        ("cam", "helmet"),
        ("sfx", "zip", dict(offset=0.9)),
        ("beat", "helmet_on", 2.0, "Barry snaps on a tiny red bike helmet, cinches the chin strap and lowers himself into the spring with great dignity"),
        ("cam", "trio"),
        ("say", "sunny", "Bro. A helmet. In a hot tub.", dict(mood="happy", to="barry")),
        ("say", "doreen", "Honey, it's a little paranoid.", dict(mood="happy", to="barry")),
        ("cam", "barry_cu"),
        ("say", "barry", "I'm not paranoid. I'm early.", dict(mood="smug", to="doreen", gap=0.2, speed=1.0)),
    ]),

    # ---------------------------------------------------------------- ERUPTION
    dict(id="s07_eruption", setting="spring_evening", music="lounge", transition="fade", tail=0.5, events=[
        ("cam", "trio"),
        ("cue", "gerald_on_sign", "Golden hour. Barry wears his helmet. Gerald is perched on the SPRING RULES sign behind them, not on Barry"),
        ("pause", 0.7),
        ("say", "doreen", "Barry, honey. One orange. For me.", dict(mood="happy", to="barry")),
        ("pause", 0.4),
        ("say", "barry", "Fine. One orange.", dict(mood="deadpan", to="doreen")),
        ("beat", "barry_orange", 1.8, "Barry takes off the helmet, sets it on a rock, places an orange on his head and closes his eyes"),
        ("music", "serene", dict(fade=1.0)),
        ("cam", "barry_cu"),
        ("say", "barry", "Oh. Oh, wow. So this is chill? No wonder nobody notices anything. I could get used to this—", dict(mood="chill", cut=4.85)),
        ("cam", "gerald_cu"),
        ("say", "gerald", "Well. Goodbye, Barry. Lovely knowing you.", dict(mood="neutral", to="barry", gap=0.05)),
        ("sfx", "flaps", dict(offset=0.8)),
        ("beat", "vulture_leaves", 1.9, "Gerald glances down at '2. Say goodbye' on the rules sign, gives it a tidy nod, then lifts off and flies away fast without looking back"),
        ("cam", "barry_cu"),
        ("say", "barry", "See? A proper goodbye. Was that so hard?", dict(mood="chill")),
        ("pause", 0.6),
        ("music", None, dict(fade=0.3)),
        ("beat", "barry_eyes_open", 0.8, "Barry's eyes slowly open behind the glasses"),
        ("say", "barry", "...Why is he saying goodbye?", dict(mood="shock", gap=0.1)),
        ("cam", "thermometer"),
        ("sfx", "glass_ping"), ("sfx", "glass_pop", dict(offset=1.4)),
        ("beat", "thermo_pops", 1.7, "Close on Barry's thermometer, stuck in the water by his rock: the red line shoots past 39.8 to the top and the bulb pops"),
        ("cam", "trio"),
        ("sfx", "rumble_big"), ("sfx", "boil", dict(offset=0.6)),
        ("beat", "big_rumble", 1.6, "Violent rumble; the water starts to boil around them; oranges bounce on every head"),
        ("cam", "barry_cu"),
        ("say", "barry", "Nine seconds. I was chill for nine seconds.", dict(mood="deadpan")),
        ("cam", "volcano"),
        ("sfx", "explosion"),
        ("music", "action", dict(fade=0.05)),
        ("beat", "eruption", 3.2, "Mount Snooze erupts: smoke plume, lava fountains, the sky goes red; the orange grove on its flank shakes"),
        ("cam", "trio"),
        ("say", "doreen", "Oh no. I'm having a thought! I don't care for it!", dict(mood="panic")),
        ("sfx", "rock_whistle"), ("sfx", "splash", dict(offset=1.4)),
        ("beat", "orange_rain", 1.6, "Oranges from the grove and small rocks arc in from the volcano and rain down into the boiling spring"),
        ("say", "sunny", "Whoa! Free oranges!", dict(mood="happy")),
        ("say", "barry", "Nothing is free!", dict(mood="panic", to="sunny", gap=0.1)),
        ("sfx", "bonk"), ("sfx", "splat", dict(offset=0.1)),
        ("beat", "doreen_splat", 0.9, "A rock bonks Doreen's orange into juice"),
        ("say", "doreen", "My orange!", dict(mood="shock", gap=0.1)),
        ("sfx", "bonk", dict(offset=0.9)),
        ("beat", "helmet_bonk", 1.5, "Barry flicks his orange off and snaps the helmet back on (by 0.7s); a rock bounces harmlessly off it at 0.9s. He doesn't even flinch"),
        ("say", "barry", "Should've worn a helmet!", dict(mood="smug", to="doreen", gap=0.1)),
        ("say", "sunny", "Barry! What do we do?", dict(mood="panic", to="barry")),
        ("say", "barry", "Oh, now you ask me? Now I'm the expert? Follow the signs!", dict(mood="panic", to="sunny", gap=0.1)),
        ("cam", "escape"),
        ("beat", "run_to_raft", 1.8, "Everyone scrambles out of the boiling spring and runs left past the EXIT signs toward the river"),
        ("beat", "sunny_sign", 1.0, "Sunny skids to a stop at the little 'YES, YOU, SUNNY' sign and gazes at it, touched, lava glowing behind him"),
        ("say", "sunny", "Aw. He made me a sign.", dict(mood="happy", gap=0.1)),
        ("beat", "board_raft", 1.2, "Barry shoves Sunny along with his snout; they all leap onto the raft. Gerald is already sitting on top of the flagpole"),
        ("say", "gerald", "Took your time.", dict(mood="smug", gap=0.1)),
        ("sfx", "big_splash"), ("sfx", "lava_hiss", dict(offset=0.8)),
        ("beat", "raft_launch", 2.2, "The raft shoots off down the river as lava pours into the spring behind them"),
        ("cam", "barry_cu"),
        ("music", None, dict(fade=0.4)),
        ("cue", "barry_on_raft", "barry_cu now frames Barry on the speeding raft: helmet on, red glow behind him, staring flatly ahead"),
        ("pause", 0.5),
        ("say", "barry", "Is it still catastrophizing if there's a catastrophe?", dict(mood="deadpan")),
    ]),

    # --------------------------------------------------------------- AFTERMATH
    dict(id="s08_aftermath", setting="river_sunset", music="sunset", transition="fade", events=[
        ("cam", "raft_wide"),
        ("cue", "gerald_on_flag", "Sunset. The raft drifts downriver; Barry (helmet on), Sunny and Doreen sit on it, a little singed; Gerald perches on top of the flagpole above 'S.S. TOLD YOU SO'"),
        ("pause", 1.0),
        ("say", "sunny", "Barry... you were right.", dict(mood="sad", to="barry")),
        ("cam", "barry_cu"),
        ("say", "barry", "Sorry, the river's loud. What was that?", dict(mood="smug", to="sunny")),
        ("cam", "raft_wide"),
        ("say", "sunny", "You were right, bro!", dict(mood="sad", to="barry")),
        ("cam", "barry_cu"),
        ("say", "barry", "And who was touching the thermostat?", dict(mood="smug")),
        ("say", "doreen", "...The mountain.", dict(mood="sad", gap=0.9)),
        ("say", "barry", "And the free oranges?", dict(mood="smug")),
        ("say", "sunny", "...The mountain, bro.", dict(mood="sad", gap=0.9)),
        ("say", "barry", "The mountain!", dict(mood="happy")),
        ("cam", "gerald_flag"),
        ("say", "gerald", "I did sit on him. Rather a clear sign, I thought.", dict(mood="smug")),
        ("cam", "raft_wide"),
        ("say", "doreen", "Oh! Thank you, Gerald!", dict(mood="happy", to="gerald")),
        ("cam", "gerald_flag"),
        ("beat", "gerald_covers_flag", 1.4, "Gerald preens, hops down from the pole top and settles on the flag's lower half so his body hides the second line 'TOLD YOU SO'; the flag now reads just 'S.S.'"),
        ("cam", "barry_cu"),
        ("say", "barry", "Thank you, Gerald? All he ever said was no reason!", dict(mood="panic", to="doreen")),
        ("cam", "gerald_flag"),
        ("say", "gerald", "Among vultures, it's terribly rude to mention it.", dict(mood="neutral", to="barry")),
        ("cam", "barry_cu"),
        ("say", "barry", "The rude part is not mentioning it!", dict(mood="panic", to="gerald", gap=0.2)),
        ("cam", "fish"),
        ("beat", "fish_float_by", 2.2, "The three fish drift past the raft on a lily pad, suitcases stacked, all waving their fins"),
        ("cam", "barry_cu"),
        ("say", "barry", "Oh, now they wave.", dict(mood="deadpan")),
        ("cam", "raft_wide"),
        ("say", "barry", "My whole life, I wanted to be right. Now I'm right, I'm homeless, and the vulture's getting the credit.", dict(mood="deadpan")),
        ("pause", 0.4),
        ("beat", "doreen_orange", 1.2, "Doreen gently places an orange on top of Barry's helmet. It stays"),
        ("cam", "barry_cu"),
        ("say", "barry", "Is this it? Am I chill?", dict(mood="chill")),
        ("cam", "raft_wide"),
        ("say", "sunny", "Welcome to chill, bro.", dict(mood="happy", to="barry")),
        ("pause", 0.6),
    ]),

    # ---------------------------------------------------------------- EPILOGUE
    dict(id="s09_epilogue", setting="new_spring", music="lounge", transition="fade", events=[
        ("cam", "sign"),
        ("beat", "three_weeks_later", 2.5, "Caption 'THREE WEEKS LATER' over the new sign 'SNOOZE SPRINGS 2 -- Barry Approved', with the SPRING RULES sign planted beside it"),
        ("cam", "trio"),
        ("cue", "roles_reversed", "Barry soaks blissfully with an orange on his head, eyes closed, his helmet on a rock beside him; Sunny holds the thermometer (it reads 39.2) and looks worried"),
        ("pause", 0.5),
        ("say", "sunny", "Barry... thirty-nine point two. Who's touching the thermostat?", dict(mood="worried", to="barry")),
        ("cam", "barry_cu"),
        ("say", "barry", "Nobody, Sunny. It's a natural spring.", dict(mood="chill", to="sunny")),
        ("cam", "trio"),
        ("sfx", "flaps"),
        ("beat", "gerald_lands_sunny", 1.6, "Gerald flaps down and lands on Sunny's head"),
        ("sfx", "land"),
        ("say", "gerald", "Gerald. Pleased to meet you.", dict(mood="smug", to="sunny")),
        ("cam", "sunny_cu"),
        ("say", "sunny", "Barry... there's a vulture on my head.", dict(mood="worried", to="barry")),
        ("cam", "barry_cu"),
        ("say", "barry", "Aw. He likes you.", dict(mood="chill", to="sunny")),
        ("cam", "sunny_cu"),
        ("say", "sunny", "Why my head, Gerald?", dict(mood="worried", to="gerald")),
        ("say", "gerald", "Oh... no reason.", dict(mood="smug", to="sunny")),
        ("cam", "barry_cu"),
        ("pause", 0.4),
        ("beat", "barry_eyes_open", 0.9, "Barry's eyes slowly open behind the glasses and slide toward the little hill behind the spring"),
        ("cam", "hill"),
        ("sfx", "pop", dict(offset=0.4, gain=0.5)),
        ("beat", "hill_puff", 1.4, "Insert on the tiny innocent hill behind Snooze Springs 2 (NEW_SPRING.tinyHill): it burps one tiny smoke puff (env hillPuff 0 -> 1). Only Barry sees it"),
        ("cam", "trio"),
        ("cue", "helmet_swap", "Barry calmly lifts the orange off his head, sets it on his rock and straps on the red helmet; the strap cinch lands during Sunny's line (about 2.5s total)"),
        ("pause", 0.6),
        ("say", "sunny", "Barry... why are you putting on the helmet?", dict(mood="panic", to="barry")),
        ("cam", "barry_cu"),
        ("say", "barry", "No reason.", dict(mood="smug", to="sunny", speed=0.9)),
        ("sfx", "sting_bad"),
        ("pause", 0.6),
        ("cam", "trio"),
        ("sfx", "whoosh"),
        ("beat", "everyone_bolts", 2.0, "Sunny and Doreen launch out of the spring in a puff of dust (0-0.3s); Gerald is left hanging alone in mid-air where Sunny's head was, blinks, then starts flapping (1.4s); Barry floats on, calm, helmet on, eyes closed"),
    ]),
    dict(id="s10_end", setting="title", music="jazz_end", transition="cut", tail=0.8, events=[
        ("beat", "end_card", 2.0, "'CHILL CAPYBARA', then 'THE END', white serif on black"),
        ("beat", "end_credit_volcano", 2.2, "Next card, same style: 'MOUNT SNOOZE appeared as itself (no longer dormant)'"),
        ("beat", "end_credit_fish", 3.2, "Last card: 'No fish were harmed in the making of this film. They left early.' Jazz button on the cut to black"),
    ]),
]
