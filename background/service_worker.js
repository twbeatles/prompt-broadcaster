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

// src/shared/prompts/storage.ts
async function readLocal(key, fallbackValue) {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? fallbackValue;
}
async function writeLocal(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

// src/shared/prompts/settings-store.ts
async function getAppSettings() {
  const rawSettings = await readLocal(LOCAL_STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  return normalizeSettings(rawSettings);
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
async function appendPromptHistory(entry) {
  const historyLimit = await getHistoryLimit();
  const history = await getPromptHistory();
  const normalized = buildHistoryEntry(entry);
  normalized.id = ensureUniqueNumericId(history, Number(normalized.id));
  const nextHistory = sortByDateDesc([normalized, ...history]).slice(0, historyLimit);
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

// src/shared/sites/storage.ts
async function readLocal2(key, fallbackValue) {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? fallbackValue;
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

// src/shared/sites/runtime-sites.ts
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

// src/shared/runtime-state/onboarding.ts
async function setOnboardingCompleted(completed) {
  const normalized = normalizeBoolean3(completed, false);
  await writeStorage("local", LOCAL_RUNTIME_KEYS.onboardingCompleted, normalized);
  return normalized;
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

// src/background/app/constants.ts
var INJECTOR_SCRIPT_PATH = "content/injector.js";
var SELECTOR_CHECKER_SCRIPT_PATH = "content/selector_checker.js";
var SELECTION_SCRIPT_PATH = "content/selection.js";
var ONBOARDING_URL = "onboarding/onboarding.html";
var POPUP_PAGE_URL = "popup/popup.html";
var PENDING_INJECTIONS_KEY = "pendingInjections";
var PENDING_BROADCASTS_KEY = "pendingBroadcasts";
var SELECTOR_ALERTS_KEY = "selectorAlerts";
var NOTIFICATION_ICON_PATH = "icons/icon-128.png";
var CONTEXT_MENU_ROOT_ID = "apb-root";
var CONTEXT_MENU_ALL_ID = "apb-send-all";
var CONTEXT_MENU_SITE_PREFIX = "apb-send-site:";
var CAPTURE_SELECTION_COMMAND = "capture-selected-text";
var RECONCILE_ALARM = "apb-reconcile";
var BADGE_CLEAR_ALARM = "apb-clear-badge";
var PENDING_TIMEOUT_MS = 6e4;
var BADGE_CLEAR_DELAY_MS = 5e3;
var KEEPALIVE_PERIOD_MINUTES = 0.5;
var TAB_LOAD_READY_TIMEOUT_MS = 1e4;
var TAB_POST_SUBMIT_SETTLE_MS = 1400;
var STANDALONE_POPUP_WIDTH = 460;
var STANDALONE_POPUP_HEIGHT = 860;

// src/background/app/bootstrap.ts
var activeInjections = /* @__PURE__ */ new Set();
var queuedInjectionTabIds = /* @__PURE__ */ new Set();
var selectionCache = /* @__PURE__ */ new Map();
var lastNormalWindowId = null;
var lastNormalTabId = null;
var contextMenuRefreshChain = Promise.resolve();
var injectionProcessChain = Promise.resolve();
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
function buildInjectionConfig(site) {
  return {
    id: site?.id ?? "",
    name: site?.name ?? "",
    url: site?.url ?? "",
    hostname: site?.hostname ?? "",
    hostnameAliases: Array.isArray(site?.hostnameAliases) ? site.hostnameAliases : [],
    inputSelector: site?.inputSelector ?? "",
    fallbackSelectors: Array.isArray(site?.fallbackSelectors) ? site.fallbackSelectors : [],
    inputType: site?.inputType ?? "textarea",
    submitSelector: site?.submitSelector ?? "",
    submitMethod: site?.submitMethod ?? "enter",
    selectorCheckMode: site?.selectorCheckMode ?? "input-and-submit",
    waitMs: Number.isFinite(site?.waitMs) ? site.waitMs : 0,
    fallback: site?.fallback !== false,
    authSelectors: Array.isArray(site?.authSelectors) ? site.authSelectors : [],
    lastVerified: site?.lastVerified ?? "",
    verifiedVersion: site?.verifiedVersion ?? "",
    isCustom: Boolean(site?.isCustom),
    permissionPattern: site?.permissionPattern ?? ""
  };
}
function normalizePrompt(value) {
  return typeof value === "string" ? value : "";
}
function summarizeBroadcastStatus(record) {
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
function buildLastBroadcastSummary(record, overrides = {}) {
  return {
    broadcastId: record.id,
    status: summarizeBroadcastStatus(record),
    prompt: record.prompt,
    siteIds: [...record.siteIds ?? []],
    total: Number(record.total ?? 0),
    completed: Number(record.completed ?? 0),
    submittedSiteIds: [...record.submittedSiteIds ?? []],
    failedSiteIds: [...record.failedSiteIds ?? []],
    siteResults: { ...record.siteResults ?? {} },
    startedAt: record.startedAt ?? nowIso(),
    finishedAt: record.completed >= record.total && summarizeBroadcastStatus(record) !== "sending" ? nowIso() : "",
    ...overrides
  };
}
async function rememberNormalTab(tab) {
  if (!tab?.id || !Number.isFinite(tab.windowId)) {
    return null;
  }
  try {
    const windowInfo = await chrome.windows.get(tab.windowId).catch(() => null);
    if (windowInfo?.type !== "normal") {
      return null;
    }
    lastNormalWindowId = windowInfo.id;
    lastNormalTabId = tab.id;
    return tab;
  } catch (_error) {
    return null;
  }
}
async function getPreferredNormalActiveTab(preferredWindowId = null) {
  try {
    const [lastFocusedTab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true
    });
    const rememberedLastFocused = await rememberNormalTab(lastFocusedTab);
    if (rememberedLastFocused) {
      return rememberedLastFocused;
    }
  } catch (_error) {
  }
  const targetWindowId = await getPreferredNormalWindowId(preferredWindowId);
  if (Number.isFinite(targetWindowId)) {
    try {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        windowId: targetWindowId
      });
      const rememberedTargetTab = await rememberNormalTab(activeTab);
      if (rememberedTargetTab) {
        return rememberedTargetTab;
      }
    } catch (_error) {
    }
  }
  if (Number.isFinite(lastNormalTabId)) {
    try {
      const hintTab = await chrome.tabs.get(lastNormalTabId);
      const rememberedHintTab = await rememberNormalTab(hintTab);
      if (rememberedHintTab) {
        return rememberedHintTab;
      }
    } catch (_error) {
      lastNormalTabId = null;
    }
  }
  if (Number.isFinite(lastNormalWindowId)) {
    try {
      const [hintWindowTab] = await chrome.tabs.query({
        active: true,
        windowId: lastNormalWindowId
      });
      const rememberedHintWindowTab = await rememberNormalTab(hintWindowTab);
      if (rememberedHintWindowTab) {
        return rememberedHintWindowTab;
      }
    } catch (_error) {
      lastNormalWindowId = null;
    }
  }
  return null;
}
async function getFocusedTabContext() {
  try {
    const activeTab = await getPreferredNormalActiveTab();
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
    const result = executionResult?.result ?? {};
    return result.readyState === "interactive" || result.readyState === "complete";
  } catch (_error) {
    return false;
  }
}
async function waitForTabInteractionReady(tabId, timeoutMs = TAB_LOAD_READY_TIMEOUT_MS) {
  const deadline = Date.now() + Math.max(timeoutMs, 0);
  while (Date.now() <= deadline) {
    if (await isTabLoadReady(tabId)) {
      return true;
    }
    await sleep(150);
  }
  return false;
}
async function restoreFocusedTabContext(context) {
  if (!context?.tabId || !Number.isFinite(context.windowId)) {
    return;
  }
  try {
    await chrome.windows.update(context.windowId, { focused: true });
    await chrome.tabs.update(context.tabId, { active: true });
  } catch (_error) {
  }
}
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
function getUnresolvedSiteIds(record) {
  const siteResults = record?.siteResults ?? {};
  return Array.isArray(record?.siteIds) ? record.siteIds.filter((siteId) => !siteResults?.[siteId]) : [];
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
async function readSessionValue(key, fallbackValue) {
  try {
    const result = await chrome.storage.session.get(key);
    return result[key] ?? fallbackValue;
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to read session storage.", {
      key,
      error
    });
    return fallbackValue;
  }
}
async function writeSessionValue(key, value) {
  try {
    await chrome.storage.session.set({ [key]: value });
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to write session storage.", {
      key,
      error
    });
  }
}
async function getPendingInjections() {
  return readSessionValue(PENDING_INJECTIONS_KEY, {});
}
async function setPendingInjections(value) {
  await writeSessionValue(PENDING_INJECTIONS_KEY, value);
}
async function getPendingBroadcasts() {
  return readSessionValue(PENDING_BROADCASTS_KEY, {});
}
async function setPendingBroadcasts(value) {
  await writeSessionValue(PENDING_BROADCASTS_KEY, value);
}
async function getSelectorAlerts() {
  return readSessionValue(SELECTOR_ALERTS_KEY, {});
}
async function setSelectorAlerts(value) {
  await writeSessionValue(SELECTOR_ALERTS_KEY, value);
}
async function updatePendingInjection(tabId, updater) {
  const pending = await getPendingInjections();
  const current = pending[String(tabId)];
  const nextValue = typeof updater === "function" ? updater(current) : updater;
  if (nextValue) {
    pending[String(tabId)] = nextValue;
  } else {
    delete pending[String(tabId)];
  }
  await setPendingInjections(pending);
  return nextValue ?? null;
}
async function addPendingInjection(tabId, payload) {
  return updatePendingInjection(tabId, {
    ...payload,
    tabId,
    createdAt: Number(payload?.createdAt) || Date.now(),
    injected: Boolean(payload?.injected),
    status: payload?.status || "pending",
    closeOnCancel: payload?.closeOnCancel !== false
  });
}
async function removePendingInjection(tabId) {
  await updatePendingInjection(tabId, null);
}
async function getSiteById(siteId) {
  const sites = await getRuntimeSites();
  return sites.find((site) => site.id === siteId) ?? null;
}
async function getSiteForUrl(urlString) {
  try {
    const url = new URL(urlString);
    const sites = await getRuntimeSites();
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
function normalizeTargetTabId(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}
async function resolveSelectedTargets(siteRefs) {
  const runtimeSites = await getRuntimeSites();
  const resolvedTargets = [];
  const seenIds = /* @__PURE__ */ new Set();
  for (const siteRef of Array.isArray(siteRefs) ? siteRefs : []) {
    let resolvedSite = null;
    let targetTabId = null;
    let forceNewTab = false;
    let promptOverride = null;
    if (typeof siteRef === "string") {
      resolvedSite = runtimeSites.find((site) => site.id === siteRef) ?? null;
    } else if (siteRef && typeof siteRef === "object") {
      if (typeof siteRef.id === "string") {
        resolvedSite = runtimeSites.find((site) => site.id === siteRef.id) ?? buildInjectionConfig(siteRef);
      } else {
        resolvedSite = buildInjectionConfig(siteRef);
      }
      targetTabId = normalizeTargetTabId(siteRef.tabId);
      forceNewTab = siteRef.reuseExistingTab === false || siteRef.openInNewTab === true || siteRef.target === "new";
      promptOverride = typeof siteRef.promptOverride === "string" && siteRef.promptOverride.trim() ? siteRef.promptOverride.trim() : null;
    }
    if (!resolvedSite || !resolvedSite.id || seenIds.has(resolvedSite.id)) {
      continue;
    }
    seenIds.add(resolvedSite.id);
    resolvedTargets.push({
      site: buildInjectionConfig(resolvedSite),
      targetTabId,
      forceNewTab,
      promptOverride
    });
  }
  return resolvedTargets;
}
function isInjectableTabUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_error) {
    return false;
  }
}
function getAllowedSiteHostnames(site) {
  return new Set(
    [
      site?.hostname,
      ...Array.isArray(site?.hostnameAliases) ? site.hostnameAliases : [],
      isInjectableTabUrl(site?.url ?? "") ? new URL(site.url).hostname : ""
    ].filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim().toLowerCase())
  );
}
async function isCustomSitePermissionGranted(site) {
  if (!site?.isCustom || !site?.permissionPattern) {
    return true;
  }
  try {
    return await chrome.permissions.contains({
      origins: [site.permissionPattern]
    });
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to check custom site permission.", {
      siteId: site?.id,
      error
    });
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
async function findReusableTabsForSites(sites, options = {}) {
  const windowId = Number(options?.windowId);
  if (!Number.isFinite(windowId)) {
    return /* @__PURE__ */ new Map();
  }
  try {
    const [tabs, pendingInjections] = await Promise.all([
      chrome.tabs.query({ windowId }),
      getPendingInjections()
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
        if (!Number.isFinite(tab?.id) || usedTabIds.has(tab.id) || excludedTabIds.has(tab.id)) {
          return false;
        }
        if (!isInjectableTabUrl(tab?.url ?? "")) {
          return false;
        }
        return isSameSiteOrigin(tab.url, site);
      }).sort((left, right) => scoreReusableTabForSite(left, site) - scoreReusableTabForSite(right, site));
      const match = candidates[0];
      if (!match?.id) {
        continue;
      }
      reusableTabsBySiteId.set(site.id, match);
      usedTabIds.add(match.id);
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
async function getPreferredNormalWindowId(preferredWindowId = null) {
  const normalizedPreferredWindowId = Number(preferredWindowId);
  if (Number.isFinite(normalizedPreferredWindowId)) {
    try {
      const preferredWindow = await chrome.windows.get(normalizedPreferredWindowId);
      if (preferredWindow?.type === "normal") {
        return preferredWindow.id;
      }
    } catch (_error) {
    }
  }
  try {
    const [lastFocusedTab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true
    });
    if (Number.isFinite(lastFocusedTab?.windowId)) {
      const windowInfo = await chrome.windows.get(lastFocusedTab.windowId).catch(() => null);
      if (windowInfo?.type === "normal") {
        return windowInfo.id;
      }
    }
  } catch (_error) {
  }
  if (Number.isFinite(lastNormalWindowId)) {
    try {
      const rememberedWindow = await chrome.windows.get(lastNormalWindowId);
      if (rememberedWindow?.type === "normal") {
        return rememberedWindow.id;
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
async function getOpenAiTabsForWindow(windowId) {
  const normalizedWindowId = Number(windowId);
  if (!Number.isFinite(normalizedWindowId)) {
    return [];
  }
  try {
    const [runtimeSites, tabs] = await Promise.all([
      getRuntimeSites(),
      chrome.tabs.query({ windowId: normalizedWindowId })
    ]);
    return tabs.map((tab) => {
      if (!Number.isFinite(tab?.id) || !isInjectableTabUrl(tab?.url ?? "")) {
        return null;
      }
      const site = runtimeSites.find((entry) => isSameSiteOrigin(tab.url, entry));
      if (!site) {
        return null;
      }
      return {
        siteId: site.id,
        siteName: site.name,
        tabId: tab.id,
        title: typeof tab.title === "string" ? tab.title : "",
        url: typeof tab.url === "string" ? tab.url : "",
        active: Boolean(tab.active),
        status: typeof tab.status === "string" ? tab.status : "",
        windowId: normalizedWindowId
      };
    }).filter(Boolean);
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to collect open AI tabs.", {
      windowId: normalizedWindowId,
      error
    });
    return [];
  }
}
async function getExplicitReusableTabForTarget(target) {
  const targetTabId = Number(target?.targetTabId);
  if (!Number.isFinite(targetTabId)) {
    return null;
  }
  try {
    const tab = await chrome.tabs.get(targetTabId);
    if (!tab?.id || !isInjectableTabUrl(tab?.url ?? "")) {
      return null;
    }
    return isSameSiteOrigin(tab.url, target.site) ? tab : null;
  } catch (_error) {
    return null;
  }
}
async function storePromptForPopup(prompt) {
  try {
    await chrome.storage.local.set({ lastPrompt: prompt });
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
async function openPopupWithPrompt(prompt = "") {
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
}
async function openOnboardingPage() {
  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL(ONBOARDING_URL) });
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to open onboarding page.", error);
  }
}
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
async function getSelectedTextFromTab(tabId) {
  try {
    const didInject = await ensureSelectionScript(tabId);
    if (!didInject) {
      return selectionCache.get(tabId) ?? "";
    }
    const response = await chrome.tabs.sendMessage(tabId, {
      action: "selection:get-text"
    });
    return typeof response?.text === "string" ? response.text.trim() : selectionCache.get(tabId) ?? "";
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to read selected text from tab.", {
      tabId,
      error
    });
    return selectionCache.get(tabId) ?? "";
  }
}
async function maybeInjectDynamicSelectorChecker(tabId, tab) {
  const tabUrl = typeof tab?.url === "string" ? tab.url : "";
  if (!tabId || !isInjectableTabUrl(tabUrl)) {
    return false;
  }
  const site = await getSiteForUrl(tabUrl);
  if (!site?.isCustom || site.enabled === false) {
    return false;
  }
  const granted = await isCustomSitePermissionGranted(site);
  if (!granted) {
    return false;
  }
  return ensureSelectorCheckerScript(tabId);
}
async function getPreferredInjectableNormalTab() {
  const tab = await getPreferredNormalActiveTab();
  if (!tab?.id) {
    return null;
  }
  const tabUrl = typeof tab.url === "string" ? tab.url : "";
  if (!isInjectableTabUrl(tabUrl)) {
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
async function runServiceTestOnTab(tabId, draft) {
  const probeText = "__apb_probe__";
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (siteDraft, nextProbeText) => {
      function isElementVisible(element) {
        if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
          return true;
        }
        const style = window.getComputedStyle(element);
        if (element.hidden || element.getAttribute("hidden") !== null || element.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
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
          if (current.shadowRoot) {
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
        } else if (element instanceof HTMLElement) {
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
            expectedType: siteDraft.inputType ?? "",
            typeMatches: inputTypeMatches
          },
          submit: {
            status: "skipped"
          }
        };
        if (String(siteDraft.submitMethod) !== "click") {
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
          error: error?.message ?? String(error)
        };
      }
    },
    args: [draft, probeText]
  });
  return result?.result ?? {
    ok: false,
    error: "Selector test returned no result."
  };
}
async function getContextMenuTargetSiteIds(menuItemId) {
  if (menuItemId === CONTEXT_MENU_ALL_ID) {
    const enabledSites = await getEnabledRuntimeSites();
    const allowedSites = (await Promise.all(
      enabledSites.map(async (site) => {
        if (!site.isCustom || !site.permissionPattern) {
          return site;
        }
        const granted = await chrome.permissions.contains({
          origins: [site.permissionPattern]
        });
        return granted ? site : null;
      })
    )).filter(Boolean);
    return allowedSites.map((site) => site.id);
  }
  if (typeof menuItemId === "string" && menuItemId.startsWith(CONTEXT_MENU_SITE_PREFIX)) {
    return [menuItemId.slice(CONTEXT_MENU_SITE_PREFIX.length)];
  }
  return [];
}
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
async function rebuildContextMenus() {
  await removeAllContextMenus();
  const enabledSites = await getEnabledRuntimeSites();
  const menuSites = (await Promise.all(
    enabledSites.map(async (site) => {
      if (!site.isCustom || !site.permissionPattern) {
        return site;
      }
      try {
        const granted = await chrome.permissions.contains({
          origins: [site.permissionPattern]
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
  )).filter(Boolean);
  await createContextMenuItem({
    id: CONTEXT_MENU_ROOT_ID,
    title: getI18nMessage("context_menu_root"),
    contexts: ["selection"]
  });
  await createContextMenuItem({
    id: CONTEXT_MENU_ALL_ID,
    parentId: CONTEXT_MENU_ROOT_ID,
    title: getI18nMessage("context_menu_send_all"),
    contexts: ["selection"]
  });
  for (const site of menuSites) {
    await createContextMenuItem({
      id: `${CONTEXT_MENU_SITE_PREFIX}${site.id}`,
      parentId: CONTEXT_MENU_ROOT_ID,
      title: getI18nMessage("context_menu_send_to", [site.name]),
      contexts: ["selection"]
    });
  }
}
function createContextMenus() {
  contextMenuRefreshChain = contextMenuRefreshChain.catch(() => void 0).then(() => rebuildContextMenus()).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("No SW")) {
      return;
    }
    console.error("[AI Prompt Broadcaster] Failed to create context menus.", error);
  });
  return contextMenuRefreshChain;
}
async function handleContextMenuBroadcast(prompt, siteIds) {
  if (!prompt.trim()) {
    return;
  }
  try {
    await handleBroadcastMessage({
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
async function handleCaptureSelectedTextCommand() {
  try {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true
    });
    if (!activeTab?.id || !isInjectableTabUrl(activeTab.url ?? "")) {
      await openPopupWithPrompt("");
      return;
    }
    const selectedText = await getSelectedTextFromTab(activeTab.id);
    await openPopupWithPrompt(selectedText);
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Capture-selected-text command failed.", error);
  }
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
async function createPendingBroadcast(prompt, sites) {
  const pendingInjections = await getPendingInjections();
  if (Object.keys(pendingInjections).length > 0) {
    console.warn("[AI Prompt Broadcaster] Starting a new broadcast while pending tabs still exist.", pendingInjections);
  }
  const pendingBroadcasts = await getPendingBroadcasts();
  const originContext = await getFocusedTabContext();
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
    startedAt: nowIso(),
    status: "sending",
    originTabId: originContext?.tabId ?? null,
    originWindowId: originContext?.windowId ?? null
  };
  pendingBroadcasts[broadcastId] = record;
  await setPendingBroadcasts(pendingBroadcasts);
  await syncLastBroadcast(buildLastBroadcastSummary(record, { finishedAt: "" }));
  return record;
}
async function maybeCreateSelectorNotification(report) {
  try {
    const selectorAlerts = await getSelectorAlerts();
    const signature = [
      report.siteId,
      report.pageUrl,
      ...(report.missing ?? []).map((entry) => `${entry.field}:${entry.selector}`)
    ].join("|");
    if (selectorAlerts[signature]) {
      return;
    }
    selectorAlerts[signature] = Date.now();
    await setSelectorAlerts(selectorAlerts);
    await chrome.notifications.create(`selector-changed-${report.siteId}`, {
      type: "basic",
      iconUrl: chrome.runtime.getURL(NOTIFICATION_ICON_PATH),
      title: getI18nMessage("notification_selector_title", [report.siteName]) || `${report.siteName} selector update required`,
      message: getI18nMessage("notification_selector_message", [report.siteName]) || `${report.siteName} selector changed. Update config/sites.js to restore automatic injection.`
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
async function recordBroadcastSiteResult(broadcastId, siteId, status) {
  try {
    const pendingBroadcasts = await getPendingBroadcasts();
    const record = pendingBroadcasts[broadcastId];
    if (!record) {
      return null;
    }
    if (record.siteResults?.[siteId]) {
      return buildLastBroadcastSummary(record);
    }
    record.siteResults = {
      ...record.siteResults ?? {},
      [siteId]: status
    };
    record.completed = Object.keys(record.siteResults).length;
    if (status === "submitted") {
      record.submittedSiteIds = Array.from(
        /* @__PURE__ */ new Set([...record.submittedSiteIds ?? [], siteId])
      );
    } else {
      record.failedSiteIds = Array.from(
        /* @__PURE__ */ new Set([...record.failedSiteIds ?? [], siteId])
      );
    }
    record.status = summarizeBroadcastStatus(record);
    const summary = buildLastBroadcastSummary(record, {
      finishedAt: record.status === "sending" ? "" : nowIso()
    });
    if (record.completed >= record.total) {
      delete pendingBroadcasts[broadcastId];
      await setPendingBroadcasts(pendingBroadcasts);
      await appendPromptHistory({
        id: Date.now(),
        text: record.prompt,
        requestedSiteIds: record.siteIds,
        submittedSiteIds: record.submittedSiteIds,
        failedSiteIds: record.failedSiteIds,
        sentTo: record.submittedSiteIds,
        createdAt: record.startedAt,
        status: summary.status,
        siteResults: record.siteResults
      });
      await syncLastBroadcast(summary);
      await restoreBroadcastFocus(record);
      await maybeCreateBroadcastNotification(summary);
    } else {
      pendingBroadcasts[broadcastId] = record;
      await setPendingBroadcasts(pendingBroadcasts);
      await syncLastBroadcast(summary);
    }
    return summary;
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to record broadcast site result.", {
      broadcastId,
      siteId,
      status,
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
  for (const [tabIdKey, job] of matchingJobs) {
    const tabId = Number(tabIdKey);
    if (job?.siteId) {
      pendingSiteIds.add(job.siteId);
    }
    await removePendingInjection(tabId);
    activeInjections.delete(tabId);
  }
  let lastSummary = null;
  lastSummary = await finalizeBroadcastSites(normalizedBroadcastId, [...pendingSiteIds], reason) ?? lastSummary;
  const refreshedPendingBroadcasts = await getPendingBroadcasts();
  const record = refreshedPendingBroadcasts[normalizedBroadcastId];
  const unresolvedSiteIds = getUnresolvedSiteIds(record).filter((siteId) => !pendingSiteIds.has(siteId));
  lastSummary = await finalizeBroadcastSites(normalizedBroadcastId, unresolvedSiteIds, reason) ?? lastSummary;
  await Promise.all(
    matchingJobs.map(async ([tabIdKey, job]) => {
      if (job?.closeOnCancel === false) {
        return;
      }
      await closeTabQuietly(Number(tabIdKey));
    })
  );
  await restoreBroadcastFocus(recordBeforeCancel);
  const fallbackSummary = await getLastBroadcast();
  const summary = lastSummary ?? fallbackSummary;
  await enqueueUiToast({
    message: getI18nMessage("toast_broadcast_cancelled") || "Broadcast cancelled.",
    type: "warning",
    duration: 5e3,
    meta: {
      broadcastId: normalizedBroadcastId,
      reason
    }
  });
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
    const unresolvedSiteIds = getUnresolvedSiteIds(record);
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
async function injectIntoTab(tabId, prompt, site) {
  const config = buildInjectionConfig(site);
  if (site?.id === "perplexity") {
    const [executionResult2] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: async (injectedPrompt, injectedConfig) => {
        const sleep2 = (ms) => new Promise((resolve) => window.setTimeout(resolve, Math.max(Number(ms) || 0, 0)));
        const splitSelectorList = (selectorGroup) => {
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
        };
        const normalizeSelectorEntries = (selectors) => (Array.isArray(selectors) ? selectors : []).filter((selector2) => typeof selector2 === "string" && selector2.trim()).flatMap((selector2) => splitSelectorList(selector2)).filter((selector2, index, list) => list.indexOf(selector2) === index);
        const normalizeText = (value) => String(value ?? "").replace(/\u00A0/g, " ").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\r\n?/g, "\n").trim();
        const isVisible = (element2) => {
          if (!(element2 instanceof HTMLElement) && !(element2 instanceof SVGElement)) {
            return true;
          }
          const style = window.getComputedStyle(element2);
          if (element2.hidden || element2.getAttribute("hidden") !== null || element2.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
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
          const selectors = normalizeSelectorEntries([
            injectedConfig?.inputSelector,
            ...Array.isArray(injectedConfig?.fallbackSelectors) ? injectedConfig.fallbackSelectors : []
          ]);
          for (const selector2 of selectors) {
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
          return normalizeText(element2.innerText ?? element2.textContent ?? "") === normalizeText(nextPrompt);
        };
        if ((Number(injectedConfig?.waitMs) || 0) > 0) {
          await sleep2(injectedConfig.waitMs);
        }
        const startedAt = performance.now();
        const match = await waitForPromptMatch(Math.max((Number(injectedConfig?.waitMs) || 0) + 6e3, 8e3));
        if (!match?.element) {
          return { status: "selector_failed" };
        }
        const { element, selector } = match;
        let strategy = "mainWorldExecCommand";
        let injected = false;
        if (element instanceof HTMLElement && element.dataset.lexicalEditor === "true") {
          injected = setLexicalText(element, injectedPrompt);
          strategy = "mainWorldLexical";
        }
        if (!injected && element instanceof HTMLElement) {
          element.focus();
          selectAllEditableContents(element);
          const inserted = document.execCommand("insertText", false, injectedPrompt);
          injected = Boolean(inserted) || normalizeText(element.innerText ?? element.textContent ?? "") === normalizeText(injectedPrompt);
        }
        if (!injected) {
          return { status: "failed", selector, strategy };
        }
        return {
          status: "injected",
          selector,
          strategy,
          inputType: "contenteditable",
          elapsedMs: Math.round(performance.now() - startedAt)
        };
      },
      args: [prompt, config]
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
        elapsedMs: injectionResult.elapsedMs ?? submitResult.elapsedMs
      };
    }
    return submitResult ?? injectionResult;
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
function isSameSiteOrigin(tabUrl, site) {
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
async function handlePendingInjectionTimeout(tabId, job, reason = "timeout") {
  const siteName = job?.site?.name ?? job?.siteId ?? "AI service";
  await recordBroadcastSiteResult(job.broadcastId, job.siteId, "injection_timeout");
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
    await waitForTabInteractionReady(tabId);
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
      await recordBroadcastSiteResult(job.broadcastId, job.siteId, "redirected_or_login_required");
      await enqueueUiToast({
        message: getI18nMessage("toast_login_required", [job.site.name]) || `${job.site.name} requires login before sending.`,
        type: "warning",
        duration: 5e3
      });
      return;
    }
    const result = await injectIntoTab(tabId, job.prompt, job.site);
    const finalStatus = result?.status === "submitted" ? "submitted" : result?.status || "failed";
    if (finalStatus === "submitted") {
      await sleep(TAB_POST_SUBMIT_SETTLE_MS);
    }
    await recordBroadcastSiteResult(job.broadcastId, job.siteId, finalStatus);
    if (finalStatus === "login_required") {
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
    await recordBroadcastSiteResult(job.broadcastId, job.siteId, "injection_failed");
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
      await removePendingInjection(tabIdKey);
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
}
function handleSelectionUpdateMessage(message, sender) {
  try {
    if (typeof sender?.tab?.id !== "number") {
      return { ok: false };
    }
    const text = typeof message?.text === "string" ? message.text.trim() : "";
    if (text) {
      selectionCache.set(sender.tab.id, text);
    } else {
      selectionCache.delete(sender.tab.id);
    }
    return { ok: true };
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to store selection update.", error);
    return {
      ok: false,
      error: error?.message ?? String(error)
    };
  }
}
async function handleBroadcastMessage(message) {
  await reconcilePendingBroadcasts();
  const prompt = normalizePrompt(message?.prompt).trim();
  const selectedTargets = await resolveSelectedTargets(message?.sites);
  const selectedSites = selectedTargets.map((target) => target.site);
  let queuedSiteCount = 0;
  if (!prompt) {
    throw new Error("Prompt is required.");
  }
  if (selectedSites.length === 0) {
    throw new Error("At least one target site is required.");
  }
  const broadcast = await createPendingBroadcast(prompt, selectedSites);
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
      if (site.isCustom && site.permissionPattern) {
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
      const reusableTab = explicitTab ?? (!target.forceNewTab && settings.reuseExistingTabs ? reusableTabsBySiteId.get(site.id) ?? null : null);
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
        prompt: target.promptOverride ?? prompt,
        site,
        injected: false,
        status: "pending",
        createdAt: Date.now(),
        closeOnCancel: !reusableTab
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
  if (message?.status === "ok" && message?.siteId) {
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
  await maybeCreateSelectorNotification({
    siteId: message.siteId ?? "unknown",
    siteName: message.siteName ?? "AI service",
    pageUrl: message.pageUrl ?? "",
    missing
  });
  await markFailedSelector(message.siteId ?? "unknown", missing[0]?.selector ?? "", "selector-checker");
  return { ok: true };
}
async function handleSelectorFailedMessage(message) {
  const serviceId = message?.serviceId ?? "";
  const selector = message?.selector ?? "";
  const site = await getSiteById(serviceId);
  await markFailedSelector(serviceId, selector, "injector");
  await enqueueUiToast({
    message: getI18nMessage("toast_selector_failed", [site?.name ?? serviceId]) || `${site?.name ?? serviceId} selector was not found.`,
    type: "error",
    duration: -1
  });
  return { ok: true };
}
async function handleInjectSuccessMessage(message) {
  if (message?.serviceId) {
    await clearFailedSelector(message.serviceId);
  }
  return { ok: true };
}
async function handleInjectFallbackMessage(message) {
  const serviceId = message?.serviceId ?? "";
  const site = await getSiteById(serviceId);
  const copied = Boolean(message?.copied);
  await enqueueUiToast({
    message: copied ? getI18nMessage("toast_inject_fallback_copied", [site?.name ?? serviceId]) || `${site?.name ?? serviceId} prompt copied to clipboard. Paste it manually and send.` : getI18nMessage("toast_inject_fallback_manual", [site?.name ?? serviceId]) || `${site?.name ?? serviceId} automatic injection failed. Paste the prompt manually and send.`,
    type: "warning",
    duration: 5e3
  });
  return { ok: true };
}
async function handleUiToastMessage(message) {
  await enqueueUiToast(message?.toast ?? {});
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
    const result = await runServiceTestOnTab(preferredTab.tab.id, draft);
    return {
      ok: Boolean(result?.ok),
      tabId: preferredTab.tab.id,
      tabUrl: preferredTab.tab.url ?? "",
      ...result
    };
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Service test failed.", error);
    return {
      ok: false,
      reason: "error",
      error: error?.message ?? String(error)
    };
  }
}
async function getBroadcastCounter() {
  try {
    const result = await chrome.storage.local.get("broadcastCounter");
    return Number.isFinite(Number(result.broadcastCounter)) ? Number(result.broadcastCounter) : 0;
  } catch (_error) {
    return 0;
  }
}
async function incrementBroadcastCounter() {
  try {
    const current = await getBroadcastCounter();
    const next = current + 1;
    await chrome.storage.local.set({ broadcastCounter: next });
    return next;
  } catch (_error) {
    return 0;
  }
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message?.action) {
    case "broadcast":
      void handleBroadcastMessage(message).then((result) => sendResponse(result)).catch((error) => {
        console.error("[AI Prompt Broadcaster] Broadcast handling failed.", error);
        sendResponse({
          ok: false,
          error: error?.message ?? String(error)
        });
      });
      return true;
    case "selector-check:init":
      void handleSelectorCheckInit(message).then((result) => sendResponse(result)).catch((error) => {
        console.error("[AI Prompt Broadcaster] Selector check init failed.", error);
        sendResponse({
          ok: false,
          error: error?.message ?? String(error)
        });
      });
      return true;
    case "selector-check:report":
      void handleSelectorCheckReport(message).then((result) => sendResponse(result)).catch((error) => {
        console.error("[AI Prompt Broadcaster] Selector check report failed.", error);
        sendResponse({
          ok: false,
          error: error?.message ?? String(error)
        });
      });
      return true;
    case "service-test:run":
      void handleServiceTestRun(message).then((result) => sendResponse(result)).catch((error) => {
        console.error("[AI Prompt Broadcaster] Service test run failed.", error);
        sendResponse({
          ok: false,
          error: error?.message ?? String(error)
        });
      });
      return true;
    case "selectorFailed":
      void handleSelectorFailedMessage(message).then((result) => sendResponse(result)).catch((error) => {
        sendResponse({ ok: false, error: error?.message ?? String(error) });
      });
      return true;
    case "injectSuccess":
      void handleInjectSuccessMessage(message).then((result) => sendResponse(result)).catch((error) => {
        sendResponse({ ok: false, error: error?.message ?? String(error) });
      });
      return true;
    case "injectFallback":
      void handleInjectFallbackMessage(message).then((result) => sendResponse(result)).catch((error) => {
        sendResponse({ ok: false, error: error?.message ?? String(error) });
      });
      return true;
    case "uiToast":
      void handleUiToastMessage(message).then((result) => sendResponse(result)).catch((error) => {
        sendResponse({ ok: false, error: error?.message ?? String(error) });
      });
      return true;
    case "popupOpened":
      void handlePopupOpened().then((result) => sendResponse(result)).catch((error) => {
        sendResponse({ ok: false, error: error?.message ?? String(error) });
      });
      return true;
    case "getOpenAiTabs":
      void handleGetOpenAiTabsMessage(message).then((result) => sendResponse(result)).catch((error) => {
        sendResponse({ ok: false, error: error?.message ?? String(error) });
      });
      return true;
    case "cancelBroadcast":
      void handleCancelBroadcastMessage(message).then((result) => sendResponse(result)).catch((error) => {
        sendResponse({ ok: false, error: error?.message ?? String(error) });
      });
      return true;
    case "getActiveTabContext":
      void handleGetActiveTabContext().then((result) => sendResponse(result)).catch((error) => {
        sendResponse({ ok: false, url: "", title: "", selection: "", error: error?.message ?? String(error) });
      });
      return true;
    case "getBroadcastCounter":
      void getBroadcastCounter().then((counter) => sendResponse({ ok: true, counter })).catch((error) => {
        sendResponse({ ok: false, counter: 0, error: error?.message ?? String(error) });
      });
      return true;
    case "incrementBroadcastCounter":
      void incrementBroadcastCounter().then((counter) => sendResponse({ ok: true, counter })).catch((error) => {
        sendResponse({ ok: false, counter: 0, error: error?.message ?? String(error) });
      });
      return true;
    case "selection:update":
      sendResponse(handleSelectionUpdateMessage(message, sender));
      return false;
    default:
      return false;
  }
});
chrome.runtime.onInstalled.addListener(({ reason }) => {
  void (async () => {
    await createContextMenus();
    await ensureReconcileAlarm();
    if (reason === "install") {
      await setOnboardingCompleted(false);
      await openOnboardingPage();
    }
  })();
});
chrome.runtime.onStartup.addListener(() => {
  void initializeServiceWorker();
});
chrome.commands.onCommand.addListener((command) => {
  if (command === CAPTURE_SELECTION_COMMAND) {
    void handleCaptureSelectedTextCommand();
  }
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  void (async () => {
    try {
      const siteIds = await getContextMenuTargetSiteIds(info.menuItemId);
      if (siteIds.length === 0) {
        return;
      }
      const selectedText = typeof info.selectionText === "string" ? info.selectionText.trim() : "";
      if (!selectedText && typeof tab?.id === "number") {
        const cachedText = selectionCache.get(tab.id) ?? "";
        if (cachedText.trim()) {
          await handleContextMenuBroadcast(cachedText, siteIds);
        }
        return;
      }
      if (typeof tab?.id === "number" && selectedText) {
        selectionCache.set(tab.id, selectedText);
      }
      await handleContextMenuBroadcast(selectedText, siteIds);
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Context menu click handling failed.", error);
    }
  })();
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") {
    return;
  }
  void maybeInjectDynamicSelectorChecker(tabId, tab);
  void queuePendingInjection(tabId, tab);
});
chrome.tabs.onActivated.addListener((activeInfo) => {
  void (async () => {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      await rememberNormalTab(tab);
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
      lastNormalWindowId = windowId;
      const [activeTab] = await chrome.tabs.query({
        active: true,
        windowId
      });
      await rememberNormalTab(activeTab);
    } catch (_error) {
    }
  })();
});
chrome.tabs.onRemoved.addListener((tabId) => {
  void (async () => {
    try {
      selectionCache.delete(tabId);
      const pending = await getPendingInjections();
      const job = pending[String(tabId)];
      if (job?.broadcastId && job?.siteId) {
        await recordBroadcastSiteResult(job.broadcastId, job.siteId, "tab_closed");
      }
      await removePendingInjection(tabId);
      activeInjections.delete(tabId);
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Tab removal cleanup failed.", {
        tabId,
        error
      });
      activeInjections.delete(tabId);
    }
  })();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RECONCILE_ALARM) {
    void reconcilePendingInjections();
    return;
  }
  if (alarm.name === BADGE_CLEAR_ALARM) {
    void clearBadge();
  }
});
chrome.notifications.onClicked.addListener(() => {
  void openPopupWithPrompt();
});
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && (changes.customSites || changes.builtInSiteStates || changes.builtInSiteOverrides)) {
    void createContextMenus();
  }
});
void initializeServiceWorker();
