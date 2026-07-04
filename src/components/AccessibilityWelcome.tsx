import { THEMES, UI_SCALE_MIN, UI_SCALE_MAX, type Settings } from '../meta/settings';
import styles from './AccessibilityWelcome.module.css';

/**
 * A one-time first-launch prompt (docs/TODO.md's "First-launch accessibility selector")
 * surfacing the two display-accessibility settings — color theme and UI size — up front,
 * instead of leaving a brand-new profile to discover them buried in the burger menu's
 * Config screen. Mounted by `App.tsx` whenever `!settings.seenAccessibilityIntro`; both
 * controls write straight through `onUpdateSettings` (same as Config's own), so changes
 * preview live against the menu underneath. `onDismiss` marks the intro seen so it never
 * reappears, regardless of which values the player lands on (including the defaults).
 */
export function AccessibilityWelcome({
  settings,
  onUpdateSettings,
  onDismiss,
}: {
  settings: Settings;
  onUpdateSettings: (settings: Settings) => void;
  onDismiss: () => void;
}) {
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.panel}>
        <h2 className={styles.title}>Welcome</h2>
        <p className={styles.blurb}>
          Set the display up to suit you before you start — both of these can be changed later from the menu's Config
          screen.
        </p>
        <div className={styles.themeRow}>
          <span className={styles.label}>Color theme</span>
          <select
            className={styles.select}
            value={settings.theme}
            onChange={(e) => onUpdateSettings({ ...settings, theme: e.target.value as Settings['theme'] })}
          >
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <p className={styles.hint}>
          If red, green, or blue are hard to tell apart, try Deuteranopia, Protanopia, or Tritanopia.
        </p>
        <div className={styles.scaleRow}>
          <div className={styles.scaleHead}>
            <span className={styles.label}>UI size</span>
            <span className={styles.scaleValue}>{Math.round(settings.uiScale * 100)}%</span>
          </div>
          <input
            type="range"
            min={UI_SCALE_MIN}
            max={UI_SCALE_MAX}
            step={0.05}
            value={settings.uiScale}
            onChange={(e) => onUpdateSettings({ ...settings, uiScale: Number(e.target.value) })}
            aria-label="UI size"
          />
        </div>
        <button type="button" className={styles.continueBtn} onClick={onDismiss}>
          Continue
        </button>
      </div>
    </div>
  );
}
