// @ts-nocheck
import { logSelectorCheckerError } from "./runtime";

export function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function isElementVisible(element) {
  if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
    return true;
  }

  const style = window.getComputedStyle(element);
  if (
    element.hidden ||
    element.getAttribute("hidden") !== null ||
    element.getAttribute("aria-hidden") === "true" ||
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.visibility === "collapse"
  ) {
    return false;
  }

  return element.getClientRects().length > 0;
}

export function isEditableElement(element) {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    return !element.readOnly;
  }

  return element instanceof HTMLElement ? element.isContentEditable : false;
}

function matchesOptions(element, options = {}) {
  if (options.visibleOnly && !isElementVisible(element)) {
    return false;
  }

  if (options.editableOnly && !isEditableElement(element)) {
    return false;
  }

  return true;
}

function collectElementsDeep(selector, root, matches, seen) {
  if (typeof root.querySelectorAll === "function") {
    for (const element of Array.from(root.querySelectorAll(selector))) {
      if (!seen.has(element)) {
        seen.add(element);
        matches.push(element);
      }
    }
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let currentNode = walker.currentNode;

  while (currentNode) {
    if (currentNode.shadowRoot) {
      collectElementsDeep(selector, currentNode.shadowRoot, matches, seen);
    }

    currentNode = walker.nextNode();
  }
}

export function findElementDeep(selector, root = document, options = {}) {
  try {
    if (!selector || typeof selector !== "string") {
      return null;
    }

    const matches = [];
    collectElementsDeep(selector, root, matches, new Set());

    for (const element of matches) {
      if (matchesOptions(element, options)) {
        return element;
      }
    }

    return null;
  } catch (error) {
    logSelectorCheckerError(`Failed selector lookup for ${selector}.`, error);
    return null;
  }
}

export async function waitForSelector(selector, timeoutMs = 4000, intervalMs = 250, options = {}) {
  try {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() <= deadline) {
      const element = findElementDeep(selector, document, options);
      if (element) {
        return element;
      }

      await sleep(intervalMs);
    }

    return null;
  } catch (error) {
    logSelectorCheckerError(`Failed while waiting for selector ${selector}.`, error);
    return null;
  }
}
