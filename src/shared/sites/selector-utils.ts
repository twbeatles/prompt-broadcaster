import type {
  SelectorCheckMode,
  SubmitMethod,
  SubmitSurfaceRequirement,
} from "../types/models";

export const AUTH_PATH_SEGMENTS = Object.freeze([
  "/login",
  "/logout",
  "/sign-in",
  "/signin",
  "/auth",
]);

export const SETTINGS_PATH_SEGMENTS = Object.freeze([
  "/settings",
  "/preferences",
  "/account",
  "/billing",
]);

export function normalizePathname(pathname: unknown): string {
  return typeof pathname === "string" ? pathname.trim().toLowerCase() : "";
}

export function hasPathSegment(pathname: unknown, segments: readonly string[]): boolean {
  const normalizedPathname = normalizePathname(pathname);
  return segments.some((segment) => normalizedPathname.includes(segment));
}

export function hasKnownAuthPath(pathname: unknown): boolean {
  return hasPathSegment(pathname, AUTH_PATH_SEGMENTS);
}

export function hasKnownSettingsPath(pathname: unknown): boolean {
  return hasPathSegment(pathname, SETTINGS_PATH_SEGMENTS);
}

export function normalizeRoutePrefix(value: unknown): string {
  const normalized = normalizePathname(value);
  if (!normalized) {
    return "";
  }

  const basePath = normalized.split("#")[0]?.split("?")[0] ?? "";
  if (!basePath.startsWith("/")) {
    return "";
  }

  const trimmed = basePath.replace(/\/+$/g, "");
  return trimmed || "/";
}

export function normalizeSupportedRoutes(value: unknown): string[] {
  const rawEntries = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/g)
      : [];

  return Array.from(
    new Set(
      rawEntries
        .map((entry) => normalizeRoutePrefix(entry))
        .filter(Boolean)
    )
  );
}

export function getConfiguredSupportedRoutes(site: {
  supportedRoutes?: unknown;
  verifiedRoute?: unknown;
} | null | undefined): string[] {
  const explicitRoutes = normalizeSupportedRoutes(site?.supportedRoutes);
  if (explicitRoutes.length > 0) {
    return explicitRoutes;
  }

  const fallbackRoute = normalizeRoutePrefix(site?.verifiedRoute);
  return fallbackRoute && fallbackRoute !== "/" ? [fallbackRoute] : [];
}

function routePrefixMatches(pathname: string, prefix: string): boolean {
  if (prefix === "/") {
    return true;
  }

  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPathnameSupported(
  pathname: unknown,
  supportedRoutes: unknown,
): boolean {
  const routes = normalizeSupportedRoutes(supportedRoutes);
  if (routes.length === 0) {
    return true;
  }

  const normalizedPathname = normalizeRoutePrefix(pathname) || "/";
  return routes.some((prefix) => routePrefixMatches(normalizedPathname, prefix));
}

export function isSitePathSupported(
  site: {
    supportedRoutes?: unknown;
    verifiedRoute?: unknown;
  } | null | undefined,
  pathname: unknown,
): boolean {
  return isPathnameSupported(pathname, getConfiguredSupportedRoutes(site));
}

export function getSitePathBlockReason(
  site: {
    supportedRoutes?: unknown;
    verifiedRoute?: unknown;
  } | null | undefined,
  pathname: unknown,
): "" | "auth_path" | "settings_path" | "unsupported_route" {
  if (hasKnownAuthPath(pathname)) {
    return "auth_path";
  }

  if (hasKnownSettingsPath(pathname)) {
    return "settings_path";
  }

  if (!isSitePathSupported(site, pathname)) {
    return "unsupported_route";
  }

  return "";
}

export function splitSelectorList(selectorGroup: unknown): string[] {
  const source = typeof selectorGroup === "string" ? selectorGroup.trim() : "";
  if (!source) {
    return [];
  }

  const parts: string[] = [];
  let current = "";
  let bracketDepth = 0;
  let parenDepth = 0;
  let quote: "'" | "\"" | null = null;
  let escaping = false;

  for (const character of source) {
    current += character;

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
      continue;
    }

    if (character === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }

    if (character === "(") {
      parenDepth += 1;
      continue;
    }

    if (character === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }

    if (character === "," && bracketDepth === 0 && parenDepth === 0) {
      current = current.slice(0, -1);
      const normalized = current.trim();
      if (normalized) {
        parts.push(normalized);
      }
      current = "";
    }
  }

  const trailing = current.trim();
  if (trailing) {
    parts.push(trailing);
  }

  return parts;
}

export function normalizeSelectorEntries(selectors: unknown): string[] {
  const rawSelectors = Array.isArray(selectors) ? selectors : [selectors];
  return rawSelectors
    .filter((selector): selector is string => typeof selector === "string" && Boolean(selector.trim()))
    .flatMap((selector) => splitSelectorList(selector))
    .filter((selector, index, entries) => entries.indexOf(selector) === index);
}

export function buildSubmitRequirement(options: {
  selectorCheckMode?: SelectorCheckMode | null;
  submitMethod?: SubmitMethod | null;
  submitSelector?: string | null;
}): SubmitSurfaceRequirement {
  if (options?.submitMethod !== "click") {
    return "none";
  }

  if (typeof options?.submitSelector !== "string" || !options.submitSelector.trim()) {
    return "none";
  }

  if (options?.selectorCheckMode === "input-and-conditional-submit") {
    return "conditional";
  }

  if (options?.selectorCheckMode === "input-only") {
    return "none";
  }

  return "required";
}

export function shouldRequireVisibleSubmitSurface(
  submitRequirement: SubmitSurfaceRequirement | null | undefined,
): boolean {
  return submitRequirement === "required";
}

export function shouldProbeSubmitAfterInput(
  submitRequirement: SubmitSurfaceRequirement | null | undefined,
): boolean {
  return submitRequirement === "required" || submitRequirement === "conditional";
}
