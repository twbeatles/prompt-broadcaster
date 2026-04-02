// @ts-nocheck
import { getRuntimeSites, updateRuntimeSite } from "../../shared/sites";
import { escapeHTML } from "../../shared/security";
import { CHART_COLORS } from "../ui/charts";
import { optionsDom } from "../app/dom";
import { t } from "../app/i18n";
import { state } from "../app/state";
import {
  formatDateTime,
  getRequestedServices,
  getSubmittedServices,
} from "../app/helpers";
import { renderServiceFilterOptions } from "../core/service-filter";
import { setStatus, showAppToast } from "../core/status";

const { servicesGrid } = optionsDom.services;

export function renderServicesSection() {
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

export async function saveSiteWaitMs(siteId, waitMs) {
  await updateRuntimeSite(siteId, { waitMs: Number(waitMs) });
  state.runtimeSites = await getRuntimeSites();
  renderServiceFilterOptions();
  renderServicesSection();
  showAppToast(t.settings.waitSaved, "success", 1600);
}

export function bindServiceEvents() {
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
}
