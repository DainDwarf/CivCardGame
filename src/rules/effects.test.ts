import { describe, it, expect } from 'vitest';
import { applyEffect } from './effects';
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

  it('constructs a building, auto-staffed from idle population', () => {
    const G = blankState('enlightenment');
    G.population = 1; // 1 idle worker
    applyEffect(G, { build: 'farm' });
    expect(G.tableau).toEqual([{ id: 1, buildingId: 'farm', workers: 1 }]);
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

  it('does nothing for an undefined effect', () => {
    const G = blankState('enlightenment');
    applyEffect(G, undefined);
    expect(G.resources).toEqual({ food: 0, production: 0, science: 0, military: 0, money: 0 });
  });
});
