# 헬스 루틴 관리 앱 — 설계 문서

- **Date:** 2026-05-22
- **Author:** HJ (with Claude)
- **Status:** Draft (User review pending)
- **Revision:** v2 (critic 검토 반영, ADR-008 추가)

## 1. Purpose

개인용 헬스 루틴 관리 모바일 웹앱. 다음 두 가지 문제를 동시에 해결:

1. **루틴 만들기 귀찮음** → PT에서 받은 분할 패턴 + 본인의 운동 리스트를 시드로 깔고, 부위 조합만 누르면 운동/세트/무게가 자동 추천
2. **기록 흩어짐** → 카톡 셀프챗에 1년치 쌓인 운동 기록을 마이그레이션, 이후 앱에서 일관되게 관리

부가 가치:
- 캘린더에서 오운완 한 눈에 보기
- 운동별 무게 추이 차트
- 추후 인바디/눈바디 확장 슬롯

## 2. User & Scenarios

**User**: HJ (1인). 자바 백엔드 개발자. PT 졸업 후 개인 운동 진행 중.

**핵심 시나리오:**

| # | 상황 | 기기 | 동작 |
|---|------|------|------|
| S1 | 헬스장 도착, "오늘 뭐 할까" | 모바일 | 부위 조합 선택 → 자동 추천 루틴 확인 → 운동 시작 |
| S2 | 세트 완료 후 무게/회수 기록 | 모바일 | 1탭/스와이프로 기록, **즉시 UI 반응** (느린 와이파이 무관) |
| S3 | 드롭세트 수행 | 모바일 | "+ 드롭" 버튼으로 메인 세트에 연결 |
| S4 | 단측 운동 (한발/한팔) | 모바일 | 별도 운동 카탈로그에서 선택, 필요 시 좌/우 분리 |
| S5 | 집에서 진척 확인 | 데스크탑 | 캘린더에서 오운완 확인 + 운동별 무게 추이 차트 |
| S6 | 새 운동 추가 (PT 후 새로 배운 거) | 모바일/데스크탑 | 운동 관리 페이지에서 추가, 부위/장비 지정 |

**비목표:**
- 다중 사용자, 친구 공유, 소셜 기능
- 영양/식단 관리
- AI 코칭 / 챗봇 (포트폴리오 어필은 다른 방식으로)
- 완전 오프라인 입력 (read-only 캐시까지만)

## 3. Core Features (Screens)

```
1. 홈 (대시보드)
   - "운동 시작" 버튼
   - 미니 캘린더 (오운완 표시)
   - 최근 운동 요약 (지난 운동 / N일 연속 / 이번 주 합계)

2. 운동 시작
   - 부위 조합 선택 (가슴+어깨, 등, 하체 등)
   - 자동 추천 / 수동 선택 토글
   - 추천된 운동 리스트 검토 → 시작

3. 운동 진행 화면 (⭐ 핵심 UX)
   - 운동별 세트 카드 (무게, 회수 입력)
   - 드롭세트 지원 (+ 드롭 버튼)
   - 좌우 입력 (단측 운동만)
   - 지난번 기록 표시 (점진적 과부하 힌트)
   - 휴식 타이머

4. 기록 보기
   - 캘린더 풀뷰 (오운완 표시, 부위별 색상)
   - 날짜 클릭 → 그날 운동 상세
   - 운동별 무게 추이 차트

5. 운동 관리 (설정)
   - 운동 추가/편집/삭제 (per-user catalog — ADR-008)
   - 부위 카테고리는 글로벌 (읽기만)
   - 데이터 export (CSV/JSON)
   - 로그아웃
```

## 4. Tech Stack

| Layer | 선택 | 근거 |
|-------|------|------|
| Framework | **Next.js (App Router) + TypeScript** | PWA, RSC 활용, Vercel 호환 |
| Hosting | **Vercel** (무료) | Git push 자동 배포 |
| DB + Auth + Storage | **Supabase** (무료 플랜) | Postgres + RLS + Google OAuth + Storage 통합 |
| Auth SSR Helper | **@supabase/ssr** | Next.js App Router 인증 통합 (ADR-005) |
| State (server) | **TanStack Query v5** | optimistic mutation, persist, DevTools (ADR-007) |
| State (client UI) | **Zustand** (보조) | 타이머/모달 등 순수 UI |
| PWA | **@serwist/next** | next-pwa 후속 (ADR-006) |
| UI | **Tailwind CSS + shadcn/ui** | 빠른 모바일 친화 컴포넌트 |
| Charts | **Recharts** | React 친화, TanStack Query와 자연스러운 조합 |
| Calendar | **react-day-picker** | 가벼움, Tailwind 호환 |
| Toast | **sonner** | shadcn/ui 표준 |
| Testing | **Vitest + Playwright** | unit/RLS는 Vitest, E2E는 Playwright |

비용 합계: **0원/월** (개인 사용량 기준, Supabase 무료 한도: 500MB DB / 1GB Storage / 50K MAU)

## 5. Data Model

> 세부 결정 근거: ADR-001, 002, 003, 008

### 5.1 ERD (간략)

```
auth.users (Supabase)
  ├─ exercises (1:N, per-user — ADR-008)
  │    ├─ exercise_body_parts (M:N → body_parts)
  │    └─ parent_exercise_id (self-ref for unilateral variants)
  ├─ routine_templates (1:N)
  │    └─ routine_template_body_parts (M:N → body_parts)
  └─ workout_sessions (1:N)
       └─ workout_sets (1:N, self-ref for drop sets)

body_parts (글로벌, read-only public)

body_compositions (future, M:N with body_parts)
body_photos (future)
```

### 5.2 핵심 스키마

```sql
-- 부위 마스터 (ADR-001) — 글로벌, 8행 고정
CREATE TABLE body_parts (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name_ko TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  display_order INT NOT NULL
);

-- 운동 마스터 (ADR-001, 003, 008) — per-user
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  equipment TEXT CHECK (equipment IN ('free_weight', 'machine', 'cable', 'bodyweight', 'other')),
  is_unilateral BOOLEAN DEFAULT FALSE,
  parent_exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  default_sets SMALLINT DEFAULT 3,
  default_reps_min SMALLINT,
  default_reps_max SMALLINT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_exercises_user_id ON exercises (user_id);

-- 본인 카탈로그 내 운동명 중복 방지 (critic 검토 반영)
CREATE UNIQUE INDEX uniq_exercises_user_name ON exercises (user_id, name);

-- 운동-부위 M:N (ADR-001)
CREATE TABLE exercise_body_parts (
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
  body_part_id INT REFERENCES body_parts(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (exercise_id, body_part_id)
);

-- 분할 템플릿 — per-user
CREATE TABLE routine_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,             -- "가슴+어깨", "하체 엉덩이"
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_routine_templates_user_id ON routine_templates (user_id);

-- 분할-부위 M:N (critic 검토 결과 TEXT[]에서 정션으로 변경 — 정규화 일관성)
CREATE TABLE routine_template_body_parts (
  routine_template_id UUID REFERENCES routine_templates(id) ON DELETE CASCADE,
  body_part_id INT REFERENCES body_parts(id) ON DELETE CASCADE,
  PRIMARY KEY (routine_template_id, body_part_id)
);

-- 운동 세션
CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  routine_template_id UUID REFERENCES routine_templates(id) ON DELETE SET NULL,
                                  -- nullable: ad-hoc 운동 (템플릿 없이 즉흥) 허용
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  overall_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_workout_sessions_user_date ON workout_sessions (user_id, started_at);

-- 세트 기록 (ADR-002, 003)
CREATE TABLE workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES workout_sessions(id) ON DELETE CASCADE NOT NULL,
  exercise_id UUID REFERENCES exercises(id) ON DELETE RESTRICT NOT NULL,
                                  -- 운동 삭제 시 과거 기록 보호 (UI에서 history 있으면 삭제 차단)
  set_number SMALLINT NOT NULL,
  weight_kg NUMERIC(5,1),
  reps SMALLINT,
  parent_set_id UUID REFERENCES workout_sets(id) ON DELETE CASCADE,
  drop_order SMALLINT DEFAULT 0,
  side TEXT CHECK (side IN ('both','left','right')) DEFAULT 'both',
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (drop_order = 0 OR parent_set_id IS NOT NULL),
  CHECK (drop_order >= 0)
);

CREATE UNIQUE INDEX uniq_main_set
  ON workout_sets (session_id, exercise_id, set_number, side)
  WHERE parent_set_id IS NULL;

CREATE INDEX idx_workout_sets_session ON workout_sets (session_id);
CREATE INDEX idx_workout_sets_exercise ON workout_sets (exercise_id);
```

### 5.3 Row Level Security (RLS) 정책

```sql
-- 본인 데이터만 접근 (ADR-005, 008)
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_body_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_template_body_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;

-- 본인 직접 소유 row
CREATE POLICY "own exercises" ON exercises
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own routines" ON routine_templates
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own sessions" ON workout_sessions
  FOR ALL USING (auth.uid() = user_id);

-- 부모 row 기반 access
CREATE POLICY "own exercise_body_parts" ON exercise_body_parts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM exercises e WHERE e.id = exercise_id AND e.user_id = auth.uid())
  );
CREATE POLICY "own routine_template_body_parts" ON routine_template_body_parts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM routine_templates r WHERE r.id = routine_template_id AND r.user_id = auth.uid())
  );
CREATE POLICY "own sets" ON workout_sets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM workout_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );

-- 글로벌 카탈로그 (read-only public)
ALTER TABLE body_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read body_parts" ON body_parts FOR SELECT USING (true);
-- body_parts 쓰기는 service_role (마이그레이션/시드로만)

-- user_id 자동 주입 트리거 (보안 강화, 선택)
CREATE OR REPLACE FUNCTION set_user_id_default()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_exercises_user_id BEFORE INSERT ON exercises
  FOR EACH ROW EXECUTE FUNCTION set_user_id_default();
CREATE TRIGGER trg_routines_user_id BEFORE INSERT ON routine_templates
  FOR EACH ROW EXECUTE FUNCTION set_user_id_default();
CREATE TRIGGER trg_sessions_user_id BEFORE INSERT ON workout_sessions
  FOR EACH ROW EXECUTE FUNCTION set_user_id_default();
```

## 6. Architecture Decisions (ADRs Summary)

| ADR | 결정 | 핵심 근거 |
|-----|------|-----------|
| [001](../adr/001-body-part-modeling.md) | body_parts 룩업 테이블 + M:N 정션 | 한 운동 = 복수 부위, 부위 분류 유동성, UI 메타 동거 |
| [002](../adr/002-drop-set-modeling.md) | drop sets: self-reference (parent_set_id) | 추이 차트 쿼리 단순화, JSONB 타입 불안정성 회피 |
| [003](../adr/003-side-asymmetry-modeling.md) | 단측 변형 = 별도 exercise + side 컬럼 하이브리드 | 구조적 차이와 좌/우 추적의 도메인 분리 |
| [004](../adr/004-kakaotalk-import-strategy.md) | Claude Code 일회성 파싱 + Markdown 검증 | 30~50세션 1회성, 비용 0, 검증 가능성 |
| [005](../adr/005-authentication.md) | Supabase Auth + Google OAuth 단일 | 1인용 적정 수준, 비번 관리 부담 0 |
| [006](../adr/006-pwa-offline-scope.md) | PWA + Read-only Cache (Serwist) | 헬스장 진짜 문제는 "느린 네트워크" |
| [007](../adr/007-frontend-state-management.md) | TanStack Query + RSC 하이브리드 | 자주 입력 시 0ms UI 반응 + RSC 이점 유지 |
| [008](../adr/008-per-user-exercise-catalog.md) | exercises per-user (user_id + own RLS) | Phase 5 운동 CRUD 가능 + 멀티유저 확장성 |

## 7. Recommendation Algorithm (운동 추천 로직)

**MVP 정의 (모호성 제거 — critic 지적 반영):**

부위 조합(예: `[chest, shoulder]`) 입력 시:

1. 해당 부위가 primary인 exercises 후보 추출
   ```sql
   SELECT DISTINCT e.* FROM exercises e
   JOIN exercise_body_parts ebp ON ebp.exercise_id = e.id
   WHERE e.user_id = :uid
     AND ebp.body_part_id IN (:bodyPartIds)
     AND ebp.is_primary = true;
   ```
2. 후보를 다음 우선순위로 정렬:
   - 최근 30일 내 사용 빈도가 높은 운동 우선 (사용자가 자주 하는 것)
   - 동률이면 마지막 사용일이 더 오래된 것 우선 (회전제)
3. 부위당 N개 (기본 3개) 선택 → 총 N×부위수 (40~50분 운동 분량)
4. 각 운동의 default values:
   - **무게**: 마지막 세션의 메인 세트 최고 무게 (없으면 `default_reps_*` 기준 빈값)
   - **세트 수**: 마지막 세션 메인 세트 개수 (없으면 `default_sets`)
   - **회수**: 마지막 세션의 평균 reps (없으면 default_reps_min)

**"점진적 과부하 힌트"의 의미:** 직전 세션과 동일한 무게/회수를 default로 채워줌. 사용자가 보고 +2.5kg 올릴지 판단. 자동 증량 제안은 v2에서 검토.

## 8. Error Handling & UX States

### 8.1 글로벌 정책

- **에러 바운더리**: `app/error.tsx`, `app/global-error.tsx` 둘 다 구현. 사용자에게 "다시 시도" 버튼.
- **API 에러 토스트**: `sonner`로 통일. 실패 사유는 한국어로 사용자 친화적 메시지.
- **TanStack Query 재시도**: queries 2회, mutations 1회 (느린 네트워크 대응)
- **오프라인 감지**: `onlineManager`로 상태 추적, 오프라인 시 입력 버튼 disabled + 토스트

### 8.2 화면별 상태

| 상태 | UI 처리 |
|------|---------|
| Loading | shadcn `Skeleton` 컴포넌트 |
| Empty (운동 0개) | "첫 운동을 추가해보세요" + 안내 카드 |
| Empty (기록 0회) | "오운완을 시작해볼까요?" + "운동 시작" CTA |
| Error | 에러 박스 + 재시도 버튼 |
| Optimistic 실패 | 토스트 알림 + 입력 복원 |
| Offline | 상단 배너 "오프라인 모드 — 새 입력 불가" |

### 8.3 인증 만료
- `@supabase/ssr`이 자동 토큰 갱신 처리
- refresh 실패 시 `/login`으로 리다이렉트
- 운동 중간에 발생할 가능성 적지만, mutation 실패 시 재로그인 안내

## 9. Testing Strategy

### 9.1 단위/통합 — Vitest
- **RLS 정책 테스트**: 로컬 Supabase (`supabase start`)에서 두 개의 JWT 토큰(User A, User B)을 발급(`supabase.auth.admin.generateLink` 또는 직접 sign-in)하고 supabase-js 클라이언트로 각각 접근 → "User B가 User A의 row에 접근 시 0 rows 또는 에러" 검증
- **드롭세트 unique index**: 같은 (session_id, exercise_id, set_number, side, parent_set_id IS NULL) 조합으로 두 번 INSERT → 에러 발생 검증
- **추천 알고리즘**: 부위 입력 → 예상 운동 리스트 (모킹된 사용 기록 fixture)
- **카톡 파서 검증**: 핵심 패턴 5~10개 단위 테스트 (드롭세트, 단측, 빈바 등)

### 9.2 E2E — Playwright
3개 핵심 시나리오:
- **T1. 운동 기록 전체 흐름**: 로그인 → 부위 선택 → 추천 운동 → 세트 입력 → 드롭세트 → 종료
- **T2. 캘린더 조회**: 과거 날짜 클릭 → 세션 상세 표시
- **T3. 운동 CRUD**: 새 운동 추가 → 편집 → 삭제 (RLS 정상 동작 확인 포함)

### 9.3 수동 테스트
- 실제 헬스장에서 1주일간 사용 (Phase 7)
- Lighthouse PWA 점수 측정
- 느린 3G throttling으로 UX 확인

## 10. Implementation Phases

### Phase 0: Project Bootstrap (1일)
- Next.js + TypeScript + Tailwind + shadcn/ui 셋업
- Supabase 프로젝트 생성, Google OAuth 설정
- Vercel 연결, 첫 배포 (Hello World)
- 환경변수 설정

### Phase 1: Data Layer (3~4일)
- **마이그레이션 도구**: Supabase CLI (`supabase migration new <name>`) 사용 → SQL 파일 버전 관리, 로컬↔원격 동기화 (`supabase db push`)
- 마이그레이션 작성 (ADR-001~008 스키마)
- `body_parts` 시드 (8행, `supabase/seed.sql`)
- RLS 정책 + user_id 트리거 (NULL-check 패턴, ADR-008 참조)
- `supabase gen types typescript` → 타입 생성 파이프라인 (`pnpm gen:types` 등 npm script)
- TanStack Query + Supabase 클라이언트 wrapper (Browser + Server with `@supabase/ssr`)
- Vitest 설정 + RLS 테스트 1개 (User A/B 격리 검증)
- 로컬 Supabase 환경 (`supabase start`) 동작 확인

### Phase 2: 카톡 데이터 임포트 (2일)
- `.eml` → exercises.json (Step 1, Claude Code)
  - **참고**: 카톡 export 포맷 확인 필요 (.eml인지 .txt인지)
- exercises.json 검토 + 수정
- `.eml` + exercises.json → workout_sessions.json (Step 2)
- 검증 Markdown 테이블 생성
- 사용자 검토 → SQL INSERT → Supabase 임포트
- `unresolved` 항목 처리

### Phase 3: 핵심 화면 — 운동 진행 (5~7일) ⭐ 최대 리스크
- **3a (1~2일)**: 운동 시작 페이지 (부위 조합 선택, 추천 알고리즘 구현)
- **3b (2일)**: 운동 진행 화면 기본 (세트 카드 + 무게/회수 입력 + optimistic mutation)
- **3c (1일)**: 드롭세트 UI (+ 드롭 버튼, 그룹핑 헬퍼)
- **3d (1일)**: 좌/우 입력 (`is_unilateral`이면 토글 표시)
- **3e (1일)**: 휴식 타이머 (Zustand), 지난번 기록 표시

### Phase 4: 기록 보기 (3일)
- 캘린더 풀뷰 (월별, 오운완 표시 + 부위 색상 도트)
- 날짜 클릭 → 세션 상세 모달/페이지
- 운동별 무게 추이 차트 (Recharts)

### Phase 5: 운동 관리 + 홈 + Export (2~3일)
- 운동 CRUD 페이지 (per-user, ADR-008)
- 부위 매핑 UI
- 홈 대시보드 (미니 캘린더, 최근 운동 요약)
- 데이터 export (CSV, JSON)

### Phase 6: PWA + 모바일 마무리 (2~3일)
- `@serwist/next` 설정
- manifest.json + 아이콘
- 캐시 전략 적용 (CacheFirst/SWR/NetworkFirst)
- SW 버저닝 (skipWaiting, clientsClaim — ADR-006 보강 사항)
- 모바일 가로/세로 / 다크모드 점검

### Phase 7: Test + Polish + 배포 (2~3일)
- Playwright E2E 3개 시나리오
- 에러 바운더리, 로딩/빈 상태 점검
- Lighthouse PWA 점수 측정
- 실제 헬스장 1주일 사용 + 피드백 반영
- **README 포트폴리오 보강** (Mermaid 사용, GitHub에서 자동 렌더):
  - **ERD** (`erDiagram`) — body_parts/exercises/junction/sessions/sets 전체 관계도
  - **시퀀스 다이어그램** (`sequenceDiagram`) — 최소 2개:
    1. Google OAuth + Supabase 인증 흐름
    2. 운동 세트 입력 → optimistic mutation → onError 롤백 흐름
  - **플로우차트** (`flowchart`) — 최소 2개:
    1. 부위 선택 → 추천 알고리즘 → 운동 리스트 생성
    2. 드롭세트 입력 + 좌우 분기 로직
  - 데모 영상 또는 GIF (헬스장에서 실제 사용 장면)
  - 기술 결정 요약 (ADR 링크 + 핵심 트레이드오프)

**총 추정: 20~27일** (이전 12~17일에서 critic 지적 반영해 현실화)

> 학습 곡선 (Next.js App Router, TanStack Query, Serwist), CSS 반응형 디버깅, Vercel 배포 이슈, SW 디버깅 시간을 포함한 현실적 추정.

## 11. Technical Risks

| 리스크 | 영향 | 완화 |
|--------|------|------|
| Serwist + Next.js App Router 호환성 (라이브러리 신생) | Phase 6 지연 | next-pwa로 fallback 가능, 또는 SW 수동 작성 |
| RSC hydration boundary 복잡도 | Phase 3 학습 비용 | Phase 3b부터 클라이언트 전면 채택, RSC는 데스크탑 페이지에 한정 |
| TanStack Query persist + Supabase 세션 갱신 race | 캐시 stale 표시 | refetchOnReconnect + invalidate 정책 명확화 |
| 카톡 데이터 임포트 정확도 | Phase 2 재작업 | confidence 마킹 + Markdown 검증으로 사전 차단 |
| 헬스장에서 실사용 시 발견되는 UX 이슈 | Phase 7 추가 작업 | 버퍼 3~4일 확보 |

## 12. Out of Scope / Future

| 기능 | 사유 | 추후 ADR |
|------|------|----------|
| 인바디 측정 기록 | MVP 불필요 | ADR-009 후보 |
| 눈바디 사진 (Supabase Storage) | MVP 불필요 | ADR-010 후보 |
| AI 추천 코치 (LLM API) | 비용 / 1인용 과잉 | (보류) |
| 친구 공유 / 멀티유저 공통 카탈로그 | 1인용 | ADR-008 확장 시 |
| 완전 오프라인 입력 | 복잡도, 실사용 검증 후 결정 | ADR-006의 마이그 경로 활용 |
| 자동 점진적 과부하 제안 (+2.5kg) | v1은 "힌트만" | v2 검토 |
| 음성 입력 | 키보드로 충분 | (보류) |

## 13. Success Criteria

- [ ] **실사용**: 1주일(약 3~5회 운동 세션) 동안 헬스장에서 모바일로 매 운동마다 사용, 중도 포기 없음
- [ ] **데이터 연속성**: 카톡 1년치 임포트 + 새 기록이 통합되어 추이 차트에 표시
- [ ] **속도**: 세트 완료 버튼 → UI 반영 < 100ms (와이파이 환경)
- [ ] **PWA**: Lighthouse PWA 점수 90+
- [ ] **테스트**: E2E 3개 시나리오 통과, RLS 단위 테스트 통과
- [ ] **포트폴리오 산출물**: README + 데모 영상 + ADR-001~008 + 임포트 검증 마크다운 정리 후 깃 푸시

## 14. Open Questions

(현 시점 없음 — 모든 핵심 결정은 ADR-001~008로 확정. 미해결 항목은 implementation 중 발생 시 ADR-009+로 추가.)

## References

- ADR-001 ~ 008: `docs/adr/`
- Architect 에이전트 검토 기록 (2026-05-22) — 3차례
- Critic 에이전트 검토 결과 (2026-05-22) — Critical 1, Major 4 식별 후 반영
- 원본 운동 데이터: 카톡 셀프챗 export 파일 (외부)

## Revision History

| Version | Date | Change |
|---------|------|--------|
| v1 | 2026-05-22 | 초안 작성 (ADR-001~007 반영) |
| v2 | 2026-05-22 | critic 검토 반영: ADR-008 추가 (per-user catalog), routine_templates 정션 변환, equipment CHECK, RLS 패턴 통일, 추천 알고리즘 명세, 에러/UX 상태, 테스트 전략, 타임라인 현실화 (12~17 → 20~27일), 리스크 섹션 |
| v2.1 | 2026-05-22 | critic 재검토 반영: 트리거 NULL-check 패턴 (ADR-008 정합), exercises UNIQUE (user_id, name), workout_sets.exercise_id ON DELETE RESTRICT, RLS 테스트 접근법 구체화, Supabase CLI 마이그레이션 도구 명시, 1주일 정의 명확화 |
