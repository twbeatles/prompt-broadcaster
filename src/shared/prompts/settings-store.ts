// @ts-nocheck
import { DEFAULT_SETTINGS, LOCAL_STORAGE_KEYS } from "./constants";
import { normalizeSettings } from "./normalizers";
import { readLocal, writeLocal } from "./storage";

export async function getAppSettings() {
  const rawSettings = await readLocal(LOCAL_STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  return normalizeSettings(rawSettings);
}

export async function setAppSettings(settings) {
  const normalized = normalizeSettings(settings);
  await writeLocal(LOCAL_STORAGE_KEYS.settings, normalized);
  return normalized;
}

export async function updateAppSettings(partialSettings) {
  const current = await getAppSettings();
  return setAppSettings({
    ...current,
    ...(partialSettings ?? {}),
  });
}

export async function getHistoryLimit() {
  const settings = await getAppSettings();
  return settings.historyLimit;
}
