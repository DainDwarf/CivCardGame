import { useState } from 'react';
import { MissionSelect } from '../meta/MissionSelect';
import { Board } from '../components/Board';
import { GameProvider } from '../run/GameContext';
import type { RunConfig, RunResult } from '../contract';

type View = { screen: 'menu' } | { screen: 'run'; config: RunConfig };

/** How many past runs the mission-select screen shows. */
const HISTORY_LIMIT = 10;

/**
 * The shell that switches between the two loops (see docs/DESIGN.md, "The contract"):
 * the meta menu assembles a `RunConfig` and launches a run; the run hands back a
 * `RunResult` when the player ends it, and the shell returns to the menu.
 */
export function App() {
  const [view, setView] = useState<View>({ screen: 'menu' });
  // Most-recent-first, capped to HISTORY_LIMIT. A run also lands here when the player hits
  // Restart instead of End Run — that discards the run without leaving GameProvider, so it
  // would otherwise never be recorded.
  const [runHistory, setRunHistory] = useState<RunResult[]>([]);

  function recordResult(result: RunResult) {
    setRunHistory((h) => [result, ...h].slice(0, HISTORY_LIMIT));
  }

  if (view.screen === 'run') {
    return (
      <GameProvider
        config={view.config}
        onRunEnd={(result) => {
          recordResult(result);
          setView({ screen: 'menu' });
        }}
        onRestart={recordResult}
      >
        <Board />
      </GameProvider>
    );
  }

  return <MissionSelect runHistory={runHistory} onLaunch={(config) => setView({ screen: 'run', config })} />;
}
