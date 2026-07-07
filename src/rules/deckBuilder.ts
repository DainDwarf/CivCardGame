import { CARDS } from '../content/cards';
import type { DeckDef, DeckSeed } from '../content/decks';
import { findInstance, instancesOf, type OwnedCards } from './collection';

/**
 * Deck *construction* — building/editing the card lists a player saves in the meta
 * loop. Distinct from `deck.ts`, which owns the *in-run* draw pile
 * (`GameState.deck`/`drawCard`).
 */

/** The committed cap on how many decks a player may own. The number is provisional
 *  (balance-tunable), but the *existence* of the limit is a core rule — enforced at the
 *  deck writer (`App.tsx`'s `saveDeck`), with the meta UI's disabled "+ New Deck" button
 *  as its reflection. */
export const MAX_DECKS = 6;

/** Appends one copy of `cardId` — picks the *lowest-index* owned instance of that cardId not
 *  already in `deck` (`instancesOf` is granted order, so this is the first Farm added → 1/2,
 *  second → 2/2, etc. — Step 7.4's deterministic assignment). Copies are still fungible; a
 *  future card sticker (Step 7.5) is what makes one instance worth distinguishing from
 *  another. `'invalid'` if `cardId` isn't in the `CARDS` catalogue (a data-coherence check,
 *  not a Phase 4 balance rule; see docs/DESIGN.md's deferred "deck construction
 *  constraints"), or if every owned copy is already in the deck (Phase 3 Step 2's copy cap —
 *  an absent/zero entry, i.e. not yet unlocked, rejects the same as any other invalid add,
 *  see `DeckEditor.tsx`'s picker filter). Mirrors the `'invalid'` signal `src/run/moves.ts`
 *  uses for rejected input. Does not mutate `deck`. */
export function addCard(deck: string[], cardId: string, collection: OwnedCards): string[] | 'invalid' {
  if (!(cardId in CARDS)) return 'invalid';
  // Event and threat cards are mission-injected only — never player-editable into a deck.
  if (CARDS[cardId].kind === 'event' || CARDS[cardId].kind === 'threat') return 'invalid';
  const inDeck = new Set(deck);
  const free = instancesOf(collection, cardId).find((inst) => !inDeck.has(inst.id));
  if (!free) return 'invalid';
  return [...deck, free.id];
}

/** Removes the *highest-index* in-deck instance of `cardId` — the mirror of `addCard`'s
 *  lowest-index pick, so a deck's copies of a still-identical card stay a stable,
 *  low-index-first prefix of the owned instances as the deck is edited (Step 7.4): add,
 *  remove, add again and the same instance comes back rather than churning to a different
 *  one. `'invalid'` if the deck holds no instance of `cardId`. Does not mutate `deck`. */
export function removeCard(deck: string[], cardId: string, collection: OwnedCards): string[] | 'invalid' {
  const inDeck = instancesOf(collection, cardId).filter((inst) => deck.includes(inst.id));
  const toRemove = inDeck[inDeck.length - 1];
  if (!toRemove) return 'invalid';
  return deck.filter((instanceId) => instanceId !== toRemove.id);
}

/** Collapse a deck's instance-id list into one entry per cardId with a count, first-seen
 *  order — resolving each instance id back to its cardId via `collection`. An instance id
 *  the collection no longer recognizes (shouldn't happen; owned instances are never
 *  removed) is silently skipped rather than throwing. */
export function groupCounts(instanceIds: string[], collection: OwnedCards): { cardId: string; count: number }[] {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const instanceId of instanceIds) {
    const cardId = findInstance(collection, instanceId)?.cardId;
    if (!cardId) continue;
    if (!counts.has(cardId)) order.push(cardId);
    counts.set(cardId, (counts.get(cardId) ?? 0) + 1);
  }
  return order.map((cardId) => ({ cardId, count: counts.get(cardId)! }));
}

/** Resolve a `deckId` to its cardId list (not instance ids) from the player's own decks,
 *  via `collection` — `undefined` if the deck isn't found. An instance id the collection no
 *  longer recognizes is dropped rather than surfaced as, say, `undefined` in the list. */
export function resolveDeckCards(deckId: string, decks: DeckDef[], collection: OwnedCards): string[] | undefined {
  const deck = decks.find((d) => d.id === deckId);
  if (!deck) return undefined;
  return deck.cards
    .map((instanceId) => findInstance(collection, instanceId)?.cardId)
    .filter((cardId): cardId is string => cardId !== undefined);
}

/** Every deck currently holding `instanceId` (Phase 3 Step 7.3 — the Collection screen's
 *  per-instance view uses this so a copy's deck membership is visible *before* a future
 *  sticker, Step 7.5, singles it out). Empty if the instance is owned but sits in no deck. */
export function decksContaining(instanceId: string, decks: DeckDef[]): DeckDef[] {
  return decks.filter((d) => d.cards.includes(instanceId));
}

/** Turns content-authored `DeckSeed`s (cardIds) into real, player-store `DeckDef`s
 *  (instance ids) by matching each cardId occurrence to an owned instance off `collection`
 *  — in `instancesOf` order, consuming each instance at most once across all seeds so two
 *  seed decks never end up sharing an id meant to represent distinct copies. An occurrence
 *  that outruns the owned count (shouldn't happen; `STARTING_COLLECTION` is authored to
 *  cover `DEFAULT_DECKS` exactly, see `collection.test.ts`) is silently dropped rather than
 *  throwing. */
export function buildSeedDecks(seeds: DeckSeed[], collection: OwnedCards): DeckDef[] {
  const consumed = new Map<string, number>();
  return seeds.map((seed) => {
    const cards = seed.cards
      .map((cardId) => {
        const used = consumed.get(cardId) ?? 0;
        consumed.set(cardId, used + 1);
        return instancesOf(collection, cardId)[used]?.id;
      })
      .filter((instanceId): instanceId is string => instanceId !== undefined);
    return { id: seed.id, name: seed.name, cards };
  });
}
