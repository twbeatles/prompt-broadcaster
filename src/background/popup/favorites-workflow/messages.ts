import type { FavoriteRunJobRecord } from "../../../shared/types/models";

export function createFavoriteWorkflowMessages(
  getI18nMessage: (key: string, substitutions?: string[]) => string,
) {
  const getWorkflowMessage = (
    key: string,
    substitutions: string[] = [],
    fallback = "",
  ) => getI18nMessage(key, substitutions) || fallback;

  function getQueuedMessage() {
    return getWorkflowMessage("favorite_run_message_queued", [], "Queued");
  }

  function getCompletedMessage() {
    return getWorkflowMessage("favorite_run_message_completed", [], "Completed");
  }

  function getDedupedMessage() {
    return getWorkflowMessage(
      "favorite_run_message_deduped",
      [],
      "Favorite run is already queued.",
    );
  }

  function getFailedMessage() {
    return getWorkflowMessage(
      "favorite_run_message_failed",
      [],
      "Favorite run failed",
    );
  }

  function getSkippedActiveMessage() {
    return getWorkflowMessage(
      "favorite_run_message_skipped_active",
      [],
      "Skipped because another run is active.",
    );
  }

  function getStepProgressMessage(stepIndex: number, stepCount: number) {
    return getWorkflowMessage(
      "favorite_run_message_step_progress",
      [String(stepIndex + 1), String(stepCount)],
      `Step ${stepIndex + 1}/${stepCount}`,
    );
  }

  function getWaitingStepMessage(stepIndex: number, stepCount: number) {
    return getWorkflowMessage(
      "favorite_run_message_waiting_step",
      [String(stepIndex + 1), String(stepCount)],
      `Waiting for step ${stepIndex + 1}/${stepCount}`,
    );
  }

  function getQueuedStepMessage(stepIndex: number, stepCount: number) {
    return getWorkflowMessage(
      "favorite_run_message_queued_step",
      [String(stepIndex + 1), String(stepCount)],
      `Queued step ${stepIndex + 1}/${stepCount}`,
    );
  }

  function getFavoriteRunProgressMessage(job: FavoriteRunJobRecord) {
    if (job.stepCount > 1 && job.currentStepIndex !== null) {
      return getStepProgressMessage(job.currentStepIndex, job.stepCount);
    }

    return job.message;
  }

  return {
    getWorkflowMessage,
    getQueuedMessage,
    getCompletedMessage,
    getDedupedMessage,
    getFailedMessage,
    getSkippedActiveMessage,
    getStepProgressMessage,
    getWaitingStepMessage,
    getQueuedStepMessage,
    getFavoriteRunProgressMessage,
  };
}
