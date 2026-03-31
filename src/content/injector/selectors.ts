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

function splitSelectorList(selectorGroup: string): string[] {
  const source = typeof selectorGroup === "string" ? selectorGroup.trim() : "";
  if (!source) {
    return [];
  }

  const parts: string[] = [];
  let current = "";
  let bracketDepth = 0;
  let parenDepth = 0;
  let quote: "'" | "\"" | null = null;
  let escaping = false;

  for (const character of source) {
    current += character;

    if (escaping) {
      escaping = false;
      continue;
    }

    if (character === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === "'" || character === "\"") {
      quote = character;
      continue;
    }

    if (character === "[") {
      bracketDepth += 1;
      continue;
    }

    if (character === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }

    if (character === "(") {
      parenDepth += 1;
      continue;
    }

    if (character === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }

    if (character === "," && bracketDepth === 0 && parenDepth === 0) {
      current = current.slice(0, -1);
      const normalized = current.trim();
      if (normalized) {
        parts.push(normalized);
      }
      current = "";
    }
  }

  const trailing = current.trim();
  if (trailing) {
    parts.push(trailing);
  }

  return parts;
}

export function normalizeSelectors(config: SelectorConfigLike | null | undefined): string[] {
  return [
    config?.inputSelector,
    ...(Array.isArray(config?.fallbackSelectors) ? config.fallbackSelectors : []),
  ]
    .filter((selector): selector is string => typeof selector === "string" && Boolean(selector.trim()))
    .flatMap((selector) => splitSelectorList(selector))
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
    });

    const intervalId = window.setInterval(tryMatch, 150);
    const timeoutId = window.setTimeout(() => finish(null), Math.max(timeoutMs, 0));
  });
}
