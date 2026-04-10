# AI Prompt Broadcaster - 잔여 기능 로드맵

> 작성일: 2026-03-31
> 최종 업데이트: 2026-04-10 (selector maintenance wave 1, structured verification metadata, selector audit CLI 반영)
> 기준 코드: 현재 `main` 브랜치의 `src/`, `popup/`, `options/`, `manifest.json`

이 문서는 **아직 남아 있는 항목만** 정리한다. 이미 구현된 기능과 현재 동작은 `README.md`, `PROJECT_ANALYSIS.md`, `CLAUDE.md`, `docs/extension-architecture.md`를 기준으로 본다.

---

## 최근 완료된 항목

- `AppSettings.siteOrder` 추가 및 popup / favorite editor / options 서비스 순서 동기화
- options `Services`의 `Move up` / `Move down` 기반 서비스 순서 편집
- options `Dashboard` 확장
  - weekday × hour heatmap
  - per-service success trend
  - top failure reasons
  - strategy summary
- options `Schedules`의 최근 scheduled 실행 결과 분리 표시
- timeout-safe runtime messaging helper와 background router sender trust boundary 보강
- selector maintenance wave 1
  - `SelectorCheckMode: "input-and-conditional-submit"` 추가
  - reusable-tab preflight / selector-checker / service-test semantics 정렬
  - Grok textarea-first selector 재정렬
  - structured verification metadata(`verifiedAt`, `verifiedRoute`, `verifiedAuthState`, `verifiedLocale`, `verifiedVersion`) 도입
  - import/export `v7` 마이그레이션 추가
  - `npm run selector:audit` 및 Playwright audit report 추가
- 관련 smoke 회귀 추가

---

## 우선순위 매트릭스

| 우선순위 | 기능 | 현재 상태 | 임팩트 | 난이도 |
|---|---|---|:---:|:---:|
| 2순위 | 고급 통계 확장 | 핵심 시각화는 완료, 심화 분석은 남음 | ★★☆ | ★★☆ |
| 2순위 | 신규 내장 AI 서비스 | 여전히 5개 built-in만 제공 | ★★☆ | ★★☆ |
| 보류 | 다국어 확장 | `en`, `ko`만 제공 | ★★☆ | ★☆☆ |

---

## 2순위 — 운영성 및 분석 고도화

### ① 고급 통계 확장

**현재 상태**
- options `Dashboard`는 overview cards, usage share, 7일 bar chart, weekday × hour heatmap, 서비스 성공률 추이, 상위 실패 원인, strategy summary를 이미 제공한다.
- `strategyStats`와 구조화된 `siteResults`도 실제 UI 집계에 반영된다.

**남은 작업**
- 프롬프트 길이 분포
- 상위 키워드 통계
- 필요 시 기간 필터 기반 dashboard 집계
- 히스토리 규모가 큰 사용자를 위한 집계 캐싱 또는 incremental recompute

**수정 파일 후보**
- `src/options/features/dashboard-metrics.ts`
- `src/options/features/dashboard.ts`
- `src/options/ui/charts.ts`
- `options/options.html`
- `options/styles/partials/`

**주의사항**
- 키워드 분석은 한글/영문 혼합 입력에 대해 단순 공백 기준으로 시작할지 별도 토크나이저를 둘지 먼저 결정해야 한다.
- 렌더링은 계속 `escapeHTML` 또는 DOM API 기반으로 유지해 stored XSS 경로를 만들지 않아야 한다.

---

### ② 신규 내장 AI 서비스 추가

**현재 상태**
- built-in 서비스는 ChatGPT, Gemini, Claude, Grok, Perplexity까지다.
- Copilot / Le Chat / DeepSeek / HuggingChat 등은 아직 코드베이스에 추가하지 않았다.

**추가 검토 대상**

| 서비스 | 도메인 | 비고 |
|---|---|---|
| Microsoft Copilot | `copilot.microsoft.com` | Microsoft 생태계 사용자층 |
| Mistral Le Chat | `chat.mistral.ai` | 유럽권 AI 서비스 |
| DeepSeek | `chat.deepseek.com` | 아시아권 사용량 증가 |
| HuggingChat | `huggingface.co/chat` | 오픈소스 친화적 서비스 |

**남은 작업**
- 각 서비스의 input selector / submit selector 실기 검증
- auth page 탐지 selector 보강
- `waitMs`, submit 방식(`click` / `enter` / `shift+enter`) 튜닝
- structured verification metadata 갱신
- host permissions / content script match 확장

**수정 파일 후보**
- `src/config/sites/builtins.ts`
- `src/config/sites/`
- `manifest.json`
- `_locales/en/messages.json`
- `_locales/ko/messages.json`

**체크리스트**
- [ ] 실제 로그인/대화 화면 DOM 확인
- [ ] 인증 페이지 오탐 여부 확인
- [ ] 재사용 탭 후보 탐지 조건 검증
- [ ] smoke 또는 fixture 회귀 추가 가능 여부 검토

---

## 보류 — 로케일 확장

### ③ 다국어 확장 (일본어 / 중국어)

**현재 상태**
- 로케일은 `_locales/en`, `_locales/ko`만 유지한다.
- 빌드 시 `en/ko` locale key parity와 placeholder parity를 함께 검증한다.

**남은 작업**
- `_locales/ja/messages.json`
- `_locales/zh_CN/messages.json`
- 템플릿 변수 별칭 및 도움말 문구 확장
- popup/options/onboarding 주요 UI 문자열 번역 검수

**수정 파일 후보**
- `_locales/ja/messages.json`
- `_locales/zh_CN/messages.json`
- `src/shared/template/`
- locale 키를 참조하는 popup/options/onboarding UI

**주의사항**
- 단순 기계 번역으로는 템플릿 변수 설명과 접근성 문구 품질이 떨어질 수 있다.
- 새 로케일 추가 시 기존 `en/ko`와 같은 키 셋 / placeholder 구성을 유지하도록 빌드 검증을 함께 확장해야 한다.

---

## 구현 시 공통 체크리스트

- [ ] `src/` 기준으로 수정하고 생성물은 빌드로 갱신
- [ ] `npm run typecheck` 통과
- [ ] `npm run build` 통과
- [ ] `npm run qa:smoke` 회귀 확인
- [ ] `npm run selector:audit` 실행 결과 확인
- [ ] 새 i18n 키는 `_locales/en/messages.json`와 `_locales/ko/messages.json`를 기본으로 함께 추가
- [ ] 새 저장 필드는 import/export 및 기존 로컬 데이터와 하위 호환되게 처리
- [ ] 새 권한이 필요하면 `manifest.json`과 사용자 안내 문구를 함께 갱신
- [ ] 새 built-in 서비스는 실제 DOM 검증 후 `verifiedAt`와 관련 metadata를 기록하고 legacy `lastVerified` derive를 확인
- [ ] 문서 변경이 필요하면 `README.md`, `PROJECT_ANALYSIS.md`, `docs/extension-architecture.md`도 함께 동기화
