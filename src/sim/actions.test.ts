import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { enumerateActions } from './actions';
import { applyAction, simConfig, createRandomPolicy } from './index';
import { createRun } from '../run/engine';
import { blankState } from '../rules';
import { installFixtures, uninstallFixtures, TEST_BOARD_ID } from '../rules/testFixtures';

// A synthetic deck spanning the staffable + action kinds, so a random run enumerates plays, worker
// assignment, and transfers — the whole action surface — without leaning on the shipped catalogue. The
// mission's round-5 deadline (`test_unwinnable`) guarantees every random run terminates in the step budget.
const FIXTURE_DECK = ['test_food', 'test_prod', 'test_work', 'test_work_food', 'test_action', 'test_settlers'];

describe('enumerateActions', () => {
  beforeAll(installFixtures);
  afterAll(uninstallFixtures);

  // The core contract the greedy/heuristic policies rely on: every action the enumeration offers is one
  // the real engine accepts. If a bogus (rejected) action slipped through, `applyAction` would return
  // the *same* state object and a two-phase greedy could stall on it — so we assert reference-inequality
  // (acceptance) for every candidate at every state of a real random run. This also polices the
  // `transferWorker` enumeration against `moves.transferWorker`'s own reject.
  it('offers only engine-accepted actions at every state of a random run', () => {
    for (let s = 0; s < 12; s++) {
      const config = simConfig({ deckCardIds: FIXTURE_DECK, board: TEST_BOARD_ID, missionId: 'test_unwinnable', seed: `snd-${s}` });
      let state = createRun(config);
      const policy = createRandomPolicy(`snd-pol-${s}`);
      let steps = 0;
      while (!state.gameover && steps < 5000) {
        for (const action of enumerateActions(state.G)) {
          const next = applyAction(state, action);
          expect(next).not.toBe(state); // accepted ⇒ a fresh state object
        }
        state = applyAction(state, policy(state));
        steps += 1;
      }
      expect(state.gameover).toBeTruthy(); // the run actually terminated within the step budget
    }
  });

  it('always offers ending the turn when no interaction is pending', () => {
    const config = simConfig({ deckCardIds: FIXTURE_DECK, board: TEST_BOARD_ID, missionId: 'test_unwinnable', seed: 'endturn' });
    const state = createRun(config);
    expect(enumerateActions(state.G).some((a) => a.kind === 'endTurn')).toBe(true);
  });

  it('offers ONLY interaction answers while an interaction is parked', () => {
    // A parked interaction is exclusive (endTurn no-ops, plays are blocked), so the enumeration must
    // return nothing but `resolveInteraction` — the structural guard against a no-op endTurn deadlock.
    const G = blankState('test');
    G.pendingInteraction = {
      cardId: 'storytelling',
      instanceId: 1,
      kind: 'chooseCard',
      prompt: 'pick',
      options: [
        { id: 2, cardId: 'fire' },
        { id: 3, cardId: 'bow' },
      ],
      pick: 1,
    };
    const actions = enumerateActions(G);
    expect(actions).toHaveLength(2); // one per option
    expect(actions.every((a) => a.kind === 'resolveInteraction')).toBe(true);
    expect(actions.map((a) => (a.kind === 'resolveInteraction' ? a.answer : -1))).toEqual([0, 1]);
  });

  it('collapses a look-only reveal to a single dismiss action, whatever its option count', () => {
    // A `reveal` (a peek) has no choice — every "answer" just dismisses it — so enumerating one per
    // option would offer redundant equivalent edges. Assert the single canonical dismiss instead.
    const G = blankState('test');
    G.pendingInteraction = {
      cardId: 'calendar',
      instanceId: 1,
      kind: 'reveal',
      prompt: 'peek',
      options: [
        { id: 2, cardId: 'fire' },
        { id: 3, cardId: 'bow' },
        { id: 4, cardId: 'dogs' },
      ],
      pick: 0,
    };
    expect(enumerateActions(G)).toEqual([{ kind: 'resolveInteraction', answer: 0 }]);
  });
});
