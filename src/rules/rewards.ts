import { isOwned, type OwnedCards } from './collection';
import type { MissionDef } from '../content/missions';

/** What a completed run actually pays out: Influence plus (if not already owned) the
 *  mission's card unlock. */
export interface RewardOutcome {
  influence: number;
  collection: OwnedCards;
}

/**
 * A mission's reward is a one-time first-clear bonus (docs/DESIGN.md, "Economy &
 * progression") — replaying an already-completed mission pays nothing. `alreadyCompleted`
 * must reflect `mapProgress` *before* this run's result is folded in, or every clear would
 * look like a first clear. Owning the unlock card already (e.g. a future mission reusing
 * the same card) is a no-op rather than double-granting a copy.
 */
export function computeRewards(mission: MissionDef, alreadyCompleted: boolean, collection: OwnedCards): RewardOutcome {
  if (alreadyCompleted) return { influence: 0, collection };
  const { influence, unlockCardId } = mission.reward;
  const nextCollection = isOwned(collection, unlockCardId) ? collection : { ...collection, [unlockCardId]: 1 };
  return { influence, collection: nextCollection };
}
