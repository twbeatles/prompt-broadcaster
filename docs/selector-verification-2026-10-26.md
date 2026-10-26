# Selector Verification Evidence - 2026-10-26

Public, logged-out pages only. This is not evidence of logged-in composer
behavior. Method: the built `dist/` extension was loaded into Playwright
Chromium (headed, locale `en-US`); each site's DOM (editors, buttons, ancestors)
was dumped, a harmless test string was typed (never submitted), and every
selector in the built-in `inputSelector` / `submitSelector` was evaluated
against the live DOM. With the extension loaded, `pendingSelectorChecks` and
`selectorAlerts` in `chrome.storage.session` stayed empty for all five sites.

| Service | Route | State seen | Input | Submit (after typing) | Result |
| --- | --- | --- | --- | --- | --- |
| ChatGPT | `/` | logged-out | `textarea#mobile-composer-prompt` (`name=prompt`, aria-label `Chat with ChatGPT`, placeholder `Ask ChatGPT`) matched by existing aria/placeholder selectors | `aria-label="Send message"` matched | Pass. Page is a redesigned atomic-CSS (StyleX-style) UI; no stable `data-testid`s seen signed-out. |
| Gemini | `/app` | logged-out | `div.ql-editor.textarea.new-input-ui[contenteditable]` (`Enter a prompt for Gemini`) | `button[type=submit][aria-label="Send message"]`; `button.send-button` no longer exists | Pass. Earlier headless audit run missed the editor (hydration timing); headed run matched. |
| Claude | `/new` | redirected to `/login?...returnTo=/new` (hCaptcha) | no composer on login page | n/a | Not verifiable signed-out. Auth detection reports `auth_page`, no selector strike. Logged-in check still required. |
| Grok | `/` | logged-out | `div.tiptap.ProseMirror` (`role=combobox`, `Ask Grok anything`) | `button[data-testid=chat-submit]` (enabled after typing) | Pass, unchanged. |
| Perplexity | `/` | logged-out (no auth surface this time) | `div#ask-input[data-lexical-editor]` | `button[aria-label="Submit"][type=button]` (the `type=submit` selectors do not match) | Pass via generic `aria-label*=submit`; exact selector added. |

## Changes in `src/config/sites/builtins.ts`

- Gemini: `button[aria-label='Send message']` added first in `submitSelector`.
- Perplexity: `button[aria-label='Submit']` added first in `submitSelector`.
- ChatGPT: `textarea[name='prompt']` added to `inputSelector` fallback list.
- Verification metadata refreshed to `2026-10-26` for ChatGPT, Gemini, Perplexity
  (Perplexity auth state is now `logged-out`, no longer `soft-gated`). Claude
  metadata is intentionally unchanged because it could not be re-verified.

## Verification run

`npm run build`, `typecheck`, `qa:unit` (3/3), `docs:check`, `qa:smoke` (63/63)
pass.

## Open items

Automated logged-in verification was attempted and abandoned: a copied Chrome
profile does not keep sessions (cookie encryption is bound to the original
profile), and Google sign-in is refused in a Playwright-driven dedicated
profile. Temporary profiles were deleted. Manual checklist in the real,
logged-in Chrome with the unpacked `dist/` extension:

- [ ] Open each service's new-chat page; run the popup service "selector test".
- [ ] Broadcast one harmless prompt to all five services; confirm every card
  ends as `submitted` and no selector warning badge appears.
- [ ] Record any failure with the DOM of the composer, then update
  `src/config/sites/builtins.ts`.

- Claude, and logged-in ChatGPT/Perplexity/Gemini composers, need a
  logged-in run (`SELECTOR_AUDIT_PROFILE_DIR=<profile copy>`).
- ChatGPT's logged-in composer may differ from the signed-out textarea; the
  contenteditable and `data-testid` selector chains were left in place.
