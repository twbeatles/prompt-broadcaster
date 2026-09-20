import { createFavoriteRunJobCompletion } from "./completion";
import { createFavoriteRunJobExecution } from "./execution";
import { createFavoriteRunJobFailureHistory } from "./failure-history";
import { createFavoriteRunJobMaintenance } from "./maintenance";
import { createFavoriteRunJobQueue } from "./queue";
import type { FavoriteWorkflowRunJobDeps } from "./types";

export function createFavoriteRunJobHandlers(
  deps: FavoriteWorkflowRunJobDeps,
) {
  const failureHistory = createFavoriteRunJobFailureHistory(deps);
  const completion = createFavoriteRunJobCompletion(deps);
  const execution = createFavoriteRunJobExecution({
    ...deps,
    appendFavoriteRunJobFailureHistory:
      failureHistory.appendFavoriteRunJobFailureHistory,
    handleFavoriteBroadcastCompletion:
      completion.handleFavoriteBroadcastCompletion,
  });
  const queue = createFavoriteRunJobQueue(deps);
  const maintenance = createFavoriteRunJobMaintenance({
    ...deps,
    runFavoriteJob: execution.runFavoriteJob,
    appendFavoriteRunJobFailureHistory:
      failureHistory.appendFavoriteRunJobFailureHistory,
  });

  return {
    queueFavoriteRunJob: queue.queueFavoriteRunJob,
    reconcileFavoriteRunJobs: maintenance.reconcileFavoriteRunJobs,
    handleFavoriteRunJobAlarm: maintenance.handleFavoriteRunJobAlarm,
    handleFavoriteBroadcastCompletion: completion.handleFavoriteBroadcastCompletion,
  };
}
