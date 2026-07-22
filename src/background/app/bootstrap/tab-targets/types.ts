import type { RuntimeInjectionSiteConfig } from "../../../../shared/types/models";

export interface ResolvedBroadcastTarget {
  site: RuntimeInjectionSiteConfig;
  targetTabId: number | null;
  requireExplicitTab: boolean;
  forceNewTab: boolean;
  promptOverride?: string;
  resolvedPrompt?: string;
}

export type PreferredInjectableNormalTabResult =
  | { ok: true; tab: chrome.tabs.Tab; reason?: undefined }
  | { ok: false; reason: string; tab?: chrome.tabs.Tab | null };

export interface BackgroundTabTargetResolverDeps {
  getRuntimeSites: () => Promise<import("../../../../shared/types/models").RuntimeSite[]>;
  getPendingInjections: () => Promise<
    Record<string, import("../../../../shared/types/models").PendingInjectionRecord>
  >;
  getPreferredNormalActiveTab: (
    preferredWindowId?: number | null,
  ) => Promise<chrome.tabs.Tab | null>;
  getI18nMessage: (key: string, substitutions?: string[]) => string;
}
