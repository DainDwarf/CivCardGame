import { describe, it, expect } from 'vitest';
import { createInitialState } from './setup';
import type { RunConfig } from '../contract';

const config: RunConfig = {
  deck: [{ cardId: 'farm', stickers: ['reinforced'] }, { cardId: 'library' }],
  board: 'tribe',
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
