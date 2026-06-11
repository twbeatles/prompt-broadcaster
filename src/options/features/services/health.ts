// @ts-nocheck
import { sendRuntimeMessageWithTimeout } from "../../../shared/chrome/messaging";
import { escapeHTML } from "../../../shared/security";
import { t } from "../../app/i18n";
import { state } from "../../app/state";
import { formatDateTime, getSubmittedServices } from "../../app/helpers";
import { showAppToast } from "../../core/status";
import { servicesHealthCenter } from "./dom";

export function getHealthStatus(snapshot) {
  if (snapshot?.selectorWarning) {
    return { label: t.services.healthWarning, tone: "danger" };
  }
  if (snapshot?.lastFailureAt && (!snapshot?.lastSuccessAt || Date.parse(snapshot.lastFailureAt) > Date.parse(snapshot.lastSuccessAt))) {
    return { label: snapshot.lastFailureCode || "Recent failure", tone: "warning" };
  }
  if (snapshot?.lastSuccessAt) {
    return { label: t.services.healthHealthy, tone: "success" };
  }
  return { label: t.services.healthNoRecentRun, tone: "muted" };
}

export function renderServiceHealthCenter() {
  if (!servicesHealthCenter) {
    return;
  }

  if (!state.serviceHealthSnapshots?.length) {
    servicesHealthCenter.innerHTML = `<div class="empty-state">${escapeHTML(t.services.healthEmpty)}</div>`;
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
          <button class="btn ghost" type="button" data-health-action="login" data-service-id="${escapeHTML(snapshot.serviceId)}">${escapeHTML(t.services.healthLogin)}</button>
          <button class="btn ghost" type="button" data-health-action="retry" data-service-id="${escapeHTML(snapshot.serviceId)}">${escapeHTML(t.services.healthRetry)}</button>
          <button class="btn ghost" type="button" data-health-action="selector" data-service-id="${escapeHTML(snapshot.serviceId)}">${escapeHTML(t.services.healthSelectorCheck)}</button>
          <button class="btn ghost" type="button" data-health-action="new-tab" data-service-id="${escapeHTML(snapshot.serviceId)}">${escapeHTML(t.services.healthNewTab)}</button>
        </div>
      </article>
    `;
  }).join("");
}

export async function refreshServiceHealth() {
  const response = await sendRuntimeMessageWithTimeout({ action: "service-health:get" }, 5000, {
    ok: false,
    snapshots: [],
  });
  state.serviceHealthSnapshots = response?.snapshots ?? [];
  renderServiceHealthCenter();
}

export async function retryFailedService(serviceId) {
  const failedEntry = state.history.find((entry) => entry.failedSiteIds?.includes(serviceId));
  if (!failedEntry) {
    showAppToast(t.services.retryNoFailed, "warning", 2200);
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
  showAppToast(t.services.retryQueued, "success", 1800);
}
