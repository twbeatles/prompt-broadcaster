// @ts-nocheck
import {
  pickBroadcastTargetPrompt,
} from "../../shared/broadcast/resolution";
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
  getStrategyStats,
  setPopupFavoriteIntent,
} from "../../shared/runtime-state";
import {
  getEnabledRuntimeSites,
  getRuntimeSites,
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
import { createPopupLauncher } from "../popup/launcher";
import { createQuickPaletteCommand } from "../commands/quick-palette";
import { createSelectionRuntime } from "../selection/runtime";
import { createContextMenuController } from "../context-menu";
import { createFavoriteWorkflow } from "../popup/favorites-workflow";
import { registerRuntimeMessageRouter } from "../messages/router";

const DEFAULT_SUBMIT_BUTTON_WAIT_TIMEOUT_MS = 5000;
const DEFAULT_SUBMIT_RETRY_COUNT = 1;

const activeInjections = new Set();
const queuedInjectionTabIds = new Set();
const broadcastCompletionWaiters = new Map();
const selectionCache = new Map();
const suppressedCompletedBroadcastIds = new Set();
const backgroundSessionState = {
  loaded: false,
  pendingInjections: {},
  pendingBroadcasts: {},
  selectorAlerts: {},
};
let lastNormalWindowId = null;
let lastNormalTabId = null;
let contextMenuRefreshChain = Promise.resolve();
let injectionProcessChain = Promise.resolve();
let backgroundStateMutationChain = Promise.resolve();

const SCHEDULED_VARIABLE_BLOCKLIST = new Set([
  SYSTEM_TEMPLATE_VARIABLES.url,
  SYSTEM_TEMPLATE_VARIABLES.title,
  SYSTEM_TEMPLATE_VARIABLES.selection,
  SYSTEM_TEMPLATE_VARIABLES.clipboard,
]);

function getI18nMessage(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || "";
}

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, Number.isFinite(ms) ? ms : 0);
  });
}

function clonePlainValue(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

function normalizePrompt(value) {
  return typeof value === "string" ? value : "";
}

function buildChainRunId() {
  return typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `chain-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function registerBroadcastCompletionWaiter(broadcastId) {
  const normalizedBroadcastId =
    typeof broadcastId === "string" ? broadcastId.trim() : "";
  if (!normalizedBroadcastId) {
    return Promise.resolve(null);
  }

  const existing = broadcastCompletionWaiters.get(normalizedBroadcastId);
  if (existing?.promise) {
    return existing.promise;
  }

  let resolvePromise = null;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  broadcastCompletionWaiters.set(normalizedBroadcastId, {
    promise,
    resolve: resolvePromise,
  });

  return promise;
}

function resolveBroadcastCompletionWaiter(broadcastId, summary = null) {
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

function getBroadcastTriggerLabel(trigger) {
  const normalized = typeof trigger === "string" ? trigger.trim() : "";
  return normalized || "popup";
}

async function rememberNormalTab(tab) {
  if (!tab?.id || !Number.isFinite(tab.windowId)) {
    return null;
  }

  try {
    const windowInfo = await chrome.windows.get(tab.windowId).catch(() => null);
    if (windowInfo?.type !== "normal") {
      return null;
    }

    lastNormalWindowId = windowInfo.id;
    lastNormalTabId = tab.id;
    return tab;
  } catch (_error) {
    return null;
  }
}

async function getPreferredNormalActiveTab(preferredWindowId = null) {
  try {
    const [lastFocusedTab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    const rememberedLastFocused = await rememberNormalTab(lastFocusedTab);
    if (rememberedLastFocused) {
      return rememberedLastFocused;
    }
  } catch (_error) {
    // Fall through to additional normal-window strategies.
  }

  const targetWindowId = await getPreferredNormalWindowId(preferredWindowId);
  if (Number.isFinite(targetWindowId)) {
    try {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        windowId: targetWindowId,
      });
      const rememberedTargetTab = await rememberNormalTab(activeTab);
      if (rememberedTargetTab) {
        return rememberedTargetTab;
      }
    } catch (_error) {
      // Fall through to tab-id/window-id hints below.
    }
  }

  if (Number.isFinite(lastNormalTabId)) {
    try {
      const hintTab = await chrome.tabs.get(lastNormalTabId);
      const rememberedHintTab = await rememberNormalTab(hintTab);
      if (rememberedHintTab) {
        return rememberedHintTab;
      }
    } catch (_error) {
      lastNormalTabId = null;
    }
  }

  if (Number.isFinite(lastNormalWindowId)) {
    try {
      const [hintWindowTab] = await chrome.tabs.query({
        active: true,
        windowId: lastNormalWindowId,
      });
      const rememberedHintWindowTab = await rememberNormalTab(hintWindowTab);
      if (rememberedHintWindowTab) {
        return rememberedHintWindowTab;
      }
    } catch (_error) {
      lastNormalWindowId = null;
    }
  }

  return null;
}

async function getFocusedTabContext() {
  try {
    const activeTab = await getPreferredNormalActiveTab();

    if (!activeTab?.id || !Number.isFinite(activeTab.windowId)) {
      return null;
    }

    return {
      tabId: activeTab.id,
      windowId: activeTab.windowId,
    };
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to read focused tab context.", error);
    return null;
  }
}

async function isTabLoadReady(tabId) {
  try {
    const [executionResult] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({ readyState: document.readyState }),
    });

    const result = executionResult?.result ?? {};
    return result.readyState === "interactive" || result.readyState === "complete";
  } catch (_error) {
    return false;
  }
}

async function waitForTabInteractionReady(tabId, timeoutMs = TAB_LOAD_READY_TIMEOUT_MS) {
  const deadline = Date.now() + Math.max(timeoutMs, 0);

  while (Date.now() <= deadline) {
    if (await isTabLoadReady(tabId)) {
      return true;
    }

    await sleep(150);
  }

  return false;
}

async function restoreFocusedTabContext(context) {
  if (!context?.tabId || !Number.isFinite(context.windowId)) {
    return;
  }

  try {
    await chrome.windows.update(context.windowId, { focused: true });
    await chrome.tabs.update(context.tabId, { active: true });
  } catch (_error) {
    // Ignore restore failures when the original tab or window no longer exists.
  }
}

function queuePendingInjection(tabId, tab) {
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

function getBroadcastAgeMs(record) {
  const startedAtMs = Date.parse(record?.startedAt ?? "");
  return Number.isFinite(startedAtMs) ? Date.now() - startedAtMs : 0;
}

async function finalizeBroadcastSites(broadcastId, siteIds, status) {
  let lastSummary = null;

  for (const siteId of Array.isArray(siteIds) ? siteIds : []) {
    lastSummary = (await recordBroadcastSiteResult(broadcastId, siteId, status)) ?? lastSummary;
  }

  return lastSummary;
}

async function closeTabQuietly(tabId) {
  try {
    await chrome.tabs.remove(tabId);
  } catch (_error) {
    // Ignore already-closed tabs.
  }
}

async function restoreBroadcastFocus(record) {
  if (!record) {
    return;
  }

  await restoreFocusedTabContext({
    tabId: Number.isFinite(Number(record.originTabId)) ? Number(record.originTabId) : null,
    windowId: Number.isFinite(Number(record.originWindowId)) ? Number(record.originWindowId) : null,
  });
}

async function ensureBackgroundSessionStateLoaded() {
  if (backgroundSessionState.loaded) {
    return;
  }

  try {
    const result = await chrome.storage.session.get([
      PENDING_INJECTIONS_KEY,
      PENDING_BROADCASTS_KEY,
      SELECTOR_ALERTS_KEY,
    ]);
    backgroundSessionState.pendingInjections = clonePlainValue(result[PENDING_INJECTIONS_KEY] ?? {}) ?? {};
    backgroundSessionState.pendingBroadcasts = clonePlainValue(result[PENDING_BROADCASTS_KEY] ?? {}) ?? {};
    backgroundSessionState.selectorAlerts = clonePlainValue(result[SELECTOR_ALERTS_KEY] ?? {}) ?? {};
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to initialize session-state cache.", error);
    backgroundSessionState.pendingInjections = {};
    backgroundSessionState.pendingBroadcasts = {};
    backgroundSessionState.selectorAlerts = {};
  }

  backgroundSessionState.loaded = true;
}

async function persistBackgroundSessionState() {
  await chrome.storage.session.set({
    [PENDING_INJECTIONS_KEY]: backgroundSessionState.pendingInjections,
    [PENDING_BROADCASTS_KEY]: backgroundSessionState.pendingBroadcasts,
    [SELECTOR_ALERTS_KEY]: backgroundSessionState.selectorAlerts,
  });
}

function queueBackgroundStateMutation(mutator) {
  const runMutation = async () => {
    await ensureBackgroundSessionStateLoaded();
    const result = await mutator(backgroundSessionState);
    await persistBackgroundSessionState();
    return result;
  };

  const resultPromise = backgroundStateMutationChain.then(runMutation, runMutation);
  backgroundStateMutationChain = resultPromise.then(() => undefined, () => undefined);
  return resultPromise;
}

async function waitForBackgroundStateSettled() {
  await backgroundStateMutationChain;
}

async function getPendingInjections() {
  await ensureBackgroundSessionStateLoaded();
  return clonePlainValue(backgroundSessionState.pendingInjections) ?? {};
}

async function setPendingInjections(value) {
  return queueBackgroundStateMutation((state) => {
    state.pendingInjections = clonePlainValue(value) ?? {};
    return clonePlainValue(state.pendingInjections) ?? {};
  });
}

async function getPendingBroadcasts() {
  await ensureBackgroundSessionStateLoaded();
  return clonePlainValue(backgroundSessionState.pendingBroadcasts) ?? {};
}

async function setPendingBroadcasts(value) {
  return queueBackgroundStateMutation((state) => {
    state.pendingBroadcasts = clonePlainValue(value) ?? {};
    return clonePlainValue(state.pendingBroadcasts) ?? {};
  });
}

async function getSelectorAlerts() {
  await ensureBackgroundSessionStateLoaded();
  return clonePlainValue(backgroundSessionState.selectorAlerts) ?? {};
}

async function setSelectorAlerts(value) {
  return queueBackgroundStateMutation((state) => {
    state.selectorAlerts = clonePlainValue(value) ?? {};
    return clonePlainValue(state.selectorAlerts) ?? {};
  });
}

async function updatePendingInjection(tabId, updater) {
  return queueBackgroundStateMutation((state) => {
    const pending = state.pendingInjections ?? {};
    const current = pending[String(tabId)];
    const nextValue = typeof updater === "function" ? updater(clonePlainValue(current) ?? current) : updater;

    if (nextValue) {
      pending[String(tabId)] = nextValue;
    } else {
      delete pending[String(tabId)];
    }

    state.pendingInjections = pending;
    return clonePlainValue(nextValue) ?? null;
  });
}

async function addPendingInjection(tabId, payload) {
  return updatePendingInjection(tabId, {
    ...payload,
    tabId,
    createdAt: Number(payload?.createdAt) || Date.now(),
    injected: Boolean(payload?.injected),
    status: payload?.status || "pending",
    closeOnCancel: payload?.closeOnCancel !== false,
  });
}

async function removePendingInjection(tabId) {
  await updatePendingInjection(tabId, null);
}

async function getSiteById(siteId) {
  const sites = await getRuntimeSites();
  return sites.find((site) => site.id === siteId) ?? null;
}

async function getSiteForUrl(urlString) {
  try {
    const url = new URL(urlString);
    const sites = await getRuntimeSites();
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

function normalizeTargetTabId(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

async function resolveSelectedTargets(siteRefs) {
  const runtimeSites = await getRuntimeSites();
  const resolvedTargets = [];
  const seenIds = new Set();

  for (const siteRef of Array.isArray(siteRefs) ? siteRefs : []) {
    let resolvedSite = null;
    let targetTabId = null;
    let forceNewTab = false;
    let promptOverride = null;
    let resolvedPrompt = null;

    if (typeof siteRef === "string") {
      resolvedSite = runtimeSites.find((site) => site.id === siteRef) ?? null;
    } else if (siteRef && typeof siteRef === "object") {
      if (typeof siteRef.id === "string") {
        resolvedSite = runtimeSites.find((site) => site.id === siteRef.id) ?? buildInjectionConfig(siteRef);
      } else {
        resolvedSite = buildInjectionConfig(siteRef);
      }

      targetTabId = normalizeTargetTabId(siteRef.tabId);
      forceNewTab =
        siteRef.reuseExistingTab === false ||
        siteRef.openInNewTab === true ||
        siteRef.target === "new";
      promptOverride =
        typeof siteRef.promptOverride === "string" && siteRef.promptOverride.trim()
          ? siteRef.promptOverride.trim()
          : null;
      resolvedPrompt =
        typeof siteRef.resolvedPrompt === "string"
          ? siteRef.resolvedPrompt
          : null;
    }

    if (!resolvedSite || !resolvedSite.id || seenIds.has(resolvedSite.id)) {
      continue;
    }

    seenIds.add(resolvedSite.id);
    resolvedTargets.push({
      site: buildInjectionConfig(resolvedSite),
      targetTabId,
      forceNewTab,
      promptOverride,
      resolvedPrompt,
    });
  }

  return resolvedTargets;
}

function isInjectableTabUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

function getAllowedSiteHostnames(site) {
  return new Set(
    [
      site?.hostname,
      ...(Array.isArray(site?.hostnameAliases) ? site.hostnameAliases : []),
      isInjectableTabUrl(site?.url ?? "") ? new URL(site.url).hostname : "",
    ]
      .filter((entry) => typeof entry === "string" && entry.trim())
      .map((entry) => entry.trim().toLowerCase())
  );
}

function getSitePermissionPatterns(site) {
  return Array.isArray(site?.permissionPatterns)
    ? site.permissionPatterns.filter((pattern) => typeof pattern === "string" && pattern.trim())
    : [];
}

async function runReusableTabPreflight(tabId, site) {
  try {
    const inputSelectors = normalizeSelectorEntries([
      site?.inputSelector,
      ...(Array.isArray(site?.fallbackSelectors) ? site.fallbackSelectors : []),
    ]);
    const authSelectors = normalizeSelectorEntries(site?.authSelectors);
    const submitSelectors = (
      site?.submitMethod === "click" &&
      site?.selectorCheckMode !== "input-only" &&
      typeof site?.submitSelector === "string" &&
      site.submitSelector.trim()
    )
      ? normalizeSelectorEntries([site.submitSelector])
      : [];

    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: ({ nextInputSelectors, nextAuthSelectors, nextSubmitSelectors }) => {
        function isElementVisible(element) {
          if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
            return true;
          }

          const style = window.getComputedStyle(element);
          if (
            element.hidden ||
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

        function isEditableElement(element) {
          if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
            return !element.readOnly;
          }

          return element instanceof HTMLElement ? element.isContentEditable : false;
        }

        function collectElementsDeep(selector, root, matches, seen) {
          if (typeof root.querySelectorAll === "function") {
            for (const element of Array.from(root.querySelectorAll(selector))) {
              if (!seen.has(element)) {
                seen.add(element);
                matches.push(element);
              }
            }
          }

          const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
          let current = walker.currentNode;
          while (current) {
            if (current.shadowRoot) {
              collectElementsDeep(selector, current.shadowRoot, matches, seen);
            }
            current = walker.nextNode();
          }
        }

        function findDeep(selectors, { editableOnly = false } = {}) {
          for (const selector of selectors) {
            try {
              const matches = [];
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

    const snapshot = result?.result ?? {};
    return evaluateReusableTabSnapshot({
      pathname: snapshot.pathname,
      hasPromptSurface: snapshot.hasPromptSurface,
      hasAuthSurface: snapshot.hasAuthSurface,
      hasSubmitSurface: snapshot.hasSubmitSurface,
      requiresSubmitSurface: submitSelectors.length > 0,
    }).ok === true;
  } catch (_error) {
    return false;
  }
}

async function isReusableTabForSite(tab, site) {
  if (!Number.isFinite(tab?.id) || !isInjectableTabUrl(tab?.url ?? "")) {
    return false;
  }

  if (!isSameSiteOrigin(tab.url, site)) {
    return false;
  }

  return runReusableTabPreflight(tab.id, site);
}

async function isCustomSitePermissionGranted(site) {
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

function scoreReusableTabForSite(tab, site) {
  const tabUrl = typeof tab?.url === "string" ? tab.url : "";
  const siteUrl = typeof site?.url === "string" ? site.url : "";
  const exactUrlMatch = Boolean(siteUrl && tabUrl.startsWith(siteUrl));
  const activePenalty = tab?.active ? 10 : 0;

  return (exactUrlMatch ? 0 : 5) + activePenalty;
}

async function findReusableTabsForSites(sites, options = {}) {
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

    const reusableTabsBySiteId = new Map();
    const usedTabIds = new Set();

    for (const site of Array.isArray(sites) ? sites : []) {
      const candidates = tabs
        .filter((tab) => {
          if (!Number.isFinite(tab?.id) || usedTabIds.has(tab.id) || excludedTabIds.has(tab.id)) {
            return false;
          }

          if (!isInjectableTabUrl(tab?.url ?? "")) {
            return false;
          }

          return isSameSiteOrigin(tab.url, site);
        })
        .sort((left, right) => scoreReusableTabForSite(left, site) - scoreReusableTabForSite(right, site));

      for (const candidate of candidates) {
        if (!(await isReusableTabForSite(candidate, site))) {
          continue;
        }

        reusableTabsBySiteId.set(site.id, candidate);
        usedTabIds.add(candidate.id);
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

async function getPreferredNormalWindowId(preferredWindowId = null) {
  const normalizedPreferredWindowId = Number(preferredWindowId);
  if (Number.isFinite(normalizedPreferredWindowId)) {
    try {
      const preferredWindow = await chrome.windows.get(normalizedPreferredWindowId);
      if (preferredWindow?.type === "normal") {
        return preferredWindow.id;
      }
    } catch (_error) {
      // Fall through to auto-discovery when the preferred window no longer exists.
    }
  }

  try {
    const [lastFocusedTab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });

    if (Number.isFinite(lastFocusedTab?.windowId)) {
      const windowInfo = await chrome.windows.get(lastFocusedTab.windowId).catch(() => null);
      if (windowInfo?.type === "normal") {
        return windowInfo.id;
      }
    }
  } catch (_error) {
    // Fall back to the currently available normal windows below.
  }

  if (Number.isFinite(lastNormalWindowId)) {
    try {
      const rememberedWindow = await chrome.windows.get(lastNormalWindowId);
      if (rememberedWindow?.type === "normal") {
        return rememberedWindow.id;
      }
    } catch (_error) {
      lastNormalWindowId = null;
    }
  }

  try {
    const windows = await chrome.windows.getAll({
      windowTypes: ["normal"],
    });
    const focusedWindow = windows.find((windowInfo) => windowInfo?.focused && Number.isFinite(windowInfo?.id));
    return focusedWindow?.id ?? windows.find((windowInfo) => Number.isFinite(windowInfo?.id))?.id ?? null;
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to resolve preferred normal window.", error);
    return null;
  }
}

async function getOpenAiTabsForWindow(windowId) {
  const normalizedWindowId = Number(windowId);
  if (!Number.isFinite(normalizedWindowId)) {
    return [];
  }

  try {
    const [runtimeSites, tabs] = await Promise.all([
      getRuntimeSites(),
      chrome.tabs.query({ windowId: normalizedWindowId }),
    ]);

    const openTabs = await Promise.all(tabs.map(async (tab) => {
        if (!Number.isFinite(tab?.id) || !isInjectableTabUrl(tab?.url ?? "")) {
          return null;
        }

        const site = runtimeSites.find((entry) => isSameSiteOrigin(tab.url, entry));
        if (!site) {
          return null;
        }

        if (!(await isReusableTabForSite(tab, site))) {
          return null;
        }

        return {
          siteId: site.id,
          siteName: site.name,
          tabId: tab.id,
          title: typeof tab.title === "string" ? tab.title : "",
          url: typeof tab.url === "string" ? tab.url : "",
          active: Boolean(tab.active),
          status: typeof tab.status === "string" ? tab.status : "",
          windowId: normalizedWindowId,
        };
      }));

    return openTabs.filter(Boolean);
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to collect open AI tabs.", {
      windowId: normalizedWindowId,
      error,
    });
    return [];
  }
}

async function getExplicitReusableTabForTarget(target) {
  const targetTabId = Number(target?.targetTabId);
  if (!Number.isFinite(targetTabId)) {
    return null;
  }

  try {
    const tab = await chrome.tabs.get(targetTabId);
    if (!tab?.id || !isInjectableTabUrl(tab?.url ?? "")) {
      return null;
    }

    return (await isReusableTabForSite(tab, target.site)) ? tab : null;
  } catch (_error) {
    return null;
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
  reconcileFavoriteSchedules,
  handleFavoriteScheduleAlarm,
  handleFavoriteRunMessage,
  handleFavoriteOpenEditorMessage,
  handleQuickPaletteGetState,
  handleQuickPaletteExecuteMessage,
} = createFavoriteWorkflow({
  getBroadcastTriggerLabel,
  rememberNormalTab,
  getPreferredNormalActiveTab,
  isInjectableTabUrl,
  getSelectedTextFromTab,
  openPopupWithPrompt,
  nowIso,
  sleep,
  buildChainRunId,
  queueBroadcastRequest,
  registerBroadcastCompletionWaiter,
});


async function getPreferredInjectableNormalTab() {
  const tab = await getPreferredNormalActiveTab();
  if (!tab?.id) {
    return null;
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

async function runServiceTestOnTab(tabId, draft) {
  const probeText = "__apb_probe__";
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (siteDraft, nextProbeText) => {
      function isElementVisible(element) {
        if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
          return true;
        }

        const style = window.getComputedStyle(element);
        if (
          element.hidden ||
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

      function findElementsDeep(selector, root = document, seen = new Set(), matches = []) {
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
        let current = walker.currentNode;
        while (current) {
          if (current.shadowRoot) {
            findElementsDeep(selector, current.shadowRoot, seen, matches);
          }
          current = walker.nextNode();
        }

        return matches;
      }

      function findBestMatch(selectors, options = {}) {
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

      function detectInputType(element) {
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

      function highlightElement(element, color) {
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

      function snapshotElementValue(element) {
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

      function restoreElementValue(element, snapshot) {
        if (!snapshot) {
          return;
        }

        if (snapshot.type === "value" && (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement)) {
          element.value = snapshot.value ?? "";
        } else if (snapshot.type === "html" && element instanceof HTMLElement) {
          element.innerHTML = snapshot.html ?? "";
        } else if (element instanceof HTMLElement) {
          element.textContent = snapshot.text ?? "";
        }

        element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "" }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }

      function applyProbeText(element, probeText) {
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

      async function waitForVisibleSelector(selector, timeoutMs = 1800) {
        const startedAt = Date.now();
        while (Date.now() - startedAt <= timeoutMs) {
          const match = findBestMatch([selector], { visibleOnly: true });
          if (match.element) {
            return match;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 120));
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
        const response = {
          ok: true,
          input: {
            found: true,
            selector: inputMatch.selector,
            actualType: actualInputType,
            expectedType: siteDraft.inputType ?? "",
            typeMatches: inputTypeMatches,
          },
          submit: {
            status: "skipped",
          },
        };

        if (String(siteDraft.submitMethod) !== "click") {
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
          error: error?.message ?? String(error),
        };
      }
    },
    args: [draft, probeText],
  });

  return result?.result ?? {
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

async function applyBadgeForBroadcast(summary) {
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

async function syncLastBroadcast(summary) {
  await setLastBroadcast(summary);
  await applyBadgeForBroadcast(summary);
}

async function createPendingBroadcast(prompt, sites, metadata = {}) {
  const pendingInjections = await getPendingInjections();
  if (Object.keys(pendingInjections).length > 0) {
    console.warn("[AI Prompt Broadcaster] Starting a new broadcast while pending tabs still exist.", pendingInjections);
  }

  const originContext = await getFocusedTabContext();
  const broadcastId =
    typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : `broadcast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const record = {
    id: broadcastId,
    prompt,
    siteIds: sites.map((site) => site.id),
    total: sites.length,
    completed: 0,
    submittedSiteIds: [],
    failedSiteIds: [],
    siteResults: {},
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

async function maybeCreateSelectorNotification(report) {
  try {
    const signature = [
      report.siteId,
      report.pageUrl,
      ...(report.missing ?? []).map((entry) => `${entry.field}:${entry.selector}`),
    ].join("|");

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

async function maybeCreateBroadcastNotification(summary) {
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

async function recordBroadcastSiteResult(broadcastId, siteId, resultInput) {
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

    try {
      if (completedRecord) {
        const suppressCompletionEffects = suppressedCompletedBroadcastIds.has(broadcastId);
        suppressedCompletedBroadcastIds.delete(broadcastId);

        if (suppressCompletionEffects) {
          await syncLastBroadcast(summary);
          resolveBroadcastCompletionWaiter(broadcastId, summary);
          return summary;
        }

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
          originFavoriteId: completedRecord.originFavoriteId ?? null,
          chainRunId: completedRecord.chainRunId ?? null,
          chainStepIndex: completedRecord.chainStepIndex ?? null,
          chainStepCount: completedRecord.chainStepCount ?? null,
          trigger: completedRecord.trigger ?? "popup",
        });

        await syncLastBroadcast(summary);
        await restoreBroadcastFocus(completedRecord);
        await maybeCreateBroadcastNotification(summary);
        resolveBroadcastCompletionWaiter(broadcastId, summary);
      } else {
        await syncLastBroadcast(summary);
      }
    } catch (sideEffectError) {
      console.error("[AI Prompt Broadcaster] Broadcast completion side effect failed.", {
        broadcastId,
        siteId,
        result,
        sideEffectError,
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

async function cancelBroadcast(broadcastId, reason = "cancelled") {
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

  const pendingSiteIds = new Set();
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

  let lastSummary = null;
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

async function reconcilePendingBroadcasts() {
  const pendingBroadcasts = await getPendingBroadcasts();
  const pendingInjections = await getPendingInjections();

  const jobsByBroadcastId = new Map();
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

async function injectIntoTab(tabId, prompt, site, runtimeOverrides = {}) {
  const config = buildInjectionConfig(site, runtimeOverrides);

  if (site?.id === "perplexity") {
    const [executionResult] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: async (injectedPrompt, injectedConfig) => {
        const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, Math.max(Number(ms) || 0, 0)));

        const splitSelectorList = (selectorGroup) => {
          const source = typeof selectorGroup === "string" ? selectorGroup.trim() : "";
          if (!source) {
            return [];
          }

          const parts = [];
          let current = "";
          let bracketDepth = 0;
          let parenDepth = 0;
          let quote = null;
          let escaping = false;

          for (const character of source) {
            current += character;

            if (escaping) {
              escaping = false;
              continue;
            }

            if (character === "\\") {
              escaping = true;
              continue;
            }

            if (quote) {
              if (character === quote) {
                quote = null;
              }
              continue;
            }

            if (character === "'" || character === "\"") {
              quote = character;
              continue;
            }

            if (character === "[") {
              bracketDepth += 1;
              continue;
            }

            if (character === "]") {
              bracketDepth = Math.max(0, bracketDepth - 1);
              continue;
            }

            if (character === "(") {
              parenDepth += 1;
              continue;
            }

            if (character === ")") {
              parenDepth = Math.max(0, parenDepth - 1);
              continue;
            }

            if (character === "," && bracketDepth === 0 && parenDepth === 0) {
              current = current.slice(0, -1);
              const normalized = current.trim();
              if (normalized) {
                parts.push(normalized);
              }
              current = "";
            }
          }

          const trailing = current.trim();
          if (trailing) {
            parts.push(trailing);
          }

          return parts;
        };

        const normalizeSelectorEntries = (selectors) =>
          (Array.isArray(selectors) ? selectors : [])
            .filter((selector) => typeof selector === "string" && selector.trim())
            .flatMap((selector) => splitSelectorList(selector))
            .filter((selector, index, list) => list.indexOf(selector) === index);

        const normalizeText = (value) =>
          String(value ?? "")
            .replace(/\u00A0/g, " ")
            .replace(/[\u200B-\u200D\uFEFF]/g, "")
            .replace(/\r\n?/g, "\n")
            .trim();

        const isVisible = (element) => {
          if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
            return true;
          }

          const style = window.getComputedStyle(element);
          if (
            element.hidden ||
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

        const isEditable = (element) => {
          if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            return !element.readOnly;
          }

          return element instanceof HTMLElement ? element.isContentEditable : false;
        };

        const findPromptMatch = () => {
          const selectors = normalizeSelectorEntries([
            injectedConfig?.inputSelector,
            ...(Array.isArray(injectedConfig?.fallbackSelectors) ? injectedConfig.fallbackSelectors : []),
          ]);

          for (const selector of selectors) {
            const candidates = Array.from(document.querySelectorAll(selector));
            const element = candidates.find((candidate) => isVisible(candidate) && isEditable(candidate));
            if (element) {
              return { element, selector };
            }
          }

          return null;
        };

        const waitForPromptMatch = async (timeoutMs) => {
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

        const placeCaretAtEnd = (element) => {
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

        const selectAllEditableContents = (element) => {
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

        const buildParagraphNode = (text) => ({
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

        const setLexicalText = (element, nextPrompt) => {
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
        const attempts = [];

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
      args: [prompt, config],
    });

    const injectionResult = executionResult?.result ?? null;
    if (!injectionResult || injectionResult.status !== "injected") {
      return injectionResult;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: [INJECTOR_SCRIPT_PATH],
    });

    const [submitExecutionResult] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (injectedConfig) => {
        const submitter = globalThis.__aiPromptBroadcasterSubmitPrompt;
        if (typeof submitter !== "function") {
          throw new Error("submitPrompt entry point is not available in the tab context.");
        }

        return submitter(injectedConfig);
      },
      args: [config],
    });

    const submitResult = submitExecutionResult?.result ?? null;
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
    func: async (injectedPrompt, injectedConfig) => {
      const injector = globalThis.__aiPromptBroadcasterInjectPrompt;
      if (typeof injector !== "function") {
        throw new Error("injectPrompt entry point is not available in the tab context.");
      }

      return injector(injectedPrompt, injectedConfig);
    },
    args: [prompt, config],
  });

  return executionResult?.result ?? null;
}

function isSameSiteOrigin(tabUrl, site) {
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

async function handlePendingInjectionTimeout(tabId, job, reason = "timeout") {
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

async function processPendingInjectionNow(tabId, tab) {
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
      message: error?.message ?? String(error),
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

async function reconcilePendingInjections() {
  const pending = await getPendingInjections();
  const entries = Object.entries(pending);

  for (const [tabIdKey, job] of entries) {
    const tabId = Number(tabIdKey);
    if (!Number.isFinite(tabId) || !job) {
      await removePendingInjection(tabIdKey);
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

async function ensureReconcileAlarm() {
  try {
    chrome.alarms.create(RECONCILE_ALARM, {
      periodInMinutes: KEEPALIVE_PERIOD_MINUTES,
    });
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to create reconcile alarm.", error);
  }
}

async function initializeServiceWorker() {
  await ensureReconcileAlarm();
  await reconcilePendingInjections();
  await reconcilePendingBroadcasts();
  await reconcileFavoriteSchedules();
}

async function queueResolvedBroadcastRequest(prompt, selectedTargets, metadata = {}) {
  const selectedSites = selectedTargets.map((target) => target.site);
  let queuedSiteCount = 0;

  const broadcast = await createPendingBroadcast(prompt, selectedSites, metadata);
  registerBroadcastCompletionWaiter(broadcast.id);
  const settings = await getAppSettings();
  const createdTabSiteIds = [];
  const reusedTabSiteIds = [];
  const failedTabSiteIds = [];
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
      const reusableTab =
        explicitTab ??
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

async function queueBroadcastRequest(prompt, siteRefs, metadata = {}) {
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

async function handleBroadcastMessage(message) {
  return queueBroadcastRequest(message?.prompt, message?.sites, {
    trigger: "popup",
  });
}

async function handleSelectorCheckInit(message) {
  const site = await getSiteForUrl(message?.url ?? "");
  if (!site) {
    return { ok: true, site: null };
  }

  return {
    ok: true,
    site: buildInjectionConfig(site),
  };
}

async function handleSelectorCheckReport(message) {
  if (message?.status === "ok" && message?.siteId) {
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

  await maybeCreateSelectorNotification({
    siteId: message.siteId ?? "unknown",
    siteName: message.siteName ?? "AI service",
    pageUrl: message.pageUrl ?? "",
    missing,
  });
  await markFailedSelector(message.siteId ?? "unknown", missing[0]?.selector ?? "", "selector-checker");
  return { ok: true };
}

async function handleSelectorFailedMessage(message) {
  const serviceId = message?.serviceId ?? "";
  const selector = message?.selector ?? "";
  const site = await getSiteById(serviceId);

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

async function handleInjectSuccessMessage(message) {
  if (message?.serviceId) {
    await clearFailedSelector(message.serviceId);
  }

  return { ok: true };
}

async function handleInjectFallbackMessage(message) {
  const serviceId = message?.serviceId ?? "";
  const site = await getSiteById(serviceId);
  const copied = Boolean(message?.copied);

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

async function handleUiToastMessage(message) {
  await enqueueUiToast(message?.toast ?? {});
  return { ok: true };
}

async function handlePopupOpened() {
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

async function handleGetOpenAiTabsMessage(message) {
  const windowId = await getPreferredNormalWindowId(message?.windowId ?? null);
  const tabs = await getOpenAiTabsForWindow(windowId);

  return {
    ok: true,
    windowId,
    tabs,
  };
}

async function handleCancelBroadcastMessage(message) {
  const summary = await cancelBroadcast(message?.broadcastId ?? "", "cancelled");
  return {
    ok: Boolean(summary),
    summary,
  };
}

async function resetAllExtensionData() {
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
  lastNormalWindowId = null;
  lastNormalTabId = null;

  await queueBackgroundStateMutation((state) => {
    state.pendingInjections = {};
    state.pendingBroadcasts = {};
    state.selectorAlerts = {};
    return true;
  });

  await resetPersistedExtensionState({
    additionalSessionKeys: [
      PENDING_INJECTIONS_KEY,
      PENDING_BROADCASTS_KEY,
      SELECTOR_ALERTS_KEY,
    ],
    clearAlarmName: BADGE_CLEAR_ALARM,
  });
  await clearBadge();

  return { ok: true };
}

async function handleGetActiveTabContext() {
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

async function handleServiceTestRun(message) {
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
    const result = await runServiceTestOnTab(preferredTab.tab.id, draft);
    return {
      ok: Boolean(result?.ok),
      tabId: preferredTab.tab.id,
      tabUrl: preferredTab.tab.url ?? "",
      ...result,
    };
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Service test failed.", error);
    return {
      ok: false,
      reason: "error",
      error: error?.message ?? String(error),
    };
  }
}

registerRuntimeMessageRouter({
  broadcast: {
    run: (message) => handleBroadcastMessage(message),
    errorLabel: "[AI Prompt Broadcaster] Broadcast handling failed.",
  },
  "selector-check:init": {
    run: (message) => handleSelectorCheckInit(message),
    errorLabel: "[AI Prompt Broadcaster] Selector check init failed.",
  },
  "selector-check:report": {
    run: (message) => handleSelectorCheckReport(message),
    errorLabel: "[AI Prompt Broadcaster] Selector check report failed.",
  },
  "service-test:run": {
    run: (message) => handleServiceTestRun(message),
    errorLabel: "[AI Prompt Broadcaster] Service test run failed.",
  },
  selectorFailed: {
    run: (message) => handleSelectorFailedMessage(message),
  },
  injectSuccess: {
    run: (message) => handleInjectSuccessMessage(message),
  },
  injectFallback: {
    run: (message) => handleInjectFallbackMessage(message),
  },
  uiToast: {
    run: (message) => handleUiToastMessage(message),
  },
  popupOpened: {
    run: () => handlePopupOpened(),
  },
  getOpenAiTabs: {
    run: (message) => handleGetOpenAiTabsMessage(message),
  },
  cancelBroadcast: {
    run: (message) => handleCancelBroadcastMessage(message),
  },
  "favorite:run": {
    run: (message, sender) => handleFavoriteRunMessage(message, sender),
  },
  "favorite:openEditor": {
    run: (message) => handleFavoriteOpenEditorMessage(message),
  },
  resetAllData: {
    run: () => resetAllExtensionData(),
    errorLabel: "[AI Prompt Broadcaster] Reset-all-data failed.",
  },
  getActiveTabContext: {
    run: () => handleGetActiveTabContext(),
    onError: (error, fallback) => ({
      ...fallback,
      url: "",
      title: "",
      selection: "",
    }),
  },
  getBroadcastCounter: {
    run: async () => ({ ok: true, counter: await getBroadcastCounter() }),
    onError: (error, fallback) => ({
      ...fallback,
      counter: 0,
    }),
  },
  "selection:update": {
    sync: true,
    run: (message, sender) => handleSelectionUpdateMessage(message, sender),
  },
  "quickPalette:getState": {
    run: () => handleQuickPaletteGetState(),
  },
  "quickPalette:execute": {
    run: (message, sender) => handleQuickPaletteExecuteMessage(message, sender),
  },
  "quickPalette:close": {
    sync: true,
    run: () => ({ ok: true }),
  },
});

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

      lastNormalWindowId = windowId;
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
