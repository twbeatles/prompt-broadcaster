// @ts-nocheck
import {
  repairImportedBuiltInOverrides,
  repairImportedBuiltInStates,
} from "./import-repair";
import { SITE_STORAGE_KEYS } from "./constants";
import { normalizeCustomSite } from "./normalizers";

async function readLocal(key, fallbackValue) {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? fallbackValue;
}

async function writeLocal(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

export async function getCustomSites() {
  const rawSites = await readLocal(SITE_STORAGE_KEYS.customSites, []);
  return Array.isArray(rawSites) ? rawSites.map((site) => normalizeCustomSite(site)) : [];
}

export async function setCustomSites(sites) {
  const normalized = Array.isArray(sites) ? sites.map((site) => normalizeCustomSite(site)) : [];
  await writeLocal(SITE_STORAGE_KEYS.customSites, normalized);
  return normalized;
}

export async function getBuiltInSiteStates() {
  const rawStates = await readLocal(SITE_STORAGE_KEYS.builtInSiteStates, {});
  return repairImportedBuiltInStates(rawStates).normalized;
}

export async function setBuiltInSiteStates(states) {
  const normalized = repairImportedBuiltInStates(states).normalized;
  await writeLocal(SITE_STORAGE_KEYS.builtInSiteStates, normalized);
  return normalized;
}

export async function getBuiltInSiteOverrides() {
  const rawOverrides = await readLocal(SITE_STORAGE_KEYS.builtInSiteOverrides, {});
  return repairImportedBuiltInOverrides(rawOverrides).normalized;
}

export async function setBuiltInSiteOverrides(overrides) {
  const normalized = repairImportedBuiltInOverrides(overrides).normalized;
  await writeLocal(SITE_STORAGE_KEYS.builtInSiteOverrides, normalized);
  return normalized;
}

export async function resetStoredSiteSettings() {
  await Promise.all([
    writeLocal(SITE_STORAGE_KEYS.customSites, []),
    writeLocal(SITE_STORAGE_KEYS.builtInSiteStates, {}),
    writeLocal(SITE_STORAGE_KEYS.builtInSiteOverrides, {}),
  ]);
}
