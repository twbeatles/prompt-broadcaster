// @ts-nocheck
import { escapeHTML } from "../../shared/security";
import { optionsDom } from "../app/dom";
import { formatShortDate } from "../app/helpers";
import { msg, t } from "../app/i18n";
import { state } from "../app/state";
import {
  buildBarChartMarkup,
  buildDonutMarkup,
  createEmptyState,
} from "../ui/charts";
import { switchSection } from "../core/navigation";
import { buildDashboardMetrics } from "./dashboard-metrics";

const {
  dailyBarChart,
  dashboardCards,
  dashboardRecentActivity,
  dashboardNextActions,
  failureReasons,
  serviceDonut,
} = optionsDom.dashboard;

function formatDailyLabel(dateKey) {
  return formatShortDate(`${dateKey}T00:00:00`);
}

function buildFailureReasonsMarkup(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "";
  }

  return `
    <div class="section-head dashboard-advanced-head">
      <h2>${escapeHTML(msg("options_chart_failure_title") || "Failures")}</h2>
    </div>
    <div class="summary-list">
      ${items.slice(0, 3).map((item) => {
        const label = t.settings.resultCodeLabels[item.code] || item.code;
        return `
          <div class="summary-row">
            <div class="summary-copy">
              <strong>${escapeHTML(label)}</strong>
              <span>${escapeHTML(item.code)}</span>
            </div>
            <div class="summary-meta">${escapeHTML(String(item.count))}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function getHistoryNoteCount(historyId) {
  return state.comparisonNotes.filter((note) => Number(note.historyId) === Number(historyId)).length;
}

function getSubmittedWithoutResponseCount(entry) {
  const submitted = Array.isArray(entry.submittedSiteIds) ? entry.submittedSiteIds : [];
  const notes = new Set(
    state.comparisonNotes
      .filter((note) => Number(note.historyId) === Number(entry.id))
      .map((note) => note.serviceId),
  );
  return submitted.filter((siteId) => !notes.has(siteId)).length;
}

function buildRecentActivityMarkup(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return createEmptyState(msg("options_dashboard_no_recent") || "No sends yet.");
  }

  return items.map((item) => {
    const noteCount = getHistoryNoteCount(item.id);
    const missing = getSubmittedWithoutResponseCount(item);
    const status = item.failedSiteIds.length > 0
      ? (msg("options_dashboard_status_needs_check") || "Needs check")
      : (msg("options_dashboard_status_sent") || "Sent");
    const responseLabel = noteCount > 0
      ? (msg("options_dashboard_response_count", [String(noteCount)]) || `${noteCount} responses`)
      : missing > 0
        ? (msg("options_dashboard_response_missing") || "Response not saved")
        : (msg("options_dashboard_response_not_needed") || "No response yet");

    return `
      <article class="dashboard-row">
        <div class="dashboard-row-main">
          <strong>${escapeHTML(item.text || "-")}</strong>
          <span>${escapeHTML(formatShortDate(item.createdAt))} | ${escapeHTML(status)}</span>
        </div>
        <span class="dashboard-pill ${noteCount > 0 ? "success" : missing > 0 ? "warning" : ""}">${escapeHTML(responseLabel)}</span>
      </article>
    `;
  }).join("");
}

function buildActionItems(metrics) {
  const items = [];
  const serviceNeedsCheck = state.serviceHealthSnapshots.filter((snapshot) => {
    if (snapshot.selectorWarning) {
      return true;
    }
    if (!snapshot.lastFailureAt) {
      return false;
    }
    return !snapshot.lastSuccessAt || Date.parse(snapshot.lastFailureAt) > Date.parse(snapshot.lastSuccessAt);
  });
  const latestMissingResponse = metrics.recentItems.find((item) => getSubmittedWithoutResponseCount(item) > 0);

  if (serviceNeedsCheck.length > 0) {
    items.push({
      kind: "service",
      label: msg("options_dashboard_action_service") || "Check service status",
      detail: msg("options_dashboard_action_service_desc", [String(serviceNeedsCheck.length)]) || `${serviceNeedsCheck.length} service(s) need attention.`,
      section: "services",
    });
  }

  if (latestMissingResponse) {
    items.push({
      kind: "response",
      label: msg("options_dashboard_action_response") || "Save missing responses",
      detail: msg("options_dashboard_action_response_desc") || "Open history to capture or paste AI responses.",
      section: "history",
    });
  }

  if (!state.settings.autoCaptureResponses) {
    items.push({
      kind: "setting",
      label: msg("options_dashboard_action_auto_capture") || "Turn on response saving",
      detail: msg("options_dashboard_action_auto_capture_desc") || "Automatic response saving is currently off.",
      section: "settings",
    });
  }

  if (items.length === 0) {
    items.push({
      kind: "ready",
      label: msg("options_dashboard_action_ready") || "Ready for the next send",
      detail: msg("options_dashboard_action_ready_desc") || "No urgent action is needed right now.",
      section: "history",
    });
  }

  return items;
}

function buildNextActionsMarkup(metrics) {
  return buildActionItems(metrics).map((item) => `
    <article class="dashboard-row action-row">
      <div class="dashboard-row-main">
        <strong>${escapeHTML(item.label)}</strong>
        <span>${escapeHTML(item.detail)}</span>
      </div>
      <button class="btn ghost" type="button" data-dashboard-section="${escapeHTML(item.section)}">${escapeHTML(msg("options_dashboard_open") || "Open")}</button>
    </article>
  `).join("");
}

function bindDashboardClicks() {
  const section = document.getElementById("section-dashboard");
  if (!section) {
    return;
  }

  section.onclick = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest("[data-dashboard-section]");
    const sectionId = button?.getAttribute("data-dashboard-section");
    if (sectionId) {
      switchSection(sectionId);
    }
  };
}

export function renderDashboard() {
  const metrics = buildDashboardMetrics(
    state.history,
    state.runtimeSites,
    state.strategyStats,
  );
  const cards = [
    { label: msg("options_dashboard_card_recent") || "Recent sends", value: metrics.weekCount },
    { label: msg("options_dashboard_card_success") || "Recent success", value: `${metrics.recentSuccessRate}%` },
    { label: msg("options_dashboard_card_responses") || "Saved responses", value: state.comparisonNotes.length },
    { label: msg("options_dashboard_card_actions") || "Needs attention", value: buildActionItems(metrics).filter((item) => item.kind !== "ready").length },
  ];

  if (dashboardCards) {
    dashboardCards.innerHTML = cards
    .map(
      (card) => `
        <article class="card">
          <div class="card-label">${escapeHTML(card.label)}</div>
          <div class="card-value">${escapeHTML(String(card.value))}</div>
        </article>
      `,
    )
    .join("");
  }

  if (dashboardRecentActivity) {
    dashboardRecentActivity.innerHTML = buildRecentActivityMarkup(metrics.recentItems);
  }

  if (dashboardNextActions) {
    dashboardNextActions.innerHTML = buildNextActionsMarkup(metrics);
  }

  if (serviceDonut) {
    serviceDonut.innerHTML = buildDonutMarkup(metrics.donutItems, {
    noUsage: t.charts.noUsage,
    totalSent: t.charts.totalSent,
    donutAria: t.charts.donutAria,
    });
  }

  if (dailyBarChart) {
    dailyBarChart.innerHTML = buildBarChartMarkup(
    metrics.dailyCounts.map((item) => ({
      ...item,
      label: formatDailyLabel(item.key),
    })),
    {
      noDaily: t.charts.noDaily,
      barAria: t.charts.barAria,
    },
    );
  }

  if (failureReasons) {
    failureReasons.innerHTML = buildFailureReasonsMarkup(metrics.failureReasonItems);
  }

  bindDashboardClicks();
}
