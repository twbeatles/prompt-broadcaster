import { markFavoriteUsed, normalizeSiteIdList } from "../../../shared/prompts";
import {
  findFavoriteRunDedupedJob,
  findFavoriteRunJobByBroadcastId,
  getFavoriteRunJobById,
  getFavoriteRunJobs,
  getLastBroadcast,
  updateFavoriteRunJobs,
} from "../../../shared/runtime-state";
import type {
  ChainStep,
  FavoriteExecutionTrigger,
  FavoritePrompt,
  FavoriteRunExecutionContextSnapshot,
  FavoriteRunJobRecord,
  LastBroadcastSummary,
} from "../../../shared/types/models";
import {
  buildFavoriteJobAlarmName,
  createFavoriteRunJobId,
  FAVORITE_JOB_ALARM_PREFIX,
  parseFavoriteJobIdFromAlarmName,
  queueFavoriteExecution,
  replaceFavoriteRunJob,
  scheduleFavoriteJobAlarm,
} from "../../favorites/jobs";

interface FavoriteWorkflowRunJobDeps {
  nowIso: () => string;
  buildChainRunId: () => string;
  previewFavoriteText: (favorite: FavoritePrompt | null | undefined) => string;
  buildFavoriteStepPrompt: (
    step: ChainStep,
    defaults: Record<string, string>,
    executionContext: FavoriteRunExecutionContextSnapshot,
  ) => Promise<string>;
  queueBroadcastRequest: (
    prompt: string,
    siteRefs: Array<{ id: string; target?: "new" | "tab" }>,
    metadata?: Record<string, unknown>,
  ) => Promise<{
    ok?: boolean;
    error?: string;
    broadcastId?: string;
  }>;
  createFavoriteFailureHistory: (details: {
    favoriteId?: string | null;
    requestedSiteIds?: string[];
    message?: string;
    text?: string;
    chainRunId?: string | null;
    chainStepIndex?: number | null;
    chainStepCount?: number | null;
    trigger?: FavoriteExecutionTrigger;
  }) => Promise<void>;
  getWorkflowMessage: (
    key: string,
    substitutions?: string[],
    fallback?: string,
  ) => string;
  getQueuedMessage: () => string;
  getCompletedMessage: () => string;
  getDedupedMessage: () => string;
  getFailedMessage: () => string;
  getSkippedActiveMessage: () => string;
  getWaitingStepMessage: (stepIndex: number, stepCount: number) => string;
  getQueuedStepMessage: (stepIndex: number, stepCount: number) => string;
  getFavoriteRunProgressMessage: (job: FavoriteRunJobRecord) => string;
}

export function createFavoriteRunJobHandlers(
  deps: FavoriteWorkflowRunJobDeps,
) {
  async function mutateFavoriteRunJob(
    jobId: string,
    updater: (job: FavoriteRunJobRecord) => FavoriteRunJobRecord,
  ) {
    return updateFavoriteRunJobs((jobs) => {
      const existing = getFavoriteRunJobById(jobs, jobId);
      if (!existing) {
        return jobs;
      }

      return replaceFavoriteRunJob(jobs, updater(existing));
    });
  }

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
        await appendFavoriteRunJobFailureHistory(job, stepIndex, errorMessage);
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
        await handleFavoriteBroadcastCompletion(lastBroadcast);
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
        await appendFavoriteRunJobFailureHistory(job, stepIndex, errorMessage);
      }
    }
  }

  async function reconcileFavoriteRunJobs() {
    const [jobs, alarms] = await Promise.all([
      getFavoriteRunJobs(),
      chrome.alarms.getAll().catch(() => []),
    ]);
    const existingAlarmNames = new Set(alarms.map((alarm) => alarm.name));
    const desiredAlarmNames = new Set<string>();

    await Promise.all(
      jobs.map(async (job) => {
        if (
          (job.status !== "queued" && job.status !== "running") ||
          job.currentBroadcastId
        ) {
          return;
        }

        const alarmName = buildFavoriteJobAlarmName(job.jobId);
        if (!alarmName) {
          return;
        }

        desiredAlarmNames.add(alarmName);
        if (!existingAlarmNames.has(alarmName)) {
          await scheduleFavoriteJobAlarm(job.jobId);
        }
      }),
    );

    await Promise.all(
      alarms
        .filter((alarm) => alarm.name.startsWith(FAVORITE_JOB_ALARM_PREFIX))
        .filter((alarm) => !desiredAlarmNames.has(alarm.name))
        .map((alarm) => chrome.alarms.clear(alarm.name).catch(() => false)),
    );
  }

  async function handleFavoriteRunJobAlarm(alarmName: string) {
    const jobId = parseFavoriteJobIdFromAlarmName(alarmName);
    if (!jobId) {
      return;
    }

    try {
      await runFavoriteJob(jobId);
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Favorite alarm worker failed.", error);
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
        await appendFavoriteRunJobFailureHistory(job, stepIndex, errorMessage);
      }
    }
  }

  return {
    queueFavoriteRunJob,
    reconcileFavoriteRunJobs,
    handleFavoriteRunJobAlarm,
    handleFavoriteBroadcastCompletion,
  };
}
