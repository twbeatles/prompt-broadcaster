import type { PopupOverlayController } from "../../shared/types/popup";
import { state } from "../app/state";

function getFocusableElements(root: ParentNode): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      "button:not([disabled]), [href], input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ),
  ).filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
}

export function createOverlayController(options: {
  overlays: HTMLElement[];
  closeFavoriteModal: () => void;
  hideTemplateModal: () => void;
  hideResendModal: () => void;
  hideResponsesModal: () => void;
  hideImportReportModal: () => void;
  renderLists: () => void;
}): PopupOverlayController {
  const {
    overlays,
    closeFavoriteModal,
    hideTemplateModal,
    hideResendModal,
    hideResponsesModal,
    hideImportReportModal,
    renderLists,
  } = options;

  function openOverlay(
    overlay: HTMLElement | null,
    initialFocus: HTMLElement | null = null,
  ): void {
    if (!overlay) {
      return;
    }

    state.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlay.hidden = false;
    state.openModalId = overlay.id;

    window.requestAnimationFrame(() => {
      const fallbackTarget = getFocusableElements(overlay)[0] ?? overlay.querySelector<HTMLElement>(".modal-card");
      (initialFocus ?? fallbackTarget)?.focus?.();
    });
  }

  function closeOverlay(overlay: HTMLElement | null): void {
    if (!overlay) {
      return;
    }

    overlay.hidden = true;
    if (state.openModalId === overlay.id) {
      state.openModalId = null;
    }
    state.lastFocusedElement?.focus?.();
    state.lastFocusedElement = null;
  }

  function getOpenOverlay(): HTMLElement | null {
    return overlays.find((overlay) => overlay && !overlay.hidden) ?? null;
  }

  function closeActiveOverlayOrMenu(): boolean {
    const overlay = getOpenOverlay();
    if (overlay) {
      if (overlay.id === "import-report-modal") {
        hideImportReportModal();
        return true;
      }
      if (overlay.id === "resend-modal") {
        hideResendModal();
        return true;
      }
      if (overlay.id === "responses-modal") {
        hideResponsesModal();
        return true;
      }
      if (overlay.id === "favorite-modal") {
        closeFavoriteModal();
        return true;
      }
      if (overlay.id === "template-modal") {
        hideTemplateModal();
        return true;
      }
    }

    if (state.openMenuKey) {
      state.openMenuKey = null;
      renderLists();
      return true;
    }

    return false;
  }

  function trapModalFocus(event: KeyboardEvent): void {
    if (event.key !== "Tab") {
      return;
    }

    const overlay = getOpenOverlay();
    if (!overlay) {
      return;
    }

    const focusable = getFocusableElements(overlay);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.shiftKey
      ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
      : (currentIndex === -1 || currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1);

    event.preventDefault();
    focusable[nextIndex]?.focus?.();
  }

  return {
    openOverlay,
    closeOverlay,
    getOpenOverlay,
    closeActiveOverlayOrMenu,
    trapModalFocus,
  };
}
