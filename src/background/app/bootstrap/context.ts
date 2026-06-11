import type { BackgroundBroadcastWaiter } from "../../../shared/types/background";
import type { LastBroadcastSummary } from "../../../shared/types/models";

export interface BackgroundAppContext {
  activeInjections: Set<number>;
  queuedInjectionTabIds: Set<number>;
  broadcastCompletionWaiters: Map<string, BackgroundBroadcastWaiter<LastBroadcastSummary>>;
  selectionCache: Map<number, string>;
  suppressedCompletedBroadcastIds: Set<string>;
}

export function createBackgroundAppContext(): BackgroundAppContext {
  return {
    activeInjections: new Set<number>(),
    queuedInjectionTabIds: new Set<number>(),
    broadcastCompletionWaiters: new Map<string, BackgroundBroadcastWaiter<LastBroadcastSummary>>(),
    selectionCache: new Map<number, string>(),
    suppressedCompletedBroadcastIds: new Set<string>(),
  };
}
