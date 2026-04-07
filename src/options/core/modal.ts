type ModalOverlay = HTMLElement & { hidden: boolean };

interface ModalStateEntry {
  lastFocused: HTMLElement | null;
  onClose?: () => void;
}

const modalState = new WeakMap<HTMLElement, ModalStateEntry>();
const boundOverlays = new WeakSet<HTMLElement>();
let keyboardEventsBound = false;
let activeModal: ModalOverlay | null = null;

function toModalOverlay(overlay: HTMLElement | null): ModalOverlay | null {
  if (!overlay) {
    return null;
  }

  return overlay as ModalOverlay;
}

function getModalEntry(overlay: HTMLElement): ModalStateEntry {
  const existing = modalState.get(overlay);
  if (existing) {
    return existing;
  }

  const created: ModalStateEntry = { lastFocused: null };
  modalState.set(overlay, created);
  return created;
}

function isFocusable(element: HTMLElement) {
  if (element.hidden || element.getAttribute("aria-hidden") === "true") {
    return false;
  }

  if ("disabled" in element && typeof element.disabled === "boolean" && element.disabled) {
    return false;
  }

  return true;
}

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(
    "button, [href], input:not([type='hidden']), select, textarea, [tabindex]:not([tabindex='-1'])",
  )).filter(isFocusable);
}

export function getOpenModal(): ModalOverlay | null {
  if (activeModal && !activeModal.hidden) {
    return activeModal;
  }

  activeModal = Array.from(document.querySelectorAll<HTMLElement>(".modal-overlay"))
    .map((overlay) => toModalOverlay(overlay))
    .find((overlay) => overlay && !overlay.hidden) ?? null;

  return activeModal;
}

export function openModal(overlay: HTMLElement | null, initialFocus: HTMLElement | null = null) {
  const modal = toModalOverlay(overlay);
  if (!modal) {
    return;
  }

  const entry = getModalEntry(modal);
  entry.lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modal.hidden = false;
  activeModal = modal;

  window.requestAnimationFrame(() => {
    const fallbackTarget = getFocusableElements(modal)[0] ?? modal.querySelector<HTMLElement>(".modal-card");
    (initialFocus ?? fallbackTarget)?.focus?.();
  });
}

export function closeModal(overlay: HTMLElement | null) {
  const modal = toModalOverlay(overlay);
  if (!modal) {
    return;
  }

  const entry = getModalEntry(modal);
  modal.hidden = true;

  if (activeModal === modal) {
    activeModal = null;
  }

  entry.lastFocused?.focus?.();
  entry.lastFocused = null;
}

export function registerModalCloseHandler(overlay: HTMLElement | null, onClose: () => void) {
  const modal = toModalOverlay(overlay);
  if (!modal) {
    return;
  }

  const entry = getModalEntry(modal);
  entry.onClose = onClose;

  if (boundOverlays.has(modal)) {
    return;
  }

  boundOverlays.add(modal);
  modal.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }

    if (target === modal || target.closest("[data-modal-close]")) {
      event.preventDefault();
      entry.onClose?.();
    }
  });
}

export function bindModalKeyboardEvents() {
  if (keyboardEventsBound) {
    return;
  }

  keyboardEventsBound = true;
  document.addEventListener("keydown", (event) => {
    const modal = getOpenModal();
    if (!modal) {
      return;
    }

    const entry = getModalEntry(modal);

    if (event.key === "Escape") {
      event.preventDefault();
      entry.onClose?.();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusable = getFocusableElements(modal);
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
  });
}
