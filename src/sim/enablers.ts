import { CORE_KEYS, STRATEGIC_KEYS, cloneState, cultureLevel, emptyResources, foodPerNextPop, placedCards, type GameState, type Resources } from '../rules';
import { effectiveGain } from '../rules/stickers';
import { realizedGain } from '../rules/effects';
import { CARDS, isDurableProducer, isStructure, type CardDef } from '../content/cards';
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
 *   Population's is further **net of the standing food its growth commits to**, the one capacity that
 *   carries a recurring cost of its own.
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
 *  floor. Uniform across the three pools even though population's growth carries an upkeep the others
 *  don't: that netting (`foodPerWorker`) rides on the *derived* credit alone, and would erase a floor this
 *  small rather than shade it. Tuned against win-rate, not derived. */
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
 *  Bounding the **tableau** rather than each structure is what expresses that: the runaway it guards against
 *  is an unbounded board of engine, and a per-structure cap would let one grow past a goal step. It binds
 *  well under a full board — one producer of a goal resource can saturate it alone — and past that point a
 *  further structure's *marginal* credit is zero, so the leaf ranks building one no better than not.
 *  Tuned, not derived. */
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
 *  anywhere, +10..+15pp on the hardest cells (pyramid, writing), and the full
 *  model's depth-1 stall-cell edge (first_temple/accounting) vanishes at depth 2. The oracle
 *  deliberately does **not** use this: its job is proving winnability, and the all-on model finds
 *  strictly more wins there (12×10/10). */
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
  /** The run's best per-worker 🌾 output — the denominator that converts a person's own food upkeep into
   *  the fraction of a worker it eats, and so the units in which `enablerPotential` nets population's
   *  credit. `0` means the deck can feed nobody. Present only where the capacity pass derived a real
   *  population credit, so a pool carrying only the intrinsic floor, or none at all, is never charged. */
  foodPerWorker?: number;
  /** Per-**cardId** credit for owning one of that durable producer, keyed rather than recomputed per leaf
   *  because the planner evaluates this on every beam node. Only an `isDurableProducer` with a
   *  `produces` appears, which is what lets `enablerPotential` walk the board unfiltered. */
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
 *  (`removed` for a played event, `tableau` for a building, `tradeRoutes` for an open route — the three a
 *  card *stays* in, so a goal can count it), each only for the kinds that reach it, and diffing
 *  `objectiveProgress`. A card that
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
    for (const ck of CORE_KEYS) totalCost += positive(card.cost.resources?.[ck]);
    if (totalCost <= 0) continue; // a free card needs no banking, so its costs can't be enablers
    // `removed` is not filtered by kind: actions can self-exile via `resolve`, so any card may be what it
    // counts. The two standing zones are, since `run/moves.ts`'s `playCard` is their only writer and routes
    // by kind — probing a card into a zone it can never reach would credit banking toward a goal step that
    // has no path to happen (military toward a route-count goal, whose only card is a `trade`).
    probe.removed.push({ id: -1, cardId });
    const removedDelta = objectiveProgress(probe) - base;
    probe.removed.pop();
    let tableauDelta = 0;
    if (isStructure(card)) {
      probe.tableau.push({ id: -2, cardId, workers: 0 });
      tableauDelta = objectiveProgress(probe) - base;
      probe.tableau.pop();
    }
    let routeDelta = 0;
    if (card.kind === 'trade') {
      probe.tradeRoutes.push({ id: -3, cardId, workers: 0 });
      routeDelta = objectiveProgress(probe) - base;
      probe.tradeRoutes.pop();
    }
    const delta = Math.max(removedDelta, tableauDelta, routeDelta);
    if (delta <= 0) continue;
    const marginal = delta / totalCost;
    for (const ck of CORE_KEYS) {
      const costAmt = positive(card.cost.resources?.[ck]);
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
  for (const zone of [G.deck, G.hand, G.discard, G.removed, placedCards(G)]) {
    for (const c of zone) ids.add(c.cardId);
  }
  return ids;
}

/** The best single-card goal throughput this run can unlock under a capacity role: the highest
 *  `Σ output × marginal × OBJECTIVE_WEIGHT` over the deck's own cards that `accept`s — a staffable producer
 *  for population, any structure for territory, a gated producer for culture. `scanEffect` includes a
 *  card's one-shot placement `effect` (Hut/House grant population there, not in `produces`) alongside its
 *  per-round `produces`; population passes `false`, since it's the *staffing* of `produces` that yields
 *  output, not the play effect.
 *
 *  A card's contributions are **summed across goal terms, then maxed across cards** — it really does pay
 *  every line of its `produces` each round, so a wonder paying three goal terms at once is worth their sum
 *  and not merely its largest. Maxing both (a slot holds one card) would rank a single-output Forge above
 *  such a wonder. `producerCredit` already sums this way; these two must agree on what a card produces.
 *
 *  `self` — the pool being credited — is excluded from the scan: crediting a pool for unlocking a producer
 *  of *itself* re-states the objective's own slope on that pool, and on a gated producer of its own gate
 *  (culture ungating a culture producer) it is circular. Vacuous unless `self` is goal-valued. */
function bestGoalThroughput(
  G: GameState,
  ids: Set<string>,
  goalValued: Partial<Record<keyof Resources, number>>,
  accept: (card: CardDef) => boolean,
  scanEffect: boolean,
  self: keyof Resources,
): number {
  let best = 0;
  for (const card of Object.values(CARDS)) {
    if (!ids.has(card.id) || !accept(card)) continue;
    const effect = scanEffect ? realizedGain(G, card.effect?.resources) : undefined;
    const produces = realizedGain(G, card.produces?.resources);
    let perCard = 0;
    for (const [gk, marginal] of Object.entries(goalValued) as [keyof Resources, number][]) {
      if (gk === self) continue;
      const output = positive(effect?.[gk]) + positive(produces?.[gk]);
      if (output > 0) perCard += output * (marginal * OBJECTIVE_WEIGHT);
    }
    best = Math.max(best, perCard);
  }
  return best;
}

/** The best per-worker 🌾 a staffed worker in this run can produce — the rate at which a person's own
 *  upkeep is paid, and so the denominator of population's net (see `enablerPotential`).
 *
 *  Walks the run's **instances** rather than `CARDS`, reading each through the same
 *  `effectiveGain`→`realizedGain` pair a real gain takes: a stickered copy really does yield its bonus,
 *  and pricing an Irrigated Farm at its base rate would charge a person several times what feeding them
 *  costs. The *sticker* half is deliberately not symmetrized onto `bestGoalThroughput`, which stays a
 *  static scan — widening that would move the credit on every mission at once and make a sweep delta
 *  unattributable. The board-modifier half is symmetrized, precisely because it doesn't have that
 *  problem: it is the identity on every board standing no modifier, so it moves one board's cells and
 *  leaves the rest byte-identical. */
function bestFoodPerWorker(G: GameState): number {
  let best = 0;
  for (const zone of [G.deck, G.hand, G.discard, G.removed, placedCards(G)]) {
    for (const inst of zone) {
      const card = CARDS[inst.cardId];
      if (!card || (card.workers ?? 0) < 1) continue;
      best = Math.max(best, positive(realizedGain(G, effectiveGain(card.produces?.resources, inst))?.food));
    }
  }
  return best;
}

/** Whether the run holds any card that outputs culture — the precondition for crediting culture's
 *  hand-size throughput (with no way to raise culture, the level never moves and the credit can't steer). */
function canGrowCulture(G: GameState, ids: Set<string>): boolean {
  return Object.values(CARDS).some(
    (c) =>
      ids.has(c.id) &&
      positive(realizedGain(G, c.effect?.resources)?.culture) +
        positive(realizedGain(G, c.produces?.resources)?.culture) >
        0,
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
  // `floorEligible` is false for a goal-valued pool: the floor is a blind "a bigger engine is worth
  // something" credit, which on a pool the objective scores directly would double its slope. The derived
  // term carries no such risk — it prices *other* goal terms (see `bestGoalThroughput`'s `self`).
  const strategicWeight = (bestThroughput: number, floorEligible: boolean): number =>
    Math.max(floor && floorEligible ? INTRINSIC_CAPACITY_CREDIT : 0, bestThroughput * CAPACITY_HORIZON);

  // Strategic capacity enablers — territory, population, culture. None is *spent* on a card: each is a
  // durable capacity that unlocks a goal-producer's output every round, credited over `CAPACITY_HORIZON`
  // (not the consumables' one-shot `HOP_DISCOUNT`), saturated at `CAPACITY_CAP`, and floored per
  // `strategicWeight`. A pool that is *itself* goal-valued still earns the derived credit — the objective
  // scores it toward its own threshold, which is a different quantity from the throughput of the *other*
  // goal terms it unlocks (a culture level ungating a wonder that pays the money and production terms). Only
  // the pool's own key drops out of the scan, and only its floor is suppressed.
  // Computed first so a capacity weight can itself be a conversion
  // target for the consumables. Complementarity (a staffed building needs both a slot and a worker) needs
  // no joint model: crediting the *total* pool never falls when one is consumed (strategic pools aren't
  // spent), so the two credits can't deter building what they jointly enable — the payoff materializes only
  // once both pools are grown, and the search grows both.

  // Territory is the slot a structure stands in — and only a structure, since a Work box and a trade
  // route cost none — so it reads the best goal output over the deck's buildings and wonders: a
  // self-sufficient grant (Hut/House, on `effect`) or a staffed producer (Farm/Forge, on `produces`) alike.
  {
    const w = strategicWeight(
      capacity ? bestGoalThroughput(G, ids, goalValued, isStructure, true, 'territory') : 0,
      goalValued.territory === undefined,
    );
    if (w > 0) {
      weight.territory = w;
      cap.territory = CAPACITY_CAP;
    }
  }

  // Population is the worker for a per-worker producer (`workers >= 1`); the staffing yields the output, so
  // it reads `produces` only, not the card's one-shot play `effect`. A Work box counts here despite paying
  // once per play: what's credited is the *worker*, which restaffs whatever is drawn each round, so the
  // capacity recurs even when no single card does — the asymmetry with `producerCredit`, which credits
  // owning one named card and so excludes `work`.
  // Alone among the three, this capacity carries a standing cost: the person eats every round thereafter.
  // `foodPerWorker` is the denominator that nets it (see `enablerPotential`), keyed on the *derived*
  // throughput rather than the composed weight so it can never reach a pool holding only the floor.
  const populationThroughput = capacity
    ? bestGoalThroughput(G, ids, goalValued, (c) => (c.workers ?? 0) >= 1, false, 'population')
    : 0;
  {
    const w = strategicWeight(populationThroughput, goalValued.population === undefined);
    if (w > 0) {
      weight.population = w;
      cap.population = CAPACITY_CAP;
    }
  }

  // Culture's gate-unlock: reaching a level ungates a producer (a `cultureLevelReq` card), so raw culture
  // banked toward it is credited that producer's goal output. Its hand-size throughput is the separate
  // nudge below, which rides no `self` exclusion at all — it is not objective-directed.
  {
    const w = strategicWeight(
      capacity ? bestGoalThroughput(G, ids, goalValued, (c) => !!c.cost.cultureLevelReq, true, 'culture') : 0,
      goalValued.culture === undefined,
    );
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
    // `max`, not assignment: a goal-valued pool now carries both an objective marginal and a capacity
    // weight, and taking the capacity one would *downgrade* what a unit of it is worth converting into.
    if (weight[k] !== undefined) valued[k] = Math.max(valued[k] ?? 0, weight[k]!);
  }

  if (conversions) {
    for (const card of Object.values(CARDS)) {
      if (!ids.has(card.id)) continue;
      const effect = realizedGain(G, card.effect?.resources);
      const produces = realizedGain(G, card.produces?.resources);
      for (const [vk, valuePerUnit] of Object.entries(valued) as [keyof Resources, number][]) {
        const output = positive(effect?.[vk]) + positive(produces?.[vk]);
        if (output <= 0) continue;
        for (const ck of CORE_KEYS) {
          const costAmt = card.cost.resources?.[ck] ?? 0;
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

  // Durable producers (`isDurableProducer`) — a Work box earns nothing here, since its single turn of
  // output is what the one-turn leaf already prices. Value one round of `produces` at the per-unit
  // worth the model already carries — `valued` for a goal resource (whose core weight the consumables
  // loop deliberately leaves unset), `weight` for one that is only a conversion input — then credit
  // `PRODUCER_TAIL_HORIZON` of them.
  // Read at **one worker's** output (`produces.resources` is per-worker for a staffable, and already flat
  // for a workerless route): crediting full capacity would re-charge for the population that staffs it,
  // which the capacity pass above already weights.
  // A route's `upkeep` rent is *not* netted off here — only positive `produces` entries count, the same as
  // for a building that pays maintenance. The rent reaches the policies through `value.ts`'s
  // `permanentDelta`, which runs the real `applyUpkeep`.
  const producerCredit: EnablerModel['producerCredit'] = {};
  if (producers) {
    const unitValue: Partial<Record<keyof Resources, number>> = {};
    for (const k of Object.keys(emptyResources()) as (keyof Resources)[]) {
      const v = Math.max(valued[k] ?? 0, weight[k] ?? 0);
      if (v > 0) unitValue[k] = v;
    }
    for (const card of Object.values(CARDS)) {
      if (!ids.has(card.id) || !isDurableProducer(card) || !card.produces) continue;
      const produces = realizedGain(G, card.produces.resources);
      let perRound = 0;
      for (const [k, v] of Object.entries(unitValue) as [keyof Resources, number][]) {
        perRound += positive(produces?.[k]) * v;
      }
      // A one-shot placement grant (Hut's population, on `effect`) is not durable income and earns nothing
      // here; it lands once in the resource pool, where the strategic weights already credit it.
      if (perRound > 0) producerCredit[card.id] = perRound * PRODUCER_TAIL_HORIZON;
    }
  }

  const model: EnablerModel = { weight, cap, producerCredit };
  if (handSize && canGrowCulture(G, ids)) model.handsizePerLevel = HANDSIZE_LEVEL_CREDIT;
  if (populationThroughput > 0) model.foodPerWorker = bestFoodPerWorker(G);
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
  // Net population's credit against the food its *growth* commits to. The capacity weight prices a worker's
  // goal throughput and nothing else, so without this a person is credited for what they make and never
  // charged for what they eat every round thereafter — and `foodPerNextPop` rises with the pool, so the gap
  // widens exactly where growth stops paying.
  //
  // Charged **in worker-rounds, not score**: the n-th person eats `foodPerNextPop(n)`, which takes
  // `foodPerNextPop(n) / foodPerWorker` of a worker to source, so that fraction of their own credit is
  // spent feeding themselves. Both sides are then the same quantity — a worker's goal throughput — so the
  // objective's target size cancels out of the ratio and the net can't turn on how large a number the
  // mission happens to ask for. A deck with no per-worker food at all can feed nobody, so the credit goes.
  //
  // Counted only past the board's starting population, whose mouths are a sunk fact no line can undo, and
  // clamped **per person** at their own credit — so growth saturates at the point it stops paying for
  // itself (the derived counterpart of `CAPACITY_CAP`) rather than turning the potential negative.
  if (model.foodPerWorker !== undefined) {
    const pop = Math.max(0, G.resources.population);
    const credited = Math.min(pop, model.cap.population ?? pop);
    let forgone = 0;
    for (let n = G.startResources.population + 1; n <= credited; n++) {
      const need = foodPerNextPop(n);
      if (need <= 0) continue;
      forgone += model.foodPerWorker > 0 ? Math.min(1, need / model.foodPerWorker) : 1;
    }
    s -= (model.weight.population ?? 0) * forgone;
  }
  let durable = 0;
  // The whole board is walked rather than the durable zones: only an `isDurableProducer` id was ever
  // keyed into `producerCredit`, so a Work box standing this turn looks up nothing.
  for (const placed of placedCards(G)) durable += model.producerCredit[placed.cardId] ?? 0;
  s += Math.min(durable, PRODUCER_CREDIT_CAP);
  return s;
}
