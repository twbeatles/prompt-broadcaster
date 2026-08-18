# Feature Specification: 멀티 AI 프롬프트 동시 전송 · 셀렉터 안정화

**Feature Branch**: `001-prompt-broadcast-v1-1`

**Created**: 2026-07-24

**Status**: Draft

**Input**: User description: "v1.1.0(백그라운드 모듈 분할, 셀렉터 갱신, 셀렉터 변경 알림 소음 감소)을 기준으로, 한 프롬프트를 여러 AI 채팅 서비스에 동시에 보내는 확장 기능을 명세한다."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 한 프롬프트를 여러 AI에 보내기 (Priority: P1)

팝업에서 프롬프트를 입력해 선택한 AI 서비스 탭에 동시에 주입한다. API 키 없이 로그인된 탭 DOM을 사용한다.

**Why this priority**: 제품의 핵심 가치다.

**Independent Test**: 로그인된 대상 탭에서 브로드캐스트 후 입력 반영을 확인한다.

**Acceptance Scenarios**:

1. **Given** 대상 탭이 준비되면, **When** 전송하면, **Then** 각 입력 영역에 동일 프롬프트가 들어간다.
2. **Given** 일부 탭이 없으면, **When** 전송하면, **Then** 가능 대상만 처리하고 실패가 안내된다.

---

### User Story 2 - 단축키·즐겨찾기·히스토리 (Priority: P2)

단축키, 즐겨찾기(체인 포함), 최근 이력을 제공한다.

**Why this priority**: 반복 사용 효율을 좌우한다.

**Independent Test**: 단축키·즐겨찾기 저장/실행을 확인한다.

**Acceptance Scenarios**:

1. **Given** 즐겨찾기를 저장하면, **When** 다시 실행하면, **Then** 동일 프롬프트가 재사용된다.
2. **Given** 단축키를 누르면, **When** 허용된 포커스이면, **Then** 전송/보조 동작이 실행된다.

---

### User Story 3 - 셀렉터 갱신과 조용한 알림 (Priority: P1)

사이트 셀렉터를 최신화하고 변경 알림 소음을 줄인다.

**Why this priority**: 사이트 UI 변경 시 전송 실패와 알림 피로가 동시에 발생한다.

**Independent Test**: 셀렉터 불일치 시 실패 안내와 알림 빈도를 확인한다.

**Acceptance Scenarios**:

1. **Given** 셀렉터가 유효하면, **When** 주입하면, **Then** 성공한다.
2. **Given** 셀렉터가 깨지면, **When** 전송하면, **Then** 실패가 명확히 보이되 불필요 반복 팝업은 최소화된다.

---

### User Story 4 - 응답 비교·로컬 캡처 (Priority: P3)

여러 서비스 응답을 비교·캡처하는 보조 흐름을 제공한다.

**Why this priority**: 브로드캐스트 다음 단계 가치다.

**Independent Test**: 비교/캡처 옵션을 확인한다.

**Acceptance Scenarios**:

1. **Given** 여러 응답이 있으면, **When** 비교 뷰를 열면, **Then** 나란히 검토할 수 있다.

### Edge Cases

- 입력이 비어 있거나 부분만 채워진 경우 안전한 안내와 함께 진행/중단을 명확히 한다.
- 장시간 작업·네트워크 실패 시 전체가 조용히 실패하지 않고 상태를 남긴다.
- 동시 실행/중복 클릭 시 중복 부작용을 최소화한다.
- 권한·준비 상태 미충족 시 파괴적 쓰기 없이 차단한다.


## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 단일 프롬프트를 다중 AI 서비스 탭에 전송해야 한다.
- **FR-002**: API 키 없이 사용자 로그인 탭 DOM 주입 방식을 사용해야 한다.
- **FR-003**: 대상 선택과 부분 실패 보고를 제공해야 한다.
- **FR-004**: 즐겨찾기·이력·단축키를 제공해야 한다.
- **FR-005**: 사이트별 입력 셀렉터를 유지·갱신 가능해야 한다.
- **FR-006**: 셀렉터 변경 알림은 실행에 필요한 수준으로 제한해야 한다.
- **FR-007**: 옵션/팝업에서 서비스 on/off와 실험 기능을 관리해야 한다.

### Key Entities

- **프롬프트**: 전송 텍스트
- **대상 서비스**: 사이트·탭·셀렉터 매핑
- **즐겨찾기/체인**: 재사용·다단계 정의
- **전송 결과**: 서비스별 성공/실패

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 준비된 대상에 대해 1회 조작으로 전송 시도 완료
- **SC-002**: 실패 대상 누락 없이 표시
- **SC-003**: 동일 셀렉터 이슈 알림 과도 반복 없음
- **SC-004**: 즐겨찾기 재실행 시 동일 텍스트 복원

## Assumptions

- 각 AI 사이트 UI는 수시 변경되며 셀렉터 유지보수가 필요하다.
- Chrome MV3 확장을 전제로 한다.
- Brownfield 기준 커밋: `d98aaf5` (이미 상당 부분 구현; 명세는 제품 의도 고정용).
