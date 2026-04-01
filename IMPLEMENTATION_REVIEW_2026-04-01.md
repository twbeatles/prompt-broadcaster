# 기능 구현 점검 및 반영 메모 (2026-04-01)

## 상태 요약
- 기준 문서: `README.md`, `CLAUDE.md`
- 주요 확인 대상: `src/background`, `src/popup`, `src/content/injector`, `src/shared/sites`, `src/shared/prompts`, `src/options`
- 구현 상태: 본 문서에서 제안한 5개 개선 항목 모두 반영 완료
- 최종 검증:
  - `npm run typecheck` 통과
  - `npm run build` 통과
  - `npm run qa:smoke` 통과 (14/14)

## 반영 완료 항목

### 1. 커스텀 서비스 권한 모델 정리
- `RuntimeSite.permissionPattern` 단일 값 구조를 `permissionPatterns: string[]`로 전환했습니다.
- 커스텀 서비스는 `url + hostnameAliases`에서 필요한 전체 origin 패턴을 계산합니다.
- 저장, 수정, JSON import 모두 필요한 origin 전체를 확인하며 하나라도 거부되면 해당 서비스는 부분 적용되지 않습니다.
- 커스텀 서비스 삭제, 서비스 설정 리셋, JSON import 교체 시 더 이상 참조되지 않는 optional host permission만 자동 회수합니다.
- 포트가 포함된 origin도 올바르게 보존되도록 origin host 정규화를 함께 보정했습니다.

### 2. built-in override import 검증 강화
- built-in override import는 원본 built-in 설정과 import 값을 합친 뒤 검증합니다.
- `submitMethod: "click"`인데 `submitSelector`가 비어 있으면 조용히 `Enter` 폴백으로 바꾸지 않고, 원본 built-in `submitSelector`를 유지합니다.
- import summary의 `adjustedIds`에는 이런 보정 케이스도 포함됩니다.

### 3. `{{counter}}` 수명주기 정리
- 팝업 미리보기는 계속 `current + 1`을 사용합니다.
- 실제 저장되는 `broadcastCounter`는 background에서 `queuedSiteCount > 0`인 방송만 증가시킵니다.
- `broadcastCounter`는 export/import/reset 대상에 포함되며, legacy import에 값이 없으면 `0`으로 정규화합니다.
- Reset data는 `broadcastCounter`까지 함께 초기화합니다.

### 4. 즐겨찾기 검색 확장
- 즐겨찾기 검색은 이제 `title`, `text`, `tags`, `folder`를 함께 검색합니다.
- `#tag` 형태 검색도 지원합니다.
- 기존 태그/폴더 칩 필터와 pinned 정렬은 유지됩니다.

### 5. QA 보강
- Chrome mock에 `permissions.remove`, granted origin 추적, local storage remove를 추가했습니다.
- smoke QA에 아래 시나리오를 추가했습니다.
  - alias hostname이 있는 custom site import 권한 처리
  - custom site 삭제 시 unused origin만 회수
  - reset 시 custom-service optional permission 정리
  - built-in override import의 `click + empty submitSelector` 보정
  - `broadcastCounter` export/import/reset 일관성
  - 즐겨찾기 제목/태그/폴더 검색

## 현재 기준 참고 포인트
- 이 문서는 초기 리뷰에서 발견된 문제를 추적한 메모이며, 위 항목들은 모두 현재 코드에 반영된 상태입니다.
- 상세 동작 설명은 `README.md`, `CLAUDE.md`, `docs/extension-architecture.md`, `docs/build-guide.md`를 최신 기준으로 동기화했습니다.

## 참고한 주요 파일
- [`CLAUDE.md`](./CLAUDE.md)
- [`README.md`](./README.md)
- [`src/popup/app/bootstrap.ts`](./src/popup/app/bootstrap.ts)
- [`src/background/app/bootstrap.ts`](./src/background/app/bootstrap.ts)
- [`src/shared/sites/normalizers.ts`](./src/shared/sites/normalizers.ts)
- [`src/shared/sites/import-repair.ts`](./src/shared/sites/import-repair.ts)
- [`src/shared/sites/runtime-sites.ts`](./src/shared/sites/runtime-sites.ts)
- [`src/shared/prompts/import-export.ts`](./src/shared/prompts/import-export.ts)
- [`src/shared/prompts/broadcast-counter.ts`](./src/shared/prompts/broadcast-counter.ts)
- [`src/shared/prompts/search.ts`](./src/shared/prompts/search.ts)
- [`scripts/qa-smoke.mjs`](./scripts/qa-smoke.mjs)
