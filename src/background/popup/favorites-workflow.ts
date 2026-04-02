// @ts-nocheck
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
  setPopupFavoriteIntent,
} from "../../shared/runtime-state";
import { NOTIFICATION_ICON_PATH } from "../app/constants";
import { buildSiteResult } from "../app/injection-helpers";

const SCHEDULED_VARIABLE_BLOCKLIST = new Set([
  SYSTEM_TEMPLATE_VARIABLES.url,
  SYSTEM_TEMPLATE_VARIABLES.title,
  SYSTEM_TEMPLATE_VARIABLES.selection,
  SYSTEM_TEMPLATE_VARIABLES.clipboard,
]);

export function createFavoriteWorkflow(deps) {
  const {
    getBroadcastTriggerLabel,
    rememberNormalTab,
    getPreferredNormalActiveTab,
    isInjectableTabUrl,
    getSelectedTextFromTab,
    openPopupWithPrompt,
    nowIso,
    sleep,
    buildChainRunId,
    queueBroadcastRequest,
    registerBroadcastCompletionWaiter,
  } = deps;

  function buildScheduleAlarmName(favoriteId) {
    const normalizedFavoriteId =
      typeof favoriteId === "string" ? favoriteId.trim() : "";
    return normalizedFavoriteId ? `apb-schedule:${normalizedFavoriteId}` : "";
  }

  function parseScheduleAlarmFavoriteId(alarmName) {
    const normalizedAlarmName =
      typeof alarmName === "string" ? alarmName.trim() : "";
    return normalizedAlarmName.startsWith("apb-schedule:")
      ? alarmName.slice("apb-schedule:".length)
      : "";
  }

  function getFavoriteExecutionSteps(favorite) {
    if (favorite?.mode === "chain" && Array.isArray(favorite?.steps) && favorite.steps.length > 0) {
      return favorite.steps
        .filter((step) => typeof step?.text === "string" && step.text.trim())
        .map((step, index) => ({
          id: typeof step.id === "string" && step.id.trim()
            ? step.id.trim()
            : `step-${index + 1}`,
          text: step.text,
          delayMs: Math.max(0, Math.round(Number(step.delayMs) || 0)),
          targetSiteIds: normalizeSiteIdList(step.targetSiteIds),
        }));
    }

    const text = typeof favorite?.text === "string" ? favorite.text : "";
    return [{
      id: `${favorite?.id ?? "favorite"}-single`,
      text,
      delayMs: 0,
      targetSiteIds: normalizeSiteIdList(favorite?.sentTo),
    }];
  }

  function getFavoriteTargetSiteIds(favorite, step) {
    const stepTargets = normalizeSiteIdList(step?.targetSiteIds);
    if (stepTargets.length > 0) {
      return stepTargets;
    }

    return normalizeSiteIdList(favorite?.sentTo);
  }

  function previewFavoriteText(favorite) {
    const source = favorite?.mode === "chain"
      ? getFavoriteExecutionSteps(favorite)[0]?.text ?? favorite?.text ?? ""
      : favorite?.text ?? "";
    const collapsed = String(source ?? "").replace(/\s+/g, " ").trim();
    return collapsed.length > 80 ? `${collapsed.slice(0, 80)}...` : collapsed;
  }

  async function getExecutionTabContextFromSender(sender) {
    if (Number.isFinite(sender?.tab?.id) && isInjectableTabUrl(sender?.tab?.url ?? "")) {
      await rememberNormalTab(sender.tab).catch(() => null);
      return {
        tabId: sender.tab.id,
        windowId: Number.isFinite(sender?.tab?.windowId) ? sender.tab.windowId : null,
        url: typeof sender?.tab?.url === "string" ? sender.tab.url : "",
        title: typeof sender?.tab?.title === "string" ? sender.tab.title : "",
        selection: await getSelectedTextFromTab(sender.tab.id).catch(() => ""),
      };
    }

    const activeTab = await getPreferredNormalActiveTab();
    if (!activeTab?.id || !isInjectableTabUrl(activeTab?.url ?? "")) {
      return {
        tabId: null,
        windowId: null,
        url: "",
        title: "",
        selection: "",
      };
    }

    return {
      tabId: activeTab.id,
      windowId: Number.isFinite(activeTab.windowId) ? activeTab.windowId : null,
      url: typeof activeTab.url === "string" ? activeTab.url : "",
      title: typeof activeTab.title === "string" ? activeTab.title : "",
      selection: await getSelectedTextFromTab(activeTab.id).catch(() => ""),
    };
  }

  function buildFavoriteUserDefaults(templateVariableCache, favorite) {
    return {
      ...(templateVariableCache ?? {}),
      ...((favorite?.templateDefaults && typeof favorite.templateDefaults === "object")
        ? favorite.templateDefaults
        : {}),
    };
  }

  function detectFavoriteExecutionBlockers(favorite, executionContext, templateVariableCache, trigger) {
    const steps = getFavoriteExecutionSteps(favorite);
    const defaults = buildFavoriteUserDefaults(templateVariableCache, favorite);
    const scheduled = trigger === "scheduled";
    const contextAvailable = Boolean(executionContext?.url || executionContext?.title || executionContext?.selection);

    for (const step of steps) {
      const targetSiteIds = getFavoriteTargetSiteIds(favorite, step);
      if (targetSiteIds.length === 0) {
        return {
          ok: false,
          reason: "missing_targets",
          message: "Favorite does not have any target services.",
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
          message: `Missing template values: ${missingUserValues.join(", ")}`,
        };
      }

      const systemVariables = variables
        .filter((variable) => variable.kind === "system")
        .map((variable) => variable.name);

      if (scheduled) {
        const blocked = systemVariables.filter((name) => SCHEDULED_VARIABLE_BLOCKLIST.has(name));
        if (blocked.length > 0) {
          return {
            ok: false,
            reason: "scheduled_unsupported_variable",
            message: `Scheduled favorites cannot resolve ${blocked.join(", ")}.`,
          };
        }
      } else {
        if (systemVariables.includes(SYSTEM_TEMPLATE_VARIABLES.clipboard)) {
          return {
            ok: false,
            reason: "clipboard_unavailable",
            message: "Clipboard-backed favorites need popup input.",
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
            message: "Current tab context is unavailable for this favorite.",
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

  async function buildFavoriteStepPrompt(step, favorite, executionContext, templateVariableCache) {
    const counter = await getBroadcastCounter().catch(() => 0);
    const values = {
      ...buildFavoriteUserDefaults(templateVariableCache, favorite),
      ...buildSystemTemplateValues(new Date(), {
        extra: {
          url: executionContext?.url ?? "",
          title: executionContext?.title ?? "",
          selection: executionContext?.selection ?? "",
          counter: String(Number(counter) + 1 || 1),
        },
      }),
    };

    return renderTemplatePrompt(step.text, values);
  }

  async function createFavoriteFailureHistory(favorite, details = {}) {
    const requestedSiteIds = normalizeSiteIdList(
      details.requestedSiteIds ?? favorite?.sentTo ?? [],
    );
    const siteResults = Object.fromEntries(
      requestedSiteIds.map((siteId) => [
        siteId,
        buildSiteResult("unexpected_error", {
          message: details.message || "Favorite execution could not start.",
        }),
      ]),
    );

    await appendPromptHistory({
      id: Date.now(),
      text: details.text ?? favorite?.text ?? "",
      requestedSiteIds,
      submittedSiteIds: [],
      failedSiteIds: requestedSiteIds,
      sentTo: [],
      createdAt: nowIso(),
      status: "failed",
      siteResults,
      originFavoriteId: favorite?.id ?? null,
      chainRunId: details.chainRunId ?? null,
      chainStepIndex: details.chainStepIndex ?? null,
      chainStepCount: details.chainStepCount ?? null,
      trigger: details.trigger ?? "scheduled",
    });
  }

  async function maybeCreateFavoriteFailureNotification(favorite, message) {
    const settings = await getAppSettings().catch(() => null);
    if (!settings?.desktopNotifications) {
      return;
    }

    try {
      await chrome.notifications.create(`favorite-failure-${Date.now()}`, {
        type: "basic",
        iconUrl: chrome.runtime.getURL(NOTIFICATION_ICON_PATH),
        title: favorite?.title || favorite?.name || "Favorite run skipped",
        message: String(message ?? "Favorite execution could not start."),
      });
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to create favorite failure notification.", error);
    }
  }

  async function storePopupFavoriteIntentAndOpen(favoriteId, type, source, reason = "") {
    await setPopupFavoriteIntent({
      type,
      favoriteId,
      source,
      reason,
      createdAt: nowIso(),
    });
    await openPopupWithPrompt("");
  }

  async function executeFavoriteWorkflow(favorite, options = {}) {
    const trigger = getBroadcastTriggerLabel(options.trigger);
    const executionContext = trigger === "scheduled"
      ? { tabId: null, windowId: null, url: "", title: "", selection: "" }
      : await getExecutionTabContextFromSender(options.sender);
    const templateVariableCache = await getTemplateVariableCache().catch(() => ({}));
    const validation = detectFavoriteExecutionBlockers(
      favorite,
      executionContext,
      templateVariableCache,
      trigger,
    );

    if (!validation.ok) {
      if (trigger === "scheduled") {
        const chainRunId = favorite?.mode === "chain" ? buildChainRunId() : null;
        await createFavoriteFailureHistory(favorite, {
          message: validation.message,
          trigger,
          chainRunId,
          chainStepIndex: favorite?.mode === "chain" ? 0 : null,
          chainStepCount: favorite?.mode === "chain" ? getFavoriteExecutionSteps(favorite).length : null,
        });
        await enqueueUiToast({
          message: validation.message,
          type: "warning",
          duration: 5000,
        });
        await maybeCreateFavoriteFailureNotification(favorite, validation.message);
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

    const steps = validation.steps;
    const chainRunId = favorite?.mode === "chain" ? buildChainRunId() : null;
    let lastSummary = null;
    let lastResponse = null;
    let usageMarked = false;

    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      if (index > 0 && Number(step.delayMs) > 0) {
        await sleep(Number(step.delayMs));
      }

      const prompt = await buildFavoriteStepPrompt(
        step,
        favorite,
        executionContext,
        templateVariableCache,
      );
      const targetSiteIds = getFavoriteTargetSiteIds(favorite, step);
      const response = await queueBroadcastRequest(
        prompt,
        targetSiteIds.map((siteId) => ({ id: siteId })),
        {
          originFavoriteId: favorite?.id ?? null,
          chainRunId,
          chainStepIndex: favorite?.mode === "chain" ? index : null,
          chainStepCount: favorite?.mode === "chain" ? steps.length : null,
          trigger,
        },
      );

      lastResponse = response;

      if (!response?.ok || !response?.broadcastId) {
        return {
          ok: false,
          reason: response?.error ? "queue_failed" : "broadcast_failed",
          error: response?.error ?? "Favorite execution could not be queued.",
          response,
        };
      }

      if (!usageMarked) {
        usageMarked = true;
        await markFavoriteUsed(favorite?.id).catch((error) => {
          console.error("[AI Prompt Broadcaster] Failed to mark favorite usage.", error);
        });
      }

      if (favorite?.mode !== "chain") {
        return {
          ok: true,
          response,
          broadcastId: response.broadcastId,
        };
      }

      const summary = await registerBroadcastCompletionWaiter(response.broadcastId);
      lastSummary = summary;

      if (!summary || summary.status !== "submitted") {
        return {
          ok: false,
          reason: "chain_step_failed",
          response,
          summary,
          failedStepIndex: index,
        };
      }
    }

    return {
      ok: true,
      response: lastResponse,
      summary: lastSummary,
      chainRunId,
    };
  }

  function computeNextScheduledAt(repeat, scheduledAt, now = new Date()) {
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
      const desiredAlarms = new Map();

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

  async function handleFavoriteScheduleAlarm(favoriteId) {
      const favorites = await getPromptFavorites();
      const favorite = favorites.find((entry) => String(entry.id) === String(favoriteId));
      const alarmName = buildScheduleAlarmName(favoriteId);

      if (!favorite?.scheduleEnabled) {
        if (alarmName) {
          await chrome.alarms.clear(alarmName).catch(() => false);
        }
        return;
      }

      await executeFavoriteWorkflow(favorite, {
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

  async function handleFavoriteRunMessage(message, sender) {
      const favoriteId = typeof message?.favoriteId === "string" ? message.favoriteId.trim() : "";
      if (!favoriteId) {
        return { ok: false, error: "Favorite id is required." };
      }

      const favorites = await getPromptFavorites();
      const favorite = favorites.find((entry) => String(entry.id) === favoriteId);
      if (!favorite) {
        return { ok: false, error: "Favorite not found." };
      }

      const execution = await executeFavoriteWorkflow(favorite, {
        trigger: message?.trigger ?? "popup",
        sender,
        allowPopupFallback: message?.allowPopupFallback !== false,
      });

      if (execution?.ok) {
        return execution;
      }

      if (!execution?.requiresPopupInput || message?.allowPopupFallback === false) {
        return execution;
      }

      await storePopupFavoriteIntentAndOpen(
        favoriteId,
        "run",
        message?.trigger ?? "popup",
        execution?.error ?? "",
      );

      return {
        ok: true,
        popupFallback: true,
        reason: execution?.reason ?? "popup_fallback",
      };
    }

  async function handleFavoriteOpenEditorMessage(message) {
      const favoriteId = typeof message?.favoriteId === "string" ? message.favoriteId.trim() : "";
      if (!favoriteId) {
        return { ok: false, error: "Favorite id is required." };
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
          preview: previewFavoriteText(favorite),
          mode: favorite.mode === "chain" ? "chain" : "single",
          tags: Array.isArray(favorite.tags) ? favorite.tags : [],
          folder: favorite.folder ?? "",
        })),
      };
    }

  async function handleQuickPaletteExecuteMessage(message, sender) {
      return handleFavoriteRunMessage({
        action: "favorite:run",
        favoriteId: message?.favoriteId,
        trigger: "palette",
        allowPopupFallback: true,
      }, sender);
    }

  return {
    buildScheduleAlarmName,
    parseScheduleAlarmFavoriteId,
    getFavoriteExecutionSteps,
    getFavoriteTargetSiteIds,
    previewFavoriteText,
    executeFavoriteWorkflow,
    reconcileFavoriteSchedules,
    handleFavoriteScheduleAlarm,
    handleFavoriteRunMessage,
    handleFavoriteOpenEditorMessage,
    handleQuickPaletteGetState,
    handleQuickPaletteExecuteMessage,
  };
}
