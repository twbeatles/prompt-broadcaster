// @ts-nocheck
import { sendRuntimeMessageWithTimeout } from "../../../shared/chrome/messaging";
import { updateFavoritePrompt } from "../../../shared/prompts";
import { optionsDom } from "../../app/dom";
import { t } from "../../app/i18n";
import { setStatus, showAppToast } from "../../core/status";

const { schedulesList } = optionsDom.schedules;

async function runFavoriteFromOptions(favoriteId) {
  const response = await sendRuntimeMessageWithTimeout({
    action: "favorite:run",
    favoriteId,
    trigger: "options",
    allowPopupFallback: true,
  }, 5000);

  if (response?.ok && response?.popupFallback) {
    setStatus(t.schedules.popupFallback, "success");
    showAppToast(t.schedules.popupFallback, "success", 2200);
    return;
  }

  if (response?.ok) {
    const message = response?.message ?? t.schedules.runQueued;
    setStatus(message, "success");
    showAppToast(message, "success", 2200);
    return;
  }

  throw new Error(response?.error ?? t.saveFailed);
}

async function openFavoriteInPopup(favoriteId) {
  const response = await sendRuntimeMessageWithTimeout({
    action: "favorite:openEditor",
    favoriteId,
    source: "options-edit",
  }, 5000);

  if (!response?.ok) {
    throw new Error(response?.error ?? t.schedules.openFailed);
  }

  setStatus(t.schedules.openInPopup, "success");
  showAppToast(t.schedules.openInPopup, "success", 2000);
}

export function bindScheduleEvents({ reloadData }) {
  schedulesList.addEventListener("change", (event) => {
    const toggle = event.target.closest("[data-schedule-enabled]");
    if (!toggle) {
      return;
    }

    void updateFavoritePrompt(toggle.dataset.scheduleEnabled, {
      scheduleEnabled: Boolean(toggle.checked),
    }).then(() => reloadData()).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to toggle favorite schedule.", error);
      setStatus(error?.message ?? t.saveFailed, "error");
      showAppToast(error?.message ?? t.saveFailed, "error", 3000);
    });
  });

  schedulesList.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action][data-favorite-id]");
    if (!actionButton) {
      return;
    }

    if (actionButton.dataset.action === "run-schedule-favorite") {
      void runFavoriteFromOptions(actionButton.dataset.favoriteId).catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to run favorite from options.", error);
        setStatus(error?.message ?? t.saveFailed, "error");
        showAppToast(error?.message ?? t.saveFailed, "error", 3000);
      });
      return;
    }

    if (actionButton.dataset.action === "open-schedule-favorite") {
      void openFavoriteInPopup(actionButton.dataset.favoriteId).catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to open favorite editor from options.", error);
        setStatus(error?.message ?? t.schedules.openFailed, "error");
        showAppToast(error?.message ?? t.schedules.openFailed, "error", 3000);
      });
    }
  });
}
