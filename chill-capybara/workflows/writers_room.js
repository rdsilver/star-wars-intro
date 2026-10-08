export const meta = {
  name: 'chill-capybara-writers-room',
  description: 'Writers room for the CHILL CAPYBARA screenplay: 3 competing drafts, judge panel, synthesis, adversarial punch-up',
  phases: [
    { title: 'Draft', detail: '3 writers, different comedic angles, each measured with real TTS' },
    { title: 'Judge', detail: '3 judges score all drafts through different lenses' },
    { title: 'Synthesize', detail: 'merge winner + best bits into src/script.py' },
    { title: 'Punch-up', detail: 'adversarial critics attack the merged script' },
    { title: 'Final edit', detail: 'apply punch-up, re-measure runtime, validate' },
  ],
}

const ROOT = '/home/user/star-wars-intro/chill-capybara'
const PY = '/tmp/claude-0/-home-user-star-wars-intro/34651c74-2ed0-5286-bc53-ab12f3f7ca2d/scratchpad/venv/bin/python'

const BRIEF = `
You are part of the writers' room for "CHILL CAPYBARA", a ~5 minute 2D animated comedy short that will be rendered entirely in code (canvas drawing + Kokoro text-to-speech voices + synthesized music). The user's request, verbatim: "a 5 min animated video about a capybara that isn't chill, titled chill capybara. It's a comedy where the main character is kind of neurotic like Woody Allen or Larry David, but this time he was RIGHT."

READ FIRST: ${ROOT}/DESIGN.md (sections 2, 5, 6 especially) and the seed draft ${ROOT}/src/script_seed.py (already measured at 4:38 with real TTS, 612 words, 60 lines).

HARD CONSTRAINTS (the animation team builds against these, do not break them):
- Output format: a Python module exactly like script_seed.py (CAST dict + SCENES list), event vocabulary from DESIGN.md §2 only: say / pause / beat / cue / cam / sfx / music. Moods only from: neutral, worried, panic, chill, happy, smug, deadpan, shock, sad, sleepy.
- Keep the CAST ids, voices and speeds exactly as in the seed (barry, sunny, doreen, gerald, shelley, narrator). You may NOT add speaking characters. Non-speaking extras are fine: background capybaras, fish (can carry tiny suitcases), maybe a monkey or bird extra.
- Settings ONLY from: spring_day, spring_evening, therapy_office, river_sunset, new_spring, title. Scene ids must be sNN_name.
- Music styles ONLY: jazz_title, lounge, tension, therapy, montage, serene, action, sunset, jazz_end (or None). SFX names ONLY from the DESIGN.md §7 list.
- Use at most ~6 distinct camera shot names per scene, named descriptively (e.g. trio, barry_cu, sunny_cu, doreen_cu, gerald_cu, volcano, wide). Every visual gag must be a named beat with a duration and a clear one-line description an animator can draw with simple 2D shapes (side-profile capybaras, signs, oranges, raft, volcano, lava, rocks). Keep visual gags simple and readable — no crowds of new characters, no complex hand-animation.
- TTS-friendly dialogue: short punchy lines (a long monologue line is OK if it builds), no ALL-CAPS words (use ! instead), spell out numbers as words when the reading matters, no stage directions inside the spoken text, use "..." for deliberate hesitation. Em dash at the end only for interruptions combined with the cut option. Avoid words the TTS will mangle (made-up words, heavy slang spelled phonetically, "hmm", "ugh", laughter written as "haha").
- Runtime: the final film must land between 4:50 and 5:10 TOTAL as reported by the real TTS measurement. Measure with:
    cd ${ROOT}/src && ${PY} build_audio.py --timeline-only --script <your_file.py> --out ../build/drafts/<name>.json
  (takes ~1 minute; TTS is cached so re-runs are faster). It prints per-scene timing and TOTAL. Iterate until it fits.
- Family-friendly (PG). The comedy comes from character, escalation, specificity, and callbacks.

THE CORE OF THE FILM: Barry (capybara in thick round Woody-Allen glasses) is neurotic, fussy, observational (Larry David's social grievances + Woody Allen's anxious, self-deprecating verbal riffs). Everyone at Snooze Springs is blissfully chill (Sunny the surfer-dude capybara, Doreen the motherly one, Gerald the politely ominous British vulture who keeps sitting on Barry's head, Dr. Shelley the ancient tortoise therapist). Everyone tells Barry to chill. THIS TIME HE WAS RIGHT: every one of his "neurotic" observations must pay off in the climax (warming water, the smoking "dormant" volcano Mount Snooze, the fish leaving, the vulture, his ridiculed preparations). The best comedy comes from: (1) specific, quotable neurotic riffs, (2) callbacks — lines and objects set up early that return with a twist, (3) the vindication — Barry being right should feel both triumphant and, in true Larry David fashion, a little bit petty/unsatisfying, (4) a strong final button.
`

const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string', description: 'absolute path of the draft .py you wrote' },
    measured_total_seconds: { type: 'number' },
    logline: { type: 'string' },
    best_jokes: { type: 'array', items: { type: 'string' } },
    setups_and_payoffs: { type: 'array', items: { type: 'string' } },
  },
  required: ['file', 'measured_total_seconds', 'logline', 'best_jokes', 'setups_and_payoffs'],
}

const ANGLES = [
  { key: 'larry', label: 'writer:curb', angle: `Your angle: CURB YOUR ENTHUSIASM. Write a fresh draft from scratch (you may reuse the seed's structure loosely but rewrite the jokes). Barry's comedy is social-etiquette grievances and petty-but-correct observations that escalate (e.g. who decided on the orange etiquette, the vulture never introduced himself, shared-hot-tub rules, the therapist's billing). Multiple seemingly-unrelated petty threads that ALL converge and pay off in the eruption climax, Curb-style. The ending should have a Larry-David-ish sting: being right is great... and slightly unsatisfying, and then the final button.` },
  { key: 'woody', label: 'writer:woody', angle: `Your angle: WOODY ALLEN. Write a fresh draft from scratch (you may reuse the seed's structure loosely but rewrite the jokes). Barry is a verbal, self-deprecating, anxious intellectual: riffs about mortality, the universe, his mother, his therapist, hypochondria (he thinks the warm water is a symptom), classic Woody Allen-style one-liners adapted for a capybara (clean and original — do NOT quote real Woody Allen lines). Lean into the opening narrator/title-card homage and the therapy scene. Keep it fast — Woody talks quickly and overlaps.` },
  { key: 'punch', label: 'writer:punchup', angle: `Your angle: PUNCH-UP OF THE SEED. Keep the seed's structure and its best lines, but make every single scene funnier: sharpen wording, add a joke where there is dead air, cut anything that is merely expository, add 2-3 new callbacks, make Sunny and Doreen and Gerald funnier and more specific (they should each get at least one great line), and make the climax and the final button land harder. Also use visual gags (beats) to carry jokes between lines.` },
]

phase('Draft')
const drafts = await parallel(ANGLES.map(a => () => agent(
  `${BRIEF}\n\n${a.angle}\n\nWrite your complete draft to ${ROOT}/src/drafts/draft_${a.key}.py, then measure it with the command above using --out ../build/drafts/${a.key}.json and iterate until TOTAL is between 4:50 and 5:10 and the file loads without assertion errors. Read your own draft out loud in your head: cut anything that isn't funny or doesn't move the story. Return the structured summary.`,
  { label: a.label, phase: 'Draft', schema: DRAFT_SCHEMA })))

const ok = drafts.map((d, i) => d && { ...d, key: ANGLES[i].key }).filter(Boolean)
log(`${ok.length} drafts: ` + ok.map(d => `${d.key} (${Math.round(d.measured_total_seconds)}s)`).join(', '))

phase('Judge')
const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    scores: { type: 'array', items: { type: 'object', properties: {
      key: { type: 'string' }, score: { type: 'number', description: '0-100' }, rationale: { type: 'string' } },
      required: ['key', 'score', 'rationale'] } },
    winner: { type: 'string' },
    best_bits_to_graft: { type: 'array', items: { type: 'string' }, description: 'specific lines/beats (quote them, name the draft) worth grafting into the winner' },
    must_fix: { type: 'array', items: { type: 'string' } },
  },
  required: ['scores', 'winner', 'best_bits_to_graft', 'must_fix'],
}
const draftList = ok.map(d => `- ${d.key}: ${d.file} (measured ${d.measured_total_seconds}s). Logline: ${d.logline}`).join('\n')
const LENSES = [
  { key: 'laughs', text: 'LENS: LAUGHS. You are a veteran sitcom/animated-comedy room head writer. Score purely on how funny it is line by line: joke density, specificity, surprise, quotability, character voice. Be brutally honest; flat expository lines cost points.' },
  { key: 'story', text: 'LENS: STORY & PAYOFF. Score on structure: are Barry\'s neurotic observations planted clearly and do ALL of them pay off in the climax so that "he was RIGHT" is undeniable and satisfying? Callbacks, escalation, the arc (does Barry change? does anyone?), and the strength of the final button.' },
  { key: 'production', text: 'LENS: PRODUCTION. You are the animation director + sound designer. Score on producibility with simple 2D code animation and TTS voices: are beats drawable with simple shapes in the allowed settings, are camera names sensible, are lines TTS-friendly (no mangle-prone words), does the runtime fit 4:50-5:10, are the visual gags readable in a single glance, is pacing good (no long dead stretches, action beats long enough to read)? Also flag format errors.' },
]
const judgments = await parallel(LENSES.map(l => () => agent(
  `${BRIEF}\n\n${l.text}\n\nRead ALL of these drafts in full:\n${draftList}\n\nScore each 0-100, pick a winner to build the final from, list the specific best bits from ALL drafts worth grafting into the winner (quote them and name the source), and list must-fix problems.`,
  { label: `judge:${l.key}`, phase: 'Judge', schema: JUDGE_SCHEMA })))
const J = judgments.filter(Boolean)
const totals = {}
for (const j of J) for (const s of j.scores) totals[s.key] = (totals[s.key] || 0) + s.score
const ranking = Object.entries(totals).sort((a, b) => b[1] - a[1])
log('Judge totals: ' + ranking.map(([k, v]) => `${k}=${Math.round(v)}`).join(', '))
const winnerKey = ranking.length ? ranking[0][0] : 'punch'
const winner = ok.find(d => d.key === winnerKey) || ok[0]

phase('Synthesize')
const judgeNotes = J.map((j, i) => `### Judge (${LENSES[i] ? LENSES[i].key : i})\nScores: ${j.scores.map(s => `${s.key}=${s.score} (${s.rationale})`).join(' | ')}\nGraft: \n- ${j.best_bits_to_graft.join('\n- ')}\nMust fix:\n- ${j.must_fix.join('\n- ')}`).join('\n\n')
const synth = await agent(
  `${BRIEF}\n\nYou are the SHOWRUNNER doing the final merge. The judge panel ranked the drafts: ${ranking.map(([k, v]) => `${k}=${Math.round(v)}`).join(', ')}. Build from the winner (${winner.file}) and graft in the best bits from the others, fixing every must-fix. All drafts:\n${draftList}\n\nJudge notes:\n${judgeNotes}\n\nWrite the merged screenplay to ${ROOT}/src/script.py (overwrite it; it currently holds a copy of the seed). Measure it: cd ${ROOT}/src && ${PY} build_audio.py --timeline-only --script script.py --out ../build/drafts/merged.json — TOTAL must be 4:50-5:10. Also write a human-readable screenplay version to ${ROOT}/SCREENPLAY.md (scene headings, action lines from beats, character names and dialogue — formatted like a real screenplay, with a title page). Return a short summary of what you kept/grafted and the measured runtime.`,
  { label: 'showrunner:merge', phase: 'Synthesize' })

phase('Punch-up')
const CRIT_SCHEMA = {
  type: 'object',
  properties: { notes: { type: 'array', items: { type: 'object', properties: {
    where: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string', description: 'concrete replacement text or change' }, severity: { type: 'string', enum: ['high', 'medium', 'low'] } },
    required: ['where', 'problem', 'fix', 'severity'] } } },
  required: ['notes'],
}
const CRITICS = [
  { key: 'jokes', text: 'You are an adversarial punch-up writer. Find the 10 WEAKEST lines or dead spots in the script (lines that are merely expository, jokes that are predictable, places with no laugh for more than ~10 seconds, a final button that could hit harder). For each, give a concrete better replacement line (same character, same length or shorter). Be ruthless; assume the audience is smart.' },
  { key: 'payoff', text: 'You are an adversarial story editor. Try to REFUTE the claim "every one of Barry\'s concerns pays off and it is undeniable he was right." Check each setup has a clear payoff on screen (beat) or in dialogue, check callbacks land, check the vindication moment is earned and funny, check Gerald/Sunny/Doreen/Shelley each have an arc or a button, and check that nothing confuses a first-time viewer. Give concrete fixes.' },
  { key: 'producibility', text: 'You are the adversarial animation director + TTS voice director. Check: every beat is drawable with simple 2D shapes in the allowed settings; beat durations are long enough to read (big gags >= 2s) but not dead; camera shot names per scene are few and consistent; no line contains words or punctuation that Kokoro TTS will mangle (made-up words, all-caps, odd symbols, "hmm", "ugh", written laughter, numbers that read wrong); format matches DESIGN.md §2 exactly (also run: cd ' + ROOT + '/src && ' + PY + ' -c "import script" and the measure command). Give concrete fixes.' },
]
const crits = await parallel(CRITICS.map(c => () => agent(
  `${BRIEF}\n\n${c.text}\n\nThe merged script is ${ROOT}/src/script.py (readable version: ${ROOT}/SCREENPLAY.md).`,
  { label: `critic:${c.key}`, phase: 'Punch-up', schema: CRIT_SCHEMA })))
const critNotes = crits.filter(Boolean).map((c, i) => `### ${CRITICS[i].key}\n` + c.notes.map(n => `- [${n.severity}] ${n.where}: ${n.problem} → FIX: ${n.fix}`).join('\n')).join('\n\n')

phase('Final edit')
const final = await agent(
  `${BRIEF}\n\nYou are the SHOWRUNNER doing the final polish of ${ROOT}/src/script.py. Here are notes from three adversarial critics. Apply every high-severity note and any medium/low note that clearly makes it funnier or clearer (use your judgment — reject notes that make it worse, and say which you rejected and why). Keep the format valid.\n\n${critNotes}\n\nThen re-measure: cd ${ROOT}/src && ${PY} build_audio.py --timeline-only --script script.py --out ../build/timeline.json — TOTAL must be 4:50-5:10. Update ${ROOT}/SCREENPLAY.md to match the final script exactly. Return: final measured runtime, list of applied and rejected notes, and the full list of scenes with their camera names and beat names (the animators need this).`,
  { label: 'showrunner:final', phase: 'Final edit' })

return { ranking, winner: winner.key, synth, final }
