# 오운완 (Ounwan)

> 개인용 헬스 루틴 관리 모바일 웹앱 — PT에서 받은 루틴 + 1년치 카톡 셀프챗 운동 기록을 시드로, 부위 조합만 누르면 운동/세트/무게가 자동 추천되는 PWA.
>
> *"오운완" = "오늘 운동 완료"의 줄임말*

**Status:** 🏗 Design Phase (구현 시작 전)

## Why

- 루틴 만들기 귀찮 → 부위 조합 선택만 하면 자동 추천
- 카톡에 흩어진 1년치 운동 기록 마이그레이션 → 일관된 추이 차트
- 헬스장에서 모바일로 빠른 기록 + 집에서 데스크탑으로 진척 확인

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router) + TypeScript |
| Backend | Supabase (Postgres + Auth + Storage) |
| State | TanStack Query v5 + RSC 하이브리드 |
| UI | Tailwind CSS + shadcn/ui + Recharts |
| PWA | @serwist/next |
| Hosting | Vercel |
| Testing | Vitest + Playwright |

운영 비용: **0원/월** (모든 서비스 무료 티어)

## Documents

### Design Spec
- [Design v2.1 (2026-05-22)](./docs/specs/2026-05-22-gym-routine-app-design.md) — 종합 설계 문서

### Architecture Decision Records (ADR)

| # | Title | Status |
|---|-------|--------|
| [001](./docs/adr/001-body-part-modeling.md) | 운동 부위(Body Part) 모델링 방식 | Accepted |
| [002](./docs/adr/002-drop-set-modeling.md) | 드롭세트 모델링 방식 | Accepted |
| [003](./docs/adr/003-side-asymmetry-modeling.md) | 좌우 비대칭(side) 처리 방식 | Accepted |
| [004](./docs/adr/004-kakaotalk-import-strategy.md) | 카톡 데이터 임포트 전략 | Accepted |
| [005](./docs/adr/005-authentication.md) | 인증 방식 (Google OAuth) | Accepted |
| [006](./docs/adr/006-pwa-offline-scope.md) | PWA offline 지원 범위 | Accepted |
| [007](./docs/adr/007-frontend-state-management.md) | 프론트엔드 상태 관리 전략 | Accepted |
| [008](./docs/adr/008-per-user-exercise-catalog.md) | 운동 카탈로그 소유권 모델 | Accepted |

전체 인덱스: [docs/adr/README.md](./docs/adr/README.md)

## Roadmap

| Phase | 내용 | 추정 |
|-------|------|------|
| 0 | Project Bootstrap (Next.js + Supabase + Vercel 셋업) | 1일 |
| 1 | Data Layer (스키마 + RLS + 시드 + 타입 생성) | 3~4일 |
| 2 | 카톡 데이터 임포트 (Claude Code 일회성 파싱) | 2일 |
| 3 ⭐ | 핵심 화면: 운동 진행 (옵티미스틱 mutation, 드롭세트, 좌/우, 타이머) | 5~7일 |
| 4 | 기록 보기 (캘린더 + 추이 차트) | 3일 |
| 5 | 운동 관리 + 홈 + Export | 2~3일 |
| 6 | PWA + 모바일 마무리 | 2~3일 |
| 7 | 테스트 + 실사용 폴리시 + 배포 | 2~3일 |

**총 추정:** 20~27일

## License

Personal project. No license specified yet.
