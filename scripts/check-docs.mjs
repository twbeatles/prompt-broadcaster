import { readFile } from "node:fs/promises";
import process from "node:process";

const DOC_FILES = [
  "README.md",
  "CLAUDE.md",
  "docs/build-guide.md",
  "docs/extension-architecture.md",
  "docs/feature-enhancement-roadmap.md",
];

const REQUIRED_INCLUDES = [
  {
    file: "README.md",
    snippets: ["version: 9", "npm run docs:check", "npm run qa:extension"],
  },
  {
    file: "CLAUDE.md",
    snippets: ["version: 9", "npm run docs:check", "npm run qa:extension"],
  },
  {
    file: "docs/build-guide.md",
    snippets: ["npm run docs:check", "npm run qa:extension", "activeComparisonContext"],
  },
  {
    file: "docs/extension-architecture.md",
    snippets: ["npm run docs:check", "npm run qa:extension", "activeComparisonContext"],
  },
  {
    file: "docs/web_store_checklist.md",
    snippets: ["npm run docs:check", "npm run qa:extension", "selector:audit", "AI response"],
  },
  {
    file: "docs/selector-verification-2026-05-11.md",
    snippets: ["Automated Audit Snapshot", "Logged-In Canonical Route Checklist", "Requires authenticated session"],
  },
  {
    file: "docs/privacy-policy.md",
    snippets: ["captured AI response text", "developer-controlled servers"],
  },
  {
    file: "docs/web-store-copy.md",
    snippets: ["saved AI responses", "developer-controlled servers"],
  },
];

const STALE_EXPORT_VERSION_PATTERNS = [
  /version:\s*8/i,
  /export\s+`?version:\s*8`?/i,
  /export\s+version\s*8/i,
  /import\/export\s+v8/i,
];

const failures = [];

for (const file of DOC_FILES) {
  const text = await readFile(file, "utf8");
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (STALE_EXPORT_VERSION_PATTERNS.some((pattern) => pattern.test(line))) {
      failures.push(`${file}:${index + 1}: ${line.trim()}`);
    }
  });
}

for (const { file, snippets } of REQUIRED_INCLUDES) {
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    failures.push(`${file}: missing required documentation file (${error.message})`);
    continue;
  }

  for (const snippet of snippets) {
    if (!text.includes(snippet)) {
      failures.push(`${file}: missing required snippet "${snippet}"`);
    }
  }
}

if (failures.length > 0) {
  console.error("Documentation consistency failures found:");
  failures.forEach((entry) => console.error(`- ${entry}`));
  process.exitCode = 1;
} else {
  console.log("Docs check passed: export/version and release workflow references are current.");
}
