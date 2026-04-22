import { requestOriginPermissions } from "../../../shared/sites";
import type { PopupToastInput } from "../../../shared/types/popup";
import type {
  FavoritePrompt,
  PromptHistoryItem,
} from "../../../shared/types/models";
import { getHistorySelectedSiteIds } from "../list-markup";
import { popupDom } from "../dom";
import { t } from "../i18n";
import { state } from "../state";
import type { ComposerTarget, PopupTabId } from "./helpers";

const { promptInput } = popupDom.compose;

interface PopupComposerControllerDeps {
  clearStatus: () => void;
  scheduleComposeDraftSave: (value?: string) => void;
  applySiteSelection: (sentTo: unknown) => void;
  renderTemplateSummary: () => void;
  switchTab: (tabId: PopupTabId) => void;
  setStatus: (text: string, type?: string) => void;
  showAppToast: (input: PopupToastInput | string, type?: string, duration?: number) => string;
  checkedSiteIds: () => string[];
  buildComposerBroadcastTargets: (
    siteIds?: string[],
    basePrompt?: string,
  ) => ComposerTarget[];
  openTemplateModalV2: (
    prompt: string,
    targets: ComposerTarget[],
  ) => Promise<void>;
}

export function createPopupComposerController(
  deps: PopupComposerControllerDeps,
) {
  function setLoadedTemplateContext(
    item: Partial<FavoritePrompt> | PromptHistoryItem | null | undefined,
  ): void {
    const templateDefaults =
      item
      && "templateDefaults" in item
      && item.templateDefaults
      && typeof item.templateDefaults === "object"
        ? item.templateDefaults
        : {};
    const favoriteTitle =
      item && "title" in item && typeof item.title === "string" ? item.title : "";
    const favoriteId =
      item && "id" in item && typeof item.id === "string" ? item.id : "";
    state.loadedTemplateDefaults =
      templateDefaults && typeof templateDefaults === "object"
        ? { ...templateDefaults }
        : {};
    state.loadedFavoriteTitle = favoriteTitle;
    state.loadedFavoriteId = favoriteId;
  }

  function loadPromptIntoComposer(item: FavoritePrompt | PromptHistoryItem): void {
    promptInput.value = item.text;
    deps.scheduleComposeDraftSave(promptInput.value);
    deps.applySiteSelection(
      "requestedSiteIds" in item ? getHistorySelectedSiteIds(item) : item.sentTo,
    );
    setLoadedTemplateContext(item);
    deps.renderTemplateSummary();
    deps.switchTab("compose");
    promptInput.focus();
    deps.setStatus(t.importedLoad, "success");
    deps.showAppToast(t.importedLoad, "info", 2200);
  }

  async function handleSend() {
    if (state.isSending) {
      return;
    }

    deps.clearStatus();
    const prompt = promptInput.value.trim();

    if (!prompt) {
      deps.setStatus(t.warnEmpty, "error");
      deps.showAppToast(t.toastPromptEmpty, "warning", 2000);
      promptInput.focus();
      return;
    }

    const selectedSiteIds = deps.checkedSiteIds();
    if (selectedSiteIds.length === 0) {
      deps.setStatus(t.warnNoSite, "error");
      deps.showAppToast(t.toastNoService, "warning", 2000);
      return;
    }

    const composerTargets = deps.buildComposerBroadcastTargets(
      selectedSiteIds,
      prompt,
    );
    const selectedSites = state.runtimeSites.filter((site) =>
      selectedSiteIds.includes(site.id),
    );

    const customSitePermissionPatterns = Array.from(
      new Set(
        selectedSites
          .filter((site) => site.isCustom)
          .flatMap((site) =>
            Array.isArray(site.permissionPatterns) ? site.permissionPatterns : []
          )
          .filter(
            (pattern): pattern is string =>
              typeof pattern === "string" && pattern.trim().length > 0,
          ),
      ),
    );
    if (customSitePermissionPatterns.length > 0) {
      const permissionResult = await requestOriginPermissions(
        customSitePermissionPatterns,
      );
      if (!permissionResult.granted) {
        deps.setStatus(t.servicePermissionDenied, "error");
        deps.showAppToast(t.servicePermissionDenied, "error", 4000);
        return;
      }
    }

    await deps.openTemplateModalV2(prompt, composerTargets);
  }

  return {
    loadPromptIntoComposer,
    handleSend,
  };
}
