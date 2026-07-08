import { describe, it, expect } from 'vitest';
import { createInitialState } from './setup';
import { BOARDS } from '../content/boards';
import type { RunConfig } from '../contract';

const config: RunConfig = {
  deck: [{ cardId: 'farm', stickers: ['reinforced'] }, { cardId: 'library' }],
  board: 'tribe',
  boardStickers: [],
  missionId: 'enlightenment',
  deckId: 'fixture',
  seed: 'test-seed',
};

describe('createInitialState: sticker carry-over (Phase 3 Step 7.6)', () => {
  it("mints each RunConfig.deck entry's stickers onto its run instance", () => {
    const G = createInitialState(config);
    const farm = G.deck.find((c) => c.cardId === 'farm')!;
    const library = G.deck.find((c) => c.cardId === 'library')!;
    expect(farm.stickers).toEqual(['reinforced']);
    expect(library.stickers).toBeUndefined();
  });
});

describe('createInitialState: board stickers (Phase 3 Step 8)', () => {
  // Compare against an unstickered run rather than the raw board baseline, so the sticker's
  // contribution is isolated regardless of what the mission's own `setup` layers on top.
  const base = createInitialState({ ...config, boardStickers: [] });

  it('the unstickered run seeds off the board baseline', () => {
    expect(base.resources.food).toBe(BOARDS.tribe.resources.food);
    expect(base.territory).toBe(BOARDS.tribe.territory);
  });

  it('folds a core-resource board sticker into the starting profile (Fertile Land → +2 Food)', () => {
    const G = createInitialState({ ...config, boardStickers: ['fertileLand'] });
    expect(G.resources.food).toBe(base.resources.food + 2);
  });

  it('folds a strategic-gauge board sticker (Frontier → +1 Territory)', () => {
    const G = createInitialState({ ...config, boardStickers: ['frontier'] });
    expect(G.territory).toBe(base.territory + 1);
  });
});
