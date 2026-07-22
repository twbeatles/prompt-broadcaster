// @ts-nocheck
import { findElementDeep, sleep, waitForSelector } from "./dom";
import { sendSelectorCheckReport } from "./report";
import { logSelectorCheckerError, sendRuntimeMessage } from "./runtime";
import {
  buildSubmitRequirement,
  getSitePathBlockReason,
  normalizeSelectorEntries,
  shouldRequireVisibleSubmitSurface,
} from "../../shared/sites";

const ACCESS_CHALLENGE_SELECTORS = [
  "a[href*='cloudflare.com']",
  "#challenge-running",
  ".cf-browser-verification",
  ".cf-challenge",
  ".cf-turnstile",
  "iframe[src*='challenges.cloudflare.com']",
  "div#cf-challenge-running",
  "div.cf-challenge-container",
  "#challenge-stage",
];

function normalizePageText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function isLikelyAccessChallengePage() {
  try {
    const title = normalizePageText(document.title);
    const bodyText = normalizePageText(document.body?.innerText ?? "");
    const hasChallengeSelector = ACCESS_CHALLENGE_SELECTORS.some((selector) =>
      Boolean(findElementDeep(selector, document, { visibleOnly: true }))
    );

    return (
      hasChallengeSelector ||
      title.includes("just a moment") ||
      title.includes("잠시만 기다리십시오") ||
      title.includes("attention required") ||
      bodyText.includes("security check") ||
      bodyText.includes("checking your browser") ||
      bodyText.includes("checking if the site connection is secure") ||
      bodyText.includes("verify you are human") ||
      bodyText.includes("enable javascript and cookies") ||
      bodyText.includes("needs to review the security") ||
      bodyText.includes("보안 확인 수행 중") ||
      bodyText.includes("사용자가 봇이 아님") ||
      bodyText.includes("잠시만 기다리") ||
      bodyText.includes("사람인지 확인")
    );
  } catch (error) {
    logSelectorCheckerError("Failed access challenge detection in selector checker.", error);
    return false;
  }
}

export function isLikelyAuthPage(site) {
  try {
    if (getSitePathBlockReason(site, window.location.pathname) === "auth_path") {
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

    if (isLikelyAccessChallengePage()) {
      return true;
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

function isLikelyAppLoading() {
  try {
    const bodyText = normalizePageText(document.body?.innerText ?? "");
    if (!bodyText || bodyText.length < 8) {
      return true;
    }

    const busy =
      document.querySelector('[aria-busy="true"]') ||
      document.querySelector("progress") ||
      document.querySelector('[role="progressbar"]');
    if (busy && bodyText.length < 40) {
      return true;
    }

    return false;
  } catch (_error) {
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

    const pathBlockReason = getSitePathBlockReason(site, window.location.pathname);
    if (
      pathBlockReason === "settings_path" ||
      pathBlockReason === "unsupported_route"
    ) {
      await sendSelectorCheckReport({
        status: "skipped",
        reason: pathBlockReason,
        siteId: site.id,
        siteName: site.name,
        pageUrl: window.location.href,
      });
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

    // Re-evaluate after the wait: Cloudflare/login interstitials often appear late.
    if (isLikelyAuthPage(site)) {
      await sendSelectorCheckReport({
        status: "auth_page",
        siteId: site.id,
        siteName: site.name,
        pageUrl: window.location.href,
      });
      return;
    }

    const submitRequirement = buildSubmitRequirement(site);

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
      shouldRequireVisibleSubmitSurface(submitRequirement) &&
      site.submitSelector
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

    if (missing.length > 0) {
      // Final guard: do not escalate loading/auth/challenge states as selector drift.
      if (isLikelyAuthPage(site) || isLikelyAccessChallengePage()) {
        await sendSelectorCheckReport({
          status: "auth_page",
          siteId: site.id,
          siteName: site.name,
          pageUrl: window.location.href,
        });
        return;
      }

      if (isLikelyAppLoading()) {
        await sendSelectorCheckReport({
          status: "skipped",
          reason: "app_loading",
          siteId: site.id,
          siteName: site.name,
          pageUrl: window.location.href,
        });
        return;
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
