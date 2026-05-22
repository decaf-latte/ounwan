# Phase 0 + 1: Foundation (Bootstrap + Data Layer) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Next.js + Supabase 프로젝트 스켈레톤 셋업 — 전체 DB 스키마, RLS 정책, 트리거, body_parts 시드, TypeScript 타입 자동 생성 파이프라인, Google OAuth 로그인 페이지까지 동작하는 상태로 Vercel에 배포.

**Architecture:** Next.js 16 App Router (TypeScript) on Vercel + Supabase (Postgres + Auth + Storage). 인증은 @supabase/ssr로 RSC/Client 양쪽. 데이터 페칭은 TanStack Query + RSC hybrid (ADR-007). 스키마는 Supabase CLI 마이그레이션으로 관리.

**Tech Stack:** Next.js 16 (App Router), TypeScript 5, Tailwind CSS 4 (CSS-first config), shadcn/ui (latest), Supabase JS v2, @supabase/ssr, TanStack Query v5, Vitest 1, Supabase CLI.

> **버전 참고:** `create-next-app@latest`로 받으면 2026-05 기준 Next.js 16 + Tailwind v4 설치됨. Tailwind v4는 `tailwind.config.js` 없이 CSS-first 설정 — shadcn init이 자동 처리. 외부 튜토리얼에서 Tailwind v3 안내(`tailwind.config.js` 수정)는 무시. Playwright와 `persistQueryClient`는 본 플랜에서 제외 (Phase 6/7).

**Reference docs:**
- Spec: `docs/specs/2026-05-22-gym-routine-app-design.md`
- ADRs: `docs/adr/001-008`
- 본 플랜은 spec의 §10 Phase 0 + Phase 1을 구현

**완료 시점에 검증되는 것:**
- Vercel에 배포된 앱 셸 (`/` → 자동 리다이렉트 → `/login`)
- Google OAuth 로그인 + 로그아웃 동작 (프로덕션)
- 8개 테이블 + RLS + 트리거 + body_parts 8행 시드 적용된 Supabase 클라우드
- 본인 user_id 외 row 접근 차단 (RLS isolation test 통과)
- 자동 생성된 `src/types/database.types.ts`

## Environment Strategy (중요)

이 플랜은 **로컬 Supabase**(`supabase start`)와 **클라우드 Supabase**를 둘 다 사용. 혼동 방지 규칙:

| 용도 | 사용 Supabase | env 파일 |
|------|---------------|----------|
| 스키마/마이그레이션 검증 (`supabase db reset`) | 로컬 | (앱과 무관) |
| 앱 개발 + OAuth 테스트 (`pnpm dev`) | **클라우드** | `.env.local` |
| RLS isolation 테스트 (Chunk 7) | **클라우드** | `.env.local` 또는 `.env.test.local` |
| 프로덕션 배포 (Vercel) | 클라우드 | Vercel env vars |

**핵심:** `.env.local`은 처음부터 **클라우드 Supabase URL/key**로 세팅. 로컬 Supabase는 `supabase db reset`으로 스키마 자체 검증에만 사용 (앱이 로컬 DB에 직접 연결 안 함).

이렇게 하면:
- OAuth는 항상 클라우드 Google provider 사용 → 한 번 설정 후 안정
- RLS 테스트는 실제 클라우드 RLS를 검증 (가장 신뢰성 높음)
- 로컬 스택은 마이그레이션 dry-run + Studio UI 활용

---

## Chunk 1: Project Bootstrap

**목표:** Next.js + Tailwind + shadcn/ui 프로젝트 스캐폴딩, Vercel에 Hello World 배포.

### Task 1.1: Next.js 프로젝트 초기화

**Files:**
- Create: project files via CLI

- [ ] **Step 1.1.1: Next.js 프로젝트 생성**

프로젝트 루트(`gym-routine-app/`)에서 (기존 docs/README 보존):
```bash
pnpm dlx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --use-pnpm
```

> 모든 옵션이 플래그로 답변되므로 일반적으로 대화형 프롬프트 없이 진행. 만약 "Directory not empty" 류 안내가 나오면 인터랙티브 프롬프트에서 진행 동의(Yes). ESLint는 기본 미설치 (`--eslint` 플래그 명시 시에만 설치). Turbopack 사용 여부는 Next 16 기본값 따름.

CLI 완료 후 생성되는 파일:
- `next.config.ts` (또는 .mjs/.js) — Phase 0+1에서 수정 불필요
- `AGENTS.md` — Next 16부터 기본 생성. 보존(LLM 에이전트가 코드베이스 파악하는 데 도움) 또는 삭제 후 commit. 본 플랜은 보존 가정.

- [ ] **Step 1.1.2: 충돌 파일 머지**

`create-next-app`이 생성한 README가 기존 README를 덮어썼는지 확인:
```bash
git status
git diff README.md
```

기존 한국어 README가 사라졌으면 `git checkout README.md`로 복구.

- [ ] **Step 1.1.3: 개발 서버 동작 확인**

```bash
pnpm dev
```
브라우저 http://localhost:3000 접속 → Next.js 기본 페이지 표시 확인. `Ctrl+C`로 종료.

- [ ] **Step 1.1.4: 경로 alias + .gitignore 확인**

```bash
grep '"@/\*"' tsconfig.json   # → "@/*": ["./src/*"] 있어야 함
grep -E '\.env\*?\.local|\.env\.local' .gitignore   # → 이미 매치 행 있어야 함 (없으면 추가)
```

- [ ] **Step 1.1.5: Commit**

```bash
git add .
git commit -m "chore: bootstrap Next.js with TypeScript, Tailwind, App Router"
```

### Task 1.2: shadcn/ui 셋업

- [ ] **Step 1.2.1: shadcn 초기화**

```bash
pnpm dlx shadcn@latest init
```

응답:
- Style: `New York`
- Base color: `Slate`
- CSS variables: Yes

- [ ] **Step 1.2.2: 기본 컴포넌트 몇 개 추가**

```bash
pnpm dlx shadcn@latest add button card input label skeleton sonner
```

생성 위치: `src/components/ui/`

> 참고: 현재 shadcn/ui에서 toast 컴포넌트는 `sonner`로 대체됨 (별도 toast 추가 불필요).

- [ ] **Step 1.2.3: 동작 확인**

`src/app/page.tsx` 임시 수정 — Button 컴포넌트 import 후 렌더:
```tsx
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">오운완 (Ounwan)</h1>
      <Button>shadcn 동작 확인</Button>
    </main>
  );
}
```

`pnpm dev` → 버튼 보이는지 확인.

- [ ] **Step 1.2.4: Commit**

```bash
git add .
git commit -m "feat: setup shadcn/ui with base components"
```

### Task 1.3: Vercel 배포

- [ ] **Step 1.3.1: Vercel CLI 로그인**

(전역 설치 대신 매번 dlx — 전역 환경 오염 방지)
```bash
pnpm dlx vercel login
```
이메일/GitHub 옵션 선택 후 인증.

- [ ] **Step 1.3.2: 프로젝트 연결 + 첫 배포**

```bash
pnpm dlx vercel
```
응답:
- Set up and deploy: `Y`
- Scope: 본인 계정
- Link to existing: `N`
- Project name: `ounwan` (또는 기본값)
- Directory: `./`
- Modify settings: `N`

배포 URL 확인 (예: `https://ounwan-xxxx.vercel.app`)

- [ ] **Step 1.3.3: GitHub 연동 자동 배포 설정**

Vercel 대시보드 (`https://vercel.com/dashboard`) → 방금 만든 프로젝트 → Settings → Git → Connect to GitHub repo `decaf-latte/ounwan`.

연동 후 `main` 브랜치 push 시 자동 배포되는지 확인 (다음 commit이 자동 배포되면 OK).

- [ ] **Step 1.3.4: .gitignore 확인**

Vercel CLI가 만든 `.vercel/` 폴더가 `.gitignore`에 있는지 확인. 없으면 추가:
```bash
echo ".vercel" >> .gitignore
```

- [ ] **Step 1.3.5: Commit + 자동 배포 검증**

```bash
git add .
git commit -m "chore: connect Vercel for auto-deploy"
git push
```

Vercel 대시보드에서 배포 진행 + 성공 확인. 배포 URL 방문해서 "오운완 (Ounwan)" 페이지 보이면 Chunk 1 완료.

---

## Chunk 2: Supabase Setup + Local Dev Environment

**목표:** Supabase 클라우드 프로젝트 생성, Google OAuth 설정, 로컬 Supabase 환경 (`supabase start`) 동작.

### Task 2.1: Supabase CLI 설치 + 클라우드 프로젝트

- [ ] **Step 2.1.1: Supabase CLI 설치**

```bash
brew install supabase/tap/supabase
supabase --version
```
v1.x 또는 v2.x 출력 확인.

- [ ] **Step 2.1.2: Supabase 클라우드 프로젝트 생성**

브라우저로 https://supabase.com 접속 → 로그인 → New Project:
- Name: `ounwan`
- Database password: 강력한 비번 (1Password 등에 저장)
- Region: `Northeast Asia (Seoul)` 또는 `Northeast Asia (Tokyo)`
- Pricing plan: `Free`

생성 완료까지 약 2분 대기.

- [ ] **Step 2.1.3: 프로젝트 정보 기록**

Project Settings → API에서 다음 값 메모:
- `Project URL` (예: `https://xxxxx.supabase.co`)
- `anon` public key
- `service_role` secret key (절대 클라이언트 노출 금지)

Project Settings → General에서:
- `Reference ID` 메모 (예: `abcdefghijklmnop`)

### Task 2.2: Google OAuth Provider 설정

- [ ] **Step 2.2.1: Google Cloud Console에서 OAuth 2.0 Client 발급**

https://console.cloud.google.com → 새 프로젝트 또는 기존 프로젝트 선택.
APIs & Services → Credentials → Create Credentials → OAuth client ID:
- Application type: `Web application`
- Name: `Ounwan`
- Authorized redirect URIs: `https://<Project Reference ID>.supabase.co/auth/v1/callback`

생성 후 `Client ID`, `Client Secret` 메모.

OAuth consent screen 미설정 시 함께 설정 (Internal 또는 External + Testing 모드, 본인 이메일만 테스트 사용자로 등록).

- [ ] **Step 2.2.2: Supabase 대시보드에 Google Provider 등록**

Supabase Dashboard → Authentication → Providers → Google:
- Enable: ON
- Client ID: (위에서 발급받은 값)
- Client Secret: (위에서 발급받은 값)
- Save

- [ ] **Step 2.2.3: Site URL + Redirect URLs 설정**

Authentication → URL Configuration:
- Site URL: 개발은 `http://localhost:3000`, 프로덕션은 배포 URL
- Redirect URLs (allow list): `http://localhost:3000/**`, `https://<vercel-domain>.vercel.app/**`

### Task 2.3: 로컬 Supabase 환경

- [ ] **Step 2.3.1: 로컬 Supabase 초기화**

프로젝트 루트에서:
```bash
supabase init
```
→ `supabase/` 폴더 생성 (`config.toml` 포함)

- [ ] **Step 2.3.2: 클라우드 프로젝트 링크**

```bash
supabase link --project-ref <Reference ID>
```
DB 비밀번호 입력 프롬프트.

- [ ] **Step 2.3.3: Docker 확인 + 로컬 스택 기동**

Docker Desktop 실행 중인지 확인. 그 다음:
```bash
supabase start
```
처음엔 이미지 다운로드로 3~5분 소요. 완료 후 출력되는 정보 메모:
- `API URL` (예: `http://127.0.0.1:54321`)
- `DB URL` (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`)
- `Studio URL` (예: `http://127.0.0.1:54323`)
- `anon key`, `service_role key` (로컬 전용)

- [ ] **Step 2.3.4: Studio 접속 확인**

브라우저로 `http://127.0.0.1:54323` 접속 → Supabase Studio UI 표시 확인.

- [ ] **Step 2.3.5: Commit**

```bash
git add supabase/
git commit -m "chore: initialize Supabase local environment"
```

### Task 2.4: 환경 변수 설정

**Files:**
- Create: `.env.local` (gitignored)
- Create: `.env.example` (committed, 비밀값 없이)

- [ ] **Step 2.4.1: .env.local 작성 (클라우드 Supabase 값 사용)**

Environment Strategy 섹션 참고 — **`.env.local`은 처음부터 클라우드 값 사용**. 로컬 Supabase는 schema dry-run 전용.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<클라우드 anon key>
SUPABASE_SERVICE_ROLE_KEY=<클라우드 service_role key>
```
> 값은 Task 2.1.3에서 메모해둔 클라우드 프로젝트 정보 사용. `service_role`은 절대 클라이언트 코드에서 import 금지 — RLS 테스트(Chunk 7)에서만 server-side로 사용.

- [ ] **Step 2.4.2: .env.example 작성 (커밋용 템플릿)**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 2.4.3: Vercel 환경변수 등록**

Vercel Dashboard → Project → Settings → Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL` = (클라우드 Project URL)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (클라우드 anon key)
- `SUPABASE_SERVICE_ROLE_KEY` = (클라우드 service_role key, Sensitive로 표시)

각 변수의 환경: Production, Preview, Development 모두 체크.

- [ ] **Step 2.4.4: Commit**

```bash
git add .env.example
git commit -m "chore: add env template and Vercel envs (excluding secrets)"
```

---

## Chunk 3: Database Schema (Migrations)

**목표:** ADR-001~008 스키마 전체를 Supabase 마이그레이션 파일로 생성, 로컬 + 클라우드 적용.

### Task 3.1: 첫 마이그레이션 — body_parts + helpers

**Files:**
- Create: `supabase/migrations/<timestamp>_init_body_parts.sql`

- [ ] **Step 3.1.1: 마이그레이션 파일 생성**

```bash
supabase migration new init_body_parts
```
생성된 파일 경로 메모 (예: `supabase/migrations/20260522123456_init_body_parts.sql`).

- [ ] **Step 3.1.2: body_parts 테이블 + RLS SQL 작성**

위 파일에 다음 내용 작성:
```sql
-- ADR-001: body_parts 룩업 테이블 (글로벌 read-only)
CREATE TABLE body_parts (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name_ko TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  display_order INT NOT NULL
);

ALTER TABLE body_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read body_parts" ON body_parts FOR SELECT USING (true);
-- 쓰기는 service_role(시드/마이그레이션)에서만
```

- [ ] **Step 3.1.3: 로컬 적용 + 검증**

```bash
supabase db reset
```
(로컬 DB 초기화 후 모든 마이그레이션 재적용)

Studio (`http://127.0.0.1:54323`) → Table Editor → `body_parts` 테이블 존재 확인.

### Task 3.2: 마이그레이션 — exercises + junction

**Files:**
- Create: `supabase/migrations/<timestamp>_exercises.sql`

- [ ] **Step 3.2.1: 마이그레이션 파일 생성**

```bash
supabase migration new exercises
```

- [ ] **Step 3.2.2: exercises + exercise_body_parts SQL**

```sql
-- ADR-001, 003, 008: per-user 운동 카탈로그 + M:N 부위 매핑
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
CREATE UNIQUE INDEX uniq_exercises_user_name ON exercises (user_id, name);

CREATE TABLE exercise_body_parts (
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
  body_part_id INT REFERENCES body_parts(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (exercise_id, body_part_id)
);
```

- [ ] **Step 3.2.3: 적용 + 검증**

```bash
supabase db reset
```
Studio에서 두 테이블 + 인덱스 확인.

### Task 3.3: 마이그레이션 — routine_templates + junction

**Files:**
- Create: `supabase/migrations/<timestamp>_routine_templates.sql`

- [ ] **Step 3.3.1: 파일 생성 + SQL**

```bash
supabase migration new routine_templates
```

내용:
```sql
CREATE TABLE routine_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_routine_templates_user_id ON routine_templates (user_id);

CREATE TABLE routine_template_body_parts (
  routine_template_id UUID REFERENCES routine_templates(id) ON DELETE CASCADE,
  body_part_id INT REFERENCES body_parts(id) ON DELETE CASCADE,
  PRIMARY KEY (routine_template_id, body_part_id)
);
```

- [ ] **Step 3.3.2: 적용**

```bash
supabase db reset
```

### Task 3.4: 마이그레이션 — workout_sessions + workout_sets

**Files:**
- Create: `supabase/migrations/<timestamp>_workouts.sql`

- [ ] **Step 3.4.1: 파일 생성**

```bash
supabase migration new workouts
```

- [ ] **Step 3.4.2: SQL (ADR-002, 003 적용)**

```sql
CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_template_id UUID REFERENCES routine_templates(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  overall_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_workout_sessions_user_date ON workout_sessions (user_id, started_at);

CREATE TABLE workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
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

- [ ] **Step 3.4.3: 적용 + Commit**

```bash
supabase db reset
git add supabase/migrations/
git commit -m "feat(db): create schema (body_parts, exercises, routines, workouts)"
```

---

## Chunk 4: RLS Policies + Trigger + Seed

**목표:** 모든 user-owned 테이블에 RLS 정책, user_id 자동 주입 트리거, body_parts 8행 시드.

### Task 4.1: RLS 정책 마이그레이션

**Files:**
- Create: `supabase/migrations/<timestamp>_rls_policies.sql`

- [ ] **Step 4.1.1: 파일 생성**

```bash
supabase migration new rls_policies
```

- [ ] **Step 4.1.2: SQL (ADR-005, 008 통합)**

```sql
-- 본인 row만 접근
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_body_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_template_body_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;

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
```

- [ ] **Step 4.1.3: 적용**

```bash
supabase db reset
```

### Task 4.2: user_id 자동 주입 트리거

**Files:**
- Create: `supabase/migrations/<timestamp>_user_id_trigger.sql`

- [ ] **Step 4.2.1: 파일 생성 + SQL (ADR-008 NULL-check 패턴)**

```bash
supabase migration new user_id_trigger
```

```sql
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

- [ ] **Step 4.2.2: 적용**

```bash
supabase db reset
```

### Task 4.3: body_parts 시드

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 4.3.1: seed.sql 작성**

```sql
-- ADR-001 시드 데이터
INSERT INTO body_parts (code, name_ko, color, icon, display_order) VALUES
  ('chest',    '가슴',     '#FF6B6B', 'chest',    1),
  ('back',     '등',       '#4ECDC4', 'back',     2),
  ('shoulder', '어깨',     '#FFE66D', 'shoulder', 3),
  ('trap',     '승모근',   '#95E1D3', 'trap',     4),
  ('arm',      '팔',       '#C9B1FF', 'arm',      5),
  ('leg',      '허벅지',   '#F38181', 'leg',      6),
  ('glute',    '엉덩이',   '#FCBAD3', 'glute',    7),
  ('core',     '복부',     '#A8E6CF', 'core',     8)
ON CONFLICT (code) DO NOTHING;
```

- [ ] **Step 4.3.2: 적용 + 검증**

```bash
supabase db reset
```
Studio → body_parts 테이블 → 8행 표시 확인.

- [ ] **Step 4.3.3: Commit**

```bash
git add supabase/
git commit -m "feat(db): add RLS, user_id trigger, body_parts seed"
```

### Task 4.4: 클라우드 적용

- [ ] **Step 4.4.1: 클라우드에 마이그레이션 푸시**

```bash
supabase db push
```
링크된 클라우드 프로젝트에 마이그레이션 적용. 프롬프트에서 확인.

> ⚠️ `db push`는 `seed.sql` 자동 실행 안 함. seed는 다음 단계에서 별도 처리.

- [ ] **Step 4.4.2: 클라우드에 body_parts seed 적용 (선택지 2개 중 택1)**

**Option A — Supabase Dashboard SQL Editor (가장 간단):**
1. Supabase Dashboard → SQL Editor → New query
2. `supabase/seed.sql` 내용 전체 복사 → 붙여넣기 → Run
3. body_parts에 8행 들어갔는지 Table Editor에서 확인

**Option B — psql CLI 직접 실행:**
```bash
# Supabase Dashboard → Project Settings → Database → Connection string (URI 모드, "Session" 풀러)에서 복사
psql "postgresql://postgres.<ref-id>:<DB-PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres" -f supabase/seed.sql
```
> DB 비밀번호는 Task 2.1.2에서 저장한 값. psql 미설치 시 `brew install libpq && brew link --force libpq`.

- [ ] **Step 4.4.3: 클라우드 Studio에서 검증**

Supabase Dashboard → Table Editor → 모든 테이블 존재 + body_parts 8행 확인.

### Task 4.5: 트리거 동작 검증 (ADR-008 안전망)

`SECURITY DEFINER` 함수 내에서 `auth.uid()`가 클라이언트 JWT 컨텍스트로 동작하는지 한 번 확인.

- [ ] **Step 4.5.1: 로컬에서 트리거 검증 (테스트 사용자 INSERT)**

로컬 Studio (`http://127.0.0.1:54323`) → Authentication → Add user → 임시 사용자 생성 후, SQL Editor에서:
```sql
-- 본인 access_token 사용한 시뮬레이션 안 됨 → 클라우드에서 본 검증을 RLS 테스트(Chunk 7)로 대체
-- 여기서는 service_role로 user_id 명시 INSERT가 정상 작동하는지만 확인:
SELECT id FROM auth.users LIMIT 1; -- 사용자 한 명의 UUID
INSERT INTO exercises (user_id, name) VALUES ('<위 UUID>', '검증용 운동');
SELECT * FROM exercises;
```
→ 1행 정상 삽입 확인.

> 트리거 `auth.uid()` 동작은 Chunk 7의 RLS isolation 테스트에서 실제 JWT로 검증됨. 본 단계는 schema 수준 sanity check만.

---

## Chunk 5: TypeScript Types + Supabase Clients + TanStack Query

**목표:** 자동 생성된 DB 타입, Browser/Server Supabase 클라이언트, TanStack Query Provider 셋업.

### Task 5.1: Supabase TypeScript 타입 자동 생성

- [ ] **Step 5.1.1: 타입 생성 npm script 추가**

`package.json`의 scripts에 추가:
```json
{
  "scripts": {
    "gen:types": "supabase gen types typescript --local > src/types/database.types.ts"
  }
}
```

- [ ] **Step 5.1.2: 타입 폴더 생성 + 첫 생성**

```bash
mkdir -p src/types
pnpm gen:types
```

`src/types/database.types.ts` 생성 확인. 안에 `Database` 타입 + 각 테이블 Row/Insert/Update 타입 들어있어야 함.

- [ ] **Step 5.1.3: Commit**

```bash
git add package.json src/types/
git commit -m "feat(types): add Supabase TS type generation script"
```

### Task 5.2: Supabase 클라이언트 (Browser + Server)

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`

- [ ] **Step 5.2.1: 패키지 설치**

```bash
pnpm add @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 5.2.2: Browser 클라이언트 작성**

`src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 5.2.3: Server 클라이언트 작성**

`src/lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database.types';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component에서는 set 호출 안됨 (middleware가 처리)
          }
        },
      },
    }
  );
}
```

- [ ] **Step 5.2.4: Middleware 헬퍼 작성**

`src/lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database.types';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 보호 라우트: 로그인 안 한 사용자는 /login으로
  const protectedPaths = ['/dashboard', '/workout', '/exercises', '/calendar'];
  const isProtected = protectedPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 5.2.5: Next.js middleware 등록**

`src/middleware.ts`:
```typescript
import { updateSession } from '@/lib/supabase/middleware';
import { type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

- [ ] **Step 5.2.6: Commit**

```bash
git add src/lib/supabase/ src/middleware.ts
git commit -m "feat(auth): add Supabase clients (browser, server, middleware)"
```

### Task 5.3: TanStack Query Provider

**Files:**
- Create: `src/lib/query-client.ts`
- Create: `src/components/providers/query-provider.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 5.3.1: 패키지 설치**

```bash
pnpm add @tanstack/react-query @tanstack/react-query-devtools
```

- [ ] **Step 5.3.2: QueryClient 팩토리**

`src/lib/query-client.ts`:
```typescript
import { QueryClient, isServer } from '@tanstack/react-query';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 2,
      },
      mutations: {
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  } else {
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}
```

- [ ] **Step 5.3.3: Provider 컴포넌트**

`src/components/providers/query-provider.tsx`:
```tsx
'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { getQueryClient } from '@/lib/query-client';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 5.3.4: layout.tsx에 QueryProvider + Toaster 적용**

`src/app/layout.tsx` 수정:
```tsx
import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/components/providers/query-provider';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: '오운완 (Ounwan)',
  description: '개인용 헬스 루틴 관리 PWA',
};

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 5.3.5: 동작 확인**

```bash
pnpm dev
```
http://localhost:3000 → 페이지 정상 표시 + 콘솔에 TanStack Query DevTools 아이콘 표시 확인.

- [ ] **Step 5.3.6: Commit**

```bash
git add .
git commit -m "feat(state): add TanStack Query provider with sensible defaults"
```

---

## Chunk 6: Auth Flow (Login Page + OAuth Callback)

**목표:** Google OAuth 로그인 버튼이 있는 `/login` 페이지, OAuth 콜백 처리, 로그아웃 액션, 보호 라우트 동작 확인.

### Task 6.1: Login 페이지

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/login/actions.ts`

- [ ] **Step 6.1.1: Login 페이지 작성**

`src/app/login/page.tsx`:
```tsx
// Server Component — `<form action={...}>`로 Server Action 직접 호출, 'use client' 불필요
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { signInWithGoogle } from './actions';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>오운완 로그인</CardTitle>
          <CardDescription>Google 계정으로 시작하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signInWithGoogle}>
            <Button type="submit" className="w-full">
              Google로 로그인
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 6.1.2: Server Action 작성**

`src/app/login/actions.ts`:
```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export async function signInWithGoogle() {
  const supabase = await createClient();
  const headersList = await headers();
  const origin = headersList.get('origin') ?? 'http://localhost:3000';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  if (data.url) {
    redirect(data.url);
  }
}
```

### Task 6.2: OAuth Callback Route

**Files:**
- Create: `src/app/auth/callback/route.ts`

- [ ] **Step 6.2.1: 콜백 라우트 작성**

`src/app/auth/callback/route.ts`:
```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
```

### Task 6.3: Dashboard Stub + Logout

**Files:**
- Create: `src/app/dashboard/page.tsx`
- Create: `src/app/dashboard/actions.ts`

- [ ] **Step 6.3.1: Dashboard 페이지 (인증 검증 + 로그아웃 버튼)**

`src/app/dashboard/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { signOut } from './actions';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <main className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">대시보드</h1>
      <p className="mb-4">로그인됨: {user.email}</p>
      <form action={signOut}>
        <Button type="submit" variant="outline">로그아웃</Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 6.3.2: 로그아웃 액션**

`src/app/dashboard/actions.ts`:
```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
```

### Task 6.4: 로컬 테스트

- [ ] **Step 6.4.1: OAuth 흐름 로컬 검증**

`.env.local`이 이미 클라우드 Supabase를 가리키고 있어서 (Step 2.4.1) Google OAuth는 정상 동작.

`pnpm dev` → http://localhost:3000/dashboard 접속 → 로그인 안 됐으므로 `/login` 리다이렉트 → "Google로 로그인" 클릭 → Google 동의 화면 → 콜백 처리 → /dashboard 표시 + 이메일 확인 → "로그아웃" 클릭 → /login 리다이렉트.

> 콜백 URL이 `http://localhost:3000/auth/callback`인지 + 이 URL이 Supabase Dashboard의 Redirect URL allow list에 포함됐는지(Task 2.2.3) 재확인.

- [ ] **Step 6.4.2: Commit**

```bash
git add .
git commit -m "feat(auth): add login page, OAuth callback, dashboard stub with logout"
```

### Task 6.5: Root 페이지 리다이렉트

Step 1.2.3에서 만든 shadcn 테스트 페이지를 실제 진입점으로 교체.

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 6.5.1: page.tsx를 dashboard로 리다이렉트로 변경**

```tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard');
}
```

> middleware가 인증 안 된 사용자를 `/login`으로 자동 바운스 → 결과적으로 `/`는 미인증 시 `/login`, 인증 시 `/dashboard`로 가는 단일 진입점.

- [ ] **Step 6.5.2: 동작 확인**

`pnpm dev` → http://localhost:3000 → 자동 `/login` 또는 `/dashboard` 이동 확인.

- [ ] **Step 6.5.3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(routing): root redirects to dashboard (auth-gated by middleware)"
```

---

## Chunk 7: Vitest 셋업 + RLS Isolation Test + 배포 검증

**목표:** Vitest 셋업, RLS 정책 격리 테스트 1개, 린트/타입체크 통과, Vercel 프로덕션 배포 검증.

### Task 7.1: Vitest 셋업

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`

- [ ] **Step 7.1.1: 패키지 설치 (Phase 0+1 범위)**

```bash
pnpm add -D vitest @vitest/ui dotenv
```

> 컴포넌트 테스트용 `@testing-library/react`, `jsdom` 등은 Phase 3 UI 작업 시작할 때 추가 예정. Playwright는 Phase 7에서 별도 설치.

- [ ] **Step 7.1.2: vitest.config.ts 작성**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // globals: true 사용 안 함 — 각 테스트에서 명시적 import (IDE 자동완성/네비 더 잘 됨)
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 7.1.3: 테스트 setup 파일**

`tests/setup.ts`:
```typescript
import { config } from 'dotenv';
config({ path: '.env.local' });
```

- [ ] **Step 7.1.4: package.json scripts 추가**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### Task 7.2: RLS Isolation 테스트

**Files:**
- Create: `tests/rls/isolation.test.ts`

> **이 테스트가 검증하는 것:**
> 1. User A가 본인 user_id로 exercise INSERT
> 2. User B로 로그인한 클라이언트로 exercises 조회 → A의 row가 안 보여야 함
> 3. 테스트 후 두 사용자 cleanup
>
> **사용 Supabase: 클라우드** (`.env.local`에 클라우드 URL/key 가정 — Environment Strategy 섹션 참조)

- [ ] **Step 7.2.1: 테스트 helper 작성**

`tests/rls/helpers.ts`:
```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function adminClient(): SupabaseClient<Database> {
  return createClient<Database>(URL, SR, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** signInWithPassword로 새 사용자 만들고 sign-in한 client 반환 */
export async function createSignedInUser(label: string) {
  const admin = adminClient();
  const email = `test-${label}-${Date.now()}@example.com`;
  const password = 'TestPassword!1234';

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) throw createErr;
  const userId = created.user!.id;

  // 사용자 자신의 anon 클라이언트 (session 내부 보관)
  const userClient = createClient<Database>(URL, ANON);
  const { error: signInErr } = await userClient.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;

  return { userId, email, client: userClient };
}

export async function deleteUser(userId: string) {
  const admin = adminClient();
  await admin.auth.admin.deleteUser(userId);
}
```

- [ ] **Step 7.2.2: RLS isolation 테스트 작성**

`tests/rls/isolation.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createSignedInUser, deleteUser } from './helpers';

describe('RLS isolation: 본인 외 exercises 접근 차단', () => {
  let userA: Awaited<ReturnType<typeof createSignedInUser>>;
  let userB: Awaited<ReturnType<typeof createSignedInUser>>;

  beforeAll(async () => {
    userA = await createSignedInUser('a');
    userB = await createSignedInUser('b');

    // User A가 자기 운동 1개 INSERT (트리거가 user_id 자동 주입)
    const { error } = await userA.client
      .from('exercises')
      .insert({ name: 'Test Exercise A', equipment: 'machine' });
    if (error) throw error;
  }, 30_000);

  afterAll(async () => {
    if (userA) await deleteUser(userA.userId);
    if (userB) await deleteUser(userB.userId);
  });

  it('User A는 자기 exercises를 볼 수 있다 (positive control)', async () => {
    const { data, error } = await userA.client.from('exercises').select('*');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].name).toBe('Test Exercise A');
    expect(data?.[0].user_id).toBe(userA.userId); // 트리거 자동 주입 검증
  });

  it('User B는 User A의 exercises를 볼 수 없다 (RLS isolation)', async () => {
    const { data, error } = await userB.client.from('exercises').select('*');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('User B는 user_id를 위조해서도 A의 row를 못 본다', async () => {
    const { data } = await userB.client
      .from('exercises')
      .select('*')
      .eq('user_id', userA.userId);
    expect(data).toEqual([]);
  });
});
```

- [ ] **Step 7.2.3: 테스트 실행**

```bash
pnpm test
```
PASS 확인. 실패 시:
- RLS 정책이 클라우드에 적용 안 됐을 가능성 → `supabase db push` 재확인
- 트리거가 동작 안 했을 가능성 → `userA.client`에 session이 제대로 세팅됐는지 (signInWithPassword 응답 확인)
- service_role key가 anon key와 바뀌었을 가능성 → `.env.local` 점검

- [ ] **Step 7.2.4: Commit**

```bash
git add tests/
git commit -m "test(rls): verify cross-user exercise isolation"
```

### Task 7.3: 린트/타입 체크

- [ ] **Step 7.3.1: TypeScript 타입 체크 통과**

```bash
pnpm tsc --noEmit
```
에러 0개 확인. 에러 있으면 수정 후 재실행.

- [ ] **Step 7.3.2: 빌드 통과**

```bash
pnpm build
```
빌드 성공 확인. 환경변수 누락 등 발견되면 수정.

### Task 7.4: Vercel 프로덕션 배포 검증

- [ ] **Step 7.4.1: main에 푸시 → Vercel 자동 배포**

```bash
git push
```

Vercel Dashboard에서 배포 진행 → 성공 확인.

- [ ] **Step 7.4.2: 프로덕션 URL에서 OAuth 동작 검증**

배포된 URL (예: `https://ounwan.vercel.app`) 방문:
- `/login` 페이지 표시
- "Google로 로그인" → 동의 화면 → 콜백 → `/dashboard` 표시 + 이메일 확인
- "로그아웃" → `/login`

⚠️ Google OAuth Authorized redirect URIs에 Vercel 도메인의 Supabase callback도 추가되어 있어야 함 (Task 2.2.1 참조).

- [ ] **Step 7.4.3: 최종 commit + tag**

```bash
git tag v0.1.0-foundation -m "Phase 0+1 foundation: bootstrap + data layer + auth"
git push --tags
```

---

## Completion Criteria

이 플랜이 완료되었다고 판단되려면:

- [ ] Vercel 프로덕션 URL에서 Google OAuth 로그인/로그아웃 동작
- [ ] Supabase 클라우드 DB에 8개 테이블 + RLS + 트리거 + body_parts 8행 시드 적용
- [ ] `pnpm gen:types` 정상 동작 → `src/types/database.types.ts` 최신
- [ ] `pnpm test` 통과 (최소 RLS isolation 1개)
- [ ] `pnpm tsc --noEmit` 에러 0
- [ ] `pnpm build` 성공
- [ ] Git 태그 `v0.1.0-foundation` 푸시됨

## Deferred to Later Phases (의도적 제외)

| 항목 | 어디로 | 이유 |
|------|--------|------|
| Playwright E2E | Phase 7 | UI 완성 후 작성이 합리적 |
| `persistQueryClient` (TanStack Query 영속) | Phase 6 | PWA + offline 대응 단계에서 함께 셋업 |
| `app/error.tsx`, `app/global-error.tsx` | Phase 5/7 | UI 완성 단계에서 디자인 통일 후 추가 |
| `/seeds/`, `/scripts/` 디렉토리 (ADR-004) | Phase 2 | 카톡 임포트 작업 시작 시 생성 |
| `body_compositions`, `body_photos` 테이블 | 추후 ADR-009/010 | MVP 비목표 |
| 컴포넌트 단위 테스트 (`@testing-library/react`) | Phase 3 | UI 컴포넌트 생기는 시점에 추가 |

## Next Plan Preview

Plan 2 후보 (별도 문서):
- **Phase 2: 카톡 데이터 임포트** (ADR-004 절차 — exercises 카탈로그 생성 → 세션 데이터 파싱 → Markdown 검증 → SQL 임포트)

또는

- **Phase 3a: 운동 시작 페이지 + 추천 알고리즘** (Phase 3의 첫 sub-chunk)

Plan 2는 본 플랜 완료 후 작성. spec과 ADR을 갱신하면서 진행.

## References
- Spec: `docs/specs/2026-05-22-gym-routine-app-design.md`
- ADRs: `docs/adr/001-008`
- Supabase Auth (Next.js App Router): https://supabase.com/docs/guides/auth/server-side/nextjs
- TanStack Query SSR: https://tanstack.com/query/latest/docs/framework/react/guides/ssr
