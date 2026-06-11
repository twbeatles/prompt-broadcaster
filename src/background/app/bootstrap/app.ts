import {
  pickBroadcastTargetPrompt,
} from "../../../shared/broadcast/resolution";
import { buildQueueTargetSnapshots } from "../../../shared/broadcast/target-snapshots";
import {
  applyPendingBroadcastSiteResult as applyBroadcastSiteResultMutation,
  buildPendingBroadcastSummary as buildBroadcastSummary,
  getUnresolvedPendingBroadcastSiteIds as getUnresolvedBroadcastSiteIds,
} from "../../../shared/broadcast/state";
import {
  appendPromptHistory,
  appendPromptExperimentRun,
  buildFavoriteEntry,
  capAutoCapturedResponseText,
  deleteComparisonNote,
  deletePromptExperiment,
  ensureUniqueStringId,
  evaluatePromptExperimentRunLimit,
  EXPERIMENT_HARD_BROADCAST_LIMIT,
  EXPERIMENT_SOFT_BROADCAST_LIMIT,
  getAppSettings,
  getBroadcastCounter,
  getComparisonNotes,
  getPromptFavorites,
  getPromptExperiments,
  getStoredPromptHistory,
  getTemplateVariableCache,
  markFavoriteUsed,
  saveComparisonNote,
  savePromptExperiment,
  saveTemplatePack,
  setPromptFavorites,
  setServiceGroups,
  normalizeSiteIdList,
  normalizeResultCode,
  setBroadcastCounter,
  updateFavoritePrompt,
} from "../../../shared/prompts";
import {
  buildSystemTemplateValues,
  detectTemplateVariables,
  renderTemplatePrompt,
} from "../../../shared/template";
import {
  clearFailedSelector,
  enqueueUiToast,
  getActiveComparisonContext,
  getFailedSelectors,
  getLastBroadcast,
  markFailedSelector,
  recordStrategyAttempts,
  resetPersistedExtensionState,
  setLastBroadcast,
  setOnboardingCompleted,
  getStrategyStats,
  setPopupFavoriteIntent,
} from "../../../shared/runtime-state";
import {
  buildSubmitRequirement,
  getEnabledRuntimeSites,
  getRuntimeSites,
  shouldProbeSubmitAfterInput,
} from "../../../shared/sites";
import {
  BADGE_CLEAR_ALARM,
  BADGE_CLEAR_DELAY_MS,
  CONTEXT_MENU_ALL_ID,
  CONTEXT_MENU_ROOT_ID,
  CONTEXT_MENU_SITE_PREFIX,
  INJECTOR_SCRIPT_PATH,
  KEEPALIVE_PERIOD_MINUTES,
  NOTIFICATION_ICON_PATH,
  ONBOARDING_URL,
  PALETTE_SCRIPT_PATH,
  PENDING_BROADCASTS_KEY,
  PENDING_INJECTIONS_KEY,
  PENDING_SELECTOR_CHECKS_KEY,
  PENDING_TIMEOUT_MS,
  POPUP_PAGE_URL,
  RECONCILE_ALARM,
  SELECTOR_ALERTS_KEY,
  SELECTOR_CHECKER_SCRIPT_PATH,
  SELECTION_SCRIPT_PATH,
  STANDALONE_POPUP_HEIGHT,
  STANDALONE_POPUP_WIDTH,
  TAB_LOAD_READY_TIMEOUT_MS,
  TAB_POST_SUBMIT_SETTLE_MS,
} from "../constants";
import {
  buildInjectionConfig,
  buildPreferredStrategyOrder,
  buildSiteResult,
  getSiteResultCode,
  normalizeSelectorEntries,
  scaleTimeout,
} from "../injection-helpers";
import { buildSelectorAlertSignature } from "../selector-alerts";
import {
  clearPendingSelectorChecksForService,
  registerPendingSelectorCheck,
} from "../selector-pending";
import {
  createBackgroundTabTargetResolver,
  type ResolvedBroadcastTarget,
} from "./tab-targets";
import { registerBackgroundChromeEvents } from "./runtime-events";
import { createPopupLauncher } from "../../popup/launcher";
import { createQuickPaletteCommand } from "../../commands/quick-palette";
import { createSelectionRuntime } from "../../selection/runtime";
import { createContextMenuController } from "../../context-menu";
import { createFavoriteWorkflow } from "../../popup/favorites-workflow";
import { registerRuntimeMessageRouter } from "../../messages/router";
import { createBackgroundSessionStore } from "../../session/store";
import { createBackgroundTabsRuntime } from "../../tabs/runtime";
import { buildRuntimeHandlers } from "../../runtime/handlers";
import {
  AUTO_RESPONSE_CAPTURE_INTERVAL_MS,
  AUTO_RESPONSE_CAPTURE_MIN_LENGTH,
  AUTO_RESPONSE_CAPTURE_TIMEOUT_MS,
  COMPARISON_CAPTURE_SELECTORS,
  isPromptEcho,
  normalizeCapturedResponseText,
  shouldUpdateAutoCapturedResponse,
} from "../comparison/capture";
import { SCHEDULED_VARIABLE_BLOCKLIST } from "../experiments/variables";
import type {
  ExecuteScriptAttempt,
  ExecuteScriptInjectionResult,
  InjectPromptFn,
  ServiceTestProbeSuccess,
  ServiceTestProbeResult,
  SubmitPromptFn,
} from "../injection/types";
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
import type {
  ActiveTabContextResponse,
  BroadcastCounterResponse,
  BroadcastMessage,
  BroadcastResponse,
  BroadcastSiteTargetMessage,
  CancelBroadcastMessage,
  CancelBroadcastResponse,
  ComparisonCaptureStartMessage,
  ComparisonCaptureStartResponse,
  ComparisonNoteDeleteMessage,
  ComparisonNoteDeleteResponse,
  ComparisonNoteListMessage,
  ComparisonNoteListResponse,
  ComparisonNoteSaveMessage,
  ComparisonNoteSaveResponse,
  ExperimentDeleteMessage,
  ExperimentDeleteResponse,
  ExperimentRunMessage,
  ExperimentRunResponse,
  ExperimentSaveMessage,
  ExperimentSaveResponse,
  GenericOkResponse,
  GetOpenAiTabsMessage,
  GetOpenAiTabsResponse,
  SelectorCheckInitMessage,
  SelectorCheckInitResponse,
  SelectorCheckReportMessage,
  SelectorCheckReportResponse,
  ServiceGroupsUpdateMessage,
  ServiceGroupsUpdateResponse,
  ServiceHealthGetResponse,
  ServiceTestRunMessage,
  ServiceTestRunResponse,
  TemplatePackExportMessage,
  TemplatePackImportMessage,
  TemplatePackTransferResponse,
} from "../../../shared/types/messages";
import type {
  FavoriteExecutionTrigger,
  FavoritePrompt,
  LastBroadcastSummary,
  PendingBroadcastRecord,
  PendingInjectionRecord,
  PromptHistoryItem,
  RuntimeInjectionSiteConfig,
  RuntimeSite,
  ServiceHealthSnapshot,
  SiteInjectionResult,
} from "../../../shared/types/models";

const DEFAULT_SUBMIT_BUTTON_WAIT_TIMEOUT_MS = 5000;
const DEFAULT_SUBMIT_RETRY_COUNT = 1;

declare global {
  var __aiPromptBroadcasterInjectPrompt: InjectPromptFn | undefined;
  var __aiPromptBroadcasterSubmitPrompt: SubmitPromptFn | undefined;

  interface HTMLElement {
    __lexicalEditor?: {
      parseEditorState: (state: string) => unknown;
      setEditorState: (state: unknown) => void;
      focus?: () => void;
    };
  }
}

const backgroundAppContext = createBackgroundAppContext();
const {
  activeInjections,
  queuedInjectionTabIds,
  broadcastCompletionWaiters,
  selectionCache,
  suppressedCompletedBroadcastIds,
} = backgroundAppContext;
let contextMenuRefreshChain: Promise<void> = Promise.resolve();
let injectionProcessChain: Promise<void> = Promise.resolve();

function registerBroadcastCompletionWaiter(broadcastId: string): Promise<LastBroadcastSummary | null> {
  const normalizedBroadcastId =
    typeof broadcastId === "string" ? broadcastId.trim() : "";
  if (!normalizedBroadcastId) {
    return Promise.resolve(null);
  }

  const existing = broadcastCompletionWaiters.get(normalizedBroadcastId);
  if (existing?.promise) {
    return existing.promise;
  }

  let resolvePromise: ((summary: LastBroadcastSummary | null) => void) | null = null;
  const promise = new Promise<LastBroadcastSummary | null>((resolve) => {
    resolvePromise = resolve;
  });

  if (resolvePromise) {
    broadcastCompletionWaiters.set(normalizedBroadcastId, {
      promise,
      resolve: resolvePromise,
    });
  }

  return promise;
}

function resolveBroadcastCompletionWaiter(
  broadcastId: string,
  summary: LastBroadcastSummary | null = null,
): void {
  const normalizedBroadcastId =
    typeof broadcastId === "string" ? broadcastId.trim() : "";
  if (!normalizedBroadcastId) {
    return;
  }

  const existing = broadcastCompletionWaiters.get(normalizedBroadcastId);
  if (!existing?.resolve) {
    return;
  }

  existing.resolve(summary);
  broadcastCompletionWaiters.delete(normalizedBroadcastId);
}

const backgroundSessionStore = createBackgroundSessionStore();
const {
  mutate: queueBackgroundStateMutation,
  waitForIdle: waitForBackgroundStateSettled,
  getPendingInjections,
  setPendingInjections,
  getPendingBroadcasts,
  setPendingBroadcasts,
  getSelectorAlerts,
  setSelectorAlerts,
  clearPendingSelectorChecksForSiteId,
  registerPendingSelectorCheckReport,
  updatePendingInjection,
  addPendingInjection,
  removePendingInjection,
} = backgroundSessionStore;

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

function queuePendingInjection(tabId: number, tab: chrome.tabs.Tab): Promise<void> {
  if (!Number.isFinite(Number(tabId))) {
    return injectionProcessChain;
  }

  if (activeInjections.has(tabId) || queuedInjectionTabIds.has(tabId)) {
    return injectionProcessChain;
  }

  queuedInjectionTabIds.add(tabId);
  injectionProcessChain = injectionProcessChain
    .catch(() => undefined)
    .then(async () => {
      try {
        await processPendingInjectionNow(tabId, tab);
      } finally {
        queuedInjectionTabIds.delete(tabId);
      }
    })
    .catch((error) => {
      console.error("[AI Prompt Broadcaster] Queued injection processing failed.", {
        tabId,
        error,
      });
      queuedInjectionTabIds.delete(tabId);
    });

  return injectionProcessChain;
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
  handleBroadcastMessage,
  getContextMenuRefreshChain: () => contextMenuRefreshChain,
  setContextMenuRefreshChain: (value) => {
    contextMenuRefreshChain = value;
  },
});
const {
  buildScheduleAlarmName,
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
  queueBroadcastRequest,
});

async function runServiceTestOnTab(
  tabId: number,
  draft: ServiceTestRunMessage["draft"],
): Promise<ServiceTestProbeResult> {
  const probeText = "__apb_probe__";
  const submitRequirement = buildSubmitRequirement(draft);
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (
      siteDraft: Record<string, unknown>,
      nextProbeText: string,
      nextSubmitRequirement: string,
    ) => {
      function isElementVisible(element: Element): boolean {
        if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
          return true;
        }

        const style = window.getComputedStyle(element);
        if (
          (element instanceof HTMLElement && element.hidden) ||
          element.getAttribute("hidden") !== null ||
          element.getAttribute("aria-hidden") === "true" ||
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.visibility === "collapse"
        ) {
          return false;
        }

        return element.getClientRects().length > 0;
      }

      function findElementsDeep(
        selector: string,
        root: Document | ShadowRoot = document,
        seen: Set<Element> = new Set<Element>(),
        matches: Element[] = [],
      ): Element[] {
        if (!selector || typeof selector !== "string") {
          return matches;
        }

        if (typeof root.querySelectorAll === "function") {
          for (const element of Array.from(root.querySelectorAll(selector))) {
            if (!seen.has(element)) {
              seen.add(element);
              matches.push(element);
            }
          }
        }

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        let current: Node | null = walker.currentNode;
        while (current) {
          if (current instanceof Element && current.shadowRoot) {
            findElementsDeep(selector, current.shadowRoot, seen, matches);
          }
          current = walker.nextNode();
        }

        return matches;
      }

      function findBestMatch(
        selectors: string[],
        options: { visibleOnly?: boolean } = {},
      ): { element: Element | null; selector: string } {
        for (const selector of selectors) {
          const matches = findElementsDeep(selector);
          const visible = options.visibleOnly ? matches.filter((element) => isElementVisible(element)) : matches;
          const target = visible[0] ?? matches[0] ?? null;
          if (target) {
            return { element: target, selector };
          }
        }

        return { element: null, selector: selectors[0] ?? "" };
      }

      function detectInputType(element: Element): string {
        if (element instanceof HTMLTextAreaElement) {
          return "textarea";
        }

        if (element instanceof HTMLInputElement) {
          return "input";
        }

        return element instanceof HTMLElement && element.isContentEditable
          ? "contenteditable"
          : "";
      }

      function highlightElement(element: Element, color: string): void {
        if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
          return;
        }

        const previousOutline = element.style.outline;
        const previousOutlineOffset = element.style.outlineOffset;
        element.style.outline = `3px solid ${color}`;
        element.style.outlineOffset = "2px";
        window.setTimeout(() => {
          element.style.outline = previousOutline;
          element.style.outlineOffset = previousOutlineOffset;
        }, 1800);
      }

      function snapshotElementValue(
        element: Element,
      ): { type: "value"; value: string } | { type: "html"; html: string } | { type: "text"; text: string } {
        if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
          return {
            type: "value",
            value: element.value,
          };
        }

        if (element instanceof HTMLElement && element.isContentEditable) {
          return {
            type: "html",
            html: element.innerHTML,
          };
        }

        return {
          type: "text",
          text: element.textContent ?? "",
        };
      }

      function restoreElementValue(
        element: Element,
        snapshot: ReturnType<typeof snapshotElementValue> | null,
      ): void {
        if (!snapshot) {
          return;
        }

        if (snapshot.type === "value" && (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement)) {
          element.value = snapshot.value ?? "";
        } else if (snapshot.type === "html" && element instanceof HTMLElement) {
          element.innerHTML = snapshot.html ?? "";
        } else if (snapshot.type === "text" && element instanceof HTMLElement) {
          element.textContent = snapshot.text ?? "";
        }

        element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "" }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }

      function applyProbeText(element: Element, probeText: string): void {
        if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
          element.focus();
          element.value = probeText;
        } else if (element instanceof HTMLElement && element.isContentEditable) {
          element.focus();
          element.textContent = probeText;
        } else {
          throw new Error("Editable target was not found.");
        }

        element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: probeText }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }

      async function waitForVisibleSelector(
        selector: string,
        timeoutMs = 1800,
      ): Promise<{ element: Element | null; selector: string }> {
        const startedAt = Date.now();
        while (Date.now() - startedAt <= timeoutMs) {
          const match = findBestMatch([selector], { visibleOnly: true });
          if (match.element) {
            return match;
          }
          await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
        }

        return findBestMatch([selector], { visibleOnly: true });
      }

      try {
        const selectors = [
          siteDraft.inputSelector,
          ...(Array.isArray(siteDraft.fallbackSelectors) ? siteDraft.fallbackSelectors : []),
        ].filter((selector) => typeof selector === "string" && selector.trim());
        const inputMatch = findBestMatch(selectors, { visibleOnly: true });

        if (!inputMatch.element) {
          return {
            ok: true,
            input: {
              found: false,
              selector: inputMatch.selector,
              actualType: "",
              expectedType: siteDraft.inputType ?? "",
            },
            submit: {
              status: "skipped",
            },
          };
        }

        highlightElement(inputMatch.element, "#facc15");
        const actualInputType = detectInputType(inputMatch.element);
        const inputTypeMatches = actualInputType === String(siteDraft.inputType ?? "");
        const response: ServiceTestProbeSuccess = {
          ok: true,
          input: {
            found: true,
            selector: inputMatch.selector,
            actualType: actualInputType,
            expectedType: String(siteDraft.inputType ?? ""),
            typeMatches: inputTypeMatches,
          },
          submit: {
            status: "skipped",
          },
        };

        if (
          String(siteDraft.submitMethod) !== "click" ||
          (nextSubmitRequirement !== "required" && nextSubmitRequirement !== "conditional")
        ) {
          response.submit = {
            status: "skipped",
            method: String(siteDraft.submitMethod ?? "enter"),
          };
          return response;
        }

        const snapshot = snapshotElementValue(inputMatch.element);
        try {
          applyProbeText(inputMatch.element, nextProbeText);
          const submitMatch = await waitForVisibleSelector(String(siteDraft.submitSelector ?? ""));
          if (submitMatch.element) {
            highlightElement(submitMatch.element, "#34d399");
          }

          response.submit = {
            status: submitMatch.element ? "ok" : "missing",
            selector: submitMatch.selector,
          };
        } finally {
          restoreElementValue(inputMatch.element, snapshot);
        }

        return response;
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    args: [draft, probeText, submitRequirement],
  });

  return (result?.result as ServiceTestProbeResult | undefined) ?? {
    ok: false,
    error: "Selector test returned no result.",
  };
}

async function clearBadge() {
  try {
    await chrome.action.setBadgeText({ text: "" });
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to clear badge.", error);
  }
}

async function applyBadgeForBroadcast(summary: LastBroadcastSummary | null): Promise<void> {
  try {
    if (!summary || summary.status === "idle") {
      await clearBadge();
      return;
    }

    if (summary.status === "sending") {
      await chrome.action.setBadgeBackgroundColor({ color: "#d97706" });
      await chrome.action.setBadgeText({ text: "..." });
      return;
    }

    if (summary.status === "failed" || summary.status === "partial") {
      await chrome.action.setBadgeBackgroundColor({ color: "#b53b3b" });
      await chrome.action.setBadgeText({ text: "!" });
      return;
    }

    await chrome.action.setBadgeBackgroundColor({ color: "#1f8f5f" });
    await chrome.action.setBadgeText({ text: "✓" });
    chrome.alarms.create(BADGE_CLEAR_ALARM, {
      when: Date.now() + BADGE_CLEAR_DELAY_MS,
    });
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to apply badge state.", error);
  }
}

async function syncLastBroadcast(summary: LastBroadcastSummary | null): Promise<void> {
  await setLastBroadcast(summary);
  await applyBadgeForBroadcast(summary);
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

async function maybeCreateSelectorNotification(
  report: {
    siteId: string;
    siteName: string;
    pageUrl: string;
    missing: Array<{ field: string; selector: string }>;
  },
): Promise<void> {
  try {
    const settings = await getAppSettings();
    if (!settings.desktopNotifications) {
      return;
    }

    const signature = buildSelectorAlertSignature(report);

    const shouldNotify = await queueBackgroundStateMutation((state) => {
      const selectorAlerts = state.selectorAlerts ?? {};
      if (selectorAlerts[signature]) {
        return false;
      }

      selectorAlerts[signature] = Date.now();
      state.selectorAlerts = selectorAlerts;
      return true;
    });

    if (!shouldNotify) {
      return;
    }

    await chrome.notifications.create(`selector-changed-${report.siteId}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL(NOTIFICATION_ICON_PATH),
      title:
        getI18nMessage("notification_selector_title", [report.siteName]) ||
        `${report.siteName} input check needed`,
      message:
        getI18nMessage("notification_selector_message", [report.siteName]) ||
        `${report.siteName} input box was not found. Complete login or security checks, then try again.`,
    });
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to create selector notification.", {
      report,
      error,
    });
  }
}

async function maybeCreateBroadcastNotification(summary: LastBroadcastSummary): Promise<void> {
  try {
    const settings = await getAppSettings();
    if (!settings.desktopNotifications) {
      return;
    }

    const successCount = (summary.submittedSiteIds ?? []).length;
    const failedSiteIds = [...(summary.failedSiteIds ?? [])];
    const failedCount = failedSiteIds.length;
    const failedNames = (
      await Promise.all(failedSiteIds.map(async (siteId) => (await getSiteById(siteId))?.name ?? siteId))
    ).filter(Boolean);

    let title = getI18nMessage("notification_broadcast_title_success") || "AI Broadcaster";
    let message = "";

    if (summary.status === "failed") {
      title = getI18nMessage("notification_broadcast_title_failed") || "AI Broadcaster";
      message =
        getI18nMessage("notification_broadcast_message_failed") ||
        "Broadcast failed. Check each tab for details.";
    } else if (summary.status === "partial") {
      title = getI18nMessage("notification_broadcast_title_partial") || "AI Broadcaster";
      message =
        getI18nMessage("notification_broadcast_message_partial_named", [
          String(successCount),
          String(failedCount),
          failedNames.join(", "),
        ]) ||
        `${successCount} succeeded, ${failedCount} failed (${failedNames.join(", ")})`;
    } else {
      title = getI18nMessage("notification_broadcast_title_success") || "AI Broadcaster";
      message =
        getI18nMessage("notification_broadcast_message_success_named", [String(successCount)]) ||
        `${successCount} service(s) completed`;
    }

    await chrome.notifications.create(`broadcast-complete-${Date.now()}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL(NOTIFICATION_ICON_PATH),
      title,
      message,
    });
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to create broadcast notification.", error);
  }
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

async function injectIntoTab(
  tabId: number,
  prompt: string,
  site: RuntimeSite,
  runtimeOverrides: Record<string, unknown> = {},
): Promise<ExecuteScriptInjectionResult | null> {
  const config = buildInjectionConfig(site, runtimeOverrides);

  if (site?.id === "perplexity") {
    const promptSelectors = normalizeSelectorEntries([
      config?.inputSelector,
      ...(Array.isArray(config?.fallbackSelectors) ? config.fallbackSelectors : []),
    ]);
    const [executionResult] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: async (
        injectedPrompt: string,
        injectedConfig: RuntimeInjectionSiteConfig,
        injectedSelectors: string[],
      ) => {
        const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, Math.max(Number(ms) || 0, 0)));

        const normalizeText = (value: unknown) =>
          String(value ?? "")
            .replace(/\u00A0/g, " ")
            .replace(/[\u200B-\u200D\uFEFF]/g, "")
            .replace(/\r\n?/g, "\n")
            .trim();

        const isVisible = (element: Element) => {
          if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
            return true;
          }

          const style = window.getComputedStyle(element);
          if (
            (element instanceof HTMLElement && element.hidden) ||
            element.getAttribute("hidden") !== null ||
            element.getAttribute("aria-hidden") === "true" ||
            style.display === "none" ||
            style.visibility === "hidden" ||
            style.visibility === "collapse"
          ) {
            return false;
          }

          return element.getClientRects().length > 0;
        };

        const isEditable = (element: Element) => {
          if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            return !element.readOnly;
          }

          return element instanceof HTMLElement ? element.isContentEditable : false;
        };

        const findPromptMatch = () => {
          for (const selector of Array.isArray(injectedSelectors) ? injectedSelectors : []) {
            const candidates = Array.from(document.querySelectorAll(selector));
            const element = candidates.find((candidate) => isVisible(candidate) && isEditable(candidate));
            if (element) {
              return { element, selector };
            }
          }

          return null;
        };

        const waitForPromptMatch = async (timeoutMs: number) => {
          const deadline = performance.now() + Math.max(Number(timeoutMs) || 0, 0);

          while (performance.now() <= deadline) {
            const match = findPromptMatch();
            if (match) {
              return match;
            }

            await sleep(150);
          }

          return null;
        };

        const placeCaretAtEnd = (element: Element) => {
          if (!(element instanceof HTMLElement)) {
            return;
          }

          const selection = window.getSelection();
          if (!selection) {
            return;
          }

          const range = document.createRange();
          range.selectNodeContents(element);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        };

        const selectAllEditableContents = (element: Element) => {
          if (!(element instanceof HTMLElement)) {
            return;
          }

          element.focus();
          const selection = window.getSelection();
          if (!selection) {
            document.execCommand("selectAll", false);
            return;
          }

          const range = document.createRange();
          range.selectNodeContents(element);
          selection.removeAllRanges();
          selection.addRange(range);
        };

        const buildParagraphNode = (text: string) => ({
          children: text
            ? [
                {
                  detail: 0,
                  format: 0,
                  mode: "normal",
                  style: "",
                  text,
                  type: "text",
                  version: 1,
                },
              ]
            : [],
          direction: null,
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1,
          textFormat: 0,
          textStyle: "",
        });

        const setLexicalText = (element: Element, nextPrompt: string) => {
          if (!(element instanceof HTMLElement)) {
            return false;
          }

          const editor = element.__lexicalEditor;
          if (
            !editor ||
            typeof editor.parseEditorState !== "function" ||
            typeof editor.setEditorState !== "function"
          ) {
            return false;
          }

          const paragraphs = String(nextPrompt ?? "").split(/\n/g).map((line) => buildParagraphNode(line));
          const editorStateJson = {
            root: {
              children: paragraphs.length > 0 ? paragraphs : [buildParagraphNode("")],
              direction: null,
              format: "",
              indent: 0,
              type: "root",
              version: 1,
            },
          };

          const nextState = editor.parseEditorState(JSON.stringify(editorStateJson));
          editor.setEditorState(nextState);
          if (typeof editor.focus === "function") {
            editor.focus();
          } else {
            element.focus();
          }
          placeCaretAtEnd(element);
          return normalizeText(element.innerText ?? element.textContent ?? "") === normalizeText(nextPrompt);
        };

        if ((Number(injectedConfig?.waitMs) || 0) > 0) {
          await sleep(injectedConfig.waitMs);
        }

        const startedAt = performance.now();
        const match = await waitForPromptMatch(Math.max((Number(injectedConfig?.waitMs) || 0) + 6000, 8000));
        if (!match?.element) {
          return { status: "selector_timeout", attempts: [] };
        }

        const { element, selector } = match;
        let strategy = "mainWorldExecCommand";
        let injected = false;
        const attempts: ExecuteScriptAttempt[] = [];

        if (element instanceof HTMLElement && element.dataset.lexicalEditor === "true") {
          injected = setLexicalText(element, injectedPrompt);
          strategy = "mainWorldLexical";
          attempts.push({ name: strategy, success: injected });
        }

        if (!injected && element instanceof HTMLElement) {
          element.focus();
          selectAllEditableContents(element);
          const inserted = document.execCommand("insertText", false, injectedPrompt);
          injected =
            Boolean(inserted) ||
            normalizeText(element.innerText ?? element.textContent ?? "") === normalizeText(injectedPrompt);
          attempts.push({ name: "mainWorldExecCommand", success: injected });
        }

        if (!injected) {
          return { status: "strategy_exhausted", selector, strategy, attempts };
        }

        return {
          status: "injected",
          selector,
          strategy,
          inputType: "contenteditable",
          elapsedMs: Math.round(performance.now() - startedAt),
          attempts,
        };
      },
      args: [prompt, config, promptSelectors],
    });

    const injectionResult = (executionResult?.result as ExecuteScriptInjectionResult | null | undefined) ?? null;
    if (!injectionResult || injectionResult.status !== "injected") {
      return injectionResult;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: [INJECTOR_SCRIPT_PATH],
    });

    const [submitExecutionResult] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (injectedConfig: RuntimeInjectionSiteConfig) => {
        const submitter = globalThis.__aiPromptBroadcasterSubmitPrompt;
        if (typeof submitter !== "function") {
          throw new Error("submitPrompt entry point is not available in the tab context.");
        }

        return submitter(injectedConfig);
      },
      args: [config],
    });

    const submitResult = (submitExecutionResult?.result as ExecuteScriptInjectionResult | null | undefined) ?? null;
    if (submitResult?.status === "submitted") {
      return {
        ...submitResult,
        selector: injectionResult.selector ?? submitResult.selector,
        strategy: injectionResult.strategy ?? submitResult.strategy,
        inputType: injectionResult.inputType ?? submitResult.inputType,
        elapsedMs: injectionResult.elapsedMs ?? submitResult.elapsedMs,
        attempts: injectionResult.attempts ?? submitResult.attempts ?? [],
      };
    }

    return {
      ...(submitResult ?? injectionResult),
      selector: injectionResult?.selector ?? submitResult?.selector,
      strategy: injectionResult?.strategy ?? submitResult?.strategy,
      inputType: injectionResult?.inputType ?? submitResult?.inputType,
      elapsedMs: injectionResult?.elapsedMs ?? submitResult?.elapsedMs,
      attempts: injectionResult?.attempts ?? submitResult?.attempts ?? [],
    };
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: [INJECTOR_SCRIPT_PATH],
  });

  const [executionResult] = await chrome.scripting.executeScript({
    target: { tabId },
      func: async (injectedPrompt: string, injectedConfig: RuntimeInjectionSiteConfig) => {
        const injector = globalThis.__aiPromptBroadcasterInjectPrompt;
      if (typeof injector !== "function") {
        throw new Error("injectPrompt entry point is not available in the tab context.");
      }

      return injector(injectedPrompt, injectedConfig);
    },
    args: [prompt, config],
  });

  return (executionResult?.result as ExecuteScriptInjectionResult | null | undefined) ?? null;
}

async function handlePendingInjectionTimeout(
  tabId: number,
  job: PendingInjectionRecord,
  reason = "timeout",
): Promise<void> {
  const siteName = job?.site?.name ?? job?.siteId ?? "AI service";
  await recordBroadcastSiteResult(job.broadcastId, job.siteId, buildSiteResult("injection_timeout"));
  await removePendingInjection(tabId);
  activeInjections.delete(tabId);

  await enqueueUiToast({
    message:
      getI18nMessage("toast_injection_timeout", [siteName]) ||
      `${siteName} injection timed out.`,
    type: "warning",
    duration: 5000,
    meta: { reason },
  });
}

async function processPendingInjectionNow(tabId: number, tab: chrome.tabs.Tab): Promise<void> {
  if (activeInjections.has(tabId)) {
    return;
  }

  const pending = await getPendingInjections();
  const job = pending[String(tabId)];
  if (!job || (job.injected === true && job.status !== "injecting")) {
    return;
  }

  const pendingBroadcasts = await getPendingBroadcasts();
  if (!pendingBroadcasts[job.broadcastId]) {
    await removePendingInjection(tabId);
    activeInjections.delete(tabId);
    return;
  }

  if (Date.now() - Number(job.createdAt || 0) > PENDING_TIMEOUT_MS) {
    await handlePendingInjectionTimeout(tabId, job);
    return;
  }

  activeInjections.add(tabId);
  await updatePendingInjection(tabId, (current) =>
    current
      ? {
          ...current,
          injected: true,
          startedAt: Date.now(),
          status: "injecting",
        }
      : null
  );

  try {
    const settings = await getAppSettings();
    const waitMsMultiplier = Number(settings?.waitMsMultiplier) || 1;
    const strategyStats = await getStrategyStats();
    const runtimeOverrides = {
      waitMsMultiplier,
      strategyOrder: buildPreferredStrategyOrder(job.siteId, strategyStats),
      submitTimeoutMs: scaleTimeout(DEFAULT_SUBMIT_BUTTON_WAIT_TIMEOUT_MS, waitMsMultiplier),
      submitRetryCount: DEFAULT_SUBMIT_RETRY_COUNT,
    };

    const ready = await waitForTabInteractionReady(tabId, scaleTimeout(TAB_LOAD_READY_TIMEOUT_MS, waitMsMultiplier));
    if (!ready) {
      await handlePendingInjectionTimeout(tabId, job, "tab_not_ready");
      return;
    }
    const currentTab = await chrome.tabs.get(tabId);
    const currentUrl = currentTab?.url ?? "";

    // Activate the tab before injection so that focus-dependent DOM APIs
    // (execCommand, Selection, ClipboardEvent) work correctly.
    try {
      if (Number.isFinite(currentTab?.windowId)) {
        await chrome.windows.update(currentTab.windowId, { focused: true });
      }
      await chrome.tabs.update(tabId, { active: true });
      // Brief pause to let the browser fully render and focus the tab
      await sleep(300);
    } catch (activateError) {
      console.warn("[AI Prompt Broadcaster] Failed to activate tab before injection.", {
        tabId,
        activateError,
      });
    }

    if (!isSameSiteOrigin(currentUrl, job.site)) {
      await recordBroadcastSiteResult(job.broadcastId, job.siteId, buildSiteResult("auth_required"));
      await enqueueUiToast({
        message:
          getI18nMessage("toast_login_required", [job.site.name]) ||
          `${job.site.name} requires login before sending.`,
        type: "warning",
        duration: 5000,
      });
      return;
    }

    const result = await injectIntoTab(tabId, job.prompt, job.site, {
      ...runtimeOverrides,
      waitMs: scaleTimeout(Number(job.site?.waitMs) || 0, waitMsMultiplier),
    });
    if (Array.isArray(result?.attempts) && result.attempts.length > 0) {
      await recordStrategyAttempts(job.siteId, result.attempts);
    }
    const finalCode = normalizeResultCode(result?.status);

    if (finalCode === "submitted") {
      await sleep(TAB_POST_SUBMIT_SETTLE_MS);
    }

    await recordBroadcastSiteResult(job.broadcastId, job.siteId, buildSiteResult(finalCode, {
      message: result?.error ?? "",
      strategy: result?.strategy,
      elapsedMs: result?.elapsedMs,
      attempts: result?.attempts,
    }));

    if (finalCode === "auth_required") {
      await enqueueUiToast({
        message:
          getI18nMessage("toast_login_required", [job.site.name]) ||
          `${job.site.name} requires login before sending.`,
        type: "warning",
        duration: 5000,
      });
    }
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to inject prompt after tab load.", {
      tabId,
      error,
    });
    await recordBroadcastSiteResult(job.broadcastId, job.siteId, buildSiteResult("unexpected_error", {
      message: getErrorMessage(error),
    }));
    await enqueueUiToast({
      message:
        getI18nMessage("toast_injection_failed", [job.site.name]) ||
        `${job.site.name} automatic injection failed.`,
      type: "error",
      duration: 5000,
    });
  } finally {
    await removePendingInjection(tabId);
    activeInjections.delete(tabId);
  }
}

async function reconcilePendingInjections(): Promise<void> {
  const pending = await getPendingInjections();
  const entries = Object.entries(pending);

  for (const [tabIdKey, job] of entries) {
    const tabId = Number(tabIdKey);
    if (!Number.isFinite(tabId) || !job) {
      await removePendingInjection(tabId);
      continue;
    }

    const createdAt = Number(job.createdAt || 0);
    const startedAt = Number(job.startedAt || 0);
    const createdAge = Date.now() - createdAt;
    const injectingAge = startedAt > 0 ? Date.now() - startedAt : createdAge;
    if (job.status === "injecting" && injectingAge > PENDING_TIMEOUT_MS) {
      await handlePendingInjectionTimeout(tabId, job, "stale_injecting");
      continue;
    }

    if (createdAge > PENDING_TIMEOUT_MS) {
      await handlePendingInjectionTimeout(tabId, job);
      continue;
    }

    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab?.status === "complete") {
        await queuePendingInjection(tabId, tab);
      }
    } catch (_error) {
      await recordBroadcastSiteResult(job.broadcastId, job.siteId, "tab_closed");
      await removePendingInjection(tabId);
      activeInjections.delete(tabId);
    }
  }
}

async function ensureReconcileAlarm(): Promise<void> {
  try {
    chrome.alarms.create(RECONCILE_ALARM, {
      periodInMinutes: KEEPALIVE_PERIOD_MINUTES,
    });
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to create reconcile alarm.", error);
  }
}

async function initializeServiceWorker(): Promise<void> {
  await ensureReconcileAlarm();
  await reconcilePendingInjections();
  await reconcilePendingBroadcasts();
  await reconcileFavoriteRunJobs();
  await reconcileFavoriteSchedules();
}

async function queueResolvedBroadcastRequest(
  prompt: string,
  selectedTargets: ResolvedBroadcastTarget[],
  metadata: Record<string, unknown> = {},
): Promise<BroadcastResponse> {
  const selectedSites = selectedTargets.map((target) => target.site);
  let queuedSiteCount = 0;

  const broadcast = await createPendingBroadcast(prompt, selectedTargets, metadata);
  registerBroadcastCompletionWaiter(broadcast.id);
  const settings = await getAppSettings();
  const createdTabSiteIds: string[] = [];
  const reusedTabSiteIds: string[] = [];
  const failedTabSiteIds: string[] = [];
  const reusableTabsBySiteId = settings.reuseExistingTabs
    ? await findReusableTabsForSites(selectedSites, {
        windowId: broadcast.originWindowId,
        excludeTabId: broadcast.originTabId,
      })
    : new Map();

  for (const target of selectedTargets) {
    const site = target.site;

    try {
      const pendingBeforeCreate = await getPendingBroadcasts();
      if (!pendingBeforeCreate[broadcast.id]) {
        continue;
      }

      if (site.isCustom && getSitePermissionPatterns(site).length > 0) {
        const granted = await isCustomSitePermissionGranted(site);
        if (!granted) {
          failedTabSiteIds.push(site.id);
          await recordBroadcastSiteResult(broadcast.id, site.id, "permission_denied");
          await enqueueUiToast({
            message:
              getI18nMessage("toast_service_permission_denied", [site.name]) ||
              `${site.name} host permission was not granted.`,
            type: "error",
            duration: 5000,
          });
          continue;
        }
      }

      const explicitTab = await getExplicitReusableTabForTarget(target);
      if (explicitTab.requested && !explicitTab.tab) {
        failedTabSiteIds.push(site.id);
        await recordBroadcastSiteResult(broadcast.id, site.id, buildSiteResult("tab_closed", {
          message: explicitTab.message ?? buildSelectedTabUnavailableMessage(site.name, target.targetTabId),
        }));
        continue;
      }

      const reusableTab =
        explicitTab.tab ??
        (
          !target.forceNewTab && settings.reuseExistingTabs
            ? reusableTabsBySiteId.get(site.id) ?? null
            : null
        );
      const targetTab =
        reusableTab ??
        await chrome.tabs.create({
          url: site.url,
          active: false,
        });

      if (!targetTab?.id) {
        throw new Error("Tab was queued without a valid id.");
      }

      const pendingAfterCreate = await getPendingBroadcasts();
      if (!pendingAfterCreate[broadcast.id]) {
        if (!reusableTab) {
          await closeTabQuietly(targetTab.id);
        }
        continue;
      }

      await addPendingInjection(targetTab.id, {
        broadcastId: broadcast.id,
        siteId: site.id,
        prompt: pickBroadcastTargetPrompt(target, prompt),
        site,
        injected: false,
        status: "pending",
        createdAt: Date.now(),
        closeOnCancel: !reusableTab,
      });

      await queueBackgroundStateMutation((state) => {
        const record = state.pendingBroadcasts[broadcast.id];
        if (!record) {
          return null;
        }

        record.targetTabIdsBySiteId = {
          ...(record.targetTabIdsBySiteId ?? {}),
          [site.id]: targetTab.id,
        };

        if (!reusableTab) {
          record.openedTabIds = Array.from(
            new Set([...(Array.isArray(record.openedTabIds) ? record.openedTabIds : []), targetTab.id])
          );
        }

        state.pendingBroadcasts[broadcast.id] = record;
        return clonePlainValue(record.targetTabIdsBySiteId);
      });

      queuedSiteCount += 1;

      if (reusableTab) {
        reusedTabSiteIds.push(site.id);
      } else {
        createdTabSiteIds.push(site.id);
      }

      void queuePendingInjection(targetTab.id, targetTab);
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to create broadcast tab.", {
        site,
        error,
      });
      failedTabSiteIds.push(site.id);
      await recordBroadcastSiteResult(broadcast.id, site.id, "tab_create_failed");
    }
  }

  if (queuedSiteCount > 0) {
    await queueBackgroundStateMutation(async () => {
      const currentCounter = await getBroadcastCounter();
      await setBroadcastCounter(currentCounter + 1);
      return currentCounter + 1;
    });
  }

  return {
    ok: queuedSiteCount > 0,
    createdSiteCount: queuedSiteCount,
    queuedSiteCount,
    requestedSiteCount: selectedSites.length,
    createdTabSiteIds,
    reusedTabSiteIds,
    failedTabSiteIds,
    broadcastId: broadcast.id,
    error: queuedSiteCount > 0 ? undefined : "No tabs could be queued.",
  };
}

async function queueBroadcastRequest(
  prompt: string,
  siteRefs: Array<string | BroadcastSiteTargetMessage>,
  metadata: Record<string, unknown> = {},
): Promise<BroadcastResponse> {
  await reconcilePendingBroadcasts();

  const normalizedPrompt = normalizePrompt(prompt).trim();
  const selectedTargets = await resolveSelectedTargets(siteRefs);
  const selectedSites = selectedTargets.map((target) => target.site);

  if (!normalizedPrompt) {
    throw new Error("Prompt is required.");
  }

  if (selectedSites.length === 0) {
    throw new Error("At least one target site is required.");
  }

  return queueResolvedBroadcastRequest(normalizedPrompt, selectedTargets, metadata);
}

async function handleBroadcastMessage(message: BroadcastMessage): Promise<BroadcastResponse> {
  return queueBroadcastRequest(message?.prompt, message?.sites, {
    trigger: "popup",
  });
}

async function handleServiceHealthGet(): Promise<ServiceHealthGetResponse> {
  const [sites, history, failedSelectors, strategyStats] = await Promise.all([
    getRuntimeSites(),
    getStoredPromptHistory(),
    getFailedSelectors(),
    getStrategyStats(),
  ]);
  const failedSelectorBySite = new Map(
    failedSelectors.map((entry) => [entry.serviceId, entry]),
  );

  const snapshots: ServiceHealthSnapshot[] = sites.map((site) => {
    let lastSuccessAt: string | null = null;
    let lastFailureAt: string | null = null;
    let lastFailureCode: ServiceHealthSnapshot["lastFailureCode"] = null;
    let successCount = 0;
    let failureCount = 0;

    for (const item of history) {
      const result = item.siteResults?.[site.id];
      if (!result && !item.requestedSiteIds?.includes(site.id)) {
        continue;
      }

      if (result?.code === "submitted" || item.submittedSiteIds?.includes(site.id)) {
        successCount += 1;
        if (!lastSuccessAt) {
          lastSuccessAt = item.createdAt;
        }
        continue;
      }

      failureCount += 1;
      if (!lastFailureAt) {
        lastFailureAt = item.createdAt;
        lastFailureCode = result?.code ?? "unexpected_error";
      }
    }

    const siteStrategyStats = strategyStats[site.id] ?? {};
    const preferredStrategy =
      Object.entries(siteStrategyStats)
        .sort(([, left], [, right]) =>
          (right.success - right.fail) - (left.success - left.fail),
        )[0]?.[0] ?? null;

    return {
      serviceId: site.id,
      serviceName: site.name,
      enabled: site.enabled,
      lastSuccessAt,
      lastFailureAt,
      lastFailureCode,
      selectorWarning: failedSelectorBySite.get(site.id) ?? null,
      preferredStrategy,
      successCount,
      failureCount,
      verification: {
        lastVerified: site.lastVerified,
        verifiedAt: site.verifiedAt,
        verifiedRoute: site.verifiedRoute,
        verifiedAuthState: site.verifiedAuthState,
        verifiedLocale: site.verifiedLocale,
        verifiedVersion: site.verifiedVersion,
      },
    };
  });

  return {
    ok: true,
    snapshots,
  };
}

async function handleComparisonNoteList(
  message: ComparisonNoteListMessage,
): Promise<ComparisonNoteListResponse> {
  const historyId = Number(message?.historyId);
  const notes = await getComparisonNotes();
  return {
    ok: true,
    notes: Number.isFinite(historyId)
      ? notes.filter((entry) => Number(entry.historyId) === historyId)
      : notes,
  };
}

async function handleComparisonNoteSave(
  message: ComparisonNoteSaveMessage,
): Promise<ComparisonNoteSaveResponse> {
  const note = await saveComparisonNote(message?.note ?? {});
  return {
    ok: true,
    note,
  };
}

async function handleComparisonNoteDelete(
  message: ComparisonNoteDeleteMessage,
): Promise<ComparisonNoteDeleteResponse> {
  const notes = await deleteComparisonNote(message?.noteId ?? "");
  return {
    ok: true,
    notes,
  };
}

async function resolveContextMenuComparisonTarget(
  siteId: string,
): Promise<{ historyId: number } | null> {
  const [history, activeContext] = await Promise.all([
    getStoredPromptHistory(),
    getActiveComparisonContext(),
  ]);

  if (activeContext?.serviceId !== siteId) {
    return null;
  }

  const activeHistory = history.find((entry) => Number(entry.id) === activeContext.historyId);
  if (activeHistory?.requestedSiteIds?.includes(siteId)) {
    return {
      historyId: activeHistory.id,
    };
  }

  return null;
}

async function handleContextMenuComparisonNote(
  selectedText: string,
  tab: chrome.tabs.Tab | undefined,
): Promise<void> {
  const responseText = (selectedText || (tab?.id ? selectionCache.get(tab.id) : "") || "").trim();
  if (!responseText) {
    return;
  }

  const [history, site] = await Promise.all([
    getStoredPromptHistory(),
    getSiteForUrl(tab?.url ?? ""),
  ]);
  if (history.length === 0 || !site?.id) {
    await enqueueUiToast({
      message: "Open a supported service tab and keep at least one history item before saving a comparison note.",
      type: "warning",
      duration: 5000,
    });
    return;
  }

  const target = await resolveContextMenuComparisonTarget(site.id);
  if (!target) {
    await enqueueUiToast({
      message: `${site.name} is not the active comparison target. Open the matching history item first.`,
      type: "warning",
      duration: 5000,
    });
    return;
  }

  await saveComparisonNote({
    historyId: target.historyId,
    serviceId: site.id,
    responseText,
    captureMode: "selection",
    tags: ["selection"],
  });
  await enqueueUiToast({
    message: `${site.name} response saved to the active comparison note.`,
    type: "success",
    duration: 3500,
  });
}

async function findComparisonCaptureTab(
  serviceId: string,
  explicitTabId?: number | null,
): Promise<chrome.tabs.Tab | null> {
  if (Number.isFinite(Number(explicitTabId))) {
    try {
      return await chrome.tabs.get(Number(explicitTabId));
    } catch (_error) {
      return null;
    }
  }

  const activeTabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  }).catch(() => []);
  for (const tab of activeTabs) {
    const site = await getSiteForUrl(tab.url ?? "");
    if (site?.id === serviceId) {
      return tab;
    }
  }

  const allTabs = await chrome.tabs.query({}).catch(() => []);
  for (const tab of allTabs) {
    const site = await getSiteForUrl(tab.url ?? "");
    if (site?.id === serviceId) {
      return tab;
    }
  }

  return null;
}

async function captureVisibleAssistantResponse(tabId: number, serviceId: string, promptText = ""): Promise<string> {
  const selectors = COMPARISON_CAPTURE_SELECTORS[serviceId] ?? [];
  if (selectors.length === 0) {
    return "";
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    args: [selectors],
    func: (assistantSelectors: string[]) => {
      const isVisible = (element: Element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      };
      const isAssistantCandidate = (element: Element) => {
        const role = element.getAttribute("role") || "";
        const editable = element.getAttribute("contenteditable") || "";
        return role.toLowerCase() !== "textbox" && editable.toLowerCase() !== "true";
      };
      const getText = (element: Element) => (element.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
      const seen = new Set<Element>();
      const candidates = assistantSelectors
        .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
        .filter((element) => {
          if (seen.has(element)) {
            return false;
          }
          seen.add(element);
          return true;
        })
        .filter(isVisible)
        .filter(isAssistantCandidate)
        .map((element) => ({
          text: getText(element),
          top: element.getBoundingClientRect().top,
        }))
        .filter((entry) => entry.text.length >= 20)
        .sort((left, right) => right.top - left.top);

      return candidates[0]?.text ?? "";
    },
  });

  const responseText = typeof result?.result === "string" ? result.result : "";
  if (
    normalizeCapturedResponseText(responseText).length < AUTO_RESPONSE_CAPTURE_MIN_LENGTH ||
    isPromptEcho(responseText, promptText)
  ) {
    return "";
  }

  return responseText;
}

async function captureAssistantResponseWithRetry(
  tabId: number,
  serviceId: string,
  promptText: string,
): Promise<string> {
  const deadline = Date.now() + AUTO_RESPONSE_CAPTURE_TIMEOUT_MS;
  let lastResponse = "";

  while (Date.now() <= deadline) {
    const responseText = await captureVisibleAssistantResponse(tabId, serviceId, promptText).catch(() => "");
    if (responseText) {
      if (lastResponse && normalizeCapturedResponseText(lastResponse) === normalizeCapturedResponseText(responseText)) {
        return responseText;
      }
      lastResponse = responseText;
    }

    await sleep(AUTO_RESPONSE_CAPTURE_INTERVAL_MS);
  }

  return lastResponse;
}

async function saveAutoCapturedResponse(
  historyId: number,
  serviceId: string,
  responseText: string,
): Promise<void> {
  const cappedResponseText = capAutoCapturedResponseText(responseText);
  const existingNotes = await getComparisonNotes();
  const existingAutoNote = existingNotes.find(
    (note) =>
      Number(note.historyId) === Number(historyId) &&
      note.serviceId === serviceId &&
      note.captureMode === "auto",
  );

  if (existingAutoNote && !shouldUpdateAutoCapturedResponse(existingAutoNote.responseText, cappedResponseText)) {
    return;
  }

  await saveComparisonNote({
    id: existingAutoNote?.id,
    historyId,
    serviceId,
    responseText: cappedResponseText,
    captureMode: "auto",
    tags: ["auto"],
  });
}

async function autoCaptureBroadcastResponses(
  historyItem: PromptHistoryItem,
  completedRecord: PendingBroadcastRecord,
): Promise<void> {
  const settings = await getAppSettings();
  if (!settings.autoCaptureResponses) {
    return;
  }

  const submittedSiteIds = Array.isArray(completedRecord.submittedSiteIds)
    ? completedRecord.submittedSiteIds
    : [];
  for (const serviceId of submittedSiteIds) {
    const tabId = Number(completedRecord.targetTabIdsBySiteId?.[serviceId]);
    const tab = await findComparisonCaptureTab(serviceId, Number.isFinite(tabId) ? tabId : null);
    if (!tab?.id) {
      continue;
    }

    const responseText = await captureAssistantResponseWithRetry(tab.id, serviceId, historyItem.text);
    if (!responseText.trim()) {
      continue;
    }

    await saveAutoCapturedResponse(Number(historyItem.id), serviceId, responseText);
  }
}

async function handleComparisonCaptureStart(
  message: ComparisonCaptureStartMessage,
): Promise<ComparisonCaptureStartResponse> {
  const historyId = Math.max(0, Math.round(Number(message?.historyId)));
  const serviceId = typeof message?.serviceId === "string" ? message.serviceId.trim() : "";
  if (!historyId || !serviceId) {
    return {
      ok: false,
      captured: false,
      error: "historyId and serviceId are required.",
    };
  }

  const tab = await findComparisonCaptureTab(serviceId, message?.tabId ?? null);
  if (!tab?.id) {
    return {
      ok: true,
      captured: false,
      message: "Open the service tab and run capture again when the response is visible.",
    };
  }

  const history = await getStoredPromptHistory();
  const historyItem = history.find((entry) => Number(entry.id) === historyId);
  const responseText = await captureVisibleAssistantResponse(tab.id, serviceId, historyItem?.text ?? "").catch(() => "");
  if (!responseText.trim()) {
    return {
      ok: true,
      captured: false,
      message: "No visible assistant response was found. Use manual paste or select response text from the service tab.",
    };
  }

  await saveAutoCapturedResponse(historyId, serviceId, responseText);
  const notes = await getComparisonNotes();
  const note = notes.find(
    (entry) =>
      Number(entry.historyId) === Number(historyId) &&
      entry.serviceId === serviceId &&
      entry.captureMode === "auto",
  ) ?? null;
  return {
    ok: true,
    note: note ?? undefined,
    captured: true,
  };
}

function buildExperimentRunId() {
  return typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `experiment-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function handleExperimentSave(
  message: ExperimentSaveMessage,
): Promise<ExperimentSaveResponse> {
  const experiment = await savePromptExperiment(message?.experiment ?? {});
  return {
    ok: true,
    experiment,
  };
}

async function handleExperimentDelete(
  message: ExperimentDeleteMessage,
): Promise<ExperimentDeleteResponse> {
  const experiments = await deletePromptExperiment(message?.experimentId ?? "");
  return {
    ok: true,
    experiments,
  };
}

async function handleExperimentRun(
  message: ExperimentRunMessage,
): Promise<ExperimentRunResponse> {
  const experiments = await getPromptExperiments();
  const experiment = experiments.find((entry) => entry.id === message?.experimentId);
  if (!experiment) {
    return {
      ok: false,
      experiment: null,
      queuedCount: 0,
      broadcastIds: [],
      preview: [],
      error: "Experiment not found.",
    };
  }

  const targetSiteIds = normalizeSiteIdList(experiment.targetSiteIds);
  const variants = experiment.variants.filter((variant) => variant.text.trim());
  const variableSets = experiment.variableSets.length > 0
    ? experiment.variableSets
    : [{ id: "default", title: "Default", values: {} }];
  const preview = variants.flatMap((variant) =>
    variableSets.map((variableSet) => ({
      variantId: variant.id,
      variableSetId: variableSet.id,
      targetSiteIds,
      prompt: renderTemplatePrompt(variant.text, variableSet.values ?? {}),
    })),
  );

  if (targetSiteIds.length === 0 || preview.length === 0) {
    return {
      ok: false,
      experiment,
      queuedCount: 0,
      broadcastIds: [],
      preview,
      error: "Experiment requires at least one variant and one target service.",
    };
  }

  const limitResult = evaluatePromptExperimentRunLimit(
    {
      variants,
      variableSets,
      targetSiteIds,
    },
    message?.confirmedLargeRun === true,
  );

  if (limitResult.reason === "hard_limit") {
    return {
      ok: false,
      experiment,
      queuedCount: 0,
      broadcastIds: [],
      preview,
      error: `Experiment has ${limitResult.broadcastCount} broadcasts. Split it into batches of ${EXPERIMENT_HARD_BROADCAST_LIMIT} or fewer.`,
    };
  }

  if (limitResult.reason === "confirmation_required") {
    return {
      ok: false,
      experiment,
      queuedCount: 0,
      broadcastIds: [],
      preview,
      error: `Experiment has ${limitResult.broadcastCount} broadcasts. Confirm the large run before queuing more than ${EXPERIMENT_SOFT_BROADCAST_LIMIT}.`,
    };
  }

  const runId = buildExperimentRunId();
  const broadcastIds: string[] = [];
  for (const item of preview) {
    const response = await queueBroadcastRequest(
      item.prompt,
      item.targetSiteIds.map((siteId) => ({ id: siteId })),
      {
        trigger: "options",
        experimentRunId: runId,
      },
    );
    if (response?.broadcastId) {
      broadcastIds.push(response.broadcastId);
    }
  }

  const updatedExperiment = await appendPromptExperimentRun(experiment.id, {
    id: runId,
    variantId: preview.length === 1 ? preview[0].variantId : "mixed",
    variableSetId: preview.length === 1 ? preview[0].variableSetId : "mixed",
    targetSiteIds,
    broadcastIds,
    createdAt: nowIso(),
  });

  return {
    ok: broadcastIds.length > 0,
    experiment: updatedExperiment ?? experiment,
    runId,
    queuedCount: broadcastIds.length,
    broadcastIds,
    preview,
    error: broadcastIds.length > 0 ? undefined : "No experiment broadcasts were queued.",
  };
}

function stripFavoriteSensitiveDefaults(
  favorite: FavoritePrompt,
  includeSensitiveDefaults: boolean,
): FavoritePrompt {
  if (includeSensitiveDefaults) {
    return favorite;
  }

  return {
    ...favorite,
    templateDefaults: {},
    steps: favorite.steps.map((step) => ({
      ...step,
      templateDefaults: {},
    })),
  };
}

async function handleTemplatePackExport(
  message: TemplatePackExportMessage,
): Promise<TemplatePackTransferResponse> {
  const favorites = await getPromptFavorites();
  const selectedIds = normalizeSiteIdList(message?.favoriteIds);
  const includeSensitiveDefaults = message?.includeSensitiveDefaults !== false;
  const selectedFavorites = (selectedIds.length > 0
    ? favorites.filter((favorite) => selectedIds.includes(favorite.id))
    : favorites
  ).map((favorite) => stripFavoriteSensitiveDefaults(favorite, includeSensitiveDefaults));

  const pack = await saveTemplatePack({
    title: message?.title || `Template Pack ${new Date().toLocaleDateString()}`,
    description: "",
    favoriteIds: selectedFavorites.map((favorite) => favorite.id),
    templates: selectedFavorites,
    includeSensitiveDefaults,
  });

  return {
    ok: true,
    pack,
  };
}

async function handleTemplatePackImport(
  message: TemplatePackImportMessage,
): Promise<TemplatePackTransferResponse> {
  const pack = await saveTemplatePack(message?.pack ?? {});
  const currentFavorites = await getPromptFavorites();
  const importedFavoriteIds: string[] = [];
  const skippedFavoriteIds: string[] = [];
  const nextFavorites = [...currentFavorites];

  for (const template of pack.templates) {
    const normalizedTemplate = buildFavoriteEntry(template);
    const exactDuplicate = nextFavorites.find((favorite) =>
      favorite.title === normalizedTemplate.title &&
      favorite.text === normalizedTemplate.text,
    );
    if (exactDuplicate) {
      skippedFavoriteIds.push(normalizedTemplate.id);
      continue;
    }

    const importedFavorite = {
      ...normalizedTemplate,
      id: ensureUniqueStringId(nextFavorites, normalizedTemplate.id),
      favoritedAt: nowIso(),
      createdAt: normalizedTemplate.createdAt || nowIso(),
      usageCount: 0,
      lastUsedAt: null,
    };
    nextFavorites.unshift(importedFavorite);
    importedFavoriteIds.push(importedFavorite.id);
  }

  if (importedFavoriteIds.length > 0) {
    await setPromptFavorites(nextFavorites);
  }

  return {
    ok: true,
    pack,
    importedFavoriteIds,
    skippedFavoriteIds,
  };
}

async function handleServiceGroupsUpdate(
  message: ServiceGroupsUpdateMessage,
): Promise<ServiceGroupsUpdateResponse> {
  const groups = await setServiceGroups(message?.groups ?? []);
  return {
    ok: true,
    groups,
  };
}

async function handleSelectorCheckInit(
  message: SelectorCheckInitMessage,
): Promise<SelectorCheckInitResponse> {
  const site = await getSiteForUrl(message?.url ?? "");
  if (!site) {
    return { ok: true, site: null };
  }

  return {
    ok: true,
    site: buildInjectionConfig(site),
  };
}

async function handleSelectorCheckReport(
  message: SelectorCheckReportMessage,
): Promise<SelectorCheckReportResponse> {
  if (
    (message?.status === "ok" ||
      message?.status === "auth_page" ||
      message?.status === "skipped") &&
    message?.siteId
  ) {
    await clearPendingSelectorChecksForSiteId(message.siteId);
    await clearFailedSelector(message.siteId);
    return { ok: true };
  }

  if (message?.status !== "selector_missing") {
    return { ok: true };
  }

  const missing = Array.isArray(message?.missing) ? message.missing : [];
  if (missing.length === 0) {
    return { ok: true };
  }

  const report = {
    siteId: message.siteId ?? "unknown",
    siteName: message.siteName ?? "AI service",
    pageUrl: message.pageUrl ?? "",
    missing,
  };

  const pendingResult = await registerPendingSelectorCheckReport(report);
  if (!pendingResult?.promoted) {
    return { ok: true };
  }

  await maybeCreateSelectorNotification(report);
  await markFailedSelector(
    message.siteId ?? "unknown",
    missing[0]?.selector ?? "",
    "selector-checker"
  );
  return { ok: true };
}

async function handleSelectorFailedMessage(
  message: unknown,
): Promise<GenericOkResponse> {
  const payload = (message ?? {}) as { serviceId?: string; selector?: string };
  const serviceId = payload.serviceId ?? "";
  const selector = payload.selector ?? "";
  const site = await getSiteById(serviceId);

  await clearPendingSelectorChecksForSiteId(serviceId);
  await maybeCreateSelectorNotification({
    siteId: serviceId || "unknown",
    siteName: site?.name || serviceId || "AI service",
    pageUrl: "",
    missing: [
      {
        field: "inputSelector",
        selector,
      },
    ],
  });
  await markFailedSelector(serviceId, selector, "injector");
  await enqueueUiToast({
    message:
      getI18nMessage("toast_selector_failed", [site?.name ?? serviceId]) ||
      `${site?.name ?? serviceId} selector was not found.`,
    type: "error",
    duration: -1,
  });

  return { ok: true };
}

async function handleInjectSuccessMessage(
  message: unknown,
): Promise<GenericOkResponse> {
  const payload = (message ?? {}) as { serviceId?: string };
  if (payload.serviceId) {
    await clearPendingSelectorChecksForSiteId(payload.serviceId);
    await clearFailedSelector(payload.serviceId);
  }

  return { ok: true };
}

async function handleInjectFallbackMessage(
  message: unknown,
): Promise<GenericOkResponse> {
  const payload = (message ?? {}) as { serviceId?: string; copied?: boolean };
  const serviceId = payload.serviceId ?? "";
  const site = await getSiteById(serviceId);
  const copied = Boolean(payload.copied);

  await enqueueUiToast({
    message: copied
      ? (
          getI18nMessage("toast_inject_fallback_copied", [site?.name ?? serviceId]) ||
          `${site?.name ?? serviceId} prompt copied to clipboard. Paste it manually and send.`
        )
      : (
          getI18nMessage("toast_inject_fallback_manual", [site?.name ?? serviceId]) ||
          `${site?.name ?? serviceId} automatic injection failed. Paste the prompt manually and send.`
        ),
    type: "warning",
    duration: 5000,
  });

  return { ok: true };
}

async function handleUiToastMessage(
  message: unknown,
): Promise<GenericOkResponse> {
  const payload = (message ?? {}) as { toast?: Record<string, unknown> };
  await enqueueUiToast(payload.toast ?? {});
  return { ok: true };
}

async function handlePopupOpened(): Promise<{ ok: true; lastBroadcast: LastBroadcastSummary | null }> {
  await reconcilePendingBroadcasts();
  const lastBroadcast = await getLastBroadcast();
  if (!lastBroadcast || lastBroadcast.status !== "sending") {
    await clearBadge();
  }

  return {
    ok: true,
    lastBroadcast,
  };
}

async function handleGetOpenAiTabsMessage(
  message: GetOpenAiTabsMessage,
): Promise<GetOpenAiTabsResponse> {
  const windowId = await getPreferredNormalWindowId(message?.windowId ?? null);
  const tabs = await getOpenAiTabsForWindow(windowId);

  return {
    ok: true,
    windowId,
    tabs,
  };
}

async function handleCancelBroadcastMessage(
  message: CancelBroadcastMessage,
): Promise<CancelBroadcastResponse> {
  const summary = await cancelBroadcast(message?.broadcastId ?? "", "cancelled");
  return {
    ok: Boolean(summary),
    summary,
  };
}

async function resetAllExtensionData(): Promise<GenericOkResponse> {
  await reconcilePendingBroadcasts();

  const pendingBroadcasts = await getPendingBroadcasts();
  for (const broadcastId of Object.keys(pendingBroadcasts)) {
    suppressedCompletedBroadcastIds.add(broadcastId);
    await cancelBroadcast(broadcastId, "reset");
  }

  const remainingInjections = await getPendingInjections();
  await Promise.all(
    Object.entries(remainingInjections).map(async ([tabIdKey, job]) => {
      if (job?.closeOnCancel === false) {
        return;
      }

      await closeTabQuietly(Number(tabIdKey));
    })
  );

  activeInjections.clear();
  queuedInjectionTabIds.clear();
  selectionCache.clear();
  resetRememberedState();

  const alarms = await chrome.alarms.getAll().catch(() => []);
  await Promise.all(
    alarms
      .filter((alarm) => alarm.name.startsWith("apb-favorite-job:"))
      .map((alarm) => chrome.alarms.clear(alarm.name).catch(() => false))
  );

  await queueBackgroundStateMutation((state) => {
    state.pendingInjections = {};
    state.pendingBroadcasts = {};
    state.pendingSelectorChecks = {};
    state.selectorAlerts = {};
    return true;
  });

  await resetPersistedExtensionState({
    additionalSessionKeys: [
      PENDING_INJECTIONS_KEY,
      PENDING_BROADCASTS_KEY,
      PENDING_SELECTOR_CHECKS_KEY,
      SELECTOR_ALERTS_KEY,
    ],
    clearAlarmName: BADGE_CLEAR_ALARM,
  });
  await clearBadge();

  return { ok: true };
}

async function handleGetActiveTabContext(): Promise<ActiveTabContextResponse> {
  try {
    const activeTab = await getPreferredNormalActiveTab();

    const url = typeof activeTab?.url === "string" ? activeTab.url : "";
    const title = typeof activeTab?.title === "string" ? activeTab.title : "";
    if (!isInjectableTabUrl(url)) {
      return { ok: true, url: "", title: "", selection: "" };
    }
    let selection = "";

    if (activeTab?.id) {
      selection = await getSelectedTextFromTab(activeTab.id).catch(() => "");
    }

    return { ok: true, url, title, selection };
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to read active tab context.", error);
    return { ok: false, url: "", title: "", selection: "" };
  }
}

async function handleServiceTestRun(message: ServiceTestRunMessage): Promise<ServiceTestRunResponse> {
  const draft = message?.draft ?? {};
  const selectorErrors = [];
  if (!String(draft?.inputSelector ?? "").trim()) {
    selectorErrors.push("Input selector is required.");
  }

  if (!["textarea", "contenteditable", "input"].includes(String(draft?.inputType ?? ""))) {
    selectorErrors.push("Input type is invalid.");
  }

  if (!["click", "enter", "shift+enter"].includes(String(draft?.submitMethod ?? ""))) {
    selectorErrors.push("Submit method is invalid.");
  }

  if (
    String(draft?.submitMethod ?? "") === "click" &&
    !String(draft?.submitSelector ?? "").trim()
  ) {
    selectorErrors.push("Submit selector is required when using click submit.");
  }

  if (selectorErrors.length > 0) {
    return {
      ok: false,
      reason: "validation_failed",
      error: selectorErrors.join(" "),
    };
  }

  const preferredTab = await getPreferredInjectableNormalTab();
  if (!preferredTab?.ok) {
    return {
      ok: false,
      reason: preferredTab?.reason ?? "no_tab",
    };
  }

  try {
    const tabId = preferredTab.tab.id;
    if (typeof tabId !== "number") {
      return {
        ok: false,
        reason: "no_tab",
      };
    }

    const result = await runServiceTestOnTab(tabId, draft);
    if (!result.ok) {
      return result;
    }

    return {
      ...result,
      tabId,
      tabUrl: preferredTab.tab.url ?? "",
    };
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Service test failed.", error);
    return {
      ok: false,
      reason: "error",
      error: getErrorMessage(error),
    };
  }
}

registerRuntimeMessageRouter(buildRuntimeHandlers({
  handleBroadcastMessage,
  handleSelectorCheckInit,
  handleSelectorCheckReport,
  handleServiceTestRun,
  handleSelectorFailedMessage,
  handleInjectSuccessMessage,
  handleInjectFallbackMessage,
  handleUiToastMessage,
  handlePopupOpened,
  handleGetOpenAiTabsMessage,
  handleCancelBroadcastMessage,
  handleFavoriteRunMessage,
  handleFavoriteOpenEditorMessage,
  resetAllExtensionData,
  handleGetActiveTabContext,
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
        mode: favorite.mode === "chain" ? "chain" : "single",
      })),
    };
  },
  handleQuickPaletteExecuteMessage,
  handleServiceHealthGet,
  handleComparisonNoteList,
  handleComparisonNoteSave,
  handleComparisonNoteDelete,
  handleComparisonCaptureStart,
  handleExperimentSave,
  handleExperimentDelete,
  handleExperimentRun,
  handleTemplatePackExport,
  handleTemplatePackImport,
  handleServiceGroupsUpdate,
}));
registerBackgroundChromeEvents({
  createContextMenus,
  initializeServiceWorker,
  markOnboardingPending: () => setOnboardingCompleted(false),
  openOnboardingPage,
  handleCaptureSelectedTextCommand,
  handleQuickPaletteCommand,
  getContextMenuTargetSiteIds,
  handleContextMenuBroadcast,
  handleContextMenuComparisonNote,
  selectionCache,
  maybeInjectDynamicSelectorChecker,
  queuePendingInjection,
  rememberNormalTab,
  clearRememberedTab,
  getPendingInjections,
  recordBroadcastSiteResult,
  removePendingInjection,
  activeInjections,
  clearBadge,
  reconcilePendingInjections,
  handleFavoriteRunJobAlarm,
  parseScheduleAlarmFavoriteId,
  handleFavoriteScheduleAlarm,
  openPopupWithPrompt,
  reconcileFavoriteSchedules,
});
