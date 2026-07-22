import type { PendingSelectorCheckRecord } from "../../shared/types/models";
import {
  buildSelectorAlertSignature,
  SELECTOR_ALERT_PROMOTE_THRESHOLD,
} from "./selector-alerts";

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
        promoted: Boolean(value?.promoted),
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

/**
 * Track proactive selector misses per site.
 * - Strikes accumulate under a site-level signature.
 * - Promotion happens once the count reaches SELECTOR_ALERT_PROMOTE_THRESHOLD.
 * - After promotion the record is kept so later misses do not re-promote.
 */
export function registerPendingSelectorCheck(
  records: Record<string, PendingSelectorCheckRecord> | null | undefined,
  report: {
    siteId?: unknown;
    missing?: Array<{ field?: unknown; selector?: unknown }>;
  } | null | undefined,
  nowMs = Date.now(),
  promoteThreshold = SELECTOR_ALERT_PROMOTE_THRESHOLD
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
  const threshold = Math.max(2, Math.round(Number(promoteThreshold) || SELECTOR_ALERT_PROMOTE_THRESHOLD));
  const missingLabels = missingEntries.map((entry) =>
    entry.field ? `${entry.field}:${entry.selector}` : entry.selector
  );

  if (existing && normalizeText(existing.serviceId) === siteId) {
    const nextCount = Math.max(1, Math.round(Number(existing.count) || 1) + 1);
    const alreadyPromoted = Boolean(existing.promoted);
    const shouldPromote = !alreadyPromoted && nextCount >= threshold;

    const updatedRecord: PendingSelectorCheckRecord = {
      ...existing,
      missing: missingLabels.length > 0 ? missingLabels : existing.missing,
      count: nextCount,
      lastSeenAt: nowMs,
      promoted: alreadyPromoted || shouldPromote,
    };

    next[signature] = updatedRecord;
    return {
      next,
      signature,
      promoted: shouldPromote,
      record: updatedRecord,
    };
  }

  const initialCount = 1;
  const shouldPromote = initialCount >= threshold;
  const record: PendingSelectorCheckRecord = {
    serviceId: siteId,
    signature,
    missing: missingLabels,
    count: initialCount,
    firstSeenAt: nowMs,
    lastSeenAt: nowMs,
    promoted: shouldPromote,
  };

  next[signature] = record;
  return {
    next,
    signature,
    promoted: shouldPromote,
    record,
  };
}
