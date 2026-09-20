import { getTemplateVariableCache } from "../../../../shared/prompts";
import {
  enqueueUiToast,
  setPopupFavoriteIntent,
} from "../../../../shared/runtime-state";
import type {
  FavoriteExecutionTrigger,
  FavoritePrompt,
  FavoriteRunExecutionContextSnapshot,
} from "../../../../shared/types/models";
import type { FavoriteWorkflowEntryPointDeps } from "./types";
import type { MaybeCreateFavoriteFailureNotification } from "./notifications";

export interface EnqueueFavoriteRunOptions {
  trigger: FavoriteExecutionTrigger;
  sender?: chrome.runtime.MessageSender;
  allowPopupFallback?: boolean;
  preparedExecutionContext?: Partial<FavoriteRunExecutionContextSnapshot>;
}

export type EnqueueFavoriteRunResult =
  | {
      ok: boolean;
      deduped: boolean;
      jobId: string;
      message: string;
    }
  | {
      ok: false;
      reason?: string;
      error?: string;
    }
  | {
      ok: false;
      requiresPopupInput: true;
      reason?: string;
      error?: string;
    };

export type EnqueueFavoriteRun = (
  favorite: FavoritePrompt,
  options: EnqueueFavoriteRunOptions,
) => Promise<EnqueueFavoriteRunResult>;

export type StorePopupFavoriteIntentAndOpen = (
  favoriteId: string,
  type: "edit" | "run",
  source: FavoriteExecutionTrigger | "options-edit",
  reason?: string,
) => Promise<void>;

export interface FavoriteRunEnqueueDeps
  extends Pick<
    FavoriteWorkflowEntryPointDeps,
    | "getBroadcastTriggerLabel"
    | "openPopupWithPrompt"
    | "nowIso"
    | "buildChainRunId"
    | "getWorkflowMessage"
    | "getFavoriteExecutionSteps"
    | "detectFavoriteExecutionBlockers"
    | "createEmptyExecutionContext"
    | "normalizePreparedExecutionContext"
    | "mergeExecutionContext"
    | "getExecutionTabContextFromSender"
    | "queueFavoriteRunJob"
    | "createFavoriteFailureHistory"
  > {
  maybeCreateFavoriteFailureNotification: MaybeCreateFavoriteFailureNotification;
}

export function createFavoriteRunEnqueue(deps: FavoriteRunEnqueueDeps) {
  async function storePopupFavoriteIntentAndOpen(
    favoriteId: string,
    type: "edit" | "run",
    source: FavoriteExecutionTrigger | "options-edit",
    reason = "",
  ) {
    await setPopupFavoriteIntent({
      type,
      favoriteId,
      source,
      reason,
      createdAt: deps.nowIso(),
    });
    await deps.openPopupWithPrompt("");
  }

  async function enqueueFavoriteRun(
    favorite: FavoritePrompt,
    options: EnqueueFavoriteRunOptions,
  ): Promise<EnqueueFavoriteRunResult> {
    const trigger = deps.getBroadcastTriggerLabel(options.trigger);
    const preparedExecutionContext = deps.normalizePreparedExecutionContext(
      options.preparedExecutionContext,
    );
    const baseExecutionContext =
      trigger === "scheduled"
        ? deps.createEmptyExecutionContext()
        : await deps.getExecutionTabContextFromSender(options.sender);
    const executionContext = deps.mergeExecutionContext(
      baseExecutionContext,
      preparedExecutionContext.context,
    );
    const templateVariableCache = await getTemplateVariableCache().catch(() => ({}));
    const validation = deps.detectFavoriteExecutionBlockers(
      favorite,
      executionContext,
      templateVariableCache,
      trigger,
      {
        hasPreparedClipboardValue: preparedExecutionContext.hasClipboardValue,
      },
    );

    if (!validation.ok) {
      if (trigger === "scheduled") {
        const chainRunId = favorite?.mode === "chain" ? deps.buildChainRunId() : null;
        await deps.createFavoriteFailureHistory({
          favoriteId: favorite?.id ?? null,
          message: validation.message,
          requestedSiteIds:
            validation.failingStepTargetSiteIds ??
            deps.getFavoriteExecutionSteps(favorite)[0]?.targetSiteIds ??
            favorite?.sentTo ??
            [],
          text:
            validation.failingStepText ??
            deps.getFavoriteExecutionSteps(favorite)[0]?.text ??
            favorite?.text ??
            "",
          trigger,
          chainRunId,
          chainStepIndex:
            favorite?.mode === "chain" ? validation.failingStepIndex ?? 0 : null,
          chainStepCount:
            favorite?.mode === "chain"
              ? deps.getFavoriteExecutionSteps(favorite).length
              : null,
        });
        await enqueueUiToast({
          message:
            validation.message ??
            deps.getWorkflowMessage(
              "favorite_run_error_start_failed",
              [],
              "Favorite execution could not start.",
            ),
          type: "warning",
          duration: 5000,
        });
        await deps.maybeCreateFavoriteFailureNotification(
          favorite,
          validation.message ??
            deps.getWorkflowMessage(
              "favorite_run_error_start_failed",
              [],
              "Favorite execution could not start.",
            ),
        );
        return {
          ok: false,
          reason: validation.reason,
          error: validation.message,
        };
      }

      return {
        ok: false,
        requiresPopupInput: true,
        reason: validation.reason,
        error: validation.message,
      };
    }

    return deps.queueFavoriteRunJob(
      favorite,
      trigger,
      executionContext,
      validation.steps ?? [],
      validation.defaults ?? {},
    );
  }

  return {
    storePopupFavoriteIntentAndOpen,
    enqueueFavoriteRun,
  };
}
