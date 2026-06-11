import type { RuntimeHandlerMap } from "../messages/router";
import type {
  ActiveTabContextResponse,
  BroadcastCounterResponse,
  BroadcastMessage,
  BroadcastResponse,
  CancelBroadcastMessage,
  CancelBroadcastResponse,
  ComparisonCaptureStartMessage,
  ComparisonCaptureStartResponse,
  ComparisonNoteDeleteMessage,
  ComparisonNoteDeleteResponse,
  ComparisonNoteListMessage,
  ComparisonNoteListResponse,
  ComparisonNoteSaveMessage,
  ComparisonNoteSaveResponse,
  ExperimentDeleteMessage,
  ExperimentDeleteResponse,
  ExperimentRunMessage,
  ExperimentRunResponse,
  ExperimentSaveMessage,
  ExperimentSaveResponse,
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
  ServiceGroupsUpdateMessage,
  ServiceGroupsUpdateResponse,
  ServiceHealthGetResponse,
  ServiceTestRunMessage,
  ServiceTestRunResponse,
  TemplatePackExportMessage,
  TemplatePackImportMessage,
  TemplatePackTransferResponse,
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
  handleServiceHealthGet: () => Promise<ServiceHealthGetResponse>;
  handleComparisonNoteList: (message: ComparisonNoteListMessage) => Promise<ComparisonNoteListResponse>;
  handleComparisonNoteSave: (message: ComparisonNoteSaveMessage) => Promise<ComparisonNoteSaveResponse>;
  handleComparisonNoteDelete: (message: ComparisonNoteDeleteMessage) => Promise<ComparisonNoteDeleteResponse>;
  handleComparisonCaptureStart: (message: ComparisonCaptureStartMessage) => Promise<ComparisonCaptureStartResponse>;
  handleExperimentSave: (message: ExperimentSaveMessage) => Promise<ExperimentSaveResponse>;
  handleExperimentDelete: (message: ExperimentDeleteMessage) => Promise<ExperimentDeleteResponse>;
  handleExperimentRun: (message: ExperimentRunMessage) => Promise<ExperimentRunResponse>;
  handleTemplatePackExport: (message: TemplatePackExportMessage) => Promise<TemplatePackTransferResponse>;
  handleTemplatePackImport: (message: TemplatePackImportMessage) => Promise<TemplatePackTransferResponse>;
  handleServiceGroupsUpdate: (message: ServiceGroupsUpdateMessage) => Promise<ServiceGroupsUpdateResponse>;
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
      senderPolicy: "any",
      run: (message) => deps.handleSelectorCheckInit(message),
      errorLabel: "[AI Prompt Broadcaster] Selector check init failed.",
    },
    "selector-check:report": {
      senderPolicy: "any",
      run: (message) => deps.handleSelectorCheckReport(message),
      errorLabel: "[AI Prompt Broadcaster] Selector check report failed.",
    },
    "service-test:run": {
      run: (message) => deps.handleServiceTestRun(message),
      errorLabel: "[AI Prompt Broadcaster] Service test run failed.",
    },
    selectorFailed: {
      senderPolicy: "any",
      run: (message) => deps.handleSelectorFailedMessage(message),
    },
    injectSuccess: {
      senderPolicy: "any",
      run: (message) => deps.handleInjectSuccessMessage(message),
    },
    injectFallback: {
      senderPolicy: "any",
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
      senderPolicy: "any",
      run: (message, sender) => deps.handleSelectionUpdateMessage(message, sender),
    },
    "quickPalette:getState": {
      senderPolicy: "any",
      run: () => deps.handleQuickPaletteGetState(),
    },
    "quickPalette:execute": {
      senderPolicy: "any",
      run: (message, sender) => deps.handleQuickPaletteExecuteMessage(message, sender),
    },
    "quickPalette:close": {
      sync: true,
      senderPolicy: "any",
      run: () => ({ ok: true }),
    },
    "service-health:get": {
      run: () => deps.handleServiceHealthGet(),
      errorLabel: "[AI Prompt Broadcaster] Service health retrieval failed.",
    },
    "comparison-note:list": {
      run: (message) => deps.handleComparisonNoteList(message),
    },
    "comparison-note:save": {
      run: (message) => deps.handleComparisonNoteSave(message),
    },
    "comparison-note:delete": {
      run: (message) => deps.handleComparisonNoteDelete(message),
    },
    "comparison-capture:start": {
      run: (message) => deps.handleComparisonCaptureStart(message),
      errorLabel: "[AI Prompt Broadcaster] Comparison capture failed.",
    },
    "experiment:save": {
      run: (message) => deps.handleExperimentSave(message),
    },
    "experiment:delete": {
      run: (message) => deps.handleExperimentDelete(message),
    },
    "experiment:run": {
      run: (message) => deps.handleExperimentRun(message),
      errorLabel: "[AI Prompt Broadcaster] Prompt experiment run failed.",
    },
    "template-pack:export": {
      run: (message) => deps.handleTemplatePackExport(message),
    },
    "template-pack:import": {
      run: (message) => deps.handleTemplatePackImport(message),
    },
    "service-groups:update": {
      run: (message) => deps.handleServiceGroupsUpdate(message),
    },
  };
}
