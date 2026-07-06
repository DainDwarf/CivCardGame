import { describe, it, expect } from 'vitest';
import { addThreat, tickThreats } from './threats';
import { nextInstanceId } from './population';
import { blankState } from './state';

describe('addThreat', () => {
  it('seeds a threat at level 0', () => {
    const G = blankState('enlightenment');
    addThreat(G, 'barbarian');
    expect(G.threats).toEqual([{ id: 1, cardId: 'barbarian', level: 0 }]);
  });

  it('shares the run-wide instance-id space', () => {
    const G = blankState('enlightenment');
    G.tableau = [{ id: 1, cardId: 'farm', workers: 1 }];
    addThreat(G, 'barbarian');
    expect(G.threats[0].id).toBe(2);
    expect(nextInstanceId(G)).toBe(3);
  });
});

describe('tickThreats', () => {
  it('deals no drain the round a threat is added (level 0)', () => {
    const G = blankState('enlightenment');
    G.resources.military = 10;
    addThreat(G, 'barbarian'); // barbarian's base loss is 4 military
    tickThreats(G);
    expect(G.resources.military).toBe(10);
    expect(G.threats[0].level).toBe(1);
  });

  it('drains baseLoss * level and escalates level after', () => {
    const G = blankState('enlightenment');
    G.resources.military = 10;
    G.threats = [{ id: 1, cardId: 'barbarian', level: 1 }];
    tickThreats(G);
    expect(G.resources.military).toBe(6); // 10 - 4*1
    expect(G.threats[0].level).toBe(2);

    tickThreats(G);
    expect(G.resources.military).toBe(-2); // 6 - 4*2, no clamp
    expect(G.threats[0].level).toBe(3);
  });

  it('is a no-op when there are no threats', () => {
    const G = blankState('enlightenment');
    G.resources.military = 5;
    tickThreats(G);
    expect(G.resources.military).toBe(5);
    expect(G.threats).toEqual([]);
  });
});
