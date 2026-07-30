# Wheel — mission dossier

> **Per-mission working state** (the "card back" for one mission). The arc-level view —
> the DAG, cross-cutting identity, authoring order — stays in [`../BACKLOG.md`](../BACKLOG.md).
> Final design decisions graduate to [`DESIGN.md`](../DESIGN.md); measured balance results
> compress to `CHANGELOG.md` at ship. This file holds only *live* state.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ⬜
**Branch:** Bronze — expansion/territory (Roads → Wheel), the branch's closing node.
**Placement:** `prereqs: ['roads']`, bronze col 9 row -1.
**Reward influence:** 12 (provisional).

## Design ✅ (converged)

The closing node of the expansion/territory branch — the *resolution* of the sprawl Roads brings:
push through a 🔨 crisis, earn 🔨 relief.

- **Goal:** reach `WHEEL_TERRITORY` (=6, provisional) — measured off the `territory` **resource**
  (the realm-size cap, not slots filled), climbed through the player's own deck: **Road**
  (🪙+🔨, unlocked by Roads) and **Conquest** (⚔️, from First Settlement) — both already owned by
  the time the player reaches here.
- **Pressure:** the **Overextension** threat drains **−1🔨 per territory** each round (road upkeep —
  the wider the realm, the costlier to hold). It reads the just-gained territory *the same turn*, so
  the final push to N happens under the heaviest drain — you can't out-expand your economy.
- **Reward:** the **Wheel** card sticker — **−1🔨** on any card paying 🔨, floored at 0 — the 🔨
  relief that resolves the mission's own 🔨 crisis. Its `appliesTo` is keyed on the 🔨 cost alone, not
  on a kind list: Road turning into an `action` had silently put this mission's own reward out of
  reach of the mission's own territory card. Widening it also brought Bow and Bead Workshop (both pay
  🔨) into range — **unmeasured**, and the balance pass's to judge. Note the second one is now a 2🔨
  *building*, so the sticker halves a one-time build price; it used to be a 1🔨-per-play action, where
  −1🔨 made a repeatable money faucet outright free. The sharper case is the one that went away.

## Implement ✅ (shipped)

- No `defeat` hook — the drain runs production down to the universal `'ruin'` collapse, which *is*
  the loss. Verified in-engine: `checkEndIf` checks victory **before** collapse, so hitting the
  target on the drain-bankruptcy turn still wins.
- The Wheel sticker is the **first `applyCost` sticker** (−1🔨, floored at 0).
- **Tests:** zone-order invariance pinned for the territory-scaled drain
  (`sim/zoneOrderInvariance.test.ts`, synthetic fixtures). The `applyCost` fold + floor is already
  covered by the `test_costcut` fixture, so no new sticker test.

## Balance ✅ (settled)

`WHEEL_TERRITORY` held at **6**; the one number that moved is the drain, which took the **grace band**
the levers list had ranked second: `OVEREXTENSION_GRACE = 2`, so Overextension charges
`max(0, gained − 2)` and the ramp starts at the third expansion. The design intent survives it — the
band shifts the ramp two steps later without flattening it, and the final push to 6 still happens under
4🔨/round rather than 6.

**Fixture:** the Roads deck carried forward onto City (`scripts/sim/baselines/wheel.json`) — Beer and
the second Bead Workshop dropped for Road ×2 and a second Forge, 13⭐ of the 122 guaranteed to have
arrived. Swept at the standing protocol:

| policy | seeds | win rate | turns (min · med · max) | end terr | failure mode |
|---|---|---|---|---|---|
| greedy | 100 | 10% | 6 · 16 · 201 | 5.2 | ruin 52 · stall 19 · famine 14 · bankruptcy 5 |
| planner | 100 | **55%** | 4 · 24 · 201 | 6.2 | famine 35 · stall 8 |
| oracle | 10 | 100% | 13 · 18 · 29 | 8.0 | — |

**Food, not production, is what the mission kills you with** at the fair-competent tier — 35 of the
planner's 45 losses are famine, against one ruin. The 🔨 crisis the mission is named for shows up only
in the greedy column, where 52 runs ruin: greedy ends holding 65🔨 mean and never converts it, so read
that column as the one-ply plateau it is, not as the drain biting.

**Chiefdom is measurably harder on this same deck** — planner 30% / oracle 80% @10, famine again (68 of
greedy's 100 runs, ending at mean −0.5🌾). It gets **no fixture**: at 0 starting territory against this
deck's four structures it is a deck problem first, and a number taken on the wrong deck would read as a
mission difficulty. Same shape as the gap logged at `roads` and `accounting`.

**Writing is the deck's one dead card** — unplayed across all 200 greedy/planner runs, played once in
10 oracle runs. Kept because the deck is the one the player arrives with.

## Polish ⬜ (not started)

- Nothing yet — card display/text, art, lore.
