import { getPromptFavorites } from "../../../../shared/prompts";
import type {
  FavoriteExecutionTrigger,
  FavoriteRunExecutionContextSnapshot,
} from "../../../../shared/types/models";
import type { FavoriteWorkflowEntryPointDeps } from "./types";
import type {
  EnqueueFavoriteRun,
  StorePopupFavoriteIntentAndOpen,
} from "./enqueue";

export interface FavoriteRunMessageInput {
  favoriteId?: string;
  trigger?: FavoriteExecutionTrigger;
  allowPopupFallback?: boolean;
  preparedExecutionContext?: Partial<FavoriteRunExecutionContextSnapshot>;
}

export interface FavoriteOpenEditorMessageInput {
  favoriteId?: string;
  source?: "options-edit" | "popup";
}

export interface FavoriteRunMessageHandlerDeps
  extends Pick<FavoriteWorkflowEntryPointDeps, "getWorkflowMessage"> {
  enqueueFavoriteRun: EnqueueFavoriteRun;
  storePopupFavoriteIntentAndOpen: StorePopupFavoriteIntentAndOpen;
}

export function createFavoriteRunMessageHandlers(
  deps: FavoriteRunMessageHandlerDeps,
) {
  async function handleFavoriteRunMessage(
    message: FavoriteRunMessageInput,
    sender: chrome.runtime.MessageSender,
  ) {
    const favoriteId =
      typeof message?.favoriteId === "string" ? message.favoriteId.trim() : "";
    if (!favoriteId) {
      return {
        ok: false,
        error: deps.getWorkflowMessage(
          "favorite_run_error_favorite_id_required",
          [],
          "Favorite id is required.",
        ),
      };
    }

    const favorites = await getPromptFavorites();
    const favorite = favorites.find((entry) => String(entry.id) === favoriteId);
    if (!favorite) {
      return {
        ok: false,
        error: deps.getWorkflowMessage(
          "favorite_run_error_favorite_not_found",
          [],
          "Favorite not found.",
        ),
      };
    }

    const execution = await deps.enqueueFavoriteRun(favorite, {
      trigger: message?.trigger ?? "popup",
      sender,
      allowPopupFallback: message?.allowPopupFallback !== false,
      preparedExecutionContext: message?.preparedExecutionContext,
    });

    if (execution?.ok) {
      return execution;
    }

    const requiresPopupInput =
      "requiresPopupInput" in execution && Boolean(execution.requiresPopupInput);

    if (!requiresPopupInput || message?.allowPopupFallback === false) {
      return execution;
    }

    await deps.storePopupFavoriteIntentAndOpen(
      favoriteId,
      "run",
      message?.trigger ?? "popup",
      ("error" in execution ? execution.error : "") ?? "",
    );

    return {
      ok: true,
      popupFallback: true,
      reason:
        ("reason" in execution ? execution.reason : "popup_fallback") ??
        "popup_fallback",
    };
  }

  async function handleFavoriteOpenEditorMessage(
    message: FavoriteOpenEditorMessageInput,
  ) {
    const favoriteId =
      typeof message?.favoriteId === "string" ? message.favoriteId.trim() : "";
    if (!favoriteId) {
      return {
        ok: false,
        error: deps.getWorkflowMessage(
          "favorite_run_error_favorite_id_required",
          [],
          "Favorite id is required.",
        ),
      };
    }

    await deps.storePopupFavoriteIntentAndOpen(
      favoriteId,
      "edit",
      message?.source ?? "options-edit",
    );

    return { ok: true };
  }

  return {
    handleFavoriteRunMessage,
    handleFavoriteOpenEditorMessage,
  };
}
