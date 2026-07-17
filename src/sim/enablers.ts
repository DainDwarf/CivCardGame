import { CORE_KEYS, emptyResources, type GameState, type Resources } from '../rules';
import { CARDS } from '../content/cards';
import { objectiveProgress } from './objective';
import { OBJECTIVE_WEIGHT } from './value';

/**
 * A **sim-local enabler potential** — a leaf-value accelerator for the planner (`sim/plannerPolicy.ts`).
 *
 * The one-ply greedies plateau on a mission whose win needs a multi-turn *conversion chain* (bank
 * military → Conquest for +territory → bank production → Hut for +population): the resources you bank
 * along the way (military, production) don't move the objective gradient, so an intermediate banking turn
 * looks worthless and the policy sits at a local optimum. A deeper search escapes it, but only if it can
 * see *how far* it must look — cheaper the shallower it can stay. This module supplies the missing slope
 * so the search stays shallow: it credits a banked resource for the objective progress it can be
 * *converted into*, discounted per conversion hop.
 *
 * Derived **mechanically from card data**, not a per-mission table: probe which resources move
 * `objectiveProgress` (the goal-valued set — folds in the mission's `OVERRIDES` steering during
 * bring-up), then back-propagate one hop through each card's `cost → effect/produces` relation. So
 * "military matters because 5⚔️ buys a Conquest that yields +1 territory" falls out of `CARDS` alone.
 * Lives strictly in `sim/` (per [[sim-logic-stays-in-sim]]); no hook on any card/mission/rule.
 */

/** Discount per conversion hop. Strictly `< 1` is what makes the shaping *sound*: the potential a bank of
 *  R' carries (`weight·cap`) is always less than the objective jump that converting it yields, so playing
 *  the conversion strictly beats hoarding toward it — the slope guides the search without moving the
 *  optimum (bounded potential-based shaping). */
const HOP_DISCOUNT = 0.5;

const PROBE = 1;

/** A per-run enabler model, derived once from the seeded objective and reused at every leaf. */
export interface EnablerModel {
  /** Per-unit score credit for banking an enabler (core) resource. */
  weight: Partial<Record<keyof Resources, number>>;
  /** Saturate each resource's credit at one conversion's worth (the best card's cost in that resource),
   *  so the slope rewards banking *up to* a conversion then flattens — the policy plays the conversion
   *  rather than over-hoarding. */
  cap: Partial<Record<keyof Resources, number>>;
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

/**
 * Build the enabler model for a run from its seeded objective. For each goal-valued resource, scan the
 * run's own cards for one that outputs it (declarative `effect`/`produces`), and credit each core resource
 * in that card's cost the discounted conversion rate; keep the best (highest-weight) conversion per
 * resource. A resource already credited directly by the objective is not shadowed as its own enabler.
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
  return { weight, cap };
}

/** The enabler bonus for a state: each banked enabler resource, credited up to its conversion cap. Pure
 *  over `G`; added to `scoreState` for the planner's leaf value. */
export function enablerPotential(G: GameState, model: EnablerModel): number {
  let s = 0;
  for (const [k, w] of Object.entries(model.weight) as [keyof Resources, number][]) {
    const held = Math.max(0, G.resources[k]);
    s += w * Math.min(held, model.cap[k] ?? held);
  }
  return s;
}
