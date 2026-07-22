import { getAppSettings, normalizeResultCode } from "../../shared/prompts";
import {
  enqueueUiToast,
  getStrategyStats,
  recordStrategyAttempts,
} from "../../shared/runtime-state";
import {
  PENDING_TIMEOUT_MS,
  TAB_LOAD_READY_TIMEOUT_MS,
  TAB_POST_SUBMIT_SETTLE_MS,
} from "../app/constants";
import {
  buildPreferredStrategyOrder,
  buildSiteResult,
  scaleTimeout,
} from "../app/injection-helpers";
import { injectIntoTab } from "./execute";
import type {
  LastBroadcastSummary,
  PendingBroadcastRecord,
  PendingInjectionRecord,
  RuntimeSite,
  SiteInjectionResult,
} from "../../shared/types/models";

const DEFAULT_SUBMIT_BUTTON_WAIT_TIMEOUT_MS = 5000;
const DEFAULT_SUBMIT_RETRY_COUNT = 1;

export interface PendingInjectionControllerDeps {
  getI18nMessage: (key: string, substitutions?: string[]) => string;
  getErrorMessage: (error: unknown) => string;
  sleep: (ms: number) => Promise<void>;
  activeInjections: Set<number>;
  queuedInjectionTabIds: Set<number>;
  getPendingInjections: () => Promise<Record<string, PendingInjectionRecord>>;
  getPendingBroadcasts: () => Promise<Record<string, PendingBroadcastRecord>>;
  updatePendingInjection: (
    tabId: number,
    updater:
      | PendingInjectionRecord
      | null
      | ((current: PendingInjectionRecord | null) => PendingInjectionRecord | null),
  ) => Promise<PendingInjectionRecord | null>;
  removePendingInjection: (tabId: number) => Promise<void>;
  recordBroadcastSiteResult: (
    broadcastId: string,
    siteId: string,
    resultInput: string | SiteInjectionResult,
  ) => Promise<LastBroadcastSummary | null>;
  waitForTabInteractionReady: (tabId: number, timeoutMs: number) => Promise<boolean>;
  isSameSiteOrigin: (url: string, site: RuntimeSite) => boolean;
}

export function createPendingInjectionController(deps: PendingInjectionControllerDeps) {
  const {
    getI18nMessage,
    getErrorMessage,
    sleep,
    activeInjections,
    queuedInjectionTabIds,
    getPendingInjections,
    getPendingBroadcasts,
    updatePendingInjection,
    removePendingInjection,
    recordBroadcastSiteResult,
    waitForTabInteractionReady,
    isSameSiteOrigin,
  } = deps;

  let injectionProcessChain: Promise<void> = Promise.resolve();

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

  return {
    queuePendingInjection,
    processPendingInjectionNow,
    handlePendingInjectionTimeout,
    reconcilePendingInjections,
  };
}
