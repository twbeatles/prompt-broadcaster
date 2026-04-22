import { createSitePanelRenderer } from "./rendering/site-panel";
import { renderSortControls } from "./rendering/sort-controls";
import { createTabLabelsRenderer } from "./rendering/tab-labels";
import { createTemplateSummaryRenderer } from "./rendering/template-summary";
import type { PopupRenderingDeps } from "./rendering/types";

export function createPopupRendering(deps: PopupRenderingDeps) {
  const templateSummaryRenderer = createTemplateSummaryRenderer(deps);
  const { renderTemplateSummary } = templateSummaryRenderer;
  const tabLabelsRenderer = createTabLabelsRenderer(deps);
  const sitePanelRenderer = createSitePanelRenderer(deps, renderTemplateSummary);

  return {
    renderSortControls,
    renderTemplateSummary,
    renderTabLabels: tabLabelsRenderer.renderTabLabels,
    renderSiteCheckboxesPanel: sitePanelRenderer.renderSiteCheckboxesPanel,
  };
}
