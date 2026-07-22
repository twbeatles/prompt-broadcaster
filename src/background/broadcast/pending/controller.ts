import { buildQueueTargetSnapshots } from "../../../shared/broadcast/target-snapshots";
import {
  applyPendingBroadcastSiteResult as applyBroadcastSiteResultMutation,
  buildPendingBroadcastSummary as buildBroadcastSummary,
  getUnresolvedPendingBroadcastSiteIds as getUnresolvedBroadcastSiteIds,
} from "../../../shared/broadcast/state";
import { appendPromptHistory } from "../../../shared/prompts";
import {
  enqueueUiToast,
  getLastBroadcast,
  setLastBroadcast,
} from "../../../shared/runtime-state";
import { PENDING_TIMEOUT_MS } from "../../app/constants";
import { buildSiteResult } from "../../app/injection-helpers";
import type { ResolvedBroadcastTarget } from "../../app/bootstrap/tab-targets";
import type { BackgroundSessionState } from "../../../shared/types/background";
import type {
  LastBroadcastSummary,
  PendingBroadcastRecord,
  PendingInjectionRecord,
  PromptHistoryItem,
  SiteInjectionResult,
} from "../../../shared/types/models";

import type { PendingBroadcastControllerDeps } from "./types";

export function createPendingBroadcastController(deps: PendingBroadcastControllerDeps) {
  const {
    getI18nMessage,
    nowIso,
    clonePlainValue,
    getBroadcastTriggerLabel,
    queueBackgroundStateMutation,
    getPendingBroadcasts,
    getPendingInjections,
    removePendingInjection,
    activeInjections,
    suppressedCompletedBroadcastIds,
    getFocusedTabContext,
    restoreFocusedTabContext,
    applyBadgeForBroadcast,
    maybeCreateBroadcastNotification,
    handleFavoriteBroadcastCompletion,
    resolveBroadcastCompletionWaiter,
    autoCaptureBroadcastResponses,
  } = deps;

  async function syncLastBroadcast(summary: LastBroadcastSummary | null): Promise<void> {
    await setLastBroadcast(summary);
    await applyBadgeForBroadcast(summary);
  }

  function getBroadcastAgeMs(record: PendingBroadcastRecord | null | undefined): number {
    const startedAtMs = Date.parse(record?.startedAt ?? "");
    return Number.isFinite(startedAtMs) ? Date.now() - startedAtMs : 0;
  }

  async function finalizeBroadcastSites(
    broadcastId: string,
    siteIds: string[],
    status: string | SiteInjectionResult,
  ): Promise<LastBroadcastSummary | null> {
    let lastSummary: LastBroadcastSummary | null = null;

    for (const siteId of Array.isArray(siteIds) ? siteIds : []) {
      lastSummary = (await recordBroadcastSiteResult(broadcastId, siteId, status)) ?? lastSummary;
    }

    return lastSummary;
  }

  async function closeTabQuietly(tabId: number): Promise<void> {
    try {
      await chrome.tabs.remove(tabId);
    } catch (_error) {
      // Ignore already-closed tabs.
    }
  }

  async function restoreBroadcastFocus(record: PendingBroadcastRecord | null | undefined): Promise<void> {
    if (!record) {
      return;
    }

    await restoreFocusedTabContext({
      tabId: Number.isFinite(Number(record.originTabId)) ? Number(record.originTabId) : null,
      windowId: Number.isFinite(Number(record.originWindowId)) ? Number(record.originWindowId) : null,
    });
  }

  async function createPendingBroadcast(
    prompt: string,
    targets: ResolvedBroadcastTarget[],
    metadata: Record<string, unknown> = {},
  ): Promise<PendingBroadcastRecord> {
    const pendingInjections = await getPendingInjections();
    if (Object.keys(pendingInjections).length > 0) {
      console.warn("[AI Prompt Broadcaster] Starting a new broadcast while pending tabs still exist.", pendingInjections);
    }

    const originContext = await getFocusedTabContext();
    const sites = Array.isArray(targets) ? targets.map((target) => target.site).filter(Boolean) : [];
    const broadcastId =
      typeof crypto?.randomUUID === "function"
        ? crypto.randomUUID()
        : `broadcast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const record: PendingBroadcastRecord = {
      id: broadcastId,
      prompt,
      siteIds: sites.map((site) => site.id),
      total: sites.length,
      completed: 0,
      submittedSiteIds: [],
      failedSiteIds: [],
      siteResults: {},
      targetSnapshots: buildQueueTargetSnapshots(targets, prompt),
      startedAt: nowIso(),
      status: "sending",
      originTabId: originContext?.tabId ?? null,
      originWindowId: originContext?.windowId ?? null,
      openedTabIds: [],
      targetTabIdsBySiteId: {},
      originFavoriteId:
        typeof metadata.originFavoriteId === "string" && metadata.originFavoriteId.trim()
          ? metadata.originFavoriteId.trim()
          : null,
      chainRunId:
        typeof metadata.chainRunId === "string" && metadata.chainRunId.trim()
          ? metadata.chainRunId.trim()
          : null,
      chainStepIndex: Number.isFinite(Number(metadata.chainStepIndex))
        ? Math.max(0, Math.round(Number(metadata.chainStepIndex)))
        : null,
      chainStepCount: Number.isFinite(Number(metadata.chainStepCount))
        ? Math.max(0, Math.round(Number(metadata.chainStepCount)))
        : null,
      experimentRunId:
        typeof metadata.experimentRunId === "string" && metadata.experimentRunId.trim()
          ? metadata.experimentRunId.trim()
          : null,
      trigger: getBroadcastTriggerLabel(metadata.trigger),
    };

    await queueBackgroundStateMutation((state) => {
      state.pendingBroadcasts[broadcastId] = record;
      return clonePlainValue(record);
    });
    await syncLastBroadcast(buildBroadcastSummary(record, { finishedAt: "" }, nowIso()));
    return record;
  }


  async function recordBroadcastSiteResult(
    broadcastId: string,
    siteId: string,
    resultInput: string | SiteInjectionResult,
  ): Promise<LastBroadcastSummary | null> {
    const result = typeof resultInput === "string"
      ? buildSiteResult(resultInput)
      : buildSiteResult(resultInput?.code ?? resultInput, resultInput ?? {});

    try {
      const mutationResult = await queueBackgroundStateMutation((state) => {
        const record = state.pendingBroadcasts[broadcastId];
        if (!record) {
          return {
            summary: null,
            completedRecord: null,
          };
        }

        if (record.siteResults?.[siteId]) {
          return {
            summary: buildBroadcastSummary(record, {}, nowIso()),
            completedRecord: null,
          };
        }

        const mutation = applyBroadcastSiteResultMutation(record, siteId, result, nowIso());
        if (mutation.nextRecord) {
          state.pendingBroadcasts[broadcastId] = mutation.nextRecord;
        } else {
          delete state.pendingBroadcasts[broadcastId];
        }

        return {
          summary: mutation.summary,
          completedRecord: mutation.completedRecord ? clonePlainValue(mutation.completedRecord) : null,
        };
      });

      if (!mutationResult?.summary) {
        return null;
      }

      const { summary, completedRecord } = mutationResult;

      const runSideEffect = async (
        label: string,
        effect: () => Promise<void>,
      ): Promise<void> => {
        try {
          await effect();
        } catch (sideEffectError) {
          if (label === "appendPromptHistory") {
            await enqueueUiToast({
              message:
                getI18nMessage("toast_prompt_history_save_failed") ||
                "Broadcast finished, but prompt history could not be saved.",
              type: "error",
              duration: 7000,
            });
          }
          console.error("[AI Prompt Broadcaster] Broadcast completion side effect failed.", {
            broadcastId,
            siteId,
            result,
            label,
            sideEffectError,
          });
        }
      };

      if (completedRecord) {
        const suppressCompletionEffects = suppressedCompletedBroadcastIds.has(broadcastId);
        suppressedCompletedBroadcastIds.delete(broadcastId);

        await runSideEffect("syncLastBroadcast", async () => {
          await syncLastBroadcast(summary);
        });
        await runSideEffect("handleFavoriteBroadcastCompletion", async () => {
          await handleFavoriteBroadcastCompletion(summary);
        });
        resolveBroadcastCompletionWaiter(broadcastId, summary);

        if (suppressCompletionEffects) {
          return summary;
        }

        await runSideEffect("appendPromptHistory", async () => {
          const historyItem = await appendPromptHistory({
            id: Date.now(),
            text: completedRecord.prompt,
            requestedSiteIds: completedRecord.siteIds,
            submittedSiteIds: completedRecord.submittedSiteIds,
            failedSiteIds: completedRecord.failedSiteIds,
            sentTo: completedRecord.submittedSiteIds,
            createdAt: completedRecord.startedAt,
            status: summary.status,
            siteResults: completedRecord.siteResults,
            targetSnapshots: completedRecord.targetSnapshots,
            originFavoriteId: completedRecord.originFavoriteId ?? null,
            chainRunId: completedRecord.chainRunId ?? null,
            chainStepIndex: completedRecord.chainStepIndex ?? null,
            chainStepCount: completedRecord.chainStepCount ?? null,
            experimentRunId: completedRecord.experimentRunId ?? null,
            trigger: completedRecord.trigger ?? "popup",
          });
          void autoCaptureBroadcastResponses(historyItem, completedRecord).catch((error) => {
            console.warn("[AI Prompt Broadcaster] Automatic response capture failed.", error);
            void enqueueUiToast({
              message:
                getI18nMessage("toast_auto_capture_save_failed") ||
                "Automatic response capture could not be saved.",
              type: "warning",
              duration: 7000,
            }).catch(() => undefined);
          });
        });
        await runSideEffect("restoreBroadcastFocus", async () => {
          await restoreBroadcastFocus(completedRecord);
        });
        await runSideEffect("maybeCreateBroadcastNotification", async () => {
          await maybeCreateBroadcastNotification(summary);
        });
      } else {
        await runSideEffect("syncLastBroadcast", async () => {
          await syncLastBroadcast(summary);
        });
      }

      return summary;
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to record broadcast site result.", {
        broadcastId,
        siteId,
        result,
        error,
      });
      return null;
    }
  }

  async function cancelBroadcast(
    broadcastId: string,
    reason = "cancelled",
  ): Promise<LastBroadcastSummary | null> {
    const normalizedBroadcastId = typeof broadcastId === "string" ? broadcastId.trim() : "";
    if (!normalizedBroadcastId) {
      return null;
    }

    const pendingBroadcastsBeforeCancel = await getPendingBroadcasts();
    const recordBeforeCancel = pendingBroadcastsBeforeCancel[normalizedBroadcastId] ?? null;

    const pendingInjections = await getPendingInjections();
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

      await removePendingInjection(tabId);
      activeInjections.delete(tabId);

      if (job?.closeOnCancel !== false && Number.isFinite(tabId)) {
        tabsToClose.add(tabId);
      }
    }

    let lastSummary: LastBroadcastSummary | null = null;
    lastSummary = (await finalizeBroadcastSites(
      normalizedBroadcastId,
      [...pendingSiteIds],
      buildSiteResult(reason === "reset" ? "cancelled" : reason)
    )) ?? lastSummary;

    const refreshedPendingBroadcasts = await getPendingBroadcasts();
    const record = refreshedPendingBroadcasts[normalizedBroadcastId];
    const unresolvedSiteIds = getUnresolvedBroadcastSiteIds(record).filter((siteId) => !pendingSiteIds.has(siteId));
    lastSummary = (await finalizeBroadcastSites(
      normalizedBroadcastId,
      unresolvedSiteIds,
      buildSiteResult(reason === "reset" ? "cancelled" : reason)
    )) ?? lastSummary;

    await Promise.all([...tabsToClose].map(async (tabId) => closeTabQuietly(Number(tabId))));

    await restoreBroadcastFocus(recordBeforeCancel);

    const fallbackSummary = await getLastBroadcast();
    const summary = lastSummary ?? fallbackSummary;

    if (reason !== "reset") {
      await enqueueUiToast({
        message:
          getI18nMessage("toast_broadcast_cancelled") ||
          "Broadcast cancelled.",
        type: "warning",
        duration: 5000,
        meta: {
          broadcastId: normalizedBroadcastId,
          reason,
        },
      });
    }

    resolveBroadcastCompletionWaiter(normalizedBroadcastId, summary ?? null);
    return summary;
  }

  async function reconcilePendingBroadcasts(): Promise<void> {
    const pendingBroadcasts = await getPendingBroadcasts();
    const pendingInjections = await getPendingInjections();

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
        await finalizeBroadcastSites(broadcastId, unresolvedSiteIds, "broadcast_stale");
        continue;
      }

      if (getBroadcastAgeMs(record) <= PENDING_TIMEOUT_MS) {
        continue;
      }

      for (const [tabIdKey] of relatedJobs) {
        const tabId = Number(tabIdKey);
        await removePendingInjection(tabId);
        activeInjections.delete(tabId);
        await closeTabQuietly(tabId);
      }

      await finalizeBroadcastSites(broadcastId, unresolvedSiteIds, "injection_timeout");
    }
  }

  return {
    syncLastBroadcast,
    createPendingBroadcast,
    recordBroadcastSiteResult,
    finalizeBroadcastSites,
    cancelBroadcast,
    reconcilePendingBroadcasts,
    closeTabQuietly,
    restoreBroadcastFocus,
    getBroadcastAgeMs,
  };
}
