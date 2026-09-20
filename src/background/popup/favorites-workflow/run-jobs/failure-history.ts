import type { FavoriteRunJobRecord } from "../../../../shared/types/models";
import type { FavoriteWorkflowRunJobDeps } from "./types";

export interface FavoriteRunJobFailureHistoryDeps
  extends Pick<FavoriteWorkflowRunJobDeps, "createFavoriteFailureHistory"> {}

export function createFavoriteRunJobFailureHistory(
  deps: FavoriteRunJobFailureHistoryDeps,
) {
  async function appendFavoriteRunJobFailureHistory(
    job: FavoriteRunJobRecord,
    stepIndex: number,
    message: string,
  ) {
    const step = job.steps[stepIndex];
    if (!step) {
      return;
    }

    await deps.createFavoriteFailureHistory({
      favoriteId: job.favoriteId,
      requestedSiteIds: step.targetSiteIds,
      message,
      text: step.text,
      chainRunId: job.chainRunId,
      chainStepIndex: job.mode === "chain" ? stepIndex : null,
      chainStepCount: job.mode === "chain" ? job.stepCount : null,
      trigger: job.trigger,
    });
  }

  return {
    appendFavoriteRunJobFailureHistory,
  };
}
