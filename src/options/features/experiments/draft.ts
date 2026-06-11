import type {
  PromptExperiment,
  PromptExperimentVariableSet,
  PromptExperimentVariant,
} from "../../../shared/types/models";
import { t } from "../../app/i18n";
import { state } from "../../app/state";
import { showAppToast } from "../../core/status";
import { dom } from "./dom";
import type { PromptExperimentDraft } from "./types";

export function parseVariantBlocks(): PromptExperimentVariant[] {
  const raw = dom.experimentVariants?.value || "";
  return raw
    .split(/\n---+\n/g)
    .map((text: string, index: number) => ({
      id: `variant-${index + 1}`,
      title: `Variant ${index + 1}`,
      text: text.trim(),
    }))
    .filter((variant) => variant.text);
}

export function parseVariableSets(): PromptExperimentVariableSet[] {
  const raw = dom.experimentVariables?.value.trim();
  if (!raw) {
    return [{ id: "vars-1", title: "Default", values: {} }];
  }

  try {
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries.map((values: unknown, index: number) => ({
      id: `vars-${index + 1}`,
      title: `Variables ${index + 1}`,
      values: values && typeof values === "object" && !Array.isArray(values)
        ? Object.fromEntries(
            Object.entries(values).map(([key, value]) => [String(key), String(value ?? "")]),
          )
        : {},
    }));
  } catch (_error) {
    showAppToast(t.experiments.invalidVariables, "warning", 2600);
    return [{ id: "vars-1", title: "Default", values: {} }];
  }
}

export function getSelectedTargetIds(): string[] {
  return Array.from(
    dom.experimentTargets?.querySelectorAll<HTMLInputElement>("[data-experiment-target]:checked") ?? [],
  )
    .map((input) => input.dataset.experimentTarget ?? "")
    .filter(Boolean);
}

export function buildDraftExperiment(existingId: string | null = null): PromptExperimentDraft {
  return {
    id: existingId || state.activeExperimentId || undefined,
    title: dom.experimentTitle?.value.trim() || `Experiment ${state.promptExperiments.length + 1}`,
    description: "",
    variants: parseVariantBlocks(),
    targetSiteIds: getSelectedTargetIds(),
    variableSets: parseVariableSets(),
  };
}

export function loadExperimentDraft(experiment: PromptExperiment): void {
  state.activeExperimentId = experiment.id;
  if (dom.experimentTitle) {
    dom.experimentTitle.value = experiment.title;
  }
  if (dom.experimentVariants) {
    dom.experimentVariants.value = experiment.variants.map((variant) => variant.text).join("\n---\n");
  }
  if (dom.experimentVariables) {
    dom.experimentVariables.value = JSON.stringify(
      experiment.variableSets.map((set) => set.values),
      null,
      2,
    );
  }
}
