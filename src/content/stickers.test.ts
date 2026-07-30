import { describe, it, expect } from 'vitest';
import { CARDS } from './cards';
import { STICKERS } from './stickers';
import { effectiveCost, effectiveGain, stickerAppliesTo } from '../rules/stickers';

// Internal coherence of the STICKERS catalogue (mirrors `cards.test.ts`'s checks over CARDS).

describe('STICKERS', () => {
  it("each entry's id matches its registry key", () => {
    for (const [key, sticker] of Object.entries(STICKERS)) {
      expect(sticker.id, key).toBe(key);
    }
  });

  // `collection.ts`'s `stickerSignature` sorts a copy's stickers into one order-independent key, so
  // two copies stickered [a, b] and [b, a] are pooled as a single fungible variant. That is only sound
  // while the folds commute — a pair that doesn't would let one variant price two ways in a run.
  // Checked over every pair that can actually meet, on every card both may attach to.
  it('the applyCost/applyGain folds commute on any card two stickers share', () => {
    const ids = Object.keys(STICKERS);
    for (const a of ids) {
      for (const b of ids) {
        for (const card of Object.values(CARDS)) {
          if (!stickerAppliesTo(STICKERS[a], card) || !stickerAppliesTo(STICKERS[b], card)) continue;
          const where = `${a}+${b} on ${card.id}`;
          expect(effectiveCost(card.cost, { stickers: [a, b] }), where)
            .toEqual(effectiveCost(card.cost, { stickers: [b, a] }));
          expect(effectiveGain(card.produces?.resources, { stickers: [a, b] }), where)
            .toEqual(effectiveGain(card.produces?.resources, { stickers: [b, a] }));
        }
      }
    }
  });
});
