// @ts-nocheck
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
import {
  DEFAULT_SETTINGS,
} from "./constants";
import {
  buildFavoriteEntry,
  getPromptFavorites,
  setPromptFavorites,
} from "./favorites-store";
import {
  buildHistoryEntry,
  getPromptHistory,
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

async function containsOriginPermission(originPattern) {
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

async function findMissingOriginPermissions(originPatterns = []) {
  const missingOrigins = [];

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

async function repairImportedCustomSitesWithPermissions(rawSites) {
  const repaired = repairImportedCustomSites(rawSites);
  const requestedOrigins = new Set();
  const deniedOrigins = new Set();
  const blockedOrigins = new Set();

  const acceptedSites = [];
  const permissionDeniedSites = [];

  for (const site of repaired.repairedSites) {
    const permissionPatterns = Array.isArray(site?.permissionPatterns)
      ? site.permissionPatterns.filter((pattern) => typeof pattern === "string" && pattern.trim())
      : [];

    permissionPatterns.forEach((origin) => requestedOrigins.add(origin));

    const blockedForSite = permissionPatterns.filter((origin) => blockedOrigins.has(origin));
    if (blockedForSite.length > 0) {
      blockedForSite.forEach((origin) => deniedOrigins.add(origin));
      permissionDeniedSites.push({
        id: site.id,
        name: site.name,
        reason: "permission_denied",
        origins: blockedForSite,
      });
      continue;
    }

    const missingOrigins = await findMissingOriginPermissions(permissionPatterns);
    if (missingOrigins.length === 0) {
      acceptedSites.push(site);
      continue;
    }

    try {
      const granted = chrome.permissions?.request
        ? await chrome.permissions.request({ origins: missingOrigins })
        : false;

      if (granted) {
        acceptedSites.push(site);
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
      id: site.id,
      name: site.name,
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
    getPromptHistory(),
    getPromptFavorites(),
    getTemplateVariableCache(),
    getAppSettings(),
    getCustomSites(),
    getBuiltInSiteStates(),
    getBuiltInSiteOverrides(),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    version: 3,
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

export async function importPromptData(jsonString) {
  const parsed = JSON.parse(jsonString);
  const previousCustomSites = await getCustomSites();
  const history = safeArray(parsed?.history).map((item) => buildHistoryEntry(item));
  const favorites = safeArray(parsed?.favorites).map((item) =>
    buildFavoriteEntry(item)
  );
  const importedBroadcastCounter = normalizeBroadcastCounter(parsed?.broadcastCounter);
  const templateVariableCache = normalizeTemplateDefaults(parsed?.templateVariableCache);
  const importedSettings = normalizeSettings(parsed?.settings ?? DEFAULT_SETTINGS);
  const importedCustomSites = safeArray(parsed?.customSites);
  const importedBuiltInSiteStates = safeObject(parsed?.builtInSiteStates);
  const importedBuiltInSiteOverrides = safeObject(parsed?.builtInSiteOverrides);
  const historyLimit = importedSettings.historyLimit;

  const normalizedHistory = [];
  for (const item of sortByDateDesc(history).slice(0, historyLimit)) {
    normalizedHistory.push({
      ...item,
      id: ensureUniqueNumericId(normalizedHistory, Number(item.id)),
    });
  }

  const normalizedFavorites = [];
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
      customSites: {
        importedCount: importedCustomSites.length,
        acceptedIds: customSiteImport.acceptedSites.map((site) => site.id),
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
