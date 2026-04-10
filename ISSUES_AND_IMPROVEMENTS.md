# AI Prompt Broadcaster — 잠재적 문제 및 개선 포인트

> 작성일: 2026-04-08
> 최종 업데이트: 2026-04-10 (selector maintenance wave 1, structured verification metadata, selector audit CLI 반영)
> 분석 기준: `src/`, `popup/`, `options/`, `manifest.json`, `scripts/`, `qa/`
> 참조: `CLAUDE.md`, `README.md`, `PROJECT_ANALYSIS.md`, `FEATURE_ROADMAP.md`

---

## 요약

이번 wave까지 반영한 뒤 문서/코드 기준 주요 상태는 다음과 같다.

| 분류 | 상태 |
|------|------|
| 런타임 메시징 타임아웃 / 포트 종료 fallback | 완료 |
| background router sender trust boundary | 완료 |
| injector `MutationObserver` 범위 축소 | 완료 |
| favorite dedupe race 및 `{{counter}}` 직렬화 | 완료 |
| `AppSettings.siteOrder` / 서비스 순서 편집 | 완료 |
| schedules 최근 scheduled 결과 요약 | 완료 |
| dashboard heatmap / trend / failure / strategy summary | 완료 |
| selector/preflight false negative 완화 | 완료 |
| Grok textarea-first selector 재정렬 | 완료 |
| structured verification metadata | 완료 |
| selector audit CLI | 완료 |
| Claude logged-in live verification | 미완료 |

남은 항목은 구현 누락보다는 실서비스 재검증, anti-automation 대응, 추가 built-in 확대에 가깝다.

---

## 이번 wave에서 완료된 항목

### 1. conditional-submit semantics 정렬

- `SelectorCheckMode`에 `input-and-conditional-submit` 추가
- reusable-tab preflight / selector-checker / service-test가 공통 submit requirement(`required` / `conditional` / `none`)를 사용
- 빈 composer 상태에서 submit surface가 아직 없어도 false negative를 내지 않도록 정렬

### 2. selector helper 공통화

- `src/shared/sites/selector-utils.ts` 추가
- selector split / auth-path heuristic / submit requirement 계산을 shared source of truth로 이동
- injector / selector-checker / background inline preflight 간 의미 차이 축소

### 3. structured verification metadata 도입

- `verifiedAt`
- `verifiedRoute`
- `verifiedAuthState`
- `verifiedLocale`
- `verifiedVersion`

`lastVerified`는 legacy compatibility field로 유지하고, `verifiedAt`가 있으면 `YYYY-MM`으로 derive한다.

### 4. import/export `v7`

- export version을 `7`로 상향
- `v6 -> v7` migration 추가
- 기존 `lastVerified`만 있는 데이터는 그대로 유지하고, exact date를 임의 생성하지 않음

### 5. Grok / Perplexity / ChatGPT maintenance

- Grok primary input을 textarea-first로 재정렬
- ProseMirror/contenteditable 계열은 fallback으로 유지
- Perplexity는 conditional-submit semantics로 통일
- ChatGPT / Grok / Perplexity는 empty composer에서 selector preflight 오탐을 줄이는 구조로 정리

### 6. popup service editor 반영

- `lastVerified` 수동 입력 제거
- structured verification fields 직접 편집 가능
- selector warning의 days-since 계산은 `verifiedAt` 우선, `lastVerified` fallback

### 7. selector audit CLI

- `npm run selector:audit`
- `scripts/selector-audit.mjs`
- 출력: `output/selector-audit/<timestamp>.md`

이 스크립트는 built-in 5개를 순회하며 route / locale / auth surface / input surface / submit surface를 Markdown으로 기록한다.

---

## 현재 남아 있는 후속 과제

### 1. Claude logged-in composer 실검증

이번 환경 기준으로는 headless audit에서 Claude composer를 잡지 못했다.
즉, metadata는 과장되지 않도록 보수적으로 유지했지만, 실제 logged-in composer live verification은 다시 수행할 필요가 있다.

### 2. public site anti-automation 차이

ChatGPT, Perplexity는 headless audit에서 public surface가 안정적으로 보이지 않았다.
실사용 브라우저와 headless browser의 DOM 차이를 따로 관리할 필요가 있다.

### 3. auth surface와 prompt surface 공존 규칙 정교화

Perplexity처럼 composer와 login modal이 동시에 존재하는 soft-gated UI는 이번 wave에서 기록 구조를 도입했지만, 이후에는 warning/UX에도 더 직접 반영할 수 있다.

### 4. built-in live verification 운영 루프

현재는:

- smoke fixture 회귀
- selector audit Markdown
- built-in metadata 수동 갱신

까지는 갖췄다. 이후에는 릴리스 전 검증 체크리스트에 site-by-site verification procedure를 더 명시적으로 넣을 수 있다.

### 5. 신규 built-in 서비스 확대

후보:

- Microsoft Copilot
- Mistral Le Chat
- DeepSeek
- HuggingChat

이 항목은 새 selector maintenance 루프를 그대로 적용하는 방식이 가장 안전하다.

---

## 권장 우선순위

| 순위 | 항목 | 이유 |
|------|------|------|
| 높음 | Claude logged-in live verification | 현재 메타데이터/문서의 마지막 빈칸 |
| 높음 | ChatGPT / Perplexity headless-public 차이 분석 | audit 신뢰도 향상 |
| 중간 | 신규 built-in 서비스 실기 검증 | 사용자 체감 기능 확장 |
| 중간 | soft-gated UX 후속 반영 | selector warning / diagnostics 개선 |
| 낮음 | 로케일 확장 | 번역 품질 검수 비용 필요 |
