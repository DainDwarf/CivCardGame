import { describe, it, expect } from 'vitest';
import { applyEffect } from './effects';
import { tableauCultureOutput } from './production';
import { applyUpkeep } from './upkeep';
import { blankState } from './state';
import { playCard } from '../run/moves';
import type { BuildingInstance } from './state';

const b = (buildingId: string, workers: number): BuildingInstance => ({ buildingId, workers });

describe('culture: immediate gain via card effect', () => {
  it('cultural_festival effect raises G.culture', () => {
    const G = blankState('enlightenment');
    applyEffect(G, { culture: 3 });
    expect(G.culture).toBe(3);
  });

  it('culture stacks across multiple gains', () => {
    const G = blankState('enlightenment');
    applyEffect(G, { culture: 3 });
    applyEffect(G, { culture: 2 });
    expect(G.culture).toBe(5);
  });
});

describe('culture: per-round output from operating buildings', () => {
  it('counts culture from a staffed theater', () => {
    expect(tableauCultureOutput([b('theater', 1)])).toBe(2);
  });

  it('ignores culture from an unstaffed theater', () => {
    expect(tableauCultureOutput([b('theater', 0)])).toBe(0);
  });

  it('ignores buildings with no cultureOutput', () => {
    expect(tableauCultureOutput([b('farm', 1), b('library', 1)])).toBe(0);
  });

  it('applyUpkeep accumulates culture from operating theaters', () => {
    const G = blankState('enlightenment');
    G.tableau = [b('theater', 1), b('theater', 0)]; // one operating, one idle
    G.resources.food = 10;
    applyUpkeep(G);
    expect(G.culture).toBe(2); // only the staffed theater contributes
  });
});

describe('culture: threshold gate on playCard', () => {
  it('blocks play when culture is below the threshold', () => {
    const G = blankState('enlightenment');
    G.hand = ['philosopher'];
    G.resources.science = 10;
    G.culture = 4; // threshold is 5
    const result = playCard(G, 0);
    expect(result).toBe('invalid');
    expect(G.hand).toEqual(['philosopher']); // card stays in hand
  });

  it('allows play once culture meets the threshold', () => {
    const G = blankState('enlightenment');
    G.hand = ['philosopher'];
    G.resources.science = 10;
    G.culture = 5; // exactly at threshold
    const result = playCard(G, 0);
    expect(result).toBeUndefined(); // undefined = success
    expect(G.hand).toEqual([]);
  });

  it('does not consume culture when a gated card is played', () => {
    const G = blankState('enlightenment');
    G.hand = ['philosopher'];
    G.resources.science = 10;
    G.culture = 7;
    playCard(G, 0);
    expect(G.culture).toBe(7); // culture is a gate, not a cost
  });
});
