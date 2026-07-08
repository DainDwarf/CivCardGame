import { describe, it, expect } from 'vitest';
import { MISSIONS } from './missions';
import { CARDS } from './cards';
import {
  blankState,
  coreCollapse,
  dispatchEvent,
  instancesFromCardIds,
  objectiveFailed,
  objectiveMet,
  seedObjective,
} from '../rules';

// Win/lose now lives on each mission's objective *card* (`GameState.objective`), so these drive it
// through the same production path `run/engine.ts` uses: `seedObjective` then `objectiveMet`/
// `objectiveFailed` (which read the card's `objective.met`/`.failed` hook off `G`). Threat drains
// run through the per-round `endTurn` broadcast (`dispatchEvent` → `resolveEndTurn`), the same path
// upkeep uses.

describe('mission: enlightenment', () => {
  const m = MISSIONS.enlightenment;

  it('setup seeds the Stagnation deadline threat', () => {
    const G = blankState('enlightenment');
    m.setup!(G);
    expect(G.threats).toEqual([{ id: 1, cardId: 'enlightenment_deadline' }]);
  });

  // The objective owns the *win* only (30 Science); it never fails on its own.
  it('objective is met at 30 science, and never fails on its own (the threat owns the defeat)', () => {
    const G = blankState('enlightenment');
    seedObjective(G, m.objectiveCardId);
    G.resources.science = 30;
    expect(objectiveMet(G)).toBe(true);
    expect(objectiveFailed(G)).toBe(false);
  });

  // The threat owns the *lose* only — a pure deadline. It reads no Science: reaching 30 is the
  // objective's job, which `run/engine.ts`'s `checkEndIf` polls before `pendingDefeat`, so a won run
  // has already ended before this defeat could be read (the reconciliation lives in `checkEndIf`, not
  // in either card). These drive the threat directly via `dispatchEvent`, independent of Science.
  it('the deadline threat declares defeat once round 12 ends — regardless of Science', () => {
    const G = blankState('enlightenment');
    m.setup!(G);
    G.round = 12;
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.pendingDefeat).toEqual({ reason: 'stagnation' });
  });

  it('the deadline threat stays silent before round 12', () => {
    const G = blankState('enlightenment');
    m.setup!(G);
    G.round = 11;
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.pendingDefeat).toBeNull();
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
    dispatchEvent(G, { type: 'endTurn' });
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
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.production).toBe(9);
    dispatchEvent(G, { type: 'endTurn' });
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
