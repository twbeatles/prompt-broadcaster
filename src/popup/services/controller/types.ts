import type { SiteDraftValidationResult } from "../../../shared/sites/validation";
import type { ServiceTestRunResponse } from "../../../shared/types/messages";
import type { RuntimeSite } from "../../../shared/types/models";

export interface ServiceDraft {
  [key: string]: string | number | boolean | string[];
  id: string;
  name: string;
  url: string;
  inputSelector: string;
  inputType: string;
  submitSelector: string;
  submitMethod: string;
  selectorCheckMode: string;
  fallbackSelectors: string[];
  authSelectors: string[];
  hostnameAliases: string[];
  supportedRoutes: string[];
  verifiedAt: string;
  verifiedRoute: string;
  verifiedAuthState: string;
  verifiedLocale: string;
  verifiedVersion: string;
  waitMs: number;
  color: string;
  icon: string;
  enabled: boolean;
}

export interface PopupServicesControllerDeps {
  refreshStoredData: () => Promise<void>;
  setStatus: (text: string, type?: string) => void;
  showAppToast: (input: string, type?: string, duration?: number) => void;
  getErrorMessage: (error: unknown) => string;
  buildServiceTestResultMessage: (
    response: ServiceTestRunResponse | null,
  ) => { message: string; isError: boolean };
  sendPopupMessage: (
    message: {
      action: "service-test:run";
      draft: Record<string, unknown>;
      isBuiltIn?: boolean;
    },
    timeoutMs?: number,
  ) => Promise<ServiceTestRunResponse | null>;
  getSiteLastVerifiedStatus: (
    site: Partial<RuntimeSite> | null | undefined,
  ) => string;
  getSiteSelectorIssueUrl: (
    site: Partial<RuntimeSite> | null | undefined,
  ) => string;
}

export interface ServiceEditorControllerDeps {
  refreshStoredData: PopupServicesControllerDeps["refreshStoredData"];
  getErrorMessage: PopupServicesControllerDeps["getErrorMessage"];
  buildServiceTestResultMessage: PopupServicesControllerDeps["buildServiceTestResultMessage"];
  sendPopupMessage: PopupServicesControllerDeps["sendPopupMessage"];
  setStatus: PopupServicesControllerDeps["setStatus"];
  showAppToast: PopupServicesControllerDeps["showAppToast"];
}

export type ServicePermissionPreviewRenderer = (
  draft?: ServiceDraft,
  validation?: SiteDraftValidationResult | null,
) => void;
