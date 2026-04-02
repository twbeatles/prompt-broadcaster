// @ts-nocheck
import { LOCAL_STORAGE_KEYS } from "./constants";
import {
  normalizeChainSteps,
  ensureUniqueStringId,
  normalizeFavoriteMode,
  normalizeBoolean,
  normalizeIsoDate,
  normalizeNullableIsoDate,
  normalizeScheduleRepeat,
  normalizeSentTo,
  normalizeTags,
  normalizeTemplateDefaults,
  safeArray,
  safeText,
  sortByDateDesc,
} from "./normalizers";
import { readLocal, writeLocal } from "./storage";

export function buildFavoriteEntry(entry) {
  const text = safeText(entry?.text);
  const sentTo = normalizeSentTo(entry?.sentTo);
  const createdAt = normalizeIsoDate(entry?.createdAt);
  const favoritedAt = normalizeIsoDate(entry?.favoritedAt, createdAt);
  const usageCount = Math.max(0, Math.round(Number(entry?.usageCount) || 0));
  const mode = normalizeFavoriteMode(entry?.mode);
  const steps = mode === "chain"
    ? normalizeChainSteps(entry?.steps, {
        text,
        delayMs: 0,
        targetSiteIds: sentTo,
      })
    : [];

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
    text,
    sentTo,
    createdAt,
    favoritedAt,
    templateDefaults: normalizeTemplateDefaults(entry?.templateDefaults),
    tags: normalizeTags(entry?.tags),
    folder: safeText(entry?.folder).slice(0, 50),
    pinned: normalizeBoolean(entry?.pinned, false),
    usageCount,
    lastUsedAt: normalizeNullableIsoDate(entry?.lastUsedAt),
    mode,
    steps,
    scheduleEnabled: normalizeBoolean(entry?.scheduleEnabled, false),
    scheduledAt: normalizeNullableIsoDate(entry?.scheduledAt),
    scheduleRepeat: normalizeScheduleRepeat(entry?.scheduleRepeat),
  };
}

export async function getPromptFavorites() {
  const rawFavorites = await readLocal(LOCAL_STORAGE_KEYS.favorites, []);
  return sortByDateDesc(
    safeArray(rawFavorites).map((item) => buildFavoriteEntry(item)),
    "favoritedAt"
  );
}

export async function setPromptFavorites(favoriteItems) {
  const normalized = sortByDateDesc(
    safeArray(favoriteItems).map((item) => buildFavoriteEntry(item)),
    "favoritedAt"
  );

  await writeLocal(LOCAL_STORAGE_KEYS.favorites, normalized);
  return normalized;
}

export async function updateFavoriteMeta(favoriteId, { tags, folder, pinned } = {}) {
  const favorites = await getPromptFavorites();
  const nextFavorites = favorites.map((item) => {
    if (String(item.id) !== String(favoriteId)) return item;
    return {
      ...item,
      tags: Array.isArray(tags) ? normalizeTags(tags) : item.tags,
      folder: typeof folder === "string" ? safeText(folder).slice(0, 50) : item.folder,
      pinned: typeof pinned === "boolean" ? pinned : item.pinned,
    };
  });
  await setPromptFavorites(nextFavorites);
  return nextFavorites.find((item) => String(item.id) === String(favoriteId)) ?? null;
}

export async function updateFavoritePrompt(favoriteId, patch = {}) {
  const favorites = await getPromptFavorites();
  const nextFavorites = favorites.map((item) => {
    if (String(item.id) !== String(favoriteId)) {
      return item;
    }

    return buildFavoriteEntry({
      ...item,
      ...(patch ?? {}),
      id: item.id,
      sourceHistoryId: item.sourceHistoryId,
    });
  });

  await setPromptFavorites(nextFavorites);
  return nextFavorites.find((item) => String(item.id) === String(favoriteId)) ?? null;
}

export async function duplicateFavoriteItem(favoriteId, titlePrefix = "[Copy]") {
  const favorites = await getPromptFavorites();
  const source = favorites.find((item) => String(item.id) === String(favoriteId));
  if (!source) {
    return null;
  }

  const duplicated = buildFavoriteEntry({
    ...source,
    id: ensureUniqueStringId(favorites, `${source.id}-copy`),
    title: source.title
      ? `${safeText(titlePrefix).trim() || "[Copy]"} ${source.title}`.trim()
      : (safeText(titlePrefix).trim() || "[Copy]"),
    favoritedAt: new Date().toISOString(),
    usageCount: 0,
    lastUsedAt: null,
    scheduleEnabled: false,
    scheduledAt: null,
  });

  await setPromptFavorites([duplicated, ...favorites]);
  return duplicated;
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
    sentTo:
      Array.isArray(historyItem?.requestedSiteIds) && historyItem.requestedSiteIds.length > 0
        ? historyItem.requestedSiteIds
        : historyItem?.sentTo,
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
    usageCount: entry?.usageCount,
    lastUsedAt: entry?.lastUsedAt,
    mode: entry?.mode,
    steps: entry?.steps,
    scheduleEnabled: entry?.scheduleEnabled,
    scheduledAt: entry?.scheduledAt,
    scheduleRepeat: entry?.scheduleRepeat,
  });

  await setPromptFavorites([favorite, ...favorites]);
  return favorite;
}

export async function markFavoriteUsed(favoriteId) {
  const favorites = await getPromptFavorites();
  const now = new Date().toISOString();
  const nextFavorites = favorites.map((item) =>
    String(item.id) === String(favoriteId)
      ? {
          ...item,
          usageCount: Math.max(0, Math.round(Number(item.usageCount) || 0)) + 1,
          lastUsedAt: now,
        }
      : item
  );

  await setPromptFavorites(nextFavorites);
  return nextFavorites.find((item) => String(item.id) === String(favoriteId)) ?? null;
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
