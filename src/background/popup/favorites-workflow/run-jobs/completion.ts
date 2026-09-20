import {
  findFavoriteRunJobByBroadcastId,
  getFavoriteRunJobs,
} from "../../../../shared/runtime-state";
import type { LastBroadcastSummary } from "../../../../shared/types/models";
import { scheduleFavoriteJobAlarm } from "../../../favorites/jobs";
import { mutateFavoriteRunJob } from "./job-mutation";
import type { FavoriteWorkflowRunJobDeps } from "./types";

export interface FavoriteRunJobCompletionDeps
  extends Pick<
    FavoriteWorkflowRunJobDeps,
    | "nowIso"
    | "getWorkflowMessage"
    | "getCompletedMessage"
    | "getFailedMessage"
    | "getQueuedStepMessage"
    | "getWaitingStepMessage"
  > {}

export function createFavoriteRunJobCompletion(
  deps: FavoriteRunJobCompletionDeps,
) {
  async function handleFavoriteBroadcastCompletion(
    summary: Pick<LastBroadcastSummary, "broadcastId" | "status">,
  ) {
    const jobs = await getFavoriteRunJobs();
    const job = findFavoriteRunJobByBroadcastId(jobs, summary?.broadcastId ?? "");
    if (!job) {
      return;
    }

    const stepIndex = job.currentStepIndex ?? 0;
    const completedSteps = Math.min(job.stepCount, stepIndex + 1);

    if (summary?.status !== "submitted") {
      const currentStep = job.steps[stepIndex];
      const failurePolicy = currentStep?.failurePolicy ?? "stop";
      const retryKey = currentStep?.id || String(stepIndex);
      const retryCounts = job.stepRetryCounts ?? {};
      const retryCount = retryCounts[retryKey] ?? 0;

      if (failurePolicy === "retry-once" && retryCount < 1) {
        await mutateFavoriteRunJob(job.jobId, (current) => ({
          ...current,
          status: "running",
          currentBroadcastId: null,
          currentStepIndex: stepIndex,
          message: deps.getQueuedStepMessage(stepIndex, current.stepCount),
          stepRetryCounts: {
            ...(current.stepRetryCounts ?? {}),
            [retryKey]: retryCount + 1,
          },
          updatedAt: deps.nowIso(),
        }));
        await scheduleFavoriteJobAlarm(job.jobId);
        return;
      }

      if (failurePolicy === "continue" && job.mode === "chain" && completedSteps < job.stepCount) {
        const nextStepIndex = completedSteps;
        const nextStep = job.steps[nextStepIndex];
        const nextDelayMs = Math.max(0, Math.round(Number(nextStep?.delayMs) || 0));
        await mutateFavoriteRunJob(job.jobId, (current) => ({
          ...current,
          status: "running",
          completedSteps,
          currentBroadcastId: null,
          currentStepIndex: nextStepIndex,
          message:
            nextDelayMs > 0
              ? deps.getWaitingStepMessage(nextStepIndex, current.stepCount)
              : deps.getQueuedStepMessage(nextStepIndex, current.stepCount),
          updatedAt: deps.nowIso(),
        }));
        await scheduleFavoriteJobAlarm(job.jobId, nextDelayMs);
        return;
      }

      await mutateFavoriteRunJob(job.jobId, (current) => ({
        ...current,
        status: "failed",
        completedSteps,
        currentBroadcastId: null,
        message: deps.getFailedMessage(),
        updatedAt: deps.nowIso(),
      }));
      return;
    }

    if (job.mode !== "chain" || completedSteps >= job.stepCount) {
      await mutateFavoriteRunJob(job.jobId, (current) => ({
        ...current,
        status: "completed",
        completedSteps: current.stepCount,
        currentBroadcastId: null,
        message: deps.getCompletedMessage(),
        updatedAt: deps.nowIso(),
      }));
      return;
    }

    const nextStepIndex = completedSteps;
    const nextStep = job.steps[nextStepIndex];
    const nextDelayMs = Math.max(0, Math.round(Number(nextStep?.delayMs) || 0));

    await mutateFavoriteRunJob(job.jobId, (current) => ({
      ...current,
      status: "running",
      completedSteps,
      currentBroadcastId: null,
      currentStepIndex: nextStepIndex,
      message:
        nextDelayMs > 0
          ? deps.getWaitingStepMessage(nextStepIndex, current.stepCount)
          : deps.getQueuedStepMessage(nextStepIndex, current.stepCount),
      updatedAt: deps.nowIso(),
    }));
    await scheduleFavoriteJobAlarm(job.jobId, nextDelayMs);
  }

  return {
    handleFavoriteBroadcastCompletion,
  };
}
