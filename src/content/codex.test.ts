import { describe, it, expect } from 'vitest';
import { CORE_KEYS } from '../rules/resources';
import { CODEX_CORE_RESOURCES } from './codex';

// The icon side is already guaranteed by the type system: `COST_ICON` is a
// `Record<keyof CoreResources, string>` and each entry's `key` is a `keyof CoreResources`, so a
// missing icon can't type-check. What isn't type-enforced is that the table stays in
// sync with the *set* of core resources — that's what this guards.
describe('codex data coherence', () => {
  const resourceKeys = CORE_KEYS as string[];

  it('covers all five core resources exactly once', () => {
    const keys = CODEX_CORE_RESOURCES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length); // no duplicates
    expect([...keys].sort()).toEqual([...resourceKeys].sort()); // no gaps
  });
});
