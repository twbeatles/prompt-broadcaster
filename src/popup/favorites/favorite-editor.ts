import type { FavoritePrompt } from "../../shared/types/models";
import { popupDom } from "../app/dom";
import { t } from "../app/i18n";
import { state } from "../app/state";
import { createFavoriteEditorEvents } from "./editor-events";
import { createFavoriteEditorPersistence } from "./editor-persist";
import { createFavoriteEditorRenderer } from "./editor-render";
import {
  buildFavoriteEditorStateFromItem,
  getFavoriteById,
} from "./editor-state";
import type {
  FavoriteEditorFeatureDeps,
  FavoriteEditorSeed,
} from "./editor-types";

const { promptInput } = popupDom.compose;
const {
  favoriteModal,
  favoriteTitleInput,
  favoriteModalError,
  favoriteSaveDefaults,
  favoriteSaveDefaultsRow,
  favoriteDefaultFieldsWrap,
  favoriteDefaultFields,
  favoritePromptInput,
} = popupDom.modals;

export function createFavoriteEditorFeature(deps: FavoriteEditorFeatureDeps) {
  const {
    checkedSiteIds,
    getEnabledSites,
    getRuntimeSiteLabel,
    refreshStoredData,
    requestFavoriteRun,
    setStatus,
    showAppToast,
    getUnknownErrorText,
    openOverlay,
    closeOverlay,
  } = deps;

  const {
    setFavoriteModalError,
    renderFavoriteDefaultFields,
    syncFavoriteVariableUi,
    renderFavoriteModal,
  } = createFavoriteEditorRenderer({
    getEnabledSites,
    getRuntimeSiteLabel,
  });

  const { persistFavoriteEditorChanges } = createFavoriteEditorPersistence({
    refreshStoredData,
    setFavoriteModalError,
  });

  function clearStatus(): void {
    setStatus("");
  }

  function hideFavoriteModal(): void {
    state.pendingFavoriteSave = null;
    state.pendingFavoriteRunReason = "";
    closeOverlay(favoriteModal);
    favoriteModalError.hidden = true;
    favoriteModalError.textContent = "";
    favoriteTitleInput.value = "";
    favoriteSaveDefaults.checked = false;
    favoriteSaveDefaultsRow.hidden = true;
    favoriteDefaultFieldsWrap.hidden = true;
    favoriteDefaultFields.innerHTML = "";
    favoritePromptInput.value = "";
  }

  function dismissFavoriteModal(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    hideFavoriteModal();
  }

  async function openFavoriteModal(): Promise<void> {
    clearStatus();
    const prompt = promptInput.value.trim();

    if (!prompt) {
      setStatus(t.warnEmpty, "error");
      promptInput.focus();
      return;
    }

    const loadedFavorite = state.loadedFavoriteId
      ? getFavoriteById(state.loadedFavoriteId)
      : null;
    const currentItem: FavoriteEditorSeed = loadedFavorite
      ? {
        ...loadedFavorite,
        text: prompt,
        sentTo: checkedSiteIds(),
        templateDefaults: state.loadedTemplateDefaults,
      }
      : {
        id: state.loadedFavoriteId || null,
        title: state.loadedFavoriteTitle,
        text: prompt,
        sentTo: checkedSiteIds(),
        templateDefaults: state.loadedTemplateDefaults,
        tags: [],
        folder: "",
        pinned: false,
        mode: "single",
        steps: [],
        scheduleEnabled: false,
        scheduledAt: null,
        scheduleRepeat: "none",
      };

    state.pendingFavoriteSave = buildFavoriteEditorStateFromItem(currentItem);
    setFavoriteModalError("");
    state.pendingFavoriteRunReason = "";
    renderFavoriteModal();
    openOverlay(favoriteModal, favoriteTitleInput);
    window.requestAnimationFrame(() => favoriteTitleInput.select());
  }

  function openFavoriteEditor(
    item: FavoritePrompt,
    options: { reason?: string } = {},
  ): void {
    state.pendingFavoriteSave = buildFavoriteEditorStateFromItem(item);
    state.pendingFavoriteRunReason = options.reason || "";
    setFavoriteModalError(options.reason || "");
    renderFavoriteModal();
    openOverlay(favoriteModal, favoriteTitleInput);
  }

  async function confirmFavoriteSave(): Promise<void> {
    const favorite = await persistFavoriteEditorChanges();
    if (!favorite) {
      return;
    }

    hideFavoriteModal();
    setStatus(t.favoriteSaved, "success");
    showAppToast(t.favoriteSaved, "success", 2200);
  }

  async function runFavoriteItem(
    item: FavoritePrompt,
    options: { reason?: string } = {},
  ): Promise<void> {
    if (!item.id) {
      return;
    }

    const response = await requestFavoriteRun(item, {
      trigger: "popup",
      allowPopupFallback: false,
    });

    if (response.ok) {
      state.openMenuKey = null;
      const message = response.message ?? t.favoriteRunQueued;
      setStatus(message, "success");
      showAppToast(message, "success", 2200);
      return;
    }

    if (response.requiresPopupInput) {
      state.openMenuKey = null;
      openFavoriteEditor(item, {
        reason: response.error || options.reason || t.favoriteRunNeedsEditor,
      });
      return;
    }

    throw new Error(response.error ?? getUnknownErrorText());
  }

  async function runFavoriteFromEditor(): Promise<void> {
    const favorite = await persistFavoriteEditorChanges();
    if (!favorite?.id) {
      return;
    }

    const response = await requestFavoriteRun(favorite, {
      trigger: "popup",
      allowPopupFallback: false,
    });

    if (response.ok) {
      hideFavoriteModal();
      const message = response.message ?? t.favoriteRunQueued;
      setStatus(message, "success");
      showAppToast(message, "success", 2200);
      return;
    }

    if (response.requiresPopupInput) {
      setFavoriteModalError(response.error ?? t.favoriteRunNeedsEditor);
      return;
    }

    setFavoriteModalError(response.error ?? getUnknownErrorText());
  }

  const { bindFavoriteEditorEvents } = createFavoriteEditorEvents({
    dismissFavoriteModal,
    renderFavoriteModal,
    renderFavoriteDefaultFields,
    syncFavoriteVariableUi,
    confirmFavoriteSave,
    runFavoriteFromEditor,
    setFavoriteModalError,
    getUnknownErrorText,
  });

  return {
    getFavoriteById,
    setFavoriteModalError,
    hideFavoriteModal,
    dismissFavoriteModal,
    openFavoriteModal,
    openFavoriteEditor,
    confirmFavoriteSave,
    runFavoriteItem,
    runFavoriteFromEditor,
    bindFavoriteEditorEvents,
  };
}
