import type { CardKind } from './cards';
import { MAX_WONDERS_PER_DECK } from '../rules/deckBuilder';
import type { CoreResources, StrategicResources } from '../rules/resources';

/**
 * Reference text for the Codex submenu (`components/Codex.tsx`) — the in-game "how the
 * game works" glossary, reachable from both the meta menu and mid-run. This holds the
 * *list-shaped* pages (the resource tables, the card-kind table, the keyword glossary) as
 * typed data; the narrative pages (staffing, turn structure) are authored as prose directly
 * in the component. It's UI reference text, not game logic — there's precedent for such
 * strings living in `content/` (missions' `victoryHint`/`failureHint`).
 *
 * A rule's *tuned number* (food-per-pop, culture band widths, the wonder-per-deck cap) is
 * always interpolated live from `rules/` — here or by the component — never transcribed as a
 * literal, which would silently drift when balance is retuned.
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
  { key: 'territory', name: 'Territory', role: 'The land you control — a cap on how many buildings and wonders can occupy your tableau. Expand it to raise the cap.' },
  { key: 'culture', name: 'Culture', role: 'How much your civilization shines. Accumulates through discrete levels; each level raises your hand size, and some cards require a minimum culture level to play.' },
];

/** One card kind's reference row. `kind` ties it to `CardKind` — the field the coherence check pins
 *  this table's coverage on, exactly as `key` does for the resource rows. */
export interface CardKindEntry {
  kind: CardKind;
  name: string;
  definition: string;
}

/** The 7 card kinds, in `cards.ts`'s `KIND_RANK` display order (the order every card listing
 *  uses). `threat` and `objective` never reach a hand or pile — they're described by where the
 *  player actually meets them, the board's objective plaque and threat zone. */
export const CODEX_CARD_KINDS: CardKindEntry[] = [
  {
    kind: 'building',
    name: 'Building',
    definition:
      'Pay their cost to place them in your tableau (one territory slot), where they produce every round while staffed. They stay in play for the rest of the run.',
  },
  {
    kind: 'wonder',
    name: 'Wonder',
    definition:
      `Unique monuments. Played and staffed exactly like a building, but a Wonder is one of a kind: you can never buy extra copies, it takes no stickers, and a deck may hold at most ${MAX_WONDERS_PER_DECK}.`,
  },
  {
    kind: 'work',
    name: 'Work',
    definition:
      'Labour cards. Playing one sticks it onto the board as a staffable box. Assign workers to it just like a building; only a staffed Work card produces its output at end of round. Then it returns to the discard pile.',
  },
  {
    kind: 'action',
    name: 'Action',
    definition:
      'Repeatable tactics — resolve their effect, then return to the discard pile. A few are marked single use: those leave for the removed pile instead, gone for the rest of the run.',
  },
  {
    kind: 'event',
    name: 'Event',
    definition:
      'Disasters a mission shuffles into your deck. You cannot build with them, but you can play them — and that choice is the whole mechanic. Leave one in your hand at the end of the round and it strikes you for free, then files to the discard, so it comes back round after round. Pay its cost to play it instead and it is removed for good, its disaster pre-empted.',
  },
  {
    kind: 'threat',
    name: 'Threat',
    definition:
      'Board hazards a mission seeds beside your objective, never in your deck or hand. A threat is not playable and stays for the whole run, taking its toll every round — outpace it, or reach your goal before it wears you down.',
  },
  {
    kind: 'objective',
    name: 'Objective',
    definition:
      'Your mission’s goal, made into a card and pinned in the corner of the board. It tracks your progress live, and you win the moment its conditions are all met.',
  },
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
  { term: 'Territory', definition: 'The cap on how many buildings and wonders your tableau can hold. Raise it with expansion cards.' },
  { term: 'Single use', definition: 'The card takes itself out of the run once it has done its job — it goes to the removed pile instead of the discard, so it never comes back around.' },
  { term: 'Removed vs. discard', definition: 'By default, a card returns to the discard pile once it leaves play — reshuffled into the deck when it runs dry. The removed pile is the exception: a card that is removed lands there, gone for the rest of the run.' },
];
