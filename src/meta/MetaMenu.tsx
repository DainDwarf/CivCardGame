import { useState } from 'react';
import { MissionSelect } from './MissionSelect';
import { Collection } from './Collection';
import { Decks } from './Decks';
import { DeckEditor } from './DeckEditor';
import { Stats } from './Stats';
import type { DeckDef } from '../content/decks';
import type { RunConfig, RunResult } from '../contract';
import type { OwnedCards } from '../rules/collection';
import styles from './MetaMenu.module.css';

type Screen = 'mission' | 'collection' | 'decks' | 'stats' | 'deckEditor';

const NAV: { screen: Screen; icon: string; label: string }[] = [
  { screen: 'mission', icon: '🗺️', label: 'Mission' },
  { screen: 'collection', icon: '📚', label: 'Collection' },
  { screen: 'decks', icon: '🃏', label: 'Decks' },
  { screen: 'stats', icon: '📊', label: 'Stats' },
];

/**
 * The meta menu's shell (Phase 2 build plan step 6, "extend the meta menu"): a left
 * column of big nav buttons switches between the meta screens. Mission is the
 * mission/board/deck picker that launches a run (`MissionSelect.tsx`); Collection is a
 * read-only shell; Decks is fully editable (step 7); Stats is the run history, split
 * out of Mission Select so that screen stays focused on launching. `deckEditor` isn't
 * in `NAV` — it's only reachable via an action on the Decks screen (New/Edit), never a
 * bare tab with no deck loaded. `App.tsx` mounts this in place of the run view
 * whenever `screen === 'menu'`.
 */
export function MetaMenu({
  runHistory,
  decks,
  collection,
  mapProgress,
  uiScale,
  onLaunch,
  onSaveDeck,
  onDeleteDeck,
}: {
  runHistory: RunResult[];
  decks: DeckDef[];
  /** The player's card ownership — forwarded to `Collection` and `DeckEditor` so both
   *  omit not-yet-unlocked cards entirely (Phase 3 Step 2). */
  collection: OwnedCards;
  /** Completed mission ids — forwarded to `MissionSelect` so it can gate the campaign
   *  map's DAG (Phase 3 Step 3, `rules/campaign.ts`). */
  mapProgress: Record<string, true>;
  /** Whole-UI scale (settings) — forwarded to `DeckEditor` for its drag-clone coordinate math. */
  uiScale: number;
  onLaunch: (config: RunConfig) => void;
  onSaveDeck: (deck: DeckDef) => void;
  onDeleteDeck: (id: string) => void;
}) {
  const [screen, setScreen] = useState<Screen>('mission');
  const [editingDeck, setEditingDeck] = useState<DeckDef | null>(null);

  function openEditor(deck: DeckDef) {
    setEditingDeck(deck);
    setScreen('deckEditor');
  }

  function closeEditor() {
    setEditingDeck(null);
    setScreen('decks');
  }

  return (
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <h1 className={styles.gameTitle}>CivCardGame</h1>
        {NAV.map((n) => (
          <button
            key={n.screen}
            type="button"
            className={`${styles.navBtn}${screen === n.screen ? ` ${styles.navBtnActive}` : ''}`}
            onClick={() => setScreen(n.screen)}
            aria-pressed={screen === n.screen}
          >
            <span className={styles.navIcon} aria-hidden="true">
              {n.icon}
            </span>
            <span className={styles.navLabel}>{n.label}</span>
          </button>
        ))}
      </nav>
      <div className={styles.content}>
        {screen === 'mission' && <MissionSelect decks={decks} mapProgress={mapProgress} onLaunch={onLaunch} />}
        {screen === 'collection' && <Collection collection={collection} />}
        {screen === 'decks' && (
          <Decks
            decks={decks}
            onNew={() => openEditor({ id: crypto.randomUUID(), name: 'New Deck', cards: [] })}
            onEdit={openEditor}
            onCopy={(deck) => openEditor({ id: crypto.randomUUID(), name: `${deck.name} (Copy)`, cards: [...deck.cards] })}
            onDelete={onDeleteDeck}
          />
        )}
        {screen === 'stats' && <Stats runHistory={runHistory} />}
        {screen === 'deckEditor' && editingDeck && (
          <DeckEditor
            initialDeck={editingDeck}
            uiScale={uiScale}
            collection={collection}
            onSave={(deck) => {
              onSaveDeck(deck);
              closeEditor();
            }}
            onCancel={closeEditor}
          />
        )}
      </div>
    </div>
  );
}
