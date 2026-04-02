import type {
  FailedSelectorRecord,
  LastBroadcastSummary,
  UiToast,
  UiToastAction,
} from "../types/models";
import { normalizeSiteResultsRecord } from "../prompts";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function safeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeIsoDate(value: unknown, fallback = new Date().toISOString()) {
  if (typeof value !== "string") {
    return fallback;
  }

  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

export function normalizeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function normalizeFailedSelectorEntry(entry: unknown): FailedSelectorRecord {
  const source = isPlainObject(entry) ? entry : {};
  return {
    serviceId: safeText(source.serviceId),
    selector: safeText(source.selector),
    source: safeText(source.source),
    timestamp: normalizeIsoDate(source.timestamp),
  };
}

export function normalizeToastAction(action: unknown): UiToastAction {
  const source = isPlainObject(action) ? action : {};
  return {
    id: safeText(source.id) || `action-${Date.now()}`,
    label: safeText(source.label) || "Action",
    variant: safeText(source.variant) || "default",
  };
}

export function normalizeUiToast(entry: unknown): UiToast {
  const source = isPlainObject(entry) ? entry : {};
  return {
    id: safeText(source.id) || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message: safeText(source.message),
    type: safeText(source.type) || "info",
    duration: Number.isFinite(Number(source.duration)) ? Number(source.duration) : 3000,
    createdAt: normalizeIsoDate(source.createdAt),
    actions: normalizeArray(source.actions).map((action) => normalizeToastAction(action)),
    meta: isPlainObject(source.meta)
      ? source.meta
      : {},
  };
}

export function normalizeLastBroadcast(value: unknown): LastBroadcastSummary | null {
  if (!isPlainObject(value)) {
    return null;
  }

  return {
    broadcastId: safeText(value.broadcastId),
    status: safeText(value.status) || "idle",
    prompt: safeText(value.prompt),
    siteIds: normalizeArray(value.siteIds)
      .map((siteId) => safeText(siteId))
      .filter(Boolean),
    total: Number.isFinite(Number(value.total)) ? Number(value.total) : 0,
    completed: Number.isFinite(Number(value.completed)) ? Number(value.completed) : 0,
    submittedSiteIds: normalizeArray(value.submittedSiteIds)
      .map((siteId) => safeText(siteId))
      .filter(Boolean),
    failedSiteIds: normalizeArray(value.failedSiteIds)
      .map((siteId) => safeText(siteId))
      .filter(Boolean),
    siteResults: normalizeSiteResultsRecord(value.siteResults),
    startedAt: normalizeIsoDate(value.startedAt),
    finishedAt: safeText(value.finishedAt) ? normalizeIsoDate(value.finishedAt) : "",
  };
}
