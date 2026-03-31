// @ts-nocheck
import { installSelectionMessageListener } from "./messages";
import { createSelectionTracker } from "./tracker";
import { logSelectionError } from "./reader";

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
