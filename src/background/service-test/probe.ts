import { buildSubmitRequirement } from "../../shared/sites";
import type {
  ServiceTestProbeResult,
  ServiceTestProbeSuccess,
} from "../app/injection/types";
import type { ServiceTestRunMessage } from "../../shared/types/messages";

export async function runServiceTestOnTab(
  tabId: number,
  draft: ServiceTestRunMessage["draft"],
): Promise<ServiceTestProbeResult> {
  const probeText = "__apb_probe__";
  const submitRequirement = buildSubmitRequirement(draft);
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async (
      siteDraft: Record<string, unknown>,
      nextProbeText: string,
      nextSubmitRequirement: string,
    ) => {
      function isElementVisible(element: Element): boolean {
        if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
          return true;
        }

        const style = window.getComputedStyle(element);
        if (
          (element instanceof HTMLElement && element.hidden) ||
          element.getAttribute("hidden") !== null ||
          element.getAttribute("aria-hidden") === "true" ||
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.visibility === "collapse"
        ) {
          return false;
        }

        return element.getClientRects().length > 0;
      }

      function findElementsDeep(
        selector: string,
        root: Document | ShadowRoot = document,
        seen: Set<Element> = new Set<Element>(),
        matches: Element[] = [],
      ): Element[] {
        if (!selector || typeof selector !== "string") {
          return matches;
        }

        if (typeof root.querySelectorAll === "function") {
          for (const element of Array.from(root.querySelectorAll(selector))) {
            if (!seen.has(element)) {
              seen.add(element);
              matches.push(element);
            }
          }
        }

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        let current: Node | null = walker.currentNode;
        while (current) {
          if (current instanceof Element && current.shadowRoot) {
            findElementsDeep(selector, current.shadowRoot, seen, matches);
          }
          current = walker.nextNode();
        }

        return matches;
      }

      function findBestMatch(
        selectors: string[],
        options: { visibleOnly?: boolean } = {},
      ): { element: Element | null; selector: string } {
        for (const selector of selectors) {
          const matches = findElementsDeep(selector);
          const visible = options.visibleOnly ? matches.filter((element) => isElementVisible(element)) : matches;
          const target = visible[0] ?? matches[0] ?? null;
          if (target) {
            return { element: target, selector };
          }
        }

        return { element: null, selector: selectors[0] ?? "" };
      }

      function detectInputType(element: Element): string {
        if (element instanceof HTMLTextAreaElement) {
          return "textarea";
        }

        if (element instanceof HTMLInputElement) {
          return "input";
        }

        return element instanceof HTMLElement && element.isContentEditable
          ? "contenteditable"
          : "";
      }

      function highlightElement(element: Element, color: string): void {
        if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
          return;
        }

        const previousOutline = element.style.outline;
        const previousOutlineOffset = element.style.outlineOffset;
        element.style.outline = `3px solid ${color}`;
        element.style.outlineOffset = "2px";
        window.setTimeout(() => {
          element.style.outline = previousOutline;
          element.style.outlineOffset = previousOutlineOffset;
        }, 1800);
      }

      function snapshotElementValue(
        element: Element,
      ): { type: "value"; value: string } | { type: "html"; html: string } | { type: "text"; text: string } {
        if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
          return {
            type: "value",
            value: element.value,
          };
        }

        if (element instanceof HTMLElement && element.isContentEditable) {
          return {
            type: "html",
            html: element.innerHTML,
          };
        }

        return {
          type: "text",
          text: element.textContent ?? "",
        };
      }

      function restoreElementValue(
        element: Element,
        snapshot: ReturnType<typeof snapshotElementValue> | null,
      ): void {
        if (!snapshot) {
          return;
        }

        if (snapshot.type === "value" && (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement)) {
          element.value = snapshot.value ?? "";
        } else if (snapshot.type === "html" && element instanceof HTMLElement) {
          element.innerHTML = snapshot.html ?? "";
        } else if (snapshot.type === "text" && element instanceof HTMLElement) {
          element.textContent = snapshot.text ?? "";
        }

        element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "" }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }

      function applyProbeText(element: Element, probeText: string): void {
        if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
          element.focus();
          element.value = probeText;
        } else if (element instanceof HTMLElement && element.isContentEditable) {
          element.focus();
          element.textContent = probeText;
        } else {
          throw new Error("Editable target was not found.");
        }

        element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: probeText }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }

      async function waitForVisibleSelector(
        selector: string,
        timeoutMs = 1800,
      ): Promise<{ element: Element | null; selector: string }> {
        const startedAt = Date.now();
        while (Date.now() - startedAt <= timeoutMs) {
          const match = findBestMatch([selector], { visibleOnly: true });
          if (match.element) {
            return match;
          }
          await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
        }

        return findBestMatch([selector], { visibleOnly: true });
      }

      try {
        const selectors = [
          siteDraft.inputSelector,
          ...(Array.isArray(siteDraft.fallbackSelectors) ? siteDraft.fallbackSelectors : []),
        ].filter((selector) => typeof selector === "string" && selector.trim());
        const inputMatch = findBestMatch(selectors, { visibleOnly: true });

        if (!inputMatch.element) {
          return {
            ok: true,
            input: {
              found: false,
              selector: inputMatch.selector,
              actualType: "",
              expectedType: siteDraft.inputType ?? "",
            },
            submit: {
              status: "skipped",
            },
          };
        }

        highlightElement(inputMatch.element, "#facc15");
        const actualInputType = detectInputType(inputMatch.element);
        const inputTypeMatches = actualInputType === String(siteDraft.inputType ?? "");
        const response: ServiceTestProbeSuccess = {
          ok: true,
          input: {
            found: true,
            selector: inputMatch.selector,
            actualType: actualInputType,
            expectedType: String(siteDraft.inputType ?? ""),
            typeMatches: inputTypeMatches,
          },
          submit: {
            status: "skipped",
          },
        };

        if (
          String(siteDraft.submitMethod) !== "click" ||
          (nextSubmitRequirement !== "required" && nextSubmitRequirement !== "conditional")
        ) {
          response.submit = {
            status: "skipped",
            method: String(siteDraft.submitMethod ?? "enter"),
          };
          return response;
        }

        const snapshot = snapshotElementValue(inputMatch.element);
        try {
          applyProbeText(inputMatch.element, nextProbeText);
          const submitMatch = await waitForVisibleSelector(String(siteDraft.submitSelector ?? ""));
          if (submitMatch.element) {
            highlightElement(submitMatch.element, "#34d399");
          }

          response.submit = {
            status: submitMatch.element ? "ok" : "missing",
            selector: submitMatch.selector,
          };
        } finally {
          restoreElementValue(inputMatch.element, snapshot);
        }

        return response;
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    args: [draft, probeText, submitRequirement],
  });

  return (result?.result as ServiceTestProbeResult | undefined) ?? {
    ok: false,
    error: "Selector test returned no result.",
  };
}
