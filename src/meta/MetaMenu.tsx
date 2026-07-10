import { useState } from 'react';
import { CampaignMap } from './CampaignMap';
import { Collection } from './Collection';
import { BoardMenu } from './BoardMenu';
import { Decks } from './Decks';
import { DeckEditor } from './DeckEditor';
import { Stats } from './Stats';
import type { DeckDef } from '../content/decks';
import type { RunConfig, RunResult } from '../contract';
import type { OwnedCards } from '../rules/collection';
import type { LifetimeStats } from './store';
import type { BoardStickers } from '../rules/boardStickers';
import type { BoardId } from '../content/boards';
import { anyCardUpgradeAvailable, anyBoardUpgradeAvailable } from '../rules/upgrades';
import styles from './MetaMenu.module.css';

type Screen = 'mission' | 'collection' | 'board' | 'decks' | 'stats' | 'deckEditor';

const NAV: { screen: Screen; icon: string; label: string }[] = [
  { screen: 'mission', icon: '🗺️', label: 'Mission' },
  { screen: 'collection', icon: '📚', label: 'Collection' },
  { screen: 'board', icon: '🎴', label: 'Board' },
  { screen: 'decks', icon: '🃏', label: 'Decks' },
  { screen: 'stats', icon: '📊', label: 'Stats' },
];

/**
 * The meta menu's shell: a left column of big nav buttons switches between the meta screens.
 * Mission is the campaign map — the DAG of missions, each node opening a board/deck launch popup
 * (`CampaignMap.tsx`); Collection lists owned cards and is also the card shop — buy copy-tier upgrades
 * and attach stickers in its per-card detail panel (`Collection.tsx`); Board spends Influence on board
 * stickers (`BoardMenu.tsx`); Decks is fully editable;
 * Stats is the run history, split out so the map stays focused
 * on launching. `deckEditor` isn't in `NAV` — it's only reachable via an action on the Decks screen
 * (New/Edit), never a bare tab with no deck loaded. `App.tsx` mounts this in place of the run view
 * whenever `screen === 'menu'`.
 */
export function MetaMenu({
  runHistory,
  decks,
  collection,
  influence,
  mapProgress,
  boardStickers,
  unlockedStickers,
  unlockedBoardStickers,
  lifetime,
  bestInfinite,
  uiScale,
  onLaunch,
  onSaveDeck,
  onDeleteDeck,
  onBuyTier,
  onAttachSticker,
  onBuyBoardSticker,
}: {
  runHistory: RunResult[];
  decks: DeckDef[];
  /** The player's card ownership — forwarded to `Collection`/`DeckEditor` (omit not-yet-unlocked
   *  cards); `Collection` also lists upgradeable cards for the fused-in shop. */
  collection: OwnedCards;
  /** The meta-currency (docs/DESIGN.md, "Economy & progression") — shown at the top of the nav
   *  column, and forwarded to `Collection`/`BoardMenu` where it gates and is spent. */
  influence: number;
  /** Completed mission ids — forwarded to `CampaignMap` so it can gate the DAG's node
   *  states (`rules/campaign.ts`). */
  mapProgress: Record<string, true>;
  /** Board stickers attached per board — forwarded to `BoardMenu` (buy/list) and `CampaignMap` (the
   *  launch popup's board picker shows the *effective* profile). */
  boardStickers: BoardStickers;
  /** Unlocked card/board stickers (`rules/rewards.ts`) — forwarded to `Collection`/`BoardMenu` so a
   *  locked sticker is hidden from its tray, and rolled into the nav-badge upgrade hints. */
  unlockedStickers: Record<string, true>;
  unlockedBoardStickers: Record<string, true>;
  /** Lifetime cumulative counters — forwarded to `Stats` for its campaign-progress summary. */
  lifetime: LifetimeStats;
  /** Best rounds survived per infinite mission — forwarded to `Stats` for the best-scores board. */
  bestInfinite: Record<string, number>;
  /** Whole-UI scale (settings) — forwarded to `DeckEditor`, `BoardMenu`, and `Collection`'s detail
   *  panel (drag-clone coordinate math) and `CampaignMap` (pointer-drag pan). */
  uiScale: number;
  onLaunch: (config: RunConfig) => void;
  onSaveDeck: (deck: DeckDef) => void;
  onDeleteDeck: (id: string) => void;
  /** Buy the next copy tier for a card — spends Influence and bumps the
   *  card's ownership in the store (`App.tsx`'s `buyCardTier`). */
  onBuyTier: (cardId: string) => void;
  /** Attach a sticker to one chosen owned instance — spends Influence and
   *  mutates that instance in the store (`App.tsx`'s `attachSticker`). */
  onAttachSticker: (instanceId: string, stickerId: string) => void;
  /** Attach a board sticker to a board — spends Influence and mutates the store's
   *  `boardStickers` (`App.tsx`'s `buyBoardStickerAt`). */
  onBuyBoardSticker: (boardId: BoardId, stickerId: string) => void;
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

  // At-a-glance nav badges: mark the tabs whose buy surface has an affordable upgrade available, so
  // a fresh Influence balance advertises where it can go without visiting every screen. Only the two
  // shop-bearing tabs (Collection · Board) can have one. Rolls up the same per-tile predicates the
  // grids use (`rules/upgrades.ts`), so a badge can never disagree with a tile's own hint.
  const navHints: Partial<Record<Screen, boolean>> = {
    collection: anyCardUpgradeAvailable(collection, influence, unlockedStickers),
    board: anyBoardUpgradeAvailable(boardStickers, influence, unlockedBoardStickers),
  };

  return (
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <h1 className={styles.gameTitle}>CivCardGame</h1>
        <div className={styles.influenceBadge}>
          <span aria-hidden="true">⭐</span>
          {influence}
        </div>
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
            {navHints[n.screen] && <span className={styles.navBadge} aria-hidden="true" />}
          </button>
        ))}
      </nav>
      <div className={styles.content}>
        {screen === 'mission' && (
          <CampaignMap
            decks={decks}
            collection={collection}
            mapProgress={mapProgress}
            boardStickers={boardStickers}
            uiScale={uiScale}
            onLaunch={onLaunch}
          />
        )}
        {screen === 'collection' && (
          <Collection
            collection={collection}
            decks={decks}
            influence={influence}
            unlockedStickers={unlockedStickers}
            uiScale={uiScale}
            onBuyTier={onBuyTier}
            onAttachSticker={onAttachSticker}
          />
        )}
        {screen === 'board' && (
          <BoardMenu
            boardStickers={boardStickers}
            influence={influence}
            unlockedBoardStickers={unlockedBoardStickers}
            uiScale={uiScale}
            onBuyBoardSticker={onBuyBoardSticker}
          />
        )}
        {screen === 'decks' && (
          <Decks
            decks={decks}
            collection={collection}
            onNew={() => openEditor({ id: crypto.randomUUID(), name: 'New Deck', cards: [] })}
            onEdit={openEditor}
            onCopy={(deck) => openEditor({ id: crypto.randomUUID(), name: `${deck.name} (Copy)`, cards: [...deck.cards] })}
            onDelete={onDeleteDeck}
          />
        )}
        {screen === 'stats' && (
          <Stats
            runHistory={runHistory}
            collection={collection}
            mapProgress={mapProgress}
            lifetime={lifetime}
            bestInfinite={bestInfinite}
          />
        )}
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
