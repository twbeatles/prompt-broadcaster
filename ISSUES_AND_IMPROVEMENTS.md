# AI Prompt Broadcaster — 잠재적 문제 및 개선 포인트

> 작성일: 2026-04-08
> 최종 업데이트: 2026-04-09 (full pass 구현 및 회귀 검증 반영)
> 분석 기준: `src/`, `popup/`, `options/`, `manifest.json`, `scripts/`, `qa/`
> 참조: `CLAUDE.md`, `README.md`, `PROJECT_ANALYSIS.md`, `FEATURE_ROADMAP.md`

---

## 요약

이번 full pass에서 문서상 주요 이슈는 다음과 같이 정리됐다.

| 분류 | 상태 |
|------|------|
| 런타임 메시징 타임아웃 / 포트 종료 fallback | 완료 |
| background router sender trust boundary | 완료 |
| injector `MutationObserver` 범위 축소 | 완료 |
| options 차트 경로 XSS 보강 | 완료 |
| favorite dedupe race 및 `{{counter}}` 직렬화 | 완료 |
| background site lookup 캐시 | 완료 |
| `AppSettings.siteOrder` / 서비스 순서 편집 | 완료 |
| schedules 최근 scheduled 결과 요약 | 완료 |
| dashboard heatmap / trend / failure / strategy summary | 완료 |
| 관련 smoke 회귀 보강 | 완료 |

남은 항목은 “미구현”보다는 후속 고도화나 추가 검증에 가깝다.

---

## 이번 패스에서 완료된 항목

### 1. 런타임 메시징 하드닝

- `src/shared/chrome/messaging.ts` 추가
- popup / options / content에서 raw `chrome.runtime.sendMessage` 대신 timeout-safe helper 사용
- `lastError`, 응답 포트 종료, 무응답 timeout을 모두 `null`/fallback으로 흡수

### 2. background router trust boundary

- `src/background/messages/router.ts`는 이제 내부 extension page(`sender.id === chrome.runtime.id`)와 이 확장의 content script(`sender.tab`)만 허용
- `sendResponse`도 safe wrapper로 감싸 포트 종료 시 unhandled rejection을 막음

### 3. injector selector wait 성능 개선

- `src/content/injector/selectors.ts`의 `MutationObserver`에 `attributeFilter`
  - `class`
  - `id`
  - `style`
  - `disabled`
  - `aria-disabled`

### 4. favorite workflow 직렬화

- dedupe 판정을 `updateFavoriteRunJobs()` 내부로 이동
- favorite step prompt 렌더링부터 `queueBroadcastRequest()`까지 전용 execution chain으로 직렬화
- concurrent favorite run에서도 `{{counter}}` 중복 사용을 방지

### 5. runtime site ordering

- `AppSettings.siteOrder` 추가
- `src/shared/sites/order.ts`로 정규화 및 정렬 로직 분리
- options `Services`에서 `Move up` / `Move down`으로 순서 저장
- popup compose / favorite editor / options 서비스 목록이 같은 순서를 사용

### 6. options 운영성 개선

- `Dashboard`
  - activity heatmap
  - per-service success trend
  - top failure reasons
  - strategy summary
- `Schedules`
  - 마지막 manual run과 분리된 최근 scheduled 실행 시각
  - scheduled 실행 상태
  - 대표 실패 상세

### 7. 회귀 테스트 보강

추가된 smoke coverage:

- internal-only runtime router trust checks
- timeout-safe runtime messaging fallback
- selection helper double-injection guard
- `siteOrder` normalization / ordering reuse
- favorite dedupe race 방지
- favorite `{{counter}}` 직렬화
- chain stop on non-`submitted`
- partial/null `v3` / `v4` import migration
- scheduled summary isolation
- dashboard metrics aggregation

---

## 이미 완료로 판단하고 검증만 유지한 항목

아래 항목은 이번 패스에서 “새 구현” 대신 **현 코드 유지 + 회귀 검증**으로 정리했다.

- `historyLimit`는 삭제가 아닌 visible cap이라는 안내 유지
- chain favorite은 non-`submitted` 결과에서 중단
- stale pending broadcast reconcile 유지
- selection helper의 duplicate injection guard 유지

---

## 현재 남아 있는 후속 과제

### 1. 고급 분석 심화

현재 dashboard는 핵심 운영 지표를 제공하지만, 아래 항목은 아직 남아 있다.

- prompt-length distribution
- keyword / topic frequency
- 기간 필터 기반 dashboard aggregation

### 2. 신규 built-in AI 서비스 추가

후보:

- Microsoft Copilot
- Mistral Le Chat
- DeepSeek
- HuggingChat

이 항목은 실제 DOM 검증과 `lastVerified` 기록 없이는 넣지 않는 편이 안전하다.

### 3. 로케일 확장

- `ja`
- `zh_CN`

새 로케일은 단순 번역이 아니라 template/help/accessibility copy까지 함께 검수해야 한다.

### 4. 더 넓은 XSS 감사

이번 패스는 실제 user-controlled 경로 중 우선순위가 높은 options 차트/대시보드 렌더러를 우선 보강했다.
추가로 아래 경로는 계속 감사 대상이다.

- options의 다른 `innerHTML` 렌더러
- popup 목록/모달 렌더러
- import report / shortcut list 등 사용자 문자열이 섞일 수 있는 UI

### 5. schedule 재등록 atomicity

반복 schedule의 `scheduledAt` 갱신 + alarm 재등록은 현재도 reconcile로 복구 가능하지만, 저장과 재등록을 더 명시적으로 묶는 리팩터링 여지는 남아 있다.

---

## 권장 우선순위

| 순위 | 항목 | 이유 |
|------|------|------|
| 높음 | 신규 built-in 서비스 실기 검증 | 사용자 체감 기능 확장 |
| 중간 | 고급 dashboard 분석 | 운영성 / 분석성 향상 |
| 중간 | 추가 XSS 감사 | 장기 보안성 강화 |
| 낮음 | 로케일 확장 | 번역 품질 검수 비용 필요 |
