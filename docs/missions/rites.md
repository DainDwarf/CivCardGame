# Rites & Rituals *(name provisional)* — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); the branch restructure
> that created this slot is in [`../REBALANCE.md`](../REBALANCE.md) → *Culture leaves the Stone Age*.
> Final decisions → [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design 🟡 · Implement ⬜ · Balance ⬜ · Polish ⬜
**Branch:** Stone — the **reconvergence** of both branches, on the centre axis.
**Placement:** `prereqs: ['first_trades', 'reading_seasons']`, stone **col 4 row 0** — the slot
`first_temple` holds today, which shifts right to col 5.
**Reward influence:** undecided.

**Decided ✅ — culture stays in the Stone Age**, on this node. The arc had lost its 🎭 twice over (the
original `rites_rituals` deleted for The First Trades, `restless_people`'s culture goal retired by the
Harsh Winter rewrite); this is where it comes back.

## Design 🟡 (open)

Teaches **culture**, the age's last unexercised resource.

**Goal — a culture level.** The threshold is open (see the curve note below).

**The 🎭 producer is in hand on arrival.** `prereqs` is an AND, so both tips are cleared before this node
opens and **Beer** (granted by `first_trades`) is always owned. A further culture reward is planned on
the lower branch.

**⚠️ The culture-level curve is settled here.** Levels sit at cumulative **10 / 30 / 70**
(`CULTURE_STEP = 10`, each band double the last, `rules/culture.ts`), set back when every converter ran
×2. Nothing in the rebalance has yet *asked* for a culture level, so the curve has had no mission to be
judged against — this is that mission. Expect the sweep to move **Beer's rate** rather than the curve.

## What this node owes elsewhere

- **`first_temple`'s `prereqs`** re-point from `['first_trades', 'reading_seasons']` onto this node, and
  the capstone shifts col 4 → 5. The last outstanding DAG edit in the age. Note the coherence tests
  cannot catch a real-but-*wrong* prereq id — naming the right mission is on whoever makes the edit.
- **Nothing, for Cave Art and Burial.** They stay stranded on *Cards on trial* and are resolved
  separately — this node does not adopt them.
- **`rules/objective.test.ts` / `sim/objective.test.ts` / `sim/enablers.test.ts`** need no re-point: they
  read synthetic culture fixtures (`test_culture_objective`, `test_culture_win`) precisely so culture
  could re-enter the age without dragging tests behind it.

## Polish ⬜ (not started)
