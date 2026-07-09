import { scaleResources, subtractResources, type Resources } from '../rules/resources';
import { bumpCounter, getCounter, type CardInstance, type GameEventType, type GameState } from '../rules/state';
import { drawInstance, peekTop, returnToDeck } from '../rules/deck';
import { gainResources, suspendChoice, type CardEffect, type Resolver } from '../rules/effects';
import { effectiveGain } from '../rules/stickers';

export type CardKind = 'building' | 'action' | 'work' | 'event' | 'threat' | 'objective';

export interface CardDef {
  id: string;
  name: string;
  /**
   * What the card *is* and where it goes after play:
   * - `building`: the card *is* a building — playing it places it in the **tableau** (one
   *   territory slot), auto-staffed from idle population, where it produces `produces`/
   *   `cultureOutput` each round while staffed. It stays in play, filed nowhere, until
   *   something removes it from the tableau — where its card goes *then* isn't an inherent
   *   trait of `building`, it's whatever the removing effect specifies. Today that's only
   *   the Destroy action card, whose `effect.destroy` sends it to **removed**; a future card
   *   could just as well discard a building instead (e.g. to reclaim territory) and file it
   *   to **discard** like anything else.
   * - `action`: resolves its `effect`, then recycles to the **discard** pile.
   * - `work`: the card sticks onto the board as a staffable work box (see `workers`); it
   *   produces its `effect.gain` only while staffed, then recycles to the **discard** pile at
   *   *end of turn* (not on play). No population is locked and no idle pop is required to play it.
   * - `event`: not player-playable and never in the deck editor/collection — missions inject it.
   *   An event left in hand at end of turn auto-resolves its effect, then files by the same
   *   default as any other card: **discard**, unless its effect specifies `remove: true` (e.g.
   *   Barbarian), which sends it to **removed** instead. Not an inherent trait of `event` itself.
   * - `threat`: a persistent board hazard, never in hand/deck/collection/deck editor — a mission's
   *   `setup` seeds it directly into `GameState.threats` (`rules/threats.ts`'s `addThreat`), not a
   *   pile. Unlike `event` (resolves once from hand, then files away), a threat ticks *every* upkeep
   *   via the `endTurn` broadcast (`rules/events.ts`'s `dispatchEvent` → `resolveEndTurn` →
   *   `resolveCard`) and stays on the board indefinitely — the card's own `effect`/`resolve` computes
   *   and applies its drain (and, for one that escalates, bumps its own counter), the same resolver
   *   spine every other card resolves through.
   * - `objective`: a mission's win/lose condition made into a card — the positive counterpart to
   *   `threat`. Seeded once at setup into `GameState.objective` (`rules/objective.ts`'s
   *   `seedObjective`) from the mission's `objectiveCardId`, never in hand/deck/collection/deck
   *   editor. Unlike a threat it has *no* per-upkeep effect and never mutates `G` — it owns its
   *   mission's win/lose *logic* instead, as the pure-read `objective` hook below (`rules/objective.ts`
   *   polls it from `run/engine.ts`'s `checkEndIf` at move granularity), plus a `dynamicText` for its
   *   live progress line. A real `CardInstance`, so a future objective can carry its own `counters`.
   */
  kind: CardKind;
  /** Resources required to play. Absent keys are free (e.g. {} = no cost). */
  cost: Partial<Resources>;
  /** `building` and `work` cards: worker spaces to operate. Defaults to 1; `0` = self-sufficient
   *  (always operating, e.g. City Walls). */
  workers?: number;
  /** Extra cost: number of other cards you must discard from hand to play this. */
  discardCost?: number;
  /** Minimum culture level required to play — a gate, not a cost (culture is not consumed). */
  cultureLevelReq?: number;
  /** Immediate one-shot effect when played (resource gain/loss, draw, population, territory,
   *  culture, or demolish). `building` cards have none — their output is the passive `produces`
   *  below; `work` cards defer their `effect.gain` until staffed at upkeep. This declarative bag
   *  drives both the default resolver (`specToResolver`) and the card's auto-generated text
   *  (`describeCard`) / play gates (`unplayableReason`), so most cards need only this. */
  effect?: CardEffect;
  /** Bespoke play-time behavior for a card whose logic the declarative `effect` can't express
   *  (self-reference, per-card state, targeting, interaction). When present it *replaces* the
   *  default resolver derived from `effect`; the card then authors its own `description` for the
   *  face, since there's no data bag to auto-render. Lives on the static catalogue, never in
   *  `GameState` — see `rules/effects.ts`'s `EffectContext`. */
  resolve?: Resolver;
  /**
   * How many cards this card reveals off the draw pile when played (a peek card — e.g. Foresight's 3).
   * A declarative descriptor that drives *two* things so they can't drift: the resolver reads it for
   * its `peekTop` count, and `rules/playability.ts`'s `unplayableReason` gates the card as
   * `emptyDrawPile` when both draw and discard piles are empty (nothing to reveal) — the same
   * dual-purpose pattern as `effect.destroy` (which both demolishes and drives `noBuildingsToDestroy`).
   */
  revealsFromDeck?: number;
  /**
   * Bespoke per-round production behavior for a `building`/`work` card whose output isn't fully
   * described by `produces`/`cultureOutput`/`effect.gain` (e.g. a future scaling building reading
   * its own `self.counters`, mirroring Cornucopia's per-play `resolve`). When present it *replaces*
   * the declarative default built from those fields. Separate from `resolve`: a building/work card's
   * production ticks every upkeep while staffed, never at play, so it can't share the play-time
   * resolver without risking a one-shot play field (draw, population, destroy) firing every round —
   * see `rules/effects.ts`'s `resolveProduction`.
   */
  produce?: Resolver;
  /**
   * Event-bus reactions (`rules/events.ts`): a map from a game-event type to a handler that runs when
   * that event fires — the way a card reacts to something whose *timing it doesn't own* (a draw, a
   * discard elsewhere, a resource crossing a threshold, or a round passing via the broadcast
   * `endTurn`), without a bespoke branch in the engine. Each handler is an ordinary `Resolver`, run
   * through the same `EffectContext` spine (with `ctx.event` set to the trigger), so it mutates
   * `ctx.G` and adds output through `gainResources` (sticker-folded) exactly like `resolve`. Dispatch
   * scope per event: the event's *subject* (the drawn/discarded card itself) plus every *operating*
   * tableau building, operating Work card, and threat — see `dispatchEvent`; the subject-less
   * `endTurn` reaches all of those (it's what drives production/threat drains — an `on.endTurn`
   * *replaces* the default per-round behaviour, see `resolveEndTurn`). Rules a handler must respect:
   * be **pure over `G`** (the projection clone re-runs it every HUD render, so no logging/animation/
   * IO); **never open a `pendingInteraction`** (the bus can fire at upkeep with no player, like
   * `resolveHandEvents`); and **`filter`, never `splice`**, to self-remove from a zone (the
   * dispatcher iterates a zone snapshot, so a splice wouldn't corrupt the dispatch, but `filter`
   * keeps the array-identity discipline uniform). A `threat`'s own driven defeat does NOT go through
   * `on` — see the `defeat` hook below, the pure-predicate counterpart to `objective`.
   */
  on?: Partial<Record<GameEventType, Resolver>>;
  /**
   * `objective` cards only: the mission's win condition, owned by the card the way every other card
   * owns its logic. A single **pure-read predicate** over the live run state returning whether the
   * win is met. Read-only by contract: unlike `resolve`/`produce` it never mutates `G`. It's
   * **bus-driven**: `rules/objective.ts`'s `evaluateObjective` re-derives it into `G.pendingVictory`
   * at every `flushEvents` boundary, and `run/engine.ts`'s `checkEndIf` reads that flag — so a
   * threshold like "30 science" registers at the flush where it's crossed. A *defeat* belongs
   * elsewhere: a mission-specific loss that a card must *drive* (a deadline passing, a counter
   * escalating) lives on a threat's `defeat` hook (e.g. Stagnation), and core-resource collapse
   * stays universal in `run/engine.ts` — an objective card never declares its own defeat.
   * `self` is the seeded objective instance, so a future objective can read its own `counters`. Pair
   * with `dynamicText` for the progress readout.
   */
  objective?: (G: GameState, self: CardInstance) => boolean;
  /**
   * `threat` cards only: a driven (non-collapse) defeat this threat owns — the threat counterpart to
   * `objective` above. A **pure-read predicate**: returns the defeat reason string the instant the
   * condition is met, or a falsy value otherwise. Read-only by contract — never mutates `G` (a threat
   * that also *drains* resources still does that through `resolve`/`produce`; `defeat` only reports).
   * It's **bus-driven**, the same way `objective` is: `rules/threats.ts`'s `evaluateDefeat` re-derives
   * it into `G.pendingDefeat` at every `flushEvents` boundary, set-OR-CLEAR like `pendingVictory` —
   * never sticky, so a condition that dips and recovers within one broadcast (e.g. a threshold a later
   * subscriber's production tops back up) can't leave a stale flag for `checkEndIf` to misread. A
   * round-based deadline should mirror an `objective`'s own round check (`G.round > N`, not `>= N`) —
   * see `long_winter_goal`'s `round > 15` and Stagnation below — since `evaluateDefeat` runs at every
   * flush, including the one right after `beginTurn` increments the round, before the player has acted
   * that round.
   */
  defeat?: (G: GameState, self: CardInstance) => string | false | undefined;
  /** Hand-authored effect text for the card face, used when the declarative `effect` bag can't
   *  describe the card (a `resolve`-driven card). Takes precedence over the auto-generated
   *  `describeCard` text. */
  description?: string;
  /** Run-aware effect text: given the live `GameState` and the specific card instance being
   *  rendered, returns that copy's *current* effect summary (e.g. Cornucopia's growing "+N🌾", which
   *  depends on how often *this* copy has been played). Rendered in the card's bottom-most text
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
  /** `building` cards: per-round output once staffed. */
  produces?: Partial<Resources>;
  /** `building` cards: per-round culture gained while staffed — accumulates on G.culture. */
  cultureOutput?: number;
  /** `building` cards: classification tags, e.g. 'building' | 'wonder'. */
  tags?: string[];
}

/** Whether a card is one the player builds decks with. `event` (mission-injected into the deck),
 *  `threat` (seeded onto the board) and `objective` (the mission's win/lose card) are mission-only —
 *  never in a deck/collection/deck editor. The single source for every such filter
 *  (`rules/deckBuilder.ts`'s add-reject, the Collection/DeckEditor pickers), so adding a future
 *  mission-only kind is one edit here, not a scattered `!== 'event' && !== 'threat' && …` list. */
export function isDeckable(card: CardDef): boolean {
  return card.kind === 'building' || card.kind === 'action' || card.kind === 'work';
}

/** The stable display order of card kinds — the primary key of `compareCards`. Deckable kinds
 *  come first in play-relevance order (building → work → action); the mission-only kinds trail
 *  (only the pile viewer ever lists one, e.g. a Barbarian `event` filed to `removed`). */
const KIND_RANK: Record<CardKind, number> = {
  building: 0,
  work: 1,
  action: 2,
  event: 3,
  threat: 4,
  objective: 5,
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

/** Number of Barbarian waves in the Barbarian Tide mission. Lives here (not in `content/missions.ts`)
 *  so the single source is shared by the `barbarian_tide` mission (how many events it seeds) and the
 *  `barbarian_tide_goal` objective card (how many must be beaten to win / the "N/4" progress line). */
export const BARBARIANS = 4;

/**
 * The card catalogue. A `building` card *is* the building it becomes in the tableau (its stats
 * live right here); action cards resolve their effect and recycle through the discard; work
 * cards stick onto the board for one turn.
 */
export const CARDS: Record<string, CardDef> = {
  // --- Building cards: played onto the tableau as a building; stay until demolished. ---
  farm: { id: 'farm', name: 'Farm', kind: 'building', cost: { production: 1 }, produces: { food: 2 }, workers: 1, tags: ['building'] },
  granary: { id: 'granary', name: 'Granary', kind: 'building', cost: { production: 2 }, produces: { food: 3 }, workers: 1, tags: ['building'] },
  workshop: { id: 'workshop', name: 'Workshop', kind: 'building', cost: { production: 2 }, produces: { production: 2 }, workers: 1, tags: ['building'] },
  library: { id: 'library', name: 'Library', kind: 'building', cost: { production: 3 }, produces: { science: 2 }, workers: 1, tags: ['building'] },
  university: { id: 'university', name: 'University', kind: 'building', cost: { production: 4 }, produces: { science: 3 }, workers: 1, tags: ['building'] },
  walls: { id: 'walls', name: 'City Walls', kind: 'building', cost: { production: 2 }, produces: { military: 3 }, workers: 0, tags: ['building'] },
  barracks: { id: 'barracks', name: 'Barracks', kind: 'building', cost: { production: 2 }, produces: { production: 1, military: 2 }, workers: 1, tags: ['building'] },
  theater: { id: 'theater', name: 'Theater', kind: 'building', cost: { production: 3 }, cultureOutput: 2, workers: 1, tags: ['building'] },
  market: { id: 'market', name: 'Market', kind: 'building', cost: { production: 2 }, produces: { money: 2 }, workers: 1, tags: ['building'] },
  trading_post: { id: 'trading_post', name: 'Trading Post', kind: 'building', cost: { production: 3 }, produces: { money: 3 }, workers: 1, tags: ['building'] },

  // --- Wonder cards (building cards tagged 'wonder'). ---
  pyramids: { id: 'pyramids', name: 'The Pyramids', kind: 'building', cost: { production: 4 }, produces: { production: 1, military: 1 }, workers: 1, tags: ['wonder'] },
  great_library: { id: 'great_library', name: 'The Great Library', kind: 'building', cost: { production: 4 }, produces: { science: 2 }, workers: 1, tags: ['wonder'] },
  colossus: { id: 'colossus', name: 'The Colossus', kind: 'building', cost: { production: 4 }, produces: { food: 1, science: 1, military: 1 }, workers: 1, tags: ['wonder'] },

  // --- Action cards (recycle to the discard). ---
  settlers: { id: 'settlers', name: 'Settlers', kind: 'action', cost: { food: 2 }, effect: { population: 1 } },
  eureka: { id: 'eureka', name: 'Eureka!', kind: 'action', cost: {}, discardCost: 1, effect: { gain: { science: 3 } } },
  inspiration: { id: 'inspiration', name: 'Inspiration', kind: 'action', cost: { money: 1 }, effect: { draw: 2 } },

  // Cornucopia: a bespoke-resolver card whose gain *grows* with a *per-instance* play counter (the
  // first per-instance-state card). Each physical copy gains +1🌾 its first play and +1 more for
  // every prior play *of that same copy* this run — the count lives in the instance's own `counters`
  // (via getCounter/bumpCounter) and rides with the card through discard/reshuffle, so playing one
  // Cornucopia never buffs the others. The base gain is folded through stickers via the shared
  // `gainResources`/`effectiveGain`, so e.g. Reinforced correctly bumps this card's output too.
  cornucopia: ((): CardDef => {
    // Base gain of THIS copy right now (before stickers): +1🌾, +1 more per prior play of this same
    // copy. The one place resolve and the card-face text compute that base, so the two never disagree.
    const base = (self: CardInstance) => scaleResources({ food: 1 }, getCounter(self, 'plays') + 1);
    return {
      id: 'cornucopia', name: 'Cornucopia', kind: 'action', cost: {},
      description: '+1🌾',
      dynamicRule: '+1 each time played',
      dynamicText: (_G, self) => `+${effectiveGain(base(self), self)!.food}🌾`,
      resolve: (ctx) => {
        gainResources(ctx, base(ctx.self));
        bumpCounter(ctx.self, 'plays');
      },
    };
  })(),

  // Foresight: the first *interactive* card — its effect suspends mid-resolution for a player choice.
  // Reveals the top 3 of the draw pile, you draw 1, the rest shuffle back. The two-branch resolver
  // (keyed on `answer === undefined`) parks the revealed cards in G.pendingInteraction on the first
  // pass and completes on resume; see rules/state.ts's PendingInteraction. The whole thing is pure
  // *intent*: it touches no `G.deck`/`G.hand`/`G.rngState`/`pendingInteraction` directly, only the
  // card-facing spine primitives (peekTop/suspendChoice/drawInstance/returnToDeck) — the reveal
  // count `reveals` (shared with `revealsFromDeck`, an IIFE-captured single source like Cornucopia's
  // `base`) gates the card as unplayable when both piles are empty, so `peekTop` always sees >= 1 card.
  foresight: ((): CardDef => {
    const reveals = 3;
    return {
      id: 'foresight', name: 'Foresight', kind: 'action', cost: { science: 1 },
      revealsFromDeck: reveals,
      description: 'Peek the top 3 cards; draw 1, shuffle the rest back',
      resolve: (ctx) => {
        if (ctx.answer === undefined) {
          // Reveal: lift up to `reveals` off the top into a choice tray (peekTop reshuffles the
          // discard in as needed and its removal fires GameContext's reveal-boundary, clearing undo).
          suspendChoice(ctx, {
            kind: 'chooseCard',
            prompt: 'Draw one — the rest shuffle back',
            options: peekTop(ctx, reveals),
            pick: 1,
          });
          return;
        }
        // Resume: `answer` is the chosen index (0 is valid — hence `=== undefined` above). Draw it; the
        // rest shuffle back deterministically from the run's RNG stream.
        const pending = ctx.G.pendingInteraction;
        if (!pending) return;
        const chosen = pending.options[ctx.answer];
        const rest = pending.options.filter((_, i) => i !== ctx.answer);
        if (chosen !== undefined) drawInstance(ctx, chosen);
        returnToDeck(ctx, rest);
        ctx.G.pendingInteraction = null; // resolver still owns clearing the interaction on resume
      },
    };
  })(),

  // --- Work cards: stick onto the board as a staffable box; produce only while staffed,
  //     then recycle to the discard at end of turn. ---
  corvee: { id: 'corvee', name: 'Corvée', kind: 'work', cost: {}, workers: 1, effect: { gain: { production: 3 } } },
  harvest: { id: 'harvest', name: 'Harvest', kind: 'work', cost: {}, workers: 1, effect: { gain: { food: 3 } } },

  // --- Territory expansion: action cards that raise the building-slot cap. ---
  conquest: { id: 'conquest', name: 'Conquest', kind: 'action', cost: { military: 3 }, effect: { territory: 1 } },
  develop: { id: 'develop', name: 'Develop', kind: 'action', cost: { production: 3 }, effect: { territory: 1 } },

  // --- Culture cards: generate culture or require a culture threshold. ---
  cultural_festival: { id: 'cultural_festival', name: 'Cultural Festival', kind: 'action', cost: { food: 2 }, effect: { culture: 3 } },
  philosopher: { id: 'philosopher', name: 'The Philosopher', kind: 'action', cost: { science: 1 }, cultureLevelReq: 1, effect: { gain: { science: 3 }, draw: 1 } },

  // --- Territory management: reclaim a slot by demolishing a building. ---
  destroy: { id: 'destroy', name: 'Destroy', kind: 'action', cost: { production: 1 }, effect: { destroy: true } },

  // --- Event-bus example cards (`rules/events.ts`): each reacts to an event whose *timing it
  //     doesn't own*, via a `CardDef.on` handler — the trigger layer's first consumers. Kept
  //     deckable (playable, not mission-only) so they're immediately feel-testable.

  // Scriptorium — *observer* of the on-draw event: while operating, gains money each time an
  // action/effect draws a card — *not* the routine round-start refill (it filters on the draw's
  // `source`; the dispatcher also applies the staffing gate, so an idle Scriptorium never fires). A
  // building with no passive `produces`: its whole output is the reaction.
  scriptorium: {
    id: 'scriptorium', name: 'Scriptorium', kind: 'building', cost: { production: 3 }, workers: 1, tags: ['building'],
    description: '+1💰 each time a card effect draws a card (while staffed; not the round-start draw)',
    on: {
      draw: (ctx) => {
        if (ctx.event?.type === 'draw' && ctx.event.source === 'effect') gainResources(ctx, { money: 1 });
      },
    },
  },

  // Salvage — *self-triggered* by the on-discard event: reacts to *its own* discard, but only a
  // sacrifice (a discard-cost cost), not the routine end-of-turn recycle. The reason rides on the
  // event, so the handler tells them apart. Played normally it does nothing (its value is being fed
  // to another card's discard cost).
  salvage: {
    id: 'salvage', name: 'Salvage', kind: 'action', cost: {},
    description: 'When discarded as a sacrifice: +2🔨',
    on: {
      discard: (ctx) => {
        if (ctx.event?.type === 'discard' && ctx.event.reason === 'sacrifice') gainResources(ctx, { production: 2 });
      },
    },
  },

  // Treasury — *threshold* observer of the on-resourceChange event: the first time money crosses 10
  // (comparing the boundary's before-snapshot against live G), pays out once — a per-copy `fired`
  // counter, like Cornucopia's, so it fires once per physical copy, not once globally. Needs staffing
  // (observer scope), hence "while staffed".
  treasury: {
    id: 'treasury', name: 'Treasury', kind: 'building', cost: { production: 2, money: 2 }, workers: 1, tags: ['building'],
    description: 'While staffed, the first time your 💰 reaches 10: +5🔬 (once)',
    on: {
      resourceChange: (ctx) => {
        const e = ctx.event;
        if (e?.type !== 'resourceChange') return;
        if (getCounter(ctx.self, 'fired')) return;
        if (e.before.resources.money < 10 && ctx.G.resources.money >= 10) {
          gainResources(ctx, { science: 5 });
          bumpCounter(ctx.self, 'fired');
        }
      },
    },
  },

  // --- Event cards: mission-injected, not player-playable. Auto-resolve at end of turn;
  //     `remove: true` sends this one to removed instead of the default discard. ---
  barbarian: { id: 'barbarian', name: 'Barbarian', kind: 'event', cost: {}, effect: { loss: { military: 4 }, remove: true } },

  // --- Threat cards: mission-seeded persistent board hazards (`rules/threats.ts`'s `addThreat`),
  //     never in hand/deck/collection/deck editor. Ticks every upkeep, forever — see the `kind`
  //     doc above. Harsh Winter is a flat, non-escalating drain (The Long Winter's old onUpkeep
  //     special-case, now a real card); its declarative `effect.loss` needs no bespoke `resolve`.
  harsh_winter: {
    id: 'harsh_winter', name: 'Harsh Winter', kind: 'threat', cost: {},
    effect: { loss: { food: 2 } },
    description: '−2🌾 every round',
  },

  // Creeping Decay: the first *escalating* threat — mirrors Cornucopia's own-counter growth
  // but draining instead of gaining, and tick-triggered instead of play-triggered. A
  // bespoke `resolve` (not a declarative `effect.loss`) since the drain scales with its own
  // `level` counter: −1🔨 the first tick, −2 the next, and so on, eventually forcing Production
  // negative and a 'ruin' core collapse — the mission built around it (The Long Decline) never
  // wins on its own; that collapse is its only ending.
  creeping_decay: {
    id: 'creeping_decay', name: 'Creeping Decay', kind: 'threat', cost: {},
    description: '−1🔨 every round, worsening',
    dynamicRule: '+1 more each round',
    dynamicText: (_G, self) => `−${getCounter(self, 'level') + 1}🔨 every round`,
    resolve: ({ G, self }) => {
      subtractResources(G.resources, scaleResources({ production: 1 }, getCounter(self, 'level') + 1));
      bumpCounter(self, 'level');
    },
  },

  // Stagnation: the Enlightenment mission's visible round-12 deadline as a threat that owns its own
  // defeat (no resource drain). Its whole responsibility is the *deadline* — the round count — and
  // nothing else: a pure `defeat` predicate, re-derived by `rules/threats.ts`'s `evaluateDefeat` at
  // every flush (the threat counterpart to `objective`). It deliberately does NOT read Science:
  // reaching 30 is the *objective card's* win condition, which `run/engine.ts`'s `checkEndIf` polls
  // *before* `pendingDefeat` — so a player who hit the goal (even via round-12 production) has
  // already won and the run has ended before this defeat is ever read. Win and lose stay cleanly
  // split across the two cards, reconciled only by that poll order. `round > 12` (not `>= 12`)
  // mirrors `long_winter_goal`'s own round check: `evaluateDefeat` runs at every flush, including the
  // one right after `beginTurn` sets `G.round` to 12 — `>= 12` would end the run before round 12 is
  // ever played. `> 12` instead lands at the *next* `beginTurn` (round 13), by which point round 12
  // (and its own upkeep) has fully played out — the player never gets to act in round 13 either way.
  enlightenment_deadline: {
    id: 'enlightenment_deadline', name: 'Stagnation', kind: 'threat', cost: {},
    description: 'If round 12 ends before the Enlightenment is achieved, stagnation ends your run.',
    dynamicText: (G) => `Round ${Math.min(G.round, 12)}/12`,
    defeat: (G) => G.round > 12 && 'stagnation',
  },

  // --- Objective cards: a mission's win condition made into a card (see the `objective` kind doc
  //     above). `rules/objective.ts`'s `seedObjective` seeds one into `GameState.objective` from the
  //     mission's `objectiveCardId`; never in hand/deck/collection/deck editor. Each owns its
  //     mission's win (the `objective` predicate) as a pure read over `G` — moved off `MissionDef` so objective
  //     cards own their logic like every other card — plus a live progress line (`dynamicText`). A
  //     mission-specific *defeat* lives on a threat's own `defeat` predicate, not here. No `effect`/
  //     `resolve`: they never mutate G.
  long_winter_goal: {
    id: 'long_winter_goal', name: 'The Long Winter', kind: 'objective', cost: {},
    description: 'Endure 15 rounds of brutal winter without starving.',
    objective: (G) => G.round > 15,
    dynamicText: (G) => `${Math.min(G.round, 15)}/15 Round`,
  },
  enlightenment_goal: {
    id: 'enlightenment_goal', name: 'The Enlightenment', kind: 'objective', cost: {},
    description: 'Reach 30 Science before round 12 ends.',
    // The round-12 deadline (and the loss it causes) is owned by the Stagnation *threat* the mission
    // seeds (its own `defeat` predicate) — the objective card only owns the win.
    objective: (G) => G.resources.science >= 30,
    dynamicText: (G) => `${G.resources.science}/30🔬`,
  },
  barbarian_tide_goal: {
    id: 'barbarian_tide_goal', name: 'Barbarian Tide', kind: 'objective', cost: {},
    description: `Survive all ${BARBARIANS} Barbarian waves without your Military falling below zero.`,
    objective: (G) =>
      G.removed.filter((c) => c.cardId === 'barbarian').length >= BARBARIANS && G.resources.military >= 0,
    dynamicText: (G) =>
      `${G.removed.filter((c) => c.cardId === 'barbarian').length}/${BARBARIANS} Barbarian`,
  },
  the_long_decline_goal: {
    id: 'the_long_decline_goal', name: 'The Long Decline', kind: 'objective', cost: {},
    description: 'Each turn survived rewards you one more Influence.',
    objective: () => false,
    dynamicText: (G) => `Round ${G.round}`,
  },
};
