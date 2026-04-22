import { updateAppSettings } from "../../../../shared/prompts";
import type { PopupState } from "../../../../shared/types/popup";
import { popupDom } from "../../dom";
import { t } from "../../i18n";
import { state } from "../../state";
import {
  getEventElement,
  getEventInput,
  getEventSelect,
} from "../helpers";
import type { PopupEventDeps } from "./deps";

const { historySearchInput, historySortSelect, historyList } = popupDom.history;
const { favoritesSearchInput, favoritesSortSelect, favoritesList } = popupDom.favorites;

export function bindListEvents(deps: PopupEventDeps) {
  historySearchInput.addEventListener("input", (event) => {
    const target = getEventInput(event.target);
    if (!target) {
      return;
    }

    state.historySearch = target.value;
    deps.lists.renderHistoryList();
  });

  historySortSelect.addEventListener("change", (event) => {
    const target = getEventSelect(event.target);
    if (!target) {
      return;
    }

    const nextValue = target.value as PopupState["settings"]["historySort"];
    state.settings = {
      ...state.settings,
      historySort: nextValue,
    };
    deps.lists.renderHistoryList();
    void updateAppSettings({ historySort: nextValue }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save history sort.", error);
      deps.status.setStatus(t.error(deps.status.getErrorMessage(error)), "error");
    });
  });

  favoritesSearchInput.addEventListener("input", (event) => {
    const target = getEventInput(event.target);
    if (!target) {
      return;
    }

    state.favoritesSearch = target.value;
    deps.lists.renderFavoritesList();
  });

  favoritesSortSelect.addEventListener("change", (event) => {
    const target = getEventSelect(event.target);
    if (!target) {
      return;
    }

    const nextValue = target.value as PopupState["settings"]["favoriteSort"];
    state.settings = {
      ...state.settings,
      favoriteSort: nextValue,
    };
    deps.lists.renderFavoritesList();
    void updateAppSettings({ favoriteSort: nextValue }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save favorite sort.", error);
      deps.status.setStatus(t.error(deps.status.getErrorMessage(error)), "error");
    });
  });

  document
    .querySelector<HTMLElement>("[data-panel='favorites']")
    ?.addEventListener("click", (event: MouseEvent) => {
      deps.lists.favoritesController.handleFavoriteFilterBarClick(event);
    });

  historyList.addEventListener("click", (event: MouseEvent) => {
    deps.lists.historyController.handleHistoryListClick(event);
  });

  historyList.addEventListener("contextmenu", (event: MouseEvent) => {
    deps.lists.historyController.handleHistoryListContextMenu(event);
  });

  favoritesList.addEventListener("click", (event: MouseEvent) => {
    deps.lists.favoritesController.handleFavoritesListClick(event);
  });

  favoritesList.addEventListener("contextmenu", (event: MouseEvent) => {
    deps.lists.favoritesController.handleFavoritesListContextMenu(event);
  });

  favoritesList.addEventListener("input", (event) => {
    deps.lists.favoritesController.handleFavoritesListInput(event);
  });

  favoritesList.addEventListener(
    "blur",
    (event) => {
      deps.lists.favoritesController.handleFavoritesListBlur(event);
    },
    true,
  );

  document.addEventListener("click", (event) => {
    if (!state.openMenuKey) {
      return;
    }

    const insideMenu = getEventElement(event.target)?.closest(".prompt-actions");
    if (!insideMenu) {
      state.openMenuKey = null;
      deps.lists.renderLists();
    }
  });
}
