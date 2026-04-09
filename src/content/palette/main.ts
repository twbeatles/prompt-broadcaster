// @ts-nocheck
import { sendRuntimeMessageWithTimeout } from "../../shared/chrome/messaging";
import { matchesFavoriteSearch } from "../../shared/prompts/search";

(() => {
  if (globalThis.__aiPromptBroadcasterQuickPaletteLoaded) {
    return;
  }

  globalThis.__aiPromptBroadcasterQuickPaletteLoaded = true;

  const state = {
    open: false,
    host: null,
    shadow: null,
    query: "",
    activeIndex: 0,
    favorites: [],
    filteredFavorites: [],
    status: "",
  };

  function ensureHost() {
    if (state.host && state.shadow) {
      return;
    }

    const host = document.createElement("div");
    host.id = "apb-quick-palette-root";
    const shadow = host.attachShadow({ mode: "open" });
    document.documentElement.appendChild(host);
    state.host = host;
    state.shadow = shadow;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function filterFavorites() {
    state.filteredFavorites = state.query.trim()
      ? state.favorites.filter((favorite) => matchesFavoriteSearch(favorite, state.query))
      : [...state.favorites];

    state.activeIndex = Math.min(
      state.filteredFavorites.length - 1,
      Math.max(0, state.activeIndex)
    );
    if (state.filteredFavorites.length === 0) {
      state.activeIndex = 0;
    }
  }

  function buildMarkup() {
    const listMarkup = state.filteredFavorites.length > 0
      ? state.filteredFavorites.map((favorite, index) => `
          <button
            class="result-item${index === state.activeIndex ? " active" : ""}"
            type="button"
            data-favorite-id="${escapeHtml(favorite.id)}"
          >
            <div class="result-head">
              <strong>${escapeHtml(favorite.title || favorite.preview || "Untitled favorite")}</strong>
              <span class="pill ${favorite.mode === "chain" ? "chain" : ""}">${escapeHtml(favorite.mode === "chain" ? "Chain" : "Single")}</span>
            </div>
            <div class="result-preview">${escapeHtml(favorite.preview || "")}</div>
            <div class="result-meta">
              ${favorite.folder ? `<span>${escapeHtml(favorite.folder)}</span>` : ""}
              ${Array.isArray(favorite.tags) && favorite.tags.length > 0 ? `<span>${escapeHtml(favorite.tags.join(", "))}</span>` : ""}
            </div>
          </button>
        `).join("")
      : `<div class="empty-state">No matching favorites.</div>`;

    return `
      <style>
        :host {
          all: initial;
        }
        .overlay {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: min(12vh, 96px) 16px 24px;
          background: rgba(13, 14, 18, 0.26);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          font-family: "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
          color: #201812;
        }
        .panel {
          width: min(680px, 100%);
          border-radius: 22px;
          border: 1px solid rgba(103, 79, 53, 0.15);
          background:
            radial-gradient(circle at top right, rgba(240, 170, 102, 0.28), transparent 36%),
            rgba(255, 248, 241, 0.95);
          box-shadow: 0 32px 72px rgba(23, 17, 12, 0.28);
          overflow: hidden;
        }
        .header {
          padding: 18px 18px 12px;
          display: grid;
          gap: 10px;
          border-bottom: 1px solid rgba(103, 79, 53, 0.12);
        }
        .title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          font-size: 12px;
          color: #7d6653;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-weight: 700;
        }
        .shortcut {
          padding: 4px 8px;
          border-radius: 999px;
          background: rgba(194, 79, 46, 0.1);
          color: #c24f2e;
          font-size: 11px;
        }
        .search {
          width: 100%;
          border: 1px solid rgba(103, 79, 53, 0.16);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.86);
          color: inherit;
          padding: 14px 16px;
          outline: none;
          font: 500 15px/1.4 inherit;
          box-sizing: border-box;
        }
        .search:focus {
          border-color: rgba(194, 79, 46, 0.52);
          box-shadow: 0 0 0 4px rgba(194, 79, 46, 0.12);
        }
        .results {
          display: grid;
          gap: 8px;
          padding: 12px;
          max-height: min(56vh, 480px);
          overflow: auto;
        }
        .result-item {
          width: 100%;
          border: 1px solid rgba(103, 79, 53, 0.12);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.74);
          padding: 14px;
          text-align: left;
          cursor: pointer;
          box-sizing: border-box;
        }
        .result-item.active,
        .result-item:hover {
          border-color: rgba(194, 79, 46, 0.34);
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 12px 26px rgba(81, 49, 28, 0.12);
        }
        .result-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 6px;
        }
        .result-head strong {
          font-size: 14px;
          line-height: 1.35;
        }
        .pill {
          flex-shrink: 0;
          border-radius: 999px;
          padding: 3px 8px;
          background: rgba(43, 43, 43, 0.08);
          color: #665547;
          font-size: 11px;
          font-weight: 700;
        }
        .pill.chain {
          background: rgba(194, 79, 46, 0.12);
          color: #c24f2e;
        }
        .result-preview {
          color: #392b20;
          font-size: 13px;
          line-height: 1.45;
          margin-bottom: 6px;
        }
        .result-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          color: #7d6653;
          font-size: 12px;
        }
        .footer {
          padding: 0 18px 16px;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          color: #7d6653;
          font-size: 12px;
        }
        .status {
          color: #bc4444;
        }
        .empty-state {
          padding: 28px 12px;
          text-align: center;
          color: #7d6653;
          font-size: 13px;
        }
      </style>
      <div class="overlay" data-role="overlay">
        <div class="panel" role="dialog" aria-modal="true" aria-label="Quick palette">
          <div class="header">
            <div class="title">
              <span>Quick Palette</span>
              <span class="shortcut">Alt+Shift+F</span>
            </div>
            <input class="search" type="search" autocomplete="off" spellcheck="false" placeholder="Search favorites..." value="${escapeHtml(state.query)}" />
          </div>
          <div class="results">${listMarkup}</div>
          <div class="footer">
            <span>Enter to run, Esc to close</span>
            <span class="status">${escapeHtml(state.status)}</span>
          </div>
        </div>
      </div>
    `;
  }

  function bindUiEvents() {
    const overlay = state.shadow.querySelector("[data-role='overlay']");
    const input = state.shadow.querySelector(".search");
    const buttons = [...state.shadow.querySelectorAll("[data-favorite-id]")];

    overlay?.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closePalette();
      }
    });

    input?.addEventListener("input", (event) => {
      state.query = event.target.value;
      filterFavorites();
      render();
    });

    input?.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (state.filteredFavorites.length > 0) {
          state.activeIndex = (state.activeIndex + 1) % state.filteredFavorites.length;
          render();
        }
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (state.filteredFavorites.length > 0) {
          state.activeIndex = (state.activeIndex - 1 + state.filteredFavorites.length) % state.filteredFavorites.length;
          render();
        }
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        void executeActiveFavorite();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closePalette();
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
        void executeActiveFavorite();
      });
    });
  }

  function render() {
    ensureHost();
    state.shadow.innerHTML = buildMarkup();
    bindUiEvents();
    const input = state.shadow.querySelector(".search");
    if (input) {
      input.focus();
      input.setSelectionRange?.(input.value.length, input.value.length);
    }
  }

  async function loadFavorites() {
    const response = await sendRuntimeMessageWithTimeout({ action: "quickPalette:getState" }, 5000);
    if (!response?.ok) {
      throw new Error(response?.error ?? "Failed to load favorites.");
    }

    state.favorites = Array.isArray(response.favorites) ? response.favorites : [];
    filterFavorites();
  }

  async function openPalette() {
    state.status = "";
    state.query = "";
    state.activeIndex = 0;
    await loadFavorites();
    state.open = true;
    render();
  }

  function closePalette() {
    state.open = false;
    state.status = "";
    if (state.host) {
      state.host.remove();
    }
    state.host = null;
    state.shadow = null;
  }

  async function executeActiveFavorite() {
    const favorite = state.filteredFavorites[state.activeIndex];
    if (!favorite?.id) {
      return;
    }

    const response = await sendRuntimeMessageWithTimeout({
      action: "quickPalette:execute",
      favoriteId: favorite.id,
    }, 5000);

    if (response?.ok) {
      closePalette();
      return;
    }

    state.status = response?.error ?? "Unable to run this favorite.";
    render();
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    try {
      if (message?.action === "quickPalette:ping") {
        sendResponse({ ok: true });
        return false;
      }

      if (message?.action === "quickPalette:close") {
        closePalette();
        sendResponse({ ok: true });
        return false;
      }

      if (message?.action === "quickPalette:toggle") {
        void (async () => {
          if (state.open) {
            closePalette();
            sendResponse({ ok: true, open: false });
            return;
          }

          try {
            await openPalette();
            sendResponse({ ok: true, open: true });
          } catch (error) {
            closePalette();
            sendResponse({
              ok: false,
              error: error?.message ?? String(error),
            });
          }
        })();
        return true;
      }

      return false;
    } catch (error) {
      sendResponse({ ok: false, error: error?.message ?? String(error) });
      return false;
    }
  });
})();
