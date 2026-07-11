import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  addBuilding,
  addWork,
  assignedWorkers,
  autoStaffCount,
  foodUpkeep,
  freePopulation,
  isOperating,
  nextInstanceId,
  producingUnits,
  workerCapOf,
} from './population';
import { blankState } from './state';
import { installFixtures, uninstallFixtures } from './testFixtures';

// `test_food`/`test_prod` are 1-worker producing buildings, `test_selfstaffed` a self-sufficient
// (workers:0) one, `test_multiworker` a 3-capacity per-worker one, and `test_work`/`test_work_food`
// 1-worker Work cards.
beforeAll(installFixtures);
afterAll(uninstallFixtures);

describe('worker capacity', () => {
  it('reads the card capacity; self-sufficient cards are 0, absent defaults to 1', () => {
    expect(workerCapOf({ id: 1, cardId: 'test_food', workers: 0 })).toBe(1);
    expect(workerCapOf({ id: 1, cardId: 'test_selfstaffed', workers: 0 })).toBe(0);
    expect(workerCapOf({ id: 1, cardId: 'test_multiworker', workers: 0 })).toBe(3);
  });

  it('a building operates once it has at least one worker; a self-sufficient one always operates', () => {
    expect(isOperating({ id: 1, cardId: 'test_food', workers: 0 })).toBe(false);
    expect(isOperating({ id: 1, cardId: 'test_food', workers: 1 })).toBe(true);
    expect(isOperating({ id: 1, cardId: 'test_selfstaffed', workers: 0 })).toBe(true); // needs none
  });

  it('a multi-worker building operates partially staffed (≥1 of its capacity)', () => {
    expect(isOperating({ id: 1, cardId: 'test_multiworker', workers: 0 })).toBe(false);
    expect(isOperating({ id: 1, cardId: 'test_multiworker', workers: 1 })).toBe(true);
    expect(isOperating({ id: 1, cardId: 'test_multiworker', workers: 3 })).toBe(true);
  });

  it('producingUnits is the staffed count, or 1 for a self-sufficient card', () => {
    expect(producingUnits({ id: 1, cardId: 'test_multiworker', workers: 0 })).toBe(0);
    expect(producingUnits({ id: 1, cardId: 'test_multiworker', workers: 2 })).toBe(2);
    expect(producingUnits({ id: 1, cardId: 'test_multiworker', workers: 3 })).toBe(3);
    expect(producingUnits({ id: 1, cardId: 'test_selfstaffed', workers: 0 })).toBe(1);
  });
});

describe('population accounting', () => {
  it('tracks assigned and free population', () => {
    const G = blankState('test');
    G.population = 3;
    G.tableau = [
      { id: 1, cardId: 'test_food', workers: 1 },
      { id: 2, cardId: 'test_prod', workers: 1 },
    ];
    expect(assignedWorkers(G.tableau)).toBe(2);
    expect(freePopulation(G)).toBe(1);
  });

  it('workers assigned to Work cards count against free population too', () => {
    const G = blankState('test');
    G.population = 3;
    G.tableau = [{ id: 1, cardId: 'test_food', workers: 1 }];
    G.workZone = [{ id: 2, cardId: 'test_work', workers: 1 }];
    expect(freePopulation(G)).toBe(1); // 3 - 1 building - 1 work
  });

  it('food upkeep equals population', () => {
    const G = blankState('test');
    G.population = 4;
    expect(foodUpkeep(G)).toBe(4);
  });
});

describe('auto-staffing a new building (partial fill)', () => {
  it('staffs a single-worker building when one is idle', () => {
    const G = blankState('test');
    G.population = 3; // all idle
    expect(autoStaffCount(G, 'test_food')).toBe(1); // capacity 1
  });

  it('leaves it unstaffed when none are idle', () => {
    const G = blankState('test');
    G.population = 1;
    G.tableau = [{ id: 1, cardId: 'test_food', workers: 1 }]; // 0 idle -> cannot staff
    expect(autoStaffCount(G, 'test_food')).toBe(0);
  });

  it('fills a multi-worker building to its capacity when enough are idle', () => {
    const G = blankState('test');
    G.population = 5; // all idle
    expect(autoStaffCount(G, 'test_multiworker')).toBe(3); // capacity 3
  });

  it('partial-fills a multi-worker building when fewer than its capacity are idle', () => {
    const G = blankState('test');
    G.population = 2; // all idle, under the capacity of 3
    expect(autoStaffCount(G, 'test_multiworker')).toBe(2);
  });

  it('self-sufficient buildings need no workers', () => {
    const G = blankState('test');
    G.population = 3;
    expect(autoStaffCount(G, 'test_selfstaffed')).toBe(0);
  });

  it("carries the played instance's stickers onto the new tableau instance", () => {
    const G = blankState('test');
    G.population = 1;
    addBuilding(G, 'test_food', ['test_addgain']);
    expect(G.tableau).toEqual([{ id: 1, cardId: 'test_food', workers: 1, stickers: ['test_addgain'] }]);
  });

  it('omits the stickers field entirely when the played instance carried none', () => {
    const G = blankState('test');
    G.population = 1;
    addBuilding(G, 'test_food');
    expect(G.tableau).toEqual([{ id: 1, cardId: 'test_food', workers: 1 }]);
  });
});

describe('Work cards as staffables', () => {
  it('a Work card has its card.workers as capacity (default 1) and operates once staffed', () => {
    expect(workerCapOf({ id: 1, cardId: 'test_work', workers: 0 })).toBe(1); // test_work has workers: 1
    expect(isOperating({ id: 1, cardId: 'test_work', workers: 0 })).toBe(false);
    expect(isOperating({ id: 1, cardId: 'test_work', workers: 1 })).toBe(true);
  });

  it('addWork sticks the card in the workZone, auto-staffed from idle pop', () => {
    const G = blankState('test');
    G.population = 1;
    addWork(G, 'test_work'); // 1 idle -> staffs its 1 worker
    expect(G.workZone).toEqual([{ id: 1, cardId: 'test_work', workers: 1 }]);
    expect(freePopulation(G)).toBe(0);
  });

  it('addWork leaves the box unstaffed when no idle workers are free', () => {
    const G = blankState('test');
    G.population = 0;
    addWork(G, 'test_work_food');
    expect(G.workZone).toEqual([{ id: 1, cardId: 'test_work_food', workers: 0 }]);
  });

  it("carries the played instance's stickers onto the new work box — otherwise a boosted Work card would silently lose its bonus the instant it's placed", () => {
    const G = blankState('test');
    G.population = 1;
    addWork(G, 'test_work', ['test_addgain']);
    expect(G.workZone).toEqual([{ id: 1, cardId: 'test_work', workers: 1, stickers: ['test_addgain'] }]);
  });

  it('instance ids are unique across the tableau and the workZone', () => {
    const G = blankState('test');
    G.tableau = [{ id: 1, cardId: 'test_food', workers: 1 }];
    G.workZone = [{ id: 2, cardId: 'test_work', workers: 0 }];
    expect(nextInstanceId(G)).toBe(3);
  });
});
