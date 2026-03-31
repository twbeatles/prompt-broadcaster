// @ts-nocheck
import { isValidURL } from "../security";
import {
  VALID_INPUT_TYPES,
  VALID_SELECTOR_CHECK_MODES,
  VALID_SUBMIT_METHODS,
} from "./constants";
import { safeText } from "./normalizers";

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

  const selectorCheckMode = safeText(draft?.selectorCheckMode);
  if (selectorCheckMode && !VALID_SELECTOR_CHECK_MODES.has(selectorCheckMode)) {
    errors.push("Selector check mode is invalid.");
  }

  if (safeText(draft?.submitMethod) === "click" && !safeText(draft?.submitSelector)) {
    errors.push("Submit selector is required when using click submit.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
