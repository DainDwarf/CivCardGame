# The First Trades — mission dossier

> Per-mission working state. Arc-level view in [`../BACKLOG.md`](../BACKLOG.md); the arc restructure
> that created this mission is in [`../REBALANCE.md`](../REBALANCE.md) → *Stone Age branches 3–4
> restructure*. Final decisions → [`DESIGN.md`](../DESIGN.md); measured results → `CHANGELOG.md` at
> ship. Live state only.

**Stage:** Design ✅ · Implement ✅ · Balance ✅ · Polish ⬜
**Branch:** Stone, upper (row -1) — the **money** mission, second in its branch.
**Placement:** `prereqs: ['raiders_at_border']`, stone col 3 row -1. Has **taken** the slot
`rites_rituals` held; `rites_rituals` is deleted and `first_temple` re-pointed onto this mission.
**Reward:** 8⭐ + the **Beer** card (`unlockCardIds: ['beer']`).

**Narrative.** While fighting the raiders at the border, your people met the settlements that were
*not* raiding them — and found the other tribes had things worth having. War made the border; trade
makes it worth holding.

## Design ✅

Introduces **money** and **trade routes** — the first mission where 🪙 is both produced and spent.
Its two cards are `raiders_at_border`'s reward, so they are owned before this mission is launched
(the cross-cutting sequencing rule in BACKLOG).

**The two cards** — ✅ **both reworked and shipped**, granted by `raiders_at_border` (landed ahead of
this mission so they can be played in the meantime):

| Card | Was | Is now |
|---|---|---|
| Bead Workshop | `action`, 1🔨 → 2🪙 | **`building`**, 2🔨 to build, 1🪙 per staffed worker |
| Bartering | `trade` route, 2🪙 to open, −1🪙/round, +1🌾/round | **`trade`** route, 1🪙 to open, 1🪙 rent → **2🌾**/round |

**Why the faucet is a building and not a work box.** A route's rent is charged every round
unconditionally, while a work card only pays out on the turns it is *drawn* — one copy in a ~23-card
deck reaches a 4-card hand about 17% of the time, four copies about 53%. No number of copies covers a
100% obligation, so a draw-dependent faucet funding a permanent rent runs a structural deficit into
bankruptcy. The income has to be as permanent as the debt. The same argument prices the route's 1🪙
entry: it can't be paid before the faucet is standing, so the trap of opening a route with no income
is closed by the cost rather than by a warning.

Both sit on money's **producer** side, so the one-way-hub topology holds: Bead Workshop no longer converts
🔨 into 🪙 (a worker does), and the route rents access rather than exchanging. Nothing converts the
route's 🌾 back into 🪙.

**Goal — ✅ open a 🤝 trade route and hold `FIRST_TRADES_FOOD` 🌾 at once** (25 provisional).

A 🪙 *hoard* target was ruled out: money's whole point under the one-way hub is that it is spent, so a
hoard switches the wildcard off during the very mission built around it. The route half is a
**standing** requirement rather than a hoard, and the food half is what the route is *for* — so the
card you are forced to open is also the engine that wins, which is the lesson stated as a rule instead
of as a tooltip.

Nothing ever removes a route, so the route half **latches** the moment it opens and only the 🌾 half
can fall back. That is what lets the two stand as a plain "and" without a hold-for-K-rounds term:
"keep it running" is already implied, because the rent goes on being charged whether or not the food
target is met yet.

**No threat and no events.** The standing rent *is* the pressure, and it is one the player chooses to
take on — the first obligation in the arc that isn't inflicted by the mission. Food upkeep remains the
only other clock, so a run that never opens a route simply never wins rather than losing.

**Reward ✅ — 8⭐ + Beer**, reworked from 2🌾 → 5🎭 to 1🌾 → 2🎭, and cut again at the convergence node's
sweep to **1🌾 → 1🎭** (a `work` card throughout). Same 8⭐ + one card the deleted `rites_rituals` paid;
⭐ downstream has since moved anyway, since Rites came back as a *new* node with its own faucet.

**Both Stone branch tips grant a culture card**, so the Rites-as-convergence node they'd feed
(see [`../IDEAS.md`](../IDEAS.md)) has something to play with whichever branch a player took. Beer is
this branch's.

**Why Beer is the *right* card here and not just an available one.** Priced against what has actually
landed in this pass — Foraging 1🌾/worker, Toolmaking 1🔨/worker, Dogs 1🌾→1⚔️, Bartering 1🪙→2🌾 —
Beer at 1🌾→1🎭 costs one worker-round for the box plus one Foraging worker-round for the food: **2
worker-rounds → 1🎭**, *below* the pass's 1-per-worker-round floor. What lifts it is exactly what this
mission builds: **a route pays 2🌾/round for zero workers**, so the food stops competing for labour and
the same play becomes **1 worker-round → 1🎭**, onto the floor. So Beer is *conditional on trade
infrastructure* rather than strictly better than anything — bad without a route, par with one. That
is the shape a branch-specific reward should have.

`work`, not a building: the route is permanent and workerless, Beer transient and worker-hungry, so the
two **complement**. A brewery building would put a second slot-eater on the branch whose lesson is
already that slots are the squeeze. Beer paying a slot for the turn is not a cost to design around —
it is the cap decision the unified territory rule exists to create.

✅ **The rate is now measured, at 1🌾 → 1🎭.** It was a starting number priced against landed rates
alone, with the culture *level* curve (10 / 30 / 70) un-re-read. The convergence node's sweep judged
both at once and moved this one: the curve held and Beer halved, alongside Sun Stone
([rites](rites.md) → *Balance*).

## Balance ✅

**`FIRST_TRADES_FOOD` settles at 25** — the turn times are what decide it: 13 · 15 · 16 turns at the
oracle, planner and heuristic, in line with the arc so far (First Settlement 11–16, Growing Numbers
9–16). The target is what sets the pace, and this pace is right.

**Measured** at `FIRST_TRADES_FOOD = 25`. `scripts/sim/baselines/first_trades.json` is cut on
**Settlement** — the 17-card no-purchase deck (Growing Numbers' 15 + Bead Workshop + Bartering,
i.e. `raiders_at_border`'s deck plus this mission's two cards), with the 14⭐ that has arrived by here
left unspent. Its rows are recorded in `baselines/results/`.

| policy | result | turns (min · median · max) | end 🌾 | end 🗺️ | Bartering plays/run |
|---|---|---|---|---|---|
| random @100 | 1/100 | 4 · 10.5 · 28 | 1.6 | 4.9 | 0.25 |
| heuristic @100 | 100/100 | 9 · 16 · 26 | 25.5 | 5.5 | 1.0 |
| greedy @100 | 100/100 | 10 · 33 · 53 | 25.9 | 4.0 | 1.0 |
| planner @100 | 100/100 | 11 · 15 · 28 | 25.3 | 4.6 | 1.0 |
| oracle @10 | 10/10 | 9 · 13 · 15 | 25.0 | 4.5 | 1.0 |

**Chiefdom** (6🌾 / 6⚔️ / 2🗺️ / 3🧍) — the arc's other launchable board, swept ad-hoc on the same deck
and seeds, **not** cut as a fixture.

⚠️ **Stale: taken at Chiefdom's 6🌾 start, since raised to 8** (REBALANCE → *Chiefdom*). Every number
below reads a board a run no longer launches on, and the direction is known — one extra round of
runway. Re-sweep before drawing anything from it:

| policy | result | turns (min · median · max) | end 🌾 | Bartering plays/run |
|---|---|---|---|---|
| random @100 | 0/100 | 2 · 4 · 8 | −1.4 | 0.02 |
| heuristic @100 | 13/100 | 3 · 22.5 · 44 | 2.3 | 0.75 |
| greedy @100 | 0/100 | 5 · 19.5 · 36 | −1.0 | 0 |
| planner @100 | 92/100 | 4 · 27 · 36 | 22.9 | 0.92 |

Read straight off the report, no interpretation attached:

- **Every competent policy opens the route in every run** on Settlement (Bartering 100/100 under
  heuristic, greedy, planner and oracle) — as the goal compels. Under **random** it opens in 25 runs
  of 100 on Settlement and **2** on Chiefdom.
- **Settlement takes zero defeats** across heuristic, greedy, planner and oracle. Random's 99 losses
  are famine 75 / bankruptcy 24 — the only cell where bankruptcy appears in quantity.
- **Chiefdom is famine, not bankruptcy**: heuristic 87, greedy 100, planner 8, and just 2 bankruptcies
  across the whole board (all random).
- **greedy's Settlement median is 33 turns against planner's 15**, both at 100%.
- **greedy on Chiefdom never opens a route at all** — 0 Bartering, 6 Bead Workshop plays across 100
  runs, and Dogs/Hut/Conquest unplayed too.
- Unplayed elsewhere: heuristic leaves **Dogs** on both boards (the same `sim/value.ts` gap recorded at
  missions 2 and 3), greedy leaves **Conquest** on Settlement, oracle leaves **Hut**, planner leaves
  nothing on Settlement and Hut on Chiefdom.

**The per-worker arithmetic the target was set against**, on Settlement (10🌾 / 5🔨 / 4🗺️ / 2🧍,
upkeep `floor(pop²/4)` = 1🌾):

- **One pair** — Bead Workshop (1 slot, 1 worker → 1🪙) funding Bartering (1 slot, 0 workers, −1🪙 →
  +2🌾). The second worker forages. ≈ **+2🌾/round** off two slots, and the route's half of that is
  paid whether or not a Foraging card is in hand — which is the real advantage over a Farm line.
- **Two pairs** — 4 slots (Settlement's whole board), and the third worker needs a Hut, which needs a
  *fifth* slot, which needs a Conquest. So the second pair drags ⚔️ back into a mission that looks like
  it has nothing to do with it. ≈ **+3🌾/round** for ~5🔨 more and a 2⚔️ Conquest.

The second pair's marginal is +1🌾/round for roughly ten rounds of payback, so at 25🌾 one pair plus
foraging is the line and the second is a choice rather than a requirement — which is the shape the
target was picked for.

**Settled by this sweep:**

- ✅ **The policies can reach a `trade` card.** `heuristicPolicy` was the doubt (it leaves Dogs unplayed
  at missions 2 and 3); it opens the route in every Settlement run. So a low Bartering count anywhere is
  a content reading, not a policy blind spot — which is what makes greedy's 0 on Chiefdom legible.
- ✅ **The `sim/enablers.ts` probe fix works.** The card-cost probe injected only into `removed` and
  `tableau`, so a route-counting goal read as unbankable; it now probes `tradeRoutes` too, and the
  planner opens the route 100/100.
- ✅ **Territory is not dead here**, as it was at `raiders_at_border`: Conquest is played by heuristic
  (146 plays/100 runs), planner (64) and oracle (5/10 runs), and Settlement's end territory sits above
  its starting 4 under all three. greedy is the exception at 0.

**Not this mission's to answer.** Whether the workshop+route pair scales — the route out-rates the
building it depends on, so pair *N* costs what pair 1 did with territory the only brake — is a **rate**
question about the trade zone itself, not about this mission's target. This cell can't even pose it: the
deck holds one copy of each card, so no run could build a second pair. Carried to
[`../REBALANCE.md`](../REBALANCE.md) → *money's topology*.

Left as a measured observation, not a finding: **Chiefdom is the harder cell by a wide margin** (planner
92/100 and greedy 0/100, against 100/100 for both on Settlement), failing to famine rather than
bankruptcy. And 🪙 is demanded outside routes — 30🪙 at `first_temple`, 6🪙 in Pyramid's build cost — so
the building keeps a job even where a route isn't worth its slot.

## Polish ⬜ (not started)
