// @ts-nocheck
import {
  getAppSettings,
  getPromptFavorites,
  getPromptHistory,
} from "../../shared/prompts";
import { getRuntimeSites } from "../../shared/sites";
import { state } from "../app/state";
import { renderDashboard } from "../features/dashboard";
import { renderHistoryTable } from "../features/history";
import { renderSchedulesSection } from "../features/schedules";
import { renderServicesSection } from "../features/services";
import { applySettingsToControls } from "../features/settings";
import { renderServiceFilterOptions } from "./service-filter";

export async function loadData() {
  const [history, favorites, settings, runtimeSites] = await Promise.all([
    getPromptHistory(),
    getPromptFavorites(),
    getAppSettings(),
    getRuntimeSites(),
  ]);

  state.history = history;
  state.favorites = favorites;
  state.selectedHistoryIds.clear();
  state.runtimeSites = runtimeSites;
  state.settings = settings;
  renderServiceFilterOptions();
  renderDashboard();
  renderHistoryTable();
  renderSchedulesSection();
  renderServicesSection();
  applySettingsToControls();
}
