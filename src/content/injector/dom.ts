export function log(context: string, detail: string = ""): void {
  console.info(`[AI Prompt Broadcaster] ${context}`, detail);
}

export function logError(context: string, error: unknown): void {
  console.error(`[AI Prompt Broadcaster] ${context}`, error);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, Number.isFinite(ms) ? ms : 0);
  });
}

export function findElementDeep(selector: string, root: ParentNode | ShadowRoot | Document = document): Element | null {
  try {
    if (!selector || typeof selector !== "string") {
      return null;
    }

    if (typeof (root as ParentNode).querySelector === "function") {
      const direct = (root as ParentNode).querySelector(selector);
      if (direct) {
        return direct;
      }
    }

    const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_ELEMENT);
    let current = walker.currentNode as Element | null;

    while (current) {
      if ((current as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot) {
        const shadowMatch = findElementDeep(
          selector,
          (current as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot as ShadowRoot,
        );
        if (shadowMatch) {
          return shadowMatch;
        }
      }

      current = walker.nextNode() as Element | null;
    }

    return null;
  } catch (error) {
    logError(`Deep selector lookup failed for ${selector}`, error);
    return null;
  }
}

export function dispatchSimpleEvent(element: Element, type: string): void {
  element.dispatchEvent(
    new Event(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
    }),
  );
}

export function dispatchInputEvents(element: Element, value: string, inputType: string = "insertText"): void {
  try {
    element.dispatchEvent(
      new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        composed: true,
        data: value,
        inputType,
      }),
    );
  } catch (error) {
    logError("beforeinput dispatch failed", error);
  }

  try {
    element.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        composed: true,
        data: value,
        inputType,
      }),
    );
  } catch (error) {
    logError("input dispatch failed", error);
    dispatchSimpleEvent(element, "input");
  }

  dispatchSimpleEvent(element, "change");
}

export function getNativeValueSetter(element: Element): ((value: string) => void) | null {
  if (element instanceof HTMLTextAreaElement) {
    return (Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set as
      | ((value: string) => void)
      | undefined) ?? null;
  }

  if (element instanceof HTMLInputElement) {
    return (Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as
      | ((value: string) => void)
      | undefined) ?? null;
  }

  return null;
}

export function getElementValueSnapshot(element: Element): string {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value ?? "";
  }

  if ((element as HTMLElement).isContentEditable) {
    return element.textContent ?? "";
  }

  return "";
}

export function selectAllEditableContents(element: HTMLElement): void {
  element.focus();
  document.execCommand("selectAll", false);
}
