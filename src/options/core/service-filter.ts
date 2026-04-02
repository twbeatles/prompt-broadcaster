// @ts-nocheck
import { escapeHTML } from "../../shared/security";
import { optionsDom } from "../app/dom";
import { t } from "../app/i18n";
import { state } from "../app/state";

const { historyServiceFilter } = optionsDom.history;

export function renderServiceFilterOptions() {
  historyServiceFilter.innerHTML = [
    `<option value="all">${escapeHTML(t.history.allServices)}</option>`,
    ...state.runtimeSites.map((site) => `<option value="${site.id}">${escapeHTML(site.name)}</option>`),
  ].join("");
  historyServiceFilter.value = state.filters.service;
}
