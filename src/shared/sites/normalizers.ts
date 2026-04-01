// @ts-nocheck
import { BUILT_IN_SITE_STYLE_MAP, VALID_INPUT_TYPES, VALID_SELECTOR_CHECK_MODES, VALID_SUBMIT_METHODS } from "./constants";

export function safeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeBoolean(value, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeWaitMs(value, fallback = 2000) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(8000, Math.max(500, Math.round(numeric)));
}

export function normalizeColor(value, fallback = "#c24f2e") {
  const color = safeText(value);
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

export function normalizeIcon(value, fallback = "AI") {
  const icon = safeText(value);
  return icon ? Array.from(icon).slice(0, 2).join("") : fallback;
}

export function normalizeInputType(value, fallback = "textarea") {
  const inputType = safeText(value);
  return VALID_INPUT_TYPES.has(inputType) ? inputType : fallback;
}

export function normalizeSubmitMethod(value, fallback = "click") {
  const submitMethod = safeText(value);
  return VALID_SUBMIT_METHODS.has(submitMethod) ? submitMethod : fallback;
}

export function normalizeSelectorCheckMode(value, fallback = "input-and-submit") {
  const selectorCheckMode = safeText(value);
  return VALID_SELECTOR_CHECK_MODES.has(selectorCheckMode) ? selectorCheckMode : fallback;
}

export function normalizeHostname(value) {
  const input = safeText(value).replace(/\/+$/g, "");
  if (!input) {
    return "";
  }

  try {
    return new URL(input).hostname.toLowerCase();
  } catch (_error) {
    return input.toLowerCase();
  }
}

export function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => safeText(entry))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n/g)
      .map((entry) => safeText(entry))
      .filter(Boolean);
  }

  return [];
}

export function normalizeHostnameAliases(value, primaryHostname = "") {
  const normalizedPrimaryHostname = normalizeHostname(primaryHostname);

  return Array.from(
    new Set(
      normalizeStringList(value)
        .map((entry) => normalizeHostname(entry))
        .filter((entry) => entry && entry !== normalizedPrimaryHostname)
    )
  );
}

export function deriveHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (_error) {
    return "";
  }
}

export function buildOriginPattern(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}/*`;
  } catch (_error) {
    return "";
  }
}

function normalizeOriginHost(value) {
  const input = safeText(value).replace(/\/+$/g, "");
  if (!input) {
    return "";
  }

  try {
    const parsed = new URL(input);
    if (parsed.host) {
      return parsed.host.toLowerCase();
    }
  } catch (_error) {
    // Fall through to protocol-prefixed parsing.
  }

  try {
    return new URL(`https://${input}`).host.toLowerCase();
  } catch (_nestedError) {
    return input.toLowerCase();
  }
}

export function buildOriginPatterns(url, hostnameAliases = []) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return [];
    }

    const primaryHost = normalizeOriginHost(parsed.host);
    const primaryHostname = normalizeHostname(parsed.hostname);
    const normalizedAliases = Array.from(
      new Set(
        normalizeStringList(hostnameAliases)
          .map((entry) => normalizeOriginHost(entry))
          .filter((entry) => entry && entry !== primaryHost && entry !== primaryHostname)
      )
    );
    return Array.from(
      new Set(
        [primaryHost, ...normalizedAliases]
          .filter(Boolean)
          .map((host) => `${parsed.protocol}//${host}/*`)
      )
    );
  } catch (_error) {
    return [];
  }
}

export function createCustomSiteId(name) {
  const slug = safeText(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  return `custom-${slug || Date.now()}-${Date.now().toString(36).slice(-4)}`;
}

export function createImportedCustomSiteIdBase(site, index = 0) {
  const seed = [
    safeText(site?.id),
    safeText(site?.name),
    normalizeHostname(site?.hostname || deriveHostname(site?.url)),
    `site-${index + 1}`,
  ].find(Boolean);

  const slug = safeText(seed)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  return `custom-${slug || `site-${index + 1}`}`;
}

export function ensureUniqueImportedSiteId(baseId, usedIds) {
  let candidate = safeText(baseId) || "custom-site";
  let suffix = 2;

  while (usedIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(candidate);
  return candidate;
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function stringifyComparable(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch (_error) {
    return "";
  }
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

export function buildBaseSiteRecord(site, builtInMeta = {}) {
  const style = BUILT_IN_SITE_STYLE_MAP[site.id] ?? {};
  const url = safeText(site.url);
  const hostname = normalizeHostname(site.hostname || deriveHostname(url));
  const hostnameAliases = normalizeHostnameAliases(site.hostnameAliases, hostname);
  const normalizedSelectors = normalizePerplexitySelectors(site);

  return {
    id: safeText(site.id),
    name: safeText(site.name) || "AI Service",
    url,
    hostname,
    hostnameAliases,
    inputSelector: normalizedSelectors.inputSelector,
    inputType: normalizeInputType(site.inputType, "textarea"),
    submitSelector: safeText(site.submitSelector),
    submitMethod: normalizeSubmitMethod(site.submitMethod, "click"),
    selectorCheckMode: normalizeSelectorCheckMode(site.selectorCheckMode, "input-and-submit"),
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
    permissionPatterns: buildOriginPatterns(url, hostnameAliases),
  };
}

export function sanitizeBuiltInOverride(override = {}, originalSite = {}) {
  const submitMethod = normalizeSubmitMethod(override.submitMethod, originalSite.submitMethod);
  const submitSelector =
    submitMethod === "click"
      ? safeText(override.submitSelector) || safeText(originalSite.submitSelector)
      : safeText(override.submitSelector);

  return {
    name: safeText(override.name) || originalSite.name,
    inputSelector: safeText(override.inputSelector) || originalSite.inputSelector,
    inputType: normalizeInputType(override.inputType, originalSite.inputType),
    submitSelector,
    submitMethod,
    selectorCheckMode: normalizeSelectorCheckMode(
      override.selectorCheckMode,
      originalSite.selectorCheckMode || "input-and-submit"
    ),
    waitMs: normalizeWaitMs(override.waitMs, originalSite.waitMs),
    fallbackSelectors: Array.isArray(override.fallbackSelectors)
      ? override.fallbackSelectors.filter((entry) => typeof entry === "string" && entry.trim())
      : Array.isArray(originalSite.fallbackSelectors)
        ? [...originalSite.fallbackSelectors]
        : [],
    authSelectors: Array.isArray(override.authSelectors)
      ? override.authSelectors.filter((entry) => typeof entry === "string" && entry.trim())
      : Array.isArray(originalSite.authSelectors)
        ? [...originalSite.authSelectors]
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

export function normalizeCustomSite(site) {
  const url = safeText(site?.url);
  const hostname = normalizeHostname(site?.hostname || deriveHostname(url));

  return buildBaseSiteRecord(
    {
      id: safeText(site?.id) || createCustomSiteId(site?.name),
      name: safeText(site?.name) || "Custom AI",
      url,
      hostname,
      hostnameAliases: normalizeHostnameAliases(site?.hostnameAliases, hostname),
      inputSelector: safeText(site?.inputSelector),
      inputType: normalizeInputType(site?.inputType, "textarea"),
      submitSelector: safeText(site?.submitSelector),
      submitMethod: normalizeSubmitMethod(site?.submitMethod, "click"),
      selectorCheckMode: normalizeSelectorCheckMode(
        site?.selectorCheckMode,
        "input-and-submit"
      ),
      waitMs: normalizeWaitMs(site?.waitMs, 2000),
      fallbackSelectors: normalizeStringList(site?.fallbackSelectors),
      fallback: normalizeBoolean(site?.fallback, true),
      authSelectors: normalizeStringList(site?.authSelectors),
      lastVerified: safeText(site?.lastVerified),
      verifiedVersion: safeText(site?.verifiedVersion),
      enabled: normalizeBoolean(site?.enabled, true),
      color: normalizeColor(site?.color, "#c24f2e"),
      icon: normalizeIcon(site?.icon, "AI"),
    },
    { isCustom: true }
  );
}
