// @ts-nocheck
import { escapeHTML } from "../../shared/security";

export const CHART_COLORS = ["#c24f2e", "#f2a446", "#2a9d8f", "#457b9d", "#7b61ff", "#bc6c25"];

export function createEmptyState(message) {
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

export function buildDonutMarkup(items, labels) {
  if (items.length === 0) {
    return createEmptyState(labels.noUsage);
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
      <svg class="chart-svg" viewBox="0 0 220 220" role="img" aria-label="${escapeHTML(labels.donutAria)}">
        ${segments.map((segment) => `<path d="${segment.path}" fill="${segment.color}"></path>`).join("")}
        <text x="110" y="102" text-anchor="middle" font-size="14" fill="currentColor">${escapeHTML(labels.totalSent)}</text>
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
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

export function buildBarChartMarkup(items, labels) {
  if (items.length === 0) {
    return createEmptyState(labels.noDaily);
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
        <text x="${x + barWidth / 2}" y="164" text-anchor="middle" font-size="12" fill="currentColor">${escapeHTML(String(item.label ?? ""))}</text>
        <text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" font-size="12" fill="currentColor">${escapeHTML(String(item.count ?? 0))}</text>
      `;
    })
    .join("");

  return `
    <svg class="chart-svg" viewBox="0 0 380 ${chartHeight}" role="img" aria-label="${escapeHTML(labels.barAria)}">
      ${bars}
    </svg>
  `;
}

export function buildHeatmapMarkup(rows, labels) {
  const maxCount = Math.max(...(Array.isArray(rows) ? rows.flatMap((row) => row.counts ?? []) : [0]), 0);
  if (!Array.isArray(rows) || rows.length === 0 || maxCount <= 0) {
    return createEmptyState(labels.noHeatmap);
  }

  const hourHeader = Array.from({ length: 24 }, (_, hour) => `<span>${hour}</span>`).join("");

  return `
    <div class="heatmap" role="img" aria-label="${escapeHTML(labels.heatmapAria)}">
      <div class="heatmap-row heatmap-header">
        <span>${escapeHTML(labels.hourLabel)}</span>
        <div class="heatmap-cells">${hourHeader}</div>
      </div>
      ${rows.map((row) => `
        <div class="heatmap-row">
          <span>${escapeHTML(row.label)}</span>
          <div class="heatmap-cells">
            ${(row.counts ?? []).map((count) => {
              const intensity = maxCount > 0 ? Math.max(0.08, count / maxCount) : 0.08;
              return `<span class="heatmap-cell" title="${escapeHTML(`${row.label} · ${count}`)}" style="opacity:${intensity}">${count > 0 ? count : ""}</span>`;
            }).join("")}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

export function buildTrendMarkup(items, labels) {
  if (!Array.isArray(items) || items.length === 0) {
    return createEmptyState(labels.noTrend);
  }

  return `
    <div class="trend-list">
      ${items.map((item) => `
        <div class="trend-card">
          <div class="trend-head">
            <strong>${escapeHTML(item.label)}</strong>
            <span>${item.successRate}%</span>
          </div>
          <div class="trend-bars">
            ${(item.dailySeries ?? []).map((point) => `
              <span class="trend-bar-wrap" title="${escapeHTML(`${point.label}: ${point.successRate}% (${point.successes}/${point.requests})`)}">
                <span class="trend-bar" style="height:${Math.max(8, point.successRate)}%"></span>
              </span>
            `).join("")}
          </div>
          <div class="trend-meta">${escapeHTML(`${item.requestCount} ${labels.requestsLabel}`)}</div>
        </div>
      `).join("")}
    </div>
  `;
}
