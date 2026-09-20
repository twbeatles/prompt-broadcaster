import { buildQueueTargetSnapshots } from "../../../shared/broadcast/target-snapshots";
import {
  buildPendingBroadcastSummary as buildBroadcastSummary,
} from "../../../shared/broadcast/state";
import type { ResolvedBroadcastTarget } from "../../app/bootstrap/tab-targets";
import type {
  LastBroadcastSummary,
  PendingBroadcastRecord,
} from "../../../shared/types/models";
import type { PendingBroadcastControllerDeps } from "./types";

export interface PendingBroadcastLifecycleDeps
  extends Pick<
    PendingBroadcastControllerDeps,
    | "getPendingInjections"
    | "getFocusedTabContext"
    | "queueBackgroundStateMutation"
    | "clonePlainValue"
    | "nowIso"
    | "getBroadcastTriggerLabel"
  > {
  syncLastBroadcast: (
    summary: LastBroadcastSummary | null,
  ) => Promise<void>;
}

export function createPendingBroadcastLifecycle(
  deps: PendingBroadcastLifecycleDeps,
) {
  async function createPendingBroadcast(
    prompt: string,
    targets: ResolvedBroadcastTarget[],
    metadata: Record<string, unknown> = {},
  ): Promise<PendingBroadcastRecord> {
    const pendingInjections = await deps.getPendingInjections();
    if (Object.keys(pendingInjections).length > 0) {
      console.warn("[AI Prompt Broadcaster] Starting a new broadcast while pending tabs still exist.", pendingInjections);
    }

    const originContext = await deps.getFocusedTabContext();
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
      startedAt: deps.nowIso(),
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
      trigger: deps.getBroadcastTriggerLabel(metadata.trigger),
    };

    await deps.queueBackgroundStateMutation((state) => {
      state.pendingBroadcasts[broadcastId] = record;
      return deps.clonePlainValue(record);
    });
    await deps.syncLastBroadcast(buildBroadcastSummary(record, { finishedAt: "" }, deps.nowIso()));
    return record;
  }

  return {
    createPendingBroadcast,
  };
}
