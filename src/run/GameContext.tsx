import { createContext, useContext, useMemo, useReducer } from 'react';
import { applyMove, createRun, endTurn, type Gameover, type RunState } from './engine';
import { playCard, assignWorker, unassignWorker, toggleStaffing } from './moves';
import type { GameState } from '../rules';

interface GameContextValue {
  G: GameState;
  gameover: Gameover | undefined;
  moves: {
    playCard: (handIdx: number, discardHandIdxs?: number[], destroyInstanceId?: number) => void;
    assignWorker: (id: number) => void;
    unassignWorker: (id: number) => void;
    toggleStaffing: (id: number) => void;
  };
  endTurn: () => void;
  /** Step back one undoable action. No-op when `canUndo` is false. */
  undo: () => void;
  /** Whether there is an undoable action to step back to (within the current turn, since the last draw). */
  canUndo: boolean;
  restart: () => void;
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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MoveFn = (G: GameState, ...args: any[]) => 'invalid' | void;

type Action =
  | { type: 'move'; fn: MoveFn; args: unknown[] }
  | { type: 'endTurn' }
  | { type: 'undo' }
  | { type: 'restart' };

/** Two decks are equal when they hold the same card ids in the same order. */
function sameDeck(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

function reducer(s: Session, action: Action): Session {
  switch (action.type) {
    case 'move': {
      const next = applyMove(s.present, action.fn, ...action.args);
      // `applyMove` returns the same reference when the move is invalid or the game is over.
      if (next === s.present) return s;
      // A move that touched the draw pile (drew cards / reshuffled) revealed new information —
      // it's a hard boundary you can't undo past, so the whole stack is cleared.
      // GAP: this only catches reveals that *change* the deck. A future "peek top-N" that
      // reveals cards without removing them won't be detected here — that move must set its
      // own explicit "revealed" flag for the reducer to treat as a boundary.
      const revealed = !sameDeck(s.present.G.deck, next.G.deck);
      return { present: next, past: revealed ? [] : [...s.past, s.present] };
    }
    case 'endTurn': {
      const next = endTurn(s.present);
      if (next === s.present) return s;
      // Ending a round draws a fresh hand and crosses into the next turn — a clean break.
      return { present: next, past: [] };
    }
    case 'undo': {
      if (s.past.length === 0) return s;
      return { present: s.past[s.past.length - 1], past: s.past.slice(0, -1) };
    }
    case 'restart':
      return { present: createRun(s.present.G.missionId), past: [] };
  }
}

export function GameProvider({ missionId, children }: { missionId: string; children: React.ReactNode }) {
  const [session, dispatch] = useReducer(reducer, missionId, (id) => ({ present: createRun(id), past: [] }));
  const { present, past } = session;

  const moves = useMemo(() => ({
    playCard: (handIdx: number, discardHandIdxs: number[] = [], destroyInstanceId?: number) =>
      dispatch({ type: 'move', fn: playCard, args: [handIdx, discardHandIdxs, destroyInstanceId] }),
    assignWorker: (id: number) => dispatch({ type: 'move', fn: assignWorker, args: [id] }),
    unassignWorker: (id: number) => dispatch({ type: 'move', fn: unassignWorker, args: [id] }),
    toggleStaffing: (id: number) => dispatch({ type: 'move', fn: toggleStaffing, args: [id] }),
  }), []);

  const handlers = useMemo(() => ({
    endTurn: () => dispatch({ type: 'endTurn' }),
    undo: () => dispatch({ type: 'undo' }),
    restart: () => dispatch({ type: 'restart' }),
  }), []);

  // Undo is offered only within a live turn — not over a finished run.
  const canUndo = past.length > 0 && !present.gameover;

  return (
    <GameContext.Provider value={{ G: present.G, gameover: present.gameover, moves, canUndo, ...handlers }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
