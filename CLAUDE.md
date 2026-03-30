# AI Prompt Broadcaster — Claude Code Guide

## Project Overview

Chrome Manifest V3 extension that injects one prompt into multiple AI chat services simultaneously.
No backend, no API keys — prompts are injected directly into each service's DOM via `chrome.scripting.executeScript`.

Source of truth: `src/` (TypeScript). Chrome loads the built output in `dist/`.

---

## Essential Commands

```bash
npm install          # install dependencies
npm run build        # compile TypeScript + copy static assets into dist/
npm run typecheck    # type-check only (no output)
npm run qa:smoke     # run Playwright smoke tests (requires dist/ to be current)
```

After any source change, run `npm run build` before testing in Chrome.

To package a release zip:
- Windows: `powershell -ExecutionPolicy Bypass -File .\package.ps1`
- macOS/Linux: `bash ./package.sh`

---

## Source → Build Mapping

| Source | Built output |
|---|---|
| `src/background/main.ts` | `dist/background/service_worker.js` |
| `src/popup/main.ts` | `dist/popup/popup.js` |
| `src/options/main.ts` | `dist/options/options.js` |
| `src/content/injector/main.ts` | `dist/content/injector.js` |
| `src/content/selector-checker/main.ts` | `dist/content/selector_checker.js` |
| `src/content/selection/main.ts` | `dist/content/selection.js` |
| `src/onboarding/main.ts` | `dist/onboarding/onboarding.js` |
| `popup/styles/app.css` | `dist/popup/styles/app.css` (copied) |
| `options/styles/app.css` | `dist/options/styles/app.css` (copied) |
| `_locales/` | `dist/_locales/` (copied) |

---

## Key Files

### Configuration
- **`src/config/sites.ts`** — built-in AI service definitions (selectors, submit strategy, wait time)
- **`manifest.json`** — extension manifest; update `host_permissions` and `content_scripts.matches` when adding new domains

### UI
- **`popup/popup.html`** — popup markup (served from `dist/popup/`)
- **`popup/styles/app.css`** — popup CSS (warm amber palette, dark mode, segmented tab bar)
- **`options/options.html`** — dashboard markup
- **`options/styles/app.css`** — dashboard CSS

### Logic
- **`src/shared/stores/sites-store.ts`** — merges built-in + user override + custom sites
- **`src/shared/stores/prompt-store.ts`** — history, favorites, template cache
- **`src/shared/template-utils.ts`** — template variable detection and rendering
- **`src/popup/main.ts`** — all popup UI logic (~1600 lines)
- **`src/background/main.ts`** — service worker: tab management, broadcast state, notifications

### i18n
- **`_locales/en/messages.json`** — English strings
- **`_locales/ko/messages.json`** — Korean strings
- Popup applies strings via `data-i18n`, `data-i18n-placeholder`, `data-i18n-aria-label` attributes

---

## Architecture Notes

### Tab button icons
Tab buttons in the popup use CSS `::before` for icon characters. The i18n system sets `button.textContent` (which only replaces DOM text nodes, not CSS pseudo-elements), so icons survive i18n initialization.

### Template variables
System variables: `{{date}}`, `{{time}}`, `{{weekday}}`, `{{clipboard}}` (and Korean aliases).
All aliases normalize to canonical English keys in `template-utils.ts`.

### Injection flow
1. Popup sends broadcast message → background worker opens one tab per service
2. On tab load, background injects `content/injector.js`
3. Injector finds the input (with fallback selectors), applies prompt, and waits for click-submit buttons to become enabled when async editors delay state updates
4. Result written back to `chrome.storage.session`
5. Popup polls state and updates send-status icons on each site card

### Popup reopening fallback
When `chrome.action.openPopup()` fails because Chrome has no active browser window, the background worker stores `lastPrompt`, tries to focus an existing browser window, and finally falls back to opening `popup/popup.html` in a standalone popup window.

### Selector checker
Runs on page load, reports `ok` / `selector_missing` / `auth_page` back to background.
Background updates `failedSelectors` in session storage; popup reads this to show warning badges.

### Custom scrollbar / toast styles
Toast component (`src/popup/ui/toast.ts`) self-injects its CSS via `<style id="apb-toast-styles">`.
Do not duplicate toast styles in `popup/styles/app.css`.

---

## Adding a New AI Service

1. Add an entry to `src/config/sites.ts`:
   ```ts
   {
     id: "newai",
     name: "NewAI",
     url: "https://newai.example.com/",
     hostname: "newai.example.com",
     inputSelector: "div[contenteditable='true']",
     inputType: "contenteditable",
     submitSelector: "button[data-testid='send']",
     submitMethod: "click",
     waitMs: 2000,
     fallback: true,
   }
   ```
2. Add the domain to `manifest.json` → `host_permissions` and `content_scripts.matches`.
3. Run `npm run build` and reload the extension in Chrome.
4. Update README.md supported services table.

---

## CSS Design System (Popup)

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#f4efe7` | `#171311` |
| `--accent` | `#c24f2e` | `#ff7a4f` |
| `--panel` | `rgba(255,255,255,0.78)` | `rgba(35,28,24,0.86)` |
| `--radius` | `16px` | same |
| `--transition` | `150ms cubic-bezier(0.4,0,0.2,1)` | same |

- Font stack: `"Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
- Popup width: 420px fixed
- Dark mode: via `@media (prefers-color-scheme: dark)` — no JS toggle needed

---

## Testing

QA smoke tests live in `qa/` and use Playwright against local HTML fixtures:
```bash
npx playwright install chromium  # one-time setup
npm run qa:smoke
```

Smoke tests cover: textarea/contenteditable injection, fallback selectors, delayed button activation for click-submit editors, submit methods (click, enter, shift+enter), auth page detection, selector checker `ok` reporting.

---

## Conventions

- Edit TypeScript in `src/`, never edit `dist/` directly.
- CSS class names are stable — JS references them with `querySelector`. Do not rename without checking `src/popup/main.ts` and `src/options/main.ts`.
- i18n keys follow `section_component_detail` pattern (e.g., `popup_service_field_name`).
- History entries store `requestedSiteIds`, `submittedSiteIds`, `failedSiteIds` — use `requestedSiteIds` when reconstructing broadcast targets.
- The `sentTo` field is kept for backward compatibility and mirrors `submittedSiteIds`.
