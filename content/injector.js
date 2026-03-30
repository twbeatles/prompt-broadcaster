(() => {
  if (typeof globalThis.__aiPromptBroadcasterInjectPrompt === "function") {
    return;
  }

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

  function normalizeSelectors(config) {
    return [
      config?.inputSelector,
      ...(Array.isArray(config?.fallbackSelectors) ? config.fallbackSelectors : []),
    ]
      .filter((selector) => typeof selector === "string" && selector.trim())
      .map((selector) => selector.trim())
      .filter((selector, index, list) => list.indexOf(selector) === index);
  }

  function findElementDeep(selector, root = document) {
    try {
      if (!selector || typeof selector !== "string") {
        return null;
      }

      if (typeof root.querySelector === "function") {
        const direct = root.querySelector(selector);
        if (direct) {
          return direct;
        }
      }

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let current = walker.currentNode;

      while (current) {
        if (current.shadowRoot) {
          const shadowMatch = findElementDeep(selector, current.shadowRoot);
          if (shadowMatch) {
            return shadowMatch;
          }
        }

        current = walker.nextNode();
      }

      return null;
    } catch (error) {
      logError(`Deep selector lookup failed for ${selector}`, error);
      return null;
    }
  }

  function dispatchSimpleEvent(element, type) {
    element.dispatchEvent(
      new Event(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
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
          inputType,
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
          inputType,
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

    if (element?.isContentEditable) {
      return element.textContent ?? "";
    }

    return "";
  }

  async function sendRuntimeMessage(message) {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      logError(`Runtime message failed: ${message?.action ?? "unknown"}`, error);
      return null;
    }
  }

  function isLikelyAuthPage(config) {
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

  function createMatcher(selectors) {
    for (const selector of selectors) {
      const element = findElementDeep(selector);
      if (element) {
        return { element, selector };
      }
    }

    return null;
  }

  async function waitForElement(selectors, timeoutMs = 8000) {
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

      const finish = (match) => {
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
            : null
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
      });

      const intervalId = window.setInterval(tryMatch, 150);
      const timeoutId = window.setTimeout(() => finish(null), Math.max(timeoutMs, 0));
    });
  }

  function selectAllEditableContents(element) {
    element.focus();
    document.execCommand("selectAll", false);
  }

  function strategyNativeSetter(element, prompt) {
    try {
      const setter = getNativeValueSetter(element);
      element.focus();

      if (typeof setter === "function") {
        setter.call(element, prompt);
      } else if ("value" in element) {
        element.value = prompt;
      } else {
        return false;
      }

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

  function strategyPasteEvent(element, prompt) {
    try {
      element.focus();
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", prompt);

      const event = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer,
      });

      element.dispatchEvent(event);
      dispatchInputEvents(element, prompt, "insertFromPaste");
      return getElementValueSnapshot(element).trim() === prompt.trim();
    } catch (error) {
      logError("Paste event strategy failed", error);
      return false;
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
        opacity: "0",
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

  function submitByClick(selector) {
    try {
      const button = findElementDeep(selector);
      if (!button) {
        return false;
      }

      button.click();
      return true;
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
        shiftKey: Boolean(shiftKey),
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

  function submitPrompt(element, config) {
    if (config?.submitMethod === "click") {
      return config?.submitSelector
        ? submitByClick(config.submitSelector)
        : submitByEnter(element, false);
    }

    if (config?.submitMethod === "shift+enter") {
      return submitByEnter(element, true);
    }

    return submitByEnter(element, false);
  }

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
      const match = await waitForElement(selectorCandidates, Math.max((config?.waitMs ?? 0) + 6000, 8000));

      if (!match?.element) {
        await sendRuntimeMessage({
          action: "selectorFailed",
          serviceId: config?.id,
          selector: selectorCandidates[0] ?? "",
        });

        const copied = config?.fallback !== false
          ? await copyPromptToClipboard(prompt)
          : false;

        await sendRuntimeMessage({
          action: "injectFallback",
          serviceId: config?.id,
          copied,
        });

        return { status: "selector_failed", copied };
      }

      const { element, selector, elapsedMs } = match;
      const strategies = config?.inputType === "contenteditable"
        ? [
            { name: "execCommand", run: () => strategyExecCommand(element, prompt) },
            { name: "paste", run: () => strategyPasteEvent(element, prompt) },
          ]
        : [
            { name: "nativeSetter", run: () => strategyNativeSetter(element, prompt) },
            { name: "paste", run: () => strategyPasteEvent(element, prompt) },
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
        const copied = config?.fallback !== false
          ? await copyPromptToClipboard(prompt)
          : false;

        await sendRuntimeMessage({
          action: "injectFallback",
          serviceId: config?.id,
          copied,
        });

        return { status: "fallback_required", copied };
      }

      log(`✅ ${serviceName} 주입 성공 (셀렉터: ${selector}, 대기: ${elapsedMs}ms, 전략: ${usedStrategy})`);
      await sendRuntimeMessage({
        action: "injectSuccess",
        serviceId: config?.id,
        selector,
        strategy: usedStrategy,
        elapsedMs,
      });

      await sleep(100);

      if (!submitPrompt(element, config)) {
        return { status: "submit_failed" };
      }

      return {
        status: "submitted",
        selector,
        strategy: usedStrategy,
        elapsedMs,
      };
    } catch (error) {
      logError("injectPrompt failed", error);
      const copied = config?.fallback !== false
        ? await copyPromptToClipboard(prompt)
        : false;
      await sendRuntimeMessage({
        action: "injectFallback",
        serviceId: config?.id,
        copied,
      });
      return {
        status: "failed",
        copied,
        error: error?.message ?? String(error),
      };
    }
  }

  globalThis.__aiPromptBroadcasterInjectPrompt = injectPrompt;
})();
