import {
  getPromptFavorites,
  markFavoriteUsed,
  updateTemplateVariableCache,
} from "../../shared/prompts";
import type {
  FavoritePrompt,
} from "../../shared/types/models";
import type {
  FavoriteRunResponse,
} from "../../shared/types/messages";
import { popupDom } from "../app/dom";
import { getUnknownErrorText, t } from "../app/i18n";
import { state } from "../app/state";
import { compactVariableValues, mergeTemplateSources } from "./template-modal/helpers";
import { createPopupTemplatePreparation } from "./template-modal/preparation";
import { createPopupTemplateModalRenderer } from "./template-modal/rendering";
import type {
  FavoriteRunRequestOptions,
  PopupTemplateModalDeps,
} from "./template-modal/types";

const {
  templateModal,
  templateFields,
  templateModalClose,
  templateModalCancel,
  templateModalConfirm,
} = popupDom.modals;

export function createPopupTemplateModal(deps: PopupTemplateModalDeps) {
  const templatePreparation = createPopupTemplatePreparation({
    sendPopupMessage: deps.sendPopupMessage,
    detectTemplateVariablesForTargets: deps.detectTemplateVariablesForTargets,
    getUnknownErrorText,
  });
  const {
    buildPreparedFavoriteExecutionContext,
    buildPendingTemplateSendState,
  } = templatePreparation;
  const templateRenderer = createPopupTemplateModalRenderer({
    buildTemplatePreviewText: deps.buildTemplatePreviewText,
    findMissingTemplateValuesForTargets:
      deps.findMissingTemplateValuesForTargets,
  });
  const {
    setTemplateModalError,
    buildTemplateSendPreviewState,
    renderTemplateModal,
  } = templateRenderer;

  function hideTemplateModal() {
    state.pendingTemplateSend = null;
    deps.closeOverlay(templateModal);
    setTemplateModalError("");
  }

  async function requestFavoriteRun(
    favorite: FavoritePrompt,
    {
      trigger = "popup",
      allowPopupFallback = false,
    }: FavoriteRunRequestOptions = {},
  ): Promise<FavoriteRunResponse> {
    if (!favorite?.id) {
      return {
        ok: false,
        error: getUnknownErrorText(),
      };
    }

    const prepared = await buildPreparedFavoriteExecutionContext(favorite);
    if (!prepared?.ok) {
      return prepared;
    }

    return (
      (await deps.sendPopupMessage<FavoriteRunResponse>(
        {
          action: "favorite:run",
          favoriteId: favorite.id,
          trigger,
          allowPopupFallback,
          preparedExecutionContext: prepared.preparedExecutionContext,
        },
        10000,
      )) ?? {
        ok: false,
        error: getUnknownErrorText(),
      }
    );
  }

  async function maybeMarkLoadedFavoriteAsUsed() {
    if (!state.loadedFavoriteId) {
      return;
    }

    try {
      await markFavoriteUsed(state.loadedFavoriteId);
      state.favorites = await getPromptFavorites();
    } catch (error) {
      console.error(
        "[AI Prompt Broadcaster] Failed to update favorite usage.",
        error,
      );
    }
  }

  async function openTemplateModalV2(
    prompt: string,
    targets: Parameters<PopupTemplateModalDeps["buildResolvedBroadcastTargets"]>[0],
  ): Promise<void> {
    const pendingState = await buildPendingTemplateSendState(
      prompt,
      targets ?? [],
      state.templateVariableCache,
      state.loadedTemplateDefaults,
    );

    if (!pendingState) {
      await maybeMarkLoadedFavoriteAsUsed();
      await deps.sendResolvedPrompt(
        prompt,
        deps.buildResolvedBroadcastTargets(targets),
      );
      return;
    }

    state.pendingTemplateSend = pendingState;
    renderTemplateModal();
    deps.openOverlay(
      templateModal,
      templateFields.querySelector("input") ?? templateModalConfirm,
    );
  }

  async function confirmTemplateModalSend(): Promise<void> {
    const modalState = state.pendingTemplateSend;
    if (!modalState) {
      return;
    }

    renderTemplateModal();
    const previewState = buildTemplateSendPreviewState();

    if (
      !previewState ||
      previewState.missingUserValues.length > 0 ||
      previewState.clipboardMissing
    ) {
      return;
    }

    const cachedValues = compactVariableValues(modalState.userValues);
    await updateTemplateVariableCache(cachedValues);
    state.templateVariableCache = mergeTemplateSources(
      state.templateVariableCache,
      cachedValues,
    );

    const resolvedTargets = deps.buildResolvedBroadcastTargets(
      modalState.targets,
      previewState.values,
    );
    hideTemplateModal();
    await maybeMarkLoadedFavoriteAsUsed();
    await deps.sendResolvedPrompt(modalState.prompt, resolvedTargets);
  }

  function bindTemplateModalEvents(onError: (message: string) => void): void {
    templateModalClose.addEventListener("click", hideTemplateModal);
    templateModalCancel.addEventListener("click", hideTemplateModal);
    templateModal.addEventListener("click", (event) => {
      if (event.target === templateModal) {
        hideTemplateModal();
      }
    });
    templateFields.addEventListener("input", (event) => {
      const input =
        event.target instanceof Element
          ? event.target.closest<HTMLInputElement>("[data-template-input]")
          : null;
      const templateInput = input?.dataset.templateInput;
      if (!input || !templateInput || !state.pendingTemplateSend) {
        return;
      }

      state.pendingTemplateSend.userValues[templateInput] = input.value;
      renderTemplateModal();
    });
    templateModalConfirm.addEventListener("click", () => {
      void confirmTemplateModalSend().catch((error) => {
        console.error(
          "[AI Prompt Broadcaster] Template modal confirm failed.",
          error,
        );
        onError(
          t.error(
            error instanceof Error ? error.message : getUnknownErrorText(),
          ),
        );
      });
    });
  }

  return {
    hideTemplateModal,
    setTemplateModalError,
    openTemplateModalV2,
    bindTemplateModalEvents,
    requestFavoriteRun,
  };
}
