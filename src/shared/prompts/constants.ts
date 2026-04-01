// @ts-nocheck
export const LOCAL_STORAGE_KEYS = Object.freeze({
  history: "promptHistory",
  favorites: "promptFavorites",
  templateVariableCache: "templateVariableCache",
  settings: "appSettings",
  broadcastCounter: "broadcastCounter",
});

export const DEFAULT_HISTORY_LIMIT = 50;
export const MIN_HISTORY_LIMIT = 10;
export const MAX_HISTORY_LIMIT = 200;
export const DEFAULT_SETTINGS = Object.freeze({
  historyLimit: DEFAULT_HISTORY_LIMIT,
  autoClosePopup: false,
  desktopNotifications: true,
  reuseExistingTabs: true,
});
