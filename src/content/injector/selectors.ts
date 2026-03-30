import { findElementDeep, logError } from "./dom";

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
  return [
    config?.inputSelector,
    ...(Array.isArray(config?.fallbackSelectors) ? config.fallbackSelectors : []),
  ]
    .filter((selector): selector is string => typeof selector === "string" && Boolean(selector.trim()))
    .map((selector) => selector.trim())
    .filter((selector, index, list) => list.indexOf(selector) === index);
}

export function isLikelyAuthPage(config: SelectorConfigLike | null | undefined): boolean {
  try {
    const pathname = window.location.pathname.toLowerCase();
    if (
      pathname.includes("/login") ||
      pathname.includes("/logout") ||
      pathname.includes("/sign-in") ||
      pathname.includes("/signin") ||
      pathname.includes("/auth")
    ) {
      return true;
    }

    return Array.isArray(config?.authSelectors)
      ? config.authSelectors.some((selector) => Boolean(findElementDeep(selector)))
      : false;
  } catch (error) {
    logError("Auth page detection failed", error);
    return false;
  }
}

function createMatcher(selectors: string[]): { element: Element; selector: string } | null {
  for (const selector of selectors) {
    const element = findElementDeep(selector);
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
    });

    const intervalId = window.setInterval(tryMatch, 150);
    const timeoutId = window.setTimeout(() => finish(null), Math.max(timeoutMs, 0));
  });
}
