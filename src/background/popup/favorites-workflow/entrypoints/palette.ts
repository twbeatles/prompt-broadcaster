import { getPromptFavorites } from "../../../../shared/prompts";
import type { FavoriteWorkflowEntryPointDeps } from "./types";
import type { createFavoriteRunMessageHandlers } from "./messages";

export type HandleFavoriteRunMessage = ReturnType<
  typeof createFavoriteRunMessageHandlers
>["handleFavoriteRunMessage"];

export interface QuickPaletteHandlerDeps
  extends Pick<FavoriteWorkflowEntryPointDeps, "previewFavoriteText"> {
  handleFavoriteRunMessage: HandleFavoriteRunMessage;
}

export function createQuickPaletteHandlers(deps: QuickPaletteHandlerDeps) {
  async function handleQuickPaletteGetState() {
    const favorites = await getPromptFavorites();
    return {
      ok: true,
      favorites: favorites.map((favorite) => ({
        id: favorite.id,
        title: favorite.title || deps.previewFavoriteText(favorite),
        text: favorite.text ?? "",
        preview: deps.previewFavoriteText(favorite),
        mode: favorite.mode === "chain" ? "chain" : "single",
        tags: Array.isArray(favorite.tags) ? favorite.tags : [],
        folder: favorite.folder ?? "",
      })),
    };
  }

  async function handleQuickPaletteExecuteMessage(
    message: { favoriteId?: string },
    sender: chrome.runtime.MessageSender,
  ) {
    return deps.handleFavoriteRunMessage(
      {
        favoriteId: message?.favoriteId,
        trigger: "palette",
        allowPopupFallback: true,
      },
      sender,
    );
  }

  return {
    handleQuickPaletteGetState,
    handleQuickPaletteExecuteMessage,
  };
}
