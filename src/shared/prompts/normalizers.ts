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
  BroadcastComparisonNote,
  BroadcastTargetMode,
  ChainFailurePolicy,
  ChainStep,
  ComparisonCaptureMode,
  FavoriteExecutionTrigger,
  FavoriteMode,
  FavoriteSort,
  HistorySort,
  InjectionResultCode,
  PromptExperiment,
  PromptExperimentRunRecord,
  PromptExperimentVariableSet,
  PromptExperimentVariant,
  ScheduleRepeat,
  ScheduleContextSnapshot,
  ServiceGroup,
  SiteInjectionResult,
  TemplatePack,
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

const VALID_FAVORITE_MODES = new Set<FavoriteMode>(["single", "chain"]);
const VALID_CAPTURE_MODES = new Set<ComparisonCaptureMode>([
  "manual",
  "selection",
  "auto",
]);
const VALID_CHAIN_FAILURE_POLICIES = new Set<ChainFailurePolicy>([
  "stop",
  "continue",
  "retry-once",
]);
const VALID_BROADCAST_TARGET_MODES = new Set<BroadcastTargetMode>([
  "default",
  "new",
  "tab",
]);
const VALID_SCHEDULE_REPEATS = new Set<ScheduleRepeat>([
  "none",
  "daily",
  "weekday",
  "weekly",
]);
const VALID_EXECUTION_TRIGGERS = new Set<FavoriteExecutionTrigger>([
  "popup",
  "scheduled",
  "palette",
  "options",
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

export function normalizeFavoriteMode(value: unknown): FavoriteMode {
  return VALID_FAVORITE_MODES.has(value as FavoriteMode)
    ? (value as FavoriteMode)
    : "single";
}

export function normalizeComparisonCaptureMode(value: unknown): ComparisonCaptureMode {
  return VALID_CAPTURE_MODES.has(value as ComparisonCaptureMode)
    ? (value as ComparisonCaptureMode)
    : "manual";
}

export function normalizeChainFailurePolicy(value: unknown): ChainFailurePolicy {
  return VALID_CHAIN_FAILURE_POLICIES.has(value as ChainFailurePolicy)
    ? (value as ChainFailurePolicy)
    : "stop";
}

export function normalizeBroadcastTargetMode(
  value: unknown,
): BroadcastTargetMode | undefined {
  return VALID_BROADCAST_TARGET_MODES.has(value as BroadcastTargetMode)
    ? (value as BroadcastTargetMode)
    : undefined;
}

export function normalizeScheduleRepeat(value: unknown): ScheduleRepeat {
  return VALID_SCHEDULE_REPEATS.has(value as ScheduleRepeat)
    ? (value as ScheduleRepeat)
    : "none";
}

export function normalizeExecutionTrigger(
  value: unknown
): FavoriteExecutionTrigger | undefined {
  return VALID_EXECUTION_TRIGGERS.has(value as FavoriteExecutionTrigger)
    ? (value as FavoriteExecutionTrigger)
    : undefined;
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

export function createStorageItemId(
  prefix: string,
  preferredId: unknown,
  fallbackIndex = 0,
) {
  const trimmedId = safeText(preferredId).trim();
  if (trimmedId) {
    return trimmedId;
  }

  const safePrefix = safeText(prefix).trim() || "item";
  return `${safePrefix}-${Date.now()}-${fallbackIndex}`;
}

export function normalizeComparisonNote(
  value: unknown,
  fallback: Partial<BroadcastComparisonNote> = {},
  index = 0,
): BroadcastComparisonNote {
  const source = safeObject(value);
  const now = new Date().toISOString();
  const createdAt = normalizeIsoDate(source.createdAt ?? fallback.createdAt, now);
  const ratingValue = Number(source.rating ?? fallback.rating);
  const rating = Number.isFinite(ratingValue)
    ? Math.min(5, Math.max(1, Math.round(ratingValue)))
    : null;

  return {
    id: createStorageItemId("note", source.id ?? fallback.id, index),
    historyId: Number.isFinite(Number(source.historyId ?? fallback.historyId))
      ? Math.max(0, Math.round(Number(source.historyId ?? fallback.historyId)))
      : 0,
    serviceId: safeText(source.serviceId ?? fallback.serviceId).trim(),
    responseText: safeText(source.responseText ?? fallback.responseText),
    captureMode: normalizeComparisonCaptureMode(
      source.captureMode ?? fallback.captureMode,
    ),
    rating,
    tags: normalizeTags(source.tags ?? fallback.tags),
    createdAt,
    updatedAt: normalizeIsoDate(source.updatedAt ?? fallback.updatedAt, createdAt),
  };
}

export function normalizePromptExperimentVariant(
  value: unknown,
  fallback: Partial<PromptExperimentVariant> = {},
  index = 0,
): PromptExperimentVariant {
  const source = safeObject(value);
  return {
    id: createStorageItemId("variant", source.id ?? fallback.id, index),
    title:
      safeText(source.title ?? fallback.title).trim() ||
      `Variant ${index + 1}`,
    text: safeText(source.text ?? fallback.text),
  };
}

export function normalizePromptExperimentVariableSet(
  value: unknown,
  fallback: Partial<PromptExperimentVariableSet> = {},
  index = 0,
): PromptExperimentVariableSet {
  const source = safeObject(value);
  return {
    id: createStorageItemId("vars", source.id ?? fallback.id, index),
    title:
      safeText(source.title ?? fallback.title).trim() ||
      `Variables ${index + 1}`,
    values: normalizeTemplateDefaults(source.values ?? fallback.values),
  };
}

export function normalizePromptExperimentRunRecord(
  value: unknown,
  fallback: Partial<PromptExperimentRunRecord> = {},
  index = 0,
): PromptExperimentRunRecord {
  const source = safeObject(value);
  return {
    id: createStorageItemId("run", source.id ?? fallback.id, index),
    createdAt: normalizeIsoDate(source.createdAt ?? fallback.createdAt),
    variantId: safeText(source.variantId ?? fallback.variantId).trim(),
    variableSetId: safeText(source.variableSetId ?? fallback.variableSetId).trim(),
    targetSiteIds: normalizeSiteIdList(source.targetSiteIds ?? fallback.targetSiteIds),
    broadcastIds: normalizeSiteIdList(source.broadcastIds ?? fallback.broadcastIds),
  };
}

export function normalizePromptExperiment(
  value: unknown,
  fallback: Partial<PromptExperiment> = {},
  index = 0,
): PromptExperiment {
  const source = safeObject(value);
  const now = new Date().toISOString();
  const createdAt = normalizeIsoDate(source.createdAt ?? fallback.createdAt, now);
  const variants = safeArray(source.variants ?? fallback.variants)
    .map((entry, variantIndex) => normalizePromptExperimentVariant(entry, {}, variantIndex))
    .filter((variant) => variant.text.trim());
  const variableSets = safeArray(source.variableSets ?? fallback.variableSets)
    .map((entry, setIndex) => normalizePromptExperimentVariableSet(entry, {}, setIndex));
  const normalizedVariableSets =
    variableSets.length > 0
      ? variableSets
      : [normalizePromptExperimentVariableSet({ title: "Default", values: {} }, {}, 0)];

  return {
    id: createStorageItemId("experiment", source.id ?? fallback.id, index),
    title:
      safeText(source.title ?? fallback.title).trim() ||
      `Experiment ${index + 1}`,
    description: safeText(source.description ?? fallback.description),
    variants,
    targetSiteIds: normalizeSiteIdList(source.targetSiteIds ?? fallback.targetSiteIds),
    variableSets: normalizedVariableSets,
    runs: safeArray(source.runs ?? fallback.runs).map((entry, runIndex) =>
      normalizePromptExperimentRunRecord(entry, {}, runIndex),
    ),
    createdAt,
    updatedAt: normalizeIsoDate(source.updatedAt ?? fallback.updatedAt, createdAt),
  };
}

export function normalizeTemplatePack(
  value: unknown,
  fallback: Partial<TemplatePack> = {},
  index = 0,
): TemplatePack {
  const source = safeObject(value);
  const now = new Date().toISOString();
  const createdAt = normalizeIsoDate(source.createdAt ?? fallback.createdAt, now);
  return {
    id: createStorageItemId("pack", source.id ?? fallback.id, index),
    title:
      safeText(source.title ?? fallback.title).trim() ||
      `Template Pack ${index + 1}`,
    description: safeText(source.description ?? fallback.description),
    favoriteIds: normalizeSiteIdList(source.favoriteIds ?? fallback.favoriteIds),
    templates: safeArray(source.templates ?? fallback.templates) as TemplatePack["templates"],
    includeSensitiveDefaults: normalizeBoolean(
      source.includeSensitiveDefaults ?? fallback.includeSensitiveDefaults,
      true,
    ),
    createdAt,
    updatedAt: normalizeIsoDate(source.updatedAt ?? fallback.updatedAt, createdAt),
  };
}

export function normalizeServiceGroup(
  value: unknown,
  fallback: Partial<ServiceGroup> = {},
  index = 0,
): ServiceGroup {
  const source = safeObject(value);
  const now = new Date().toISOString();
  const createdAt = normalizeIsoDate(source.createdAt ?? fallback.createdAt, now);
  const sortOrder = Number(source.sortOrder ?? fallback.sortOrder ?? index);
  return {
    id: createStorageItemId("group", source.id ?? fallback.id, index),
    title:
      safeText(source.title ?? fallback.title).trim() ||
      `Group ${index + 1}`,
    serviceIds: normalizeSiteIdList(source.serviceIds ?? fallback.serviceIds),
    sortOrder: Number.isFinite(sortOrder) ? Math.max(0, Math.round(sortOrder)) : index,
    createdAt,
    updatedAt: normalizeIsoDate(source.updatedAt ?? fallback.updatedAt, createdAt),
  };
}

export function normalizeScheduleContextSnapshot(
  value: unknown,
): ScheduleContextSnapshot | null {
  const source = safeObject(value);
  const hasMeaningfulValue = Boolean(
    source.enabled ||
      safeText(source.url).trim() ||
      safeText(source.title).trim() ||
      safeText(source.selection).trim() ||
      safeText(source.capturedAt).trim(),
  );

  if (!hasMeaningfulValue) {
    return null;
  }

  return {
    enabled: normalizeBoolean(source.enabled, false),
    url: safeText(source.url),
    title: safeText(source.title),
    selection: safeText(source.selection),
    capturedAt: normalizeNullableIsoDate(source.capturedAt),
  };
}

export function createChainStepId(preferredId: unknown, fallbackIndex = 0) {
  const trimmedId = safeText(preferredId).trim();
  return trimmedId || `step-${Date.now()}-${fallbackIndex}`;
}

export function normalizeDelayMs(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.round(numericValue));
}

export function normalizeChainStep(
  value: unknown,
  fallback: Partial<ChainStep> = {},
  index = 0
): ChainStep {
  const source = safeObject(value);
  const fallbackTargets = Array.isArray(fallback.targetSiteIds) ? fallback.targetSiteIds : [];

  return {
    id: createChainStepId(source.id ?? fallback.id, index),
    text: safeText(source.text ?? fallback.text),
    delayMs: normalizeDelayMs(source.delayMs ?? fallback.delayMs),
    targetSiteIds: normalizeSiteIdList(
      Array.isArray(source.targetSiteIds) ? source.targetSiteIds : fallbackTargets
    ),
    failurePolicy: normalizeChainFailurePolicy(
      source.failurePolicy ?? fallback.failurePolicy,
    ),
    targetMode: normalizeBroadcastTargetMode(source.targetMode ?? fallback.targetMode),
    templateDefaults: normalizeTemplateDefaults(
      source.templateDefaults ?? fallback.templateDefaults,
    ),
  };
}

export function normalizeChainSteps(
  value: unknown,
  fallback: Partial<ChainStep> = {}
): ChainStep[] {
  const source = safeArray(value)
    .map((entry, index) => normalizeChainStep(entry, fallback, index))
    .filter((entry) => entry.text.trim());

  if (source.length > 0) {
    return source;
  }

  if (safeText(fallback.text).trim()) {
    return [normalizeChainStep(fallback, fallback, 0)];
  }

  return [];
}
