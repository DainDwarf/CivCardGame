import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { freeTerritory, placedCards, usedTerritory } from './territory';
import { unplayableReason } from './playability';
import { addWork } from './population';
import { openTradeRoute } from './tradeRoutes';
import { blankState, type BuildingInstance } from './state';
import { mint, FIXTURE_CARDS, installFixtures, uninstallFixtures } from './testFixtures';

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
    const G = blankState('test');
    expect(usedTerritory(G)).toBe(0);
    G.tableau = [b('test_food', 1), b('test_selfstaffed')];
    expect(usedTerritory(G)).toBe(2);
  });

  it('free territory is the cap minus what is built', () => {
    const G = blankState('test');
    G.resources.territory = 3;
    G.tableau = [b('test_food', 1), b('test_prod', 1)];
    expect(freeTerritory(G)).toBe(1);
    G.tableau.push(b('test_sci'));
    expect(freeTerritory(G)).toBe(0);
  });

  it('work boxes and trade routes stand on the board without spending territory', () => {
    const G = blankState('test');
    G.resources.territory = 2;
    G.tableau = [b('test_food', 1)];
    addWork(G, mint(G, 'test_work'));
    openTradeRoute(G, mint(G, 'test_trade'));
    // All three are on the board...
    expect(placedCards(G)).toHaveLength(3);
    // ...but only the building is on the land.
    expect(usedTerritory(G)).toBe(1);
    expect(freeTerritory(G)).toBe(1);
  });

  it('a full board blocks a structure, but nothing else', () => {
    const G = blankState('test');
    G.resources = { ...G.resources, production: 20, money: 20, science: 20, territory: 1 };
    G.tableau = [b('test_food', 1)];
    const self = { id: 99, cardId: 'unused' };
    for (const card of [FIXTURE_CARDS.test_food, FIXTURE_CARDS.test_wonder]) {
      expect(unplayableReason(G, card, self)).toEqual({ kind: 'territory' });
    }
    for (const card of [FIXTURE_CARDS.test_work, FIXTURE_CARDS.test_trade, FIXTURE_CARDS.test_action]) {
      expect(unplayableReason(G, card, self)).toBeNull();
    }
  });
});
