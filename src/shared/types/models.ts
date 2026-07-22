export type InputType = "textarea" | "contenteditable" | "input";
export type SubmitMethod = "click" | "enter" | "shift+enter";
export type SelectorCheckMode =
  | "input-and-submit"
  | "input-and-conditional-submit"
  | "input-only";
export type SubmitSurfaceRequirement = "none" | "required" | "conditional";
export type VerifiedAuthState = "logged-in" | "logged-out" | "soft-gated";
export type TemplateVariableKind = "system" | "user";
export type HistorySort = "latest" | "oldest" | "mostSuccess" | "mostFailure";
export type FavoriteSort = "recentUsed" | "usageCount" | "title" | "createdAt";
export type FavoriteMode = "single" | "chain";
export type ScheduleRepeat = "none" | "daily" | "weekday" | "weekly";
export type FavoriteExecutionTrigger = "popup" | "scheduled" | "palette" | "options";
export type BroadcastTargetMode = "default" | "new" | "tab";
export type ComparisonCaptureMode = "manual" | "selection" | "auto";
export type ChainFailurePolicy = "stop" | "continue" | "retry-once";
export type FavoriteRunJobStatus = "queued" | "running" | "completed" | "failed" | "skipped";
export type InjectionResultCode =
  | "submitted"
  | "selector_timeout"
  | "auth_required"
  | "submit_failed"
  | "strategy_exhausted"
  | "permission_denied"
  | "tab_create_failed"
  | "tab_closed"
  | "injection_timeout"
  | "cancelled"
  | "unexpected_error";

export interface InjectionStrategyAttempt {
  name: string;
  success: boolean;
}

export interface SiteInjectionResult {
  code: InjectionResultCode;
  message?: string;
  strategy?: string;
  elapsedMs?: number;
  attempts?: InjectionStrategyAttempt[];
}

export interface StrategyStats {
  [siteId: string]: {
    [strategyName: string]: {
      success: number;
      fail: number;
    };
  };
}

export interface ImportRejectedSite {
  id?: string;
  name: string;
  reason: string;
  origins?: string[];
  errors?: string[];
}

export interface ImportSummary {
  version: number;
  migratedFromVersion: number;
  customSites: {
    importedCount: number;
    acceptedIds: string[];
    acceptedNames: string[];
    rejected: ImportRejectedSite[];
    rewrittenIds: Array<{
      from: string;
      to: string;
      name: string;
    }>;
    deniedOrigins: string[];
  };
  builtInSiteStates: {
    appliedIds: string[];
    droppedIds: string[];
  };
  builtInSiteOverrides: {
    appliedIds: string[];
    droppedIds: string[];
    adjustedIds: string[];
  };
}

export interface AppSettings {
  historyLimit: number;
  autoClosePopup: boolean;
  desktopNotifications: boolean;
  reuseExistingTabs: boolean;
  autoCaptureResponses: boolean;
  waitMsMultiplier: number;
  historySort: HistorySort;
  favoriteSort: FavoriteSort;
  siteOrder: string[];
}

export interface TemplateVariableDescriptor {
  name: string;
  kind: TemplateVariableKind;
}

export interface ChainStep {
  id: string;
  text: string;
  delayMs: number;
  targetSiteIds: string[];
  failurePolicy: ChainFailurePolicy;
  targetMode?: BroadcastTargetMode;
  templateDefaults?: Record<string, string>;
}

export interface BroadcastComparisonNote {
  id: string;
  historyId: number;
  serviceId: string;
  responseText: string;
  captureMode: ComparisonCaptureMode;
  rating: number | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PromptExperimentVariant {
  id: string;
  title: string;
  text: string;
}

export interface PromptExperimentVariableSet {
  id: string;
  title: string;
  values: Record<string, string>;
}

export interface PromptExperimentRunRecord {
  id: string;
  createdAt: string;
  variantId: string;
  variableSetId: string;
  targetSiteIds: string[];
  broadcastIds: string[];
}

export interface PromptExperiment {
  id: string;
  title: string;
  description: string;
  variants: PromptExperimentVariant[];
  targetSiteIds: string[];
  variableSets: PromptExperimentVariableSet[];
  runs: PromptExperimentRunRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface TemplatePack {
  id: string;
  title: string;
  description: string;
  favoriteIds: string[];
  templates: FavoritePrompt[];
  includeSensitiveDefaults: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceGroup {
  id: string;
  title: string;
  serviceIds: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleContextSnapshot {
  enabled: boolean;
  url: string;
  title: string;
  selection: string;
  capturedAt: string | null;
}

export interface SiteConfig {
  id: string;
  name: string;
  url: string;
  hostname?: string;
  hostnameAliases?: string[];
  supportedRoutes?: string[];
  inputSelector: string;
  inputType: InputType;
  submitSelector?: string;
  submitMethod: SubmitMethod;
  selectorCheckMode?: SelectorCheckMode;
  waitMs: number;
  fallbackSelectors?: string[];
  fallback: boolean;
  authSelectors?: string[];
  lastVerified?: string;
  verifiedAt?: string;
  verifiedRoute?: string;
  verifiedAuthState?: VerifiedAuthState;
  verifiedLocale?: string;
  verifiedVersion?: string;
}

export interface RuntimeSite extends SiteConfig {
  enabled: boolean;
  color: string;
  icon: string;
  isBuiltIn: boolean;
  isCustom: boolean;
  deletable: boolean;
  editable: boolean;
  permissionPatterns: string[];
}

export interface RuntimeInjectionSiteConfig extends RuntimeSite {
  submitTimeoutMs?: number;
  submitRetryCount?: number;
  strategyOrder?: string[];
  waitMsMultiplier?: number;
}

export interface BroadcastTargetSelection {
  id: string;
  tabId?: number | null;
  reuseExistingTab?: boolean;
  openInNewTab?: boolean;
  target?: string;
  promptOverride?: string;
}

export interface ResolvedBroadcastTarget extends BroadcastTargetSelection {
  resolvedPrompt: string;
}

export interface BroadcastTargetSnapshot {
  siteId: string;
  resolvedPrompt: string;
  targetMode: BroadcastTargetMode;
  targetTabId: number | null;
}

export interface OpenSiteTab {
  siteId: string;
  siteName: string;
  tabId: number;
  title: string;
  url: string;
  active: boolean;
  status: string;
  windowId: number | null;
}

export interface PromptHistoryItem {
  id: number;
  text: string;
  requestedSiteIds: string[];
  submittedSiteIds: string[];
  failedSiteIds: string[];
  sentTo: string[];
  createdAt: string;
  status: string;
  siteResults: Record<string, SiteInjectionResult>;
  targetSnapshots: BroadcastTargetSnapshot[];
  originFavoriteId?: string | null;
  chainRunId?: string | null;
  chainStepIndex?: number | null;
  chainStepCount?: number | null;
  experimentRunId?: string | null;
  trigger?: FavoriteExecutionTrigger;
}

export interface FavoritePrompt {
  id: string;
  sourceHistoryId: number | null;
  title: string;
  text: string;
  sentTo: string[];
  createdAt: string;
  favoritedAt: string;
  templateDefaults: Record<string, string>;
  tags: string[];
  folder: string;
  pinned: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  mode: FavoriteMode;
  steps: ChainStep[];
  scheduleEnabled: boolean;
  scheduledAt: string | null;
  scheduleRepeat: ScheduleRepeat;
  scheduleContextSnapshot?: ScheduleContextSnapshot | null;
}

export interface FailedSelectorRecord {
  serviceId: string;
  selector: string;
  source: string;
  timestamp: string;
}

export interface PendingSelectorCheckRecord {
  serviceId: string;
  signature: string;
  missing: string[];
  count: number;
  firstSeenAt: number;
  lastSeenAt: number;
  /** True after the miss streak has already been escalated in this session. */
  promoted?: boolean;
}

export interface UiToastAction {
  id?: string;
  label: string;
  variant?: string;
}

export interface UiToast {
  id?: string;
  message: string;
  type?: string;
  duration?: number;
  createdAt?: string;
  actions?: UiToastAction[];
  meta?: Record<string, unknown>;
}

export interface LastBroadcastSummary {
  broadcastId: string;
  status: string;
  prompt: string;
  siteIds: string[];
  total: number;
  completed: number;
  submittedSiteIds: string[];
  failedSiteIds: string[];
  siteResults: Record<string, SiteInjectionResult>;
  targetSnapshots: BroadcastTargetSnapshot[];
  startedAt: string;
  finishedAt: string;
}

export interface PendingInjectionRecord {
  broadcastId: string;
  siteId: string;
  prompt: string;
  site: RuntimeSite;
  tabId?: number;
  createdAt: number;
  startedAt?: number;
  injected: boolean;
  status: string;
  closeOnCancel?: boolean;
}

export interface PendingBroadcastRecord {
  id: string;
  prompt: string;
  siteIds: string[];
  total: number;
  completed: number;
  submittedSiteIds: string[];
  failedSiteIds: string[];
  siteResults: Record<string, SiteInjectionResult>;
  targetSnapshots: BroadcastTargetSnapshot[];
  startedAt: string;
  status: string;
  originTabId?: number | null;
  originWindowId?: number | null;
  openedTabIds: number[];
  targetTabIdsBySiteId?: Record<string, number>;
  originFavoriteId?: string | null;
  chainRunId?: string | null;
  chainStepIndex?: number | null;
  chainStepCount?: number | null;
  experimentRunId?: string | null;
  trigger?: FavoriteExecutionTrigger;
}

export interface ServiceHealthSnapshot {
  serviceId: string;
  serviceName: string;
  enabled: boolean;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureCode: InjectionResultCode | null;
  selectorWarning: FailedSelectorRecord | null;
  preferredStrategy: string | null;
  successCount: number;
  failureCount: number;
  verification: {
    lastVerified?: string;
    verifiedAt?: string;
    verifiedRoute?: string;
    verifiedAuthState?: VerifiedAuthState;
    verifiedLocale?: string;
    verifiedVersion?: string;
  };
}

export interface PopupFavoriteIntent {
  type: "edit" | "run";
  favoriteId: string;
  reason?: string;
  source?: FavoriteExecutionTrigger | "options-edit";
  createdAt: string;
}

export interface ActiveComparisonContext {
  historyId: number;
  serviceId: string;
  source: "options-modal";
  updatedAt: string;
}

export interface PopupPromptIntent {
  prompt: string;
  createdAt: string;
}

export interface FavoriteRunExecutionContextSnapshot {
  tabId: number | null;
  windowId: number | null;
  url: string;
  title: string;
  selection: string;
  clipboard: string;
}

export interface FavoriteRunJobSummary {
  jobId: string;
  favoriteId: string;
  trigger: FavoriteExecutionTrigger;
  status: FavoriteRunJobStatus;
  mode: FavoriteMode;
  stepCount: number;
  completedSteps: number;
  currentStepIndex: number | null;
  chainRunId: string | null;
  currentBroadcastId: string | null;
  message: string;
  createdAt: string;
  updatedAt: string;
}

export interface FavoriteRunJobRecord extends FavoriteRunJobSummary {
  favoriteTitle: string;
  steps: ChainStep[];
  templateDefaults: Record<string, string>;
  executionContext: FavoriteRunExecutionContextSnapshot;
  stepRetryCounts?: Record<string, number>;
}

export interface ReusableTabSurfaceSnapshot {
  pathname?: string;
  supportedRoutes?: string[];
  hasPromptSurface?: boolean;
  hasAuthSurface?: boolean;
  hasSubmitSurface?: boolean;
  submitRequirement?: SubmitSurfaceRequirement;
}

export interface ReusableTabPreflightResult {
  ok: boolean;
  reason?: string;
}
