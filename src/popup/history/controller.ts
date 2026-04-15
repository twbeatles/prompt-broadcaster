import {
  addFavoriteFromHistory,
  deletePromptHistoryItem,
  getPromptFavorites,
  getPromptHistory,
} from "../../shared/prompts";
import type { PromptHistoryItem } from "../../shared/types/models";
import { popupDom } from "../app/dom";
import { buildEmptyState, buildHistoryItemMarkup } from "../app/list-markup";
import { sortHistoryItemsForDisplay } from "../app/sorting";
import { state } from "../app/state";
import { t } from "../app/i18n";

const { historyList } = popupDom.history;

function filterItems(items: PromptHistoryItem[], query: string): PromptHistoryItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return items;
  }

  return items.filter((item) =>
    String(item.text).toLowerCase().includes(normalizedQuery),
  );
}

interface HistoryControllerDeps {
  switchTab: (tabId: "compose" | "history" | "favorites" | "settings") => void;
  loadPromptIntoComposer: (item: PromptHistoryItem & { templateDefaults: Record<string, string>; title: string }) => void;
  openResendModal: (item: PromptHistoryItem) => void;
  renderFavoritesList: () => void;
  setStatus: (text: string, type?: string) => void;
  showAppToast: (input: string, type?: string, duration?: number) => void;
}

export function createHistoryController(deps: HistoryControllerDeps) {
  const {
    switchTab,
    loadPromptIntoComposer,
    openResendModal,
    renderFavoritesList,
    setStatus,
    showAppToast,
  } = deps;

  function renderHistoryList(): void {
    const items = sortHistoryItemsForDisplay(
      filterItems(state.history, state.historySearch),
      state.settings.historySort,
    );

    if (items.length === 0) {
      historyList.innerHTML = buildEmptyState(
        state.historySearch ? t.noSearchResults : t.historyEmpty,
      );
      return;
    }

    historyList.innerHTML = items
      .map((item) => buildHistoryItemMarkup(item, {
        openMenuKey: state.openMenuKey,
        runtimeSites: state.runtimeSites,
      }))
      .join("");
  }

  async function handleHistoryAction(action: string | undefined, historyId: string | undefined): Promise<void> {
    const item = state.history.find((entry) => Number(entry.id) === Number(historyId));
    if (!item) {
      return;
    }

    if (action === "favorite") {
      await addFavoriteFromHistory(item);
      state.favorites = await getPromptFavorites();
      state.openMenuKey = null;
      renderFavoritesList();
      renderHistoryList();
      setStatus(t.favoriteAdded, "success");
      showAppToast(t.favoriteAdded, "success", 2200);
      return;
    }

    if (action === "resend-history") {
      state.openMenuKey = null;
      renderHistoryList();
      openResendModal(item);
      return;
    }

    if (action === "delete-history") {
      if (!historyId) {
        return;
      }
      await deletePromptHistoryItem(historyId);
      state.history = await getPromptHistory();
      state.openMenuKey = null;
      renderHistoryList();
      setStatus(t.historyDeleted, "success");
      showAppToast(t.toastHistoryDeleted, "info", 2200);
    }
  }

  function handleHistoryListClick(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const switchButton = target?.closest("[data-switch-tab='compose']");
    if (switchButton) {
      switchTab("compose");
      return;
    }

    const loadButton = target?.closest<HTMLElement>("[data-load-history]");
    if (loadButton) {
      const item = state.history.find(
        (entry) => Number(entry.id) === Number(loadButton.dataset.loadHistory),
      );
      if (item) {
        loadPromptIntoComposer({ ...item, templateDefaults: {}, title: "" });
      }
      return;
    }

    const menuToggle = target?.closest<HTMLElement>("[data-toggle-menu]");
    if (menuToggle) {
      const menuKey = menuToggle.dataset.toggleMenu ?? null;
      state.openMenuKey = state.openMenuKey === menuKey ? null : menuKey;
      renderHistoryList();
      return;
    }

    const actionButton = target?.closest<HTMLElement>("[data-action][data-history-id]");
    if (actionButton) {
      void handleHistoryAction(
        actionButton.dataset.action,
        actionButton.dataset.historyId,
      ).catch((error) => {
        console.error("[AI Prompt Broadcaster] History action failed.", error);
      });
    }
  }

  function handleHistoryListContextMenu(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const item = target?.closest<HTMLElement>("[data-history-id]");
    if (!item) {
      return;
    }

    event.preventDefault();
    state.openMenuKey = `history:${item.dataset.historyId}`;
    renderHistoryList();
  }

  return {
    renderHistoryList,
    handleHistoryAction,
    handleHistoryListClick,
    handleHistoryListContextMenu,
  };
}
