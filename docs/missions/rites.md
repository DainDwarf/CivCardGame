# Rites & Rituals *(name provisional)* — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); the branch restructure
> that created this slot is in [`../REBALANCE.md`](../REBALANCE.md) → *Culture leaves the Stone Age*.
> Final decisions → [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design 🟡 · Implement ⬜ · Balance ⬜ · Polish ⬜
**Branch:** Stone — the **reconvergence** of both branches, on the centre axis.
**Placement:** `prereqs: ['first_trades', 'reading_seasons']`, stone **col 4 row 0** — the slot
`first_temple` holds today, which shifts right to col 5.
**Reward influence:** undecided.

**Decided ✅ — culture stays in the Stone Age, on this node.** The arc lost its 🎭 twice over (the
original `rites_rituals` deleted for The First Trades, `restless_people`'s culture goal retired by the
Harsh Winter rewrite). It comes back here rather than in Bronze, because **both wonders gate on a
culture *level*** and Göbekli Tepe is the Stone capstone's own reward — culture arriving in Bronze would
ship a capstone reward that cannot be played the moment it is granted.

## Design 🟡 (open)

Teaches **culture**, the age's last unexercised resource, and is the only Stone mission where hand size
grows — so it reads as the reward for reconverging rather than one step of a steady climb.

**Goal — a culture level**, which is what the wonders gate on, so the mission teaches exactly what the
capstone then asks for. The threshold is open (see the curve note below).

**⬜ The blocking open question: what makes the 🎭 on the lower branch.** The restructure's forcing rule
is that a mission may only demand a resource an upstream mission granted the means to make. Today the
only shipped 🎭 producer is **Beer**, granted by `first_trades` — the **upper** tip. A player who came
down `harsh_winter` → `reading_seasons` reaches this node with no culture producer at all, and the goal
is unreachable. Three shapes, none chosen:

1. **The node grants its own producer** and the goal is met with it during the mission — breaks the
   col-N-grants-col-N+1 shape the rest of the arc uses, but is self-contained.
2. **`reading_seasons` grants a 🎭 producer** — it has owed a card reward since Calendar moved upstream
   to `harsh_winter`, so the slot is already empty and waiting. Needs a card to put there.
3. **Beer moves upstream** of the fork so both routes own it.

⚠️ **Cave Art and Burial are not the answer by default.** The decision here restored the culture *goal*,
not the two cut cards; they remain on REBALANCE's *Cards on trial* to be re-slotted or cut on their own
merits, and reaching for them to fill option 2 would be a separate call.

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
