// @ts-nocheck
import { sendRuntimeMessageWithTimeout } from "../../shared/chrome/messaging";
import { getSelectionText, logSelectionError } from "./reader";

export function sendSelectionUpdate() {
  try {
    void sendRuntimeMessageWithTimeout({
      action: "selection:update",
      text: getSelectionText(),
    }, 1000);
  } catch (error) {
    logSelectionError("Failed to send selection update.", error);
  }
}

export function installSelectionMessageListener() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    try {
      switch (message?.action) {
        case "selection:ping":
          sendResponse({ ok: true });
          return false;
        case "selection:get-text":
          sendResponse({
            ok: true,
            text: getSelectionText(),
          });
          return false;
        default:
          return false;
      }
    } catch (error) {
      logSelectionError("Selection message handler failed.", error);
      sendResponse({
        ok: false,
        error: error?.message ?? String(error),
      });
      return false;
    }
  });
}
