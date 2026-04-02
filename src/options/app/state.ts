// @ts-nocheck
import { DEFAULT_SETTINGS } from "../../shared/prompts";

export const state = {
  history: [],
  favorites: [],
  runtimeSites: [],
  settings: { ...DEFAULT_SETTINGS },
  activeSection: "dashboard",
  historyPage: 1,
  selectedHistoryIds: new Set(),
  pendingImportSummary: null,
  filters: {
    service: "all",
    dateFrom: "",
    dateTo: "",
  },
};
