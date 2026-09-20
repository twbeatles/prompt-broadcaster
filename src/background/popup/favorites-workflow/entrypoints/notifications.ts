import { getAppSettings } from "../../../../shared/prompts";
import type { FavoritePrompt } from "../../../../shared/types/models";
import { NOTIFICATION_ICON_PATH } from "../../../app/constants";
import type { FavoriteWorkflowEntryPointDeps } from "./types";

export interface FavoriteFailureNotificationDeps
  extends Pick<FavoriteWorkflowEntryPointDeps, "getWorkflowMessage"> {}

export type MaybeCreateFavoriteFailureNotification = (
  favorite: FavoritePrompt,
  message: string,
) => Promise<void>;

export function createFavoriteFailureNotifications(
  deps: FavoriteFailureNotificationDeps,
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

  return {
    maybeCreateFavoriteFailureNotification,
  };
}
