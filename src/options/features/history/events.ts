// @ts-nocheck
import {
  deletePromptHistoryItemsBeforeDate,
  deletePromptHistoryItemsByIds,
  getStoredPromptHistory,
} from "../../../shared/prompts";
import { optionsDom } from "../../app/dom";
import { t } from "../../app/i18n";
import { state } from "../../app/state";
import { renderDashboard } from "../dashboard";
import { renderSchedulesSection } from "../schedules";
import { renderServicesSection } from "../services";
import { setStatus, showAppToast, showConfirmToast } from "../../core/status";
import { registerModalCloseHandler } from "../../core/modal";
import {
  PAGE_SIZE,
  filteredHistory,
  getVisibleFilteredHistory,
} from "./filtering";
import { exportFilteredHistoryAsCsv } from "./export";
import { closeHistoryModal, openHistoryModal } from "./modal";
import { renderHistoryTable } from "./render";

const {
  historyServiceFilter,
  historyDateFrom,
  historyDateTo,
  historyExportCsv,
  historyTableWrap,
  historySelectAll,
  historyDeleteSelected,
  historyDeleteFiltered,
  historyDelete7d,
  historyDelete30d,
  historyDelete90d,
  historyPrevPage,
  historyNextPage,
} = optionsDom.history;
const { historyModal } = optionsDom.modals;

async function refreshHistoryAfterMutation() {
  state.history = await getStoredPromptHistory();
  renderDashboard();
  renderHistoryTable();
  renderSchedulesSection();
  renderServicesSection();
}

async function deleteSelectedHistoryRows(historyIds) {
  await deletePromptHistoryItemsByIds(historyIds);
  historyIds.forEach((historyId) => state.selectedHistoryIds.delete(Number(historyId)));
  await refreshHistoryAfterMutation();
  setStatus(t.history.deleteSuccess, "success");
  showAppToast(t.history.deleteSuccess, "success", 1800);
}

async function deleteHistoryOlderThanDays(days) {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days);
  await deletePromptHistoryItemsBeforeDate(cutoff);
  state.selectedHistoryIds.clear();
  await refreshHistoryAfterMutation();
  setStatus(t.history.deleteSuccess, "success");
  showAppToast(t.history.deleteSuccess, "success", 1800);
}

export function bindHistoryEvents() {
  historyServiceFilter.addEventListener("change", (event) => {
    state.filters.service = event.target.value;
    state.historyPage = 1;
    renderHistoryTable();
  });

  historyDateFrom.addEventListener("change", (event) => {
    state.filters.dateFrom = event.target.value;
    state.historyPage = 1;
    renderHistoryTable();
  });

  historyDateTo.addEventListener("change", (event) => {
    state.filters.dateTo = event.target.value;
    state.historyPage = 1;
    renderHistoryTable();
  });

  historyExportCsv.addEventListener("click", exportFilteredHistoryAsCsv);

  historySelectAll.addEventListener("change", (event) => {
    const history = getVisibleFilteredHistory();
    const startIndex = (state.historyPage - 1) * PAGE_SIZE;
    const currentPageRows = history.slice(startIndex, startIndex + PAGE_SIZE);
    const checked = Boolean(event.target.checked);

    currentPageRows.forEach((entry) => {
      if (checked) {
        state.selectedHistoryIds.add(Number(entry.id));
      } else {
        state.selectedHistoryIds.delete(Number(entry.id));
      }
    });

    renderHistoryTable();
  });

  historyPrevPage.addEventListener("click", () => {
    state.historyPage = Math.max(1, state.historyPage - 1);
    renderHistoryTable();
  });

  historyNextPage.addEventListener("click", () => {
    state.historyPage += 1;
    renderHistoryTable();
  });

  historyTableWrap.addEventListener("click", (event) => {
    const checkbox = event.target.closest("[data-history-select]");
    if (checkbox) {
      const historyId = Number(checkbox.dataset.historySelect);
      if (checkbox.checked) {
        state.selectedHistoryIds.add(historyId);
      } else {
        state.selectedHistoryIds.delete(historyId);
      }
      renderHistoryTable();
      return;
    }

    const detailButton = event.target.closest("[data-open-history-id]");
    if (detailButton) {
      openHistoryModal(detailButton.dataset.openHistoryId);
    }
  });

  registerModalCloseHandler(historyModal, closeHistoryModal);

  historyDeleteSelected.addEventListener("click", () => {
    showConfirmToast(t.history.deleteSelectedConfirm, async () => {
      await deleteSelectedHistoryRows([...state.selectedHistoryIds]);
    });
  });

  historyDeleteFiltered.addEventListener("click", () => {
    const historyIds = filteredHistory().map((entry) => Number(entry.id));
    showConfirmToast(t.history.deleteFilteredConfirm(historyIds.length), async () => {
      await deleteSelectedHistoryRows(historyIds);
    });
  });

  historyDelete7d.addEventListener("click", () => {
    showConfirmToast(t.history.deleteOlderConfirm(7), async () => {
      await deleteHistoryOlderThanDays(7);
    });
  });

  historyDelete30d.addEventListener("click", () => {
    showConfirmToast(t.history.deleteOlderConfirm(30), async () => {
      await deleteHistoryOlderThanDays(30);
    });
  });

  historyDelete90d.addEventListener("click", () => {
    showConfirmToast(t.history.deleteOlderConfirm(90), async () => {
      await deleteHistoryOlderThanDays(90);
    });
  });
}
