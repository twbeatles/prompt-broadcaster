// src/shared/template/constants.ts
var TEMPLATE_VARIABLE_PATTERN = /{{\s*([^{}]+?)\s*}}/g;
var SYSTEM_TEMPLATE_VARIABLES = Object.freeze({
  date: "date",
  time: "time",
  weekday: "weekday",
  clipboard: "clipboard",
  url: "url",
  title: "title",
  selection: "selection",
  counter: "counter",
  random: "random"
});
var SYSTEM_TEMPLATE_DEFINITIONS = Object.freeze({
  [SYSTEM_TEMPLATE_VARIABLES.date]: {
    aliases: ["date", "날짜"],
    labels: { ko: "날짜", en: "date" }
  },
  [SYSTEM_TEMPLATE_VARIABLES.time]: {
    aliases: ["time", "시간"],
    labels: { ko: "시간", en: "time" }
  },
  [SYSTEM_TEMPLATE_VARIABLES.weekday]: {
    aliases: ["weekday", "요일"],
    labels: { ko: "요일", en: "weekday" }
  },
  [SYSTEM_TEMPLATE_VARIABLES.clipboard]: {
    aliases: ["clipboard", "클립보드"],
    labels: { ko: "클립보드", en: "clipboard" }
  },
  [SYSTEM_TEMPLATE_VARIABLES.url]: {
    aliases: ["url", "주소"],
    labels: { ko: "현재 탭 URL", en: "current tab URL" }
  },
  [SYSTEM_TEMPLATE_VARIABLES.title]: {
    aliases: ["title", "제목"],
    labels: { ko: "현재 탭 제목", en: "current tab title" }
  },
  [SYSTEM_TEMPLATE_VARIABLES.selection]: {
    aliases: ["selection", "선택"],
    labels: { ko: "선택한 텍스트", en: "selected text" }
  },
  [SYSTEM_TEMPLATE_VARIABLES.counter]: {
    aliases: ["counter", "카운터"],
    labels: { ko: "카운터", en: "counter" }
  },
  [SYSTEM_TEMPLATE_VARIABLES.random]: {
    aliases: ["random", "랜덤"],
    labels: { ko: "랜덤 숫자", en: "random number" }
  }
});
var SYSTEM_TEMPLATE_ALIAS_MAP = new Map(
  Object.entries(SYSTEM_TEMPLATE_DEFINITIONS).flatMap(
    ([canonicalName, definition]) => definition.aliases.map((alias) => [alias.toLowerCase(), canonicalName])
  )
);
var SYSTEM_TEMPLATE_KEYS = new Set(Object.keys(SYSTEM_TEMPLATE_DEFINITIONS));
var WEEKDAY_LOCALES = Object.freeze({
  ko: "ko-KR",
  en: "en-US"
});

// src/shared/template/normalize.ts
function pad2(value) {
  return String(value).padStart(2, "0");
}
function normalizeLocale(locale) {
  return typeof locale === "string" && locale.toLowerCase().startsWith("ko") ? "ko" : "en";
}
function normalizeTemplateVariableName(value) {
  return typeof value === "string" ? value.trim() : "";
}
function canonicalizeTemplateVariableName(value) {
  const normalizedValue = normalizeTemplateVariableName(value);
  if (!normalizedValue) {
    return "";
  }
  return SYSTEM_TEMPLATE_ALIAS_MAP.get(normalizedValue.toLowerCase()) ?? normalizedValue;
}
function normalizeTemplateValueRecord(values = {}) {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      canonicalizeTemplateVariableName(key),
      value
    ])
  );
}

// src/shared/template/detect.ts
function detectTemplateVariables(template) {
  const source = typeof template === "string" ? template : "";
  const seen = /* @__PURE__ */ new Set();
  const variables = [];
  for (const match of source.matchAll(TEMPLATE_VARIABLE_PATTERN)) {
    const canonicalName = canonicalizeTemplateVariableName(match[1]);
    if (!canonicalName || seen.has(canonicalName)) {
      continue;
    }
    seen.add(canonicalName);
    variables.push({
      name: canonicalName,
      kind: SYSTEM_TEMPLATE_KEYS.has(canonicalName) ? "system" : "user"
    });
  }
  return variables;
}

// src/shared/template/values.ts
function buildSystemTemplateValues(now = /* @__PURE__ */ new Date(), options = {}) {
  const date = now instanceof Date ? now : /* @__PURE__ */ new Date();
  const locale = normalizeLocale(options?.locale);
  const values = {
    [SYSTEM_TEMPLATE_VARIABLES.date]: [
      date.getFullYear(),
      pad2(date.getMonth() + 1),
      pad2(date.getDate())
    ].join("-"),
    [SYSTEM_TEMPLATE_VARIABLES.time]: `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
    [SYSTEM_TEMPLATE_VARIABLES.weekday]: new Intl.DateTimeFormat(WEEKDAY_LOCALES[locale], {
      weekday: locale === "ko" ? "short" : "long"
    }).format(date),
    [SYSTEM_TEMPLATE_VARIABLES.random]: String(Math.floor(Math.random() * 1e3) + 1)
  };
  if (options?.extra && typeof options.extra === "object") {
    if (typeof options.extra.url === "string") {
      values[SYSTEM_TEMPLATE_VARIABLES.url] = options.extra.url;
    }
    if (typeof options.extra.title === "string") {
      values[SYSTEM_TEMPLATE_VARIABLES.title] = options.extra.title;
    }
    if (typeof options.extra.selection === "string") {
      values[SYSTEM_TEMPLATE_VARIABLES.selection] = options.extra.selection;
    }
    if (typeof options.extra.counter === "string" || typeof options.extra.counter === "number") {
      values[SYSTEM_TEMPLATE_VARIABLES.counter] = String(options.extra.counter);
    }
  }
  return values;
}

// src/shared/template/render.ts
function renderTemplatePrompt(template, values = {}) {
  const source = typeof template === "string" ? template : "";
  const normalizedValues = normalizeTemplateValueRecord(values);
  return source.replace(TEMPLATE_VARIABLE_PATTERN, (_match, rawName) => {
    const normalizedName = normalizeTemplateVariableName(rawName);
    const canonicalName = canonicalizeTemplateVariableName(rawName);
    if (!normalizedName) {
      return "";
    }
    if (Object.prototype.hasOwnProperty.call(normalizedValues, canonicalName)) {
      return String(normalizedValues[canonicalName] ?? "");
    }
    if (Object.prototype.hasOwnProperty.call(normalizedValues, normalizedName)) {
      return String(normalizedValues[normalizedName] ?? "");
    }
    return `{{${normalizedName}}}`;
  });
}

// src/shared/broadcast/resolution.ts
function pickBroadcastTargetPrompt(target, fallbackPrompt = "") {
  if (typeof target?.resolvedPrompt === "string") {
    return target.resolvedPrompt;
  }
  if (typeof target?.promptOverride === "string" && target.promptOverride.trim()) {
    return target.promptOverride.trim();
  }
  return String(fallbackPrompt ?? "");
}

// src/shared/prompts/constants.ts
var LOCAL_STORAGE_KEYS = Object.freeze({
  history: "promptHistory",
  favorites: "promptFavorites",
  templateVariableCache: "templateVariableCache",
  settings: "appSettings",
  broadcastCounter: "broadcastCounter",
  comparisonNotes: "comparisonNotes",
  promptExperiments: "promptExperiments",
  templatePacks: "templatePacks",
  serviceGroups: "serviceGroups"
});
var DEFAULT_HISTORY_LIMIT = 50;
var MIN_HISTORY_LIMIT = 10;
var MAX_HISTORY_LIMIT = 200;
var MIN_WAIT_MS_MULTIPLIER = 0.5;
var MAX_WAIT_MS_MULTIPLIER = 3;
var DEFAULT_WAIT_MS_MULTIPLIER = 1;
var DEFAULT_HISTORY_SORT = "latest";
var DEFAULT_FAVORITE_SORT = "recentUsed";
var EXPERIMENT_SOFT_BROADCAST_LIMIT = 10;
var EXPERIMENT_HARD_BROADCAST_LIMIT = 30;
var DEFAULT_SETTINGS = Object.freeze({
  historyLimit: DEFAULT_HISTORY_LIMIT,
  autoClosePopup: false,
  desktopNotifications: true,
  reuseExistingTabs: true,
  autoCaptureResponses: true,
  waitMsMultiplier: DEFAULT_WAIT_MS_MULTIPLIER,
  historySort: DEFAULT_HISTORY_SORT,
  favoriteSort: DEFAULT_FAVORITE_SORT,
  siteOrder: []
});

// src/shared/prompts/normalizers.ts
var VALID_HISTORY_SORTS = /* @__PURE__ */ new Set([
  "latest",
  "oldest",
  "mostSuccess",
  "mostFailure"
]);
var VALID_FAVORITE_SORTS = /* @__PURE__ */ new Set([
  "recentUsed",
  "usageCount",
  "title",
  "createdAt"
]);
var VALID_FAVORITE_MODES = /* @__PURE__ */ new Set(["single", "chain"]);
var VALID_CAPTURE_MODES = /* @__PURE__ */ new Set([
  "manual",
  "selection",
  "auto"
]);
var VALID_CHAIN_FAILURE_POLICIES = /* @__PURE__ */ new Set([
  "stop",
  "continue",
  "retry-once"
]);
var VALID_BROADCAST_TARGET_MODES = /* @__PURE__ */ new Set([
  "default",
  "new",
  "tab"
]);
var VALID_SCHEDULE_REPEATS = /* @__PURE__ */ new Set([
  "none",
  "daily",
  "weekday",
  "weekly"
]);
var VALID_EXECUTION_TRIGGERS = /* @__PURE__ */ new Set([
  "popup",
  "scheduled",
  "palette",
  "options"
]);
var VALID_RESULT_CODES = /* @__PURE__ */ new Set([
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
  "unexpected_error"
]);
function safeText(value) {
  return typeof value === "string" ? value : "";
}
function safeArray(value) {
  return Array.isArray(value) ? value : [];
}
function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function normalizeSentTo(sentTo) {
  return Array.from(
    new Set(
      safeArray(sentTo).flatMap(
        (entry) => typeof entry === "string" && entry.trim() ? [entry.trim()] : []
      )
    )
  );
}
function normalizeSiteIdList(value) {
  return normalizeSentTo(value);
}
function normalizeIsoDate(value, fallback = (/* @__PURE__ */ new Date()).toISOString()) {
  if (typeof value !== "string") {
    return fallback;
  }
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}
function normalizeNullableIsoDate(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
function normalizeTemplateDefaults(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [safeText(key).trim(), safeText(entryValue)]).filter(([key]) => key)
  );
}
function normalizeBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}
function normalizeHistoryLimit(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_HISTORY_LIMIT;
  }
  return Math.min(
    MAX_HISTORY_LIMIT,
    Math.max(MIN_HISTORY_LIMIT, Math.round(numericValue))
  );
}
function normalizeBroadcastCounter(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }
  return Math.max(0, Math.round(numericValue));
}
function normalizeWaitMsMultiplier(value) {
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
function normalizeHistorySort(value) {
  return VALID_HISTORY_SORTS.has(value) ? value : DEFAULT_HISTORY_SORT;
}
function normalizeFavoriteSort(value) {
  return VALID_FAVORITE_SORTS.has(value) ? value : DEFAULT_FAVORITE_SORT;
}
function normalizeFavoriteMode(value) {
  return VALID_FAVORITE_MODES.has(value) ? value : "single";
}
function normalizeComparisonCaptureMode(value) {
  return VALID_CAPTURE_MODES.has(value) ? value : "manual";
}
function normalizeChainFailurePolicy(value) {
  return VALID_CHAIN_FAILURE_POLICIES.has(value) ? value : "stop";
}
function normalizeBroadcastTargetMode(value) {
  return VALID_BROADCAST_TARGET_MODES.has(value) ? value : void 0;
}
function normalizeScheduleRepeat(value) {
  return VALID_SCHEDULE_REPEATS.has(value) ? value : "none";
}
function normalizeExecutionTrigger(value) {
  return VALID_EXECUTION_TRIGGERS.has(value) ? value : void 0;
}
function normalizeSettings(value) {
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
    siteOrder: normalizeSiteIdList(settings.siteOrder)
  };
}
function normalizeStatus(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "submitted";
}
function normalizeResultCode(value) {
  const normalized = safeText(value).trim();
  if (VALID_RESULT_CODES.has(normalized)) {
    return normalized;
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
function buildSiteInjectionResult(code, overrides = {}) {
  const normalizedCode = normalizeResultCode(code);
  const result = {
    code: normalizedCode
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
    result.attempts = overrides.attempts.map((attempt) => ({
      name: safeText(attempt?.name).trim(),
      success: Boolean(attempt?.success)
    })).filter((attempt) => attempt.name);
  }
  return result;
}
function normalizeSiteInjectionResult(value) {
  if (typeof value === "string") {
    return buildSiteInjectionResult(value);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return buildSiteInjectionResult("unexpected_error");
  }
  const source = value;
  return buildSiteInjectionResult(source.code ?? source.status, {
    message: safeText(source.message).trim(),
    strategy: safeText(source.strategy).trim(),
    elapsedMs: Number.isFinite(Number(source.elapsedMs)) ? Number(source.elapsedMs) : void 0,
    attempts: Array.isArray(source.attempts) ? source.attempts : void 0
  });
}
function normalizeSiteResultsRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).map(([siteId, result]) => [safeText(siteId).trim(), normalizeSiteInjectionResult(result)]).filter(([siteId]) => Boolean(siteId))
  );
}
function sortByDateDesc(items, field = "createdAt") {
  return [...items].sort((left, right) => {
    const leftRecord = left;
    const rightRecord = right;
    const leftTime = Date.parse(String(leftRecord[field] ?? "")) || 0;
    const rightTime = Date.parse(String(rightRecord[field] ?? "")) || 0;
    return rightTime - leftTime;
  });
}
function ensureUniqueNumericId(items, preferredId) {
  let candidate = Number.isFinite(preferredId) ? preferredId : Date.now();
  const usedIds = new Set(items.map((item) => Number(item.id)));
  while (usedIds.has(candidate)) {
    candidate += 1;
  }
  return candidate;
}
function ensureUniqueStringId(items, preferredId) {
  let candidate = typeof preferredId === "string" && preferredId.trim() ? preferredId.trim() : `fav-${Date.now()}`;
  const usedIds = new Set(items.map((item) => String(item.id)));
  while (usedIds.has(candidate)) {
    candidate = `${candidate}-1`;
  }
  return candidate;
}
function normalizeTags(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value.map((tag) => safeText(tag).trim()).filter((tag) => tag.length > 0 && tag.length <= 30)
    )
  ).slice(0, 10);
}
function createStorageItemId(prefix, preferredId, fallbackIndex = 0) {
  const trimmedId = safeText(preferredId).trim();
  if (trimmedId) {
    return trimmedId;
  }
  const safePrefix = safeText(prefix).trim() || "item";
  return `${safePrefix}-${Date.now()}-${fallbackIndex}`;
}
function normalizeComparisonNote(value, fallback = {}, index = 0) {
  const source = safeObject(value);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const createdAt = normalizeIsoDate(source.createdAt ?? fallback.createdAt, now);
  const ratingValue = Number(source.rating ?? fallback.rating);
  const rating = Number.isFinite(ratingValue) ? Math.min(5, Math.max(1, Math.round(ratingValue))) : null;
  return {
    id: createStorageItemId("note", source.id ?? fallback.id, index),
    historyId: Number.isFinite(Number(source.historyId ?? fallback.historyId)) ? Math.max(0, Math.round(Number(source.historyId ?? fallback.historyId))) : 0,
    serviceId: safeText(source.serviceId ?? fallback.serviceId).trim(),
    responseText: safeText(source.responseText ?? fallback.responseText),
    captureMode: normalizeComparisonCaptureMode(
      source.captureMode ?? fallback.captureMode
    ),
    rating,
    tags: normalizeTags(source.tags ?? fallback.tags),
    createdAt,
    updatedAt: normalizeIsoDate(source.updatedAt ?? fallback.updatedAt, createdAt)
  };
}
function normalizePromptExperimentVariant(value, fallback = {}, index = 0) {
  const source = safeObject(value);
  return {
    id: createStorageItemId("variant", source.id ?? fallback.id, index),
    title: safeText(source.title ?? fallback.title).trim() || `Variant ${index + 1}`,
    text: safeText(source.text ?? fallback.text)
  };
}
function normalizePromptExperimentVariableSet(value, fallback = {}, index = 0) {
  const source = safeObject(value);
  return {
    id: createStorageItemId("vars", source.id ?? fallback.id, index),
    title: safeText(source.title ?? fallback.title).trim() || `Variables ${index + 1}`,
    values: normalizeTemplateDefaults(source.values ?? fallback.values)
  };
}
function normalizePromptExperimentRunRecord(value, fallback = {}, index = 0) {
  const source = safeObject(value);
  return {
    id: createStorageItemId("run", source.id ?? fallback.id, index),
    createdAt: normalizeIsoDate(source.createdAt ?? fallback.createdAt),
    variantId: safeText(source.variantId ?? fallback.variantId).trim(),
    variableSetId: safeText(source.variableSetId ?? fallback.variableSetId).trim(),
    targetSiteIds: normalizeSiteIdList(source.targetSiteIds ?? fallback.targetSiteIds),
    broadcastIds: normalizeSiteIdList(source.broadcastIds ?? fallback.broadcastIds)
  };
}
function normalizePromptExperiment(value, fallback = {}, index = 0) {
  const source = safeObject(value);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const createdAt = normalizeIsoDate(source.createdAt ?? fallback.createdAt, now);
  const variants = safeArray(source.variants ?? fallback.variants).map((entry, variantIndex) => normalizePromptExperimentVariant(entry, {}, variantIndex)).filter((variant) => variant.text.trim());
  const variableSets = safeArray(source.variableSets ?? fallback.variableSets).map((entry, setIndex) => normalizePromptExperimentVariableSet(entry, {}, setIndex));
  const normalizedVariableSets = variableSets.length > 0 ? variableSets : [normalizePromptExperimentVariableSet({ title: "Default", values: {} }, {}, 0)];
  return {
    id: createStorageItemId("experiment", source.id ?? fallback.id, index),
    title: safeText(source.title ?? fallback.title).trim() || `Experiment ${index + 1}`,
    description: safeText(source.description ?? fallback.description),
    variants,
    targetSiteIds: normalizeSiteIdList(source.targetSiteIds ?? fallback.targetSiteIds),
    variableSets: normalizedVariableSets,
    runs: safeArray(source.runs ?? fallback.runs).map(
      (entry, runIndex) => normalizePromptExperimentRunRecord(entry, {}, runIndex)
    ),
    createdAt,
    updatedAt: normalizeIsoDate(source.updatedAt ?? fallback.updatedAt, createdAt)
  };
}
function normalizeTemplatePack(value, fallback = {}, index = 0) {
  const source = safeObject(value);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const createdAt = normalizeIsoDate(source.createdAt ?? fallback.createdAt, now);
  return {
    id: createStorageItemId("pack", source.id ?? fallback.id, index),
    title: safeText(source.title ?? fallback.title).trim() || `Template Pack ${index + 1}`,
    description: safeText(source.description ?? fallback.description),
    favoriteIds: normalizeSiteIdList(source.favoriteIds ?? fallback.favoriteIds),
    templates: safeArray(source.templates ?? fallback.templates),
    includeSensitiveDefaults: normalizeBoolean(
      source.includeSensitiveDefaults ?? fallback.includeSensitiveDefaults,
      true
    ),
    createdAt,
    updatedAt: normalizeIsoDate(source.updatedAt ?? fallback.updatedAt, createdAt)
  };
}
function normalizeServiceGroup(value, fallback = {}, index = 0) {
  const source = safeObject(value);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const createdAt = normalizeIsoDate(source.createdAt ?? fallback.createdAt, now);
  const sortOrder = Number(source.sortOrder ?? fallback.sortOrder ?? index);
  return {
    id: createStorageItemId("group", source.id ?? fallback.id, index),
    title: safeText(source.title ?? fallback.title).trim() || `Group ${index + 1}`,
    serviceIds: normalizeSiteIdList(source.serviceIds ?? fallback.serviceIds),
    sortOrder: Number.isFinite(sortOrder) ? Math.max(0, Math.round(sortOrder)) : index,
    createdAt,
    updatedAt: normalizeIsoDate(source.updatedAt ?? fallback.updatedAt, createdAt)
  };
}
function normalizeScheduleContextSnapshot(value) {
  const source = safeObject(value);
  const hasMeaningfulValue = Boolean(
    source.enabled || safeText(source.url).trim() || safeText(source.title).trim() || safeText(source.selection).trim() || safeText(source.capturedAt).trim()
  );
  if (!hasMeaningfulValue) {
    return null;
  }
  return {
    enabled: normalizeBoolean(source.enabled, false),
    url: safeText(source.url),
    title: safeText(source.title),
    selection: safeText(source.selection),
    capturedAt: normalizeNullableIsoDate(source.capturedAt)
  };
}
function createChainStepId(preferredId, fallbackIndex = 0) {
  const trimmedId = safeText(preferredId).trim();
  return trimmedId || `step-${Date.now()}-${fallbackIndex}`;
}
function normalizeDelayMs(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }
  return Math.max(0, Math.round(numericValue));
}
function normalizeChainStep(value, fallback = {}, index = 0) {
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
      source.failurePolicy ?? fallback.failurePolicy
    ),
    targetMode: normalizeBroadcastTargetMode(source.targetMode ?? fallback.targetMode),
    templateDefaults: normalizeTemplateDefaults(
      source.templateDefaults ?? fallback.templateDefaults
    )
  };
}
function normalizeChainSteps(value, fallback = {}) {
  const source = safeArray(value).map((entry, index) => normalizeChainStep(entry, fallback, index)).filter((entry) => entry.text.trim());
  if (source.length > 0) {
    return source;
  }
  if (safeText(fallback.text).trim()) {
    return [normalizeChainStep(fallback, fallback, 0)];
  }
  return [];
}

// src/shared/broadcast/target-snapshots.ts
function normalizeTargetMode(value) {
  if (value === "new" || value === "tab") {
    return value;
  }
  return "default";
}
function normalizeTargetTabId(value) {
  if (value === null || value === void 0 || value === "") {
    return null;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}
function buildBroadcastTargetSnapshot(value) {
  const siteId = safeText(value?.siteId).trim();
  if (!siteId) {
    return null;
  }
  return {
    siteId,
    resolvedPrompt: safeText(value?.resolvedPrompt),
    targetMode: normalizeTargetMode(value?.targetMode),
    targetTabId: normalizeTargetTabId(value?.targetTabId)
  };
}
function normalizeBroadcastTargetSnapshots(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const seenSiteIds = /* @__PURE__ */ new Set();
  const snapshots = [];
  value.forEach((entry) => {
    const snapshot = buildBroadcastTargetSnapshot(
      entry && typeof entry === "object" && !Array.isArray(entry) ? {
        siteId: safeText(entry.siteId),
        resolvedPrompt: safeText(entry.resolvedPrompt),
        targetMode: entry.targetMode,
        targetTabId: normalizeTargetTabId(entry.targetTabId)
      } : null
    );
    if (!snapshot || seenSiteIds.has(snapshot.siteId)) {
      return;
    }
    seenSiteIds.add(snapshot.siteId);
    snapshots.push(snapshot);
  });
  return snapshots;
}
function buildFallbackTargetSnapshots(siteIds, prompt) {
  return normalizeSiteIdList(siteIds).map((siteId) => ({
    siteId,
    resolvedPrompt: safeText(prompt),
    targetMode: "default",
    targetTabId: null
  }));
}
function ensureBroadcastTargetSnapshots(snapshots, siteIds, prompt) {
  const normalized = normalizeBroadcastTargetSnapshots(snapshots);
  if (normalized.length > 0) {
    return normalized;
  }
  return buildFallbackTargetSnapshots(siteIds, prompt);
}
function buildQueueTargetSnapshots(targets, fallbackPrompt) {
  return (Array.isArray(targets) ? targets : []).map((target) => {
    const siteId = safeText(target?.site?.id ?? target?.siteId).trim();
    if (!siteId) {
      return null;
    }
    const targetTabId = normalizeTargetTabId(target?.targetTabId);
    const targetMode = targetTabId ? "tab" : target?.forceNewTab ? "new" : "default";
    return {
      siteId,
      resolvedPrompt: safeText(target?.resolvedPrompt ?? fallbackPrompt),
      targetMode,
      targetTabId
    };
  }).filter((snapshot) => Boolean(snapshot));
}

// src/shared/prompts/storage.ts
async function readLocal(key, fallbackValue) {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? fallbackValue;
}
async function writeLocal(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

// src/shared/prompts/broadcast-counter.ts
async function getBroadcastCounter() {
  try {
    const rawValue = await readLocal(LOCAL_STORAGE_KEYS.broadcastCounter, 0);
    return normalizeBroadcastCounter(rawValue);
  } catch (_error) {
    return 0;
  }
}
async function setBroadcastCounter(value) {
  const normalized = normalizeBroadcastCounter(value);
  await writeLocal(LOCAL_STORAGE_KEYS.broadcastCounter, normalized);
  return normalized;
}

// src/shared/prompts/favorites-store.ts
function buildFavoriteEntry(entry) {
  const source = entry ?? {};
  const text = safeText(source?.text);
  const sentTo = normalizeSentTo(source?.sentTo);
  const createdAt = normalizeIsoDate(source?.createdAt);
  const favoritedAt = normalizeIsoDate(source?.favoritedAt, createdAt);
  const usageCount = Math.max(0, Math.round(Number(source?.usageCount) || 0));
  const mode = normalizeFavoriteMode(source?.mode);
  const steps = mode === "chain" ? normalizeChainSteps(source?.steps, {
    text,
    delayMs: 0,
    targetSiteIds: sentTo
  }) : [];
  return {
    id: typeof source?.id === "string" && source.id.trim() ? source.id.trim() : `fav-${Date.now()}`,
    sourceHistoryId: source?.sourceHistoryId === null || source?.sourceHistoryId === void 0 ? null : Number(source.sourceHistoryId),
    title: safeText(source?.title),
    text,
    sentTo,
    createdAt,
    favoritedAt,
    templateDefaults: normalizeTemplateDefaults(source?.templateDefaults),
    tags: normalizeTags(source?.tags),
    folder: safeText(source?.folder).slice(0, 50),
    pinned: normalizeBoolean(source?.pinned, false),
    usageCount,
    lastUsedAt: normalizeNullableIsoDate(source?.lastUsedAt),
    mode,
    steps,
    scheduleEnabled: normalizeBoolean(source?.scheduleEnabled, false),
    scheduledAt: normalizeNullableIsoDate(source?.scheduledAt),
    scheduleRepeat: normalizeScheduleRepeat(source?.scheduleRepeat),
    scheduleContextSnapshot: normalizeScheduleContextSnapshot(source?.scheduleContextSnapshot)
  };
}
async function getPromptFavorites() {
  const rawFavorites = await readLocal(
    LOCAL_STORAGE_KEYS.favorites,
    []
  );
  return sortByDateDesc(
    safeArray(rawFavorites).map((item) => buildFavoriteEntry(item)),
    "favoritedAt"
  );
}
async function setPromptFavorites(favoriteItems) {
  const normalized = sortByDateDesc(
    safeArray(favoriteItems).map((item) => buildFavoriteEntry(item)),
    "favoritedAt"
  );
  await writeLocal(LOCAL_STORAGE_KEYS.favorites, normalized);
  return normalized;
}
async function updateFavoritePrompt(favoriteId, patch = {}) {
  const favorites = await getPromptFavorites();
  const nextFavorites = favorites.map((item) => {
    if (String(item.id) !== String(favoriteId)) {
      return item;
    }
    return buildFavoriteEntry({
      ...item,
      ...patch ?? {},
      id: item.id,
      sourceHistoryId: item.sourceHistoryId
    });
  });
  await setPromptFavorites(nextFavorites);
  return nextFavorites.find((item) => String(item.id) === String(favoriteId)) ?? null;
}
async function markFavoriteUsed(favoriteId) {
  const favorites = await getPromptFavorites();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const nextFavorites = favorites.map(
    (item) => String(item.id) === String(favoriteId) ? {
      ...item,
      usageCount: Math.max(0, Math.round(Number(item.usageCount) || 0)) + 1,
      lastUsedAt: now
    } : item
  );
  await setPromptFavorites(nextFavorites);
  return nextFavorites.find((item) => String(item.id) === String(favoriteId)) ?? null;
}

// src/shared/prompts/advanced-store.ts
function normalizeTemplatePackEntry(value, fallback = {}, index = 0) {
  const pack = normalizeTemplatePack(value, fallback, index);
  return {
    ...pack,
    templates: safeArray(pack.templates).map((entry) => buildFavoriteEntry(entry))
  };
}
async function getComparisonNotes() {
  const rawValue = await readLocal(
    LOCAL_STORAGE_KEYS.comparisonNotes,
    []
  );
  return sortByDateDesc(
    safeArray(rawValue).map(
      (entry, index) => normalizeComparisonNote(entry, {}, index)
    ),
    "updatedAt"
  ).filter((entry) => entry.historyId > 0 && entry.serviceId && entry.responseText.trim());
}
async function setComparisonNotes(value) {
  const normalized = sortByDateDesc(
    safeArray(value).map(
      (entry, index) => normalizeComparisonNote(entry, {}, index)
    ),
    "updatedAt"
  ).filter((entry) => entry.historyId > 0 && entry.serviceId && entry.responseText.trim());
  await writeLocal(LOCAL_STORAGE_KEYS.comparisonNotes, normalized);
  return normalized;
}
async function saveComparisonNote(value) {
  const current = await getComparisonNotes();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const preferredId = typeof value.id === "string" && value.id.trim() ? value.id.trim() : `note-${Date.now()}`;
  const existing = current.find((entry) => entry.id === preferredId);
  const note = normalizeComparisonNote(
    {
      ...existing ?? {},
      ...value ?? {},
      id: existing?.id ?? ensureUniqueStringId(current, preferredId),
      createdAt: existing?.createdAt ?? value.createdAt ?? now,
      updatedAt: now
    },
    {},
    0
  );
  const next = [note, ...current.filter((entry) => entry.id !== note.id)];
  await setComparisonNotes(next);
  return note;
}
async function deleteComparisonNote(noteId) {
  const normalizedId = typeof noteId === "string" ? noteId.trim() : "";
  const current = await getComparisonNotes();
  const next = current.filter((entry) => entry.id !== normalizedId);
  await setComparisonNotes(next);
  return next;
}
async function getPromptExperiments() {
  const rawValue = await readLocal(
    LOCAL_STORAGE_KEYS.promptExperiments,
    []
  );
  return sortByDateDesc(
    safeArray(rawValue).map(
      (entry, index) => normalizePromptExperiment(entry, {}, index)
    ),
    "updatedAt"
  );
}
async function setPromptExperiments(value) {
  const normalized = sortByDateDesc(
    safeArray(value).map(
      (entry, index) => normalizePromptExperiment(entry, {}, index)
    ),
    "updatedAt"
  );
  await writeLocal(LOCAL_STORAGE_KEYS.promptExperiments, normalized);
  return normalized;
}
async function savePromptExperiment(value) {
  const current = await getPromptExperiments();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const preferredId = typeof value.id === "string" && value.id.trim() ? value.id.trim() : `experiment-${Date.now()}`;
  const existing = current.find((entry) => entry.id === preferredId);
  const experiment = normalizePromptExperiment(
    {
      ...existing ?? {},
      ...value ?? {},
      id: existing?.id ?? ensureUniqueStringId(current, preferredId),
      createdAt: existing?.createdAt ?? value.createdAt ?? now,
      updatedAt: now
    },
    {},
    0
  );
  const next = [experiment, ...current.filter((entry) => entry.id !== experiment.id)];
  await setPromptExperiments(next);
  return experiment;
}
async function deletePromptExperiment(experimentId) {
  const normalizedId = typeof experimentId === "string" ? experimentId.trim() : "";
  const current = await getPromptExperiments();
  const next = current.filter((entry) => entry.id !== normalizedId);
  await setPromptExperiments(next);
  return next;
}
async function appendPromptExperimentRun(experimentId, run) {
  const current = await getPromptExperiments();
  const experiment = current.find((entry) => entry.id === experimentId);
  if (!experiment) {
    return null;
  }
  const normalizedRun = normalizePromptExperimentRunRecord(
    {
      ...run,
      id: run.id ?? `run-${Date.now()}`,
      createdAt: run.createdAt ?? (/* @__PURE__ */ new Date()).toISOString()
    },
    {},
    experiment.runs.length
  );
  const updatedExperiment = {
    ...experiment,
    runs: [normalizedRun, ...experiment.runs],
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  await setPromptExperiments([
    updatedExperiment,
    ...current.filter((entry) => entry.id !== experiment.id)
  ]);
  return updatedExperiment;
}
async function getTemplatePacks() {
  const rawValue = await readLocal(
    LOCAL_STORAGE_KEYS.templatePacks,
    []
  );
  return sortByDateDesc(
    safeArray(rawValue).map(
      (entry, index) => normalizeTemplatePackEntry(entry, {}, index)
    ),
    "updatedAt"
  );
}
async function setTemplatePacks(value) {
  const normalized = sortByDateDesc(
    safeArray(value).map(
      (entry, index) => normalizeTemplatePackEntry(entry, {}, index)
    ),
    "updatedAt"
  );
  await writeLocal(LOCAL_STORAGE_KEYS.templatePacks, normalized);
  return normalized;
}
async function saveTemplatePack(value) {
  const current = await getTemplatePacks();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const preferredId = typeof value.id === "string" && value.id.trim() ? value.id.trim() : `pack-${Date.now()}`;
  const existing = current.find((entry) => entry.id === preferredId);
  const pack = normalizeTemplatePackEntry(
    {
      ...existing ?? {},
      ...value ?? {},
      id: existing?.id ?? ensureUniqueStringId(current, preferredId),
      createdAt: existing?.createdAt ?? value.createdAt ?? now,
      updatedAt: now
    },
    {},
    0
  );
  const next = [pack, ...current.filter((entry) => entry.id !== pack.id)];
  await setTemplatePacks(next);
  return pack;
}
async function setServiceGroups(value) {
  const normalized = safeArray(value).map((entry, index) => normalizeServiceGroup(entry, {}, index)).sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title));
  await writeLocal(LOCAL_STORAGE_KEYS.serviceGroups, normalized);
  return normalized;
}

// src/shared/prompts/settings-store.ts
async function getAppSettings() {
  const rawSettings = await readLocal(LOCAL_STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  return normalizeSettings(rawSettings);
}
async function setAppSettings(settings) {
  const normalized = normalizeSettings(settings);
  await writeLocal(LOCAL_STORAGE_KEYS.settings, normalized);
  return normalized;
}

// src/shared/prompts/history-store.ts
function asHistoryRecord(entry) {
  return entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
}
function buildHistoryEntry(entry) {
  const source = asHistoryRecord(entry);
  const numericId = Number(source.id);
  const createdAt = normalizeIsoDate(source.createdAt);
  const siteResults = normalizeSiteResultsRecord(source.siteResults);
  const siteResultKeys = normalizeSiteIdList(Object.keys(siteResults));
  const derivedSubmittedSiteIds = siteResultKeys.filter(
    (siteId) => normalizeResultCode(siteResults[siteId]?.code) === "submitted"
  );
  const submittedSiteIds = normalizeSiteIdList(
    Array.isArray(source.submittedSiteIds) ? source.submittedSiteIds : Array.isArray(source.sentTo) ? source.sentTo : derivedSubmittedSiteIds
  );
  const failedSiteIds = normalizeSiteIdList(
    Array.isArray(source.failedSiteIds) ? source.failedSiteIds : siteResultKeys.filter((siteId) => normalizeResultCode(siteResults[siteId]?.code) !== "submitted")
  );
  const requestedSiteIds = normalizeSiteIdList(
    Array.isArray(source.requestedSiteIds) ? source.requestedSiteIds : siteResultKeys.length > 0 ? siteResultKeys : submittedSiteIds
  );
  return {
    id: Number.isFinite(numericId) ? numericId : Date.now(),
    text: safeText(source.text),
    requestedSiteIds,
    submittedSiteIds,
    failedSiteIds,
    sentTo: submittedSiteIds,
    createdAt,
    status: normalizeStatus(source.status),
    siteResults,
    targetSnapshots: ensureBroadcastTargetSnapshots(
      source.targetSnapshots,
      requestedSiteIds,
      source.text
    ),
    originFavoriteId: source.originFavoriteId === null || source.originFavoriteId === void 0 ? null : safeText(source.originFavoriteId).trim() || null,
    chainRunId: source.chainRunId === null || source.chainRunId === void 0 ? null : safeText(source.chainRunId).trim() || null,
    chainStepIndex: source.chainStepIndex === null || source.chainStepIndex === void 0 ? null : Number.isFinite(Number(source.chainStepIndex)) ? Math.max(0, Math.round(Number(source.chainStepIndex))) : null,
    chainStepCount: source.chainStepCount === null || source.chainStepCount === void 0 ? null : Number.isFinite(Number(source.chainStepCount)) ? Math.max(0, Math.round(Number(source.chainStepCount))) : null,
    experimentRunId: source.experimentRunId === null || source.experimentRunId === void 0 ? null : safeText(source.experimentRunId).trim() || null,
    trigger: normalizeExecutionTrigger(source.trigger)
  };
}
async function getStoredPromptHistory() {
  const rawHistory = await readLocal(LOCAL_STORAGE_KEYS.history, []);
  return sortByDateDesc(
    safeArray(rawHistory).map((item) => buildHistoryEntry(item))
  );
}
async function setPromptHistory(historyItems) {
  const normalized = sortByDateDesc(
    safeArray(historyItems).map((item) => buildHistoryEntry(item))
  );
  await writeLocal(LOCAL_STORAGE_KEYS.history, normalized);
  return normalized;
}
async function appendPromptHistory(entry) {
  const history = await getStoredPromptHistory();
  const normalized = buildHistoryEntry(entry);
  normalized.id = ensureUniqueNumericId(history, Number(normalized.id));
  const nextHistory = sortByDateDesc([normalized, ...history]);
  await setPromptHistory(nextHistory);
  return normalized;
}

// src/config/sites/builtins.ts
var AI_SITES = Object.freeze([
  {
    id: "chatgpt",
    name: "ChatGPT",
    url: "https://chatgpt.com/",
    hostname: "chatgpt.com",
    supportedRoutes: [],
    inputSelector: "#prompt-textarea, div#prompt-textarea[contenteditable='true'], textarea[aria-label*='chatgpt' i], textarea[aria-label*='채팅' i], textarea[placeholder*='ask' i]",
    fallbackSelectors: [
      "#prompt-textarea",
      "div#prompt-textarea[contenteditable='true']",
      "textarea[aria-label*='chatgpt' i]",
      "textarea[aria-label*='채팅' i]",
      "textarea[placeholder*='ask' i]",
      "textarea.wcDTda_fallbackTextarea",
      "div.ProseMirror[contenteditable='true']",
      "div[contenteditable='true'][data-id='root']",
      "main div[contenteditable='true']"
    ],
    inputType: "contenteditable",
    submitSelector: "button[data-testid='send-button'], button[aria-label*='send' i], button[aria-label*='보내기' i]",
    submitMethod: "click",
    selectorCheckMode: "input-and-conditional-submit",
    waitMs: 2e3,
    fallback: true,
    lastVerified: "2026-05",
    verifiedAt: "2026-05-10",
    verifiedRoute: "/",
    verifiedAuthState: "logged-out",
    verifiedLocale: "ko",
    verifiedVersion: "chatgpt-web-may-2026",
    authSelectors: [
      "form[action*='/auth']",
      "input[name='email']",
      "input[name='username']",
      "a[href*='cloudflare.com']",
      "#challenge-running",
      ".cf-browser-verification",
      ".cf-challenge",
      ".cf-turnstile",
      "iframe[src*='challenges.cloudflare.com']"
    ]
  },
  {
    id: "gemini",
    name: "Gemini",
    url: "https://gemini.google.com/app",
    hostname: "gemini.google.com",
    supportedRoutes: ["/app"],
    inputSelector: "div[contenteditable='true'][role='textbox'], div[aria-label*='Gemini' i][contenteditable='true'][role='textbox'], div.ql-editor.textarea.new-input-ui[contenteditable='true'], div.ql-editor[contenteditable='true'][role='textbox']",
    fallbackSelectors: [
      "div[contenteditable='true'][role='textbox']",
      "div[aria-label*='Gemini' i][contenteditable='true'][role='textbox']",
      "div.ql-editor.textarea.new-input-ui[contenteditable='true']",
      "div.ql-editor[contenteditable='true'][role='textbox']",
      "textarea, div[contenteditable='true']"
    ],
    inputType: "contenteditable",
    submitSelector: "button.send-button, button[aria-label*='send' i], button[aria-label*='보내기' i], button[aria-label*='메시지 보내기' i], button[type='submit']",
    submitMethod: "click",
    selectorCheckMode: "input-and-conditional-submit",
    waitMs: 2500,
    fallback: true,
    lastVerified: "2026-05",
    verifiedAt: "2026-05-10",
    verifiedRoute: "/app",
    verifiedAuthState: "logged-out",
    verifiedLocale: "ko",
    verifiedVersion: "gemini-app-may-2026",
    authSelectors: [
      "a[href*='accounts.google.com/ServiceLogin']",
      "a[aria-label*='로그인']",
      "a[aria-label*='sign in' i]",
      "input[type='email']",
      "input[type='password']"
    ]
  },
  {
    id: "claude",
    name: "Claude",
    url: "https://claude.ai/new",
    hostname: "claude.ai",
    supportedRoutes: ["/new"],
    inputSelector: "div[contenteditable='true'][role='textbox'], div[contenteditable='true'][aria-label*='Claude' i], div[contenteditable='true'][aria-label*='prompt' i]",
    fallbackSelectors: [
      "div[contenteditable='true'][role='textbox']",
      "div[contenteditable='true'][aria-label*='Claude' i]",
      "div[contenteditable='true'][aria-label*='prompt' i]",
      "div[contenteditable='true']",
      "textarea"
    ],
    inputType: "contenteditable",
    submitSelector: "button[aria-label='Send message'], button[aria-label*='send' i], button[aria-label*='submit' i], button[aria-label*='보내' i], button[aria-label*='전송' i]",
    submitMethod: "click",
    selectorCheckMode: "input-and-conditional-submit",
    waitMs: 1500,
    fallback: true,
    lastVerified: "2026-05",
    verifiedAt: "2026-05-10",
    verifiedRoute: "/new",
    verifiedAuthState: "logged-out",
    verifiedLocale: "en-US",
    verifiedVersion: "claude-web-may-2026",
    authSelectors: [
      "input#email",
      "input[type='email']",
      "input[type='password']",
      "form[action*='login']",
      "a[href*='cloudflare.com']",
      "#challenge-running",
      ".cf-browser-verification",
      ".cf-challenge",
      ".cf-turnstile",
      "iframe[src*='challenges.cloudflare.com']"
    ]
  },
  {
    id: "grok",
    name: "Grok",
    url: "https://grok.com/",
    hostname: "grok.com",
    supportedRoutes: [],
    inputSelector: "textarea[aria-label*='grok' i], textarea[placeholder*='help' i], textarea[placeholder*='무엇' i], textarea",
    fallbackSelectors: [
      "textarea[aria-label*='grok' i]",
      "textarea[placeholder*='help' i]",
      "textarea[placeholder*='무엇' i]",
      "textarea",
      "div.tiptap.ProseMirror[contenteditable='true']",
      "div.ProseMirror[contenteditable='true'][translate='no']",
      "div.ProseMirror[contenteditable='true']"
    ],
    inputType: "textarea",
    submitSelector: "button[data-testid='chat-submit'], button[type='submit'][aria-label*='submit' i], button[type='submit'][aria-label*='제출' i], button[aria-label*='submit' i], button[aria-label*='제출' i]",
    submitMethod: "click",
    selectorCheckMode: "input-and-conditional-submit",
    waitMs: 3e3,
    fallback: true,
    lastVerified: "2026-05",
    verifiedAt: "2026-05-10",
    verifiedRoute: "/",
    verifiedAuthState: "logged-out",
    verifiedLocale: "ko",
    verifiedVersion: "grok-web-may-2026",
    authSelectors: [
      "input[autocomplete='username']",
      "input[type='password']",
      "a[href*='/sign-in']",
      "a[href*='/login']"
    ]
  },
  {
    id: "perplexity",
    name: "Perplexity",
    url: "https://www.perplexity.ai/",
    hostname: "www.perplexity.ai",
    hostnameAliases: ["perplexity.ai"],
    supportedRoutes: [],
    inputSelector: "#ask-input[data-lexical-editor='true'][role='textbox']",
    fallbackSelectors: [
      "div#ask-input[data-lexical-editor='true'][role='textbox']",
      "div#ask-input[contenteditable='true'][role='textbox']",
      "#ask-input[contenteditable='true']",
      "div[contenteditable='true'][role='textbox']",
      "textarea[aria-label*='Ask' i]",
      "textarea[placeholder*='Ask'][data-testid='search-input']",
      "textarea[placeholder*='Ask']",
      "textarea[placeholder*='질문']",
      "textarea"
    ],
    inputType: "contenteditable",
    submitSelector: "button[aria-label*='Submit'][type='submit'], button[type='submit'][aria-label*='검색'], button[aria-label*='submit' i], button[aria-label*='제출' i]",
    submitMethod: "click",
    selectorCheckMode: "input-and-conditional-submit",
    waitMs: 2e3,
    fallback: true,
    lastVerified: "2026-05",
    verifiedAt: "2026-05-10",
    verifiedRoute: "/",
    verifiedAuthState: "soft-gated",
    verifiedLocale: "en-US",
    verifiedVersion: "perplexity-web-may-2026",
    authSelectors: [
      "input[type='email']",
      "input[type='password']",
      "button[data-testid='login-button']",
      "a[href*='cloudflare.com']",
      "#challenge-running",
      ".cf-browser-verification",
      ".cf-challenge",
      ".cf-turnstile",
      "iframe[src*='challenges.cloudflare.com']"
    ]
  }
]);

// src/shared/sites/constants.ts
var SITE_STORAGE_KEYS = Object.freeze({
  customSites: "customSites",
  builtInSiteStates: "builtInSiteStates",
  builtInSiteOverrides: "builtInSiteOverrides"
});
var VALID_INPUT_TYPES = /* @__PURE__ */ new Set(["textarea", "contenteditable", "input"]);
var VALID_SUBMIT_METHODS = /* @__PURE__ */ new Set(["click", "enter", "shift+enter"]);
var VALID_SELECTOR_CHECK_MODES = /* @__PURE__ */ new Set([
  "input-and-submit",
  "input-and-conditional-submit",
  "input-only"
]);
var VALID_VERIFIED_AUTH_STATES = /* @__PURE__ */ new Set([
  "logged-in",
  "logged-out",
  "soft-gated"
]);
var BUILT_IN_SITE_IDS = new Set(
  AI_SITES.map((site) => String(site?.id ?? "")).filter(Boolean)
);
var BUILT_IN_SITE_STYLE_MAP = Object.freeze({
  chatgpt: { color: "#10a37f", icon: "GPT" },
  gemini: { color: "#4285f4", icon: "Gem" },
  claude: { color: "#d97706", icon: "Cl" },
  grok: { color: "#000000", icon: "Gk" },
  perplexity: { color: "#20808d", icon: "Px" }
});

// src/shared/sites/normalizers/core.ts
function safeText2(value) {
  return typeof value === "string" ? value.trim() : "";
}
function normalizeBoolean2(value, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}
function normalizeWaitMs(value, fallback = 2e3) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(8e3, Math.max(500, Math.round(numeric)));
}
function normalizeColor(value, fallback = "#c24f2e") {
  const color = safeText2(value);
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}
function normalizeIcon(value, fallback = "AI") {
  const icon = safeText2(value);
  return icon ? Array.from(icon).slice(0, 2).join("") : fallback;
}
function normalizeInputType(value, fallback = "textarea") {
  const inputType = safeText2(value);
  return VALID_INPUT_TYPES.has(inputType) ? inputType : fallback;
}
function normalizeSubmitMethod(value, fallback = "click") {
  const submitMethod = safeText2(value);
  return VALID_SUBMIT_METHODS.has(submitMethod) ? submitMethod : fallback;
}
function normalizeSelectorCheckMode(value, fallback = "input-and-submit") {
  const selectorCheckMode = safeText2(value);
  return VALID_SELECTOR_CHECK_MODES.has(selectorCheckMode) ? selectorCheckMode : fallback;
}
function normalizeHostname(value) {
  const input = safeText2(value).replace(/\/+$/g, "");
  if (!input) {
    return "";
  }
  try {
    return new URL(input).hostname.toLowerCase();
  } catch (_error) {
    return input.toLowerCase();
  }
}
function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => safeText2(entry)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/\r?\n/g).map((entry) => safeText2(entry)).filter(Boolean);
  }
  return [];
}
function normalizeHostnameAliases(value, primaryHostname = "") {
  const normalizedPrimaryHostname = normalizeHostname(primaryHostname);
  return Array.from(
    new Set(
      normalizeStringList(value).map((entry) => normalizeHostname(entry)).filter((entry) => entry && entry !== normalizedPrimaryHostname)
    )
  );
}
function deriveHostname(url) {
  try {
    return new URL(String(url ?? "")).hostname;
  } catch (_error) {
    return "";
  }
}
function normalizeOriginHost(value) {
  const input = safeText2(value).replace(/\/+$/g, "");
  if (!input) {
    return "";
  }
  try {
    const parsed = new URL(input);
    if (parsed.host) {
      return parsed.host.toLowerCase();
    }
  } catch (_error) {
  }
  try {
    return new URL(`https://${input}`).host.toLowerCase();
  } catch (_nestedError) {
    return input.toLowerCase();
  }
}
function buildOriginPatterns(url, hostnameAliases = []) {
  try {
    const parsed = new URL(String(url ?? ""));
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return [];
    }
    const primaryHost = normalizeOriginHost(parsed.host);
    const primaryHostname = normalizeHostname(parsed.hostname);
    const normalizedAliases = Array.from(
      new Set(
        normalizeStringList(hostnameAliases).map((entry) => normalizeOriginHost(entry)).filter(
          (entry) => entry && entry !== primaryHost && entry !== primaryHostname
        )
      )
    );
    return Array.from(
      new Set(
        [primaryHost, ...normalizedAliases].filter(Boolean).map((host) => `${parsed.protocol}//${host}/*`)
      )
    );
  } catch (_error) {
    return [];
  }
}
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function stringifyComparable(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch (_error) {
    return "";
  }
}

// src/shared/sites/normalizers/ids.ts
function createCustomSiteId(name) {
  const slug = safeText2(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  return `custom-${slug || Date.now()}-${Date.now().toString(36).slice(-4)}`;
}

// src/shared/sites/verification.ts
var ISO_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
var ISO_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}
function hasOwnKey(value, key) {
  return Boolean(value) && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, key);
}
function resolveTextField(primary, fallback, key) {
  if (hasOwnKey(primary, key)) {
    return normalizeText(primary[key]);
  }
  return normalizeText(fallback[key]);
}
function normalizeLegacyLastVerified(value) {
  const normalized = normalizeText(value);
  return ISO_MONTH_PATTERN.test(normalized) ? normalized : "";
}
function normalizeVerifiedAt(value) {
  const normalized = normalizeText(value);
  return ISO_DATE_PATTERN.test(normalized) ? normalized : "";
}
function normalizeVerifiedAuthState(value) {
  const normalized = normalizeText(value);
  return VALID_VERIFIED_AUTH_STATES.has(normalized) ? normalized : "";
}
function deriveLegacyLastVerified(verifiedAt) {
  return normalizeVerifiedAt(verifiedAt).slice(0, 7);
}
function buildVerificationMetadata(primaryValue, fallbackValue = {}) {
  const primary = primaryValue && typeof primaryValue === "object" && !Array.isArray(primaryValue) ? primaryValue : {};
  const fallback = fallbackValue && typeof fallbackValue === "object" && !Array.isArray(fallbackValue) ? fallbackValue : {};
  const primaryHasVerifiedAt = hasOwnKey(primary, "verifiedAt");
  const primaryVerifiedAt = normalizeVerifiedAt(primary.verifiedAt);
  const fallbackVerifiedAt = normalizeVerifiedAt(fallback.verifiedAt);
  const verifiedAt = primaryHasVerifiedAt ? primaryVerifiedAt : primaryVerifiedAt || fallbackVerifiedAt;
  const lastVerified = verifiedAt ? deriveLegacyLastVerified(verifiedAt) : primaryHasVerifiedAt ? "" : normalizeLegacyLastVerified(primary.lastVerified) || normalizeLegacyLastVerified(fallback.lastVerified);
  return {
    lastVerified,
    verifiedAt,
    verifiedRoute: resolveTextField(primary, fallback, "verifiedRoute"),
    verifiedAuthState: hasOwnKey(primary, "verifiedAuthState") ? normalizeVerifiedAuthState(primary.verifiedAuthState) : normalizeVerifiedAuthState(primary.verifiedAuthState) || normalizeVerifiedAuthState(fallback.verifiedAuthState),
    verifiedLocale: resolveTextField(primary, fallback, "verifiedLocale"),
    verifiedVersion: resolveTextField(primary, fallback, "verifiedVersion")
  };
}

// src/shared/sites/selector-utils.ts
var AUTH_PATH_SEGMENTS = Object.freeze([
  "/login",
  "/logout",
  "/sign-in",
  "/signin",
  "/auth"
]);
var SETTINGS_PATH_SEGMENTS = Object.freeze([
  "/settings",
  "/preferences",
  "/account",
  "/billing"
]);
function normalizePathname(pathname) {
  return typeof pathname === "string" ? pathname.trim().toLowerCase() : "";
}
function hasPathSegment(pathname, segments) {
  const normalizedPathname = normalizePathname(pathname);
  return segments.some((segment) => normalizedPathname.includes(segment));
}
function hasKnownAuthPath(pathname) {
  return hasPathSegment(pathname, AUTH_PATH_SEGMENTS);
}
function hasKnownSettingsPath(pathname) {
  return hasPathSegment(pathname, SETTINGS_PATH_SEGMENTS);
}
function normalizeRoutePrefix(value) {
  const normalized = normalizePathname(value);
  if (!normalized) {
    return "";
  }
  const basePath = normalized.split("#")[0]?.split("?")[0] ?? "";
  if (!basePath.startsWith("/")) {
    return "";
  }
  const trimmed = basePath.replace(/\/+$/g, "");
  return trimmed || "/";
}
function normalizeSupportedRoutes(value) {
  const rawEntries = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n/g) : [];
  return Array.from(
    new Set(
      rawEntries.map((entry) => normalizeRoutePrefix(entry)).filter(Boolean)
    )
  );
}
function getConfiguredSupportedRoutes(site) {
  const explicitRoutes = normalizeSupportedRoutes(site?.supportedRoutes);
  if (explicitRoutes.length > 0) {
    return explicitRoutes;
  }
  const fallbackRoute = normalizeRoutePrefix(site?.verifiedRoute);
  return fallbackRoute && fallbackRoute !== "/" ? [fallbackRoute] : [];
}
function routePrefixMatches(pathname, prefix) {
  if (prefix === "/") {
    return true;
  }
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
function isPathnameSupported(pathname, supportedRoutes) {
  const routes = normalizeSupportedRoutes(supportedRoutes);
  if (routes.length === 0) {
    return true;
  }
  const normalizedPathname = normalizeRoutePrefix(pathname) || "/";
  return routes.some((prefix) => routePrefixMatches(normalizedPathname, prefix));
}
function isSitePathSupported(site, pathname) {
  return isPathnameSupported(pathname, getConfiguredSupportedRoutes(site));
}
function getSitePathBlockReason(site, pathname) {
  if (hasKnownAuthPath(pathname)) {
    return "auth_path";
  }
  if (hasKnownSettingsPath(pathname)) {
    return "settings_path";
  }
  if (!isSitePathSupported(site, pathname)) {
    return "unsupported_route";
  }
  return "";
}
function splitSelectorList(selectorGroup) {
  const source = typeof selectorGroup === "string" ? selectorGroup.trim() : "";
  if (!source) {
    return [];
  }
  const parts = [];
  let current = "";
  let bracketDepth = 0;
  let parenDepth = 0;
  let quote = null;
  let escaping = false;
  for (const character of source) {
    current += character;
    if (escaping) {
      escaping = false;
      continue;
    }
    if (character === "\\") {
      escaping = true;
      continue;
    }
    if (quote) {
      if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === "[") {
      bracketDepth += 1;
      continue;
    }
    if (character === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }
    if (character === "(") {
      parenDepth += 1;
      continue;
    }
    if (character === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }
    if (character === "," && bracketDepth === 0 && parenDepth === 0) {
      current = current.slice(0, -1);
      const normalized = current.trim();
      if (normalized) {
        parts.push(normalized);
      }
      current = "";
    }
  }
  const trailing = current.trim();
  if (trailing) {
    parts.push(trailing);
  }
  return parts;
}
function normalizeSelectorEntries(selectors) {
  const rawSelectors = Array.isArray(selectors) ? selectors : [selectors];
  return rawSelectors.filter((selector) => typeof selector === "string" && Boolean(selector.trim())).flatMap((selector) => splitSelectorList(selector)).filter((selector, index, entries) => entries.indexOf(selector) === index);
}
function buildSubmitRequirement(options) {
  if (options?.submitMethod !== "click") {
    return "none";
  }
  if (typeof options?.submitSelector !== "string" || !options.submitSelector.trim()) {
    return "none";
  }
  if (options?.selectorCheckMode === "input-and-conditional-submit") {
    return "conditional";
  }
  if (options?.selectorCheckMode === "input-only") {
    return "none";
  }
  return "required";
}
function shouldRequireVisibleSubmitSurface(submitRequirement) {
  return submitRequirement === "required";
}

// src/shared/sites/normalizers/site-records.ts
var BUILT_IN_SITE_STYLE_LOOKUP = BUILT_IN_SITE_STYLE_MAP;
var PERPLEXITY_PRIMARY_INPUT_SELECTOR = "#ask-input[data-lexical-editor='true'][role='textbox']";
var PERPLEXITY_SELECTOR_FALLBACKS = [
  "div#ask-input[data-lexical-editor='true'][role='textbox']",
  "div#ask-input[contenteditable='true'][role='textbox']",
  "#ask-input[contenteditable='true']",
  "div[contenteditable='true'][role='textbox']"
];
function normalizeSelectorArray(value) {
  return Array.isArray(value) ? value.filter(
    (entry) => typeof entry === "string" && Boolean(entry.trim())
  ).map((entry) => entry.trim()) : [];
}
function normalizePerplexitySelectors(site = {}) {
  if (safeText2(site?.id) !== "perplexity") {
    return {
      inputSelector: safeText2(site?.inputSelector),
      fallbackSelectors: normalizeSelectorArray(site?.fallbackSelectors)
    };
  }
  const overrideInputSelector = safeText2(site?.inputSelector);
  const fallbackSelectors = normalizeSelectorArray(site?.fallbackSelectors);
  const mergedFallbackSelectors = Array.from(
    new Set(
      [
        overrideInputSelector && overrideInputSelector !== PERPLEXITY_PRIMARY_INPUT_SELECTOR ? overrideInputSelector : "",
        ...fallbackSelectors,
        ...PERPLEXITY_SELECTOR_FALLBACKS
      ].filter(Boolean)
    )
  );
  return {
    inputSelector: PERPLEXITY_PRIMARY_INPUT_SELECTOR,
    fallbackSelectors: mergedFallbackSelectors
  };
}
function normalizeTrimmedStringArray(value) {
  return Array.isArray(value) ? value.filter(
    (entry) => typeof entry === "string" && Boolean(entry.trim())
  ) : [];
}
function buildBaseSiteRecord(site, builtInMeta = {}) {
  const style = BUILT_IN_SITE_STYLE_LOOKUP[safeText2(site.id)] ?? {};
  const url = safeText2(site.url);
  const hostname = normalizeHostname(site.hostname || deriveHostname(url));
  const hostnameAliases = normalizeHostnameAliases(site.hostnameAliases, hostname);
  const normalizedSelectors = normalizePerplexitySelectors(site);
  const verification = buildVerificationMetadata(site);
  const supportedRoutes = getConfiguredSupportedRoutes(site);
  const verifiedAuthState = verification.verifiedAuthState || void 0;
  return {
    id: safeText2(site.id),
    name: safeText2(site.name) || "AI Service",
    url,
    hostname,
    hostnameAliases,
    supportedRoutes,
    inputSelector: normalizedSelectors.inputSelector,
    inputType: normalizeInputType(site.inputType, "textarea"),
    submitSelector: safeText2(site.submitSelector),
    submitMethod: normalizeSubmitMethod(site.submitMethod, "click"),
    selectorCheckMode: normalizeSelectorCheckMode(
      site.selectorCheckMode,
      "input-and-submit"
    ),
    waitMs: normalizeWaitMs(site.waitMs, 2e3),
    fallbackSelectors: normalizedSelectors.fallbackSelectors,
    fallback: normalizeBoolean2(site.fallback, true),
    authSelectors: normalizeTrimmedStringArray(site.authSelectors),
    lastVerified: verification.lastVerified,
    verifiedAt: verification.verifiedAt,
    verifiedRoute: verification.verifiedRoute,
    verifiedAuthState,
    verifiedLocale: verification.verifiedLocale,
    verifiedVersion: verification.verifiedVersion,
    enabled: normalizeBoolean2(site.enabled, true),
    color: normalizeColor(site.color, style.color ?? "#c24f2e"),
    icon: normalizeIcon(site.icon, style.icon ?? "AI"),
    isBuiltIn: Boolean(builtInMeta.isBuiltIn),
    isCustom: Boolean(builtInMeta.isCustom),
    deletable: Boolean(builtInMeta.isCustom),
    editable: true,
    permissionPatterns: buildOriginPatterns(url, hostnameAliases)
  };
}
function sanitizeBuiltInOverride(override = {}, originalSite = {}) {
  const submitMethod = normalizeSubmitMethod(
    override.submitMethod,
    normalizeSubmitMethod(originalSite.submitMethod, "click")
  );
  const submitSelector = submitMethod === "click" ? safeText2(override.submitSelector) || safeText2(originalSite.submitSelector) : safeText2(override.submitSelector);
  const verification = buildVerificationMetadata(override, originalSite);
  const supportedRoutes = Object.prototype.hasOwnProperty.call(
    override ?? {},
    "supportedRoutes"
  ) ? normalizeSupportedRoutes(override.supportedRoutes) : getConfiguredSupportedRoutes(originalSite);
  const verifiedAuthState = verification.verifiedAuthState || void 0;
  return {
    name: safeText2(override.name) || safeText2(originalSite.name),
    supportedRoutes,
    inputSelector: safeText2(override.inputSelector) || safeText2(originalSite.inputSelector),
    inputType: normalizeInputType(
      override.inputType,
      normalizeInputType(originalSite.inputType, "textarea")
    ),
    submitSelector,
    submitMethod,
    selectorCheckMode: normalizeSelectorCheckMode(
      override.selectorCheckMode,
      normalizeSelectorCheckMode(
        originalSite.selectorCheckMode,
        "input-and-submit"
      )
    ),
    waitMs: normalizeWaitMs(
      override.waitMs,
      normalizeWaitMs(originalSite.waitMs, 2e3)
    ),
    fallbackSelectors: Array.isArray(override.fallbackSelectors) ? normalizeTrimmedStringArray(override.fallbackSelectors) : Array.isArray(originalSite.fallbackSelectors) ? normalizeTrimmedStringArray(originalSite.fallbackSelectors) : [],
    authSelectors: Array.isArray(override.authSelectors) ? normalizeTrimmedStringArray(override.authSelectors) : Array.isArray(originalSite.authSelectors) ? normalizeTrimmedStringArray(originalSite.authSelectors) : [],
    lastVerified: verification.lastVerified,
    verifiedAt: verification.verifiedAt,
    verifiedRoute: verification.verifiedRoute,
    verifiedAuthState,
    verifiedLocale: verification.verifiedLocale,
    verifiedVersion: verification.verifiedVersion,
    color: normalizeColor(
      override.color,
      BUILT_IN_SITE_STYLE_LOOKUP[safeText2(originalSite.id)]?.color ?? "#c24f2e"
    ),
    icon: normalizeIcon(
      override.icon,
      BUILT_IN_SITE_STYLE_LOOKUP[safeText2(originalSite.id)]?.icon ?? safeText2(originalSite.name)
    )
  };
}
function normalizeCustomSite(site) {
  const source = isPlainObject(site) ? site : {};
  const url = safeText2(source?.url);
  const hostname = normalizeHostname(source?.hostname || deriveHostname(url));
  const verificationFields = {};
  if (Object.prototype.hasOwnProperty.call(source, "lastVerified")) {
    verificationFields.lastVerified = safeText2(source?.lastVerified);
  }
  if (Object.prototype.hasOwnProperty.call(source, "verifiedAt")) {
    verificationFields.verifiedAt = safeText2(source?.verifiedAt);
  }
  if (Object.prototype.hasOwnProperty.call(source, "verifiedRoute")) {
    verificationFields.verifiedRoute = safeText2(source?.verifiedRoute);
  }
  if (Object.prototype.hasOwnProperty.call(source, "verifiedAuthState")) {
    verificationFields.verifiedAuthState = safeText2(source?.verifiedAuthState);
  }
  if (Object.prototype.hasOwnProperty.call(source, "verifiedLocale")) {
    verificationFields.verifiedLocale = safeText2(source?.verifiedLocale);
  }
  if (Object.prototype.hasOwnProperty.call(source, "verifiedVersion")) {
    verificationFields.verifiedVersion = safeText2(source?.verifiedVersion);
  }
  return buildBaseSiteRecord(
    {
      id: safeText2(source?.id) || createCustomSiteId(source?.name),
      name: safeText2(source?.name) || "Custom AI",
      url,
      hostname,
      hostnameAliases: normalizeHostnameAliases(source?.hostnameAliases, hostname),
      supportedRoutes: Object.prototype.hasOwnProperty.call(
        source,
        "supportedRoutes"
      ) ? source?.supportedRoutes : void 0,
      inputSelector: safeText2(source?.inputSelector),
      inputType: normalizeInputType(source?.inputType, "textarea"),
      submitSelector: safeText2(source?.submitSelector),
      submitMethod: normalizeSubmitMethod(source?.submitMethod, "click"),
      selectorCheckMode: normalizeSelectorCheckMode(
        source?.selectorCheckMode,
        "input-and-submit"
      ),
      waitMs: normalizeWaitMs(source?.waitMs, 2e3),
      fallbackSelectors: normalizeStringList(source?.fallbackSelectors),
      fallback: normalizeBoolean2(source?.fallback, true),
      authSelectors: normalizeStringList(source?.authSelectors),
      ...verificationFields,
      enabled: normalizeBoolean2(source?.enabled, true),
      color: normalizeColor(source?.color, "#c24f2e"),
      icon: normalizeIcon(source?.icon, "AI")
    },
    { isCustom: true }
  );
}

// src/shared/sites/hostname-aliases.ts
function validateBareHostPort(value) {
  const hostPortPattern = /^(?<host>[a-z0-9.-]+)(?::(?<port>\d{1,5}))?$/i;
  const match = value.match(hostPortPattern);
  if (!match?.groups?.host) {
    return "";
  }
  const host = match.groups.host.toLowerCase();
  const port = match.groups.port;
  if (host.startsWith(".") || host.endsWith(".") || host.includes("..") || !/[a-z]/i.test(host)) {
    return "";
  }
  if (port) {
    const numericPort = Number(port);
    if (!Number.isInteger(numericPort) || numericPort <= 0 || numericPort > 65535) {
      return "";
    }
    return `${host}:${numericPort}`;
  }
  return host;
}
function normalizeHostnameAliasEntry(value) {
  const input = safeText2(value);
  if (!input) {
    return "";
  }
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.host.toLowerCase();
  } catch (_error) {
    return validateBareHostPort(input);
  }
}
function validateHostnameAliases(value) {
  const entries = Array.isArray(value) ? value : [];
  const errors = [];
  const normalizedHosts = /* @__PURE__ */ new Set();
  entries.forEach((entry, index) => {
    const rawInput = typeof entry === "string" ? entry : "";
    const rawValue = safeText2(entry);
    if (!rawValue) {
      return;
    }
    if (rawInput && rawInput !== rawInput.trim()) {
      errors.push(`Hostname alias line ${index + 1} must not include leading or trailing whitespace.`);
      return;
    }
    const normalized = normalizeHostnameAliasEntry(rawValue);
    if (!normalized) {
      errors.push(`Hostname alias line ${index + 1} must be a host[:port] or http/https URL.`);
      return;
    }
    normalizedHosts.add(normalized);
  });
  return {
    valid: errors.length === 0,
    normalizedHosts: [...normalizedHosts],
    errors
  };
}

// src/shared/security.ts
function isValidURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_error) {
    return false;
  }
}

// src/shared/sites/validation.ts
function pushFieldError(fieldErrors, field, message) {
  if (!message) {
    return;
  }
  const current = fieldErrors[field] ?? [];
  current.push(message);
  fieldErrors[field] = current;
}
function validateSiteDraft(draft, { isBuiltIn = false } = {}) {
  const errors = [];
  const fieldErrors = {};
  const name = safeText2(draft?.name);
  const url = safeText2(draft?.url);
  const inputSelector = safeText2(draft?.inputSelector);
  if (!name) {
    pushFieldError(fieldErrors, "name", "Service name is required.");
  }
  if (!isBuiltIn && !url) {
    pushFieldError(fieldErrors, "url", "Service URL is required.");
  }
  if (url && !isValidURL(url)) {
    pushFieldError(fieldErrors, "url", "Service URL must be a valid http or https URL.");
  }
  if (!inputSelector) {
    pushFieldError(fieldErrors, "inputSelector", "Input selector is required.");
  }
  if (!VALID_INPUT_TYPES.has(safeText2(draft?.inputType))) {
    pushFieldError(fieldErrors, "inputType", "Input type is invalid.");
  }
  if (!VALID_SUBMIT_METHODS.has(safeText2(draft?.submitMethod))) {
    pushFieldError(fieldErrors, "submitMethod", "Submit method is invalid.");
  }
  const selectorCheckMode = safeText2(draft?.selectorCheckMode);
  if (selectorCheckMode && !VALID_SELECTOR_CHECK_MODES.has(selectorCheckMode)) {
    pushFieldError(fieldErrors, "selectorCheckMode", "Selector check mode is invalid.");
  }
  const verifiedAt = safeText2(draft?.verifiedAt);
  if (verifiedAt && normalizeVerifiedAt(verifiedAt) !== verifiedAt) {
    pushFieldError(fieldErrors, "verifiedAt", "Verified date must use YYYY-MM-DD.");
  }
  const verifiedAuthState = safeText2(draft?.verifiedAuthState);
  if (verifiedAuthState && !VALID_VERIFIED_AUTH_STATES.has(verifiedAuthState)) {
    pushFieldError(fieldErrors, "verifiedAuthState", "Verified auth state is invalid.");
  }
  if (safeText2(draft?.submitMethod) === "click" && !safeText2(draft?.submitSelector)) {
    pushFieldError(fieldErrors, "submitSelector", "Submit selector is required when using click submit.");
  }
  const aliasValidation = validateHostnameAliases(draft?.hostnameAliases);
  aliasValidation.errors.forEach((message) => pushFieldError(fieldErrors, "hostnameAliases", message));
  const rawSupportedRoutes = Array.isArray(draft?.supportedRoutes) ? draft.supportedRoutes : typeof draft?.supportedRoutes === "string" ? draft.supportedRoutes.split(/\r?\n/g) : [];
  const invalidSupportedRoutes = rawSupportedRoutes.map((entry) => safeText2(entry).trim()).filter(Boolean).filter((route) => !route.startsWith("/") || route.includes("?") || route.includes("#"));
  if (invalidSupportedRoutes.length > 0) {
    pushFieldError(
      fieldErrors,
      "supportedRoutes",
      "Supported routes must use path prefixes that start with / and must not include query strings or hashes."
    );
  }
  Object.values(fieldErrors).forEach((messages) => {
    (messages ?? []).forEach((message) => {
      errors.push(message);
    });
  });
  return {
    valid: errors.length === 0,
    errors,
    fieldErrors
  };
}

// src/shared/sites/import-repair.ts
function asPlainRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function detectBuiltInOverrideAdjustment(rawEntry, sanitized, source) {
  const rawRecord = asPlainRecord(rawEntry);
  if (!isPlainObject(rawRecord)) {
    return true;
  }
  const allowedKeys = /* @__PURE__ */ new Set([
    "name",
    "supportedRoutes",
    "inputSelector",
    "inputType",
    "submitSelector",
    "submitMethod",
    "selectorCheckMode",
    "waitMs",
    "fallbackSelectors",
    "authSelectors",
    "lastVerified",
    "verifiedAt",
    "verifiedRoute",
    "verifiedAuthState",
    "verifiedLocale",
    "verifiedVersion",
    "color",
    "icon"
  ]);
  if (Object.keys(rawRecord).some((key) => !allowedKeys.has(key))) {
    return true;
  }
  const simpleComparisons = [
    ["name", safeText2(rawRecord.name), sanitized.name],
    ["supportedRoutes", stringifyComparable(normalizeSupportedRoutes(rawRecord.supportedRoutes)), stringifyComparable(sanitized.supportedRoutes)],
    ["inputSelector", safeText2(rawRecord.inputSelector), sanitized.inputSelector],
    ["inputType", safeText2(rawRecord.inputType), sanitized.inputType],
    ["submitSelector", safeText2(rawRecord.submitSelector), sanitized.submitSelector],
    ["submitMethod", safeText2(rawRecord.submitMethod), sanitized.submitMethod],
    ["selectorCheckMode", safeText2(rawRecord.selectorCheckMode), sanitized.selectorCheckMode],
    ["lastVerified", safeText2(rawRecord.lastVerified), sanitized.lastVerified],
    ["verifiedAt", safeText2(rawRecord.verifiedAt), sanitized.verifiedAt],
    ["verifiedRoute", safeText2(rawRecord.verifiedRoute), sanitized.verifiedRoute],
    ["verifiedAuthState", safeText2(rawRecord.verifiedAuthState), sanitized.verifiedAuthState],
    ["verifiedLocale", safeText2(rawRecord.verifiedLocale), sanitized.verifiedLocale],
    ["verifiedVersion", safeText2(rawRecord.verifiedVersion), sanitized.verifiedVersion],
    ["color", safeText2(rawRecord.color), sanitized.color],
    ["icon", safeText2(rawRecord.icon), sanitized.icon]
  ];
  for (const [key, rawValue, sanitizedValue] of simpleComparisons) {
    if (Object.prototype.hasOwnProperty.call(rawRecord, key) && rawValue !== sanitizedValue) {
      return true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(rawRecord, "waitMs") && normalizeWaitMs(
    rawRecord.waitMs,
    typeof source.waitMs === "number" ? source.waitMs : void 0
  ) !== sanitized.waitMs) {
    return true;
  }
  if (Array.isArray(rawRecord.fallbackSelectors) && stringifyComparable(rawRecord.fallbackSelectors.filter((entry) => typeof entry === "string" && entry.trim())) !== stringifyComparable(sanitized.fallbackSelectors)) {
    return true;
  }
  if (Array.isArray(rawRecord.authSelectors) && stringifyComparable(rawRecord.authSelectors.filter((entry) => typeof entry === "string" && entry.trim())) !== stringifyComparable(sanitized.authSelectors)) {
    return true;
  }
  return false;
}
function repairImportedBuiltInStates(value) {
  if (!isPlainObject(value)) {
    return {
      normalized: {},
      appliedIds: [],
      droppedIds: []
    };
  }
  const normalized = {};
  const appliedIds = [];
  const droppedIds = [];
  for (const [key, entry] of Object.entries(asPlainRecord(value))) {
    if (!BUILT_IN_SITE_IDS.has(key)) {
      droppedIds.push(key);
      continue;
    }
    const entryRecord = asPlainRecord(entry);
    normalized[key] = { enabled: normalizeBoolean2(entryRecord.enabled, true) };
    appliedIds.push(key);
  }
  return {
    normalized,
    appliedIds,
    droppedIds
  };
}
function repairImportedBuiltInOverrides(value) {
  if (!isPlainObject(value)) {
    return {
      normalized: {},
      appliedIds: [],
      droppedIds: [],
      adjustedIds: []
    };
  }
  const normalized = {};
  const appliedIds = [];
  const droppedIds = [];
  const adjustedIds = [];
  for (const [key, entry] of Object.entries(asPlainRecord(value))) {
    const source = AI_SITES.find((site) => site.id === key);
    if (!source) {
      droppedIds.push(key);
      continue;
    }
    const sourceRecord = source;
    const entryRecord = asPlainRecord(entry);
    const sanitized = sanitizeBuiltInOverride(entryRecord, sourceRecord);
    const mergedDraft = {
      ...sourceRecord,
      ...sanitized
    };
    const validation = validateSiteDraft(mergedDraft, { isBuiltIn: true });
    const finalOverride = validation.valid ? sanitized : sanitizeBuiltInOverride({}, sourceRecord);
    normalized[key] = finalOverride;
    appliedIds.push(key);
    if (!validation.valid || detectBuiltInOverrideAdjustment(entryRecord, finalOverride, sourceRecord)) {
      adjustedIds.push(key);
    }
  }
  return {
    normalized,
    appliedIds,
    droppedIds,
    adjustedIds
  };
}

// src/shared/sites/storage.ts
async function readLocal2(key, fallbackValue) {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? fallbackValue;
}
async function writeLocal2(key, value) {
  await chrome.storage.local.set({ [key]: value });
}
async function getCustomSites() {
  const rawSites = await readLocal2(SITE_STORAGE_KEYS.customSites, []);
  return Array.isArray(rawSites) ? rawSites.map((site) => normalizeCustomSite(site)) : [];
}
async function getBuiltInSiteStates() {
  const rawStates = await readLocal2(SITE_STORAGE_KEYS.builtInSiteStates, {});
  return repairImportedBuiltInStates(rawStates).normalized;
}
async function getBuiltInSiteOverrides() {
  const rawOverrides = await readLocal2(SITE_STORAGE_KEYS.builtInSiteOverrides, {});
  return repairImportedBuiltInOverrides(rawOverrides).normalized;
}
async function resetStoredSiteSettings() {
  await Promise.all([
    writeLocal2(SITE_STORAGE_KEYS.customSites, []),
    writeLocal2(SITE_STORAGE_KEYS.builtInSiteStates, {}),
    writeLocal2(SITE_STORAGE_KEYS.builtInSiteOverrides, {})
  ]);
}

// src/shared/sites/runtime-sites.ts
function getCustomSitePermissionPatterns(site) {
  return Array.isArray(site?.permissionPatterns) ? site.permissionPatterns.filter((pattern) => typeof pattern === "string" && pattern.trim()) : [];
}
function collectCustomSitePermissionPatterns(sites = []) {
  return new Set(
    (Array.isArray(sites) ? sites : []).flatMap((site) => getCustomSitePermissionPatterns(site)).filter(Boolean)
  );
}
async function cleanupUnusedCustomSitePermissions(previousSites = [], nextSites = []) {
  const nextOrigins = collectCustomSitePermissionPatterns(nextSites);
  const removableOrigins = [...collectCustomSitePermissionPatterns(previousSites)].filter(
    (origin) => !nextOrigins.has(origin)
  );
  if (removableOrigins.length === 0 || !chrome.permissions?.remove) {
    return [];
  }
  try {
    const removed = await chrome.permissions.remove({ origins: removableOrigins });
    return removed ? removableOrigins : [];
  } catch (_error) {
    return [];
  }
}
async function getRuntimeSites() {
  const [customSites, builtInStates, builtInOverrides] = await Promise.all([
    getCustomSites(),
    getBuiltInSiteStates(),
    getBuiltInSiteOverrides()
  ]);
  const builtInSites = AI_SITES.map((site) => {
    const override = builtInOverrides[site.id] ?? {};
    const state = builtInStates[site.id] ?? {};
    return buildBaseSiteRecord(
      {
        ...site,
        ...override,
        enabled: normalizeBoolean2(state.enabled, true)
      },
      { isBuiltIn: true }
    );
  });
  return [...builtInSites, ...customSites];
}
async function getEnabledRuntimeSites() {
  const sites = await getRuntimeSites();
  return sites.filter((site) => site.enabled);
}
async function resetSiteSettings() {
  const customSites = await getCustomSites();
  await resetStoredSiteSettings();
  await cleanupUnusedCustomSitePermissions(customSites, []);
}

// src/shared/prompts/template-cache-store.ts
async function getTemplateVariableCache() {
  const rawCache = await readLocal(LOCAL_STORAGE_KEYS.templateVariableCache, {});
  return normalizeTemplateDefaults(rawCache);
}
async function setTemplateVariableCache(cache) {
  const normalized = normalizeTemplateDefaults(cache);
  await writeLocal(LOCAL_STORAGE_KEYS.templateVariableCache, normalized);
  return normalized;
}

// src/shared/prompts/experiment-limits.ts
function getPromptExperimentRunStats(experiment) {
  const variantCount = experiment.variants.filter((variant) => variant.text.trim()).length;
  const variableSetCount = experiment.variableSets.length > 0 ? experiment.variableSets.length : 1;
  const broadcastCount = variantCount * variableSetCount;
  const targetSiteCount = experiment.targetSiteIds.length;
  return {
    broadcastCount,
    serviceSendCount: broadcastCount * targetSiteCount,
    targetSiteCount
  };
}
function evaluatePromptExperimentRunLimit(experiment, confirmedLargeRun = false) {
  const stats = getPromptExperimentRunStats(experiment);
  if (stats.broadcastCount > EXPERIMENT_HARD_BROADCAST_LIMIT) {
    return {
      ...stats,
      ok: false,
      requiresConfirmation: false,
      reason: "hard_limit"
    };
  }
  if (stats.broadcastCount > EXPERIMENT_SOFT_BROADCAST_LIMIT && !confirmedLargeRun) {
    return {
      ...stats,
      ok: false,
      requiresConfirmation: true,
      reason: "confirmation_required"
    };
  }
  return {
    ...stats,
    ok: true,
    requiresConfirmation: stats.broadcastCount > EXPERIMENT_SOFT_BROADCAST_LIMIT,
    reason: ""
  };
}

// src/shared/broadcast/state.ts
function clonePendingBroadcastRecord(record) {
  return {
    ...record,
    siteIds: [...record.siteIds ?? []],
    submittedSiteIds: [...record.submittedSiteIds ?? []],
    failedSiteIds: [...record.failedSiteIds ?? []],
    siteResults: { ...record.siteResults ?? {} },
    targetSnapshots: ensureBroadcastTargetSnapshots(record.targetSnapshots, record.siteIds, record.prompt),
    openedTabIds: [...record.openedTabIds ?? []],
    targetTabIdsBySiteId: { ...record.targetTabIdsBySiteId ?? {} },
    originFavoriteId: record.originFavoriteId ?? null,
    chainRunId: record.chainRunId ?? null,
    chainStepIndex: record.chainStepIndex === null || record.chainStepIndex === void 0 ? null : Number(record.chainStepIndex),
    chainStepCount: record.chainStepCount === null || record.chainStepCount === void 0 ? null : Number(record.chainStepCount),
    trigger: record.trigger
  };
}
function summarizePendingBroadcastStatus(record) {
  if (!record) {
    return "idle";
  }
  if (record.completed < record.total) {
    return "sending";
  }
  if ((record.submittedSiteIds ?? []).length === 0) {
    return "failed";
  }
  if ((record.failedSiteIds ?? []).length > 0) {
    return "partial";
  }
  return "submitted";
}
function buildPendingBroadcastSummary(record, overrides = {}, now = (/* @__PURE__ */ new Date()).toISOString()) {
  const status = summarizePendingBroadcastStatus(record);
  return {
    broadcastId: record.id,
    status,
    prompt: record.prompt,
    siteIds: [...record.siteIds ?? []],
    total: Number(record.total ?? 0),
    completed: Number(record.completed ?? 0),
    submittedSiteIds: [...record.submittedSiteIds ?? []],
    failedSiteIds: [...record.failedSiteIds ?? []],
    siteResults: { ...record.siteResults ?? {} },
    targetSnapshots: ensureBroadcastTargetSnapshots(record.targetSnapshots, record.siteIds, record.prompt),
    startedAt: record.startedAt ?? now,
    finishedAt: record.completed >= record.total && status !== "sending" ? now : "",
    ...overrides
  };
}
function getUnresolvedPendingBroadcastSiteIds(record) {
  const siteResults = record?.siteResults ?? {};
  return Array.isArray(record?.siteIds) ? record.siteIds.filter((siteId) => !siteResults?.[siteId]) : [];
}
function applyPendingBroadcastSiteResult(record, siteId, resultInput, now = (/* @__PURE__ */ new Date()).toISOString()) {
  if (!record) {
    return {
      summary: null,
      nextRecord: null,
      completedRecord: null
    };
  }
  const normalizedSiteId = typeof siteId === "string" ? siteId.trim() : "";
  if (!normalizedSiteId) {
    return {
      summary: buildPendingBroadcastSummary(record, {}, now),
      nextRecord: clonePendingBroadcastRecord(record),
      completedRecord: null
    };
  }
  if (record.siteResults?.[normalizedSiteId]) {
    return {
      summary: buildPendingBroadcastSummary(record, {}, now),
      nextRecord: clonePendingBroadcastRecord(record),
      completedRecord: null
    };
  }
  const nextRecord = clonePendingBroadcastRecord(record);
  const normalizedResult = typeof resultInput === "string" ? buildSiteInjectionResult(resultInput) : normalizeSiteInjectionResult(resultInput);
  nextRecord.siteResults = {
    ...nextRecord.siteResults ?? {},
    [normalizedSiteId]: normalizedResult
  };
  nextRecord.completed = Object.keys(nextRecord.siteResults).length;
  if (normalizeResultCode(normalizedResult.code) === "submitted") {
    nextRecord.submittedSiteIds = Array.from(
      /* @__PURE__ */ new Set([...nextRecord.submittedSiteIds ?? [], normalizedSiteId])
    );
  } else {
    nextRecord.failedSiteIds = Array.from(
      /* @__PURE__ */ new Set([...nextRecord.failedSiteIds ?? [], normalizedSiteId])
    );
  }
  nextRecord.status = summarizePendingBroadcastStatus(nextRecord);
  const summary = buildPendingBroadcastSummary(
    nextRecord,
    { finishedAt: nextRecord.status === "sending" ? "" : now },
    now
  );
  if (nextRecord.completed >= nextRecord.total) {
    return {
      summary,
      nextRecord: null,
      completedRecord: nextRecord
    };
  }
  return {
    summary,
    nextRecord,
    completedRecord: null
  };
}

// src/shared/runtime-state/constants.ts
var LOCAL_RUNTIME_KEYS = Object.freeze({
  failedSelectors: "failedSelectors",
  onboardingCompleted: "onboardingCompleted",
  strategyStats: "strategyStats"
});
var SESSION_RUNTIME_KEYS = Object.freeze({
  pendingUiToasts: "pendingUiToasts",
  lastBroadcast: "lastBroadcast",
  pendingSelectorChecks: "pendingSelectorChecks",
  popupFavoriteIntent: "popupFavoriteIntent",
  activeComparisonContext: "activeComparisonContext",
  favoriteRunJobs: "favoriteRunJobs"
});

// src/shared/runtime-state/normalizers.ts
function isPlainObject2(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function safeText3(value) {
  return typeof value === "string" ? value.trim() : "";
}
function normalizeBoolean3(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}
function normalizeIsoDate2(value, fallback = (/* @__PURE__ */ new Date()).toISOString()) {
  if (typeof value !== "string") {
    return fallback;
  }
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}
function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}
function normalizeFailedSelectorEntry(entry) {
  const source = isPlainObject2(entry) ? entry : {};
  return {
    serviceId: safeText3(source.serviceId),
    selector: safeText3(source.selector),
    source: safeText3(source.source),
    timestamp: normalizeIsoDate2(source.timestamp)
  };
}
function normalizeToastAction(action) {
  const source = isPlainObject2(action) ? action : {};
  return {
    id: safeText3(source.id) || `action-${Date.now()}`,
    label: safeText3(source.label) || "Action",
    variant: safeText3(source.variant) || "default"
  };
}
function normalizeUiToast(entry) {
  const source = isPlainObject2(entry) ? entry : {};
  return {
    id: safeText3(source.id) || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message: safeText3(source.message),
    type: safeText3(source.type) || "info",
    duration: Number.isFinite(Number(source.duration)) ? Number(source.duration) : 3e3,
    createdAt: normalizeIsoDate2(source.createdAt),
    actions: normalizeArray(source.actions).map((action) => normalizeToastAction(action)),
    meta: isPlainObject2(source.meta) ? source.meta : {}
  };
}
function normalizeLastBroadcast(value) {
  if (!isPlainObject2(value)) {
    return null;
  }
  return {
    broadcastId: safeText3(value.broadcastId),
    status: safeText3(value.status) || "idle",
    prompt: safeText3(value.prompt),
    siteIds: normalizeArray(value.siteIds).map((siteId) => safeText3(siteId)).filter(Boolean),
    total: Number.isFinite(Number(value.total)) ? Number(value.total) : 0,
    completed: Number.isFinite(Number(value.completed)) ? Number(value.completed) : 0,
    submittedSiteIds: normalizeArray(value.submittedSiteIds).map((siteId) => safeText3(siteId)).filter(Boolean),
    failedSiteIds: normalizeArray(value.failedSiteIds).map((siteId) => safeText3(siteId)).filter(Boolean),
    siteResults: normalizeSiteResultsRecord(value.siteResults),
    targetSnapshots: ensureBroadcastTargetSnapshots(
      value.targetSnapshots,
      value.siteIds,
      value.prompt
    ),
    startedAt: normalizeIsoDate2(value.startedAt),
    finishedAt: safeText3(value.finishedAt) ? normalizeIsoDate2(value.finishedAt) : ""
  };
}

// src/shared/runtime-state/storage.ts
function getStorageArea(area) {
  return area === "session" ? chrome.storage.session : chrome.storage.local;
}
async function readStorage(area, key, fallbackValue) {
  const result = await getStorageArea(area).get(key);
  return result[key] ?? fallbackValue;
}
async function writeStorage(area, key, value) {
  await getStorageArea(area).set({ [key]: value });
}
async function removeStorageKeys(area, keys) {
  if (!Array.isArray(keys) || keys.length === 0) {
    return;
  }
  await getStorageArea(area).remove(keys);
}

// src/shared/runtime-state/failed-selectors.ts
async function getFailedSelectors() {
  const rawValue = await readStorage("local", LOCAL_RUNTIME_KEYS.failedSelectors, []);
  return normalizeArray(rawValue).map((entry) => normalizeFailedSelectorEntry(entry)).filter((entry) => entry.serviceId);
}
async function setFailedSelectors(entries) {
  const normalized = normalizeArray(entries).map((entry) => normalizeFailedSelectorEntry(entry)).filter((entry) => entry.serviceId);
  await writeStorage("local", LOCAL_RUNTIME_KEYS.failedSelectors, normalized);
  return normalized;
}
async function markFailedSelector(serviceId, selector = "", source = "injector") {
  const normalizedServiceId = safeText3(serviceId);
  if (!normalizedServiceId) {
    return [];
  }
  const current = await getFailedSelectors();
  const next = [
    {
      serviceId: normalizedServiceId,
      selector: safeText3(selector),
      source: safeText3(source),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    },
    ...current.filter((entry) => entry.serviceId !== normalizedServiceId)
  ];
  return setFailedSelectors(next);
}
async function clearFailedSelector(serviceId) {
  const normalizedServiceId = safeText3(serviceId);
  const current = await getFailedSelectors();
  const next = current.filter((entry) => entry.serviceId !== normalizedServiceId);
  await setFailedSelectors(next);
  return next;
}

// src/shared/runtime-state/last-broadcast.ts
async function getLastBroadcast() {
  const value = await readStorage("session", SESSION_RUNTIME_KEYS.lastBroadcast, null);
  return normalizeLastBroadcast(value);
}
async function setLastBroadcast(broadcast) {
  const normalized = normalizeLastBroadcast(broadcast);
  await writeStorage("session", SESSION_RUNTIME_KEYS.lastBroadcast, normalized);
  return normalized;
}

// src/shared/runtime-state/active-comparison.ts
var ACTIVE_COMPARISON_CONTEXT_TTL_MS = 30 * 60 * 1e3;
function normalizeActiveComparisonContext(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const source = value;
  const historyId = Math.max(0, Math.round(Number(source.historyId)));
  const serviceId = typeof source.serviceId === "string" && source.serviceId.trim() ? source.serviceId.trim() : "";
  const updatedAt = typeof source.updatedAt === "string" && Number.isFinite(Date.parse(source.updatedAt)) ? new Date(source.updatedAt).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
  if (!historyId || !serviceId) {
    return null;
  }
  return {
    historyId,
    serviceId,
    source: "options-modal",
    updatedAt
  };
}
function isExpired(context) {
  const updatedAt = Date.parse(context.updatedAt);
  return !Number.isFinite(updatedAt) || Date.now() - updatedAt > ACTIVE_COMPARISON_CONTEXT_TTL_MS;
}
async function getActiveComparisonContext() {
  const value = await readStorage("session", SESSION_RUNTIME_KEYS.activeComparisonContext, null);
  const context = normalizeActiveComparisonContext(value);
  if (!context || isExpired(context)) {
    await setActiveComparisonContext(null);
    return null;
  }
  return context;
}
async function setActiveComparisonContext(context) {
  const normalized = normalizeActiveComparisonContext(
    context ? {
      ...context,
      source: "options-modal",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    } : null
  );
  if (!normalized) {
    await removeStorageKeys("session", [SESSION_RUNTIME_KEYS.activeComparisonContext]);
    return null;
  }
  await writeStorage("session", SESSION_RUNTIME_KEYS.activeComparisonContext, normalized);
  return normalized;
}

// src/shared/runtime-state/popup-intent.ts
function normalizePopupFavoriteIntent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const source = value;
  const type = source.type === "run" ? "run" : source.type === "edit" ? "edit" : "";
  const favoriteId = typeof source.favoriteId === "string" ? source.favoriteId.trim() : "";
  if (!type || !favoriteId) {
    return null;
  }
  return {
    type,
    favoriteId,
    reason: typeof source.reason === "string" && source.reason.trim() ? source.reason.trim() : "",
    source: source.source === "popup" || source.source === "scheduled" || source.source === "palette" || source.source === "options" || source.source === "options-edit" ? source.source : void 0,
    createdAt: typeof source.createdAt === "string" && Number.isFinite(Date.parse(source.createdAt)) ? new Date(source.createdAt).toISOString() : (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function setPopupFavoriteIntent(intent) {
  const normalized = normalizePopupFavoriteIntent(intent);
  if (!normalized) {
    await removeStorageKeys("session", [SESSION_RUNTIME_KEYS.popupFavoriteIntent]);
    return null;
  }
  await writeStorage("session", SESSION_RUNTIME_KEYS.popupFavoriteIntent, normalized);
  return normalized;
}

// src/shared/runtime-state/favorite-run-jobs.ts
var TERMINAL_JOB_TTL_MS = 5 * 60 * 1e3;
var MAX_JOB_COUNT = 50;
var favoriteRunJobMutationChain = Promise.resolve();
function normalizeJobStatus(value) {
  if (value === "queued" || value === "running" || value === "completed" || value === "failed" || value === "skipped") {
    return value;
  }
  return "queued";
}
function normalizeIsoDate3(value, fallback = (/* @__PURE__ */ new Date()).toISOString()) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    return fallback;
  }
  return new Date(value).toISOString();
}
function normalizeExecutionContext(value) {
  const source = safeObject(value);
  const tabId = Number(source.tabId);
  const windowId = Number(source.windowId);
  return {
    tabId: Number.isFinite(tabId) ? tabId : null,
    windowId: Number.isFinite(windowId) ? windowId : null,
    url: safeText(source.url),
    title: safeText(source.title),
    selection: safeText(source.selection),
    clipboard: safeText(source.clipboard)
  };
}
function normalizeRetryCounts(value) {
  const source = safeObject(value);
  return Object.fromEntries(
    Object.entries(source).map(([key, entryValue]) => [
      safeText(key).trim(),
      Math.max(0, Math.round(Number(entryValue) || 0))
    ]).filter(([key]) => key)
  );
}
function normalizeFavoriteRunJobRecord(value) {
  const source = safeObject(value);
  const jobId = safeText(source.jobId).trim();
  const favoriteId = safeText(source.favoriteId).trim();
  if (!jobId || !favoriteId) {
    return null;
  }
  const stepCount = Math.max(0, Math.round(Number(source.stepCount) || 0));
  const completedSteps = Math.max(0, Math.round(Number(source.completedSteps) || 0));
  const currentStepIndex = Number(source.currentStepIndex);
  return {
    jobId,
    favoriteId,
    trigger: normalizeExecutionTrigger(source.trigger) ?? "popup",
    status: normalizeJobStatus(source.status),
    mode: normalizeFavoriteMode(source.mode),
    stepCount,
    completedSteps: Math.min(completedSteps, stepCount || completedSteps),
    currentStepIndex: Number.isFinite(currentStepIndex) ? Math.max(0, Math.round(currentStepIndex)) : null,
    chainRunId: safeText(source.chainRunId).trim() || null,
    currentBroadcastId: safeText(source.currentBroadcastId).trim() || null,
    message: safeText(source.message),
    createdAt: normalizeIsoDate3(source.createdAt),
    updatedAt: normalizeIsoDate3(source.updatedAt),
    favoriteTitle: safeText(source.favoriteTitle),
    steps: normalizeChainSteps(source.steps),
    templateDefaults: source.templateDefaults && typeof source.templateDefaults === "object" && !Array.isArray(source.templateDefaults) ? Object.fromEntries(
      Object.entries(source.templateDefaults).map(([key, entryValue]) => [safeText(key).trim(), safeText(entryValue)]).filter(([key]) => Boolean(key))
    ) : {},
    executionContext: normalizeExecutionContext(source.executionContext),
    stepRetryCounts: normalizeRetryCounts(source.stepRetryCounts)
  };
}
function pruneFavoriteRunJobs(jobs, nowMs = Date.now()) {
  const byId = /* @__PURE__ */ new Map();
  safeArray(jobs).forEach((entry) => {
    const job = normalizeFavoriteRunJobRecord(entry);
    if (!job) {
      return;
    }
    const updatedAtMs = Date.parse(job.updatedAt);
    const isTerminal = job.status === "completed" || job.status === "failed" || job.status === "skipped";
    const expired = isTerminal && Number.isFinite(updatedAtMs) && nowMs - updatedAtMs > TERMINAL_JOB_TTL_MS;
    if (expired) {
      return;
    }
    const existing = byId.get(job.jobId);
    if (!existing || Date.parse(existing.updatedAt) < Date.parse(job.updatedAt)) {
      byId.set(job.jobId, job);
    }
  });
  return [...byId.values()].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)).slice(0, MAX_JOB_COUNT);
}
async function getFavoriteRunJobs() {
  const rawValue = await readStorage("session", SESSION_RUNTIME_KEYS.favoriteRunJobs, []);
  return pruneFavoriteRunJobs(safeArray(rawValue));
}
async function setFavoriteRunJobs(jobs) {
  const normalized = pruneFavoriteRunJobs(jobs);
  await writeStorage("session", SESSION_RUNTIME_KEYS.favoriteRunJobs, normalized);
  return normalized;
}
async function updateFavoriteRunJobs(mutator) {
  const runMutation = async () => {
    const current = await getFavoriteRunJobs();
    const next = await mutator(current);
    return setFavoriteRunJobs(next);
  };
  const resultPromise = favoriteRunJobMutationChain.then(runMutation, runMutation);
  favoriteRunJobMutationChain = resultPromise.then(() => void 0, () => void 0);
  return resultPromise;
}
function getFavoriteRunJobById(jobs, jobId) {
  const normalizedJobId = safeText(jobId).trim();
  if (!normalizedJobId) {
    return null;
  }
  return jobs.find((job) => job.jobId === normalizedJobId) ?? null;
}
function getActiveFavoriteRunJobByFavoriteId(jobs, favoriteId) {
  const normalizedFavoriteId = safeText(favoriteId).trim();
  if (!normalizedFavoriteId) {
    return null;
  }
  return [...jobs].filter((job) => safeText(job.favoriteId).trim() === normalizedFavoriteId).filter((job) => job.status === "queued" || job.status === "running").sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] ?? null;
}
function findFavoriteRunJobByBroadcastId(jobs, broadcastId) {
  const normalizedBroadcastId = safeText(broadcastId).trim();
  if (!normalizedBroadcastId) {
    return null;
  }
  return jobs.find((job) => safeText(job.currentBroadcastId).trim() === normalizedBroadcastId) ?? null;
}
function findFavoriteRunDedupedJob(jobs, favoriteId) {
  return getActiveFavoriteRunJobByFavoriteId(jobs, favoriteId);
}

// src/shared/runtime-state/onboarding.ts
async function setOnboardingCompleted(completed) {
  const normalized = normalizeBoolean3(completed, false);
  await writeStorage("local", LOCAL_RUNTIME_KEYS.onboardingCompleted, normalized);
  return normalized;
}

// src/shared/runtime-state/strategy-stats.ts
function normalizeCounterValue(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}
function normalizeStrategyStats(value) {
  const root = safeObject(value);
  return Object.fromEntries(
    Object.entries(root).map(([siteId, siteValue]) => {
      const siteStats = safeObject(siteValue);
      const normalizedSiteStats = Object.fromEntries(
        Object.entries(siteStats).map(([strategyName, counts]) => {
          const normalizedCounts = safeObject(counts);
          return [
            String(strategyName).trim(),
            {
              success: normalizeCounterValue(normalizedCounts.success),
              fail: normalizeCounterValue(normalizedCounts.fail)
            }
          ];
        }).filter(([strategyName]) => strategyName)
      );
      return [String(siteId).trim(), normalizedSiteStats];
    }).filter(([siteId]) => siteId)
  );
}
async function getStrategyStats() {
  const rawValue = await readStorage("local", LOCAL_RUNTIME_KEYS.strategyStats, {});
  return normalizeStrategyStats(rawValue);
}
async function setStrategyStats(value) {
  const normalized = normalizeStrategyStats(value);
  await writeStorage("local", LOCAL_RUNTIME_KEYS.strategyStats, normalized);
  return normalized;
}
async function recordStrategyAttempts(siteId, attempts) {
  const normalizedSiteId = typeof siteId === "string" ? siteId.trim() : "";
  if (!normalizedSiteId || !Array.isArray(attempts) || attempts.length === 0) {
    return getStrategyStats();
  }
  const current = await getStrategyStats();
  const siteStats = { ...current[normalizedSiteId] ?? {} };
  attempts.forEach((attempt) => {
    const name = typeof attempt?.name === "string" ? attempt.name.trim() : "";
    if (!name) {
      return;
    }
    const currentCounts = siteStats[name] ?? { success: 0, fail: 0 };
    siteStats[name] = {
      success: currentCounts.success + (attempt.success ? 1 : 0),
      fail: currentCounts.fail + (attempt.success ? 0 : 1)
    };
  });
  const nextStats = {
    ...current,
    [normalizedSiteId]: siteStats
  };
  await setStrategyStats(nextStats);
  return nextStats;
}

// src/shared/runtime-state/ui-toasts.ts
async function getPendingUiToasts() {
  const rawValue = await readStorage("session", SESSION_RUNTIME_KEYS.pendingUiToasts, []);
  return normalizeArray(rawValue).map((entry) => normalizeUiToast(entry));
}
async function setPendingUiToasts(entries) {
  const normalized = normalizeArray(entries).map((entry) => normalizeUiToast(entry));
  await writeStorage("session", SESSION_RUNTIME_KEYS.pendingUiToasts, normalized);
  return normalized;
}
async function enqueueUiToast(entry) {
  const current = await getPendingUiToasts();
  const next = [...current, normalizeUiToast(entry)].slice(-20);
  await setPendingUiToasts(next);
  return next;
}

// src/shared/prompt-state.ts
var LOCAL_PROMPT_STATE_KEYS = Object.freeze({
  composeDraftPrompt: "composeDraftPrompt",
  lastSentPrompt: "lastSentPrompt",
  legacyLastPrompt: "lastPrompt"
});
var SESSION_PROMPT_STATE_KEYS = Object.freeze({
  popupPromptIntent: "popupPromptIntent"
});
function normalizePrompt(value) {
  return typeof value === "string" ? value : "";
}
function normalizePopupPromptIntent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const source = value;
  const prompt = normalizePrompt(source.prompt);
  const createdAt = typeof source.createdAt === "string" && Number.isFinite(Date.parse(source.createdAt)) ? new Date(source.createdAt).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
  return {
    prompt,
    createdAt
  };
}
async function setPopupPromptIntent(value) {
  const normalized = normalizePopupPromptIntent(
    typeof value === "string" ? {
      prompt: value,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    } : value
  );
  if (!normalized) {
    await chrome.storage.session.remove([SESSION_PROMPT_STATE_KEYS.popupPromptIntent]);
    return null;
  }
  await chrome.storage.session.set({
    [SESSION_PROMPT_STATE_KEYS.popupPromptIntent]: normalized
  });
  return normalized;
}

// src/shared/runtime-state/reset.ts
function normalizeStorageKeys(keys, fallback = []) {
  return Array.from(
    new Set(
      [...fallback, ...Array.isArray(keys) ? keys : []].filter((key) => typeof key === "string" && key.trim()).map((key) => key.trim())
    )
  );
}
async function resetPersistedExtensionState(options = {}) {
  const localKeys = normalizeStorageKeys(options.additionalLocalKeys, [
    LOCAL_PROMPT_STATE_KEYS.composeDraftPrompt,
    LOCAL_PROMPT_STATE_KEYS.lastSentPrompt,
    LOCAL_PROMPT_STATE_KEYS.legacyLastPrompt
  ]);
  const sessionKeys = normalizeStorageKeys(options.additionalSessionKeys, [
    SESSION_RUNTIME_KEYS.pendingSelectorChecks,
    SESSION_RUNTIME_KEYS.popupFavoriteIntent,
    SESSION_RUNTIME_KEYS.activeComparisonContext,
    SESSION_RUNTIME_KEYS.favoriteRunJobs,
    SESSION_PROMPT_STATE_KEYS.popupPromptIntent
  ]);
  const clearAlarmName = typeof options.clearAlarmName === "string" && options.clearAlarmName.trim() ? options.clearAlarmName.trim() : "";
  await Promise.all([
    setBroadcastCounter(0),
    setPromptHistory([]),
    setPromptFavorites([]),
    setComparisonNotes([]),
    setPromptExperiments([]),
    setTemplatePacks([]),
    setServiceGroups([]),
    setTemplateVariableCache({}),
    setFailedSelectors([]),
    setPendingUiToasts([]),
    setLastBroadcast(null),
    setFavoriteRunJobs([]),
    setOnboardingCompleted(false),
    setStrategyStats({}),
    setAppSettings(DEFAULT_SETTINGS),
    resetSiteSettings(),
    localKeys.length > 0 ? chrome.storage.local.remove(localKeys) : Promise.resolve(),
    sessionKeys.length > 0 ? chrome.storage.session.remove(sessionKeys) : Promise.resolve(),
    clearAlarmName ? Promise.resolve(chrome.alarms.clear(clearAlarmName)).catch(() => false) : Promise.resolve()
  ]);
  return {
    ok: true,
    removedLocalKeys: localKeys,
    removedSessionKeys: sessionKeys
  };
}

// src/background/app/constants.ts
var INJECTOR_SCRIPT_PATH = "content/injector.js";
var PALETTE_SCRIPT_PATH = "content/palette.js";
var SELECTOR_CHECKER_SCRIPT_PATH = "content/selector_checker.js";
var SELECTION_SCRIPT_PATH = "content/selection.js";
var ONBOARDING_URL = "onboarding/onboarding.html";
var POPUP_PAGE_URL = "popup/popup.html";
var PENDING_INJECTIONS_KEY = "pendingInjections";
var PENDING_BROADCASTS_KEY = "pendingBroadcasts";
var PENDING_SELECTOR_CHECKS_KEY = "pendingSelectorChecks";
var SELECTOR_ALERTS_KEY = "selectorAlerts";
var NOTIFICATION_ICON_PATH = "icons/icon-128.png";
var CONTEXT_MENU_ROOT_ID = "apb-root";
var CONTEXT_MENU_ALL_ID = "apb-send-all";
var CONTEXT_MENU_SITE_PREFIX = "apb-send-site:";
var CONTEXT_MENU_SAVE_COMPARISON_ID = "apb-save-comparison-note";
var CAPTURE_SELECTION_COMMAND = "capture-selected-text";
var QUICK_PALETTE_COMMAND = "quick-palette";
var RECONCILE_ALARM = "apb-reconcile";
var BADGE_CLEAR_ALARM = "apb-clear-badge";
var PENDING_TIMEOUT_MS = 6e4;
var BADGE_CLEAR_DELAY_MS = 5e3;
var KEEPALIVE_PERIOD_MINUTES = 0.5;
var TAB_LOAD_READY_TIMEOUT_MS = 1e4;
var TAB_POST_SUBMIT_SETTLE_MS = 1400;
var STANDALONE_POPUP_WIDTH = 460;
var STANDALONE_POPUP_HEIGHT = 860;

// src/background/app/injection-helpers.ts
function scaleTimeout(value, multiplier = 1) {
  const numericValue = Number(value);
  const numericMultiplier = Number(multiplier);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }
  if (!Number.isFinite(numericMultiplier) || numericMultiplier <= 0) {
    return Math.max(0, Math.round(numericValue));
  }
  return Math.max(0, Math.round(numericValue * numericMultiplier));
}
function buildSiteResult(code, overrides = {}) {
  return buildSiteInjectionResult(code, overrides);
}
function getStrategySortScore(counter) {
  const success = Number(counter?.success) || 0;
  const fail = Number(counter?.fail) || 0;
  const total = success + fail;
  const hitRate = total > 0 ? success / total : -1;
  return {
    total,
    hitRate,
    success,
    fail
  };
}
function buildPreferredStrategyOrder(siteId, strategyStats) {
  const siteStats = strategyStats?.[siteId] ?? {};
  const knownStrategies = [
    "lexicalEditorState",
    "execCommand",
    "directContenteditable",
    "paste",
    "nativeSetter"
  ];
  return [...knownStrategies].sort((left, right) => {
    const leftScore = getStrategySortScore(siteStats[left]);
    const rightScore = getStrategySortScore(siteStats[right]);
    if (leftScore.hitRate !== rightScore.hitRate) {
      return rightScore.hitRate - leftScore.hitRate;
    }
    if (leftScore.success !== rightScore.success) {
      return rightScore.success - leftScore.success;
    }
    if (leftScore.fail !== rightScore.fail) {
      return rightScore.fail - leftScore.fail;
    }
    return knownStrategies.indexOf(left) - knownStrategies.indexOf(right);
  });
}
function buildInjectionConfig(site, runtimeOverrides = {}) {
  const verifiedAuthState = site?.verifiedAuthState || void 0;
  return {
    id: site?.id ?? "",
    name: site?.name ?? "",
    url: site?.url ?? "",
    hostname: site?.hostname ?? "",
    hostnameAliases: Array.isArray(site?.hostnameAliases) ? site.hostnameAliases : [],
    supportedRoutes: Array.isArray(site?.supportedRoutes) ? site.supportedRoutes : [],
    inputSelector: site?.inputSelector ?? "",
    fallbackSelectors: Array.isArray(site?.fallbackSelectors) ? site.fallbackSelectors : [],
    inputType: site?.inputType ?? "textarea",
    submitSelector: site?.submitSelector ?? "",
    submitMethod: site?.submitMethod ?? "enter",
    selectorCheckMode: site?.selectorCheckMode ?? "input-and-submit",
    waitMs: Number.isFinite(Number(site?.waitMs)) ? Number(site?.waitMs) : 0,
    fallback: site?.fallback !== false,
    authSelectors: Array.isArray(site?.authSelectors) ? site.authSelectors : [],
    lastVerified: site?.lastVerified ?? "",
    verifiedAt: site?.verifiedAt ?? "",
    verifiedRoute: site?.verifiedRoute ?? "",
    verifiedAuthState,
    verifiedLocale: site?.verifiedLocale ?? "",
    verifiedVersion: site?.verifiedVersion ?? "",
    enabled: site?.enabled ?? true,
    color: site?.color ?? "",
    icon: site?.icon ?? "",
    isBuiltIn: Boolean(site?.isBuiltIn),
    isCustom: Boolean(site?.isCustom),
    deletable: Boolean(site?.deletable),
    editable: Boolean(site?.editable),
    permissionPatterns: Array.isArray(site?.permissionPatterns) ? site.permissionPatterns : [],
    submitTimeoutMs: Number.isFinite(Number(runtimeOverrides?.submitTimeoutMs)) ? Number(runtimeOverrides.submitTimeoutMs) : void 0,
    submitRetryCount: Number.isFinite(Number(runtimeOverrides?.submitRetryCount)) ? Number(runtimeOverrides.submitRetryCount) : void 0,
    strategyOrder: Array.isArray(runtimeOverrides?.strategyOrder) ? runtimeOverrides.strategyOrder : [],
    waitMsMultiplier: Number.isFinite(Number(runtimeOverrides?.waitMsMultiplier)) ? Number(runtimeOverrides.waitMsMultiplier) : void 0
  };
}

// src/background/app/selector-alerts.ts
function normalizeText2(value) {
  return typeof value === "string" ? value.trim() : "";
}
function buildSelectorAlertSignature(report) {
  const siteId = normalizeText2(report?.siteId) || "unknown";
  const missingEntries = (Array.isArray(report?.missing) ? report.missing : []).map((entry) => `${normalizeText2(entry?.field)}:${normalizeText2(entry?.selector)}`).filter((entry) => entry !== ":").sort();
  return [siteId, ...missingEntries].join("|");
}

// src/shared/sites/reuse-preflight.ts
function evaluateReusableTabSnapshot(snapshot) {
  const pathBlockReason = getSitePathBlockReason(
    { supportedRoutes: snapshot?.supportedRoutes },
    snapshot?.pathname
  );
  if (pathBlockReason === "auth_path") {
    return { ok: false, reason: "auth_path" };
  }
  if (pathBlockReason === "settings_path") {
    return { ok: false, reason: "settings_path" };
  }
  if (pathBlockReason === "unsupported_route") {
    return { ok: false, reason: "unsupported_route" };
  }
  if (!snapshot?.hasPromptSurface) {
    return {
      ok: false,
      reason: snapshot?.hasAuthSurface ? "auth_selector" : "missing_input"
    };
  }
  if (shouldRequireVisibleSubmitSurface(snapshot?.submitRequirement) && !snapshot?.hasSubmitSurface) {
    return { ok: false, reason: "missing_submit" };
  }
  return { ok: true };
}

// src/background/app/bootstrap/tab-targets.ts
function createBackgroundTabTargetResolver(deps) {
  let runtimeSiteLookupCache = null;
  function cacheRuntimeSites(sites) {
    runtimeSiteLookupCache = new Map(
      (Array.isArray(sites) ? sites : []).filter((site) => typeof site?.id === "string" && site.id.trim()).map((site) => [site.id.trim(), site])
    );
    return runtimeSiteLookupCache ?? /* @__PURE__ */ new Map();
  }
  async function getRuntimeSiteLookup(forceRefresh = false) {
    if (!runtimeSiteLookupCache || forceRefresh) {
      try {
        cacheRuntimeSites(await deps.getRuntimeSites());
      } catch (_error) {
        runtimeSiteLookupCache = /* @__PURE__ */ new Map();
      }
    }
    return runtimeSiteLookupCache ?? /* @__PURE__ */ new Map();
  }
  function normalizeTargetTabId2(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }
  function buildSelectedTabUnavailableMessage2(siteName, tabId) {
    const label = siteName || "AI service";
    if (Number.isFinite(Number(tabId))) {
      return deps.getI18nMessage("toast_selected_tab_unavailable", [
        label,
        String(tabId)
      ]) || `${label} selected tab #${String(tabId)} is unavailable.`;
    }
    return deps.getI18nMessage("toast_selected_tab_unavailable", [label]) || `${label} selected tab is unavailable.`;
  }
  function isInjectableTabUrl2(urlString) {
    try {
      const url = new URL(urlString);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_error) {
      return false;
    }
  }
  function getAllowedSiteHostnames(site) {
    const siteUrl = typeof site?.url === "string" ? site.url : "";
    return new Set(
      [
        site?.hostname,
        ...Array.isArray(site?.hostnameAliases) ? site.hostnameAliases : [],
        isInjectableTabUrl2(siteUrl) ? new URL(siteUrl).hostname : ""
      ].filter(
        (entry) => typeof entry === "string" && entry.trim().length > 0
      ).map((entry) => entry.trim().toLowerCase())
    );
  }
  function getSitePermissionPatterns2(site) {
    return Array.isArray(site?.permissionPatterns) ? site.permissionPatterns.filter(
      (pattern) => typeof pattern === "string" && pattern.trim()
    ) : [];
  }
  function isSameSiteOrigin2(tabUrl, site) {
    try {
      const hostname = new URL(tabUrl).hostname.toLowerCase();
      return getAllowedSiteHostnames(site).has(hostname);
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to compare site origin.", {
        tabUrl,
        site,
        error
      });
      return false;
    }
  }
  async function getSiteById2(siteId) {
    const siteLookup = await getRuntimeSiteLookup();
    return siteLookup.get(siteId) ?? null;
  }
  async function getSiteForUrl2(urlString) {
    try {
      const url = new URL(urlString);
      const sites = [...(await getRuntimeSiteLookup()).values()];
      const normalizedHostname = url.hostname.toLowerCase();
      return sites.find((site) => getAllowedSiteHostnames(site).has(normalizedHostname)) ?? null;
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to resolve site for URL.", {
        urlString,
        error
      });
      return null;
    }
  }
  async function resolveSelectedTargets2(siteRefs) {
    const runtimeSites = await deps.getRuntimeSites();
    cacheRuntimeSites(runtimeSites);
    const resolvedTargets = [];
    const seenIds = /* @__PURE__ */ new Set();
    for (const siteRef of Array.isArray(siteRefs) ? siteRefs : []) {
      let resolvedSite = null;
      let targetTabId = null;
      let requireExplicitTab = false;
      let forceNewTab = false;
      let promptOverride;
      let resolvedPrompt;
      if (typeof siteRef === "string") {
        resolvedSite = runtimeSites.find((site) => site.id === siteRef) ?? null;
      } else if (siteRef && typeof siteRef === "object") {
        if (typeof siteRef.id === "string") {
          resolvedSite = runtimeSites.find((site) => site.id === siteRef.id) ?? buildInjectionConfig(siteRef);
        } else {
          resolvedSite = buildInjectionConfig(siteRef);
        }
        targetTabId = normalizeTargetTabId2(siteRef.tabId);
        requireExplicitTab = siteRef.target === "tab" || targetTabId !== null;
        forceNewTab = siteRef.reuseExistingTab === false || siteRef.openInNewTab === true || siteRef.target === "new";
        promptOverride = typeof siteRef.promptOverride === "string" && siteRef.promptOverride.trim() ? siteRef.promptOverride.trim() : void 0;
        resolvedPrompt = typeof siteRef.resolvedPrompt === "string" ? siteRef.resolvedPrompt : void 0;
      }
      if (!resolvedSite || !resolvedSite.id || seenIds.has(resolvedSite.id)) {
        continue;
      }
      seenIds.add(resolvedSite.id);
      resolvedTargets.push({
        site: buildInjectionConfig(resolvedSite),
        targetTabId,
        requireExplicitTab,
        forceNewTab,
        promptOverride,
        resolvedPrompt
      });
    }
    return resolvedTargets;
  }
  async function runReusableTabPreflight(tabId, site) {
    try {
      const inputSelectors = normalizeSelectorEntries([
        site?.inputSelector,
        ...Array.isArray(site?.fallbackSelectors) ? site.fallbackSelectors : []
      ]);
      const authSelectors = normalizeSelectorEntries(site?.authSelectors);
      const submitRequirement = buildSubmitRequirement(site);
      const submitSelectors = shouldRequireVisibleSubmitSurface(submitRequirement) ? normalizeSelectorEntries([site?.submitSelector]) : [];
      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: ({ nextInputSelectors, nextAuthSelectors, nextSubmitSelectors }) => {
          function isElementVisible(element) {
            if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
              return true;
            }
            const style = window.getComputedStyle(element);
            if (element instanceof HTMLElement && element.hidden || element.getAttribute("hidden") !== null || element.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
              return false;
            }
            return element.getClientRects().length > 0;
          }
          function isEditableElement(element) {
            if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
              return !element.readOnly;
            }
            return element instanceof HTMLElement ? element.isContentEditable : false;
          }
          function collectElementsDeep(selector, root, matches, seen) {
            if (typeof root.querySelectorAll === "function") {
              for (const element of Array.from(root.querySelectorAll(selector))) {
                if (!seen.has(element)) {
                  seen.add(element);
                  matches.push(element);
                }
              }
            }
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
            let current = walker.currentNode;
            while (current) {
              if (current instanceof Element && current.shadowRoot) {
                collectElementsDeep(selector, current.shadowRoot, matches, seen);
              }
              current = walker.nextNode();
            }
          }
          function findDeep(selectors, { editableOnly = false } = {}) {
            for (const selector of selectors) {
              try {
                const matches = [];
                collectElementsDeep(selector, document, matches, /* @__PURE__ */ new Set());
                const match = matches.find(
                  (element) => isElementVisible(element) && (!editableOnly || isEditableElement(element))
                );
                if (match) {
                  return true;
                }
              } catch (_error) {
              }
            }
            return false;
          }
          return {
            pathname: window.location.pathname,
            hasPromptSurface: findDeep(nextInputSelectors, { editableOnly: true }),
            hasAuthSurface: findDeep(nextAuthSelectors),
            hasSubmitSurface: nextSubmitSelectors.length === 0 ? true : findDeep(nextSubmitSelectors)
          };
        },
        args: [
          {
            nextInputSelectors: inputSelectors,
            nextAuthSelectors: authSelectors,
            nextSubmitSelectors: submitSelectors
          }
        ]
      });
      const snapshot = result?.result ?? {};
      return evaluateReusableTabSnapshot({
        pathname: snapshot.pathname,
        supportedRoutes: Array.isArray(site?.supportedRoutes) ? site.supportedRoutes : [],
        hasPromptSurface: snapshot.hasPromptSurface,
        hasAuthSurface: snapshot.hasAuthSurface,
        hasSubmitSurface: snapshot.hasSubmitSurface,
        submitRequirement
      }).ok === true;
    } catch (_error) {
      return false;
    }
  }
  async function isReusableTabForSite2(tab, site) {
    const tabId = tab.id;
    const tabUrl = typeof tab.url === "string" ? tab.url : "";
    if (typeof tabId !== "number" || !isInjectableTabUrl2(tabUrl)) {
      return false;
    }
    if (!isSameSiteOrigin2(tabUrl, site)) {
      return false;
    }
    return runReusableTabPreflight(tabId, site);
  }
  async function isCustomSitePermissionGranted2(site) {
    const permissionPatterns = getSitePermissionPatterns2(site);
    if (!site?.isCustom || permissionPatterns.length === 0) {
      return true;
    }
    try {
      return await chrome.permissions.contains({
        origins: permissionPatterns
      });
    } catch (error) {
      console.error(
        "[AI Prompt Broadcaster] Failed to check custom site permission.",
        {
          siteId: site?.id,
          error
        }
      );
      return false;
    }
  }
  function scoreReusableTabForSite(tab, site) {
    const tabUrl = typeof tab?.url === "string" ? tab.url : "";
    const siteUrl = typeof site?.url === "string" ? site.url : "";
    const exactUrlMatch = Boolean(siteUrl && tabUrl.startsWith(siteUrl));
    const activePenalty = tab?.active ? 10 : 0;
    return (exactUrlMatch ? 0 : 5) + activePenalty;
  }
  async function findReusableTabsForSites2(sites, options = {}) {
    const windowId = Number(options?.windowId);
    if (!Number.isFinite(windowId)) {
      return /* @__PURE__ */ new Map();
    }
    try {
      const [tabs, pendingInjections] = await Promise.all([
        chrome.tabs.query({ windowId }),
        deps.getPendingInjections()
      ]);
      const excludedTabIds = new Set(
        Object.keys(pendingInjections).map((tabId) => Number(tabId)).filter((tabId) => Number.isFinite(tabId))
      );
      if (Number.isFinite(Number(options?.excludeTabId))) {
        excludedTabIds.add(Number(options.excludeTabId));
      }
      const reusableTabsBySiteId = /* @__PURE__ */ new Map();
      const usedTabIds = /* @__PURE__ */ new Set();
      for (const site of Array.isArray(sites) ? sites : []) {
        const candidates = tabs.filter((tab) => {
          const candidateId = tab.id;
          const candidateUrl = typeof tab.url === "string" ? tab.url : "";
          if (typeof candidateId !== "number" || usedTabIds.has(candidateId) || excludedTabIds.has(candidateId)) {
            return false;
          }
          if (!isInjectableTabUrl2(candidateUrl)) {
            return false;
          }
          return isSameSiteOrigin2(candidateUrl, site);
        }).sort(
          (left, right) => scoreReusableTabForSite(left, site) - scoreReusableTabForSite(right, site)
        );
        for (const candidate of candidates) {
          if (!await isReusableTabForSite2(candidate, site)) {
            continue;
          }
          reusableTabsBySiteId.set(site.id, candidate);
          if (typeof candidate.id === "number") {
            usedTabIds.add(candidate.id);
          }
          break;
        }
      }
      return reusableTabsBySiteId;
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to discover reusable AI tabs.", {
        windowId,
        error
      });
      return /* @__PURE__ */ new Map();
    }
  }
  async function getExplicitReusableTabForTarget2(target) {
    if (!target?.requireExplicitTab) {
      return {
        requested: false,
        tab: null
      };
    }
    const targetTabId = Number(target?.targetTabId);
    if (!Number.isFinite(targetTabId)) {
      return {
        requested: true,
        tab: null,
        message: buildSelectedTabUnavailableMessage2(target.site?.name ?? "", null)
      };
    }
    try {
      const tab = await chrome.tabs.get(targetTabId);
      if (!tab?.id || !isInjectableTabUrl2(tab?.url ?? "")) {
        return {
          requested: true,
          tab: null,
          message: buildSelectedTabUnavailableMessage2(
            target.site?.name ?? "",
            targetTabId
          )
        };
      }
      return await isReusableTabForSite2(tab, target.site) ? {
        requested: true,
        tab
      } : {
        requested: true,
        tab: null,
        message: buildSelectedTabUnavailableMessage2(
          target.site?.name ?? "",
          targetTabId
        )
      };
    } catch (_error) {
      return {
        requested: true,
        tab: null,
        message: buildSelectedTabUnavailableMessage2(
          target.site?.name ?? "",
          targetTabId
        )
      };
    }
  }
  async function getPreferredInjectableNormalTab2() {
    const tab = await deps.getPreferredNormalActiveTab();
    if (!tab?.id) {
      return {
        ok: false,
        reason: "no_tab"
      };
    }
    const tabUrl = typeof tab.url === "string" ? tab.url : "";
    if (!isInjectableTabUrl2(tabUrl)) {
      return {
        ok: false,
        reason: "invalid_tab",
        tab
      };
    }
    return {
      ok: true,
      tab
    };
  }
  return {
    getSiteById: getSiteById2,
    getSiteForUrl: getSiteForUrl2,
    resolveSelectedTargets: resolveSelectedTargets2,
    buildSelectedTabUnavailableMessage: buildSelectedTabUnavailableMessage2,
    isInjectableTabUrl: isInjectableTabUrl2,
    getAllowedSiteHostnames,
    getSitePermissionPatterns: getSitePermissionPatterns2,
    isSameSiteOrigin: isSameSiteOrigin2,
    isReusableTabForSite: isReusableTabForSite2,
    isCustomSitePermissionGranted: isCustomSitePermissionGranted2,
    findReusableTabsForSites: findReusableTabsForSites2,
    getExplicitReusableTabForTarget: getExplicitReusableTabForTarget2,
    getPreferredInjectableNormalTab: getPreferredInjectableNormalTab2
  };
}

// src/background/app/bootstrap/runtime-events.ts
function registerBackgroundChromeEvents(deps) {
  chrome.runtime.onInstalled.addListener(({ reason }) => {
    void (async () => {
      await deps.createContextMenus();
      await deps.initializeServiceWorker();
      if (reason === "install") {
        await deps.markOnboardingPending();
        await deps.openOnboardingPage();
      }
    })();
  });
  chrome.runtime.onStartup.addListener(() => {
    void deps.initializeServiceWorker();
  });
  chrome.commands.onCommand.addListener((command) => {
    if (command === CAPTURE_SELECTION_COMMAND) {
      void deps.handleCaptureSelectedTextCommand();
      return;
    }
    if (command === QUICK_PALETTE_COMMAND) {
      void deps.handleQuickPaletteCommand();
    }
  });
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    void (async () => {
      try {
        const siteIds = await deps.getContextMenuTargetSiteIds(info.menuItemId);
        const selectedText = typeof info.selectionText === "string" ? info.selectionText.trim() : "";
        if (info.menuItemId === CONTEXT_MENU_SAVE_COMPARISON_ID) {
          await deps.handleContextMenuComparisonNote(selectedText, tab);
          return;
        }
        if (siteIds.length === 0) {
          return;
        }
        if (!selectedText && typeof tab?.id === "number") {
          const cachedText = deps.selectionCache.get(tab.id) ?? "";
          if (cachedText.trim()) {
            await deps.handleContextMenuBroadcast(cachedText, siteIds);
          }
          return;
        }
        if (typeof tab?.id === "number" && selectedText) {
          deps.selectionCache.set(tab.id, selectedText);
        }
        await deps.handleContextMenuBroadcast(selectedText, siteIds);
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Context menu click handling failed.", error);
      }
    })();
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") {
      return;
    }
    void deps.maybeInjectDynamicSelectorChecker(tabId, tab);
    void deps.queuePendingInjection(tabId, tab);
  });
  chrome.tabs.onActivated.addListener((activeInfo) => {
    void (async () => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        await deps.rememberNormalTab(tab);
      } catch (_error) {
      }
    })();
  });
  chrome.windows.onFocusChanged.addListener((windowId) => {
    if (!Number.isFinite(windowId) || windowId === chrome.windows.WINDOW_ID_NONE) {
      return;
    }
    void (async () => {
      try {
        const windowInfo = await chrome.windows.get(windowId).catch(() => null);
        if (windowInfo?.type !== "normal") {
          return;
        }
        const [activeTab] = await chrome.tabs.query({
          active: true,
          windowId
        });
        await deps.rememberNormalTab(activeTab);
      } catch (_error) {
      }
    })();
  });
  chrome.tabs.onRemoved.addListener((tabId) => {
    void (async () => {
      try {
        deps.selectionCache.delete(tabId);
        deps.clearRememberedTab(tabId);
        const pending = await deps.getPendingInjections();
        const job = pending[String(tabId)];
        if (job?.broadcastId && job?.siteId) {
          await deps.recordBroadcastSiteResult(
            job.broadcastId,
            job.siteId,
            "tab_closed"
          );
        }
        await deps.removePendingInjection(tabId);
        deps.activeInjections.delete(tabId);
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Tab removal cleanup failed.", {
          tabId,
          error
        });
        deps.activeInjections.delete(tabId);
      }
    })();
  });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === RECONCILE_ALARM) {
      void deps.reconcilePendingInjections();
      return;
    }
    if (alarm.name === BADGE_CLEAR_ALARM) {
      void deps.clearBadge();
      return;
    }
    if (alarm.name.startsWith("apb-favorite-job:")) {
      void deps.handleFavoriteRunJobAlarm(alarm.name);
      return;
    }
    const favoriteId = deps.parseScheduleAlarmFavoriteId(alarm.name);
    if (favoriteId) {
      void deps.handleFavoriteScheduleAlarm(favoriteId);
    }
  });
  chrome.notifications.onClicked.addListener(() => {
    void deps.openPopupWithPrompt();
  });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && (changes.customSites || changes.builtInSiteStates || changes.builtInSiteOverrides)) {
      void deps.createContextMenus();
    }
    if (areaName === "local" && changes.promptFavorites) {
      void deps.reconcileFavoriteSchedules();
    }
  });
  void deps.initializeServiceWorker();
}

// src/background/popup/launcher.ts
async function storePromptForPopup(prompt) {
  try {
    const normalizedPrompt = typeof prompt === "string" ? prompt : "";
    await setPopupPromptIntent(normalizedPrompt.trim() ? normalizedPrompt : null);
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to store prompt for popup.", error);
  }
}
async function tryOpenActionPopup() {
  if (typeof chrome.action?.openPopup !== "function") {
    return false;
  }
  try {
    await chrome.action.openPopup();
    return true;
  } catch (error) {
    console.warn("[AI Prompt Broadcaster] Action popup open failed; trying fallback.", error);
    return false;
  }
}
async function focusExistingBrowserWindow() {
  try {
    const windows = await chrome.windows.getAll({
      windowTypes: ["normal"]
    });
    const targetWindow = windows.find((windowInfo) => Number.isFinite(windowInfo?.id));
    if (!targetWindow?.id) {
      return false;
    }
    await chrome.windows.update(targetWindow.id, { focused: true });
    return true;
  } catch (error) {
    console.warn("[AI Prompt Broadcaster] Failed to focus an existing browser window.", error);
    return false;
  }
}
async function openStandalonePopupPage() {
  try {
    await chrome.windows.create({
      url: chrome.runtime.getURL(POPUP_PAGE_URL),
      type: "popup",
      focused: true,
      width: STANDALONE_POPUP_WIDTH,
      height: STANDALONE_POPUP_HEIGHT
    });
    return true;
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to open standalone popup page.", error);
    return false;
  }
}
function createPopupLauncher() {
  return {
    async openPopupWithPrompt(prompt = "") {
      try {
        if (typeof prompt === "string") {
          await storePromptForPopup(prompt);
        }
        if (await tryOpenActionPopup()) {
          return;
        }
        if (await focusExistingBrowserWindow()) {
          if (await tryOpenActionPopup()) {
            return;
          }
        }
        if (!await openStandalonePopupPage()) {
          console.error("[AI Prompt Broadcaster] Failed to open extension popup.");
        }
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Failed to open extension popup.", error);
      }
    },
    async openOnboardingPage() {
      try {
        await chrome.tabs.create({ url: chrome.runtime.getURL(ONBOARDING_URL) });
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Failed to open onboarding page.", error);
      }
    }
  };
}

// src/background/commands/quick-palette.ts
async function ensurePaletteScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: "quickPalette:ping" });
    return true;
  } catch (_error) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [PALETTE_SCRIPT_PATH]
      });
      return true;
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to inject quick palette script.", {
        tabId,
        error
      });
      return false;
    }
  }
}
function createQuickPaletteCommand(deps) {
  const {
    getPreferredNormalActiveTab: getPreferredNormalActiveTab2,
    isInjectableTabUrl: isInjectableTabUrl2,
    openPopupWithPrompt: openPopupWithPrompt2
  } = deps;
  return {
    async handleQuickPaletteCommand() {
      try {
        const activeTab = await getPreferredNormalActiveTab2();
        if (!activeTab?.id || !isInjectableTabUrl2(activeTab.url ?? "")) {
          await openPopupWithPrompt2("");
          return;
        }
        const injected = await ensurePaletteScript(activeTab.id);
        if (!injected) {
          await openPopupWithPrompt2("");
          return;
        }
        await chrome.tabs.sendMessage(activeTab.id, { action: "quickPalette:toggle" });
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Quick palette command failed.", error);
        await openPopupWithPrompt2("");
      }
    }
  };
}

// src/background/selection/runtime.ts
async function ensureSelectionScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: "selection:ping" });
    return true;
  } catch (_error) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [SELECTION_SCRIPT_PATH]
      });
      return true;
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to inject selection script.", {
        tabId,
        error
      });
      return false;
    }
  }
}
async function ensureSelectorCheckerScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: "selector-check:ping" });
    return true;
  } catch (_error) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [SELECTOR_CHECKER_SCRIPT_PATH]
      });
      return true;
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to inject selector checker.", {
        tabId,
        error
      });
      return false;
    }
  }
}
function createSelectionRuntime(deps) {
  const {
    selectionCache: selectionCache2,
    getSiteForUrl: getSiteForUrl2,
    isInjectableTabUrl: isInjectableTabUrl2,
    isCustomSitePermissionGranted: isCustomSitePermissionGranted2
  } = deps;
  return {
    ensureSelectionScript,
    ensureSelectorCheckerScript,
    async getSelectedTextFromTab(tabId) {
      try {
        const didInject = await ensureSelectionScript(tabId);
        if (!didInject) {
          return selectionCache2.get(tabId) ?? "";
        }
        const response = await chrome.tabs.sendMessage(tabId, {
          action: "selection:get-text"
        });
        return typeof response?.text === "string" ? response.text.trim() : selectionCache2.get(tabId) ?? "";
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Failed to read selected text from tab.", {
          tabId,
          error
        });
        return selectionCache2.get(tabId) ?? "";
      }
    },
    async maybeInjectDynamicSelectorChecker(tabId, tab) {
      const tabUrl = typeof tab?.url === "string" ? tab.url : "";
      if (!tabId || !isInjectableTabUrl2(tabUrl)) {
        return false;
      }
      const site = await getSiteForUrl2(tabUrl);
      if (!site?.isCustom || site.enabled === false) {
        return false;
      }
      const granted = await isCustomSitePermissionGranted2(site);
      if (!granted) {
        return false;
      }
      return ensureSelectorCheckerScript(tabId);
    },
    handleSelectionUpdateMessage(message, sender) {
      try {
        if (typeof sender?.tab?.id !== "number") {
          return { ok: false };
        }
        const text = typeof message?.text === "string" ? message.text.trim() : "";
        if (text) {
          selectionCache2.set(sender.tab.id, text);
        } else {
          selectionCache2.delete(sender.tab.id);
        }
        return { ok: true };
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Failed to store selection update.", error);
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  };
}

// src/background/context-menu/index.ts
function removeAllContextMenus() {
  return new Promise((resolve, reject) => {
    chrome.contextMenus.removeAll(() => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}
function createContextMenuItem(createProperties) {
  return new Promise((resolve, reject) => {
    chrome.contextMenus.create(createProperties, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}
function createContextMenuController(deps) {
  const {
    getI18nMessage: getI18nMessage2,
    getEnabledRuntimeSites: getEnabledRuntimeSites2,
    getSitePermissionPatterns: getSitePermissionPatterns2,
    openPopupWithPrompt: openPopupWithPrompt2,
    getSelectedTextFromTab: getSelectedTextFromTab2,
    isInjectableTabUrl: isInjectableTabUrl2,
    handleBroadcastMessage: handleBroadcastMessage2,
    getContextMenuRefreshChain,
    setContextMenuRefreshChain
  } = deps;
  async function getPermittedSites(sites) {
    const allowedSites = await Promise.all(
      sites.map(async (site) => {
        if (!site.isCustom || getSitePermissionPatterns2(site).length === 0) {
          return site;
        }
        try {
          const granted = await chrome.permissions.contains({
            origins: getSitePermissionPatterns2(site)
          });
          return granted ? site : null;
        } catch (error) {
          console.error("[AI Prompt Broadcaster] Failed to check custom site permission.", {
            siteId: site.id,
            error
          });
          return null;
        }
      })
    );
    return allowedSites.filter((site) => Boolean(site));
  }
  async function getContextMenuTargetSiteIds2(menuItemId) {
    if (menuItemId === CONTEXT_MENU_ALL_ID) {
      const enabledSites = await getEnabledRuntimeSites2();
      const allowedSites = await getPermittedSites(enabledSites);
      return allowedSites.map((site) => site.id);
    }
    if (typeof menuItemId === "string" && menuItemId.startsWith(CONTEXT_MENU_SITE_PREFIX)) {
      return [menuItemId.slice(CONTEXT_MENU_SITE_PREFIX.length)];
    }
    return [];
  }
  async function rebuildContextMenus() {
    await removeAllContextMenus();
    const enabledSites = await getEnabledRuntimeSites2();
    const menuSites = await getPermittedSites(enabledSites);
    await createContextMenuItem({
      id: CONTEXT_MENU_ROOT_ID,
      title: getI18nMessage2("context_menu_root"),
      contexts: ["selection"]
    });
    await createContextMenuItem({
      id: CONTEXT_MENU_ALL_ID,
      parentId: CONTEXT_MENU_ROOT_ID,
      title: getI18nMessage2("context_menu_send_all"),
      contexts: ["selection"]
    });
    await createContextMenuItem({
      id: CONTEXT_MENU_SAVE_COMPARISON_ID,
      parentId: CONTEXT_MENU_ROOT_ID,
      title: getI18nMessage2("context_menu_save_comparison") || "Save selection as comparison note",
      contexts: ["selection"]
    });
    for (const site of menuSites) {
      await createContextMenuItem({
        id: `${CONTEXT_MENU_SITE_PREFIX}${site.id}`,
        parentId: CONTEXT_MENU_ROOT_ID,
        title: getI18nMessage2("context_menu_send_to", [site.name]),
        contexts: ["selection"]
      });
    }
  }
  function createContextMenus2() {
    const nextChain = getContextMenuRefreshChain().catch(() => void 0).then(() => rebuildContextMenus()).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("No SW")) {
        return;
      }
      console.error("[AI Prompt Broadcaster] Failed to create context menus.", error);
    });
    setContextMenuRefreshChain(nextChain);
    return nextChain;
  }
  async function handleContextMenuBroadcast2(prompt, siteIds) {
    if (!prompt.trim()) {
      return;
    }
    try {
      await handleBroadcastMessage2({
        action: "broadcast",
        prompt,
        sites: siteIds
      });
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Context menu broadcast failed.", {
        siteIds,
        error
      });
    }
  }
  async function handleCaptureSelectedTextCommand2() {
    try {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true
      });
      if (!activeTab?.id || !isInjectableTabUrl2(activeTab.url ?? "")) {
        await openPopupWithPrompt2("");
        return;
      }
      const selectedText = await getSelectedTextFromTab2(activeTab.id);
      await openPopupWithPrompt2(selectedText);
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Capture-selected-text command failed.", error);
    }
  }
  return {
    getContextMenuTargetSiteIds: getContextMenuTargetSiteIds2,
    rebuildContextMenus,
    createContextMenus: createContextMenus2,
    handleContextMenuBroadcast: handleContextMenuBroadcast2,
    handleCaptureSelectedTextCommand: handleCaptureSelectedTextCommand2
  };
}

// src/background/favorites/execution-context.ts
function hasOwn(value, key) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, key);
}
function createFavoriteExecutionContextTools(deps) {
  const {
    rememberNormalTab: rememberNormalTab2,
    getPreferredNormalActiveTab: getPreferredNormalActiveTab2,
    isInjectableTabUrl: isInjectableTabUrl2,
    getSelectedTextFromTab: getSelectedTextFromTab2
  } = deps;
  const createEmptyExecutionContext = () => ({
    tabId: null,
    windowId: null,
    url: "",
    title: "",
    selection: "",
    clipboard: ""
  });
  function normalizePreparedExecutionContext(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {
        context: {},
        hasClipboardValue: false
      };
    }
    const source = value;
    const tabId = Number(source.tabId);
    const windowId = Number(source.windowId);
    return {
      context: {
        ...hasOwn(source, "tabId") ? { tabId: Number.isFinite(tabId) ? tabId : null } : {},
        ...hasOwn(source, "windowId") ? { windowId: Number.isFinite(windowId) ? windowId : null } : {},
        ...hasOwn(source, "url") ? { url: typeof source.url === "string" ? source.url : "" } : {},
        ...hasOwn(source, "title") ? { title: typeof source.title === "string" ? source.title : "" } : {},
        ...hasOwn(source, "selection") ? { selection: typeof source.selection === "string" ? source.selection : "" } : {},
        ...hasOwn(source, "clipboard") ? { clipboard: typeof source.clipboard === "string" ? source.clipboard : "" } : {}
      },
      hasClipboardValue: hasOwn(source, "clipboard")
    };
  }
  function mergeExecutionContext(base, prepared) {
    return {
      tabId: hasOwn(prepared, "tabId") ? prepared.tabId ?? null : base.tabId,
      windowId: hasOwn(prepared, "windowId") ? prepared.windowId ?? null : base.windowId,
      url: hasOwn(prepared, "url") ? prepared.url ?? "" : base.url,
      title: hasOwn(prepared, "title") ? prepared.title ?? "" : base.title,
      selection: hasOwn(prepared, "selection") ? prepared.selection ?? "" : base.selection,
      clipboard: hasOwn(prepared, "clipboard") ? prepared.clipboard ?? "" : base.clipboard
    };
  }
  async function getExecutionTabContextFromSender(sender) {
    const senderTab = sender?.tab;
    if (senderTab && Number.isFinite(senderTab.id) && isInjectableTabUrl2(senderTab.url ?? "")) {
      const senderTabId = Number(senderTab.id);
      await rememberNormalTab2(senderTab).catch(() => null);
      return {
        tabId: senderTabId,
        windowId: Number.isFinite(senderTab.windowId) ? senderTab.windowId : null,
        url: typeof senderTab.url === "string" ? senderTab.url : "",
        title: typeof senderTab.title === "string" ? senderTab.title : "",
        selection: await getSelectedTextFromTab2(senderTabId).catch(() => ""),
        clipboard: ""
      };
    }
    const activeTab = await getPreferredNormalActiveTab2();
    if (!activeTab?.id || !isInjectableTabUrl2(activeTab?.url ?? "")) {
      return createEmptyExecutionContext();
    }
    return {
      tabId: activeTab.id,
      windowId: Number.isFinite(activeTab.windowId) ? activeTab.windowId : null,
      url: typeof activeTab.url === "string" ? activeTab.url : "",
      title: typeof activeTab.title === "string" ? activeTab.title : "",
      selection: await getSelectedTextFromTab2(activeTab.id).catch(() => ""),
      clipboard: ""
    };
  }
  return {
    createEmptyExecutionContext,
    normalizePreparedExecutionContext,
    mergeExecutionContext,
    getExecutionTabContextFromSender
  };
}

// src/background/favorites/schedules.ts
function buildScheduleAlarmName(favoriteId) {
  const normalizedFavoriteId = typeof favoriteId === "string" ? favoriteId.trim() : "";
  return normalizedFavoriteId ? `apb-schedule:${normalizedFavoriteId}` : "";
}
function parseScheduleAlarmFavoriteId(alarmName) {
  const normalizedAlarmName = typeof alarmName === "string" ? alarmName.trim() : "";
  return normalizedAlarmName.startsWith("apb-schedule:") ? alarmName.slice("apb-schedule:".length) : "";
}
function computeNextScheduledAt(repeat, scheduledAt, now = /* @__PURE__ */ new Date()) {
  const normalizedRepeat = typeof repeat === "string" ? repeat : "none";
  if (normalizedRepeat === "none") {
    return null;
  }
  const baseDate = Number.isFinite(Date.parse(String(scheduledAt ?? ""))) ? new Date(String(scheduledAt)) : new Date(now);
  const nextDate = new Date(baseDate);
  do {
    if (normalizedRepeat === "daily") {
      nextDate.setDate(nextDate.getDate() + 1);
    } else if (normalizedRepeat === "weekly") {
      nextDate.setDate(nextDate.getDate() + 7);
    } else {
      nextDate.setDate(nextDate.getDate() + 1);
      while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
        nextDate.setDate(nextDate.getDate() + 1);
      }
    }
  } while (nextDate.getTime() <= now.getTime());
  return nextDate.toISOString();
}

// src/background/favorites/template-resolution.ts
var SCHEDULED_VARIABLE_BLOCKLIST = /* @__PURE__ */ new Set([
  SYSTEM_TEMPLATE_VARIABLES.url,
  SYSTEM_TEMPLATE_VARIABLES.title,
  SYSTEM_TEMPLATE_VARIABLES.selection,
  SYSTEM_TEMPLATE_VARIABLES.clipboard
]);
function createFavoriteTemplateResolutionTools(deps) {
  const { getWorkflowMessage } = deps;
  function getFavoriteExecutionSteps(favorite) {
    const favoriteTargetSiteIds = normalizeSiteIdList(favorite?.sentTo);
    if (favorite?.mode === "chain" && Array.isArray(favorite.steps) && favorite.steps.length > 0) {
      return favorite.steps.filter((step) => typeof step?.text === "string" && step.text.trim()).map((step, index) => ({
        id: typeof step.id === "string" && step.id.trim() ? step.id.trim() : `step-${index + 1}`,
        text: step.text,
        delayMs: Math.max(0, Math.round(Number(step.delayMs) || 0)),
        failurePolicy: step.failurePolicy ?? "stop",
        targetMode: step.targetMode,
        templateDefaults: step.templateDefaults ?? {},
        targetSiteIds: (() => {
          const stepTargets = normalizeSiteIdList(step.targetSiteIds);
          return stepTargets.length > 0 ? stepTargets : favoriteTargetSiteIds;
        })()
      }));
    }
    const text = typeof favorite?.text === "string" ? favorite.text : "";
    return [{
      id: `${favorite?.id ?? "favorite"}-single`,
      text,
      delayMs: 0,
      targetSiteIds: favoriteTargetSiteIds,
      failurePolicy: "stop",
      templateDefaults: {}
    }];
  }
  function getFavoriteTargetSiteIds(step) {
    return normalizeSiteIdList(step?.targetSiteIds);
  }
  function previewFavoriteText(favorite) {
    const source = favorite?.mode === "chain" ? getFavoriteExecutionSteps(favorite)[0]?.text ?? favorite?.text ?? "" : favorite?.text ?? "";
    const collapsed = String(source ?? "").replace(/\s+/g, " ").trim();
    return collapsed.length > 80 ? `${collapsed.slice(0, 80)}...` : collapsed;
  }
  function buildFavoriteUserDefaults(templateVariableCache, favorite) {
    return {
      ...templateVariableCache ?? {},
      ...favorite?.templateDefaults && typeof favorite.templateDefaults === "object" ? favorite.templateDefaults : {}
    };
  }
  function detectFavoriteExecutionBlockers(favorite, executionContext, templateVariableCache, trigger, options = {}) {
    const steps = getFavoriteExecutionSteps(favorite);
    const defaults = buildFavoriteUserDefaults(templateVariableCache, favorite);
    const scheduled = trigger === "scheduled";
    const contextAvailable = Boolean(
      executionContext.tabId !== null || executionContext.windowId !== null || executionContext.url || executionContext.title || executionContext.selection
    );
    for (const [stepIndex, step] of steps.entries()) {
      const targetSiteIds = getFavoriteTargetSiteIds(step);
      if (targetSiteIds.length === 0) {
        return {
          ok: false,
          reason: "missing_targets",
          message: getWorkflowMessage(
            "favorite_run_error_missing_targets",
            [],
            "Favorite does not have any target services."
          ),
          failingStepIndex: stepIndex,
          failingStepText: step.text,
          failingStepTargetSiteIds: targetSiteIds
        };
      }
      const variables = detectTemplateVariables(step.text);
      const missingUserValues = variables.filter((variable) => variable.kind === "user").map((variable) => variable.name).filter((name) => !String(defaults[name] ?? "").trim());
      if (missingUserValues.length > 0) {
        return {
          ok: false,
          reason: "missing_template_values",
          message: getWorkflowMessage(
            "favorite_run_error_missing_template_values",
            [missingUserValues.join(", ")],
            `Missing template values: ${missingUserValues.join(", ")}`
          ),
          failingStepIndex: stepIndex,
          failingStepText: step.text,
          failingStepTargetSiteIds: targetSiteIds
        };
      }
      const systemVariables = variables.filter((variable) => variable.kind === "system").map((variable) => variable.name);
      if (scheduled) {
        const blocked = systemVariables.filter(
          (name) => SCHEDULED_VARIABLE_BLOCKLIST.has(name)
        );
        if (blocked.length > 0) {
          return {
            ok: false,
            reason: "scheduled_unsupported_variable",
            message: getWorkflowMessage(
              "favorite_run_error_scheduled_unsupported_variable",
              [blocked.join(", ")],
              `Scheduled favorites cannot resolve ${blocked.join(", ")}.`
            ),
            failingStepIndex: stepIndex,
            failingStepText: step.text,
            failingStepTargetSiteIds: targetSiteIds
          };
        }
      } else {
        if (systemVariables.includes(SYSTEM_TEMPLATE_VARIABLES.clipboard) && !options.hasPreparedClipboardValue) {
          return {
            ok: false,
            reason: "clipboard_unavailable",
            message: getWorkflowMessage(
              "favorite_run_error_clipboard_popup_required",
              [],
              "Clipboard-backed favorites need popup input."
            ),
            failingStepIndex: stepIndex,
            failingStepText: step.text,
            failingStepTargetSiteIds: targetSiteIds
          };
        }
        const needsTabContext = systemVariables.some(
          (name) => name === SYSTEM_TEMPLATE_VARIABLES.url || name === SYSTEM_TEMPLATE_VARIABLES.title || name === SYSTEM_TEMPLATE_VARIABLES.selection
        );
        if (needsTabContext && !contextAvailable) {
          return {
            ok: false,
            reason: "tab_context_unavailable",
            message: getWorkflowMessage(
              "favorite_run_error_tab_context_unavailable",
              [],
              "Current tab context is unavailable for this favorite."
            ),
            failingStepIndex: stepIndex,
            failingStepText: step.text,
            failingStepTargetSiteIds: targetSiteIds
          };
        }
      }
    }
    return {
      ok: true,
      steps,
      defaults
    };
  }
  async function buildFavoriteStepPrompt(step, templateDefaults, executionContext) {
    const counter = await getBroadcastCounter().catch(() => 0);
    const values = {
      ...templateDefaults ?? {},
      ...step.templateDefaults ?? {},
      ...buildSystemTemplateValues(/* @__PURE__ */ new Date(), {
        extra: {
          url: executionContext.url ?? "",
          title: executionContext.title ?? "",
          selection: executionContext.selection ?? "",
          counter: String(Number(counter) + 1 || 1)
        }
      }),
      [SYSTEM_TEMPLATE_VARIABLES.clipboard]: executionContext.clipboard ?? ""
    };
    return renderTemplatePrompt(step.text, values);
  }
  return {
    getFavoriteExecutionSteps,
    getFavoriteTargetSiteIds,
    previewFavoriteText,
    detectFavoriteExecutionBlockers,
    buildFavoriteStepPrompt
  };
}

// src/background/popup/favorites-workflow/entrypoints.ts
function createFavoriteWorkflowEntryPoints(deps) {
  async function maybeCreateFavoriteFailureNotification(favorite, message) {
    const settings = await getAppSettings().catch(() => null);
    if (!settings?.desktopNotifications) {
      return;
    }
    try {
      await chrome.notifications.create(`favorite-failure-${Date.now()}`, {
        type: "basic",
        iconUrl: chrome.runtime.getURL(NOTIFICATION_ICON_PATH),
        title: favorite?.title || deps.getWorkflowMessage(
          "favorite_run_notification_title_skipped",
          [],
          "Favorite run skipped"
        ),
        message: String(
          message ?? deps.getWorkflowMessage(
            "favorite_run_error_start_failed",
            [],
            "Favorite execution could not start."
          )
        )
      });
    } catch (error) {
      console.error(
        "[AI Prompt Broadcaster] Failed to create favorite failure notification.",
        error
      );
    }
  }
  async function storePopupFavoriteIntentAndOpen(favoriteId, type, source, reason = "") {
    await setPopupFavoriteIntent({
      type,
      favoriteId,
      source,
      reason,
      createdAt: deps.nowIso()
    });
    await deps.openPopupWithPrompt("");
  }
  async function enqueueFavoriteRun(favorite, options) {
    const trigger = deps.getBroadcastTriggerLabel(options.trigger);
    const preparedExecutionContext = deps.normalizePreparedExecutionContext(
      options.preparedExecutionContext
    );
    const baseExecutionContext = trigger === "scheduled" ? deps.createEmptyExecutionContext() : await deps.getExecutionTabContextFromSender(options.sender);
    const executionContext = deps.mergeExecutionContext(
      baseExecutionContext,
      preparedExecutionContext.context
    );
    const templateVariableCache = await getTemplateVariableCache().catch(() => ({}));
    const validation = deps.detectFavoriteExecutionBlockers(
      favorite,
      executionContext,
      templateVariableCache,
      trigger,
      {
        hasPreparedClipboardValue: preparedExecutionContext.hasClipboardValue
      }
    );
    if (!validation.ok) {
      if (trigger === "scheduled") {
        const chainRunId = favorite?.mode === "chain" ? deps.buildChainRunId() : null;
        await deps.createFavoriteFailureHistory({
          favoriteId: favorite?.id ?? null,
          message: validation.message,
          requestedSiteIds: validation.failingStepTargetSiteIds ?? deps.getFavoriteExecutionSteps(favorite)[0]?.targetSiteIds ?? favorite?.sentTo ?? [],
          text: validation.failingStepText ?? deps.getFavoriteExecutionSteps(favorite)[0]?.text ?? favorite?.text ?? "",
          trigger,
          chainRunId,
          chainStepIndex: favorite?.mode === "chain" ? validation.failingStepIndex ?? 0 : null,
          chainStepCount: favorite?.mode === "chain" ? deps.getFavoriteExecutionSteps(favorite).length : null
        });
        await enqueueUiToast({
          message: validation.message ?? deps.getWorkflowMessage(
            "favorite_run_error_start_failed",
            [],
            "Favorite execution could not start."
          ),
          type: "warning",
          duration: 5e3
        });
        await maybeCreateFavoriteFailureNotification(
          favorite,
          validation.message ?? deps.getWorkflowMessage(
            "favorite_run_error_start_failed",
            [],
            "Favorite execution could not start."
          )
        );
        return {
          ok: false,
          reason: validation.reason,
          error: validation.message
        };
      }
      return {
        ok: false,
        requiresPopupInput: true,
        reason: validation.reason,
        error: validation.message
      };
    }
    return deps.queueFavoriteRunJob(
      favorite,
      trigger,
      executionContext,
      validation.steps ?? [],
      validation.defaults ?? {}
    );
  }
  async function reconcileFavoriteSchedules2() {
    const favorites = await getPromptFavorites().catch(() => []);
    const desiredAlarms = /* @__PURE__ */ new Map();
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
        alarms.filter((alarm) => parseScheduleAlarmFavoriteId(alarm.name)).map(async (alarm) => {
          if (!desiredAlarms.has(alarm.name)) {
            await chrome.alarms.clear(alarm.name);
          }
        })
      );
      for (const [alarmName, when] of desiredAlarms.entries()) {
        chrome.alarms.create(alarmName, { when });
      }
    } catch (error) {
      console.error(
        "[AI Prompt Broadcaster] Failed to reconcile favorite schedules.",
        error
      );
    }
  }
  async function handleFavoriteScheduleAlarm2(favoriteId) {
    const favorites = await getPromptFavorites();
    const favorite = favorites.find(
      (entry) => String(entry.id) === String(favoriteId)
    );
    const alarmName = buildScheduleAlarmName(favoriteId);
    if (!favorite?.scheduleEnabled) {
      if (alarmName) {
        await chrome.alarms.clear(alarmName).catch(() => false);
      }
      return;
    }
    await enqueueFavoriteRun(favorite, {
      trigger: "scheduled",
      allowPopupFallback: false
    });
    if (favorite.scheduleRepeat === "none") {
      await updateFavoritePrompt(favorite.id, {
        scheduleEnabled: false,
        scheduledAt: null
      });
    } else {
      await updateFavoritePrompt(favorite.id, {
        scheduledAt: computeNextScheduledAt(
          favorite.scheduleRepeat,
          favorite.scheduledAt,
          /* @__PURE__ */ new Date()
        )
      });
    }
    await reconcileFavoriteSchedules2();
  }
  async function handleFavoriteRunMessage2(message, sender) {
    const favoriteId = typeof message?.favoriteId === "string" ? message.favoriteId.trim() : "";
    if (!favoriteId) {
      return {
        ok: false,
        error: deps.getWorkflowMessage(
          "favorite_run_error_favorite_id_required",
          [],
          "Favorite id is required."
        )
      };
    }
    const favorites = await getPromptFavorites();
    const favorite = favorites.find((entry) => String(entry.id) === favoriteId);
    if (!favorite) {
      return {
        ok: false,
        error: deps.getWorkflowMessage(
          "favorite_run_error_favorite_not_found",
          [],
          "Favorite not found."
        )
      };
    }
    const execution = await enqueueFavoriteRun(favorite, {
      trigger: message?.trigger ?? "popup",
      sender,
      allowPopupFallback: message?.allowPopupFallback !== false,
      preparedExecutionContext: message?.preparedExecutionContext
    });
    if (execution?.ok) {
      return execution;
    }
    const requiresPopupInput = "requiresPopupInput" in execution && Boolean(execution.requiresPopupInput);
    if (!requiresPopupInput || message?.allowPopupFallback === false) {
      return execution;
    }
    await storePopupFavoriteIntentAndOpen(
      favoriteId,
      "run",
      message?.trigger ?? "popup",
      ("error" in execution ? execution.error : "") ?? ""
    );
    return {
      ok: true,
      popupFallback: true,
      reason: ("reason" in execution ? execution.reason : "popup_fallback") ?? "popup_fallback"
    };
  }
  async function handleFavoriteOpenEditorMessage2(message) {
    const favoriteId = typeof message?.favoriteId === "string" ? message.favoriteId.trim() : "";
    if (!favoriteId) {
      return {
        ok: false,
        error: deps.getWorkflowMessage(
          "favorite_run_error_favorite_id_required",
          [],
          "Favorite id is required."
        )
      };
    }
    await storePopupFavoriteIntentAndOpen(
      favoriteId,
      "edit",
      message?.source ?? "options-edit"
    );
    return { ok: true };
  }
  async function handleQuickPaletteGetState2() {
    const favorites = await getPromptFavorites();
    return {
      ok: true,
      favorites: favorites.map((favorite) => ({
        id: favorite.id,
        title: favorite.title || deps.previewFavoriteText(favorite),
        text: favorite.text ?? "",
        preview: deps.previewFavoriteText(favorite),
        mode: favorite.mode === "chain" ? "chain" : "single",
        tags: Array.isArray(favorite.tags) ? favorite.tags : [],
        folder: favorite.folder ?? ""
      }))
    };
  }
  async function handleQuickPaletteExecuteMessage2(message, sender) {
    return handleFavoriteRunMessage2(
      {
        favoriteId: message?.favoriteId,
        trigger: "palette",
        allowPopupFallback: true
      },
      sender
    );
  }
  return {
    reconcileFavoriteSchedules: reconcileFavoriteSchedules2,
    handleFavoriteScheduleAlarm: handleFavoriteScheduleAlarm2,
    handleFavoriteRunMessage: handleFavoriteRunMessage2,
    handleFavoriteOpenEditorMessage: handleFavoriteOpenEditorMessage2,
    handleQuickPaletteGetState: handleQuickPaletteGetState2,
    handleQuickPaletteExecuteMessage: handleQuickPaletteExecuteMessage2
  };
}

// src/background/popup/favorites-workflow/messages.ts
function createFavoriteWorkflowMessages(getI18nMessage2) {
  const getWorkflowMessage = (key, substitutions = [], fallback = "") => getI18nMessage2(key, substitutions) || fallback;
  function getQueuedMessage() {
    return getWorkflowMessage("favorite_run_message_queued", [], "Queued");
  }
  function getCompletedMessage() {
    return getWorkflowMessage("favorite_run_message_completed", [], "Completed");
  }
  function getDedupedMessage() {
    return getWorkflowMessage(
      "favorite_run_message_deduped",
      [],
      "Favorite run is already queued."
    );
  }
  function getFailedMessage() {
    return getWorkflowMessage(
      "favorite_run_message_failed",
      [],
      "Favorite run failed"
    );
  }
  function getSkippedActiveMessage() {
    return getWorkflowMessage(
      "favorite_run_message_skipped_active",
      [],
      "Skipped because another run is active."
    );
  }
  function getStepProgressMessage(stepIndex, stepCount) {
    return getWorkflowMessage(
      "favorite_run_message_step_progress",
      [String(stepIndex + 1), String(stepCount)],
      `Step ${stepIndex + 1}/${stepCount}`
    );
  }
  function getWaitingStepMessage(stepIndex, stepCount) {
    return getWorkflowMessage(
      "favorite_run_message_waiting_step",
      [String(stepIndex + 1), String(stepCount)],
      `Waiting for step ${stepIndex + 1}/${stepCount}`
    );
  }
  function getQueuedStepMessage(stepIndex, stepCount) {
    return getWorkflowMessage(
      "favorite_run_message_queued_step",
      [String(stepIndex + 1), String(stepCount)],
      `Queued step ${stepIndex + 1}/${stepCount}`
    );
  }
  function getFavoriteRunProgressMessage(job) {
    if (job.stepCount > 1 && job.currentStepIndex !== null) {
      return getStepProgressMessage(job.currentStepIndex, job.stepCount);
    }
    return job.message;
  }
  return {
    getWorkflowMessage,
    getQueuedMessage,
    getCompletedMessage,
    getDedupedMessage,
    getFailedMessage,
    getSkippedActiveMessage,
    getStepProgressMessage,
    getWaitingStepMessage,
    getQueuedStepMessage,
    getFavoriteRunProgressMessage
  };
}

// src/background/favorites/jobs.ts
var FAVORITE_JOB_ALARM_PREFIX = "apb-favorite-job:";
var FAVORITE_JOB_INITIAL_DELAY_MS = 50;
var favoriteExecutionChain = Promise.resolve();
function createFavoriteRunJobId() {
  return typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `favorite-job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function buildFavoriteJobAlarmName(jobId) {
  const normalizedJobId = typeof jobId === "string" ? jobId.trim() : "";
  return normalizedJobId ? `${FAVORITE_JOB_ALARM_PREFIX}${normalizedJobId}` : "";
}
function parseFavoriteJobIdFromAlarmName(alarmName) {
  const normalizedAlarmName = typeof alarmName === "string" ? alarmName.trim() : "";
  return normalizedAlarmName.startsWith(FAVORITE_JOB_ALARM_PREFIX) ? normalizedAlarmName.slice(FAVORITE_JOB_ALARM_PREFIX.length) : "";
}
async function scheduleFavoriteJobAlarm(jobId, delayMs = FAVORITE_JOB_INITIAL_DELAY_MS) {
  const alarmName = buildFavoriteJobAlarmName(jobId);
  if (!alarmName) {
    return;
  }
  chrome.alarms.create(alarmName, {
    when: Date.now() + Math.max(FAVORITE_JOB_INITIAL_DELAY_MS, Math.round(Number(delayMs) || 0))
  });
}
function replaceFavoriteRunJob(jobs, nextJob) {
  const nextJobs = jobs.filter((job) => job.jobId !== nextJob.jobId);
  nextJobs.unshift(nextJob);
  return nextJobs;
}
function queueFavoriteExecution(task) {
  const resultPromise = favoriteExecutionChain.then(task, task);
  favoriteExecutionChain = resultPromise.then(() => void 0, () => void 0);
  return resultPromise;
}

// src/background/popup/favorites-workflow/run-jobs.ts
function createFavoriteRunJobHandlers(deps) {
  async function mutateFavoriteRunJob(jobId, updater) {
    return updateFavoriteRunJobs((jobs) => {
      const existing = getFavoriteRunJobById(jobs, jobId);
      if (!existing) {
        return jobs;
      }
      return replaceFavoriteRunJob(jobs, updater(existing));
    });
  }
  async function queueFavoriteRunJob(favorite, trigger, executionContext, steps, defaults) {
    const createdAt = deps.nowIso();
    const queueState = {
      queuedJob: null,
      dedupedJob: null
    };
    await updateFavoriteRunJobs((jobs) => {
      queueState.dedupedJob = findFavoriteRunDedupedJob(jobs, favorite.id);
      if (queueState.dedupedJob) {
        return jobs;
      }
      queueState.queuedJob = {
        jobId: createFavoriteRunJobId(),
        favoriteId: favorite.id,
        trigger,
        status: "queued",
        mode: favorite.mode === "chain" ? "chain" : "single",
        stepCount: steps.length,
        completedSteps: 0,
        currentStepIndex: steps.length > 0 ? 0 : null,
        chainRunId: favorite.mode === "chain" ? deps.buildChainRunId() : null,
        currentBroadcastId: null,
        message: deps.getQueuedMessage(),
        createdAt,
        updatedAt: createdAt,
        favoriteTitle: favorite.title || deps.previewFavoriteText(favorite),
        steps,
        templateDefaults: { ...defaults ?? {} },
        executionContext: { ...executionContext },
        stepRetryCounts: {}
      };
      return replaceFavoriteRunJob(jobs, queueState.queuedJob);
    });
    const finalDedupedJob = queueState.dedupedJob;
    if (finalDedupedJob) {
      if (trigger === "scheduled") {
        const skippedAt = deps.nowIso();
        const skippedJob = {
          jobId: createFavoriteRunJobId(),
          favoriteId: favorite.id,
          trigger,
          status: "skipped",
          mode: favorite.mode === "chain" ? "chain" : "single",
          stepCount: steps.length,
          completedSteps: Math.min(
            Number(finalDedupedJob.completedSteps ?? 0),
            Number(steps.length ?? 0)
          ),
          currentStepIndex: finalDedupedJob.currentStepIndex ?? (steps.length > 0 ? 0 : null),
          chainRunId: favorite.mode === "chain" ? deps.buildChainRunId() : null,
          currentBroadcastId: null,
          message: deps.getSkippedActiveMessage(),
          createdAt: skippedAt,
          updatedAt: skippedAt,
          favoriteTitle: favorite.title || deps.previewFavoriteText(favorite),
          steps,
          templateDefaults: { ...defaults ?? {} },
          executionContext: { ...executionContext },
          stepRetryCounts: {}
        };
        await updateFavoriteRunJobs(
          (jobs) => replaceFavoriteRunJob(jobs, skippedJob)
        );
      }
      return {
        ok: true,
        deduped: true,
        jobId: finalDedupedJob.jobId,
        message: deps.getDedupedMessage()
      };
    }
    const finalQueuedJob = queueState.queuedJob;
    if (!finalQueuedJob) {
      return {
        ok: false,
        deduped: false,
        jobId: "",
        message: deps.getWorkflowMessage(
          "favorite_run_error_queue_failed",
          [],
          "Favorite execution could not be queued."
        )
      };
    }
    await scheduleFavoriteJobAlarm(finalQueuedJob.jobId);
    return {
      ok: true,
      deduped: false,
      jobId: finalQueuedJob.jobId,
      message: deps.getQueuedMessage()
    };
  }
  async function appendFavoriteRunJobFailureHistory(job, stepIndex, message) {
    const step = job.steps[stepIndex];
    if (!step) {
      return;
    }
    await deps.createFavoriteFailureHistory({
      favoriteId: job.favoriteId,
      requestedSiteIds: step.targetSiteIds,
      message,
      text: step.text,
      chainRunId: job.chainRunId,
      chainStepIndex: job.mode === "chain" ? stepIndex : null,
      chainStepCount: job.mode === "chain" ? job.stepCount : null,
      trigger: job.trigger
    });
  }
  async function handleFavoriteBroadcastCompletion2(summary) {
    const jobs = await getFavoriteRunJobs();
    const job = findFavoriteRunJobByBroadcastId(jobs, summary?.broadcastId ?? "");
    if (!job) {
      return;
    }
    const stepIndex = job.currentStepIndex ?? 0;
    const completedSteps = Math.min(job.stepCount, stepIndex + 1);
    if (summary?.status !== "submitted") {
      const currentStep = job.steps[stepIndex];
      const failurePolicy = currentStep?.failurePolicy ?? "stop";
      const retryKey = currentStep?.id || String(stepIndex);
      const retryCounts = job.stepRetryCounts ?? {};
      const retryCount = retryCounts[retryKey] ?? 0;
      if (failurePolicy === "retry-once" && retryCount < 1) {
        await mutateFavoriteRunJob(job.jobId, (current) => ({
          ...current,
          status: "running",
          currentBroadcastId: null,
          currentStepIndex: stepIndex,
          message: deps.getQueuedStepMessage(stepIndex, current.stepCount),
          stepRetryCounts: {
            ...current.stepRetryCounts ?? {},
            [retryKey]: retryCount + 1
          },
          updatedAt: deps.nowIso()
        }));
        await scheduleFavoriteJobAlarm(job.jobId);
        return;
      }
      if (failurePolicy === "continue" && job.mode === "chain" && completedSteps < job.stepCount) {
        const nextStepIndex2 = completedSteps;
        const nextStep2 = job.steps[nextStepIndex2];
        const nextDelayMs2 = Math.max(0, Math.round(Number(nextStep2?.delayMs) || 0));
        await mutateFavoriteRunJob(job.jobId, (current) => ({
          ...current,
          status: "running",
          completedSteps,
          currentBroadcastId: null,
          currentStepIndex: nextStepIndex2,
          message: nextDelayMs2 > 0 ? deps.getWaitingStepMessage(nextStepIndex2, current.stepCount) : deps.getQueuedStepMessage(nextStepIndex2, current.stepCount),
          updatedAt: deps.nowIso()
        }));
        await scheduleFavoriteJobAlarm(job.jobId, nextDelayMs2);
        return;
      }
      await mutateFavoriteRunJob(job.jobId, (current) => ({
        ...current,
        status: "failed",
        completedSteps,
        currentBroadcastId: null,
        message: deps.getFailedMessage(),
        updatedAt: deps.nowIso()
      }));
      return;
    }
    if (job.mode !== "chain" || completedSteps >= job.stepCount) {
      await mutateFavoriteRunJob(job.jobId, (current) => ({
        ...current,
        status: "completed",
        completedSteps: current.stepCount,
        currentBroadcastId: null,
        message: deps.getCompletedMessage(),
        updatedAt: deps.nowIso()
      }));
      return;
    }
    const nextStepIndex = completedSteps;
    const nextStep = job.steps[nextStepIndex];
    const nextDelayMs = Math.max(0, Math.round(Number(nextStep?.delayMs) || 0));
    await mutateFavoriteRunJob(job.jobId, (current) => ({
      ...current,
      status: "running",
      completedSteps,
      currentBroadcastId: null,
      currentStepIndex: nextStepIndex,
      message: nextDelayMs > 0 ? deps.getWaitingStepMessage(nextStepIndex, current.stepCount) : deps.getQueuedStepMessage(nextStepIndex, current.stepCount),
      updatedAt: deps.nowIso()
    }));
    await scheduleFavoriteJobAlarm(job.jobId, nextDelayMs);
  }
  async function runFavoriteJob(jobId) {
    try {
      const jobs = await getFavoriteRunJobs();
      const job = getFavoriteRunJobById(jobs, jobId);
      if (!job || job.currentBroadcastId || job.status === "completed" || job.status === "failed" || job.status === "skipped") {
        return;
      }
      const stepIndex = job.currentStepIndex ?? job.completedSteps;
      const step = typeof stepIndex === "number" ? job.steps[stepIndex] : null;
      if (!step) {
        await mutateFavoriteRunJob(jobId, (current) => ({
          ...current,
          status: "completed",
          completedSteps: current.stepCount,
          currentBroadcastId: null,
          currentStepIndex: current.stepCount > 0 ? current.stepCount - 1 : null,
          message: deps.getCompletedMessage(),
          updatedAt: deps.nowIso()
        }));
        return;
      }
      const targetSiteIds = normalizeSiteIdList(step.targetSiteIds);
      const response = await queueFavoriteExecution(async () => {
        const prompt = await deps.buildFavoriteStepPrompt(
          step,
          job.templateDefaults,
          job.executionContext
        );
        return deps.queueBroadcastRequest(
          prompt,
          targetSiteIds.map((siteId) => {
            const targetRef = { id: siteId };
            if (step.targetMode === "new" || step.targetMode === "tab") {
              targetRef.target = step.targetMode;
            }
            return targetRef;
          }),
          {
            originFavoriteId: job.favoriteId,
            chainRunId: job.chainRunId,
            chainStepIndex: job.mode === "chain" ? stepIndex : null,
            chainStepCount: job.mode === "chain" ? job.stepCount : null,
            trigger: job.trigger
          }
        );
      });
      if (!response?.ok || !response?.broadcastId) {
        const errorMessage = response?.error ?? deps.getWorkflowMessage(
          "favorite_run_error_queue_failed",
          [],
          "Favorite execution could not be queued."
        );
        await mutateFavoriteRunJob(jobId, (current) => ({
          ...current,
          status: "failed",
          currentBroadcastId: null,
          message: errorMessage,
          updatedAt: deps.nowIso()
        }));
        await appendFavoriteRunJobFailureHistory(job, stepIndex, errorMessage);
        return;
      }
      if ((job.completedSteps ?? 0) === 0 && stepIndex === 0) {
        await markFavoriteUsed(job.favoriteId).catch((error) => {
          console.error(
            "[AI Prompt Broadcaster] Failed to mark favorite usage.",
            error
          );
        });
      }
      await mutateFavoriteRunJob(jobId, (current) => ({
        ...current,
        status: "running",
        currentBroadcastId: response.broadcastId ?? null,
        currentStepIndex: stepIndex,
        message: deps.getFavoriteRunProgressMessage({
          ...current,
          currentStepIndex: stepIndex
        }),
        updatedAt: deps.nowIso()
      }));
      const lastBroadcast = await getLastBroadcast().catch(() => null);
      if (lastBroadcast && lastBroadcast.broadcastId === response.broadcastId && lastBroadcast.status !== "sending") {
        await handleFavoriteBroadcastCompletion2(lastBroadcast);
      }
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Favorite run worker failed.", error);
      const jobs = await getFavoriteRunJobs();
      const job = getFavoriteRunJobById(jobs, jobId);
      if (!job) {
        return;
      }
      const stepIndex = job.currentStepIndex ?? job.completedSteps;
      const errorMessage = error instanceof Error && error.message ? error.message : deps.getWorkflowMessage(
        "favorite_run_error_start_failed",
        [],
        "Favorite execution could not start."
      );
      await mutateFavoriteRunJob(jobId, (current) => ({
        ...current,
        status: "failed",
        currentBroadcastId: null,
        message: errorMessage,
        updatedAt: deps.nowIso()
      }));
      if (typeof stepIndex === "number") {
        await appendFavoriteRunJobFailureHistory(job, stepIndex, errorMessage);
      }
    }
  }
  async function reconcileFavoriteRunJobs2() {
    const [jobs, alarms] = await Promise.all([
      getFavoriteRunJobs(),
      chrome.alarms.getAll().catch(() => [])
    ]);
    const existingAlarmNames = new Set(alarms.map((alarm) => alarm.name));
    const desiredAlarmNames = /* @__PURE__ */ new Set();
    await Promise.all(
      jobs.map(async (job) => {
        if (job.status !== "queued" && job.status !== "running" || job.currentBroadcastId) {
          return;
        }
        const alarmName = buildFavoriteJobAlarmName(job.jobId);
        if (!alarmName) {
          return;
        }
        desiredAlarmNames.add(alarmName);
        if (!existingAlarmNames.has(alarmName)) {
          await scheduleFavoriteJobAlarm(job.jobId);
        }
      })
    );
    await Promise.all(
      alarms.filter((alarm) => alarm.name.startsWith(FAVORITE_JOB_ALARM_PREFIX)).filter((alarm) => !desiredAlarmNames.has(alarm.name)).map((alarm) => chrome.alarms.clear(alarm.name).catch(() => false))
    );
  }
  async function handleFavoriteRunJobAlarm2(alarmName) {
    const jobId = parseFavoriteJobIdFromAlarmName(alarmName);
    if (!jobId) {
      return;
    }
    try {
      await runFavoriteJob(jobId);
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Favorite alarm worker failed.", error);
      const jobs = await getFavoriteRunJobs();
      const job = getFavoriteRunJobById(jobs, jobId);
      if (!job) {
        return;
      }
      const stepIndex = job.currentStepIndex ?? job.completedSteps;
      const errorMessage = error instanceof Error && error.message ? error.message : deps.getWorkflowMessage(
        "favorite_run_error_start_failed",
        [],
        "Favorite execution could not start."
      );
      await mutateFavoriteRunJob(jobId, (current) => ({
        ...current,
        status: "failed",
        currentBroadcastId: null,
        message: errorMessage,
        updatedAt: deps.nowIso()
      }));
      if (typeof stepIndex === "number") {
        await appendFavoriteRunJobFailureHistory(job, stepIndex, errorMessage);
      }
    }
  }
  return {
    queueFavoriteRunJob,
    reconcileFavoriteRunJobs: reconcileFavoriteRunJobs2,
    handleFavoriteRunJobAlarm: handleFavoriteRunJobAlarm2,
    handleFavoriteBroadcastCompletion: handleFavoriteBroadcastCompletion2
  };
}

// src/background/popup/favorites-workflow.ts
function createFavoriteWorkflow(deps) {
  const {
    getBroadcastTriggerLabel: getBroadcastTriggerLabel2,
    getI18nMessage: getI18nMessage2,
    rememberNormalTab: rememberNormalTab2,
    getPreferredNormalActiveTab: getPreferredNormalActiveTab2,
    isInjectableTabUrl: isInjectableTabUrl2,
    getSelectedTextFromTab: getSelectedTextFromTab2,
    openPopupWithPrompt: openPopupWithPrompt2,
    nowIso: nowIso2,
    buildChainRunId: buildChainRunId2,
    queueBroadcastRequest: queueBroadcastRequest2
  } = deps;
  const messages = createFavoriteWorkflowMessages(getI18nMessage2);
  const {
    createEmptyExecutionContext,
    normalizePreparedExecutionContext,
    mergeExecutionContext,
    getExecutionTabContextFromSender
  } = createFavoriteExecutionContextTools({
    rememberNormalTab: rememberNormalTab2,
    getPreferredNormalActiveTab: getPreferredNormalActiveTab2,
    isInjectableTabUrl: isInjectableTabUrl2,
    getSelectedTextFromTab: getSelectedTextFromTab2
  });
  const {
    getFavoriteExecutionSteps,
    getFavoriteTargetSiteIds,
    previewFavoriteText,
    detectFavoriteExecutionBlockers,
    buildFavoriteStepPrompt
  } = createFavoriteTemplateResolutionTools({
    getWorkflowMessage: messages.getWorkflowMessage
  });
  async function createFavoriteFailureHistory(details = {}) {
    const requestedSiteIds = normalizeSiteIdList(details.requestedSiteIds ?? []);
    const siteResults = Object.fromEntries(
      requestedSiteIds.map((siteId) => [
        siteId,
        buildSiteResult("unexpected_error", {
          message: details.message || messages.getWorkflowMessage(
            "favorite_run_error_start_failed",
            [],
            "Favorite execution could not start."
          )
        })
      ])
    );
    await appendPromptHistory({
      id: Date.now(),
      text: details.text ?? "",
      requestedSiteIds,
      submittedSiteIds: [],
      failedSiteIds: requestedSiteIds,
      sentTo: [],
      createdAt: nowIso2(),
      status: "failed",
      siteResults,
      originFavoriteId: details.favoriteId ?? null,
      chainRunId: details.chainRunId ?? null,
      chainStepIndex: details.chainStepIndex ?? null,
      chainStepCount: details.chainStepCount ?? null,
      trigger: details.trigger ?? "scheduled"
    });
  }
  const favoriteRunJobHandlers = createFavoriteRunJobHandlers({
    nowIso: nowIso2,
    buildChainRunId: buildChainRunId2,
    previewFavoriteText,
    buildFavoriteStepPrompt,
    queueBroadcastRequest: queueBroadcastRequest2,
    createFavoriteFailureHistory,
    ...messages
  });
  const favoriteWorkflowEntryPoints = createFavoriteWorkflowEntryPoints({
    getBroadcastTriggerLabel: getBroadcastTriggerLabel2,
    openPopupWithPrompt: openPopupWithPrompt2,
    nowIso: nowIso2,
    buildChainRunId: buildChainRunId2,
    getWorkflowMessage: messages.getWorkflowMessage,
    previewFavoriteText,
    getFavoriteExecutionSteps,
    detectFavoriteExecutionBlockers,
    createEmptyExecutionContext,
    normalizePreparedExecutionContext: (input) => normalizePreparedExecutionContext(input),
    mergeExecutionContext,
    getExecutionTabContextFromSender,
    queueFavoriteRunJob: favoriteRunJobHandlers.queueFavoriteRunJob,
    createFavoriteFailureHistory
  });
  return {
    buildScheduleAlarmName,
    parseScheduleAlarmFavoriteId,
    getFavoriteExecutionSteps,
    getFavoriteTargetSiteIds,
    previewFavoriteText,
    reconcileFavoriteRunJobs: favoriteRunJobHandlers.reconcileFavoriteRunJobs,
    reconcileFavoriteSchedules: favoriteWorkflowEntryPoints.reconcileFavoriteSchedules,
    handleFavoriteScheduleAlarm: favoriteWorkflowEntryPoints.handleFavoriteScheduleAlarm,
    handleFavoriteRunMessage: favoriteWorkflowEntryPoints.handleFavoriteRunMessage,
    handleFavoriteOpenEditorMessage: favoriteWorkflowEntryPoints.handleFavoriteOpenEditorMessage,
    handleQuickPaletteGetState: favoriteWorkflowEntryPoints.handleQuickPaletteGetState,
    handleQuickPaletteExecuteMessage: favoriteWorkflowEntryPoints.handleQuickPaletteExecuteMessage,
    handleFavoriteRunJobAlarm: favoriteRunJobHandlers.handleFavoriteRunJobAlarm,
    handleFavoriteBroadcastCompletion: favoriteRunJobHandlers.handleFavoriteBroadcastCompletion
  };
}

// src/background/messages/router.ts
function safeSendResponse(sendResponse, payload) {
  try {
    sendResponse(payload);
  } catch (_error) {
    return false;
  }
  return true;
}
function buildFallback(work, error) {
  const fallback = {
    ok: false,
    error: error instanceof Error ? error.message : String(error)
  };
  return typeof work.onError === "function" ? work.onError(error, fallback) : fallback;
}
function isTrustedSender(sender) {
  if (sender?.tab?.id) {
    return true;
  }
  return sender?.id === chrome.runtime.id;
}
function respondWith(sendResponse, work, task) {
  void Promise.resolve().then(task).then((result) => {
    safeSendResponse(sendResponse, result);
  }).catch((error) => {
    if (work.errorLabel) {
      console.error(work.errorLabel, error);
    }
    safeSendResponse(sendResponse, buildFallback(work, error));
  });
}
function registerRuntimeMessageRouter(handlers) {
  chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
      if (!isTrustedSender(sender)) {
        return false;
      }
      const action = message?.action;
      if (!action) {
        return false;
      }
      const handler = handlers[action];
      if (!handler) {
        return false;
      }
      if (handler.sync) {
        try {
          safeSendResponse(
            sendResponse,
            handler.run(
              message,
              sender
            )
          );
        } catch (error) {
          if (handler.errorLabel) {
            console.error(handler.errorLabel, error);
          }
          safeSendResponse(sendResponse, buildFallback(handler, error));
        }
        return false;
      }
      respondWith(
        sendResponse,
        handler,
        () => handler.run(message, sender)
      );
      return true;
    }
  );
}

// src/background/app/selector-pending.ts
function normalizeText3(value) {
  return typeof value === "string" ? value.trim() : "";
}
function normalizeMissingEntries(value) {
  return (Array.isArray(value) ? value : []).map((entry) => ({
    field: normalizeText3(entry?.field),
    selector: normalizeText3(entry?.selector)
  })).filter((entry) => entry.field || entry.selector);
}
function clonePendingRecords(records) {
  if (!records || typeof records !== "object") {
    return {};
  }
  return Object.entries(records).reduce(
    (accumulator, [key, value]) => {
      const signature = normalizeText3(key) || normalizeText3(value?.signature);
      const serviceId = normalizeText3(value?.serviceId);
      if (!signature || !serviceId) {
        return accumulator;
      }
      const count = Number(value?.count);
      const firstSeenAt = Number(value?.firstSeenAt);
      const lastSeenAt = Number(value?.lastSeenAt);
      const fallbackNow = Date.now();
      accumulator[signature] = {
        serviceId,
        signature,
        missing: Array.isArray(value?.missing) ? value.missing.map((entry) => normalizeText3(entry)).filter(Boolean) : [],
        count: Number.isFinite(count) ? Math.max(1, Math.round(count)) : 1,
        firstSeenAt: Number.isFinite(firstSeenAt) ? firstSeenAt : fallbackNow,
        lastSeenAt: Number.isFinite(lastSeenAt) ? lastSeenAt : fallbackNow
      };
      return accumulator;
    },
    {}
  );
}
function clearPendingSelectorChecksForService(records, serviceId) {
  const normalizedServiceId = normalizeText3(serviceId);
  if (!normalizedServiceId) {
    return clonePendingRecords(records);
  }
  return Object.fromEntries(
    Object.entries(clonePendingRecords(records)).filter(
      ([, record]) => normalizeText3(record?.serviceId) !== normalizedServiceId
    )
  );
}
function registerPendingSelectorCheck(records, report, nowMs = Date.now()) {
  const siteId = normalizeText3(report?.siteId) || "unknown";
  const missingEntries = normalizeMissingEntries(report?.missing);
  const signature = buildSelectorAlertSignature({
    siteId,
    missing: missingEntries
  });
  const next = clonePendingRecords(records);
  const existing = next[signature];
  if (existing && normalizeText3(existing.serviceId) === siteId) {
    const promotedRecord = {
      ...existing,
      count: Math.max(2, Math.round(Number(existing.count) || 1) + 1),
      lastSeenAt: nowMs
    };
    delete next[signature];
    return {
      next,
      signature,
      promoted: true,
      record: promotedRecord
    };
  }
  const record = {
    serviceId: siteId,
    signature,
    missing: missingEntries.map(
      (entry) => entry.field ? `${entry.field}:${entry.selector}` : entry.selector
    ),
    count: 1,
    firstSeenAt: nowMs,
    lastSeenAt: nowMs
  };
  next[signature] = record;
  return {
    next,
    signature,
    promoted: false,
    record
  };
}

// src/background/session/store.ts
function clonePlainValue(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}
function createBackgroundSessionStore() {
  const sessionState = {
    loaded: false,
    pendingInjections: {},
    pendingBroadcasts: {},
    pendingSelectorChecks: {},
    selectorAlerts: {}
  };
  let mutationChain = Promise.resolve();
  async function ensureLoaded() {
    if (sessionState.loaded) {
      return;
    }
    try {
      const result = await chrome.storage.session.get([
        PENDING_INJECTIONS_KEY,
        PENDING_BROADCASTS_KEY,
        PENDING_SELECTOR_CHECKS_KEY,
        SELECTOR_ALERTS_KEY
      ]);
      sessionState.pendingInjections = clonePlainValue(
        result[PENDING_INJECTIONS_KEY] ?? {}
      ) ?? {};
      sessionState.pendingBroadcasts = clonePlainValue(
        result[PENDING_BROADCASTS_KEY] ?? {}
      ) ?? {};
      sessionState.pendingSelectorChecks = clonePlainValue(
        result[PENDING_SELECTOR_CHECKS_KEY] ?? {}
      ) ?? {};
      sessionState.selectorAlerts = clonePlainValue(
        result[SELECTOR_ALERTS_KEY] ?? {}
      ) ?? {};
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to initialize session-state cache.", error);
      sessionState.pendingInjections = {};
      sessionState.pendingBroadcasts = {};
      sessionState.pendingSelectorChecks = {};
      sessionState.selectorAlerts = {};
    }
    sessionState.loaded = true;
  }
  async function persist() {
    await chrome.storage.session.set({
      [PENDING_INJECTIONS_KEY]: sessionState.pendingInjections,
      [PENDING_BROADCASTS_KEY]: sessionState.pendingBroadcasts,
      [PENDING_SELECTOR_CHECKS_KEY]: sessionState.pendingSelectorChecks,
      [SELECTOR_ALERTS_KEY]: sessionState.selectorAlerts
    });
  }
  function mutate(mutator) {
    const runMutation = async () => {
      await ensureLoaded();
      const result = await mutator(sessionState);
      await persist();
      return result;
    };
    const resultPromise = mutationChain.then(runMutation, runMutation);
    mutationChain = resultPromise.then(() => void 0, () => void 0);
    return resultPromise;
  }
  async function waitForIdle() {
    await mutationChain;
  }
  async function getPendingInjections2() {
    await ensureLoaded();
    return clonePlainValue(sessionState.pendingInjections) ?? {};
  }
  function setPendingInjections2(value) {
    return mutate((state) => {
      state.pendingInjections = clonePlainValue(value) ?? {};
      return clonePlainValue(state.pendingInjections) ?? {};
    });
  }
  async function getPendingBroadcasts2() {
    await ensureLoaded();
    return clonePlainValue(sessionState.pendingBroadcasts) ?? {};
  }
  function setPendingBroadcasts2(value) {
    return mutate((state) => {
      state.pendingBroadcasts = clonePlainValue(value) ?? {};
      return clonePlainValue(state.pendingBroadcasts) ?? {};
    });
  }
  async function getSelectorAlerts2() {
    await ensureLoaded();
    return clonePlainValue(sessionState.selectorAlerts) ?? {};
  }
  function setSelectorAlerts2(value) {
    return mutate((state) => {
      state.selectorAlerts = clonePlainValue(value) ?? {};
      return clonePlainValue(state.selectorAlerts) ?? {};
    });
  }
  function clearPendingSelectorChecksForSiteId2(serviceId) {
    if (!(typeof serviceId === "string" && serviceId.trim())) {
      return Promise.resolve({});
    }
    return mutate((state) => {
      state.pendingSelectorChecks = clearPendingSelectorChecksForService(
        state.pendingSelectorChecks,
        serviceId
      );
      return clonePlainValue(state.pendingSelectorChecks) ?? {};
    });
  }
  function registerPendingSelectorCheckReport2(report) {
    return mutate((state) => {
      const result = registerPendingSelectorCheck(
        state.pendingSelectorChecks,
        report
      );
      state.pendingSelectorChecks = result.next;
      return clonePlainValue(result) ?? result;
    });
  }
  function updatePendingInjection2(tabId, updater) {
    return mutate((state) => {
      const pending = state.pendingInjections ?? {};
      const current = pending[String(tabId)];
      const nextValue = typeof updater === "function" ? updater(clonePlainValue(current) ?? null) : updater;
      if (nextValue) {
        pending[String(tabId)] = nextValue;
      } else {
        delete pending[String(tabId)];
      }
      state.pendingInjections = pending;
      return clonePlainValue(nextValue) ?? null;
    });
  }
  function addPendingInjection2(tabId, payload) {
    return updatePendingInjection2(tabId, {
      ...payload,
      tabId,
      createdAt: Number(payload.createdAt) || Date.now(),
      injected: Boolean(payload.injected),
      status: payload.status || "pending",
      closeOnCancel: payload.closeOnCancel !== false
    });
  }
  async function removePendingInjection2(tabId) {
    await updatePendingInjection2(tabId, null);
  }
  return {
    mutate,
    waitForIdle,
    getPendingInjections: getPendingInjections2,
    setPendingInjections: setPendingInjections2,
    getPendingBroadcasts: getPendingBroadcasts2,
    setPendingBroadcasts: setPendingBroadcasts2,
    getSelectorAlerts: getSelectorAlerts2,
    setSelectorAlerts: setSelectorAlerts2,
    clearPendingSelectorChecksForSiteId: clearPendingSelectorChecksForSiteId2,
    registerPendingSelectorCheckReport: registerPendingSelectorCheckReport2,
    updatePendingInjection: updatePendingInjection2,
    addPendingInjection: addPendingInjection2,
    removePendingInjection: removePendingInjection2
  };
}

// src/background/tabs/runtime.ts
function createBackgroundTabsRuntime(deps) {
  const {
    getRuntimeSites: getRuntimeSites2,
    isInjectableTabUrl: isInjectableTabUrl2,
    isSameSiteOrigin: isSameSiteOrigin2,
    isReusableTabForSite: isReusableTabForSite2
  } = deps;
  let lastNormalWindowId = null;
  let lastNormalTabId = null;
  function sleep2(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, Number.isFinite(ms) ? ms : 0);
    });
  }
  async function rememberNormalTab2(tab) {
    if (!tab?.id || !Number.isFinite(tab.windowId)) {
      return null;
    }
    try {
      const windowInfo = await chrome.windows.get(tab.windowId).catch(() => null);
      if (windowInfo?.type !== "normal") {
        return null;
      }
      lastNormalWindowId = typeof windowInfo.id === "number" ? windowInfo.id : null;
      lastNormalTabId = tab.id ?? null;
      return tab;
    } catch (_error) {
      return null;
    }
  }
  async function getPreferredNormalWindowId2(preferredWindowId = null) {
    const normalizedPreferredWindowId = Number(preferredWindowId);
    if (Number.isFinite(normalizedPreferredWindowId)) {
      try {
        const preferredWindow = await chrome.windows.get(
          normalizedPreferredWindowId
        );
        if (preferredWindow?.type === "normal") {
          return typeof preferredWindow.id === "number" ? preferredWindow.id : null;
        }
      } catch (_error) {
      }
    }
    try {
      const lastFocusedTabs = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true
      });
      const lastFocusedTab = lastFocusedTabs[0];
      if (Number.isFinite(lastFocusedTab?.windowId)) {
        const windowInfo = await chrome.windows.get(
          lastFocusedTab.windowId
        ).catch(() => null);
        if (windowInfo?.type === "normal") {
          return typeof windowInfo.id === "number" ? windowInfo.id : null;
        }
      }
    } catch (_error) {
    }
    if (Number.isFinite(lastNormalWindowId)) {
      try {
        const rememberedWindow = await chrome.windows.get(
          lastNormalWindowId
        );
        if (rememberedWindow?.type === "normal") {
          return typeof rememberedWindow.id === "number" ? rememberedWindow.id : null;
        }
      } catch (_error) {
        lastNormalWindowId = null;
      }
    }
    try {
      const windows = await chrome.windows.getAll({
        windowTypes: ["normal"]
      });
      const focusedWindow = windows.find((windowInfo) => windowInfo?.focused && Number.isFinite(windowInfo?.id));
      return focusedWindow?.id ?? windows.find((windowInfo) => Number.isFinite(windowInfo?.id))?.id ?? null;
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to resolve preferred normal window.", error);
      return null;
    }
  }
  async function getPreferredNormalActiveTab2(preferredWindowId = null) {
    try {
      const lastFocusedTabs = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true
      });
      const lastFocusedTab = lastFocusedTabs[0];
      const rememberedLastFocused = await rememberNormalTab2(lastFocusedTab);
      if (rememberedLastFocused) {
        return rememberedLastFocused;
      }
    } catch (_error) {
    }
    const targetWindowId = await getPreferredNormalWindowId2(preferredWindowId);
    if (Number.isFinite(targetWindowId)) {
      try {
        const activeTabs = await chrome.tabs.query({
          active: true,
          windowId: targetWindowId
        });
        const activeTab = activeTabs[0];
        const rememberedTargetTab = await rememberNormalTab2(activeTab);
        if (rememberedTargetTab) {
          return rememberedTargetTab;
        }
      } catch (_error) {
      }
    }
    if (Number.isFinite(lastNormalTabId)) {
      try {
        const hintTab = await chrome.tabs.get(lastNormalTabId);
        const rememberedHintTab = await rememberNormalTab2(hintTab);
        if (rememberedHintTab) {
          return rememberedHintTab;
        }
      } catch (_error) {
        lastNormalTabId = null;
      }
    }
    if (Number.isFinite(lastNormalWindowId)) {
      try {
        const hintWindowTabs = await chrome.tabs.query({
          active: true,
          windowId: lastNormalWindowId
        });
        const hintWindowTab = hintWindowTabs[0];
        const rememberedHintWindowTab = await rememberNormalTab2(hintWindowTab);
        if (rememberedHintWindowTab) {
          return rememberedHintWindowTab;
        }
      } catch (_error) {
        lastNormalWindowId = null;
      }
    }
    return null;
  }
  async function getFocusedTabContext2() {
    try {
      const activeTab = await getPreferredNormalActiveTab2();
      if (!activeTab?.id || !Number.isFinite(activeTab.windowId)) {
        return null;
      }
      return {
        tabId: activeTab.id,
        windowId: activeTab.windowId
      };
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to read focused tab context.", error);
      return null;
    }
  }
  async function isTabLoadReady(tabId) {
    try {
      const [executionResult] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => ({ readyState: document.readyState })
      });
      const result = executionResult?.result;
      return result?.readyState === "interactive" || result?.readyState === "complete";
    } catch (_error) {
      return false;
    }
  }
  async function waitForTabInteractionReady2(tabId, timeoutMs = TAB_LOAD_READY_TIMEOUT_MS) {
    const deadline = Date.now() + Math.max(timeoutMs, 0);
    while (Date.now() <= deadline) {
      if (await isTabLoadReady(tabId)) {
        return true;
      }
      await sleep2(150);
    }
    return false;
  }
  async function restoreFocusedTabContext2(context) {
    if (!context?.tabId || !Number.isFinite(context.windowId)) {
      return;
    }
    try {
      await chrome.windows.update(context.windowId, { focused: true });
      await chrome.tabs.update(context.tabId, { active: true });
    } catch (_error) {
    }
  }
  async function getOpenAiTabsForWindow2(windowId) {
    const normalizedWindowId = Number(windowId);
    if (!Number.isFinite(normalizedWindowId)) {
      return [];
    }
    try {
      const [runtimeSites, tabs] = await Promise.all([
        getRuntimeSites2(),
        chrome.tabs.query({ windowId: normalizedWindowId })
      ]);
      const openTabs = await Promise.all(
        tabs.map(async (tab) => {
          if (!Number.isFinite(tab?.id) || !isInjectableTabUrl2(tab?.url ?? "")) {
            return null;
          }
          const site = runtimeSites.find((entry) => isSameSiteOrigin2(tab.url ?? "", entry));
          if (!site) {
            return null;
          }
          if (!await isReusableTabForSite2(tab, site)) {
            return null;
          }
          return {
            siteId: site.id,
            siteName: site.name,
            tabId: tab.id ?? 0,
            title: typeof tab.title === "string" ? tab.title : "",
            url: typeof tab.url === "string" ? tab.url : "",
            active: Boolean(tab.active),
            status: typeof tab.status === "string" ? tab.status : "",
            windowId: normalizedWindowId
          };
        })
      );
      return openTabs.filter((tab) => Boolean(tab));
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to collect open AI tabs.", {
        windowId: normalizedWindowId,
        error
      });
      return [];
    }
  }
  function clearRememberedTab2(tabId) {
    if (lastNormalTabId === tabId) {
      lastNormalTabId = null;
    }
  }
  function resetRememberedState2() {
    lastNormalWindowId = null;
    lastNormalTabId = null;
  }
  return {
    rememberNormalTab: rememberNormalTab2,
    getPreferredNormalWindowId: getPreferredNormalWindowId2,
    getPreferredNormalActiveTab: getPreferredNormalActiveTab2,
    getFocusedTabContext: getFocusedTabContext2,
    waitForTabInteractionReady: waitForTabInteractionReady2,
    restoreFocusedTabContext: restoreFocusedTabContext2,
    getOpenAiTabsForWindow: getOpenAiTabsForWindow2,
    clearRememberedTab: clearRememberedTab2,
    resetRememberedState: resetRememberedState2
  };
}

// src/background/runtime/handlers.ts
function buildRuntimeHandlers(deps) {
  return {
    broadcast: {
      run: (message) => deps.handleBroadcastMessage(message),
      errorLabel: "[AI Prompt Broadcaster] Broadcast handling failed."
    },
    "selector-check:init": {
      run: (message) => deps.handleSelectorCheckInit(message),
      errorLabel: "[AI Prompt Broadcaster] Selector check init failed."
    },
    "selector-check:report": {
      run: (message) => deps.handleSelectorCheckReport(message),
      errorLabel: "[AI Prompt Broadcaster] Selector check report failed."
    },
    "service-test:run": {
      run: (message) => deps.handleServiceTestRun(message),
      errorLabel: "[AI Prompt Broadcaster] Service test run failed."
    },
    selectorFailed: {
      run: (message) => deps.handleSelectorFailedMessage(message)
    },
    injectSuccess: {
      run: (message) => deps.handleInjectSuccessMessage(message)
    },
    injectFallback: {
      run: (message) => deps.handleInjectFallbackMessage(message)
    },
    uiToast: {
      run: (message) => deps.handleUiToastMessage(message)
    },
    popupOpened: {
      run: () => deps.handlePopupOpened()
    },
    getOpenAiTabs: {
      run: (message) => deps.handleGetOpenAiTabsMessage(message)
    },
    cancelBroadcast: {
      run: (message) => deps.handleCancelBroadcastMessage(message)
    },
    "favorite:run": {
      run: (message, sender) => deps.handleFavoriteRunMessage(message, sender)
    },
    "favorite:openEditor": {
      run: (message) => deps.handleFavoriteOpenEditorMessage(message)
    },
    resetAllData: {
      run: () => deps.resetAllExtensionData(),
      errorLabel: "[AI Prompt Broadcaster] Reset-all-data failed."
    },
    getActiveTabContext: {
      run: () => deps.handleGetActiveTabContext(),
      onError: (error, fallback) => ({
        ...fallback,
        url: "",
        title: "",
        selection: ""
      })
    },
    getBroadcastCounter: {
      run: () => deps.handleGetBroadcastCounter(),
      onError: (error, fallback) => ({
        ...fallback,
        counter: 0
      })
    },
    "selection:update": {
      sync: true,
      run: (message, sender) => deps.handleSelectionUpdateMessage(message, sender)
    },
    "quickPalette:getState": {
      run: () => deps.handleQuickPaletteGetState()
    },
    "quickPalette:execute": {
      run: (message, sender) => deps.handleQuickPaletteExecuteMessage(message, sender)
    },
    "quickPalette:close": {
      sync: true,
      run: () => ({ ok: true })
    },
    "service-health:get": {
      run: () => deps.handleServiceHealthGet(),
      errorLabel: "[AI Prompt Broadcaster] Service health retrieval failed."
    },
    "comparison-note:list": {
      run: (message) => deps.handleComparisonNoteList(message)
    },
    "comparison-note:save": {
      run: (message) => deps.handleComparisonNoteSave(message)
    },
    "comparison-note:delete": {
      run: (message) => deps.handleComparisonNoteDelete(message)
    },
    "comparison-capture:start": {
      run: (message) => deps.handleComparisonCaptureStart(message),
      errorLabel: "[AI Prompt Broadcaster] Comparison capture failed."
    },
    "experiment:save": {
      run: (message) => deps.handleExperimentSave(message)
    },
    "experiment:delete": {
      run: (message) => deps.handleExperimentDelete(message)
    },
    "experiment:run": {
      run: (message) => deps.handleExperimentRun(message),
      errorLabel: "[AI Prompt Broadcaster] Prompt experiment run failed."
    },
    "template-pack:export": {
      run: (message) => deps.handleTemplatePackExport(message)
    },
    "template-pack:import": {
      run: (message) => deps.handleTemplatePackImport(message)
    },
    "service-groups:update": {
      run: (message) => deps.handleServiceGroupsUpdate(message)
    }
  };
}

// src/background/app/bootstrap.ts
var DEFAULT_SUBMIT_BUTTON_WAIT_TIMEOUT_MS = 5e3;
var DEFAULT_SUBMIT_RETRY_COUNT = 1;
var activeInjections = /* @__PURE__ */ new Set();
var queuedInjectionTabIds = /* @__PURE__ */ new Set();
var broadcastCompletionWaiters = /* @__PURE__ */ new Map();
var selectionCache = /* @__PURE__ */ new Map();
var suppressedCompletedBroadcastIds = /* @__PURE__ */ new Set();
var contextMenuRefreshChain = Promise.resolve();
var injectionProcessChain = Promise.resolve();
var SCHEDULED_VARIABLE_BLOCKLIST2 = /* @__PURE__ */ new Set([
  SYSTEM_TEMPLATE_VARIABLES.url,
  SYSTEM_TEMPLATE_VARIABLES.title,
  SYSTEM_TEMPLATE_VARIABLES.selection,
  SYSTEM_TEMPLATE_VARIABLES.clipboard
]);
var COMPARISON_CAPTURE_SELECTORS = {
  chatgpt: [
    '[data-message-author-role="assistant"]',
    'article [data-message-author-role="assistant"]'
  ],
  gemini: [
    "message-content",
    ".model-response-text",
    "[data-response-index] message-content"
  ],
  claude: [
    '[data-testid="conversation-turn-assistant"]',
    '[data-testid*="assistant" i]',
    ".font-claude-message"
  ],
  grok: [
    '[data-testid*="message" i] [class*="markdown" i]',
    '[data-testid*="answer" i]'
  ],
  perplexity: [
    '[data-testid*="answer" i]',
    '[data-testid*="thread-answer" i]',
    "main .prose"
  ]
};
var AUTO_RESPONSE_CAPTURE_TIMEOUT_MS = 45e3;
var AUTO_RESPONSE_CAPTURE_INTERVAL_MS = 3e3;
var AUTO_RESPONSE_CAPTURE_MIN_LENGTH = 20;
var AUTO_RESPONSE_CAPTURE_MEANINGFUL_DELTA = 40;
function getI18nMessage(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || "";
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, Number.isFinite(ms) ? ms : 0);
  });
}
function clonePlainValue2(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}
function normalizePrompt2(value) {
  return typeof value === "string" ? value : "";
}
function buildChainRunId() {
  return typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `chain-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function registerBroadcastCompletionWaiter(broadcastId) {
  const normalizedBroadcastId = typeof broadcastId === "string" ? broadcastId.trim() : "";
  if (!normalizedBroadcastId) {
    return Promise.resolve(null);
  }
  const existing = broadcastCompletionWaiters.get(normalizedBroadcastId);
  if (existing?.promise) {
    return existing.promise;
  }
  let resolvePromise = null;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });
  if (resolvePromise) {
    broadcastCompletionWaiters.set(normalizedBroadcastId, {
      promise,
      resolve: resolvePromise
    });
  }
  return promise;
}
function resolveBroadcastCompletionWaiter(broadcastId, summary = null) {
  const normalizedBroadcastId = typeof broadcastId === "string" ? broadcastId.trim() : "";
  if (!normalizedBroadcastId) {
    return;
  }
  const existing = broadcastCompletionWaiters.get(normalizedBroadcastId);
  if (!existing?.resolve) {
    return;
  }
  existing.resolve(summary);
  broadcastCompletionWaiters.delete(normalizedBroadcastId);
}
function getBroadcastTriggerLabel(trigger) {
  const normalized = typeof trigger === "string" ? trigger.trim() : "";
  return normalized === "scheduled" || normalized === "palette" || normalized === "options" ? normalized : "popup";
}
var backgroundSessionStore = createBackgroundSessionStore();
var {
  mutate: queueBackgroundStateMutation,
  waitForIdle: waitForBackgroundStateSettled,
  getPendingInjections,
  setPendingInjections,
  getPendingBroadcasts,
  setPendingBroadcasts,
  getSelectorAlerts,
  setSelectorAlerts,
  clearPendingSelectorChecksForSiteId,
  registerPendingSelectorCheckReport,
  updatePendingInjection,
  addPendingInjection,
  removePendingInjection
} = backgroundSessionStore;
var getPreferredNormalActiveTab = async () => null;
var backgroundTabTargetResolver = createBackgroundTabTargetResolver({
  getRuntimeSites,
  getPendingInjections,
  getPreferredNormalActiveTab: (preferredWindowId) => getPreferredNormalActiveTab(preferredWindowId),
  getI18nMessage
});
var {
  getSiteById,
  getSiteForUrl,
  resolveSelectedTargets,
  buildSelectedTabUnavailableMessage,
  isInjectableTabUrl,
  getSitePermissionPatterns,
  isSameSiteOrigin,
  isReusableTabForSite,
  isCustomSitePermissionGranted,
  findReusableTabsForSites,
  getExplicitReusableTabForTarget,
  getPreferredInjectableNormalTab
} = backgroundTabTargetResolver;
var backgroundTabsRuntime = createBackgroundTabsRuntime({
  getRuntimeSites,
  isInjectableTabUrl,
  isSameSiteOrigin,
  isReusableTabForSite
});
var rememberNormalTab = backgroundTabsRuntime.rememberNormalTab;
var getPreferredNormalWindowId = backgroundTabsRuntime.getPreferredNormalWindowId;
getPreferredNormalActiveTab = backgroundTabsRuntime.getPreferredNormalActiveTab;
var getFocusedTabContext = backgroundTabsRuntime.getFocusedTabContext;
var waitForTabInteractionReady = backgroundTabsRuntime.waitForTabInteractionReady;
var restoreFocusedTabContext = backgroundTabsRuntime.restoreFocusedTabContext;
var getOpenAiTabsForWindow = backgroundTabsRuntime.getOpenAiTabsForWindow;
var clearRememberedTab = backgroundTabsRuntime.clearRememberedTab;
var resetRememberedState = backgroundTabsRuntime.resetRememberedState;
function queuePendingInjection(tabId, tab) {
  if (!Number.isFinite(Number(tabId))) {
    return injectionProcessChain;
  }
  if (activeInjections.has(tabId) || queuedInjectionTabIds.has(tabId)) {
    return injectionProcessChain;
  }
  queuedInjectionTabIds.add(tabId);
  injectionProcessChain = injectionProcessChain.catch(() => void 0).then(async () => {
    try {
      await processPendingInjectionNow(tabId, tab);
    } finally {
      queuedInjectionTabIds.delete(tabId);
    }
  }).catch((error) => {
    console.error("[AI Prompt Broadcaster] Queued injection processing failed.", {
      tabId,
      error
    });
    queuedInjectionTabIds.delete(tabId);
  });
  return injectionProcessChain;
}
function getBroadcastAgeMs(record) {
  const startedAtMs = Date.parse(record?.startedAt ?? "");
  return Number.isFinite(startedAtMs) ? Date.now() - startedAtMs : 0;
}
async function finalizeBroadcastSites(broadcastId, siteIds, status) {
  let lastSummary = null;
  for (const siteId of Array.isArray(siteIds) ? siteIds : []) {
    lastSummary = await recordBroadcastSiteResult(broadcastId, siteId, status) ?? lastSummary;
  }
  return lastSummary;
}
async function closeTabQuietly(tabId) {
  try {
    await chrome.tabs.remove(tabId);
  } catch (_error) {
  }
}
async function restoreBroadcastFocus(record) {
  if (!record) {
    return;
  }
  await restoreFocusedTabContext({
    tabId: Number.isFinite(Number(record.originTabId)) ? Number(record.originTabId) : null,
    windowId: Number.isFinite(Number(record.originWindowId)) ? Number(record.originWindowId) : null
  });
}
var { openPopupWithPrompt, openOnboardingPage } = createPopupLauncher();
var {
  getSelectedTextFromTab,
  maybeInjectDynamicSelectorChecker,
  handleSelectionUpdateMessage
} = createSelectionRuntime({
  selectionCache,
  getSiteForUrl,
  isInjectableTabUrl,
  isCustomSitePermissionGranted
});
var { handleQuickPaletteCommand } = createQuickPaletteCommand({
  getPreferredNormalActiveTab,
  isInjectableTabUrl,
  openPopupWithPrompt
});
var {
  getContextMenuTargetSiteIds,
  createContextMenus,
  handleContextMenuBroadcast,
  handleCaptureSelectedTextCommand
} = createContextMenuController({
  getI18nMessage,
  getEnabledRuntimeSites,
  getSitePermissionPatterns,
  openPopupWithPrompt,
  getSelectedTextFromTab,
  isInjectableTabUrl,
  handleBroadcastMessage,
  getContextMenuRefreshChain: () => contextMenuRefreshChain,
  setContextMenuRefreshChain: (value) => {
    contextMenuRefreshChain = value;
  }
});
var {
  buildScheduleAlarmName: buildScheduleAlarmName2,
  parseScheduleAlarmFavoriteId: parseScheduleAlarmFavoriteId2,
  reconcileFavoriteRunJobs,
  reconcileFavoriteSchedules,
  handleFavoriteScheduleAlarm,
  handleFavoriteRunMessage,
  handleFavoriteOpenEditorMessage,
  handleQuickPaletteGetState,
  handleQuickPaletteExecuteMessage,
  handleFavoriteRunJobAlarm,
  handleFavoriteBroadcastCompletion
} = createFavoriteWorkflow({
  getBroadcastTriggerLabel,
  getI18nMessage,
  rememberNormalTab,
  getPreferredNormalActiveTab,
  isInjectableTabUrl,
  getSelectedTextFromTab,
  openPopupWithPrompt,
  nowIso,
  buildChainRunId,
  queueBroadcastRequest
});
async function runServiceTestOnTab(tabId, draft) {
  const probeText = "__apb_probe__";
  const submitRequirement = buildSubmitRequirement(draft);
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (siteDraft, nextProbeText, nextSubmitRequirement) => {
      function isElementVisible(element) {
        if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
          return true;
        }
        const style = window.getComputedStyle(element);
        if (element instanceof HTMLElement && element.hidden || element.getAttribute("hidden") !== null || element.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
          return false;
        }
        return element.getClientRects().length > 0;
      }
      function findElementsDeep(selector, root = document, seen = /* @__PURE__ */ new Set(), matches = []) {
        if (!selector || typeof selector !== "string") {
          return matches;
        }
        if (typeof root.querySelectorAll === "function") {
          for (const element of Array.from(root.querySelectorAll(selector))) {
            if (!seen.has(element)) {
              seen.add(element);
              matches.push(element);
            }
          }
        }
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        let current = walker.currentNode;
        while (current) {
          if (current instanceof Element && current.shadowRoot) {
            findElementsDeep(selector, current.shadowRoot, seen, matches);
          }
          current = walker.nextNode();
        }
        return matches;
      }
      function findBestMatch(selectors, options = {}) {
        for (const selector of selectors) {
          const matches = findElementsDeep(selector);
          const visible = options.visibleOnly ? matches.filter((element) => isElementVisible(element)) : matches;
          const target = visible[0] ?? matches[0] ?? null;
          if (target) {
            return { element: target, selector };
          }
        }
        return { element: null, selector: selectors[0] ?? "" };
      }
      function detectInputType(element) {
        if (element instanceof HTMLTextAreaElement) {
          return "textarea";
        }
        if (element instanceof HTMLInputElement) {
          return "input";
        }
        return element instanceof HTMLElement && element.isContentEditable ? "contenteditable" : "";
      }
      function highlightElement(element, color) {
        if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
          return;
        }
        const previousOutline = element.style.outline;
        const previousOutlineOffset = element.style.outlineOffset;
        element.style.outline = `3px solid ${color}`;
        element.style.outlineOffset = "2px";
        window.setTimeout(() => {
          element.style.outline = previousOutline;
          element.style.outlineOffset = previousOutlineOffset;
        }, 1800);
      }
      function snapshotElementValue(element) {
        if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
          return {
            type: "value",
            value: element.value
          };
        }
        if (element instanceof HTMLElement && element.isContentEditable) {
          return {
            type: "html",
            html: element.innerHTML
          };
        }
        return {
          type: "text",
          text: element.textContent ?? ""
        };
      }
      function restoreElementValue(element, snapshot) {
        if (!snapshot) {
          return;
        }
        if (snapshot.type === "value" && (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement)) {
          element.value = snapshot.value ?? "";
        } else if (snapshot.type === "html" && element instanceof HTMLElement) {
          element.innerHTML = snapshot.html ?? "";
        } else if (snapshot.type === "text" && element instanceof HTMLElement) {
          element.textContent = snapshot.text ?? "";
        }
        element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "" }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }
      function applyProbeText(element, probeText2) {
        if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
          element.focus();
          element.value = probeText2;
        } else if (element instanceof HTMLElement && element.isContentEditable) {
          element.focus();
          element.textContent = probeText2;
        } else {
          throw new Error("Editable target was not found.");
        }
        element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: probeText2 }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }
      async function waitForVisibleSelector(selector, timeoutMs = 1800) {
        const startedAt = Date.now();
        while (Date.now() - startedAt <= timeoutMs) {
          const match = findBestMatch([selector], { visibleOnly: true });
          if (match.element) {
            return match;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 120));
        }
        return findBestMatch([selector], { visibleOnly: true });
      }
      try {
        const selectors = [
          siteDraft.inputSelector,
          ...Array.isArray(siteDraft.fallbackSelectors) ? siteDraft.fallbackSelectors : []
        ].filter((selector) => typeof selector === "string" && selector.trim());
        const inputMatch = findBestMatch(selectors, { visibleOnly: true });
        if (!inputMatch.element) {
          return {
            ok: true,
            input: {
              found: false,
              selector: inputMatch.selector,
              actualType: "",
              expectedType: siteDraft.inputType ?? ""
            },
            submit: {
              status: "skipped"
            }
          };
        }
        highlightElement(inputMatch.element, "#facc15");
        const actualInputType = detectInputType(inputMatch.element);
        const inputTypeMatches = actualInputType === String(siteDraft.inputType ?? "");
        const response = {
          ok: true,
          input: {
            found: true,
            selector: inputMatch.selector,
            actualType: actualInputType,
            expectedType: String(siteDraft.inputType ?? ""),
            typeMatches: inputTypeMatches
          },
          submit: {
            status: "skipped"
          }
        };
        if (String(siteDraft.submitMethod) !== "click" || nextSubmitRequirement !== "required" && nextSubmitRequirement !== "conditional") {
          response.submit = {
            status: "skipped",
            method: String(siteDraft.submitMethod ?? "enter")
          };
          return response;
        }
        const snapshot = snapshotElementValue(inputMatch.element);
        try {
          applyProbeText(inputMatch.element, nextProbeText);
          const submitMatch = await waitForVisibleSelector(String(siteDraft.submitSelector ?? ""));
          if (submitMatch.element) {
            highlightElement(submitMatch.element, "#34d399");
          }
          response.submit = {
            status: submitMatch.element ? "ok" : "missing",
            selector: submitMatch.selector
          };
        } finally {
          restoreElementValue(inputMatch.element, snapshot);
        }
        return response;
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    },
    args: [draft, probeText, submitRequirement]
  });
  return result?.result ?? {
    ok: false,
    error: "Selector test returned no result."
  };
}
async function clearBadge() {
  try {
    await chrome.action.setBadgeText({ text: "" });
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to clear badge.", error);
  }
}
async function applyBadgeForBroadcast(summary) {
  try {
    if (!summary || summary.status === "idle") {
      await clearBadge();
      return;
    }
    if (summary.status === "sending") {
      await chrome.action.setBadgeBackgroundColor({ color: "#d97706" });
      await chrome.action.setBadgeText({ text: "..." });
      return;
    }
    if (summary.status === "failed" || summary.status === "partial") {
      await chrome.action.setBadgeBackgroundColor({ color: "#b53b3b" });
      await chrome.action.setBadgeText({ text: "!" });
      return;
    }
    await chrome.action.setBadgeBackgroundColor({ color: "#1f8f5f" });
    await chrome.action.setBadgeText({ text: "✓" });
    chrome.alarms.create(BADGE_CLEAR_ALARM, {
      when: Date.now() + BADGE_CLEAR_DELAY_MS
    });
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to apply badge state.", error);
  }
}
async function syncLastBroadcast(summary) {
  await setLastBroadcast(summary);
  await applyBadgeForBroadcast(summary);
}
async function createPendingBroadcast(prompt, targets, metadata = {}) {
  const pendingInjections = await getPendingInjections();
  if (Object.keys(pendingInjections).length > 0) {
    console.warn("[AI Prompt Broadcaster] Starting a new broadcast while pending tabs still exist.", pendingInjections);
  }
  const originContext = await getFocusedTabContext();
  const sites = Array.isArray(targets) ? targets.map((target) => target.site).filter(Boolean) : [];
  const broadcastId = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `broadcast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record = {
    id: broadcastId,
    prompt,
    siteIds: sites.map((site) => site.id),
    total: sites.length,
    completed: 0,
    submittedSiteIds: [],
    failedSiteIds: [],
    siteResults: {},
    targetSnapshots: buildQueueTargetSnapshots(targets, prompt),
    startedAt: nowIso(),
    status: "sending",
    originTabId: originContext?.tabId ?? null,
    originWindowId: originContext?.windowId ?? null,
    openedTabIds: [],
    targetTabIdsBySiteId: {},
    originFavoriteId: typeof metadata.originFavoriteId === "string" && metadata.originFavoriteId.trim() ? metadata.originFavoriteId.trim() : null,
    chainRunId: typeof metadata.chainRunId === "string" && metadata.chainRunId.trim() ? metadata.chainRunId.trim() : null,
    chainStepIndex: Number.isFinite(Number(metadata.chainStepIndex)) ? Math.max(0, Math.round(Number(metadata.chainStepIndex))) : null,
    chainStepCount: Number.isFinite(Number(metadata.chainStepCount)) ? Math.max(0, Math.round(Number(metadata.chainStepCount))) : null,
    experimentRunId: typeof metadata.experimentRunId === "string" && metadata.experimentRunId.trim() ? metadata.experimentRunId.trim() : null,
    trigger: getBroadcastTriggerLabel(metadata.trigger)
  };
  await queueBackgroundStateMutation((state) => {
    state.pendingBroadcasts[broadcastId] = record;
    return clonePlainValue2(record);
  });
  await syncLastBroadcast(buildPendingBroadcastSummary(record, { finishedAt: "" }, nowIso()));
  return record;
}
async function maybeCreateSelectorNotification(report) {
  try {
    const settings = await getAppSettings();
    if (!settings.desktopNotifications) {
      return;
    }
    const signature = buildSelectorAlertSignature(report);
    const shouldNotify = await queueBackgroundStateMutation((state) => {
      const selectorAlerts = state.selectorAlerts ?? {};
      if (selectorAlerts[signature]) {
        return false;
      }
      selectorAlerts[signature] = Date.now();
      state.selectorAlerts = selectorAlerts;
      return true;
    });
    if (!shouldNotify) {
      return;
    }
    await chrome.notifications.create(`selector-changed-${report.siteId}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL(NOTIFICATION_ICON_PATH),
      title: getI18nMessage("notification_selector_title", [report.siteName]) || `${report.siteName} input check needed`,
      message: getI18nMessage("notification_selector_message", [report.siteName]) || `${report.siteName} input box was not found. Complete login or security checks, then try again.`
    });
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to create selector notification.", {
      report,
      error
    });
  }
}
async function maybeCreateBroadcastNotification(summary) {
  try {
    const settings = await getAppSettings();
    if (!settings.desktopNotifications) {
      return;
    }
    const successCount = (summary.submittedSiteIds ?? []).length;
    const failedSiteIds = [...summary.failedSiteIds ?? []];
    const failedCount = failedSiteIds.length;
    const failedNames = (await Promise.all(failedSiteIds.map(async (siteId) => (await getSiteById(siteId))?.name ?? siteId))).filter(Boolean);
    let title = getI18nMessage("notification_broadcast_title_success") || "AI Broadcaster";
    let message = "";
    if (summary.status === "failed") {
      title = getI18nMessage("notification_broadcast_title_failed") || "AI Broadcaster";
      message = getI18nMessage("notification_broadcast_message_failed") || "Broadcast failed. Check each tab for details.";
    } else if (summary.status === "partial") {
      title = getI18nMessage("notification_broadcast_title_partial") || "AI Broadcaster";
      message = getI18nMessage("notification_broadcast_message_partial_named", [
        String(successCount),
        String(failedCount),
        failedNames.join(", ")
      ]) || `${successCount} succeeded, ${failedCount} failed (${failedNames.join(", ")})`;
    } else {
      title = getI18nMessage("notification_broadcast_title_success") || "AI Broadcaster";
      message = getI18nMessage("notification_broadcast_message_success_named", [String(successCount)]) || `${successCount} service(s) completed`;
    }
    await chrome.notifications.create(`broadcast-complete-${Date.now()}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL(NOTIFICATION_ICON_PATH),
      title,
      message
    });
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to create broadcast notification.", error);
  }
}
async function recordBroadcastSiteResult(broadcastId, siteId, resultInput) {
  const result = typeof resultInput === "string" ? buildSiteResult(resultInput) : buildSiteResult(resultInput?.code ?? resultInput, resultInput ?? {});
  try {
    const mutationResult = await queueBackgroundStateMutation((state) => {
      const record = state.pendingBroadcasts[broadcastId];
      if (!record) {
        return {
          summary: null,
          completedRecord: null
        };
      }
      if (record.siteResults?.[siteId]) {
        return {
          summary: buildPendingBroadcastSummary(record, {}, nowIso()),
          completedRecord: null
        };
      }
      const mutation = applyPendingBroadcastSiteResult(record, siteId, result, nowIso());
      if (mutation.nextRecord) {
        state.pendingBroadcasts[broadcastId] = mutation.nextRecord;
      } else {
        delete state.pendingBroadcasts[broadcastId];
      }
      return {
        summary: mutation.summary,
        completedRecord: mutation.completedRecord ? clonePlainValue2(mutation.completedRecord) : null
      };
    });
    if (!mutationResult?.summary) {
      return null;
    }
    const { summary, completedRecord } = mutationResult;
    const runSideEffect = async (label, effect) => {
      try {
        await effect();
      } catch (sideEffectError) {
        console.error("[AI Prompt Broadcaster] Broadcast completion side effect failed.", {
          broadcastId,
          siteId,
          result,
          label,
          sideEffectError
        });
      }
    };
    if (completedRecord) {
      const suppressCompletionEffects = suppressedCompletedBroadcastIds.has(broadcastId);
      suppressedCompletedBroadcastIds.delete(broadcastId);
      await runSideEffect("syncLastBroadcast", async () => {
        await syncLastBroadcast(summary);
      });
      await runSideEffect("handleFavoriteBroadcastCompletion", async () => {
        await handleFavoriteBroadcastCompletion(summary);
      });
      resolveBroadcastCompletionWaiter(broadcastId, summary);
      if (suppressCompletionEffects) {
        return summary;
      }
      await runSideEffect("appendPromptHistory", async () => {
        const historyItem = await appendPromptHistory({
          id: Date.now(),
          text: completedRecord.prompt,
          requestedSiteIds: completedRecord.siteIds,
          submittedSiteIds: completedRecord.submittedSiteIds,
          failedSiteIds: completedRecord.failedSiteIds,
          sentTo: completedRecord.submittedSiteIds,
          createdAt: completedRecord.startedAt,
          status: summary.status,
          siteResults: completedRecord.siteResults,
          targetSnapshots: completedRecord.targetSnapshots,
          originFavoriteId: completedRecord.originFavoriteId ?? null,
          chainRunId: completedRecord.chainRunId ?? null,
          chainStepIndex: completedRecord.chainStepIndex ?? null,
          chainStepCount: completedRecord.chainStepCount ?? null,
          experimentRunId: completedRecord.experimentRunId ?? null,
          trigger: completedRecord.trigger ?? "popup"
        });
        void autoCaptureBroadcastResponses(historyItem, completedRecord).catch((error) => {
          console.warn("[AI Prompt Broadcaster] Automatic response capture failed.", error);
        });
      });
      await runSideEffect("restoreBroadcastFocus", async () => {
        await restoreBroadcastFocus(completedRecord);
      });
      await runSideEffect("maybeCreateBroadcastNotification", async () => {
        await maybeCreateBroadcastNotification(summary);
      });
    } else {
      await runSideEffect("syncLastBroadcast", async () => {
        await syncLastBroadcast(summary);
      });
    }
    return summary;
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to record broadcast site result.", {
      broadcastId,
      siteId,
      result,
      error
    });
    return null;
  }
}
async function cancelBroadcast(broadcastId, reason = "cancelled") {
  const normalizedBroadcastId = typeof broadcastId === "string" ? broadcastId.trim() : "";
  if (!normalizedBroadcastId) {
    return null;
  }
  const pendingBroadcastsBeforeCancel = await getPendingBroadcasts();
  const recordBeforeCancel = pendingBroadcastsBeforeCancel[normalizedBroadcastId] ?? null;
  const pendingInjections = await getPendingInjections();
  const matchingJobs = Object.entries(pendingInjections).filter(
    ([, job]) => job?.broadcastId === normalizedBroadcastId
  );
  const pendingSiteIds = /* @__PURE__ */ new Set();
  const tabsToClose = new Set(
    Array.isArray(recordBeforeCancel?.openedTabIds) ? recordBeforeCancel.openedTabIds.map((tabId) => Number(tabId)).filter((tabId) => Number.isFinite(tabId)) : []
  );
  for (const [tabIdKey, job] of matchingJobs) {
    const tabId = Number(tabIdKey);
    if (job?.siteId) {
      pendingSiteIds.add(job.siteId);
    }
    await removePendingInjection(tabId);
    activeInjections.delete(tabId);
    if (job?.closeOnCancel !== false && Number.isFinite(tabId)) {
      tabsToClose.add(tabId);
    }
  }
  let lastSummary = null;
  lastSummary = await finalizeBroadcastSites(
    normalizedBroadcastId,
    [...pendingSiteIds],
    buildSiteResult(reason === "reset" ? "cancelled" : reason)
  ) ?? lastSummary;
  const refreshedPendingBroadcasts = await getPendingBroadcasts();
  const record = refreshedPendingBroadcasts[normalizedBroadcastId];
  const unresolvedSiteIds = getUnresolvedPendingBroadcastSiteIds(record).filter((siteId) => !pendingSiteIds.has(siteId));
  lastSummary = await finalizeBroadcastSites(
    normalizedBroadcastId,
    unresolvedSiteIds,
    buildSiteResult(reason === "reset" ? "cancelled" : reason)
  ) ?? lastSummary;
  await Promise.all([...tabsToClose].map(async (tabId) => closeTabQuietly(Number(tabId))));
  await restoreBroadcastFocus(recordBeforeCancel);
  const fallbackSummary = await getLastBroadcast();
  const summary = lastSummary ?? fallbackSummary;
  if (reason !== "reset") {
    await enqueueUiToast({
      message: getI18nMessage("toast_broadcast_cancelled") || "Broadcast cancelled.",
      type: "warning",
      duration: 5e3,
      meta: {
        broadcastId: normalizedBroadcastId,
        reason
      }
    });
  }
  resolveBroadcastCompletionWaiter(normalizedBroadcastId, summary ?? null);
  return summary;
}
async function reconcilePendingBroadcasts() {
  const pendingBroadcasts = await getPendingBroadcasts();
  const pendingInjections = await getPendingInjections();
  const jobsByBroadcastId = /* @__PURE__ */ new Map();
  for (const [tabIdKey, job] of Object.entries(pendingInjections)) {
    if (!job?.broadcastId) {
      continue;
    }
    const current = jobsByBroadcastId.get(job.broadcastId) ?? [];
    current.push([tabIdKey, job]);
    jobsByBroadcastId.set(job.broadcastId, current);
  }
  for (const [broadcastId, record] of Object.entries(pendingBroadcasts)) {
    const unresolvedSiteIds = getUnresolvedPendingBroadcastSiteIds(record);
    if (unresolvedSiteIds.length === 0) {
      continue;
    }
    const relatedJobs = jobsByBroadcastId.get(broadcastId) ?? [];
    if (relatedJobs.length === 0) {
      await finalizeBroadcastSites(broadcastId, unresolvedSiteIds, "broadcast_stale");
      continue;
    }
    if (getBroadcastAgeMs(record) <= PENDING_TIMEOUT_MS) {
      continue;
    }
    for (const [tabIdKey] of relatedJobs) {
      const tabId = Number(tabIdKey);
      await removePendingInjection(tabId);
      activeInjections.delete(tabId);
      await closeTabQuietly(tabId);
    }
    await finalizeBroadcastSites(broadcastId, unresolvedSiteIds, "injection_timeout");
  }
}
async function injectIntoTab(tabId, prompt, site, runtimeOverrides = {}) {
  const config = buildInjectionConfig(site, runtimeOverrides);
  if (site?.id === "perplexity") {
    const promptSelectors = normalizeSelectorEntries([
      config?.inputSelector,
      ...Array.isArray(config?.fallbackSelectors) ? config.fallbackSelectors : []
    ]);
    const [executionResult2] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: async (injectedPrompt, injectedConfig, injectedSelectors) => {
        const sleep2 = (ms) => new Promise((resolve) => window.setTimeout(resolve, Math.max(Number(ms) || 0, 0)));
        const normalizeText4 = (value) => String(value ?? "").replace(/\u00A0/g, " ").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\r\n?/g, "\n").trim();
        const isVisible = (element2) => {
          if (!(element2 instanceof HTMLElement) && !(element2 instanceof SVGElement)) {
            return true;
          }
          const style = window.getComputedStyle(element2);
          if (element2 instanceof HTMLElement && element2.hidden || element2.getAttribute("hidden") !== null || element2.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
            return false;
          }
          return element2.getClientRects().length > 0;
        };
        const isEditable = (element2) => {
          if (element2 instanceof HTMLInputElement || element2 instanceof HTMLTextAreaElement) {
            return !element2.readOnly;
          }
          return element2 instanceof HTMLElement ? element2.isContentEditable : false;
        };
        const findPromptMatch = () => {
          for (const selector2 of Array.isArray(injectedSelectors) ? injectedSelectors : []) {
            const candidates = Array.from(document.querySelectorAll(selector2));
            const element2 = candidates.find((candidate) => isVisible(candidate) && isEditable(candidate));
            if (element2) {
              return { element: element2, selector: selector2 };
            }
          }
          return null;
        };
        const waitForPromptMatch = async (timeoutMs) => {
          const deadline = performance.now() + Math.max(Number(timeoutMs) || 0, 0);
          while (performance.now() <= deadline) {
            const match2 = findPromptMatch();
            if (match2) {
              return match2;
            }
            await sleep2(150);
          }
          return null;
        };
        const placeCaretAtEnd = (element2) => {
          if (!(element2 instanceof HTMLElement)) {
            return;
          }
          const selection = window.getSelection();
          if (!selection) {
            return;
          }
          const range = document.createRange();
          range.selectNodeContents(element2);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        };
        const selectAllEditableContents = (element2) => {
          if (!(element2 instanceof HTMLElement)) {
            return;
          }
          element2.focus();
          const selection = window.getSelection();
          if (!selection) {
            document.execCommand("selectAll", false);
            return;
          }
          const range = document.createRange();
          range.selectNodeContents(element2);
          selection.removeAllRanges();
          selection.addRange(range);
        };
        const buildParagraphNode = (text) => ({
          children: text ? [
            {
              detail: 0,
              format: 0,
              mode: "normal",
              style: "",
              text,
              type: "text",
              version: 1
            }
          ] : [],
          direction: null,
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1,
          textFormat: 0,
          textStyle: ""
        });
        const setLexicalText = (element2, nextPrompt) => {
          if (!(element2 instanceof HTMLElement)) {
            return false;
          }
          const editor = element2.__lexicalEditor;
          if (!editor || typeof editor.parseEditorState !== "function" || typeof editor.setEditorState !== "function") {
            return false;
          }
          const paragraphs = String(nextPrompt ?? "").split(/\n/g).map((line) => buildParagraphNode(line));
          const editorStateJson = {
            root: {
              children: paragraphs.length > 0 ? paragraphs : [buildParagraphNode("")],
              direction: null,
              format: "",
              indent: 0,
              type: "root",
              version: 1
            }
          };
          const nextState = editor.parseEditorState(JSON.stringify(editorStateJson));
          editor.setEditorState(nextState);
          if (typeof editor.focus === "function") {
            editor.focus();
          } else {
            element2.focus();
          }
          placeCaretAtEnd(element2);
          return normalizeText4(element2.innerText ?? element2.textContent ?? "") === normalizeText4(nextPrompt);
        };
        if ((Number(injectedConfig?.waitMs) || 0) > 0) {
          await sleep2(injectedConfig.waitMs);
        }
        const startedAt = performance.now();
        const match = await waitForPromptMatch(Math.max((Number(injectedConfig?.waitMs) || 0) + 6e3, 8e3));
        if (!match?.element) {
          return { status: "selector_timeout", attempts: [] };
        }
        const { element, selector } = match;
        let strategy = "mainWorldExecCommand";
        let injected = false;
        const attempts = [];
        if (element instanceof HTMLElement && element.dataset.lexicalEditor === "true") {
          injected = setLexicalText(element, injectedPrompt);
          strategy = "mainWorldLexical";
          attempts.push({ name: strategy, success: injected });
        }
        if (!injected && element instanceof HTMLElement) {
          element.focus();
          selectAllEditableContents(element);
          const inserted = document.execCommand("insertText", false, injectedPrompt);
          injected = Boolean(inserted) || normalizeText4(element.innerText ?? element.textContent ?? "") === normalizeText4(injectedPrompt);
          attempts.push({ name: "mainWorldExecCommand", success: injected });
        }
        if (!injected) {
          return { status: "strategy_exhausted", selector, strategy, attempts };
        }
        return {
          status: "injected",
          selector,
          strategy,
          inputType: "contenteditable",
          elapsedMs: Math.round(performance.now() - startedAt),
          attempts
        };
      },
      args: [prompt, config, promptSelectors]
    });
    const injectionResult = executionResult2?.result ?? null;
    if (!injectionResult || injectionResult.status !== "injected") {
      return injectionResult;
    }
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [INJECTOR_SCRIPT_PATH]
    });
    const [submitExecutionResult] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (injectedConfig) => {
        const submitter = globalThis.__aiPromptBroadcasterSubmitPrompt;
        if (typeof submitter !== "function") {
          throw new Error("submitPrompt entry point is not available in the tab context.");
        }
        return submitter(injectedConfig);
      },
      args: [config]
    });
    const submitResult = submitExecutionResult?.result ?? null;
    if (submitResult?.status === "submitted") {
      return {
        ...submitResult,
        selector: injectionResult.selector ?? submitResult.selector,
        strategy: injectionResult.strategy ?? submitResult.strategy,
        inputType: injectionResult.inputType ?? submitResult.inputType,
        elapsedMs: injectionResult.elapsedMs ?? submitResult.elapsedMs,
        attempts: injectionResult.attempts ?? submitResult.attempts ?? []
      };
    }
    return {
      ...submitResult ?? injectionResult,
      selector: injectionResult?.selector ?? submitResult?.selector,
      strategy: injectionResult?.strategy ?? submitResult?.strategy,
      inputType: injectionResult?.inputType ?? submitResult?.inputType,
      elapsedMs: injectionResult?.elapsedMs ?? submitResult?.elapsedMs,
      attempts: injectionResult?.attempts ?? submitResult?.attempts ?? []
    };
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [INJECTOR_SCRIPT_PATH]
  });
  const [executionResult] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (injectedPrompt, injectedConfig) => {
      const injector = globalThis.__aiPromptBroadcasterInjectPrompt;
      if (typeof injector !== "function") {
        throw new Error("injectPrompt entry point is not available in the tab context.");
      }
      return injector(injectedPrompt, injectedConfig);
    },
    args: [prompt, config]
  });
  return executionResult?.result ?? null;
}
async function handlePendingInjectionTimeout(tabId, job, reason = "timeout") {
  const siteName = job?.site?.name ?? job?.siteId ?? "AI service";
  await recordBroadcastSiteResult(job.broadcastId, job.siteId, buildSiteResult("injection_timeout"));
  await removePendingInjection(tabId);
  activeInjections.delete(tabId);
  await enqueueUiToast({
    message: getI18nMessage("toast_injection_timeout", [siteName]) || `${siteName} injection timed out.`,
    type: "warning",
    duration: 5e3,
    meta: { reason }
  });
}
async function processPendingInjectionNow(tabId, tab) {
  if (activeInjections.has(tabId)) {
    return;
  }
  const pending = await getPendingInjections();
  const job = pending[String(tabId)];
  if (!job || job.injected === true) {
    return;
  }
  const pendingBroadcasts = await getPendingBroadcasts();
  if (!pendingBroadcasts[job.broadcastId]) {
    await removePendingInjection(tabId);
    activeInjections.delete(tabId);
    return;
  }
  if (Date.now() - Number(job.createdAt || 0) > PENDING_TIMEOUT_MS) {
    await handlePendingInjectionTimeout(tabId, job);
    return;
  }
  activeInjections.add(tabId);
  await updatePendingInjection(
    tabId,
    (current) => current ? {
      ...current,
      injected: true,
      status: "injecting"
    } : null
  );
  try {
    const settings = await getAppSettings();
    const waitMsMultiplier = Number(settings?.waitMsMultiplier) || 1;
    const strategyStats = await getStrategyStats();
    const runtimeOverrides = {
      waitMsMultiplier,
      strategyOrder: buildPreferredStrategyOrder(job.siteId, strategyStats),
      submitTimeoutMs: scaleTimeout(DEFAULT_SUBMIT_BUTTON_WAIT_TIMEOUT_MS, waitMsMultiplier),
      submitRetryCount: DEFAULT_SUBMIT_RETRY_COUNT
    };
    const ready = await waitForTabInteractionReady(tabId, scaleTimeout(TAB_LOAD_READY_TIMEOUT_MS, waitMsMultiplier));
    if (!ready) {
      await handlePendingInjectionTimeout(tabId, job, "tab_not_ready");
      return;
    }
    const currentTab = await chrome.tabs.get(tabId);
    const currentUrl = currentTab?.url ?? "";
    try {
      if (Number.isFinite(currentTab?.windowId)) {
        await chrome.windows.update(currentTab.windowId, { focused: true });
      }
      await chrome.tabs.update(tabId, { active: true });
      await sleep(300);
    } catch (activateError) {
      console.warn("[AI Prompt Broadcaster] Failed to activate tab before injection.", {
        tabId,
        activateError
      });
    }
    if (!isSameSiteOrigin(currentUrl, job.site)) {
      await recordBroadcastSiteResult(job.broadcastId, job.siteId, buildSiteResult("auth_required"));
      await enqueueUiToast({
        message: getI18nMessage("toast_login_required", [job.site.name]) || `${job.site.name} requires login before sending.`,
        type: "warning",
        duration: 5e3
      });
      return;
    }
    const result = await injectIntoTab(tabId, job.prompt, job.site, {
      ...runtimeOverrides,
      waitMs: scaleTimeout(Number(job.site?.waitMs) || 0, waitMsMultiplier)
    });
    if (Array.isArray(result?.attempts) && result.attempts.length > 0) {
      await recordStrategyAttempts(job.siteId, result.attempts);
    }
    const finalCode = normalizeResultCode(result?.status);
    if (finalCode === "submitted") {
      await sleep(TAB_POST_SUBMIT_SETTLE_MS);
    }
    await recordBroadcastSiteResult(job.broadcastId, job.siteId, buildSiteResult(finalCode, {
      message: result?.error ?? "",
      strategy: result?.strategy,
      elapsedMs: result?.elapsedMs,
      attempts: result?.attempts
    }));
    if (finalCode === "auth_required") {
      await enqueueUiToast({
        message: getI18nMessage("toast_login_required", [job.site.name]) || `${job.site.name} requires login before sending.`,
        type: "warning",
        duration: 5e3
      });
    }
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to inject prompt after tab load.", {
      tabId,
      error
    });
    await recordBroadcastSiteResult(job.broadcastId, job.siteId, buildSiteResult("unexpected_error", {
      message: getErrorMessage(error)
    }));
    await enqueueUiToast({
      message: getI18nMessage("toast_injection_failed", [job.site.name]) || `${job.site.name} automatic injection failed.`,
      type: "error",
      duration: 5e3
    });
  } finally {
    await removePendingInjection(tabId);
    activeInjections.delete(tabId);
  }
}
async function reconcilePendingInjections() {
  const pending = await getPendingInjections();
  const entries = Object.entries(pending);
  for (const [tabIdKey, job] of entries) {
    const tabId = Number(tabIdKey);
    if (!Number.isFinite(tabId) || !job) {
      await removePendingInjection(tabId);
      continue;
    }
    const age = Date.now() - Number(job.createdAt || 0);
    if (age > PENDING_TIMEOUT_MS) {
      await handlePendingInjectionTimeout(tabId, job);
      continue;
    }
    if (job.injected === true) {
      continue;
    }
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab?.status === "complete") {
        await queuePendingInjection(tabId, tab);
      }
    } catch (_error) {
      await recordBroadcastSiteResult(job.broadcastId, job.siteId, "tab_closed");
      await removePendingInjection(tabId);
      activeInjections.delete(tabId);
    }
  }
}
async function ensureReconcileAlarm() {
  try {
    chrome.alarms.create(RECONCILE_ALARM, {
      periodInMinutes: KEEPALIVE_PERIOD_MINUTES
    });
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to create reconcile alarm.", error);
  }
}
async function initializeServiceWorker() {
  await ensureReconcileAlarm();
  await reconcilePendingInjections();
  await reconcilePendingBroadcasts();
  await reconcileFavoriteRunJobs();
  await reconcileFavoriteSchedules();
}
async function queueResolvedBroadcastRequest(prompt, selectedTargets, metadata = {}) {
  const selectedSites = selectedTargets.map((target) => target.site);
  let queuedSiteCount = 0;
  const broadcast = await createPendingBroadcast(prompt, selectedTargets, metadata);
  registerBroadcastCompletionWaiter(broadcast.id);
  const settings = await getAppSettings();
  const createdTabSiteIds = [];
  const reusedTabSiteIds = [];
  const failedTabSiteIds = [];
  const reusableTabsBySiteId = settings.reuseExistingTabs ? await findReusableTabsForSites(selectedSites, {
    windowId: broadcast.originWindowId,
    excludeTabId: broadcast.originTabId
  }) : /* @__PURE__ */ new Map();
  for (const target of selectedTargets) {
    const site = target.site;
    try {
      const pendingBeforeCreate = await getPendingBroadcasts();
      if (!pendingBeforeCreate[broadcast.id]) {
        continue;
      }
      if (site.isCustom && getSitePermissionPatterns(site).length > 0) {
        const granted = await isCustomSitePermissionGranted(site);
        if (!granted) {
          failedTabSiteIds.push(site.id);
          await recordBroadcastSiteResult(broadcast.id, site.id, "permission_denied");
          await enqueueUiToast({
            message: getI18nMessage("toast_service_permission_denied", [site.name]) || `${site.name} host permission was not granted.`,
            type: "error",
            duration: 5e3
          });
          continue;
        }
      }
      const explicitTab = await getExplicitReusableTabForTarget(target);
      if (explicitTab.requested && !explicitTab.tab) {
        failedTabSiteIds.push(site.id);
        await recordBroadcastSiteResult(broadcast.id, site.id, buildSiteResult("tab_closed", {
          message: explicitTab.message ?? buildSelectedTabUnavailableMessage(site.name, target.targetTabId)
        }));
        continue;
      }
      const reusableTab = explicitTab.tab ?? (!target.forceNewTab && settings.reuseExistingTabs ? reusableTabsBySiteId.get(site.id) ?? null : null);
      const targetTab = reusableTab ?? await chrome.tabs.create({
        url: site.url,
        active: false
      });
      if (!targetTab?.id) {
        throw new Error("Tab was queued without a valid id.");
      }
      const pendingAfterCreate = await getPendingBroadcasts();
      if (!pendingAfterCreate[broadcast.id]) {
        if (!reusableTab) {
          await closeTabQuietly(targetTab.id);
        }
        continue;
      }
      await addPendingInjection(targetTab.id, {
        broadcastId: broadcast.id,
        siteId: site.id,
        prompt: pickBroadcastTargetPrompt(target, prompt),
        site,
        injected: false,
        status: "pending",
        createdAt: Date.now(),
        closeOnCancel: !reusableTab
      });
      await queueBackgroundStateMutation((state) => {
        const record = state.pendingBroadcasts[broadcast.id];
        if (!record) {
          return null;
        }
        record.targetTabIdsBySiteId = {
          ...record.targetTabIdsBySiteId ?? {},
          [site.id]: targetTab.id
        };
        if (!reusableTab) {
          record.openedTabIds = Array.from(
            /* @__PURE__ */ new Set([...Array.isArray(record.openedTabIds) ? record.openedTabIds : [], targetTab.id])
          );
        }
        state.pendingBroadcasts[broadcast.id] = record;
        return clonePlainValue2(record.targetTabIdsBySiteId);
      });
      queuedSiteCount += 1;
      if (reusableTab) {
        reusedTabSiteIds.push(site.id);
      } else {
        createdTabSiteIds.push(site.id);
      }
      void queuePendingInjection(targetTab.id, targetTab);
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to create broadcast tab.", {
        site,
        error
      });
      failedTabSiteIds.push(site.id);
      await recordBroadcastSiteResult(broadcast.id, site.id, "tab_create_failed");
    }
  }
  if (queuedSiteCount > 0) {
    await queueBackgroundStateMutation(async () => {
      const currentCounter = await getBroadcastCounter();
      await setBroadcastCounter(currentCounter + 1);
      return currentCounter + 1;
    });
  }
  return {
    ok: queuedSiteCount > 0,
    createdSiteCount: queuedSiteCount,
    queuedSiteCount,
    requestedSiteCount: selectedSites.length,
    createdTabSiteIds,
    reusedTabSiteIds,
    failedTabSiteIds,
    broadcastId: broadcast.id,
    error: queuedSiteCount > 0 ? void 0 : "No tabs could be queued."
  };
}
async function queueBroadcastRequest(prompt, siteRefs, metadata = {}) {
  await reconcilePendingBroadcasts();
  const normalizedPrompt = normalizePrompt2(prompt).trim();
  const selectedTargets = await resolveSelectedTargets(siteRefs);
  const selectedSites = selectedTargets.map((target) => target.site);
  if (!normalizedPrompt) {
    throw new Error("Prompt is required.");
  }
  if (selectedSites.length === 0) {
    throw new Error("At least one target site is required.");
  }
  return queueResolvedBroadcastRequest(normalizedPrompt, selectedTargets, metadata);
}
async function handleBroadcastMessage(message) {
  return queueBroadcastRequest(message?.prompt, message?.sites, {
    trigger: "popup"
  });
}
async function handleServiceHealthGet() {
  const [sites, history, failedSelectors, strategyStats] = await Promise.all([
    getRuntimeSites(),
    getStoredPromptHistory(),
    getFailedSelectors(),
    getStrategyStats()
  ]);
  const failedSelectorBySite = new Map(
    failedSelectors.map((entry) => [entry.serviceId, entry])
  );
  const snapshots = sites.map((site) => {
    let lastSuccessAt = null;
    let lastFailureAt = null;
    let lastFailureCode = null;
    let successCount = 0;
    let failureCount = 0;
    for (const item of history) {
      const result = item.siteResults?.[site.id];
      if (!result && !item.requestedSiteIds?.includes(site.id)) {
        continue;
      }
      if (result?.code === "submitted" || item.submittedSiteIds?.includes(site.id)) {
        successCount += 1;
        if (!lastSuccessAt) {
          lastSuccessAt = item.createdAt;
        }
        continue;
      }
      failureCount += 1;
      if (!lastFailureAt) {
        lastFailureAt = item.createdAt;
        lastFailureCode = result?.code ?? "unexpected_error";
      }
    }
    const siteStrategyStats = strategyStats[site.id] ?? {};
    const preferredStrategy = Object.entries(siteStrategyStats).sort(
      ([, left], [, right]) => right.success - right.fail - (left.success - left.fail)
    )[0]?.[0] ?? null;
    return {
      serviceId: site.id,
      serviceName: site.name,
      enabled: site.enabled,
      lastSuccessAt,
      lastFailureAt,
      lastFailureCode,
      selectorWarning: failedSelectorBySite.get(site.id) ?? null,
      preferredStrategy,
      successCount,
      failureCount,
      verification: {
        lastVerified: site.lastVerified,
        verifiedAt: site.verifiedAt,
        verifiedRoute: site.verifiedRoute,
        verifiedAuthState: site.verifiedAuthState,
        verifiedLocale: site.verifiedLocale,
        verifiedVersion: site.verifiedVersion
      }
    };
  });
  return {
    ok: true,
    snapshots
  };
}
async function handleComparisonNoteList(message) {
  const historyId = Number(message?.historyId);
  const notes = await getComparisonNotes();
  return {
    ok: true,
    notes: Number.isFinite(historyId) ? notes.filter((entry) => Number(entry.historyId) === historyId) : notes
  };
}
async function handleComparisonNoteSave(message) {
  const note = await saveComparisonNote(message?.note ?? {});
  return {
    ok: true,
    note
  };
}
async function handleComparisonNoteDelete(message) {
  const notes = await deleteComparisonNote(message?.noteId ?? "");
  return {
    ok: true,
    notes
  };
}
async function resolveContextMenuComparisonTarget(siteId) {
  const [history, activeContext] = await Promise.all([
    getStoredPromptHistory(),
    getActiveComparisonContext()
  ]);
  if (activeContext?.serviceId !== siteId) {
    return null;
  }
  const activeHistory = history.find((entry) => Number(entry.id) === activeContext.historyId);
  if (activeHistory?.requestedSiteIds?.includes(siteId)) {
    return {
      historyId: activeHistory.id
    };
  }
  return null;
}
async function handleContextMenuComparisonNote(selectedText, tab) {
  const responseText = (selectedText || (tab?.id ? selectionCache.get(tab.id) : "") || "").trim();
  if (!responseText) {
    return;
  }
  const [history, site] = await Promise.all([
    getStoredPromptHistory(),
    getSiteForUrl(tab?.url ?? "")
  ]);
  if (history.length === 0 || !site?.id) {
    await enqueueUiToast({
      message: "Open a supported service tab and keep at least one history item before saving a comparison note.",
      type: "warning",
      duration: 5e3
    });
    return;
  }
  const target = await resolveContextMenuComparisonTarget(site.id);
  if (!target) {
    await enqueueUiToast({
      message: `${site.name} is not the active comparison target. Open the matching history item first.`,
      type: "warning",
      duration: 5e3
    });
    return;
  }
  await saveComparisonNote({
    historyId: target.historyId,
    serviceId: site.id,
    responseText,
    captureMode: "selection",
    tags: ["selection"]
  });
  await enqueueUiToast({
    message: `${site.name} response saved to the active comparison note.`,
    type: "success",
    duration: 3500
  });
}
async function findComparisonCaptureTab(serviceId, explicitTabId) {
  if (Number.isFinite(Number(explicitTabId))) {
    try {
      return await chrome.tabs.get(Number(explicitTabId));
    } catch (_error) {
      return null;
    }
  }
  const activeTabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  }).catch(() => []);
  for (const tab of activeTabs) {
    const site = await getSiteForUrl(tab.url ?? "");
    if (site?.id === serviceId) {
      return tab;
    }
  }
  const allTabs = await chrome.tabs.query({}).catch(() => []);
  for (const tab of allTabs) {
    const site = await getSiteForUrl(tab.url ?? "");
    if (site?.id === serviceId) {
      return tab;
    }
  }
  return null;
}
function normalizeCapturedResponseText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
function isPromptEcho(responseText, promptText) {
  const response = normalizeCapturedResponseText(responseText).toLowerCase();
  const prompt = normalizeCapturedResponseText(promptText).toLowerCase();
  return Boolean(prompt) && (response === prompt || response.startsWith(prompt));
}
function shouldUpdateAutoCapturedResponse(existingText, nextText) {
  const existing = normalizeCapturedResponseText(existingText);
  const next = normalizeCapturedResponseText(nextText);
  if (!next || existing === next || existing.includes(next)) {
    return false;
  }
  if (!existing || next.includes(existing)) {
    return true;
  }
  return Math.abs(next.length - existing.length) >= AUTO_RESPONSE_CAPTURE_MEANINGFUL_DELTA;
}
async function captureVisibleAssistantResponse(tabId, serviceId, promptText = "") {
  const selectors = COMPARISON_CAPTURE_SELECTORS[serviceId] ?? [];
  if (selectors.length === 0) {
    return "";
  }
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    args: [selectors],
    func: (assistantSelectors) => {
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
      };
      const isAssistantCandidate = (element) => {
        const role = element.getAttribute("role") || "";
        const editable = element.getAttribute("contenteditable") || "";
        return role.toLowerCase() !== "textbox" && editable.toLowerCase() !== "true";
      };
      const getText = (element) => (element.textContent || "").replace(/\s+/g, " ").trim();
      const seen = /* @__PURE__ */ new Set();
      const candidates = assistantSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector))).filter((element) => {
        if (seen.has(element)) {
          return false;
        }
        seen.add(element);
        return true;
      }).filter(isVisible).filter(isAssistantCandidate).map((element) => ({
        text: getText(element),
        top: element.getBoundingClientRect().top
      })).filter((entry) => entry.text.length >= 20).sort((left, right) => right.top - left.top);
      return candidates[0]?.text ?? "";
    }
  });
  const responseText = typeof result?.result === "string" ? result.result : "";
  if (normalizeCapturedResponseText(responseText).length < AUTO_RESPONSE_CAPTURE_MIN_LENGTH || isPromptEcho(responseText, promptText)) {
    return "";
  }
  return responseText;
}
async function captureAssistantResponseWithRetry(tabId, serviceId, promptText) {
  const deadline = Date.now() + AUTO_RESPONSE_CAPTURE_TIMEOUT_MS;
  let lastResponse = "";
  while (Date.now() <= deadline) {
    const responseText = await captureVisibleAssistantResponse(tabId, serviceId, promptText).catch(() => "");
    if (responseText) {
      if (lastResponse && normalizeCapturedResponseText(lastResponse) === normalizeCapturedResponseText(responseText)) {
        return responseText;
      }
      lastResponse = responseText;
    }
    await sleep(AUTO_RESPONSE_CAPTURE_INTERVAL_MS);
  }
  return lastResponse;
}
async function saveAutoCapturedResponse(historyId, serviceId, responseText) {
  const existingNotes = await getComparisonNotes();
  const existingAutoNote = existingNotes.find(
    (note) => Number(note.historyId) === Number(historyId) && note.serviceId === serviceId && note.captureMode === "auto"
  );
  if (existingAutoNote && !shouldUpdateAutoCapturedResponse(existingAutoNote.responseText, responseText)) {
    return;
  }
  await saveComparisonNote({
    id: existingAutoNote?.id,
    historyId,
    serviceId,
    responseText,
    captureMode: "auto",
    tags: ["auto"]
  });
}
async function autoCaptureBroadcastResponses(historyItem, completedRecord) {
  const settings = await getAppSettings();
  if (!settings.autoCaptureResponses) {
    return;
  }
  const submittedSiteIds = Array.isArray(completedRecord.submittedSiteIds) ? completedRecord.submittedSiteIds : [];
  for (const serviceId of submittedSiteIds) {
    const tabId = Number(completedRecord.targetTabIdsBySiteId?.[serviceId]);
    const tab = await findComparisonCaptureTab(serviceId, Number.isFinite(tabId) ? tabId : null);
    if (!tab?.id) {
      continue;
    }
    const responseText = await captureAssistantResponseWithRetry(tab.id, serviceId, historyItem.text);
    if (!responseText.trim()) {
      continue;
    }
    await saveAutoCapturedResponse(Number(historyItem.id), serviceId, responseText);
  }
}
async function handleComparisonCaptureStart(message) {
  const historyId = Math.max(0, Math.round(Number(message?.historyId)));
  const serviceId = typeof message?.serviceId === "string" ? message.serviceId.trim() : "";
  if (!historyId || !serviceId) {
    return {
      ok: false,
      captured: false,
      error: "historyId and serviceId are required."
    };
  }
  const tab = await findComparisonCaptureTab(serviceId, message?.tabId ?? null);
  if (!tab?.id) {
    return {
      ok: true,
      captured: false,
      message: "Open the service tab and run capture again when the response is visible."
    };
  }
  const history = await getStoredPromptHistory();
  const historyItem = history.find((entry) => Number(entry.id) === historyId);
  const responseText = await captureVisibleAssistantResponse(tab.id, serviceId, historyItem?.text ?? "").catch(() => "");
  if (!responseText.trim()) {
    return {
      ok: true,
      captured: false,
      message: "No visible assistant response was found. Use manual paste or select response text from the service tab."
    };
  }
  await saveAutoCapturedResponse(historyId, serviceId, responseText);
  const notes = await getComparisonNotes();
  const note = notes.find(
    (entry) => Number(entry.historyId) === Number(historyId) && entry.serviceId === serviceId && entry.captureMode === "auto"
  ) ?? null;
  return {
    ok: true,
    note: note ?? void 0,
    captured: true
  };
}
function buildExperimentRunId() {
  return typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `experiment-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
async function handleExperimentSave(message) {
  const experiment = await savePromptExperiment(message?.experiment ?? {});
  return {
    ok: true,
    experiment
  };
}
async function handleExperimentDelete(message) {
  const experiments = await deletePromptExperiment(message?.experimentId ?? "");
  return {
    ok: true,
    experiments
  };
}
async function handleExperimentRun(message) {
  const experiments = await getPromptExperiments();
  const experiment = experiments.find((entry) => entry.id === message?.experimentId);
  if (!experiment) {
    return {
      ok: false,
      experiment: null,
      queuedCount: 0,
      broadcastIds: [],
      preview: [],
      error: "Experiment not found."
    };
  }
  const targetSiteIds = normalizeSiteIdList(experiment.targetSiteIds);
  const variants = experiment.variants.filter((variant) => variant.text.trim());
  const variableSets = experiment.variableSets.length > 0 ? experiment.variableSets : [{ id: "default", title: "Default", values: {} }];
  const preview = variants.flatMap(
    (variant) => variableSets.map((variableSet) => ({
      variantId: variant.id,
      variableSetId: variableSet.id,
      targetSiteIds,
      prompt: renderTemplatePrompt(variant.text, variableSet.values ?? {})
    }))
  );
  if (targetSiteIds.length === 0 || preview.length === 0) {
    return {
      ok: false,
      experiment,
      queuedCount: 0,
      broadcastIds: [],
      preview,
      error: "Experiment requires at least one variant and one target service."
    };
  }
  const limitResult = evaluatePromptExperimentRunLimit(
    {
      variants,
      variableSets,
      targetSiteIds
    },
    message?.confirmedLargeRun === true
  );
  if (limitResult.reason === "hard_limit") {
    return {
      ok: false,
      experiment,
      queuedCount: 0,
      broadcastIds: [],
      preview,
      error: `Experiment has ${limitResult.broadcastCount} broadcasts. Split it into batches of ${EXPERIMENT_HARD_BROADCAST_LIMIT} or fewer.`
    };
  }
  if (limitResult.reason === "confirmation_required") {
    return {
      ok: false,
      experiment,
      queuedCount: 0,
      broadcastIds: [],
      preview,
      error: `Experiment has ${limitResult.broadcastCount} broadcasts. Confirm the large run before queuing more than ${EXPERIMENT_SOFT_BROADCAST_LIMIT}.`
    };
  }
  const runId = buildExperimentRunId();
  const broadcastIds = [];
  for (const item of preview) {
    const response = await queueBroadcastRequest(
      item.prompt,
      item.targetSiteIds.map((siteId) => ({ id: siteId })),
      {
        trigger: "options",
        experimentRunId: runId
      }
    );
    if (response?.broadcastId) {
      broadcastIds.push(response.broadcastId);
    }
  }
  const updatedExperiment = await appendPromptExperimentRun(experiment.id, {
    id: runId,
    variantId: preview.length === 1 ? preview[0].variantId : "mixed",
    variableSetId: preview.length === 1 ? preview[0].variableSetId : "mixed",
    targetSiteIds,
    broadcastIds,
    createdAt: nowIso()
  });
  return {
    ok: broadcastIds.length > 0,
    experiment: updatedExperiment ?? experiment,
    runId,
    queuedCount: broadcastIds.length,
    broadcastIds,
    preview,
    error: broadcastIds.length > 0 ? void 0 : "No experiment broadcasts were queued."
  };
}
function stripFavoriteSensitiveDefaults(favorite, includeSensitiveDefaults) {
  if (includeSensitiveDefaults) {
    return favorite;
  }
  return {
    ...favorite,
    templateDefaults: {},
    steps: favorite.steps.map((step) => ({
      ...step,
      templateDefaults: {}
    }))
  };
}
async function handleTemplatePackExport(message) {
  const favorites = await getPromptFavorites();
  const selectedIds = normalizeSiteIdList(message?.favoriteIds);
  const includeSensitiveDefaults = message?.includeSensitiveDefaults !== false;
  const selectedFavorites = (selectedIds.length > 0 ? favorites.filter((favorite) => selectedIds.includes(favorite.id)) : favorites).map((favorite) => stripFavoriteSensitiveDefaults(favorite, includeSensitiveDefaults));
  const pack = await saveTemplatePack({
    title: message?.title || `Template Pack ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`,
    description: "",
    favoriteIds: selectedFavorites.map((favorite) => favorite.id),
    templates: selectedFavorites,
    includeSensitiveDefaults
  });
  return {
    ok: true,
    pack
  };
}
async function handleTemplatePackImport(message) {
  const pack = await saveTemplatePack(message?.pack ?? {});
  const currentFavorites = await getPromptFavorites();
  const importedFavoriteIds = [];
  const skippedFavoriteIds = [];
  const nextFavorites = [...currentFavorites];
  for (const template of pack.templates) {
    const normalizedTemplate = buildFavoriteEntry(template);
    const exactDuplicate = nextFavorites.find(
      (favorite) => favorite.title === normalizedTemplate.title && favorite.text === normalizedTemplate.text
    );
    if (exactDuplicate) {
      skippedFavoriteIds.push(normalizedTemplate.id);
      continue;
    }
    const importedFavorite = {
      ...normalizedTemplate,
      id: ensureUniqueStringId(nextFavorites, normalizedTemplate.id),
      favoritedAt: nowIso(),
      createdAt: normalizedTemplate.createdAt || nowIso(),
      usageCount: 0,
      lastUsedAt: null
    };
    nextFavorites.unshift(importedFavorite);
    importedFavoriteIds.push(importedFavorite.id);
  }
  if (importedFavoriteIds.length > 0) {
    await setPromptFavorites(nextFavorites);
  }
  return {
    ok: true,
    pack,
    importedFavoriteIds,
    skippedFavoriteIds
  };
}
async function handleServiceGroupsUpdate(message) {
  const groups = await setServiceGroups(message?.groups ?? []);
  return {
    ok: true,
    groups
  };
}
async function handleSelectorCheckInit(message) {
  const site = await getSiteForUrl(message?.url ?? "");
  if (!site) {
    return { ok: true, site: null };
  }
  return {
    ok: true,
    site: buildInjectionConfig(site)
  };
}
async function handleSelectorCheckReport(message) {
  if ((message?.status === "ok" || message?.status === "auth_page" || message?.status === "skipped") && message?.siteId) {
    await clearPendingSelectorChecksForSiteId(message.siteId);
    await clearFailedSelector(message.siteId);
    return { ok: true };
  }
  if (message?.status !== "selector_missing") {
    return { ok: true };
  }
  const missing = Array.isArray(message?.missing) ? message.missing : [];
  if (missing.length === 0) {
    return { ok: true };
  }
  const report = {
    siteId: message.siteId ?? "unknown",
    siteName: message.siteName ?? "AI service",
    pageUrl: message.pageUrl ?? "",
    missing
  };
  const pendingResult = await registerPendingSelectorCheckReport(report);
  if (!pendingResult?.promoted) {
    return { ok: true };
  }
  await maybeCreateSelectorNotification(report);
  await markFailedSelector(
    message.siteId ?? "unknown",
    missing[0]?.selector ?? "",
    "selector-checker"
  );
  return { ok: true };
}
async function handleSelectorFailedMessage(message) {
  const payload = message ?? {};
  const serviceId = payload.serviceId ?? "";
  const selector = payload.selector ?? "";
  const site = await getSiteById(serviceId);
  await clearPendingSelectorChecksForSiteId(serviceId);
  await maybeCreateSelectorNotification({
    siteId: serviceId || "unknown",
    siteName: site?.name || serviceId || "AI service",
    pageUrl: "",
    missing: [
      {
        field: "inputSelector",
        selector
      }
    ]
  });
  await markFailedSelector(serviceId, selector, "injector");
  await enqueueUiToast({
    message: getI18nMessage("toast_selector_failed", [site?.name ?? serviceId]) || `${site?.name ?? serviceId} selector was not found.`,
    type: "error",
    duration: -1
  });
  return { ok: true };
}
async function handleInjectSuccessMessage(message) {
  const payload = message ?? {};
  if (payload.serviceId) {
    await clearPendingSelectorChecksForSiteId(payload.serviceId);
    await clearFailedSelector(payload.serviceId);
  }
  return { ok: true };
}
async function handleInjectFallbackMessage(message) {
  const payload = message ?? {};
  const serviceId = payload.serviceId ?? "";
  const site = await getSiteById(serviceId);
  const copied = Boolean(payload.copied);
  await enqueueUiToast({
    message: copied ? getI18nMessage("toast_inject_fallback_copied", [site?.name ?? serviceId]) || `${site?.name ?? serviceId} prompt copied to clipboard. Paste it manually and send.` : getI18nMessage("toast_inject_fallback_manual", [site?.name ?? serviceId]) || `${site?.name ?? serviceId} automatic injection failed. Paste the prompt manually and send.`,
    type: "warning",
    duration: 5e3
  });
  return { ok: true };
}
async function handleUiToastMessage(message) {
  const payload = message ?? {};
  await enqueueUiToast(payload.toast ?? {});
  return { ok: true };
}
async function handlePopupOpened() {
  await reconcilePendingBroadcasts();
  const lastBroadcast = await getLastBroadcast();
  if (!lastBroadcast || lastBroadcast.status !== "sending") {
    await clearBadge();
  }
  return {
    ok: true,
    lastBroadcast
  };
}
async function handleGetOpenAiTabsMessage(message) {
  const windowId = await getPreferredNormalWindowId(message?.windowId ?? null);
  const tabs = await getOpenAiTabsForWindow(windowId);
  return {
    ok: true,
    windowId,
    tabs
  };
}
async function handleCancelBroadcastMessage(message) {
  const summary = await cancelBroadcast(message?.broadcastId ?? "", "cancelled");
  return {
    ok: Boolean(summary),
    summary
  };
}
async function resetAllExtensionData() {
  await reconcilePendingBroadcasts();
  const pendingBroadcasts = await getPendingBroadcasts();
  for (const broadcastId of Object.keys(pendingBroadcasts)) {
    suppressedCompletedBroadcastIds.add(broadcastId);
    await cancelBroadcast(broadcastId, "reset");
  }
  const remainingInjections = await getPendingInjections();
  await Promise.all(
    Object.entries(remainingInjections).map(async ([tabIdKey, job]) => {
      if (job?.closeOnCancel === false) {
        return;
      }
      await closeTabQuietly(Number(tabIdKey));
    })
  );
  activeInjections.clear();
  queuedInjectionTabIds.clear();
  selectionCache.clear();
  resetRememberedState();
  const alarms = await chrome.alarms.getAll().catch(() => []);
  await Promise.all(
    alarms.filter((alarm) => alarm.name.startsWith("apb-favorite-job:")).map((alarm) => chrome.alarms.clear(alarm.name).catch(() => false))
  );
  await queueBackgroundStateMutation((state) => {
    state.pendingInjections = {};
    state.pendingBroadcasts = {};
    state.pendingSelectorChecks = {};
    state.selectorAlerts = {};
    return true;
  });
  await resetPersistedExtensionState({
    additionalSessionKeys: [
      PENDING_INJECTIONS_KEY,
      PENDING_BROADCASTS_KEY,
      PENDING_SELECTOR_CHECKS_KEY,
      SELECTOR_ALERTS_KEY
    ],
    clearAlarmName: BADGE_CLEAR_ALARM
  });
  await clearBadge();
  return { ok: true };
}
async function handleGetActiveTabContext() {
  try {
    const activeTab = await getPreferredNormalActiveTab();
    const url = typeof activeTab?.url === "string" ? activeTab.url : "";
    const title = typeof activeTab?.title === "string" ? activeTab.title : "";
    if (!isInjectableTabUrl(url)) {
      return { ok: true, url: "", title: "", selection: "" };
    }
    let selection = "";
    if (activeTab?.id) {
      selection = await getSelectedTextFromTab(activeTab.id).catch(() => "");
    }
    return { ok: true, url, title, selection };
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to read active tab context.", error);
    return { ok: false, url: "", title: "", selection: "" };
  }
}
async function handleServiceTestRun(message) {
  const draft = message?.draft ?? {};
  const selectorErrors = [];
  if (!String(draft?.inputSelector ?? "").trim()) {
    selectorErrors.push("Input selector is required.");
  }
  if (!["textarea", "contenteditable", "input"].includes(String(draft?.inputType ?? ""))) {
    selectorErrors.push("Input type is invalid.");
  }
  if (!["click", "enter", "shift+enter"].includes(String(draft?.submitMethod ?? ""))) {
    selectorErrors.push("Submit method is invalid.");
  }
  if (String(draft?.submitMethod ?? "") === "click" && !String(draft?.submitSelector ?? "").trim()) {
    selectorErrors.push("Submit selector is required when using click submit.");
  }
  if (selectorErrors.length > 0) {
    return {
      ok: false,
      reason: "validation_failed",
      error: selectorErrors.join(" ")
    };
  }
  const preferredTab = await getPreferredInjectableNormalTab();
  if (!preferredTab?.ok) {
    return {
      ok: false,
      reason: preferredTab?.reason ?? "no_tab"
    };
  }
  try {
    const tabId = preferredTab.tab.id;
    if (typeof tabId !== "number") {
      return {
        ok: false,
        reason: "no_tab"
      };
    }
    const result = await runServiceTestOnTab(tabId, draft);
    if (!result.ok) {
      return result;
    }
    return {
      ...result,
      tabId,
      tabUrl: preferredTab.tab.url ?? ""
    };
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Service test failed.", error);
    return {
      ok: false,
      reason: "error",
      error: getErrorMessage(error)
    };
  }
}
registerRuntimeMessageRouter(buildRuntimeHandlers({
  handleBroadcastMessage,
  handleSelectorCheckInit,
  handleSelectorCheckReport,
  handleServiceTestRun,
  handleSelectorFailedMessage,
  handleInjectSuccessMessage,
  handleInjectFallbackMessage,
  handleUiToastMessage,
  handlePopupOpened,
  handleGetOpenAiTabsMessage,
  handleCancelBroadcastMessage,
  handleFavoriteRunMessage,
  handleFavoriteOpenEditorMessage,
  resetAllExtensionData,
  handleGetActiveTabContext,
  handleGetBroadcastCounter: async () => ({
    ok: true,
    counter: await getBroadcastCounter()
  }),
  handleSelectionUpdateMessage,
  handleQuickPaletteGetState: async () => {
    const state = await handleQuickPaletteGetState();
    return {
      ok: state.ok,
      favorites: state.favorites.map((favorite) => ({
        ...favorite,
        mode: favorite.mode === "chain" ? "chain" : "single"
      }))
    };
  },
  handleQuickPaletteExecuteMessage,
  handleServiceHealthGet,
  handleComparisonNoteList,
  handleComparisonNoteSave,
  handleComparisonNoteDelete,
  handleComparisonCaptureStart,
  handleExperimentSave,
  handleExperimentDelete,
  handleExperimentRun,
  handleTemplatePackExport,
  handleTemplatePackImport,
  handleServiceGroupsUpdate
}));
registerBackgroundChromeEvents({
  createContextMenus,
  initializeServiceWorker,
  markOnboardingPending: () => setOnboardingCompleted(false),
  openOnboardingPage,
  handleCaptureSelectedTextCommand,
  handleQuickPaletteCommand,
  getContextMenuTargetSiteIds,
  handleContextMenuBroadcast,
  handleContextMenuComparisonNote,
  selectionCache,
  maybeInjectDynamicSelectorChecker,
  queuePendingInjection,
  rememberNormalTab,
  clearRememberedTab,
  getPendingInjections,
  recordBroadcastSiteResult,
  removePendingInjection,
  activeInjections,
  clearBadge,
  reconcilePendingInjections,
  handleFavoriteRunJobAlarm,
  parseScheduleAlarmFavoriteId: parseScheduleAlarmFavoriteId2,
  handleFavoriteScheduleAlarm,
  openPopupWithPrompt,
  reconcileFavoriteSchedules
});
