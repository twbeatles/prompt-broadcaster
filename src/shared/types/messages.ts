import type { FavoriteRunExecutionContextSnapshot } from "./models";

export interface BroadcastSiteTargetMessage {
  id?: string;
  tabId?: number;
  reuseExistingTab?: boolean;
  openInNewTab?: boolean;
  target?: string;
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
  trigger?: "popup" | "scheduled" | "palette" | "options";
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

export type RuntimeMessage =
  | BroadcastMessage
  | SelectorCheckInitMessage
  | SelectorCheckReportMessage
  | ServiceTestRunMessage
  | SelectorFailedMessage
  | InjectSuccessMessage
  | InjectFallbackMessage
  | PopupOpenedMessage
  | GetOpenAiTabsMessage
  | CancelBroadcastMessage
  | FavoriteRunMessage
  | FavoriteOpenEditorMessage
  | GetActiveTabContextMessage
  | GetBroadcastCounterMessage
  | ResetAllDataMessage
  | UiToastMessage
  | SelectionUpdateMessage
  | QuickPaletteGetStateMessage
  | QuickPaletteExecuteMessage
  | QuickPaletteCloseMessage;
