"use strict";
var AIPromptBroadcasterSelectorCheckerBundle = (() => {
  // src/shared/chrome/messaging.ts
  var DEFAULT_RUNTIME_MESSAGE_TIMEOUT_MS = 5e3;
  function normalizeTimeoutMs(timeoutMs) {
    const numericValue = Number(timeoutMs);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return 0;
    }
    return Math.max(0, Math.round(numericValue));
  }
  function sendRuntimeMessage(message, timeoutMs = 0, fallbackValue = null) {
    return new Promise((resolve) => {
      let settled = false;
      let timeoutId = 0;
      const finish = (value) => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeoutId) {
          globalThis.clearTimeout(timeoutId);
        }
        resolve(value ?? fallbackValue);
      };
      const normalizedTimeoutMs = normalizeTimeoutMs(timeoutMs);
      if (normalizedTimeoutMs > 0) {
        timeoutId = globalThis.setTimeout(() => finish(fallbackValue), normalizedTimeoutMs);
      }
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            finish(fallbackValue);
            return;
          }
          finish(response ?? fallbackValue);
        });
      } catch (_error) {
        finish(fallbackValue);
      }
    });
  }
  function sendRuntimeMessageWithTimeout(message, timeoutMs = DEFAULT_RUNTIME_MESSAGE_TIMEOUT_MS, fallbackValue = null) {
    return sendRuntimeMessage(message, timeoutMs, fallbackValue);
  }

  // src/content/selector-checker/runtime.ts
  function logSelectorCheckerError(context, error) {
    console.error(`[AI Prompt Broadcaster] ${context}`, error);
  }
  function sendRuntimeMessage2(message) {
    return sendRuntimeMessageWithTimeout(message, 4e3).catch((error) => {
      logSelectorCheckerError("Failed to send runtime message.", error);
      return null;
    });
  }
  function installSelectorCheckerPingListener() {
    try {
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.action === "selector-check:ping") {
          sendResponse({ ok: true });
          return false;
        }
        return false;
      });
    } catch (_error) {
    }
  }

  // src/content/selector-checker/dom.ts
  function sleep(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }
  function isElementVisible(element) {
    if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
      return true;
    }
    const style = window.getComputedStyle(element);
    if (element.hidden || element.getAttribute("hidden") !== null || element.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
      return false;
    }
    return element.getClientRects().length > 0;
  }
  function isEditableElement(element) {
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
  function findElementDeep(selector, root = document, options = {}) {
    try {
      if (!selector || typeof selector !== "string") {
        return null;
      }
      const matches = [];
      collectElementsDeep(selector, root, matches, /* @__PURE__ */ new Set());
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
  async function waitForSelector(selector, timeoutMs = 4e3, intervalMs = 250, options = {}) {
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

  // src/content/selector-checker/report.ts
  function sendSelectorCheckReport(report) {
    return sendRuntimeMessage2({
      action: "selector-check:report",
      ...report
    });
  }

  // src/content/selector-checker/checks.ts
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
      if (character === "'" || character === '"') {
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
    return (Array.isArray(selectors) ? selectors : []).filter((selector) => typeof selector === "string" && selector.trim()).flatMap((selector) => splitSelectorList(selector)).filter((selector, index, list) => list.indexOf(selector) === index);
  }
  function isLikelyAuthPage(site) {
    try {
      const pathname = window.location.pathname.toLowerCase();
      if (pathname.includes("/login") || pathname.includes("/logout") || pathname.includes("/sign-in") || pathname.includes("/signin") || pathname.includes("/auth")) {
        return true;
      }
      const promptSelectors = normalizeSelectorEntries([
        site?.inputSelector,
        ...Array.isArray(site?.fallbackSelectors) ? site.fallbackSelectors : []
      ]);
      const hasPromptSurface = promptSelectors.some(
        (selector) => Boolean(findElementDeep(selector, document, { visibleOnly: true, editableOnly: true }))
      );
      if (hasPromptSurface) {
        return false;
      }
      if (!Array.isArray(site?.authSelectors)) {
        return false;
      }
      return site.authSelectors.some(
        (selector) => Boolean(findElementDeep(selector, document, { visibleOnly: true }))
      );
    } catch (error) {
      logSelectorCheckerError("Failed auth page detection in selector checker.", error);
      return false;
    }
  }
  async function runSelectorCheck() {
    try {
      const initResponse = await sendRuntimeMessage2({
        action: "selector-check:init",
        url: window.location.href
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
          pageUrl: window.location.href
        });
        return;
      }
      await sleep(Math.max(site.waitMs ?? 0, 1200));
      const checks = [
        {
          field: "inputSelector",
          selectors: normalizeSelectorEntries([
            site.inputSelector,
            ...Array.isArray(site.fallbackSelectors) ? site.fallbackSelectors : []
          ]),
          options: { visibleOnly: true, editableOnly: true }
        }
      ];
      if (site.submitMethod === "click" && site.submitSelector && site.selectorCheckMode !== "input-only") {
        checks.push({
          field: "submitSelector",
          selectors: normalizeSelectorEntries([site.submitSelector]),
          options: { visibleOnly: true }
        });
      }
      const missing = [];
      for (const check of checks) {
        let found = null;
        for (const selector of check.selectors) {
          found = await waitForSelector(selector, 5e3, 250, check.options);
          if (found) {
            break;
          }
        }
        if (!found) {
          missing.push({
            field: check.field,
            selector: check.selectors[0] ?? ""
          });
        }
      }
      await sendSelectorCheckReport({
        status: missing.length > 0 ? "selector_missing" : "ok",
        siteId: site.id,
        siteName: site.name,
        pageUrl: window.location.href,
        missing
      });
    } catch (error) {
      logSelectorCheckerError("Selector check failed.", error);
    }
  }

  // src/content/selector-checker/helper.ts
  (() => {
    if (globalThis.__aiPromptBroadcasterSelectorCheckerLoaded) {
      return;
    }
    globalThis.__aiPromptBroadcasterSelectorCheckerLoaded = true;
    installSelectorCheckerPingListener();
    if (document.readyState === "complete") {
      void runSelectorCheck();
    } else {
      window.addEventListener(
        "load",
        () => {
          void runSelectorCheck();
        },
        { once: true }
      );
    }
  })();
})();
