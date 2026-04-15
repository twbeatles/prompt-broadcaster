// @ts-nocheck
import { sendRuntimeMessageWithTimeout } from "../../../shared/chrome/messaging";
import { optionsDom } from "../../app/dom";
import { t } from "../../app/i18n";
import { state } from "../../app/state";
import { setStatus, showAppToast, showConfirmToast } from "../../core/status";

const { settingsResetData } = optionsDom.settings;

async function resetAllData(loadData) {
  const response = await sendRuntimeMessageWithTimeout({ action: "resetAllData" }, 10000);
  if (!response?.ok) {
    throw new Error(response?.error ?? t.settings.resetFailed);
  }

  await loadData();
  state.historyPage = 1;
  setStatus(t.settings.resetSuccess, "success");
  showAppToast(t.settings.resetSuccess, "success", 1800);
}

export function bindDangerZoneEvents({ loadData }) {
  settingsResetData.addEventListener("click", () => {
    showConfirmToast(t.settings.resetConfirm, async () => {
      try {
        await resetAllData(loadData);
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Failed to reset data.", error);
        setStatus(error?.message ?? t.settings.resetFailed, "error");
        showAppToast(error?.message ?? t.settings.resetFailed, "error", 3000);
      }
    });
  });
}
