/**
 * Ages of humanity's history — the chronological bands running along the top of the
 * campaign map (`meta/CampaignMap.tsx`). An age labels a *range* of the timeline so the
 * player can orient themselves in history; each renders as a large right-arrow band above
 * its columns.
 *
 * Phase 3 Step 5.1 ships a single placeholder age ("Testing") spanning the whole map.
 * The eventual product has a long sequence of real ages (Stone Age → … → Information Age);
 * adding them is meant to be a data change here — the age→column-range mapping that will
 * position each band over its own stretch of the timeline is deliberately *not* built yet
 * (there's only one age to place).
 */
export interface AgeDef {
  id: string;
  name: string;
}

export const AGES: AgeDef[] = [{ id: 'testing', name: 'Testing' }];
