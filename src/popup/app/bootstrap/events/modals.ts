import type { PopupEventDeps } from "./deps";

export function bindModalAndKeyboardEvents(deps: PopupEventDeps) {
  deps.modals.bindTemplateModalEvents((message) => {
    deps.modals.setTemplateModalError(message);
  });
  deps.modals.bindFavoriteEditorEvents();
  deps.modals.bindHistoryModalEvents(deps.status.getErrorMessage);

  document.addEventListener("keydown", (event) => {
    deps.runtime.trapModalFocus(event);
    void deps.runtime.handleGlobalShortcut(event).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to handle popup shortcut.", error);
    });
  });
}
