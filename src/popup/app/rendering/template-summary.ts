import { detectTemplateVariables, getTemplateVariableDisplayName } from "../../../shared/template";
import type { TemplateVariableDescriptor } from "../../../shared/types/models";
import { popupDom } from "../dom";
import { escapeHtml } from "../helpers";
import { t, uiLanguage } from "../i18n";
import { state } from "../state";
import type { PopupRenderingDeps } from "./types";

const { promptInput, templateSummary, templateSummaryLabel, templateChipList } =
  popupDom.compose;

export function createTemplateSummaryRenderer(deps: PopupRenderingDeps) {
  function getTemplateDisplayName(name: string): string {
    return getTemplateVariableDisplayName(name, uiLanguage);
  }

  function currentPromptVariables(): TemplateVariableDescriptor[] {
    const checkedTargets = deps.buildComposerBroadcastTargets(
      deps.checkedSiteIds(),
      promptInput.value,
    );
    if (checkedTargets.length === 0) {
      return detectTemplateVariables(promptInput.value);
    }

    return deps.detectTemplateVariablesForTargets(checkedTargets);
  }

  function renderTemplateSummary(): void {
    const variables = currentPromptVariables();

    templateSummary.hidden = variables.length === 0;

    if (variables.length === 0) {
      templateSummaryLabel.textContent = "";
      templateChipList.innerHTML = "";
      return;
    }

    templateSummaryLabel.textContent = t.templateSummary(variables.length);
    templateChipList.innerHTML = variables
      .map((variable) => {
        const kindLabel =
          variable.kind === "system" ? t.templateSystemKind : t.templateUserKind;
        const variableLabel =
          variable.kind === "system"
            ? getTemplateDisplayName(variable.name)
            : variable.name;
        return `
          <span class="template-chip ${variable.kind}">
            <span>{{${escapeHtml(variableLabel)}}}</span>
            <span class="template-chip-kind">${escapeHtml(kindLabel)}</span>
          </span>
        `;
      })
      .join("");
  }

  return {
    renderTemplateSummary,
  };
}
