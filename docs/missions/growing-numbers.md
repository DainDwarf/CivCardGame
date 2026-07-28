# Growing Numbers — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); the rate pass that
> rewrote this mission's numbers is in [`../REBALANCE.md`](../REBALANCE.md). Final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ⬜
**Branch:** Stone — the arc's second node, where both branches fork from.
**Placement:** `prereqs: ['first_settlement']`, stone col 1 row 0.
**Reward:** 6⭐ + the **Irrigation** card sticker + the **Granary/Stockpile** board stickers +
**`boardUpgrade: tribe → settlement`**.

**Goal — build 🛖 + 🌱 and hold 4🗺️** — an *absolute* pool, not a gain over the board's start, so the
board choice is felt at the win line rather than normalized away.

## Design ✅

**The board upgrade moved here from mission 1**, and that is what makes the absolute 4🗺️ goal work:
the opening arc's first **two** missions are played on Tribe, so the 4🗺️ is fought up from Tribe's 2.
On Settlement's 4 the goal would have been satisfied at setup and Conquest would be decorative. It also
reads better — raising the roof is what settles you, not finding the spot. **Settlement** gains the
slack in exchange: 2🔨 → **5🔨** at start, a number that reaches forward into every mission launched
on it.

**Conquest** 5⚔️ flat → **2⚔️ doubling per play of that copy** (2 · 4 · 8 …). The escalation is
per-copy (`CardInstance.counters`), so a bought second copy climbs on its own schedule — a live
interaction with the copy-tier shop to watch, and the reason Masonry's territory chain is the mission
that will feel it most (REBALANCE → *Open*).

Landing that needed the **cost spine** (`rules/cost.ts`) — one `CardCost` descriptor with declarative
fields plus a `resolve` escape hatch, absorbing the old `CardGate`. Decided design; it graduates to
`DESIGN.md`.

## Balance ✅

**Measured** on **Tribe** (2🗺️ / 2🧍 / 10🌾 / 0🔨 — the board a player actually arrives on, now that
the upgrade is this mission's own reward) with the starting deck + one Hut/Farm/Conquest, 15 cards, no
purchases. `scripts/sim/baselines/growing_numbers.json` is re-cut to that deck and its rows in
`baselines/results/` are updated — that cell only, no whole-set sweep.

| policy | result | turns (min · median · max) | end 🌾 | Conquest plays/run |
|---|---|---|---|---|
| heuristic @100 | 84/100 | 9 · 15 · 27 | 10.7 | 1.75 |
| greedy @100 | 26/100 | 11 · 21 · 31 | 1.1 | 0.52 |
| planner @100 | 100/100 | 9 · 13 · 24 | 5.0 | 2.0 |
| oracle @10 | 10/10 | 8 · 9.5 · 11 | 4.9 | 2.0 |

- **The 4🗺️ goal makes Conquest load-bearing**: planner and oracle play it exactly **twice** every run
  (2🗺️ → 4🗺️ for 2⚔️ + 4⚔️ = 6⚔️), which is the whole point of the escalation being gentle at two.
- **Every defeat is famine** (heuristic 16, greedy 74) — no stalls. Unlike mission 1 this run *is*
  food-bound, because ⚔️ for Conquest competes with 🌾 through Dogs (1🌾→1⚔️).
- **Two live axes**, the thing mission 1 lacked: the Foraging/Toolmaking split *and* how much food to
  burn on military. Skill separates hard on it — greedy 26% vs planner 100% on identical seeds.
- **Heuristic leaves Dogs unplayed** and funds ⚔️ through Bow alone. A `sim/value.ts` blind spot, not a
  content signal (Bow is a one-shot 2🔨→3⚔️; Dogs is the repeatable 1🌾→1⚔️), and it recurs at every
  later cell measured in this pass.

## Polish ⬜ (not started)

Lore and card text are pre-pass. One thing to re-read at polish: the goal's 🗺️ term is stated as an
absolute pool, and a player arriving on a future board with more starting territory would meet it for
free — worth a look when a third launchable board exists this early.
