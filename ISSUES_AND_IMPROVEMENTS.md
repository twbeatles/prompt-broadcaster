# AI Prompt Broadcaster — 이슈 및 개선 포인트

> 작성일: 2026-04-08
> 최종 업데이트: 2026-04-13
> 분석 기준: `src/`, `popup/`, `options/`, `manifest.json`, `scripts/`, `qa/`
> 참조: `CLAUDE.md`, `README.md`, `PROJECT_ANALYSIS.md`, `FEATURE_ROADMAP.md`

---

## 요약

현재 기준 핵심 구조 문제는 대부분 정리됐다.

| 분류 | 상태 |
|---|---|
| timeout-safe runtime messaging / sender trust boundary | 완료 |
| selector/preflight false negative 완화 | 완료 |
| structured verification metadata | 완료 |
| selector audit CLI | 완료 |
| selector false alert hardening | 완료 |
| route-aware site model (`supportedRoutes`) | 완료 |
| export/import `v8` | 완료 |
| Claude logged-in live verification | 미완료 |
| wildcard route 정책 정교화 | 후속 |

---

## 이번 wave에서 해결된 항목

### 1. selector false alert 승격 정책

- proactive selector checker의 첫 miss는 즉시 popup warning으로 올리지 않는다.
- session state `pendingSelectorChecks`에만 저장한다.
- 같은 service/signature가 같은 브라우저 세션에서 다시 miss 되면 그때 confirmed warning으로 승격한다.
- injector가 실제 selector를 못 찾은 경우에는 바로 confirmed warning으로 처리한다.

### 2. route-aware site model

- `supportedRoutes`를 built-in/custom site schema에 추가했다.
- selector checker와 reusable-tab preflight가 같은 route gate를 사용한다.
- `unsupported_route`에서는 warning 대신 `skipped` 처리한다.
- built-in 기본 정책은 보수적으로 두었다.
  - Gemini: `/app`
  - Claude: `/new`
  - ChatGPT / Grok / Perplexity: wildcard

### 3. import/export 정합성

- export version을 `8`로 상향했다.
- `v7 -> v8` migration을 추가했다.
- `supportedRoutes`와 structured verification metadata를 함께 보존한다.

### 4. 운영 문서 보강

- popup service editor에 `supportedRoutes`를 노출했다.
- `docs/release-selector-verification-checklist.md`를 추가했다.
- `README.md`, `CLAUDE.md`, `PROJECT_ANALYSIS.md`, `FEATURE_ROADMAP.md`, `docs/build-guide.md`, `docs/extension-architecture.md`를 현재 코드에 맞춰 동기화했다.

---

## 현재 남아 있는 후속 과제

### 1. Claude logged-in composer live verification

headless 기준 회귀는 통과했지만, 실제 logged-in composer 실검증은 릴리스 전 체크리스트 기반으로 다시 확인할 가치가 있다.

### 2. wildcard route 정책 정교화

ChatGPT / Grok / Perplexity는 아직 전체 route를 허용한다.
실사용 canonical route 데이터가 쌓이면 `supportedRoutes`를 더 좁힐 수 있다.

### 3. soft-gated UX 후속 반영

soft-gated 상태는 metadata와 route policy에는 반영됐지만, popup diagnostics나 audit 표현은 더 정교하게 만들 수 있다.

### 4. 신규 built-in 서비스 확대

후보:

- Microsoft Copilot
- Mistral Le Chat
- DeepSeek
- HuggingChat

---

## 권장 우선순위

| 순위 | 항목 | 이유 |
|---|---|---|
| 높음 | built-in release checklist 운영 | route/selector drift를 실제 릴리스 전에 잡기 위함 |
| 높음 | Claude logged-in live verification | 아직 남은 실검증 공백 |
| 중간 | ChatGPT / Grok / Perplexity route tightening | wildcard route를 줄여 false alert를 더 낮추기 위함 |
| 중간 | 신규 built-in 서비스 실기 검증 | 기능 확장 |
| 낮음 | 로케일 확장 | 번역 검수 비용 필요 |
