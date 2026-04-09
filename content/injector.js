"use strict";
var AIPromptBroadcasterInjectorBundle = (() => {
  // src/content/injector/dom.ts
  function log(context, detail = "") {
    console.info(`[AI Prompt Broadcaster] ${context}`, detail);
  }
  function logError(context, error) {
    console.error(`[AI Prompt Broadcaster] ${context}`, error);
  }
  function sleep(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, Number.isFinite(ms) ? ms : 0);
    });
  }
  function pushUniqueMatch(matches, seen, element) {
    if (!seen.has(element)) {
      seen.add(element);
      matches.push(element);
    }
  }
  function collectElementsDeep(selector, root, matches, seen) {
    if (typeof root.querySelectorAll === "function") {
      for (const element of Array.from(root.querySelectorAll(selector))) {
        pushUniqueMatch(matches, seen, element);
      }
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let current = walker.currentNode;
    while (current) {
      if (current.shadowRoot) {
        collectElementsDeep(
          selector,
          current.shadowRoot,
          matches,
          seen
        );
      }
      current = walker.nextNode();
    }
  }
  function isElementVisible(element) {
    if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
      return true;
    }
    const target = element;
    const style = window.getComputedStyle(target);
    if (target.hidden || target.getAttribute("hidden") !== null || target.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
      return false;
    }
    return target.getClientRects().length > 0;
  }
  function isElementEnabled(element) {
    if (element.getAttribute("aria-disabled") === "true") {
      return false;
    }
    if ("disabled" in element) {
      return !Boolean(element.disabled);
    }
    return true;
  }
  function isEditableElement(element) {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      return !element.readOnly;
    }
    return element instanceof HTMLElement ? element.isContentEditable : false;
  }
  function matchesOptions(element, options) {
    if (options.visibleOnly && !isElementVisible(element)) {
      return false;
    }
    if (options.enabledOnly && !isElementEnabled(element)) {
      return false;
    }
    if (options.editableOnly && !isEditableElement(element)) {
      return false;
    }
    return true;
  }
  function findElementsDeep(selector, root = document, options = {}) {
    try {
      if (!selector || typeof selector !== "string") {
        return [];
      }
      const matches = [];
      collectElementsDeep(selector, root, matches, /* @__PURE__ */ new Set());
      return matches.filter((element) => matchesOptions(element, options));
    } catch (error) {
      logError(`Deep selector lookup failed for ${selector}`, error);
      return [];
    }
  }
  function findElementDeep(selector, root = document, options = {}) {
    return findElementsDeep(selector, root, options)[0] ?? null;
  }
  function dispatchSimpleEvent(element, type) {
    element.dispatchEvent(
      new Event(type, {
        bubbles: true,
        cancelable: true,
        composed: true
      })
    );
  }
  function dispatchInputEvents(element, value, inputType = "insertText") {
    try {
      element.dispatchEvent(
        new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          composed: true,
          data: value,
          inputType
        })
      );
    } catch (error) {
      logError("beforeinput dispatch failed", error);
    }
    try {
      element.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          composed: true,
          data: value,
          inputType
        })
      );
    } catch (error) {
      logError("input dispatch failed", error);
      dispatchSimpleEvent(element, "input");
    }
    dispatchSimpleEvent(element, "change");
  }
  function getNativeValueSetter(element) {
    if (element instanceof HTMLTextAreaElement) {
      return Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set ?? null;
    }
    if (element instanceof HTMLInputElement) {
      return Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set ?? null;
    }
    return null;
  }
  function getElementValueSnapshot(element) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return element.value ?? "";
    }
    if (element.isContentEditable) {
      return element.innerText ?? element.textContent ?? "";
    }
    return "";
  }
  function normalizeComparableText(value) {
    return String(value ?? "").replace(/\u00A0/g, " ").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\r\n?/g, "\n").trim();
  }
  function elementValueMatchesPrompt(element, prompt) {
    return normalizeComparableText(getElementValueSnapshot(element)) === normalizeComparableText(prompt);
  }
  function buildLexicalParagraphNode(text) {
    return {
      children: text ? [
        {
          detail: 0,
          format: 0,
          mode: "normal",
          style: "",
          text,
          type: "text",
          version: 1
        }
      ] : [],
      direction: null,
      format: "",
      indent: 0,
      type: "paragraph",
      version: 1,
      textFormat: 0,
      textStyle: ""
    };
  }
  function isLexicalEditorElement(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    const lexicalElement = element;
    return element.dataset.lexicalEditor === "true" || typeof lexicalElement.__lexicalEditor?.parseEditorState === "function";
  }
  function setLexicalEditorText(element, prompt) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    const lexicalElement = element;
    const editor = lexicalElement.__lexicalEditor;
    if (!editor || typeof editor.parseEditorState !== "function" || typeof editor.setEditorState !== "function") {
      return false;
    }
    try {
      const paragraphs = String(prompt ?? "").split(/\n/g).map((line) => buildLexicalParagraphNode(line));
      const editorStateJson = {
        root: {
          children: paragraphs.length > 0 ? paragraphs : [buildLexicalParagraphNode("")],
          direction: null,
          format: "",
          indent: 0,
          type: "root",
          version: 1
        }
      };
      const nextState = editor.parseEditorState(JSON.stringify(editorStateJson));
      editor.setEditorState(nextState);
      editor.focus();
      placeCaretAtEnd(element);
      return elementValueMatchesPrompt(element, prompt);
    } catch (error) {
      logError("Lexical editor update failed", error);
      return false;
    }
  }
  function selectAllEditableContents(element) {
    element.focus();
    const selection = window.getSelection();
    if (!selection) {
      document.execCommand("selectAll", false);
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  function placeCaretAtEnd(element) {
    const selection = window.getSelection();
    if (!selection) {
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  function setTextInputSelectionToEnd(element) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const nextPosition = element.value.length;
      try {
        element.setSelectionRange(nextPosition, nextPosition);
      } catch (_error) {
      }
    }
  }
  function syncReactValueTracker(element, previousValue) {
    const tracker = element._valueTracker;
    if (tracker && typeof tracker.setValue === "function") {
      tracker.setValue(previousValue);
    }
  }
  function replaceContentEditableText(element, prompt) {
    if (!element.isContentEditable) {
      return false;
    }
    try {
      element.focus();
      selectAllEditableContents(element);
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const fragment = document.createDocumentFragment();
        const lines = String(prompt ?? "").split(/\n/g);
        lines.forEach((line, index) => {
          if (index > 0) {
            fragment.appendChild(document.createElement("br"));
          }
          fragment.appendChild(document.createTextNode(line));
        });
        range.insertNode(fragment);
        placeCaretAtEnd(element);
      } else {
        element.textContent = prompt;
      }
      return true;
    } catch (error) {
      logError("Direct contenteditable replacement failed", error);
      return false;
    }
  }
  function clearContentEditableText(element) {
    return replaceContentEditableText(element, "");
  }

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

  // src/content/injector/fallback.ts
  async function sendRuntimeMessage2(message) {
    try {
      return await sendRuntimeMessageWithTimeout(message, 4e3);
    } catch (error) {
      const action = typeof message === "object" && message && "action" in message ? String(message.action) : "unknown";
      logError(`Runtime message failed: ${action}`, error);
      return null;
    }
  }
  async function copyPromptToClipboard(prompt) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(prompt);
        return true;
      }
    } catch (error) {
      logError("navigator.clipboard.writeText failed", error);
    }
    try {
      const helper = document.createElement("textarea");
      helper.value = prompt;
      helper.setAttribute("readonly", "true");
      Object.assign(helper.style, {
        position: "fixed",
        top: "-9999px",
        left: "-9999px",
        opacity: "0"
      });
      document.body.appendChild(helper);
      helper.focus();
      helper.select();
      const copied = document.execCommand("copy");
      helper.remove();
      return copied;
    } catch (error) {
      logError("execCommand copy fallback failed", error);
      return false;
    }
  }

  // src/content/injector/selectors.ts
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
  function normalizeSelectors(config) {
    return [
      config?.inputSelector,
      ...Array.isArray(config?.fallbackSelectors) ? config.fallbackSelectors : []
    ].filter((selector) => typeof selector === "string" && Boolean(selector.trim())).flatMap((selector) => splitSelectorList(selector)).filter((selector, index, list) => list.indexOf(selector) === index);
  }
  function isLikelyAuthPage(config) {
    try {
      const pathname = window.location.pathname.toLowerCase();
      if (pathname.includes("/login") || pathname.includes("/logout") || pathname.includes("/sign-in") || pathname.includes("/signin") || pathname.includes("/auth")) {
        return true;
      }
      const promptSelectors = normalizeSelectors(config);
      const hasPromptSurface = promptSelectors.some(
        (selector) => Boolean(findElementDeep(selector, document, { visibleOnly: true, editableOnly: true }))
      );
      if (hasPromptSurface) {
        return false;
      }
      return Array.isArray(config?.authSelectors) ? config.authSelectors.some(
        (selector) => Boolean(findElementDeep(selector, document, { visibleOnly: true }))
      ) : false;
    } catch (error) {
      logError("Auth page detection failed", error);
      return false;
    }
  }
  function createMatcher(selectors) {
    for (const selector of selectors) {
      const element = findElementDeep(selector, document, {
        visibleOnly: true,
        editableOnly: true
      });
      if (element) {
        return { element, selector };
      }
    }
    return null;
  }
  async function waitForElement(selectors, timeoutMs = 8e3) {
    const normalizedSelectors = selectors.filter(Boolean);
    const startTime = performance.now();
    const initialMatch = createMatcher(normalizedSelectors);
    if (initialMatch) {
      return {
        ...initialMatch,
        elapsedMs: Math.round(performance.now() - startTime)
      };
    }
    return new Promise((resolve) => {
      let settled = false;
      const finish = (match) => {
        if (settled) {
          return;
        }
        settled = true;
        observer.disconnect();
        window.clearTimeout(timeoutId);
        window.clearInterval(intervalId);
        resolve(
          match ? {
            ...match,
            elapsedMs: Math.round(performance.now() - startTime)
          } : null
        );
      };
      const tryMatch = () => {
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
        attributeFilter: ["class", "id", "style", "disabled", "aria-disabled"]
      });
      const intervalId = window.setInterval(tryMatch, 150);
      const timeoutId = window.setTimeout(() => finish(null), Math.max(timeoutMs, 0));
    });
  }

  // src/content/injector/strategies.ts
  function strategyNativeSetter(element, prompt) {
    try {
      const setter = getNativeValueSetter(element);
      const previousValue = "value" in element ? String(element.value ?? "") : "";
      element.focus();
      if (typeof setter === "function") {
        setter.call(element, prompt);
      } else if ("value" in element) {
        element.value = prompt;
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
  function strategyExecCommand(element, prompt) {
    try {
      element.focus();
      selectAllEditableContents(element);
      const inserted = document.execCommand("insertText", false, prompt);
      dispatchInputEvents(element, prompt);
      return Boolean(inserted) || elementValueMatchesPrompt(element, prompt);
    } catch (error) {
      logError("execCommand strategy failed", error);
      return false;
    }
  }
  function strategyLexicalEditorState(element, prompt) {
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
  function strategyDirectContenteditable(element, prompt) {
    try {
      if (!element.isContentEditable) {
        return false;
      }
      const replaced = replaceContentEditableText(element, prompt);
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
  function strategyPasteEvent(element, prompt) {
    try {
      element.focus();
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", prompt);
      const event = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer
      });
      element.dispatchEvent(event);
      dispatchInputEvents(element, prompt, "insertFromPaste");
      return elementValueMatchesPrompt(element, prompt);
    } catch (error) {
      logError("Paste event strategy failed", error);
      return false;
    }
  }

  // src/content/injector/submit.ts
  var SUBMIT_BUTTON_WAIT_TIMEOUT_MS = 5e3;
  var SUBMIT_BUTTON_POLL_INTERVAL_MS = 100;
  function getElementCenter(element) {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }
  function getDistanceScore(left, right) {
    const leftCenter = getElementCenter(left);
    const rightCenter = getElementCenter(right);
    const deltaX = leftCenter.x - rightCenter.x;
    const deltaY = leftCenter.y - rightCenter.y;
    return deltaX * deltaX + deltaY * deltaY;
  }
  function pickSubmitButtonCandidate(candidates, referenceElement) {
    if (candidates.length === 0) {
      return null;
    }
    if (!referenceElement || candidates.length === 1) {
      return candidates[0] ?? null;
    }
    return [...candidates].sort((left, right) => {
      const leftScore = getDistanceScore(left, referenceElement);
      const rightScore = getDistanceScore(right, referenceElement);
      return leftScore - rightScore;
    })[0] ?? null;
  }
  async function submitByClick(selector, referenceElement, timeoutMs = SUBMIT_BUTTON_WAIT_TIMEOUT_MS) {
    try {
      const deadline = performance.now() + Math.max(Number(timeoutMs) || 0, SUBMIT_BUTTON_POLL_INTERVAL_MS);
      while (true) {
        const candidates = findElementsDeep(selector, document, {
          visibleOnly: true,
          enabledOnly: true
        });
        const button = pickSubmitButtonCandidate(candidates, referenceElement);
        if (button) {
          button.click();
          return true;
        }
        if (performance.now() >= deadline) {
          return false;
        }
        await sleep(SUBMIT_BUTTON_POLL_INTERVAL_MS);
      }
    } catch (error) {
      logError("Click submit failed", error);
      return false;
    }
  }
  function submitByEnter(element, shiftKey = false) {
    try {
      element.focus();
      const eventInit = {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
        composed: true,
        shiftKey: Boolean(shiftKey)
      };
      element.dispatchEvent(new KeyboardEvent("keydown", eventInit));
      element.dispatchEvent(new KeyboardEvent("keypress", eventInit));
      element.dispatchEvent(new KeyboardEvent("keyup", eventInit));
      return true;
    } catch (error) {
      logError("Keyboard submit failed", error);
      return false;
    }
  }
  async function submitPrompt(element, config) {
    const retryCount = Math.max(0, Math.round(Number(config?.submitRetryCount) || 0));
    const submitTimeoutMs = Number(config?.submitTimeoutMs);
    const timeoutMs = Number.isFinite(submitTimeoutMs) ? submitTimeoutMs : SUBMIT_BUTTON_WAIT_TIMEOUT_MS;
    for (let attemptIndex = 0; attemptIndex <= retryCount; attemptIndex += 1) {
      let submitted = false;
      const method = config?.submitMethod;
      if (method === "click") {
        submitted = config?.submitSelector ? await submitByClick(config.submitSelector, element, timeoutMs) : submitByEnter(element, false);
      } else if (method === "shift+enter") {
        submitted = submitByEnter(element, true);
      } else {
        submitted = submitByEnter(element, false);
      }
      if (submitted) {
        return true;
      }
      if (attemptIndex < retryCount) {
        await sleep(250);
      }
    }
    return false;
  }

  // src/content/injector/main.ts
  var RECENT_INJECTION_DEDUPE_MS = 1500;
  function buildInjectionKey(prompt, config) {
    return [
      window.location.href,
      config?.id ?? "",
      prompt
    ].join("\n");
  }
  function orderStrategies(strategies, preferredNames) {
    const requestedNames = Array.isArray(preferredNames) ? preferredNames.map((name) => typeof name === "string" ? name.trim() : "").filter(Boolean) : [];
    if (requestedNames.length === 0) {
      return strategies;
    }
    const byName = new Map(strategies.map((strategy) => [strategy.name, strategy]));
    const ordered = [];
    requestedNames.forEach((name) => {
      const strategy = byName.get(name);
      if (strategy && !ordered.includes(strategy)) {
        ordered.push(strategy);
      }
    });
    strategies.forEach((strategy) => {
      if (!ordered.includes(strategy)) {
        ordered.push(strategy);
      }
    });
    return ordered;
  }
  async function performInjectPrompt(prompt, config) {
    const attempts = [];
    try {
      const serviceName = config?.name ?? "AI service";
      if (isLikelyAuthPage(config)) {
        return { status: "auth_required" };
      }
      if ((config?.waitMs ?? 0) > 0) {
        await sleep(config.waitMs);
      }
      const selectorCandidates = normalizeSelectors(config);
      const match = await waitForElement(selectorCandidates, Math.max((config?.waitMs ?? 0) + 6e3, 8e3));
      if (!match?.element) {
        await sendRuntimeMessage2({
          action: "selectorFailed",
          serviceId: config?.id,
          selector: selectorCandidates[0] ?? ""
        });
        const copied = config?.fallback !== false ? await copyPromptToClipboard(prompt) : false;
        await sendRuntimeMessage2({
          action: "injectFallback",
          serviceId: config?.id,
          copied
        });
        return { status: "selector_timeout", copied, attempts };
      }
      const { element, selector, elapsedMs } = match;
      const resolvedInputType = element instanceof HTMLTextAreaElement ? "textarea" : element instanceof HTMLInputElement ? "input" : element.isContentEditable ? "contenteditable" : config?.inputType === "input" ? "input" : config?.inputType === "contenteditable" ? "contenteditable" : "textarea";
      const lexicalEditor = resolvedInputType === "contenteditable" && isLexicalEditorElement(element);
      const defaultStrategies = resolvedInputType === "contenteditable" ? lexicalEditor ? [
        { name: "lexicalEditorState", run: () => strategyLexicalEditorState(element, prompt) },
        { name: "execCommand", run: () => strategyExecCommand(element, prompt) }
      ] : [
        { name: "execCommand", run: () => strategyExecCommand(element, prompt) },
        { name: "directContenteditable", run: () => strategyDirectContenteditable(element, prompt) },
        { name: "paste", run: () => strategyPasteEvent(element, prompt) }
      ] : [
        { name: "nativeSetter", run: () => strategyNativeSetter(element, prompt) },
        { name: "paste", run: () => strategyPasteEvent(element, prompt) }
      ];
      const strategies = orderStrategies(defaultStrategies, config?.strategyOrder);
      let usedStrategy = "";
      let injected = false;
      for (const [index, strategy] of strategies.entries()) {
        if (resolvedInputType === "contenteditable" && index > 0 && !lexicalEditor) {
          clearContentEditableText(element);
        }
        const success = strategy.run();
        attempts.push({
          name: strategy.name,
          success
        });
        log(`${serviceName} strategy ${strategy.name} ${success ? "succeeded" : "failed"}`);
        if (success) {
          usedStrategy = strategy.name;
          injected = true;
          break;
        }
      }
      if (!injected) {
        const copied = config?.fallback !== false ? await copyPromptToClipboard(prompt) : false;
        await sendRuntimeMessage2({
          action: "injectFallback",
          serviceId: config?.id,
          copied
        });
        return { status: "strategy_exhausted", copied, attempts };
      }
      log(`✅ ${serviceName} 주입 성공 (셀렉터: ${selector}, 대기: ${elapsedMs}ms, 전략: ${usedStrategy})`);
      await sendRuntimeMessage2({
        action: "injectSuccess",
        serviceId: config?.id,
        selector,
        strategy: usedStrategy,
        elapsedMs
      });
      if (!await submitPrompt(element, config)) {
        return { status: "submit_failed", selector, strategy: usedStrategy, inputType: resolvedInputType, elapsedMs, attempts };
      }
      return {
        status: "submitted",
        selector,
        strategy: usedStrategy,
        inputType: resolvedInputType,
        elapsedMs,
        attempts
      };
    } catch (error) {
      logError("injectPrompt failed", error);
      const copied = config?.fallback !== false ? await copyPromptToClipboard(prompt) : false;
      await sendRuntimeMessage2({
        action: "injectFallback",
        serviceId: config?.id,
        copied
      });
      return {
        status: "unexpected_error",
        copied,
        error: error instanceof Error ? error.message : String(error),
        attempts
      };
    }
  }
  async function submitOnlyPrompt(config) {
    try {
      if (isLikelyAuthPage(config)) {
        return { status: "auth_required" };
      }
      if ((config?.waitMs ?? 0) > 0) {
        await sleep(config.waitMs);
      }
      const selectorCandidates = normalizeSelectors(config);
      const match = await waitForElement(selectorCandidates, Math.max((config?.waitMs ?? 0) + 6e3, 8e3));
      if (!match?.element) {
        return { status: "selector_timeout" };
      }
      const { element, selector, elapsedMs } = match;
      if (!await submitPrompt(element, config)) {
        return { status: "submit_failed", selector, elapsedMs };
      }
      return {
        status: "submitted",
        selector,
        strategy: "submitOnly",
        elapsedMs,
        attempts: []
      };
    } catch (error) {
      logError("submitOnlyPrompt failed", error);
      return {
        status: "unexpected_error",
        error: error instanceof Error ? error.message : String(error),
        attempts: []
      };
    }
  }
  async function injectPrompt(prompt, config) {
    const key = buildInjectionKey(prompt, config);
    const activeInjection = window.__aiPromptBroadcasterActiveInjection;
    if (activeInjection?.key === key) {
      return activeInjection.promise;
    }
    const recentInjection = window.__aiPromptBroadcasterRecentInjection;
    if (recentInjection?.key === key && recentInjection.result?.status === "submitted" && Date.now() - recentInjection.finishedAt <= RECENT_INJECTION_DEDUPE_MS) {
      return recentInjection.result;
    }
    const promise = performInjectPrompt(prompt, config).then((result) => {
      if (result.status === "submitted") {
        window.__aiPromptBroadcasterRecentInjection = {
          key,
          finishedAt: Date.now(),
          result
        };
      }
      return result;
    }).finally(() => {
      if (window.__aiPromptBroadcasterActiveInjection?.key === key) {
        delete window.__aiPromptBroadcasterActiveInjection;
      }
    });
    window.__aiPromptBroadcasterActiveInjection = { key, promise };
    return promise;
  }
  if (typeof window.__aiPromptBroadcasterInjectPrompt !== "function") {
    window.__aiPromptBroadcasterInjectPrompt = injectPrompt;
  }
  if (typeof window.__aiPromptBroadcasterSubmitPrompt !== "function") {
    window.__aiPromptBroadcasterSubmitPrompt = submitOnlyPrompt;
  }
})();
