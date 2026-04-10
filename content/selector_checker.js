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

  // src/config/sites/builtins.ts
  var AI_SITES = Object.freeze([
    {
      id: "chatgpt",
      name: "ChatGPT",
      url: "https://chatgpt.com/",
      hostname: "chatgpt.com",
      inputSelector: "#prompt-textarea, div#prompt-textarea[contenteditable='true'], textarea[aria-label*='chatgpt' i], textarea[aria-label*='채팅' i]",
      fallbackSelectors: [
        "#prompt-textarea",
        "div#prompt-textarea[contenteditable='true']",
        "textarea[aria-label*='chatgpt' i]",
        "textarea[aria-label*='채팅' i]",
        "textarea.wcDTda_fallbackTextarea",
        "div[contenteditable='true'][data-id='root']",
        "main div[contenteditable='true']"
      ],
      inputType: "contenteditable",
      submitSelector: "button[data-testid='send-button'], button[aria-label*='send' i], button[aria-label*='보내기' i]",
      submitMethod: "click",
      selectorCheckMode: "input-and-conditional-submit",
      waitMs: 2e3,
      fallback: true,
      lastVerified: "2026-04",
      verifiedAt: "2026-04-10",
      verifiedRoute: "/",
      verifiedAuthState: "logged-out",
      verifiedLocale: "ko",
      verifiedVersion: "chatgpt-web-apr-2026",
      authSelectors: [
        "form[action*='/auth']",
        "input[name='email']",
        "input[name='username']"
      ]
    },
    {
      id: "gemini",
      name: "Gemini",
      url: "https://gemini.google.com/app",
      hostname: "gemini.google.com",
      inputSelector: "div[contenteditable='true'][role='textbox'], div.ql-editor.textarea.new-input-ui[contenteditable='true'], div.ql-editor[contenteditable='true'][role='textbox']",
      fallbackSelectors: [
        "div[contenteditable='true'][role='textbox']",
        "div.ql-editor.textarea.new-input-ui[contenteditable='true']",
        "div.ql-editor[contenteditable='true'][role='textbox']",
        "textarea, div[contenteditable='true']"
      ],
      inputType: "contenteditable",
      submitSelector: "button.send-button, button[aria-label*='send' i], button[aria-label*='보내기' i]",
      submitMethod: "click",
      selectorCheckMode: "input-and-submit",
      waitMs: 2500,
      fallback: true,
      lastVerified: "2026-04",
      verifiedAt: "2026-04-10",
      verifiedRoute: "/app",
      verifiedAuthState: "logged-out",
      verifiedLocale: "en-US",
      verifiedVersion: "gemini-app-apr-2026",
      authSelectors: [
        "input[type='email']",
        "input[type='password']"
      ]
    },
    {
      id: "claude",
      name: "Claude",
      url: "https://claude.ai/new",
      hostname: "claude.ai",
      inputSelector: "div[contenteditable='true'][role='textbox'], div[contenteditable='true'][aria-label*='Claude' i], div[contenteditable='true'][aria-label*='prompt' i]",
      fallbackSelectors: [
        "div[contenteditable='true'][role='textbox']",
        "div[contenteditable='true'][aria-label*='Claude' i]",
        "div[contenteditable='true'][aria-label*='prompt' i]",
        "div[contenteditable='true']",
        "textarea"
      ],
      inputType: "contenteditable",
      submitSelector: "button[aria-label='Send message'], button[aria-label*='send' i], button[aria-label*='submit' i], button[aria-label*='보내' i], button[aria-label*='전송' i]",
      submitMethod: "click",
      selectorCheckMode: "input-and-submit",
      waitMs: 1500,
      fallback: true,
      lastVerified: "2026-04",
      verifiedAt: "2026-04-10",
      verifiedRoute: "/new",
      verifiedAuthState: "logged-out",
      verifiedLocale: "en-US",
      verifiedVersion: "claude-web-apr-2026",
      authSelectors: [
        "input#email",
        "input[type='email']",
        "input[type='password']",
        "form[action*='login']"
      ]
    },
    {
      id: "grok",
      name: "Grok",
      url: "https://grok.com/",
      hostname: "grok.com",
      inputSelector: "textarea[aria-label*='grok' i], textarea[placeholder*='help' i], textarea",
      fallbackSelectors: [
        "textarea[aria-label*='grok' i]",
        "textarea[placeholder*='help' i]",
        "textarea",
        "div.tiptap.ProseMirror[contenteditable='true']",
        "div.ProseMirror[contenteditable='true'][translate='no']",
        "div.ProseMirror[contenteditable='true']"
      ],
      inputType: "textarea",
      submitSelector: "button[aria-label*='submit' i], button[aria-label*='제출' i]",
      submitMethod: "click",
      selectorCheckMode: "input-and-conditional-submit",
      waitMs: 2e3,
      fallback: true,
      lastVerified: "2026-04",
      verifiedAt: "2026-04-10",
      verifiedRoute: "/",
      verifiedAuthState: "logged-out",
      verifiedLocale: "ko",
      verifiedVersion: "grok-web-apr-2026",
      authSelectors: [
        "input[autocomplete='username']",
        "input[type='password']",
        "a[href*='/sign-in']",
        "a[href*='/login']"
      ]
    },
    {
      id: "perplexity",
      name: "Perplexity",
      url: "https://www.perplexity.ai/",
      hostname: "www.perplexity.ai",
      hostnameAliases: ["perplexity.ai"],
      inputSelector: "#ask-input[data-lexical-editor='true'][role='textbox']",
      fallbackSelectors: [
        "div#ask-input[data-lexical-editor='true'][role='textbox']",
        "div#ask-input[contenteditable='true'][role='textbox']",
        "#ask-input[contenteditable='true']",
        "div[contenteditable='true'][role='textbox']",
        "textarea[placeholder*='Ask'][data-testid='search-input']",
        "textarea[placeholder*='Ask']",
        "textarea[placeholder*='질문']",
        "textarea"
      ],
      inputType: "contenteditable",
      submitSelector: "button[aria-label*='Submit'][type='submit'], button[type='submit'][aria-label*='검색'], button[aria-label*='submit' i], button[aria-label*='제출' i]",
      submitMethod: "click",
      selectorCheckMode: "input-and-conditional-submit",
      waitMs: 2e3,
      fallback: true,
      lastVerified: "2026-04",
      verifiedAt: "2026-04-10",
      verifiedRoute: "/",
      verifiedAuthState: "soft-gated",
      verifiedLocale: "en-US",
      verifiedVersion: "perplexity-web-apr-2026",
      authSelectors: [
        "input[type='email']",
        "input[type='password']",
        "button[data-testid='login-button']"
      ]
    }
  ]);

  // src/shared/sites/constants.ts
  var SITE_STORAGE_KEYS = Object.freeze({
    customSites: "customSites",
    builtInSiteStates: "builtInSiteStates",
    builtInSiteOverrides: "builtInSiteOverrides"
  });
  var BUILT_IN_SITE_IDS = new Set(
    AI_SITES.map((site) => String(site?.id ?? "")).filter(Boolean)
  );
  var BUILT_IN_SITE_STYLE_MAP = Object.freeze({
    chatgpt: { color: "#10a37f", icon: "GPT" },
    gemini: { color: "#4285f4", icon: "Gem" },
    claude: { color: "#d97706", icon: "Cl" },
    grok: { color: "#000000", icon: "Gk" },
    perplexity: { color: "#20808d", icon: "Px" }
  });

  // src/shared/sites/selector-utils.ts
  var AUTH_PATH_SEGMENTS = Object.freeze([
    "/login",
    "/logout",
    "/sign-in",
    "/signin",
    "/auth"
  ]);
  var SETTINGS_PATH_SEGMENTS = Object.freeze([
    "/settings",
    "/preferences",
    "/account",
    "/billing"
  ]);
  function normalizePathname(pathname) {
    return typeof pathname === "string" ? pathname.trim().toLowerCase() : "";
  }
  function hasPathSegment(pathname, segments) {
    const normalizedPathname = normalizePathname(pathname);
    return segments.some((segment) => normalizedPathname.includes(segment));
  }
  function hasKnownAuthPath(pathname) {
    return hasPathSegment(pathname, AUTH_PATH_SEGMENTS);
  }
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
    const rawSelectors = Array.isArray(selectors) ? selectors : [selectors];
    return rawSelectors.filter((selector) => typeof selector === "string" && Boolean(selector.trim())).flatMap((selector) => splitSelectorList(selector)).filter((selector, index, entries) => entries.indexOf(selector) === index);
  }
  function buildSubmitRequirement(options) {
    if (options?.submitMethod !== "click") {
      return "none";
    }
    if (typeof options?.submitSelector !== "string" || !options.submitSelector.trim()) {
      return "none";
    }
    if (options?.selectorCheckMode === "input-and-conditional-submit") {
      return "conditional";
    }
    if (options?.selectorCheckMode === "input-only") {
      return "none";
    }
    return "required";
  }
  function shouldRequireVisibleSubmitSurface(submitRequirement) {
    return submitRequirement === "required";
  }

  // src/content/selector-checker/checks.ts
  function isLikelyAuthPage(site) {
    try {
      if (hasKnownAuthPath(window.location.pathname)) {
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
      const submitRequirement = buildSubmitRequirement(site);
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
      if (shouldRequireVisibleSubmitSurface(submitRequirement) && site.submitSelector) {
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
