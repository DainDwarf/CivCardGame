import { useRef, useState, type ChangeEvent } from 'react';
import { version } from '../../package.json';
import { emptyStore, exportSave, importSave, type PlayerStore } from '../meta/store';
import styles from './GameMenu.module.css';

/** A destructive Save-submenu action pending the player's confirmation (see `PendingAction` usage below). */
type PendingAction = { kind: 'import'; store: PlayerStore } | { kind: 'clear' };

interface MenuItem {
  id: string;
  icon: string;
  label: string;
}

/** The decided game-menu items (docs/DESIGN.md, Phase 2: "game menu (save, config,
 *  codex)"). Config/Codex are still empty placeholder submenus; Save is populated. */
const MENU_ITEMS: MenuItem[] = [
  { id: 'save', icon: '💾', label: 'Save' },
  { id: 'config', icon: '⚙️', label: 'Config' },
  { id: 'codex', icon: '📖', label: 'Codex' },
];

/** Filename timestamp — just the date, since a player is unlikely to export twice in one day. */
function saveFileName(): string {
  return `civcardgame-save-${new Date().toISOString().slice(0, 10)}.civsave`;
}

/**
 * The game's global-action surface: a burger button fixed in the top-right corner,
 * mounted once in `App.tsx` so it overlays both the meta menu and the run screen.
 * Opens a central popup listing `MENU_ITEMS`; clicking one opens its own submenu
 * window stacked on top. The in-run screen will later gain extra items (end run /
 * restart run) here, tracked separately in docs/TODO.md.
 *
 * `store`/`onImportStore` back the Save submenu: Export downloads `store` (see
 * `meta/store.ts`'s `exportSave`) as a `.civsave` file — read-only, so it needs no
 * confirmation. Load and Clear both replace the live store wholesale (`App.tsx`'s
 * `handleImportStore`, which also silently closes any in-progress run rather than
 * scoring it) and so both gate on a `PendingAction` confirmation step before calling
 * `onImportStore`: Load reads a chosen file through `importSave` first (a parse error
 * is reported immediately, with nothing pending to confirm); Clear resets straight to
 * `emptyStore()`.
 */
export function GameMenu({
  store,
  onImportStore,
}: {
  store: PlayerStore;
  onImportStore: (store: PlayerStore) => void;
}) {
  const [open, setOpen] = useState(false);
  const [submenuId, setSubmenuId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submenu = MENU_ITEMS.find((m) => m.id === submenuId) ?? null;

  function close() {
    setOpen(false);
    setSubmenuId(null);
    setPending(null);
  }

  function openSubmenu(id: string) {
    setImportMessage(null);
    setPending(null);
    setSubmenuId(id);
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
              {MENU_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={styles.itemBtn}
                  onClick={() => openSubmenu(item.id)}
                >
                  <span className={styles.itemIcon} aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}
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
