// @ts-nocheck
import { LOCAL_STORAGE_KEYS } from "./constants";
import {
  ensureUniqueNumericId,
  normalizeIsoDate,
  normalizeSiteIdList,
  normalizeStatus,
  normalizeStringRecord,
  safeArray,
  safeText,
  sortByDateDesc,
} from "./normalizers";
import { getHistoryLimit } from "./settings-store";
import { readLocal, writeLocal } from "./storage";

export function buildHistoryEntry(entry) {
  const createdAt = normalizeIsoDate(entry?.createdAt);
  const siteResults = normalizeStringRecord(entry?.siteResults);
  const siteResultKeys = normalizeSiteIdList(Object.keys(siteResults));
  const submittedSiteIds = normalizeSiteIdList(
    Array.isArray(entry?.submittedSiteIds) ? entry.submittedSiteIds : entry?.sentTo
  );
  const failedSiteIds = normalizeSiteIdList(
    Array.isArray(entry?.failedSiteIds)
      ? entry.failedSiteIds
      : siteResultKeys.filter((siteId) => !submittedSiteIds.includes(siteId))
  );
  const requestedSiteIds = normalizeSiteIdList(
    Array.isArray(entry?.requestedSiteIds)
      ? entry.requestedSiteIds
      : siteResultKeys.length > 0
        ? siteResultKeys
        : submittedSiteIds
  );

  return {
    id: Number.isFinite(entry?.id) ? Number(entry.id) : Date.now(),
    text: safeText(entry?.text),
    requestedSiteIds,
    submittedSiteIds,
    failedSiteIds,
    sentTo: submittedSiteIds,
    createdAt,
    status: normalizeStatus(entry?.status),
    siteResults,
  };
}

export async function getPromptHistory() {
  const historyLimit = await getHistoryLimit();
  const rawHistory = await readLocal(LOCAL_STORAGE_KEYS.history, []);
  return sortByDateDesc(
    safeArray(rawHistory).map((item) => buildHistoryEntry(item))
  ).slice(0, historyLimit);
}

export async function setPromptHistory(historyItems) {
  const historyLimit = await getHistoryLimit();
  const normalized = sortByDateDesc(
    safeArray(historyItems).map((item) => buildHistoryEntry(item))
  ).slice(0, historyLimit);

  await writeLocal(LOCAL_STORAGE_KEYS.history, normalized);
  return normalized;
}

export async function appendPromptHistory(entry) {
  const historyLimit = await getHistoryLimit();
  const history = await getPromptHistory();
  const normalized = buildHistoryEntry(entry);
  normalized.id = ensureUniqueNumericId(history, Number(normalized.id));

  const nextHistory = sortByDateDesc([normalized, ...history]).slice(0, historyLimit);

  await setPromptHistory(nextHistory);
  return normalized;
}

export async function deletePromptHistoryItem(historyId) {
  const history = await getPromptHistory();
  const nextHistory = history.filter((item) => Number(item.id) !== Number(historyId));
  await setPromptHistory(nextHistory);
  return nextHistory;
}

export async function clearPromptHistory() {
  await writeLocal(LOCAL_STORAGE_KEYS.history, []);
}
