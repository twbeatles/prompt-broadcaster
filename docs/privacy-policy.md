# AI Prompt Broadcaster Privacy Policy

Last updated: 2026-03-30

## Korean

### 개인정보처리방침

AI Prompt Broadcaster(이하 "확장 프로그램")는 사용자의 프롬프트를 여러 AI 웹 서비스에 동시에 전달할 수 있도록 돕는 Chrome 확장 프로그램입니다.

### 수집하는 정보

- 확장 프로그램 자체는 사용자의 이름, 이메일, 전화번호, 위치 정보, 결제 정보와 같은 개인정보를 수집하지 않습니다.
- 확장 프로그램 자체는 사용자가 입력한 프롬프트, 히스토리, 즐겨찾기, 템플릿 변수 값을 별도의 외부 서버로 전송하거나 저장하지 않습니다.

### 저장되는 정보

다음 정보는 사용자 브라우저 내부의 `chrome.storage.local`에만 저장될 수 있습니다.

- 최근 프롬프트
- 프롬프트 히스토리
- 즐겨찾기 프롬프트
- 템플릿 변수 캐시
- 사용자 정의 서비스 설정
- 확장 프로그램 설정값

이 정보는 사용자의 로컬 브라우저 환경에만 저장되며, 개발자 서버 또는 제3자 서버로 전송되지 않습니다.

### 외부 서비스와의 상호작용

확장 프로그램은 사용자가 직접 선택한 AI 서비스 웹사이트(예: ChatGPT, Gemini, Claude, Grok 또는 사용자가 추가한 사용자 정의 서비스)에 프롬프트를 자동 입력하기 위해 브라우저 탭과 콘텐츠 스크립트를 사용합니다.

사용자가 선택한 프롬프트 내용은 해당 웹사이트의 정상적인 이용 과정의 일부로 그 서비스 제공자에게 전달될 수 있습니다. 이 전달은 확장 프로그램 운영 서버를 거치지 않습니다.

### 권한 사용 목적

- `tabs`: AI 서비스 탭 생성 및 상태 추적
- `scripting`: 대상 페이지에 프롬프트 주입 및 셀렉터 테스트
- `storage`: 히스토리, 즐겨찾기, 설정 저장
- `contextMenus`: 우클릭 메뉴 제공
- `notifications`: 전송 완료 및 셀렉터 변경 알림 표시
- `clipboardWrite`: 자동 주입 실패 시 프롬프트 복사 지원
- `clipboardRead`(선택 권한): `{{클립보드}}` 템플릿 변수 사용 시 현재 클립보드 읽기
- `activeTab`: 현재 활성 탭에서 선택 텍스트 읽기 및 셀렉터 테스트

### 정보 공유

- 확장 프로그램 개발자는 사용자 데이터를 수집, 판매, 임대하거나 제3자와 공유하지 않습니다.
- 단, 사용자가 직접 선택한 외부 AI 서비스와의 통신은 각 서비스의 약관 및 개인정보처리방침을 따릅니다.

### 데이터 삭제

사용자는 확장 프로그램의 설정 화면에서 히스토리/즐겨찾기/설정 데이터를 삭제하거나 JSON으로 내보내고 다시 가져올 수 있습니다. 확장 프로그램을 삭제하면 로컬 저장 데이터도 브라우저 정책에 따라 제거될 수 있습니다.

### 문의

프로젝트 저장소 또는 배포 페이지에 기재된 연락 수단을 통해 문의할 수 있습니다.

---

## English

### Privacy Policy

AI Prompt Broadcaster ("the extension") is a Chrome extension that helps users send one prompt to multiple AI web services at the same time.

### Information We Collect

- The extension does not collect personal information such as name, email address, phone number, location, or payment information.
- The extension does not send or store prompts, histories, favorites, or template values on any external server operated by the developer.

### Information Stored Locally

The following data may be stored only in the user's local browser storage (`chrome.storage.local`):

- last prompt
- prompt history
- favorite prompts
- template variable cache
- custom service settings
- extension settings

This data stays inside the user's browser environment and is not transmitted to the developer or third-party servers by the extension itself.

### Interaction With External Services

The extension uses browser tabs and content scripts to fill prompts into AI websites selected by the user, such as ChatGPT, Gemini, Claude, Grok, or user-added custom services.

When a user chooses to send a prompt, that prompt may be transmitted directly to the selected AI service as part of normal website usage. The extension does not proxy this traffic through any developer-controlled backend.

### Permission Usage

- `tabs`: create and monitor AI service tabs
- `scripting`: inject prompts and run selector tests
- `storage`: store history, favorites, and settings
- `contextMenus`: provide right-click actions
- `notifications`: display completion and selector-change notifications
- `clipboardWrite`: copy prompt text when automatic injection fails
- `clipboardRead` (optional): read clipboard contents only when the `{{clipboard}}` template variable is used
- `activeTab`: read selected text and test selectors on the current active tab

### Data Sharing

- The developer does not collect, sell, rent, or share user data with third parties.
- Communications with AI services chosen by the user are governed by those services' own privacy policies and terms.

### Data Deletion

Users can clear history, favorites, and settings from the extension UI, or export/import their local data as JSON. Removing the extension may also remove local storage data according to browser behavior.

### Contact

Questions can be sent through the contact method listed in the project repository or distribution page.
