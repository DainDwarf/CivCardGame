import { describe, it, expect } from 'vitest';
import { emptyResources } from '../rules/resources';
import { CODEX_CORE_RESOURCES } from './codex';

// The icon side is already guaranteed by the type system: `COST_ICON` is a
// `Record<keyof Resources, string>` and each entry's `key` is a `keyof Resources`, so a
// missing icon can't type-check. What isn't type-enforced is that the table stays in
// sync with the *set* of resources — that's what this guards.
describe('codex data coherence', () => {
  const resourceKeys = Object.keys(emptyResources());

  it('covers all five core resources exactly once', () => {
    const keys = CODEX_CORE_RESOURCES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length); // no duplicates
    expect([...keys].sort()).toEqual([...resourceKeys].sort()); // no gaps
  });
});
