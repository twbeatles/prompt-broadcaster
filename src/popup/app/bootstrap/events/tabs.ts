import { popupDom } from "../../dom";
import type { PopupComposeDeps } from "./deps";
import type { PopupTabId } from "../helpers";

const { tabButtons } = popupDom.tabs;

export function bindTabEvents(switchTab: PopupComposeDeps["switchTab"]) {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextTab = button.dataset.tab as PopupTabId | undefined;
      if (nextTab) {
        switchTab(nextTab);
      }
    });
  });
}
