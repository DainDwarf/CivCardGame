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

- **Resource-threshold goal** (`measure` is a pool): `need = target − measure`,
  `τ = per-round Δmeasure` from the permanent economy, `t = need / τ`. The bank is already inside
  `measure`; a banked unit is worth exactly the fraction of a round it saves — the derived
  replacement for `HOP_DISCOUNT`.
- **Card-count goal**: `need` = copies still to land; each copy priced in **worker-rounds**
  (the `enablers.ts` card-injection probe: declarative `cost` plus every pool the play `effect`
  drains, each component priced by what it costs to obtain); `t` = remaining price ÷ the
  workforce's worker-round income. A banked 🔨 shortens the time to the next copy.
- **Zero current throughput, deck can build it**: `t = t_setup + need / τ_achievable`, where
  `t_setup` is the worker-round price of the best goal-producer chain the probes find
  (afford → build → staff). The sole surviving descendant of the capacity/producer machinery —
  same probes, output in rounds, no constants.
- **Bespoke `met` goal**: flat, unshapeable (today's sandbox rule, unchanged).

Every route a goal has is costed and the **soonest** taken — no test of whether the standing economy
"needs" a plan. `min` is the honest fold over alternatives, where a gate deciding which route to price
is a branch that can fire the wrong way. The workforce a plan's price is paid at is the **population**,
not the workers currently in boxes: a pool's worker-round price is the output of a worker standing in
the best box for it, so a denominator counting only staffed workers would disagree with its own
numerator about the same person.

All `t` clamp at the remaining drive cutoff; a goal past the horizon reads dead, tamely.

**Projection cost.** τ and the drains come from **one** stripped projection (the old
`permanentDelta` clone: transients dropped, one `applyUpkeep`). Pending one-shot output (a staffed
work box this turn) must still be visible pre-`endTurn` so staffing registers immediately — read it
directly off `workZone`/hand card data (`producingUnits` arithmetic, no clone) instead of the old
second full projection. Net: one clone per leaf instead of two; the saving is earmarked for search
depth, not pocketed.

### T̂loss — rounds to death

`min` of:

- **(a)** each draining core pool's `pool / drain`, off the same stripped projection;
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
   gradient on them and would let the beam abandon side goals).
2. **Near-death penalty steepness.**
3. **Tie-break weight** — banked worker-round wealth among equal-margin states (band 5's heir,
   in-currency); sized so its maximum stays below the smallest meaningful margin step. Counted only
   over the bank *past* what a goal's plan already spent: exact netting makes holding a card's price
   and having played it equal, and a tie-break that counted the same resource twice would break that
   tie toward the bank — preferring the price to the thing the price buys.
4. **`VICTORY` sentinel** (unchanged).

### Fate of every old term

| Old | Fate |
|---|---|
| `objective` band (`×OBJECTIVE_WEIGHT`, ÷target) | replaced by `T̂win`; the normalization bug is unexpressible |
| `collapseCliff` / `buffer` bands | replaced by `T̂loss` + near-death penalty |
| `operating` nudge | falls out of τ |
| `accumulate` band | tie-break term, in worker-rounds |
| `HOP_DISCOUNT`, conversions | derived: a bank is worth exactly the rounds of production it stands in for, so holding a card's price and having played it come out *equal* — the over-credit `HOP_DISCOUNT` bounded is unexpressible, and there is nothing left to discount |
| capacity terms, both horizons, `CAPACITY_CAP`, intrinsic floor | `t_setup`, derived, no constants |
| `producerCredit` + cap | falls out of τ / `t_setup` |
| `handSize` credit | **deleted, unreplaced** — a diffuse effect the search should see via depth; re-added only if the step-4 paired sweeps prove the loss |
| probes (`goalValuedResources`, card-injection, worker-round pricing), `realizedGain` reads | carried over as-is |

### Invariant tests (synthetic fixtures)

- **Scale invariance** — the test that makes fault 1 unrepeatable: two synthetic objectives over
  the same economy whose measures/targets differ only by a scale factor `k` must rank corresponding
  states identically.
- **Conversion soundness, in time**: playing an affordable conversion is never worse than holding its
  bank — equality by construction, so what the test pins is that the two don't come apart and that the
  tie-break doesn't quietly prefer the bank.
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

- **The affordable end is flat.** Once the bank covers a card-count goal's whole outstanding price,
  `T̂win` is 0 and stays 0 for every remaining finishing play — banked 12🔨 with none of three relics
  landed values *identically* to none banked with all three landed. That is the same equality that
  makes the bank sound, arriving where it stops being useful: the model has no notion of one play per
  turn, so having the money is having won. A card-count cell stalling in step 4 points at **depth**,
  not at a fifth constant.
- **A distinct-count goal over-counts its copies.** `growing_numbers_goal` measures *distinct*
  building ids present; the probe reads `delta = 1` off whichever is cheapest and the clock then asks
  for `need` copies of that one card, which would move a distinct count by exactly 1. The estimate is
  optimistic and, being root-derived, doesn't correct as ids land. Don't misattribute a
  `growing_numbers` regression to the fold.

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
clone. A **landing** plan is copies of a card the goal reads (present in a zone it counts, or granted
by the play); a **building** plan is a durable producer's per-round output — a work box is neither,
since its worker is the very unit every price is quoted in.

### Step 3 — the deadline probe ✅  ← merge gate

`threatClock` in `src/sim/race.ts`, folded into `T̂loss` as a third branch and named by a
`'deadline'` `LossCause` + the `lossCardId` that bound it. Each probe is capped at what already
binds rather than at the cutoff, so a clock longer than the shortest one found costs nothing; a
threat with no `defeat` is skipped, and one with no tick slot at all (an absolute deadline) probes
off a shallow copy instead of a `cloneState`, since only its round varies.

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
(`DEFAULTS` — depth 2 affordable now the leaf is one clone).

- **Done when**: each rider's paired sweep is separately recorded in the step-4 style, kept or
  reverted on its own numbers.

### Step 6 — cutover ☐

- Flip `--scorer` default; migrate the greedies' call site; **delete** `src/sim/value.ts`'s bands
  and the weighting half of `src/sim/enablers.ts` (probes stay); rebuild `sim:valuation` /
  `src/sim/valuationReport.ts` on the race explain (per-goal `t_g`, the named bottleneck,
  `T̂loss` and which clock binds — produced by the same pass that computes the value, as today);
  re-record the standing set; update `CLAUDE.md` (sim architecture + valuation sections) and
  `docs/DESIGN.md`; retire this document into them.
- **Gate check**: step 3 in, standing-set dominance shown, no `--scorer` flag left (the diagnostic
  dies with the incumbent).
