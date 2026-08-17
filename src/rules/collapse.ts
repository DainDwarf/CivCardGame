import { CORE_KEYS, type CoreResources, type StrategicResources } from './resources';

export type CoreCollapseReason = 'famine' | 'ruin' | 'bankruptcy' | 'dark_age' | 'revolt';
export type CollapseReason = CoreCollapseReason | 'extinction';

/** The collapse a core resource triggers when it runs negative. `coreCollapse` walks it in
 *  `CORE_KEYS` order, so food's famine is reported first when several pools are negative at once. */
export const COLLAPSE_BY_RESOURCE: Record<keyof CoreResources, CoreCollapseReason> = {
  food: 'famine',
  production: 'ruin',
  science: 'dark_age',
  military: 'revolt',
  money: 'bankruptcy',
};

/** Returns the collapse reason if any core resource is negative, null otherwise. */
export function coreCollapse(resources: CoreResources): CoreCollapseReason | null {
  for (const key of CORE_KEYS) {
    if (resources[key] < 0) return COLLAPSE_BY_RESOURCE[key];
  }
  return null;
}

/** The strategic counterpart: a civilization with nobody left in it. Fatal *at* zero, where a core
 *  pool is fatal only below it. */
export function populationCollapse(resources: StrategicResources): 'extinction' | null {
  return resources.population <= 0 ? 'extinction' : null;
}
