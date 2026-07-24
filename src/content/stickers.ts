import type { Resources } from '../rules/resources';
import type { CardDef } from './cards';

/**
 * Card stickers (docs/DESIGN.md, "Economy & progression"): permanent,
 * per-copy buffs bought with Influence and attached to one owned `MetaCardInstance`
 * (`rules/collection.ts`) forever. **A sticker owns its own logic** — both what it may attach
 * to (`appliesTo`) and what it does (`applyGain`/`applyCost`) are declared right here, on the
 * def, the same "the card owns its resolution" discipline a `CardEffect.resolve` closure
 * follows. Every consumer routes through `rules/stickers.ts` — the eligibility
 * dispatcher `stickerAppliesTo` and the effect fold in `effectiveGain`/`effectiveCost` — which
 * carry *no* sticker-specific knowledge, so a new sticker (with a new attach condition or a new
 * output/cost tweak) is added here alone, never at a call site. Deliberately small —
 * real variety/balance is deferred.
 *
 * The two effect hooks cover per-copy *output* and *play-cost* only — the two things the granular
 * run-loop call sites already need (`run/moves.ts`'s `playCard` calls `effectiveCost(card.cost)`
 * on its own, so a single `applyToCard(card) => card` transformer wouldn't slot in cleanly). A
 * future sticker touching `workers`/`draw` needs a new hook here *plus* a
 * new compose site in `rules/stickers.ts`'s `effectiveCard` — that's the seam; don't pre-build it.
 */
export interface StickerDef {
  id: string;
  name: string;
  description: string;
  /** A distinct glyph identifying this sticker wherever a stickered instance shows a badge
   *  (`CardFace`'s `stickerBadge`) — one per sticker, so the badge reads as *which*
   *  sticker(s) a copy carries instead of a single generic 🏷️ regardless of identity. */
  icon: string;
  /** Influence price to attach one copy. */
  cost: number;
  /** Which cards this sticker may attach to. Absent = any owned card.
   *  The sticker owns its own eligibility; every site (shop listing/offer, `buySticker`'s
   *  authoritative reject) routes through `rules/stickers.ts`'s `stickerAppliesTo`, never
   *  inspecting a card's `kind`/`produces` itself. */
  appliesTo?: (card: CardDef) => boolean;
  /** This sticker's contribution to a card's per-copy output, applied *once per attached copy*
   *  — stacking (two of the same) and composing (two different) fall out of the fold in
   *  `rules/stickers.ts`'s `effectiveGain`. `undefined` in → `undefined` out (a card with no
   *  gain has nothing to bump). Absent = no output change. */
  applyGain?: (base: Partial<Resources> | undefined) => Partial<Resources> | undefined;
  /** This sticker's contribution to play cost, applied *once per attached copy* (fold in
   *  `effectiveCost`). Absent = no cost change. */
  applyCost?: (cost: Partial<Resources>) => Partial<Resources>;
}

/**
 * The card-sticker catalogue. Each entry is *hidden until unlocked* by a mission reward
 * (`MissionDef.reward.unlockStickerIds`) — a sticker becomes purchasable only once
 * `PlayerStore.unlockedStickers` holds its id (see `rules/upgrades.ts` / the Collection tray).
 *
 * `irrigation` is the first, unlocked by the "Growing Numbers" mission: +1 🌾 to a building that
 * already produces food (so it bumps that food output, never grants food to a non-food building).
 */
export const STICKERS: Record<string, StickerDef> = {
  irrigation: {
    id: 'irrigation',
    name: 'Irrigation',
    description: '+1 🌾',
    icon: '💧',
    cost: 3,
    // Attaches only to a building that already produces food; bumps *only* that food output.
    appliesTo: (c) => c.kind === 'building' && (c.produces?.resources?.food ?? 0) > 0,
    applyGain: (base) => (base ? { ...base, food: (base.food ?? 0) + 1 } : base),
  },
  wheel: {
    id: 'wheel',
    name: 'Wheel',
    description: '−1 🔨',
    icon: '🛞',
    cost: 5,
    // Only a building/work that actually pays 🔨 (so it can't be wasted on a card it can't help);
    // wonders are excluded globally by `stickerAppliesTo`. `applyCost` owns its own floor at 0.
    appliesTo: (c) => (c.kind === 'building' || c.kind === 'work') && (c.cost?.production ?? 0) > 0,
    applyCost: (cost) => ({ ...cost, production: Math.max(0, (cost.production ?? 0) - 1) }),
  },
};
