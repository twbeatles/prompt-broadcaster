import { DEFAULT_SETTINGS, LOCAL_STORAGE_KEYS } from "./constants";
import { normalizeSettings } from "./normalizers";
import { readLocal, writeLocal } from "./storage";
import type { AppSettings } from "../types/models";

export async function getAppSettings(): Promise<AppSettings> {
  const rawSettings = await readLocal(LOCAL_STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  return normalizeSettings(rawSettings);
}

export async function setAppSettings(settings: unknown): Promise<AppSettings> {
  const normalized = normalizeSettings(settings);
  await writeLocal(LOCAL_STORAGE_KEYS.settings, normalized);
  return normalized;
}

export async function updateAppSettings(
  partialSettings: Partial<AppSettings> | null | undefined
): Promise<AppSettings> {
  const current = await getAppSettings();
  return setAppSettings({
    ...current,
    ...(partialSettings ?? {}),
  });
}

export async function getHistoryLimit(): Promise<number> {
  const settings = await getAppSettings();
  return settings.historyLimit;
}
