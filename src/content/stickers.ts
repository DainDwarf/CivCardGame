/**
 * Card stickers (docs/DESIGN.md, "Economy & progression"; Phase 3 Step 7.5): permanent,
 * per-copy buffs bought with Influence and attached to one owned `MetaCardInstance`
 * (`rules/collection.ts`) forever. Their actual behavior — `reinforced`'s output bonus,
 * `efficient`'s cost discount — is hardcoded by id in `rules/stickers.ts`'s `effectiveGain`/
 * `effectiveCost` (Phase 3 Step 7.6), the same "just a few, hand-matched by id" style as
 * Cornucopia/Creeping Decay's bespoke resolvers; this catalogue only carries the id/name/
 * description/cost a sticker is bought and displayed by. Deliberately small — real variety/
 * balance is Phase 4.
 */
export interface StickerDef {
  id: string;
  name: string;
  description: string;
  cost: number;
}

export const STICKERS: Record<string, StickerDef> = {
  reinforced: { id: 'reinforced', name: 'Reinforced', description: "+1 to this copy's output", cost: 3 },
  efficient: { id: 'efficient', name: 'Efficient', description: 'Costs 1 less to play', cost: 3 },
};
