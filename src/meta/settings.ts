/**
 * Local device preferences (game menu's Config submenu) — deliberately kept out of
 * `PlayerStore`: unlike decks/run history, these aren't game progress, so they aren't
 * part of Save's export/import/clear and don't get wiped when the player loads or
 * clears a save.
 */
export interface Settings {
  /** Require a confirm click before ending a round. */
  confirmEndTurn: boolean;
  /** Whole-UI scale factor applied via a `transform: scale()` wrapper (App.tsx). 1 = 100%. */
  uiScale: number;
}

/** Bounds for `uiScale`, shared by the parser's clamp and the Config slider (GameMenu.tsx). */
export const UI_SCALE_MIN = 0.8;
export const UI_SCALE_MAX = 1.5;

export const DEFAULT_SETTINGS: Settings = { confirmEndTurn: false, uiScale: 1 };

const STORAGE_KEY = 'civcardgame:settings';

/** Clamp a stored/hand-edited scale into range, falling back to 1 on anything non-finite. */
function clampScale(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_SETTINGS.uiScale;
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, v));
}

function parseSettings(raw: unknown): Settings | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  return {
    confirmEndTurn: typeof obj.confirmEndTurn === 'boolean' ? obj.confirmEndTurn : DEFAULT_SETTINGS.confirmEndTurn,
    uiScale: clampScale(obj.uiScale),
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
