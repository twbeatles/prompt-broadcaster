import type { ImportRejectedSite, ImportSummary } from "../../types/models";

export type AcceptedCustomSite = Record<string, unknown> & {
  id: string;
  name: string;
  permissionPatterns?: unknown;
};

export function createImportSummary(
  targetVersion: number,
  sourceVersion: number,
  importedCustomSites: unknown[],
  customSiteImport: {
    acceptedSites: AcceptedCustomSite[];
    rejectedSites: ImportRejectedSite[];
    rewrittenIds: Array<{ from: string; to: string; name: string }>;
    deniedOrigins: string[];
  },
  builtInStateImport: {
    appliedIds: string[];
    droppedIds: string[];
  },
  builtInOverrideImport: {
    appliedIds: string[];
    droppedIds: string[];
    adjustedIds: string[];
  },
): ImportSummary {
  return {
    version: targetVersion,
    migratedFromVersion: sourceVersion,
    customSites: {
      importedCount: importedCustomSites.length,
      acceptedIds: customSiteImport.acceptedSites.map((site) => site.id),
      acceptedNames: customSiteImport.acceptedSites.map((site) => site.name),
      rejected: customSiteImport.rejectedSites,
      rewrittenIds: customSiteImport.rewrittenIds,
      deniedOrigins: customSiteImport.deniedOrigins,
    },
    builtInSiteStates: {
      appliedIds: builtInStateImport.appliedIds,
      droppedIds: builtInStateImport.droppedIds,
    },
    builtInSiteOverrides: {
      appliedIds: builtInOverrideImport.appliedIds,
      droppedIds: builtInOverrideImport.droppedIds,
      adjustedIds: builtInOverrideImport.adjustedIds,
    },
  };
}

export function createImportPermissionDeniedError(importSummary: ImportSummary): Error & {
  code: "import_permission_denied";
  importSummary: ImportSummary;
} {
  const error = new Error("Import failed.") as Error & {
    code: "import_permission_denied";
    importSummary: ImportSummary;
  };
  error.code = "import_permission_denied";
  error.importSummary = importSummary;
  return error;
}
