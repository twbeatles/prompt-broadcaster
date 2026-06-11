import { sendRuntimeMessageWithTimeout } from "../../../shared/chrome/messaging";
import {
  EXPERIMENT_HARD_BROADCAST_LIMIT,
  EXPERIMENT_SOFT_BROADCAST_LIMIT,
} from "../../../shared/prompts";
import type { PromptExperiment } from "../../../shared/types/models";
import { t } from "../../app/i18n";
import { state } from "../../app/state";
import { showAppToast } from "../../core/status";
import { buildDraftExperiment, loadExperimentDraft } from "./draft";
import { dom } from "./dom";
import { getExperimentRunStats } from "./preview";
import {
  renderExperimentsSection,
  renderExperimentTargets,
  renderPreview,
} from "./rendering";

export async function saveDraftExperiment(): Promise<PromptExperiment | null> {
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

export function confirmExperimentRun(experiment: PromptExperiment): boolean {
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

export async function runExperiment(experimentId: string): Promise<void> {
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

export function loadExperiment(experimentId: string): void {
  const experiment = state.promptExperiments.find((entry) => entry.id === experimentId);
  if (!experiment) {
    return;
  }

  loadExperimentDraft(experiment);
  renderExperimentTargets();
  const selected = new Set(experiment.targetSiteIds);
  dom.experimentTargets?.querySelectorAll<HTMLInputElement>("[data-experiment-target]").forEach((input) => {
    input.checked = selected.has(input.dataset.experimentTarget ?? "");
  });
  renderPreview();
}
