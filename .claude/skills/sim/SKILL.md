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

The tool is three CLIs — **no scratchpad scripts.** `npm run sim` (`scripts/sim.ts`)
**measures**: one CSV row per run on stdout, flushed as it lands, aggregating nothing.
`npm run sim:report` (`scripts/report.ts`) **folds** that CSV into the report.
`npm run sim:record` (`scripts/record.ts`) **commits** it, merging the rows into the baseline
fixtures that produced them. Measure once, re-analyse as often as the questions require:
filtering by outcome, pulling the outliers or grouping by another column re-reads the file
rather than re-running the sweep.

A sweep names its cells one of two mutually-exclusive ways: **`--baseline`** loads
self-contained fixtures (the committed standing set — reach for this first), or the
**ad-hoc trio** decouples the three axes the way the campaign menu presents them —
mission(s) by id, `--deck` at a JSON file, `--board` by its content id (a JSON file only
when it carries stickers).

## The CLI

```
npm run sim -- --baseline <paths|dir>
npm run sim -- --scenario <ids> --deck <file> --board <id|file>
               [--seeds 100] [--policies random,heuristic,greedy] [--max-rounds 200] [--seed <i>] [--verbose]

npm run sim:report -- <sweep.csv | fixture.json | baselines dir> [--format text|json] [--against <paths|dir>]
npm run sim:record -- <sweep.csv> [--baseline <paths|dir>]
```

**Always capture the sweep to a file** (`> scratchpad/sweep.csv`), then report off it — that
is what makes a follow-up question free. **Redirect through `npm run --silent`**: npm's own
`> package@version script` preamble goes to stdout. The CSV reader skips past it, but JSON
has no comment syntax to hide it, so `sim:report --format json` needs `--silent`.

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
  available: `greedy2`, `planner`, `deepPlanner`, and `oracle` (the last three slow — see below).
- `--max-rounds <n>` — stall cutoff (default 200). A policy that idles past round `n` without
  winning or collapsing is recorded as a `stall` defeat rather than ground to the action wall —
  see *Reading the report*. Lower it for a faster sweep when you expect stalls.
- `--seed <i>` — sweep **only** that seed index, on the exact seed streams the full sweep would
  have given it (see *Replay one run*).
- `--verbose` — add a per-turn trace on **stderr**; stdout stays pure CSV, so it composes with
  a redirect.

And on `sim:report`: `--format text` (default, the human report) or `json` (the raw summaries).
Takes a sweep file, a baseline fixture, a directory of fixtures, or stdin if nothing is given —
so the standing set's committed numbers are readable with no sweep at all. `--against
<paths|dir>` **compares** instead of folding: the input is the new measurement, the flag names the
recorded one, and the output is one block per cell that moved — win rate, turns, the end pools that
shifted, the defeat causes that traded, and which seeds crossed the win/defeat line. Unmoved cells
collapse to a count. See *Compare a content variant*.

And on `sim:record`: `--baseline <paths|dir>` says where the fixtures live (default
`scripts/sim/baselines`). It replaces one `results[policy]` key per swept policy and touches
nothing else. Every refusal reads a fact off the sweep's own header, so it holds for a file taken
any time: a seed-filtered sweep (a replay), a non-default search beam (a diagnostic), a run count
short of `--seeds` (interrupted), a cell no fixture answers to (renamed), or a fixture whose
deck/board/mission no longer matches what was swept.

One invocation sweeps `[missions] × {the one deck} × {the one board}`. To **compare two
decks or boards**, edit a file or invoke twice (same `--seeds` → identical shuffles, so the
deck/board is the only variable — a paired comparison).

Examples:
```
npm run --silent sim -- --baseline scripts/sim/baselines --policies greedy,planner --seeds 100 > sweep.csv
npm run sim:report -- sweep.csv
npm run sim:record -- sweep.csv
npm run sim:report -- scripts/sim/baselines/masonry.json
npm run sim:report -- variant.csv --against scripts/sim/baselines
npm run sim -- --baseline scripts/sim/baselines/masonry.json --policies oracle --seeds 20 > oracle.csv
npm run sim -- --scenario first_settlement,growing_numbers --deck <file> --board <board> --seeds 500 > sweep.csv
```

## The sweep file

Above the rows sit `#`-comment lines (which standard parsers skip): the sweep's own flags — the
**effective** `maxRounds`/`beamWidth`, not the ones a flag happened to name — then one
**manifest** line per cell naming its mission, board and deck. So a sweep file is a complete
record of itself: a data row carries no constant-per-cell field, a deck's copy counts and
per-copy stickers live nowhere else, and `sim:record` decides off that header alone whether the
rows are a baseline or a diagnostic.

One row per run:
`cell,policy,seed,outcome,turns,actions,`(the 8 pools)`,structures,routes,reshuffles,cardsPlayed`

- **`outcome` is one column**: `win` on a victory, else the defeat's authoritative cause
  verbatim. Wins are `== win`, all defeats `!= win`, one cause an equality.
- **`cardsPlayed` is zero-filled** over the cell's deck plus the mission's `events` and
  `alsoDisplay` (what a run can only mint mid-play — Accounting's Thief). So "unplayed" is a
  *per-run* fact readable off the row, and the key set is identical across every row of a cell.
  Threats and the objective are absent: they never route through `playCard`.

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
  "board": "settlement",        // a board id, or { "board": "city", "stickers": [...] }
  "deck": [ { "cardId": "hut", "count": 4 } ],  // the deck file's `cards` array, same shape

  "results": {                  // written by `sim:record`; the sweep path never reads it
    "planner": {
      "maxRounds": 200,         // the effective cutoff these rows were swept at
      "columns": "cell,policy,seed,outcome,…",   // the header they were written against
      "rows": [ "masonry,planner,0,win,21,…" ]   // verbatim sweep rows, one per run
    }
  }
}
```
A fixture holds its **own** measurement, one entry per policy — so the seed counts of the
standing protocol (greedy/planner @100, oracle @10) live in one file, and re-measuring one
policy replaces one key. The rows are raw, not the folded report: the fold is cheap and
re-runnable, the sweep is not, so keeping them means "which seeds flipped?" is answerable
without re-measuring, and a rebalance reads as a per-seed `git diff`.

## The standing set — `scripts/sim/baselines/`

The committed baselines are the standing regression references (the equivalent of the old
`SCENARIOS` rows), covering the measured standard missions, each pinning the deck and board a
player actually has **arriving** at it. Usually one per mission; a mission reachable from two
boards that play it differently gets one fixture per board (`masonry` / `masonry_chiefdom`),
since a fixture holds exactly one board:

- **Stone Age baselines are deliberately minimal** — the starting collection plus one copy of
  every card the cleared prereqs granted, **no bought copies and no stickers**. `ice_age` (the
  only grindable Influence faucet) doesn't unlock until First Temple, so a Stone Age mission
  that *needs* the shop is a softlock trap, and these fixtures are what would expose it.
- **Bronze baselines may buy** — bought copies and stickers are fair game from Finding Copper on.
- An optional challenge **leaf** (Pyramid) is revisitable, so its pool is *not* its prereq
  closure — it may use anything the campaign eventually fields.

A fixture carries its own measured rows in `results`; committing them *is* the record of which
content SHA they were taken at. Recording one is `npm run sim:record -- sweep.csv`. Reading one
back is `npm run sim:report -- scripts/sim/baselines/<id>.json` — no sweep needed, and that is
where a dossier's table comes from. When new shipped content deserves a standing cell, add a
fixture and commit it. `--deck`/`--board` remain for hand-written ad-hoc decks.

**A committed result *is* the current baseline — never re-measure one to obtain it.** It is
committed because it describes the tree as it stands; a result known to have gone stale is
called out as stale where it is tracked. Re-running a baseline sweep to "confirm" a committed
row measures nothing and costs as much as the variant run it precedes.

## Replay one run — `--seed <i> --verbose`

`--seed <i>` is a **filter**, not a separate mode: it sweeps only that index, on the same seed
streams the full sweep gave it (`<label>-cfg-i` / `<label>-pol-i`, where the label is the mission
id ad-hoc or the fixture's `id` for a baseline). The CSV row it prints is byte-identical to that
run's row in the full sweep, so a row that lost can be re-run verbatim to see *what happened*:

```
npm run sim -- --baseline scripts/sim/baselines/masonry.json --policies planner --seed 3 --verbose
```

`--verbose` adds the **per-turn trace** on stderr — each turn's starting economy (resources · pop
assigned/total · territory · culture), the accepted moves that turn, and the final outcome line.

**Which index to replay is a question the sweep file already answers**: filter the CSV for the
outcome you want (`famine`, `stall`, `noWinFound:deadEnd`, `win`) and read the `seed` column. Never
re-run the sweep in a loop looking for a representative run.

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
- `deepPlanner` = the **deep-analysis tier** of `planner` — the same fair search run with the calibrated
  deep knobs (more sampled worlds, a wider within-turn search, a 2-turn lookahead). It recovers seeds the
  default `planner` drops, but each re-plan is far heavier: budget **~30–60s per run**, so it's for a
  handful of selected seeds (or a `--seed` replay), never a full sweep.
- `oracle` = a bounded perfect-information search for a *winning* line — the true ceiling /
  winnability prover. Unlike `planner` it reads the real shuffle, so it *proves* winnability rather
  than playing fairly. It runs a whole search per seed, so keep the seed count small.

**2. `unplayed cards` means different things per policy.** Under **random** it's authoritative:
the card is genuinely unplayable. Under **greedy/heuristic** it means "a card `sim/value.ts`'s
`scoreState` doesn't appreciate" — a payoff the value function is blind to (e.g. a discard→hand
recovery, since hand contents aren't scored) shows as unplayed though it's perfectly playable.
Trust random for *playability*; read a competent policy's unplayed list as a *value-function gap*.

The report's list is the cell-wide one (never played in *any* run); the CSV's zero-filled
`cardsPlayed` gives the same reading **per run**, so "played in 71 of 100 runs" is a question the
sweep file answers and the report does not.

Also in the report: `win rate` (winnable?), `turns` + `defeat causes` (is the economy too tight? —
the histogram is the authoritative recorded cause, not re-derived from resources), `card plays`
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

  1. Pick the cells and the `--policies`/`--seeds`. On a baseline-fixture cell **match what the
     fixture already holds** (`results[policy].rows` length *is* its seed count, the standing protocol
     being greedy/planner @100, oracle @10) — the recorded rows are the baseline half, so there is no
     baseline run. Use a policy that actually reaches the mechanic (`greedy`/`heuristic` past the early
     game; `random` barely survives).
  2. **Edit** the content value (the `Edit` tool on the real `src/content/*.ts`).
  3. **Variant run** — capture to `scratchpad/variant.csv`.
  4. **Roll back** with `git checkout -- src/content/<file>.ts`, then **verify clean**:
     `git status --porcelain src/content/<file>.ts` must print nothing. If it prints anything, the
     rollback failed — say so loudly and stop; do not report the comparison as if the tree were clean.
     (This repo commits directly to `main`; a stray content edit would be swept into the next commit.)
  5. **Compare** — `npm run sim:report -- scratchpad/variant.csv --against scripts/sim/baselines`.
     One block per cell that moved (win rate, turns, the end pools that shifted, the defeat causes that
     traded, and which seeds crossed the win/defeat line); cells that did not move collapse to a count.
     Present those deltas — not the raw dumps, and not a verdict on whether the edit is an improvement.

  On an **ad-hoc** (`--deck`/`--board`) cell there is nothing recorded, so it needs a baseline run of
  its own before step 2, and `--against` takes that CSV instead of the fixtures.

  Read the caveats the report prints. `⚠ different seed counts` means the win-rate delta is across
  different *n*; `not paired — no per-seed reading` means seed *i* is not the same shuffle on both
  sides (the deck/board/mission differ), so the aggregate still compares but the flip list is withheld.

  The player never sees the edit: it exists only between steps 2 and 4.
