# AI Prompt Broadcaster — v2 고도화 Codex 프롬프트 명세서

> **사용 방법**: 이 문서를 AI에게 통째로 붙여넣은 뒤,
> "FIX-1부터 순서대로 수정해줘" 또는 "FIX-3만 적용해줘"처럼 지시하세요.
> 각 프롬프트는 독립적으로도, 누적 컨텍스트로도 사용 가능합니다.
> **현재 코드를 함께 첨부할수록 결과 품질이 높아집니다.**

---

## 📌 현재 상태 요약 (v1 완료 기준)

| 구분 | 상태 |
|------|------|
| 기본 전송 기능 | ✅ 완료 |
| UI/UX 개선 (카드형, 다크모드) | ✅ 완료 |
| 히스토리 & 즐겨찾기 | ✅ 완료 |
| 서비스 커스터마이징 | ✅ 완료 |
| 템플릿 변수 치환 | ✅ 완료 |
| 대시보드 | ✅ 완료 |
| 단축키 & 컨텍스트 메뉴 | ✅ 완료 |
| 다국어(i18n) | ✅ 완료 |
| 보안 강화 & 배포 준비 | ✅ 완료 |

---

## ⚠️ 현재 구현 기준 해석 메모

이 문서는 v2 작업 프롬프트를 모아둔 문서이며, 본문 예시에는 과거 파일 경로가 그대로 남아 있습니다. 현재 저장소는 `src/` TypeScript 소스와 `dist/` 빌드 산출물 구조를 사용합니다.

주요 경로 매핑:

- `config/sites.js` → `src/config/sites.ts`
- `shared/prompt_store.js` → `src/shared/stores/prompt-store.ts`
- `shared/sites_store.js` → `src/shared/stores/sites-store.ts`
- `shared/runtime_state.js` → `src/shared/stores/runtime-state.ts`
- `background/service_worker.js` → `src/background/main.ts`
- `popup/popup.js` → `src/popup/main.ts`
- `options/options.js` → `src/options/main.ts`
- `content/injector.js` → `src/content/injector/main.ts`
- `content/selector_checker.js` → `src/content/selector-checker/main.ts`
- `content/selection.js` → `src/content/selection/main.ts`

실제 Chrome 확장 로드 대상은 프로젝트 루트가 아니라 `dist/`입니다.

---

## 🗺️ v2 작업 목록

| 분류 | ID | 내용 | 우선순위 |
|------|----|------|---------|
| 🔴 즉시 수정 | FIX-1 | 셀렉터 버전 관리 + 실패 감지 | 긴급 |
| 🔴 즉시 수정 | FIX-2 | 탭 ID 맵 경쟁 조건 해결 | 긴급 |
| 🔴 즉시 수정 | FIX-3 | React controlled input 우회 강화 | 긴급 |
| 🔴 즉시 수정 | FIX-4 | MV3 서비스 워커 수명 대응 | 긴급 |
| 🔴 즉시 수정 | FIX-5 | alert() 전면 토스트 교체 | 높음 |
| 🟡 고도화 | ENH-1 | 응답 수집 & 비교 사이드패널 | 높음 |
| 🟡 고도화 | ENH-2 | 프롬프트 체이닝 자동화 | 중간 |
| 🟡 고도화 | ENH-3 | AI별 파라미터 개별 지정 | 중간 |
| 🟡 고도화 | ENH-4 | 웹훅 연동 (Slack·Notion) | 중간 |
| 🟢 다듬기 | POL-1 | waitMs 사이트별 최적화 | 높음 |
| 🟢 다듬기 | POL-2 | 전송 완료 데스크탑 알림 | 높음 |
| 🟢 다듬기 | POL-3 | 최초 설치 온보딩 흐름 | 중간 |
| 🟢 다듬기 | POL-4 | 팝업 닫힘 중 전송 처리 | 중간 |

**권장 작업 순서**: FIX-1 → FIX-2 → FIX-3 → FIX-4 → FIX-5 → POL-1 → POL-2 → POL-3 → ENH-1 → ENH-2 → ENH-3

---

## ════════════════════════════
## 🔴 즉시 수정 프롬프트
## ════════════════════════════

---

## FIX-1: 셀렉터 버전 관리 + 실패 감지

```
당신은 Chrome 확장 프로그램 안정성 전문가입니다.

AI Prompt Broadcaster의 가장 큰 장애 원인은
각 AI 사이트가 DOM 구조를 업데이트할 때 config의 셀렉터가 조용히 실패하는 것입니다.

아래 두 가지를 구현해주세요.

---

[작업 1] config/sites.js 개선

각 서비스 항목에 다음 필드를 추가해주세요:
- lastVerified: "YYYY-MM" 형식의 마지막 셀렉터 검증 날짜
- fallbackSelectors: 주 셀렉터 실패 시 순서대로 시도할 대체 셀렉터 배열
  예: ["#prompt-textarea", "textarea[data-id='root']", "div[contenteditable='true']"]
- verifiedVersion: 검증 당시 사이트 버전 또는 비고 (선택)

적용 대상: ChatGPT, Gemini, Claude, Grok 4개 서비스

---

[작업 2] content/injector.js 개선

주 셀렉터 실패 시 fallbackSelectors를 순서대로 시도하는 로직을 추가해주세요.

흐름:
1. config.inputSelector로 요소 탐색
2. 없으면 config.fallbackSelectors 배열을 순서대로 시도
3. 모두 실패하면 → background에 { action: "selectorFailed", serviceId } 메시지 전송
4. 성공한 셀렉터를 콘솔에 "✅ [서비스명] 주입 성공 (셀렉터: ...)" 형식으로 기록

---

[작업 3] background/service_worker.js 개선

{ action: "selectorFailed", serviceId } 메시지 수신 시:
- chrome.storage.local의 "failedSelectors" 배열에 { serviceId, timestamp } 추가
- 팝업이 열려있으면 팝업에 실패 알림 메시지 전달

---

[작업 4] popup.js 개선

팝업 열릴 때 "failedSelectors" 스토리지 확인:
- 실패 기록이 있으면 해당 서비스 카드에 ⚠️ 아이콘 + 노란 테두리 표시
- "셀렉터가 변경되었을 수 있습니다. config를 확인해주세요." 툴팁 표시

현재 코드: [여기에 현재 파일 코드 첨부]

수정된 파일 전체를 출력해주세요. 변경된 줄에 // CHANGED 주석을 달아주세요.
```

---

## FIX-2: 탭 ID 맵 경쟁 조건 해결

```
당신은 Chrome 확장 프로그램 동시성 문제 전문가입니다.

현재 background/service_worker.js에서 발생 가능한 경쟁 조건(race condition)을 수정해주세요.

---

[문제 1] chrome.tabs.onUpdated 중복 발화

chrome.tabs.onUpdated는 동일 탭에서 여러 번 발화됩니다.
status === "complete"를 체크해도 리다이렉트나 SPA 내비게이션 시 중복 발화됩니다.

해결:
- pendingTabs: Map<tabId, { siteConfig, prompt, injected: boolean }> 구조로 관리
- injected: false인 탭만 주입 시도
- 주입 완료 후 즉시 injected: true로 변경
- 탭이 닫히면(chrome.tabs.onRemoved) Map에서 해당 항목 삭제
- broadcast 시작 시 이전 pendingTabs에 남은 항목이 있으면 경고 로그 출력

---

[문제 2] 여러 번 broadcast 연속 클릭

Send 버튼을 빠르게 두 번 클릭하면 탭이 중복 생성됩니다.

해결:
- popup.js에서 Send 버튼 클릭 시 isSending 플래그를 true로 설정
- chrome.runtime.sendMessage 응답 수신 후 또는 2000ms 타임아웃 후 false로 복원
- isSending이 true이면 Send 버튼 비활성화 + 스피너 유지

---

[문제 3] 동일 URL 탭 충돌

같은 서비스가 sites 배열에 중복으로 전달될 경우(버그 방어):
- sites 배열을 id 기준으로 dedup 처리 후 진행

현재 코드: [여기에 service_worker.js와 popup.js 첨부]

수정된 파일 전체를 출력해주세요.
```

---

## FIX-3: React controlled input 우회 강화

```
당신은 Chrome 확장 프로그램 DOM 주입 전문가입니다.

현재 content/injector.js의 프롬프트 주입 로직이
React controlled input에서 실패하는 케이스를 해결해주세요.

---

[문제 원인]

ChatGPT, Claude는 React가 input 상태를 관리합니다.
단순히 element.value = prompt 또는 element.textContent = prompt로는
React 내부 상태와 싱크가 맞지 않아 전송 버튼이 활성화되지 않습니다.

---

[해결 전략 — 아래 우선순위대로 시도하는 함수 작성]

전략 A: nativeInputValueSetter 우회 (textarea/input 타입)
- Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
- 위 setter로 값 설정 후 new Event('input', { bubbles: true }) dispatch
- React 18 환경에서 가장 안정적

전략 B: execCommand 방식 (contenteditable 타입)
- element.focus()
- document.execCommand('selectAll')
- document.execCommand('insertText', false, prompt)
- 일부 브라우저에서 deprecated지만 contenteditable에서 여전히 동작

전략 C: ClipboardEvent 방식 (전략 A, B 모두 실패 시)
- DataTransfer 객체 생성 후 clipboardData에 텍스트 설정
- 'paste' 이벤트 dispatch

전략 D: 클립보드 복사 폴백 (모든 전략 실패 시)
- navigator.clipboard.writeText(prompt)
- 팝업에 "클립보드에 복사됨 — 직접 붙여넣기 후 전송해주세요" 토스트 표시

---

[구현 요구사항]

- injectPrompt(prompt, config) 함수에서 inputType에 따라 위 전략을 순서대로 시도
- 각 전략 성공/실패를 콘솔에 기록
- 전략 D까지 도달하면 background에 { action: "injectFallback", serviceId } 전송
- 전략별 로직을 별도 함수로 분리 (테스트 용이성)

현재 코드: [여기에 injector.js 첨부]

수정된 injector.js 전체를 출력해주세요.
```

---

## FIX-4: MV3 서비스 워커 수명 대응

```
당신은 Chrome MV3 서비스 워커 전문가입니다.

현재 background/service_worker.js가 MV3의 서비스 워커 수명 제한에
취약한 구조를 수정해주세요.

---

[문제]

MV3 서비스 워커는 비활성 상태에서 약 30초 후 종료됩니다.
"탭 생성 → 페이지 로드 완료 대기 → content script 주입" 흐름에서
로드가 오래 걸리는 사이트(느린 인터넷, 대용량 SPA 등)는
워커 종료 후 onUpdated 리스너가 사라져 주입이 조용히 실패합니다.

---

[해결 방안]

1. 주입 대기 상태 영속화
   - broadcast 시작 시 chrome.storage.session에 pendingInjections 저장:
     { tabId, siteConfig, prompt, createdAt }
   - 주입 완료 또는 실패 시 해당 항목 삭제
   - chrome.storage.session은 브라우저 세션 동안 유지되며
     서비스 워커 재시작 후에도 접근 가능

2. 워커 재시작 시 복원
   - service_worker.js 최상단에서 chrome.storage.session의
     pendingInjections를 읽어 아직 미주입 탭이 있으면
     onUpdated 리스너 재등록

3. 타임아웃 처리
   - createdAt 기준 60초가 지난 pendingInjections는 만료 처리
   - 만료된 항목은 "⏰ [서비스명] 주입 타임아웃" 로그 + 팝업 알림

4. 워커 강제 유지 (보조 수단)
   - chrome.alarms API를 활용해 25초마다 no-op alarm 발생시켜
     워커를 인위적으로 깨우는 방식 구현
   - manifest.json에 alarms 권한 추가

현재 코드: [여기에 service_worker.js 첨부]
현재 manifest.json: [여기에 manifest.json 첨부]

수정된 service_worker.js와 manifest.json 전체를 출력해주세요.
```

---

## FIX-5: alert() 전면 토스트 교체

```
당신은 Chrome 확장 프로그램 UX 개발자입니다.

현재 코드 전체에서 alert(), confirm(), prompt() 브라우저 기본 다이얼로그를
모두 찾아 인라인 토스트 시스템으로 교체해주세요.

---

[토스트 시스템 구현 요구사항]

파일: popup/toast.js (신규)

함수:
- showToast(message, type, duration)
  - type: "success" | "error" | "warning" | "info"
  - duration: ms (기본값 3000, -1이면 수동 닫기까지 유지)
- hideToast(id): 특정 토스트 닫기
- clearAllToasts(): 모든 토스트 제거

UI 요구사항:
- 팝업 하단에 고정 (position: fixed 대신 팝업 레이아웃 하단 영역 활용)
- 여러 개 동시 표시 가능 (스택형, 최대 3개)
- 슬라이드업 인 / 페이드아웃 애니메이션
- 타입별 아이콘: ✅ / ❌ / ⚠️ / ℹ️
- 타입별 색상:
  success: 초록 배경
  error: 빨간 배경
  warning: 노란 배경
  info: 파란 배경
- 토스트 클릭 시 즉시 닫기

---

[교체 대상 목록]

아래 상황에서 발생하는 alert/confirm을 모두 토스트로 교체:
- 주입 폴백: "클립보드에 복사됐습니다. 직접 붙여넣기 후 전송해주세요." (warning, 5000ms)
- 셀렉터 실패: "[서비스명] 셀렉터를 찾지 못했습니다." (error, -1)
- 전송 성공: "N개 서비스에 전송했습니다." (success, 2000ms)
- 빈 프롬프트: "프롬프트를 입력해주세요." (warning, 2000ms)
- 서비스 미선택: "최소 1개 서비스를 선택해주세요." (warning, 2000ms)
- 히스토리 삭제: "히스토리가 삭제됐습니다." (info, 2000ms)
- 설정 저장: "설정이 저장됐습니다." (success, 1500ms)

---

[content script 주의사항]

content/injector.js에서 alert() 사용 시:
- alert()는 해당 사이트의 컨텍스트에서 실행되어 사용자에게 낯선 알림이 뜸
- 반드시 chrome.runtime.sendMessage로 background → popup으로 전달하여
  팝업에서 토스트로 표시하는 방식으로 교체

현재 코드 전체: [여기에 관련 파일 모두 첨부]

toast.js 신규 파일과 수정된 파일 전체를 출력해주세요.
```

---

## ════════════════════════════
## 🟢 다듬기 프롬프트
## ════════════════════════════

---

## POL-1: waitMs 사이트별 최적화

```
당신은 Chrome 확장 프로그램 성능 튜닝 전문가입니다.

AI Prompt Broadcaster의 각 사이트별 waitMs 값을 최적화하고,
정적 대기 방식을 동적 감지 방식으로 개선해주세요.

---

[현재 문제]

waitMs는 고정값으로 설정되어 있습니다.
- 너무 짧으면: 입력 요소가 아직 렌더링 안 됨 → 조용한 실패
- 너무 길면: 불필요한 대기 → UX 저하

---

[개선 방안]

1. 동적 요소 감지 (MutationObserver + 타임아웃)

content/injector.js에 waitForElement(selector, timeoutMs) 함수 구현:
- MutationObserver로 DOM 변화를 감시
- 지정 셀렉터의 요소가 나타나면 즉시 resolve
- timeoutMs 초과 시 reject (기본 8000ms)
- fallbackSelectors도 동일하게 적용

구현 예시:
  function waitForElement(selectors, timeoutMs = 8000) {
    // selectors는 배열 — 하나라도 발견되면 resolve
    // MutationObserver + Promise 패턴
  }

2. 사이트별 권장 waitMs 값 (config/sites.js 업데이트)
   - ChatGPT: waitMs: 2000 (SPA 렌더링 고려)
   - Gemini: waitMs: 2500 (Google 서비스 초기화 시간)
   - Claude: waitMs: 1500 (비교적 빠른 로드)
   - Grok: waitMs: 2000 (X.com 인증 처리 시간)

3. 주입 성공까지 걸린 시간을 콘솔에 기록
   "✅ [서비스명] 주입 성공 (대기: XXXms)"

4. 사용자 설정 가능하도록
   options 페이지 설정 섹션에 서비스별 waitMs 슬라이더 추가
   (범위: 500~8000ms, 기본값은 config 값)

현재 코드: [여기에 injector.js와 sites.js 첨부]

수정된 파일 전체를 출력해주세요.
```

---

## POL-2: 전송 완료 데스크탑 알림

```
당신은 Chrome 확장 프로그램 개발자입니다.

AI Prompt Broadcaster에 전송 완료 시 데스크탑 알림을 추가해주세요.

---

[필요성]

전송 후 팝업을 닫으면 결과를 확인할 방법이 없습니다.
데스크탑 알림으로 완료 여부를 사용자에게 알려줘야 합니다.

---

[구현 요구사항]

1. manifest.json에 "notifications" 권한 추가

2. background/service_worker.js에서
   모든 탭 주입 완료(또는 실패) 후 chrome.notifications.create() 호출:

   성공 시:
   - 제목: "AI Broadcaster"
   - 내용: "3개 서비스에 전송했습니다. ✅"
   - iconUrl: icons/icon48.png

   일부 실패 시:
   - 내용: "2개 성공, 1개 실패 (ChatGPT). 셀렉터를 확인해주세요."

   전체 실패 시:
   - 내용: "전송에 실패했습니다. 각 탭을 확인해주세요."

3. 알림 클릭 시 팝업 열기
   chrome.notifications.onClicked 리스너에서
   chrome.action.openPopup() 호출

4. 사용자 설정
   options 페이지 설정 섹션에 "전송 완료 알림 표시" 토글 추가
   (기본값: true)
   chrome.storage.local의 "notificationEnabled" 키로 저장
   전송 전 이 값을 확인하여 알림 여부 결정

현재 코드: [여기에 service_worker.js와 manifest.json 첨부]

수정된 파일 전체를 출력해주세요.
```

---

## POL-3: 최초 설치 온보딩 흐름

```
당신은 Chrome 확장 프로그램 UX 개발자입니다.

AI Prompt Broadcaster 최초 설치 시 보여줄 온보딩 페이지를 구현해주세요.

---

[트리거]

background/service_worker.js의 chrome.runtime.onInstalled 리스너:
- reason === "install": 온보딩 페이지 열기
- reason === "update": 업데이트 내역 페이지 열기 (선택)

---

[온보딩 페이지 구성]

파일: onboarding/onboarding.html + onboarding/onboarding.js

UI 구조: 3단계 스텝 (진행 표시 점 ● ○ ○)

Step 1 — 환영 화면
- 확장 이름 + 로고 SVG
- 한 줄 설명: "프롬프트 하나로 ChatGPT, Gemini, Claude, Grok에 동시 전송"
- 지원 서비스 로고 (이모지 기반 카드 4개)
- "시작하기" 버튼

Step 2 — 권한 안내
- 사용하는 권한 목록을 사용자 친화적 언어로 설명:
  - tabs: 각 AI 서비스를 새 탭으로 열기 위해 필요
  - scripting: 탭에 프롬프트를 자동 입력하기 위해 필요
  - storage: 히스토리·즐겨찾기를 로컬에 저장하기 위해 필요
  - host_permissions: 각 AI 사이트에서만 동작하도록 제한
- "개인 데이터는 브라우저 밖으로 나가지 않습니다" 안내
- "다음" 버튼

Step 3 — 사용 방법
- 3단계 사용 흐름 시각화:
  1. 확장 아이콘 클릭 → 팝업 열기
  2. 프롬프트 입력 + 서비스 선택
  3. Send 클릭 → 각 탭에 자동 전송
- "완료 — 사용 시작" 버튼 (클릭 시 탭 닫기)

---

[스타일 요구사항]
- 전체 페이지 너비: max-width 600px, 중앙 정렬
- 팝업과 동일한 색상 시스템 사용
- 다크모드 대응
- 스텝 전환 시 슬라이드 애니메이션

manifest.json 수정 사항(web_accessible_resources 추가)과
onboarding.html, onboarding.js 전체 코드를 출력해주세요.
```

---

## POL-4: 팝업 닫힘 중 전송 처리

```
당신은 Chrome 확장 프로그램 개발자입니다.

전송 도중 팝업이 닫혀도 사용자가 결과를 확인할 수 있도록 개선해주세요.

---

[현재 문제]

Send 클릭 후 팝업을 닫으면:
- background service worker는 계속 실행되어 전송은 완료됨
- 하지만 팝업 UI에 결과가 표시되지 않음
- POL-2의 데스크탑 알림이 있으면 보완되지만,
  알림을 꺼둔 사용자는 결과 확인 불가

---

[해결 방안]

1. 전송 상태를 chrome.storage.session에 저장

broadcast 시작 시:
{
  broadcastId: timestamp,
  status: "sending",
  prompt: "...",
  total: 3,
  completed: 0,
  failed: [],
  startedAt: ISO 문자열
}

각 탭 주입 완료/실패 시 completed 또는 failed 업데이트
모두 완료 시 status: "done"으로 변경

2. 팝업 재열기 시 상태 복원

popup.js의 DOMContentLoaded에서:
- chrome.storage.session의 lastBroadcast 확인
- status가 "sending"이면: "전송 중..." 상태로 UI 복원
- status가 "done"이고 5분 이내라면: 결과 요약 토스트 표시
  "마지막 전송: 2개 성공, 1개 실패" (info, -1)
- 5분 초과면 무시

3. 배지(badge) 표시

chrome.action.setBadgeText API 활용:
- 전송 중: 배지에 "..." 표시 (주황색 배경)
- 완료: 배지에 "✓" 표시 (초록색 배경, 5초 후 자동 제거)
- 실패 포함: 배지에 "!" 표시 (빨간색 배경, 클릭 시 제거)

현재 코드: [여기에 service_worker.js와 popup.js 첨부]

수정된 파일 전체를 출력해주세요.
```

---

## ════════════════════════════
## 🟡 고도화 프롬프트
## ════════════════════════════

---

## ENH-1: 응답 수집 & 비교 사이드패널

```
당신은 Chrome 확장 프로그램 고급 기능 개발자입니다.

AI Prompt Broadcaster에 각 AI 서비스의 응답을 수집하여
Chrome 사이드패널에 나란히 비교 표시하는 기능을 구현해주세요.

---

[기술 요구사항]

Chrome Side Panel API (chrome.sidePanel) 사용
- Chrome 114 이상에서 지원
- manifest.json에 "sidePanel" 권한 + side_panel 선언 필요

---

[구현 흐름]

1. 응답 감지 (content/response_collector.js 신규)

각 AI 사이트별 응답 컨테이너 셀렉터를 config/sites.js에 추가:
- responseSelector: 응답이 렌더링되는 DOM 요소 셀렉터
- responseCompleteSelector: 응답 완료를 나타내는 요소 셀렉터
  (예: 전송 버튼 재활성화, "Stop generating" 버튼 사라짐 등)

MutationObserver로 responseSelector 감시:
- 텍스트 변화가 3초간 없으면 응답 완료로 판단
- 완료된 응답 텍스트를 background에 전송:
  { action: "responseCollected", serviceId, text, timestamp }

2. 사이드패널 UI (sidepanel/sidepanel.html + sidepanel.js)

레이아웃:
- 상단: 전송한 프롬프트 표시 (접기/펼치기)
- 중간: 서비스별 응답 카드 (세로 스크롤)
  - 각 카드: 서비스 이름 + 색상 + 응답 텍스트
  - 마크다운 기본 렌더링 (굵게, 코드블록 등)
  - 카드별 복사 버튼
- 하단: 전체 응답 비교 내보내기 버튼 (마크다운 파일로)

상태 표시:
- 수집 대기 중: 서비스 카드에 로딩 애니메이션
- 수집 완료: 응답 텍스트 표시
- 수집 실패: "응답을 가져오지 못했습니다." + 해당 탭 열기 버튼

3. 사이드패널 자동 열기

broadcast 시작 시 chrome.sidePanel.open({ windowId }) 자동 호출
(사용자가 설정에서 비활성화 가능)

---

[config/sites.js 추가 필드 예시]

ChatGPT:
  responseSelector: "div[data-message-author-role='assistant']"
  responseCompleteSelector: "button[data-testid='send-button']:not([disabled])"

Claude:
  responseSelector: "div.font-claude-message"
  responseCompleteSelector: "button[aria-label='Stop Response']" (사라지면 완료)

---

[주의사항]

- 응답 수집은 사용자가 명시적으로 활성화한 경우에만 동작
  (options 페이지에 "응답 수집 활성화" 토글)
- 응답 텍스트는 chrome.storage.session에만 저장 (세션 종료 시 삭제)
- 응답 텍스트를 외부로 전송하지 않음을 명시

manifest.json 수정 사항과
response_collector.js, sidepanel.html, sidepanel.js 전체 코드를 출력해주세요.
```

---

## ENH-2: 프롬프트 체이닝 자동화

```
당신은 Chrome 확장 프로그램 고급 기능 개발자입니다.

AI Prompt Broadcaster에 프롬프트 체이닝 기능을 추가해주세요.
여러 프롬프트를 순서대로 자동 전송하는 기능입니다.

---

[기능 개요]

사용자가 프롬프트 목록을 작성하면:
1. 첫 번째 프롬프트 전송
2. N초 대기 (설정 가능)
3. 동일 탭에 두 번째 프롬프트 전송
4. 반복

예시 사용 사례:
- "번역해줘" → 5초 후 → "더 자연스럽게 다듬어줘"
- "코드 작성해줘" → 10초 후 → "이 코드에 주석 달아줘" → "테스트 코드도 작성해줘"

---

[UI 구현]

팝업 내 "체이닝 모드" 토글 버튼 추가
활성화 시:
- textarea 아래에 "다음 프롬프트 추가 +" 버튼 표시
- 프롬프트 목록이 순서대로 표시 (드래그 재정렬 가능)
- 각 프롬프트 사이에 대기 시간 설정 (초 단위 입력, 기본 5초)
- 전체 체인 실행 예상 시간 표시

실행 중 UI:
- 현재 몇 번째 프롬프트 전송 중인지 표시 (예: "2/3 전송 중")
- 각 단계 완료 시 체크마크
- 중단 버튼

---

[기술 구현]

background/service_worker.js:
- { action: "broadcastChain", chain: [{prompt, delayMs}], sites } 메시지 처리
- chain 배열을 순서대로 처리하는 async 함수 구현
- 각 프롬프트는 기존 탭(이미 열린 AI 탭)에 재주입
  (탭을 다시 열지 않고 기존 탭 재사용)
- 탭 재사용 시 이전 대화 컨텍스트가 유지됨

content/injector.js:
- 기존 탭에서 재주입 시 입력 필드를 clear하고 새 프롬프트 입력하는 로직 추가

체인 상태 저장:
- chrome.storage.session에 현재 체인 실행 상태 저장
- 팝업 재열기 시 진행 중인 체인 상태 복원

관련 파일 수정 사항과 전체 코드를 출력해주세요.
```

---

## ENH-3: AI별 파라미터 개별 지정

```
당신은 Chrome 확장 프로그램 고급 기능 개발자입니다.

AI Prompt Broadcaster에서 각 AI 서비스별로
모델, 언어, 응답 형식 등을 개별 지정할 수 있는 기능을 추가해주세요.

---

[기능 개요]

현재: 모든 서비스에 동일한 프롬프트를 그대로 전송
목표: 서비스마다 다른 파라미터를 앞뒤에 붙여서 전송 가능

예시:
- ChatGPT: "한국어로 답해줘. \n\n{{prompt}}"
- Claude: "{{prompt}}\n\n응답은 마크다운 형식으로 작성해줘."
- Gemini: "{{prompt}}"
- Grok: "{{prompt}}\n\n간결하게 답해줘."

---

[UI 구현]

팝업의 각 서비스 카드에 "⚙️" 아이콘 추가
클릭 시 해당 서비스의 파라미터 설정 인라인 패널 확장:

설정 항목:
- 프롬프트 래퍼 (prefix/suffix):
  - prefix textarea: 프롬프트 앞에 붙일 텍스트
  - suffix textarea: 프롬프트 뒤에 붙일 텍스트
  - 미리보기: "실제 전송될 프롬프트: [prefix] + [원본] + [suffix]"
- 활성화 토글: 이 서비스의 래퍼 사용 여부

설정 저장:
- chrome.storage.local의 "serviceParams" 키에 서비스별로 저장
- 팝업 열릴 때마다 복원

---

[전송 시 처리]

popup.js → background.js 메시지에 sites 배열 전달 시
각 site 항목에 resolvedPrompt 필드 추가:
{
  ...siteConfig,
  resolvedPrompt: prefix + originalPrompt + suffix
}

background/service_worker.js:
- resolvedPrompt가 있으면 originalPrompt 대신 사용

---

[고급 기능: 시스템 프롬프트 주입 (선택)]

일부 서비스(ChatGPT Projects, Claude)는 시스템 프롬프트 입력이 가능합니다.
서비스별 systemPromptSelector를 config에 추가하고
별도 시스템 프롬프트 입력 필드를 파라미터 패널에 추가해주세요.

현재 코드: [여기에 관련 파일 첨부]

수정된 파일과 신규 파일 전체를 출력해주세요.
```

---

## ENH-4: 웹훅 연동 (Slack·Notion 결과 전송)

```
당신은 Chrome 확장 프로그램 고급 기능 개발자입니다.

AI Prompt Broadcaster에 응답 수집 결과를 외부 서비스로 전송하는
웹훅 연동 기능을 추가해주세요.

---

[기능 개요]

ENH-1의 응답 수집 기능과 연계하여,
수집된 각 AI 응답을 Slack 또는 Notion으로 자동 전송합니다.

---

[지원 연동 대상]

1. Slack Incoming Webhook
   - 사용자가 Slack Webhook URL 입력
   - 응답 수집 완료 시 메시지 전송:
     - 원본 프롬프트
     - 각 AI별 응답 (Slack 마크다운 형식)

2. Notion API (Database에 행 추가)
   - Notion Integration Token + Database ID 입력
   - 각 AI 응답을 별도 행으로 추가:
     Properties: 날짜, AI 서비스명, 프롬프트, 응답 내용

3. 커스텀 Webhook
   - URL + HTTP Method (POST/PUT) 입력
   - 전송 Payload 템플릿 (JSON 형식, {{prompt}}·{{responses}} 변수 지원)

---

[UI 구현]

options 페이지에 "웹훅 연동" 섹션 추가:
- 연동 대상 선택 (Slack / Notion / 커스텀)
- 각 연동별 설정 폼
- "테스트 전송" 버튼 (더미 데이터로 실제 전송 테스트)
- 연동 활성화/비활성화 토글

---

[보안 주의사항]

- API 토큰과 Webhook URL은 chrome.storage.local에 저장
  (sync 스토리지 사용 금지 — 서버 동기화로 유출 위험)
- 저장 전 사용자에게 로컬에만 저장됨을 안내
- 전송 실패 시 재시도 1회 후 에러 토스트 표시

---

[background/service_worker.js 추가 로직]

- ENH-1의 responseCollected 처리 완료 후
  chrome.storage.local의 webhookConfig 확인
- 활성화된 연동 대상에 fetch()로 데이터 전송
- fetch는 service_worker에서 가능 (DOM 접근과 달리 허용됨)

현재 코드: [여기에 관련 파일 첨부]

수정된 파일과 신규 파일 전체를 출력해주세요.
```

---

## 💡 AI에게 넘길 때 권장 지시 문구

```
# 즉시 수정만 먼저
위 문서에서 FIX-1부터 FIX-5까지 순서대로 적용해줘.
각 FIX 완료 후 "✅ FIX-N 완료 — 수정된 파일: [목록]" 형식으로 요약해줘.
현재 코드: [전체 파일 첨부]

# 안정성 수정 + 다듬기까지
FIX 시리즈와 POL 시리즈를 모두 적용해줘.
우선순위 순서: FIX-1 → FIX-2 → FIX-3 → FIX-4 → FIX-5 → POL-1 → POL-2 → POL-3

# 특정 항목만
FIX-3(React input 우회)과 POL-1(waitMs 최적화)만 적용해줘.
현재 injector.js: [코드 첨부]

# 전체 v2 완성
모든 FIX → POL → ENH 순서로 단계적으로 구현해줘.
ENH 시리즈는 FIX + POL 완료 후 별도 세션에서 진행 예정.
```

---

*문서 버전: v2.0 | 작업 분류: FIX(즉시수정) / POL(다듬기) / ENH(고도화) | 최종 업데이트: 2026-03*
