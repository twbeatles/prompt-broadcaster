# Implementation Audit — 2026-04-13

> 범위: selector noise hardening + route-aware site model 이후 코드/문서 정합성 재검토
> 기준: `main` 브랜치 워킹트리, `src/`, generated mirrors, docs, smoke scripts

---

## 반영 완료

- proactive selector miss를 session 전용 `pendingSelectorChecks`로 1차 저장
- 같은 service/signature 재발 또는 injector selector failure일 때만 confirmed warning 승격
- popup selector badge / Report 링크는 local `failedSelectors`만 기준으로 유지
- selector notification은 confirmed warning 시점에만 생성
- `supportedRoutes`를 `SiteConfig` / `RuntimeSite` / popup service editor / JSON import-export에 추가
- built-in 기본 route policy 정리
  - Gemini: `/app`
  - Claude: `/new`
  - ChatGPT / Grok / Perplexity: wildcard
- selector-checker / reusable-tab preflight 공통 route gate 도입
  - `auth_path`
  - `settings_path`
  - `unsupported_route`
- import/export version `8` 반영 및 `v7 -> v8` migration 추가
- release selector verification checklist 문서 추가

---

## 검증 결과

### 자동 검증

- `npm run typecheck`: 통과
- `npm run build`: 통과
- `npm run qa:smoke`: 통과 (`46/46`)

### 회귀 범위

- supported-route normalization
- reusable-tab route gating
- pending selector escalation
- reset 시 `pendingSelectorChecks` 정리
- import/export `v8` round-trip
- popup service editor의 `supportedRoutes` 저장 경로

---

## 문서 정합성

다음 문서를 현재 코드 기준으로 동기화했다.

- `README.md`
- `CLAUDE.md`
- `PROJECT_ANALYSIS.md`
- `FEATURE_ROADMAP.md`
- `ISSUES_AND_IMPROVEMENTS.md`
- `docs/build-guide.md`
- `docs/extension-architecture.md`
- `docs/release-selector-verification-checklist.md`

---

## 잔여 리스크

- ChatGPT / Grok / Perplexity는 아직 wildcard route policy라 canonical route 데이터가 더 쌓이면 tighten 여지가 있다.
- selector checker의 첫 miss는 더 이상 사용자에게 보이지 않지만, 실제 사이트가 반복적으로 흔들리는 경우 pending -> confirmed promotion은 계속 일어날 수 있다.
- built-in route policy는 여전히 live verification 운영 루프에 의존하므로 릴리스 전 checklist 실행이 필요하다.

---

## 결론

이번 wave로 selector false alert의 주요 원인이던 route mismatch와 일시적 DOM miss가 공통 정책으로 정리됐다.
이후 과제는 route policy 정밀화와 live verification 운영 루프 강화에 가깝다.
