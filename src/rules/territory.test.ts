import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { freeTerritory, usedTerritory } from './territory';
import { unplayableReason } from './playability';
import { settleEndOfTurn } from './upkeep';
import { addWork } from './population';
import { openTradeRoute } from './tradeRoutes';
import { blankState, type BuildingInstance } from './state';
import { FIXTURE_CARDS, installFixtures, uninstallFixtures } from './testFixtures';

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

  it('work boxes and trade routes fill slots alongside buildings', () => {
    const G = blankState('test');
    G.resources.territory = 5;
    G.tableau = [b('test_food', 1)];
    addWork(G, 'test_work');
    openTradeRoute(G, 'test_trade');
    expect(usedTerritory(G)).toBe(3);
    expect(freeTerritory(G)).toBe(2);
  });

  it('free territory is the cap minus what stands on the board', () => {
    const G = blankState('test');
    G.resources.territory = 3;
    G.tableau = [b('test_food', 1), b('test_prod', 1)];
    expect(freeTerritory(G)).toBe(1);
    G.tableau.push(b('test_sci'));
    expect(freeTerritory(G)).toBe(0);
  });

  it('a full board blocks every kind that stands on it, but never an action', () => {
    const G = blankState('test');
    G.resources = { ...G.resources, production: 20, money: 20, science: 20, territory: 1 };
    G.tableau = [b('test_food', 1)];
    const self = { id: 99, cardId: 'unused' };
    for (const card of [FIXTURE_CARDS.test_food, FIXTURE_CARDS.test_wonder, FIXTURE_CARDS.test_work, FIXTURE_CARDS.test_trade]) {
      expect(unplayableReason(G, card, self)).toEqual({ kind: 'territory' });
    }
    expect(unplayableReason(G, FIXTURE_CARDS.test_action, self)).toBeNull();
  });

  it('a work box frees its slot at end of turn while a route keeps its own', () => {
    const G = blankState('test');
    G.resources.territory = 4;
    addWork(G, 'test_work');
    openTradeRoute(G, 'test_trade');
    expect(usedTerritory(G)).toBe(2);
    settleEndOfTurn(G);
    expect(usedTerritory(G)).toBe(1);
  });
});
