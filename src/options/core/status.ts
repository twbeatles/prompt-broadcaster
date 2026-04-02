// @ts-nocheck
import { showToast } from "../../popup/ui/toast";
import { buildImportReportMarkup } from "../app/helpers";
import { msg, t } from "../app/i18n";
import { state } from "../app/state";
import { optionsDom } from "../app/dom";

const { pageStatus } = optionsDom.navigation;
const {
  importReportModal,
  importReportModalClose,
  importReportModalTitle,
  importReportModalDesc,
  importReportBody,
} = optionsDom.modals;

export function setStatus(text, type = "") {
  pageStatus.textContent = text;
  pageStatus.className = `status-line ${type}`.trim();
}

export function showAppToast(input, type = "info", duration = 3000) {
  return showToast(input, type, duration);
}

export function showConfirmToast(message, onConfirm) {
  showAppToast({
    message,
    type: "warning",
    duration: -1,
    actions: [
      {
        label: msg("common_confirm") || "Confirm",
        onClick: () => {
          void onConfirm();
        },
      },
    ],
  });
}

export function openImportReportModal(summary) {
  state.pendingImportSummary = summary;
  importReportModalTitle.textContent = t.settings.importReportTitle;
  importReportModalDesc.textContent = t.settings.importReportDesc;
  importReportBody.innerHTML = buildImportReportMarkup(summary);
  importReportModal.hidden = false;
}

export function closeImportReportModal() {
  state.pendingImportSummary = null;
  importReportModal.hidden = true;
}

export function bindStatusEvents() {
  importReportModalClose.addEventListener("click", closeImportReportModal);
  importReportModal.addEventListener("click", (event) => {
    if (event.target === importReportModal) {
      closeImportReportModal();
    }
  });
}
