---
name: sim
description: Run the headless balance simulator to answer statistical questions about the game — compare two decks, check if a mission is winnable, read a win rate, spot a dead card, or gauge how hard a scenario is. Use whenever asked to compare decks/boards/missions, judge balance, or ask "is X winnable / how hard is X / is this card ever played".
---

# Sim: headless balance simulator

The simulator (`src/sim/`) plays a *locked* deck vs. a mission on the real engine
under a move policy. One run answers little; sweeping one cell over many seeds gives
balance answers no human can grind — win rate, turn/defeat-cause distribution,
per-card play counts. It re-implements **no** game logic; it composes the real engine.

The whole tool is the `npm run sim` CLI (`scripts/sim.ts`) — **no scratchpad scripts.**
The three axes are decoupled the way the campaign menu presents them: pick the
mission(s) by id, point `--deck`/`--board` at JSON files.

## The CLI

```
npm run sim -- --scenario <ids> --deck <file> --board <file>
               [--seeds 100] [--policies random,heuristic,greedy] [--format text] [--seed <i>]
```

- `--scenario` (**required**) — one or more mission ids (comma-separated), looked up live
  from `content/missions.ts`. This is the scenario axis; a bad id fails fast listing the
  known missions.
- `--deck` / `--board` (**required**) — paths to JSON files (schemas below). Ready-made
  examples live under `scripts/sim/decks/*.json` and `scripts/sim/boards/*.json`.
- `--seeds` — runs per cell (default 100).
- `--policies` — comma-separated policy names (default `random,heuristic,greedy`). Also
  available: `greedy2` and `oracle` (slow — see below).
- `--format` — `text` (default, the human report) or `json` (the raw summaries, for diffing
  or post-processing).
- `--seed <i>` — **replay mode** (see below).

One invocation sweeps `[missions] × {the one deck} × {the one board}`. To **compare two
decks or boards**, edit a file or invoke twice (same `--seeds` → identical shuffles, so the
deck/board is the only variable — a paired comparison).

Examples:
```
npm run sim -- --scenario growing_numbers --deck scripts/sim/decks/settled.json --board scripts/sim/boards/settlement.json
npm run sim -- --scenario first_settlement,growing_numbers,rites_rituals --deck <file> --board <file> --seeds 500
npm run sim -- --scenario rites_rituals --deck <file> --board <file> --policies oracle --seeds 20
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

Board — the board plus its board stickers:
```jsonc
{ "board": "tribe", "stickers": ["granary"] }
```

The example files under `scripts/sim/` are the standing regression references. Decks are keyed
by **unlock stage**, not by mission — a stage file is exactly what a player owns on arrival
(the starting collection plus one copy of every card their cleared prereqs granted), and
consecutive missions often share one (`settled.json` serves Growing Numbers, Rites & Rituals
and Reading the Seasons alike). Pair a stage deck with the board that stage actually has:
First Settlement's reward upgrades Tribe into Settlement, so `tribe.json` is only ever correct
for First Settlement itself. When new shipped content deserves a standing example, add a file
there and commit it — that's the equivalent of the old `SCENARIOS` rows.

## Replay one run — `--seed <i>`

Passing `--seed <i>` re-runs the single `(mission, policy, index)` cell the batch would have
run and prints a **per-turn trace** — each turn's starting economy (resources · pop assigned/total ·
territory · culture), the accepted moves that turn, and the final outcome line. Needs exactly one
`--scenario` and one `--policies`:
```
npm run sim -- --scenario growing_numbers --deck <file> --board <file> --policies greedy --seed 3
```
The index `i` matches the batch's seed stream (`<mission>-cfg-i` / `<mission>-pol-i`), so a cell
that lost/won in a sweep can be re-run verbatim to see *what happened*.

## Reading the report — the two things that go wrong

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
- `oracle` = a bounded perfect-information search for a *winning* line — the true ceiling /
  winnability prover. It runs a whole search per seed, so keep the seed count small.

**2. `unplayed cards` means different things per policy.** Under **random** it's authoritative:
the card is genuinely unplayable. Under **greedy/heuristic** it means "a card `sim/value.ts`'s
`scoreState` doesn't appreciate" — a payoff the value function is blind to (e.g. a discard→hand
recovery, since hand contents aren't scored) shows as unplayed though it's perfectly playable.
Trust random for *playability*; read a competent policy's unplayed list as a *value-function gap*.

Also in the report: `win rate` (winnable?), `turns` + `defeat causes` (is the economy too tight? —
the histogram is the authoritative `gameover.reason`, not re-derived from resources), `card plays`
(is a card ever played?).

## Seed count

100 is a quick look (the default). Bump to **500–1000** when the win-rate gap you're judging is
small, or noise reads as signal. Seeds cost time roughly linearly.

## Compare a content variant (baseline vs. an edited card/number)

Two kinds of variable:

- **A deck/board change** (a different card list, an added sticker) — just edit the deck/board
  **file** and re-run, or keep two files and run both. No rebuild needed; each `npm run sim` reads
  the file fresh.
- **A content change** (an objective threshold, a card's `produces`, a board's starting resources)
  lives in `src/content/*.ts`. Here the two runs **must be separate `npm run sim` processes**:
  tsx/ESM caches the content module on first import, so a single process can never see an edit made
  after it started. Do it as an automated baseline → edit → variant → rollback → compare sequence:

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
  6. **Compare** and present the deltas that matter — win rate, turns (min/median/mean/max),
     defeat-cause histogram — not the raw dumps.

  The player never sees the edit: it exists only between steps 3 and 5.
