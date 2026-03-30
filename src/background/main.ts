// @ts-nocheck
import { appendPromptHistory, getAppSettings } from "../shared/stores/prompt-store";
import {
  clearFailedSelector,
  enqueueUiToast,
  getLastBroadcast,
  markFailedSelector,
  setLastBroadcast,
  setOnboardingCompleted,
} from "../shared/stores/runtime-state";
import { getEnabledRuntimeSites, getRuntimeSites } from "../shared/stores/sites-store";

const INJECTOR_SCRIPT_PATH = "content/injector.js";
const SELECTION_SCRIPT_PATH = "content/selection.js";
const ONBOARDING_URL = "onboarding/onboarding.html";
const PENDING_INJECTIONS_KEY = "pendingInjections";
const PENDING_BROADCASTS_KEY = "pendingBroadcasts";
const SELECTOR_ALERTS_KEY = "selectorAlerts";
const NOTIFICATION_ICON_PATH = "icons/icon-128.png";
const CONTEXT_MENU_ROOT_ID = "apb-root";
const CONTEXT_MENU_ALL_ID = "apb-send-all";
const CONTEXT_MENU_SITE_PREFIX = "apb-send-site:";
const CAPTURE_SELECTION_COMMAND = "capture-selected-text";
const RECONCILE_ALARM = "apb-reconcile";
const BADGE_CLEAR_ALARM = "apb-clear-badge";
const PENDING_TIMEOUT_MS = 60_000;
const BADGE_CLEAR_DELAY_MS = 5_000;
const KEEPALIVE_PERIOD_MINUTES = 0.5;

const activeInjections = new Set();
const selectionCache = new Map();

function getI18nMessage(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || "";
}

function nowIso() {
  return new Date().toISOString();
}

function buildInjectionConfig(site) {
  return {
    id: site?.id ?? "",
    name: site?.name ?? "",
    url: site?.url ?? "",
    hostname: site?.hostname ?? "",
    inputSelector: site?.inputSelector ?? "",
    fallbackSelectors: Array.isArray(site?.fallbackSelectors) ? site.fallbackSelectors : [],
    inputType: site?.inputType ?? "textarea",
    submitSelector: site?.submitSelector ?? "",
    submitMethod: site?.submitMethod ?? "enter",
    waitMs: Number.isFinite(site?.waitMs) ? site.waitMs : 0,
    fallback: site?.fallback !== false,
    authSelectors: Array.isArray(site?.authSelectors) ? site.authSelectors : [],
    lastVerified: site?.lastVerified ?? "",
    verifiedVersion: site?.verifiedVersion ?? "",
  };
}

function normalizePrompt(value) {
  return typeof value === "string" ? value : "";
}

function summarizeBroadcastStatus(record) {
  if (!record) {
    return "idle";
  }

  if (record.completed < record.total) {
    return "sending";
  }

  if ((record.submittedSiteIds ?? []).length === 0) {
    return "failed";
  }

  if ((record.failedSiteIds ?? []).length > 0) {
    return "partial";
  }

  return "submitted";
}

function buildLastBroadcastSummary(record, overrides = {}) {
  return {
    broadcastId: record.id,
    status: summarizeBroadcastStatus(record),
    prompt: record.prompt,
    siteIds: [...(record.siteIds ?? [])],
    total: Number(record.total ?? 0),
    completed: Number(record.completed ?? 0),
    submittedSiteIds: [...(record.submittedSiteIds ?? [])],
    failedSiteIds: [...(record.failedSiteIds ?? [])],
    siteResults: { ...(record.siteResults ?? {}) },
    startedAt: record.startedAt ?? nowIso(),
    finishedAt:
      record.completed >= record.total && summarizeBroadcastStatus(record) !== "sending"
        ? nowIso()
        : "",
    ...overrides,
  };
}

async function readSessionValue(key, fallbackValue) {
  try {
    const result = await chrome.storage.session.get(key);
    return result[key] ?? fallbackValue;
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to read session storage.", {
      key,
      error,
    });
    return fallbackValue;
  }
}

async function writeSessionValue(key, value) {
  try {
    await chrome.storage.session.set({ [key]: value });
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to write session storage.", {
      key,
      error,
    });
  }
}

async function getPendingInjections() {
  return readSessionValue(PENDING_INJECTIONS_KEY, {});
}

async function setPendingInjections(value) {
  await writeSessionValue(PENDING_INJECTIONS_KEY, value);
}

async function getPendingBroadcasts() {
  return readSessionValue(PENDING_BROADCASTS_KEY, {});
}

async function setPendingBroadcasts(value) {
  await writeSessionValue(PENDING_BROADCASTS_KEY, value);
}

async function getSelectorAlerts() {
  return readSessionValue(SELECTOR_ALERTS_KEY, {});
}

async function setSelectorAlerts(value) {
  await writeSessionValue(SELECTOR_ALERTS_KEY, value);
}

async function updatePendingInjection(tabId, updater) {
  const pending = await getPendingInjections();
  const current = pending[String(tabId)];
  const nextValue = typeof updater === "function" ? updater(current) : updater;

  if (nextValue) {
    pending[String(tabId)] = nextValue;
  } else {
    delete pending[String(tabId)];
  }

  await setPendingInjections(pending);
  return nextValue ?? null;
}

async function addPendingInjection(tabId, payload) {
  return updatePendingInjection(tabId, {
    ...payload,
    tabId,
    createdAt: Number(payload?.createdAt) || Date.now(),
    injected: Boolean(payload?.injected),
    status: payload?.status || "pending",
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
    return sites.find((site) => site.hostname === url.hostname) ?? null;
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to resolve site for URL.", {
      urlString,
      error,
    });
    return null;
  }
}

async function resolveSelectedSites(siteRefs) {
  const runtimeSites = await getRuntimeSites();
  const resolvedSites = [];
  const seenIds = new Set();

  for (const siteRef of Array.isArray(siteRefs) ? siteRefs : []) {
    let resolvedSite = null;

    if (typeof siteRef === "string") {
      resolvedSite = runtimeSites.find((site) => site.id === siteRef) ?? null;
    } else if (siteRef && typeof siteRef === "object") {
      if (typeof siteRef.id === "string") {
        resolvedSite = runtimeSites.find((site) => site.id === siteRef.id) ?? buildInjectionConfig(siteRef);
      } else {
        resolvedSite = buildInjectionConfig(siteRef);
      }
    }

    if (!resolvedSite || !resolvedSite.id || seenIds.has(resolvedSite.id)) {
      continue;
    }

    seenIds.add(resolvedSite.id);
    resolvedSites.push(buildInjectionConfig(resolvedSite));
  }

  return resolvedSites;
}

function isInjectableTabUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

async function storePromptForPopup(prompt) {
  try {
    await chrome.storage.local.set({ lastPrompt: prompt });
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to store prompt for popup.", error);
  }
}

async function openPopupWithPrompt(prompt = "") {
  try {
    if (typeof prompt === "string") {
      await storePromptForPopup(prompt);
    }

    if (typeof chrome.action?.openPopup === "function") {
      await chrome.action.openPopup();
    }
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to open extension popup.", error);
  }
}

async function openOnboardingPage() {
  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL(ONBOARDING_URL) });
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to open onboarding page.", error);
  }
}

async function ensureSelectionScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: "selection:ping" });
    return true;
  } catch (_error) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [SELECTION_SCRIPT_PATH],
      });
      return true;
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to inject selection script.", {
        tabId,
        error,
      });
      return false;
    }
  }
}

async function getSelectedTextFromTab(tabId) {
  try {
    const didInject = await ensureSelectionScript(tabId);
    if (!didInject) {
      return selectionCache.get(tabId) ?? "";
    }

    const response = await chrome.tabs.sendMessage(tabId, {
      action: "selection:get-text",
    });

    return typeof response?.text === "string"
      ? response.text.trim()
      : selectionCache.get(tabId) ?? "";
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to read selected text from tab.", {
      tabId,
      error,
    });
    return selectionCache.get(tabId) ?? "";
  }
}

async function getContextMenuTargetSiteIds(menuItemId) {
  if (menuItemId === CONTEXT_MENU_ALL_ID) {
    const enabledSites = await getEnabledRuntimeSites();
    const allowedSites = (
      await Promise.all(
        enabledSites.map(async (site) => {
          if (!site.isCustom || !site.permissionPattern) {
            return site;
          }

          const granted = await chrome.permissions.contains({
            origins: [site.permissionPattern],
          });
          return granted ? site : null;
        })
      )
    ).filter(Boolean);

    return allowedSites.map((site) => site.id);
  }

  if (typeof menuItemId === "string" && menuItemId.startsWith(CONTEXT_MENU_SITE_PREFIX)) {
    return [menuItemId.slice(CONTEXT_MENU_SITE_PREFIX.length)];
  }

  return [];
}

async function createContextMenus() {
  try {
    await chrome.contextMenus.removeAll();
    const enabledSites = await getEnabledRuntimeSites();
    const menuSites = (
      await Promise.all(
        enabledSites.map(async (site) => {
          if (!site.isCustom || !site.permissionPattern) {
            return site;
          }

          try {
            const granted = await chrome.permissions.contains({
              origins: [site.permissionPattern],
            });
            return granted ? site : null;
          } catch (error) {
            console.error("[AI Prompt Broadcaster] Failed to check custom site permission.", {
              siteId: site.id,
              error,
            });
            return null;
          }
        })
      )
    ).filter(Boolean);

    chrome.contextMenus.create({
      id: CONTEXT_MENU_ROOT_ID,
      title: getI18nMessage("context_menu_root"),
      contexts: ["selection"],
    });

    chrome.contextMenus.create({
      id: CONTEXT_MENU_ALL_ID,
      parentId: CONTEXT_MENU_ROOT_ID,
      title: getI18nMessage("context_menu_send_all"),
      contexts: ["selection"],
    });

    menuSites.forEach((site) => {
      chrome.contextMenus.create({
        id: `${CONTEXT_MENU_SITE_PREFIX}${site.id}`,
        parentId: CONTEXT_MENU_ROOT_ID,
        title: getI18nMessage("context_menu_send_to", [site.name]),
        contexts: ["selection"],
      });
    });
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to create context menus.", error);
  }
}

async function handleContextMenuBroadcast(prompt, siteIds) {
  if (!prompt.trim()) {
    return;
  }

  try {
    await handleBroadcastMessage({
      action: "broadcast",
      prompt,
      sites: siteIds,
    });
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Context menu broadcast failed.", {
      siteIds,
      error,
    });
  }
}

async function handleCaptureSelectedTextCommand() {
  try {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });

    if (!activeTab?.id || !isInjectableTabUrl(activeTab.url ?? "")) {
      await openPopupWithPrompt("");
      return;
    }

    const selectedText = await getSelectedTextFromTab(activeTab.id);
    await openPopupWithPrompt(selectedText);
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Capture-selected-text command failed.", error);
  }
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

async function createPendingBroadcast(prompt, sites) {
  const pendingInjections = await getPendingInjections();
  if (Object.keys(pendingInjections).length > 0) {
    console.warn("[AI Prompt Broadcaster] Starting a new broadcast while pending tabs still exist.", pendingInjections);
  }

  const pendingBroadcasts = await getPendingBroadcasts();
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
  };

  pendingBroadcasts[broadcastId] = record;
  await setPendingBroadcasts(pendingBroadcasts);
  await syncLastBroadcast(buildLastBroadcastSummary(record, { finishedAt: "" }));
  return record;
}

async function maybeCreateSelectorNotification(report) {
  try {
    const selectorAlerts = await getSelectorAlerts();
    const signature = [
      report.siteId,
      report.pageUrl,
      ...(report.missing ?? []).map((entry) => `${entry.field}:${entry.selector}`),
    ].join("|");

    if (selectorAlerts[signature]) {
      return;
    }

    selectorAlerts[signature] = Date.now();
    await setSelectorAlerts(selectorAlerts);

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

async function recordBroadcastSiteResult(broadcastId, siteId, status) {
  try {
    const pendingBroadcasts = await getPendingBroadcasts();
    const record = pendingBroadcasts[broadcastId];
    if (!record) {
      return null;
    }

    if (record.siteResults?.[siteId]) {
      return buildLastBroadcastSummary(record);
    }

    record.siteResults = {
      ...(record.siteResults ?? {}),
      [siteId]: status,
    };
    record.completed = Object.keys(record.siteResults).length;

    if (status === "submitted") {
      record.submittedSiteIds = Array.from(
        new Set([...(record.submittedSiteIds ?? []), siteId])
      );
    } else {
      record.failedSiteIds = Array.from(
        new Set([...(record.failedSiteIds ?? []), siteId])
      );
    }

    record.status = summarizeBroadcastStatus(record);
    const summary = buildLastBroadcastSummary(record, {
      finishedAt: record.status === "sending" ? "" : nowIso(),
    });

    if (record.completed >= record.total) {
      delete pendingBroadcasts[broadcastId];
      await setPendingBroadcasts(pendingBroadcasts);

      await appendPromptHistory({
        id: Date.now(),
        text: record.prompt,
        sentTo: record.submittedSiteIds,
        createdAt: record.startedAt,
        status: summary.status,
        siteResults: record.siteResults,
      });

      await syncLastBroadcast(summary);
      await maybeCreateBroadcastNotification(summary);
    } else {
      pendingBroadcasts[broadcastId] = record;
      await setPendingBroadcasts(pendingBroadcasts);
      await syncLastBroadcast(summary);
    }

    return summary;
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to record broadcast site result.", {
      broadcastId,
      siteId,
      status,
      error,
    });
    return null;
  }
}

async function injectIntoTab(tabId, prompt, site) {
  const config = buildInjectionConfig(site);

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
    return new URL(tabUrl).hostname === site.hostname;
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
  await recordBroadcastSiteResult(job.broadcastId, job.siteId, "injection_timeout");
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

async function processPendingInjectionForTab(tabId, tab) {
  if (activeInjections.has(tabId)) {
    return;
  }

  const pending = await getPendingInjections();
  const job = pending[String(tabId)];
  if (!job || job.injected === true) {
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
    const currentTab = tab ?? (await chrome.tabs.get(tabId));
    const currentUrl = currentTab?.url ?? "";

    if (!isSameSiteOrigin(currentUrl, job.site)) {
      await recordBroadcastSiteResult(job.broadcastId, job.siteId, "redirected_or_login_required");
      await enqueueUiToast({
        message:
          getI18nMessage("toast_login_required", [job.site.name]) ||
          `${job.site.name} requires login before sending.`,
        type: "warning",
        duration: 5000,
      });
      return;
    }

    const result = await injectIntoTab(tabId, job.prompt, job.site);
    const finalStatus = result?.status === "submitted" ? "submitted" : result?.status || "failed";
    await recordBroadcastSiteResult(job.broadcastId, job.siteId, finalStatus);

    if (finalStatus === "login_required") {
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
    await recordBroadcastSiteResult(job.broadcastId, job.siteId, "injection_failed");
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
        await processPendingInjectionForTab(tabId, tab);
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
  await createContextMenus();
  await ensureReconcileAlarm();
  await reconcilePendingInjections();
}

function handleSelectionUpdateMessage(message, sender) {
  try {
    if (typeof sender?.tab?.id !== "number") {
      return { ok: false };
    }

    const text = typeof message?.text === "string" ? message.text.trim() : "";
    if (text) {
      selectionCache.set(sender.tab.id, text);
    } else {
      selectionCache.delete(sender.tab.id);
    }

    return { ok: true };
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to store selection update.", error);
    return {
      ok: false,
      error: error?.message ?? String(error),
    };
  }
}

async function handleBroadcastMessage(message) {
  const prompt = normalizePrompt(message?.prompt).trim();
  const selectedSites = await resolveSelectedSites(message?.sites);
  let createdSiteCount = 0;

  if (!prompt) {
    throw new Error("Prompt is required.");
  }

  if (selectedSites.length === 0) {
    throw new Error("At least one target site is required.");
  }

  const broadcast = await createPendingBroadcast(prompt, selectedSites);
  const createdTabSiteIds = [];
  const failedTabSiteIds = [];

  await Promise.all(
    selectedSites.map(async (site) => {
      try {
        const createdTab = await chrome.tabs.create({ url: site.url });
        if (!createdTab?.id) {
          throw new Error("Tab was created without a valid id.");
        }

        await addPendingInjection(createdTab.id, {
          broadcastId: broadcast.id,
          siteId: site.id,
          prompt,
          site,
          injected: false,
          status: "pending",
          createdAt: Date.now(),
        });

        createdSiteCount += 1;
        createdTabSiteIds.push(site.id);

        if (createdTab.status === "complete") {
          void processPendingInjectionForTab(createdTab.id, createdTab);
        }
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Failed to create broadcast tab.", {
          site,
          error,
        });
        failedTabSiteIds.push(site.id);
        await recordBroadcastSiteResult(broadcast.id, site.id, "tab_create_failed");
      }
    })
  );

  return {
    ok: createdSiteCount > 0,
    createdSiteCount,
    requestedSiteCount: selectedSites.length,
    createdTabSiteIds,
    failedTabSiteIds,
    broadcastId: broadcast.id,
    error: createdSiteCount > 0 ? undefined : "No tabs could be created.",
  };
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
  const lastBroadcast = await getLastBroadcast();
  if (!lastBroadcast || lastBroadcast.status !== "sending") {
    await clearBadge();
  }

  return {
    ok: true,
    lastBroadcast,
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message?.action) {
    case "broadcast":
      void handleBroadcastMessage(message)
        .then((result) => sendResponse(result))
        .catch((error) => {
          console.error("[AI Prompt Broadcaster] Broadcast handling failed.", error);
          sendResponse({
            ok: false,
            error: error?.message ?? String(error),
          });
        });
      return true;
    case "selector-check:init":
      void handleSelectorCheckInit(message)
        .then((result) => sendResponse(result))
        .catch((error) => {
          console.error("[AI Prompt Broadcaster] Selector check init failed.", error);
          sendResponse({
            ok: false,
            error: error?.message ?? String(error),
          });
        });
      return true;
    case "selector-check:report":
      void handleSelectorCheckReport(message)
        .then((result) => sendResponse(result))
        .catch((error) => {
          console.error("[AI Prompt Broadcaster] Selector check report failed.", error);
          sendResponse({
            ok: false,
            error: error?.message ?? String(error),
          });
        });
      return true;
    case "selectorFailed":
      void handleSelectorFailedMessage(message)
        .then((result) => sendResponse(result))
        .catch((error) => {
          sendResponse({ ok: false, error: error?.message ?? String(error) });
        });
      return true;
    case "injectSuccess":
      void handleInjectSuccessMessage(message)
        .then((result) => sendResponse(result))
        .catch((error) => {
          sendResponse({ ok: false, error: error?.message ?? String(error) });
        });
      return true;
    case "injectFallback":
      void handleInjectFallbackMessage(message)
        .then((result) => sendResponse(result))
        .catch((error) => {
          sendResponse({ ok: false, error: error?.message ?? String(error) });
        });
      return true;
    case "uiToast":
      void handleUiToastMessage(message)
        .then((result) => sendResponse(result))
        .catch((error) => {
          sendResponse({ ok: false, error: error?.message ?? String(error) });
        });
      return true;
    case "popupOpened":
      void handlePopupOpened()
        .then((result) => sendResponse(result))
        .catch((error) => {
          sendResponse({ ok: false, error: error?.message ?? String(error) });
        });
      return true;
    case "selection:update":
      sendResponse(handleSelectionUpdateMessage(message, sender));
      return false;
    default:
      return false;
  }
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  void (async () => {
    await createContextMenus();
    await ensureReconcileAlarm();

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

  void processPendingInjectionForTab(tabId, tab);
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
  }
});

chrome.notifications.onClicked.addListener(() => {
  void openPopupWithPrompt();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && (changes.customSites || changes.builtInSiteStates || changes.builtInSiteOverrides)) {
    void createContextMenus();
  }
});

void initializeServiceWorker();
