// @ts-nocheck
import {
  getBuiltInSiteOverrides,
  getBuiltInSiteStates,
  getCustomSites,
  setBuiltInSiteOverrides,
  setBuiltInSiteStates,
  setCustomSites,
} from "./sites-store";

export const LOCAL_STORAGE_KEYS = Object.freeze({
  history: "promptHistory",
  favorites: "promptFavorites",
  templateVariableCache: "templateVariableCache",
  settings: "appSettings",
});

export const DEFAULT_HISTORY_LIMIT = 50;
export const MIN_HISTORY_LIMIT = 10;
export const MAX_HISTORY_LIMIT = 200;
export const DEFAULT_SETTINGS = Object.freeze({
  historyLimit: DEFAULT_HISTORY_LIMIT,
  autoClosePopup: false,
  desktopNotifications: true,
});

function safeText(value) {
  return typeof value === "string" ? value : "";
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeSentTo(sentTo) {
  return Array.from(
    new Set(
      safeArray(sentTo)
        .filter((entry) => typeof entry === "string" && entry.trim())
        .map((entry) => entry.trim())
    )
  );
}

function normalizeIsoDate(value, fallback = new Date().toISOString()) {
  if (typeof value !== "string") {
    return fallback;
  }

  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

function normalizeTemplateDefaults(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entryValue]) => [safeText(key).trim(), safeText(entryValue)])
      .filter(([key]) => key)
  );
}

function normalizeBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeHistoryLimit(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_HISTORY_LIMIT;
  }

  return Math.min(
    MAX_HISTORY_LIMIT,
    Math.max(MIN_HISTORY_LIMIT, Math.round(numericValue))
  );
}

function normalizeSettings(value) {
  return {
    historyLimit: normalizeHistoryLimit(value?.historyLimit),
    autoClosePopup: normalizeBoolean(
      value?.autoClosePopup,
      DEFAULT_SETTINGS.autoClosePopup
    ),
    desktopNotifications: normalizeBoolean(
      value?.desktopNotifications,
      DEFAULT_SETTINGS.desktopNotifications
    ),
  };
}

function normalizeStatus(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "submitted";
}

function normalizeStringRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entryValue]) => [safeText(key).trim(), safeText(entryValue).trim()])
      .filter(([key, entryValue]) => key && entryValue)
  );
}

function sortByDateDesc(items, field = "createdAt") {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left[field] ?? "") || 0;
    const rightTime = Date.parse(right[field] ?? "") || 0;
    return rightTime - leftTime;
  });
}

function ensureUniqueNumericId(items, preferredId) {
  let candidate = Number.isFinite(preferredId) ? preferredId : Date.now();
  const usedIds = new Set(items.map((item) => Number(item.id)));

  while (usedIds.has(candidate)) {
    candidate += 1;
  }

  return candidate;
}

function ensureUniqueStringId(items, preferredId) {
  let candidate =
    typeof preferredId === "string" && preferredId.trim()
      ? preferredId.trim()
      : `fav-${Date.now()}`;
  const usedIds = new Set(items.map((item) => String(item.id)));

  while (usedIds.has(candidate)) {
    candidate = `${candidate}-1`;
  }

  return candidate;
}

async function readLocal(key, fallbackValue) {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? fallbackValue;
}

async function writeLocal(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

export function buildHistoryEntry(entry) {
  const createdAt = normalizeIsoDate(entry?.createdAt);

  return {
    id: Number.isFinite(entry?.id) ? Number(entry.id) : Date.now(),
    text: safeText(entry?.text),
    sentTo: normalizeSentTo(entry?.sentTo),
    createdAt,
    status: normalizeStatus(entry?.status),
    siteResults: normalizeStringRecord(entry?.siteResults),
  };
}

export function buildFavoriteEntry(entry) {
  const createdAt = normalizeIsoDate(entry?.createdAt);
  const favoritedAt = normalizeIsoDate(entry?.favoritedAt, createdAt);

  return {
    id:
      typeof entry?.id === "string" && entry.id.trim()
        ? entry.id.trim()
        : `fav-${Date.now()}`,
    sourceHistoryId:
      entry?.sourceHistoryId === null || entry?.sourceHistoryId === undefined
        ? null
        : Number(entry.sourceHistoryId),
    title: safeText(entry?.title),
    text: safeText(entry?.text),
    sentTo: normalizeSentTo(entry?.sentTo),
    createdAt,
    favoritedAt,
    templateDefaults: normalizeTemplateDefaults(entry?.templateDefaults),
  };
}

export async function getAppSettings() {
  const rawSettings = await readLocal(LOCAL_STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  return normalizeSettings(rawSettings);
}

export async function setAppSettings(settings) {
  const normalized = normalizeSettings(settings);
  await writeLocal(LOCAL_STORAGE_KEYS.settings, normalized);
  return normalized;
}

export async function updateAppSettings(partialSettings) {
  const current = await getAppSettings();
  return setAppSettings({
    ...current,
    ...(partialSettings ?? {}),
  });
}

export async function getHistoryLimit() {
  const settings = await getAppSettings();
  return settings.historyLimit;
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

export async function getPromptFavorites() {
  const rawFavorites = await readLocal(LOCAL_STORAGE_KEYS.favorites, []);
  return sortByDateDesc(
    safeArray(rawFavorites).map((item) => buildFavoriteEntry(item))
  , "favoritedAt");
}

export async function setPromptFavorites(favoriteItems) {
  const normalized = sortByDateDesc(
    safeArray(favoriteItems).map((item) => buildFavoriteEntry(item))
  , "favoritedAt");

  await writeLocal(LOCAL_STORAGE_KEYS.favorites, normalized);
  return normalized;
}

export async function getTemplateVariableCache() {
  const rawCache = await readLocal(LOCAL_STORAGE_KEYS.templateVariableCache, {});
  return normalizeTemplateDefaults(rawCache);
}

export async function setTemplateVariableCache(cache) {
  const normalized = normalizeTemplateDefaults(cache);
  await writeLocal(LOCAL_STORAGE_KEYS.templateVariableCache, normalized);
  return normalized;
}

export async function updateTemplateVariableCache(partialCache) {
  const current = await getTemplateVariableCache();
  const next = {
    ...current,
    ...normalizeTemplateDefaults(partialCache),
  };

  await setTemplateVariableCache(next);
  return next;
}

export async function addFavoriteFromHistory(historyItem) {
  const favorites = await getPromptFavorites();
  const sourceHistoryId = Number(historyItem?.id);
  const existing = favorites.find(
    (item) => Number(item.sourceHistoryId) === sourceHistoryId
  );

  if (existing) {
    return existing;
  }

  const createdAt = normalizeIsoDate(historyItem?.createdAt);
  const favorite = buildFavoriteEntry({
    id: ensureUniqueStringId(favorites, `fav-${sourceHistoryId || Date.now()}`),
    sourceHistoryId: Number.isFinite(sourceHistoryId) ? sourceHistoryId : null,
    title: "",
    text: historyItem?.text,
    sentTo: historyItem?.sentTo,
    createdAt,
    favoritedAt: new Date().toISOString(),
    templateDefaults: {},
  });

  await setPromptFavorites([favorite, ...favorites]);
  return favorite;
}

export async function createFavoritePrompt(entry) {
  const favorites = await getPromptFavorites();
  const favorite = buildFavoriteEntry({
    id: ensureUniqueStringId(favorites, entry?.id),
    sourceHistoryId: null,
    title: safeText(entry?.title),
    text: entry?.text,
    sentTo: entry?.sentTo,
    createdAt: entry?.createdAt ?? new Date().toISOString(),
    favoritedAt: new Date().toISOString(),
    templateDefaults: entry?.templateDefaults,
  });

  await setPromptFavorites([favorite, ...favorites]);
  return favorite;
}

export async function updateFavoriteTitle(favoriteId, title) {
  const favorites = await getPromptFavorites();
  const nextFavorites = favorites.map((item) =>
    String(item.id) === String(favoriteId)
      ? { ...item, title: safeText(title) }
      : item
  );

  await setPromptFavorites(nextFavorites);
  return nextFavorites.find((item) => String(item.id) === String(favoriteId)) ?? null;
}

export async function deleteFavoriteItem(favoriteId) {
  const favorites = await getPromptFavorites();
  const nextFavorites = favorites.filter(
    (item) => String(item.id) !== String(favoriteId)
  );

  await setPromptFavorites(nextFavorites);
  return nextFavorites;
}

export async function exportPromptData() {
  const [
    history,
    favorites,
    templateVariableCache,
    settings,
    customSites,
    builtInSiteStates,
    builtInSiteOverrides,
  ] = await Promise.all([
    getPromptHistory(),
    getPromptFavorites(),
    getTemplateVariableCache(),
    getAppSettings(),
    getCustomSites(),
    getBuiltInSiteStates(),
    getBuiltInSiteOverrides(),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    history,
    favorites,
    templateVariableCache,
    settings,
    customSites,
    builtInSiteStates,
    builtInSiteOverrides,
  };
}

export async function importPromptData(jsonString) {
  const parsed = JSON.parse(jsonString);
  const history = safeArray(parsed?.history).map((item) => buildHistoryEntry(item));
  const favorites = safeArray(parsed?.favorites).map((item) =>
    buildFavoriteEntry(item)
  );
  const templateVariableCache = normalizeTemplateDefaults(parsed?.templateVariableCache);
  const importedSettings = normalizeSettings(parsed?.settings ?? DEFAULT_SETTINGS);
  const importedCustomSites = safeArray(parsed?.customSites);
  const importedBuiltInSiteStates = parsed?.builtInSiteStates ?? {};
  const importedBuiltInSiteOverrides = parsed?.builtInSiteOverrides ?? {};
  const historyLimit = importedSettings.historyLimit;

  const normalizedHistory = [];
  for (const item of sortByDateDesc(history).slice(0, historyLimit)) {
    normalizedHistory.push({
      ...item,
      id: ensureUniqueNumericId(normalizedHistory, Number(item.id)),
    });
  }

  const normalizedFavorites = [];
  for (const item of sortByDateDesc(favorites, "favoritedAt")) {
    normalizedFavorites.push({
      ...item,
      id: ensureUniqueStringId(normalizedFavorites, String(item.id)),
    });
  }

  await Promise.all([
    setPromptHistory(normalizedHistory),
    setPromptFavorites(normalizedFavorites),
    setTemplateVariableCache(templateVariableCache),
    setAppSettings(importedSettings),
    setCustomSites(importedCustomSites),
    setBuiltInSiteStates(importedBuiltInSiteStates),
    setBuiltInSiteOverrides(importedBuiltInSiteOverrides),
  ]);

  return {
    history: normalizedHistory,
    favorites: normalizedFavorites,
    templateVariableCache,
    settings: importedSettings,
    customSites: importedCustomSites,
    builtInSiteStates: importedBuiltInSiteStates,
    builtInSiteOverrides: importedBuiltInSiteOverrides,
  };
}
