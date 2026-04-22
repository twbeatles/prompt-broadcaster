import type { BroadcastSiteTargetMessage } from "../../../shared/types/messages";
import type { LastBroadcastSummary } from "../../../shared/types/models";
import type {
  PopupTemplateSendState,
  PopupToastInput,
} from "../../../shared/types/popup";

export type ComposerTarget = NonNullable<PopupTemplateSendState["targets"]>[number];

export interface RuntimeBroadcastTarget {
  id: string;
  tabId?: number;
  reuseExistingTab?: boolean;
  target?: string;
  promptOverride?: string;
  resolvedPrompt?: string;
}

export interface PopupSendFlowDeps {
  refreshOpenSiteTabs: () => Promise<void>;
  sendPopupMessage: <TResponse>(
    message: object,
    timeoutMs?: number,
    fallbackValue?: TResponse | null,
  ) => Promise<TResponse | null>;
  buildRuntimeBroadcastTargets: (
    targets?: Array<ComposerTarget | BroadcastSiteTargetMessage>,
  ) => RuntimeBroadcastTarget[];
  setStatus: (text: string, type?: string) => void;
  showAppToast: (
    input: PopupToastInput | string,
    type?: string,
    duration?: number,
  ) => string;
  setSendingState: (isSending: boolean) => void;
  armSendSafetyTimer: () => void;
  clearSendSafetyTimer: () => void;
  buildBroadcastToastSignature: (
    summary: LastBroadcastSummary | null,
  ) => string;
  getUnknownErrorText: () => string;
  getErrorMessage: (error: unknown) => string;
  setLastSentPrompt: (prompt: string) => Promise<void>;
}

export interface PopupSendCardState {
  getSiteCardElement: (siteId: string) => HTMLElement | null;
  setSiteCardState: (siteId: string, cardState: string) => void;
  clearSiteCardStates: () => void;
  triggerRipple: (button: HTMLButtonElement, event: MouseEvent) => void;
}

export function hasTargetId(
  target: ComposerTarget | BroadcastSiteTargetMessage,
): target is ComposerTarget {
  return typeof target.id === "string" && target.id.trim().length > 0;
}

export function isLastBroadcastSummary(
  value: unknown,
): value is LastBroadcastSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<LastBroadcastSummary>;
  return (
    typeof candidate.broadcastId === "string"
    && typeof candidate.status === "string"
    && typeof candidate.prompt === "string"
    && Array.isArray(candidate.siteIds)
  );
}
