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
function getTemplateVariableDisplayName(name, locale = "en") {
  const canonicalName = canonicalizeTemplateVariableName(name);
  if (!SYSTEM_TEMPLATE_KEYS.has(canonicalName)) {
    return normalizeTemplateVariableName(name);
  }
  const normalizedLocale = normalizeLocale(locale);
  return SYSTEM_TEMPLATE_DEFINITIONS[canonicalName].labels[normalizedLocale];
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
function getUserTemplateVariables(template) {
  return detectTemplateVariables(template).filter((variable) => variable.kind === "user");
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
function findMissingTemplateValues(template, values = {}) {
  const normalizedValues = normalizeTemplateValueRecord(values);
  return getUserTemplateVariables(template).map((variable) => variable.name).filter((name) => !String(normalizedValues[name] ?? "").trim());
}

// src/shared/broadcast/resolution.ts
function detectTemplateVariablesForTargets(targets = []) {
  const seen = /* @__PURE__ */ new Set();
  const variables = [];
  targets.forEach((target) => {
    detectTemplateVariables(target?.promptTemplate ?? "").forEach((variable) => {
      if (seen.has(variable.name)) {
        return;
      }
      seen.add(variable.name);
      variables.push(variable);
    });
  });
  return variables;
}
function findMissingTemplateValuesForTargets(targets = [], userValues = {}) {
  return Array.from(
    new Set(
      targets.flatMap(
        (target) => findMissingTemplateValues(target?.promptTemplate ?? "", userValues)
      )
    )
  );
}
function resolveBroadcastTargets(targets = [], values = {}) {
  return targets.map((target) => ({
    ...target,
    resolvedPrompt: renderTemplatePrompt(target?.promptTemplate ?? "", values)
  }));
}

// src/shared/prompts/constants.ts
var LOCAL_STORAGE_KEYS = Object.freeze({
  history: "promptHistory",
  favorites: "promptFavorites",
  templateVariableCache: "templateVariableCache",
  settings: "appSettings",
  broadcastCounter: "broadcastCounter"
});
var DEFAULT_HISTORY_LIMIT = 50;
var MIN_HISTORY_LIMIT = 10;
var MAX_HISTORY_LIMIT = 200;
var MIN_WAIT_MS_MULTIPLIER = 0.5;
var MAX_WAIT_MS_MULTIPLIER = 3;
var DEFAULT_WAIT_MS_MULTIPLIER = 1;
var DEFAULT_HISTORY_SORT = "latest";
var DEFAULT_FAVORITE_SORT = "recentUsed";
var DEFAULT_SETTINGS = Object.freeze({
  historyLimit: DEFAULT_HISTORY_LIMIT,
  autoClosePopup: false,
  desktopNotifications: true,
  reuseExistingTabs: true,
  waitMsMultiplier: DEFAULT_WAIT_MS_MULTIPLIER,
  historySort: DEFAULT_HISTORY_SORT,
  favoriteSort: DEFAULT_FAVORITE_SORT
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
    waitMsMultiplier: normalizeWaitMsMultiplier(settings.waitMsMultiplier),
    historySort: normalizeHistorySort(settings.historySort),
    favoriteSort: normalizeFavoriteSort(settings.favoriteSort)
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
function getTargetSnapshotSiteIds(entry) {
  const snapshots = ensureBroadcastTargetSnapshots(
    entry?.targetSnapshots,
    entry?.requestedSiteIds ?? entry?.sentTo,
    entry?.text
  );
  return snapshots.map((snapshot) => snapshot.siteId);
}
function buildBroadcastTargetMessageFromSnapshot(snapshot, openTabs = []) {
  const siteId = safeText(snapshot.siteId).trim();
  const payload = {
    id: siteId,
    resolvedPrompt: safeText(snapshot.resolvedPrompt)
  };
  if (snapshot.targetMode === "new") {
    payload.reuseExistingTab = false;
    payload.target = "new";
    return payload;
  }
  if (snapshot.targetMode === "tab" && snapshot.targetTabId) {
    const matchingTab = openTabs.find(
      (tab) => tab.siteId === siteId && Number(tab.tabId) === Number(snapshot.targetTabId)
    );
    if (matchingTab?.tabId) {
      payload.tabId = matchingTab.tabId;
    }
  }
  return payload;
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
  const text = safeText(entry?.text);
  const sentTo = normalizeSentTo(entry?.sentTo);
  const createdAt = normalizeIsoDate(entry?.createdAt);
  const favoritedAt = normalizeIsoDate(entry?.favoritedAt, createdAt);
  const usageCount = Math.max(0, Math.round(Number(entry?.usageCount) || 0));
  const mode = normalizeFavoriteMode(entry?.mode);
  const steps = mode === "chain" ? normalizeChainSteps(entry?.steps, {
    text,
    delayMs: 0,
    targetSiteIds: sentTo
  }) : [];
  return {
    id: typeof entry?.id === "string" && entry.id.trim() ? entry.id.trim() : `fav-${Date.now()}`,
    sourceHistoryId: entry?.sourceHistoryId === null || entry?.sourceHistoryId === void 0 ? null : Number(entry.sourceHistoryId),
    title: safeText(entry?.title),
    text,
    sentTo,
    createdAt,
    favoritedAt,
    templateDefaults: normalizeTemplateDefaults(entry?.templateDefaults),
    tags: normalizeTags(entry?.tags),
    folder: safeText(entry?.folder).slice(0, 50),
    pinned: normalizeBoolean(entry?.pinned, false),
    usageCount,
    lastUsedAt: normalizeNullableIsoDate(entry?.lastUsedAt),
    mode,
    steps,
    scheduleEnabled: normalizeBoolean(entry?.scheduleEnabled, false),
    scheduledAt: normalizeNullableIsoDate(entry?.scheduledAt),
    scheduleRepeat: normalizeScheduleRepeat(entry?.scheduleRepeat)
  };
}
async function getPromptFavorites() {
  const rawFavorites = await readLocal(LOCAL_STORAGE_KEYS.favorites, []);
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
async function updateFavoriteMeta(favoriteId, { tags, folder, pinned } = {}) {
  const favorites = await getPromptFavorites();
  const nextFavorites = favorites.map((item) => {
    if (String(item.id) !== String(favoriteId)) return item;
    return {
      ...item,
      tags: Array.isArray(tags) ? normalizeTags(tags) : item.tags,
      folder: typeof folder === "string" ? safeText(folder).slice(0, 50) : item.folder,
      pinned: typeof pinned === "boolean" ? pinned : item.pinned
    };
  });
  await setPromptFavorites(nextFavorites);
  return nextFavorites.find((item) => String(item.id) === String(favoriteId)) ?? null;
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
async function duplicateFavoriteItem(favoriteId, titlePrefix = "[Copy]") {
  const favorites = await getPromptFavorites();
  const source = favorites.find((item) => String(item.id) === String(favoriteId));
  if (!source) {
    return null;
  }
  const duplicated = buildFavoriteEntry({
    ...source,
    id: ensureUniqueStringId(favorites, `${source.id}-copy`),
    title: source.title ? `${safeText(titlePrefix).trim() || "[Copy]"} ${source.title}`.trim() : safeText(titlePrefix).trim() || "[Copy]",
    favoritedAt: (/* @__PURE__ */ new Date()).toISOString(),
    usageCount: 0,
    lastUsedAt: null,
    scheduleEnabled: false,
    scheduledAt: null
  });
  await setPromptFavorites([duplicated, ...favorites]);
  return duplicated;
}
async function addFavoriteFromHistory(historyItem) {
  const favorites = await getPromptFavorites();
  const sourceHistoryId = Number(historyItem?.id);
  const existing = favorites.find(
    (item) => Number(item.sourceHistoryId) === sourceHistoryId
  );
  if (existing) {
    return existing;
  }
  const createdAt = normalizeIsoDate(historyItem?.createdAt);
  const favorite = buildFavoriteEntry({
    id: ensureUniqueStringId(favorites, `fav-${sourceHistoryId || Date.now()}`),
    sourceHistoryId: Number.isFinite(sourceHistoryId) ? sourceHistoryId : null,
    title: "",
    text: historyItem?.text,
    sentTo: Array.isArray(historyItem?.requestedSiteIds) && historyItem.requestedSiteIds.length > 0 ? historyItem.requestedSiteIds : historyItem?.sentTo,
    createdAt,
    favoritedAt: (/* @__PURE__ */ new Date()).toISOString(),
    templateDefaults: {}
  });
  await setPromptFavorites([favorite, ...favorites]);
  return favorite;
}
async function createFavoritePrompt(entry) {
  const favorites = await getPromptFavorites();
  const favorite = buildFavoriteEntry({
    id: ensureUniqueStringId(favorites, entry?.id),
    sourceHistoryId: null,
    title: safeText(entry?.title),
    text: entry?.text,
    sentTo: entry?.sentTo,
    createdAt: entry?.createdAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    favoritedAt: (/* @__PURE__ */ new Date()).toISOString(),
    templateDefaults: entry?.templateDefaults,
    usageCount: entry?.usageCount,
    lastUsedAt: entry?.lastUsedAt,
    mode: entry?.mode,
    steps: entry?.steps,
    scheduleEnabled: entry?.scheduleEnabled,
    scheduledAt: entry?.scheduledAt,
    scheduleRepeat: entry?.scheduleRepeat
  });
  await setPromptFavorites([favorite, ...favorites]);
  return favorite;
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
async function updateFavoriteTitle(favoriteId, title) {
  const favorites = await getPromptFavorites();
  const nextFavorites = favorites.map(
    (item) => String(item.id) === String(favoriteId) ? { ...item, title: safeText(title) } : item
  );
  await setPromptFavorites(nextFavorites);
  return nextFavorites.find((item) => String(item.id) === String(favoriteId)) ?? null;
}
async function deleteFavoriteItem(favoriteId) {
  const favorites = await getPromptFavorites();
  const nextFavorites = favorites.filter(
    (item) => String(item.id) !== String(favoriteId)
  );
  await setPromptFavorites(nextFavorites);
  return nextFavorites;
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
async function updateAppSettings(partialSettings) {
  const current = await getAppSettings();
  return setAppSettings({
    ...current,
    ...partialSettings ?? {}
  });
}
async function getHistoryLimit() {
  const settings = await getAppSettings();
  return settings.historyLimit;
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
    trigger: normalizeExecutionTrigger(source.trigger)
  };
}
async function getStoredPromptHistory() {
  const rawHistory = await readLocal(LOCAL_STORAGE_KEYS.history, []);
  return sortByDateDesc(
    safeArray(rawHistory).map((item) => buildHistoryEntry(item))
  );
}
function applyHistoryVisibleLimit(historyItems, historyLimit) {
  const normalizedLimit = Number.isFinite(Number(historyLimit)) ? Math.max(1, Math.round(Number(historyLimit))) : 50;
  return safeArray(historyItems).slice(0, normalizedLimit);
}
async function getPromptHistory() {
  const historyLimit = await getHistoryLimit();
  const history = await getStoredPromptHistory();
  return applyHistoryVisibleLimit(history, historyLimit);
}
async function setPromptHistory(historyItems) {
  const normalized = sortByDateDesc(
    safeArray(historyItems).map((item) => buildHistoryEntry(item))
  );
  await writeLocal(LOCAL_STORAGE_KEYS.history, normalized);
  return normalized;
}
async function deletePromptHistoryItem(historyId) {
  const history = await getStoredPromptHistory();
  const nextHistory = history.filter((item) => Number(item.id) !== Number(historyId));
  await setPromptHistory(nextHistory);
  return nextHistory;
}
async function clearPromptHistory() {
  await writeLocal(LOCAL_STORAGE_KEYS.history, []);
}

// src/config/sites/builtins.ts
var AI_SITES = Object.freeze([
  {
    id: "chatgpt",
    name: "ChatGPT",
    url: "https://chatgpt.com/",
    hostname: "chatgpt.com",
    inputSelector: "#prompt-textarea, div#prompt-textarea[contenteditable='true'], textarea[aria-label*='chatgpt' i], textarea[aria-label*='채팅' i]",
    fallbackSelectors: [
      "#prompt-textarea",
      "div#prompt-textarea[contenteditable='true']",
      "textarea[aria-label*='chatgpt' i]",
      "textarea[aria-label*='채팅' i]",
      "textarea.wcDTda_fallbackTextarea",
      "div[contenteditable='true'][data-id='root']",
      "main div[contenteditable='true']"
    ],
    inputType: "contenteditable",
    submitSelector: "button[data-testid='send-button'], button[aria-label*='send' i], button[aria-label*='보내기' i]",
    submitMethod: "click",
    selectorCheckMode: "input-and-submit",
    waitMs: 2e3,
    fallback: true,
    lastVerified: "2026-03",
    verifiedVersion: "web-ui-mar-2026",
    authSelectors: [
      "form[action*='/auth']",
      "input[name='email']",
      "input[name='username']"
    ]
  },
  {
    id: "gemini",
    name: "Gemini",
    url: "https://gemini.google.com/app",
    hostname: "gemini.google.com",
    inputSelector: "div[contenteditable='true'][role='textbox'], div.ql-editor.textarea.new-input-ui[contenteditable='true'], div.ql-editor[contenteditable='true'][role='textbox']",
    fallbackSelectors: [
      "div[contenteditable='true'][role='textbox']",
      "div.ql-editor.textarea.new-input-ui[contenteditable='true']",
      "div.ql-editor[contenteditable='true'][role='textbox']",
      "textarea, div[contenteditable='true']"
    ],
    inputType: "contenteditable",
    submitSelector: "button.send-button, button[aria-label*='send' i], button[aria-label*='보내기' i]",
    submitMethod: "click",
    selectorCheckMode: "input-and-submit",
    waitMs: 2500,
    fallback: true,
    lastVerified: "2026-04",
    verifiedVersion: "gemini-app-apr-2026",
    authSelectors: [
      "input[type='email']",
      "input[type='password']"
    ]
  },
  {
    id: "claude",
    name: "Claude",
    url: "https://claude.ai/new",
    hostname: "claude.ai",
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
    selectorCheckMode: "input-and-submit",
    waitMs: 1500,
    fallback: true,
    lastVerified: "2026-04",
    verifiedVersion: "claude-web-apr-2026",
    authSelectors: [
      "input#email",
      "input[type='email']",
      "input[type='password']",
      "form[action*='login']"
    ]
  },
  {
    id: "grok",
    name: "Grok",
    url: "https://grok.com/",
    hostname: "grok.com",
    inputSelector: "div.tiptap.ProseMirror[contenteditable='true'], div.ProseMirror[contenteditable='true'][translate='no'], div.ProseMirror[contenteditable='true']",
    fallbackSelectors: [
      "div.tiptap.ProseMirror[contenteditable='true']",
      "div.ProseMirror[contenteditable='true'][translate='no']",
      "div.ProseMirror[contenteditable='true']",
      "textarea[aria-label*='grok' i]",
      "textarea[placeholder*='help' i]",
      "textarea"
    ],
    inputType: "contenteditable",
    submitSelector: "button[aria-label*='submit' i], button[aria-label*='제출' i]",
    submitMethod: "click",
    selectorCheckMode: "input-and-submit",
    waitMs: 2e3,
    fallback: true,
    lastVerified: "2026-03",
    verifiedVersion: "grok-web-mar-2026",
    authSelectors: [
      "input[autocomplete='username']",
      "input[type='password']"
    ]
  },
  {
    id: "perplexity",
    name: "Perplexity",
    url: "https://www.perplexity.ai/",
    hostname: "www.perplexity.ai",
    hostnameAliases: ["perplexity.ai"],
    inputSelector: "#ask-input[data-lexical-editor='true'][role='textbox']",
    fallbackSelectors: [
      "div#ask-input[data-lexical-editor='true'][role='textbox']",
      "div#ask-input[contenteditable='true'][role='textbox']",
      "#ask-input[contenteditable='true']",
      "div[contenteditable='true'][role='textbox']",
      "textarea[placeholder*='Ask'][data-testid='search-input']",
      "textarea[placeholder*='Ask']",
      "textarea[placeholder*='질문']",
      "textarea"
    ],
    inputType: "contenteditable",
    submitSelector: "button[aria-label*='Submit'][type='submit'], button[type='submit'][aria-label*='검색'], button[aria-label*='submit' i], button[aria-label*='제출' i]",
    submitMethod: "click",
    selectorCheckMode: "input-only",
    waitMs: 2e3,
    fallback: true,
    lastVerified: "2026-03",
    verifiedVersion: "perplexity-web-mar-2026",
    authSelectors: [
      "input[type='email']",
      "input[type='password']",
      "button[data-testid='login-button']"
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
var VALID_SELECTOR_CHECK_MODES = /* @__PURE__ */ new Set(["input-and-submit", "input-only"]);
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

// src/shared/sites/normalizers.ts
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
    return new URL(url).hostname;
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
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return [];
    }
    const primaryHost = normalizeOriginHost(parsed.host);
    const primaryHostname = normalizeHostname(parsed.hostname);
    const normalizedAliases = Array.from(
      new Set(
        normalizeStringList(hostnameAliases).map((entry) => normalizeOriginHost(entry)).filter((entry) => entry && entry !== primaryHost && entry !== primaryHostname)
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
function createCustomSiteId(name) {
  const slug = safeText2(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  return `custom-${slug || Date.now()}-${Date.now().toString(36).slice(-4)}`;
}
function createImportedCustomSiteIdBase(site, index = 0) {
  const seed = [
    safeText2(site?.id),
    safeText2(site?.name),
    normalizeHostname(site?.hostname || deriveHostname(site?.url)),
    `site-${index + 1}`
  ].find(Boolean);
  const slug = safeText2(seed).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  return `custom-${slug || `site-${index + 1}`}`;
}
function ensureUniqueImportedSiteId(baseId, usedIds) {
  let candidate = safeText2(baseId) || "custom-site";
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
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
var PERPLEXITY_PRIMARY_INPUT_SELECTOR = "#ask-input[data-lexical-editor='true'][role='textbox']";
var PERPLEXITY_SELECTOR_FALLBACKS = [
  "div#ask-input[data-lexical-editor='true'][role='textbox']",
  "div#ask-input[contenteditable='true'][role='textbox']",
  "#ask-input[contenteditable='true']",
  "div[contenteditable='true'][role='textbox']"
];
function normalizeSelectorArray(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim()) : [];
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
function buildBaseSiteRecord(site, builtInMeta = {}) {
  const style = BUILT_IN_SITE_STYLE_MAP[site.id] ?? {};
  const url = safeText2(site.url);
  const hostname = normalizeHostname(site.hostname || deriveHostname(url));
  const hostnameAliases = normalizeHostnameAliases(site.hostnameAliases, hostname);
  const normalizedSelectors = normalizePerplexitySelectors(site);
  return {
    id: safeText2(site.id),
    name: safeText2(site.name) || "AI Service",
    url,
    hostname,
    hostnameAliases,
    inputSelector: normalizedSelectors.inputSelector,
    inputType: normalizeInputType(site.inputType, "textarea"),
    submitSelector: safeText2(site.submitSelector),
    submitMethod: normalizeSubmitMethod(site.submitMethod, "click"),
    selectorCheckMode: normalizeSelectorCheckMode(site.selectorCheckMode, "input-and-submit"),
    waitMs: normalizeWaitMs(site.waitMs, 2e3),
    fallbackSelectors: normalizedSelectors.fallbackSelectors,
    fallback: normalizeBoolean2(site.fallback, true),
    authSelectors: Array.isArray(site.authSelectors) ? site.authSelectors.filter((entry) => typeof entry === "string" && entry.trim()) : [],
    lastVerified: safeText2(site.lastVerified),
    verifiedVersion: safeText2(site.verifiedVersion),
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
  const submitMethod = normalizeSubmitMethod(override.submitMethod, originalSite.submitMethod);
  const submitSelector = submitMethod === "click" ? safeText2(override.submitSelector) || safeText2(originalSite.submitSelector) : safeText2(override.submitSelector);
  return {
    name: safeText2(override.name) || originalSite.name,
    inputSelector: safeText2(override.inputSelector) || originalSite.inputSelector,
    inputType: normalizeInputType(override.inputType, originalSite.inputType),
    submitSelector,
    submitMethod,
    selectorCheckMode: normalizeSelectorCheckMode(
      override.selectorCheckMode,
      originalSite.selectorCheckMode || "input-and-submit"
    ),
    waitMs: normalizeWaitMs(override.waitMs, originalSite.waitMs),
    fallbackSelectors: Array.isArray(override.fallbackSelectors) ? override.fallbackSelectors.filter((entry) => typeof entry === "string" && entry.trim()) : Array.isArray(originalSite.fallbackSelectors) ? [...originalSite.fallbackSelectors] : [],
    authSelectors: Array.isArray(override.authSelectors) ? override.authSelectors.filter((entry) => typeof entry === "string" && entry.trim()) : Array.isArray(originalSite.authSelectors) ? [...originalSite.authSelectors] : [],
    lastVerified: safeText2(override.lastVerified) || safeText2(originalSite.lastVerified),
    verifiedVersion: safeText2(override.verifiedVersion) || safeText2(originalSite.verifiedVersion),
    color: normalizeColor(
      override.color,
      BUILT_IN_SITE_STYLE_MAP[originalSite.id]?.color ?? "#c24f2e"
    ),
    icon: normalizeIcon(
      override.icon,
      BUILT_IN_SITE_STYLE_MAP[originalSite.id]?.icon ?? originalSite.name
    )
  };
}
function normalizeCustomSite(site) {
  const url = safeText2(site?.url);
  const hostname = normalizeHostname(site?.hostname || deriveHostname(url));
  return buildBaseSiteRecord(
    {
      id: safeText2(site?.id) || createCustomSiteId(site?.name),
      name: safeText2(site?.name) || "Custom AI",
      url,
      hostname,
      hostnameAliases: normalizeHostnameAliases(site?.hostnameAliases, hostname),
      inputSelector: safeText2(site?.inputSelector),
      inputType: normalizeInputType(site?.inputType, "textarea"),
      submitSelector: safeText2(site?.submitSelector),
      submitMethod: normalizeSubmitMethod(site?.submitMethod, "click"),
      selectorCheckMode: normalizeSelectorCheckMode(
        site?.selectorCheckMode,
        "input-and-submit"
      ),
      waitMs: normalizeWaitMs(site?.waitMs, 2e3),
      fallbackSelectors: normalizeStringList(site?.fallbackSelectors),
      fallback: normalizeBoolean2(site?.fallback, true),
      authSelectors: normalizeStringList(site?.authSelectors),
      lastVerified: safeText2(site?.lastVerified),
      verifiedVersion: safeText2(site?.verifiedVersion),
      enabled: normalizeBoolean2(site?.enabled, true),
      color: normalizeColor(site?.color, "#c24f2e"),
      icon: normalizeIcon(site?.icon, "AI")
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
function isValidURL(string) {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
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
  if (safeText2(draft?.submitMethod) === "click" && !safeText2(draft?.submitSelector)) {
    pushFieldError(fieldErrors, "submitSelector", "Submit selector is required when using click submit.");
  }
  const aliasValidation = validateHostnameAliases(draft?.hostnameAliases);
  aliasValidation.errors.forEach((message) => pushFieldError(fieldErrors, "hostnameAliases", message));
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
    "inputSelector",
    "inputType",
    "submitSelector",
    "submitMethod",
    "selectorCheckMode",
    "waitMs",
    "fallbackSelectors",
    "authSelectors",
    "lastVerified",
    "verifiedVersion",
    "color",
    "icon"
  ]);
  if (Object.keys(rawRecord).some((key) => !allowedKeys.has(key))) {
    return true;
  }
  const simpleComparisons = [
    ["name", safeText2(rawRecord.name), sanitized.name],
    ["inputSelector", safeText2(rawRecord.inputSelector), sanitized.inputSelector],
    ["inputType", safeText2(rawRecord.inputType), sanitized.inputType],
    ["submitSelector", safeText2(rawRecord.submitSelector), sanitized.submitSelector],
    ["submitMethod", safeText2(rawRecord.submitMethod), sanitized.submitMethod],
    ["selectorCheckMode", safeText2(rawRecord.selectorCheckMode), sanitized.selectorCheckMode],
    ["lastVerified", safeText2(rawRecord.lastVerified), sanitized.lastVerified],
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
function repairImportedCustomSites(rawSites) {
  const repairedSites = [];
  const rejectedSites = [];
  const rewrittenIds = [];
  const usedIds = new Set(BUILT_IN_SITE_IDS);
  for (const [index, rawSite] of (Array.isArray(rawSites) ? rawSites : []).entries()) {
    const normalized = normalizeCustomSite(rawSite);
    const rawSiteRecord = asPlainRecord(rawSite);
    const validation = validateSiteDraft({
      ...normalized,
      hostnameAliases: Array.isArray(rawSiteRecord.hostnameAliases) ? rawSiteRecord.hostnameAliases : normalized.hostnameAliases
    });
    if (!validation.valid) {
      rejectedSites.push({
        id: safeText2(rawSiteRecord.id) || normalized.id,
        name: normalized.name,
        reason: "validation_failed",
        errors: validation.errors
      });
      continue;
    }
    const requestedId = safeText2(rawSiteRecord.id) || "";
    let finalId = requestedId;
    if (!finalId) {
      finalId = ensureUniqueImportedSiteId(
        createImportedCustomSiteIdBase(
          {
            ...rawSiteRecord,
            name: normalized.name,
            hostname: normalized.hostname,
            url: normalized.url
          },
          index
        ),
        usedIds
      );
    } else if (usedIds.has(finalId)) {
      const collisionBase = BUILT_IN_SITE_IDS.has(finalId) ? createImportedCustomSiteIdBase(
        {
          ...rawSiteRecord,
          name: normalized.name,
          hostname: normalized.hostname,
          url: normalized.url
        },
        index
      ) : finalId;
      finalId = ensureUniqueImportedSiteId(collisionBase, usedIds);
    } else {
      usedIds.add(finalId);
    }
    if (finalId !== normalized.id || requestedId && finalId !== requestedId) {
      rewrittenIds.push({
        from: requestedId || normalized.id,
        to: finalId,
        name: normalized.name
      });
    }
    repairedSites.push({
      ...normalized,
      id: finalId
    });
  }
  return {
    repairedSites,
    rejectedSites,
    rewrittenIds
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
async function setCustomSites(sites) {
  const normalized = Array.isArray(sites) ? sites.map((site) => normalizeCustomSite(site)) : [];
  await writeLocal2(SITE_STORAGE_KEYS.customSites, normalized);
  return normalized;
}
async function getBuiltInSiteStates() {
  const rawStates = await readLocal2(SITE_STORAGE_KEYS.builtInSiteStates, {});
  return repairImportedBuiltInStates(rawStates).normalized;
}
async function setBuiltInSiteStates(states) {
  const normalized = repairImportedBuiltInStates(states).normalized;
  await writeLocal2(SITE_STORAGE_KEYS.builtInSiteStates, normalized);
  return normalized;
}
async function getBuiltInSiteOverrides() {
  const rawOverrides = await readLocal2(SITE_STORAGE_KEYS.builtInSiteOverrides, {});
  return repairImportedBuiltInOverrides(rawOverrides).normalized;
}
async function setBuiltInSiteOverrides(overrides) {
  const normalized = repairImportedBuiltInOverrides(overrides).normalized;
  await writeLocal2(SITE_STORAGE_KEYS.builtInSiteOverrides, normalized);
  return normalized;
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
    const state2 = builtInStates[site.id] ?? {};
    return buildBaseSiteRecord(
      {
        ...site,
        ...override,
        enabled: normalizeBoolean2(state2.enabled, true)
      },
      { isBuiltIn: true }
    );
  });
  return [...builtInSites, ...customSites];
}
async function saveCustomSite(siteDraft) {
  const customSites = await getCustomSites();
  const nextSite = normalizeCustomSite(siteDraft);
  const nextSites = [...customSites];
  const index = nextSites.findIndex((site) => site.id === nextSite.id);
  if (index >= 0) {
    nextSites[index] = nextSite;
  } else {
    nextSites.unshift(nextSite);
  }
  await setCustomSites(nextSites);
  await cleanupUnusedCustomSitePermissions(customSites, nextSites);
  return nextSite;
}
async function saveBuiltInSiteOverride(siteId, overrideDraft) {
  const source = AI_SITES.find((site) => site.id === siteId);
  if (!source) {
    throw new Error("Built-in site not found.");
  }
  const overrides = await getBuiltInSiteOverrides();
  overrides[siteId] = sanitizeBuiltInOverride(
    overrideDraft ?? {},
    source
  );
  await setBuiltInSiteOverrides(overrides);
  return overrides[siteId];
}
async function setRuntimeSiteEnabled(siteId, enabled) {
  const builtInSite = AI_SITES.find((site) => site.id === siteId);
  if (builtInSite) {
    const states = await getBuiltInSiteStates();
    states[siteId] = { enabled: Boolean(enabled) };
    await setBuiltInSiteStates(states);
    return;
  }
  const customSites = await getCustomSites();
  const nextSites = customSites.map(
    (site) => site.id === siteId ? { ...site, enabled: Boolean(enabled) } : site
  );
  await setCustomSites(nextSites);
}
async function deleteCustomSite(siteId) {
  const customSites = await getCustomSites();
  const nextSites = customSites.filter((site) => site.id !== siteId);
  await setCustomSites(nextSites);
  await cleanupUnusedCustomSitePermissions(customSites, nextSites);
  return nextSites;
}
async function resetSiteSettings() {
  const customSites = await getCustomSites();
  await resetStoredSiteSettings();
  await cleanupUnusedCustomSitePermissions(customSites, []);
}
function buildSitePermissionPatterns(url, hostnameAliases = []) {
  return buildOriginPatterns(
    url,
    hostnameAliases
  );
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
async function updateTemplateVariableCache(partialCache) {
  const current = await getTemplateVariableCache();
  const next = {
    ...current,
    ...normalizeTemplateDefaults(partialCache)
  };
  await setTemplateVariableCache(next);
  return next;
}

// src/shared/prompts/import-export.ts
var CURRENT_EXPORT_VERSION = 6;
function asImportPayload(value) {
  return safeObject(value);
}
async function containsOriginPermission(originPattern) {
  try {
    if (!chrome.permissions?.contains || !originPattern) {
      return false;
    }
    return await chrome.permissions.contains({
      origins: [originPattern]
    });
  } catch (_error) {
    return false;
  }
}
async function findMissingOriginPermissions(originPatterns = []) {
  const missingOrigins = [];
  for (const originPattern of Array.isArray(originPatterns) ? originPatterns : []) {
    if (!originPattern) {
      continue;
    }
    if (!await containsOriginPermission(originPattern)) {
      missingOrigins.push(originPattern);
    }
  }
  return missingOrigins;
}
async function repairImportedCustomSitesWithPermissions(rawSites) {
  const repaired = repairImportedCustomSites(rawSites);
  const requestedOrigins = /* @__PURE__ */ new Set();
  const deniedOrigins = /* @__PURE__ */ new Set();
  const blockedOrigins = /* @__PURE__ */ new Set();
  const acceptedSites = [];
  const permissionDeniedSites = [];
  for (const site of repaired.repairedSites) {
    const permissionPatterns = Array.isArray(site?.permissionPatterns) ? site.permissionPatterns.filter((pattern) => typeof pattern === "string" && pattern.trim()) : [];
    permissionPatterns.forEach((origin) => requestedOrigins.add(origin));
    const blockedForSite = permissionPatterns.filter((origin) => blockedOrigins.has(origin));
    if (blockedForSite.length > 0) {
      blockedForSite.forEach((origin) => deniedOrigins.add(origin));
      permissionDeniedSites.push({
        id: safeText2(site.id) || void 0,
        name: safeText2(site.name) || "Custom AI",
        reason: "permission_denied",
        origins: blockedForSite
      });
      continue;
    }
    const missingOrigins = await findMissingOriginPermissions(permissionPatterns);
    if (missingOrigins.length === 0) {
      acceptedSites.push(site);
      continue;
    }
    try {
      const granted = chrome.permissions?.request ? await chrome.permissions.request({ origins: missingOrigins }) : false;
      if (granted) {
        acceptedSites.push(site);
        continue;
      }
    } catch (_error) {
    }
    missingOrigins.forEach((origin) => {
      blockedOrigins.add(origin);
      deniedOrigins.add(origin);
    });
    permissionDeniedSites.push({
      id: safeText2(site.id) || void 0,
      name: safeText2(site.name) || "Custom AI",
      reason: "permission_denied",
      origins: missingOrigins
    });
  }
  return {
    acceptedSites,
    rejectedSites: [...repaired.rejectedSites, ...permissionDeniedSites],
    rewrittenIds: repaired.rewrittenIds,
    deniedOrigins: [...deniedOrigins],
    requestedOrigins: [...requestedOrigins]
  };
}
function normalizeImportVersion(value) {
  const version = Number(value);
  if (!Number.isFinite(version) || version <= 0) {
    return 1;
  }
  return Math.max(1, Math.floor(version));
}
function migrateV1ToV2(payload) {
  return {
    ...payload,
    version: 2,
    broadcastCounter: payload.broadcastCounter ?? 0
  };
}
function migrateV2ToV3(payload) {
  return {
    ...payload,
    version: 3,
    builtInSiteStates: payload.builtInSiteStates ?? {},
    builtInSiteOverrides: payload.builtInSiteOverrides ?? {}
  };
}
function migrateV3ToV4(payload) {
  return {
    ...payload,
    version: 4,
    settings: normalizeSettings(payload.settings ?? DEFAULT_SETTINGS),
    history: safeArray(payload.history).map((entry) => buildHistoryEntry(entry)),
    favorites: safeArray(payload.favorites).map((entry) => buildFavoriteEntry(entry))
  };
}
function migrateV4ToV5(payload) {
  return {
    ...payload,
    version: 5,
    history: safeArray(payload.history).map((entry) => buildHistoryEntry(entry)),
    favorites: safeArray(payload.favorites).map((entry) => buildFavoriteEntry(entry))
  };
}
function migrateV5ToV6(payload) {
  return {
    ...payload,
    version: 6,
    history: safeArray(payload.history).map((entry) => buildHistoryEntry(entry)),
    favorites: safeArray(payload.favorites).map((entry) => buildFavoriteEntry(entry))
  };
}
function migrateImportData(rawValue) {
  let payload = asImportPayload(rawValue);
  const sourceVersion = normalizeImportVersion(payload.version);
  let workingVersion = sourceVersion;
  if (workingVersion < 2) {
    payload = migrateV1ToV2(payload);
    workingVersion = 2;
  }
  if (workingVersion < 3) {
    payload = migrateV2ToV3(payload);
    workingVersion = 3;
  }
  if (workingVersion < 4) {
    payload = migrateV3ToV4(payload);
    workingVersion = 4;
  }
  if (workingVersion < 5) {
    payload = migrateV4ToV5(payload);
    workingVersion = 5;
  }
  if (workingVersion < 6) {
    payload = migrateV5ToV6(payload);
    workingVersion = 6;
  }
  return {
    migrated: payload,
    sourceVersion,
    targetVersion: CURRENT_EXPORT_VERSION
  };
}
async function exportPromptData() {
  const [
    broadcastCounter,
    history,
    favorites,
    templateVariableCache,
    settings,
    customSites,
    builtInSiteStates,
    builtInSiteOverrides
  ] = await Promise.all([
    getBroadcastCounter(),
    getStoredPromptHistory(),
    getPromptFavorites(),
    getTemplateVariableCache(),
    getAppSettings(),
    getCustomSites(),
    getBuiltInSiteStates(),
    getBuiltInSiteOverrides()
  ]);
  return {
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    version: CURRENT_EXPORT_VERSION,
    broadcastCounter,
    history,
    favorites,
    templateVariableCache,
    settings,
    customSites,
    builtInSiteStates,
    builtInSiteOverrides
  };
}
async function importPromptData(jsonString) {
  const parsed = JSON.parse(jsonString);
  const { migrated, sourceVersion, targetVersion } = migrateImportData(parsed);
  const previousCustomSites = await getCustomSites();
  const history = safeArray(migrated?.history).map((item) => buildHistoryEntry(item));
  const favorites = safeArray(migrated?.favorites).map(
    (item) => buildFavoriteEntry(item)
  );
  const importedBroadcastCounter = normalizeBroadcastCounter(migrated?.broadcastCounter);
  const templateVariableCache = normalizeTemplateDefaults(migrated?.templateVariableCache);
  const importedSettings = normalizeSettings(migrated?.settings ?? DEFAULT_SETTINGS);
  const importedCustomSites = safeArray(migrated?.customSites);
  const importedBuiltInSiteStates = safeObject(migrated?.builtInSiteStates);
  const importedBuiltInSiteOverrides = safeObject(migrated?.builtInSiteOverrides);
  const normalizedHistory = [];
  for (const item of sortByDateDesc(history)) {
    normalizedHistory.push({
      ...item,
      id: ensureUniqueNumericId(normalizedHistory, Number(item.id))
    });
  }
  const normalizedFavorites = [];
  for (const item of sortByDateDesc(favorites, "favoritedAt")) {
    normalizedFavorites.push({
      ...item,
      id: ensureUniqueStringId(normalizedFavorites, String(item.id))
    });
  }
  const customSiteImport = await repairImportedCustomSitesWithPermissions(importedCustomSites);
  const builtInStateImport = repairImportedBuiltInStates(importedBuiltInSiteStates);
  const builtInOverrideImport = repairImportedBuiltInOverrides(importedBuiltInSiteOverrides);
  await setAppSettings(importedSettings);
  await Promise.all([
    setBroadcastCounter(importedBroadcastCounter),
    setPromptFavorites(normalizedFavorites),
    setTemplateVariableCache(templateVariableCache),
    setCustomSites(customSiteImport.acceptedSites),
    setBuiltInSiteStates(builtInStateImport.normalized),
    setBuiltInSiteOverrides(builtInOverrideImport.normalized)
  ]);
  await cleanupUnusedCustomSitePermissions(previousCustomSites, customSiteImport.acceptedSites);
  await setPromptHistory(normalizedHistory);
  return {
    broadcastCounter: importedBroadcastCounter,
    history: normalizedHistory,
    favorites: normalizedFavorites,
    templateVariableCache,
    settings: importedSettings,
    customSites: customSiteImport.acceptedSites,
    builtInSiteStates: builtInStateImport.normalized,
    builtInSiteOverrides: builtInOverrideImport.normalized,
    importSummary: {
      version: targetVersion,
      migratedFromVersion: sourceVersion,
      customSites: {
        importedCount: importedCustomSites.length,
        acceptedIds: customSiteImport.acceptedSites.map((site) => site.id),
        acceptedNames: customSiteImport.acceptedSites.map((site) => site.name),
        rejected: customSiteImport.rejectedSites,
        rewrittenIds: customSiteImport.rewrittenIds,
        deniedOrigins: customSiteImport.deniedOrigins
      },
      builtInSiteStates: {
        appliedIds: builtInStateImport.appliedIds,
        droppedIds: builtInStateImport.droppedIds
      },
      builtInSiteOverrides: {
        appliedIds: builtInOverrideImport.appliedIds,
        droppedIds: builtInOverrideImport.droppedIds,
        adjustedIds: builtInOverrideImport.adjustedIds
      }
    }
  };
}

// src/shared/prompts/search.ts
function normalizeSearchValue(value) {
  return safeText(value).trim().toLowerCase();
}
function matchesFavoriteSearch(item, query) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) {
    return true;
  }
  const tags = Array.isArray(item?.tags) ? item.tags.map((tag) => safeText(tag).trim()).filter(Boolean) : [];
  const values = [
    item?.title,
    item?.text,
    item?.folder,
    ...tags,
    ...tags.map((tag) => `#${tag}`)
  ];
  return values.some((value) => normalizeSearchValue(value).includes(normalizedQuery));
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
async function getComposeDraftPrompt() {
  const result = await chrome.storage.local.get([
    LOCAL_PROMPT_STATE_KEYS.composeDraftPrompt,
    LOCAL_PROMPT_STATE_KEYS.legacyLastPrompt
  ]);
  if (typeof result[LOCAL_PROMPT_STATE_KEYS.composeDraftPrompt] === "string") {
    return normalizePrompt(result[LOCAL_PROMPT_STATE_KEYS.composeDraftPrompt]);
  }
  return normalizePrompt(result[LOCAL_PROMPT_STATE_KEYS.legacyLastPrompt]);
}
async function setComposeDraftPrompt(prompt) {
  await chrome.storage.local.set({
    [LOCAL_PROMPT_STATE_KEYS.composeDraftPrompt]: normalizePrompt(prompt)
  });
}
async function setLastSentPrompt(prompt) {
  await chrome.storage.local.set({
    [LOCAL_PROMPT_STATE_KEYS.lastSentPrompt]: normalizePrompt(prompt)
  });
}
async function getPopupPromptIntent() {
  const result = await chrome.storage.session.get(SESSION_PROMPT_STATE_KEYS.popupPromptIntent);
  return normalizePopupPromptIntent(result[SESSION_PROMPT_STATE_KEYS.popupPromptIntent]);
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
async function consumePopupPromptIntent() {
  const current = await getPopupPromptIntent();
  await setPopupPromptIntent(null);
  return current;
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
  popupFavoriteIntent: "popupFavoriteIntent",
  favoriteRunJobs: "favoriteRunJobs"
});

// src/shared/runtime-state/normalizers.ts
function isPlainObject2(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function safeText3(value) {
  return typeof value === "string" ? value.trim() : "";
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

// src/shared/runtime-state/last-broadcast.ts
async function getLastBroadcast() {
  const value = await readStorage("session", SESSION_RUNTIME_KEYS.lastBroadcast, null);
  return normalizeLastBroadcast(value);
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
async function getPopupFavoriteIntent() {
  const value = await readStorage("session", SESSION_RUNTIME_KEYS.popupFavoriteIntent, null);
  return normalizePopupFavoriteIntent(value);
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
async function consumePopupFavoriteIntent() {
  const current = await getPopupFavoriteIntent();
  await setPopupFavoriteIntent(null);
  return current;
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
    executionContext: normalizeExecutionContext(source.executionContext)
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
function getLatestFavoriteRunJobByFavoriteId(jobs, favoriteId) {
  const normalizedFavoriteId = safeText(favoriteId).trim();
  if (!normalizedFavoriteId) {
    return null;
  }
  return [...jobs].filter((job) => safeText(job.favoriteId).trim() === normalizedFavoriteId).sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] ?? null;
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
async function drainPendingUiToasts() {
  const current = await getPendingUiToasts();
  await setPendingUiToasts([]);
  return current;
}

// src/popup/ui/toast.ts
var STYLE_ID = "apb-toast-styles";
var MAX_TOASTS = 3;
var toastRoot = null;
var toastIdCounter = 0;
var toastMap = /* @__PURE__ */ new Map();
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .apb-toast-host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
    }

    .apb-toast {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: start;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid transparent;
      color: #fff;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
      animation: apb-toast-slide-up 180ms ease;
      cursor: pointer;
    }

    .apb-toast.success { background: #1f8f5f; }
    .apb-toast.error { background: #b53b3b; }
    .apb-toast.warning { background: #c28111; color: #201a15; }
    .apb-toast.info { background: #2c6db8; }
    .apb-toast.removing {
      opacity: 0;
      transform: translateY(6px);
      transition: opacity 140ms ease, transform 140ms ease;
    }

    .apb-toast-icon {
      font-size: 14px;
      line-height: 1.2;
      padding-top: 1px;
    }

    .apb-toast-body {
      display: grid;
      gap: 8px;
      min-width: 0;
    }

    .apb-toast-message {
      font-size: 12px;
      line-height: 1.5;
      word-break: break-word;
    }

    .apb-toast-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .apb-toast-action,
    .apb-toast-close {
      border: 1px solid rgba(255, 255, 255, 0.24);
      background: rgba(255, 255, 255, 0.14);
      color: inherit;
      border-radius: 999px;
      padding: 6px 10px;
      cursor: pointer;
      font: inherit;
      font-size: 11px;
      line-height: 1.2;
    }

    .apb-toast.warning .apb-toast-action,
    .apb-toast.warning .apb-toast-close {
      border-color: rgba(32, 26, 21, 0.16);
      background: rgba(255, 255, 255, 0.3);
    }

    .apb-toast-close {
      padding: 4px 8px;
      background: transparent;
      border-color: transparent;
      font-size: 14px;
    }

    @keyframes apb-toast-slide-up {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
  document.head.appendChild(style);
}
function getIcon(type) {
  switch (type) {
    case "success":
      return "✅";
    case "error":
      return "❌";
    case "warning":
      return "⚠️";
    default:
      return "ℹ️";
  }
}
function normalizeAction(action = {}) {
  return {
    id: action.id || `toast-action-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: action.label || "OK",
    variant: action.variant || "default",
    onClick: typeof action.onClick === "function" ? action.onClick : null
  };
}
function normalizeToastInput(input, type, duration) {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return {
      id: input.id || `toast-${Date.now()}-${toastIdCounter += 1}`,
      message: String(input.message ?? ""),
      type: input.type || "info",
      duration: Number.isFinite(Number(input.duration)) ? Number(input.duration) : 3e3,
      actions: Array.isArray(input.actions) ? input.actions.map((action) => normalizeAction(action)) : []
    };
  }
  return {
    id: `toast-${Date.now()}-${toastIdCounter += 1}`,
    message: String(input ?? ""),
    type: type || "info",
    duration: Number.isFinite(Number(duration)) ? Number(duration) : 3e3,
    actions: []
  };
}
function ensureToastRoot() {
  if (toastRoot) {
    return toastRoot;
  }
  toastRoot = document.getElementById("toast-host");
  if (!toastRoot) {
    toastRoot = document.createElement("div");
    toastRoot.id = "toast-host";
    document.body.appendChild(toastRoot);
  }
  toastRoot.classList.add("apb-toast-host");
  return toastRoot;
}
function removeToastElement(id) {
  const entry = toastMap.get(id);
  if (!entry) {
    return;
  }
  if (entry.timer) {
    window.clearTimeout(entry.timer);
  }
  entry.element.classList.add("removing");
  window.setTimeout(() => {
    entry.element.remove();
  }, 140);
  toastMap.delete(id);
}
function trimToMax() {
  const entries = [...toastMap.values()];
  while (entries.length > MAX_TOASTS) {
    const first = entries.shift();
    if (!first) {
      break;
    }
    removeToastElement(first.id);
  }
}
function initToastRoot(container) {
  ensureStyles();
  toastRoot = container || document.getElementById("toast-host") || null;
  return ensureToastRoot();
}
function showToast(input, type = "info", duration = 3e3) {
  ensureStyles();
  const root = ensureToastRoot();
  const toast = normalizeToastInput(input, type, duration);
  const element = document.createElement("div");
  element.className = `apb-toast ${toast.type}`;
  element.dataset.toastId = toast.id;
  const icon = document.createElement("span");
  icon.className = "apb-toast-icon";
  icon.textContent = getIcon(toast.type);
  const body = document.createElement("div");
  body.className = "apb-toast-body";
  const message = document.createElement("div");
  message.className = "apb-toast-message";
  message.textContent = toast.message;
  body.appendChild(message);
  if (toast.actions.length > 0) {
    const actions = document.createElement("div");
    actions.className = "apb-toast-actions";
    toast.actions.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "apb-toast-action";
      button.textContent = action.label;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        action.onClick?.();
        hideToast(toast.id);
      });
      actions.appendChild(button);
    });
    body.appendChild(actions);
  }
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "apb-toast-close";
  closeButton.textContent = "×";
  closeButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    hideToast(toast.id);
  });
  element.append(icon, body, closeButton);
  element.addEventListener("click", () => {
    hideToast(toast.id);
  });
  root.appendChild(element);
  const entry = {
    id: toast.id,
    element,
    timer: null
  };
  if (toast.duration >= 0) {
    entry.timer = window.setTimeout(() => {
      hideToast(toast.id);
    }, toast.duration);
  }
  toastMap.set(toast.id, entry);
  trimToMax();
  return toast.id;
}
function hideToast(id) {
  removeToastElement(id);
}
function clearAllToasts() {
  [...toastMap.keys()].forEach((id) => {
    removeToastElement(id);
  });
}

// src/popup/app/i18n.ts
var uiLanguage = chrome.i18n.getUILanguage().toLowerCase();
var isKorean = uiLanguage === "ko" || uiLanguage.startsWith("ko-");
function msg(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || "";
}
function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((element) => {
    const value = msg(element.dataset.i18n);
    if (value) {
      element.textContent = value;
    }
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const value = msg(element.dataset.i18nPlaceholder);
    if (value) {
      element.setAttribute("placeholder", value);
    }
  });
  root.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    const value = msg(element.dataset.i18nAriaLabel);
    if (value) {
      element.setAttribute("aria-label", value);
    }
  });
}
var t = {
  title: msg("ext_name"),
  desc: msg("ext_description"),
  tabs: {
    compose: msg("tab_write"),
    history: msg("tab_history"),
    favorites: msg("tab_favorites"),
    settings: msg("tab_settings")
  },
  placeholder: msg("popup_placeholder"),
  sitesLabel: msg("popup_sites_label"),
  selectAll: msg("popup_select_all"),
  deselectAll: msg("popup_deselect_all"),
  send: msg("popup_send"),
  saveFavorite: msg("popup_save_favorite"),
  sending: (count) => msg("status_sending", [String(count)]),
  sent: (count) => msg("status_success", [String(count)]),
  warnEmpty: msg("popup_warn_empty"),
  warnNoSite: msg("popup_warn_no_site"),
  stopSending: msg("popup_stop_sending") || "Stop",
  broadcastCancelled: msg("popup_broadcast_cancelled") || "Broadcast cancelled.",
  error: (message) => msg("status_failed", [String(message ?? "")]),
  historySearch: msg("popup_history_search"),
  favoritesSearch: msg("popup_favorites_search"),
  historyEmpty: msg("history_empty"),
  favoritesEmpty: msg("favorites_empty"),
  addFavorite: msg("popup_add_favorite"),
  delete: msg("popup_delete"),
  favoriteAdded: msg("popup_favorite_added"),
  favoriteSaved: msg("popup_favorite_saved"),
  historyDeleted: msg("popup_history_deleted"),
  favoriteDeleted: msg("popup_favorite_deleted"),
  favoriteDuplicated: msg("popup_favorite_duplicated") || "Favorite duplicated.",
  favoriteDuplicate: msg("popup_favorite_duplicate") || "Duplicate",
  favoriteDuplicatePrefix: msg("popup_favorite_duplicate_prefix") || "[Copy]",
  titlePlaceholder: msg("popup_title_placeholder"),
  titleSaved: msg("popup_title_saved"),
  settingsTitle: msg("popup_settings_title"),
  settingsDesc: msg("popup_settings_description"),
  clearHistory: msg("settings_reset"),
  openOptions: msg("popup_open_options"),
  exportJson: msg("settings_export"),
  importJson: msg("settings_import"),
  clearHistoryConfirm: msg("popup_clear_history_confirm"),
  historyCleared: msg("popup_history_cleared"),
  historyResend: msg("popup_history_resend") || "Resend",
  importSuccess: msg("popup_import_success"),
  importFailed: msg("popup_import_failed"),
  exportSuccess: msg("popup_export_success"),
  emptyActionCompose: msg("popup_empty_action_compose"),
  noSearchResults: msg("popup_no_search_results"),
  importedLoad: msg("popup_imported_load"),
  menuMore: msg("popup_menu_more"),
  favoriteStar: msg("popup_favorite_star"),
  templateSummary: (count) => msg("popup_template_summary", [String(count)]),
  templateUserKind: msg("popup_template_user_kind"),
  templateSystemKind: msg("popup_template_system_kind"),
  templateModalTitle: msg("popup_template_modal_title"),
  templateModalDesc: msg("popup_template_modal_desc"),
  templatePreviewLabel: msg("popup_template_preview_label"),
  templateModalCancel: msg("popup_template_cancel"),
  templateModalConfirm: msg("popup_template_confirm"),
  templateSystemNotice: msg("popup_template_system_notice"),
  templateClipboardNotice: msg("popup_template_clipboard_notice"),
  templateClipboardError: msg("popup_template_clipboard_error"),
  templateMissingValues: msg("popup_template_missing_values"),
  templateFieldLabel: (name) => String(name),
  templateFieldPlaceholder: (name) => msg("popup_template_field_placeholder", [String(name)]),
  favoriteModalTitle: msg("popup_favorite_modal_title"),
  favoriteModalDesc: msg("popup_favorite_modal_desc"),
  favoriteModalCancel: msg("popup_favorite_modal_cancel"),
  favoriteModalConfirm: msg("popup_favorite_modal_confirm"),
  favoriteModalSaveChanges: msg("popup_favorite_modal_save_changes") || "Save changes",
  favoriteEditTitle: msg("popup_favorite_edit_title") || "Edit favorite",
  favoriteEditDesc: msg("popup_favorite_edit_desc") || "Update targets, defaults, chain steps, and schedule settings.",
  favoriteTitleLabel: msg("popup_favorite_title_label"),
  favoriteModeLabel: msg("popup_favorite_mode_label") || "Favorite type",
  favoriteModeSingle: msg("popup_favorite_mode_single") || "Single prompt",
  favoriteModeChain: msg("popup_favorite_mode_chain") || "Chain",
  favoritePromptLabel: msg("popup_favorite_prompt_label") || "Prompt",
  favoriteTargetsLabel: msg("popup_favorite_targets_label") || "Default target services",
  favoriteTagsLabel: msg("popup_favorite_tags_label") || "Tags",
  favoriteFolderLabel: msg("popup_favorite_folder_label") || "Folder",
  favoritePinnedLabel: msg("popup_favorite_pinned_label") || "Pin this favorite",
  favoriteScheduleEnabledLabel: msg("popup_favorite_schedule_enabled_label") || "Enable scheduled run",
  favoriteScheduledAtLabel: msg("popup_favorite_scheduled_at_label") || "Next run time",
  favoriteScheduleRepeatLabel: msg("popup_favorite_schedule_repeat_label") || "Repeat",
  favoriteScheduleRepeatNone: msg("popup_favorite_schedule_repeat_none") || "One time",
  favoriteScheduleRepeatDaily: msg("popup_favorite_schedule_repeat_daily") || "Daily",
  favoriteScheduleRepeatWeekday: msg("popup_favorite_schedule_repeat_weekday") || "Weekdays",
  favoriteScheduleRepeatWeekly: msg("popup_favorite_schedule_repeat_weekly") || "Weekly",
  favoriteSaveDefaultsLabel: msg("popup_favorite_save_defaults_label"),
  favoriteDefaultsLabel: msg("popup_favorite_defaults_label"),
  favoriteChainTitle: msg("popup_favorite_chain_title") || "Chain steps",
  favoriteChainDesc: msg("popup_favorite_chain_desc") || "Each step runs in order and stops the chain if any step fails.",
  favoriteChainAddStep: msg("popup_favorite_chain_add_step") || "Add step",
  favoriteStepLabel: (index) => msg("popup_favorite_step_label", [String(index)]) || `Step ${index}`,
  favoriteStepMoveUp: msg("popup_favorite_step_move_up") || "Move up",
  favoriteStepMoveDown: msg("popup_favorite_step_move_down") || "Move down",
  favoriteStepPromptLabel: msg("popup_favorite_step_prompt_label") || "Prompt",
  favoriteStepDelayLabel: msg("popup_favorite_step_delay_label") || "Delay after previous step (ms)",
  favoriteStepTargetsLabel: msg("popup_favorite_step_targets_label") || "Override targets",
  favoriteStepTargetsHint: msg("popup_favorite_step_targets_hint") || "Leave empty to use the favorite default targets.",
  favoriteRunNow: msg("popup_favorite_run_now") || "Run now",
  favoriteRunQueued: msg("popup_favorite_run_queued") || "Favorite run queued.",
  favoriteRunNeedsEditor: msg("popup_favorite_run_needs_editor") || "This favorite needs more input before it can run.",
  favoriteScheduleDateRequired: msg("popup_favorite_schedule_date_required") || "Choose the next run time for this schedule.",
  favoriteChainNeedsStep: msg("popup_favorite_chain_needs_step") || "Add at least one non-empty chain step.",
  favoriteKindSingle: msg("popup_favorite_kind_single") || "Single",
  favoriteKindChain: msg("popup_favorite_kind_chain") || "Chain",
  favoriteScheduledBadge: msg("popup_favorite_scheduled_badge") || "Scheduled",
  favoriteStepCount: (count) => msg("popup_favorite_step_count", [String(count)]) || `${count} steps`,
  favoriteEdit: msg("popup_favorite_edit") || "Edit",
  clearPrompt: msg("popup_clear_prompt") || "Clear",
  promptCounter: (current) => isKorean ? `${current}자` : `${current} chars`,
  serviceManagementTitle: msg("popup_service_management_title") || "Service Management",
  serviceManagementDesc: msg("popup_service_management_desc") || "Add, edit, enable, or disable AI targets without editing code.",
  addService: msg("popup_service_add") || "Add Service",
  resetServices: msg("popup_service_reset") || "Reset Services",
  resetServicesConfirm: msg("popup_service_reset_confirm") || "Reset built-in services and remove all custom services?",
  serviceBuiltInBadge: msg("popup_service_builtin_badge") || "Built-in",
  serviceCustomBadge: msg("popup_service_custom_badge") || "Custom",
  serviceDisabledLabel: msg("popup_service_disabled") || "Disabled",
  serviceEdit: msg("popup_service_edit") || "Edit",
  serviceDelete: msg("popup_service_delete") || "Delete",
  serviceTest: msg("popup_service_test") || "Test in Tab",
  serviceEditorAddTitle: msg("popup_service_editor_add_title") || "Add Custom Service",
  serviceEditorEditTitle: msg("popup_service_editor_edit_title") || "Edit Service",
  serviceEditorDesc: msg("popup_service_editor_desc") || "Configure selector, submit strategy, style, and launch URL.",
  serviceFieldName: msg("popup_service_field_name") || "Service Name",
  serviceFieldUrl: msg("popup_service_field_url") || "Service URL",
  serviceFieldInputSelector: msg("popup_service_field_input_selector") || "Input Selector",
  serviceFieldInputType: msg("popup_service_field_input_type") || "Input Type",
  serviceFieldSubmitSelector: msg("popup_service_field_submit_selector") || "Submit Selector",
  serviceFieldSubmitMethod: msg("popup_service_field_submit_method") || "Submit Method",
  serviceFieldAdvanced: msg("popup_service_field_advanced") || "Advanced Settings",
  serviceFieldFallbackSelectors: msg("popup_service_field_fallback_selectors") || "Fallback Selectors",
  serviceFieldAuthSelectors: msg("popup_service_field_auth_selectors") || "Auth Selectors",
  serviceFieldHostnameAliases: msg("popup_service_field_hostname_aliases") || "Hostname Aliases",
  serviceFieldLastVerified: msg("popup_service_field_last_verified") || "Last Verified",
  serviceFieldVerifiedVersion: msg("popup_service_field_verified_version") || "Verified Version",
  serviceFieldWait: msg("popup_service_field_wait") || "Wait Time",
  serviceFieldColor: msg("popup_service_field_color") || "Color",
  serviceFieldIcon: msg("popup_service_field_icon") || "Icon",
  serviceFieldEnabled: msg("popup_service_field_enabled") || "Enabled",
  serviceEditorSave: msg("popup_service_editor_save") || "Save",
  serviceEditorCancel: msg("popup_service_editor_cancel") || "Cancel",
  serviceSaved: msg("popup_service_saved") || "Service settings saved.",
  serviceDeleted: msg("popup_service_deleted") || "Custom service deleted.",
  serviceResetDone: msg("popup_service_reset_done") || "Service settings were reset.",
  servicePermissionDenied: msg("popup_service_permission_denied") || "Host permission was not granted for this service URL.",
  serviceValidationError: msg("popup_service_validation_error") || "Please check the service form fields.",
  serviceTestNoTab: msg("popup_service_test_no_tab") || "No active tab is available for selector testing.",
  serviceTestNoSelector: msg("popup_service_test_no_selector") || "Enter a selector first.",
  serviceTestInvalidTab: msg("popup_service_test_invalid_tab") || "Selector testing only works on http/https tabs.",
  serviceTestSuccess: (inputType) => msg("popup_service_test_success", [String(inputType)]) || `Element found (${inputType})`,
  serviceTestFail: msg("popup_service_test_fail") || "Element not found.",
  serviceTestError: (message) => msg("popup_service_test_error", [String(message)]) || `Selector test failed: ${message}`,
  serviceEmptyList: msg("popup_service_empty_list") || "No services available.",
  selectorWarningTooltip: msg("popup_selector_warning_tooltip") || "Selector may have changed. Review the service config.",
  restoredBroadcastSending: msg("popup_broadcast_restored_sending") || "Previous broadcast is still running.",
  restoredBroadcastDone: msg("popup_broadcast_restored_done") || "Last broadcast: $1 success, $2 failed",
  toastConfirm: msg("common_confirm") || "Confirm",
  toastHistoryDeleted: msg("toast_history_deleted") || "History item deleted.",
  toastSettingsSaved: msg("toast_settings_saved") || "Settings saved.",
  toastSendSuccess: (count) => msg("toast_send_success", [String(count)]) || `${count} services queued.`,
  toastPromptEmpty: msg("toast_prompt_empty") || msg("popup_warn_empty") || "Please enter a prompt.",
  toastNoService: msg("toast_no_service") || "Please select at least one service.",
  toastSelectorFailed: (name) => msg("toast_selector_failed", [String(name)]) || `${name} selector was not found.`,
  historySortLatest: msg("popup_history_sort_latest") || "Latest",
  historySortOldest: msg("popup_history_sort_oldest") || "Oldest",
  historySortMostSuccess: msg("popup_history_sort_most_success") || "Most success",
  historySortMostFailure: msg("popup_history_sort_most_failure") || "Most failure",
  favoriteSortRecentUsed: msg("popup_favorite_sort_recent_used") || "Recent use",
  favoriteSortUsageCount: msg("popup_favorite_sort_usage_count") || "Usage count",
  favoriteSortTitle: msg("popup_favorite_sort_title") || "Title",
  favoriteSortCreatedAt: msg("popup_favorite_sort_created_at") || "Created date",
  waitMultiplierLabel: msg("popup_wait_multiplier_label") || "Wait multiplier",
  waitMultiplierValue: (value) => msg("popup_wait_multiplier_value", [String(Number(value).toFixed(1))]) || `${Number(value).toFixed(1)}x`,
  resendModalTitle: msg("popup_resend_modal_title") || "Resend History Item",
  resendModalDesc: msg("popup_resend_modal_desc") || "Choose which services to resend this prompt to.",
  resendModalCancel: msg("popup_resend_modal_cancel") || "Cancel",
  resendModalConfirm: msg("popup_resend_modal_confirm") || "Resend",
  resendSiteUnavailable: msg("popup_resend_site_unavailable") || "Unavailable",
  importReportTitle: msg("popup_import_report_title") || "Import Details",
  importReportDesc: msg("popup_import_report_desc") || "Review accepted, rewritten, and rejected items from this import.",
  importReportClose: msg("popup_import_report_close") || "Close",
  importReportVersion: msg("popup_import_report_version") || "Version",
  importReportAccepted: msg("popup_import_report_accepted") || "Accepted services",
  importReportRewritten: msg("popup_import_report_rewritten") || "Rewritten IDs",
  importReportBuiltins: msg("popup_import_report_builtins") || "Built-in adjustments",
  importReportRejected: msg("popup_import_report_rejected") || "Rejected services",
  importReportRejectedEmpty: msg("popup_import_report_rejected_empty") || "No rejected services.",
  importRejectReason: (reason) => msg(`popup_import_reject_${reason}`) || reason,
  ariaSelected: msg("popup_aria_selected") || "selected",
  ariaNotSelected: msg("popup_aria_not_selected") || "not selected",
  reuseTabsLabel: msg("popup_reuse_tabs_label") || "Reuse open AI tabs in the current window by default",
  reuseTabsDescEnabled: msg("popup_reuse_tabs_desc_enabled") || "When no tab is chosen explicitly, the broadcaster reuses a matching open AI tab before opening a new one.",
  reuseTabsDescDisabled: msg("popup_reuse_tabs_desc_disabled") || "When no tab is chosen explicitly, the broadcaster always opens a fresh tab.",
  openTabsTitle: (count) => msg("popup_open_tabs_title", [String(count)]) || `${count} open tab${count === 1 ? "" : "s"}`,
  openTabsUseDefault: msg("popup_open_tabs_use_default") || "Use default behavior",
  openTabsUseDefaultDetail: (modeLabel) => msg("popup_open_tabs_use_default_detail", [String(modeLabel)]) || `Current setting: ${modeLabel}`,
  openTabsDefaultReuse: msg("popup_open_tabs_default_reuse") || "reuse a matching tab",
  openTabsDefaultNew: msg("popup_open_tabs_default_new") || "open a new tab",
  openTabsAlwaysNew: msg("popup_open_tabs_always_new") || "Always open a new tab",
  openTabsAlwaysNewDetail: msg("popup_open_tabs_always_new_detail") || "Ignore matching open tabs for this service only.",
  openTabsActive: msg("popup_open_tabs_active") || "Active",
  openTabsReady: msg("popup_open_tabs_ready") || "Ready",
  openTabsLoading: msg("popup_open_tabs_loading") || "Loading",
  resultCodeLabels: {
    submitted: msg("result_code_submitted") || "Submitted",
    selector_timeout: msg("result_code_selector_timeout") || "Selector timeout",
    auth_required: msg("result_code_auth_required") || "Login required",
    submit_failed: msg("result_code_submit_failed") || "Submit failed",
    strategy_exhausted: msg("result_code_strategy_exhausted") || "Injection failed",
    permission_denied: msg("result_code_permission_denied") || "Permission denied",
    tab_create_failed: msg("result_code_tab_create_failed") || "Tab open failed",
    tab_closed: msg("result_code_tab_closed") || "Tab closed",
    injection_timeout: msg("result_code_injection_timeout") || "Injection timeout",
    cancelled: msg("result_code_cancelled") || "Cancelled",
    unexpected_error: msg("result_code_unexpected_error") || "Unexpected error"
  }
};
function getUnknownErrorText() {
  return msg("popup_unknown_error");
}
function buildImportSummaryText(summary, { short = false } = {}) {
  const acceptedCount = summary?.customSites?.acceptedIds?.length ?? 0;
  const rejectedCount = summary?.customSites?.rejected?.length ?? 0;
  const rewrittenCount = summary?.customSites?.rewrittenIds?.length ?? 0;
  const deniedCount = (summary?.customSites?.rejected ?? []).filter(
    (entry) => entry?.reason === "permission_denied"
  ).length;
  const overrideAdjustedCount = summary?.builtInSiteOverrides?.adjustedIds?.length ?? 0;
  const overrideDroppedCount = summary?.builtInSiteOverrides?.droppedIds?.length ?? 0;
  const stateDroppedCount = summary?.builtInSiteStates?.droppedIds?.length ?? 0;
  if (isKorean) {
    const parts2 = [
      `가져오기 완료: 커스텀 서비스 ${acceptedCount}개 적용`,
      rejectedCount > 0 ? `건너뜀 ${rejectedCount}개` : "",
      rewrittenCount > 0 ? `ID 재작성 ${rewrittenCount}개` : "",
      deniedCount > 0 ? `권한 거부 ${deniedCount}개` : ""
    ].filter(Boolean);
    if (!short && overrideAdjustedCount + overrideDroppedCount + stateDroppedCount > 0) {
      parts2.push(
        `기본 서비스 보정 ${overrideAdjustedCount + overrideDroppedCount + stateDroppedCount}개`
      );
    }
    return parts2.join(", ");
  }
  const parts = [
    `Import complete: ${acceptedCount} custom service(s) applied`,
    rejectedCount > 0 ? `${rejectedCount} skipped` : "",
    rewrittenCount > 0 ? `${rewrittenCount} id rewrite(s)` : "",
    deniedCount > 0 ? `${deniedCount} permission denial(s)` : ""
  ].filter(Boolean);
  if (!short && overrideAdjustedCount + overrideDroppedCount + stateDroppedCount > 0) {
    parts.push(
      `${overrideAdjustedCount + overrideDroppedCount + stateDroppedCount} built-in adjustment(s)`
    );
  }
  return parts.join(", ");
}
function buildServiceTestResultMessage(response) {
  if (!response?.ok) {
    if (response?.reason === "validation_failed") {
      return {
        message: response.error || t.serviceValidationError,
        isError: true
      };
    }
    if (response?.reason === "no_tab") {
      return {
        message: t.serviceTestNoTab,
        isError: true
      };
    }
    if (response?.reason === "invalid_tab") {
      return {
        message: t.serviceTestInvalidTab,
        isError: true
      };
    }
    return {
      message: t.serviceTestError(response?.error ?? getUnknownErrorText()),
      isError: true
    };
  }
  if (!response?.input?.found) {
    return {
      message: `❌ ${t.serviceTestFail}`,
      isError: true
    };
  }
  const lines = [];
  let isError = false;
  if (response.input.typeMatches === false) {
    isError = true;
    lines.push(
      isKorean ? `⚠ 입력창은 찾았지만 타입이 다릅니다. 실제: ${response.input.actualType}, 기대: ${response.input.expectedType}` : `⚠ Input found but type mismatched. Actual: ${response.input.actualType}, expected: ${response.input.expectedType}`
    );
  } else {
    lines.push(`✅ ${t.serviceTestSuccess(response.input.actualType)}`);
  }
  if (response?.submit?.status === "ok") {
    lines.push(
      isKorean ? "✅ 전송 버튼도 확인했습니다." : "✅ Submit target was also found."
    );
  } else if (response?.submit?.status === "missing") {
    isError = true;
    lines.push(
      isKorean ? "❌ 임시 probe 입력 후에도 전송 버튼을 찾지 못했습니다." : "❌ Submit selector was not found after the temporary probe."
    );
  } else if (response?.submit?.method) {
    lines.push(
      isKorean ? `ℹ ${response.submit.method} 전송 방식이라 버튼 검사는 건너뛰었습니다.` : `ℹ Submit-button validation was skipped for ${response.submit.method} submit.`
    );
  }
  return {
    message: lines.join("\n"),
    isError
  };
}

// src/popup/app/state.ts
var SITE_EMOJI = {
  chatgpt: "GPT",
  gemini: "Gem",
  claude: "Cl",
  grok: "Gk"
};
var state = {
  activeTab: "compose",
  history: [],
  favorites: [],
  historySearch: "",
  favoritesSearch: "",
  favoritesTagFilter: "",
  // 태그 필터 (빈 문자열 = 전체)
  favoritesFolderFilter: "",
  // 폴더 필터 (빈 문자열 = 전체)
  openMenuKey: null,
  openModalId: null,
  lastFocusedElement: null,
  favoriteSaveTimers: /* @__PURE__ */ new Map(),
  loadedTemplateDefaults: {},
  loadedFavoriteTitle: "",
  loadedFavoriteId: "",
  templateVariableCache: {},
  pendingTemplateSend: null,
  pendingFavoriteSave: null,
  pendingFavoriteRunReason: "",
  pendingResendHistory: null,
  pendingImportSummary: null,
  runtimeSites: [],
  serviceEditor: null,
  failedSelectors: /* @__PURE__ */ new Map(),
  favoriteJobs: [],
  lastBroadcast: null,
  lastBroadcastToastSignature: "",
  isSending: false,
  sendSafetyTimer: null,
  promptDraftSaveTimer: null,
  settings: { ...DEFAULT_SETTINGS },
  openSiteTabs: [],
  siteTargetSelections: {},
  sitePromptOverrides: {},
  // siteId -> override prompt string
  openTabsWindowId: null,
  openTabsRefreshTimer: null,
  listKeyboardFocus: {
    history: -1,
    favorites: -1
  }
};

// src/popup/app/dom.ts
var popupDom = {
  header: {
    extTitle: document.getElementById("ext-title"),
    extDesc: document.getElementById("ext-desc")
  },
  tabs: {
    tabButtons: [...document.querySelectorAll(".tab-button")],
    panels: [...document.querySelectorAll(".tab-panel")]
  },
  compose: {
    promptInput: document.getElementById("prompt-input"),
    promptCounter: document.getElementById("prompt-counter"),
    clearPromptBtn: document.getElementById("clear-prompt-btn"),
    templateSummary: document.getElementById("template-summary"),
    templateSummaryLabel: document.getElementById("template-summary-label"),
    templateChipList: document.getElementById("template-chip-list"),
    sitesLabel: document.getElementById("sites-label"),
    sitesContainer: document.getElementById("sites-container"),
    toggleAllBtn: document.getElementById("toggle-all"),
    saveFavoriteBtn: document.getElementById("save-favorite-btn"),
    cancelSendBtn: document.getElementById("cancel-send-btn"),
    sendBtn: document.getElementById("send-btn"),
    statusMsg: document.getElementById("status-message")
  },
  history: {
    historySearchInput: document.getElementById("history-search"),
    historySortSelect: document.getElementById("history-sort"),
    historyList: document.getElementById("history-list")
  },
  favorites: {
    favoritesSearchInput: document.getElementById("favorites-search"),
    favoritesSortSelect: document.getElementById("favorites-sort"),
    favoritesList: document.getElementById("favorites-list")
  },
  settings: {
    settingsTitle: document.getElementById("settings-title"),
    settingsDesc: document.getElementById("settings-desc"),
    reuseExistingTabsToggle: document.getElementById("reuse-existing-tabs-toggle"),
    reuseExistingTabsLabel: document.getElementById("reuse-existing-tabs-label"),
    reuseExistingTabsDesc: document.getElementById("reuse-existing-tabs-desc"),
    openOptionsBtn: document.getElementById("open-options-btn"),
    clearHistoryBtn: document.getElementById("clear-history-btn"),
    exportJsonBtn: document.getElementById("export-json-btn"),
    importJsonBtn: document.getElementById("import-json-btn"),
    importJsonInput: document.getElementById("import-json-input"),
    waitMultiplierLabel: document.getElementById("wait-multiplier-label"),
    waitMultiplierRange: document.getElementById("wait-multiplier-range"),
    waitMultiplierValue: document.getElementById("wait-multiplier-value")
  },
  serviceManagement: {
    serviceManagementTitle: document.getElementById("service-management-title"),
    serviceManagementDesc: document.getElementById("service-management-desc"),
    addServiceBtn: document.getElementById("add-service-btn"),
    resetSitesBtn: document.getElementById("reset-sites-btn"),
    managedSitesList: document.getElementById("managed-sites-list"),
    serviceEditor: document.getElementById("service-editor"),
    serviceEditorTitle: document.getElementById("service-editor-title"),
    serviceEditorDesc: document.getElementById("service-editor-desc"),
    serviceNameLabel: document.getElementById("service-name-label"),
    serviceNameInput: document.getElementById("service-name-input"),
    serviceUrlLabel: document.getElementById("service-url-label"),
    serviceUrlInput: document.getElementById("service-url-input"),
    serviceInputSelectorLabel: document.getElementById("service-input-selector-label"),
    serviceInputSelectorInput: document.getElementById("service-input-selector-input"),
    testSelectorBtn: document.getElementById("test-selector-btn"),
    serviceInputTypeLabel: document.getElementById("service-input-type-label"),
    serviceSubmitSelectorLabel: document.getElementById("service-submit-selector-label"),
    serviceSubmitSelectorInput: document.getElementById("service-submit-selector-input"),
    serviceSubmitMethodLabel: document.getElementById("service-submit-method-label"),
    serviceSubmitMethodSelect: document.getElementById("service-submit-method-select"),
    serviceAdvancedTitle: document.getElementById("service-advanced-title"),
    serviceFallbackSelectorsLabel: document.getElementById("service-fallback-selectors-label"),
    serviceFallbackSelectorsInput: document.getElementById("service-fallback-selectors-input"),
    serviceAuthSelectorsLabel: document.getElementById("service-auth-selectors-label"),
    serviceAuthSelectorsInput: document.getElementById("service-auth-selectors-input"),
    serviceHostnameAliasesLabel: document.getElementById("service-hostname-aliases-label"),
    serviceHostnameAliasesInput: document.getElementById("service-hostname-aliases-input"),
    servicePermissionPreview: document.getElementById("service-permission-preview"),
    serviceLastVerifiedLabel: document.getElementById("service-last-verified-label"),
    serviceLastVerifiedInput: document.getElementById("service-last-verified-input"),
    serviceVerifiedVersionLabel: document.getElementById("service-verified-version-label"),
    serviceVerifiedVersionInput: document.getElementById("service-verified-version-input"),
    serviceWaitLabel: document.getElementById("service-wait-label"),
    serviceWaitRange: document.getElementById("service-wait-range"),
    serviceWaitValue: document.getElementById("service-wait-value"),
    serviceColorLabel: document.getElementById("service-color-label"),
    serviceColorInput: document.getElementById("service-color-input"),
    serviceIconLabel: document.getElementById("service-icon-label"),
    serviceIconInput: document.getElementById("service-icon-input"),
    serviceEnabledLabel: document.getElementById("service-enabled-label"),
    serviceEnabledInput: document.getElementById("service-enabled-input"),
    serviceTestResult: document.getElementById("service-test-result"),
    serviceEditorError: document.getElementById("service-editor-error"),
    serviceEditorCancel: document.getElementById("service-editor-cancel"),
    serviceEditorSave: document.getElementById("service-editor-save")
  },
  modals: {
    templateModal: document.getElementById("template-modal"),
    templateModalTitle: document.getElementById("template-modal-title"),
    templateModalDesc: document.getElementById("template-modal-desc"),
    templateModalClose: document.getElementById("template-modal-close"),
    templateModalSystemInfo: document.getElementById("template-modal-system-info"),
    templateFields: document.getElementById("template-fields"),
    templatePreviewLabel: document.getElementById("template-preview-label"),
    templatePreview: document.getElementById("template-preview"),
    templateModalError: document.getElementById("template-modal-error"),
    templateModalCancel: document.getElementById("template-modal-cancel"),
    templateModalConfirm: document.getElementById("template-modal-confirm"),
    favoriteModal: document.getElementById("favorite-modal"),
    favoriteModalTitle: document.getElementById("favorite-modal-title"),
    favoriteModalDesc: document.getElementById("favorite-modal-desc"),
    favoriteModalClose: document.getElementById("favorite-modal-close"),
    favoriteTitleLabel: document.getElementById("favorite-title-label"),
    favoriteTitleInput: document.getElementById("favorite-title-input"),
    favoriteModeLabel: document.getElementById("favorite-mode-label"),
    favoriteModeSelect: document.getElementById("favorite-mode-select"),
    favoritePromptWrap: document.getElementById("favorite-prompt-wrap"),
    favoritePromptLabel: document.getElementById("favorite-prompt-label"),
    favoritePromptInput: document.getElementById("favorite-prompt-input"),
    favoriteTargetsLabel: document.getElementById("favorite-targets-label"),
    favoriteTargetsList: document.getElementById("favorite-targets-list"),
    favoriteTagsLabel: document.getElementById("favorite-tags-label"),
    favoriteTagsInput: document.getElementById("favorite-tags-input"),
    favoriteFolderLabel: document.getElementById("favorite-folder-label"),
    favoriteFolderInput: document.getElementById("favorite-folder-input"),
    favoritePinnedInput: document.getElementById("favorite-pinned-input"),
    favoritePinnedLabel: document.getElementById("favorite-pinned-label"),
    favoriteScheduleEnabledRow: document.getElementById("favorite-schedule-enabled-row"),
    favoriteScheduleEnabled: document.getElementById("favorite-schedule-enabled"),
    favoriteScheduleEnabledLabel: document.getElementById("favorite-schedule-enabled-label"),
    favoriteScheduleFields: document.getElementById("favorite-schedule-fields"),
    favoriteScheduledAtLabel: document.getElementById("favorite-scheduled-at-label"),
    favoriteScheduledAtInput: document.getElementById("favorite-scheduled-at-input"),
    favoriteScheduleRepeatLabel: document.getElementById("favorite-schedule-repeat-label"),
    favoriteScheduleRepeatSelect: document.getElementById("favorite-schedule-repeat-select"),
    favoriteSaveDefaultsRow: document.getElementById("favorite-save-defaults-row"),
    favoriteSaveDefaults: document.getElementById("favorite-save-defaults"),
    favoriteSaveDefaultsLabel: document.getElementById("favorite-save-defaults-label"),
    favoriteDefaultFieldsWrap: document.getElementById("favorite-default-fields-wrap"),
    favoriteDefaultFieldsLabel: document.getElementById("favorite-default-fields-label"),
    favoriteDefaultFields: document.getElementById("favorite-default-fields"),
    favoriteChainWrap: document.getElementById("favorite-chain-wrap"),
    favoriteChainTitle: document.getElementById("favorite-chain-title"),
    favoriteChainDesc: document.getElementById("favorite-chain-desc"),
    favoriteChainList: document.getElementById("favorite-chain-list"),
    favoriteChainAddStep: document.getElementById("favorite-chain-add-step"),
    favoriteModalError: document.getElementById("favorite-modal-error"),
    favoriteModalCancel: document.getElementById("favorite-modal-cancel"),
    favoriteModalRun: document.getElementById("favorite-modal-run"),
    favoriteModalConfirm: document.getElementById("favorite-modal-confirm"),
    resendModal: document.getElementById("resend-modal"),
    resendModalTitle: document.getElementById("resend-modal-title"),
    resendModalDesc: document.getElementById("resend-modal-desc"),
    resendModalSites: document.getElementById("resend-modal-sites"),
    resendModalClose: document.getElementById("resend-modal-close"),
    resendModalCancel: document.getElementById("resend-modal-cancel"),
    resendModalConfirm: document.getElementById("resend-modal-confirm"),
    importReportModal: document.getElementById("import-report-modal"),
    importReportModalTitle: document.getElementById("import-report-modal-title"),
    importReportModalDesc: document.getElementById("import-report-modal-desc"),
    importReportBody: document.getElementById("import-report-body"),
    importReportModalClose: document.getElementById("import-report-modal-close"),
    importReportModalConfirm: document.getElementById("import-report-modal-confirm")
  },
  toastHost: document.getElementById("toast-host")
};

// src/popup/app/helpers.ts
function escapeAttribute(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function getSiteIcon(site) {
  if (site?.icon) {
    return site.icon;
  }
  return SITE_EMOJI[site?.id] ?? site?.name?.slice(0, 2)?.toUpperCase() ?? "AI";
}
function isTextEditingTarget(target) {
  if (!target || !(target instanceof Element)) {
    return false;
  }
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target.isContentEditable;
}
function compareDateValues(leftValue, rightValue) {
  const leftTime = Date.parse(String(leftValue ?? "")) || 0;
  const rightTime = Date.parse(String(rightValue ?? "")) || 0;
  return rightTime - leftTime;
}
function previewText(text, maxLength = 50) {
  const collapsed = String(text).replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) {
    return collapsed || "-";
  }
  return `${collapsed.slice(0, maxLength)}...`;
}
function formatDate(isoString) {
  try {
    return new Intl.DateTimeFormat(isKorean ? "ko-KR" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(isoString));
  } catch (_error) {
    return isoString;
  }
}
function normalizeSiteIdList2(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim())
    )
  );
}
function joinMultilineValues(values) {
  return Array.isArray(values) ? values.join("\n") : "";
}
function splitMultilineValues(value) {
  return String(value ?? "").split(/\r?\n/g).map((entry) => entry.trim()).filter(Boolean);
}

// src/popup/app/list-markup.ts
function buildEmptyState(message) {
  return `
    <div class="empty-state">
      <div>${escapeHtml(message)}</div>
      <button class="empty-action" type="button" data-switch-tab="compose">${escapeHtml(t.emptyActionCompose)}</button>
    </div>
  `;
}
function getHistorySelectedSiteIds(item) {
  return normalizeSiteIdList2(getTargetSnapshotSiteIds(item));
}
function renderServiceBadges(siteIds = [], runtimeSites = []) {
  return siteIds.map((siteId) => {
    const site = runtimeSites.find((entry) => entry.id === siteId);
    const label = getSiteIcon(site) ?? siteId.slice(0, 2).toUpperCase();
    return `<span class="service-badge">${escapeHtml(label)}</span>`;
  }).join("");
}
function buildHistoryItemMarkup(item, { openMenuKey = null, runtimeSites = [] } = {}) {
  const menuKey = `history:${item.id}`;
  return `
    <article class="prompt-item" data-history-id="${item.id}" role="listitem">
      <button class="prompt-main" type="button" data-load-history="${item.id}">
        <div class="prompt-preview">${escapeHtml(previewText(item.text))}</div>
        <div class="prompt-meta">
          <div class="service-icons">${renderServiceBadges(getHistorySelectedSiteIds(item), runtimeSites)}</div>
          <span>${escapeHtml(formatDate(item.createdAt))}</span>
        </div>
      </button>
      <div class="prompt-actions">
        <button class="menu-button" type="button" aria-haspopup="menu" aria-expanded="${openMenuKey === menuKey ? "true" : "false"}" aria-label="${escapeAttribute(t.menuMore)}" data-toggle-menu="${escapeAttribute(menuKey)}">...</button>
        <div class="item-menu ${openMenuKey === menuKey ? "open" : ""}">
          <button class="menu-item" type="button" data-action="resend-history" data-history-id="${item.id}">${escapeHtml(t.historyResend)}</button>
          <button class="menu-item" type="button" data-action="favorite" data-history-id="${item.id}">${escapeHtml(t.addFavorite)}</button>
          <button class="menu-item danger" type="button" data-action="delete-history" data-history-id="${item.id}">${escapeHtml(t.delete)}</button>
        </div>
      </div>
    </article>
  `;
}
function buildFavoriteTagsMarkup(item) {
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const folder = typeof item.folder === "string" && item.folder.trim() ? item.folder.trim() : "";
  const pinIcon = item.pinned ? `<span class="fav-pin-icon" title="${escapeHtml(msg("popup_favorite_pinned") || "Pinned")}">📌</span>` : "";
  const folderBadge = folder ? `<span class="fav-folder-badge" data-filter-folder="${escapeAttribute(folder)}">📁 ${escapeHtml(folder)}</span>` : "";
  const kindBadge = item?.mode === "chain" ? `<span class="fav-type-badge chain">${escapeHtml(t.favoriteKindChain)}</span>` : `<span class="fav-type-badge">${escapeHtml(t.favoriteKindSingle)}</span>`;
  const scheduleBadge = item?.scheduleEnabled && item?.scheduledAt ? `<span class="fav-schedule-badge">${escapeHtml(t.favoriteScheduledBadge)}</span>` : "";
  const stepCount = item?.mode === "chain" && Array.isArray(item?.steps) && item.steps.length > 0 ? `<span class="fav-step-count">${escapeHtml(t.favoriteStepCount(item.steps.length))}</span>` : "";
  const tagChips = tags.map(
    (tag) => `<span class="fav-tag-chip" data-filter-tag="${escapeAttribute(tag)}">#${escapeHtml(tag)}</span>`
  ).join("");
  if (!pinIcon && !folderBadge && !tagChips && !kindBadge && !scheduleBadge && !stepCount) {
    return "";
  }
  return `<div class="fav-meta-row">${pinIcon}${kindBadge}${scheduleBadge}${stepCount}${folderBadge}${tagChips}</div>`;
}
function buildFavoriteJobMarkup(job) {
  if (!job?.jobId) {
    return "";
  }
  const statusLabel = job.status === "queued" ? msg("favorite_job_status_queued") || "Queued" : job.status === "running" ? msg("favorite_job_status_running") || "Running" : job.status === "completed" ? msg("favorite_job_status_completed") || "Done" : job.status === "failed" ? msg("favorite_job_status_failed") || "Failed" : msg("favorite_job_status_skipped") || "Skipped";
  const detail = job.stepCount > 1 ? `${Math.min(Number(job.completedSteps ?? 0), Number(job.stepCount ?? 0))}/${Number(job.stepCount ?? 0)}` : "";
  return `
    <div class="fav-job-row">
      <span class="fav-job-badge ${escapeAttribute(job.status)}">${escapeHtml(statusLabel)}</span>
      ${detail ? `<span class="fav-job-detail">${escapeHtml(detail)}</span>` : ""}
    </div>
  `;
}
function buildFavoriteItemMarkup(item, { openMenuKey = null, runtimeSites = [], latestJob = null } = {}) {
  const menuKey = `favorite:${item.id}`;
  const safeFavoriteId = escapeAttribute(item.id);
  const pinLabel = item.pinned ? msg("popup_favorite_unpin") || "Unpin" : msg("popup_favorite_pin") || "Pin";
  const primaryAction = item?.mode === "chain" ? "edit-favorite" : "load-favorite";
  return `
    <article class="prompt-item${item.pinned ? " pinned-item" : ""}" data-favorite-id="${safeFavoriteId}" role="listitem">
      <div class="favorite-title-row">
        <span class="favorite-star">${escapeHtml(t.favoriteStar)}</span>
        <input
          class="favorite-title-input"
          type="text"
          data-favorite-title="${safeFavoriteId}"
          value="${escapeAttribute(item.title)}"
          placeholder="${escapeAttribute(t.titlePlaceholder)}"
        />
      </div>
      ${buildFavoriteTagsMarkup(item)}
      ${buildFavoriteJobMarkup(latestJob)}
      <button class="prompt-main" type="button" data-${primaryAction}="${safeFavoriteId}">
        <div class="prompt-preview">${escapeHtml(previewText(item.text))}</div>
        <div class="prompt-meta">
          <div class="service-icons">${renderServiceBadges(item.sentTo, runtimeSites)}</div>
          <span>${escapeHtml(formatDate(item.createdAt))}</span>
        </div>
      </button>
      <div class="prompt-actions">
        <button class="menu-button" type="button" aria-haspopup="menu" aria-expanded="${openMenuKey === menuKey ? "true" : "false"}" aria-label="${escapeAttribute(t.menuMore)}" data-toggle-menu="${escapeAttribute(menuKey)}">...</button>
        <div class="item-menu ${openMenuKey === menuKey ? "open" : ""}">
          <button class="menu-item" type="button" data-action="run-favorite" data-favorite-id="${safeFavoriteId}">${escapeHtml(t.favoriteRunNow)}</button>
          <button class="menu-item" type="button" data-action="edit-favorite" data-favorite-id="${safeFavoriteId}">${escapeHtml(t.favoriteEdit)}</button>
          <button class="menu-item" type="button" data-action="duplicate-favorite" data-favorite-id="${safeFavoriteId}">${escapeHtml(t.favoriteDuplicate)}</button>
          <button class="menu-item" type="button" data-action="toggle-pin-favorite" data-favorite-id="${safeFavoriteId}">${escapeHtml(pinLabel)}</button>
          <button class="menu-item danger" type="button" data-action="delete-favorite" data-favorite-id="${safeFavoriteId}">${escapeHtml(t.delete)}</button>
        </div>
      </div>
    </article>
  `;
}
function buildImportReportMarkup(summary) {
  if (!summary) {
    return "";
  }
  const rejectedRows = (summary.customSites?.rejected ?? []).map((entry) => {
    const origins = Array.isArray(entry?.origins) && entry.origins.length > 0 ? `<div class="helper-text">${escapeHtml(entry.origins.join(", "))}</div>` : "";
    const errors = Array.isArray(entry?.errors) && entry.errors.length > 0 ? `<div class="helper-text">${escapeHtml(entry.errors.join(" "))}</div>` : "";
    return `
      <div class="import-report-row">
        <strong>${escapeHtml(entry?.name ?? entry?.id ?? "-")}</strong>
        <div>${escapeHtml(t.importRejectReason(entry?.reason ?? "unknown"))}</div>
        ${origins}
        ${errors}
      </div>
    `;
  }).join("");
  return `
    <div class="import-report-grid">
      <div class="import-report-row"><strong>${escapeHtml(t.importReportVersion)}</strong><div>${escapeHtml(`v${summary.version} (from v${summary.migratedFromVersion})`)}</div></div>
      <div class="import-report-row"><strong>${escapeHtml(t.importReportAccepted)}</strong><div>${escapeHtml(String(summary.customSites?.acceptedNames?.join(", ") || "-"))}</div></div>
      <div class="import-report-row"><strong>${escapeHtml(t.importReportRewritten)}</strong><div>${escapeHtml(String(summary.customSites?.rewrittenIds?.join(", ") || "-"))}</div></div>
      <div class="import-report-row"><strong>${escapeHtml(t.importReportBuiltins)}</strong><div>${escapeHtml([
    ...summary.builtInSiteOverrides?.adjustedIds ?? [],
    ...summary.builtInSiteOverrides?.droppedIds ?? [],
    ...summary.builtInSiteStates?.droppedIds ?? []
  ].join(", ") || "-")}</div></div>
      <div class="import-report-section-title">${escapeHtml(t.importReportRejected)}</div>
      ${rejectedRows || `<div class="helper-text">${escapeHtml(t.importReportRejectedEmpty)}</div>`}
    </div>
  `;
}

// src/popup/app/sorting.ts
function getHistorySortOptions() {
  return [
    { value: "latest", label: t.historySortLatest },
    { value: "oldest", label: t.historySortOldest },
    { value: "mostSuccess", label: t.historySortMostSuccess },
    { value: "mostFailure", label: t.historySortMostFailure }
  ];
}
function getFavoriteSortOptions() {
  return [
    { value: "recentUsed", label: t.favoriteSortRecentUsed },
    { value: "usageCount", label: t.favoriteSortUsageCount },
    { value: "title", label: t.favoriteSortTitle },
    { value: "createdAt", label: t.favoriteSortCreatedAt }
  ];
}
function compareFavoriteTitle(left, right) {
  return String(left?.title ?? "").localeCompare(String(right?.title ?? ""), isKorean ? "ko" : "en", {
    sensitivity: "base"
  });
}
function sortHistoryItemsForDisplay(items, historySort = "latest") {
  const nextItems = [...items];
  switch (historySort) {
    case "oldest":
      return nextItems.sort((left, right) => compareDateValues(right.createdAt, left.createdAt));
    case "mostSuccess":
      return nextItems.sort((left, right) => {
        const leftCount = Array.isArray(left?.submittedSiteIds) ? left.submittedSiteIds.length : 0;
        const rightCount = Array.isArray(right?.submittedSiteIds) ? right.submittedSiteIds.length : 0;
        return rightCount - leftCount || compareDateValues(left.createdAt, right.createdAt);
      });
    case "mostFailure":
      return nextItems.sort((left, right) => {
        const leftCount = Array.isArray(left?.failedSiteIds) ? left.failedSiteIds.length : 0;
        const rightCount = Array.isArray(right?.failedSiteIds) ? right.failedSiteIds.length : 0;
        return rightCount - leftCount || compareDateValues(left.createdAt, right.createdAt);
      });
    case "latest":
    default:
      return nextItems.sort((left, right) => compareDateValues(left.createdAt, right.createdAt));
  }
}
function sortFavoriteItemsForDisplay(items, favoriteSort = "recentUsed") {
  const nextItems = [...items];
  nextItems.sort((left, right) => {
    if (left.pinned && !right.pinned) {
      return -1;
    }
    if (!left.pinned && right.pinned) {
      return 1;
    }
    switch (favoriteSort) {
      case "usageCount":
        return (Number(right?.usageCount) || 0) - (Number(left?.usageCount) || 0) || compareDateValues(left.lastUsedAt ?? left.favoritedAt, right.lastUsedAt ?? right.favoritedAt);
      case "title":
        return compareFavoriteTitle(left, right) || compareDateValues(left.favoritedAt, right.favoritedAt);
      case "createdAt":
        return compareDateValues(left.createdAt, right.createdAt);
      case "recentUsed":
      default:
        return compareDateValues(left.lastUsedAt ?? left.favoritedAt, right.lastUsedAt ?? right.favoritedAt);
    }
  });
  return nextItems;
}

// src/popup/features/favorite-editor.ts
var { promptInput } = popupDom.compose;
var {
  favoriteModal,
  favoriteModalTitle,
  favoriteModalDesc,
  favoriteModalClose,
  favoriteTitleLabel,
  favoriteTitleInput,
  favoriteModeLabel,
  favoriteModeSelect,
  favoritePromptWrap,
  favoritePromptLabel,
  favoritePromptInput,
  favoriteTargetsLabel,
  favoriteTargetsList,
  favoriteTagsLabel,
  favoriteTagsInput,
  favoriteFolderLabel,
  favoriteFolderInput,
  favoritePinnedInput,
  favoritePinnedLabel,
  favoriteScheduleEnabled,
  favoriteScheduleEnabledLabel,
  favoriteScheduleFields,
  favoriteScheduledAtLabel,
  favoriteScheduledAtInput,
  favoriteScheduleRepeatLabel,
  favoriteScheduleRepeatSelect,
  favoriteSaveDefaults,
  favoriteSaveDefaultsLabel,
  favoriteSaveDefaultsRow,
  favoriteDefaultFieldsWrap,
  favoriteDefaultFieldsLabel,
  favoriteDefaultFields,
  favoriteChainWrap,
  favoriteChainTitle,
  favoriteChainDesc,
  favoriteChainList,
  favoriteChainAddStep,
  favoriteModalError,
  favoriteModalCancel,
  favoriteModalRun,
  favoriteModalConfirm
} = popupDom.modals;
function compactVariableValues(values) {
  return Object.fromEntries(
    Object.entries(values ?? {}).map(([name, value]) => [String(name), String(value ?? "")]).filter(([, value]) => value.trim())
  );
}
function mergeTemplateSources(...sources) {
  return Object.assign({}, ...sources.filter(Boolean));
}
function createFavoriteEditorFeature(deps) {
  const {
    checkedSiteIds: checkedSiteIds2,
    getEnabledSites: getEnabledSites2,
    getRuntimeSiteLabel: getRuntimeSiteLabel2,
    refreshStoredData: refreshStoredData2,
    requestFavoriteRun: requestFavoriteRun2,
    setStatus: setStatus2,
    showAppToast: showAppToast2,
    getUnknownErrorText: getUnknownErrorText2,
    openOverlay: openOverlay2,
    closeOverlay: closeOverlay2
  } = deps;
  function createFavoriteEditorStep(text = "", targetSiteIds = [], delayMs = 0, preferredId = "") {
    return {
      id: typeof preferredId === "string" && preferredId.trim() ? preferredId.trim() : `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: String(text ?? ""),
      delayMs: Math.max(0, Math.round(Number(delayMs) || 0)),
      targetSiteIds: normalizeSiteIdList2(targetSiteIds)
    };
  }
  function toLocalDateTimeInputValue(isoString = "") {
    const time = Date.parse(String(isoString ?? ""));
    if (!Number.isFinite(time)) {
      return "";
    }
    const date = new Date(time);
    const pad = (value) => String(value).padStart(2, "0");
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  function toIsoDateTime(value = "") {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }
  function collectFavoriteEditorVariables(modalState) {
    const templates = modalState.mode === "chain" ? modalState.steps.map((step) => step.text) : [modalState.prompt];
    const seen = /* @__PURE__ */ new Set();
    return templates.flatMap((template) => detectTemplateVariables(template)).filter((variable) => variable.kind === "user").filter((variable) => {
      if (seen.has(variable.name)) {
        return false;
      }
      seen.add(variable.name);
      return true;
    });
  }
  function syncFavoriteEditorVariables(modalState) {
    const variables = collectFavoriteEditorVariables(modalState);
    const nextDefaults = {};
    variables.forEach((variable) => {
      nextDefaults[variable.name] = modalState.defaultValues?.[variable.name] ?? "";
    });
    modalState.variables = variables;
    modalState.defaultValues = nextDefaults;
    if (variables.length === 0) {
      modalState.saveDefaults = false;
    }
  }
  function syncFavoriteVariableUi(modalState) {
    syncFavoriteEditorVariables(modalState);
    favoriteSaveDefaults.checked = modalState.saveDefaults;
    favoriteSaveDefaultsRow.hidden = modalState.variables.length === 0;
    renderFavoriteDefaultFields();
  }
  function getFirstNonEmptyStepText(steps = []) {
    return steps.find((step) => step?.text?.trim())?.text ?? "";
  }
  function buildFavoriteTargetChecklist(selectedSiteIds = [], { stepId = "" } = {}) {
    const selected = new Set(normalizeSiteIdList2(selectedSiteIds));
    return getEnabledSites2().map((site) => {
      const checked = selected.has(site.id);
      const attributeName = stepId ? "data-favorite-step-target" : "data-favorite-target";
      return `
          <label class="checkbox-chip">
            <input
              type="checkbox"
              ${attributeName}="${escapeAttribute(stepId || site.id)}"
              data-site-id="${escapeAttribute(site.id)}"
              ${checked ? "checked" : ""}
            />
            <span>${escapeHtml(getRuntimeSiteLabel2(site.id))}</span>
          </label>
        `;
    }).join("");
  }
  function renderFavoriteTargets() {
    const modalState = state.pendingFavoriteSave;
    if (!modalState) {
      favoriteTargetsList.innerHTML = "";
      return;
    }
    favoriteTargetsList.innerHTML = buildFavoriteTargetChecklist(modalState.sites);
  }
  function renderFavoriteChainList() {
    const modalState = state.pendingFavoriteSave;
    if (!modalState || modalState.mode !== "chain") {
      favoriteChainList.innerHTML = "";
      favoriteChainWrap.hidden = true;
      return;
    }
    favoriteChainWrap.hidden = false;
    favoriteChainList.innerHTML = modalState.steps.map((step, index) => `
        <article class="favorite-step-card" data-favorite-step-id="${escapeAttribute(step.id)}">
          <div class="section-row section-row-start">
            <strong>${escapeHtml(t.favoriteStepLabel(index + 1))}</strong>
            <div class="favorite-step-actions">
              <button class="ghost-button small-button" type="button" data-favorite-step-move="${escapeAttribute(step.id)}" data-direction="up" ${index === 0 ? "disabled" : ""}>${escapeHtml(t.favoriteStepMoveUp)}</button>
              <button class="ghost-button small-button" type="button" data-favorite-step-move="${escapeAttribute(step.id)}" data-direction="down" ${index === modalState.steps.length - 1 ? "disabled" : ""}>${escapeHtml(t.favoriteStepMoveDown)}</button>
              <button class="ghost-button danger-button small-button" type="button" data-favorite-step-delete="${escapeAttribute(step.id)}">${escapeHtml(t.delete)}</button>
            </div>
          </div>
          <label class="field-stack">
            <span>${escapeHtml(t.favoriteStepPromptLabel)}</span>
            <textarea class="search-input textarea-input" rows="3" data-favorite-step-text="${escapeAttribute(step.id)}">${escapeHtml(step.text)}</textarea>
          </label>
          <label class="field-stack">
            <span>${escapeHtml(t.favoriteStepDelayLabel)}</span>
            <input class="search-input" type="number" min="0" step="100" data-favorite-step-delay="${escapeAttribute(step.id)}" value="${escapeAttribute(String(step.delayMs))}" />
          </label>
          <div class="modal-section">
            <div class="section-row section-row-start">
              <strong>${escapeHtml(t.favoriteStepTargetsLabel)}</strong>
            </div>
            <div class="favorite-targets-list">
              ${buildFavoriteTargetChecklist(step.targetSiteIds, { stepId: step.id })}
            </div>
            <p class="helper-text">${escapeHtml(t.favoriteStepTargetsHint)}</p>
          </div>
        </article>
      `).join("");
  }
  function renderFavoriteDefaultFields() {
    const modalState = state.pendingFavoriteSave;
    if (!modalState) {
      favoriteDefaultFieldsWrap.hidden = true;
      favoriteDefaultFields.innerHTML = "";
      return;
    }
    const showDefaults = modalState.variables.length > 0 && modalState.saveDefaults;
    favoriteDefaultFieldsWrap.hidden = !showDefaults;
    if (!showDefaults) {
      favoriteDefaultFields.innerHTML = "";
      return;
    }
    favoriteDefaultFields.innerHTML = modalState.variables.map((variable) => {
      const value = modalState.defaultValues[variable.name] ?? "";
      return `
          <label class="field-stack">
            <span>${escapeHtml(variable.name)}</span>
            <input
              class="search-input"
              type="text"
              data-favorite-default-input="${escapeAttribute(variable.name)}"
              value="${escapeAttribute(value)}"
              placeholder="${escapeAttribute(t.templateFieldPlaceholder(variable.name))}"
            />
          </label>
        `;
    }).join("");
  }
  function renderFavoriteModal() {
    const modalState = state.pendingFavoriteSave;
    if (!modalState) {
      return;
    }
    syncFavoriteEditorVariables(modalState);
    favoriteModalTitle.textContent = modalState.favoriteId ? t.favoriteEditTitle : t.favoriteModalTitle;
    favoriteModalDesc.textContent = modalState.favoriteId ? t.favoriteEditDesc : t.favoriteModalDesc;
    favoriteModalCancel.textContent = t.favoriteModalCancel;
    favoriteModalConfirm.textContent = modalState.favoriteId ? t.favoriteModalSaveChanges : t.favoriteModalConfirm;
    favoriteModalRun.textContent = t.favoriteRunNow;
    favoriteModalRun.hidden = !modalState.favoriteId;
    favoriteTitleLabel.textContent = t.favoriteTitleLabel;
    favoriteModeLabel.textContent = t.favoriteModeLabel;
    favoriteTargetsLabel.textContent = t.favoriteTargetsLabel;
    favoritePromptLabel.textContent = t.favoritePromptLabel;
    favoriteTagsLabel.textContent = t.favoriteTagsLabel;
    favoriteFolderLabel.textContent = t.favoriteFolderLabel;
    favoritePinnedLabel.textContent = t.favoritePinnedLabel;
    favoriteScheduleEnabledLabel.textContent = t.favoriteScheduleEnabledLabel;
    favoriteScheduledAtLabel.textContent = t.favoriteScheduledAtLabel;
    favoriteScheduleRepeatLabel.textContent = t.favoriteScheduleRepeatLabel;
    favoriteSaveDefaultsLabel.textContent = t.favoriteSaveDefaultsLabel;
    favoriteDefaultFieldsLabel.textContent = t.favoriteDefaultsLabel;
    favoriteChainTitle.textContent = t.favoriteChainTitle;
    favoriteChainDesc.textContent = t.favoriteChainDesc;
    favoriteChainAddStep.textContent = t.favoriteChainAddStep;
    favoriteTitleInput.value = modalState.title;
    favoriteModeSelect.innerHTML = [
      `<option value="single">${escapeHtml(t.favoriteModeSingle)}</option>`,
      `<option value="chain">${escapeHtml(t.favoriteModeChain)}</option>`
    ].join("");
    favoriteModeSelect.value = modalState.mode;
    favoritePromptWrap.hidden = modalState.mode !== "single";
    favoritePromptInput.value = modalState.prompt;
    favoriteTagsInput.value = modalState.tags.join(", ");
    favoriteFolderInput.value = modalState.folder;
    favoritePinnedInput.checked = Boolean(modalState.pinned);
    favoriteScheduleEnabled.checked = Boolean(modalState.scheduleEnabled);
    favoriteScheduledAtInput.value = toLocalDateTimeInputValue(modalState.scheduledAt);
    favoriteScheduleRepeatSelect.innerHTML = [
      `<option value="none">${escapeHtml(t.favoriteScheduleRepeatNone)}</option>`,
      `<option value="daily">${escapeHtml(t.favoriteScheduleRepeatDaily)}</option>`,
      `<option value="weekday">${escapeHtml(t.favoriteScheduleRepeatWeekday)}</option>`,
      `<option value="weekly">${escapeHtml(t.favoriteScheduleRepeatWeekly)}</option>`
    ].join("");
    favoriteScheduleRepeatSelect.value = modalState.scheduleRepeat;
    favoriteScheduleFields.hidden = !modalState.scheduleEnabled;
    favoriteSaveDefaults.checked = modalState.saveDefaults;
    favoriteSaveDefaultsRow.hidden = modalState.variables.length === 0;
    renderFavoriteTargets();
    renderFavoriteChainList();
    renderFavoriteDefaultFields();
  }
  function buildFavoriteEditorStateFromItem(item) {
    const baseDefaults = mergeTemplateSources(
      state.templateVariableCache,
      item?.templateDefaults ?? {}
    );
    const mode = item?.mode === "chain" ? "chain" : "single";
    const steps = mode === "chain" && Array.isArray(item?.steps) && item.steps.length > 0 ? item.steps.map((step) => createFavoriteEditorStep(step.text, step.targetSiteIds, step.delayMs, step.id)) : mode === "chain" ? [createFavoriteEditorStep(item?.text ?? "", [], 0)] : [];
    const stateValue = {
      favoriteId: item?.id ?? null,
      prompt: item?.text ?? "",
      sites: normalizeSiteIdList2(item?.sentTo),
      variables: [],
      title: item?.title ?? "",
      saveDefaults: Boolean(item?.templateDefaults && Object.keys(item.templateDefaults).length > 0),
      defaultValues: { ...baseDefaults },
      tags: Array.isArray(item?.tags) ? [...item.tags] : [],
      folder: item?.folder ?? "",
      pinned: Boolean(item?.pinned),
      mode,
      steps,
      scheduleEnabled: Boolean(item?.scheduleEnabled),
      scheduledAt: item?.scheduledAt ?? null,
      scheduleRepeat: item?.scheduleRepeat ?? "none"
    };
    syncFavoriteEditorVariables(stateValue);
    return stateValue;
  }
  function getFavoriteById2(favoriteId) {
    return state.favorites.find((entry) => String(entry.id) === String(favoriteId)) ?? null;
  }
  function setFavoriteModalError2(message = "") {
    favoriteModalError.hidden = !message;
    favoriteModalError.textContent = message;
  }
  function hideFavoriteModal2() {
    state.pendingFavoriteSave = null;
    state.pendingFavoriteRunReason = "";
    closeOverlay2(favoriteModal);
    favoriteModalError.hidden = true;
    favoriteModalError.textContent = "";
    favoriteTitleInput.value = "";
    favoriteSaveDefaults.checked = false;
    favoriteSaveDefaultsRow.hidden = true;
    favoriteDefaultFieldsWrap.hidden = true;
    favoriteDefaultFields.innerHTML = "";
    favoritePromptInput.value = "";
  }
  function dismissFavoriteModal2(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    hideFavoriteModal2();
  }
  async function openFavoriteModal2() {
    clearStatus2();
    const prompt = promptInput.value.trim();
    if (!prompt) {
      setStatus2(t.warnEmpty, "error");
      promptInput.focus();
      return;
    }
    const loadedFavorite = state.loadedFavoriteId ? getFavoriteById2(state.loadedFavoriteId) : null;
    const currentItem = loadedFavorite ? {
      ...loadedFavorite,
      text: prompt,
      sentTo: checkedSiteIds2(),
      templateDefaults: state.loadedTemplateDefaults
    } : {
      id: state.loadedFavoriteId || null,
      title: state.loadedFavoriteTitle,
      text: prompt,
      sentTo: checkedSiteIds2(),
      templateDefaults: state.loadedTemplateDefaults,
      tags: [],
      folder: "",
      pinned: false,
      mode: "single",
      steps: [],
      scheduleEnabled: false,
      scheduledAt: null,
      scheduleRepeat: "none"
    };
    state.pendingFavoriteSave = buildFavoriteEditorStateFromItem(currentItem);
    setFavoriteModalError2("");
    state.pendingFavoriteRunReason = "";
    renderFavoriteModal();
    openOverlay2(favoriteModal, favoriteTitleInput);
    window.requestAnimationFrame(() => favoriteTitleInput.select());
  }
  function openFavoriteEditor2(item, { reason = "" } = {}) {
    state.pendingFavoriteSave = buildFavoriteEditorStateFromItem(item);
    state.pendingFavoriteRunReason = reason || "";
    setFavoriteModalError2(reason);
    renderFavoriteModal();
    openOverlay2(favoriteModal, favoriteTitleInput);
  }
  async function persistFavoriteEditorChanges() {
    const modalState = state.pendingFavoriteSave;
    if (!modalState) {
      return null;
    }
    modalState.title = favoriteTitleInput.value.trim();
    modalState.mode = favoriteModeSelect.value === "chain" ? "chain" : "single";
    if (modalState.mode === "single") {
      modalState.prompt = favoritePromptInput.value;
    }
    modalState.tags = favoriteTagsInput.value.split(",").map((entry) => entry.trim()).filter(Boolean);
    modalState.folder = favoriteFolderInput.value.trim();
    modalState.pinned = favoritePinnedInput.checked;
    modalState.scheduleEnabled = favoriteScheduleEnabled.checked;
    modalState.scheduledAt = modalState.scheduleEnabled ? toIsoDateTime(favoriteScheduledAtInput.value) : null;
    modalState.scheduleRepeat = favoriteScheduleRepeatSelect.value || "none";
    modalState.saveDefaults = favoriteSaveDefaults.checked;
    syncFavoriteEditorVariables(modalState);
    if (modalState.scheduleEnabled && !modalState.scheduledAt) {
      setFavoriteModalError2(t.favoriteScheduleDateRequired);
      return null;
    }
    if (modalState.mode === "chain") {
      modalState.steps = modalState.steps.map((step) => createFavoriteEditorStep(step.text, step.targetSiteIds, step.delayMs, step.id)).filter((step) => step.text.trim());
      if (modalState.steps.length === 0) {
        setFavoriteModalError2(t.favoriteChainNeedsStep);
        return null;
      }
    } else {
      if (!modalState.prompt.trim()) {
        setFavoriteModalError2(t.warnEmpty);
        return null;
      }
    }
    const templateDefaults = modalState.saveDefaults ? compactVariableValues(modalState.defaultValues) : {};
    if (modalState.saveDefaults) {
      await updateTemplateVariableCache(templateDefaults);
      state.templateVariableCache = mergeTemplateSources(state.templateVariableCache, templateDefaults);
    }
    const favoritePayload = {
      title: modalState.title,
      text: modalState.mode === "chain" ? modalState.steps[0]?.text ?? modalState.prompt ?? "" : modalState.prompt,
      sentTo: modalState.sites,
      templateDefaults,
      tags: modalState.tags,
      folder: modalState.folder,
      pinned: modalState.pinned,
      mode: modalState.mode,
      steps: modalState.mode === "chain" ? modalState.steps : [],
      scheduleEnabled: modalState.scheduleEnabled,
      scheduledAt: modalState.scheduleEnabled ? modalState.scheduledAt : null,
      scheduleRepeat: modalState.scheduleEnabled ? modalState.scheduleRepeat : "none"
    };
    let favorite = null;
    if (modalState.favoriteId) {
      favorite = await updateFavoritePrompt(modalState.favoriteId, favoritePayload);
    } else {
      favorite = await createFavoritePrompt(favoritePayload);
      modalState.favoriteId = favorite?.id ?? null;
    }
    await refreshStoredData2();
    return favorite;
  }
  async function confirmFavoriteSave() {
    const favorite = await persistFavoriteEditorChanges();
    if (!favorite) {
      return;
    }
    hideFavoriteModal2();
    setStatus2(t.favoriteSaved, "success");
    showAppToast2(t.favoriteSaved, "success", 2200);
  }
  async function runFavoriteItem2(item, { reason = "" } = {}) {
    if (!item?.id) {
      return;
    }
    const response = await requestFavoriteRun2(item, {
      trigger: "popup",
      allowPopupFallback: false
    });
    if (response?.ok) {
      state.openMenuKey = null;
      const message = response?.message ?? t.favoriteRunQueued;
      setStatus2(message, "success");
      showAppToast2(message, "success", 2200);
      return;
    }
    if (response?.requiresPopupInput) {
      state.openMenuKey = null;
      openFavoriteEditor2(item, { reason: response?.error || reason || t.favoriteRunNeedsEditor });
      return;
    }
    throw new Error(response?.error ?? getUnknownErrorText2());
  }
  async function runFavoriteFromEditor2() {
    const favorite = await persistFavoriteEditorChanges();
    if (!favorite?.id) {
      return;
    }
    const response = await requestFavoriteRun2(favorite, {
      trigger: "popup",
      allowPopupFallback: false
    });
    if (response?.ok) {
      hideFavoriteModal2();
      const message = response?.message ?? t.favoriteRunQueued;
      setStatus2(message, "success");
      showAppToast2(message, "success", 2200);
      return;
    }
    if (response?.requiresPopupInput) {
      setFavoriteModalError2(response?.error ?? t.favoriteRunNeedsEditor);
      return;
    }
    setFavoriteModalError2(response?.error ?? getUnknownErrorText2());
  }
  function bindFavoriteEditorEvents2() {
    favoriteModalClose.addEventListener("click", dismissFavoriteModal2);
    favoriteModalCancel.addEventListener("click", dismissFavoriteModal2);
    favoriteModal.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const dismissButton = target?.closest("[data-dismiss-favorite-modal]");
      if (dismissButton || target === favoriteModal) {
        dismissFavoriteModal2(event);
      }
    });
    favoriteModal.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !favoriteModal.hidden) {
        dismissFavoriteModal2(event);
      }
    });
    favoriteSaveDefaults.addEventListener("change", () => {
      if (!state.pendingFavoriteSave) {
        return;
      }
      state.pendingFavoriteSave.saveDefaults = favoriteSaveDefaults.checked;
      renderFavoriteDefaultFields();
    });
    favoriteDefaultFields.addEventListener("input", (event) => {
      const input = event.target.closest("[data-favorite-default-input]");
      if (!input || !state.pendingFavoriteSave) {
        return;
      }
      state.pendingFavoriteSave.defaultValues[input.dataset.favoriteDefaultInput] = input.value;
    });
    favoriteModeSelect.addEventListener("change", () => {
      const modalState = state.pendingFavoriteSave;
      if (!modalState) {
        return;
      }
      const nextMode = favoriteModeSelect.value === "chain" ? "chain" : "single";
      if (nextMode === modalState.mode) {
        return;
      }
      if (nextMode === "chain") {
        const seedText = favoritePromptInput.value || modalState.prompt || promptInput.value || "";
        modalState.prompt = seedText;
        if (modalState.steps.length === 0) {
          modalState.steps = [createFavoriteEditorStep(seedText, [], 0)];
        } else if (!modalState.steps.some((step) => step.text.trim())) {
          modalState.steps = [createFavoriteEditorStep(seedText, [], 0)];
        }
      } else {
        modalState.prompt = getFirstNonEmptyStepText(modalState.steps) || favoritePromptInput.value || modalState.prompt;
      }
      modalState.mode = nextMode;
      setFavoriteModalError2("");
      renderFavoriteModal();
    });
    favoriteScheduleEnabled.addEventListener("change", () => {
      const modalState = state.pendingFavoriteSave;
      if (!modalState) {
        return;
      }
      modalState.scheduleEnabled = favoriteScheduleEnabled.checked;
      if (modalState.scheduleEnabled && !modalState.scheduledAt) {
        const defaultDate = new Date(Date.now() + 10 * 60 * 1e3);
        modalState.scheduledAt = defaultDate.toISOString();
        favoriteScheduledAtInput.value = toLocalDateTimeInputValue(modalState.scheduledAt);
      }
      favoriteScheduleFields.hidden = !modalState.scheduleEnabled;
    });
    favoriteScheduledAtInput.addEventListener("change", () => {
      if (!state.pendingFavoriteSave) {
        return;
      }
      state.pendingFavoriteSave.scheduledAt = toIsoDateTime(favoriteScheduledAtInput.value);
    });
    favoriteScheduleRepeatSelect.addEventListener("change", () => {
      if (!state.pendingFavoriteSave) {
        return;
      }
      state.pendingFavoriteSave.scheduleRepeat = favoriteScheduleRepeatSelect.value || "none";
    });
    favoritePromptInput.addEventListener("input", () => {
      const modalState = state.pendingFavoriteSave;
      if (!modalState) {
        return;
      }
      modalState.prompt = favoritePromptInput.value;
      syncFavoriteVariableUi(modalState);
      setFavoriteModalError2("");
    });
    favoriteTargetsList.addEventListener("change", (event) => {
      const target = event.target.closest("[data-favorite-target][data-site-id]");
      if (!target || !state.pendingFavoriteSave) {
        return;
      }
      const siteId = target.dataset.siteId;
      const nextSelected = new Set(state.pendingFavoriteSave.sites);
      if (target.checked) {
        nextSelected.add(siteId);
      } else {
        nextSelected.delete(siteId);
      }
      state.pendingFavoriteSave.sites = [...nextSelected];
    });
    favoriteChainAddStep.addEventListener("click", () => {
      const modalState = state.pendingFavoriteSave;
      if (!modalState) {
        return;
      }
      modalState.steps.push(createFavoriteEditorStep("", [], 0));
      renderFavoriteModal();
      window.requestAnimationFrame(() => {
        const inputs = [...favoriteChainList.querySelectorAll("[data-favorite-step-text]")];
        inputs[inputs.length - 1]?.focus?.();
      });
    });
    favoriteChainList.addEventListener("input", (event) => {
      const modalState = state.pendingFavoriteSave;
      if (!modalState) {
        return;
      }
      const textInput = event.target.closest("[data-favorite-step-text]");
      if (textInput) {
        const step = modalState.steps.find((entry) => entry.id === textInput.dataset.favoriteStepText);
        if (step) {
          step.text = textInput.value;
          syncFavoriteVariableUi(modalState);
        }
        return;
      }
      const delayInput = event.target.closest("[data-favorite-step-delay]");
      if (delayInput) {
        const step = modalState.steps.find((entry) => entry.id === delayInput.dataset.favoriteStepDelay);
        if (step) {
          step.delayMs = Math.max(0, Math.round(Number(delayInput.value) || 0));
        }
      }
    });
    favoriteChainList.addEventListener("change", (event) => {
      const modalState = state.pendingFavoriteSave;
      if (!modalState) {
        return;
      }
      const target = event.target.closest("[data-favorite-step-target][data-site-id]");
      if (!target) {
        return;
      }
      const step = modalState.steps.find((entry) => entry.id === target.dataset.favoriteStepTarget);
      if (!step) {
        return;
      }
      const nextTargets = new Set(step.targetSiteIds);
      if (target.checked) {
        nextTargets.add(target.dataset.siteId);
      } else {
        nextTargets.delete(target.dataset.siteId);
      }
      step.targetSiteIds = [...nextTargets];
    });
    favoriteChainList.addEventListener("click", (event) => {
      const modalState = state.pendingFavoriteSave;
      if (!modalState) {
        return;
      }
      const deleteButton = event.target.closest("[data-favorite-step-delete]");
      if (deleteButton) {
        modalState.steps = modalState.steps.filter((step2) => step2.id !== deleteButton.dataset.favoriteStepDelete);
        renderFavoriteModal();
        return;
      }
      const moveButton = event.target.closest("[data-favorite-step-move]");
      if (!moveButton) {
        return;
      }
      const stepId = moveButton.dataset.favoriteStepMove;
      const index = modalState.steps.findIndex((step2) => step2.id === stepId);
      if (index === -1) {
        return;
      }
      const direction = moveButton.dataset.direction === "down" ? 1 : -1;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= modalState.steps.length) {
        return;
      }
      const [step] = modalState.steps.splice(index, 1);
      modalState.steps.splice(nextIndex, 0, step);
      renderFavoriteModal();
    });
    favoriteModalConfirm.addEventListener("click", () => {
      void confirmFavoriteSave().catch((error) => {
        console.error("[AI Prompt Broadcaster] Favorite save failed.", error);
        setFavoriteModalError2(t.error(error?.message ?? getUnknownErrorText2()));
      });
    });
    favoriteModalRun.addEventListener("click", () => {
      void runFavoriteFromEditor2().catch((error) => {
        console.error("[AI Prompt Broadcaster] Favorite run failed.", error);
        setFavoriteModalError2(t.error(error?.message ?? getUnknownErrorText2()));
      });
    });
  }
  function clearStatus2() {
    setStatus2("");
  }
  return {
    getFavoriteById: getFavoriteById2,
    setFavoriteModalError: setFavoriteModalError2,
    hideFavoriteModal: hideFavoriteModal2,
    dismissFavoriteModal: dismissFavoriteModal2,
    openFavoriteModal: openFavoriteModal2,
    openFavoriteEditor: openFavoriteEditor2,
    confirmFavoriteSave,
    runFavoriteItem: runFavoriteItem2,
    runFavoriteFromEditor: runFavoriteFromEditor2,
    bindFavoriteEditorEvents: bindFavoriteEditorEvents2
  };
}

// src/popup/app/bootstrap.ts
var { extTitle, extDesc } = popupDom.header;
var { tabButtons, panels } = popupDom.tabs;
var {
  promptInput: promptInput2,
  promptCounter,
  clearPromptBtn,
  templateSummary,
  templateSummaryLabel,
  templateChipList,
  sitesLabel,
  sitesContainer,
  toggleAllBtn,
  saveFavoriteBtn,
  cancelSendBtn,
  sendBtn,
  statusMsg
} = popupDom.compose;
var { historySearchInput, historySortSelect, historyList } = popupDom.history;
var { favoritesSearchInput, favoritesSortSelect, favoritesList } = popupDom.favorites;
var {
  settingsTitle,
  settingsDesc,
  reuseExistingTabsToggle,
  reuseExistingTabsLabel,
  reuseExistingTabsDesc,
  openOptionsBtn,
  clearHistoryBtn,
  exportJsonBtn,
  importJsonBtn,
  importJsonInput,
  waitMultiplierLabel,
  waitMultiplierRange,
  waitMultiplierValue
} = popupDom.settings;
var {
  serviceManagementTitle,
  serviceManagementDesc,
  addServiceBtn,
  resetSitesBtn,
  managedSitesList,
  serviceEditor,
  serviceEditorTitle,
  serviceEditorDesc,
  serviceNameLabel,
  serviceNameInput,
  serviceUrlLabel,
  serviceUrlInput,
  serviceInputSelectorLabel,
  serviceInputSelectorInput,
  testSelectorBtn,
  serviceInputTypeLabel,
  serviceSubmitSelectorLabel,
  serviceSubmitSelectorInput,
  serviceSubmitMethodLabel,
  serviceSubmitMethodSelect,
  serviceAdvancedTitle,
  serviceFallbackSelectorsLabel,
  serviceFallbackSelectorsInput,
  serviceAuthSelectorsLabel,
  serviceAuthSelectorsInput,
  serviceHostnameAliasesLabel,
  serviceHostnameAliasesInput,
  servicePermissionPreview,
  serviceLastVerifiedLabel,
  serviceLastVerifiedInput,
  serviceVerifiedVersionLabel,
  serviceVerifiedVersionInput,
  serviceWaitLabel,
  serviceWaitRange,
  serviceWaitValue,
  serviceColorLabel,
  serviceColorInput,
  serviceIconLabel,
  serviceIconInput,
  serviceEnabledLabel,
  serviceEnabledInput,
  serviceTestResult,
  serviceEditorError,
  serviceEditorCancel,
  serviceEditorSave
} = popupDom.serviceManagement;
var {
  templateModal,
  templateModalTitle,
  templateModalDesc,
  templateModalClose,
  templateModalSystemInfo,
  templateFields,
  templatePreviewLabel,
  templatePreview,
  templateModalError,
  templateModalCancel,
  templateModalConfirm,
  favoriteModal: favoriteModal2,
  favoriteModalTitle: favoriteModalTitle2,
  favoriteModalDesc: favoriteModalDesc2,
  favoriteModalClose: favoriteModalClose2,
  favoriteTitleLabel: favoriteTitleLabel2,
  favoriteTitleInput: favoriteTitleInput2,
  favoriteModeLabel: favoriteModeLabel2,
  favoriteModeSelect: favoriteModeSelect2,
  favoriteTargetsLabel: favoriteTargetsLabel2,
  favoriteTargetsList: favoriteTargetsList2,
  favoriteTagsLabel: favoriteTagsLabel2,
  favoriteTagsInput: favoriteTagsInput2,
  favoriteFolderLabel: favoriteFolderLabel2,
  favoriteFolderInput: favoriteFolderInput2,
  favoritePinnedInput: favoritePinnedInput2,
  favoritePinnedLabel: favoritePinnedLabel2,
  favoriteScheduleEnabledRow,
  favoriteScheduleEnabled: favoriteScheduleEnabled2,
  favoriteScheduleEnabledLabel: favoriteScheduleEnabledLabel2,
  favoriteScheduleFields: favoriteScheduleFields2,
  favoriteScheduledAtLabel: favoriteScheduledAtLabel2,
  favoriteScheduledAtInput: favoriteScheduledAtInput2,
  favoriteScheduleRepeatLabel: favoriteScheduleRepeatLabel2,
  favoriteScheduleRepeatSelect: favoriteScheduleRepeatSelect2,
  favoriteSaveDefaultsRow: favoriteSaveDefaultsRow2,
  favoriteSaveDefaults: favoriteSaveDefaults2,
  favoriteSaveDefaultsLabel: favoriteSaveDefaultsLabel2,
  favoriteDefaultFieldsWrap: favoriteDefaultFieldsWrap2,
  favoriteDefaultFieldsLabel: favoriteDefaultFieldsLabel2,
  favoriteDefaultFields: favoriteDefaultFields2,
  favoriteChainWrap: favoriteChainWrap2,
  favoriteChainTitle: favoriteChainTitle2,
  favoriteChainDesc: favoriteChainDesc2,
  favoriteChainList: favoriteChainList2,
  favoriteChainAddStep: favoriteChainAddStep2,
  favoriteModalError: favoriteModalError2,
  favoriteModalCancel: favoriteModalCancel2,
  favoriteModalRun: favoriteModalRun2,
  favoriteModalConfirm: favoriteModalConfirm2,
  resendModal,
  resendModalTitle,
  resendModalDesc,
  resendModalSites,
  resendModalClose,
  resendModalCancel,
  resendModalConfirm,
  importReportModal,
  importReportModalTitle,
  importReportModalDesc,
  importReportBody,
  importReportModalClose,
  importReportModalConfirm
} = popupDom.modals;
var { toastHost } = popupDom;
function setStatus(text, type = "") {
  statusMsg.textContent = text;
  statusMsg.className = type;
}
function clearStatus() {
  setStatus("");
}
function showAppToast(input, type = "info", duration = 3e3) {
  return showToast(input, type, duration);
}
function showConfirmToast(message, onConfirm) {
  showAppToast({
    message,
    type: "warning",
    duration: -1,
    actions: [
      {
        label: t.toastConfirm,
        onClick: () => {
          void onConfirm();
        }
      }
    ]
  });
}
function setSendingState(isSending) {
  state.isSending = Boolean(isSending);
  sendBtn.disabled = state.isSending;
  sendBtn.classList.toggle("loading", state.isSending);
  cancelSendBtn.hidden = !state.isSending;
  cancelSendBtn.disabled = !state.isSending;
  cancelSendBtn.textContent = t.stopSending;
}
function clearSendSafetyTimer() {
  if (state.sendSafetyTimer) {
    window.clearTimeout(state.sendSafetyTimer);
    state.sendSafetyTimer = null;
  }
}
function armSendSafetyTimer() {
  clearSendSafetyTimer();
  state.sendSafetyTimer = window.setTimeout(() => {
    state.sendSafetyTimer = null;
    if (state.lastBroadcast?.status !== "sending") {
      setSendingState(false);
    }
  }, 2e3);
}
function buildBroadcastToastSignature(summary) {
  return [
    summary?.broadcastId ?? "",
    summary?.status ?? "",
    summary?.finishedAt ?? "",
    (summary?.failedSiteIds ?? []).join(",")
  ].join("|");
}
function getEnabledSites() {
  return state.runtimeSites.filter((site) => site.enabled);
}
function getRuntimeSiteLabel(siteId) {
  return state.runtimeSites.find((site) => site.id === siteId)?.name ?? siteId;
}
function getSiteSelectorIssueUrl(site) {
  const siteLabel = site?.name ?? site?.id ?? "";
  return `https://github.com/search?q=repo:twbeatles/prompt-broadcaster+${encodeURIComponent(siteLabel)}+selector&type=issues`;
}
function getSiteLastVerifiedStatus(site) {
  const lastVerified = site?.lastVerified ? String(site.lastVerified).trim() : "";
  if (!lastVerified) {
    return "";
  }
  const parsedDate = Date.parse(`${lastVerified}-01`);
  if (!Number.isFinite(parsedDate)) {
    return "";
  }
  const daysSince = Math.floor((Date.now() - parsedDate) / 864e5);
  if (daysSince <= 0) {
    return "";
  }
  return (msg("popup_selector_days_since") || `~${daysSince}d since last verified`).replace("$DAYS$", String(daysSince));
}
function getOpenSiteTabs(siteId) {
  return state.openSiteTabs.filter((tab) => tab.siteId === siteId);
}
function getDefaultTargetModeLabel() {
  return state.settings.reuseExistingTabs ? t.openTabsDefaultReuse : t.openTabsDefaultNew;
}
function getDefaultSiteTargetSelection() {
  return "default";
}
function renderSortControls() {
  historySortSelect.innerHTML = getHistorySortOptions().map((option) => `<option value="${escapeAttribute(option.value)}">${escapeHtml(option.label)}</option>`).join("");
  favoritesSortSelect.innerHTML = getFavoriteSortOptions().map((option) => `<option value="${escapeAttribute(option.value)}">${escapeHtml(option.label)}</option>`).join("");
  historySortSelect.value = state.settings.historySort;
  favoritesSortSelect.value = state.settings.favoriteSort;
}
function getFocusableElements(root) {
  return [...root.querySelectorAll(
    "button:not([disabled]), [href], input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
  )].filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
}
function openOverlay(overlay, initialFocus = null) {
  if (!overlay) {
    return;
  }
  state.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  overlay.hidden = false;
  state.openModalId = overlay.id;
  window.requestAnimationFrame(() => {
    const fallbackTarget = getFocusableElements(overlay)[0] ?? overlay.querySelector(".modal-card");
    (initialFocus ?? fallbackTarget)?.focus?.();
  });
}
function closeOverlay(overlay) {
  if (!overlay) {
    return;
  }
  overlay.hidden = true;
  if (state.openModalId === overlay.id) {
    state.openModalId = null;
  }
  if (state.lastFocusedElement?.focus) {
    state.lastFocusedElement.focus();
  }
  state.lastFocusedElement = null;
}
function getOpenOverlay() {
  return [importReportModal, resendModal, favoriteModal2, templateModal].find((overlay) => overlay && !overlay.hidden) ?? null;
}
function closeActiveOverlayOrMenu() {
  const overlay = getOpenOverlay();
  if (overlay === importReportModal) {
    closeOverlay(importReportModal);
    return true;
  }
  if (overlay === resendModal) {
    closeOverlay(resendModal);
    state.pendingResendHistory = null;
    return true;
  }
  if (overlay === favoriteModal2) {
    hideFavoriteModal();
    return true;
  }
  if (overlay === templateModal) {
    hideTemplateModal();
    return true;
  }
  if (state.openMenuKey) {
    state.openMenuKey = null;
    renderLists();
    return true;
  }
  return false;
}
function trapModalFocus(event) {
  if (event.key !== "Tab") {
    return;
  }
  const overlay = getOpenOverlay();
  if (!overlay) {
    return;
  }
  const focusable = getFocusableElements(overlay);
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }
  const currentIndex = focusable.indexOf(document.activeElement);
  const nextIndex = event.shiftKey ? currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1 : currentIndex === -1 || currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1;
  event.preventDefault();
  focusable[nextIndex]?.focus?.();
}
function syncSiteTargetSelections() {
  const enabledSiteIds = new Set(getEnabledSites().map((site) => site.id));
  const nextSelections = {};
  enabledSiteIds.forEach((siteId) => {
    const currentSelection = state.siteTargetSelections?.[siteId];
    const availableTabIds = new Set(getOpenSiteTabs(siteId).map((tab) => Number(tab.tabId)));
    if (typeof currentSelection === "number" && availableTabIds.has(currentSelection)) {
      nextSelections[siteId] = currentSelection;
      return;
    }
    if (currentSelection === "new" || currentSelection === "default") {
      nextSelections[siteId] = currentSelection;
      return;
    }
    nextSelections[siteId] = getDefaultSiteTargetSelection();
  });
  state.siteTargetSelections = nextSelections;
}
function updatePromptCounter() {
  promptCounter.textContent = t.promptCounter(promptInput2.value.length);
}
function autoResizePromptInput() {
  promptInput2.style.height = "auto";
  const nextHeight = Math.max(100, Math.min(promptInput2.scrollHeight, 300));
  promptInput2.style.height = `${nextHeight}px`;
}
function scheduleComposeDraftSave(value = promptInput2.value) {
  if (state.promptDraftSaveTimer) {
    window.clearTimeout(state.promptDraftSaveTimer);
  }
  state.promptDraftSaveTimer = window.setTimeout(() => {
    state.promptDraftSaveTimer = null;
    void setComposeDraftPrompt(String(value ?? "")).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to persist compose draft.", error);
    });
  }, 180);
}
function applyDynamicPromptPlaceholder() {
  const placeholderVariants = isKorean ? [
    t.placeholder,
    "{{언어}}로 {{주제}}를 설명해줘",
    "선택한 텍스트를 여러 AI에 동시에 비교해줘"
  ] : [
    t.placeholder,
    "Write a blog post about {{topic}} in {{language}}.",
    "Summarize the selected text for all services."
  ];
  const nextPlaceholder = placeholderVariants[Math.floor(Math.random() * placeholderVariants.length)] || t.placeholder;
  promptInput2.setAttribute("placeholder", nextPlaceholder);
}
function getTemplateDisplayName(name) {
  return getTemplateVariableDisplayName(name, uiLanguage);
}
function allCheckboxes() {
  return [...sitesContainer.querySelectorAll("input[type='checkbox']")];
}
function checkedSiteIds() {
  return allCheckboxes().filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);
}
function syncToggleAllLabel() {
  const checkboxes = allCheckboxes();
  const allChecked = checkboxes.length > 0 && checkboxes.every((checkbox) => checkbox.checked);
  toggleAllBtn.textContent = allChecked ? t.deselectAll : t.selectAll;
}
function applySiteSelection(sentTo) {
  const selected = new Set(normalizeSiteIdList2(sentTo));
  allCheckboxes().forEach((checkbox) => {
    const shouldCheck = selected.size === 0 ? checkbox.checked : selected.has(checkbox.value);
    checkbox.checked = shouldCheck;
    const card = checkbox.closest(".site-card");
    card?.classList.toggle("checked", shouldCheck);
    card?.setAttribute("aria-selected", String(shouldCheck));
  });
  syncToggleAllLabel();
}
function switchTab(tabId) {
  state.activeTab = tabId;
  tabButtons.forEach((button) => {
    const active = button.dataset.tab === tabId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
  panels.forEach((panel) => {
    const active = panel.dataset.panel === tabId;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
  state.openMenuKey = null;
  renderLists();
}
function filterItems(items, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return items;
  }
  return items.filter(
    (item) => String(item.text).toLowerCase().includes(normalizedQuery)
  );
}
function renderHistoryList() {
  const items = sortHistoryItemsForDisplay(
    filterItems(state.history, state.historySearch),
    state.settings.historySort
  );
  if (items.length === 0) {
    historyList.innerHTML = buildEmptyState(
      state.historySearch ? t.noSearchResults : t.historyEmpty
    );
    return;
  }
  historyList.innerHTML = items.map((item) => buildHistoryItemMarkup(item, {
    openMenuKey: state.openMenuKey,
    runtimeSites: state.runtimeSites
  })).join("");
}
function getUniqueFavoriteTags() {
  const tagSet = /* @__PURE__ */ new Set();
  state.favorites.forEach((item) => {
    (item.tags ?? []).forEach((tag) => tagSet.add(tag));
  });
  return [...tagSet].sort();
}
function getUniqueFavoriteFolders() {
  const folderSet = /* @__PURE__ */ new Set();
  state.favorites.forEach((item) => {
    if (item.folder && item.folder.trim()) folderSet.add(item.folder.trim());
  });
  return [...folderSet].sort();
}
function renderFavoritesFilterBar() {
  const tags = getUniqueFavoriteTags();
  const folders = getUniqueFavoriteFolders();
  if (tags.length === 0 && folders.length === 0) {
    const existing = document.getElementById("favorites-filter-bar");
    if (existing) existing.remove();
    return;
  }
  let bar = document.getElementById("favorites-filter-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "favorites-filter-bar";
    bar.className = "favorites-filter-bar";
    favoritesList.parentElement?.insertBefore(bar, favoritesList);
  }
  const allLabel = msg("popup_favorite_filter_all") || "All";
  const activeTag = state.favoritesTagFilter;
  const activeFolder = state.favoritesFolderFilter;
  bar.innerHTML = `
    <div class="filter-chips">
      <button class="filter-chip${!activeTag && !activeFolder ? " active" : ""}" data-filter-all="favorites">${escapeHtml(allLabel)}</button>
      ${folders.map((f) => `<button class="filter-chip folder-chip${activeFolder === f ? " active" : ""}" data-filter-folder="${escapeAttribute(f)}">📁 ${escapeHtml(f)}</button>`).join("")}
      ${tags.map((tag) => `<button class="filter-chip tag-chip${activeTag === tag ? " active" : ""}" data-filter-tag="${escapeAttribute(tag)}">#${escapeHtml(tag)}</button>`).join("")}
    </div>
  `;
}
function filterFavoriteItems(items) {
  let filtered = items.filter((item) => matchesFavoriteSearch(item, state.favoritesSearch));
  if (state.favoritesTagFilter) {
    filtered = filtered.filter((item) => (item.tags ?? []).includes(state.favoritesTagFilter));
  }
  if (state.favoritesFolderFilter) {
    filtered = filtered.filter((item) => (item.folder ?? "").trim() === state.favoritesFolderFilter);
  }
  return sortFavoriteItemsForDisplay(filtered, state.settings.favoriteSort);
}
function renderFavoritesList() {
  renderFavoritesFilterBar();
  const items = filterFavoriteItems(state.favorites);
  if (items.length === 0) {
    favoritesList.innerHTML = buildEmptyState(
      state.favoritesSearch || state.favoritesTagFilter || state.favoritesFolderFilter ? t.noSearchResults : t.favoritesEmpty
    );
    return;
  }
  favoritesList.innerHTML = items.map((item) => buildFavoriteItemMarkup(item, {
    openMenuKey: state.openMenuKey,
    runtimeSites: state.runtimeSites,
    latestJob: getLatestFavoriteRunJobByFavoriteId(state.favoriteJobs, item.id)
  })).join("");
}
function renderLists() {
  renderHistoryList();
  renderFavoritesList();
}
function currentPromptVariables() {
  const checkedTargets = buildComposerBroadcastTargets(checkedSiteIds(), promptInput2.value);
  if (checkedTargets.length === 0) {
    return detectTemplateVariables(promptInput2.value);
  }
  return detectTemplateVariablesForTargets2(checkedTargets);
}
function renderTemplateSummary() {
  const variables = currentPromptVariables();
  templateSummary.hidden = variables.length === 0;
  if (variables.length === 0) {
    templateSummaryLabel.textContent = "";
    templateChipList.innerHTML = "";
    return;
  }
  templateSummaryLabel.textContent = t.templateSummary(variables.length);
  templateChipList.innerHTML = variables.map((variable) => {
    const kindLabel = variable.kind === "system" ? t.templateSystemKind : t.templateUserKind;
    const variableLabel = variable.kind === "system" ? getTemplateDisplayName(variable.name) : variable.name;
    return `
        <span class="template-chip ${variable.kind}">
          <span>{{${escapeHtml(variableLabel)}}}</span>
          <span class="template-chip-kind">${escapeHtml(kindLabel)}</span>
        </span>
      `;
  }).join("");
}
function compactVariableValues2(values) {
  return Object.fromEntries(
    Object.entries(values ?? {}).map(([name, value]) => [String(name), String(value ?? "")]).filter(([, value]) => value.trim())
  );
}
function mergeTemplateSources2(...sources) {
  return Object.assign({}, ...sources.filter(Boolean));
}
function normalizeOpenSiteTab(entry) {
  const tabId = Number(entry?.tabId);
  if (!Number.isFinite(tabId) || typeof entry?.siteId !== "string" || !entry.siteId.trim()) {
    return null;
  }
  return {
    siteId: entry.siteId.trim(),
    tabId,
    title: typeof entry?.title === "string" ? entry.title : "",
    url: typeof entry?.url === "string" ? entry.url : "",
    active: Boolean(entry?.active),
    status: typeof entry?.status === "string" ? entry.status : "",
    windowId: Number.isFinite(Number(entry?.windowId)) ? Number(entry.windowId) : null
  };
}
async function refreshOpenSiteTabs() {
  try {
    const response = await chrome.runtime.sendMessage({ action: "getOpenAiTabs" }).catch(() => null);
    const tabs = Array.isArray(response?.tabs) ? response.tabs.map((entry) => normalizeOpenSiteTab(entry)).filter(Boolean) : [];
    state.openTabsWindowId = Number.isFinite(Number(response?.windowId)) ? Number(response.windowId) : null;
    state.openSiteTabs = tabs;
    syncSiteTargetSelections();
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to refresh open AI tabs.", error);
    state.openTabsWindowId = null;
    state.openSiteTabs = [];
    syncSiteTargetSelections();
  }
}
function scheduleOpenSiteTabsRefresh(delayMs = 180) {
  if (state.openTabsRefreshTimer) {
    window.clearTimeout(state.openTabsRefreshTimer);
  }
  state.openTabsRefreshTimer = window.setTimeout(() => {
    state.openTabsRefreshTimer = null;
    void refreshOpenSiteTabs().then(() => renderSiteCheckboxesPanel()).catch((error) => {
      console.error("[AI Prompt Broadcaster] Scheduled AI tab refresh failed.", error);
    });
  }, delayMs);
}
function applySettingsToControls() {
  reuseExistingTabsToggle.checked = Boolean(state.settings.reuseExistingTabs);
  reuseExistingTabsLabel.textContent = t.reuseTabsLabel;
  reuseExistingTabsDesc.textContent = state.settings.reuseExistingTabs ? t.reuseTabsDescEnabled : t.reuseTabsDescDisabled;
  waitMultiplierLabel.textContent = t.waitMultiplierLabel;
  waitMultiplierRange.value = String(state.settings.waitMsMultiplier);
  waitMultiplierValue.textContent = t.waitMultiplierValue(state.settings.waitMsMultiplier);
  renderSortControls();
}
function buildComposerBroadcastTargets(siteIds = [], basePrompt = promptInput2.value) {
  return normalizeSiteIdList2(siteIds).map((siteId) => {
    const targetSelection = state.siteTargetSelections?.[siteId];
    const promptOverride = typeof state.sitePromptOverrides?.[siteId] === "string" && state.sitePromptOverrides[siteId].trim() ? state.sitePromptOverrides[siteId] : "";
    const target = {
      id: siteId,
      promptTemplate: promptOverride.trim() ? promptOverride : String(basePrompt ?? "")
    };
    if (typeof targetSelection === "number") {
      return { ...target, tabId: targetSelection };
    }
    if (targetSelection === "new") {
      return { ...target, reuseExistingTab: false, target: "new" };
    }
    return target;
  });
}
function buildRuntimeBroadcastTargets(targets = []) {
  return (Array.isArray(targets) ? targets : []).filter((target) => target && typeof target.id === "string" && target.id.trim()).map((target) => {
    const payload = { id: target.id };
    if (typeof target.tabId === "number") {
      payload.tabId = target.tabId;
    } else if (target.target === "new" || target.reuseExistingTab === false) {
      payload.reuseExistingTab = false;
      payload.target = "new";
    }
    if (typeof target.promptOverride === "string" && target.promptOverride.trim()) {
      payload.promptOverride = target.promptOverride;
    }
    if (typeof target.resolvedPrompt === "string") {
      payload.resolvedPrompt = target.resolvedPrompt;
    }
    return payload;
  });
}
function detectTemplateVariablesForTargets2(targets = []) {
  return detectTemplateVariablesForTargets(targets);
}
function findMissingTemplateValuesForTargets2(targets = [], userValues = {}) {
  return findMissingTemplateValuesForTargets(targets, userValues);
}
function buildResolvedBroadcastTargets(targets = [], values = {}) {
  return resolveBroadcastTargets(targets, values);
}
function buildTemplatePreviewText(targets = [], values = {}) {
  const resolvedTargets = buildResolvedBroadcastTargets(targets, values);
  const uniquePrompts = Array.from(
    new Set(
      resolvedTargets.map((target) => target.resolvedPrompt).filter((prompt) => typeof prompt === "string")
    )
  );
  if (uniquePrompts.length <= 1) {
    return uniquePrompts[0] ?? "";
  }
  return resolvedTargets.map((target) => `[${getRuntimeSiteLabel(target.id)}]
${target.resolvedPrompt}`).join("\n\n---\n\n");
}
async function loadStoredData() {
  try {
    const [
      history,
      favorites,
      variableCache,
      runtimeSites,
      promptIntent,
      composeDraftPrompt,
      failedSelectors,
      favoriteJobs,
      settings
    ] = await Promise.all([
      getPromptHistory(),
      getPromptFavorites(),
      getTemplateVariableCache(),
      getRuntimeSites(),
      consumePopupPromptIntent(),
      getComposeDraftPrompt(),
      getFailedSelectors(),
      getFavoriteRunJobs(),
      getAppSettings()
    ]);
    state.history = history;
    state.favorites = favorites;
    state.templateVariableCache = variableCache;
    state.runtimeSites = runtimeSites;
    state.failedSelectors = new Map(failedSelectors.map((entry) => [entry.serviceId, entry]));
    state.favoriteJobs = favoriteJobs;
    state.settings = settings;
    await refreshOpenSiteTabs();
    if (typeof promptIntent?.prompt === "string" && !promptInput2.value.trim()) {
      promptInput2.value = promptIntent.prompt;
    } else if (!promptInput2.value.trim()) {
      promptInput2.value = composeDraftPrompt;
    }
    applySettingsToControls();
    renderSiteCheckboxesPanel();
    renderManagedSites();
    updatePromptCounter();
    autoResizePromptInput();
    renderTemplateSummary();
    renderLists();
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to load stored data.", error);
    throw error;
  }
}
async function refreshStoredData() {
  try {
    const [history, favorites, variableCache, runtimeSites, failedSelectors, favoriteJobs, settings] = await Promise.all([
      getPromptHistory(),
      getPromptFavorites(),
      getTemplateVariableCache(),
      getRuntimeSites(),
      getFailedSelectors(),
      getFavoriteRunJobs(),
      getAppSettings()
    ]);
    state.history = history;
    state.favorites = favorites;
    state.templateVariableCache = variableCache;
    state.runtimeSites = runtimeSites;
    state.failedSelectors = new Map(failedSelectors.map((entry) => [entry.serviceId, entry]));
    state.favoriteJobs = favoriteJobs;
    state.settings = settings;
    await refreshOpenSiteTabs();
    applySettingsToControls();
    renderSiteCheckboxesPanel();
    renderManagedSites();
    renderLists();
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to refresh stored data.", error);
    throw error;
  }
}
var {
  getFavoriteById,
  setFavoriteModalError,
  hideFavoriteModal,
  dismissFavoriteModal,
  openFavoriteModal,
  openFavoriteEditor,
  runFavoriteItem,
  runFavoriteFromEditor,
  bindFavoriteEditorEvents
} = createFavoriteEditorFeature({
  checkedSiteIds,
  getEnabledSites,
  getRuntimeSiteLabel,
  refreshStoredData,
  requestFavoriteRun,
  setStatus,
  showAppToast,
  getUnknownErrorText,
  openOverlay,
  closeOverlay
});
async function maybeHandlePopupFavoriteIntent() {
  const intent = await consumePopupFavoriteIntent().catch(() => null);
  if (!intent?.favoriteId) {
    return;
  }
  const favorite = getFavoriteById(intent.favoriteId);
  if (!favorite) {
    return;
  }
  let runReason = intent.reason || t.favoriteRunNeedsEditor;
  if (intent.type === "run") {
    const response = await requestFavoriteRun(favorite, {
      trigger: intent.source === "options-edit" ? "popup" : intent.source ?? "popup",
      allowPopupFallback: false
    });
    if (response?.ok) {
      const message = response?.message ?? t.favoriteRunQueued;
      setStatus(message, "success");
      showAppToast(message, "success", 2200);
      return;
    }
    if (!response?.requiresPopupInput) {
      const errorMessage = response?.error ?? getUnknownErrorText();
      setStatus(t.error(errorMessage), "error");
      showAppToast(t.error(errorMessage), "error", 3200);
      return;
    }
    runReason = response?.error || runReason;
  }
  openFavoriteEditor(favorite, {
    reason: intent.type === "run" ? runReason : ""
  });
}
function setLoadedTemplateContext(item) {
  state.loadedTemplateDefaults = item && item.templateDefaults && typeof item.templateDefaults === "object" ? { ...item.templateDefaults } : {};
  state.loadedFavoriteTitle = typeof item?.title === "string" ? item.title : "";
  state.loadedFavoriteId = typeof item?.id === "string" ? item.id : "";
}
function loadPromptIntoComposer(item) {
  promptInput2.value = item.text;
  scheduleComposeDraftSave(promptInput2.value);
  applySiteSelection(getHistorySelectedSiteIds(item));
  setLoadedTemplateContext(item);
  renderTemplateSummary();
  switchTab("compose");
  promptInput2.focus();
  setStatus(t.importedLoad, "success");
  showAppToast(t.importedLoad, "info", 2200);
}
function setCardStatesFromBroadcast(summary) {
  document.querySelectorAll(".site-card.sent, .site-card.failed, .site-card.sending").forEach((card) => {
    card.classList.remove("sending", "sent", "failed");
    card.querySelector(".retry-btn")?.remove();
  });
  if (!summary?.siteIds?.length) {
    return;
  }
  summary.siteIds.forEach((siteId) => {
    const status = summary.siteResults?.[siteId];
    const code = normalizeResultCode(status?.code ?? status);
    if (code === "submitted") {
      setSiteCardState(siteId, "sent");
      return;
    }
    if (status) {
      setSiteCardState(siteId, "failed");
      return;
    }
    if (summary.status === "sending") {
      setSiteCardState(siteId, "sending");
    }
  });
}
function applyLastBroadcastState(summary, { silentToast = false } = {}) {
  state.lastBroadcast = summary;
  if (!summary) {
    clearSendSafetyTimer();
    setSendingState(false);
    clearStatus();
    return;
  }
  setCardStatesFromBroadcast(summary);
  if (summary.status === "sending") {
    setStatus(t.sending(summary.total || summary.siteIds?.length || 0));
    setSendingState(true);
    const signature2 = buildBroadcastToastSignature(summary);
    if (!silentToast && state.lastBroadcastToastSignature !== signature2) {
      showAppToast(t.restoredBroadcastSending, "info", 2600);
      state.lastBroadcastToastSignature = signature2;
    }
    return;
  }
  clearSendSafetyTimer();
  setSendingState(false);
  const finishedAtMs = Date.parse(summary.finishedAt || "");
  const isRecent = Number.isFinite(finishedAtMs) && Date.now() - finishedAtMs <= 5 * 60 * 1e3;
  const signature = buildBroadcastToastSignature(summary);
  const successCount = (summary.submittedSiteIds ?? []).length;
  const failedCount = (summary.failedSiteIds ?? []).length;
  if (summary.status === "submitted") {
    setStatus(t.sent(successCount || summary.total || summary.siteIds?.length || 0), "success");
  } else {
    const doneMessage = msg("popup_broadcast_restored_done", [String(successCount), String(failedCount)]) || `Last broadcast: ${successCount} success, ${failedCount} failed`;
    setStatus(doneMessage, failedCount > 0 ? "warning" : "success");
  }
  if (!silentToast && isRecent && state.lastBroadcastToastSignature !== signature) {
    const message = msg("popup_broadcast_restored_done", [String(successCount), String(failedCount)]) || `Last broadcast: ${successCount} success, ${failedCount} failed`;
    showAppToast(
      {
        message,
        type: failedCount > 0 ? "warning" : "info",
        duration: failedCount > 0 ? -1 : 4e3
      }
    );
    state.lastBroadcastToastSignature = signature;
  }
}
async function cancelCurrentBroadcast() {
  const broadcastId = state.lastBroadcast?.status === "sending" ? state.lastBroadcast.broadcastId : "";
  if (!broadcastId) {
    setSendingState(false);
    clearSendSafetyTimer();
    return;
  }
  cancelSendBtn.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({
      action: "cancelBroadcast",
      broadcastId
    });
    if (!response?.ok) {
      throw new Error(response?.error ?? getUnknownErrorText());
    }
    applyLastBroadcastState(response.summary ?? await getLastBroadcast(), { silentToast: true });
    setStatus(t.broadcastCancelled, "warning");
    showAppToast(t.broadcastCancelled, "warning", 2600);
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to cancel broadcast.", error);
    setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
    showAppToast(t.error(error?.message ?? getUnknownErrorText()), "error", 4e3);
    if (state.lastBroadcast?.status === "sending") {
      cancelSendBtn.disabled = false;
    }
  }
}
async function flushPendingSessionToasts() {
  const pendingToasts = await drainPendingUiToasts();
  pendingToasts.forEach((toast) => {
    showAppToast(toast);
  });
}
function getSiteCardElement(siteId) {
  return sitesContainer.querySelector(`[data-site-id="${CSS.escape(siteId)}"]`);
}
function setSiteCardState(siteId, cardState) {
  const card = getSiteCardElement(siteId);
  if (!card) {
    return;
  }
  card.classList.remove("sending", "sent", "failed");
  const retryBtn = card.querySelector(".retry-btn");
  if (retryBtn) {
    retryBtn.remove();
  }
  if (cardState) {
    card.classList.add(cardState);
  }
}
function addRetryButton(target, mainPrompt) {
  const siteId = target?.id;
  const card = getSiteCardElement(siteId);
  if (!card) {
    return;
  }
  const retryBtn = document.createElement("button");
  retryBtn.type = "button";
  retryBtn.className = "retry-btn";
  retryBtn.textContent = "Retry";
  retryBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const site = state.runtimeSites.find((s) => s.id === siteId);
    if (!site) {
      return;
    }
    retryBtn.disabled = true;
    setSiteCardState(siteId, "sending");
    try {
      await refreshOpenSiteTabs();
      const response = await chrome.runtime.sendMessage({
        action: "broadcast",
        prompt: mainPrompt,
        sites: buildRuntimeBroadcastTargets([target])
      });
      const failedIds = Array.isArray(response?.failedTabSiteIds) ? response.failedTabSiteIds : [];
      if (response?.ok && !failedIds.includes(siteId)) {
        setSiteCardState(siteId, "sent");
      } else {
        setSiteCardState(siteId, "failed");
        addRetryButton(target, mainPrompt);
      }
    } catch (_error) {
      setSiteCardState(siteId, "failed");
      addRetryButton(target, mainPrompt);
    }
  });
  card.appendChild(retryBtn);
}
function triggerRipple(button, event) {
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;`;
  button.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
}
async function sendResolvedPrompt(mainPrompt, targets) {
  if (state.isSending) {
    return;
  }
  const siteIds = normalizeSiteIdList2(
    (Array.isArray(targets) ? targets : []).map((target) => target?.id)
  );
  setSendingState(true);
  armSendSafetyTimer();
  siteIds.forEach((siteId) => setSiteCardState(siteId, "sending"));
  setStatus(t.sending(siteIds.length));
  try {
    await refreshOpenSiteTabs();
    await setLastSentPrompt(mainPrompt);
    clearAllToasts();
    const response = await chrome.runtime.sendMessage({
      action: "broadcast",
      prompt: mainPrompt,
      sites: buildRuntimeBroadcastTargets(targets)
    });
    if (response?.ok) {
      if (Array.isArray(response.failedTabSiteIds)) {
        response.failedTabSiteIds.forEach((siteId) => {
          setSiteCardState(siteId, "failed");
          const failedTarget = targets.find((target) => target.id === siteId);
          if (failedTarget) {
            addRetryButton(failedTarget, mainPrompt);
          }
        });
      }
      setStatus(t.sending(response.createdSiteCount ?? siteIds.length), "warning");
      showAppToast(t.toastSendSuccess(response.createdSiteCount ?? siteIds.length), "success", 2200);
      if (state.settings.autoClosePopup) {
        window.close();
      }
    } else {
      siteIds.forEach((siteId) => {
        setSiteCardState(siteId, "failed");
        const failedTarget = targets.find((target) => target.id === siteId);
        if (failedTarget) {
          addRetryButton(failedTarget, mainPrompt);
        }
      });
      setStatus(t.error(response?.error ?? getUnknownErrorText()), "error");
    }
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Broadcast send failed.", error);
    siteIds.forEach((siteId) => {
      setSiteCardState(siteId, "failed");
      const failedTarget = targets.find((target) => target.id === siteId);
      if (failedTarget) {
        addRetryButton(failedTarget, mainPrompt);
      }
    });
    setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
    showAppToast(t.error(error?.message ?? getUnknownErrorText()), "error", 4e3);
    setSendingState(false);
    clearSendSafetyTimer();
  } finally {
    if (state.lastBroadcast?.status !== "sending") {
      setSendingState(false);
    }
  }
}
function hideTemplateModal() {
  state.pendingTemplateSend = null;
  closeOverlay(templateModal);
  templateModalError.hidden = true;
  templateModalError.textContent = "";
}
function hideResendModal() {
  state.pendingResendHistory = null;
  closeOverlay(resendModal);
}
function openResendModal(historyItem) {
  state.pendingResendHistory = historyItem;
  resendModalTitle.textContent = t.resendModalTitle;
  resendModalDesc.textContent = t.resendModalDesc;
  resendModalCancel.textContent = t.resendModalCancel;
  resendModalConfirm.textContent = t.resendModalConfirm;
  const requestedSiteIds = getHistorySelectedSiteIds(historyItem);
  const availableSiteIds = new Set(getEnabledSites().map((site) => site.id));
  resendModalSites.innerHTML = requestedSiteIds.map((siteId) => {
    const site = state.runtimeSites.find((entry) => entry.id === siteId);
    const disabled = !availableSiteIds.has(siteId);
    return `
      <label class="checkbox-row">
        <input type="checkbox" value="${escapeAttribute(siteId)}" data-resend-site="${escapeAttribute(siteId)}" ${disabled ? "disabled" : "checked"} />
        <span>${escapeHtml(site?.name ?? siteId)}${disabled ? ` (${escapeHtml(t.resendSiteUnavailable)})` : ""}</span>
      </label>
    `;
  }).join("");
  openOverlay(resendModal, resendModalSites.querySelector("input:not([disabled])"));
}
async function confirmResendModal() {
  const historyItem = state.pendingResendHistory;
  if (!historyItem) {
    return;
  }
  const selectedSiteIds = [...resendModalSites.querySelectorAll("[data-resend-site]:checked")].map((checkbox) => checkbox.value).filter(Boolean);
  if (selectedSiteIds.length === 0) {
    setStatus(t.warnNoSite, "error");
    return;
  }
  const selectedTargets = ensureBroadcastTargetSnapshots(
    historyItem.targetSnapshots,
    historyItem.requestedSiteIds,
    historyItem.text
  ).filter((snapshot) => selectedSiteIds.includes(snapshot.siteId)).map((snapshot) => buildBroadcastTargetMessageFromSnapshot(snapshot, state.openSiteTabs));
  hideResendModal();
  await sendResolvedPrompt(historyItem.text, selectedTargets);
}
function openImportReportModal(summary) {
  state.pendingImportSummary = summary;
  importReportModalTitle.textContent = t.importReportTitle;
  importReportModalDesc.textContent = t.importReportDesc;
  importReportModalConfirm.textContent = t.importReportClose;
  importReportBody.innerHTML = buildImportReportMarkup(summary);
  openOverlay(importReportModal, importReportModalClose);
}
function hideImportReportModal() {
  state.pendingImportSummary = null;
  closeOverlay(importReportModal);
}
function getPromptButtonsForActiveTab() {
  if (state.activeTab === "history") {
    return [...historyList.querySelectorAll("[data-load-history]")];
  }
  if (state.activeTab === "favorites") {
    return [...favoritesList.querySelectorAll("[data-load-favorite], [data-edit-favorite]")];
  }
  return [];
}
function focusAdjacentPromptButton(direction) {
  const buttons = getPromptButtonsForActiveTab();
  if (buttons.length === 0) {
    return;
  }
  const currentIndex = buttons.findIndex((button) => button === document.activeElement);
  const nextIndex = currentIndex === -1 ? direction > 0 ? 0 : buttons.length - 1 : (currentIndex + direction + buttons.length) % buttons.length;
  buttons[nextIndex]?.focus?.();
}
async function handleGlobalShortcut(event) {
  if (event.defaultPrevented) {
    return;
  }
  const shortcutKey = event.key.toLowerCase();
  const hasPrimaryModifier = event.ctrlKey || event.metaKey;
  if (event.key === "Escape") {
    if (closeActiveOverlayOrMenu()) {
      event.preventDefault();
    }
    return;
  }
  if (getOpenOverlay()) {
    return;
  }
  if (hasPrimaryModifier && event.shiftKey && event.key === "Enter") {
    event.preventDefault();
    await cancelCurrentBroadcast();
    return;
  }
  if (hasPrimaryModifier && !event.shiftKey && event.key === "Enter") {
    event.preventDefault();
    await handleSend();
    return;
  }
  if (hasPrimaryModifier && !event.shiftKey && ["1", "2", "3", "4"].includes(shortcutKey)) {
    event.preventDefault();
    switchTab(["compose", "history", "favorites", "settings"][Number(shortcutKey) - 1]);
    return;
  }
  if (hasPrimaryModifier && !event.shiftKey && shortcutKey === "a" && state.activeTab === "compose" && !isTextEditingTarget(event.target)) {
    event.preventDefault();
    toggleAllBtn.click();
    return;
  }
  if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !isTextEditingTarget(event.target)) {
    if (state.activeTab === "history" || state.activeTab === "favorites") {
      event.preventDefault();
      focusAdjacentPromptButton(event.key === "ArrowDown" ? 1 : -1);
    }
  }
}
function resetTransientModals() {
  hideTemplateModal();
  hideFavoriteModal();
  hideResendModal();
  hideImportReportModal();
}
function setTemplateModalError(message = "") {
  templateModalError.hidden = !message;
  templateModalError.textContent = message;
}
async function ensureClipboardReadPermission() {
  try {
    if (!chrome.permissions?.contains || !chrome.permissions?.request) {
      return false;
    }
    const permission = { permissions: ["clipboardRead"] };
    const alreadyGranted = await chrome.permissions.contains(permission);
    if (alreadyGranted) {
      return true;
    }
    return await chrome.permissions.request(permission);
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to request clipboardRead permission.", error);
    return false;
  }
}
async function resolveAsyncTemplateVariables(variables) {
  const needsTabContext = variables.some(
    (v) => v.name === SYSTEM_TEMPLATE_VARIABLES.url || v.name === SYSTEM_TEMPLATE_VARIABLES.title || v.name === SYSTEM_TEMPLATE_VARIABLES.selection
  );
  const needsCounter = variables.some((v) => v.name === SYSTEM_TEMPLATE_VARIABLES.counter);
  const extra = {};
  if (needsTabContext) {
    try {
      const response = await chrome.runtime.sendMessage({ action: "getActiveTabContext" }).catch(() => null);
      if (response?.ok) {
        extra.url = response.url ?? "";
        extra.title = response.title ?? "";
        extra.selection = response.selection ?? "";
      }
    } catch (_error) {
    }
  }
  if (needsCounter) {
    try {
      const response = await chrome.runtime.sendMessage({ action: "getBroadcastCounter" }).catch(() => null);
      extra.counter = response?.counter != null ? String(Number(response.counter) + 1) : "1";
    } catch (_error) {
      extra.counter = "1";
    }
  }
  return extra;
}
async function readClipboardTemplateValue() {
  try {
    const hasPermission = await ensureClipboardReadPermission();
    if (!hasPermission) {
      return {
        ok: false,
        text: "",
        error: "clipboardRead permission was not granted."
      };
    }
    if (!navigator.clipboard?.readText) {
      return {
        ok: false,
        text: "",
        error: "Clipboard API is not available in this context."
      };
    }
    const text = await navigator.clipboard.readText();
    return { ok: true, text };
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to read clipboard for template variable.", error);
    return {
      ok: false,
      text: "",
      error: error?.message ?? String(error)
    };
  }
}
function getFavoriteTemplateSources(favorite) {
  if (favorite?.mode === "chain" && Array.isArray(favorite.steps) && favorite.steps.length > 0) {
    return favorite.steps.map((step) => String(step?.text ?? "")).filter((text) => text.trim());
  }
  return [String(favorite?.text ?? "")];
}
function detectFavoriteTemplateVariables(favorite) {
  const seen = /* @__PURE__ */ new Set();
  return getFavoriteTemplateSources(favorite).flatMap((template) => detectTemplateVariables(template)).filter((variable) => {
    if (seen.has(variable.name)) {
      return false;
    }
    seen.add(variable.name);
    return true;
  });
}
async function buildPreparedFavoriteExecutionContext(favorite) {
  const variables = detectFavoriteTemplateVariables(favorite);
  const needsClipboard = variables.some(
    (variable) => variable.kind === "system" && variable.name === SYSTEM_TEMPLATE_VARIABLES.clipboard
  );
  const asyncExtra = await resolveAsyncTemplateVariables(variables);
  const preparedExecutionContext = {};
  if (typeof asyncExtra.url === "string") {
    preparedExecutionContext.url = asyncExtra.url;
  }
  if (typeof asyncExtra.title === "string") {
    preparedExecutionContext.title = asyncExtra.title;
  }
  if (typeof asyncExtra.selection === "string") {
    preparedExecutionContext.selection = asyncExtra.selection;
  }
  if (!needsClipboard) {
    return {
      ok: true,
      preparedExecutionContext
    };
  }
  const clipboardResult = await readClipboardTemplateValue();
  if (!clipboardResult.ok) {
    return {
      ok: false,
      reason: "clipboard_read_failed",
      error: clipboardResult.error || t.templateClipboardError
    };
  }
  preparedExecutionContext.clipboard = clipboardResult.text ?? "";
  return {
    ok: true,
    preparedExecutionContext
  };
}
async function requestFavoriteRun(favorite, {
  trigger = "popup",
  allowPopupFallback = false
} = {}) {
  if (!favorite?.id) {
    return {
      ok: false,
      error: getUnknownErrorText()
    };
  }
  const prepared = await buildPreparedFavoriteExecutionContext(favorite);
  if (!prepared?.ok) {
    return prepared;
  }
  return chrome.runtime.sendMessage({
    action: "favorite:run",
    favoriteId: favorite.id,
    trigger,
    allowPopupFallback,
    preparedExecutionContext: prepared.preparedExecutionContext
  });
}
async function maybeMarkLoadedFavoriteAsUsed() {
  if (!state.loadedFavoriteId) {
    return;
  }
  try {
    await markFavoriteUsed(state.loadedFavoriteId);
    state.favorites = await getPromptFavorites();
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to update favorite usage.", error);
  }
}
async function confirmTemplateModalSend() {
  const modalState = state.pendingTemplateSend;
  if (!modalState) {
    return;
  }
  renderTemplateModalV2();
  const previewState = buildTemplateSendPreviewStateV2();
  if (!previewState || previewState.missingUserValues.length > 0 || previewState.clipboardMissing) {
    return;
  }
  const cachedValues = compactVariableValues2(modalState.userValues);
  await updateTemplateVariableCache(cachedValues);
  state.templateVariableCache = mergeTemplateSources2(state.templateVariableCache, cachedValues);
  const resolvedTargets = buildResolvedBroadcastTargets(modalState.targets, previewState.values);
  hideTemplateModal();
  await maybeMarkLoadedFavoriteAsUsed();
  await sendResolvedPrompt(modalState.prompt, resolvedTargets);
}
function buildTemplateSendPreviewStateV2() {
  const modalState = state.pendingTemplateSend;
  if (!modalState) {
    return null;
  }
  const values = mergeTemplateSources2(modalState.systemValues, modalState.userValues);
  const preview = buildTemplatePreviewText(modalState.targets, values);
  const missingUserValues = findMissingTemplateValuesForTargets2(
    modalState.targets,
    modalState.userValues
  );
  const clipboardRequired = modalState.variables.some(
    (variable) => variable.name === SYSTEM_TEMPLATE_VARIABLES.clipboard
  );
  const clipboardMissing = clipboardRequired && !String(modalState.systemValues[SYSTEM_TEMPLATE_VARIABLES.clipboard] ?? "").length;
  return {
    values,
    preview,
    missingUserValues,
    clipboardMissing
  };
}
function renderTemplateModalV2() {
  const modalState = state.pendingTemplateSend;
  if (!modalState) {
    return;
  }
  templateModalTitle.textContent = t.templateModalTitle;
  templateModalDesc.textContent = t.templateModalDesc;
  templatePreviewLabel.textContent = t.templatePreviewLabel;
  templateModalCancel.textContent = t.templateModalCancel;
  templateModalConfirm.textContent = t.templateModalConfirm;
  const automaticVariables = modalState.variables.filter((variable) => variable.kind === "system");
  if (automaticVariables.length > 0) {
    const labels = automaticVariables.map((variable) => `{{${getTemplateDisplayName(variable.name)}}}`).join(", ");
    const notices = [t.templateSystemNotice, labels];
    if (automaticVariables.some((variable) => variable.name === SYSTEM_TEMPLATE_VARIABLES.clipboard)) {
      notices.push(t.templateClipboardNotice);
    }
    templateModalSystemInfo.hidden = false;
    templateModalSystemInfo.textContent = notices.join(" · ");
  } else {
    templateModalSystemInfo.hidden = true;
    templateModalSystemInfo.textContent = "";
  }
  const userVariables = modalState.variables.filter((variable) => variable.kind === "user");
  templateFields.innerHTML = userVariables.map((variable) => {
    const value = modalState.userValues[variable.name] ?? "";
    return `
        <label class="field-stack">
          <span>${escapeHtml(t.templateFieldLabel(variable.name))}</span>
          <input
            class="search-input"
            type="text"
            data-template-input="${escapeAttribute(variable.name)}"
            value="${escapeAttribute(value)}"
            placeholder="${escapeAttribute(t.templateFieldPlaceholder(variable.name))}"
          />
        </label>
      `;
  }).join("");
  const previewState = buildTemplateSendPreviewStateV2();
  const errorMessage = previewState?.clipboardMissing ? t.templateClipboardError : previewState && previewState.missingUserValues.length > 0 ? t.templateMissingValues : "";
  templatePreview.textContent = previewState?.preview ?? modalState.prompt;
  setTemplateModalError(errorMessage);
  templateModalConfirm.disabled = Boolean(errorMessage);
}
async function openTemplateModalV2(prompt, targets) {
  const variables = detectTemplateVariablesForTargets2(targets);
  if (variables.length === 0) {
    await maybeMarkLoadedFavoriteAsUsed();
    await sendResolvedPrompt(prompt, buildResolvedBroadcastTargets(targets));
    return;
  }
  const baseDefaults = mergeTemplateSources2(
    state.templateVariableCache,
    state.loadedTemplateDefaults
  );
  const userValues = Object.fromEntries(
    variables.filter((variable) => variable.kind === "user").map((variable) => [variable.name, baseDefaults[variable.name] ?? ""])
  );
  const asyncExtra = await resolveAsyncTemplateVariables(variables);
  const systemValues = buildSystemTemplateValues(/* @__PURE__ */ new Date(), {
    locale: isKorean ? "ko" : "en",
    extra: asyncExtra
  });
  if (variables.some((variable) => variable.name === SYSTEM_TEMPLATE_VARIABLES.clipboard)) {
    const clipboardResult = await readClipboardTemplateValue();
    if (clipboardResult.ok) {
      systemValues[SYSTEM_TEMPLATE_VARIABLES.clipboard] = clipboardResult.text;
    }
  }
  state.pendingTemplateSend = {
    prompt,
    targets,
    variables,
    userValues,
    systemValues
  };
  renderTemplateModalV2();
  openOverlay(templateModal, templateFields.querySelector("input") ?? templateModalConfirm);
}
function renderTabLabels() {
  extTitle.textContent = t.title;
  extDesc.textContent = t.desc;
  clearPromptBtn.textContent = t.clearPrompt;
  sitesLabel.textContent = t.sitesLabel;
  saveFavoriteBtn.textContent = t.saveFavorite;
  sendBtn.textContent = t.send;
  historySearchInput.placeholder = t.historySearch;
  favoritesSearchInput.placeholder = t.favoritesSearch;
  settingsTitle.textContent = t.settingsTitle;
  settingsDesc.textContent = t.settingsDesc;
  reuseExistingTabsLabel.textContent = t.reuseTabsLabel;
  reuseExistingTabsDesc.textContent = state.settings.reuseExistingTabs ? t.reuseTabsDescEnabled : t.reuseTabsDescDisabled;
  waitMultiplierLabel.textContent = t.waitMultiplierLabel;
  waitMultiplierValue.textContent = t.waitMultiplierValue(state.settings.waitMsMultiplier);
  openOptionsBtn.textContent = t.openOptions;
  clearHistoryBtn.textContent = t.clearHistory;
  exportJsonBtn.textContent = t.exportJson;
  importJsonBtn.textContent = t.importJson;
  serviceManagementTitle.textContent = t.serviceManagementTitle;
  serviceManagementDesc.textContent = t.serviceManagementDesc;
  addServiceBtn.textContent = t.addService;
  resetSitesBtn.textContent = t.resetServices;
  serviceEditorDesc.textContent = t.serviceEditorDesc;
  serviceNameLabel.textContent = t.serviceFieldName;
  serviceUrlLabel.textContent = t.serviceFieldUrl;
  serviceInputSelectorLabel.textContent = t.serviceFieldInputSelector;
  testSelectorBtn.textContent = t.serviceTest;
  serviceInputTypeLabel.textContent = t.serviceFieldInputType;
  serviceSubmitSelectorLabel.textContent = t.serviceFieldSubmitSelector;
  serviceSubmitMethodLabel.textContent = t.serviceFieldSubmitMethod;
  serviceAdvancedTitle.textContent = t.serviceFieldAdvanced;
  serviceFallbackSelectorsLabel.textContent = t.serviceFieldFallbackSelectors;
  serviceAuthSelectorsLabel.textContent = t.serviceFieldAuthSelectors;
  serviceHostnameAliasesLabel.textContent = t.serviceFieldHostnameAliases;
  serviceLastVerifiedLabel.textContent = t.serviceFieldLastVerified;
  serviceVerifiedVersionLabel.textContent = t.serviceFieldVerifiedVersion;
  serviceWaitLabel.textContent = t.serviceFieldWait;
  serviceColorLabel.textContent = t.serviceFieldColor;
  serviceIconLabel.textContent = t.serviceFieldIcon;
  serviceEnabledLabel.textContent = t.serviceFieldEnabled;
  serviceEditorCancel.textContent = t.serviceEditorCancel;
  serviceEditorSave.textContent = t.serviceEditorSave;
  resendModalTitle.textContent = t.resendModalTitle;
  resendModalDesc.textContent = t.resendModalDesc;
  resendModalCancel.textContent = t.resendModalCancel;
  resendModalConfirm.textContent = t.resendModalConfirm;
  importReportModalTitle.textContent = t.importReportTitle;
  importReportModalDesc.textContent = t.importReportDesc;
  importReportModalConfirm.textContent = t.importReportClose;
  tabButtons.forEach((button) => {
    button.textContent = t.tabs[button.dataset.tab];
  });
  applyDynamicPromptPlaceholder();
  updatePromptCounter();
}
function renderSiteCheckboxesPanel() {
  const previousSelection = new Set(checkedSiteIds());
  sitesContainer.innerHTML = "";
  getEnabledSites().forEach((site) => {
    const card = document.createElement("article");
    card.className = "site-card checked";
    card.dataset.siteId = site.id;
    card.style.setProperty("--site-color", site.color || "#c24f2e");
    card.setAttribute("role", "option");
    card.tabIndex = 0;
    const mainRow = document.createElement("label");
    mainRow.className = "site-card-main";
    mainRow.htmlFor = `site-${site.id}`;
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `site-${site.id}`;
    checkbox.value = site.id;
    checkbox.checked = previousSelection.size > 0 ? previousSelection.has(site.id) : true;
    const siteIcon = document.createElement("span");
    siteIcon.className = "site-icon";
    siteIcon.textContent = getSiteIcon(site);
    const siteName = document.createElement("span");
    siteName.className = "site-name";
    siteName.textContent = `${getRuntimeSiteLabel(site.id)}`;
    const selectorWarning = state.failedSelectors.get(site.id);
    if (selectorWarning) {
      card.classList.add("selector-warning");
      card.title = t.selectorWarningTooltip;
    }
    checkbox.addEventListener("change", () => {
      card.classList.toggle("checked", checkbox.checked);
      card.setAttribute("aria-selected", String(checkbox.checked));
      card.setAttribute(
        "aria-label",
        `${getRuntimeSiteLabel(site.id)} ${checkbox.checked ? t.ariaSelected : t.ariaNotSelected}`
      );
      syncToggleAllLabel();
      renderTemplateSummary();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== " " && event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const siteStatus = document.createElement("span");
    siteStatus.className = "site-status";
    siteStatus.setAttribute("aria-hidden", "true");
    const warningIcon = document.createElement("span");
    warningIcon.className = "site-warning";
    warningIcon.setAttribute("aria-hidden", "true");
    warningIcon.textContent = selectorWarning ? "!" : "";
    mainRow.append(checkbox, siteIcon, siteName, warningIcon, siteStatus);
    card.classList.toggle("checked", checkbox.checked);
    card.setAttribute("aria-selected", String(checkbox.checked));
    card.setAttribute(
      "aria-label",
      `${getRuntimeSiteLabel(site.id)} ${checkbox.checked ? t.ariaSelected : t.ariaNotSelected}`
    );
    card.appendChild(mainRow);
    const openTabs = getOpenSiteTabs(site.id);
    const selectedTarget = state.siteTargetSelections?.[site.id] ?? getDefaultSiteTargetSelection();
    if (openTabs.length > 0) {
      const tabsWrap = document.createElement("div");
      tabsWrap.className = "site-tabs";
      const tabsHead = document.createElement("div");
      tabsHead.className = "site-tabs-head";
      tabsHead.textContent = t.openTabsTitle(openTabs.length);
      const tabsList = document.createElement("div");
      tabsList.className = "site-tabs-list";
      const radioName = `site-target-${site.id}`;
      const appendTargetOption = (choiceValue, title, detail, pillText = "") => {
        const option = document.createElement("label");
        option.className = "site-tab-option";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = radioName;
        radio.value = typeof choiceValue === "number" ? `tab:${choiceValue}` : String(choiceValue);
        radio.checked = choiceValue === selectedTarget;
        const copy = document.createElement("span");
        copy.className = "site-tab-copy";
        const titleNode = document.createElement("span");
        titleNode.className = "site-tab-title";
        titleNode.textContent = title;
        const detailNode = document.createElement("span");
        detailNode.className = "site-tab-meta";
        detailNode.textContent = detail;
        copy.append(titleNode, detailNode);
        option.append(radio, copy);
        if (pillText) {
          const pill = document.createElement("span");
          pill.className = "site-tab-pill";
          pill.textContent = pillText;
          option.appendChild(pill);
        }
        radio.addEventListener("change", () => {
          if (!radio.checked) {
            return;
          }
          state.siteTargetSelections[site.id] = choiceValue;
          if (!checkbox.checked) {
            checkbox.checked = true;
            card.classList.add("checked");
          }
          syncToggleAllLabel();
        });
        tabsList.appendChild(option);
      };
      appendTargetOption(
        "default",
        t.openTabsUseDefault,
        t.openTabsUseDefaultDetail(getDefaultTargetModeLabel())
      );
      appendTargetOption(
        "new",
        t.openTabsAlwaysNew,
        t.openTabsAlwaysNewDetail
      );
      openTabs.forEach((tab) => {
        const detailText = previewText(tab.url || tab.title || "", 52);
        const pillText = tab.active ? t.openTabsActive : tab.status === "loading" ? t.openTabsLoading : t.openTabsReady;
        appendTargetOption(
          tab.tabId,
          previewText(tab.title || tab.url || `${site.name} tab`, 48),
          detailText,
          pillText
        );
      });
      tabsWrap.append(tabsHead, tabsList);
      card.appendChild(tabsWrap);
    }
    const overrideToggleRow = document.createElement("div");
    overrideToggleRow.className = "site-override-toggle-row";
    const overrideToggle = document.createElement("button");
    const hasOverride = Boolean(state.sitePromptOverrides?.[site.id]?.trim());
    overrideToggle.className = `ghost-button small-button site-override-toggle${hasOverride ? " active" : ""}`;
    overrideToggle.type = "button";
    overrideToggle.dataset.siteOverrideToggle = site.id;
    overrideToggle.title = msg("popup_override_prompt_label") || "Custom prompt for this service";
    overrideToggle.textContent = hasOverride ? "✎ " + (msg("popup_override_active") || "Custom") : "✎";
    const overrideWrap = document.createElement("div");
    overrideWrap.className = "site-override-wrap";
    overrideWrap.hidden = !hasOverride;
    const overrideTextarea = document.createElement("textarea");
    overrideTextarea.className = "site-override-textarea";
    overrideTextarea.rows = 3;
    overrideTextarea.placeholder = msg("popup_override_prompt_placeholder") || "Override prompt for this service only…";
    overrideTextarea.value = state.sitePromptOverrides?.[site.id] ?? "";
    overrideTextarea.dataset.siteOverrideInput = site.id;
    overrideTextarea.addEventListener("input", () => {
      state.sitePromptOverrides[site.id] = overrideTextarea.value;
      const nowActive = Boolean(overrideTextarea.value.trim());
      overrideToggle.classList.toggle("active", nowActive);
      overrideToggle.textContent = nowActive ? "✎ " + (msg("popup_override_active") || "Custom") : "✎";
      renderTemplateSummary();
    });
    overrideToggle.addEventListener("click", () => {
      overrideWrap.hidden = !overrideWrap.hidden;
      if (!overrideWrap.hidden) {
        overrideTextarea.focus();
      }
    });
    overrideWrap.appendChild(overrideTextarea);
    overrideToggleRow.append(overrideToggle);
    card.append(overrideToggleRow, overrideWrap);
    sitesContainer.appendChild(card);
  });
  syncToggleAllLabel();
  setCardStatesFromBroadcast(state.lastBroadcast);
}
function setServiceEditorError(message = "") {
  serviceEditorError.hidden = !message;
  serviceEditorError.textContent = message;
}
function setServiceTestResult(message = "", isError = false) {
  serviceTestResult.hidden = !message;
  serviceTestResult.textContent = message;
  serviceTestResult.style.background = isError ? "rgba(181, 59, 59, 0.12)" : "rgba(255, 196, 0, 0.12)";
  serviceTestResult.style.color = isError ? "var(--danger)" : "var(--text)";
}
function setServicePermissionPreview(message = "", isError = false) {
  servicePermissionPreview.hidden = !message;
  servicePermissionPreview.textContent = message;
  servicePermissionPreview.style.color = isError ? "var(--danger)" : "var(--text-soft)";
}
function renderServicePermissionPreview(draft = readServiceEditorDraft(), validation = null) {
  const aliasErrors = validation?.fieldErrors?.hostnameAliases ?? [];
  const aliasValidation = aliasErrors.length > 0 ? { valid: false, errors: aliasErrors } : validateHostnameAliases(draft.hostnameAliases);
  const hasAliasError = aliasValidation.errors.length > 0;
  serviceHostnameAliasesInput.setAttribute("aria-invalid", String(hasAliasError));
  if (hasAliasError) {
    setServicePermissionPreview(aliasValidation.errors.join(" "), true);
    return;
  }
  if (Boolean(state.serviceEditor?.isBuiltIn)) {
    setServicePermissionPreview("");
    return;
  }
  const patterns = buildSitePermissionPatterns(draft.url, draft.hostnameAliases);
  if (!draft.url.trim() || patterns.length === 0) {
    setServicePermissionPreview("");
    return;
  }
  setServicePermissionPreview(
    `${msg("popup_service_permission_preview") || "Requested origins"}: ${patterns.join(", ")}`,
    false
  );
}
function resetServiceEditorForm() {
  serviceNameInput.value = "";
  serviceUrlInput.value = "";
  serviceInputSelectorInput.value = "";
  document.querySelector("input[name='service-input-type'][value='textarea']").checked = true;
  serviceSubmitSelectorInput.value = "";
  serviceSubmitMethodSelect.value = "click";
  serviceFallbackSelectorsInput.value = "";
  serviceAuthSelectorsInput.value = "";
  serviceHostnameAliasesInput.value = "";
  serviceHostnameAliasesInput.disabled = false;
  serviceLastVerifiedInput.value = "";
  serviceVerifiedVersionInput.value = "";
  serviceWaitRange.value = "2000";
  serviceWaitValue.textContent = "2000ms";
  serviceColorInput.value = "#c24f2e";
  serviceIconInput.value = "AI";
  serviceEnabledInput.checked = true;
  serviceUrlInput.disabled = false;
  state.serviceEditor = null;
  setServiceEditorError("");
  setServiceTestResult("");
  setServicePermissionPreview("");
}
function hideServiceEditor() {
  serviceEditor.hidden = true;
  resetServiceEditorForm();
}
function populateServiceEditor(site) {
  state.serviceEditor = {
    mode: site ? "edit" : "add",
    siteId: site?.id ?? "",
    isBuiltIn: Boolean(site?.isBuiltIn),
    selectorCheckMode: site?.selectorCheckMode ?? "input-and-submit"
  };
  serviceEditorTitle.textContent = state.serviceEditor.mode === "edit" ? t.serviceEditorEditTitle : t.serviceEditorAddTitle;
  serviceNameInput.value = site?.name ?? "";
  serviceUrlInput.value = site?.url ?? "";
  serviceInputSelectorInput.value = site?.inputSelector ?? "";
  const inputTypeOption = document.querySelector(
    `input[name='service-input-type'][value='${site?.inputType ?? "textarea"}']`
  );
  if (inputTypeOption) {
    inputTypeOption.checked = true;
  }
  serviceSubmitSelectorInput.value = site?.submitSelector ?? "";
  serviceSubmitMethodSelect.value = site?.submitMethod ?? "click";
  serviceFallbackSelectorsInput.value = joinMultilineValues(site?.fallbackSelectors);
  serviceAuthSelectorsInput.value = joinMultilineValues(site?.authSelectors);
  serviceHostnameAliasesInput.value = joinMultilineValues(site?.hostnameAliases);
  serviceHostnameAliasesInput.disabled = Boolean(site?.isBuiltIn);
  serviceLastVerifiedInput.value = site?.lastVerified ?? "";
  serviceVerifiedVersionInput.value = site?.verifiedVersion ?? "";
  serviceWaitRange.value = String(site?.waitMs ?? 2e3);
  serviceWaitValue.textContent = `${site?.waitMs ?? 2e3}ms`;
  serviceColorInput.value = site?.color ?? "#c24f2e";
  serviceIconInput.value = site?.icon ?? "AI";
  serviceEnabledInput.checked = site?.enabled ?? true;
  serviceUrlInput.disabled = Boolean(site?.isBuiltIn);
  setServiceEditorError("");
  setServiceTestResult("");
  renderServicePermissionPreview(readServiceEditorDraft());
  serviceEditor.hidden = false;
}
function buildManagedSiteMarkup(site) {
  const chips = [
    `<span class="managed-site-chip">${escapeHtml(site.isBuiltIn ? t.serviceBuiltInBadge : t.serviceCustomBadge)}</span>`,
    `<span class="managed-site-chip">${escapeHtml(site.inputType)}</span>`,
    `<span class="managed-site-chip">${escapeHtml(`${site.waitMs}ms`)}</span>`
  ];
  const selectorWarning = state.failedSelectors.get(site.id);
  const lastVerifiedStatus = getSiteLastVerifiedStatus(site);
  const selectorWarningMarkup = selectorWarning ? `
      <div class="selector-report-row">
        <span class="selector-days-since">${escapeHtml(lastVerifiedStatus || (msg("popup_selector_warning_desc") || "Selector may have changed."))}</span>
        <a
          class="ghost-button small-button selector-report-link"
          href="${escapeAttribute(getSiteSelectorIssueUrl(site))}"
          target="_blank"
          rel="noopener noreferrer"
          title="${escapeAttribute(msg("popup_selector_report_tooltip") || "Open GitHub Issues")}"
        >${escapeHtml(msg("popup_selector_report_btn") || "Report")}</a>
      </div>
    ` : "";
  if (!site.enabled) {
    chips.push(`<span class="managed-site-chip">${escapeHtml(t.serviceDisabledLabel)}</span>`);
  }
  return `
    <article class="managed-site-card" data-managed-site-id="${escapeAttribute(site.id)}">
      <div class="managed-site-head">
        <div class="managed-site-title">
          <span class="site-icon" style="--site-color:${escapeAttribute(site.color)}">${escapeHtml(getSiteIcon(site))}</span>
          <div class="managed-site-name-wrap">
            <span class="managed-site-name">${escapeHtml(site.name)}</span>
            <span class="managed-site-url">${escapeHtml(site.url)}</span>
          </div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" data-action="toggle-service" data-site-id="${escapeAttribute(site.id)}" ${site.enabled ? "checked" : ""} />
          <span>${escapeHtml(t.serviceFieldEnabled)}</span>
        </label>
      </div>
      <div class="managed-site-meta">${chips.join("")}</div>
      ${selectorWarningMarkup}
      <div class="managed-site-actions">
        <button class="ghost-button" type="button" data-action="edit-service" data-site-id="${escapeAttribute(site.id)}">${escapeHtml(t.serviceEdit)}</button>
        ${site.deletable ? `<button class="ghost-button danger-button" type="button" data-action="delete-service" data-site-id="${escapeAttribute(site.id)}">${escapeHtml(t.serviceDelete)}</button>` : ""}
      </div>
    </article>
  `;
}
function renderManagedSites() {
  if (state.runtimeSites.length === 0) {
    managedSitesList.innerHTML = `<div class="managed-site-empty">${escapeHtml(t.serviceEmptyList)}</div>`;
    return;
  }
  managedSitesList.innerHTML = state.runtimeSites.map((site) => buildManagedSiteMarkup(site)).join("");
}
function readServiceEditorDraft() {
  const selectedInputType = document.querySelector("input[name='service-input-type']:checked");
  return {
    id: state.serviceEditor?.siteId ?? "",
    name: serviceNameInput.value.trim(),
    url: serviceUrlInput.value.trim(),
    inputSelector: serviceInputSelectorInput.value.trim(),
    inputType: selectedInputType?.value ?? "textarea",
    submitSelector: serviceSubmitSelectorInput.value.trim(),
    submitMethod: serviceSubmitMethodSelect.value,
    selectorCheckMode: state.serviceEditor?.selectorCheckMode ?? "input-and-submit",
    fallbackSelectors: splitMultilineValues(serviceFallbackSelectorsInput.value),
    authSelectors: splitMultilineValues(serviceAuthSelectorsInput.value),
    hostnameAliases: splitMultilineValues(serviceHostnameAliasesInput.value),
    lastVerified: serviceLastVerifiedInput.value.trim(),
    verifiedVersion: serviceVerifiedVersionInput.value.trim(),
    waitMs: Number(serviceWaitRange.value),
    color: serviceColorInput.value,
    icon: serviceIconInput.value.trim(),
    enabled: serviceEnabledInput.checked
  };
}
async function ensureSiteOriginPermission(url, hostnameAliases = []) {
  try {
    const patterns = buildSitePermissionPatterns(url, hostnameAliases);
    if (patterns.length === 0) {
      return false;
    }
    const permission = { origins: patterns };
    const alreadyGranted = await chrome.permissions.contains(permission);
    if (alreadyGranted) {
      return true;
    }
    return await chrome.permissions.request(permission);
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to request site host permission.", error);
    return false;
  }
}
async function testSelectorOnActiveTab() {
  if (!serviceInputSelectorInput.value.trim()) {
    setServiceTestResult(t.serviceTestNoSelector, true);
    return;
  }
  try {
    const response = await chrome.runtime.sendMessage({
      action: "service-test:run",
      draft: readServiceEditorDraft(),
      isBuiltIn: Boolean(state.serviceEditor?.isBuiltIn)
    });
    const result = buildServiceTestResultMessage(response);
    setServiceTestResult(result.message, result.isError);
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Selector test failed.", error);
    setServiceTestResult(t.serviceTestError(error?.message ?? getUnknownErrorText()), true);
  }
}
async function saveServiceEditorDraft() {
  const draft = readServiceEditorDraft();
  const isBuiltIn = Boolean(state.serviceEditor?.isBuiltIn);
  const validation = validateSiteDraft(draft, { isBuiltIn });
  renderServicePermissionPreview(draft, validation);
  if (!validation.valid) {
    setServiceEditorError(validation.errors.join(" "));
    return;
  }
  if (!isBuiltIn) {
    const granted = await ensureSiteOriginPermission(draft.url, draft.hostnameAliases);
    if (!granted) {
      setServiceEditorError(t.servicePermissionDenied);
      return;
    }
  }
  try {
    if (isBuiltIn) {
      await saveBuiltInSiteOverride(state.serviceEditor.siteId, draft);
      await setRuntimeSiteEnabled(state.serviceEditor.siteId, draft.enabled);
    } else {
      await saveCustomSite(draft);
    }
    await refreshStoredData();
    hideServiceEditor();
    setStatus(t.serviceSaved, "success");
    showAppToast(t.serviceSaved, "success", 2200);
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to save service settings.", error);
    setServiceEditorError(error?.message ?? t.serviceValidationError);
  }
}
async function deleteManagedSite(siteId) {
  try {
    await deleteCustomSite(siteId);
    await refreshStoredData();
    setStatus(t.serviceDeleted, "success");
    showAppToast(t.serviceDeleted, "info", 2200);
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to delete custom site.", error);
    setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
  }
}
function setFavoriteTitleInState(favoriteId, title) {
  state.favorites = state.favorites.map(
    (item) => String(item.id) === String(favoriteId) ? { ...item, title } : item
  );
}
function scheduleFavoriteTitleSave(favoriteId, title, immediate = false) {
  const timer = state.favoriteSaveTimers.get(favoriteId);
  if (timer) {
    window.clearTimeout(timer);
  }
  setFavoriteTitleInState(favoriteId, title);
  const runSave = async () => {
    try {
      await updateFavoriteTitle(favoriteId, title);
      setStatus(t.titleSaved, "success");
      showAppToast(t.titleSaved, "success", 1500);
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to save favorite title.", error);
      setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
    }
  };
  if (immediate) {
    state.favoriteSaveTimers.delete(favoriteId);
    void runSave();
    return;
  }
  const nextTimer = window.setTimeout(() => {
    state.favoriteSaveTimers.delete(favoriteId);
    void runSave();
  }, 300);
  state.favoriteSaveTimers.set(favoriteId, nextTimer);
}
async function handleHistoryAction(action, historyId) {
  const item = state.history.find((entry) => Number(entry.id) === Number(historyId));
  if (!item) {
    return;
  }
  if (action === "favorite") {
    await addFavoriteFromHistory(item);
    state.favorites = await getPromptFavorites();
    state.openMenuKey = null;
    renderFavoritesList();
    renderHistoryList();
    setStatus(t.favoriteAdded, "success");
    showAppToast(t.favoriteAdded, "success", 2200);
    return;
  }
  if (action === "resend-history") {
    state.openMenuKey = null;
    renderHistoryList();
    openResendModal(item);
    return;
  }
  if (action === "delete-history") {
    await deletePromptHistoryItem(historyId);
    state.history = await getPromptHistory();
    state.openMenuKey = null;
    renderHistoryList();
    setStatus(t.historyDeleted, "success");
    showAppToast(t.toastHistoryDeleted, "info", 2200);
  }
}
async function handleFavoriteAction(action, favoriteId) {
  const item = getFavoriteById(favoriteId);
  if (action === "delete-favorite") {
    await deleteFavoriteItem(favoriteId);
    state.favorites = await getPromptFavorites();
    state.openMenuKey = null;
    renderFavoritesList();
    setStatus(t.favoriteDeleted, "success");
    showAppToast(t.favoriteDeleted, "info", 2200);
    return;
  }
  if (action === "toggle-pin-favorite") {
    if (item) {
      await updateFavoriteMeta(favoriteId, { pinned: !item.pinned });
      state.favorites = await getPromptFavorites();
      state.openMenuKey = null;
      renderFavoritesList();
    }
    return;
  }
  if (action === "edit-favorite") {
    if (!item) {
      return;
    }
    state.openMenuKey = null;
    renderFavoritesList();
    openFavoriteEditor(item);
    return;
  }
  if (action === "duplicate-favorite") {
    await duplicateFavoriteItem(favoriteId, t.favoriteDuplicatePrefix);
    state.favorites = await getPromptFavorites();
    state.openMenuKey = null;
    renderFavoritesList();
    setStatus(t.favoriteDuplicated, "success");
    showAppToast(t.favoriteDuplicated, "success", 2200);
    return;
  }
  if (action === "run-favorite") {
    if (!item) {
      return;
    }
    await runFavoriteItem(item);
    renderFavoritesList();
  }
}
async function handleSend() {
  if (state.isSending) {
    return;
  }
  clearStatus();
  const prompt = promptInput2.value.trim();
  if (!prompt) {
    setStatus(t.warnEmpty, "error");
    showAppToast(t.toastPromptEmpty, "warning", 2e3);
    promptInput2.focus();
    return;
  }
  const selectedSiteIds = checkedSiteIds();
  if (selectedSiteIds.length === 0) {
    setStatus(t.warnNoSite, "error");
    showAppToast(t.toastNoService, "warning", 2e3);
    return;
  }
  const composerTargets = buildComposerBroadcastTargets(selectedSiteIds, prompt);
  const selectedSites = state.runtimeSites.filter((site) => selectedSiteIds.includes(site.id));
  for (const site of selectedSites) {
    if (!site.isCustom) {
      continue;
    }
    const granted = await ensureSiteOriginPermission(site.url, site.hostnameAliases);
    if (!granted) {
      setStatus(t.servicePermissionDenied, "error");
      showAppToast(t.servicePermissionDenied, "error", 4e3);
      return;
    }
  }
  await openTemplateModalV2(prompt, composerTargets);
}
function bindGlobalEvents() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });
  clearPromptBtn.addEventListener("click", () => {
    promptInput2.value = "";
    scheduleComposeDraftSave("");
    state.loadedFavoriteId = "";
    state.loadedFavoriteTitle = "";
    state.loadedTemplateDefaults = {};
    updatePromptCounter();
    autoResizePromptInput();
    renderTemplateSummary();
    clearStatus();
    promptInput2.focus();
  });
  toggleAllBtn.addEventListener("click", () => {
    const checkboxes = allCheckboxes();
    const shouldCheckAll = !checkboxes.every((checkbox) => checkbox.checked);
    checkboxes.forEach((checkbox) => {
      checkbox.checked = shouldCheckAll;
      checkbox.closest(".site-card")?.classList.toggle("checked", shouldCheckAll);
    });
    syncToggleAllLabel();
    renderTemplateSummary();
  });
  saveFavoriteBtn.addEventListener("click", () => {
    void openFavoriteModal().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to open favorite modal.", error);
      setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
    });
  });
  cancelSendBtn.addEventListener("click", () => {
    void cancelCurrentBroadcast();
  });
  sendBtn.addEventListener("click", (event) => {
    triggerRipple(sendBtn, event);
    void handleSend().catch((error) => {
      console.error("[AI Prompt Broadcaster] Send flow failed.", error);
      setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
    });
  });
  promptInput2.addEventListener("input", () => {
    scheduleComposeDraftSave(promptInput2.value);
    updatePromptCounter();
    autoResizePromptInput();
    renderTemplateSummary();
    document.querySelectorAll(".site-card.sent, .site-card.failed, .site-card.sending").forEach((card) => {
      card.classList.remove("sending", "sent", "failed");
      card.querySelector(".retry-btn")?.remove();
    });
  });
  promptInput2.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void handleSend().catch((error) => {
        console.error("[AI Prompt Broadcaster] Keyboard send failed.", error);
        setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
      });
    }
  });
  historySearchInput.addEventListener("input", (event) => {
    state.historySearch = event.target.value;
    renderHistoryList();
  });
  historySortSelect.addEventListener("change", (event) => {
    const nextValue = event.target.value;
    state.settings = {
      ...state.settings,
      historySort: nextValue
    };
    renderHistoryList();
    void updateAppSettings({ historySort: nextValue }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save history sort.", error);
      setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
    });
  });
  favoritesSearchInput.addEventListener("input", (event) => {
    state.favoritesSearch = event.target.value;
    renderFavoritesList();
  });
  favoritesSortSelect.addEventListener("change", (event) => {
    const nextValue = event.target.value;
    state.settings = {
      ...state.settings,
      favoriteSort: nextValue
    };
    renderFavoritesList();
    void updateAppSettings({ favoriteSort: nextValue }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save favorite sort.", error);
      setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
    });
  });
  document.querySelector("[data-panel='favorites']")?.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-filter-tag],[data-filter-folder],[data-filter-all]");
    if (!chip) return;
    if (chip.dataset.filterAll === "favorites") {
      state.favoritesTagFilter = "";
      state.favoritesFolderFilter = "";
    } else if (chip.dataset.filterTag !== void 0) {
      state.favoritesTagFilter = state.favoritesTagFilter === chip.dataset.filterTag ? "" : chip.dataset.filterTag;
      state.favoritesFolderFilter = "";
    } else if (chip.dataset.filterFolder !== void 0) {
      state.favoritesFolderFilter = state.favoritesFolderFilter === chip.dataset.filterFolder ? "" : chip.dataset.filterFolder;
      state.favoritesTagFilter = "";
    }
    renderFavoritesList();
  });
  historyList.addEventListener("click", (event) => {
    const switchButton = event.target.closest("[data-switch-tab='compose']");
    if (switchButton) {
      switchTab("compose");
      return;
    }
    const loadButton = event.target.closest("[data-load-history]");
    if (loadButton) {
      const item = state.history.find(
        (entry) => Number(entry.id) === Number(loadButton.dataset.loadHistory)
      );
      if (item) {
        loadPromptIntoComposer({ ...item, templateDefaults: {}, title: "" });
      }
      return;
    }
    const menuToggle = event.target.closest("[data-toggle-menu]");
    if (menuToggle) {
      const menuKey = menuToggle.dataset.toggleMenu;
      state.openMenuKey = state.openMenuKey === menuKey ? null : menuKey;
      renderHistoryList();
      return;
    }
    const actionButton = event.target.closest("[data-action][data-history-id]");
    if (actionButton) {
      void handleHistoryAction(
        actionButton.dataset.action,
        actionButton.dataset.historyId
      ).catch((error) => {
        console.error("[AI Prompt Broadcaster] History action failed.", error);
        setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
      });
    }
  });
  historyList.addEventListener("contextmenu", (event) => {
    const item = event.target.closest("[data-history-id]");
    if (!item) {
      return;
    }
    event.preventDefault();
    state.openMenuKey = `history:${item.dataset.historyId}`;
    renderHistoryList();
  });
  favoritesList.addEventListener("click", (event) => {
    const switchButton = event.target.closest("[data-switch-tab='compose']");
    if (switchButton) {
      switchTab("compose");
      return;
    }
    const loadButton = event.target.closest("[data-load-favorite]");
    if (loadButton) {
      const item = state.favorites.find(
        (entry) => String(entry.id) === String(loadButton.dataset.loadFavorite)
      );
      if (item) {
        loadPromptIntoComposer(item);
      }
      return;
    }
    const editButton = event.target.closest("[data-edit-favorite]");
    if (editButton) {
      const item = state.favorites.find(
        (entry) => String(entry.id) === String(editButton.dataset.editFavorite)
      );
      if (item) {
        state.openMenuKey = null;
        renderFavoritesList();
        openFavoriteEditor(item);
      }
      return;
    }
    const menuToggle = event.target.closest("[data-toggle-menu]");
    if (menuToggle) {
      const menuKey = menuToggle.dataset.toggleMenu;
      state.openMenuKey = state.openMenuKey === menuKey ? null : menuKey;
      renderFavoritesList();
      return;
    }
    const actionButton = event.target.closest("[data-action][data-favorite-id]");
    if (actionButton) {
      void handleFavoriteAction(
        actionButton.dataset.action,
        actionButton.dataset.favoriteId
      ).catch((error) => {
        console.error("[AI Prompt Broadcaster] Favorite action failed.", error);
        setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
      });
    }
  });
  favoritesList.addEventListener("contextmenu", (event) => {
    const item = event.target.closest("[data-favorite-id]");
    if (!item) {
      return;
    }
    event.preventDefault();
    state.openMenuKey = `favorite:${item.dataset.favoriteId}`;
    renderFavoritesList();
  });
  favoritesList.addEventListener("input", (event) => {
    const input = event.target.closest("[data-favorite-title]");
    if (!input) {
      return;
    }
    scheduleFavoriteTitleSave(input.dataset.favoriteTitle, input.value, false);
  });
  favoritesList.addEventListener("blur", (event) => {
    const input = event.target.closest("[data-favorite-title]");
    if (!input) {
      return;
    }
    scheduleFavoriteTitleSave(input.dataset.favoriteTitle, input.value, true);
  }, true);
  document.addEventListener("click", (event) => {
    if (!state.openMenuKey) {
      return;
    }
    const insideMenu = event.target.closest(".prompt-actions");
    if (!insideMenu) {
      state.openMenuKey = null;
      renderLists();
    }
  });
  clearHistoryBtn.addEventListener("click", async () => {
    showConfirmToast(t.clearHistoryConfirm, async () => {
      try {
        await clearPromptHistory();
        state.history = [];
        renderHistoryList();
        setStatus(t.historyCleared, "success");
        showAppToast(t.historyCleared, "info", 2200);
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Failed to clear history.", error);
        setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
        showAppToast(t.error(error?.message ?? getUnknownErrorText()), "error", 4e3);
      }
    });
  });
  reuseExistingTabsToggle.addEventListener("change", (event) => {
    const nextValue = Boolean(event.target.checked);
    state.settings = {
      ...state.settings,
      reuseExistingTabs: nextValue
    };
    applySettingsToControls();
    renderSiteCheckboxesPanel();
    void updateAppSettings({ reuseExistingTabs: nextValue }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save tab reuse setting.", error);
      setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
      showAppToast(t.error(error?.message ?? getUnknownErrorText()), "error", 3200);
    });
  });
  waitMultiplierRange.addEventListener("input", (event) => {
    waitMultiplierValue.textContent = t.waitMultiplierValue(Number(event.target.value));
  });
  waitMultiplierRange.addEventListener("change", (event) => {
    const nextValue = Number(event.target.value);
    state.settings = {
      ...state.settings,
      waitMsMultiplier: nextValue
    };
    applySettingsToControls();
    void updateAppSettings({ waitMsMultiplier: nextValue }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save wait multiplier.", error);
      setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
      showAppToast(t.error(error?.message ?? getUnknownErrorText()), "error", 3200);
    });
  });
  openOptionsBtn.addEventListener("click", () => {
    void chrome.runtime.openOptionsPage().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to open options page.", error);
      setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
    });
  });
  exportJsonBtn.addEventListener("click", async () => {
    try {
      const payload = await exportPromptData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json"
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ai-prompt-broadcaster-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus(t.exportSuccess, "success");
    } catch (error) {
      console.error("[AI Prompt Broadcaster] JSON export failed.", error);
      setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
    }
  });
  importJsonBtn.addEventListener("click", () => {
    importJsonInput.click();
  });
  importJsonInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const result = await importPromptData(text);
      await refreshStoredData();
      setStatus(buildImportSummaryText(result.importSummary), "success");
      showAppToast(buildImportSummaryText(result.importSummary, { short: true }), "success", 2600);
      openImportReportModal(result.importSummary);
    } catch (error) {
      setStatus(t.importFailed, "error");
      console.error("[AI Prompt Broadcaster] JSON import failed.", error);
    } finally {
      importJsonInput.value = "";
    }
  });
  addServiceBtn.addEventListener("click", () => {
    resetServiceEditorForm();
    populateServiceEditor(null);
  });
  resetSitesBtn.addEventListener("click", () => {
    showConfirmToast(t.resetServicesConfirm, async () => {
      try {
        await resetSiteSettings();
        await refreshStoredData();
        hideServiceEditor();
        setStatus(t.serviceResetDone, "success");
        showAppToast(t.serviceResetDone, "success", 2200);
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Failed to reset service settings.", error);
        setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
        showAppToast(t.error(error?.message ?? getUnknownErrorText()), "error", 4e3);
      }
    });
  });
  managedSitesList.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action][data-site-id]");
    if (!actionButton) {
      return;
    }
    const { action, siteId } = actionButton.dataset;
    if (!siteId) {
      return;
    }
    if (action === "edit-service") {
      const site = state.runtimeSites.find((entry) => entry.id === siteId);
      if (site) {
        populateServiceEditor(site);
      }
      return;
    }
    if (action === "delete-service") {
      void deleteManagedSite(siteId);
    }
  });
  managedSitesList.addEventListener("change", (event) => {
    const toggle = event.target.closest("[data-action='toggle-service'][data-site-id]");
    if (!toggle) {
      return;
    }
    void setRuntimeSiteEnabled(toggle.dataset.siteId, toggle.checked).then(() => refreshStoredData()).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to toggle site state.", error);
      setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
    });
  });
  testSelectorBtn.addEventListener("click", () => {
    void testSelectorOnActiveTab();
  });
  serviceWaitRange.addEventListener("input", () => {
    serviceWaitValue.textContent = `${serviceWaitRange.value}ms`;
  });
  serviceUrlInput.addEventListener("input", () => {
    if (!serviceEditor.hidden) {
      renderServicePermissionPreview();
    }
  });
  serviceHostnameAliasesInput.addEventListener("input", () => {
    if (!serviceEditor.hidden) {
      renderServicePermissionPreview();
    }
  });
  serviceEditorCancel.addEventListener("click", hideServiceEditor);
  serviceEditorSave.addEventListener("click", () => {
    void saveServiceEditorDraft();
  });
  templateModalClose.addEventListener("click", hideTemplateModal);
  templateModalCancel.addEventListener("click", hideTemplateModal);
  templateModal.addEventListener("click", (event) => {
    if (event.target === templateModal) {
      hideTemplateModal();
    }
  });
  templateFields.addEventListener("input", (event) => {
    const input = event.target.closest("[data-template-input]");
    if (!input || !state.pendingTemplateSend) {
      return;
    }
    state.pendingTemplateSend.userValues[input.dataset.templateInput] = input.value;
    renderTemplateModalV2();
  });
  templateModalConfirm.addEventListener("click", () => {
    void confirmTemplateModalSend().catch((error) => {
      console.error("[AI Prompt Broadcaster] Template modal confirm failed.", error);
      setTemplateModalError(t.error(error?.message ?? getUnknownErrorText()));
    });
  });
  bindFavoriteEditorEvents();
  resendModalClose.addEventListener("click", hideResendModal);
  resendModalCancel.addEventListener("click", hideResendModal);
  resendModal.addEventListener("click", (event) => {
    if (event.target === resendModal) {
      hideResendModal();
    }
  });
  resendModalConfirm.addEventListener("click", () => {
    void confirmResendModal().catch((error) => {
      console.error("[AI Prompt Broadcaster] Resend modal confirm failed.", error);
      setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
    });
  });
  importReportModalClose.addEventListener("click", hideImportReportModal);
  importReportModalConfirm.addEventListener("click", hideImportReportModal);
  importReportModal.addEventListener("click", (event) => {
    if (event.target === importReportModal) {
      hideImportReportModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    trapModalFocus(event);
    void handleGlobalShortcut(event).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to handle popup shortcut.", error);
    });
  });
  chrome.tabs.onCreated.addListener(() => {
    scheduleOpenSiteTabsRefresh();
  });
  chrome.tabs.onRemoved.addListener(() => {
    scheduleOpenSiteTabsRefresh();
  });
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.status || typeof changeInfo.title === "string" || typeof changeInfo.url === "string") {
      scheduleOpenSiteTabsRefresh();
    }
  });
  chrome.tabs.onActivated.addListener(() => {
    scheduleOpenSiteTabsRefresh();
  });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "session") {
      if (changes.lastBroadcast) {
        applyLastBroadcastState(changes.lastBroadcast.newValue ?? null);
      }
      if (changes.pendingUiToasts) {
        void flushPendingSessionToasts();
      }
      if (changes.favoriteRunJobs) {
        void getFavoriteRunJobs().then((favoriteJobs) => {
          state.favoriteJobs = favoriteJobs;
          renderFavoritesList();
        }).catch((error) => {
          console.error("[AI Prompt Broadcaster] Failed to refresh favorite jobs.", error);
        });
      }
      return;
    }
    if (areaName !== "local") {
      return;
    }
    if (changes.promptHistory || changes.promptFavorites || changes.templateVariableCache || changes.appSettings || changes.customSites || changes.builtInSiteStates || changes.builtInSiteOverrides || changes.failedSelectors) {
      void loadStoredData().catch((error) => {
        console.error("[AI Prompt Broadcaster] Storage change refresh failed.", error);
      });
    }
  });
}
async function init() {
  try {
    applyI18n();
    document.documentElement.lang = isKorean ? "ko" : "en";
    resetTransientModals();
    initToastRoot(toastHost);
    renderTabLabels();
    bindGlobalEvents();
    const hashTab = {
      "#compose": "compose",
      "#history": "history",
      "#favorites": "favorites",
      "#settings": "settings"
    }[location.hash];
    if (hashTab) {
      state.activeTab = hashTab;
    }
    switchTab(state.activeTab);
    syncToggleAllLabel();
    await loadStoredData();
    await maybeHandlePopupFavoriteIntent();
    await chrome.runtime.sendMessage({ action: "popupOpened" }).catch(() => null);
    applyLastBroadcastState(await getLastBroadcast(), { silentToast: false });
    await flushPendingSessionToasts();
    if (!getOpenOverlay()) {
      promptInput2.focus();
    }
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to initialize popup.", error);
    setStatus(t.error(error?.message ?? getUnknownErrorText()), "error");
    showAppToast(t.error(error?.message ?? getUnknownErrorText()), "error", 4e3);
  }
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void init();
  }, { once: true });
} else {
  void init();
}
