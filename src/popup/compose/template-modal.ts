import {
  SYSTEM_TEMPLATE_VARIABLES,
  buildSystemTemplateValues,
  detectTemplateVariables,
  getTemplateVariableDisplayName,
} from "../../shared/template";
import { getPromptFavorites, markFavoriteUsed, updateTemplateVariableCache } from "../../shared/prompts";
import type {
  ActiveTabContextResponse,
  BroadcastCounterResponse,
  FavoriteRunResponse,
} from "../../shared/types/messages";
import type {
  FavoriteExecutionTrigger,
  FavoritePrompt,
  TemplateVariableDescriptor,
} from "../../shared/types/models";
import type { PopupTemplateSendState } from "../../shared/types/popup";
import { popupDom } from "../app/dom";
import { escapeAttribute, escapeHtml } from "../app/helpers";
import { getUnknownErrorText, t, uiLanguage } from "../app/i18n";
import { state } from "../app/state";

type ComposerTarget = NonNullable<PopupTemplateSendState["targets"]>[number];

const {
  templateModal,
  templateModalTitle,
  templateModalDesc,
  templateModalClose,
  templateModalSystemInfo,
  templateFields,
  templatePreviewLabel,
  templatePreview,
  templateModalError,
  templateModalCancel,
  templateModalConfirm,
} = popupDom.modals;

function compactVariableValues(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values ?? {})
      .map(([name, value]) => [String(name), String(value ?? "")])
      .filter(([, value]) => value.trim()),
  );
}

function mergeTemplateSources(
  ...sources: Array<Record<string, string> | undefined | null>
): Record<string, string> {
  return Object.assign({}, ...sources.filter(Boolean));
}

interface PopupTemplateModalDeps {
  sendPopupMessage: <TResponse>(message: object, timeoutMs?: number) => Promise<TResponse | null>;
  buildResolvedBroadcastTargets: (
    targets?: ComposerTarget[],
    values?: Record<string, string>,
  ) => ComposerTarget[];
  detectTemplateVariablesForTargets: (targets?: ComposerTarget[]) => TemplateVariableDescriptor[];
  findMissingTemplateValuesForTargets: (
    targets?: ComposerTarget[],
    userValues?: Record<string, string>,
  ) => string[];
  buildTemplatePreviewText: (
    targets?: ComposerTarget[],
    values?: Record<string, string>,
  ) => string;
  sendResolvedPrompt: (
    prompt: string,
    targets: ComposerTarget[],
  ) => Promise<void>;
  openOverlay: (overlay: HTMLElement | null, initialFocus?: HTMLElement | null) => void;
  closeOverlay: (overlay: HTMLElement | null) => void;
}

export function createPopupTemplateModal(deps: PopupTemplateModalDeps) {
  function getTemplateDisplayName(name: string): string {
    return getTemplateVariableDisplayName(name, uiLanguage);
  }

  function setTemplateModalError(message = "") {
    templateModalError.hidden = !message;
    templateModalError.textContent = message;
  }

  function hideTemplateModal() {
    state.pendingTemplateSend = null;
    deps.closeOverlay(templateModal);
    templateModalError.hidden = true;
    templateModalError.textContent = "";
  }

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
      console.error("[AI Prompt Broadcaster] Failed to request clipboardRead permission.", error);
      return false;
    }
  }

  async function resolveAsyncTemplateVariables(
    variables: TemplateVariableDescriptor[],
  ): Promise<Record<string, string>> {
    const needsTabContext = variables.some(
      (v) =>
        v.name === SYSTEM_TEMPLATE_VARIABLES.url ||
        v.name === SYSTEM_TEMPLATE_VARIABLES.title ||
        v.name === SYSTEM_TEMPLATE_VARIABLES.selection,
    );
    const needsCounter = variables.some((v) => v.name === SYSTEM_TEMPLATE_VARIABLES.counter);

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
        extra.counter = response?.counter != null ? String(Number(response.counter) + 1) : "1";
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
      console.error("[AI Prompt Broadcaster] Failed to read clipboard for template variable.", error);
      return {
        ok: false,
        text: "",
        error: error instanceof Error ? error.message : getUnknownErrorText(),
      };
    }
  }

  function getFavoriteTemplateSources(favorite: FavoritePrompt): string[] {
    if (favorite?.mode === "chain" && Array.isArray(favorite.steps) && favorite.steps.length > 0) {
      return favorite.steps
        .map((step) => String(step?.text ?? ""))
        .filter((text) => text.trim());
    }

    return [String(favorite?.text ?? "")];
  }

  function detectFavoriteTemplateVariables(
    favorite: FavoritePrompt,
  ): TemplateVariableDescriptor[] {
    const seen = new Set<string>();

    return getFavoriteTemplateSources(favorite)
      .flatMap((template) => detectTemplateVariables(template))
      .filter((variable) => {
        if (seen.has(variable.name)) {
          return false;
        }

        seen.add(variable.name);
        return true;
      });
  }

  async function buildPreparedFavoriteExecutionContext(
    favorite: FavoritePrompt,
  ): Promise<
    | { ok: true; preparedExecutionContext: Record<string, string> }
    | { ok: false; reason: string; error: string }
  > {
    const variables = detectFavoriteTemplateVariables(favorite);
    const needsClipboard = variables.some(
      (variable) => variable.kind === "system" && variable.name === SYSTEM_TEMPLATE_VARIABLES.clipboard,
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

  async function requestFavoriteRun(
    favorite: FavoritePrompt,
    {
      trigger = "popup",
      allowPopupFallback = false,
    }: {
      trigger?: FavoriteExecutionTrigger;
      allowPopupFallback?: boolean;
    } = {},
  ): Promise<FavoriteRunResponse> {
    if (!favorite?.id) {
      return {
        ok: false,
        error: getUnknownErrorText(),
      };
    }

    const prepared = await buildPreparedFavoriteExecutionContext(favorite);
    if (!prepared?.ok) {
      return prepared;
    }

    return (await deps.sendPopupMessage<FavoriteRunResponse>(
      {
        action: "favorite:run",
        favoriteId: favorite.id,
        trigger,
        allowPopupFallback,
        preparedExecutionContext: prepared.preparedExecutionContext,
      },
      10000,
    )) ?? {
      ok: false,
      error: getUnknownErrorText(),
    };
  }

  async function maybeMarkLoadedFavoriteAsUsed() {
    if (!state.loadedFavoriteId) {
      return;
    }

    try {
      await markFavoriteUsed(state.loadedFavoriteId);
      state.favorites = await getPromptFavorites();
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Failed to update favorite usage.", error);
    }
  }

  function buildTemplateSendPreviewStateV2(): {
    values: Record<string, string>;
    preview: string;
    missingUserValues: string[];
    clipboardMissing: boolean;
  } | null {
    const modalState = state.pendingTemplateSend;
    if (!modalState) {
      return null;
    }

    const values = mergeTemplateSources(modalState.systemValues, modalState.userValues);
    const preview = deps.buildTemplatePreviewText(modalState.targets, values);
    const missingUserValues = deps.findMissingTemplateValuesForTargets(
      modalState.targets,
      modalState.userValues,
    );
    const clipboardRequired = modalState.variables.some(
      (variable) => variable.name === SYSTEM_TEMPLATE_VARIABLES.clipboard,
    );
    const clipboardMissing =
      clipboardRequired && !String(modalState.systemValues[SYSTEM_TEMPLATE_VARIABLES.clipboard] ?? "").length;

    return {
      values,
      preview,
      missingUserValues,
      clipboardMissing,
    };
  }

  function renderTemplateModalV2(): void {
    const modalState = state.pendingTemplateSend;
    if (!modalState) {
      return;
    }

    templateModalTitle.textContent = t.templateModalTitle;
    templateModalDesc.textContent = t.templateModalDesc;
    templatePreviewLabel.textContent = t.templatePreviewLabel;
    templateModalCancel.textContent = t.templateModalCancel;
    templateModalConfirm.textContent = t.templateModalConfirm;

    const automaticVariables = modalState.variables.filter((variable) => variable.kind === "system");
    if (automaticVariables.length > 0) {
      const labels = automaticVariables
        .map((variable) => `{{${getTemplateDisplayName(variable.name)}}}`)
        .join(", ");
      const notices = [t.templateSystemNotice, labels];

      if (automaticVariables.some((variable) => variable.name === SYSTEM_TEMPLATE_VARIABLES.clipboard)) {
        notices.push(t.templateClipboardNotice);
      }

      templateModalSystemInfo.hidden = false;
      templateModalSystemInfo.textContent = notices.join(" · ");
    } else {
      templateModalSystemInfo.hidden = true;
      templateModalSystemInfo.textContent = "";
    }

    const userVariables = modalState.variables.filter((variable) => variable.kind === "user");
    templateFields.innerHTML = userVariables
      .map((variable) => {
        const value = modalState.userValues[variable.name] ?? "";
        return `
          <label class="field-stack">
            <span>${escapeHtml(t.templateFieldLabel(variable.name))}</span>
            <input
              class="search-input"
              type="text"
              data-template-input="${escapeAttribute(variable.name)}"
              value="${escapeAttribute(value)}"
              placeholder="${escapeAttribute(t.templateFieldPlaceholder(variable.name))}"
            />
          </label>
        `;
      })
      .join("");

    const previewState = buildTemplateSendPreviewStateV2();
    const errorMessage = previewState?.clipboardMissing
      ? t.templateClipboardError
      : previewState && previewState.missingUserValues.length > 0
        ? t.templateMissingValues
        : "";

    templatePreview.textContent = previewState?.preview ?? modalState.prompt;
    setTemplateModalError(errorMessage);
    templateModalConfirm.disabled = Boolean(errorMessage);
  }

  async function openTemplateModalV2(
    prompt: string,
    targets: ComposerTarget[],
  ): Promise<void> {
    const variables = deps.detectTemplateVariablesForTargets(targets);

    if (variables.length === 0) {
      await maybeMarkLoadedFavoriteAsUsed();
      await deps.sendResolvedPrompt(prompt, deps.buildResolvedBroadcastTargets(targets));
      return;
    }

    const baseDefaults = mergeTemplateSources(
      state.templateVariableCache,
      state.loadedTemplateDefaults,
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

    if (variables.some((variable) => variable.name === SYSTEM_TEMPLATE_VARIABLES.clipboard)) {
      const clipboardResult = await readClipboardTemplateValue();
      if (clipboardResult.ok) {
        systemValues[SYSTEM_TEMPLATE_VARIABLES.clipboard] = clipboardResult.text;
      }
    }

    state.pendingTemplateSend = {
      prompt,
      targets,
      variables,
      userValues,
      systemValues,
    };

    renderTemplateModalV2();
    deps.openOverlay(templateModal, templateFields.querySelector("input") ?? templateModalConfirm);
  }

  async function confirmTemplateModalSend(): Promise<void> {
    const modalState = state.pendingTemplateSend;
    if (!modalState) {
      return;
    }

    renderTemplateModalV2();
    const previewState = buildTemplateSendPreviewStateV2();

    if (!previewState || previewState.missingUserValues.length > 0 || previewState.clipboardMissing) {
      return;
    }

    const cachedValues = compactVariableValues(modalState.userValues);
    await updateTemplateVariableCache(cachedValues);
    state.templateVariableCache = mergeTemplateSources(state.templateVariableCache, cachedValues);

    const resolvedTargets = deps.buildResolvedBroadcastTargets(modalState.targets, previewState.values);
    hideTemplateModal();
    await maybeMarkLoadedFavoriteAsUsed();
    await deps.sendResolvedPrompt(modalState.prompt, resolvedTargets);
  }

  function bindTemplateModalEvents(
    onError: (message: string) => void,
  ): void {
    templateModalClose.addEventListener("click", hideTemplateModal);
    templateModalCancel.addEventListener("click", hideTemplateModal);
    templateModal.addEventListener("click", (event) => {
      if (event.target === templateModal) {
        hideTemplateModal();
      }
    });
    templateFields.addEventListener("input", (event) => {
      const input = event.target instanceof Element
        ? event.target.closest<HTMLInputElement>("[data-template-input]")
        : null;
      const templateInput = input?.dataset.templateInput;
      if (!input || !templateInput || !state.pendingTemplateSend) {
        return;
      }

      state.pendingTemplateSend.userValues[templateInput] = input.value;
      renderTemplateModalV2();
    });
    templateModalConfirm.addEventListener("click", () => {
      void confirmTemplateModalSend().catch((error) => {
        console.error("[AI Prompt Broadcaster] Template modal confirm failed.", error);
        onError(t.error(error instanceof Error ? error.message : getUnknownErrorText()));
      });
    });
  }

  return {
    hideTemplateModal,
    setTemplateModalError,
    openTemplateModalV2,
    bindTemplateModalEvents,
    requestFavoriteRun,
  };
}
