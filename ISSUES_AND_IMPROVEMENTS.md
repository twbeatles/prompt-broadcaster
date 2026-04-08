# AI Prompt Broadcaster — 잠재적 문제 및 개선 포인트

> 작성일: 2026-04-08
> 분석 기준: `src/`, `popup/`, `options/`, `manifest.json`, `scripts/`, `qa/`
> 참조: `CLAUDE.md`, `README.md`, `PROJECT_ANALYSIS.md`, `FEATURE_ROADMAP.md`

---

## 요약

| 분류 | 건수 |
|------|------|
| 잠재적 버그 / 런타임 이슈 | 8 |
| 보안 취약점 | 2 |
| 아키텍처 / 설계 취약점 | 5 |
| 누락 기능 / UX 개선 | 6 |
| 테스트 커버리지 공백 | 4 |

---

## 1. 잠재적 버그 / 런타임 이슈

### 1-1. MutationObserver 전체 문서 관찰
**파일**: `src/content/injector/selectors.ts` (lines 188–196)

```typescript
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,   // 모든 속성 변경 감시
});
```

`attributeFilter` 없이 `subtree: true`를 사용하면 SPA에서 DOM 변경이 빈번할 때 콜백이 과다 호출된다. 특히 ChatGPT·Gemini처럼 실시간 스트리밍 응답을 렌더링하는 서비스에서는 수백 ms 동안 수천 번 트리거될 수 있다.

**개선안**:
```typescript
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class", "id", "style", "disabled", "aria-disabled"],
});
```

---

### 1-2. `chrome.runtime.sendMessage` 타임아웃 없음
**파일**: `src/popup/app/bootstrap.ts` (lines 771, 1163, 1232, 1285, 1536, 1549, 2538)

```typescript
const response = await chrome.runtime.sendMessage({ action: "getOpenAiTabs" }).catch(() => null);
```

Service Worker가 예상치 못하게 종료됐거나 응답을 보내지 않으면 Promise가 무기한 대기한다. `catch(() => null)` 는 에러를 삼키지만, `sendMessage` 자체는 Chrome이 `The message port closed` 에러를 던지기 전까지 대기 상태가 유지된다.

**개선안**: 공통 `sendMessageWithTimeout` 유틸 추출
```typescript
// src/shared/chrome/messaging.ts
export async function sendMessageWithTimeout<T>(
  message: unknown,
  timeoutMs = 5000
): Promise<T | null> {
  return Promise.race([
    chrome.runtime.sendMessage(message).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}
```

---

### 1-3. 외부 익스텐션 메시지 수신 검증 없음
**파일**: `src/background/messages/router.ts` (line 19)

```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = handlers[message?.action];
  // sender.id 검증 없음
```

`sender.id !== chrome.runtime.id`인 경우(다른 익스텐션, 인젝션된 콘텐츠 스크립트)도 핸들러가 실행된다. 특히 `broadcast` 같은 쓰기 액션은 외부에서 트리거 가능한 상태다.

**개선안**:
```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 외부 익스텐션 메시지 차단 (콘텐츠 스크립트는 sender.tab이 있음)
  if (!sender.tab && sender.id !== chrome.runtime.id) {
    return false;
  }
  const handler = handlers[message?.action];
  // ...
```

---

### 1-4. `innerHTML` 할당 시 `escapeHtml` 누락 위험
**파일**: `src/popup/app/bootstrap.ts` (line 656), `src/options/features/history.ts` (line 93)

```typescript
bar.innerHTML = `
  <span class="progress-label">${someValue}</span>
```

`escapeHtml`을 사용하는 곳도 있지만, 일부 동적 값이 삽입되는 곳에서 누락될 경우 XSS 위험이 발생한다. 사용자 입력 프롬프트·커스텀 서비스명·태그가 히스토리/즐겨찾기 목록에 그대로 렌더링될 수 있는 경로를 검토해야 한다.

**개선안**: `innerHTML` 사용 위치를 전수 감사하고 모든 동적 문자열에 `escapeHtml` 적용 또는 `textContent` / `createElement` 방식으로 전환. 현재 `escapeHtml` 부재 파일(예: `src/options/features/history.ts`)은 즉시 보강 필요.

---

### 1-5. Favorite 체인 중단 조건의 누락 엣지 케이스
**파일**: `src/background/popup/favorites-workflow.ts`

체인 favorite은 step 결과가 `submitted`가 아니면 즉시 중단하도록 설계됐지만, `cancelled` 결과 코드와 `tab_closed` 코드를 동일하게 처리하는지 명확하지 않다. 탭이 외부 요인으로 닫힌 경우, 다음 step이 계속 실행되면 의도치 않은 동작이 발생할 수 있다.

**확인 필요**: `InjectionResultCode` 중 `submitted` 이외 모든 코드가 실제로 체인을 중단시키는지 검증.

---

### 1-6. Schedule alarm reconcile 후 `scheduledAt` 갱신 타이밍
**파일**: `src/background/popup/favorites-workflow.ts`

`daily`/`weekday`/`weekly` 반복 예약에서 alarm이 발화한 후 `scheduledAt`을 갱신해 다음 alarm을 재등록한다. 이 갱신이 완료되기 전에 Service Worker가 Idle로 종료되면 다음 발화가 누락될 수 있다.

**개선안**: `scheduledAt` 갱신 및 alarm 재등록을 하나의 atomic 저장+등록 시퀀스로 묶고, 실패 시 startup reconcile에서 복구되도록 보장.

---

### 1-7. `broadcastCounter` 미결 상태 시 카운터 오염
**CLAUDE.md 명시**: `{{counter}}` 프리뷰는 `current + 1`을 사용하고, 실제 저장은 "1개 이상 성공 큐잉" 이후에만 증가한다.

그런데 사용자가 즐겨찾기를 연속으로 빠르게 실행(job dedupe 조건 미충족 간격)하면, 각 즐겨찾기 실행이 카운터를 독립적으로 읽어 증가시킬 수 있다. 동시 실행 경로가 있는지 확인 필요.

---

### 1-8. `content/selection` 이벤트 리스너 정리 누락
**파일**: `src/content/selection/helper.ts`

```typescript
document.addEventListener("selectionchange", scheduleSelectionUpdate, true);
document.addEventListener("mouseup", scheduleSelectionUpdate, true);
document.addEventListener("keyup", scheduleSelectionUpdate, true);
window.addEventListener("focus", scheduleSelectionUpdate, true);
```

Content script가 재주입되거나 SPA에서 같은 탭에서 경로가 바뀌어도 이전 리스너가 남아 누적된다. `beforeunload` 또는 `chrome.runtime.onSuspend`에서 `removeEventListener`로 정리해야 한다.

---

## 2. 보안 취약점

### 2-1. 외부 메시지 발신자 검증 누락 (1-3과 연계)
위 1-3 항목 참조. 특히 `broadcast` 액션을 외부 메시지로 트리거할 수 있다면, 악성 익스텐션이 사용자 의도 없이 AI 서비스에 임의 텍스트를 주입할 수 있다.

### 2-2. `innerHTML` 기반 동적 렌더링 (1-4와 연계)
위 1-4 항목 참조. 사용자가 직접 입력하거나 import한 데이터(커스텀 서비스명, 즐겨찾기 제목/텍스트, 태그)가 `innerHTML`로 렌더링되면 stored XSS가 가능하다.

---

## 3. 아키텍처 / 설계 취약점

### 3-1. 스토리지 쓰기 직렬화 보장 범위
**CLAUDE.md 명시**: "pending injections, pending broadcasts, selector alerts are mirrored in background memory and written through a serialized mutation chain"

그러나 `chrome.storage.session.set`은 객체 레퍼런스를 직렬화하는 시점에 live state가 변경될 수 있다. 특히 고속 연속 방송 시 스냅샷이 아닌 레퍼런스를 그대로 쓰면 실제 저장 내용이 의도와 다를 수 있다.

**개선안**: 세션 스토리지 쓰기 직전 `structuredClone()` 또는 `JSON.parse(JSON.stringify(...))` 로 방어적 스냅샷 확보.

---

### 3-2. `router.ts`에서 `sendResponse` 자체 오류 미처리
**파일**: `src/background/messages/router.ts` (line 14)

```typescript
.catch((error) => {
  sendResponse(fallback);  // sendResponse 자체가 throw해도 잡히지 않음
});
```

메시지 포트가 이미 닫혀 있다면 `sendResponse`가 throw하는데, 이를 잡는 코드가 없어 unhandled rejection이 발생한다.

**개선안**:
```typescript
.catch((error) => {
  try { sendResponse(fallback); } catch (_) { /* port closed */ }
});
```

---

### 3-3. 즐겨찾기 job dedupe 범위 협소
dedupe가 "같은 favorite ID의 `queued/running` 겹침"만 방지하므로, 사용자가 같은 즐겨찾기를 빠르게 2회 클릭하면 첫 번째가 `running`으로 전환되기 전 두 번째 큐잉이 성공할 수 있다. 실질적인 이중 실행 방지를 위해 큐잉 즉시 상태를 `queued`로 설정하는 타이밍이 중요하다.

---

### 3-4. `getSiteById` 반복 호출 최적화 없음
**파일**: `src/background/app/bootstrap.ts`

방송 처리 중 `getRuntimeSites()` 전체를 매 사이트마다 호출한다면, 커스텀 사이트가 많은 사용자의 경우 불필요한 스토리지 읽기가 누적된다. 방송 세션 범위 내 사이트 목록을 한 번만 로드해서 재사용하는 패턴을 적용하면 개선된다.

---

### 3-5. `appSettings.historyLimit` 의미 이중성
**CLAUDE.md 명시**: "historyLimit is now a default visible history cap only. Lower values hide older rows without deleting"

하지만 옵션 UI에서 이 설정이 "삭제"가 아닌 "표시 제한"임을 명확히 안내하지 않으면 사용자가 데이터가 지워진 것으로 오해한다. UI 레이블과 도움말 문구 보강 필요.

---

## 4. 누락 기능 / UX 개선

### 4-1. 방송 stuck 상태 자동 타임아웃 없음
방송이 `sending` 상태에서 멈추면(탭 크래시, Service Worker 재시작 등) 사용자가 수동으로 취소해야 한다. 일정 시간(예: 10분) 이후 자동으로 `failed` 처리하는 reconcile 로직이 없다.

**구현 포인트**: startup reconcile 또는 popup 오픈 시 오래된 pending broadcast를 정리.

---

### 4-2. 스케줄 실행 실패 시 사용자 알림 부재
scheduled favorite이 실패해도 options Schedules 섹션에 최근 실행 결과가 표시되지 않으면 사용자가 실패를 인지하기 어렵다. `FavoriteRunJob`의 결과를 Schedules UI에 노출하거나, 실패 시 별도 토스트/알림을 제공해야 한다.

---

### 4-3. 방송 순서 커스터마이징 미구현
**FEATURE_ROADMAP.md 2순위 항목**

`waitMsMultiplier`는 있으나 `siteOrder`는 없다. 사용자가 서비스 목록의 실행 순서를 지정할 수 없어, 주로 사용하는 AI가 나중에 실행되는 불편함이 있다.

---

### 4-4. 히스토리 통계 시각화 부족
**FEATURE_ROADMAP.md 2순위 항목**

`siteResults`, `strategyStats` 데이터가 저장되지만 options Dashboard에서 충분히 시각화되지 않는다. 요일·시간대별 히트맵, 서비스별 성공률 추이, 상위 실패 원인이 추가되면 운영성이 크게 개선된다.

---

### 4-5. 신규 내장 AI 서비스 미추가
**FEATURE_ROADMAP.md 2순위 항목**

현재 5개(ChatGPT, Gemini, Claude, Grok, Perplexity). 검토 대상 서비스:

| 서비스 | 도메인 |
|--------|--------|
| Microsoft Copilot | `copilot.microsoft.com` |
| Mistral Le Chat | `chat.mistral.ai` |
| DeepSeek | `chat.deepseek.com` |
| HuggingChat | `huggingface.co/chat` |

각 서비스 selector 실기 검증 및 `lastVerified` 기록 필요.

---

### 4-6. 다국어 확장 미완
**FEATURE_ROADMAP.md 보류 항목**

`_locales/en`, `_locales/ko`만 존재. `ja`, `zh_CN` 추가 시 빌드 키 parity 검증도 함께 확장 필요.

---

## 5. 테스트 커버리지 공백

### 5-1. 템플릿 변수 엣지 케이스 미검증

현재 smoke 테스트에서 다루지 않는 시나리오:
- `{{clipboard}}`에 HTML 태그 또는 이모지 포함
- `{{counter}}`를 포함한 즐겨찾기를 체인 step 중간에서 사용
- per-service override 에 시스템 변수와 사용자 변수가 혼합된 경우

---

### 5-2. Storage migration 부분 경로 미검증

`v1 → v6` 전체 마이그레이션 경로는 있지만, 중간 버전(`v3`, `v4`) 데이터가 불완전하거나 필드가 `null`인 경우의 처리가 smoke 테스트에서 확인되지 않는다.

---

### 5-3. 동시 방송 + 스케줄 발화 충돌 미검증

사용자가 팝업에서 수동 방송 중에 scheduled alarm이 발화하는 경우, pending broadcast 상태와 새 job이 어떻게 상호작용하는지 테스트가 없다.

---

### 5-4. 커스텀 서비스 permission 오염 시나리오

커스텀 서비스를 import 하는 도중 사용자가 다른 커스텀 서비스를 삭제하면 permission cleanup 로직이 이전 상태를 기반으로 동작해 활성 permission이 제거될 수 있다. 이 경합 조건의 smoke 테스트가 없다.

---

## 우선순위 권장 순서

| 순위 | 항목 | 이유 |
|------|------|------|
| 즉시 | **2-1, 2-2 (보안)** | 외부 메시지 검증 + XSS 가능 경로 |
| 즉시 | **1-3 (router 발신자 검증)** | 위 2-1의 구현 포인트 |
| 높음 | **1-2 (메시지 타임아웃)** | 팝업 hang 원인 |
| 높음 | **1-8 (이벤트 리스너 정리)** | 장기 세션 메모리 누적 |
| 높음 | **3-2 (sendResponse try/catch)** | unhandled rejection |
| 중간 | **4-1 (방송 stuck 타임아웃)** | 사용자 경험 |
| 중간 | **4-2 (스케줄 실패 알림)** | 가시성 |
| 중간 | **1-1 (Observer 범위 축소)** | 성능 |
| 낮음 | **4-3, 4-4 (로드맵 기능)** | FEATURE_ROADMAP 진행 |
| 낮음 | **4-5 (신규 서비스 추가)** | DOM 검증 필요 |
