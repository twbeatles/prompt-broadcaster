# AI Prompt Broadcaster Claude Code Guide

## Project Overview

Chrome Manifest V3 extension that injects one prompt into multiple AI chat services.
No backend and no API keys are required. Prompts are injected directly into each service's DOM via `chrome.scripting.executeScript`.

Source of truth: `src/` (TypeScript). Chrome loads the built output in `dist/`, and the root runtime JS files are generated mirrors refreshed by `npm run build`.
`src/*/main.ts` files stay thin and delegate to runtime-local `app/bootstrap.ts` modules.

## Essential Commands

```bash
npm install
npm run build
npm run typecheck
npm run qa:smoke
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
- `src/shared/prompts/`: history, favorites, template cache, broadcast counter, import/export, and settings
- `src/shared/runtime-state/`: last broadcast, UI toasts, and selector warning state
- `src/shared/template/`: template detection and rendering
- `src/popup/app/bootstrap.ts`: popup orchestration
- `src/popup/app/i18n.ts`, `src/popup/app/state.ts`: popup state and copy
- `src/options/app/bootstrap.ts`: options orchestration
- `src/background/app/bootstrap.ts`: service worker orchestration
- `src/content/selector-checker/` and `src/content/selection/`: modular content helpers split by runtime, DOM, and reporting concerns

### i18n
- `_locales/en/messages.json`
- `_locales/ko/messages.json`

## Architecture Notes

### Template variables
System variables: `{{date}}`, `{{time}}`, `{{weekday}}`, `{{clipboard}}`, plus Korean aliases.
All aliases normalize to canonical English keys in `src/shared/template/`.

### Injection flow
1. Popup sends a broadcast message with one target per selected service.
2. Each target can use default routing, force a new tab, or point to a specific already-open AI tab.
3. Background queues targets in order and processes them sequentially so focus-sensitive editors are handled more reliably.
4. On tab readiness, background injects `content/injector.js`.
5. Injector finds the input, applies the prompt, and waits for click-submit buttons to become enabled when async editors delay state updates.
6. Results are written back to `chrome.storage.session`.
7. Popup updates send-status icons and restored broadcast state.

### Open-tab targeting
- Popup can query the current normal browser window for open AI tabs mapped to configured services.
- Service cards can target a specific tab, force a new tab, or follow the default reuse policy.
- Default reuse behavior is stored in `appSettings.reuseExistingTabs` and can be changed from the popup or options page.
- Cancelling a broadcast only closes tabs opened for that broadcast. Reused tabs are preserved.

### Custom service permissions
- Runtime sites expose `permissionPatterns` derived from `url + hostnameAliases`.
- Popup save, JSON import, and background permission checks all require the full origin set for a custom service.
- Deleting custom services, resetting service settings, or replacing imported custom services should remove unused optional host permissions.

### Import/export and counter semantics
- JSON export/import currently uses `version: 3` and includes `broadcastCounter`.
- `{{counter}}` preview uses `current + 1`, but the stored counter only increments when at least one target site is successfully queued.
- Reset-data flows should clear `broadcastCounter` together with history, favorites, template cache, and site data.

### Popup reopening fallback
When `chrome.action.openPopup()` fails because Chrome has no active browser window, the background worker stores `lastPrompt`, tries to focus an existing browser window, and finally opens `popup/popup.html` in a standalone popup window.

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
```

Smoke coverage includes:

- textarea and contenteditable injection
- fallback selectors
- delayed submit-button activation for async click-submit editors
- `click`, `enter`, and `shift+enter` submit methods
- selector checker `ok` and `auth_page` reporting
- selector checker `input-only` mode for conditional submit UIs
- custom-site optional permission cleanup and alias-origin handling
- built-in override import repair for invalid `click` + empty selector combinations
- `broadcastCounter` export/import/reset lifecycle
- favorites search across title, text, tags, and folders

## Conventions

- Edit TypeScript in `src/`, never edit `dist/` directly.
- CSS class names referenced by JS should be treated as stable.
- i18n keys follow `section_component_detail` naming.
- History entries store `requestedSiteIds`, `submittedSiteIds`, and `failedSiteIds`.
- Use `requestedSiteIds` when reconstructing broadcast targets.
- `sentTo` remains for backward compatibility and mirrors `submittedSiteIds`.
