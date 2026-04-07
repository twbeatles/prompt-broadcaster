import {
  cleanupUnusedCustomSitePermissions,
  repairImportedBuiltInOverrides,
  repairImportedBuiltInStates,
  repairImportedCustomSites,
  getBuiltInSiteOverrides,
  getBuiltInSiteStates,
  getCustomSites,
  setBuiltInSiteOverrides,
  setBuiltInSiteStates,
  setCustomSites,
} from "../sites";
import { DEFAULT_SETTINGS } from "./constants";
import {
  buildFavoriteEntry,
  getPromptFavorites,
  setPromptFavorites,
} from "./favorites-store";
import {
  buildHistoryEntry,
  getPromptHistory,
  getStoredPromptHistory,
  setPromptHistory,
} from "./history-store";
import {
  ensureUniqueNumericId,
  ensureUniqueStringId,
  normalizeBroadcastCounter,
  normalizeSettings,
  normalizeTemplateDefaults,
  safeArray,
  safeObject,
  sortByDateDesc,
} from "./normalizers";
import {
  getBroadcastCounter,
  setBroadcastCounter,
} from "./broadcast-counter";
import { getAppSettings, setAppSettings } from "./settings-store";
import {
  getTemplateVariableCache,
  setTemplateVariableCache,
} from "./template-cache-store";
import { safeText } from "../sites";
import type {
  FavoritePrompt,
  ImportRejectedSite,
  PromptHistoryItem,
} from "../types/models";

const CURRENT_EXPORT_VERSION = 6;
type AcceptedCustomSite = Record<string, unknown> & {
  id: string;
  name: string;
  permissionPatterns?: unknown;
};

function asImportPayload(value: unknown): Record<string, unknown> {
  return safeObject(value);
}

async function containsOriginPermission(originPattern: string): Promise<boolean> {
  try {
    if (!chrome.permissions?.contains || !originPattern) {
      return false;
    }

    return await chrome.permissions.contains({
      origins: [originPattern],
    });
  } catch (_error) {
    return false;
  }
}

async function findMissingOriginPermissions(originPatterns: string[] = []): Promise<string[]> {
  const missingOrigins: string[] = [];

  for (const originPattern of Array.isArray(originPatterns) ? originPatterns : []) {
    if (!originPattern) {
      continue;
    }

    if (!(await containsOriginPermission(originPattern))) {
      missingOrigins.push(originPattern);
    }
  }

  return missingOrigins;
}

async function repairImportedCustomSitesWithPermissions(rawSites: unknown) {
  const repaired = repairImportedCustomSites(rawSites);
  const requestedOrigins = new Set<string>();
  const deniedOrigins = new Set<string>();
  const blockedOrigins = new Set<string>();

  const acceptedSites: AcceptedCustomSite[] = [];
  const permissionDeniedSites: ImportRejectedSite[] = [];

  for (const site of repaired.repairedSites) {
    const permissionPatterns = Array.isArray(site?.permissionPatterns)
      ? site.permissionPatterns.filter((pattern) => typeof pattern === "string" && pattern.trim())
      : [];

    permissionPatterns.forEach((origin) => requestedOrigins.add(origin));

    const blockedForSite = permissionPatterns.filter((origin) => blockedOrigins.has(origin));
    if (blockedForSite.length > 0) {
      blockedForSite.forEach((origin) => deniedOrigins.add(origin));
      permissionDeniedSites.push({
        id: safeText(site.id) || undefined,
        name: safeText(site.name) || "Custom AI",
        reason: "permission_denied",
        origins: blockedForSite,
      });
      continue;
    }

    const missingOrigins = await findMissingOriginPermissions(permissionPatterns);
    if (missingOrigins.length === 0) {
      acceptedSites.push(site as AcceptedCustomSite);
      continue;
    }

    try {
      const granted = chrome.permissions?.request
      ? await chrome.permissions.request({ origins: missingOrigins })
        : false;

      if (granted) {
        acceptedSites.push(site as AcceptedCustomSite);
        continue;
      }
    } catch (_error) {
      // Fall through to rejection.
    }

    missingOrigins.forEach((origin) => {
      blockedOrigins.add(origin);
      deniedOrigins.add(origin);
    });
    permissionDeniedSites.push({
      id: safeText(site.id) || undefined,
      name: safeText(site.name) || "Custom AI",
      reason: "permission_denied",
      origins: missingOrigins,
    });
  }

  return {
    acceptedSites,
    rejectedSites: [...repaired.rejectedSites, ...permissionDeniedSites],
    rewrittenIds: repaired.rewrittenIds,
    deniedOrigins: [...deniedOrigins],
    requestedOrigins: [...requestedOrigins],
  };
}

function normalizeImportVersion(value: unknown) {
  const version = Number(value);
  if (!Number.isFinite(version) || version <= 0) {
    return 1;
  }

  return Math.max(1, Math.floor(version));
}

function migrateV1ToV2(payload: Record<string, unknown>) {
  return {
    ...payload,
    version: 2,
    broadcastCounter: payload.broadcastCounter ?? 0,
  };
}

function migrateV2ToV3(payload: Record<string, unknown>) {
  return {
    ...payload,
    version: 3,
    builtInSiteStates: payload.builtInSiteStates ?? {},
    builtInSiteOverrides: payload.builtInSiteOverrides ?? {},
  };
}

function migrateV3ToV4(payload: Record<string, unknown>) {
  return {
    ...payload,
    version: 4,
    settings: normalizeSettings(payload.settings ?? DEFAULT_SETTINGS),
    history: safeArray(payload.history).map((entry) => buildHistoryEntry(entry)),
    favorites: safeArray(payload.favorites).map((entry) => buildFavoriteEntry(entry)),
  };
}

function migrateV4ToV5(payload: Record<string, unknown>) {
  return {
    ...payload,
    version: 5,
    history: safeArray(payload.history).map((entry) => buildHistoryEntry(entry)),
    favorites: safeArray(payload.favorites).map((entry) => buildFavoriteEntry(entry)),
  };
}

function migrateV5ToV6(payload: Record<string, unknown>) {
  return {
    ...payload,
    version: 6,
    history: safeArray(payload.history).map((entry) => buildHistoryEntry(entry)),
    favorites: safeArray(payload.favorites).map((entry) => buildFavoriteEntry(entry)),
  };
}

function migrateImportData(rawValue: unknown) {
  let payload = asImportPayload(rawValue);
  const sourceVersion = normalizeImportVersion(payload.version);
  let workingVersion = sourceVersion;

  if (workingVersion < 2) {
    payload = migrateV1ToV2(payload);
    workingVersion = 2;
  }

  if (workingVersion < 3) {
    payload = migrateV2ToV3(payload);
    workingVersion = 3;
  }

  if (workingVersion < 4) {
    payload = migrateV3ToV4(payload);
    workingVersion = 4;
  }

  if (workingVersion < 5) {
    payload = migrateV4ToV5(payload);
    workingVersion = 5;
  }

  if (workingVersion < 6) {
    payload = migrateV5ToV6(payload);
    workingVersion = 6;
  }

  return {
    migrated: payload,
    sourceVersion,
    targetVersion: CURRENT_EXPORT_VERSION,
  };
}

export async function exportPromptData() {
  const [
    broadcastCounter,
    history,
    favorites,
    templateVariableCache,
    settings,
    customSites,
    builtInSiteStates,
    builtInSiteOverrides,
  ] = await Promise.all([
    getBroadcastCounter(),
    getStoredPromptHistory(),
    getPromptFavorites(),
    getTemplateVariableCache(),
    getAppSettings(),
    getCustomSites(),
    getBuiltInSiteStates(),
    getBuiltInSiteOverrides(),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    version: CURRENT_EXPORT_VERSION,
    broadcastCounter,
    history,
    favorites,
    templateVariableCache,
    settings,
    customSites,
    builtInSiteStates,
    builtInSiteOverrides,
  };
}

export async function importPromptData(jsonString: string) {
  const parsed = JSON.parse(jsonString) as unknown;
  const { migrated, sourceVersion, targetVersion } = migrateImportData(parsed);
  const previousCustomSites = await getCustomSites();
  const history = safeArray(migrated?.history).map((item) => buildHistoryEntry(item));
  const favorites = safeArray(migrated?.favorites).map((item) =>
    buildFavoriteEntry(item)
  );
  const importedBroadcastCounter = normalizeBroadcastCounter(migrated?.broadcastCounter);
  const templateVariableCache = normalizeTemplateDefaults(migrated?.templateVariableCache);
  const importedSettings = normalizeSettings(migrated?.settings ?? DEFAULT_SETTINGS);
  const importedCustomSites = safeArray(migrated?.customSites);
  const importedBuiltInSiteStates = safeObject(migrated?.builtInSiteStates);
  const importedBuiltInSiteOverrides = safeObject(migrated?.builtInSiteOverrides);
  const normalizedHistory: PromptHistoryItem[] = [];
  for (const item of sortByDateDesc(history)) {
    normalizedHistory.push({
      ...item,
      id: ensureUniqueNumericId(normalizedHistory, Number(item.id)),
    });
  }

  const normalizedFavorites: FavoritePrompt[] = [];
  for (const item of sortByDateDesc(favorites, "favoritedAt")) {
    normalizedFavorites.push({
      ...item,
      id: ensureUniqueStringId(normalizedFavorites, String(item.id)),
    });
  }

  const customSiteImport = await repairImportedCustomSitesWithPermissions(importedCustomSites);
  const builtInStateImport = repairImportedBuiltInStates(importedBuiltInSiteStates);
  const builtInOverrideImport = repairImportedBuiltInOverrides(importedBuiltInSiteOverrides);

  await setAppSettings(importedSettings);
  await Promise.all([
    setBroadcastCounter(importedBroadcastCounter),
    setPromptFavorites(normalizedFavorites),
    setTemplateVariableCache(templateVariableCache),
    setCustomSites(customSiteImport.acceptedSites),
    setBuiltInSiteStates(builtInStateImport.normalized),
    setBuiltInSiteOverrides(builtInOverrideImport.normalized),
  ]);
  await cleanupUnusedCustomSitePermissions(previousCustomSites, customSiteImport.acceptedSites);
  await setPromptHistory(normalizedHistory);

  return {
    broadcastCounter: importedBroadcastCounter,
    history: normalizedHistory,
    favorites: normalizedFavorites,
    templateVariableCache,
    settings: importedSettings,
    customSites: customSiteImport.acceptedSites,
    builtInSiteStates: builtInStateImport.normalized,
    builtInSiteOverrides: builtInOverrideImport.normalized,
    importSummary: {
      version: targetVersion,
      migratedFromVersion: sourceVersion,
      customSites: {
        importedCount: importedCustomSites.length,
        acceptedIds: customSiteImport.acceptedSites.map((site) => site.id),
        acceptedNames: customSiteImport.acceptedSites.map((site) => site.name),
        rejected: customSiteImport.rejectedSites,
        rewrittenIds: customSiteImport.rewrittenIds,
        deniedOrigins: customSiteImport.deniedOrigins,
      },
      builtInSiteStates: {
        appliedIds: builtInStateImport.appliedIds,
        droppedIds: builtInStateImport.droppedIds,
      },
      builtInSiteOverrides: {
        appliedIds: builtInOverrideImport.appliedIds,
        droppedIds: builtInOverrideImport.droppedIds,
        adjustedIds: builtInOverrideImport.adjustedIds,
      },
    },
  };
}
