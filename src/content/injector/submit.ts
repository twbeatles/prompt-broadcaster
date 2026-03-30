import { findElementDeep, logError, sleep } from "./dom";

export interface SubmitConfigLike {
  submitMethod?: string;
  submitSelector?: string;
}

const SUBMIT_BUTTON_WAIT_TIMEOUT_MS = 5000;
const SUBMIT_BUTTON_POLL_INTERVAL_MS = 100;

export async function submitByClick(selector: string): Promise<boolean> {
  try {
    const deadline = performance.now() + SUBMIT_BUTTON_WAIT_TIMEOUT_MS;

    while (true) {
      const button = findElementDeep(selector, document, {
        visibleOnly: true,
        enabledOnly: true,
      });
      if (button) {
        (button as HTMLElement).click();
        return true;
      }

      if (performance.now() >= deadline) {
        return false;
      }

      await sleep(SUBMIT_BUTTON_POLL_INTERVAL_MS);
    }
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

export async function submitPrompt(
  element: Element,
  config: SubmitConfigLike | null | undefined,
): Promise<boolean> {
  if (config?.submitMethod === "click") {
    return config?.submitSelector ? submitByClick(config.submitSelector) : submitByEnter(element, false);
  }

  if (config?.submitMethod === "shift+enter") {
    return submitByEnter(element, true);
  }

  return submitByEnter(element, false);
}
