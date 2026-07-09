/**
 * Per-player card ownership (docs/DESIGN.md, "Economy & progression"). Every owned copy is an
 * identified `MetaCardInstance`, not a bare count — the identity substrate a card sticker mutates in
 * place, and that a `DeckDef` references by instance id (not cardId), so two decks holding "the same"
 * copy see a sticker on it for free. `nextId` is a persistent, append-only allocator (distinct from
 * the run's `population.ts` `nextInstanceId`): granting copies only appends, never renumbers, so a
 * `DeckDef`'s instance-id references never go stale.
 *
 * Carrying *any* sticker makes an instance non-fungible with its siblings — `deckBuilder.ts`'s
 * `addCard`/`removeCard` (default LIFO) only draw from the *unstickered* pool
 * (`unstickeredInstancesOf`); a stickered instance is added/removed only by explicit identity. That's
 * distinct from whether an instance has *room for another* sticker (`isStickerFull`/
 * `stickerableInstancesOf`, which only the shop's attach flow cares about).
 */
export interface MetaCardInstance {
  id: string;
  cardId: string;
  /** Sticker ids attached to this instance — absent/empty for a plain copy. Capped at `MAX_STICKERS`. */
  stickers?: string[];
}

/** The cap on stickers a single instance may carry. */
export const MAX_STICKERS = 2;

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
 *  filtering (and `groupCounts`'s display grouping) checks: any sticker at all, even just one of
 *  `MAX_STICKERS`, already makes an instance worth tracking individually. Distinct from
 *  `isStickerFull`, which asks whether *another* sticker can still be attached. */
export function hasSticker(instance: MetaCardInstance): boolean {
  return !!instance.stickers && instance.stickers.length > 0;
}

/** Whether `instance` already carries `MAX_STICKERS` and can take no more — the shop's
 *  attach-eligibility check (`buySticker`'s reject, `CardInstancePanel`'s disabled attach
 *  button). A once-stickered instance (1 of 2) is not full yet, even though `hasSticker` above
 *  is already true for it. */
export function isStickerFull(instance: MetaCardInstance): boolean {
  return (instance.stickers?.length ?? 0) >= MAX_STICKERS;
}

/** Owned instances of `cardId` that carry no sticker yet — the fungible pool `addCard`/`removeCard`'s
 *  default LIFO order draws from; a stickered instance is only ever added/removed by explicit identity. */
export function unstickeredInstancesOf(collection: OwnedCards, cardId: string): MetaCardInstance[] {
  return instancesOf(collection, cardId).filter((i) => !hasSticker(i));
}

/** Owned instances of `cardId` that still have room for another sticker (0 or 1 of `MAX_STICKERS`) —
 *  what the shop checks for an attach target, distinct from `unstickeredInstancesOf`'s stricter "no
 *  sticker at all" (a once-stickered instance can still take a second). */
export function stickerableInstancesOf(collection: OwnedCards, cardId: string): MetaCardInstance[] {
  return instancesOf(collection, cardId).filter((i) => !isStickerFull(i));
}

/** The distinct card *types* owned — one entry per unlocked `cardId`, regardless of how many copies
 *  or stickered variants exist. The "cards unlocked" numerator the Stats screen shows (filtered to
 *  deckable cards by its caller, since that's a content concern the core doesn't import). */
export function distinctCardIdsOwned(collection: OwnedCards): string[] {
  return [...new Set(collection.instances.map((i) => i.cardId))];
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
