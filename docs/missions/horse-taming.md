# Horse taming — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ⬜
**Branch:** Bronze — the **military** branch's first node (Horse taming → [Raiding](raiding.md)), a `×2`
branch parallel to Wheel+roads (expansion) and Naval (trade). Prereq **Writing**; the branch converges
into **Bronze**.
**Placement:** `prereqs: ['writing']`, bronze col 8 row 0 (parallel to Roads at col 8 row −1).
**Reward influence:** 12 (provisional — matches the standard Bronze nodes).

## Identity (agreed)

Opens the arc's **plunder burst** — Raiding turns a war party into the food and material it takes,
once per copy, Naval's aggressive twin. Bonus: thickens the thin ⚔️ economy — the **War Horse** reward is the first
⚔️ producer that is a staffed work box (alongside City Walls, Bow, Dogs, Conquest). Theme: Bronze-Age
steppe (Yamnaya / Sintashta); horses as war-mounts, **no mounted cavalry** (Iron Age).

## Agreed (settled at design)

- **Reward — War Horse:** a **work card**, staffed → **+⚔️ on the turn it's played** (a work box files at
  end of turn, so it pays out once per play, not per round). Free to play (the Foraging/Trader
  shape), so the worker it occupies for that turn is its whole cost — the rate has to beat **Hunting**
  (free, 1⚔️ per worker-turn) or nobody would ever spend a worker on it.
- **Reward — Raiding:** an **action**, spend **⚔️ → gain 🌾+🔨**, **single-use** (exiles itself on play,
  the Bow shape). Single-use is what makes an inward converting edge admissible at all
  ([`DESIGN.md`](../DESIGN.md) → *Core resources*); 🌾+🔨 rather than 🪙 because those are the two pools
  Chiefdom — the board this branch is built for — is short of.

## Goal + pressure ✅ (converged)

The **goal is its own pressure**: every horse you tame is +1 toward the win *and* +1 permanent food
mouth. Capture with military, then sustain with food — a horse costs you across two resources over its
whole life, and the last horse is tamed under the heaviest drain (the Wheel "heaviest pressure at the
final push" shape, here emergent from the goal rather than a parallel threat).

- **Goal:** tame all **N Wild Horse** cards (`WILD_HORSES`). Each is a seeded `event`; **taming** = *play*
  it, paying its **big ⚔️** cost → exiled to `removed`, which the goal counts (the Copper/Roads seeded-
  completion pattern).
- **Let-pass cost:** a Wild Horse left *unplayed* in hand fires its `upkeep` (a small **prod** drain) and
  recurs — the existing unplayed-event mechanic *is* the "few to let it pass" cost, no separate
  mechanism. This is the counter-pressure against turtling (see watch item 1 below).
- **Pressure — the "Tamed Horses" threat:** drains **−X 🌾 per round**, where **X = the number of
  already-tamed horses** (Wild Horse copies in `removed`) — reads the pile the way Wheel reads
  territory. The more you've tamed, the more mouths to feed.
- **No time pressure, by design (for now).** No deadline / driven defeat: the mission is deliberately the
  arc's *relaxed* one — fits the taming theme, and varied pacing across missions is good for player
  engagement. Revisit only if balance + feel-play show it needs re-drawing.

**Implementable as-is with existing mechanics** — event play-cost + unplayed-event upkeep + a threat
whose upkeep counts a pile. No new verbs.

## Implement ✅ (shipped)

Seeded `wild_horse` events taming to `removed`; a `tamed_horses` threat scaling its 🌾 drain off that
same pile. No new engine verbs — event play-cost, unplayed-event upkeep, and a counting threat upkeep,
all on the existing spine.

- **Numbers:** 5 horses · **6⚔️** to tame each · **−1🔨** per untamed horse held at end of
  round · **−1🌾 per already-tamed horse** each round. All four held through the balance pass.
- **Reward cards:** War Horse (work, free, 1 worker → **+3⚔️ per play**, aligned with Trader's 3🪙) and
  Raiding (action, single-use, **3⚔️ → 4🌾+4🔨**).
  Neither is available *in* mission — both are granted on clear — so the goal must be reachable on the
  owned ⚔️ economy alone.
- No `defeat` hook: like Wheel, the drain runs food down to the universal `'ruin'` collapse, and
  `checkEndIf` checks victory **before** collapse, so taming the last horse on the starvation turn still wins.
- **Tests:** none new for the content itself (seeded-completion, the played/unplayed event split and
  threat upkeep are all already covered). `sim/zoneOrderInvariance.test.ts` gained a synthetic pair for
  the shape the threat introduces: a threat reading a **filtered count of `removed`** while a
  self-exiling work card mutates that zone inside the same production batch — the existing fixture only
  covered a threat reading a scalar *pool*.

## Balance ✅ — settled at its authored numbers

**No number moved.** 5 horses · **6⚔️** each · **−1🌾 per tamed horse** · **−1🔨 per untamed horse held**
stand as authored: the mission was hand-won on **Chiefdom + granary + stockpile**, and the sweep of that
same deck reads as a mission with a live failure mode rather than one that needs a knob.

**Fixture: the player's own winning deck**, on City (28 cards, 24 of the 110⭐ that have arrived) — the
Wheel deck carried forward with Road ×2 traded for City Walls ×2 and the Farm, Conquest and Hunting
lines doubled. It replaces the 20-card Dogs ×8 / Foraging ×6 sketch, whose 96/100/100 measured a deck
narrower than anything a player arrives holding.

| policy | win rate | shape |
|---|---|---|
| greedy @100 | **9%** | median 17 turns · famine 39 · ruin 32 · stall 15 · bankruptcy 5 |
| planner @100 | **37%** | median 24 · famine 47 · bankruptcy 8 · ruin 6 · stall 2 |
| oracle @10 | **90%** | 15–31 turns, median 25 · the single loss is famine |

- **Famine is the failure mode at every tier** — 47 of the planner's 63 losses and the oracle's only
  one. On this deck the herd's drain outruns two double-Irrigated Farms; the ⚔️ side never binds.
- **Three ⚔️ sources price differently** and the deck carries all three: Hunting ×4 at 1/worker-turn,
  City Walls ×2 at 1/round for a tableau slot and no worker, Bow ×2 as a burst. **Conquest ×4 spends
  that same pool on territory**, so expansion and the win condition compete for one resource — the
  tension watch item 2 predicted, now on a deck wide enough to feel it.
- **Writing is the deck's one dead card** (0 plays under both policies); House is played 0.01×/run by
  greedy and never by the planner.
- **Chiefdom + granary + stockpile** — where the deck was hand-won — reads greedy **3%** / planner
  **15%** @100 on the same seeds, and **prover 80%** @10. Unfixtured, the same open board gap as
  Accounting, Roads and Wheel. Its two declined seeds hold under a doubled beam (128) and a doubled and
  quadrupled round depth (100, 200), all three reporting `noWinFound:depth`; `deepPlanner` loses both
  (famine at 1/5 tamed, ruin at 2/5). A search reading, not a difficulty one.

## Watch items

1. **Urgency to tame promptly.** Without the let-pass 🔨 drain, the optimal line is to turtle (tame one,
   grow the Farm economy for many turns until X-food is affordable, tame the next — never letting X outrun
   food income), which is a tensionless grind. The unplayed-event upkeep is what forbids it — but it is
   **weaker pressure than design assumed**: it fires only on a turn the copy is *held at end of turn*,
   then files to discard and recurs, so it costs ~1🔨 per horse per deck cycle, diluted by deck size. If
   the sweep shows turtling is still optimal, the levers are a per-instance escalating counter (the
   `clay_tablet` shape) or a soft deadline.
2. ✅ **The knife-edge: ⚔️-tame-cost vs. food-economy growth** — resolved by the sweep, on the food side.
   The in-mission ⚔️ economy is thinner than the goal: **City Walls** (3🔨, no worker, +1⚔️/round) is the
   sustainable faucet, **Hunting** (free, 1⚔️/worker-turn) the repeatable one, **Bow** (2🔨 → 3⚔️, exiled)
   the burst — and **Conquest is a ⚔️ *sink*** (2⚔️ doubling per copy → territory) competing for the same
   pool. On the fixture deck none of that binds: every tier dies to famine, so the drain is what sets the
   difficulty and the ⚔️ side is slack.
3. **The double-bind moved onto workers.** The design premise — Dogs buying ⚔️ *with food* against a food
   drain — lapsed when Hunting became a free work box: taming is now paid in **worker-turns**, and the
   same workers are what farm. The squeeze survives in that form, and it is the binding one.
4. **First levers, in order:** `WILD_HORSES` → the tame ⚔️ cost → the drain coefficient → the let-pass 🔨
   bleed. Peak sustained drain is `(N−1) × coefficient` (the Nth horse wins on the move), so at 5 × 1 the
   heaviest round is −4🌾. A longer ramp is the mission's shape, a steeper one is not — so raise **N
   before the coefficient**. War Horse sits at +3⚔️, level with Trader's 3🪙 per worker-turn; if it still
   sweeps too strong, give it a 1🌾 cost rather than cutting the worker cap, which would just flatten it
   back into Hunting's shape.
- **Sweep on:** `scripts/sim/baselines/horse_taming.json`.

## Polish ⬜

Not started — card text, art (🐎 / 🐴 / 🏇 / 🔥 are provisional), lore.
