// @ts-nocheck
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

function detectBuiltInOverrideAdjustment(rawEntry, sanitized, source) {
  if (!isPlainObject(rawEntry)) {
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

  if (Object.keys(rawEntry).some((key) => !allowedKeys.has(key))) {
    return true;
  }

  const simpleComparisons = [
    ["name", safeText(rawEntry.name), sanitized.name],
    ["inputSelector", safeText(rawEntry.inputSelector), sanitized.inputSelector],
    ["inputType", safeText(rawEntry.inputType), sanitized.inputType],
    ["submitSelector", safeText(rawEntry.submitSelector), sanitized.submitSelector],
    ["submitMethod", safeText(rawEntry.submitMethod), sanitized.submitMethod],
    ["selectorCheckMode", safeText(rawEntry.selectorCheckMode), sanitized.selectorCheckMode],
    ["lastVerified", safeText(rawEntry.lastVerified), sanitized.lastVerified],
    ["verifiedVersion", safeText(rawEntry.verifiedVersion), sanitized.verifiedVersion],
    ["color", safeText(rawEntry.color), sanitized.color],
    ["icon", safeText(rawEntry.icon), sanitized.icon],
  ];

  for (const [key, rawValue, sanitizedValue] of simpleComparisons) {
    if (Object.prototype.hasOwnProperty.call(rawEntry, key) && rawValue !== sanitizedValue) {
      return true;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(rawEntry, "waitMs") &&
    normalizeWaitMs(rawEntry.waitMs, source.waitMs) !== sanitized.waitMs
  ) {
    return true;
  }

  if (
    Array.isArray(rawEntry.fallbackSelectors) &&
    stringifyComparable(rawEntry.fallbackSelectors.filter((entry) => typeof entry === "string" && entry.trim())) !==
      stringifyComparable(sanitized.fallbackSelectors)
  ) {
    return true;
  }

  if (
    Array.isArray(rawEntry.authSelectors) &&
    stringifyComparable(rawEntry.authSelectors.filter((entry) => typeof entry === "string" && entry.trim())) !==
      stringifyComparable(sanitized.authSelectors)
  ) {
    return true;
  }

  return false;
}

export function repairImportedBuiltInStates(value) {
  if (!isPlainObject(value)) {
    return {
      normalized: {},
      appliedIds: [],
      droppedIds: [],
    };
  }

  const normalized = {};
  const appliedIds = [];
  const droppedIds = [];

  for (const [key, entry] of Object.entries(value)) {
    if (!BUILT_IN_SITE_IDS.has(key)) {
      droppedIds.push(key);
      continue;
    }

    normalized[key] = { enabled: normalizeBoolean(entry?.enabled, true) };
    appliedIds.push(key);
  }

  return {
    normalized,
    appliedIds,
    droppedIds,
  };
}

export function repairImportedBuiltInOverrides(value) {
  if (!isPlainObject(value)) {
    return {
      normalized: {},
      appliedIds: [],
      droppedIds: [],
      adjustedIds: [],
    };
  }

  const normalized = {};
  const appliedIds = [];
  const droppedIds = [];
  const adjustedIds = [];

  for (const [key, entry] of Object.entries(value)) {
    const source = AI_SITES.find((site) => site.id === key);
    if (!source) {
      droppedIds.push(key);
      continue;
    }

    const sanitized = sanitizeBuiltInOverride(entry, source);
    normalized[key] = sanitized;
    appliedIds.push(key);

    if (detectBuiltInOverrideAdjustment(entry, sanitized, source)) {
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

export function repairImportedCustomSites(rawSites) {
  const repairedSites = [];
  const rejectedSites = [];
  const rewrittenIds = [];
  const usedIds = new Set(BUILT_IN_SITE_IDS);

  for (const [index, rawSite] of (Array.isArray(rawSites) ? rawSites : []).entries()) {
    const normalized = normalizeCustomSite(rawSite);
    const validation = validateSiteDraft(normalized);

    if (!validation.valid) {
      rejectedSites.push({
        id: safeText(rawSite?.id) || normalized.id,
        name: normalized.name,
        reason: "validation_failed",
        errors: validation.errors,
      });
      continue;
    }

    const requestedId = safeText(rawSite?.id) || "";
    let finalId = requestedId;

    if (!finalId) {
      finalId = ensureUniqueImportedSiteId(
        createImportedCustomSiteIdBase(
          {
            ...rawSite,
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
              ...rawSite,
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
