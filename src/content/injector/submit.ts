import { findElementsDeep, logError, sleep } from "./dom";

export interface SubmitConfigLike {
  submitMethod?: string;
  submitSelector?: string;
  submitTimeoutMs?: number;
  submitRetryCount?: number;
}

const SUBMIT_BUTTON_WAIT_TIMEOUT_MS = 5000;
const SUBMIT_BUTTON_POLL_INTERVAL_MS = 100;

function getElementCenter(element: Element): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function getDistanceScore(left: Element, right: Element): number {
  const leftCenter = getElementCenter(left);
  const rightCenter = getElementCenter(right);
  const deltaX = leftCenter.x - rightCenter.x;
  const deltaY = leftCenter.y - rightCenter.y;
  return (deltaX * deltaX) + (deltaY * deltaY);
}

function pickSubmitButtonCandidate(candidates: Element[], referenceElement?: Element | null): Element | null {
  if (candidates.length === 0) {
    return null;
  }

  if (!referenceElement || candidates.length === 1) {
    return candidates[0] ?? null;
  }

  return [...candidates].sort((left, right) => {
    const leftScore = getDistanceScore(left, referenceElement);
    const rightScore = getDistanceScore(right, referenceElement);
    return leftScore - rightScore;
  })[0] ?? null;
}

export async function submitByClick(
  selector: string,
  referenceElement?: Element | null,
  timeoutMs = SUBMIT_BUTTON_WAIT_TIMEOUT_MS
): Promise<boolean> {
  try {
    const deadline = performance.now() + Math.max(Number(timeoutMs) || 0, SUBMIT_BUTTON_POLL_INTERVAL_MS);

    while (true) {
      const candidates = findElementsDeep(selector, document, {
        visibleOnly: true,
        enabledOnly: true,
      });
      const button = pickSubmitButtonCandidate(candidates, referenceElement);
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
  const retryCount = Math.max(0, Math.round(Number(config?.submitRetryCount) || 0));
  const submitTimeoutMs = Number(config?.submitTimeoutMs);
  const timeoutMs = Number.isFinite(submitTimeoutMs)
    ? submitTimeoutMs
    : SUBMIT_BUTTON_WAIT_TIMEOUT_MS;

  for (let attemptIndex = 0; attemptIndex <= retryCount; attemptIndex += 1) {
    let submitted = false;
    const method = config?.submitMethod;

    if (method === "click") {
      submitted = config?.submitSelector
        ? await submitByClick(config.submitSelector, element, timeoutMs)
        : submitByEnter(element, false);
    } else if (method === "shift+enter") {
      submitted = submitByEnter(element, true);
    } else {
      submitted = submitByEnter(element, false);
    }

    if (submitted) {
      return true;
    }

    if (attemptIndex < retryCount) {
      await sleep(250);
    }
  }

  return false;
}
