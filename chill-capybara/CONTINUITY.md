# CHILL CAPYBARA — continuity sheet

Per-scene state of everything that persists between scenes. Ten scenes are animated in
parallel; this is how they stay consistent. The callback map and env/animation notes in the
docstring of `src/script.py` are part of this sheet — read them too.

## Fixed blocking (whole film)
* Spring trio: **Sunny left** (faces right), **Barry centre**, **Doreen right** (faces left),
  at `SPRING.swimSpots` (env_spring.js) — the same spots in `new_spring`. Barry turns toward
  whoever he addresses with look/headTilt (or the kit's squash turn), never a jumpy flip on a cut.
* Mount Snooze centre-right with the **orange grove** on its lower-left flank (`SPRING.grovePos`).
* The **SNOOZE SPRINGS — No Worries Allowed** sign: right bank (`SPRING.signPos`).
* Escape route: EXIT signs on the **left** bank → river mouth at the left → raft moored at `SPRING.raftMoor`.

## State by scene

| scene | Barry | Sunny | Doreen | Gerald | props / set dressing present |
|---|---|---|---|---|---|
| s01_open | glasses, no orange, holds thermometer **39.4** | (not featured; may appear dozing in extras wide) | (same) | **absent** | extras: one with a little bird on its head, one with an orange hat |
| s02_title | — | — | — | — | white-on-black card: "CHILL CAPYBARA", then "with MOUNT SNOOZE as itself (dormant)" |
| s03_spring | glasses, no orange; chart board on a stick (temperature zigzag up → frowny face) | orange, necklace | orange, hibiscus | lands on Barry's head at `vulture_lands`, stays | spare orange Doreen nudges toward Barry (Barry refuses it) |
| s04_rumble | Gerald on head; thermometer **39.8** at `thermo_check` | orange | orange | on Barry's head | orange rolls from grove, splashes, drifts to Barry; 3 fish with suitcases leave over the LEFT rocks (3 pops) |
| s05_therapy | lying on couch (`lie`), glasses | — | — | on Barry's head | Dr. Shelley in armchair with notepad; window shows Mount Snooze (puff, then clears as Shelley turns) |
| s06_montage | glasses; helmet goes on at `helmet_on` (stays on after) | orange | orange | lands on rules sign, reads, hops onto Barry's head anyway; test-bounces the raft | signs appear: EXIT, EVACUATION ROUTE, NO, REALLY. THIS WAY., YES, YOU, SUNNY (small), SPRING RULES (1. Introduce yourself. 2. Say goodbye. 3. No vultures on heads.) at `SPRING.rulesSignPos`; raft "S.S. TOLD YOU SO" moored at left |
| s07_eruption | helmet on → removes it at `barry_orange` (sets on a rock), orange on head, eyes closed ~12 s → after `helmet_bonk` flicks orange away, helmet back on | orange → bounces in boil | orange → **juiced** at `doreen_splat` (juice on face) | perched on TOP EDGE of the rules sign (rules readable) → leaves at `vulture_leaves` → already on raft flagpole at `board_raft` | all s06 signs + raft; thermometer by Barry's rock: shoots up and pops at `thermo_pops`; eruption, orange+rock rain, lava enters pool |
| s08_aftermath | helmet on, a little sooty; orange placed **on top of the helmet** at `doreen_orange` | sooty | sooty, orange-juice stains | on top of the flagpole → shuffles down to sit on the flag at `gerald_covers_flag` (flag then reads only "S.S.") | raft on river_sunset; fish on a lily pad float by, suitcases stacked, waving; Mount Snooze smoking far away |
| s09_epilogue | eyes closed, orange on head, helmet resting on a rock beside him → `helmet_swap`: lifts orange off, straps helmet on | **bare head** (no orange), holds the thermometer reading **39.2**, worried | orange; studies Barry's old chart board, worried | glides in, lands on **Sunny's** head at `gerald_lands_sunny`; glances at rule 1 first (`gerald_reads_rule1`); left hovering mid-air at `everyone_bolts` | new_spring: "SNOOZE SPRINGS 2 — Barry Approved" sign; the SPRING RULES sign planted beside it; one gentle hill that sneezes (`hill_sneeze`); raft moored at left |
| s10_end | — | — | — | — | white-on-black end cards (see screenplay) |

## Look & lighting progression
* s01, s03, s04, s06: morning/midday `spring_day`; smoke wisp grows slightly scene to scene
  (`volcanoSmoke` ≈ 0.2 → 0.35 → 0.5 (s04 sneeze puffs) → 0.45).
* s07: `spring_evening` golden hour → eruption (red sky, ash).
* s08: sunset river, embers/ash drifting, everyone a little singed.
* s09: bright, fresh daylight — the happiest light in the film.
