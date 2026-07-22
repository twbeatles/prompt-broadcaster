import { runServiceTestOnTab } from "./probe";
import type {
  ServiceTestRunMessage,
  ServiceTestRunResponse,
} from "../../shared/types/messages";

export interface ServiceTestHandlerDeps {
  getErrorMessage: (error: unknown) => string;
  getPreferredInjectableNormalTab: () => Promise<{
    ok: boolean;
    reason?: string;
    tab?: chrome.tabs.Tab | null;
  }>;
}

export function createServiceTestHandler(deps: ServiceTestHandlerDeps) {
  const { getErrorMessage, getPreferredInjectableNormalTab } = deps;

  async function handleServiceTestRun(
    message: ServiceTestRunMessage,
  ): Promise<ServiceTestRunResponse> {
      const draft = message?.draft ?? {};
      const selectorErrors = [];
      if (!String(draft?.inputSelector ?? "").trim()) {
        selectorErrors.push("Input selector is required.");
      }

      if (!["textarea", "contenteditable", "input"].includes(String(draft?.inputType ?? ""))) {
        selectorErrors.push("Input type is invalid.");
      }

      if (!["click", "enter", "shift+enter"].includes(String(draft?.submitMethod ?? ""))) {
        selectorErrors.push("Submit method is invalid.");
      }

      if (
        String(draft?.submitMethod ?? "") === "click" &&
        !String(draft?.submitSelector ?? "").trim()
      ) {
        selectorErrors.push("Submit selector is required when using click submit.");
      }

      if (selectorErrors.length > 0) {
        return {
          ok: false,
          reason: "validation_failed",
          error: selectorErrors.join(" "),
        };
      }

      const preferredTab = await getPreferredInjectableNormalTab();
      if (!preferredTab?.ok) {
        return {
          ok: false,
          reason: preferredTab?.reason ?? "no_tab",
        };
      }

      try {
        const tab = preferredTab.tab;
        const tabId = tab?.id;
        if (typeof tabId !== "number" || !tab) {
          return {
            ok: false,
            reason: "no_tab",
          };
        }

        const result = await runServiceTestOnTab(tabId, draft);
        if (!result.ok) {
          return result;
        }

        return {
          ...result,
          tabId,
          tabUrl: tab.url ?? "",
        };
      } catch (error) {
        console.error("[AI Prompt Broadcaster] Service test failed.", error);
        return {
          ok: false,
          reason: "error",
          error: getErrorMessage(error),
        };
      }
  }

  return { handleServiceTestRun, runServiceTestOnTab };
}
