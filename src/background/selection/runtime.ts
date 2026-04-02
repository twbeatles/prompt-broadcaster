// @ts-nocheck
import {
  SELECTION_SCRIPT_PATH,
  SELECTOR_CHECKER_SCRIPT_PATH,
} from "../app/constants";

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

async function ensureSelectorCheckerScript(tabId) {
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

export function createSelectionRuntime(deps) {
  const {
    selectionCache,
    getSiteForUrl,
    isInjectableTabUrl,
    isCustomSitePermissionGranted,
  } = deps;

  return {
    ensureSelectionScript,
    ensureSelectorCheckerScript,

    async getSelectedTextFromTab(tabId) {
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
    },

    async maybeInjectDynamicSelectorChecker(tabId, tab) {
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

    handleSelectionUpdateMessage(message, sender) {
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
    },
  };
}
