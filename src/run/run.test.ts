import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { applyMove, createRun, endTurn, type RunState } from './engine';
import { playCard, assignWorker, unassignWorker } from './moves';
import type { RunConfig } from '../contract';
import { TEST_BOARD_ID, TEST_BOARD_2_ID, installFixtures, uninstallFixtures } from '../rules/testFixtures';

// Drives the real turn loop off synthetic fixtures. The first 5 cards are what every test exercises;
// this unshuffled order + TEST_BOARD reproduce the fixed values asserted below. missionId 'test' has
// no MISSIONS entry, so nothing is auto-seeded — the two "mission-specific" tests inject a synthetic
// threat/event by hand (mission SEEDING itself is covered by missionSpine.test.ts).
const FIXTURE_DECK = [
  'test_food', 'test_prod', 'test_work', 'test_sci', 'test_work_food',
  'test_food', 'test_prod', 'test_sci', 'test_action', 'test_settlers',
  'test_food', 'test_prod', 'test_sci', 'test_draw', 'test_settlers',
  'test_multi', 'test_sci', 'test_action', 'test_work',
  'test_food', 'test_prod', 'test_money', 'test_selfstaffed', 'test_culture',
];

beforeAll(installFixtures);
afterAll(uninstallFixtures);

function start(missionId: string, board: RunConfig['board'] = TEST_BOARD_ID) {
  const config: RunConfig = {
    deck: FIXTURE_DECK.map((cardId) => ({ cardId })),
    board,
    boardStickers: [],
    missionId,
    deckId: 'fixture',
    seed: 'test-seed',
  };
  let state: RunState = createRun(config);
  return {
    getState: () => ({ G: state.G, ctx: { gameover: state.gameover } }),
    moves: {
      playCard: (idx: number, discards: number[] = []) => { state = applyMove(state, playCard, idx, discards); },
      assignWorker: (id: number) => { state = applyMove(state, assignWorker, id); },
      unassignWorker: (id: number) => { state = applyMove(state, unassignWorker, id); },
    },
    events: { endTurn: () => { state = endTurn(state); } },
    stop: () => {},
  };
}

/** Play a card by name, resolving hand indices at call time. */
function playByName(client: ReturnType<typeof start>, cardId: string, discardIds: string[] = []) {
  const hand = client.getState().G.hand;
  const idx = hand.findIndex((c) => c.cardId === cardId);
  if (idx === -1) throw new Error(`playByName: '${cardId}' not in hand`);
  client.moves.playCard(idx, discardIds.map((d) => {
    const i = hand.findIndex((c) => c.cardId === d);
    if (i === -1) throw new Error(`playByName: discard '${d}' not in hand`);
    return i;
  }));
}

describe('run loop (headless integration)', () => {
  it('opens round 1 with a full hand and starting population, before any upkeep', () => {
    const client = start('test');
    const { G } = client.getState();
    expect(G.round).toBe(1);
    expect(G.resources.population).toBe(2); // TEST_BOARD population
    expect(G.hand.map((c) => c.cardId)).toEqual(['test_food', 'test_prod', 'test_work', 'test_sci']);
    expect(G.resources.production).toBe(4); // TEST_BOARD production
    client.stop();
  });

  it('applies the chosen board baseline, not just the default board', () => {
    const alt = start('test', TEST_BOARD_2_ID).getState().G;
    expect(alt.resources.population).toBe(1); // TEST_BOARD_2 population
    expect(alt.resources.military).toBe(4);
    expect(alt.resources.food).toBe(2);
    expect(alt.resources.territory).toBe(5);
    expect(alt.resources.money).toBe(3);
  });

  it('playing a building card places it in the tableau, auto-staffs it, and keeps it in play', () => {
    const client = start('test'); // population 2, all idle
    playByName(client, 'test_food'); // building placed and auto-staffed on play
    const after = client.getState().G;
    // Instance ids are unique across all zones, so a building minted while a full deck still holds ids
    // gets a high id — assert shape, not the exact number.
    expect(after.tableau).toEqual([{ id: expect.any(Number), cardId: 'test_food', workers: 1 }]);
    expect(after.removed).toEqual([]); // the card *is* the building — not removed on play
    expect(after.discard).toEqual([]); // building cards don't recycle
    // staffing is still hand-adjustable: return the worker, then reassign it
    const foodId = after.tableau[0].id;
    client.moves.unassignWorker(foodId);
    expect(client.getState().G.tableau[0].workers).toBe(0);
    client.moves.assignWorker(foodId);
    expect(client.getState().G.tableau[0].workers).toBe(1);
    client.stop();
  });

  it('auto-staffing stops once the idle pool is exhausted', () => {
    const client = start('test'); // population 2 idle, production 4
    playByName(client, 'test_work'); // work card: auto-staffs 1 worker -> free pop = 1
    playByName(client, 'test_prod'); // costs 2 prod -> 2; auto-staffs 1 -> free pop = 0
    playByName(client, 'test_food'); // costs 2 prod -> 0; no idle left -> unstaffed
    const G = client.getState().G;
    expect(G.tableau.find((b) => b.cardId === 'test_prod')!.workers).toBe(1);
    expect(G.tableau.find((b) => b.cardId === 'test_food')!.workers).toBe(0);
    client.stop();
  });

  it('a work card sticks onto the board, defers its output to upkeep, and discards at end of turn', () => {
    const client = start('test'); // hand: test_food, test_prod, test_work, test_sci; pop 2
    playByName(client, 'test_work'); // work box auto-staffs 1 worker; +3 production deferred
    const { G } = client.getState();
    expect(G.workZone).toEqual([{ id: expect.any(Number), cardId: 'test_work', workers: 1 }]);
    expect(G.resources.production).toBe(4); // output not yet applied
    expect(G.hand.map((c) => c.cardId)).toEqual(['test_food', 'test_prod', 'test_sci']);
    expect(G.discard).toEqual([]); // work card stays on the board, not discarded on play
    client.events.endTurn();
    const after = client.getState().G;
    expect(after.resources.production).toBe(7); // staffed work produced +3 during upkeep (4 + 3)
    expect(after.workZone).toEqual([]); // work zone cleared
    expect(after.discard.map((c) => c.cardId)).toContain('test_work'); // filed to discard at end of turn
    client.stop();
  });

  it('a work card is playable with no idle population — it just sits unstaffed', () => {
    const client = start('test'); // pop 2
    playByName(client, 'test_food'); // costs 2 prod -> auto-staffs 1 pop
    playByName(client, 'test_prod'); // costs 2 prod -> auto-staffs 1 pop; 0 idle
    playByName(client, 'test_work'); // no idle pop, but a work card is never gated on it
    const { G } = client.getState();
    expect(G.workZone).toEqual([{ id: expect.any(Number), cardId: 'test_work', workers: 0 }]);
    expect(G.hand.map((c) => c.cardId)).not.toContain('test_work'); // it left the hand onto the board
    client.stop();
  });

  it("a work card's worker is freed once the card discards at end of turn", () => {
    const client = start('test'); // pop 2
    playByName(client, 'test_work'); // work box auto-staffs 1 -> free pop = 1
    playByName(client, 'test_food'); // auto-staffs 1 -> free pop = 0
    playByName(client, 'test_prod'); // builds unstaffed (free pop = 0)
    const prodId = client.getState().G.tableau.find((b) => b.cardId === 'test_prod')!.id;
    client.moves.assignWorker(prodId); // blocked — no free pop (one is on the work box)
    expect(client.getState().G.tableau.find((b) => b.id === prodId)!.workers).toBe(0);
    client.events.endTurn(); // test_work discards, releasing its worker
    expect(client.getState().G.workZone).toEqual([]);
    client.moves.assignWorker(prodId); // now free pop = 1 (only test_food is staffed) -> succeeds
    expect(client.getState().G.tableau.find((b) => b.id === prodId)!.workers).toBe(1);
    client.stop();
  });

  it('at end of round, only staffed buildings produce and the population eats food', () => {
    const client = start('test');
    playByName(client, 'test_prod'); // cost 2 -> production 2; auto-staffed from idle pop
    client.events.endTurn();
    const { G } = client.getState();
    expect(G.resources.production).toBe(2 + 2); // staffed production building produced 2
    expect(G.resources.food).toBe(5 - 2); // population (2) ate, no food building to feed them
    client.stop();
  });

  it('famine is a universal defeat (population with no food starves)', () => {
    const client = start('test');
    client.events.endTurn(); // food 3
    client.events.endTurn(); // food 1
    client.events.endTurn(); // food -1 -> famine
    const { ctx } = client.getState();
    expect(ctx.gameover).toEqual({ outcome: 'defeat', reason: 'famine', missionId: 'test' });
    client.stop();
  });

  it('an escalating threat drains Production round over round until ruin collapses the run', () => {
    const client = start('test');
    client.getState().G.threats = [{ id: 500, cardId: 'test_escalating' }]; // −1🔨, then −2🔨, …
    playByName(client, 'test_food'); // +2 Food/round staffed (cost 2 prod -> production 2), offsetting
    // population upkeep so Food stays flat and Production is what collapses first — proving the threat,
    // not famine, ends the run.
    client.events.endTurn(); // production 2 − 1(decay) = 1; food 5 + 2 − 2 = 5
    client.events.endTurn(); // production 1 − 2(decay) = -1 -> ruin
    const { G, ctx } = client.getState();
    expect(G.resources.food).toBe(5); // never went negative — famine wasn't the cause
    expect(ctx.gameover).toEqual({ outcome: 'defeat', reason: 'ruin', missionId: 'test' });
    client.stop();
  });

  it('an event sitting in hand can be played — its upkeep disaster is pre-empted and it is banished to removed', () => {
    const client = start('test');
    client.getState().G.resources.military = 10;
    client.getState().G.hand.push({ id: 999, cardId: 'test_event' });
    const idx = client.getState().G.hand.findIndex((c) => c.cardId === 'test_event');
    client.moves.playCard(idx);
    expect(client.getState().G.hand.some((c) => c.cardId === 'test_event')).toBe(false); // left hand
    expect(client.getState().G.removed.map((c) => c.cardId)).toContain('test_event'); // played → removed
    expect(client.getState().G.resources.military).toBe(10); // upkeep drain never fired — playing pre-empts it
    client.stop();
  });
});
