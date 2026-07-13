import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { specToResolver } from './effects';
import { dispatchEvent } from './events';
import { applyUpkeep } from './upkeep';
import { cultureForLevel, cultureLevel, cultureProgress, effectiveHandSize } from './culture';
import { blankState, instancesFromCardIds } from './state';
import { playCard } from '../run/moves';
import type { BuildingInstance } from './state';
import { installFixtures, uninstallFixtures } from './testFixtures';

let nextId = 1;
const b = (cardId: string, workers: number): BuildingInstance => ({ id: nextId++, cardId, workers });

beforeAll(installFixtures);
afterAll(uninstallFixtures);

describe('culture: immediate gain via card effect', () => {
  const grant = (G: ReturnType<typeof blankState>, culture: number) =>
    specToResolver({ resources: { culture } })({ G, self: { id: 1, cardId: 'x' } });

  it('a culture resource delta raises G.resources.culture', () => {
    const G = blankState('test');
    grant(G, 3);
    expect(G.resources.culture).toBe(3);
  });

  it('culture stacks across multiple gains', () => {
    const G = blankState('test');
    grant(G, 3);
    grant(G, 2);
    expect(G.resources.culture).toBe(5);
  });
});

describe('culture: per-round output from operating buildings', () => {
  it('counts culture from a staffed culture building', () => {
    const G = blankState('test');
    G.tableau = [b('test_culture', 1)];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.culture).toBe(2);
  });

  it('ignores culture from an unstaffed culture building', () => {
    const G = blankState('test');
    G.tableau = [b('test_culture', 0)];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.culture).toBe(0);
  });

  it('ignores buildings with no culture output', () => {
    const G = blankState('test');
    G.tableau = [b('test_food', 1), b('test_sci', 1)];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.culture).toBe(0);
  });

  it('applyUpkeep accumulates culture from operating culture buildings', () => {
    const G = blankState('test');
    G.tableau = [b('test_culture', 1), b('test_culture', 0)]; // one operating, one idle
    G.resources.food = 10;
    applyUpkeep(G);
    expect(G.resources.culture).toBe(2); // only the staffed one contributes
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

  it('reports the cumulative culture to reach a level (the band floors)', () => {
    expect(cultureForLevel(0)).toBe(0);
    expect(cultureForLevel(1)).toBe(10);
    expect(cultureForLevel(2)).toBe(30);
    expect(cultureForLevel(3)).toBe(70);
    // Reaching level N ⇔ having cultureForLevel(N) culture.
    expect(cultureLevel(cultureForLevel(2))).toBe(2);
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
    const G = blankState('test');
    G.handSize = 5;
    expect(effectiveHandSize(G)).toBe(5); // level 0
    G.resources.culture = 10;
    expect(effectiveHandSize(G)).toBe(6); // level 1
    G.resources.culture = 30;
    expect(effectiveHandSize(G)).toBe(7); // level 2
  });
});

describe('culture: level gate on playCard', () => {
  it('blocks play below the required culture level', () => {
    const G = blankState('test');
    G.hand = instancesFromCardIds(['test_cultreq']);
    G.resources.science = 10;
    G.resources.culture = 9; // still level 0; test_cultreq needs level 1
    const result = playCard(G, 0);
    expect(result).toBe('invalid');
    expect(G.hand.map((c) => c.cardId)).toEqual(['test_cultreq']); // card stays in hand
  });

  it('allows play once the culture level is reached', () => {
    const G = blankState('test');
    G.hand = instancesFromCardIds(['test_cultreq']);
    G.resources.science = 10;
    G.resources.culture = 10; // exactly level 1
    const result = playCard(G, 0);
    expect(result).toBeUndefined(); // undefined = success
    expect(G.hand).toEqual([]);
  });

  it('does not consume culture when a gated card is played', () => {
    const G = blankState('test');
    G.hand = instancesFromCardIds(['test_cultreq']);
    G.resources.science = 10;
    G.resources.culture = 15;
    playCard(G, 0);
    expect(G.resources.culture).toBe(15); // culture is a gate, not a cost
  });
});
