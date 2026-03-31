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

// src/shared/prompts/constants.ts
var LOCAL_STORAGE_KEYS = Object.freeze({
  history: "promptHistory",
  favorites: "promptFavorites",
  templateVariableCache: "templateVariableCache",
  settings: "appSettings"
});
var DEFAULT_HISTORY_LIMIT = 50;
var MIN_HISTORY_LIMIT = 10;
var MAX_HISTORY_LIMIT = 200;
var DEFAULT_SETTINGS = Object.freeze({
  historyLimit: DEFAULT_HISTORY_LIMIT,
  autoClosePopup: false,
  desktopNotifications: true,
  reuseExistingTabs: true
});

// src/shared/prompts/normalizers.ts
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
      safeArray(sentTo).filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim())
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
function normalizeSettings(value) {
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
    )
  };
}
function normalizeStatus(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "submitted";
}
function normalizeStringRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [safeText(key).trim(), safeText(entryValue).trim()]).filter(([key, entryValue]) => key && entryValue)
  );
}
function sortByDateDesc(items, field = "createdAt") {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left[field] ?? "") || 0;
    const rightTime = Date.parse(right[field] ?? "") || 0;
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

// src/shared/prompts/storage.ts
async function readLocal(key, fallbackValue) {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? fallbackValue;
}
async function writeLocal(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

// src/shared/prompts/favorites-store.ts
function buildFavoriteEntry(entry) {
  const createdAt = normalizeIsoDate(entry?.createdAt);
  const favoritedAt = normalizeIsoDate(entry?.favoritedAt, createdAt);
  return {
    id: typeof entry?.id === "string" && entry.id.trim() ? entry.id.trim() : `fav-${Date.now()}`,
    sourceHistoryId: entry?.sourceHistoryId === null || entry?.sourceHistoryId === void 0 ? null : Number(entry.sourceHistoryId),
    title: safeText(entry?.title),
    text: safeText(entry?.text),
    sentTo: normalizeSentTo(entry?.sentTo),
    createdAt,
    favoritedAt,
    templateDefaults: normalizeTemplateDefaults(entry?.templateDefaults),
    tags: normalizeTags(entry?.tags),
    folder: safeText(entry?.folder).slice(0, 50),
    pinned: normalizeBoolean(entry?.pinned, false)
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
    templateDefaults: entry?.templateDefaults
  });
  await setPromptFavorites([favorite, ...favorites]);
  return favorite;
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
function buildHistoryEntry(entry) {
  const createdAt = normalizeIsoDate(entry?.createdAt);
  const siteResults = normalizeStringRecord(entry?.siteResults);
  const siteResultKeys = normalizeSiteIdList(Object.keys(siteResults));
  const submittedSiteIds = normalizeSiteIdList(
    Array.isArray(entry?.submittedSiteIds) ? entry.submittedSiteIds : entry?.sentTo
  );
  const failedSiteIds = normalizeSiteIdList(
    Array.isArray(entry?.failedSiteIds) ? entry.failedSiteIds : siteResultKeys.filter((siteId) => !submittedSiteIds.includes(siteId))
  );
  const requestedSiteIds = normalizeSiteIdList(
    Array.isArray(entry?.requestedSiteIds) ? entry.requestedSiteIds : siteResultKeys.length > 0 ? siteResultKeys : submittedSiteIds
  );
  return {
    id: Number.isFinite(entry?.id) ? Number(entry.id) : Date.now(),
    text: safeText(entry?.text),
    requestedSiteIds,
    submittedSiteIds,
    failedSiteIds,
    sentTo: submittedSiteIds,
    createdAt,
    status: normalizeStatus(entry?.status),
    siteResults
  };
}
async function getPromptHistory() {
  const historyLimit = await getHistoryLimit();
  const rawHistory = await readLocal(LOCAL_STORAGE_KEYS.history, []);
  return sortByDateDesc(
    safeArray(rawHistory).map((item) => buildHistoryEntry(item))
  ).slice(0, historyLimit);
}
async function setPromptHistory(historyItems) {
  const historyLimit = await getHistoryLimit();
  const normalized = sortByDateDesc(
    safeArray(historyItems).map((item) => buildHistoryEntry(item))
  ).slice(0, historyLimit);
  await writeLocal(LOCAL_STORAGE_KEYS.history, normalized);
  return normalized;
}
async function deletePromptHistoryItem(historyId) {
  const history = await getPromptHistory();
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
    inputSelector: "div.ql-editor.textarea.new-input-ui[contenteditable='true'], div.ql-editor[contenteditable='true'][role='textbox']",
    fallbackSelectors: [
      "div.ql-editor.textarea.new-input-ui[contenteditable='true']",
      "div.ql-editor[contenteditable='true'][role='textbox']",
      "div[contenteditable='true'][role='textbox']",
      "textarea, div[contenteditable='true']"
    ],
    inputType: "contenteditable",
    submitSelector: "button.send-button, button[aria-label*='send' i], button[aria-label*='보내기' i]",
    submitMethod: "click",
    selectorCheckMode: "input-and-submit",
    waitMs: 2500,
    fallback: true,
    lastVerified: "2026-03",
    verifiedVersion: "gemini-app-mar-2026",
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
    inputSelector: "div[contenteditable='true'][aria-label='Write your prompt to Claude'], div[contenteditable='true'][role='textbox']",
    fallbackSelectors: [
      "div[contenteditable='true'][aria-label='Write your prompt to Claude']",
      "div[contenteditable='true'][role='textbox']",
      "div[contenteditable='true']",
      "textarea"
    ],
    inputType: "contenteditable",
    submitSelector: "button[aria-label='Send message'], button[aria-label*='send' i], button[aria-label*='submit' i], button[aria-label*='보내' i], button[aria-label*='전송' i]",
    submitMethod: "click",
    selectorCheckMode: "input-and-submit",
    waitMs: 1500,
    fallback: true,
    lastVerified: "2026-03",
    verifiedVersion: "claude-web-mar-2026",
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
var BUILT_IN_SITE_IDS = new Set(AI_SITES.map((site) => site.id));
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
function buildOriginPattern(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}/*`;
  } catch (_error) {
    return "";
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
  const normalizedSelectors = normalizePerplexitySelectors(site);
  return {
    id: safeText2(site.id),
    name: safeText2(site.name) || "AI Service",
    url,
    hostname,
    hostnameAliases: normalizeHostnameAliases(site.hostnameAliases, hostname),
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
    permissionPattern: buildOriginPattern(url)
  };
}
function sanitizeBuiltInOverride(override = {}, originalSite = {}) {
  return {
    name: safeText2(override.name) || originalSite.name,
    inputSelector: safeText2(override.inputSelector) || originalSite.inputSelector,
    inputType: normalizeInputType(override.inputType, originalSite.inputType),
    submitSelector: safeText2(override.submitSelector),
    submitMethod: normalizeSubmitMethod(override.submitMethod, originalSite.submitMethod),
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
function validateSiteDraft(draft, { isBuiltIn = false } = {}) {
  const errors = [];
  const name = safeText2(draft?.name);
  const url = safeText2(draft?.url);
  const inputSelector = safeText2(draft?.inputSelector);
  if (!name) {
    errors.push("Service name is required.");
  }
  if (!isBuiltIn && !url) {
    errors.push("Service URL is required.");
  }
  if (url && !isValidURL(url)) {
    errors.push("Service URL must be a valid http or https URL.");
  }
  if (!inputSelector) {
    errors.push("Input selector is required.");
  }
  if (!VALID_INPUT_TYPES.has(safeText2(draft?.inputType))) {
    errors.push("Input type is invalid.");
  }
  if (!VALID_SUBMIT_METHODS.has(safeText2(draft?.submitMethod))) {
    errors.push("Submit method is invalid.");
  }
  const selectorCheckMode = safeText2(draft?.selectorCheckMode);
  if (selectorCheckMode && !VALID_SELECTOR_CHECK_MODES.has(selectorCheckMode)) {
    errors.push("Selector check mode is invalid.");
  }
  if (safeText2(draft?.submitMethod) === "click" && !safeText2(draft?.submitSelector)) {
    errors.push("Submit selector is required when using click submit.");
  }
  return {
    valid: errors.length === 0,
    errors
  };
}

// src/shared/sites/import-repair.ts
function detectBuiltInOverrideAdjustment(rawEntry, sanitized, source) {
  if (!isPlainObject(rawEntry)) {
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
  if (Object.keys(rawEntry).some((key) => !allowedKeys.has(key))) {
    return true;
  }
  const simpleComparisons = [
    ["name", safeText2(rawEntry.name), sanitized.name],
    ["inputSelector", safeText2(rawEntry.inputSelector), sanitized.inputSelector],
    ["inputType", safeText2(rawEntry.inputType), sanitized.inputType],
    ["submitSelector", safeText2(rawEntry.submitSelector), sanitized.submitSelector],
    ["submitMethod", safeText2(rawEntry.submitMethod), sanitized.submitMethod],
    ["selectorCheckMode", safeText2(rawEntry.selectorCheckMode), sanitized.selectorCheckMode],
    ["lastVerified", safeText2(rawEntry.lastVerified), sanitized.lastVerified],
    ["verifiedVersion", safeText2(rawEntry.verifiedVersion), sanitized.verifiedVersion],
    ["color", safeText2(rawEntry.color), sanitized.color],
    ["icon", safeText2(rawEntry.icon), sanitized.icon]
  ];
  for (const [key, rawValue, sanitizedValue] of simpleComparisons) {
    if (Object.prototype.hasOwnProperty.call(rawEntry, key) && rawValue !== sanitizedValue) {
      return true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(rawEntry, "waitMs") && normalizeWaitMs(rawEntry.waitMs, source.waitMs) !== sanitized.waitMs) {
    return true;
  }
  if (Array.isArray(rawEntry.fallbackSelectors) && stringifyComparable(rawEntry.fallbackSelectors.filter((entry) => typeof entry === "string" && entry.trim())) !== stringifyComparable(sanitized.fallbackSelectors)) {
    return true;
  }
  if (Array.isArray(rawEntry.authSelectors) && stringifyComparable(rawEntry.authSelectors.filter((entry) => typeof entry === "string" && entry.trim())) !== stringifyComparable(sanitized.authSelectors)) {
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
  for (const [key, entry] of Object.entries(value)) {
    if (!BUILT_IN_SITE_IDS.has(key)) {
      droppedIds.push(key);
      continue;
    }
    normalized[key] = { enabled: normalizeBoolean2(entry?.enabled, true) };
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
  for (const [key, entry] of Object.entries(value)) {
    const source = AI_SITES.find((site) => site.id === key);
    if (!source) {
      droppedIds.push(key);
      continue;
    }
    const sanitized = sanitizeBuiltInOverride(entry, source);
    normalized[key] = sanitized;
    appliedIds.push(key);
    if (detectBuiltInOverrideAdjustment(entry, sanitized, source)) {
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
    const validation = validateSiteDraft(normalized);
    if (!validation.valid) {
      rejectedSites.push({
        id: safeText2(rawSite?.id) || normalized.id,
        name: normalized.name,
        reason: "validation_failed",
        errors: validation.errors
      });
      continue;
    }
    const requestedId = safeText2(rawSite?.id) || "";
    let finalId = requestedId;
    if (!finalId) {
      finalId = ensureUniqueImportedSiteId(
        createImportedCustomSiteIdBase(
          {
            ...rawSite,
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
          ...rawSite,
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
  return nextSite;
}
async function saveBuiltInSiteOverride(siteId, overrideDraft) {
  const source = AI_SITES.find((site) => site.id === siteId);
  if (!source) {
    throw new Error("Built-in site not found.");
  }
  const overrides = await getBuiltInSiteOverrides();
  overrides[siteId] = sanitizeBuiltInOverride(overrideDraft, source);
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
  return nextSites;
}
async function resetSiteSettings() {
  await resetStoredSiteSettings();
}
function buildSitePermissionPattern(url) {
  return buildOriginPattern(url);
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
async function repairImportedCustomSitesWithPermissions(rawSites) {
  const repaired = repairImportedCustomSites(rawSites);
  const requestedOrigins = Array.from(
    new Set(
      repaired.repairedSites.map((site) => site.permissionPattern).filter((pattern) => typeof pattern === "string" && pattern.trim())
    )
  );
  const grantedOrigins = /* @__PURE__ */ new Set();
  const missingOrigins = [];
  for (const origin of requestedOrigins) {
    if (await containsOriginPermission(origin)) {
      grantedOrigins.add(origin);
    } else {
      missingOrigins.push(origin);
    }
  }
  let deniedOrigins = [];
  if (missingOrigins.length > 0) {
    try {
      const granted = chrome.permissions?.request ? await chrome.permissions.request({ origins: missingOrigins }) : false;
      if (granted) {
        for (const origin of missingOrigins) {
          grantedOrigins.add(origin);
        }
      } else {
        deniedOrigins = [...missingOrigins];
      }
    } catch (_error) {
      deniedOrigins = [...missingOrigins];
    }
  }
  const acceptedSites = [];
  const permissionDeniedSites = [];
  for (const site of repaired.repairedSites) {
    if (!site.permissionPattern || grantedOrigins.has(site.permissionPattern)) {
      acceptedSites.push(site);
      continue;
    }
    permissionDeniedSites.push({
      id: site.id,
      name: site.name,
      reason: "permission_denied",
      origin: site.permissionPattern
    });
  }
  return {
    acceptedSites,
    rejectedSites: [...repaired.rejectedSites, ...permissionDeniedSites],
    rewrittenIds: repaired.rewrittenIds,
    deniedOrigins,
    requestedOrigins
  };
}
async function exportPromptData() {
  const [
    history,
    favorites,
    templateVariableCache,
    settings,
    customSites,
    builtInSiteStates,
    builtInSiteOverrides
  ] = await Promise.all([
    getPromptHistory(),
    getPromptFavorites(),
    getTemplateVariableCache(),
    getAppSettings(),
    getCustomSites(),
    getBuiltInSiteStates(),
    getBuiltInSiteOverrides()
  ]);
  return {
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    version: 2,
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
  const history = safeArray(parsed?.history).map((item) => buildHistoryEntry(item));
  const favorites = safeArray(parsed?.favorites).map(
    (item) => buildFavoriteEntry(item)
  );
  const templateVariableCache = normalizeTemplateDefaults(parsed?.templateVariableCache);
  const importedSettings = normalizeSettings(parsed?.settings ?? DEFAULT_SETTINGS);
  const importedCustomSites = safeArray(parsed?.customSites);
  const importedBuiltInSiteStates = safeObject(parsed?.builtInSiteStates);
  const importedBuiltInSiteOverrides = safeObject(parsed?.builtInSiteOverrides);
  const historyLimit = importedSettings.historyLimit;
  const normalizedHistory = [];
  for (const item of sortByDateDesc(history).slice(0, historyLimit)) {
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
    setPromptFavorites(normalizedFavorites),
    setTemplateVariableCache(templateVariableCache),
    setCustomSites(customSiteImport.acceptedSites),
    setBuiltInSiteStates(builtInStateImport.normalized),
    setBuiltInSiteOverrides(builtInOverrideImport.normalized)
  ]);
  await setPromptHistory(normalizedHistory);
  return {
    history: normalizedHistory,
    favorites: normalizedFavorites,
    templateVariableCache,
    settings: importedSettings,
    customSites: customSiteImport.acceptedSites,
    builtInSiteStates: builtInStateImport.normalized,
    builtInSiteOverrides: builtInOverrideImport.normalized,
    importSummary: {
      customSites: {
        importedCount: importedCustomSites.length,
        acceptedIds: customSiteImport.acceptedSites.map((site) => site.id),
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

// src/shared/runtime-state/constants.ts
var LOCAL_RUNTIME_KEYS = Object.freeze({
  failedSelectors: "failedSelectors",
  onboardingCompleted: "onboardingCompleted"
});
var SESSION_RUNTIME_KEYS = Object.freeze({
  pendingUiToasts: "pendingUiToasts",
  lastBroadcast: "lastBroadcast"
});

// src/shared/runtime-state/normalizers.ts
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
  return {
    serviceId: safeText3(entry?.serviceId),
    selector: safeText3(entry?.selector),
    source: safeText3(entry?.source),
    timestamp: normalizeIsoDate2(entry?.timestamp)
  };
}
function normalizeToastAction(action) {
  return {
    id: safeText3(action?.id) || `action-${Date.now()}`,
    label: safeText3(action?.label) || "Action",
    variant: safeText3(action?.variant) || "default"
  };
}
function normalizeUiToast(entry) {
  return {
    id: safeText3(entry?.id) || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message: safeText3(entry?.message),
    type: safeText3(entry?.type) || "info",
    duration: Number.isFinite(Number(entry?.duration)) ? Number(entry.duration) : 3e3,
    createdAt: normalizeIsoDate2(entry?.createdAt),
    actions: normalizeArray(entry?.actions).map((action) => normalizeToastAction(action)),
    meta: entry?.meta && typeof entry.meta === "object" && !Array.isArray(entry.meta) ? entry.meta : {}
  };
}
function normalizeLastBroadcast(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
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
    siteResults: value.siteResults && typeof value.siteResults === "object" && !Array.isArray(value.siteResults) ? Object.fromEntries(
      Object.entries(value.siteResults).map(([key, status]) => [safeText3(key), safeText3(status)]).filter(([key, status]) => key && status)
    ) : {},
    startedAt: normalizeIsoDate2(value.startedAt),
    finishedAt: safeText3(value.finishedAt) ? normalizeIsoDate2(value.finishedAt) : ""
  };
}

// src/shared/runtime-state/storage.ts
async function readStorage(area, key, fallbackValue) {
  const result = await chrome.storage[area].get(key);
  return result[key] ?? fallbackValue;
}
async function writeStorage(area, key, value) {
  await chrome.storage[area].set({ [key]: value });
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
var uiLanguage2 = chrome.i18n.getUILanguage().toLowerCase();
var isKorean = uiLanguage2 === "ko" || uiLanguage2.startsWith("ko-");
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
  favoriteTitleLabel: msg("popup_favorite_title_label"),
  favoriteSaveDefaultsLabel: msg("popup_favorite_save_defaults_label"),
  favoriteDefaultsLabel: msg("popup_favorite_defaults_label"),
  clearPrompt: msg("popup_clear_prompt") || "Clear",
  promptCounter: (current, limit) => `${current} / ${limit}`,
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
  openTabsLoading: msg("popup_open_tabs_loading") || "Loading"
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
  favoriteSaveTimers: /* @__PURE__ */ new Map(),
  loadedTemplateDefaults: {},
  loadedFavoriteTitle: "",
  templateVariableCache: {},
  pendingTemplateSend: null,
  pendingFavoriteSave: null,
  runtimeSites: [],
  serviceEditor: null,
  failedSelectors: /* @__PURE__ */ new Map(),
  lastBroadcast: null,
  lastBroadcastToastSignature: "",
  isSending: false,
  sendSafetyTimer: null,
  settings: { ...DEFAULT_SETTINGS },
  openSiteTabs: [],
  siteTargetSelections: {},
  sitePromptOverrides: {},
  // siteId -> override prompt string
  openTabsWindowId: null,
  openTabsRefreshTimer: null
};

// src/popup/app/bootstrap.ts
var extTitle = document.getElementById("ext-title");
var extDesc = document.getElementById("ext-desc");
var tabButtons = [...document.querySelectorAll(".tab-button")];
var panels = [...document.querySelectorAll(".tab-panel")];
var promptInput = document.getElementById("prompt-input");
var promptCounter = document.getElementById("prompt-counter");
var clearPromptBtn = document.getElementById("clear-prompt-btn");
var templateSummary = document.getElementById("template-summary");
var templateSummaryLabel = document.getElementById("template-summary-label");
var templateChipList = document.getElementById("template-chip-list");
var sitesLabel = document.getElementById("sites-label");
var sitesContainer = document.getElementById("sites-container");
var toggleAllBtn = document.getElementById("toggle-all");
var saveFavoriteBtn = document.getElementById("save-favorite-btn");
var cancelSendBtn = document.getElementById("cancel-send-btn");
var sendBtn = document.getElementById("send-btn");
var statusMsg = document.getElementById("status-message");
var historySearchInput = document.getElementById("history-search");
var favoritesSearchInput = document.getElementById("favorites-search");
var historyList = document.getElementById("history-list");
var favoritesList = document.getElementById("favorites-list");
var settingsTitle = document.getElementById("settings-title");
var settingsDesc = document.getElementById("settings-desc");
var reuseExistingTabsToggle = document.getElementById("reuse-existing-tabs-toggle");
var reuseExistingTabsLabel = document.getElementById("reuse-existing-tabs-label");
var reuseExistingTabsDesc = document.getElementById("reuse-existing-tabs-desc");
var openOptionsBtn = document.getElementById("open-options-btn");
var clearHistoryBtn = document.getElementById("clear-history-btn");
var exportJsonBtn = document.getElementById("export-json-btn");
var importJsonBtn = document.getElementById("import-json-btn");
var importJsonInput = document.getElementById("import-json-input");
var serviceManagementTitle = document.getElementById("service-management-title");
var serviceManagementDesc = document.getElementById("service-management-desc");
var addServiceBtn = document.getElementById("add-service-btn");
var resetSitesBtn = document.getElementById("reset-sites-btn");
var managedSitesList = document.getElementById("managed-sites-list");
var serviceEditor = document.getElementById("service-editor");
var serviceEditorTitle = document.getElementById("service-editor-title");
var serviceEditorDesc = document.getElementById("service-editor-desc");
var serviceNameLabel = document.getElementById("service-name-label");
var serviceNameInput = document.getElementById("service-name-input");
var serviceUrlLabel = document.getElementById("service-url-label");
var serviceUrlInput = document.getElementById("service-url-input");
var serviceInputSelectorLabel = document.getElementById("service-input-selector-label");
var serviceInputSelectorInput = document.getElementById("service-input-selector-input");
var testSelectorBtn = document.getElementById("test-selector-btn");
var serviceInputTypeLabel = document.getElementById("service-input-type-label");
var serviceSubmitSelectorLabel = document.getElementById("service-submit-selector-label");
var serviceSubmitSelectorInput = document.getElementById("service-submit-selector-input");
var serviceSubmitMethodLabel = document.getElementById("service-submit-method-label");
var serviceSubmitMethodSelect = document.getElementById("service-submit-method-select");
var serviceAdvancedTitle = document.getElementById("service-advanced-title");
var serviceFallbackSelectorsLabel = document.getElementById("service-fallback-selectors-label");
var serviceFallbackSelectorsInput = document.getElementById("service-fallback-selectors-input");
var serviceAuthSelectorsLabel = document.getElementById("service-auth-selectors-label");
var serviceAuthSelectorsInput = document.getElementById("service-auth-selectors-input");
var serviceHostnameAliasesLabel = document.getElementById("service-hostname-aliases-label");
var serviceHostnameAliasesInput = document.getElementById("service-hostname-aliases-input");
var serviceLastVerifiedLabel = document.getElementById("service-last-verified-label");
var serviceLastVerifiedInput = document.getElementById("service-last-verified-input");
var serviceVerifiedVersionLabel = document.getElementById("service-verified-version-label");
var serviceVerifiedVersionInput = document.getElementById("service-verified-version-input");
var serviceWaitLabel = document.getElementById("service-wait-label");
var serviceWaitRange = document.getElementById("service-wait-range");
var serviceWaitValue = document.getElementById("service-wait-value");
var serviceColorLabel = document.getElementById("service-color-label");
var serviceColorInput = document.getElementById("service-color-input");
var serviceIconLabel = document.getElementById("service-icon-label");
var serviceIconInput = document.getElementById("service-icon-input");
var serviceEnabledLabel = document.getElementById("service-enabled-label");
var serviceEnabledInput = document.getElementById("service-enabled-input");
var serviceTestResult = document.getElementById("service-test-result");
var serviceEditorError = document.getElementById("service-editor-error");
var serviceEditorCancel = document.getElementById("service-editor-cancel");
var serviceEditorSave = document.getElementById("service-editor-save");
var toastHost = document.getElementById("toast-host");
var templateModal = document.getElementById("template-modal");
var templateModalTitle = document.getElementById("template-modal-title");
var templateModalDesc = document.getElementById("template-modal-desc");
var templateModalClose = document.getElementById("template-modal-close");
var templateModalSystemInfo = document.getElementById("template-modal-system-info");
var templateFields = document.getElementById("template-fields");
var templatePreviewLabel = document.getElementById("template-preview-label");
var templatePreview = document.getElementById("template-preview");
var templateModalError = document.getElementById("template-modal-error");
var templateModalCancel = document.getElementById("template-modal-cancel");
var templateModalConfirm = document.getElementById("template-modal-confirm");
var favoriteModal = document.getElementById("favorite-modal");
var favoriteModalTitle = document.getElementById("favorite-modal-title");
var favoriteModalDesc = document.getElementById("favorite-modal-desc");
var favoriteModalClose = document.getElementById("favorite-modal-close");
var favoriteTitleLabel = document.getElementById("favorite-title-label");
var favoriteTitleInput = document.getElementById("favorite-title-input");
var favoriteSaveDefaultsRow = document.getElementById("favorite-save-defaults-row");
var favoriteSaveDefaults = document.getElementById("favorite-save-defaults");
var favoriteSaveDefaultsLabel = document.getElementById("favorite-save-defaults-label");
var favoriteDefaultFieldsWrap = document.getElementById("favorite-default-fields-wrap");
var favoriteDefaultFieldsLabel = document.getElementById("favorite-default-fields-label");
var favoriteDefaultFields = document.getElementById("favorite-default-fields");
var favoriteModalError = document.getElementById("favorite-modal-error");
var favoriteModalCancel = document.getElementById("favorite-modal-cancel");
var favoriteModalConfirm = document.getElementById("favorite-modal-confirm");
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
  const limit = Number(promptInput.maxLength) || 2e3;
  promptCounter.textContent = t.promptCounter(promptInput.value.length, limit);
}
function autoResizePromptInput() {
  promptInput.style.height = "auto";
  const nextHeight = Math.max(100, Math.min(promptInput.scrollHeight, 300));
  promptInput.style.height = `${nextHeight}px`;
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
  promptInput.setAttribute("placeholder", nextPlaceholder);
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
function getHistorySelectedSiteIds(item) {
  return normalizeSiteIdList2(
    Array.isArray(item?.requestedSiteIds) && item.requestedSiteIds.length > 0 ? item.requestedSiteIds : item?.sentTo
  );
}
function getTemplateDisplayName(name) {
  return getTemplateVariableDisplayName(name, uiLanguage);
}
function joinMultilineValues(values) {
  return Array.isArray(values) ? values.join("\n") : "";
}
function splitMultilineValues(value) {
  return String(value ?? "").split(/\r?\n/g).map((entry) => entry.trim()).filter(Boolean);
}
function renderServiceBadges(siteIds = []) {
  return siteIds.map((siteId) => {
    const site = state.runtimeSites.find((entry) => entry.id === siteId);
    const label = getSiteIcon(site) ?? siteId.slice(0, 2).toUpperCase();
    return `<span class="service-badge">${escapeHtml(label)}</span>`;
  }).join("");
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
    checkbox.closest(".site-card")?.classList.toggle("checked", shouldCheck);
  });
  syncToggleAllLabel();
}
function switchTab(tabId) {
  state.activeTab = tabId;
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabId);
  });
  panels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tabId);
  });
  state.openMenuKey = null;
  renderLists();
}
function buildEmptyState(message) {
  return `
    <div class="empty-state">
      <div>${escapeHtml(message)}</div>
      <button class="empty-action" type="button" data-switch-tab="compose">${escapeHtml(t.emptyActionCompose)}</button>
    </div>
  `;
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
function buildHistoryItemMarkup(item) {
  const menuKey = `history:${item.id}`;
  return `
    <article class="prompt-item" data-history-id="${item.id}">
      <button class="prompt-main" type="button" data-load-history="${item.id}">
        <div class="prompt-preview">${escapeHtml(previewText(item.text))}</div>
        <div class="prompt-meta">
          <div class="service-icons">${renderServiceBadges(getHistorySelectedSiteIds(item))}</div>
          <span>${escapeHtml(formatDate(item.createdAt))}</span>
        </div>
      </button>
      <div class="prompt-actions">
        <button class="menu-button" type="button" aria-label="${escapeAttribute(t.menuMore)}" data-toggle-menu="${escapeAttribute(menuKey)}">...</button>
        <div class="item-menu ${state.openMenuKey === menuKey ? "open" : ""}">
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
  const tagChips = tags.map(
    (tag) => `<span class="fav-tag-chip" data-filter-tag="${escapeAttribute(tag)}">#${escapeHtml(tag)}</span>`
  ).join("");
  if (!pinIcon && !folderBadge && !tagChips) return "";
  return `<div class="fav-meta-row">${pinIcon}${folderBadge}${tagChips}</div>`;
}
function buildFavoriteItemMarkup(item) {
  const menuKey = `favorite:${item.id}`;
  const safeFavoriteId = escapeAttribute(item.id);
  const pinLabel = item.pinned ? msg("popup_favorite_unpin") || "Unpin" : msg("popup_favorite_pin") || "Pin";
  return `
    <article class="prompt-item${item.pinned ? " pinned-item" : ""}" data-favorite-id="${safeFavoriteId}">
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
      <button class="prompt-main" type="button" data-load-favorite="${safeFavoriteId}">
        <div class="prompt-preview">${escapeHtml(previewText(item.text))}</div>
        <div class="prompt-meta">
          <div class="service-icons">${renderServiceBadges(item.sentTo)}</div>
          <span>${escapeHtml(formatDate(item.createdAt))}</span>
        </div>
      </button>
      <div class="prompt-actions">
        <button class="menu-button" type="button" aria-label="${escapeAttribute(t.menuMore)}" data-toggle-menu="${escapeAttribute(menuKey)}">...</button>
        <div class="item-menu ${state.openMenuKey === menuKey ? "open" : ""}">
          <button class="menu-item" type="button" data-action="edit-favorite-tags" data-favorite-id="${safeFavoriteId}">${escapeHtml(msg("popup_favorite_edit_tags") || "Edit tags & folder")}</button>
          <button class="menu-item" type="button" data-action="toggle-pin-favorite" data-favorite-id="${safeFavoriteId}">${escapeHtml(pinLabel)}</button>
          <button class="menu-item danger" type="button" data-action="delete-favorite" data-favorite-id="${safeFavoriteId}">${escapeHtml(t.delete)}</button>
        </div>
      </div>
    </article>
  `;
}
function renderHistoryList() {
  const items = filterItems(state.history, state.historySearch);
  if (items.length === 0) {
    historyList.innerHTML = buildEmptyState(
      state.historySearch ? t.noSearchResults : t.historyEmpty
    );
    return;
  }
  historyList.innerHTML = items.map((item) => buildHistoryItemMarkup(item)).join("");
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
  let filtered = filterItems(items, state.favoritesSearch);
  if (state.favoritesTagFilter) {
    filtered = filtered.filter((item) => (item.tags ?? []).includes(state.favoritesTagFilter));
  }
  if (state.favoritesFolderFilter) {
    filtered = filtered.filter((item) => (item.folder ?? "").trim() === state.favoritesFolderFilter);
  }
  return [...filtered].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });
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
  favoritesList.innerHTML = items.map((item) => buildFavoriteItemMarkup(item)).join("");
}
function renderLists() {
  renderHistoryList();
  renderFavoritesList();
}
function currentPromptVariables() {
  return detectTemplateVariables(promptInput.value);
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
function compactVariableValues(values) {
  return Object.fromEntries(
    Object.entries(values ?? {}).map(([name, value]) => [String(name), String(value ?? "")]).filter(([, value]) => value.trim())
  );
}
function mergeTemplateSources(...sources) {
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
}
function buildBroadcastTargets(siteIds = []) {
  return normalizeSiteIdList2(siteIds).map((siteId) => {
    const targetSelection = state.siteTargetSelections?.[siteId];
    const promptOverride = typeof state.sitePromptOverrides?.[siteId] === "string" && state.sitePromptOverrides[siteId].trim() ? state.sitePromptOverrides[siteId].trim() : void 0;
    if (typeof targetSelection === "number") {
      return { id: siteId, tabId: targetSelection, ...promptOverride ? { promptOverride } : {} };
    }
    if (targetSelection === "new") {
      return { id: siteId, reuseExistingTab: false, target: "new", ...promptOverride ? { promptOverride } : {} };
    }
    return { id: siteId, ...promptOverride ? { promptOverride } : {} };
  });
}
async function loadStoredData() {
  try {
    const [history, favorites, variableCache, runtimeSites, promptResult, failedSelectors, settings] = await Promise.all([
      getPromptHistory(),
      getPromptFavorites(),
      getTemplateVariableCache(),
      getRuntimeSites(),
      chrome.storage.local.get(["lastPrompt"]),
      getFailedSelectors(),
      getAppSettings()
    ]);
    state.history = history;
    state.favorites = favorites;
    state.templateVariableCache = variableCache;
    state.runtimeSites = runtimeSites;
    state.failedSelectors = new Map(failedSelectors.map((entry) => [entry.serviceId, entry]));
    state.settings = settings;
    await refreshOpenSiteTabs();
    if (typeof promptResult.lastPrompt === "string" && !promptInput.value.trim()) {
      promptInput.value = promptResult.lastPrompt;
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
    const [history, favorites, variableCache, runtimeSites, failedSelectors, settings] = await Promise.all([
      getPromptHistory(),
      getPromptFavorites(),
      getTemplateVariableCache(),
      getRuntimeSites(),
      getFailedSelectors(),
      getAppSettings()
    ]);
    state.history = history;
    state.favorites = favorites;
    state.templateVariableCache = variableCache;
    state.runtimeSites = runtimeSites;
    state.failedSelectors = new Map(failedSelectors.map((entry) => [entry.serviceId, entry]));
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
function setLoadedTemplateContext(item) {
  state.loadedTemplateDefaults = item && item.templateDefaults && typeof item.templateDefaults === "object" ? { ...item.templateDefaults } : {};
  state.loadedFavoriteTitle = typeof item?.title === "string" ? item.title : "";
}
function loadPromptIntoComposer(item) {
  promptInput.value = item.text;
  applySiteSelection(getHistorySelectedSiteIds(item));
  setLoadedTemplateContext(item);
  renderTemplateSummary();
  switchTab("compose");
  promptInput.focus();
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
    if (status === "submitted") {
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
function addRetryButton(siteId, finalPrompt) {
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
        prompt: finalPrompt,
        sites: buildBroadcastTargets([siteId])
      });
      if (response?.ok) {
        setSiteCardState(siteId, "sent");
      } else {
        setSiteCardState(siteId, "failed");
        addRetryButton(siteId, finalPrompt);
      }
    } catch (_error) {
      setSiteCardState(siteId, "failed");
      addRetryButton(siteId, finalPrompt);
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
async function sendResolvedPrompt(finalPrompt, sites) {
  if (state.isSending) {
    return;
  }
  const siteIds = normalizeSiteIdList2(
    sites.map((site) => typeof site === "string" ? site : site?.id)
  );
  setSendingState(true);
  armSendSafetyTimer();
  siteIds.forEach((siteId) => setSiteCardState(siteId, "sending"));
  setStatus(t.sending(siteIds.length));
  try {
    await refreshOpenSiteTabs();
    await chrome.storage.local.set({ lastPrompt: promptInput.value });
    clearAllToasts();
    void chrome.runtime.sendMessage({ action: "incrementBroadcastCounter" }).catch(() => {
    });
    const response = await chrome.runtime.sendMessage({
      action: "broadcast",
      prompt: finalPrompt,
      sites: buildBroadcastTargets(siteIds)
    });
    if (response?.ok) {
      if (Array.isArray(response.failedTabSiteIds)) {
        response.failedTabSiteIds.forEach((siteId) => {
          setSiteCardState(siteId, "failed");
          addRetryButton(siteId, finalPrompt);
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
        addRetryButton(siteId, finalPrompt);
      });
      setStatus(t.error(response?.error ?? getUnknownErrorText()), "error");
    }
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Broadcast send failed.", error);
    siteIds.forEach((siteId) => setSiteCardState(siteId, "failed"));
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
  templateModal.hidden = true;
  templateModalError.hidden = true;
  templateModalError.textContent = "";
}
function hideFavoriteModal() {
  state.pendingFavoriteSave = null;
  favoriteModal.hidden = true;
  favoriteModalError.hidden = true;
  favoriteModalError.textContent = "";
  favoriteTitleInput.value = "";
  favoriteSaveDefaults.checked = false;
  favoriteSaveDefaultsRow.hidden = true;
  favoriteDefaultFieldsWrap.hidden = true;
  favoriteDefaultFields.innerHTML = "";
}
function dismissFavoriteModal(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  hideFavoriteModal();
}
function resetTransientModals() {
  hideTemplateModal();
  hideFavoriteModal();
}
function setTemplateModalError(message = "") {
  templateModalError.hidden = !message;
  templateModalError.textContent = message;
}
function setFavoriteModalError(message = "") {
  favoriteModalError.hidden = !message;
  favoriteModalError.textContent = message;
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
  const cachedValues = compactVariableValues(modalState.userValues);
  await updateTemplateVariableCache(cachedValues);
  state.templateVariableCache = mergeTemplateSources(state.templateVariableCache, cachedValues);
  const finalPrompt = renderTemplatePrompt(modalState.prompt, previewState.values);
  hideTemplateModal();
  await sendResolvedPrompt(finalPrompt, modalState.sites);
}
function buildTemplateSendPreviewStateV2() {
  const modalState = state.pendingTemplateSend;
  if (!modalState) {
    return null;
  }
  const values = mergeTemplateSources(modalState.systemValues, modalState.userValues);
  const preview = renderTemplatePrompt(modalState.prompt, values);
  const missingUserValues = findMissingTemplateValues(modalState.prompt, modalState.userValues);
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
async function openTemplateModalV2(prompt, sites) {
  const variables = detectTemplateVariables(prompt);
  if (variables.length === 0) {
    await sendResolvedPrompt(prompt, sites);
    return;
  }
  const baseDefaults = mergeTemplateSources(
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
    sites,
    variables,
    userValues,
    systemValues
  };
  renderTemplateModalV2();
  templateModal.hidden = false;
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
  favoriteModalTitle.textContent = t.favoriteModalTitle;
  favoriteModalDesc.textContent = t.favoriteModalDesc;
  favoriteModalCancel.textContent = t.favoriteModalCancel;
  favoriteModalConfirm.textContent = t.favoriteModalConfirm;
  favoriteTitleLabel.textContent = t.favoriteTitleLabel;
  favoriteSaveDefaultsLabel.textContent = t.favoriteSaveDefaultsLabel;
  favoriteDefaultFieldsLabel.textContent = t.favoriteDefaultsLabel;
  favoriteTitleInput.value = modalState.title;
  favoriteSaveDefaults.checked = modalState.saveDefaults;
  favoriteSaveDefaultsRow.hidden = modalState.variables.length === 0;
  renderFavoriteDefaultFields();
}
async function openFavoriteModal() {
  clearStatus();
  const prompt = promptInput.value.trim();
  if (!prompt) {
    setStatus(t.warnEmpty, "error");
    promptInput.focus();
    return;
  }
  const variables = detectTemplateVariables(prompt).filter((variable) => variable.kind === "user");
  const baseDefaults = mergeTemplateSources(
    state.templateVariableCache,
    state.loadedTemplateDefaults
  );
  state.pendingFavoriteSave = {
    prompt,
    sites: checkedSiteIds(),
    variables,
    title: state.loadedFavoriteTitle,
    saveDefaults: variables.length > 0,
    defaultValues: Object.fromEntries(
      variables.map((variable) => [variable.name, baseDefaults[variable.name] ?? ""])
    )
  };
  setFavoriteModalError("");
  renderFavoriteModal();
  favoriteModal.hidden = false;
  window.requestAnimationFrame(() => {
    favoriteTitleInput.focus();
    favoriteTitleInput.select();
  });
}
async function confirmFavoriteSave() {
  const modalState = state.pendingFavoriteSave;
  if (!modalState) {
    return;
  }
  const title = favoriteTitleInput.value.trim();
  modalState.title = title;
  modalState.saveDefaults = favoriteSaveDefaults.checked;
  const templateDefaults = modalState.saveDefaults ? compactVariableValues(modalState.defaultValues) : {};
  if (modalState.saveDefaults) {
    await updateTemplateVariableCache(templateDefaults);
    state.templateVariableCache = mergeTemplateSources(state.templateVariableCache, templateDefaults);
  }
  await createFavoritePrompt({
    title,
    text: modalState.prompt,
    sentTo: modalState.sites,
    templateDefaults
  });
  await refreshStoredData();
  hideFavoriteModal();
  setStatus(t.favoriteSaved, "success");
  showAppToast(t.favoriteSaved, "success", 2200);
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
      syncToggleAllLabel();
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
async function ensureSiteOriginPermission(url) {
  try {
    const pattern = buildSitePermissionPattern(url);
    if (!pattern) {
      return false;
    }
    const permission = { origins: [pattern] };
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
  if (!validation.valid) {
    setServiceEditorError(validation.errors.join(" "));
    return;
  }
  if (!isBuiltIn) {
    const granted = await ensureSiteOriginPermission(draft.url);
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
    const item = state.favorites.find((f) => f.id === favoriteId);
    if (item) {
      await updateFavoriteMeta(favoriteId, { pinned: !item.pinned });
      state.favorites = await getPromptFavorites();
      state.openMenuKey = null;
      renderFavoritesList();
    }
    return;
  }
  if (action === "edit-favorite-tags") {
    const item = state.favorites.find((f) => f.id === favoriteId);
    if (!item) return;
    state.openMenuKey = null;
    openFavoriteTagsModal(item);
    return;
  }
}
function openFavoriteTagsModal(item) {
  let modal = document.getElementById("favorite-tags-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "favorite-tags-modal";
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2>${escapeHtml(msg("popup_favorite_edit_tags") || "Edit tags & folder")}</h2>
          <button class="icon-button" type="button" id="fav-tags-modal-close">×</button>
        </div>
        <div class="modal-fields">
          <label class="field-stack">
            <span>${escapeHtml(msg("popup_favorite_tags_label") || "Tags (comma-separated)")}</span>
            <input id="fav-tags-input" class="search-input" type="text" placeholder="${escapeHtml(msg("popup_favorite_tags_placeholder") || "coding, translation, summary")}" />
          </label>
          <label class="field-stack">
            <span>${escapeHtml(msg("popup_favorite_folder_label") || "Folder")}</span>
            <input id="fav-folder-input" class="search-input" type="text" placeholder="${escapeHtml(msg("popup_favorite_folder_placeholder") || "Work / Development")}" />
          </label>
        </div>
        <div class="modal-actions">
          <button class="ghost-button" type="button" id="fav-tags-modal-cancel">${escapeHtml(msg("popup_template_cancel") || "Cancel")}</button>
          <button class="primary-button" type="button" id="fav-tags-modal-save">${escapeHtml(msg("popup_favorite_modal_confirm") || "Save")}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const closeModal = () => {
      modal.hidden = true;
    };
    document.getElementById("fav-tags-modal-close").addEventListener("click", closeModal);
    document.getElementById("fav-tags-modal-cancel").addEventListener("click", closeModal);
    document.getElementById("fav-tags-modal-save").addEventListener("click", async () => {
      const rawTags = document.getElementById("fav-tags-input").value;
      const folder = document.getElementById("fav-folder-input").value.trim();
      const tags = rawTags.split(",").map((t2) => t2.trim()).filter(Boolean);
      const favoriteId = modal.dataset.favoriteId;
      await updateFavoriteMeta(favoriteId, { tags, folder });
      state.favorites = await getPromptFavorites();
      renderFavoritesList();
      closeModal();
    });
  }
  modal.dataset.favoriteId = item.id;
  document.getElementById("fav-tags-input").value = (item.tags ?? []).join(", ");
  document.getElementById("fav-folder-input").value = item.folder ?? "";
  modal.hidden = false;
}
async function handleSend() {
  if (state.isSending) {
    return;
  }
  clearStatus();
  const prompt = promptInput.value.trim();
  if (!prompt) {
    setStatus(t.warnEmpty, "error");
    showAppToast(t.toastPromptEmpty, "warning", 2e3);
    promptInput.focus();
    return;
  }
  const selectedSiteIds = checkedSiteIds();
  if (selectedSiteIds.length === 0) {
    setStatus(t.warnNoSite, "error");
    showAppToast(t.toastNoService, "warning", 2e3);
    return;
  }
  const selectedSites = state.runtimeSites.filter((site) => selectedSiteIds.includes(site.id));
  for (const site of selectedSites) {
    if (!site.isCustom) {
      continue;
    }
    const granted = await ensureSiteOriginPermission(site.url);
    if (!granted) {
      setStatus(t.servicePermissionDenied, "error");
      showAppToast(t.servicePermissionDenied, "error", 4e3);
      return;
    }
  }
  await chrome.storage.local.set({ lastPrompt: prompt });
  await openTemplateModalV2(prompt, selectedSiteIds);
}
function bindGlobalEvents() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });
  clearPromptBtn.addEventListener("click", () => {
    promptInput.value = "";
    updatePromptCounter();
    autoResizePromptInput();
    renderTemplateSummary();
    clearStatus();
    promptInput.focus();
  });
  toggleAllBtn.addEventListener("click", () => {
    const checkboxes = allCheckboxes();
    const shouldCheckAll = !checkboxes.every((checkbox) => checkbox.checked);
    checkboxes.forEach((checkbox) => {
      checkbox.checked = shouldCheckAll;
      checkbox.closest(".site-card")?.classList.toggle("checked", shouldCheckAll);
    });
    syncToggleAllLabel();
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
  promptInput.addEventListener("input", () => {
    updatePromptCounter();
    autoResizePromptInput();
    renderTemplateSummary();
    document.querySelectorAll(".site-card.sent, .site-card.failed, .site-card.sending").forEach((card) => {
      card.classList.remove("sending", "sent", "failed");
      card.querySelector(".retry-btn")?.remove();
    });
  });
  promptInput.addEventListener("keydown", (event) => {
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
  favoritesSearchInput.addEventListener("input", (event) => {
    state.favoritesSearch = event.target.value;
    renderFavoritesList();
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
  favoriteModalClose.addEventListener("click", dismissFavoriteModal);
  favoriteModalCancel.addEventListener("click", dismissFavoriteModal);
  favoriteModal.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const dismissButton = target?.closest("[data-dismiss-favorite-modal]");
    if (dismissButton || target === favoriteModal) {
      dismissFavoriteModal(event);
    }
  });
  favoriteModal.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !favoriteModal.hidden) {
      dismissFavoriteModal(event);
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
  favoriteModalConfirm.addEventListener("click", () => {
    void confirmFavoriteSave().catch((error) => {
      console.error("[AI Prompt Broadcaster] Favorite save failed.", error);
      setFavoriteModalError(t.error(error?.message ?? getUnknownErrorText()));
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
      return;
    }
    if (areaName !== "local") {
      return;
    }
    if (changes.promptHistory || changes.promptFavorites || changes.lastPrompt || changes.templateVariableCache || changes.appSettings || changes.customSites || changes.builtInSiteStates || changes.builtInSiteOverrides || changes.failedSelectors) {
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
    syncToggleAllLabel();
    await loadStoredData();
    await chrome.runtime.sendMessage({ action: "popupOpened" }).catch(() => null);
    applyLastBroadcastState(await getLastBroadcast(), { silentToast: false });
    await flushPendingSessionToasts();
    promptInput.focus();
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
