import { CORE_KEYS, cultureLevel, emptyResources, type GameState, type Resources } from '../rules';
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
 *   goal-throughput it *unlocks* over a horizon (build/staff/gate a goal-producer), saturated at a cap.
 *
 * Derived **mechanically from card data**, not a per-mission table: probe which resources move
 * `objectiveProgress` (the goal-valued set), then read each card's `cost → effect/produces` (consumables)
 * or `effect/produces` under its capacity role (strategic). So "production matters because 4🔨 builds a
 * Hut that yields +1 population" falls out of `CARDS` alone. Lives strictly in `sim/` (per
 * [[sim-logic-stays-in-sim]]); no hook on any card/mission/rule.
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

/** Per-culture-level credit for the bigger hand each level draws (`rules/culture.ts`'s `effectiveHandSize`
 *  adds one card per level). Unlike the other capacity credits this is *not* objective-directed — more
 *  cards helps every goal diffusely, not one producer — so it can't be derived as a conversion and rides
 *  no skip: it is credited even when culture is itself the win. A modest fraction of a goal step, tuned
 *  against win-rate, capped so a runaway culture engine can't dominate the leaf value. */
const HANDSIZE_LEVEL_CREDIT = 0.03 * OBJECTIVE_WEIGHT;
const HANDSIZE_LEVEL_CAP = 6;

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
}

/** Which resources move the objective gradient, and by how much per unit — probed from a zeroed-resource
 *  clone so the objective's caps (e.g. `min(population, 6)`) don't hide the slope. Non-resource goals
 *  (buildings/removed cards) don't register here; the enabler layer only shapes resource-threshold wins. */
function goalValuedResources(G: GameState): Partial<Record<keyof Resources, number>> {
  const probe = structuredClone(G);
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
 * Build the enabler model for a run from its seeded objective, in two passes:
 *  - **Consumables** — for each goal-valued resource, scan the run's cards for one that outputs it
 *    (`effect`/`produces`) and credit each core resource in that card's cost the discounted conversion
 *    rate; keep the best per resource.
 *  - **Strategic capacity** — territory / population / culture each credited for the goal-throughput a
 *    slot / worker / gated level unlocks over `CAPACITY_HORIZON`, plus culture's hand-size nudge.
 * A resource already credited directly by the objective is not shadowed as its own enabler.
 */
export function deriveEnablers(G: GameState): EnablerModel {
  const goalValued = goalValuedResources(G);
  const ids = runCardIds(G);
  const weight: EnablerModel['weight'] = {};
  const cap: EnablerModel['cap'] = {};

  for (const card of Object.values(CARDS)) {
    if (!ids.has(card.id)) continue;
    for (const [gk, marginal] of Object.entries(goalValued) as [keyof Resources, number][]) {
      const output = positive(card.effect?.resources?.[gk]) + positive(card.produces?.resources?.[gk]);
      if (output <= 0) continue;
      for (const ck of CORE_KEYS) {
        const costAmt = card.cost[ck] ?? 0;
        if (costAmt <= 0 || goalValued[ck] !== undefined) continue;
        const w = HOP_DISCOUNT * (output / costAmt) * (marginal * OBJECTIVE_WEIGHT);
        if (w > (weight[ck] ?? 0)) {
          weight[ck] = w;
          cap[ck] = costAmt;
        }
      }
    }
  }

  // Strategic capacity enablers — territory, population, culture. None is *spent* on a card: each is a
  // durable capacity that unlocks a goal-producer's output every round, credited over `CAPACITY_HORIZON`
  // (not the consumables' one-shot `HOP_DISCOUNT`) and saturated at `CAPACITY_CAP`. Each is skipped when
  // it is itself goal-valued — the objective scores it directly, the same reason the consumable loop skips
  // a goal-valued cost resource. Complementarity (a staffed building needs both a slot and a worker) needs
  // no joint model: crediting the *total* pool never falls when one is consumed (strategic pools aren't
  // spent), so the two credits can't deter building what they jointly enable — the payoff materializes only
  // once both pools are grown, and the search grows both.

  // Territory is the slot for any structure, so it reads the best goal output over *all* the deck's
  // structures — a self-sufficient grant (Hut/House, on `effect`) or a staffed producer (Farm/Forge, on
  // `produces`) alike.
  if (goalValued.territory === undefined) {
    const best = bestGoalThroughput(ids, goalValued, isStructure, true);
    if (best > 0) {
      weight.territory = best * CAPACITY_HORIZON;
      cap.territory = CAPACITY_CAP;
    }
  }

  // Population is the worker for a per-worker producer (`workers >= 1`); the staffing yields the output, so
  // it reads `produces` only, not the card's one-shot play `effect`.
  if (goalValued.population === undefined) {
    const best = bestGoalThroughput(ids, goalValued, (c) => (c.workers ?? 0) >= 1, false);
    if (best > 0) {
      weight.population = best * CAPACITY_HORIZON;
      cap.population = CAPACITY_CAP;
    }
  }

  // Culture's gate-unlock: reaching a level ungates a producer (a `cultureLevelReq` card), so raw culture
  // banked toward it is credited that producer's goal output. Skipped when culture is itself the win (then
  // reaching the level *is* the objective, already scored). Its hand-size throughput is the separate,
  // no-skip nudge below.
  if (goalValued.culture === undefined) {
    const best = bestGoalThroughput(ids, goalValued, (c) => !!c.gate?.cultureLevelReq, true);
    if (best > 0) {
      weight.culture = best * CAPACITY_HORIZON;
      cap.culture = CAPACITY_CAP;
    }
  }

  const model: EnablerModel = { weight, cap };
  if (canGrowCulture(ids)) model.handsizePerLevel = HANDSIZE_LEVEL_CREDIT;
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
  return s;
}
