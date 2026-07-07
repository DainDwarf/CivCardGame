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
 */
export interface MetaCardInstance {
  id: string;
  cardId: string;
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
