// @ts-nocheck
import { escapeHTML } from "../../../shared/security";
import { formatDateTime, getRequestedServices, getSubmittedServices } from "../../app/helpers";
import { t } from "../../app/i18n";
import { state } from "../../app/state";
import { CHART_COLORS } from "../../ui/charts";
import { servicesGrid } from "./dom";
import { renderServiceGroups } from "./groups";
import { renderServiceHealthCenter } from "./health";

export function renderServicesSection() {
  servicesGrid.innerHTML = state.runtimeSites.map((site, index) => {
    const requestedEntries = state.history.filter((entry) => getRequestedServices(entry).includes(site.id));
    const successCount = state.history.filter((entry) => getSubmittedServices(entry).includes(site.id)).length;
    const requestCount = requestedEntries.length;
    const successRate = requestCount > 0 ? Math.round((successCount / requestCount) * 100) : 0;
    const lastUsed = requestedEntries[0]?.createdAt ? formatDateTime(requestedEntries[0].createdAt) : t.services.none;

    return `
      <article class="panel service-card">
        <div class="service-card-head">
          <span class="swatch" style="background:${escapeHTML(site.color || CHART_COLORS[index % CHART_COLORS.length])}"></span>
          <div class="section-head">
            <h2>${escapeHTML(site.name)}</h2>
            <p>${escapeHTML(site.url)}</p>
          </div>
        </div>
        <div class="metric-grid">
          <div class="metric"><span class="metric-label">${escapeHTML(t.services.requestCount)}</span><span class="metric-value">${requestCount}</span></div>
          <div class="metric"><span class="metric-label">${escapeHTML(t.services.successRate)}</span><span class="metric-value">${requestCount > 0 ? `${successRate}%` : "–"}</span></div>
          <div class="metric"><span class="metric-label">${escapeHTML(t.services.lastUsed)}</span><span class="metric-value">${escapeHTML(lastUsed)}</span></div>
        </div>
        <div class="settings-actions">
          <button class="btn ghost" type="button" data-move-site="${escapeHTML(site.id)}" data-direction="up" ${index === 0 ? "disabled" : ""}>${escapeHTML(t.services.moveUp)}</button>
          <button class="btn ghost" type="button" data-move-site="${escapeHTML(site.id)}" data-direction="down" ${index === state.runtimeSites.length - 1 ? "disabled" : ""}>${escapeHTML(t.services.moveDown)}</button>
        </div>
        <label class="checkbox-inline">
          <input type="checkbox" data-service-group-select="${escapeHTML(site.id)}" />
          <span>${escapeHTML(t.services.groupUseInGroup)}</span>
        </label>
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
  renderServiceHealthCenter();
  renderServiceGroups();
}
