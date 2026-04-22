import { BUILT_IN_SITE_STYLE_MAP } from "../constants";
import { buildVerificationMetadata } from "../verification";
import {
  getConfiguredSupportedRoutes,
  normalizeSupportedRoutes,
} from "../selector-utils";
import type {
  RuntimeSite,
  VerifiedAuthState,
} from "../../types/models";
import {
  buildOriginPatterns,
  deriveHostname,
  isPlainObject,
  normalizeBoolean,
  normalizeColor,
  normalizeHostname,
  normalizeHostnameAliases,
  normalizeIcon,
  normalizeInputType,
  normalizeSelectorCheckMode,
  normalizeStringList,
  normalizeSubmitMethod,
  normalizeWaitMs,
  safeText,
} from "./core";
import { createCustomSiteId } from "./ids";
import type { BuiltInMeta, PlainRecord } from "./types";

const BUILT_IN_SITE_STYLE_LOOKUP = BUILT_IN_SITE_STYLE_MAP as Record<
  string,
  { color?: string; icon?: string }
>;

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
        .filter(
          (entry): entry is string =>
            typeof entry === "string" && Boolean(entry.trim()),
        )
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
        overrideInputSelector &&
        overrideInputSelector !== PERPLEXITY_PRIMARY_INPUT_SELECTOR
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

function normalizeTrimmedStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is string =>
          typeof entry === "string" && Boolean(entry.trim()),
      )
    : [];
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
    authSelectors: normalizeTrimmedStringArray(site.authSelectors),
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
      ? safeText(override.submitSelector) ||
        safeText(originalSite.submitSelector)
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
    inputSelector:
      safeText(override.inputSelector) || safeText(originalSite.inputSelector),
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
    waitMs: normalizeWaitMs(
      override.waitMs,
      normalizeWaitMs(originalSite.waitMs, 2000),
    ),
    fallbackSelectors: Array.isArray(override.fallbackSelectors)
      ? normalizeTrimmedStringArray(override.fallbackSelectors)
      : Array.isArray(originalSite.fallbackSelectors)
        ? normalizeTrimmedStringArray(originalSite.fallbackSelectors)
        : [],
    authSelectors: Array.isArray(override.authSelectors)
      ? normalizeTrimmedStringArray(override.authSelectors)
      : Array.isArray(originalSite.authSelectors)
        ? normalizeTrimmedStringArray(originalSite.authSelectors)
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
      BUILT_IN_SITE_STYLE_LOOKUP[safeText(originalSite.id)]?.icon ??
        safeText(originalSite.name),
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
      supportedRoutes: Object.prototype.hasOwnProperty.call(
        source,
        "supportedRoutes",
      )
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
