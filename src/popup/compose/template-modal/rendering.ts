import {
  SYSTEM_TEMPLATE_VARIABLES,
  getTemplateVariableDisplayName,
} from "../../../shared/template";
import { popupDom } from "../../app/dom";
import { escapeAttribute, escapeHtml } from "../../app/helpers";
import { t, uiLanguage } from "../../app/i18n";
import { state } from "../../app/state";
import { mergeTemplateSources } from "./helpers";
import type { PopupTemplateModalDeps } from "./types";

const {
  templateModalTitle,
  templateModalDesc,
  templateModalSystemInfo,
  templateFields,
  templatePreviewLabel,
  templatePreview,
  templateModalError,
  templateModalCancel,
  templateModalConfirm,
} = popupDom.modals;

interface PopupTemplateModalRendererDeps {
  buildTemplatePreviewText: PopupTemplateModalDeps["buildTemplatePreviewText"];
  findMissingTemplateValuesForTargets: PopupTemplateModalDeps["findMissingTemplateValuesForTargets"];
}

export function createPopupTemplateModalRenderer(
  deps: PopupTemplateModalRendererDeps,
) {
  function getTemplateDisplayName(name: string): string {
    return getTemplateVariableDisplayName(name, uiLanguage);
  }

  function setTemplateModalError(message = "") {
    templateModalError.hidden = !message;
    templateModalError.textContent = message;
  }

  function buildTemplateSendPreviewState(): {
    values: Record<string, string>;
    preview: string;
    missingUserValues: string[];
    clipboardMissing: boolean;
  } | null {
    const modalState = state.pendingTemplateSend;
    if (!modalState) {
      return null;
    }

    const values = mergeTemplateSources(
      modalState.systemValues,
      modalState.userValues,
    );
    const preview = deps.buildTemplatePreviewText(modalState.targets, values);
    const missingUserValues = deps.findMissingTemplateValuesForTargets(
      modalState.targets,
      modalState.userValues,
    );
    const clipboardRequired = modalState.variables.some(
      (variable) => variable.name === SYSTEM_TEMPLATE_VARIABLES.clipboard,
    );
    const clipboardMissing =
      clipboardRequired &&
      !String(
        modalState.systemValues[SYSTEM_TEMPLATE_VARIABLES.clipboard] ?? "",
      ).length;

    return {
      values,
      preview,
      missingUserValues,
      clipboardMissing,
    };
  }

  function renderTemplateModal(): void {
    const modalState = state.pendingTemplateSend;
    if (!modalState) {
      return;
    }

    templateModalTitle.textContent = t.templateModalTitle;
    templateModalDesc.textContent = t.templateModalDesc;
    templatePreviewLabel.textContent = t.templatePreviewLabel;
    templateModalCancel.textContent = t.templateModalCancel;
    templateModalConfirm.textContent = t.templateModalConfirm;

    const automaticVariables = modalState.variables.filter(
      (variable) => variable.kind === "system",
    );
    if (automaticVariables.length > 0) {
      const labels = automaticVariables
        .map((variable) => `{{${getTemplateDisplayName(variable.name)}}}`)
        .join(", ");
      const notices = [t.templateSystemNotice, labels];

      if (
        automaticVariables.some(
          (variable) => variable.name === SYSTEM_TEMPLATE_VARIABLES.clipboard,
        )
      ) {
        notices.push(t.templateClipboardNotice);
      }

      templateModalSystemInfo.hidden = false;
      templateModalSystemInfo.textContent = notices.join(" · ");
    } else {
      templateModalSystemInfo.hidden = true;
      templateModalSystemInfo.textContent = "";
    }

    const userVariables = modalState.variables.filter(
      (variable) => variable.kind === "user",
    );
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

    const previewState = buildTemplateSendPreviewState();
    const errorMessage = previewState?.clipboardMissing
      ? t.templateClipboardError
      : previewState && previewState.missingUserValues.length > 0
        ? t.templateMissingValues
        : "";

    templatePreview.textContent = previewState?.preview ?? modalState.prompt;
    setTemplateModalError(errorMessage);
    templateModalConfirm.disabled = Boolean(errorMessage);
  }

  return {
    setTemplateModalError,
    buildTemplateSendPreviewState,
    renderTemplateModal,
  };
}
