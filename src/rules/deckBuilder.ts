import { CARDS } from '../content/cards';
import type { DeckDef } from '../content/decks';

/**
 * Deck *construction* — building/editing the card lists a player saves in the meta
 * loop. Distinct from `deck.ts`, which owns the *in-run* draw pile
 * (`GameState.deck`/`drawCard`).
 */

/** Appends one copy of `cardId`. `'invalid'` if `cardId` isn't in the `CARDS`
 *  catalogue — a data-coherence check (not a Phase 4 balance rule; see
 *  docs/DESIGN.md's deferred "deck construction constraints"). Mirrors the `'invalid'`
 *  signal `src/run/moves.ts` uses for rejected input, adapted to a function that
 *  returns a new array rather than mutating a draft. Does not mutate `deck`. */
export function addCard(deck: string[], cardId: string): string[] | 'invalid' {
  if (!(cardId in CARDS)) return 'invalid';
  return [...deck, cardId];
}

/** Removes the first occurrence of `cardId`. `'invalid'` if it isn't present. Does
 *  not mutate `deck`. */
export function removeCard(deck: string[], cardId: string): string[] | 'invalid' {
  const idx = deck.indexOf(cardId);
  if (idx === -1) return 'invalid';
  return [...deck.slice(0, idx), ...deck.slice(idx + 1)];
}

/** Collapse a flat list of card ids into one entry per card with a count, first-seen
 *  order. */
export function groupCounts(ids: string[]): { cardId: string; count: number }[] {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const id of ids) {
    if (!counts.has(id)) order.push(id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return order.map((cardId) => ({ cardId, count: counts.get(cardId)! }));
}

/** Resolve a `deckId` to its card list from the player's own decks. `undefined` if
 *  not found. */
export function resolveDeckCards(deckId: string, decks: DeckDef[]): string[] | undefined {
  return decks.find((d) => d.id === deckId)?.cards;
}

/** Deep-copies a deck list so nothing shares references with its source (e.g.
 *  `content/decks.ts`'s `DEFAULT_DECKS`). The one function both real seeding
 *  (`meta/store.ts`) and any fixture derived from `DEFAULT_DECKS` should go through,
 *  so callers exercise the same clone path production code does. */
export function cloneDecks(decks: DeckDef[]): DeckDef[] {
  return decks.map((d) => ({ ...d, cards: [...d.cards] }));
}
