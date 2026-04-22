import type { PopupSendCardState } from "./types";

export function createPopupSendCardState(): PopupSendCardState {
  function getSiteCardElement(siteId: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(
      `.site-card[data-site-id="${CSS.escape(siteId)}"]`,
    );
  }

  function setSiteCardState(siteId: string, cardState: string): void {
    const card = getSiteCardElement(siteId);
    if (!card) {
      return;
    }

    card.classList.remove("sending", "sent", "failed");
    card.classList.add(cardState);
    card.querySelector(".retry-btn")?.remove();
  }

  function clearSiteCardStates(): void {
    document.querySelectorAll<HTMLElement>(".site-card").forEach((card) => {
      card.classList.remove("sending", "sent", "failed");
      card.querySelector(".retry-btn")?.remove();
    });
  }

  function triggerRipple(button: HTMLButtonElement, event: MouseEvent): void {
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;`;
    button.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove(), {
      once: true,
    });
  }

  return {
    clearSiteCardStates,
    getSiteCardElement,
    setSiteCardState,
    triggerRipple,
  };
}
