import type {
  PromptExperiment,
  PromptExperimentVariableSet,
  PromptExperimentVariant,
} from "../../../shared/types/models";

export interface ExperimentDom {
  experimentTitle: HTMLInputElement | null;
  experimentVariants: HTMLTextAreaElement | null;
  experimentVariables: HTMLTextAreaElement | null;
  experimentTargets: HTMLElement | null;
  experimentPreview: HTMLElement | null;
  experimentSave: HTMLElement | null;
  experimentRun: HTMLElement | null;
  experimentPreviewOutput: HTMLElement | null;
  experimentList: HTMLElement | null;
}

export type PromptExperimentDraft = Partial<PromptExperiment> &
  Pick<PromptExperiment, "title" | "description" | "variants" | "targetSiteIds" | "variableSets">;

export interface ExperimentPreviewItem {
  variant: PromptExperimentVariant;
  variableSet: PromptExperimentVariableSet;
  prompt: string;
  targetSiteIds: string[];
}
