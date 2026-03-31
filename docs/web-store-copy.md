# Chrome Web Store Copy Pack

Last updated: 2026-03-31

## Korean

### 132자 이내 요약

하나의 프롬프트를 ChatGPT, Gemini, Claude, Grok에 동시에 전송하고 결과 비교를 더 빠르게 시작할 수 있는 Chrome 확장 프로그램입니다.

### 상세 설명

AI Prompt Broadcaster는 반복 복붙 없이 하나의 프롬프트를 여러 AI 서비스에 동시에 전송할 수 있는 Chrome 확장 프로그램입니다.

주요 기능:

- ChatGPT, Gemini, Claude, Grok 동시 전송
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

- `activeTab`: 현재 탭의 선택 텍스트 읽기 및 셀렉터 테스트에 사용합니다.
- `tabs`: 대상 AI 서비스 페이지를 새 탭으로 열고 상태를 추적하는 데 사용합니다.
- `scripting`: 대상 페이지에서 입력 요소를 찾고 프롬프트를 주입하는 데 사용합니다.
- `storage`: 히스토리, 즐겨찾기, 템플릿 값, 사용자 설정을 로컬에 저장하는 데 사용합니다.
- `contextMenus`: 우클릭 메뉴에서 바로 AI Broadcaster로 전송 기능을 제공하는 데 사용합니다.
- `notifications`: 전송 완료 및 셀렉터 변경 감지 알림을 표시하는 데 사용합니다.
- `clipboardWrite`: 자동 주입 실패 시 프롬프트 복사를 돕는 데 사용합니다.
- `clipboardRead`(선택 권한): `{{클립보드}}` 템플릿 변수 사용 시에만 클립보드 내용을 읽습니다.

### 개인정보 관련 문구

AI Prompt Broadcaster는 사용자 프롬프트, 히스토리, 즐겨찾기, 템플릿 값을 개발자 서버로 전송하거나 수집하지 않습니다. 모든 데이터는 사용자의 로컬 브라우저 저장소에 보관되며, 사용자가 직접 선택한 AI 웹사이트로만 전달됩니다.

---

## English

### Short Description

Send one prompt to ChatGPT, Gemini, Claude, and Grok at the same time and start comparing results faster in Chrome.

### Detailed Description

AI Prompt Broadcaster is a Chrome extension that removes repetitive copy-and-paste by sending one prompt to multiple AI services at once.

Key features:

- Send the same prompt to ChatGPT, Gemini, Claude, and Grok
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

- `activeTab`: used to read selected text and run selector tests on the current tab
- `tabs`: used to discover open AI tabs, open AI service pages, and track tab state
- `scripting`: used to find input elements and inject prompts on the destination page
- `storage`: used to store local history, favorites, template values, and settings
- `contextMenus`: used to provide right-click send actions
- `notifications`: used to display send-complete and selector-change notifications
- `clipboardWrite`: used to copy prompts when automatic injection fails
- `clipboardRead` (optional): used only when the `{{clipboard}}` template variable is requested by the user

### Privacy Statement

AI Prompt Broadcaster does not collect, transmit, or sell user prompts, history, favorites, or template values to developer-controlled servers. All data stays in the user's local browser storage and is only sent directly to AI websites explicitly selected by the user.
