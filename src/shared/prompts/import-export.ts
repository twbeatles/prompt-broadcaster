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
  getComparisonNotes,
  getPromptExperiments,
  getServiceGroups,
  getTemplatePacks,
} from "./advanced-store";
import {
  buildHistoryEntry,
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

const CURRENT_EXPORT_VERSION = 9;
type AcceptedCustomSite = Record<string, unknown> & {
  id: string;
  name: string;
  permissionPatterns?: unknown;
};

function asImportPayload(value: unknown): Record<string, unknown> {
  return safeObject(value);
}

function createImportSummary(
  targetVersion: number,
  sourceVersion: number,
  importedCustomSites: unknown[],
  customSiteImport: {
    acceptedSites: AcceptedCustomSite[];
    rejectedSites: ImportRejectedSite[];
    rewrittenIds: Array<{ from: string; to: string; name: string }>;
    deniedOrigins: string[];
  },
  builtInStateImport: {
    appliedIds: string[];
    droppedIds: string[];
  },
  builtInOverrideImport: {
    appliedIds: string[];
    droppedIds: string[];
    adjustedIds: string[];
  },
): ImportSummary {
  return {
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
  };
}

function createImportPermissionDeniedError(importSummary: ImportSummary): Error & {
  code: "import_permission_denied";
  importSummary: ImportSummary;
} {
  const error = new Error("Import failed.");
  return Object.assign(error, {
    code: "import_permission_denied" as const,
    importSummary,
  });
}

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

function migrateV6ToV7(payload: Record<string, unknown>) {
  return {
    ...payload,
    version: 7,
    history: safeArray(payload.history).map((entry) => buildHistoryEntry(entry)),
    favorites: safeArray(payload.favorites).map((entry) => buildFavoriteEntry(entry)),
  };
}

function migrateV7ToV8(payload: Record<string, unknown>) {
  return {
    ...payload,
    version: 8,
    history: safeArray(payload.history).map((entry) => buildHistoryEntry(entry)),
    favorites: safeArray(payload.favorites).map((entry) => buildFavoriteEntry(entry)),
  };
}

function migrateV8ToV9(payload: Record<string, unknown>) {
  return {
    ...payload,
    version: 9,
    comparisonNotes: safeArray(payload.comparisonNotes).map((entry, index) =>
      normalizeComparisonNote(entry, {}, index),
    ),
    promptExperiments: safeArray(payload.promptExperiments).map((entry, index) =>
      normalizePromptExperiment(entry, {}, index),
    ),
    templatePacks: safeArray(payload.templatePacks).map((entry, index) =>
      normalizeTemplatePack(entry, {}, index),
    ),
    serviceGroups: safeArray(payload.serviceGroups).map((entry, index) =>
      normalizeServiceGroup(entry, {}, index),
    ),
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

  if (workingVersion < 7) {
    payload = migrateV6ToV7(payload);
    workingVersion = 7;
  }

  if (workingVersion < 8) {
    payload = migrateV7ToV8(payload);
    workingVersion = 8;
  }

  if (workingVersion < 9) {
    payload = migrateV8ToV9(payload);
    workingVersion = 9;
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
  const importedComparisonNotes = safeArray(migrated?.comparisonNotes).map((entry, index) =>
    normalizeComparisonNote(entry, {}, index),
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
