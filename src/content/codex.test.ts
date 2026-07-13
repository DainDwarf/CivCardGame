import { describe, it, expect } from 'vitest';
import { CORE_KEYS, STRATEGIC_KEYS } from '../rules/resources';
import { CODEX_CORE_RESOURCES, CODEX_STRATEGIC } from './codex';

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
});
