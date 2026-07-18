import { effectiveHandSize } from './culture';
import { shuffleFromState } from './rng';
import { emitEvent } from './events';
import { contentKey, instancesFromCardIds, type CardInstance, type DrawSource, type GameState } from './state';
import { nextInstanceId } from './population';
import type { EffectContext } from './effects';

/**
 * Fold the discard pile back into the draw pile, deterministically from the run's RNG stream
 * (`G.rngState`, advanced here so the next reshuffle continues the same stream) — shared by every
 * spot that draws off an empty deck (`drawCard`), so the shuffle-in-progress logic
 * lives once. Bumps `reshuffleCount`, a pure UI cue (`components/Board.tsx` diffs it to fire the
 * deck's shuffle animation) — no rule reads it.
 *
 * **Order-independent by design.** The discard is **canonicalized by content** (`contentKey`,
 * id-independent) *before* the Fisher–Yates, so the resulting deck is a pure function of
 * `(discard multiset, rngState)` — a discard pile is unordered in the player's mental model, and a
 * uniform shuffle is uniform regardless of input order, so this is player-imperceptible. It's what
 * lets the run treat the discard as unordered (nothing reads it positionally — `recoverFromDiscard`
 * is by-id) and the simulator key the discard as a multiset (`sim/oracleKey.ts`). See the
 * order-independence convention in DESIGN.md.
 */
function reshuffleIntoDeck(G: GameState): void {
  // Plain code-unit compare (not `localeCompare`) so the ordering is locale-independent — determinism
  // must hold identically across machines/CI, not just within one locale.
  const canonical = [...G.discard].sort((a, b) => {
    const ka = contentKey(a);
    const kb = contentKey(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  const { result, rngState } = shuffleFromState(canonical, G.rngState);
  G.deck = result;
  G.discard = [];
  G.rngState = rngState;
  G.reshuffleCount += 1;
  // Announce the recycle so a card can react to the draw pile folding over (e.g. an unrest threat
  // that drains on every reshuffle). A broadcast (no subject); emitted here mid-draw and drained at
  // the next boundary flush like any leaf-emitted event — never dispatched from this mutation site.
  emitEvent(G, { type: 'reshuffle' });
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
    // card-effect draw) — emit here so on-draw observers fire once at the next boundary flush, tagged
    // with what drew it. (A card that draws a *specific* card bypasses this and
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

/**
 * Would the next round-start refill (`drawUpTo`) force a reshuffle? True iff filling the hand needs
 * more draws than the deck holds *and* the discard has cards to fold back in — the exact condition
 * `drawCard` reshuffles under, kept here beside `reshuffleIntoDeck` so a caller that needs to know a
 * reshuffle is imminent *without* drawing (the `projectedDelta` preview, which fires the `reshuffle`
 * broadcast synthetically to show its cost while suppressing the draw-contingent `on.draw` effects it
 * mustn't leak) can't drift from the real trigger. At most one reshuffle happens per refill.
 */
export function willReshuffleOnRefill(G: GameState): boolean {
  const draws = effectiveHandSize(G) - G.hand.length;
  return draws > G.deck.length && G.discard.length > 0;
}

// --- Card-facing deck primitives (the resolver-spine "two-way street") ---
// A card that manipulates the deck/hand structurally (peeking, drawing a chosen card, shuffling cards
// back, recovering one from the discard) resolves through these instead of reaching into
// `G.deck`/`G.hand`/`G.discard`/`G.rngState` itself — the
// same discipline that keeps output behind `gainResources`. They take the `EffectContext` so they read
// as one card-facing family (like `gainResources(ctx, …)`); each only touches `ctx.G`.

/**
 * Look at the top `min(n, deck.length)` cards of the draw pile for a card that peeks — a **pure
 * read** that mutates nothing: the cards stay on the deck in place, so peeking never reorders the
 * draw, reshuffles the discard, or advances the RNG. A short deck simply yields fewer than `n` (a
 * peek can't foresee past the next shuffle). Emits **no** `draw` event (a peek isn't a draw). Bumps
 * `revealCount` when it actually reveals something, so `GameContext`'s undo reducer treats the move
 * as a boundary and clears the stack (a deck-diff can't see a read that leaves the deck untouched) —
 * the revealed knowledge can't be undone away for a cost refund.
 *
 * The returned instances are **live references into `G.deck`** (a slice, not detached copies): fine to
 * display, but a card that then draws one must pull it out by id (`deck.filter(c => c.id !== …)`),
 * never assume the returned objects are its own to mutate or splice.
 */
export function peekTop(ctx: EffectContext, n: number): CardInstance[] {
  const { G } = ctx;
  const out = G.deck.slice(0, n); // slice() clamps to deck length; the deck itself is untouched
  if (out.length > 0) G.revealCount += 1;
  return out;
}

/**
 * Draw a *specific* card instance into the hand — the verb `drawCard` (top-of-deck only) can't
 * express, used by a card that draws a chosen card. Emits the `draw` event so on-draw
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

/**
 * Return a specific instance from the discard pile to the hand — the discard→hand mover a recovery
 * card resolves *through* instead of splicing `G.discard` itself (the same discipline that keeps peeking
 * behind `peekTop`). Removes `card` from `G.discard` by id, then delegates to `drawInstance` (push to
 * hand + emit the `draw` event). No-op if the id isn't in the discard. Like `drawInstance`/`returnToDeck`,
 * it's a ready primitive with no shipping consumer yet — the recovery card that pairs with it lands later.
 *
 * Reusing `drawInstance` means recovery emits a `draw` event (`source: 'effect'`) — deliberate, so
 * on-draw observers treat a recovered card like any effect-drawn one. Harmless today (no on-draw
 * subscribers in the current set); a future card that must tell recovery apart can branch on a new
 * `DrawSource`.
 */
export function recoverFromDiscard(ctx: EffectContext, card: CardInstance): void {
  const idx = ctx.G.discard.findIndex((c) => c.id === card.id);
  if (idx === -1) return;
  ctx.G.discard.splice(idx, 1);
  drawInstance(ctx, card);
}

/**
 * Mint `count` fresh copies of `cardId` and shuffle them into the draw pile — the only primitive that
 * introduces *new* card instances mid-run (`returnToDeck` and friends only move existing ones), for a
 * card that breeds cards (an escalating threat spawning its own hazards). Ids come from
 * `nextInstanceId` so the mints stay unique across every zone; the shuffle-in reuses `returnToDeck`,
 * so it advances `G.rngState` deterministically and emits nothing — safe to call from an `on.reshuffle`
 * handler mid-dispatch without opening an event cascade. A non-positive `count` is a no-op.
 */
export function spawnIntoDeck(ctx: EffectContext, cardId: string, count: number): void {
  if (count <= 0) return;
  const minted = instancesFromCardIds(Array.from({ length: count }, () => cardId), nextInstanceId(ctx.G));
  returnToDeck(ctx, minted);
}
