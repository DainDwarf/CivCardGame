import { useState } from 'react';
import { MissionSelect } from '../meta/MissionSelect';
import { Board } from '../components/Board';
import { GameProvider } from '../run/GameContext';
import type { RunConfig, RunResult } from '../contract';

type View = { screen: 'menu' } | { screen: 'run'; config: RunConfig };

/**
 * The shell that switches between the two loops (see docs/DESIGN.md, "The contract"):
 * the meta menu assembles a `RunConfig` and launches a run; the run hands back a
 * `RunResult` when the player ends it, and the shell returns to the menu.
 */
export function App() {
  const [view, setView] = useState<View>({ screen: 'menu' });
  const [lastResult, setLastResult] = useState<RunResult | undefined>();

  if (view.screen === 'run') {
    return (
      <GameProvider
        config={view.config}
        onRunEnd={(result) => {
          setLastResult(result);
          setView({ screen: 'menu' });
        }}
      >
        <Board />
      </GameProvider>
    );
  }

  return <MissionSelect lastResult={lastResult} onLaunch={(config) => setView({ screen: 'run', config })} />;
}
