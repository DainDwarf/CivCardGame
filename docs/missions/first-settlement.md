# The First Settlement — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); the rate pass that
> rewrote this mission's numbers is in [`../REBALANCE.md`](../REBALANCE.md). Final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ⬜
**Branch:** Stone — the arc's **root**, and the game's first mission.
**Placement:** `prereqs: []`, stone col 0 row 0.
**Reward:** 0⭐ + **Farm · Hut · Conquest** (`unlockCardIds`) — the three cards Growing Numbers is
built on. No Influence, deliberately: there is nothing to spend it on before `ice_age` opens grinding.

**Goal — stockpile 10🔨 and 10⚔️ at once.** No threat and no events; food upkeep is the only clock.

## Design ✅

The mission is played on the **forced** opening deck. A fresh profile owns exactly `MIN_DECK_SIZE`
cards and no Influence, so the player cannot cut a card — which is what decides the deck's shape below.

**Opening.** Tribe → **10🌾 / 2🗺️** — territory equal to population, so the very first turn has to
choose which two things two people do. `MIN_DECK_SIZE` 20 → **10**, and the Founding deck narrowed to
**4 Foraging / 4 Toolmaking / 2 Bow / 2 Dogs**.

*Why narrow rather than teach breadth:* a card the first mission can't use is not a chaff-cutting
lesson, it's a dead draw — and under the territory cap it can't even be plopped for incidental value.
Breadth is only a lesson once the player can decline it.

**Rates landed here** (they reach every later mission — the cross-mission ledger is REBALANCE's):
Foraging 3🌾 → **1🌾**/worker · Toolmaking 2🔨 → **1🔨**/worker · Dogs 1🌾→2⚔️ → **1🌾→1⚔️**, the last
flat ×2 converter in the opening deck. And **food upkeep became superlinear**: `floor(pop²/4)`,
replacing flat `population × FOOD_PER_POP`, with the marginal — what the *next* population point
costs — exported as `foodPerNextPop(n) = floor(n/2)` so the HUD can price growth without re-deriving
the curve. `FOOD_PER_POP` is gone.

Quadratic was chosen over a gentler pair-band curve deliberately, to see how it feels before softening
it. It is *cheaper* than the old flat rate at pop 2–3 and harsher from 5 up.

## Balance ✅

**Measured** on the re-cut `scripts/sim/baselines/first_settlement.json`, records updated in
`baselines/results/`:

| policy | result | turns (min · median · max) | end 🌾 |
|---|---|---|---|
| heuristic @30 | 30/30 | 12 · 14.5 · 17 | 5.8 |
| greedy @100 | 95/100 | 10 · 12 · 201 | 2.6 |
| planner @100 | 100/100 | 11 · 16 · 21 | 0.4 |
| oracle @10 | 10/10 | 10 · 11 · 12 | 2.6 |

- **Winnable at every skill level**, which is what the game's first mission should be. Greedy's losses
  are all 201-turn `stall`s — the one-ply plateau, not the content.
- **No dead cards**: `unplayedCards` empty under every policy.
- **The run is worker-round-bound, not food-bound.** The oracle spends ~21 worker-rounds (14 Toolmaking
  + ~7 Foraging) against 2 workers, which *is* its ~11-turn line. Food constrains but doesn't bind.
- **Tribe's 10🌾 is sized right**: heuristic ends on 5.8🌾, planner on 0.4🌾 — styles land either side
  of it.
- ⚠️ **One live axis only.** Bow plays 2/2 and Dogs 4/4 in *every* run under *every* policy: the ⚔️
  half is a fixed script, because they are the only military sources and the goal wants exactly 10.
  The whole decision is the Foraging/Toolmaking split, and skill does show there (426 Foraging plays
  under heuristic vs 222 under oracle). Accepted for mission 1; the thing Growing Numbers exists not to
  repeat.

That single axis is also where the pass brushes its own failure mode: with 🌾 and 🔨 both at 1/worker
they trade exactly 1:1 here (REBALANCE → *Method*). Tolerable as an opening, not a template.

## Polish ⬜ (not started)

Lore, card text and art are pre-pass; the numbers above are what moved. Nothing known to fix.
