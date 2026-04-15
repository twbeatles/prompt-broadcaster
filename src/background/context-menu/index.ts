import {
  CONTEXT_MENU_ALL_ID,
  CONTEXT_MENU_ROOT_ID,
  CONTEXT_MENU_SITE_PREFIX,
} from "../app/constants";
import type { BroadcastMessage } from "../../shared/types/messages";
import type { RuntimeSite } from "../../shared/types/models";

interface ContextMenuControllerDeps {
  getI18nMessage: (key: string, substitutions?: string[]) => string;
  getEnabledRuntimeSites: () => Promise<RuntimeSite[]>;
  getSitePermissionPatterns: (site: RuntimeSite) => string[];
  openPopupWithPrompt: (prompt?: string) => Promise<void>;
  getSelectedTextFromTab: (tabId: number) => Promise<string>;
  isInjectableTabUrl: (url: string) => boolean;
  handleBroadcastMessage: (message: BroadcastMessage) => Promise<unknown>;
  getContextMenuRefreshChain: () => Promise<void>;
  setContextMenuRefreshChain: (promise: Promise<void>) => void;
}

function removeAllContextMenus(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.contextMenus.removeAll(() => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve();
    });
  });
}

function createContextMenuItem(
  createProperties: chrome.contextMenus.CreateProperties,
): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.contextMenus.create(createProperties, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve();
    });
  });
}

export function createContextMenuController(deps: ContextMenuControllerDeps) {
  const {
    getI18nMessage,
    getEnabledRuntimeSites,
    getSitePermissionPatterns,
    openPopupWithPrompt,
    getSelectedTextFromTab,
    isInjectableTabUrl,
    handleBroadcastMessage,
    getContextMenuRefreshChain,
    setContextMenuRefreshChain,
  } = deps;

  async function getPermittedSites(
    sites: RuntimeSite[],
  ): Promise<RuntimeSite[]> {
    const allowedSites = await Promise.all(
      sites.map(async (site) => {
        if (!site.isCustom || getSitePermissionPatterns(site).length === 0) {
          return site;
        }

        try {
          const granted = await chrome.permissions.contains({
            origins: getSitePermissionPatterns(site),
          });
          return granted ? site : null;
        } catch (error) {
          console.error("[AI Prompt Broadcaster] Failed to check custom site permission.", {
            siteId: site.id,
            error,
          });
          return null;
        }
      }),
    );

    return allowedSites.filter((site): site is RuntimeSite => Boolean(site));
  }

  async function getContextMenuTargetSiteIds(
    menuItemId: string | number,
  ): Promise<string[]> {
    if (menuItemId === CONTEXT_MENU_ALL_ID) {
      const enabledSites = await getEnabledRuntimeSites();
      const allowedSites = await getPermittedSites(enabledSites);
      return allowedSites.map((site) => site.id);
    }

    if (
      typeof menuItemId === "string"
      && menuItemId.startsWith(CONTEXT_MENU_SITE_PREFIX)
    ) {
      return [menuItemId.slice(CONTEXT_MENU_SITE_PREFIX.length)];
    }

    return [];
  }

  async function rebuildContextMenus(): Promise<void> {
    await removeAllContextMenus();

    const enabledSites = await getEnabledRuntimeSites();
    const menuSites = await getPermittedSites(enabledSites);

    await createContextMenuItem({
      id: CONTEXT_MENU_ROOT_ID,
      title: getI18nMessage("context_menu_root"),
      contexts: ["selection"],
    });

    await createContextMenuItem({
      id: CONTEXT_MENU_ALL_ID,
      parentId: CONTEXT_MENU_ROOT_ID,
      title: getI18nMessage("context_menu_send_all"),
      contexts: ["selection"],
    });

    for (const site of menuSites) {
      await createContextMenuItem({
        id: `${CONTEXT_MENU_SITE_PREFIX}${site.id}`,
        parentId: CONTEXT_MENU_ROOT_ID,
        title: getI18nMessage("context_menu_send_to", [site.name]),
        contexts: ["selection"],
      });
    }
  }

  function createContextMenus(): Promise<void> {
    const nextChain = getContextMenuRefreshChain()
      .catch(() => undefined)
      .then(() => rebuildContextMenus())
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("No SW")) {
          return;
        }

        console.error("[AI Prompt Broadcaster] Failed to create context menus.", error);
      });

    setContextMenuRefreshChain(nextChain);
    return nextChain;
  }

  async function handleContextMenuBroadcast(
    prompt: string,
    siteIds: string[],
  ): Promise<void> {
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

  async function handleCaptureSelectedTextCommand(): Promise<void> {
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

  return {
    getContextMenuTargetSiteIds,
    rebuildContextMenus,
    createContextMenus,
    handleContextMenuBroadcast,
    handleCaptureSelectedTextCommand,
  };
}
