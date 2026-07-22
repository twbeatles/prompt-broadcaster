import {
  capAutoCapturedResponseText,
  deleteComparisonNote,
  getAppSettings,
  getComparisonNotes,
  getStoredPromptHistory,
  saveComparisonNote,
} from "../../../shared/prompts";
import {
  enqueueUiToast,
  getActiveComparisonContext,
} from "../../../shared/runtime-state";
import {
  AUTO_RESPONSE_CAPTURE_INTERVAL_MS,
  AUTO_RESPONSE_CAPTURE_MIN_LENGTH,
  AUTO_RESPONSE_CAPTURE_TIMEOUT_MS,
  COMPARISON_CAPTURE_SELECTORS,
  isPromptEcho,
  normalizeCapturedResponseText,
  shouldUpdateAutoCapturedResponse,
} from "../../app/comparison/capture";
import type {
  ComparisonCaptureStartMessage,
  ComparisonCaptureStartResponse,
  ComparisonNoteDeleteMessage,
  ComparisonNoteDeleteResponse,
  ComparisonNoteListMessage,
  ComparisonNoteListResponse,
  ComparisonNoteSaveMessage,
  ComparisonNoteSaveResponse,
} from "../../../shared/types/messages";
import type {
  PendingBroadcastRecord,
  PromptHistoryItem,
  RuntimeSite,
} from "../../../shared/types/models";

export interface ComparisonHandlersDeps {
  sleep: (ms: number) => Promise<void>;
  selectionCache: Map<number, string>;
  getSiteForUrl: (url: string) => Promise<RuntimeSite | null | undefined>;
}

export function createComparisonHandlers(deps: ComparisonHandlersDeps) {
  const { sleep, selectionCache, getSiteForUrl } = deps;

  async function handleComparisonNoteList(
    message: ComparisonNoteListMessage,
  ): Promise<ComparisonNoteListResponse> {
    const historyId = Number(message?.historyId);
    const notes = await getComparisonNotes();
    return {
      ok: true,
      notes: Number.isFinite(historyId)
        ? notes.filter((entry) => Number(entry.historyId) === historyId)
        : notes,
    };
  }

  async function handleComparisonNoteSave(
    message: ComparisonNoteSaveMessage,
  ): Promise<ComparisonNoteSaveResponse> {
    const note = await saveComparisonNote(message?.note ?? {});
    return {
      ok: true,
      note,
    };
  }

  async function handleComparisonNoteDelete(
    message: ComparisonNoteDeleteMessage,
  ): Promise<ComparisonNoteDeleteResponse> {
    const notes = await deleteComparisonNote(message?.noteId ?? "");
    return {
      ok: true,
      notes,
    };
  }

  async function resolveContextMenuComparisonTarget(
    siteId: string,
  ): Promise<{ historyId: number } | null> {
    const [history, activeContext] = await Promise.all([
      getStoredPromptHistory(),
      getActiveComparisonContext(),
    ]);

    if (activeContext?.serviceId !== siteId) {
      return null;
    }

    const activeHistory = history.find((entry) => Number(entry.id) === activeContext.historyId);
    if (activeHistory?.requestedSiteIds?.includes(siteId)) {
      return {
        historyId: activeHistory.id,
      };
    }

    return null;
  }

  async function handleContextMenuComparisonNote(
    selectedText: string,
    tab: chrome.tabs.Tab | undefined,
  ): Promise<void> {
    const responseText = (selectedText || (tab?.id ? selectionCache.get(tab.id) : "") || "").trim();
    if (!responseText) {
      return;
    }

    const [history, site] = await Promise.all([
      getStoredPromptHistory(),
      getSiteForUrl(tab?.url ?? ""),
    ]);
    if (history.length === 0 || !site?.id) {
      await enqueueUiToast({
        message: "Open a supported service tab and keep at least one history item before saving a comparison note.",
        type: "warning",
        duration: 5000,
      });
      return;
    }

    const target = await resolveContextMenuComparisonTarget(site.id);
    if (!target) {
      await enqueueUiToast({
        message: `${site.name} is not the active comparison target. Open the matching history item first.`,
        type: "warning",
        duration: 5000,
      });
      return;
    }

    await saveComparisonNote({
      historyId: target.historyId,
      serviceId: site.id,
      responseText,
      captureMode: "selection",
      tags: ["selection"],
    });
    await enqueueUiToast({
      message: `${site.name} response saved to the active comparison note.`,
      type: "success",
      duration: 3500,
    });
  }

  async function findComparisonCaptureTab(
    serviceId: string,
    explicitTabId?: number | null,
  ): Promise<chrome.tabs.Tab | null> {
    if (Number.isFinite(Number(explicitTabId))) {
      try {
        return await chrome.tabs.get(Number(explicitTabId));
      } catch (_error) {
        return null;
      }
    }

    const activeTabs = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    }).catch(() => []);
    for (const tab of activeTabs) {
      const site = await getSiteForUrl(tab.url ?? "");
      if (site?.id === serviceId) {
        return tab;
      }
    }

    const allTabs = await chrome.tabs.query({}).catch(() => []);
    for (const tab of allTabs) {
      const site = await getSiteForUrl(tab.url ?? "");
      if (site?.id === serviceId) {
        return tab;
      }
    }

    return null;
  }

  async function captureVisibleAssistantResponse(tabId: number, serviceId: string, promptText = ""): Promise<string> {
    const selectors = COMPARISON_CAPTURE_SELECTORS[serviceId] ?? [];
    if (selectors.length === 0) {
      return "";
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      args: [selectors],
      func: (assistantSelectors: string[]) => {
        const isVisible = (element: Element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        };
        const isAssistantCandidate = (element: Element) => {
          const role = element.getAttribute("role") || "";
          const editable = element.getAttribute("contenteditable") || "";
          return role.toLowerCase() !== "textbox" && editable.toLowerCase() !== "true";
        };
        const getText = (element: Element) => (element.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        const seen = new Set<Element>();
        const candidates = assistantSelectors
          .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
          .filter((element) => {
            if (seen.has(element)) {
              return false;
            }
            seen.add(element);
            return true;
          })
          .filter(isVisible)
          .filter(isAssistantCandidate)
          .map((element) => ({
            text: getText(element),
            top: element.getBoundingClientRect().top,
          }))
          .filter((entry) => entry.text.length >= 20)
          .sort((left, right) => right.top - left.top);

        return candidates[0]?.text ?? "";
      },
    });

    const responseText = typeof result?.result === "string" ? result.result : "";
    if (
      normalizeCapturedResponseText(responseText).length < AUTO_RESPONSE_CAPTURE_MIN_LENGTH ||
      isPromptEcho(responseText, promptText)
    ) {
      return "";
    }

    return responseText;
  }

  async function captureAssistantResponseWithRetry(
    tabId: number,
    serviceId: string,
    promptText: string,
  ): Promise<string> {
    const deadline = Date.now() + AUTO_RESPONSE_CAPTURE_TIMEOUT_MS;
    let lastResponse = "";

    while (Date.now() <= deadline) {
      const responseText = await captureVisibleAssistantResponse(tabId, serviceId, promptText).catch(() => "");
      if (responseText) {
        if (lastResponse && normalizeCapturedResponseText(lastResponse) === normalizeCapturedResponseText(responseText)) {
          return responseText;
        }
        lastResponse = responseText;
      }

      await sleep(AUTO_RESPONSE_CAPTURE_INTERVAL_MS);
    }

    return lastResponse;
  }

  async function saveAutoCapturedResponse(
    historyId: number,
    serviceId: string,
    responseText: string,
  ): Promise<void> {
    const cappedResponseText = capAutoCapturedResponseText(responseText);
    const existingNotes = await getComparisonNotes();
    const existingAutoNote = existingNotes.find(
      (note) =>
        Number(note.historyId) === Number(historyId) &&
        note.serviceId === serviceId &&
        note.captureMode === "auto",
    );

    if (existingAutoNote && !shouldUpdateAutoCapturedResponse(existingAutoNote.responseText, cappedResponseText)) {
      return;
    }

    await saveComparisonNote({
      id: existingAutoNote?.id,
      historyId,
      serviceId,
      responseText: cappedResponseText,
      captureMode: "auto",
      tags: ["auto"],
    });
  }

  async function autoCaptureBroadcastResponses(
    historyItem: PromptHistoryItem,
    completedRecord: PendingBroadcastRecord,
  ): Promise<void> {
    const settings = await getAppSettings();
    if (!settings.autoCaptureResponses) {
      return;
    }

    const submittedSiteIds = Array.isArray(completedRecord.submittedSiteIds)
      ? completedRecord.submittedSiteIds
      : [];
    for (const serviceId of submittedSiteIds) {
      const tabId = Number(completedRecord.targetTabIdsBySiteId?.[serviceId]);
      const tab = await findComparisonCaptureTab(serviceId, Number.isFinite(tabId) ? tabId : null);
      if (!tab?.id) {
        continue;
      }

      const responseText = await captureAssistantResponseWithRetry(tab.id, serviceId, historyItem.text);
      if (!responseText.trim()) {
        continue;
      }

      await saveAutoCapturedResponse(Number(historyItem.id), serviceId, responseText);
    }
  }

  async function handleComparisonCaptureStart(
    message: ComparisonCaptureStartMessage,
  ): Promise<ComparisonCaptureStartResponse> {
    const historyId = Math.max(0, Math.round(Number(message?.historyId)));
    const serviceId = typeof message?.serviceId === "string" ? message.serviceId.trim() : "";
    if (!historyId || !serviceId) {
      return {
        ok: false,
        captured: false,
        error: "historyId and serviceId are required.",
      };
    }

    const tab = await findComparisonCaptureTab(serviceId, message?.tabId ?? null);
    if (!tab?.id) {
      return {
        ok: true,
        captured: false,
        message: "Open the service tab and run capture again when the response is visible.",
      };
    }

    const history = await getStoredPromptHistory();
    const historyItem = history.find((entry) => Number(entry.id) === historyId);
    const responseText = await captureVisibleAssistantResponse(tab.id, serviceId, historyItem?.text ?? "").catch(() => "");
    if (!responseText.trim()) {
      return {
        ok: true,
        captured: false,
        message: "No visible assistant response was found. Use manual paste or select response text from the service tab.",
      };
    }

    await saveAutoCapturedResponse(historyId, serviceId, responseText);
    const notes = await getComparisonNotes();
    const note = notes.find(
      (entry) =>
        Number(entry.historyId) === Number(historyId) &&
        entry.serviceId === serviceId &&
        entry.captureMode === "auto",
    ) ?? null;
    return {
      ok: true,
      note: note ?? undefined,
      captured: true,
    };
  }

  return {
    handleComparisonNoteList,
    handleComparisonNoteSave,
    handleComparisonNoteDelete,
    resolveContextMenuComparisonTarget,
    handleContextMenuComparisonNote,
    findComparisonCaptureTab,
    captureVisibleAssistantResponse,
    captureAssistantResponseWithRetry,
    saveAutoCapturedResponse,
    autoCaptureBroadcastResponses,
    handleComparisonCaptureStart,
  };
}
