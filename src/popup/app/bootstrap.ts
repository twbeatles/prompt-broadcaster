import {
  detectTemplateVariablesForTargets as detectBroadcastTemplateVariables,
  findMissingTemplateValuesForTargets as findMissingBroadcastTemplateValues,
  resolveBroadcastTargets,
} from "../../shared/broadcast/resolution";
import {
  buildBroadcastTargetMessageFromSnapshot,
  ensureBroadcastTargetSnapshots,
} from "../../shared/broadcast/target-snapshots";
import {
  SYSTEM_TEMPLATE_VARIABLES,
  buildSystemTemplateValues,
  detectTemplateVariables,
  findMissingTemplateValues,
  getTemplateVariableDisplayName,
  renderTemplatePrompt,
} from "../../shared/template";
import {
  addFavoriteFromHistory,
  clearPromptHistory,
  createFavoritePrompt,
  deleteFavoriteItem,
  deletePromptHistoryItem,
  duplicateFavoriteItem,
  exportPromptData,
  getAppSettings,
  getPromptFavorites,
  getPromptHistory,
  getTemplateVariableCache,
  importPromptData,
  markFavoriteUsed,
  normalizeResultCode,
  updateFavoriteTitle,
  updateFavoriteMeta,
  updateFavoritePrompt,
  updateAppSettings,
  updateTemplateVariableCache,
} from "../../shared/prompts";
import {
  consumePopupPromptIntent,
  getComposeDraftPrompt,
  getLastSentPrompt,
  pickRestoredComposePrompt,
  setComposeDraftPrompt,
  setLastSentPrompt,
} from "../../shared/prompt-state";
import {
  consumePopupFavoriteIntent,
  drainPendingUiToasts,
  getFavoriteRunJobs,
  getFailedSelectors,
  getLastBroadcast,
} from "../../shared/runtime-state";
import {
  deleteCustomSite,
  getRuntimeSites,
  requestOriginPermissions,
  resetSiteSettings,
  saveBuiltInSiteOverride,
  saveCustomSite,
  setRuntimeSiteEnabled,
  validateHostnameAliases,
  validateSiteDraft,
} from "../../shared/sites";
import { sortSitesByOrder } from "../../shared/sites/order";
import { sendRuntimeMessageWithTimeout } from "../../shared/chrome/messaging";
import { matchesFavoriteSearch } from "../../shared/prompts/search";
import { clearAllToasts, initToastRoot, showToast } from "../ui/toast";
import {
  applyI18n,
  buildImportSummaryText,
  buildServiceTestResultMessage,
  getUnknownErrorText,
  isKorean,
  msg,
  t,
  uiLanguage,
} from "./i18n";
import { state } from "./state";
import { popupDom } from "./dom";
import { createPopupShell } from "./shell";
import { createPopupRendering } from "./rendering";
import { createPopupShortcutController } from "./shortcuts";
import {
  compareDateValues,
  escapeAttribute,
  escapeHtml,
  formatDate,
  getSiteIcon,
  isTextEditingTarget,
  joinMultilineValues,
  normalizeSiteIdList,
  previewText,
  splitMultilineValues,
} from "./helpers";
import {
  buildEmptyState,
  buildFavoriteItemMarkup,
  buildHistoryItemMarkup,
  buildImportReportMarkup,
  getHistorySelectedSiteIds,
  renderServiceBadges,
} from "./list-markup";
import {
  getFavoriteSortOptions,
  getHistorySortOptions,
  sortFavoriteItemsForDisplay,
  sortHistoryItemsForDisplay,
} from "./sorting";
import { createFavoriteEditorFeature } from "../favorites/favorite-editor";
import { createPopupTargetsController } from "../compose/targets";
import { createPopupSendFlow, isLastBroadcastSummary } from "../compose/send-flow";
import { createPopupTemplateModal } from "../compose/template-modal";
import { createHistoryController } from "../history/controller";
import { createPopupHistoryModals } from "../history/modals";
import { createFavoritesController } from "../favorites/controller";
import { createOverlayController } from "../overlays/controller";
import {
  createPopupServicesController,
  type ServiceDraft,
} from "../services/controller";
import type { SiteDraftValidationResult } from "../../shared/sites/validation";
import type {
  ActiveTabContextResponse,
  BroadcastSiteTargetMessage,
  BroadcastCounterResponse,
  BroadcastResponse,
  CancelBroadcastResponse,
  FavoriteRunResponse,
  GetOpenAiTabsResponse,
  RuntimeAction,
  RuntimeMessageOf,
  RuntimeResponseOf,
  ServiceTestRunResponse,
} from "../../shared/types/messages";
import type {
  FavoriteExecutionTrigger,
  FavoritePrompt,
  LastBroadcastSummary,
  OpenSiteTab,
  PromptHistoryItem,
  RuntimeSite,
  TemplateVariableDescriptor,
} from "../../shared/types/models";
import type {
  PopupState,
  PopupTemplateSendState,
  PopupToastInput,
} from "../../shared/types/popup";

type ComposerTarget = NonNullable<PopupTemplateSendState["targets"]>[number];
type PopupTabId = PopupState["activeTab"];

async function sendPopupMessage<TAction extends RuntimeAction>(
  message: RuntimeMessageOf<TAction>,
  timeoutMs?: number,
  fallbackValue?: RuntimeResponseOf<TAction> | null,
): Promise<RuntimeResponseOf<TAction> | null> {
  return sendRuntimeMessageWithTimeout(message, timeoutMs, fallbackValue);
}

function hasTargetId(
  target: ComposerTarget | BroadcastSiteTargetMessage,
): target is ComposerTarget {
  return typeof target.id === "string" && target.id.trim().length > 0;
}

function getEventElement(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : null;
}

function getEventInput(target: EventTarget | null): HTMLInputElement | null {
  return target instanceof HTMLInputElement ? target : null;
}

function getEventSelect(target: EventTarget | null): HTMLSelectElement | null {
  return target instanceof HTMLSelectElement ? target : null;
}

function getImportErrorSummary(error: unknown): PopupState["pendingImportSummary"] {
  if (!error || typeof error !== "object" || !("importSummary" in error)) {
    return null;
  }

  const summary = (error as { importSummary?: PopupState["pendingImportSummary"] }).importSummary;
  return summary ?? null;
}

const { extTitle, extDesc } = popupDom.header;
const { tabButtons, panels } = popupDom.tabs;
const {
  promptInput,
  promptCounter,
  clearPromptBtn,
  templateSummary,
  templateSummaryLabel,
  templateChipList,
  sitesLabel,
  sitesContainer,
  toggleAllBtn,
  saveFavoriteBtn,
  cancelSendBtn,
  sendBtn,
  statusMsg,
} = popupDom.compose;
const { historySearchInput, historySortSelect, historyList } = popupDom.history;
const { favoritesSearchInput, favoritesSortSelect, favoritesList } = popupDom.favorites;
const {
  settingsTitle,
  settingsDesc,
  reuseExistingTabsToggle,
  reuseExistingTabsLabel,
  reuseExistingTabsDesc,
  openOptionsBtn,
  clearHistoryBtn,
  exportJsonBtn,
  importJsonBtn,
  importJsonInput,
  waitMultiplierLabel,
  waitMultiplierRange,
  waitMultiplierValue,
} = popupDom.settings;
const {
  serviceManagementTitle,
  serviceManagementDesc,
  addServiceBtn,
  resetSitesBtn,
  managedSitesList,
  serviceEditor,
  serviceEditorTitle,
  serviceEditorDesc,
  serviceNameLabel,
  serviceNameInput,
  serviceUrlLabel,
  serviceUrlInput,
  serviceInputSelectorLabel,
  serviceInputSelectorInput,
  testSelectorBtn,
  serviceInputTypeLabel,
  serviceSubmitSelectorLabel,
  serviceSubmitSelectorInput,
  serviceSubmitMethodLabel,
  serviceSubmitMethodSelect,
  serviceAdvancedTitle,
  serviceFallbackSelectorsLabel,
  serviceFallbackSelectorsInput,
  serviceAuthSelectorsLabel,
  serviceAuthSelectorsInput,
  serviceHostnameAliasesLabel,
  serviceHostnameAliasesInput,
  serviceSupportedRoutesLabel,
  serviceSupportedRoutesInput,
  servicePermissionPreview,
  serviceVerifiedAtLabel,
  serviceVerifiedAtInput,
  serviceVerifiedRouteLabel,
  serviceVerifiedRouteInput,
  serviceVerifiedAuthStateLabel,
  serviceVerifiedAuthStateSelect,
  serviceVerifiedLocaleLabel,
  serviceVerifiedLocaleInput,
  serviceVerifiedVersionLabel,
  serviceVerifiedVersionInput,
  serviceWaitLabel,
  serviceWaitRange,
  serviceWaitValue,
  serviceColorLabel,
  serviceColorInput,
  serviceIconLabel,
  serviceIconInput,
  serviceEnabledLabel,
  serviceEnabledInput,
  serviceTestResult,
  serviceEditorError,
  serviceEditorCancel,
  serviceEditorSave,
} = popupDom.serviceManagement;
const {
  templateModal,
  templateModalTitle,
  templateModalDesc,
  templateModalClose,
  templateModalSystemInfo,
  templateFields,
  templatePreviewLabel,
  templatePreview,
  templateModalError,
  templateModalCancel,
  templateModalConfirm,
  favoriteModal,
  favoriteModalTitle,
  favoriteModalDesc,
  favoriteModalClose,
  favoriteTitleLabel,
  favoriteTitleInput,
  favoriteModeLabel,
  favoriteModeSelect,
  favoriteTargetsLabel,
  favoriteTargetsList,
  favoriteTagsLabel,
  favoriteTagsInput,
  favoriteFolderLabel,
  favoriteFolderInput,
  favoritePinnedInput,
  favoritePinnedLabel,
  favoriteScheduleEnabledRow,
  favoriteScheduleEnabled,
  favoriteScheduleEnabledLabel,
  favoriteScheduleFields,
  favoriteScheduledAtLabel,
  favoriteScheduledAtInput,
  favoriteScheduleRepeatLabel,
  favoriteScheduleRepeatSelect,
  favoriteSaveDefaultsRow,
  favoriteSaveDefaults,
  favoriteSaveDefaultsLabel,
  favoriteDefaultFieldsWrap,
  favoriteDefaultFieldsLabel,
  favoriteDefaultFields,
  favoriteChainWrap,
  favoriteChainTitle,
  favoriteChainDesc,
  favoriteChainList,
  favoriteChainAddStep,
  favoriteModalError,
  favoriteModalCancel,
  favoriteModalRun,
  favoriteModalConfirm,
  resendModal,
  resendModalTitle,
  resendModalDesc,
  resendModalSites,
  resendModalClose,
  resendModalCancel,
  resendModalConfirm,
  importReportModal,
  importReportModalTitle,
  importReportModalDesc,
  importReportBody,
  importReportModalClose,
  importReportModalConfirm,
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
let setCardStatesFromBroadcast = (_summary: PopupState["lastBroadcast"]): void => undefined;
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
  syncSiteTargetSelections,
  refreshOpenSiteTabs,
  scheduleOpenSiteTabsRefresh,
  buildComposerBroadcastTargets,
  buildRuntimeBroadcastTargets,
  detectTemplateVariablesForTargets,
  findMissingTemplateValuesForTargets,
  buildResolvedBroadcastTargets,
  buildTemplatePreviewText,
} = popupTargetsController;

let renderHistoryList = (): void => undefined;
let renderFavoritesList = (): void => undefined;
let scheduleFavoriteTitleSave: (
  favoriteId: string,
  title: string,
  immediate?: boolean,
) => void = () => undefined;

function renderLists() {
  renderHistoryList();
  renderFavoritesList();
}

let hideFavoriteModal = (): void => undefined;
let hideTemplateModal = (): void => undefined;
let hideResendModal = (): void => undefined;
let hideImportReportModal = (): void => undefined;
let openTemplateModalV2 = async (
  _prompt: string,
  _targets: ComposerTarget[],
): Promise<void> => undefined;
let openResendModal = (_historyItem: PromptHistoryItem): void => undefined;
let openImportReportModal = (_summary: PopupState["pendingImportSummary"]): void => undefined;
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
let triggerRipple = (_button: HTMLButtonElement, _event: MouseEvent): void => undefined;
let bindHistoryModalEvents = (_getErrorMessage: (error: unknown) => string): void => undefined;
let bindTemplateModalEvents = (_onError: (message: string) => void): void => undefined;
let handleGlobalShortcut = async (_event: KeyboardEvent): Promise<void> => undefined;
let hasRestoredStoredPrompt = false;

const overlayController = createOverlayController({
  overlays: [importReportModal, resendModal, favoriteModal, templateModal],
  closeFavoriteModal: () => hideFavoriteModal(),
  hideTemplateModal,
  hideResendModal,
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

function applySettingsToControls() {
  reuseExistingTabsToggle.checked = Boolean(state.settings.reuseExistingTabs);
  reuseExistingTabsLabel.textContent = t.reuseTabsLabel;
  reuseExistingTabsDesc.textContent = state.settings.reuseExistingTabs
    ? t.reuseTabsDescEnabled
    : t.reuseTabsDescDisabled;
  waitMultiplierLabel.textContent = t.waitMultiplierLabel;
  waitMultiplierRange.value = String(state.settings.waitMsMultiplier);
  waitMultiplierValue.textContent = t.waitMultiplierValue(state.settings.waitMsMultiplier);
  popupRendering.renderSortControls();
}

async function loadStoredData() {
  try {
    const [
      history,
      favorites,
      variableCache,
      runtimeSites,
      promptIntent,
      composeDraftPrompt,
      lastSentPrompt,
      failedSelectors,
      favoriteJobs,
      settings,
    ] = await Promise.all([
      getPromptHistory(),
      getPromptFavorites(),
      getTemplateVariableCache(),
      getRuntimeSites(),
      consumePopupPromptIntent(),
      getComposeDraftPrompt(),
      getLastSentPrompt(),
      getFailedSelectors(),
      getFavoriteRunJobs(),
      getAppSettings(),
    ]);

    state.history = history;
    state.favorites = favorites;
    state.templateVariableCache = variableCache;
    state.runtimeSites = sortSitesByOrder(runtimeSites, settings.siteOrder);
    state.failedSelectors = new Map(failedSelectors.map((entry) => [entry.serviceId, entry]));
    state.favoriteJobs = favoriteJobs;
    state.settings = settings;

    await refreshOpenSiteTabs();

    if (!hasRestoredStoredPrompt) {
      promptInput.value = pickRestoredComposePrompt({
        currentPrompt: promptInput.value,
        popupPromptIntent: promptIntent,
        composeDraftPrompt,
        lastSentPrompt,
      });
      hasRestoredStoredPrompt = true;
    }

    applySettingsToControls();
    renderSiteCheckboxesPanel();
    renderManagedSites();
    updatePromptCounter();
    autoResizePromptInput();
    renderTemplateSummary();
    renderLists();
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to load stored data.", error);
    throw error;
  }
}

async function refreshStoredData() {
  try {
    const [history, favorites, variableCache, runtimeSites, failedSelectors, favoriteJobs, settings] = await Promise.all([
      getPromptHistory(),
      getPromptFavorites(),
      getTemplateVariableCache(),
      getRuntimeSites(),
      getFailedSelectors(),
      getFavoriteRunJobs(),
      getAppSettings(),
    ]);

    state.history = history;
    state.favorites = favorites;
    state.templateVariableCache = variableCache;
    state.runtimeSites = sortSitesByOrder(runtimeSites, settings.siteOrder);
    state.failedSelectors = new Map(failedSelectors.map((entry) => [entry.serviceId, entry]));
    state.favoriteJobs = favoriteJobs;
    state.settings = settings;
    await refreshOpenSiteTabs();
    applySettingsToControls();
    renderSiteCheckboxesPanel();
    renderManagedSites();
    renderLists();
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to refresh stored data.", error);
    throw error;
  }
}

const popupSendFlow = createPopupSendFlow({
  refreshOpenSiteTabs,
  sendPopupMessage: async <TResponse>(message: object, timeoutMs?: number, fallbackValue?: TResponse | null) =>
    (await sendRuntimeMessageWithTimeout(
      message as RuntimeMessageOf<RuntimeAction>,
      timeoutMs,
      fallbackValue as RuntimeResponseOf<RuntimeAction> | null | undefined,
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
      message as RuntimeMessageOf<RuntimeAction>,
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
  setFavoriteModalError,
  dismissFavoriteModal,
  openFavoriteModal,
  openFavoriteEditor,
  runFavoriteItem,
  runFavoriteFromEditor,
  bindFavoriteEditorEvents,
} = favoriteEditorFeature;
hideFavoriteModal = favoriteEditorFeature.hideFavoriteModal;

async function maybeHandlePopupFavoriteIntent() {
  const intent = await consumePopupFavoriteIntent().catch(() => null);
  if (!intent?.favoriteId) {
    return;
  }

  const favorite = getFavoriteById(intent.favoriteId);
  if (!favorite) {
    return;
  }

  let runReason = intent.reason || t.favoriteRunNeedsEditor;

  if (intent.type === "run") {
    const response = await requestFavoriteRun(favorite, {
      trigger: intent.source === "options-edit" ? "popup" : (intent.source ?? "popup"),
      allowPopupFallback: false,
    });

    if (response?.ok) {
      const message = response?.message ?? t.favoriteRunQueued;
      setStatus(message, "success");
      showAppToast(message, "success", 2200);
      return;
    }

    if (!response?.requiresPopupInput) {
      const errorMessage = response?.error ?? getUnknownErrorText();
      setStatus(t.error(errorMessage), "error");
      showAppToast(t.error(errorMessage), "error", 3200);
      return;
    }

    runReason = response?.error || runReason;
  }

  openFavoriteEditor(favorite, {
    reason: intent.type === "run" ? runReason : "",
  });
}

function setLoadedTemplateContext(
  item: Partial<FavoritePrompt> | PromptHistoryItem | null | undefined,
): void {
  const templateDefaults =
    item && "templateDefaults" in item && item.templateDefaults && typeof item.templateDefaults === "object"
      ? item.templateDefaults
      : {};
  const favoriteTitle =
    item && "title" in item && typeof item.title === "string" ? item.title : "";
  const favoriteId =
    item && "id" in item && typeof item.id === "string" ? item.id : "";
  state.loadedTemplateDefaults =
    templateDefaults && typeof templateDefaults === "object"
      ? { ...templateDefaults }
      : {};
  state.loadedFavoriteTitle = favoriteTitle;
  state.loadedFavoriteId = favoriteId;
}

function loadPromptIntoComposer(item: FavoritePrompt | PromptHistoryItem): void {
  promptInput.value = item.text;
  scheduleComposeDraftSave(promptInput.value);
  applySiteSelection(
    "requestedSiteIds" in item ? getHistorySelectedSiteIds(item) : item.sentTo,
  );
  setLoadedTemplateContext(item);
  renderTemplateSummary();
  switchTab("compose");
  promptInput.focus();
  setStatus(t.importedLoad, "success");
  showAppToast(t.importedLoad, "info", 2200);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : getUnknownErrorText();
}

async function flushPendingSessionToasts(): Promise<void> {
  const pendingToasts = await drainPendingUiToasts();
  pendingToasts.forEach((toast) => {
    showAppToast(toast);
  });
}

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
scheduleFavoriteTitleSave = favoritesController.scheduleFavoriteTitleSave;

const historyController = createHistoryController({
  switchTab,
  loadPromptIntoComposer,
  openResendModal,
  renderFavoritesList,
  setStatus,
  showAppToast,
});
renderHistoryList = historyController.renderHistoryList;

function resetTransientModals() {
  hideTemplateModal();
  hideFavoriteModal();
  hideResendModal();
  hideImportReportModal();
}

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
  setServiceEditorError,
  setServiceTestResult,
  setServicePermissionPreview,
  renderServicePermissionPreview,
  resetServiceEditorForm,
  hideServiceEditor,
  populateServiceEditor,
  buildManagedSiteMarkup,
  renderManagedSites,
  readServiceEditorDraft,
  ensureSiteOriginPermission,
  testSelectorOnActiveTab,
  saveServiceEditorDraft,
  deleteManagedSite,
} = popupServicesController;

async function handleSend() {
  if (state.isSending) {
    return;
  }

  clearStatus();
  const prompt = promptInput.value.trim();

  if (!prompt) {
    setStatus(t.warnEmpty, "error");
    showAppToast(t.toastPromptEmpty, "warning", 2000);
    promptInput.focus();
    return;
  }

  const selectedSiteIds = checkedSiteIds();
  if (selectedSiteIds.length === 0) {
    setStatus(t.warnNoSite, "error");
    showAppToast(t.toastNoService, "warning", 2000);
    return;
  }

  const composerTargets = buildComposerBroadcastTargets(selectedSiteIds, prompt);
  const selectedSites = state.runtimeSites.filter((site) => selectedSiteIds.includes(site.id));

  const customSitePermissionPatterns = Array.from(
    new Set(
      selectedSites
        .filter((site) => site.isCustom)
        .flatMap((site) => Array.isArray(site.permissionPatterns) ? site.permissionPatterns : [])
        .filter((pattern): pattern is string => typeof pattern === "string" && pattern.trim().length > 0)
    ),
  );
  if (customSitePermissionPatterns.length > 0) {
    const permissionResult = await requestOriginPermissions(customSitePermissionPatterns);
    if (!permissionResult.granted) {
      setStatus(t.servicePermissionDenied, "error");
      showAppToast(t.servicePermissionDenied, "error", 4000);
      return;
    }
  }

  await openTemplateModalV2(prompt, composerTargets);
}

function bindGlobalEvents() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextTab = button.dataset.tab as PopupTabId | undefined;
      if (nextTab) {
        switchTab(nextTab);
      }
    });
  });

  clearPromptBtn.addEventListener("click", () => {
    promptInput.value = "";
    scheduleComposeDraftSave("");
    state.loadedFavoriteId = "";
    state.loadedFavoriteTitle = "";
    state.loadedTemplateDefaults = {};
    updatePromptCounter();
    autoResizePromptInput();
    renderTemplateSummary();
    clearStatus();
    promptInput.focus();
  });

  toggleAllBtn.addEventListener("click", () => {
    const checkboxes = allCheckboxes();
    const shouldCheckAll = !checkboxes.every((checkbox) => checkbox.checked);

    checkboxes.forEach((checkbox) => {
      checkbox.checked = shouldCheckAll;
      checkbox.closest(".site-card")?.classList.toggle("checked", shouldCheckAll);
    });

    syncToggleAllLabel();
    renderTemplateSummary();
  });

  saveFavoriteBtn.addEventListener("click", () => {
    void openFavoriteModal().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to open favorite modal.", error);
      setStatus(t.error(getErrorMessage(error)), "error");
    });
  });

  cancelSendBtn.addEventListener("click", () => {
    void cancelCurrentBroadcast();
  });

  sendBtn.addEventListener("click", (event) => {
    triggerRipple(sendBtn, event);
    void handleSend().catch((error) => {
      console.error("[AI Prompt Broadcaster] Send flow failed.", error);
      setStatus(t.error(getErrorMessage(error)), "error");
    });
  });

  promptInput.addEventListener("input", () => {
    scheduleComposeDraftSave(promptInput.value);
    updatePromptCounter();
    autoResizePromptInput();
    renderTemplateSummary();
    document.querySelectorAll(".site-card.sent, .site-card.failed, .site-card.sending").forEach((card) => {
      card.classList.remove("sending", "sent", "failed");
      card.querySelector(".retry-btn")?.remove();
    });
  });

  promptInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void handleSend().catch((error) => {
        console.error("[AI Prompt Broadcaster] Keyboard send failed.", error);
        setStatus(t.error(getErrorMessage(error)), "error");
      });
    }
  });

  historySearchInput.addEventListener("input", (event) => {
    const target = getEventInput(event.target);
    if (!target) {
      return;
    }

    state.historySearch = target.value;
    renderHistoryList();
  });

  historySortSelect.addEventListener("change", (event) => {
    const target = getEventSelect(event.target);
    if (!target) {
      return;
    }

    const nextValue = target.value as PopupState["settings"]["historySort"];
    state.settings = {
      ...state.settings,
      historySort: nextValue,
    };
    renderHistoryList();
    void updateAppSettings({ historySort: nextValue }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save history sort.", error);
      setStatus(t.error(getErrorMessage(error)), "error");
    });
  });

  favoritesSearchInput.addEventListener("input", (event) => {
    const target = getEventInput(event.target);
    if (!target) {
      return;
    }

    state.favoritesSearch = target.value;
    renderFavoritesList();
  });

  favoritesSortSelect.addEventListener("change", (event) => {
    const target = getEventSelect(event.target);
    if (!target) {
      return;
    }

    const nextValue = target.value as PopupState["settings"]["favoriteSort"];
    state.settings = {
      ...state.settings,
      favoriteSort: nextValue,
    };
    renderFavoritesList();
    void updateAppSettings({ favoriteSort: nextValue }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save favorite sort.", error);
      setStatus(t.error(getErrorMessage(error)), "error");
    });
  });

  document.querySelector<HTMLElement>("[data-panel='favorites']")?.addEventListener("click", (event: MouseEvent) => {
    favoritesController.handleFavoriteFilterBarClick(event);
  });

  historyList.addEventListener("click", (event: MouseEvent) => {
    historyController.handleHistoryListClick(event);
  });

  historyList.addEventListener("contextmenu", (event: MouseEvent) => {
    historyController.handleHistoryListContextMenu(event);
  });

  favoritesList.addEventListener("click", (event: MouseEvent) => {
    favoritesController.handleFavoritesListClick(event);
  });

  favoritesList.addEventListener("contextmenu", (event: MouseEvent) => {
    favoritesController.handleFavoritesListContextMenu(event);
  });

  favoritesList.addEventListener("input", (event) => {
    favoritesController.handleFavoritesListInput(event);
  });

  favoritesList.addEventListener("blur", (event) => {
    favoritesController.handleFavoritesListBlur(event);
  }, true);

  document.addEventListener("click", (event) => {
    if (!state.openMenuKey) {
      return;
    }

    const insideMenu = getEventElement(event.target)?.closest(".prompt-actions");
    if (!insideMenu) {
      state.openMenuKey = null;
      renderLists();
    }
  });

  clearHistoryBtn.addEventListener("click", async () => {
    showConfirmToast(t.clearHistoryConfirm, async () => {
      try {
        await clearPromptHistory();
        state.history = [];
        renderHistoryList();
        setStatus(t.historyCleared, "success");
        showAppToast(t.historyCleared, "info", 2200);
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Failed to clear history.", error);
        setStatus(t.error(getErrorMessage(error)), "error");
        showAppToast(t.error(getErrorMessage(error)), "error", 4000);
      }
    });
  });

  reuseExistingTabsToggle.addEventListener("change", (event) => {
    const target = getEventInput(event.target);
    if (!target) {
      return;
    }

    const nextValue = target.checked;
    state.settings = {
      ...state.settings,
      reuseExistingTabs: nextValue,
    };
    applySettingsToControls();
    renderSiteCheckboxesPanel();

    void updateAppSettings({ reuseExistingTabs: nextValue }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save tab reuse setting.", error);
      setStatus(t.error(getErrorMessage(error)), "error");
      showAppToast(t.error(getErrorMessage(error)), "error", 3200);
    });
  });

  waitMultiplierRange.addEventListener("input", (event) => {
    const target = getEventInput(event.target);
    if (!target) {
      return;
    }

    waitMultiplierValue.textContent = t.waitMultiplierValue(Number(target.value));
  });

  waitMultiplierRange.addEventListener("change", (event) => {
    const target = getEventInput(event.target);
    if (!target) {
      return;
    }

    const nextValue = Number(target.value);
    state.settings = {
      ...state.settings,
      waitMsMultiplier: nextValue,
    };
    applySettingsToControls();
    void updateAppSettings({ waitMsMultiplier: nextValue }).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to save wait multiplier.", error);
      setStatus(t.error(getErrorMessage(error)), "error");
      showAppToast(t.error(getErrorMessage(error)), "error", 3200);
    });
  });

  openOptionsBtn.addEventListener("click", () => {
    void chrome.runtime.openOptionsPage().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to open options page.", error);
      setStatus(t.error(getErrorMessage(error)), "error");
    });
  });

  exportJsonBtn.addEventListener("click", async () => {
    try {
      const payload = await exportPromptData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ai-prompt-broadcaster-${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus(t.exportSuccess, "success");
    } catch (error) {
      console.error("[AI Prompt Broadcaster] JSON export failed.", error);
      setStatus(t.error(getErrorMessage(error)), "error");
    }
  });

  importJsonBtn.addEventListener("click", () => {
    importJsonInput.click();
  });

  importJsonInput.addEventListener("change", async (event) => {
    const target = getEventInput(event.target);
    const file = target?.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const result = await importPromptData(text);
      await refreshStoredData();
      setStatus(buildImportSummaryText(result.importSummary), "success");
      showAppToast(buildImportSummaryText(result.importSummary, { short: true }), "success", 2600);
      openImportReportModal(result.importSummary);
    } catch (error) {
      const importSummary = getImportErrorSummary(error);
      if (importSummary) {
        openImportReportModal(importSummary);
      }

      setStatus(t.importFailed, "error");
      showAppToast(t.importFailed, "error", 4000);
      console.error("[AI Prompt Broadcaster] JSON import failed.", error);
    } finally {
      importJsonInput.value = "";
    }
  });

  addServiceBtn.addEventListener("click", () => {
    resetServiceEditorForm();
    populateServiceEditor(null);
  });

  resetSitesBtn.addEventListener("click", () => {
    showConfirmToast(t.resetServicesConfirm, async () => {
      try {
        await resetSiteSettings();
        await refreshStoredData();
        hideServiceEditor();
        setStatus(t.serviceResetDone, "success");
        showAppToast(t.serviceResetDone, "success", 2200);
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Failed to reset service settings.", error);
        setStatus(t.error(getErrorMessage(error)), "error");
        showAppToast(t.error(getErrorMessage(error)), "error", 4000);
      }
    });
  });

  managedSitesList.addEventListener("click", (event) => {
    const actionButton = getEventElement(event.target)?.closest<HTMLElement>("[data-action][data-site-id]");
    if (!actionButton) {
      return;
    }

    const { action, siteId } = actionButton.dataset;
    if (!siteId) {
      return;
    }

    if (action === "edit-service") {
      const site = state.runtimeSites.find((entry) => entry.id === siteId);
      if (site) {
        populateServiceEditor(site);
      }
      return;
    }

    if (action === "delete-service") {
      void deleteManagedSite(siteId);
    }
  });

  managedSitesList.addEventListener("change", (event) => {
    const toggle = getEventElement(event.target)?.closest<HTMLInputElement>("[data-action='toggle-service'][data-site-id]");
    const siteId = toggle?.dataset.siteId;
    if (!toggle || !siteId) {
      return;
    }

    void setRuntimeSiteEnabled(siteId, toggle.checked)
      .then(() => refreshStoredData())
      .catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to toggle site state.", error);
        setStatus(t.error(getErrorMessage(error)), "error");
      });
  });

  testSelectorBtn.addEventListener("click", () => {
    void testSelectorOnActiveTab();
  });

  serviceWaitRange.addEventListener("input", () => {
    serviceWaitValue.textContent = `${serviceWaitRange.value}ms`;
  });

  serviceUrlInput.addEventListener("input", () => {
    if (!serviceEditor.hidden) {
      renderServicePermissionPreview();
    }
  });

  serviceHostnameAliasesInput.addEventListener("input", () => {
    if (!serviceEditor.hidden) {
      renderServicePermissionPreview();
    }
  });

  serviceEditorCancel.addEventListener("click", hideServiceEditor);
  serviceEditorSave.addEventListener("click", () => {
    void saveServiceEditorDraft();
  });
  bindTemplateModalEvents((message) => {
    setTemplateModalError(message);
  });
  bindFavoriteEditorEvents();
  bindHistoryModalEvents(getErrorMessage);

  document.addEventListener("keydown", (event) => {
    trapModalFocus(event);
    void handleGlobalShortcut(event).catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to handle popup shortcut.", error);
    });
  });

  chrome.tabs.onCreated.addListener(() => {
    scheduleOpenSiteTabsRefresh();
  });

  chrome.tabs.onRemoved.addListener(() => {
    scheduleOpenSiteTabsRefresh();
  });

  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.status || typeof changeInfo.title === "string" || typeof changeInfo.url === "string") {
      scheduleOpenSiteTabsRefresh();
    }
  });

  chrome.tabs.onActivated.addListener(() => {
    scheduleOpenSiteTabsRefresh();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "session") {
      if (changes.lastBroadcast) {
        const nextLastBroadcast = changes.lastBroadcast.newValue;
        applyLastBroadcastState(isLastBroadcastSummary(nextLastBroadcast) ? nextLastBroadcast : null);
      }

      if (changes.pendingUiToasts) {
        void flushPendingSessionToasts();
      }

       if (changes.favoriteRunJobs) {
        void getFavoriteRunJobs()
          .then((favoriteJobs) => {
            state.favoriteJobs = favoriteJobs;
            renderFavoritesList();
          })
          .catch((error) => {
            console.error("[AI Prompt Broadcaster] Failed to refresh favorite jobs.", error);
          });
      }

      return;
    }

    if (areaName !== "local") {
      return;
    }

    if (
      changes.promptHistory ||
      changes.promptFavorites ||
      changes.templateVariableCache ||
      changes.appSettings ||
      changes.customSites ||
      changes.builtInSiteStates ||
      changes.builtInSiteOverrides ||
      changes.failedSelectors
    ) {
      void loadStoredData().catch((error) => {
        console.error("[AI Prompt Broadcaster] Storage change refresh failed.", error);
      });
    }
  });
}

async function init() {
  try {
    applyI18n();
    document.documentElement.lang = isKorean ? "ko" : "en";
    resetTransientModals();
    initToastRoot(toastHost);
    renderTabLabels();
    bindGlobalEvents();
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
    setStatus(t.error(getErrorMessage(error)), "error");
    showAppToast(t.error(getErrorMessage(error)), "error", 4000);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void init();
  }, { once: true });
} else {
  void init();
}
