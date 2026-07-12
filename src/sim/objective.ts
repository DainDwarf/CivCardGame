import { cultureForLevel, objectiveMet, type GameState } from '../rules';
import { RAIDER_WAVES } from '../content/cards';

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
  // "Growing Numbers": stand up a Hut, a Farm, and a Toolmaker at once — three distinct buildings, each
  // needing a free territory *slot*, and the Tribe board starts at territory 0. So territory (grown via
  // Conquest) is a genuine prerequisite for all three, not a detour. The building term counts *distinct*
  // required types present (so a duplicate Farm earns nothing, pushing the policy toward the type it still
  // lacks); blending territory in as a sub-goal is what steers a one-ply policy to play Conquest at all (a
  // flat building-count gradient never rewards it, since Conquest raises no building on its own turn). Both
  // terms cap at 3 and average ⇒ 1 exactly at the win (three buildings occupy three slots, so territory ≥ 3).
  growing_numbers_goal: (G) => {
    const built = ['hut', 'farm', 'toolmaker'].filter((id) => G.tableau.some((b) => b.cardId === id)).length;
    return (built + Math.min(G.territory, 3)) / 6;
  },
  // "Rites & Rituals": reach 🎭 culture *level 2*. Culture accumulates and is never spent, and the win
  // is purely a raw-culture threshold — level 2 sits at `cultureForLevel(2)` (30) culture — so the
  // gradient tracks *raw culture toward that threshold*, capped and normalized ⇒ 1 exactly at the win.
  // Deliberately not the *fractional level* (`level + within-band ratio`): because the bands double
  // (10, then 20), fractional level is non-uniform — it credits the first band twice as steeply as the
  // wide second one, so a one-ply policy under-values the band-1 climb and can stall mid-band. Raw
  // points make every culture point worth an equal slice of the goal, a uniform pull straight to it.
  rites_rituals_goal: (G) => {
    const target = cultureForLevel(2);
    return Math.min(G.culture, target) / target;
  },
  // "Restless People": reach 🎭 culture *level 2* to placate the unrest — the identical culture-level
  // win as "Rites & Rituals", so the same raw-culture-toward-threshold gradient (its own key because the
  // objective card id differs). The threat's 🪙 drain is a survival cost `scoreState` handles; the goal
  // gradient only needs to pull culture upward.
  restless_people_goal: (G) => {
    const target = cultureForLevel(2);
    return Math.min(G.culture, target) / target;
  },
  // "Raiders at the Border": defeat every raider wave by *playing* it (paying 3⚔️ banishes it to
  // `removed`). The gradient is just the normalized count of raiders defused — each play is an
  // unconditional +1/N capability bump, which is what pulls the greedy through the military cost (the
  // same way the growing_numbers territory sub-goal pulls it into Conquest). Deliberately NOT blended
  // with a "military banked" readiness term: military is *consumed* by the play, so such a term would
  // net to ~zero on the exact action we want (play a raider: +1 defused, −3⚔️) and the strictly-
  // improving greedy would refuse to play it — stalling forever on a deadline-free mission.
  raiders_at_border_goal: (G) =>
    Math.min(G.removed.filter((c) => c.cardId === 'raider').length, RAIDER_WAVES) / RAIDER_WAVES,
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
