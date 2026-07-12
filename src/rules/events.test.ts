import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { dispatchEvent, emitEvent, flushEvents, snapshot, MAX_EVENT_CASCADE } from './events';
import { applyUpkeep } from './upkeep';
import { drawUpTo } from './deck';
import { gainResources } from './effects';
import { blankState, instancesFromCardIds, type GameState } from './state';
import type { CardDef } from '../content/cards';
import { installFixtures, uninstallFixtures, installCards, uninstallCards } from './testFixtures';

// Event-bus behaviours no shared fixture covers (self-removal, cascade, an unbounded self-emit, an
// on-draw/on-discard observer, an endTurn override) live here as *local* fixtures, layered on the
// shared set via `installCards` — they're exercised only by this suite, so they don't belong in
// `testFixtures.ts`. Registered under `test_*` ids that can't collide; removed afterwards.
const LOCAL: Record<string, CardDef> = {
  // A threat that retires itself the moment money reaches 30 — the on-threshold example. Reassigns
  // G.threats via filter (never splice), the self-removal footgun the docs call out.
  test_selfremove: {
    id: 'test_selfremove', name: 'Debt', kind: 'threat', cost: {},
    on: {
      resourceChange: ({ G, self }) => {
        if (G.resources.money >= 30) G.threats = G.threats.filter((t) => t.id !== self.id);
      },
    },
  },
  // Observer of the on-draw event: while operating, gains money each time an effect draws a card —
  // *not* the routine round-start refill (it filters on the draw's `source`). A building with no
  // passive `produces`: its whole output is the reaction (an on-draw observer).
  test_observer: {
    id: 'test_observer', name: 'Observer', kind: 'building', cost: {}, workers: 1,
    on: {
      draw: (ctx) => {
        if (ctx.event?.type === 'draw' && ctx.event.source === 'effect') gainResources(ctx, { money: 1 });
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
  // to the observer, proving the draw source is dispatchable, not just filtered out.
  test_turnstart_only: {
    id: 'test_turnstart_only', name: 'Census', kind: 'building', cost: {}, workers: 0,
    on: {
      draw: (ctx) => {
        if (ctx.event?.type === 'draw' && ctx.event.source === 'turnStart') gainResources(ctx, { food: 1 });
      },
    },
  },
  // Reacts to *its own* discard, but only a sacrifice (a discard-cost cost), not the routine
  // end-of-turn recycle — the reason rides on the event (like Salvage). +2🔨.
  test_react_discard: {
    id: 'test_react_discard', name: 'Reactor', kind: 'action', cost: {},
    on: { discard: (ctx) => { if (ctx.event?.type === 'discard' && ctx.event.reason === 'sacrifice') gainResources(ctx, { production: 2 }); } },
  },
  // Every draw emits another draw — an unbounded self-emit, to prove the cascade cap terminates.
  test_infinite: {
    id: 'test_infinite', name: 'Loop', kind: 'building', cost: {}, workers: 0,
    on: {
      draw: ({ G }) => emitEvent(G, { type: 'draw', instanceId: 1, cardId: 'test_infinite', source: 'effect' }),
    },
  },
  // A threat that declares defeat once money hits 30 — the pure-predicate capability behind "a threat
  // owns its own driven loss" (`CardDef.defeat`, re-derived by `evaluateDefeat`).
  test_declare_defeat: {
    id: 'test_declare_defeat', name: 'Doom', kind: 'threat', cost: {},
    defeat: (G) => G.resources.money >= 30 && 'the doom clock struck',
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
  installFixtures();
  installCards(LOCAL);
});
afterAll(() => {
  uninstallCards(LOCAL);
  uninstallFixtures();
});

/** A blank state with an operating (staffed) on-draw observer on the tableau. */
function withObserver(stickers?: string[]): GameState {
  const G = blankState('test');
  G.tableau = [{ id: 1, cardId: 'test_observer', workers: 1, ...(stickers ? { stickers } : {}) }];
  return G;
}

describe('emitEvent', () => {
  it('appends to the queue and runs no handler', () => {
    const G = withObserver();
    emitEvent(G, { type: 'draw', instanceId: 7, cardId: 'test_food', source: 'effect' });
    expect(G.events).toHaveLength(1);
    expect(G.resources.money).toBe(0); // nothing dispatched yet
  });
});

describe('dispatchEvent — observer scope + staffing gate', () => {
  it('runs an on-draw observer on every operating tableau building', () => {
    const G = withObserver();
    dispatchEvent(G, { type: 'draw', instanceId: 7, cardId: 'test_food', source: 'effect' });
    expect(G.resources.money).toBe(1);
  });

  it('skips an idle (understaffed) building — the same gate production applies', () => {
    const G = withObserver();
    G.tableau[0].workers = 0; // the observer needs 1
    dispatchEvent(G, { type: 'draw', instanceId: 7, cardId: 'test_food', source: 'effect' });
    expect(G.resources.money).toBe(0);
  });

  it('folds a handler gain through the copy stickers (+1 per key)', () => {
    const G = withObserver(['test_addgain']);
    dispatchEvent(G, { type: 'draw', instanceId: 7, cardId: 'test_food', source: 'effect' });
    expect(G.resources.money).toBe(2); // {money:1} boosted to {money:2}
  });

  it('the observer ignores a round-start (turnStart) draw — only effect-caused draws pay', () => {
    const G = withObserver();
    dispatchEvent(G, { type: 'draw', instanceId: 7, cardId: 'test_food', source: 'turnStart' });
    expect(G.resources.money).toBe(0); // the refill does not pay
  });

  it('a handler can react to a turnStart draw specifically (source is dispatchable, not just filtered)', () => {
    const G = blankState('test');
    G.tableau = [{ id: 2, cardId: 'test_turnstart_only', workers: 0 }];
    dispatchEvent(G, { type: 'draw', instanceId: 7, cardId: 'test_food', source: 'turnStart' });
    expect(G.resources.food).toBe(1);
    dispatchEvent(G, { type: 'draw', instanceId: 7, cardId: 'test_food', source: 'effect' });
    expect(G.resources.food).toBe(1); // an effect draw does not
  });
});

describe('dispatchEvent — subject scope (self-triggered) + reason', () => {
  it("runs the discarded card's own on.discard when sacrificed", () => {
    const G = blankState('test');
    dispatchEvent(G, { type: 'discard', instanceId: 5, cardId: 'test_react_discard', reason: 'sacrifice' });
    expect(G.resources.production).toBe(2);
  });

  it('no-ops for an end-of-turn recycle of the same card (reason preserved)', () => {
    const G = blankState('test');
    dispatchEvent(G, { type: 'discard', instanceId: 5, cardId: 'test_react_discard', reason: 'endOfTurn' });
    expect(G.resources.production).toBe(0);
  });

  it('runs a subject that also sits on the board only once (dedup by id)', () => {
    // The observer reacts to draws; place it and also name it as the draw subject → still one payout.
    const G = withObserver();
    dispatchEvent(G, { type: 'draw', instanceId: 1, cardId: 'test_observer', source: 'effect' });
    expect(G.resources.money).toBe(1);
  });

  it('a building/work subject not in an operating zone slot does not self-trigger (staffing gate)', () => {
    // A freshly-drawn observer sits in hand, not the tableau — it is not an operating copy and must
    // not pay out on its own draw (the bug: it used to fire unconditionally as the subject).
    const G = blankState('test');
    dispatchEvent(G, { type: 'draw', instanceId: 1, cardId: 'test_observer', source: 'effect' });
    expect(G.resources.money).toBe(0);
  });

  it('a building/work subject in the tableau but understaffed does not self-trigger', () => {
    const G = withObserver();
    G.tableau[0].workers = 0; // the observer needs 1
    dispatchEvent(G, { type: 'draw', instanceId: 1, cardId: 'test_observer', source: 'effect' });
    expect(G.resources.money).toBe(0);
  });

  it('folds a purchased sticker through a self-triggered (subject) handler, not just the observer walk', () => {
    // The card is filed to discard (as a real leaf site does) carrying its sticker before the event
    // dispatches — the subject path must resolve to that live copy, not a bare {id, cardId}.
    const G = blankState('test');
    G.discard = [{ id: 5, cardId: 'test_react_discard', stickers: ['test_addgain'] }];
    dispatchEvent(G, { type: 'discard', instanceId: 5, cardId: 'test_react_discard', reason: 'sacrifice' });
    expect(G.resources.production).toBe(3); // base +2, +1 per key
  });
});

describe('dispatchEvent — endTurn broadcast (production + threat drains)', () => {
  it('a staffed building produces on endTurn', () => {
    const G = blankState('test');
    G.tableau = [{ id: 1, cardId: 'test_food', workers: 1 }];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.food).toBe(2);
  });

  it('an idle (unstaffed) building produces nothing on endTurn', () => {
    const G = blankState('test');
    G.tableau = [{ id: 1, cardId: 'test_food', workers: 0 }]; // needs 1
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.food).toBe(0);
  });

  it('a threat drains on endTurn through its own resolveCard spine', () => {
    const G = blankState('test');
    G.resources.food = 5;
    G.threats = [{ id: 1, cardId: 'test_threat' }];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.food).toBe(3);
  });

  it('an operating Work card produces on endTurn (the workZone is in the observer walk)', () => {
    const G = blankState('test');
    G.workZone = [{ id: 1, cardId: 'test_work', workers: 1 }];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.production).toBe(3);
  });

  it('an explicit on.endTurn handler overrides the default production', () => {
    const G = blankState('test');
    G.tableau = [{ id: 1, cardId: 'test_endturn_override', workers: 0 }];
    dispatchEvent(G, { type: 'endTurn' });
    expect(G.resources.science).toBe(7); // the authored handler ran
    expect(G.resources.food).toBe(0); // ...instead of the passive `produces: { food: 9 }`
  });

  it('a threshold observer pays out once off endTurn-driven production in a full upkeep', () => {
    // The load-bearing case: production runs via the endTurn broadcast, then flushEvents synthesizes
    // the round's resourceChange — so a staffed money building pushing money past 10 must still trip it.
    const G = blankState('test');
    G.resources.money = 8;
    G.tableau = [
      { id: 1, cardId: 'test_money', workers: 1 }, // +2 money on endTurn → crosses 10
      { id: 2, cardId: 'test_threshold', workers: 1 },
    ];
    applyUpkeep(G);
    expect(G.resources.money).toBe(10);
    expect(G.resources.science).toBe(5); // the threshold observer's one-time payout
    expect(G.tableau[1].counters).toEqual({ fired: 1 });
    expect(G.events).toEqual([]); // drained
  });
});

describe('dispatchEvent — reshuffle broadcast (subject-less, on.reshuffle only)', () => {
  // The real `unrest` threat drains 1🪙 per 🧍 on every reshuffle — the mechanic Step 6.5 introduces.
  it('reaches a threat with on.reshuffle, draining 1🪙 per population point', () => {
    const G = blankState('test');
    G.resources.population = 3;
    G.resources.money = 10;
    G.threats = [{ id: 1, cardId: 'unrest' }];
    dispatchEvent(G, { type: 'reshuffle' });
    expect(G.resources.money).toBe(7); // −3 (one reshuffle × pop 3)
  });

  it('does not fire a card with no on.reshuffle handler (no default reshuffle behaviour)', () => {
    const G = blankState('test');
    G.tableau = [{ id: 1, cardId: 'test_food', workers: 1 }]; // a plain producer, no on.reshuffle
    dispatchEvent(G, { type: 'reshuffle' });
    expect(G.resources.food).toBe(0); // production runs on endTurn, not reshuffle
  });

  it('drives the Unrest drain end-to-end: a deck fold emits the event, the flush drains 🪙', () => {
    const G = blankState('test');
    G.resources.population = 2;
    G.resources.money = 5;
    G.threats = [{ id: 1, cardId: 'unrest' }];
    G.handSize = 1;
    G.deck = [];
    G.discard = instancesFromCardIds(['test_food', 'test_prod']);
    const before = snapshot(G);
    drawUpTo(G); // deck empty → reshuffle → emits a reshuffle event
    flushEvents(G, before);
    expect(G.resources.money).toBe(3); // one reshuffle × pop 2
    expect(G.events).toEqual([]); // drained
  });
});

describe('flushEvents — defeat re-derivation (evaluateDefeat)', () => {
  // `defeat` is a pure predicate (`CardDef.defeat`), re-derived from scratch by `evaluateDefeat` at
  // every flush — never a handler pushing `G.pendingDefeat` mid-dispatch off a transient snapshot.
  it("sets G.pendingDefeat once a threat's own defeat predicate is met", () => {
    const G = blankState('test');
    G.threats = [{ id: 1, cardId: 'test_declare_defeat' }];
    G.resources.money = 29;
    flushEvents(G, snapshot(G));
    expect(G.pendingDefeat).toBeFalsy();
    G.resources.money = 30;
    flushEvents(G, snapshot(G));
    expect(G.pendingDefeat).toEqual({ reason: 'the doom clock struck' });
  });

  // A set-only `pendingDefeat` (a handler writing it directly) would survive the condition recovering,
  // since nothing ever cleared it — the false-defeat trap `checkEndIf` could then wrongly act on.
  // `evaluateDefeat` re-derives the flag from live state every flush instead, the same set-OR-CLEAR
  // shape `evaluateObjective` uses for `pendingVictory`, so a dip that recovers before the next flush
  // can't leave a stale flag behind.
  it('clears G.pendingDefeat once the condition that set it recovers — never sticky', () => {
    const G = blankState('test');
    G.threats = [{ id: 1, cardId: 'test_declare_defeat' }];
    G.resources.money = 30;
    flushEvents(G, snapshot(G));
    expect(G.pendingDefeat).toEqual({ reason: 'the doom clock struck' });
    G.resources.money = 29; // the dip recovers before the next flush
    flushEvents(G, snapshot(G));
    expect(G.pendingDefeat).toBeFalsy();
  });
});

describe('flushEvents — resourceChange synthesis', () => {
  it('the threshold observer fires on the exact 10-crossing, once per copy, using the before-snapshot', () => {
    const G = blankState('test');
    G.tableau = [{ id: 1, cardId: 'test_threshold', workers: 1 }];
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
    const G = withObserver();
    emitEvent(G, { type: 'draw', instanceId: 7, cardId: 'test_food', source: 'effect' });
    flushEvents(G, snapshot(G));
    expect(G.events).toEqual([]);
    expect(G.resources.money).toBe(1);
  });
});

describe('flushEvents — cascade + cap', () => {
  it('drains a handler-emitted event in the same flush', () => {
    const G = blankState('test');
    G.tableau = [{ id: 1, cardId: 'test_emit_on_draw', workers: 0 }]; // self-sufficient (workers:0)
    emitEvent(G, { type: 'draw', instanceId: 7, cardId: 'test_food', source: 'effect' });
    flushEvents(G, snapshot(G));
    // draw → Chainer emits a discard → Reactor's on.discard fires (+2🔨), all in one flush.
    expect(G.resources.production).toBe(2);
    expect(G.events).toEqual([]);
  });

  it('terminates an unbounded self-emit at the cap and still drains to []', () => {
    const G = blankState('test');
    G.tableau = [{ id: 1, cardId: 'test_infinite', workers: 0 }];
    emitEvent(G, { type: 'draw', instanceId: 1, cardId: 'test_infinite', source: 'effect' });
    flushEvents(G, snapshot(G));
    expect(G.events).toEqual([]); // did not hang; remainder dropped past MAX_EVENT_CASCADE
    expect(MAX_EVENT_CASCADE).toBeGreaterThan(0);
  });
});

describe('self-removal via filter', () => {
  it('a threat can retire itself on a threshold, leaving the threat loop intact', () => {
    const G = blankState('test');
    G.threats = [
      { id: 1, cardId: 'test_selfremove' },
      { id: 2, cardId: 'test_threat' },
    ];
    const before = snapshot(G);
    G.resources.money = 30;
    flushEvents(G, before);
    expect(G.threats.map((t) => t.id)).toEqual([2]); // Debt gone, the other threat untouched
  });
});

describe('committed-state invariant', () => {
  it('a blank state carries an empty queue and survives structuredClone', () => {
    const G = blankState('test');
    expect(G.events).toEqual([]);
    expect(structuredClone(G).events).toEqual([]);
  });
});
