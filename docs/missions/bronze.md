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

## Balance ⬜ (fixtures cut, pass open)

Fixtures `bronze_city` / `bronze_port` — one 32-card deck on both boards, at the standing protocol
(`greedy`/`planner` @100, `prover` @10, default beam and scorer).

| | greedy @100 | planner @100 | prover @10 |
|---|---|---|---|
| City | 0% | 1% | 3/10 proven |
| Port | 0% | 0% | 1/10 proven |

**No Warband fixture.** The board's single territory is already spent on its prebuilt War Camp, so a
building deck has nowhere to build: median 4-turn runs under both policies, a degenerate cell rather
than a hard one. Chiefdom is unmeasured.

**The deck carries the Tin Route and no other trade card**, and that is a measurement, not a taste.
The A/B behind it was swept on an ad-hoc cell label with paired seeds — internally comparable, but a
different seed stream from the table above, so its rates read against each other and not against the
fixtures. Against the same deck also stocking Bartering and Coastal Route, **standing rent is the
deck's entire money pressure** — 0 bankruptcies in the 243 of its runs that never opened a route,
against 23% / 42% / 45% at a standing rent of 1 / 2 / 3 — and the extra routes crowd the
mission-critical one out of the zone: the Tin Route opens two to three times less often (28 → 76 plays
per 100 City-planner runs once they are gone). The `prover` read the same split there, 0/10 on both
boards with the extra routes against 3/10 without. A deck that pays rent it doesn't need cannot afford
the rent it does.

**The table is measured under the `missingRoute` prerequisite fix** — the tin gate was the first
`check` satisfiable only by *playing another card*, invisible to `race.ts` until its plan scan learned
to run the named route's landing clock serially in front of a gated card's own (the term vanishes once
the route stands, which is the gradient). The fix is what makes these cells *engaged* rather than
refused: Port's pre-fix `prover` baseline was ten runs of **zero actions** — the search declined at
the root — where it now plays real lines and proves 1/10. What remains under-read is the deferred
`1/handSize` delivery ticket ([sea-lanes.md](sea-lanes.md) → *Balance* holds the witness): the gate's
clock is almost pure delivery — one Tin Route copy in a 36-card circulation ≈ 9 rounds — so the cells
owe one more re-record when that ticket lands.

**What the engagement exposed is content, not scorer.** Two readings for the open pass: the Tin
Route's rent is lethal to a short-run economy that obeys the model and opens it early (City greedy
bankruptcies 3 → 15 across the fix), and the trial plan is now *visible and still unaffordable* —
runs pursue 16🔨+24🔬 of trials under Tin Hunger and starve doing it (City planner famine 24 → 51,
mean turns down a third on every policy).

**Open.** The trial's −2🔨 unplayed upkeep is un-adjudicated — keep it as pressure or cut it as a tax
on a hand the player couldn't have played. And this deck stocks none of the rebalance's measurement
debt — no **Caravans** (the 🪙→🌾/🔨 rate, still unmeasured anywhere), no **Wheel** sticker, no
**Warband** board, no **Merchant Ship**, no **Convoy** — so the debt stands, and with it the **Tin
Route**'s own rating in the first cell where its gate is load-bearing.

## Polish ⬜ (not started)
