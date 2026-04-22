import type { RuntimeSite } from "../../../../shared/types/models";
import type {
  PopupState,
  PopupToastInput,
} from "../../../../shared/types/popup";
import type { PopupTabId } from "../helpers";

export interface PopupHistoryListController {
  handleHistoryListClick: (event: MouseEvent) => void;
  handleHistoryListContextMenu: (event: MouseEvent) => void;
}

export interface PopupFavoritesListController {
  handleFavoriteFilterBarClick: (event: MouseEvent) => void;
  handleFavoritesListClick: (event: MouseEvent) => void;
  handleFavoritesListContextMenu: (event: MouseEvent) => void;
  handleFavoritesListInput: (event: Event) => void;
  handleFavoritesListBlur: (event: FocusEvent) => void;
}

export interface PopupStatusDeps {
  setStatus: (text: string, type?: string) => void;
  clearStatus: () => void;
  showAppToast: (
    input: PopupToastInput | string,
    type?: string,
    duration?: number,
  ) => string;
  showConfirmToast: (
    message: string,
    onConfirm: () => Promise<void> | void,
  ) => void;
  getErrorMessage: (error: unknown) => string;
}

export interface PopupComposeDeps {
  switchTab: (tabId: PopupTabId) => void;
  scheduleComposeDraftSave: (value?: string) => void;
  updatePromptCounter: () => void;
  autoResizePromptInput: () => void;
  renderTemplateSummary: () => void;
  allCheckboxes: () => HTMLInputElement[];
  syncToggleAllLabel: () => void;
  openFavoriteModal: () => Promise<void>;
  cancelCurrentBroadcast: () => Promise<void>;
  triggerRipple: (button: HTMLButtonElement, event: MouseEvent) => void;
  handleSend: () => Promise<void>;
}

export interface PopupListDeps {
  renderHistoryList: () => void;
  renderFavoritesList: () => void;
  renderLists: () => void;
  historyController: PopupHistoryListController;
  favoritesController: PopupFavoritesListController;
}

export interface PopupStorageDeps {
  applySettingsToControls: () => void;
  renderSiteCheckboxesPanel: () => void;
  refreshStoredData: () => Promise<void>;
  loadStoredData: () => Promise<void>;
  flushPendingSessionToasts: () => Promise<void>;
}

export interface PopupServiceDeps {
  resetServiceEditorForm: () => void;
  populateServiceEditor: (site: RuntimeSite | null) => void;
  hideServiceEditor: () => void;
  deleteManagedSite: (siteId: string) => Promise<void> | void;
  testSelectorOnActiveTab: () => Promise<void>;
  renderServicePermissionPreview: () => void;
  saveServiceEditorDraft: () => Promise<void>;
}

export interface PopupModalDeps {
  setTemplateModalError: (message?: string) => void;
  bindTemplateModalEvents: (onError: (message: string) => void) => void;
  bindFavoriteEditorEvents: () => void;
  bindHistoryModalEvents: (
    getErrorMessage: (error: unknown) => string,
  ) => void;
  openImportReportModal: (
    summary: PopupState["pendingImportSummary"],
  ) => void;
}

export interface PopupRuntimeDeps {
  trapModalFocus: (event: KeyboardEvent) => void;
  handleGlobalShortcut: (event: KeyboardEvent) => Promise<void>;
  scheduleOpenSiteTabsRefresh: () => void;
  applyLastBroadcastState: (
    summary: PopupState["lastBroadcast"],
    options?: { silentToast?: boolean },
  ) => void;
}

export interface PopupEventDeps {
  status: PopupStatusDeps;
  compose: PopupComposeDeps;
  lists: PopupListDeps;
  storage: PopupStorageDeps;
  services: PopupServiceDeps;
  modals: PopupModalDeps;
  runtime: PopupRuntimeDeps;
}
