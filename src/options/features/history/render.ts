// @ts-nocheck
import { escapeHTML } from "../../../shared/security";
import { optionsDom } from "../../app/dom";
import { t } from "../../app/i18n";
import { state } from "../../app/state";
import {
  buildBadgeMarkup,
  createEmptyState,
  formatDateTime,
  getRequestedServices,
  getStatusInfo,
  previewText,
} from "../../app/helpers";
import {
  PAGE_SIZE,
  filteredHistory,
  getVisibleFilteredHistory,
  syncHistorySelectionState,
} from "./filtering";

const {
  historyTableWrap,
  historyPageInfo,
  historyPrevPage,
  historyNextPage,
  historySelectAll,
  historyDeleteSelected,
  historyDeleteFiltered,
} = optionsDom.history;

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
