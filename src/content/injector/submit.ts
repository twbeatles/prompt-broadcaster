import { findElementDeep, logError } from "./dom";

export interface SubmitConfigLike {
  submitMethod?: string;
  submitSelector?: string;
}

export function submitByClick(selector: string): boolean {
  try {
    const button = findElementDeep(selector);
    if (!button) {
      return false;
    }

    (button as HTMLElement).click();
    return true;
  } catch (error) {
    logError("Click submit failed", error);
    return false;
  }
}

export function submitByEnter(element: Element, shiftKey: boolean = false): boolean {
  try {
    (element as HTMLElement).focus();
    const eventInit: KeyboardEventInit = {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
      composed: true,
      shiftKey: Boolean(shiftKey),
    } as KeyboardEventInit;

    element.dispatchEvent(new KeyboardEvent("keydown", eventInit));
    element.dispatchEvent(new KeyboardEvent("keypress", eventInit));
    element.dispatchEvent(new KeyboardEvent("keyup", eventInit));
    return true;
  } catch (error) {
    logError("Keyboard submit failed", error);
    return false;
  }
}

export function submitPrompt(element: Element, config: SubmitConfigLike | null | undefined): boolean {
  if (config?.submitMethod === "click") {
    return config?.submitSelector ? submitByClick(config.submitSelector) : submitByEnter(element, false);
  }

  if (config?.submitMethod === "shift+enter") {
    return submitByEnter(element, true);
  }

  return submitByEnter(element, false);
}
