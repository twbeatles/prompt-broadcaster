import {
  getAppSettings,
  getPromptFavorites,
  getTemplateVariableCache,
  updateFavoritePrompt,
} from "../../../../shared/prompts";
import { enqueueUiToast, setPopupFavoriteIntent } from "../../../../shared/runtime-state";
import type {
  ChainStep,
  FavoriteExecutionTrigger,
  FavoritePrompt,
  FavoriteRunExecutionContextSnapshot,
} from "../../../../shared/types/models";
import { NOTIFICATION_ICON_PATH } from "../../../app/constants";
import {
  buildScheduleAlarmName,
  computeNextScheduledAt,
  parseScheduleAlarmFavoriteId,
} from "../../../favorites/schedules";

interface FavoriteWorkflowEntryPointDeps {
  getBroadcastTriggerLabel: (trigger: unknown) => FavoriteExecutionTrigger;
  openPopupWithPrompt: (prompt?: string) => Promise<void>;
  nowIso: () => string;
  buildChainRunId: () => string;
  getWorkflowMessage: (
    key: string,
    substitutions?: string[],
    fallback?: string,
  ) => string;
  previewFavoriteText: (favorite: FavoritePrompt) => string;
  getFavoriteExecutionSteps: (favorite: FavoritePrompt) => ChainStep[];
  detectFavoriteExecutionBlockers: (
    favorite: FavoritePrompt,
    executionContext: FavoriteRunExecutionContextSnapshot,
    templateVariableCache: Record<string, string>,
    trigger: FavoriteExecutionTrigger,
    options?: { hasPreparedClipboardValue?: boolean },
  ) => {
    ok: boolean;
    reason?: string;
    message?: string;
    defaults?: Record<string, string>;
    steps?: ChainStep[];
    failingStepIndex?: number | null;
    failingStepText?: string;
    failingStepTargetSiteIds?: string[];
  };
  createEmptyExecutionContext: () => FavoriteRunExecutionContextSnapshot;
  normalizePreparedExecutionContext: (
    input?: Partial<FavoriteRunExecutionContextSnapshot>,
  ) => {
    context: Partial<FavoriteRunExecutionContextSnapshot>;
    hasClipboardValue: boolean;
  };
  mergeExecutionContext: (
    base: FavoriteRunExecutionContextSnapshot,
    extra: Partial<FavoriteRunExecutionContextSnapshot>,
  ) => FavoriteRunExecutionContextSnapshot;
  getExecutionTabContextFromSender: (
    sender?: chrome.runtime.MessageSender,
  ) => Promise<FavoriteRunExecutionContextSnapshot>;
  queueFavoriteRunJob: (
    favorite: FavoritePrompt,
    trigger: FavoriteExecutionTrigger,
    executionContext: FavoriteRunExecutionContextSnapshot,
    steps: ChainStep[],
    defaults: Record<string, string>,
  ) => Promise<{
    ok: boolean;
    deduped: boolean;
    jobId: string;
    message: string;
  } | {
    ok: false;
    deduped: false;
    jobId: string;
    message: string;
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
}

export function createFavoriteWorkflowEntryPoints(
  deps: FavoriteWorkflowEntryPointDeps,
) {
  async function maybeCreateFavoriteFailureNotification(
    favorite: FavoritePrompt,
    message: string,
  ) {
    const settings = await getAppSettings().catch(() => null);
    if (!settings?.desktopNotifications) {
      return;
    }

    try {
      await chrome.notifications.create(`favorite-failure-${Date.now()}`, {
        type: "basic",
        iconUrl: chrome.runtime.getURL(NOTIFICATION_ICON_PATH),
        title:
          favorite?.title ||
          deps.getWorkflowMessage(
            "favorite_run_notification_title_skipped",
            [],
            "Favorite run skipped",
          ),
        message: String(
          message ??
            deps.getWorkflowMessage(
              "favorite_run_error_start_failed",
              [],
              "Favorite execution could not start.",
            ),
        ),
      });
    } catch (error) {
      console.error(
        "[AI Prompt Broadcaster] Failed to create favorite failure notification.",
        error,
      );
    }
  }

  async function storePopupFavoriteIntentAndOpen(
    favoriteId: string,
    type: "edit" | "run",
    source: FavoriteExecutionTrigger | "options-edit",
    reason = "",
  ) {
    await setPopupFavoriteIntent({
      type,
      favoriteId,
      source,
      reason,
      createdAt: deps.nowIso(),
    });
    await deps.openPopupWithPrompt("");
  }

  async function enqueueFavoriteRun(
    favorite: FavoritePrompt,
    options: {
      trigger: FavoriteExecutionTrigger;
      sender?: chrome.runtime.MessageSender;
      allowPopupFallback?: boolean;
      preparedExecutionContext?: Partial<FavoriteRunExecutionContextSnapshot>;
    },
  ) {
    const trigger = deps.getBroadcastTriggerLabel(options.trigger);
    const preparedExecutionContext = deps.normalizePreparedExecutionContext(
      options.preparedExecutionContext,
    );
    const baseExecutionContext =
      trigger === "scheduled"
        ? deps.createEmptyExecutionContext()
        : await deps.getExecutionTabContextFromSender(options.sender);
    const executionContext = deps.mergeExecutionContext(
      baseExecutionContext,
      preparedExecutionContext.context,
    );
    const templateVariableCache = await getTemplateVariableCache().catch(() => ({}));
    const validation = deps.detectFavoriteExecutionBlockers(
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
        const chainRunId = favorite?.mode === "chain" ? deps.buildChainRunId() : null;
        await deps.createFavoriteFailureHistory({
          favoriteId: favorite?.id ?? null,
          message: validation.message,
          requestedSiteIds:
            validation.failingStepTargetSiteIds ??
            deps.getFavoriteExecutionSteps(favorite)[0]?.targetSiteIds ??
            favorite?.sentTo ??
            [],
          text:
            validation.failingStepText ??
            deps.getFavoriteExecutionSteps(favorite)[0]?.text ??
            favorite?.text ??
            "",
          trigger,
          chainRunId,
          chainStepIndex:
            favorite?.mode === "chain" ? validation.failingStepIndex ?? 0 : null,
          chainStepCount:
            favorite?.mode === "chain"
              ? deps.getFavoriteExecutionSteps(favorite).length
              : null,
        });
        await enqueueUiToast({
          message:
            validation.message ??
            deps.getWorkflowMessage(
              "favorite_run_error_start_failed",
              [],
              "Favorite execution could not start.",
            ),
          type: "warning",
          duration: 5000,
        });
        await maybeCreateFavoriteFailureNotification(
          favorite,
          validation.message ??
            deps.getWorkflowMessage(
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

    return deps.queueFavoriteRunJob(
      favorite,
      trigger,
      executionContext,
      validation.steps ?? [],
      validation.defaults ?? {},
    );
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
      console.error(
        "[AI Prompt Broadcaster] Failed to reconcile favorite schedules.",
        error,
      );
    }
  }

  async function handleFavoriteScheduleAlarm(favoriteId: string) {
    const favorites = await getPromptFavorites();
    const favorite = favorites.find(
      (entry) => String(entry.id) === String(favoriteId),
    );
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
        scheduledAt: computeNextScheduledAt(
          favorite.scheduleRepeat,
          favorite.scheduledAt,
          new Date(),
        ),
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
    sender: chrome.runtime.MessageSender,
  ) {
    const favoriteId =
      typeof message?.favoriteId === "string" ? message.favoriteId.trim() : "";
    if (!favoriteId) {
      return {
        ok: false,
        error: deps.getWorkflowMessage(
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
        error: deps.getWorkflowMessage(
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
      reason:
        ("reason" in execution ? execution.reason : "popup_fallback") ??
        "popup_fallback",
    };
  }

  async function handleFavoriteOpenEditorMessage(message: {
    favoriteId?: string;
    source?: "options-edit" | "popup";
  }) {
    const favoriteId =
      typeof message?.favoriteId === "string" ? message.favoriteId.trim() : "";
    if (!favoriteId) {
      return {
        ok: false,
        error: deps.getWorkflowMessage(
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
        title: favorite.title || deps.previewFavoriteText(favorite),
        text: favorite.text ?? "",
        preview: deps.previewFavoriteText(favorite),
        mode: favorite.mode === "chain" ? "chain" : "single",
        tags: Array.isArray(favorite.tags) ? favorite.tags : [],
        folder: favorite.folder ?? "",
      })),
    };
  }

  async function handleQuickPaletteExecuteMessage(
    message: { favoriteId?: string },
    sender: chrome.runtime.MessageSender,
  ) {
    return handleFavoriteRunMessage(
      {
        favoriteId: message?.favoriteId,
        trigger: "palette",
        allowPopupFallback: true,
      },
      sender,
    );
  }

  return {
    reconcileFavoriteSchedules,
    handleFavoriteScheduleAlarm,
    handleFavoriteRunMessage,
    handleFavoriteOpenEditorMessage,
    handleQuickPaletteGetState,
    handleQuickPaletteExecuteMessage,
  };
}
