import { CARDS, type ObjectiveGoal } from '../content/cards';
import { nextInstanceId } from './population';
import type { GameState } from './state';

/**
 * The objective-card layer: a mission's win condition made into a card, the positive counterpart to
 * `rules/threats.ts`. A mission declares an `objectiveCardId`; `run/setup.ts` seeds that card into
 * `GameState.objective`, and the card owns its win *logic* through its declarative `goals` — so the
 * card owns its logic like every other card, and the engine never reads a mission predicate. A `goals`
 * spec is the single source the boolean predicate here, the live readout (`goalsReadout`), and the
 * sim's steering gradient (`sim/objective.ts`) all derive from, so no two can encode a threshold apart.
 *
 * The read is **pure** over `G` (never mutates it). It's **bus-driven**, not polled: `evaluateObjective`
 * re-derives it into `G.pendingVictory` at every `flushEvents` boundary (`rules/events.ts`), and
 * `run/engine.ts`'s `checkEndIf` reads that flag — the win counterpart to a threat's own `defeat`
 * predicate feeding `G.pendingDefeat` (`rules/threats.ts`'s `evaluateDefeat`, the same
 * re-derive-at-every-flush shape). A threshold win ("30 science") is thus caught at the same flush
 * where the resource crosses, exactly where the old per-move poll caught it. A defeat a card must
 * *drive* (a deadline passing, a counter escalating) lives on a threat's `defeat` hook instead
 * (e.g. `sands_of_time`); core-resource collapse stays a universal check in `run/engine.ts`.
 */

/** Seed the mission's objective card into `G.objective`, bare (no counters yet). Called once by
 *  `run/setup.ts`; shares the run-wide instance-id space via `nextInstanceId`. */
export function seedObjective(G: GameState, cardId: string): void {
  G.objective = { id: nextInstanceId(G), cardId };
}

/** Whether one goal is satisfied: its bespoke `met` if present, else the declarative `measure >= target`. */
export function goalMet(goal: ObjectiveGoal, G: GameState): boolean {
  return goal.met ? goal.met(G) : goal.measure(G) >= goal.target;
}

/** A goal's progress in `[0, 1]` — `1` once satisfied, else its capped measure ratio. The UI readout
 *  and the sim gradient both fold over this, so they can never disagree on a goal's math. A
 *  non-positive `target` (a "stay ≥ 0" style constraint) has no meaningful ratio, so an unmet one
 *  reads a flat `0` rather than dividing by zero. */
export function goalProgress(goal: ObjectiveGoal, G: GameState): number {
  if (goalMet(goal, G)) return 1;
  return goal.target > 0 ? Math.min(goal.measure(G), goal.target) / goal.target : 0;
}

/** The default live readout derived from an objective's goals — `icon capped/target` per goal. A card
 *  wanting a richer readout (a level bar, extra words) overrides it via `display.dynamicText`. */
export function goalsReadout(goals: readonly ObjectiveGoal[], G: GameState): string {
  return goals.map((g) => `${g.icon} ${Math.min(g.measure(G), g.target)}/${g.target}`).join(' · ');
}

/** Whether the seeded objective's win condition is met right now — *every* goal satisfied. False when
 *  no objective is seeded (a bare `blankState` or a mission without one) or the card declares no goals
 *  (an empty `every` would be vacuously true — a mission with no goals never wins, e.g. no seed). */
export function objectiveMet(G: GameState): boolean {
  const o = G.objective;
  if (!o) return false;
  const goals = CARDS[o.cardId].goals;
  return !!goals && goals.length > 0 && goals.every((g) => goalMet(g, G));
}

/** Re-derive the win flag from the objective card's own `objective` predicate — the bus's counterpart
 *  to `rules/threats.ts`'s `evaluateDefeat`. Called at every `flushEvents` boundary
 *  (`rules/events.ts`), so `G.pendingVictory` is fresh before every `checkEndIf`. Set-OR-CLEAR every
 *  call (never sticky): a verdict can flip back to false within one flush (e.g. an event that
 *  files to `removed` AND drains a resource in one resolve). Victory-only — never touches
 *  `G.pendingDefeat`, which threats own. */
export function evaluateObjective(G: GameState): void {
  G.pendingVictory = objectiveMet(G);
}
