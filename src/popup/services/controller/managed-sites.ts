import { deleteCustomSite } from "../../../shared/sites";
import type { RuntimeSite } from "../../../shared/types/models";
import { popupDom } from "../../app/dom";
import {
  escapeAttribute,
  escapeHtml,
  getSiteIcon,
} from "../../app/helpers";
import { msg, t } from "../../app/i18n";
import { state } from "../../app/state";
import type { PopupServicesControllerDeps } from "./types";

const { managedSitesList } = popupDom.serviceManagement;

interface ManagedSitesControllerDeps {
  refreshStoredData: PopupServicesControllerDeps["refreshStoredData"];
  setStatus: PopupServicesControllerDeps["setStatus"];
  showAppToast: PopupServicesControllerDeps["showAppToast"];
  getErrorMessage: PopupServicesControllerDeps["getErrorMessage"];
  getSiteLastVerifiedStatus: PopupServicesControllerDeps["getSiteLastVerifiedStatus"];
  getSiteSelectorIssueUrl: PopupServicesControllerDeps["getSiteSelectorIssueUrl"];
}

export function createManagedSitesController(
  deps: ManagedSitesControllerDeps,
) {
  function buildManagedSiteMarkup(site: RuntimeSite): string {
    const chips = [
      `<span class="managed-site-chip">${escapeHtml(site.isBuiltIn ? t.serviceBuiltInBadge : t.serviceCustomBadge)}</span>`,
      `<span class="managed-site-chip">${escapeHtml(site.inputType)}</span>`,
      `<span class="managed-site-chip">${escapeHtml(`${site.waitMs}ms`)}</span>`,
    ];
    const selectorWarning = state.failedSelectors.get(site.id);
    const lastVerifiedStatus = deps.getSiteLastVerifiedStatus(site);
    const selectorWarningMarkup = selectorWarning
      ? `
        <div class="selector-report-row">
          <span class="selector-days-since">${escapeHtml(lastVerifiedStatus || (msg("popup_selector_warning_desc") || "Selector may have changed."))}</span>
          <a
            class="ghost-button small-button selector-report-link"
            href="${escapeAttribute(deps.getSiteSelectorIssueUrl(site))}"
            target="_blank"
            rel="noopener noreferrer"
            title="${escapeAttribute(msg("popup_selector_report_tooltip") || "Open GitHub Issues")}"
          >${escapeHtml(msg("popup_selector_report_btn") || "Report")}</a>
        </div>
      `
      : "";

    if (!site.enabled) {
      chips.push(
        `<span class="managed-site-chip">${escapeHtml(t.serviceDisabledLabel)}</span>`,
      );
    }

    return `
      <article class="managed-site-card" data-managed-site-id="${escapeAttribute(site.id)}">
        <div class="managed-site-head">
          <div class="managed-site-title">
            <span class="site-icon" style="--site-color:${escapeAttribute(site.color)}">${escapeHtml(getSiteIcon(site))}</span>
            <div class="managed-site-name-wrap">
              <span class="managed-site-name">${escapeHtml(site.name)}</span>
              <span class="managed-site-url">${escapeHtml(site.url)}</span>
            </div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" data-action="toggle-service" data-site-id="${escapeAttribute(site.id)}" ${site.enabled ? "checked" : ""} />
            <span>${escapeHtml(t.serviceFieldEnabled)}</span>
          </label>
        </div>
        <div class="managed-site-meta">${chips.join("")}</div>
        ${selectorWarningMarkup}
        <div class="managed-site-actions">
          <button class="ghost-button" type="button" data-action="edit-service" data-site-id="${escapeAttribute(site.id)}">${escapeHtml(t.serviceEdit)}</button>
          ${site.deletable ? `<button class="ghost-button danger-button" type="button" data-action="delete-service" data-site-id="${escapeAttribute(site.id)}">${escapeHtml(t.serviceDelete)}</button>` : ""}
        </div>
      </article>
    `;
  }

  function renderManagedSites(): void {
    if (state.runtimeSites.length === 0) {
      managedSitesList.innerHTML = `<div class="managed-site-empty">${escapeHtml(t.serviceEmptyList)}</div>`;
      return;
    }

    managedSitesList.innerHTML = state.runtimeSites
      .map((site) => buildManagedSiteMarkup(site))
      .join("");
  }

  async function deleteManagedSite(siteId: string): Promise<void> {
    try {
      await deleteCustomSite(siteId);
      await deps.refreshStoredData();
      deps.setStatus(t.serviceDeleted, "success");
      deps.showAppToast(t.serviceDeleted, "info", 2200);
    } catch (error) {
      console.error(
        "[AI Prompt Broadcaster] Failed to delete custom site.",
        error,
      );
      deps.setStatus(t.error(deps.getErrorMessage(error)), "error");
    }
  }

  return {
    buildManagedSiteMarkup,
    renderManagedSites,
    deleteManagedSite,
  };
}
