import {
  applyPendingBroadcastSiteResult as applyBroadcastSiteResultMutation,
  buildPendingBroadcastSummary as buildBroadcastSummary,
} from "../../../shared/broadcast/state";
import { appendPromptHistory } from "../../../shared/prompts";
import { enqueueUiToast } from "../../../shared/runtime-state";
import { buildSiteResult } from "../../app/injection-helpers";
import type {
  LastBroadcastSummary,
  PendingBroadcastRecord,
  SiteInjectionResult,
} from "../../../shared/types/models";
import type { PendingBroadcastControllerDeps } from "./types";

export interface BroadcastCompletionDeps
  extends Pick<
    PendingBroadcastControllerDeps,
    | "queueBackgroundStateMutation"
    | "clonePlainValue"
    | "nowIso"
    | "getI18nMessage"
    | "handleFavoriteBroadcastCompletion"
    | "resolveBroadcastCompletionWaiter"
    | "autoCaptureBroadcastResponses"
    | "suppressedCompletedBroadcastIds"
    | "maybeCreateBroadcastNotification"
  > {
  syncLastBroadcast: (summary: LastBroadcastSummary | null) => Promise<void>;
  restoreBroadcastFocus: (
    record: PendingBroadcastRecord | null | undefined,
  ) => Promise<void>;
}

export function createBroadcastCompletion(deps: BroadcastCompletionDeps) {
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

  async function recordBroadcastSiteResult(
    broadcastId: string,
    siteId: string,
    resultInput: string | SiteInjectionResult,
  ): Promise<LastBroadcastSummary | null> {
    const result = typeof resultInput === "string"
      ? buildSiteResult(resultInput)
      : buildSiteResult(resultInput?.code ?? resultInput, resultInput ?? {});

    try {
      const mutationResult = await deps.queueBackgroundStateMutation((state) => {
        const record = state.pendingBroadcasts[broadcastId];
        if (!record) {
          return {
            summary: null,
            completedRecord: null,
          };
        }

        if (record.siteResults?.[siteId]) {
          return {
            summary: buildBroadcastSummary(record, {}, deps.nowIso()),
            completedRecord: null,
          };
        }

        const mutation = applyBroadcastSiteResultMutation(record, siteId, result, deps.nowIso());
        if (mutation.nextRecord) {
          state.pendingBroadcasts[broadcastId] = mutation.nextRecord;
        } else {
          delete state.pendingBroadcasts[broadcastId];
        }

        return {
          summary: mutation.summary,
          completedRecord: mutation.completedRecord ? deps.clonePlainValue(mutation.completedRecord) : null,
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
                deps.getI18nMessage("toast_prompt_history_save_failed") ||
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
        const suppressCompletionEffects = deps.suppressedCompletedBroadcastIds.has(broadcastId);
        deps.suppressedCompletedBroadcastIds.delete(broadcastId);

        await runSideEffect("syncLastBroadcast", async () => {
          await deps.syncLastBroadcast(summary);
        });
        await runSideEffect("handleFavoriteBroadcastCompletion", async () => {
          await deps.handleFavoriteBroadcastCompletion(summary);
        });
        deps.resolveBroadcastCompletionWaiter(broadcastId, summary);

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
          void deps.autoCaptureBroadcastResponses(historyItem, completedRecord).catch((error) => {
            console.warn("[AI Prompt Broadcaster] Automatic response capture failed.", error);
            void enqueueUiToast({
              message:
                deps.getI18nMessage("toast_auto_capture_save_failed") ||
                "Automatic response capture could not be saved.",
              type: "warning",
              duration: 7000,
            }).catch(() => undefined);
          });
        });
        await runSideEffect("restoreBroadcastFocus", async () => {
          await deps.restoreBroadcastFocus(completedRecord);
        });
        await runSideEffect("maybeCreateBroadcastNotification", async () => {
          await deps.maybeCreateBroadcastNotification(summary);
        });
      } else {
        await runSideEffect("syncLastBroadcast", async () => {
          await deps.syncLastBroadcast(summary);
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

  return {
    finalizeBroadcastSites,
    recordBroadcastSiteResult,
  };
}
