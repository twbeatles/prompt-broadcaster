import {
  DEFAULT_SETTINGS,
  setAppSettings,
  setBroadcastCounter,
  setPromptFavorites,
  setPromptHistory,
  setTemplateVariableCache,
} from "../prompts";
import { resetSiteSettings } from "../sites";
import { setFailedSelectors } from "./failed-selectors";
import { setLastBroadcast as setLastBroadcastSummary } from "./last-broadcast";
import { setOnboardingCompleted as setOnboardingState } from "./onboarding";
import { setStrategyStats } from "./strategy-stats";
import { setPendingUiToasts as setUiToasts } from "./ui-toasts";

interface ResetPersistedExtensionStateOptions {
  additionalLocalKeys?: string[];
  additionalSessionKeys?: string[];
  clearAlarmName?: string | null;
}

function normalizeStorageKeys(keys: string[] | undefined, fallback: string[] = []) {
  return Array.from(
    new Set(
      [...fallback, ...(Array.isArray(keys) ? keys : [])]
        .filter((key) => typeof key === "string" && key.trim())
        .map((key) => key.trim())
    )
  );
}

export async function resetPersistedExtensionState(
  options: ResetPersistedExtensionStateOptions = {}
) {
  const localKeys = normalizeStorageKeys(options.additionalLocalKeys, ["lastPrompt"]);
  const sessionKeys = normalizeStorageKeys(options.additionalSessionKeys);
  const clearAlarmName =
    typeof options.clearAlarmName === "string" && options.clearAlarmName.trim()
      ? options.clearAlarmName.trim()
      : "";

  await Promise.all([
    setBroadcastCounter(0),
    setPromptHistory([]),
    setPromptFavorites([]),
    setTemplateVariableCache({}),
    setFailedSelectors([]),
    setUiToasts([]),
    setLastBroadcastSummary(null),
    setOnboardingState(false),
    setStrategyStats({}),
    setAppSettings(DEFAULT_SETTINGS),
    resetSiteSettings(),
    localKeys.length > 0 ? chrome.storage.local.remove(localKeys) : Promise.resolve(),
    sessionKeys.length > 0 ? chrome.storage.session.remove(sessionKeys) : Promise.resolve(),
    clearAlarmName ? Promise.resolve(chrome.alarms.clear(clearAlarmName)).catch(() => false) : Promise.resolve(),
  ]);

  return {
    ok: true,
    removedLocalKeys: localKeys,
    removedSessionKeys: sessionKeys,
  };
}
