import {
  DEFAULT_FAVORITE_SORT,
  DEFAULT_HISTORY_LIMIT,
  DEFAULT_HISTORY_SORT,
  DEFAULT_SETTINGS,
  DEFAULT_WAIT_MS_MULTIPLIER,
  MAX_HISTORY_LIMIT,
  MAX_WAIT_MS_MULTIPLIER,
  MIN_HISTORY_LIMIT,
  MIN_WAIT_MS_MULTIPLIER,
} from "./constants";
import type {
  AppSettings,
  FavoriteSort,
  HistorySort,
  InjectionResultCode,
  SiteInjectionResult,
} from "../types/models";

const VALID_HISTORY_SORTS = new Set<HistorySort>([
  "latest",
  "oldest",
  "mostSuccess",
  "mostFailure",
]);

const VALID_FAVORITE_SORTS = new Set<FavoriteSort>([
  "recentUsed",
  "usageCount",
  "title",
  "createdAt",
]);

const VALID_RESULT_CODES = new Set<InjectionResultCode>([
  "submitted",
  "selector_timeout",
  "auth_required",
  "submit_failed",
  "strategy_exhausted",
  "permission_denied",
  "tab_create_failed",
  "tab_closed",
  "injection_timeout",
  "cancelled",
  "unexpected_error",
]);

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

export function normalizeNullableIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
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

export function normalizeWaitMsMultiplier(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_WAIT_MS_MULTIPLIER;
  }

  const clamped = Math.min(
    MAX_WAIT_MS_MULTIPLIER,
    Math.max(MIN_WAIT_MS_MULTIPLIER, numericValue)
  );

  return Math.round(clamped * 10) / 10;
}

export function normalizeHistorySort(value: unknown): HistorySort {
  return VALID_HISTORY_SORTS.has(value as HistorySort)
    ? (value as HistorySort)
    : DEFAULT_HISTORY_SORT;
}

export function normalizeFavoriteSort(value: unknown): FavoriteSort {
  return VALID_FAVORITE_SORTS.has(value as FavoriteSort)
    ? (value as FavoriteSort)
    : DEFAULT_FAVORITE_SORT;
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
    waitMsMultiplier: normalizeWaitMsMultiplier(settings.waitMsMultiplier),
    historySort: normalizeHistorySort(settings.historySort),
    favoriteSort: normalizeFavoriteSort(settings.favoriteSort),
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

export function normalizeResultCode(value: unknown): InjectionResultCode {
  const normalized = safeText(value).trim();
  if (VALID_RESULT_CODES.has(normalized as InjectionResultCode)) {
    return normalized as InjectionResultCode;
  }

  switch (normalized) {
    case "submitted":
      return "submitted";
    case "selector_failed":
      return "selector_timeout";
    case "login_required":
    case "redirected_or_login_required":
      return "auth_required";
    case "submit_failed":
      return "submit_failed";
    case "fallback_required":
      return "strategy_exhausted";
    case "permission_denied":
      return "permission_denied";
    case "tab_create_failed":
      return "tab_create_failed";
    case "tab_closed":
      return "tab_closed";
    case "injection_timeout":
    case "broadcast_stale":
      return "injection_timeout";
    case "cancelled":
    case "reset":
      return "cancelled";
    case "failed":
    case "injection_failed":
    default:
      return "unexpected_error";
  }
}

export function buildSiteInjectionResult(
  code: unknown,
  overrides: Partial<SiteInjectionResult> = {}
): SiteInjectionResult {
  const normalizedCode = normalizeResultCode(code);
  const result: SiteInjectionResult = {
    code: normalizedCode,
  };

  if (typeof overrides.message === "string" && overrides.message.trim()) {
    result.message = overrides.message.trim();
  }

  if (typeof overrides.strategy === "string" && overrides.strategy.trim()) {
    result.strategy = overrides.strategy.trim();
  }

  if (Number.isFinite(Number(overrides.elapsedMs))) {
    result.elapsedMs = Number(overrides.elapsedMs);
  }

  if (Array.isArray(overrides.attempts) && overrides.attempts.length > 0) {
    result.attempts = overrides.attempts
      .map((attempt) => ({
        name: safeText(attempt?.name).trim(),
        success: Boolean(attempt?.success),
      }))
      .filter((attempt) => attempt.name);
  }

  return result;
}

export function normalizeSiteInjectionResult(value: unknown): SiteInjectionResult {
  if (typeof value === "string") {
    return buildSiteInjectionResult(value);
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return buildSiteInjectionResult("unexpected_error");
  }

  const source = value as Record<string, unknown>;
  return buildSiteInjectionResult(source.code ?? source.status, {
    message: safeText(source.message).trim(),
    strategy: safeText(source.strategy).trim(),
    elapsedMs: Number.isFinite(Number(source.elapsedMs)) ? Number(source.elapsedMs) : undefined,
    attempts: Array.isArray(source.attempts) ? source.attempts : undefined,
  });
}

export function normalizeSiteResultsRecord(value: unknown): Record<string, SiteInjectionResult> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([siteId, result]) => [safeText(siteId).trim(), normalizeSiteInjectionResult(result)] as const)
      .filter(([siteId]) => Boolean(siteId))
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
