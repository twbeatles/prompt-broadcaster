// @ts-nocheck
import { LOCAL_STORAGE_KEYS } from "./constants";
import {
  ensureUniqueStringId,
  normalizeBoolean,
  normalizeIsoDate,
  normalizeSentTo,
  normalizeTags,
  normalizeTemplateDefaults,
  safeArray,
  safeText,
  sortByDateDesc,
} from "./normalizers";
import { readLocal, writeLocal } from "./storage";

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
    tags: normalizeTags(entry?.tags),
    folder: safeText(entry?.folder).slice(0, 50),
    pinned: normalizeBoolean(entry?.pinned, false),
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
