import {
  getPromptFavorites,
  updateFavoritePrompt,
} from "../../../../shared/prompts";
import {
  buildScheduleAlarmName,
  computeNextScheduledAt,
  parseScheduleAlarmFavoriteId,
} from "../../../favorites/schedules";
import type { EnqueueFavoriteRun } from "./enqueue";

export interface FavoriteScheduleHandlerDeps {
  enqueueFavoriteRun: EnqueueFavoriteRun;
}

export function createFavoriteScheduleHandlers(
  deps: FavoriteScheduleHandlerDeps,
) {
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

    await deps.enqueueFavoriteRun(favorite, {
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

  return {
    reconcileFavoriteSchedules,
    handleFavoriteScheduleAlarm,
  };
}
