/**
 * Ages of humanity's history — the chronological bands running along the top of the
 * campaign map (`meta/CampaignMap.tsx`). An age labels a *range* of the timeline so the
 * player can orient themselves in history; each renders as a large right-arrow band above
 * its columns.
 *
 * The Phase-4 content target is the first three campaign ages — **Neolithic → Bronze Age →
 * Iron Age** — each rendered as its own themed arrow band (the Paleolithic sits *before* the
 * tree as the always-owned starting baseline, not as a band; see docs/DESIGN.md). The eventual
 * product extends this sequence further (… → Information Age); adding an age is a data change
 * here plus its color tokens in `index.css`.
 *
 * The age→column-range mapping that will position each band over its own stretch of the DAG is
 * deliberately *not* built yet — there are no `'standard'` missions to slice the timeline over
 * (only the infinite `sandbox`), so the bands currently just share the map width. That column
 * model lands with the first age's missions (Step 6), ideally derived from their `map.col`.
 */
export interface AgeDef {
  id: string;
  name: string;
}

export const AGES: AgeDef[] = [
  { id: 'neolithic', name: 'Neolithic' },
  { id: 'bronze', name: 'Bronze Age' },
  { id: 'iron', name: 'Iron Age' },
];
