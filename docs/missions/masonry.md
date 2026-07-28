# Masonry — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ⬜
**Branch:** Bronze — the age's second mission, a *megalopolis* goal.
**Placement:** `prereqs: ['first_temple']`, bronze col 5 row 1 — a symmetric fork off gobekli
opposite Copper (Copper moved to row -1).
**Reward influence:** provisional.

## Design ✅ (converged)

- **Goal:** reach 6 🧍 population (provisional target).
- **Pressure:** none — no threats/events.
- **Reward:** unlocks the **House** (building, 6🔨, +2🧍 one-shot — a bigger Hut), the **City Walls**
  (building, 3🔨, self-sufficient: +1⚔️/round, no upkeep — the first standing military producer), and
  upgrades **Settlement → City** board (12🌾 10🔨 2🪙 2🧍 5🏞️; the age's government — the City drawback
  per IDEAS is still deferred/to-author).

## Implement ✅ (shipped)

House/City Walls cards + the Settlement → City board upgrade shipped.

## Balance ✅ (settled)

**6🧍 holds as printed.** The structural worry — House and City are *this mission's own rewards*, so the
only in-mission population source is **Hut** (+1, one-shot, one territory slot) — is real but not
prohibitive: hand-won on the second try, and the sweep clears it on both boards. Conquest chains
(military → territory) are what open the slots, competing with Farms for the same space against
6🧍 eating 6🌾/round.

**Two fixtures, one per board**, since Settlement (2🧍/4🏞️) and Chiefdom (3🧍/2🏞️) meet the same goal
from opposite ends. Same 21-card deck (the First Temple pool, Bead Workshop · Farm+2 Irrigation ·
4 Hut · 4 Foraging · 2 Hunting · 4 Toolmaking · 2 Bow · 2 Conquest · Bartering):

| board | greedy | planner | oracle |
|---|---|---|---|
| settlement | 0/100 · famine 100 | **86/100** · famine 14 | 10/10 |
| chiefdom | 0/100 · famine 92 · stall 8 | **70/100** · famine 30 | 10/10 |

Turns (min/med/mean/max) under planner: settlement 8 / 30 / 27.5 / 39 · chiefdom 6 / 24.5 / 21.0 / 34.
Chiefdom wins faster and loses more — its 6⚔️ start buys the first Conquests outright, its 2🏞️ leaves
nowhere to put what they open. **Greedy wins neither board**: the ⚔️→🏞️→🧍 chain is multi-turn, so
Conquest goes unplayed under it entirely. That gap is the policy, not the mission.

## Open

- **Both rewards were re-cut after the sweep and are unmeasured** — City Walls 4🔨/−1🔨 upkeep → **3🔨
  flat, no upkeep**; the City board 6🔨 → **10🔨** start. They are this mission's own rewards, so no
  fixture here can reach them; the six City-board fixtures downstream (accounting, horse_taming,
  pyramid, roads, wheel, writing) all predate the board change. See
  [`../REBALANCE.md`](../REBALANCE.md) → the rate ledger.

## Polish ⬜ (not started)

- Nothing yet — card display/text, art, lore. (City drawback still to author.)
