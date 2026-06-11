import {
  getActiveFavoriteRunJobByFavoriteId,
  getLatestFavoriteRunJobByFavoriteId,
} from "../../../shared/runtime-state";
import { popupDom } from "../../app/dom";
import { buildEmptyState, buildFavoriteItemMarkup } from "../../app/list-markup";
import { t } from "../../app/i18n";
import { state } from "../../app/state";
import { filterFavoriteItems, renderFavoritesFilterBar } from "./filters";

const { favoritesList } = popupDom.favorites;

export function renderFavoritesList(): void {
  renderFavoritesFilterBar();
  const items = filterFavoriteItems(state.favorites);

  if (items.length === 0) {
    favoritesList.innerHTML = buildEmptyState(
      state.favoritesSearch || state.favoritesTagFilter || state.favoritesFolderFilter
        ? t.noSearchResults
        : t.favoritesEmpty,
    );
    return;
  }

  favoritesList.innerHTML = items
    .map((item) => buildFavoriteItemMarkup(item, {
      openMenuKey: state.openMenuKey,
      runtimeSites: state.runtimeSites,
      latestJob:
        getActiveFavoriteRunJobByFavoriteId(state.favoriteJobs, item.id)
        ?? getLatestFavoriteRunJobByFavoriteId(state.favoriteJobs, item.id),
    }))
    .join("");
}
