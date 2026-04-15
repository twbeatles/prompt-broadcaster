import type {
  AppSettings,
  FavoritePrompt,
  FavoriteRunJobRecord,
  FailedSelectorRecord,
  ImportSummary,
  LastBroadcastSummary,
  OpenSiteTab,
  PromptHistoryItem,
  RuntimeSite,
  SelectorCheckMode,
  TemplateVariableDescriptor,
} from "./models";

export interface PopupToastActionInput {
  id?: string;
  label: string;
  variant?: string;
  onClick?: () => void;
}

export interface PopupToastInput {
  id?: string;
  message: string;
  type?: string;
  duration?: number;
  actions?: PopupToastActionInput[];
}

export interface PopupTemplateTarget {
  id: string;
  tabId?: number;
  reuseExistingTab?: boolean;
  target?: string;
  promptTemplate?: string;
  promptOverride?: string;
  resolvedPrompt?: string;
}

export interface PopupTemplateSendState {
  prompt: string;
  sites?: string[] | PopupTemplateTarget[];
  targets?: PopupTemplateTarget[];
  variables: TemplateVariableDescriptor[];
  userValues: Record<string, string>;
  systemValues: Record<string, string>;
}

export type TemplateSendState = PopupTemplateSendState;

export interface PopupFavoriteEditorStepDraft {
  id: string;
  text: string;
  delayMs: number;
  targetSiteIds: string[];
}

export interface PopupFavoriteEditorState {
  favoriteId: string | null;
  prompt: string;
  sites: string[];
  variables: TemplateVariableDescriptor[];
  title: string;
  saveDefaults: boolean;
  defaultValues: Record<string, string>;
  tags: string[];
  folder: string;
  pinned: boolean;
  mode: "single" | "chain";
  steps: PopupFavoriteEditorStepDraft[];
  scheduleEnabled: boolean;
  scheduledAt: string | null;
  scheduleRepeat: "none" | "daily" | "weekday" | "weekly";
}

export interface ServiceEditorState {
  mode: "add" | "edit";
  siteId: string;
  isBuiltIn: boolean;
  selectorCheckMode: SelectorCheckMode;
}

export interface PopupState {
  activeTab: "compose" | "history" | "favorites" | "settings";
  history: PromptHistoryItem[];
  favorites: FavoritePrompt[];
  historySearch: string;
  favoritesSearch: string;
  favoritesTagFilter: string;
  favoritesFolderFilter: string;
  openMenuKey: string | null;
  openModalId: string | null;
  lastFocusedElement: HTMLElement | null;
  favoriteSaveTimers: Map<string, number>;
  loadedTemplateDefaults: Record<string, string>;
  loadedFavoriteTitle: string;
  loadedFavoriteId: string;
  templateVariableCache: Record<string, string>;
  pendingTemplateSend: PopupTemplateSendState | null;
  pendingFavoriteSave: PopupFavoriteEditorState | null;
  pendingFavoriteRunReason: string;
  pendingResendHistory: PromptHistoryItem | null;
  pendingImportSummary: ImportSummary | null;
  runtimeSites: RuntimeSite[];
  serviceEditor: ServiceEditorState | null;
  failedSelectors: Map<string, FailedSelectorRecord>;
  favoriteJobs: FavoriteRunJobRecord[];
  lastBroadcast: LastBroadcastSummary | null;
  lastBroadcastToastSignature: string;
  isSending: boolean;
  sendSafetyTimer: number | null;
  promptDraftSaveTimer: number | null;
  settings: AppSettings;
  openSiteTabs: OpenSiteTab[];
  siteTargetSelections: Record<string, "default" | "new" | number>;
  sitePromptOverrides: Record<string, string>;
  openTabsWindowId: number | null;
  openTabsRefreshTimer: number | null;
  listKeyboardFocus: {
    history: number;
    favorites: number;
  };
}

export interface PopupOverlayController {
  openOverlay: (
    overlay: HTMLElement | null,
    initialFocus?: HTMLElement | null,
  ) => void;
  closeOverlay: (overlay: HTMLElement | null) => void;
  getOpenOverlay: () => HTMLElement | null;
  closeActiveOverlayOrMenu: () => boolean;
  trapModalFocus: (event: KeyboardEvent) => void;
}

export interface PopupFeatureDeps {
  setStatus: (text: string, type?: string) => void;
  showAppToast: (
    input: PopupToastInput | string,
    type?: string,
    duration?: number,
  ) => void;
  getUnknownErrorText: () => string;
}

export interface PopupAppContext extends PopupFeatureDeps {
  state: PopupState;
  renderLists: () => void;
  refreshStoredData: () => Promise<void>;
}
