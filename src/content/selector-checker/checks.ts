// @ts-nocheck
import { findElementDeep, sleep, waitForSelector } from "./dom";
import { sendSelectorCheckReport } from "./report";
import { logSelectorCheckerError, sendRuntimeMessage } from "./runtime";

function splitSelectorList(selectorGroup) {
  const source = typeof selectorGroup === "string" ? selectorGroup.trim() : "";
  if (!source) {
    return [];
  }

  const parts = [];
  let current = "";
  let bracketDepth = 0;
  let parenDepth = 0;
  let quote = null;
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

function normalizeSelectorEntries(selectors) {
  return (Array.isArray(selectors) ? selectors : [])
    .filter((selector) => typeof selector === "string" && selector.trim())
    .flatMap((selector) => splitSelectorList(selector))
    .filter((selector, index, list) => list.indexOf(selector) === index);
}

export function isLikelyAuthPage(site) {
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

    const promptSelectors = normalizeSelectorEntries([
      site?.inputSelector,
      ...(Array.isArray(site?.fallbackSelectors) ? site.fallbackSelectors : []),
    ]);

    const hasPromptSurface = promptSelectors.some((selector) =>
      Boolean(findElementDeep(selector, document, { visibleOnly: true, editableOnly: true }))
    );

    if (hasPromptSurface) {
      return false;
    }

    if (!Array.isArray(site?.authSelectors)) {
      return false;
    }

    return site.authSelectors.some((selector) =>
      Boolean(findElementDeep(selector, document, { visibleOnly: true }))
    );
  } catch (error) {
    logSelectorCheckerError("Failed auth page detection in selector checker.", error);
    return false;
  }
}

export async function runSelectorCheck() {
  try {
    const initResponse = await sendRuntimeMessage({
      action: "selector-check:init",
      url: window.location.href,
    });

    const site = initResponse?.site;
    if (!site) {
      return;
    }

    if (isLikelyAuthPage(site)) {
      await sendSelectorCheckReport({
        status: "auth_page",
        siteId: site.id,
        siteName: site.name,
        pageUrl: window.location.href,
      });
      return;
    }

    await sleep(Math.max(site.waitMs ?? 0, 1200));

    const checks = [
      {
        field: "inputSelector",
        selectors: normalizeSelectorEntries([
          site.inputSelector,
          ...(Array.isArray(site.fallbackSelectors) ? site.fallbackSelectors : []),
        ]),
        options: { visibleOnly: true, editableOnly: true },
      },
    ];

    if (
      site.submitMethod === "click" &&
      site.submitSelector &&
      site.selectorCheckMode !== "input-only"
    ) {
      checks.push({
        field: "submitSelector",
        selectors: normalizeSelectorEntries([site.submitSelector]),
        options: { visibleOnly: true },
      });
    }

    const missing = [];

    for (const check of checks) {
      let found = null;
      for (const selector of check.selectors) {
        found = await waitForSelector(selector, 5000, 250, check.options);
        if (found) {
          break;
        }
      }

      if (!found) {
        missing.push({
          field: check.field,
          selector: check.selectors[0] ?? "",
        });
      }
    }

    await sendSelectorCheckReport({
      status: missing.length > 0 ? "selector_missing" : "ok",
      siteId: site.id,
      siteName: site.name,
      pageUrl: window.location.href,
      missing,
    });
  } catch (error) {
    logSelectorCheckerError("Selector check failed.", error);
  }
}
