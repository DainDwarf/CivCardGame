import { objectiveMet, type GameState } from '../rules';

/**
 * A **sim-local progress gradient** toward a mission's objective — the signal the balance policies
 * *steer* by. The run engine exposes an objective only as an opaque win/lose boolean (`objectiveMet`);
 * a boolean has no gradient, so a survival-first policy has nothing to climb toward and never
 * voluntarily stockpiles what the goal actually needs. This module supplies the missing gradient.
 *
 * It lives **strictly in `sim/`** on purpose: how the simulator *plays* is not a game rule, so no game
 * file (a `CardDef`, `rules/objective.ts`, a `MissionDef`) carries a simulator hook. Yet the policies
 * stay **mission-agnostic** — they call `objectiveProgress(G)` generically and never branch on a
 * mission id. The knowledge of *what each objective wants* is centralized here in one registry keyed by
 * the objective card id (which the sim reads off `G.objective`); a new mission adds one entry to
 * `PROGRESS`, touching neither the policies nor any game file.
 *
 * Contract for an entry: a **pure read** over `G` returning roughly `[0, 1]`, monotonic in closeness to
 * the goal and reaching `1` exactly when the objective is met. A **capped** goal (e.g. "10🔨 AND 10⚔️")
 * should cap each term so hoarding *past* a threshold earns nothing — that is what makes a policy
 * convert surplus toward the part of the goal it still lacks instead of piling one resource ever higher.
 *
 * Exported for the coherence test (`objective.test.ts`) that pins every key to a real objective card —
 * a mistyped/renamed key would silently fall back to the flat gradient and drift a whole mission,
 * surfacing only as a `simulateRun` throw when that mission is swept.
 */
export const PROGRESS: Record<string, (G: GameState) => number> = {
  // "The First Settlement": stockpile 10🔨 production AND 10⚔️ military at once. Each term capped at its
  // 10-threshold and averaged ⇒ 1 exactly at the win, and a policy that already has 10 production earns
  // no more by hoarding it — pushing it to spend the surplus on the military it still lacks.
  first_settlement_goal: (G) =>
    (Math.min(G.resources.production, 10) + Math.min(G.resources.military, 10)) / 20,
};

/**
 * Progress in roughly `[0, 1]` toward the seeded objective (`1` once met). Uses the registry entry for
 * the seeded objective card if one exists; otherwise falls back to the binary `objectiveMet ? 1 : 0`,
 * so an objective with no authored gradient still yields a coherent signal — for the sandbox, whose
 * objective never wins, that is a constant `0` (no steering, and the greedy's `scoreState` is unchanged
 * on it). Pure over `G`.
 */
export function objectiveProgress(G: GameState): number {
  const o = G.objective;
  const fn = o && PROGRESS[o.cardId];
  return fn ? fn(G) : objectiveMet(G) ? 1 : 0;
}

/**
 * Whether the seeded objective has an authored (non-binary) progress gradient — i.e. a `PROGRESS` entry.
 * When false, `objectiveProgress` is the flat `objectiveMet ? 1 : 0`, which stays 0 right up to the win
 * and so offers *nothing to climb toward* — one-ply win detection already handles that last step. A
 * goal-directed consumer can therefore skip its (cloning) steering machinery entirely on such a mission,
 * which is what keeps the heuristic clone-free on a gradient-less mission like the sandbox.
 */
export function hasObjectiveGradient(G: GameState): boolean {
  const o = G.objective;
  return !!(o && PROGRESS[o.cardId]);
}
