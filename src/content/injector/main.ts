import { log, logError, sleep } from "./dom";
import { copyPromptToClipboard, sendRuntimeMessage } from "./fallback";
import { normalizeSelectors, isLikelyAuthPage, waitForElement } from "./selectors";
import { strategyExecCommand, strategyNativeSetter, strategyPasteEvent } from "./strategies";
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
}

interface InjectResult {
  status: string;
  copied?: boolean;
  selector?: string;
  strategy?: string;
  elapsedMs?: number;
  error?: string;
}

declare global {
  interface Window {
    __aiPromptBroadcasterInjectPrompt?: (prompt: string, config: InjectorConfig) => Promise<InjectResult>;
  }
}

async function injectPrompt(prompt: string, config: InjectorConfig): Promise<InjectResult> {
  try {
    const serviceName = config?.name ?? "AI service";
    if (isLikelyAuthPage(config)) {
      return { status: "login_required" };
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
      const copied = config?.fallback !== false ? await copyPromptToClipboard(prompt) : false;
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
    const copied = config?.fallback !== false ? await copyPromptToClipboard(prompt) : false;
    await sendRuntimeMessage({
      action: "injectFallback",
      serviceId: config?.id,
      copied,
    });
    return {
      status: "failed",
      copied,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

if (typeof window.__aiPromptBroadcasterInjectPrompt !== "function") {
  window.__aiPromptBroadcasterInjectPrompt = injectPrompt;
}
