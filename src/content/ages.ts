import type { MissionDef } from './missions';

/**
 * Ages of humanity's history — the chronological bands running along the top of the
 * campaign map (`meta/CampaignMap.tsx`). An age labels a *range* of the timeline so the
 * player can orient themselves in history; each renders as a large right-arrow band above
 * its columns, with a matching gradient wash behind the DAG nodes beneath.
 *
 * The content target is the first three campaign ages — **Stone Age → Bronze Age →
 * Iron Age** — each rendered as its own themed arrow band (the Paleolithic sits *before* the
 * tree as the always-owned starting baseline, not as a band; see docs/DESIGN.md). The eventual
 * product extends this sequence further (… → Information Age); adding an age is a data change
 * here plus its color tokens in `index.css`.
 *
 * **Each age covers its slice of the DAG.** A mission declares which age it belongs to
 * (`MissionDef.age`), and an age's slice of the timeline is *derived* from its missions'
 * columns rather than authored — see `ageColSpans`. An age with no placed missions gets no band;
 * before any `'standard'` mission is placed, `ageColSpans` returns `[]` and the map renders no
 * bands at all.
 */
export interface AgeDef {
  id: string;
  name: string;
}

export const AGES: AgeDef[] = [
  { id: 'stone', name: 'Stone Age' },
  { id: 'bronze', name: 'Bronze Age' },
  { id: 'iron', name: 'Iron Age' },
];

export interface AgeColSpan {
  age: AgeDef;
  /** First column of this age's slice (inclusive). */
  startCol: number;
  /** One past the last column of this age's slice (exclusive). */
  endCol: number;
}

/**
 * Derive each age's contiguous column slice of the campaign DAG from the missions that live in
 * it — the model behind the campaign map's age bands + gradient wash (`meta/CampaignMap.tsx`).
 *
 * Only `'standard'` missions carrying both `map` and `age` contribute (an age with no missions
 * gets no slice). The present ages are ordered by their index in `AGES` (chronology), and their
 * slices tile the whole timeline gap-free so the bands/wash join seamlessly: the first present
 * age starts at column 0, each later age starts at its own earliest mission column, each age
 * ends where the next present age begins, and the last age extends to `maxCol + 1` (one past the
 * furthest standard mission). Returns `[]` when no standard mission is placed yet (dormant).
 *
 * Assumes ages don't interleave (every mission of an earlier age sits at a lower column than any
 * mission of a later age) — pinned by a coherence test over the real catalogue.
 */
export function ageColSpans(missions: MissionDef[]): AgeColSpan[] {
  const placed = missions.filter(
    (m) => m.kind === 'standard' && m.map !== undefined && m.age !== undefined,
  );
  if (placed.length === 0) return [];

  const maxCol = placed.reduce((max, m) => Math.max(max, m.map!.col), 0);

  // The earliest column of each present age, walked in AGES (chronological) order.
  const present: { age: AgeDef; minCol: number }[] = [];
  for (const age of AGES) {
    const cols = placed.filter((m) => m.age === age.id).map((m) => m.map!.col);
    if (cols.length > 0) present.push({ age, minCol: Math.min(...cols) });
  }

  return present.map(({ age }, i) => ({
    age,
    // First present age fills from the timeline's start; later ages from their own earliest column.
    startCol: i === 0 ? 0 : present[i].minCol,
    // Tile up to the next present age's start; the last age runs one past the furthest mission.
    endCol: i < present.length - 1 ? present[i + 1].minCol : maxCol + 1,
  }));
}
