// @ts-nocheck
import { normalizeResultCode } from "../../../shared/prompts";
import { escapeHTML } from "../../../shared/security";
import { optionsDom } from "../../app/dom";
import { msg, t } from "../../app/i18n";
import { state } from "../../app/state";
import {
  buildBadgeMarkup,
  formatDateTime,
  getRequestedServices,
  getStatusInfo,
} from "../../app/helpers";
import { closeModal, openModal } from "../../core/modal";

const {
  historyModal,
  historyModalClose,
  historyModalMeta,
  historyModalServices,
  historyModalText,
} = optionsDom.modals;

export function buildResultComparisonMarkup(entry) {
  const requested = getRequestedServices(entry);
  const submitted = new Set(Array.isArray(entry.submittedSiteIds) ? entry.submittedSiteIds : (entry.sentTo ?? []));
  const failed = new Set(Array.isArray(entry.failedSiteIds) ? entry.failedSiteIds : []);
  const siteResults = entry.siteResults ?? {};

  if (requested.length === 0) {
    return "";
  }

  const siteRows = requested.map((siteId) => {
    const site = state.runtimeSites.find((siteEntry) => siteEntry.id === siteId);
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

export function openHistoryModal(historyId) {
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

  let comparisonEl = document.getElementById("history-modal-comparison");
  if (!comparisonEl) {
    comparisonEl = document.createElement("div");
    comparisonEl.id = "history-modal-comparison";
    historyModalText.parentElement?.appendChild(comparisonEl);
  }
  comparisonEl.innerHTML = buildResultComparisonMarkup(entry);

  openModal(historyModal, historyModalClose);
}

export function closeHistoryModal() {
  closeModal(historyModal);
}
