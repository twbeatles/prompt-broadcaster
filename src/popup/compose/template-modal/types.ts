import type {
  FavoriteExecutionTrigger,
  TemplateVariableDescriptor,
} from "../../../shared/types/models";
import type {
  FavoriteRunResponse,
} from "../../../shared/types/messages";
import type { PopupTemplateSendState } from "../../../shared/types/popup";

export type ComposerTarget = NonNullable<PopupTemplateSendState["targets"]>[number];

export interface PopupTemplateModalDeps {
  sendPopupMessage: <TResponse>(
    message: object,
    timeoutMs?: number,
  ) => Promise<TResponse | null>;
  buildResolvedBroadcastTargets: (
    targets?: ComposerTarget[],
    values?: Record<string, string>,
  ) => ComposerTarget[];
  detectTemplateVariablesForTargets: (
    targets?: ComposerTarget[],
  ) => TemplateVariableDescriptor[];
  findMissingTemplateValuesForTargets: (
    targets?: ComposerTarget[],
    userValues?: Record<string, string>,
  ) => string[];
  buildTemplatePreviewText: (
    targets?: ComposerTarget[],
    values?: Record<string, string>,
  ) => string;
  sendResolvedPrompt: (
    prompt: string,
    targets: ComposerTarget[],
  ) => Promise<void>;
  openOverlay: (
    overlay: HTMLElement | null,
    initialFocus?: HTMLElement | null,
  ) => void;
  closeOverlay: (overlay: HTMLElement | null) => void;
}

export interface FavoriteRunRequestOptions {
  trigger?: FavoriteExecutionTrigger;
  allowPopupFallback?: boolean;
}

export type RequestFavoriteRun = (
  favorite: import("../../../shared/types/models").FavoritePrompt,
  options?: FavoriteRunRequestOptions,
) => Promise<FavoriteRunResponse>;
