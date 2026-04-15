import { createQuickPaletteState } from "./state";
import {
  closePalette,
  executeActiveFavorite,
  registerQuickPaletteRuntime,
  renderPalette,
} from "./runtime";

declare global {
  var __aiPromptBroadcasterQuickPaletteLoaded: boolean | undefined;
}

(() => {
  if (globalThis.__aiPromptBroadcasterQuickPaletteLoaded) {
    return;
  }

  globalThis.__aiPromptBroadcasterQuickPaletteLoaded = true;

  const state = createQuickPaletteState();
  const deps = {
    closePalette: () => closePalette(state),
    executeActiveFavorite: () =>
      executeActiveFavorite(state, {
        closePalette: () => closePalette(state),
        renderPalette: () => renderPalette(state, deps),
      }),
    renderPalette: () => renderPalette(state, deps),
  };

  registerQuickPaletteRuntime(state, deps);
})();
