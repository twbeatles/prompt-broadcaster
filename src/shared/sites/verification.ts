import { VALID_VERIFIED_AUTH_STATES } from "./constants";
import type { VerifiedAuthState } from "../types/models";

const ISO_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasOwnKey(value: unknown, key: string): boolean {
  return Boolean(value) && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, key);
}

function resolveTextField(primary: Record<string, unknown>, fallback: Record<string, unknown>, key: string): string {
  if (hasOwnKey(primary, key)) {
    return normalizeText(primary[key]);
  }

  return normalizeText(fallback[key]);
}

export function normalizeLegacyLastVerified(value: unknown): string {
  const normalized = normalizeText(value);
  return ISO_MONTH_PATTERN.test(normalized) ? normalized : "";
}

export function normalizeVerifiedAt(value: unknown): string {
  const normalized = normalizeText(value);
  return ISO_DATE_PATTERN.test(normalized) ? normalized : "";
}

export function normalizeVerifiedAuthState(value: unknown): VerifiedAuthState | "" {
  const normalized = normalizeText(value);
  return VALID_VERIFIED_AUTH_STATES.has(normalized as never)
    ? (normalized as VerifiedAuthState)
    : "";
}

export function deriveLegacyLastVerified(verifiedAt: string): string {
  return normalizeVerifiedAt(verifiedAt).slice(0, 7);
}

export function buildVerificationMetadata(
  primaryValue: unknown,
  fallbackValue: unknown = {},
): {
  lastVerified: string;
  verifiedAt: string;
  verifiedRoute: string;
  verifiedAuthState: VerifiedAuthState | "";
  verifiedLocale: string;
  verifiedVersion: string;
} {
  const primary =
    primaryValue && typeof primaryValue === "object" && !Array.isArray(primaryValue)
      ? (primaryValue as Record<string, unknown>)
      : {};
  const fallback =
    fallbackValue && typeof fallbackValue === "object" && !Array.isArray(fallbackValue)
      ? (fallbackValue as Record<string, unknown>)
      : {};
  const primaryHasVerifiedAt = hasOwnKey(primary, "verifiedAt");
  const primaryVerifiedAt = normalizeVerifiedAt(primary.verifiedAt);
  const fallbackVerifiedAt = normalizeVerifiedAt(fallback.verifiedAt);
  const verifiedAt = primaryHasVerifiedAt
    ? primaryVerifiedAt
    : primaryVerifiedAt || fallbackVerifiedAt;
  const lastVerified = verifiedAt
    ? deriveLegacyLastVerified(verifiedAt)
    : primaryHasVerifiedAt
      ? ""
      : normalizeLegacyLastVerified(primary.lastVerified) ||
        normalizeLegacyLastVerified(fallback.lastVerified);

  return {
    lastVerified,
    verifiedAt,
    verifiedRoute: resolveTextField(primary, fallback, "verifiedRoute"),
    verifiedAuthState: hasOwnKey(primary, "verifiedAuthState")
      ? normalizeVerifiedAuthState(primary.verifiedAuthState)
      : normalizeVerifiedAuthState(primary.verifiedAuthState) ||
        normalizeVerifiedAuthState(fallback.verifiedAuthState),
    verifiedLocale: resolveTextField(primary, fallback, "verifiedLocale"),
    verifiedVersion: resolveTextField(primary, fallback, "verifiedVersion"),
  };
}
