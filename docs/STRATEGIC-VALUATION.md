# Intrinsic strategic valuation (planner)

## Context

`sim/enablers.ts` credits the three strategic pools — territory, population, culture — for the
goal-throughput their capacity unlocks. That credit is derived **through the objective**:
`goalValuedResources` probes which *resources* move `objectiveProgress`, and every strategic weight is
gated on that probe returning something.

An objective whose goal is a **card count** rather than a resource threshold moves no resource, so the
probe returns `{}`, every downstream weight stays unset, and `deriveEnablers` yields an empty model.
On those missions the planner runs on bare `scoreState` with no enabler shaping at all.

The asymmetry this exposes is the actual design problem: `scoreState` band 5 gives **core** pools a
small *intrinsic* accumulation credit — banked food is worth a little, unconditionally — while
**strategic** pools have zero intrinsic worth and are valued only instrumentally. That is backwards,
since the strategic pools are the ones that compound. A bigger engine is worth something on any
mission; how much you can afford to invest is a question `scoreState`'s existing food/production costs
already price.

### Affected missions

Objectives measuring a card count (enabler model empty — planner unshaped):

| Mission | Goal measure |
| --- | --- |
| `growing_numbers` | buildings present in tableau |
| `raiders_at_border` | `raider` cards in `removed` |
| `finding_copper` | `copper_vein` cards in `removed` |
| `writing` | `clay_tablet` cards in `removed` |

Objectives measuring a resource threshold (enabler layer works as designed): `first_settlement`,
`rites_rituals`, `restless_people`, `reading_seasons`, `first_temple`, `masonry`, `accounting`,
`pyramid`.

`sandbox` and `ice_age` are out of scope — their goals never win by design, so `hasObjectiveGradient`
is false and no steering applies.

### Evidence

The code path is conclusive on its own and holds regardless of card numbers: `writing_goal`'s single
goal is `G.removed.filter(c => c.cardId === 'clay_tablet').length`; no resource probe moves it;
`bestGoalThroughput` iterates an empty `goalValued` and returns 0 for territory, population and
culture alike; the consumables loop then has no `valued` entries to credit.

A planner replay on `writing` (`--seed 0`) showed the behavioural signature: production sat at 4–6 for
16 rounds against a tablet the run had to afford, food over-banked to 27, science drifted down to a
`dark_age` collapse, and **no tablet was ever played**. Population sat at 1-of-2 assigned for nearly
the whole run.

> The specific win-rate figures from that session (planner 38% vs. oracle 100% on `writing`) were
> measured mid-experiment and are **not** a baseline. They predate the Hut/House cost changes that
> shipped alongside the escalating `clay_tablet`, and the 80% reading earlier in the same session was
> against the older flat-drain tablet. They motivated the investigation; Phase 0 exists precisely
> because no trustworthy baseline exists yet.

## The proposal

Give each strategic pool a **baseline intrinsic weight** in `deriveEnablers`, independent of whether
the objective happens to name a resource. Sketch, not settled:

- Credit territory / population / culture a constant per unit, denominated in `OBJECTIVE_WEIGHT` units
  so it composes with `scoreState` the way the derived credits already do.
- Keep the existing `CAPACITY_CAP` saturation, so the slope rewards growth to a point and then flattens.
- Where the objective *does* supply a derived throughput credit, compose as `max(intrinsic, derived)` —
  so a mission whose goal genuinely runs through population is never downgraded by adding a floor.
- Preserve the existing skip when a pool is **itself** goal-valued (`masonry`'s population,
  `rites_rituals`' culture): band 4 already scores it directly, and an intrinsic credit on top would
  double-count. This is a decision to confirm, not an obvious truth — see below.

Over-building is bounded the way the module already claims to bound it: by `scoreState`'s real costs
(population's food drain lands in bands 2–3), not by the credit itself.

### Why not the objective-introspection route

The alternative considered was teaching the probe to identify the *card* an objective wants and read
its cost, which would make production goal-valued on `writing` and light up the existing machinery
unchanged. It was set aside as the heavier option: a goal's `measure` is an opaque closure with no
structural field naming the card, so it needs a card-probe (inject each deck cardId into `removed` /
tableau, see what moves the gradient) and gets fragile for unusual measures. It remains a viable
*later* layer on top of the intrinsic floor — the two are not exclusive.

## Open decisions

- **Magnitude.** The intrinsic credit is a tuned constant with no analytical derivation, like
  `CAPACITY_HORIZON` before it. Too generous and the planner builds engine it never converts.
- **Double-count guard.** Whether to skip the intrinsic credit when the pool is itself goal-valued
  (proposed) or to take the max there too, on the argument that a pool's *engine* value is genuinely
  separate from its *goal* value.
- **Per-pool or uniform.** Territory (building slots), population (worker slots, and it eats) and
  culture (hand size, gates) do not obviously deserve the same constant. Population is the only one
  carrying an upkeep cost.
- **Deadline blindness.** Engine that cannot be converted before a mission's deadline is wasted, and
  neither `CAPACITY_HORIZON` nor the proposed constant knows the round budget. Pre-existing limitation;
  noting it so it is not mistaken for a regression this change introduces.

## Phase 0 — Baseline capture (**do this first; spans sessions**)

`deriveEnablers` runs on **every** mission, so this change cannot be evaluated on the affected four
alone — the regression risk is on the eight that currently work. A before/after comparison needs a
committed baseline over both groups.

**Precondition — a clean tree.** A baseline measured against uncommitted content edits is worthless.
Before capturing, `git status --porcelain` must be clean for `src/content/`; stash or commit any
in-flight card experiment first.

A baseline is a **self-contained fixture** under `scripts/sim/baselines/` — one JSON per mission owning
its own mission id, full deck and board, so a cell can be read and re-run without reassembling three
CLI axes. `npm run sim -- --baseline <paths|dir>` sweeps them.

Steps:

1. One fixture per winnable mission. The deck is what a player actually owns *arriving* there: through
   the Stone Age that is the minimal no-purchase set (starting collection + one copy of each unlocked
   card, no bought copies, no stickers), since `ice_age` — the only Influence faucet to grind — does not
   open until First Temple. From the Bronze Age on, bought copies and stickers are fair game. An
   optional challenge *leaf* (Pyramid) is revisitable, so its pool is not its prereq closure.
   The first capture covers First Settlement → Accounting. **Writing has no baseline yet** — its numbers
   are the ones this document was written to explain, and its content is still mid-balance, so it gets a
   fixture once its drain settles.
2. Sweep and commit the JSON under `scripts/sim/baselines/results/`. **The commit is the SHA record** —
   committing results into the same repo pins what content they were measured at more reliably than a
   copied string, so nothing embeds `git rev-parse HEAD`.
3. Budget: **greedy @ 100 seeds** (the floor — cheap) + **planner @ 100** + **oracle @ 10**, so each
   baseline carries a floor-to-ceiling bracket rather than one number. Roughly 30–60 minutes of wall
   clock, dominated by the planner's per-turn search.
4. **Take the numbers as they land.** Do not re-sweep a mission at higher seeds because its win rate
   sits near 50% — these baselines exist to measure and then improve the *planner* (and the oracle), not
   to judge whether a mission is tuned. A middling win rate is a datum about the policy.

Until Phase 0 exists, **planner win rates on the four affected missions should not be used as balance
signals** — they measure a planner blind spot, not the mission's difficulty.

## Phase 1 — Implement

Confine the change to `sim/enablers.ts` (per the *sim logic stays in sim* rule — no hook on any card,
mission, or rule). `deriveEnablers` gains the intrinsic floor; `enablerPotential` is unchanged, since
it already folds whatever weights the model carries.

Existing coverage to keep honest: `enablers.test.ts` pins relationships against real content (a cap
equal to its converter's cost) rather than copied literals — extend in that style, asserting the floor
exists on a card-count objective and that a goal-valued pool still composes as decided above.

## Phase 2 — Tune and verify

Re-sweep the Phase 0 matrix (`npm run sim -- --baseline scripts/sim/baselines …`, same policies and seed
counts) and diff against the committed results:

- **Affected four** — win rate should rise, and the planner-vs-oracle gap narrow.
- **Unaffected eight** — win rates must not regress. This is the real acceptance test.
- **Behavioural check** — replay a previously-lost seed on `writing` and confirm the trace now banks
  toward the goal card and staffs its population, rather than only that the number moved.

A win-rate gain on the affected group bought with a regression on the other eight means the constant is
too generous; that is the expected failure mode and the reason both groups are baselined.

### Measured

`INTRINSIC_CAPACITY_CREDIT = 0.01 · OBJECTIVE_WEIGHT`, uniform, composed as `max(floor, derived)`. Planner
@ 100 seeds; greedy came back bit-identical on all eleven cells, so the planner is the only variable.

- **Unaffected eight — no regression.** `masonry` +0.05 (0.87 → 0.92), `finding_copper` +0.01,
  `reading_seasons` −0.01, `restless_people` −0.04, the rest flat. The acceptance test passes.
- **Affected four — no gain available.** Three sit at the planner ceiling already (`growing_numbers` 1.00,
  `raiders_at_border` 0.99, `finding_copper` 0.96) and are unchanged. Only `writing` had headroom, and it
  did **not** improve: 0.29 → 0.23 (~1σ at 100 seeds), against an oracle ceiling of 1.00.

Win rate is the wrong instrument for this change, though — every baselined mission already has an objective
gradient dominating the leaf value, so a floor that only fills a vacuum has nothing to move. The isolating
measurement is **`sandbox`**, whose objective never wins: `goalValued` is empty, so the floor is the *only*
term in the model. Planner @ 20 seeds, `scripts/sim/decks/sandbox-engine.json` on City, mean end state:

| | no floor | with floor |
| --- | --- | --- |
| population | 2.30 | 6.40 |
| territory | 2.45 | 8.45 |
| culture | 0.75 | 69.60 |
| production | 28.6 | 254.2 |
| food | 200.3 | 141.7 |

Defeat causes are identical across the two arms (17 stall · 3 famine), so the engine growth costs nothing in
survival — the "bounded by `scoreState`'s real costs" claim, measured. Card plays move the same way (houses
3 → 44, conquest 9 → 129, Göbekli Tepe never-played → played). Without the floor the planner banks 200 food
that does nothing; with it, that food becomes a compounding engine.

So the change is **neutral where an objective gradient already leads, decisive where there is none** — the
intended shape. A flat win rate on the baselines is that neutrality, not inertness.

Writing's baseline, captured ad-hoc at this SHA (`scripts/sim/decks/writing.json`, City board, no fixture
yet per Phase 0): greedy 0.03 · planner 0.29 · oracle 1.00 — the widest planner-to-oracle gap in the set.

### Why the floor cannot fix `writing`

Structural, not a magnitude to tune — and a different regime from `sandbox` above: writing *has* a gradient
(step-wise, one jump per recorded tablet), so the floor competes with it instead of filling a vacuum.
A card-count objective makes `goalValuedResources` return `{}`, so
production — which *is* `clay_tablet`'s cost — is never goal-valued. The floor weights the strategic pools,
the consumables loop then reads those weights into `valued`, and production gets credited toward
`Hut → population` and `Beer → culture`: engine sinks that **compete** with the production the tablet needs.
The seed-0 trace shows exactly that — where the pre-change run banked food and played no tablet, the
post-change run built culture 0 → 15 (Beer ×2), unassigned a worker, and died three rounds *earlier*.
Raising the constant strengthens the competition, so magnitude is the wrong lever.

What `writing` needs is the deferred card-introspection layer: band 4 already rewards *playing* a tablet
(`objectiveProgress` reads the removed count), but the turns spent banking 6🔨 toward one are flat, and only
a probe that identifies the goal-advancing **card** and reads its cost can slope them. The two layers remain
non-exclusive — the floor stands on the band-5 asymmetry argument, independent of this.

# Durable producer valuation (planner)

A **second, separate** hole, found while surveying for others. Independent of both the intrinsic strategic
floor above and the deferred card-introspection layer: it would remain after either ships.

## The hole

The planner runs at `depth: 1` (`plannerPolicy.ts`), with leaf value `scoreState(G) + enablerPotential(G,
enablers)`. Nothing in that leaf amortizes a **capital cost against a per-turn return**, so a permanent
producer is priced only by what its *current staffing* yields on the projected turn.

Two consequences, in ascending order of severity:

- A building the run cannot staff *this* turn is worth **zero**. An unstaffed structure is not `isOperating`,
  so it contributes nothing to `permanentDelta`, nothing to `projectNextTurn`, and nothing to the flat
  `operating` credit — while the production it cost would have scored in band 5 had it gone unspent. Building
  one is a scored loss.
- Even a building staffed the turn it is built cannot pay back inside the horizon. A Forge is 4🔨 for
  2🔨/worker/round: two rounds to break even, and round two is past `depth: 1`. The `operating` credit does
  not discriminate — a staffed Toolmaking box earns the same 2 for free.

The mispricing is *relative to work cards*, which is what makes it invisible in the catalogue's own terms:
Forge and Toolmaking both yield 2🔨/worker, so a leaf that sees one turn sees two equivalent options, one of
which costs 4🔨 and a territory slot more. Forge's whole advantage — that it keeps producing without a
redraw, and can be **re-staffed at will** — lives entirely beyond the horizon.

`scoreState`'s band 3 is the only term distinguishing permanent from transient income (`permanentDelta` drops
the work zone). It enters as `drain = max(0, -perm[k])` and penalises only shortfall, so it credits permanent
income *up to break-even only*, and is inert whenever the pool is not in deficit. On a deck with no production
upkeep it does nothing for a production building.

### Relation to the two other gaps

- **The strategic floor** (above) credits territory/population/culture. Its sandbox measurement showed
  territory 2.45 → 8.45 and production 28.6 → 254.2 — buildings got built once something else paid for the
  *slots*, never because their income stream was valued. The floor routes around this hole; it does not close it.
- **Card introspection** (deferred) would slope the turns spent banking toward a goal card. It makes production
  goal-valued on a card-count mission, which *raises* the opportunity cost of spending 4🔨 on a Forge. It does
  not teach the leaf to amortize.

## Evidence

Ad-hoc at `8ca62c9` (`writing` has no baseline fixture per Phase 0). Cells are `scripts/sim/decks/writing.json`
on City and two edits of it; planner @ 30 seeds, oracle @ 15.

| cell | policy | win rate | median turns | forge plays | clay_tablet plays |
| --- | --- | --- | --- | --- | --- |
| writing.json (2 forge + 2 toolmaking, 23) | planner | 23.3% (7/30) | 21.5 | 9 | 67 |
| A — Toolmaking removed (2 forge, 21) | planner | 20.0% (6/30) | 19.0 | 11 | 41 |
| B — Toolmaking→Forge (4 forge, 23) | planner | 33.3% (10/30) | 20.0 | 15 | 66 |
| A — Toolmaking removed (2 forge, 21) | oracle | 93.3% (14/15) | 25.0 | 14 | 70 |

**The win rates are not usable** — at 30 seeds σ on a ~25% rate is ~8pp, so baseline-vs-B is ~1.3σ. The play
counts carry the finding.

**Substitution is ruled out.** Baseline → A holds Forge at 2 copies and removes its free substitute entirely;
Forge plays go 9 → 11, i.e. flat. The planner does not reach for the permanent producer even when it becomes
the deck's only production source — while tablets fall 67 → 41 and median run length 21.5 → 19, so the
production starvation is real and uncompensated.

**The oracle discriminates.** On variant A it plays Forge 14 times across 15 runs against the planner's 11
across 30 — 0.93 vs 0.37 per run, still 1.9× after normalising for its longer runs — while *under*-playing
Conquest 1.8×. So this is not a generic search-depth artifact spread evenly across the catalogue.

**Seed-0 replay, variant A, same shuffle.** The planner plays Bow on turn 1 (prod 6 → 4), passes turn 2, plays
Farm on turn 3 — and production sits at exactly **2 for the next fourteen turns**, permanently below Forge's
4🔨. Forge never built, no tablet ever played, `dark_age` at round 16. The oracle passes turn 1 to preserve
prod 6, builds Forge on turn 2, and climbs 4 → 6 → 8 → 10 by turn 9; victory at round 27 with five tablets.
The hands diverge at turn 1, so this is not a same-hand counterfactual — the aggregate above is what carries
the claim; the replay shows its shape.

**What the oracle actually exploits.** On turns 5, 12, 14, 17, 23 and 24 it *transfers* its single worker
between Forge and Storytelling, and unassigns Forge outright at 23 — banking production when a tablet is
close and science when `dark_age` looms. It is using the Forge as a **re-staffable option**, not an income
stream. That option requires only *ownership*, and ownership is exactly what the leaf prices at zero.

## The proposal

Confine to `sim/enablers.ts` — the durable-core-producer analogue of `CAPACITY_HORIZON`, which already
amortizes a *strategic* pool's output over several rounds at the leaf so the shallow beam need not search it.
Sketch, not settled:

- Credit each owned staffable structure for a few rounds of its `produces` output, at the per-unit weights the
  model already carries.
- Credit **ownership, not current staffing** — the re-staffable option above. An unstaffed structure must not
  be worth zero.
- Credit only the **tail beyond the projected turn**: a staffed building's next-turn output already lands in
  `scoreState`'s projection, and crediting it again double-counts.
- Saturate at a cap, with over-building bounded by `scoreState`'s real costs (production spent) and the
  territory slot, the way the module already bounds the capacity credits.

### Why enablers rather than scoreState

The defect is arguably in `scoreState`, and confining the fix to `enablers.ts` leaves the greedies blind to
capital investment permanently. That is the intended outcome, not a compromise: the greedies are the one-ply
difficulty **floor**, and "cannot plan a two-turn capital investment" is an accurate characterisation of a
one-ply policy rather than a bug in it. Making the floor smarter changes what the floor measures. Multi-turn
capital planning is the planner's job, and `enablerPotential` is the leaf accelerator that exists to price
what `depth: 1` cannot search.

The operational reason is the same one that governed the floor: `scoreState` feeds greedy, greedy2, heuristic
and the oracle beam, so a change there puts all eleven baselines at risk, where the floor's confinement to
`enablers.ts` returned greedy bit-identical on every cell.

This is an **intrinsic amortization constant**, not `HOP_DISCOUNT`-style potential shaping — it carries
`INTRINSIC_CAPACITY_CREDIT`'s risk profile ("too generous and the planner builds engine it never converts"),
bounded by a cap rather than provably optimum-preserving. It should not be presented as sound shaping.

### Shipped

`PRODUCER_TAIL_HORIZON = 2` rounds, at `PRODUCER_CREDIT_CAP = 0.05 · OBJECTIVE_WEIGHT`, keyed per cardId in
the model and summed over `G.tableau` at the leaf. Three of the open decisions below fall out of one
formulation — crediting the tail **beyond** the projected turn, uniformly, with no staffing branch:

- **Ownership vs. staffing** needs no discount constant. `scoreState` credits an operating building's next
  round through its projection and the enabler never adds that turn, so staffed still strictly beats
  unstaffed while an unstaffed structure keeps its re-staffable option value.
- **One unit, not capacity.** `produces.resources` is per-worker; crediting full worker capacity would
  re-charge for the population that staffs it, which the capacity pass already weights. Magnitude rides on
  the horizon instead.
- **Wonders and one-shot buildings** confirmed to need no handling: the credit is `produces`-derived, so
  Hut/House score zero here and the population they grant is credited once, where it lands.

Per-unit worth is `max(valued, weight)` — a producer of the *goal* resource carries its value in the
goal-valued map, never in `weight` (the consumables loop skips a goal-valued cost), so a `weight`-only
credit would have priced the most important producers at zero.

### The two constants divide the mission set

They are not two dials on one slope; each governs a disjoint group, which is why the first tuning attempt
(halving the horizon) did nothing.

A producer of a **goal-valued** resource derives a credit far above the cap — a Forge is ~60 at horizon 2
where the cap is 15 — so on a resource-threshold mission the tableau **saturates** and the horizon is inert.
Where the objective names no resource the credit is a fraction of the cap (a Forge on `writing` derives 2),
the cap never binds, and the horizon alone sets the slope. So the **cap bounds over-building on the missions
that already have a gradient**, and the **horizon supplies the slope on the ones that don't**.

### Measured frontier

Planner @ 100 seeds against the committed baselines (Δ win rate; σ ≈ 5pp), plus `writing` variant A @ 30
seeds (Forge plays across 30 runs, against 11 before and the oracle's 14-in-15). Greedy returned
**11/11 bit-identical** at the shipped arm, so the planner is the only variable throughout.

| horizon · cap | accounting | pyramid | first_temple | writing forge |
| --- | --- | --- | --- | --- |
| 4 · 0.50 | **−0.24** | +0.12 | +0.01 | 15 |
| 2 · 0.50 | **−0.25** | +0.17 | +0.01 | 14 |
| 2 · 0.10 | **−0.08** | +0.17 | +0.01 | 14 |
| **2 · 0.05** (shipped) | **−0.04** | +0.07 | +0.01 | 14 |

`accounting` is the binding cell: at the first arm it lost 24pp (~5σ) with stalls 5 → 36 and median turns
40 → 93 — the doc's own predicted "builds engine it never converts" failure. It is insensitive to the
horizon and recovers only on the cap. `pyramid`, `first_temple` and `writing` came back byte-identical
across the 0.50 → 0.10 cap drop, confirming their credit sits below it; `pyramid` is where the cap finally
bites, halving its gain at 0.05.

The shipped arm is the one that regresses nothing, per the acceptance test below. `2 · 0.10` keeps pyramid's
full +0.17 and was rejected only because accounting's −0.08 (~1.6σ) could not be called noise at 100 seeds —
re-measuring that cell at 300 seeds is the open question if pyramid's extra 10pp is ever wanted.

**Still unmeasured:** the full eleven-fixture sweep at the shipped constants. The six cells that were
bit-identical at `4 · 0.50` are expected to stay so under a strictly smaller credit, but that is an
inference, not a measurement.

## Open decisions

- **Magnitude and horizon.** A tuned constant with no analytical derivation, like `CAPACITY_HORIZON` before it.
- **Interaction with the strategic floor.** Since the floor shipped, the consumables loop credits production
  toward `Hut → population` and `Beer → culture`. A durable-producer credit competes directly with those
  sinks for the same banked production, so the two constants must be tuned against each other, not
  independently.
- **Unstaffed discount.** A building with no prospect of ever being staffed (no free population, no path to
  it) is genuinely worth less than one about to be worked. Whether the credit is flat on ownership or scaled
  by staffing prospect is unresolved.
- **Wonders and one-shot buildings.** Hut/House grant population via a one-shot placement `effect`, not
  `produces`; a `produces`-derived credit would miss them, and the floor already credits the population they
  grant. Confirm this needs no separate handling rather than assuming it.
- **Deadline blindness.** Inherited from `CAPACITY_HORIZON` — engine that cannot be converted before a
  mission's deadline is wasted, and no constant here knows the round budget.

## Measuring it

**Win rate on `writing` is the wrong instrument**, and for a different reason than the floor's neutrality: it
is confounded by the card-introspection gap, since banking 6🔨 toward a tablet is unsloped whether or not the
Forge that produced it was correctly valued. A correctly-built engine can leave win% flat.

The behavioural signals instead:

1. **Forge play count** on variant A — does it rise from ~11/30 toward the oracle's rate.
2. **The variant-A seed-0 replay** — does the planner now build Forge in the opening turns rather than
   stranding itself at prod 2.
3. **The sandbox end-state diff**, the isolating instrument the floor used: `sandbox`'s objective never wins,
   so nothing competes with the credit. Watch tableau size and production against the committed no-floor /
   with-floor columns above.

Phase 0's baseline discipline applies unchanged for regression: the eleven committed fixtures must not regress,
and that is the acceptance test.
