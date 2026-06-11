// @ts-nocheck
import { updateAppSettings } from "../../../shared/prompts";
import { getRuntimeSites, updateRuntimeSite } from "../../../shared/sites";
import { sortSitesByOrder } from "../../../shared/sites/order";
import { t } from "../../app/i18n";
import { state } from "../../app/state";
import { renderServiceFilterOptions } from "../../core/service-filter";
import { setStatus, showAppToast } from "../../core/status";
import { renderServicesSection } from "./rendering";

export async function saveSiteWaitMs(siteId, waitMs) {
  await updateRuntimeSite(siteId, { waitMs: Number(waitMs) });
  state.runtimeSites = sortSitesByOrder(await getRuntimeSites(), state.settings.siteOrder);
  renderServiceFilterOptions();
  renderServicesSection();
  showAppToast(t.settings.waitSaved, "success", 1600);
}

export function moveRuntimeSite(siteId, direction) {
  const currentIndex = state.runtimeSites.findIndex((site) => site.id === siteId);
  if (currentIndex === -1) {
    return null;
  }

  const offset = direction === "up" ? -1 : 1;
  const nextIndex = currentIndex + offset;
  if (nextIndex < 0 || nextIndex >= state.runtimeSites.length) {
    return null;
  }

  const nextSites = [...state.runtimeSites];
  const [movedSite] = nextSites.splice(currentIndex, 1);
  nextSites.splice(nextIndex, 0, movedSite);
  return nextSites;
}

export async function saveSiteOrder(siteId, direction) {
  const nextSites = moveRuntimeSite(siteId, direction);
  if (!nextSites) {
    return;
  }

  const nextSettings = await updateAppSettings({
    siteOrder: nextSites.map((site) => site.id),
  });
  state.settings = nextSettings;
  state.runtimeSites = nextSites;
  renderServiceFilterOptions();
  renderServicesSection();
  setStatus(t.services.orderSaved, "success");
  showAppToast(t.services.orderSaved, "success", 1600);
}
