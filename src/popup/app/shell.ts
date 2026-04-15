import { setComposeDraftPrompt } from "../../shared/prompt-state";
import { showToast } from "../ui/toast";
import { popupDom } from "./dom";
import { msg, t } from "./i18n";
import { normalizeSiteIdList } from "./helpers";
import { state } from "./state";
import type {
  LastBroadcastSummary,
  RuntimeSite,
} from "../../shared/types/models";
import type {
  PopupState,
  PopupToastInput,
} from "../../shared/types/popup";

type PopupTabId = PopupState["activeTab"];

const { tabButtons, panels } = popupDom.tabs;
const {
  promptInput,
  promptCounter,
  sitesContainer,
  toggleAllBtn,
  cancelSendBtn,
  sendBtn,
  statusMsg,
} = popupDom.compose;

interface PopupShellDeps {
  isKorean: boolean;
  renderLists: () => void;
}

export function createPopupShell(deps: PopupShellDeps) {
  function setStatus(text: string, type = ""): void {
    statusMsg.textContent = text;
    statusMsg.className = type;
  }

  function clearStatus(): void {
    setStatus("");
  }

  function showAppToast(
    input: PopupToastInput | string,
    type = "info",
    duration = 3000,
  ): string {
    return showToast(input, type, duration);
  }

  function showConfirmToast(message: string, onConfirm: () => Promise<void> | void): void {
    showAppToast({
      message,
      type: "warning",
      duration: -1,
      actions: [
        {
          label: t.toastConfirm,
          onClick: () => {
            void onConfirm();
          },
        },
      ],
    });
  }

  function setSendingState(isSending: boolean): void {
    state.isSending = Boolean(isSending);
    sendBtn.disabled = state.isSending;
    sendBtn.classList.toggle("loading", state.isSending);
    cancelSendBtn.hidden = !state.isSending;
    cancelSendBtn.disabled = !state.isSending;
    cancelSendBtn.textContent = t.stopSending;
  }

  function clearSendSafetyTimer(): void {
    if (state.sendSafetyTimer) {
      window.clearTimeout(state.sendSafetyTimer);
      state.sendSafetyTimer = null;
    }
  }

  function armSendSafetyTimer(): void {
    clearSendSafetyTimer();
    state.sendSafetyTimer = window.setTimeout(() => {
      state.sendSafetyTimer = null;
      if (state.lastBroadcast?.status !== "sending") {
        setSendingState(false);
      }
    }, 2000);
  }

  function buildBroadcastToastSignature(summary: LastBroadcastSummary | null): string {
    return [
      summary?.broadcastId ?? "",
      summary?.status ?? "",
      summary?.finishedAt ?? "",
      (summary?.failedSiteIds ?? []).join(","),
    ].join("|");
  }

  function getEnabledSites(): RuntimeSite[] {
    return state.runtimeSites.filter((site) => site.enabled);
  }

  function getRuntimeSiteLabel(siteId: string): string {
    return state.runtimeSites.find((site) => site.id === siteId)?.name ?? siteId;
  }

  function getSiteSelectorIssueUrl(site: Partial<RuntimeSite> | null | undefined): string {
    const siteLabel = site?.name ?? site?.id ?? "";
    return `https://github.com/search?q=repo:twbeatles/prompt-broadcaster+${encodeURIComponent(siteLabel)}+selector&type=issues`;
  }

  function getSiteLastVerifiedStatus(
    site: Partial<RuntimeSite> | null | undefined,
  ): string {
    const verifiedAt = site?.verifiedAt ? String(site.verifiedAt).trim() : "";
    const lastVerified = site?.lastVerified ? String(site.lastVerified).trim() : "";
    const parsedDate = verifiedAt
      ? Date.parse(`${verifiedAt}T00:00:00Z`)
      : lastVerified
        ? Date.parse(`${lastVerified}-01T00:00:00Z`)
        : Number.NaN;

    if (!Number.isFinite(parsedDate)) {
      return "";
    }

    const daysSince = Math.floor((Date.now() - parsedDate) / 86400000);
    if (daysSince <= 0) {
      return "";
    }

    return (msg("popup_selector_days_since") || `~${daysSince}d since last verified`).replace("$DAYS$", String(daysSince));
  }

  function updatePromptCounter(): void {
    promptCounter.textContent = t.promptCounter(promptInput.value.length);
  }

  function autoResizePromptInput(): void {
    promptInput.style.height = "auto";
    const nextHeight = Math.max(100, Math.min(promptInput.scrollHeight, 300));
    promptInput.style.height = `${nextHeight}px`;
  }

  function scheduleComposeDraftSave(value = promptInput.value): void {
    if (state.promptDraftSaveTimer) {
      window.clearTimeout(state.promptDraftSaveTimer);
    }

    state.promptDraftSaveTimer = window.setTimeout(() => {
      state.promptDraftSaveTimer = null;
      void setComposeDraftPrompt(String(value ?? "")).catch((error) => {
        console.error("[AI Prompt Broadcaster] Failed to persist compose draft.", error);
      });
    }, 180);
  }

  function applyDynamicPromptPlaceholder(): void {
    const placeholderVariants = deps.isKorean
      ? [
          t.placeholder,
          "{{언어}}로 {{주제}}를 설명해줘",
          "선택한 텍스트를 여러 AI에 동시에 비교해줘",
        ]
      : [
          t.placeholder,
          "Write a blog post about {{topic}} in {{language}}.",
          "Summarize the selected text for all services.",
        ];
    const nextPlaceholder =
      placeholderVariants[Math.floor(Math.random() * placeholderVariants.length)] || t.placeholder;
    promptInput.setAttribute("placeholder", nextPlaceholder);
  }

  function allCheckboxes(): HTMLInputElement[] {
    return Array.from(
      sitesContainer.querySelectorAll<HTMLInputElement>("input[type='checkbox']"),
    );
  }

  function checkedSiteIds(): string[] {
    return allCheckboxes()
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value);
  }

  function syncToggleAllLabel(): void {
    const checkboxes = allCheckboxes();
    const allChecked = checkboxes.length > 0 && checkboxes.every((checkbox) => checkbox.checked);
    toggleAllBtn.textContent = allChecked ? t.deselectAll : t.selectAll;
  }

  function applySiteSelection(sentTo: unknown): void {
    const selected = new Set(normalizeSiteIdList(sentTo));

    allCheckboxes().forEach((checkbox) => {
      const shouldCheck = selected.size === 0 ? checkbox.checked : selected.has(checkbox.value);
      checkbox.checked = shouldCheck;
      const card = checkbox.closest(".site-card");
      card?.classList.toggle("checked", shouldCheck);
      card?.setAttribute("aria-selected", String(shouldCheck));
    });

    syncToggleAllLabel();
  }

  function switchTab(tabId: PopupTabId): void {
    state.activeTab = tabId;

    tabButtons.forEach((button) => {
      const active = button.dataset.tab === tabId;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });

    panels.forEach((panel) => {
      const active = panel.dataset.panel === tabId;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });

    state.openMenuKey = null;
    deps.renderLists();
  }

  return {
    setStatus,
    clearStatus,
    showAppToast,
    showConfirmToast,
    setSendingState,
    clearSendSafetyTimer,
    armSendSafetyTimer,
    buildBroadcastToastSignature,
    getEnabledSites,
    getRuntimeSiteLabel,
    getSiteSelectorIssueUrl,
    getSiteLastVerifiedStatus,
    updatePromptCounter,
    autoResizePromptInput,
    scheduleComposeDraftSave,
    applyDynamicPromptPlaceholder,
    allCheckboxes,
    checkedSiteIds,
    syncToggleAllLabel,
    applySiteSelection,
    switchTab,
  };
}
