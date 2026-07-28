# Rites & Rituals *(name provisional)* — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); the branch restructure
> that created this slot is in [`../REBALANCE.md`](../REBALANCE.md) → *Culture leaves the Stone Age*.
> Final decisions → [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ⬜ · Polish ⬜
**Branch:** Stone — the **reconvergence** of both branches, on the centre axis.
**Placement:** ✅ `prereqs: ['first_trades', 'reading_seasons']`, stone **col 4 row 0**; `first_temple`
re-points onto this node at col 5, and every Bronze mission shifts one column right behind it.
**Reward:** ✅ **10⭐, no unlock** — provisional on both halves (see *Open*).

**Decided ✅ — culture stays in the Stone Age**, on this node. The arc had lost its 🎭 twice over (the
original `rites_rituals` deleted for The First Trades, `restless_people`'s culture goal retired by the
Harsh Winter rewrite); this is where it comes back.

## Design ✅

Teaches **culture**, the age's last unexercised resource.

**Goal — 🎭 level 1** (`cultureForLevel(1)` = 10🎭), no threat and no events; food upkeep is the only
other pressure, the same shape `reading_seasons` has. Level 1 rather than 2 because **culture resets
every run**: at level 2 this node would demand exactly what `first_temple` demands, making it a strict
subset of the capstone instead of the step below it. The ladder is rites 1 → temple 2 → pyramid 2.

**Both 🎭 producers are in hand on arrival.** `prereqs` is an AND, so both tips are cleared before this
node opens: **Beer** (1🌾 → 2🎭 work card, from `first_trades`) and **Sun Stone** (4🔨 → 2🎭/worker
building, from `reading_seasons`) — two different *kinds* of producer, which is the choice the mission
is about.

## Balance ⬜ (the whole open question)

**⚠️ The culture-level curve is settled here.** Levels sit at cumulative **10 / 30 / 70**
(`CULTURE_STEP = 10`, each band double the last, `rules/culture.ts`), set back when every converter ran
×2. Nothing in the rebalance had yet *asked* for a culture level, so the curve has had no mission to be
judged against — this is that mission. Expect the sweep to move **Beer's rate** rather than the curve.

**10🎭 reads trivially cheap against the shipped producers** — one Sun Stone staffed by one worker for
five rounds, or five Beer plays. Against the arc's 13–16 turn medians the goal may be met incidentally
by turn 6, which would make this a node with no decision in it. The sweep decides between raising the
threshold (a second culture level), cutting the producers' rate, and re-reading the curve — in that
order of preference, since the two producers are freshly rated and the curve is the oldest number here.

No baseline fixture yet: the committed set is one per *measured* mission.

## Open

- **The reward's card half.** 10⭐ and no unlock today. **Calendar** (1🔬 → peek top 3) is the candidate:
  it is the last card on REBALANCE's *Cards on trial* with no home, the objection that benched it off
  `harsh_winter` (it *spends* the resource that mission asks you to stockpile) does not apply here, and
  this node sits downstream of `reading_seasons`, so its 🔬 producers are owned. Not taken unilaterally —
  Calendar's homing is a REBALANCE-tracked decision.
- **The 10⭐ itself grows the faucet ledger**, unlike the branch restructure: the original mission's 8⭐
  was inherited by The First Trades precisely so downstream totals stayed put, and this node is a *new*
  faucet. Arrival at `first_temple` goes 40 → 50⭐ and at Masonry 52 → 62⭐ (`npm run economy`), which is
  what shop tiers and sticker prices are tuned against.

## Settled elsewhere

- **Nothing owed for Cave Art and Burial** — both were resolved upstream instead. Burial is now **Sun
  Stone** (4🔨 → 2🎭/worker), granted by `reading_seasons`; Cave Art is cut. This node adopts neither.
- **`rules/objective.test.ts` / `sim/objective.test.ts` / `sim/enablers.test.ts`** needed no re-point:
  they read synthetic culture fixtures (`test_culture_objective`, `test_culture_win`) precisely so
  culture could re-enter the age without dragging tests behind it.

## Polish ⬜ (not started)
