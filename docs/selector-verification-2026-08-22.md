# Selector Verification Evidence - 2026-08-22

This audit used the public, logged-out pages. It is not evidence of logged-in
composer behavior.

## Automated Audit Snapshot

- Command: `PLAYWRIGHT_EXECUTABLE_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" npm run selector:audit`
- Report: `output/selector-audit/2026-08-22T10-42-21-614Z.md`
- Generated at: `2026-08-22T10:42:36.690Z`

| Service | Route | Auth state | Prompt surface | Submit surface | Access challenge | Result |
| --- | --- | --- | --- | --- | --- | --- |
| ChatGPT | `/` | logged-out | no | no | yes | Cloudflare challenge; selectors cannot be evaluated. |
| Gemini | `/app` | logged-out | yes | no | no | Current primary `div.ql-editor.textarea.new-input-ui[contenteditable='true']` matched. Empty-state send control is conditionally hidden. |
| Claude | `/new` | logged-out | no | no | yes | Cloudflare challenge; selectors cannot be evaluated. |
| Grok | `/` | logged-out | yes | yes (disabled) | no | Current primary `textarea[aria-label*='grok' i]` and `button[data-testid='chat-submit']` matched. |
| Perplexity | `/` | logged-out | no | no | yes | Cloudflare challenge; selectors cannot be evaluated. |

## Decision

- No input or submit selector changes are required from this audit.
- Refresh built-in non-auth verification metadata to 2026-08-22.
- Keep `selectorCheckMode: "input-and-conditional-submit"` for all services,
  because Gemini's empty-state send button is hidden and Grok's is disabled.
- A logged-in check is still required before claiming authenticated composer
  coverage for ChatGPT, Claude, or Perplexity.

## Playwright CLI Interaction Check

The Playwright Chromium browser was installed with `npx playwright install
chromium`. The following checks used `playwright-cli`, entered a harmless test
string, and deliberately did not submit it.

| Service | Input after fill | Submit control after fill | Result |
| --- | --- | --- | --- |
| Gemini | `textbox` named `Gemini 프롬프트 입력` retained the test text. | `메시지 보내기` appeared and was clickable. | Pass |
| Grok | `textbox` named `Grok에게 아무거나 물어보세요` retained the test text. | `제출` changed from disabled to clickable. | Pass |

This confirms the current public signed-out compose flow for the two
non-challenge-gated sites. No message was sent during either check.
