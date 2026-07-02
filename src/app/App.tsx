import { useState } from 'react';
import { MetaMenu } from '../meta/MetaMenu';
import { Board } from '../components/Board';
import { GameMenu } from '../components/GameMenu';
import { GameProvider } from '../run/GameContext';
import { loadStore, saveStore, type PlayerStore } from '../meta/store';
import type { DeckDef } from '../content/decks';
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
  // Loaded from and persisted to localStorage (see ../meta/store.ts) so history/decks
  // survive a page reload. Held as one PlayerStore-shaped object (not split into
  // per-field state) so `persist` always writes the full store — writing just one
  // field back to localStorage would silently drop the others.
  const [store, setStore] = useState<PlayerStore>(() => loadStore());

  function persist(next: PlayerStore) {
    setStore(next);
    saveStore(next);
  }

  // A run also lands here when the player hits Restart instead of End Run — that
  // discards the run without leaving GameProvider, so it would otherwise never be recorded.
  function recordResult(result: RunResult) {
    persist({ ...store, runHistory: [result, ...store.runHistory].slice(0, HISTORY_LIMIT) });
  }

  function saveDeck(deck: DeckDef) {
    const exists = store.decks.some((d) => d.id === deck.id);
    // map-if-exists-else-append keeps an edited deck's position stable instead of bumping it to the end.
    const decks = exists ? store.decks.map((d) => (d.id === deck.id ? deck : d)) : [...store.decks, deck];
    persist({ ...store, decks });
  }

  function deleteDeck(id: string) {
    persist({ ...store, decks: store.decks.filter((d) => d.id !== id) });
  }

  return (
    <>
      <GameMenu />
      {view.screen === 'run' ? (
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
      ) : (
        <MetaMenu
          runHistory={store.runHistory}
          decks={store.decks}
          onLaunch={(config) => setView({ screen: 'run', config })}
          onSaveDeck={saveDeck}
          onDeleteDeck={deleteDeck}
        />
      )}
    </>
  );
}
