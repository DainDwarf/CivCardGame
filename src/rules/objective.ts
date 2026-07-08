import { CARDS } from '../content/cards';
import { nextInstanceId } from './population';
import type { GameState } from './state';

/**
 * The objective-card layer: a mission's win/lose condition made into a card, the positive
 * counterpart to `rules/threats.ts`. A mission declares an `objectiveCardId`; `run/setup.ts` seeds
 * that card into `GameState.objective`, and `run/engine.ts`'s `checkEndIf` polls the card's own
 * `objective` hook through the two readers here — so the card owns its logic like every other card,
 * and the engine never reads a mission predicate directly.
 *
 * The hooks are **pure reads** over `G` (never mutate it). `checkEndIf` currently *polls* them after
 * every move and upkeep sub-step, so a threshold win ("30 science") is detected the instant it's
 * crossed. They are slated to move onto the event bus — the `endTurn` broadcast (`rules/events.ts`)
 * is the enabling piece — rather than staying poll-only.
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
  return !!o && (CARDS[o.cardId].objective?.met(G, o) ?? false);
}

/** Whether the seeded objective's mission-specific defeat condition is met right now — a pure poll
 *  today, slated to move onto the bus like `objectiveMet`. Only for a defeat that's a pure *read* of
 *  `G`; a defeat a card must *drive* (a deadline passing, a counter escalating) lives on a threat
 *  owning `G.pendingDefeat` instead (e.g. Stagnation), read by `checkEndIf`. Core-resource collapse
 *  stays a universal check in `run/engine.ts`; an objective with no `failed` hook (all of them today)
 *  never defeats on its own. */
export function objectiveFailed(G: GameState): boolean {
  const o = G.objective;
  return !!o && (CARDS[o.cardId].objective?.failed?.(G, o) ?? false);
}
