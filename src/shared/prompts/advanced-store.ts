import { LOCAL_STORAGE_KEYS } from "./constants";
import { buildFavoriteEntry } from "./favorites-store";
import {
  ensureUniqueStringId,
  normalizeComparisonNote,
  normalizePromptExperiment,
  normalizePromptExperimentRunRecord,
  normalizeServiceGroup,
  normalizeTemplatePack,
  safeArray,
  sortByDateDesc,
} from "./normalizers";
import { readLocal, writeLocal } from "./storage";
import type {
  BroadcastComparisonNote,
  PromptExperiment,
  PromptExperimentRunRecord,
  ServiceGroup,
  TemplatePack,
} from "../types/models";

function normalizeTemplatePackEntry(
  value: unknown,
  fallback: Partial<TemplatePack> = {},
  index = 0,
): TemplatePack {
  const pack = normalizeTemplatePack(value, fallback, index);
  return {
    ...pack,
    templates: safeArray(pack.templates).map((entry) => buildFavoriteEntry(entry)),
  };
}

export async function getComparisonNotes(): Promise<BroadcastComparisonNote[]> {
  const rawValue = await readLocal<unknown[]>(
    LOCAL_STORAGE_KEYS.comparisonNotes,
    [],
  );
  return sortByDateDesc(
    safeArray(rawValue).map((entry, index) =>
      normalizeComparisonNote(entry, {}, index),
    ),
    "updatedAt",
  ).filter((entry) => entry.historyId > 0 && entry.serviceId && entry.responseText.trim());
}

export async function setComparisonNotes(
  value: unknown[],
): Promise<BroadcastComparisonNote[]> {
  const normalized = sortByDateDesc(
    safeArray(value).map((entry, index) =>
      normalizeComparisonNote(entry, {}, index),
    ),
    "updatedAt",
  ).filter((entry) => entry.historyId > 0 && entry.serviceId && entry.responseText.trim());
  await writeLocal(LOCAL_STORAGE_KEYS.comparisonNotes, normalized);
  return normalized;
}

export async function saveComparisonNote(
  value: Partial<BroadcastComparisonNote>,
): Promise<BroadcastComparisonNote> {
  const current = await getComparisonNotes();
  const now = new Date().toISOString();
  const preferredId =
    typeof value.id === "string" && value.id.trim()
      ? value.id.trim()
      : `note-${Date.now()}`;
  const existing = current.find((entry) => entry.id === preferredId);
  const note = normalizeComparisonNote(
    {
      ...(existing ?? {}),
      ...(value ?? {}),
      id: existing?.id ?? ensureUniqueStringId(current, preferredId),
      createdAt: existing?.createdAt ?? value.createdAt ?? now,
      updatedAt: now,
    },
    {},
    0,
  );
  const next = [note, ...current.filter((entry) => entry.id !== note.id)];
  await setComparisonNotes(next);
  return note;
}

export async function deleteComparisonNote(
  noteId: string,
): Promise<BroadcastComparisonNote[]> {
  const normalizedId = typeof noteId === "string" ? noteId.trim() : "";
  const current = await getComparisonNotes();
  const next = current.filter((entry) => entry.id !== normalizedId);
  await setComparisonNotes(next);
  return next;
}

export async function getPromptExperiments(): Promise<PromptExperiment[]> {
  const rawValue = await readLocal<unknown[]>(
    LOCAL_STORAGE_KEYS.promptExperiments,
    [],
  );
  return sortByDateDesc(
    safeArray(rawValue).map((entry, index) =>
      normalizePromptExperiment(entry, {}, index),
    ),
    "updatedAt",
  );
}

export async function setPromptExperiments(
  value: unknown[],
): Promise<PromptExperiment[]> {
  const normalized = sortByDateDesc(
    safeArray(value).map((entry, index) =>
      normalizePromptExperiment(entry, {}, index),
    ),
    "updatedAt",
  );
  await writeLocal(LOCAL_STORAGE_KEYS.promptExperiments, normalized);
  return normalized;
}

export async function savePromptExperiment(
  value: Partial<PromptExperiment>,
): Promise<PromptExperiment> {
  const current = await getPromptExperiments();
  const now = new Date().toISOString();
  const preferredId =
    typeof value.id === "string" && value.id.trim()
      ? value.id.trim()
      : `experiment-${Date.now()}`;
  const existing = current.find((entry) => entry.id === preferredId);
  const experiment = normalizePromptExperiment(
    {
      ...(existing ?? {}),
      ...(value ?? {}),
      id: existing?.id ?? ensureUniqueStringId(current, preferredId),
      createdAt: existing?.createdAt ?? value.createdAt ?? now,
      updatedAt: now,
    },
    {},
    0,
  );
  const next = [experiment, ...current.filter((entry) => entry.id !== experiment.id)];
  await setPromptExperiments(next);
  return experiment;
}

export async function deletePromptExperiment(
  experimentId: string,
): Promise<PromptExperiment[]> {
  const normalizedId = typeof experimentId === "string" ? experimentId.trim() : "";
  const current = await getPromptExperiments();
  const next = current.filter((entry) => entry.id !== normalizedId);
  await setPromptExperiments(next);
  return next;
}

export async function appendPromptExperimentRun(
  experimentId: string,
  run: Partial<PromptExperimentRunRecord>,
): Promise<PromptExperiment | null> {
  const current = await getPromptExperiments();
  const experiment = current.find((entry) => entry.id === experimentId);
  if (!experiment) {
    return null;
  }

  const normalizedRun = normalizePromptExperimentRunRecord(
    {
      ...run,
      id: run.id ?? `run-${Date.now()}`,
      createdAt: run.createdAt ?? new Date().toISOString(),
    },
    {},
    experiment.runs.length,
  );
  const updatedExperiment = {
    ...experiment,
    runs: [normalizedRun, ...experiment.runs],
    updatedAt: new Date().toISOString(),
  };
  await setPromptExperiments([
    updatedExperiment,
    ...current.filter((entry) => entry.id !== experiment.id),
  ]);
  return updatedExperiment;
}

export async function getTemplatePacks(): Promise<TemplatePack[]> {
  const rawValue = await readLocal<unknown[]>(
    LOCAL_STORAGE_KEYS.templatePacks,
    [],
  );
  return sortByDateDesc(
    safeArray(rawValue).map((entry, index) =>
      normalizeTemplatePackEntry(entry, {}, index),
    ),
    "updatedAt",
  );
}

export async function setTemplatePacks(value: unknown[]): Promise<TemplatePack[]> {
  const normalized = sortByDateDesc(
    safeArray(value).map((entry, index) =>
      normalizeTemplatePackEntry(entry, {}, index),
    ),
    "updatedAt",
  );
  await writeLocal(LOCAL_STORAGE_KEYS.templatePacks, normalized);
  return normalized;
}

export async function saveTemplatePack(
  value: Partial<TemplatePack>,
): Promise<TemplatePack> {
  const current = await getTemplatePacks();
  const now = new Date().toISOString();
  const preferredId =
    typeof value.id === "string" && value.id.trim()
      ? value.id.trim()
      : `pack-${Date.now()}`;
  const existing = current.find((entry) => entry.id === preferredId);
  const pack = normalizeTemplatePackEntry(
    {
      ...(existing ?? {}),
      ...(value ?? {}),
      id: existing?.id ?? ensureUniqueStringId(current, preferredId),
      createdAt: existing?.createdAt ?? value.createdAt ?? now,
      updatedAt: now,
    },
    {},
    0,
  );
  const next = [pack, ...current.filter((entry) => entry.id !== pack.id)];
  await setTemplatePacks(next);
  return pack;
}

export async function getServiceGroups(): Promise<ServiceGroup[]> {
  const rawValue = await readLocal<unknown[]>(
    LOCAL_STORAGE_KEYS.serviceGroups,
    [],
  );
  return safeArray(rawValue)
    .map((entry, index) => normalizeServiceGroup(entry, {}, index))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title));
}

export async function setServiceGroups(value: unknown[]): Promise<ServiceGroup[]> {
  const normalized = safeArray(value)
    .map((entry, index) => normalizeServiceGroup(entry, {}, index))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title));
  await writeLocal(LOCAL_STORAGE_KEYS.serviceGroups, normalized);
  return normalized;
}
