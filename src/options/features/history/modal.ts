import { getComparisonNotes, normalizeResultCode } from "../../../shared/prompts";
import { sendRuntimeMessageWithTimeout } from "../../../shared/chrome/messaging";
import { setActiveComparisonContext } from "../../../shared/runtime-state";
import { escapeHTML } from "../../../shared/security";
import type { PromptHistoryItem } from "../../../shared/types/models";
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
} = optionsDom.modals as {
  historyModal: HTMLElement | null;
  historyModalClose: HTMLElement | null;
  historyModalMeta: HTMLElement | null;
  historyModalServices: HTMLElement | null;
  historyModalText: HTMLElement | null;
};

export function buildResultComparisonMarkup(entry: PromptHistoryItem): string {
  const requested = getRequestedServices(entry);
  const submitted = new Set(Array.isArray(entry.submittedSiteIds) ? entry.submittedSiteIds : (entry.sentTo ?? []));
  const failed = new Set(Array.isArray(entry.failedSiteIds) ? entry.failedSiteIds : []);
  const siteResults = entry.siteResults ?? {};

  if (requested.length === 0) {
    return "";
  }

  const siteRows = requested.map((siteId: string) => {
    const site = state.runtimeSites.find((siteEntry) => siteEntry.id === siteId);
    const name = site?.name ?? siteId;
    const color = site?.color ?? "#888";
    const icon = site?.icon ?? siteId.slice(0, 2).toUpperCase();
    const result = siteResults[siteId];
    const rawStatus = result?.code
      ? normalizeResultCode(result.code)
      : submitted.has(siteId)
        ? "submitted"
        : failed.has(siteId)
          ? "unexpected_error"
          : "unknown";
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

function buildCompareWorkspaceMarkup(entry: PromptHistoryItem): string {
  const requested = getRequestedServices(entry);
  const notes = state.comparisonNotes.filter((note) => Number(note.historyId) === Number(entry.id));
  const serviceOptions = requested.map((siteId: string) => {
    const site = state.runtimeSites.find((siteEntry) => siteEntry.id === siteId);
    return `<option value="${escapeHTML(siteId)}">${escapeHTML(site?.name || siteId)}</option>`;
  }).join("");
  const notesMarkup = notes.length
    ? notes.map((note, index) => {
      const site = state.runtimeSites.find((siteEntry) => siteEntry.id === note.serviceId);
      const preview = note.responseText.length > 500
        ? `${note.responseText.slice(0, 500).trim()}...`
        : note.responseText;
      return `
        <details class="compare-note" ${index === 0 ? "open" : ""}>
          <summary>
            <span class="compare-note-title">${escapeHTML(site?.name || note.serviceId)}</span>
            <span class="helper">${escapeHTML(note.captureMode)} | ${escapeHTML(formatDateTime(note.updatedAt))}</span>
            <span class="compare-note-preview">${escapeHTML(preview)}</span>
          </summary>
          <pre class="modal-prompt">${escapeHTML(note.responseText)}</pre>
          <div class="settings-actions">
            <button class="btn danger ghost" type="button" data-comparison-delete="${escapeHTML(note.id)}">${escapeHTML(t.comparison.delete)}</button>
          </div>
        </details>
      `;
    }).join("")
    : `<div class="empty-state">${escapeHTML(t.comparison.empty)}</div>`;

  return `
    <div class="compare-workspace" data-compare-history-id="${escapeHTML(String(entry.id))}">
      <h3 class="result-comparison-title">${escapeHTML(t.comparison.title)}</h3>
      <div class="filter-row">
        <select data-comparison-service>${serviceOptions}</select>
      </div>
      <textarea data-comparison-text rows="5" placeholder="${escapeHTML(t.comparison.textPlaceholder)}"></textarea>
      <div class="settings-actions">
        <button class="btn" type="button" data-comparison-save>${escapeHTML(t.comparison.saveNote)}</button>
        <button class="btn ghost" type="button" data-comparison-capture-start>${escapeHTML(t.comparison.captureNow)}</button>
      </div>
      <div class="settings-stack">${notesMarkup}</div>
    </div>
  `;
}

async function refreshComparisonNotes(historyId: number | string): Promise<void> {
  state.comparisonNotes = await getComparisonNotes();
  const entry = state.history.find((item) => Number(item.id) === Number(historyId));
  const comparisonEl = document.getElementById("history-modal-comparison");
  if (entry && comparisonEl) {
    comparisonEl.innerHTML = `${buildResultComparisonMarkup(entry)}${buildCompareWorkspaceMarkup(entry)}`;
    bindCompareWorkspaceEvents(comparisonEl, entry);
  }
}

function bindCompareWorkspaceEvents(comparisonEl: HTMLElement, entry: PromptHistoryItem): void {
  comparisonEl.onclick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    const workspace = target?.closest<HTMLElement>("[data-compare-history-id]");
    if (!workspace) {
      return;
    }

    const serviceId =
      workspace.querySelector<HTMLSelectElement>("[data-comparison-service]")?.value ||
      entry.requestedSiteIds?.[0] ||
      "";
    const responseText = workspace.querySelector<HTMLTextAreaElement>("[data-comparison-text]")?.value || "";

    if (target?.closest("[data-comparison-service]")) {
      void setActiveComparisonContext({
        historyId: Number(entry.id),
        serviceId,
      });
      return;
    }

    if (target?.closest("[data-comparison-save]")) {
      void sendRuntimeMessageWithTimeout<"comparison-note:save">({
        action: "comparison-note:save",
        note: {
          historyId: entry.id,
          serviceId,
          responseText,
          captureMode: "manual",
          rating: null,
          tags: [],
        },
      }, 8000).then(async (response) => {
        if (!response?.ok) {
          throw new Error(response?.error || t.comparison.saveFailed);
        }
        showAppToast(t.comparison.saveSuccess, "success", 1600);
        await refreshComparisonNotes(entry.id);
      }).catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to save comparison note.", error);
        showAppToast(error?.message || t.comparison.saveFailed, "error", 3000);
      });
      return;
    }

    if (target?.closest("[data-comparison-capture-start]")) {
      void setActiveComparisonContext({
        historyId: Number(entry.id),
        serviceId,
      });
      void sendRuntimeMessageWithTimeout<"comparison-capture:start">({
        action: "comparison-capture:start",
        historyId: entry.id,
        serviceId,
      }, 10000).then(async (response) => {
        if (!response?.ok) {
          throw new Error(response?.error || t.comparison.captureFailed);
        }
        showAppToast(
          response.captured ? t.comparison.captureSuccess : (response.message || t.comparison.captureNotFound),
          response.captured ? "success" : "info",
          2600,
        );
        await refreshComparisonNotes(entry.id);
      }).catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to start comparison capture.", error);
        showAppToast(error?.message || t.comparison.captureFailed, "error", 3000);
      });
      return;
    }

    const deleteButton = target?.closest<HTMLElement>("[data-comparison-delete]");
    if (deleteButton) {
      void sendRuntimeMessageWithTimeout<"comparison-note:delete">({
        action: "comparison-note:delete",
        noteId: deleteButton.dataset.comparisonDelete ?? "",
      }, 8000).then(async (response) => {
        state.comparisonNotes = response?.notes ?? state.comparisonNotes;
        showAppToast(t.comparison.deleteSuccess, "success", 1400);
        await refreshComparisonNotes(entry.id);
      });
    }
  };

  comparisonEl.onchange = (event: Event) => {
    const target = event.target instanceof Element ? event.target : null;
    const workspace = target?.closest<HTMLElement>("[data-compare-history-id]");
    if (!workspace || !target?.closest("[data-comparison-service]")) {
      return;
    }

    const serviceId =
      workspace.querySelector<HTMLSelectElement>("[data-comparison-service]")?.value ||
      entry.requestedSiteIds?.[0] ||
      "";
    void setActiveComparisonContext({
      historyId: Number(entry.id),
      serviceId,
    });
  };
}

export function openHistoryModal(historyId: number | string): void {
  const entry = state.history.find((item) => Number(item.id) === Number(historyId));
  if (!entry) {
    return;
  }

  const status = getStatusInfo(entry.status);
  if (!historyModal || !historyModalClose || !historyModalMeta || !historyModalServices || !historyModalText) {
    return;
  }

  historyModalMeta.textContent = `${formatDateTime(entry.createdAt)} · ${status.label}`;
  historyModalServices.innerHTML = getRequestedServices(entry)
    .map((siteId: string) => buildBadgeMarkup(siteId, state.runtimeSites))
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
  const defaultServiceId = getRequestedServices(entry)[0] || "";
  if (defaultServiceId) {
    void setActiveComparisonContext({
      historyId: Number(entry.id),
      serviceId: defaultServiceId,
    });
  }

  openModal(historyModal, historyModalClose);
}

export function closeHistoryModal(): void {
  void setActiveComparisonContext(null);
  if (historyModal) {
    closeModal(historyModal);
  }
}
