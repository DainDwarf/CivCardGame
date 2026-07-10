import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { countTag, freeTerritory, usedTerritory } from './tableau';
import { blankState, type BuildingInstance } from './state';
import type { CardDef } from '../content/cards';
import { installFixtures, uninstallFixtures, installCards, uninstallCards } from './testFixtures';

// `countTag` needs two cards sharing a tag no shared fixture carries ('wonder', distinct from the
// generic 'building' tag every shared building fixture uses) — a local pair, the same pattern as
// events.test.ts's LOCAL cards.
const LOCAL: Record<string, CardDef> = {
  test_wonder_a: {
    id: 'test_wonder_a', name: 'Test Wonder A', kind: 'building', cost: {}, workers: 0, tags: ['wonder'],
  },
  test_wonder_b: {
    id: 'test_wonder_b', name: 'Test Wonder B', kind: 'building', cost: {}, workers: 0, tags: ['wonder'],
  },
};

beforeAll(() => {
  installFixtures();
  installCards(LOCAL);
});
afterAll(() => {
  uninstallCards(LOCAL);
  uninstallFixtures();
});

let nextId = 1;
const b = (cardId: string, workers = 0): BuildingInstance => ({ id: nextId++, cardId, workers });

describe('countTag', () => {
  it('counts built cards with a tag, staffed or not', () => {
    expect(countTag([b('test_wonder_a'), b('test_wonder_b'), b('test_food', 1)], 'wonder')).toBe(2);
    expect(countTag([b('test_food', 1), b('test_prod', 1)], 'wonder')).toBe(0);
  });
});

describe('territory', () => {
  it('one slot is filled per building, regardless of staffing', () => {
    expect(usedTerritory([])).toBe(0);
    expect(usedTerritory([b('test_food', 1), b('test_selfstaffed')])).toBe(2);
  });

  it('free territory is the cap minus what is built', () => {
    const G = blankState('test');
    G.territory = 3;
    G.tableau = [b('test_food', 1), b('test_prod', 1)];
    expect(freeTerritory(G)).toBe(1);
    G.tableau.push(b('test_sci'));
    expect(freeTerritory(G)).toBe(0);
  });
});
