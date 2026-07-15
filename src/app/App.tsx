import { useEffect, useState, type CSSProperties } from 'react';
import { MetaMenu } from '../meta/MetaMenu';
import { Board } from '../components/Board';
import { GameMenu } from '../components/GameMenu';
import { AccessibilityWelcome } from '../components/AccessibilityWelcome';
import { GameProvider, useGame } from '../run/GameContext';
import { applyRunResult, loadStore, saveStore, type PlayerStore } from '../meta/store';
import { MAX_DECKS, MIN_DECK_SIZE } from '../rules/deckBuilder';
import { buyTier } from '../rules/shop';
import { buySticker, removeSticker } from '../rules/stickers';
import { buyBoardSticker, removeBoardSticker } from '../rules/boardStickers';
import type { BoardId } from '../content/boards';
import { MISSIONS } from '../content/missions';
import { applyTheme, loadSettings, saveSettings, type Settings } from '../meta/settings';
import type { DeckDef } from '../content/decks';
import type { RunConfig, RunResult } from '../contract';
import styles from './App.module.css';

type View = { screen: 'menu' } | { screen: 'run'; config: RunConfig };

/** Fade duration (ms) for each half of a screen transition — see `App`'s `transition()`.
 *  The full effect (cover, then reveal) takes 2×`FADE_MS`. Read by both the JS timing
 *  and (via inline `transitionDuration`) the CSS animation, so this is the one place
 *  to retune it. */
const FADE_MS = 300;

/**
 * Bridges `useGame()` into `GameMenu`'s `runControls` prop — must render inside
 * `GameProvider`, which is why this is a separate component rather than inline in
 * `App`'s render (the meta-screen `GameMenu` needs no such bridge). Restart Run / End
 * Run stay confirm-gated while the run is live; once it's over, they act immediately
 * (see `RunMenuControls`'s doc comment) — `onEndRun` becomes `endRun` (records the
 * result, same as the gameover overlay's own End Run button) instead of `onAbandon`,
 * which only applies to a live run: it mirrors `handleImportStore` below, silently
 * discarding the in-progress run with no `RunResult` to record. Both are wrapped in
 * `onTransition` so Restart/End Run fade the same way the gameover overlay's own
 * buttons do (see `Board.tsx`).
 */
function RunGameMenu({
  store,
  onImportStore,
  settings,
  onUpdateSettings,
  onAbandon,
  onTransition,
}: {
  store: PlayerStore;
  onImportStore: (store: PlayerStore) => void;
  settings: Settings;
  onUpdateSettings: (settings: Settings) => void;
  onAbandon: () => void;
  onTransition: (action: () => void) => void;
}) {
  const { gameover, restart, endRun } = useGame();
  return (
    <GameMenu
      store={store}
      onImportStore={onImportStore}
      settings={settings}
      onUpdateSettings={onUpdateSettings}
      runControls={{
        onRestart: () => onTransition(restart),
        restartDisabled: gameover?.outcome === 'victory',
        onEndRun: () => onTransition(gameover ? endRun : onAbandon),
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
  // Drives the fade-to-black screen transition (App.module.css's `.transitionOverlay`,
  // always mounted below). 'covering' = fading to black, 'revealing' = fading back in.
  const [transitionPhase, setTransitionPhase] = useState<'idle' | 'covering' | 'revealing'>('idle');

  /** Runs `action` behind a fade-to-black-and-back: covers the screen, swaps state
   *  while hidden, then reveals it — used for the three jarring instant cuts (new run,
   *  end run, restart run). The overlay blocks all input for the whole covering+revealing
   *  duration, so the screen is unusable for the length of the animation. Ignores
   *  re-entrant calls while a transition is already in flight (the overlay already blocks
   *  the clicks that would trigger them, so this is just a safety net). */
  function transition(action: () => void) {
    if (transitionPhase !== 'idle') return;
    setTransitionPhase('covering');
    window.setTimeout(() => {
      action();
      setTransitionPhase('revealing');
      window.setTimeout(() => setTransitionPhase('idle'), FADE_MS);
    }, FADE_MS);
  }

  function persist(next: PlayerStore) {
    setStore(next);
    saveStore(next);
  }

  function persistSettings(next: Settings) {
    setSettings(next);
    saveSettings(next);
  }

  // Reflect the chosen color theme onto documentElement, where index.css's `[data-theme]`
  // palette blocks apply. main.tsx sets this pre-mount from the same source; this keeps it in
  // sync when the player switches themes in the Config submenu, and — under 'system' —
  // when the OS preference itself changes live (applyTheme's `change` listener).
  useEffect(() => {
    return applyTheme(settings.theme);
  }, [settings.theme]);

  // Load/Clear (GameMenu's Save submenu) replace the store wholesale, which can be
  // triggered mid-run. Persist first (synchronous localStorage write), then reload so the
  // whole app re-inits from the new store — swapping React state in place leaves
  // component-local state (e.g. an open DeckEditor's working copy) stale against it. The
  // reload resets `view` to the menu, so any in-progress run is abandoned silently (it was
  // never finished, so it shouldn't be scored as a RunResult). Wrapped in `transition()`
  // so it fades to black before the reload, matching the app's other hard cuts.
  function handleImportStore(next: PlayerStore) {
    saveStore(next);
    transition(() => window.location.reload());
  }

  // A run also lands here when the player hits Restart instead of End Run — that
  // discards the run without leaving GameProvider, so it would otherwise never be recorded.
  // The actual history/mapProgress/reward folding is `meta/store.ts`'s `applyRunResult` — a
  // pure, unit-tested function, not buried here (see CLAUDE.md's core/shell boundary).
  function recordResult(result: RunResult) {
    persist(applyRunResult(store, result, MISSIONS[result.missionId]));
  }

  function saveDeck(deck: DeckDef) {
    const exists = store.decks.some((d) => d.id === deck.id);
    // The deck cap is a core rule: refuse to append a *new* deck past MAX_DECKS. Editing an
    // existing deck (same id) is always allowed. The Decks screen disables "+ New Deck" at the
    // cap so this branch is a backstop, not the primary gate.
    if (!exists && store.decks.length >= MAX_DECKS) return;
    // The minimum deck size is likewise a core rule: refuse to save a deck under the floor. The
    // deck editor disables "Save" below MIN_DECK_SIZE, so this branch is a backstop too.
    if (deck.cards.length < MIN_DECK_SIZE) return;
    // map-if-exists-else-append keeps an edited deck's position stable instead of bumping it to the end.
    const decks = exists ? store.decks.map((d) => (d.id === deck.id ? deck : d)) : [...store.decks, deck];
    persist({ ...store, decks });
  }

  function deleteDeck(id: string) {
    persist({ ...store, decks: store.decks.filter((d) => d.id !== id) });
  }

  // The shop's write path: spend Influence to raise a card's copy tier.
  // `buyTier` is the pure rule (rules/shop.ts) and returns null for an unaffordable / maxed /
  // not-owned card, so a rejected buy is a silent no-op here — the Shop's button is already
  // disabled when unaffordable, making this a backstop like saveDeck's MAX_DECKS check.
  function buyCardTier(cardId: string) {
    const result = buyTier(store.collection, store.influence, cardId);
    if (!result) return;
    persist({ ...store, influence: result.influence, collection: result.collection });
  }

  // The sticker shop's write path: spend Influence to attach a sticker to
  // one chosen owned instance. `buySticker` is the pure rule (rules/stickers.ts) and returns
  // null for an unaffordable / already-stickered / unowned instance, so a rejected attach is a
  // silent no-op here — same backstop pattern as `buyCardTier`.
  function attachSticker(instanceId: string, stickerId: string) {
    const result = buySticker(store.collection, store.influence, instanceId, stickerId, store.unlockedStickers);
    if (!result) return;
    persist({ ...store, influence: result.influence, collection: result.collection });
  }

  // Removal's write path — deliberately touches `collection` alone. Attaching a sticker is meant to be
  // a decision with weight, so destroying one pays nothing back; `removeSticker` returns no Influence
  // for exactly that reason. It returns null for an unowned copy / out-of-range index, so a rejected
  // removal is a silent no-op — same backstop as its neighbours.
  function detachSticker(instanceId: string, index: number) {
    const collection = removeSticker(store.collection, instanceId, index);
    if (!collection) return;
    persist({ ...store, collection });
  }

  // The board-sticker shop's write path: spend Influence to attach a permanent modifier to a board.
  // `buyBoardSticker` is the pure rule (rules/boardStickers.ts) and returns null for an unaffordable /
  // full / inapplicable board, so a rejected buy is a silent no-op here — same backstop as above.
  function buyBoardStickerAt(boardId: BoardId, stickerId: string) {
    const result = buyBoardSticker(store.boardStickers, store.influence, boardId, stickerId, store.unlockedBoardStickers);
    if (!result) return;
    persist({ ...store, influence: result.influence, boardStickers: result.boardStickers });
  }

  // Removal's write path — deliberately touches `boardStickers` alone. Attaching a sticker is meant
  // to be a decision with weight, so destroying one pays nothing back; `removeBoardSticker` returns
  // no Influence for exactly that reason. It returns null for an unknown board / out-of-range index,
  // so a rejected removal is a silent no-op — same backstop as its neighbours.
  function removeBoardStickerAt(boardId: BoardId, index: number) {
    const boardStickers = removeBoardSticker(store.boardStickers, boardId, index);
    if (!boardStickers) return;
    persist({ ...store, boardStickers });
  }

  return (
    // Whole-UI scale wrapper — a transform:scale() container so `position: fixed` children
    // (hand bar, burger, deck-editor banner, drag clones) reparent to it and scale as one.
    // See App.module.css. `--ui-scale` inherits down; Board/DeckEditor also read the number.
    <div className={styles.uiScale} style={{ '--ui-scale': settings.uiScale } as CSSProperties}>
      {view.screen === 'run' ? (
        <GameProvider
          config={view.config}
          // The screen-swap fade is applied at the trigger (RunGameMenu/Board's onTransition
          // calls), not here — wrapping this too would nest transitions: this callback fires
          // *during* the trigger's already-in-flight covering phase, so a second `transition()`
          // call would see a non-idle phase and bail without ever calling setView.
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
            onTransition={transition}
          />
          <Board
            confirmEndTurn={settings.confirmEndTurn}
            uiScale={settings.uiScale}
            onTransition={transition}
            mapProgress={store.mapProgress}
            collection={store.collection}
            unlockedStickers={store.unlockedStickers}
            unlockedBoardStickers={store.unlockedBoardStickers}
            unlockedBoards={store.unlockedBoards}
          />
        </GameProvider>
      ) : (
        <>
          <GameMenu store={store} onImportStore={handleImportStore} settings={settings} onUpdateSettings={persistSettings} />
          <MetaMenu
            runHistory={store.runHistory}
            decks={store.decks}
            collection={store.collection}
            influence={store.influence}
            mapProgress={store.mapProgress}
            boardStickers={store.boardStickers}
            unlockedStickers={store.unlockedStickers}
            unlockedBoardStickers={store.unlockedBoardStickers}
            unlockedBoards={store.unlockedBoards}
            lifetime={store.lifetime}
            bestInfinite={store.bestInfinite}
            uiScale={settings.uiScale}
            onLaunch={(config) => transition(() => setView({ screen: 'run', config }))}
            onSaveDeck={saveDeck}
            onDeleteDeck={deleteDeck}
            onBuyTier={buyCardTier}
            onAttachSticker={attachSticker}
            onRemoveSticker={detachSticker}
            onBuyBoardSticker={buyBoardStickerAt}
            onRemoveBoardSticker={removeBoardStickerAt}
          />
        </>
      )}
      <div
        className={styles.transitionOverlay}
        style={{
          opacity: transitionPhase === 'covering' ? 1 : 0,
          pointerEvents: transitionPhase === 'idle' ? 'none' : 'auto',
          transitionDuration: `${FADE_MS}ms`,
        }}
        aria-hidden="true"
      />
      {!settings.seenAccessibilityIntro && (
        <AccessibilityWelcome
          settings={settings}
          onUpdateSettings={persistSettings}
          onDismiss={() => persistSettings({ ...settings, seenAccessibilityIntro: true })}
        />
      )}
    </div>
  );
}
