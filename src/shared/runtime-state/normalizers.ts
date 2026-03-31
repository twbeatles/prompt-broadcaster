// @ts-nocheck
export function safeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeIsoDate(value, fallback = new Date().toISOString()) {
  if (typeof value !== "string") {
    return fallback;
  }

  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

export function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeFailedSelectorEntry(entry) {
  return {
    serviceId: safeText(entry?.serviceId),
    selector: safeText(entry?.selector),
    source: safeText(entry?.source),
    timestamp: normalizeIsoDate(entry?.timestamp),
  };
}

export function normalizeToastAction(action) {
  return {
    id: safeText(action?.id) || `action-${Date.now()}`,
    label: safeText(action?.label) || "Action",
    variant: safeText(action?.variant) || "default",
  };
}

export function normalizeUiToast(entry) {
  return {
    id: safeText(entry?.id) || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message: safeText(entry?.message),
    type: safeText(entry?.type) || "info",
    duration: Number.isFinite(Number(entry?.duration)) ? Number(entry.duration) : 3000,
    createdAt: normalizeIsoDate(entry?.createdAt),
    actions: normalizeArray(entry?.actions).map((action) => normalizeToastAction(action)),
    meta: entry?.meta && typeof entry.meta === "object" && !Array.isArray(entry.meta)
      ? entry.meta
      : {},
  };
}

export function normalizeLastBroadcast(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
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
    siteResults:
      value.siteResults && typeof value.siteResults === "object" && !Array.isArray(value.siteResults)
        ? Object.fromEntries(
            Object.entries(value.siteResults)
              .map(([key, status]) => [safeText(key), safeText(status)])
              .filter(([key, status]) => key && status)
          )
        : {},
    startedAt: normalizeIsoDate(value.startedAt),
    finishedAt: safeText(value.finishedAt) ? normalizeIsoDate(value.finishedAt) : "",
  };
}
