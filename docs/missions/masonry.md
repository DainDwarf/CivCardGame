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

Re-measured under the split territory cap (Conquest a `work` card; Settlement 2🏞️ free, Chiefdom none —
its one slot holds the pre-built War Camp):

| board | greedy | planner | oracle |
|---|---|---|---|
| settlement | 77/100 · famine 23 | **89/100** · famine 11 | 10/10 |
| chiefdom | 57/100 · famine 43 | **64/100** · famine 36 | 9/10 |

Turns (min/med/mean/max) under planner: settlement 8 / 31 / 29.4 / 40 · chiefdom 6 / 29 / 23.8 / 62.
Chiefdom still wins faster and loses more. Every defeat on both boards is now famine — **the stalls
are gone**, and Conquest is played ~3.3–4.0×/run under *both* policies.

The chiefdom row predates the War Camp, which doubles what each of those ~3.3–4.0 Conquests yields, so
it owes a re-measure; the settlement row is unaffected.

**Greedy went 0/100 → 77 and 0/100 → 57**, which is the largest move anywhere in the re-measure. The
old reading — "greedy wins neither board; the ⚔️→🏞️→🧍 chain is multi-turn, so Conquest goes unplayed
under it entirely" — no longer describes the cell, and this mission was the standing example of a
one-ply policy plateauing. **Why it moved is not measured**; `--policies greedy,greedy2 --seeds 100`
on this fixture is the comparison that would say whether the multi-turn chain got shorter or the
one-ply value function simply started seeing it.

## Open

- **Both rewards were re-cut after the sweep and are unmeasured** — City Walls 4🔨/−1🔨 upkeep → **3🔨
  flat, no upkeep**; the City board 6🔨 → **10🔨** start. They are this mission's own rewards, so no
  fixture here can reach them; the six City-board fixtures downstream (accounting, horse_taming,
  pyramid, roads, wheel, writing) all predate the board change. City Walls' cut was accepted unmeasured
  on the amortized reading — the card takes no workers, so it is priced against draw frequency rather
  than the worker-turn, and its flat 1⚔️/round already out-rates a War Horse drawn about every sixth turn.

## Polish ⬜ (not started)

- Nothing yet — card display/text, art, lore. (City drawback still to author.)
