# Selector Verification Evidence - 2026-05-11

This document separates automated selector audit evidence from logged-in canonical route verification. Do not update built-in `verifiedAuthState: "logged-in"` metadata from the automated audit alone.

## Automated Audit Snapshot

- Command: `npm run selector:audit`
- Report: `output/selector-audit/2026-05-11T01-23-07-108Z.md`
- Generated at: `2026-05-11T01:23:21.630Z`

| Service | Route | Auth state | Prompt surface | Submit surface | Access challenge | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| ChatGPT | `/` | logged-out | no | no | yes | Cloudflare/access challenge only; no logged-in composer evidence. |
| Gemini | `/app` | logged-out | no | no | no | Login link surfaced; no logged-in composer evidence in this audit run. |
| Claude | `/new` | logged-out | no | no | yes | Cloudflare/access challenge only; no logged-in composer evidence. |
| Grok | `/` | logged-out | yes | no | no | Prompt surface visible; submit surface not visible in empty state. |
| Perplexity | `/` | logged-out | no | no | yes | Cloudflare/access challenge only; no logged-in composer evidence. |

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
