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
 * The hooks are **pure reads** over `G` (never mutate it), so — unlike a threat's per-upkeep drain —
 * there is no resolver spine and no event bus involved: `checkEndIf` already runs after every move
 * and upkeep sub-step, so a threshold win ("30 science") is detected the instant it's crossed.
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

/** Whether the seeded objective's mission-specific defeat condition is met right now (e.g. a
 *  deadline). Core-resource collapse stays a universal check in `run/engine.ts`; an objective with
 *  no `failed` hook (most) never defeats on its own. */
export function objectiveFailed(G: GameState): boolean {
  const o = G.objective;
  return !!o && (CARDS[o.cardId].objective?.failed?.(G, o) ?? false);
}
