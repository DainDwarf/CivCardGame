import { describe, it, expect } from 'vitest';
import { MISSIONS } from './missions';
import { blankState, coreCollapse, instancesFromCardIds } from '../rules';

describe('mission: enlightenment', () => {
  const m = MISSIONS.enlightenment;

  it('objective is met at 30 science', () => {
    const G = blankState('enlightenment');
    G.resources.science = 30;
    expect(m.objective(G)).toBe(true);
    expect(m.failure(G)).toBe(false);
  });

  it('fails once round passes 12 short of the goal', () => {
    const G = blankState('enlightenment');
    G.round = 13;
    G.resources.science = 20;
    expect(m.failure(G)).toBe(true);
  });
});

describe('mission: long_winter', () => {
  const m = MISSIONS.long_winter;

  it('drains 2 food each upkeep (famine itself is enforced globally, not by the mission)', () => {
    const G = blankState('long_winter');
    G.resources.food = 5;
    m.onUpkeep!(G);
    expect(G.resources.food).toBe(3);
    expect(m.failure(G)).toBe(false);
  });

  it('objective is met after surviving 15 rounds', () => {
    const G = blankState('long_winter');
    G.round = 16;
    expect(m.objective(G)).toBe(true);
  });
});

describe('mission: barbarian_tide', () => {
  const m = MISSIONS.barbarian_tide;

  it('setup seeds four barbarian events into the deck and adds a garrison', () => {
    const G = blankState('barbarian_tide');
    const before = G.resources.military;
    m.setup!(G);
    expect(G.deck.filter((c) => c.cardId === 'barbarian').length).toBe(4);
    expect(G.resources.military).toBe(before + 4);
  });

  it('has no per-round upkeep — the barbarian cards themselves are the threat', () => {
    expect(m.onUpkeep).toBeUndefined();
  });

  it('objective needs all four barbarians beaten with military still standing', () => {
    const G = blankState('barbarian_tide');
    G.removed = instancesFromCardIds(['barbarian', 'barbarian', 'barbarian']);
    G.resources.military = 5;
    expect(m.objective(G)).toBe(false); // only three beaten
    G.removed.push({ id: 4, cardId: 'barbarian' });
    expect(m.objective(G)).toBe(true); // four beaten, military >= 0
  });

  it('beating the fourth barbarian by going military-negative is a defeat, not a win', () => {
    const G = blankState('barbarian_tide');
    G.removed = instancesFromCardIds(['barbarian', 'barbarian', 'barbarian', 'barbarian']);
    G.resources.military = -1;
    expect(m.objective(G)).toBe(false); // the fatal blow doesn't count as survival
    expect(m.failure(G)).toBe(false); // the mission owns no failure
    expect(coreCollapse(G.resources)).toBe('revolt'); // defeat comes from the universal core floor
  });
});
