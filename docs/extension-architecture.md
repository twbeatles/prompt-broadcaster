# AI Prompt Broadcaster Architecture

## Overview

AI Prompt Broadcaster is a Chrome Manifest V3 extension that opens one tab per selected AI service, injects the prompt into the target page, and records the result in local Chrome storage.

The repository now uses a `src/ -> dist/` build pipeline:

- `src/`: TypeScript source of truth
- `dist/`: built extension bundle that Chrome actually loads
- `manifest.json`: source manifest copied into `dist/manifest.json` during build

For local development and QA, load `dist/` in `chrome://extensions`.

## Current Source Layout

```text
prompt-broadcaster/
├── src/
│   ├── background/
│   │   └── main.ts
│   ├── config/
│   │   └── sites.ts
│   ├── content/
│   │   ├── injector/
│   │   │   ├── dom.ts
│   │   │   ├── fallback.ts
│   │   │   ├── main.ts
│   │   │   ├── selectors.ts
│   │   │   ├── strategies.ts
│   │   │   └── submit.ts
│   │   ├── selection/
│   │   │   ├── helper.ts
│   │   │   └── main.ts
│   │   └── selector-checker/
│   │       ├── helper.ts
│   │       └── main.ts
│   ├── onboarding/
│   │   ├── helper.ts
│   │   └── main.ts
│   ├── options/
│   │   ├── main.ts
│   │   └── ui/charts.ts
│   ├── popup/
│   │   ├── main.ts
│   │   └── ui/toast.ts
│   └── shared/
│       ├── chrome/
│       ├── i18n/
│       ├── stores/
│       ├── template-utils.ts
│       └── types/
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── styles/app.css
├── options/
│   ├── options.html
│   ├── options.css
│   └── styles/app.css
├── onboarding/
│   ├── onboarding.html
│   ├── onboarding.css
│   └── styles/app.css
├── _locales/
├── icons/
├── scripts/build.mjs
├── manifest.json
└── dist/
```

## Build Pipeline

### Tooling

- TypeScript for source authoring and type checks
- esbuild for bundling runtime entrypoints
- static asset copy step for manifest, HTML, CSS, locales, icons, and helper scripts

### Main Commands

```bash
npm install
npm run typecheck
npm run build
npm run qa:smoke
```

The output bundle is written to `dist/`.

### Runtime Entry Mapping

| Source | Built output |
|---|---|
| `src/background/main.ts` | `dist/background/service_worker.js` |
| `src/popup/main.ts` | `dist/popup/popup.js` |
| `src/options/main.ts` | `dist/options/options.js` |
| `src/content/injector/main.ts` | `dist/content/injector.js` |
| `src/content/selector-checker/main.ts` | `dist/content/selector_checker.js` |
| `src/content/selection/main.ts` | `dist/content/selection.js` |
| `src/onboarding/main.ts` | `dist/onboarding/onboarding.js` |

## Main Runtime Components

### Background Service Worker

Source: `src/background/main.ts`

Responsibilities:

- receive popup and content-script messages
- open target tabs and track pending broadcasts
- reconcile `chrome.storage.session` state after worker restarts
- maintain action badge state
- create Chrome notifications
- reopen the UI through the toolbar popup when possible and fall back to a standalone popup window when no active browser window exists
- handle commands and context menu actions

### Popup

Source: `src/popup/main.ts`

Responsibilities:

- compose and send prompts
- template variable detection and substitution
- system template alias support for both Korean and English keys
- history and favorites UI
- runtime site management UI
- toast-based feedback
- restore recent broadcast state and selector warnings

### Options Page

Source: `src/options/main.ts`

Responsibilities:

- analytics dashboard
- paginated history table
- runtime service inspection and `waitMs` adjustment
- data export/import and settings controls

### Content Injector

Source: `src/content/injector/`

Responsibilities:

- deep selector lookup with fallback selectors
- visible and enabled element preference so hidden fallbacks do not win
- synthetic input strategies for `textarea`, `input`, and `contenteditable`
- submit handling by click or keyboard
- polling of click-submit buttons until they become enabled after async editor state updates
- clipboard fallback when automatic injection fails

### Selector Checker

Source: `src/content/selector-checker/`

Responsibilities:

- verify configured selectors against the live page
- report selector failures back to the background worker
- clear stale selector warnings when a later report returns `ok`
- help surface broken integrations before injection fails silently

Selector checker reports use these main statuses:

- `ok`
- `selector_missing`
- `auth_page`

### Selection Script

Source: `src/content/selection/`

Responsibilities:

- read current page selection
- cache selected text for commands and context menu flows

## Configuration and Data Flow

### Built-in Site Registry

`src/config/sites.ts` is the built-in source of truth for:

- supported AI services
- selectors and fallback selectors
- submit strategies
- authentication selectors
- default wait times
- verification metadata

### Runtime Site Storage

`src/shared/stores/sites-store.ts` merges:

- built-in site definitions from `src/config/sites.ts`
- user overrides for built-in sites
- custom user-added sites

This merged view is used by popup, options, and background flows.

Runtime site records can include:

- `fallbackSelectors`
- `authSelectors`
- `hostnameAliases`
- `lastVerified`
- `verifiedVersion`

The background worker uses `hostname` plus `hostnameAliases` as an allowlist when resolving runtime tabs back to site definitions. Built-in services keep their default hostname, while custom services can extend the allowlist with aliases.

`authSelectors` are treated as dedicated auth indicators only when no visible prompt surface is currently available on the page. This prevents public landing pages with both a login link and an editor from being misclassified as auth-only.

### Prompt and Runtime State Storage

`src/shared/stores/prompt-store.ts` and `src/shared/stores/runtime-state.ts` keep the extension state consistent.

Important storage keys:

- `promptHistory`
- `promptFavorites`
- `templateVariableCache`
- `failedSelectors`
- `pendingInjections`
- `pendingBroadcasts`
- `lastBroadcast`
- `pendingUiToasts`
- `onboardingCompleted`

### Prompt History Schema

Prompt history entries are normalized in `src/shared/stores/prompt-store.ts` and now keep three explicit service id arrays:

- `requestedSiteIds`: every service the user asked to target
- `submittedSiteIds`: services that actually reached the submission step
- `failedSiteIds`: services that failed before submission

The legacy `sentTo` field is still stored and exported for backward compatibility, and mirrors `submittedSiteIds`.

Popup and options flows should read `requestedSiteIds` first when reconstructing the original broadcast target list.

## High-Level Execution Flow

1. The user submits a prompt from the popup, a keyboard shortcut, or the context menu.
2. The background worker resolves the selected target sites and creates one tab per site.
3. Each pending injection is recorded in `chrome.storage.session`.
4. When the tab finishes loading, the background worker injects `content/injector.js`.
5. The injector locates the input field, applies the prompt, and waits for click-submit buttons to become enabled when async editors defer their internal state updates.
6. Success or failure is written back into session/local state.
7. Popup, options, badge state, and notifications reflect the latest result.

## Popup Open Flow

When the background worker needs to reopen the UI, it first persists `lastPrompt` to local storage. It then tries `chrome.action.openPopup()`. If Chrome reports that there is no active browser window, the worker focuses an existing normal browser window and retries. If that still fails, it opens `popup/popup.html` in a standalone popup window so command and notification flows still surface the composer.

## Template Variable Flow

System template variables are normalized through `src/shared/template-utils.ts`.

Canonical system keys:

- `date`
- `time`
- `weekday`
- `clipboard`

Supported aliases:

- Korean: `날짜`, `시간`, `요일`, `클립보드`
- English: `date`, `time`, `weekday`, `clipboard`

Detection, preview rendering, and final prompt rendering all normalize aliases to canonical keys so mixed-language templates still resolve consistently.

## Local QA

The repository includes a fixture-based smoke script at `scripts/qa-smoke.mjs`.

It uses Playwright against local pages in `qa/fixtures/` and validates the built injector and selector checker bundles from `dist/`.

Current smoke coverage includes:

- textarea plus click submit
- contenteditable plus click submit
- delayed contenteditable submit-button activation
- input and textarea keyboard submit paths
- fallback selector resolution
- auth selector detection for selector-check flows

## i18n and Static Assets

- Localized strings live in `_locales/ko/messages.json` and `_locales/en/messages.json`.
- `manifest.json` uses `__MSG_*__` keys for extension metadata and command descriptions.
- Popup and options pages resolve text through the shared i18n helpers and Chrome i18n API.

## Packaging and Release

For release packaging:

- Windows: `powershell -ExecutionPolicy Bypass -File .\\package.ps1`
- Unix/macOS: `bash ./package.sh`

Both scripts rebuild `dist/` and create a zip from `dist/` only.

## Notes for Contributors

- Edit TypeScript sources in `src/`, not the built files in `dist/`.
- After any source change, run `npm run build`.
- If you add a new built-in domain, update `manifest.json` host permissions and content script matches as needed.
- If you add a new custom site flow, confirm optional host permission prompts still make sense for that domain.
