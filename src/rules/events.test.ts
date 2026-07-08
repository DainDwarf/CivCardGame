import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { dispatchEvent, emitEvent, flushEvents, snapshot, MAX_EVENT_CASCADE } from './events';
import { applyUpkeep } from './upkeep';
import { gainResources } from './effects';
import { blankState, type GameState } from './state';
import { CARDS, type CardDef } from '../content/cards';

// Fixture cards exercising behaviours no shipped card has yet (self-removal, cascade, an unbounded
// self-emit, declare-defeat). Registered in the real CARDS catalogue for the test — the dispatcher
// looks cards up there — under `test_` ids that can't collide, and removed afterwards.
const FIXTURES: Record<string, CardDef> = {
  // A threat that retires itself the moment money reaches 30 — the ticket's on-threshold example.
  // Reassigns G.threats via filter (never splice), the self-removal footgun the docs call out.
  test_selfremove: {
    id: 'test_selfremove', name: 'Debt', kind: 'threat', cost: {},
    on: {
      resourceChange: ({ G, self }) => {
        if (G.resources.money >= 30) G.threats = G.threats.filter((t) => t.id !== self.id);
      },
    },
  },
  // On draw, emits a discard event — used to prove a handler-emitted event drains in the same flush.
  test_emit_on_draw: {
    id: 'test_emit_on_draw', name: 'Chainer', kind: 'building', cost: {}, workers: 0,
    on: {
      draw: ({ G }) => emitEvent(G, { type: 'discard', instanceId: 999, cardId: 'test_react_discard', reason: 'sacrifice' }),
    },
  },
  // Reacts to the round-start refill specifically (source === 'turnStart') — the negative-space partner
  // to Scriptorium, proving the draw source is dispatchable, not just filtered out.
  test_turnstart_only: {
    id: 'test_turnstart_only', name: 'Census', kind: 'building', cost: {}, workers: 0,
    on: {
      draw: (ctx) => {
        if (ctx.event?.type === 'draw' && ctx.event.source === 'turnStart') gainResources(ctx, { food: 1 });
      },
    },
  },
  // The other half of the cascade: reacts to its own discard (subject-triggered) with +5🔨.
  test_react_discard: {
    id: 'test_react_discard', name: 'Reactor', kind: 'action', cost: {},
    on: { discard: (ctx) => gainResources(ctx, { production: 5 }) },
  },
  // Every draw emits another draw — an unbounded self-emit, to prove the cascade cap terminates.
  test_infinite: {
    id: 'test_infinite', name: 'Loop', kind: 'building', cost: {}, workers: 0,
    on: {
      draw: ({ G }) => emitEvent(G, { type: 'draw', instanceId: 1, cardId: 'test_infinite', source: 'effect' }),
    },
  },
  // Declares defeat itself once money hits 30 — the bus capability behind "a threat owns its loss".
  test_declare_defeat: {
    id: 'test_declare_defeat', name: 'Doom', kind: 'threat', cost: {},
    on: {
      resourceChange: ({ G }) => {
        if (G.resources.money >= 30) G.pendingDefeat = { reason: 'the doom clock struck' };
      },
    },
  },
  // A self-sufficient Work card producing on the endTurn broadcast — proves the workZone is in the
  // observer walk (its output is the declarative `effect.gain`, like any staffed Work card).
  test_endturn_work: {
    id: 'test_endturn_work', name: 'Dig', kind: 'work', cost: {}, workers: 0,
    effect: { gain: { production: 1 } },
  },
  // Carries BOTH a passive `produces` and an explicit `on.endTurn`: the handler must win, proving
  // `resolveEndTurn` prefers an authored handler over the default production.
  test_endturn_override: {
    id: 'test_endturn_override', name: 'Override', kind: 'building', cost: {}, workers: 0,
    produces: { food: 9 },
    on: { endTurn: (ctx) => gainResources(ctx, { science: 7 }) },
  },
};

beforeAll(() => {
  for (const [id, def] of Object.entries(FIXTURES)) CARDS[id] = def;
});
afterAll(() => {
  for (const id of Object.keys(FIXTURES)) delete CARDS[id];
});

/** A blank state with an operating (staffed) Scriptorium on the tableau. */
function withScriptorium(stickers?: string[]): GameState {
  const G = blankState('enlightenment');
  G.tableau = [{ id: 1, cardId: 'scriptorium', workers: 1, ...(stickers ? { stickers } : {}) }];
  return G;
}

describe('emitEvent', () => {
  it('appends to the queue and runs no handler', () => {
    const G = withScriptorium();
    emitEvent(G, { type: 'draw', instanceId: 7, cardId: 'farm', source: 'effect' });
    expect(G.events).toHaveLength(1);
    expect(G.resources.money).toBe(0); // nothing dispatched yet
  });
});

describe('dispatchEvent — observer scope + staffing gate', () => {
  it('runs an on-draw observer on every operating tableau building', () => {
    const G = withScriptorium();
    dispatchEvent(G, { type: 'draw', instanceId: 7, cardId: 'farm', source: 'effect' });
    expect(G.resources.money).toBe(1);
  });

  it('skips an idle (understaffed) building — the same gate production applies', () => {
    const G = withScriptorium();
    G.tableau[0].workers = 0; // Scriptorium needs 1
    dispatchEvent(G, { type: 'draw', instanceId: 7, cardId: 'farm', source: 'effect' });
    expect(G.resources.money).toBe(0);
  });

  it('folds a handler gain through the copy stickers (Reinforced → +1 per key)', () => {
    const G = withScriptorium(['reinforced']);
    dispatchEvent(G, { type: 'draw', instanceId: 7, cardId: 'farm', source: 'effect' });
    expect(G.resources.money).toBe(2); // {money:1} reinforced to {money:2}
  });

  it('Scriptorium ignores a round-start (turnStart) draw — only effect-caused draws pay', () => {
    const G = withScriptorium();
    dispatchEvent(G, { type: 'draw', instanceId: 7, cardId: 'farm', source: 'turnStart' });
    expect(G.resources.money).toBe(0); // the refill does not pay
  });

  it('a handler can react to a turnStart draw specifically (source is dispatchable, not just filtered)', () => {
    const G = blankState('enlightenment');
    G.tableau = [{ id: 2, cardId: 'test_turnstart_only', workers: 0 }];
    dispatchEvent(G, { type: 'draw', instanceId: 7, cardId: 'farm', source: 'turnStart' });
    expect(G.resources.food).toBe(1);
    dispatchEvent(G, { type: 'draw', instanceId: 7, cardId: 'farm', source: 'effect' });
    expect(G.resources.food).toBe(1); // an effect draw does not
  });
});

describe('dispatchEvent — subject scope (self-triggered) + reason', () => {
  it("runs the discarded card's own on.discard when sacrificed", () => {
    const G = blankState('enlightenment');
    dispatchEvent(G, { type: 'discard', instanceId: 5, cardId: 'salvage', reason: 'sacrifice' });
    expect(G.resources.production).toBe(2);
  });

  it('no-ops for an end-of-turn recycle of the same card (reason preserved)', () => {
    const G = blankState('enlightenment');
    dispatchEvent(G, { type: 'discard', instanceId: 5, cardId: 'salvage', reason: 'endOfTurn' });
    expect(G.resources.production).toBe(0);
  });

  it('runs a subject that also sits on the board only once (dedup by id)', () => {
    // Scriptorium reacts to draws; place it and also name it as the draw subject → still one payout.
    const G = withScriptorium();
    dispatchEvent(G, { type: 'draw', instanceId: 1, cardId: 'scriptorium', source: 'effect' });
    expect(G.resources.money).toBe(1);
  });

  it('a building/work subject not in an operating zone slot does not self-trigger (staffing gate)', () => {
    // A freshly-drawn Scriptorium sits in hand, not the tableau — it is not an operating copy and
    // must not pay out on its own draw (the bug: it used to fire unconditionally as the subject).
    const G = blankState('enlightenment');
    dispatchEvent(G, { type: 'draw', instanceId: 1, cardId: 'scriptorium', source: 'effect' });
    expect(G.resources.money).toBe(0);
  });

  it('a building/work subject in the tableau but understaffed does not self-trigger', () => {
    const G = withScriptorium();
    G.tableau[0].workers = 0; // Scriptorium needs 1
    dispatchEvent(G, { type: 'draw', instanceId: 1, cardId: 'scriptorium', source: 'effect' });
    expect(G.resources.money).toBe(0);
  });
});

describe('dispatchEvent — endTurn broadcast (production + threat drains)', () => {
  it('a staffed building produces on endTurn', () => {
    const G = blankState('enlightenment');
    G.tableau = [{ id: 1, cardId: 'farm', workers: 1 }];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.food).toBe(2);
  });

  it('an idle (unstaffed) building produces nothing on endTurn', () => {
    const G = blankState('enlightenment');
    G.tableau = [{ id: 1, cardId: 'farm', workers: 0 }]; // farm needs 1
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.food).toBe(0);
  });

  it('a threat drains on endTurn through its own resolveCard spine', () => {
    const G = blankState('long_winter');
    G.resources.food = 5;
    G.threats = [{ id: 1, cardId: 'harsh_winter' }];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.food).toBe(3);
  });

  it('an operating Work card produces on endTurn (the workZone is in the observer walk)', () => {
    const G = blankState('enlightenment');
    G.workZone = [{ id: 1, cardId: 'test_endturn_work', workers: 0 }]; // self-sufficient → operating
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.production).toBe(1);
  });

  it('an explicit on.endTurn handler overrides the default production', () => {
    const G = blankState('enlightenment');
    G.tableau = [{ id: 1, cardId: 'test_endturn_override', workers: 0 }];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.science).toBe(7); // the authored handler ran
    expect(G.resources.food).toBe(0); // ...instead of the passive `produces: { food: 9 }`
  });

  it('Treasury pays out once off endTurn-driven production in a full upkeep', () => {
    // The load-bearing case: production runs via the endTurn broadcast, then flushEvents synthesizes
    // the round's resourceChange — so a staffed Market pushing money past 10 must still trip Treasury.
    const G = blankState('enlightenment');
    G.resources.money = 8;
    G.tableau = [
      { id: 1, cardId: 'market', workers: 1 }, // +2 money on endTurn → crosses 10
      { id: 2, cardId: 'treasury', workers: 1 },
    ];
    applyUpkeep(G);
    expect(G.resources.money).toBe(10);
    expect(G.resources.science).toBe(5); // Treasury's one-time payout
    expect(G.tableau[1].counters).toEqual({ fired: 1 });
    expect(G.events).toEqual([]); // drained
  });
});

describe('flushEvents — resourceChange synthesis', () => {
  it('synthesizes a resourceChange only when a value field actually moved', () => {
    const G = blankState('enlightenment');
    G.threats = [{ id: 1, cardId: 'test_declare_defeat' }];
    const before = snapshot(G); // money 0
    // No change → no resourceChange → handler never sees the threshold.
    flushEvents(G, before);
    expect(G.pendingDefeat).toBeFalsy();
    // Now cross the threshold and flush against the old snapshot.
    G.resources.money = 30;
    flushEvents(G, before);
    expect(G.pendingDefeat).toEqual({ reason: 'the doom clock struck' });
  });

  it('Treasury fires on the exact 10-crossing, once per copy, using the before-snapshot', () => {
    const G = blankState('enlightenment');
    G.tableau = [{ id: 1, cardId: 'treasury', workers: 1 }];
    const before = snapshot(G); // money 0
    G.resources.money = 15;
    flushEvents(G, before);
    expect(G.resources.science).toBe(5);
    expect(G.tableau[0].counters).toEqual({ fired: 1 });
    // Cross again on a later boundary → the per-copy `fired` flag blocks a second payout.
    G.resources.money = 5;
    const before2 = snapshot(G);
    G.resources.money = 20;
    flushEvents(G, before2);
    expect(G.resources.science).toBe(5); // unchanged
  });

  it('drains the queue to [] and clears the flag it upheld', () => {
    const G = withScriptorium();
    emitEvent(G, { type: 'draw', instanceId: 7, cardId: 'farm', source: 'effect' });
    flushEvents(G, snapshot(G));
    expect(G.events).toEqual([]);
    expect(G.resources.money).toBe(1);
  });
});

describe('flushEvents — cascade + cap', () => {
  it('drains a handler-emitted event in the same flush', () => {
    const G = blankState('enlightenment');
    G.tableau = [{ id: 1, cardId: 'test_emit_on_draw', workers: 0 }]; // self-sufficient (workers:0)
    emitEvent(G, { type: 'draw', instanceId: 7, cardId: 'farm', source: 'effect' });
    flushEvents(G, snapshot(G));
    // draw → Chainer emits a discard → Reactor's on.discard fires (+5🔨), all in one flush.
    expect(G.resources.production).toBe(5);
    expect(G.events).toEqual([]);
  });

  it('terminates an unbounded self-emit at the cap and still drains to []', () => {
    const G = blankState('enlightenment');
    G.tableau = [{ id: 1, cardId: 'test_infinite', workers: 0 }];
    emitEvent(G, { type: 'draw', instanceId: 1, cardId: 'test_infinite', source: 'effect' });
    flushEvents(G, snapshot(G));
    expect(G.events).toEqual([]); // did not hang; remainder dropped past MAX_EVENT_CASCADE
    expect(MAX_EVENT_CASCADE).toBeGreaterThan(0);
  });
});

describe('self-removal via filter', () => {
  it('a threat can retire itself on a threshold, leaving the threat loop intact', () => {
    const G = blankState('enlightenment');
    G.threats = [
      { id: 1, cardId: 'test_selfremove' },
      { id: 2, cardId: 'harsh_winter' },
    ];
    const before = snapshot(G);
    G.resources.money = 30;
    flushEvents(G, before);
    expect(G.threats.map((t) => t.id)).toEqual([2]); // Debt gone, the other threat untouched
  });
});

describe('committed-state invariant', () => {
  it('a blank state carries an empty queue and survives structuredClone', () => {
    const G = blankState('enlightenment');
    expect(G.events).toEqual([]);
    expect(structuredClone(G).events).toEqual([]);
  });
});
