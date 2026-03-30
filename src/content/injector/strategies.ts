import {
  dispatchInputEvents,
  getElementValueSnapshot,
  getNativeValueSetter,
  logError,
  selectAllEditableContents,
} from "./dom";

export function strategyNativeSetter(element: Element, prompt: string): boolean {
  try {
    const setter = getNativeValueSetter(element);
    (element as HTMLElement).focus();

    if (typeof setter === "function") {
      setter.call(element, prompt);
    } else if ("value" in element) {
      (element as HTMLInputElement | HTMLTextAreaElement).value = prompt;
    } else {
      return false;
    }

    dispatchInputEvents(element, prompt);
    return getElementValueSnapshot(element).trim() === prompt.trim();
  } catch (error) {
    logError("Native setter strategy failed", error);
    return false;
  }
}

export function strategyExecCommand(element: Element, prompt: string): boolean {
  try {
    (element as HTMLElement).focus();
    selectAllEditableContents(element as HTMLElement);
    const inserted = document.execCommand("insertText", false, prompt);
    dispatchInputEvents(element, prompt);
    return Boolean(inserted) || getElementValueSnapshot(element).trim() === prompt.trim();
  } catch (error) {
    logError("execCommand strategy failed", error);
    return false;
  }
}

export function strategyPasteEvent(element: Element, prompt: string): boolean {
  try {
    (element as HTMLElement).focus();
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", prompt);

    const event = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer,
    });

    element.dispatchEvent(event);
    dispatchInputEvents(element, prompt, "insertFromPaste");
    return getElementValueSnapshot(element).trim() === prompt.trim();
  } catch (error) {
    logError("Paste event strategy failed", error);
    return false;
  }
}
