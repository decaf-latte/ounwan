# Changelog

이 프로젝트의 주요 변경 내역. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) 기반.

PR 머지 기준이며, 각 항목 끝의 `#NN` 은 GitHub PR 번호.

---

## [Unreleased]

## 2026-06-12

### Added
- 진행 중 세션 헤더에 `+ 운동` 버튼 — 다이얼로그에서 검색·선택해 세션에 추가 (`#35`)
- SetRow 사이드 토글 — `양 / L / R` 순환 탭. 한쪽씩(브이스쿼트·불가리안 스플릿 스쿼트 등) 기록 가능 (`#35`)
- 운동 카드 하단 `+ 세트 추가` / `− 세트` 버튼 — 가변 세트 수 지원 (`#35`)

### Changed
- 액티브/완료 판정을 `default_sets` 고정값 → 현재 표시된 드래프트 개수 기준으로 변경 (`#35`)

## 2026-06-11

### Added
- 대시보드 캘린더에 이전/다음 달 화살표 + "오늘로" 복귀 링크 — `/dashboard?vy=Y&vm=M` (`#34`)

## 2026-06-09

### Added
- 캘린더 셀에 아침/저녁 몸무게 배지 동시 노출 — 아침은 시안 배지, 저녁은 빨강 네온 배지 (`#31`)

### Fixed
- 좁은 화면에서 몸무게 배지가 셀을 꽉 채워 찌그러져 보이던 문제 — `kg` 접미사 제거, 소수 1자리 고정, 패딩/모서리 보정 (`#32`)
- 서버 시간이 UTC라 한국 새벽~오전(00:00~09:00 KST)에 "오늘"이 어제로 잡히던 문제 — Asia/Seoul 기준 헬퍼(`src/lib/seoul-date.ts`)로 dashboard/page, history/page, sessions 쿼리 3곳, body-weights 쿼리 모두 교체 (`#33`)

### Changed
- `weightByDate` prop을 단일 값 → `{ morning?, evening? }` 형태로 분리

## 2026-06-08

### Added
- 대시보드 캘린더 날짜 셀 클릭 활성화 — 기록 있는 날은 세션 상세 모달, 빈 날은 `/workout/new`로 이동 (`#29`)
- 캘린더 셀에 부위 카테고리 색 채우기 + 네온 톤 보더 (상체=네온 핑크-레드, 하체=네온 시안-블루, 둘 다=대각 그라데이션) (`#28`, `#27`)
- 진행 중 세션 화면 헤더에 휴지통 버튼 — 세션 통째로 삭제 후 `/workout/new`로 이동 (`#25`)
- 캘린더 몸무게 기록 기능 — `body_weights` 테이블 신규, 우측 하단 FAB(+) → 다이얼로그(날짜·아침/저녁·무게) upsert/삭제, 셀 아래 대표 몸무게 배지 (`#24`)
- `/weight` 추이 그래프 페이지 — 최근 30일 라인 차트 (아침 우선) (`#24`)
- `/workout/new` 부위 선택 상체/하체 1차 뎁스 — `body-part-category.ts` 매핑 상수, segmented control (`#23`)

### Changed
- 캘린더 셀 크기 확대 — `min-h-16 p-2`, 폰트 한 단계 ↑ (`#26`)
- 부위별 컬러 도트 제거 → 카테고리 배경 색칠로 전환 (`#26`, `#27`)
- `MiniCalendar.onDateClick` 시그니처 `(sessionId)` → `(day, entry?)` 로 변경 (`#29`)

## 2026-06-04

### Added
- 디자인 리프레시 — Dashboard 레이아웃 개편, globals.css 디자인 토큰 갱신, card/button/BottomTab/Sidebar 스타일 정리 (`#20`)
- 운동 진행 화면 최하단 유산소 카드 — `cardio_logs` 테이블 신규 (`#17`)
- 세션 계획 운동 목록 DB 저장 — 세트 0개 운동도 복원 가능 (`#16`)
- 진행중 운동 카드 탭하여 활성화 — 순서 자유 선택 (`#14`)
- 지난 기록에 운동/세트 추가 (`#13`)
- 진행중 화면 편집 모드 토글 (`#12`)
- 운동 기록 삭제 — 세션/운동/세트 3단위 (`#9`)

### Changed
- 추천 정렬에서 저번에 한 운동을 맨 아래로 (`#18`)

### Fixed
- 모바일 대시보드 CTA가 BottomTab에 가려지는 문제 — `bottom-[calc(...)]`로 BottomTab 위로 (`#22`)
- 모바일에서 BottomTab에 컨텐츠 마지막 가림 — AppShell wrapper에 하단 safe-area 패딩 (`#21`)
- 클라이언트 번들에 서버 import 끌림 → Vercel 빌드 실패 수정 (`#19`)
- 진행 중 세션 이어하기 배너 — 다른 화면 갔다 와도 복귀 가능 (`#15`)
- 긴 모달이 화면 넘쳐 backdrop 안 잡히던 버그 — `max-h-[85dvh] + overflow-y-auto` (`#11`)

### Performance
- First load 개선 — Pretendard self-host, recharts dynamic import, staleTime 상향 (`#10`)

## 2026-06-02

### Added
- 추천 외 운동 직접 추가 — "다른 운동 추가" 목록 (`#8`)

### Fixed
- 세트 입력 truncation 버그 (`#7`)

## 2026-06-01

### Added
- Phase 4 — 기록(history) 페이지 + 차트 (`#6`)
- Phase 3.6 — 데스크탑 반응형 (Sidebar/AppShell) (`#5`)

## 2026-05-29

### Added
- Phase 3.5 — 디자인 시스템 (color tokens, typography, components) (`#4`)

## 2026-05-27

### Added
- Phase 3.1 — Workout Runner Basic (`#3`)

## 2026-05-26

### Added
- Phase 2 — 카카오톡 셀프챗 임포트 파이프라인 (`#2`)
- Phase 0.1 — 프로젝트 부트스트랩 (Next.js + Supabase + RLS) (`#1`)
