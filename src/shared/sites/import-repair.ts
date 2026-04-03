import { AI_SITES } from "../../config/sites";
import { BUILT_IN_SITE_IDS } from "./constants";
import {
  createImportedCustomSiteIdBase,
  ensureUniqueImportedSiteId,
  isPlainObject,
  normalizeBoolean,
  normalizeCustomSite,
  normalizeWaitMs,
  safeText,
  sanitizeBuiltInOverride,
  stringifyComparable,
} from "./normalizers";
import { validateSiteDraft } from "./validation";

type PlainRecord = Record<string, unknown>;

function asPlainRecord(value: unknown): PlainRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as PlainRecord)
    : {};
}

function detectBuiltInOverrideAdjustment(
  rawEntry: unknown,
  sanitized: PlainRecord,
  source: PlainRecord
) {
  const rawRecord = asPlainRecord(rawEntry);
  if (!isPlainObject(rawRecord)) {
    return true;
  }

  const allowedKeys = new Set([
    "name",
    "inputSelector",
    "inputType",
    "submitSelector",
    "submitMethod",
    "selectorCheckMode",
    "waitMs",
    "fallbackSelectors",
    "authSelectors",
    "lastVerified",
    "verifiedVersion",
    "color",
    "icon",
  ]);

  if (Object.keys(rawRecord).some((key) => !allowedKeys.has(key))) {
    return true;
  }

  const simpleComparisons = [
    ["name", safeText(rawRecord.name), sanitized.name],
    ["inputSelector", safeText(rawRecord.inputSelector), sanitized.inputSelector],
    ["inputType", safeText(rawRecord.inputType), sanitized.inputType],
    ["submitSelector", safeText(rawRecord.submitSelector), sanitized.submitSelector],
    ["submitMethod", safeText(rawRecord.submitMethod), sanitized.submitMethod],
    ["selectorCheckMode", safeText(rawRecord.selectorCheckMode), sanitized.selectorCheckMode],
    ["lastVerified", safeText(rawRecord.lastVerified), sanitized.lastVerified],
    ["verifiedVersion", safeText(rawRecord.verifiedVersion), sanitized.verifiedVersion],
    ["color", safeText(rawRecord.color), sanitized.color],
    ["icon", safeText(rawRecord.icon), sanitized.icon],
  ] as Array<[string, string, unknown]>;

  for (const [key, rawValue, sanitizedValue] of simpleComparisons) {
    if (Object.prototype.hasOwnProperty.call(rawRecord, key) && rawValue !== sanitizedValue) {
      return true;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(rawRecord, "waitMs") &&
    normalizeWaitMs(
      rawRecord.waitMs,
      typeof source.waitMs === "number" ? source.waitMs : undefined
    ) !== sanitized.waitMs
  ) {
    return true;
  }

  if (
    Array.isArray(rawRecord.fallbackSelectors) &&
    stringifyComparable(rawRecord.fallbackSelectors.filter((entry) => typeof entry === "string" && entry.trim())) !==
      stringifyComparable(sanitized.fallbackSelectors)
  ) {
    return true;
  }

  if (
    Array.isArray(rawRecord.authSelectors) &&
    stringifyComparable(rawRecord.authSelectors.filter((entry) => typeof entry === "string" && entry.trim())) !==
      stringifyComparable(sanitized.authSelectors)
  ) {
    return true;
  }

  return false;
}

export function repairImportedBuiltInStates(value: unknown) {
  if (!isPlainObject(value)) {
    return {
      normalized: {},
      appliedIds: [],
      droppedIds: [],
    };
  }

  const normalized: Record<string, { enabled: boolean }> = {};
  const appliedIds = [];
  const droppedIds = [];

  for (const [key, entry] of Object.entries(asPlainRecord(value))) {
    if (!BUILT_IN_SITE_IDS.has(key)) {
      droppedIds.push(key);
      continue;
    }

    const entryRecord = asPlainRecord(entry);
    normalized[key] = { enabled: normalizeBoolean(entryRecord.enabled, true) };
    appliedIds.push(key);
  }

  return {
    normalized,
    appliedIds,
    droppedIds,
  };
}

export function repairImportedBuiltInOverrides(value: unknown) {
  if (!isPlainObject(value)) {
    return {
      normalized: {},
      appliedIds: [],
      droppedIds: [],
      adjustedIds: [],
    };
  }

  const normalized: Record<string, PlainRecord> = {};
  const appliedIds = [];
  const droppedIds = [];
  const adjustedIds = [];

  for (const [key, entry] of Object.entries(asPlainRecord(value))) {
    const source = AI_SITES.find((site) => site.id === key);
    if (!source) {
      droppedIds.push(key);
      continue;
    }

    const sourceRecord = source as PlainRecord;
    const entryRecord = asPlainRecord(entry);
    const sanitized = sanitizeBuiltInOverride(entryRecord, sourceRecord) as PlainRecord;
    const mergedDraft = {
      ...sourceRecord,
      ...sanitized,
    };
    const validation = validateSiteDraft(mergedDraft, { isBuiltIn: true });
    const finalOverride = validation.valid
      ? sanitized
      : (sanitizeBuiltInOverride({}, sourceRecord) as PlainRecord);
    normalized[key] = finalOverride;
    appliedIds.push(key);

    if (!validation.valid || detectBuiltInOverrideAdjustment(entryRecord, finalOverride, sourceRecord)) {
      adjustedIds.push(key);
    }
  }

  return {
    normalized,
    appliedIds,
    droppedIds,
    adjustedIds,
  };
}

export function repairImportedCustomSites(rawSites: unknown) {
  const repairedSites: PlainRecord[] = [];
  const rejectedSites = [];
  const rewrittenIds = [];
  const usedIds = new Set(BUILT_IN_SITE_IDS);

  for (const [index, rawSite] of (Array.isArray(rawSites) ? rawSites : []).entries()) {
    const normalized = normalizeCustomSite(rawSite);
    const rawSiteRecord = asPlainRecord(rawSite);
    const validation = validateSiteDraft({
      ...normalized,
      hostnameAliases: Array.isArray(rawSiteRecord.hostnameAliases)
        ? rawSiteRecord.hostnameAliases
        : normalized.hostnameAliases,
    });

    if (!validation.valid) {
      rejectedSites.push({
        id: safeText(rawSiteRecord.id) || normalized.id,
        name: normalized.name,
        reason: "validation_failed",
        errors: validation.errors,
      });
      continue;
    }

    const requestedId = safeText(rawSiteRecord.id) || "";
    let finalId = requestedId;

    if (!finalId) {
      finalId = ensureUniqueImportedSiteId(
        createImportedCustomSiteIdBase(
          {
            ...rawSiteRecord,
            name: normalized.name,
            hostname: normalized.hostname,
            url: normalized.url,
          },
          index
        ),
        usedIds
      );
    } else if (usedIds.has(finalId)) {
      const collisionBase = BUILT_IN_SITE_IDS.has(finalId)
        ? createImportedCustomSiteIdBase(
            {
              ...rawSiteRecord,
              name: normalized.name,
              hostname: normalized.hostname,
              url: normalized.url,
            },
            index
          )
        : finalId;
      finalId = ensureUniqueImportedSiteId(collisionBase, usedIds);
    } else {
      usedIds.add(finalId);
    }

    if (finalId !== normalized.id || (requestedId && finalId !== requestedId)) {
      rewrittenIds.push({
        from: requestedId || normalized.id,
        to: finalId,
        name: normalized.name,
      });
    }

    repairedSites.push({
      ...normalized,
      id: finalId,
    });
  }

  return {
    repairedSites,
    rejectedSites,
    rewrittenIds,
  };
}
