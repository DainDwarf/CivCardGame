/**
 * Card stickers (docs/DESIGN.md, "Economy & progression"; Phase 3 Step 7.5): permanent,
 * per-copy buffs bought with Influence and attached to one owned `MetaCardInstance`
 * (`rules/collection.ts`) forever. This step is meta + UI only — a sticker's `description`
 * states its eventual effect, but nothing reads it yet; Step 7.6 is what carries it into a
 * run and composes it through `resolveProduction`/`resolveCard`, the same resolver-spine
 * discipline as threats/Cornucopia. Deliberately small — real variety/balance is Phase 4.
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
