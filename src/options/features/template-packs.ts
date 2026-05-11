import { sendRuntimeMessageWithTimeout } from "../../shared/chrome/messaging";
import { escapeHTML } from "../../shared/security";
import type { TemplatePack } from "../../shared/types/models";
import { optionsDom } from "../app/dom";
import { t } from "../app/i18n";
import { state } from "../app/state";
import { showAppToast } from "../core/status";

const dom = optionsDom.settings;

function downloadJson(filename: string, payload: unknown): void {
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
          <div class="helper">${pack.templates.length} templates · defaults ${pack.includeSensitiveDefaults ? escapeHTML(t.settings.templatePackDefaultsIncluded) : escapeHTML(t.settings.templatePackDefaultsRemoved)}</div>
        </div>
        <div class="settings-actions">
          <button class="btn ghost" type="button" data-pack-download="${escapeHTML(pack.id)}">${escapeHTML(t.settings.templatePackDownload)}</button>
        </div>
      </article>
    `).join("")
    : `<div class="empty-state">${escapeHTML(t.settings.templatePackEmpty)}</div>`;
}

async function exportTemplatePack() {
  const includeSensitiveDefaults =
    !(dom.templatePackSensitive instanceof HTMLInputElement) ||
    dom.templatePackSensitive.checked !== false;
  const response = await sendRuntimeMessageWithTimeout<"template-pack:export">({
    action: "template-pack:export",
    includeSensitiveDefaults,
  }, 10000);
  if (!response?.ok || !response.pack) {
    throw new Error(response?.error || t.settings.templatePackExportFailed);
  }

  const { pack } = response;
  state.templatePacks = [
    pack,
    ...state.templatePacks.filter((entry) => entry.id !== pack.id),
  ];
  renderTemplatePacksSection();
  downloadJson(`${pack.title.replace(/[\\/:*?"<>|]+/g, "-")}.json`, pack);
  showAppToast(t.settings.templatePackExported, "success", 1800);
}

async function importTemplatePack(file: File): Promise<void> {
  const text = await file.text();
  const pack = JSON.parse(text) as Partial<TemplatePack>;
  const response = await sendRuntimeMessageWithTimeout<"template-pack:import">({
    action: "template-pack:import",
    pack,
  }, 10000);
  if (!response?.ok || !response.pack) {
    throw new Error(response?.error || t.settings.templatePackImportFailed);
  }

  const { pack: importedPack } = response;
  state.templatePacks = [
    importedPack,
    ...state.templatePacks.filter((entry) => entry.id !== importedPack.id),
  ];
  renderTemplatePacksSection();
  showAppToast(
    t.settings.templatePackImported(
      response.importedFavoriteIds?.length ?? 0,
      response.skippedFavoriteIds?.length ?? 0,
    ),
    "success",
    2600,
  );
}

export function bindTemplatePackEvents() {
  dom.templatePackExport?.addEventListener("click", () => {
    void exportTemplatePack().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to export template pack.", error);
      showAppToast(error?.message || t.settings.templatePackExportFailed, "error", 3000);
    });
  });

  dom.templatePackImport?.addEventListener("click", () => {
    dom.templatePackImportInput?.click();
  });

  dom.templatePackImportInput?.addEventListener("change", (event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const [file] = Array.from(input?.files ?? []);
    if (!file) {
      return;
    }

    void importTemplatePack(file).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to import template pack.", error);
      showAppToast(error?.message || t.settings.templatePackImportFailed, "error", 3000);
    }).finally(() => {
      if (input) {
        input.value = "";
      }
    });
  });

  dom.templatePackList?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest<HTMLElement>("[data-pack-download]");
    if (!button) {
      return;
    }

    const pack = state.templatePacks.find((entry) => entry.id === button.dataset.packDownload);
    if (pack) {
      downloadJson(`${pack.title.replace(/[\\/:*?"<>|]+/g, "-")}.json`, pack);
    }
  });
}
