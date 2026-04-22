import {
  clearPromptHistory,
  exportPromptData,
  importPromptData,
  updateAppSettings,
} from "../../../../shared/prompts";
import { popupDom } from "../../dom";
import { buildImportSummaryText, t } from "../../i18n";
import { state } from "../../state";
import {
  getEventInput,
  getImportErrorSummary,
} from "../helpers";
import type { PopupEventDeps } from "./deps";

const {
  reuseExistingTabsToggle,
  openOptionsBtn,
  clearHistoryBtn,
  exportJsonBtn,
  importJsonBtn,
  importJsonInput,
  waitMultiplierRange,
  waitMultiplierValue,
} = popupDom.settings;

export function bindSettingsEvents(deps: PopupEventDeps) {
  clearHistoryBtn.addEventListener("click", async () => {
    deps.status.showConfirmToast(t.clearHistoryConfirm, async () => {
      try {
        await clearPromptHistory();
        state.history = [];
        deps.lists.renderHistoryList();
        deps.status.setStatus(t.historyCleared, "success");
        deps.status.showAppToast(t.historyCleared, "info", 2200);
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Failed to clear history.", error);
        const errorMessage = t.error(deps.status.getErrorMessage(error));
        deps.status.setStatus(errorMessage, "error");
        deps.status.showAppToast(errorMessage, "error", 4000);
      }
    });
  });

  reuseExistingTabsToggle.addEventListener("change", (event) => {
    const target = getEventInput(event.target);
    if (!target) {
      return;
    }

    const nextValue = target.checked;
    state.settings = {
      ...state.settings,
      reuseExistingTabs: nextValue,
    };
    deps.storage.applySettingsToControls();
    deps.storage.renderSiteCheckboxesPanel();

    void updateAppSettings({ reuseExistingTabs: nextValue }).catch((error) => {
      console.error(
        "[AI Prompt Broadcaster] Failed to save tab reuse setting.",
        error,
      );
      const errorMessage = t.error(deps.status.getErrorMessage(error));
      deps.status.setStatus(errorMessage, "error");
      deps.status.showAppToast(errorMessage, "error", 3200);
    });
  });

  waitMultiplierRange.addEventListener("input", (event) => {
    const target = getEventInput(event.target);
    if (!target) {
      return;
    }

    waitMultiplierValue.textContent = t.waitMultiplierValue(Number(target.value));
  });

  waitMultiplierRange.addEventListener("change", (event) => {
    const target = getEventInput(event.target);
    if (!target) {
      return;
    }

    const nextValue = Number(target.value);
    state.settings = {
      ...state.settings,
      waitMsMultiplier: nextValue,
    };
    deps.storage.applySettingsToControls();
    void updateAppSettings({ waitMsMultiplier: nextValue }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save wait multiplier.", error);
      const errorMessage = t.error(deps.status.getErrorMessage(error));
      deps.status.setStatus(errorMessage, "error");
      deps.status.showAppToast(errorMessage, "error", 3200);
    });
  });

  openOptionsBtn.addEventListener("click", () => {
    void chrome.runtime.openOptionsPage().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to open options page.", error);
      deps.status.setStatus(t.error(deps.status.getErrorMessage(error)), "error");
    });
  });

  exportJsonBtn.addEventListener("click", async () => {
    try {
      const payload = await exportPromptData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ai-prompt-broadcaster-${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      deps.status.setStatus(t.exportSuccess, "success");
    } catch (error) {
      console.error("[AI Prompt Broadcaster] JSON export failed.", error);
      deps.status.setStatus(t.error(deps.status.getErrorMessage(error)), "error");
    }
  });

  importJsonBtn.addEventListener("click", () => {
    importJsonInput.click();
  });

  importJsonInput.addEventListener("change", async (event) => {
    const target = getEventInput(event.target);
    const file = target?.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const result = await importPromptData(text);
      await deps.storage.refreshStoredData();
      deps.status.setStatus(buildImportSummaryText(result.importSummary), "success");
      deps.status.showAppToast(
        buildImportSummaryText(result.importSummary, { short: true }),
        "success",
        2600,
      );
      deps.modals.openImportReportModal(result.importSummary);
    } catch (error) {
      const importSummary = getImportErrorSummary(error);
      if (importSummary) {
        deps.modals.openImportReportModal(importSummary);
      }

      deps.status.setStatus(t.importFailed, "error");
      deps.status.showAppToast(t.importFailed, "error", 4000);
      console.error("[AI Prompt Broadcaster] JSON import failed.", error);
    } finally {
      importJsonInput.value = "";
    }
  });
}
