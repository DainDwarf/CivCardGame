import { CARDS, compareCards, isDeckable } from '../content/cards';
import type { DeckDef, DeckSeed } from '../content/decks';
import { findInstance, hasSticker, instancesOf, unstickeredInstancesOf, type OwnedCards } from './collection';

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

/** Appends one copy of `cardId` — picks the *lowest-index* owned, **unstickered** instance of that
 *  cardId not already in `deck` (`unstickeredInstancesOf` is granted order, so the first Farm added →
 *  1/2, second → 2/2, etc.). Copies are fungible only until stickered; a stickered instance is never
 *  picked by this default order — see `addInstance` for adding one by identity. `'invalid'` if
 *  `cardId` isn't in the `CARDS` catalogue (a data-coherence check, not a deferred balance rule), or
 *  if every unstickered owned copy is already in the deck (an absent/zero entry — not yet unlocked —
 *  rejects like any other invalid add). Mirrors the `'invalid'` signal `run/moves.ts` uses. Does not
 *  mutate `deck`. */
export function addCard(deck: string[], cardId: string, collection: OwnedCards): string[] | 'invalid' {
  if (!(cardId in CARDS)) return 'invalid';
  // Event/threat/objective cards are mission-injected only — never player-editable into a deck.
  if (!isDeckable(CARDS[cardId])) return 'invalid';
  const inDeck = new Set(deck);
  const free = unstickeredInstancesOf(collection, cardId).find((inst) => !inDeck.has(inst.id));
  if (!free) return 'invalid';
  return [...deck, free.id];
}

/** Removes the *highest-index* in-deck, **unstickered** instance of `cardId` — the mirror of
 *  `addCard`'s lowest-index pick, so a deck's copies of a still-fungible card stay a stable,
 *  low-index-first prefix of the owned instances: add, remove, add again and the same instance comes
 *  back rather than churning. Never removes a stickered instance — see `removeInstance`. `'invalid'`
 *  if the deck holds no unstickered instance of `cardId`. Does not mutate `deck`. */
export function removeCard(deck: string[], cardId: string, collection: OwnedCards): string[] | 'invalid' {
  const inDeck = unstickeredInstancesOf(collection, cardId).filter((inst) => deck.includes(inst.id));
  const toRemove = inDeck[inDeck.length - 1];
  if (!toRemove) return 'invalid';
  return deck.filter((instanceId) => instanceId !== toRemove.id);
}

/** Adds a specific owned instance to `deck` by identity — the only way a *stickered* instance is
 *  ever added: no longer fungible with its siblings, so the player picks it explicitly rather than
 *  relying on `addCard`'s LIFO order. `'invalid'` if `instanceId` isn't owned or is already in the
 *  deck. Does not mutate `deck`. */
export function addInstance(deck: string[], instanceId: string, collection: OwnedCards): string[] | 'invalid' {
  if (!findInstance(collection, instanceId)) return 'invalid';
  if (deck.includes(instanceId)) return 'invalid';
  return [...deck, instanceId];
}

/** Removes a specific in-deck instance by identity — the mirror of `addInstance`, and the only
 *  way a stickered instance is ever removed. `'invalid'` if `instanceId` isn't in the deck. */
export function removeInstance(deck: string[], instanceId: string): string[] | 'invalid' {
  if (!deck.includes(instanceId)) return 'invalid';
  return deck.filter((id) => id !== instanceId);
}

/** One display entry per group of same-looking deck cards: a fungible cardId gets a single
 *  ×N-counted entry (first-seen order). A **stickered** instance breaks out into its own entry
 *  (`count: 1`, `instanceId` set, `stickers` carried) since it's no longer interchangeable and must
 *  be addressable by identity, not folded into the stack. Entries are returned in the stable
 *  `compareCards` order (by kind, then name) rather than deck-array order, so the banner/fans don't
 *  churn as the deck is edited; a card's copies stay contiguous — its fungible group first, then its
 *  stickered break-outs by ascending instance id. An instance id the collection no longer recognizes
 *  is silently skipped rather than throwing. */
export interface DeckGroupEntry {
  cardId: string;
  count: number;
  instanceId?: string;
  stickers?: string[];
}

export function groupCounts(instanceIds: string[], collection: OwnedCards): DeckGroupEntry[] {
  const order: string[] = [];
  const counts = new Map<string, number>();
  const stickered: DeckGroupEntry[] = [];
  for (const instanceId of instanceIds) {
    const inst = findInstance(collection, instanceId);
    if (!inst) continue;
    if (hasSticker(inst)) {
      stickered.push({ cardId: inst.cardId, count: 1, instanceId: inst.id, stickers: inst.stickers });
      continue;
    }
    if (!counts.has(inst.cardId)) order.push(inst.cardId);
    counts.set(inst.cardId, (counts.get(inst.cardId) ?? 0) + 1);
  }
  const fungible = order.map((cardId) => ({ cardId, count: counts.get(cardId)! }));
  return sortDeckEntries([...fungible, ...stickered]);
}

/** Stable order for `groupCounts`/`groupCards`-style entries: `compareCards` first, then keep a
 *  card's copies contiguous — its fungible group (no `instanceId`) before its stickered break-outs,
 *  those by ascending numeric instance id. */
export function sortDeckEntries<T extends { cardId: string; instanceId?: string | number }>(entries: T[]): T[] {
  return entries.sort((a, b) => {
    const byCard = compareCards(CARDS[a.cardId], CARDS[b.cardId]) || a.cardId.localeCompare(b.cardId);
    if (byCard) return byCard;
    if (!a.instanceId) return b.instanceId ? -1 : 0;
    if (!b.instanceId) return 1;
    return Number(a.instanceId) - Number(b.instanceId);
  });
}

/** A resolved run-bound card: its cardId plus any permanent stickers its owning meta instance
 *  carries — `RunConfig.deck`'s element shape, and `resolveDeckCards`'s return type below. */
export interface DeckCard {
  cardId: string;
  stickers?: string[];
}

/** Resolve a `deckId` to its run-bound card list (cardId + stickers, not instance ids) from the
 *  player's own decks, via `collection` — `undefined` if the deck isn't found. An instance id the
 *  collection no longer recognizes is dropped rather than surfaced as, say, `undefined` in the
 *  list. Each entry's `stickers` is copied (never the same array reference as the live
 *  `MetaCardInstance`), so a run never aliases into the player's persisted collection. */
export function resolveDeckCards(deckId: string, decks: DeckDef[], collection: OwnedCards): DeckCard[] | undefined {
  const deck = decks.find((d) => d.id === deckId);
  if (!deck) return undefined;
  const cards: DeckCard[] = [];
  for (const instanceId of deck.cards) {
    const inst = findInstance(collection, instanceId);
    if (!inst) continue;
    cards.push({ cardId: inst.cardId, ...(inst.stickers?.length ? { stickers: [...inst.stickers] } : {}) });
  }
  return cards;
}

/** Every deck currently holding `instanceId` — the Collection screen's per-instance view uses this
 *  so a copy's deck membership is visible. Empty if the instance is owned but sits in no deck. */
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
