import { resetPersistedExtensionState } from "../../shared/runtime-state";
import {
  BADGE_CLEAR_ALARM,
  KEEPALIVE_PERIOD_MINUTES,
  PENDING_BROADCASTS_KEY,
  PENDING_INJECTIONS_KEY,
  PENDING_SELECTOR_CHECKS_KEY,
  RECONCILE_ALARM,
  SELECTOR_ALERTS_KEY,
} from "../app/constants";
import type { BackgroundSessionState } from "../../shared/types/background";
import { getLastBroadcast } from "../../shared/runtime-state";
import type {
  ActiveTabContextResponse,
  CancelBroadcastMessage,
  CancelBroadcastResponse,
  GenericOkResponse,
  GetOpenAiTabsMessage,
  GetOpenAiTabsResponse,
} from "../../shared/types/messages";
import type {
  LastBroadcastSummary,
  PendingBroadcastRecord,
  PendingInjectionRecord,
} from "../../shared/types/models";

export interface ServiceWorkerLifecycleDeps {
  getI18nMessage: (key: string, substitutions?: string[]) => string;
  getErrorMessage: (error: unknown) => string;
  ensureReconcileAlarm?: () => Promise<void>;
  reconcilePendingInjections: () => Promise<void>;
  reconcilePendingBroadcasts: () => Promise<void>;
  reconcileFavoriteRunJobs: () => Promise<void>;
  reconcileFavoriteSchedules: () => Promise<void>;
  cancelBroadcast: (
    broadcastId: string,
    reason?: string,
  ) => Promise<LastBroadcastSummary | null>;
  getPendingBroadcasts: () => Promise<Record<string, PendingBroadcastRecord>>;
  getPendingInjections: () => Promise<Record<string, PendingInjectionRecord>>;
  suppressedCompletedBroadcastIds: Set<string>;
  closeTabQuietly: (tabId: number) => Promise<void>;
  activeInjections: Set<number>;
  queuedInjectionTabIds: Set<number>;
  selectionCache: Map<number, string>;
  resetRememberedState: () => void;
  queueBackgroundStateMutation: <TResult>(
    mutator: (state: BackgroundSessionState) => Promise<TResult> | TResult,
  ) => Promise<TResult>;
  clearBadge: () => Promise<void>;
  getPreferredNormalWindowId: (preferred?: number | null) => Promise<number | null>;
  getOpenAiTabsForWindow: (windowId: number | null) => Promise<GetOpenAiTabsResponse["tabs"]>;
  getPreferredNormalActiveTab: () => Promise<chrome.tabs.Tab | null>;
  isInjectableTabUrl: (url: string) => boolean;
  getSelectedTextFromTab: (tabId: number) => Promise<string>;
}

export function createServiceWorkerLifecycle(deps: ServiceWorkerLifecycleDeps) {
  const {
    getErrorMessage,
    reconcilePendingInjections,
    reconcilePendingBroadcasts,
    reconcileFavoriteRunJobs,
    reconcileFavoriteSchedules,
    cancelBroadcast,
    getPendingBroadcasts,
    getPendingInjections,
    suppressedCompletedBroadcastIds,
    closeTabQuietly,
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
  } = deps;

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

  return {
    ensureReconcileAlarm,
    initializeServiceWorker,
    handlePopupOpened,
    handleGetOpenAiTabsMessage,
    handleCancelBroadcastMessage,
    resetAllExtensionData,
    handleGetActiveTabContext,
  };
}
