// @ts-nocheck
import { findElementDeep, sleep, waitForSelector } from "./dom";
import { sendSelectorCheckReport } from "./report";
import { logSelectorCheckerError, sendRuntimeMessage } from "./runtime";

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

    const promptSelectors = [
      site?.inputSelector,
      ...(Array.isArray(site?.fallbackSelectors) ? site.fallbackSelectors : []),
    ].filter((selector) => typeof selector === "string" && selector.trim());

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
        selectors: [
          site.inputSelector,
          ...(Array.isArray(site.fallbackSelectors) ? site.fallbackSelectors : []),
        ].filter((selector) => typeof selector === "string" && selector.trim()),
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
        selectors: [site.submitSelector],
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
