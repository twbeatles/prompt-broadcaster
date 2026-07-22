import {
  buildInjectionConfig,
  normalizeSelectorEntries,
} from "../app/injection-helpers";
import { INJECTOR_SCRIPT_PATH } from "../app/constants";
import type {
  ExecuteScriptAttempt,
  ExecuteScriptInjectionResult,
} from "../app/injection/types";
import type {
  RuntimeInjectionSiteConfig,
  RuntimeSite,
} from "../../shared/types/models";

export async function injectIntoTab(
  tabId: number,
  prompt: string,
  site: RuntimeSite,
  runtimeOverrides: Record<string, unknown> = {},
): Promise<ExecuteScriptInjectionResult | null> {
  const config = buildInjectionConfig(site, runtimeOverrides);

  if (site?.id === "perplexity") {
    const promptSelectors = normalizeSelectorEntries([
      config?.inputSelector,
      ...(Array.isArray(config?.fallbackSelectors) ? config.fallbackSelectors : []),
    ]);
    const [executionResult] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: async (
        injectedPrompt: string,
        injectedConfig: RuntimeInjectionSiteConfig,
        injectedSelectors: string[],
      ) => {
        const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, Math.max(Number(ms) || 0, 0)));

        const normalizeText = (value: unknown) =>
          String(value ?? "")
            .replace(/\u00A0/g, " ")
            .replace(/[\u200B-\u200D\uFEFF]/g, "")
            .replace(/\r\n?/g, "\n")
            .trim();

        const isVisible = (element: Element) => {
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
        };

        const isEditable = (element: Element) => {
          if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            return !element.readOnly;
          }

          return element instanceof HTMLElement ? element.isContentEditable : false;
        };

        const findPromptMatch = () => {
          for (const selector of Array.isArray(injectedSelectors) ? injectedSelectors : []) {
            const candidates = Array.from(document.querySelectorAll(selector));
            const element = candidates.find((candidate) => isVisible(candidate) && isEditable(candidate));
            if (element) {
              return { element, selector };
            }
          }

          return null;
        };

        const waitForPromptMatch = async (timeoutMs: number) => {
          const deadline = performance.now() + Math.max(Number(timeoutMs) || 0, 0);

          while (performance.now() <= deadline) {
            const match = findPromptMatch();
            if (match) {
              return match;
            }

            await sleep(150);
          }

          return null;
        };

        const placeCaretAtEnd = (element: Element) => {
          if (!(element instanceof HTMLElement)) {
            return;
          }

          const selection = window.getSelection();
          if (!selection) {
            return;
          }

          const range = document.createRange();
          range.selectNodeContents(element);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        };

        const selectAllEditableContents = (element: Element) => {
          if (!(element instanceof HTMLElement)) {
            return;
          }

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
        };

        const buildParagraphNode = (text: string) => ({
          children: text
            ? [
                {
                  detail: 0,
                  format: 0,
                  mode: "normal",
                  style: "",
                  text,
                  type: "text",
                  version: 1,
                },
              ]
            : [],
          direction: null,
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1,
          textFormat: 0,
          textStyle: "",
        });

        const setLexicalText = (element: Element, nextPrompt: string) => {
          if (!(element instanceof HTMLElement)) {
            return false;
          }

          const editor = element.__lexicalEditor;
          if (
            !editor ||
            typeof editor.parseEditorState !== "function" ||
            typeof editor.setEditorState !== "function"
          ) {
            return false;
          }

          const paragraphs = String(nextPrompt ?? "").split(/\n/g).map((line) => buildParagraphNode(line));
          const editorStateJson = {
            root: {
              children: paragraphs.length > 0 ? paragraphs : [buildParagraphNode("")],
              direction: null,
              format: "",
              indent: 0,
              type: "root",
              version: 1,
            },
          };

          const nextState = editor.parseEditorState(JSON.stringify(editorStateJson));
          editor.setEditorState(nextState);
          if (typeof editor.focus === "function") {
            editor.focus();
          } else {
            element.focus();
          }
          placeCaretAtEnd(element);
          return normalizeText(element.innerText ?? element.textContent ?? "") === normalizeText(nextPrompt);
        };

        if ((Number(injectedConfig?.waitMs) || 0) > 0) {
          await sleep(injectedConfig.waitMs);
        }

        const startedAt = performance.now();
        const match = await waitForPromptMatch(Math.max((Number(injectedConfig?.waitMs) || 0) + 6000, 8000));
        if (!match?.element) {
          return { status: "selector_timeout", attempts: [] };
        }

        const { element, selector } = match;
        let strategy = "mainWorldExecCommand";
        let injected = false;
        const attempts: ExecuteScriptAttempt[] = [];

        if (element instanceof HTMLElement && element.dataset.lexicalEditor === "true") {
          injected = setLexicalText(element, injectedPrompt);
          strategy = "mainWorldLexical";
          attempts.push({ name: strategy, success: injected });
        }

        if (!injected && element instanceof HTMLElement) {
          element.focus();
          selectAllEditableContents(element);
          const inserted = document.execCommand("insertText", false, injectedPrompt);
          injected =
            Boolean(inserted) ||
            normalizeText(element.innerText ?? element.textContent ?? "") === normalizeText(injectedPrompt);
          attempts.push({ name: "mainWorldExecCommand", success: injected });
        }

        if (!injected) {
          return { status: "strategy_exhausted", selector, strategy, attempts };
        }

        return {
          status: "injected",
          selector,
          strategy,
          inputType: "contenteditable",
          elapsedMs: Math.round(performance.now() - startedAt),
          attempts,
        };
      },
      args: [prompt, config, promptSelectors],
    });

    const injectionResult = (executionResult?.result as ExecuteScriptInjectionResult | null | undefined) ?? null;
    if (!injectionResult || injectionResult.status !== "injected") {
      return injectionResult;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: [INJECTOR_SCRIPT_PATH],
    });

    const [submitExecutionResult] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (injectedConfig: RuntimeInjectionSiteConfig) => {
        const submitter = globalThis.__aiPromptBroadcasterSubmitPrompt;
        if (typeof submitter !== "function") {
          throw new Error("submitPrompt entry point is not available in the tab context.");
        }

        return submitter(injectedConfig);
      },
      args: [config],
    });

    const submitResult = (submitExecutionResult?.result as ExecuteScriptInjectionResult | null | undefined) ?? null;
    if (submitResult?.status === "submitted") {
      return {
        ...submitResult,
        selector: injectionResult.selector ?? submitResult.selector,
        strategy: injectionResult.strategy ?? submitResult.strategy,
        inputType: injectionResult.inputType ?? submitResult.inputType,
        elapsedMs: injectionResult.elapsedMs ?? submitResult.elapsedMs,
        attempts: injectionResult.attempts ?? submitResult.attempts ?? [],
      };
    }

    return {
      ...(submitResult ?? injectionResult),
      selector: injectionResult?.selector ?? submitResult?.selector,
      strategy: injectionResult?.strategy ?? submitResult?.strategy,
      inputType: injectionResult?.inputType ?? submitResult?.inputType,
      elapsedMs: injectionResult?.elapsedMs ?? submitResult?.elapsedMs,
      attempts: injectionResult?.attempts ?? submitResult?.attempts ?? [],
    };
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: [INJECTOR_SCRIPT_PATH],
  });

  const [executionResult] = await chrome.scripting.executeScript({
    target: { tabId },
      func: async (injectedPrompt: string, injectedConfig: RuntimeInjectionSiteConfig) => {
        const injector = globalThis.__aiPromptBroadcasterInjectPrompt;
      if (typeof injector !== "function") {
        throw new Error("injectPrompt entry point is not available in the tab context.");
      }

      return injector(injectedPrompt, injectedConfig);
    },
    args: [prompt, config],
  });

  return (executionResult?.result as ExecuteScriptInjectionResult | null | undefined) ?? null;
}
