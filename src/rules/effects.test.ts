import { describe, it, expect } from 'vitest';
import { applyEffect, gainResources, resolveProduction, specToResolver } from './effects';
import { blankState, instancesFromCardIds } from './state';

describe('applyEffect', () => {
  it('ignores gain — gain is applied via gainResources, not here (no double-apply)', () => {
    const G = blankState('enlightenment');
    applyEffect(G, { gain: { science: 3, food: 1 }, culture: 2 });
    expect(G.resources.science).toBe(0);
    expect(G.resources.food).toBe(0);
    expect(G.culture).toBe(2); // non-gain fields still apply
  });

  it('draws cards', () => {
    const G = blankState('enlightenment');
    G.deck = instancesFromCardIds(['a', 'b', 'c']);
    applyEffect(G, { draw: 2 });
    expect(G.hand.map((c) => c.cardId)).toEqual(['a', 'b']);
  });

  it('grows population (Settlers)', () => {
    const G = blankState('enlightenment');
    G.population = 2;
    applyEffect(G, { population: 1 });
    expect(G.population).toBe(3);
  });

  it('raises the building-slot cap (Conquest / Develop)', () => {
    const G = blankState('enlightenment');
    const before = G.territory;
    applyEffect(G, { territory: 1 });
    expect(G.territory).toBe(before + 1);
  });

  it('removes resources (loss) and lets them go negative', () => {
    const G = blankState('barbarian_tide');
    G.resources.military = 3;
    applyEffect(G, { loss: { military: 4 } });
    expect(G.resources.military).toBe(-1);
  });

  it('accumulates culture (Cultural Festival)', () => {
    const G = blankState('enlightenment');
    G.culture = 2;
    applyEffect(G, { culture: 3 });
    expect(G.culture).toBe(5);
  });

  it('does nothing for an undefined effect', () => {
    const G = blankState('enlightenment');
    applyEffect(G, undefined);
    expect(G.resources).toEqual({ food: 0, production: 0, science: 0, military: 0, money: 0 });
  });
});

describe('specToResolver', () => {
  it('reproduces applyEffect for a declarative effect', () => {
    const G = blankState('enlightenment');
    G.deck = instancesFromCardIds(['a', 'b']);
    specToResolver({ gain: { science: 2 }, draw: 1, culture: 1 })({ G, self: { id: 1, cardId: 'x' } });
    expect(G.resources.science).toBe(2);
    expect(G.hand.map((c) => c.cardId)).toEqual(['a']);
    expect(G.culture).toBe(1);
  });

  it('demolishes the targeted building for a destroy effect, filing it to removed', () => {
    const G = blankState('enlightenment');
    G.tableau = [
      { id: 1, cardId: 'farm', workers: 1 },
      { id: 2, cardId: 'workshop', workers: 1 },
    ];
    specToResolver({ destroy: true })({ G, self: { id: 3, cardId: 'destroy' }, target: 1 });
    expect(G.tableau).toEqual([{ id: 2, cardId: 'workshop', workers: 1 }]);
    expect(G.removed).toEqual([{ id: 1, cardId: 'farm' }]);
  });

  it('a destroy effect with no valid target is a no-op', () => {
    const G = blankState('enlightenment');
    G.tableau = [{ id: 1, cardId: 'farm', workers: 1 }];
    specToResolver({ destroy: true })({ G, self: { id: 2, cardId: 'destroy' } });
    expect(G.tableau).toHaveLength(1);
    expect(G.removed).toEqual([]);
  });
});

describe('gainResources', () => {
  it('folds output stickers over the base bag', () => {
    const G = blankState('enlightenment');
    gainResources({ G, self: { id: 1, cardId: 'x', stickers: ['reinforced'] } }, { science: 2 });
    expect(G.resources.science).toBe(3); // +2 base, Reinforced +1
  });

  it('applies an unstickered bag unchanged', () => {
    const G = blankState('enlightenment');
    gainResources({ G, self: { id: 1, cardId: 'x' } }, { food: 2 });
    expect(G.resources.food).toBe(2);
  });

  it('is a no-op on an undefined bag', () => {
    const G = blankState('enlightenment');
    gainResources({ G, self: { id: 1, cardId: 'x' } }, undefined);
    expect(G.resources).toEqual({ food: 0, production: 0, science: 0, military: 0, money: 0 });
  });
});

describe('resolveProduction', () => {
  it("a Reinforced sticker bumps a building's per-round produces by 1 per resource", () => {
    const G = blankState('enlightenment');
    resolveProduction({ G, self: { id: 1, cardId: 'farm', stickers: ['reinforced'] } });
    expect(G.resources.food).toBe(3); // farm's base +2, Reinforced +1
  });

  it('leaves an unstickered building at its base output', () => {
    const G = blankState('enlightenment');
    resolveProduction({ G, self: { id: 1, cardId: 'farm' } });
    expect(G.resources.food).toBe(2);
  });
});
