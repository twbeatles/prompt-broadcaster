import { ensureBroadcastTargetSnapshots } from "../broadcast/target-snapshots";
import { LOCAL_STORAGE_KEYS } from "./constants";
import {
  ensureUniqueNumericId,
  normalizeExecutionTrigger,
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
    targetSnapshots: ensureBroadcastTargetSnapshots(
      source.targetSnapshots,
      requestedSiteIds,
      source.text
    ),
    originFavoriteId:
      source.originFavoriteId === null || source.originFavoriteId === undefined
        ? null
        : safeText(source.originFavoriteId).trim() || null,
    chainRunId:
      source.chainRunId === null || source.chainRunId === undefined
        ? null
        : safeText(source.chainRunId).trim() || null,
    chainStepIndex:
      source.chainStepIndex === null || source.chainStepIndex === undefined
        ? null
        : Number.isFinite(Number(source.chainStepIndex))
      ? Math.max(0, Math.round(Number(source.chainStepIndex)))
      : null,
    chainStepCount:
      source.chainStepCount === null || source.chainStepCount === undefined
        ? null
        : Number.isFinite(Number(source.chainStepCount))
      ? Math.max(0, Math.round(Number(source.chainStepCount)))
      : null,
    trigger: normalizeExecutionTrigger(source.trigger),
  };
}

export async function getStoredPromptHistory(): Promise<PromptHistoryItem[]> {
  const rawHistory = await readLocal(LOCAL_STORAGE_KEYS.history, []);
  return sortByDateDesc(
    safeArray(rawHistory).map((item) => buildHistoryEntry(item))
  );
}

export function applyHistoryVisibleLimit(
  historyItems: PromptHistoryItem[],
  historyLimit: number
): PromptHistoryItem[] {
  const normalizedLimit = Number.isFinite(Number(historyLimit))
    ? Math.max(1, Math.round(Number(historyLimit)))
    : 50;
  return safeArray<PromptHistoryItem>(historyItems).slice(0, normalizedLimit);
}

export async function getPromptHistory(): Promise<PromptHistoryItem[]> {
  const historyLimit = await getHistoryLimit();
  const history = await getStoredPromptHistory();
  return applyHistoryVisibleLimit(history, historyLimit);
}

export async function setPromptHistory(historyItems: unknown[]): Promise<PromptHistoryItem[]> {
  const normalized = sortByDateDesc(
    safeArray(historyItems).map((item) => buildHistoryEntry(item))
  );

  await writeLocal(LOCAL_STORAGE_KEYS.history, normalized);
  return normalized;
}

export async function appendPromptHistory(entry: unknown): Promise<PromptHistoryItem> {
  const history = await getStoredPromptHistory();
  const normalized = buildHistoryEntry(entry);
  normalized.id = ensureUniqueNumericId(history, Number(normalized.id));

  const nextHistory = sortByDateDesc([normalized, ...history]);

  await setPromptHistory(nextHistory);
  return normalized;
}

export async function deletePromptHistoryItem(historyId: number | string) {
  const history = await getStoredPromptHistory();
  const nextHistory = history.filter((item) => Number(item.id) !== Number(historyId));
  await setPromptHistory(nextHistory);
  return nextHistory;
}

export async function deletePromptHistoryItemsByIds(historyIds: Array<number | string>) {
  const selectedIds = new Set(
    safeArray(historyIds).map((historyId) => Number(historyId)).filter((historyId) => Number.isFinite(historyId))
  );
  const history = await getStoredPromptHistory();
  const nextHistory = history.filter((item) => !selectedIds.has(Number(item.id)));
  await setPromptHistory(nextHistory);
  return nextHistory;
}

export async function deletePromptHistoryItemsBeforeDate(dateValue: string | Date) {
  const cutoffDate = typeof dateValue === "string" || dateValue instanceof Date
    ? new Date(dateValue)
    : new Date("");

  if (!Number.isFinite(cutoffDate.getTime())) {
    return getStoredPromptHistory();
  }

  const cutoffTime = cutoffDate.getTime();
  const history = await getStoredPromptHistory();
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
