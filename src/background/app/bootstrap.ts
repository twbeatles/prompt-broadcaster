import {
  pickBroadcastTargetPrompt,
} from "../../shared/broadcast/resolution";
import { buildQueueTargetSnapshots } from "../../shared/broadcast/target-snapshots";
import {
  applyPendingBroadcastSiteResult as applyBroadcastSiteResultMutation,
  buildPendingBroadcastSummary as buildBroadcastSummary,
  getUnresolvedPendingBroadcastSiteIds as getUnresolvedBroadcastSiteIds,
} from "../../shared/broadcast/state";
import {
  appendPromptHistory,
  getAppSettings,
  getBroadcastCounter,
  getPromptFavorites,
  getTemplateVariableCache,
  markFavoriteUsed,
  normalizeSiteIdList,
  normalizeResultCode,
  setBroadcastCounter,
  updateFavoritePrompt,
} from "../../shared/prompts";
import {
  SYSTEM_TEMPLATE_VARIABLES,
  buildSystemTemplateValues,
  detectTemplateVariables,
  renderTemplatePrompt,
} from "../../shared/template";
import {
  clearFailedSelector,
  enqueueUiToast,
  getLastBroadcast,
  markFailedSelector,
  recordStrategyAttempts,
  resetPersistedExtensionState,
  setLastBroadcast,
  setOnboardingCompleted,
  getStrategyStats,
  setPopupFavoriteIntent,
} from "../../shared/runtime-state";
import {
  buildSubmitRequirement,
  getEnabledRuntimeSites,
  getRuntimeSites,
  shouldProbeSubmitAfterInput,
  shouldRequireVisibleSubmitSurface,
} from "../../shared/sites";
import { evaluateReusableTabSnapshot } from "../../shared/sites/reuse-preflight";
import {
  BADGE_CLEAR_ALARM,
  BADGE_CLEAR_DELAY_MS,
  CAPTURE_SELECTION_COMMAND,
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
  QUICK_PALETTE_COMMAND,
  RECONCILE_ALARM,
  SELECTOR_ALERTS_KEY,
  SELECTOR_CHECKER_SCRIPT_PATH,
  SELECTION_SCRIPT_PATH,
  STANDALONE_POPUP_HEIGHT,
  STANDALONE_POPUP_WIDTH,
  TAB_LOAD_READY_TIMEOUT_MS,
  TAB_POST_SUBMIT_SETTLE_MS,
} from "./constants";
import {
  buildInjectionConfig,
  buildPreferredStrategyOrder,
  buildSiteResult,
  getSiteResultCode,
  normalizeSelectorEntries,
  scaleTimeout,
} from "./injection-helpers";
import { buildSelectorAlertSignature } from "./selector-alerts";
import {
  clearPendingSelectorChecksForService,
  registerPendingSelectorCheck,
} from "./selector-pending";
import { createPopupLauncher } from "../popup/launcher";
import { createQuickPaletteCommand } from "../commands/quick-palette";
import { createSelectionRuntime } from "../selection/runtime";
import { createContextMenuController } from "../context-menu";
import { createFavoriteWorkflow } from "../popup/favorites-workflow";
import { registerRuntimeMessageRouter } from "../messages/router";
import { createBackgroundSessionStore } from "../session/store";
import { createBackgroundTabsRuntime } from "../tabs/runtime";
import { buildRuntimeHandlers } from "../runtime/handlers";
import type {
  ActiveTabContextResponse,
  BroadcastCounterResponse,
  BroadcastMessage,
  BroadcastResponse,
  BroadcastSiteTargetMessage,
  CancelBroadcastMessage,
  CancelBroadcastResponse,
  GenericOkResponse,
  GetOpenAiTabsMessage,
  GetOpenAiTabsResponse,
  SelectorCheckInitMessage,
  SelectorCheckInitResponse,
  SelectorCheckReportMessage,
  SelectorCheckReportResponse,
  ServiceTestRunMessage,
  ServiceTestRunResponse,
} from "../../shared/types/messages";
import type {
  FavoriteExecutionTrigger,
  LastBroadcastSummary,
  PendingBroadcastRecord,
  PendingInjectionRecord,
  ReusableTabSurfaceSnapshot,
  RuntimeInjectionSiteConfig,
  RuntimeSite,
  SiteInjectionResult,
} from "../../shared/types/models";
import type { BackgroundBroadcastWaiter } from "../../shared/types/background";

const DEFAULT_SUBMIT_BUTTON_WAIT_TIMEOUT_MS = 5000;
const DEFAULT_SUBMIT_RETRY_COUNT = 1;

interface ResolvedBroadcastTarget {
  site: RuntimeInjectionSiteConfig;
  targetTabId: number | null;
  requireExplicitTab: boolean;
  forceNewTab: boolean;
  promptOverride?: string;
  resolvedPrompt?: string;
}

interface ExecuteScriptAttempt {
  name: string;
  success: boolean;
}

interface ExecuteScriptInjectionResult {
  status: string;
  error?: string;
  selector?: string;
  strategy?: string;
  inputType?: string;
  elapsedMs?: number;
  attempts?: ExecuteScriptAttempt[];
}

interface ServiceTestProbeSuccess {
  ok: true;
  input: {
    found: boolean;
    selector?: string;
    actualType?: string;
    expectedType?: string;
    typeMatches?: boolean;
  };
  submit: {
    status: string;
    method?: string;
    selector?: string;
  };
}

interface ServiceTestProbeFailure {
  ok: false;
  error: string;
}

type ServiceTestProbeResult = ServiceTestProbeSuccess | ServiceTestProbeFailure;

type PreferredInjectableNormalTabResult =
  | { ok: true; tab: chrome.tabs.Tab; reason?: undefined }
  | { ok: false; reason: string; tab?: chrome.tabs.Tab | null };

type InjectPromptFn =
  (prompt: string, config: any) => Promise<ExecuteScriptInjectionResult> | ExecuteScriptInjectionResult;
type SubmitPromptFn =
  (config: any) => Promise<ExecuteScriptInjectionResult> | ExecuteScriptInjectionResult;

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

const activeInjections = new Set<number>();
const queuedInjectionTabIds = new Set<number>();
const broadcastCompletionWaiters = new Map<string, BackgroundBroadcastWaiter<LastBroadcastSummary>>();
const selectionCache = new Map<number, string>();
const suppressedCompletedBroadcastIds = new Set<string>();
let contextMenuRefreshChain: Promise<void> = Promise.resolve();
let injectionProcessChain: Promise<void> = Promise.resolve();
let runtimeSiteLookupCache: Map<string, RuntimeSite> | null = null;

const SCHEDULED_VARIABLE_BLOCKLIST = new Set([
  SYSTEM_TEMPLATE_VARIABLES.url,
  SYSTEM_TEMPLATE_VARIABLES.title,
  SYSTEM_TEMPLATE_VARIABLES.selection,
  SYSTEM_TEMPLATE_VARIABLES.clipboard,
]);

function getI18nMessage(key: string, substitutions?: string[]): string {
  return chrome.i18n.getMessage(key, substitutions) || "";
}

function nowIso(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, Number.isFinite(ms) ? ms : 0);
  });
}

function clonePlainValue<T>(value: T): T {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

function cacheRuntimeSites(sites: RuntimeSite[]): Map<string, RuntimeSite> {
  runtimeSiteLookupCache = new Map(
    (Array.isArray(sites) ? sites : [])
      .filter((site) => typeof site?.id === "string" && site.id.trim())
      .map((site) => [site.id.trim(), site])
  );
  return runtimeSiteLookupCache ?? new Map<string, RuntimeSite>();
}

async function getRuntimeSiteLookup(forceRefresh = false): Promise<Map<string, RuntimeSite>> {
  if (!runtimeSiteLookupCache || forceRefresh) {
    try {
      cacheRuntimeSites(await getRuntimeSites());
    } catch (_error) {
      runtimeSiteLookupCache = new Map();
    }
  }

  return runtimeSiteLookupCache ?? new Map<string, RuntimeSite>();
}

function normalizePrompt(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function buildChainRunId(): string {
  return typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `chain-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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

function getBroadcastTriggerLabel(trigger: unknown): FavoriteExecutionTrigger {
  const normalized = typeof trigger === "string" ? trigger.trim() : "";
  return normalized === "scheduled"
    || normalized === "palette"
    || normalized === "options"
    ? normalized
    : "popup";
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

const backgroundTabsRuntime = createBackgroundTabsRuntime({
  getRuntimeSites,
  isInjectableTabUrl,
  isSameSiteOrigin,
  isReusableTabForSite,
});
const {
  rememberNormalTab,
  getPreferredNormalWindowId,
  getPreferredNormalActiveTab,
  getFocusedTabContext,
  waitForTabInteractionReady,
  restoreFocusedTabContext,
  getOpenAiTabsForWindow,
  clearRememberedTab,
  resetRememberedState,
} = backgroundTabsRuntime;

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

async function getSiteById(siteId: string): Promise<RuntimeSite | null> {
  const siteLookup = await getRuntimeSiteLookup();
  return siteLookup.get(siteId) ?? null;
}

async function getSiteForUrl(urlString: string): Promise<RuntimeSite | null> {
  try {
    const url = new URL(urlString);
    const sites = [...(await getRuntimeSiteLookup()).values()];
    const normalizedHostname = url.hostname.toLowerCase();

    return (
      sites.find((site) => getAllowedSiteHostnames(site).has(normalizedHostname)) ?? null
    );
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to resolve site for URL.", {
      urlString,
      error,
    });
    return null;
  }
}

function normalizeTargetTabId(value: unknown): number | null {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function buildSelectedTabUnavailableMessage(siteName: string, tabId: number | null): string {
  const label = siteName || "AI service";
  if (Number.isFinite(Number(tabId))) {
    return (
      getI18nMessage("toast_selected_tab_unavailable", [label, String(tabId)]) ||
      `${label} selected tab #${String(tabId)} is unavailable.`
    );
  }

  return (
    getI18nMessage("toast_selected_tab_unavailable", [label]) ||
    `${label} selected tab is unavailable.`
  );
}

async function resolveSelectedTargets(
  siteRefs: Array<string | BroadcastSiteTargetMessage>,
): Promise<ResolvedBroadcastTarget[]> {
  const runtimeSites = await getRuntimeSites();
  cacheRuntimeSites(runtimeSites);
  const resolvedTargets: ResolvedBroadcastTarget[] = [];
  const seenIds = new Set<string>();

  for (const siteRef of Array.isArray(siteRefs) ? siteRefs : []) {
    let resolvedSite = null;
    let targetTabId = null;
    let requireExplicitTab = false;
    let forceNewTab = false;
    let promptOverride: string | undefined;
    let resolvedPrompt: string | undefined;

    if (typeof siteRef === "string") {
      resolvedSite = runtimeSites.find((site) => site.id === siteRef) ?? null;
    } else if (siteRef && typeof siteRef === "object") {
      if (typeof siteRef.id === "string") {
        resolvedSite = runtimeSites.find((site) => site.id === siteRef.id) ?? buildInjectionConfig(siteRef);
      } else {
        resolvedSite = buildInjectionConfig(siteRef);
      }

      targetTabId = normalizeTargetTabId(siteRef.tabId);
      requireExplicitTab = siteRef.target === "tab" || targetTabId !== null;
      forceNewTab =
        siteRef.reuseExistingTab === false ||
        siteRef.openInNewTab === true ||
        siteRef.target === "new";
      promptOverride =
        typeof siteRef.promptOverride === "string" && siteRef.promptOverride.trim()
          ? siteRef.promptOverride.trim()
          : undefined;
      resolvedPrompt =
        typeof siteRef.resolvedPrompt === "string"
          ? siteRef.resolvedPrompt
          : undefined;
    }

    if (!resolvedSite || !resolvedSite.id || seenIds.has(resolvedSite.id)) {
      continue;
    }

    seenIds.add(resolvedSite.id);
    resolvedTargets.push({
      site: buildInjectionConfig(resolvedSite),
      targetTabId,
      requireExplicitTab,
      forceNewTab,
      promptOverride,
      resolvedPrompt,
    });
  }

  return resolvedTargets;
}

function isInjectableTabUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

function getAllowedSiteHostnames(site: Partial<RuntimeSite> | null | undefined): Set<string> {
  const siteUrl = typeof site?.url === "string" ? site.url : "";
  return new Set(
    [
      site?.hostname,
      ...(Array.isArray(site?.hostnameAliases) ? site.hostnameAliases : []),
      isInjectableTabUrl(siteUrl) ? new URL(siteUrl).hostname : "",
    ]
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => entry.trim().toLowerCase())
  );
}

function getSitePermissionPatterns(site: Partial<RuntimeSite> | null | undefined): string[] {
  return Array.isArray(site?.permissionPatterns)
    ? site.permissionPatterns.filter((pattern) => typeof pattern === "string" && pattern.trim())
    : [];
}

async function runReusableTabPreflight(tabId: number, site: RuntimeSite): Promise<boolean> {
  try {
    const inputSelectors = normalizeSelectorEntries([
      site?.inputSelector,
      ...(Array.isArray(site?.fallbackSelectors) ? site.fallbackSelectors : []),
    ]);
    const authSelectors = normalizeSelectorEntries(site?.authSelectors);
    const submitRequirement = buildSubmitRequirement(site);
    const submitSelectors = shouldRequireVisibleSubmitSurface(submitRequirement)
      ? normalizeSelectorEntries([site?.submitSelector])
      : [];

    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: ({ nextInputSelectors, nextAuthSelectors, nextSubmitSelectors }) => {
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

        function isEditableElement(element: Element): boolean {
          if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
            return !element.readOnly;
          }

          return element instanceof HTMLElement ? element.isContentEditable : false;
        }

        function collectElementsDeep(
          selector: string,
          root: Document | ShadowRoot,
          matches: Element[],
          seen: Set<Element>,
        ): void {
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
              collectElementsDeep(selector, current.shadowRoot, matches, seen);
            }
            current = walker.nextNode();
          }
        }

        function findDeep(selectors: string[], { editableOnly = false }: { editableOnly?: boolean } = {}): boolean {
          for (const selector of selectors) {
            try {
              const matches: Element[] = [];
              collectElementsDeep(selector, document, matches, new Set());
              const match = matches.find((element) =>
                isElementVisible(element) && (!editableOnly || isEditableElement(element))
              );
              if (match) {
                return true;
              }
            } catch (_error) {
              // Ignore invalid or stale selectors during lightweight preflight.
            }
          }

          return false;
        }

        return {
          pathname: window.location.pathname,
          hasPromptSurface: findDeep(nextInputSelectors, { editableOnly: true }),
          hasAuthSurface: findDeep(nextAuthSelectors),
          hasSubmitSurface:
            nextSubmitSelectors.length === 0 ? true : findDeep(nextSubmitSelectors),
        };
      },
      args: [{
        nextInputSelectors: inputSelectors,
        nextAuthSelectors: authSelectors,
        nextSubmitSelectors: submitSelectors,
      }],
    });

    const snapshot = (result?.result ?? {}) as ReusableTabSurfaceSnapshot;
    return evaluateReusableTabSnapshot({
      pathname: snapshot.pathname,
      supportedRoutes: Array.isArray(site?.supportedRoutes) ? site.supportedRoutes : [],
      hasPromptSurface: snapshot.hasPromptSurface,
      hasAuthSurface: snapshot.hasAuthSurface,
      hasSubmitSurface: snapshot.hasSubmitSurface,
      submitRequirement,
    }).ok === true;
  } catch (_error) {
    return false;
  }
}

async function isReusableTabForSite(tab: chrome.tabs.Tab, site: RuntimeSite): Promise<boolean> {
  const tabId = tab.id;
  const tabUrl = typeof tab.url === "string" ? tab.url : "";
  if (typeof tabId !== "number" || !isInjectableTabUrl(tabUrl)) {
    return false;
  }

  if (!isSameSiteOrigin(tabUrl, site)) {
    return false;
  }

  return runReusableTabPreflight(tabId, site);
}

async function isCustomSitePermissionGranted(site: RuntimeSite): Promise<boolean> {
  const permissionPatterns = getSitePermissionPatterns(site);
  if (!site?.isCustom || permissionPatterns.length === 0) {
    return true;
  }

  try {
    return await chrome.permissions.contains({
      origins: permissionPatterns,
    });
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to check custom site permission.", {
      siteId: site?.id,
      error,
    });
    return false;
  }
}

function scoreReusableTabForSite(tab: chrome.tabs.Tab, site: RuntimeSite): number {
  const tabUrl = typeof tab?.url === "string" ? tab.url : "";
  const siteUrl = typeof site?.url === "string" ? site.url : "";
  const exactUrlMatch = Boolean(siteUrl && tabUrl.startsWith(siteUrl));
  const activePenalty = tab?.active ? 10 : 0;

  return (exactUrlMatch ? 0 : 5) + activePenalty;
}

async function findReusableTabsForSites(
  sites: RuntimeSite[],
  options: { windowId?: number | null; excludeTabId?: number | null } = {},
): Promise<Map<string, chrome.tabs.Tab>> {
  const windowId = Number(options?.windowId);
  if (!Number.isFinite(windowId)) {
    return new Map();
  }

  try {
    const [tabs, pendingInjections] = await Promise.all([
      chrome.tabs.query({ windowId }),
      getPendingInjections(),
    ]);

    const excludedTabIds = new Set(
      Object.keys(pendingInjections)
        .map((tabId) => Number(tabId))
        .filter((tabId) => Number.isFinite(tabId))
    );

    if (Number.isFinite(Number(options?.excludeTabId))) {
      excludedTabIds.add(Number(options.excludeTabId));
    }

    const reusableTabsBySiteId = new Map<string, chrome.tabs.Tab>();
    const usedTabIds = new Set<number>();

    for (const site of Array.isArray(sites) ? sites : []) {
      const candidates = tabs
        .filter((tab) => {
          const candidateId = tab.id;
          const candidateUrl = typeof tab.url === "string" ? tab.url : "";
          if (typeof candidateId !== "number" || usedTabIds.has(candidateId) || excludedTabIds.has(candidateId)) {
            return false;
          }

          if (!isInjectableTabUrl(candidateUrl)) {
            return false;
          }

          return isSameSiteOrigin(candidateUrl, site);
        })
        .sort((left, right) => scoreReusableTabForSite(left, site) - scoreReusableTabForSite(right, site));

      for (const candidate of candidates) {
        if (!(await isReusableTabForSite(candidate, site))) {
          continue;
        }

        reusableTabsBySiteId.set(site.id, candidate);
        if (typeof candidate.id === "number") {
          usedTabIds.add(candidate.id);
        }
        break;
      }
    }

    return reusableTabsBySiteId;
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to discover reusable AI tabs.", {
      windowId,
      error,
    });
    return new Map();
  }
}

async function getExplicitReusableTabForTarget(
  target: ResolvedBroadcastTarget,
): Promise<{
  requested: boolean;
  tab: chrome.tabs.Tab | null;
  message?: string;
}> {
  if (!target?.requireExplicitTab) {
    return {
      requested: false,
      tab: null,
    };
  }

  const targetTabId = Number(target?.targetTabId);
  if (!Number.isFinite(targetTabId)) {
    return {
      requested: true,
      tab: null,
      message: buildSelectedTabUnavailableMessage(target.site?.name ?? "", null),
    };
  }

  try {
    const tab = await chrome.tabs.get(targetTabId);
    if (!tab?.id || !isInjectableTabUrl(tab?.url ?? "")) {
      return {
        requested: true,
        tab: null,
        message: buildSelectedTabUnavailableMessage(target.site?.name ?? "", targetTabId),
      };
    }

    return (await isReusableTabForSite(tab, target.site))
      ? {
          requested: true,
          tab,
        }
      : {
          requested: true,
          tab: null,
          message: buildSelectedTabUnavailableMessage(target.site?.name ?? "", targetTabId),
        };
  } catch (_error) {
    return {
      requested: true,
      tab: null,
      message: buildSelectedTabUnavailableMessage(target.site?.name ?? "", targetTabId),
    };
  }
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


async function getPreferredInjectableNormalTab(): Promise<PreferredInjectableNormalTabResult> {
  const tab = await getPreferredNormalActiveTab();
  if (!tab?.id) {
    return {
      ok: false,
      reason: "no_tab",
    };
  }

  const tabUrl = typeof tab.url === "string" ? tab.url : "";
  if (!isInjectableTabUrl(tabUrl)) {
    return {
      ok: false,
      reason: "invalid_tab",
      tab,
    };
  }

  return {
    ok: true,
    tab,
  };
}

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
        `${report.siteName} selector update required`,
      message:
        getI18nMessage("notification_selector_message", [report.siteName]) ||
        `${report.siteName} selector changed. Update config/sites.js to restore automatic injection.`,
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
        await appendPromptHistory({
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
          trigger: completedRecord.trigger ?? "popup",
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

function isSameSiteOrigin(tabUrl: string, site: RuntimeSite): boolean {
  try {
    const hostname = new URL(tabUrl).hostname.toLowerCase();
    return getAllowedSiteHostnames(site).has(hostname);
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to compare site origin.", {
      tabUrl,
      site,
      error,
    });
    return false;
  }
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
  if (!job || job.injected === true) {
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

    const age = Date.now() - Number(job.createdAt || 0);
    if (age > PENDING_TIMEOUT_MS) {
      await handlePendingInjectionTimeout(tabId, job);
      continue;
    }

    if (job.injected === true) {
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

      if (!reusableTab) {
        await queueBackgroundStateMutation((state) => {
          const record = state.pendingBroadcasts[broadcast.id];
          if (!record) {
            return null;
          }

          record.openedTabIds = Array.from(
            new Set([...(Array.isArray(record.openedTabIds) ? record.openedTabIds : []), targetTab.id])
          );
          state.pendingBroadcasts[broadcast.id] = record;
          return clonePlainValue(record.openedTabIds);
        });
      }

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
    if (message.status === "ok") {
      await clearFailedSelector(message.siteId);
    }
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
}));

chrome.runtime.onInstalled.addListener(({ reason }) => {
  void (async () => {
    await createContextMenus();
    await initializeServiceWorker();

    if (reason === "install") {
      await setOnboardingCompleted(false);
      await openOnboardingPage();
    }
  })();
});

chrome.runtime.onStartup.addListener(() => {
  void initializeServiceWorker();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === CAPTURE_SELECTION_COMMAND) {
    void handleCaptureSelectedTextCommand();
    return;
  }

  if (command === QUICK_PALETTE_COMMAND) {
    void handleQuickPaletteCommand();
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void (async () => {
    try {
      const siteIds = await getContextMenuTargetSiteIds(info.menuItemId);
      if (siteIds.length === 0) {
        return;
      }

      const selectedText = typeof info.selectionText === "string"
        ? info.selectionText.trim()
        : "";

      if (!selectedText && typeof tab?.id === "number") {
        const cachedText = selectionCache.get(tab.id) ?? "";
        if (cachedText.trim()) {
          await handleContextMenuBroadcast(cachedText, siteIds);
        }
        return;
      }

      if (typeof tab?.id === "number" && selectedText) {
        selectionCache.set(tab.id, selectedText);
      }

      await handleContextMenuBroadcast(selectedText, siteIds);
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Context menu click handling failed.", error);
    }
  })();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") {
    return;
  }

  void maybeInjectDynamicSelectorChecker(tabId, tab);
  void queuePendingInjection(tabId, tab);
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  void (async () => {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      await rememberNormalTab(tab);
    } catch (_error) {
      // Ignore hint update failures.
    }
  })();
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (!Number.isFinite(windowId) || windowId === chrome.windows.WINDOW_ID_NONE) {
    return;
  }

  void (async () => {
    try {
      const windowInfo = await chrome.windows.get(windowId).catch(() => null);
      if (windowInfo?.type !== "normal") {
        return;
      }

      const [activeTab] = await chrome.tabs.query({
        active: true,
        windowId,
      });
      await rememberNormalTab(activeTab);
    } catch (_error) {
      // Ignore hint update failures.
    }
  })();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void (async () => {
    try {
      selectionCache.delete(tabId);
      clearRememberedTab(tabId);
      const pending = await getPendingInjections();
      const job = pending[String(tabId)];

      if (job?.broadcastId && job?.siteId) {
        await recordBroadcastSiteResult(job.broadcastId, job.siteId, "tab_closed");
      }

      await removePendingInjection(tabId);
      activeInjections.delete(tabId);
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Tab removal cleanup failed.", {
        tabId,
        error,
      });
      activeInjections.delete(tabId);
    }
  })();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RECONCILE_ALARM) {
    void reconcilePendingInjections();
    return;
  }

  if (alarm.name === BADGE_CLEAR_ALARM) {
    void clearBadge();
    return;
  }

  if (alarm.name.startsWith("apb-favorite-job:")) {
    void handleFavoriteRunJobAlarm(alarm.name);
    return;
  }

  const favoriteId = parseScheduleAlarmFavoriteId(alarm.name);
  if (favoriteId) {
    void handleFavoriteScheduleAlarm(favoriteId);
  }
});

chrome.notifications.onClicked.addListener(() => {
  void openPopupWithPrompt();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && (changes.customSites || changes.builtInSiteStates || changes.builtInSiteOverrides)) {
    void createContextMenus();
  }

  if (areaName === "local" && changes.promptFavorites) {
    void reconcileFavoriteSchedules();
  }
});

void initializeServiceWorker();
