import {
  appendPromptHistory,
  getAppSettings,
  getPromptFavorites,
  getTemplateVariableCache,
  markFavoriteUsed,
  normalizeSiteIdList,
  updateFavoritePrompt,
} from "../../shared/prompts";
import {
  enqueueUiToast,
  findFavoriteRunDedupedJob,
  findFavoriteRunJobByBroadcastId,
  getFavoriteRunJobById,
  getFavoriteRunJobs,
  getLastBroadcast,
  setPopupFavoriteIntent,
  updateFavoriteRunJobs,
} from "../../shared/runtime-state";
import type {
  ChainStep,
  FavoriteExecutionTrigger,
  FavoritePrompt,
  FavoriteRunExecutionContextSnapshot,
  FavoriteRunJobRecord,
} from "../../shared/types/models";
import { NOTIFICATION_ICON_PATH } from "../app/constants";
import { buildSiteResult } from "../app/injection-helpers";
import {
  createFavoriteExecutionContextTools,
} from "../favorites/execution-context";
import {
  buildFavoriteJobAlarmName,
  createFavoriteRunJobId,
  FAVORITE_JOB_ALARM_PREFIX,
  parseFavoriteJobIdFromAlarmName,
  queueFavoriteExecution,
  replaceFavoriteRunJob,
  scheduleFavoriteJobAlarm,
} from "../favorites/jobs";
import {
  buildScheduleAlarmName,
  computeNextScheduledAt,
  parseScheduleAlarmFavoriteId,
} from "../favorites/schedules";
import {
  createFavoriteTemplateResolutionTools,
} from "../favorites/template-resolution";

interface FavoriteWorkflowDeps {
  getBroadcastTriggerLabel: (trigger: unknown) => FavoriteExecutionTrigger;
  getI18nMessage: (key: string, substitutions?: string[]) => string;
  rememberNormalTab: (tab: chrome.tabs.Tab | undefined) => Promise<chrome.tabs.Tab | null>;
  getPreferredNormalActiveTab: () => Promise<chrome.tabs.Tab | null>;
  isInjectableTabUrl: (url: string) => boolean;
  getSelectedTextFromTab: (tabId: number) => Promise<string>;
  openPopupWithPrompt: (prompt?: string) => Promise<void>;
  nowIso: () => string;
  buildChainRunId: () => string;
  queueBroadcastRequest: (
    prompt: string,
    siteRefs: Array<{ id: string }>,
    metadata?: Record<string, unknown>
  ) => Promise<{
    ok?: boolean;
    error?: string;
    broadcastId?: string;
  }>;
}

export function createFavoriteWorkflow(deps: FavoriteWorkflowDeps) {
  const {
    getBroadcastTriggerLabel,
    getI18nMessage,
    rememberNormalTab,
    getPreferredNormalActiveTab,
    isInjectableTabUrl,
    getSelectedTextFromTab,
    openPopupWithPrompt,
    nowIso,
    buildChainRunId,
    queueBroadcastRequest,
  } = deps;

  const getWorkflowMessage = (
    key: string,
    substitutions: string[] = [],
    fallback = ""
  ) => getI18nMessage(key, substitutions) || fallback;
  const {
    createEmptyExecutionContext,
    normalizePreparedExecutionContext,
    mergeExecutionContext,
    getExecutionTabContextFromSender,
  } = createFavoriteExecutionContextTools({
    rememberNormalTab,
    getPreferredNormalActiveTab,
    isInjectableTabUrl,
    getSelectedTextFromTab,
  });
  const {
    getFavoriteExecutionSteps,
    getFavoriteTargetSiteIds,
    previewFavoriteText,
    detectFavoriteExecutionBlockers,
    buildFavoriteStepPrompt,
  } = createFavoriteTemplateResolutionTools({
    getWorkflowMessage,
  });

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
    return getWorkflowMessage("favorite_run_message_failed", [], "Favorite run failed");
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

  async function createFavoriteFailureHistory(
    details: {
      favoriteId?: string | null;
      requestedSiteIds?: string[];
      message?: string;
      text?: string;
      chainRunId?: string | null;
      chainStepIndex?: number | null;
      chainStepCount?: number | null;
      trigger?: FavoriteExecutionTrigger;
    } = {}
  ) {
    const requestedSiteIds = normalizeSiteIdList(
      details.requestedSiteIds ?? [],
    );
    const siteResults = Object.fromEntries(
      requestedSiteIds.map((siteId) => [
        siteId,
        buildSiteResult("unexpected_error", {
          message: details.message || getWorkflowMessage(
            "favorite_run_error_start_failed",
            [],
            "Favorite execution could not start.",
          ),
        }),
      ]),
    );

    await appendPromptHistory({
      id: Date.now(),
      text: details.text ?? "",
      requestedSiteIds,
      submittedSiteIds: [],
      failedSiteIds: requestedSiteIds,
      sentTo: [],
      createdAt: nowIso(),
      status: "failed",
      siteResults,
      originFavoriteId: details.favoriteId ?? null,
      chainRunId: details.chainRunId ?? null,
      chainStepIndex: details.chainStepIndex ?? null,
      chainStepCount: details.chainStepCount ?? null,
      trigger: details.trigger ?? "scheduled",
    });
  }

  async function maybeCreateFavoriteFailureNotification(
    favorite: FavoritePrompt,
    message: string
  ) {
    const settings = await getAppSettings().catch(() => null);
    if (!settings?.desktopNotifications) {
      return;
    }

    try {
      await chrome.notifications.create(`favorite-failure-${Date.now()}`, {
        type: "basic",
        iconUrl: chrome.runtime.getURL(NOTIFICATION_ICON_PATH),
        title: favorite?.title || getWorkflowMessage(
          "favorite_run_notification_title_skipped",
          [],
          "Favorite run skipped",
        ),
        message: String(message ?? getWorkflowMessage(
          "favorite_run_error_start_failed",
          [],
          "Favorite execution could not start.",
        )),
      });
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to create favorite failure notification.", error);
    }
  }

  async function storePopupFavoriteIntentAndOpen(
    favoriteId: string,
    type: "edit" | "run",
    source: FavoriteExecutionTrigger | "options-edit",
    reason = ""
  ) {
    await setPopupFavoriteIntent({
      type,
      favoriteId,
      source,
      reason,
      createdAt: nowIso(),
    });
    await openPopupWithPrompt("");
  }

  async function mutateFavoriteRunJob(
    jobId: string,
    updater: (job: FavoriteRunJobRecord) => FavoriteRunJobRecord
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
    defaults: Record<string, string>
  ) {
    const createdAt = nowIso();
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
        chainRunId: favorite.mode === "chain" ? buildChainRunId() : null,
        currentBroadcastId: null,
        message: getQueuedMessage(),
        createdAt,
        updatedAt: createdAt,
        favoriteTitle: favorite.title || previewFavoriteText(favorite),
        steps,
        templateDefaults: { ...(defaults ?? {}) },
        executionContext: { ...executionContext },
      };

      return replaceFavoriteRunJob(jobs, queueState.queuedJob);
    });

    const finalDedupedJob = queueState.dedupedJob;
    if (finalDedupedJob) {
      if (trigger === "scheduled") {
        const skippedAt = nowIso();
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
          currentStepIndex: finalDedupedJob.currentStepIndex ?? (steps.length > 0 ? 0 : null),
          chainRunId: favorite.mode === "chain" ? buildChainRunId() : null,
          currentBroadcastId: null,
          message: getSkippedActiveMessage(),
          createdAt: skippedAt,
          updatedAt: skippedAt,
          favoriteTitle: favorite.title || previewFavoriteText(favorite),
          steps,
          templateDefaults: { ...(defaults ?? {}) },
          executionContext: { ...executionContext },
        };

        await updateFavoriteRunJobs((jobs) => replaceFavoriteRunJob(jobs, skippedJob));
      }

      return {
        ok: true,
        deduped: true,
        jobId: finalDedupedJob.jobId,
        message: getDedupedMessage(),
      };
    }

    const finalQueuedJob = queueState.queuedJob;
    if (!finalQueuedJob) {
      return {
        ok: false,
        deduped: false,
        jobId: "",
        message: getWorkflowMessage(
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
      message: getQueuedMessage(),
    };
  }

  async function enqueueFavoriteRun(
    favorite: FavoritePrompt,
    options: {
      trigger: FavoriteExecutionTrigger;
      sender?: chrome.runtime.MessageSender;
      allowPopupFallback?: boolean;
      preparedExecutionContext?: Partial<FavoriteRunExecutionContextSnapshot>;
    }
  ) {
    const trigger = getBroadcastTriggerLabel(options.trigger);
    const preparedExecutionContext = normalizePreparedExecutionContext(options.preparedExecutionContext);
    const baseExecutionContext = trigger === "scheduled"
      ? createEmptyExecutionContext()
      : await getExecutionTabContextFromSender(options.sender);
    const executionContext = mergeExecutionContext(
      baseExecutionContext,
      preparedExecutionContext.context,
    );
    const templateVariableCache = await getTemplateVariableCache().catch(() => ({}));
    const validation = detectFavoriteExecutionBlockers(
      favorite,
      executionContext,
      templateVariableCache,
      trigger,
      {
        hasPreparedClipboardValue: preparedExecutionContext.hasClipboardValue,
      },
    );

    if (!validation.ok) {
      if (trigger === "scheduled") {
        const chainRunId = favorite?.mode === "chain" ? buildChainRunId() : null;
        await createFavoriteFailureHistory({
          favoriteId: favorite?.id ?? null,
          message: validation.message,
          requestedSiteIds:
            validation.failingStepTargetSiteIds
            ?? getFavoriteExecutionSteps(favorite)[0]?.targetSiteIds
            ?? favorite?.sentTo
            ?? [],
          text:
            validation.failingStepText
            ?? getFavoriteExecutionSteps(favorite)[0]?.text
            ?? favorite?.text
            ?? "",
          trigger,
          chainRunId,
          chainStepIndex:
            favorite?.mode === "chain"
              ? validation.failingStepIndex ?? 0
              : null,
          chainStepCount: favorite?.mode === "chain" ? getFavoriteExecutionSteps(favorite).length : null,
        });
        await enqueueUiToast({
          message: validation.message ?? getWorkflowMessage(
            "favorite_run_error_start_failed",
            [],
            "Favorite execution could not start.",
          ),
          type: "warning",
          duration: 5000,
        });
        await maybeCreateFavoriteFailureNotification(
          favorite,
          validation.message ?? getWorkflowMessage(
            "favorite_run_error_start_failed",
            [],
            "Favorite execution could not start.",
          ),
        );
        return {
          ok: false,
          reason: validation.reason,
          error: validation.message,
        };
      }

      return {
        ok: false,
        requiresPopupInput: true,
        reason: validation.reason,
        error: validation.message,
      };
    }

    return queueFavoriteRunJob(
      favorite,
      trigger,
      executionContext,
      validation.steps ?? [],
      validation.defaults ?? {},
    );
  }

  async function appendFavoriteRunJobFailureHistory(
    job: FavoriteRunJobRecord,
    stepIndex: number,
    message: string
  ) {
    const step = job.steps[stepIndex];
    if (!step) {
      return;
    }

    await createFavoriteFailureHistory({
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
          message: getCompletedMessage(),
          updatedAt: nowIso(),
        }));
        return;
      }

      const targetSiteIds = normalizeSiteIdList(step.targetSiteIds);
      const response = await queueFavoriteExecution(async () => {
        const prompt = await buildFavoriteStepPrompt(
          step,
          job.templateDefaults,
          job.executionContext,
        );

        return queueBroadcastRequest(
          prompt,
          targetSiteIds.map((siteId) => ({ id: siteId })),
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
        const errorMessage = response?.error ?? getWorkflowMessage(
          "favorite_run_error_queue_failed",
          [],
          "Favorite execution could not be queued.",
        );
        await mutateFavoriteRunJob(jobId, (current) => ({
          ...current,
          status: "failed",
          currentBroadcastId: null,
          message: errorMessage,
          updatedAt: nowIso(),
        }));
        await appendFavoriteRunJobFailureHistory(job, stepIndex, errorMessage);
        return;
      }

      if ((job.completedSteps ?? 0) === 0 && stepIndex === 0) {
        await markFavoriteUsed(job.favoriteId).catch((error) => {
          console.error("[AI Prompt Broadcaster] Failed to mark favorite usage.", error);
        });
      }

      await mutateFavoriteRunJob(jobId, (current) => ({
        ...current,
        status: "running",
        currentBroadcastId: response.broadcastId ?? null,
        currentStepIndex: stepIndex,
        message: getFavoriteRunProgressMessage({
          ...current,
          currentStepIndex: stepIndex,
        }),
        updatedAt: nowIso(),
      }));

      const lastBroadcast = await getLastBroadcast().catch(() => null);
      if (lastBroadcast && lastBroadcast.broadcastId === response.broadcastId && lastBroadcast.status !== "sending") {
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
      const errorMessage = error instanceof Error && error.message
        ? error.message
        : getWorkflowMessage(
            "favorite_run_error_start_failed",
            [],
            "Favorite execution could not start.",
          );

      await mutateFavoriteRunJob(jobId, (current) => ({
        ...current,
        status: "failed",
        currentBroadcastId: null,
        message: errorMessage,
        updatedAt: nowIso(),
      }));

      if (typeof stepIndex === "number") {
        await appendFavoriteRunJobFailureHistory(job, stepIndex, errorMessage);
      }
    }
  }

  async function reconcileFavoriteSchedules() {
    const favorites = await getPromptFavorites().catch(() => []);
    const desiredAlarms = new Map<string, number>();

    favorites.forEach((favorite) => {
      if (!favorite?.scheduleEnabled || !favorite?.scheduledAt) {
        return;
      }

      const alarmName = buildScheduleAlarmName(favorite.id);
      if (!alarmName) {
        return;
      }

      const scheduledTime = Date.parse(favorite.scheduledAt);
      if (!Number.isFinite(scheduledTime)) {
        return;
      }

      desiredAlarms.set(alarmName, Math.max(Date.now() + 250, scheduledTime));
    });

    try {
      const alarms = await chrome.alarms.getAll();
      await Promise.all(
        alarms
          .filter((alarm) => parseScheduleAlarmFavoriteId(alarm.name))
          .map(async (alarm) => {
            if (!desiredAlarms.has(alarm.name)) {
              await chrome.alarms.clear(alarm.name);
            }
          }),
      );

      for (const [alarmName, when] of desiredAlarms.entries()) {
        chrome.alarms.create(alarmName, { when });
      }
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to reconcile favorite schedules.", error);
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
      })
    );

    await Promise.all(
      alarms
        .filter((alarm) => alarm.name.startsWith(FAVORITE_JOB_ALARM_PREFIX))
        .filter((alarm) => !desiredAlarmNames.has(alarm.name))
        .map((alarm) => chrome.alarms.clear(alarm.name).catch(() => false))
    );
  }

  async function handleFavoriteScheduleAlarm(favoriteId: string) {
    const favorites = await getPromptFavorites();
    const favorite = favorites.find((entry) => String(entry.id) === String(favoriteId));
    const alarmName = buildScheduleAlarmName(favoriteId);

    if (!favorite?.scheduleEnabled) {
      if (alarmName) {
        await chrome.alarms.clear(alarmName).catch(() => false);
      }
      return;
    }

    await enqueueFavoriteRun(favorite, {
      trigger: "scheduled",
      allowPopupFallback: false,
    });

    if (favorite.scheduleRepeat === "none") {
      await updateFavoritePrompt(favorite.id, {
        scheduleEnabled: false,
        scheduledAt: null,
      });
    } else {
      await updateFavoritePrompt(favorite.id, {
        scheduledAt: computeNextScheduledAt(favorite.scheduleRepeat, favorite.scheduledAt, new Date()),
      });
    }

    await reconcileFavoriteSchedules();
  }

  async function handleFavoriteRunMessage(
    message: {
      favoriteId?: string;
      trigger?: FavoriteExecutionTrigger;
      allowPopupFallback?: boolean;
      preparedExecutionContext?: Partial<FavoriteRunExecutionContextSnapshot>;
    },
    sender: chrome.runtime.MessageSender
  ) {
    const favoriteId = typeof message?.favoriteId === "string" ? message.favoriteId.trim() : "";
    if (!favoriteId) {
      return {
        ok: false,
        error: getWorkflowMessage(
          "favorite_run_error_favorite_id_required",
          [],
          "Favorite id is required.",
        ),
      };
    }

    const favorites = await getPromptFavorites();
    const favorite = favorites.find((entry) => String(entry.id) === favoriteId);
    if (!favorite) {
      return {
        ok: false,
        error: getWorkflowMessage(
          "favorite_run_error_favorite_not_found",
          [],
          "Favorite not found.",
        ),
      };
    }

    const execution = await enqueueFavoriteRun(favorite, {
      trigger: message?.trigger ?? "popup",
      sender,
      allowPopupFallback: message?.allowPopupFallback !== false,
      preparedExecutionContext: message?.preparedExecutionContext,
    });

    if (execution?.ok) {
      return execution;
    }

    const requiresPopupInput =
      "requiresPopupInput" in execution && Boolean(execution.requiresPopupInput);

    if (!requiresPopupInput || message?.allowPopupFallback === false) {
      return execution;
    }

    await storePopupFavoriteIntentAndOpen(
      favoriteId,
      "run",
      message?.trigger ?? "popup",
      ("error" in execution ? execution.error : "") ?? "",
    );

    return {
      ok: true,
      popupFallback: true,
      reason: ("reason" in execution ? execution.reason : "popup_fallback") ?? "popup_fallback",
    };
  }

  async function handleFavoriteOpenEditorMessage(message: { favoriteId?: string; source?: "options-edit" | "popup" }) {
    const favoriteId = typeof message?.favoriteId === "string" ? message.favoriteId.trim() : "";
    if (!favoriteId) {
      return {
        ok: false,
        error: getWorkflowMessage(
          "favorite_run_error_favorite_id_required",
          [],
          "Favorite id is required.",
        ),
      };
    }

    await storePopupFavoriteIntentAndOpen(
      favoriteId,
      "edit",
      message?.source ?? "options-edit",
    );

    return { ok: true };
  }

  async function handleQuickPaletteGetState() {
    const favorites = await getPromptFavorites();
    return {
      ok: true,
      favorites: favorites.map((favorite) => ({
        id: favorite.id,
        title: favorite.title || previewFavoriteText(favorite),
        text: favorite.text ?? "",
        preview: previewFavoriteText(favorite),
        mode: favorite.mode === "chain" ? "chain" : "single",
        tags: Array.isArray(favorite.tags) ? favorite.tags : [],
        folder: favorite.folder ?? "",
      })),
    };
  }

  async function handleQuickPaletteExecuteMessage(
    message: { favoriteId?: string },
    sender: chrome.runtime.MessageSender
  ) {
    return handleFavoriteRunMessage({
      favoriteId: message?.favoriteId,
      trigger: "palette",
      allowPopupFallback: true,
    }, sender);
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
      const errorMessage = error instanceof Error && error.message
        ? error.message
        : getWorkflowMessage(
            "favorite_run_error_start_failed",
            [],
            "Favorite execution could not start.",
          );

      await mutateFavoriteRunJob(jobId, (current) => ({
        ...current,
        status: "failed",
        currentBroadcastId: null,
        message: errorMessage,
        updatedAt: nowIso(),
      }));

      if (typeof stepIndex === "number") {
        await appendFavoriteRunJobFailureHistory(job, stepIndex, errorMessage);
      }
    }
  }

  async function handleFavoriteBroadcastCompletion(summary: { broadcastId?: string; status?: string }) {
    const jobs = await getFavoriteRunJobs();
    const job = findFavoriteRunJobByBroadcastId(jobs, summary?.broadcastId ?? "");
    if (!job) {
      return;
    }

    const stepIndex = job.currentStepIndex ?? 0;
    const completedSteps = Math.min(job.stepCount, stepIndex + 1);

    if (summary?.status !== "submitted") {
      await mutateFavoriteRunJob(job.jobId, (current) => ({
        ...current,
        status: "failed",
        completedSteps,
        currentBroadcastId: null,
        message: getFailedMessage(),
        updatedAt: nowIso(),
      }));
      return;
    }

    if (job.mode !== "chain" || completedSteps >= job.stepCount) {
      await mutateFavoriteRunJob(job.jobId, (current) => ({
        ...current,
        status: "completed",
        completedSteps: current.stepCount,
        currentBroadcastId: null,
        message: getCompletedMessage(),
        updatedAt: nowIso(),
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
      message: nextDelayMs > 0
        ? getWaitingStepMessage(nextStepIndex, current.stepCount)
        : getQueuedStepMessage(nextStepIndex, current.stepCount),
      updatedAt: nowIso(),
    }));
    await scheduleFavoriteJobAlarm(job.jobId, nextDelayMs);
  }

  return {
    buildScheduleAlarmName,
    parseScheduleAlarmFavoriteId,
    getFavoriteExecutionSteps,
    getFavoriteTargetSiteIds,
    previewFavoriteText,
    reconcileFavoriteRunJobs,
    reconcileFavoriteSchedules,
    handleFavoriteScheduleAlarm,
    handleFavoriteRunMessage,
    handleFavoriteOpenEditorMessage,
    handleQuickPaletteGetState,
    handleQuickPaletteExecuteMessage,
    handleFavoriteRunJobAlarm,
    handleFavoriteBroadcastCompletion,
  };
}
