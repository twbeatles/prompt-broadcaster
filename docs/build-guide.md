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

## Build

Create a fresh extension bundle in `dist/`:

```bash
npm run build
```

This also refreshes the generated root runtime mirrors such as `background/service_worker.js` and `popup/popup.js`.

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
```

The smoke flow loads local fixtures from `qa/fixtures/` and validates the built runtime in `dist/`. The top-level runner is `scripts/qa-smoke.mjs`, and reusable helpers live under `scripts/qa-smoke/`. Coverage includes:

- direct selector injection
- fallback selector resolution
- delayed submit-button enablement after async contenteditable input
- `click`, `enter`, and `shift+enter` submit flows
- selector checker `ok` and `auth_page` reporting
- selector checker `input-only` mode for conditional-submit UIs
- JSON import repair for invalid, duplicate, and unauthorized custom services
- alias-based custom-service permission requests and cleanup of unused optional origins
- built-in override import repair for `click` configurations with empty selectors
- `broadcastCounter` export/import/reset consistency
- import migration and export `version: 5` normalization
- favorite chain/schedule field backfill for legacy imports
- quick palette overlay filtering and execution handoff
- favorites search matching title, tags, and folders
- per-service override template resolution and retry prompt preservation
- CSV export escaping for spreadsheet formula-leading values
- pending broadcast state accumulation across sequential site completions with structured `siteResults`
- adaptive strategy-stat accumulation for injector attempts
- reusable-tab preflight filtering for auth/settings/non-input tabs
- reset helper cleanup across local and session runtime state

The smoke suite still does not cover full live Chrome popup behavior such as real-window open-tab discovery or explicit tab targeting. Check those manually in a real browser window before release.
Run `npm run build` first and then `npm run qa:smoke` after the build finishes. The smoke script reads the built files from `dist/` and should not be started in parallel with the build.

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
3. `npm run build`
4. `npm run qa:smoke`
5. Load `dist/` in Chrome and verify the extension
6. Open the toolbar popup and confirm no modal is shown on initial load
7. Open and close the favorites-save modal from the popup and confirm both `닫기` and `취소` work
8. In the popup, verify that currently open AI tabs appear under the matching service cards and that `Reuse open AI tabs` behaves as expected
   Confirm that auth pages, settings pages, and tabs without a usable prompt surface are not offered as reusable targets
9. Verify prompt submission on all built-in services, with dedicated checks for Claude click-submit behavior and Perplexity conditional submit behavior
   For Perplexity specifically, confirm that the prompt is inserted once into `#ask-input[data-lexical-editor='true']` and that submission still succeeds through the standard submit path
10. Verify that a per-service prompt override with template variables resolves correctly and that retry reuses the originally rendered prompt even after editing the popup text
11. Add, import, delete, and reset a custom service and confirm optional host permissions are granted and cleaned up only for the required origins
12. Confirm that popup sorting, favorite duplication, resend-service selection, import-report modals, and the integrated favorite editor all behave correctly
13. Verify single favorites, chain favorites, scheduled favorites, and the options `Schedules` section
14. Trigger the quick palette with `Alt+Shift+F` on an injectable page and confirm both direct execution and popup fallback flows
15. Confirm that cancelling a broadcast leaves reused tabs open and closes only newly opened tabs
16. Trigger **Reset data** and confirm it clears both local prompt data and in-memory/session runtime state, including strategy stats
17. Run the packaging script for your platform
18. Upload the generated ZIP to Chrome Web Store or attach it to a GitHub release

## Chrome Web Store Release Checklist

Use this short sequence when producing a store-ready build:

1. `npm install`
2. `npm run typecheck`
3. `npm run build`
4. `npm run qa:smoke`
5. `powershell -ExecutionPolicy Bypass -File .\\package.ps1` on Windows or `bash ./package.sh` on macOS/Linux
6. Confirm that `prompt-broadcaster-v<version>.zip` exists in the repository root
7. Confirm that the ZIP was generated from `dist/` only
8. Upload that ZIP to Chrome Web Store

Before uploading, run these manual checks in a real Chrome window:

- popup opens without showing a stale modal overlay
- favorites-save modal opens and closes normally
- ChatGPT, Gemini, Claude, Grok, and Perplexity all inject and submit from the built `dist/` extension
- Claude specifically reaches a real prompt submit path rather than clicking a decoy action button
- Perplexity specifically uses the exact Lexical composer selector and should not duplicate the prompt text before submit
- custom-service add/import/delete/reset keeps optional host permissions aligned with `url + hostnameAliases`
- per-service override retry still sends the originally resolved prompt
- reusable-tab discovery excludes auth/settings/non-input tabs
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
- Web Store checklist: [web_store_checklist.md](web_store_checklist.md)
- Privacy policy draft: [privacy-policy.md](privacy-policy.md)
