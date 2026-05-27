# Phase 3.1 — Workout Runner Basic 완료

- **Date:** 2026-05-27
- **Branch:** feat/phase-3-1-workout-runner-basic
- **Tag:** v0.3.1-workout-runner-basic

## Implemented

- /workout/new — 부위 chip 토글 + 저장된 분할 chip + 추천 알고리즘 미리보기
- 추천 알고리즘: spec §7 (빈도 desc → 마지막 사용일 asc → created_at), `fetchRecentSets(uid, 30)` 실데이터 기반
- routine_templates 저장 + 부위 매핑 (M:N) + 명시적 user_id
- /workout/[sessionId] — 운동 카드 + 빈 세트 input + ✓ 체크
- Optimistic mutation (insertSet) — onMutate 즉시 UI, onError 롤백, per-set pending 추적
- NaN guard (Number.isFinite + 음수/0회 차단)
- finishSession — ended_at 업데이트 + /dashboard 리턴
- Server Action 반환 컨벤션: `{ ok: false, error }` | redirect (try/catch 불필요)
- workout 라우트 loading.tsx / error.tsx / not-found.tsx scaffold
- `?exercises=` 비거나 변조 시 `notFound()` 가드

## Out of Scope (Plan 3.2)

- 드롭세트 UI (+ 드롭 버튼)
- 좌/우 분리 입력 (side toggle)
- 휴식 타이머
- 지난번 기록을 default로 채우기
- 빈 세션 포기 / 임시 저장 / "운동 종료" 확인 다이얼로그
- 추천 결과 재정렬 / 수동 추가
- TanStack Query 캐시로 savedSets 통합 (현재 useState)

## Tests

- tests/workout/recommendation.test.ts — 5 unit tests PASS
- tests/rls/isolation.test.ts — 3 cross-user isolation tests PASS
- 총 9 tests / 2 files (회귀 무사)

## Build

- `pnpm build` ✓ (Next.js 16.2.6 Turbopack)
- 신규 라우트: `/workout/new`, `/workout/[sessionId]` 둘 다 dynamic (`ƒ`) 으로 출력 확인

## Manual E2E (예정 — 사용자 헬스장 1주일 실사용으로 대체)

PR 머지 후 헬스장에서 직접 사용. 다음 시나리오 검증:

- iPhone 14 Pro 시뮬레이션으로 새 세션 1회 (운동 시작 → 세트 2개 저장 → 종료) 검증
- Slow 3G throttling에서 optimistic UI < 100ms 반영 확인
- NaN/음수 입력 시 에러 토스트 + INSERT 차단 확인
- `/workout/<random-uuid>` 직접 접근 시 not-found 페이지
