import type {
  InjectionResultCode,
  SiteInjectionResult,
} from "../../types/models";
import { safeText } from "./primitives";

const VALID_RESULT_CODES = new Set<InjectionResultCode>([
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
  "unexpected_error",
]);

export function normalizeStatus(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "submitted";
}

export function normalizeStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entryValue]) => [safeText(key).trim(), safeText(entryValue).trim()])
      .filter(([key, entryValue]) => key && entryValue)
  );
}

export function normalizeResultCode(value: unknown): InjectionResultCode {
  const normalized = safeText(value).trim();
  if (VALID_RESULT_CODES.has(normalized as InjectionResultCode)) {
    return normalized as InjectionResultCode;
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

export function buildSiteInjectionResult(
  code: unknown,
  overrides: Partial<SiteInjectionResult> = {}
): SiteInjectionResult {
  const normalizedCode = normalizeResultCode(code);
  const result: SiteInjectionResult = {
    code: normalizedCode,
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
    result.attempts = overrides.attempts
      .map((attempt) => ({
        name: safeText(attempt?.name).trim(),
        success: Boolean(attempt?.success),
      }))
      .filter((attempt) => attempt.name);
  }

  return result;
}

export function normalizeSiteInjectionResult(value: unknown): SiteInjectionResult {
  if (typeof value === "string") {
    return buildSiteInjectionResult(value);
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return buildSiteInjectionResult("unexpected_error");
  }

  const source = value as Record<string, unknown>;
  return buildSiteInjectionResult(source.code ?? source.status, {
    message: safeText(source.message).trim(),
    strategy: safeText(source.strategy).trim(),
    elapsedMs: Number.isFinite(Number(source.elapsedMs)) ? Number(source.elapsedMs) : undefined,
    attempts: Array.isArray(source.attempts) ? source.attempts : undefined,
  });
}

export function normalizeSiteResultsRecord(value: unknown): Record<string, SiteInjectionResult> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([siteId, result]) => [safeText(siteId).trim(), normalizeSiteInjectionResult(result)] as const)
      .filter(([siteId]) => Boolean(siteId))
  );
}
