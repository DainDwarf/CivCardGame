import { addResources, subtractResources, type Resources } from './resources';
import { drawCard } from './deck';
import { CARDS } from '../content/cards';
import type { GameState } from './state';

/** The immediate, one-shot effect a card applies when played. */
export interface CardEffect {
  /** Resources gained immediately. */
  gain?: Partial<Resources>;
  /** Resources removed immediately (e.g. a Barbarian event draining Military). No clamp — may go negative. */
  loss?: Partial<Resources>;
  /** Cards drawn immediately. */
  draw?: number;
  /** Population gained immediately (e.g. Settlers). */
  population?: number;
  /** Territory gained immediately — raises the cap on tableau size (e.g. Conquest, Develop). */
  territory?: number;
  /** Culture gained immediately — adds to G.culture (e.g. Cultural Festival). */
  culture?: number;
  /**
   * Remove a player-chosen building from the tableau, freeing its territory slot and
   * returning its workers to the idle pool (the demolished card files to the removed pile).
   * The target is chosen by the UI and threaded through as `EffectContext.target`; the demolition
   * runs inside the resolver (`specToResolver`), while `playCard` still validates the target up
   * front (must be supplied and present in the tableau).
   */
  destroy?: true;
  /**
   * Exile *this* card to the removed pile once it resolves, instead of the default discard
   * (e.g. a disaster event you don't want recurring). Currently only set on `event` cards,
   * checked by `rules/upkeep.ts`'s `resolveHandEvents` — without it, a resolved card discards
   * like anything else. Not a trait of any `kind`; it's the effect that decides.
   */
  remove?: true;
}

export function applyEffect(G: GameState, effect?: CardEffect): void {
  if (!effect) return;
  if (effect.gain) addResources(G.resources, effect.gain);
  if (effect.loss) subtractResources(G.resources, effect.loss);
  if (effect.draw) {
    for (let i = 0; i < effect.draw; i++) drawCard(G);
  }
  if (effect.population) G.population += effect.population;
  if (effect.territory) G.territory += effect.territory;
  if (effect.culture) G.culture += effect.culture;
}

/**
 * The context a card's resolver runs against — the seam that makes effects aware of *who* is
 * resolving and *what* they target, which the bare `applyEffect(G, effect)` cannot express.
 * Deliberately plain data + `G`: nothing here is stored in `GameState`, so the serializable-state
 * discipline (structuredClone undo, the projection HUD) is untouched.
 */
export interface EffectContext {
  G: GameState;
  /** The card doing the resolving — its catalogue id, plus its board instance id when it has one. */
  self: { cardId: string; instanceId?: number };
  /** A pre-selected target instance id chosen by the UI before the move fired (e.g. the building a
   *  Destroy card demolishes), threaded here instead of as a bespoke move parameter. */
  target?: number;
  /**
   * The player's answer to a suspended interaction, `undefined` on the *first* pass (when the
   * resolver reveals options and parks a `PendingInteraction`) and the chosen option index on
   * *resume* (via `resolveInteraction`). Branch on `answer === undefined`, never `!answer` — index
   * `0` is a valid answer.
   */
  answer?: number;
}

/** A card's play-time behavior: mutate `ctx.G` given the resolving card and its target. Lives on the
 *  static catalogue (`CardDef.resolve`), never in `GameState` — see `EffectContext`. */
export type Resolver = (ctx: EffectContext) => void;

/** Demolish a tableau building by instance id, filing its card to `removed` (frees the slot and its
 *  workers). No-op if the id is absent or not in the tableau. */
function demolish(G: GameState, instanceId?: number): void {
  if (instanceId === undefined) return;
  const idx = G.tableau.findIndex((b) => b.id === instanceId);
  if (idx !== -1) G.removed.push(G.tableau.splice(idx, 1)[0].cardId);
}

/**
 * Build a resolver from a declarative `CardEffect` — the default for the ~90% of cards whose
 * behavior is fully described by the data bag (`describeCard`/`unplayableReason` read the same
 * data). Reproduces `applyEffect` exactly, plus the `destroy` mutation (folded in from `playCard`
 * so all effect behavior resolves through one path). `remove` is *not* handled here: it governs
 * where the played card itself files afterwards, a caller-owned lifecycle decision (see
 * `resolveHandEvents`), not a mutation of `G`.
 */
export function specToResolver(effect?: CardEffect): Resolver {
  return (ctx) => {
    applyEffect(ctx.G, effect);
    if (effect?.destroy) demolish(ctx.G, ctx.target);
  };
}

/**
 * Resolve a card's effect through the single resolver path: its own `resolve` if it owns one,
 * otherwise the declarative default from its `effect`. The one place "the card's effect" runs —
 * shared by `playCard` and `resolveHandEvents`.
 */
export function resolveCard(ctx: EffectContext): void {
  const card = CARDS[ctx.self.cardId];
  const resolver = card.resolve ?? specToResolver(card.effect);
  resolver(ctx);
}
