import { describe, it, expect } from 'vitest';
import { addWork, blankState, findStaffable, instancesFromCardIds, type GameState } from '../rules';
import type { RunState } from '../run/engine';
import { createGreedyPolicy } from './greedyPolicy';
import { createGreedy2Policy } from './greedy2Policy';
import { applyAction } from './simulate';

/**
 * The exact saturated-population case: 1 population committed to a Toolmaking (+2🔨 work box), a Foraging
 * (+3🌾 work box) in hand, no idle worker. Playing Foraging alone is score-neutral (unstaffed, not
 * operating), so plain one-ply greedy can't see that playing it *and then transferring the worker in* is a
 * net gain (trade the +2🔨 for +3🌾). `greedy2`'s bounded staffing lookahead should. Both boxes are work
 * cards, so relocating the worker leaves the *permanent* economy untouched (the survival buffer band reads
 * only tableau/upkeep) and the gain shows purely as more projected resource.
 */
function saturatedState(): RunState {
  const G: GameState = blankState('sandbox');
  G.resources.food = 5; // fed, but under the buffer cap so extra food still scores
  G.resources.population = 1;
  addWork(G, 'toolmaking'); // auto-staffs the one worker (idle 1 → 0)
  G.hand = instancesFromCardIds(['foraging'], 100);
  return { G, gameover: undefined };
}

describe('greedy2 — bounded staffing lookahead over plain greedy', () => {
  it('plain greedy cannot see the play→transfer combo and just ends the turn', () => {
    const greedy = createGreedyPolicy('t');
    expect(greedy(saturatedState())).toEqual({ kind: 'endTurn' });
  });

  it('greedy2 plays the work box, then transfers a worker into it', () => {
    const greedy2 = createGreedy2Policy('t');
    const state = saturatedState();

    // Step 1: value the Foraging play by its best staffing follow-up ⇒ it plays it.
    const first = greedy2(state);
    expect(first).toMatchObject({ kind: 'playCard', playHandIdx: 0 });

    // Step 2: from the post-play state the transfer strictly improves on its own ⇒ greedy2 takes it,
    //   relocating a worker into the freshly-placed Foraging box.
    const afterPlay = applyAction(state, first);
    const forageBox = afterPlay.G.workZone.find((w) => w.cardId === 'foraging');
    expect(forageBox).toBeDefined();

    const second = greedy2(afterPlay);
    expect(second.kind).toBe('transferWorker');
    if (second.kind === 'transferWorker') {
      expect(second.toId).toBe(forageBox!.id);
      // The source is the staffed Toolmaking box the worker relocates out of.
      expect(findStaffable(afterPlay.G, second.fromId)?.cardId).toBe('toolmaking');
    }
  });
});
