import { useState } from 'react';
import { MetaMenu } from '../meta/MetaMenu';
import { Board } from '../components/Board';
import { GameProvider } from '../run/GameContext';
import { loadStore, saveStore } from '../meta/store';
import type { RunConfig, RunResult } from '../contract';

type View = { screen: 'menu' } | { screen: 'run'; config: RunConfig };

/** How many past runs the Stats screen shows. */
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
  // would otherwise never be recorded. Loaded from and persisted to localStorage (see
  // ../meta/store.ts) so history survives a page reload.
  const [runHistory, setRunHistory] = useState<RunResult[]>(() => loadStore().runHistory);

  function recordResult(result: RunResult) {
    setRunHistory((h) => {
      const next = [result, ...h].slice(0, HISTORY_LIMIT);
      saveStore({ runHistory: next });
      return next;
    });
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

  return <MetaMenu runHistory={runHistory} onLaunch={(config) => setView({ screen: 'run', config })} />;
}
