import { describe, it, expect } from 'vitest';
import { applyMove, createRun, endTurn, type RunState } from './engine';
import { playCard, assignWorker, unassignWorker } from './moves';
import type { RunConfig } from '../contract';

/** A fixture deck for these run-loop mechanics tests, independent of
 *  `content/decks.ts`'s player-facing starting deck — so balance/content changes there
 *  don't break these mechanics assertions. Its first 5 cards are what every test below
 *  actually exercises; `board: 'tribe'` and this unshuffled order reproduce the fixed
 *  values these tests assert on. */
const FIXTURE_DECK = [
  'farm', 'workshop', 'corvee', 'library', 'harvest',
  'settlers', 'farm', 'eureka', 'granary', 'settlers',
  'workshop', 'walls', 'library', 'inspiration', 'settlers',
  'barracks', 'university', 'eureka', 'corvee',
  'pyramids', 'great_library', 'colossus',
  'develop', 'develop', 'conquest', 'destroy',
  'market', 'trading_post',
  'theater', 'cultural_festival', 'philosopher',
];

function start(missionId: string, board: RunConfig['board'] = 'tribe') {
  const config: RunConfig = { deck: [...FIXTURE_DECK], board, missionId, deckId: 'fixture', seed: 'test-seed' };
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
    const client = start('enlightenment');
    const { G } = client.getState();
    expect(G.round).toBe(1);
    expect(G.population).toBe(2);
    expect(G.hand.map((c) => c.cardId)).toEqual(['farm', 'workshop', 'corvee', 'library', 'harvest']);
    expect(G.resources.production).toBe(5);
    client.stop();
  });

  it('applies the chosen board baseline, not just the tribe defaults', () => {
    const monarchy = start('enlightenment', 'monarchy').getState().G;
    expect(monarchy.population).toBe(1);
    expect(monarchy.resources.military).toBe(4);
    expect(monarchy.resources.food).toBe(3);

    const republic = start('enlightenment', 'republic').getState().G;
    expect(republic.territory).toBe(8);
    expect(republic.resources.money).toBe(5);
  });

  it('playing a building card places it in the tableau, auto-staffs it, and keeps it in play', () => {
    const client = start('enlightenment'); // population 2, all idle
    playByName(client, 'farm'); // farm card is placed as a farm building -> auto-staffed on play
    const after = client.getState().G;
    // Instance ids are now unique across all zones, so a building minted while a full deck still
    // holds ids gets a high id, not 1 — assert shape, not the exact number (checked via `id` below).
    expect(after.tableau).toEqual([{ id: expect.any(Number), cardId: 'farm', workers: 1 }]);
    expect(after.removed).toEqual([]); // the card *is* the building — not removed on play
    expect(after.discard).toEqual([]); // building cards don't recycle
    // staffing is still hand-adjustable: return the worker, then reassign it
    const farmId = after.tableau[0].id;
    client.moves.unassignWorker(farmId);
    expect(client.getState().G.tableau[0].workers).toBe(0);
    client.moves.assignWorker(farmId);
    expect(client.getState().G.tableau[0].workers).toBe(1);
    client.stop();
  });

  it('auto-staffing stops once the idle pool is exhausted', () => {
    const client = start('enlightenment'); // population 2 idle, production 5
    playByName(client, 'corvee'); // work card: auto-staffs 1 worker -> free pop = 1
    playByName(client, 'workshop'); // costs 2 prod -> 3; auto-staffs 1 -> free pop = 0
    playByName(client, 'farm'); // costs 1 prod -> 2; no idle left -> unstaffed
    const G = client.getState().G;
    expect(G.tableau.find((b) => b.cardId === 'workshop')!.workers).toBe(1);
    expect(G.tableau.find((b) => b.cardId === 'farm')!.workers).toBe(0);
    client.stop();
  });

  it('a work card sticks onto the board, defers its output to upkeep, and discards at end of turn', () => {
    const client = start('enlightenment'); // hand: farm, workshop, corvee, library, harvest; pop 2
    playByName(client, 'corvee'); // work box auto-staffs 1 worker; +3 production deferred
    const { G } = client.getState();
    expect(G.workZone).toEqual([{ id: expect.any(Number), cardId: 'corvee', workers: 1 }]);
    expect(G.resources.production).toBe(5); // output not yet applied
    expect(G.hand.map((c) => c.cardId)).toEqual(['farm', 'workshop', 'library', 'harvest']);
    expect(G.discard).toEqual([]); // work card stays on the board, not discarded on play
    client.events.endTurn();
    const after = client.getState().G;
    expect(after.resources.production).toBe(8); // staffed work produced +3 during upkeep
    expect(after.workZone).toEqual([]); // work zone cleared
    expect(after.discard.map((c) => c.cardId)).toContain('corvee'); // and the card filed to discard at end of turn
    client.stop();
  });

  it('a work card is playable with no idle population — it just sits unstaffed', () => {
    const client = start('enlightenment'); // pop 2
    playByName(client, 'farm'); // costs 1 prod -> auto-staffs 1 pop
    playByName(client, 'workshop'); // costs 2 prod -> auto-staffs 1 pop; 0 idle
    playByName(client, 'corvee'); // no idle pop, but a work card is never gated on it
    const { G } = client.getState();
    expect(G.workZone).toEqual([{ id: expect.any(Number), cardId: 'corvee', workers: 0 }]);
    expect(G.hand.map((c) => c.cardId)).not.toContain('corvee'); // it left the hand onto the board
    client.stop();
  });

  it("a work card's worker is freed once the card discards at end of turn", () => {
    const client = start('enlightenment'); // pop 2
    playByName(client, 'corvee'); // work box auto-staffs 1 -> free pop = 1
    playByName(client, 'farm'); // auto-staffs 1 -> free pop = 0
    playByName(client, 'workshop'); // builds unstaffed (free pop = 0)
    const wsId = client.getState().G.tableau.find((b) => b.cardId === 'workshop')!.id;
    client.moves.assignWorker(wsId); // blocked — no free pop (one is on the work box)
    expect(client.getState().G.tableau.find((b) => b.id === wsId)!.workers).toBe(0);
    client.events.endTurn(); // corvee discards, releasing its worker
    expect(client.getState().G.workZone).toEqual([]);
    client.moves.assignWorker(wsId); // now free pop = 1 (only the farm is staffed) -> succeeds
    expect(client.getState().G.tableau.find((b) => b.id === wsId)!.workers).toBe(1);
    client.stop();
  });

  it('at end of round, only staffed buildings produce and the population eats food', () => {
    const client = start('enlightenment');
    playByName(client, 'workshop'); // cost 2 -> production 3; auto-staffed from idle pop
    client.events.endTurn();
    const { G } = client.getState();
    expect(G.resources.production).toBe(3 + 2); // staffed workshop produced 2
    expect(G.resources.food).toBe(5 - 2); // population (2) ate, no farm to feed them
    client.stop();
  });

  it('famine is a universal defeat (population with no food starves)', () => {
    const client = start('enlightenment');
    client.events.endTurn(); // food 3
    client.events.endTurn(); // food 1
    client.events.endTurn(); // food -1 -> famine
    const { ctx } = client.getState();
    expect(ctx.gameover).toEqual({ outcome: 'defeat', reason: 'famine', missionId: 'enlightenment' });
    client.stop();
  });

  it('the_long_decline (Step 6.3c): Creeping Decay drains Production round over round until ruin collapses the run', () => {
    const client = start('the_long_decline');
    playByName(client, 'farm'); // +2 Food/round staffed, offsetting population's upkeep, so Food
    // stays flat and Production is what collapses first — proving the threat, not famine, ends the run.
    client.events.endTurn(); // production 5-1(farm cost)-1(decay) = 3; food 5+2-2 = 5
    client.events.endTurn(); // production 3-2(decay) = 1; food unchanged at 5
    client.events.endTurn(); // production 1-3(decay) = -2 -> ruin
    const { G, ctx } = client.getState();
    expect(G.resources.food).toBe(5); // never went negative — famine wasn't the cause
    expect(ctx.gameover).toEqual({ outcome: 'defeat', reason: 'ruin', missionId: 'the_long_decline' });
    client.stop();
  });

  it('barbarian_tide seeds four barbarian events into the run, and they cannot be played', () => {
    const client = start('barbarian_tide');
    const { G } = client.getState();
    // All four barbarians are in play from the start — split across deck and the opening hand.
    expect([...G.deck, ...G.hand].filter((c) => c.cardId === 'barbarian').length).toBe(4);
    // If one was dealt into the opening hand, playing it is rejected (events only auto-resolve).
    const idx = G.hand.findIndex((c) => c.cardId === 'barbarian');
    if (idx !== -1) {
      const before = client.getState().G.hand;
      client.moves.playCard(idx);
      expect(client.getState().G.hand).toEqual(before); // unchanged — the move was invalid
    }
    client.stop();
  });
});
