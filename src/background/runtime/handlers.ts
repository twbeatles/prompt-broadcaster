import type { RuntimeHandlerMap } from "../messages/router";
import type {
  ActiveTabContextResponse,
  BroadcastCounterResponse,
  BroadcastMessage,
  BroadcastResponse,
  CancelBroadcastMessage,
  CancelBroadcastResponse,
  FavoriteOpenEditorMessage,
  FavoriteOpenEditorResponse,
  FavoriteRunMessage,
  FavoriteRunResponse,
  GenericOkResponse,
  GetOpenAiTabsMessage,
  GetOpenAiTabsResponse,
  QuickPaletteExecuteMessage,
  QuickPaletteGetStateResponse,
  PopupOpenedResponse,
  SelectorCheckInitMessage,
  SelectorCheckInitResponse,
  SelectorCheckReportMessage,
  SelectorCheckReportResponse,
  SelectionUpdateMessage,
  ServiceTestRunMessage,
  ServiceTestRunResponse,
} from "../../shared/types/messages";

interface BackgroundRuntimeHandlerDeps {
  handleBroadcastMessage: (message: BroadcastMessage) => Promise<BroadcastResponse>;
  handleSelectorCheckInit: (message: SelectorCheckInitMessage) => Promise<SelectorCheckInitResponse>;
  handleSelectorCheckReport: (message: SelectorCheckReportMessage) => Promise<SelectorCheckReportResponse>;
  handleServiceTestRun: (message: ServiceTestRunMessage) => Promise<ServiceTestRunResponse>;
  handleSelectorFailedMessage: (message: unknown) => Promise<GenericOkResponse>;
  handleInjectSuccessMessage: (message: unknown) => Promise<GenericOkResponse>;
  handleInjectFallbackMessage: (message: unknown) => Promise<GenericOkResponse>;
  handleUiToastMessage: (message: unknown) => Promise<GenericOkResponse>;
  handlePopupOpened: () => Promise<PopupOpenedResponse>;
  handleGetOpenAiTabsMessage: (message: GetOpenAiTabsMessage) => Promise<GetOpenAiTabsResponse>;
  handleCancelBroadcastMessage: (message: CancelBroadcastMessage) => Promise<CancelBroadcastResponse>;
  handleFavoriteRunMessage: (
    message: FavoriteRunMessage,
    sender: chrome.runtime.MessageSender,
  ) => Promise<FavoriteRunResponse>;
  handleFavoriteOpenEditorMessage: (message: FavoriteOpenEditorMessage) => Promise<FavoriteOpenEditorResponse>;
  resetAllExtensionData: () => Promise<GenericOkResponse>;
  handleGetActiveTabContext: () => Promise<ActiveTabContextResponse>;
  handleGetBroadcastCounter: () => Promise<BroadcastCounterResponse>;
  handleSelectionUpdateMessage: (
    message: SelectionUpdateMessage,
    sender: chrome.runtime.MessageSender,
  ) => GenericOkResponse;
  handleQuickPaletteGetState: () => Promise<QuickPaletteGetStateResponse>;
  handleQuickPaletteExecuteMessage: (
    message: QuickPaletteExecuteMessage,
    sender: chrome.runtime.MessageSender,
  ) => Promise<FavoriteRunResponse>;
}

export function buildRuntimeHandlers(
  deps: BackgroundRuntimeHandlerDeps,
): RuntimeHandlerMap {
  return {
    broadcast: {
      run: (message) => deps.handleBroadcastMessage(message),
      errorLabel: "[AI Prompt Broadcaster] Broadcast handling failed.",
    },
    "selector-check:init": {
      run: (message) => deps.handleSelectorCheckInit(message),
      errorLabel: "[AI Prompt Broadcaster] Selector check init failed.",
    },
    "selector-check:report": {
      run: (message) => deps.handleSelectorCheckReport(message),
      errorLabel: "[AI Prompt Broadcaster] Selector check report failed.",
    },
    "service-test:run": {
      run: (message) => deps.handleServiceTestRun(message),
      errorLabel: "[AI Prompt Broadcaster] Service test run failed.",
    },
    selectorFailed: {
      run: (message) => deps.handleSelectorFailedMessage(message),
    },
    injectSuccess: {
      run: (message) => deps.handleInjectSuccessMessage(message),
    },
    injectFallback: {
      run: (message) => deps.handleInjectFallbackMessage(message),
    },
    uiToast: {
      run: (message) => deps.handleUiToastMessage(message),
    },
    popupOpened: {
      run: () => deps.handlePopupOpened(),
    },
    getOpenAiTabs: {
      run: (message) => deps.handleGetOpenAiTabsMessage(message),
    },
    cancelBroadcast: {
      run: (message) => deps.handleCancelBroadcastMessage(message),
    },
    "favorite:run": {
      run: (message, sender) => deps.handleFavoriteRunMessage(message, sender),
    },
    "favorite:openEditor": {
      run: (message) => deps.handleFavoriteOpenEditorMessage(message),
    },
    resetAllData: {
      run: () => deps.resetAllExtensionData(),
      errorLabel: "[AI Prompt Broadcaster] Reset-all-data failed.",
    },
    getActiveTabContext: {
      run: () => deps.handleGetActiveTabContext(),
      onError: (error, fallback) => ({
        ...fallback,
        url: "",
        title: "",
        selection: "",
      }),
    },
    getBroadcastCounter: {
      run: () => deps.handleGetBroadcastCounter(),
      onError: (error, fallback) => ({
        ...fallback,
        counter: 0,
      }),
    },
    "selection:update": {
      sync: true,
      run: (message, sender) => deps.handleSelectionUpdateMessage(message, sender),
    },
    "quickPalette:getState": {
      run: () => deps.handleQuickPaletteGetState(),
    },
    "quickPalette:execute": {
      run: (message, sender) => deps.handleQuickPaletteExecuteMessage(message, sender),
    },
    "quickPalette:close": {
      sync: true,
      run: () => ({ ok: true }),
    },
  };
}
