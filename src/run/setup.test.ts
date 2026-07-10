import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createInitialState } from './setup';
import type { RunConfig } from '../contract';
import { TEST_BOARD, TEST_BOARD_ID, installFixtures, uninstallFixtures } from '../rules/testFixtures';

// Seeds off the synthetic TEST_BOARD (installed into BOARDS); the missionId is a label (no MISSIONS
// entry exists for it, so createInitialState simply seeds no objective/threats — fine for these
// board/sticker-carry tests). test_addgain stands in for a card sticker, test_bs_* for board stickers.
beforeAll(installFixtures);
afterAll(uninstallFixtures);

const config: RunConfig = {
  deck: [{ cardId: 'test_food', stickers: ['test_addgain'] }, { cardId: 'test_sci' }],
  board: TEST_BOARD_ID,
  boardStickers: [],
  missionId: 'test',
  deckId: 'fixture',
  seed: 'test-seed',
};

describe('createInitialState: sticker carry-over', () => {
  it("mints each RunConfig.deck entry's stickers onto its run instance", () => {
    const G = createInitialState(config);
    const food = G.deck.find((c) => c.cardId === 'test_food')!;
    const sci = G.deck.find((c) => c.cardId === 'test_sci')!;
    expect(food.stickers).toEqual(['test_addgain']);
    expect(sci.stickers).toBeUndefined();
  });
});

describe('createInitialState: board stickers', () => {
  // Compare against an unstickered run rather than the raw board baseline, so the sticker's
  // contribution is isolated regardless of what the mission's own setup layers on top. `base` is
  // built inside each test (not at collection time) so the fixtures are installed by then.
  it('the unstickered run seeds off the board baseline', () => {
    const base = createInitialState({ ...config, boardStickers: [] });
    expect(base.resources.food).toBe(TEST_BOARD.resources.food);
    expect(base.territory).toBe(TEST_BOARD.territory);
  });

  it('folds a core-resource board sticker into the starting profile (+2 Food)', () => {
    const base = createInitialState({ ...config, boardStickers: [] });
    const G = createInitialState({ ...config, boardStickers: ['test_bs_food'] });
    expect(G.resources.food).toBe(base.resources.food + 2);
  });

  it('folds a strategic-gauge board sticker (+1 Territory)', () => {
    const base = createInitialState({ ...config, boardStickers: [] });
    const G = createInitialState({ ...config, boardStickers: ['test_bs_territory'] });
    expect(G.territory).toBe(base.territory + 1);
  });
});
