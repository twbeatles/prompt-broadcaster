// @ts-nocheck
import { sendRuntimeMessageWithTimeout } from "../../shared/chrome/messaging";
import { escapeHTML } from "../../shared/security";
import { optionsDom } from "../app/dom";
import { state } from "../app/state";
import { showAppToast } from "../core/status";

const dom = optionsDom.settings;

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function renderTemplatePacksSection() {
  if (!dom.templatePackList) {
    return;
  }

  dom.templatePackList.innerHTML = state.templatePacks.length
    ? state.templatePacks.map((pack) => `
      <article class="service-health-row">
        <div>
          <strong>${escapeHTML(pack.title)}</strong>
          <div class="helper">${pack.templates.length} templates · defaults ${pack.includeSensitiveDefaults ? "included" : "removed"}</div>
        </div>
        <div class="settings-actions">
          <button class="btn ghost" type="button" data-pack-download="${escapeHTML(pack.id)}">Download</button>
        </div>
      </article>
    `).join("")
    : `<div class="empty-state">No template packs yet.</div>`;
}

async function exportTemplatePack() {
  const response = await sendRuntimeMessageWithTimeout({
    action: "template-pack:export",
    includeSensitiveDefaults: dom.templatePackSensitive?.checked !== false,
  }, 10000);
  if (!response?.ok || !response.pack) {
    throw new Error(response?.error || "Template pack export failed.");
  }

  state.templatePacks = [
    response.pack,
    ...state.templatePacks.filter((pack) => pack.id !== response.pack.id),
  ];
  renderTemplatePacksSection();
  downloadJson(`${response.pack.title.replace(/[\\/:*?"<>|]+/g, "-")}.json`, response.pack);
  showAppToast("Template pack exported.", "success", 1800);
}

async function importTemplatePack(file) {
  const text = await file.text();
  const pack = JSON.parse(text);
  const response = await sendRuntimeMessageWithTimeout({
    action: "template-pack:import",
    pack,
  }, 10000);
  if (!response?.ok || !response.pack) {
    throw new Error(response?.error || "Template pack import failed.");
  }

  state.templatePacks = [
    response.pack,
    ...state.templatePacks.filter((entry) => entry.id !== response.pack.id),
  ];
  renderTemplatePacksSection();
  showAppToast(
    `Imported ${response.importedFavoriteIds?.length ?? 0}, skipped ${response.skippedFavoriteIds?.length ?? 0} duplicates.`,
    "success",
    2600,
  );
}

export function bindTemplatePackEvents() {
  dom.templatePackExport?.addEventListener("click", () => {
    void exportTemplatePack().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to export template pack.", error);
      showAppToast(error?.message || "Template pack export failed.", "error", 3000);
    });
  });

  dom.templatePackImport?.addEventListener("click", () => {
    dom.templatePackImportInput?.click();
  });

  dom.templatePackImportInput?.addEventListener("change", (event) => {
    const [file] = [...(event.target.files ?? [])];
    if (!file) {
      return;
    }

    void importTemplatePack(file).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to import template pack.", error);
      showAppToast(error?.message || "Template pack import failed.", "error", 3000);
    }).finally(() => {
      event.target.value = "";
    });
  });

  dom.templatePackList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-pack-download]");
    if (!button) {
      return;
    }

    const pack = state.templatePacks.find((entry) => entry.id === button.dataset.packDownload);
    if (pack) {
      downloadJson(`${pack.title.replace(/[\\/:*?"<>|]+/g, "-")}.json`, pack);
    }
  });
}
