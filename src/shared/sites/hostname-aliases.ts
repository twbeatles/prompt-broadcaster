import { safeText } from "./normalizers";

export interface HostnameAliasValidationResult {
  valid: boolean;
  normalizedHosts: string[];
  errors: string[];
}

function validateBareHostPort(value: string): string {
  const hostPortPattern = /^(?<host>[a-z0-9.-]+)(?::(?<port>\d{1,5}))?$/i;
  const match = value.match(hostPortPattern);
  if (!match?.groups?.host) {
    return "";
  }

  const host = match.groups.host.toLowerCase();
  const port = match.groups.port;
  if (
    host.startsWith(".") ||
    host.endsWith(".") ||
    host.includes("..") ||
    !/[a-z]/i.test(host)
  ) {
    return "";
  }

  if (port) {
    const numericPort = Number(port);
    if (!Number.isInteger(numericPort) || numericPort <= 0 || numericPort > 65535) {
      return "";
    }

    return `${host}:${numericPort}`;
  }

  return host;
}

export function normalizeHostnameAliasEntry(value: unknown): string {
  const input = safeText(value);
  if (!input) {
    return "";
  }

  try {
    const parsed = new URL(input);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    return parsed.host.toLowerCase();
  } catch (_error) {
    return validateBareHostPort(input);
  }
}

export function validateHostnameAliases(value: unknown): HostnameAliasValidationResult {
  const entries = Array.isArray(value) ? value : [];
  const errors: string[] = [];
  const normalizedHosts = new Set<string>();

  entries.forEach((entry, index) => {
    const rawInput = typeof entry === "string" ? entry : "";
    const rawValue = safeText(entry);
    if (!rawValue) {
      return;
    }

    if (rawInput && rawInput !== rawInput.trim()) {
      errors.push(`Hostname alias line ${index + 1} must not include leading or trailing whitespace.`);
      return;
    }

    const normalized = normalizeHostnameAliasEntry(rawValue);
    if (!normalized) {
      errors.push(`Hostname alias line ${index + 1} must be a host[:port] or http/https URL.`);
      return;
    }

    normalizedHosts.add(normalized);
  });

  return {
    valid: errors.length === 0,
    normalizedHosts: [...normalizedHosts],
    errors,
  };
}
