import type { Resources } from '../rules/resources';
import type { CardCost } from '../rules/cost';
import type { GameState } from '../rules/state';
import { needsTinRoute, tinRouteStands, type CardDef } from './cards';

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
 * The two effect hooks cover per-copy *output* and *play-cost* only. `applyCost` takes and returns a
 * whole `CardCost`, so a sticker reaches every declarative field a price has — a resource amount, a
 * discard, a `cultureLevelReq` — not just the resource bundle. That is what lets a sticker charge in a
 * currency the card doesn't already pay in, once, at the play. A *standing* price is `applyGain`'s side
 * instead: it meets the card's `upkeep` bag like any other gain slot, so deepening the drain there
 * charges every round the copy stands. A future sticker touching `workers`/`draw` needs a new hook
 * here *plus* a new compose site in `rules/stickers.ts`'s `effectiveCard` — that's the seam; don't
 * pre-build it.
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
  /**
   * This sticker's contribution to a card's per-copy output, applied *once per attached copy*
   * — stacking (two of the same) and composing (two different) fall out of the fold in
   * `rules/stickers.ts`'s `effectiveGain`. `undefined` in → `undefined` out (a card with no
   * gain has nothing to bump). Absent = no output change.
   *
   * The hook meets **every** slot a card gains through — a play `effect`, a `produces` yield, and an
   * `upkeep` drain alike, since signs are neutral in a gain bag (`rules/effects.ts`). So a hook meaning
   * "more" must read the entry it amplifies as positive, and one charging a standing price reads the
   * negative bag instead; a bag with neither is no slot of the card's and is returned untouched.
   *
   * `G` is the live board when a real gain is being paid, and **absent** everywhere a rate is merely
   * being shown or projected. A hook conditioning on the board must therefore treat absence as "show
   * the potential" rather than as a failed condition, and must stay pure over `G`: it runs inside
   * `gainResources`, which writing there would re-enter.
   */
  applyGain?: (base: Partial<Resources> | undefined, G?: GameState) => Partial<Resources> | undefined;
  /**
   * This sticker's contribution to play cost, applied *once per attached copy* (fold in
   * `effectiveCost`). The whole `CardCost` in and out, so a sticker may touch any declarative
   * field — not only `resources`. Two shapes, and the difference is load-bearing: a **discount**
   * reads the field it cuts and leaves an absent one absent, while a **surcharge** materializes the
   * field on a card that never paid it. Absent = no cost change.
   *
   * Hooks that can meet on one copy must **commute**: `rules/collection.ts`'s `stickerSignature`
   * normalizes attach order away, so two copies the collection pools as one variant have to price
   * identically. Steps commute with steps and floors with floors, but a floor and a step on the same
   * field do not — which is why every `cultureLevelReq` hook here is a floor.
   */
  applyCost?: (cost: CardCost) => CardCost;
}

/**
 * The card-sticker catalogue. Each entry is *hidden until unlocked* by a mission reward
 * (`MissionDef.reward.unlockStickerIds`) — a sticker becomes purchasable only once
 * `PlayerStore.unlockedStickers` holds its id (see `rules/upgrades.ts` / the Collection tray).
 *
 * Every entry is a **trade-off, not an upgrade**: it buys one thing and charges for it — 🔨 up front, a
 * culture level you must already have reached, or a standing drain the copy pays for as long as it
 * stands. That is the shape a sticker takes here; a pure buff would make the only decision "can I
 * afford it".
 */

/** A producer of `key` a sticker may bump: a staffable that already makes the resource, so a sticker
 *  raises an output the card has rather than granting one it doesn't. Buildings *and* work boxes —
 *  the two kinds whose `produces` scales per staffed worker — and never a wonder, which
 *  `stickerAppliesTo` excludes globally. */
const producerOf = (key: 'food' | 'culture' | 'production') => (c: CardDef) =>
  (c.kind === 'building' || c.kind === 'work') && (c.produces?.resources?.[key] ?? 0) > 0;

export const STICKERS: Record<string, StickerDef> = {
  irrigation: {
    id: 'irrigation',
    name: 'Irrigation',
    description: '+1 🌾, +1 🔨 to play',
    icon: '💧',
    cost: 3,
    appliesTo: producerOf('food'),
    applyGain: (base) => (base ? { ...base, food: (base.food ?? 0) + 1 } : base),
    // A surcharge, so it materializes 🔨 on a card that pays none — the free work boxes are exactly
    // where the trade-off bites, since there the sticker *creates* the price rather than raising one.
    applyCost: (cost) => ({
      ...cost,
      resources: { ...cost.resources, production: (cost.resources?.production ?? 0) + 1 },
    }),
  },
  elegant: {
    id: 'elegant',
    name: 'Elegant',
    description: '+1 🎭, needs 🎭 level 1',
    icon: '✨',
    cost: 4,
    appliesTo: producerOf('culture'),
    applyGain: (base) => (base ? { ...base, culture: (base.culture ?? 0) + 1 } : base),
    // The sticker pays for itself in the resource it makes: it demands the culture level it then helps
    // you climb, so an early copy sits idle until the run's first level lands.
    applyCost: (cost) => ({ ...cost, cultureLevelReq: Math.max(1, cost.cultureLevelReq ?? 0) }),
  },
  convoy: {
    id: 'convoy',
    name: 'Convoy',
    description: '+1 ⚔️ to any yield, −1 🪙 upkeep',
    icon: '🛡️',
    cost: 5,
    appliesTo: (c) => c.kind === 'trade',
    // Both halves of the trade-off ride this one hook, because `gainResources` folds stickers over
    // *every* slot a card gains through and a route's two are its yield and its all-negative `upkeep`
    // rent. The bag's own sign says which it is: the escort rides with the yield, and its wages deepen
    // the rent — charged every round it stands, in the currency the route already pays in, so the
    // decision is whether the ⚔️ outruns the standing 🪙 rather than whether one 🔨 payment is
    // affordable. An empty bag is neither slot and is left alone; two copies stack additively either way.
    applyGain: (base) => {
      if (!base) return base;
      const values = Object.values(base);
      if (values.some((v) => (v ?? 0) > 0)) return { ...base, military: (base.military ?? 0) + 1 };
      return values.some((v) => (v ?? 0) < 0) ? { ...base, money: (base.money ?? 0) - 1 } : base;
    },
  },
  bronze_tools: {
    id: 'bronze_tools',
    name: 'Bronze Tools',
    description: '+1 🔨, needs a 🏝️ route to play and to work',
    icon: '🛠️',
    cost: 5,
    appliesTo: producerOf('production'),
    // The edge is only as good as the metal behind it: with no board to read (a face, a deck tile) the
    // potential rate is the only honest answer, and with one the tin has to be flowing. Conditioning the
    // sticker's own +1 and nothing else is what keeps two attached copies commutative.
    applyGain: (base, G) =>
      base && (!G || tinRouteStands(G)) ? { ...base, production: (base.production ?? 0) + 1 } : base,
    // A surcharge in the one currency `applyCost`'s resource fields can't name. Setting the gate rather
    // than composing with an existing one is what keeps two attached copies commutative — the catalogue
    // has one such gate, so there is nothing to compose with.
    applyCost: (cost) => ({ ...cost, check: needsTinRoute }),
  },
  wheel: {
    id: 'wheel',
    name: 'Wheel',
    description: '−1 🔨, needs 🎭 level 1',
    icon: '🛞',
    cost: 5,
    // Any card that actually pays 🔨, whatever its kind (so it can't be wasted on a card it can't
    // help); wonders are excluded globally by `stickerAppliesTo`. Keyed on the cost alone rather than
    // a kind list, so a card moving between kinds can't silently fall out of the sticker's reach.
    // `applyCost` owns its own floor at 0.
    appliesTo: (c) => (c.cost.resources?.production ?? 0) > 0,
    // A card already demanding a culture level pays nothing extra for the cartwright, so the trade-off
    // lands on the early cheap 🔨 cards it most wants to discount and fades on the ones a run reaches
    // late anyway.
    applyCost: (cost) => ({
      ...cost,
      cultureLevelReq: Math.max(1, cost.cultureLevelReq ?? 0),
      resources: { ...cost.resources, production: Math.max(0, (cost.resources?.production ?? 0) - 1) },
    }),
  },
};
