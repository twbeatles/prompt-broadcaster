import { getLastBroadcast } from "../../../shared/runtime-state";
import { sendRuntimeMessageWithTimeout } from "../../../shared/chrome/messaging";
import { setLastSentPrompt } from "../../../shared/prompt-state";
import type {
  BroadcastSiteTargetMessage,
  FavoriteRunResponse,
} from "../../../shared/types/messages";
import type {
  FavoriteExecutionTrigger,
  FavoritePrompt,
  PromptHistoryItem,
} from "../../../shared/types/models";
import type { PopupState } from "../../../shared/types/popup";
import { createPopupSendFlow } from "../../compose/send-flow";
import { createPopupTargetsController } from "../../compose/targets";
import { createPopupTemplateModal } from "../../compose/template-modal";
import { createFavoriteEditorFeature } from "../../favorites/favorite-editor";
import { createFavoritesController } from "../../favorites/controller";
import { createHistoryController } from "../../history/controller";
import { createPopupHistoryModals } from "../../history/modals";
import { createOverlayController } from "../../overlays/controller";
import { createPopupServicesController } from "../../services/controller";
import { initToastRoot } from "../../ui/toast";
import { popupDom } from "../dom";
import {
  applyI18n,
  buildServiceTestResultMessage,
  getUnknownErrorText,
  isKorean,
  t,
} from "../i18n";
import { createPopupRendering } from "../rendering";
import { createPopupShell } from "../shell";
import { createPopupShortcutController } from "../shortcuts";
import { state } from "../state";
import { createPopupComposerController } from "./composer";
import { bindPopupEvents } from "./events";
import { createPopupFavoriteIntentHandler } from "./favorite-intent";
import {
  getErrorMessage as formatErrorMessage,
  sendPopupMessage,
  type ComposerTarget,
  type PopupTabId,
} from "./helpers";
import { createPopupStorageController } from "./storage";

const { promptInput } = popupDom.compose;
const {
  templateModal,
  favoriteModal,
  resendModal,
  responsesModal,
  importReportModal,
} = popupDom.modals;
const { toastHost } = popupDom;

const popupShell = createPopupShell({
  isKorean,
  renderLists: () => renderLists(),
});
const {
  setStatus,
  clearStatus,
  showAppToast,
  showConfirmToast,
  setSendingState,
  clearSendSafetyTimer,
  armSendSafetyTimer,
  buildBroadcastToastSignature,
  getEnabledSites,
  getRuntimeSiteLabel,
  getSiteSelectorIssueUrl,
  getSiteLastVerifiedStatus,
  updatePromptCounter,
  autoResizePromptInput,
  scheduleComposeDraftSave,
  applyDynamicPromptPlaceholder,
  allCheckboxes,
  checkedSiteIds,
  syncToggleAllLabel,
  applySiteSelection,
  switchTab,
} = popupShell;

let renderTemplateSummary = (): void => undefined;
let renderSiteCheckboxesPanel = (): void => undefined;
let renderTabLabels = (): void => undefined;
let setCardStatesFromBroadcast = (
  _summary: PopupState["lastBroadcast"],
): void => undefined;
let renderManagedSites = (): void => undefined;
let renderHistoryList = (): void => undefined;
let renderFavoritesList = (): void => undefined;

function renderLists() {
  renderHistoryList();
  renderFavoritesList();
}

let hideFavoriteModal = (): void => undefined;
let hideTemplateModal = (): void => undefined;
let hideResendModal = (): void => undefined;
let hideResponsesModal = (): void => undefined;
let hideImportReportModal = (): void => undefined;
let openTemplateModalV2 = async (
  _prompt: string,
  _targets: ComposerTarget[],
): Promise<void> => undefined;
let openResendModal = (_historyItem: PromptHistoryItem): void => undefined;
let openResponsesModal = (_historyItem: PromptHistoryItem): void => undefined;
let openImportReportModal = (
  _summary: PopupState["pendingImportSummary"],
): void => undefined;
let setTemplateModalError = (_message?: string): void => undefined;
let requestFavoriteRun: (
  favorite: FavoritePrompt,
  options?: {
    trigger?: FavoriteExecutionTrigger;
    allowPopupFallback?: boolean;
  },
) => Promise<FavoriteRunResponse> = async () => ({
  ok: false,
  error: getUnknownErrorText(),
});
let applyLastBroadcastState = (
  _summary: PopupState["lastBroadcast"],
  _options: { silentToast?: boolean } = {},
): void => undefined;
let cancelCurrentBroadcast = async (): Promise<void> => undefined;
let sendResolvedPrompt = async (
  _mainPrompt: string,
  _targets: Array<ComposerTarget | BroadcastSiteTargetMessage>,
): Promise<void> => undefined;
let triggerRipple = (
  _button: HTMLButtonElement,
  _event: MouseEvent,
): void => undefined;
let bindHistoryModalEvents = (
  _getErrorMessage: (error: unknown) => string,
): void => undefined;
let bindTemplateModalEvents = (
  _onError: (message: string) => void,
): void => undefined;
let handleGlobalShortcut = async (_event: KeyboardEvent): Promise<void> => undefined;

const getErrorMessage = (error: unknown): string =>
  formatErrorMessage(error, getUnknownErrorText);

const popupTargetsController = createPopupTargetsController({
  getEnabledSites,
  getRuntimeSiteLabel,
  sendPopupMessage: (message, timeoutMs) =>
    sendPopupMessage<"getOpenAiTabs">(message, timeoutMs),
  renderSiteCheckboxesPanel: () => renderSiteCheckboxesPanel(),
});
const {
  getOpenSiteTabs,
  getDefaultTargetModeLabel,
  refreshOpenSiteTabs,
  scheduleOpenSiteTabsRefresh,
  buildComposerBroadcastTargets,
  buildRuntimeBroadcastTargets,
  detectTemplateVariablesForTargets,
  findMissingTemplateValuesForTargets,
  buildResolvedBroadcastTargets,
  buildTemplatePreviewText,
} = popupTargetsController;

const overlayController = createOverlayController({
  overlays: [importReportModal, responsesModal, resendModal, favoriteModal, templateModal],
  closeFavoriteModal: () => hideFavoriteModal(),
  hideTemplateModal,
  hideResendModal,
  hideResponsesModal,
  hideImportReportModal,
  renderLists,
});
const {
  openOverlay,
  closeOverlay,
  getOpenOverlay,
  closeActiveOverlayOrMenu,
  trapModalFocus,
} = overlayController;

const popupRendering = createPopupRendering({
  buildComposerBroadcastTargets,
  detectTemplateVariablesForTargets,
  checkedSiteIds,
  getEnabledSites,
  getRuntimeSiteLabel,
  getOpenSiteTabs,
  getDefaultTargetModeLabel,
  syncToggleAllLabel,
  setCardStatesFromBroadcast: (summary) => setCardStatesFromBroadcast(summary),
  applyDynamicPromptPlaceholder,
  updatePromptCounter,
});
renderTemplateSummary = popupRendering.renderTemplateSummary;
renderSiteCheckboxesPanel = popupRendering.renderSiteCheckboxesPanel;
renderTabLabels = popupRendering.renderTabLabels;

const popupStorageController = createPopupStorageController({
  refreshOpenSiteTabs,
  renderSiteCheckboxesPanel: () => renderSiteCheckboxesPanel(),
  renderManagedSites: () => renderManagedSites(),
  updatePromptCounter,
  autoResizePromptInput,
  renderTemplateSummary: () => renderTemplateSummary(),
  renderLists,
  renderSortControls: () => popupRendering.renderSortControls(),
  showAppToast,
});
const {
  applySettingsToControls,
  loadStoredData,
  refreshStoredData,
  flushPendingSessionToasts,
} = popupStorageController;

const popupSendFlow = createPopupSendFlow({
  refreshOpenSiteTabs,
  sendPopupMessage: async <TResponse>(
    message: object,
    timeoutMs?: number,
    fallbackValue?: TResponse | null,
  ) =>
    (await sendRuntimeMessageWithTimeout(
      message as Record<string, unknown>,
      timeoutMs,
      fallbackValue ?? null,
    )) as TResponse | null,
  buildRuntimeBroadcastTargets,
  setStatus,
  showAppToast,
  setSendingState,
  armSendSafetyTimer,
  clearSendSafetyTimer,
  buildBroadcastToastSignature,
  getUnknownErrorText,
  getErrorMessage,
  setLastSentPrompt,
});
applyLastBroadcastState = popupSendFlow.applyLastBroadcastState;
cancelCurrentBroadcast = popupSendFlow.cancelCurrentBroadcast;
setCardStatesFromBroadcast = popupSendFlow.setCardStatesFromBroadcast;
sendResolvedPrompt = popupSendFlow.sendResolvedPrompt;
triggerRipple = popupSendFlow.triggerRipple;

const popupTemplateModal = createPopupTemplateModal({
  sendPopupMessage: async <TResponse>(message: object, timeoutMs?: number) =>
    (await sendRuntimeMessageWithTimeout(
      message as Record<string, unknown>,
      timeoutMs,
    )) as TResponse | null,
  buildResolvedBroadcastTargets,
  detectTemplateVariablesForTargets,
  findMissingTemplateValuesForTargets,
  buildTemplatePreviewText,
  sendResolvedPrompt: (prompt, targets) => sendResolvedPrompt(prompt, targets),
  openOverlay,
  closeOverlay,
});
hideTemplateModal = popupTemplateModal.hideTemplateModal;
openTemplateModalV2 = popupTemplateModal.openTemplateModalV2;
setTemplateModalError = popupTemplateModal.setTemplateModalError;
requestFavoriteRun = popupTemplateModal.requestFavoriteRun;
bindTemplateModalEvents = popupTemplateModal.bindTemplateModalEvents;

const popupComposerController = createPopupComposerController({
  clearStatus,
  scheduleComposeDraftSave,
  applySiteSelection,
  renderTemplateSummary: () => renderTemplateSummary(),
  switchTab,
  setStatus,
  showAppToast,
  checkedSiteIds,
  buildComposerBroadcastTargets,
  openTemplateModalV2: (prompt, targets) => openTemplateModalV2(prompt, targets),
});
const { loadPromptIntoComposer, handleSend } = popupComposerController;

const popupHistoryModals = createPopupHistoryModals({
  getEnabledSites,
  runtimeSites: () => state.runtimeSites,
  openSiteTabs: () => state.openSiteTabs,
  setStatus,
  sendResolvedPrompt: (prompt, targets) => sendResolvedPrompt(prompt, targets),
  openOverlay,
  closeOverlay,
});
hideResendModal = popupHistoryModals.hideResendModal;
openResendModal = popupHistoryModals.openResendModal;
hideResponsesModal = popupHistoryModals.hideResponsesModal;
openResponsesModal = popupHistoryModals.openResponsesModal;
openImportReportModal = popupHistoryModals.openImportReportModal;
hideImportReportModal = popupHistoryModals.hideImportReportModal;
bindHistoryModalEvents = popupHistoryModals.bindHistoryModalEvents;

const popupShortcutController = createPopupShortcutController({
  closeActiveOverlayOrMenu,
  getOpenOverlay,
  cancelCurrentBroadcast: () => cancelCurrentBroadcast(),
  handleSend,
  switchTab,
});
handleGlobalShortcut = popupShortcutController.handleGlobalShortcut;

const favoriteEditorFeature = createFavoriteEditorFeature({
  checkedSiteIds,
  getEnabledSites,
  getRuntimeSiteLabel,
  refreshStoredData,
  requestFavoriteRun,
  setStatus,
  showAppToast,
  getUnknownErrorText,
  openOverlay,
  closeOverlay,
});
const {
  getFavoriteById,
  openFavoriteModal,
  openFavoriteEditor,
  runFavoriteItem,
  bindFavoriteEditorEvents,
} = favoriteEditorFeature;
hideFavoriteModal = favoriteEditorFeature.hideFavoriteModal;

const popupFavoriteIntentHandler = createPopupFavoriteIntentHandler({
  getFavoriteById: (favoriteId) => getFavoriteById(favoriteId) ?? undefined,
  requestFavoriteRun,
  openFavoriteEditor,
  setStatus,
  showAppToast,
  getUnknownErrorText,
});
const { maybeHandlePopupFavoriteIntent } = popupFavoriteIntentHandler;

const favoritesController = createFavoritesController({
  switchTab,
  loadPromptIntoComposer,
  openFavoriteEditor,
  runFavoriteItem,
  setStatus,
  showAppToast,
  getUnknownErrorText,
});
renderFavoritesList = favoritesController.renderFavoritesList;

const historyController = createHistoryController({
  switchTab,
  loadPromptIntoComposer,
  openResponsesModal,
  openResendModal,
  renderFavoritesList,
  setStatus,
  showAppToast,
});
renderHistoryList = historyController.renderHistoryList;

const popupServicesController = createPopupServicesController({
  refreshStoredData,
  setStatus,
  showAppToast,
  getErrorMessage,
  buildServiceTestResultMessage,
  sendPopupMessage: (message, timeoutMs) =>
    sendPopupMessage<"service-test:run">(message, timeoutMs),
  getSiteLastVerifiedStatus,
  getSiteSelectorIssueUrl,
});
const {
  resetServiceEditorForm,
  hideServiceEditor,
  populateServiceEditor,
  renderServicePermissionPreview,
  renderManagedSites: renderManagedSitesImpl,
  testSelectorOnActiveTab,
  saveServiceEditorDraft,
  deleteManagedSite,
} = popupServicesController;
renderManagedSites = renderManagedSitesImpl;

function resetTransientModals() {
  hideTemplateModal();
  hideFavoriteModal();
  hideResendModal();
  hideResponsesModal();
  hideImportReportModal();
}

async function init() {
  try {
    applyI18n();
    document.documentElement.lang = isKorean ? "ko" : "en";
    resetTransientModals();
    initToastRoot(toastHost);
    renderTabLabels();
    bindPopupEvents({
      status: {
        setStatus,
        clearStatus,
        showAppToast,
        showConfirmToast,
        getErrorMessage,
      },
      compose: {
        switchTab,
        scheduleComposeDraftSave,
        updatePromptCounter,
        autoResizePromptInput,
        renderTemplateSummary: () => renderTemplateSummary(),
        allCheckboxes,
        syncToggleAllLabel,
        openFavoriteModal,
        cancelCurrentBroadcast: () => cancelCurrentBroadcast(),
        triggerRipple,
        handleSend,
      },
      lists: {
        renderHistoryList: () => renderHistoryList(),
        renderFavoritesList: () => renderFavoritesList(),
        renderLists,
        historyController,
        favoritesController,
      },
      storage: {
        applySettingsToControls,
        renderSiteCheckboxesPanel: () => renderSiteCheckboxesPanel(),
        refreshStoredData,
        loadStoredData,
        flushPendingSessionToasts,
      },
      services: {
        resetServiceEditorForm,
        populateServiceEditor,
        hideServiceEditor,
        deleteManagedSite,
        testSelectorOnActiveTab,
        renderServicePermissionPreview,
        saveServiceEditorDraft,
      },
      modals: {
        setTemplateModalError,
        bindTemplateModalEvents,
        bindFavoriteEditorEvents,
        bindHistoryModalEvents,
        openImportReportModal,
      },
      runtime: {
        trapModalFocus,
        handleGlobalShortcut,
        scheduleOpenSiteTabsRefresh,
        applyLastBroadcastState,
      },
    });
    const hashTabMap: Partial<Record<string, PopupTabId>> = {
      "#compose": "compose",
      "#history": "history",
      "#favorites": "favorites",
      "#settings": "settings",
    };
    const hashTab = hashTabMap[location.hash];
    if (hashTab) {
      state.activeTab = hashTab;
    }
    switchTab(state.activeTab);
    syncToggleAllLabel();
    await loadStoredData();
    await maybeHandlePopupFavoriteIntent();
    await sendRuntimeMessageWithTimeout({ action: "popupOpened" }, 1000);
    applyLastBroadcastState(await getLastBroadcast(), { silentToast: false });
    await flushPendingSessionToasts();
    if (!getOpenOverlay()) {
      promptInput.focus();
    }
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to initialize popup.", error);
    const errorMessage = t.error(getErrorMessage(error));
    setStatus(errorMessage, "error");
    showAppToast(errorMessage, "error", 4000);
  }
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      void init();
    },
    { once: true },
  );
} else {
  void init();
}
