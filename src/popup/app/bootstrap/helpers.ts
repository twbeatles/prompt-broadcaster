import { sendRuntimeMessageWithTimeout } from "../../../shared/chrome/messaging";
import type {
  RuntimeAction,
  RuntimeMessageOf,
  RuntimeResponseOf,
} from "../../../shared/types/messages";
import type {
  PopupState,
  PopupTemplateSendState,
} from "../../../shared/types/popup";

export type ComposerTarget = NonNullable<PopupTemplateSendState["targets"]>[number];
export type PopupTabId = PopupState["activeTab"];

export async function sendPopupMessage<TAction extends RuntimeAction>(
  message: RuntimeMessageOf<TAction>,
  timeoutMs?: number,
  fallbackValue?: RuntimeResponseOf<TAction> | null,
): Promise<RuntimeResponseOf<TAction> | null> {
  return sendRuntimeMessageWithTimeout(message, timeoutMs, fallbackValue);
}

export function getEventElement(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : null;
}

export function getEventInput(target: EventTarget | null): HTMLInputElement | null {
  return target instanceof HTMLInputElement ? target : null;
}

export function getEventSelect(target: EventTarget | null): HTMLSelectElement | null {
  return target instanceof HTMLSelectElement ? target : null;
}

export function getImportErrorSummary(
  error: unknown,
): PopupState["pendingImportSummary"] {
  if (!error || typeof error !== "object" || !("importSummary" in error)) {
    return null;
  }

  const summary = (
    error as { importSummary?: PopupState["pendingImportSummary"] }
  ).importSummary;
  return summary ?? null;
}

export function getErrorMessage(
  error: unknown,
  getUnknownErrorText: () => string,
): string {
  return error instanceof Error ? error.message : getUnknownErrorText();
}
