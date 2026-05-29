# [2026-05-29] Phase 3.5 — Design System Renewal 완료

- **Date:** 2026-05-29
- **Branch:** feat/phase-3-5-design-system
- **Tag:** v0.3.5-design-system

## Implemented (Plan 3.5)

- 디자인 토큰 시스템: `globals.css` 전면 교체 (코랄 #E8763D + 크림 #FFF8EE / 따뜻한 갈색 다크)
- Pretendard Variable CDN (Geist 완전 제거)
- next-themes 마운트 + ThemeToggle (라이트/다크/시스템 순환)
- shadcn alias 매핑 — 기존 컴포넌트 .tsx 수정 없이 자동 적용
- 새 컴포넌트: ProgressRing, DayChip, BodyPartChip, SetRow, ThemeToggle
- 새 유틸: prefersReducedMotion, celebrate (canvas-confetti)
- 새 RSC 쿼리: fetchTodaySession, fetchWeeklySessionDates, fetchRecentExerciseHistory, fetchLastMainSetsByExercise (prefill)
- 화면 리뉴얼: /login, /dashboard, /workout/new, /workout/[sessionId], loading/error/not-found
- 신규 기능: 운동 진행 중 운동 삭제 (swipe-to-delete + ✕ 백업 + 확인 다이얼로그, CASCADE delete)
- 신규 기능: 지난번 기록 자동 채움 (prefill)
- WCAG AA 준수: 코랄 위 텍스트 다크 브라운 (4.5:1+)
- prefers-reduced-motion 처리 (confetti / animation 스킵)
- 운동 종료 시 confetti (1회만)

## Tests

- tests/lib/motion.test.ts — 3 unit tests
- tests/components/progress-ring.test.tsx — 5 unit tests
- 기존 tests/rls/isolation.test.ts (3) + tests/workout/recommendation.test.ts (6) 회귀 통과
- **총 17 passed** (4 test files)

## Build

- `pnpm build` — 0 errors, 모든 라우트 출력 (/login, /dashboard, /workout/new, /workout/[sessionId])
- `pnpm tsc --noEmit` — 0 errors
- `pnpm lint` — 0 errors

## Notes

- ThemeToggle 마운트 가드는 `useSyncExternalStore` 사용 (effect setState 린트 규칙 회피, hydration 안전).
- base-ui Dialog API는 `render=` prop 사용 (Radix `asChild` 아님) — SessionRunner 삭제 확인 다이얼로그에 반영.
- 수동 E2E (iPhone 시뮬레이션 라이트/다크/reduced-motion)는 dev 환경에서 별도 수행 권장.
