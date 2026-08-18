# Bronze — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ⬜ · Polish ⬜
**Branch:** Bronze — the **convergence** node: the three middle branches (Wheel+roads / Horse / Naval)
rejoin here.
**Placement:** `prereqs: ['wheel', 'raiding', 'sea_lanes']`, bronze col 11 row 0 (the three tips sit at
col 10, rows −1/0/+1).
**Reward influence:** provisional 12 (matches the standard Bronze nodes).

## Design ✅ (converged)

- **Goal:** master all **4 Casting Trial events** (4🔨+6🔬 each; playing one exiles it to `removed`,
  which the goal counts — the Copper/Roads seeded-completion pattern, tied to the objective threshold
  by a shared const).
- **The tin gate:** each trial additionally requires a **standing Tin Route** (`CardCost.check`, the
  Sea Lanes seam — `costReason` names the missing route on the card face). This teaches the gate
  *before* the tin-gated rewards land. A deck carrying no Tin Route stalls by construction — no
  safety net, by design; the gate is visible on the card and the mission flow popup shows the events.
- **Event upkeep:** an unplayed trial in hand bleeds **−2🔨** at end of round. Trial number — a copy
  drawn before any route opens is unplayable by rule, so some bleed is unavoidable; whether that reads
  as pressure or unfairness is Balance's question, and the upkeep may be cut there.
- **Pressure:** the **Tin Hunger** threat — **−1🪙 per round per mastered trial** (reads the `removed`
  count). Rising demand raises tin prices: success itself is the bill. No sibling taxes *completion* —
  Copper taxes staffing, Roads taxes procrastination, Accounting taxes the hoard — and it composes
  with the route rent into an endgame near −5🪙/round with a route open. Sequencing rule holds: 🪙
  faucets are guaranteed on every chain (Trader arrives at Accounting, upstream of all three tips).
- **Reward — two grants**, numbers provisional:
  - **Marketplace** (building): **+3🪙/round per worker**, cost ~4🔨, tin-gated on play — the Bead
    Workshop successor. 3× its rate is cross-age progression, paid for by the double gate (tin route
    + real 🔨 cost); it matches Trader's 3🪙/worker-turn while standing instead of cycling from hand.
  - **Bronze Tools** (card sticker, ~5⭐): **+1🔨**, applying to 🔨-producing buildings *and* work
    cards — `applyGain` raises an output the card has, never conjures one (the Convoy discipline).
    Its charge is a **tin gate**: `applyCost` materializes the trials' own `check` onto the stickered
    copy, which then plays only while a Tin Route stands. There is deliberately no bronze *building*:
    any tin-gated producer is outbid by a Forge wearing this sticker, so the material upgrade rides
    the sticker alone — the money cost of bronze is the route's rent, paid once for the whole kit.
- **Lore seam:** the convergence is ludic tree-narrowing, so the line has to earn the gate — the
  trade branches built the tin routes; now the smiths learn what tin is *for*. Pressure framing:
  rising prices from rising demand.

## Implement ✅ (shipped)

The `bronze` mission (bronze col 11 row 0, prereqs `wheel`/`raiding`/`sea_lanes`, 12⭐) seeding the
`tin_hunger` threat and 4 `casting_trial` events over the `bronze_goal` objective; the `marketplace`
card and `bronze_tools` sticker as rewards. The tin gate is one shared `CardCost.check`
(`needsTinRoute`, exported from `content/cards.ts`) with its own `missingRoute` reason variant; the
sticker folds the same check onto a stickered copy via `applyCost`. The threat's drain and the goal
read one `trialsMastered` tally off `removed`, so the price the threat charges can't drift from the
mastery the win counts.

## Balance ⬜ (not started)

First cell that can stock the rebalance's measurement debt: both **Caravans** (the 🪙→🌾/🔨 rate,
unmeasured anywhere), the **Wheel** sticker, the **Warband** board, **Merchant Ship**, **Convoy**, and
the **Tin Route**'s real rating (its Sea Lanes numbers were implement-stage — this is the first
mission where its gate is load-bearing).

Sweep-reading caveat: the tin gate is the first `check` satisfiable only by *playing another card*
(a route), which `race.ts`'s landing plan may not model as a prerequisite purchase — a low `prover`
row here could be the scorer failing to plan the route, not the cell being unwinnable. Attribute
before concluding.

## Polish ⬜ (not started)
