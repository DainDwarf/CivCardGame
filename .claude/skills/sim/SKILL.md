---
name: sim
description: Run the headless balance simulator to answer statistical questions about the game — compare two decks, check if a mission is winnable, read a win rate, spot a dead card, or gauge how hard a scenario is. Use whenever asked to compare decks/boards/missions, judge balance, or ask "is X winnable / how hard is X / is this card ever played".
---

# Sim: headless balance simulator

The simulator (`src/sim/`) plays a *locked* deck vs. a mission on the real engine
under a move policy. One run answers little; sweeping one cell over many seeds gives
balance answers no human can grind — win rate, turn/defeat-cause distribution,
per-card play counts. It re-implements **no** game logic; it composes the real engine.

## Report the numbers, not a diagnosis

**Unless the user asks for analysis, don't analyze.** Run the sweep and hand back what the
tool printed — win rate, turns, defeat-cause histogram, unplayed cards, the deltas between
two runs. Then stop. No "this suggests the economy is too tight", no guess at *why* a card
went unplayed, no balance recommendation, no proposed fix.

The reason is empirical: the sim reports *what* happened, and a causal story about *why*
takes evidence the report doesn't contain. Volunteered interpretations have overwhelmingly
been stabs in the dark, and a confident wrong one is worse than none — it sends the balance
pass chasing a phantom.

If the numbers look surprising and you want to say something, say the surprising number and
offer the next *measurement* ("`--seed 3` would replay that loss"), not a conclusion. The
sections below on reading the report are reference material for when the user does ask.

The whole tool is the `npm run sim` CLI (`scripts/sim.ts`) — **no scratchpad scripts.**
A sweep names its cells one of two mutually-exclusive ways: **`--baseline`** loads
self-contained fixtures (the committed standing set — reach for this first), or the
**ad-hoc trio** decouples the three axes the way the campaign menu presents them —
mission(s) by id, `--deck` at a JSON file, `--board` by its content id (a JSON file only
when it carries stickers).

## The CLI

```
npm run sim -- --baseline <paths|dir>
npm run sim -- --scenario <ids> --deck <file> --board <id|file>
               [--seeds 100] [--policies random,heuristic,greedy] [--format text] [--max-rounds 200] [--seed <i>]
```

- `--baseline` — comma-separated baseline fixture paths, or a **directory** of them
  (`--baseline scripts/sim/baselines` sweeps the whole committed set). Each fixture owns its
  own mission, deck and board, so one sweep can span cells that share none of the three.
  Mutually exclusive with the trio below — combining them fails fast.
- `--scenario` (**required** without `--baseline`) — one or more mission ids (comma-separated),
  looked up live from `content/missions.ts`. A bad id fails fast listing the known missions.
- `--deck` (**required** without `--baseline`) — path to a deck JSON file (schema below).
- `--board` (**required** without `--baseline`) — a content board id (`--board city`, no stickers)
  **or** a path to a board JSON file (needed only to attach board stickers). Stickered examples
  live under `scripts/sim/boards/*.json`.
- `--seeds` — runs per cell (default 100).
- `--policies` — comma-separated policy names (default `random,heuristic,greedy`). Also
  available: `greedy2`, `planner`, and `oracle` (the last two slow — see below).
- `--format` — `text` (default, the human report) or `json` (the raw summaries, for diffing
  or post-processing).
- `--max-rounds <n>` — stall cutoff (default 200). A policy that idles past round `n` without
  winning or collapsing is recorded as a `stall` defeat rather than ground to the action wall —
  see *Reading the report*. Lower it for a faster sweep when you expect stalls.
- `--seed <i>` — **replay mode** (see below).

One invocation sweeps `[missions] × {the one deck} × {the one board}`. To **compare two
decks or boards**, edit a file or invoke twice (same `--seeds` → identical shuffles, so the
deck/board is the only variable — a paired comparison).

Examples:
```
npm run sim -- --baseline scripts/sim/baselines --policies greedy,planner --seeds 100
npm run sim -- --baseline scripts/sim/baselines/masonry.json --policies oracle --seeds 20
npm run sim -- --scenario growing_numbers --deck <file> --board settlement
npm run sim -- --scenario first_settlement,growing_numbers,rites_rituals --deck <file> --board <board> --seeds 500
```

## File schemas (JSON)

Deck — the deck plus per-card stickers:
```jsonc
{ "cards": [
    { "cardId": "foraging", "count": 4 },
    { "cardId": "farm", "count": 1, "stickers": ["irrigation"] }
] }
```
`count` expands to that many copies; `stickers` (optional) rides on **every** copy of the
entry (want one stickered + the rest plain → two entries). Unknown cardId/sticker fails fast.

Board file — the board plus its board stickers (only needed for the stickered case; a
sticker-less board is just `--board <id>`):
```jsonc
{ "board": "city", "stickers": ["stockpile", "stockpile"] }
```

Baseline — a whole cell in one file:
```jsonc
{
  "id": "masonry",              // the report row label, and the seed-stream key
  "mission": "masonry",         // a real content/missions.ts id
  "note": "why this deck",      // free text, for the reader
  "board": "settlement",        // a board id, or { "board": "city", "stickers": [...] }
  "deck": [ { "cardId": "hut", "count": 4 } ]   // the deck file's `cards` array, same shape
}
```

## The standing set — `scripts/sim/baselines/`

The committed baselines are the standing regression references (the equivalent of the old
`SCENARIOS` rows). One per mission, First Settlement → Accounting, each pinning the deck and
board a player actually has **arriving** at it:

- **Stone Age baselines are deliberately minimal** — the starting collection plus one copy of
  every card the cleared prereqs granted, **no bought copies and no stickers**. `ice_age` (the
  only grindable Influence faucet) doesn't unlock until First Temple, so a Stone Age mission
  that *needs* the shop is a softlock trap, and these fixtures are what would expose it.
- **Bronze baselines may buy** — bought copies and stickers are fair game from Finding Copper on.
- An optional challenge **leaf** (Pyramid) is revisitable, so its pool is *not* its prereq
  closure — it may use anything the campaign eventually fields.

Measured results live under `baselines/results/`; committing them *is* the record of which
content SHA they were taken at. When new shipped content deserves a standing cell, add a
fixture and commit it. `--deck`/`--board` remain for hand-written ad-hoc decks.

## Replay one run — `--seed <i>`

Passing `--seed <i>` re-runs the single `(cell, policy, index)` the batch would have run and prints
a **per-turn trace** — each turn's starting economy (resources · pop assigned/total · territory ·
culture), the accepted moves that turn, and the final outcome line. Needs exactly one cell and one
`--policies`, from either input style:
```
npm run sim -- --baseline scripts/sim/baselines/masonry.json --policies planner --seed 3
npm run sim -- --scenario growing_numbers --deck <file> --board <board> --policies greedy --seed 3
```
The index `i` matches the batch's seed stream (`<label>-cfg-i` / `<label>-pol-i`, where the label is
the mission id ad-hoc or the fixture's `id` for a baseline), so a cell that lost/won in a sweep can be
re-run verbatim to see *what happened*.

## Reference: reading the report (when asked) — the two things that go wrong

**1. Policies are a bracket, not one number.** Each cell is swept under paired seeds across policies:
- `random` = the difficulty **floor** / a playability + crash fuzzer. If a card is never played
  across many *random* walks, it's genuinely hard/impossible to play.
- `greedy` + `heuristic` = a competent **ceiling**. The gap between the random floor and this
  ceiling is how much skill the scenario rewards.
- `greedy2` = greedy with a bounded staffing lookahead (values a work/building play by the best
  worker it could then move into the box). It's a **diagnostic pair with `greedy`**: the
  `greedy`↔`greedy2` win-rate gap measures how much *worker reassignment* is a lever (large on
  missions where surviving a long build hinges on re-staffing food boxes). It grinds long games,
  so name it explicitly when that's the question.
- `planner` = the **fair competent** ceiling — a bounded determinized expectimax + beam that plans
  the multi-turn *conversion chains* the one-ply greedies plateau on (bank a resource this turn to
  afford a converter next turn, e.g. Masonry's military→territory→population). It samples the deck
  as a multiset from its own seed (never the real order), so it does **not** cheat like the oracle.
  Reach for it when a mission is winnable but greedy/greedy2 stall indefinitely (they idle their rounds
  upward and are cut off at `--max-rounds`, recorded as a `stall` defeat — see below). Opt-in and slower
  than the greedies but far faster than the oracle; tuned for *good, not perfect* play, so it can drop an
  occasional winnable seed (raise its determinization count to recover one — a runtime tradeoff).
- `oracle` = a bounded perfect-information search for a *winning* line — the true ceiling /
  winnability prover. Unlike `planner` it reads the real shuffle, so it *proves* winnability rather
  than playing fairly. It runs a whole search per seed, so keep the seed count small.

**2. `unplayed cards` means different things per policy.** Under **random** it's authoritative:
the card is genuinely unplayable. Under **greedy/heuristic** it means "a card `sim/value.ts`'s
`scoreState` doesn't appreciate" — a payoff the value function is blind to (e.g. a discard→hand
recovery, since hand contents aren't scored) shows as unplayed though it's perfectly playable.
Trust random for *playability*; read a competent policy's unplayed list as a *value-function gap*.

Also in the report: `win rate` (winnable?), `turns` + `defeat causes` (is the economy too tight? —
the histogram is the authoritative `gameover.reason`, not re-derived from resources), `card plays`
(is a card ever played?).

**`stall` in the defeat histogram is a policy signal, not a balance one.** A `stall: N` bucket means a
policy idled `N` runs' rounds upward without ever winning or collapsing — a one-ply greedy stuck on a
multi-turn conversion chain it can't cross (classic on Masonry, where greedy/greedy2/heuristic all
stall). It's recorded as a loss and counts against that policy's win rate; it does **not** mean the
mission is unwinnable — reach for `planner`/`oracle` to see the real ceiling. The cutoff is
`--max-rounds` (default 200, well above any real game's length); lower it for a faster sweep when you
expect stalls, raise it if a legitimately long mission is being cut short.

## Seed count

100 is a quick look (the default). Bump to **500–1000** when the win-rate gap you're judging is
small, or noise reads as signal. Seeds cost time roughly linearly.

## Compare a content variant (baseline vs. an edited card/number)

Two kinds of variable:

- **A deck/board change** (a different card list, an added sticker) — just edit the deck/board
  **file** and re-run, or keep two files and run both. No rebuild needed; each `npm run sim` reads
  the file fresh.
- **A content change** (an objective threshold, a card's `produces`, a board's starting resources)
  lives in `src/content/*.ts`. Here the two runs **must be separate `npm run sim` processes**: each
  run bundles the then-current `src/` at startup and ESM caches the module thereafter, so a single
  process can never see an edit made after it started. Do it as an automated baseline → edit → variant
  → rollback → compare sequence:

  1. Fix the `--scenario` / `--deck` / `--board` / `--seeds` so both runs are a paired comparison
     (same seeds → identical shuffles → the content edit is the only variable). Use a policy that
     actually reaches the mechanic (`greedy`/`heuristic` past the early game; `random` barely survives).
  2. **Baseline run** — capture output to `scratchpad/baseline.txt` (or use `--format json`).
  3. **Edit** the content value (the `Edit` tool on the real `src/content/*.ts`).
  4. **Variant run** — same flags, capture to `scratchpad/variant.txt`.
  5. **Roll back** with `git checkout -- src/content/<file>.ts`, then **verify clean**:
     `git status --porcelain src/content/<file>.ts` must print nothing. If it prints anything, the
     rollback failed — say so loudly and stop; do not report the comparison as if the tree were clean.
     (This repo commits directly to `main`; a stray content edit would be swept into the next commit.)
  6. **Compare** and present the deltas — win rate, turns (min/median/mean/max), defeat-cause
     histogram — not the raw dumps, and not a verdict on whether the edit is an improvement.

  The player never sees the edit: it exists only between steps 3 and 5.
