export const LOCAL_RUNTIME_KEYS = Object.freeze({
  failedSelectors: "failedSelectors",
  onboardingCompleted: "onboardingCompleted",
});

export const SESSION_RUNTIME_KEYS = Object.freeze({
  pendingUiToasts: "pendingUiToasts",
  lastBroadcast: "lastBroadcast",
});

function safeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeIsoDate(value, fallback = new Date().toISOString()) {
  if (typeof value !== "string") {
    return fallback;
  }

  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeFailedSelectorEntry(entry) {
  return {
    serviceId: safeText(entry?.serviceId),
    selector: safeText(entry?.selector),
    source: safeText(entry?.source),
    timestamp: normalizeIsoDate(entry?.timestamp),
  };
}

function normalizeToastAction(action) {
  return {
    id: safeText(action?.id) || `action-${Date.now()}`,
    label: safeText(action?.label) || "Action",
    variant: safeText(action?.variant) || "default",
  };
}

function normalizeUiToast(entry) {
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

function normalizeLastBroadcast(value) {
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

async function readStorage(area, key, fallbackValue) {
  const result = await chrome.storage[area].get(key);
  return result[key] ?? fallbackValue;
}

async function writeStorage(area, key, value) {
  await chrome.storage[area].set({ [key]: value });
}

export async function getFailedSelectors() {
  const rawValue = await readStorage("local", LOCAL_RUNTIME_KEYS.failedSelectors, []);
  return normalizeArray(rawValue)
    .map((entry) => normalizeFailedSelectorEntry(entry))
    .filter((entry) => entry.serviceId);
}

export async function setFailedSelectors(entries) {
  const normalized = normalizeArray(entries)
    .map((entry) => normalizeFailedSelectorEntry(entry))
    .filter((entry) => entry.serviceId);
  await writeStorage("local", LOCAL_RUNTIME_KEYS.failedSelectors, normalized);
  return normalized;
}

export async function markFailedSelector(serviceId, selector = "", source = "injector") {
  const normalizedServiceId = safeText(serviceId);
  if (!normalizedServiceId) {
    return [];
  }

  const current = await getFailedSelectors();
  const next = [
    {
      serviceId: normalizedServiceId,
      selector: safeText(selector),
      source: safeText(source),
      timestamp: new Date().toISOString(),
    },
    ...current.filter((entry) => entry.serviceId !== normalizedServiceId),
  ];

  return setFailedSelectors(next);
}

export async function clearFailedSelector(serviceId) {
  const normalizedServiceId = safeText(serviceId);
  const current = await getFailedSelectors();
  const next = current.filter((entry) => entry.serviceId !== normalizedServiceId);
  await setFailedSelectors(next);
  return next;
}

export async function getOnboardingCompleted() {
  const value = await readStorage("local", LOCAL_RUNTIME_KEYS.onboardingCompleted, false);
  return normalizeBoolean(value, false);
}

export async function setOnboardingCompleted(completed) {
  const normalized = normalizeBoolean(completed, false);
  await writeStorage("local", LOCAL_RUNTIME_KEYS.onboardingCompleted, normalized);
  return normalized;
}

export async function getPendingUiToasts() {
  const rawValue = await readStorage("session", SESSION_RUNTIME_KEYS.pendingUiToasts, []);
  return normalizeArray(rawValue).map((entry) => normalizeUiToast(entry));
}

export async function setPendingUiToasts(entries) {
  const normalized = normalizeArray(entries).map((entry) => normalizeUiToast(entry));
  await writeStorage("session", SESSION_RUNTIME_KEYS.pendingUiToasts, normalized);
  return normalized;
}

export async function enqueueUiToast(entry) {
  const current = await getPendingUiToasts();
  const next = [...current, normalizeUiToast(entry)].slice(-20);
  await setPendingUiToasts(next);
  return next;
}

export async function drainPendingUiToasts() {
  const current = await getPendingUiToasts();
  await setPendingUiToasts([]);
  return current;
}

export async function getLastBroadcast() {
  const value = await readStorage("session", SESSION_RUNTIME_KEYS.lastBroadcast, null);
  return normalizeLastBroadcast(value);
}

export async function setLastBroadcast(broadcast) {
  const normalized = normalizeLastBroadcast(broadcast);
  await writeStorage("session", SESSION_RUNTIME_KEYS.lastBroadcast, normalized);
  return normalized;
}
