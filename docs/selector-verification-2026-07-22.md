# Selector Verification Evidence - 2026-07-22

This document separates automated selector audit evidence from logged-in canonical route verification. Do not update built-in `verifiedAuthState: "logged-in"` metadata from the automated audit alone.

## Automated Audit Snapshot

- Command: `npm run selector:audit`
- Report: `output/selector-audit/2026-07-22T08-16-49-622Z.md`
- Generated at: `2026-07-22T08:17:03.026Z`
- Extra probe: Playwright DOM dump for Gemini + Grok (logged-out)

| Service | Route | Auth state | Prompt surface | Submit surface | Access challenge | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| ChatGPT | `/` | logged-out | no | no | yes | Cloudflare "Just a moment..." only; no logged-in composer evidence. |
| Gemini | `/app` | logged-out | yes | no | no | `div.ql-editor.textarea.new-input-ui` with `aria-label="Enter a prompt for Gemini"`, `data-placeholder="Ask Gemini"`. Empty-state submit hidden (conditional mode OK). Sign-in control via `button[aria-label*='Sign in']`. |
| Claude | `/new` | logged-out | no | no | yes | Cloudflare/access challenge only; no logged-in composer evidence. |
| Grok | `/` | logged-out | yes | yes (disabled) | no | `textarea[aria-label*='grok']`, placeholder `무엇을 알고 싶으세요?`. Submit `button[data-testid='chat-submit']` visible but disabled until input. |
| Perplexity | `/` | logged-out | no | no | yes | Cloudflare/access challenge only; no logged-in composer evidence. |

## Built-in Config Changes (2026-07-22)

- Gemini primary input reordered to prefer `ql-editor.textarea.new-input-ui` and prompt-for-Gemini aria-label.
- Grok primary input adds Korean placeholder `알고 싶` / avoids relying only on English `help`.
- ChatGPT primary chain prefers contenteditable `#prompt-textarea` / ProseMirror before legacy bare id.
- `waitMs` slightly raised for CF-prone sites; authSelectors add Sign-in button variants.
- All services keep `selectorCheckMode: "input-and-conditional-submit"`.

## Alert Noise Controls (same release)

- Proactive selector-checker no longer creates desktop notifications (popup badge only after promotion).
- Promotion threshold raised to 3 same-session misses per siteId.
- Notification/pending signature is site-level (not full selector string).
- Injector failure notifications use a 1-hour per-site cooldown; toast duration is finite (10s).
- Checker re-evaluates auth/challenge after wait and suppresses missing reports during app loading.

## Logged-In Canonical Route Checklist

Record these manually with an authenticated browser profile before changing built-in selector metadata to logged-in verified.

| Service | Canonical route | Locale | Prompt surface | Submit surface after input | Result | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| ChatGPT | `/` | TBD | TBD | TBD | Not verified | Requires authenticated session. |
| Gemini | `/app` | TBD | TBD | TBD | Not verified | Requires authenticated session. |
| Claude | `/new` | TBD | TBD | TBD | Not verified | Requires authenticated session. |
| Grok | `/` | TBD | TBD | TBD | Not verified | Requires authenticated session. |
| Perplexity | `/` | TBD | TBD | TBD | Not verified | Requires authenticated session. |

## Release Rule

- Automated audit access challenges are recorded as access-gated, not selector failures.
- Logged-in metadata must cite route, auth state, locale, prompt surface, submit surface, and UI build/version.
- If logged-in verification is not available, keep selector metadata at the latest verified non-auth or soft-gated state and call out the limitation in release notes.
