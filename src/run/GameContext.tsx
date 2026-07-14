import { createContext, useContext, useMemo, useReducer } from 'react';
import { applyMove, createRun, endTurn, toRunResult, type Gameover, type RunState } from './engine';
import { playCard, assignWorker, unassignWorker, toggleStaffing, transferWorker, resolveInteraction } from './moves';
import type { GameState } from '../rules';
import type { BoardId } from '../content/boards';
import { reshuffleRunConfig, type RunConfig, type RunResult } from '../contract';

interface GameContextValue {
  G: GameState;
  gameover: Gameover | undefined;
  /** The board this run was launched with — drives board-tinted run-loop presentation (e.g. the ground backdrop). */
  board: BoardId;
  moves: {
    playCard: (handIdx: number, discardHandIdxs?: number[]) => void;
    assignWorker: (id: number) => void;
    unassignWorker: (id: number) => void;
    toggleStaffing: (id: number) => void;
    transferWorker: (fromId: number, toId: number) => void;
    /** Answer the pending interaction (`G.pendingInteraction`) with the chosen option index. */
    resolveInteraction: (answer: number) => void;
  };
  endTurn: () => void;
  /** Step back one undoable action. No-op when `canUndo` is false. */
  undo: () => void;
  /** Whether there is an undoable action to step back to (within the current turn, since the last draw). */
  canUndo: boolean;
  restart: () => void;
  /** Ends the run and hands the result back to `onRunEnd`. No-op while the run is still live. */
  endRun: () => void;
  /** Bumps once per fresh run (initial mount = 0, +1 on every restart). A run-start UI cue —
   *  e.g. `Board.tsx`'s injection animation keys on it to replay on restart, which reuses the
   *  same mounted Board rather than remounting. No rule reads it. */
  runGen: number;
}

/** Turns a finished `RunState` into the `RunResult` handed to `onRunEnd`/`onRestart`, or
 *  `undefined` if the run isn't over yet (nothing to report). */
function finishedResult(state: RunState): RunResult | undefined {
  return state.gameover ? toRunResult(state.G, state.gameover) : undefined;
}

const GameContext = createContext<GameContextValue | null>(null);

/**
 * Undo session: the live state plus a stack of prior snapshots to step back through.
 * `RunState`s are immutable (the engine clones on every transition), so `past` holds bare
 * references — no extra cloning.
 */
interface Session {
  present: RunState;
  past: RunState[];
  /** Increments on restart so run-start UI cues (the injection animation) can replay without a
   *  Board remount. See `GameContextValue.runGen`. */
  gen: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MoveFn = (G: GameState, ...args: any[]) => 'invalid' | void;

type Action =
  | { type: 'move'; fn: MoveFn; args: unknown[] }
  | { type: 'endTurn' }
  | { type: 'undo' }
  | { type: 'restart'; config: RunConfig };

/** Two decks are equal when they hold the same card instances in the same order (compared by stable
 *  instance id — strictly more precise than comparing card ids). Detects a draw-pile reorder or
 *  membership change (a draw, a reshuffle); a pure-read peek leaves the deck equal and is caught
 *  separately via `revealCount`. */
function sameDeck(a: { id: number }[], b: { id: number }[]): boolean {
  return a.length === b.length && a.every((c, i) => c.id === b[i].id);
}

function reducer(s: Session, action: Action): Session {
  switch (action.type) {
    case 'move': {
      const next = applyMove(s.present, action.fn, ...action.args);
      // `applyMove` returns the same reference when the move is invalid or the game is over.
      if (next === s.present) return s;
      // A move that revealed new draw-pile information is a hard boundary you can't undo past (else
      // you could peek, undo the cost, and keep the knowledge), so the whole stack is cleared. Two
      // reveal channels: a deck change (drew cards / reshuffled) and a pure-read peek that leaves the
      // deck untouched but bumps `revealCount`.
      const revealed =
        !sameDeck(s.present.G.deck, next.G.deck) || next.G.revealCount !== s.present.G.revealCount;
      return { present: next, past: revealed ? [] : [...s.past, s.present], gen: s.gen };
    }
    case 'endTurn': {
      const next = endTurn(s.present);
      if (next === s.present) return s;
      // Ending a round draws a fresh hand and crosses into the next turn — a clean break.
      return { present: next, past: [], gen: s.gen };
    }
    case 'undo': {
      if (s.past.length === 0) return s;
      return { present: s.past[s.past.length - 1], past: s.past.slice(0, -1), gen: s.gen };
    }
    case 'restart':
      return { present: createRun(action.config), past: [], gen: s.gen + 1 };
  }
}

export function GameProvider({
  config,
  onRunEnd,
  onRestart,
  children,
}: {
  config: RunConfig;
  /** Called when the player clicks "End Run" on a finished run — hands the result back to the meta loop. */
  onRunEnd: (result: RunResult) => void;
  /** Called just before a "Restart" discards a finished run — the run doesn't leave this
   *  `GameProvider`, but the meta loop still needs the discarded run's result for history. */
  onRestart?: (result: RunResult) => void;
  children: React.ReactNode;
}) {
  const [session, dispatch] = useReducer(reducer, config, (c) => ({ present: createRun(c), past: [], gen: 0 }));
  const { present, past, gen } = session;

  const moves = useMemo(() => ({
    playCard: (handIdx: number, discardHandIdxs: number[] = []) =>
      dispatch({ type: 'move', fn: playCard, args: [handIdx, discardHandIdxs] }),
    assignWorker: (id: number) => dispatch({ type: 'move', fn: assignWorker, args: [id] }),
    unassignWorker: (id: number) => dispatch({ type: 'move', fn: unassignWorker, args: [id] }),
    toggleStaffing: (id: number) => dispatch({ type: 'move', fn: toggleStaffing, args: [id] }),
    transferWorker: (fromId: number, toId: number) =>
      dispatch({ type: 'move', fn: transferWorker, args: [fromId, toId] }),
    resolveInteraction: (answer: number) =>
      dispatch({ type: 'move', fn: resolveInteraction, args: [answer] }),
  }), []);

  const handlers = useMemo(() => ({
    endTurn: () => dispatch({ type: 'endTurn' }),
    undo: () => dispatch({ type: 'undo' }),
    // A restart is a new run with the same board/mission/deck but a fresh seed — reusing the
    // exact same seed would just replay the identical draw order every time. Reshuffles
    // config.deck directly (rather than re-resolving deckId against the player's deck
    // store, which GameProvider never receives) — see contract.ts's reshuffleRunConfig.
    restart: () => {
      const result = finishedResult(present);
      if (result) onRestart?.(result);
      dispatch({
        type: 'restart',
        config: reshuffleRunConfig(config, crypto.randomUUID()),
      });
    },
  }), [config, present, onRestart]);

  // Undo is offered only within a live turn — not over a finished run, and not mid-interaction
  // (a pending choice must be answered, not undone — the reveal already cleared the stack anyway).
  const canUndo = past.length > 0 && !present.gameover && !present.G.pendingInteraction;

  function endRun() {
    const result = finishedResult(present);
    if (result) onRunEnd(result);
  }

  return (
    <GameContext.Provider value={{ G: present.G, gameover: present.gameover, board: config.board, moves, canUndo, endRun, runGen: gen, ...handlers }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
