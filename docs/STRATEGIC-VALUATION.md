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
