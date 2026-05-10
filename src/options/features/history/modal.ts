// @ts-nocheck
import { getComparisonNotes, normalizeResultCode } from "../../../shared/prompts";
import { sendRuntimeMessageWithTimeout } from "../../../shared/chrome/messaging";
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
import { showAppToast } from "../../core/status";

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

function buildCompareWorkspaceMarkup(entry) {
  const requested = getRequestedServices(entry);
  const notes = state.comparisonNotes.filter((note) => Number(note.historyId) === Number(entry.id));
  const serviceOptions = requested.map((siteId) => {
    const site = state.runtimeSites.find((siteEntry) => siteEntry.id === siteId);
    return `<option value="${escapeHTML(siteId)}">${escapeHTML(site?.name || siteId)}</option>`;
  }).join("");
  const notesMarkup = notes.length
    ? notes.map((note) => {
      const site = state.runtimeSites.find((siteEntry) => siteEntry.id === note.serviceId);
      return `
        <article class="compare-note">
          <div class="section-head-row">
            <div>
              <strong>${escapeHTML(site?.name || note.serviceId)}</strong>
              <div class="helper">${escapeHTML(note.captureMode)} · ${escapeHTML(formatDateTime(note.updatedAt))}${note.rating ? ` · ${note.rating}/5` : ""}</div>
            </div>
            <button class="btn danger ghost" type="button" data-comparison-delete="${escapeHTML(note.id)}">Delete</button>
          </div>
          <pre class="modal-prompt">${escapeHTML(note.responseText)}</pre>
        </article>
      `;
    }).join("")
    : `<div class="empty-state">No saved comparison notes yet.</div>`;

  return `
    <div class="compare-workspace" data-compare-history-id="${escapeHTML(String(entry.id))}">
      <h3 class="result-comparison-title">Compare</h3>
      <div class="filter-row">
        <select data-comparison-service>${serviceOptions}</select>
        <input data-comparison-rating type="number" min="1" max="5" placeholder="Rating" />
      </div>
      <textarea data-comparison-text rows="5" placeholder="Paste an AI response here, or select response text on a service tab and use the context menu."></textarea>
      <div class="settings-actions">
        <button class="btn" type="button" data-comparison-save>Save note</button>
        <button class="btn ghost" type="button" data-comparison-capture-start>Capture start</button>
        <button class="btn ghost" type="button" data-comparison-capture-stop>Stop capture</button>
      </div>
      <div class="settings-stack">${notesMarkup}</div>
    </div>
  `;
}

async function refreshComparisonNotes(historyId) {
  state.comparisonNotes = await getComparisonNotes();
  const entry = state.history.find((item) => Number(item.id) === Number(historyId));
  const comparisonEl = document.getElementById("history-modal-comparison");
  if (entry && comparisonEl) {
    comparisonEl.innerHTML = `${buildResultComparisonMarkup(entry)}${buildCompareWorkspaceMarkup(entry)}`;
    bindCompareWorkspaceEvents(comparisonEl, entry);
  }
}

function bindCompareWorkspaceEvents(comparisonEl, entry) {
  comparisonEl.onclick = (event) => {
    const workspace = event.target.closest("[data-compare-history-id]");
    if (!workspace) {
      return;
    }

    const serviceId = workspace.querySelector("[data-comparison-service]")?.value || entry.requestedSiteIds?.[0] || "";
    const responseText = workspace.querySelector("[data-comparison-text]")?.value || "";
    const ratingValue = Number(workspace.querySelector("[data-comparison-rating]")?.value);

    if (event.target.closest("[data-comparison-save]")) {
      void sendRuntimeMessageWithTimeout({
        action: "comparison-note:save",
        note: {
          historyId: entry.id,
          serviceId,
          responseText,
          captureMode: "manual",
          rating: Number.isFinite(ratingValue) ? ratingValue : null,
          tags: [],
        },
      }, 8000).then(async (response) => {
        if (!response?.ok) {
          throw new Error(response?.error || "Comparison note save failed.");
        }
        showAppToast("Comparison note saved.", "success", 1600);
        await refreshComparisonNotes(entry.id);
      }).catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to save comparison note.", error);
        showAppToast(error?.message || "Comparison note save failed.", "error", 3000);
      });
      return;
    }

    if (event.target.closest("[data-comparison-capture-start]")) {
      void sendRuntimeMessageWithTimeout({
        action: "comparison-capture:start",
        historyId: entry.id,
        serviceId,
      }, 10000).then(async (response) => {
        if (!response?.ok) {
          throw new Error(response?.error || "Capture start failed.");
        }
        showAppToast(response.captured ? "Response captured." : (response.message || "Capture armed."), response.captured ? "success" : "info", 2600);
        await refreshComparisonNotes(entry.id);
      }).catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to start comparison capture.", error);
        showAppToast(error?.message || "Capture failed.", "error", 3000);
      });
      return;
    }

    if (event.target.closest("[data-comparison-capture-stop]")) {
      void sendRuntimeMessageWithTimeout({
        action: "comparison-capture:stop",
        historyId: entry.id,
        serviceId,
      }, 5000).then(() => showAppToast("Capture stopped.", "success", 1200));
      return;
    }

    const deleteButton = event.target.closest("[data-comparison-delete]");
    if (deleteButton) {
      void sendRuntimeMessageWithTimeout({
        action: "comparison-note:delete",
        noteId: deleteButton.dataset.comparisonDelete,
      }, 8000).then(async (response) => {
        state.comparisonNotes = response?.notes ?? state.comparisonNotes;
        showAppToast("Comparison note deleted.", "success", 1400);
        await refreshComparisonNotes(entry.id);
      });
    }
  };
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
  comparisonEl.innerHTML = `${buildResultComparisonMarkup(entry)}${buildCompareWorkspaceMarkup(entry)}`;
  bindCompareWorkspaceEvents(comparisonEl, entry);

  openModal(historyModal, historyModalClose);
}

export function closeHistoryModal() {
  closeModal(historyModal);
}
