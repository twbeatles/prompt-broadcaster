import {
  appendPromptExperimentRun,
  deletePromptExperiment,
  evaluatePromptExperimentRunLimit,
  EXPERIMENT_HARD_BROADCAST_LIMIT,
  EXPERIMENT_SOFT_BROADCAST_LIMIT,
  getPromptExperiments,
  normalizeSiteIdList,
  savePromptExperiment,
} from "../../shared/prompts";
import { renderTemplatePrompt } from "../../shared/template";
import type {
  BroadcastResponse,
  BroadcastSiteTargetMessage,
  ExperimentDeleteMessage,
  ExperimentDeleteResponse,
  ExperimentRunMessage,
  ExperimentRunResponse,
  ExperimentSaveMessage,
  ExperimentSaveResponse,
} from "../../shared/types/messages";

export interface ExperimentHandlersDeps {
  nowIso: () => string;
  queueBroadcastRequest: (
    prompt: string,
    siteRefs: Array<string | BroadcastSiteTargetMessage>,
    metadata?: Record<string, unknown>,
  ) => Promise<BroadcastResponse>;
}

export function createExperimentHandlers(deps: ExperimentHandlersDeps) {
  const { nowIso, queueBroadcastRequest } = deps;

  function buildExperimentRunId() {
    return typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : `experiment-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async function handleExperimentSave(
    message: ExperimentSaveMessage,
  ): Promise<ExperimentSaveResponse> {
    const experiment = await savePromptExperiment(message?.experiment ?? {});
    return {
      ok: true,
      experiment,
    };
  }

  async function handleExperimentDelete(
    message: ExperimentDeleteMessage,
  ): Promise<ExperimentDeleteResponse> {
    const experiments = await deletePromptExperiment(message?.experimentId ?? "");
    return {
      ok: true,
      experiments,
    };
  }

  async function handleExperimentRun(
    message: ExperimentRunMessage,
  ): Promise<ExperimentRunResponse> {
    const experiments = await getPromptExperiments();
    const experiment = experiments.find((entry) => entry.id === message?.experimentId);
    if (!experiment) {
      return {
        ok: false,
        experiment: null,
        queuedCount: 0,
        broadcastIds: [],
        preview: [],
        error: "Experiment not found.",
      };
    }

    const targetSiteIds = normalizeSiteIdList(experiment.targetSiteIds);
    const variants = experiment.variants.filter((variant) => variant.text.trim());
    const variableSets = experiment.variableSets.length > 0
      ? experiment.variableSets
      : [{ id: "default", title: "Default", values: {} }];
    const preview = variants.flatMap((variant) =>
      variableSets.map((variableSet) => ({
        variantId: variant.id,
        variableSetId: variableSet.id,
        targetSiteIds,
        prompt: renderTemplatePrompt(variant.text, variableSet.values ?? {}),
      })),
    );

    if (targetSiteIds.length === 0 || preview.length === 0) {
      return {
        ok: false,
        experiment,
        queuedCount: 0,
        broadcastIds: [],
        preview,
        error: "Experiment requires at least one variant and one target service.",
      };
    }

    const limitResult = evaluatePromptExperimentRunLimit(
      {
        variants,
        variableSets,
        targetSiteIds,
      },
      message?.confirmedLargeRun === true,
    );

    if (limitResult.reason === "hard_limit") {
      return {
        ok: false,
        experiment,
        queuedCount: 0,
        broadcastIds: [],
        preview,
        error: `Experiment has ${limitResult.broadcastCount} broadcasts. Split it into batches of ${EXPERIMENT_HARD_BROADCAST_LIMIT} or fewer.`,
      };
    }

    if (limitResult.reason === "confirmation_required") {
      return {
        ok: false,
        experiment,
        queuedCount: 0,
        broadcastIds: [],
        preview,
        error: `Experiment has ${limitResult.broadcastCount} broadcasts. Confirm the large run before queuing more than ${EXPERIMENT_SOFT_BROADCAST_LIMIT}.`,
      };
    }

    const runId = buildExperimentRunId();
    const broadcastIds: string[] = [];
    for (const item of preview) {
      const response = await queueBroadcastRequest(
        item.prompt,
        item.targetSiteIds.map((siteId) => ({ id: siteId })),
        {
          trigger: "options",
          experimentRunId: runId,
        },
      );
      if (response?.broadcastId) {
        broadcastIds.push(response.broadcastId);
      }
    }

    const updatedExperiment = await appendPromptExperimentRun(experiment.id, {
      id: runId,
      variantId: preview.length === 1 ? preview[0].variantId : "mixed",
      variableSetId: preview.length === 1 ? preview[0].variableSetId : "mixed",
      targetSiteIds,
      broadcastIds,
      createdAt: nowIso(),
    });

    return {
      ok: broadcastIds.length > 0,
      experiment: updatedExperiment ?? experiment,
      runId,
      queuedCount: broadcastIds.length,
      broadcastIds,
      preview,
      error: broadcastIds.length > 0 ? undefined : "No experiment broadcasts were queued.",
    };
  }

  return {
    buildExperimentRunId,
    handleExperimentSave,
    handleExperimentDelete,
    handleExperimentRun,
  };
}
