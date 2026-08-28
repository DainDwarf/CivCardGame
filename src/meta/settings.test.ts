import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings, resetTutorialFlags } from './settings';

describe('parseSettings', () => {
  it('shows every progress-gated popup to a profile stored before the fields existed', () => {
    const parsed = parseSettings({ confirmEndTurn: false, uiScale: 1, theme: 'dark' });
    expect(parsed?.seenRunIntro).toBe(false);
    expect(parsed?.seenMetaIntro).toBe(false);
    expect(parsed?.seenEndNote).toBe(false);
    // Contrast: the same missing-field case defaults the accessibility prompt to *seen*, since
    // stored settings at all mean the profile isn't fresh.
    expect(parsed?.seenAccessibilityIntro).toBe(true);
  });

  it('keeps a stored dismissal', () => {
    const parsed = parseSettings({ uiScale: 1, theme: 'light', seenRunIntro: true, seenMetaIntro: true, seenEndNote: true });
    expect(parsed?.seenRunIntro).toBe(true);
    expect(parsed?.seenMetaIntro).toBe(true);
    expect(parsed?.seenEndNote).toBe(true);
  });
});

describe('resetTutorialFlags', () => {
  it('owes every progress-gated popup again but keeps every other preference', () => {
    const seen = {
      ...DEFAULT_SETTINGS,
      theme: 'dark' as const,
      uiScale: 1.2,
      confirmEndTurn: true,
      seenAccessibilityIntro: true,
      seenRunIntro: true,
      seenMetaIntro: true,
      seenEndNote: true,
    };
    expect(resetTutorialFlags(seen)).toEqual({ ...seen, seenRunIntro: false, seenMetaIntro: false, seenEndNote: false });
  });
});
