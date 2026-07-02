import { useState } from 'react';
import { version } from '../../package.json';
import styles from './GameMenu.module.css';

interface MenuItem {
  id: string;
  icon: string;
  label: string;
}

/** The decided game-menu items (docs/DESIGN.md, Phase 2: "game menu (save, config,
 *  codex)"). Each opens an empty placeholder submenu until its feature lands. */
const MENU_ITEMS: MenuItem[] = [
  { id: 'save', icon: '💾', label: 'Save' },
  { id: 'config', icon: '⚙️', label: 'Config' },
  { id: 'codex', icon: '📖', label: 'Codex' },
];

/**
 * The game's global-action surface: a burger button fixed in the top-right corner,
 * mounted once in `App.tsx` so it overlays both the meta menu and the run screen.
 * Opens a central popup listing `MENU_ITEMS`; clicking one opens its own submenu
 * window stacked on top. Submenus are placeholders for now — the in-run screen will
 * later gain extra items (end run / restart run) here, tracked separately in
 * docs/TODO.md.
 */
export function GameMenu() {
  const [open, setOpen] = useState(false);
  const [submenuId, setSubmenuId] = useState<string | null>(null);
  const submenu = MENU_ITEMS.find((m) => m.id === submenuId) ?? null;

  function close() {
    setOpen(false);
    setSubmenuId(null);
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
                  onClick={() => setSubmenuId(item.id)}
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
                <p className={styles.submenuEmpty}>Nothing here yet.</p>
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
