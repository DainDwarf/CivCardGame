/**
 * Per-player card ownership (docs/DESIGN.md, "Economy & progression"; Phase 3 Step 7.2's
 * "uniform meta card instances"). Every owned copy is an identified `MetaCardInstance`, not
 * just a bare count — this is the identity substrate a future card sticker (Step 7.5) mutates
 * in place, and that a `DeckDef` (`content/decks.ts`) references by instance id rather than by
 * cardId, so two decks holding "the same" copy see any future sticker on it for free. `nextId`
 * is a persistent, append-only allocator — distinct from the run's `population.ts`'s
 * `nextInstanceId` (which scans run zones instead): granting copies only ever appends, never
 * renumbers, so a `DeckDef`'s instance-id references never go stale.
 *
 * `Collection`/`DeckEditor` (Phase 3 Step 2) read this to omit not-yet-unlocked cards entirely,
 * rather than showing them locked — unlocking one is meant to be a surprise. `rules/deckBuilder.ts`
 * uses it to resolve a deck's instance ids back to cardIds and to cap how many copies of an owned
 * card a deck may include.
 *
 * `stickers` (Phase 3 Step 7.5) is the payoff this identity substrate was built for: a card
 * sticker (`content/stickers.ts`) mutates one chosen instance in place via `rules/stickers.ts`'s
 * `buySticker`. A stickered instance is capped at one sticker and is no longer fungible with its
 * siblings — `rules/deckBuilder.ts`'s `addCard`/`removeCard` (the default LIFO order) only ever
 * pick from the *unstickered* pool (`unstickeredInstancesOf`); a stickered instance is added to
 * or removed from a deck only by explicit identity (`addInstance`/`removeInstance`).
 */
export interface MetaCardInstance {
  id: string;
  cardId: string;
  /** Sticker ids attached to this instance — absent/empty for a plain copy. Capped at one
   *  (Step 7.5's v1 choice; easy to relax later, no design commitment either way). */
  stickers?: string[];
}

export interface OwnedCards {
  instances: MetaCardInstance[];
  nextId: number;
}

/** A fresh, empty ownership set — no cards, allocator at 0. */
export function emptyCollection(): OwnedCards {
  return { instances: [], nextId: 0 };
}

/** Raw copies owned of `cardId` — `0` if not yet unlocked. */
export function copiesOwned(collection: OwnedCards, cardId: string): number {
  return instancesOf(collection, cardId).length;
}

/** Whether the player owns at least one copy of `cardId`. */
export function isOwned(collection: OwnedCards, cardId: string): boolean {
  return copiesOwned(collection, cardId) > 0;
}

/** Every owned instance of `cardId`, in the order they were granted. */
export function instancesOf(collection: OwnedCards, cardId: string): MetaCardInstance[] {
  return collection.instances.filter((i) => i.cardId === cardId);
}

/** Whether `instance` carries a sticker — the one predicate `deckBuilder.ts`'s fungible-pool
 *  filtering and the shop's sticker-target picker both check. */
export function hasSticker(instance: MetaCardInstance): boolean {
  return !!instance.stickers && instance.stickers.length > 0;
}

/** Owned instances of `cardId` that carry no sticker yet — the fungible pool `addCard`/
 *  `removeCard`'s default LIFO order draws from (Step 7.5); a stickered instance is only ever
 *  added/removed by explicit identity. */
export function unstickeredInstancesOf(collection: OwnedCards, cardId: string): MetaCardInstance[] {
  return instancesOf(collection, cardId).filter((i) => !hasSticker(i));
}

/** Resolve an instance by its id — `undefined` if not owned (e.g. a stale deck reference). */
export function findInstance(collection: OwnedCards, instanceId: string): MetaCardInstance | undefined {
  return collection.instances.find((i) => i.id === instanceId);
}

/** Appends `count` new instances of `cardId`, allocating fresh ids off the append-only
 *  counter. Immutable — returns a new `OwnedCards`, leaving the input untouched. The one
 *  writer every grant (mission unlock via `rules/rewards.ts`, shop purchase via
 *  `rules/shop.ts`, initial seeding via `meta/store.ts`) goes through. */
export function grantCopies(collection: OwnedCards, cardId: string, count: number): OwnedCards {
  const instances = [...collection.instances];
  let nextId = collection.nextId;
  for (let i = 0; i < count; i++) {
    instances.push({ id: String(nextId), cardId });
    nextId++;
  }
  return { instances, nextId };
}

/** Builds an `OwnedCards` from a plain `{ cardId: count }` map — the shape content is authored
 *  in (`content/collection.ts`'s `STARTING_COLLECTION`), since instance identity doesn't exist
 *  until it's actually granted. Grants in `Object.entries` order, so the resulting instance ids
 *  are deterministic for a given map. */
export function collectionFromCounts(counts: Record<string, number>): OwnedCards {
  let collection = emptyCollection();
  for (const [cardId, count] of Object.entries(counts)) {
    collection = grantCopies(collection, cardId, count);
  }
  return collection;
}
