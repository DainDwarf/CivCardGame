import { effectiveHandSize } from './culture';
import { shuffleFromState } from './rng';
import { emitEvent } from './events';
import type { CardInstance, DrawSource, GameState } from './state';
import type { EffectContext } from './effects';

/**
 * Fold the discard pile back into the draw pile, deterministically from the run's RNG stream
 * (`G.rngState`, advanced here so the next reshuffle continues the same stream) — shared by every
 * spot that draws/peeks off an empty deck (`drawCard`, `peekTop`), so the shuffle-in-progress logic
 * lives once. Bumps `reshuffleCount`, a pure UI cue (`components/Board.tsx` diffs it to fire the
 * deck's shuffle animation) — no rule reads it.
 */
function reshuffleIntoDeck(G: GameState): void {
  const { result, rngState } = shuffleFromState(G.discard, G.rngState);
  G.deck = result;
  G.discard = [];
  G.rngState = rngState;
  G.reshuffleCount += 1;
}

/**
 * Draw one card. When the deck is empty, the discard pile reshuffles into the new
 * deck (see `reshuffleIntoDeck`). Mutates `G` in place (the engine clones it before each move).
 * `source` tags the emitted `draw` event so an on-draw handler can distinguish a round-start
 * refill from an effect-caused draw; it defaults to `'effect'` (every caller *except* `drawUpTo`
 * is an action/effect drawing).
 */
export function drawCard(G: GameState, source: DrawSource = 'effect'): void {
  if (G.deck.length === 0) reshuffleIntoDeck(G);
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

// --- Card-facing deck primitives (the resolver-spine "two-way street") ---
// A card that manipulates the deck/hand structurally (peeking, drawing a chosen card, shuffling cards
// back) resolves through these instead of reaching into `G.deck`/`G.hand`/`G.rngState` itself — the
// same discipline that keeps output behind `gainResources`. They take the `EffectContext` so they read
// as one card-facing family (like `gainResources(ctx, …)`); each only touches `ctx.G`.

/**
 * Reveal (lift off) up to `n` cards from the top of the draw pile for a card that peeks — e.g.
 * Foresight. Reshuffles the discard into the deck (the same seeded path `drawCard` uses) whenever the
 * deck empties mid-peek, so it surfaces "what the next `n` draws would show", up to what actually
 * exists across both piles — returning fewer than `n` (or `[]`) only when both run dry. The revealed
 * cards are *removed* from the deck (not merely read), so `GameContext`'s reveal-boundary fires and
 * the undo stack clears; the caller then decides each card's fate (drawn to hand via `drawInstance`,
 * or shuffled back via `returnToDeck`). Emits **no** `draw` event — a peek isn't a draw (the chosen
 * card's draw is emitted by `drawInstance`).
 */
export function peekTop(ctx: EffectContext, n: number): CardInstance[] {
  const { G } = ctx;
  const out: CardInstance[] = [];
  for (let i = 0; i < n; i++) {
    if (G.deck.length === 0) {
      if (G.discard.length === 0) break; // both piles exhausted — return what we have
      reshuffleIntoDeck(G);
    }
    const card = G.deck.shift();
    if (card !== undefined) out.push(card);
  }
  return out;
}

/**
 * Draw a *specific* card instance into the hand — the verb `drawCard` (top-of-deck only) can't
 * express, used by a card that draws a chosen card (Foresight). Emits the `draw` event so on-draw
 * observers fire, tagged `'effect'` (an effect-caused draw, never a round-start refill). The caller
 * owns removing `card` from wherever it came (e.g. `peekTop` already lifted it off the deck).
 */
export function drawInstance(ctx: EffectContext, card: CardInstance): void {
  const { G } = ctx;
  G.hand.push(card);
  emitEvent(G, { type: 'draw', instanceId: card.id, cardId: card.cardId, source: 'effect' });
}

/**
 * Shuffle `cards` back into the draw pile through the run's RNG stream (advancing `G.rngState` so the
 * next reshuffle continues it) — the counterpart to `peekTop` for revealed cards a peek didn't draw.
 * No-op on an empty `cards`, so returning nothing never gratuitously reshuffles the remaining deck.
 */
export function returnToDeck(ctx: EffectContext, cards: CardInstance[]): void {
  if (cards.length === 0) return;
  const { G } = ctx;
  const { result, rngState } = shuffleFromState([...cards, ...G.deck], G.rngState);
  G.deck = result;
  G.rngState = rngState;
}
