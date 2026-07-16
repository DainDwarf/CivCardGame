import { subtractResources, type CoreResources } from '../rules/resources';
import { bumpCounter, getCounter, type CardInstance, type GameEventType, type GameState } from '../rules/state';
import { type CardEffect, suspendChoice } from '../rules/effects';
import type { CardGate } from '../rules/playability';
import { peekTop } from '../rules/deck';
import { cultureForLevel, cultureProgress } from '../rules/culture';

export type CardKind = 'building' | 'wonder' | 'action' | 'work' | 'event' | 'threat' | 'objective';

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
  /** CoreResources required to play. Absent keys are free (e.g. {} = no cost). */
  cost: Partial<CoreResources>;
  /** Everything beyond the raw resource `cost` that gates play — culture-level req, discard cost, and
   *  bespoke preconditions — as one `CardGate` (`rules/playability.ts`). Absent = only `cost` gates. */
  gate?: CardGate;
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
  /** A staffable's per-round output once staffed — run through `resolveProduction`, scaling its
   *  `resources` per staffed worker. May touch any of the 8 pools. Kept distinct from `effect` so a
   *  one-shot play field can never fire every round. */
  produces?: CardEffect;
  /** A recurring per-round effect fired *at the upkeep boundary*, flat (never per-worker-scaled like
   *  `produces`): a `threat`'s drain, an unplayed `event`'s end-of-turn disaster, or an operating
   *  staffable's maintenance. Composes with `produces` and `on.endTurn` — `resolveEndTurn` runs all
   *  three (`rules/effects.ts`); a card reacting to another trigger uses `on`. */
  upkeep?: CardEffect;
  /**
   * Event-bus reactions (`rules/events.ts`): a `CardEffect` per event type, for reacting to something
   * whose *timing the card doesn't own* (a draw, a discard elsewhere, a resource threshold, a round
   * passing). A handler's `resolve` must be **pure over `G`** (the projection clone re-runs it every
   * render), **never open a `pendingInteraction`**, and **`filter`, never `splice`** to self-remove.
   * A threat's driven defeat does NOT go through `on` — see `defeat` below.
   */
  on?: Partial<Record<GameEventType, CardEffect>>;
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
  return card.kind === 'building' || card.kind === 'wonder' || card.kind === 'action' || card.kind === 'work';
}

/** Whether a card *occupies a tableau slot* when played. The single choke point for every
 *  placement branch (`moves.ts`, `playability.ts`, `Board.tsx`, `CardFace.tsx`). */
export function isStructure(card: CardDef): boolean {
  return card.kind === 'building' || card.kind === 'wonder';
}

/** Whether a card *produces and is staffed at upkeep*. A card-kind predicate; distinct from
 *  `population.ts`'s instance-level `Staffable`, which operates on placed instances. */
export function isStaffable(card: CardDef): boolean {
  return isStructure(card) || card.kind === 'work';
}

/** Display order of card kinds — the primary key of `compareCards`; deckable kinds first. Total over
 *  `CardKind`, so its keys double as the enumeration of every kind: a new kind cannot type-check
 *  without landing here. */
export const KIND_RANK: Record<CardKind, number> = {
  building: 0,
  wonder: 1,
  work: 2,
  action: 3,
  event: 4,
  threat: 5,
  objective: 6,
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

/** The buildings "Growing Numbers" wants — shared by the win goal, the `dynamicText` readout, and the
 *  sim's steering override (`sim/objective.ts`), so none can list a different set. Each progress glyph
 *  is pulled from the building's own `art`. */
export const GROWING_NUMBERS_BUILDINGS: readonly string[] = ['hut', 'farm'];

/** How many raider waves "Raiders at the Border" seeds — shared by the mission's injected event list
 *  (`content/missions.ts`), the `raiders_at_border_goal` win threshold, and its progress readout. */
export const RAIDER_WAVES = 3;

/**
 * The card catalogue. Numbers are a first pass. Tests install synthetic `test_*` cards on top via
 * `rules/testFixtures.ts`.
 */
export const CARDS: Record<string, CardDef> = {
  // — Work —
  foraging: { id: 'foraging', name: 'Foraging', kind: 'work', cost: {}, workers: 1, display: { art: '🌿' }, produces: { resources: { food: 3 } } },
  toolmaking: { id: 'toolmaking', name: 'Toolmaking', kind: 'work', cost: {}, workers: 1, display: { art: '🪨' }, produces: { resources: { production: 2 } } },
  beer: { id: 'beer', name: 'Beer', kind: 'work', cost: { food: 2 }, workers: 1, display: { art: '🍺' }, produces: { resources: { culture: 5 } } },

  // — Buildings —
  farm: { id: 'farm', name: 'Farm', kind: 'building', cost: { production: 2 }, produces: { resources: { food: 1 } }, workers: 1, display: { art: '🌱' } },
  // Hut: a one-shot *placement* grant (+1 population when built) — on `effect`, not `produces`, so it
  //   fires once at placement rather than every round.
  hut: {
    id: 'hut', name: 'Hut', kind: 'building', cost: { production: 4 }, workers: 0,
    display: { art: '🛖', description: 'When built: +1 🧍' },
    effect: { resources: { population: 1 } },
  },
  burial: { id: 'burial', name: 'Burial', kind: 'building', cost: { production: 2 }, produces: { resources: { culture: 1 } }, workers: 1, display: { art: '⚰️' } },

  // — Wonders —
  gobekli_tepe: {
    id: 'gobekli_tepe', name: 'Göbekli Tepe', kind: 'wonder',
    display: { art: '🗿', description: '+1🔨 +1🪙 +1🎭\nper worker.' },
    cost: { production: 8 }, gate: { cultureLevelReq: 1 }, workers: 3,
    produces: { resources: { production: 1, money: 1, culture: 1 } },
  },

  // — Actions —
  storytelling: { id: 'storytelling', name: 'Storytelling', kind: 'work', cost: {}, workers: 1, display: { art: '🗣️' }, produces: { resources: { science: 2 } } },
  bow: {
    id: 'bow', name: 'Bow', kind: 'action', cost: { production: 2 },
    // The "single use" note is the face's heads-up for the self-removal below — kept in step with it.
    display: { art: '🏹', note: 'single use' },
    // A one-shot: grant the military (declarative, folded first) then exile this copy to `removed`
    // so it never recycles back into the deck. The play choke point skips its usual action→discard
    // file once the effect has already filed the copy (see `moves.ts`'s `playCard`).
    effect: { resources: { military: 3 }, resolve: (ctx) => { ctx.G.removed.push(ctx.self); } },
  },
  cave_art: { id: 'cave_art', name: 'Cave Art', kind: 'work', cost: {}, workers: 1, display: { art: '🖐️' }, produces: { resources: { culture: 2 } } },
  jewelry: { id: 'jewelry', name: 'Jewelry', kind: 'action', cost: { production: 1 }, display: { art: '📿' }, effect: { resources: { money: 2 } } },
  bartering: { id: 'bartering', name: 'Bartering', kind: 'action', cost: { money: 1 }, display: { art: '🤝' }, effect: { resources: { food: 2 } } },
  dogs: { id: 'dogs', name: 'Dogs', kind: 'action', cost: { food: 1 }, display: { art: '🐕' }, effect: { resources: { military: 2 } } },
  conquest: {
    id: 'conquest', name: 'Conquest', kind: 'work', cost: { military: 5 }, workers: 1,
    // The "single use" note is the face's heads-up for the self-removal below — kept in step with it.
    display: { art: '🗡️', note: 'single use' },
    // Conquest is a one-shot land grab, not a sustained producer: the round it yields its territory it
    // leaves play for good. The declarative gain lands the territory, then the closure exiles this copy
    // to `removed` — `filter` per the bus's self-removal contract, so the end-of-turn workZone→discard
    // recycle never files it back.
    produces: {
      resources: { territory: 1 },
      resolve: (ctx) => {
        ctx.G.workZone = ctx.G.workZone.filter((w) => w.id !== ctx.self.id);
        ctx.G.removed.push({ id: ctx.self.id, cardId: ctx.self.cardId });
      },
    },
  },

  // Calendar keys its two resolver passes on `ctx.answer === undefined` (0 is a valid answer). The
  // reveal is look-only: peeking keeps nothing, so the resume pass just clears the interaction. Its
  // `effect` is resolve-only (no declarative `resources`) — `resolveInteraction` re-runs the whole
  // effect on resume, so any resource field would double-apply.
  calendar: {
    id: 'calendar', name: 'Calendar', kind: 'action', cost: { science: 1 },
    display: { art: '📅', description: 'Look at the top 3 cards of your draw pile.' },
    // Nothing to reveal from an empty pile — gate it (reusing the peek reason) rather than fizzle for
    // its cost. Peeking never reshuffles, so `deck.length` (not deck+discard) is the emptiness test.
    gate: { check: (G) => (G.deck.length === 0 ? { kind: 'emptyDrawPile' } : null) },
    effect: {
      resolve: (ctx) => {
        if (ctx.answer === undefined) {
          // First pass: pure-read the top cards (peekTop leaves them on the deck) and park a look-only
          // reveal. The options alias live `G.deck` instances — fine, the reveal never mutates them.
          const top = peekTop(ctx, 3);
          if (top.length === 0) return;
          suspendChoice(ctx, {
            kind: 'reveal',
            prompt: 'The next cards you will draw, in order',
            options: top,
            pick: 0,
          });
          return;
        }
        // Resume: a peek keeps nothing — just clear the interaction.
        ctx.G.pendingInteraction = null;
      },
    },
  },

  // — Events —
  raider: { id: 'raider', name: 'Raiders', kind: 'event', cost: { military: 3 }, display: { art: '🪓' }, upkeep: { resources: { food: -1 } } },

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
    // One goal counting the distinct required buildings present (both ⇒ met); the per-building
    //   breakdown is left to `dynamicText`, which the generic readout can't express.
    goals: [
      {
        icon: '🏛️',
        measure: (G) => GROWING_NUMBERS_BUILDINGS.filter((id) => G.tableau.some((b) => b.cardId === id)).length,
        target: GROWING_NUMBERS_BUILDINGS.length,
      },
    ],
    display: {
      description: 'Build 🛖 🌱',
      dynamicText: (G) =>
        GROWING_NUMBERS_BUILDINGS.map(
          (id) => `${CARDS[id].display?.art} ${G.tableau.some((b) => b.cardId === id) ? 1 : 0}/1`,
        ).join('\n'),
    },
  },

  // Culture is never spent, so `culture >= cultureForLevel(N)` is exactly `cultureLevel >= N`. The
  //   readout anchors on the *level* (a within-band count would reset each level-up), so it overrides.
  rites_rituals_goal: {
    id: 'rites_rituals_goal', name: 'Rites & Rituals', kind: 'objective', cost: {},
    goals: [{ icon: '🎭', measure: (G) => G.resources.culture, target: cultureForLevel(1) }],
    display: {
      description: 'Reach 🎭 level 1',
      dynamicText: (G) => {
        const p = cultureProgress(G.resources.culture);
        return p.level >= 1 ? '🎭 Level 1/1' : `🎭 Level ${p.level}/1`;
      },
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

  // Its own card so the objective plaque shows this mission's name (a steeper culture bar than
  // "Rites & Rituals", which only asks for level 1).
  restless_people_goal: {
    id: 'restless_people_goal', name: 'Restless People', kind: 'objective', cost: {},
    goals: [{ icon: '🎭', measure: (G) => G.resources.culture, target: cultureForLevel(2) }],
    display: {
      description: 'Reach 🎭 level 2',
      dynamicText: (G) => {
        const p = cultureProgress(G.resources.culture);
        return p.level >= 2 ? '🎭 Level 2/2' : `🎭 Level ${p.level}/2`;
      },
    },
  },

  reading_seasons_goal: {
    id: 'reading_seasons_goal', name: 'Reading the Seasons', kind: 'objective', cost: {},
    goals: [{ icon: '🔬', measure: (G) => G.resources.science, target: 10 }],
    display: { description: 'Reach 10 🔬 science' },
  },

  // The Stone Age capstone: four thresholds met at once. The culture term reads as a *level* (like
  //   the other culture goals) rather than the raw /30 the generic readout would show.
  first_temple_goal: {
    id: 'first_temple_goal', name: 'Göbekli Tepe', kind: 'objective', cost: {},
    goals: [
      { icon: '🧍', measure: (G) => G.resources.population, target: 3 },
      { icon: '🎭', measure: (G) => G.resources.culture, target: cultureForLevel(2) },
      { icon: '🔨', measure: (G) => G.resources.production, target: 30 },
      { icon: '🪙', measure: (G) => G.resources.money, target: 30 },
    ],
    display: {
      description: 'Have 3 🧍, 🎭 level 2, 30 🔨, and 30 🪙',
      dynamicText: (G) =>
        `🧍 ${Math.min(G.resources.population, 3)}/3 · ` +
        `🎭 Level ${Math.min(cultureProgress(G.resources.culture).level, 2)}/2 · ` +
        `🔨 ${Math.min(G.resources.production, 30)}/30 · ` +
        `🪙 ${Math.min(G.resources.money, 30)}/30`,
    },
  },

  // Sandbox is an endless no-stakes mission: the objective never wins by design (a single bespoke
  //   goal whose `met` is always false), and nothing bounds the run — it lasts until the player quits
  //   or a core resource collapses.
  sandbox_goal: {
    id: 'sandbox_goal', name: 'Sandbox', kind: 'objective', cost: {},
    goals: [{ icon: '👣', measure: () => 0, target: 1, met: () => false }],
    display: {
      art: '👣',
      description: 'No goal but the wander itself. Build, grow, and stay as long as you like.',
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
      description: 'No victory to reach — endure the deepening cold as long as you can.',
      dynamicText: (G) => `Survived ${G.round} rounds`,
    },
  },

  // — Threats —
  unrest: {
    id: 'unrest', name: 'Unrest', kind: 'threat', cost: {},
    display: { art: '💢', description: '−1🪙 per 🧍 on reshuffle' },
    on: {
      reshuffle: {
        resolve: ({ G }) => {
          subtractResources(G.resources, { money: G.resources.population });
        },
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
};
