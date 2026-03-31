"use strict";
var AIPromptBroadcasterSelectionBundle = (() => {
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
      chrome.runtime.sendMessage({
        action: "selection:update",
        text: getSelectionText()
      });
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
