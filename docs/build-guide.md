# AI Prompt Broadcaster Build Guide

## Overview

This project uses TypeScript source files under `src/` and builds the Chrome extension bundle into `dist/`.

Important rule:

- edit source in `src/`
- build to `dist/`
- load `dist/` in Chrome

## Prerequisites

- Node.js and npm
- Google Chrome or a Chromium-based browser
- PowerShell on Windows or Bash on macOS/Linux for packaging scripts

## Install Dependencies

```bash
npm install
```

This installs:

- TypeScript
- esbuild
- Chrome type definitions

## Type Check

Run a type-only validation before building:

```bash
npm run typecheck
```

## Documentation Consistency Check

Run the Markdown consistency guard before release commits:

```bash
npm run docs:check
```

This checks the release-facing docs for export/import version drift, required validation commands, selector evidence links, and stale v8-only wording. Keep this command in the pre-publish path whenever README, CLAUDE, architecture, roadmap, selector, or Web Store docs change.

## Build

Create a fresh extension bundle in `dist/`:

```bash
npm run build
```

This also refreshes the generated root runtime mirrors such as `background/service_worker.js`, `popup/popup.js`, and `options/options.js`.
Before bundling, the build validates locale placeholder usage and `en/ko` locale key parity.
Recent refactors keep composition roots thin, so edits may live in sibling folders such as `src/background/app/bootstrap/`, `src/background/popup/favorites-workflow/`, `src/popup/app/{bootstrap,i18n,rendering}/`, `src/popup/compose/{send-flow,template-modal}/`, `src/popup/services/controller/`, and `src/shared/sites/normalizers/`. Review those source folders together with the generated root runtime mirrors before committing a release build.

If you want to wipe `dist/` first:

```bash
npm run rebuild
```

Useful related command:

```bash
npm run clean
```

## Local Smoke QA

Run the fixture-based smoke QA after building:

```bash
npm run qa:smoke
npm run selector:audit
```

The smoke flow loads local fixtures from `qa/fixtures/` and validates the built runtime in `dist/`. The top-level runner is `scripts/qa-smoke.mjs`, and reusable helpers live under `scripts/qa-smoke/`. Coverage includes:

- direct selector injection
- fallback selector resolution
- delayed submit-button enablement after async contenteditable input
- `click`, `enter`, and `shift+enter` submit flows
- selector checker `ok` and `auth_page` reporting
- selector checker conditional-submit mode for empty composer UIs
- Grok textarea-first selector preference and soft-gated auth coexistence fixtures
- internal-only runtime router trust checks and timeout-safe runtime messaging fallback
- selection helper double-injection guard
- JSON import repair for invalid, duplicate, and unauthorized custom services
- alias-based custom-service permission requests and cleanup of unused optional origins
- batched custom-site permission preflight and atomic local import commits
- built-in override import repair for `click` configurations with empty selectors
- `broadcastCounter` export/import/reset consistency
- import migration and export `version: 9` normalization, including comparison notes, prompt experiments, template packs, and service groups
- `supportedRoutes` normalization and reusable-tab route gating
- pending selector escalation (`pendingSelectorChecks` -> confirmed warning)
- `siteOrder` normalization and ordering reuse
- popup restore precedence and one-shot popup handoff consumption
- favorite chain/schedule field backfill for legacy imports
- favorite run job dedupe behavior, chain target fallback, and prepared clipboard context
- scheduled overlap skip-job recording and active-job preference
- favorite `{{counter}}` serialization across concurrent runs
- chain stop on non-`submitted` completion
- favorite failure-history recording for queue failures before broadcast creation
- scheduled-run summary isolation from manual runs
- quick palette overlay filtering and execution handoff
- favorites search matching title, text, tags, folders, and `#tag`
- per-service override template resolution and retry prompt preservation
- CSV export escaping for spreadsheet formula-leading values
- pending broadcast state accumulation across sequential site completions with structured `siteResults`
- adaptive strategy-stat accumulation for injector attempts
- dashboard metrics for heatmap, trends, failure reasons, and strategy summary
- reusable-tab preflight filtering for auth/settings/non-input tabs
- reset helper cleanup across local and session runtime state

The smoke suite still does not cover full live Chrome popup behavior such as real-window open-tab discovery or explicit tab targeting. Check those manually in a real browser window before release.
Run `npm run build` first and then `npm run qa:smoke` after the build finishes. The smoke script reads the built files from `dist/` and should not be started in parallel with the build.

Run `npm run qa:extension` after `npm run build` when you need a real extension-page E2E pass. It loads `dist/` into a persistent Chromium profile under `output/extension-e2e/`, opens options and popup pages, and verifies experiments, comparison notes, service groups, and template packs. The script runs headed by default because Chromium extension service workers are not reliable in legacy headless mode; set `APB_E2E_HEADLESS=1` only when the local Chromium build supports extension workers in headless mode.

Use the Playwright-based selector audit when you want a Markdown snapshot of the current built-in site surfaces:

```bash
npm run selector:audit
```

The audit writes Markdown reports under `output/selector-audit/` and is intended as a live verification aid, not as a replacement for the local smoke fixtures.

If Playwright does not have a browser installed yet, run:

```bash
npx playwright install chromium
```

## Output Layout

After a successful build, Chrome-ready files are placed in `dist/`.

Key outputs:

- `dist/manifest.json`
- `dist/background/service_worker.js`
- `dist/popup/popup.html`
- `dist/popup/popup.js`
- `dist/options/options.html`
- `dist/options/options.js`
- `dist/content/injector.js`
- `dist/content/palette.js`
- `dist/content/selector_checker.js`
- `dist/content/selection.js`
- `dist/onboarding/onboarding.html`

## Load the Extension in Chrome

1. Open `chrome://extensions`
2. Turn on Developer mode
3. Click `Load unpacked`
4. Select the `dist/` folder

Do not load the project root. The root contains source files, not the final runtime bundle.

## Package for Release

### Windows

```powershell
powershell -ExecutionPolicy Bypass -File .\package.ps1
```

### macOS / Linux

```bash
bash ./package.sh
```

These scripts:

1. run a fresh build
2. validate `dist/manifest.json`
3. create `prompt-broadcaster-v<version>.zip`

The generated ZIP contains the built extension from `dist/` only.

## Recommended Release Flow

1. `npm install`
2. `npm run typecheck`
3. `npm run docs:check`
4. `npm run build`
5. `npm run qa:smoke`
6. `npm run qa:extension`
7. Load `dist/` in Chrome and verify the extension
8. Open the toolbar popup and confirm no modal is shown on initial load
9. Open and close the favorites-save modal from the popup and confirm both `닫기` and `취소` work
10. In the popup, verify that currently open AI tabs appear under the matching service cards and that `Reuse open AI tabs` behaves as expected
   Confirm that auth pages, settings pages, unsupported routes, and tabs without a usable prompt surface are not offered as reusable targets
11. Verify prompt submission on all built-in services, with dedicated checks for Claude click-submit behavior and Perplexity conditional submit behavior
   For Perplexity specifically, confirm that the prompt is inserted once into `#ask-input[data-lexical-editor='true']` and that submission still succeeds through the standard submit path
12. Walk through [release-selector-verification-checklist.md](release-selector-verification-checklist.md) for every built-in touched by the release
13. Verify that a per-service prompt override with template variables resolves correctly and that retry reuses the originally rendered prompt even after editing the popup text
14. Add, import, delete, and reset a custom service and confirm optional host permissions are batch-requested, import aborts when any required origin stays denied, and cleanup only removes unused origins after commit
15. Confirm that popup sorting, favorite duplication, resend-service selection, import-report modals, and the integrated favorite editor all behave correctly
   Verify that single favorites can edit prompt body text inline and that single/chain mode switches preserve expected values
16. Verify single favorites, chain favorites, scheduled favorites, and the options `Schedules` section
   Confirm the options action label is `Edit in popup`, that the services section opens the popup manager for detailed editing, and that scheduled overlap leaves a `skipped` job without hiding any active run
17. Trigger popup-side favorite runs that use `{{clipboard}}`, `{{url}}`, or `{{selection}}` and confirm they queue without opening the editor unnecessarily
18. Trigger the quick palette with `Alt+Shift+F` on an injectable page and confirm both direct execution and popup fallback flows
19. Confirm popup fallback resumes automatically when only popup-resolvable context was missing, and opens the editor only when user-variable input is still required
20. Confirm that cancelling a broadcast leaves reused tabs open and closes only newly opened tabs
   Also confirm that stale explicit-tab targets fail with `tab_closed` semantics instead of silently falling back to another tab or a new tab
21. In options `Dashboard`, confirm the heatmap, service trend, top failure reason, and strategy summary panels render with sane labels and escaped content
22. In options `Services`, reorder services with `Move up` / `Move down` and confirm the same order appears in popup compose and favorite editor target checklists
23. Trigger **Reset data** and confirm it clears both local prompt data and in-memory/session runtime state, including `pendingSelectorChecks`, `activeComparisonContext`, and strategy stats
24. Run the packaging script for your platform
25. Upload the generated ZIP to Chrome Web Store or attach it to a GitHub release

## Chrome Web Store Release Checklist

Use this short sequence when producing a store-ready build:

1. `npm install`
2. `npm run typecheck`
3. `npm run docs:check`
4. `npm run build`
5. `npm run qa:smoke`
6. `npm run qa:extension`
7. `powershell -ExecutionPolicy Bypass -File .\\package.ps1` on Windows or `bash ./package.sh` on macOS/Linux
8. Confirm that `prompt-broadcaster-v<version>.zip` exists in the repository root
9. Confirm that the ZIP was generated from `dist/` only
10. Upload that ZIP to Chrome Web Store

Before uploading, run these manual checks in a real Chrome window:

- popup opens without showing a stale modal overlay
- favorites-save modal opens and closes normally
- ChatGPT, Gemini, Claude, Grok, and Perplexity all inject and submit from the built `dist/` extension
- stale explicit-tab sends/replays fail cleanly instead of silently rerouting
- Claude specifically reaches a real prompt submit path rather than clicking a decoy action button
- Perplexity specifically uses the exact Lexical composer selector and should not duplicate the prompt text before submit
- custom-service add/import/delete/reset keeps optional host permissions aligned with `url + hostnameAliases`
- per-service override retry still sends the originally resolved prompt
- reusable-tab discovery excludes auth/settings/non-input tabs
- options dashboard analytics panels render without broken labels or escaping issues
- options services ordering persists across reopen and affects popup/favorite editor service order
- reset-data clears both local prompt data and session runtime state
- options page, history, favorites, and service editor text render correctly in Korean
- standalone popup fallback still opens when Chrome cannot surface the toolbar action popup

## Troubleshooting

### Chrome shows manifest or import errors

- Make sure you loaded `dist/`, not the repository root
- Re-run `npm run build`
- Reload the unpacked extension in `chrome://extensions`

### Changes do not appear in Chrome

- Re-run `npm run build`
- Click refresh for the unpacked extension
- Reopen the popup or options page
- If you changed `src/background/app/bootstrap.ts` or other background modules, reload the extension so the MV3 service worker is replaced

### Popup does not show open AI tabs

- Open the popup from a normal Chrome browser window, not from an extension-only popup window
- Confirm the target AI tabs are already open in the same window
- Rebuild and reload the extension if you recently changed popup or background code
- Make sure the tab URL still matches one of the configured service hostnames or hostname aliases
- Reuse candidates also need a visible editable prompt surface, a non-auth/non-settings route, and any required click-submit controls

### Packaging fails with file lock or `EBUSY`

- Do not run `npm run build` and the packaging script in parallel
- Close editors or processes that may be locking files in `dist/`
- Retry the packaging script after the build finishes

### A source file changed but the built file did not

- Confirm that you edited `src/` rather than `dist/`
- Re-run `npm run build`

### Console shows `Could not find an active browser window`

- This can happen when the background worker tries to open the toolbar popup from a notification click or another background-only context
- Current builds first try `chrome.action.openPopup()`, then focus an existing browser window, then fall back to opening `popup/popup.html` as a standalone popup window
- If you still see the old error path, rebuild and reload the unpacked extension from `dist/`

## Related Docs

- Architecture: [extension-architecture.md](extension-architecture.md)
- Release selector checklist: [release-selector-verification-checklist.md](release-selector-verification-checklist.md)
- Web Store checklist: [web_store_checklist.md](web_store_checklist.md)
- Privacy policy draft: [privacy-policy.md](privacy-policy.md)
