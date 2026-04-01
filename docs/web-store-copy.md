# Chrome Web Store Copy Pack

Last updated: 2026-04-01

## Korean

### 132자 이내 요약

하나의 프롬프트를 ChatGPT, Gemini, Claude, Grok, Perplexity에 동시에 전송하고 결과 비교를 더 빠르게 시작할 수 있는 Chrome 확장 프로그램입니다.

### 상세 설명

AI Prompt Broadcaster는 반복 복붙 없이 하나의 프롬프트를 여러 AI 서비스에 동시에 전송할 수 있는 Chrome 확장 프로그램입니다.

주요 기능:

- ChatGPT, Gemini, Claude, Grok, Perplexity 동시 전송
- 현재 Chrome 창에서 이미 열려 있는 AI 탭 재사용
- 서비스별로 특정 열린 탭 선택 또는 새 탭 강제 열기
- 선택한 텍스트를 우클릭 메뉴나 단축키로 바로 프롬프트로 사용
- 프롬프트 히스토리, 즐겨찾기, 템플릿 변수 지원
- 로컬 브라우저 저장소 기반 데이터 보관
- 사용자 정의 AI 서비스 추가/비활성화/편집 지원

이 확장 프로그램은 별도 백엔드나 API 키 없이 동작하며, 사용자가 선택한 AI 웹사이트에만 직접 프롬프트를 전달합니다.

### Single Purpose 문구

사용자가 입력하거나 선택한 텍스트를 하나 이상의 AI 웹 서비스 탭에 열고 해당 입력 필드에 자동 입력해 전송하도록 돕는 확장 프로그램입니다.

### 권한 사용 소명

- `activeTab`: 현재 활성 탭의 선택 텍스트 읽기, 활성 페이지 기준 셀렉터 테스트, 현재 탭 컨텍스트 확인에 사용합니다.
- `tabs`: 대상 AI 서비스 페이지를 새 탭으로 열고, 현재 창에서 이미 열려 있는 AI 탭을 찾고, 전송 중 탭 상태를 추적하는 데 사용합니다.
- `scripting`: 지원 대상 AI 사이트 탭에 스크립트를 주입해 입력 요소와 전송 버튼을 찾고, 프롬프트를 자동 입력 및 전송하는 데 사용합니다.
- `storage`: 최근 프롬프트, 히스토리, 즐겨찾기, 템플릿 값, 사용자 정의 서비스 설정, UI 상태를 로컬에 저장하는 데 사용합니다.
- `alarms`: 전송 후 배지 상태를 일정 시간 뒤 자동으로 지우고, 서비스 워커 재시작 시 미완료 전송 상태를 재정리하는 데 사용합니다.
- `contextMenus`: 우클릭 메뉴에서 바로 AI Broadcaster로 전송 기능을 제공하는 데 사용합니다.
- `notifications`: 전송 완료 및 셀렉터 변경 감지 알림을 표시하는 데 사용합니다.
- `clipboardWrite`: 자동 주입 실패 시 프롬프트 복사를 돕는 데 사용합니다.
- `clipboardRead`(선택 권한): `{{클립보드}}` 템플릿 변수 사용 시에만 클립보드 내용을 읽습니다.
- `host_permissions`: `chatgpt.com`, `gemini.google.com`, `claude.ai`, `grok.com`, `www.perplexity.ai`, `perplexity.ai`에서만 콘텐츠 스크립트를 실행하고, 열린 탭 재사용과 자동 입력/전송을 수행하기 위해 사용합니다.
- `optional_host_permissions`: 사용자 정의 AI 서비스를 추가한 경우에만 해당 서비스 권한을 런타임에 요청합니다. 매니페스트에는 `https://*/*`, `http://*/*`가 선언되어 있지만 실제 권한 부여는 사용자가 직접 추가한 서비스의 `url`과 `hostnameAliases`에서 파생된 정확한 origin 패턴 집합에 대해서만 요청됩니다.

### 호스트 권한 사용 근거

- 기본 호스트 권한은 ChatGPT, Gemini, Claude, Grok, Perplexity처럼 기본 지원하는 AI 웹사이트에서 입력창 탐지, 전송 버튼 탐지, 열린 탭 재사용, 자동 전송을 수행하기 위해 필요합니다.
- 선택 호스트 권한은 사용자가 직접 추가한 사용자 정의 AI 서비스에서 같은 자동화 기능과 셀렉터 테스트를 수행하기 위해서만 사용합니다.
- 필요한 origin 중 하나라도 거부되면 해당 사용자 정의 서비스는 부분 적용되지 않으며, 서비스를 삭제하거나 초기화하면 더 이상 쓰이지 않는 optional origin permission은 제거됩니다.
- 호스트 권한은 광고 추적, 임의 사이트 수집, 범용 웹 활동 모니터링 목적으로 사용하지 않습니다.

### 개인정보 관련 문구

AI Prompt Broadcaster는 사용자 프롬프트, 히스토리, 즐겨찾기, 템플릿 값을 개발자 서버로 전송하거나 수집하지 않습니다. 모든 데이터는 사용자의 로컬 브라우저 저장소에 보관되며, 사용자가 직접 선택한 AI 웹사이트로만 전달됩니다.

---

## English

### Short Description

Send one prompt to ChatGPT, Gemini, Claude, Grok, and Perplexity at the same time and start comparing results faster in Chrome.

### Detailed Description

AI Prompt Broadcaster is a Chrome extension that removes repetitive copy-and-paste by sending one prompt to multiple AI services at once.

Key features:

- Send the same prompt to ChatGPT, Gemini, Claude, Grok, and Perplexity
- Reuse matching AI tabs already open in the current Chrome window
- Pick a specific open tab or force a fresh tab per service from the popup
- Use selected text from any page through shortcuts or the context menu
- Prompt history, favorites, and template variables
- Local browser storage for user data
- Add, disable, and edit custom AI services

The extension works without a backend or API key and sends prompts directly to the AI websites selected by the user.

### Single Purpose Statement

This extension helps users open one or more AI web service tabs and automatically insert and send the text that the user typed or selected.

### Permission Justification

- `activeTab`: used to read selected text, run selector tests against the active page, and inspect the current tab context without persistent host access
- `tabs`: used to discover already-open AI tabs in the current window, open AI service pages, and track tab state during broadcasts
- `scripting`: used to inject scripts into supported AI tabs, locate editors and send buttons, and insert or send prompts
- `storage`: used to store the last prompt, local history, favorites, template values, custom service settings, and transient UI state
- `alarms`: used to clear temporary extension badge state after sends and reconcile unfinished broadcast state when the service worker restarts
- `contextMenus`: used to provide right-click send actions
- `notifications`: used to display send-complete and selector-change notifications
- `clipboardWrite`: used to copy prompts when automatic injection fails
- `clipboardRead` (optional): used only when the `{{clipboard}}` template variable is requested by the user
- `host_permissions`: used only on `chatgpt.com`, `gemini.google.com`, `claude.ai`, `grok.com`, `www.perplexity.ai`, and `perplexity.ai` so the extension can run content scripts, reuse open tabs, and automate prompt insertion and submission on those supported AI sites
- `optional_host_permissions`: declared broadly in the manifest so the extension can request the exact origin set derived from a user-added custom AI service's `url` and `hostnameAliases` at runtime; no extra host access is granted unless the user adds that service and approves the permission prompt

### Host Permission Rationale

- Built-in host permissions are limited to the supported AI websites because the extension must detect editors, detect send buttons, reuse matching tabs, and automate prompt submission on those pages.
- Optional host permissions are used only when the user adds a custom AI service and wants the same selector testing, open-tab reuse, and prompt injection behavior on that user-specified domain or alias set.
- If any required origin is denied, the custom service is not partially enabled, and unused optional origins are removed when the user deletes or resets that custom service data.
- Host access is not used for advertising, generic browsing surveillance, or data collection across unrelated sites.

### Privacy Statement

AI Prompt Broadcaster does not collect, transmit, or sell user prompts, history, favorites, or template values to developer-controlled servers. All data stays in the user's local browser storage and is only sent directly to AI websites explicitly selected by the user.
