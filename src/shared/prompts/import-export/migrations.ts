import { DEFAULT_SETTINGS } from "../constants";
import { buildFavoriteEntry } from "../favorites-store";
import { buildHistoryEntry } from "../history-store";
import {
  normalizeComparisonNote,
  normalizePromptExperiment,
  normalizeServiceGroup,
  normalizeSettings,
  normalizeTemplatePack,
  safeArray,
  safeObject,
} from "../normalizers";

export const CURRENT_EXPORT_VERSION = 9;

export function asImportPayload(value: unknown): Record<string, unknown> {
  return safeObject(value);
}

export function normalizeImportVersion(value: unknown) {
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

export function migrateImportData(rawValue: unknown) {
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

