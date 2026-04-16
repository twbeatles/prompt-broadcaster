function normalizeOriginPatterns(originPatterns: unknown): string[] {
  return Array.from(
    new Set(
      (Array.isArray(originPatterns) ? originPatterns : [])
        .filter((pattern): pattern is string => typeof pattern === "string" && pattern.trim().length > 0)
        .map((pattern) => pattern.trim())
    )
  );
}

export async function containsOriginPermission(originPattern: string): Promise<boolean> {
  try {
    if (!chrome.permissions?.contains || !originPattern) {
      return false;
    }

    return await chrome.permissions.contains({
      origins: [originPattern],
    });
  } catch (_error) {
    return false;
  }
}

export async function findMissingOriginPermissions(originPatterns: string[] = []): Promise<string[]> {
  const normalizedOriginPatterns = normalizeOriginPatterns(originPatterns);
  const missingOrigins: string[] = [];

  for (const originPattern of normalizedOriginPatterns) {
    if (!(await containsOriginPermission(originPattern))) {
      missingOrigins.push(originPattern);
    }
  }

  return missingOrigins;
}

export async function requestOriginPermissions(originPatterns: string[] = []): Promise<{
  granted: boolean;
  requestedOrigins: string[];
  deniedOrigins: string[];
}> {
  const requestedOrigins = normalizeOriginPatterns(originPatterns);
  if (requestedOrigins.length === 0) {
    return {
      granted: true,
      requestedOrigins: [],
      deniedOrigins: [],
    };
  }

  const missingBeforeRequest = await findMissingOriginPermissions(requestedOrigins);
  if (missingBeforeRequest.length > 0) {
    try {
      const granted = chrome.permissions?.request
        ? await chrome.permissions.request({ origins: missingBeforeRequest })
        : false;

      if (!granted) {
        const deniedOrigins = await findMissingOriginPermissions(requestedOrigins);
        return {
          granted: deniedOrigins.length === 0,
          requestedOrigins,
          deniedOrigins,
        };
      }
    } catch (_error) {
      const deniedOrigins = await findMissingOriginPermissions(requestedOrigins);
      return {
        granted: deniedOrigins.length === 0,
        requestedOrigins,
        deniedOrigins,
      };
    }
  }

  const deniedOrigins = await findMissingOriginPermissions(requestedOrigins);
  return {
    granted: deniedOrigins.length === 0,
    requestedOrigins,
    deniedOrigins,
  };
}
