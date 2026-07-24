# Accounting — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance 🟡 · Polish ⬜
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
  (+10 starting 🪙, the first money board sticker).
- **Prereq feeds the fight:** Copper→Forge→🔨→Jewelry is the income; Masonry→City Walls is the ⚔️ that
  catches thieves — each prereq feeds one half.

## Implement ✅ (shipped)

First use of the **`spawnIntoDeck`** primitive (cards breeding cards mid-run).

## Balance 🟡 (open)

Numbers provisional — goal (40🪙), `THIEVES_PER_GOLD` (10). Sim-verify the theft rate stays a squeeze
rather than a spiral before locking.

## Polish ⬜ (not started)

- Nothing yet — card display/text, art, lore.
