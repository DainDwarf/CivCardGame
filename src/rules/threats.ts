import { nextInstanceId } from './population';
import type { GameState } from './state';

/** Seed a new threat onto the board, bare (no counters yet). Mission `setup` is the only caller —
 *  a threat is never played by the player. A seeded threat ticks every round via the `endTurn`
 *  broadcast (`rules/events.ts`'s `dispatchEvent` → `rules/effects.ts`'s `resolveEndTurn`, which runs
 *  the threat's own `resolveCard` drain), so there's no per-tick function here — the card owns its
 *  behaviour and the bus drives it. */
export function addThreat(G: GameState, cardId: string): void {
  G.threats.push({ id: nextInstanceId(G), cardId });
}
