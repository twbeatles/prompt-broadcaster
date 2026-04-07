import {
  appendPromptHistory,
  getAppSettings,
  getBroadcastCounter,
  getPromptFavorites,
  getTemplateVariableCache,
  markFavoriteUsed,
  normalizeSiteIdList,
  updateFavoritePrompt,
} from "../../shared/prompts";
import {
  SYSTEM_TEMPLATE_VARIABLES,
  buildSystemTemplateValues,
  detectTemplateVariables,
  renderTemplatePrompt,
} from "../../shared/template";
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

const SCHEDULED_VARIABLE_BLOCKLIST = new Set([
  SYSTEM_TEMPLATE_VARIABLES.url,
  SYSTEM_TEMPLATE_VARIABLES.title,
  SYSTEM_TEMPLATE_VARIABLES.selection,
  SYSTEM_TEMPLATE_VARIABLES.clipboard,
]);
const FAVORITE_JOB_ALARM_PREFIX = "apb-favorite-job:";
const FAVORITE_JOB_INITIAL_DELAY_MS = 50;

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

interface FavoriteExecutionValidationResult {
  ok: boolean;
  steps?: ChainStep[];
  defaults?: Record<string, string>;
  reason?: string;
  message?: string;
}

interface NormalizedPreparedExecutionContext {
  context: Partial<FavoriteRunExecutionContextSnapshot>;
  hasClipboardValue: boolean;
}

function createFavoriteRunJobId() {
  return typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `favorite-job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildFavoriteJobAlarmName(jobId: string) {
  const normalizedJobId = typeof jobId === "string" ? jobId.trim() : "";
  return normalizedJobId ? `${FAVORITE_JOB_ALARM_PREFIX}${normalizedJobId}` : "";
}

function parseFavoriteJobIdFromAlarmName(alarmName: string) {
  const normalizedAlarmName = typeof alarmName === "string" ? alarmName.trim() : "";
  return normalizedAlarmName.startsWith(FAVORITE_JOB_ALARM_PREFIX)
    ? normalizedAlarmName.slice(FAVORITE_JOB_ALARM_PREFIX.length)
    : "";
}

async function scheduleFavoriteJobAlarm(jobId: string, delayMs = FAVORITE_JOB_INITIAL_DELAY_MS) {
  const alarmName = buildFavoriteJobAlarmName(jobId);
  if (!alarmName) {
    return;
  }

  chrome.alarms.create(alarmName, {
    when: Date.now() + Math.max(FAVORITE_JOB_INITIAL_DELAY_MS, Math.round(Number(delayMs) || 0)),
  });
}

function replaceFavoriteRunJob(
  jobs: FavoriteRunJobRecord[],
  nextJob: FavoriteRunJobRecord
): FavoriteRunJobRecord[] {
  const nextJobs = jobs.filter((job) => job.jobId !== nextJob.jobId);
  nextJobs.unshift(nextJob);
  return nextJobs;
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

  const createEmptyExecutionContext = (): FavoriteRunExecutionContextSnapshot => ({
    tabId: null,
    windowId: null,
    url: "",
    title: "",
    selection: "",
    clipboard: "",
  });

  const hasOwn = (value: unknown, key: string) =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
    Object.prototype.hasOwnProperty.call(value, key);

  function normalizePreparedExecutionContext(value: unknown): NormalizedPreparedExecutionContext {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {
        context: {},
        hasClipboardValue: false,
      };
    }

    const source = value as Record<string, unknown>;
    const tabId = Number(source.tabId);
    const windowId = Number(source.windowId);

    return {
      context: {
        ...(hasOwn(source, "tabId") ? { tabId: Number.isFinite(tabId) ? tabId : null } : {}),
        ...(hasOwn(source, "windowId") ? { windowId: Number.isFinite(windowId) ? windowId : null } : {}),
        ...(hasOwn(source, "url") ? { url: typeof source.url === "string" ? source.url : "" } : {}),
        ...(hasOwn(source, "title") ? { title: typeof source.title === "string" ? source.title : "" } : {}),
        ...(hasOwn(source, "selection") ? { selection: typeof source.selection === "string" ? source.selection : "" } : {}),
        ...(hasOwn(source, "clipboard") ? { clipboard: typeof source.clipboard === "string" ? source.clipboard : "" } : {}),
      },
      hasClipboardValue: hasOwn(source, "clipboard"),
    };
  }

  function mergeExecutionContext(
    base: FavoriteRunExecutionContextSnapshot,
    prepared: Partial<FavoriteRunExecutionContextSnapshot>
  ): FavoriteRunExecutionContextSnapshot {
    return {
      tabId: hasOwn(prepared, "tabId") ? prepared.tabId ?? null : base.tabId,
      windowId: hasOwn(prepared, "windowId") ? prepared.windowId ?? null : base.windowId,
      url: hasOwn(prepared, "url") ? prepared.url ?? "" : base.url,
      title: hasOwn(prepared, "title") ? prepared.title ?? "" : base.title,
      selection: hasOwn(prepared, "selection") ? prepared.selection ?? "" : base.selection,
      clipboard: hasOwn(prepared, "clipboard") ? prepared.clipboard ?? "" : base.clipboard,
    };
  }

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

  function buildScheduleAlarmName(favoriteId: string) {
    const normalizedFavoriteId =
      typeof favoriteId === "string" ? favoriteId.trim() : "";
    return normalizedFavoriteId ? `apb-schedule:${normalizedFavoriteId}` : "";
  }

  function parseScheduleAlarmFavoriteId(alarmName: string) {
    const normalizedAlarmName =
      typeof alarmName === "string" ? alarmName.trim() : "";
    return normalizedAlarmName.startsWith("apb-schedule:")
      ? alarmName.slice("apb-schedule:".length)
      : "";
  }

  function getFavoriteExecutionSteps(favorite: FavoritePrompt | null | undefined): ChainStep[] {
    const favoriteTargetSiteIds = normalizeSiteIdList(favorite?.sentTo);

    if (favorite?.mode === "chain" && Array.isArray(favorite.steps) && favorite.steps.length > 0) {
      return favorite.steps
        .filter((step) => typeof step?.text === "string" && step.text.trim())
        .map((step, index) => ({
          id:
            typeof step.id === "string" && step.id.trim()
              ? step.id.trim()
              : `step-${index + 1}`,
          text: step.text,
          delayMs: Math.max(0, Math.round(Number(step.delayMs) || 0)),
          targetSiteIds: (() => {
            const stepTargets = normalizeSiteIdList(step.targetSiteIds);
            return stepTargets.length > 0 ? stepTargets : favoriteTargetSiteIds;
          })(),
        }));
    }

    const text = typeof favorite?.text === "string" ? favorite.text : "";
    return [{
      id: `${favorite?.id ?? "favorite"}-single`,
      text,
      delayMs: 0,
      targetSiteIds: favoriteTargetSiteIds,
    }];
  }

  function getFavoriteTargetSiteIds(step: ChainStep) {
    return normalizeSiteIdList(step?.targetSiteIds);
  }

  function previewFavoriteText(favorite: FavoritePrompt | null | undefined) {
    const source = favorite?.mode === "chain"
      ? getFavoriteExecutionSteps(favorite)[0]?.text ?? favorite?.text ?? ""
      : favorite?.text ?? "";
    const collapsed = String(source ?? "").replace(/\s+/g, " ").trim();
    return collapsed.length > 80 ? `${collapsed.slice(0, 80)}...` : collapsed;
  }

  async function getExecutionTabContextFromSender(
    sender: chrome.runtime.MessageSender | undefined
  ): Promise<FavoriteRunExecutionContextSnapshot> {
    const senderTab = sender?.tab;
    if (senderTab && Number.isFinite(senderTab.id) && isInjectableTabUrl(senderTab.url ?? "")) {
      const senderTabId = Number(senderTab.id);
      await rememberNormalTab(senderTab).catch(() => null);
      return {
        tabId: senderTabId,
        windowId: Number.isFinite(senderTab.windowId) ? senderTab.windowId : null,
        url: typeof senderTab.url === "string" ? senderTab.url : "",
        title: typeof senderTab.title === "string" ? senderTab.title : "",
        selection: await getSelectedTextFromTab(senderTabId).catch(() => ""),
        clipboard: "",
      };
    }

    const activeTab = await getPreferredNormalActiveTab();
    if (!activeTab?.id || !isInjectableTabUrl(activeTab?.url ?? "")) {
      return createEmptyExecutionContext();
    }

    return {
      tabId: activeTab.id,
      windowId: Number.isFinite(activeTab.windowId) ? activeTab.windowId : null,
      url: typeof activeTab.url === "string" ? activeTab.url : "",
      title: typeof activeTab.title === "string" ? activeTab.title : "",
      selection: await getSelectedTextFromTab(activeTab.id).catch(() => ""),
      clipboard: "",
    };
  }

  function buildFavoriteUserDefaults(
    templateVariableCache: Record<string, string>,
    favorite: FavoritePrompt | null | undefined
  ) {
    return {
      ...(templateVariableCache ?? {}),
      ...((favorite?.templateDefaults && typeof favorite.templateDefaults === "object")
        ? favorite.templateDefaults
        : {}),
    };
  }

  function detectFavoriteExecutionBlockers(
    favorite: FavoritePrompt | null | undefined,
    executionContext: FavoriteRunExecutionContextSnapshot,
    templateVariableCache: Record<string, string>,
    trigger: FavoriteExecutionTrigger,
    options: {
      hasPreparedClipboardValue?: boolean;
    } = {}
  ): FavoriteExecutionValidationResult {
    const steps = getFavoriteExecutionSteps(favorite);
    const defaults = buildFavoriteUserDefaults(templateVariableCache, favorite);
    const scheduled = trigger === "scheduled";
    const contextAvailable = Boolean(
      executionContext.tabId !== null ||
      executionContext.windowId !== null ||
      executionContext.url ||
      executionContext.title ||
      executionContext.selection
    );

    for (const step of steps) {
      const targetSiteIds = getFavoriteTargetSiteIds(step);
      if (targetSiteIds.length === 0) {
        return {
          ok: false,
          reason: "missing_targets",
          message: getWorkflowMessage(
            "favorite_run_error_missing_targets",
            [],
            "Favorite does not have any target services.",
          ),
        };
      }

      const variables = detectTemplateVariables(step.text);
      const missingUserValues = variables
        .filter((variable) => variable.kind === "user")
        .map((variable) => variable.name)
        .filter((name) => !String(defaults[name] ?? "").trim());

      if (missingUserValues.length > 0) {
        return {
          ok: false,
          reason: "missing_template_values",
          message: getWorkflowMessage(
            "favorite_run_error_missing_template_values",
            [missingUserValues.join(", ")],
            `Missing template values: ${missingUserValues.join(", ")}`,
          ),
        };
      }

      const systemVariables = variables
        .filter((variable) => variable.kind === "system")
        .map((variable) => variable.name);

      if (scheduled) {
        const blocked = systemVariables.filter((name) =>
          SCHEDULED_VARIABLE_BLOCKLIST.has(name as typeof SYSTEM_TEMPLATE_VARIABLES.url)
        );
        if (blocked.length > 0) {
          return {
            ok: false,
            reason: "scheduled_unsupported_variable",
            message: getWorkflowMessage(
              "favorite_run_error_scheduled_unsupported_variable",
              [blocked.join(", ")],
              `Scheduled favorites cannot resolve ${blocked.join(", ")}.`,
            ),
          };
        }
      } else {
        if (
          systemVariables.includes(SYSTEM_TEMPLATE_VARIABLES.clipboard) &&
          !options.hasPreparedClipboardValue
        ) {
          return {
            ok: false,
            reason: "clipboard_unavailable",
            message: getWorkflowMessage(
              "favorite_run_error_clipboard_popup_required",
              [],
              "Clipboard-backed favorites need popup input.",
            ),
          };
        }

        const needsTabContext = systemVariables.some((name) =>
          name === SYSTEM_TEMPLATE_VARIABLES.url ||
          name === SYSTEM_TEMPLATE_VARIABLES.title ||
          name === SYSTEM_TEMPLATE_VARIABLES.selection
        );

        if (needsTabContext && !contextAvailable) {
          return {
            ok: false,
            reason: "tab_context_unavailable",
            message: getWorkflowMessage(
              "favorite_run_error_tab_context_unavailable",
              [],
              "Current tab context is unavailable for this favorite.",
            ),
          };
        }
      }
    }

    return {
      ok: true,
      steps,
      defaults,
    };
  }

  async function buildFavoriteStepPrompt(
    step: ChainStep,
    templateDefaults: Record<string, string>,
    executionContext: FavoriteRunExecutionContextSnapshot
  ) {
    const counter = await getBroadcastCounter().catch(() => 0);
    const values = {
      ...(templateDefaults ?? {}),
      ...buildSystemTemplateValues(new Date(), {
        extra: {
          url: executionContext.url ?? "",
          title: executionContext.title ?? "",
          selection: executionContext.selection ?? "",
          counter: String(Number(counter) + 1 || 1),
        },
      }),
      [SYSTEM_TEMPLATE_VARIABLES.clipboard]: executionContext.clipboard ?? "",
    };

    return renderTemplatePrompt(step.text, values);
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
    const existingJobs = await getFavoriteRunJobs();
    const dedupedJob = findFavoriteRunDedupedJob(existingJobs, favorite.id);

    if (dedupedJob) {
      return {
        ok: true,
        deduped: true,
        jobId: dedupedJob.jobId,
        message: getDedupedMessage(),
      };
    }

    const createdAt = nowIso();
    const job: FavoriteRunJobRecord = {
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

    await updateFavoriteRunJobs((jobs) => replaceFavoriteRunJob(jobs, job));
    await scheduleFavoriteJobAlarm(job.jobId);

    return {
      ok: true,
      deduped: false,
      jobId: job.jobId,
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
          requestedSiteIds: getFavoriteExecutionSteps(favorite)[0]?.targetSiteIds ?? favorite?.sentTo ?? [],
          text: getFavoriteExecutionSteps(favorite)[0]?.text ?? favorite?.text ?? "",
          trigger,
          chainRunId,
          chainStepIndex: favorite?.mode === "chain" ? 0 : null,
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

      const prompt = await buildFavoriteStepPrompt(
        step,
        job.templateDefaults,
        job.executionContext,
      );
      const targetSiteIds = normalizeSiteIdList(step.targetSiteIds);
      const response = await queueBroadcastRequest(
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
      if (lastBroadcast?.broadcastId === response.broadcastId && lastBroadcast.status !== "sending") {
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

  function computeNextScheduledAt(repeat: string, scheduledAt: string | null, now = new Date()) {
    const normalizedRepeat = typeof repeat === "string" ? repeat : "none";
    if (normalizedRepeat === "none") {
      return null;
    }

    const baseDate = Number.isFinite(Date.parse(String(scheduledAt ?? "")))
      ? new Date(String(scheduledAt))
      : new Date(now);
    const nextDate = new Date(baseDate);

    do {
      if (normalizedRepeat === "daily") {
        nextDate.setDate(nextDate.getDate() + 1);
      } else if (normalizedRepeat === "weekly") {
        nextDate.setDate(nextDate.getDate() + 7);
      } else {
        nextDate.setDate(nextDate.getDate() + 1);
        while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
          nextDate.setDate(nextDate.getDate() + 1);
        }
      }
    } while (nextDate.getTime() <= now.getTime());

    return nextDate.toISOString();
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
