import {
  buildSitePermissionPatterns,
  requestOriginPermissions,
  saveBuiltInSiteOverride,
  saveCustomSite,
  setRuntimeSiteEnabled,
  validateHostnameAliases,
  validateSiteDraft,
} from "../../../shared/sites";
import type { SiteDraftValidationResult } from "../../../shared/sites/validation";
import type { RuntimeSite } from "../../../shared/types/models";
import type { ServiceEditorState } from "../../../shared/types/popup";
import { popupDom } from "../../app/dom";
import {
  joinMultilineValues,
  splitMultilineValues,
} from "../../app/helpers";
import { msg, t } from "../../app/i18n";
import { state } from "../../app/state";
import type {
  PopupServicesControllerDeps,
  ServiceDraft,
  ServiceEditorControllerDeps,
} from "./types";

const {
  serviceEditor,
  serviceEditorTitle,
  serviceNameInput,
  serviceUrlInput,
  serviceInputSelectorInput,
  serviceSubmitSelectorInput,
  serviceSubmitMethodSelect,
  serviceFallbackSelectorsInput,
  serviceAuthSelectorsInput,
  serviceHostnameAliasesInput,
  serviceSupportedRoutesInput,
  servicePermissionPreview,
  serviceVerifiedAtInput,
  serviceVerifiedRouteInput,
  serviceVerifiedAuthStateSelect,
  serviceVerifiedLocaleInput,
  serviceVerifiedVersionInput,
  serviceWaitRange,
  serviceWaitValue,
  serviceColorInput,
  serviceIconInput,
  serviceEnabledInput,
  serviceTestResult,
  serviceEditorError,
} = popupDom.serviceManagement;

export function createPopupServiceEditorController(
  deps: ServiceEditorControllerDeps,
) {
  function setServiceEditorError(message = ""): void {
    serviceEditorError.hidden = !message;
    serviceEditorError.textContent = message;
  }

  function setServiceTestResult(message = "", isError = false): void {
    serviceTestResult.hidden = !message;
    serviceTestResult.textContent = message;
    serviceTestResult.style.background = isError
      ? "rgba(181, 59, 59, 0.12)"
      : "rgba(255, 196, 0, 0.12)";
    serviceTestResult.style.color = isError ? "var(--danger)" : "var(--text)";
  }

  function setServicePermissionPreview(message = "", isError = false): void {
    servicePermissionPreview.hidden = !message;
    servicePermissionPreview.textContent = message;
    servicePermissionPreview.style.color = isError
      ? "var(--danger)"
      : "var(--text-soft)";
  }

  function readServiceEditorDraft(): ServiceDraft {
    const selectedInputType = document.querySelector<HTMLInputElement>(
      "input[name='service-input-type']:checked",
    );

    return {
      id: state.serviceEditor?.siteId ?? "",
      name: serviceNameInput.value.trim(),
      url: serviceUrlInput.value.trim(),
      inputSelector: serviceInputSelectorInput.value.trim(),
      inputType: selectedInputType?.value ?? "textarea",
      submitSelector: serviceSubmitSelectorInput.value.trim(),
      submitMethod: serviceSubmitMethodSelect.value,
      selectorCheckMode:
        state.serviceEditor?.selectorCheckMode ?? "input-and-submit",
      fallbackSelectors: splitMultilineValues(serviceFallbackSelectorsInput.value),
      authSelectors: splitMultilineValues(serviceAuthSelectorsInput.value),
      hostnameAliases: splitMultilineValues(serviceHostnameAliasesInput.value),
      supportedRoutes: splitMultilineValues(serviceSupportedRoutesInput.value),
      verifiedAt: serviceVerifiedAtInput.value.trim(),
      verifiedRoute: serviceVerifiedRouteInput.value.trim(),
      verifiedAuthState: serviceVerifiedAuthStateSelect.value,
      verifiedLocale: serviceVerifiedLocaleInput.value.trim(),
      verifiedVersion: serviceVerifiedVersionInput.value.trim(),
      waitMs: Number(serviceWaitRange.value),
      color: serviceColorInput.value,
      icon: serviceIconInput.value.trim(),
      enabled: serviceEnabledInput.checked,
    };
  }

  function renderServicePermissionPreview(
    draft: ServiceDraft = readServiceEditorDraft(),
    validation: SiteDraftValidationResult | null = null,
  ): void {
    const aliasErrors = validation?.fieldErrors?.hostnameAliases ?? [];
    const supportedRouteErrors = validation?.fieldErrors?.supportedRoutes ?? [];
    const inputSelectorErrors = validation?.fieldErrors?.inputSelector ?? [];
    const submitSelectorErrors = validation?.fieldErrors?.submitSelector ?? [];
    const fallbackSelectorErrors = validation?.fieldErrors?.fallbackSelectors ?? [];
    const aliasValidation =
      aliasErrors.length > 0
        ? { valid: false, errors: aliasErrors }
        : validateHostnameAliases(draft.hostnameAliases);
    const hasAliasError = aliasValidation.errors.length > 0;

    serviceHostnameAliasesInput.setAttribute(
      "aria-invalid",
      String(hasAliasError),
    );
    serviceSupportedRoutesInput.setAttribute(
      "aria-invalid",
      String(supportedRouteErrors.length > 0),
    );
    serviceInputSelectorInput.setAttribute(
      "aria-invalid",
      String(inputSelectorErrors.length > 0),
    );
    serviceSubmitSelectorInput.setAttribute(
      "aria-invalid",
      String(submitSelectorErrors.length > 0),
    );
    serviceFallbackSelectorsInput.setAttribute(
      "aria-invalid",
      String(fallbackSelectorErrors.length > 0),
    );

    if (hasAliasError) {
      setServicePermissionPreview(aliasValidation.errors.join(" "), true);
      return;
    }

    if (Boolean(state.serviceEditor?.isBuiltIn)) {
      setServicePermissionPreview("");
      return;
    }

    const patterns = buildSitePermissionPatterns(draft.url, draft.hostnameAliases);
    if (!draft.url.trim() || patterns.length === 0) {
      setServicePermissionPreview("");
      return;
    }

    setServicePermissionPreview(
      `${msg("popup_service_permission_preview") || "Requested origins"}: ${patterns.join(", ")}`,
      false,
    );
  }

  function resetServiceEditorForm(): void {
    serviceNameInput.value = "";
    serviceUrlInput.value = "";
    serviceInputSelectorInput.value = "";
    const defaultInputType = document.querySelector<HTMLInputElement>(
      "input[name='service-input-type'][value='textarea']",
    );
    if (defaultInputType) {
      defaultInputType.checked = true;
    }
    serviceSubmitSelectorInput.value = "";
    serviceSubmitMethodSelect.value = "click";
    serviceFallbackSelectorsInput.value = "";
    serviceAuthSelectorsInput.value = "";
    serviceHostnameAliasesInput.value = "";
    serviceSupportedRoutesInput.value = "";
    serviceHostnameAliasesInput.disabled = false;
    serviceVerifiedAtInput.value = "";
    serviceVerifiedRouteInput.value = "";
    serviceVerifiedAuthStateSelect.value = "";
    serviceVerifiedLocaleInput.value = "";
    serviceVerifiedVersionInput.value = "";
    serviceWaitRange.value = "2000";
    serviceWaitValue.textContent = "2000ms";
    serviceColorInput.value = "#c24f2e";
    serviceIconInput.value = "AI";
    serviceEnabledInput.checked = true;
    serviceUrlInput.disabled = false;
    state.serviceEditor = null;
    setServiceEditorError("");
    setServiceTestResult("");
    setServicePermissionPreview("");
  }

  function hideServiceEditor(): void {
    serviceEditor.hidden = true;
    resetServiceEditorForm();
  }

  function populateServiceEditor(site: RuntimeSite | null): void {
    state.serviceEditor = {
      mode: site ? "edit" : "add",
      siteId: site?.id ?? "",
      isBuiltIn: Boolean(site?.isBuiltIn),
      selectorCheckMode: site?.selectorCheckMode ?? "input-and-submit",
    } satisfies ServiceEditorState;

    serviceEditorTitle.textContent =
      state.serviceEditor.mode === "edit"
        ? t.serviceEditorEditTitle
        : t.serviceEditorAddTitle;
    serviceNameInput.value = site?.name ?? "";
    serviceUrlInput.value = site?.url ?? "";
    serviceInputSelectorInput.value = site?.inputSelector ?? "";
    const inputTypeOption = document.querySelector<HTMLInputElement>(
      `input[name='service-input-type'][value='${site?.inputType ?? "textarea"}']`,
    );
    if (inputTypeOption) {
      inputTypeOption.checked = true;
    }
    serviceSubmitSelectorInput.value = site?.submitSelector ?? "";
    serviceSubmitMethodSelect.value = site?.submitMethod ?? "click";
    serviceFallbackSelectorsInput.value = joinMultilineValues(
      site?.fallbackSelectors,
    );
    serviceAuthSelectorsInput.value = joinMultilineValues(site?.authSelectors);
    serviceHostnameAliasesInput.value = joinMultilineValues(
      site?.hostnameAliases,
    );
    serviceSupportedRoutesInput.value = joinMultilineValues(
      site?.supportedRoutes,
    );
    serviceHostnameAliasesInput.disabled = Boolean(site?.isBuiltIn);
    serviceVerifiedAtInput.value = site?.verifiedAt ?? "";
    serviceVerifiedRouteInput.value = site?.verifiedRoute ?? "";
    serviceVerifiedAuthStateSelect.value = site?.verifiedAuthState ?? "";
    serviceVerifiedLocaleInput.value = site?.verifiedLocale ?? "";
    serviceVerifiedVersionInput.value = site?.verifiedVersion ?? "";
    serviceWaitRange.value = String(site?.waitMs ?? 2000);
    serviceWaitValue.textContent = `${site?.waitMs ?? 2000}ms`;
    serviceColorInput.value = site?.color ?? "#c24f2e";
    serviceIconInput.value = site?.icon ?? "AI";
    serviceEnabledInput.checked = site?.enabled ?? true;
    serviceUrlInput.disabled = Boolean(site?.isBuiltIn);
    setServiceEditorError("");
    setServiceTestResult("");
    renderServicePermissionPreview(readServiceEditorDraft());
    serviceEditor.hidden = false;
  }

  async function ensureSiteOriginPermission(
    url: string,
    hostnameAliases: string[] = [],
  ): Promise<boolean> {
    try {
      const patterns = buildSitePermissionPatterns(url, hostnameAliases);
      if (patterns.length === 0) {
        return false;
      }

      const result = await requestOriginPermissions(patterns);
      return result.granted;
    } catch (error) {
      console.error(
        "[AI Prompt Broadcaster] Failed to request site host permission.",
        error,
      );
      return false;
    }
  }

  async function testSelectorOnActiveTab(): Promise<void> {
    if (!serviceInputSelectorInput.value.trim()) {
      setServiceTestResult(t.serviceTestNoSelector, true);
      return;
    }

    try {
      const response = await deps.sendPopupMessage(
        {
          action: "service-test:run",
          draft: readServiceEditorDraft(),
          isBuiltIn: Boolean(state.serviceEditor?.isBuiltIn),
        },
        10000,
      );
      const result = deps.buildServiceTestResultMessage(response);
      setServiceTestResult(result.message, result.isError);
    } catch (error) {
      console.error("[AI Prompt Broadcaster] Selector test failed.", error);
      setServiceTestResult(t.serviceTestError(deps.getErrorMessage(error)), true);
    }
  }

  async function saveServiceEditorDraft(): Promise<void> {
    const draft = readServiceEditorDraft();
    const isBuiltIn = Boolean(state.serviceEditor?.isBuiltIn);
    const validation = validateSiteDraft(draft, { isBuiltIn });
    renderServicePermissionPreview(draft, validation);

    if (!validation.valid) {
      setServiceEditorError(validation.errors.join(" "));
      return;
    }

    if (!isBuiltIn) {
      const granted = await ensureSiteOriginPermission(
        draft.url,
        draft.hostnameAliases,
      );
      if (!granted) {
        setServiceEditorError(t.servicePermissionDenied);
        return;
      }
    }

    try {
      if (isBuiltIn) {
        const currentServiceEditor = state.serviceEditor;
        if (!currentServiceEditor) {
          throw new Error(t.serviceValidationError);
        }
        await saveBuiltInSiteOverride(currentServiceEditor.siteId, draft);
        await setRuntimeSiteEnabled(currentServiceEditor.siteId, draft.enabled);
      } else {
        await saveCustomSite(draft);
      }

      await deps.refreshStoredData();
      hideServiceEditor();
      deps.setStatus(t.serviceSaved, "success");
      deps.showAppToast(t.serviceSaved, "success", 2200);
    } catch (error) {
      console.error(
        "[AI Prompt Broadcaster] Failed to save service settings.",
        error,
      );
      setServiceEditorError(
        deps.getErrorMessage(error) || t.serviceValidationError,
      );
    }
  }

  return {
    setServiceEditorError,
    setServiceTestResult,
    setServicePermissionPreview,
    renderServicePermissionPreview,
    resetServiceEditorForm,
    hideServiceEditor,
    populateServiceEditor,
    readServiceEditorDraft,
    ensureSiteOriginPermission,
    testSelectorOnActiveTab,
    saveServiceEditorDraft,
  };
}
