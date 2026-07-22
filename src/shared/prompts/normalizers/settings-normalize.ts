import {
  DEFAULT_SETTINGS,
} from "../constants";
import type { AppSettings } from "../../types/models";
import {
  normalizeBoolean,
  normalizeHistoryLimit,
  normalizeSiteIdList,
  normalizeWaitMsMultiplier,
  safeObject,
} from "./primitives";
import {
  normalizeFavoriteSort,
  normalizeHistorySort,
} from "./enums";

export function normalizeSettings(value: unknown): AppSettings {
  const settings = safeObject(value);
  return {
    historyLimit: normalizeHistoryLimit(settings.historyLimit),
    autoClosePopup: normalizeBoolean(
      settings.autoClosePopup,
      DEFAULT_SETTINGS.autoClosePopup
    ),
    desktopNotifications: normalizeBoolean(
      settings.desktopNotifications,
      DEFAULT_SETTINGS.desktopNotifications
    ),
    reuseExistingTabs: normalizeBoolean(
      settings.reuseExistingTabs,
      DEFAULT_SETTINGS.reuseExistingTabs
    ),
    autoCaptureResponses: normalizeBoolean(
      settings.autoCaptureResponses,
      DEFAULT_SETTINGS.autoCaptureResponses
    ),
    waitMsMultiplier: normalizeWaitMsMultiplier(settings.waitMsMultiplier),
    historySort: normalizeHistorySort(settings.historySort),
    favoriteSort: normalizeFavoriteSort(settings.favoriteSort),
    siteOrder: normalizeSiteIdList(settings.siteOrder),
  };
}
