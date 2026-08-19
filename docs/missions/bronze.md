# Bronze — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); final decisions →
> [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ⬜
**Branch:** Bronze — the **convergence** node: the three middle branches (Wheel+roads / Horse / Naval)
rejoin here.
**Placement:** `prereqs: ['wheel', 'raiding', 'sea_lanes']`, bronze col 11 row 0 (the three tips sit at
col 10, rows −1/0/+1).
**Reward influence:** provisional 12 (matches the standard Bronze nodes).

## Design ✅ (converged)

- **Goal:** master all **4 Casting Trial events** (**4🪙+6🔬** each; playing one exiles it to `removed`,
  which the goal counts — the Copper/Roads seeded-completion pattern, tied to the objective threshold
  by a shared const). The pour is bought in **money and knowledge**, not in labour: tin is a thing that
  comes off the islands at a price, and the age's throughline is the money economy.
- **The tin gate:** each trial additionally requires a **standing Tin Route** (`CardCost.check`, the
  Sea Lanes seam — `costReason` names the missing route on the card face). This teaches the gate
  *before* the tin-gated rewards land. A deck carrying no Tin Route stalls by construction — no
  safety net, by design; the gate is visible on the card and the mission flow popup shows the events.
- **Event upkeep:** an unplayed trial in hand bleeds **−2🔨** at end of round, and it **stays**. A copy
  drawn before any route opens is unplayable by rule, so some bleed is unavoidable — that is the cost of
  holding a furnace you cannot fire, and it is what makes opening the route early matter.
- **Pressure:** the **Charcoal Fuel** threat — **−1🔨 per round per mastered trial** (reads the `removed`
  count). Every mastered pour is a furnace kept lit and fed: success itself is the bill. No sibling taxes
  *completion* — Copper taxes staffing, Roads taxes procrastination, Accounting taxes the hoard.
  **The bill lands on a different pool from the price.** 🪙 buys the pours and pays the route's standing
  rent; 🔨 feeds the standing furnaces and the unpoured bleed. Completing the goal and surviving it
  therefore compete for two pools instead of bidding against each other in one, which is what keeps a
  run from simply out-earning its own pressure. Sequencing rule holds by **ownership** rather than by
  unlock: Toolmaking sits in `STARTING_COLLECTION` and the Forge is a Stone-Age building, so 🔨 is
  producible on every chain into this node.
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
  every furnace that works must be fed.

## Implement ✅ (shipped)

The `bronze` mission (bronze col 11 row 0, prereqs `wheel`/`raiding`/`sea_lanes`, 12⭐) seeding the
`charcoal_fuel` threat and 4 `casting_trial` events over the `bronze_goal` objective; the `marketplace`
card and `bronze_tools` sticker as rewards. The tin gate is one shared `CardCost.check`
(`needsTinRoute`, exported from `content/cards.ts`) with its own `missingRoute` reason variant; the
sticker folds the same check onto a stickered copy via `applyCost`. The threat's drain and the goal
read one `trialsMastered` tally off `removed`, so the price the threat charges can't drift from the
mastery the win counts.

## Balance ✅

**Shipped as the two-pool split — trial 4🪙+6🔬 · −2🔨/round unpoured · Charcoal Fuel −1🔨/round per
mastery.** The mission was hand-piloted to a comfortable win on this form before the sweep, so the
cells below rate the policy against the content and not the content's reachability.

Fixtures `bronze_city` / `bronze_port` — one 32-card deck on both boards, at the standing protocol
(`greedy`/`planner` @100, `prover` @10, default beam and scorer).

| | greedy @100 | planner @100 | prover @10 |
|---|---|---|---|
| City | 0% | 23% | 3/10 proven |
| Port | 0% | 2% | 1/10 proven |

**The deck carries the Tin Route and no other trade card**, and that is a measurement, not a taste: a
deck stocking Bartering and Coastal Route alongside it bankrupts on the rent it didn't need and crowds
the mission-critical route out of the zone besides. Standing rent is this deck's entire money pressure,
which is why the one route it opens is the one the goal gates on.

**It carries the two Caravans** (Food ×2, Material ×2, 2🪙 → 3🌾/3🔨) **in place of Calendar and
Toolmaking**, which is what makes it the mission's own deck rather than the arc's generic one: the goal
is paid in 🪙 and the pressure is charged in 🔨, so a 🪙→🔨 conversion is the run's answer to Charcoal Fuel
and a 🪙→🌾 one buys the growth that staffs the rest. Behind only Fire and the Trader that funds them,
they are the deck's busiest plays — 320 Food / 207 Material caravans per 100 City-planner runs, and 395
Material on Port, where the single citizen makes buying production the only way to have any. This also clears the rebalance's caravan
measurement debt: the 🪙→🌾/🔨 rate is now rated in the cell whose economy turns on it.

**What the cells say.** City is the mission working: planner median 75 turns, 98 route opens and **196
trials poured** per 100 runs, and its losses are the pressure doing its job — **ruin 53** (the 🔨 pools
emptied by the standing furnaces under an unpoured hand), famine 14, bankruptcy 6, and only 4 runs
grinding into the 200-round cutoff. Port is the hard cell for the reason the board is: one citizen and
almost no room to grow, so the same drain lands with no production base under it — **ruin 82**,
bankruptcy 10, and 31 trials poured per 100 against 86 route opens. **Greedy wins neither board**, which
is the expected shape rather than a verdict: the trial chain is multi-turn setup — open a route, then
bank 4🪙+6🔬 four times against a drain that grows each time you succeed — and that is precisely the
one-ply plateau.

**No Warband fixture.** The board's single territory is already spent on its prebuilt War Camp, so a
building deck has nowhere to build: median 4-turn runs under both policies, a degenerate cell rather
than a hard one. Chiefdom is unmeasured.

**The `prover` is under-read and the cells owe a re-record.** It proves 3/10 on City and 1/10 on Port,
declining the rest at the root — the designed no-line reading, but a low one, and the deferred
`1/handSize` delivery ticket ([sea-lanes.md](sea-lanes.md) → *Balance*,
[`../TODO.md`](../TODO.md) → *Simulator · Fidelity*) is why: the tin gate's clock is almost pure
delivery, one Tin Route copy in the deck's whole circulation, so the race value prices landing it flat
while charging its full standing rent. When that ticket lands, both cells are re-swept.

**Measurement debt still standing** — no **Wheel** sticker, no **Warband** board, no **Merchant Ship**,
no **Convoy**. The **Tin Route**'s own rating, by contrast, is settled here: this is the first cell
where its gate is load-bearing, and it opens on most runs of both boards.

## Polish ⬜

Not started — card text, art, lore, beyond the threat pass: the threat is renamed **Charcoal Fuel**
(🔥), and its card comment, the mission lore's closing line and the `failureHint` all read the drain as
the 🔨 it charges (fuel, not fees).
