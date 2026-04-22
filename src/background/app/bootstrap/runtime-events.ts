import {
  BADGE_CLEAR_ALARM,
  CAPTURE_SELECTION_COMMAND,
  QUICK_PALETTE_COMMAND,
  RECONCILE_ALARM,
} from "../constants";

interface BackgroundChromeEventDeps {
  createContextMenus: () => Promise<void>;
  initializeServiceWorker: () => Promise<void>;
  markOnboardingPending: () => Promise<unknown>;
  openOnboardingPage: () => Promise<void>;
  handleCaptureSelectedTextCommand: () => Promise<void>;
  handleQuickPaletteCommand: () => Promise<void>;
  getContextMenuTargetSiteIds: (menuItemId: string | number) => Promise<string[]>;
  handleContextMenuBroadcast: (
    selectedText: string,
    siteIds: string[],
  ) => Promise<void>;
  selectionCache: Map<number, string>;
  maybeInjectDynamicSelectorChecker: (
    tabId: number,
    tab: chrome.tabs.Tab | undefined,
  ) => Promise<unknown>;
  queuePendingInjection: (
    tabId: number,
    tab: chrome.tabs.Tab,
  ) => Promise<unknown>;
  rememberNormalTab: (
    tab: chrome.tabs.Tab | undefined,
  ) => Promise<chrome.tabs.Tab | null>;
  clearRememberedTab: (tabId: number) => void;
  getPendingInjections: () => Promise<Record<string, unknown>>;
  recordBroadcastSiteResult: (
    broadcastId: string,
    siteId: string,
    status: string,
  ) => Promise<unknown>;
  removePendingInjection: (tabId: number) => Promise<void>;
  activeInjections: Set<number>;
  clearBadge: () => Promise<void>;
  reconcilePendingInjections: () => Promise<void>;
  handleFavoriteRunJobAlarm: (alarmName: string) => Promise<void>;
  parseScheduleAlarmFavoriteId: (alarmName: string) => string | null;
  handleFavoriteScheduleAlarm: (favoriteId: string) => Promise<void>;
  openPopupWithPrompt: () => Promise<void>;
  reconcileFavoriteSchedules: () => Promise<void>;
}

export function registerBackgroundChromeEvents(
  deps: BackgroundChromeEventDeps,
) {
  chrome.runtime.onInstalled.addListener(({ reason }) => {
    void (async () => {
      await deps.createContextMenus();
      await deps.initializeServiceWorker();

      if (reason === "install") {
        await deps.markOnboardingPending();
        await deps.openOnboardingPage();
      }
    })();
  });

  chrome.runtime.onStartup.addListener(() => {
    void deps.initializeServiceWorker();
  });

  chrome.commands.onCommand.addListener((command) => {
    if (command === CAPTURE_SELECTION_COMMAND) {
      void deps.handleCaptureSelectedTextCommand();
      return;
    }

    if (command === QUICK_PALETTE_COMMAND) {
      void deps.handleQuickPaletteCommand();
    }
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    void (async () => {
      try {
        const siteIds = await deps.getContextMenuTargetSiteIds(info.menuItemId);
        if (siteIds.length === 0) {
          return;
        }

        const selectedText =
          typeof info.selectionText === "string" ? info.selectionText.trim() : "";

        if (!selectedText && typeof tab?.id === "number") {
          const cachedText = deps.selectionCache.get(tab.id) ?? "";
          if (cachedText.trim()) {
            await deps.handleContextMenuBroadcast(cachedText, siteIds);
          }
          return;
        }

        if (typeof tab?.id === "number" && selectedText) {
          deps.selectionCache.set(tab.id, selectedText);
        }

        await deps.handleContextMenuBroadcast(selectedText, siteIds);
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Context menu click handling failed.", error);
      }
    })();
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") {
      return;
    }

    void deps.maybeInjectDynamicSelectorChecker(tabId, tab);
    void deps.queuePendingInjection(tabId, tab);
  });

  chrome.tabs.onActivated.addListener((activeInfo) => {
    void (async () => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        await deps.rememberNormalTab(tab);
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
        await deps.rememberNormalTab(activeTab);
      } catch (_error) {
        // Ignore hint update failures.
      }
    })();
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    void (async () => {
      try {
        deps.selectionCache.delete(tabId);
        deps.clearRememberedTab(tabId);
        const pending = await deps.getPendingInjections();
        const job = pending[String(tabId)] as
          | {
              broadcastId?: string;
              siteId?: string;
            }
          | undefined;

        if (job?.broadcastId && job?.siteId) {
          await deps.recordBroadcastSiteResult(
            job.broadcastId,
            job.siteId,
            "tab_closed",
          );
        }

        await deps.removePendingInjection(tabId);
        deps.activeInjections.delete(tabId);
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Tab removal cleanup failed.", {
          tabId,
          error,
        });
        deps.activeInjections.delete(tabId);
      }
    })();
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === RECONCILE_ALARM) {
      void deps.reconcilePendingInjections();
      return;
    }

    if (alarm.name === BADGE_CLEAR_ALARM) {
      void deps.clearBadge();
      return;
    }

    if (alarm.name.startsWith("apb-favorite-job:")) {
      void deps.handleFavoriteRunJobAlarm(alarm.name);
      return;
    }

    const favoriteId = deps.parseScheduleAlarmFavoriteId(alarm.name);
    if (favoriteId) {
      void deps.handleFavoriteScheduleAlarm(favoriteId);
    }
  });

  chrome.notifications.onClicked.addListener(() => {
    void deps.openPopupWithPrompt();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (
      areaName === "local" &&
      (changes.customSites ||
        changes.builtInSiteStates ||
        changes.builtInSiteOverrides)
    ) {
      void deps.createContextMenus();
    }

    if (areaName === "local" && changes.promptFavorites) {
      void deps.reconcileFavoriteSchedules();
    }
  });

  void deps.initializeServiceWorker();
}
