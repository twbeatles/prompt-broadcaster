import { clearContentEditableText, isLexicalEditorElement, log, logError, sleep } from "./dom";
import { copyPromptToClipboard, sendRuntimeMessage } from "./fallback";
import { normalizeSelectors, isLikelyAuthPage, waitForElement } from "./selectors";
import {
  strategyDirectContenteditable,
  strategyExecCommand,
  strategyLexicalEditorState,
  strategyNativeSetter,
  strategyPasteEvent,
} from "./strategies";
import { submitPrompt } from "./submit";

interface InjectorConfig {
  id?: string;
  name?: string;
  inputType?: string;
  waitMs?: number;
  fallback?: boolean;
  inputSelector?: string;
  fallbackSelectors?: string[];
  authSelectors?: string[];
  submitSelector?: string;
  submitMethod?: string;
  submitTimeoutMs?: number;
  submitRetryCount?: number;
  strategyOrder?: string[];
}

interface InjectStrategy {
  name: string;
  run: () => boolean;
}

interface InjectionStrategyAttempt {
  name: string;
  success: boolean;
}

interface InjectResult {
  status: string;
  copied?: boolean;
  selector?: string;
  strategy?: string;
  inputType?: string;
  elapsedMs?: number;
  error?: string;
  attempts?: InjectionStrategyAttempt[];
}

declare global {
  interface Window {
    __aiPromptBroadcasterInjectPrompt?: (prompt: string, config: InjectorConfig) => Promise<InjectResult>;
    __aiPromptBroadcasterSubmitPrompt?: (config: InjectorConfig) => Promise<InjectResult>;
    __aiPromptBroadcasterActiveInjection?: {
      key: string;
      promise: Promise<InjectResult>;
    };
    __aiPromptBroadcasterRecentInjection?: {
      key: string;
      finishedAt: number;
      result: InjectResult;
    };
  }
}

const RECENT_INJECTION_DEDUPE_MS = 1500;

function buildInjectionKey(prompt: string, config: InjectorConfig): string {
  return [
    window.location.href,
    config?.id ?? "",
    prompt,
  ].join("\n");
}

function orderStrategies(strategies: InjectStrategy[], preferredNames: unknown): InjectStrategy[] {
  const requestedNames = Array.isArray(preferredNames)
    ? preferredNames
      .map((name) => (typeof name === "string" ? name.trim() : ""))
      .filter(Boolean)
    : [];

  if (requestedNames.length === 0) {
    return strategies;
  }

  const byName = new Map(strategies.map((strategy) => [strategy.name, strategy]));
  const ordered: InjectStrategy[] = [];

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

async function performInjectPrompt(prompt: string, config: InjectorConfig): Promise<InjectResult> {
  const attempts: InjectionStrategyAttempt[] = [];

  try {
    const serviceName = config?.name ?? "AI service";
    if (isLikelyAuthPage(config)) {
      return { status: "auth_required" };
    }

    if ((config?.waitMs ?? 0) > 0) {
      await sleep(config.waitMs as number);
    }

    const selectorCandidates = normalizeSelectors(config);
    const match = await waitForElement(selectorCandidates, Math.max((config?.waitMs ?? 0) + 6000, 8000));

    if (!match?.element) {
      await sendRuntimeMessage({
        action: "selectorFailed",
        serviceId: config?.id,
        selector: selectorCandidates[0] ?? "",
      });

      const copied = config?.fallback !== false ? await copyPromptToClipboard(prompt) : false;

      await sendRuntimeMessage({
        action: "injectFallback",
        serviceId: config?.id,
        copied,
      });

      return { status: "selector_timeout", copied, attempts };
    }

    const { element, selector, elapsedMs } = match;
    const resolvedInputType =
      element instanceof HTMLTextAreaElement
        ? "textarea"
        : element instanceof HTMLInputElement
          ? "input"
          : (element as HTMLElement).isContentEditable
            ? "contenteditable"
            : config?.inputType === "input"
              ? "input"
              : config?.inputType === "contenteditable"
                ? "contenteditable"
                : "textarea";

    const lexicalEditor = resolvedInputType === "contenteditable" && isLexicalEditorElement(element);
    const defaultStrategies = resolvedInputType === "contenteditable"
      ? lexicalEditor
        ? [
            { name: "lexicalEditorState", run: () => strategyLexicalEditorState(element, prompt) },
            { name: "execCommand", run: () => strategyExecCommand(element, prompt) },
          ]
        : [
            { name: "execCommand", run: () => strategyExecCommand(element, prompt) },
            { name: "directContenteditable", run: () => strategyDirectContenteditable(element, prompt) },
            { name: "paste", run: () => strategyPasteEvent(element, prompt) },
          ]
      : [
          { name: "nativeSetter", run: () => strategyNativeSetter(element, prompt) },
          { name: "paste", run: () => strategyPasteEvent(element, prompt) },
        ];

    const strategies = orderStrategies(defaultStrategies, config?.strategyOrder);

    let usedStrategy = "";
    let injected = false;

    for (const [index, strategy] of strategies.entries()) {
      if (resolvedInputType === "contenteditable" && index > 0 && !lexicalEditor) {
        clearContentEditableText(element as HTMLElement);
      }

      const success = strategy.run();
      attempts.push({
        name: strategy.name,
        success,
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
      await sendRuntimeMessage({
        action: "injectFallback",
        serviceId: config?.id,
        copied,
      });
      return { status: "strategy_exhausted", copied, attempts };
    }

    log(`✅ ${serviceName} 주입 성공 (셀렉터: ${selector}, 대기: ${elapsedMs}ms, 전략: ${usedStrategy})`);
    await sendRuntimeMessage({
      action: "injectSuccess",
      serviceId: config?.id,
      selector,
      strategy: usedStrategy,
      elapsedMs,
    });

    if (!(await submitPrompt(element, config))) {
      return { status: "submit_failed", selector, strategy: usedStrategy, inputType: resolvedInputType, elapsedMs, attempts };
    }

    return {
      status: "submitted",
      selector,
      strategy: usedStrategy,
      inputType: resolvedInputType,
      elapsedMs,
      attempts,
    };
  } catch (error) {
    logError("injectPrompt failed", error);
    const copied = config?.fallback !== false ? await copyPromptToClipboard(prompt) : false;
    await sendRuntimeMessage({
      action: "injectFallback",
      serviceId: config?.id,
      copied,
    });
    return {
      status: "unexpected_error",
      copied,
      error: error instanceof Error ? error.message : String(error),
      attempts,
    };
  }
}

async function submitOnlyPrompt(config: InjectorConfig): Promise<InjectResult> {
  try {
    if (isLikelyAuthPage(config)) {
      return { status: "auth_required" };
    }

    if ((config?.waitMs ?? 0) > 0) {
      await sleep(config.waitMs as number);
    }

    const selectorCandidates = normalizeSelectors(config);
    const match = await waitForElement(selectorCandidates, Math.max((config?.waitMs ?? 0) + 6000, 8000));

    if (!match?.element) {
      return { status: "selector_timeout" };
    }

    const { element, selector, elapsedMs } = match;
    if (!(await submitPrompt(element, config))) {
      return { status: "submit_failed", selector, elapsedMs };
    }

    return {
      status: "submitted",
      selector,
      strategy: "submitOnly",
      elapsedMs,
      attempts: [],
    };
  } catch (error) {
    logError("submitOnlyPrompt failed", error);
    return {
      status: "unexpected_error",
      error: error instanceof Error ? error.message : String(error),
      attempts: [],
    };
  }
}

async function injectPrompt(prompt: string, config: InjectorConfig): Promise<InjectResult> {
  const key = buildInjectionKey(prompt, config);
  const activeInjection = window.__aiPromptBroadcasterActiveInjection;
  if (activeInjection?.key === key) {
    return activeInjection.promise;
  }

  const recentInjection = window.__aiPromptBroadcasterRecentInjection;
  if (
    recentInjection?.key === key &&
    recentInjection.result?.status === "submitted" &&
    Date.now() - recentInjection.finishedAt <= RECENT_INJECTION_DEDUPE_MS
  ) {
    return recentInjection.result;
  }

  const promise = performInjectPrompt(prompt, config)
    .then((result) => {
      if (result.status === "submitted") {
        window.__aiPromptBroadcasterRecentInjection = {
          key,
          finishedAt: Date.now(),
          result,
        };
      }

      return result;
    })
    .finally(() => {
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
