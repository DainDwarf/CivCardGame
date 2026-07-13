import type { CoreResources, StrategicResources } from '../rules/resources';

/**
 * Reference text for the Codex submenu (`components/Codex.tsx`) — the in-game "how the
 * game works" glossary, reachable from both the meta menu and mid-run. This holds only
 * the *list-shaped* pages (the core/strategic resource tables and the keyword glossary)
 * as typed data; the narrative pages (card kinds, staffing, turn structure) are authored
 * as prose directly in the component. It's UI reference text, not game logic — there's
 * precedent for such strings living in `content/` (missions' `victoryHint`/`failureHint`).
 *
 * Where a rule has a *tuned number* in code (food-per-pop, culture band widths), describe
 * the mechanic and let the component pull the live value from `rules/` rather than
 * transcribing it here — a hardcoded copy would silently drift when balance is retuned.
 */

/** One core resource's reference row. `key` ties it to the shared `RESOURCE_ICON` map. */
export interface CoreResourceEntry {
  key: keyof CoreResources;
  name: string;
  /** What the resource is for. */
  role: string;
}

/** The 5 core resources — spendable, and fatal to the run if any goes below zero (see the
 *  warning callout above this list in `Codex.tsx`, not repeated per-resource here). */
export const CODEX_CORE_RESOURCES: CoreResourceEntry[] = [
  { key: 'food', name: 'Food', role: 'Feeds your population — each person eats food every round. More food sustains a larger population, and so more workers.' },
  { key: 'production', name: 'Production', role: 'The build currency. Spent to play permanent building cards.' },
  { key: 'money', name: 'Money', role: 'The treasury. Spent on immediate, temporary actions.' },
  { key: 'science', name: 'Science', role: 'Planning and card manipulation — drawing, retrieving, peeking.' },
  { key: 'military', name: 'Military', role: 'Power projection. Defends against disasters and enables expansion.' },
];

/** One strategic gauge's reference row. `key` ties it to the shared `RESOURCE_ICON` map, exactly
 *  like `CoreResourceEntry`. */
export interface StrategicEntry {
  key: keyof StrategicResources;
  name: string;
  role: string;
}

/** The 3 strategic gauges — never spent; they define the shape of your civilization. */
export const CODEX_STRATEGIC: StrategicEntry[] = [
  { key: 'population', name: 'Population', role: 'Your workforce. Workers are drawn from the idle population pool to staff buildings. Food production caps how large a population you can sustain.' },
  { key: 'territory', name: 'Territory', role: 'The land you control — a cap on how many buildings can occupy your tableau. Expand it to raise the cap.' },
  { key: 'culture', name: 'Culture', role: 'How much your civilization shines. Accumulates through discrete levels; each level raises your hand size, and some cards require a minimum culture level to play.' },
];

/** One keyword-glossary entry: the small print that appears on cards and building boxes. */
export interface GlossaryEntry {
  term: string;
  definition: string;
}

/** The keyword glossary — mechanics named on cards without in-place explanation. Numbers
 *  that are tuned in code are described, not quoted (e.g. the culture band widths). */
export const CODEX_GLOSSARY: GlossaryEntry[] = [
  { term: 'Discard cost', definition: 'You must discard that many other cards from your hand to play it.' },
  { term: 'Culture requirement', definition: 'The card can only be played once your culture has reached the required level. Culture is not consumed.' },
  { term: 'Territory', definition: 'The cap on how many buildings your tableau can hold. Raise it with expansion cards.' },
  { term: 'Removed vs. discard', definition: 'By default, a card returns to the discard pile once it leaves play — reshuffled into the deck when it runs dry. The removed pile is the exception: a card that is removed lands there, gone for the rest of the run.' },
];
