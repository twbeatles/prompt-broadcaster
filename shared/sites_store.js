import { AI_SITES } from "../config/sites.js";
import { isValidURL } from "./security.js";

export const SITE_STORAGE_KEYS = Object.freeze({
  customSites: "customSites",
  builtInSiteStates: "builtInSiteStates",
  builtInSiteOverrides: "builtInSiteOverrides",
});

const VALID_INPUT_TYPES = new Set(["textarea", "contenteditable", "input"]);
const VALID_SUBMIT_METHODS = new Set(["click", "enter", "shift+enter"]);

const BUILT_IN_SITE_STYLE_MAP = Object.freeze({
  chatgpt: { color: "#10a37f", icon: "GPT" },
  gemini: { color: "#4285f4", icon: "Gem" },
  claude: { color: "#d97706", icon: "Cl" },
  grok: { color: "#000000", icon: "Gk" },
});

function safeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBoolean(value, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeWaitMs(value, fallback = 2000) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(8000, Math.max(500, Math.round(numeric)));
}

function normalizeColor(value, fallback = "#c24f2e") {
  const color = safeText(value);
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function normalizeIcon(value, fallback = "AI") {
  const icon = safeText(value);
  return icon ? Array.from(icon).slice(0, 2).join("") : fallback;
}

function normalizeInputType(value, fallback = "textarea") {
  const inputType = safeText(value);
  return VALID_INPUT_TYPES.has(inputType) ? inputType : fallback;
}

function normalizeSubmitMethod(value, fallback = "click") {
  const submitMethod = safeText(value);
  return VALID_SUBMIT_METHODS.has(submitMethod) ? submitMethod : fallback;
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
  const slug = safeText(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  return `custom-${slug || Date.now()}-${Date.now().toString(36).slice(-4)}`;
}

const PERPLEXITY_PRIMARY_INPUT_SELECTOR = "#ask-input[data-lexical-editor='true'][role='textbox']";
const PERPLEXITY_SELECTOR_FALLBACKS = [
  "div#ask-input[data-lexical-editor='true'][role='textbox']",
  "div#ask-input[contenteditable='true'][role='textbox']",
  "#ask-input[contenteditable='true']",
  "div[contenteditable='true'][role='textbox']",
];

function normalizeSelectorArray(value) {
  return Array.isArray(value)
    ? value.filter((entry) => typeof entry === "string" && entry.trim()).map((entry) => entry.trim())
    : [];
}

function normalizePerplexitySelectors(site = {}) {
  if (safeText(site?.id) !== "perplexity") {
    return {
      inputSelector: safeText(site?.inputSelector),
      fallbackSelectors: normalizeSelectorArray(site?.fallbackSelectors),
    };
  }

  const overrideInputSelector = safeText(site?.inputSelector);
  const fallbackSelectors = normalizeSelectorArray(site?.fallbackSelectors);
  const mergedFallbackSelectors = Array.from(
    new Set(
      [
        overrideInputSelector && overrideInputSelector !== PERPLEXITY_PRIMARY_INPUT_SELECTOR
          ? overrideInputSelector
          : "",
        ...fallbackSelectors,
        ...PERPLEXITY_SELECTOR_FALLBACKS,
      ].filter(Boolean)
    )
  );

  return {
    inputSelector: PERPLEXITY_PRIMARY_INPUT_SELECTOR,
    fallbackSelectors: mergedFallbackSelectors,
  };
}

function buildBaseSiteRecord(site, builtInMeta = {}) {
  const style = BUILT_IN_SITE_STYLE_MAP[site.id] ?? {};
  const url = safeText(site.url);
  const normalizedSelectors = normalizePerplexitySelectors(site);

  return {
    id: safeText(site.id),
    name: safeText(site.name) || "AI Service",
    url,
    hostname: site.hostname || deriveHostname(url),
    inputSelector: normalizedSelectors.inputSelector,
    inputType: normalizeInputType(site.inputType, "textarea"),
    submitSelector: safeText(site.submitSelector),
    submitMethod: normalizeSubmitMethod(site.submitMethod, "click"),
    waitMs: normalizeWaitMs(site.waitMs, 2000),
    fallbackSelectors: normalizedSelectors.fallbackSelectors,
    fallback: normalizeBoolean(site.fallback, true),
    authSelectors: Array.isArray(site.authSelectors)
      ? site.authSelectors.filter((entry) => typeof entry === "string" && entry.trim())
      : [],
    lastVerified: safeText(site.lastVerified),
    verifiedVersion: safeText(site.verifiedVersion),
    enabled: normalizeBoolean(site.enabled, true),
    color: normalizeColor(site.color, style.color ?? "#c24f2e"),
    icon: normalizeIcon(site.icon, style.icon ?? "AI"),
    isBuiltIn: Boolean(builtInMeta.isBuiltIn),
    isCustom: Boolean(builtInMeta.isCustom),
    deletable: Boolean(builtInMeta.isCustom),
    editable: true,
    permissionPattern: buildOriginPattern(url),
  };
}

function sanitizeBuiltInOverride(override = {}, originalSite = {}) {
  return {
    name: safeText(override.name) || originalSite.name,
    inputSelector: safeText(override.inputSelector) || originalSite.inputSelector,
    inputType: normalizeInputType(override.inputType, originalSite.inputType),
    submitSelector: safeText(override.submitSelector),
    submitMethod: normalizeSubmitMethod(override.submitMethod, originalSite.submitMethod),
    waitMs: normalizeWaitMs(override.waitMs, originalSite.waitMs),
    fallbackSelectors: Array.isArray(override.fallbackSelectors)
      ? override.fallbackSelectors.filter((entry) => typeof entry === "string" && entry.trim())
      : Array.isArray(originalSite.fallbackSelectors)
        ? [...originalSite.fallbackSelectors]
        : [],
    lastVerified: safeText(override.lastVerified) || safeText(originalSite.lastVerified),
    verifiedVersion:
      safeText(override.verifiedVersion) || safeText(originalSite.verifiedVersion),
    color: normalizeColor(
      override.color,
      BUILT_IN_SITE_STYLE_MAP[originalSite.id]?.color ?? "#c24f2e"
    ),
    icon: normalizeIcon(
      override.icon,
      BUILT_IN_SITE_STYLE_MAP[originalSite.id]?.icon ?? originalSite.name
    ),
  };
}

function normalizeCustomSite(site) {
  const url = safeText(site?.url);

  return buildBaseSiteRecord(
    {
      id: safeText(site?.id) || createCustomSiteId(site?.name),
      name: safeText(site?.name) || "Custom AI",
      url,
      hostname: deriveHostname(url),
      inputSelector: safeText(site?.inputSelector),
      inputType: normalizeInputType(site?.inputType, "textarea"),
      submitSelector: safeText(site?.submitSelector),
      submitMethod: normalizeSubmitMethod(site?.submitMethod, "click"),
      waitMs: normalizeWaitMs(site?.waitMs, 2000),
      fallbackSelectors: Array.isArray(site?.fallbackSelectors)
        ? site.fallbackSelectors.filter((entry) => typeof entry === "string" && entry.trim())
        : [],
      fallback: normalizeBoolean(site?.fallback, true),
      authSelectors: [],
      lastVerified: safeText(site?.lastVerified),
      verifiedVersion: safeText(site?.verifiedVersion),
      enabled: normalizeBoolean(site?.enabled, true),
      color: normalizeColor(site?.color, "#c24f2e"),
      icon: normalizeIcon(site?.icon, "AI"),
    },
    { isCustom: true }
  );
}

function normalizeBuiltInStates(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => AI_SITES.some((site) => site.id === key))
      .map(([key, entry]) => [key, { enabled: normalizeBoolean(entry?.enabled, true) }])
  );
}

function normalizeBuiltInOverrides(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => AI_SITES.some((site) => site.id === key))
      .map(([key, entry]) => {
        const source = AI_SITES.find((site) => site.id === key);
        return [key, sanitizeBuiltInOverride(entry, source)];
      })
  );
}

async function readLocal(key, fallbackValue) {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? fallbackValue;
}

async function writeLocal(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

export function validateSiteDraft(draft, { isBuiltIn = false } = {}) {
  const errors = [];
  const name = safeText(draft?.name);
  const url = safeText(draft?.url);
  const inputSelector = safeText(draft?.inputSelector);

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

  if (!VALID_INPUT_TYPES.has(safeText(draft?.inputType))) {
    errors.push("Input type is invalid.");
  }

  if (!VALID_SUBMIT_METHODS.has(safeText(draft?.submitMethod))) {
    errors.push("Submit method is invalid.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function getCustomSites() {
  const rawSites = await readLocal(SITE_STORAGE_KEYS.customSites, []);
  return Array.isArray(rawSites) ? rawSites.map((site) => normalizeCustomSite(site)) : [];
}

export async function setCustomSites(sites) {
  const normalized = Array.isArray(sites) ? sites.map((site) => normalizeCustomSite(site)) : [];
  await writeLocal(SITE_STORAGE_KEYS.customSites, normalized);
  return normalized;
}

export async function getBuiltInSiteStates() {
  const rawStates = await readLocal(SITE_STORAGE_KEYS.builtInSiteStates, {});
  return normalizeBuiltInStates(rawStates);
}

export async function setBuiltInSiteStates(states) {
  const normalized = normalizeBuiltInStates(states);
  await writeLocal(SITE_STORAGE_KEYS.builtInSiteStates, normalized);
  return normalized;
}

export async function getBuiltInSiteOverrides() {
  const rawOverrides = await readLocal(SITE_STORAGE_KEYS.builtInSiteOverrides, {});
  return normalizeBuiltInOverrides(rawOverrides);
}

export async function setBuiltInSiteOverrides(overrides) {
  const normalized = normalizeBuiltInOverrides(overrides);
  await writeLocal(SITE_STORAGE_KEYS.builtInSiteOverrides, normalized);
  return normalized;
}

export async function getRuntimeSites() {
  const [customSites, builtInStates, builtInOverrides] = await Promise.all([
    getCustomSites(),
    getBuiltInSiteStates(),
    getBuiltInSiteOverrides(),
  ]);

  const builtInSites = AI_SITES.map((site) => {
    const override = builtInOverrides[site.id] ?? {};
    const state = builtInStates[site.id] ?? {};
    return buildBaseSiteRecord(
      {
        ...site,
        ...override,
        enabled: normalizeBoolean(state.enabled, true),
      },
      { isBuiltIn: true }
    );
  });

  return [...builtInSites, ...customSites];
}

export async function getEnabledRuntimeSites() {
  const sites = await getRuntimeSites();
  return sites.filter((site) => site.enabled);
}

export async function findRuntimeSiteById(siteId) {
  const sites = await getRuntimeSites();
  return sites.find((site) => site.id === siteId) ?? null;
}

export async function saveCustomSite(siteDraft) {
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

export async function saveBuiltInSiteOverride(siteId, overrideDraft) {
  const source = AI_SITES.find((site) => site.id === siteId);
  if (!source) {
    throw new Error("Built-in site not found.");
  }

  const overrides = await getBuiltInSiteOverrides();
  overrides[siteId] = sanitizeBuiltInOverride(overrideDraft, source);
  await setBuiltInSiteOverrides(overrides);
  return overrides[siteId];
}

export async function updateRuntimeSite(siteId, partialDraft = {}) {
  const runtimeSite = await findRuntimeSiteById(siteId);
  if (!runtimeSite) {
    throw new Error("Runtime site not found.");
  }

  const nextDraft = {
    ...runtimeSite,
    ...(partialDraft ?? {}),
  };

  if (runtimeSite.isBuiltIn) {
    await saveBuiltInSiteOverride(siteId, nextDraft);
    if (typeof partialDraft.enabled === "boolean") {
      await setRuntimeSiteEnabled(siteId, partialDraft.enabled);
    }
    return findRuntimeSiteById(siteId);
  }

  await saveCustomSite(nextDraft);
  return findRuntimeSiteById(siteId);
}

export async function setRuntimeSiteEnabled(siteId, enabled) {
  const builtInSite = AI_SITES.find((site) => site.id === siteId);
  if (builtInSite) {
    const states = await getBuiltInSiteStates();
    states[siteId] = { enabled: Boolean(enabled) };
    await setBuiltInSiteStates(states);
    return;
  }

  const customSites = await getCustomSites();
  const nextSites = customSites.map((site) =>
    site.id === siteId ? { ...site, enabled: Boolean(enabled) } : site
  );
  await setCustomSites(nextSites);
}

export async function deleteCustomSite(siteId) {
  const customSites = await getCustomSites();
  const nextSites = customSites.filter((site) => site.id !== siteId);
  await setCustomSites(nextSites);
  return nextSites;
}

export async function resetSiteSettings() {
  await Promise.all([
    writeLocal(SITE_STORAGE_KEYS.customSites, []),
    writeLocal(SITE_STORAGE_KEYS.builtInSiteStates, {}),
    writeLocal(SITE_STORAGE_KEYS.builtInSiteOverrides, {}),
  ]);
}

export function buildSitePermissionPattern(url) {
  return buildOriginPattern(url);
}
