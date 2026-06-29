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

  it('grows population (House)', () => {
    const G = blankState('enlightenment');
    G.population = 2;
    applyEffect(G, { population: 1 });
    expect(G.population).toBe(3);
  });

  it('does nothing for an undefined effect', () => {
    const G = blankState('enlightenment');
    applyEffect(G, undefined);
    expect(G.resources).toEqual({ food: 0, production: 0, science: 0 });
  });
});
