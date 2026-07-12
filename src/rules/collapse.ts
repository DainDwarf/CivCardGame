import type { CoreResources } from './resources';

const CORE_COLLAPSES = [
  ['food', 'famine'],
  ['production', 'ruin'],
  ['money', 'bankruptcy'],
  ['science', 'dark_age'],
  ['military', 'revolt'],
] as const;

export type CollapseReason = (typeof CORE_COLLAPSES)[number][1];

/** Returns the collapse reason if any core resource is negative, null otherwise. */
export function coreCollapse(resources: CoreResources): CollapseReason | null {
  for (const [resource, reason] of CORE_COLLAPSES) {
    if (resources[resource] < 0) return reason;
  }
  return null;
}
