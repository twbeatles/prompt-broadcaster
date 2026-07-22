/**
 * Background service-worker composition root.
 *
 * Wiring only — domain logic lives in feature modules under
 * `src/background/{broadcast,injection,comparison,experiments,lifecycle,messages,service-test,sites,ui}/`.
 *
 * SOLID notes:
 * - Single Responsibility: each factory module owns one concern.
 * - Open/Closed: new message handlers register via `buildRuntimeHandlers`.
 * - Liskov/Interface Segregation: deps interfaces are narrow per factory.
 * - Dependency Inversion: factories depend on injected ports, not concrete globals.
 */

import { getBroadcastCounter } from "../../../shared/prompts";
import { setOnboardingCompleted } from "../../../shared/runtime-state";
import { getEnabledRuntimeSites, getRuntimeSites } from "../../../shared/sites";
import type {
  BroadcastCounterResponse,
  BroadcastMessage,
  BroadcastResponse,
  BroadcastSiteTargetMessage,
} from "../../../shared/types/messages";
import type {
  LastBroadcastSummary,
  PendingBroadcastRecord,
  PromptHistoryItem,
  SiteInjectionResult,
} from "../../../shared/types/models";

import { createBroadcastWaiterRegistry } from "../../broadcast/waiters";
import { createPendingBroadcastController } from "../../broadcast/pending";
import { createBroadcastQueue } from "../../broadcast/queue";
import { createComparisonHandlers } from "../../comparison/handlers";
import { createExperimentHandlers } from "../../experiments/handlers";
import { createPendingInjectionController } from "../../injection/pending";
import { createServiceWorkerLifecycle } from "../../lifecycle/service-worker";
import { createSelectorHandlers } from "../../messages/selector-handlers";
import { createTemplatePackHandlers } from "../../messages/template-packs";
import { createServiceTestHandler } from "../../service-test/handler";
import { handleServiceHealthGet } from "../../sites/health";
import { createBadgeController } from "../../ui/badge";
import { createNotificationService } from "../../ui/notifications";

import { createBackgroundTabTargetResolver } from "./tab-targets";
import { registerBackgroundChromeEvents } from "./runtime-events";
import { createBackgroundAppContext } from "./context";
import {
  buildChainRunId,
  clonePlainValue,
  getBroadcastTriggerLabel,
  getErrorMessage,
  getI18nMessage,
  normalizePrompt,
  nowIso,
  sleep,
} from "./utils";

import { createPopupLauncher } from "../../popup/launcher";
import { createQuickPaletteCommand } from "../../commands/quick-palette";
import { createSelectionRuntime } from "../../selection/runtime";
import { createContextMenuController } from "../../context-menu";
import { createFavoriteWorkflow } from "../../popup/favorites-workflow";
import { registerRuntimeMessageRouter } from "../../messages/router";
import { createBackgroundSessionStore } from "../../session/store";
import { createBackgroundTabsRuntime } from "../../tabs/runtime";
import { buildRuntimeHandlers } from "../../runtime/handlers";

// ---------------------------------------------------------------------------
// Process-local context & session store
// ---------------------------------------------------------------------------

const backgroundAppContext = createBackgroundAppContext();
const {
  activeInjections,
  queuedInjectionTabIds,
  broadcastCompletionWaiters,
  selectionCache,
  suppressedCompletedBroadcastIds,
} = backgroundAppContext;

let contextMenuRefreshChain: Promise<void> = Promise.resolve();

const broadcastWaiters = createBroadcastWaiterRegistry(broadcastCompletionWaiters);
const { clearBadge, applyBadgeForBroadcast } = createBadgeController();

const backgroundSessionStore = createBackgroundSessionStore();
const {
  mutate: queueBackgroundStateMutation,
  getPendingInjections,
  getPendingBroadcasts,
  clearPendingSelectorChecksForSiteId,
  registerPendingSelectorCheckReport,
  updatePendingInjection,
  addPendingInjection,
  removePendingInjection,
} = backgroundSessionStore;

// ---------------------------------------------------------------------------
// Deferred ports (break composition-time cycles between factories)
// ---------------------------------------------------------------------------

type QueueBroadcastFn = (
  prompt: string,
  siteRefs: Array<string | BroadcastSiteTargetMessage>,
  metadata?: Record<string, unknown>,
) => Promise<BroadcastResponse>;

type HandleBroadcastFn = (message: BroadcastMessage) => Promise<BroadcastResponse>;

type RecordSiteResultFn = (
  broadcastId: string,
  siteId: string,
  resultInput: string | SiteInjectionResult,
) => Promise<LastBroadcastSummary | null>;

type AutoCaptureFn = (
  historyItem: PromptHistoryItem,
  completedRecord: PendingBroadcastRecord,
) => Promise<void>;

type FavoriteCompletionFn = (summary: LastBroadcastSummary) => Promise<void>;

const deferred = {
  queueBroadcastRequest: (async () => {
    throw new Error("queueBroadcastRequest is not initialized.");
  }) as QueueBroadcastFn,
  handleBroadcastMessage: (async () => {
    throw new Error("handleBroadcastMessage is not initialized.");
  }) as HandleBroadcastFn,
  recordBroadcastSiteResult: (async () => null) as RecordSiteResultFn,
  autoCaptureBroadcastResponses: (async () => undefined) as AutoCaptureFn,
  handleFavoriteBroadcastCompletion: (async () => undefined) as FavoriteCompletionFn,
  reconcilePendingBroadcasts: async () => undefined as void,
  cancelBroadcast: (async () => null) as (
    broadcastId: string,
    reason?: string,
  ) => Promise<LastBroadcastSummary | null>,
  closeTabQuietly: async (_tabId: number) => undefined as void,
  queuePendingInjection: (async () => undefined) as (
    tabId: number,
    tab: chrome.tabs.Tab,
  ) => Promise<void>,
  reconcilePendingInjections: async () => undefined as void,
};

// ---------------------------------------------------------------------------
// Tab / site targeting
// ---------------------------------------------------------------------------

let getPreferredNormalActiveTab: (
  preferredWindowId?: number | null,
) => Promise<chrome.tabs.Tab | null> = async () => null;

const backgroundTabTargetResolver = createBackgroundTabTargetResolver({
  getRuntimeSites,
  getPendingInjections,
  getPreferredNormalActiveTab: (preferredWindowId) =>
    getPreferredNormalActiveTab(preferredWindowId),
  getI18nMessage,
});
const {
  getSiteById,
  getSiteForUrl,
  resolveSelectedTargets,
  buildSelectedTabUnavailableMessage,
  isInjectableTabUrl,
  getSitePermissionPatterns,
  isSameSiteOrigin,
  isReusableTabForSite,
  isCustomSitePermissionGranted,
  findReusableTabsForSites,
  getExplicitReusableTabForTarget,
  getPreferredInjectableNormalTab,
} = backgroundTabTargetResolver;

const backgroundTabsRuntime = createBackgroundTabsRuntime({
  getRuntimeSites,
  isInjectableTabUrl,
  isSameSiteOrigin,
  isReusableTabForSite,
});
const rememberNormalTab = backgroundTabsRuntime.rememberNormalTab;
const getPreferredNormalWindowId = backgroundTabsRuntime.getPreferredNormalWindowId;
getPreferredNormalActiveTab = backgroundTabsRuntime.getPreferredNormalActiveTab;
const getFocusedTabContext = backgroundTabsRuntime.getFocusedTabContext;
const waitForTabInteractionReady = backgroundTabsRuntime.waitForTabInteractionReady;
const restoreFocusedTabContext = backgroundTabsRuntime.restoreFocusedTabContext;
const getOpenAiTabsForWindow = backgroundTabsRuntime.getOpenAiTabsForWindow;
const clearRememberedTab = backgroundTabsRuntime.clearRememberedTab;
const resetRememberedState = backgroundTabsRuntime.resetRememberedState;

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

const {
  maybeCreateSelectorNotification,
  maybeCreateBroadcastNotification,
} = createNotificationService({
  getI18nMessage,
  queueBackgroundStateMutation,
  getSiteById,
});

// ---------------------------------------------------------------------------
// Popup / selection / context menu / favorites
// ---------------------------------------------------------------------------

const { openPopupWithPrompt, openOnboardingPage } = createPopupLauncher();
const {
  getSelectedTextFromTab,
  maybeInjectDynamicSelectorChecker,
  handleSelectionUpdateMessage,
} = createSelectionRuntime({
  selectionCache,
  getSiteForUrl,
  isInjectableTabUrl,
  isCustomSitePermissionGranted,
});
const { handleQuickPaletteCommand } = createQuickPaletteCommand({
  getPreferredNormalActiveTab,
  isInjectableTabUrl,
  openPopupWithPrompt,
});
const {
  getContextMenuTargetSiteIds,
  createContextMenus,
  handleContextMenuBroadcast,
  handleCaptureSelectedTextCommand,
} = createContextMenuController({
  getI18nMessage,
  getEnabledRuntimeSites,
  getSitePermissionPatterns,
  openPopupWithPrompt,
  getSelectedTextFromTab,
  isInjectableTabUrl,
  handleBroadcastMessage: (message) => deferred.handleBroadcastMessage(message),
  getContextMenuRefreshChain: () => contextMenuRefreshChain,
  setContextMenuRefreshChain: (value) => {
    contextMenuRefreshChain = value;
  },
});
const {
  parseScheduleAlarmFavoriteId,
  reconcileFavoriteRunJobs,
  reconcileFavoriteSchedules,
  handleFavoriteScheduleAlarm,
  handleFavoriteRunMessage,
  handleFavoriteOpenEditorMessage,
  handleQuickPaletteGetState,
  handleQuickPaletteExecuteMessage,
  handleFavoriteRunJobAlarm,
  handleFavoriteBroadcastCompletion,
} = createFavoriteWorkflow({
  getBroadcastTriggerLabel,
  getI18nMessage,
  rememberNormalTab,
  getPreferredNormalActiveTab,
  isInjectableTabUrl,
  getSelectedTextFromTab,
  openPopupWithPrompt,
  nowIso,
  buildChainRunId,
  queueBroadcastRequest: (prompt, sites, metadata) =>
    deferred.queueBroadcastRequest(prompt, sites, metadata),
});
deferred.handleFavoriteBroadcastCompletion = handleFavoriteBroadcastCompletion;

// ---------------------------------------------------------------------------
// Comparison / experiments / template packs
// ---------------------------------------------------------------------------

const comparison = createComparisonHandlers({
  sleep,
  selectionCache,
  getSiteForUrl,
});
deferred.autoCaptureBroadcastResponses = comparison.autoCaptureBroadcastResponses;

const experiments = createExperimentHandlers({
  nowIso,
  queueBroadcastRequest: (prompt, sites, metadata) =>
    deferred.queueBroadcastRequest(prompt, sites, metadata),
});

const templatePacks = createTemplatePackHandlers({ nowIso });

// ---------------------------------------------------------------------------
// Broadcast pending + injection pending + queue
// ---------------------------------------------------------------------------

const pendingBroadcasts = createPendingBroadcastController({
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
  handleFavoriteBroadcastCompletion: (summary) =>
    deferred.handleFavoriteBroadcastCompletion(summary),
  resolveBroadcastCompletionWaiter: broadcastWaiters.resolve,
  autoCaptureBroadcastResponses: (historyItem, completedRecord) =>
    deferred.autoCaptureBroadcastResponses(historyItem, completedRecord),
});
deferred.recordBroadcastSiteResult = pendingBroadcasts.recordBroadcastSiteResult;
deferred.reconcilePendingBroadcasts = pendingBroadcasts.reconcilePendingBroadcasts;
deferred.cancelBroadcast = pendingBroadcasts.cancelBroadcast;
deferred.closeTabQuietly = pendingBroadcasts.closeTabQuietly;

const pendingInjections = createPendingInjectionController({
  getI18nMessage,
  getErrorMessage,
  sleep,
  activeInjections,
  queuedInjectionTabIds,
  getPendingInjections,
  getPendingBroadcasts,
  updatePendingInjection,
  removePendingInjection,
  recordBroadcastSiteResult: (broadcastId, siteId, resultInput) =>
    deferred.recordBroadcastSiteResult(broadcastId, siteId, resultInput),
  waitForTabInteractionReady,
  isSameSiteOrigin,
});
deferred.queuePendingInjection = pendingInjections.queuePendingInjection;
deferred.reconcilePendingInjections = pendingInjections.reconcilePendingInjections;

const broadcastQueue = createBroadcastQueue({
  getI18nMessage,
  normalizePrompt,
  clonePlainValue,
  queueBackgroundStateMutation,
  getPendingBroadcasts,
  createPendingBroadcast: pendingBroadcasts.createPendingBroadcast,
  registerBroadcastCompletionWaiter: broadcastWaiters.register,
  reconcilePendingBroadcasts: () => deferred.reconcilePendingBroadcasts(),
  resolveSelectedTargets,
  findReusableTabsForSites,
  getExplicitReusableTabForTarget,
  buildSelectedTabUnavailableMessage: (siteName, tabId) =>
    buildSelectedTabUnavailableMessage(siteName, tabId ?? null),
  getSitePermissionPatterns,
  isCustomSitePermissionGranted,
  addPendingInjection,
  queuePendingInjection: (tabId, tab) => deferred.queuePendingInjection(tabId, tab),
  recordBroadcastSiteResult: (broadcastId, siteId, resultInput) =>
    deferred.recordBroadcastSiteResult(broadcastId, siteId, resultInput),
  closeTabQuietly: (tabId) => deferred.closeTabQuietly(tabId),
});
deferred.queueBroadcastRequest = broadcastQueue.queueBroadcastRequest;
deferred.handleBroadcastMessage = broadcastQueue.handleBroadcastMessage;

// ---------------------------------------------------------------------------
// Selector / service-test / lifecycle
// ---------------------------------------------------------------------------

const selectorHandlers = createSelectorHandlers({
  getI18nMessage,
  getSiteForUrl,
  getSiteById,
  clearPendingSelectorChecksForSiteId,
  registerPendingSelectorCheckReport,
  maybeCreateSelectorNotification,
});

const serviceTest = createServiceTestHandler({
  getErrorMessage,
  getPreferredInjectableNormalTab,
});

const lifecycle = createServiceWorkerLifecycle({
  getI18nMessage,
  getErrorMessage,
  reconcilePendingInjections: () => deferred.reconcilePendingInjections(),
  reconcilePendingBroadcasts: () => deferred.reconcilePendingBroadcasts(),
  reconcileFavoriteRunJobs,
  reconcileFavoriteSchedules,
  cancelBroadcast: (broadcastId, reason) => deferred.cancelBroadcast(broadcastId, reason),
  getPendingBroadcasts,
  getPendingInjections,
  suppressedCompletedBroadcastIds,
  closeTabQuietly: (tabId) => deferred.closeTabQuietly(tabId),
  activeInjections,
  queuedInjectionTabIds,
  selectionCache,
  resetRememberedState,
  queueBackgroundStateMutation,
  clearBadge,
  getPreferredNormalWindowId,
  getOpenAiTabsForWindow,
  getPreferredNormalActiveTab,
  isInjectableTabUrl,
  getSelectedTextFromTab,
});

// ---------------------------------------------------------------------------
// Register runtime message router + Chrome event listeners
// ---------------------------------------------------------------------------

registerRuntimeMessageRouter(buildRuntimeHandlers({
  handleBroadcastMessage: (message) => deferred.handleBroadcastMessage(message),
  handleSelectorCheckInit: selectorHandlers.handleSelectorCheckInit,
  handleSelectorCheckReport: selectorHandlers.handleSelectorCheckReport,
  handleServiceTestRun: serviceTest.handleServiceTestRun,
  handleSelectorFailedMessage: selectorHandlers.handleSelectorFailedMessage,
  handleInjectSuccessMessage: selectorHandlers.handleInjectSuccessMessage,
  handleInjectFallbackMessage: selectorHandlers.handleInjectFallbackMessage,
  handleUiToastMessage: selectorHandlers.handleUiToastMessage,
  handlePopupOpened: lifecycle.handlePopupOpened,
  handleGetOpenAiTabsMessage: lifecycle.handleGetOpenAiTabsMessage,
  handleCancelBroadcastMessage: lifecycle.handleCancelBroadcastMessage,
  handleFavoriteRunMessage,
  handleFavoriteOpenEditorMessage,
  resetAllExtensionData: lifecycle.resetAllExtensionData,
  handleGetActiveTabContext: lifecycle.handleGetActiveTabContext,
  handleGetBroadcastCounter: async (): Promise<BroadcastCounterResponse> => ({
    ok: true,
    counter: await getBroadcastCounter(),
  }),
  handleSelectionUpdateMessage,
  handleQuickPaletteGetState: async () => {
    const state = await handleQuickPaletteGetState();
    return {
      ok: state.ok,
      favorites: state.favorites.map((favorite) => ({
        ...favorite,
        mode: (favorite.mode === "chain" ? "chain" : "single") as "single" | "chain",
      })),
    };
  },
  handleQuickPaletteExecuteMessage,
  handleServiceHealthGet,
  handleComparisonNoteList: comparison.handleComparisonNoteList,
  handleComparisonNoteSave: comparison.handleComparisonNoteSave,
  handleComparisonNoteDelete: comparison.handleComparisonNoteDelete,
  handleComparisonCaptureStart: comparison.handleComparisonCaptureStart,
  handleExperimentSave: experiments.handleExperimentSave,
  handleExperimentDelete: experiments.handleExperimentDelete,
  handleExperimentRun: experiments.handleExperimentRun,
  handleTemplatePackExport: templatePacks.handleTemplatePackExport,
  handleTemplatePackImport: templatePacks.handleTemplatePackImport,
  handleServiceGroupsUpdate: templatePacks.handleServiceGroupsUpdate,
}));

registerBackgroundChromeEvents({
  createContextMenus,
  initializeServiceWorker: lifecycle.initializeServiceWorker,
  markOnboardingPending: () => setOnboardingCompleted(false),
  openOnboardingPage,
  handleCaptureSelectedTextCommand,
  handleQuickPaletteCommand,
  getContextMenuTargetSiteIds,
  handleContextMenuBroadcast,
  handleContextMenuComparisonNote: comparison.handleContextMenuComparisonNote,
  selectionCache,
  maybeInjectDynamicSelectorChecker,
  queuePendingInjection: (tabId, tab) => deferred.queuePendingInjection(tabId, tab),
  rememberNormalTab,
  clearRememberedTab,
  getPendingInjections,
  recordBroadcastSiteResult: (broadcastId, siteId, status) =>
    deferred.recordBroadcastSiteResult(broadcastId, siteId, status),
  removePendingInjection,
  activeInjections,
  clearBadge,
  reconcilePendingInjections: () => deferred.reconcilePendingInjections(),
  handleFavoriteRunJobAlarm,
  parseScheduleAlarmFavoriteId,
  handleFavoriteScheduleAlarm,
  openPopupWithPrompt,
  reconcileFavoriteSchedules,
});
