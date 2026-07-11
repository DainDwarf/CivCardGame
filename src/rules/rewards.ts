import { grantCopies, isOwned, type OwnedCards } from './collection';
import type { MissionDef } from '../content/missions';

/** The player's unlock progress — the `PlayerStore` fields a mission reward grows, bundled so they
 *  flow through `computeRewards` as one value (in unchanged, out with this mission's unlocks folded
 *  in) instead of a run of transposable positional args. Mirrors the same-named `PlayerStore` fields
 *  exactly, so the caller builds one from the store and spreads the result back. Card unlocks grow
 *  `collection` (per-copy ownership); each sticker/board unlock is an id set-union (membership is the
 *  whole state, so re-unlocking is idempotent). */
export interface UnlockProgress {
  collection: OwnedCards;
  unlockedStickers: Record<string, true>;
  unlockedBoardStickers: Record<string, true>;
  unlockedBoards: Record<string, true>;
}

/** What a completed run pays out: Influence plus the player's `progress` grown by this mission's
 *  unlocks (`collection` + the three unlock sets). The caller folds both back into `PlayerStore`. */
export interface RewardOutcome {
  influence: number;
  progress: UnlockProgress;
}

/**
 * A `'standard'` mission's reward is a one-time first-clear bonus (docs/DESIGN.md, "Economy
 * & progression") — replaying an already-completed mission pays nothing. `alreadyCompleted`
 * must reflect `mapProgress` *before* this run's result is folded in, or every clear would
 * look like a first clear. A mission may unlock several cards at once (`unlockCardIds`); each is
 * granted independently, and one already owned (e.g. a later mission reusing the same card) is a
 * no-op rather than double-granting a copy. It may likewise unlock card/board stickers and boards
 * (`unlockStickerIds`/`unlockBoardStickerIds`/`unlockBoardIds`) — each an id set-union, idempotent
 * (membership is the whole state, so re-unlocking is harmless).
 *
 * `progress` passes *through*: it enters as the player's current unlock state and leaves with this
 * mission's unlocks folded in — the caller folds the one returned value back. Every non-granting exit
 * (infinite, already-completed, no reward) returns it unchanged, never dropping any set.
 *
 * An `'infinite'` mission (Step 6) has no fixed win state and never touches `mapProgress`
 * (see `App.tsx`'s `recordResult`), so its payout is unconditional instead: Influence equal
 * to `turnsTaken` (rounds survived), paid on *every* attempt regardless of `alreadyCompleted`
 * or whether the run's outcome reads as victory or defeat — there is no unlock to grant.
 */
export function computeRewards(
  mission: MissionDef,
  alreadyCompleted: boolean,
  progress: UnlockProgress,
  turnsTaken?: number,
): RewardOutcome {
  if (mission.kind === 'infinite') return { influence: turnsTaken ?? 0, progress };
  if (alreadyCompleted || !mission.reward) return { influence: 0, progress };
  const { influence, unlockCardIds, unlockStickerIds, unlockBoardStickerIds, unlockBoardIds } = mission.reward;
  // Grant every not-yet-owned unlock (a mission may open several cards at once). Already-owned
  // ones are skipped rather than double-granted, exactly as the single-unlock path did.
  const collection = (unlockCardIds ?? []).reduce(
    (coll, cardId) => (isOwned(coll, cardId) ? coll : grantCopies(coll, cardId, 1)),
    progress.collection,
  );
  const unionIds = (set: Record<string, true>, ids: string[] | undefined) =>
    (ids ?? []).reduce((acc, id) => ({ ...acc, [id]: true as const }), set);
  return {
    influence,
    progress: {
      collection,
      unlockedStickers: unionIds(progress.unlockedStickers, unlockStickerIds),
      unlockedBoardStickers: unionIds(progress.unlockedBoardStickers, unlockBoardStickerIds),
      unlockedBoards: unionIds(progress.unlockedBoards, unlockBoardIds),
    },
  };
}
