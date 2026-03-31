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

The smoke flow loads local fixtures from `qa/fixtures/` and validates the built runtime in `dist/`, including:

- direct selector injection
- fallback selector resolution
- delayed submit-button enablement after async contenteditable input
- `click`, `enter`, and `shift+enter` submit flows
- selector checker `ok` and `auth_page` reporting

The smoke suite does not cover live Chrome popup behavior such as open-tab discovery, per-service tab targeting, or the reusable-tab setting. Check those manually in a real browser window before release.

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
9. Verify prompt submission on all built-in services, with a dedicated check for Claude click-submit behavior
10. Confirm that cancelling a broadcast leaves reused tabs open and closes only newly opened tabs
11. Run the packaging script for your platform
12. Upload the generated ZIP to Chrome Web Store or attach it to a GitHub release

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
- ChatGPT, Gemini, Claude, and Grok all inject and submit from the built `dist/` extension
- Claude specifically reaches a real prompt submit path rather than clicking a decoy action button
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
- If you changed `src/background/main.ts`, reload the extension so the MV3 service worker is replaced

### Popup does not show open AI tabs

- Open the popup from a normal Chrome browser window, not from an extension-only popup window
- Confirm the target AI tabs are already open in the same window
- Rebuild and reload the extension if you recently changed popup or background code
- Make sure the tab URL still matches one of the configured service hostnames or hostname aliases

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
