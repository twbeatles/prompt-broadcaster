import { popupDom } from "../app/dom";
import { t } from "../app/i18n";
import { state } from "../app/state";
import {
  createFavoriteEditorStep,
  getFirstNonEmptyStepText,
  toIsoDateTime,
  toLocalDateTimeInputValue,
} from "./editor-state";

const { promptInput } = popupDom.compose;
const {
  favoriteModal,
  favoriteModalClose,
  favoriteModeSelect,
  favoritePromptInput,
  favoriteTargetsList,
  favoriteSaveDefaults,
  favoriteDefaultFields,
  favoriteScheduleEnabled,
  favoriteScheduleFields,
  favoriteScheduledAtInput,
  favoriteScheduleRepeatSelect,
  favoriteChainAddStep,
  favoriteChainList,
  favoriteModalConfirm,
  favoriteModalRun,
} = popupDom.modals;

interface FavoriteEditorEventsDeps {
  dismissFavoriteModal: (event?: Event) => void;
  renderFavoriteModal: () => void;
  renderFavoriteDefaultFields: () => void;
  syncFavoriteVariableUi: () => void;
  confirmFavoriteSave: () => Promise<void>;
  runFavoriteFromEditor: () => Promise<void>;
  setFavoriteModalError: (message?: string) => void;
  getUnknownErrorText: () => string;
}

export function createFavoriteEditorEvents(deps: FavoriteEditorEventsDeps) {
  function bindFavoriteEditorEvents(): void {
    favoriteModalClose.addEventListener("click", deps.dismissFavoriteModal);
    favoriteModal.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const dismissButton = target?.closest("[data-dismiss-favorite-modal]");
      if (dismissButton || target === favoriteModal) {
        deps.dismissFavoriteModal(event);
      }
    });
    favoriteModal.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !favoriteModal.hidden) {
        deps.dismissFavoriteModal(event);
      }
    });
    favoriteSaveDefaults.addEventListener("change", () => {
      if (!state.pendingFavoriteSave) {
        return;
      }

      state.pendingFavoriteSave.saveDefaults = favoriteSaveDefaults.checked;
      deps.renderFavoriteDefaultFields();
    });
    favoriteDefaultFields.addEventListener("input", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const input = target?.closest<HTMLInputElement>("[data-favorite-default-input]");
      const variableName = input?.dataset.favoriteDefaultInput;
      if (!input || !variableName || !state.pendingFavoriteSave) {
        return;
      }

      state.pendingFavoriteSave.defaultValues[variableName] = input.value;
    });
    favoriteModeSelect.addEventListener("change", () => {
      const modalState = state.pendingFavoriteSave;
      if (!modalState) {
        return;
      }

      const nextMode = favoriteModeSelect.value === "chain" ? "chain" : "single";
      if (nextMode === modalState.mode) {
        return;
      }

      if (nextMode === "chain") {
        const seedText = favoritePromptInput.value || modalState.prompt || promptInput.value || "";
        modalState.prompt = seedText;
        if (modalState.steps.length === 0 || !modalState.steps.some((step) => step.text.trim())) {
          modalState.steps = [createFavoriteEditorStep(seedText, [], 0)];
        }
      } else {
        modalState.prompt = getFirstNonEmptyStepText(modalState.steps)
          || favoritePromptInput.value
          || modalState.prompt;
      }

      modalState.mode = nextMode;
      deps.setFavoriteModalError("");
      deps.renderFavoriteModal();
    });
    favoriteScheduleEnabled.addEventListener("change", () => {
      const modalState = state.pendingFavoriteSave;
      if (!modalState) {
        return;
      }

      modalState.scheduleEnabled = favoriteScheduleEnabled.checked;
      if (modalState.scheduleEnabled && !modalState.scheduledAt) {
        const defaultDate = new Date(Date.now() + 10 * 60 * 1000);
        modalState.scheduledAt = defaultDate.toISOString();
        favoriteScheduledAtInput.value = toLocalDateTimeInputValue(
          modalState.scheduledAt,
        );
      }
      favoriteScheduleFields.hidden = !modalState.scheduleEnabled;
    });
    favoriteScheduledAtInput.addEventListener("change", () => {
      if (!state.pendingFavoriteSave) {
        return;
      }

      state.pendingFavoriteSave.scheduledAt = toIsoDateTime(
        favoriteScheduledAtInput.value,
      );
    });
    favoriteScheduleRepeatSelect.addEventListener("change", () => {
      if (!state.pendingFavoriteSave) {
        return;
      }

      state.pendingFavoriteSave.scheduleRepeat = favoriteScheduleRepeatSelect.value === "daily"
        || favoriteScheduleRepeatSelect.value === "weekday"
        || favoriteScheduleRepeatSelect.value === "weekly"
        ? favoriteScheduleRepeatSelect.value
        : "none";
    });
    favoritePromptInput.addEventListener("input", () => {
      const modalState = state.pendingFavoriteSave;
      if (!modalState) {
        return;
      }

      modalState.prompt = favoritePromptInput.value;
      deps.syncFavoriteVariableUi();
      deps.setFavoriteModalError("");
    });
    favoriteTargetsList.addEventListener("change", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const input = target?.closest<HTMLInputElement>("[data-favorite-target][data-site-id]");
      const siteId = input?.dataset.siteId;
      if (!input || !siteId || !state.pendingFavoriteSave) {
        return;
      }

      const nextSelected = new Set(state.pendingFavoriteSave.sites);
      if (input.checked) {
        nextSelected.add(siteId);
      } else {
        nextSelected.delete(siteId);
      }
      state.pendingFavoriteSave.sites = [...nextSelected];
    });
    favoriteChainAddStep.addEventListener("click", () => {
      const modalState = state.pendingFavoriteSave;
      if (!modalState) {
        return;
      }

      modalState.steps.push(createFavoriteEditorStep("", [], 0));
      deps.renderFavoriteModal();
      window.requestAnimationFrame(() => {
        const inputs = Array.from(
          favoriteChainList.querySelectorAll<HTMLElement>("[data-favorite-step-text]"),
        );
        inputs[inputs.length - 1]?.focus?.();
      });
    });
    favoriteChainList.addEventListener("input", (event) => {
      const modalState = state.pendingFavoriteSave;
      if (!modalState) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const textInput = target?.closest<HTMLTextAreaElement>("[data-favorite-step-text]");
      if (textInput) {
        const stepId = textInput.dataset.favoriteStepText;
        const step = modalState.steps.find((entry) => entry.id === stepId);
        if (step) {
          step.text = textInput.value;
          deps.syncFavoriteVariableUi();
        }
        return;
      }

      const delayInput = target?.closest<HTMLInputElement>("[data-favorite-step-delay]");
      if (!delayInput) {
        return;
      }

      const step = modalState.steps.find(
        (entry) => entry.id === delayInput.dataset.favoriteStepDelay,
      );
      if (step) {
        step.delayMs = Math.max(0, Math.round(Number(delayInput.value) || 0));
      }
    });
    favoriteChainList.addEventListener("change", (event) => {
      const modalState = state.pendingFavoriteSave;
      if (!modalState) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const failurePolicySelect = target?.closest<HTMLSelectElement>("[data-favorite-step-failure-policy]");
      if (failurePolicySelect) {
        const step = modalState.steps.find(
          (entry) => entry.id === failurePolicySelect.dataset.favoriteStepFailurePolicy,
        );
        if (step) {
          step.failurePolicy = failurePolicySelect.value as typeof step.failurePolicy;
        }
        return;
      }

      const targetModeSelect = target?.closest<HTMLSelectElement>("[data-favorite-step-target-mode]");
      if (targetModeSelect) {
        const step = modalState.steps.find(
          (entry) => entry.id === targetModeSelect.dataset.favoriteStepTargetMode,
        );
        if (step) {
          step.targetMode = targetModeSelect.value as typeof step.targetMode;
        }
        return;
      }

      const input = target?.closest<HTMLInputElement>("[data-favorite-step-target][data-site-id]");
      const stepId = input?.dataset.favoriteStepTarget;
      const siteId = input?.dataset.siteId;
      if (!input || !stepId || !siteId) {
        return;
      }

      const step = modalState.steps.find((entry) => entry.id === stepId);
      if (!step) {
        return;
      }

      const nextTargets = new Set(step.targetSiteIds);
      if (input.checked) {
        nextTargets.add(siteId);
      } else {
        nextTargets.delete(siteId);
      }
      step.targetSiteIds = [...nextTargets];
    });
    favoriteChainList.addEventListener("click", (event) => {
      const modalState = state.pendingFavoriteSave;
      if (!modalState) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const deleteButton = target?.closest<HTMLElement>("[data-favorite-step-delete]");
      if (deleteButton) {
        modalState.steps = modalState.steps.filter(
          (step) => step.id !== deleteButton.dataset.favoriteStepDelete,
        );
        deps.renderFavoriteModal();
        return;
      }

      const moveButton = target?.closest<HTMLElement>("[data-favorite-step-move]");
      if (!moveButton) {
        return;
      }

      const stepId = moveButton.dataset.favoriteStepMove;
      const index = modalState.steps.findIndex((step) => step.id === stepId);
      if (index === -1) {
        return;
      }

      const direction = moveButton.dataset.direction === "down" ? 1 : -1;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= modalState.steps.length) {
        return;
      }

      const [step] = modalState.steps.splice(index, 1);
      modalState.steps.splice(nextIndex, 0, step);
      deps.renderFavoriteModal();
    });
    favoriteModalConfirm.addEventListener("click", () => {
      void deps.confirmFavoriteSave().catch((error) => {
        console.error("[AI Prompt Broadcaster] Favorite save failed.", error);
        deps.setFavoriteModalError(
          t.error((error as Error)?.message ?? deps.getUnknownErrorText()),
        );
      });
    });
    favoriteModalRun.addEventListener("click", () => {
      void deps.runFavoriteFromEditor().catch((error) => {
        console.error("[AI Prompt Broadcaster] Favorite run failed.", error);
        deps.setFavoriteModalError(
          t.error((error as Error)?.message ?? deps.getUnknownErrorText()),
        );
      });
    });
  }

  return {
    bindFavoriteEditorEvents,
  };
}
