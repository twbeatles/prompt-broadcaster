// @ts-nocheck
import { setServiceGroups } from "../../../shared/prompts";
import { escapeHTML } from "../../../shared/security";
import { t } from "../../app/i18n";
import { state } from "../../app/state";
import { showAppToast } from "../../core/status";
import {
  serviceGroupsList,
  serviceGroupTitle,
  servicesGrid,
} from "./dom";

export function renderServiceGroups() {
  if (!serviceGroupsList) {
    return;
  }

  if (!state.serviceGroups?.length) {
    serviceGroupsList.innerHTML = `<div class="empty-state">${escapeHTML(t.services.groupEmpty)}</div>`;
    return;
  }

  serviceGroupsList.innerHTML = state.serviceGroups.map((group) => {
    const names = group.serviceIds
      .map((siteId) => state.runtimeSites.find((site) => site.id === siteId)?.name || siteId)
      .join(", ");
    return `
      <article class="service-health-row">
        <div>
          <strong>${escapeHTML(group.title)}</strong>
          <div class="helper">${escapeHTML(names || t.services.groupNoServices)}</div>
        </div>
        <div class="settings-actions">
          <button class="btn ghost" type="button" data-group-select="${escapeHTML(group.id)}">${escapeHTML(t.services.groupCheckServices)}</button>
          <button class="btn danger ghost" type="button" data-group-delete="${escapeHTML(group.id)}">${escapeHTML(t.services.groupDelete)}</button>
        </div>
      </article>
    `;
  }).join("");
}

export async function saveCheckedServiceGroup() {
  const selectedIds = [...servicesGrid.querySelectorAll("[data-service-group-select]:checked")]
    .map((input) => input.dataset.serviceGroupSelect)
    .filter(Boolean);
  const title = serviceGroupTitle.value.trim() || `Group ${state.serviceGroups.length + 1}`;
  if (selectedIds.length === 0) {
    showAppToast(t.services.groupNeedsService, "warning", 2200);
    return;
  }

  const now = new Date().toISOString();
  const existing = state.serviceGroups.find((group) => group.title === title);
  const nextGroup = {
    ...(existing ?? {}),
    id: existing?.id || `group-${Date.now()}`,
    title,
    serviceIds: selectedIds,
    sortOrder: existing?.sortOrder ?? state.serviceGroups.length,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  state.serviceGroups = await setServiceGroups([
    nextGroup,
    ...state.serviceGroups.filter((group) => group.id !== nextGroup.id),
  ]);
  renderServiceGroups();
  showAppToast(t.services.groupSaved, "success", 1600);
}

export function selectServiceGroup(groupId) {
  const group = state.serviceGroups.find((entry) => entry.id === groupId);
  const selected = new Set(group?.serviceIds ?? []);
  servicesGrid.querySelectorAll("[data-service-group-select]").forEach((input) => {
    input.checked = selected.has(input.dataset.serviceGroupSelect);
  });
  if (group && serviceGroupTitle) {
    serviceGroupTitle.value = group.title;
  }
}

export async function deleteServiceGroup(groupId) {
  state.serviceGroups = state.serviceGroups.filter((entry) => entry.id !== groupId);
  await setServiceGroups(state.serviceGroups);
  renderServiceGroups();
  showAppToast(t.services.groupDeleted, "success", 1600);
}
