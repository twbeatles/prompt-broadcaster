# AI Prompt Broadcaster Claude Code Guide

## Project Overview

Chrome Manifest V3 extension that injects one prompt into multiple AI chat services.
No backend and no API keys are required. Prompts are injected directly into each service's DOM via `chrome.scripting.executeScript`.

Source of truth: `src/` (TypeScript). Chrome loads the built output in `dist/`, and the root runtime JS files are generated mirrors refreshed by `npm run build`.
`src/*/main.ts` files stay thin and delegate to feature-oriented runtime modules. The largest entrypoints are composition roots; background logic is further split into `commands/`, `context-menu/`, `messages/`, `popup/`, and `selection/`, while options and popup also use `core/`, `features/`, and CSS partial directories.

## Essential Commands

```bash
npm install
npm run build
npm run typecheck
npm run qa:smoke
npm run selector:audit
```

After any source change, run `npm run build` before testing in Chrome.

To package a release zip:

- Windows: `powershell -ExecutionPolicy Bypass -File .\package.ps1`
- macOS/Linux: `bash ./package.sh`

## Source to Build Mapping

| Source | Built output |
|---|---|
| `src/background/main.ts` | `dist/background/service_worker.js` |
| `src/popup/main.ts` | `dist/popup/popup.js` |
| `src/options/main.ts` | `dist/options/options.js` |
| `src/content/injector/main.ts` | `dist/content/injector.js` |
| `src/content/selector-checker/main.ts` | `dist/content/selector_checker.js` |
| `src/content/selection/main.ts` | `dist/content/selection.js` |
| `src/onboarding/main.ts` | `dist/onboarding/onboarding.js` |
| `popup/styles/app.css` | `dist/popup/styles/app.css` |
| `options/styles/app.css` | `dist/options/styles/app.css` |
| `_locales/` | `dist/_locales/` |

## Key Files

### Configuration
- `src/config/sites/builtins.ts`: built-in AI service definitions
- `src/config/sites.ts`: compatibility export used by existing imports
- `manifest.json`: extension manifest, permissions, and content script matches

### UI
- `popup/popup.html`: popup markup
- `popup/styles/app.css`: popup styling
- `options/options.html`: dashboard markup
- `options/styles/app.css`: dashboard styling

### Logic
- `src/shared/sites/`: built-in, override, and custom site merging
- `src/shared/sites/order.ts`: persisted runtime site ordering helper
- `src/shared/prompts/`: history, favorites, template cache, broadcast counter, import/export, and settings
- `src/shared/chrome/messaging.ts`: timeout-safe runtime messaging helper for popup/options/content surfaces
- `src/shared/runtime-state/`: last broadcast, UI toasts, selector warning state, and strategy stats
- `src/shared/template/`: template detection and rendering
- `src/popup/app/bootstrap.ts`: popup orchestration and feature wiring
- `src/popup/app/dom.ts`, `helpers.ts`, `sorting.ts`, `list-markup.ts`: popup DOM registry and pure UI helpers
- `src/popup/app/i18n.ts`, `src/popup/app/state.ts`: popup state and copy
- `src/popup/features/favorite-editor.ts`: integrated favorite editor for single/chain/schedule flows
- `src/options/app/bootstrap.ts`: options orchestration and section wiring
- `src/options/core/`: shared status, navigation, data refresh, and filter helpers
- `src/options/features/`: dashboard, history, schedules, services, and settings sections
- `src/options/features/dashboard-metrics.ts`: pure dashboard aggregation for cards, heatmap, trends, failures, and strategy summary
- `src/options/features/schedule-summary.ts`: pure scheduled-run summary helper used by options schedules UI
- `src/options/ui/charts.ts`: chart rendering
- `src/background/app/bootstrap.ts`: service worker composition root
- `src/background/commands/quick-palette.ts`: command handling and content-script injection for the page overlay
- `src/background/context-menu/index.ts`: context-menu lifecycle
- `src/background/messages/router.ts`: runtime message routing
- `src/background/popup/launcher.ts`: popup/open-window fallback handling
- `src/background/popup/favorites-workflow.ts`: favorite run, chain, and schedule workflow
- `src/background/selection/runtime.ts`: active-tab selection helpers
- `src/background/app/injection-helpers.ts`: timeout scaling, selector normalization, result mapping, adaptive strategy ordering
- `src/content/palette/main.ts`: shadow-root quick palette overlay
- `src/content/selector-checker/` and `src/content/selection/`: modular content helpers split by runtime, DOM, and reporting concerns
- `scripts/qa-smoke.mjs` + `scripts/qa-smoke/`: local smoke runner and reusable fixtures/helpers

### i18n
- `_locales/en/messages.json`
- `_locales/ko/messages.json`

## Architecture Notes

### Template variables
System variables: `{{date}}`, `{{time}}`, `{{weekday}}`, `{{clipboard}}`, plus Korean aliases.
All aliases normalize to canonical English keys in `src/shared/template/`.
Popup scans the main prompt and every enabled per-service override together, resolves a site-level `resolvedPrompt` before dispatch, and retry flows should reuse that stored resolved prompt instead of re-reading current UI state.
Favorite runs use the same popup-side context preparation for `{{url}}`, `{{title}}`, `{{selection}}`, and `{{clipboard}}` before the background worker queues the job.

### Injection flow
1. Popup sends a broadcast message with one target per selected service.
2. Each target can use default routing, force a new tab, or point to a specific already-open AI tab.
3. Popup includes `resolvedPrompt` when a target prompt has already been rendered from template variables or a per-service override.
4. Background prefers `resolvedPrompt` over raw `promptOverride` when injecting or retrying.
5. Background queues targets in order and processes them sequentially so focus-sensitive editors are handled more reliably.
6. On tab readiness, background injects `content/injector.js`.
7. Injector finds the input, applies the prompt, and waits for click-submit buttons to become enabled when async editors delay state updates.
8. Results are written back to `chrome.storage.session`.
9. Popup updates send-status icons and restored broadcast state.

### Open-tab targeting
- Popup can query the current normal browser window for open AI tabs mapped to configured services.
- Service cards can target a specific tab, force a new tab, or follow the default reuse policy.
- Default reuse behavior is stored in `appSettings.reuseExistingTabs` and can be changed from the popup or options page.
- Matching hostname alone is not enough for reuse. Background also preflights the tab for non-auth/non-settings route, visible editable prompt surface, and required submit controls.
- `SelectorCheckMode` now supports `input-and-conditional-submit` for services whose submit button appears only after text entry. Reusable-tab preflight skips the empty-state submit check for that mode, while actual injection still waits through `submitPrompt()`.
- Cancelling a broadcast only closes tabs opened for that broadcast. Reused tabs are preserved.

### Custom service permissions
- Runtime sites expose `permissionPatterns` derived from `url + hostnameAliases`.
- Popup save, JSON import, and background permission checks all require the full origin set for a custom service.
- Deleting custom services, resetting service settings, or replacing imported custom services should remove unused optional host permissions.

### Import/export and counter semantics
- JSON export now writes `version: 7` and import migrates older payloads through `v1 -> v2 -> v3 -> v4 -> v5 -> v6 -> v7`.
- Runtime sites keep structured selector verification metadata: `verifiedAt`, `verifiedRoute`, `verifiedAuthState`, `verifiedLocale`, `verifiedVersion`. Legacy `lastVerified` remains for compatibility and is derived from `verifiedAt` when present.
- `{{counter}}` preview uses `current + 1`, but the stored counter only increments when at least one target site is successfully queued.
- `appSettings.historyLimit` is now a default visible history cap only. Lower values hide older rows in popup/options without deleting stored history, and export/import still operate on the full stored history.
- History and last-broadcast records store structured `siteResults` (`SiteInjectionResult`) instead of plain status strings.
- History and last-broadcast records also store `targetSnapshots` so retries and history replay reuse the original per-site resolved prompt and routing mode.
- Favorites also keep `mode`, `steps`, `scheduleEnabled`, `scheduledAt`, `scheduleRepeat`, `usageCount`, and `lastUsedAt`, and `appSettings` includes `waitMsMultiplier`, `historySort`, and `favoriteSort`.
- `appSettings.siteOrder` stores the persisted runtime-site ordering used by popup, favorite editor, and options services.
- Favorite runs now queue as background jobs, dedupe only overlapping `queued/running` executions per favorite, and surface light progress through `favoriteRunJobs` in session state.
- History rows can also store `originFavoriteId`, `chainRunId`, `chainStepIndex`, `chainStepCount`, and `trigger`.
- Reset-data flows should clear `broadcastCounter`, `strategyStats`, history, favorites, template cache, prompt draft/sent state, site data, and session runtime state such as `pendingBroadcasts`, `pendingInjections`, `pendingUiToasts`, `lastBroadcast`, `popupPromptIntent`, and `favoriteRunJobs`.
- CSV exports are built through `src/shared/export/csv.ts`, which quotes cells and prefixes formula-leading values with `'`.

### Background state consistency
- Pending injections, pending broadcasts, and selector alerts are mirrored in background memory and written through a serialized mutation chain.
- History append, last-broadcast sync, counter updates, and completion notifications should happen off the same finalized broadcast state, not ad-hoc read-modify-write calls from multiple surfaces.
- Favorite prompt rendering plus queue submission is serialized so concurrent `{{counter}}` favorite runs do not reuse the same counter value.

### Runtime messaging trust boundary
- Popup, options, and content helpers should use `src/shared/chrome/messaging.ts` instead of raw `chrome.runtime.sendMessage` when hangs or closed-port fallbacks matter.
- `src/background/messages/router.ts` now accepts only internal extension pages (`sender.id === chrome.runtime.id`) and this extension's own content scripts (`sender.tab` present).
- Safe `sendResponse` wrappers are required because the response port may already be closed by the time an async handler settles.

### Popup reopening fallback
When `chrome.action.openPopup()` fails because Chrome has no active browser window, the background worker stores a one-shot `popupPromptIntent`, tries to focus an existing browser window, and finally opens `popup/popup.html` in a standalone popup window.

### Popup behavior additions
- Popup supports internal shortcuts for send, cancel, tab switching, modal dismissal, and list keyboard navigation.
- History replay now opens a service-selection modal before resend and reuses stored per-site snapshots when present.
- Popup and options both show a detailed import report after JSON import.
- The favorite editor handles both single favorites and chain/scheduled favorites.
- Single favorites can now edit prompt body text directly inside the favorite editor without switching back to the composer first.
- Chain favorites stop immediately when any step result is not `submitted`.
- Scheduled favorites are reconciled through `chrome.alarms`, and options exposes a dedicated `Schedules` section.
- The options `Schedules` section also separates the last scheduled execution from manual runs and surfaces its timestamp, status, and representative failure detail.
- Popup composer restore is draft-first: unsent draft is restored before any last-sent prompt, and popup handoff is consumed after one use.
- Quick palette uses `Alt+Shift+F`, matches popup favorite search across title/text/folder/tags/`#tag`, and falls back to popup handoff when additional inputs are required.
- Options `Services` supports accessible `Move up` / `Move down` ordering controls, persisted through `appSettings.siteOrder`.
- Options `Dashboard` now renders a weekday/hour heatmap, per-service success trends, top failure reasons, and a strategy summary in addition to the original overview cards.

### Selector checker
Runs on supported pages and reports `ok`, `selector_missing`, or `auth_page` back to the background worker.
Popup uses that state to show selector warning badges.

### Toast styling
Toast CSS is injected by `src/popup/ui/toast.ts`.
Do not duplicate toast styles in `popup/styles/app.css`.

## Adding a New AI Service

1. Add a definition to `src/config/sites/builtins.ts`.
2. Add the domain to `manifest.json` host permissions and content script matches if needed.
3. Run `npm run build`.
4. Reload the unpacked extension in Chrome.
5. Update README service documentation if user-facing behavior changed.

## Testing

Smoke QA lives in `qa/` and uses Playwright against local fixtures.

```bash
npx playwright install chromium
npm run qa:smoke
npm run selector:audit
```

Smoke coverage includes:

- textarea and contenteditable injection
- fallback selectors
- delayed submit-button activation for async click-submit editors
- `click`, `enter`, and `shift+enter` submit methods
- selector checker `ok` and `auth_page` reporting
- selector checker conditional-submit mode for empty composer UIs
- textarea-first Grok selector preference and soft-gated auth coexistence fixtures
- custom-site optional permission cleanup and alias-origin handling
- built-in override import repair for invalid `click` + empty selector combinations
- internal-only runtime router trust checks and timeout-safe runtime messaging fallback
- `broadcastCounter` export/import/reset lifecycle
- import migration to export `version: 7`
- `siteOrder` normalization and ordering reuse
- history replay snapshot fallback and resend routing safety
- prompt draft/sent separation plus popup handoff consumption
- favorite background job dedupe/runtime helpers
- favorite `{{counter}}` serialization across concurrent runs
- quick palette filtering parity with popup favorite search and execution handoff
- favorite chain/schedule normalization for legacy imports
- scheduled-run summary isolation from manual runs
- dashboard metrics for heatmap, trend, failure reasons, and strategy summary
- favorites search across title, text, tags, and folders
- per-service override template resolution and retry prompt preservation
- CSV export formula escaping
- pending broadcast result accumulation with structured `siteResults`
- adaptive strategy-stat accumulation
- reusable-tab preflight filtering
- reset helper cleanup across local and session state

## Conventions

- Edit TypeScript in `src/`, never edit `dist/` directly.
- CSS class names referenced by JS should be treated as stable.
- i18n keys follow `section_component_detail` naming.
- History entries store `requestedSiteIds`, `submittedSiteIds`, and `failedSiteIds`.
- Use `targetSnapshots` first when reconstructing broadcast targets; fall back to `requestedSiteIds` for legacy records.
- `sentTo` remains for backward compatibility and mirrors `submittedSiteIds`.
