import {
  createFavoritePrompt,
  updateFavoritePrompt,
  updateTemplateVariableCache,
} from "../../shared/prompts";
import type { FavoritePrompt } from "../../shared/types/models";
import { popupDom } from "../app/dom";
import { t } from "../app/i18n";
import { state } from "../app/state";
import {
  compactVariableValues,
  createFavoriteEditorStep,
  mergeTemplateSources,
  syncFavoriteEditorVariables,
  toIsoDateTime,
} from "./editor-state";

const {
  favoriteModeSelect,
  favoritePromptInput,
  favoriteTagsInput,
  favoriteFolderInput,
  favoritePinnedInput,
  favoriteScheduleEnabled,
  favoriteScheduledAtInput,
  favoriteScheduleRepeatSelect,
  favoriteSaveDefaults,
  favoriteTitleInput,
} = popupDom.modals;

interface FavoriteEditorPersistenceDeps {
  refreshStoredData: () => Promise<void>;
  setFavoriteModalError: (message?: string) => void;
}

export function createFavoriteEditorPersistence(
  deps: FavoriteEditorPersistenceDeps,
) {
  const { refreshStoredData, setFavoriteModalError } = deps;

  async function persistFavoriteEditorChanges(): Promise<FavoritePrompt | null> {
    const modalState = state.pendingFavoriteSave;
    if (!modalState) {
      return null;
    }

    modalState.title = favoriteTitleInput.value.trim();
    modalState.mode = favoriteModeSelect.value === "chain" ? "chain" : "single";
    if (modalState.mode === "single") {
      modalState.prompt = favoritePromptInput.value;
    }
    modalState.tags = favoriteTagsInput.value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    modalState.folder = favoriteFolderInput.value.trim();
    modalState.pinned = favoritePinnedInput.checked;
    modalState.scheduleEnabled = favoriteScheduleEnabled.checked;
    modalState.scheduledAt = modalState.scheduleEnabled
      ? toIsoDateTime(favoriteScheduledAtInput.value)
      : null;
    modalState.scheduleRepeat = favoriteScheduleRepeatSelect.value === "daily"
      || favoriteScheduleRepeatSelect.value === "weekday"
      || favoriteScheduleRepeatSelect.value === "weekly"
      ? favoriteScheduleRepeatSelect.value
      : "none";
    modalState.saveDefaults = favoriteSaveDefaults.checked;
    syncFavoriteEditorVariables(modalState);

    if (modalState.scheduleEnabled && !modalState.scheduledAt) {
      setFavoriteModalError(t.favoriteScheduleDateRequired);
      return null;
    }

    if (modalState.mode === "chain") {
      modalState.steps = modalState.steps
        .map((step) =>
          createFavoriteEditorStep(
            step.text,
            step.targetSiteIds,
            step.delayMs,
            step.id,
            step.failurePolicy,
            step.targetMode,
            step.templateDefaults,
          ))
        .filter((step) => step.text.trim());

      if (modalState.steps.length === 0) {
        setFavoriteModalError(t.favoriteChainNeedsStep);
        return null;
      }
    } else if (!modalState.prompt.trim()) {
      setFavoriteModalError(t.warnEmpty);
      return null;
    }

    const templateDefaults = modalState.saveDefaults
      ? compactVariableValues(modalState.defaultValues)
      : {};

    if (modalState.saveDefaults) {
      await updateTemplateVariableCache(templateDefaults);
      state.templateVariableCache = mergeTemplateSources(
        state.templateVariableCache,
        templateDefaults,
      );
    }

    const favoritePayload = {
      title: modalState.title,
      text: modalState.mode === "chain"
        ? (modalState.steps[0]?.text ?? modalState.prompt ?? "")
        : modalState.prompt,
      sentTo: modalState.sites,
      templateDefaults,
      tags: modalState.tags,
      folder: modalState.folder,
      pinned: modalState.pinned,
      mode: modalState.mode,
      steps: modalState.mode === "chain" ? modalState.steps : [],
      scheduleEnabled: modalState.scheduleEnabled,
      scheduledAt: modalState.scheduleEnabled ? modalState.scheduledAt : null,
      scheduleRepeat: modalState.scheduleEnabled ? modalState.scheduleRepeat : "none",
    };

    let favorite: FavoritePrompt;
    if (modalState.favoriteId) {
      const updatedFavorite = await updateFavoritePrompt(
        modalState.favoriteId,
        favoritePayload,
      );
      if (!updatedFavorite) {
        throw new Error("Favorite could not be updated.");
      }
      favorite = updatedFavorite;
    } else {
      favorite = await createFavoritePrompt(favoritePayload);
      modalState.favoriteId = favorite.id;
    }

    await refreshStoredData();
    return favorite;
  }

  return {
    persistFavoriteEditorChanges,
  };
}
