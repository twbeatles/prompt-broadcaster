import type {
  BroadcastComparisonNote,
  FavoriteExecutionTrigger,
  FavoriteRunExecutionContextSnapshot,
  LastBroadcastSummary,
  OpenSiteTab,
  PromptExperiment,
  RuntimeInjectionSiteConfig,
  ServiceGroup,
  ServiceHealthSnapshot,
  TemplatePack,
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

export interface ServiceHealthGetMessage {
  action: "service-health:get";
}

export interface ComparisonNoteListMessage {
  action: "comparison-note:list";
  historyId?: number | string | null;
}

export interface ComparisonNoteSaveMessage {
  action: "comparison-note:save";
  note: Partial<BroadcastComparisonNote>;
}

export interface ComparisonNoteDeleteMessage {
  action: "comparison-note:delete";
  noteId: string;
}

export interface ComparisonCaptureStartMessage {
  action: "comparison-capture:start";
  historyId: number | string;
  serviceId: string;
  tabId?: number | null;
}

export interface ComparisonCaptureStopMessage {
  action: "comparison-capture:stop";
  historyId?: number | string | null;
  serviceId?: string | null;
}

export interface ExperimentSaveMessage {
  action: "experiment:save";
  experiment: Partial<PromptExperiment>;
}

export interface ExperimentDeleteMessage {
  action: "experiment:delete";
  experimentId: string;
}

export interface ExperimentRunMessage {
  action: "experiment:run";
  experimentId: string;
}

export interface TemplatePackExportMessage {
  action: "template-pack:export";
  title?: string;
  favoriteIds?: string[];
  includeSensitiveDefaults?: boolean;
}

export interface TemplatePackImportMessage {
  action: "template-pack:import";
  pack: Partial<TemplatePack>;
}

export interface ServiceGroupsUpdateMessage {
  action: "service-groups:update";
  groups: ServiceGroup[];
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

export interface ServiceHealthGetResponse {
  ok: boolean;
  snapshots: ServiceHealthSnapshot[];
  error?: string;
}

export interface ComparisonNoteListResponse {
  ok: boolean;
  notes: BroadcastComparisonNote[];
  error?: string;
}

export interface ComparisonNoteSaveResponse {
  ok: boolean;
  note: BroadcastComparisonNote | null;
  error?: string;
}

export interface ComparisonNoteDeleteResponse {
  ok: boolean;
  notes: BroadcastComparisonNote[];
  error?: string;
}

export interface ComparisonCaptureStartResponse {
  ok: boolean;
  note?: BroadcastComparisonNote | null;
  captured?: boolean;
  message?: string;
  error?: string;
}

export interface ExperimentSaveResponse {
  ok: boolean;
  experiment: PromptExperiment | null;
  error?: string;
}

export interface ExperimentDeleteResponse {
  ok: boolean;
  experiments: PromptExperiment[];
  error?: string;
}

export interface ExperimentRunResponse {
  ok: boolean;
  experiment: PromptExperiment | null;
  runId?: string;
  queuedCount: number;
  broadcastIds: string[];
  preview: Array<{
    variantId: string;
    variableSetId: string;
    targetSiteIds: string[];
    prompt: string;
  }>;
  error?: string;
}

export interface TemplatePackTransferResponse {
  ok: boolean;
  pack: TemplatePack | null;
  importedFavoriteIds?: string[];
  skippedFavoriteIds?: string[];
  error?: string;
}

export interface ServiceGroupsUpdateResponse {
  ok: boolean;
  groups: ServiceGroup[];
  error?: string;
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
  "service-health:get": ServiceHealthGetMessage;
  "comparison-note:list": ComparisonNoteListMessage;
  "comparison-note:save": ComparisonNoteSaveMessage;
  "comparison-note:delete": ComparisonNoteDeleteMessage;
  "comparison-capture:start": ComparisonCaptureStartMessage;
  "comparison-capture:stop": ComparisonCaptureStopMessage;
  "experiment:save": ExperimentSaveMessage;
  "experiment:delete": ExperimentDeleteMessage;
  "experiment:run": ExperimentRunMessage;
  "template-pack:export": TemplatePackExportMessage;
  "template-pack:import": TemplatePackImportMessage;
  "service-groups:update": ServiceGroupsUpdateMessage;
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
  "service-health:get": ServiceHealthGetResponse;
  "comparison-note:list": ComparisonNoteListResponse;
  "comparison-note:save": ComparisonNoteSaveResponse;
  "comparison-note:delete": ComparisonNoteDeleteResponse;
  "comparison-capture:start": ComparisonCaptureStartResponse;
  "comparison-capture:stop": GenericOkResponse;
  "experiment:save": ExperimentSaveResponse;
  "experiment:delete": ExperimentDeleteResponse;
  "experiment:run": ExperimentRunResponse;
  "template-pack:export": TemplatePackTransferResponse;
  "template-pack:import": TemplatePackTransferResponse;
  "service-groups:update": ServiceGroupsUpdateResponse;
}

export type RuntimeAction = keyof RuntimeRequestMap;
export type RuntimeMessage = RuntimeRequestMap[RuntimeAction];
export type RuntimeResponse = RuntimeResponseMap[RuntimeAction];

export type RuntimeMessageOf<TAction extends RuntimeAction> =
  RuntimeRequestMap[TAction];
export type RuntimeResponseOf<TAction extends RuntimeAction> =
  RuntimeResponseMap[TAction];
