import { describe, it, expect } from 'vitest';
import { applyRunResult, exportSave, importSave, type PlayerStore } from './store';
import { DEFAULT_DECKS } from '../content/decks';
import { STARTING_COLLECTION } from '../content/collection';
import { buildSeedDecks } from '../rules/deckBuilder';
import { collectionFromCounts, copiesOwned } from '../rules/collection';
import type { RunResult } from '../contract';
import type { MissionDef } from '../content/missions';

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
      finalResources: { food: 1, production: 2, money: 3, science: 4, military: 5 },
      strategicResources: { population: 1, territory: 2, culture: 3 },
    },
  };
}

function sampleStore(): PlayerStore {
  const collection = collectionFromCounts(STARTING_COLLECTION);
  return {
    runHistory: [sampleRunResult()],
    decks: buildSeedDecks(DEFAULT_DECKS, collection),
    influence: 3,
    collection,
    mapProgress: { enlightenment: true },
    boardStickers: {},
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

  it('seeds missing decks with the defaults, like loadStore does', () => {
    const store = sampleStore();
    const { decks: _decks, ...withoutDecks } = store;
    const bogus = toBase64(JSON.stringify({ schemaVersion: 1, store: withoutDecks }));
    const result = importSave(bogus);
    expect(result).toEqual({ ok: true, store: { ...withoutDecks, decks: buildSeedDecks(DEFAULT_DECKS, withoutDecks.collection) } });
  });

  it('rejects a save missing influence/collection/mapProgress — no migration path for these newer fields', () => {
    const store = sampleStore();
    const bogus = toBase64(JSON.stringify({ schemaVersion: 1, store: { runHistory: store.runHistory, decks: store.decks } }));
    const result = importSave(bogus);
    expect(result.ok).toBe(false);
  });

  it('rejects a pre-Step-7.2 collection shape (a bare cardId→count map) rather than loading it', () => {
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
    reward: { influence: 2, unlockCardId: 'granary' },
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

function runResult(missionId: string, outcome: RunResult['outcome'], turnsTaken: number): RunResult {
  return {
    outcome,
    missionId,
    stats: {
      turnsTaken,
      finalResources: { food: 0, production: 0, money: 0, science: 0, military: 0 },
      strategicResources: { population: 0, territory: 0, culture: 0 },
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

  it('a standard mission defeat pays nothing and leaves mapProgress untouched', () => {
    const store = sampleStore();
    const next = applyRunResult(store, runResult('std', 'defeat', 3), standardMission());
    expect(next.mapProgress.std).toBeUndefined();
    expect(next.influence).toBe(store.influence);
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
});
