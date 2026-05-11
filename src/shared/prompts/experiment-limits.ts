import {
  EXPERIMENT_HARD_BROADCAST_LIMIT,
  EXPERIMENT_SOFT_BROADCAST_LIMIT,
} from "./constants";
import type { PromptExperiment } from "../types/models";

export interface PromptExperimentRunStats {
  broadcastCount: number;
  serviceSendCount: number;
  targetSiteCount: number;
}

export interface PromptExperimentLimitResult extends PromptExperimentRunStats {
  ok: boolean;
  requiresConfirmation: boolean;
  reason: "" | "hard_limit" | "confirmation_required";
}

export function getPromptExperimentRunStats(
  experiment: Pick<PromptExperiment, "variants" | "variableSets" | "targetSiteIds">,
): PromptExperimentRunStats {
  const variantCount = experiment.variants.filter((variant) => variant.text.trim()).length;
  const variableSetCount = experiment.variableSets.length > 0 ? experiment.variableSets.length : 1;
  const broadcastCount = variantCount * variableSetCount;
  const targetSiteCount = experiment.targetSiteIds.length;

  return {
    broadcastCount,
    serviceSendCount: broadcastCount * targetSiteCount,
    targetSiteCount,
  };
}

export function evaluatePromptExperimentRunLimit(
  experiment: Pick<PromptExperiment, "variants" | "variableSets" | "targetSiteIds">,
  confirmedLargeRun = false,
): PromptExperimentLimitResult {
  const stats = getPromptExperimentRunStats(experiment);

  if (stats.broadcastCount > EXPERIMENT_HARD_BROADCAST_LIMIT) {
    return {
      ...stats,
      ok: false,
      requiresConfirmation: false,
      reason: "hard_limit",
    };
  }

  if (stats.broadcastCount > EXPERIMENT_SOFT_BROADCAST_LIMIT && !confirmedLargeRun) {
    return {
      ...stats,
      ok: false,
      requiresConfirmation: true,
      reason: "confirmation_required",
    };
  }

  return {
    ...stats,
    ok: true,
    requiresConfirmation: stats.broadcastCount > EXPERIMENT_SOFT_BROADCAST_LIMIT,
    reason: "",
  };
}
