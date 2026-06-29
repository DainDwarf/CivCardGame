/** The resource currencies a civilization accumulates. */
export interface Resources {
  food: number;
  production: number;
  science: number;
}

export function emptyResources(): Resources {
  return { food: 0, production: 0, science: 0 };
}

/** Mutates and returns `target` with `delta` added in. */
export function addResources(target: Resources, delta: Partial<Resources>): Resources {
  target.food += delta.food ?? 0;
  target.production += delta.production ?? 0;
  target.science += delta.science ?? 0;
  return target;
}

export function canAfford(resources: Resources, cost: number): boolean {
  return resources.production >= cost;
}
