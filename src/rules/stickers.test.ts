import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buySticker, effectiveCard, effectiveCost, effectiveGain, removeSticker, stickerAppliesTo } from './stickers';
import { collectionFromCounts, isStickerFull, stickerSignature, type OwnedCards } from './collection';
import { blankState, type CardInstance, type GameState } from './state';
import { gainResources, resolveEndTurn } from './effects';
import type { StickerDef } from '../content/stickers';
import type { CardDef } from '../content/cards';
import {
  FIXTURE_CARDS,
  FIXTURE_STICKERS,
  installCards,
  installFixtures,
  installStickers,
  uninstallCards,
  uninstallFixtures,
  uninstallStickers,
} from './testFixtures';

// Synthetic fixtures stand in for shipped cards/stickers: `test_food` is a food-producing building
// (eligible for the restricted sticker), `test_prod` a non-food building (ineligible); `test_addgain`/
// `test_costcut` are two different unrestricted stickers, `test_restricted` the food-only one.
const ADDGAIN = FIXTURE_STICKERS.test_addgain.cost;
const COSTCUT = FIXTURE_STICKERS.test_costcut.cost;
// Every fixture sticker is unlocked by default, so these tests exercise the buy path without the
// unlock gate getting in the way; one dedicated test below covers a *locked* sticker rejection.
const UNLOCKED: Record<string, true> = Object.fromEntries(Object.keys(FIXTURE_STICKERS).map((id) => [id, true]));

beforeAll(installFixtures);
afterAll(uninstallFixtures);

describe('buySticker', () => {
  it('attaches the sticker and deducts its cost', () => {
    const collection = collectionFromCounts({ test_food: 1 });
    const [a] = collection.instances.map((i) => i.id);
    const result = buySticker(collection, ADDGAIN + 2, a, 'test_addgain', UNLOCKED);
    expect(result).not.toBeNull();
    expect(result!.influence).toBe(2);
    expect(result!.collection.instances.find((i) => i.id === a)?.stickers).toEqual(['test_addgain']);
  });

  it('does not mutate the input collection', () => {
    const collection = collectionFromCounts({ test_food: 1 });
    const [a] = collection.instances.map((i) => i.id);
    buySticker(collection, ADDGAIN, a, 'test_addgain', UNLOCKED);
    expect(collection.instances.find((i) => i.id === a)?.stickers).toBeUndefined();
  });

  it('rejects an unknown sticker id', () => {
    const collection = collectionFromCounts({ test_food: 1 });
    const [a] = collection.instances.map((i) => i.id);
    expect(buySticker(collection, 5, a, 'not-a-sticker', UNLOCKED)).toBeNull();
  });

  it('rejects a sticker that is not unlocked, even when everything else is valid', () => {
    const collection = collectionFromCounts({ test_food: 1 });
    const [a] = collection.instances.map((i) => i.id);
    // Affordable, applicable, room — but locked (absent from the unlocked set) → rejected.
    expect(buySticker(collection, ADDGAIN + 5, a, 'test_addgain', {})).toBeNull();
  });

  it('rejects an instance the collection does not own', () => {
    const collection = collectionFromCounts({ test_food: 1 });
    expect(buySticker(collection, 5, 'not-owned', 'test_addgain', UNLOCKED)).toBeNull();
  });

  it('appends a second, different sticker to a once-stickered instance', () => {
    const collection = collectionFromCounts({ test_food: 1 });
    const [a] = collection.instances.map((i) => i.id);
    const first = buySticker(collection, ADDGAIN + COSTCUT, a, 'test_addgain', UNLOCKED)!;
    const second = buySticker(first.collection, first.influence, a, 'test_costcut', UNLOCKED);
    expect(second).not.toBeNull();
    expect(second!.collection.instances.find((i) => i.id === a)?.stickers).toEqual(['test_addgain', 'test_costcut']);
  });

  it('rejects a third sticker once the instance is full', () => {
    const collection = collectionFromCounts({ test_food: 1 });
    const [a] = collection.instances.map((i) => i.id);
    // Budget affords all three, so the third's rejection is by fullness, not affordability.
    const budget = ADDGAIN * 2 + COSTCUT;
    const first = buySticker(collection, budget, a, 'test_addgain', UNLOCKED)!;
    const second = buySticker(first.collection, first.influence, a, 'test_costcut', UNLOCKED)!;
    expect(buySticker(second.collection, second.influence, a, 'test_addgain', UNLOCKED)).toBeNull();
  });

  it('allows attaching the same sticker twice — it stacks', () => {
    const collection = collectionFromCounts({ test_food: 1 });
    const [a] = collection.instances.map((i) => i.id);
    const first = buySticker(collection, ADDGAIN * 2, a, 'test_addgain', UNLOCKED)!;
    const second = buySticker(first.collection, first.influence, a, 'test_addgain', UNLOCKED);
    expect(second).not.toBeNull();
    expect(second!.collection.instances.find((i) => i.id === a)?.stickers).toEqual(['test_addgain', 'test_addgain']);
  });

  it('rejects an unaffordable purchase', () => {
    const collection = collectionFromCounts({ test_food: 1 });
    const [a] = collection.instances.map((i) => i.id);
    expect(buySticker(collection, 1, a, 'test_addgain', UNLOCKED)).toBeNull();
  });

  it('attaches an eligible restricted sticker (a food-only sticker on a food building)', () => {
    const collection = collectionFromCounts({ test_food: 1 });
    const [a] = collection.instances.map((i) => i.id);
    const result = buySticker(collection, 5, a, 'test_restricted', UNLOCKED);
    expect(result).not.toBeNull();
    expect(result!.collection.instances.find((i) => i.id === a)?.stickers).toEqual(['test_restricted']);
  });

  it('rejects a restricted sticker on an ineligible card (a food-only sticker on a non-food building)', () => {
    const collection = collectionFromCounts({ test_prod: 1 });
    const [a] = collection.instances.map((i) => i.id);
    expect(buySticker(collection, 5, a, 'test_restricted', UNLOCKED)).toBeNull();
  });
});

describe('removeSticker', () => {
  // Build the inputs through the real `buySticker` rather than hand-written arrays, so these fixtures
  // can't drift from the shape a purchase actually produces. Influence is irrelevant to removal, so
  // the attach budget is just "enough".
  function attached(cardId: string, ...stickerIds: string[]): { collection: OwnedCards; id: string } {
    let collection = collectionFromCounts({ [cardId]: 1 });
    const id = collection.instances[0].id;
    for (const s of stickerIds) collection = buySticker(collection, 999, id, s, UNLOCKED)!.collection;
    return { collection, id };
  }

  const stickersOn = (collection: OwnedCards, id: string) => collection.instances.find((i) => i.id === id)?.stickers;

  it('removes the sticker at the given index', () => {
    const { collection, id } = attached('test_food', 'test_addgain', 'test_costcut');
    expect(stickersOn(removeSticker(collection, id, 0)!, id)).toEqual(['test_costcut']);
    expect(stickersOn(removeSticker(collection, id, 1)!, id)).toEqual(['test_addgain']);
  });

  it('removes only one copy of a stacked duplicate', () => {
    // The reason removal is positional: removing by id would destroy both copies here.
    const { collection, id } = attached('test_food', 'test_addgain', 'test_addgain');
    expect(stickersOn(removeSticker(collection, id, 0)!, id)).toEqual(['test_addgain']);
  });

  it('drops the stickers key when the last sticker goes, returning the copy to the fungible pool', () => {
    const { collection, id } = attached('test_food', 'test_addgain');
    const next = removeSticker(collection, id, 0)!;
    const inst = next.instances.find((i) => i.id === id)!;
    // Absent, not `[]` — a plain copy carries no `stickers` key at all.
    expect('stickers' in inst).toBe(false);
    // ...so it reads as the empty-signature variant: interchangeable with the never-stickered copies.
    expect(stickerSignature(inst.stickers)).toBe('');
  });

  it('keeps other copies untouched', () => {
    let collection = collectionFromCounts({ test_food: 2 });
    const [a, b] = collection.instances.map((i) => i.id);
    collection = buySticker(collection, 999, a, 'test_addgain', UNLOCKED)!.collection;
    collection = buySticker(collection, 999, b, 'test_costcut', UNLOCKED)!.collection;
    const next = removeSticker(collection, a, 0)!;
    expect(stickersOn(next, b)).toEqual(['test_costcut']);
  });

  it('does not mutate the input collection', () => {
    const { collection, id } = attached('test_food', 'test_addgain', 'test_costcut');
    removeSticker(collection, id, 0);
    expect(stickersOn(collection, id)).toEqual(['test_addgain', 'test_costcut']);
  });

  it('leaves Influence alone — a destroyed sticker refunds nothing', () => {
    // The signature is the rule: removal returns a bare collection, with no Influence to write back.
    const { collection, id } = attached('test_food', 'test_addgain');
    expect(removeSticker(collection, id, 0)).not.toHaveProperty('influence');
  });

  it('rejects an instance the collection does not own', () => {
    const { collection } = attached('test_food', 'test_addgain');
    expect(removeSticker(collection, 'not-owned', 0)).toBeNull();
  });

  it('rejects a copy with no stickers attached', () => {
    const collection = collectionFromCounts({ test_food: 1 });
    expect(removeSticker(collection, collection.instances[0].id, 0)).toBeNull();
  });

  it('rejects an out-of-range index', () => {
    const { collection, id } = attached('test_food', 'test_addgain');
    expect(removeSticker(collection, id, 1)).toBeNull();
    expect(removeSticker(collection, id, -1)).toBeNull();
  });

  it('frees a slot at the cap, so the copy can be stickered again', () => {
    const { collection, id } = attached('test_food', 'test_addgain', 'test_costcut');
    expect(buySticker(collection, 999, id, 'test_addgain', UNLOCKED)).toBeNull();
    const freed = removeSticker(collection, id, 0)!;
    expect(isStickerFull(freed.instances.find((i) => i.id === id)!)).toBe(false);
    expect(buySticker(freed, 999, id, 'test_addgain', UNLOCKED)).not.toBeNull();
  });
});

// The 2.1 deletions carried the only coverage of the sticker effect-fold functions. Re-asserted here
// on synthetic fixtures: `test_addgain` (+1 every key, unrestricted), `test_costcut` (−1 every key,
// floored), `test_restricted` (food-only +1🌾). `test_food`/`test_work` are a food building and a
// production Work card; `test_prod` a non-food building; `test_action` a non-building card.

describe('stickerAppliesTo', () => {
  it('a restricted (food-only) sticker applies to a food-producing building', () => {
    expect(stickerAppliesTo(FIXTURE_STICKERS.test_restricted, FIXTURE_CARDS.test_food)).toBe(true);
  });

  it('does not apply to a non-food building', () => {
    expect(stickerAppliesTo(FIXTURE_STICKERS.test_restricted, FIXTURE_CARDS.test_prod)).toBe(false);
  });

  it('does not apply to a non-building card', () => {
    expect(stickerAppliesTo(FIXTURE_STICKERS.test_restricted, FIXTURE_CARDS.test_action)).toBe(false);
  });

  it('an unrestricted sticker applies to everything', () => {
    expect(stickerAppliesTo(FIXTURE_STICKERS.test_addgain, FIXTURE_CARDS.test_food)).toBe(true);
    expect(stickerAppliesTo(FIXTURE_STICKERS.test_addgain, FIXTURE_CARDS.test_prod)).toBe(true);
    expect(stickerAppliesTo(FIXTURE_STICKERS.test_addgain, FIXTURE_CARDS.test_action)).toBe(true);
  });

  it('never applies to a wonder — even an unrestricted sticker (wonders are unmodifiable)', () => {
    expect(stickerAppliesTo(FIXTURE_STICKERS.test_addgain, FIXTURE_CARDS.test_wonder)).toBe(false);
    expect(stickerAppliesTo(FIXTURE_STICKERS.test_restricted, FIXTURE_CARDS.test_wonder)).toBe(false);
  });
});

describe('effectiveGain (restricted, food-only)', () => {
  it('bumps only food by 1, leaving other outputs untouched', () => {
    const self: CardInstance = { id: 1, cardId: 'test_multi', stickers: ['test_restricted'] };
    expect(effectiveGain({ food: 1, science: 1, military: 1 }, self)).toEqual({ food: 1 + 1, science: 1, military: 1 });
  });

  it('composes with an additive-gain sticker on the same copy', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food', stickers: ['test_restricted', 'test_addgain'] };
    // restricted +1 food, then additive-gain +1 to every key → food 2+1+1 = 4.
    expect(effectiveGain({ food: 2 }, self)).toEqual({ food: 4 });
  });
});

describe('effectiveGain (additive-gain)', () => {
  it('bumps every resource key present by 1 on a stickered instance', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food', stickers: ['test_addgain'] };
    expect(effectiveGain({ food: 2, production: 1 }, self)).toEqual({ food: 3, production: 2 });
  });

  it('leaves gain untouched on an unstickered instance', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food' };
    expect(effectiveGain({ food: 2 }, self)).toEqual({ food: 2 });
  });

  it('passes undefined through unchanged', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food', stickers: ['test_addgain'] };
    expect(effectiveGain(undefined, self)).toBeUndefined();
  });

  it('stacks two additive-gain stickers on the same instance to +2', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food', stickers: ['test_addgain', 'test_addgain'] };
    expect(effectiveGain({ food: 2 }, self)).toEqual({ food: 4 });
  });
});

// The `G`-aware half of `applyGain`: a sticker whose bump is conditional on the live board. Two
// readings, and the difference is the whole point — with a board the condition decides, without one the
// potential rate is what a face or a projection must show.
describe('effectiveGain (board-conditional)', () => {
  const CONDITIONAL: Record<string, StickerDef> = {
    test_conditional: {
      id: 'test_conditional', name: 'Test Conditional', description: '+1🌾 while a route stands',
      icon: '🧭', cost: 3,
      applyGain: (base, G) =>
        base && (!G || G.tradeRoutes.length > 0) ? { ...base, food: (base.food ?? 0) + 1 } : base,
    },
  };
  beforeAll(() => installStickers(CONDITIONAL));
  afterAll(() => uninstallStickers(CONDITIONAL));

  const self: CardInstance = { id: 1, cardId: 'test_food', stickers: ['test_conditional'] };

  it('shows the potential rate with no board to read', () => {
    expect(effectiveGain({ food: 2 }, self)).toEqual({ food: 3 });
    expect(effectiveCard(FIXTURE_CARDS.test_food, self).produces).toEqual({ resources: { food: 3 } });
  });

  it('applies the bump on a board that satisfies the condition', () => {
    const G = blankState('test');
    G.tradeRoutes = [{ id: 9, cardId: 'test_trade', workers: 0 }];
    expect(effectiveGain({ food: 2 }, self, G)).toEqual({ food: 3 });
  });

  it('withholds it on a board that does not', () => {
    expect(effectiveGain({ food: 2 }, self, blankState('test'))).toEqual({ food: 2 });
  });

  it('reaches the run payment path — gainResources hands the live board down', () => {
    const G = blankState('test');
    gainResources({ G, self }, { food: 2 });
    expect(G.resources.food).toBe(2);

    G.tradeRoutes = [{ id: 9, cardId: 'test_trade', workers: 0 }];
    gainResources({ G, self }, { food: 2 });
    expect(G.resources.food).toBe(2 + 3);
  });
});

describe('effectiveGain (materializing an absent produces)', () => {
  // A route that prints no yield at all — the shape whose `produces` slot exists only once a sticker
  // puts something in it.
  const BARE_ROUTE: Record<string, CardDef> = {
    test_trade_bare: {
      id: 'test_trade_bare', name: 'Test Bare Route', kind: 'trade',
      cost: { resources: { money: 2 } }, upkeep: { resources: { money: -1 } },
    },
  };
  // Raises what the copy yields each round and materializes the yield where there is none, while
  // leaving the all-negative rent bag alone — the three branches an `applyGain` meeting every slot has
  // to separate, keyed on the bag's own sign.
  const MATERIALIZE: Record<string, StickerDef> = {
    test_materialize: {
      id: 'test_materialize', name: 'Test Materialize', description: '+1⚔️ every round it stands',
      icon: '🛡️', cost: 3,
      applyGain: (base) => {
        if (!base) return base;
        const values = Object.values(base);
        return values.some((v) => (v ?? 0) < 0) ? base : { ...base, military: (base.military ?? 0) + 1 };
      },
    },
  };
  beforeAll(() => { installCards(BARE_ROUTE); installStickers(MATERIALIZE); });
  afterAll(() => { uninstallCards(BARE_ROUTE); uninstallStickers(MATERIALIZE); });

  const standing = (stickers?: string[]): { G: GameState; self: CardInstance } => {
    const G = blankState('test');
    const self: CardInstance = { id: 1, cardId: 'test_trade_bare', ...(stickers ? { stickers } : {}) };
    G.tradeRoutes = [{ ...self, workers: 0 }];
    return { G, self };
  };

  it('pays the materialized yield every round the copy stands', () => {
    const { G, self } = standing(['test_materialize']);
    resolveEndTurn({ G, self });
    expect(G.resources.military).toBe(1);
    expect(G.resources.money).toBe(-1); // the rent bag is not a yield and takes nothing
  });

  it('stacks a second copy and still leaves the rent alone', () => {
    const { G, self } = standing(['test_materialize', 'test_materialize']);
    resolveEndTurn({ G, self });
    expect(G.resources.military).toBe(2);
    expect(G.resources.money).toBe(-1);
  });

  it('pays nothing extra on an unstickered copy', () => {
    const { G, self } = standing();
    resolveEndTurn({ G, self });
    expect(G.resources.military).toBe(0);
    expect(G.resources.money).toBe(-1);
  });

  // The one divergence this module has to prevent: what the face quotes per round is what the round pays.
  it('shows the same bag on the face, and no slot the card never gains through', () => {
    const shown = effectiveCard(BARE_ROUTE.test_trade_bare, { stickers: ['test_materialize'] });
    expect(shown.produces).toEqual({ resources: { military: 1 } });
    expect(shown.upkeep).toEqual({ resources: { money: -1 } });
    expect(shown.effect).toBeUndefined();

    const { G, self } = standing(['test_materialize']);
    resolveEndTurn({ G, self });
    expect(G.resources.military).toBe(shown.produces!.resources!.military);
  });

  it('leaves the produces slot absent when nothing materialized into it', () => {
    const shown = effectiveCard(BARE_ROUTE.test_trade_bare, { stickers: ['test_costcut'] });
    expect(shown.produces).toBeUndefined();
    expect(shown.cost).toEqual({ resources: { money: 1 } });
  });
});

describe('effectiveCost (cost-cut)', () => {
  it('knocks 1 off every cost resource on a stickered instance', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food', stickers: ['test_costcut'] };
    expect(effectiveCost({ resources: { production: 2 } }, self)).toEqual({ resources: { production: 1 } });
  });

  it('floors a discounted resource at 0 rather than going negative', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food', stickers: ['test_costcut'] };
    expect(effectiveCost({ resources: { production: 1, food: 0 } }, self)).toEqual({
      resources: { production: 0, food: 0 },
    });
  });

  it('leaves cost untouched on an unstickered instance', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food' };
    expect(effectiveCost({ resources: { production: 2 } }, self)).toEqual({ resources: { production: 2 } });
  });

  it('stacks two cost-cut stickers on the same instance to -2, still floored at 0', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food', stickers: ['test_costcut', 'test_costcut'] };
    expect(effectiveCost({ resources: { production: 3, food: 1 } }, self)).toEqual({
      resources: { production: 1, food: 0 },
    });
  });
});

// The reach `applyCost` gained by taking a whole `CardCost`: a sticker can price a card in a field it
// never declared, which no resource-only hook could reach.
describe('effectiveCost (non-resource fields)', () => {
  it('raises a card-level prerequisite the base cost never declared', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food', stickers: ['test_gated'] };
    expect(effectiveCost({}, self)).toEqual({ cultureLevelReq: 1 });
  });

  it('stacks, and leaves a declared prerequisite as the floor it counts up from', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food', stickers: ['test_gated', 'test_gated'] };
    expect(effectiveCost({ cultureLevelReq: 1 }, self)).toEqual({ cultureLevelReq: 3 });
  });

  it('carries the untouched fields through rather than replacing the cost', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food', stickers: ['test_gated'] };
    expect(effectiveCost({ resources: { food: 1 }, discard: 2 }, self)).toEqual({
      resources: { food: 1 },
      discard: 2,
      cultureLevelReq: 1,
    });
  });
});

describe('a doubly-stickered instance', () => {
  it('composes two different stickers (additive-gain + cost-cut) on the same copy', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food', stickers: ['test_addgain', 'test_costcut'] };
    expect(effectiveGain({ food: 2 }, self)).toEqual({ food: 3 });
    expect(effectiveCost({ resources: { production: 2 } }, self)).toEqual({ resources: { production: 1 } });
  });
});

describe('effectiveCard', () => {
  it('returns the same object (no sticker) unchanged', () => {
    const self: CardInstance = { id: 1, cardId: 'test_food' };
    expect(effectiveCard(FIXTURE_CARDS.test_food, self)).toBe(FIXTURE_CARDS.test_food);
  });

  it("reflects the additive-gain sticker's +1 in produces and the cost-cut sticker's -1 in cost", () => {
    const boosted = effectiveCard(FIXTURE_CARDS.test_food, { stickers: ['test_addgain'] });
    expect(boosted.produces).toEqual({ resources: { food: 3 } });
    expect(boosted.cost).toEqual(FIXTURE_CARDS.test_food.cost); // unaffected by additive-gain

    const cheaper = effectiveCard(FIXTURE_CARDS.test_food, { stickers: ['test_costcut'] });
    expect(cheaper.cost).toEqual({ resources: { production: 1 } });
    expect(cheaper.produces).toEqual(FIXTURE_CARDS.test_food.produces); // unaffected by cost-cut
  });

  it("reflects the additive-gain sticker's +1 in a work card's produces", () => {
    const boosted = effectiveCard(FIXTURE_CARDS.test_work, { stickers: ['test_addgain'] });
    expect(boosted.produces).toEqual({ resources: { production: 4 } });
  });

  // `gainResources` folds a sticker over an `upkeep` drain exactly as over a yield, so the face has to
  // rebuild that slot too or it quotes a rent the run doesn't pay.
  it("reflects the additive-gain sticker in a route's upkeep, not its produces alone", () => {
    const boosted = effectiveCard(FIXTURE_CARDS.test_trade, { stickers: ['test_addgain'] });
    expect(boosted.produces).toEqual({ resources: { food: 2 } });
    expect(boosted.upkeep).toEqual({ resources: { money: 0 } });
  });
});
