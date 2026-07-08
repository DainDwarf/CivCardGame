import { CARDS } from '../content/cards';
import { nextInstanceId } from './population';
import type { GameState } from './state';

/**
 * The objective-card layer: a mission's win condition made into a card, the positive counterpart to
 * `rules/threats.ts`. A mission declares an `objectiveCardId`; `run/setup.ts` seeds that card into
 * `GameState.objective`, and the card owns its win *logic* through the pure-read `objective` predicate
 * — so the card owns its logic like every other card, and the engine never reads a mission predicate.
 *
 * That predicate is a **pure read** over `G` (never mutates it). It's now **bus-driven**, not polled:
 * `evaluateObjective` re-derives it into `G.pendingVictory` at every `flushEvents` boundary
 * (`rules/events.ts`), and `run/engine.ts`'s `checkEndIf` reads that flag — the win counterpart to a
 * threat writing `G.pendingDefeat`. A threshold win ("30 science") is thus caught at the same flush
 * where the resource crosses, exactly where the old per-move poll caught it. A defeat a card must
 * *drive* (a deadline passing, a counter escalating) lives on a threat owning `G.pendingDefeat`
 * instead (e.g. Stagnation); core-resource collapse stays a universal check in `run/engine.ts`.
 */

/** Seed the mission's objective card into `G.objective`, bare (no counters yet). Called once by
 *  `run/setup.ts`; shares the run-wide instance-id space via `nextInstanceId`. */
export function seedObjective(G: GameState, cardId: string): void {
  G.objective = { id: nextInstanceId(G), cardId };
}

/** Whether the seeded objective's win condition is met right now. False when no objective is seeded
 *  (a bare `blankState` or a mission without one) or the card exposes no `objective` hook. */
export function objectiveMet(G: GameState): boolean {
  const o = G.objective;
  return !!o && (CARDS[o.cardId].objective?.(G, o) ?? false);
}

/** Re-derive the win flag from the objective card's own `objective` predicate — the bus's counterpart to a
 *  threat writing `G.pendingDefeat`. Called at every `flushEvents` boundary (`rules/events.ts`), so
 *  `G.pendingVictory` is fresh before every `checkEndIf`. Set-OR-CLEAR every call (never sticky): a
 *  verdict can flip back to false within one flush (barbarian_tide's 4th wave files to `removed` AND
 *  drains Military in one resolve). Victory-only — never touches `G.pendingDefeat`, which threats own. */
export function evaluateObjective(G: GameState): void {
  G.pendingVictory = objectiveMet(G);
}
