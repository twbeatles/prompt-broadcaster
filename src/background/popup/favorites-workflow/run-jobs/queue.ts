import {
  findFavoriteRunDedupedJob,
  updateFavoriteRunJobs,
} from "../../../../shared/runtime-state";
import type {
  ChainStep,
  FavoriteExecutionTrigger,
  FavoritePrompt,
  FavoriteRunExecutionContextSnapshot,
  FavoriteRunJobRecord,
} from "../../../../shared/types/models";
import {
  createFavoriteRunJobId,
  replaceFavoriteRunJob,
  scheduleFavoriteJobAlarm,
} from "../../../favorites/jobs";
import type { FavoriteWorkflowRunJobDeps } from "./types";

export interface FavoriteRunJobQueueDeps
  extends Pick<
    FavoriteWorkflowRunJobDeps,
    | "nowIso"
    | "buildChainRunId"
    | "previewFavoriteText"
    | "getWorkflowMessage"
    | "getQueuedMessage"
    | "getDedupedMessage"
    | "getSkippedActiveMessage"
  > {}

export function createFavoriteRunJobQueue(deps: FavoriteRunJobQueueDeps) {
  async function queueFavoriteRunJob(
    favorite: FavoritePrompt,
    trigger: FavoriteExecutionTrigger,
    executionContext: FavoriteRunExecutionContextSnapshot,
    steps: ChainStep[],
    defaults: Record<string, string>,
  ) {
    const createdAt = deps.nowIso();
    const queueState: {
      queuedJob: FavoriteRunJobRecord | null;
      dedupedJob: FavoriteRunJobRecord | null;
    } = {
      queuedJob: null,
      dedupedJob: null,
    };

    await updateFavoriteRunJobs((jobs) => {
      queueState.dedupedJob = findFavoriteRunDedupedJob(jobs, favorite.id);
      if (queueState.dedupedJob) {
        return jobs;
      }

      queueState.queuedJob = {
        jobId: createFavoriteRunJobId(),
        favoriteId: favorite.id,
        trigger,
        status: "queued",
        mode: favorite.mode === "chain" ? "chain" : "single",
        stepCount: steps.length,
        completedSteps: 0,
        currentStepIndex: steps.length > 0 ? 0 : null,
        chainRunId: favorite.mode === "chain" ? deps.buildChainRunId() : null,
        currentBroadcastId: null,
        message: deps.getQueuedMessage(),
        createdAt,
        updatedAt: createdAt,
        favoriteTitle:
          favorite.title || deps.previewFavoriteText(favorite),
        steps,
        templateDefaults: { ...(defaults ?? {}) },
        executionContext: { ...executionContext },
        stepRetryCounts: {},
      };

      return replaceFavoriteRunJob(jobs, queueState.queuedJob);
    });

    const finalDedupedJob = queueState.dedupedJob;
    if (finalDedupedJob) {
      if (trigger === "scheduled") {
        const skippedAt = deps.nowIso();
        const skippedJob: FavoriteRunJobRecord = {
          jobId: createFavoriteRunJobId(),
          favoriteId: favorite.id,
          trigger,
          status: "skipped",
          mode: favorite.mode === "chain" ? "chain" : "single",
          stepCount: steps.length,
          completedSteps: Math.min(
            Number(finalDedupedJob.completedSteps ?? 0),
            Number(steps.length ?? 0),
          ),
          currentStepIndex:
            finalDedupedJob.currentStepIndex ?? (steps.length > 0 ? 0 : null),
          chainRunId: favorite.mode === "chain" ? deps.buildChainRunId() : null,
          currentBroadcastId: null,
          message: deps.getSkippedActiveMessage(),
          createdAt: skippedAt,
          updatedAt: skippedAt,
          favoriteTitle:
            favorite.title || deps.previewFavoriteText(favorite),
          steps,
          templateDefaults: { ...(defaults ?? {}) },
          executionContext: { ...executionContext },
          stepRetryCounts: {},
        };

        await updateFavoriteRunJobs((jobs) =>
          replaceFavoriteRunJob(jobs, skippedJob),
        );
      }

      return {
        ok: true,
        deduped: true,
        jobId: finalDedupedJob.jobId,
        message: deps.getDedupedMessage(),
      };
    }

    const finalQueuedJob = queueState.queuedJob;
    if (!finalQueuedJob) {
      return {
        ok: false,
        deduped: false,
        jobId: "",
        message: deps.getWorkflowMessage(
          "favorite_run_error_queue_failed",
          [],
          "Favorite execution could not be queued.",
        ),
      };
    }

    await scheduleFavoriteJobAlarm(finalQueuedJob.jobId);

    return {
      ok: true,
      deduped: false,
      jobId: finalQueuedJob.jobId,
      message: deps.getQueuedMessage(),
    };
  }

  return {
    queueFavoriteRunJob,
  };
}
