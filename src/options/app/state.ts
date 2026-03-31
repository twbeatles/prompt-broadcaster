// @ts-nocheck
import { DEFAULT_SETTINGS } from "../../shared/prompts";

export const state = {
  history: [],
  runtimeSites: [],
  settings: { ...DEFAULT_SETTINGS },
  activeSection: "dashboard",
  historyPage: 1,
  filters: {
    service: "all",
    dateFrom: "",
    dateTo: "",
  },
};
