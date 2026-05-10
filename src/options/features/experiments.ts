// @ts-nocheck
import { sendRuntimeMessageWithTimeout } from "../../shared/chrome/messaging";
import { renderTemplatePrompt } from "../../shared/template";
import { escapeHTML } from "../../shared/security";
import { optionsDom } from "../app/dom";
import { state } from "../app/state";
import { showAppToast } from "../core/status";

const dom = optionsDom.experiments;

function parseVariantBlocks() {
  const raw = dom.experimentVariants?.value || "";
  return raw
    .split(/\n---+\n/g)
    .map((text, index) => ({
      id: `variant-${index + 1}`,
      title: `Variant ${index + 1}`,
      text: text.trim(),
    }))
    .filter((variant) => variant.text);
}

function parseVariableSets() {
  const raw = dom.experimentVariables?.value.trim();
  if (!raw) {
    return [{ id: "vars-1", title: "Default", values: {} }];
  }

  try {
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries.map((values, index) => ({
      id: `vars-${index + 1}`,
      title: `Variables ${index + 1}`,
      values: values && typeof values === "object" && !Array.isArray(values)
        ? Object.fromEntries(
            Object.entries(values).map(([key, value]) => [String(key), String(value ?? "")]),
          )
        : {},
    }));
  } catch (_error) {
    showAppToast("Variables JSON is invalid. Using an empty variable set.", "warning", 2600);
    return [{ id: "vars-1", title: "Default", values: {} }];
  }
}

function getSelectedTargetIds() {
  return [...dom.experimentTargets.querySelectorAll("[data-experiment-target]:checked")]
    .map((input) => input.dataset.experimentTarget)
    .filter(Boolean);
}

function buildDraftExperiment(existingId = null) {
  return {
    id: existingId || state.activeExperimentId || undefined,
    title: dom.experimentTitle?.value.trim() || `Experiment ${state.promptExperiments.length + 1}`,
    description: "",
    variants: parseVariantBlocks(),
    targetSiteIds: getSelectedTargetIds(),
    variableSets: parseVariableSets(),
  };
}

function buildPreviewItems(experiment) {
  return experiment.variants.flatMap((variant) =>
    experiment.variableSets.map((variableSet) => ({
      variant,
      variableSet,
      prompt: renderTemplatePrompt(variant.text, variableSet.values),
      targetSiteIds: experiment.targetSiteIds,
    })),
  );
}

function renderExperimentTargets() {
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

function renderPreview() {
  const experiment = buildDraftExperiment();
  const items = buildPreviewItems(experiment);
  dom.experimentPreviewOutput.innerHTML = items.length
    ? items.map((item, index) => `
      <article class="panel compact-panel">
        <strong>${escapeHTML(item.variant.title)} x ${escapeHTML(item.variableSet.title)}</strong>
        <div class="helper">${escapeHTML(item.targetSiteIds.join(", ") || "No target services")}</div>
        <pre class="modal-prompt">${escapeHTML(item.prompt)}</pre>
      </article>
    `).join("")
    : `<div class="empty-state">Add variants and target services to preview combinations.</div>`;
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
            <p>${experiment.variants.length} variants · ${experiment.variableSets.length} variable sets · ${experiment.targetSiteIds.length} services · ${experiment.runs.length} runs</p>
          </div>
          <div class="settings-actions">
            <button class="btn ghost" type="button" data-experiment-load="${escapeHTML(experiment.id)}">Load</button>
            <button class="btn primary" type="button" data-experiment-run="${escapeHTML(experiment.id)}">Run</button>
            <button class="btn danger ghost" type="button" data-experiment-delete="${escapeHTML(experiment.id)}">Delete</button>
          </div>
        </div>
      </article>
    `).join("")
    : `<div class="panel empty-state">No saved experiments yet.</div>`;
}

async function saveDraftExperiment() {
  const draft = buildDraftExperiment();
  if (!draft.variants.length || !draft.targetSiteIds.length) {
    showAppToast("Experiment needs at least one variant and one target service.", "warning", 2600);
    return null;
  }

  const response = await sendRuntimeMessageWithTimeout({
    action: "experiment:save",
    experiment: draft,
  }, 8000);
  if (!response?.ok || !response.experiment) {
    throw new Error(response?.error || "Experiment save failed.");
  }

  state.activeExperimentId = response.experiment.id;
  state.promptExperiments = [
    response.experiment,
    ...state.promptExperiments.filter((entry) => entry.id !== response.experiment.id),
  ];
  renderExperimentsSection();
  showAppToast("Experiment saved.", "success", 1600);
  return response.experiment;
}

async function runExperiment(experimentId) {
  const response = await sendRuntimeMessageWithTimeout({
    action: "experiment:run",
    experimentId,
  }, 30000);
  if (!response?.ok) {
    throw new Error(response?.error || "Experiment run failed.");
  }

  if (response.experiment) {
    state.promptExperiments = [
      response.experiment,
      ...state.promptExperiments.filter((entry) => entry.id !== response.experiment.id),
    ];
    renderExperimentsSection();
  }
  showAppToast(`Experiment queued: ${response.queuedCount} broadcasts.`, "success", 2600);
}

function loadExperiment(experimentId) {
  const experiment = state.promptExperiments.find((entry) => entry.id === experimentId);
  if (!experiment) {
    return;
  }

  state.activeExperimentId = experiment.id;
  dom.experimentTitle.value = experiment.title;
  dom.experimentVariants.value = experiment.variants.map((variant) => variant.text).join("\n---\n");
  dom.experimentVariables.value = JSON.stringify(
    experiment.variableSets.map((set) => set.values),
    null,
    2,
  );
  renderExperimentTargets();
  const selected = new Set(experiment.targetSiteIds);
  dom.experimentTargets.querySelectorAll("[data-experiment-target]").forEach((input) => {
    input.checked = selected.has(input.dataset.experimentTarget);
  });
  renderPreview();
}

export function bindExperimentEvents() {
  dom.experimentPreview?.addEventListener("click", renderPreview);
  dom.experimentSave?.addEventListener("click", () => {
    void saveDraftExperiment().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save experiment.", error);
      showAppToast(error?.message || "Experiment save failed.", "error", 3000);
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
      showAppToast(error?.message || "Experiment run failed.", "error", 3000);
    });
  });
  dom.experimentList?.addEventListener("click", (event) => {
    const loadButton = event.target.closest("[data-experiment-load]");
    const runButton = event.target.closest("[data-experiment-run]");
    const deleteButton = event.target.closest("[data-experiment-delete]");

    if (loadButton) {
      loadExperiment(loadButton.dataset.experimentLoad);
      return;
    }

    if (runButton) {
      void runExperiment(runButton.dataset.experimentRun).catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to run experiment.", error);
        showAppToast(error?.message || "Experiment run failed.", "error", 3000);
      });
      return;
    }

    if (deleteButton) {
      void sendRuntimeMessageWithTimeout({
        action: "experiment:delete",
        experimentId: deleteButton.dataset.experimentDelete,
      }, 8000).then((response) => {
        state.promptExperiments = response?.experiments ?? state.promptExperiments;
        renderExperimentsSection();
        showAppToast("Experiment deleted.", "success", 1600);
      });
    }
  });
}
