import { CARDS, compareCards, isDeckable } from '../content/cards';
import type { DeckDef, DeckSeed } from '../content/decks';
import { findInstance, instancesOf, stickerSignature, variantInstancesOf, type OwnedCards } from './collection';

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

/** The committed *minimum* size a deck must reach before it can be saved. The number is
 *  provisional (balance-tunable), but the *existence* of the floor is a core rule —
 *  enforced at the deck writer (`App.tsx`'s `saveDeck`), with the deck editor's disabled "Save"
 *  button as its reflection. Mirrors the `MAX_DECKS` precedent. The per-card copy cap (a deck may
 *  hold at most the copies owned) lives on the collection and is enforced by `addCard`. */
export const MIN_DECK_SIZE = 20;

/** How many `wonder` cards a single deck may hold. Wonders are unique monuments — a deck is capped
 *  at one. The number is provisional (balance-tunable), but the *existence* of the limit is a core
 *  rule — enforced at the deck add path (`addCard`), with the deck editor's disabled wonder tile as
 *  its reflection. Mirrors the `MAX_DECKS`/`MIN_DECK_SIZE` precedent. */
export const MAX_WONDERS_PER_DECK = 1;

/** How many `wonder` cards `deck` currently holds — resolves each instance id back to its cardId via
 *  `collection` (an unrecognized id counts as none), then to its `CARDS` kind. The leaf `addCard`
 *  gates on for `MAX_WONDERS_PER_DECK`. */
export function deckWonderCount(deck: string[], collection: OwnedCards): number {
  return deck.filter((instanceId) => {
    const inst = findInstance(collection, instanceId);
    return inst && CARDS[inst.cardId]?.kind === 'wonder';
  }).length;
}

/** A card **variant**: a cardId plus the stickers a copy of it carries. Two owned copies matching one
 *  of these are interchangeable (`collection.ts`'s `stickerSignature`), so it — not an instance id —
 *  is what the deck editor adds, removes, and counts a ×N stack by. Also `RunConfig.deck`'s element
 *  shape and `resolveDeckCards`'s return type: the same "a card as the player sees it" identity on
 *  both sides of the contract. A plain copy carries no `stickers`. */
export interface DeckCard {
  cardId: string;
  stickers?: string[];
}

/** A variant's stable identity string — the map key the groupers count into and the React key every
 *  ×N card view needs. */
export function variantKey(card: DeckCard): string {
  return `${card.cardId}#${stickerSignature(card.stickers)}`;
}

/** Appends one copy of `card`'s variant — picks the *lowest-index* owned copy of it not already in
 *  `deck` (`variantInstancesOf` is granted order, so the first Farm added → 1/2, second → 2/2, etc.).
 *  `'invalid'` if `card.cardId` isn't in the `CARDS` catalogue (a data-coherence check, not a deferred
 *  balance rule), or if every owned copy of the variant is already in the deck (an absent/zero
 *  entry — not yet unlocked — rejects like any other invalid add). Mirrors the `'invalid'` signal
 *  `run/moves.ts` uses. Does not mutate `deck`. */
export function addCard(deck: string[], card: DeckCard, collection: OwnedCards): string[] | 'invalid' {
  const def = CARDS[card.cardId];
  if (!def) return 'invalid';
  // Event/threat/objective cards are mission-injected only — never player-editable into a deck.
  if (!isDeckable(def)) return 'invalid';
  // Wonders are unique — a deck may hold at most `MAX_WONDERS_PER_DECK` of them.
  if (def.kind === 'wonder' && deckWonderCount(deck, collection) >= MAX_WONDERS_PER_DECK) return 'invalid';
  const inDeck = new Set(deck);
  const free = variantInstancesOf(collection, card.cardId, card.stickers).find((inst) => !inDeck.has(inst.id));
  if (!free) return 'invalid';
  return [...deck, free.id];
}

/** Removes the *highest-index* in-deck copy of `card`'s variant — the mirror of `addCard`'s
 *  lowest-index pick, so a deck's copies of a variant stay a stable, low-index-first prefix of the
 *  owned instances: add, remove, add again and the same instance comes back rather than churning.
 *  `'invalid'` if the deck holds no copy of the variant. Does not mutate `deck`. */
export function removeCard(deck: string[], card: DeckCard, collection: OwnedCards): string[] | 'invalid' {
  const inDeck = variantInstancesOf(collection, card.cardId, card.stickers).filter((inst) => deck.includes(inst.id));
  const toRemove = inDeck[inDeck.length - 1];
  if (!toRemove) return 'invalid';
  return deck.filter((instanceId) => instanceId !== toRemove.id);
}

/** The distinct variants of `cardId` the player owns — one entry per sticker signature, in
 *  `sortDeckEntries`' within-card order (plain copies first, then by signature). The deck editor's
 *  picker enumerates through here, so it offers one ×N tile per variant rather than one per copy. */
export function ownedVariantsOf(collection: OwnedCards, cardId: string): DeckCard[] {
  const variants = new Map<string, DeckCard>();
  for (const inst of instancesOf(collection, cardId)) {
    const key = variantKey(inst);
    if (!variants.has(key)) variants.set(key, toVariant(inst));
  }
  return sortDeckEntries([...variants.values()]);
}

/** An owned copy's variant — its `stickers` copied, never the live `MetaCardInstance` array, so a
 *  display group or a run's deck can never alias into the player's persisted collection. */
function toVariant(inst: { cardId: string; stickers?: string[] }): DeckCard {
  return { cardId: inst.cardId, ...(inst.stickers?.length ? { stickers: [...inst.stickers] } : {}) };
}

/** One display entry per group of interchangeable deck cards — same cardId, same stickers — carrying
 *  the variant's `stickers` so the entry renders its own `effectiveCard` face and badge. Entries are
 *  returned in the stable `compareCards` order (by kind, then name) rather than deck-array order, so
 *  the banner/fans don't churn as the deck is edited. An instance id the collection no longer
 *  recognizes is silently skipped rather than throwing. */
export interface DeckGroupEntry extends DeckCard {
  count: number;
}

export function groupCounts(instanceIds: string[], collection: OwnedCards): DeckGroupEntry[] {
  const groups = new Map<string, DeckGroupEntry>();
  for (const instanceId of instanceIds) {
    const inst = findInstance(collection, instanceId);
    if (!inst) continue;
    const key = variantKey(inst);
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { ...toVariant(inst), count: 1 });
  }
  return sortDeckEntries([...groups.values()]);
}

/** Stable order for `groupCounts`/`groupCards`-style entries: `compareCards` first, then keep a
 *  card's variants contiguous — its plain copies (empty signature, which sorts first) before its
 *  stickered ones. `instanceId` is the last resort for entries that group by neither, i.e. the pile
 *  viewer's per-copy `dynamicText` singles. */
export function sortDeckEntries<T extends DeckCard & { instanceId?: string | number }>(entries: T[]): T[] {
  return entries.sort((a, b) => {
    const byCard = compareCards(CARDS[a.cardId], CARDS[b.cardId]) || a.cardId.localeCompare(b.cardId);
    if (byCard) return byCard;
    const bySticker = stickerSignature(a.stickers).localeCompare(stickerSignature(b.stickers));
    if (bySticker) return bySticker;
    if (a.instanceId === undefined) return b.instanceId === undefined ? 0 : -1;
    if (b.instanceId === undefined) return 1;
    return Number(a.instanceId) - Number(b.instanceId);
  });
}

/** Resolve a `deckId` to its run-bound card list (variants, not instance ids) from the player's own
 *  decks, via `collection` — `undefined` if the deck isn't found. An instance id the collection no
 *  longer recognizes is dropped rather than surfaced as, say, `undefined` in the list. */
export function resolveDeckCards(deckId: string, decks: DeckDef[], collection: OwnedCards): DeckCard[] | undefined {
  const deck = decks.find((d) => d.id === deckId);
  if (!deck) return undefined;
  const cards: DeckCard[] = [];
  for (const instanceId of deck.cards) {
    const inst = findInstance(collection, instanceId);
    if (!inst) continue;
    cards.push(toVariant(inst));
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
