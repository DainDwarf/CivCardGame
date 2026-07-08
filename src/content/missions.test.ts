import { describe, it, expect } from 'vitest';
import { MISSIONS } from './missions';
import { CARDS } from './cards';
import {
  blankState,
  coreCollapse,
  instancesFromCardIds,
  objectiveFailed,
  objectiveMet,
  seedObjective,
  tickThreats,
} from '../rules';

// Win/lose now lives on each mission's objective *card* (`GameState.objective`), so these drive it
// through the same production path `run/engine.ts` uses: `seedObjective` then `objectiveMet`/
// `objectiveFailed` (which read the card's `objective.met`/`.failed` hook off `G`).

describe('mission: enlightenment', () => {
  const m = MISSIONS.enlightenment;

  it('objective is met at 30 science', () => {
    const G = blankState('enlightenment');
    seedObjective(G, m.objectiveCardId);
    G.resources.science = 30;
    expect(objectiveMet(G)).toBe(true);
    expect(objectiveFailed(G)).toBe(false);
  });

  it('fails once round passes 12 short of the goal', () => {
    const G = blankState('enlightenment');
    seedObjective(G, m.objectiveCardId);
    G.round = 13;
    G.resources.science = 20;
    expect(objectiveFailed(G)).toBe(true);
  });
});

describe('mission: long_winter', () => {
  const m = MISSIONS.long_winter;

  it('setup seeds the Harsh Winter threat', () => {
    const G = blankState('long_winter');
    m.setup!(G);
    expect(G.threats).toEqual([{ id: 1, cardId: 'harsh_winter' }]);
  });

  it('has no per-round mission upkeep — the threat card itself drains', () => {
    expect(m.onUpkeep).toBeUndefined();
  });

  it('drains 2 food each upkeep tick via the seeded threat (famine itself is enforced globally, not by the mission)', () => {
    const G = blankState('long_winter');
    m.setup!(G);
    seedObjective(G, m.objectiveCardId);
    G.resources.food = 5;
    tickThreats(G);
    expect(G.resources.food).toBe(3);
    expect(objectiveFailed(G)).toBe(false);
  });

  it('objective is met after surviving 15 rounds', () => {
    const G = blankState('long_winter');
    seedObjective(G, m.objectiveCardId);
    G.round = 16;
    expect(objectiveMet(G)).toBe(true);
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
    seedObjective(G, m.objectiveCardId);
    G.removed = instancesFromCardIds(['barbarian', 'barbarian', 'barbarian']);
    G.resources.military = 5;
    expect(objectiveMet(G)).toBe(false); // only three beaten
    G.removed.push({ id: 4, cardId: 'barbarian' });
    expect(objectiveMet(G)).toBe(true); // four beaten, military >= 0
  });

  it('beating the fourth barbarian by going military-negative is a defeat, not a win', () => {
    const G = blankState('barbarian_tide');
    seedObjective(G, m.objectiveCardId);
    G.removed = instancesFromCardIds(['barbarian', 'barbarian', 'barbarian', 'barbarian']);
    G.resources.military = -1;
    expect(objectiveMet(G)).toBe(false); // the fatal blow doesn't count as survival
    expect(objectiveFailed(G)).toBe(false); // the objective owns no failure
    expect(coreCollapse(G.resources)).toBe('revolt'); // defeat comes from the universal core floor
  });
});

describe('mission: the_long_decline', () => {
  const m = MISSIONS.the_long_decline;

  it('is an infinite mission with no map/reward', () => {
    expect(m.kind).toBe('infinite');
    expect(m.reward).toBeUndefined();
    expect(m.map).toBeUndefined();
  });

  it('setup seeds the Creeping Decay threat', () => {
    const G = blankState('the_long_decline');
    m.setup!(G);
    expect(G.threats).toEqual([{ id: 1, cardId: 'creeping_decay' }]);
  });

  it('never wins on its own — objective and failure are both always false', () => {
    const G = blankState('the_long_decline');
    seedObjective(G, m.objectiveCardId);
    G.round = 999;
    G.resources.production = 999;
    expect(objectiveMet(G)).toBe(false);
    expect(objectiveFailed(G)).toBe(false);
  });

  it('the seeded threat escalates production loss round over round via the shared tick', () => {
    const G = blankState('the_long_decline');
    m.setup!(G);
    seedObjective(G, m.objectiveCardId);
    G.resources.production = 10;
    tickThreats(G);
    expect(G.resources.production).toBe(9);
    tickThreats(G);
    expect(G.resources.production).toBe(7);
    expect(objectiveFailed(G)).toBe(false); // the objective owns no failure — core collapse ends it
  });
});

describe('mission objective cards', () => {
  it('every mission names a real objective card that owns its win logic', () => {
    for (const m of Object.values(MISSIONS)) {
      const card = CARDS[m.objectiveCardId];
      expect(card, `${m.id} → ${m.objectiveCardId}`).toBeDefined();
      expect(card.kind).toBe('objective');
      expect(typeof card.objective?.met).toBe('function');
    }
  });
});
