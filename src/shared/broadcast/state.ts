import type {
  LastBroadcastSummary,
  PendingBroadcastRecord,
  SiteInjectionResult,
} from "../types/models";
import { buildSiteInjectionResult, normalizeSiteInjectionResult, normalizeResultCode } from "../prompts";

function clonePendingBroadcastRecord(record: PendingBroadcastRecord): PendingBroadcastRecord {
  return {
    ...record,
    siteIds: [...(record.siteIds ?? [])],
    submittedSiteIds: [...(record.submittedSiteIds ?? [])],
    failedSiteIds: [...(record.failedSiteIds ?? [])],
    siteResults: { ...(record.siteResults ?? {}) },
    openedTabIds: [...(record.openedTabIds ?? [])],
  };
}

export function summarizePendingBroadcastStatus(record: PendingBroadcastRecord | null | undefined) {
  if (!record) {
    return "idle";
  }

  if (record.completed < record.total) {
    return "sending";
  }

  if ((record.submittedSiteIds ?? []).length === 0) {
    return "failed";
  }

  if ((record.failedSiteIds ?? []).length > 0) {
    return "partial";
  }

  return "submitted";
}

export function buildPendingBroadcastSummary(
  record: PendingBroadcastRecord,
  overrides: Partial<LastBroadcastSummary> = {},
  now = new Date().toISOString()
): LastBroadcastSummary {
  const status = summarizePendingBroadcastStatus(record);

  return {
    broadcastId: record.id,
    status,
    prompt: record.prompt,
    siteIds: [...(record.siteIds ?? [])],
    total: Number(record.total ?? 0),
    completed: Number(record.completed ?? 0),
    submittedSiteIds: [...(record.submittedSiteIds ?? [])],
    failedSiteIds: [...(record.failedSiteIds ?? [])],
    siteResults: { ...(record.siteResults ?? {}) },
    startedAt: record.startedAt ?? now,
    finishedAt: record.completed >= record.total && status !== "sending" ? now : "",
    ...overrides,
  };
}

export function getUnresolvedPendingBroadcastSiteIds(
  record: PendingBroadcastRecord | null | undefined
) {
  const siteResults = record?.siteResults ?? {};
  return Array.isArray(record?.siteIds)
    ? record.siteIds.filter((siteId) => !siteResults?.[siteId])
    : [];
}

export function applyPendingBroadcastSiteResult(
  record: PendingBroadcastRecord | null | undefined,
  siteId: string,
  resultInput: SiteInjectionResult | string,
  now = new Date().toISOString()
) {
  if (!record) {
    return {
      summary: null,
      nextRecord: null,
      completedRecord: null,
    };
  }

  const normalizedSiteId = typeof siteId === "string" ? siteId.trim() : "";
  if (!normalizedSiteId) {
    return {
      summary: buildPendingBroadcastSummary(record, {}, now),
      nextRecord: clonePendingBroadcastRecord(record),
      completedRecord: null,
    };
  }

  if (record.siteResults?.[normalizedSiteId]) {
    return {
      summary: buildPendingBroadcastSummary(record, {}, now),
      nextRecord: clonePendingBroadcastRecord(record),
      completedRecord: null,
    };
  }

  const nextRecord = clonePendingBroadcastRecord(record);
  const normalizedResult = typeof resultInput === "string"
    ? buildSiteInjectionResult(resultInput)
    : normalizeSiteInjectionResult(resultInput);
  nextRecord.siteResults = {
    ...(nextRecord.siteResults ?? {}),
    [normalizedSiteId]: normalizedResult,
  };
  nextRecord.completed = Object.keys(nextRecord.siteResults).length;

  if (normalizeResultCode(normalizedResult.code) === "submitted") {
    nextRecord.submittedSiteIds = Array.from(
      new Set([...(nextRecord.submittedSiteIds ?? []), normalizedSiteId])
    );
  } else {
    nextRecord.failedSiteIds = Array.from(
      new Set([...(nextRecord.failedSiteIds ?? []), normalizedSiteId])
    );
  }

  nextRecord.status = summarizePendingBroadcastStatus(nextRecord);
  const summary = buildPendingBroadcastSummary(
    nextRecord,
    { finishedAt: nextRecord.status === "sending" ? "" : now },
    now
  );

  if (nextRecord.completed >= nextRecord.total) {
    return {
      summary,
      nextRecord: null,
      completedRecord: nextRecord,
    };
  }

  return {
    summary,
    nextRecord,
    completedRecord: null,
  };
}
