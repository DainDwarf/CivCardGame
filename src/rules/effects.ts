import { addResources, subtractResources, type Resources } from './resources';
import { drawCard } from './deck';
import { CARDS } from '../content/cards';
import type { CardDef } from '../content/cards';
import type { CardInstance, GameState } from './state';

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
  /** The exact card instance doing the resolving (`{ id, cardId, counters? }`). A resolver reads
   *  `self.cardId` for its identity and reads/writes `self.counters` (via `getCounter`/`bumpCounter`)
   *  for per-copy state that rides with this physical card — e.g. Cornucopia's growing gain. On a
   *  resume pass (`resolveInteraction`) this is reconstructed from the parked `PendingInteraction`. */
  self: CardInstance;
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
  if (idx === -1) return;
  const [building] = G.tableau.splice(idx, 1);
  // File the demolished card to removed as a plain card instance (its staffing-only `workers` is
  // dropped); keep its id so the removed pile stays identity-consistent with every other zone.
  G.removed.push({ id: building.id, cardId: building.cardId });
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

/**
 * Build a production resolver from a card's declarative production fields — the default for
 * every `building`/`work` card whose per-round output is fully described by `produces`/
 * `cultureOutput`/`effect.gain`. Deliberately narrower than `specToResolver`: it applies only
 * `gain`/`culture`, never a one-shot play field (`draw`/`population`/`territory`/`destroy`) a
 * card might also declare — those must never fire on a recurring tick.
 */
function defaultProduce(card: CardDef): Resolver {
  return (ctx) => applyEffect(ctx.G, { gain: card.produces ?? card.effect?.gain, culture: card.cultureOutput });
}

/**
 * Resolve one operating (staffed) building/Work instance's per-round production through its own
 * resolver: `card.produce` if it defines one, otherwise the declarative default above. Production's
 * counterpart to `resolveCard` — the caller (the upkeep production tick) must never read
 * `produces`/`cultureOutput`/`effect.gain` itself and reinterpret them; it only asks the card to
 * produce. Mirrors `tickThreats`'s reuse of `resolveCard` for the same reason.
 */
export function resolveProduction(ctx: EffectContext): void {
  const card = CARDS[ctx.self.cardId];
  const resolver = card.produce ?? defaultProduce(card);
  resolver(ctx);
}
