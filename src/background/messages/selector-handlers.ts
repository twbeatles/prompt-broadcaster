import {
  clearFailedSelector,
  enqueueUiToast,
  markFailedSelector,
} from "../../shared/runtime-state";
import { buildInjectionConfig } from "../app/injection-helpers";
import type {
  GenericOkResponse,
  SelectorCheckInitMessage,
  SelectorCheckInitResponse,
  SelectorCheckReportMessage,
  SelectorCheckReportResponse,
} from "../../shared/types/messages";
import type { RuntimeSite } from "../../shared/types/models";

export interface SelectorHandlersDeps {
  getI18nMessage: (key: string, substitutions?: string[]) => string;
  getSiteForUrl: (url: string) => Promise<RuntimeSite | null | undefined>;
  getSiteById: (siteId: string) => Promise<RuntimeSite | null | undefined>;
  clearPendingSelectorChecksForSiteId: (siteId: string) => Promise<unknown>;
  registerPendingSelectorCheckReport: (report: {
    siteId: string;
    siteName: string;
    pageUrl: string;
    missing: Array<{ field: string; selector: string }>;
  }) => Promise<{ promoted?: boolean } | null | undefined>;
  maybeCreateSelectorNotification: (
    report: {
      siteId: string;
      siteName: string;
      pageUrl: string;
      missing: Array<{ field: string; selector: string }>;
    },
    options?: { source?: "selector-checker" | "injector"; cooldownMs?: number },
  ) => Promise<void>;
}

export function createSelectorHandlers(deps: SelectorHandlersDeps) {
  const {
    getI18nMessage,
    getSiteForUrl,
    getSiteById,
    clearPendingSelectorChecksForSiteId,
    registerPendingSelectorCheckReport,
    maybeCreateSelectorNotification,
  } = deps;

  async function handleSelectorCheckInit(
    message: SelectorCheckInitMessage,
  ): Promise<SelectorCheckInitResponse> {
    const site = await getSiteForUrl(message?.url ?? "");
    if (!site) {
      return { ok: true, site: null };
    }

    return {
      ok: true,
      site: buildInjectionConfig(site),
    };
  }

  async function handleSelectorCheckReport(
    message: SelectorCheckReportMessage,
  ): Promise<SelectorCheckReportResponse> {
    if (
      (message?.status === "ok" ||
        message?.status === "auth_page" ||
        message?.status === "skipped") &&
      message?.siteId
    ) {
      await clearPendingSelectorChecksForSiteId(message.siteId);
      await clearFailedSelector(message.siteId);
      return { ok: true };
    }

    if (message?.status !== "selector_missing") {
      return { ok: true };
    }

    const missing = Array.isArray(message?.missing) ? message.missing : [];
    if (missing.length === 0) {
      return { ok: true };
    }

    const report = {
      siteId: message.siteId ?? "unknown",
      siteName: message.siteName ?? "AI service",
      pageUrl: message.pageUrl ?? "",
      missing,
    };

    const pendingResult = await registerPendingSelectorCheckReport(report);
    if (!pendingResult?.promoted) {
      return { ok: true };
    }

    // Proactive checker: badge only — no desktop notification.
    await maybeCreateSelectorNotification(report, { source: "selector-checker" });
    await markFailedSelector(
      message.siteId ?? "unknown",
      missing[0]?.selector ?? "",
      "selector-checker"
    );
    return { ok: true };
  }

  async function handleSelectorFailedMessage(
    message: unknown,
  ): Promise<GenericOkResponse> {
    const payload = (message ?? {}) as { serviceId?: string; selector?: string };
    const serviceId = payload.serviceId ?? "";
    const selector = payload.selector ?? "";
    const site = await getSiteById(serviceId);

    await clearPendingSelectorChecksForSiteId(serviceId);
    await maybeCreateSelectorNotification(
      {
        siteId: serviceId || "unknown",
        siteName: site?.name || serviceId || "AI service",
        pageUrl: "",
        missing: [
          {
            field: "inputSelector",
            selector,
          },
        ],
      },
      { source: "injector" },
    );
    await markFailedSelector(serviceId, selector, "injector");
    await enqueueUiToast({
      message:
        getI18nMessage("toast_selector_failed", [site?.name ?? serviceId]) ||
        `${site?.name ?? serviceId} selector was not found.`,
      type: "error",
      duration: 10000,
    });

    return { ok: true };
  }

  async function handleInjectSuccessMessage(
    message: unknown,
  ): Promise<GenericOkResponse> {
    const payload = (message ?? {}) as { serviceId?: string };
    if (payload.serviceId) {
      await clearPendingSelectorChecksForSiteId(payload.serviceId);
      await clearFailedSelector(payload.serviceId);
    }

    return { ok: true };
  }

  async function handleInjectFallbackMessage(
    message: unknown,
  ): Promise<GenericOkResponse> {
    const payload = (message ?? {}) as { serviceId?: string; copied?: boolean };
    const serviceId = payload.serviceId ?? "";
    const site = await getSiteById(serviceId);
    const copied = Boolean(payload.copied);

    await enqueueUiToast({
      message: copied
        ? (
            getI18nMessage("toast_inject_fallback_copied", [site?.name ?? serviceId]) ||
            `${site?.name ?? serviceId} prompt copied to clipboard. Paste it manually and send.`
          )
        : (
            getI18nMessage("toast_inject_fallback_manual", [site?.name ?? serviceId]) ||
            `${site?.name ?? serviceId} automatic injection failed. Paste the prompt manually and send.`
          ),
      type: "warning",
      duration: 5000,
    });

    return { ok: true };
  }

  async function handleUiToastMessage(
    message: unknown,
  ): Promise<GenericOkResponse> {
    const payload = (message ?? {}) as { toast?: Record<string, unknown> };
    await enqueueUiToast(payload.toast ?? {});
    return { ok: true };
  }

  return {
    handleSelectorCheckInit,
    handleSelectorCheckReport,
    handleSelectorFailedMessage,
    handleInjectSuccessMessage,
    handleInjectFallbackMessage,
    handleUiToastMessage,
  };
}
