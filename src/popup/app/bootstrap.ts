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
  setComposeDraftPrompt,
  setLastSentPrompt,
} from "../../shared/prompt-state";
import {
  consumePopupFavoriteIntent,
  drainPendingUiToasts,
  getFavoriteRunJobs,
  getFailedSelectors,
  getLatestFavoriteRunJobByFavoriteId,
  getLastBroadcast,
} from "../../shared/runtime-state";
import {
  buildSitePermissionPatterns,
  deleteCustomSite,
  getRuntimeSites,
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
import { createHistoryController } from "../history/controller";
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

function isLastBroadcastSummary(value: unknown): value is LastBroadcastSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<LastBroadcastSummary>;
  return (
    typeof candidate.broadcastId === "string"
    && typeof candidate.status === "string"
    && typeof candidate.prompt === "string"
    && Array.isArray(candidate.siteIds)
  );
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

function renderSortControls() {
  historySortSelect.innerHTML = getHistorySortOptions()
    .map((option) => `<option value="${escapeAttribute(option.value)}">${escapeHtml(option.label)}</option>`)
    .join("");
  favoritesSortSelect.innerHTML = getFavoriteSortOptions()
    .map((option) => `<option value="${escapeAttribute(option.value)}">${escapeHtml(option.label)}</option>`)
    .join("");

  historySortSelect.value = state.settings.historySort;
  favoritesSortSelect.value = state.settings.favoriteSort;
}
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

function getDefaultSiteTargetSelection(): "default" {
  return "default";
}

function getTemplateDisplayName(name: string): string {
  return getTemplateVariableDisplayName(name, uiLanguage);
}

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

function currentPromptVariables(): TemplateVariableDescriptor[] {
  const checkedTargets = buildComposerBroadcastTargets(checkedSiteIds(), promptInput.value);
  if (checkedTargets.length === 0) {
    return detectTemplateVariables(promptInput.value);
  }

  return detectTemplateVariablesForTargets(checkedTargets);
}

function renderTemplateSummary(): void {
  const variables = currentPromptVariables();

  templateSummary.hidden = variables.length === 0;

  if (variables.length === 0) {
    templateSummaryLabel.textContent = "";
    templateChipList.innerHTML = "";
    return;
  }

  templateSummaryLabel.textContent = t.templateSummary(variables.length);
  templateChipList.innerHTML = variables
    .map((variable) => {
      const kindLabel =
        variable.kind === "system" ? t.templateSystemKind : t.templateUserKind;
      const variableLabel =
        variable.kind === "system" ? getTemplateDisplayName(variable.name) : variable.name;
      return `
        <span class="template-chip ${variable.kind}">
          <span>{{${escapeHtml(variableLabel)}}}</span>
          <span class="template-chip-kind">${escapeHtml(kindLabel)}</span>
        </span>
      `;
    })
    .join("");
}

function compactVariableValues(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values ?? {})
      .map(([name, value]) => [String(name), String(value ?? "")])
      .filter(([, value]) => value.trim())
  );
}

function mergeTemplateSources(
  ...sources: Array<Record<string, string> | undefined | null>
): Record<string, string> {
  return Object.assign({}, ...sources.filter(Boolean));
}

function applySettingsToControls() {
  reuseExistingTabsToggle.checked = Boolean(state.settings.reuseExistingTabs);
  reuseExistingTabsLabel.textContent = t.reuseTabsLabel;
  reuseExistingTabsDesc.textContent = state.settings.reuseExistingTabs
    ? t.reuseTabsDescEnabled
    : t.reuseTabsDescDisabled;
  waitMultiplierLabel.textContent = t.waitMultiplierLabel;
  waitMultiplierRange.value = String(state.settings.waitMsMultiplier);
  waitMultiplierValue.textContent = t.waitMultiplierValue(state.settings.waitMsMultiplier);
  renderSortControls();
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

    if (typeof promptIntent?.prompt === "string" && !promptInput.value.trim()) {
      promptInput.value = promptIntent.prompt;
    } else if (!promptInput.value.trim()) {
      promptInput.value = composeDraftPrompt;
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

function setCardStatesFromBroadcast(summary: PopupState["lastBroadcast"]): void {
  document.querySelectorAll<HTMLElement>(".site-card.sent, .site-card.failed, .site-card.sending").forEach((card) => {
    card.classList.remove("sending", "sent", "failed");
    card.querySelector(".retry-btn")?.remove();
  });

  if (!summary?.siteIds?.length) {
    return;
  }

  summary.siteIds.forEach((siteId) => {
    const status = summary.siteResults?.[siteId];
    const code = normalizeResultCode(status?.code ?? status);
    if (code === "submitted") {
      setSiteCardState(siteId, "sent");
      return;
    }

    if (status) {
      setSiteCardState(siteId, "failed");
      return;
    }

    if (summary.status === "sending") {
      setSiteCardState(siteId, "sending");
    }
  });
}

function applyLastBroadcastState(
  summary: PopupState["lastBroadcast"],
  { silentToast = false }: { silentToast?: boolean } = {},
): void {
  state.lastBroadcast = summary;

  if (!summary) {
    clearSendSafetyTimer();
    setSendingState(false);
    clearStatus();
    return;
  }

  setCardStatesFromBroadcast(summary);

  if (summary.status === "sending") {
    setStatus(t.sending(summary.total || summary.siteIds?.length || 0));
    setSendingState(true);
    const signature = buildBroadcastToastSignature(summary);
    if (!silentToast && state.lastBroadcastToastSignature !== signature) {
      showAppToast(t.restoredBroadcastSending, "info", 2600);
      state.lastBroadcastToastSignature = signature;
    }
    return;
  }

  clearSendSafetyTimer();
  setSendingState(false);

  const finishedAtMs = Date.parse(summary.finishedAt || "");
  const isRecent = Number.isFinite(finishedAtMs) && Date.now() - finishedAtMs <= 5 * 60 * 1000;
  const signature = buildBroadcastToastSignature(summary);
  const successCount = (summary.submittedSiteIds ?? []).length;
  const failedCount = (summary.failedSiteIds ?? []).length;

  if (summary.status === "submitted") {
    setStatus(t.sent(successCount || summary.total || summary.siteIds?.length || 0), "success");
  } else {
    const doneMessage = (msg("popup_broadcast_restored_done", [String(successCount), String(failedCount)]) ||
      `Last broadcast: ${successCount} success, ${failedCount} failed`);
    setStatus(doneMessage, failedCount > 0 ? "warning" : "success");
  }

  if (!silentToast && isRecent && state.lastBroadcastToastSignature !== signature) {
    const message = (msg("popup_broadcast_restored_done", [String(successCount), String(failedCount)]) ||
      `Last broadcast: ${successCount} success, ${failedCount} failed`);

    showAppToast(
      {
        message,
        type: failedCount > 0 ? "warning" : "info",
        duration: failedCount > 0 ? -1 : 4000,
      }
    );
    state.lastBroadcastToastSignature = signature;
  }
}

async function cancelCurrentBroadcast() {
  const broadcastId = state.lastBroadcast?.status === "sending"
    ? state.lastBroadcast.broadcastId
    : "";

  if (!broadcastId) {
    setSendingState(false);
    clearSendSafetyTimer();
    return;
  }

  cancelSendBtn.disabled = true;

  try {
    const response = await sendPopupMessage(
      {
        action: "cancelBroadcast",
        broadcastId,
      },
      10000,
    ) as CancelBroadcastResponse | null;

    if (!response?.ok) {
      throw new Error(getUnknownErrorText());
    }

    applyLastBroadcastState(response.summary ?? await getLastBroadcast(), { silentToast: true });
    setStatus(t.broadcastCancelled, "warning");
    showAppToast(t.broadcastCancelled, "warning", 2600);
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to cancel broadcast.", error);
    setStatus(t.error(getErrorMessage(error)), "error");
    showAppToast(t.error(getErrorMessage(error)), "error", 4000);
    if (state.lastBroadcast?.status === "sending") {
      cancelSendBtn.disabled = false;
    }
  }
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

function getSiteCardElement(siteId: string): HTMLElement | null {
  return sitesContainer.querySelector<HTMLElement>(`[data-site-id="${CSS.escape(siteId)}"]`);
}

function setSiteCardState(siteId: string, cardState: string): void {
  const card = getSiteCardElement(siteId);
  if (!card) {
    return;
  }
  card.classList.remove("sending", "sent", "failed");
  const retryBtn = card.querySelector(".retry-btn");
  if (retryBtn) {
    retryBtn.remove();
  }
  if (cardState) {
    card.classList.add(cardState);
  }
}

function addRetryButton(target: ComposerTarget, mainPrompt: string): void {
  const siteId = target?.id;
  const card = getSiteCardElement(siteId);
  if (!card) {
    return;
  }
  const retryBtn = document.createElement("button");
  retryBtn.type = "button";
  retryBtn.className = "retry-btn";
  retryBtn.textContent = "Retry";
  retryBtn.addEventListener("click", async (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const site = state.runtimeSites.find((s) => s.id === siteId);
    if (!site) {
      return;
    }
    retryBtn.disabled = true;
    setSiteCardState(siteId, "sending");
    try {
      await refreshOpenSiteTabs();
      const response = await sendPopupMessage(
        {
          action: "broadcast",
          prompt: mainPrompt,
          sites: buildRuntimeBroadcastTargets([target]),
        },
        10000,
      ) as BroadcastResponse | null;
      const failedIds = Array.isArray(response?.failedTabSiteIds) ? response.failedTabSiteIds : [];
      if (response?.ok && !failedIds.includes(siteId)) {
        setSiteCardState(siteId, "sent");
      } else {
        setSiteCardState(siteId, "failed");
        addRetryButton(target, mainPrompt);
      }
    } catch (_error) {
      setSiteCardState(siteId, "failed");
      addRetryButton(target, mainPrompt);
    }
  });
  card.appendChild(retryBtn);
}

function triggerRipple(button: HTMLButtonElement, event: MouseEvent): void {
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;`;
  button.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
}

async function sendResolvedPrompt(
  mainPrompt: string,
  targets: Array<ComposerTarget | BroadcastSiteTargetMessage>,
): Promise<void> {
  if (state.isSending) {
    return;
  }

  const siteIds = normalizeSiteIdList(
    (Array.isArray(targets) ? targets : []).map((target) => target?.id)
  );

  setSendingState(true);
  armSendSafetyTimer();

  siteIds.forEach((siteId) => setSiteCardState(siteId, "sending"));

  setStatus(t.sending(siteIds.length));

  try {
    await refreshOpenSiteTabs();
    await setLastSentPrompt(mainPrompt);
    clearAllToasts();

    const response = await sendPopupMessage(
      {
        action: "broadcast",
        prompt: mainPrompt,
        sites: buildRuntimeBroadcastTargets(targets),
      },
      10000,
    ) as BroadcastResponse | null;

    if (response?.ok) {
      if (Array.isArray(response.failedTabSiteIds)) {
        response.failedTabSiteIds.forEach((siteId) => {
          setSiteCardState(siteId, "failed");
          const failedTarget = targets.find(
            (target): target is ComposerTarget => hasTargetId(target) && target.id === siteId,
          );
          if (failedTarget) {
            addRetryButton(failedTarget, mainPrompt);
          }
        });
      }

      setStatus(t.sending(response.createdSiteCount ?? siteIds.length), "warning");
      showAppToast(t.toastSendSuccess(response.createdSiteCount ?? siteIds.length), "success", 2200);

      if (state.settings.autoClosePopup) {
        window.close();
      }
    } else {
      siteIds.forEach((siteId) => {
        setSiteCardState(siteId, "failed");
        const failedTarget = targets.find(
          (target): target is ComposerTarget => hasTargetId(target) && target.id === siteId,
        );
        if (failedTarget) {
          addRetryButton(failedTarget, mainPrompt);
        }
      });
      setStatus(t.error(response?.error ?? getUnknownErrorText()), "error");
    }
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Broadcast send failed.", error);
    siteIds.forEach((siteId) => {
      setSiteCardState(siteId, "failed");
      const failedTarget = targets.find(
        (target): target is ComposerTarget => hasTargetId(target) && target.id === siteId,
      );
      if (failedTarget) {
        addRetryButton(failedTarget, mainPrompt);
      }
    });
    setStatus(t.error(getErrorMessage(error)), "error");
    showAppToast(t.error(getErrorMessage(error)), "error", 4000);
    setSendingState(false);
    clearSendSafetyTimer();
  } finally {
    if (state.lastBroadcast?.status !== "sending") {
      setSendingState(false);
    }
  }
}

function hideTemplateModal() {
  state.pendingTemplateSend = null;
  closeOverlay(templateModal);
  templateModalError.hidden = true;
  templateModalError.textContent = "";
}

function hideResendModal() {
  state.pendingResendHistory = null;
  closeOverlay(resendModal);
}

function openResendModal(historyItem: PromptHistoryItem): void {
  state.pendingResendHistory = historyItem;
  resendModalTitle.textContent = t.resendModalTitle;
  resendModalDesc.textContent = t.resendModalDesc;
  resendModalCancel.textContent = t.resendModalCancel;
  resendModalConfirm.textContent = t.resendModalConfirm;

  const requestedSiteIds = getHistorySelectedSiteIds(historyItem);
  const availableSiteIds = new Set(getEnabledSites().map((site) => site.id));

  resendModalSites.innerHTML = requestedSiteIds.map((siteId) => {
    const site = state.runtimeSites.find((entry) => entry.id === siteId);
    const disabled = !availableSiteIds.has(siteId);
    return `
      <label class="checkbox-row">
        <input type="checkbox" value="${escapeAttribute(siteId)}" data-resend-site="${escapeAttribute(siteId)}" ${disabled ? "disabled" : "checked"} />
        <span>${escapeHtml(site?.name ?? siteId)}${disabled ? ` (${escapeHtml(t.resendSiteUnavailable)})` : ""}</span>
      </label>
    `;
  }).join("");

  openOverlay(
    resendModal,
    resendModalSites.querySelector<HTMLInputElement>("input:not([disabled])"),
  );
}

async function confirmResendModal() {
  const historyItem = state.pendingResendHistory;
  if (!historyItem) {
    return;
  }

  const selectedSiteIds = Array.from(
    resendModalSites.querySelectorAll<HTMLInputElement>("[data-resend-site]:checked"),
  )
    .map((checkbox) => checkbox.value)
    .filter(Boolean);

  if (selectedSiteIds.length === 0) {
    setStatus(t.warnNoSite, "error");
    return;
  }

  const selectedTargets = ensureBroadcastTargetSnapshots(
    historyItem.targetSnapshots,
    historyItem.requestedSiteIds,
    historyItem.text
  )
    .filter((snapshot) => selectedSiteIds.includes(snapshot.siteId))
    .map((snapshot) => buildBroadcastTargetMessageFromSnapshot(snapshot, state.openSiteTabs));

  hideResendModal();
  await sendResolvedPrompt(historyItem.text, selectedTargets);
}

function openImportReportModal(summary: PopupState["pendingImportSummary"]): void {
  state.pendingImportSummary = summary;
  importReportModalTitle.textContent = t.importReportTitle;
  importReportModalDesc.textContent = t.importReportDesc;
  importReportModalConfirm.textContent = t.importReportClose;
  importReportBody.innerHTML = buildImportReportMarkup(summary);
  openOverlay(importReportModal, importReportModalClose);
}

function hideImportReportModal() {
  state.pendingImportSummary = null;
  closeOverlay(importReportModal);
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

function getPromptButtonsForActiveTab(): HTMLElement[] {
  if (state.activeTab === "history") {
    return Array.from(historyList.querySelectorAll<HTMLElement>("[data-load-history]"));
  }

  if (state.activeTab === "favorites") {
    return Array.from(
      favoritesList.querySelectorAll<HTMLElement>("[data-load-favorite], [data-edit-favorite]"),
    );
  }

  return [];
}

function focusAdjacentPromptButton(direction: number): void {
  const buttons = getPromptButtonsForActiveTab();
  if (buttons.length === 0) {
    return;
  }

  const currentIndex = buttons.findIndex((button) => button === document.activeElement);
  const nextIndex = currentIndex === -1
    ? (direction > 0 ? 0 : buttons.length - 1)
    : (currentIndex + direction + buttons.length) % buttons.length;
  buttons[nextIndex]?.focus?.();
}

async function handleGlobalShortcut(event: KeyboardEvent): Promise<void> {
  if (event.defaultPrevented) {
    return;
  }

  const shortcutKey = event.key.toLowerCase();
  const hasPrimaryModifier = event.ctrlKey || event.metaKey;

  if (event.key === "Escape") {
    if (closeActiveOverlayOrMenu()) {
      event.preventDefault();
    }
    return;
  }

  if (getOpenOverlay()) {
    return;
  }

  if (hasPrimaryModifier && event.shiftKey && event.key === "Enter") {
    event.preventDefault();
    await cancelCurrentBroadcast();
    return;
  }

  if (hasPrimaryModifier && !event.shiftKey && event.key === "Enter") {
    event.preventDefault();
    await handleSend();
    return;
  }

  if (hasPrimaryModifier && !event.shiftKey && ["1", "2", "3", "4"].includes(shortcutKey)) {
    event.preventDefault();
    switchTab(["compose", "history", "favorites", "settings"][Number(shortcutKey) - 1] as PopupTabId);
    return;
  }

  if (hasPrimaryModifier && !event.shiftKey && shortcutKey === "a" && state.activeTab === "compose" && !isTextEditingTarget(event.target)) {
    event.preventDefault();
    toggleAllBtn.click();
    return;
  }

  if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !isTextEditingTarget(event.target)) {
    if (state.activeTab === "history" || state.activeTab === "favorites") {
      event.preventDefault();
      focusAdjacentPromptButton(event.key === "ArrowDown" ? 1 : -1);
    }
  }
}

function resetTransientModals() {
  hideTemplateModal();
  hideFavoriteModal();
  hideResendModal();
  hideImportReportModal();
}

function setTemplateModalError(message = "") {
  templateModalError.hidden = !message;
  templateModalError.textContent = message;
}

async function ensureClipboardReadPermission(): Promise<boolean> {
  try {
    if (!chrome.permissions?.contains || !chrome.permissions?.request) {
      return false;
    }

    const permission: chrome.permissions.Permissions = {
      permissions: ["clipboardRead"],
    };
    const alreadyGranted = await chrome.permissions.contains(permission);

    if (alreadyGranted) {
      return true;
    }

    return await chrome.permissions.request(permission);
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to request clipboardRead permission.", error);
    return false;
  }
}

async function resolveAsyncTemplateVariables(
  variables: TemplateVariableDescriptor[],
): Promise<Record<string, string>> {
  const needsTabContext = variables.some(
    (v) =>
      v.name === SYSTEM_TEMPLATE_VARIABLES.url ||
      v.name === SYSTEM_TEMPLATE_VARIABLES.title ||
      v.name === SYSTEM_TEMPLATE_VARIABLES.selection
  );
  const needsCounter = variables.some((v) => v.name === SYSTEM_TEMPLATE_VARIABLES.counter);

  const extra: Record<string, string> = {};

  if (needsTabContext) {
    try {
      const response = await sendPopupMessage(
        { action: "getActiveTabContext" },
        4000,
      ) as ActiveTabContextResponse | null;
      if (response?.ok) {
        extra.url = response.url ?? "";
        extra.title = response.title ?? "";
        extra.selection = response.selection ?? "";
      }
    } catch (_error) {
      // fall through with empty values
    }
  }

  if (needsCounter) {
    try {
      const response = await sendPopupMessage(
        { action: "getBroadcastCounter" },
        4000,
      ) as BroadcastCounterResponse | null;
      extra.counter = response?.counter != null ? String(Number(response.counter) + 1) : "1";
    } catch (_error) {
      extra.counter = "1";
    }
  }

  return extra;
}

async function readClipboardTemplateValue() {
  try {
    const hasPermission = await ensureClipboardReadPermission();
    if (!hasPermission) {
      return {
        ok: false,
        text: "",
        error: "clipboardRead permission was not granted.",
      };
    }

    if (!navigator.clipboard?.readText) {
      return {
        ok: false,
        text: "",
        error: "Clipboard API is not available in this context.",
      };
    }

    const text = await navigator.clipboard.readText();
    return { ok: true, text };
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to read clipboard for template variable.", error);
    return {
      ok: false,
      text: "",
      error: getErrorMessage(error),
    };
  }
}

function getFavoriteTemplateSources(favorite: FavoritePrompt): string[] {
  if (favorite?.mode === "chain" && Array.isArray(favorite.steps) && favorite.steps.length > 0) {
    return favorite.steps
      .map((step) => String(step?.text ?? ""))
      .filter((text) => text.trim());
  }

  return [String(favorite?.text ?? "")];
}

function detectFavoriteTemplateVariables(
  favorite: FavoritePrompt,
): TemplateVariableDescriptor[] {
  const seen = new Set();

  return getFavoriteTemplateSources(favorite)
    .flatMap((template) => detectTemplateVariables(template))
    .filter((variable) => {
      if (seen.has(variable.name)) {
        return false;
      }

      seen.add(variable.name);
      return true;
    });
}

async function buildPreparedFavoriteExecutionContext(
  favorite: FavoritePrompt,
): Promise<
  | { ok: true; preparedExecutionContext: Record<string, string> }
  | { ok: false; reason: string; error: string }
> {
  const variables = detectFavoriteTemplateVariables(favorite);
  const needsClipboard = variables.some(
    (variable) => variable.kind === "system" && variable.name === SYSTEM_TEMPLATE_VARIABLES.clipboard
  );
  const asyncExtra = await resolveAsyncTemplateVariables(variables);
  const preparedExecutionContext: Record<string, string> = {};

  if (typeof asyncExtra.url === "string") {
    preparedExecutionContext.url = asyncExtra.url;
  }
  if (typeof asyncExtra.title === "string") {
    preparedExecutionContext.title = asyncExtra.title;
  }
  if (typeof asyncExtra.selection === "string") {
    preparedExecutionContext.selection = asyncExtra.selection;
  }

  if (!needsClipboard) {
    return {
      ok: true,
      preparedExecutionContext,
    };
  }

  const clipboardResult = await readClipboardTemplateValue();
  if (!clipboardResult.ok) {
    return {
      ok: false,
      reason: "clipboard_read_failed",
      error: clipboardResult.error || t.templateClipboardError,
    };
  }

  preparedExecutionContext.clipboard = clipboardResult.text ?? "";
  return {
    ok: true,
    preparedExecutionContext,
  };
}

async function requestFavoriteRun(
  favorite: FavoritePrompt,
  {
    trigger = "popup",
    allowPopupFallback = false,
  }: {
    trigger?: FavoriteExecutionTrigger;
    allowPopupFallback?: boolean;
  } = {},
): Promise<FavoriteRunResponse> {
  if (!favorite?.id) {
    return {
      ok: false,
      error: getUnknownErrorText(),
    };
  }

  const prepared = await buildPreparedFavoriteExecutionContext(favorite);
  if (!prepared?.ok) {
    return prepared;
  }

  return (await sendPopupMessage(
    {
      action: "favorite:run",
      favoriteId: favorite.id,
      trigger,
      allowPopupFallback,
      preparedExecutionContext: prepared.preparedExecutionContext,
    },
    10000,
  )) as FavoriteRunResponse;
}

async function maybeMarkLoadedFavoriteAsUsed() {
  if (!state.loadedFavoriteId) {
    return;
  }

  try {
    await markFavoriteUsed(state.loadedFavoriteId);
    state.favorites = await getPromptFavorites();
  } catch (error) {
    console.error("[AI Prompt Broadcaster] Failed to update favorite usage.", error);
  }
}

function buildTemplateSendPreviewState(): {
  values: Record<string, string>;
  preview: string;
  missingUserValues: string[];
  clipboardMissing: boolean;
} | null {
  const modalState = state.pendingTemplateSend;
  if (!modalState) {
    return null;
  }

  const values = mergeTemplateSources(modalState.systemValues, modalState.userValues);
  const preview = renderTemplatePrompt(modalState.prompt, values);
  const missingUserValues = findMissingTemplateValues(modalState.prompt, modalState.userValues);
  const clipboardRequired = modalState.variables.some((variable) => variable.name === "클립보드");
  const clipboardMissing = clipboardRequired && !String(modalState.systemValues["클립보드"] ?? "").length;

  return {
    values,
    preview,
    missingUserValues,
    clipboardMissing,
  };
}

function renderTemplateModal(): void {
  const modalState = state.pendingTemplateSend;
  if (!modalState) {
    return;
  }

  templateModalTitle.textContent = t.templateModalTitle;
  templateModalDesc.textContent = t.templateModalDesc;
  templatePreviewLabel.textContent = t.templatePreviewLabel;
  templateModalCancel.textContent = t.templateModalCancel;
  templateModalConfirm.textContent = t.templateModalConfirm;

  const automaticVariables = modalState.variables.filter((variable) => variable.kind === "system");
  if (automaticVariables.length > 0) {
    const labels = automaticVariables.map((variable) => `{{${variable.name}}}`).join(", ");
    const notices = [t.templateSystemNotice, labels];

    if (automaticVariables.some((variable) => variable.name === "클립보드")) {
      notices.push(t.templateClipboardNotice);
    }

    templateModalSystemInfo.hidden = false;
    templateModalSystemInfo.textContent = notices.join(" · ");
  } else {
    templateModalSystemInfo.hidden = true;
    templateModalSystemInfo.textContent = "";
  }

  const userVariables = modalState.variables.filter((variable) => variable.kind === "user");
  templateFields.innerHTML = userVariables
    .map((variable) => {
      const value = modalState.userValues[variable.name] ?? "";
      return `
        <label class="field-stack">
          <span>${escapeHtml(t.templateFieldLabel(variable.name))}</span>
          <input
            class="search-input"
            type="text"
            data-template-input="${escapeAttribute(variable.name)}"
            value="${escapeAttribute(value)}"
            placeholder="${escapeAttribute(t.templateFieldPlaceholder(variable.name))}"
          />
        </label>
      `;
    })
    .join("");

  const previewState = buildTemplateSendPreviewState();
  const errorMessage = previewState?.clipboardMissing
    ? t.templateClipboardError
    : previewState && previewState.missingUserValues.length > 0
      ? t.templateMissingValues
      : "";

  templatePreview.textContent = previewState?.preview ?? modalState.prompt;
  setTemplateModalError(errorMessage);
  templateModalConfirm.disabled = Boolean(errorMessage);
}

async function openTemplateModal(
  prompt: string,
  sites: ComposerTarget[],
): Promise<void> {
  const variables = detectTemplateVariables(prompt);

  if (variables.length === 0) {
    await sendResolvedPrompt(prompt, sites);
    return;
  }

  const baseDefaults = mergeTemplateSources(
    state.templateVariableCache,
    state.loadedTemplateDefaults
  );

  const userValues = Object.fromEntries(
    variables
      .filter((variable) => variable.kind === "user")
      .map((variable) => [variable.name, baseDefaults[variable.name] ?? ""])
  );

  const systemValues = buildSystemTemplateValues(new Date());
  if (variables.some((variable) => variable.name === "클립보드")) {
    const clipboardResult = await readClipboardTemplateValue();
    if (clipboardResult.ok) {
      systemValues["클립보드"] = clipboardResult.text;
    }
  }

  state.pendingTemplateSend = {
    prompt,
    sites,
    variables,
    userValues,
    systemValues,
  };

  renderTemplateModal();
  openOverlay(templateModal, templateFields.querySelector("input") ?? templateModalConfirm);
}

async function confirmTemplateModalSend(): Promise<void> {
  const modalState = state.pendingTemplateSend;
  if (!modalState) {
    return;
  }

  renderTemplateModalV2();
  const previewState = buildTemplateSendPreviewStateV2();

  if (!previewState || previewState.missingUserValues.length > 0 || previewState.clipboardMissing) {
    return;
  }

  const cachedValues = compactVariableValues(modalState.userValues);
  await updateTemplateVariableCache(cachedValues);
  state.templateVariableCache = mergeTemplateSources(state.templateVariableCache, cachedValues);

  const resolvedTargets = buildResolvedBroadcastTargets(modalState.targets, previewState.values);
  hideTemplateModal();
  await maybeMarkLoadedFavoriteAsUsed();
  await sendResolvedPrompt(modalState.prompt, resolvedTargets);
}

function buildTemplateSendPreviewStateV2(): {
  values: Record<string, string>;
  preview: string;
  missingUserValues: string[];
  clipboardMissing: boolean;
} | null {
  const modalState = state.pendingTemplateSend;
  if (!modalState) {
    return null;
  }

  const values = mergeTemplateSources(modalState.systemValues, modalState.userValues);
  const preview = buildTemplatePreviewText(modalState.targets, values);
  const missingUserValues = findMissingTemplateValuesForTargets(
    modalState.targets,
    modalState.userValues
  );
  const clipboardRequired = modalState.variables.some(
    (variable) => variable.name === SYSTEM_TEMPLATE_VARIABLES.clipboard
  );
  const clipboardMissing =
    clipboardRequired && !String(modalState.systemValues[SYSTEM_TEMPLATE_VARIABLES.clipboard] ?? "").length;

  return {
    values,
    preview,
    missingUserValues,
    clipboardMissing,
  };
}

function renderTemplateModalV2(): void {
  const modalState = state.pendingTemplateSend;
  if (!modalState) {
    return;
  }

  templateModalTitle.textContent = t.templateModalTitle;
  templateModalDesc.textContent = t.templateModalDesc;
  templatePreviewLabel.textContent = t.templatePreviewLabel;
  templateModalCancel.textContent = t.templateModalCancel;
  templateModalConfirm.textContent = t.templateModalConfirm;

  const automaticVariables = modalState.variables.filter((variable) => variable.kind === "system");
  if (automaticVariables.length > 0) {
    const labels = automaticVariables
      .map((variable) => `{{${getTemplateDisplayName(variable.name)}}}`)
      .join(", ");
    const notices = [t.templateSystemNotice, labels];

    if (automaticVariables.some((variable) => variable.name === SYSTEM_TEMPLATE_VARIABLES.clipboard)) {
      notices.push(t.templateClipboardNotice);
    }

    templateModalSystemInfo.hidden = false;
    templateModalSystemInfo.textContent = notices.join(" · ");
  } else {
    templateModalSystemInfo.hidden = true;
    templateModalSystemInfo.textContent = "";
  }

  const userVariables = modalState.variables.filter((variable) => variable.kind === "user");
  templateFields.innerHTML = userVariables
    .map((variable) => {
      const value = modalState.userValues[variable.name] ?? "";
      return `
        <label class="field-stack">
          <span>${escapeHtml(t.templateFieldLabel(variable.name))}</span>
          <input
            class="search-input"
            type="text"
            data-template-input="${escapeAttribute(variable.name)}"
            value="${escapeAttribute(value)}"
            placeholder="${escapeAttribute(t.templateFieldPlaceholder(variable.name))}"
          />
        </label>
      `;
    })
    .join("");

  const previewState = buildTemplateSendPreviewStateV2();
  const errorMessage = previewState?.clipboardMissing
    ? t.templateClipboardError
    : previewState && previewState.missingUserValues.length > 0
      ? t.templateMissingValues
      : "";

  templatePreview.textContent = previewState?.preview ?? modalState.prompt;
  setTemplateModalError(errorMessage);
  templateModalConfirm.disabled = Boolean(errorMessage);
}

async function openTemplateModalV2(
  prompt: string,
  targets: ComposerTarget[],
): Promise<void> {
  const variables = detectTemplateVariablesForTargets(targets);

  if (variables.length === 0) {
    await maybeMarkLoadedFavoriteAsUsed();
    await sendResolvedPrompt(prompt, buildResolvedBroadcastTargets(targets));
    return;
  }

  const baseDefaults = mergeTemplateSources(
    state.templateVariableCache,
    state.loadedTemplateDefaults
  );

  const userValues = Object.fromEntries(
    variables
      .filter((variable) => variable.kind === "user")
      .map((variable) => [variable.name, baseDefaults[variable.name] ?? ""])
  );

  // Resolve async system variables (url, title, selection, counter)
  const asyncExtra = await resolveAsyncTemplateVariables(variables);

  const systemValues = buildSystemTemplateValues(new Date(), {
    locale: isKorean ? "ko" : "en",
    extra: asyncExtra,
  });

  if (variables.some((variable) => variable.name === SYSTEM_TEMPLATE_VARIABLES.clipboard)) {
    const clipboardResult = await readClipboardTemplateValue();
    if (clipboardResult.ok) {
      systemValues[SYSTEM_TEMPLATE_VARIABLES.clipboard] = clipboardResult.text;
    }
  }

  state.pendingTemplateSend = {
    prompt,
    targets,
    variables,
    userValues,
    systemValues,
  };

  renderTemplateModalV2();
  openOverlay(templateModal, templateFields.querySelector("input") ?? templateModalConfirm);
}

function renderTabLabels() {
  extTitle.textContent = t.title;
  extDesc.textContent = t.desc;
  clearPromptBtn.textContent = t.clearPrompt;
  sitesLabel.textContent = t.sitesLabel;
  saveFavoriteBtn.textContent = t.saveFavorite;
  sendBtn.textContent = t.send;
  historySearchInput.placeholder = t.historySearch;
  favoritesSearchInput.placeholder = t.favoritesSearch;
  settingsTitle.textContent = t.settingsTitle;
  settingsDesc.textContent = t.settingsDesc;
  reuseExistingTabsLabel.textContent = t.reuseTabsLabel;
  reuseExistingTabsDesc.textContent = state.settings.reuseExistingTabs
    ? t.reuseTabsDescEnabled
    : t.reuseTabsDescDisabled;
  waitMultiplierLabel.textContent = t.waitMultiplierLabel;
  waitMultiplierValue.textContent = t.waitMultiplierValue(state.settings.waitMsMultiplier);
  openOptionsBtn.textContent = t.openOptions;
  clearHistoryBtn.textContent = t.clearHistory;
  exportJsonBtn.textContent = t.exportJson;
  importJsonBtn.textContent = t.importJson;
  serviceManagementTitle.textContent = t.serviceManagementTitle;
  serviceManagementDesc.textContent = t.serviceManagementDesc;
  addServiceBtn.textContent = t.addService;
  resetSitesBtn.textContent = t.resetServices;
  serviceEditorDesc.textContent = t.serviceEditorDesc;
  serviceNameLabel.textContent = t.serviceFieldName;
  serviceUrlLabel.textContent = t.serviceFieldUrl;
  serviceInputSelectorLabel.textContent = t.serviceFieldInputSelector;
  testSelectorBtn.textContent = t.serviceTest;
  serviceInputTypeLabel.textContent = t.serviceFieldInputType;
  serviceSubmitSelectorLabel.textContent = t.serviceFieldSubmitSelector;
  serviceSubmitMethodLabel.textContent = t.serviceFieldSubmitMethod;
  serviceAdvancedTitle.textContent = t.serviceFieldAdvanced;
  serviceFallbackSelectorsLabel.textContent = t.serviceFieldFallbackSelectors;
  serviceAuthSelectorsLabel.textContent = t.serviceFieldAuthSelectors;
  serviceHostnameAliasesLabel.textContent = t.serviceFieldHostnameAliases;
  serviceSupportedRoutesLabel.textContent = t.serviceFieldSupportedRoutes;
  serviceVerifiedAtLabel.textContent = t.serviceFieldVerifiedAt;
  serviceVerifiedRouteLabel.textContent = t.serviceFieldVerifiedRoute;
  serviceVerifiedAuthStateLabel.textContent = t.serviceFieldVerifiedAuthState;
  serviceVerifiedLocaleLabel.textContent = t.serviceFieldVerifiedLocale;
  serviceVerifiedVersionLabel.textContent = t.serviceFieldVerifiedVersion;
  const verifiedAuthUnknownOption = serviceVerifiedAuthStateSelect.querySelector("option[value='']");
  const verifiedAuthLoggedInOption = serviceVerifiedAuthStateSelect.querySelector("option[value='logged-in']");
  const verifiedAuthLoggedOutOption = serviceVerifiedAuthStateSelect.querySelector("option[value='logged-out']");
  const verifiedAuthSoftGatedOption = serviceVerifiedAuthStateSelect.querySelector("option[value='soft-gated']");
  if (verifiedAuthUnknownOption) {
    verifiedAuthUnknownOption.textContent = t.serviceVerifiedAuthStateUnknown;
  }
  if (verifiedAuthLoggedInOption) {
    verifiedAuthLoggedInOption.textContent = t.serviceVerifiedAuthStateLoggedIn;
  }
  if (verifiedAuthLoggedOutOption) {
    verifiedAuthLoggedOutOption.textContent = t.serviceVerifiedAuthStateLoggedOut;
  }
  if (verifiedAuthSoftGatedOption) {
    verifiedAuthSoftGatedOption.textContent = t.serviceVerifiedAuthStateSoftGated;
  }
  serviceWaitLabel.textContent = t.serviceFieldWait;
  serviceColorLabel.textContent = t.serviceFieldColor;
  serviceIconLabel.textContent = t.serviceFieldIcon;
  serviceEnabledLabel.textContent = t.serviceFieldEnabled;
  serviceEditorCancel.textContent = t.serviceEditorCancel;
  serviceEditorSave.textContent = t.serviceEditorSave;
  resendModalTitle.textContent = t.resendModalTitle;
  resendModalDesc.textContent = t.resendModalDesc;
  resendModalCancel.textContent = t.resendModalCancel;
  resendModalConfirm.textContent = t.resendModalConfirm;
  importReportModalTitle.textContent = t.importReportTitle;
  importReportModalDesc.textContent = t.importReportDesc;
  importReportModalConfirm.textContent = t.importReportClose;

  tabButtons.forEach((button) => {
    const tabId = button.dataset.tab as PopupTabId | undefined;
    button.textContent = tabId ? t.tabs[tabId] : "";
  });

  applyDynamicPromptPlaceholder();
  updatePromptCounter();
}

function renderSiteCheckboxes() {
  const previousSelection = new Set(checkedSiteIds());
  sitesContainer.innerHTML = "";

  getEnabledSites().forEach((site) => {
    const card = document.createElement("label");
    card.className = "site-card checked";
    card.htmlFor = `site-${site.id}`;
    card.style.setProperty("--site-color", site.color || "#c24f2e");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `site-${site.id}`;
    checkbox.value = site.id;
    checkbox.checked = previousSelection.size > 0 ? previousSelection.has(site.id) : true;

    const siteIcon = document.createElement("span");
    siteIcon.className = "site-icon";
    siteIcon.textContent = getSiteIcon(site);

    const siteName = document.createElement("span");
    siteName.className = "site-name";
    siteName.textContent = `${getRuntimeSiteLabel(site.id)}`;

    const selectorWarning = state.failedSelectors.get(site.id);
    if (selectorWarning) {
      card.classList.add("selector-warning");
      card.title = t.selectorWarningTooltip;
    }

    checkbox.addEventListener("change", () => {
      card.classList.toggle("checked", checkbox.checked);
      syncToggleAllLabel();
      renderTemplateSummary();
    });

    const siteStatus = document.createElement("span");
    siteStatus.className = "site-status";
    siteStatus.setAttribute("aria-hidden", "true");

    const warningIcon = document.createElement("span");
    warningIcon.className = "site-warning";
    warningIcon.setAttribute("aria-hidden", "true");
    warningIcon.textContent = selectorWarning ? "⚠" : "";

    card.classList.toggle("checked", checkbox.checked);
    card.append(checkbox, siteIcon, siteName, warningIcon, siteStatus);
    sitesContainer.appendChild(card);
  });

  syncToggleAllLabel();
  setCardStatesFromBroadcast(state.lastBroadcast);
}

function renderSiteCheckboxesPanel() {
  const previousSelection = new Set(checkedSiteIds());
  sitesContainer.innerHTML = "";

  getEnabledSites().forEach((site) => {
    const card = document.createElement("article");
    card.className = "site-card checked";
    card.dataset.siteId = site.id;
    card.style.setProperty("--site-color", site.color || "#c24f2e");
    card.setAttribute("role", "option");
    card.tabIndex = 0;

    const mainRow = document.createElement("label");
    mainRow.className = "site-card-main";
    mainRow.htmlFor = `site-${site.id}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `site-${site.id}`;
    checkbox.value = site.id;
    checkbox.checked = previousSelection.size > 0 ? previousSelection.has(site.id) : true;

    const siteIcon = document.createElement("span");
    siteIcon.className = "site-icon";
    siteIcon.textContent = getSiteIcon(site);

    const siteName = document.createElement("span");
    siteName.className = "site-name";
    siteName.textContent = `${getRuntimeSiteLabel(site.id)}`;

    const selectorWarning = state.failedSelectors.get(site.id);
    if (selectorWarning) {
      card.classList.add("selector-warning");
      card.title = t.selectorWarningTooltip;
    }

    checkbox.addEventListener("change", () => {
      card.classList.toggle("checked", checkbox.checked);
      card.setAttribute("aria-selected", String(checkbox.checked));
      card.setAttribute(
        "aria-label",
        `${getRuntimeSiteLabel(site.id)} ${checkbox.checked ? t.ariaSelected : t.ariaNotSelected}`
      );
      syncToggleAllLabel();
      renderTemplateSummary();
    });

    card.addEventListener("keydown", (event) => {
      if (event.key !== " " && event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const siteStatus = document.createElement("span");
    siteStatus.className = "site-status";
    siteStatus.setAttribute("aria-hidden", "true");

    const warningIcon = document.createElement("span");
    warningIcon.className = "site-warning";
    warningIcon.setAttribute("aria-hidden", "true");
    warningIcon.textContent = selectorWarning ? "!" : "";

    mainRow.append(checkbox, siteIcon, siteName, warningIcon, siteStatus);
    card.classList.toggle("checked", checkbox.checked);
    card.setAttribute("aria-selected", String(checkbox.checked));
    card.setAttribute(
      "aria-label",
      `${getRuntimeSiteLabel(site.id)} ${checkbox.checked ? t.ariaSelected : t.ariaNotSelected}`
    );
    card.appendChild(mainRow);

    const openTabs = getOpenSiteTabs(site.id);
    const selectedTarget = state.siteTargetSelections?.[site.id] ?? getDefaultSiteTargetSelection();

    if (openTabs.length > 0) {
      const tabsWrap = document.createElement("div");
      tabsWrap.className = "site-tabs";

      const tabsHead = document.createElement("div");
      tabsHead.className = "site-tabs-head";
      tabsHead.textContent = t.openTabsTitle(openTabs.length);

      const tabsList = document.createElement("div");
      tabsList.className = "site-tabs-list";
      const radioName = `site-target-${site.id}`;

      const appendTargetOption = (
        choiceValue: PopupState["siteTargetSelections"][string],
        title: string,
        detail: string,
        pillText = "",
      ): void => {
        const option = document.createElement("label");
        option.className = "site-tab-option";

        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = radioName;
        radio.value = typeof choiceValue === "number" ? `tab:${choiceValue}` : String(choiceValue);
        radio.checked = choiceValue === selectedTarget;

        const copy = document.createElement("span");
        copy.className = "site-tab-copy";

        const titleNode = document.createElement("span");
        titleNode.className = "site-tab-title";
        titleNode.textContent = title;

        const detailNode = document.createElement("span");
        detailNode.className = "site-tab-meta";
        detailNode.textContent = detail;

        copy.append(titleNode, detailNode);
        option.append(radio, copy);

        if (pillText) {
          const pill = document.createElement("span");
          pill.className = "site-tab-pill";
          pill.textContent = pillText;
          option.appendChild(pill);
        }

        radio.addEventListener("change", () => {
          if (!radio.checked) {
            return;
          }

          state.siteTargetSelections[site.id] = choiceValue;
          if (!checkbox.checked) {
            checkbox.checked = true;
            card.classList.add("checked");
          }
          syncToggleAllLabel();
        });

        tabsList.appendChild(option);
      };

      appendTargetOption(
        "default",
        t.openTabsUseDefault,
        t.openTabsUseDefaultDetail(getDefaultTargetModeLabel())
      );
      appendTargetOption(
        "new",
        t.openTabsAlwaysNew,
        t.openTabsAlwaysNewDetail
      );

      openTabs.forEach((tab) => {
        const detailText = previewText(tab.url || tab.title || "", 52);
        const pillText = tab.active
          ? t.openTabsActive
          : tab.status === "loading"
            ? t.openTabsLoading
            : t.openTabsReady;

        appendTargetOption(
          tab.tabId,
          previewText(tab.title || tab.url || `${site.name} tab`, 48),
          detailText,
          pillText
        );
      });

      tabsWrap.append(tabsHead, tabsList);
      card.appendChild(tabsWrap);
    }

    // Per-service prompt override toggle
    const overrideToggleRow = document.createElement("div");
    overrideToggleRow.className = "site-override-toggle-row";

    const overrideToggle = document.createElement("button");
    const hasOverride = Boolean(state.sitePromptOverrides?.[site.id]?.trim());
    overrideToggle.className = `ghost-button small-button site-override-toggle${hasOverride ? " active" : ""}`;
    overrideToggle.type = "button";
    overrideToggle.dataset.siteOverrideToggle = site.id;
    overrideToggle.title = msg("popup_override_prompt_label") || "Custom prompt for this service";
    overrideToggle.textContent = hasOverride ? "✎ " + (msg("popup_override_active") || "Custom") : "✎";

    const overrideWrap = document.createElement("div");
    overrideWrap.className = "site-override-wrap";
    overrideWrap.hidden = !hasOverride;

    const overrideTextarea = document.createElement("textarea");
    overrideTextarea.className = "site-override-textarea";
    overrideTextarea.rows = 3;
    overrideTextarea.placeholder = msg("popup_override_prompt_placeholder") || "Override prompt for this service only…";
    overrideTextarea.value = state.sitePromptOverrides?.[site.id] ?? "";
    overrideTextarea.dataset.siteOverrideInput = site.id;

    overrideTextarea.addEventListener("input", () => {
      state.sitePromptOverrides[site.id] = overrideTextarea.value;
      const nowActive = Boolean(overrideTextarea.value.trim());
      overrideToggle.classList.toggle("active", nowActive);
      overrideToggle.textContent = nowActive ? "✎ " + (msg("popup_override_active") || "Custom") : "✎";
      renderTemplateSummary();
    });

    overrideToggle.addEventListener("click", () => {
      overrideWrap.hidden = !overrideWrap.hidden;
      if (!overrideWrap.hidden) {
        overrideTextarea.focus();
      }
    });

    overrideWrap.appendChild(overrideTextarea);
    overrideToggleRow.append(overrideToggle);
    card.append(overrideToggleRow, overrideWrap);

    sitesContainer.appendChild(card);
  });

  syncToggleAllLabel();
  setCardStatesFromBroadcast(state.lastBroadcast);
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

  for (const site of selectedSites) {
    if (!site.isCustom) {
      continue;
    }

    const granted = await ensureSiteOriginPermission(site.url, site.hostnameAliases);
    if (!granted) {
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
      setStatus(t.importFailed, "error");
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

  templateModalClose.addEventListener("click", hideTemplateModal);
  templateModalCancel.addEventListener("click", hideTemplateModal);
  templateModal.addEventListener("click", (event) => {
    if (event.target === templateModal) {
      hideTemplateModal();
    }
  });
  templateFields.addEventListener("input", (event) => {
    const input = getEventElement(event.target)?.closest<HTMLInputElement>("[data-template-input]");
    const templateInput = input?.dataset.templateInput;
    if (!input || !templateInput || !state.pendingTemplateSend) {
      return;
    }

    state.pendingTemplateSend.userValues[templateInput] = input.value;
    renderTemplateModalV2();
  });
  templateModalConfirm.addEventListener("click", () => {
    void confirmTemplateModalSend().catch((error) => {
      console.error("[AI Prompt Broadcaster] Template modal confirm failed.", error);
      setTemplateModalError(t.error(getErrorMessage(error)));
    });
  });
  bindFavoriteEditorEvents();

  resendModalClose.addEventListener("click", hideResendModal);
  resendModalCancel.addEventListener("click", hideResendModal);
  resendModal.addEventListener("click", (event) => {
    if (event.target === resendModal) {
      hideResendModal();
    }
  });
  resendModalConfirm.addEventListener("click", () => {
    void confirmResendModal().catch((error) => {
      console.error("[AI Prompt Broadcaster] Resend modal confirm failed.", error);
      setStatus(t.error(getErrorMessage(error)), "error");
    });
  });

  importReportModalClose.addEventListener("click", hideImportReportModal);
  importReportModalConfirm.addEventListener("click", hideImportReportModal);
  importReportModal.addEventListener("click", (event) => {
    if (event.target === importReportModal) {
      hideImportReportModal();
    }
  });

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
