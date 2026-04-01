export type InputType = "textarea" | "contenteditable" | "input";
export type SubmitMethod = "click" | "enter" | "shift+enter";
export type SelectorCheckMode = "input-and-submit" | "input-only";
export type TemplateVariableKind = "system" | "user";

export interface AppSettings {
  historyLimit: number;
  autoClosePopup: boolean;
  desktopNotifications: boolean;
  reuseExistingTabs: boolean;
}

export interface TemplateVariableDescriptor {
  name: string;
  kind: TemplateVariableKind;
}

export interface SiteConfig {
  id: string;
  name: string;
  url: string;
  hostname?: string;
  hostnameAliases?: string[];
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
  siteResults: Record<string, string>;
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
}

export interface FailedSelectorRecord {
  serviceId: string;
  selector: string;
  source: string;
  timestamp: string;
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
  siteResults: Record<string, string>;
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
  siteResults: Record<string, string>;
  startedAt: string;
  status: string;
  originTabId?: number | null;
  originWindowId?: number | null;
}

export interface ReusableTabSurfaceSnapshot {
  pathname?: string;
  hasPromptSurface?: boolean;
  hasAuthSurface?: boolean;
  hasSubmitSurface?: boolean;
  requiresSubmitSurface?: boolean;
}

export interface ReusableTabPreflightResult {
  ok: boolean;
  reason?: string;
}
