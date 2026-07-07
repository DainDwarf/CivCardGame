import type { Resources } from '../rules/resources';
import type { CardDef } from './cards';

/**
 * Card stickers (docs/DESIGN.md, "Economy & progression"): permanent,
 * per-copy buffs bought with Influence and attached to one owned `MetaCardInstance`
 * (`rules/collection.ts`) forever. **A sticker owns its own logic** — both what it may attach
 * to (`appliesTo`) and what it does (`applyGain`/`applyCost`) are declared right here, on the
 * def, the same "the card owns its resolution" discipline `content/cards.ts`'s `resolve`/
 * `produce` closures follow. Every consumer routes through `rules/stickers.ts` — the eligibility
 * dispatcher `stickerAppliesTo` and the effect fold in `effectiveGain`/`effectiveCost` — which
 * carry *no* sticker-specific knowledge, so a new sticker (with a new attach condition or a new
 * output/cost tweak) is added here alone, never at a call site. Deliberately small —
 * real variety/balance is Phase 4.
 *
 * The two effect hooks cover per-copy *output* and *play-cost* only — the two things the granular
 * run-loop call sites already need (`run/moves.ts`'s `playCard` calls `effectiveCost(card.cost)`
 * on its own, so a single `applyToCard(card) => card` transformer wouldn't slot in cleanly). A
 * future sticker touching `workers`/`cultureOutput`/`tags`/`draw` needs a new hook here *plus* a
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
  /** Which cards this sticker may attach to. Absent = any owned card (Reinforced, Efficient).
   *  The sticker owns its own eligibility; every site (shop listing/offer, `buySticker`'s
   *  authoritative reject) routes through `rules/stickers.ts`'s `stickerAppliesTo`, never
   *  inspecting a card's `kind`/`produces` itself. */
  appliesTo?: (card: CardDef) => boolean;
  /** This sticker's contribution to a card's per-copy output, applied *once per attached copy*
   *  — stacking (two of the same) and composing (two different) fall out of the fold in
   *  `rules/stickers.ts`'s `effectiveGain`. `undefined` in → `undefined` out (a card with no
   *  gain has nothing to bump). Absent = no output change (e.g. Efficient). */
  applyGain?: (base: Partial<Resources> | undefined) => Partial<Resources> | undefined;
  /** This sticker's contribution to play cost, applied *once per attached copy* (fold in
   *  `effectiveCost`). Absent = no cost change (e.g. Reinforced). */
  applyCost?: (cost: Partial<Resources>) => Partial<Resources>;
}

export const STICKERS: Record<string, StickerDef> = {
  reinforced: {
    id: 'reinforced',
    name: 'Reinforced',
    description: "+1 to this copy's output",
    icon: '💪',
    cost: 3,
    // +1 to every resource key the card actually produces (a multi-output building bumps each).
    applyGain: (base) => {
      if (!base) return base;
      const out: Partial<Resources> = {};
      for (const [k, v] of Object.entries(base) as [keyof Resources, number][]) out[k] = v + 1;
      return out;
    },
  },
  efficient: {
    id: 'efficient',
    name: 'Efficient',
    description: 'Costs 1 less to play',
    icon: '⚡',
    cost: 3,
    // -1 off every resource key the card charges, floored at 0 (never pays you to play a card).
    applyCost: (cost) => {
      const out: Partial<Resources> = {};
      for (const [k, v] of Object.entries(cost) as [keyof Resources, number][]) out[k] = Math.max(0, v - 1);
      return out;
    },
  },
  irrigation: {
    id: 'irrigation',
    name: 'Irrigation',
    description: '+1 food (food buildings only)',
    icon: '💧',
    cost: 3,
    // Attaches only to a building that already produces food; bumps *only* that food output.
    appliesTo: (c) => c.kind === 'building' && (c.produces?.food ?? 0) > 0,
    applyGain: (base) => (base ? { ...base, food: (base.food ?? 0) + 1 } : base),
  },
};
