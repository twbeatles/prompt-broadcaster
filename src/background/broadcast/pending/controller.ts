import { createBroadcastCompletion } from "./completion";
import { createPendingBroadcastLifecycle } from "./lifecycle";
import { createBroadcastMaintenance } from "./maintenance";
import {
  closeTabQuietly,
  createBroadcastSupport,
  getBroadcastAgeMs,
} from "./support";
import type { PendingBroadcastControllerDeps } from "./types";

export function createPendingBroadcastController(deps: PendingBroadcastControllerDeps) {
  const support = createBroadcastSupport(deps);
  const completion = createBroadcastCompletion({
    ...deps,
    syncLastBroadcast: support.syncLastBroadcast,
    restoreBroadcastFocus: support.restoreBroadcastFocus,
  });
  const lifecycle = createPendingBroadcastLifecycle({
    ...deps,
    syncLastBroadcast: support.syncLastBroadcast,
  });
  const maintenance = createBroadcastMaintenance({
    ...deps,
    finalizeBroadcastSites: completion.finalizeBroadcastSites,
    restoreBroadcastFocus: support.restoreBroadcastFocus,
  });

  return {
    syncLastBroadcast: support.syncLastBroadcast,
    createPendingBroadcast: lifecycle.createPendingBroadcast,
    recordBroadcastSiteResult: completion.recordBroadcastSiteResult,
    finalizeBroadcastSites: completion.finalizeBroadcastSites,
    cancelBroadcast: maintenance.cancelBroadcast,
    reconcilePendingBroadcasts: maintenance.reconcilePendingBroadcasts,
    closeTabQuietly,
    restoreBroadcastFocus: support.restoreBroadcastFocus,
    getBroadcastAgeMs,
  };
}
