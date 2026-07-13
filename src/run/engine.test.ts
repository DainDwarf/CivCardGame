import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRun, endTurn, applyMove, type RunState } from './engine';
import { instancesFromCardIds, seedObjective } from '../rules';
import { gainResources } from '../rules/effects';
import { playCard } from './moves';
import type { RunConfig } from '../contract';
import type { CardDef } from '../content/cards';
import { TEST_BOARD_ID, installFixtures, uninstallFixtures, installCards, uninstallCards } from '../rules/testFixtures';

// This file drives the *real* turn loop, so win/loss needs a seeded objective/threat. Rather than a
// synthetic mission in MISSIONS, we seed `G.objective`/`G.threats` by hand after `createRun` (exactly
// as these tests already set `G.tableau`/`G.hand` by hand) — the loop then reads them normally. Local
// fixtures cover the shapes no shared fixture has: an on-draw observer, an event-count survival
// objective, and a round-based objective.
const LOCAL: Record<string, CardDef> = {
  // On-draw observer: while staffed, pays +1💰 per effect-caused draw, never the
  // round-start refill.
  test_observer: {
    id: 'test_observer', name: 'Observer', kind: 'building', cost: {}, workers: 1,
    on: {
      draw: {
        resolve: (ctx) => {
          if (ctx.event?.type === 'draw' && ctx.event.source === 'effect') gainResources(ctx, { money: 1 });
        },
      },
    },
  },
  // Survival objective: win once ≥2 events have been beaten (exiled to `removed`) with Military intact.
  test_survive_obj: {
    id: 'test_survive_obj', name: 'Survive', kind: 'objective', cost: {},
    display: { description: 'Beat 2 events without Military falling below zero.' },
    objective: (G) => G.removed.filter((c) => c.cardId === 'test_event').length >= 2 && G.resources.military >= 0,
  },
  // Round-based objective: win the instant the round counter passes 3.
  test_round_obj: {
    id: 'test_round_obj', name: 'Endure', kind: 'objective', cost: {},
    display: { description: 'Survive past round 3.' },
    objective: (G) => G.round > 3,
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

/** A run with an empty draw pile, so the hand can be set explicitly and stays stable across turns.
 *  `missionId: 'test'` has no MISSIONS entry, so no objective/threat is auto-seeded — each test seeds
 *  what it needs by hand. */
function run(): RunState {
  const config: RunConfig = { deck: [], board: TEST_BOARD_ID, boardStickers: [], missionId: 'test', deckId: 'd', seed: 's' };
  return createRun(config);
}

describe('event bus through the turn loop', () => {
  it('an on-draw building ignores the round-start refill', () => {
    let state = run();
    state.G.resources.food = 50; // keep famine out of it
    state.G.tableau = [{ id: 99, cardId: 'test_observer', workers: 1 }]; // operating
    // Reset the piles: an empty hand + a known draw pile so the next turn start draws a known count.
    state.G.hand = [];
    state.G.deck = instancesFromCardIds(['a', 'a', 'a'], 200);
    state.G.discard = [];
    state.G.resources.money = 0;
    state = endTurn(state); // upkeep → next beginTurn refills the hand (turnStart draws, not effect)
    expect(state.gameover).toBeUndefined();
    expect(state.G.hand.length).toBe(3);
    expect(state.G.resources.money).toBe(0); // round-start refill does NOT pay the observer
    expect(state.G.events).toEqual([]); // queue drained — committed-state invariant
  });

  it('an on-draw building pays out when a card effect (a draw action) draws', () => {
    let state = run();
    state.G.resources.food = 50; // keep famine out of it
    state.G.tableau = [{ id: 99, cardId: 'test_observer', workers: 1 }]; // operating
    state.G.hand = instancesFromCardIds(['test_draw'], 300); // test_draw: cost 1💰, draws 2
    state.G.deck = instancesFromCardIds(['a', 'a'], 200);
    state.G.discard = [];
    state.G.resources.money = 5;
    state = applyMove(state, playCard, 0); // play the draw action from hand index 0
    expect(state.gameover).toBeUndefined();
    // 5 start − 1 cost + 2 (observer firing on each of the two effect draws) = 6.
    expect(state.G.resources.money).toBe(6);
    expect(state.G.events).toEqual([]);
  });
});

describe('deadline: win (objective) and lose (threat) reconciled by checkEndIf order', () => {
  // The deadline threat owns the lose condition — a pure round deadline, reading no resource; the
  // objective card owns the win (10🔬). `checkEndIf` reads the bus-written win flag (`G.pendingVictory`)
  // *before* the threat's `pendingDefeat`, so these two cards need no knowledge of each other.
  it('the round deadline passing short of the goal is the threat-owned defeat', () => {
    let state = run();
    state.G.resources.food = 50; // keep famine out of it
    seedObjective(state.G, 'test_objective'); // win at 10🔬
    state.G.threats = [{ id: 1, cardId: 'test_deadline' }]; // defeat once round > 5
    state.G.resources.science = 5; // short of the 10 goal
    state.G.round = 5;
    state = endTurn(state); // beginTurn advances to round 6 → deadline fires
    expect(state.gameover).toMatchObject({ outcome: 'defeat', reason: 'test deadline' });
  });

  it('reaching the goal as the deadline lands still wins — the win flag is read first', () => {
    let state = run();
    state.G.resources.food = 50;
    seedObjective(state.G, 'test_objective');
    state.G.threats = [{ id: 1, cardId: 'test_deadline' }];
    state.G.resources.science = 10; // goal met exactly as the deadline lands
    state.G.round = 5;
    state = endTurn(state);
    expect(state.gameover).toMatchObject({ outcome: 'victory', missionId: 'test' });
  });
});

describe('event resolution', () => {
  it('auto-resolves an unplayed event, files it to the discard, and it recurs (redrawn next turn), never removed', () => {
    let state = run();
    state.G.resources.military = 10;
    state.G.resources.food = 20; // keep famine out of the picture
    state.G.hand = instancesFromCardIds(['test_event']);
    state = endTurn(state);
    expect(state.gameover).toBeUndefined();
    expect(state.G.resources.military).toBe(8); // test_event drained 2 when it auto-resolved
    expect(state.G.removed.map((c) => c.cardId)).not.toContain('test_event'); // unplayed → never exiled
    // It filed to discard, which (deck was empty) reshuffled back and was redrawn — the recurrence
    // that makes an unplayed event a standing hazard, not a one-shot.
    expect(state.G.hand.map((c) => c.cardId)).toEqual(['test_event']);
  });

  it('playing an event pre-empts its upkeep drain and banishes it to removed', () => {
    let state = run();
    state.G.resources.military = 10;
    state.G.hand = instancesFromCardIds(['test_event']);
    state = applyMove(state, playCard, 0);
    expect(state.gameover).toBeUndefined();
    expect(state.G.resources.military).toBe(10); // pre-empted — no -2 drain
    expect(state.G.removed.map((c) => c.cardId)).toEqual(['test_event']); // played → removed
    expect(state.G.discard.map((c) => c.cardId)).not.toContain('test_event');
    expect(state.G.hand).toEqual([]);
  });

  it('banishing the second event with Military intact wins', () => {
    let state = run();
    seedObjective(state.G, 'test_survive_obj');
    state.G.removed = instancesFromCardIds(['test_event']); // one already banished
    state.G.resources.military = 10;
    state.G.hand = instancesFromCardIds(['test_event'], 100);
    // The win is a move-granularity flag read: playing the 2nd event exiles it (its upkeep drain
    // pre-empted, so safe) and trips the objective.
    state = applyMove(state, playCard, 0);
    expect(state.gameover).toMatchObject({ outcome: 'victory', missionId: 'test' });
  });

  it('an unplayed event whose auto-resolve drives Military below zero is a defeat', () => {
    let state = run();
    seedObjective(state.G, 'test_survive_obj');
    state.G.removed = instancesFromCardIds(['test_event']); // one banished, one short of the objective
    state.G.resources.military = 1; // 1 - 2 = -1 when the unplayed event fires at end of turn
    state.G.resources.food = 20; // keep famine out of it
    state.G.hand = instancesFromCardIds(['test_event'], 100);
    // Ending the turn *without* playing the event lets it strike: the drain fires, Military collapses,
    // and (since the auto-resolve files to discard, not removed) the objective stays one short.
    state = endTurn(state);
    expect(state.gameover).toMatchObject({ outcome: 'defeat', reason: 'revolt' });
  });
});

describe('objective win timing through the real turn loop', () => {
  // The subtlest case: a round-based win (`round > 3`). Round increments in `beginTurn`, so the win
  // must register there — off the `flushEvents` that follows the refill draw, even though beginTurn
  // queues no other event. This is exactly what `flushEvents`-tail (not `dispatchEvent`-tail)
  // guarantees, so it gets an end-to-end assertion, not just the direct `objectiveMet` unit test.
  it('the round-4 rollover wins at beginTurn', () => {
    let state = run();
    seedObjective(state.G, 'test_round_obj');
    state.G.resources.food = 500;
    state.G.resources.population = 0; // no population food upkeep
    // Drive the real loop; round starts at 1 and advances one per endTurn via beginTurn.
    for (let i = 0; i < 20 && !state.gameover; i++) state = endTurn(state);
    expect(state.gameover).toMatchObject({ outcome: 'victory', missionId: 'test' });
    expect(state.G.round).toBe(4); // won the instant round crossed 3, not a round later
  });
});
