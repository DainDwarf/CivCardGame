import { effectiveHandSize } from './culture';
import type { GameState } from './state';

/**
 * Draw one card. When the deck is empty, the discard pile becomes the new deck
 * (Phase 1 keeps deck order deterministic — seeded shuffling comes with the
 * meta/sim seed wiring). Mutates `G` (an immer draft at runtime, a plain object
 * in tests).
 */
export function drawCard(G: GameState): void {
  if (G.deck.length === 0) {
    G.deck = G.discard;
    G.discard = [];
  }
  const id = G.deck.shift();
  if (id !== undefined) G.hand.push(id);
}

/** Draw up to the culture-adjusted hand size, stopping early if no cards remain anywhere. */
export function drawUpTo(G: GameState): void {
  const target = effectiveHandSize(G);
  while (G.hand.length < target && G.deck.length + G.discard.length > 0) {
    drawCard(G);
  }
}
