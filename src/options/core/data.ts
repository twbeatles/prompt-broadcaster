// @ts-nocheck
import {
  getAppSettings,
  getComparisonNotes,
  getPromptFavorites,
  getPromptExperiments,
  getServiceGroups,
  getStoredPromptHistory,
  getTemplatePacks,
} from "../../shared/prompts";
import { sendRuntimeMessageWithTimeout } from "../../shared/chrome/messaging";
import { getFavoriteRunJobs, getStrategyStats } from "../../shared/runtime-state";
import { getRuntimeSites } from "../../shared/sites";
import { sortSitesByOrder } from "../../shared/sites/order";
import { state } from "../app/state";
import { renderDashboard } from "../features/dashboard";
import { renderHistoryTable } from "../features/history";
import { renderSchedulesSection } from "../features/schedules";
import { renderServicesSection } from "../features/services";
import { renderExperimentsSection } from "../features/experiments";
import { renderTemplatePacksSection } from "../features/template-packs";
import { applySettingsToControls } from "../features/settings";
import { renderServiceFilterOptions } from "./service-filter";

export async function loadData() {
  const [
    history,
    favorites,
    favoriteJobs,
    settings,
    runtimeSites,
    strategyStats,
    comparisonNotes,
    promptExperiments,
    templatePacks,
    serviceGroups,
    serviceHealth,
  ] = await Promise.all([
    getStoredPromptHistory(),
    getPromptFavorites(),
    getFavoriteRunJobs(),
    getAppSettings(),
    getRuntimeSites(),
    getStrategyStats(),
    getComparisonNotes(),
    getPromptExperiments(),
    getTemplatePacks(),
    getServiceGroups(),
    sendRuntimeMessageWithTimeout({ action: "service-health:get" }, 5000, {
      ok: false,
      snapshots: [],
    }),
  ]);

  state.history = history;
  state.favorites = favorites;
  state.favoriteJobs = favoriteJobs;
  state.strategyStats = strategyStats;
  state.comparisonNotes = comparisonNotes;
  state.promptExperiments = promptExperiments;
  state.templatePacks = templatePacks;
  state.serviceGroups = serviceGroups;
  state.serviceHealthSnapshots = serviceHealth?.snapshots ?? [];
  state.selectedHistoryIds.clear();
  state.runtimeSites = sortSitesByOrder(runtimeSites, settings.siteOrder);
  state.settings = settings;
  renderServiceFilterOptions();
  renderDashboard();
  renderHistoryTable();
  renderSchedulesSection();
  renderServicesSection();
  renderExperimentsSection();
  renderTemplatePacksSection();
  applySettingsToControls();
}
