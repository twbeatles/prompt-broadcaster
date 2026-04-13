import type {
  ReusableTabPreflightResult,
  ReusableTabSurfaceSnapshot,
} from "../types/models";
import {
  getSitePathBlockReason,
  shouldRequireVisibleSubmitSurface,
} from "./selector-utils";

export function evaluateReusableTabSnapshot(
  snapshot: ReusableTabSurfaceSnapshot | null | undefined
): ReusableTabPreflightResult {
  const pathBlockReason = getSitePathBlockReason(
    { supportedRoutes: snapshot?.supportedRoutes },
    snapshot?.pathname
  );

  if (pathBlockReason === "auth_path") {
    return { ok: false, reason: "auth_path" };
  }

  if (pathBlockReason === "settings_path") {
    return { ok: false, reason: "settings_path" };
  }

  if (pathBlockReason === "unsupported_route") {
    return { ok: false, reason: "unsupported_route" };
  }

  if (!snapshot?.hasPromptSurface) {
    return {
      ok: false,
      reason: snapshot?.hasAuthSurface ? "auth_selector" : "missing_input",
    };
  }

  if (
    shouldRequireVisibleSubmitSurface(snapshot?.submitRequirement) &&
    !snapshot?.hasSubmitSurface
  ) {
    return { ok: false, reason: "missing_submit" };
  }

  return { ok: true };
}
