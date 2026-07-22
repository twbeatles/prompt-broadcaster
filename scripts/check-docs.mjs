import { readFile } from "node:fs/promises";
import process from "node:process";

const DOC_FILES = [
  "README.md",
  "CLAUDE.md",
  "PROJECT_ANALYSIS.md",
  "PROJECT_AUDIT.md",
  "docs/build-guide.md",
  "docs/extension-architecture.md",
  "docs/feature-enhancement-roadmap.md",
];

const REQUIRED_INCLUDES = [
  {
    file: "README.md",
    snippets: [
      "version: 9",
      "npm run docs:check",
      "npm run qa:extension",
      "All 5 built-in services",
      "1000-entry storage hard cap",
    ],
  },
  {
    file: "CLAUDE.md",
    snippets: [
      "version: 9",
      "npm run docs:check",
      "npm run qa:extension",
      "All 5 built-in services",
      "1000-entry storage hard cap",
    ],
  },
  {
    file: "docs/build-guide.md",
    snippets: ["npm run docs:check", "npm run qa:extension", "activeComparisonContext", "src/shared/prompts/normalizers/"],
  },
  {
    file: "PROJECT_ANALYSIS.md",
    snippets: [
      "2026-06-11",
      "src/background/app/bootstrap/app.ts",
      "src/options/features/{experiments,services}/*",
      "src/shared/prompts/normalizers/*",
    ],
  },
  {
    file: "PROJECT_AUDIT.md",
    snippets: [
      "Low-Medium",
      "src/background/app/bootstrap/app.ts",
      "npm run qa:extension",
      ".codegraph/",
    ],
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
    file: "docs/selector-verification-2026-07-22.md",
    snippets: [
      "Automated Audit Snapshot",
      "Logged-In Canonical Route Checklist",
      "Requires authenticated session",
      "input-and-conditional-submit",
      "Alert Noise Controls",
      "Promotion threshold raised to 3",
    ],
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

const GENERATED_MIRROR_TARGETS = [
  "manifest.json",
  "background/service_worker.js",
  "content/injector.js",
  "content/palette.js",
  "content/selector_checker.js",
  "content/selection.js",
  "popup/popup.html",
  "popup/popup.css",
  "popup/popup.js",
  "options/options.html",
  "options/options.css",
  "options/options.js",
  "onboarding/onboarding.html",
  "onboarding/onboarding.css",
  "onboarding/onboarding.js",
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

try {
  const builtinsText = await readFile("src/config/sites/builtins.ts", "utf8");
  const builtinCount = [...builtinsText.matchAll(/\bid:\s*"[^"]+"/g)].length;
  const conditionalCount = [...builtinsText.matchAll(/selectorCheckMode:\s*"input-and-conditional-submit"/g)].length;
  if (builtinCount !== 5 || conditionalCount !== 5) {
    failures.push(
      `src/config/sites/builtins.ts: expected 5 built-in services and 5 input-and-conditional-submit modes, found ${builtinCount}/${conditionalCount}`,
    );
  }
} catch (error) {
  failures.push(`src/config/sites/builtins.ts: unable to verify built-in selector modes (${error.message})`);
}

for (const mirrorTarget of GENERATED_MIRROR_TARGETS) {
  try {
    const [rootText, distText] = await Promise.all([
      readFile(mirrorTarget, "utf8"),
      readFile(`dist/${mirrorTarget}`, "utf8"),
    ]);
    if (rootText !== distText) {
      failures.push(`${mirrorTarget}: generated root mirror differs from dist/${mirrorTarget}; run npm run build`);
    }
  } catch (error) {
    failures.push(`${mirrorTarget}: unable to verify generated mirror (${error.message})`);
  }
}

if (failures.length > 0) {
  console.error("Documentation consistency failures found:");
  failures.forEach((entry) => console.error(`- ${entry}`));
  process.exitCode = 1;
} else {
  console.log("Docs check passed: export/version and release workflow references are current.");
}
