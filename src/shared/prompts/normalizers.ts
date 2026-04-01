import {
  DEFAULT_HISTORY_LIMIT,
  DEFAULT_SETTINGS,
  MAX_HISTORY_LIMIT,
  MIN_HISTORY_LIMIT,
} from "./constants";
import type { AppSettings } from "../types/models";

export function safeText(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function safeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeSentTo(sentTo: unknown) {
  return Array.from(
    new Set(
      safeArray(sentTo).flatMap((entry) =>
        typeof entry === "string" && entry.trim() ? [entry.trim()] : []
      )
    )
  );
}

export function normalizeSiteIdList(value: unknown) {
  return normalizeSentTo(value);
}

export function normalizeIsoDate(value: unknown, fallback = new Date().toISOString()) {
  if (typeof value !== "string") {
    return fallback;
  }

  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

export function normalizeTemplateDefaults(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entryValue]) => [safeText(key).trim(), safeText(entryValue)])
      .filter(([key]) => key)
  );
}

export function normalizeBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeHistoryLimit(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_HISTORY_LIMIT;
  }

  return Math.min(
    MAX_HISTORY_LIMIT,
    Math.max(MIN_HISTORY_LIMIT, Math.round(numericValue))
  );
}

export function normalizeBroadcastCounter(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.round(numericValue));
}

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
  };
}

export function normalizeStatus(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "submitted";
}

export function normalizeStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entryValue]) => [safeText(key).trim(), safeText(entryValue).trim()])
      .filter(([key, entryValue]) => key && entryValue)
  );
}

export function sortByDateDesc<T>(items: T[], field = "createdAt") {
  return [...items].sort((left, right) => {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftTime = Date.parse(String(leftRecord[field] ?? "")) || 0;
    const rightTime = Date.parse(String(rightRecord[field] ?? "")) || 0;
    return rightTime - leftTime;
  });
}

export function ensureUniqueNumericId<T extends { id?: unknown }>(items: T[], preferredId: number) {
  let candidate = Number.isFinite(preferredId) ? preferredId : Date.now();
  const usedIds = new Set(items.map((item) => Number(item.id)));

  while (usedIds.has(candidate)) {
    candidate += 1;
  }

  return candidate;
}

export function ensureUniqueStringId<T extends { id?: unknown }>(items: T[], preferredId: unknown) {
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

export function normalizeTags(value: unknown) {
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
