// @ts-nocheck
import { DEFAULT_SETTINGS } from "../../shared/prompts";

export const SITE_EMOJI = {
  chatgpt: "GPT",
  gemini: "Gem",
  claude: "Cl",
  grok: "Gk",
};

export const state = {
  activeTab: "compose",
  history: [],
  favorites: [],
  historySearch: "",
  favoritesSearch: "",
  favoritesTagFilter: "",      // 태그 필터 (빈 문자열 = 전체)
  favoritesFolderFilter: "",   // 폴더 필터 (빈 문자열 = 전체)
  openMenuKey: null,
  openModalId: null,
  lastFocusedElement: null,
  favoriteSaveTimers: new Map(),
  loadedTemplateDefaults: {},
  loadedFavoriteTitle: "",
  loadedFavoriteId: "",
  templateVariableCache: {},
  pendingTemplateSend: null,
  pendingFavoriteSave: null,
  pendingResendHistory: null,
  pendingImportSummary: null,
  runtimeSites: [],
  serviceEditor: null,
  failedSelectors: new Map(),
  lastBroadcast: null,
  lastBroadcastToastSignature: "",
  isSending: false,
  sendSafetyTimer: null,
  settings: { ...DEFAULT_SETTINGS },
  openSiteTabs: [],
  siteTargetSelections: {},
  sitePromptOverrides: {},    // siteId -> override prompt string
  openTabsWindowId: null,
  openTabsRefreshTimer: null,
  listKeyboardFocus: {
    history: -1,
    favorites: -1,
  },
};
