import type { RunConfig, RunResult } from '../contract';
import type { BoardId } from '../content/boards';
import type { DeckCard } from '../rules/deckBuilder';
import type { GameState } from '../rules';
import { shuffle } from '../rules';
import {
  applyMove,
  createRun,
  endTurn,
  toRunResult,
  type Gameover,
  type RunState,
} from '../run/engine';
import {
  assignWorker,
  playCard,
  resolveInteraction,
  toggleStaffing,
  transferWorker,
  unassignWorker,
} from '../run/moves';
import { assertRunInvariants } from './invariants';

/**
 * One decision a policy hands the driver — a serializable mirror of the run moves plus `endTurn`, so
 * a run can be recorded/replayed as a flat action list later. `simulate.ts`'s `applyAction` is the
 * single place these map back onto the real engine moves (`run/moves.ts`); nothing here re-implements
 * game logic.
 */
export type SimAction =
  | { kind: 'endTurn' }
  | { kind: 'playCard'; playHandIdx: number; discardHandIdxs?: number[] }
  | { kind: 'assignWorker'; id: number }
  | { kind: 'unassignWorker'; id: number }
  | { kind: 'transferWorker'; fromId: number; toId: number }
  | { kind: 'toggleStaffing'; id: number }
  | { kind: 'resolveInteraction'; answer: number };

/**
 * A move-selection strategy: given the live run, pick the next action. A callable with an optional
 * `seed` tag so the driver can fold the policy's seed into an invariant-violation reproduction key
 * (`createRandomPolicy` sets it). Three ship today, all off the shared `sim/actions.ts` legality
 * enumeration: the random-legal-move policy / fuzzer (`sim/randomPolicy.ts`), the greedy one-ply
 * optimizer (`sim/greedyPolicy.ts`, scoring via `sim/value.ts`), and the cheap heuristic ladder
 * (`sim/heuristicPolicy.ts`).
 */
export interface Policy {
  (state: RunState): SimAction;
  seed?: string;
}

/** The result of a headless run: the meta-loop `RunResult` plus enough raw state for aggregation. */
export interface SimOutcome {
  result: RunResult;
  gameover: Gameover;
  finalState: GameState;
  /** Total actions dispatched (moves + `endTurn`s), incl. ones the engine rejected as invalid. */
  actionsApplied: number;
  /** Per-cardId count of `playCard` actions the engine *accepted* this run — the "is a card ever
   *  played / dead in the deck?" signal, impossible to recover from `finalState` (a card's play
   *  count isn't retained once it files to a pile). Counted in the drive loop below. */
  cardPlays: Record<string, number>;
}

/** Options for {@link simulateRun}. */
export interface SimOptions {
  /** Assert structural invariants after every action (the fuzzer teeth). Default `true`. */
  check?: boolean;
  /** Hard backstop against a non-terminating run — a run that never reaches gameover is itself a bug,
   *  so exceeding this **throws**. Default 10_000; a mission's deadline (or resource collapse) is meant
   *  to end a run well below it. The endless sandbox has no deadline, so the sim doesn't drive it. */
  maxActions?: number;
  /** Optional observer fired after every dispatched action with the action, the states either side of
   *  it (`prev` before, `next` after), and whether the engine accepted it (`accepted: false` = a
   *  rejected/no-op move, where `next === prev`). A trace/replay hook — the `sim` CLI's `--seed` mode
   *  passes a per-turn logger (it reads `prev` to name a played card and to snapshot each turn's
   *  starting economy, including turn 1 from the first call's `prev`); the batch sweep passes nothing.
   *  Never mutate through it; it's read-only instrumentation, so a batch run stays byte-identical
   *  whether or not it's set. */
  onStep?: (step: { action: SimAction; prev: RunState; next: RunState; accepted: boolean }) => void;
}

/** Dispatch one {@link SimAction} onto the real engine — the only bridge from a policy's decision to
 *  a state transition. Invalid moves return the state unchanged (per `applyMove`), so a policy that
 *  mis-enumerates simply wastes an action rather than corrupting state. */
export function applyAction(state: RunState, action: SimAction): RunState {
  switch (action.kind) {
    case 'endTurn':
      return endTurn(state);
    case 'playCard':
      return applyMove(state, playCard, action.playHandIdx, action.discardHandIdxs ?? []);
    case 'assignWorker':
      return applyMove(state, assignWorker, action.id);
    case 'unassignWorker':
      return applyMove(state, unassignWorker, action.id);
    case 'transferWorker':
      return applyMove(state, transferWorker, action.fromId, action.toId);
    case 'toggleStaffing':
      return applyMove(state, toggleStaffing, action.id);
    case 'resolveInteraction':
      return applyMove(state, resolveInteraction, action.answer);
  }
}

/**
 * Play one headless run of `config` to completion under `policy`, returning its {@link SimOutcome}.
 * The whole balance tool: a thin loop over the real engine (`createRun` → drive actions → `toRunResult`)
 * that re-implements no game logic. Terminates because every finished run sets `gameover`; the
 * `maxActions` backstop throws if one never does.
 */
export function simulateRun(config: RunConfig, policy: Policy, opts: SimOptions = {}): SimOutcome {
  const check = opts.check ?? true;
  const maxActions = opts.maxActions ?? 10_000;
  const ctx = { configSeed: config.seed, policySeed: policy.seed };

  let state = createRun(config);
  if (check) assertRunInvariants(state.G, { ...ctx, round: state.G.round, actionsApplied: 0 });

  let actionsApplied = 0;
  const cardPlays: Record<string, number> = {};
  while (!state.gameover) {
    if (actionsApplied >= maxActions) {
      throw new Error(
        `simulateRun exceeded ${maxActions} actions without reaching gameover ` +
          `[configSeed=${config.seed} policySeed=${policy.seed ?? '?'} round=${state.G.round}]`,
      );
    }
    const action = policy(state);
    // Capture the played cardId *before* dispatch (the hand index resolves against the pre-move hand).
    const playedCardId = action.kind === 'playCard' ? state.G.hand[action.playHandIdx]?.cardId : undefined;
    const prev = state;
    const next = applyAction(prev, action);
    // A rejected/no-op move returns the *identical* state object (`applyMove`/`endTurn` in
    // `run/engine.ts`), so `next !== prev` means the engine accepted it — count the play only then.
    const accepted = next !== prev;
    if (playedCardId !== undefined && accepted) cardPlays[playedCardId] = (cardPlays[playedCardId] ?? 0) + 1;
    opts.onStep?.({ action, prev, next, accepted });
    state = next;
    actionsApplied += 1;
    if (check) assertRunInvariants(state.G, { ...ctx, round: state.G.round, actionsApplied });
  }

  return {
    result: toRunResult(state.G, state.gameover),
    gameover: state.gameover,
    finalState: state.G,
    actionsApplied,
    cardPlays,
  };
}

/**
 * Assemble a `RunConfig` straight from plain card ids — the content-agnostic counterpart to
 * `contract.ts`'s `buildRunConfig`, which needs a player `OwnedCards` to resolve deck instance ids.
 * A simulator sweep works from a raw cardId deck (no meta collection), so this shuffles those into a
 * `DeckCard[]` the same deterministic way `buildRunConfig` does. Board stickers default to none.
 *
 * A deck entry is a bare cardId **or** a `DeckCard` (`{ cardId, stickers? }`), normalized the same way,
 * so a caller carrying per-copy card stickers (the `sim` CLI's deck files) threads them straight through
 * — `run/setup.ts`'s `instancesFromDeckCards` already applies a `DeckCard`'s stickers, this was the only
 * seam that dropped them.
 */
export function simConfig(opts: {
  deckCardIds: readonly (string | DeckCard)[];
  board: BoardId;
  missionId: string;
  seed: string;
  boardStickers?: string[];
}): RunConfig {
  const cards: DeckCard[] = opts.deckCardIds.map((c) => (typeof c === 'string' ? { cardId: c } : c));
  return {
    deck: shuffle(cards, opts.seed),
    board: opts.board,
    boardStickers: opts.boardStickers ?? [],
    missionId: opts.missionId,
    deckId: 'sim',
    seed: opts.seed,
  };
}
