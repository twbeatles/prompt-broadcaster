import {
  getUnresolvedPendingBroadcastSiteIds as getUnresolvedBroadcastSiteIds,
} from "../../../shared/broadcast/state";
import {
  enqueueUiToast,
  getLastBroadcast,
} from "../../../shared/runtime-state";
import { PENDING_TIMEOUT_MS } from "../../app/constants";
import { buildSiteResult } from "../../app/injection-helpers";
import type {
  LastBroadcastSummary,
  PendingBroadcastRecord,
  PendingInjectionRecord,
  SiteInjectionResult,
} from "../../../shared/types/models";
import { closeTabQuietly, getBroadcastAgeMs } from "./support";
import type { PendingBroadcastControllerDeps } from "./types";

export interface BroadcastMaintenanceDeps
  extends Pick<
    PendingBroadcastControllerDeps,
    | "getI18nMessage"
    | "getPendingBroadcasts"
    | "getPendingInjections"
    | "removePendingInjection"
    | "activeInjections"
    | "suppressedCompletedBroadcastIds"
  > {
  finalizeBroadcastSites: (
    broadcastId: string,
    siteIds: string[],
    status: string | SiteInjectionResult,
  ) => Promise<LastBroadcastSummary | null>;
  restoreBroadcastFocus: (
    record: PendingBroadcastRecord | null | undefined,
  ) => Promise<void>;
  resolveBroadcastCompletionWaiter: (
    broadcastId: string,
    summary?: LastBroadcastSummary | null,
  ) => void;
}

export function createBroadcastMaintenance(deps: BroadcastMaintenanceDeps) {
  async function cancelBroadcast(
    broadcastId: string,
    reason = "cancelled",
  ): Promise<LastBroadcastSummary | null> {
    const normalizedBroadcastId = typeof broadcastId === "string" ? broadcastId.trim() : "";
    if (!normalizedBroadcastId) {
      return null;
    }

    const pendingBroadcastsBeforeCancel = await deps.getPendingBroadcasts();
    const recordBeforeCancel = pendingBroadcastsBeforeCancel[normalizedBroadcastId] ?? null;

    const pendingInjections = await deps.getPendingInjections();
    const matchingJobs = Object.entries(pendingInjections).filter(([, job]) =>
      job?.broadcastId === normalizedBroadcastId
    );

    const pendingSiteIds = new Set<string>();
    const tabsToClose = new Set(
      Array.isArray(recordBeforeCancel?.openedTabIds)
        ? recordBeforeCancel.openedTabIds
          .map((tabId) => Number(tabId))
          .filter((tabId) => Number.isFinite(tabId))
        : []
    );
    for (const [tabIdKey, job] of matchingJobs) {
      const tabId = Number(tabIdKey);
      if (job?.siteId) {
        pendingSiteIds.add(job.siteId);
      }

      await deps.removePendingInjection(tabId);
      deps.activeInjections.delete(tabId);

      if (job?.closeOnCancel !== false && Number.isFinite(tabId)) {
        tabsToClose.add(tabId);
      }
    }

    let lastSummary: LastBroadcastSummary | null = null;
    lastSummary = (await deps.finalizeBroadcastSites(
      normalizedBroadcastId,
      [...pendingSiteIds],
      buildSiteResult(reason === "reset" ? "cancelled" : reason)
    )) ?? lastSummary;

    const refreshedPendingBroadcasts = await deps.getPendingBroadcasts();
    const record = refreshedPendingBroadcasts[normalizedBroadcastId];
    const unresolvedSiteIds = getUnresolvedBroadcastSiteIds(record).filter((siteId) => !pendingSiteIds.has(siteId));
    lastSummary = (await deps.finalizeBroadcastSites(
      normalizedBroadcastId,
      unresolvedSiteIds,
      buildSiteResult(reason === "reset" ? "cancelled" : reason)
    )) ?? lastSummary;

    await Promise.all([...tabsToClose].map(async (tabId) => closeTabQuietly(Number(tabId))));

    await deps.restoreBroadcastFocus(recordBeforeCancel);

    const fallbackSummary = await getLastBroadcast();
    const summary = lastSummary ?? fallbackSummary;

    if (reason !== "reset") {
      await enqueueUiToast({
        message:
          deps.getI18nMessage("toast_broadcast_cancelled") ||
          "Broadcast cancelled.",
        type: "warning",
        duration: 5000,
        meta: {
          broadcastId: normalizedBroadcastId,
          reason,
        },
      });
    }

    deps.resolveBroadcastCompletionWaiter(normalizedBroadcastId, summary ?? null);
    return summary;
  }

  async function reconcilePendingBroadcasts(): Promise<void> {
    const pendingBroadcasts = await deps.getPendingBroadcasts();
    const pendingInjections = await deps.getPendingInjections();

    const jobsByBroadcastId = new Map<string, Array<[string, PendingInjectionRecord]>>();
    for (const [tabIdKey, job] of Object.entries(pendingInjections)) {
      if (!job?.broadcastId) {
        continue;
      }

      const current = jobsByBroadcastId.get(job.broadcastId) ?? [];
      current.push([tabIdKey, job]);
      jobsByBroadcastId.set(job.broadcastId, current);
    }

    for (const [broadcastId, record] of Object.entries(pendingBroadcasts)) {
      const unresolvedSiteIds = getUnresolvedBroadcastSiteIds(record);
      if (unresolvedSiteIds.length === 0) {
        continue;
      }

      const relatedJobs = jobsByBroadcastId.get(broadcastId) ?? [];
      if (relatedJobs.length === 0) {
        await deps.finalizeBroadcastSites(broadcastId, unresolvedSiteIds, "broadcast_stale");
        continue;
      }

      if (getBroadcastAgeMs(record) <= PENDING_TIMEOUT_MS) {
        continue;
      }

      // An actively injecting tab keeps its own timeout window; tear down only fully stalled broadcasts here.
      const hasActivelyInjectingJob = relatedJobs.some(([, job]) => {
        const injectedAt = Number(job?.startedAt || 0);
        return job?.status === "injecting" && injectedAt > 0 && Date.now() - injectedAt <= PENDING_TIMEOUT_MS;
      });
      if (hasActivelyInjectingJob) {
        continue;
      }

      for (const [tabIdKey, job] of relatedJobs) {
        const tabId = Number(tabIdKey);
        await deps.removePendingInjection(tabId);
        deps.activeInjections.delete(tabId);
        if (job?.closeOnCancel === false) {
          continue;
        }
        await closeTabQuietly(tabId);
      }

      await deps.finalizeBroadcastSites(broadcastId, unresolvedSiteIds, "injection_timeout");
    }
  }

  return {
    cancelBroadcast,
    reconcilePendingBroadcasts,
  };
}
