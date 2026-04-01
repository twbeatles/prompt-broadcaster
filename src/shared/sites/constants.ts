import { AI_SITES } from "../../config/sites";

export const SITE_STORAGE_KEYS = Object.freeze({
  customSites: "customSites",
  builtInSiteStates: "builtInSiteStates",
  builtInSiteOverrides: "builtInSiteOverrides",
});

export const VALID_INPUT_TYPES = new Set(["textarea", "contenteditable", "input"]);
export const VALID_SUBMIT_METHODS = new Set(["click", "enter", "shift+enter"]);
export const VALID_SELECTOR_CHECK_MODES = new Set(["input-and-submit", "input-only"]);
export const BUILT_IN_SITE_IDS = new Set(
  AI_SITES.map((site) => String(site?.id ?? "")).filter(Boolean)
);

export const BUILT_IN_SITE_STYLE_MAP = Object.freeze({
  chatgpt: { color: "#10a37f", icon: "GPT" },
  gemini: { color: "#4285f4", icon: "Gem" },
  claude: { color: "#d97706", icon: "Cl" },
  grok: { color: "#000000", icon: "Gk" },
  perplexity: { color: "#20808d", icon: "Px" },
});
