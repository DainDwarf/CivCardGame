import { subtractResources, type CoreResources } from '../rules/resources';
import { type CardInstance, type GameEventType, type GameState } from '../rules/state';
import { type CardEffect, suspendChoice } from '../rules/effects';
import { recoverFromDiscard } from '../rules/deck';
import { cultureLevel, cultureProgress } from '../rules/culture';

export type CardKind = 'building' | 'wonder' | 'action' | 'work' | 'event' | 'threat' | 'objective';

/** A card's display-only concern, split off `CardDef` so authoring a card's *look* is separate
 *  from its *rules*. Every field here is read exclusively by the render path (`CardFace.tsx`'s
 *  `describeCard`/`describeConditions`/`artFor`, `Board.tsx`'s `dynamicText` sites) — no rule,
 *  move, upkeep, or resolver reads any of it. Optional as a whole (a card with no bespoke face
 *  text and a per-kind fallback glyph needs none). */
export interface CardDisplay {
  /** Hand-authored effect text for the card face, used when the declarative `effect` bag can't
   *  describe the card (a `resolve`-driven card). Takes precedence over the auto-generated
   *  `describeCard` text. **Keep it very short** — it renders in a tiny footer band on the card
   *  face, so favour glyphs over words and a single terse clause (e.g. `When built: +1 🧍`), not a
   *  full sentence with parentheticals. */
  description?: string;
  /** Run-aware effect text: given the live `GameState` and the specific card instance being
   *  rendered, returns that copy's *current* effect summary (e.g. a self-scaling card's growing gain,
   *  which depends on how often *this* copy has been played). Rendered in the card's bottom-most text
   *  band, everywhere a real instance exists in the run (hand, drag/ghost clones, zoom, pile
   *  viewers); static contexts (Collection, deck editor) have no instance to read, so they fall
   *  back to `description`/`describeCard`, which should read as the card's *base* value — the
   *  scaling rule itself is `dynamicRule`'s job, not this one's. The card owns its own display
   *  logic — the shell renders it blindly, with no per-card branch. */
  dynamicText?: (G: GameState, self: CardInstance) => string;
  /** Static, run-independent text describing *how* a dynamic card's effect scales (e.g. "+1 more
   *  each time this copy is played this run") — shown in the conditions band (alongside discard
   *  cost / culture-level gates), in every context, live instance or not, since the rule itself
   *  never changes. Pairs with `dynamicText`, which supplies the actual current number below it. */
  dynamicRule?: string;
  /** The card's central "art" glyph — the emoji shown big on the face and on a building/work box.
   *  Colocated with the def (not a parallel map in the UI) so authoring a card prompts its face in
   *  the same place, and so a glyph the objective progress text also wants (e.g. a Growing Numbers
   *  building) has one source. Presentation-only — no rule reads it. Optional: a card without one
   *  falls back to a per-kind default glyph in `CardFace.tsx`'s `artFor`. Every **deckable** card
   *  must set it (pinned by `cards.test.ts`); mission-only kinds may lean on the fallback (the
   *  objective's is 🏆). */
  art?: string;
}

export interface CardDef {
  /** Machine key: the key into the `CARDS` catalogue and what `CardInstance.cardId` and every rule
   *  target — a card's stable identity, never shown to the player. */
  id: string;
  /** The shown label a player reads, *and* the sort key for every card listing (`sortName`/
   *  `compareCards`) — identity+ordering, which is why it stays on `CardDef` rather than moving to
   *  `display` with the pure-render fields. */
  name: string;
  /** What the card *is* and where it goes after play — see docs/DESIGN.md → *Card kinds*. */
  kind: CardKind;
  /** CoreResources required to play. Absent keys are free (e.g. {} = no cost). */
  cost: Partial<CoreResources>;
  /** `building` and `work` cards: worker spaces to operate. Defaults to 1; `0` = self-sufficient
   *  (always operating, e.g. a defensive structure that needs no staffing). */
  workers?: number;
  /** Extra cost: number of other cards you must discard from hand to play this. */
  discardCost?: number;
  /** Minimum culture level required to play — a gate, not a cost (culture is not consumed). */
  cultureLevelReq?: number;
  /** The card's play-time effect (a `CardEffect` — declarative fields, or a `resolve` closure escape
   *  hatch; see `rules/effects.ts`). Read at a different timing per kind: an `action` applies it once on
   *  play; a `building`/`wonder` applies it once at **placement** (e.g. the Hut's `+1 population`), its
   *  recurring output living in the separate `produces` below; an unplayed `event` applies it at end of
   *  turn; a `threat` ticks it each round. (A `work` card's per-round output lives in `produces`, not
   *  here — `effect` is one-shot.) A building must never put recurring output in `effect.resources` (it
   *  would fire at placement *and* every round). Drives the play-time resolver (`resolveCard` →
   *  `runEffect`), the auto-generated face text (`describeCard`), and the play gates (`unplayableReason`),
   *  so most cards need only this. A card whose logic the declarative fields can't express authors an
   *  `effect.resolve` closure and its own `display.description`. */
  effect?: CardEffect;
  /**
   * How many cards this card reveals off the draw pile when played (a peek card — e.g. reveal 3).
   * A declarative descriptor that drives *two* things so they can't drift: the resolver reads it for
   * its `peekTop` count, and `rules/playability.ts`'s `unplayableReason` gates the card as
   * `emptyDrawPile` when both draw and discard piles are empty (nothing to reveal) — the same
   * dual-purpose pattern as `effect.destroy` (which both demolishes and drives `noBuildingsToDestroy`).
   */
  revealsFromDeck?: number;
  /**
   * Marks a card that recovers a card from the **discard** pile back to hand (e.g. Storytelling).
   * A declarative flag `rules/playability.ts`'s `unplayableReason` gates on: an empty discard means
   * nothing to recover, so the card is `discardEmpty`-unplayable rather than fizzling for its cost —
   * the same dual-purpose pattern as `revealsFromDeck` (→ `emptyDrawPile`) and `effect.destroy`
   * (→ `noBuildingsToDestroy`). The recovery itself resolves through `deck.ts`'s `recoverFromDiscard`.
   */
  recoversFromDiscard?: true;
  /**
   * Event-bus reactions (`rules/events.ts`): a map from a game-event type to the `CardEffect` that runs
   * when that event fires — the way a card reacts to something whose *timing it doesn't own* (a draw, a
   * discard elsewhere, a resource crossing a threshold, or a round passing via the broadcast `endTurn`),
   * without a bespoke branch in the engine. Each handler is a `CardEffect` run through the same
   * `runEffect` spine (with `ctx.event` set to the trigger via a `resolve` closure), so its gains fold
   * through stickers exactly like `effect`. Dispatch scope per event: the event's *subject* (the drawn/
   * discarded card itself) plus every *operating* tableau building, operating Work card, and threat —
   * see `dispatchEvent`; the subject-less `endTurn` reaches all of those (it's what drives production/
   * threat drains — an `on.endTurn` *replaces* the default per-round behaviour, see `resolveEndTurn`).
   * Rules a handler's `resolve` closure must respect: be **pure over `G`** (the projection clone re-runs
   * it every HUD render, so no logging/animation/IO); **never open a `pendingInteraction`** (the bus can
   * fire at upkeep with no player, like `resolveHandEvents`); and **`filter`, never `splice`**, to
   * self-remove from a zone (the dispatcher iterates a zone snapshot, so a splice wouldn't corrupt the
   * dispatch, but `filter` keeps the array-identity discipline uniform). A `threat`'s own driven defeat
   * does NOT go through `on` — see the `defeat` hook below, the pure-predicate counterpart to `objective`.
   */
  on?: Partial<Record<GameEventType, CardEffect>>;
  /**
   * `objective` cards only: the mission's win condition, owned by the card the way every other card
   * owns its logic. A single **pure-read predicate** over the live run state returning whether the
   * win is met. Read-only by contract: unlike an `effect`/`produces` resolver it never mutates `G`. It's
   * **bus-driven**: `rules/objective.ts`'s `evaluateObjective` re-derives it into `G.pendingVictory`
   * at every `flushEvents` boundary, and `run/engine.ts`'s `checkEndIf` reads that flag — so a
   * threshold like "30 science" registers at the flush where it's crossed. A *defeat* belongs
   * elsewhere: a mission-specific loss that a card must *drive* (a deadline passing, a counter
   * escalating) lives on a threat's `defeat` hook (e.g. `sands_of_time`), and core-resource collapse
   * stays universal in `run/engine.ts` — an objective card never declares its own defeat.
   * `self` is the seeded objective instance, so a future objective can read its own `counters`. Pair
   * with `display.dynamicText` for the progress readout.
   */
  objective?: (G: GameState, self: CardInstance) => boolean;
  /**
   * `threat` cards only: a driven (non-collapse) defeat this threat owns — the threat counterpart to
   * `objective` above. A **pure-read predicate**: returns the defeat reason string the instant the
   * condition is met, or a falsy value otherwise. Read-only by contract — never mutates `G` (a threat
   * that also *drains* resources still does that through its `effect`/`produces`; `defeat` only reports).
   * It's **bus-driven**, the same way `objective` is: `rules/threats.ts`'s `evaluateDefeat` re-derives
   * it into `G.pendingDefeat` at every `flushEvents` boundary, set-OR-CLEAR like `pendingVictory` —
   * never sticky, so a condition that dips and recovers within one broadcast (e.g. a threshold a later
   * subscriber's production tops back up) can't leave a stale flag for `checkEndIf` to misread. A
   * round-based deadline should mirror an `objective`'s own round check (`G.round > N`, not `>= N`) —
   * see `sands_of_time`'s `round > SANDBOX_DEADLINE` below — since `evaluateDefeat` runs at every
   * flush, including the one right after `beginTurn` increments the round, before the player has acted
   * that round.
   */
  defeat?: (G: GameState, self: CardInstance) => string | false | undefined;
  /** The card's display-only concern (face text + art) — split out so authoring a card's look is
   *  separate from its rules. Read exclusively by the render path; see `CardDisplay`. */
  display?: CardDisplay;
  /** A staffable's (`building`/`wonder`/`work`) per-round output once staffed — a `CardEffect` run each
   *  round through `resolveProduction` (a *separate* path from play: its `resources` scale per staffed
   *  worker). `produces.resources` may touch any of the 8 pools (core or strategic — e.g. a
   *  culture-producing wonder puts `culture` here); a scaling/stateful producer authors a
   *  `produces.resolve` closure (which owns its own per-worker scaling). Kept distinct from `effect` so a
   *  one-shot play field can never fire every round. `destroy` is play-only and ignored here. */
  produces?: CardEffect;
}

/** Whether a card is one the player builds decks with. `event` (mission-injected into the deck),
 *  `threat` (seeded onto the board) and `objective` (the mission's win/lose card) are mission-only —
 *  never in a deck/collection/deck editor. The single source for every such filter
 *  (`rules/deckBuilder.ts`'s add-reject, the Collection/DeckEditor pickers), so adding a future
 *  mission-only kind is one edit here, not a scattered `!== 'event' && !== 'threat' && …` list. */
export function isDeckable(card: CardDef): boolean {
  return card.kind === 'building' || card.kind === 'wonder' || card.kind === 'action' || card.kind === 'work';
}

/** Whether a card *occupies a tableau/territory slot* when played — a building or a wonder (a wonder
 *  plays exactly like a building). The single choke point for every "is this placed in the tableau?"
 *  branch: placement routing (`moves.ts`), the territory gate (`playability.ts`), the board's
 *  build-slot pick (`Board.tsx`), and the per-round output text (`CardFace.tsx`). Distinct from
 *  `isStaffable` below, which also covers `work`. */
export function isStructure(card: CardDef): boolean {
  return card.kind === 'building' || card.kind === 'wonder';
}

/** Whether a card *produces and is staffed at upkeep* — a structure (building/wonder) or a `work`
 *  card. The choke point for the per-round production/staffing branches (`effects.ts`'s
 *  `resolveEndTurn`, `events.ts`'s staffable-subject lookup, `CardFace.tsx`'s worker meeples), and
 *  the sim staffing follow-up. A card-kind predicate over a `CardDef`; not to be confused with
 *  `population.ts`'s instance-level `Staffable`/`findStaffable`, which operate on placed instances. */
export function isStaffable(card: CardDef): boolean {
  return isStructure(card) || card.kind === 'work';
}

/** The stable display order of card kinds — the primary key of `compareCards`. Deckable kinds
 *  come first in play-relevance order (building → wonder → work → action); the mission-only kinds
 *  trail — `event` (drawn into hand and playable, or filed to a pile) ahead of the board-only
 *  `threat`/`objective`. */
const KIND_RANK: Record<CardKind, number> = {
  building: 0,
  wonder: 1,
  work: 2,
  action: 3,
  event: 4,
  threat: 5,
  objective: 6,
};

/** Sort key for a card's display name: a leading "The " is dropped so "The Colossus" sorts under
 *  C, not clustered under T with every other "The …". */
function sortName(card: CardDef): string {
  return card.name.replace(/^the\s+/i, '');
}

/** The one stable comparator for every card listing (deck banner/fans, pile viewers, the
 *  Collection/DeckEditor pickers): group by kind, then alphabetical by name within a kind. Keeps
 *  a view's order dependent only on card identity — never on copy count, deck membership, or
 *  discard/draw sequence. Callers add their own instance-id tiebreak to keep a card's copies
 *  contiguous. */
export function compareCards(a: CardDef, b: CardDef): number {
  return KIND_RANK[a.kind] - KIND_RANK[b.kind] || sortName(a).localeCompare(sortName(b));
}

/** Rounds a run of the sandbox mission lasts before the `sands_of_time` deadline threat ends it —
 *  one tunable knob that bounds simulation length without touching the economy baseline. */
export const SANDBOX_DEADLINE = 50;

/** The buildings "Growing Numbers" wants one of each of — the single source both the win predicate
 *  and the `dynamicText` read, so the two can never list a different set. The progress glyph for each
 *  is pulled from the building's own `art` (below), not restated here, so the two can't drift. */
const GROWING_NUMBERS_BUILDINGS: readonly string[] = ['hut', 'farm', 'toolmaker'];

/** How many raider waves "Raiders at the Border" seeds — the single source shared by the
 *  mission's injected event list (`content/missions.ts`), the `raiders_at_border_goal` win threshold,
 *  and its progress readout, so the "defeat *all* the raiders" invariant can't drift between them. */
export const RAIDER_WAVES = 3;

/**
 * The card catalogue. A `building` card *is* the building it becomes in the tableau (its stats
 * live right here); action cards resolve their effect and recycle through the discard; work
 * cards stick onto the board for one turn.
 *
 * The always-owned base cards a fresh player begins with (`content/collection.ts`'s
 * `STARTING_COLLECTION` + the `content/decks.ts` Founding deck): hunter-gatherer *actions* and
 * staffable *work*, deliberately **no buildings** — buildings arrive with the Stone Age arc
 * (unlocked through missions). Numbers here are a first pass. Also holds the sandbox mission's own
 * cards (`sandbox_goal` + `sands_of_time`),
 * which are mission-only (never deckable). Tests install synthetic `test_*` cards via
 * `rules/testFixtures.ts` on top of this map for the duration of a run.
 */
export const CARDS: Record<string, CardDef> = {
  // — Work: staffable board boxes producing only while a worker is assigned, filed to discard at
  //   end of turn. Cost nothing to play and need no idle population to place.
  foraging: { id: 'foraging', name: 'Foraging', kind: 'work', cost: {}, workers: 1, display: { art: '🌿' }, produces: { resources: { food: 3 } } },
  toolmaking: { id: 'toolmaking', name: 'Toolmaking', kind: 'work', cost: {}, workers: 1, display: { art: '🪨' }, produces: { resources: { production: 2 } } },
  // Beer: converts food into culture — pay 2🌾 to play, then it yields 5🎭 each staffed round. The food
  //   is a one-time play cost (charged by `playCard`), the culture a per-worker declarative output, so
  //   it's a plain producer with no bespoke logic. Reward-unlocked by "Restless People", never in the
  //   starting set.
  beer: { id: 'beer', name: 'Beer', kind: 'work', cost: { food: 2 }, workers: 1, display: { art: '🍺' }, produces: { resources: { culture: 5 } } },

  // — Stone Age buildings: the first permanent structures, unlocked by "The First Settlement". A
  //   building *is* the building — it sits in the tableau and produces each round while staffed.
  //   Farm/Toolmaker are ordinary single-worker producers; the Hut is the first building carrying a
  //   one-shot *placement* effect (no per-round output, no worker — just a one-time +1 population when
  //   built), which resolves through `playCard`'s post-placement `resolveCard`.
  farm: { id: 'farm', name: 'Farm', kind: 'building', cost: { production: 2 }, produces: { resources: { food: 1 } }, workers: 1, display: { art: '🌱' } },
  toolmaker: { id: 'toolmaker', name: 'Toolmaker', kind: 'building', cost: { production: 2 }, produces: { resources: { production: 1 } }, workers: 1, display: { art: '⛏️' } },
  hut: {
    id: 'hut', name: 'Hut', kind: 'building', cost: { production: 4 }, workers: 0,
    display: { art: '🛖', description: 'When built: +1 🧍' },
    effect: { resources: { population: 1 } },
  },
  // Göbekli Tepe: the age's first *wonder* (`kind: 'wonder'` — a unique monument that plays like a
  //   building) and the first live card to carry a `cultureLevelReq` gate, so playing it is blocked
  //   until the civilization is cultured enough. Also the first **multi-worker** building (`workers`
  //   is a *capacity*, not a fixed requirement): it operates with any 1–3 workers and its declarative
  //   `produces` values are *per-worker unit* amounts scaled by the staffed count (see
  //   `population.ts`'s `producingUnits`). Unlocked by "Rites & Rituals" so the capstone mission
  //   can *build* it. Cost is still a provisional first pass, not yet tuned.
  gobekli_tepe: {
    id: 'gobekli_tepe', name: 'Göbekli Tepe', kind: 'wonder',
    display: { art: '🗿', description: '+1🔨 +1🪙 +1🎭\nper worker.' },
    cost: { production: 8 }, cultureLevelReq: 1, workers: 3,
    produces: { resources: { production: 1, money: 1, culture: 1 } },
  },

  // — Actions: resolve once, then recycle to discard.
  fire: { id: 'fire', name: 'Fire', kind: 'action', cost: { production: 1 }, display: { art: '🔥' }, effect: { resources: { science: 2 } } },
  bow: { id: 'bow', name: 'Bow', kind: 'action', cost: { production: 2 }, display: { art: '🏹' }, effect: { resources: { military: 3 } } },
  cave_art: { id: 'cave_art', name: 'Cave Art', kind: 'action', cost: { food: 1 }, display: { art: '🖐️' }, effect: { resources: { culture: 2 } } },
  clothing: { id: 'clothing', name: 'Clothing', kind: 'action', cost: { production: 1 }, display: { art: '🧥' }, effect: { resources: { culture: 2 } } },
  jewelry: { id: 'jewelry', name: 'Jewelry', kind: 'action', cost: { production: 1 }, display: { art: '📿' }, effect: { resources: { money: 2 } } },
  bartering: { id: 'bartering', name: 'Bartering', kind: 'action', cost: { money: 1 }, display: { art: '🤝' }, effect: { resources: { food: 2 } } },
  dogs: { id: 'dogs', name: 'Dogs', kind: 'action', cost: { food: 1 }, display: { art: '🐕' }, effect: { resources: { military: 2 } } },
  conquest: { id: 'conquest', name: 'Conquest', kind: 'action', cost: { military: 5 }, display: { art: '🗡️' }, effect: { resources: { territory: 1 } } },

  // Storytelling: the first *interactive* Paleolithic card — suspends mid-resolution for a choice
  //   from the discard, then recovers the picked card to hand (the discard→hand counterpart to
  //   a deck peek). Two-branch resolver keyed on `ctx.answer === undefined` (0 is a valid answer).
  storytelling: {
    id: 'storytelling', name: 'Storytelling', kind: 'action', cost: { science: 2 },
    display: { art: '🗣️', description: 'Return a chosen card from discard to hand.' },
    recoversFromDiscard: true,
    effect: {
      resolve: (ctx) => {
        if (ctx.answer === undefined) {
          // FIRST PASS — reveal the discard as options and suspend. `discardEmpty` is gated
          // unplayable, so the empty guard is only for a direct call; the snapshot excludes
          // Storytelling itself (still held by `playCard`, not yet filed to discard).
          if (ctx.G.discard.length === 0) return;
          suspendChoice(ctx, {
            kind: 'chooseCard',
            prompt: 'Return one card from the discard to your hand',
            options: [...ctx.G.discard],
            pick: 1,
          });
          return;
        }
        // RESUME PASS — `answer` is the chosen index into the parked options. `recoverFromDiscard`
        // finds it in the discard by instance id (identity-based, robust however the resume state was
        // rebuilt) and moves it to hand.
        const pending = ctx.G.pendingInteraction;
        if (!pending) return;
        const chosen = pending.options[ctx.answer];
        if (chosen) recoverFromDiscard(ctx, chosen);
        ctx.G.pendingInteraction = null; // resolver owns clearing the interaction on resume
      },
    },
  },

  // — Stone Age events (mission-only; injected into the deck by a mission, never deckable). An event
  //   is a recurring hazard: left in hand it auto-resolves its drain at end of turn and reshuffles
  //   back to recur; *played*, it pays its cost to banish itself to `removed` unresolved (its effect
  //   never fires — playing is preventive). The raider is the debut resource-*draining* event: it
  //   bleeds 1🌾 each round it's left standing, and is driven off for good by paying 3⚔️ — "Raiders at
  //   the Border" is won by defusing all its waves this way.
  raider: { id: 'raider', name: 'Raiders', kind: 'event', cost: { military: 3 }, display: { art: '🪓' }, effect: { resources: { food: -1 } } },

  // — "The First Settlement" objective (mission-only): stockpile 10🔨 and 10⚔️. Owns its own win
  //   predicate the way every objective does; no defeat of its own (famine/collapse is universal).
  first_settlement_goal: {
    id: 'first_settlement_goal', name: 'The First Settlement', kind: 'objective', cost: {},
    objective: (G) => G.resources.production >= 10 && G.resources.military >= 10,
    display: {
      description: 'Have 10 🔨 and 10 ⚔️',
      dynamicText: (G) => `🔨 ${G.resources.production}/10 · ⚔️ ${G.resources.military}/10`,
    },
  },
  growing_numbers_goal: {
    id: 'growing_numbers_goal', name: 'Growing Numbers', kind: 'objective', cost: {},
    objective: (G) =>
      GROWING_NUMBERS_BUILDINGS.every((id) => G.tableau.some((b) => b.cardId === id)),
    display: {
      description: 'Build 🛖 🌱 ⛏️',
      dynamicText: (G) =>
        GROWING_NUMBERS_BUILDINGS.map(
          (id) => `${CARDS[id].display?.art} ${G.tableau.some((b) => b.cardId === id) ? 1 : 0}/1`,
        ).join('\n'),
    },
  },

  // — "Rites & Rituals" objective (mission-only): reach 🎭 culture level 2. Reads the derived culture
  //   level (never a stored field); the progress line anchors on the level, since `cultureProgress`'s
  //   within-band current/needed resets at each level-up and would read confusingly against a level target.
  rites_rituals_goal: {
    id: 'rites_rituals_goal', name: 'Rites & Rituals', kind: 'objective', cost: {},
    objective: (G) => cultureLevel(G.resources.culture) >= 2,
    display: {
      description: 'Reach 🎭 level 2',
      dynamicText: (G) => {
        const p = cultureProgress(G.resources.culture);
        return p.level >= 2 ? '🎭 Level 2/2' : `🎭 Level ${p.level}/2`;
      },
    },
  },

  // — "Raiders at the Border" objective (mission-only): defeat every raider wave by *playing* it —
  //   paying its 3⚔️ cost banishes it to `removed` (the only path a raider reaches that pile, since
  //   demolish only files buildings there). So the win is purely a count of raiders in `removed`; the
  //   pressure is the food they drain each round left unplayed, so no mission-specific defeat is
  //   needed (famine is the universal loss).
  raiders_at_border_goal: {
    id: 'raiders_at_border_goal', name: 'Raiders at the Border', kind: 'objective', cost: {},
    objective: (G) => G.removed.filter((c) => c.cardId === 'raider').length >= RAIDER_WAVES,
    display: {
      description: `Defeat all ${RAIDER_WAVES} raider waves`,
      dynamicText: (G) =>
        `⚔️ ${Math.min(G.removed.filter((c) => c.cardId === 'raider').length, RAIDER_WAVES)}/${RAIDER_WAVES} defeated`,
    },
  },

  // — "Restless People" objective (mission-only): reach 🎭 culture level 2 to placate the unrest — the
  //   same culture-level win as "Rites & Rituals", but its own card so the objective plaque shows this
  //   mission's name and progress. Reads the derived culture level, never a stored field.
  restless_people_goal: {
    id: 'restless_people_goal', name: 'Restless People', kind: 'objective', cost: {},
    objective: (G) => cultureLevel(G.resources.culture) >= 2,
    display: {
      description: 'Reach 🎭 level 2',
      dynamicText: (G) => {
        const p = cultureProgress(G.resources.culture);
        return p.level >= 2 ? '🎭 Level 2/2' : `🎭 Level ${p.level}/2`;
      },
    },
  },

  // — Sandbox mission cards (mission-only; excluded from decks/collection by `isDeckable`).
  //   The objective never wins (an infinite mission scores rounds survived instead), so the run is
  //   bounded purely by the no-drain deadline threat below.
  sandbox_goal: {
    id: 'sandbox_goal', name: 'The Long Wander', kind: 'objective', cost: {},
    display: {
      art: '👣',
      description: 'There is no goal but to endure. Survive as long as the band can.',
      dynamicText: (G) => `Round ${G.round}`,
    },
    objective: () => false,
  },
  sands_of_time: {
    id: 'sands_of_time', name: 'The Sands of Time', kind: 'threat', cost: {},
    display: {
      art: '⏳',
      description: `The age turns. When round ${SANDBOX_DEADLINE} elapses, the wandering ends.`,
      dynamicText: (G) => `Round ${Math.min(G.round, SANDBOX_DEADLINE)}/${SANDBOX_DEADLINE}`,
    },
    defeat: (G) => G.round > SANDBOX_DEADLINE && 'the sands of time',
  },

  // — "Restless People" threat (mission-only): unrest that scales with your own size. It reacts to the
  //   `reshuffle` bus event (`rules/deck.ts` emits one each time the discard folds back into the deck),
  //   draining 1🪙 per 🧍 every recycle — so a bigger population is a heavier burden. Stateless: no
  //   counter, just a drain on each reshuffle (pure under the projection clone). No `defeat` of its own —
  //   the pressure is 🪙 bled into a bankruptcy collapse (the money counterpart to raider famine).
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
};
