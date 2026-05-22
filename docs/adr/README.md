# Architecture Decision Records

이 폴더는 헬스 루틴 관리 앱의 **주요 설계 결정**을 기록합니다.

## Index

| # | Title | Status | Date |
|---|-------|--------|------|
| [001](./001-body-part-modeling.md) | 운동 부위(Body Part) 모델링 방식 | Accepted | 2026-05-22 |
| [002](./002-drop-set-modeling.md) | 드롭세트 모델링 방식 | Accepted | 2026-05-22 |
| [003](./003-side-asymmetry-modeling.md) | 좌우 비대칭(side) 처리 방식 | Accepted | 2026-05-22 |
| [004](./004-kakaotalk-import-strategy.md) | 카톡 데이터 임포트 전략 | Accepted | 2026-05-22 |
| [005](./005-authentication.md) | 인증 방식 (OAuth providers) | Accepted | 2026-05-22 |
| [006](./006-pwa-offline-scope.md) | PWA offline 지원 범위 | Accepted | 2026-05-22 |
| [007](./007-frontend-state-management.md) | 프론트엔드 상태 관리 전략 | Accepted | 2026-05-22 |
| [008](./008-per-user-exercise-catalog.md) | 운동 카탈로그 소유권 모델 (Per-user) | Accepted | 2026-05-22 |

## 작성 규칙

- 파일명: `NNN-kebab-case-title.md`
- 섹션: Status / Context / Considered Options / Decision / Consequences / Implementation Notes
- 결정 전: `Proposed`, 승인 후: `Accepted`, 변경 시: `Superseded by ADR-XXX`
