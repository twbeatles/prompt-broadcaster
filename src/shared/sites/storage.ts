import {
  repairImportedBuiltInOverrides,
  repairImportedBuiltInStates,
} from "./import-repair";
import { SITE_STORAGE_KEYS } from "./constants";
import { normalizeCustomSite } from "./normalizers";
import type { RuntimeSite } from "../types/models";

async function readLocal<T>(key: string, fallbackValue: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  return (result[key] ?? fallbackValue) as T;
}

async function writeLocal<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function getCustomSites(): Promise<RuntimeSite[]> {
  const rawSites = await readLocal(SITE_STORAGE_KEYS.customSites, []);
  return Array.isArray(rawSites)
    ? rawSites.map((site) => normalizeCustomSite(site) as RuntimeSite)
    : [];
}

export async function setCustomSites(sites: unknown[]): Promise<RuntimeSite[]> {
  const normalized = Array.isArray(sites)
    ? sites.map((site) => normalizeCustomSite(site) as RuntimeSite)
    : [];
  await writeLocal(SITE_STORAGE_KEYS.customSites, normalized);
  return normalized;
}

export async function getBuiltInSiteStates(): Promise<Record<string, Record<string, unknown>>> {
  const rawStates = await readLocal(SITE_STORAGE_KEYS.builtInSiteStates, {});
  return repairImportedBuiltInStates(rawStates).normalized;
}

export async function setBuiltInSiteStates(
  states: unknown
): Promise<Record<string, Record<string, unknown>>> {
  const normalized = repairImportedBuiltInStates(states).normalized;
  await writeLocal(SITE_STORAGE_KEYS.builtInSiteStates, normalized);
  return normalized;
}

export async function getBuiltInSiteOverrides(): Promise<Record<string, Record<string, unknown>>> {
  const rawOverrides = await readLocal(SITE_STORAGE_KEYS.builtInSiteOverrides, {});
  return repairImportedBuiltInOverrides(rawOverrides).normalized;
}

export async function setBuiltInSiteOverrides(
  overrides: unknown
): Promise<Record<string, Record<string, unknown>>> {
  const normalized = repairImportedBuiltInOverrides(overrides).normalized;
  await writeLocal(SITE_STORAGE_KEYS.builtInSiteOverrides, normalized);
  return normalized;
}

export async function resetStoredSiteSettings(): Promise<void> {
  await Promise.all([
    writeLocal(SITE_STORAGE_KEYS.customSites, []),
    writeLocal(SITE_STORAGE_KEYS.builtInSiteStates, {}),
    writeLocal(SITE_STORAGE_KEYS.builtInSiteOverrides, {}),
  ]);
}
