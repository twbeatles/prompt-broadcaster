import {
  SYSTEM_TEMPLATE_VARIABLES,
  buildSystemTemplateValues,
} from "../../../shared/template";
import type {
  ActiveTabContextResponse,
  BroadcastCounterResponse,
} from "../../../shared/types/messages";
import type {
  FavoritePrompt,
  TemplateVariableDescriptor,
} from "../../../shared/types/models";
import type { PopupTemplateSendState } from "../../../shared/types/popup";
import { t, uiLanguage } from "../../app/i18n";
import { detectFavoriteTemplateVariables, mergeTemplateSources } from "./helpers";
import type { ComposerTarget, PopupTemplateModalDeps } from "./types";

interface TemplatePreparationDeps {
  sendPopupMessage: PopupTemplateModalDeps["sendPopupMessage"];
  detectTemplateVariablesForTargets: PopupTemplateModalDeps["detectTemplateVariablesForTargets"];
  getUnknownErrorText: () => string;
}

export function createPopupTemplatePreparation(
  deps: TemplatePreparationDeps,
) {
  async function ensureClipboardReadPermission(): Promise<boolean> {
    try {
      if (!chrome.permissions?.contains || !chrome.permissions?.request) {
        return false;
      }

      const permission: chrome.permissions.Permissions = {
        permissions: ["clipboardRead"],
      };
      const alreadyGranted = await chrome.permissions.contains(permission);

      if (alreadyGranted) {
        return true;
      }

      return await chrome.permissions.request(permission);
    } catch (error) {
      console.error(
        "[AI Prompt Broadcaster] Failed to request clipboardRead permission.",
        error,
      );
      return false;
    }
  }

  async function resolveAsyncTemplateVariables(
    variables: TemplateVariableDescriptor[],
  ): Promise<Record<string, string>> {
    const needsTabContext = variables.some(
      (variable) =>
        variable.name === SYSTEM_TEMPLATE_VARIABLES.url ||
        variable.name === SYSTEM_TEMPLATE_VARIABLES.title ||
        variable.name === SYSTEM_TEMPLATE_VARIABLES.selection,
    );
    const needsCounter = variables.some(
      (variable) => variable.name === SYSTEM_TEMPLATE_VARIABLES.counter,
    );

    const extra: Record<string, string> = {};

    if (needsTabContext) {
      try {
        const response = await deps.sendPopupMessage<ActiveTabContextResponse>(
          { action: "getActiveTabContext" },
          4000,
        );
        if (response?.ok) {
          extra.url = response.url ?? "";
          extra.title = response.title ?? "";
          extra.selection = response.selection ?? "";
        }
      } catch {
        // fall through with empty values
      }
    }

    if (needsCounter) {
      try {
        const response = await deps.sendPopupMessage<BroadcastCounterResponse>(
          { action: "getBroadcastCounter" },
          4000,
        );
        extra.counter =
          response?.counter != null ? String(Number(response.counter) + 1) : "1";
      } catch {
        extra.counter = "1";
      }
    }

    return extra;
  }

  async function readClipboardTemplateValue() {
    try {
      const hasPermission = await ensureClipboardReadPermission();
      if (!hasPermission) {
        return {
          ok: false,
          text: "",
          error: "clipboardRead permission was not granted.",
        };
      }

      if (!navigator.clipboard?.readText) {
        return {
          ok: false,
          text: "",
          error: "Clipboard API is not available in this context.",
        };
      }

      const text = await navigator.clipboard.readText();
      return { ok: true, text };
    } catch (error) {
      console.error(
        "[AI Prompt Broadcaster] Failed to read clipboard for template variable.",
        error,
      );
      return {
        ok: false,
        text: "",
        error:
          error instanceof Error ? error.message : deps.getUnknownErrorText(),
      };
    }
  }

  async function buildPreparedFavoriteExecutionContext(
    favorite: FavoritePrompt,
  ): Promise<
    | { ok: true; preparedExecutionContext: Record<string, string> }
    | { ok: false; reason: string; error: string }
  > {
    const variables = detectFavoriteTemplateVariables(favorite);
    const needsClipboard = variables.some(
      (variable) =>
        variable.kind === "system" &&
        variable.name === SYSTEM_TEMPLATE_VARIABLES.clipboard,
    );
    const asyncExtra = await resolveAsyncTemplateVariables(variables);
    const preparedExecutionContext: Record<string, string> = {};

    if (typeof asyncExtra.url === "string") {
      preparedExecutionContext.url = asyncExtra.url;
    }
    if (typeof asyncExtra.title === "string") {
      preparedExecutionContext.title = asyncExtra.title;
    }
    if (typeof asyncExtra.selection === "string") {
      preparedExecutionContext.selection = asyncExtra.selection;
    }

    if (!needsClipboard) {
      return {
        ok: true,
        preparedExecutionContext,
      };
    }

    const clipboardResult = await readClipboardTemplateValue();
    if (!clipboardResult.ok) {
      return {
        ok: false,
        reason: "clipboard_read_failed",
        error: clipboardResult.error || t.templateClipboardError,
      };
    }

    preparedExecutionContext.clipboard = clipboardResult.text ?? "";
    return {
      ok: true,
      preparedExecutionContext,
    };
  }

  async function buildPendingTemplateSendState(
    prompt: string,
    targets: ComposerTarget[],
    templateVariableCache: Record<string, string>,
    loadedTemplateDefaults: Record<string, string>,
  ): Promise<PopupTemplateSendState | null> {
    const variables = deps.detectTemplateVariablesForTargets(targets);
    if (variables.length === 0) {
      return null;
    }

    const baseDefaults = mergeTemplateSources(
      templateVariableCache,
      loadedTemplateDefaults,
    );
    const userValues = Object.fromEntries(
      variables
        .filter((variable) => variable.kind === "user")
        .map((variable) => [variable.name, baseDefaults[variable.name] ?? ""]),
    );

    const asyncExtra = await resolveAsyncTemplateVariables(variables);
    const systemValues = buildSystemTemplateValues(new Date(), {
      locale: uiLanguage === "ko" ? "ko" : "en",
      extra: asyncExtra,
    });

    if (
      variables.some(
        (variable) => variable.name === SYSTEM_TEMPLATE_VARIABLES.clipboard,
      )
    ) {
      const clipboardResult = await readClipboardTemplateValue();
      if (clipboardResult.ok) {
        systemValues[SYSTEM_TEMPLATE_VARIABLES.clipboard] =
          clipboardResult.text;
      }
    }

    return {
      prompt,
      targets,
      variables,
      userValues,
      systemValues,
    };
  }

  return {
    readClipboardTemplateValue,
    buildPreparedFavoriteExecutionContext,
    buildPendingTemplateSendState,
  };
}
