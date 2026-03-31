// @ts-nocheck
import {
  DEFAULT_HISTORY_LIMIT,
  DEFAULT_SETTINGS,
  MAX_HISTORY_LIMIT,
  MIN_HISTORY_LIMIT,
} from "./constants";

export function safeText(value) {
  return typeof value === "string" ? value : "";
}

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function normalizeSentTo(sentTo) {
  return Array.from(
    new Set(
      safeArray(sentTo)
        .filter((entry) => typeof entry === "string" && entry.trim())
        .map((entry) => entry.trim())
    )
  );
}

export function normalizeSiteIdList(value) {
  return normalizeSentTo(value);
}

export function normalizeIsoDate(value, fallback = new Date().toISOString()) {
  if (typeof value !== "string") {
    return fallback;
  }

  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

export function normalizeTemplateDefaults(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entryValue]) => [safeText(key).trim(), safeText(entryValue)])
      .filter(([key]) => key)
  );
}

export function normalizeBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeHistoryLimit(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_HISTORY_LIMIT;
  }

  return Math.min(
    MAX_HISTORY_LIMIT,
    Math.max(MIN_HISTORY_LIMIT, Math.round(numericValue))
  );
}

export function normalizeSettings(value) {
  return {
    historyLimit: normalizeHistoryLimit(value?.historyLimit),
    autoClosePopup: normalizeBoolean(
      value?.autoClosePopup,
      DEFAULT_SETTINGS.autoClosePopup
    ),
    desktopNotifications: normalizeBoolean(
      value?.desktopNotifications,
      DEFAULT_SETTINGS.desktopNotifications
    ),
    reuseExistingTabs: normalizeBoolean(
      value?.reuseExistingTabs,
      DEFAULT_SETTINGS.reuseExistingTabs
    ),
  };
}

export function normalizeStatus(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "submitted";
}

export function normalizeStringRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entryValue]) => [safeText(key).trim(), safeText(entryValue).trim()])
      .filter(([key, entryValue]) => key && entryValue)
  );
}

export function sortByDateDesc(items, field = "createdAt") {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left[field] ?? "") || 0;
    const rightTime = Date.parse(right[field] ?? "") || 0;
    return rightTime - leftTime;
  });
}

export function ensureUniqueNumericId(items, preferredId) {
  let candidate = Number.isFinite(preferredId) ? preferredId : Date.now();
  const usedIds = new Set(items.map((item) => Number(item.id)));

  while (usedIds.has(candidate)) {
    candidate += 1;
  }

  return candidate;
}

export function ensureUniqueStringId(items, preferredId) {
  let candidate =
    typeof preferredId === "string" && preferredId.trim()
      ? preferredId.trim()
      : `fav-${Date.now()}`;
  const usedIds = new Set(items.map((item) => String(item.id)));

  while (usedIds.has(candidate)) {
    candidate = `${candidate}-1`;
  }

  return candidate;
}

export function normalizeTags(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .map((tag) => safeText(tag).trim())
        .filter((tag) => tag.length > 0 && tag.length <= 30)
    )
  ).slice(0, 10);
}
