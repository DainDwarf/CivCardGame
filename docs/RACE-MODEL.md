# The Race Model

A ground-up respec of the simulator's value function — the heuristic every competent policy ranks by
(`greedy`/`greedy2` argmax, `planner` leaf, `oracle`/`prover` beam). It replaces `src/sim/value.ts`'s
band scorer and the weighting half of `src/sim/enablers.ts` with a model denominated in a single
currency: **rounds**.

This document is the build contract for the `race-model` branch. Each step below is one shippable
commit (tests green), sized for one session, self-contained enough to start cold from this file.
**Merge gate:** the branch does not merge to `main` without step 3 (the deadline probe) — decided
up front, because a rounds-currency model that cannot see a ticking clock mis-prices every
deadline mission from Setting Sail onward.

## Why a respec, not a retune

Two structural faults, measured before this branch was cut:

1. **The steering signal shrinks with mission size; the noise doesn't.** Every mission-directed term
   scales off `goalProgress`'s marginal — `OBJECTIVE_WEIGHT / (target × numGoals)` — while the
   survival/staffing/accumulation bands are absolute points. Across the standing baselines the best
   per-unit slope spans **75 pts/unit (growing_numbers) to 2.5 pts/unit (pyramid)**: a 30× drift.
   On pyramid one unit of goal production is worth less than the flat staff-any-box nudge, so the
   heuristic's signal-to-noise degrades with goal size — precisely on the advanced missions. Every
   past retune fixed the ratio for one mission's target scale and silently moved it for the rest.
2. **The leaf value substitutes for search depth.** The shipped planner is depth 1, so every
   conversion chain longer than the shaping's hops needed a new hand-tuned term — the enabler model
   grew ~10 constants plus floor/suppression/netting rules, each "tuned against win-rate, not
   derived". The leaf is also expensive (two clone+`applyUpkeep` projections per eval), which is
   what forced the tiny search. The model was hand-compiling the game's strategy one mission at a
   time and falling behind.

The probes were never the problem — the mission-agnostic derivation front end
(`goalValuedResources`, the card-injection probes, worker-round pricing, everything read through
`realizedGain`) carries over intact. What dies is the *weighting*: every constant denominated in
score points.

## The model

A run is a race between the win and death. The value of a state is its margin:

```
h(G) = min(T̂loss(G), slackCap) − T̂win(G)      (+ tie-break; victory/defeat sentinels unchanged)
```

Both estimates are in rounds. Targets enter only as `need / throughput`, both sides in raw resource
units, so target-size normalization cannot appear anywhere — fault 1 is unexpressible. Three
properties fall out that the old model bought with tuned constants:

- **Time-awareness.** A producer's value is the rounds it shaves off `T̂win` — large early, zero
  once it cannot repay before `T̂loss`. The static horizons and the floors patching them all die.
- **Rational risk.** Margin trades survival against tempo continuously: collapsing in 6 rounds but
  winning in 4 is good. The old lexicographic bands could never chase a win into a survivable dip.
- **Engine value without potential terms.** Staffing a producer raises τ in `T̂win`'s denominator;
  the slope the `operating` nudge and capacity credits approximated becomes the actual derivative.

### Runway past the cap is not worth having

The margin counts `T̂loss` only up to `slackCap` rounds. Below it the value is the subtraction it always
was, bit for bit — every near-death reading, every fire-fight the model already got right, is untouched,
and so is the whole derivation above it: the horizon clamp and the deadline probes (which take the running
`T̂loss` as their search budget) all run first, and the cap is taken on the way into the margin. What it
gives up is telling two *losing* states apart when both deaths are further off than the cap, which is
accepted: near death is where losing states differ.

What it buys is a **win gradient of −1 everywhere**. An unsaturated margin is linear in runway a run can
never spend, and that is a term with no ceiling racing one bounded by the mission:

- **A win 3.5 rounds away lost to 163 rounds of food.** At `first_trades · greedy` seed 1 the whole action
  space scored `+0.000` for 163 consecutive turns, while the two actions that *win in three* priced at
  `+0.000` and **−129.0** — the second being a worker freed off a Farm whose food no goal reads. Four
  traced plateaus, all the same shape (−129 / −138.8 / −163.3 / −202.1), and ~490 stall defeats across the
  standing set under `greedy`.
- **The stall is an attractor, not an accident.** The moment the model can see the drain a plan's own
  completion creates — measured on the drain-ramp probe cut for the `wheel` family — the same arithmetic
  prefers never completing it: `masonry · planner` 100% → **0%** (30/30 stalls), ending on 162–230🌾 banked
  rather than the last huts bought, at a food clock re-derivation confirms is substantively right (3.9
  rounds by hand against the probe's 3.38, both well under a `T̂win` of 6.90). A margin that pays for
  runway pays most for the runway of a plan never carried out.
- **The cells that do win are dawdling.** Six of the standing cells take far longer over it than the
  classic scorer — `finding_copper · planner` 102.7 turns against 40.1, `finding_copper_chiefdom · planner`
  173.2 against 77.8 — which is the same preference read at a cell that survives it: the margin is flat
  over finishing, and the tie-break is then what breaks it.
- **Search does not reach it.** The prover's beam is scorer-ranked, and widening it 64 → 128 → 256 lifts
  the classic scorer (6 → 8, 2 → 5 of 10) while race stays flat and non-monotone; a 4× planner budget makes
  `accounting` strictly *worse* (4/20 → 1/20). That is the signature of a value whose optimum is not the
  win — deeper search optimizes the proxy harder — and it is what says the shape of the value is the thing
  to change.

**The scale is absolute, in rounds, and it has to be.** A cap relative to the state's own win clock —
`min(T̂loss, c·T̂win)` — is self-defeating: in the capped region the entire value is `(c−1)·T̂win`, which
*rises* with the win clock, so the model would pay to lengthen its own race. It fails the shipped
"prices a banked unit at the fraction of a round it saves" fixture at every `c` in {1.25, 1.5, 2, 3} and
under every knee shape, and the failure is structural rather than a tuning miss: a plateau that is
homogeneous in the clocks is `a·T̂win` for some `a ≥ 0`, so it is either perverse (`a > 0`) or flat
(`a = 0`), and flat removes the only term steering toward the win at all. The scale therefore has to come
from **outside the state being valued**.

Which is not the mistake `goalSoftening`'s re-unitization corrected, though it looks like its twin. A
temperature scales the *gap between two clocks*, and a gap means nothing except against the race that
folds it — three rounds behind four is not three behind forty. A cap names *how much runway is worth
having at all*, which is a fact about the horizon a run is played on and not about either clock. The two
are absolute and relative for the same reason: each is denominated in what its own question is asked in.

### T̂win — rounds to the win

Per goal `g`, a completion estimate `t_g`, folded across goals as the **bottleneck** (`max`,
softened — constant 1). This replaces `objectiveProgress`'s average, which paid the search for
over-investing in the cheapest goal.

**The softening is relative, not absolute.** Both softened folds — across goals, and across a landing
plan's payment/delivery pair — take their temperature as `constant 1 × the leading clock`, so a weight
is a function of the *relative* gap `Δ / max`. That is scale-free, which is the property the whole model
exists for: doubling every clock leaves every weight exactly where it was. It is also self-sharpening —
the tolerance narrows with the bottleneck as the win comes into reach — and it puts a floor under the
fold, since a gap can never be wider than the leader: the weakest weight any state can produce is
`exp(−1 / constant 1)`, the same on every mission.

- **Resource-threshold goal** (`measure` is a pool): `need = target − measure`,
  `τ = per-round Δmeasure` from the permanent economy, `t = need / τ`. The bank is already inside
  `measure`; a banked unit is worth exactly the fraction of a round it saves — the derived
  replacement for `HOP_DISCOUNT`.
- **Card-count goal**: `need` = copies still to land, and the plan runs two clocks at once.
  **Payment** — each copy priced in **worker-rounds** (the card-injection probe: what the copy's own `cost`
  really charges *at the state being valued* plus
  every pool the play `effect` drains, each component priced by what it costs to obtain), netted against
  the bank and then run down at the rate the run really earns it (below); a banked 🔨 shortens it, and so
  does staffing the box that mints one. **Delivery** — the copies still to play,
  divided by `k·h/D`: the plan copies a round's draw surfaces, off the run's **circulation** (deck,
  discard, hand and work zone alike) and the culture-adjusted hand size it refills to. `t` folds the two as a
  **softened max**, not a sum: earning the price and drawing the copies overlap, so the plan lands when
  the later one finishes — softened against the same temperature as the goal fold, because the clock a
  hard `max` masks is routinely the payment one, and that is the half carrying every earning and spending
  decision the run makes. Both figures are read off `G`; the census below is unchanged, the softening
  reusing constant 1 rather than adding a constant of its own.
- **Zero current throughput, deck can build it**: `t = t_setup + need / τ_achievable`, where
  `t_setup` is the worker-round price of the best goal-producer chain the probes find
  (afford → build → staff). The sole surviving descendant of the capacity/producer machinery —
  same probes, output in rounds, no constants.
- **Bespoke `met` goal**: flat, unshapeable (today's sandbox rule, unchanged).

Delivery is not a refinement of payment but the thing that gives a plan a gradient over **spending**.
Netting the bank against the price is exact, so the outstanding remainder `copies·price − bank` is
unchanged by paying for one of those copies — identical before and after the very play it prices, at
every bank level. Payment alone therefore has a slope for *earning* and none for *landing*, and a policy
taking only strict improvements will bank forever. Delivery supplies the missing half: a run holding the
whole price of five copies is no plays richer than one that has played them, but it is five draws
poorer. A copy in hand is credited when it **lands**, not while it is held.

**Both counts are over the run's circulation** — deck, discard, hand and work zone as one multiset, since
the boundary recycles the hand and files a work box back to the discard, so every one of the four is a
pile future draws still reach. Which of them a copy rests in this turn is therefore not a distance
travelled: a rate that moved when a card crossed between them would price every play by how many cards it
shifted, and would score playing the plan's own recycling card *below* holding it, the share `k/D` falling
by exactly the play that advances the plan. The rate moves when a card really enters or leaves
circulation — exiled to `removed`, spent by a landing, or standing on the board for the rest of the run —
because the draws that remain really are that much richer in what the plan needs. A recycling plan's clock
shortens through `copies` instead: the box's output moved `need`, and the copies still owed fall with it.

**A price is paid at what the board yields, not at what its people could yield.** The coming boundary pays
the plan whatever the permanent projection says it will — the standing income in the pools the price names,
converted through the same `unitCost` the debt was — and from the boundary after, the whole workforce at
that replacement rate. Dividing the entire debt by the population instead values a run by what its people
*could* be doing, which is flat over every act that puts them to doing it: a plan's priced pools are by
construction the ones no goal measures, so the producer feeding one reaches `T̂win` through no other term,
and staffing it is worth exactly nothing. The `1 +` on the redeployment branch is the boundary the
projection already measures rather than a new constant — the two branches meet at it, and without it they
part by a whole round at the crossover, which is a state the beam could score two ways.

**A run with no income in a priced pool is one that has yet to deploy its people, not one with no plan.**
So the zero-income case falls back to the whole workforce a boundary later — today's clock, plus the round
the redeployment takes — rather than to `∞`. The sharper alternative, counting only the *idle* citizens as
redeployable, prices the fiction better and breaks on the common shape: every citizen staffed on something
the plan doesn't price sends payment to `∞`, the goal then reads `'none'`, and staffing a food producer on a
mission whose goal isn't food becomes catastrophic in a value function that should be paying for the runway.
(The root's keep test is not what forces this: it is decided on a price having a rate to convert through and
the deck having the copies, and reads no payment clock at all, so an infinite one could never have derived a
plan out of existence — it would have flattened the leaf.) Within a plan's priced pools the income sums as
one worker-round rate, the same fungibility `outstanding` already assumes summing a bag of pools into one
debt; income in a pool the price does *not* name is never counted, which is the discrimination that matters
— a Farm's food pays nothing toward a price quoted in coins.

**A work box is a landing, not a producer.** Its `produces` fires once per play rather than once a round,
so what it delivers is a delta to repeat rather than a rate to collect — and for a goal no standing card
moves (territory, taken by Conquest and Road) it is the only route there is. The delta is that output read
at **one staffed worker**, the conservative floor; the price is the card's plus **one worker-round per
play** — the citizen who spends the turn running it, added straight to the worker-round sum rather than
converted, being already in that unit. A landed box files back to the discard, so the copies the run holds
are dealt again: six units off two boxes is a cadence, not a plan the deck is short for.

**And that citizen has to be free.** A box produces nothing unstaffed, so the delivery half of its landing
is the deck's rate *plus* the wait for somebody available: nothing where a citizen is idle, one boundary
where the whole workforce is standing in the tableau, and unreachable only where the run has no people at
all. Availability is read off the **tableau** alone, the way the permanent projection reads the economy —
the boundary files a box back to the discard and strips its staffing, so a citizen running a box this turn
is one the next play has, and counting them as committed would charge the wait to the very play that staffs
a box. One boundary rather than one per copy, for the same reason: the citizen freed for the first play is
the one every play after it runs on. The `1` is the boundary the projection already measures, exactly as
`paymentClock`'s is — a redeployment is the same event in both — and not a new constant; a citizen in the
wrong box is one move and a turn from the right one, never unreachable, which is the reading that would
derive the goal out of existence. Without it a goal only a box can reach reads a short finite clock on a
state where nothing can land at all, and the citizen who would unblock it is priced as pure liability: the
food a new one eats reaches `T̂loss` while its enabling of the only route there is reaches nothing.

**Room is part of a structure's price.** A plan whose card is a structure owes one territory slot per
copy, netted against the **free** tableau rather than the territory pool, since land is spent by standing
on it. It is the one component exempt from the "every price component needs a `unitCost`" rule up front:
the shortfall is converted through `replacementCost`'s territory figure where the run has one and reads
unreachable where it doesn't — which is what a full board with nothing minting land is. Without it a
board-filling plan is flat over the play that unblocks the board, because a box minting a slot only ever
*costs* on every axis the plan does price.

**A price belongs to the copy that pays it, so it is read at the leaf.** A cost is not a property of a card:
a price that doubles per play and a sticker bought onto one copy both make the same route two different
prices over one run. So a plan carries no price at all — every clock reads what the *next* play would
really charge, through `rules/cost.ts`'s `currentCost` (the one seam a price may be read through, sticker
fold then the card's own curve), off the **cheapest copy the run still circulates**. Cheapest because that
is the copy the run spends next, which also keeps the quote monotone over the plan's own progress; over the
circulation for the reason the delivery clock counts it there, since a price read off the hand alone would
flicker with the deal. The root's scan runs the same function at the root's own state, so the ranking that
keeps a route and the clock that takes it can never disagree about what it costs. Without it a plan goes on
calling a route cheap long after the run has priced itself out of it — six 🗺️ through a Conquest that
doubles per copy read as 10 worker-rounds against a real 15.3, and the crossover against Road's flat price,
at the third play of a copy, was invisible.

Every route a goal has is costed and the **soonest** taken — no test of whether the standing economy
"needs" a plan. `min` is the honest fold over alternatives, where a gate deciding which route to price
is a branch that can fire the wrong way. That holds *within* a kind of route as much as across the kinds:
the root keeps every card whose route is **deliverable there** — a price with a rate to convert through
and copies the deck can deal — rather than the one that ranked cheapest per unit, and each leaf takes the
soonest of what it kept. Price and deliverability are independent questions, so an argmin over the first
alone plans a goal through a card the run cannot circulate and drops the dearer one it can. The kept set
is a handful — one or two per goal across the standing set — so the leaf pays a clock apiece for the
reading that decides it. What the root filter may **not** fold in are the rates the payment clock runs at —
the run's income and its workforce: those are facts about the moment, gated at the leaf, and a root with no
citizens must not derive itself out of every plan it has. The workforce the redeployment branch is paid at
is the **population**, not the workers currently in boxes: a pool's worker-round price is the output of a
worker standing in the best box for it, so a denominator counting only staffed workers would disagree with
its own numerator about the same person.

All `t` clamp at the remaining drive cutoff; a goal past the horizon reads dead, tamely.

**Projection cost.** τ and the drains come from **one** stripped projection (the old
`permanentDelta` clone: transients dropped, one `applyUpkeep`). Pending one-shot output (a staffed
work box this turn) must still be visible pre-`endTurn` so staffing registers immediately — read it
directly off `workZone` card data (`producingUnits` arithmetic, no clone) instead of the old
second full projection. Net: one clone per leaf instead of two; the saving is earmarked for search
depth, not pocketed. A run that circulates an `event` spends the saving again on the boundaries below —
four of them across three clones — as with the deadline probe's own extra clone, read a slower `raiding_*`
or `writing_*` sweep as that and not as model noise.

**A recurring event is charged at its circulation rate.** The hand is dropped whole, events included, and
they are charged back as a rate. An `event` left unplayed is not an incident: it fires its `upkeep` at the
boundary, files to the discard, and the deck deals it back, so a mission whose whole pressure is a
recurring event drains for as long as the run circulates the copies. The share of boundaries a copy spends
in hand is `hand / pool` over the **same circulation** a delivery clock counts — deck, discard, hand and
work zone as one multiset, capped at 1 where the hand is the whole pile — so the rate is the per-boundary
disaster scaled by it, summed over the copies in circulation. Charging it instead by whether a copy sits in
hand *right now* prices a duty cycle of 100% against one of 0%, and the death clock then flickers between
the whole drain and `∞` as the deck turns over. A copy in `removed` is out of circulation and charges
nothing, which is exactly what playing an event to defuse it buys.

The amount is measured, never read: each boundary settles every circulating copy through the same
`applyUpkeep` at the slot the engine does (its own `resolveHandEvents`), and the two worlds it is settled
in differ by the events and by nothing else. That is what reaches an amount a card computes in a `resolve`
closure — an escalating drain reading a counter it bumps has no declarative bag to read. Every non-event
hand card drains nothing and files itself away at the same boundary, so dropping it costs the walk nothing.

**And it is charged at the rate it will deepen to, not the one it stands at.** A single reading is one
number, and a drain that rises every time its copy comes round is not one number: Stronghold takes
2🪙 then 4 then 6, and `pool / drain` at today's level promises rounds the run will not get. So **two**
consecutive boundaries are settled in each world, and the events' own marginal at each is the difference
between them — a diff of the two diffs, which cancels whatever the rest of the board did in between (a
threat escalating on its own clock included). Their rise `Δ` is what one resolution deepens by. At a
circulation share `s` a copy resolves `s` times a round, so `t` rounds of pressure take
`s·d₁·t + s²·Δ·t²/2`, and the death clock is that quadratic's positive root — **exactly** the flat
`level / (s·d₁)` where `Δ` is zero, which is what leaves every non-escalating clock in the standing set
bit-identical. A drain that *eases* is held flat at what it takes now rather than projected toward zero and
a clock toward `∞`: the model may read a pressure short, never read one away. A drain starting from
nothing (Clay Tablet's first resolution takes 0🔬) is the shape one boundary cannot see at all — no drain,
no rate, no clock — and the quadratic still has a root.

### T̂loss — rounds to death

`min` of:

- **(a)** each draining core pool's runway off the same stripped projection — `pool / drain`, or the
  quadratic root above where the drain deepens. This is where a recurring event's disaster enters, at
  whatever its own resolver really takes, scaled by the share of boundaries the deck deals a copy into
  hand for;
- **(b)** the drive cutoff, `maxRounds − round` (threaded via `searchBoundsFor`, as for the oracle);
- **(c)** each threat's **frozen-world probe** (step 3): clone `G`, repeatedly run *that threat's
  own* `resolveEndTurn` (its whole per-round broadcast, not the `upkeep` slot alone — a threat
  keeping its counter in `on.endTurn` would otherwise probe as a clock that never advances) +
  `defeat` hooks with everything else frozen, counting rounds until the
  defeat fires, capped at (b). No new field on any card — the threat's hooks already describe its
  clock (per the sim-is-a-consumer rule). It is a per-leaf read, so pace clocks work unauthored:
  `impatient_crews`'s probe yields exactly `CREW_PATIENCE − idle` from whatever state is being
  evaluated — a leaf that just launched sees its clock reset, one that banked instead sees the
  shrunken window. The null-play assumption is the correct pessimism: acting on a clock is the
  search's job; seeing it is the value's.

Near-death softening (constant 2): where `T̂win > T̂loss`, steepen the cliff — decaying with `T̂loss`
rather than gated on its smallness — since the estimates are noisy and the beam must not surf one
round from famine on the strength of a projection.

### The complete constant inventory

Discipline: **every constant states its units and why it is tuned rather than derived.** Census —
five, down from ~15:

1. **Bottleneck softening** — how much non-bottleneck goals still pull (pure `max` has zero
   gradient on them and would let the beam abandon side goals). Dimensionless: a fraction of the
   leading clock, not a number of rounds, so the gap it tolerates scales with the race it folds. Held at
   0.4 against a four-way sweep, re-run at the final shape (below).
2. **Near-death penalty steepness** — dimensionless, a multiplier on a losing margin decaying with
   `T̂loss`. Tuned because it prices the *noise* in two projections rather than anything the state
   holds: a beam must not surf one round from famine on the strength of one. Held at 4 against a
   five-way sweep (below).
3. **Tie-break weight** — banked worker-round wealth among equal-margin states (band 5's heir,
   in-currency); sized so its maximum stays below the smallest meaningful margin step. Counted only
   over the bank *past* what a goal's plan already spent: what a plan has earmarked is already priced
   into `T̂win`, and counting it twice would break the tie toward the bank — preferring the price to the
   thing the price buys.
4. **`VICTORY` sentinel** (unchanged).
5. **Slack cap** — rounds of runway worth having, past which the margin stops counting `T̂loss` (above).
   Absolute rather than a fraction of anything in the state, which is the one thing this constant cannot
   be: a scale read off `T̂win` makes the capped region reward a longer race. Tuned because it prices how
   far ahead a run bothers to look, which is nowhere in `G`.

### Fate of every old term

| Old | Fate |
|---|---|
| `objective` band (`×OBJECTIVE_WEIGHT`, ÷target) | replaced by `T̂win`; the normalization bug is unexpressible |
| `collapseCliff` / `buffer` bands | replaced by `T̂loss` + near-death penalty |
| `operating` nudge | falls out of τ |
| `accumulate` band | tie-break term, in worker-rounds |
| `HOP_DISCOUNT`, conversions | derived: a bank is worth exactly the rounds of production it stands in for, so the over-credit `HOP_DISCOUNT` bounded is unexpressible and there is nothing left to discount. Exactness leaves the payment term flat over its own plays, which is what the delivery clock answers |
| capacity terms, both horizons, `CAPACITY_CAP`, intrinsic floor | `t_setup`, derived, no constants |
| `producerCredit` + cap | falls out of τ / `t_setup` |
| `handSize` credit | **deleted, unreplaced** — a diffuse effect the search should see via depth; re-added only if the step-4 paired sweeps prove the loss |
| probes (`goalValuedResources`, card-injection, worker-round pricing), `realizedGain` reads | carried over as-is |

### Invariant tests (synthetic fixtures)

- **Scale invariance** — the test that makes fault 1 unrepeatable: two synthetic objectives over
  the same economy whose measures/targets differ only by a scale factor `k` must rank corresponding
  states identically.
- **Conversion soundness, in time**: playing an affordable conversion is never worse than holding its
  bank — the payment halves are equal by construction, so what the test pins is that they don't come
  apart and that the tie-break doesn't quietly prefer the bank.
- **Landing is progress**: on a bank that covers a plan outright, playing one of its copies scores
  strictly higher, and a run that has lost a copy it still needs reads the plan as unreachable. The
  invariant the payment term alone cannot hold.
- **Circulation invariance**: a recycling copy moved between hand, discard and work zone leaves every
  clock and the value bit-identical; a copy that really leaves circulation still shortens a delivery
  clock, and landing a plan copy beats landing a card the plan doesn't read. The same holds of a
  **recurring event's** death clock: finite from the discard, unmoved by the pile the copy rests in,
  doubled by a second copy, nothing at all once a copy is exiled, and never past the drain one boundary
  really takes. **Escalation honesty**: a deepening drain's clock is shorter than the flat read at its
  current counter and matches the closed form on a hand-computable fixture; a flat one is the plain
  quotient rather than a number close to it; one starting from nothing is finite; one that eases holds.
- **A box needs somebody to run it**: with a citizen free the landing clock is the deck's own rate bit for
  bit; with the whole workforce standing in the tableau it is a boundary longer and still finite; a landing
  that stands nobody is unmoved either way; and freeing a citizen — the same person, out of the tableau —
  strictly improves the value at an unchanged payment clock.
- **Income is what pays**: a producer of a priced pool standing and staffed shortens the payment clock, and
  staffing one already on the board strictly improves the value; a run with no income in that pool keeps its
  plan at a finite clock; and the rate is the leaf's own, so a producer staffed long after the root is read
  at the leaf that staffed it rather than at the root's standing economy.
- **Room is priced**: a structure plan against a full board scores strictly below the same plan with a
  slot free.
- **The price is the state's**: a route whose card escalates is quoted at what the run's cheapest remaining
  copy charges *now* rather than at its printed floor, and at the copy a play would really be made with —
  while a card whose cost does not scale reads exactly as it did, so a counter no price consults moves no
  clock. The root ranks its routes at the same reading, and which pile the priced copy rests in changes
  nothing.
- **Deliverability outranks price**: a goal whose cheapest-per-unit card the deck cannot deal plans
  through the dearer one it can, and reads that card's clock.
- **The choice is the leaf's**: two kept routes whose clocks invert between two states are each taken at
  the state where they win — the pin that the root ranked nothing.
- **Deadline honesty**: a producer that cannot repay before `T̂loss` contributes ~0.
- **Clock visibility** (step 3): a synthetic counter-clock threat's probe equals its authored
  countdown from any mid-run counter state.

### Watch items

Named up front so the first friction isn't a surprise: small-τ clamping must be numerically tame
(everything past the horizon reads equally dead — correct, but plateaus); card-count goals step
`T̂win` discretely, with the worker-round bank term as the intended smoother; and the model
deliberately leans on depth-2 search for short build chains now that the diffuse nudges are gone —
that bet is priced by the step-4 sweeps.

Two more, measured on step 2's landing plans and recorded before step 4 reads a sweep:

- **A hard `max` masked the payment gradient — measured, and closed.** The crossover was not convergent:
  a plan whose delivery binds hides payment entirely, and payment is where the run's earning and spending
  live. On paired 30-seed sweeps a hard fold sent both planner cells to **0%** (`masonry` from 96.7%,
  `writing` from 93.3%) while fixing `masonry · greedy`; softening it against the existing
  `goalSoftening` carries `masonry` at 100% under both policies and lifts `writing · greedy` to the
  classic scorer's own rate. The soft fold is the shipped form. `writing · planner` — open here for a
  while at 59 vs classic's 84 — closed when the recurring-drain rate charge landed, and stands at 93.

  **Re-tested against a live `T̂loss`, and it still holds.** The obvious next attempt is that the hard
  fold only failed because the death clock was blind — give the margin a real `T̂loss` (the hand-event
  settle above) and the masked payment gradient stops mattering, because survival supplies one. It does
  not. The candidate was the *serial spill*, `t = t_deliver + max(0, outstanding − workforce·t_deliver) /
  workforce`, which reads as a derivation but is algebraically **exactly** `max(payment, delivery)` — the
  same hard fold. On paired 30-seed sweeps with the hand-event settle already in, it reproduced the
  original fingerprint: `masonry · planner` 100% → **0%** (30/30 stalls), `writing · planner` 56.7% →
  **0%**, `raiding_city · planner` 50% → 20%. The mechanism is the one named above and it is not
  conditional on `T̂loss`: where the deck is slower than the workforce — the common shape — a hard fold
  leaves `T̂win` flat over every economic decision the run can make, and a beam with a flat objective
  idles to the cutoff. Any future candidate here must keep a gradient on the **non-binding** clock.

  **A soft fold at an absolute temperature kept one only nominally, and the relative temperature is the
  attempt at a real one.** A weight of 1e-6 is a gradient in name and not in arithmetic, which is what
  the standing set showed at constant 1 = 1 round: `wheel` banked 352🌾 while its payment half weighed
  4.8e-6, `first_temple`'s population goal weighed 9e-14, and `growing_numbers · planner` won every seed
  in 57.7 mean turns against the classic scorer's 14.6 — nothing rewarded finishing a goal already at
  100%. Both fingerprints are the hard fold's shape, one step weaker. A 30-seed diagnostic over the two
  shapes plus three controls picked the fraction from 0.15 / 0.25 / 0.4 / 0.6 — the dawdle closes at every
  one of them (`growing_numbers · planner` 62.6 → ~20 turns), while 0.15 is sharp enough to reproduce the
  hard fold's own failure on `masonry · greedy` (100% → 23%). The referee confirmed the closure at
  100 seeds: the `growing_numbers` dawdle fell 57.7 → 20.9 mean turns at held 100%, controls unmoved.

  **Re-verified at the final shape, and 0.4 stood.** That pick predates six shape fixes — the circulation
  rate, escalation, board-yield payment, leaf-read prices, the staffing wait and the slack cap — so the
  fraction was re-swept over {0.15, 0.25, **0.4**, 0.6} × twelve fixtures × both policies × 30 paired
  seeds, the incumbent carried as the control. Set-wide wins peak at it: **541 / 550 / 565 / 561** of 720
  across the ladder — a 4× range of the constant spanning 24 runs. That set-wide flatness is not per-cell
  flatness, and the difference is the whole verdict: the deciding cell below steps 40pp between 0.25 and
  0.4, so the incumbent is the first grid point *above* a cliff rather than the middle of a plateau, and
  the interval between the two is unprobed. The dawdle it was cut for stays closed at every value (`growing_numbers · planner` 20–24 mean
  turns against the 57.7 the re-unitization cut), and the sharp end no longer bites: `masonry · greedy`
  reads 96.7% → **93.3%** at 0.15, two seeds against one handed back, where the hard fold's own
  fingerprint on that cell was 100% → 23%. What decides the ladder instead is a cell this constant was
  never argued on — `raiding_city · greedy` **73.3% → 36.7%** at 0.15 (12 clean win→loss against 1 back,
  bankruptcy 7 → 17) and 33.3% at 0.25, a sharper fold racing the goal on a money drain it then cannot
  outrun; 0.6 costs `first_temple · planner` its perfect column instead (100% → 90%). So the fraction is
  bounded on both sides by survival rather than by the dawdle that first cut it.
  **`harsh_winter` is byte-identical at all four values under both policies**, which is the sweep's
  control and not a finding: a single goal on a `throughput` route folds nothing and prices no landing, so
  the constant cannot reach it at all. Eight of the twelve fixtures are single-goal and see the constant
  only through `landingClock`, which is why a fixture set chosen for this constant has to carry the
  many-goal cells deliberately.
- **A payment clock divided by the raw workforce had no derivative at all — measured, and closed pending the
  referee.** Traced over `first_trades · greedy` seed 1, which stalls from turn 38 to the cutoff holding
  Bartering, one coin short, with a Bead Workshop standing unstaffed and a citizen free: forcing
  `assignWorker → Bead Workshop` wins at round 41, and the model scored it **+0.000** — as it scored every
  other action in the space, the tie-break's `wealthRounds` having been the only live gradient for the
  sixteen turns before that. The mechanism is the one above and it is set-wide: ~490 stall defeats across the
  standing set under `greedy`. Cross-checked at `rites_rituals · greedy` seed 3, whose plateau sits at a core
  bank of 17 — well under `wealthCap`, so the cap is a last straw and not the disease. Charging the price at
  the board's own income breaks all four traced plateaus: over the first ten seeds `first_trades · greedy`
  goes 6 → **10** wins, `rites_rituals · greedy` 7 → **10**, `roads · greedy` 2 → **4** (and its two standing
  wins land at 106 and 91 turns against 175 and 180), while `harsh_winter · greedy` is unmoved seed for seed
  — the survival cell whose 89% the loss half bought. At the root it moves 26 of the 30 standing cells'
  `T̂win` by **+0.02 to +0.97** rounds and no route or reachability at all: a root has nothing staffed, so it
  pays the redeployment boundary in full. What it does **not** reach is a box that must be played *before* it
  can be staffed — `inFlight` gates on `isOperating`, so an unstaffed box still produces nothing and a plan
  priced in no pool at all has no income to read. `horse_taming · greedy` is unmoved at 0 of 10, which is
  that shape and the next bullet's.
- **The greedies stall where a box must be played and then staffed.** Playing a work box unstaffed
  spends the bank and moves `need` by nothing — `inFlight` reads only an *operating* box, so the whole
  payoff waits on a worker arriving after the play. A one-ply policy cannot pair the two, and on `wheel`,
  whose only route to 🗺️ is Conquest and Road, it hoards instead: 351🌾 and 224🔨 banked, 78 stalls in
  100. The staffing lookahead confirms the shape without buying the wins — `greedy2` plays Conquest 77
  times to `greedy`'s 26 and stalls 6 runs in 30 against 21, converting 10% → 16.7%. Read a
  `wheel · greedy` figure as a measurement of that sequence rather than of the model; `wheel · planner`
  is 50% over 100 seeds. It is step 5's staffing rider that this belongs to, not a term here.
- **A distinct-count goal over-counts its copies.** `growing_numbers_goal` measures *distinct*
  building ids present; the probe reads `delta = 1` off whichever is cheapest and the clock then asks
  for `need` copies of that one card, which would move a distinct count by exactly 1. The estimate is
  optimistic and, being root-derived, doesn't correct as ids land — and delivery now turns it pessimistic
  instead wherever the deck holds fewer copies of that card than the goal names. Don't misattribute a
  `growing_numbers` regression to the fold.
- **A recurring event charged by presence made the death clock flicker — measured, and closed pending the
  referee.** Traced over `raiding_city · planner` (classic 87%, race 67%, bankruptcy 12 → 33), whose whole
  money pressure is four seeded Strongholds cycling through the deck: the money clock was finite **iff a
  copy sat in hand**, a duty cycle of 26–42% across seeds 0/2/9/13, so on 58–74% of turns bankruptcy read
  as impossible and `T̂loss` jumped 199 → 6 → 194 → 2 turn to turn. Seed 0 died bankrupt at round 21
  holding 59🌾, having never valued the drain at all. The circulation rate above closes the flicker: that
  root now reads money at 0.84/rd against 2.00 (the one copy that happened to be in hand), and seed 0
  replays to bankruptcy at round **188** with 33 Trader plays against 0 — a reading, not a verdict, which
  is step 4's.
- **The rate it was charged at was still today's, and an escalation made that a promise — measured, and
  closed.** Charging the circulation rate off a *single* boundary reads a deepening drain at each copy's
  current counter, so `pool / drain` overstated the runway of exactly the missions whose whole pressure
  escalates. The referee found all four `raiding_*` cells worse for the circulation fix alone
  (`raiding_city · planner` 67% → 49%, bankruptcy 33 → 42; `· greedy` 53% → 43%): the presence charge it
  replaced had been *compensating* for the blindness by over-charging a held copy. The second boundary
  above measures the rise instead of assuming it away. At the root it moves four cells and no others:
  `raiding_city` money 14.25 → **9.50** rounds (Δ 8🪙 a resolution over four Strongholds) and
  `raiding_chiefdom` 11.88 → 8.27, both becoming the binding clock over food; `writing` and
  `writing_chiefdom` read a science clock at all for the first time, five Clay Tablets deepening 5🔬 a
  resolution off a first boundary that takes nothing. Their science sits at **0** at the root, and a
  cumulative take with no first-order term has its root at the origin, so those two read `T̂loss` 0 — where
  the discrete truth is that nothing is taken until a copy comes round a *second* time, some `2 / share`
  rounds out. A continuous cumulative form cannot express "the first resolution takes nothing"; the reading
  it gives is the one this model has always given an empty pool under a live drain, and the level-0 case is
  pinned in the suite rather than papered over. Whether that steepness helps a mission whose defeat *is* a
  science collapse is a referee question: `writing · planner` replays 10 seeds to the same 9 wins and the
  same defeat, so it is not the disease it looks like. Seed 0 of `raiding_city · planner` now replays to a
  stall at the cutoff with 3 of 4 Strongholds played rather than to bankruptcy — again a reading, not a
  verdict.
  What this does **not** reach: τ still carries the events at the flat first-boundary rate, since the goal
  clock is `need / τ` and linear throughout. No shipped goal measures a pool an escalating event drains —
  Writing and Raiding both count copies in `removed` — so the two do not meet today.
- **A plan quoted the printed price forever — measured, and closed pending the referee.** Traced over the
  `wheel` family, whose only routes to 🗺️ are a Conquest that doubles per copy and a flat Road: the plan read
  Conquest at 2⚔️ on 133 of 133 traced turns while the run's copies stood at 4⚔️ and 8⚔️, and re-deriving the
  model at the plateau reproduced the stale figure bit for bit — so step 5's per-replan re-derive does not
  reach it either. Reading the price at the leaf closes it (above), and the cell it moves is not the one it
  was traced on: over 30 paired seeds `raiding_city · planner` goes **60% → 93.3%** (stalls 6 → 0,
  bankruptcy 6 → 2, mean turns 75.5 → 40.0) and `· greedy` 70% → 73.3%, the escalating Stronghold being both
  the money pressure *and* the card the goal counts, so the plan was quoting 8⚔️ for copies that had hardened
  to 11 and 14. `wheel` itself barely moves — `· planner` 46.7% → 43.3% (3 win→loss against 2 loss→win,
  which is noise at 30 seeds) and `· greedy` unmoved — because mechanisms 1 and 2 of that trace were both
  open here: the plan does not price the drain its own completion creates, and a landing clock had no term
  for the citizen that runs the box. Read the wheel figures as confirmation that this was one of three and
  the smallest, not as a verdict on the fix. Mechanism 2 is closed in the bullet below; **mechanism 1 is
  still open**, and it is where the wheel family's remaining stalls sit.
  The **root** valuation of the whole standing set is unmoved, and that is the probe's blindness rather than
  the fix's: every counter is zero at a root, so `currentCost` there *is* the declarative price. The two
  shipped scaling cards are Conquest and Stronghold; the one other thing the seam newly reads — a cost
  sticker on a plan's card — reaches no standing cell, the stickered Farms sitting in decks whose missions
  never plan through a Farm.
- **A landing clock had no term for the citizen that runs the box — measured, and closed pending the
  referee.** The wheel trace's mechanism 2: `deliveryClock` is pure draw rate, so on a state whose every
  citizen was standing in the tableau the goal read 9–15 rounds while nothing could land at all, and the
  citizen who would unblock it was priced as pure liability — its food against `T̂loss`, its enabling of the
  only route against nothing (`play House` at **−160**, `unassignWorker` at **+0.000**, a granted citizen at
  **+2.474** on the state the model scored flat). The staffing wait above closes it, and the reading is the
  arithmetic: at `wheel · planner` seed 1 round 8 (Farm and Forge each holding a citizen, none idle)
  `unassignWorker forge` is now the **top-ranked action at +1.011** — exactly
  `landingClock(5.167, 14.125) − landingClock(5.167, 13.125)` — while `unassignWorker farm` stays at −172,
  which is the discrimination the term is for: the model frees the citizen whose box pays nothing toward the
  race and keeps the one feeding the food clock. It reaches a line whose every *taken* state has a citizen
  free, too, since a candidate is charged what it commits: playing a building that takes the last idle
  citizen is a route a boundary slower, which is a cost the model had no way to see.
  Over 30 paired seeds `wheel · greedy` goes **3.3% → 36.7%**
  (10 loss→win against no win→loss) and the hoarding signature the trace named goes with it
  (mean end bank 220🌾/283🔨 → 52/20) — but the defeats trade rather than vanish, **stalls 21 → 2 against
  ruin 6 → 17**: the run now spends where it hoarded, and what punishes spending here is the toll its own
  expansion creates, which is mechanism 1. `wheel · planner` **43.3% → 53.3%** (7 loss→win against 4
  win→loss, stalls 16 → 13); `wheel_chiefdom · planner` holds at 50%. The controls are untouched: `raiding_city ·
  planner` (93.3%) and `harsh_winter · greedy` (86.7%) replay **byte-identical**, and `first_trades · greedy`
  stays at 100% (mean turns 15.2 → 15.8). The **root** valuation of the whole standing set is likewise
  unmoved — a board's prebuilt structures take no workers, so every root has its full population free and
  all 54 costed routes read a wait of 0. What this does **not** reach is a *building* route, which also needs
  a citizen to produce and is charged no wait; nor mechanism 1, which is what `wheel · planner`'s remaining
  13 stalls are.
- **The slack cap's own number, picked off a five-way sweep — measured, and closed pending the referee.**
  `slackCap` ∈ {∞, 15, 25, 35, 50} rounds over twelve fixtures × both policies × 30 paired seeds. The
  control is the constant at `∞`, which is the uncapped model *by construction* (`min(t, ∞) = t`), so every
  candidate is paired against the incumbent on the same seed streams rather than against a remembered
  figure. At **25** the plateau cells collapse at held win rates — `masonry · greedy` 124.8 → **32.2** mean
  turns, `masonry_chiefdom · greedy` 149.5 → **34.2**, `masonry_chiefdom · planner` 105.6 → **28.0**,
  `finding_copper · planner` 103.4 → **50.6**, `raiders_at_border · greedy` 36.9 → **20.7** — against three
  single-seed losses (`first_trades · greedy`, `masonry · greedy`, `wheel · greedy`, −3.3 pts apiece) and
  one single-seed gain (`accounting · planner`). 15 closes more and costs `wheel · greedy` 36.7% → 20.0%;
  35 costs twice as much as 25 for less closure; 50 barely bites at all (`masonry · greedy` back at 86.8
  turns). Turns fall as the cap tightens on every cell that moves, monotonically — the opposite of what a
  boundary the search oscillates across would look like, which is why the fold is the plain `min` and not a
  knee.
  The **identity below the cap is a measurement now** rather than the structural argument it was:
  `harsh_winter` replays **byte-identical** under both policies, as do `growing_numbers`,
  `accounting · greedy` and `finding_copper · greedy` — the survival cell whose 89% the loss half bought is
  untouched because its whole race is fought inside the cap. So is the **root** valuation of the standing
  set, every root reading `T̂loss` ≤ 12: the cap bites where the disease is, on a run that has already
  built the economy that puts death past the horizon.
- **The near-death steepness held against a five-way sweep — measured, and 4 stood.**
  `nearDeathSteepness` ∈ {0, 2, 4, 8, 16} over twelve fixtures × both policies × 30 paired seeds: the
  survival-pressured cells the term exists for (`harsh_winter`, both `raiding_*`, `raiders_at_border`,
  `masonry`, `writing`) against the tempo-sensitive ones it could dawdle (`growing_numbers`,
  `finding_copper`, `first_trades`, `wheel`). The control is the constant at **0** — the term ablated —
  so what the penalty buys at all is one of the five readings rather than an argument. It buys about two
  runs: set-wide wins go **608 / 610 / 611 / 610 / 612** of 720 across the ladder, and the ablation's
  only loss past a single seed is `raiding_city · greedy` 73.3% → **66.7%** (bankruptcy 7 → 9), with
  `writing · greedy` 76.7 → 73.3 (famine 7 → 8) beside it against one seed handed back on
  `writing_chiefdom · planner`. Below 4 the sign is coherent and the trade is the term's own — a beam
  surfing nearer famine and bankruptcy than a projection can carry it.
  **Above 4 there is no slope left to follow.** Five cells move a win rate anywhere on the ladder and the
  other nineteen hold at every value; 8 costs `raiding_city · planner` a seed and 16 gives it back, its
  own only gain a seed on `wheel · planner` — oscillation where the slack cap's turns fell monotonically,
  which is the difference between a constant sitting on a gradient and one sitting in a flat region past
  its knee. The 100-seed confirmation of the one non-negative candidate reads the same: 16 against 4 over
  the five moving fixtures is **661 wins against 659** of 1000, both gained seeds on `wheel · planner`
  (stalls 43 → 41), which is mechanism 1's territory and not this constant's.
  **Fourteen of the twenty-four cells are byte-identical at every steepness**, the ablation included, and
  that is the term's shape rather than a thin sweep: `max(0, T̂win − T̂loss)` is identically zero wherever
  the model projects a win, so a cell moves only where the penalty changes which action ranks first.
  `harsh_winter` is among the fourteen under both policies — the survival cell whose 89% the loss half
  bought decides nothing on the steepness at any value, the ablation included; what the loss half buys it,
  it buys through the margin proper. So are `masonry`, `masonry_chiefdom`, `finding_copper`,
  `first_trades`, `raiders_at_border` and `wheel · greedy`.

- **A many-goal fold can inflate `T̂win` past a deadline it would actually beat — open.** The
  relative-temperature fold's value sits above its bottleneck by up to `max·f·ln n`, and a traced
  `pyramid · planner` root read `T̂win` 43.9 off a 35.7 bottleneck against a 40-round deadline — a
  winnable race read as lost, the likelier home of that cell's small regression under the fraction
  change. Related probe quirk, same trace: `threatClock` caps its search at the running bare `T̂loss`,
  so a deadline sitting past a nearer pool clock returns ∞ at the root and the fold never sees it.
  Both unowned; `pyramid · planner` is 2pp below classic, so neither is load-bearing today.

  **The inflation is real, and the cell moves against it — measured.** Constant 1's re-verification sweep
  re-read that root at every candidate: `pyramid`'s `T̂win` is **36.2 / 38.6 / 43.9 / 52.5** rounds at
  f = 0.15 / 0.25 / 0.4 / 0.6 off a 35.7 bottleneck, so the two smaller fractions do put the race back
  under the 40-round deadline — and the cell gets *worse* as they do, monotonically in the direction that
  inflates it: `· greedy` **0 / 3.3 / 6.7 / 10%** and `· planner` **3.3 / 6.7 / 10 / 10%** over 30 seeds,
  with 0.15's deadline deaths at 30 of 30 against the incumbent's 28. Shrinking `T̂win` uniformly reorders
  nothing — the fraction that shrinks it is the same one setting how hard the beam neglects the goals it
  is *not* racing, and this objective needs all three, so the inflation and the side-goal pull cannot be
  traded apart by tuning. Read the inflation as a reporting fault rather than as this cell's regression:
  whoever owns the item needs a term that drops it while keeping the pull, not a smaller fraction.

## Decisions already made

- The old model stays the shipping default until the new one **dominates the standing set** in
  paired-seed sweeps; only then does step 6 flip and delete.
- The greedies migrate too (same `scoreState` call site) — measured in the same referee sweeps.
- Deadline visibility (step 3) is a **merge gate**, not a nice-to-have.
- Sweep comparison rides a `--scorer` CLI flag (default `classic` until cutover) so old and new run
  under the *same policy names* and `sim:report --against` pairs cells cleanly. Like
  `--search-beam`, a non-default `--scorer` sweep is a diagnostic: recorded in the `#sweep` header,
  refused by `sim:record` until the cutover flips the default.

## Steps

Status boxes are the branch's live state — tick them as steps land.

### Step 0 — branch + this spec ✅

`race-model` branch; this document as its first commit.

### Step 1 — the currency core ✅

The new module, policies untouched.

- **Build** `src/sim/race.ts`: the stripped projection (one clone), resource-threshold `t_g`,
  bottleneck fold (constant 1), `T̂loss` from pool drains + cutoff, margin, sentinels, tie-break
  (constant 3), near-death penalty (constant 2). Pending work-box output read via `producingUnits`
  arithmetic, no second clone. Alongside it `race.test.ts`: scale invariance, deadline honesty,
  bank monotonicity — synthetic fixtures only.
- **Read first**: `src/sim/value.ts` (the incumbent: bands, `permanentDelta`, `OBJECTIVE_WEIGHT`),
  `src/rules/objective.ts` (`goalProgress`/`measure`/`target`), `src/sim/objective.ts`,
  `src/rules/population.ts` (`producingUnits`), `src/rules/upkeep.ts` (`applyUpkeep`).
- **Done when**: module + tests green, imported by nothing.

### Step 2 — lumpy goals + setup time ✅

The probes moved to `src/sim/probes.ts` — `cardPrice`, `replacementCost`, `runCardIds`, and the
injection probe generalized onto any `measure: (G) => number` — which is the line step 6 cuts anyway.
`enablers.ts` consumes them unchanged (its suite passes unedited, which is what says nothing forked).
`deriveRace(G)` derives one `RaceModel` at the run root; `raceBreakdown` takes it and stays at one
clone. A **landing** plan is copies of a card the goal reads (present in a zone it counts, granted by the
play, or delivered by a work box's once-per-play `produces`); a **building** plan is a durable producer's
per-round output.

### Step 3 — the deadline probe ✅  ← merge gate

`threatClock` in `src/sim/race.ts`, folded into `T̂loss` as a third branch and named by a
`'deadline'` `LossCause` + the `lossCardId` that bound it. Each probe is capped at what already
binds rather than at the cutoff, so a clock longer than the shortest one found costs nothing; a
threat with no `defeat` is skipped, and one with no tick slot at all (an absolute deadline) probes
off a shallow copy instead of a `cloneState`, since only its round varies.

### The model can show its work

`npm run sim:valuation -- --scorer race` renders the derivation, pulled forward out of step 6 because five
diagnostic passes in a row hand-rolled a throwaway dump of `deriveRace`/`raceBreakdown` and the last
referee had to leave its causal story explicitly *inferred* for want of one. Same read-only,
simulation-free character as the classic mode: `explainRaceModel` is the plan scan with every card it
ranked and every one a pool with no `unitCost` kept it from ranking; `explainRaceValue` is
`raceBreakdown`'s own pass with an optional sink, so the printed clocks are the ones a policy ranked by
rather than a second reading of them.

What it made visible immediately, at the root:

- **Ranking within a route kind was blind to deliverability — measured, and closed.** Two cells ranked a
  cheap card the run cannot deal over a dearer one it can, and the goal then read `'none'`:
  `first_settlement` ⚔️ (Bow 0.667/unit, spent by landing — over Hunting at 1.0, a work box that recycles)
  and `reading_seasons` 🔬 (Fire 0.0/unit, 1 copy — over Storytelling at 1.0, likewise recycling). `min`
  over routes was honest; the argmin *within* the landing route was not, since it dropped the only
  alternative that had a finite clock. With every deliverable route kept and the leaf taking the soonest,
  the two read `landing:dogs` at 15.0 rounds and `landing:storytelling` at 42.5, and no other goal in the
  standing set moved at all. The third `'none'`, `growing_numbers` 🏛️, is **not** this and is unchanged:
  both its candidates are single copies, so the goal is copies-short either way — the distinct-count
  artifact above meeting the copies-short rule, with no deliverable runner-up to have been dropped.
- **Absorption was a live mechanism, and re-unitizing the temperature retires it.** Under an absolute
  temperature the fold stopped carrying a weight ~37 rounds behind the leader — reachable at a 200-round
  horizon, and reached: eight landing candidates in the standing set were payment-absorbed at the root,
  two goals fold-absorbed, and the widest gap among the **kept** routes (`pyramid_chiefdom`, 17.4 rounds,
  `w = 2.9e-8`) was a gradient no beam could follow either. Against a temperature that is a fraction of
  the leader the gap that would absorb one is `36.7 × constant 1` times the leading clock, and a gap
  cannot exceed the leader at all — so above a softening of ~0.027 nothing is absorbed and `absorbed()`
  reads how much of a gradient the fold carries rather than whether it carries one.

### Step 4 — wiring + the referee ☑

- **Build**: a `scorer` seam on the five competent policies (`src/sim/greedyPolicy.ts`,
  `greedy2Policy.ts`, `plannerPolicy.ts`, `oracle.ts` — the `Heuristic` type in
  `src/sim/turnSearch.ts` already parameterizes the searches); the `--scorer` flag through
  `scripts/sim.ts` → `src/sim/batch.ts` (`POLICY_FACTORIES`), recorded in the `#sweep` header,
  refused by `scripts/record.ts` while non-default.
- **Measure**: paired-seed sweeps over `scripts/sim/baselines/` under both scorers, read with
  `npm run --silent sim:report -- --against` — one full sweep per model commit, the previous race
  sweep and the committed classic rows both held as references, classic byte-identical through
  every one.

**The verdict** (HEAD `400585e`, 100 seeds × 30 fixtures × greedy+planner). Race **56.4%** greedy
against classic's 43.2, **70.8%** planner against 65.6; per cell **39 above / 14 below / 7 equal**,
the below-deficit at 237pp; mean winning tempo **33.1 turns against classic's 30.1** (44.9 when the
referee first read a sweep — the slack cap closed ~80% of the gap). **Standing-set dominance is not
shown**; step 6's gate stays shut. The 14 below-cells are dispositioned, not mysterious:

- `accounting_chiefdom · greedy` 57pp, `accounting · greedy` 20pp — **search-shell, not scorer**:
  the chiefdom cell is 0% under *both* scorers at the shipped planner and recovers to 9/20 under
  `deepPlanner`; step 5's column.
- `accounting · planner` 32pp — **measurement, verdict unspent**: the prover, on identical search
  machinery and seeds, proves winnable 6/10 under classic's ranking against 0–1/10 under race's,
  every race failure a `deadEnd`. The savings-gradient design (a bank's progress toward a big-step
  purchase priced as progress) was declined this pass; the verdict stands for whoever tries next.
- `wheel · planner` 23pp, `wheel_chiefdom · planner` 29pp, `· greedy` 1pp — the plan-ramp's
  territory, twice falsified in composition (parked below).
- `writing_chiefdom · planner` 31pp (famine-shaped) — reachable by neither parked design on the
  evidence; unowned.
- `setting_sail` ×3 19pp — **diagnosed, and its cheap fix falsified** (the workforce floor, parked
  below). Three leaf mispricings of the same act — refusing the launch — traced at 100 paired seeds,
  where the family's fingerprint is the launch histogram, not the win rate (classic fills the
  2-of-3-launches bucket, race leaves it empty): `T̂loss` counts the bank a plan has earmarked as
  survival runway (the netting the tie-break already does and the pool clocks don't — the chiefdom
  cells, a launch pricing up to 28 rounds below a Toolmaking box), `paymentClock` reads a zero
  workforce as `∞` on a state one Hut and a bank away from a citizen (the city cells, the launch at
  −280), and a non-recycling plan holding exactly the copies it needs has a delivery clock invariant
  to its own progress (`copies == held` reduces it to `pool / hand`), so landing moves `T̂win` by
  ~0.25 rounds against punishments two orders larger. The prover proves 8–9/10 winnable under race's
  own ranking against classic's 7–9 — the leaf, not the search. One positive finding rode along: the
  step-3 deadline probe binds `T̂loss` on 69% of scored states on the city cell, emphatically
  reaching the mission it was cut for.
- `first_temple · greedy` 13pp, `horse_taming · greedy` 9pp — trace-proven one-ply valleys (the
  winning first move is a multi-step sequence greedy structurally declines); their planner
  counterparts sit **above** classic (99 vs 98, 93 vs 37). A `greedy2` column would say whether
  depth alone clears them.
- `first_trades · greedy` 1pp, `pyramid · planner` 2pp — single-seed scale.

The dawdle ledger the cap was cut for is closed except one: `finding_copper_chiefdom · planner`
(176t vs classic's 87.4 at 99% win) did not move under the cap at all — its slowness is not
survival-slack-driven, cause unknown.

**Parked, with autopsies** — four falsified value-shape designs, each preserved with its evidence:

- **Survival routes v1** (branch `race-survival-routes`): crediting `T̂loss` for a *credible* rescue
  is self-undermining — the more believable the rescue, the less reason to perform it (Farm plays
  78 → 27 while famine 22 → 73; `harsh_winter` 80% → 0%). Constraint learned: **no credit without
  execution**.
- **The plan-ramp** (branch `race-plan-ramp`): the toll a plan's own completion creates, probed at
  the root and charged as `accel` — honest, and transformative on wheel (90/100/30/63 across the
  family) — but fatal to masonry **twice**: alone, the stall attractor (refusing the mission read
  +140); on the cap, the knee (the ramped food clock hugs `slackCap`, where runway keeps its whole
  gradient while `T̂win` reads flat across every action — Foraging ×154, the sixth slot never
  bought). Constraint learned: **give the win clock a gradient where the ramp bites; don't make
  runway matter less**.
- **The relative slack cap** (`slack-saturation-findings.md`, never implemented): the plateau of
  `min(T̂loss, c·T̂win)` is `(c−1)·T̂win` — it pays the model to lengthen its own win. With it came a
  small impossibility result: losing-region identity, saturation, no absolute scale, and
  faster-win-always-better are jointly unsatisfiable; the shipped absolute cap sacrifices the
  third.
- **The workforce floor** (branch `race-workforce-floor`): zero population priced as hire-then-pay —
  one boundary plus the citizen's own `replacementCost` joined to the debt, the staffing-wait
  reading extended to the workforce itself, `∞` only where nothing mints population. Surgical (the
  standing set's root dump, `harsh_winter` and `wheel` all byte-identical) and still wrong: the
  2-launch bucket fills 5 → 71 exactly as designed and `setting_sail_city · planner` falls
  25% → **6%**, the runs launching their last citizen and stalling to the pace clock (crew defeats
  69 → 86). The false wall was doing protective work over two terms the trace then named:
  population *is* the food drain, so emptying the workforce is paid on both halves of the margin at
  once — the food clock reads `∞` while the launch resets the pace clock, a `T̂loss` swing of up to
  +12 against an honest win-clock charge of ~3 — and rebuilding re-creates the drain, so stagnating
  outscores the House in hand (plays 0.66 → 0.25 per run at *longer* mean turns). Survival-routes
  v1's lineage: the model paid for a state it enters rather than the play that redeems it.
  Constraint learned: **the wall is load-bearing until `T̂loss` stops paying for emptiness — fix
  both halves in one pass or neither**. The branch's four synthetic invariants pin the intended
  hire-then-pay rule correctly and are reusable as-is by that pass.

### Step 5 — search-shell riders, one at a time ☐

Each measured separately (attributable deltas): beam **diversity** in the oracle's level beam
(`src/sim/oracle.ts` — stratify the kept set by a coarse signature, or k-per-parent);
**per-replan re-derive** of the race inputs in `plannerPolicy.ts`; planner **defaults revisited**
(`DEFAULTS` — depth 2 on a one-clone leaf). That last premise now holds only where the deadline probe
is inert: a threat carrying an `upkeep` (Setting Sail's crews) costs a **second** clone plus its own
tick per probe round, so read a depth verdict per cell rather than once for the branch, and don't
mistake a slower `setting_sail` sweep in step 4 for model noise.

- **Per-replan re-derive — landed, kept: a staleness fix that buys tempo, not the win-rate lever.** The
  planner built its scorer once, at its first re-plan, and held it for the run, so the race model's kept
  routes and unit costs were frozen at turn 0; it now derives at every re-plan, the leaf caches scoped to
  the re-plan with it (a cached value carries the model that produced it). Measured planner-only — the one
  policy that re-plans — over the standing set × 30 paired seeds under both scorers: race is byte-identical
  on 28 of 30 cells with no seed crossing the win/defeat line anywhere, and the two that move are tempo
  gains at held 100% — `growing_numbers · planner` 20.3 → **17.5** mean turns, exactly the staleness the
  distinct-count bullet above names, and `first_settlement · planner` 30.3 → 28.7. Classic is near-inert
  (28 of 30 unchanged; `growing_numbers` 15.2 → 15.0 turns, `roads` a 0.1🪙 end-pool drift), its enabler
  model deriving off facts a run barely moves — those two cells' planner rows are re-recorded at the
  100-seed protocol, where the drift is 14.6 → 14.5 turns at unmoved win rates. The cost is unmeasurable:
  paired A/B over seven fixtures spanning all four cost families disappears into the machine's ±16%, one
  derivation per re-plan against a beam of leaf evaluations. One premise corrected in passing: the oracle
  *does* inherit this — its no-line fallback is `createPlannerPolicy(DEEP_PLANNER_OPTIONS)` — and every
  oracle-recording fixture re-verifies **byte-identical** at the recorded @10. Read the rider as a null
  result on step 4's below-cells (`accounting_chiefdom` is among the unmoved): it closes a class of
  staleness, and the win-rate hunt stays with the depth bet below.

- **Depth 2 — measured, and reverted on its own numbers; the motivating evidence was mis-attributed.**
  `DEFAULTS.depth` 1 → 2 alone (the oracle fallback and `deepPlanner` pin their own depth and are
  byte-unchanged), 30 fixtures × 30 paired seeds × both scorers against the rider-1 reference. Race buys
  **+12 of 900** set-wide and the gate metric moves the wrong way: the planner-@30 head-to-head goes
  14 above / 6 below to 15 / **9**, deficit 36 → 39 seeds. The rider's own target does not recover —
  `accounting_chiefdom` 1 → 2 of 30 under race, 0 → 0 under classic — so `deepPlanner`'s 0/20 → 9/20 is
  carried by its *other* two knobs (`determinizations: 8`, `turnConfigLimit: 16`), not by depth; and
  `accounting` collapses 16.7% → 3.3% in the same direction the slack-cap section's 4× budget experiment
  already recorded, a second search-shell knob optimizing the proxy harder. What depth 2 *does* buy race is
  precisely the cells step 4 dispositioned as search-shaped: the wheel family +9 seeds (`wheel` 53.3 →
  66.7%, `wheel_chiefdom` 46.7 → 63.3%, ruin 10 → 3), `horse_taming` 90 → 100%, `raiding_city` 93.3 → 100%,
  `writing_chiefdom` 30 → 36.7% — evidence those below-cells are reachable by search, kept for whatever
  shape ships it. The budget warning above is **settled negatively**: a 400k `nodeBudget` diagnostic over
  the many-goal + probe+settle fixtures is byte-identical at depth 2, so the budget never binds there — the
  failure is value-and-beam (`beamWidth: 4` goes live at depth 2 and prunes by the scorer's own
  mis-ranking, amplifying exactly the leaf faults step 4 traced). Classic gains +30 of 900, 20 of them on
  the many-goal and probe+settle families where race's leaf costs 1.8–2.9× — depth pays the model step 6
  deletes, where race cannot collect — and a keep would owe a full 30-fixture planner @100 re-record plus
  **5.7–6.6× on every future sweep** (45 min a race sweep on the reference box). Two riders on the sweep
  record: the `#sweep` header names no planner knobs, so a depth-edited sweep is indistinguishable from a
  default one — provenance is the filename until a knob rides the header — and if a depth tier is ever
  wanted it is a *diagnostic* for the wheel-family cells, not a default.

Two measured facts to start from: `--search-beam` never reaches the planner (it feeds only the
oracle/prover), and the planner's own beam is **width-invariant at depth 1** by construction — so
the live rider is depth/determinizations, not width. First target evidence: `deepPlanner` takes
`accounting_chiefdom · planner` from 0/20 to 9/20 on identical seeds (a cell that is 0% under
*both* scorers at the shipped defaults), and was recovering `masonry_chiefdom` when its run was cut.

**A third: the saving is one clone, and the leaf is not one clone — measured.** The depth premise was
priced in clones, and clones are the half of the leaf race really does save. Eleven fixtures × both
policies × 30 paired seeds, timed on the prebuilt bundle with the process's own ~70 ms subtracted and
normalized to **ms per action** — the two scorers end runs at different lengths, so raw wall time reads
a run count rather than a leaf — put race at parity on a cell that neither probes a deadline nor
circulates an event, and half again to twice as dear everywhere else:

| family | fixtures | ms/action, race ÷ classic — greedy · planner |
|---|---|---|
| plain — no probe, no settle | masonry, growing_numbers, first_trades, harsh_winter, wheel | 0.96–1.76 · **0.98–1.28** |
| many-goal | pyramid | 2.77 · 1.20 |
| event settle | finding_copper, writing, raiding_city | 1.73–1.84 · **1.53–2.14** |
| probe + settle | setting_sail_city, setting_sail_chiefdom | 1.90–1.98 · **1.40–1.64** |

(`first_trades · greedy`'s 1.76 is the metric working, not a cost: race wins there in 1 310 actions
against classic's 3 740 to the cutoff, so its raw wall time is *shorter* at a dearer leaf. `pyramid`
disagrees with itself across the two policies more than any other row; the profile below is the arbiter
for that cell, and lands between them.)

**Which cells pay which cost is narrower and wider than *Projection cost* has it, and both ways were
counted over the whole catalogue rather than the sweep's own eleven.** The probe is **narrower**:
`threatClock` skips a threat carrying no `defeat`, and of the eight `threat` cards only `pharaohs_reign`
and `impatient_crews` carry one at all — so every other threat in the game costs a leaf nothing, and
only Setting Sail's crews, the one of the two with a tick slot, buy the second clone. `pyramid`'s
deadline has no tick slot, takes the shallow-copy branch, and never appears in its own profile. The
settle is **wider**: seven standard missions seed `events` — Raiders at the Border, Finding Copper,
Writing, Horse Taming, Raiding, Roads and Setting Sail — and Accounting breeds thieves into the deck
mid-run, so a run circulating an event is the common case rather than the `raiding_*`/`writing_*` pair
that paragraph names. Setting Sail pays **both**, where it is read as paying one.

Four `planner` captures under `@platformatic/flame` (46–173 s, 835–1 977 samples) put the cost where
the timing cannot. The **share** below is measured — the leaf's cumulative time as a fraction of its own
`expandTurn` subtree, which no run length touches. The **ratio** is what those shares imply *if* the
non-leaf work per expanded node costs the same under both scorers; that is the same engine either way,
but race walks bigger boards on the cells where the ratio is largest, so read the direction and not the
second decimal:

| cell | leaf share, classic | leaf share, race | implied leaf cost, race ÷ classic |
|---|---|---|---|
| `masonry` — plain | 47% | 48% | **1.06** |
| `pyramid` — three goals | 51% | 65% | **1.82** |
| `raiding_city` — settle | 41% | 60% | **2.10** |
| `setting_sail_city` — both | 36% | 62% | **2.92** |

A second reading — each scorer's aggregate cumulative share against the unprofiled ms/action above —
orders the four the same way and runs higher at the top (1.15 / 1.71 / 4.09 / 4.15); it is the softer of
the two, since `scoreBreakdown`'s own frame is ~0.8% self and so falls off a table ranked by self time
on two of the cells, leaving those two aggregates scaled rather than read.

The clone budget itself behaves exactly as claimed and is handed straight back where a settle lands:
`cloneState` costs **0.80×** and **0.76×** classic's per action on the two cells that settle nothing,
and **1.31×** / **1.24×** on the two that do, three clones and four boundaries against classic's two of
each. Where the leaf's time goes, per family:

- **Plain** (`masonry`): `permanentProjection` is 40% of the leaf, `bankedState` 9%, the margin's own
  arithmetic 19%, and the plan's clocks 32% — against classic's two projections at 65% and 29% of its
  own. The one clone is real; what fills the second one's place is the model thinking.
- **Event settle** (`raiding_city`): `permanentProjection` alone is **74%** of the leaf and 36.1% of
  the entire sweep, `eventCopies` and `eventCensus` walking the circulation twice more inside it. This
  is the largest single cost anywhere in the comparison.
- **Probe** (`setting_sail_city`): real, and small — `threatClock` is **~9%** of the leaf against the
  settle's **62%** in the same capture. *Projection cost* sets the two side by side as the two places
  the saving goes; they are not comparable, and the settle is the one to read a slow sweep as.
- **Many goals** (`pyramid`): neither. `threatClock` never appears at all; `goalClock`/`routeClock` is
  34.7% cumulative, `routeClock` is the sweep's hottest frame at **15.4% self**, `pricingCopy` 7.4% and
  `cardPrice` 4.1%. Three goals × every kept route × two full circulation walks apiece — `pricingCopy`
  for the leaf-read price, `deliveryClock` for the draw census — is a per-leaf cost that landed after
  that paragraph was written and appears nowhere in it. The many-goal fold is dear as well as inflated.

**So depth 2 is not one bet.** Doubling the leaf evaluations buys its search at 1.06× classic's leaf on
a plain cell — the premise as written — at ~1.8–2.1× on a many-goal or event-circulating one, and at
~2.9× where a probe and a settle meet. Read a depth verdict per family, and read a depth-2 *failure* on
any of the seven event-circulating missions, on `accounting` once its thieves are bred, or on a
many-goal cell as a budget reading before a value one: those are paying two to three leaves for each one
the premise costed, and the node budget is what runs out first. The cells where the bet stands as
written are the ones with a single-goal objective and no event in the deck.

Three costs are attributable and none is a few lines, so none was taken here. `pricingCopy` re-reads
every circulating copy's `currentCost` per route per goal per leaf, and a memo would have to be keyed on
the state — the price being a read of the moment is the whole point of reading it there.
`permanentProjection`'s second boundary pair exists only to measure escalation, and skipping it where
no circulating event can deepen needs a declarative "this escalates" fact no card contract states.
`threatClock`'s cap is the running bare `T̂loss`, so an inert probe on a run with no draining pool loops
the whole horizon in `defeat()` reads — its cost is a fact about the state, not the cell — and
binary-searching it assumes a monotone `defeat` that nothing states either.

- **Done when**: each rider's paired sweep is separately recorded in the step-4 style, kept or
  reverted on its own numbers.

### Step 6 — cutover ☐

- Flip `--scorer` default; migrate the greedies' call site; **delete** `src/sim/value.ts`'s bands
  and the weighting half of `src/sim/enablers.ts` (probes stay); the `sim:valuation` rebuild is already in
  (above) — what is left of it here is dropping `--scorer` and the classic renderer with the incumbent;
  re-record the standing set; update `CLAUDE.md` (sim architecture + valuation sections) and
  `docs/DESIGN.md`; retire this document into them.
- **Gate check**: step 3 in, standing-set dominance shown, no `--scorer` flag left (the diagnostic
  dies with the incumbent).
