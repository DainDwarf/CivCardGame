import { CARDS, type CardKind } from './cards';
import { MISSIONS } from './missions';
import { cultureForLevel } from '../rules/culture';
import { MAX_WONDERS_PER_DECK } from '../rules/deckBuilder';
import { BASE_HAND_SIZE } from '../rules/state';
import type { CoreResources, Resources, StrategicResources } from '../rules/resources';

/**
 * Reference text for the Codex submenu (`components/Codex.tsx`) — the in-game "how the
 * game works" glossary, reachable from both the meta menu and mid-run. It's UI reference text,
 * not game logic — there's precedent for such strings living in `content/` (missions'
 * `victoryHint`/`failureHint`).
 *
 * Two shapes live here. The *list-shaped* pages (the resource tables, the card-kind table, the
 * keyword glossary) are typed rows the component lays out itself. The two *block-rendered* texts
 * (`CODEX_HOW_TO_PLAY`, `CODEX_BETWEEN_MISSIONS`) are `CodexBlock[]` drawn by
 * `components/CodexBlocks.tsx`, because each is shown twice — as a Codex page and as its one-time
 * tutorial popup (`components/TutorialPopup.tsx`) — and one authored copy is what keeps the two
 * surfaces identical. The remaining narrative pages are authored as prose in the component.
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
  { key: 'food', name: 'Food', role: 'Your population eats every round, so food is what limits how large you can grow. The upkeep grows always faster: first worker needs no food, next two eat 1 food each, next two eat 2 food each, etc.' },
  { key: 'production', name: 'Production', role: 'Buildings and wonders are paid for in production, and many work cards, actions and events charge it too.' },
  { key: 'money', name: 'Money', role: 'Money opens trade routes and pays their rent, for as long as they stand.' },
  { key: 'military', name: 'Military', role: 'Playing an event card to remove it is usually paid in military, and some actions and mission goals call for it too.' },
  { key: 'science', name: 'Science', role: 'Used for planning and card manipulation — drawing, retrieving, peeking.' },
];

/** One strategic gauge's reference row. `key` ties it to the shared `RESOURCE_ICON` map, exactly
 *  like `CoreResourceEntry`. */
export interface StrategicEntry {
  key: keyof StrategicResources;
  name: string;
  role: string;
}

/** The 3 strategic gauges — the shape of your civilization rather than a per-round budget. */
export const CODEX_STRATEGIC: StrategicEntry[] = [
  { key: 'population', name: 'Population', role: 'Your population works the land and staffs your buildings. A bigger population eats more food each round. If your population ever reaches zero, the run ends.' },
  { key: 'territory', name: 'Territory', role: 'The land you control, and how much you can build on it. Every building and wonder takes one slot for the rest of the run. Work cards and trade routes take none.' },
  { key: 'culture', name: 'Culture', role: `Culture builds up and is never spent. What counts is the level it has reached: level 1 at ${cultureForLevel(1)} culture, level 2 at ${cultureForLevel(2)}, level 3 at ${cultureForLevel(3)}, level 4 at ${cultureForLevel(4)}. Each level raises your hand size by one, and some cards need a culture level before you can play them.` },
];

/** One card kind's reference row. `kind` ties it to `CardKind` — the field the coherence check pins
 *  this table's coverage on, exactly as `key` does for the resource rows. */
export interface CardKindEntry {
  kind: CardKind;
  name: string;
  definition: string;
}

/** The 8 card kinds, in `cards.ts`'s `KIND_RANK` display order (the order every card listing
 *  uses). `threat` and `objective` never reach a hand or pile — they're described by where the
 *  player actually meets them, the board's objective plaque and threat zone. */
export const CODEX_CARD_KINDS: CardKindEntry[] = [
  {
    kind: 'building',
    name: 'Building',
    definition:
      'Buildings are placed on one of your territories, where they produce every round while staffed. They stay in play for the rest of the run.',
  },
  {
    kind: 'wonder',
    name: 'Wonder',
    definition:
      `Unique buildings. Played and staffed exactly like a building, but a Wonder is one of a kind: you can never buy extra copies, it takes no stickers, and a deck may hold at most ${MAX_WONDERS_PER_DECK}.`,
  },
  {
    kind: 'work',
    name: 'Work',
    definition:
      'Play one onto the board and assign workers to it just like a building, but it costs no territory and returns to the discard pile. A staffed work card produces its output at the end of the round.',
  },
  {
    kind: 'action',
    name: 'Action',
    definition:
      'Resolve their effect immediately, then return to the discard pile.',
  },
  {
    kind: 'trade',
    name: 'Trade route',
    definition:
      'Pay their cost to open a route. A route needs no workers and no territory, but its rent is charged every round for the rest of the run, and you cannot close one yourself.',
  },
  {
    kind: 'event',
    name: 'Event',
    definition:
      'Disasters a mission shuffles into your deck. Pay an event’s cost to remove it from your deck. Left in your hand, its effect hits you at the end of the round, and the card returns to your discard pile.',
  },
  {
    kind: 'threat',
    name: 'Threat',
    definition:
      'An unplayable card a mission sticks onto your board for the whole run. It changes the rules of that mission and takes its upkeep every round, and some carry a defeat condition of their own.',
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
  { term: 'Culture requirement', definition: 'You can only play the card once your culture level has reached the number shown. Playing it spends no culture.' },
  { term: 'Single use', definition: 'Instead of being discarded, this card is removed from the run once used.' },
];

/** A fragment of a block-rendered paragraph: prose, a bolded run, or a run of resource glyphs.
 *  The glyph map is `CardFace.tsx`'s `RESOURCE_ICON` — shell, which the core may not import — so a
 *  span names the *resources* and the renderer looks their icons up. */
export type CodexSpan = string | { bold: string } | { icons: (keyof Resources)[] };

/** One entry of a `steps`/`bullets` block. The renderer prints `name — text`. */
export interface CodexListItem {
  name: string;
  text: string;
}

/** One block of a block-rendered Codex text (`components/CodexBlocks.tsx`). `steps` is ordered,
 *  `bullets` is not; neither surface knows which blocks it is drawing. */
export type CodexBlock =
  | { kind: 'para'; spans: CodexSpan[] }
  | { kind: 'steps'; heading: string; items: CodexListItem[] }
  | { kind: 'bullets'; heading: string; items: CodexListItem[] };

/** The first mission's card unlocks — the campaign's DAG roots (no `prereqs`) are the only missions
 *  a fresh player can clear first, so by the time `CODEX_BETWEEN_MISSIONS` fires these are exactly
 *  the cards just handed over. */
const rootUnlockCardIds = Object.values(MISSIONS)
  .filter((m) => m.prereqs.length === 0)
  .flatMap((m) => m.reward?.unlockCardIds ?? []);

const listAnd = (parts: string[]): string =>
  parts.length <= 1 ? parts[0] ?? '' : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

const rootUnlockNames = listAnd(rootUnlockCardIds.map((id) => `${CARDS[id].display?.art ?? ''} ${CARDS[id].name}`.trim()));

/** The run-loop primer: the Codex's first page, and the popup shown the first time a run opens. */
export const CODEX_HOW_TO_PLAY: CodexBlock[] = [
  {
    kind: 'para',
    spans: [{ bold: 'Your goal is on the objective card' }, ', on the left of the board. Meet it and you win the mission.'],
  },
  {
    kind: 'para',
    spans: [
      { bold: 'Losing' },
      ' — if any core resource (',
      { icons: CODEX_CORE_RESOURCES.map((r) => r.key) },
      ') drops below zero, the run ends. A bigger population eats more food each round.',
    ],
  },
  {
    kind: 'steps',
    heading: 'Each round',
    items: [
      { name: 'Draw', text: `you draw a new hand from your deck, ${BASE_HAND_SIZE} cards by default.` },
      { name: 'Play', text: "play cards from your hand. A card's cost is printed in its upper right corner." },
      {
        name: 'Staff',
        text: 'buildings and work cards need workers to produce. Playing those cards automatically staffs them from your idle population. You can freely drag workers between cards to change who does what.',
      },
      {
        name: 'End round',
        text: 'staffed cards produce, then your population eats food. Your hand goes to the discard pile, and the next round starts.',
      },
    ],
  },
  {
    kind: 'bullets',
    heading: 'Card types',
    items: [
      { name: 'Action', text: 'an immediate effect, then discard.' },
      { name: 'Work', text: 'staff it, it produces once at the end of the round, then returns to the discard pile.' },
      { name: 'Building', text: 'takes one territory slot and stays for the rest of the run, producing every round while staffed.' },
      { name: 'Trade route', text: 'pay to open it. It produces every round, but charges rent every round, and you cannot close it.' },
      {
        name: 'Event',
        text: 'a mission shuffles these into your deck. Pay its cost to play it and it is removed from the run. Leave it in your hand and it strikes at the end of the round, then goes to your discard pile and comes back later.',
      },
      { name: 'Threat', text: 'pinned to your board by the mission. You cannot play it, and it takes its toll every round.' },
    ],
  },
  {
    kind: 'para',
    spans: ['Your deck cannot be changed during a run. When the draw pile is empty, the discard pile is shuffled into a new one.'],
  },
  { kind: 'para', spans: ['Full rules are in the ', { bold: 'Codex' }, ', in the ☰ menu.'] },
];

/** The meta-loop primer: a Codex page, and the popup shown once the player's first victory has
 *  handed back a Collection they now have to build a deck out of. */
export const CODEX_BETWEEN_MISSIONS: CodexBlock[] = [
  {
    kind: 'para',
    spans: [
      { bold: 'New cards do not join your deck on their own.' },
      ' Cards you unlock go to your ',
      { bold: 'Collection' },
      '. A run never changes your deck: you build it yourself and edit it by hand, between missions, in the ',
      { bold: 'Decks' },
      ' screen.',
    ],
  },
  {
    kind: 'para',
    spans: [
      { bold: 'Each mission asks for something different.' },
      " Read the mission's goal on the map before you launch. Some goals can only be reached with specific cards — if your deck cannot get there, you need to change your deck.",
    ],
  },
  {
    kind: 'bullets',
    heading: 'Where things are',
    items: [
      { name: 'Mission', text: 'the campaign map. Pick your next mission and launch it with a deck and a board.' },
      { name: 'Collection', text: 'every card you own. Spend ⭐ Influence here on extra copies and on stickers.' },
      { name: 'Board', text: 'your governments. A board sets the resources you start a run with.' },
      { name: 'Decks', text: 'build, copy and edit your decks.' },
    ],
  },
  {
    kind: 'para',
    spans: [
      { bold: `Your next mission needs the cards you have just unlocked: ${rootUnlockNames}.` },
      ' Open ',
      { bold: 'Decks' },
      ' and add them now.',
    ],
  },
];
