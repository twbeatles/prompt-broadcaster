// @ts-nocheck
import { isKorean, t } from "./i18n";
import { compareDateValues } from "./helpers";

export function getHistorySortOptions() {
  return [
    { value: "latest", label: t.historySortLatest },
    { value: "oldest", label: t.historySortOldest },
    { value: "mostSuccess", label: t.historySortMostSuccess },
    { value: "mostFailure", label: t.historySortMostFailure },
  ];
}

export function getFavoriteSortOptions() {
  return [
    { value: "recentUsed", label: t.favoriteSortRecentUsed },
    { value: "usageCount", label: t.favoriteSortUsageCount },
    { value: "title", label: t.favoriteSortTitle },
    { value: "createdAt", label: t.favoriteSortCreatedAt },
  ];
}

function compareFavoriteTitle(left, right) {
  return String(left?.title ?? "").localeCompare(String(right?.title ?? ""), isKorean ? "ko" : "en", {
    sensitivity: "base",
  });
}

export function sortHistoryItemsForDisplay(items, historySort = "latest") {
  const nextItems = [...items];
  switch (historySort) {
    case "oldest":
      return nextItems.sort((left, right) => compareDateValues(right.createdAt, left.createdAt));
    case "mostSuccess":
      return nextItems.sort((left, right) => {
        const leftCount = Array.isArray(left?.submittedSiteIds) ? left.submittedSiteIds.length : 0;
        const rightCount = Array.isArray(right?.submittedSiteIds) ? right.submittedSiteIds.length : 0;
        return rightCount - leftCount || compareDateValues(left.createdAt, right.createdAt);
      });
    case "mostFailure":
      return nextItems.sort((left, right) => {
        const leftCount = Array.isArray(left?.failedSiteIds) ? left.failedSiteIds.length : 0;
        const rightCount = Array.isArray(right?.failedSiteIds) ? right.failedSiteIds.length : 0;
        return rightCount - leftCount || compareDateValues(left.createdAt, right.createdAt);
      });
    case "latest":
    default:
      return nextItems.sort((left, right) => compareDateValues(left.createdAt, right.createdAt));
  }
}

export function sortFavoriteItemsForDisplay(items, favoriteSort = "recentUsed") {
  const nextItems = [...items];
  nextItems.sort((left, right) => {
    if (left.pinned && !right.pinned) {
      return -1;
    }
    if (!left.pinned && right.pinned) {
      return 1;
    }

    switch (favoriteSort) {
      case "usageCount":
        return (Number(right?.usageCount) || 0) - (Number(left?.usageCount) || 0)
          || compareDateValues(left.lastUsedAt ?? left.favoritedAt, right.lastUsedAt ?? right.favoritedAt);
      case "title":
        return compareFavoriteTitle(left, right) || compareDateValues(left.favoritedAt, right.favoritedAt);
      case "createdAt":
        return compareDateValues(left.createdAt, right.createdAt);
      case "recentUsed":
      default:
        return compareDateValues(left.lastUsedAt ?? left.favoritedAt, right.lastUsedAt ?? right.favoritedAt);
    }
  });
  return nextItems;
}
