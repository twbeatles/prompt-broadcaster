import { DEFAULT_SETTINGS } from "../../shared/prompts";
import type {
  AppSettings,
  BroadcastComparisonNote,
  FavoritePrompt,
  FavoriteRunJobSummary,
  ImportSummary,
  PromptExperiment,
  PromptHistoryItem,
  RuntimeSite,
  ServiceGroup,
  ServiceHealthSnapshot,
  StrategyStats,
  TemplatePack,
} from "../../shared/types/models";

interface OptionsState {
  history: PromptHistoryItem[];
  favorites: FavoritePrompt[];
  favoriteJobs: FavoriteRunJobSummary[];
  strategyStats: StrategyStats;
  serviceHealthSnapshots: ServiceHealthSnapshot[];
  comparisonNotes: BroadcastComparisonNote[];
  promptExperiments: PromptExperiment[];
  templatePacks: TemplatePack[];
  serviceGroups: ServiceGroup[];
  runtimeSites: RuntimeSite[];
  settings: AppSettings;
  activeSection: string;
  activeExperimentId: string | null;
  historyPage: number;
  selectedHistoryIds: Set<number>;
  pendingImportSummary: ImportSummary | null;
  filters: {
    service: string;
    dateFrom: string;
    dateTo: string;
  };
}

export const state: OptionsState = {
  history: [],
  favorites: [],
  favoriteJobs: [],
  strategyStats: {},
  serviceHealthSnapshots: [],
  comparisonNotes: [],
  promptExperiments: [],
  templatePacks: [],
  serviceGroups: [],
  runtimeSites: [],
  settings: { ...DEFAULT_SETTINGS },
  activeSection: "dashboard",
  activeExperimentId: null,
  historyPage: 1,
  selectedHistoryIds: new Set(),
  pendingImportSummary: null,
  filters: {
    service: "all",
    dateFrom: "",
    dateTo: "",
  },
};
