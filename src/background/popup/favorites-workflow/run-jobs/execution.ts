import { markFavoriteUsed, normalizeSiteIdList } from "../../../../shared/prompts";
import {
  getFavoriteRunJobById,
  getFavoriteRunJobs,
  getLastBroadcast,
} from "../../../../shared/runtime-state";
import type {
  FavoriteRunJobRecord,
  LastBroadcastSummary,
} from "../../../../shared/types/models";
import { queueFavoriteExecution } from "../../../favorites/jobs";
import { mutateFavoriteRunJob } from "./job-mutation";
import type { FavoriteWorkflowRunJobDeps } from "./types";

export interface FavoriteRunJobExecutionCollaborators {
  appendFavoriteRunJobFailureHistory: (
    job: FavoriteRunJobRecord,
    stepIndex: number,
    message: string,
  ) => Promise<void>;
  handleFavoriteBroadcastCompletion: (
    summary: Pick<LastBroadcastSummary, "broadcastId" | "status">,
  ) => Promise<void>;
}

export interface FavoriteRunJobExecutionDeps
  extends Pick<
      FavoriteWorkflowRunJobDeps,
      | "nowIso"
      | "buildFavoriteStepPrompt"
      | "queueBroadcastRequest"
      | "getWorkflowMessage"
      | "getCompletedMessage"
      | "getFavoriteRunProgressMessage"
    >,
    FavoriteRunJobExecutionCollaborators {}

export function createFavoriteRunJobExecution(
  deps: FavoriteRunJobExecutionDeps,
) {
  async function runFavoriteJob(jobId: string) {
    try {
      const jobs = await getFavoriteRunJobs();
      const job = getFavoriteRunJobById(jobs, jobId);
      if (
        !job ||
        job.currentBroadcastId ||
        job.status === "completed" ||
        job.status === "failed" ||
        job.status === "skipped"
      ) {
        return;
      }

      const stepIndex = job.currentStepIndex ?? job.completedSteps;
      const step = typeof stepIndex === "number" ? job.steps[stepIndex] : null;
      if (!step) {
        await mutateFavoriteRunJob(jobId, (current) => ({
          ...current,
          status: "completed",
          completedSteps: current.stepCount,
          currentBroadcastId: null,
          currentStepIndex: current.stepCount > 0 ? current.stepCount - 1 : null,
          message: deps.getCompletedMessage(),
          updatedAt: deps.nowIso(),
        }));
        return;
      }

      const targetSiteIds = normalizeSiteIdList(step.targetSiteIds);
      const response = await queueFavoriteExecution(async () => {
        const prompt = await deps.buildFavoriteStepPrompt(
          step,
          job.templateDefaults,
          job.executionContext,
        );

        return deps.queueBroadcastRequest(
          prompt,
          targetSiteIds.map((siteId) => {
            const targetRef: { id: string; target?: "new" | "tab" } = { id: siteId };
            if (step.targetMode === "new" || step.targetMode === "tab") {
              targetRef.target = step.targetMode;
            }
            return targetRef;
          }),
          {
            originFavoriteId: job.favoriteId,
            chainRunId: job.chainRunId,
            chainStepIndex: job.mode === "chain" ? stepIndex : null,
            chainStepCount: job.mode === "chain" ? job.stepCount : null,
            trigger: job.trigger,
          },
        );
      });

      if (!response?.ok || !response?.broadcastId) {
        const errorMessage =
          response?.error ??
          deps.getWorkflowMessage(
            "favorite_run_error_queue_failed",
            [],
            "Favorite execution could not be queued.",
          );
        await mutateFavoriteRunJob(jobId, (current) => ({
          ...current,
          status: "failed",
          currentBroadcastId: null,
          message: errorMessage,
          updatedAt: deps.nowIso(),
        }));
        await deps.appendFavoriteRunJobFailureHistory(job, stepIndex, errorMessage);
        return;
      }

      if ((job.completedSteps ?? 0) === 0 && stepIndex === 0) {
        await markFavoriteUsed(job.favoriteId).catch((error) => {
          console.error(
            "[AI Prompt Broadcaster] Failed to mark favorite usage.",
            error,
          );
        });
      }

      await mutateFavoriteRunJob(jobId, (current) => ({
        ...current,
        status: "running",
        currentBroadcastId: response.broadcastId ?? null,
        currentStepIndex: stepIndex,
        message: deps.getFavoriteRunProgressMessage({
          ...current,
          currentStepIndex: stepIndex,
        }),
        updatedAt: deps.nowIso(),
      }));

      const lastBroadcast = await getLastBroadcast().catch(() => null);
      if (
        lastBroadcast &&
        lastBroadcast.broadcastId === response.broadcastId &&
        lastBroadcast.status !== "sending"
      ) {
        await deps.handleFavoriteBroadcastCompletion(lastBroadcast);
      }
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Favorite run worker failed.", error);
      const jobs = await getFavoriteRunJobs();
      const job = getFavoriteRunJobById(jobs, jobId);
      if (!job) {
        return;
      }

      const stepIndex = job.currentStepIndex ?? job.completedSteps;
      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : deps.getWorkflowMessage(
              "favorite_run_error_start_failed",
              [],
              "Favorite execution could not start.",
            );

      await mutateFavoriteRunJob(jobId, (current) => ({
        ...current,
        status: "failed",
        currentBroadcastId: null,
        message: errorMessage,
        updatedAt: deps.nowIso(),
      }));

      if (typeof stepIndex === "number") {
        await deps.appendFavoriteRunJobFailureHistory(job, stepIndex, errorMessage);
      }
    }
  }

  return {
    runFavoriteJob,
  };
}
