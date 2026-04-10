import { findElementDeep, logError } from "./dom";
import { hasKnownAuthPath, normalizeSelectorEntries } from "../../shared/sites";

export interface SelectorConfigLike {
  inputSelector?: string;
  fallbackSelectors?: string[];
  authSelectors?: string[];
}

export interface ElementMatch {
  element: Element;
  selector: string;
  elapsedMs: number;
}

export function normalizeSelectors(config: SelectorConfigLike | null | undefined): string[] {
  return normalizeSelectorEntries([
    config?.inputSelector,
    ...(Array.isArray(config?.fallbackSelectors) ? config.fallbackSelectors : []),
  ]);
}

export function isLikelyAuthPage(config: SelectorConfigLike | null | undefined): boolean {
  try {
    if (hasKnownAuthPath(window.location.pathname)) {
      return true;
    }

    const promptSelectors = normalizeSelectors(config);
    const hasPromptSurface = promptSelectors.some((selector) =>
      Boolean(findElementDeep(selector, document, { visibleOnly: true, editableOnly: true }))
    );

    if (hasPromptSurface) {
      return false;
    }

    return Array.isArray(config?.authSelectors)
      ? config.authSelectors.some((selector) =>
          Boolean(findElementDeep(selector, document, { visibleOnly: true }))
        )
      : false;
  } catch (error) {
    logError("Auth page detection failed", error);
    return false;
  }
}

function createMatcher(selectors: string[]): { element: Element; selector: string } | null {
  for (const selector of selectors) {
    const element = findElementDeep(selector, document, {
      visibleOnly: true,
      editableOnly: true,
    });
    if (element) {
      return { element, selector };
    }
  }

  return null;
}

export async function waitForElement(selectors: string[], timeoutMs: number = 8000): Promise<ElementMatch | null> {
  const normalizedSelectors = selectors.filter(Boolean);
  const startTime = performance.now();
  const initialMatch = createMatcher(normalizedSelectors);
  if (initialMatch) {
    return {
      ...initialMatch,
      elapsedMs: Math.round(performance.now() - startTime),
    };
  }

  return new Promise((resolve) => {
    let settled = false;

    const finish = (match: { element: Element; selector: string } | null): void => {
      if (settled) {
        return;
      }

      settled = true;
      observer.disconnect();
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      resolve(
        match
          ? {
              ...match,
              elapsedMs: Math.round(performance.now() - startTime),
            }
          : null,
      );
    };

    const tryMatch = (): void => {
      const match = createMatcher(normalizedSelectors);
      if (match) {
        finish(match);
      }
    };

    const observer = new MutationObserver(() => {
      tryMatch();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "id", "style", "disabled", "aria-disabled"],
    });

    const intervalId = window.setInterval(tryMatch, 150);
    const timeoutId = window.setTimeout(() => finish(null), Math.max(timeoutMs, 0));
  });
}
