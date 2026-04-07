import { safeText } from "./normalizers";

interface FavoriteSearchTarget {
  title?: unknown;
  text?: unknown;
  folder?: unknown;
  tags?: unknown;
}

function normalizeSearchValue(value: unknown) {
  return safeText(value).trim().toLowerCase();
}

export function matchesFavoriteSearch(item: FavoriteSearchTarget | null | undefined, query: unknown) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) {
    return true;
  }

  const tags = Array.isArray(item?.tags)
    ? item.tags.map((tag) => safeText(tag).trim()).filter(Boolean)
    : [];
  const values = [
    item?.title,
    item?.text,
    item?.folder,
    ...tags,
    ...tags.map((tag) => `#${tag}`),
  ];

  return values.some((value) => normalizeSearchValue(value).includes(normalizedQuery));
}
