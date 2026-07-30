# Accounting — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ⬜
**Branch:** Bronze — the money-spine convergence (both branches rejoin here).
**Placement:** `prereqs: ['finding_copper', 'masonry']` (the first two-prereq gate), bronze col 6
row 0, rejoining the centre axis.
**Reward influence:** 12 (provisional).

## Design ✅ (converged)

A single 🪙-stockpile goal fought against a **theft economy** — a fat treasury floods your own draws.

- **Goal:** stockpile 40🪙 (provisional).
- **Pressure:** the **Envious Population** threat mints **Thief** events into the deck each reshuffle,
  `floor(money / THIEVES_PER_GOLD)` of them (=10, provisional). An unpaid Thief skims 🪙+🔨 and recurs;
  paying its ⚔️ cost catches it (→ `removed`).
- **Reward:** unlocks the **Trader** (work, free, 3🪙/staffed worker) + the **Opulence** board sticker
  (+10 starting 🪙, the first money board sticker). Trader is pitched on **rate, not access** — money
  opens five missions upstream at *The First Trades*, so what this mission grants is a faucet three times
  the Bead Workshop's per staffed worker.
- **Prereq feeds the fight:** Copper→Forge→🔨 pays for the Bead Workshops that are the income;
  Masonry→City Walls is the ⚔️ that catches thieves — each prereq feeds one half.

## Implement ✅ (shipped)

First use of the **`spawnIntoDeck`** primitive (cards breeding cards mid-run).

## Balance ✅ (numbers stand as authored)

**Nothing moved.** 40🪙 and `THIEVES_PER_GOLD` = 10 are kept, and the mission's hardness is *wanted* —
this is the money spine's gate, and it is meant to bite. The sweep below is the evidence it bites the way
the design intends, not evidence it needs softening.

The fixture is the player's own winning deck (2 Bead Workshop · 2 City Walls · 2 Farm ×2 Irrigation ·
Forge · House · 2 Beer · 2 Conquest · 2 Foraging · 2 Hunting · 2 Toolmaking · 2 Bow · Calendar · 2 Fire),
on City. The committed rows, at the standing protocol:

| policy | win | turns med/mean/max | defeats |
|---|---|---|---|
| greedy @100 | 31% | 24 / 33.0 / 201 | famine 47 · ruin 19 · stall 3 |
| planner @100 | **43%** | 36.5 / 31.4 / 81 | famine 38 · ruin 13 · bankruptcy 6 |
| oracle @10 | 70% | 30 / 27.2 / 33 | famine 3 |

**The oracle row is 10 seeds, and it lands where the wider sweeps do.** A 50-seed sweep of the same deck
on a different seed stream put `oracle` at 60% and the pure `prover` at 58% — 7/10 is one seed above that
band rather than a reading of its own, so winnability settles around 60% and this mission is not among the
90–100% peers. The mission ships on the `planner` figure either way.

**Chiefdom is a deck/board mismatch, not a reading of the mission** — 0 starting territory against 8
structures, 3🧍 eating from 8🌾; famine takes 80/100 by turn 6 (21% greedy / 2% planner on this deck). It
gets no fixture: a baseline holds one board, and a Chiefdom cell would need its own deck before its number
said anything about Accounting.

**It is a spiral, not a squeeze — the question this section was opened to answer.** Income caps at
~1🪙/round (Bead Workshop is `workers: 1`, and the City board's 2🧍 must cover food *and* money, so
production freezes ~3🔨 and House at 6🔨 is never affordable). At 20🪙 envy mints 2 thieves per reshuffle,
draining 4🪙/round against that 1. Losing runs therefore die at **~20🪙**, not just short of 40 — money
peaks ~23, plateaus, and falls to bankruptcy. Confirmed on a single seed's trace (peak turn 30 → 0 at
turn 60) and across four cells' mean end money.

**A hard threshold sits at the spawn line.** Snapshotting each planner run when money first reaches 10🪙
(100 seeds, an earlier capped sweep of this deck — the mechanism, not a committed row): of the 49 that got
there with **no City Walls up, none won** — nor did any of the 25 that arrived with 2 Bead Workshops and no
Walls. With Walls up it is 82%. Losers cross ~1.5 turns *earlier*, with more money engine and less
military. So the mission's real ask is *defence before treasury*, and the deck that races gold is the one
that dies. This is why the fixture carries 2 City Walls.

**Caveat on the sim numbers.** The policies' value function scores gold as pure progress and cannot see
the liability it breeds (jotted in `TODO.md`). Widening only the search beam lifts *proven* winnability
46% → 70%, so part of the measured difficulty is a simulator artifact, and every search figure here is a
floor that moves with a knob. `planner` is the honest human-difficulty figure — a player has no proof
search either, and the trap is unsignposted for them too.

## Polish ⬜ (not started)

- Nothing yet — card display/text, art, lore.
