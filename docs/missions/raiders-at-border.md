# Raiders at the Border — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); the branch
> restructure that moved this mission is in [`../REBALANCE.md`](../REBALANCE.md) → *The Stone Age DAG,
> restructured*. Final decisions → [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md`
> at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ⬜
**Branch:** Stone, upper (row -1) — the **pressure** mission, now first in its branch.
**Placement:** ✅ **moved** by the restructure — `prereqs: ['growing_numbers']`, stone col **2** row -1,
ahead of the resource mission it used to follow.
**Reward:** 8⭐ + the **Chiefdom** board + the money pair **Bead Workshop · Bartering** — which is
[The First Trades](first-trades.md)' toolkit, granted here so it is owned before the mission built on
it launches.

**Goal — defeat all 3 raider waves, 3⚔️ each** (one `raider` event per wave, tied to the objective's
threshold by the shared `RAIDER_WAVES` const so the mission can't seed a different count than the win
asks for). No threat; food upkeep is the only other pressure.

## Design ✅

**No content edit — the mission proved sound at the new rates as authored.** What moved is what a
player *arrives* with: the branch inversion (pressure first, resource second) puts Raiders directly
after Growing Numbers, so its deck is now that mission's deck **exactly**, on Settlement — Growing
Numbers' clear having retired Tribe — with the 6⭐ arriving unspent and Irrigation unbought.

Why it leads its branch: a pressure mission demands no *resource*, so it is the only kind of mission
that can open a branch whose resource the player does not yet own. The money pair it grants is what
makes the next node legal.

## Balance ✅

**Measured** on the re-cut `scripts/sim/baselines/raiders_at_border.json` (15 cards, no purchases,
Settlement's 10🌾 / 5🔨 / 4🗺️ / 2🧍), records in `baselines/results/` — that cell only.

| policy | result | turns (min · median · max) | end 🌾 | Conquest plays/run |
|---|---|---|---|---|
| random @200 | 7/200 | 4 · 7 · 17 | −1.4 | 0.34 |
| heuristic @200 | 0/200 | 7 · 27 · 128 | −1.2 | 0.46 |
| greedy @100 | 100/100 | 6 · 11 · 41 | 5.8 | 0 |
| planner @100 | 100/100 | 6 · 9 · 16 | 4.1 | 0 |
| oracle @10 | 10/10 | 6 · 7 · 8 | 5.8 | 0 |

- **The competent floor is 100%.** Not one defeat across greedy, planner and oracle at 100 seeds; a
  wider greedy sweep @200 turned up a single famine.
- ⚠️ **The arc's difficulty steps *down* here.** Against mission 2's greedy 26/100 on identical
  construction, the pressure mission is easier than the resource mission preceding it — the opposite of
  the restructure's intent, and the first thing to weigh whenever this pair is re-read.
- ⚠️ **The territory axis is dead.** Conquest is unplayed by *every* competent policy, Hut lands 2–3
  times per 100 runs, and all three end at pop 2 / 🗺️ 4 — Settlement's start, untouched. Mission 2 made
  🗺️→🧍 the live decision and this mission switches it off: Settlement already grants more slots than
  the run needs, so ⚔️ has exactly one buyer (the waves) and never competes with expansion. (It comes
  back at [The First Trades](first-trades.md), where Conquest is played by heuristic, planner and
  oracle.)
- **Every competent policy converges on the same minimal ⚔️ budget** — Bow twice (2 × 3⚔️) and Dogs
  three times (3 × 1⚔️) = **9⚔️ against three waves at 3⚔️**, ending on ~0⚔️, identical across greedy,
  planner and oracle. Not a hard ceiling — Dogs is repeatable and food is spare, so ⚔️ is buyable at
  1🌾 indefinitely — but there is no *reason* to buy a tenth, so the plan is the same every run and
  skill can't express itself in it.
- **Skill shows in tempo, not survival**: oracle 7 turns · planner 9 · greedy 11.
- **Heuristic's 0/200 is a `sim/value.ts` blind spot, not content** — it leaves Dogs unplayed (the same
  gap recorded at mission 2), so it holds only Bow's 6⚔️, cracks two waves, and starves on the third's
  upkeep at a 27-turn median. The resource it needs is on the table.
- **Not measured here: the money pair.** Bead Workshop and Bartering are this mission's *reward*, so no
  run in this cell owns either; their first measurement is [The First Trades](first-trades.md)' cell,
  whose dossier also carries the rework reasoning.

## Polish ⬜ (not started)

The two ⚠️ readings above are what a polish pass inherits — a dead territory axis and a difficulty dip
against the mission before it. Both are content questions (the waves' size and count, or what else the
mission asks for), not rate ones, so neither was touched during the rate pass.
