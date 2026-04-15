// @ts-nocheck
import { buildCsvLine } from "../../../shared/export/csv";
import { t } from "../../app/i18n";
import { setStatus, showAppToast } from "../../core/status";
import { getRequestedServices } from "../../app/helpers";
import { filteredHistory } from "./filtering";

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportFilteredHistoryAsCsv() {
  const rows = filteredHistory();
  const header = [
    t.history.tableDate,
    t.history.tableStatus,
    t.history.tableServices,
    t.history.tablePrompt,
  ];
  const lines = rows.map((entry) => buildCsvLine([
    entry.createdAt,
    entry.status,
    getRequestedServices(entry).join("|"),
    entry.text,
  ]));

  downloadBlob(
    `ai-prompt-broadcaster-history-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`,
    [buildCsvLine(header), ...lines].join("\n"),
    "text/csv;charset=utf-8",
  );
  setStatus(t.history.exportSuccess, "success");
  showAppToast(t.history.exportSuccess, "success", 1800);
}
