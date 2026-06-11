import type { AppSettings } from "../types/models";

export const LOCAL_STORAGE_KEYS = Object.freeze({
  history: "promptHistory",
  favorites: "promptFavorites",
  templateVariableCache: "templateVariableCache",
  settings: "appSettings",
  broadcastCounter: "broadcastCounter",
  comparisonNotes: "comparisonNotes",
  promptExperiments: "promptExperiments",
  templatePacks: "templatePacks",
  serviceGroups: "serviceGroups",
});

export const DEFAULT_HISTORY_LIMIT = 50;
export const MIN_HISTORY_LIMIT = 10;
export const MAX_HISTORY_LIMIT = 200;
export const MAX_STORED_PROMPT_HISTORY = 1000;
export const EMERGENCY_STORED_PROMPT_HISTORY = 500;
export const MAX_STORED_COMPARISON_NOTES = 2000;
export const EMERGENCY_STORED_COMPARISON_NOTES = 1000;
export const MAX_AUTO_CAPTURED_RESPONSE_LENGTH = 20000;
export const MIN_WAIT_MS_MULTIPLIER = 0.5;
export const MAX_WAIT_MS_MULTIPLIER = 3.0;
export const DEFAULT_WAIT_MS_MULTIPLIER = 1.0;
export const DEFAULT_HISTORY_SORT = "latest";
export const DEFAULT_FAVORITE_SORT = "recentUsed";
export const DEFAULT_FAVORITE_MODE = "single";
export const DEFAULT_SCHEDULE_REPEAT = "none";
export const EXPERIMENT_SOFT_BROADCAST_LIMIT = 10;
export const EXPERIMENT_HARD_BROADCAST_LIMIT = 30;
export const DEFAULT_SETTINGS = Object.freeze({
  historyLimit: DEFAULT_HISTORY_LIMIT,
  autoClosePopup: false,
  desktopNotifications: true,
  reuseExistingTabs: true,
  autoCaptureResponses: true,
  waitMsMultiplier: DEFAULT_WAIT_MS_MULTIPLIER,
  historySort: DEFAULT_HISTORY_SORT,
  favoriteSort: DEFAULT_FAVORITE_SORT,
  siteOrder: [],
}) as Readonly<AppSettings>;
