import { describe, it, expect } from 'vitest';
import { CORE_KEYS, STRATEGIC_KEYS } from '../rules/resources';
import { KIND_RANK } from './cards';
import { CODEX_CORE_RESOURCES, CODEX_STRATEGIC, CODEX_CARD_KINDS } from './codex';

// The icon side is already guaranteed by the type system: `RESOURCE_ICON` is a
// `Record<keyof Resources, string>` and each entry's `key` is a `keyof CoreResources` /
// `keyof StrategicResources`, so a missing icon can't type-check. What isn't type-enforced is that
// each table stays in sync with the *set* of resources it covers — that's what this guards.
describe('codex data coherence', () => {
  it('covers all five core resources exactly once', () => {
    const keys = CODEX_CORE_RESOURCES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length); // no duplicates
    expect([...keys].sort()).toEqual([...(CORE_KEYS as string[])].sort()); // no gaps
  });

  it('covers all three strategic resources exactly once', () => {
    const keys = CODEX_STRATEGIC.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length); // no duplicates
    expect([...keys].sort()).toEqual([...(STRATEGIC_KEYS as string[])].sort()); // no gaps
  });

  // Anchored on `KIND_RANK`'s keys — total over `CardKind`, so it enumerates every kind the
  // catalogue can express. Deriving the expected set from `CARDS` instead would only cover the kinds
  // that happen to have a card, letting an unused-but-expressible kind go undocumented.
  it('covers every card kind exactly once', () => {
    const kinds = CODEX_CARD_KINDS.map((c) => c.kind);
    expect(new Set(kinds).size).toBe(kinds.length); // no duplicates
    expect([...kinds].sort()).toEqual(Object.keys(KIND_RANK).sort()); // no gaps
  });
});
