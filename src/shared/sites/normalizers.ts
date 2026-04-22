export {
  buildOriginPattern,
  buildOriginPatterns,
  deriveHostname,
  isPlainObject,
  normalizeBoolean,
  normalizeColor,
  normalizeHostname,
  normalizeHostnameAliases,
  normalizeIcon,
  normalizeInputType,
  normalizeSelectorCheckMode,
  normalizeStringList,
  normalizeSubmitMethod,
  normalizeWaitMs,
  safeText,
  stringifyComparable,
} from "./normalizers/core";
export {
  createCustomSiteId,
  createImportedCustomSiteIdBase,
  ensureUniqueImportedSiteId,
} from "./normalizers/ids";
export {
  buildBaseSiteRecord,
  normalizeCustomSite,
  sanitizeBuiltInOverride,
} from "./normalizers/site-records";
