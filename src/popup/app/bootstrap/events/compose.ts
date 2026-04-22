import { popupDom } from "../../dom";
import { t } from "../../i18n";
import { state } from "../../state";
import type { PopupEventDeps } from "./deps";

const {
  promptInput,
  clearPromptBtn,
  toggleAllBtn,
  saveFavoriteBtn,
  cancelSendBtn,
  sendBtn,
} = popupDom.compose;

export function bindComposeEvents(deps: PopupEventDeps) {
  const runSend = (logMessage: string) => {
    void deps.compose.handleSend().catch((error) => {
      console.error(logMessage, error);
      deps.status.setStatus(t.error(deps.status.getErrorMessage(error)), "error");
    });
  };

  clearPromptBtn.addEventListener("click", () => {
    promptInput.value = "";
    deps.compose.scheduleComposeDraftSave("");
    state.loadedFavoriteId = "";
    state.loadedFavoriteTitle = "";
    state.loadedTemplateDefaults = {};
    deps.compose.updatePromptCounter();
    deps.compose.autoResizePromptInput();
    deps.compose.renderTemplateSummary();
    deps.status.clearStatus();
    promptInput.focus();
  });

  toggleAllBtn.addEventListener("click", () => {
    const checkboxes = deps.compose.allCheckboxes();
    const shouldCheckAll = !checkboxes.every((checkbox) => checkbox.checked);

    checkboxes.forEach((checkbox) => {
      checkbox.checked = shouldCheckAll;
      checkbox.closest(".site-card")?.classList.toggle("checked", shouldCheckAll);
    });

    deps.compose.syncToggleAllLabel();
    deps.compose.renderTemplateSummary();
  });

  saveFavoriteBtn.addEventListener("click", () => {
    void deps.compose.openFavoriteModal().catch((error) => {
      console.error("[AI Prompt Broadcaster] Failed to open favorite modal.", error);
      deps.status.setStatus(t.error(deps.status.getErrorMessage(error)), "error");
    });
  });

  cancelSendBtn.addEventListener("click", () => {
    void deps.compose.cancelCurrentBroadcast();
  });

  sendBtn.addEventListener("click", (event) => {
    deps.compose.triggerRipple(sendBtn, event);
    runSend("[AI Prompt Broadcaster] Send flow failed.");
  });

  promptInput.addEventListener("input", () => {
    deps.compose.scheduleComposeDraftSave(promptInput.value);
    deps.compose.updatePromptCounter();
    deps.compose.autoResizePromptInput();
    deps.compose.renderTemplateSummary();
    document
      .querySelectorAll(".site-card.sent, .site-card.failed, .site-card.sending")
      .forEach((card) => {
        card.classList.remove("sending", "sent", "failed");
        card.querySelector(".retry-btn")?.remove();
      });
  });

  promptInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      runSend("[AI Prompt Broadcaster] Keyboard send failed.");
    }
  });
}
