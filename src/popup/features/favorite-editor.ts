// @ts-nocheck
import {
  createFavoritePrompt,
  getPromptFavorites,
  updateFavoritePrompt,
  updateTemplateVariableCache,
} from "../../shared/prompts";
import { detectTemplateVariables } from "../../shared/template";
import { popupDom } from "../app/dom";
import { escapeAttribute, escapeHtml, normalizeSiteIdList } from "../app/helpers";
import { t } from "../app/i18n";
import { state } from "../app/state";

const { promptInput } = popupDom.compose;
const {
  favoriteModal,
  favoriteModalTitle,
  favoriteModalDesc,
  favoriteModalClose,
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

function compactVariableValues(values) {
  return Object.fromEntries(
    Object.entries(values ?? {})
      .map(([name, value]) => [String(name), String(value ?? "")])
      .filter(([, value]) => value.trim()),
  );
}

function mergeTemplateSources(...sources) {
  return Object.assign({}, ...sources.filter(Boolean));
}

export function createFavoriteEditorFeature(deps) {
  const {
    checkedSiteIds,
    getEnabledSites,
    getRuntimeSiteLabel,
    refreshStoredData,
    requestFavoriteRun,
    setStatus,
    showAppToast,
    getUnknownErrorText,
    openOverlay,
    closeOverlay,
  } = deps;

  function createFavoriteEditorStep(text = "", targetSiteIds = [], delayMs = 0, preferredId = "") {
    return {
      id:
        typeof preferredId === "string" && preferredId.trim()
          ? preferredId.trim()
          : `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: String(text ?? ""),
      delayMs: Math.max(0, Math.round(Number(delayMs) || 0)),
      targetSiteIds: normalizeSiteIdList(targetSiteIds),
    };
  }

  function toLocalDateTimeInputValue(isoString = "") {
    const time = Date.parse(String(isoString ?? ""));
    if (!Number.isFinite(time)) {
      return "";
    }

    const date = new Date(time);
    const pad = (value) => String(value).padStart(2, "0");
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
    ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function toIsoDateTime(value = "") {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }

  function collectFavoriteEditorVariables(modalState) {
    const templates = modalState.mode === "chain"
      ? modalState.steps.map((step) => step.text)
      : [modalState.prompt];
    const seen = new Set();

    return templates
      .flatMap((template) => detectTemplateVariables(template))
      .filter((variable) => variable.kind === "user")
      .filter((variable) => {
        if (seen.has(variable.name)) {
          return false;
        }

        seen.add(variable.name);
        return true;
      });
  }

  function syncFavoriteEditorVariables(modalState) {
    const variables = collectFavoriteEditorVariables(modalState);
    const nextDefaults = {};

    variables.forEach((variable) => {
      nextDefaults[variable.name] = modalState.defaultValues?.[variable.name] ?? "";
    });

    modalState.variables = variables;
    modalState.defaultValues = nextDefaults;
    if (variables.length === 0) {
      modalState.saveDefaults = false;
    }
  }

  function syncFavoriteVariableUi(modalState) {
    syncFavoriteEditorVariables(modalState);
    favoriteSaveDefaults.checked = modalState.saveDefaults;
    favoriteSaveDefaultsRow.hidden = modalState.variables.length === 0;
    renderFavoriteDefaultFields();
  }

  function getFirstNonEmptyStepText(steps = []) {
    return steps.find((step) => step?.text?.trim())?.text ?? "";
  }

  function buildFavoriteTargetChecklist(selectedSiteIds = [], { stepId = "" } = {}) {
    const selected = new Set(normalizeSiteIdList(selectedSiteIds));
    return getEnabledSites()
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
            <span>${escapeHtml(getRuntimeSiteLabel(site.id))}</span>
          </label>
        `;
      })
      .join("");
  }

  function renderFavoriteTargets() {
    const modalState = state.pendingFavoriteSave;
    if (!modalState) {
      favoriteTargetsList.innerHTML = "";
      return;
    }

    favoriteTargetsList.innerHTML = buildFavoriteTargetChecklist(modalState.sites);
  }

  function renderFavoriteChainList() {
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

  function renderFavoriteDefaultFields() {
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

  function renderFavoriteModal() {
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
    favoriteScheduledAtInput.value = toLocalDateTimeInputValue(modalState.scheduledAt);
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

  function buildFavoriteEditorStateFromItem(item) {
    const baseDefaults = mergeTemplateSources(
      state.templateVariableCache,
      item?.templateDefaults ?? {},
    );
    const mode = item?.mode === "chain" ? "chain" : "single";
    const steps = mode === "chain" && Array.isArray(item?.steps) && item.steps.length > 0
      ? item.steps.map((step) => createFavoriteEditorStep(step.text, step.targetSiteIds, step.delayMs, step.id))
      : mode === "chain"
        ? [createFavoriteEditorStep(item?.text ?? "", [], 0)]
        : [];
    const stateValue = {
      favoriteId: item?.id ?? null,
      prompt: item?.text ?? "",
      sites: normalizeSiteIdList(item?.sentTo),
      variables: [],
      title: item?.title ?? "",
      saveDefaults: Boolean(item?.templateDefaults && Object.keys(item.templateDefaults).length > 0),
      defaultValues: { ...baseDefaults },
      tags: Array.isArray(item?.tags) ? [...item.tags] : [],
      folder: item?.folder ?? "",
      pinned: Boolean(item?.pinned),
      mode,
      steps,
      scheduleEnabled: Boolean(item?.scheduleEnabled),
      scheduledAt: item?.scheduledAt ?? null,
      scheduleRepeat: item?.scheduleRepeat ?? "none",
    };

    syncFavoriteEditorVariables(stateValue);
    return stateValue;
  }

  function getFavoriteById(favoriteId) {
    return state.favorites.find((entry) => String(entry.id) === String(favoriteId)) ?? null;
  }

  function setFavoriteModalError(message = "") {
    favoriteModalError.hidden = !message;
    favoriteModalError.textContent = message;
  }

  function hideFavoriteModal() {
    state.pendingFavoriteSave = null;
    state.pendingFavoriteRunReason = "";
    closeOverlay(favoriteModal);
    favoriteModalError.hidden = true;
    favoriteModalError.textContent = "";
    favoriteTitleInput.value = "";
    favoriteSaveDefaults.checked = false;
    favoriteSaveDefaultsRow.hidden = true;
    favoriteDefaultFieldsWrap.hidden = true;
    favoriteDefaultFields.innerHTML = "";
    favoritePromptInput.value = "";
  }

  function dismissFavoriteModal(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    hideFavoriteModal();
  }

  async function openFavoriteModal() {
    clearStatus();
    const prompt = promptInput.value.trim();

    if (!prompt) {
      setStatus(t.warnEmpty, "error");
      promptInput.focus();
      return;
    }

    const loadedFavorite = state.loadedFavoriteId ? getFavoriteById(state.loadedFavoriteId) : null;
    const currentItem = loadedFavorite
      ? {
          ...loadedFavorite,
          text: prompt,
          sentTo: checkedSiteIds(),
          templateDefaults: state.loadedTemplateDefaults,
        }
      : {
          id: state.loadedFavoriteId || null,
          title: state.loadedFavoriteTitle,
          text: prompt,
          sentTo: checkedSiteIds(),
          templateDefaults: state.loadedTemplateDefaults,
          tags: [],
          folder: "",
          pinned: false,
          mode: "single",
          steps: [],
          scheduleEnabled: false,
          scheduledAt: null,
          scheduleRepeat: "none",
        };

    state.pendingFavoriteSave = buildFavoriteEditorStateFromItem(currentItem);
    setFavoriteModalError("");
    state.pendingFavoriteRunReason = "";
    renderFavoriteModal();
    openOverlay(favoriteModal, favoriteTitleInput);
    window.requestAnimationFrame(() => favoriteTitleInput.select());
  }

  function openFavoriteEditor(item, { reason = "" } = {}) {
    state.pendingFavoriteSave = buildFavoriteEditorStateFromItem(item);
    state.pendingFavoriteRunReason = reason || "";
    setFavoriteModalError(reason);
    renderFavoriteModal();
    openOverlay(favoriteModal, favoriteTitleInput);
  }

  async function persistFavoriteEditorChanges() {
    const modalState = state.pendingFavoriteSave;
    if (!modalState) {
      return null;
    }

    modalState.title = favoriteTitleInput.value.trim();
    modalState.mode = favoriteModeSelect.value === "chain" ? "chain" : "single";
    if (modalState.mode === "single") {
      modalState.prompt = favoritePromptInput.value;
    }
    modalState.tags = favoriteTagsInput.value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    modalState.folder = favoriteFolderInput.value.trim();
    modalState.pinned = favoritePinnedInput.checked;
    modalState.scheduleEnabled = favoriteScheduleEnabled.checked;
    modalState.scheduledAt = modalState.scheduleEnabled
      ? toIsoDateTime(favoriteScheduledAtInput.value)
      : null;
    modalState.scheduleRepeat = favoriteScheduleRepeatSelect.value || "none";
    modalState.saveDefaults = favoriteSaveDefaults.checked;
    syncFavoriteEditorVariables(modalState);

    if (modalState.scheduleEnabled && !modalState.scheduledAt) {
      setFavoriteModalError(t.favoriteScheduleDateRequired);
      return null;
    }

    if (modalState.mode === "chain") {
      modalState.steps = modalState.steps
        .map((step) => createFavoriteEditorStep(step.text, step.targetSiteIds, step.delayMs, step.id))
        .filter((step) => step.text.trim());

      if (modalState.steps.length === 0) {
        setFavoriteModalError(t.favoriteChainNeedsStep);
        return null;
      }
    } else {
      if (!modalState.prompt.trim()) {
        setFavoriteModalError(t.warnEmpty);
        return null;
      }
    }

    const templateDefaults = modalState.saveDefaults
      ? compactVariableValues(modalState.defaultValues)
      : {};

    if (modalState.saveDefaults) {
      await updateTemplateVariableCache(templateDefaults);
      state.templateVariableCache = mergeTemplateSources(state.templateVariableCache, templateDefaults);
    }

    const favoritePayload = {
      title: modalState.title,
      text: modalState.mode === "chain"
        ? (modalState.steps[0]?.text ?? modalState.prompt ?? "")
        : modalState.prompt,
      sentTo: modalState.sites,
      templateDefaults,
      tags: modalState.tags,
      folder: modalState.folder,
      pinned: modalState.pinned,
      mode: modalState.mode,
      steps: modalState.mode === "chain" ? modalState.steps : [],
      scheduleEnabled: modalState.scheduleEnabled,
      scheduledAt: modalState.scheduleEnabled ? modalState.scheduledAt : null,
      scheduleRepeat: modalState.scheduleEnabled ? modalState.scheduleRepeat : "none",
    };

    let favorite = null;
    if (modalState.favoriteId) {
      favorite = await updateFavoritePrompt(modalState.favoriteId, favoritePayload);
    } else {
      favorite = await createFavoritePrompt(favoritePayload);
      modalState.favoriteId = favorite?.id ?? null;
    }

    await refreshStoredData();
    return favorite;
  }

  async function confirmFavoriteSave() {
    const favorite = await persistFavoriteEditorChanges();
    if (!favorite) {
      return;
    }

    hideFavoriteModal();
    setStatus(t.favoriteSaved, "success");
    showAppToast(t.favoriteSaved, "success", 2200);
  }

  async function runFavoriteItem(item, { reason = "" } = {}) {
    if (!item?.id) {
      return;
    }

    const response = await requestFavoriteRun(item, {
      trigger: "popup",
      allowPopupFallback: false,
    });

    if (response?.ok) {
      state.openMenuKey = null;
      const message = response?.message ?? t.favoriteRunQueued;
      setStatus(message, "success");
      showAppToast(message, "success", 2200);
      return;
    }

    if (response?.requiresPopupInput) {
      state.openMenuKey = null;
      openFavoriteEditor(item, { reason: response?.error || reason || t.favoriteRunNeedsEditor });
      return;
    }

    throw new Error(response?.error ?? getUnknownErrorText());
  }

  async function runFavoriteFromEditor() {
    const favorite = await persistFavoriteEditorChanges();
    if (!favorite?.id) {
      return;
    }

    const response = await requestFavoriteRun(favorite, {
      trigger: "popup",
      allowPopupFallback: false,
    });

    if (response?.ok) {
      hideFavoriteModal();
      const message = response?.message ?? t.favoriteRunQueued;
      setStatus(message, "success");
      showAppToast(message, "success", 2200);
      return;
    }

    if (response?.requiresPopupInput) {
      setFavoriteModalError(response?.error ?? t.favoriteRunNeedsEditor);
      return;
    }

    setFavoriteModalError(response?.error ?? getUnknownErrorText());
  }

  function bindFavoriteEditorEvents() {
    favoriteModalClose.addEventListener("click", dismissFavoriteModal);
    favoriteModalCancel.addEventListener("click", dismissFavoriteModal);
    favoriteModal.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const dismissButton = target?.closest("[data-dismiss-favorite-modal]");
      if (dismissButton || target === favoriteModal) {
        dismissFavoriteModal(event);
      }
    });
    favoriteModal.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !favoriteModal.hidden) {
        dismissFavoriteModal(event);
      }
    });
    favoriteSaveDefaults.addEventListener("change", () => {
      if (!state.pendingFavoriteSave) {
        return;
      }

      state.pendingFavoriteSave.saveDefaults = favoriteSaveDefaults.checked;
      renderFavoriteDefaultFields();
    });
    favoriteDefaultFields.addEventListener("input", (event) => {
      const input = event.target.closest("[data-favorite-default-input]");
      if (!input || !state.pendingFavoriteSave) {
        return;
      }

      state.pendingFavoriteSave.defaultValues[input.dataset.favoriteDefaultInput] = input.value;
    });
    favoriteModeSelect.addEventListener("change", () => {
      const modalState = state.pendingFavoriteSave;
      if (!modalState) {
        return;
      }

      const nextMode = favoriteModeSelect.value === "chain" ? "chain" : "single";
      if (nextMode === modalState.mode) {
        return;
      }

      if (nextMode === "chain") {
        const seedText = favoritePromptInput.value || modalState.prompt || promptInput.value || "";
        modalState.prompt = seedText;
        if (modalState.steps.length === 0) {
          modalState.steps = [createFavoriteEditorStep(seedText, [], 0)];
        } else if (!modalState.steps.some((step) => step.text.trim())) {
          modalState.steps = [createFavoriteEditorStep(seedText, [], 0)];
        }
      } else {
        modalState.prompt = getFirstNonEmptyStepText(modalState.steps) || favoritePromptInput.value || modalState.prompt;
      }

      modalState.mode = nextMode;
      setFavoriteModalError("");
      renderFavoriteModal();
    });
    favoriteScheduleEnabled.addEventListener("change", () => {
      const modalState = state.pendingFavoriteSave;
      if (!modalState) {
        return;
      }

      modalState.scheduleEnabled = favoriteScheduleEnabled.checked;
      if (modalState.scheduleEnabled && !modalState.scheduledAt) {
        const defaultDate = new Date(Date.now() + 10 * 60 * 1000);
        modalState.scheduledAt = defaultDate.toISOString();
        favoriteScheduledAtInput.value = toLocalDateTimeInputValue(modalState.scheduledAt);
      }
      favoriteScheduleFields.hidden = !modalState.scheduleEnabled;
    });
    favoriteScheduledAtInput.addEventListener("change", () => {
      if (!state.pendingFavoriteSave) {
        return;
      }

      state.pendingFavoriteSave.scheduledAt = toIsoDateTime(favoriteScheduledAtInput.value);
    });
    favoriteScheduleRepeatSelect.addEventListener("change", () => {
      if (!state.pendingFavoriteSave) {
        return;
      }

      state.pendingFavoriteSave.scheduleRepeat = favoriteScheduleRepeatSelect.value || "none";
    });
    favoritePromptInput.addEventListener("input", () => {
      const modalState = state.pendingFavoriteSave;
      if (!modalState) {
        return;
      }

      modalState.prompt = favoritePromptInput.value;
      syncFavoriteVariableUi(modalState);
      setFavoriteModalError("");
    });
    favoriteTargetsList.addEventListener("change", (event) => {
      const target = event.target.closest("[data-favorite-target][data-site-id]");
      if (!target || !state.pendingFavoriteSave) {
        return;
      }

      const siteId = target.dataset.siteId;
      const nextSelected = new Set(state.pendingFavoriteSave.sites);
      if (target.checked) {
        nextSelected.add(siteId);
      } else {
        nextSelected.delete(siteId);
      }
      state.pendingFavoriteSave.sites = [...nextSelected];
    });
    favoriteChainAddStep.addEventListener("click", () => {
      const modalState = state.pendingFavoriteSave;
      if (!modalState) {
        return;
      }

      modalState.steps.push(createFavoriteEditorStep("", [], 0));
      renderFavoriteModal();
      window.requestAnimationFrame(() => {
        const inputs = [...favoriteChainList.querySelectorAll("[data-favorite-step-text]")];
        inputs[inputs.length - 1]?.focus?.();
      });
    });
    favoriteChainList.addEventListener("input", (event) => {
      const modalState = state.pendingFavoriteSave;
      if (!modalState) {
        return;
      }

      const textInput = event.target.closest("[data-favorite-step-text]");
      if (textInput) {
        const step = modalState.steps.find((entry) => entry.id === textInput.dataset.favoriteStepText);
        if (step) {
          step.text = textInput.value;
          syncFavoriteVariableUi(modalState);
        }
        return;
      }

      const delayInput = event.target.closest("[data-favorite-step-delay]");
      if (delayInput) {
        const step = modalState.steps.find((entry) => entry.id === delayInput.dataset.favoriteStepDelay);
        if (step) {
          step.delayMs = Math.max(0, Math.round(Number(delayInput.value) || 0));
        }
      }
    });
    favoriteChainList.addEventListener("change", (event) => {
      const modalState = state.pendingFavoriteSave;
      if (!modalState) {
        return;
      }

      const target = event.target.closest("[data-favorite-step-target][data-site-id]");
      if (!target) {
        return;
      }

      const step = modalState.steps.find((entry) => entry.id === target.dataset.favoriteStepTarget);
      if (!step) {
        return;
      }

      const nextTargets = new Set(step.targetSiteIds);
      if (target.checked) {
        nextTargets.add(target.dataset.siteId);
      } else {
        nextTargets.delete(target.dataset.siteId);
      }
      step.targetSiteIds = [...nextTargets];
    });
    favoriteChainList.addEventListener("click", (event) => {
      const modalState = state.pendingFavoriteSave;
      if (!modalState) {
        return;
      }

      const deleteButton = event.target.closest("[data-favorite-step-delete]");
      if (deleteButton) {
        modalState.steps = modalState.steps.filter((step) => step.id !== deleteButton.dataset.favoriteStepDelete);
        renderFavoriteModal();
        return;
      }

      const moveButton = event.target.closest("[data-favorite-step-move]");
      if (!moveButton) {
        return;
      }

      const stepId = moveButton.dataset.favoriteStepMove;
      const index = modalState.steps.findIndex((step) => step.id === stepId);
      if (index === -1) {
        return;
      }

      const direction = moveButton.dataset.direction === "down" ? 1 : -1;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= modalState.steps.length) {
        return;
      }

      const [step] = modalState.steps.splice(index, 1);
      modalState.steps.splice(nextIndex, 0, step);
      renderFavoriteModal();
    });
    favoriteModalConfirm.addEventListener("click", () => {
      void confirmFavoriteSave().catch((error) => {
        console.error("[AI Prompt Broadcaster] Favorite save failed.", error);
        setFavoriteModalError(t.error(error?.message ?? getUnknownErrorText()));
      });
    });
    favoriteModalRun.addEventListener("click", () => {
      void runFavoriteFromEditor().catch((error) => {
        console.error("[AI Prompt Broadcaster] Favorite run failed.", error);
        setFavoriteModalError(t.error(error?.message ?? getUnknownErrorText()));
      });
    });
  }

  function clearStatus() {
    setStatus("");
  }

  return {
    getFavoriteById,
    setFavoriteModalError,
    hideFavoriteModal,
    dismissFavoriteModal,
    openFavoriteModal,
    openFavoriteEditor,
    confirmFavoriteSave,
    runFavoriteItem,
    runFavoriteFromEditor,
    bindFavoriteEditorEvents,
  };
}
