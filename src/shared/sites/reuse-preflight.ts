import type {
  ReusableTabPreflightResult,
  ReusableTabSurfaceSnapshot,
} from "../types/models";

const AUTH_PATH_SEGMENTS = ["/login", "/logout", "/sign-in", "/signin", "/auth"];
const SETTINGS_PATH_SEGMENTS = ["/settings", "/preferences", "/account", "/billing"];

function normalizePathname(pathname: unknown) {
  return typeof pathname === "string" ? pathname.trim().toLowerCase() : "";
}

function hasPathSegment(pathname: string, segments: string[]) {
  return segments.some((segment) => pathname.includes(segment));
}

export function evaluateReusableTabSnapshot(
  snapshot: ReusableTabSurfaceSnapshot | null | undefined
): ReusableTabPreflightResult {
  const pathname = normalizePathname(snapshot?.pathname);
  if (hasPathSegment(pathname, AUTH_PATH_SEGMENTS)) {
    return { ok: false, reason: "auth_path" };
  }

  if (hasPathSegment(pathname, SETTINGS_PATH_SEGMENTS)) {
    return { ok: false, reason: "settings_path" };
  }

  if (!snapshot?.hasPromptSurface) {
    return {
      ok: false,
      reason: snapshot?.hasAuthSurface ? "auth_selector" : "missing_input",
    };
  }

  if (snapshot?.requiresSubmitSurface && !snapshot?.hasSubmitSurface) {
    return { ok: false, reason: "missing_submit" };
  }

  return { ok: true };
}
