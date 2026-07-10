import { describe, it, expect } from 'vitest';
import { enumerateActions } from './actions';
import { applyAction, simConfig, createRandomPolicy } from './index';
import { createRun } from '../run/engine';
import { blankState } from '../rules';
import { DEFAULT_DECKS } from '../content/decks';

const FOUNDING = DEFAULT_DECKS[0].cards;

describe('enumerateActions', () => {
  // The core contract the greedy/heuristic policies rely on: every action the enumeration offers is one
  // the real engine accepts. If a bogus (rejected) action slipped through, `applyAction` would return
  // the *same* state object and a two-phase greedy could stall on it — so we assert reference-inequality
  // (acceptance) for every candidate at every state of a real random run. This also polices the newly
  // added `transferWorker` enumeration against `moves.transferWorker`'s own reject.
  it('offers only engine-accepted actions at every state of a random run', () => {
    for (let s = 0; s < 12; s++) {
      const config = simConfig({ deckCardIds: FOUNDING, board: 'tribe', missionId: 'sandbox', seed: `snd-${s}` });
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
    const config = simConfig({ deckCardIds: FOUNDING, board: 'tribe', missionId: 'sandbox', seed: 'endturn' });
    const state = createRun(config);
    expect(enumerateActions(state.G).some((a) => a.kind === 'endTurn')).toBe(true);
  });

  it('offers ONLY interaction answers while an interaction is parked', () => {
    // A parked interaction is exclusive (endTurn no-ops, plays are blocked), so the enumeration must
    // return nothing but `resolveInteraction` — the structural guard against a no-op endTurn deadlock.
    const G = blankState('sandbox');
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
});
