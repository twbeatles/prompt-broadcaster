// @ts-nocheck
export function logSelectorCheckerError(context, error) {
  console.error(`[AI Prompt Broadcaster] ${context}`, error);
}

export function sendRuntimeMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          logSelectorCheckerError("Runtime message failed.", chrome.runtime.lastError);
          resolve(null);
          return;
        }

        resolve(response ?? null);
      });
    } catch (error) {
      logSelectorCheckerError("Failed to send runtime message.", error);
      resolve(null);
    }
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
