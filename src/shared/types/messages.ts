import type {
  FavoriteExecutionTrigger,
  FavoriteRunExecutionContextSnapshot,
  LastBroadcastSummary,
  OpenSiteTab,
  RuntimeInjectionSiteConfig,
} from "./models";

export interface BroadcastSiteTargetMessage {
  id?: string;
  tabId?: number;
  reuseExistingTab?: boolean;
  openInNewTab?: boolean;
  target?: "new" | "tab";
  promptOverride?: string;
  resolvedPrompt?: string;
}

export interface BroadcastMessage {
  action: "broadcast";
  prompt: string;
  sites: Array<string | BroadcastSiteTargetMessage>;
}

export interface SelectorCheckInitMessage {
  action: "selector-check:init";
  url: string;
}

export interface SelectorCheckReportMessage {
  action: "selector-check:report";
  status: string;
  siteId: string;
  siteName: string;
  pageUrl: string;
  missing?: Array<{ field: string; selector: string }>;
}

export interface ServiceTestRunMessage {
  action: "service-test:run";
  draft: Record<string, unknown>;
  isBuiltIn?: boolean;
}

export interface SelectorFailedMessage {
  action: "selectorFailed";
  serviceId: string;
  selector?: string;
}

export interface InjectSuccessMessage {
  action: "injectSuccess";
  serviceId: string;
  selector: string;
  strategy: string;
  elapsedMs: number;
}

export interface InjectFallbackMessage {
  action: "injectFallback";
  serviceId: string;
  copied?: boolean;
}

export interface PopupOpenedMessage {
  action: "popupOpened";
}

export interface GetOpenAiTabsMessage {
  action: "getOpenAiTabs";
  windowId?: number | null;
}

export interface CancelBroadcastMessage {
  action: "cancelBroadcast";
  broadcastId: string;
}

export interface FavoriteRunMessage {
  action: "favorite:run";
  favoriteId: string;
  trigger?: FavoriteExecutionTrigger;
  allowPopupFallback?: boolean;
  preparedExecutionContext?: Partial<FavoriteRunExecutionContextSnapshot>;
}

export interface FavoriteOpenEditorMessage {
  action: "favorite:openEditor";
  favoriteId: string;
  source?: "options-edit" | "popup";
}

export interface GetActiveTabContextMessage {
  action: "getActiveTabContext";
}

export interface GetBroadcastCounterMessage {
  action: "getBroadcastCounter";
}

export interface ResetAllDataMessage {
  action: "resetAllData";
}

export interface UiToastMessage {
  action: "uiToast";
  toast: Record<string, unknown>;
}

export interface SelectionUpdateMessage {
  action: "selection:update";
  text: string;
}

export interface QuickPaletteGetStateMessage {
  action: "quickPalette:getState";
}

export interface QuickPaletteExecuteMessage {
  action: "quickPalette:execute";
  favoriteId: string;
}

export interface QuickPaletteCloseMessage {
  action: "quickPalette:close";
}

export interface BroadcastResponse {
  ok: boolean;
  createdSiteCount: number;
  queuedSiteCount: number;
  requestedSiteCount: number;
  createdTabSiteIds: string[];
  reusedTabSiteIds: string[];
  failedTabSiteIds: string[];
  broadcastId?: string;
  error?: string;
}

export interface SelectorCheckInitResponse {
  ok: boolean;
  site: RuntimeInjectionSiteConfig | null;
}

export interface SelectorCheckReportResponse {
  ok: boolean;
}

export interface ServiceTestRunSuccessResponse {
  ok: true;
  tabId: number;
  tabUrl: string;
  input?: {
    found?: boolean;
    typeMatches?: boolean;
    actualType?: string;
    expectedType?: string;
  };
  submit?: {
    status?: string;
    method?: string;
  };
}

export interface ServiceTestRunFailureResponse {
  ok: false;
  reason?: string;
  error?: string;
}

export type ServiceTestRunResponse =
  | ServiceTestRunSuccessResponse
  | ServiceTestRunFailureResponse;

export interface GenericOkResponse {
  ok: boolean;
  error?: string;
}

export interface PopupOpenedResponse {
  ok: boolean;
  lastBroadcast: LastBroadcastSummary | null;
}

export interface GetOpenAiTabsResponse {
  ok: boolean;
  windowId: number | null;
  tabs: OpenSiteTab[];
}

export interface CancelBroadcastResponse {
  ok: boolean;
  summary: LastBroadcastSummary | null;
}

export interface FavoriteRunSuccessResponse {
  ok: true;
  deduped?: boolean;
  popupFallback?: boolean;
  requiresPopupInput?: boolean;
  jobId?: string;
  message?: string;
  reason?: string;
}

export interface FavoriteRunFailureResponse {
  ok: false;
  requiresPopupInput?: boolean;
  reason?: string;
  error?: string;
}

export type FavoriteRunResponse =
  | FavoriteRunSuccessResponse
  | FavoriteRunFailureResponse;

export interface FavoriteOpenEditorResponse {
  ok: boolean;
  error?: string;
}

export interface ActiveTabContextResponse {
  ok: boolean;
  url: string;
  title: string;
  selection: string;
}

export interface BroadcastCounterResponse {
  ok: boolean;
  counter: number;
  error?: string;
}

export interface QuickPaletteFavoriteSummary {
  id: string;
  title: string;
  text: string;
  preview: string;
  mode: "single" | "chain";
  tags: string[];
  folder: string;
}

export interface QuickPaletteGetStateResponse {
  ok: boolean;
  favorites: QuickPaletteFavoriteSummary[];
}

export interface RuntimeRequestMap {
  broadcast: BroadcastMessage;
  "selector-check:init": SelectorCheckInitMessage;
  "selector-check:report": SelectorCheckReportMessage;
  "service-test:run": ServiceTestRunMessage;
  selectorFailed: SelectorFailedMessage;
  injectSuccess: InjectSuccessMessage;
  injectFallback: InjectFallbackMessage;
  popupOpened: PopupOpenedMessage;
  getOpenAiTabs: GetOpenAiTabsMessage;
  cancelBroadcast: CancelBroadcastMessage;
  "favorite:run": FavoriteRunMessage;
  "favorite:openEditor": FavoriteOpenEditorMessage;
  getActiveTabContext: GetActiveTabContextMessage;
  getBroadcastCounter: GetBroadcastCounterMessage;
  resetAllData: ResetAllDataMessage;
  uiToast: UiToastMessage;
  "selection:update": SelectionUpdateMessage;
  "quickPalette:getState": QuickPaletteGetStateMessage;
  "quickPalette:execute": QuickPaletteExecuteMessage;
  "quickPalette:close": QuickPaletteCloseMessage;
}

export interface RuntimeResponseMap {
  broadcast: BroadcastResponse;
  "selector-check:init": SelectorCheckInitResponse;
  "selector-check:report": SelectorCheckReportResponse;
  "service-test:run": ServiceTestRunResponse;
  selectorFailed: GenericOkResponse;
  injectSuccess: GenericOkResponse;
  injectFallback: GenericOkResponse;
  popupOpened: PopupOpenedResponse;
  getOpenAiTabs: GetOpenAiTabsResponse;
  cancelBroadcast: CancelBroadcastResponse;
  "favorite:run": FavoriteRunResponse;
  "favorite:openEditor": FavoriteOpenEditorResponse;
  getActiveTabContext: ActiveTabContextResponse;
  getBroadcastCounter: BroadcastCounterResponse;
  resetAllData: GenericOkResponse;
  uiToast: GenericOkResponse;
  "selection:update": GenericOkResponse;
  "quickPalette:getState": QuickPaletteGetStateResponse;
  "quickPalette:execute": FavoriteRunResponse;
  "quickPalette:close": GenericOkResponse;
}

export type RuntimeAction = keyof RuntimeRequestMap;
export type RuntimeMessage = RuntimeRequestMap[RuntimeAction];
export type RuntimeResponse = RuntimeResponseMap[RuntimeAction];

export type RuntimeMessageOf<TAction extends RuntimeAction> =
  RuntimeRequestMap[TAction];
export type RuntimeResponseOf<TAction extends RuntimeAction> =
  RuntimeResponseMap[TAction];
