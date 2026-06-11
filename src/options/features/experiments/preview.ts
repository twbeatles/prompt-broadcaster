import {
  EXPERIMENT_HARD_BROADCAST_LIMIT,
  EXPERIMENT_SOFT_BROADCAST_LIMIT,
  getPromptExperimentRunStats,
} from "../../../shared/prompts";
import { escapeHTML } from "../../../shared/security";
import { renderTemplatePrompt } from "../../../shared/template";
import type { PromptExperiment } from "../../../shared/types/models";
import { t } from "../../app/i18n";
import type { ExperimentPreviewItem, PromptExperimentDraft } from "./types";

export function buildPreviewItems(experiment: PromptExperimentDraft | PromptExperiment): ExperimentPreviewItem[] {
  return experiment.variants.flatMap((variant) =>
    experiment.variableSets.map((variableSet) => ({
      variant,
      variableSet,
      prompt: renderTemplatePrompt(variant.text, variableSet.values),
      targetSiteIds: experiment.targetSiteIds,
    })),
  );
}

export function getExperimentRunStats(experiment: PromptExperimentDraft | PromptExperiment): {
  broadcastCount: number;
  serviceSendCount: number;
} {
  return getPromptExperimentRunStats(experiment);
}

export function buildRunLimitMarkup(experiment: PromptExperimentDraft | PromptExperiment): string {
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
