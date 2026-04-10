# AI Prompt Broadcaster Architecture

## Overview

AI Prompt Broadcaster is a Chrome Manifest V3 extension that sends one prompt to multiple AI chat services, can reuse an already-open AI tab in the current window, and records execution state in Chrome local/session storage.

The repository uses a `src/ -> dist/` build pipeline:

- `src/`: TypeScript source of truth
- `dist/`: built extension bundle that Chrome actually loads
- `manifest.json`: source manifest copied into `dist/manifest.json` during build
- `src/*/main.ts`: thin composition roots that hand off to feature-oriented runtime modules

For local development and QA, load `dist/` in `chrome://extensions`.

## Current Source Layout

```text
prompt-broadcaster/
├── src/
│   ├── background/
│   │   ├── app/
│   │   │   ├── bootstrap.ts
│   │   │   ├── constants.ts
│   │   │   └── injection-helpers.ts
│   │   ├── commands/
│   │   │   └── quick-palette.ts
│   │   ├── context-menu/
│   │   │   └── index.ts
│   │   ├── messages/
│   │   │   └── router.ts
│   │   ├── popup/
│   │   │   ├── favorites-workflow.ts
│   │   │   └── launcher.ts
│   │   ├── selection/
│   │   │   └── runtime.ts
│   │   └── main.ts
│   ├── config/
│   │   ├── sites/
│   │   │   ├── builtins.ts
│   │   │   └── index.ts
│   │   └── sites.ts
│   ├── content/
│   │   ├── injector/
│   │   ├── palette/
│   │   ├── selection/
│   │   └── selector-checker/
│   ├── onboarding/
│   │   ├── app/
│   │   └── main.ts
│   ├── options/
│   │   ├── app/
│   │   ├── core/
│   │   ├── features/
│   │   ├── ui/
│   │   └── main.ts
│   ├── popup/
│   │   ├── app/
│   │   ├── features/
│   │   ├── ui/
│   │   └── main.ts
│   └── shared/
│       ├── broadcast/
│       ├── chrome/
│       ├── export/
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
│   └── styles/
│       ├── app.css
│       └── partials/
├── options/
│   ├── options.html
│   └── styles/
│       ├── app.css
│       └── partials/
├── onboarding/
├── _locales/
├── icons/
├── qa/fixtures/
├── scripts/
│   ├── build.mjs
│   ├── qa-smoke.mjs
│   ├── selector-audit.mjs
│   └── qa-smoke/
├── manifest.json
└── dist/
```

## Build Pipeline

### Tooling

- TypeScript for source authoring and type checks
- esbuild for bundling runtime entrypoints
- static asset copy for manifest, HTML, CSS, locales, icons, and helper assets

### Main Commands

```bash
npm install
npm run typecheck
npm run build
npm run qa:smoke
npm run selector:audit
```

### Runtime Entry Mapping

| Source | Built output |
|---|---|
| `src/background/main.ts` | `dist/background/service_worker.js` |
| `src/popup/main.ts` | `dist/popup/popup.js` |
| `src/options/main.ts` | `dist/options/options.js` |
| `src/content/injector/main.ts` | `dist/content/injector.js` |
| `src/content/palette/main.ts` | `dist/content/palette.js` |
| `src/content/selector-checker/main.ts` | `dist/content/selector_checker.js` |
| `src/content/selection/main.ts` | `dist/content/selection.js` |
| `src/onboarding/main.ts` | `dist/onboarding/onboarding.js` |

## Main Runtime Components

### Background Service Worker

Entry: `src/background/main.ts` -> `src/background/app/bootstrap.ts`

Responsibilities:

- register Chrome listeners and wire runtime dependencies
- route popup/content/runtime messages through `src/background/messages/router.ts`
- accept only internal extension pages and this extension's own content scripts at the runtime-message trust boundary
- resolve tab routing, including reusable tabs, specific tab targets, and forced new tabs
- open target tabs and track pending broadcasts
- maintain action badge state, notifications, selector alerts, and popup reopen flow
- run favorite execution workflows through `src/background/popup/favorites-workflow.ts`
- reconcile favorite schedules with `chrome.alarms`
- launch or fall back to popup windows through `src/background/popup/launcher.ts`
- handle quick palette command injection through `src/background/commands/quick-palette.ts`
- delegate timeout scaling, selector normalization, result-code mapping, and adaptive strategy ordering to `src/background/app/injection-helpers.ts`

### Popup

Entry: `src/popup/main.ts` -> `src/popup/app/bootstrap.ts`

Responsibilities:

- compose and send prompts
- resolve template variables and per-service prompt overrides
- list currently open AI tabs in the active browser window
- manage history, favorites, resend, duplication, sorting, and import reports
- host the integrated favorite editor for single favorites, chain favorites, and schedules
- restore broadcast state and selector warning badges
- enforce popup keyboard shortcuts, modal dismissal, and list roving focus

Popup helper boundaries:

- `src/popup/app/dom.ts`: DOM registry
- `src/popup/app/helpers.ts`, `sorting.ts`, `list-markup.ts`: pure formatting and markup helpers
- `src/popup/features/favorite-editor.ts`: modal state, chain steps, schedule fields, favorite run/edit actions
- `src/shared/chrome/messaging.ts`: timeout-safe runtime messaging helper shared by popup/options/content surfaces

### Options Page

Entry: `src/options/main.ts` -> `src/options/app/bootstrap.ts`

Responsibilities:

- analytics dashboard and charts
- paginated history table and detail modal
- bulk deletion and CSV export
- runtime service inspection and `waitMs` controls
- import/export, reset-data, shortcut display, and general settings
- scheduled-favorite list with toggle, `Run now`, and popup editor handoff
- persisted service ordering controls (`Move up` / `Move down`) reused by popup and favorite editor
- separate last-scheduled-run result summaries from manual favorite runs

Options helper boundaries:

- `src/options/core/`: shared status, navigation, reload, and filter helpers
- `src/options/features/`: dashboard, history, schedules, services, and settings sections
- `src/options/features/dashboard-metrics.ts`: pure aggregation for cards, heatmap, trends, failure reasons, and strategy summary
- `src/options/features/schedule-summary.ts`: pure scheduled-run summary helper
- `src/options/ui/charts.ts`: chart rendering

### Content Injector

Source: `src/content/injector/`

Responsibilities:

- deep selector lookup with fallback selectors
- ordered selector-group handling so exact selectors win over broad textbox matches
- visible/enabled element preference
- input strategies for `textarea`, `input`, and `contenteditable`
- click, `Enter`, and `Shift+Enter` submit flows
- delayed click-submit polling so async editors can enable the real submit button
- clipboard fallback when automatic injection fails

### Selector Checker

Source: `src/content/selector-checker/`

Responsibilities:

- verify configured selectors against the live page
- report selector failures back to the background worker
- detect dedicated auth/login pages
- ignore empty-state submit absence for services using conditional submit preflight semantics
- clear stale warnings when later checks recover

Main statuses:

- `ok`
- `selector_missing`
- `auth_page`

### Selection Script

Source: `src/content/selection/`

Responsibilities:

- read current page selection
- cache selected text for commands and context-menu flows

### Quick Palette Overlay

Source: `src/content/palette/main.ts`

Responsibilities:

- render a shadow-root overlay over the current page
- search favorites by title, text, folder, tags, and `#tag` queries with the same matcher used by popup favorites
- support arrow-key navigation, `Enter`, and `Escape`
- request favorite execution from the background worker
- close when the background asks for popup fallback or when the user dismisses it

## Configuration and Data Flow

### Built-in Site Registry

`src/config/sites/builtins.ts` is the built-in source of truth for:

- supported AI services
- selectors and fallback selectors
- submit strategies
- authentication selectors
- default wait times
- verification metadata

`src/config/sites.ts` remains a compatibility barrel around the canonical `src/config/sites/` exports.

### Runtime Site Storage

`src/shared/sites/` merges:

- built-in site definitions
- user overrides for built-ins
- custom user-added sites

This merged view is used by popup, options, and background.

Runtime site records can include:

- `fallbackSelectors`
- `authSelectors`
- `hostnameAliases`
- `permissionPatterns`
- `lastVerified` (legacy `YYYY-MM` compatibility field)
- `verifiedAt`
- `verifiedRoute`
- `verifiedAuthState`
- `verifiedLocale`
- `verifiedVersion`

Custom service permissions are derived from `url + hostnameAliases`. Save, import, and runtime execution checks are all-or-nothing for that required origin set.
Runtime site ordering is persisted separately in `appSettings.siteOrder` and then applied consistently by popup, favorite editor, and options services.

### Prompt, Favorite, and Runtime State Storage

Important local-storage keys:

- `promptHistory`
- `promptFavorites`
- `templateVariableCache`
- `appSettings`
- `broadcastCounter`
- `composeDraftPrompt`
- `lastSentPrompt`
- `failedSelectors`
- `onboardingCompleted`
- `strategyStats`
- `appSettings.siteOrder` (inside `appSettings`)

Important session-storage keys:

- `pendingInjections`
- `pendingBroadcasts`
- `selectorAlerts`
- `lastBroadcast`
- `pendingUiToasts`
- `popupPromptIntent`
- `popupFavoriteIntent`
- `favoriteRunJobs`

The background worker mirrors `pendingInjections`, `pendingBroadcasts`, and `selectorAlerts` in memory and updates them through a serialized mutation chain so overlapping completions and cancellations do not lose results. Favorite popup intents and favorite run jobs are stored through `src/shared/runtime-state/`.

### Prompt History Schema

History entries are normalized in `src/shared/prompts/history-store.ts` and include:

- `requestedSiteIds`
- `submittedSiteIds`
- `failedSiteIds`
- `sentTo` as a backward-compatible mirror of `submittedSiteIds`
- `siteResults: Record<string, SiteInjectionResult>`
- optional favorite/chain metadata:
  - `originFavoriteId`
  - `chainRunId`
  - `chainStepIndex`
  - `chainStepCount`
  - `trigger`

### Favorite Schema

Favorites are normalized in `src/shared/prompts/favorites-store.ts` and include:

- `mode: "single" | "chain"`
- `steps: ChainStep[]`
- `scheduleEnabled`
- `scheduledAt`
- `scheduleRepeat`
- `usageCount`
- `lastUsedAt`

Chain favorites store ordered steps. Scheduled favorites use the same record as the single source of truth for `chrome.alarms`.

Background favorite jobs also persist a normalized step list plus `FavoriteRunExecutionContextSnapshot`, which now includes a prepared `clipboard` field for popup-triggered runs.
Favorite prompt rendering plus queue submission is serialized so concurrent `{{counter}}` favorite runs do not reuse the same counter value.

### Structured Result Codes

`siteResults` store structured `SiteInjectionResult` objects with codes such as:

- `submitted`
- `selector_timeout`
- `auth_required`
- `submit_failed`
- `strategy_exhausted`
- `permission_denied`
- `tab_create_failed`
- `tab_closed`
- `injection_timeout`
- `cancelled`
- `unexpected_error`

### Broadcast Counter and Export Version

`broadcastCounter` is stored in local storage and exported with prompt data JSON `version: 7`.

- popup preview resolves `{{counter}}` as `current + 1`
- the stored counter increments only when a broadcast queues at least one target site
- import migrates older payloads through `v1 -> v2 -> v3 -> v4 -> v5 -> v6 -> v7`
- runtime site verification metadata is preserved as structured fields, while `lastVerified` is derived from `verifiedAt` when available
- `appSettings.historyLimit` is a non-destructive default visible cap. Popup/options history lists apply it at read time, while storage and JSON export keep the full history set.
- reset-data clears the counter together with the rest of the user data

### Strategy Stats and Pending Tab Tracking

- `strategyStats` stores per-site success/failure counts for injector strategies
- `pendingBroadcasts` also keep `openedTabIds`
- cancellation closes only tabs opened for the current broadcast; reused tabs are preserved

## High-Level Execution Flows

### Standard Popup Broadcast

1. The user submits a prompt from the popup.
2. Popup resolves template variables across the main prompt and enabled per-service overrides.
3. Popup sends a broadcast request with resolved targets.
4. Background resolves routing, opens or reuses tabs, and records pending state.
5. Injector writes the prompt, submits it, and reports a structured result.
6. Background updates history, last-broadcast state, badge state, and notifications.

### Favorite Run / Chain Run

1. A favorite run can start from popup, options, quick palette, or an alarm.
2. Popup-triggered runs prepare `url`, `title`, `selection`, and `clipboard` when possible and include that context in the runtime message.
3. Background validates whether all required template inputs are resolvable and stores a normalized effective step list in the favorite job record.
4. For single favorites, background queues one broadcast.
5. For chain favorites, background queues one step at a time and waits for completion before moving on.
6. Empty chain-step target overrides inherit the favorite default targets.
7. If any step result is not `submitted`, the remaining chain steps are skipped.
8. Favorite-run dedupe blocks only overlapping `queued/running` jobs for the same favorite.

### Scheduled Favorite Run

1. Background reconciles alarms from favorite storage on startup, install, favorite edits, and imports.
2. When `chrome.alarms` fires, background loads the favorite and validates scheduled-safe variables.
3. One-time schedules clear themselves after execution.
4. Repeating schedules compute the next `scheduledAt` and re-register the alarm.
5. Options summarizes the latest `trigger === "scheduled"` history entry separately from manual runs so failed schedules stay visible even after later manual retries.

### Quick Palette

1. `Alt+Shift+F` triggers the background quick-palette command.
2. Background injects `content/palette.js` when the page supports content scripts.
3. The overlay asks the background for favorite search state.
4. Entering a favorite either runs it directly or falls back to popup handoff when additional inputs are required.
5. If the missing values are popup-resolvable only (for example clipboard or active-tab context), the popup retries automatically before showing the editor.

## Options Analytics and Service Ordering

- The options `Dashboard` now includes overview cards, usage share, 7-day activity bars, a weekday/hour heatmap, per-service success trends, top failure reasons, and a strategy summary backed by `strategyStats`.
- The options `Services` section persists runtime site order through `appSettings.siteOrder` using accessible `Move up` / `Move down` buttons instead of drag-and-drop.
- That saved order is reused by popup compose service cards, favorite editor target lists, and the options services list. Explicit broadcast target arrays still keep their own requested order.

## Template Variable Flow

System template variables are normalized through `src/shared/template/`.

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

Korean aliases normalize to the same canonical keys. Detection, preview rendering, and final prompt rendering use the same normalization path.

Scheduled favorites intentionally block variables that require live page context or clipboard access:

- `url`
- `title`
- `selection`
- `clipboard`

Popup-triggered favorite runs can resolve those same variables ahead of queueing, including `clipboardRead`-backed `{{clipboard}}`.

## Local QA

The repository includes a fixture-based smoke runner at `scripts/qa-smoke.mjs` plus helpers in `scripts/qa-smoke/`. It validates the built bundles from `dist/` against local fixtures in `qa/fixtures/`.

Current smoke coverage includes:

- direct selector injection
- fallback selector injection
- visible element preference when hidden matches exist
- delayed click-submit activation
- `click`, `enter`, and `shift+enter` submission paths
- selector checker `ok` and `auth_page` reporting
- conditional-submit / Grok textarea-first / soft-gated auth coexistence fixtures
- internal-only runtime router trust checks and timeout-safe runtime messaging fallback
- custom service permission cleanup and alias-origin handling
- built-in override repair for invalid click-submit imports
- `broadcastCounter` export/import/reset semantics
- import migration to export `version: 7`
- `siteOrder` normalization and ordering reuse
- favorite chain/schedule field normalization for legacy imports
- favorite run job dedupe, effective chain-target fallback, and prepared clipboard context
- favorite `{{counter}}` serialization across concurrent runs
- failure history creation for pre-broadcast favorite job failures
- scheduled-run summary isolation from manual runs
- quick palette filtering and execution
- favorites search across title, text, tags, folders, and `#tag`
- per-service override template resolution and retry prompt preservation
- structured `siteResults` accumulation
- adaptive strategy-stat accumulation
- dashboard metrics for heatmap, trend, failure reasons, and strategy summary
- reusable-tab preflight rejection for auth/settings/non-input tabs
- reset helper cleanup across local and session runtime state

## i18n and Static Assets

- Localized strings live in `_locales/ko/messages.json` and `_locales/en/messages.json`.
- `manifest.json` uses `__MSG_*__` keys for extension metadata and command descriptions.
- Popup and options text resolve through shared i18n helpers and Chrome i18n APIs.
- `npm run build` now validates locale key parity and placeholder parity across the checked locale files before bundling.

## Packaging and Release

For release packaging:

- Windows: `powershell -ExecutionPolicy Bypass -File .\package.ps1`
- Unix/macOS: `bash ./package.sh`

Both scripts rebuild `dist/` and create a zip from `dist/` only.

## Notes for Contributors

- Edit TypeScript sources in `src/`, not built files in `dist/`.
- After any source change, run `npm run build`.
- If you add a new built-in domain, update `manifest.json` host permissions and content-script matches.
- If you add a new custom-site flow, verify optional host permission prompts still make sense.
- If you change popup or options structure, keep the DOM ids and runtime message contracts stable unless you update every caller.
