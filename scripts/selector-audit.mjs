import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const rootDir = process.cwd();
const outputDir = path.join(rootDir, "output", "selector-audit");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const AUTH_PATH_SEGMENTS = ["/login", "/logout", "/sign-in", "/signin", "/auth"];

const AUTH_STATE_RESOLVERS = {
  chatgpt: (probe) => (probe.hasPromptSurface ? "logged-out" : "logged-out"),
  gemini: (probe) => (probe.hasPromptSurface ? "logged-out" : "logged-out"),
  claude: (probe) => (probe.hasPromptSurface ? "logged-in" : "logged-out"),
  grok: (probe) => (probe.hasPromptSurface ? "logged-out" : "logged-out"),
  perplexity: (probe) =>
    probe.hasPromptSurface && probe.hasAuthSurface
      ? "soft-gated"
      : probe.hasPromptSurface
        ? "logged-out"
        : "logged-out",
};

function formatBoolean(value) {
  if (value === true) {
    return "yes";
  }

  if (value === false) {
    return "no";
  }

  return "n/a";
}

function formatValue(value) {
  return String(value ?? "").trim() || "-";
}

function escapeCell(value) {
  return formatValue(value).replace(/\|/g, "\\|");
}

function splitSelectorList(selectorGroup) {
  const source = typeof selectorGroup === "string" ? selectorGroup.trim() : "";
  if (!source) {
    return [];
  }

  const parts = [];
  let current = "";
  let bracketDepth = 0;
  let parenDepth = 0;
  let quote = null;
  let escaping = false;

  for (const character of source) {
    current += character;

    if (escaping) {
      escaping = false;
      continue;
    }

    if (character === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === "'" || character === "\"") {
      quote = character;
      continue;
    }

    if (character === "[") {
      bracketDepth += 1;
      continue;
    }

    if (character === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }

    if (character === "(") {
      parenDepth += 1;
      continue;
    }

    if (character === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }

    if (character === "," && bracketDepth === 0 && parenDepth === 0) {
      current = current.slice(0, -1);
      const normalized = current.trim();
      if (normalized) {
        parts.push(normalized);
      }
      current = "";
    }
  }

  const trailing = current.trim();
  if (trailing) {
    parts.push(trailing);
  }

  return parts;
}

function normalizeSelectorEntries(selectors) {
  const rawSelectors = Array.isArray(selectors) ? selectors : [selectors];
  return rawSelectors
    .filter((selector) => typeof selector === "string" && selector.trim())
    .flatMap((selector) => splitSelectorList(selector))
    .filter((selector, index, entries) => entries.indexOf(selector) === index);
}

function buildSubmitRequirement(site) {
  if (site?.submitMethod !== "click") {
    return "none";
  }

  if (typeof site?.submitSelector !== "string" || !site.submitSelector.trim()) {
    return "none";
  }

  if (site?.selectorCheckMode === "input-and-conditional-submit") {
    return "conditional";
  }

  if (site?.selectorCheckMode === "input-only") {
    return "none";
  }

  return "required";
}

function hasKnownAuthPath(pathname) {
  const normalized = typeof pathname === "string" ? pathname.trim().toLowerCase() : "";
  return AUTH_PATH_SEGMENTS.some((segment) => normalized.includes(segment));
}

async function loadBuiltInSites() {
  const source = await readFile(path.join(rootDir, "src", "config", "sites", "builtins.ts"), "utf8");
  const match = source.match(/export const AI_SITES = Object\.freeze\(([\s\S]*?)\);\s*export default AI_SITES;/);

  if (!match?.[1]) {
    throw new Error("Could not parse built-in site definitions.");
  }

  return Function(`"use strict"; return Object.freeze(${match[1]});`)();
}

function buildMatchRow(label, match) {
  if (!match) {
    return `| ${label} | - | no | n/a | - | - |`;
  }

  return [
    `| ${label}`,
    escapeCell(match.selector),
    formatBoolean(match.visible),
    formatBoolean(match.enabled),
    escapeCell(match.tagName),
    escapeCell(match.ariaLabel || match.placeholder || ""),
    "|",
  ].join(" ");
}

async function tryClick(page, locator) {
  try {
    const count = await locator.count();
    if (count === 0) {
      return false;
    }

    await locator.first().click({ timeout: 1500 });
    return true;
  } catch (_error) {
    return false;
  }
}

async function dismissKnownInterstitials(page, siteId) {
  if (siteId !== "grok") {
    return;
  }

  await tryClick(page, page.getByRole("button", { name: /accept|agree|allow/i }));
  await tryClick(page, page.getByRole("button", { name: /동의|허용/i }));
}

async function probeSite(page, site) {
  const inputSelectors = normalizeSelectorEntries(site.inputSelector);
  const fallbackSelectors = normalizeSelectorEntries(site.fallbackSelectors ?? []);
  const submitSelectors = normalizeSelectorEntries(site.submitSelector ?? "");
  const authSelectors = normalizeSelectorEntries(site.authSelectors ?? []);
  const submitRequirement = buildSubmitRequirement(site);

  const response = {
    siteId: site.id,
    siteName: site.name,
    url: site.url,
    submitRequirement,
    inputSelectors,
    fallbackSelectors,
    submitSelectors,
    authSelectors,
  };

  try {
    await page.goto(site.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await dismissKnownInterstitials(page, site.id);
    await page.waitForTimeout(Math.max(Number(site.waitMs) || 0, 1200));
  } catch (error) {
    return {
      ...response,
      ok: false,
      error: error?.message ?? String(error),
    };
  }

  const probe = await page.evaluate(
    ({ nextInputSelectors, nextFallbackSelectors, nextSubmitSelectors, nextAuthSelectors }) => {
      function isVisible(element) {
        if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
          return true;
        }

        const style = window.getComputedStyle(element);
        if (
          element.hidden ||
          element.getAttribute("hidden") !== null ||
          element.getAttribute("aria-hidden") === "true" ||
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.visibility === "collapse"
        ) {
          return false;
        }

        return element.getClientRects().length > 0;
      }

      function isEditable(element) {
        if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
          return !element.readOnly;
        }

        return element instanceof HTMLElement ? element.isContentEditable : false;
      }

      function isEnabled(element) {
        if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          return !element.disabled;
        }

        return element instanceof HTMLElement
          ? element.getAttribute("aria-disabled") !== "true"
          : true;
      }

      function collectElementsDeep(selector, root, seen, matches) {
        if (typeof root.querySelectorAll === "function") {
          for (const element of Array.from(root.querySelectorAll(selector))) {
            if (!seen.has(element)) {
              seen.add(element);
              matches.push(element);
            }
          }
        }

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        let current = walker.currentNode;
        while (current) {
          if (current.shadowRoot) {
            collectElementsDeep(selector, current.shadowRoot, seen, matches);
          }
          current = walker.nextNode();
        }
      }

      function findFirstMatch(selectors, { editableOnly = false } = {}) {
        for (const selector of Array.isArray(selectors) ? selectors : []) {
          try {
            const matches = [];
            collectElementsDeep(selector, document, new Set(), matches);
            const target = matches.find((element) =>
              isVisible(element) && (!editableOnly || isEditable(element))
            );
            if (!target) {
              continue;
            }

            return {
              selector,
              visible: isVisible(target),
              enabled: isEnabled(target),
              tagName: target.tagName.toLowerCase(),
              ariaLabel: target.getAttribute("aria-label") ?? "",
              placeholder: target.getAttribute("placeholder") ?? "",
            };
          } catch (_error) {
            // Ignore invalid selectors in the audit report.
          }
        }

        return null;
      }

      const primaryInput = findFirstMatch(nextInputSelectors, { editableOnly: true });
      const fallbackInput = findFirstMatch(nextFallbackSelectors, { editableOnly: true });
      const submitMatch = findFirstMatch(nextSubmitSelectors);
      const authMatch = findFirstMatch(nextAuthSelectors);

      return {
        title: document.title,
        pathname: `${window.location.pathname}${window.location.search}`,
        locale: document.documentElement.lang || navigator.language || "",
        primaryInput,
        fallbackInput,
        submitMatch,
        authMatch,
        hasPromptSurface: Boolean(primaryInput || fallbackInput),
        hasAuthSurface: Boolean(authMatch),
        hasSubmitSurface: Boolean(submitMatch),
      };
    },
    {
      nextInputSelectors: inputSelectors,
      nextFallbackSelectors: fallbackSelectors,
      nextSubmitSelectors: submitSelectors,
      nextAuthSelectors: authSelectors,
    },
  );

  const deriveAuthState = AUTH_STATE_RESOLVERS[site.id] ?? (() => "");
  return {
    ...response,
    ok: true,
    ...probe,
    authState: deriveAuthState(probe),
  };
}

function renderSiteSection(result) {
  const lines = [
    `## ${result.siteName}`,
    "",
    `- URL: \`${result.url}\``,
    `- Route: \`${formatValue(result.pathname)}\``,
    `- Locale: \`${formatValue(result.locale)}\``,
    `- Auth State: \`${formatValue(result.authState)}\``,
    `- Submit Requirement: \`${formatValue(result.submitRequirement)}\``,
    `- Prompt Surface: \`${formatBoolean(result.hasPromptSurface)}\``,
    `- Auth Surface: \`${formatBoolean(result.hasAuthSurface)}\``,
    `- Submit Surface: \`${formatBoolean(result.hasSubmitSurface)}\``,
  ];

  if (!result.ok) {
    lines.push(`- Error: \`${formatValue(result.error)}\``);
    lines.push("");
    return lines.join("\n");
  }

  if (hasKnownAuthPath(result.pathname)) {
    lines.push(`- Auth Path Heuristic: \`matched\``);
  }

  lines.push("");
  lines.push("| Group | Selector | Visible | Enabled | Tag | Label / Placeholder |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  lines.push(buildMatchRow("primary-input", result.primaryInput));
  lines.push(buildMatchRow("fallback-input", result.fallbackInput));
  lines.push(buildMatchRow("submit", result.submitMatch));
  lines.push(buildMatchRow("auth", result.authMatch));
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const builtInSites = await loadBuiltInSites();
  const browser = await chromium.launch({
    headless: !process.argv.includes("--headed"),
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const results = [];

    for (const site of builtInSites) {
      results.push(await probeSite(page, site));
    }

    await mkdir(outputDir, { recursive: true });
    const reportPath = path.join(outputDir, `${timestamp}.md`);
    const reportBody = [
      "# Selector Audit",
      "",
      `- Generated At: \`${new Date().toISOString()}\``,
      `- Site Count: \`${results.length}\``,
      "",
      ...results.map((result) => renderSiteSection(result)),
    ].join("\n");

    await writeFile(reportPath, reportBody, "utf8");
    console.log(`Selector audit written to ${reportPath}`);
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error("[selector-audit] failed", error);
  process.exitCode = 1;
});
