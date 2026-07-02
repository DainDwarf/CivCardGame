import { describe, it, expect } from 'vitest';
import { exportSave, importSave, type PlayerStore } from './store';
import { DEFAULT_DECKS } from '../content/decks';
import { cloneDecks } from '../rules/deckBuilder';
import type { RunResult } from '../contract';

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
  return {
    runHistory: [sampleRunResult()],
    decks: cloneDecks(DEFAULT_DECKS),
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
    const bogus = toBase64(JSON.stringify({ schemaVersion: 1, store: { runHistory: store.runHistory } }));
    const result = importSave(bogus);
    expect(result).toEqual({ ok: true, store: { runHistory: store.runHistory, decks: cloneDecks(DEFAULT_DECKS) } });
  });
});
