import { sendRuntimeMessageWithTimeout } from "../../shared/chrome/messaging";
import type {
  FavoriteRunResponse,
  QuickPaletteExecuteMessage,
  QuickPaletteGetStateResponse,
} from "../../shared/types/messages";
import { bindPaletteUiEvents } from "./events";
import { buildPaletteMarkup, ensurePaletteHost, filterFavorites } from "./render";
import type {
  QuickPaletteContentMessage,
  QuickPaletteRuntimeDeps,
  QuickPaletteState,
} from "./types";

export function renderPalette(
  state: QuickPaletteState,
  deps: QuickPaletteRuntimeDeps,
): void {
  ensurePaletteHost(state);
  if (!state.shadow) {
    return;
  }

  state.shadow.innerHTML = buildPaletteMarkup(state);
  bindPaletteUiEvents(state, deps);

  const input = state.shadow.querySelector<HTMLInputElement>(".search");
  if (input) {
    input.focus();
    input.setSelectionRange?.(input.value.length, input.value.length);
  }
}

export async function loadFavorites(state: QuickPaletteState): Promise<void> {
  const response = await sendRuntimeMessageWithTimeout({
    action: "quickPalette:getState",
  });
  const typedResponse = response as QuickPaletteGetStateResponse | null;
  if (!typedResponse?.ok) {
    throw new Error("Failed to load favorites.");
  }

  state.favorites = Array.isArray(typedResponse.favorites)
    ? typedResponse.favorites
    : [];
  filterFavorites(state);
}

export async function openPalette(
  state: QuickPaletteState,
  deps: QuickPaletteRuntimeDeps,
): Promise<void> {
  state.status = "";
  state.query = "";
  state.activeIndex = 0;
  await loadFavorites(state);
  state.open = true;
  renderPalette(state, deps);
}

export function closePalette(state: QuickPaletteState): void {
  state.open = false;
  state.status = "";
  state.host?.remove();
  state.host = null;
  state.shadow = null;
}

export async function executeActiveFavorite(
  state: QuickPaletteState,
  deps: Pick<QuickPaletteRuntimeDeps, "closePalette" | "renderPalette">,
): Promise<void> {
  const favorite = state.filteredFavorites[state.activeIndex];
  if (!favorite?.id) {
    return;
  }

  const response = await sendRuntimeMessageWithTimeout({
    action: "quickPalette:execute",
    favoriteId: favorite.id,
  } satisfies QuickPaletteExecuteMessage);
  const typedResponse = response as FavoriteRunResponse | null;

  if (typedResponse?.ok) {
    deps.closePalette();
    return;
  }

  state.status = typedResponse?.error ?? "Unable to run this favorite.";
  deps.renderPalette();
}

function isQuickPaletteMessage(message: unknown): message is QuickPaletteContentMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  const action = (message as { action?: unknown }).action;
  return action === "quickPalette:ping"
    || action === "quickPalette:close"
    || action === "quickPalette:toggle";
}

export function registerQuickPaletteRuntime(
  state: QuickPaletteState,
  deps: QuickPaletteRuntimeDeps,
): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    try {
      if (!isQuickPaletteMessage(message)) {
        return false;
      }

      if (message.action === "quickPalette:ping") {
        sendResponse({ ok: true });
        return false;
      }

      if (message.action === "quickPalette:close") {
        closePalette(state);
        sendResponse({ ok: true });
        return false;
      }

      if (message.action === "quickPalette:toggle") {
        void (async () => {
          if (state.open) {
            closePalette(state);
            sendResponse({ ok: true, open: false });
            return;
          }

          try {
            await openPalette(state, deps);
            sendResponse({ ok: true, open: true });
          } catch (error) {
            closePalette(state);
            sendResponse({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        })();
        return true;
      }

      return false;
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  });
}
