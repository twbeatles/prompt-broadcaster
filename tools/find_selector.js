(() => {
  const PROBE_TEXT = "[APB selector probe]";
  const INPUT_SELECTOR = "textarea, input, [contenteditable='true']";

  function walkDeep(root, visitor) {
    const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let currentNode = treeWalker.currentNode;

    while (currentNode) {
      visitor(currentNode);

      if (currentNode.shadowRoot) {
        walkDeep(currentNode.shadowRoot, visitor);
      }

      currentNode = treeWalker.nextNode();
    }
  }

  function queryAllDeep(selector, root = document) {
    const matches = [];

    try {
      if (typeof root.querySelectorAll === "function") {
        matches.push(...root.querySelectorAll(selector));
      }
    } catch (error) {
      console.warn("[APB] Failed querySelectorAll for selector:", selector, error);
      return [];
    }

    walkDeep(root, (node) => {
      if (!node.shadowRoot) {
        return;
      }

      try {
        matches.push(...node.shadowRoot.querySelectorAll(selector));
      } catch (error) {
        console.warn("[APB] Failed shadowRoot querySelectorAll for selector:", selector, error);
      }
    });

    return Array.from(new Set(matches));
  }

  function isElementVisible(element) {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0" &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function getInputType(element) {
    if (element.matches("[contenteditable='true']")) {
      return "contenteditable";
    }

    if (element.tagName === "TEXTAREA") {
      return "textarea";
    }

    return "input";
  }

  function cssEscape(value) {
    if (window.CSS?.escape) {
      return window.CSS.escape(value);
    }

    return String(value).replace(/["\\]/g, "\\$&");
  }

  function selectorScore(selector) {
    let score = 0;

    if (selector.includes("#")) score += 60;
    if (selector.includes("[data-testid")) score += 50;
    if (selector.includes("[aria-label")) score += 40;
    if (selector.includes("[name")) score += 35;
    if (selector.includes("[placeholder")) score += 25;
    if (selector.includes("[contenteditable")) score += 20;
    if (selector.includes(".")) score += 10;
    if (selector.includes(":nth-of-type")) score -= 15;
    score -= selector.length * 0.05;

    return Math.round(score);
  }

  function buildCandidateSelectors(element) {
    const selectors = [];
    const tag = element.tagName.toLowerCase();
    const id = element.id?.trim();
    const dataTestId = element.getAttribute("data-testid")?.trim();
    const ariaLabel = element.getAttribute("aria-label")?.trim();
    const name = element.getAttribute("name")?.trim();
    const placeholder = element.getAttribute("placeholder")?.trim();
    const role = element.getAttribute("role")?.trim();
    const contenteditable = element.getAttribute("contenteditable");
    const classes = Array.from(element.classList)
      .filter((className) => /^[A-Za-z0-9_-]+$/.test(className))
      .slice(0, 3);

    if (id) {
      selectors.push(`#${cssEscape(id)}`);
      selectors.push(`${tag}#${cssEscape(id)}`);
    }

    if (dataTestId) {
      selectors.push(`[data-testid="${cssEscape(dataTestId)}"]`);
      selectors.push(`${tag}[data-testid="${cssEscape(dataTestId)}"]`);
    }

    if (ariaLabel) {
      selectors.push(`[aria-label="${cssEscape(ariaLabel)}"]`);
      selectors.push(`${tag}[aria-label="${cssEscape(ariaLabel)}"]`);
    }

    if (name) {
      selectors.push(`${tag}[name="${cssEscape(name)}"]`);
    }

    if (placeholder) {
      selectors.push(`${tag}[placeholder="${cssEscape(placeholder)}"]`);
    }

    if (role) {
      selectors.push(`${tag}[role="${cssEscape(role)}"]`);
    }

    if (contenteditable === "true") {
      selectors.push(`${tag}[contenteditable="true"]`);
      if (role) {
        selectors.push(`${tag}[contenteditable="true"][role="${cssEscape(role)}"]`);
      }
      if (ariaLabel) {
        selectors.push(
          `${tag}[contenteditable="true"][aria-label="${cssEscape(ariaLabel)}"]`
        );
      }
    }

    if (classes.length > 0) {
      selectors.push(`${tag}.${classes.map(cssEscape).join(".")}`);
    }

    selectors.push(tag);

    return Array.from(new Set(selectors));
  }

  function chooseBestSelector(element) {
    const selectors = buildCandidateSelectors(element);
    const ranked = selectors
      .map((selector) => {
        const matches = queryAllDeep(selector);
        return {
          selector,
          matchCount: matches.length,
          unique: matches.length === 1 && matches[0] === element,
          score: selectorScore(selector),
        };
      })
      .sort((a, b) => {
        if (a.unique !== b.unique) {
          return Number(b.unique) - Number(a.unique);
        }

        return b.score - a.score;
      });

    return ranked[0] ?? null;
  }

  function getNativeValueSetter(element) {
    if (element instanceof HTMLTextAreaElement) {
      return Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      )?.set;
    }

    if (element instanceof HTMLInputElement) {
      return Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
    }

    return null;
  }

  function simulateInjection(element, inputType) {
    try {
      if (inputType === "contenteditable") {
        const previous = element.textContent;
        element.focus();
        element.replaceChildren(document.createTextNode(PROBE_TEXT));
        element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
        const ok = (element.textContent ?? "").includes(PROBE_TEXT);
        element.replaceChildren(document.createTextNode(previous ?? ""));
        element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
        return ok;
      }

      const previous = element.value;
      const setter = getNativeValueSetter(element);
      element.focus();

      if (typeof setter === "function") {
        setter.call(element, PROBE_TEXT);
      } else {
        element.value = PROBE_TEXT;
      }

      element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      const ok = element.value === PROBE_TEXT;

      if (typeof setter === "function") {
        setter.call(element, previous);
      } else {
        element.value = previous;
      }

      element.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      return ok;
    } catch (error) {
      console.warn("[APB] Injection simulation failed:", error);
      return false;
    }
  }

  function scoreCandidate(candidate) {
    let score = candidate.selectorMeta?.score ?? 0;
    if (candidate.visible) score += 20;
    if (candidate.unique) score += 20;
    if (candidate.injectionWorks) score += 25;
    if (candidate.inputType === "contenteditable") score += 10;
    return score;
  }

  function findInputCandidates() {
    const elements = queryAllDeep(INPUT_SELECTOR).filter((element) => {
      if (element.tagName === "INPUT") {
        const inputType = (element.getAttribute("type") || "text").toLowerCase();
        if (["hidden", "checkbox", "radio", "file", "submit", "button"].includes(inputType)) {
          return false;
        }
      }

      return !element.hasAttribute("disabled") && !element.hasAttribute("readonly");
    });

    return elements.map((element, index) => {
      const inputType = getInputType(element);
      const selectorMeta = chooseBestSelector(element);
      const visible = isElementVisible(element);
      const injectionWorks = simulateInjection(element, inputType);

      return {
        index,
        element,
        tag: element.tagName.toLowerCase(),
        inputType,
        visible,
        injectionWorks,
        selector: selectorMeta?.selector ?? "",
        unique: Boolean(selectorMeta?.unique),
        matchCount: selectorMeta?.matchCount ?? 0,
        score: 0,
        selectorMeta,
      };
    }).map((candidate) => ({
      ...candidate,
      score: scoreCandidate(candidate),
    })).sort((a, b) => b.score - a.score);
  }

  function findSubmitSelector() {
    const submitCandidates = queryAllDeep("button, [role='button'], input[type='submit']").map((element) => {
      const text = (element.innerText || element.value || "").trim();
      const ariaLabel = element.getAttribute("aria-label") || "";
      const haystack = `${text} ${ariaLabel}`.toLowerCase();
      const relevant =
        haystack.includes("send") ||
        haystack.includes("submit") ||
        haystack.includes("message") ||
        haystack.includes("보내기") ||
        haystack.includes("제출");

      if (!relevant) {
        return null;
      }

      const selectorMeta = chooseBestSelector(element);

      return {
        element,
        selector: selectorMeta?.selector ?? "",
        score: (selectorMeta?.score ?? 0) + (isElementVisible(element) ? 20 : 0),
      };
    }).filter(Boolean).sort((a, b) => b.score - a.score);

    return submitCandidates[0]?.selector ?? "";
  }

  const candidates = findInputCandidates();
  const recommended = candidates[0] ?? null;
  const submitSelector = findSubmitSelector();

  window.__APB_SELECTOR_CANDIDATES__ = candidates;

  console.group("[APB] Selector candidates");
  console.table(
    candidates.map((candidate) => ({
      index: candidate.index,
      selector: candidate.selector,
      inputType: candidate.inputType,
      visible: candidate.visible,
      unique: candidate.unique,
      injectionWorks: candidate.injectionWorks,
      score: candidate.score,
      tag: candidate.tag,
    }))
  );
  console.groupEnd();

  if (!recommended) {
    console.warn("[APB] No editable input candidates were found on this page.");
    return;
  }

  const configSnippet = `{
  id: "replace-me",
  name: "${document.title.replace(/"/g, '\\"')}",
  url: "${location.origin}${location.pathname}",
  inputSelector: "${recommended.selector.replace(/"/g, '\\"')}",
  inputType: "${recommended.inputType}",
  submitSelector: "${submitSelector.replace(/"/g, '\\"')}",
  submitMethod: "${submitSelector ? "click" : "enter"}",
  waitMs: 2000,
  fallback: true
}`;

  console.info("[APB] Recommended input selector:", recommended.selector);
  console.info("[APB] Recommended submit selector:", submitSelector || "(not found, try enter)");
  console.info("[APB] sites.js snippet:\n" + configSnippet);
})();
