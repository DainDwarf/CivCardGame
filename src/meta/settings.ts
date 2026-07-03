/**
 * Local device preferences (game menu's Config submenu) — deliberately kept out of
 * `PlayerStore`: unlike decks/run history, these aren't game progress, so they aren't
 * part of Save's export/import/clear and don't get wiped when the player loads or
 * clears a save.
 */
/**
 * The color themes offered by the Config picker — the single source of truth for both
 * the `Theme` type and the picker UI (GameMenu.tsx). Each `id` is the value written to
 * `document.documentElement`'s `data-theme` attribute; the light palette lives in
 * `index.css`'s `:root`, dark in its `:root[data-theme='dark']` block. Adding a theme is
 * one entry here plus one `[data-theme]` block in `index.css` — nothing else.
 */
export const THEMES = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
] as const;

export type Theme = (typeof THEMES)[number]['id'];

/** The two concrete palettes `index.css` actually defines `[data-theme]` blocks for. */
export type ResolvedTheme = Exclude<Theme, 'system'>;

/** The `matchMedia` query that reports the OS/browser light-vs-dark preference. */
const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

/**
 * Resolves a `Settings.theme` choice into the concrete palette `document.documentElement`'s
 * `data-theme` must carry — `index.css` only defines `:root` (light) and
 * `:root[data-theme='dark']`, so `'system'` itself is never a valid attribute value.
 */
export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme !== 'system') return theme;
  return window.matchMedia(DARK_SCHEME_QUERY).matches ? 'dark' : 'light';
}

/**
 * Applies the resolved theme to `documentElement` now, and — when `theme` is `'system'` —
 * keeps it in sync with live OS-preference changes via a `change` listener. Returns an
 * unsubscribe function (a no-op when `theme` isn't `'system'`), meant to be called from a
 * `useEffect` cleanup so the listener doesn't leak across re-renders/theme switches.
 */
export function applyTheme(theme: Theme): () => void {
  document.documentElement.dataset.theme = resolveTheme(theme);
  if (theme !== 'system') return () => {};

  const query = window.matchMedia(DARK_SCHEME_QUERY);
  const onChange = () => {
    document.documentElement.dataset.theme = resolveTheme(theme);
  };
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

export interface Settings {
  /** Require a confirm click before ending a round. */
  confirmEndTurn: boolean;
  /** Whole-UI scale factor applied via a `transform: scale()` wrapper (App.tsx). 1 = 100%. */
  uiScale: number;
  /** Color theme id — applied as `data-theme` on documentElement (App.tsx / main.tsx). */
  theme: Theme;
}

/** Bounds for `uiScale`, shared by the parser's clamp and the Config slider (GameMenu.tsx). */
export const UI_SCALE_MIN = 0.8;
export const UI_SCALE_MAX = 1.5;

export const DEFAULT_SETTINGS: Settings = { confirmEndTurn: false, uiScale: 1, theme: 'system' };

const STORAGE_KEY = 'civcardgame:settings';

/** Clamp a stored/hand-edited scale into range, falling back to 1 on anything non-finite. */
function clampScale(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_SETTINGS.uiScale;
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, v));
}

/** Whether a stored/hand-edited value is one of the known theme ids. */
function isTheme(v: unknown): v is Theme {
  return THEMES.some((t) => t.id === v);
}

function parseSettings(raw: unknown): Settings | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  return {
    confirmEndTurn: typeof obj.confirmEndTurn === 'boolean' ? obj.confirmEndTurn : DEFAULT_SETTINGS.confirmEndTurn,
    uiScale: clampScale(obj.uiScale),
    theme: isTheme(obj.theme) ? obj.theme : DEFAULT_SETTINGS.theme,
  };
}

/** Reads settings from `localStorage`. Missing, corrupt, or inaccessible data falls back to defaults. */
export function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return parseSettings(JSON.parse(raw)) ?? DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Writes settings to `localStorage`. Failures (quota, private browsing) are swallowed — same as `store.ts`'s `saveStore`. */
export function saveSettings(settings: Settings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignored — see doc comment above.
  }
}
