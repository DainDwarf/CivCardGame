---
name: sim
description: Run the headless balance simulator to answer statistical questions about the game — compare two decks, check if a mission is winnable, read a win rate, spot a dead card, or gauge how hard a scenario is. Use whenever asked to compare decks/boards/missions, judge balance, or ask "is X winnable / how hard is X / is this card ever played".
---

# Sim: headless balance simulator

The simulator (`src/sim/`) plays a *locked* deck vs. a mission on the real engine
under a move policy. One run answers little; sweeping one scenario over many seeds
gives balance answers no human can grind — win rate, turn/defeat-cause distribution,
per-card play counts. It re-implements **no** game logic; it composes the real engine.

The whole public API is exported from `src/sim/index.ts`: `runPolicies`,
`summarize`, `formatReport`, `POLICY_FACTORIES`, `simConfig`, and the `Scenario` type.

## Two modes — pick by whether the question is throwaway

- **Ad-hoc comparison (default).** "Is deck A better than B?", "is this winnable?",
  "is this card dead?" — a disposable question. **Do NOT edit `scripts/sim.ts` for
  this.** That file is tracked and this repo commits directly to `main`, so a stray
  scenario left in it gets swept into a later commit. Instead write a throwaway
  script in the **scratchpad** and run it with `npx tsx` (recipe below). Nothing
  tracked is touched.
- **New permanent scenario.** When *new shipped content* deserves a standing
  regression row (a new deck/board/mission that should always be swept), add a
  `Scenario` to the `SCENARIOS` array in `scripts/sim.ts` and commit it. Then the
  built-in CLI covers it: `npm run sim -- [seeds] [policy,policy]`.

**Already-shipped content is a CLI call, not a script.** If the deck/board/mission you
want is *already* a row in `SCENARIOS` (any shipped mission is), don't write a scratchpad
script — the CLI takes a **`scenario=<substr>` filter** that sweeps only the rows whose
`label` contains that substring, alongside the seed count and policy names (all
comma-/space-separated, order-free). So "run the oracle on Rites & Rituals for 20 seeds" is
just:

```
npm run sim -- 20 oracle scenario=rites
```

The scratchpad recipe below is for *ad-hoc* decks/scenarios that aren't in `SCENARIOS`.

## Ad-hoc recipe (verified)

Write a script in the scratchpad importing the sim API by **absolute path** (tsx
resolves this cleanly; a relative `../src/sim` from the scratchpad is 7 `..`s and
brittle). Adjust the `C:/Users/daind/Claude/CivCardGame` prefix if the repo path differs.

```ts
// <scratchpad>/compare.ts
import { runPolicies, summarize, formatReport, type Scenario } from 'C:/Users/daind/Claude/CivCardGame/src/sim';
// Pull real content instead of hand-typing cardIds:
import { DEFAULT_DECKS } from 'C:/Users/daind/Claude/CivCardGame/src/content/decks';

const SCENARIOS: Scenario[] = [
  { label: 'founding', deckCardIds: DEFAULT_DECKS[0].cards, board: 'tribe', missionId: 'sandbox' },
  // add a second row with a different deck / board / missionId to compare:
  // { label: 'variant', deckCardIds: [...], board: 'tribe', missionId: 'sandbox' },
];

// Sweep each scenario under the named policies with paired seeds.
const results = runPolicies(SCENARIOS, ['random', 'greedy', 'heuristic'], { seeds: 100 });
console.log(formatReport(results.map(summarize)));
```

Run it from the repo root:

```
npx tsx "<scratchpad>/compare.ts"
```

A `Scenario` is `{ label, deckCardIds, board, missionId, boardStickers? }`, all plain
cardIds/ids — no meta collection needed. `label` is the report row name **and** is folded
into the seed stream, so give each row a distinct label or two scenarios collide on seeds.

## Reading the report — the two things that go wrong

**1. Policies are a bracket, not one number.** Each scenario is swept under paired
seeds across policies:
- `random` = the difficulty **floor** / a playability + crash fuzzer. If a card is
  never played across many *random* walks, it's genuinely hard/impossible to play.
- `greedy` + `heuristic` = a competent **ceiling**. The gap between the random floor
  and this ceiling is how much skill the scenario rewards.
- `greedy2` = greedy with a bounded staffing lookahead (values a work/building play by
  the best worker it could then move into the box). It exists as a **diagnostic pair with
  `greedy`**: the `greedy`↔`greedy2` win-rate gap measures how much *worker reassignment*
  is a lever in a scenario (large on missions where surviving a long build hinges on
  re-staffing food boxes). It grinds long games, so it's the slow policy in a full sweep —
  name it explicitly (`greedy,greedy2`) when that's the question you're asking.

**2. `unplayed cards` means different things per policy.** Under **random** it's
authoritative: the card is genuinely unplayable. Under **greedy/heuristic** it means
"a card `sim/value.ts`'s `scoreState` doesn't appreciate" — a payoff the value
function is blind to (e.g. a discard→hand recovery, since hand contents aren't scored)
shows as unplayed though it's perfectly playable. Trust random for *playability*; read
a competent policy's unplayed list as a *value-function gap*, not a dead card.

Also in the report: `win rate` (winnable?), `turns` + `defeat causes` (is the economy
too tight? — the histogram is the authoritative `gameover.reason`, not re-derived from
resources), `card plays` (is a card ever played?).

## Seed count

100 is a quick look (the CLI default). Bump to **500–1000** when the win-rate gap you're
judging is small, or noise reads as signal. Seeds cost time roughly linearly.

## Compare a content variant (baseline vs. an edited card/number)

A `Scenario` only takes a `missionId`/`board`/cardIds — it resolves them against the
**real content catalogue**, so there's no field to inject a hypothetical inline. But a
mission barely has logic of its own: its win/lose behaviour lives in the objective and
threat *cards* it names, plus constants (e.g. `SANDBOX_DEADLINE` in `content/cards.ts`).
So "does changing this number/goal move the success rate?" **is** answerable — you edit
the content card, re-run, and diff. This is the intended path for tuning objective/threat
numbers *or* trying a whole different goal (author it as a real card first).

Do it as an automated baseline → edit → variant → rollback → compare sequence. **Both
runs must be separate `npx tsx` processes**: tsx/ESM caches the content module on first
import, so a single process can never see an edit made after it started — the two-process
split is required, not just tidy.

1. **Write ONE ad-hoc sim script** in the scratchpad (recipe above) and *fix its seeds
   and label*. Run it for both baseline and variant unchanged — same `label` + same seed
   count → identical deck shuffles, so the content edit is the **only** variable (a paired
   comparison). Use a policy or two that actually reaches the mechanic you're testing
   (`greedy`/`heuristic` for anything past the early game; `random` barely survives).
2. **Back up the target file first** — copy `src/content/<file>.ts` to the scratchpad.
   This is the durable rollback anchor, independent of git, and survives a mid-sequence
   crash.
3. **Baseline run** — `npx tsx <script>`, capture output to `scratchpad/baseline.txt`.
4. **Edit the content** value (the `Edit` tool on the real `src/content/*.ts`).
5. **Variant run** — the *same* script, capture to `scratchpad/variant.txt`.
6. **Roll back** — copy the backup back over the file, then **verify clean**:
   `git status --porcelain src/content/<file>.ts` must print nothing. If it prints
   anything, the rollback failed — say so loudly and stop; do not report the comparison as
   if the tree were clean. (This repo commits directly to `main`; a stray content edit
   would be swept into the next commit.)
7. **Compare** `baseline.txt` vs `variant.txt` and present the deltas that matter —
   win rate, turns (min/median/mean/max), defeat-cause histogram — not the raw dumps.

The player never sees the edit: it exists only between steps 4 and 6, and step 6 restores
the shipped content exactly.
