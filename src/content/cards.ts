import { type Resources } from '../rules/resources';
import { type CardInstance, type GameEventType, type GameState } from '../rules/state';
import { type CardEffect, type Resolver, suspendChoice } from '../rules/effects';
import { recoverFromDiscard } from '../rules/deck';

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
   *   default as any other card: **discard**, unless its effect specifies `remove: true`, which
   *   sends it to **removed** instead. Not an inherent trait of `event` itself.
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
   *  (always operating, e.g. a defensive structure that needs no staffing). */
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
   * Bespoke per-round production behavior for a `building`/`work` card whose output isn't fully
   * described by `produces`/`cultureOutput`/`effect.gain` (e.g. a future scaling building reading
   * its own `self.counters`, the production counterpart to a per-play `resolve`). When present it *replaces*
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
   * escalating) lives on a threat's `defeat` hook (e.g. `sands_of_time`), and core-resource collapse
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
   * see `sands_of_time`'s `round > SANDBOX_DEADLINE` below — since `evaluateDefeat` runs at every
   * flush, including the one right after `beginTurn` increments the round, before the player has acted
   * that round.
   */
  defeat?: (G: GameState, self: CardInstance) => string | false | undefined;
  /** Hand-authored effect text for the card face, used when the declarative `effect` bag can't
   *  describe the card (a `resolve`-driven card). Takes precedence over the auto-generated
   *  `describeCard` text. */
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
 *  (only the pile viewer ever lists one, e.g. an `event` filed to `removed`). */
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

/** Rounds a run of the sandbox mission lasts before the `sands_of_time` deadline threat ends it —
 *  one tunable knob that bounds simulation length (Step 4) without touching the economy baseline. */
export const SANDBOX_DEADLINE = 50;

/**
 * The card catalogue. A `building` card *is* the building it becomes in the tableau (its stats
 * live right here); action cards resolve their effect and recycle through the discard; work
 * cards stick onto the board for one turn.
 *
 * **Phase 4 Step 3 — the Paleolithic starting set.** The always-owned base cards a fresh player
 * begins with (`content/collection.ts`'s `STARTING_COLLECTION` + the `content/decks.ts` Founding
 * deck): hunter-gatherer *actions* and staffable *work*, deliberately **no buildings** — buildings
 * arrive with the Neolithic arc (unlocked through missions). Numbers here are a first pass, tuned by
 * the Step 4 simulator. Also holds the sandbox mission's own cards (`sandbox_goal` + `sands_of_time`),
 * which are mission-only (never deckable). Tests install synthetic `test_*` cards via
 * `rules/testFixtures.ts` on top of this map for the duration of a run.
 */
export const CARDS: Record<string, CardDef> = {
  // — Work: staffable board boxes producing only while a worker is assigned, filed to discard at
  //   end of turn. Cost nothing to play and need no idle population to place.
  foraging: { id: 'foraging', name: 'Foraging', kind: 'work', cost: {}, workers: 1, effect: { gain: { food: 3 } } },
  toolmaking: { id: 'toolmaking', name: 'Toolmaking', kind: 'work', cost: {}, workers: 1, effect: { gain: { production: 2 } } },

  // — Actions: resolve once, then recycle to discard.
  fire: { id: 'fire', name: 'Fire', kind: 'action', cost: { production: 1 }, effect: { gain: { science: 2 } } },
  bow: { id: 'bow', name: 'Bow', kind: 'action', cost: { production: 2 }, effect: { gain: { military: 3 } } },
  cave_art: { id: 'cave_art', name: 'Cave Art', kind: 'action', cost: { food: 1 }, effect: { culture: 2 } },
  clothing: { id: 'clothing', name: 'Clothing', kind: 'action', cost: { production: 1 }, effect: { culture: 2 } },
  jewelry: { id: 'jewelry', name: 'Jewelry', kind: 'action', cost: { production: 1 }, effect: { gain: { money: 2 } } },
  bartering: { id: 'bartering', name: 'Bartering', kind: 'action', cost: { money: 1 }, effect: { gain: { food: 2 } } },
  dogs: { id: 'dogs', name: 'Dogs', kind: 'action', cost: { food: 1 }, effect: { gain: { military: 2 } } },

  // Storytelling: the first *interactive* Paleolithic card — suspends mid-resolution for a choice
  //   from the discard, then recovers the picked card to hand (the discard→hand counterpart to
  //   a deck peek). Two-branch resolver keyed on `ctx.answer === undefined` (0 is a valid answer).
  storytelling: {
    id: 'storytelling', name: 'Storytelling', kind: 'action', cost: { science: 2 },
    recoversFromDiscard: true,
    description: 'Return a card from your discard pile to your hand.',
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

  // — Sandbox mission cards (mission-only; excluded from decks/collection by `isDeckable`).
  //   The objective never wins (an infinite mission scores rounds survived instead), so the run is
  //   bounded purely by the no-drain deadline threat below.
  sandbox_goal: {
    id: 'sandbox_goal', name: 'The Long Wander', kind: 'objective', cost: {},
    description: 'There is no goal but to endure. Survive as long as the band can.',
    objective: () => false,
    dynamicText: (G) => `Round ${G.round}`,
  },
  sands_of_time: {
    id: 'sands_of_time', name: 'The Sands of Time', kind: 'threat', cost: {},
    description: `The age turns. When round ${SANDBOX_DEADLINE} elapses, the wandering ends.`,
    dynamicText: (G) => `Round ${Math.min(G.round, SANDBOX_DEADLINE)}/${SANDBOX_DEADLINE}`,
    defeat: (G) => G.round > SANDBOX_DEADLINE && 'the sands of time',
  },
};
