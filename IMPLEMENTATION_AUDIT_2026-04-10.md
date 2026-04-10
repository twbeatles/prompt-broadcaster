# Implementation Audit — 2026-04-10

> 범위: selector maintenance wave 1 이후 코드/문서 정합성 재검토
> 기준: `main` 브랜치 워킹트리, `src/`, generated mirrors, docs, smoke/audit scripts

---

## 반영 완료

- `SelectorCheckMode`에 `input-and-conditional-submit` 추가
- reusable-tab preflight / selector-checker / service-test가 공통 submit requirement semantics 사용
- `ReusableTabSurfaceSnapshot.requiresSubmitSurface` 제거, `submitRequirement` 사용
- Grok built-in selector를 textarea-first로 재정렬
- verification metadata를 `verifiedAt`, `verifiedRoute`, `verifiedAuthState`, `verifiedLocale`, `verifiedVersion` 중심으로 구조화
- legacy `lastVerified`는 derive/fallback 호환 필드로 유지
- import/export version `7` 반영 및 `v6 -> v7` migration 추가
- popup service editor에 structured verification fields 노출
- `npm run selector:audit` 및 `scripts/selector-audit.mjs` 추가
- smoke fixture 확장
  - conditional submit
  - Grok textarea-first
  - soft-gated auth coexistence
  - localized submit label

---

## 검증 결과

### 자동 검증

- `npm run typecheck`: 통과
- `npm run build`: 통과
- `npm run qa:smoke`: 통과
- `npm run selector:audit`: 통과

### selector audit artifact

- 최신 산출물: `output/selector-audit/2026-04-10T04-25-20-621Z.md`

### 문서 정합성

다음 문서를 현재 코드 기준으로 동기화했다.

- `README.md`
- `CLAUDE.md`
- `PROJECT_ANALYSIS.md`
- `FEATURE_ROADMAP.md`
- `ISSUES_AND_IMPROVEMENTS.md`
- `docs/build-guide.md`
- `docs/extension-architecture.md`

---

## 잔여 리스크

- Claude logged-in composer live verification은 이번 환경에서 끝까지 재현되지 않았음
- ChatGPT / Perplexity는 headless selector audit에서 public surface가 불안정하게 관측됨
- soft-gated auth coexistence는 metadata까지는 반영됐지만 UI-level diagnostics는 추가 여지 있음

---

## 결론

이번 wave의 구현 사항은 코드, generated mirrors, smoke fixtures, selector audit, 문서까지 모두 동기화되었다.
남은 일은 주로 live verification 운영 루프 강화와 신규 built-in 확대다.
