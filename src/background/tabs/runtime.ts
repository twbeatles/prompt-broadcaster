import { TAB_LOAD_READY_TIMEOUT_MS } from "../app/constants";
import type { OpenSiteTab, RuntimeSite } from "../../shared/types/models";

interface BackgroundTabsRuntimeDeps {
  getRuntimeSites: () => Promise<RuntimeSite[]>;
  isInjectableTabUrl: (url: string) => boolean;
  isSameSiteOrigin: (tabUrl: string, site: RuntimeSite) => boolean;
  isReusableTabForSite: (
    tab: chrome.tabs.Tab,
    site: RuntimeSite,
  ) => Promise<boolean>;
}

export function createBackgroundTabsRuntime(
  deps: BackgroundTabsRuntimeDeps,
) {
  const {
    getRuntimeSites,
    isInjectableTabUrl,
    isSameSiteOrigin,
    isReusableTabForSite,
  } = deps;
  let lastNormalWindowId: number | null = null;
  let lastNormalTabId: number | null = null;

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, Number.isFinite(ms) ? ms : 0);
    });
  }

  async function rememberNormalTab(
    tab: chrome.tabs.Tab | undefined,
  ): Promise<chrome.tabs.Tab | null> {
    if (!tab?.id || !Number.isFinite(tab.windowId)) {
      return null;
    }

    try {
      const windowInfo = await chrome.windows.get(tab.windowId).catch(() => null) as chrome.windows.Window | null;
      if (windowInfo?.type !== "normal") {
        return null;
      }

      lastNormalWindowId = typeof windowInfo.id === "number" ? windowInfo.id : null;
      lastNormalTabId = tab.id ?? null;
      return tab;
    } catch (_error) {
      return null;
    }
  }

  async function getPreferredNormalWindowId(
    preferredWindowId: number | null = null,
  ): Promise<number | null> {
    const normalizedPreferredWindowId = Number(preferredWindowId);
    if (Number.isFinite(normalizedPreferredWindowId)) {
      try {
        const preferredWindow = await chrome.windows.get(
          normalizedPreferredWindowId,
        ) as chrome.windows.Window;
        if (preferredWindow?.type === "normal") {
          return typeof preferredWindow.id === "number" ? preferredWindow.id : null;
        }
      } catch (_error) {
        // Fall through when the preferred window is gone.
      }
    }

    try {
      const lastFocusedTabs = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      }) as chrome.tabs.Tab[];
      const lastFocusedTab = lastFocusedTabs[0];

      if (Number.isFinite(lastFocusedTab?.windowId)) {
        const windowInfo = await chrome.windows.get(
          lastFocusedTab.windowId as number,
        ).catch(() => null) as chrome.windows.Window | null;
        if (windowInfo?.type === "normal") {
          return typeof windowInfo.id === "number" ? windowInfo.id : null;
        }
      }
    } catch (_error) {
      // Fall back to remembered/current normal windows below.
    }

    if (Number.isFinite(lastNormalWindowId)) {
      try {
        const rememberedWindow = await chrome.windows.get(
          lastNormalWindowId as number,
        ) as chrome.windows.Window;
        if (rememberedWindow?.type === "normal") {
          return typeof rememberedWindow.id === "number" ? rememberedWindow.id : null;
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
      return focusedWindow?.id
        ?? windows.find((windowInfo) => Number.isFinite(windowInfo?.id))?.id
        ?? null;
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to resolve preferred normal window.", error);
      return null;
    }
  }

  async function getPreferredNormalActiveTab(
    preferredWindowId: number | null = null,
  ): Promise<chrome.tabs.Tab | null> {
    try {
      const lastFocusedTabs = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      }) as chrome.tabs.Tab[];
      const lastFocusedTab = lastFocusedTabs[0];
      const rememberedLastFocused = await rememberNormalTab(lastFocusedTab);
      if (rememberedLastFocused) {
        return rememberedLastFocused;
      }
    } catch (_error) {
      // Fall through to additional strategies below.
    }

    const targetWindowId = await getPreferredNormalWindowId(preferredWindowId);
    if (Number.isFinite(targetWindowId)) {
      try {
        const activeTabs = await chrome.tabs.query({
          active: true,
          windowId: targetWindowId as number,
        }) as chrome.tabs.Tab[];
        const activeTab = activeTabs[0];
        const rememberedTargetTab = await rememberNormalTab(activeTab);
        if (rememberedTargetTab) {
          return rememberedTargetTab;
        }
      } catch (_error) {
        // Fall through to remembered hints below.
      }
    }

    if (Number.isFinite(lastNormalTabId)) {
      try {
        const hintTab = await chrome.tabs.get(lastNormalTabId as number) as chrome.tabs.Tab;
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
        const hintWindowTabs = await chrome.tabs.query({
          active: true,
          windowId: lastNormalWindowId as number,
        }) as chrome.tabs.Tab[];
        const hintWindowTab = hintWindowTabs[0];
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

  async function getFocusedTabContext(): Promise<{
    tabId: number;
    windowId: number;
  } | null> {
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

  async function isTabLoadReady(tabId: number): Promise<boolean> {
    try {
      const [executionResult] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => ({ readyState: document.readyState }),
      });

      const result = executionResult?.result as { readyState?: string } | undefined;
      return result?.readyState === "interactive" || result?.readyState === "complete";
    } catch (_error) {
      return false;
    }
  }

  async function waitForTabInteractionReady(
    tabId: number,
    timeoutMs = TAB_LOAD_READY_TIMEOUT_MS,
  ): Promise<boolean> {
    const deadline = Date.now() + Math.max(timeoutMs, 0);

    while (Date.now() <= deadline) {
      if (await isTabLoadReady(tabId)) {
        return true;
      }

      await sleep(150);
    }

    return false;
  }

  async function restoreFocusedTabContext(context: {
    tabId: number | null;
    windowId: number | null;
  } | null): Promise<void> {
    if (!context?.tabId || !Number.isFinite(context.windowId)) {
      return;
    }

    try {
      await chrome.windows.update(context.windowId as number, { focused: true });
      await chrome.tabs.update(context.tabId as number, { active: true });
    } catch (_error) {
      // Ignore restore failures when tab/window no longer exists.
    }
  }

  async function getOpenAiTabsForWindow(windowId: number | null): Promise<OpenSiteTab[]> {
    const normalizedWindowId = Number(windowId);
    if (!Number.isFinite(normalizedWindowId)) {
      return [];
    }

    try {
      const [runtimeSites, tabs] = await Promise.all([
        getRuntimeSites(),
        chrome.tabs.query({ windowId: normalizedWindowId }),
      ]);

      const openTabs = await Promise.all(
        tabs.map(async (tab): Promise<OpenSiteTab | null> => {
          if (!Number.isFinite(tab?.id) || !isInjectableTabUrl(tab?.url ?? "")) {
            return null;
          }

          const site = runtimeSites.find((entry) => isSameSiteOrigin(tab.url ?? "", entry));
          if (!site) {
            return null;
          }

          if (!(await isReusableTabForSite(tab, site))) {
            return null;
          }

          return {
            siteId: site.id,
            siteName: site.name,
            tabId: tab.id ?? 0,
            title: typeof tab.title === "string" ? tab.title : "",
            url: typeof tab.url === "string" ? tab.url : "",
            active: Boolean(tab.active),
            status: typeof tab.status === "string" ? tab.status : "",
            windowId: normalizedWindowId,
          };
        }),
      );

      return openTabs.filter((tab): tab is OpenSiteTab => Boolean(tab));
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to collect open AI tabs.", {
        windowId: normalizedWindowId,
        error,
      });
      return [];
    }
  }

  function clearRememberedTab(tabId: number): void {
    if (lastNormalTabId === tabId) {
      lastNormalTabId = null;
    }
  }

  function resetRememberedState(): void {
    lastNormalWindowId = null;
    lastNormalTabId = null;
  }

  return {
    rememberNormalTab,
    getPreferredNormalWindowId,
    getPreferredNormalActiveTab,
    getFocusedTabContext,
    waitForTabInteractionReady,
    restoreFocusedTabContext,
    getOpenAiTabsForWindow,
    clearRememberedTab,
    resetRememberedState,
  };
}
