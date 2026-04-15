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
import type {
  ChainStep,
  FavoritePrompt,
  PromptHistoryItem,
} from "../types/models";

export type FavoriteEntryInput = Partial<FavoritePrompt> & {
  id?: string | null;
  sourceHistoryId?: number | null;
};

type FavoriteMetaPatch = {
  tags?: string[];
  folder?: string;
  pinned?: boolean;
};

type FavoritePatch = Partial<FavoritePrompt>;

export function buildFavoriteEntry(entry: unknown): FavoritePrompt {
  const source = (entry ?? {}) as FavoriteEntryInput;
  const text = safeText(source?.text);
  const sentTo = normalizeSentTo(source?.sentTo);
  const createdAt = normalizeIsoDate(source?.createdAt);
  const favoritedAt = normalizeIsoDate(source?.favoritedAt, createdAt);
  const usageCount = Math.max(0, Math.round(Number(source?.usageCount) || 0));
  const mode = normalizeFavoriteMode(source?.mode);
  const steps = mode === "chain"
    ? normalizeChainSteps(source?.steps, {
      text,
      delayMs: 0,
      targetSiteIds: sentTo,
    })
    : [];

  return {
    id:
      typeof source?.id === "string" && source.id.trim()
        ? source.id.trim()
        : `fav-${Date.now()}`,
    sourceHistoryId:
      source?.sourceHistoryId === null || source?.sourceHistoryId === undefined
        ? null
        : Number(source.sourceHistoryId),
    title: safeText(source?.title),
    text,
    sentTo,
    createdAt,
    favoritedAt,
    templateDefaults: normalizeTemplateDefaults(source?.templateDefaults),
    tags: normalizeTags(source?.tags),
    folder: safeText(source?.folder).slice(0, 50),
    pinned: normalizeBoolean(source?.pinned, false),
    usageCount,
    lastUsedAt: normalizeNullableIsoDate(source?.lastUsedAt),
    mode,
    steps,
    scheduleEnabled: normalizeBoolean(source?.scheduleEnabled, false),
    scheduledAt: normalizeNullableIsoDate(source?.scheduledAt),
    scheduleRepeat: normalizeScheduleRepeat(source?.scheduleRepeat),
  };
}

export async function getPromptFavorites(): Promise<FavoritePrompt[]> {
  const rawFavorites = await readLocal<unknown[]>(
    LOCAL_STORAGE_KEYS.favorites,
    [],
  );
  return sortByDateDesc(
    safeArray(rawFavorites).map((item) => buildFavoriteEntry(item as FavoriteEntryInput)),
    "favoritedAt",
  );
}

export async function setPromptFavorites(
  favoriteItems: FavoritePrompt[],
): Promise<FavoritePrompt[]> {
  const normalized = sortByDateDesc(
    safeArray(favoriteItems).map((item) => buildFavoriteEntry(item)),
    "favoritedAt",
  );

  await writeLocal(LOCAL_STORAGE_KEYS.favorites, normalized);
  return normalized;
}

export async function updateFavoriteMeta(
  favoriteId: string,
  { tags, folder, pinned }: FavoriteMetaPatch = {},
): Promise<FavoritePrompt | null> {
  const favorites = await getPromptFavorites();
  const nextFavorites = favorites.map((item) => {
    if (String(item.id) !== String(favoriteId)) {
      return item;
    }
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

export async function updateFavoritePrompt(
  favoriteId: string,
  patch: FavoritePatch = {},
): Promise<FavoritePrompt | null> {
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

export async function duplicateFavoriteItem(
  favoriteId: string,
  titlePrefix = "[Copy]",
): Promise<FavoritePrompt | null> {
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

export async function addFavoriteFromHistory(
  historyItem: PromptHistoryItem,
): Promise<FavoritePrompt> {
  const favorites = await getPromptFavorites();
  const sourceHistoryId = Number(historyItem?.id);
  const existing = favorites.find(
    (item) => Number(item.sourceHistoryId) === sourceHistoryId,
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

export async function createFavoritePrompt(
  entry: Partial<FavoritePrompt>,
): Promise<FavoritePrompt> {
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
    steps: entry?.steps as ChainStep[] | undefined,
    scheduleEnabled: entry?.scheduleEnabled,
    scheduledAt: entry?.scheduledAt,
    scheduleRepeat: entry?.scheduleRepeat,
  });

  await setPromptFavorites([favorite, ...favorites]);
  return favorite;
}

export async function markFavoriteUsed(
  favoriteId: string,
): Promise<FavoritePrompt | null> {
  const favorites = await getPromptFavorites();
  const now = new Date().toISOString();
  const nextFavorites = favorites.map((item) =>
    String(item.id) === String(favoriteId)
      ? {
        ...item,
        usageCount: Math.max(0, Math.round(Number(item.usageCount) || 0)) + 1,
        lastUsedAt: now,
      }
      : item,
  );

  await setPromptFavorites(nextFavorites);
  return nextFavorites.find((item) => String(item.id) === String(favoriteId)) ?? null;
}

export async function updateFavoriteTitle(
  favoriteId: string,
  title: string,
): Promise<FavoritePrompt | null> {
  const favorites = await getPromptFavorites();
  const nextFavorites = favorites.map((item) =>
    String(item.id) === String(favoriteId)
      ? { ...item, title: safeText(title) }
      : item,
  );

  await setPromptFavorites(nextFavorites);
  return nextFavorites.find((item) => String(item.id) === String(favoriteId)) ?? null;
}

export async function deleteFavoriteItem(
  favoriteId: string,
): Promise<FavoritePrompt[]> {
  const favorites = await getPromptFavorites();
  const nextFavorites = favorites.filter(
    (item) => String(item.id) !== String(favoriteId),
  );

  await setPromptFavorites(nextFavorites);
  return nextFavorites;
}
