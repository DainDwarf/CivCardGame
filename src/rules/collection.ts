/**
 * Per-player card ownership (docs/DESIGN.md, "Economy & progression"). Every owned copy is an
 * identified `MetaCardInstance`, not a bare count — the identity substrate a card sticker mutates in
 * place, and that a `DeckDef` references by instance id (not cardId), so two decks holding "the same"
 * copy see a sticker on it for free. `nextId` is a persistent, append-only allocator (distinct from
 * the run's `population.ts` `nextInstanceId`): granting copies only appends, never renumbers, so a
 * `DeckDef`'s instance-id references never go stale.
 *
 * Two instances are fungible when they share a cardId *and* a `stickerSignature` — nothing else
 * distinguishes them, since a sticker is the only per-copy state and equal stickers mean equal
 * effective stats. That's the pool `deckBuilder.ts`'s `addCard`/`removeCard` (LIFO) draw from and the
 * unit its display grouping counts by (`variantInstancesOf`); a plain copy is just the empty
 * signature. Distinct from whether an instance has *room for another* sticker (`isStickerFull`/
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

/** A copy's **sticker signature** — its attached stickers normalized to one order-independent key,
 *  so two copies stickered `[a, b]` and `[b, a]` read as the same variant (attach order is not part
 *  of a sticker's meaning; the `effectiveGain`/`effectiveCost` folds commute). `''` for a plain copy.
 *  The equality every fungibility question reduces to — mirrors what `rules/state.ts`'s `contentKey`
 *  normalizes for a run instance. */
export function stickerSignature(stickers?: string[]): string {
  return stickers?.length ? [...stickers].sort().join(',') : '';
}

/** Whether `instance` already carries `MAX_STICKERS` and can take no more — the shop's
 *  attach-eligibility check (`buySticker`'s reject, `CardInstancePanel`'s disabled attach
 *  button). A once-stickered instance (1 of 2) is not full yet. */
export function isStickerFull(instance: MetaCardInstance): boolean {
  return (instance.stickers?.length ?? 0) >= MAX_STICKERS;
}

/** Owned instances of the `cardId` **variant** carrying `stickers` — the fungible pool
 *  `addCard`/`removeCard`'s LIFO order draws from, in granted order. Omitting `stickers` asks for
 *  the plain copies. */
export function variantInstancesOf(collection: OwnedCards, cardId: string, stickers?: string[]): MetaCardInstance[] {
  const signature = stickerSignature(stickers);
  return instancesOf(collection, cardId).filter((i) => stickerSignature(i.stickers) === signature);
}

/** Owned instances of `cardId` that still have room for another sticker (0 or 1 of `MAX_STICKERS`) —
 *  what the shop checks for an attach target. Cuts across variants: it asks how *full* a copy is,
 *  not which variant it belongs to. */
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
