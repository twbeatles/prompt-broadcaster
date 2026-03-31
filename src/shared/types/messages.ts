export interface BroadcastMessage {
  action: "broadcast";
  prompt: string;
  sites: Array<string | {
    id?: string;
    tabId?: number;
    reuseExistingTab?: boolean;
    openInNewTab?: boolean;
    target?: string;
    promptOverride?: string;
  }>;
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

export interface UiToastMessage {
  action: "uiToast";
  toast: Record<string, unknown>;
}

export interface SelectionUpdateMessage {
  action: "selection:update";
  text: string;
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
  | UiToastMessage
  | SelectionUpdateMessage;
