import type { BoardDef } from './boards';

/**
 * Board stickers (docs/DESIGN.md, "Government boards" / "Economy & progression"): permanent
 * modifiers bought with Influence and attached to a **board** forever, tweaking its *starting*
 * resource profile. They are the "board modifiers" the design calls out — one concept, not two.
 *
 * A board sticker is a **separate catalogue** from the card `StickerDef` (`content/stickers.ts`),
 * not an extension of it: it applies *once at run setup* (not per-resolution), may touch any of the
 * board's 8 starting values in its `resources` bundle — the 5 core plus the 3 strategic gauges
 * (population/territory/culture) — and has no per-instance attach identity (a board is singular). The
 * only thing shared with card stickers is the word "sticker".
 *
 * A board sticker **owns its own logic**: a single one-time `applyToBoard` hook (returns a modified
 * `BoardDef`), the same "the card/sticker owns its resolution" discipline the rest of the content
 * catalogues follow. Every consumer routes through `rules/boardStickers.ts` — the eligibility
 * dispatcher `boardStickerAppliesTo` and the `effectiveBoard` fold — which carry *no* sticker-specific
 * knowledge, so a new board sticker (with a new attach condition or a new profile tweak) is added
 * here alone, never at a call site. Deliberately small — real variety/balance is deferred.
 */
export interface BoardStickerDef {
  id: string;
  name: string;
  description: string;
  /** A distinct glyph identifying this sticker wherever an attached board shows a badge (the Board
   *  menu, the launch popup's board picker) — mirrors `StickerDef.icon`. */
  icon: string;
  /** Influence price to attach one copy. */
  cost: number;
  /** Which boards this sticker may attach to. Absent = any board. The sticker owns its own
   *  eligibility; every site routes through `rules/boardStickers.ts`'s `boardStickerAppliesTo`,
   *  never inspecting a board itself. Not pre-built for a use case — the seam for a future
   *  board-specific sticker ("+Military, Monarchy only"). */
  appliesTo?: (board: BoardDef) => boolean;
  /** This sticker's one-time contribution to a board's starting profile, applied *once per
   *  attached copy* — stacking (two of the same) and composing (two different) fall out of the
   *  fold in `rules/boardStickers.ts`'s `effectiveBoard`. Returns a modified `BoardDef` copy. */
  applyToBoard: (board: BoardDef) => BoardDef;
}

/**
 * The board-sticker catalogue. Each entry is *hidden until unlocked* by a mission reward
 * (`MissionDef.reward.unlockBoardStickerIds`) — purchasable only once
 * `PlayerStore.unlockedBoardStickers` holds its id (see `rules/upgrades.ts` / the Board tray).
 *
 * `granary` and `stockpile` are the first two, both unlocked by the "Growing Numbers" mission: a
 * fatter starting store of food and of production respectively, applied once at run setup.
 */
export const BOARD_STICKERS: Record<string, BoardStickerDef> = {
  granary: {
    id: 'granary',
    name: 'Granary',
    description: '+6 starting Food',
    icon: '🧺',
    cost: 6,
    applyToBoard: (b) => ({ ...b, resources: { ...b.resources, food: b.resources.food + 6 } }),
  },
  stockpile: {
    id: 'stockpile',
    name: 'Stockpile',
    description: '+6 starting Production',
    icon: '🪵',
    cost: 6,
    applyToBoard: (b) => ({ ...b, resources: { ...b.resources, production: b.resources.production + 6 } }),
  },
  opulence: {
    id: 'opulence',
    name: 'Opulence',
    description: '+10 starting Money',
    icon: '💎',
    cost: 10,
    applyToBoard: (b) => ({ ...b, resources: { ...b.resources, money: b.resources.money + 10 } }),
  },
};
