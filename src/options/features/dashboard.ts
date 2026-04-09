// @ts-nocheck
import { escapeHTML } from "../../shared/security";
import { optionsDom } from "../app/dom";
import { formatShortDate } from "../app/helpers";
import { locale, t } from "../app/i18n";
import { state } from "../app/state";
import {
  buildBarChartMarkup,
  buildDonutMarkup,
  buildHeatmapMarkup,
  buildTrendMarkup,
  createEmptyState,
} from "../ui/charts";
import { buildDashboardMetrics } from "./dashboard-metrics";

const {
  activityHeatmap,
  dailyBarChart,
  dashboardCards,
  failureReasons,
  serviceDonut,
  serviceTrend,
  strategySummary,
} = optionsDom.dashboard;

function getWeekdayLabels() {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const monday = new Date("2026-01-05T00:00:00");

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return formatter.format(date);
  });
}

function formatDailyLabel(dateKey) {
  return formatShortDate(`${dateKey}T00:00:00`);
}

function buildFailureReasonsMarkup(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return createEmptyState(t.charts.noFailure);
  }

  return `
    <div class="summary-list">
      ${items.slice(0, 6).map((item) => {
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

function buildStrategySummaryMarkup(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return createEmptyState(t.charts.noStrategy);
  }

  return `
    <div class="summary-list">
      ${items.slice(0, 6).map((item) => `
        <div class="summary-row">
          <div class="summary-copy">
            <strong>${escapeHTML(item.label)}</strong>
            <span>${escapeHTML(`${t.charts.bestStrategyLabel}: ${item.bestStrategy || "-"}`)}</span>
          </div>
          <div class="summary-meta">
            ${escapeHTML(`${item.totalAttempts} ${t.charts.attemptsLabel}`)}
            <br />
            ${escapeHTML(`${item.bestSuccessRate}%`)}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

export function renderDashboard() {
  const metrics = buildDashboardMetrics(
    state.history,
    state.runtimeSites,
    state.strategyStats,
  );
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
      `,
    )
    .join("");

  serviceDonut.innerHTML = buildDonutMarkup(metrics.donutItems, {
    noUsage: t.charts.noUsage,
    totalSent: t.charts.totalSent,
    donutAria: t.charts.donutAria,
  });

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

  activityHeatmap.innerHTML = buildHeatmapMarkup(
    metrics.heatmap.rows.map((row) => ({
      ...row,
      label: getWeekdayLabels()[row.dayIndex] ?? `D${row.dayIndex + 1}`,
    })),
    {
      noHeatmap: t.charts.noHeatmap,
      heatmapAria: t.charts.heatmapAria,
      hourLabel: t.charts.hourLabel,
    },
  );

  serviceTrend.innerHTML = buildTrendMarkup(
    metrics.serviceTrendItems.map((item) => ({
      ...item,
      dailySeries: (item.dailySeries ?? []).map((point) => ({
        ...point,
        label: formatDailyLabel(point.key),
      })),
    })),
    {
      noTrend: t.charts.noTrend,
      requestsLabel: t.charts.requestsLabel,
    },
  );

  failureReasons.innerHTML = buildFailureReasonsMarkup(metrics.failureReasonItems);
  strategySummary.innerHTML = buildStrategySummaryMarkup(metrics.strategySummaryItems);
}
