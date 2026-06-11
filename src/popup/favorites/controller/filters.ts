import type { FavoritePrompt } from "../../../shared/types/models";
import { matchesFavoriteSearch } from "../../../shared/prompts/search";
import { popupDom } from "../../app/dom";
import { escapeAttribute, escapeHtml } from "../../app/helpers";
import { msg } from "../../app/i18n";
import { sortFavoriteItemsForDisplay } from "../../app/sorting";
import { state } from "../../app/state";

const { favoritesList } = popupDom.favorites;

function getUniqueFavoriteTags(): string[] {
  const tagSet = new Set<string>();
  state.favorites.forEach((item) => {
    (item.tags ?? []).forEach((tag) => tagSet.add(tag));
  });
  return [...tagSet].sort();
}

function getUniqueFavoriteFolders(): string[] {
  const folderSet = new Set<string>();
  state.favorites.forEach((item) => {
    if (item.folder && item.folder.trim()) {
      folderSet.add(item.folder.trim());
    }
  });
  return [...folderSet].sort();
}

export function renderFavoritesFilterBar(): void {
  const tags = getUniqueFavoriteTags();
  const folders = getUniqueFavoriteFolders();

  if (tags.length === 0 && folders.length === 0) {
    document.getElementById("favorites-filter-bar")?.remove();
    return;
  }

  let bar = document.getElementById("favorites-filter-bar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "favorites-filter-bar";
    bar.className = "favorites-filter-bar";
    favoritesList.parentElement?.insertBefore(bar, favoritesList);
  }

  const allLabel = msg("popup_favorite_filter_all") || "All";
  const activeTag = state.favoritesTagFilter;
  const activeFolder = state.favoritesFolderFilter;

  bar.innerHTML = `
    <div class="filter-chips">
      <button class="filter-chip${!activeTag && !activeFolder ? " active" : ""}" data-filter-all="favorites">${escapeHtml(allLabel)}</button>
      ${folders.map((folder) => `<button class="filter-chip folder-chip${activeFolder === folder ? " active" : ""}" data-filter-folder="${escapeAttribute(folder)}">📁 ${escapeHtml(folder)}</button>`).join("")}
      ${tags.map((tag) => `<button class="filter-chip tag-chip${activeTag === tag ? " active" : ""}" data-filter-tag="${escapeAttribute(tag)}">#${escapeHtml(tag)}</button>`).join("")}
    </div>
  `;
}

export function filterFavoriteItems(items: FavoritePrompt[]): FavoritePrompt[] {
  let filtered = items.filter((item) => matchesFavoriteSearch(item, state.favoritesSearch));
  if (state.favoritesTagFilter) {
    filtered = filtered.filter((item) => (item.tags ?? []).includes(state.favoritesTagFilter));
  }
  if (state.favoritesFolderFilter) {
    filtered = filtered.filter((item) => (item.folder ?? "").trim() === state.favoritesFolderFilter);
  }
  return sortFavoriteItemsForDisplay(filtered, state.settings.favoriteSort);
}
