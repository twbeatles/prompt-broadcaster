(() => {
  if (globalThis.__aiPromptBroadcasterSelectionScriptLoaded) {
    return;
  }

  globalThis.__aiPromptBroadcasterSelectionScriptLoaded = true;

  function logError(context, error) {
    console.error(`[AI Prompt Broadcaster] ${context}`, error);
  }

  function getSelectionText() {
    try {
      return window.getSelection()?.toString().trim() ?? "";
    } catch (error) {
      logError("Failed to read window selection.", error);
      return "";
    }
  }

  function sendSelectionUpdate() {
    try {
      chrome.runtime.sendMessage({
        action: "selection:update",
        text: getSelectionText(),
      });
    } catch (error) {
      logError("Failed to send selection update.", error);
    }
  }

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
      logError("Failed to schedule selection update.", error);
    }
  }

  try {
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
        logError("Selection message handler failed.", error);
        sendResponse({
          ok: false,
          error: error?.message ?? String(error),
        });
        return false;
      }
    });

    document.addEventListener("selectionchange", scheduleSelectionUpdate, true);
    document.addEventListener("mouseup", scheduleSelectionUpdate, true);
    document.addEventListener("keyup", scheduleSelectionUpdate, true);
    window.addEventListener("focus", scheduleSelectionUpdate, true);

    scheduleSelectionUpdate();
  } catch (error) {
    logError("Failed to initialize selection content script.", error);
  }
})();
