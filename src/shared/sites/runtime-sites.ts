// @ts-nocheck
import { AI_SITES } from "../../config/sites";
import {
  buildBaseSiteRecord,
  buildOriginPatterns,
  normalizeBoolean,
  normalizeCustomSite,
  sanitizeBuiltInOverride,
} from "./normalizers";
import {
  getBuiltInSiteOverrides,
  getBuiltInSiteStates,
  getCustomSites,
  resetStoredSiteSettings,
  setBuiltInSiteOverrides,
  setBuiltInSiteStates,
  setCustomSites,
} from "./storage";

function getCustomSitePermissionPatterns(site) {
  return Array.isArray(site?.permissionPatterns)
    ? site.permissionPatterns.filter((pattern) => typeof pattern === "string" && pattern.trim())
    : [];
}

function collectCustomSitePermissionPatterns(sites = []) {
  return new Set(
    (Array.isArray(sites) ? sites : [])
      .flatMap((site) => getCustomSitePermissionPatterns(site))
      .filter(Boolean)
  );
}

export async function cleanupUnusedCustomSitePermissions(previousSites = [], nextSites = []) {
  const nextOrigins = collectCustomSitePermissionPatterns(nextSites);
  const removableOrigins = [...collectCustomSitePermissionPatterns(previousSites)].filter(
    (origin) => !nextOrigins.has(origin)
  );

  if (removableOrigins.length === 0 || !chrome.permissions?.remove) {
    return [];
  }

  try {
    const removed = await chrome.permissions.remove({ origins: removableOrigins });
    return removed ? removableOrigins : [];
  } catch (_error) {
    return [];
  }
}

export async function getRuntimeSites() {
  const [customSites, builtInStates, builtInOverrides] = await Promise.all([
    getCustomSites(),
    getBuiltInSiteStates(),
    getBuiltInSiteOverrides(),
  ]);

  const builtInSites = AI_SITES.map((site) => {
    const override = builtInOverrides[site.id] ?? {};
    const state = builtInStates[site.id] ?? {};
    return buildBaseSiteRecord(
      {
        ...site,
        ...override,
        enabled: normalizeBoolean(state.enabled, true),
      },
      { isBuiltIn: true }
    );
  });

  return [...builtInSites, ...customSites];
}

export async function getEnabledRuntimeSites() {
  const sites = await getRuntimeSites();
  return sites.filter((site) => site.enabled);
}

export async function findRuntimeSiteById(siteId) {
  const sites = await getRuntimeSites();
  return sites.find((site) => site.id === siteId) ?? null;
}

export async function saveCustomSite(siteDraft) {
  const customSites = await getCustomSites();
  const nextSite = normalizeCustomSite(siteDraft);
  const nextSites = [...customSites];
  const index = nextSites.findIndex((site) => site.id === nextSite.id);

  if (index >= 0) {
    nextSites[index] = nextSite;
  } else {
    nextSites.unshift(nextSite);
  }

  await setCustomSites(nextSites);
  await cleanupUnusedCustomSitePermissions(customSites, nextSites);
  return nextSite;
}

export async function saveBuiltInSiteOverride(siteId, overrideDraft) {
  const source = AI_SITES.find((site) => site.id === siteId);
  if (!source) {
    throw new Error("Built-in site not found.");
  }

  const overrides = await getBuiltInSiteOverrides();
  overrides[siteId] = sanitizeBuiltInOverride(overrideDraft, source);
  await setBuiltInSiteOverrides(overrides);
  return overrides[siteId];
}

export async function updateRuntimeSite(siteId, partialDraft = {}) {
  const runtimeSite = await findRuntimeSiteById(siteId);
  if (!runtimeSite) {
    throw new Error("Runtime site not found.");
  }

  const nextDraft = {
    ...runtimeSite,
    ...(partialDraft ?? {}),
  };

  if (runtimeSite.isBuiltIn) {
    await saveBuiltInSiteOverride(siteId, nextDraft);
    if (typeof partialDraft.enabled === "boolean") {
      await setRuntimeSiteEnabled(siteId, partialDraft.enabled);
    }
    return findRuntimeSiteById(siteId);
  }

  await saveCustomSite(nextDraft);
  return findRuntimeSiteById(siteId);
}

export async function setRuntimeSiteEnabled(siteId, enabled) {
  const builtInSite = AI_SITES.find((site) => site.id === siteId);
  if (builtInSite) {
    const states = await getBuiltInSiteStates();
    states[siteId] = { enabled: Boolean(enabled) };
    await setBuiltInSiteStates(states);
    return;
  }

  const customSites = await getCustomSites();
  const nextSites = customSites.map((site) =>
    site.id === siteId ? { ...site, enabled: Boolean(enabled) } : site
  );
  await setCustomSites(nextSites);
}

export async function deleteCustomSite(siteId) {
  const customSites = await getCustomSites();
  const nextSites = customSites.filter((site) => site.id !== siteId);
  await setCustomSites(nextSites);
  await cleanupUnusedCustomSitePermissions(customSites, nextSites);
  return nextSites;
}

export async function resetSiteSettings() {
  const customSites = await getCustomSites();
  await resetStoredSiteSettings();
  await cleanupUnusedCustomSitePermissions(customSites, []);
}

export function buildSitePermissionPatterns(url, hostnameAliases = []) {
  return buildOriginPatterns(url, hostnameAliases);
}
