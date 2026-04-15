import {
  SELECTION_SCRIPT_PATH,
  SELECTOR_CHECKER_SCRIPT_PATH,
} from "../app/constants";
import type { RuntimeSite } from "../../shared/types/models";

async function ensureSelectionScript(tabId: number): Promise<boolean> {
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

async function ensureSelectorCheckerScript(tabId: number): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, { action: "selector-check:ping" });
    return true;
  } catch (_error) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [SELECTOR_CHECKER_SCRIPT_PATH],
      });
      return true;
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to inject selector checker.", {
        tabId,
        error,
      });
      return false;
    }
  }
}

interface SelectionRuntimeDeps {
  selectionCache: Map<number, string>;
  getSiteForUrl: (url: string) => Promise<RuntimeSite | null>;
  isInjectableTabUrl: (url: string) => boolean;
  isCustomSitePermissionGranted: (site: RuntimeSite) => Promise<boolean>;
}

export function createSelectionRuntime(
  deps: SelectionRuntimeDeps,
) {
  const {
    selectionCache,
    getSiteForUrl,
    isInjectableTabUrl,
    isCustomSitePermissionGranted,
  } = deps;

  return {
    ensureSelectionScript,
    ensureSelectorCheckerScript,

    async getSelectedTextFromTab(tabId: number): Promise<string> {
      try {
        const didInject = await ensureSelectionScript(tabId);
        if (!didInject) {
          return selectionCache.get(tabId) ?? "";
        }

        const response = await chrome.tabs.sendMessage(tabId, {
          action: "selection:get-text",
        }) as { text?: string } | undefined;

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
    },

    async maybeInjectDynamicSelectorChecker(
      tabId: number,
      tab: chrome.tabs.Tab | undefined,
    ): Promise<boolean> {
      const tabUrl = typeof tab?.url === "string" ? tab.url : "";
      if (!tabId || !isInjectableTabUrl(tabUrl)) {
        return false;
      }

      const site = await getSiteForUrl(tabUrl);
      if (!site?.isCustom || site.enabled === false) {
        return false;
      }

      const granted = await isCustomSitePermissionGranted(site);
      if (!granted) {
        return false;
      }

      return ensureSelectorCheckerScript(tabId);
    },

    handleSelectionUpdateMessage(
      message: { text?: string } | null | undefined,
      sender: chrome.runtime.MessageSender,
    ): { ok: boolean; error?: string } {
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
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}
