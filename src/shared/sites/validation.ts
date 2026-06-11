import { isValidURL } from "../security";
import {
  VALID_INPUT_TYPES,
  VALID_SELECTOR_CHECK_MODES,
  VALID_SUBMIT_METHODS,
  VALID_VERIFIED_AUTH_STATES,
} from "./constants";
import { validateHostnameAliases } from "./hostname-aliases";
import { safeText } from "./normalizers";
import { normalizeSelectorEntries } from "./selector-utils";
import { normalizeVerifiedAt } from "./verification";

export interface SiteDraftValidationResult {
  valid: boolean;
  errors: string[];
  fieldErrors: Partial<Record<
    | "name"
    | "url"
    | "inputSelector"
    | "fallbackSelectors"
    | "inputType"
    | "submitMethod"
    | "submitSelector"
    | "selectorCheckMode"
    | "hostnameAliases"
    | "supportedRoutes"
    | "verifiedAt"
    | "verifiedAuthState",
    string[]
  >>;
}

function pushFieldError(
  fieldErrors: SiteDraftValidationResult["fieldErrors"],
  field: keyof SiteDraftValidationResult["fieldErrors"],
  message: string
) {
  if (!message) {
    return;
  }

  const current = fieldErrors[field] ?? [];
  current.push(message);
  fieldErrors[field] = current;
}

interface SiteDraftLike {
  name?: unknown;
  url?: unknown;
  inputSelector?: unknown;
  fallbackSelectors?: unknown;
  inputType?: unknown;
  submitMethod?: unknown;
  submitSelector?: unknown;
  selectorCheckMode?: unknown;
  hostnameAliases?: unknown;
  supportedRoutes?: unknown;
  verifiedAt?: unknown;
  verifiedAuthState?: unknown;
}

function hasBalancedSelectorSyntax(selector: string): boolean {
  let bracketDepth = 0;
  let parenDepth = 0;
  let quote: "'" | "\"" | null = null;
  let escaping = false;

  for (const character of selector) {
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

    if (character === "'" || character === "\"") {
      quote = character;
      continue;
    }

    if (character === "[") {
      bracketDepth += 1;
    } else if (character === "]") {
      bracketDepth -= 1;
    } else if (character === "(") {
      parenDepth += 1;
    } else if (character === ")") {
      parenDepth -= 1;
    }

    if (bracketDepth < 0 || parenDepth < 0) {
      return false;
    }
  }

  return bracketDepth === 0 && parenDepth === 0 && quote === null && !escaping;
}

function isCssSelectorSyntaxValid(selector: string): boolean {
  const normalized = selector.trim();
  if (!normalized || !hasBalancedSelectorSyntax(normalized)) {
    return false;
  }

  const documentRef = globalThis.document;
  if (!documentRef?.createDocumentFragment) {
    return true;
  }

  try {
    documentRef.createDocumentFragment().querySelector(normalized);
    return true;
  } catch (_error) {
    return false;
  }
}

function validateSelectorSyntax(
  fieldErrors: SiteDraftValidationResult["fieldErrors"],
  field: keyof SiteDraftValidationResult["fieldErrors"],
  selectors: unknown,
): void {
  const invalidSelectors = normalizeSelectorEntries(selectors)
    .filter((selector) => !isCssSelectorSyntaxValid(selector));

  if (invalidSelectors.length === 0) {
    return;
  }

  pushFieldError(
    fieldErrors,
    field,
    `Invalid CSS selector: ${invalidSelectors[0]}`
  );
}

export function validateSiteDraft(
  draft: SiteDraftLike | null | undefined,
  { isBuiltIn = false } = {}
): SiteDraftValidationResult {
  const errors: string[] = [];
  const fieldErrors: SiteDraftValidationResult["fieldErrors"] = {};
  const name = safeText(draft?.name);
  const url = safeText(draft?.url);
  const inputSelector = safeText(draft?.inputSelector);

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
  } else {
    validateSelectorSyntax(fieldErrors, "inputSelector", draft?.inputSelector);
  }

  if (!VALID_INPUT_TYPES.has(safeText(draft?.inputType) as never)) {
    pushFieldError(fieldErrors, "inputType", "Input type is invalid.");
  }

  if (!VALID_SUBMIT_METHODS.has(safeText(draft?.submitMethod) as never)) {
    pushFieldError(fieldErrors, "submitMethod", "Submit method is invalid.");
  }

  const selectorCheckMode = safeText(draft?.selectorCheckMode);
  if (selectorCheckMode && !VALID_SELECTOR_CHECK_MODES.has(selectorCheckMode as never)) {
    pushFieldError(fieldErrors, "selectorCheckMode", "Selector check mode is invalid.");
  }

  const verifiedAt = safeText(draft?.verifiedAt);
  if (verifiedAt && normalizeVerifiedAt(verifiedAt) !== verifiedAt) {
    pushFieldError(fieldErrors, "verifiedAt", "Verified date must use YYYY-MM-DD.");
  }

  const verifiedAuthState = safeText(draft?.verifiedAuthState);
  if (verifiedAuthState && !VALID_VERIFIED_AUTH_STATES.has(verifiedAuthState as never)) {
    pushFieldError(fieldErrors, "verifiedAuthState", "Verified auth state is invalid.");
  }

  if (safeText(draft?.submitMethod) === "click" && !safeText(draft?.submitSelector)) {
    pushFieldError(fieldErrors, "submitSelector", "Submit selector is required when using click submit.");
  } else if (safeText(draft?.submitSelector)) {
    validateSelectorSyntax(fieldErrors, "submitSelector", draft?.submitSelector);
  }

  validateSelectorSyntax(fieldErrors, "fallbackSelectors", draft?.fallbackSelectors);

  const aliasValidation = validateHostnameAliases(draft?.hostnameAliases);
  aliasValidation.errors.forEach((message) => pushFieldError(fieldErrors, "hostnameAliases", message));

  const rawSupportedRoutes = Array.isArray(draft?.supportedRoutes)
    ? draft.supportedRoutes
    : typeof draft?.supportedRoutes === "string"
      ? draft.supportedRoutes.split(/\r?\n/g)
      : [];
  const invalidSupportedRoutes = rawSupportedRoutes
    .map((entry) => safeText(entry).trim())
    .filter(Boolean)
    .filter((route) => !route.startsWith("/") || route.includes("?") || route.includes("#"));

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
    fieldErrors,
  };
}
