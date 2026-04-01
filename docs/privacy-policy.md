# AI Prompt Broadcaster Privacy Policy

Last updated: 2026-03-31

## Korean

### 개인정보처리방침

AI Prompt Broadcaster(이하 "확장 프로그램")는 사용자가 입력하거나 선택한 텍스트를 여러 AI 웹 서비스 탭에 입력하고 전송할 수 있도록 돕는 Chrome 확장 프로그램입니다.

이 문서는 확장 프로그램이 어떤 데이터를 처리하는지, 그 데이터를 어떻게 사용하고 공유하는지 설명합니다.

### 1. 개발자 서버 수집 여부

- 확장 프로그램은 개발자 소유 서버를 운영하지 않습니다.
- 확장 프로그램은 사용자의 프롬프트, 히스토리, 즐겨찾기, 템플릿 변수 값, 선택 텍스트를 개발자 서버로 업로드하거나 저장하지 않습니다.
- 확장 프로그램은 사용자 데이터를 판매하거나 광고 목적의 프로파일링에 사용하지 않습니다.

### 2. 확장 프로그램이 처리하는 데이터

확장 프로그램은 아래 데이터를 기능 수행 범위 안에서 처리할 수 있습니다.

#### 사용자가 직접 제공한 데이터

- 사용자가 팝업에 입력한 프롬프트
- 사용자가 웹페이지에서 선택한 텍스트
- 사용자가 저장한 즐겨찾기 제목과 프롬프트
- 사용자가 입력한 템플릿 변수 값
- 사용자가 추가한 사용자 정의 AI 서비스 설정

#### 로컬 기능 데이터

- 최근 프롬프트
- 프롬프트 히스토리
- 즐겨찾기 프롬프트
- 템플릿 변수 캐시
- 앱 설정값
- 셀렉터 오류 기록 및 최근 브로드캐스트 상태

#### 탭 및 서비스 메타데이터

- 현재 Chrome 창에서 열려 있는 AI 탭의 URL, hostname, 제목, 활성 상태
- 사용자가 선택한 대상 서비스 목록
- 사용자 정의 서비스 URL 및 hostname alias 설정

위 정보는 열린 탭 재사용, 서비스 매칭, 전송 상태 표시, 문제 진단을 위해 사용됩니다.

#### 선택적 데이터

- 클립보드 내용

클립보드 내용은 사용자가 `{{클립보드}}` 템플릿 변수를 사용하는 경우에만 읽으며, 이 경우에만 선택 권한 `clipboardRead`를 요청합니다.

### 3. 데이터 사용 목적

확장 프로그램은 처리한 데이터를 아래 목적에만 사용합니다.

- 사용자가 선택한 AI 웹 서비스 탭에 프롬프트를 입력하고 전송하기 위해
- 현재 창에서 이미 열려 있는 AI 탭을 식별하고 재사용하기 위해
- 히스토리, 즐겨찾기, 템플릿 변수, 설정을 로컬에 저장하기 위해
- 주입 실패, 셀렉터 변경, 전송 완료 상태를 사용자에게 알리기 위해
- 사용자 정의 서비스 설정과 셀렉터 테스트 기능을 제공하기 위해

### 4. 데이터 저장 위치

다음 데이터는 사용자의 브라우저 내부 저장소에만 저장될 수 있습니다.

- `chrome.storage.local`
  - 최근 프롬프트
  - 히스토리
  - 즐겨찾기
  - 템플릿 변수 캐시
  - 사용자 정의 서비스 설정
  - 앱 설정
  - 셀렉터 실패 기록
- `chrome.storage.session`
  - 최근 브로드캐스트 상태
  - 일시적인 UI 토스트 상태

이 데이터는 확장 프로그램 기능 제공을 위해 사용자 기기 안에만 저장되며, 확장 프로그램이 개발자 서버로 별도 전송하지 않습니다.

### 5. 데이터 공유 방식

확장 프로그램은 사용자가 직접 선택한 외부 AI 서비스와만 데이터를 공유할 수 있습니다.

공유가 발생하는 경우:

- 사용자가 전송 버튼을 눌렀을 때, 프롬프트와 템플릿 값이 선택한 AI 웹사이트의 입력창에 직접 입력되어 해당 서비스로 전달될 수 있습니다.
- 사용자가 사용자 정의 서비스를 추가한 경우, 사용자가 직접 지정한 도메인에도 같은 방식으로 프롬프트가 전달될 수 있습니다.

확장 프로그램은 아래 주체와는 데이터를 공유하지 않습니다.

- 개발자 소유 서버
- 광고 네트워크
- 데이터 브로커
- 분석용 제3자 SDK

외부 AI 서비스로 전달된 데이터는 각 서비스의 약관 및 개인정보처리방침에 따릅니다.

### 6. 권한 사용 목적

- `activeTab`
  - 현재 활성 탭의 선택 텍스트 읽기 및 셀렉터 테스트
- `tabs`
  - 대상 AI 서비스 탭 열기, 현재 창의 열린 AI 탭 탐지, 탭 상태 추적
- `scripting`
  - 대상 탭에 injector 및 selection script 주입
- `storage`
  - 히스토리, 즐겨찾기, 템플릿 값, 설정, 런타임 상태 저장
- `alarms`
  - 전송 후 배지 상태 자동 정리 및 서비스 워커 재시작 시 미완료 브로드캐스트 상태 재정리
- `contextMenus`
  - 선택 텍스트 우클릭 메뉴 제공
- `notifications`
  - 전송 완료 및 셀렉터 변경 감지 알림 표시
- `clipboardWrite`
  - 자동 주입 실패 시 프롬프트 복사 지원
- `clipboardRead`(선택 권한)
  - `{{클립보드}}` 템플릿 변수 사용 시에만 현재 클립보드 읽기
- 선택 호스트 권한(`https://*/*`, `http://*/*`)
  - 매니페스트에는 런타임 요청을 위해 넓게 선언되어 있지만, 실제로는 사용자가 새 사용자 정의 AI 서비스를 추가할 때 해당 서비스의 정확한 origin에 대해서만 요청

### 7. 보안

- 확장 프로그램은 원격 스크립트를 로드하지 않도록 Chrome Extension Content Security Policy를 사용합니다.
- 확장 프로그램 자체는 사용자 데이터를 개발자 서버에 전송하지 않습니다.
- 사용자가 실제로 전송을 수행할 때의 통신은 사용자가 연 외부 AI 웹사이트와의 HTTPS 연결에 따릅니다.

### 8. 데이터 삭제 및 제어

사용자는 아래 방법으로 데이터를 제어할 수 있습니다.

- 팝업 또는 옵션 페이지에서 히스토리, 즐겨찾기, 설정 데이터를 삭제
- JSON 내보내기/가져오기 기능 사용
- 사용자 정의 서비스 추가/수정/삭제
- 확장 프로그램 제거

브라우저 및 Chrome 정책에 따라 확장 프로그램 제거 시 로컬 저장 데이터가 함께 제거될 수 있습니다.

### 9. 아동의 개인정보

확장 프로그램은 아동을 대상으로 설계되지 않았으며, 개발자가 아동의 개인정보를 별도로 수집하지 않습니다.

### 10. 정책 변경

이 개인정보처리방침은 제품 변경, 정책 변경, Chrome Web Store 요구사항 변경에 따라 업데이트될 수 있습니다. 최신 버전은 배포 페이지 또는 저장소에 게시된 문서를 기준으로 합니다.

### 11. 문의

개인정보처리방침 또는 데이터 처리 방식에 관한 문의는 프로젝트 저장소 또는 배포 페이지에 기재된 연락 수단을 통해 할 수 있습니다.

---

## English

### Privacy Policy

AI Prompt Broadcaster ("the extension") is a Chrome extension that helps users insert and send text that they typed or selected to one or more AI web service tabs.

This Privacy Policy explains what data the extension handles, how that data is used, and with whom that data may be shared.

### 1. No Developer-Controlled Backend Collection

- The extension does not operate a developer-controlled backend for user data.
- The extension does not upload or store prompts, histories, favorites, template values, or selected text on any developer server.
- The extension does not sell user data or use it for advertising profiles.

### 2. Data the Extension May Handle

The extension may handle the following categories of data only as needed for its user-facing features.

#### User-provided data

- prompts typed into the popup
- text selected by the user on web pages
- favorite titles and saved prompts
- template variable values entered by the user
- custom AI service settings entered by the user

#### Local feature data

- last prompt
- prompt history
- favorite prompts
- template variable cache
- app settings
- selector failure records and recent broadcast status

#### Tab and service metadata

- URL, hostname, title, and active state of AI tabs open in the current Chrome window
- selected destination services
- custom service URLs and hostname alias settings

This metadata is used for open-tab reuse, service matching, status display, and diagnostics.

#### Optional data

- clipboard contents

Clipboard data is read only when the user chooses to use the `{{clipboard}}` template variable, and only then does the extension request the optional `clipboardRead` permission.

### 3. How the Data Is Used

The extension uses handled data only to:

- insert and send prompts to AI services selected by the user
- discover and reuse already-open AI tabs in the current window
- store local history, favorites, template values, and settings
- display send-complete, selector-failure, and diagnostics feedback
- support custom service configuration and selector testing

### 4. Where Data Is Stored

The following data may be stored only in the user's browser:

- `chrome.storage.local`
  - last prompt
  - history
  - favorites
  - template variable cache
  - custom service settings
  - app settings
  - selector failure records
- `chrome.storage.session`
  - recent broadcast state
  - transient UI toast state

This data remains in the user's browser environment and is not transmitted by the extension to a developer-controlled server.

### 5. Data Sharing

The extension may share data only with external AI services explicitly chosen by the user.

Sharing can occur when:

- the user clicks send and the prompt or template values are inserted into and transmitted through the selected AI website
- the user adds a custom service and chooses to send prompts to that user-configured domain

The extension does not share data with:

- developer-controlled servers
- advertising networks
- data brokers
- third-party analytics SDKs

Any data transmitted to external AI services is governed by those services' own privacy policies and terms.

### 6. Permission Usage

- `activeTab`
  - read selected text and run selector tests on the current active tab
- `tabs`
  - open AI service tabs, discover open AI tabs in the current window, and track tab state
- `scripting`
  - inject selection and prompt scripts into destination tabs
- `storage`
  - store history, favorites, template values, settings, and runtime state
- `alarms`
  - clear temporary badge state after sends and reconcile unfinished broadcasts when the service worker restarts
- `contextMenus`
  - provide right-click actions for selected text
- `notifications`
  - display completion and selector-change notifications
- `clipboardWrite`
  - copy prompts when automatic injection fails
- `clipboardRead` (optional)
  - read clipboard contents only when the user invokes the `{{clipboard}}` template variable
- optional host permissions (`https://*/*`, `http://*/*`)
  - declared broadly so runtime origin requests are possible, but actually requested only for the exact origin set derived from a custom AI service's `url` and `hostnameAliases`

### 7. Security

- The extension uses a Chrome Extension Content Security Policy that does not allow remote script execution.
- The extension itself does not transmit user data to a developer server.
- When the user sends a prompt, the network communication is between the user's browser and the selected external AI website, typically over HTTPS.

### 8. Data Deletion and User Control

Users can control their data by:

- clearing history, favorites, and settings from the popup or options page
- exporting and importing local data as JSON
- adding, editing, or deleting custom services
- resetting service data, which also removes unused optional host permissions for deleted custom-service origins
- removing the extension

According to browser behavior and Chrome policy, uninstalling the extension may also remove local extension storage data.

### 9. Children's Privacy

The extension is not designed for children, and the developer does not knowingly collect children's personal information.

### 10. Changes to This Policy

This Privacy Policy may be updated to reflect product changes, policy changes, or Chrome Web Store requirements. The latest version is the version published on the distribution page or repository.

### 11. Contact

Questions about this Privacy Policy or the extension's data handling can be sent through the contact method listed in the project repository or distribution page.
