import { goalProgress, type GameState } from '../rules';
import { CARDS, GROWING_NUMBERS_BUILDINGS } from '../content/cards';

/**
 * A **sim-local progress gradient** toward a mission's objective — the signal the balance policies
 * *steer* by. The run engine exposes an objective only as an opaque win/lose boolean (`objectiveMet`);
 * a boolean has no gradient, so a survival-first policy has nothing to climb toward and never
 * voluntarily stockpiles what the goal actually needs. This module supplies the missing gradient.
 *
 * The base signal is **derived from the objective card's own `goals`** — the average of each goal's
 * `[0, 1]` `goalProgress` (`rules/objective.ts`), which caps each term at its threshold and reaches `1`
 * exactly when every goal is met. So the threshold each objective steers toward is *the same data* the
 * win predicate reads, never a re-encoded copy: authoring a new objective's goals feeds the gradient for
 * free, and no policy branches on a mission id — they call `objectiveProgress(G)` generically.
 *
 * `OVERRIDES` is the narrow seam for *sim-only steering that is not part of the win condition* — a term
 * the policies need to climb but the game predicate rightly ignores. It lives **strictly in `sim/`**: how
 * the simulator *plays* is not a game rule, so no game file carries a simulator hook. Only the objectives
 * that need such a term appear here; every other one rides the generic goals average.
 *
 * Exported for the coherence test (`objective.test.ts`) that pins every key to a real objective card —
 * a mistyped/renamed key would silently fall back to the generic gradient and drop the steering term.
 */
export const OVERRIDES: Record<string, (G: GameState) => number> = {
  // "Growing Numbers": stand up a Hut and a Farm — each needs a free territory *slot*, and the Tribe
  // board starts at territory 0. Territory (grown via Conquest) is thus a genuine prerequisite the win
  // predicate never mentions. Blending it in as a sub-goal is what steers a one-ply policy to play
  // Conquest at all — a flat building-count gradient never rewards it, since Conquest raises no building
  // on its own turn. Both terms cap at 2 and average ⇒ 1 exactly at the win (two buildings occupy two
  // slots, so territory ≥ 2).
  growing_numbers_goal: (G) => {
    const built = GROWING_NUMBERS_BUILDINGS.filter((id) => G.tableau.some((b) => b.cardId === id)).length;
    return (built + Math.min(G.resources.territory, 2)) / 4;
  },
};

/**
 * Progress in roughly `[0, 1]` toward the seeded objective (`1` once met). A `sim/` steering `OVERRIDE`
 * wins if present; otherwise the average of the objective card's own `goals` (`goalProgress`). With no
 * objective (or no goals) it is a constant `0` — for the sandbox, whose single goal never wins, that is
 * no steering and the greedy's `scoreState` is unchanged on it. Pure over `G`.
 */
export function objectiveProgress(G: GameState): number {
  const o = G.objective;
  if (!o) return 0;
  const override = OVERRIDES[o.cardId];
  if (override) return override(G);
  const goals = CARDS[o.cardId].goals ?? [];
  if (goals.length === 0) return 0;
  return goals.reduce((sum, g) => sum + goalProgress(g, G), 0) / goals.length;
}

/**
 * Whether the seeded objective offers a real (non-flat) gradient to climb. True when it has a `sim/`
 * override or at least one *declarative* goal (a `measure`/`target`, not a purely bespoke `met`). A
 * purely-bespoke goal — the sandbox's always-false one — yields a flat `0` with *nothing to climb
 * toward*, so a goal-directed consumer can skip its (cloning) steering machinery entirely on such a
 * mission, which is what keeps the heuristic clone-free on the sandbox.
 */
export function hasObjectiveGradient(G: GameState): boolean {
  const o = G.objective;
  if (!o) return false;
  if (OVERRIDES[o.cardId]) return true;
  const goals = CARDS[o.cardId].goals;
  return !!goals && goals.some((g) => !g.met);
}
