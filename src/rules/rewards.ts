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
 * One unlock a clear newly opens. The *names* of what `computeRewards` grants, which that function
 * returns no account of — it folds each grant into `progress` and an idempotent set-union leaves no
 * trace of which ids were actually new. Two surfaces need exactly that account: the run-end overlay,
 * to know whether the clear carries anything at all (its sealed teaser names nothing, so a count is
 * the whole of what it reads), and the meta menu's reveal, which shows them one by one. Both read it
 * off the *pre-clear* `progress`, the same value `computeRewards` grants against, so neither can
 * disagree with what was granted.
 *
 * `boardUpgrade` is the odd one out here as it is there: a replacement, not an unlock, so it carries
 * the board it retires alongside the one it opens.
 */
export type PendingUnlock =
  | { kind: 'card' | 'sticker' | 'boardSticker' | 'board'; id: string }
  | { kind: 'boardUpgrade'; id: string; from: string };

/**
 * What a clear newly opens, in the order the reveal shows them: cards, card stickers, board
 * stickers, boards, then the board upgrade — the transformation last, since it re-frames the board
 * every other unlock will be played on. Empty on every path `computeRewards` grants nothing:
 * an infinite mission, a replay, a mission with no reward — and an already-owned card or an
 * already-unlocked id is filtered out the same way the grant skips it.
 *
 * Both arguments mean exactly what they mean to `computeRewards`, and the caller gates on the run's
 * outcome the same way `applyRunResult` does.
 */
export function pendingUnlocks(
  mission: MissionDef,
  alreadyCompleted: boolean,
  progress: UnlockProgress,
): PendingUnlock[] {
  if (mission.kind === 'infinite' || alreadyCompleted || !mission.reward) return [];
  const { unlockCardIds, unlockStickerIds, unlockBoardStickerIds, unlockBoardIds, boardUpgrade } = mission.reward;
  return [
    ...(unlockCardIds ?? [])
      .filter((id) => !isOwned(progress.collection, id))
      .map((id) => ({ kind: 'card' as const, id })),
    ...(unlockStickerIds ?? [])
      .filter((id) => !progress.unlockedStickers[id])
      .map((id) => ({ kind: 'sticker' as const, id })),
    ...(unlockBoardStickerIds ?? [])
      .filter((id) => !progress.unlockedBoardStickers[id])
      .map((id) => ({ kind: 'boardSticker' as const, id })),
    ...(unlockBoardIds ?? [])
      .filter((id) => !progress.unlockedBoards[id])
      .map((id) => ({ kind: 'board' as const, id })),
    ...(boardUpgrade && !progress.unlockedBoards[boardUpgrade.to]
      ? [{ kind: 'boardUpgrade' as const, id: boardUpgrade.to, from: boardUpgrade.from }]
      : []),
  ];
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
 * An `'infinite'` mission has no fixed win state and never touches `mapProgress`
 * (see `App.tsx`'s `recordResult`), so its payout is unconditional instead: Influence equal
 * to `score` — the attempt under the mission's own measure (`RunResult.stats.score`; the
 * objective card's `score`) — paid on *every* attempt regardless of `alreadyCompleted` or
 * whether the run's outcome reads as victory or defeat — there is no unlock to grant. An
 * attempt with no score pays nothing: either the objective declares no measure, or the
 * mission is `rewardless` (the sandbox), a no-stakes space that is both.
 */
export function computeRewards(
  mission: MissionDef,
  alreadyCompleted: boolean,
  progress: UnlockProgress,
  score?: number,
): RewardOutcome {
  if (mission.kind === 'infinite') return { influence: mission.rewardless ? 0 : (score ?? 0), progress };
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
