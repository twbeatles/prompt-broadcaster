// @ts-nocheck
import {
  ONBOARDING_URL,
  POPUP_PAGE_URL,
  STANDALONE_POPUP_HEIGHT,
  STANDALONE_POPUP_WIDTH,
} from "../app/constants";

async function storePromptForPopup(prompt) {
  try {
    await chrome.storage.local.set({ lastPrompt: prompt });
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to store prompt for popup.", error);
  }
}

async function tryOpenActionPopup() {
  if (typeof chrome.action?.openPopup !== "function") {
    return false;
  }

  try {
    await chrome.action.openPopup();
    return true;
  } catch (error) {
    console.warn("[AI Prompt Broadcaster] Action popup open failed; trying fallback.", error);
    return false;
  }
}

async function focusExistingBrowserWindow() {
  try {
    const windows = await chrome.windows.getAll({
      windowTypes: ["normal"],
    });
    const targetWindow = windows.find((windowInfo) => Number.isFinite(windowInfo?.id));

    if (!targetWindow?.id) {
      return false;
    }

    await chrome.windows.update(targetWindow.id, { focused: true });
    return true;
  } catch (error) {
    console.warn("[AI Prompt Broadcaster] Failed to focus an existing browser window.", error);
    return false;
  }
}

async function openStandalonePopupPage() {
  try {
    await chrome.windows.create({
      url: chrome.runtime.getURL(POPUP_PAGE_URL),
      type: "popup",
      focused: true,
      width: STANDALONE_POPUP_WIDTH,
      height: STANDALONE_POPUP_HEIGHT,
    });
    return true;
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to open standalone popup page.", error);
    return false;
  }
}

export function createPopupLauncher() {
  return {
    async openPopupWithPrompt(prompt = "") {
      try {
        if (typeof prompt === "string") {
          await storePromptForPopup(prompt);
        }

        if (await tryOpenActionPopup()) {
          return;
        }

        if (await focusExistingBrowserWindow()) {
          if (await tryOpenActionPopup()) {
            return;
          }
        }

        if (!(await openStandalonePopupPage())) {
          console.error("[AI Prompt Broadcaster] Failed to open extension popup.");
        }
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Failed to open extension popup.", error);
      }
    },

    async openOnboardingPage() {
      try {
        await chrome.tabs.create({ url: chrome.runtime.getURL(ONBOARDING_URL) });
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Failed to open onboarding page.", error);
      }
    },
  };
}
