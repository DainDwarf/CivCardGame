# Wheel — mission dossier

> **Per-mission working state** (the "card back" for one mission). The arc-level view —
> the DAG, cross-cutting identity, authoring order — stays in [`../BACKLOG.md`](../BACKLOG.md).
> Final design decisions graduate to [`DESIGN.md`](../DESIGN.md); measured balance results
> compress to `CHANGELOG.md` at ship. This file holds only *live* state.

**Stage:** Design ✅ · Implement ✅ · Balance 🟡 · Polish ⬜
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

## Balance 🟡 (open)

Target and drain are **both untuned**. The raw `territory` multiplier is the design intent
("heaviest drain at the final push") but may be **unwinnable**.

**Re-read under the split play area.** Territory is spent by buildings alone again, so ordinary play
no longer competes with the goal for it — but Road and Conquest are `work` cards again, each costing a
worker for the turn, so the goal's climb is paced by labour rather than by cost alone. The board also
starts with less land (City 5 → 2). All of that needs re-measuring before any lever below is chosen.

- **First levers, in order:** `WHEEL_TERRITORY`, then softening the drain to a grace band
  (`max(0, territory − K)`) or a divisor.
- **Feel-play watch:** a turn can field only as many Roads/Conquests as it has free workers, so
  spiking territory to dodge the escalating drain is now bounded by population, not just by cost.
- **Sweep on:** `scripts/sim/baselines/wheel.json`.

## Polish ⬜ (not started)

- Nothing yet — card display/text, art, lore.
