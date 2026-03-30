// @ts-nocheck
import { AI_SITES } from "../config/sites";
import {
  DEFAULT_SETTINGS,
  exportPromptData,
  getAppSettings,
  getPromptHistory,
  importPromptData,
  setAppSettings,
  setPromptFavorites,
  setPromptHistory,
  setTemplateVariableCache,
  updateAppSettings,
} from "../shared/stores/prompt-store";
import { setFailedSelectors, setOnboardingCompleted } from "../shared/stores/runtime-state";
import { escapeHTML } from "../shared/security";
import { getRuntimeSites, resetSiteSettings, updateRuntimeSite } from "../shared/stores/sites-store";
import { initToastRoot, showToast } from "../popup/ui/toast";
import { CHART_COLORS, buildBarChartMarkup, buildDonutMarkup } from "./ui/charts";

const PAGE_SIZE = 10;

const uiLanguage = chrome.i18n.getUILanguage().toLowerCase();
const isKorean = uiLanguage === "ko" || uiLanguage.startsWith("ko-");
const locale = isKorean ? "ko-KR" : "en-US";

function msg(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || "";
}

function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((element) => {
    const value = msg(element.dataset.i18n);
    if (value) {
      element.textContent = value;
    }
  });

  root.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const value = msg(element.dataset.i18nPlaceholder);
    if (value) {
      element.setAttribute("placeholder", value);
    }
  });

  root.querySelectorAll("[data-i18n-title]").forEach((element) => {
    const value = msg(element.dataset.i18nTitle);
    if (value) {
      element.setAttribute("title", value);
    }
  });

  root.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    const value = msg(element.dataset.i18nAriaLabel);
    if (value) {
      element.setAttribute("aria-label", value);
    }
  });
}

const t = {
  pageTitle: msg("options_page_title"),
  statusSaved: msg("options_settings_saved"),
  saveFailed: msg("options_settings_save_failed"),
  dataRefreshFailed: msg("options_data_refresh_failed"),
  initFailed: msg("options_init_failed"),
  commonClose: msg("common_close"),
  cards: {
    totalTransmissions: msg("options_card_total_transmissions"),
    mostUsedService: msg("options_card_most_used_service"),
    weekCount: msg("options_card_week_count"),
    averagePromptLength: msg("options_card_average_prompt_length"),
    charSuffix: msg("options_card_char_suffix"),
  },
  charts: {
    noUsage: msg("options_chart_no_usage"),
    noDaily: msg("options_chart_no_daily"),
    totalSent: msg("options_chart_total_sent"),
    donutAria: msg("options_chart_donut_aria"),
    barAria: msg("options_chart_bar_aria"),
  },
  history: {
    emptyFiltered: msg("options_history_empty_filtered"),
    tableDate: msg("options_table_date"),
    tablePrompt: msg("options_table_prompt"),
    tableServices: msg("options_table_services"),
    tableStatus: msg("options_table_status"),
    allServices: msg("options_filter_all_services"),
    pageInfo: (current, total) => msg("options_page_info", [String(current), String(total)]),
    exportSuccess: msg("options_settings_export_success"),
    exportFailed: msg("options_settings_export_failed"),
  },
  services: {
    inputType: msg("options_service_input_type"),
    waitTime: msg("options_service_wait_time"),
    requestCount: msg("options_service_request_count"),
    successRate: msg("options_service_success_rate"),
    lastUsed: msg("options_service_last_used"),
    defaultColor: msg("options_service_default_color"),
    none: msg("options_value_none"),
  },
  settings: {
    historyLimitValue: (count) => msg("options_settings_history_limit_value", [String(count)]),
    resetConfirm: msg("options_settings_reset_confirm"),
    resetSuccess: msg("options_settings_reset_success"),
    resetFailed: msg("options_settings_reset_failed"),
    exportSuccess: msg("options_settings_export_success"),
    exportFailed: msg("options_settings_export_failed"),
    importSuccess: msg("options_settings_import_success"),
    importFailed: msg("options_settings_import_failed"),
    shortcutsOpenFailed: msg("options_settings_shortcuts_open_failed"),
    waitSaved: msg("options_wait_saved") || "Wait time saved.",
  },
  statuses: {
    submitted: msg("options_status_complete"),
    partial: msg("options_status_partial"),
    failed: msg("options_status_failed"),
    unknown: msg("options_status_unknown"),
  },
  shortcuts: {
    openPopup: msg("options_shortcut_open_popup"),
    captureSelected: msg("options_shortcut_capture_selected"),
    unassigned: msg("options_shortcut_unassigned"),
    loadFailed: msg("options_shortcut_load_failed"),
  },
};

const state = {
  history: [],
  runtimeSites: [],
  settings: { ...DEFAULT_SETTINGS },
  activeSection: "dashboard",
  historyPage: 1,
  filters: {
    service: "all",
    dateFrom: "",
    dateTo: "",
  },
};

const navButtons = [...document.querySelectorAll(".nav-button")];
const pageSections = [...document.querySelectorAll(".page-section")];
const pageStatus = document.getElementById("page-status");
const toastHost = document.getElementById("toast-host");
const dashboardCards = document.getElementById("dashboard-cards");
const serviceDonut = document.getElementById("service-donut");
const dailyBarChart = document.getElementById("daily-bar-chart");
const historyServiceFilter = document.getElementById("history-service-filter");
const historyDateFrom = document.getElementById("history-date-from");
const historyDateTo = document.getElementById("history-date-to");
const historyExportCsv = document.getElementById("history-export-csv");
const historyTableWrap = document.getElementById("history-table-wrap");
const historyPrevPage = document.getElementById("history-prev-page");
const historyNextPage = document.getElementById("history-next-page");
const historyPageInfo = document.getElementById("history-page-info");
const servicesGrid = document.getElementById("services-grid");
const historyLimitSlider = document.getElementById("history-limit-slider");
const historyLimitValue = document.getElementById("history-limit-value");
const autoCloseToggle = document.getElementById("auto-close-toggle");
const desktopNotificationToggle = document.getElementById("desktop-notification-toggle");
const shortcutList = document.getElementById("shortcut-list");
const openShortcutsBtn = document.getElementById("open-shortcuts-btn");
const settingsResetData = document.getElementById("settings-reset-data");
const settingsExportJson = document.getElementById("settings-export-json");
const settingsImportJson = document.getElementById("settings-import-json");
const settingsImportJsonInput = document.getElementById("settings-import-json-input");
const historyModal = document.getElementById("history-modal");
const historyModalClose = document.getElementById("history-modal-close");
const historyModalMeta = document.getElementById("history-modal-meta");
const historyModalServices = document.getElementById("history-modal-services");
const historyModalText = document.getElementById("history-modal-text");

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

function formatDateTime(value) {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch (_error) {
    return value;
  }
}

function formatShortDate(value) {
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "numeric",
      day: "numeric",
    }).format(new Date(value));
  } catch (_error) {
    return value;
  }
}

function previewText(text, maxLength = 60) {
  const collapsed = String(text ?? "").replace(/\s+/g, " ").trim();
  return collapsed.length <= maxLength ? collapsed || "-" : `${collapsed.slice(0, maxLength)}...`;
}

function getSiteLabel(siteId) {
  return state.runtimeSites.find((site) => site.id === siteId)?.name
    ?? AI_SITES.find((site) => site.id === siteId)?.name
    ?? siteId;
}

function getRequestedServices(entry) {
  const siteResultKeys = Object.keys(entry.siteResults ?? {});
  if (Array.isArray(entry?.requestedSiteIds) && entry.requestedSiteIds.length > 0) {
    return entry.requestedSiteIds;
  }

  return siteResultKeys.length > 0 ? siteResultKeys : entry.sentTo ?? [];
}

function getSubmittedServices(entry) {
  if (Array.isArray(entry?.submittedSiteIds) && entry.submittedSiteIds.length > 0) {
    return entry.submittedSiteIds;
  }

  return entry.sentTo ?? [];
}

function getStatusInfo(status) {
  switch (status) {
    case "submitted":
      return { label: t.statuses.submitted, className: "success" };
    case "partial":
      return { label: t.statuses.partial, className: "partial" };
    case "failed":
      return { label: t.statuses.failed, className: "failed" };
    default:
      return { label: status || t.statuses.unknown, className: "" };
  }
}

function buildBadgeMarkup(siteId) {
  return `<span class="badge">${escapeHTML(getSiteLabel(siteId))}</span>`;
}

function createEmptyState(message) {
  return `<div class="empty-state">${escapeHTML(message)}</div>`;
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
      label: getSiteLabel(siteId),
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
    mostUsedService: mostUsed ? getSiteLabel(mostUsed[0]) : "-",
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

function renderHistoryTable() {
  const history = filteredHistory();
  const pageCount = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  state.historyPage = Math.min(state.historyPage, pageCount);
  const startIndex = (state.historyPage - 1) * PAGE_SIZE;
  const currentPageRows = history.slice(startIndex, startIndex + PAGE_SIZE);

  if (currentPageRows.length === 0) {
    historyTableWrap.innerHTML = createEmptyState(t.history.emptyFiltered);
  } else {
    historyTableWrap.innerHTML = `
      <table>
        <thead>
          <tr>
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
                  <td>${escapeHTML(formatDateTime(entry.createdAt))}</td>
                  <td>${escapeHTML(previewText(entry.text))}</td>
                  <td><div class="service-badges">${getRequestedServices(entry).map((siteId) => buildBadgeMarkup(siteId)).join("")}</div></td>
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
          <div>${escapeHTML(t.services.defaultColor)}</div><div><span class="swatch" style="background:${CHART_COLORS[index % CHART_COLORS.length]}"></span></div>
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
}

function openHistoryModal(historyId) {
  const entry = state.history.find((item) => Number(item.id) === Number(historyId));
  if (!entry) {
    return;
  }

  const status = getStatusInfo(entry.status);
  historyModalMeta.textContent = `${formatDateTime(entry.createdAt)} · ${status.label}`;
  historyModalServices.innerHTML = getRequestedServices(entry).map((siteId) => buildBadgeMarkup(siteId)).join("");
  historyModalText.textContent = entry.text;
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
    button.classList.toggle("active", button.dataset.section === sectionId);
  });

  pageSections.forEach((section) => {
    section.classList.toggle("active", section.id === `section-${sectionId}`);
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
    const values = [
      entry.createdAt,
      entry.status,
      getRequestedServices(entry).join("|"),
      entry.text.replace(/"/g, "\"\""),
    ];
    return `"${values.join('","')}"`;
  });

  downloadBlob(
    `ai-prompt-broadcaster-history-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`,
    [header.join(","), ...lines].join("\n"),
    "text/csv;charset=utf-8"
  );
  setStatus(t.history.exportSuccess, "success");
  showAppToast(t.history.exportSuccess, "success", 1800);
}

async function resetAllData() {
  await Promise.all([
    setPromptHistory([]),
    setPromptFavorites([]),
    setTemplateVariableCache({}),
    setFailedSelectors([]),
    setOnboardingCompleted(false),
    setAppSettings(DEFAULT_SETTINGS),
    resetSiteSettings(),
    chrome.storage.local.remove("lastPrompt"),
  ]);

  state.history = [];
  state.runtimeSites = await getRuntimeSites();
  state.settings = { ...DEFAULT_SETTINGS };
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

  historyPrevPage.addEventListener("click", () => {
    state.historyPage = Math.max(1, state.historyPage - 1);
    renderHistoryTable();
  });

  historyNextPage.addEventListener("click", () => {
    state.historyPage += 1;
    renderHistoryTable();
  });

  historyTableWrap.addEventListener("click", (event) => {
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
      await importPromptData(text);
      await loadData();
      setStatus(t.settings.importSuccess, "success");
      showAppToast(t.settings.importSuccess, "success", 1800);
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to import JSON.", error);
      setStatus(error?.message ?? t.settings.importFailed, "error");
      showAppToast(error?.message ?? t.settings.importFailed, "error", 3000);
    } finally {
      settingsImportJsonInput.value = "";
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
    await renderShortcutList();
    await loadData();
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to initialize options page.", error);
    setStatus(error?.message ?? t.initFailed, "error");
    showAppToast(error?.message ?? t.initFailed, "error", 3000);
  }
}

void init();
