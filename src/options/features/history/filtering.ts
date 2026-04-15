// @ts-nocheck
import { applyHistoryVisibleLimit } from "../../../shared/prompts";
import { getLocalDateKey } from "../../../shared/date-utils";
import { state } from "../../app/state";
import { getRequestedServices } from "../../app/helpers";

export const PAGE_SIZE = 10;

export function filteredHistory() {
  return state.history.filter((entry) => {
    const requestedServices = getRequestedServices(entry);
    const matchesService =
      state.filters.service === "all" || requestedServices.includes(state.filters.service);
    const dateKey = getLocalDateKey(entry.createdAt);
    const matchesFrom = !state.filters.dateFrom || dateKey >= state.filters.dateFrom;
    const matchesTo = !state.filters.dateTo || dateKey <= state.filters.dateTo;
    return matchesService && matchesFrom && matchesTo;
  });
}

export function getVisibleFilteredHistory() {
  return applyHistoryVisibleLimit(filteredHistory(), state.settings.historyLimit);
}

export function syncHistorySelectionState() {
  const availableIds = new Set(getVisibleFilteredHistory().map((entry) => Number(entry.id)));
  state.selectedHistoryIds = new Set(
    [...state.selectedHistoryIds].filter((historyId) => availableIds.has(Number(historyId))),
  );
}
