// @ts-nocheck
import {
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
  normalizeSettings,
  normalizeTemplateDefaults,
  safeArray,
  safeObject,
  sortByDateDesc,
} from "./normalizers";
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

async function repairImportedCustomSitesWithPermissions(rawSites) {
  const repaired = repairImportedCustomSites(rawSites);
  const requestedOrigins = Array.from(
    new Set(
      repaired.repairedSites
        .map((site) => site.permissionPattern)
        .filter((pattern) => typeof pattern === "string" && pattern.trim())
    )
  );

  const grantedOrigins = new Set();
  const missingOrigins = [];

  for (const origin of requestedOrigins) {
    if (await containsOriginPermission(origin)) {
      grantedOrigins.add(origin);
    } else {
      missingOrigins.push(origin);
    }
  }

  let deniedOrigins = [];
  if (missingOrigins.length > 0) {
    try {
      const granted = chrome.permissions?.request
        ? await chrome.permissions.request({ origins: missingOrigins })
        : false;

      if (granted) {
        for (const origin of missingOrigins) {
          grantedOrigins.add(origin);
        }
      } else {
        deniedOrigins = [...missingOrigins];
      }
    } catch (_error) {
      deniedOrigins = [...missingOrigins];
    }
  }

  const acceptedSites = [];
  const permissionDeniedSites = [];

  for (const site of repaired.repairedSites) {
    if (!site.permissionPattern || grantedOrigins.has(site.permissionPattern)) {
      acceptedSites.push(site);
      continue;
    }

    permissionDeniedSites.push({
      id: site.id,
      name: site.name,
      reason: "permission_denied",
      origin: site.permissionPattern,
    });
  }

  return {
    acceptedSites,
    rejectedSites: [...repaired.rejectedSites, ...permissionDeniedSites],
    rewrittenIds: repaired.rewrittenIds,
    deniedOrigins,
    requestedOrigins,
  };
}

export async function exportPromptData() {
  const [
    history,
    favorites,
    templateVariableCache,
    settings,
    customSites,
    builtInSiteStates,
    builtInSiteOverrides,
  ] = await Promise.all([
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
    version: 2,
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
  const history = safeArray(parsed?.history).map((item) => buildHistoryEntry(item));
  const favorites = safeArray(parsed?.favorites).map((item) =>
    buildFavoriteEntry(item)
  );
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
    setPromptFavorites(normalizedFavorites),
    setTemplateVariableCache(templateVariableCache),
    setCustomSites(customSiteImport.acceptedSites),
    setBuiltInSiteStates(builtInStateImport.normalized),
    setBuiltInSiteOverrides(builtInOverrideImport.normalized),
  ]);
  await setPromptHistory(normalizedHistory);

  return {
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
