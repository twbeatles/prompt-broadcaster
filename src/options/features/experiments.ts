import { sendRuntimeMessageWithTimeout } from "../../shared/chrome/messaging";
import {
  EXPERIMENT_HARD_BROADCAST_LIMIT,
  EXPERIMENT_SOFT_BROADCAST_LIMIT,
  getPromptExperimentRunStats,
} from "../../shared/prompts";
import { renderTemplatePrompt } from "../../shared/template";
import { escapeHTML } from "../../shared/security";
import type {
  PromptExperiment,
  PromptExperimentVariableSet,
  PromptExperimentVariant,
} from "../../shared/types/models";
import { optionsDom } from "../app/dom";
import { t } from "../app/i18n";
import { state } from "../app/state";
import { showAppToast } from "../core/status";

interface ExperimentDom {
  experimentTitle: HTMLInputElement | null;
  experimentVariants: HTMLTextAreaElement | null;
  experimentVariables: HTMLTextAreaElement | null;
  experimentTargets: HTMLElement | null;
  experimentPreview: HTMLElement | null;
  experimentSave: HTMLElement | null;
  experimentRun: HTMLElement | null;
  experimentPreviewOutput: HTMLElement | null;
  experimentList: HTMLElement | null;
}

type PromptExperimentDraft = Partial<PromptExperiment> &
  Pick<PromptExperiment, "title" | "description" | "variants" | "targetSiteIds" | "variableSets">;

interface ExperimentPreviewItem {
  variant: PromptExperimentVariant;
  variableSet: PromptExperimentVariableSet;
  prompt: string;
  targetSiteIds: string[];
}

const dom = optionsDom.experiments as ExperimentDom;

function parseVariantBlocks(): PromptExperimentVariant[] {
  const raw = dom.experimentVariants?.value || "";
  return raw
    .split(/\n---+\n/g)
    .map((text: string, index: number) => ({
      id: `variant-${index + 1}`,
      title: `Variant ${index + 1}`,
      text: text.trim(),
    }))
    .filter((variant) => variant.text);
}

function parseVariableSets(): PromptExperimentVariableSet[] {
  const raw = dom.experimentVariables?.value.trim();
  if (!raw) {
    return [{ id: "vars-1", title: "Default", values: {} }];
  }

  try {
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries.map((values: unknown, index: number) => ({
      id: `vars-${index + 1}`,
      title: `Variables ${index + 1}`,
      values: values && typeof values === "object" && !Array.isArray(values)
        ? Object.fromEntries(
            Object.entries(values).map(([key, value]) => [String(key), String(value ?? "")]),
          )
        : {},
    }));
  } catch (_error) {
    showAppToast(t.experiments.invalidVariables, "warning", 2600);
    return [{ id: "vars-1", title: "Default", values: {} }];
  }
}

function getSelectedTargetIds(): string[] {
  return Array.from(
    dom.experimentTargets?.querySelectorAll<HTMLInputElement>("[data-experiment-target]:checked") ?? [],
  )
    .map((input) => input.dataset.experimentTarget ?? "")
    .filter(Boolean);
}

function buildDraftExperiment(existingId: string | null = null): PromptExperimentDraft {
  return {
    id: existingId || state.activeExperimentId || undefined,
    title: dom.experimentTitle?.value.trim() || `Experiment ${state.promptExperiments.length + 1}`,
    description: "",
    variants: parseVariantBlocks(),
    targetSiteIds: getSelectedTargetIds(),
    variableSets: parseVariableSets(),
  };
}

function buildPreviewItems(experiment: PromptExperimentDraft | PromptExperiment): ExperimentPreviewItem[] {
  return experiment.variants.flatMap((variant) =>
    experiment.variableSets.map((variableSet) => ({
      variant,
      variableSet,
      prompt: renderTemplatePrompt(variant.text, variableSet.values),
      targetSiteIds: experiment.targetSiteIds,
    })),
  );
}

function getExperimentRunStats(experiment: PromptExperimentDraft | PromptExperiment): {
  broadcastCount: number;
  serviceSendCount: number;
} {
  return getPromptExperimentRunStats(experiment);
}

function buildRunLimitMarkup(experiment: PromptExperimentDraft | PromptExperiment): string {
  const stats = getExperimentRunStats(experiment);
  const tone = stats.broadcastCount > EXPERIMENT_HARD_BROADCAST_LIMIT
    ? "error"
    : stats.broadcastCount > EXPERIMENT_SOFT_BROADCAST_LIMIT
      ? "warning"
      : "info";
  const label = t.experiments.runStats(
    stats.broadcastCount,
    stats.serviceSendCount,
    EXPERIMENT_SOFT_BROADCAST_LIMIT,
    EXPERIMENT_HARD_BROADCAST_LIMIT,
  );

  return `<div class="helper experiment-run-limit ${tone}">${escapeHTML(label)}</div>`;
}

function renderExperimentTargets(): void {
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

function renderPreview(): void {
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

export function renderExperimentsSection() {
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

async function saveDraftExperiment(): Promise<PromptExperiment | null> {
  const draft = buildDraftExperiment();
  if (!draft.variants.length || !draft.targetSiteIds.length) {
    showAppToast(t.experiments.needsVariantAndTarget, "warning", 2600);
    return null;
  }

  const response = await sendRuntimeMessageWithTimeout<"experiment:save">({
    action: "experiment:save",
    experiment: draft,
  }, 8000);
  if (!response?.ok || !response.experiment) {
    throw new Error(response?.error || t.experiments.saveFailed);
  }

  const { experiment } = response;
  state.activeExperimentId = experiment.id;
  state.promptExperiments = [
    experiment,
    ...state.promptExperiments.filter((entry) => entry.id !== experiment.id),
  ];
  renderExperimentsSection();
  showAppToast(t.experiments.saveSuccess, "success", 1600);
  return experiment;
}

function confirmExperimentRun(experiment: PromptExperiment): boolean {
  const stats = getExperimentRunStats(experiment);
  if (stats.broadcastCount > EXPERIMENT_HARD_BROADCAST_LIMIT) {
    showAppToast(
      t.experiments.hardLimit(stats.broadcastCount, EXPERIMENT_HARD_BROADCAST_LIMIT),
      "warning",
      4200,
    );
    return false;
  }

  if (stats.broadcastCount > EXPERIMENT_SOFT_BROADCAST_LIMIT) {
    return window.confirm(
      t.experiments.confirmLarge(
        stats.broadcastCount,
        stats.serviceSendCount,
        EXPERIMENT_SOFT_BROADCAST_LIMIT,
      ),
    );
  }

  return true;
}

async function runExperiment(experimentId: string): Promise<void> {
  const experiment = state.promptExperiments.find((entry) => entry.id === experimentId);
  if (!experiment) {
    throw new Error(t.experiments.notFound);
  }

  const confirmedLargeRun = confirmExperimentRun(experiment);
  if (!confirmedLargeRun) {
    return;
  }

  const response = await sendRuntimeMessageWithTimeout<"experiment:run">({
    action: "experiment:run",
    experimentId,
    confirmedLargeRun,
  }, 30000);
  if (!response?.ok) {
    throw new Error(response?.error || t.experiments.runFailed);
  }

  if (response.experiment) {
    const updatedExperiment = response.experiment;
    state.promptExperiments = [
      updatedExperiment,
      ...state.promptExperiments.filter((entry) => entry.id !== updatedExperiment.id),
    ];
    renderExperimentsSection();
  }
  showAppToast(t.experiments.queued(response.queuedCount), "success", 2600);
}

function loadExperiment(experimentId: string): void {
  const experiment = state.promptExperiments.find((entry) => entry.id === experimentId);
  if (!experiment) {
    return;
  }

  state.activeExperimentId = experiment.id;
  if (dom.experimentTitle) {
    dom.experimentTitle.value = experiment.title;
  }
  if (dom.experimentVariants) {
    dom.experimentVariants.value = experiment.variants.map((variant) => variant.text).join("\n---\n");
  }
  if (dom.experimentVariables) {
    dom.experimentVariables.value = JSON.stringify(
    experiment.variableSets.map((set) => set.values),
    null,
    2,
  );
  }
  renderExperimentTargets();
  const selected = new Set(experiment.targetSiteIds);
  dom.experimentTargets?.querySelectorAll<HTMLInputElement>("[data-experiment-target]").forEach((input) => {
    input.checked = selected.has(input.dataset.experimentTarget ?? "");
  });
  renderPreview();
}

export function bindExperimentEvents() {
  dom.experimentPreview?.addEventListener("click", renderPreview);
  dom.experimentSave?.addEventListener("click", () => {
    void saveDraftExperiment().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save experiment.", error);
      showAppToast(error?.message || t.experiments.saveFailed, "error", 3000);
    });
  });
  dom.experimentRun?.addEventListener("click", () => {
    void (async () => {
      const experiment = await saveDraftExperiment();
      if (experiment) {
        await runExperiment(experiment.id);
      }
    })().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to run experiment.", error);
      showAppToast(error?.message || t.experiments.runFailed, "error", 3000);
    });
  });
  dom.experimentList?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const loadButton = target?.closest<HTMLElement>("[data-experiment-load]");
    const runButton = target?.closest<HTMLElement>("[data-experiment-run]");
    const deleteButton = target?.closest<HTMLElement>("[data-experiment-delete]");

    if (loadButton) {
      loadExperiment(loadButton.dataset.experimentLoad ?? "");
      return;
    }

    if (runButton) {
      void runExperiment(runButton.dataset.experimentRun ?? "").catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to run experiment.", error);
        showAppToast(error?.message || t.experiments.runFailed, "error", 3000);
      });
      return;
    }

    if (deleteButton) {
      void sendRuntimeMessageWithTimeout<"experiment:delete">({
        action: "experiment:delete",
        experimentId: deleteButton.dataset.experimentDelete ?? "",
      }, 8000).then((response) => {
        state.promptExperiments = response?.experiments ?? state.promptExperiments;
        renderExperimentsSection();
        showAppToast(t.experiments.deleteSuccess, "success", 1600);
      });
    }
  });
}
