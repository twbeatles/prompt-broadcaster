import { createFavoriteRunEnqueue } from "./enqueue";
import { createFavoriteRunMessageHandlers } from "./messages";
import { createFavoriteFailureNotifications } from "./notifications";
import { createQuickPaletteHandlers } from "./palette";
import { createFavoriteScheduleHandlers } from "./schedules";
import type { FavoriteWorkflowEntryPointDeps } from "./types";

export function createFavoriteWorkflowEntryPoints(
  deps: FavoriteWorkflowEntryPointDeps,
) {
  const notifications = createFavoriteFailureNotifications(deps);
  const enqueue = createFavoriteRunEnqueue({
    ...deps,
    maybeCreateFavoriteFailureNotification:
      notifications.maybeCreateFavoriteFailureNotification,
  });
  const schedules = createFavoriteScheduleHandlers({
    ...deps,
    enqueueFavoriteRun: enqueue.enqueueFavoriteRun,
  });
  const messages = createFavoriteRunMessageHandlers({
    ...deps,
    enqueueFavoriteRun: enqueue.enqueueFavoriteRun,
    storePopupFavoriteIntentAndOpen: enqueue.storePopupFavoriteIntentAndOpen,
  });
  const palette = createQuickPaletteHandlers({
    ...deps,
    handleFavoriteRunMessage: messages.handleFavoriteRunMessage,
  });

  return {
    reconcileFavoriteSchedules: schedules.reconcileFavoriteSchedules,
    handleFavoriteScheduleAlarm: schedules.handleFavoriteScheduleAlarm,
    handleFavoriteRunMessage: messages.handleFavoriteRunMessage,
    handleFavoriteOpenEditorMessage: messages.handleFavoriteOpenEditorMessage,
    handleQuickPaletteGetState: palette.handleQuickPaletteGetState,
    handleQuickPaletteExecuteMessage: palette.handleQuickPaletteExecuteMessage,
  };
}
