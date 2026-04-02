// @ts-nocheck
import { PALETTE_SCRIPT_PATH } from "../app/constants";

async function ensurePaletteScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: "quickPalette:ping" });
    return true;
  } catch (_error) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [PALETTE_SCRIPT_PATH],
      });
      return true;
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to inject quick palette script.", {
        tabId,
        error,
      });
      return false;
    }
  }
}

export function createQuickPaletteCommand(deps) {
  const {
    getPreferredNormalActiveTab,
    isInjectableTabUrl,
    openPopupWithPrompt,
  } = deps;

  return {
    async handleQuickPaletteCommand() {
      try {
        const activeTab = await getPreferredNormalActiveTab();
        if (!activeTab?.id || !isInjectableTabUrl(activeTab.url ?? "")) {
          await openPopupWithPrompt("");
          return;
        }

        const injected = await ensurePaletteScript(activeTab.id);
        if (!injected) {
          await openPopupWithPrompt("");
          return;
        }

        await chrome.tabs.sendMessage(activeTab.id, { action: "quickPalette:toggle" });
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Quick palette command failed.", error);
        await openPopupWithPrompt("");
      }
    },
  };
}
