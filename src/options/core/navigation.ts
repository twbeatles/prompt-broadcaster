// @ts-nocheck
import { optionsDom } from "../app/dom";
import { state } from "../app/state";

const { navButtons, pageSections } = optionsDom.navigation;

export function switchSection(sectionId) {
  state.activeSection = sectionId;

  navButtons.forEach((button) => {
    const active = button.dataset.section === sectionId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });

  pageSections.forEach((section) => {
    const active = section.id === `section-${sectionId}`;
    section.classList.toggle("active", active);
    section.hidden = !active;
  });
}

export function bindNavigationEvents() {
  navButtons.forEach((button) => {
    button.addEventListener("click", () => switchSection(button.dataset.section));
  });
}
