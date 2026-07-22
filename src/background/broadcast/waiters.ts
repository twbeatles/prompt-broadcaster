import type { BackgroundBroadcastWaiter } from "../../shared/types/background";
import type { LastBroadcastSummary } from "../../shared/types/models";

export interface BroadcastWaiterRegistry {
  register: (broadcastId: string) => Promise<LastBroadcastSummary | null>;
  resolve: (
    broadcastId: string,
    summary?: LastBroadcastSummary | null,
  ) => void;
  has: (broadcastId: string) => boolean;
}

/**
 * Session-scoped waiters for favorite/experiment flows that need to await
 * broadcast completion without polling storage.
 */
export function createBroadcastWaiterRegistry(
  waiters: Map<string, BackgroundBroadcastWaiter<LastBroadcastSummary>>,
): BroadcastWaiterRegistry {
  function register(broadcastId: string): Promise<LastBroadcastSummary | null> {
    const normalizedBroadcastId =
      typeof broadcastId === "string" ? broadcastId.trim() : "";
    if (!normalizedBroadcastId) {
      return Promise.resolve(null);
    }

    const existing = waiters.get(normalizedBroadcastId);
    if (existing?.promise) {
      return existing.promise;
    }

    let resolvePromise: ((summary: LastBroadcastSummary | null) => void) | null = null;
    const promise = new Promise<LastBroadcastSummary | null>((resolve) => {
      resolvePromise = resolve;
    });

    if (resolvePromise) {
      waiters.set(normalizedBroadcastId, {
        promise,
        resolve: resolvePromise,
      });
    }

    return promise;
  }

  function resolve(
    broadcastId: string,
    summary: LastBroadcastSummary | null = null,
  ): void {
    const normalizedBroadcastId =
      typeof broadcastId === "string" ? broadcastId.trim() : "";
    if (!normalizedBroadcastId) {
      return;
    }

    const existing = waiters.get(normalizedBroadcastId);
    if (!existing?.resolve) {
      return;
    }

    existing.resolve(summary);
    waiters.delete(normalizedBroadcastId);
  }

  function has(broadcastId: string): boolean {
    const normalizedBroadcastId =
      typeof broadcastId === "string" ? broadcastId.trim() : "";
    return normalizedBroadcastId ? waiters.has(normalizedBroadcastId) : false;
  }

  return { register, resolve, has };
}
