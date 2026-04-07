// @ts-nocheck
import {
  applyHistoryVisibleLimit,
  deletePromptHistoryItemsBeforeDate,
  deletePromptHistoryItemsByIds,
  getStoredPromptHistory,
  normalizeResultCode,
} from "../../shared/prompts";
import { getLocalDateKey } from "../../shared/date-utils";
import { buildCsvLine } from "../../shared/export/csv";
import { escapeHTML } from "../../shared/security";
import { optionsDom } from "../app/dom";
import { msg, t } from "../app/i18n";
import { state } from "../app/state";
import {
  buildBadgeMarkup,
  createEmptyState,
  formatDateTime,
  getRequestedServices,
  getStatusInfo,
  previewText,
} from "../app/helpers";
import { renderDashboard } from "./dashboard";
import { renderSchedulesSection } from "./schedules";
import { renderServicesSection } from "./services";
import { setStatus, showAppToast, showConfirmToast } from "../core/status";
import { closeModal, openModal, registerModalCloseHandler } from "../core/modal";

const PAGE_SIZE = 10;
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
  historyPageInfo,
} = optionsDom.history;
const {
  historyModal,
  historyModalClose,
  historyModalMeta,
  historyModalServices,
  historyModalText,
} = optionsDom.modals;

export function filteredHistory() {
  return state.history.filter((entry) => {
    const requestedServices = getRequestedServices(entry);
    const matchesService =
      state.filters.service === "all" || requestedServices.includes(state.filters.service);
    const dateKey = getLocalDateKey(entry.createdAt);
    const matchesFrom = !state.filters.dateFrom || dateKey >= state.filters.dateFrom;
    const matchesTo = !state.filters.dateTo || dateKey <= state.filters.dateTo;
    return matchesService && matchesFrom && matchesTo;
  });
}

function getVisibleFilteredHistory() {
  return applyHistoryVisibleLimit(filteredHistory(), state.settings.historyLimit);
}

export function syncHistorySelectionState() {
  const availableIds = new Set(getVisibleFilteredHistory().map((entry) => Number(entry.id)));
  state.selectedHistoryIds = new Set(
    [...state.selectedHistoryIds].filter((historyId) => availableIds.has(Number(historyId))),
  );
}

export function renderHistoryTable() {
  syncHistorySelectionState();
  const filteredEntries = filteredHistory();
  const visibleHistory = getVisibleFilteredHistory();
  const pageCount = Math.max(1, Math.ceil(visibleHistory.length / PAGE_SIZE));
  state.historyPage = Math.max(1, Math.min(state.historyPage, pageCount));
  const startIndex = (state.historyPage - 1) * PAGE_SIZE;
  const currentPageRows = visibleHistory.slice(startIndex, startIndex + PAGE_SIZE);
  const currentPageIds = currentPageRows.map((entry) => Number(entry.id));
  const allCurrentPageSelected =
    currentPageIds.length > 0 &&
    currentPageIds.every((historyId) => state.selectedHistoryIds.has(historyId));

  if (currentPageRows.length === 0) {
    historyTableWrap.innerHTML = createEmptyState(t.history.emptyFiltered);
  } else {
    historyTableWrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>${escapeHTML(t.history.tableSelect)}</th>
            <th>${escapeHTML(t.history.tableDate)}</th>
            <th>${escapeHTML(t.history.tablePrompt)}</th>
            <th>${escapeHTML(t.history.tableServices)}</th>
            <th>${escapeHTML(t.history.tableStatus)}</th>
            <th>${escapeHTML(t.history.tableActions)}</th>
          </tr>
        </thead>
        <tbody>
          ${currentPageRows
            .map((entry) => {
              const status = getStatusInfo(entry.status);
              return `
                <tr data-history-row="${entry.id}">
                  <td><input type="checkbox" aria-label="${escapeHTML(t.history.tableSelect)}" data-history-select="${entry.id}" ${state.selectedHistoryIds.has(Number(entry.id)) ? "checked" : ""} /></td>
                  <td>${escapeHTML(formatDateTime(entry.createdAt))}</td>
                  <td>${escapeHTML(previewText(entry.text))}</td>
                  <td><div class="service-badges">${getRequestedServices(entry).map((siteId) => buildBadgeMarkup(siteId, state.runtimeSites)).join("")}</div></td>
                  <td><span class="status-pill ${status.className}">${escapeHTML(status.label)}</span></td>
                  <td><button class="btn ghost history-detail-button" type="button" data-open-history-id="${entry.id}">${escapeHTML(t.history.openDetails)}</button></td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  historyPageInfo.textContent = t.history.pageInfo(state.historyPage, pageCount);
  historyPrevPage.disabled = state.historyPage <= 1;
  historyNextPage.disabled = state.historyPage >= pageCount;
  historySelectAll.checked = allCurrentPageSelected;
  historyDeleteSelected.disabled = state.selectedHistoryIds.size === 0;
  historyDeleteFiltered.disabled = filteredEntries.length === 0;
}

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

async function refreshHistoryAfterMutation() {
  state.history = await getStoredPromptHistory();
  syncHistorySelectionState();
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

export function buildResultComparisonMarkup(entry) {
  const requested = getRequestedServices(entry);
  const submitted = new Set(Array.isArray(entry.submittedSiteIds) ? entry.submittedSiteIds : (entry.sentTo ?? []));
  const failed = new Set(Array.isArray(entry.failedSiteIds) ? entry.failedSiteIds : []);
  const siteResults = entry.siteResults ?? {};

  if (requested.length === 0) {
    return "";
  }

  const siteRows = requested.map((siteId) => {
    const site = state.runtimeSites.find((siteEntry) => siteEntry.id === siteId);
    const name = site?.name ?? siteId;
    const color = site?.color ?? "#888";
    const icon = site?.icon ?? siteId.slice(0, 2).toUpperCase();
    const result = siteResults[siteId];
    const rawStatus = normalizeResultCode(result?.code ?? (submitted.has(siteId) ? "submitted" : failed.has(siteId) ? "unexpected_error" : "unknown"));
    const isOk = rawStatus === "submitted";
    const isFailed = rawStatus !== "submitted" && rawStatus !== "unknown";
    const statusEmoji = isOk ? "✅" : isFailed ? "❌" : "⏳";
    const statusLabel = isOk
      ? (msg("options_status_complete") || "Completed")
      : isFailed
        ? (t.settings.resultCodeLabels[rawStatus] || rawStatus.replace(/_/g, " "))
        : (msg("options_status_unknown") || "Unknown");

    const siteUrl = site?.url ?? "#";
    return `
      <div class="result-compare-row">
        <div class="result-compare-icon" style="background:${color};color:#fff;">${escapeHTML(icon)}</div>
        <div class="result-compare-body">
          <div class="result-compare-name">${escapeHTML(name)}</div>
          <div class="result-compare-status ${isOk ? "ok" : isFailed ? "fail" : "unknown"}">${statusEmoji} ${escapeHTML(statusLabel)}</div>
        </div>
        ${isOk ? `<a class="ghost-button small-button" href="${escapeHTML(siteUrl)}" target="_blank" rel="noopener noreferrer">${msg("options_result_open_tab") || "Open"}</a>` : ""}
      </div>
    `;
  }).join("");

  return `
    <div class="result-comparison">
      <h3 class="result-comparison-title">${escapeHTML(msg("options_result_comparison_title") || "Service results")}</h3>
      ${siteRows}
    </div>
  `;
}

function openHistoryModal(historyId) {
  const entry = state.history.find((item) => Number(item.id) === Number(historyId));
  if (!entry) {
    return;
  }

  const status = getStatusInfo(entry.status);
  historyModalMeta.textContent = `${formatDateTime(entry.createdAt)} · ${status.label}`;
  historyModalServices.innerHTML = getRequestedServices(entry)
    .map((siteId) => buildBadgeMarkup(siteId, state.runtimeSites))
    .join("");
  historyModalText.textContent = entry.text;

  let comparisonEl = document.getElementById("history-modal-comparison");
  if (!comparisonEl) {
    comparisonEl = document.createElement("div");
    comparisonEl.id = "history-modal-comparison";
    historyModalText.parentElement?.appendChild(comparisonEl);
  }
  comparisonEl.innerHTML = buildResultComparisonMarkup(entry);

  openModal(historyModal, historyModalClose);
}

function closeHistoryModal() {
  closeModal(historyModal);
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
