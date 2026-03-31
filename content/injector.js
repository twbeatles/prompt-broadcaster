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

  // src/content/injector/fallback.ts
  async function sendRuntimeMessage(message) {
    try {
      return await chrome.runtime.sendMessage(message);
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
  function normalizeSelectors(config) {
    return [
      config?.inputSelector,
      ...Array.isArray(config?.fallbackSelectors) ? config.fallbackSelectors : []
    ].filter((selector) => typeof selector === "string" && Boolean(selector.trim())).map((selector) => selector.trim()).filter((selector, index, list) => list.indexOf(selector) === index);
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
        attributes: true
      });
      const intervalId = window.setInterval(tryMatch, 150);
      const timeoutId = window.setTimeout(() => finish(null), Math.max(timeoutMs, 0));
    });
  }

  // src/content/injector/strategies.ts
  function strategyNativeSetter(element, prompt) {
    try {
      const setter = getNativeValueSetter(element);
      const previousValue = getElementValueSnapshot(element);
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
      return getElementValueSnapshot(element).trim() === prompt.trim();
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
      return Boolean(inserted) || getElementValueSnapshot(element).trim() === prompt.trim();
    } catch (error) {
      logError("execCommand strategy failed", error);
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
      return getElementValueSnapshot(element).trim() === prompt.trim();
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
      return getElementValueSnapshot(element).trim() === prompt.trim();
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
  async function submitByClick(selector, referenceElement) {
    try {
      const deadline = performance.now() + SUBMIT_BUTTON_WAIT_TIMEOUT_MS;
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
    if (config?.submitMethod === "click") {
      return config?.submitSelector ? submitByClick(config.submitSelector, element) : submitByEnter(element, false);
    }
    if (config?.submitMethod === "shift+enter") {
      return submitByEnter(element, true);
    }
    return submitByEnter(element, false);
  }

  // src/content/injector/main.ts
  async function injectPrompt(prompt, config) {
    try {
      const serviceName = config?.name ?? "AI service";
      if (isLikelyAuthPage(config)) {
        return { status: "login_required" };
      }
      if ((config?.waitMs ?? 0) > 0) {
        await sleep(config.waitMs);
      }
      const selectorCandidates = normalizeSelectors(config);
      const match = await waitForElement(selectorCandidates, Math.max((config?.waitMs ?? 0) + 6e3, 8e3));
      if (!match?.element) {
        await sendRuntimeMessage({
          action: "selectorFailed",
          serviceId: config?.id,
          selector: selectorCandidates[0] ?? ""
        });
        const copied = config?.fallback !== false ? await copyPromptToClipboard(prompt) : false;
        await sendRuntimeMessage({
          action: "injectFallback",
          serviceId: config?.id,
          copied
        });
        return { status: "selector_failed", copied };
      }
      const { element, selector, elapsedMs } = match;
      const resolvedInputType = element instanceof HTMLTextAreaElement ? "textarea" : element instanceof HTMLInputElement ? "input" : element.isContentEditable ? "contenteditable" : config?.inputType === "input" ? "input" : config?.inputType === "contenteditable" ? "contenteditable" : "textarea";
      const strategies = resolvedInputType === "contenteditable" ? [
        { name: "execCommand", run: () => strategyExecCommand(element, prompt) },
        { name: "directContenteditable", run: () => strategyDirectContenteditable(element, prompt) },
        { name: "paste", run: () => strategyPasteEvent(element, prompt) }
      ] : [
        { name: "nativeSetter", run: () => strategyNativeSetter(element, prompt) },
        { name: "paste", run: () => strategyPasteEvent(element, prompt) }
      ];
      let usedStrategy = "";
      let injected = false;
      for (const strategy of strategies) {
        const success = strategy.run();
        log(`${serviceName} strategy ${strategy.name} ${success ? "succeeded" : "failed"}`);
        if (success) {
          usedStrategy = strategy.name;
          injected = true;
          break;
        }
      }
      if (!injected) {
        const copied = config?.fallback !== false ? await copyPromptToClipboard(prompt) : false;
        await sendRuntimeMessage({
          action: "injectFallback",
          serviceId: config?.id,
          copied
        });
        return { status: "fallback_required", copied };
      }
      log(`✅ ${serviceName} 주입 성공 (셀렉터: ${selector}, 대기: ${elapsedMs}ms, 전략: ${usedStrategy})`);
      await sendRuntimeMessage({
        action: "injectSuccess",
        serviceId: config?.id,
        selector,
        strategy: usedStrategy,
        elapsedMs
      });
      if (!await submitPrompt(element, config)) {
        return { status: "submit_failed" };
      }
      return {
        status: "submitted",
        selector,
        strategy: usedStrategy,
        inputType: resolvedInputType,
        elapsedMs
      };
    } catch (error) {
      logError("injectPrompt failed", error);
      const copied = config?.fallback !== false ? await copyPromptToClipboard(prompt) : false;
      await sendRuntimeMessage({
        action: "injectFallback",
        serviceId: config?.id,
        copied
      });
      return {
        status: "failed",
        copied,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  if (typeof window.__aiPromptBroadcasterInjectPrompt !== "function") {
    window.__aiPromptBroadcasterInjectPrompt = injectPrompt;
  }
})();
