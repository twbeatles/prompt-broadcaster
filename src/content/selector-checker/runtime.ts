// @ts-nocheck
import { sendRuntimeMessageWithTimeout } from "../../shared/chrome/messaging";

export function logSelectorCheckerError(context, error) {
  console.error(`[AI Prompt Broadcaster] ${context}`, error);
}

export function sendRuntimeMessage(message) {
  return sendRuntimeMessageWithTimeout(message, 4000).catch((error) => {
    logSelectorCheckerError("Failed to send runtime message.", error);
    return null;
  });
}

export function installSelectorCheckerPingListener() {
  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.action === "selector-check:ping") {
        sendResponse({ ok: true });
        return false;
      }

      return false;
    });
  } catch (_error) {
    // Ignore ping listener setup failures.
  }
}
