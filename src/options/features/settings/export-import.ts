// @ts-nocheck
import { exportPromptData, importPromptData } from "../../../shared/prompts";
import { optionsDom } from "../../app/dom";
import { t } from "../../app/i18n";
import { buildImportSummaryText } from "../../app/helpers";
import { openImportReportModal, setStatus, showAppToast } from "../../core/status";

const {
  settingsExportJson,
  settingsImportJson,
  settingsImportJsonInput,
} = optionsDom.settings;

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function bindExportImportEvents({ loadData }) {
  settingsExportJson.addEventListener("click", async () => {
    try {
      const payload = await exportPromptData();
      downloadBlob(
        `ai-prompt-broadcaster-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
        JSON.stringify(payload, null, 2),
        "application/json",
      );
      setStatus(t.settings.exportSuccess, "success");
      showAppToast(t.settings.exportSuccess, "success", 1800);
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to export JSON.", error);
      setStatus(error?.message ?? t.settings.exportFailed, "error");
      showAppToast(error?.message ?? t.settings.exportFailed, "error", 3000);
    }
  });

  settingsImportJson.addEventListener("click", () => {
    settingsImportJsonInput.click();
  });

  settingsImportJsonInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const result = await importPromptData(text);
      await loadData();
      setStatus(buildImportSummaryText(result.importSummary), "success");
      showAppToast(buildImportSummaryText(result.importSummary, { short: true }), "success", 2600);
      openImportReportModal(result.importSummary);
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to import JSON.", error);
      setStatus(error?.message ?? t.settings.importFailed, "error");
      showAppToast(error?.message ?? t.settings.importFailed, "error", 3000);
    } finally {
      settingsImportJsonInput.value = "";
    }
  });
}
