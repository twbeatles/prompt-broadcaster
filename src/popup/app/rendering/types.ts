import type {
  OpenSiteTab,
  RuntimeSite,
  TemplateVariableDescriptor,
} from "../../../shared/types/models";
import type {
  PopupState,
  PopupTemplateSendState,
} from "../../../shared/types/popup";

export type ComposerTarget = NonNullable<PopupTemplateSendState["targets"]>[number];

export interface PopupRenderingDeps {
  buildComposerBroadcastTargets: (
    siteIds?: string[],
    basePrompt?: string,
  ) => ComposerTarget[];
  detectTemplateVariablesForTargets: (
    targets?: ComposerTarget[],
  ) => TemplateVariableDescriptor[];
  checkedSiteIds: () => string[];
  getEnabledSites: () => RuntimeSite[];
  getRuntimeSiteLabel: (siteId: string) => string;
  getOpenSiteTabs: (siteId: string) => OpenSiteTab[];
  getDefaultTargetModeLabel: () => string;
  syncToggleAllLabel: () => void;
  setCardStatesFromBroadcast: (
    summary: PopupState["lastBroadcast"],
  ) => void;
  applyDynamicPromptPlaceholder: () => void;
  updatePromptCounter: () => void;
}
