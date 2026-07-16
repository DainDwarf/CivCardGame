import { describe, it, expect } from 'vitest';
import { applyRunResult, exportSave, importSave, type PlayerStore } from './store';
import type { DeckSeed } from '../content/decks';
import { buildSeedDecks } from '../rules/deckBuilder';
import { collectionFromCounts, copiesOwned } from '../rules/collection';
import type { RunResult } from '../contract';
import type { MissionDef } from '../content/missions';

// `applyRunResult` and the save round-trip are pure mechanism — they never validate a cardId against
// `CARDS` — so this suite runs on a *synthetic* collection + deck seed rather than the real
// `STARTING_COLLECTION`/`DEFAULT_DECKS` catalogues. The cardIds are arbitrary; the
// `standardMission` below unlocks `granary`, granted straight onto this collection.
const SEED_COUNTS: Record<string, number> = { farm: 2, workshop: 2, library: 1 };
const SEED_DECKS: DeckSeed[] = [
  { id: 'starter', name: 'Test Deck', cards: ['farm', 'farm', 'workshop', 'workshop', 'library'] },
];

/** Unicode-safe base64 for constructing bogus save payloads below, mirroring the
 *  encoding `exportSave` itself uses internally (plain `btoa` throws on non-Latin1 text). */
function toBase64(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function sampleRunResult(): RunResult {
  return {
    outcome: 'victory',
    missionId: 'first-harvest',
    stats: {
      turnsTaken: 12,
      finalResources: { food: 1, production: 2, money: 3, science: 4, military: 5, population: 1, territory: 2, culture: 3 },
    },
  };
}

function sampleStore(): PlayerStore {
  const collection = collectionFromCounts(SEED_COUNTS);
  return {
    runHistory: [sampleRunResult()],
    decks: buildSeedDecks(SEED_DECKS, collection),
    influence: 3,
    collection,
    mapProgress: { enlightenment: true },
    boardStickers: {},
    unlockedStickers: {},
    unlockedBoardStickers: {},
    unlockedBoards: {},
    lifetime: { runsPlayed: 1, victories: 1, influenceEarned: 3 },
    bestInfinite: {},
  };
}

describe('exportSave / importSave', () => {
  it('round-trips a store', () => {
    const store = sampleStore();
    const result = importSave(exportSave(store));
    expect(result).toEqual({ ok: true, store });
  });

  it('round-trips free-text (unicode) deck names', () => {
    const store = sampleStore();
    store.decks[0].name = 'Résumé 王 🏛️';
    const result = importSave(exportSave(store));
    expect(result).toEqual({ ok: true, store });
  });

  it('tolerates surrounding whitespace, as pasted text often has', () => {
    const store = sampleStore();
    const result = importSave(`  ${exportSave(store)}\n`);
    expect(result).toEqual({ ok: true, store });
  });

  it('rejects a non-base64 string', () => {
    const result = importSave('not base64 at all !!!');
    expect(result.ok).toBe(false);
  });

  it('rejects base64 that decodes to non-JSON', () => {
    const result = importSave(toBase64('not json'));
    expect(result.ok).toBe(false);
  });

  it('rejects a save with an unrecognized schema version', () => {
    const bogus = toBase64(JSON.stringify({ schemaVersion: 999, store: sampleStore() }));
    const result = importSave(bogus);
    expect(result).toEqual({ ok: false, error: expect.any(String) });
  });

  it('rejects a save whose store shape is unrecognizable', () => {
    const bogus = toBase64(JSON.stringify({ schemaVersion: 1, store: { decks: [] } }));
    const result = importSave(bogus);
    expect(result.ok).toBe(false);
  });

  it('rejects a save missing decks — no fallback, no migration path', () => {
    const store = sampleStore();
    const { decks: _decks, ...withoutDecks } = store;
    const bogus = toBase64(JSON.stringify({ schemaVersion: 1, store: withoutDecks }));
    const result = importSave(bogus);
    expect(result.ok).toBe(false);
  });

  it('rejects a save missing influence/collection/mapProgress — no migration path for these newer fields', () => {
    const store = sampleStore();
    const bogus = toBase64(JSON.stringify({ schemaVersion: 1, store: { runHistory: store.runHistory, decks: store.decks } }));
    const result = importSave(bogus);
    expect(result.ok).toBe(false);
  });

  it('rejects a save missing the unlocked-sticker sets — no migration path for these newer fields', () => {
    const store = sampleStore();
    const { unlockedStickers: _s, unlockedBoardStickers: _b, ...withoutUnlocks } = store;
    const bogus = toBase64(JSON.stringify({ schemaVersion: 1, store: withoutUnlocks }));
    const result = importSave(bogus);
    expect(result.ok).toBe(false);
  });

  it('rejects a save missing the unlocked-boards set — no migration path for this newer field', () => {
    const store = sampleStore();
    const { unlockedBoards: _u, ...withoutUnlockedBoards } = store;
    const bogus = toBase64(JSON.stringify({ schemaVersion: 1, store: withoutUnlockedBoards }));
    const result = importSave(bogus);
    expect(result.ok).toBe(false);
  });

  it('rejects a malformed collection shape (a bare cardId→count map) rather than loading it', () => {
    const store = sampleStore();
    const bogus = toBase64(
      JSON.stringify({ schemaVersion: 1, store: { ...store, collection: { farm: 2 } } }),
    );
    const result = importSave(bogus);
    expect(result.ok).toBe(false);
  });
});

function standardMission(): MissionDef {
  return {
    id: 'std',
    name: 'std',
    lore: '',
    prereqs: [],
    objectiveCardId: 'long_winter_goal',
    victoryHint: '',
    failureHint: null,
    kind: 'standard',
    reward: {
      influence: 2,
      unlockCardIds: ['granary'],
      unlockStickerIds: ['irrigation'],
      unlockBoardStickerIds: ['stockpile'],
      unlockBoardIds: ['chiefdom'],
    },
    map: { col: 0, row: 0 },
  };
}

// Real board ids (tribe → settlement): `applyBoardUpgrade` resolves them against the live `BOARDS`
// catalogue for the sticker-carry eligibility check, unlike the synthetic cardIds above.
function boardUpgradeMission(): MissionDef {
  return {
    id: 'settle',
    name: 'settle',
    lore: '',
    prereqs: [],
    objectiveCardId: 'first_settlement_goal',
    victoryHint: '',
    failureHint: null,
    kind: 'standard',
    reward: { influence: 0, boardUpgrade: { from: 'tribe', to: 'settlement' } },
    map: { col: 0, row: 0 },
  };
}

function infiniteMission(): MissionDef {
  return {
    id: 'toto',
    name: 'toto',
    lore: '',
    prereqs: [],
    objectiveCardId: 'the_long_decline_goal',
    victoryHint: '',
    failureHint: null,
    kind: 'infinite',
  };
}

function rewardlessMission(): MissionDef {
  return { ...infiniteMission(), id: 'sandbox', rewardless: true };
}

function runResult(missionId: string, outcome: RunResult['outcome'], turnsTaken: number): RunResult {
  return {
    outcome,
    missionId,
    stats: {
      turnsTaken,
      finalResources: { food: 0, production: 0, money: 0, science: 0, military: 0, population: 0, territory: 0, culture: 0 },
    },
  };
}

describe('applyRunResult', () => {
  it('a standard mission victory marks mapProgress and pays the first-clear reward', () => {
    const store = sampleStore();
    const next = applyRunResult(store, runResult('std', 'victory', 12), standardMission());
    expect(next.mapProgress.std).toBe(true);
    expect(next.influence).toBe(store.influence + 2);
    expect(copiesOwned(next.collection, 'granary')).toBe(1);
  });

  it('a standard mission victory folds in the reward\'s card-/board-sticker and board unlocks', () => {
    const store = sampleStore();
    const next = applyRunResult(store, runResult('std', 'victory', 12), standardMission());
    expect(next.unlockedStickers.irrigation).toBe(true);
    expect(next.unlockedBoardStickers.stockpile).toBe(true);
    expect(next.unlockedBoards.chiefdom).toBe(true);
  });

  it('a standard mission defeat pays nothing and leaves mapProgress + every unlock set untouched', () => {
    const store = sampleStore();
    const next = applyRunResult(store, runResult('std', 'defeat', 3), standardMission());
    expect(next.mapProgress.std).toBeUndefined();
    expect(next.influence).toBe(store.influence);
    expect(next.unlockedStickers).toEqual(store.unlockedStickers);
    expect(next.unlockedBoardStickers).toEqual(store.unlockedBoardStickers);
    expect(next.unlockedBoards).toEqual(store.unlockedBoards);
  });

  it('a board-upgrade reward swaps the board on first clear, carrying its stickers across', () => {
    const store: PlayerStore = { ...sampleStore(), unlockedBoards: { tribe: true }, boardStickers: { tribe: ['stockpile'] } };
    const next = applyRunResult(store, runResult('settle', 'victory', 12), boardUpgradeMission());
    expect(next.unlockedBoards.settlement).toBe(true);
    expect(next.unlockedBoards.tribe).toBeUndefined();
    expect(next.boardStickers.settlement).toEqual(['stockpile']);
    expect(next.boardStickers.tribe).toBeUndefined();
  });

  it('a board-upgrade reward is a no-op on a replay (already-completed) clear', () => {
    const store: PlayerStore = {
      ...sampleStore(),
      mapProgress: { settle: true },
      unlockedBoards: { tribe: true },
      boardStickers: { tribe: ['stockpile'] },
    };
    const next = applyRunResult(store, runResult('settle', 'victory', 12), boardUpgradeMission());
    expect(next.unlockedBoards).toEqual({ tribe: true });
    expect(next.boardStickers).toEqual({ tribe: ['stockpile'] });
  });

  it('a board-upgrade reward does not fire on a defeat', () => {
    const store: PlayerStore = { ...sampleStore(), unlockedBoards: { tribe: true } };
    const next = applyRunResult(store, runResult('settle', 'defeat', 3), boardUpgradeMission());
    expect(next.unlockedBoards).toEqual({ tribe: true });
  });

  it('an infinite mission pays Influence = rounds survived on a victory-outcome stop', () => {
    const store = sampleStore();
    const next = applyRunResult(store, runResult('toto', 'victory', 10), infiniteMission());
    expect(next.influence).toBe(store.influence + 10);
    expect(next.mapProgress.toto).toBeUndefined();
  });

  it('an infinite mission pays the same Influence on a defeat-outcome stop — outcome doesn\'t gate the payout', () => {
    const store = sampleStore();
    const next = applyRunResult(store, runResult('toto', 'defeat', 10), infiniteMission());
    expect(next.influence).toBe(store.influence + 10);
    expect(next.mapProgress.toto).toBeUndefined();
  });

  it('an infinite mission never marks mapProgress, even across repeated attempts', () => {
    let store = sampleStore();
    store = applyRunResult(store, runResult('toto', 'victory', 5), infiniteMission());
    store = applyRunResult(store, runResult('toto', 'defeat', 8), infiniteMission());
    expect(store.mapProgress.toto).toBeUndefined();
    expect(store.influence).toBe(3 + 5 + 8);
  });

  it('accumulates lifetime counters — every run counts, only victories bump victories, influenceEarned tracks gross gains', () => {
    let store = sampleStore(); // starts at runsPlayed 1, victories 1, influenceEarned 3
    store = applyRunResult(store, runResult('std', 'victory', 12), standardMission()); // +1 run, +1 win, +2 influence
    store = applyRunResult(store, runResult('std', 'defeat', 3), standardMission()); // +1 run, already cleared → +0 influence
    store = applyRunResult(store, runResult('toto', 'defeat', 9), infiniteMission()); // +1 run, +9 influence
    expect(store.lifetime.runsPlayed).toBe(4);
    expect(store.lifetime.victories).toBe(2);
    expect(store.lifetime.influenceEarned).toBe(3 + 2 + 0 + 9);
  });

  it('influenceEarned counts gross gains even though spending is not modeled here — it only ever grows', () => {
    const store = sampleStore();
    const next = applyRunResult(store, runResult('toto', 'defeat', 7), infiniteMission());
    expect(next.lifetime.influenceEarned).toBe(store.lifetime.influenceEarned + 7);
  });

  it('bestInfinite keeps the per-mission max and never decreases when a later attempt scores lower', () => {
    let store = sampleStore();
    store = applyRunResult(store, runResult('toto', 'defeat', 8), infiniteMission());
    expect(store.bestInfinite.toto).toBe(8);
    store = applyRunResult(store, runResult('toto', 'victory', 15), infiniteMission());
    expect(store.bestInfinite.toto).toBe(15);
    store = applyRunResult(store, runResult('toto', 'defeat', 4), infiniteMission()); // worse attempt
    expect(store.bestInfinite.toto).toBe(15); // best is sticky — this is the whole point vs. a runHistory scan
  });

  it('a rewardless infinite mission (the sandbox) pays no Influence and records no best-score, run after run', () => {
    let store = sampleStore();
    store = applyRunResult(store, runResult('sandbox', 'defeat', 30), rewardlessMission());
    store = applyRunResult(store, runResult('sandbox', 'defeat', 12), rewardlessMission());
    expect(store.influence).toBe(3); // unchanged from the seed
    expect(store.lifetime.influenceEarned).toBe(3); // no gross gain either
    expect(store.bestInfinite.sandbox).toBeUndefined();
    expect(store.lifetime.runsPlayed).toBe(3); // still counts as runs played
  });

  it('a standard mission never records a bestInfinite entry', () => {
    const store = sampleStore();
    const next = applyRunResult(store, runResult('std', 'victory', 12), standardMission());
    expect(next.bestInfinite.std).toBeUndefined();
  });
});
