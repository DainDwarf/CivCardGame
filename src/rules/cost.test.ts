import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { currentCost, costReason, discardCount, payCost, runCard } from './cost';
import { blankState, bumpCounter, type CardInstance } from './state';
import { scaleResources } from './resources';
import type { CardDef } from '../content/cards';
import { installFixtures, uninstallFixtures } from './testFixtures';

// The cost-cut sticker is looked up live from the catalogue, so the fold-order test needs it installed.
beforeAll(installFixtures);
afterAll(uninstallFixtures);

/** A price that doubles per play of *this copy*, derived from the declarative base rather than
 *  restating it — the shape a scaling card authors. */
const doubling: CardDef = {
  id: 'test_doubling', name: 'Test Doubling', kind: 'action',
  cost: {
    resources: { military: 2 },
    resolve: ({ self }, base) => ({
      ...base,
      resources: scaleResources(base.resources ?? {}, 2 ** (self.counters?.plays ?? 0)),
    }),
  },
  effect: { resources: { territory: 1 }, resolve: (ctx) => { bumpCounter(ctx.self, 'plays'); } },
};

const fresh = (): CardInstance => ({ id: 1, cardId: 'test_doubling' });

describe('currentCost', () => {
  it('returns the declarative cost untouched when the card declares no resolve', () => {
    const card: CardDef = { id: 'flat', name: 'Flat', kind: 'action', cost: { resources: { food: 3 } } };
    const G = blankState('test');
    expect(currentCost(card, { G, self: { id: 1, cardId: 'flat' } })).toEqual({ resources: { food: 3 } });
  });

  it('prices a scaling card off its own counter, leaving the catalogue base alone', () => {
    const G = blankState('test');
    const self = fresh();
    expect(currentCost(doubling, { G, self }).resources).toEqual({ military: 2 });

    bumpCounter(self, 'plays');
    expect(currentCost(doubling, { G, self }).resources).toEqual({ military: 4 });
    bumpCounter(self, 'plays');
    expect(currentCost(doubling, { G, self }).resources).toEqual({ military: 8 });

    // A second copy carries its own counter, so escalation is per-copy, not per-card.
    expect(currentCost(doubling, { G, self: { id: 2, cardId: 'test_doubling' } }).resources).toEqual({ military: 2 });
    expect(doubling.cost.resources).toEqual({ military: 2 });
  });

  it('folds a sticker discount over the scaled price, not under it', () => {
    const G = blankState('test');
    const self: CardInstance = { id: 1, cardId: 'test_doubling', counters: { plays: 2 }, stickers: ['test_costcut'] };
    // Scaled 2→8, then −1: a discount applied to the base first would have been doubled to −4 (8→4).
    expect(currentCost(doubling, { G, self }).resources).toEqual({ military: 7 });
  });

  it('carries the non-resource fields through the resolve', () => {
    const gatedScaler: CardDef = {
      id: 'gated', name: 'Gated', kind: 'action',
      cost: {
        resources: { food: 1 },
        cultureLevelReq: 1,
        resolve: (_ctx, base) => ({ ...base, resources: { food: 4 } }),
      },
    };
    const G = blankState('test');
    expect(currentCost(gatedScaler, { G, self: { id: 1, cardId: 'gated' } })).toMatchObject({
      resources: { food: 4 },
      cultureLevelReq: 1,
    });
  });
});

describe('costReason', () => {
  it('reports the shortfall against the resolved price, not the base', () => {
    const G = blankState('test');
    G.resources.military = 3;
    const self: CardInstance = { id: 1, cardId: 'test_doubling', counters: { plays: 1 } };
    // Base 2 would be affordable at 3⚔️; the resolved 4 is not.
    expect(costReason(doubling, { G, self })).toEqual({ kind: 'cost', missing: { military: 1 } });
  });

  it('prices a non-core pool like any other', () => {
    const card: CardDef = { id: 'cultic', name: 'Cultic', kind: 'action', cost: { resources: { culture: 3 } } };
    const G = blankState('test');
    G.resources.culture = 1;
    expect(costReason(card, { G, self: { id: 1, cardId: 'cultic' } })).toEqual({
      kind: 'cost',
      missing: { culture: 2 },
    });
  });
});

describe('payCost', () => {
  it('charges the resolved price and leaves the bump to the effect, so the first play pays the base', () => {
    const G = blankState('test');
    G.resources.military = 6;
    const self = fresh();

    payCost(doubling, { G, self });
    expect(G.resources.military).toBe(4); // base 2 — escalation applies from the *next* play

    bumpCounter(self, 'plays'); // what the card's own effect does after payment
    payCost(doubling, { G, self });
    expect(G.resources.military).toBe(0);
  });
});

describe('discardCount', () => {
  const sacrificer: CardDef = { id: 'sac', name: 'Sac', kind: 'action', cost: { discard: 2 } };
  const self: CardInstance = { id: 1, cardId: 'sac' };

  it('charges the declared count when the hand has that many other cards to spare', () => {
    const G = blankState('test');
    G.hand = [self, { id: 2, cardId: 'x' }, { id: 3, cardId: 'x' }];
    expect(discardCount(sacrificer, { G, self })).toBe(2);
  });

  it('waives it entirely rather than partially when the hand is too thin', () => {
    const G = blankState('test');
    G.hand = [self, { id: 2, cardId: 'x' }];
    expect(discardCount(sacrificer, { G, self })).toBe(0);
  });

  it("survives a resolve that only reprices resources and never mentions it", () => {
    const scalingSacrificer: CardDef = {
      id: 'sac2', name: 'Sac2', kind: 'action',
      cost: { resources: { food: 1 }, discard: 2, resolve: () => ({ resources: { food: 9 } }) },
    };
    const inst: CardInstance = { id: 1, cardId: 'sac2' };
    const G = blankState('test');
    G.hand = [inst, { id: 2, cardId: 'x' }, { id: 3, cardId: 'x' }];
    expect(currentCost(scalingSacrificer, { G, self: inst })).toEqual({
      resources: { food: 9 },
      discard: 2,
      resolve: expect.any(Function),
    });
    expect(discardCount(scalingSacrificer, { G, self: inst })).toBe(2);
  });
});

describe('runCard', () => {
  it('shows the resolved price on the face, so a face can never quote a price the gate would not charge', () => {
    const G = blankState('test');
    const self: CardInstance = { id: 1, cardId: 'test_doubling', counters: { plays: 3 } };
    expect(runCard(doubling, { G, self }).cost.resources).toEqual({ military: 16 });
    expect(runCard(doubling, { G, self }).cost).toEqual(currentCost(doubling, { G, self }));
  });
});
