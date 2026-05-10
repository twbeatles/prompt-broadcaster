import {
  appendPromptHistory,
  normalizeSiteIdList,
} from "../../shared/prompts";
import type {
  FavoriteExecutionTrigger,
  FavoriteRunExecutionContextSnapshot,
} from "../../shared/types/models";
import { buildSiteResult } from "../app/injection-helpers";
import {
  createFavoriteExecutionContextTools,
} from "../favorites/execution-context";
import {
  buildScheduleAlarmName,
  parseScheduleAlarmFavoriteId,
} from "../favorites/schedules";
import {
  createFavoriteTemplateResolutionTools,
} from "../favorites/template-resolution";
import { createFavoriteWorkflowEntryPoints } from "./favorites-workflow/entrypoints";
import { createFavoriteWorkflowMessages } from "./favorites-workflow/messages";
import { createFavoriteRunJobHandlers } from "./favorites-workflow/run-jobs";

interface FavoriteWorkflowDeps {
  getBroadcastTriggerLabel: (trigger: unknown) => FavoriteExecutionTrigger;
  getI18nMessage: (key: string, substitutions?: string[]) => string;
  rememberNormalTab: (
    tab: chrome.tabs.Tab | undefined,
  ) => Promise<chrome.tabs.Tab | null>;
  getPreferredNormalActiveTab: () => Promise<chrome.tabs.Tab | null>;
  isInjectableTabUrl: (url: string) => boolean;
  getSelectedTextFromTab: (tabId: number) => Promise<string>;
  openPopupWithPrompt: (prompt?: string) => Promise<void>;
  nowIso: () => string;
  buildChainRunId: () => string;
  queueBroadcastRequest: (
    prompt: string,
    siteRefs: Array<{ id: string; target?: "new" | "tab" }>,
    metadata?: Record<string, unknown>,
  ) => Promise<{
    ok?: boolean;
    error?: string;
    broadcastId?: string;
  }>;
}

export function createFavoriteWorkflow(deps: FavoriteWorkflowDeps) {
  const {
    getBroadcastTriggerLabel,
    getI18nMessage,
    rememberNormalTab,
    getPreferredNormalActiveTab,
    isInjectableTabUrl,
    getSelectedTextFromTab,
    openPopupWithPrompt,
    nowIso,
    buildChainRunId,
    queueBroadcastRequest,
  } = deps;

  const messages = createFavoriteWorkflowMessages(getI18nMessage);
  const {
    createEmptyExecutionContext,
    normalizePreparedExecutionContext,
    mergeExecutionContext,
    getExecutionTabContextFromSender,
  } = createFavoriteExecutionContextTools({
    rememberNormalTab,
    getPreferredNormalActiveTab,
    isInjectableTabUrl,
    getSelectedTextFromTab,
  });
  const {
    getFavoriteExecutionSteps,
    getFavoriteTargetSiteIds,
    previewFavoriteText,
    detectFavoriteExecutionBlockers,
    buildFavoriteStepPrompt,
  } = createFavoriteTemplateResolutionTools({
    getWorkflowMessage: messages.getWorkflowMessage,
  });

  async function createFavoriteFailureHistory(
    details: {
      favoriteId?: string | null;
      requestedSiteIds?: string[];
      message?: string;
      text?: string;
      chainRunId?: string | null;
      chainStepIndex?: number | null;
      chainStepCount?: number | null;
      trigger?: FavoriteExecutionTrigger;
    } = {},
  ) {
    const requestedSiteIds = normalizeSiteIdList(details.requestedSiteIds ?? []);
    const siteResults = Object.fromEntries(
      requestedSiteIds.map((siteId) => [
        siteId,
        buildSiteResult("unexpected_error", {
          message:
            details.message ||
            messages.getWorkflowMessage(
              "favorite_run_error_start_failed",
              [],
              "Favorite execution could not start.",
            ),
        }),
      ]),
    );

    await appendPromptHistory({
      id: Date.now(),
      text: details.text ?? "",
      requestedSiteIds,
      submittedSiteIds: [],
      failedSiteIds: requestedSiteIds,
      sentTo: [],
      createdAt: nowIso(),
      status: "failed",
      siteResults,
      originFavoriteId: details.favoriteId ?? null,
      chainRunId: details.chainRunId ?? null,
      chainStepIndex: details.chainStepIndex ?? null,
      chainStepCount: details.chainStepCount ?? null,
      trigger: details.trigger ?? "scheduled",
    });
  }

  const favoriteRunJobHandlers = createFavoriteRunJobHandlers({
    nowIso,
    buildChainRunId,
    previewFavoriteText,
    buildFavoriteStepPrompt,
    queueBroadcastRequest,
    createFavoriteFailureHistory,
    ...messages,
  });

  const favoriteWorkflowEntryPoints = createFavoriteWorkflowEntryPoints({
    getBroadcastTriggerLabel,
    openPopupWithPrompt,
    nowIso,
    buildChainRunId,
    getWorkflowMessage: messages.getWorkflowMessage,
    previewFavoriteText,
    getFavoriteExecutionSteps,
    detectFavoriteExecutionBlockers,
    createEmptyExecutionContext,
    normalizePreparedExecutionContext: (
      input?: Partial<FavoriteRunExecutionContextSnapshot>,
    ) => normalizePreparedExecutionContext(input),
    mergeExecutionContext,
    getExecutionTabContextFromSender,
    queueFavoriteRunJob: favoriteRunJobHandlers.queueFavoriteRunJob,
    createFavoriteFailureHistory,
  });

  return {
    buildScheduleAlarmName,
    parseScheduleAlarmFavoriteId,
    getFavoriteExecutionSteps,
    getFavoriteTargetSiteIds,
    previewFavoriteText,
    reconcileFavoriteRunJobs: favoriteRunJobHandlers.reconcileFavoriteRunJobs,
    reconcileFavoriteSchedules:
      favoriteWorkflowEntryPoints.reconcileFavoriteSchedules,
    handleFavoriteScheduleAlarm:
      favoriteWorkflowEntryPoints.handleFavoriteScheduleAlarm,
    handleFavoriteRunMessage:
      favoriteWorkflowEntryPoints.handleFavoriteRunMessage,
    handleFavoriteOpenEditorMessage:
      favoriteWorkflowEntryPoints.handleFavoriteOpenEditorMessage,
    handleQuickPaletteGetState:
      favoriteWorkflowEntryPoints.handleQuickPaletteGetState,
    handleQuickPaletteExecuteMessage:
      favoriteWorkflowEntryPoints.handleQuickPaletteExecuteMessage,
    handleFavoriteRunJobAlarm:
      favoriteRunJobHandlers.handleFavoriteRunJobAlarm,
    handleFavoriteBroadcastCompletion:
      favoriteRunJobHandlers.handleFavoriteBroadcastCompletion,
  };
}
