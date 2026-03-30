export interface BroadcastMessage {
  action: "broadcast";
  prompt: string;
  sites: Array<string | { id?: string }>;
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
  | SelectorFailedMessage
  | InjectSuccessMessage
  | InjectFallbackMessage
  | PopupOpenedMessage
  | UiToastMessage
  | SelectionUpdateMessage;
