import { useState } from 'react';
import { MetaMenu } from '../meta/MetaMenu';
import { Board } from '../components/Board';
import { GameMenu } from '../components/GameMenu';
import { GameProvider, useGame } from '../run/GameContext';
import { loadStore, saveStore, type PlayerStore } from '../meta/store';
import { loadSettings, saveSettings, type Settings } from '../meta/settings';
import type { DeckDef } from '../content/decks';
import type { RunConfig, RunResult } from '../contract';

type View = { screen: 'menu' } | { screen: 'run'; config: RunConfig };

/** How many past runs the Stats screen shows. */
const HISTORY_LIMIT = 10;

/**
 * Bridges `useGame()` into `GameMenu`'s `runControls` prop — must render inside
 * `GameProvider`, which is why this is a separate component rather than inline in
 * `App`'s render (the meta-screen `GameMenu` needs no such bridge). Restart Run / End
 * Run stay confirm-gated while the run is live; once it's over, they act immediately
 * (see `RunMenuControls`'s doc comment) — `onEndRun` becomes `endRun` (records the
 * result, same as the gameover overlay's own End Run button) instead of `onAbandon`,
 * which only applies to a live run: it mirrors `handleImportStore` below, silently
 * discarding the in-progress run with no `RunResult` to record.
 */
function RunGameMenu({
  store,
  onImportStore,
  settings,
  onUpdateSettings,
  onAbandon,
}: {
  store: PlayerStore;
  onImportStore: (store: PlayerStore) => void;
  settings: Settings;
  onUpdateSettings: (settings: Settings) => void;
  onAbandon: () => void;
}) {
  const { gameover, restart, endRun } = useGame();
  return (
    <GameMenu
      store={store}
      onImportStore={onImportStore}
      settings={settings}
      onUpdateSettings={onUpdateSettings}
      runControls={{
        onRestart: restart,
        restartDisabled: gameover?.outcome === 'victory',
        onEndRun: gameover ? endRun : onAbandon,
        isOver: !!gameover,
      }}
    />
  );
}

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
  // Local device preferences (../meta/settings.ts) — separate from PlayerStore since
  // they aren't game progress (see that file's doc comment).
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  function persist(next: PlayerStore) {
    setStore(next);
    saveStore(next);
  }

  function persistSettings(next: Settings) {
    setSettings(next);
    saveSettings(next);
  }

  // Load/Clear (GameMenu's Save submenu) replace the store wholesale, which can be
  // triggered mid-run. The run's RunConfig no longer corresponds to anything in the
  // new store, so it's closed silently — not through onRunEnd/recordResult, since it
  // was never actually finished and shouldn't be scored as a RunResult.
  function handleImportStore(next: PlayerStore) {
    persist(next);
    setView({ screen: 'menu' });
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
      {view.screen === 'run' ? (
        <GameProvider
          config={view.config}
          onRunEnd={(result) => {
            recordResult(result);
            setView({ screen: 'menu' });
          }}
          onRestart={recordResult}
        >
          <RunGameMenu
            store={store}
            onImportStore={handleImportStore}
            settings={settings}
            onUpdateSettings={persistSettings}
            onAbandon={() => setView({ screen: 'menu' })}
          />
          <Board confirmEndTurn={settings.confirmEndTurn} />
        </GameProvider>
      ) : (
        <>
          <GameMenu store={store} onImportStore={handleImportStore} settings={settings} onUpdateSettings={persistSettings} />
          <MetaMenu
            runHistory={store.runHistory}
            decks={store.decks}
            onLaunch={(config) => setView({ screen: 'run', config })}
            onSaveDeck={saveDeck}
            onDeleteDeck={deleteDeck}
          />
        </>
      )}
    </>
  );
}
