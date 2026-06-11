import {
  deleteFavoriteItem,
  duplicateFavoriteItem,
  getPromptFavorites,
  updateFavoriteMeta,
  updateFavoriteTitle,
} from "../../shared/prompts";
import type { FavoritePrompt } from "../../shared/types/models";
import { state } from "../app/state";
import { t } from "../app/i18n";
import { renderFavoritesList } from "./controller/rendering";

interface FavoritesControllerDeps {
  switchTab: (tabId: "compose" | "history" | "favorites" | "settings") => void;
  loadPromptIntoComposer: (item: FavoritePrompt) => void;
  openFavoriteEditor: (item: FavoritePrompt) => void;
  runFavoriteItem: (item: FavoritePrompt) => Promise<void>;
  setStatus: (text: string, type?: string) => void;
  showAppToast: (input: string, type?: string, duration?: number) => void;
  getUnknownErrorText: () => string;
}

export function createFavoritesController(deps: FavoritesControllerDeps) {
  const {
    switchTab,
    loadPromptIntoComposer,
    openFavoriteEditor,
    runFavoriteItem,
    setStatus,
    showAppToast,
    getUnknownErrorText,
  } = deps;

  function getFavoriteById(favoriteId: string): FavoritePrompt | null {
    return state.favorites.find((entry) => String(entry.id) === String(favoriteId)) ?? null;
  }

  function setFavoriteTitleInState(favoriteId: string, title: string): void {
    state.favorites = state.favorites.map((item) =>
      String(item.id) === String(favoriteId)
        ? { ...item, title }
        : item,
    );
  }

  function scheduleFavoriteTitleSave(favoriteId: string, title: string, immediate = false): void {
    const timer = state.favoriteSaveTimers.get(favoriteId);
    if (timer) {
      window.clearTimeout(timer);
    }

    setFavoriteTitleInState(favoriteId, title);

    const runSave = async () => {
      try {
        await updateFavoriteTitle(favoriteId, title);
        setStatus(t.titleSaved, "success");
        showAppToast(t.titleSaved, "success", 1500);
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Failed to save favorite title.", error);
        setStatus(t.error((error as Error)?.message ?? getUnknownErrorText()), "error");
      }
    };

    if (immediate) {
      state.favoriteSaveTimers.delete(favoriteId);
      void runSave();
      return;
    }

    const nextTimer = window.setTimeout(() => {
      state.favoriteSaveTimers.delete(favoriteId);
      void runSave();
    }, 300);

    state.favoriteSaveTimers.set(favoriteId, nextTimer);
  }

  async function handleFavoriteAction(action: string | undefined, favoriteId: string | undefined): Promise<void> {
    const item = favoriteId ? getFavoriteById(favoriteId) : null;

    if (action === "delete-favorite") {
      if (!favoriteId) {
        return;
      }
      await deleteFavoriteItem(favoriteId);
      state.favorites = await getPromptFavorites();
      state.openMenuKey = null;
      renderFavoritesList();
      setStatus(t.favoriteDeleted, "success");
      showAppToast(t.favoriteDeleted, "info", 2200);
      return;
    }

    if (action === "toggle-pin-favorite") {
      if (item && favoriteId) {
        await updateFavoriteMeta(favoriteId, { pinned: !item.pinned });
        state.favorites = await getPromptFavorites();
        state.openMenuKey = null;
        renderFavoritesList();
      }
      return;
    }

    if (action === "edit-favorite") {
      if (item) {
        state.openMenuKey = null;
        renderFavoritesList();
        openFavoriteEditor(item);
      }
      return;
    }

    if (action === "duplicate-favorite") {
      if (!favoriteId) {
        return;
      }
      await duplicateFavoriteItem(favoriteId, t.favoriteDuplicatePrefix);
      state.favorites = await getPromptFavorites();
      state.openMenuKey = null;
      renderFavoritesList();
      setStatus(t.favoriteDuplicated, "success");
      showAppToast(t.favoriteDuplicated, "success", 2200);
      return;
    }

    if (action === "run-favorite" && item) {
      await runFavoriteItem(item);
      renderFavoritesList();
    }
  }

  function handleFavoriteFilterBarClick(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const chip = target?.closest<HTMLElement>("[data-filter-tag],[data-filter-folder],[data-filter-all]");
    if (!chip) {
      return;
    }

    if (chip.dataset.filterAll === "favorites") {
      state.favoritesTagFilter = "";
      state.favoritesFolderFilter = "";
    } else if (chip.dataset.filterTag !== undefined) {
      state.favoritesTagFilter = state.favoritesTagFilter === chip.dataset.filterTag ? "" : chip.dataset.filterTag;
      state.favoritesFolderFilter = "";
    } else if (chip.dataset.filterFolder !== undefined) {
      state.favoritesFolderFilter = state.favoritesFolderFilter === chip.dataset.filterFolder ? "" : chip.dataset.filterFolder;
      state.favoritesTagFilter = "";
    }
    renderFavoritesList();
  }

  function handleFavoritesListClick(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const switchButton = target?.closest("[data-switch-tab='compose']");
    if (switchButton) {
      switchTab("compose");
      return;
    }

    const loadButton = target?.closest<HTMLElement>("[data-load-favorite]");
    if (loadButton) {
      const item = state.favorites.find(
        (entry) => String(entry.id) === String(loadButton.dataset.loadFavorite),
      );
      if (item) {
        loadPromptIntoComposer(item);
      }
      return;
    }

    const editButton = target?.closest<HTMLElement>("[data-edit-favorite]");
    if (editButton) {
      const item = state.favorites.find(
        (entry) => String(entry.id) === String(editButton.dataset.editFavorite),
      );
      if (item) {
        state.openMenuKey = null;
        renderFavoritesList();
        openFavoriteEditor(item);
      }
      return;
    }

    const menuToggle = target?.closest<HTMLElement>("[data-toggle-menu]");
    if (menuToggle) {
      const menuKey = menuToggle.dataset.toggleMenu ?? null;
      state.openMenuKey = state.openMenuKey === menuKey ? null : menuKey;
      renderFavoritesList();
      return;
    }

    const actionButton = target?.closest<HTMLElement>("[data-action][data-favorite-id]");
    if (actionButton) {
      void handleFavoriteAction(
        actionButton.dataset.action,
        actionButton.dataset.favoriteId,
      ).catch((error) => {
        console.error("[AI Prompt Broadcaster] Favorite action failed.", error);
        setStatus(t.error((error as Error)?.message ?? getUnknownErrorText()), "error");
      });
    }
  }

  function handleFavoritesListContextMenu(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const item = target?.closest<HTMLElement>("[data-favorite-id]");
    if (!item) {
      return;
    }

    event.preventDefault();
    state.openMenuKey = `favorite:${item.dataset.favoriteId}`;
    renderFavoritesList();
  }

  function handleFavoritesListInput(event: Event): void {
    const target = event.target instanceof Element ? event.target : null;
    const input = target?.closest<HTMLInputElement>("[data-favorite-title]");
    if (!input) {
      return;
    }

    scheduleFavoriteTitleSave(input.dataset.favoriteTitle ?? "", input.value, false);
  }

  function handleFavoritesListBlur(event: FocusEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const input = target?.closest<HTMLInputElement>("[data-favorite-title]");
    if (!input) {
      return;
    }

    scheduleFavoriteTitleSave(input.dataset.favoriteTitle ?? "", input.value, true);
  }

  return {
    getFavoriteById,
    renderFavoritesList,
    scheduleFavoriteTitleSave,
    handleFavoriteAction,
    handleFavoriteFilterBarClick,
    handleFavoritesListClick,
    handleFavoritesListContextMenu,
    handleFavoritesListInput,
    handleFavoritesListBlur,
  };
}
