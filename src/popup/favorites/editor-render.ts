import { popupDom } from "../app/dom";
import { escapeAttribute, escapeHtml, normalizeSiteIdList } from "../app/helpers";
import { t } from "../app/i18n";
import { state } from "../app/state";
import { syncFavoriteEditorVariables, toLocalDateTimeInputValue } from "./editor-state";

const {
  favoriteModalTitle,
  favoriteModalDesc,
  favoriteTitleLabel,
  favoriteTitleInput,
  favoriteModeLabel,
  favoriteModeSelect,
  favoritePromptWrap,
  favoritePromptLabel,
  favoritePromptInput,
  favoriteTargetsLabel,
  favoriteTargetsList,
  favoriteTagsLabel,
  favoriteTagsInput,
  favoriteFolderLabel,
  favoriteFolderInput,
  favoritePinnedInput,
  favoritePinnedLabel,
  favoriteScheduleEnabled,
  favoriteScheduleEnabledLabel,
  favoriteScheduleFields,
  favoriteScheduledAtLabel,
  favoriteScheduledAtInput,
  favoriteScheduleRepeatLabel,
  favoriteScheduleRepeatSelect,
  favoriteSaveDefaults,
  favoriteSaveDefaultsLabel,
  favoriteSaveDefaultsRow,
  favoriteDefaultFieldsWrap,
  favoriteDefaultFieldsLabel,
  favoriteDefaultFields,
  favoriteChainWrap,
  favoriteChainTitle,
  favoriteChainDesc,
  favoriteChainList,
  favoriteChainAddStep,
  favoriteModalError,
  favoriteModalCancel,
  favoriteModalRun,
  favoriteModalConfirm,
} = popupDom.modals;

interface FavoriteEditorRendererDeps {
  getEnabledSites: () => Array<{ id: string }>;
  getRuntimeSiteLabel: (siteId: string) => string;
}

export function createFavoriteEditorRenderer(
  deps: FavoriteEditorRendererDeps,
) {
  function setFavoriteModalError(message = ""): void {
    favoriteModalError.hidden = !message;
    favoriteModalError.textContent = message;
  }

  function renderFavoriteDefaultFields(): void {
    const modalState = state.pendingFavoriteSave;
    if (!modalState) {
      favoriteDefaultFieldsWrap.hidden = true;
      favoriteDefaultFields.innerHTML = "";
      return;
    }

    const showDefaults = modalState.variables.length > 0 && modalState.saveDefaults;
    favoriteDefaultFieldsWrap.hidden = !showDefaults;

    if (!showDefaults) {
      favoriteDefaultFields.innerHTML = "";
      return;
    }

    favoriteDefaultFields.innerHTML = modalState.variables
      .map((variable) => {
        const value = modalState.defaultValues[variable.name] ?? "";
        return `
          <label class="field-stack">
            <span>${escapeHtml(variable.name)}</span>
            <input
              class="search-input"
              type="text"
              data-favorite-default-input="${escapeAttribute(variable.name)}"
              value="${escapeAttribute(value)}"
              placeholder="${escapeAttribute(t.templateFieldPlaceholder(variable.name))}"
            />
          </label>
        `;
      })
      .join("");
  }

  function syncFavoriteVariableUi(): void {
    const modalState = state.pendingFavoriteSave;
    if (!modalState) {
      return;
    }

    syncFavoriteEditorVariables(modalState);
    favoriteSaveDefaults.checked = modalState.saveDefaults;
    favoriteSaveDefaultsRow.hidden = modalState.variables.length === 0;
    renderFavoriteDefaultFields();
  }

  function buildFavoriteTargetChecklist(
    selectedSiteIds: string[] = [],
    options: { stepId?: string } = {},
  ): string {
    const { stepId = "" } = options;
    const selected = new Set(normalizeSiteIdList(selectedSiteIds));
    return deps.getEnabledSites()
      .map((site) => {
        const checked = selected.has(site.id);
        const attributeName = stepId
          ? "data-favorite-step-target"
          : "data-favorite-target";
        return `
          <label class="checkbox-chip">
            <input
              type="checkbox"
              ${attributeName}="${escapeAttribute(stepId || site.id)}"
              data-site-id="${escapeAttribute(site.id)}"
              ${checked ? "checked" : ""}
            />
            <span>${escapeHtml(deps.getRuntimeSiteLabel(site.id))}</span>
          </label>
        `;
      })
      .join("");
  }

  function renderFavoriteTargets(): void {
    const modalState = state.pendingFavoriteSave;
    if (!modalState) {
      favoriteTargetsList.innerHTML = "";
      return;
    }

    favoriteTargetsList.innerHTML = buildFavoriteTargetChecklist(modalState.sites);
  }

  function renderFavoriteChainList(): void {
    const modalState = state.pendingFavoriteSave;
    if (!modalState || modalState.mode !== "chain") {
      favoriteChainList.innerHTML = "";
      favoriteChainWrap.hidden = true;
      return;
    }

    favoriteChainWrap.hidden = false;
    favoriteChainList.innerHTML = modalState.steps
      .map((step, index) => `
        <article class="favorite-step-card" data-favorite-step-id="${escapeAttribute(step.id)}">
          <div class="section-row section-row-start">
            <strong>${escapeHtml(t.favoriteStepLabel(index + 1))}</strong>
            <div class="favorite-step-actions">
              <button class="ghost-button small-button" type="button" data-favorite-step-move="${escapeAttribute(step.id)}" data-direction="up" ${index === 0 ? "disabled" : ""}>${escapeHtml(t.favoriteStepMoveUp)}</button>
              <button class="ghost-button small-button" type="button" data-favorite-step-move="${escapeAttribute(step.id)}" data-direction="down" ${index === modalState.steps.length - 1 ? "disabled" : ""}>${escapeHtml(t.favoriteStepMoveDown)}</button>
              <button class="ghost-button danger-button small-button" type="button" data-favorite-step-delete="${escapeAttribute(step.id)}">${escapeHtml(t.delete)}</button>
            </div>
          </div>
          <label class="field-stack">
            <span>${escapeHtml(t.favoriteStepPromptLabel)}</span>
            <textarea class="search-input textarea-input" rows="3" data-favorite-step-text="${escapeAttribute(step.id)}">${escapeHtml(step.text)}</textarea>
          </label>
          <label class="field-stack">
            <span>${escapeHtml(t.favoriteStepDelayLabel)}</span>
            <input class="search-input" type="number" min="0" step="100" data-favorite-step-delay="${escapeAttribute(step.id)}" value="${escapeAttribute(String(step.delayMs))}" />
          </label>
          <div class="modal-section">
            <div class="section-row section-row-start">
              <strong>${escapeHtml(t.favoriteStepTargetsLabel)}</strong>
            </div>
            <div class="favorite-targets-list">
              ${buildFavoriteTargetChecklist(step.targetSiteIds, { stepId: step.id })}
            </div>
            <p class="helper-text">${escapeHtml(t.favoriteStepTargetsHint)}</p>
          </div>
        </article>
      `)
      .join("");
  }

  function renderFavoriteModal(): void {
    const modalState = state.pendingFavoriteSave;
    if (!modalState) {
      return;
    }

    syncFavoriteEditorVariables(modalState);

    favoriteModalTitle.textContent = modalState.favoriteId
      ? t.favoriteEditTitle
      : t.favoriteModalTitle;
    favoriteModalDesc.textContent = modalState.favoriteId
      ? t.favoriteEditDesc
      : t.favoriteModalDesc;
    favoriteModalCancel.textContent = t.favoriteModalCancel;
    favoriteModalConfirm.textContent = modalState.favoriteId
      ? t.favoriteModalSaveChanges
      : t.favoriteModalConfirm;
    favoriteModalRun.textContent = t.favoriteRunNow;
    favoriteModalRun.hidden = !modalState.favoriteId;
    favoriteTitleLabel.textContent = t.favoriteTitleLabel;
    favoriteModeLabel.textContent = t.favoriteModeLabel;
    favoriteTargetsLabel.textContent = t.favoriteTargetsLabel;
    favoritePromptLabel.textContent = t.favoritePromptLabel;
    favoriteTagsLabel.textContent = t.favoriteTagsLabel;
    favoriteFolderLabel.textContent = t.favoriteFolderLabel;
    favoritePinnedLabel.textContent = t.favoritePinnedLabel;
    favoriteScheduleEnabledLabel.textContent = t.favoriteScheduleEnabledLabel;
    favoriteScheduledAtLabel.textContent = t.favoriteScheduledAtLabel;
    favoriteScheduleRepeatLabel.textContent = t.favoriteScheduleRepeatLabel;
    favoriteSaveDefaultsLabel.textContent = t.favoriteSaveDefaultsLabel;
    favoriteDefaultFieldsLabel.textContent = t.favoriteDefaultsLabel;
    favoriteChainTitle.textContent = t.favoriteChainTitle;
    favoriteChainDesc.textContent = t.favoriteChainDesc;
    favoriteChainAddStep.textContent = t.favoriteChainAddStep;
    favoriteTitleInput.value = modalState.title;
    favoriteModeSelect.innerHTML = [
      `<option value="single">${escapeHtml(t.favoriteModeSingle)}</option>`,
      `<option value="chain">${escapeHtml(t.favoriteModeChain)}</option>`,
    ].join("");
    favoriteModeSelect.value = modalState.mode;
    favoritePromptWrap.hidden = modalState.mode !== "single";
    favoritePromptInput.value = modalState.prompt;
    favoriteTagsInput.value = modalState.tags.join(", ");
    favoriteFolderInput.value = modalState.folder;
    favoritePinnedInput.checked = Boolean(modalState.pinned);
    favoriteScheduleEnabled.checked = Boolean(modalState.scheduleEnabled);
    favoriteScheduledAtInput.value = toLocalDateTimeInputValue(modalState.scheduledAt ?? "");
    favoriteScheduleRepeatSelect.innerHTML = [
      `<option value="none">${escapeHtml(t.favoriteScheduleRepeatNone)}</option>`,
      `<option value="daily">${escapeHtml(t.favoriteScheduleRepeatDaily)}</option>`,
      `<option value="weekday">${escapeHtml(t.favoriteScheduleRepeatWeekday)}</option>`,
      `<option value="weekly">${escapeHtml(t.favoriteScheduleRepeatWeekly)}</option>`,
    ].join("");
    favoriteScheduleRepeatSelect.value = modalState.scheduleRepeat;
    favoriteScheduleFields.hidden = !modalState.scheduleEnabled;
    favoriteSaveDefaults.checked = modalState.saveDefaults;
    favoriteSaveDefaultsRow.hidden = modalState.variables.length === 0;
    renderFavoriteTargets();
    renderFavoriteChainList();
    renderFavoriteDefaultFields();
  }

  return {
    setFavoriteModalError,
    renderFavoriteDefaultFields,
    syncFavoriteVariableUi,
    renderFavoriteTargets,
    renderFavoriteChainList,
    renderFavoriteModal,
  };
}
