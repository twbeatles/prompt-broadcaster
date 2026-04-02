// @ts-nocheck
import {
  deletePromptHistoryItemsBeforeDate,
  deletePromptHistoryItemsByIds,
  exportPromptData,
  getAppSettings,
  getPromptHistory,
  importPromptData,
  normalizeResultCode,
  setPromptHistory,
  updateAppSettings,
} from "../../shared/prompts";
import { buildCsvLine } from "../../shared/export/csv";
import { escapeHTML } from "../../shared/security";
import { getRuntimeSites, updateRuntimeSite } from "../../shared/sites";
import { initToastRoot, showToast } from "../../popup/ui/toast";
import { CHART_COLORS, buildBarChartMarkup, buildDonutMarkup } from "../ui/charts";
import { applyI18n, isKorean, msg, t } from "./i18n";
import { state } from "./state";
import { optionsDom } from "./dom";
import {
  buildBadgeMarkup,
  buildImportReportMarkup,
  buildImportSummaryText,
  createEmptyState,
  formatDateTime,
  formatShortDate,
  getRequestedServices,
  getSiteLabel,
  getStatusInfo,
  getSubmittedServices,
  previewText,
} from "./helpers";

const PAGE_SIZE = 10;

const { navButtons, pageSections, pageStatus } = optionsDom.navigation;
const { dashboardCards, serviceDonut, dailyBarChart } = optionsDom.dashboard;
const {
  historyServiceFilter,
  historyDateFrom,
  historyDateTo,
  historyExportCsv,
  historyTableWrap,
  historySelectAll,
  historySelectAllLabel,
  historyDeleteSelected,
  historyDeleteFiltered,
  historyDelete7d,
  historyDelete30d,
  historyDelete90d,
  historyPrevPage,
  historyNextPage,
  historyPageInfo,
} = optionsDom.history;
const { servicesGrid } = optionsDom.services;
const {
  historyLimitSlider,
  historyLimitValue,
  autoCloseToggle,
  desktopNotificationToggle,
  reuseTabsToggle,
  reuseTabsSettingTitle,
  reuseTabsSettingDesc,
  waitMultiplierSettingTitle,
  waitMultiplierSlider,
  waitMultiplierSettingValue,
  shortcutList,
  openShortcutsBtn,
  settingsResetData,
  settingsExportJson,
  settingsImportJson,
  settingsImportJsonInput,
} = optionsDom.settings;
const {
  historyModal,
  historyModalClose,
  historyModalMeta,
  historyModalServices,
  historyModalText,
  importReportModal,
  importReportModalClose,
  importReportModalTitle,
  importReportModalDesc,
  importReportBody,
} = optionsDom.modals;
const { toastHost } = optionsDom;

function setStatus(text, type = "") {
  pageStatus.textContent = text;
  pageStatus.className = `status-line ${type}`.trim();
}

function showAppToast(input, type = "info", duration = 3000) {
  return showToast(input, type, duration);
}

function showConfirmToast(message, onConfirm) {
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

function openImportReportModal(summary) {
  state.pendingImportSummary = summary;
  importReportModalTitle.textContent = t.settings.importReportTitle;
  importReportModalDesc.textContent = t.settings.importReportDesc;
  importReportBody.innerHTML = buildImportReportMarkup(summary);
  importReportModal.hidden = false;
}

function closeImportReportModal() {
  state.pendingImportSummary = null;
  importReportModal.hidden = true;
}

function polarToCartesian(cx, cy, radius, angle) {
  const radian = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radian),
    y: cy + radius * Math.sin(radian),
  };
}

function createDonutSlicePath(cx, cy, outerRadius, innerRadius, startAngle, endAngle) {
  const outerStart = polarToCartesian(cx, cy, outerRadius, endAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${innerEnd.x} ${innerEnd.y}`,
    "Z",
  ].join(" ");
}

function buildDonutMarkup(items) {
  if (items.length === 0) {
    return createEmptyState(t.charts.noUsage);
  }

  let currentAngle = 0;
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const segments = items.map((item, index) => {
    const angleSize = (item.count / total) * 360;
    const path = createDonutSlicePath(110, 110, 86, 48, currentAngle, currentAngle + angleSize);
    const color = CHART_COLORS[index % CHART_COLORS.length];
    currentAngle += angleSize;
    return { ...item, path, color };
  });

  return `
    <div class="chart-box">
      <svg class="chart-svg" viewBox="0 0 220 220" role="img" aria-label="${escapeHTML(t.charts.donutAria)}">
        ${segments.map((segment) => `<path d="${segment.path}" fill="${segment.color}"></path>`).join("")}
        <text x="110" y="102" text-anchor="middle" font-size="14" fill="currentColor">${escapeHTML(t.charts.totalSent)}</text>
        <text x="110" y="126" text-anchor="middle" font-size="28" font-weight="700" fill="currentColor">${total}</text>
      </svg>
      <div class="legend">
        ${segments
          .map(
            (segment) => `
              <div class="legend-row">
                <span class="legend-label">
                  <span class="swatch" style="background:${segment.color}"></span>
                  <span>${escapeHTML(segment.label)}</span>
                </span>
                <span>${Math.round((segment.count / total) * 100)}%</span>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function buildBarChartMarkup(items) {
  if (items.length === 0) {
    return createEmptyState(t.charts.noDaily);
  }

  const maxValue = Math.max(...items.map((item) => item.count), 1);
  const barWidth = 38;
  const gap = 12;
  const chartHeight = 180;

  const bars = items
    .map((item, index) => {
      const height = (item.count / maxValue) * 120;
      const x = 20 + index * (barWidth + gap);
      const y = 24 + (120 - height);
      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${height}" rx="10" fill="${CHART_COLORS[index % CHART_COLORS.length]}"></rect>
        <text x="${x + barWidth / 2}" y="164" text-anchor="middle" font-size="12" fill="currentColor">${escapeHTML(item.label)}</text>
        <text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" font-size="12" fill="currentColor">${item.count}</text>
      `;
    })
    .join("");

  return `
    <svg class="chart-svg" viewBox="0 0 380 ${chartHeight}" role="img" aria-label="${escapeHTML(t.charts.barAria)}">
      ${bars}
    </svg>
  `;
}

function getStartOfCurrentWeek() {
  const now = new Date();
  const result = new Date(now);
  const offset = (result.getDay() + 6) % 7;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - offset);
  return result;
}

function buildDashboardMetrics(history) {
  const serviceCounts = new Map();
  let totalPromptLength = 0;

  history.forEach((entry) => {
    totalPromptLength += entry.text.length;
    getRequestedServices(entry).forEach((siteId) => {
      serviceCounts.set(siteId, (serviceCounts.get(siteId) ?? 0) + 1);
    });
  });

  const mostUsed = [...serviceCounts.entries()].sort((left, right) => right[1] - left[1])[0];
  const weekStart = getStartOfCurrentWeek();
  const weekCount = history.filter((entry) => new Date(entry.createdAt) >= weekStart).length;
  const averagePromptLength = history.length > 0 ? Math.round(totalPromptLength / history.length) : 0;

  const donutItems = [...serviceCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([siteId, count]) => ({
      id: siteId,
      label: getSiteLabel(siteId, state.runtimeSites),
      count,
    }));

  const dailyCounts = [];
  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - index);
    const dateKey = date.toISOString().slice(0, 10);
    dailyCounts.push({
      key: dateKey,
      label: formatShortDate(date),
      count: history.filter((entry) => entry.createdAt.slice(0, 10) === dateKey).length,
    });
  }

  return {
    totalTransmissions: history.length,
    mostUsedService: mostUsed ? getSiteLabel(mostUsed[0], state.runtimeSites) : "-",
    weekCount,
    averagePromptLength,
    donutItems,
    dailyCounts,
  };
}

function renderDashboard() {
  const metrics = buildDashboardMetrics(state.history);
  const cards = [
    { label: t.cards.totalTransmissions, value: metrics.totalTransmissions },
    { label: t.cards.mostUsedService, value: metrics.mostUsedService },
    { label: t.cards.weekCount, value: metrics.weekCount },
    { label: t.cards.averagePromptLength, value: `${metrics.averagePromptLength} ${t.cards.charSuffix}` },
  ];

  dashboardCards.innerHTML = cards
    .map(
      (card) => `
        <article class="card">
          <div class="card-label">${escapeHTML(card.label)}</div>
          <div class="card-value">${escapeHTML(String(card.value))}</div>
        </article>
      `
    )
    .join("");

  serviceDonut.innerHTML = buildDonutMarkup(metrics.donutItems, {
    noUsage: t.charts.noUsage,
    totalSent: t.charts.totalSent,
    donutAria: t.charts.donutAria,
  });
  dailyBarChart.innerHTML = buildBarChartMarkup(metrics.dailyCounts, {
    noDaily: t.charts.noDaily,
    barAria: t.charts.barAria,
  });
}

function filteredHistory() {
  return state.history.filter((entry) => {
    const requestedServices = getRequestedServices(entry);
    const matchesService =
      state.filters.service === "all" || requestedServices.includes(state.filters.service);
    const dateKey = entry.createdAt.slice(0, 10);
    const matchesFrom = !state.filters.dateFrom || dateKey >= state.filters.dateFrom;
    const matchesTo = !state.filters.dateTo || dateKey <= state.filters.dateTo;
    return matchesService && matchesFrom && matchesTo;
  });
}

function syncHistorySelectionState() {
  const availableIds = new Set(state.history.map((entry) => Number(entry.id)));
  state.selectedHistoryIds = new Set(
    [...state.selectedHistoryIds].filter((historyId) => availableIds.has(Number(historyId)))
  );
}

function renderHistoryTable() {
  syncHistorySelectionState();
  const history = filteredHistory();
  const pageCount = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  state.historyPage = Math.min(state.historyPage, pageCount);
  const startIndex = (state.historyPage - 1) * PAGE_SIZE;
  const currentPageRows = history.slice(startIndex, startIndex + PAGE_SIZE);
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
          </tr>
        </thead>
        <tbody>
          ${currentPageRows
            .map((entry) => {
              const status = getStatusInfo(entry.status);
              return `
                <tr class="table-row-button" data-history-id="${entry.id}">
                  <td><input type="checkbox" data-history-select="${entry.id}" ${state.selectedHistoryIds.has(Number(entry.id)) ? "checked" : ""} /></td>
                  <td>${escapeHTML(formatDateTime(entry.createdAt))}</td>
                  <td>${escapeHTML(previewText(entry.text))}</td>
                  <td><div class="service-badges">${getRequestedServices(entry).map((siteId) => buildBadgeMarkup(siteId, state.runtimeSites)).join("")}</div></td>
                  <td><span class="status-pill ${status.className}">${escapeHTML(status.label)}</span></td>
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
  historyDeleteFiltered.disabled = history.length === 0;
}

function renderServiceFilterOptions() {
  historyServiceFilter.innerHTML = [
    `<option value="all">${escapeHTML(t.history.allServices)}</option>`,
    ...state.runtimeSites.map((site) => `<option value="${site.id}">${escapeHTML(site.name)}</option>`),
  ].join("");
  historyServiceFilter.value = state.filters.service;
}

function renderServicesSection() {
  servicesGrid.innerHTML = state.runtimeSites.map((site, index) => {
    const requestedEntries = state.history.filter((entry) => getRequestedServices(entry).includes(site.id));
    const successCount = state.history.filter((entry) => getSubmittedServices(entry).includes(site.id)).length;
    const requestCount = requestedEntries.length;
    const successRate = requestCount > 0 ? Math.round((successCount / requestCount) * 100) : 0;
    const lastUsed = requestedEntries[0]?.createdAt ? formatDateTime(requestedEntries[0].createdAt) : t.services.none;

    return `
      <article class="panel service-card">
        <div class="section-head">
          <h2>${escapeHTML(site.name)}</h2>
          <p>${escapeHTML(site.url)}</p>
        </div>
        <div class="metric-grid">
          <div>${escapeHTML(t.services.inputType)}</div><div>${escapeHTML(site.inputType)}</div>
          <div>${escapeHTML(t.services.waitTime)}</div><div>${escapeHTML(`${site.waitMs}ms`)}</div>
          <div>${escapeHTML(t.services.requestCount)}</div><div>${requestCount}</div>
          <div>${escapeHTML(t.services.successRate)}</div><div>${successRate}%</div>
          <div>${escapeHTML(t.services.lastUsed)}</div><div>${escapeHTML(lastUsed)}</div>
          <div>${escapeHTML(t.services.defaultColor)}</div><div><span class="swatch" style="background:${escapeHTML(site.color || CHART_COLORS[index % CHART_COLORS.length])}"></span></div>
        </div>
        <label class="settings-control" for="wait-range-${escapeHTML(site.id)}">
          <strong>${escapeHTML(t.services.waitTime)}</strong>
          <input
            id="wait-range-${escapeHTML(site.id)}"
            type="range"
            min="500"
            max="8000"
            step="100"
            value="${site.waitMs}"
            data-waitms-site-id="${escapeHTML(site.id)}"
          />
          <span class="helper" data-waitms-value="${escapeHTML(site.id)}">${escapeHTML(`${site.waitMs}ms`)}</span>
        </label>
      </article>
    `;
  }).join("");
}

function applySettingsToControls() {
  historyLimitSlider.value = String(state.settings.historyLimit);
  historyLimitValue.textContent = t.settings.historyLimitValue(state.settings.historyLimit);
  autoCloseToggle.checked = state.settings.autoClosePopup;
  desktopNotificationToggle.checked = state.settings.desktopNotifications;
  reuseTabsToggle.checked = state.settings.reuseExistingTabs;
  reuseTabsSettingTitle.textContent = t.settings.reuseTabsTitle;
  reuseTabsSettingDesc.textContent = t.settings.reuseTabsDesc;
  waitMultiplierSettingTitle.textContent = t.settings.waitMultiplierTitle;
  waitMultiplierSlider.value = String(state.settings.waitMsMultiplier);
  waitMultiplierSettingValue.textContent = t.settings.waitMultiplierValue(state.settings.waitMsMultiplier);
  historySelectAllLabel.textContent = t.history.selectAllLabel;
  historyDeleteSelected.textContent = t.history.deleteSelected;
  historyDeleteFiltered.textContent = t.history.deleteFiltered;
  historyDelete7d.textContent = t.history.deleteOlderThan(7);
  historyDelete30d.textContent = t.history.deleteOlderThan(30);
  historyDelete90d.textContent = t.history.deleteOlderThan(90);
}

function buildResultComparisonMarkup(entry) {
  const requested = getRequestedServices(entry);
  const submitted = new Set(Array.isArray(entry.submittedSiteIds) ? entry.submittedSiteIds : (entry.sentTo ?? []));
  const failed = new Set(Array.isArray(entry.failedSiteIds) ? entry.failedSiteIds : []);
  const siteResults = entry.siteResults ?? {};

  if (requested.length === 0) return "";

  const siteRows = requested.map((siteId) => {
    const site = state.runtimeSites.find((s) => s.id === siteId);
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

  // Result comparison view
  let comparisonEl = document.getElementById("history-modal-comparison");
  if (!comparisonEl) {
    comparisonEl = document.createElement("div");
    comparisonEl.id = "history-modal-comparison";
    historyModalText.parentElement?.appendChild(comparisonEl);
  }
  comparisonEl.innerHTML = buildResultComparisonMarkup(entry);

  historyModal.hidden = false;
}

function closeHistoryModal() {
  historyModal.hidden = true;
}

function getShortcutDisplayName(commandName) {
  switch (commandName) {
    case "_execute_action":
      return t.shortcuts.openPopup;
    case "capture-selected-text":
      return t.shortcuts.captureSelected;
    default:
      return commandName;
  }
}

async function renderShortcutList() {
  try {
    const commands = await chrome.commands.getAll();
    const commandMap = new Map(commands.map((command) => [command.name, command]));
    const relevantNames = ["_execute_action", "capture-selected-text"];

    shortcutList.innerHTML = relevantNames
      .map((commandName) => {
        const command = commandMap.get(commandName);
        const shortcutText = command?.shortcut?.trim() || t.shortcuts.unassigned;
        return `<div>${escapeHTML(getShortcutDisplayName(commandName))}: <strong>${escapeHTML(shortcutText)}</strong></div>`;
      })
      .join("");
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to load shortcuts.", error);
    shortcutList.textContent = t.shortcuts.loadFailed;
  }
}

async function loadData() {
  const [history, settings, runtimeSites] = await Promise.all([
    getPromptHistory(),
    getAppSettings(),
    getRuntimeSites(),
  ]);

  state.history = history;
  state.selectedHistoryIds.clear();
  state.runtimeSites = runtimeSites;
  state.settings = settings;
  renderServiceFilterOptions();
  renderDashboard();
  renderHistoryTable();
  renderServicesSection();
  applySettingsToControls();
}

async function saveSettings(partialSettings) {
  const nextSettings = await updateAppSettings(partialSettings);
  state.settings = nextSettings;

  if (typeof partialSettings.historyLimit !== "undefined") {
    await setPromptHistory(state.history);
    state.history = await getPromptHistory();
    renderDashboard();
    renderHistoryTable();
    renderServicesSection();
  }

  applySettingsToControls();
  setStatus(t.statusSaved, "success");
  showAppToast(t.statusSaved, "success", 1800);
}

async function saveSiteWaitMs(siteId, waitMs) {
  await updateRuntimeSite(siteId, { waitMs: Number(waitMs) });
  state.runtimeSites = await getRuntimeSites();
  renderServiceFilterOptions();
  renderServicesSection();
  showAppToast(t.settings.waitSaved, "success", 1600);
}

function switchSection(sectionId) {
  state.activeSection = sectionId;

  navButtons.forEach((button) => {
    const active = button.dataset.section === sectionId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });

  pageSections.forEach((section) => {
    const active = section.id === `section-${sectionId}`;
    section.classList.toggle("active", active);
    section.hidden = !active;
  });
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

function exportFilteredHistoryAsCsv() {
  const rows = filteredHistory();
  const header = [
    t.history.tableDate,
    t.history.tableStatus,
    t.history.tableServices,
    t.history.tablePrompt,
  ];
  const lines = rows.map((entry) => {
    return buildCsvLine([
      entry.createdAt,
      entry.status,
      getRequestedServices(entry).join("|"),
      entry.text,
    ]);
  });

  downloadBlob(
    `ai-prompt-broadcaster-history-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`,
    [buildCsvLine(header), ...lines].join("\n"),
    "text/csv;charset=utf-8"
  );
  setStatus(t.history.exportSuccess, "success");
  showAppToast(t.history.exportSuccess, "success", 1800);
}

async function refreshHistoryAfterMutation() {
  state.history = await getPromptHistory();
  syncHistorySelectionState();
  renderDashboard();
  renderHistoryTable();
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

async function resetAllData() {
  const response = await chrome.runtime.sendMessage({ action: "resetAllData" });
  if (!response?.ok) {
    throw new Error(response?.error ?? t.settings.resetFailed);
  }

  await loadData();
  state.historyPage = 1;
  renderServiceFilterOptions();
  applySettingsToControls();
  renderDashboard();
  renderHistoryTable();
  renderServicesSection();
  setStatus(t.settings.resetSuccess, "success");
  showAppToast(t.settings.resetSuccess, "success", 1800);
}

function bindEvents() {
  navButtons.forEach((button) => {
    button.addEventListener("click", () => switchSection(button.dataset.section));
  });

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
    const history = filteredHistory();
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

    const row = event.target.closest("[data-history-id]");
    if (row) {
      openHistoryModal(row.dataset.historyId);
    }
  });

  historyModalClose.addEventListener("click", closeHistoryModal);
  historyModal.addEventListener("click", (event) => {
    if (event.target === historyModal) {
      closeHistoryModal();
    }
  });

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

  historyLimitSlider.addEventListener("input", (event) => {
    historyLimitValue.textContent = t.settings.historyLimitValue(event.target.value);
  });

  historyLimitSlider.addEventListener("change", (event) => {
    void saveSettings({ historyLimit: Number(event.target.value) }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save history limit.", error);
      setStatus(error?.message ?? t.saveFailed, "error");
    });
  });

  autoCloseToggle.addEventListener("change", (event) => {
    void saveSettings({ autoClosePopup: event.target.checked }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save auto-close setting.", error);
      setStatus(error?.message ?? t.saveFailed, "error");
    });
  });

  desktopNotificationToggle.addEventListener("change", (event) => {
    void saveSettings({ desktopNotifications: event.target.checked }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save desktop notification setting.", error);
      setStatus(error?.message ?? t.saveFailed, "error");
      showAppToast(error?.message ?? t.saveFailed, "error", 3000);
    });
  });

  reuseTabsToggle.addEventListener("change", (event) => {
    void saveSettings({ reuseExistingTabs: event.target.checked }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save tab reuse setting.", error);
      setStatus(error?.message ?? t.saveFailed, "error");
      showAppToast(error?.message ?? t.saveFailed, "error", 3000);
    });
  });

  waitMultiplierSlider.addEventListener("input", (event) => {
    waitMultiplierSettingValue.textContent = t.settings.waitMultiplierValue(event.target.value);
  });

  waitMultiplierSlider.addEventListener("change", (event) => {
    void saveSettings({ waitMsMultiplier: Number(event.target.value) }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save wait multiplier.", error);
      setStatus(error?.message ?? t.saveFailed, "error");
      showAppToast(error?.message ?? t.saveFailed, "error", 3000);
    });
  });

  settingsResetData.addEventListener("click", () => {
    showConfirmToast(t.settings.resetConfirm, async () => {
      try {
        await resetAllData();
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Failed to reset data.", error);
        setStatus(error?.message ?? t.settings.resetFailed, "error");
        showAppToast(error?.message ?? t.settings.resetFailed, "error", 3000);
      }
    });
  });

  openShortcutsBtn.addEventListener("click", () => {
    void chrome.tabs.create({ url: "chrome://extensions/shortcuts" }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to open shortcuts page.", error);
      setStatus(error?.message ?? t.settings.shortcutsOpenFailed, "error");
      showAppToast(error?.message ?? t.settings.shortcutsOpenFailed, "error", 3000);
    });
  });

  settingsExportJson.addEventListener("click", async () => {
    try {
      const payload = await exportPromptData();
      downloadBlob(
        `ai-prompt-broadcaster-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
        JSON.stringify(payload, null, 2),
        "application/json"
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

  importReportModalClose.addEventListener("click", closeImportReportModal);
  importReportModal.addEventListener("click", (event) => {
    if (event.target === importReportModal) {
      closeImportReportModal();
    }
  });

  servicesGrid.addEventListener("input", (event) => {
    const slider = event.target.closest("[data-waitms-site-id]");
    if (!slider) {
      return;
    }

    const valueLabel = servicesGrid.querySelector(`[data-waitms-value="${CSS.escape(slider.dataset.waitmsSiteId)}"]`);
    if (valueLabel) {
      valueLabel.textContent = `${slider.value}ms`;
    }
  });

  servicesGrid.addEventListener("change", (event) => {
    const slider = event.target.closest("[data-waitms-site-id]");
    if (!slider) {
      return;
    }

    void saveSiteWaitMs(slider.dataset.waitmsSiteId, slider.value).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save waitMs.", error);
      setStatus(error?.message ?? t.saveFailed, "error");
      showAppToast(error?.message ?? t.saveFailed, "error", 3000);
    });
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (
      changes.promptHistory ||
      changes.promptFavorites ||
      changes.appSettings ||
      changes.templateVariableCache ||
      changes.customSites ||
      changes.builtInSiteStates ||
      changes.builtInSiteOverrides
    ) {
      void loadData().catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to refresh options page.", error);
        setStatus(error?.message ?? t.dataRefreshFailed, "error");
      });
    }
  });

  window.addEventListener("focus", () => {
    void renderShortcutList();
  });
}

async function init() {
  try {
    applyI18n();
    document.documentElement.lang = isKorean ? "ko" : "en";
    document.title = t.pageTitle || document.title;
    initToastRoot(toastHost);
    renderServiceFilterOptions();
    bindEvents();
    switchSection(state.activeSection);
    await renderShortcutList();
    await loadData();
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to initialize options page.", error);
    setStatus(error?.message ?? t.initFailed, "error");
    showAppToast(error?.message ?? t.initFailed, "error", 3000);
  }
}

void init();
