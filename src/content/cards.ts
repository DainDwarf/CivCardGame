import { scaleResources, subtractResources } from '../rules/resources';
import { bumpCounter, getCounter, setCounter, type CardInstance, type GameEventType, type GameState } from '../rules/state';
import { gainResources, type CardEffect, type GainModifier, suspendChoice } from '../rules/effects';
import type { CardCost } from '../rules/cost';
import { drawInstance, peekTop, recoverFromDiscard, spawnIntoDeck } from '../rules/deck';
import { assignedWorkers, freePopulation } from '../rules/population';
import { cultureForLevel, cultureProgress } from '../rules/culture';

export type CardKind = 'building' | 'wonder' | 'action' | 'work' | 'trade' | 'event' | 'threat' | 'objective';

/** A card's display-only concern (face text + art), read exclusively by the render path — no rule,
 *  move, upkeep, or resolver reads any of it. */
export interface CardDisplay {
  /** Hand-authored face text for a `resolve`-driven card the declarative `effect` can't describe.
   *  Keep it very short — it renders in a tiny footer band, so favour glyphs over a full sentence. */
  description?: string;
  /** Run-aware effect text: given the live state and this instance, returns that copy's *current*
   *  effect summary (e.g. a self-scaling card's growing gain). Static contexts (Collection, deck
   *  editor) have no instance and fall back to `description` — which should read as the base value. */
  dynamicText?: (G: GameState, self: CardInstance) => string;
  /** Static text describing *how* a dynamic card's effect scales, shown in the conditions band.
   *  Pairs with `dynamicText`, which supplies the current number below it. */
  dynamicRule?: string;
  /** A short presentational tag shown in the conditions band — a heads-up about behaviour the face's
   *  cost/effect text can't state (e.g. a self-removing card's "single use"). Display-only: it never
   *  drives logic, so it must be kept in step with the closure that actually implements the behaviour. */
  note?: string;
  /** The card's central art glyph, shown big on the face and on a building/work box. Optional — a
   *  card without one falls back to a per-kind default in `CardFace.tsx`'s `artFor`. Every deckable
   *  card must set it (pinned by `cards.test.ts`). */
  art?: string;
}

/** One sub-goal of an `objective` card: "reach `target` on `measure(G)`". Declarative by default;
 *  a goal that isn't a plain numeric threshold owns its own bespoke `met` closure — the escape hatch
 *  lives on the structure, the way `CardEffect` owns `resolve`. See `rules/objective.ts` for the
 *  `goalMet`/`goalProgress` folds every consumer (predicate, readout, sim gradient) reads through. */
export interface ObjectiveGoal {
  /** Glyph for the derived live readout (`goalsReadout`). Unread when the card overrides its readout
   *  via `display.dynamicText`. */
  icon: string;
  /** Current value toward this sub-goal — a pure read over `G`. */
  measure: (G: GameState) => number;
  /** Value of `measure` that satisfies the sub-goal. */
  target: number;
  /** Bespoke escape hatch: when present it decides satisfaction instead of `measure >= target`, for a
   *  goal that isn't a plain numeric threshold (e.g. the sandbox's never-winning `() => false`). */
  met?: (G: GameState) => boolean;
}

export interface CardDef {
  /** Machine key into `CARDS` and every rule target — stable identity, never shown to the player. */
  id: string;
  /** The shown label, *and* the sort key for every card listing (`compareCards`). */
  name: string;
  /** What the card *is* and where it goes after play — see docs/DESIGN.md → *Card kinds*. */
  kind: CardKind;
  /** Everything it takes to play — the price, any prerequisite, and the escape hatch for a cost that
   *  isn't a fixed number — as one `CardCost` (`rules/cost.ts`). `{}` = free and unconditional. */
  cost: CardCost;
  /** Worker capacity to operate — required on every staffable card (building/wonder/work), unread on
   *  the others. `0` = self-sufficient (always operating). No default: a missing field on a staffable
   *  throws (`population.ts`'s `cardWorkerCap`) rather than silently reading as 1. */
  workers?: number;
  /** The card's one-shot effect at its *entry moment* (a `CardEffect`; see `rules/effects.ts`): an
   *  `action`/`event` on play, a `building`/`wonder` at placement, a `threat` once at seed
   *  (`rules/threats.ts`'s `addThreat`). A played `event` resolves this *and* pre-empts its recurring
   *  `upkeep` disaster; a threat's recurring drain stays on `upkeep`/`on`, separate from this one-time
   *  entry. */
  effect?: CardEffect;
  /** A standing card's output **per round it stands on the board** — run through `resolveProduction`.
   *  A staffable scales its `resources` per staffed worker; a workerless `trade` route yields them flat.
   *  How many rounds that is belongs to the *kind*, not to this field: a building/wonder/route stands for
   *  the run, while a `work` box is filed at end of turn (`upkeep.ts`'s `discardWorkZone`) and so produces
   *  exactly **once per play**. May touch any of the 8 pools. Kept distinct from `effect` so a play-time
   *  field can never fire at the production boundary. */
  produces?: CardEffect;
  /** A recurring per-round effect fired *at the upkeep boundary*, flat (never per-worker-scaled like
   *  `produces`): a `threat`'s drain, an unplayed `event`'s upkeep disaster, a `trade` route's rent, or
   *  an operating staffable's maintenance. Composes with `produces` and `on.endTurn` — `resolveEndTurn`
   *  runs all three (`rules/effects.ts`); a card reacting to another trigger uses `on`. */
  upkeep?: CardEffect;
  /**
   * Event-bus reactions (`rules/events.ts`): a `CardEffect` per event type, for reacting to something
   * whose *timing the card doesn't own* (a draw, a discard elsewhere, a resource threshold, a round
   * passing). A handler's `resolve` must be **pure over `G`** (the projection clone re-runs it every
   * render), **never open a `pendingInteraction`**, and **`filter`, never `splice`** to self-remove.
   * A threat's driven defeat does NOT go through `on` — see `defeat` below.
   */
  on?: Partial<Record<GameEventType, CardEffect>>;
  /** A passive claim on what *other* cards yield, live for as long as this card stands on the board
   *  (`rules/effects.ts`'s `GainModifier`, folded by `gainResources`). Unlike the four timing slots
   *  above it fires at no moment of its own — every gain anywhere passes through it. */
  modifyGain?: GainModifier;
  /** `objective` cards only: the mission's win condition as declarative sub-goals — the single source
   *  the boolean predicate, the live readout, and the sim's steering gradient all derive from
   *  (`rules/objective.ts`). Won when *every* goal is met; a bare-read over `G`, never mutating it,
   *  bus-driven into `G.pendingVictory`. Defeat belongs elsewhere — a threat's `defeat` hook, or
   *  universal collapse in `run/engine.ts`. */
  goals?: ObjectiveGoal[];
  /** `threat` cards only: a driven (non-collapse) defeat as a pure-read predicate returning the reason
   *  string, or falsy. Never mutates `G`; bus-driven into `G.pendingDefeat` set-OR-CLEAR
   *  (`rules/threats.ts`), so it must not stick. A round deadline uses `round > N`, not `>= N` —
   *  `evaluateDefeat` runs at the flush right after `beginTurn` increments the round. */
  defeat?: (G: GameState, self: CardInstance) => string | false | undefined;
  /** Display-only concern (face text + art); see `CardDisplay`. */
  display?: CardDisplay;
}

/** Whether the player builds decks with this card. The single source for every such filter
 *  (deck-add reject, Collection/DeckEditor pickers). */
export function isDeckable(card: CardDef): boolean {
  return (
    card.kind === 'building' ||
    card.kind === 'wonder' ||
    card.kind === 'action' ||
    card.kind === 'work' ||
    card.kind === 'trade'
  );
}

/** Whether a card enters the **tableau** when played, taking one territory slot for the rest of the
 *  run. The single choke point for both the building/wonder placement branch (`moves.ts`,
 *  `Board.tsx`, `CardFace.tsx`) and the territory cap (`rules/territory.ts`, `playability.ts`) — the
 *  tableau is the only board zone territory sizes. */
export function isStructure(card: CardDef): boolean {
  return card.kind === 'building' || card.kind === 'wonder';
}

/** Whether a card *produces and is staffed at upkeep*. A card-kind predicate; distinct from
 *  `population.ts`'s instance-level `Staffable`, which operates on placed instances. */
export function isStaffable(card: CardDef): boolean {
  return isStructure(card) || card.kind === 'work';
}

/** Whether a card, once played, stands on the board for the rest of the run and so yields its
 *  `produces` every round — a structure holding its tableau slot, or a trade route in its own zone. A
 *  Work box is deliberately out: it produces too, but comes off the board at end of turn, so its
 *  `produces` pays once per play rather than per round. */
export function isDurableProducer(card: CardDef): boolean {
  return isStructure(card) || card.kind === 'trade';
}

/** Display order of card kinds — the primary key of `compareCards`; deckable kinds first. Total over
 *  `CardKind`, so its keys double as the enumeration of every kind: a new kind cannot type-check
 *  without landing here. */
export const KIND_RANK: Record<CardKind, number> = {
  building: 0,
  wonder: 1,
  work: 2,
  action: 3,
  trade: 4,
  event: 5,
  threat: 6,
  objective: 7,
};

/** Section heading for a card listing grouped by kind — plural, where the codex's `name` is the
 *  singular register. Total over `CardKind` like `KIND_RANK`, so a new kind cannot type-check
 *  without a heading. */
export const KIND_SECTION_LABEL: Record<CardKind, string> = {
  building: 'Buildings',
  wonder: 'Wonders',
  work: 'Work',
  action: 'Actions',
  trade: 'Trade routes',
  event: 'Events',
  threat: 'Threats',
  objective: 'Objectives',
};

/** Sort key: a leading "The " is dropped so "The Colossus" sorts under C. */
function sortName(card: CardDef): string {
  return card.name.replace(/^the\s+/i, '');
}

/** The one comparator for every card listing: group by kind, then alphabetical by name. Callers
 *  add their own instance-id tiebreak to keep a card's copies contiguous. */
export function compareCards(a: CardDef, b: CardDef): number {
  return KIND_RANK[a.kind] - KIND_RANK[b.kind] || sortName(a).localeCompare(sortName(b));
}

/** One kind's slice of a card listing. */
export interface CardSection {
  kind: CardKind;
  heading: string;
  cards: CardDef[];
}

/** Group a card listing into its display sections: one per kind actually present, in `KIND_RANK`
 *  order, `compareCards`-sorted within each. A kind with no card yields no section, so a caller
 *  narrowing its input renders fewer sections rather than empty ones. */
export function cardSections(cards: CardDef[]): CardSection[] {
  const byKind = new Map<CardKind, CardDef[]>();
  for (const card of cards) {
    const group = byKind.get(card.kind);
    if (group) group.push(card);
    else byKind.set(card.kind, [card]);
  }
  return [...byKind.entries()]
    .sort(([a], [b]) => KIND_RANK[a] - KIND_RANK[b])
    .map(([kind, group]) => ({ kind, heading: KIND_SECTION_LABEL[kind], cards: group.sort(compareCards) }));
}

/** The buildings "Growing Numbers" wants — shared by the win goal, the `dynamicText` readout, and the
 *  sim's steering override (`sim/objective.ts`), so none can list a different set. Each progress glyph
 *  is pulled from the building's own `art`. */
export const GROWING_NUMBERS_BUILDINGS: readonly string[] = ['hut', 'farm'];

/** Total 🗺️ "Growing Numbers" wants held at once — an absolute pool, not a gain over the board's
 *  start, so a wider government arrives closer to it. Shared by the win goal and its readout. */
export const GROWING_NUMBERS_TERRITORY = 2;

/** How many raider waves "Raiders at the Border" seeds — shared by the mission's injected event list
 *  (`content/missions.ts`), the `raiders_at_border_goal` win threshold, and its progress readout. */
export const RAIDER_WAVES = 3;

/** The 🌾 "The First Trades" wants banked alongside a standing route — shared by the win goal and the
 *  mission's `victoryHint`. It is the mission's whole balance knob: low enough and a forage-only line
 *  reaches it with the mandated route left decorative, high enough and a second workshop+route pair
 *  (Settlement's whole board, plus a Hut for the worker) is forced. Provisional (balance pending a sim
 *  sweep). */
export const FIRST_TRADES_FOOD = 25;

/** The round "Harsh Winter"'s famine first bites, and the round the winter breaks. Shared by the
 *  `deep_cold` threat's drain schedule, the `harsh_winter_goal` win threshold and the mission's hints,
 *  so the deadline can never drift from the drain that makes it one. The peak drain is their difference:
 *  rounds `ONSET..BREAK-1` take `1..BREAK-ONSET` 🌾, and reaching `BREAK` *is* the win, so the schedule
 *  needs no ceiling — the run always ends the round the ramp would continue past.
 *
 *  Both are the mission's balance knobs and provisional (pending a sim sweep): the gap before `ONSET`
 *  is preparation time, without which the mission only measures the board's starting stockpile, and
 *  the ramp's length sets both the 🌾 deficit to be banked against and how many rounds of ⚔️ toll the
 *  deck must fund. */
export const HARSH_WINTER_ONSET = 5;
export const HARSH_WINTER_BREAK = 10;

/** 🌾 the Deep Cold takes in the given round: nothing before the onset, then deepening by 1 each round.
 *  Shared by the drain and its face readout so the card can't display a bite it won't take. */
function famineAt(round: number): number {
  return Math.max(0, round - HARSH_WINTER_ONSET + 1);
}

/** How many copper veins "Finding Copper" seeds — shared by the mission's injected event list
 *  (`content/missions.ts`), the `finding_copper_goal` win threshold, and its progress readout. */
export const COPPER_VEINS = 3;

/** How many clay tablets "Writing" seeds — shared by the mission's injected event list
 *  (`content/missions.ts`), the `writing_goal` win threshold, and its progress readout. */
export const CLAY_TABLETS = 5;

/** How many road segments "Roads" seeds — shared by the mission's injected event list
 *  (`content/missions.ts`), the `roads_goal` win threshold, and its progress readout. */
export const ROADWORKS = 6;

/** How many wild horses "Horse Taming" seeds — shared by the mission's injected event list
 *  (`content/missions.ts`), the `horse_taming_goal` win threshold, and its progress readout. */
export const WILD_HORSES = 5;

/** How many strongholds "Raiding" seeds — shared by the mission's injected event list
 *  (`content/missions.ts`), the `raiding_goal` win threshold, and its progress readout. */
export const RAID_TARGETS = 4;

/** Horses already tamed: a wild horse reaches `removed` only by being played (paying its ⚔️), so the
 *  count there *is* the tally. Shared by the win threshold, its readout, and the `tamed_horses` drain,
 *  so the herd the threat feeds can't differ from the herd the goal counts. */
function tamedHorses(G: GameState): number {
  return G.removed.filter((c) => c.cardId === 'wild_horse').length;
}

/** How many voyages "Setting Sail" seeds — shared by the mission's injected event list
 *  (`content/missions.ts`), the `setting_sail_goal` win threshold, and its progress readout. */
export const VOYAGES = 3;

/** Consecutive rounds without a launch before the `impatient_crews` threat gives the run away —
 *  shared by the clock's tick, its countdown readout and the mission's `failureHint`. It is a pace
 *  limit, not a deadline: a launch puts it back to zero, so the run's hard ceiling is
 *  `VOYAGES × CREW_PATIENCE` rounds. Provisional (balance pending a sim sweep). */
export const CREW_PATIENCE = 12;

/** Voyages already launched: a voyage reaches `removed` only by being played (paying its 🪙+🔨 and
 *  its citizen), so the count there *is* the fleet. Shared by the win threshold, its readout and the
 *  `impatient_crews` clock, so the fleet the clock counts can't drift from the one the goal counts. */
function voyagesLaunched(G: GameState): number {
  return G.removed.filter((c) => c.cardId === 'voyage').length;
}

/** Territory the player must *gain* over the board's starting size to win "The Wheel" — shared by the
 *  `wheel_goal` win threshold, its progress readout, and the mission's `victoryHint`
 *  (`content/missions.ts`). Measured against `startResources` so it reads the same on a board that
 *  opens at 0 territory and one that opens at 2. */
export const WHEEL_TERRITORY = 6;

/** Territory gained that the `overextension` drain lets through free — the first expansions are
 *  toll-free on every board, and only the ones past the band are charged. Shared by the drain, its
 *  readout and the mission's `failureHint` (`content/missions.ts`). */
export const OVEREXTENSION_GRACE = 2;

/** The 🔨 "The Wheel"'s road upkeep charges next round — shared by the `overextension` drain and its
 *  readout, so the face can't quote a toll the threat doesn't take. */
function overextensionDrain(G: GameState): number {
  return Math.max(0, G.resources.territory - G.startResources.territory - OVEREXTENSION_GRACE);
}

/** The round by which the Pyramid tomb must be finished — shared by the `pharaohs_reign` threat's
 *  `defeat` deadline, its countdown readout, and the Pyramid mission's `failureHint`
 *  (`content/missions.ts`), so the shown deadline can't drift from the enforced one. Generous by
 *  design: the Pyramid is an optional challenge leaf, not an impossible one. */
export const PHARAOH_DEADLINE = 40;

/** How much stockpiled 🪙 breeds one extra Thief — shared by the `envious_population` threat's
 *  reshuffle spawn math and its readout, so the shown rate can't drift from the enforced one.
 *  Provisional (balance pending a sim sweep). */
export const THIEVES_PER_GOLD = 10;

/**
 * The card catalogue. Numbers are a first pass. Tests install synthetic `test_*` cards on top via
 * `rules/testFixtures.ts`.
 */
export const CARDS: Record<string, CardDef> = {
  // — Work —
  foraging: { id: 'foraging', name: 'Foraging', kind: 'work', cost: {}, workers: 1, display: { art: '🌿' }, produces: { resources: { food: 1 } } },
  toolmaking: { id: 'toolmaking', name: 'Toolmaking', kind: 'work', cost: {}, workers: 1, display: { art: '🪨' }, produces: { resources: { production: 1 } } },
  beer: { id: 'beer', name: 'Beer', kind: 'work', cost: { resources: { food: 1 } }, workers: 1, display: { art: '🍺' }, produces: { resources: { culture: 1 } } },
  trader: { id: 'trader', name: 'Trader', kind: 'work', cost: {}, workers: 1, display: { art: '💰' }, produces: { resources: { money: 3 } } },
  war_horse: { id: 'war_horse', name: 'War Horse', kind: 'work', cost: {}, workers: 1, display: { art: '🏇' }, produces: { resources: { military: 3 } } },

  // — Buildings —
  farm: { id: 'farm', name: 'Farm', kind: 'building', cost: { resources: { production: 2 } }, produces: { resources: { food: 1 } }, workers: 1, display: { art: '🌱' } },
  // Hut: a one-shot *placement* grant (+1 population when built) — on `effect`, not `produces`, so it
  //   fires once at placement rather than every round.
  hut: {
    id: 'hut', name: 'Hut', kind: 'building', cost: { resources: { production: 3 } }, workers: 0,
    display: { art: '🛖', description: 'When built: +1 🧍' },
    effect: { resources: { population: 1 } },
  },
  sun_stone: { id: 'sun_stone', name: 'Sun Stone', kind: 'building', cost: { resources: { production: 3 } }, produces: { resources: { culture: 1 } }, workers: 1, display: { art: '☀️' } },
  bead_workshop: { id: 'bead_workshop', name: 'Bead Workshop', kind: 'building', cost: { resources: { production: 2 } }, produces: { resources: { money: 1 } }, workers: 1, display: { art: '📿' } },
  forge: { id: 'forge', name: 'Forge', kind: 'building', cost: { resources: { production: 3 } }, produces: { resources: { production: 2 } }, workers: 1, display: { art: '⚒️' } },
  // The science counterpart of the Forge, on the same shape: a permanent building doubling the free
  // work card's rate, paid for once in 🔨 and a territory slot.
  archives: { id: 'archives', name: 'Archives', kind: 'building', cost: { resources: { production: 4 } }, produces: { resources: { science: 2 } }, workers: 1, display: { art: '🏛️' } },
  // House: the Hut's bigger cousin — a one-shot +2🧍 at placement (on `effect`, like Hut, so it grants
  //   population once when built rather than every round).
  house: {
    id: 'house', name: 'House', kind: 'building', cost: { resources: { production: 6 } }, workers: 0,
    display: { art: '🏠', description: 'When built: +2 🧍' },
    effect: { resources: { population: 2 } },
  },
  // City Walls: a standing garrison — self-sufficient (workers:0, always operating), so its per-round
  //   +1⚔️ `produces` fires with no worker staffed.
  city_walls: {
    id: 'city_walls', name: 'City Walls', kind: 'building', cost: { resources: { production: 3 } }, workers: 0,
    display: { art: '🧱', description: '+1 ⚔️ / round' },
    produces: { resources: { military: 1 } },
  },
  // The martial boards' standing perks (`boards.ts`'s `prebuilt`) rather than cards anyone draws or
  //   buys: neither produces anything itself, and both pay only through what the rest of the board
  //   takes. The spoils scale with the land, so a bigger seizure is worth proportionally more and each
  //   face's "each 🗺️" reads literally.
  raider_camp: {
    id: 'raider_camp', name: 'Raider Camp', kind: 'building', cost: {}, workers: 0,
    display: { art: '🏕️', description: 'Each 🗺️ you take:\n+4🌾' },
    modifyGain: (base) => {
      const taken = base?.territory ?? 0;
      if (!base || taken <= 0) return base;
      return { ...base, food: (base.food ?? 0) + 4 * taken };
    },
  },
  war_camp: {
    id: 'war_camp', name: 'War Camp', kind: 'building', cost: {}, workers: 0,
    display: { art: '⛺', description: 'Each 🗺️ you take:\n+8🌾 +2🪙' },
    modifyGain: (base) => {
      const taken = base?.territory ?? 0;
      if (!base || taken <= 0) return base;
      return { ...base, food: (base.food ?? 0) + 8 * taken, money: (base.money ?? 0) + 2 * taken };
    },
  },

  // The Port board's standing perk, a prebuilt like the two war camps above rather than a card anyone
  //   draws or buys — and the same bargain read off the other side: it produces nothing itself and pays
  //   only for the lanes the rest of the board opens. On `produces.resolve` rather than a declarative
  //   bundle because the amount comes off the trade zone, which `resolveProduction`'s per-worker scaling
  //   has no way to express — and this box holds no workers to scale by.
  wharf: {
    id: 'wharf', name: 'Wharf', kind: 'building', cost: {}, workers: 0,
    display: {
      art: '⚓',
      description: 'Each open 🚢 route:\n+1🎭 / round',
      dynamicText: (G) => `+${G.tradeRoutes.length}🎭 / round`,
    },
    produces: { resolve: (ctx) => gainResources(ctx, { culture: ctx.G.tradeRoutes.length }) },
  },

  // — Wonders —
  gobekli_tepe: {
    id: 'gobekli_tepe', name: 'Göbekli Tepe', kind: 'wonder',
    display: { art: '🗿', description: '+1🔨 +1🪙 +1🎭\nper worker.' },
    cost: { resources: { production: 8 }, cultureLevelReq: 1 }, workers: 3,
    produces: { resources: { production: 1, money: 1, culture: 1 } },
  },
  // The culture powerhouse — heavy 🎭 per worker where Göbekli is a balanced generalist. The 🌾 upkeep
  //   is the honest cost of the mortuary priests and labour it commands; the drain is *not* 🪙, which
  //   would be a false cost against the 🪙 it produces.
  pyramid: {
    id: 'pyramid', name: 'Pyramid', kind: 'wonder',
    display: { art: '🔺', description: '+2🎭 +1🪙 per worker.\n−2🌾 upkeep.' },
    cost: { resources: { production: 10, money: 6 }, cultureLevelReq: 2 }, workers: 4,
    produces: { resources: { culture: 2, money: 1 } },
    upkeep: { resources: { food: -2 } },
  },

  // — Actions —
  storytelling: { id: 'storytelling', name: 'Storytelling', kind: 'work', cost: {}, workers: 1, display: { art: '🗣️' }, produces: { resources: { science: 1 } } },
  bow: {
    id: 'bow', name: 'Bow', kind: 'action', cost: { resources: { production: 2 } },
    // The "single use" note is the face's heads-up for the self-removal below — kept in step with it.
    display: { art: '🏹', note: 'single use' },
    // A one-shot: grant the military (declarative, folded first) then exile this copy to `removed`
    // so it never recycles back into the deck. The play choke point skips its usual action→discard
    // file once the effect has already filed the copy (see `moves.ts`'s `playCard`).
    effect: { resources: { military: 3 }, resolve: (ctx) => { ctx.G.removed.push(ctx.self); } },
  },
  bartering: { id: 'bartering', name: 'Bartering', kind: 'trade', cost: { resources: { money: 1 } }, display: { art: '🤝' }, produces: { resources: { food: 2 } }, upkeep: { resources: { money: -1 } } },
  // The zone's second route, and Bartering at Bronze scale: the same buy-standing-yield-with-standing-
  //   rent shape, landing on 🔨 rather than 🌾. Its net 1.5🔨 per 🪙 is the Material Caravan's rate made
  //   permanent — the caravan pays it all at once and is gone, the lane pays it every round and the rent
  //   never stops, and nothing closes a route. Numbers provisional (balance pending a sim sweep).
  coastal_route: {
    id: 'coastal_route', name: 'Coastal Route', kind: 'trade', cost: { resources: { money: 3 } },
    display: { art: '🚢' },
    produces: { resources: { production: 3 } },
    upkeep: { resources: { money: -2 } },
  },
  dogs: { id: 'dogs', name: 'Hunting', kind: 'work', cost: {}, workers: 1, display: { art: '🐕' }, produces: { resources: { military: 1 } } },
  raiding: {
    id: 'raiding', name: 'Raiding', kind: 'action', cost: { resources: { military: 3 } },
    display: { art: '🏴', note: 'single use' },
    effect: { resources: { food: 4, production: 4 }, resolve: (ctx) => { ctx.G.removed.push(ctx.self); } },
  },
  conquest: {
    id: 'conquest', name: 'Conquest', kind: 'work', workers: 1,
    display: { art: '🗡️', dynamicRule: 'cost doubles per use' },
    // The `plays` counter rides with the instance everywhere it goes — onto the board, back to the
    //   discard, round to the deck — so the escalation is per *copy*: a second owned Conquest climbs
    //   on its own schedule. Bumping in `produces` rather than at play means an unstaffed box, which
    //   never ticks and so takes no land, doesn't raise the price either.
    cost: {
      resources: { military: 2 },
      resolve: ({ self }, base) => ({
        ...base,
        resources: scaleResources(base.resources ?? {}, 2 ** getCounter(self, 'plays')),
      }),
    },
    produces: { resources: { territory: 1 }, resolve: (ctx) => { bumpCounter(ctx.self, 'plays'); } },
  },

  // Road: Conquest's economic twin — the same worker for the turn and the same +1 territory, paid in
  //   🪙+🔨 instead of ⚔️, so expansion has a trade route as well as a war party.
  road: {
    id: 'road', name: 'Road', kind: 'work', workers: 1,
    cost: { resources: { money: 3, production: 3 } },
    display: { art: '🛣️' },
    produces: { resources: { territory: 1 } },
  },

  food_caravan: { id: 'food_caravan', name: 'Food Caravan', kind: 'action', cost: { resources: { money: 2 } }, display: { art: '🐫' }, effect: { resources: { food: 3 } } },
  material_caravan: { id: 'material_caravan', name: 'Material Caravan', kind: 'action', cost: { resources: { money: 2 } }, display: { art: '🐂' }, effect: { resources: { production: 3 } } },

  fire: { id: 'fire', name: 'Fire', kind: 'action', cost: { discard: 1 }, display: { art: '🔥' }, effect: { resources: { science: 1 } } },

  // Calendar keys its two resolver passes on `ctx.answer === undefined` (0 is a valid answer). Its
  // `effect` is resolve-only (no declarative `resources`) — `resolveInteraction` re-runs the whole
  // effect on resume, so any resource field would double-apply.
  calendar: {
    id: 'calendar', name: 'Calendar', kind: 'action',
    display: { art: '📅', description: 'Look at the top 3 cards of your draw pile and draw one.' },
    // Nothing to look at in an empty pile — gate it (reusing the peek reason) rather than fizzle for
    // its cost. Peeking never reshuffles, so `deck.length` (not deck+discard) is the emptiness test.
    cost: {
      resources: { science: 2 },
      check: ({ G }) => (G.deck.length === 0 ? { kind: 'emptyDrawPile' } : null),
    },
    effect: {
      resolve: (ctx) => {
        if (ctx.answer === undefined) {
          // First pass: pure-read the top cards (peekTop leaves them on the deck) and park the pick.
          // The options alias live `G.deck` instances — fine, nothing mutates them before the resume.
          const top = peekTop(ctx, 3);
          if (top.length === 0) return;
          suspendChoice(ctx, {
            kind: 'chooseCard',
            prompt: 'Draw one — the rest stay on top of the pile, in order',
            options: top,
            pick: 1,
          });
          return;
        }
        // Resume: `answer` indexes the parked options, which are detached copies after the move's
        // clone — so the pick is lifted off the deck by instance id, never by position.
        const pending = ctx.G.pendingInteraction;
        if (!pending) return;
        const chosen = pending.options[ctx.answer];
        if (chosen) {
          // The cards passed over keep their places at the top, so the knowledge the play bought
          // outlives the draw it bought.
          ctx.G.deck = ctx.G.deck.filter((c) => c.id !== chosen.id);
          drawInstance(ctx, chosen);
        }
        ctx.G.pendingInteraction = null;
      },
    },
  },

  // Keys its two resolver passes on `ctx.answer === undefined` (0 is a valid answer). Resolve-only
  // (no declarative `resources`) like Calendar: `resolveInteraction` re-runs the whole effect on
  // resume, so any resource field would double-apply.
  writing: {
    id: 'writing', name: 'Writing', kind: 'action',
    display: { art: '✍️', description: 'Return a chosen card from your discard to your hand.' },
    // A zero-option `chooseCard` would park a modal with no options and no dismiss, soft-locking the
    // run — so an empty discard is gated unplayable rather than left to fizzle for its cost.
    cost: {
      resources: { science: 2 },
      check: ({ G }) => (G.discard.length === 0 ? { kind: 'discardEmpty' } : null),
    },
    effect: {
      resolve: (ctx) => {
        if (ctx.answer === undefined) {
          // The snapshot excludes this card itself: `playCard` still holds it, unfiled to discard.
          if (ctx.G.discard.length === 0) return;
          suspendChoice(ctx, {
            kind: 'chooseCard',
            prompt: 'Return one card from your discard to your hand',
            options: [...ctx.G.discard],
            pick: 1,
          });
          return;
        }
        // Resume: `answer` indexes the parked options; `recoverFromDiscard` finds it by instance id.
        const pending = ctx.G.pendingInteraction;
        if (!pending) return;
        const chosen = pending.options[ctx.answer];
        if (chosen) recoverFromDiscard(ctx, chosen);
        ctx.G.pendingInteraction = null;
      },
    },
  },

  // — Events —
  raider: { id: 'raider', name: 'Raiders', kind: 'event', cost: { resources: { military: 3 } }, display: { art: '🪓' }, upkeep: { resources: { food: -1 } } },
  clay_tablet: {
    id: 'clay_tablet', name: 'Clay Tablet', kind: 'event', cost: { resources: { production: 4, science: 2 } },
    display: {
      art: '📜',
      description: '−🔬 at end of round, worsening',
      dynamicText: (_G, self) => `−${getCounter(self, 'level')}🔬 next round`,
    },
    upkeep: {
      resolve: ({ G, self }) => {
        subtractResources(G.resources, { science: getCounter(self, 'level') });
        bumpCounter(self, 'level');
      },
    },
  },
  // Paying the cost *is* mining the vein: the play choke point exiles a played event to `removed`, which
  // is what `finding_copper_goal` counts, so no effect is needed. No `upkeep` either — unlike Raiders,
  // an unmined vein is not a disaster, it just waits (filing to discard and recurring). The mission's
  // pressure lives on its threat instead.
  copper_vein: { id: 'copper_vein', name: 'Copper Vein', kind: 'event', cost: { resources: { production: 2, science: 5 } }, display: { art: '⛏️' } },
  // Roadwork: paving a segment (paying its 🔨) exiles the played event to `removed`, which `roads_goal`
  //   counts. Unlike the copper vein, a segment left in hand *is* a disaster — an unfinished road cuts a
  //   settlement off, bleeding a flat 🌾 each round it goes unpaved (no per-instance escalation, unlike
  //   the clay tablet). The events are the whole pressure, so the mission seeds no threat.
  roadwork: {
    id: 'roadwork', name: 'Roadwork', kind: 'event', cost: { resources: { production: 8 } },
    display: { art: '🚧', description: '−2 🌾 at end of round while unpaved' },
    upkeep: { resources: { food: -2 } },
  },
  // Wild Horse: paying the ⚔️ *is* taming it — the play choke exiles the played event to `removed`,
  //   which `horse_taming_goal` counts, so no effect is needed. Left in hand it eats into the season's
  //   labour (a flat 🔨, like the roadwork's 🌾) and recurs; the drain is a *different* currency than the
  //   ⚔️ tame cost, so passing a horse up is a real trade rather than deferred change.
  wild_horse: {
    id: 'wild_horse', name: 'Wild Horse', kind: 'event', cost: { resources: { military: 6 } },
    display: { art: '🐎', description: '−1 🔨 at end of round while untamed' },
    upkeep: { resources: { production: -1 } },
  },
  // Stronghold: cracking it is playing it — the ⚔️ buys the walls down, the play choke exiles it to
  //   `removed` (what `raiding_goal` counts), and the effect hands the plunder. Held unplayed at end of
  //   round its one upkeep does both halves of the pressure: the garrison rides out for 🪙, and the
  //   walls go up — one `walls` counter both that drain and its own cost read back, so a target hardens
  //   only on a turn it was held and passed over, and one number tunes both halves.
  stronghold: {
    id: 'stronghold', name: 'Stronghold', kind: 'event',
    cost: {
      resources: { military: 8 },
      resolve: ({ self }, base) => ({
        ...base,
        resources: { ...base.resources, military: (base.resources?.military ?? 0) + 3 * getCounter(self, 'walls') },
      }),
    },
    display: {
      art: '🏰',
      description: '−2 🪙 at end of round while it stands',
      dynamicRule: 'cost and reprisal rise each round it stands',
    },
    effect: { resources: { money: 6 } },
    upkeep: {
      resources: { money: -2 },
      // Drain off the walls already raised, *then* raise them, so the first round a target is held
      //   costs the printed 2🪙 and only a passed-over one bleeds more.
      resolve: ({ G, self }) => {
        subtractResources(G.resources, { money: 2 * getCounter(self, 'walls') });
        bumpCounter(self, 'walls');
      },
    },
  },
  // Voyage: outfitting the hull and provisioning it *is* the launch — the play choke exiles the played
  //   event to `removed`, which `setting_sail_goal` counts. The crew is the other half of the price:
  //   population is not a payable `cost.resources` field (that half is spent blind, past the staffing
  //   that gates the pool), so the citizen leaves through `effect` with a `check` standing in for the
  //   gate the field would have carried — idle hands only, since a ship crewed off a farm would push
  //   `freePopulation` negative. No `upkeep`: a voyage left in hand bleeds nothing and recurs, so all
  //   the mission's pressure sits on the clock and on the citizens already at sea.
  voyage: {
    id: 'voyage', name: 'Voyage', kind: 'event',
    cost: {
      resources: { money: 5, production: 5 },
      check: ({ G }) => (freePopulation(G) < 1 ? { kind: 'noIdlePopulation' } : null),
    },
    display: { art: '⛵', description: 'Sails with 1 idle 🧍, for good' },
    effect: { resources: { population: -1 } },
  },
  // Accounting's thief: unbred at setup — the `envious_population` threat spawns these into the deck as
  //   the treasury grows. Left in hand it skims 🪙 and "stock" (🔨) via `upkeep` and recurs (files to
  //   discard); paid off with ⚔️ (catching it) the play choke exiles it to `removed` for good. Costs and
  //   drain provisional (balance pending).
  thief: {
    id: 'thief', name: 'Thief', kind: 'event', cost: { resources: { military: 2 } },
    display: { art: '🦹' },
    upkeep: { resources: { money: -2, production: -1 } },
  },

  // — Objectives —
  first_settlement_goal: {
    id: 'first_settlement_goal', name: 'The First Settlement', kind: 'objective', cost: {},
    goals: [
      { icon: '🔨', measure: (G) => G.resources.production, target: 10 },
      { icon: '⚔️', measure: (G) => G.resources.military, target: 10 },
    ],
    display: { description: 'Have 10 🔨 and 10 ⚔️' },
  },
  growing_numbers_goal: {
    id: 'growing_numbers_goal', name: 'Growing Numbers', kind: 'objective', cost: {},
    // The buildings collapse into one goal counting the distinct ones present (both ⇒ met); the
    //   per-building breakdown is left to `dynamicText`, which the generic readout can't express — so
    //   the territory goal has to be echoed there too, or that half of the win goes unshown.
    goals: [
      {
        icon: '🏛️',
        measure: (G) => GROWING_NUMBERS_BUILDINGS.filter((id) => G.tableau.some((b) => b.cardId === id)).length,
        target: GROWING_NUMBERS_BUILDINGS.length,
      },
      { icon: '🗺️', measure: (G) => G.resources.territory, target: GROWING_NUMBERS_TERRITORY },
    ],
    display: {
      description: `Build 🛖 🌱\nHold ${GROWING_NUMBERS_TERRITORY} 🗺️`,
      dynamicText: (G) =>
        [
          ...GROWING_NUMBERS_BUILDINGS.map(
            (id) => `${CARDS[id].display?.art} ${G.tableau.some((b) => b.cardId === id) ? 1 : 0}/1`,
          ),
          `🗺️ ${G.resources.territory}/${GROWING_NUMBERS_TERRITORY}`,
        ].join('\n'),
    },
  },

  // A raider reaches `removed` only by being played, so counting them there counts defeated waves.
  raiders_at_border_goal: {
    id: 'raiders_at_border_goal', name: 'Raiders at the Border', kind: 'objective', cost: {},
    goals: [
      {
        icon: '⚔️',
        measure: (G) => G.removed.filter((c) => c.cardId === 'raider').length,
        target: RAIDER_WAVES,
      },
    ],
    display: {
      description: `Defeat all ${RAIDER_WAVES} raider waves`,
      dynamicText: (G) =>
        `⚔️ ${Math.min(G.removed.filter((c) => c.cardId === 'raider').length, RAIDER_WAVES)}/${RAIDER_WAVES} defeated`,
    },
  },

  // Nothing ever removes a route, so the route half latches the moment it is opened and only the 🌾
  //   half can fall back — which is what lets the two stand as one "and" without a hold-for-N-rounds term.
  first_trades_goal: {
    id: 'first_trades_goal', name: 'The First Trades', kind: 'objective', cost: {},
    goals: [
      { icon: '🤝', measure: (G) => G.tradeRoutes.length, target: 1 },
      { icon: '🌾', measure: (G) => G.resources.food, target: FIRST_TRADES_FOOD },
    ],
    display: { description: `Open a 🤝 trade route\nHold ${FIRST_TRADES_FOOD} 🌾` },
  },

  // The one goal in the arc measured in rounds rather than a pool: surviving *is* the win, so the
  //   objective counts the same clock the Deep Cold's ramp is keyed to. Reaching the break round is
  //   checked at `beginTurn`'s flush, so the win lands having paid the round before it in full.
  harsh_winter_goal: {
    id: 'harsh_winter_goal', name: 'Harsh Winter', kind: 'objective', cost: {},
    goals: [{ icon: '❄️', measure: (G) => G.round, target: HARSH_WINTER_BREAK }],
    display: {
      description: `Outlast the winter — survive to round ${HARSH_WINTER_BREAK}`,
      dynamicText: (G) => `❄️ round ${Math.min(G.round, HARSH_WINTER_BREAK)}/${HARSH_WINTER_BREAK}`,
    },
  },

  reading_seasons_goal: {
    id: 'reading_seasons_goal', name: 'Reading the Seasons', kind: 'objective', cost: {},
    goals: [{ icon: '🔬', measure: (G) => G.resources.science, target: 10 }],
    display: { description: 'Reach 10 🔬 science' },
  },

  // Culture is never spent, so `culture >= cultureForLevel(N)` is exactly `cultureLevel >= N`. The
  //   readout anchors on the *level* — a within-band count would reset to 0 on each level-up.
  rites_rituals_goal: {
    id: 'rites_rituals_goal', name: 'Rites & Rituals', kind: 'objective', cost: {},
    goals: [{ icon: '🎭', measure: (G) => G.resources.culture, target: cultureForLevel(1) }],
    display: {
      description: 'Reach 🎭 level 1',
      dynamicText: (G) => `🎭 Level ${Math.min(cultureProgress(G.resources.culture).level, 1)}/1`,
    },
  },

  // The Stone Age capstone: two standing capacities held at once, neither of them a spendable pool —
  //   so nothing here asks the player to stop spending. The culture term reads as a *level* (like the
  //   other culture goals) rather than the raw /30 the generic readout would show.
  first_temple_goal: {
    id: 'first_temple_goal', name: 'Göbekli Tepe', kind: 'objective', cost: {},
    goals: [
      { icon: '🧍', measure: (G) => G.resources.population, target: 3 },
      { icon: '🎭', measure: (G) => G.resources.culture, target: cultureForLevel(2) },
    ],
    display: {
      description: 'Have 3 🧍 and 🎭 level 2',
      dynamicText: (G) =>
        `🧍 ${Math.min(G.resources.population, 3)}/3 · ` +
        `🎭 Level ${Math.min(cultureProgress(G.resources.culture).level, 2)}/2`,
    },
  },

  // Masonry's megalopolis goal: a single population threshold — grow the settlement into a city.
  masonry_goal: {
    id: 'masonry_goal', name: 'Masonry', kind: 'objective', cost: {},
    goals: [{ icon: '🧍', measure: (G) => G.resources.population, target: 6 }],
    display: { description: 'Reach 6 🧍 population' },
  },

  // Accounting's ledger goal: a single money threshold. The fight isn't the number — it's holding it
  //   against the thieves the treasury itself breeds (`envious_population`). Target provisional.
  accounting_goal: {
    id: 'accounting_goal', name: 'Accounting', kind: 'objective', cost: {},
    goals: [{ icon: '🪙', measure: (G) => G.resources.money, target: 40 }],
    display: {
      description: 'Amass 40 🪙',
      dynamicText: (G) => `🪙 ${Math.min(G.resources.money, 40)}/40`,
    },
  },

  // The Pyramid's "wealthy, cultured state" goal, weighted onto the Bronze money economy. The deadline
  //   that makes it a challenge is the `pharaohs_reign` threat, not this objective (win/lose stay on
  //   their own hooks).
  pyramid_goal: {
    id: 'pyramid_goal', name: 'Pyramid', kind: 'objective', cost: {},
    goals: [
      { icon: '🪙', measure: (G) => G.resources.money, target: 50 },
      { icon: '🔨', measure: (G) => G.resources.production, target: 40 },
      { icon: '🎭', measure: (G) => G.resources.culture, target: cultureForLevel(2) },
    ],
    display: {
      description: 'Have 50 🪙, 40 🔨, and 🎭 level 2',
      dynamicText: (G) =>
        `🪙 ${Math.min(G.resources.money, 50)}/50 · ` +
        `🔨 ${Math.min(G.resources.production, 40)}/40 · ` +
        `🎭 Level ${Math.min(cultureProgress(G.resources.culture).level, 2)}/2`,
    },
  },

  // A vein reaches `removed` only by being played, so counting them there counts mined veins.
  finding_copper_goal: {
    id: 'finding_copper_goal', name: 'Finding Copper', kind: 'objective', cost: {},
    goals: [
      {
        icon: '⛏️',
        measure: (G) => G.removed.filter((c) => c.cardId === 'copper_vein').length,
        target: COPPER_VEINS,
      },
    ],
    display: {
      description: `Mine all ${COPPER_VEINS} copper veins`,
      dynamicText: (G) =>
        `⛏️ ${Math.min(G.removed.filter((c) => c.cardId === 'copper_vein').length, COPPER_VEINS)}/${COPPER_VEINS} mined`,
    },
  },

  // A tablet reaches `removed` only by being played, so counting them there counts recorded tablets.
  writing_goal: {
    id: 'writing_goal', name: 'Writing', kind: 'objective', cost: {},
    goals: [
      {
        icon: '📜',
        measure: (G) => G.removed.filter((c) => c.cardId === 'clay_tablet').length,
        target: CLAY_TABLETS,
      },
    ],
    display: {
      description: `Record all ${CLAY_TABLETS} clay tablets`,
      dynamicText: (G) =>
        `📜 ${Math.min(G.removed.filter((c) => c.cardId === 'clay_tablet').length, CLAY_TABLETS)}/${CLAY_TABLETS} recorded`,
    },
  },

  // A segment reaches `removed` only by being played, so counting them there counts paved segments.
  roads_goal: {
    id: 'roads_goal', name: 'Roads', kind: 'objective', cost: {},
    goals: [
      {
        icon: '🚧',
        measure: (G) => G.removed.filter((c) => c.cardId === 'roadwork').length,
        target: ROADWORKS,
      },
    ],
    display: {
      description: `Pave all ${ROADWORKS} road segments`,
      dynamicText: (G) =>
        `🚧 ${Math.min(G.removed.filter((c) => c.cardId === 'roadwork').length, ROADWORKS)}/${ROADWORKS} paved`,
    },
  },

  horse_taming_goal: {
    id: 'horse_taming_goal', name: 'Horse Taming', kind: 'objective', cost: {},
    goals: [{ icon: '🐎', measure: tamedHorses, target: WILD_HORSES }],
    display: {
      description: `Tame all ${WILD_HORSES} wild horses`,
      dynamicText: (G) => `🐎 ${Math.min(tamedHorses(G), WILD_HORSES)}/${WILD_HORSES} tamed`,
    },
  },

  // A stronghold reaches `removed` only by being played, so counting them there counts the sacked ones.
  raiding_goal: {
    id: 'raiding_goal', name: 'Raiding', kind: 'objective', cost: {},
    goals: [
      {
        icon: '🏰',
        measure: (G) => G.removed.filter((c) => c.cardId === 'stronghold').length,
        target: RAID_TARGETS,
      },
    ],
    display: {
      description: `Sack all ${RAID_TARGETS} strongholds`,
      dynamicText: (G) =>
        `🏰 ${Math.min(G.removed.filter((c) => c.cardId === 'stronghold').length, RAID_TARGETS)}/${RAID_TARGETS} sacked`,
    },
  },

  setting_sail_goal: {
    id: 'setting_sail_goal', name: 'Setting Sail', kind: 'objective', cost: {},
    goals: [{ icon: '⛵', measure: voyagesLaunched, target: VOYAGES }],
    display: {
      description: `Launch all ${VOYAGES} voyages`,
      dynamicText: (G) => `⛵ ${Math.min(voyagesLaunched(G), VOYAGES)}/${VOYAGES} launched`,
    },
  },

  // Measures territory *gained* since setup (`resources − startResources`), not the absolute realm
  //   size: occupying a slot doesn't lower the resource, and Road/Conquest raise it, so the difference
  //   is pure expansion — and reads the same win on every board regardless of its starting territory.
  wheel_goal: {
    id: 'wheel_goal', name: 'The Wheel', kind: 'objective', cost: {},
    goals: [{ icon: '🗺️', measure: (G) => G.resources.territory - G.startResources.territory, target: WHEEL_TERRITORY }],
    display: {
      description: `Gain ${WHEEL_TERRITORY} territory`,
      dynamicText: (G) =>
        `🗺️ ${Math.min(G.resources.territory - G.startResources.territory, WHEEL_TERRITORY)}/${WHEEL_TERRITORY}`,
    },
  },

  // Sandbox is an endless no-stakes mission: the objective never wins by design (a single bespoke
  //   goal whose `met` is always false), and nothing bounds the run — it lasts until the player quits
  //   or a core resource collapses.
  sandbox_goal: {
    id: 'sandbox_goal', name: 'Sandbox', kind: 'objective', cost: {},
    goals: [{ icon: '🏖️', measure: () => 0, target: 1, met: () => false }],
    display: {
      art: '🏖️',
      description: 'Build, grow, and stay as long as you like.',
      dynamicText: (G) => `Round ${G.round}`,
    },
  },

  // Return of the Ice Age is an endless survival mission: like the sandbox its objective never wins (one
  //   bespoke always-false goal), so the run ends only when the deepening cold (the `long_winter` threat)
  //   starves the food store. The score is rounds survived, paid as Influence by the infinite-mission payout.
  ice_age_goal: {
    id: 'ice_age_goal', name: 'Return of the Ice Age', kind: 'objective', cost: {},
    goals: [{ icon: '🧊', measure: () => 0, target: 1, met: () => false }],
    display: {
      art: '🧊',
      description: 'Endure the deepening cold as long as you can.',
      dynamicText: (G) => `Survived ${G.round} rounds`,
    },
  },

  // — Threats —
  // Harsh Winter's threat, and the whole mission: nothing until `HARSH_WINTER_ONSET`, then a famine
  //   deepening every round until the winter breaks. Unlike `long_winter`'s unbounded ramp it is
  //   outlastable by construction — bounded by a *lift* rather than a ceiling, which is what lets a
  //   standard mission carry it, and it is survived out of stores banked before it starts rather than
  //   out of income.
  deep_cold: {
    id: 'deep_cold', name: 'The Deep Cold', kind: 'threat', cost: {},
    display: {
      art: '🥶',
      description: `From round ${HARSH_WINTER_ONSET}: −1🌾 each round, worsening until the winter breaks.`,
      dynamicText: (G) => {
        const famine = famineAt(G.round);
        return famine > 0
          ? `−${famine}🌾 · breaks in ${Math.max(0, HARSH_WINTER_BREAK - G.round)}`
          : `bites in ${HARSH_WINTER_ONSET - G.round}`;
      },
    },
    upkeep: {
      resolve: ({ G }) => {
        const famine = famineAt(G.round);
        if (famine > 0) subtractResources(G.resources, { food: famine });
      },
    },
  },
  // Return of the Ice Age's escalating famine: a cold that deepens each round (−1🌾, then −2, …) via a
  //   bespoke `upkeep.resolve` reading its own `level` counter, like the escalating threat fixture. The
  //   drain is unbounded by design — the endless mission ends only when the cold finally outpaces the
  //   harvest and food collapses. Linear +1/round escalation is provisional (balance pass pending).
  long_winter: {
    id: 'long_winter', name: 'The Long Winter', kind: 'threat', cost: {},
    display: {
      art: '❄️',
      description: '−1🌾 every round, worsening',
      dynamicText: (_G, self) => `−${getCounter(self, 'level') + 1}🌾 next round`,
    },
    upkeep: {
      resolve: ({ G, self }) => {
        subtractResources(G.resources, { food: getCounter(self, 'level') + 1 });
        bumpCounter(self, 'level');
      },
    },
  },
  // Finding Copper's squeeze: stone tools wear out under the buildings they raised, so the drain scales
  //   with the workers staffed on the *tableau only* — work cards are exempt, taxing permanent
  //   infrastructure rather than labour. `assignedWorkers` (not `producingUnits`) is the right read: a
  //   self-sufficient `workers: 0` building like Hut staffs nobody and so wears nothing.
  failing_stone_tools: {
    id: 'failing_stone_tools', name: 'Failing Stone Tools', kind: 'threat', cost: {},
    display: {
      art: '💥',
      description: '−1🔨 per worker in a building',
      dynamicText: (G) => `−${assignedWorkers(G.tableau)}🔨 next round`,
    },
    upkeep: {
      resolve: ({ G }) => {
        subtractResources(G.resources, { production: assignedWorkers(G.tableau) });
      },
    },
  },
  // The Wheel's squeeze: road upkeep on the realm's *growth* past a grace band, so a board's starting
  //   territory and the first few expansions are toll-free and the pressure only mounts once the realm
  //   outruns what its roads carry.
  overextension: {
    id: 'overextension', name: 'Overextension', kind: 'threat', cost: {},
    display: {
      art: '🛤️',
      description: `−1🔨 per territory gained past ${OVEREXTENSION_GRACE}`,
      dynamicText: (G) => `−${overextensionDrain(G)}🔨 next round`,
    },
    upkeep: {
      resolve: ({ G }) => {
        subtractResources(G.resources, { production: overextensionDrain(G) });
      },
    },
  },
  // Horse Taming's squeeze: the goal is its own pressure — every horse tamed is a permanent mouth, so
  //   the herd you have won drains 🌾 by its own size and the last horse is tamed under the heaviest
  //   drain. Reads the removed pile through `tamedHorses`, the same tally the goal counts.
  tamed_horses: {
    id: 'tamed_horses', name: 'Tamed Horses', kind: 'threat', cost: {},
    display: {
      art: '🐴',
      description: '−1🌾 per tamed horse',
      dynamicText: (G) => `−${tamedHorses(G)}🌾 next round`,
    },
    upkeep: {
      resolve: ({ G }) => {
        subtractResources(G.resources, { food: tamedHorses(G) });
      },
    },
  },
  // The Pyramid's race-the-clock: the tomb must be ready before the pharaoh dies. No drain — the
  //   pressure is purely the deadline. `round > N` (not `>=`) per the `defeat` contract: the check runs
  //   at the flush right after `beginTurn` increments the round, so the player gets *through* round N.
  pharaohs_reign: {
    id: 'pharaohs_reign', name: "Pharaoh's Reign", kind: 'threat', cost: {},
    display: {
      art: '⏳',
      description: `Complete the tomb within ${PHARAOH_DEADLINE} rounds.`,
      dynamicText: (G) => `⏳ ${Math.max(0, PHARAOH_DEADLINE - G.round + 1)} rounds left`,
    },
    defeat: (G) => G.round > PHARAOH_DEADLINE && 'the pharaoh died before his tomb was ready',
  },
  // Setting Sail's pace clock: a deadline on *stalling* rather than on the mission, so a patient build
  //   is fine at any length so long as it is punctuated. The tick reads the fleet through the same
  //   `voyagesLaunched` tally the goal counts, against a `seen` mark, so nothing couples the voyage card
  //   to this one. `defeat` stays a pure read off the `idle` streak the tick maintains.
  //   Launching on the round the clock would run out is safe by the reset, not by a race: the tick runs
  //   inside `applyUpkeep`'s `endTurn` broadcast and `evaluateDefeat` only re-derives at the flush after
  //   it, so the streak is already back to 0 before anything reads it. Two launches in one round buy one
  //   reset, not two rounds of slack — the clock measures quiet rounds, not unspent voyages.
  impatient_crews: {
    id: 'impatient_crews', name: 'Impatient Crews', kind: 'threat', cost: {},
    display: {
      art: '⏱️',
      description: `Launch a voyage at least every ${CREW_PATIENCE} rounds.`,
      dynamicText: (_G, self) => `⏱️ ${Math.max(0, CREW_PATIENCE - getCounter(self, 'idle'))} rounds left`,
    },
    upkeep: {
      resolve: ({ G, self }) => {
        const launched = voyagesLaunched(G);
        if (launched > getCounter(self, 'seen')) {
          setCounter(self, 'seen', launched);
          setCounter(self, 'idle', 0);
        } else bumpCounter(self, 'idle');
      },
    },
    defeat: (_G, self) =>
      getCounter(self, 'idle') >= CREW_PATIENCE && 'the crews took berths in another port',
  },
  // Accounting's engine: envy breeds thieves in proportion to the untracked hoard. Each reshuffle mints
  //   `floor(money / THIEVES_PER_GOLD)` `thief` events into the deck (via `spawnIntoDeck`, so the mint
  //   ids stay unique and the shuffle-in is deterministic) — so a fat treasury floods your own draws,
  //   the pressure that stops the player sitting on a pile. The one shipped card on the `reshuffle` bus.
  envious_population: {
    id: 'envious_population', name: 'Envious Population', kind: 'threat', cost: {},
    display: {
      art: '👀',
      description: `Reshuffles add one 🦹 per ${THIEVES_PER_GOLD} stockpiled 🪙`,
      dynamicText: (G) => `+${Math.floor(G.resources.money / THIEVES_PER_GOLD)} 🦹 next shuffle`,
    },
    on: {
      reshuffle: {
        resolve: (ctx) => spawnIntoDeck(ctx, 'thief', Math.floor(ctx.G.resources.money / THIEVES_PER_GOLD)),
      },
    },
  },
};
