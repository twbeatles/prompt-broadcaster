import type { FavoriteRunExecutionContextSnapshot } from "../../shared/types/models";

export interface NormalizedPreparedExecutionContext {
  context: Partial<FavoriteRunExecutionContextSnapshot>;
  hasClipboardValue: boolean;
}

interface FavoriteExecutionContextDeps {
  rememberNormalTab: (tab: chrome.tabs.Tab | undefined) => Promise<chrome.tabs.Tab | null>;
  getPreferredNormalActiveTab: () => Promise<chrome.tabs.Tab | null>;
  isInjectableTabUrl: (url: string) => boolean;
  getSelectedTextFromTab: (tabId: number) => Promise<string>;
}

function hasOwn(value: unknown, key: string) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
    Object.prototype.hasOwnProperty.call(value, key);
}

export function createFavoriteExecutionContextTools(
  deps: FavoriteExecutionContextDeps,
) {
  const {
    rememberNormalTab,
    getPreferredNormalActiveTab,
    isInjectableTabUrl,
    getSelectedTextFromTab,
  } = deps;

  const createEmptyExecutionContext = (): FavoriteRunExecutionContextSnapshot => ({
    tabId: null,
    windowId: null,
    url: "",
    title: "",
    selection: "",
    clipboard: "",
  });

  function normalizePreparedExecutionContext(value: unknown): NormalizedPreparedExecutionContext {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {
        context: {},
        hasClipboardValue: false,
      };
    }

    const source = value as Record<string, unknown>;
    const tabId = Number(source.tabId);
    const windowId = Number(source.windowId);

    return {
      context: {
        ...(hasOwn(source, "tabId") ? { tabId: Number.isFinite(tabId) ? tabId : null } : {}),
        ...(hasOwn(source, "windowId") ? { windowId: Number.isFinite(windowId) ? windowId : null } : {}),
        ...(hasOwn(source, "url") ? { url: typeof source.url === "string" ? source.url : "" } : {}),
        ...(hasOwn(source, "title") ? { title: typeof source.title === "string" ? source.title : "" } : {}),
        ...(hasOwn(source, "selection") ? { selection: typeof source.selection === "string" ? source.selection : "" } : {}),
        ...(hasOwn(source, "clipboard") ? { clipboard: typeof source.clipboard === "string" ? source.clipboard : "" } : {}),
      },
      hasClipboardValue: hasOwn(source, "clipboard"),
    };
  }

  function mergeExecutionContext(
    base: FavoriteRunExecutionContextSnapshot,
    prepared: Partial<FavoriteRunExecutionContextSnapshot>,
  ): FavoriteRunExecutionContextSnapshot {
    return {
      tabId: hasOwn(prepared, "tabId") ? prepared.tabId ?? null : base.tabId,
      windowId: hasOwn(prepared, "windowId") ? prepared.windowId ?? null : base.windowId,
      url: hasOwn(prepared, "url") ? prepared.url ?? "" : base.url,
      title: hasOwn(prepared, "title") ? prepared.title ?? "" : base.title,
      selection: hasOwn(prepared, "selection") ? prepared.selection ?? "" : base.selection,
      clipboard: hasOwn(prepared, "clipboard") ? prepared.clipboard ?? "" : base.clipboard,
    };
  }

  async function getExecutionTabContextFromSender(
    sender: chrome.runtime.MessageSender | undefined,
  ): Promise<FavoriteRunExecutionContextSnapshot> {
    const senderTab = sender?.tab;
    if (senderTab && Number.isFinite(senderTab.id) && isInjectableTabUrl(senderTab.url ?? "")) {
      const senderTabId = Number(senderTab.id);
      await rememberNormalTab(senderTab).catch(() => null);
      return {
        tabId: senderTabId,
        windowId: Number.isFinite(senderTab.windowId) ? senderTab.windowId : null,
        url: typeof senderTab.url === "string" ? senderTab.url : "",
        title: typeof senderTab.title === "string" ? senderTab.title : "",
        selection: await getSelectedTextFromTab(senderTabId).catch(() => ""),
        clipboard: "",
      };
    }

    const activeTab = await getPreferredNormalActiveTab();
    if (!activeTab?.id || !isInjectableTabUrl(activeTab?.url ?? "")) {
      return createEmptyExecutionContext();
    }

    return {
      tabId: activeTab.id,
      windowId: Number.isFinite(activeTab.windowId) ? activeTab.windowId : null,
      url: typeof activeTab.url === "string" ? activeTab.url : "",
      title: typeof activeTab.title === "string" ? activeTab.title : "",
      selection: await getSelectedTextFromTab(activeTab.id).catch(() => ""),
      clipboard: "",
    };
  }

  return {
    createEmptyExecutionContext,
    normalizePreparedExecutionContext,
    mergeExecutionContext,
    getExecutionTabContextFromSender,
  };
}
