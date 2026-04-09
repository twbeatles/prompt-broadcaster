"use strict";
var AIPromptBroadcasterSelectionBundle = (() => {
  // src/shared/chrome/messaging.ts
  var DEFAULT_RUNTIME_MESSAGE_TIMEOUT_MS = 5e3;
  function normalizeTimeoutMs(timeoutMs) {
    const numericValue = Number(timeoutMs);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return 0;
    }
    return Math.max(0, Math.round(numericValue));
  }
  function sendRuntimeMessage(message, timeoutMs = 0, fallbackValue = null) {
    return new Promise((resolve) => {
      let settled = false;
      let timeoutId = 0;
      const finish = (value) => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeoutId) {
          globalThis.clearTimeout(timeoutId);
        }
        resolve(value ?? fallbackValue);
      };
      const normalizedTimeoutMs = normalizeTimeoutMs(timeoutMs);
      if (normalizedTimeoutMs > 0) {
        timeoutId = globalThis.setTimeout(() => finish(fallbackValue), normalizedTimeoutMs);
      }
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            finish(fallbackValue);
            return;
          }
          finish(response ?? fallbackValue);
        });
      } catch (_error) {
        finish(fallbackValue);
      }
    });
  }
  function sendRuntimeMessageWithTimeout(message, timeoutMs = DEFAULT_RUNTIME_MESSAGE_TIMEOUT_MS, fallbackValue = null) {
    return sendRuntimeMessage(message, timeoutMs, fallbackValue);
  }

  // src/content/selection/reader.ts
  function logSelectionError(context, error) {
    console.error(`[AI Prompt Broadcaster] ${context}`, error);
  }
  function getSelectionText() {
    try {
      return window.getSelection()?.toString().trim() ?? "";
    } catch (error) {
      logSelectionError("Failed to read window selection.", error);
      return "";
    }
  }

  // src/content/selection/messages.ts
  function sendSelectionUpdate() {
    try {
      void sendRuntimeMessageWithTimeout({
        action: "selection:update",
        text: getSelectionText()
      }, 1e3);
    } catch (error) {
      logSelectionError("Failed to send selection update.", error);
    }
  }
  function installSelectionMessageListener() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      try {
        switch (message?.action) {
          case "selection:ping":
            sendResponse({ ok: true });
            return false;
          case "selection:get-text":
            sendResponse({
              ok: true,
              text: getSelectionText()
            });
            return false;
          default:
            return false;
        }
      } catch (error) {
        logSelectionError("Selection message handler failed.", error);
        sendResponse({
          ok: false,
          error: error?.message ?? String(error)
        });
        return false;
      }
    });
  }

  // src/content/selection/tracker.ts
  function createSelectionTracker() {
    let selectionUpdateTimer = null;
    function scheduleSelectionUpdate() {
      try {
        if (selectionUpdateTimer) {
          window.clearTimeout(selectionUpdateTimer);
        }
        selectionUpdateTimer = window.setTimeout(() => {
          selectionUpdateTimer = null;
          sendSelectionUpdate();
        }, 120);
      } catch (error) {
        logSelectionError("Failed to schedule selection update.", error);
      }
    }
    return {
      scheduleSelectionUpdate
    };
  }

  // src/content/selection/helper.ts
  (() => {
    if (globalThis.__aiPromptBroadcasterSelectionScriptLoaded) {
      return;
    }
    globalThis.__aiPromptBroadcasterSelectionScriptLoaded = true;
    const { scheduleSelectionUpdate } = createSelectionTracker();
    try {
      installSelectionMessageListener();
      document.addEventListener("selectionchange", scheduleSelectionUpdate, true);
      document.addEventListener("mouseup", scheduleSelectionUpdate, true);
      document.addEventListener("keyup", scheduleSelectionUpdate, true);
      window.addEventListener("focus", scheduleSelectionUpdate, true);
      scheduleSelectionUpdate();
    } catch (error) {
      logSelectionError("Failed to initialize selection content script.", error);
    }
  })();
})();
