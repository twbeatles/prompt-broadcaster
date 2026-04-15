import {
  BUILT_IN_SITE_STYLE_MAP,
  VALID_INPUT_TYPES,
  VALID_SELECTOR_CHECK_MODES,
  VALID_SUBMIT_METHODS,
} from "./constants";
import { buildVerificationMetadata } from "./verification";
import {
  getConfiguredSupportedRoutes,
  normalizeSupportedRoutes,
} from "./selector-utils";
import type {
  InputType,
  RuntimeSite,
  SelectorCheckMode,
  SubmitMethod,
  VerifiedAuthState,
} from "../types/models";

type PlainRecord = Record<string, unknown>;

interface BuiltInMeta {
  isBuiltIn?: boolean;
  isCustom?: boolean;
}

const BUILT_IN_SITE_STYLE_LOOKUP = BUILT_IN_SITE_STYLE_MAP as Record<
  string,
  { color?: string; icon?: string }
>;

export function safeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeBoolean(value: unknown, fallback = true): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeWaitMs(value: unknown, fallback = 2000): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(8000, Math.max(500, Math.round(numeric)));
}

export function normalizeColor(value: unknown, fallback = "#c24f2e"): string {
  const color = safeText(value);
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

export function normalizeIcon(value: unknown, fallback = "AI"): string {
  const icon = safeText(value);
  return icon ? Array.from(icon).slice(0, 2).join("") : fallback;
}

export function normalizeInputType(
  value: unknown,
  fallback: InputType = "textarea",
): InputType {
  const inputType = safeText(value);
  return VALID_INPUT_TYPES.has(inputType)
    ? (inputType as InputType)
    : fallback;
}

export function normalizeSubmitMethod(
  value: unknown,
  fallback: SubmitMethod = "click",
): SubmitMethod {
  const submitMethod = safeText(value);
  return VALID_SUBMIT_METHODS.has(submitMethod)
    ? (submitMethod as SubmitMethod)
    : fallback;
}

export function normalizeSelectorCheckMode(
  value: unknown,
  fallback: SelectorCheckMode = "input-and-submit",
): SelectorCheckMode {
  const selectorCheckMode = safeText(value);
  return VALID_SELECTOR_CHECK_MODES.has(selectorCheckMode)
    ? (selectorCheckMode as SelectorCheckMode)
    : fallback;
}

export function normalizeHostname(value: unknown): string {
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

export function normalizeStringList(value: unknown): string[] {
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

export function normalizeHostnameAliases(
  value: unknown,
  primaryHostname = "",
): string[] {
  const normalizedPrimaryHostname = normalizeHostname(primaryHostname);

  return Array.from(
    new Set(
      normalizeStringList(value)
        .map((entry) => normalizeHostname(entry))
        .filter((entry) => entry && entry !== normalizedPrimaryHostname),
    ),
  );
}

export function deriveHostname(url: unknown): string {
  try {
    return new URL(String(url ?? "")).hostname;
  } catch (_error) {
    return "";
  }
}

export function buildOriginPattern(url: unknown): string {
  try {
    const parsed = new URL(String(url ?? ""));
    return `${parsed.origin}/*`;
  } catch (_error) {
    return "";
  }
}

function normalizeOriginHost(value: unknown): string {
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

export function buildOriginPatterns(
  url: unknown,
  hostnameAliases: unknown = [],
): string[] {
  try {
    const parsed = new URL(String(url ?? ""));
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return [];
    }

    const primaryHost = normalizeOriginHost(parsed.host);
    const primaryHostname = normalizeHostname(parsed.hostname);
    const normalizedAliases = Array.from(
      new Set(
        normalizeStringList(hostnameAliases)
          .map((entry) => normalizeOriginHost(entry))
          .filter(
            (entry) => entry && entry !== primaryHost && entry !== primaryHostname,
          ),
      ),
    );

    return Array.from(
      new Set(
        [primaryHost, ...normalizedAliases]
          .filter(Boolean)
          .map((host) => `${parsed.protocol}//${host}/*`),
      ),
    );
  } catch (_error) {
    return [];
  }
}

export function createCustomSiteId(name: unknown): string {
  const slug = safeText(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  return `custom-${slug || Date.now()}-${Date.now().toString(36).slice(-4)}`;
}

export function createImportedCustomSiteIdBase(
  site: PlainRecord | null | undefined,
  index = 0,
): string {
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

export function ensureUniqueImportedSiteId(
  baseId: unknown,
  usedIds: Set<string>,
): string {
  let candidate = safeText(baseId) || "custom-site";
  let suffix = 2;

  while (usedIds.has(candidate)) {
    candidate = `${safeText(baseId)}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(candidate);
  return candidate;
}

export function isPlainObject(value: unknown): value is PlainRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function stringifyComparable(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch (_error) {
    return "";
  }
}

const PERPLEXITY_PRIMARY_INPUT_SELECTOR =
  "#ask-input[data-lexical-editor='true'][role='textbox']";
const PERPLEXITY_SELECTOR_FALLBACKS = [
  "div#ask-input[data-lexical-editor='true'][role='textbox']",
  "div#ask-input[contenteditable='true'][role='textbox']",
  "#ask-input[contenteditable='true']",
  "div[contenteditable='true'][role='textbox']",
];

function normalizeSelectorArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
      .filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
      .map((entry) => entry.trim())
    : [];
}

function normalizePerplexitySelectors(
  site: PlainRecord = {},
): {
  inputSelector: string;
  fallbackSelectors: string[];
} {
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
      ].filter(Boolean),
    ),
  );

  return {
    inputSelector: PERPLEXITY_PRIMARY_INPUT_SELECTOR,
    fallbackSelectors: mergedFallbackSelectors,
  };
}

export function buildBaseSiteRecord(
  site: PlainRecord,
  builtInMeta: BuiltInMeta = {},
): RuntimeSite {
  const style = BUILT_IN_SITE_STYLE_LOOKUP[safeText(site.id)] ?? {};
  const url = safeText(site.url);
  const hostname = normalizeHostname(site.hostname || deriveHostname(url));
  const hostnameAliases = normalizeHostnameAliases(site.hostnameAliases, hostname);
  const normalizedSelectors = normalizePerplexitySelectors(site);
  const verification = buildVerificationMetadata(site);
  const supportedRoutes = getConfiguredSupportedRoutes(site);
  const verifiedAuthState = verification.verifiedAuthState || undefined;

  return {
    id: safeText(site.id),
    name: safeText(site.name) || "AI Service",
    url,
    hostname,
    hostnameAliases,
    supportedRoutes,
    inputSelector: normalizedSelectors.inputSelector,
    inputType: normalizeInputType(site.inputType, "textarea"),
    submitSelector: safeText(site.submitSelector),
    submitMethod: normalizeSubmitMethod(site.submitMethod, "click"),
    selectorCheckMode: normalizeSelectorCheckMode(
      site.selectorCheckMode,
      "input-and-submit",
    ),
    waitMs: normalizeWaitMs(site.waitMs, 2000),
    fallbackSelectors: normalizedSelectors.fallbackSelectors,
    fallback: normalizeBoolean(site.fallback, true),
    authSelectors: Array.isArray(site.authSelectors)
      ? site.authSelectors.filter(
        (entry): entry is string => typeof entry === "string" && Boolean(entry.trim()),
      )
      : [],
    lastVerified: verification.lastVerified,
    verifiedAt: verification.verifiedAt,
    verifiedRoute: verification.verifiedRoute,
    verifiedAuthState,
    verifiedLocale: verification.verifiedLocale,
    verifiedVersion: verification.verifiedVersion,
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

export function sanitizeBuiltInOverride(
  override: PlainRecord = {},
  originalSite: PlainRecord = {},
): Partial<RuntimeSite> {
  const submitMethod = normalizeSubmitMethod(
    override.submitMethod,
    normalizeSubmitMethod(originalSite.submitMethod, "click"),
  );
  const submitSelector =
    submitMethod === "click"
      ? safeText(override.submitSelector) || safeText(originalSite.submitSelector)
      : safeText(override.submitSelector);
  const verification = buildVerificationMetadata(override, originalSite);
  const supportedRoutes = Object.prototype.hasOwnProperty.call(
    override ?? {},
    "supportedRoutes",
  )
    ? normalizeSupportedRoutes(override.supportedRoutes)
    : getConfiguredSupportedRoutes(originalSite);
  const verifiedAuthState = verification.verifiedAuthState || undefined;

  return {
    name: safeText(override.name) || safeText(originalSite.name),
    supportedRoutes,
    inputSelector: safeText(override.inputSelector) || safeText(originalSite.inputSelector),
    inputType: normalizeInputType(
      override.inputType,
      normalizeInputType(originalSite.inputType, "textarea"),
    ),
    submitSelector,
    submitMethod,
    selectorCheckMode: normalizeSelectorCheckMode(
      override.selectorCheckMode,
      normalizeSelectorCheckMode(
        originalSite.selectorCheckMode,
        "input-and-submit",
      ),
    ),
    waitMs: normalizeWaitMs(override.waitMs, normalizeWaitMs(originalSite.waitMs, 2000)),
    fallbackSelectors: Array.isArray(override.fallbackSelectors)
      ? override.fallbackSelectors.filter(
        (entry): entry is string => typeof entry === "string" && Boolean(entry.trim()),
      )
      : Array.isArray(originalSite.fallbackSelectors)
        ? originalSite.fallbackSelectors.filter(
          (entry): entry is string => typeof entry === "string" && Boolean(entry.trim()),
        )
        : [],
    authSelectors: Array.isArray(override.authSelectors)
      ? override.authSelectors.filter(
        (entry): entry is string => typeof entry === "string" && Boolean(entry.trim()),
      )
      : Array.isArray(originalSite.authSelectors)
        ? originalSite.authSelectors.filter(
          (entry): entry is string => typeof entry === "string" && Boolean(entry.trim()),
        )
        : [],
    lastVerified: verification.lastVerified,
    verifiedAt: verification.verifiedAt,
    verifiedRoute: verification.verifiedRoute,
    verifiedAuthState,
    verifiedLocale: verification.verifiedLocale,
    verifiedVersion: verification.verifiedVersion,
    color: normalizeColor(
      override.color,
      BUILT_IN_SITE_STYLE_LOOKUP[safeText(originalSite.id)]?.color ?? "#c24f2e",
    ),
    icon: normalizeIcon(
      override.icon,
      BUILT_IN_SITE_STYLE_LOOKUP[safeText(originalSite.id)]?.icon
        ?? safeText(originalSite.name),
    ),
  };
}

export function normalizeCustomSite(site: unknown): RuntimeSite {
  const source = isPlainObject(site) ? site : {};
  const url = safeText(source?.url);
  const hostname = normalizeHostname(source?.hostname || deriveHostname(url));
  const verificationFields: Partial<PlainRecord> = {};

  if (Object.prototype.hasOwnProperty.call(source, "lastVerified")) {
    verificationFields.lastVerified = safeText(source?.lastVerified);
  }

  if (Object.prototype.hasOwnProperty.call(source, "verifiedAt")) {
    verificationFields.verifiedAt = safeText(source?.verifiedAt);
  }

  if (Object.prototype.hasOwnProperty.call(source, "verifiedRoute")) {
    verificationFields.verifiedRoute = safeText(source?.verifiedRoute);
  }

  if (Object.prototype.hasOwnProperty.call(source, "verifiedAuthState")) {
    verificationFields.verifiedAuthState = safeText(source?.verifiedAuthState) as
      | VerifiedAuthState
      | "";
  }

  if (Object.prototype.hasOwnProperty.call(source, "verifiedLocale")) {
    verificationFields.verifiedLocale = safeText(source?.verifiedLocale);
  }

  if (Object.prototype.hasOwnProperty.call(source, "verifiedVersion")) {
    verificationFields.verifiedVersion = safeText(source?.verifiedVersion);
  }

  return buildBaseSiteRecord(
    {
      id: safeText(source?.id) || createCustomSiteId(source?.name),
      name: safeText(source?.name) || "Custom AI",
      url,
      hostname,
      hostnameAliases: normalizeHostnameAliases(source?.hostnameAliases, hostname),
      supportedRoutes: Object.prototype.hasOwnProperty.call(source, "supportedRoutes")
        ? source?.supportedRoutes
        : undefined,
      inputSelector: safeText(source?.inputSelector),
      inputType: normalizeInputType(source?.inputType, "textarea"),
      submitSelector: safeText(source?.submitSelector),
      submitMethod: normalizeSubmitMethod(source?.submitMethod, "click"),
      selectorCheckMode: normalizeSelectorCheckMode(
        source?.selectorCheckMode,
        "input-and-submit",
      ),
      waitMs: normalizeWaitMs(source?.waitMs, 2000),
      fallbackSelectors: normalizeStringList(source?.fallbackSelectors),
      fallback: normalizeBoolean(source?.fallback, true),
      authSelectors: normalizeStringList(source?.authSelectors),
      ...verificationFields,
      enabled: normalizeBoolean(source?.enabled, true),
      color: normalizeColor(source?.color, "#c24f2e"),
      icon: normalizeIcon(source?.icon, "AI"),
    },
    { isCustom: true },
  );
}
