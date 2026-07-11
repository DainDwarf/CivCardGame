import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { freeTerritory, usedTerritory } from './tableau';
import { blankState, type BuildingInstance } from './state';
import { installFixtures, uninstallFixtures } from './testFixtures';

beforeAll(() => {
  installFixtures();
});
afterAll(() => {
  uninstallFixtures();
});

let nextId = 1;
const b = (cardId: string, workers = 0): BuildingInstance => ({ id: nextId++, cardId, workers });

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
