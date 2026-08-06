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
h(G) = T̂loss(G) − T̂win(G)      (+ tie-break; victory/defeat sentinels unchanged)
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
  **Payment** — each copy priced in **worker-rounds** (the card-injection probe: declarative `cost` plus
  every pool the play `effect` drains, each component priced by what it costs to obtain), divided by the
  workforce's worker-round income; a banked 🔨 shortens it. **Delivery** — the copies still to play,
  divided by `k·h/D`: the plan copies a round's draw surfaces, off the run's **circulation** (deck,
  discard, hand and work zone alike) and the culture-adjusted hand size it refills to. `t` folds the two as a
  **softened max**, not a sum: earning the price and drawing the copies overlap, so the plan lands when
  the later one finishes — softened against the same temperature as the goal fold, because the clock a
  hard `max` masks is routinely the payment one, and that is the half carrying every earning and spending
  decision the run makes. Both figures are read off `G`; the census below is unchanged, the softening
  reusing constant 1 rather than adding a fifth.
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

**A work box is a landing, not a producer.** Its `produces` fires once per play rather than once a round,
so what it delivers is a delta to repeat rather than a rate to collect — and for a goal no standing card
moves (territory, taken by Conquest and Road) it is the only route there is. The delta is that output read
at **one staffed worker**, the conservative floor; the price is the card's plus **one worker-round per
play** — the citizen who spends the turn running it, added straight to the worker-round sum rather than
converted, being already in that unit. A landed box files back to the discard, so the copies the run holds
are dealt again: six units off two boxes is a cadence, not a plan the deck is short for.

**Room is part of a structure's price.** A plan whose card is a structure owes one territory slot per
copy, netted against the **free** tableau rather than the territory pool, since land is spent by standing
on it. It is the one component exempt from the "every price component needs a `unitCost`" rule up front:
the shortfall is converted through `replacementCost`'s territory figure where the run has one and reads
unreachable where it doesn't — which is what a full board with nothing minting land is. Without it a
board-filling plan is flat over the play that unblocks the board, because a box minting a slot only ever
*costs* on every axis the plan does price.

Every route a goal has is costed and the **soonest** taken — no test of whether the standing economy
"needs" a plan. `min` is the honest fold over alternatives, where a gate deciding which route to price
is a branch that can fire the wrong way. That holds *within* a kind of route as much as across the kinds:
the root keeps every card whose route is **deliverable there** — a price with a rate to convert through
and copies the deck can deal — rather than the one that ranked cheapest per unit, and each leaf takes the
soonest of what it kept. Price and deliverability are independent questions, so an argmin over the first
alone plans a goal through a card the run cannot circulate and drops the dearer one it can. The kept set
is a handful — one or two per goal across the standing set — so the leaf pays a clock apiece for the
reading that decides it. What the root filter may **not** fold in is the workforce the payment clock
divides by: that is a fact about the moment, gated at the leaf, and a root with no citizens must not
derive itself out of every plan it has. The workforce a plan's price is paid at is the **population**,
not the workers currently in boxes: a pool's worker-round price is the output of a worker standing in
the best box for it, so a denominator counting only staffed workers would disagree with its own
numerator about the same person.

All `t` clamp at the remaining drive cutoff; a goal past the horizon reads dead, tamely.

**Projection cost.** τ and the drains come from **one** stripped projection (the old
`permanentDelta` clone: transients dropped, one `applyUpkeep`). Pending one-shot output (a staffed
work box this turn) must still be visible pre-`endTurn` so staffing registers immediately — read it
directly off `workZone` card data (`producingUnits` arithmetic, no clone) instead of the old
second full projection. Net: one clone per leaf instead of two; the saving is earmarked for search
depth, not pocketed. A run that circulates an `event` spends the saving again on the second boundary
below — as with the deadline probe's own extra clone, read a slower `raiding_*` sweep as that and not as
model noise.

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

The amount is measured, never read: a second boundary settles every circulating copy through the same
`applyUpkeep` at the slot the engine does (its own `resolveHandEvents`), and the two projections differ by
the events and by nothing else. That is what reaches an amount a card computes in a `resolve` closure — an
escalating drain reading a counter it bumps has no declarative bag to read. Every non-event hand card
drains nothing and files itself away at the same boundary, so dropping it costs the walk nothing.

### T̂loss — rounds to death

`min` of:

- **(a)** each draining core pool's `pool / drain`, off the same stripped projection — which is where a
  recurring event's disaster enters, at whatever its own resolver really takes, scaled by the share of
  boundaries the deck deals a copy into hand for;
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

Near-death softening (constant 2): when `T̂loss` is small and `T̂win > T̂loss`, steepen the cliff —
the estimates are noisy, and the beam must not surf one round from famine on the strength of a
projection.

### The complete constant inventory

Discipline: **every constant states its units and why it is tuned rather than derived.** Census —
four, down from ~15:

1. **Bottleneck softening** — how much non-bottleneck goals still pull (pure `max` has zero
   gradient on them and would let the beam abandon side goals). Dimensionless: a fraction of the
   leading clock, not a number of rounds, so the gap it tolerates scales with the race it folds.
2. **Near-death penalty steepness.**
3. **Tie-break weight** — banked worker-round wealth among equal-margin states (band 5's heir,
   in-currency); sized so its maximum stays below the smallest meaningful margin step. Counted only
   over the bank *past* what a goal's plan already spent: what a plan has earmarked is already priced
   into `T̂win`, and counting it twice would break the tie toward the bank — preferring the price to the
   thing the price buys.
4. **`VICTORY` sentinel** (unchanged).

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
  really takes.
- **Room is priced**: a structure plan against a full board scores strictly below the same plan with a
  slot free.
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
  classic scorer's own rate. The soft fold is the shipped form. What remains open is `writing · planner`,
  still below its classic 84% — a step-4 question, not a fifth constant.

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
  hard fold's own failure on `masonry · greedy` (100% → 23%). Whether the disease is *closed* is a
  **referee** question, not a diagnostic one: the sweep that decides it is step 4's.
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
  is step 4's. What it does **not** address: an escalating event is measured at each copy's *current*
  counter and then charged as a flat rate, so `pool / drain` still overstates the runway of a drain that
  deepens. A separate item, not a hybrid to fold in here.

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

### Step 4 — wiring + the referee ☐

- **Build**: a `scorer` seam on the five competent policies (`src/sim/greedyPolicy.ts`,
  `greedy2Policy.ts`, `plannerPolicy.ts`, `oracle.ts` — the `Heuristic` type in
  `src/sim/turnSearch.ts` already parameterizes the searches); the `--scorer` flag through
  `scripts/sim.ts` → `src/sim/batch.ts` (`POLICY_FACTORIES`), recorded in the `#sweep` header,
  refused by `scripts/record.ts` while non-default.
- **Measure**: paired-seed sweeps over `scripts/sim/baselines/` under both scorers, read with
  `npm run --silent sim:report -- --against`. This is the first verdict on the whole bet — expect
  iteration here, against the watch items above.
- **Done when**: both scorers sweep cleanly under the same policy names; the comparison is written
  up (chat/dossier-style, not committed history) and any model fixes it forced are in.

### Step 5 — search-shell riders, one at a time ☐

Each measured separately (attributable deltas): beam **diversity** in the oracle's level beam
(`src/sim/oracle.ts` — stratify the kept set by a coarse signature, or k-per-parent);
**per-replan re-derive** of the race inputs in `plannerPolicy.ts`; planner **defaults revisited**
(`DEFAULTS` — depth 2 on a one-clone leaf). That last premise now holds only where the deadline probe
is inert: a threat carrying an `upkeep` (Setting Sail's crews) costs a **second** clone plus its own
tick per probe round, so read a depth verdict per cell rather than once for the branch, and don't
mistake a slower `setting_sail` sweep in step 4 for model noise.

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
