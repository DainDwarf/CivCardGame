import { describe, it, expect } from 'vitest';
import {
  assignedWorkers,
  foodUpkeep,
  freePopulation,
  isOperating,
  requiredWorkers,
} from './population';
import { blankState } from './state';

describe('worker requirements', () => {
  it('producing buildings need a worker; walls are self-sufficient', () => {
    expect(requiredWorkers('farm')).toBe(1);
    expect(requiredWorkers('walls')).toBe(0);
  });

  it('a building operates only when staffed to its requirement', () => {
    expect(isOperating({ cardId: 'farm', workers: 0 })).toBe(false);
    expect(isOperating({ cardId: 'farm', workers: 1 })).toBe(true);
    expect(isOperating({ cardId: 'walls', workers: 0 })).toBe(true); // needs none
  });
});

describe('population accounting', () => {
  it('tracks assigned and free population', () => {
    const G = blankState('enlightenment');
    G.population = 3;
    G.tableau = [
      { cardId: 'farm', workers: 1 },
      { cardId: 'workshop', workers: 1 },
    ];
    expect(assignedWorkers(G.tableau)).toBe(2);
    expect(freePopulation(G)).toBe(1);
  });

  it('food upkeep equals population', () => {
    const G = blankState('enlightenment');
    G.population = 4;
    expect(foodUpkeep(G)).toBe(4);
  });
});
