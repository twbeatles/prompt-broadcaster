import type { PopupState } from "../../shared/types/popup";
import { popupDom } from "./dom";
import { isTextEditingTarget } from "./helpers";
import { state } from "./state";

const { toggleAllBtn } = popupDom.compose;
const { historyList } = popupDom.history;
const { favoritesList } = popupDom.favorites;

type PopupTabId = PopupState["activeTab"];

interface PopupShortcutDeps {
  closeActiveOverlayOrMenu: () => boolean;
  getOpenOverlay: () => HTMLElement | null;
  cancelCurrentBroadcast: () => Promise<void>;
  handleSend: () => Promise<void>;
  switchTab: (tabId: PopupTabId) => void;
}

export function createPopupShortcutController(deps: PopupShortcutDeps) {
  function getPromptButtonsForActiveTab(): HTMLElement[] {
    if (state.activeTab === "history") {
      return Array.from(historyList.querySelectorAll<HTMLElement>("[data-load-history]"));
    }

    if (state.activeTab === "favorites") {
      return Array.from(
        favoritesList.querySelectorAll<HTMLElement>("[data-load-favorite], [data-edit-favorite]"),
      );
    }

    return [];
  }

  function focusAdjacentPromptButton(direction: number): void {
    const buttons = getPromptButtonsForActiveTab();
    if (buttons.length === 0) {
      return;
    }

    const currentIndex = buttons.findIndex((button) => button === document.activeElement);
    const nextIndex = currentIndex === -1
      ? (direction > 0 ? 0 : buttons.length - 1)
      : (currentIndex + direction + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus?.();
  }

  async function handleGlobalShortcut(event: KeyboardEvent): Promise<void> {
    if (event.defaultPrevented) {
      return;
    }

    const shortcutKey = event.key.toLowerCase();
    const hasPrimaryModifier = event.ctrlKey || event.metaKey;

    if (event.key === "Escape") {
      if (deps.closeActiveOverlayOrMenu()) {
        event.preventDefault();
      }
      return;
    }

    if (deps.getOpenOverlay()) {
      return;
    }

    if (hasPrimaryModifier && event.shiftKey && event.key === "Enter") {
      event.preventDefault();
      await deps.cancelCurrentBroadcast();
      return;
    }

    if (hasPrimaryModifier && !event.shiftKey && event.key === "Enter") {
      event.preventDefault();
      await deps.handleSend();
      return;
    }

    if (hasPrimaryModifier && !event.shiftKey && ["1", "2", "3", "4"].includes(shortcutKey)) {
      event.preventDefault();
      deps.switchTab(["compose", "history", "favorites", "settings"][Number(shortcutKey) - 1] as PopupTabId);
      return;
    }

    if (hasPrimaryModifier && !event.shiftKey && shortcutKey === "a" && state.activeTab === "compose" && !isTextEditingTarget(event.target)) {
      event.preventDefault();
      toggleAllBtn.click();
      return;
    }

    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !isTextEditingTarget(event.target)) {
      if (state.activeTab === "history" || state.activeTab === "favorites") {
        event.preventDefault();
        focusAdjacentPromptButton(event.key === "ArrowDown" ? 1 : -1);
      }
    }
  }

  return {
    handleGlobalShortcut,
  };
}
