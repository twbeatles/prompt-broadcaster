import type {
  BroadcastComparisonNote,
  ChainStep,
  PromptExperiment,
  PromptExperimentRunRecord,
  PromptExperimentVariableSet,
  PromptExperimentVariant,
  ScheduleContextSnapshot,
  ServiceGroup,
  TemplatePack,
} from "../../types/models";
import {
  createStorageItemId,
  ensureUniqueStringId,
  normalizeBoolean,
  normalizeIsoDate,
  normalizeNullableIsoDate,
  normalizeSiteIdList,
  normalizeTags,
  normalizeTemplateDefaults,
  safeArray,
  safeObject,
  safeText,
  sortByDateDesc,
} from "./primitives";
import {
  normalizeBroadcastTargetMode,
  normalizeChainFailurePolicy,
  normalizeComparisonCaptureMode,
  normalizeExecutionTrigger,
  normalizeFavoriteMode,
  normalizeScheduleRepeat,
} from "./enums";
import { normalizeStringRecord } from "./site-results";

export function normalizeComparisonNote(
  value: unknown,
  fallback: Partial<BroadcastComparisonNote> = {},
  index = 0,
): BroadcastComparisonNote {
  const source = safeObject(value);
  const now = new Date().toISOString();
  const createdAt = normalizeIsoDate(source.createdAt ?? fallback.createdAt, now);
  const ratingValue = Number(source.rating ?? fallback.rating);
  const rating = Number.isFinite(ratingValue)
    ? Math.min(5, Math.max(1, Math.round(ratingValue)))
    : null;

  return {
    id: createStorageItemId("note", source.id ?? fallback.id, index),
    historyId: Number.isFinite(Number(source.historyId ?? fallback.historyId))
      ? Math.max(0, Math.round(Number(source.historyId ?? fallback.historyId)))
      : 0,
    serviceId: safeText(source.serviceId ?? fallback.serviceId).trim(),
    responseText: safeText(source.responseText ?? fallback.responseText),
    captureMode: normalizeComparisonCaptureMode(
      source.captureMode ?? fallback.captureMode,
    ),
    rating,
    tags: normalizeTags(source.tags ?? fallback.tags),
    createdAt,
    updatedAt: normalizeIsoDate(source.updatedAt ?? fallback.updatedAt, createdAt),
  };
}

export function normalizePromptExperimentVariant(
  value: unknown,
  fallback: Partial<PromptExperimentVariant> = {},
  index = 0,
): PromptExperimentVariant {
  const source = safeObject(value);
  return {
    id: createStorageItemId("variant", source.id ?? fallback.id, index),
    title:
      safeText(source.title ?? fallback.title).trim() ||
      `Variant ${index + 1}`,
    text: safeText(source.text ?? fallback.text),
  };
}

export function normalizePromptExperimentVariableSet(
  value: unknown,
  fallback: Partial<PromptExperimentVariableSet> = {},
  index = 0,
): PromptExperimentVariableSet {
  const source = safeObject(value);
  return {
    id: createStorageItemId("vars", source.id ?? fallback.id, index),
    title:
      safeText(source.title ?? fallback.title).trim() ||
      `Variables ${index + 1}`,
    values: normalizeTemplateDefaults(source.values ?? fallback.values),
  };
}

export function normalizePromptExperimentRunRecord(
  value: unknown,
  fallback: Partial<PromptExperimentRunRecord> = {},
  index = 0,
): PromptExperimentRunRecord {
  const source = safeObject(value);
  return {
    id: createStorageItemId("run", source.id ?? fallback.id, index),
    createdAt: normalizeIsoDate(source.createdAt ?? fallback.createdAt),
    variantId: safeText(source.variantId ?? fallback.variantId).trim(),
    variableSetId: safeText(source.variableSetId ?? fallback.variableSetId).trim(),
    targetSiteIds: normalizeSiteIdList(source.targetSiteIds ?? fallback.targetSiteIds),
    broadcastIds: normalizeSiteIdList(source.broadcastIds ?? fallback.broadcastIds),
  };
}

export function normalizePromptExperiment(
  value: unknown,
  fallback: Partial<PromptExperiment> = {},
  index = 0,
): PromptExperiment {
  const source = safeObject(value);
  const now = new Date().toISOString();
  const createdAt = normalizeIsoDate(source.createdAt ?? fallback.createdAt, now);
  const variants = safeArray(source.variants ?? fallback.variants)
    .map((entry, variantIndex) => normalizePromptExperimentVariant(entry, {}, variantIndex))
    .filter((variant) => variant.text.trim());
  const variableSets = safeArray(source.variableSets ?? fallback.variableSets)
    .map((entry, setIndex) => normalizePromptExperimentVariableSet(entry, {}, setIndex));
  const normalizedVariableSets =
    variableSets.length > 0
      ? variableSets
      : [normalizePromptExperimentVariableSet({ title: "Default", values: {} }, {}, 0)];

  return {
    id: createStorageItemId("experiment", source.id ?? fallback.id, index),
    title:
      safeText(source.title ?? fallback.title).trim() ||
      `Experiment ${index + 1}`,
    description: safeText(source.description ?? fallback.description),
    variants,
    targetSiteIds: normalizeSiteIdList(source.targetSiteIds ?? fallback.targetSiteIds),
    variableSets: normalizedVariableSets,
    runs: safeArray(source.runs ?? fallback.runs).map((entry, runIndex) =>
      normalizePromptExperimentRunRecord(entry, {}, runIndex),
    ),
    createdAt,
    updatedAt: normalizeIsoDate(source.updatedAt ?? fallback.updatedAt, createdAt),
  };
}

export function normalizeTemplatePack(
  value: unknown,
  fallback: Partial<TemplatePack> = {},
  index = 0,
): TemplatePack {
  const source = safeObject(value);
  const now = new Date().toISOString();
  const createdAt = normalizeIsoDate(source.createdAt ?? fallback.createdAt, now);
  return {
    id: createStorageItemId("pack", source.id ?? fallback.id, index),
    title:
      safeText(source.title ?? fallback.title).trim() ||
      `Template Pack ${index + 1}`,
    description: safeText(source.description ?? fallback.description),
    favoriteIds: normalizeSiteIdList(source.favoriteIds ?? fallback.favoriteIds),
    templates: safeArray(source.templates ?? fallback.templates) as TemplatePack["templates"],
    includeSensitiveDefaults: normalizeBoolean(
      source.includeSensitiveDefaults ?? fallback.includeSensitiveDefaults,
      true,
    ),
    createdAt,
    updatedAt: normalizeIsoDate(source.updatedAt ?? fallback.updatedAt, createdAt),
  };
}

export function normalizeServiceGroup(
  value: unknown,
  fallback: Partial<ServiceGroup> = {},
  index = 0,
): ServiceGroup {
  const source = safeObject(value);
  const now = new Date().toISOString();
  const createdAt = normalizeIsoDate(source.createdAt ?? fallback.createdAt, now);
  const sortOrder = Number(source.sortOrder ?? fallback.sortOrder ?? index);
  return {
    id: createStorageItemId("group", source.id ?? fallback.id, index),
    title:
      safeText(source.title ?? fallback.title).trim() ||
      `Group ${index + 1}`,
    serviceIds: normalizeSiteIdList(source.serviceIds ?? fallback.serviceIds),
    sortOrder: Number.isFinite(sortOrder) ? Math.max(0, Math.round(sortOrder)) : index,
    createdAt,
    updatedAt: normalizeIsoDate(source.updatedAt ?? fallback.updatedAt, createdAt),
  };
}

export function normalizeScheduleContextSnapshot(
  value: unknown,
): ScheduleContextSnapshot | null {
  const source = safeObject(value);
  const hasMeaningfulValue = Boolean(
    source.enabled ||
      safeText(source.url).trim() ||
      safeText(source.title).trim() ||
      safeText(source.selection).trim() ||
      safeText(source.capturedAt).trim(),
  );

  if (!hasMeaningfulValue) {
    return null;
  }

  return {
    enabled: normalizeBoolean(source.enabled, false),
    url: safeText(source.url),
    title: safeText(source.title),
    selection: safeText(source.selection),
    capturedAt: normalizeNullableIsoDate(source.capturedAt),
  };
}

export function createChainStepId(preferredId: unknown, fallbackIndex = 0) {
  const trimmedId = safeText(preferredId).trim();
  return trimmedId || `step-${Date.now()}-${fallbackIndex}`;
}

export function normalizeDelayMs(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.round(numericValue));
}

export function normalizeChainStep(
  value: unknown,
  fallback: Partial<ChainStep> = {},
  index = 0
): ChainStep {
  const source = safeObject(value);
  const fallbackTargets = Array.isArray(fallback.targetSiteIds) ? fallback.targetSiteIds : [];

  return {
    id: createChainStepId(source.id ?? fallback.id, index),
    text: safeText(source.text ?? fallback.text),
    delayMs: normalizeDelayMs(source.delayMs ?? fallback.delayMs),
    targetSiteIds: normalizeSiteIdList(
      Array.isArray(source.targetSiteIds) ? source.targetSiteIds : fallbackTargets
    ),
    failurePolicy: normalizeChainFailurePolicy(
      source.failurePolicy ?? fallback.failurePolicy,
    ),
    targetMode: normalizeBroadcastTargetMode(source.targetMode ?? fallback.targetMode),
    templateDefaults: normalizeTemplateDefaults(
      source.templateDefaults ?? fallback.templateDefaults,
    ),
  };
}

export function normalizeChainSteps(
  value: unknown,
  fallback: Partial<ChainStep> = {}
): ChainStep[] {
  const source = safeArray(value)
    .map((entry, index) => normalizeChainStep(entry, fallback, index))
    .filter((entry) => entry.text.trim());

  if (source.length > 0) {
    return source;
  }

  if (safeText(fallback.text).trim()) {
    return [normalizeChainStep(fallback, fallback, 0)];
  }

  return [];
}
