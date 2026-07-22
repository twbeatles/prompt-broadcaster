import {
  cleanupUnusedCustomSitePermissions,
  repairImportedBuiltInOverrides,
  repairImportedBuiltInStates,
  repairImportedCustomSites,
  findMissingOriginPermissions,
  getBuiltInSiteOverrides,
  getBuiltInSiteStates,
  getCustomSites,
  requestOriginPermissions,
  SITE_STORAGE_KEYS,
} from "../sites";
import {
  DEFAULT_SETTINGS,
  LOCAL_STORAGE_KEYS,
} from "./constants";
import {
  buildFavoriteEntry,
  getPromptFavorites,
} from "./favorites-store";
import {
  capStoredComparisonNotes,
  getComparisonNotes,
  getPromptExperiments,
  getServiceGroups,
  getTemplatePacks,
} from "./advanced-store";
import {
  buildHistoryEntry,
  capStoredPromptHistory,
  getStoredPromptHistory,
} from "./history-store";
import {
  ensureUniqueNumericId,
  ensureUniqueStringId,
  normalizeBroadcastCounter,
  normalizeComparisonNote,
  normalizePromptExperiment,
  normalizeServiceGroup,
  normalizeSettings,
  normalizeTemplatePack,
  normalizeTemplateDefaults,
  safeArray,
  safeObject,
  sortByDateDesc,
} from "./normalizers";
import {
  getBroadcastCounter,
} from "./broadcast-counter";
import { getAppSettings } from "./settings-store";
import {
  getTemplateVariableCache,
} from "./template-cache-store";
import { safeText } from "../sites";
import type {
  FavoritePrompt,
  ImportSummary,
  ImportRejectedSite,
  PromptHistoryItem,
} from "../types/models";

import {
  asImportPayload,
  CURRENT_EXPORT_VERSION,
  migrateImportData,
  normalizeImportVersion,
} from "./import-export/migrations";
import {
  createImportPermissionDeniedError,
  createImportSummary,
  type AcceptedCustomSite,
} from "./import-export/summary";

async function repairImportedCustomSitesWithPermissions(rawSites: unknown) {
  const repaired = repairImportedCustomSites(rawSites);
  const requestedOrigins = new Set<string>();
  const deniedOrigins = new Set<string>();

  const acceptedSites: AcceptedCustomSite[] = [];
  const permissionDeniedSites: ImportRejectedSite[] = [];

  const requestedPermissionPatterns = Array.from(
    new Set(
      repaired.repairedSites.flatMap((site) =>
        Array.isArray(site?.permissionPatterns)
          ? site.permissionPatterns.filter((pattern) => typeof pattern === "string" && pattern.trim())
          : []
      )
    )
  );
  const permissionRequestResult = await requestOriginPermissions(requestedPermissionPatterns);
  permissionRequestResult.requestedOrigins.forEach((origin) => requestedOrigins.add(origin));
  permissionRequestResult.deniedOrigins.forEach((origin) => deniedOrigins.add(origin));

  for (const site of repaired.repairedSites) {
    const permissionPatterns = Array.isArray(site?.permissionPatterns)
      ? site.permissionPatterns.filter((pattern) => typeof pattern === "string" && pattern.trim())
      : [];

    permissionPatterns.forEach((origin) => requestedOrigins.add(origin));

    const missingOrigins = await findMissingOriginPermissions(permissionPatterns);
    if (missingOrigins.length === 0) {
      acceptedSites.push(site as AcceptedCustomSite);
      continue;
    }

    missingOrigins.forEach((origin) => deniedOrigins.add(origin));
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
    comparisonNotes,
    promptExperiments,
    templatePacks,
    serviceGroups,
  ] = await Promise.all([
    getBroadcastCounter(),
    getStoredPromptHistory(),
    getPromptFavorites(),
    getTemplateVariableCache(),
    getAppSettings(),
    getCustomSites(),
    getBuiltInSiteStates(),
    getBuiltInSiteOverrides(),
    getComparisonNotes(),
    getPromptExperiments(),
    getTemplatePacks(),
    getServiceGroups(),
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
    comparisonNotes,
    promptExperiments,
    templatePacks,
    serviceGroups,
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
  const importedComparisonNotes = capStoredComparisonNotes(
    safeArray(migrated?.comparisonNotes).map((entry, index) =>
      normalizeComparisonNote(entry, {}, index),
    ),
  );
  const importedPromptExperiments = safeArray(migrated?.promptExperiments).map((entry, index) =>
    normalizePromptExperiment(entry, {}, index),
  );
  const importedTemplatePacks = safeArray(migrated?.templatePacks).map((entry, index) =>
    normalizeTemplatePack(entry, {}, index),
  );
  const importedServiceGroups = safeArray(migrated?.serviceGroups).map((entry, index) =>
    normalizeServiceGroup(entry, {}, index),
  );
  const normalizedHistoryDraft: PromptHistoryItem[] = [];
  for (const item of sortByDateDesc(history)) {
    normalizedHistoryDraft.push({
      ...item,
      id: ensureUniqueNumericId(normalizedHistoryDraft, Number(item.id)),
    });
  }
  const normalizedHistory = capStoredPromptHistory(normalizedHistoryDraft);

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
  const importSummary = createImportSummary(
    targetVersion,
    sourceVersion,
    importedCustomSites,
    customSiteImport,
    builtInStateImport,
    builtInOverrideImport,
  );

  if (customSiteImport.deniedOrigins.length > 0) {
    throw createImportPermissionDeniedError({
      ...importSummary,
      customSites: {
        ...importSummary.customSites,
        acceptedIds: [],
        acceptedNames: [],
      },
    });
  }

  await chrome.storage.local.set({
    [LOCAL_STORAGE_KEYS.broadcastCounter]: importedBroadcastCounter,
    [LOCAL_STORAGE_KEYS.favorites]: normalizedFavorites,
    [LOCAL_STORAGE_KEYS.templateVariableCache]: templateVariableCache,
    [LOCAL_STORAGE_KEYS.settings]: importedSettings,
    [LOCAL_STORAGE_KEYS.history]: normalizedHistory,
    [SITE_STORAGE_KEYS.customSites]: customSiteImport.acceptedSites,
    [SITE_STORAGE_KEYS.builtInSiteStates]: builtInStateImport.normalized,
    [SITE_STORAGE_KEYS.builtInSiteOverrides]: builtInOverrideImport.normalized,
    [LOCAL_STORAGE_KEYS.comparisonNotes]: importedComparisonNotes,
    [LOCAL_STORAGE_KEYS.promptExperiments]: importedPromptExperiments,
    [LOCAL_STORAGE_KEYS.templatePacks]: importedTemplatePacks,
    [LOCAL_STORAGE_KEYS.serviceGroups]: importedServiceGroups,
  });
  try {
    await cleanupUnusedCustomSitePermissions(previousCustomSites, customSiteImport.acceptedSites);
  } catch (cleanupError) {
    console.warn("[AI Prompt Broadcaster] Imported data was committed, but optional permission cleanup failed.", cleanupError);
  }

  return {
    broadcastCounter: importedBroadcastCounter,
    history: normalizedHistory,
    favorites: normalizedFavorites,
    templateVariableCache,
    settings: importedSettings,
    customSites: customSiteImport.acceptedSites,
    builtInSiteStates: builtInStateImport.normalized,
    builtInSiteOverrides: builtInOverrideImport.normalized,
    comparisonNotes: importedComparisonNotes,
    promptExperiments: importedPromptExperiments,
    templatePacks: importedTemplatePacks,
    serviceGroups: importedServiceGroups,
    importSummary,
  };
}

