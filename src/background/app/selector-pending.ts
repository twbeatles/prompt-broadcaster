import type { PendingSelectorCheckRecord } from "../../shared/types/models";
import { buildSelectorAlertSignature } from "./selector-alerts";

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMissingEntries(
  value: unknown
): Array<{ field: string; selector: string }> {
  return (Array.isArray(value) ? value : [])
    .map((entry) => ({
      field: normalizeText(entry?.field),
      selector: normalizeText(entry?.selector),
    }))
    .filter((entry) => entry.field || entry.selector);
}

function clonePendingRecords(
  records: Record<string, PendingSelectorCheckRecord> | null | undefined
): Record<string, PendingSelectorCheckRecord> {
  if (!records || typeof records !== "object") {
    return {};
  }

  return Object.entries(records).reduce<Record<string, PendingSelectorCheckRecord>>(
    (accumulator, [key, value]) => {
      const signature = normalizeText(key) || normalizeText(value?.signature);
      const serviceId = normalizeText(value?.serviceId);
      if (!signature || !serviceId) {
        return accumulator;
      }

      const count = Number(value?.count);
      const firstSeenAt = Number(value?.firstSeenAt);
      const lastSeenAt = Number(value?.lastSeenAt);
      const fallbackNow = Date.now();

      accumulator[signature] = {
        serviceId,
        signature,
        missing: Array.isArray(value?.missing)
          ? value.missing.map((entry) => normalizeText(entry)).filter(Boolean)
          : [],
        count: Number.isFinite(count) ? Math.max(1, Math.round(count)) : 1,
        firstSeenAt: Number.isFinite(firstSeenAt) ? firstSeenAt : fallbackNow,
        lastSeenAt: Number.isFinite(lastSeenAt) ? lastSeenAt : fallbackNow,
      };
      return accumulator;
    },
    {}
  );
}

export function clearPendingSelectorChecksForService(
  records: Record<string, PendingSelectorCheckRecord> | null | undefined,
  serviceId: unknown
): Record<string, PendingSelectorCheckRecord> {
  const normalizedServiceId = normalizeText(serviceId);
  if (!normalizedServiceId) {
    return clonePendingRecords(records);
  }

  return Object.fromEntries(
    Object.entries(clonePendingRecords(records)).filter(
      ([, record]) => normalizeText(record?.serviceId) !== normalizedServiceId
    )
  );
}

export function registerPendingSelectorCheck(
  records: Record<string, PendingSelectorCheckRecord> | null | undefined,
  report: {
    siteId?: unknown;
    missing?: Array<{ field?: unknown; selector?: unknown }>;
  } | null | undefined,
  nowMs = Date.now()
): {
  next: Record<string, PendingSelectorCheckRecord>;
  signature: string;
  promoted: boolean;
  record: PendingSelectorCheckRecord | null;
} {
  const siteId = normalizeText(report?.siteId) || "unknown";
  const missingEntries = normalizeMissingEntries(report?.missing);
  const signature = buildSelectorAlertSignature({
    siteId,
    missing: missingEntries,
  });
  const next = clonePendingRecords(records);
  const existing = next[signature];

  if (existing && normalizeText(existing.serviceId) === siteId) {
    const promotedRecord = {
      ...existing,
      count: Math.max(2, Math.round(Number(existing.count) || 1) + 1),
      lastSeenAt: nowMs,
    };
    delete next[signature];
    return {
      next,
      signature,
      promoted: true,
      record: promotedRecord,
    };
  }

  const record: PendingSelectorCheckRecord = {
    serviceId: siteId,
    signature,
    missing: missingEntries.map((entry) =>
      entry.field ? `${entry.field}:${entry.selector}` : entry.selector
    ),
    count: 1,
    firstSeenAt: nowMs,
    lastSeenAt: nowMs,
  };

  next[signature] = record;
  return {
    next,
    signature,
    promoted: false,
    record,
  };
}
