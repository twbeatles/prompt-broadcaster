import { escapeHTML } from "../../../shared/security";
import { t } from "../../app/i18n";
import { state } from "../../app/state";
import { buildDraftExperiment, getSelectedTargetIds } from "./draft";
import { dom } from "./dom";
import {
  buildPreviewItems,
  buildRunLimitMarkup,
  getExperimentRunStats,
} from "./preview";
import type { ExperimentPreviewItem } from "./types";

export function renderExperimentTargets(): void {
  if (!dom.experimentTargets) {
    return;
  }

  const checked = new Set(getSelectedTargetIds());
  if (checked.size === 0) {
    state.runtimeSites.slice(0, 3).forEach((site) => checked.add(site.id));
  }

  dom.experimentTargets.innerHTML = state.runtimeSites.map((site) => `
    <label class="checkbox-inline">
      <input type="checkbox" data-experiment-target="${escapeHTML(site.id)}" ${checked.has(site.id) ? "checked" : ""} />
      <span>${escapeHTML(site.name)}</span>
    </label>
  `).join("");
}

export function renderPreview(): void {
  const experiment = buildDraftExperiment();
  const items = buildPreviewItems(experiment);
  if (!dom.experimentPreviewOutput) {
    return;
  }

  dom.experimentPreviewOutput.innerHTML = items.length
    ? items.map((item: ExperimentPreviewItem) => `
      <article class="panel compact-panel">
        <strong>${escapeHTML(item.variant.title)} x ${escapeHTML(item.variableSet.title)}</strong>
        <div class="helper">${escapeHTML(item.targetSiteIds.join(", ") || t.experiments.noTargetServices)}</div>
        <pre class="modal-prompt">${escapeHTML(item.prompt)}</pre>
      </article>
    `).join("")
    : `<div class="empty-state">${escapeHTML(t.experiments.previewEmpty)}</div>`;
  if (items.length) {
    dom.experimentPreviewOutput.insertAdjacentHTML("afterbegin", buildRunLimitMarkup(experiment));
  }
}

export function renderExperimentsSection(): void {
  if (!dom.experimentList) {
    return;
  }

  renderExperimentTargets();
  dom.experimentList.innerHTML = state.promptExperiments.length
    ? state.promptExperiments.map((experiment) => `
      <article class="panel compact-panel">
        <div class="section-head-row">
          <div>
            <h2>${escapeHTML(experiment.title)}</h2>
            <p>${escapeHTML(t.experiments.summary(
              experiment.variants.length,
              experiment.variableSets.length,
              experiment.targetSiteIds.length,
              experiment.runs.length,
              getExperimentRunStats(experiment).broadcastCount,
            ))}</p>
          </div>
          <div class="settings-actions">
            <button class="btn ghost" type="button" data-experiment-load="${escapeHTML(experiment.id)}">${escapeHTML(t.experiments.load)}</button>
            <button class="btn primary" type="button" data-experiment-run="${escapeHTML(experiment.id)}">${escapeHTML(t.experiments.run)}</button>
            <button class="btn danger ghost" type="button" data-experiment-delete="${escapeHTML(experiment.id)}">${escapeHTML(t.experiments.delete)}</button>
          </div>
        </div>
      </article>
    `).join("")
    : `<div class="panel empty-state">${escapeHTML(t.experiments.empty)}</div>`;
}
