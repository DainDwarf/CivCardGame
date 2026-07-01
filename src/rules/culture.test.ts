import { describe, it, expect } from 'vitest';
import { applyEffect } from './effects';
import { tableauCultureOutput } from './production';
import { applyUpkeep } from './upkeep';
import { cultureLevel, cultureProgress, effectiveHandSize } from './culture';
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

describe('culture: level thresholds', () => {
  it('accumulates through the doubling bands (10 / 30 / 70)', () => {
    expect(cultureLevel(0)).toBe(0);
    expect(cultureLevel(9)).toBe(0);
    expect(cultureLevel(10)).toBe(1); // first band: 10
    expect(cultureLevel(29)).toBe(1);
    expect(cultureLevel(30)).toBe(2); // +20 more
    expect(cultureLevel(69)).toBe(2);
    expect(cultureLevel(70)).toBe(3); // +40 more
  });

  it('reports progress within the current band, resetting on level-up', () => {
    expect(cultureProgress(0)).toEqual({ level: 0, current: 0, needed: 10, ratio: 0 });
    expect(cultureProgress(5)).toEqual({ level: 0, current: 5, needed: 10, ratio: 0.5 });
    expect(cultureProgress(10)).toEqual({ level: 1, current: 0, needed: 20, ratio: 0 });
    expect(cultureProgress(20)).toEqual({ level: 1, current: 10, needed: 20, ratio: 0.5 });
    expect(cultureProgress(30)).toEqual({ level: 2, current: 0, needed: 40, ratio: 0 });
  });
});

describe('culture: hand-size bonus', () => {
  it('adds one card to the hand size per culture level', () => {
    const G = blankState('enlightenment');
    G.handSize = 5;
    expect(effectiveHandSize(G)).toBe(5); // level 0
    G.culture = 10;
    expect(effectiveHandSize(G)).toBe(6); // level 1
    G.culture = 30;
    expect(effectiveHandSize(G)).toBe(7); // level 2
  });
});

describe('culture: level gate on playCard', () => {
  it('blocks play below the required culture level', () => {
    const G = blankState('enlightenment');
    G.hand = ['philosopher'];
    G.resources.science = 10;
    G.culture = 9; // still level 0; philosopher needs level 1
    const result = playCard(G, 0);
    expect(result).toBe('invalid');
    expect(G.hand).toEqual(['philosopher']); // card stays in hand
  });

  it('allows play once the culture level is reached', () => {
    const G = blankState('enlightenment');
    G.hand = ['philosopher'];
    G.resources.science = 10;
    G.culture = 10; // exactly level 1
    const result = playCard(G, 0);
    expect(result).toBeUndefined(); // undefined = success
    expect(G.hand).toEqual([]);
  });

  it('does not consume culture when a gated card is played', () => {
    const G = blankState('enlightenment');
    G.hand = ['philosopher'];
    G.resources.science = 10;
    G.culture = 15;
    playCard(G, 0);
    expect(G.culture).toBe(15); // culture is a gate, not a cost
  });
});
