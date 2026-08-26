# Wheel — mission dossier

> **Per-mission working state** (the "card back" for one mission). The arc-level view —
> the DAG, cross-cutting identity, authoring order — stays in [`../BACKLOG.md`](../BACKLOG.md).
> Final design decisions graduate to [`DESIGN.md`](../DESIGN.md); measured balance results
> compress to `CHANGELOG.md` at ship. This file holds only *live* state.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ✅
**Branch:** Bronze — expansion/territory (Roads → Wheel), the branch's closing node.
**Placement:** `prereqs: ['roads']`, bronze col 9 row -1.
**Reward influence:** 12 (provisional).

## Design ✅ (converged)

The closing node of the expansion/territory branch — the *resolution* of the sprawl Roads brings:
push through a 🔨 crisis, earn 🔨 relief.

- **Goal:** reach `WHEEL_TERRITORY` (=6, provisional) — measured off the `territory` **resource**
  (the realm-size cap, not slots filled), climbed through the player's own deck: **Road**
  (🪙+🔨, single-use — a box that produces spends itself; unlocked by Roads) and **Conquest** (⚔️,
  doubling per use, from First Settlement) — both already owned by the time the player reaches here.
- **Pressure:** the **Overextension** threat drains **−1🔨 per territory** each round (road upkeep —
  the wider the realm, the costlier to hold). It reads the just-gained territory *the same turn*, so
  the final push to N happens under the heaviest drain — you can't out-expand your economy.
- **Reward:** the **Wheel** card sticker plus two **Caravan** actions, the branch-closing payoff.
  - The sticker is **−1🔨** on any card paying 🔨, floored at 0, **against a 🎭-level-1 gate** — the
    trade-off that makes it a decision rather than a flat discount. The gate is a **floor**
    (`max(1, req)`), so it costs nothing extra on a card already gated and lands squarely on the cheap
    early 🔨 cards it most wants to cut. **Elegant moved to a floor with it**: `stickerSignature`
    normalizes attach order away, so two copies the collection pools as one variant must price the
    same — and a floor and a step on the same field don't commute (Sun Stone takes both). Elegant's
    single-copy behaviour is unchanged; only its stack is, a second copy now adding +1🎭 behind the
    same level 1. Its `appliesTo` is keyed on the 🔨 cost
    alone, not on a kind list: Road turning into an `action` had silently put this mission's own reward
    out of reach of the mission's own territory card. Widening it also brought Bow and Bead Workshop
    (both pay 🔨) into range — **unmeasured**, and a later pass's to judge.
  - **Food Caravan** / **Material Caravan** — actions, **2🪙 → 3🌾** and **2🪙 → 3🔨**. They exist
    because the collection had gone action-thin, and they answer this mission's own measured pressure:
    a wide realm earns 🪙 and starves for 🌾. They set the 🪙→🌾/🔨 conversion rate, so nothing else
    prices them: **unmeasured**, and the number to watch is Trader (3🪙/worker-turn) sustaining ~1.5
    Caravans a turn — draw-limited rather than worker-limited.

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
| greedy | 100 | 29% | 5 · 14 · 201 | 6.2 | ruin 68 · stall 3 |
| planner | 100 | **53%** | 30 · 74.5 · 201 | 6.6 | stall 41 · ruin 6 |
| prover | 10 | 2/10 proven | 1 · 1 · 87 | 3.2 | noWinFound:depth 8 |

Read the planner column beside the prover's: 8 of 10 seeds decline at the root (`noWinFound:depth`),
so the search bound sets the proven floor rather than the mission, and the planner's 47 losses are 41
stalls — runs idling past the cutoff — with no famine in either competent column.

**The Road is single-use** (a box that produces spends itself; an unstaffed one recycles), settled here
since this is the first cell stocking it: its flat 3🪙+3🔨 had overtaken Conquest's doubling 2⚔️ from the
third expansion on. Measured across the 11 cells carrying it, with the race model reading the removal
(`selfRemoves` probes `produces` as well as the play `effect`, so a spent box caps at the copies held):
here planner 51→53, greedy 32→29, prover 3→2/10 — a wash inside seed churn — while the cells that
stocked it for room paid: `bronze_city` 23→14, `sea_lanes_port` 11→2, `sea_peoples_city` 84→77.

The 🔨 crisis the mission is named for shows up only in the greedy column, where 68 runs ruin — read
that column as the one-ply plateau it is, not as the drain biting.

**Chiefdom and City sit within noise of each other at the planner** — 50% vs 53% on the same deck,
though the prover proves Chiefdom far more readily (9/10 against City's 2/10). Its
**Raider Camp** (+4🌾 per 🗺️ taken) pays on exactly the action this mission demands most, and famine was
what used to kill it (68 of greedy's 100 runs before the perk). Greedy stays at 0%: the ⚔️→🗺️ chain is
multi-turn, so a one-ply policy never starts it and never collects the spoils either.

Note the perk deliberately pays **food, not territory**. This is the one mission that both counts
territory gained *and* taxes it through `overextension`, so a land-paying perk would have scaled the
win condition and the toll together — measured at the time as a net +4pp underneath 28 of 100 seeds
changing outcome, which is churn, not a reading. Chiefdom ends on **5.5🗺️ against City's 6.6**, so it
clears the 6-territory goal with less overshoot and pays less toll doing it.

**Writing is the deck's one dead card** — unplayed across all 200 greedy/planner runs, played once in
10 prover runs. Kept because the deck is the one the player arrives with.

## Polish ✅

Text only; no face or art moved.

- **Lore rewritten.** The old one opened on "the road is laid", which this mission contradicts — it is
  still laying them. The new one makes distance the antagonist: a sack of grain carried on a back
  arrives lighter than it left, having fed its carrier, and no length of stone repeals that — the axle
  does. Expansion reads as the economic conclusion rather than an ambition.
- **Both hints trimmed.** The victory hint named the two cards to climb with (`— build Roads (🪙+🔨)
  and conquer (⚔️)`); the failure hint closed on "overreaching your economy ends the run in ruin",
  which is the universal collapse every mission runs. Neither is this mission's to teach.
- **The Wheel sticker** says `Any card that costs 🔨`; it was the catalogue's only "pays".
