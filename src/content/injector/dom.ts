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

interface FindElementOptions {
  visibleOnly?: boolean;
  enabledOnly?: boolean;
  editableOnly?: boolean;
}

function pushUniqueMatch(matches: Element[], seen: Set<Element>, element: Element): void {
  if (!seen.has(element)) {
    seen.add(element);
    matches.push(element);
  }
}

function collectElementsDeep(
  selector: string,
  root: ParentNode | ShadowRoot | Document,
  matches: Element[],
  seen: Set<Element>,
): void {
  if (typeof (root as ParentNode).querySelectorAll === "function") {
    for (const element of Array.from((root as ParentNode).querySelectorAll(selector))) {
      pushUniqueMatch(matches, seen, element);
    }
  }

  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_ELEMENT);
  let current = walker.currentNode as Element | null;

  while (current) {
    if ((current as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot) {
      collectElementsDeep(
        selector,
        (current as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot as ShadowRoot,
        matches,
        seen,
      );
    }

    current = walker.nextNode() as Element | null;
  }
}

export function isElementVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
    return true;
  }

  const target = element as HTMLElement;
  const style = window.getComputedStyle(target);

  if (
    target.hidden ||
    target.getAttribute("hidden") !== null ||
    target.getAttribute("aria-hidden") === "true" ||
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.visibility === "collapse"
  ) {
    return false;
  }

  return target.getClientRects().length > 0;
}

export function isElementEnabled(element: Element): boolean {
  if (element.getAttribute("aria-disabled") === "true") {
    return false;
  }

  if ("disabled" in (element as HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement)) {
    return !Boolean((element as HTMLButtonElement | HTMLInputElement | HTMLTextAreaElement).disabled);
  }

  return true;
}

export function isEditableElement(element: Element): boolean {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    return !element.readOnly;
  }

  return element instanceof HTMLElement ? element.isContentEditable : false;
}

function matchesOptions(element: Element, options: FindElementOptions): boolean {
  if (options.visibleOnly && !isElementVisible(element)) {
    return false;
  }

  if (options.enabledOnly && !isElementEnabled(element)) {
    return false;
  }

  if (options.editableOnly && !isEditableElement(element)) {
    return false;
  }

  return true;
}

export function findElementsDeep(
  selector: string,
  root: ParentNode | ShadowRoot | Document = document,
  options: FindElementOptions = {},
): Element[] {
  try {
    if (!selector || typeof selector !== "string") {
      return [];
    }

    const matches: Element[] = [];
    collectElementsDeep(selector, root, matches, new Set<Element>());
    return matches.filter((element) => matchesOptions(element, options));
  } catch (error) {
    logError(`Deep selector lookup failed for ${selector}`, error);
    return [];
  }
}

export function findElementDeep(
  selector: string,
  root: ParentNode | ShadowRoot | Document = document,
  options: FindElementOptions = {},
): Element | null {
  return findElementsDeep(selector, root, options)[0] ?? null;
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
    return (element as HTMLElement).innerText ?? element.textContent ?? "";
  }

  return "";
}

export function normalizeComparableText(value: string): string {
  return String(value ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

export function elementValueMatchesPrompt(element: Element, prompt: string): boolean {
  return normalizeComparableText(getElementValueSnapshot(element)) === normalizeComparableText(prompt);
}

interface LexicalLikeEditor {
  parseEditorState(serializedEditorState: string): unknown;
  setEditorState(nextEditorState: unknown): void;
  focus(): void;
}

interface LexicalEditorElement extends HTMLElement {
  __lexicalEditor?: LexicalLikeEditor;
}

function buildLexicalParagraphNode(text: string) {
  return {
    children: text
      ? [
          {
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text,
            type: "text",
            version: 1,
          },
        ]
      : [],
    direction: null,
    format: "",
    indent: 0,
    type: "paragraph",
    version: 1,
    textFormat: 0,
    textStyle: "",
  };
}

export function isLexicalEditorElement(element: Element): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const lexicalElement = element as LexicalEditorElement;
  return (
    element.dataset.lexicalEditor === "true" ||
    typeof lexicalElement.__lexicalEditor?.parseEditorState === "function"
  );
}

export function setLexicalEditorText(element: Element, prompt: string): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const lexicalElement = element as LexicalEditorElement;
  const editor = lexicalElement.__lexicalEditor;
  if (
    !editor ||
    typeof editor.parseEditorState !== "function" ||
    typeof editor.setEditorState !== "function"
  ) {
    return false;
  }

  try {
    const paragraphs = String(prompt ?? "").split(/\n/g).map((line) => buildLexicalParagraphNode(line));
    const editorStateJson = {
      root: {
        children: paragraphs.length > 0 ? paragraphs : [buildLexicalParagraphNode("")],
        direction: null,
        format: "",
        indent: 0,
        type: "root",
        version: 1,
      },
    };

    const nextState = editor.parseEditorState(JSON.stringify(editorStateJson));
    editor.setEditorState(nextState);
    editor.focus();
    placeCaretAtEnd(element);
    return elementValueMatchesPrompt(element, prompt);
  } catch (error) {
    logError("Lexical editor update failed", error);
    return false;
  }
}

export function selectAllEditableContents(element: HTMLElement): void {
  element.focus();
  const selection = window.getSelection();
  if (!selection) {
    document.execCommand("selectAll", false);
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function placeCaretAtEnd(element: HTMLElement): void {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function setTextInputSelectionToEnd(element: Element): void {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const nextPosition = element.value.length;
    try {
      element.setSelectionRange(nextPosition, nextPosition);
    } catch (_error) {
      // Ignore browsers that do not allow manual selection on this input type.
    }
  }
}

export function syncReactValueTracker(element: Element, previousValue: string): void {
  const tracker = (element as Element & {
    _valueTracker?: {
      setValue?: (value: string) => void;
    };
  })._valueTracker;

  if (tracker && typeof tracker.setValue === "function") {
    tracker.setValue(previousValue);
  }
}

export function replaceContentEditableText(element: HTMLElement, prompt: string): boolean {
  if (!element.isContentEditable) {
    return false;
  }

  try {
    element.focus();
    selectAllEditableContents(element);

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();

      const fragment = document.createDocumentFragment();
      const lines = String(prompt ?? "").split(/\n/g);

      lines.forEach((line, index) => {
        if (index > 0) {
          fragment.appendChild(document.createElement("br"));
        }
        fragment.appendChild(document.createTextNode(line));
      });

      range.insertNode(fragment);
      placeCaretAtEnd(element);
    } else {
      element.textContent = prompt;
    }

    return true;
  } catch (error) {
    logError("Direct contenteditable replacement failed", error);
    return false;
  }
}

export function clearContentEditableText(element: HTMLElement): boolean {
  return replaceContentEditableText(element, "");
}
