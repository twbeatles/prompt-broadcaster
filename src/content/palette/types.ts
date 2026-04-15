import type { QuickPaletteFavoriteSummary } from "../../shared/types/messages";

export interface QuickPaletteState {
  open: boolean;
  host: HTMLDivElement | null;
  shadow: ShadowRoot | null;
  query: string;
  activeIndex: number;
  favorites: QuickPaletteFavoriteSummary[];
  filteredFavorites: QuickPaletteFavoriteSummary[];
  status: string;
}

export interface QuickPaletteRenderDeps {
  closePalette: () => void;
  executeActiveFavorite: () => Promise<void>;
}

export interface QuickPaletteRuntimeDeps extends QuickPaletteRenderDeps {
  renderPalette: () => void;
}

export interface QuickPalettePingMessage {
  action: "quickPalette:ping";
}

export interface QuickPaletteToggleMessage {
  action: "quickPalette:toggle";
}

export type QuickPaletteContentMessage =
  | QuickPalettePingMessage
  | QuickPaletteToggleMessage
  | { action: "quickPalette:close" };
