import { CORE_KEYS, type CoreResources } from './resources';

export type CollapseReason = 'famine' | 'ruin' | 'bankruptcy' | 'dark_age' | 'revolt';

/** The collapse a core resource triggers when it runs negative. `coreCollapse` walks it in
 *  `CORE_KEYS` order, so food's famine is reported first when several pools are negative at once. */
export const COLLAPSE_BY_RESOURCE: Record<keyof CoreResources, CollapseReason> = {
  food: 'famine',
  production: 'ruin',
  science: 'dark_age',
  military: 'revolt',
  money: 'bankruptcy',
};

/** Returns the collapse reason if any core resource is negative, null otherwise. */
export function coreCollapse(resources: CoreResources): CollapseReason | null {
  for (const key of CORE_KEYS) {
    if (resources[key] < 0) return COLLAPSE_BY_RESOURCE[key];
  }
  return null;
}
