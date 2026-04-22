import { consumePopupFavoriteIntent } from "../../../shared/runtime-state";
import type {
  FavoriteRunResponse,
} from "../../../shared/types/messages";
import type {
  FavoriteExecutionTrigger,
  FavoritePrompt,
} from "../../../shared/types/models";
import type { PopupToastInput } from "../../../shared/types/popup";
import { t } from "../i18n";

interface PopupFavoriteIntentHandlerDeps {
  getFavoriteById: (favoriteId: string) => FavoritePrompt | undefined;
  requestFavoriteRun: (
    favorite: FavoritePrompt,
    options?: {
      trigger?: FavoriteExecutionTrigger;
      allowPopupFallback?: boolean;
    },
  ) => Promise<FavoriteRunResponse>;
  openFavoriteEditor: (
    favorite: FavoritePrompt,
    options?: { reason?: string },
  ) => void;
  setStatus: (text: string, type?: string) => void;
  showAppToast: (input: PopupToastInput | string, type?: string, duration?: number) => string;
  getUnknownErrorText: () => string;
}

export function createPopupFavoriteIntentHandler(
  deps: PopupFavoriteIntentHandlerDeps,
) {
  async function maybeHandlePopupFavoriteIntent() {
    const intent = await consumePopupFavoriteIntent().catch(() => null);
    if (!intent?.favoriteId) {
      return;
    }

    const favorite = deps.getFavoriteById(intent.favoriteId);
    if (!favorite) {
      return;
    }

    let runReason = intent.reason || t.favoriteRunNeedsEditor;

    if (intent.type === "run") {
      const response = await deps.requestFavoriteRun(favorite, {
        trigger:
          intent.source === "options-edit"
            ? "popup"
            : (intent.source ?? "popup"),
        allowPopupFallback: false,
      });

      if (response?.ok) {
        const message = response?.message ?? t.favoriteRunQueued;
        deps.setStatus(message, "success");
        deps.showAppToast(message, "success", 2200);
        return;
      }

      if (!response?.requiresPopupInput) {
        const errorMessage = response?.error ?? deps.getUnknownErrorText();
        deps.setStatus(t.error(errorMessage), "error");
        deps.showAppToast(t.error(errorMessage), "error", 3200);
        return;
      }

      runReason = response?.error || runReason;
    }

    deps.openFavoriteEditor(favorite, {
      reason: intent.type === "run" ? runReason : "",
    });
  }

  return {
    maybeHandlePopupFavoriteIntent,
  };
}
