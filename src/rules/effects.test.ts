import { describe, it, expect } from 'vitest';
import { applyEffect, resolveCard, specToResolver } from './effects';
import { blankState } from './state';

describe('applyEffect', () => {
  it('adds resource gains', () => {
    const G = blankState('enlightenment');
    applyEffect(G, { gain: { science: 3, food: 1 } });
    expect(G.resources.science).toBe(3);
    expect(G.resources.food).toBe(1);
  });

  it('draws cards', () => {
    const G = blankState('enlightenment');
    G.deck = ['a', 'b', 'c'];
    applyEffect(G, { draw: 2 });
    expect(G.hand).toEqual(['a', 'b']);
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
    G.deck = ['a', 'b'];
    specToResolver({ gain: { science: 2 }, draw: 1, culture: 1 })({ G, self: { cardId: 'x' } });
    expect(G.resources.science).toBe(2);
    expect(G.hand).toEqual(['a']);
    expect(G.culture).toBe(1);
  });

  it('demolishes the targeted building for a destroy effect, filing it to removed', () => {
    const G = blankState('enlightenment');
    G.tableau = [
      { id: 1, cardId: 'farm', workers: 1 },
      { id: 2, cardId: 'workshop', workers: 1 },
    ];
    specToResolver({ destroy: true })({ G, self: { cardId: 'destroy' }, target: 1 });
    expect(G.tableau).toEqual([{ id: 2, cardId: 'workshop', workers: 1 }]);
    expect(G.removed).toEqual(['farm']);
  });

  it('a destroy effect with no valid target is a no-op', () => {
    const G = blankState('enlightenment');
    G.tableau = [{ id: 1, cardId: 'farm', workers: 1 }];
    specToResolver({ destroy: true })({ G, self: { cardId: 'destroy' } });
    expect(G.tableau).toHaveLength(1);
    expect(G.removed).toEqual([]);
  });
});

describe('resolveCard', () => {
  it('runs the declarative default for a catalogue card (Cultural Festival → +3 culture)', () => {
    const G = blankState('enlightenment');
    resolveCard({ G, self: { cardId: 'cultural_festival' } });
    expect(G.culture).toBe(3);
  });
});
