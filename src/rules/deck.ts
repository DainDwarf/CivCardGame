import { effectiveHandSize } from './culture';
import { shuffleFromState } from './rng';
import { emitEvent } from './events';
import type { DrawSource, GameState } from './state';

/**
 * Draw one card. When the deck is empty, the discard pile reshuffles into the new
 * deck, deterministically from the run's RNG stream (`G.rngState`, advanced here so
 * the next reshuffle continues the same stream). Mutates `G` in place (the engine
 * clones it before each move). `source` tags the emitted `draw` event so an on-draw
 * handler can distinguish a round-start refill from an effect-caused draw; it defaults
 * to `'effect'` (every caller *except* `drawUpTo` is an action/effect drawing).
 */
export function drawCard(G: GameState, source: DrawSource = 'effect'): void {
  if (G.deck.length === 0) {
    const { result, rngState } = shuffleFromState(G.discard, G.rngState);
    G.deck = result;
    G.discard = [];
    G.rngState = rngState;
  }
  const card = G.deck.shift();
  if (card !== undefined) {
    G.hand.push(card);
    // The single choke for every draw off the top of the deck (round-start `drawUpTo` and any
    // `effect.draw`) — emit here so on-draw observers fire once at the next boundary flush, tagged
    // with what drew it. (A card that draws a *specific* card, e.g. Foresight, bypasses this and
    // must emit its own `draw` event.)
    emitEvent(G, { type: 'draw', instanceId: card.id, cardId: card.cardId, source });
  }
}

/** Draw up to the culture-adjusted hand size, stopping early if no cards remain anywhere. */
export function drawUpTo(G: GameState): void {
  const target = effectiveHandSize(G);
  while (G.hand.length < target && G.deck.length + G.discard.length > 0) {
    drawCard(G, 'turnStart');
  }
}
