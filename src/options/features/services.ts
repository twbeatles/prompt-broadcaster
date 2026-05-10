// @ts-nocheck
import { setServiceGroups, updateAppSettings } from "../../shared/prompts";
import { sendRuntimeMessageWithTimeout } from "../../shared/chrome/messaging";
import { getRuntimeSites, updateRuntimeSite } from "../../shared/sites";
import { sortSitesByOrder } from "../../shared/sites/order";
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

const {
  servicesGrid,
  servicesHealthCenter,
  servicesRefreshHealthBtn,
  serviceGroupTitle,
  serviceGroupSaveBtn,
  serviceGroupsList,
} = optionsDom.services;
const { servicesOpenManagerBtn } = optionsDom.services;

function getHealthStatus(snapshot) {
  if (snapshot?.selectorWarning) {
    return { label: "Selector warning", tone: "danger" };
  }
  if (snapshot?.lastFailureAt && (!snapshot?.lastSuccessAt || Date.parse(snapshot.lastFailureAt) > Date.parse(snapshot.lastSuccessAt))) {
    return { label: snapshot.lastFailureCode || "Recent failure", tone: "warning" };
  }
  if (snapshot?.lastSuccessAt) {
    return { label: "Healthy", tone: "success" };
  }
  return { label: "No recent run", tone: "muted" };
}

function renderServiceHealthCenter() {
  if (!servicesHealthCenter) {
    return;
  }

  if (!state.serviceHealthSnapshots?.length) {
    servicesHealthCenter.innerHTML = `<div class="empty-state">No service health snapshot yet.</div>`;
    return;
  }

  servicesHealthCenter.innerHTML = state.serviceHealthSnapshots.map((snapshot) => {
    const status = getHealthStatus(snapshot);
    const selector = snapshot.selectorWarning?.selector || "";
    const verified = snapshot.verification?.verifiedAt || snapshot.verification?.lastVerified || "";
    return `
      <article class="service-health-row" data-health-service="${escapeHTML(snapshot.serviceId)}">
        <div>
          <strong>${escapeHTML(snapshot.serviceName)}</strong>
          <div class="helper">
            ${escapeHTML(status.label)}
            ${snapshot.preferredStrategy ? ` · strategy: ${escapeHTML(snapshot.preferredStrategy)}` : ""}
            ${verified ? ` · verified: ${escapeHTML(formatDateTime(verified))}` : ""}
          </div>
          ${selector ? `<code class="inline-code">${escapeHTML(selector)}</code>` : ""}
        </div>
        <div class="settings-actions">
          <button class="btn ghost" type="button" data-health-action="login" data-service-id="${escapeHTML(snapshot.serviceId)}">Login</button>
          <button class="btn ghost" type="button" data-health-action="retry" data-service-id="${escapeHTML(snapshot.serviceId)}">Retry failed</button>
          <button class="btn ghost" type="button" data-health-action="selector" data-service-id="${escapeHTML(snapshot.serviceId)}">Selector check</button>
          <button class="btn ghost" type="button" data-health-action="new-tab" data-service-id="${escapeHTML(snapshot.serviceId)}">New tab</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderServiceGroups() {
  if (!serviceGroupsList) {
    return;
  }

  if (!state.serviceGroups?.length) {
    serviceGroupsList.innerHTML = `<div class="empty-state">No service groups yet.</div>`;
    return;
  }

  serviceGroupsList.innerHTML = state.serviceGroups.map((group) => {
    const names = group.serviceIds
      .map((siteId) => state.runtimeSites.find((site) => site.id === siteId)?.name || siteId)
      .join(", ");
    return `
      <article class="service-health-row">
        <div>
          <strong>${escapeHTML(group.title)}</strong>
          <div class="helper">${escapeHTML(names || "No services")}</div>
        </div>
        <div class="settings-actions">
          <button class="btn ghost" type="button" data-group-select="${escapeHTML(group.id)}">Check services</button>
          <button class="btn danger ghost" type="button" data-group-delete="${escapeHTML(group.id)}">Delete</button>
        </div>
      </article>
    `;
  }).join("");
}

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
        <div class="settings-actions">
          <button class="btn ghost" type="button" data-move-site="${escapeHTML(site.id)}" data-direction="up" ${index === 0 ? "disabled" : ""}>${escapeHTML(t.services.moveUp)}</button>
          <button class="btn ghost" type="button" data-move-site="${escapeHTML(site.id)}" data-direction="down" ${index === state.runtimeSites.length - 1 ? "disabled" : ""}>${escapeHTML(t.services.moveDown)}</button>
        </div>
        <label class="checkbox-inline">
          <input type="checkbox" data-service-group-select="${escapeHTML(site.id)}" />
          <span>Use in group</span>
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

export async function saveSiteWaitMs(siteId, waitMs) {
  await updateRuntimeSite(siteId, { waitMs: Number(waitMs) });
  state.runtimeSites = sortSitesByOrder(await getRuntimeSites(), state.settings.siteOrder);
  renderServiceFilterOptions();
  renderServicesSection();
  showAppToast(t.settings.waitSaved, "success", 1600);
}

async function refreshServiceHealth() {
  const response = await sendRuntimeMessageWithTimeout({ action: "service-health:get" }, 5000, {
    ok: false,
    snapshots: [],
  });
  state.serviceHealthSnapshots = response?.snapshots ?? [];
  renderServiceHealthCenter();
}

async function retryFailedService(serviceId) {
  const failedEntry = state.history.find((entry) => entry.failedSiteIds?.includes(serviceId));
  if (!failedEntry) {
    showAppToast("No failed history item found for this service.", "warning", 2200);
    return;
  }

  const response = await sendRuntimeMessageWithTimeout({
    action: "broadcast",
    prompt: failedEntry.text,
    sites: [serviceId],
  }, 10000);
  if (!response?.ok) {
    throw new Error(response?.error || "Retry could not be queued.");
  }
  showAppToast("Retry queued for failed service.", "success", 1800);
}

async function saveCheckedServiceGroup() {
  const selectedIds = [...servicesGrid.querySelectorAll("[data-service-group-select]:checked")]
    .map((input) => input.dataset.serviceGroupSelect)
    .filter(Boolean);
  const title = serviceGroupTitle.value.trim() || `Group ${state.serviceGroups.length + 1}`;
  if (selectedIds.length === 0) {
    showAppToast("Check at least one service for the group.", "warning", 2200);
    return;
  }

  const now = new Date().toISOString();
  const existing = state.serviceGroups.find((group) => group.title === title);
  const nextGroup = {
    ...(existing ?? {}),
    id: existing?.id || `group-${Date.now()}`,
    title,
    serviceIds: selectedIds,
    sortOrder: existing?.sortOrder ?? state.serviceGroups.length,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  state.serviceGroups = await setServiceGroups([
    nextGroup,
    ...state.serviceGroups.filter((group) => group.id !== nextGroup.id),
  ]);
  renderServiceGroups();
  showAppToast("Service group saved.", "success", 1600);
}

function moveRuntimeSite(siteId, direction) {
  const currentIndex = state.runtimeSites.findIndex((site) => site.id === siteId);
  if (currentIndex === -1) {
    return null;
  }

  const offset = direction === "up" ? -1 : 1;
  const nextIndex = currentIndex + offset;
  if (nextIndex < 0 || nextIndex >= state.runtimeSites.length) {
    return null;
  }

  const nextSites = [...state.runtimeSites];
  const [movedSite] = nextSites.splice(currentIndex, 1);
  nextSites.splice(nextIndex, 0, movedSite);
  return nextSites;
}

async function saveSiteOrder(siteId, direction) {
  const nextSites = moveRuntimeSite(siteId, direction);
  if (!nextSites) {
    return;
  }

  const nextSettings = await updateAppSettings({
    siteOrder: nextSites.map((site) => site.id),
  });
  state.settings = nextSettings;
  state.runtimeSites = nextSites;
  renderServiceFilterOptions();
  renderServicesSection();
  setStatus(t.services.orderSaved, "success");
  showAppToast(t.services.orderSaved, "success", 1600);
}

export function bindServiceEvents() {
  servicesOpenManagerBtn.addEventListener("click", () => {
    const popupUrl = chrome.runtime.getURL("popup/popup.html#settings");
    void chrome.windows.create({
      url: popupUrl,
      type: "popup",
      width: 480,
      height: 760,
      focused: true,
    }).catch(async (error) => {
      console.error("[AI Prompt Broadcaster] Failed to open popup manager window.", error);
      try {
        await chrome.tabs.create({ url: popupUrl });
      } catch (fallbackError) {
        console.error("[AI Prompt Broadcaster] Failed to open popup manager tab.", fallbackError);
        setStatus(t.services.openManagerFailed, "error");
        showAppToast(t.services.openManagerFailed, "error", 3000);
      }
    });
  });

  servicesRefreshHealthBtn?.addEventListener("click", () => {
    void refreshServiceHealth().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to refresh service health.", error);
      showAppToast(error?.message || "Service health refresh failed.", "error", 3000);
    });
  });

  serviceGroupSaveBtn?.addEventListener("click", () => {
    void saveCheckedServiceGroup().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save service group.", error);
      showAppToast(error?.message || "Service group save failed.", "error", 3000);
    });
  });

  servicesHealthCenter?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-health-action][data-service-id]");
    if (!button) {
      return;
    }

    const site = state.runtimeSites.find((entry) => entry.id === button.dataset.serviceId);
    if (!site) {
      return;
    }

    if (button.dataset.healthAction === "retry") {
      void retryFailedService(site.id).catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to retry service.", error);
        showAppToast(error?.message || "Retry failed.", "error", 3000);
      });
      return;
    }

    if (button.dataset.healthAction === "selector") {
      void chrome.tabs.create({ url: site.url, active: true });
      showAppToast("Open the service tab, then use the popup test action after login.", "info", 3000);
      return;
    }

    void chrome.tabs.create({ url: site.url, active: true });
  });

  serviceGroupsList?.addEventListener("click", (event) => {
    const selectButton = event.target.closest("[data-group-select]");
    const deleteButton = event.target.closest("[data-group-delete]");

    if (selectButton) {
      const group = state.serviceGroups.find((entry) => entry.id === selectButton.dataset.groupSelect);
      const selected = new Set(group?.serviceIds ?? []);
      servicesGrid.querySelectorAll("[data-service-group-select]").forEach((input) => {
        input.checked = selected.has(input.dataset.serviceGroupSelect);
      });
      if (group && serviceGroupTitle) {
        serviceGroupTitle.value = group.title;
      }
      return;
    }

    if (deleteButton) {
      state.serviceGroups = state.serviceGroups.filter((entry) => entry.id !== deleteButton.dataset.groupDelete);
      void setServiceGroups(state.serviceGroups).then(() => {
        renderServiceGroups();
        showAppToast("Service group deleted.", "success", 1600);
      });
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

  servicesGrid.addEventListener("click", (event) => {
    const moveButton = event.target.closest("[data-move-site][data-direction]");
    if (!moveButton) {
      return;
    }

    void saveSiteOrder(moveButton.dataset.moveSite, moveButton.dataset.direction).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save site order.", error);
      setStatus(error?.message ?? t.saveFailed, "error");
      showAppToast(error?.message ?? t.saveFailed, "error", 3000);
    });
  });
}
