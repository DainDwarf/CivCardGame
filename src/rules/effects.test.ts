import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { applyEffect, gainResources, resolveCard, resolveProduction, specToResolver } from './effects';
import { blankState, instancesFromCardIds } from './state';
import { FIXTURE_CARDS, installFixtures, uninstallFixtures } from './testFixtures';

beforeAll(installFixtures);
afterAll(uninstallFixtures);

describe('applyEffect', () => {
  it('ignores gain — gain is applied via gainResources, not here (no double-apply)', () => {
    const G = blankState('test');
    applyEffect(G, { gain: { science: 3, food: 1 }, culture: 2 });
    expect(G.resources.science).toBe(0);
    expect(G.resources.food).toBe(0);
    expect(G.culture).toBe(2); // non-gain fields still apply
  });

  it('draws cards', () => {
    const G = blankState('test');
    G.deck = instancesFromCardIds(['a', 'b', 'c']);
    applyEffect(G, { draw: 2 });
    expect(G.hand.map((c) => c.cardId)).toEqual(['a', 'b']);
  });

  it('grows population (Settlers)', () => {
    const G = blankState('test');
    G.population = 2;
    applyEffect(G, { population: 1 });
    expect(G.population).toBe(3);
  });

  it('raises the building-slot cap (Conquest / Develop)', () => {
    const G = blankState('test');
    const before = G.territory;
    applyEffect(G, { territory: 1 });
    expect(G.territory).toBe(before + 1);
  });

  it('removes resources (loss) and lets them go negative', () => {
    const G = blankState('test');
    G.resources.military = 3;
    applyEffect(G, { loss: { military: 4 } });
    expect(G.resources.military).toBe(-1);
  });

  it('accumulates culture (Cultural Festival)', () => {
    const G = blankState('test');
    G.culture = 2;
    applyEffect(G, { culture: 3 });
    expect(G.culture).toBe(5);
  });

  it('does nothing for an undefined effect', () => {
    const G = blankState('test');
    applyEffect(G, undefined);
    expect(G.resources).toEqual({ food: 0, production: 0, science: 0, military: 0, money: 0 });
  });
});

describe('specToResolver', () => {
  it('reproduces applyEffect for a declarative effect', () => {
    const G = blankState('test');
    G.deck = instancesFromCardIds(['a', 'b']);
    specToResolver({ gain: { science: 2 }, draw: 1, culture: 1 })({ G, self: { id: 1, cardId: 'x' } });
    expect(G.resources.science).toBe(2);
    expect(G.hand.map((c) => c.cardId)).toEqual(['a']);
    expect(G.culture).toBe(1);
  });

  it('demolishes the targeted building for a destroy effect, filing it to removed', () => {
    const G = blankState('test');
    G.tableau = [
      { id: 1, cardId: 'test_food', workers: 1 },
      { id: 2, cardId: 'test_prod', workers: 1 },
    ];
    specToResolver({ destroy: true })({ G, self: { id: 3, cardId: 'test_destroy' }, target: 1 });
    expect(G.tableau).toEqual([{ id: 2, cardId: 'test_prod', workers: 1 }]);
    expect(G.removed).toEqual([{ id: 1, cardId: 'test_food' }]);
  });

  it('a destroy effect with no valid target is a no-op', () => {
    const G = blankState('test');
    G.tableau = [{ id: 1, cardId: 'test_food', workers: 1 }];
    specToResolver({ destroy: true })({ G, self: { id: 2, cardId: 'test_destroy' } });
    expect(G.tableau).toHaveLength(1);
    expect(G.removed).toEqual([]);
  });
});

// The 2.1 deletions carried the only coverage of resolveCard dispatching through a card's own logic.
// Re-asserted here on synthetic fixtures (values chosen freely): a declarative-default card, a
// declarative card + output sticker, a bespoke `resolve` that must still see the sticker, and a
// `dynamicText` card whose face must agree with what its resolver grants.
describe('resolveCard', () => {
  it('runs the declarative default for a catalogue card (test_festival → +3 culture)', () => {
    const G = blankState('test');
    resolveCard({ G, self: { id: 1, cardId: 'test_festival' } });
    expect(G.culture).toBe(3);
  });

  it("an additive-gain sticker bumps a declarative card's gain by 1", () => {
    const G = blankState('test');
    resolveCard({ G, self: { id: 1, cardId: 'test_action', stickers: ['test_addgain'] } });
    expect(G.resources.science).toBe(4); // test_action's base +3, sticker +1
  });

  it("a bespoke resolver sees an output sticker's bonus (the gap a self-scaling resolver closes)", () => {
    const G = blankState('test');
    resolveCard({ G, self: { id: 1, cardId: 'test_bespoke', stickers: ['test_addgain'] } });
    expect(G.resources.science).toBe(3); // test_bespoke's base +2, sticker +1
  });

  it("a dynamicText card's face shows the sticker-adjusted gain (resolve/display agree)", () => {
    const G = blankState('test');
    const self = { id: 1, cardId: 'test_dynamic', stickers: ['test_addgain'] };
    const text = FIXTURE_CARDS.test_dynamic.dynamicText!(G, self);
    expect(text).toBe('+3🌾'); // base +2, sticker +1 — matches the +3 food resolveCard grants
    resolveCard({ G, self });
    expect(G.resources.food).toBe(3);
  });
});

describe('gainResources', () => {
  it('folds output stickers over the base bag', () => {
    const G = blankState('test');
    gainResources({ G, self: { id: 1, cardId: 'x', stickers: ['test_addgain'] } }, { science: 2 });
    expect(G.resources.science).toBe(3); // +2 base, sticker +1
  });

  it('applies an unstickered bag unchanged', () => {
    const G = blankState('test');
    gainResources({ G, self: { id: 1, cardId: 'x' } }, { food: 2 });
    expect(G.resources.food).toBe(2);
  });

  it('is a no-op on an undefined bag', () => {
    const G = blankState('test');
    gainResources({ G, self: { id: 1, cardId: 'x' } }, undefined);
    expect(G.resources).toEqual({ food: 0, production: 0, science: 0, military: 0, money: 0 });
  });
});

describe('resolveProduction', () => {
  it("an additive-gain sticker bumps a building's per-round produces by 1 per resource", () => {
    const G = blankState('test');
    resolveProduction({ G, self: { id: 1, cardId: 'test_food', stickers: ['test_addgain'] } });
    expect(G.resources.food).toBe(3); // test_food's base +2, sticker +1
  });

  it('leaves an unstickered building at its base output', () => {
    const G = blankState('test');
    resolveProduction({ G, self: { id: 1, cardId: 'test_food' } });
    expect(G.resources.food).toBe(2);
  });
});
