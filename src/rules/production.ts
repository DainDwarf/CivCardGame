import { resolveProduction } from './effects';
import { isOperating } from './population';
import type { BuildingInstance, GameState, WorkInstance } from './state';

/** Resolve one round's production for every OPERATING (staffed) instance in a zone — each
 *  instance's own `produce` (or the declarative default) computes and applies its output, the
 *  same resolver spine `tickThreats` reuses for threats. An idle instance never ticks (filtered
 *  here, not inside the resolver), so a future counter-driven `produce` can't escalate while
 *  unstaffed. */
function resolveZoneProduction(G: GameState, zone: readonly (BuildingInstance | WorkInstance)[]): void {
  for (const inst of zone) if (isOperating(inst)) resolveProduction({ G, self: inst });
}

/** Per-round production tick for every staffed building in the tableau. */
export function applyTableauProduction(G: GameState): void {
  resolveZoneProduction(G, G.tableau);
}

/** Per-round production tick for every staffed Work card in the workZone. */
export function applyWorkZoneProduction(G: GameState): void {
  resolveZoneProduction(G, G.workZone);
}
