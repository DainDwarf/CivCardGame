import { CORE_KEYS, applyUpkeep, isOperating, projectedDelta, subtractResources, type GameState, type Resources } from '../rules';
import { objectiveProgress } from './objective';

/**
 * Band weights for `scoreState`, high tier to low. The *ordering* is the design; the magnitudes are a
 * first-pass the simulator will re-fit. What's load-bearing is the shape: each band's typical per-step
 * swing dominates the band below it, and bands 3 & 5 **saturate** — once a mid-term safety buffer is met
 * (band 3) or a pool is deep (band 5), that band goes flat and the next priority down leads. That is what
 * lets the greedy secure survival, then commit to the objective, and only hoard when nothing else helps —
 * instead of the old flat "reward every economy stat" shape, which was really a sandbox value function
 * (accumulation and objective progress sat as co-equal tiers).
 */
const W = {
  /** Band 1 — a met objective ends the run; dwarfs everything below. */
  victory: 1_000_000,
  /** Band 2 — per unit a core pool is *projected* to go negative next round (an actual collapse:
   *  `rules/collapse.ts`'s famine/ruin/bankruptcy/dark_age/revolt). Steep, so climbing out dominates. */
  collapseCliff: 500,
  /** Band 3 — mid-term safety: cover ~`bufferTurns` of *permanent* drain plus a flat `bufferFloor` per
   *  core pool, penalising only the shortfall below that (so a comfortably-buffered pool scores 0 and
   *  band 4 leads). Weighted above a single objective step but well under the band-2 cliff. */
  bufferWeight: 25,
  bufferTurns: 3,
  bufferFloor: 3,
  /** Band 4 — pull toward the mission's own `[0, 1]` objective gradient (`sim/objective.ts`). Kept under
   *  bands 2–3 so the policy never chases the win into collapse, but above raw accumulation so it commits
   *  to the goal instead of drifting at a survival equilibrium. */
  objective: 300,
  /** A staffed, operating box — the **staffing incentive**, not a resource-priority band. A box's
   *  production only lands next upkeep, so at the instant of staffing bands 2–4 are flat; band 5 sees a
   *  *core* producer via its projected sum, but a *strategic* producer (culture/territory/population —
   *  none of them in `CORE_KEYS`) is invisible to every band. This flat per-box credit is the only term
   *  that makes a strictly-improving one-ply greedy staff a Beer (culture) or Conquest (territory) box at
   *  all. A small nudge, below a single objective step. */
  operating: 2,
  /** Band 5 — accumulation, a *bounded* tiebreaker among otherwise-equal safe states: total *projected*
   *  core resources up to a cap, at a weight small enough that it can never outweigh a real objective step.
   *  No per-resource-type bias — a specific pool matters only through the objective, never intrinsically. */
  accumulateWeight: 0.2,
  accumulateCap: 50,
};

/**
 * Net per-turn change from the run's **permanent** economy only — tableau production, threat drains,
 * building maintenance, and population food — with the *transient* contributors dropped: the work zone (a
 * work box produces once, then recycles to discard) and the hand (an unplayed event's drain is
 * hand-contingent, not permanent). This is the steady-state floor band 3 buffers against, and is
 * deliberately distinct from `projectedDelta` (band 2's *actual* next turn, work + events included):
 * excluding work/events is the correct pessimistic bias for a survival guard, since work income depends on
 * future draws. Reuses the real upkeep math via a stripped clone rather than re-deriving production.
 */
function permanentDelta(G: GameState): Resources {
  const clone = structuredClone(G);
  clone.workZone = []; // drop this-turn-only work-box production before running upkeep
  applyUpkeep(clone); // tableau production − threat drains − building maintenance − population food
  return subtractResources(clone.resources, G.resources); // settleEndOfTurn skipped: no hand events
}

/**
 * Score a run state — higher is better — for the greedy policies' argmax (`sim/greedyPolicy.ts`,
 * `sim/greedy2Policy.ts`) and as the ranking backbone the heuristic and oracle beam borrow. A **pure
 * read** over `G` (via `projectedDelta`/`applyUpkeep`, which clone; it never mutates `G`), so it's safe on
 * a candidate's resulting state and unit-testable in isolation.
 *
 * Five priority bands, survival first (see `W`): (2) any core pool projected negative next round is an
 * imminent collapse, punished steeply; (3) mid-term safety — a shortfall against ~3 turns of *permanent*
 * drain (`permanentDelta`, not the transient projection) is penalised until a real cushion is banked;
 * (4) a mission-directed pull toward the objective, kept under survival so it never chases the win into
 * famine; (5) a small bounded accumulation term that only breaks ties among safe, equal states; and (1) a
 * met objective, added last, dominating everything because a won run is over.
 *
 * Two staffing-visibility terms sit alongside the bands, because a box's production only lands next upkeep:
 * a flat per-operating-box credit (the only signal for a *strategic* producer, invisible to every band),
 * and band 5 reading *projected* core (so greedy2 can value a worker *transfer*, which the flat credit
 * can't distinguish). Without them the strictly-improving greedy would never staff toward the objective.
 */
export function scoreState(G: GameState): number {
  const r = G.resources;
  let s = 0;

  // Band 2 — immediate survival. Any core pool projected negative next round is a collapse.
  const proj = projectedDelta(G).resources;
  for (const k of CORE_KEYS) {
    const next = r[k] + proj[k];
    if (next < 0) s += next * W.collapseCliff;
  }

  // Band 3 — mid-term safety. Buffer each *draining* core pool to `bufferTurns` of permanent drain plus a
  // flat floor; penalise only the shortfall, so a comfortably-buffered (or income-positive) pool scores 0
  // and band 4 leads. Population's cost lands here as food drain, so "cover upkeep + population needs"
  // falls out for free.
  const perm = permanentDelta(G);
  for (const k of CORE_KEYS) {
    const drain = Math.max(0, -perm[k]);
    const target = W.bufferFloor + W.bufferTurns * drain;
    s -= Math.max(0, target - r[k]) * W.bufferWeight;
  }

  // Band 4 — objective pull. The mission's own [0, 1] gradient (1 = won).
  s += objectiveProgress(G) * W.objective;

  // Staffing incentive — a flat credit per operating box. Band 5 (projected core) sees a *core* producer
  // being staffed, but a strategic producer (culture/territory) lands in no band until upkeep; this credit
  // is what makes the one-ply greedy staff those boxes toward a culture/territory objective.
  s += [...G.tableau, ...G.workZone].filter(isOperating).length * W.operating;

  // Band 5 — accumulation, bounded. Reads *projected* core (where the turn is heading, like band 2) so a
  // staffed core producer's not-yet-filed output and worker *transfers* between boxes are visible — which
  // is what lets greedy2 value a transfer (flat under `operating`). Only decides among safe, equal states.
  const core = CORE_KEYS.reduce((n, k) => n + Math.max(0, r[k] + proj[k]), 0);
  s += Math.min(core, W.accumulateCap) * W.accumulateWeight;

  if (G.pendingVictory) s += W.victory; // band 1, applied last so it's unconditional
  return s;
}
