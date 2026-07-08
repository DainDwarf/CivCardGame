import { describe, it, expect } from 'vitest';
import { MISSIONS } from './missions';
import { CARDS } from './cards';
import {
  blankState,
  coreCollapse,
  dispatchEvent,
  evaluateObjective,
  flushEvents,
  instancesFromCardIds,
  objectiveMet,
  seedObjective,
  snapshot,
} from '../rules';

// Win now lives on each mission's objective *card* (`GameState.objective`): `objectiveMet` reads the
// card's `objective` predicate off `G`, and the bus re-derives it into `G.pendingVictory` at every
// `flushEvents` boundary (`evaluateObjective`) — the flag `run/engine.ts`'s `checkEndIf` reads. Defeat
// is a threat's job: threat drains and deadline losses run through the per-round `endTurn` broadcast
// (`dispatchEvent` → `resolveEndTurn`), the same path upkeep uses. These drive both directly.

describe('mission: enlightenment', () => {
  const m = MISSIONS.enlightenment;

  it('setup seeds the Stagnation deadline threat', () => {
    const G = blankState('enlightenment');
    m.setup!(G);
    expect(G.threats).toEqual([{ id: 1, cardId: 'enlightenment_deadline' }]);
  });

  // The objective owns the *win* only (30 Science); defeat is the threat's job.
  it('objective is met at 30 science', () => {
    const G = blankState('enlightenment');
    seedObjective(G, m.objectiveCardId);
    G.resources.science = 30;
    expect(objectiveMet(G)).toBe(true);
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

  it('never wins on its own — the objective is always unmet', () => {
    const G = blankState('the_long_decline');
    seedObjective(G, m.objectiveCardId);
    G.round = 999;
    G.resources.production = 999;
    expect(objectiveMet(G)).toBe(false);
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
    expect(objectiveMet(G)).toBe(false); // the objective never wins — core collapse ends this mission
  });
});

describe('objective win flag is bus-driven', () => {
  // The win no longer polls per-move: `evaluateObjective` re-derives `G.pendingVictory` from the
  // card's `objective` predicate, and `flushEvents` calls it at every step boundary — so the flag is fresh
  // before every `checkEndIf`, even on a flush that dispatched no events.
  it('flushEvents re-derives G.pendingVictory from the objective card, on an eventless flush', () => {
    const G = blankState('enlightenment');
    seedObjective(G, MISSIONS.enlightenment.objectiveCardId);
    G.resources.science = 29;
    flushEvents(G, snapshot(G)); // no value moved since the snapshot → no events, but still re-derives
    expect(G.pendingVictory).toBe(false); // short of 30
    G.resources.science = 30;
    flushEvents(G, snapshot(G));
    expect(G.pendingVictory).toBe(true); // threshold crossed → flag set at the flush
  });

  it('set-or-clear (never sticky): the flag reverts when the verdict does', () => {
    const G = blankState('barbarian_tide');
    seedObjective(G, MISSIONS.barbarian_tide.objectiveCardId);
    G.removed = instancesFromCardIds(['barbarian', 'barbarian', 'barbarian', 'barbarian']);
    G.resources.military = 5;
    evaluateObjective(G);
    expect(G.pendingVictory).toBe(true); // four beaten, military intact
    G.resources.military = -1; // the same resolve's fatal blow drives military negative
    evaluateObjective(G);
    expect(G.pendingVictory).toBe(false); // reverted — core collapse ends it, not a win
  });

  it('leaves pendingVictory false when no objective is seeded', () => {
    const G = blankState('enlightenment');
    flushEvents(G, snapshot(G));
    expect(G.pendingVictory).toBe(false);
  });
});

describe('mission objective cards', () => {
  it('every mission names a real objective card that owns its win logic', () => {
    for (const m of Object.values(MISSIONS)) {
      const card = CARDS[m.objectiveCardId];
      expect(card, `${m.id} → ${m.objectiveCardId}`).toBeDefined();
      expect(card.kind).toBe('objective');
      expect(typeof card.objective).toBe('function');
    }
  });
});
