import { popupDom } from "../dom";
import { escapeAttribute, escapeHtml } from "../helpers";
import { getFavoriteSortOptions, getHistorySortOptions } from "../sorting";
import { state } from "../state";

const { historySortSelect } = popupDom.history;
const { favoritesSortSelect } = popupDom.favorites;

export function renderSortControls() {
  historySortSelect.innerHTML = getHistorySortOptions()
    .map(
      (option) =>
        `<option value="${escapeAttribute(option.value)}">${escapeHtml(option.label)}</option>`,
    )
    .join("");
  favoritesSortSelect.innerHTML = getFavoriteSortOptions()
    .map(
      (option) =>
        `<option value="${escapeAttribute(option.value)}">${escapeHtml(option.label)}</option>`,
    )
    .join("");

  historySortSelect.value = state.settings.historySort;
  favoritesSortSelect.value = state.settings.favoriteSort;
}
