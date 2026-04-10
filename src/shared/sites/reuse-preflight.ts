import type {
  ReusableTabPreflightResult,
  ReusableTabSurfaceSnapshot,
} from "../types/models";
import {
  hasKnownAuthPath,
  hasKnownSettingsPath,
  shouldRequireVisibleSubmitSurface,
} from "./selector-utils";

export function evaluateReusableTabSnapshot(
  snapshot: ReusableTabSurfaceSnapshot | null | undefined
): ReusableTabPreflightResult {
  if (hasKnownAuthPath(snapshot?.pathname)) {
    return { ok: false, reason: "auth_path" };
  }

  if (hasKnownSettingsPath(snapshot?.pathname)) {
    return { ok: false, reason: "settings_path" };
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
