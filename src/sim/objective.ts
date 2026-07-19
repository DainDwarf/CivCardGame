import { goalProgress, type GameState } from '../rules';
import { CARDS } from '../content/cards';

/**
 * A **sim-local progress gradient** toward a mission's objective — the signal the balance policies
 * *steer* by. The run engine exposes an objective only as an opaque win/lose boolean (`objectiveMet`);
 * a boolean has no gradient, so a survival-first policy has nothing to climb toward and never
 * voluntarily stockpiles what the goal actually needs. This module supplies the missing gradient.
 *
 * The signal is **derived from the objective card's own `goals`** — the average of each goal's `[0, 1]`
 * `goalProgress` (`rules/objective.ts`), which caps each term at its threshold and reaches `1` exactly
 * when every goal is met. So the threshold each objective steers toward is *the same data* the win
 * predicate reads, never a re-encoded copy: authoring a new objective's goals feeds the gradient for free,
 * and no policy branches on a mission id — they call `objectiveProgress(G)` generically.
 *
 * A goal whose progress moves only on the turn it *completes* (e.g. a mined-count threshold) leaves the
 * banking turns before it flat. That between-thresholds slope is supplied mechanically by the planner's
 * enabler shaping (`sim/enablers.ts`), derived from a card's `cost`→`produces`/`effect` — so no
 * hand-authored per-mission steering term is needed here.
 */

/**
 * Progress in roughly `[0, 1]` toward the seeded objective (`1` once met): the average of the objective
 * card's own `goals` (`goalProgress`). With no objective (or no goals) it is a constant `0` — for the
 * sandbox, whose single goal never wins, that is no steering and the greedy's `scoreState` is unchanged on
 * it. Pure over `G`.
 */
export function objectiveProgress(G: GameState): number {
  const o = G.objective;
  if (!o) return 0;
  const goals = CARDS[o.cardId].goals ?? [];
  if (goals.length === 0) return 0;
  return goals.reduce((sum, g) => sum + goalProgress(g, G), 0) / goals.length;
}

/**
 * Whether the seeded objective offers a real (non-flat) gradient to climb: true when it has at least one
 * *declarative* goal (a `measure`/`target`, not a purely bespoke `met`). A purely-bespoke goal — the
 * sandbox's always-false one — yields a flat `0` with *nothing to climb toward*, so a goal-directed
 * consumer can skip its (cloning) steering machinery entirely on such a mission, which is what keeps the
 * heuristic clone-free on the sandbox.
 */
export function hasObjectiveGradient(G: GameState): boolean {
  const o = G.objective;
  if (!o) return false;
  const goals = CARDS[o.cardId].goals;
  return !!goals && goals.some((g) => !g.met);
}
