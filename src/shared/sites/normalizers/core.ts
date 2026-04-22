import {
  VALID_INPUT_TYPES,
  VALID_SELECTOR_CHECK_MODES,
  VALID_SUBMIT_METHODS,
} from "../constants";
import type {
  InputType,
  SelectorCheckMode,
  SubmitMethod,
} from "../../types/models";
import type { PlainRecord } from "./types";

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
    return value.map((entry) => safeText(entry)).filter(Boolean);
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
            (entry) =>
              entry && entry !== primaryHost && entry !== primaryHostname,
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
