// @ts-nocheck
import { getLocalDateKey, getRelativeLocalDateKey } from "../../shared/date-utils";
import { escapeHTML } from "../../shared/security";
import { buildBarChartMarkup, buildDonutMarkup } from "../ui/charts";
import { optionsDom } from "../app/dom";
import { t } from "../app/i18n";
import { state } from "../app/state";
import {
  formatShortDate,
  getRequestedServices,
  getSiteLabel,
} from "../app/helpers";

const { dashboardCards, serviceDonut, dailyBarChart } = optionsDom.dashboard;

function getStartOfCurrentWeek() {
  const now = new Date();
  const result = new Date(now);
  const offset = (result.getDay() + 6) % 7;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - offset);
  return result;
}

export function buildDashboardMetrics(history = state.history) {
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
    const dateKey = getRelativeLocalDateKey(-index);
    dailyCounts.push({
      key: dateKey,
      label: formatShortDate(date),
      count: history.filter((entry) => getLocalDateKey(entry.createdAt) === dateKey).length,
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

export function renderDashboard() {
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
      `,
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
