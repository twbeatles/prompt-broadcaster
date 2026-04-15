import { filterFavorites } from "./render";
import type {
  QuickPaletteRuntimeDeps,
  QuickPaletteState,
} from "./types";

export function bindPaletteUiEvents(
  state: QuickPaletteState,
  deps: QuickPaletteRuntimeDeps,
): void {
  if (!state.shadow) {
    return;
  }

  const overlay = state.shadow.querySelector<HTMLElement>("[data-role='overlay']");
  const input = state.shadow.querySelector<HTMLInputElement>(".search");
  const buttons = Array.from(
    state.shadow.querySelectorAll<HTMLButtonElement>("[data-favorite-id]"),
  );

  overlay?.addEventListener("click", (event) => {
    if (event.target === overlay) {
      deps.closePalette();
    }
  });

  input?.addEventListener("input", (event) => {
    state.query = event.currentTarget instanceof HTMLInputElement
      ? event.currentTarget.value
      : "";
    filterFavorites(state);
    deps.renderPalette();
  });

  input?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (state.filteredFavorites.length > 0) {
        state.activeIndex = (state.activeIndex + 1) % state.filteredFavorites.length;
        deps.renderPalette();
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (state.filteredFavorites.length > 0) {
        state.activeIndex = (
          state.activeIndex - 1 + state.filteredFavorites.length
        ) % state.filteredFavorites.length;
        deps.renderPalette();
      }
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      void deps.executeActiveFavorite();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      deps.closePalette();
    }
  });

  buttons.forEach((button, index) => {
    button.addEventListener("mouseenter", () => {
      state.activeIndex = index;
      buttons.forEach((entry, entryIndex) => {
        entry.classList.toggle("active", entryIndex === state.activeIndex);
      });
    });
    button.addEventListener("click", () => {
      state.activeIndex = index;
      void deps.executeActiveFavorite();
    });
  });
}
