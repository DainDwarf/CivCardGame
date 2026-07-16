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
 * A rule's *tuned number* (e.g. the wonder-per-deck cap) is always interpolated live from
 * `rules/` — here or by the component — never transcribed as a literal, which would silently
 * drift when balance is retuned.
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
  { key: 'military', name: 'Military', role: 'Power projection. Defends against disasters and enables expansion.' },
  { key: 'science', name: 'Science', role: 'Planning and card manipulation — drawing, retrieving, peeking.' },
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
  { key: 'population', name: 'Population', role: 'You need population to work the land and power your buildings. But a bigger population needs more food, so be wary of overextending!' },
  { key: 'territory', name: 'Territory', role: 'The land you control. It sets how many buildings and wonders can stand in your tableau — expand it to make room for more.' },
  { key: 'culture', name: 'Culture', role: 'How much your civilization shines. Each culture level raises your hand size, and some cards require a minimum culture level to play.' },
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
      'Pay their cost to place them on one of your territories, where they produce every round while staffed. They stay in play for the rest of the run.',
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
      'Playing one sticks it onto your board for one turn. Assign workers to it just like a building; a staffed work card produces its output at the end of the round, then returns to the discard pile.',
  },
  {
    kind: 'action',
    name: 'Action',
    definition:
      'Resolve their effect immediately, then return to the discard pile.',
  },
  {
    kind: 'event',
    name: 'Event',
    definition:
      'Disasters a mission shuffles into your deck. Left in your hand, an event’s effect strikes at the end of the turn. Pay its cost to remove it instead.',
  },
  {
    kind: 'threat',
    name: 'Threat',
    definition:
      'An unplayable card a mission sticks onto your board, changing the rules for that mission. Outpace it, or reach your goal before it wears you down.',
  },
  {
    kind: 'objective',
    name: 'Objective',
    definition:
      'Your mission’s goal. It tracks your progress live, and you win the moment its conditions are all met.',
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
  { term: 'Territory', definition: 'How many buildings and wonders your tableau can hold.' },
  { term: 'Single use', definition: 'Instead of being discarded, this card is removed from the run once used.' },
];
