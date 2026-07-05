import { describe, it, expect } from 'vitest';
import { blankState, getCardState, bumpCardState } from './state';
import { scaleResources } from './resources';
import { resolveCard } from './effects';

describe('scaleResources', () => {
  it('multiplies each present key by the factor, leaving absent keys out', () => {
    expect(scaleResources({ food: 1, production: 2 }, 3)).toEqual({ food: 3, production: 6 });
  });

  it('a factor of 0 zeroes the present keys', () => {
    expect(scaleResources({ food: 2 }, 0)).toEqual({ food: 0 });
  });

  it('does not mutate its input', () => {
    const base = { food: 1 };
    scaleResources(base, 5);
    expect(base).toEqual({ food: 1 });
  });
});

describe('per-card state accessors', () => {
  it('reads a never-touched key as 0', () => {
    const G = blankState('enlightenment');
    expect(getCardState(G, 'anything')).toBe(0);
  });

  it('bump adds (default 1) and returns the new value', () => {
    const G = blankState('enlightenment');
    expect(bumpCardState(G, 'k')).toBe(1);
    expect(bumpCardState(G, 'k', 4)).toBe(5);
    expect(G.cardState.k).toBe(5);
  });
});

describe('Cornucopia (growing per-card gain)', () => {
  it('gains +1🌾 the first play and +1 more each subsequent play in the same run', () => {
    const G = blankState('enlightenment');
    resolveCard({ G, self: { cardId: 'cornucopia' } });
    expect(G.resources.food).toBe(1); // +1
    expect(G.cardState.cornucopia).toBe(1);
    resolveCard({ G, self: { cardId: 'cornucopia' } });
    expect(G.resources.food).toBe(3); // +2
    resolveCard({ G, self: { cardId: 'cornucopia' } });
    expect(G.resources.food).toBe(6); // +3
    expect(G.cardState.cornucopia).toBe(3);
  });

  it('resets per run — a fresh state starts the growth over', () => {
    const G = blankState('enlightenment');
    expect(getCardState(G, 'cornucopia')).toBe(0);
    resolveCard({ G, self: { cardId: 'cornucopia' } });
    expect(G.resources.food).toBe(1);
  });
});
