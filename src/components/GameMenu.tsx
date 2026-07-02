import { useRef, useState, type ChangeEvent } from 'react';
import { version } from '../../package.json';
import { emptyStore, exportSave, importSave, type PlayerStore } from '../meta/store';
import type { Settings } from '../meta/settings';
import styles from './GameMenu.module.css';

/** A destructive action pending the player's confirmation (see `PendingAction` usage below). */
type PendingAction = { kind: 'import'; store: PlayerStore } | { kind: 'clear' } | { kind: 'restartRun' } | { kind: 'endRun' };

interface MenuItem {
  id: string;
  icon: string;
  label: string;
}

/** The decided game-menu items (docs/DESIGN.md, Phase 2: "game menu (save, config,
 *  codex)"). Codex is still an empty placeholder submenu; Save and Config are populated. */
const MENU_ITEMS: MenuItem[] = [
  { id: 'save', icon: '💾', label: 'Save' },
  { id: 'config', icon: '⚙️', label: 'Config' },
  { id: 'codex', icon: '📖', label: 'Codex' },
];

/** Appended after `MENU_ITEMS` only when `runControls` is supplied — i.e. only on the
 *  run screen (see `runControls`' doc comment). */
const RUN_MENU_ITEMS: MenuItem[] = [
  { id: 'restartRun', icon: '🔄', label: 'Restart Run' },
  { id: 'endRun', icon: '🚪', label: 'End Run' },
];

/** Backs the run-screen-only "Restart Run" / "End Run" items. Supplied by a small
 *  wrapper in `App.tsx` that renders inside `GameProvider` (this component doesn't have
 *  access to `useGame()` itself). While the run is still live, both discard real
 *  progress, so both are confirm-gated like Save's Load/Clear; once the run is over
 *  (`isOver`), the result is already fixed — recorded via `onEndRun`, or about to be via
 *  `onRestart` — regardless of which button is pressed, so neither needs a confirm step
 *  and both act immediately (mirroring the gameover overlay's own Restart/End Run
 *  buttons, which have no confirm step either). */
export interface RunMenuControls {
  /** Discards the current run and starts a fresh one — `GameContext`'s `restart`. While
   *  live this no-ops the recording half (nothing to record yet); once over it records
   *  the finished run first, same as the overlay's Restart. */
  onRestart: () => void;
  /** True once restart should be refused outright: mirrors the gameover overlay's own
   *  rule (`Board.tsx`) of disabling Restart after a won run — restarting a win doesn't
   *  make sense; the player should End Run to bank the result instead. Only meaningful
   *  once `isOver`; always false while the run is live. */
  restartDisabled: boolean;
  /** While the run is live, abandons it and returns to the meta menu without recording a
   *  result (mirrors `App.tsx`'s `handleImportStore`, which silently closes an
   *  in-progress run the same way). Once the run is over, finishes it and records the
   *  result instead — equivalent to the gameover overlay's own End Run button. */
  onEndRun: () => void;
  /** Whether the run has already ended (won/lost). Gates whether Restart/End Run need a
   *  confirm step (see this interface's doc comment) and whether Restart is refused
   *  outright (`restartDisabled`). */
  isOver: boolean;
}

/** Filename timestamp — just the date, since a player is unlikely to export twice in one day. */
function saveFileName(): string {
  return `civcardgame-save-${new Date().toISOString().slice(0, 10)}.civsave`;
}

/**
 * The game's global-action surface: a burger button fixed in the top-right corner. On
 * the meta screen `App.tsx` mounts this directly; on the run screen it mounts a small
 * wrapper (`RunGameMenu`) inside `GameProvider` that supplies `runControls`, so the
 * items list differs per screen. Opens a central popup listing the items; clicking one
 * opens its own submenu window stacked on top.
 *
 * `store`/`onImportStore` back the Save submenu: Export downloads `store` (see
 * `meta/store.ts`'s `exportSave`) as a `.civsave` file — read-only, so it needs no
 * confirmation. Load and Clear both replace the live store wholesale (`App.tsx`'s
 * `handleImportStore`, which also silently closes any in-progress run rather than
 * scoring it) and so both gate on a `PendingAction` confirmation step before calling
 * `onImportStore`: Load reads a chosen file through `importSave` first (a parse error
 * is reported immediately, with nothing pending to confirm); Clear resets straight to
 * `emptyStore()`.
 *
 * `settings`/`onUpdateSettings` back the Config submenu — device-local preferences
 * (`meta/settings.ts`), deliberately kept out of `PlayerStore` so they survive a
 * Save-submenu Load/Clear untouched. Currently just the confirm-end-turn toggle,
 * which calls `onUpdateSettings` directly on change (no pending/confirm step — it
 * isn't destructive). A UI-size setting was tried and reverted — see docs/TODO.md.
 *
 * `runControls` (see its own doc comment) backs the run-screen-only Restart Run / End
 * Run items — confirm-gated like Save's Load/Clear while the run is live, but act
 * immediately once it's over (nothing left to lose either way).
 */
export function GameMenu({
  store,
  onImportStore,
  settings,
  onUpdateSettings,
  runControls = null,
}: {
  store: PlayerStore;
  onImportStore: (store: PlayerStore) => void;
  settings: Settings;
  onUpdateSettings: (settings: Settings) => void;
  runControls?: RunMenuControls | null;
}) {
  const [open, setOpen] = useState(false);
  const [submenuId, setSubmenuId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const items = runControls ? [...MENU_ITEMS, ...RUN_MENU_ITEMS] : MENU_ITEMS;
  const submenu = items.find((m) => m.id === submenuId) ?? null;

  function close() {
    setOpen(false);
    setSubmenuId(null);
    setPending(null);
  }

  function openSubmenu(id: string) {
    setImportMessage(null);
    // Restart Run / End Run have no non-destructive "landing" state (unlike Save's
    // Load/Clear, which show plain buttons first) — opening the submenu goes straight
    // to the confirm step.
    setPending(id === 'restartRun' || id === 'endRun' ? { kind: id } : null);
    setSubmenuId(id);
  }

  /** Restart Run / End Run only need the confirm-submenu detour while the run is live —
   *  once it's over there's nothing left to lose, so they act immediately (see
   *  `RunMenuControls`' doc comment) and close the whole popup. */
  function handleItemClick(id: string) {
    if (runControls?.isOver && (id === 'restartRun' || id === 'endRun')) {
      if (id === 'restartRun') runControls.onRestart();
      else runControls.onEndRun();
      close();
      return;
    }
    openSubmenu(id);
  }

  function downloadSave() {
    const blob = new Blob([exportSave(store)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = saveFileName();
    // Some browsers only honor `click()` on an anchor that's actually in the document.
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Deferred so the click's navigation/download has already grabbed the blob URL.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function handleFileChosen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the player re-pick the same file later without a no-op change event
    if (!file) return;

    const result = importSave(await file.text());
    if (result.ok) {
      setImportMessage(null);
      setPending({ kind: 'import', store: result.store });
    } else {
      setImportMessage({ kind: 'error', text: result.error });
    }
  }

  function confirmPending() {
    if (!pending) return;
    if (pending.kind === 'restartRun' || pending.kind === 'endRun') {
      // Restart/End both leave this screen (a fresh run or back to the meta menu) —
      // close the whole popup rather than leaving a submenu open behind.
      if (pending.kind === 'restartRun') runControls?.onRestart();
      else runControls?.onEndRun();
      close();
      return;
    }
    onImportStore(pending.kind === 'import' ? pending.store : emptyStore());
    setImportMessage({ kind: 'ok', text: pending.kind === 'import' ? 'Save loaded.' : 'Save cleared.' });
    setPending(null);
  }

  return (
    <>
      <button
        type="button"
        className={styles.burger}
        onClick={() => setOpen(true)}
        aria-label="Open game menu"
      >
        <span aria-hidden="true">☰</span>
      </button>

      {open && (
        <div className={styles.backdrop} onClick={close} role="dialog" aria-modal="true">
          <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.title}>Menu</h2>
            <div className={styles.items}>
              {items.map((item) => {
                // Mirrors the gameover overlay's own rule: restarting a won run doesn't
                // make sense (see RunMenuControls.restartDisabled's doc comment).
                const restartDisabled = item.id === 'restartRun' && !!runControls?.restartDisabled;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={styles.itemBtn}
                    onClick={() => handleItemClick(item.id)}
                    disabled={restartDisabled}
                    title={restartDisabled ? "You've already won this run — end it to keep the result." : undefined}
                  >
                    <span className={styles.itemIcon} aria-hidden="true">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" className={styles.closeBtn} onClick={close}>
              Close
            </button>
            <p className={styles.version}>CivCardGame v{version}</p>
          </div>

          {submenu && (
            // Stacked on top of .panel — clicking its own dimmed area only dismisses the
            // submenu (stopPropagation keeps the click from also closing the outer popup).
            <div
              className={styles.submenuBackdrop}
              onClick={(e) => {
                e.stopPropagation();
                setSubmenuId(null);
              }}
            >
              <div className={styles.submenuPanel} onClick={(e) => e.stopPropagation()}>
                <h3 className={styles.submenuTitle}>
                  <span aria-hidden="true">{submenu.icon}</span> {submenu.label}
                </h3>
                {submenu.id === 'save' ? (
                  <div className={styles.saveBody}>
                    <p className={styles.autosaveNotice}>Your progress saves automatically — this is only for backups.</p>
                    {pending ? (
                      <div className={styles.confirmBody}>
                        <p className={styles.confirmText}>
                          {pending.kind === 'import'
                            ? 'Loading this file replaces your current decks and run history. This can’t be undone.'
                            : 'This erases your decks and run history and resets to the starting decks. This can’t be undone.'}
                        </p>
                        <div className={styles.confirmActions}>
                          <button type="button" className={styles.confirmDangerBtn} onClick={confirmPending}>
                            {pending.kind === 'import' ? 'Replace save' : 'Clear save'}
                          </button>
                          <button type="button" className={styles.confirmCancelBtn} onClick={() => setPending(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button type="button" className={styles.itemBtn} onClick={downloadSave}>
                          <span className={styles.itemIcon} aria-hidden="true">
                            ⬇️
                          </span>
                          <span>Download save</span>
                        </button>
                        <button type="button" className={styles.itemBtn} onClick={() => fileInputRef.current?.click()}>
                          <span className={styles.itemIcon} aria-hidden="true">
                            ⬆️
                          </span>
                          <span>Load save…</span>
                        </button>
                        <button type="button" className={styles.itemBtn} onClick={() => setPending({ kind: 'clear' })}>
                          <span className={styles.itemIcon} aria-hidden="true">
                            🗑️
                          </span>
                          <span>Clear save</span>
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".civsave,text/plain"
                          className={styles.hiddenFileInput}
                          onChange={handleFileChosen}
                        />
                        {importMessage && (
                          <p className={importMessage.kind === 'error' ? styles.saveError : styles.saveOk}>
                            {importMessage.text}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                ) : submenu.id === 'config' ? (
                  <div className={styles.configBody}>
                    <label className={styles.configToggleRow}>
                      <input
                        type="checkbox"
                        checked={settings.confirmEndTurn}
                        onChange={(e) => onUpdateSettings({ ...settings, confirmEndTurn: e.target.checked })}
                      />
                      <span>Confirm before ending a round</span>
                    </label>
                  </div>
                ) : submenu.id === 'restartRun' || submenu.id === 'endRun' ? (
                  <div className={styles.confirmBody}>
                    <p className={styles.confirmText}>
                      {submenu.id === 'restartRun'
                        ? 'This discards your current run and starts a fresh one with the same mission and deck. This can’t be undone.'
                        : 'This abandons your current run without recording a result. This can’t be undone.'}
                    </p>
                    <div className={styles.confirmActions}>
                      <button type="button" className={styles.confirmDangerBtn} onClick={confirmPending}>
                        {submenu.id === 'restartRun' ? 'Restart run' : 'End run'}
                      </button>
                      <button type="button" className={styles.confirmCancelBtn} onClick={() => setSubmenuId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className={styles.submenuEmpty}>Nothing here yet.</p>
                )}
                <button type="button" className={styles.closeBtn} onClick={() => setSubmenuId(null)}>
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
