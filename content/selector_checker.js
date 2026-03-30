(() => {
  function logError(context, error) {
    console.error(`[AI Prompt Broadcaster] ${context}`, error);
  }

  function sleep(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            logError("Runtime message failed.", chrome.runtime.lastError);
            resolve(null);
            return;
          }

          resolve(response ?? null);
        });
      } catch (error) {
        logError("Failed to send runtime message.", error);
        resolve(null);
      }
    });
  }

  function findElementDeep(selector, root = document) {
    try {
      if (!selector || typeof selector !== "string") {
        return null;
      }

      if (typeof root.querySelector === "function") {
        const directMatch = root.querySelector(selector);
        if (directMatch) {
          return directMatch;
        }
      }

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let currentNode = walker.currentNode;

      while (currentNode) {
        if (currentNode.shadowRoot) {
          const shadowMatch = findElementDeep(selector, currentNode.shadowRoot);
          if (shadowMatch) {
            return shadowMatch;
          }
        }

        currentNode = walker.nextNode();
      }

      return null;
    } catch (error) {
      logError(`Failed selector lookup for ${selector}.`, error);
      return null;
    }
  }

  async function waitForSelector(selector, timeoutMs = 4000, intervalMs = 250) {
    try {
      const deadline = Date.now() + timeoutMs;

      while (Date.now() <= deadline) {
        const element = findElementDeep(selector);
        if (element) {
          return element;
        }

        await sleep(intervalMs);
      }

      return null;
    } catch (error) {
      logError(`Failed while waiting for selector ${selector}.`, error);
      return null;
    }
  }

  function isLikelyAuthPage(site) {
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

      if (!Array.isArray(site?.authSelectors)) {
        return false;
      }

      return site.authSelectors.some((selector) => Boolean(findElementDeep(selector)));
    } catch (error) {
      logError("Failed auth page detection in selector checker.", error);
      return false;
    }
  }

  async function runSelectorCheck() {
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
        await sendRuntimeMessage({
          action: "selector-check:report",
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
        },
      ];

      if (site.submitMethod === "click" && site.submitSelector) {
        checks.push({
          field: "submitSelector",
          selectors: [site.submitSelector],
        });
      }

      const missing = [];

      for (const check of checks) {
        let found = null;
        for (const selector of check.selectors) {
          found = await waitForSelector(selector, 5000, 250);
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

      await sendRuntimeMessage({
        action: "selector-check:report",
        status: missing.length > 0 ? "selector_missing" : "ok",
        siteId: site.id,
        siteName: site.name,
        pageUrl: window.location.href,
        missing,
      });
    } catch (error) {
      logError("Selector check failed.", error);
    }
  }

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
