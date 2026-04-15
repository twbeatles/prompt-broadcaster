import type { QuickPaletteState } from "./types";

export function createQuickPaletteState(): QuickPaletteState {
  return {
    open: false,
    host: null,
    shadow: null,
    query: "",
    activeIndex: 0,
    favorites: [],
    filteredFavorites: [],
    status: "",
  };
}
