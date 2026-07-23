import { CORE_KEYS, STRATEGIC_KEYS, cloneState, cultureLevel, emptyResources, type GameState, type Resources } from '../rules';
import { CARDS, isStructure, type CardDef } from '../content/cards';
import { objectiveProgress } from './objective';
import { OBJECTIVE_WEIGHT } from './value';

/**
 * A **sim-local enabler potential** — a leaf-value accelerator for the planner (`sim/plannerPolicy.ts`)
 * and the oracle beam, folded into their leaf heuristic beside `scoreState`.
 *
 * Two kinds of thing the bare objective gradient can't see, unified as "the objective progress this
 * banked/held resource can be *converted into*":
 *
 * - **Consumable conversions.** The one-ply greedies plateau when a win needs a multi-turn chain (bank
 *   production → Hut for +population): the production banked along the way doesn't move the objective, so
 *   an intermediate banking turn looks worthless. This module credits it for the goal progress it buys,
 *   discounted per hop — the missing slope that lets the search stay shallow.
 * - **Strategic capacity.** The three strategic resources all *grow the production engine* rather than
 *   being spent: territory is building slots, population is worker slots, culture is cards-per-turn and
 *   card gates. None is a cost, so none converts in a single hop; each is credited for the durable
 *   goal-throughput it *unlocks* over a horizon (build/staff/gate a goal-producer), saturated at a cap, and
 *   floored at a small intrinsic credit so an objective naming no resource still yields a growth slope.
 * - **Durable producers.** A structure is a capital cost bought against income spread over the rest of the
 *   run, so the one-turn leaf prices it below a free work box of the same yield and never builds it. Each
 *   *owned* structure is credited the rounds of its `produces` output that fall beyond the projected turn.
 *
 * Derived **mechanically from card data**, not a per-mission table: probe what moves
 * `objectiveProgress` — each resource directly (the goal-valued set), and each run card injected into
 * the zones a goal might count (a card-count goal's cost, banked toward directly) — then read each
 * card's `cost → effect/produces` (consumables) or `effect/produces` under its capacity role
 * (strategic). So "production matters because 4🔨 builds a Hut that yields +1 population" falls out of
 * `CARDS` alone. Lives strictly in `sim/` (per [[sim-logic-stays-in-sim]]); no hook on any
 * card/mission/rule.
 *
 * Each mechanism is separately ablatable via `EnablerTerms` — the shaping's aggregate effect is
 * mission-dependent in *sign*, so measurement needs per-term attribution, not one on/off switch. A term
 * that is off never enters the model; the terms left on price through whatever model the others built
 * (no synthetic "as if" cross-terms).
 */

/** Discount per conversion hop. Strictly `< 1` is what makes the shaping *sound*: the potential a bank of
 *  R' carries (`weight·cap`) is always less than the objective jump that converting it yields, so playing
 *  the conversion strictly beats hoarding toward it — the slope guides the search without moving the
 *  optimum (bounded potential-based shaping). */
const HOP_DISCOUNT = 0.5;

const PROBE = 1;

/** Rounds of throughput a unit of *strategic capacity* is credited for — the durable analogue of the
 *  consumable enablers' one-shot `HOP_DISCOUNT`. A strategic resource isn't spent: a slot/worker/level
 *  keeps unlocking its producer's goal output *every* round, so its potential is a few rounds of that
 *  output, not a single hop. Kept static and modest (deliberately not the real deadline — the module
 *  stays draw/round-agnostic): large enough to clear the cost hump of the building it unlocks, small
 *  enough that `scoreState`'s real costs (food drain, spent production) still bound over-building. Tuned
 *  against the win-rate metric, not derived analytically. */
const CAPACITY_HORIZON = 2;

/** Saturation cap on credited strategic capacity — a generous constant so the slope rewards growth well
 *  past the starting pool without binding at realistic deck sizes; over-building is bounded by
 *  `scoreState`'s real costs, not this. */
const CAPACITY_CAP = 12;

/** Baseline per-unit credit for holding a strategic pool, independent of any objective-derived throughput.
 *  `scoreState`'s band 5 already grants *core* pools a small unconditional accumulation credit while the
 *  strategic pools — the ones that actually compound — get none, so an objective neither probe registers
 *  (a never-winning sandbox goal) leaves the whole model empty and the planner unshaped. A bigger engine is worth
 *  something on any mission; how much is affordable is already priced by `scoreState`'s costs. Composed as
 *  `max(floor, derived)` so a pool the objective genuinely runs through is never downgraded by adding a
 *  floor. Uniform across the three pools: population's upkeep is the one asymmetry, and it lands as food
 *  drain in bands 2–3 rather than needing a smaller credit here. Tuned against win-rate, not derived. */
const INTRINSIC_CAPACITY_CREDIT = 0.01 * OBJECTIVE_WEIGHT;

/** Per-culture-level credit for the bigger hand each level draws (`rules/culture.ts`'s `effectiveHandSize`
 *  adds one card per level). Unlike the other capacity credits this is *not* objective-directed — more
 *  cards helps every goal diffusely, not one producer — so it can't be derived as a conversion and rides
 *  no skip: it is credited even when culture is itself the win. A modest fraction of a goal step, tuned
 *  against win-rate, capped so a runaway culture engine can't dominate the leaf value. */
const HANDSIZE_LEVEL_CREDIT = 0.03 * OBJECTIVE_WEIGHT;
const HANDSIZE_LEVEL_CAP = 6;

/** Rounds of a durable producer's output credited at the leaf, counted **beyond** the projected turn.
 *  `scoreState` reads the projection, so a staffed building's *next* round already scores there; crediting
 *  it again would double-count, and the tail is exactly what `depth: 1` cannot see. A structure costs
 *  production now against income spread over the rest of the run, so a leaf that prices only one turn rates
 *  a 4🔨 Forge below a free Toolmaking box of equal yield. The credit rides on **ownership**, not staffing —
 *  a built-but-unstaffed structure is a re-staffable option worth more than nothing — and staffed still
 *  strictly beats unstaffed, since only the staffed one also collects the projected turn. Flat on
 *  ownership: a structure with no prospect of ever being staffed is genuinely worth less than one about to
 *  be worked, and this credits both the same. */
const PRODUCER_TAIL_HORIZON = 2;

/** Saturation cap on the summed durable-producer credit — the primary bound on over-building, since unlike
 *  `HOP_DISCOUNT`'s conversion slope this is an intrinsic amortization constant, not sound potential
 *  shaping, so nothing but the cap and `scoreState`'s real costs stops a runaway.
 *
 *  It is the load-bearing constant of the two, and the horizon is nearly inert where it binds: a producer of
 *  a **goal-valued** resource derives a credit far above this cap (a Forge on a production-threshold mission
 *  is ~60 at horizon 2, against a cap of 15), so its whole tableau saturates here and scaling the horizon
 *  changes nothing. Where the goal names no resource the credit is a fraction of the cap and the horizon
 *  alone sets the slope. Tuned to the point where a long conversion mission stops regressing — see
 *  docs/STRATEGIC-VALUATION.md for the measured frontier. */
const PRODUCER_CREDIT_CAP = 0.05 * OBJECTIVE_WEIGHT;

/** Per-term ablation toggles for the enabler model. A missing key means **on** — you name what you switch
 *  off, so `{}` is the full model. Only the `cardCosts`/`conversions` slopes carry a soundness argument
 *  (bounded potential shaping); the others are tuned value assertions, which is exactly why they ablate
 *  separately. */
export interface EnablerTerms {
  /** Card-cost goals — a resource funding a card the objective *counts* banked toward directly
   *  (`goalValuedCardCosts`). Off, a card-count objective derives like one naming no resource. */
  cardCosts?: boolean;
  /** Consumable conversions — a banked core resource credited for the valued output it converts into
   *  (`HOP_DISCOUNT`). */
  conversions?: boolean;
  /** Strategic capacity — territory/population/culture credited for the goal-throughput a slot/worker/
   *  gated level unlocks (`CAPACITY_HORIZON`). */
  capacity?: boolean;
  /** The intrinsic strategic floor (`INTRINSIC_CAPACITY_CREDIT`) — the unconditional per-unit credit a
   *  strategic pool keeps even when no objective-derived throughput exists. */
  floor?: boolean;
  /** Culture's per-level hand-size credit (`HANDSIZE_LEVEL_CREDIT`). */
  handSize?: boolean;
  /** Durable producers — owned structures credited `PRODUCER_TAIL_HORIZON` rounds of tail output. */
  producers?: boolean;
}

/** Normalize a policy's `enablers` option: `false` → `null` (no model at all), `true` → every term on,
 *  an `EnablerTerms` object → itself. Shared by the planner and oracle so the two can't drift. */
export function enablerTermsOf(enablers: boolean | EnablerTerms): EnablerTerms | null {
  return enablers === false ? null : enablers === true ? {} : enablers;
}

/** The **planner's shipped term set** — the two carriers (capacity, producers) plus the confined
 *  card-cost slope; conversions/floor/handSize off. Measured against the full model over the whole
 *  baseline set (planner @ 100 paired seeds, the tuned depth-2 config @ 10): never worse than ~1 seed
 *  anywhere, +10..+15pp on the three hardest cells (pyramid/restless_people/writing), and the full
 *  model's depth-1 stall-cell edge (first_temple/accounting) vanishes at depth 2 — see
 *  docs/STRATEGIC-VALUATION.md → *The default term set*. The oracle deliberately does **not** use this:
 *  its job is proving winnability, and the all-on model finds strictly more wins there (12×10/10). */
export const DEFAULT_ENABLER_TERMS: EnablerTerms = { conversions: false, floor: false, handSize: false };

/** A per-run enabler model, derived once from the seeded objective and reused at every leaf. */
export interface EnablerModel {
  /** Per-unit score credit for holding an enabler resource — a consumable banked toward a conversion, or
   *  a strategic pool held as production capacity. */
  weight: Partial<Record<keyof Resources, number>>;
  /** Saturate each resource's credit at its useful ceiling — a consumable at one conversion's worth (the
   *  best card's cost), a strategic pool at `CAPACITY_CAP` — so the slope rewards growth up to that point
   *  then flattens rather than rewarding unbounded hoarding. */
  cap: Partial<Record<keyof Resources, number>>;
  /** Non-keyed credit for culture's hand-size throughput (see `HANDSIZE_LEVEL_CREDIT`): level-based, not
   *  linear in raw culture, and folded in `enablerPotential` regardless of whether culture is goal-valued. */
  handsizePerLevel?: number;
  /** Per-**cardId** credit for owning one of that durable producer, keyed rather than recomputed per leaf
   *  because the planner evaluates this on every beam node. Only structures with a `produces` appear. */
  producerCredit: Partial<Record<string, number>>;
}

/** Which resources move the objective gradient, and by how much per unit — probed from a zeroed-resource
 *  clone so the objective's caps (e.g. `min(population, 6)`) don't hide the slope. Goals measured in
 *  *cards* rather than resources register through `goalValuedCardCosts` instead. */
function goalValuedResources(G: GameState): Partial<Record<keyof Resources, number>> {
  const probe = cloneState(G);
  probe.resources = emptyResources();
  const base = objectiveProgress(probe);
  const out: Partial<Record<keyof Resources, number>> = {};
  for (const k of Object.keys(probe.resources) as (keyof Resources)[]) {
    probe.resources[k] = PROBE;
    const delta = objectiveProgress(probe) - base;
    probe.resources[k] = 0;
    if (delta > 0) out[k] = delta / PROBE;
  }
  return out;
}

function positive(x: number | undefined): number {
  return x !== undefined && x > 0 ? x : 0;
}

/** The card-count counterpart of `goalValuedResources`: which core resources fund a card the objective
 *  *counts*, probed by injecting a synthetic instance of each run card into the zones a goal can measure
 *  (`removed` for a played event, `tableau` for a building) and diffing `objectiveProgress`. A card that
 *  moves the gradient makes its `cost` bankable: paying it *is* the goal step. The per-card progress
 *  delta is attributed **proportionally** over the card's total core cost — one shared per-unit marginal,
 *  so a full multi-resource bank sums to `HOP_DISCOUNT · delta`, keeping the shaping sound (a per-key
 *  `delta/costAmt` split would let the joint bank equal the step it converts into). Probed on an unzeroed
 *  clone: resource terms cancel in the diff, and a goal already at target correctly reads zero. Like the
 *  resource probe this runs once at the run root, so a goal card satisfied mid-run doesn't drop out of the
 *  model until the next derive. Exported for the tests that pin a resource-threshold mission's model as
 *  untouched by this probe (it must return `{}` there). */
export function goalValuedCardCosts(
  G: GameState,
): Partial<Record<keyof Resources, { marginal: number; costAmt: number }>> {
  const probe = cloneState(G);
  const base = objectiveProgress(probe);
  const out: Partial<Record<keyof Resources, { marginal: number; costAmt: number }>> = {};
  for (const cardId of runCardIds(G)) {
    const card = CARDS[cardId];
    if (!card) continue;
    let totalCost = 0;
    for (const ck of CORE_KEYS) totalCost += positive(card.cost[ck]);
    if (totalCost <= 0) continue; // a free card needs no banking, so its costs can't be enablers
    // Not filtered by kind: actions can self-exile via `resolve`, so any card may be what `removed` counts.
    probe.removed.push({ id: -1, cardId });
    const removedDelta = objectiveProgress(probe) - base;
    probe.removed.pop();
    probe.tableau.push({ id: -2, cardId, workers: 0 });
    const tableauDelta = objectiveProgress(probe) - base;
    probe.tableau.pop();
    const delta = Math.max(removedDelta, tableauDelta);
    if (delta <= 0) continue;
    const marginal = delta / totalCost;
    for (const ck of CORE_KEYS) {
      const costAmt = positive(card.cost[ck]);
      if (costAmt <= 0) continue;
      const prev = out[ck];
      if (!prev || marginal > prev.marginal) out[ck] = { marginal, costAmt };
    }
  }
  return out;
}

/** Every card id present anywhere in the run — the conversions actually available to this deck. Scanning
 *  all of `CARDS` would credit a conversion the deck can't perform (an unlocked-but-undecked card). */
function runCardIds(G: GameState): Set<string> {
  const ids = new Set<string>();
  for (const zone of [G.deck, G.hand, G.discard, G.removed, G.tableau, G.workZone]) {
    for (const c of zone) ids.add(c.cardId);
  }
  return ids;
}

/** The best single-card goal throughput this run can unlock under a capacity role: the highest
 *  `output × marginal × OBJECTIVE_WEIGHT` over the deck's own cards that `accept`s — a staffable producer
 *  for population, any structure for territory, a gated producer for culture. `scanEffect` includes a
 *  card's one-shot placement `effect` (Hut/House grant population there, not in `produces`) alongside its
 *  per-round `produces`; population passes `false`, since it's the *staffing* of `produces` that yields
 *  output, not the play effect. */
function bestGoalThroughput(
  ids: Set<string>,
  goalValued: Partial<Record<keyof Resources, number>>,
  accept: (card: CardDef) => boolean,
  scanEffect: boolean,
): number {
  let best = 0;
  for (const card of Object.values(CARDS)) {
    if (!ids.has(card.id) || !accept(card)) continue;
    for (const [gk, marginal] of Object.entries(goalValued) as [keyof Resources, number][]) {
      const output =
        (scanEffect ? positive(card.effect?.resources?.[gk]) : 0) + positive(card.produces?.resources?.[gk]);
      if (output > 0) best = Math.max(best, output * (marginal * OBJECTIVE_WEIGHT));
    }
  }
  return best;
}

/** Whether the run holds any card that outputs culture — the precondition for crediting culture's
 *  hand-size throughput (with no way to raise culture, the level never moves and the credit can't steer). */
function canGrowCulture(ids: Set<string>): boolean {
  return Object.values(CARDS).some(
    (c) => ids.has(c.id) && positive(c.effect?.resources?.culture) + positive(c.produces?.resources?.culture) > 0,
  );
}

/**
 * Build the enabler model for a run from its seeded objective:
 *  - **Card-cost goals** first — a resource funding a card the objective counts is banked toward
 *    directly, one `HOP_DISCOUNT` below the goal step paying it yields. The direct weight is what a
 *    *real* goal-valued resource never needs: `scoreState`'s objective band scores a resource threshold
 *    as it accumulates, but a card-count goal moves only when the card lands, so the banking turns are
 *    flat without it. Confined to that slope (plus the producer credit it implies) — see the pass for
 *    why it must not light up the capacity machinery.
 *  - **Strategic capacity** — territory / population / culture each credited for the goal-throughput
 *    a slot / worker / gated level unlocks over `CAPACITY_HORIZON`, plus culture's hand-size nudge.
 *  - **Consumables** — for each *valued* resource (goal-valued, or a strategic pool the capacity pass
 *    weighted) scan the run's cards for one that outputs it (`effect`/`produces`) and credit each core cost
 *    the discounted conversion rate; keep the best per resource. Chaining through the capacity weights is
 *    what bridges a two-hop setup (military → Conquest → territory → Hut): territory isn't goal-valued, but
 *    its capacity weight makes it a conversion target, so banking the military that buys the Conquest is
 *    finally shaped.
 * A resource already credited directly by the objective is not shadowed as its own enabler.
 */
export function deriveEnablers(G: GameState, terms: EnablerTerms = {}): EnablerModel {
  const { cardCosts = true, conversions = true, capacity = true, floor = true, handSize = true, producers = true } =
    terms;
  const goalValued = goalValuedResources(G);
  const ids = runCardIds(G);
  const weight: EnablerModel['weight'] = {};
  const cap: EnablerModel['cap'] = {};

  // Card-cost goals: a direct banking slope on the goal card's cost resources, capped at one
  // conversion's worth like the consumables loop (the search cycles bank → play → re-bank, so a
  // multi-card target needs no scaled cap), plus — through `unitValue` below — the durable credit of
  // that cost's producers. Deliberately **not** merged into `goalValued`: the capacity passes credit a
  // pool at its producer's full per-round slope, which is calibrated against a gradient that *accrues*
  // every round a resource is held, while a card-count gradient only steps when the card lands — fed
  // this marginal they price engine several goal steps above the goal itself, and the engine sinks
  // out-compete the very banking this slope exists to reward. The resource probe wins a collision (its
  // marginal is the objective's own slope, not an attribution).
  if (cardCosts) {
    for (const [ck, e] of Object.entries(goalValuedCardCosts(G)) as [
      keyof Resources,
      { marginal: number; costAmt: number },
    ][]) {
      if (goalValued[ck] !== undefined) continue;
      weight[ck] = HOP_DISCOUNT * e.marginal * OBJECTIVE_WEIGHT;
      cap[ck] = e.costAmt;
    }
  }

  // A strategic pool's weight composes its two independent terms as a `max` — the derived throughput
  // (`capacity`) and the unconditional floor (`floor`) — so ablating either leaves the other intact; with
  // both off (or a zero derivation and no floor) the pool gets no weight at all.
  const strategicWeight = (bestThroughput: number): number =>
    Math.max(floor ? INTRINSIC_CAPACITY_CREDIT : 0, bestThroughput * CAPACITY_HORIZON);

  // Strategic capacity enablers — territory, population, culture. None is *spent* on a card: each is a
  // durable capacity that unlocks a goal-producer's output every round, credited over `CAPACITY_HORIZON`
  // (not the consumables' one-shot `HOP_DISCOUNT`), saturated at `CAPACITY_CAP`, and floored per
  // `strategicWeight`. Each is skipped when it is itself goal-valued — the objective scores it directly,
  // the same reason the consumable loop below
  // skips a goal-valued cost resource. Computed first so a capacity weight can itself be a conversion
  // target for the consumables. Complementarity (a staffed building needs both a slot and a worker) needs
  // no joint model: crediting the *total* pool never falls when one is consumed (strategic pools aren't
  // spent), so the two credits can't deter building what they jointly enable — the payoff materializes only
  // once both pools are grown, and the search grows both.

  // Territory is the slot for any structure, so it reads the best goal output over *all* the deck's
  // structures — a self-sufficient grant (Hut/House, on `effect`) or a staffed producer (Farm/Forge, on
  // `produces`) alike.
  if (goalValued.territory === undefined) {
    const w = strategicWeight(capacity ? bestGoalThroughput(ids, goalValued, isStructure, true) : 0);
    if (w > 0) {
      weight.territory = w;
      cap.territory = CAPACITY_CAP;
    }
  }

  // Population is the worker for a per-worker producer (`workers >= 1`); the staffing yields the output, so
  // it reads `produces` only, not the card's one-shot play `effect`.
  if (goalValued.population === undefined) {
    const w = strategicWeight(capacity ? bestGoalThroughput(ids, goalValued, (c) => (c.workers ?? 0) >= 1, false) : 0);
    if (w > 0) {
      weight.population = w;
      cap.population = CAPACITY_CAP;
    }
  }

  // Culture's gate-unlock: reaching a level ungates a producer (a `cultureLevelReq` card), so raw culture
  // banked toward it is credited that producer's goal output. Skipped when culture is itself the win (then
  // reaching the level *is* the objective, already scored). Its hand-size throughput is the separate,
  // no-skip nudge below.
  if (goalValued.culture === undefined) {
    const w = strategicWeight(capacity ? bestGoalThroughput(ids, goalValued, (c) => !!c.gate?.cultureLevelReq, true) : 0);
    if (w > 0) {
      weight.culture = w;
      cap.culture = CAPACITY_CAP;
    }
  }

  // Consumables. Value each resource worth converting *into* at its score credit per unit — a goal-valued
  // resource at `marginal · OBJECTIVE_WEIGHT`, a strategic pool the capacity pass weighted at that weight.
  // Including the strategic weights is the chaining: military isn't goal-valued and Conquest yields only
  // territory, but territory now carries a capacity weight, so banking the military that buys the Conquest
  // is credited — one `HOP_DISCOUNT` below the territory it converts into (`< 1`, so playing the conversion
  // still beats hoarding toward it).
  const valued: Partial<Record<keyof Resources, number>> = {};
  for (const [k, marginal] of Object.entries(goalValued) as [keyof Resources, number][]) {
    valued[k] = marginal * OBJECTIVE_WEIGHT;
  }
  for (const k of STRATEGIC_KEYS) {
    if (weight[k] !== undefined) valued[k] = weight[k]!;
  }

  if (conversions) {
    for (const card of Object.values(CARDS)) {
      if (!ids.has(card.id)) continue;
      for (const [vk, valuePerUnit] of Object.entries(valued) as [keyof Resources, number][]) {
        const output = positive(card.effect?.resources?.[vk]) + positive(card.produces?.resources?.[vk]);
        if (output <= 0) continue;
        for (const ck of CORE_KEYS) {
          const costAmt = card.cost[ck] ?? 0;
          if (costAmt <= 0 || goalValued[ck] !== undefined) continue;
          const w = HOP_DISCOUNT * (output / costAmt) * valuePerUnit;
          if (w > (weight[ck] ?? 0)) {
            weight[ck] = w;
            cap[ck] = costAmt;
          }
        }
      }
    }
  }

  // Durable producers. Value one round of a structure's `produces` at the per-unit worth the model already
  // carries — `valued` for a goal resource (whose core weight the consumables loop deliberately leaves
  // unset), `weight` for one that is only a conversion input — then credit `PRODUCER_TAIL_HORIZON` of them.
  // Read at **one worker's** output (`produces.resources` is per-worker): crediting full capacity would
  // re-charge for the population that staffs it, which the capacity pass above already weights.
  const producerCredit: EnablerModel['producerCredit'] = {};
  if (producers) {
    const unitValue: Partial<Record<keyof Resources, number>> = {};
    for (const k of Object.keys(emptyResources()) as (keyof Resources)[]) {
      const v = Math.max(valued[k] ?? 0, weight[k] ?? 0);
      if (v > 0) unitValue[k] = v;
    }
    for (const card of Object.values(CARDS)) {
      if (!ids.has(card.id) || !isStructure(card) || !card.produces) continue;
      let perRound = 0;
      for (const [k, v] of Object.entries(unitValue) as [keyof Resources, number][]) {
        perRound += positive(card.produces.resources?.[k]) * v;
      }
      // A one-shot placement grant (Hut's population, on `effect`) is not durable income and earns nothing
      // here; it lands once in the resource pool, where the strategic weights already credit it.
      if (perRound > 0) producerCredit[card.id] = perRound * PRODUCER_TAIL_HORIZON;
    }
  }

  const model: EnablerModel = { weight, cap, producerCredit };
  if (handSize && canGrowCulture(ids)) model.handsizePerLevel = HANDSIZE_LEVEL_CREDIT;
  return model;
}

/** The enabler bonus for a state: each held enabler resource credited up to its cap, plus culture's
 *  level-based hand-size nudge. Pure over `G`; added to `scoreState` for the planner/oracle leaf value. */
export function enablerPotential(G: GameState, model: EnablerModel): number {
  let s = 0;
  for (const [k, w] of Object.entries(model.weight) as [keyof Resources, number][]) {
    const held = Math.max(0, G.resources[k]);
    s += w * Math.min(held, model.cap[k] ?? held);
  }
  if (model.handsizePerLevel) {
    s += model.handsizePerLevel * Math.min(cultureLevel(G.resources.culture), HANDSIZE_LEVEL_CAP);
  }
  let durable = 0;
  for (const placed of G.tableau) durable += model.producerCredit[placed.cardId] ?? 0;
  s += Math.min(durable, PRODUCER_CREDIT_CAP);
  return s;
}
