import { LOCAL_STORAGE_KEYS } from "./constants";
import {
  ensureUniqueNumericId,
  normalizeResultCode,
  normalizeIsoDate,
  normalizeSiteResultsRecord,
  normalizeSiteIdList,
  normalizeStatus,
  safeArray,
  safeText,
  sortByDateDesc,
} from "./normalizers";
import { getHistoryLimit } from "./settings-store";
import { readLocal, writeLocal } from "./storage";
import type { PromptHistoryItem } from "../types/models";

function asHistoryRecord(entry: unknown): Record<string, unknown> {
  return entry && typeof entry === "object" && !Array.isArray(entry)
    ? (entry as Record<string, unknown>)
    : {};
}

export function buildHistoryEntry(entry: unknown): PromptHistoryItem {
  const source = asHistoryRecord(entry);
  const numericId = Number(source.id);
  const createdAt = normalizeIsoDate(source.createdAt);
  const siteResults = normalizeSiteResultsRecord(source.siteResults);
  const siteResultKeys = normalizeSiteIdList(Object.keys(siteResults));
  const derivedSubmittedSiteIds = siteResultKeys.filter(
    (siteId) => normalizeResultCode(siteResults[siteId]?.code) === "submitted"
  );
  const submittedSiteIds = normalizeSiteIdList(
    Array.isArray(source.submittedSiteIds)
      ? source.submittedSiteIds
      : Array.isArray(source.sentTo)
        ? source.sentTo
        : derivedSubmittedSiteIds
  );
  const failedSiteIds = normalizeSiteIdList(
    Array.isArray(source.failedSiteIds)
      ? source.failedSiteIds
      : siteResultKeys.filter((siteId) => normalizeResultCode(siteResults[siteId]?.code) !== "submitted")
  );
  const requestedSiteIds = normalizeSiteIdList(
    Array.isArray(source.requestedSiteIds)
      ? source.requestedSiteIds
      : siteResultKeys.length > 0
        ? siteResultKeys
        : submittedSiteIds
  );

  return {
    id: Number.isFinite(numericId) ? numericId : Date.now(),
    text: safeText(source.text),
    requestedSiteIds,
    submittedSiteIds,
    failedSiteIds,
    sentTo: submittedSiteIds,
    createdAt,
    status: normalizeStatus(source.status),
    siteResults,
  };
}

export async function getPromptHistory(): Promise<PromptHistoryItem[]> {
  const historyLimit = await getHistoryLimit();
  const rawHistory = await readLocal(LOCAL_STORAGE_KEYS.history, []);
  return sortByDateDesc(
    safeArray(rawHistory).map((item) => buildHistoryEntry(item))
  ).slice(0, historyLimit);
}

export async function setPromptHistory(historyItems: unknown[]): Promise<PromptHistoryItem[]> {
  const historyLimit = await getHistoryLimit();
  const normalized = sortByDateDesc(
    safeArray(historyItems).map((item) => buildHistoryEntry(item))
  ).slice(0, historyLimit);

  await writeLocal(LOCAL_STORAGE_KEYS.history, normalized);
  return normalized;
}

export async function appendPromptHistory(entry: unknown): Promise<PromptHistoryItem> {
  const historyLimit = await getHistoryLimit();
  const history = await getPromptHistory();
  const normalized = buildHistoryEntry(entry);
  normalized.id = ensureUniqueNumericId(history, Number(normalized.id));

  const nextHistory = sortByDateDesc([normalized, ...history]).slice(0, historyLimit);

  await setPromptHistory(nextHistory);
  return normalized;
}

export async function deletePromptHistoryItem(historyId: number | string) {
  const history = await getPromptHistory();
  const nextHistory = history.filter((item) => Number(item.id) !== Number(historyId));
  await setPromptHistory(nextHistory);
  return nextHistory;
}

export async function deletePromptHistoryItemsByIds(historyIds: Array<number | string>) {
  const selectedIds = new Set(
    safeArray(historyIds).map((historyId) => Number(historyId)).filter((historyId) => Number.isFinite(historyId))
  );
  const history = await getPromptHistory();
  const nextHistory = history.filter((item) => !selectedIds.has(Number(item.id)));
  await setPromptHistory(nextHistory);
  return nextHistory;
}

export async function deletePromptHistoryItemsBeforeDate(dateValue: string | Date) {
  const cutoffDate = typeof dateValue === "string" || dateValue instanceof Date
    ? new Date(dateValue)
    : new Date("");

  if (!Number.isFinite(cutoffDate.getTime())) {
    return getPromptHistory();
  }

  const cutoffTime = cutoffDate.getTime();
  const history = await getPromptHistory();
  const nextHistory = history.filter((item) => {
    const itemTime = Date.parse(item.createdAt);
    return !Number.isFinite(itemTime) || itemTime >= cutoffTime;
  });
  await setPromptHistory(nextHistory);
  return nextHistory;
}

export async function clearPromptHistory(): Promise<void> {
  await writeLocal(LOCAL_STORAGE_KEYS.history, []);
}
