import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { addWork, blankState, findStaffable, instancesFromCardIds, type GameState } from '../rules';
import type { CardDef } from '../content/cards';
import { installCards, uninstallCards } from '../rules/testFixtures';
import type { RunState } from '../run/engine';
import { createGreedyPolicy } from './greedyPolicy';
import { createGreedy2Policy } from './greedy2Policy';
import { applyAction } from './simulate';

/**
 * Two work boxes of *different* output, so the play→transfer combo is strictly-improving. The asymmetry is
 * the whole point (a transfer between equal-output boxes nets zero and greedy2 would reject it), so both
 * are pinned as local fixtures here rather than borrowing shared work fixtures whose magnitudes could
 * later be equalized. Both `work` cards, so relocating a worker leaves the *permanent* economy untouched
 * and the gain shows purely as more projected resource.
 */
const WORK_BOXES = {
  test_weak_work: {
    id: 'test_weak_work', name: 'Test Weak Work', kind: 'work',
    cost: {}, workers: 1, produces: { resources: { production: 2 } },
  },
  test_strong_work: {
    id: 'test_strong_work', name: 'Test Strong Work', kind: 'work',
    cost: {}, workers: 1, produces: { resources: { production: 3 } },
  },
} satisfies Record<string, CardDef>;

/**
 * The exact saturated-population case: 1 population committed to the weaker +2🔨 box, the stronger +3🔨
 * box in hand, no idle worker. Playing the stronger box alone is score-neutral (unstaffed, not operating),
 * so plain one-ply greedy can't see that playing it *and then transferring the worker in* is a net gain
 * (trade the +2🔨 for +3🔨). `greedy2`'s bounded staffing lookahead should.
 */
function saturatedState(): RunState {
  const G: GameState = blankState('test'); // mission label only — this scenario seeds no objective
  G.resources.food = 5; // fed, but under the buffer cap so extra resource still scores
  G.resources.population = 1;
  addWork(G, 'test_weak_work'); // auto-staffs the one worker (idle 1 → 0)
  G.hand = instancesFromCardIds(['test_strong_work'], 100);
  return { G, gameover: undefined };
}

describe('greedy2 — bounded staffing lookahead over plain greedy', () => {
  beforeAll(() => installCards(WORK_BOXES));
  afterAll(() => uninstallCards(WORK_BOXES));

  it('plain greedy cannot see the play→transfer combo and just ends the turn', () => {
    const greedy = createGreedyPolicy('t');
    expect(greedy(saturatedState())).toEqual({ kind: 'endTurn' });
  });

  it('greedy2 plays the work box, then transfers a worker into it', () => {
    const greedy2 = createGreedy2Policy('t');
    const state = saturatedState();

    // Step 1: value the stronger-box play by its best staffing follow-up ⇒ it plays it.
    const first = greedy2(state);
    expect(first).toMatchObject({ kind: 'playCard', playHandIdx: 0 });

    // Step 2: from the post-play state the transfer strictly improves on its own ⇒ greedy2 takes it,
    //   relocating a worker into the freshly-placed stronger box.
    const afterPlay = applyAction(state, first);
    const strongBox = afterPlay.G.workZone.find((w) => w.cardId === 'test_strong_work');
    expect(strongBox).toBeDefined();

    const second = greedy2(afterPlay);
    expect(second.kind).toBe('transferWorker');
    if (second.kind === 'transferWorker') {
      expect(second.toId).toBe(strongBox!.id);
      // The source is the staffed weaker box the worker relocates out of.
      expect(findStaffable(afterPlay.G, second.fromId)?.cardId).toBe('test_weak_work');
    }
  });
});
