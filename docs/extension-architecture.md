# AI Prompt Broadcaster Architecture

## Overview

AI Prompt Broadcaster is a Chrome Manifest V3 extension that can reuse an already-open AI tab in the current window or open a fresh tab per service, inject the prompt into the target page, and record the result in local Chrome storage.

The repository now uses a `src/ -> dist/` build pipeline:

- `src/`: TypeScript source of truth
- `dist/`: built extension bundle that Chrome actually loads
- `manifest.json`: source manifest copied into `dist/manifest.json` during build
- `src/*/main.ts`: thin composition roots that hand off to runtime-local modules

For local development and QA, load `dist/` in `chrome://extensions`.

## Current Source Layout

```text
prompt-broadcaster/
├── src/
│   ├── background/
│   │   ├── app/
│   │   │   ├── bootstrap.ts
│   │   │   └── constants.ts
│   │   └── main.ts
│   ├── config/
│   │   ├── sites/
│   │   │   ├── builtins.ts
│   │   │   └── index.ts
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
│   │   │   ├── messages.ts
│   │   │   ├── reader.ts
│   │   │   └── tracker.ts
│   │   │   └── main.ts
│   │   └── selector-checker/
│   │       ├── checks.ts
│   │       ├── dom.ts
│   │       ├── helper.ts
│   │       └── main.ts
│   │       ├── report.ts
│   │       └── runtime.ts
│   ├── onboarding/
│   │   ├── app/
│   │   │   ├── bootstrap.ts
│   │   │   ├── copy.ts
│   │   │   ├── navigation.ts
│   │   │   └── render.ts
│   │   ├── helper.ts
│   │   └── main.ts
│   ├── options/
│   │   ├── app/
│   │   │   ├── bootstrap.ts
│   │   │   ├── i18n.ts
│   │   │   └── state.ts
│   │   ├── main.ts
│   │   └── ui/charts.ts
│   ├── popup/
│   │   ├── app/
│   │   │   ├── bootstrap.ts
│   │   │   ├── i18n.ts
│   │   │   └── state.ts
│   │   ├── main.ts
│   │   └── ui/toast.ts
│   └── shared/
│       ├── chrome/
│       ├── i18n/
│       ├── prompts/
│       ├── runtime-state/
│       ├── sites/
│       ├── stores/
│       ├── template/
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

Source: `src/background/main.ts` -> `src/background/app/bootstrap.ts`

Responsibilities:

- receive popup and content-script messages
- resolve target routing, including specific reused tabs and forced new tabs
- open target tabs and track pending broadcasts
- reconcile `chrome.storage.session` state after worker restarts
- maintain action badge state
- create Chrome notifications
- reopen the UI through the toolbar popup when possible and fall back to a standalone popup window when no active browser window exists
- handle commands and context menu actions

### Popup

Source: `src/popup/main.ts` -> `src/popup/app/bootstrap.ts`

Responsibilities:

- compose and send prompts
- discover currently open AI tabs in the active browser window
- let each service use default routing, a specific tab, or a forced new tab
- template variable detection and substitution
- system template alias support for both Korean and English keys
- history and favorites UI
- runtime site management UI
- reusable-tab settings control
- toast-based feedback
- restore recent broadcast state and selector warnings

### Options Page

Source: `src/options/main.ts` -> `src/options/app/bootstrap.ts`

Responsibilities:

- analytics dashboard
- paginated history table
- runtime service inspection and `waitMs` adjustment
- data export/import and settings controls

### Content Injector

Source: `src/content/injector/`

Responsibilities:

- deep selector lookup with fallback selectors
- comma-delimited selector groups are split into ordered candidates before lookup so exact selectors can win over broad textbox matches
- visible and enabled element preference so hidden fallbacks do not win
- synthetic input strategies for `textarea`, `input`, and `contenteditable`
- Perplexity can bypass isolated-world editor limitations by writing Lexical state from the page `MAIN` world first
- submit handling by click or keyboard
- polling of click-submit buttons until they become enabled after async editor state updates
- Perplexity keeps a submit-only entry point in the standard injector so the original click-submit behavior stays intact after MAIN-world text injection
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

`src/config/sites/builtins.ts` is the built-in source of truth for:

- supported AI services
- selectors and fallback selectors
- submit strategies
- authentication selectors
- default wait times
- verification metadata

### Runtime Site Storage

`src/shared/sites/` merges:

- built-in site definitions from `src/config/sites/builtins.ts`
- user overrides for built-in sites
- custom user-added sites

This merged view is used by popup, options, and background flows.

Perplexity is normalized specially inside runtime site storage so `#ask-input[data-lexical-editor='true']` stays the first selector even when older built-in overrides exist in local storage.

Runtime site records can include:

- `fallbackSelectors`
- `authSelectors`
- `hostnameAliases`
- `permissionPatterns`
- `lastVerified`
- `verifiedVersion`

The background worker uses `hostname` plus `hostnameAliases` as an allowlist when resolving runtime tabs back to site definitions. Built-in services keep their default hostname, while custom services can extend the allowlist with aliases.

Popup tab targeting relies on that same hostname allowlist, so open-tab discovery and explicit tab selection stay aligned with the configured service registry.

Custom services also derive `permissionPatterns` from `url + hostnameAliases`. Popup save, JSON import, and background execution checks all require that full origin set. If any required origin is denied, the custom service is rejected as a whole. When custom services are deleted, reset, or replaced by import, unused optional host permissions are removed automatically.

`authSelectors` are treated as dedicated auth indicators only when no visible prompt surface is currently available on the page. This prevents public landing pages with both a login link and an editor from being misclassified as auth-only.

### Prompt and Runtime State Storage

`src/shared/prompts/` and `src/shared/runtime-state/` keep the extension state consistent.

Important storage keys:

- `promptHistory`
- `promptFavorites`
- `templateVariableCache`
- `appSettings`
- `broadcastCounter`
- `failedSelectors`
- `pendingInjections`
- `pendingBroadcasts`
- `lastBroadcast`
- `pendingUiToasts`
- `onboardingCompleted`

### Prompt History Schema

Prompt history entries are normalized in `src/shared/prompts/history-store.ts` and now keep three explicit service id arrays:

- `requestedSiteIds`: every service the user asked to target
- `submittedSiteIds`: services that actually reached the submission step
- `failedSiteIds`: services that failed before submission

The legacy `sentTo` field is still stored and exported for backward compatibility, and mirrors `submittedSiteIds`.

Popup and options flows should read `requestedSiteIds` first when reconstructing the original broadcast target list.

`appSettings` also stores reusable-tab behavior, including `reuseExistingTabs`, which controls whether the default routing mode prefers matching open AI tabs before creating new ones.

### Broadcast Counter

`broadcastCounter` is stored in local storage and exported with prompt data JSON `version: 3`.

- popup preview resolves `{{counter}}` as `current + 1`
- the stored counter increments only when a broadcast queues at least one target site
- import normalizes missing legacy values to `0`
- reset-data flows clear the counter together with the rest of the user data

## High-Level Execution Flow

1. The user submits a prompt from the popup, a keyboard shortcut, or the context menu.
2. Popup routing can specify default behavior, a forced new tab, or a specific already-open AI tab per service.
3. The background worker resolves the final target for each service and queues them in the selected order.
4. Each pending injection is recorded in `chrome.storage.session`.
5. When a target tab is ready, the background worker focuses it, injects `content/injector.js`, and waits for the injection result before moving on to the next queued tab.
6. The injector locates the input field, applies the prompt, and waits for click-submit buttons to become enabled when async editors defer their internal state updates.
7. Perplexity is a special case: the background worker first writes the prompt from the page `MAIN` world so Lexical state stays consistent, then hands submission back to the standard injector submit path.
8. Success or failure is written back into session/local state.
9. Popup, options, badge state, and notifications reflect the latest result.

If a broadcast is cancelled, the worker closes only tabs that were opened for that broadcast. Reused tabs are left open.

## Popup Open Flow

When the background worker needs to reopen the UI, it first persists `lastPrompt` to local storage. It then tries `chrome.action.openPopup()`. If Chrome reports that there is no active browser window, the worker focuses an existing normal browser window and retries. If that still fails, it opens `popup/popup.html` in a standalone popup window so command and notification flows still surface the composer.

## Template Variable Flow

System template variables are normalized through `src/shared/template/` with `src/shared/template-utils.ts` kept as a compatibility barrel.

Canonical system keys:

- `date`
- `time`
- `weekday`
- `clipboard`
- `url`
- `title`
- `selection`
- `counter`
- `random`

Supported aliases:

- Korean: `날짜`, `시간`, `요일`, `클립보드`, `주소`, `제목`, `선택`, `카운터`, `랜덤`
- English: `date`, `time`, `weekday`, `clipboard`, `url`, `title`, `selection`, `counter`, `random`

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
- selector checker `input-only` mode for conditional-submit services
- import repair for invalid and unauthorized custom service JSON
- alias-based custom service optional permission handling
- custom service permission cleanup after delete and reset
- built-in override repair for invalid click-submit imports
- `broadcastCounter` export/import/reset semantics
- favorites search across title, tags, and folders

Popup open-tab discovery and explicit tab targeting are validated manually in Chrome, not by the local fixture smoke suite.

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
