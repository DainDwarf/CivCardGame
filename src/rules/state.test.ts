import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cloneState, type GameState } from './state';
import { snapshot } from './events';
import { addWork } from './population';
import { openTradeRoute } from './tradeRoutes';
import { applyMove, createRun, endTurn } from '../run/engine';
import { playCard } from '../run/moves';
import type { RunConfig } from '../contract';
import { TEST_BOARD_ID, installFixtures, uninstallFixtures } from './testFixtures';

beforeAll(installFixtures);
afterAll(uninstallFixtures);

/** A state carried through the real turn loop, so every zone the clone must handle is populated by the
 *  production path rather than hand-assembled. */
function livedState(): GameState {
  const config: RunConfig = {
    deck: [
      'test_food', 'test_prod', 'test_work', 'test_sci', 'test_settlers',
      'test_food', 'test_prod', 'test_sci', 'test_action', 'test_multi',
    ].map((cardId) => ({ cardId })),
    board: TEST_BOARD_ID,
    boardStickers: [],
    missionId: 'test_win', // seeds both a threat and an objective card
    deckId: 'fixture',
    seed: 'clone-seed',
  };
  let state = createRun(config);
  state = applyMove(state, playCard, 0, []);
  state = endTurn(state);
  state = applyMove(state, playCard, 0, []);
  const G = state.G;
  // Optional per-copy state the zones don't otherwise carry — a clone that drops either would alias it.
  G.hand[0].counters = { plays: 2 };
  G.hand[0].stickers = ['irrigation'];
  // The board zones a settled turn leaves empty, filed through the production helpers so each holds
  // what a real run puts there.
  addWork(G, { id: 500, cardId: 'test_work' });
  openTradeRoute(G, { id: 501, cardId: 'test_trade' });
  G.removed.push({ id: 502, cardId: 'test_event' });
  // The three nested shapes no settled state carries: a parked choice holding its own instances, a
  // drained bus (a `resourceChange` nests a whole snapshot), and a declared defeat.
  G.pendingInteraction = {
    cardId: 'test_action', instanceId: G.hand[0].id, kind: 'chooseCard',
    prompt: 'pick one', options: [{ ...G.deck[0] }], pick: 1,
  };
  G.events = [
    { type: 'resourceChange', before: snapshot(G) },
    { type: 'draw', instanceId: G.hand[0].id, cardId: G.hand[0].cardId, source: 'effect' },
  ];
  G.pendingDefeat = { reason: 'fixture defeat' };
  return G;
}

/** Every (path, value) pair in the tree, objects included — the walk both assertions below share. */
function* walk(v: unknown, path = '$'): Generator<[string, unknown]> {
  if (v === null || typeof v !== 'object') return;
  yield [path, v];
  for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
    yield* walk(child, `${path}.${k}`);
  }
}

describe('cloneState', () => {
  it('is checked against a state carrying every field', () => {
    const G = livedState();
    // `cloneState` is spelled out field by field, so the way it fails is by forgetting one — and each
    // assertion below only reaches what the fixture populates: an absent field is indistinguishable
    // from a dropped one, and an empty zone never runs the clone's per-element path for it. Reading
    // the key set off the state is what makes this self-extending — a field added to `GameState`
    // surfaces here until `livedState` carries one.
    const vacuous = Object.entries(G)
      .filter(([, v]) => v === undefined || (Array.isArray(v) && v.length === 0))
      .map(([k]) => k);
    expect(vacuous).toEqual([]);
  });

  it('reproduces the state exactly', () => {
    const G = livedState();
    expect(cloneState(G)).toEqual(structuredClone(G));
  });

  it('shares no object reference with the original', () => {
    const G = livedState();
    const copy = cloneState(G);
    const originals = new Set([...walk(G)].map(([, v]) => v));
    const shared = [...walk(copy)].filter(([, v]) => originals.has(v)).map(([path]) => path);
    expect(shared).toEqual([]);
  });

  it('leaves the original untouched when the copy is mutated', () => {
    const G = livedState();
    const before = structuredClone(G);
    const copy = cloneState(G);
    copy.resources.food += 99;
    copy.hand.pop();
    copy.tableau.forEach((b) => (b.workers += 1));
    copy.hand[0].counters!.plays = 999;
    expect(G).toEqual(before);
  });
});
