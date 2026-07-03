import { describe, it, expect } from 'vitest';
import {
  addWork,
  assignedWorkers,
  autoStaffCount,
  foodUpkeep,
  freePopulation,
  isOperating,
  nextInstanceId,
  requiredWorkersOf,
} from './population';
import { blankState } from './state';

describe('worker requirements', () => {
  it('producing buildings need a worker; walls are self-sufficient', () => {
    expect(requiredWorkersOf({ id: 1, cardId: 'farm', workers: 0 })).toBe(1);
    expect(requiredWorkersOf({ id: 1, cardId: 'walls', workers: 0 })).toBe(0);
  });

  it('a building operates only when staffed to its requirement', () => {
    expect(isOperating({ id: 1, cardId: 'farm', workers: 0 })).toBe(false);
    expect(isOperating({ id: 1, cardId: 'farm', workers: 1 })).toBe(true);
    expect(isOperating({ id: 1, cardId: 'walls', workers: 0 })).toBe(true); // needs none
  });
});

describe('population accounting', () => {
  it('tracks assigned and free population', () => {
    const G = blankState('enlightenment');
    G.population = 3;
    G.tableau = [
      { id: 1, cardId: 'farm', workers: 1 },
      { id: 2, cardId: 'workshop', workers: 1 },
    ];
    expect(assignedWorkers(G.tableau)).toBe(2);
    expect(freePopulation(G)).toBe(1);
  });

  it('workers assigned to Work cards count against free population too', () => {
    const G = blankState('enlightenment');
    G.population = 3;
    G.tableau = [{ id: 1, cardId: 'farm', workers: 1 }];
    G.workZone = [{ id: 2, cardId: 'corvee', workers: 1 }];
    expect(freePopulation(G)).toBe(1); // 3 - 1 building - 1 work
  });

  it('food upkeep equals population', () => {
    const G = blankState('enlightenment');
    G.population = 4;
    expect(foodUpkeep(G)).toBe(4);
  });
});

describe('auto-staffing a new building (all-or-nothing)', () => {
  it('fully staffs a building when enough are idle', () => {
    const G = blankState('enlightenment');
    G.population = 3; // all idle
    expect(autoStaffCount(G, 'farm')).toBe(1); // farm needs 1
  });

  it('leaves it unstaffed unless its full requirement can be met', () => {
    const G = blankState('enlightenment');
    G.population = 1;
    G.tableau = [{ id: 1, cardId: 'farm', workers: 1 }]; // 0 idle -> cannot staff
    expect(autoStaffCount(G, 'farm')).toBe(0);
  });

  it('self-sufficient buildings need no workers', () => {
    const G = blankState('enlightenment');
    G.population = 3;
    expect(autoStaffCount(G, 'walls')).toBe(0);
  });
});

describe('Work cards as staffables', () => {
  it('a Work card requires its card.workers (default 1) and operates only when staffed', () => {
    expect(requiredWorkersOf({ id: 1, cardId: 'corvee', workers: 0 })).toBe(1); // corvee has workers: 1
    expect(isOperating({ id: 1, cardId: 'corvee', workers: 0 })).toBe(false);
    expect(isOperating({ id: 1, cardId: 'corvee', workers: 1 })).toBe(true);
  });

  it('addWork sticks the card in the workZone, auto-staffed all-or-nothing from idle pop', () => {
    const G = blankState('enlightenment');
    G.population = 1;
    addWork(G, 'corvee'); // 1 idle -> staffs its 1 worker
    expect(G.workZone).toEqual([{ id: 1, cardId: 'corvee', workers: 1 }]);
    expect(freePopulation(G)).toBe(0);
  });

  it('addWork leaves the box unstaffed when no idle workers are free', () => {
    const G = blankState('enlightenment');
    G.population = 0;
    addWork(G, 'harvest');
    expect(G.workZone).toEqual([{ id: 1, cardId: 'harvest', workers: 0 }]);
  });

  it('instance ids are unique across the tableau and the workZone', () => {
    const G = blankState('enlightenment');
    G.tableau = [{ id: 1, cardId: 'farm', workers: 1 }];
    G.workZone = [{ id: 2, cardId: 'corvee', workers: 0 }];
    expect(nextInstanceId(G)).toBe(3);
  });
});
