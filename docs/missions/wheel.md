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
| greedy | 100 | 10% | 6 · 16 · 201 | 5.2 | ruin 52 · stall 19 · famine 14 · bankruptcy 5 |
| planner | 100 | **55%** | 4 · 24 · 201 | 6.2 | famine 35 · stall 8 |
| oracle | 10 | 100% | 13 · 18 · 29 | 8.0 | — |

⚠️ **The planner row is a floor, not a difficulty reading — read `oracle`/`prover` here.** Its 35 famines
are dominated by one repeated *policy* opening error, not by the mission: across 25 replayed seeds,
**9 of 9 famines** play House (+2🧍, so food upkeep goes 1 → 4/round on `floor(pop²/4)`) before the
Farm is down, and **0 of 16 non-famines** do. Three of those famine seeds were handed to `prover`, which
found a winning line in all three — Farm first, House 7–9 turns later, wins in 17–21 turns:

| seed | planner | prover |
|---|---|---|
| 10 | House T1, no Farm → famine T4 | Farm T9 · House T10 → victory T21 |
| 15 | House T1, no Farm → famine T6 | Farm T6 · House T9 → victory T17 |
| 23 | House T1, no Farm → famine T4 | Farm T7 · House T8 → victory T17 |

So the food question the mission asks **is** answerable on this deck. Same shape as the `pyramid` row's
warning, and narrower than it — the gap here is one identifiable opening, and the cause is logged as
simulator work rather than balance.

The 🔨 crisis the mission is named for shows up only in the greedy column, where 52 runs ruin: greedy
ends holding 65🔨 mean and never converts it, so read that column as the one-ply plateau it is, not as
the drain biting.

**Chiefdom is measurably harder on this same deck** — planner 30% / oracle 80% @10, famine again (68 of
greedy's 100 runs, ending at mean −0.5🌾). It gets **no fixture**: with no free slot against this
deck's four structures it is a deck problem first, and a number taken on the wrong deck would read as a
mission difficulty. Same shape as the gap logged at `roads` and `accounting`.

Those figures predate Chiefdom's **War Camp** (+3🌾 +3🔨 per 🗺️ taken), so they owe a re-measure. It
pays into famine, which is what kills this cell, and leaves the goal and `overextension`'s toll on
their own rates — a territory-paying perk would have scaled both at once.

**Writing is the deck's one dead card** — unplayed across all 200 greedy/planner runs, played once in
10 oracle runs. Kept because the deck is the one the player arrives with.

## Polish ⬜ (not started)

- Nothing yet — card display/text, art, lore.
