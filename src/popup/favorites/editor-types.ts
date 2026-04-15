import type { FavoriteRunResponse } from "../../shared/types/messages";
import type {
  FavoriteExecutionTrigger,
  FavoritePrompt,
  RuntimeSite,
} from "../../shared/types/models";
import type {
  PopupFeatureDeps,
  PopupOverlayController,
} from "../../shared/types/popup";

export interface FavoriteRunRequestOptions {
  trigger?: FavoriteExecutionTrigger;
  allowPopupFallback?: boolean;
}

export interface FavoriteEditorFeatureDeps extends PopupFeatureDeps {
  checkedSiteIds: () => string[];
  getEnabledSites: () => RuntimeSite[];
  getRuntimeSiteLabel: (siteId: string) => string;
  refreshStoredData: () => Promise<void>;
  requestFavoriteRun: (
    item: FavoritePrompt,
    options?: FavoriteRunRequestOptions,
  ) => Promise<FavoriteRunResponse>;
  openOverlay: PopupOverlayController["openOverlay"];
  closeOverlay: PopupOverlayController["closeOverlay"];
}

export type FavoriteEditorSeed = Omit<Partial<FavoritePrompt>, "id"> & {
  id?: string | null;
  text?: string;
  sentTo?: string[];
  templateDefaults?: Record<string, string>;
};
