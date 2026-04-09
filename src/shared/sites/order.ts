function normalizeSiteOrder(siteOrder: unknown): string[] {
  if (!Array.isArray(siteOrder)) {
    return [];
  }

  return Array.from(
    new Set(
      siteOrder
        .filter((entry) => typeof entry === "string" && entry.trim())
        .map((entry) => entry.trim())
    )
  );
}

export function sortSitesByOrder<T extends { id?: unknown }>(
  sites: T[] = [],
  siteOrder: unknown
): T[] {
  const normalizedOrder = normalizeSiteOrder(siteOrder);
  if (normalizedOrder.length === 0) {
    return [...(Array.isArray(sites) ? sites : [])];
  }

  const siteMap = new Map<string, T>();
  const unorderedSites: T[] = [];

  (Array.isArray(sites) ? sites : []).forEach((site) => {
    const siteId = typeof site?.id === "string" ? site.id.trim() : "";
    if (!siteId) {
      unorderedSites.push(site);
      return;
    }

    siteMap.set(siteId, site);
  });

  const orderedSites = normalizedOrder
    .map((siteId) => siteMap.get(siteId))
    .filter((site): site is T => Boolean(site));
  const orderedIds = new Set(orderedSites.map((site) => String(site.id).trim()));

  return [
    ...orderedSites,
    ...(Array.isArray(sites) ? sites : []).filter((site) => {
      const siteId = typeof site?.id === "string" ? site.id.trim() : "";
      return !siteId || !orderedIds.has(siteId);
    }),
  ];
}
