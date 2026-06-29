import { createContext, useContext, useMemo, useState } from 'react';
import { applyMove, createRun, endTurn, type Gameover, type RunState } from './engine';
import { playCard, assignWorker, unassignWorker } from './moves';
import type { GameState } from '../rules';

interface GameContextValue {
  G: GameState;
  gameover: Gameover | undefined;
  moves: {
    playCard: (handIdx: number, discardHandIdxs?: number[]) => void;
    assignWorker: (buildingId: string) => void;
    unassignWorker: (buildingId: string) => void;
  };
  endTurn: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ missionId, children }: { missionId: string; children: React.ReactNode }) {
  const [state, setState] = useState<RunState>(() => createRun(missionId));

  const moves = useMemo(() => ({
    playCard: (handIdx: number, discardHandIdxs: number[] = []) =>
      setState((s) => applyMove(s, playCard, handIdx, discardHandIdxs)),
    assignWorker: (buildingId: string) =>
      setState((s) => applyMove(s, assignWorker, buildingId)),
    unassignWorker: (buildingId: string) =>
      setState((s) => applyMove(s, unassignWorker, buildingId)),
  }), []);

  const handleEndTurn = useMemo(() => () => setState(endTurn), []);

  return (
    <GameContext.Provider value={{ G: state.G, gameover: state.gameover, moves, endTurn: handleEndTurn }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
