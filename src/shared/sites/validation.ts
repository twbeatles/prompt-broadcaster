import { isValidURL } from "../security";
import {
  VALID_INPUT_TYPES,
  VALID_SELECTOR_CHECK_MODES,
  VALID_SUBMIT_METHODS,
} from "./constants";
import { validateHostnameAliases } from "./hostname-aliases";
import { safeText } from "./normalizers";

export interface SiteDraftValidationResult {
  valid: boolean;
  errors: string[];
  fieldErrors: Partial<Record<"name" | "url" | "inputSelector" | "inputType" | "submitMethod" | "submitSelector" | "selectorCheckMode" | "hostnameAliases", string[]>>;
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

export function validateSiteDraft(
  draft: Record<string, unknown> | null | undefined,
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

  if (safeText(draft?.submitMethod) === "click" && !safeText(draft?.submitSelector)) {
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
    fieldErrors,
  };
}
