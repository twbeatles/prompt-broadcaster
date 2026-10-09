# Selector Verification Evidence - 2026-10-09

This audit used the public, logged-out pages. It is not evidence of logged-in
composer behavior.

## Automated Audit Snapshot

- Command: `npm run selector:audit`
- Report: `output/selector-audit/2026-10-09T12-45-27-027Z.md`
- Generated at: `2026-10-09T12:45:50.904Z`
- Post-fix re-audit: `output/selector-audit/2026-10-09T12-50-18-768Z.md` confirms
  the new Grok primary `div.tiptap.ProseMirror[contenteditable='true']` matches
  (visible, enabled, `Ask Grok anything`).

| Service | Route | Auth state | Prompt surface | Submit surface | Access challenge | Result |
| --- | --- | --- | --- | --- | --- | --- |
| ChatGPT | `/` | logged-out | no | no | yes | Cloudflare challenge; selectors cannot be evaluated. |
| Gemini | `/app` | logged-out | yes | no | no | Current primary `div.ql-editor.textarea.new-input-ui[contenteditable='true']` matched. Empty-state send control is conditionally hidden. |
| Claude | `/new` | logged-out | no | no | yes | Cloudflare challenge; selectors cannot be evaluated. |
| Grok | `/` | logged-out | yes (fallback only) | yes (disabled) | no | Primary textarea selectors missed; fallback `div.tiptap.ProseMirror[contenteditable='true']` matched with `button[data-testid='chat-submit']`. |
| Perplexity | `/` | logged-out | no | no | yes | Cloudflare challenge; selectors cannot be evaluated. |

## Decision

- Grok's main composer moved from a labelled `textarea` to a Tiptap/ProseMirror
  `contenteditable` div (`div.tiptap.ProseMirror`, aria-label
  `Ask Grok anything`). The leftover `textarea` mirror has no aria-label or
  placeholder, so all textarea-first primary selectors miss. This matches
  third-party adapter reports from Feb-Sep 2026 (composer moved from textarea
  to Tiptap; visible `textarea` is a hidden mirror).
- Fix applied in `src/config/sites/builtins.ts`: Grok `inputSelector` and
  `fallbackSelectors` now prefer the Tiptap selectors first and keep the
  textarea chain as fallback; Grok `inputType` changed to `contenteditable`
  (the injector also auto-detects the real element type, so this is
  belt-and-braces). Verification metadata refreshed to `2026-10-09`
  (`grok-web-oct-2026`, logged-out, `en`).
- Robustness additions (no observed breakage, additive only): ChatGPT submit
  chain gains `#composer-submit-button` plus `Send message` / `Send prompt`
  aria variants (Sep 2026 redesign reports); Claude input/fallback chains gain
  `div[data-testid='chat-input'][contenteditable='true']` and
  `div.tiptap.ProseMirror[contenteditable='true']`, and Claude submit gains
  `button[data-testid='chat-input-send']`.
- Gemini and Perplexity: no changes required (Gemini primary still matches;
  Perplexity still Lexical `#ask-input` per Sep 2026 third-party verification,
  Cloudflare-gated here).
- All services keep `selectorCheckMode: "input-and-conditional-submit"`.
- A logged-in check is still required before claiming authenticated composer
  coverage for ChatGPT, Claude, or Perplexity.

## Playwright CLI Interaction Check

A live interaction probe on `https://grok.com/` typed a harmless test string
into `div.tiptap.ProseMirror[contenteditable='true']` and deliberately did not
submit it.

| Service | Input after fill | Submit control after fill | Result |
| --- | --- | --- | --- |
| Grok | Tiptap editor retained the test text. | `chat-submit` changed from disabled to enabled. | Pass |

This confirms the current public signed-out compose flow for the
non-challenge-gated Tiptap surface. No message was sent during the check.

## Headed / Real-Chrome / Persistent-Profile Mode

`scripts/selector-audit.mjs` now accepts Cloudflare-evasion options for the
gated services above (ChatGPT, Claude, Perplexity):

- `SELECTOR_AUDIT_HEADED=1` (or `npm run selector:audit -- --headed`): visible
  browser instead of the headless shell.
- `SELECTOR_AUDIT_CHANNEL=chrome`: drive the installed Google Chrome instead of
  Playwright's managed Chromium (ignored when `PLAYWRIGHT_EXECUTABLE_PATH` is set).
- `SELECTOR_AUDIT_PROFILE_DIR=<dir>`: persistent user-data directory, e.g. a
  copy of a logged-in Chrome profile, so cookies/sessions survive between runs
  and the browser looks like a real user.
- `SELECTOR_AUDIT_SLOW_MO_MS=<ms>`: optional per-action delay.

Example (PowerShell):

```powershell
$env:SELECTOR_AUDIT_HEADED = "1"
$env:SELECTOR_AUDIT_CHANNEL = "chrome"
$env:SELECTOR_AUDIT_PROFILE_DIR = "C:\tmp\apb-audit-profile"
npm run selector:audit
```

Limits: copy the profile first and never point at the live default profile
directory while Chrome is running. Cloudflare Turnstile may still require one
manual checkbox click in the headed window. Logged-in composer evidence still
needs a real authenticated session and must be recorded per service before
claiming logged-in coverage.

## Automation vs Manual Coverage Boundary

Automated suites (`qa:smoke`, `selector:audit`, `qa:extension`) cover
fixture-based injection, logged-out selector snapshots, and unauthenticated
composer surfaces only. They do not cover:

- Logged-in composer input/submit behavior per service. That requires a real
  authenticated session.
- Real-window behaviors such as open-tab discovery, explicit tab targeting,
  focus-sequential injection, and popup fallback flows.

Before a release that touches built-in selectors or routes, verify the
logged-in canonical route, locale prompt surface, submit surface, and
soft-gate state manually in a real browser window, then record new evidence
under `docs/selector-verification-<date>.md`.
