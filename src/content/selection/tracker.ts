// @ts-nocheck
import { logSelectionError } from "./reader";
import { sendSelectionUpdate } from "./messages";

export function createSelectionTracker() {
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
    scheduleSelectionUpdate,
  };
}
