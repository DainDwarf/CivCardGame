import { effectiveHandSize } from './culture';
import { shuffleFromState } from './rng';
import type { GameState } from './state';

/**
 * Draw one card. When the deck is empty, the discard pile reshuffles into the new
 * deck, deterministically from the run's RNG stream (`G.rngState`, advanced here so
 * the next reshuffle continues the same stream). Mutates `G` in place (the engine
 * clones it before each move).
 */
export function drawCard(G: GameState): void {
  if (G.deck.length === 0) {
    const { result, rngState } = shuffleFromState(G.discard, G.rngState);
    G.deck = result;
    G.discard = [];
    G.rngState = rngState;
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
