import {
  dispatchInputEvents,
  elementValueMatchesPrompt,
  getNativeValueSetter,
  isLexicalEditorElement,
  logError,
  replaceContentEditableText,
  selectAllEditableContents,
  setLexicalEditorText,
  setTextInputSelectionToEnd,
  syncReactValueTracker,
} from "./dom";

export function strategyNativeSetter(element: Element, prompt: string): boolean {
  try {
    const setter = getNativeValueSetter(element);
    const previousValue = "value" in element ? String((element as HTMLInputElement | HTMLTextAreaElement).value ?? "") : "";
    (element as HTMLElement).focus();

    if (typeof setter === "function") {
      setter.call(element, prompt);
    } else if ("value" in element) {
      (element as HTMLInputElement | HTMLTextAreaElement).value = prompt;
    } else {
      return false;
    }

    syncReactValueTracker(element, previousValue);
    setTextInputSelectionToEnd(element);
    dispatchInputEvents(element, prompt);
    return elementValueMatchesPrompt(element, prompt);
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
    return Boolean(inserted) || elementValueMatchesPrompt(element, prompt);
  } catch (error) {
    logError("execCommand strategy failed", error);
    return false;
  }
}

export function strategyLexicalEditorState(element: Element, prompt: string): boolean {
  try {
    if (!isLexicalEditorElement(element)) {
      return false;
    }

    return setLexicalEditorText(element, prompt);
  } catch (error) {
    logError("Lexical editor strategy failed", error);
    return false;
  }
}

export function strategyDirectContenteditable(element: Element, prompt: string): boolean {
  try {
    if (!(element as HTMLElement).isContentEditable) {
      return false;
    }

    const replaced = replaceContentEditableText(element as HTMLElement, prompt);
    if (!replaced) {
      return false;
    }

    dispatchInputEvents(element, prompt);
    return elementValueMatchesPrompt(element, prompt);
  } catch (error) {
    logError("Direct contenteditable strategy failed", error);
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
    return elementValueMatchesPrompt(element, prompt);
  } catch (error) {
    logError("Paste event strategy failed", error);
    return false;
  }
}
