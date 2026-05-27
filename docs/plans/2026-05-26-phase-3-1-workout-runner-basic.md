# Phase 3.1: Workout Runner Basic (3a + 3b) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 헬스장에서 모바일로 "오늘 뭐 할까" → 부위 조합 선택 → 자동 추천 받기 → 세션 시작 → 세트별 무게/회수 입력 → 세션 종료까지 끊김 없이 동작하는 최소 기능 워크아웃 러너 구현.

**Architecture:** Next.js App Router 하이브리드 패턴 (ADR-007). RSC가 초기 데이터 prefetch + dehydrate, Client Component(`'use client'`)가 TanStack Query로 hydrate + `useMutation` optimistic update. 추천 로직은 순수 함수로 분리해 단위 테스트. Server Actions로 세션 생성 + 루틴 템플릿 저장.

**Tech Stack:** Next.js 16 (App Router) / React 19 / TypeScript 5 / `@supabase/ssr` / `@supabase/supabase-js` v2 / `@tanstack/react-query` v5 / Tailwind CSS v4 / shadcn/ui (base-nova) / `sonner` / Vitest (헬퍼 단위 테스트)

**Reference docs:**
- Spec: `docs/specs/2026-05-22-gym-routine-app-design.md` §3, §7 (추천 알고리즘), §10 Phase 3
- ADR-001: 부위 모델링 (M:N 정션)
- ADR-002: 드롭세트 (이번 plan에선 _저장 가능_하지만 UI는 Plan 3.2)
- ADR-003: side 컬럼 (이번 plan에선 default `both`만, UI는 Plan 3.2)
- ADR-007: TanStack Query + RSC 하이브리드
- ADR-008: per-user catalog (RLS 격리)

**완료 시점에 검증되는 것 (1차 PR):**

| 시나리오 | 동작 |
|---------|------|
| `/workout/new` 진입 | 부위 chip 토글 + (있으면) 저장된 분할 템플릿 chip 표시 |
| 부위 2개 이상 선택 후 "추천 보기" | 추천 알고리즘(spec §7)으로 운동 N개 미리보기 카드 |
| "이 분할 저장" 버튼 | `routine_templates` + `routine_template_body_parts` row 생성 |
| "운동 시작" 버튼 | `workout_sessions` row INSERT 후 `/workout/[sessionId]` 리다이렉트 |
| 세션 페이지 | 추천된 운동 리스트 + 운동당 빈 세트 카드 N개 (default_sets 기준) |
| 세트 카드 무게/회수 입력 + 체크 | optimistic UI 반영 < 100ms + DB INSERT + 실패 시 토스트 + 롤백 |
| "운동 종료" | `workout_sessions.ended_at` 업데이트 + 대시보드로 |
| 본인 로그인 상태에서만 접근 | middleware + RLS로 차단 |

**스코프 명시 — 이 plan에 포함 안 됨 (Plan 3.2):**
- ❌ 드롭세트 UI (저장은 가능하지만 "+드롭" 버튼 없음)
- ❌ 좌/우 분리 입력 (`side='both'` 고정)
- ❌ 휴식 타이머
- ❌ 지난번 기록 default 채우기 (그냥 빈 input)
- ❌ 운동 추가 (Phase 5)

> **PR1 머지 후 헬스장 1주일 실사용 → 피드백 반영해서 Plan 3.2 작성.**

---

## 데이터 흐름 한눈에

```
/workout/new
  ├─ RSC: prefetch (body_parts, routine_templates, exercises)
  ├─ <StartForm> 'use client'
  │    ├─ 부위 chip 토글 (선택된 body_part_id[])
  │    ├─ (선택) 저장된 템플릿 chip → 부위 자동 선택
  │    └─ "추천 보기" → recommendExercises(uid, bodyPartIds) (RSC route handler)
  │           → 후보 정렬 → 부위당 3개 → 미리보기
  └─ Server Action: startSession(bodyPartIds, recommendedExerciseIds, optional templateId)
        ├─ INSERT workout_sessions (started_at=now())
        └─ redirect(`/workout/${sessionId}`)

/workout/[sessionId]
  ├─ RSC: load session + selected exercises (route handler가 메모리에 추천 결과 다시 anchor)
  │  → 사실 추천 결과는 sessionStorage가 아니라 URL ?exercises=... 로 전달
  ├─ <SessionRunner> 'use client'
  │    ├─ 운동별 카드 N개 (default_sets만큼 빈 세트 row)
  │    ├─ 세트 input: weight (number), reps (number), 체크 버튼
  │    └─ useMutation(insertSet) — onMutate: cache 즉시 갱신, onError: 롤백
  └─ "운동 종료" → Server Action: finishSession(sessionId)
        ├─ UPDATE workout_sessions SET ended_at=now()
        └─ redirect('/dashboard')
```

---

## 데이터 모델 매핑 (이 plan에서 만들거나 쓰는 row 종류)

| 테이블 | INSERT/UPDATE 시점 | 비고 |
|--------|-------------------|------|
| `routine_templates` | "이 분할 저장" 버튼 누를 때만 | nullable — 안 저장해도 운동 가능 |
| `routine_template_body_parts` | 위와 동시 | M:N |
| `workout_sessions` | "운동 시작" | `routine_template_id` nullable, `started_at=now()` |
| `workout_sets` | 세트 체크 버튼 | `set_number` 클라이언트 계산, `parent_set_id=NULL`, `drop_order=0`, `side='both'` |

읽기 전용:
- `body_parts` (글로벌 8행)
- `exercises` + `exercise_body_parts` (per-user 73개)

---

## Chunk 1: Foundation

**목표:** 브랜치 생성 + 디렉토리 구조 + DB query 헬퍼 + recommendation 모듈 placeholder. 이 chunk 끝에서 빈 페이지로 라우팅만 동작.

### Task 1.1: 브랜치 + 폴더 구조

**Files:**
- Create dirs: `src/app/workout/new/`, `src/app/workout/[sessionId]/`, `src/lib/queries/`, `src/lib/workout/`
- Create empty placeholder: `src/lib/workout/recommendation.ts`

- [ ] **Step 1.1.1: 브랜치 생성**

```bash
cd "/Users/jeonhyejin/Desktop/사이드프로젝트/gym-routine-app"
git checkout main && git pull
git checkout -b feat/phase-3-1-workout-runner-basic
```

- [ ] **Step 1.1.2: 디렉토리 생성**

```bash
mkdir -p src/app/workout/new src/app/workout/\[sessionId\] src/lib/queries src/lib/workout tests/workout
```

- [ ] **Step 1.1.3: shadcn 컴포넌트 미리 add (필요한 것만)**

이 plan에서 사용할 shadcn 컴포넌트: `checkbox`, `badge`, `separator`, `dialog`. (기존: button, card, input, label, skeleton, sonner)

```bash
pnpm dlx shadcn@latest add checkbox badge separator dialog
```

Expected: `src/components/ui/{checkbox,badge,separator,dialog}.tsx` 4개 파일 생성. 충돌 시 "overwrite? n"으로 skip.

- [ ] **Step 1.1.4: 커밋**

```bash
git add src/components/ui/
git commit -m "chore(phase-3-1): add shadcn checkbox/badge/separator/dialog"
```

---

### Task 1.2: DB query 헬퍼 (RSC용)

**Files:**
- Create: `src/lib/queries/body-parts.ts` — `fetchBodyParts()` 글로벌 부위
- Create: `src/lib/queries/exercises.ts` — `fetchUserExercises()` (RSC) + 클라이언트 쿼리키 상수
- Create: `src/lib/queries/templates.ts` — `fetchUserTemplates()` (RSC) + 쿼리키
- Create: `src/lib/queries/sessions.ts` — `fetchSession(sessionId)` + 쿼리키
- Create: `src/lib/queries/sets.ts` — `fetchSessionSets(sessionId)` + 쿼리키 + insert helper

**원칙:**
- RSC fetch 함수는 `lib/supabase/server.ts`의 `createClient()`만 사용
- Client용 mutation/query는 `lib/supabase/client.ts`의 `createClient()` 사용
- 쿼리키는 export 상수로 (양쪽이 같은 값 써야 hydration 매칭됨)

- [ ] **Step 1.2.1: `src/lib/queries/body-parts.ts` 작성**

```typescript
// src/lib/queries/body-parts.ts
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type BodyPart = Tables<"body_parts">;

export const BODY_PARTS_QUERY_KEY = ["body-parts"] as const;

/** RSC fetch — 글로벌 부위 8행, 정렬됨 */
export async function fetchBodyParts(): Promise<BodyPart[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("body_parts")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
```

- [ ] **Step 1.2.2: `src/lib/queries/exercises.ts` 작성**

```typescript
// src/lib/queries/exercises.ts
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type Exercise = Tables<"exercises">;
export type ExerciseBodyPart = Tables<"exercise_body_parts">;
export type ExerciseWithBodyParts = Exercise & {
  exercise_body_parts: ExerciseBodyPart[];
};

export const exercisesQueryKey = (userId: string) =>
  ["exercises", userId] as const;

/** RSC fetch — 본인 운동 + body_part 매핑 일괄 */
export async function fetchUserExercises(
  userId: string,
): Promise<ExerciseWithBodyParts[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select("*, exercise_body_parts(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ExerciseWithBodyParts[];
}
```

- [ ] **Step 1.2.3: `src/lib/queries/templates.ts` 작성**

```typescript
// src/lib/queries/templates.ts
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type RoutineTemplate = Tables<"routine_templates">;
export type RoutineTemplateBodyPart = Tables<"routine_template_body_parts">;
export type TemplateWithBodyParts = RoutineTemplate & {
  routine_template_body_parts: RoutineTemplateBodyPart[];
};

export const templatesQueryKey = (userId: string) =>
  ["templates", userId] as const;

export async function fetchUserTemplates(
  userId: string,
): Promise<TemplateWithBodyParts[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("routine_templates")
    .select("*, routine_template_body_parts(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TemplateWithBodyParts[];
}
```

- [ ] **Step 1.2.4: `src/lib/queries/sessions.ts` 작성**

```typescript
// src/lib/queries/sessions.ts
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type WorkoutSession = Tables<"workout_sessions">;

export const sessionQueryKey = (sessionId: string) =>
  ["session", sessionId] as const;

export async function fetchSession(
  sessionId: string,
): Promise<WorkoutSession | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 1.2.5: `src/lib/queries/sets.ts` 작성**

```typescript
// src/lib/queries/sets.ts
import { createClient } from "@/lib/supabase/server";
import type { Tables, TablesInsert } from "@/types/database.types";

export type WorkoutSet = Tables<"workout_sets">;
export type WorkoutSetInsert = TablesInsert<"workout_sets">;

/** 추천 알고리즘이 쓰는 최소 형태 */
export type RecentSetSummary = {
  exercise_id: string;
  created_at: string;
};

export const setsQueryKey = (sessionId: string) =>
  ["sets", sessionId] as const;

export async function fetchSessionSets(
  sessionId: string,
): Promise<WorkoutSet[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_sets")
    .select("*")
    .eq("session_id", sessionId)
    .order("exercise_id", { ascending: true })
    .order("set_number", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * 본인의 최근 N일 메인 세트만 (드롭 제외, 추천 알고리즘용).
 * workout_sessions!inner JOIN으로 user_id 필터 + RLS 격리.
 *
 * 주: `created_at`을 "마지막 사용일" 프록시로 사용. spec §7은 "마지막 사용일"이
 * 엄밀히는 `workout_sessions.started_at`이지만, 같은 세션 내 sets은 분 단위
 * 차이라 추천 정렬에 영향 없음 (Plan 3.2에서 정합성 점검 가능).
 */
export async function fetchRecentSets(
  userId: string,
  daysBack: number,
): Promise<RecentSetSummary[]> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - daysBack * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("workout_sets")
    .select("exercise_id, created_at, workout_sessions!inner(user_id)")
    .eq("workout_sessions.user_id", userId)
    .is("parent_set_id", null)
    .gte("created_at", cutoff);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    exercise_id: r.exercise_id,
    created_at: r.created_at ?? new Date(0).toISOString(),
  }));
}
```

- [ ] **Step 1.2.6: TypeCheck**

```bash
pnpm tsc --noEmit
```

Expected: 에러 0개.

- [ ] **Step 1.2.7: 커밋**

```bash
git add src/lib/queries/
git commit -m "feat(phase-3-1): add RSC query helpers + query keys for exercises/templates/sessions/sets"
```

---

## Chunk 2: Recommendation Algorithm (TDD)

**목표:** Spec §7의 추천 알고리즘을 순수 함수로 구현 + Vitest 단위 테스트. UI 없이 입출력만 검증.

### Task 2.1: 함수 시그니처 + 테스트 fixture

**Files:**
- Create: `src/lib/workout/recommendation.ts`
- Create: `tests/workout/recommendation.test.ts`

**알고리즘 명세 (spec §7):**

```
INPUT: {
  bodyPartIds: number[],                  // 사용자가 선택한 부위
  exercises: ExerciseWithBodyParts[],     // 본인 카탈로그 전체
  recentSets: SetWithDate[],              // 최근 30일 메인 세트 (created_at 포함)
  perBodyPart: number = 3                 // 부위당 추천 개수
}

OUTPUT: {
  exerciseId: UUID,
  primaryBodyPartId: number,
  lastUsedAt: ISOString | null,           // 마지막 사용일 (UI 디버깅용)
  recentUsageCount: number,               // 최근 30일 빈도
}[]

알고리즘:
1. exercises 중 body_parts에 해당 부위가 있고, is_primary=true인 운동만 후보
2. 후보를 (primaryBodyPartId 기준) 그룹핑
3. 각 그룹 내에서 정렬:
   - 1순위: 최근 30일 사용 빈도 desc (자주 하는 것 우선)
   - 2순위: 마지막 사용일 asc (오래된 것 우선 — 회전)
   - 3순위: 카탈로그 등록 순 (created_at asc, deterministic tiebreaker)
4. 각 그룹에서 상위 perBodyPart개 선택
5. 결과 평탄화
```

- [ ] **Step 2.1.1: 함수 시그니처 stub 작성**

```typescript
// src/lib/workout/recommendation.ts
import type { ExerciseWithBodyParts } from "@/lib/queries/exercises";
import type { RecentSetSummary } from "@/lib/queries/sets";

export type Recommendation = {
  exerciseId: string;
  primaryBodyPartId: number;
  lastUsedAt: string | null;
  recentUsageCount: number;
};

export type RecommendInput = {
  bodyPartIds: number[];
  exercises: ExerciseWithBodyParts[];
  recentSets: RecentSetSummary[];
  perBodyPart?: number;
};

export function recommendExercises(_: RecommendInput): Recommendation[] {
  throw new Error("not implemented");
}
```

- [ ] **Step 2.1.2: 테스트 fixture + 첫 테스트 (RED)**

```typescript
// tests/workout/recommendation.test.ts
import { describe, it, expect } from "vitest";
import {
  recommendExercises,
  type RecommendInput,
} from "@/lib/workout/recommendation";
import type { ExerciseWithBodyParts } from "@/lib/queries/exercises";

function makeEx(
  id: string,
  primaryBP: number,
  createdDaysAgo = 100,
): ExerciseWithBodyParts {
  const createdAt = new Date(
    Date.now() - createdDaysAgo * 86_400_000,
  ).toISOString();
  return {
    id,
    user_id: "u",
    name: `ex-${id}`,
    equipment: "machine",
    is_unilateral: false,
    parent_exercise_id: null,
    default_sets: 3,
    default_reps_min: 8,
    default_reps_max: 12,
    notes: null,
    created_at: createdAt,
    exercise_body_parts: [
      {
        exercise_id: id,
        body_part_id: primaryBP,
        is_primary: true,
      },
    ],
  };
}

function set(exerciseId: string, daysAgo: number) {
  return {
    exercise_id: exerciseId,
    created_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
  };
}

describe("recommendExercises", () => {
  it("선택된 부위에 해당하는 primary 운동만 후보로 삼는다", () => {
    const input: RecommendInput = {
      bodyPartIds: [1], // chest
      exercises: [
        makeEx("a", 1), // chest primary
        makeEx("b", 2), // back primary — 제외 대상
      ],
      recentSets: [],
      perBodyPart: 3,
    };
    const result = recommendExercises(input);
    expect(result.map((r) => r.exerciseId)).toEqual(["a"]);
  });
});
```

- [ ] **Step 2.1.3: 테스트 실행 (FAIL 확인)**

```bash
pnpm vitest run tests/workout/recommendation.test.ts
```

Expected: `Error: not implemented` 또는 assertion 실패. 테스트 인프라가 동작함을 확인.

---

### Task 2.2: 구현 + 추가 케이스

- [ ] **Step 2.2.1: 최소 구현 (GREEN)**

```typescript
// src/lib/workout/recommendation.ts (replace stub body)
export function recommendExercises({
  bodyPartIds,
  exercises,
  recentSets,
  perBodyPart = 3,
}: RecommendInput): Recommendation[] {
  // 1) 후보 필터: 선택 부위 중 하나라도 primary로 매칭되는 운동
  const candidates = exercises
    .map((ex) => {
      const primaryBP = ex.exercise_body_parts.find(
        (m) => m.is_primary && bodyPartIds.includes(m.body_part_id),
      );
      return primaryBP ? { ex, primaryBP: primaryBP.body_part_id } : null;
    })
    .filter((x): x is { ex: ExerciseWithBodyParts; primaryBP: number } => !!x);

  // 2) 운동별 사용 통계 (최근 30일)
  const THIRTY_DAYS_AGO = Date.now() - 30 * 86_400_000;
  const stats = new Map<
    string,
    { recentCount: number; lastUsedAt: string | null }
  >();
  for (const s of recentSets) {
    const ts = new Date(s.created_at).getTime();
    if (ts < THIRTY_DAYS_AGO) continue;
    const prev = stats.get(s.exercise_id) ?? {
      recentCount: 0,
      lastUsedAt: null,
    };
    prev.recentCount += 1;
    if (!prev.lastUsedAt || s.created_at > prev.lastUsedAt) {
      prev.lastUsedAt = s.created_at;
    }
    stats.set(s.exercise_id, prev);
  }

  // 3) 부위별 그룹핑 + 정렬
  const grouped = new Map<number, typeof candidates>();
  for (const c of candidates) {
    const arr = grouped.get(c.primaryBP) ?? [];
    arr.push(c);
    grouped.set(c.primaryBP, arr);
  }

  const out: Recommendation[] = [];
  for (const bpId of bodyPartIds) {
    const arr = grouped.get(bpId) ?? [];
    arr.sort((a, b) => {
      const sa = stats.get(a.ex.id) ?? { recentCount: 0, lastUsedAt: null };
      const sb = stats.get(b.ex.id) ?? { recentCount: 0, lastUsedAt: null };
      // 1순위 desc
      if (sa.recentCount !== sb.recentCount) {
        return sb.recentCount - sa.recentCount;
      }
      // 2순위 asc (오래된 것이 위로) — null은 가장 오래된 것으로 간주
      const la = sa.lastUsedAt ?? "0";
      const lb = sb.lastUsedAt ?? "0";
      if (la !== lb) return la < lb ? -1 : 1;
      // 3순위 (deterministic)
      return a.ex.created_at < b.ex.created_at ? -1 : 1;
    });
    for (const c of arr.slice(0, perBodyPart)) {
      const s = stats.get(c.ex.id) ?? { recentCount: 0, lastUsedAt: null };
      out.push({
        exerciseId: c.ex.id,
        primaryBodyPartId: c.primaryBP,
        lastUsedAt: s.lastUsedAt,
        recentUsageCount: s.recentCount,
      });
    }
  }
  return out;
}
```

- [ ] **Step 2.2.2: 첫 테스트 PASS 확인**

```bash
pnpm vitest run tests/workout/recommendation.test.ts
```

Expected: 1 passed.

- [ ] **Step 2.2.3: 빈도 정렬 테스트 추가**

```typescript
// tests/workout/recommendation.test.ts 끝에 추가
it("최근 30일 빈도가 높은 운동을 우선한다", () => {
  const input: RecommendInput = {
    bodyPartIds: [1],
    exercises: [makeEx("a", 1), makeEx("b", 1), makeEx("c", 1)],
    recentSets: [
      set("b", 1),
      set("b", 5),
      set("b", 10),
      set("c", 2),
      // a는 0회
    ],
    perBodyPart: 3,
  };
  const result = recommendExercises(input);
  expect(result.map((r) => r.exerciseId)).toEqual(["b", "c", "a"]);
});
```

- [ ] **Step 2.2.4: 회전 정렬 (빈도 동률 → 오래된 것 우선) 테스트**

```typescript
it("빈도가 같으면 마지막 사용일이 더 오래된 운동을 우선한다", () => {
  const input: RecommendInput = {
    bodyPartIds: [1],
    exercises: [makeEx("a", 1), makeEx("b", 1)],
    recentSets: [
      set("a", 2), // 더 최근
      set("b", 20), // 더 오래됨 → 우선
    ],
    perBodyPart: 2,
  };
  const result = recommendExercises(input);
  expect(result.map((r) => r.exerciseId)).toEqual(["b", "a"]);
});
```

- [ ] **Step 2.2.5: 30일 이전 기록은 무시**

```typescript
it("30일 이전 기록은 빈도 카운트에서 제외한다", () => {
  const input: RecommendInput = {
    bodyPartIds: [1],
    exercises: [makeEx("a", 1), makeEx("b", 1)],
    recentSets: [
      set("a", 5), // 30일 이내, 빈도 1
      set("b", 40), // 30일 초과 → 무시
      set("b", 45), // 30일 초과 → 무시
    ],
    perBodyPart: 2,
  };
  const result = recommendExercises(input);
  // a: recent=1, b: recent=0 → a 먼저
  expect(result[0].exerciseId).toBe("a");
  expect(result[0].recentUsageCount).toBe(1);
  expect(result[1].recentUsageCount).toBe(0);
});
```

- [ ] **Step 2.2.6: 부위당 N개 제한**

```typescript
it("perBodyPart 개수만큼만 부위별로 선택한다", () => {
  const input: RecommendInput = {
    bodyPartIds: [1, 2],
    exercises: [
      makeEx("c1", 1),
      makeEx("c2", 1),
      makeEx("c3", 1),
      makeEx("c4", 1),
      makeEx("b1", 2),
      makeEx("b2", 2),
    ],
    recentSets: [],
    perBodyPart: 2,
  };
  const result = recommendExercises(input);
  const chest = result.filter((r) => r.primaryBodyPartId === 1);
  const back = result.filter((r) => r.primaryBodyPartId === 2);
  expect(chest).toHaveLength(2);
  expect(back).toHaveLength(2);
});
```

- [ ] **Step 2.2.7: secondary body_part는 후보에서 제외**

```typescript
it("is_primary=false인 매핑은 후보에서 제외한다", () => {
  const ex: ExerciseWithBodyParts = {
    ...makeEx("dl", 2), // back primary
    exercise_body_parts: [
      { exercise_id: "dl", body_part_id: 2, is_primary: true }, // 등 primary
      { exercise_id: "dl", body_part_id: 6, is_primary: false }, // 하체 secondary
    ],
  };
  const input: RecommendInput = {
    bodyPartIds: [6], // 하체
    exercises: [ex],
    recentSets: [],
    perBodyPart: 3,
  };
  const result = recommendExercises(input);
  expect(result).toHaveLength(0); // 하체 primary 운동 없음
});
```

- [ ] **Step 2.2.8: 전체 테스트 PASS 확인**

```bash
pnpm vitest run tests/workout/recommendation.test.ts
```

Expected: 5 passed.

- [ ] **Step 2.2.9: TypeCheck + lint**

```bash
pnpm tsc --noEmit && pnpm lint
```

Expected: 에러 0개.

- [ ] **Step 2.2.10: 커밋**

```bash
git add src/lib/workout/recommendation.ts tests/workout/recommendation.test.ts
git commit -m "feat(phase-3-1): recommendExercises pure function with Vitest coverage"
```

---

## Chunk 3: /workout/new — UI (Phase 3a)

**목표:** 부위 chip 토글 + 저장된 템플릿 chip + 추천 미리보기 + "분할 저장"/"운동 시작" 버튼. RSC가 데이터 prefetch, 클라이언트 컴포넌트가 인터랙션 처리.

### Task 3.1: RSC 페이지 + Hydration

**Files:**
- Create: `src/app/workout/new/page.tsx` (RSC)
- Create: `src/app/workout/new/StartForm.tsx` ('use client')
- Create: `src/app/workout/new/start-form-types.ts` (props 타입)

- [ ] **Step 3.1.1: RSC page.tsx 작성**

```typescript
// src/app/workout/new/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchBodyParts } from "@/lib/queries/body-parts";
import { fetchUserExercises } from "@/lib/queries/exercises";
import { fetchUserTemplates } from "@/lib/queries/templates";
import { fetchRecentSets } from "@/lib/queries/sets";
import { StartForm } from "./StartForm";

export default async function NewWorkoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [bodyParts, exercises, templates, recentSets] = await Promise.all([
    fetchBodyParts(),
    fetchUserExercises(user.id),
    fetchUserTemplates(user.id),
    fetchRecentSets(user.id, 30),
  ]);

  return (
    <main className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">운동 시작</h1>
      <StartForm
        userId={user.id}
        bodyParts={bodyParts}
        exercises={exercises}
        templates={templates}
        recentSets={recentSets}
      />
    </main>
  );
}
```

- [ ] **Step 3.1.2: StartForm 타입 분리**

```typescript
// src/app/workout/new/start-form-types.ts
import type { BodyPart } from "@/lib/queries/body-parts";
import type { ExerciseWithBodyParts } from "@/lib/queries/exercises";
import type { TemplateWithBodyParts } from "@/lib/queries/templates";
import type { RecentSetSummary } from "@/lib/queries/sets";

export type StartFormProps = {
  userId: string;
  bodyParts: BodyPart[];
  exercises: ExerciseWithBodyParts[];
  templates: TemplateWithBodyParts[];
  recentSets: RecentSetSummary[];
};
```

- [ ] **Step 3.1.3: StartForm.tsx 작성 (부위 chip 토글까지)**

```typescript
// src/app/workout/new/StartForm.tsx
"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { recommendExercises } from "@/lib/workout/recommendation";
import type { StartFormProps } from "./start-form-types";

export function StartForm({
  bodyParts,
  exercises,
  templates,
  recentSets,
}: StartFormProps) {
  const [selectedBP, setSelectedBP] = useState<Set<number>>(new Set());
  const [showRecommendations, setShowRecommendations] = useState(false);

  const toggleBP = (id: number) => {
    setSelectedBP((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setShowRecommendations(false);
  };

  const recommendations = useMemo(() => {
    if (selectedBP.size === 0) return [];
    return recommendExercises({
      bodyPartIds: [...selectedBP],
      exercises,
      recentSets,
      perBodyPart: 3,
    });
  }, [selectedBP, exercises, recentSets]);

  const exerciseById = useMemo(() => {
    const m = new Map(exercises.map((e) => [e.id, e]));
    return m;
  }, [exercises]);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-semibold mb-2 text-muted-foreground">
          부위 선택
        </h2>
        <div className="flex flex-wrap gap-2">
          {bodyParts.map((bp) => {
            const selected = selectedBP.has(bp.id);
            return (
              <button
                key={bp.id}
                type="button"
                onClick={() => toggleBP(bp.id)}
                className={
                  "px-3 py-2 rounded-full border text-sm transition-colors " +
                  (selected
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-border hover:bg-muted")
                }
              >
                {bp.name_ko}
              </button>
            );
          })}
        </div>
      </section>

      {templates.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground">
            저장된 분할
          </h2>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <Badge
                key={t.id}
                variant="outline"
                className="cursor-pointer px-3 py-1.5"
                onClick={() => {
                  setSelectedBP(
                    new Set(
                      t.routine_template_body_parts.map((m) => m.body_part_id),
                    ),
                  );
                  setShowRecommendations(false);
                }}
              >
                {t.name}
              </Badge>
            ))}
          </div>
        </section>
      )}

      <Separator />

      <Button
        type="button"
        variant="outline"
        disabled={selectedBP.size === 0}
        onClick={() => setShowRecommendations(true)}
      >
        추천 보기 ({selectedBP.size}개 부위)
      </Button>

      {showRecommendations && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            추천 운동 ({recommendations.length}개)
          </h2>
          {recommendations.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                선택한 부위의 운동이 카탈로그에 없습니다.
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-2">
              {recommendations.map((r) => {
                const ex = exerciseById.get(r.exerciseId);
                if (!ex) return null;
                return (
                  <li
                    key={r.exerciseId}
                    className="rounded-md border p-3 text-sm"
                  >
                    <div className="font-medium">{ex.name}</div>
                    <div className="text-xs text-muted-foreground">
                      기본 {ex.default_sets ?? 3}세트
                      {ex.default_reps_min && ex.default_reps_max
                        ? ` · ${ex.default_reps_min}~${ex.default_reps_max}회`
                        : ""}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Server Actions은 Task 3.2에서 wiring */}
      <div className="space-y-2">
        <Button
          type="button"
          className="w-full"
          disabled={
            selectedBP.size === 0 ||
            !showRecommendations ||
            recommendations.length === 0
          }
        >
          운동 시작
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={selectedBP.size === 0}
        >
          이 분할 저장
        </Button>
      </div>
    </div>
  );
}
```

> 주: `StartFormProps`의 `userId`는 사용하지 않습니다 (Server Action이 자체적으로 `auth.getUser()` 재호출). 타입에 남겨두지만 컴포넌트 시그니처에서는 destructure 안 함 (위 코드 참조).

- [ ] **Step 3.1.4: 대시보드에 진입 링크 추가**

```typescript
// src/app/dashboard/page.tsx 수정: <Button> 위에 운동 시작 링크 추가
import Link from "next/link";
// ...
// <p className="mb-4">로그인됨: {user.email}</p> 다음에
// <Link href="/workout/new" className="block mb-4">
//   <Button className="w-full" size="lg">운동 시작</Button>
// </Link>
```

```typescript
// 정확한 patch
```

수정 위치를 Edit 도구로 정확히 만들기 위해 다음 명령:

```bash
# 현재 dashboard/page.tsx 보고
cat src/app/dashboard/page.tsx
```

그리고 `<form action={signOut}>` 위에 다음을 삽입:

```tsx
<Link href="/workout/new" className="block mb-4">
  <Button className="w-full" size="lg">운동 시작</Button>
</Link>
```

상단 import에 `import Link from "next/link";` 추가.

- [ ] **Step 3.1.5: dev 서버에서 시각 확인**

```bash
pnpm dev
```

브라우저: `http://localhost:3000/dashboard` → "운동 시작" 클릭 → `/workout/new` 진입 → 부위 chip 토글 + 추천 보기 동작 시각 확인.

→ **Ctrl+C로 dev 서버 종료.**

- [ ] **Step 3.1.6: TypeCheck + lint + 커밋**

```bash
pnpm tsc --noEmit && pnpm lint
git add src/app/workout/ src/app/dashboard/page.tsx
git commit -m "feat(phase-3-1): /workout/new — body part picker + template chip + recommendation preview"
```

---

### Task 3.2: Server Actions — startSession + saveTemplate

**Files:**
- Create: `src/app/workout/actions.ts` — Server Actions

**왜 Server Actions:** RLS가 auth.uid()로 본인 데이터만 INSERT 가능. service_role 불필요. `redirect()`를 RSC 컨텍스트에서 호출 가능.

**Server Action 반환 컨벤션 (이 파일 전체):**

- 검증 실패 / 비즈니스 에러 → `{ ok: false, error: string }` 반환 (throw 안 함)
- 성공 + 페이지 머무름 → `{ ok: true, ...payload }` 반환
- 성공 + 리다이렉트 필요 → `redirect()` 호출 (Next.js가 내부 throw로 처리, 클라이언트는 그냥 await 후 throw 자연 전파)
- 예측 못한 시스템 에러 → 그대로 throw (Next.js error boundary가 잡음)

이 컨벤션 덕분에 **클라이언트에서 try/catch 불필요**. `NEXT_REDIRECT` 메시지 매칭 같은 fragile pattern 회피.

- [ ] **Step 3.2.1: actions.ts 작성**

```typescript
// src/app/workout/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type StartSessionInput = {
  bodyPartIds: number[];
  recommendedExerciseIds: string[];
  templateId?: string | null;
};

export type StartSessionResult = { ok: false; error: string };

/**
 * 성공 시 redirect() 호출 → 클라이언트는 await 후 return value 도달 못함.
 * 실패 시 `{ ok: false, error }` 반환.
 */
export async function startSession(
  input: StartSessionInput,
): Promise<StartSessionResult> {
  if (input.recommendedExerciseIds.length === 0) {
    return { ok: false, error: "추천 운동이 비어있습니다" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: user.id, // TS Insert 타입이 require — trigger는 defense-in-depth로만
      routine_template_id: input.templateId ?? null,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("startSession failed", error);
    return { ok: false, error: "세션 생성 실패" };
  }

  // 추천된 운동 ID들을 URL query로 전달 (DB에 별도 row 만들지 않음 — 세트가 생기면 자연스럽게 anchor됨)
  const exParam = encodeURIComponent(input.recommendedExerciseIds.join(","));
  redirect(`/workout/${data.id}?exercises=${exParam}`);
}

export type SaveTemplateInput = {
  name: string;
  bodyPartIds: number[];
};

export type SaveTemplateResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function saveTemplate(
  input: SaveTemplateInput,
): Promise<SaveTemplateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인 필요" };

  const trimmed = input.name.trim();
  if (!trimmed) return { ok: false, error: "템플릿 이름이 비어있습니다" };
  if (input.bodyPartIds.length === 0) {
    return { ok: false, error: "부위를 1개 이상 선택하세요" };
  }

  const { data: tpl, error: tplErr } = await supabase
    .from("routine_templates")
    .insert({
      user_id: user.id, // TS Insert 타입 require
      name: trimmed,
    })
    .select("id")
    .single();
  if (tplErr || !tpl) {
    console.error("saveTemplate failed", tplErr);
    return { ok: false, error: "템플릿 저장 실패" };
  }

  const mappings = input.bodyPartIds.map((bp) => ({
    routine_template_id: tpl.id,
    body_part_id: bp,
  }));
  const { error: mapErr } = await supabase
    .from("routine_template_body_parts")
    .insert(mappings);
  if (mapErr) {
    console.error("saveTemplate mapping failed", mapErr);
    // best-effort 정리
    await supabase.from("routine_templates").delete().eq("id", tpl.id);
    return { ok: false, error: "템플릿 부위 매핑 실패" };
  }

  revalidatePath("/workout/new");
  return { ok: true, id: tpl.id };
}
```

- [ ] **Step 3.2.2: StartForm에 Server Actions wiring**

`src/app/workout/new/StartForm.tsx`의 "운동 시작" / "이 분할 저장" 버튼에 onClick 핸들러 + Dialog 추가.

추가할 import:
```typescript
import { startSession, saveTemplate } from "@/app/workout/actions";
import { toast } from "sonner";
import { useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
```

추가할 state:
```typescript
const [isPending, startTransition] = useTransition();
const [saveOpen, setSaveOpen] = useState(false);
const [templateName, setTemplateName] = useState("");
```

핸들러 (try/catch 없음 — Server Action이 return value로 에러 보고, redirect는 자연 전파):
```typescript
const handleStart = () => {
  startTransition(async () => {
    const result = await startSession({
      bodyPartIds: [...selectedBP],
      recommendedExerciseIds: recommendations.map((r) => r.exerciseId),
      templateId: null,
    });
    // 성공 시 redirect()로 페이지 떠나서 이 줄 도달 안 함.
    // 도달했다면 result는 반드시 { ok: false } — discriminated union으로 안전.
    if (result && result.ok === false) {
      toast.error(result.error);
    }
  });
};

const handleSave = () => {
  startTransition(async () => {
    const result = await saveTemplate({
      name: templateName,
      bodyPartIds: [...selectedBP],
    });
    if (result.ok === false) {
      toast.error(result.error);
      return;
    }
    toast.success("템플릿 저장됨");
    setSaveOpen(false);
    setTemplateName("");
  });
};
```

기존 "운동 시작" 버튼을 다음으로 변경:
```tsx
<Button
  type="button"
  className="w-full"
  disabled={
    isPending ||
    selectedBP.size === 0 ||
    !showRecommendations ||
    recommendations.length === 0
  }
  onClick={handleStart}
>
  {isPending ? "시작 중..." : "운동 시작"}
</Button>
```

"이 분할 저장" 버튼을 Dialog로 감싸기:
```tsx
<Dialog open={saveOpen} onOpenChange={setSaveOpen}>
  <DialogTrigger asChild>
    <Button
      type="button"
      variant="ghost"
      className="w-full"
      disabled={isPending || selectedBP.size === 0}
    >
      이 분할 저장
    </Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>분할 이름</DialogTitle>
    </DialogHeader>
    <div className="space-y-2">
      <Label htmlFor="tpl-name">예: 가슴+어깨</Label>
      <Input
        id="tpl-name"
        value={templateName}
        onChange={(e) => setTemplateName(e.target.value)}
        placeholder="가슴+어깨"
        autoFocus
      />
    </div>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="ghost" disabled={isPending}>
          취소
        </Button>
      </DialogClose>
      <Button onClick={handleSave} disabled={isPending || !templateName.trim()}>
        {isPending ? "저장 중..." : "저장"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 3.2.3: dev 서버에서 시각 확인 + 실제 INSERT**

```bash
pnpm dev
```

브라우저:
1. `/workout/new` 진입
2. 부위 2개 선택 → "추천 보기" → 미리보기 확인
3. "이 분할 저장" → 이름 입력 → 저장 → 토스트 + 페이지 새로고침 시 chip에 표시됨
4. "운동 시작" → `/workout/{uuid}?exercises=...` 로 이동 (404 페이지지만 URL은 정상)

→ Supabase Studio (Table Editor)에서 `workout_sessions` / `routine_templates` 새 row 확인.

→ **Ctrl+C로 dev 서버 종료.**

- [ ] **Step 3.2.4: TypeCheck + lint**

```bash
pnpm tsc --noEmit && pnpm lint
```

- [ ] **Step 3.2.5: 커밋**

```bash
git add src/app/workout/actions.ts src/app/workout/new/StartForm.tsx
git commit -m "feat(phase-3-1): startSession + saveTemplate Server Actions wired"
```

---

## Chunk 4: /workout/[sessionId] — Session Runner (Phase 3b)

**목표:** 세션 페이지에서 추천된 운동 N개와 운동별 빈 세트 카드 표시 + 무게/회수 입력 + optimistic mutation으로 INSERT + 세션 종료 버튼.

### Task 4.1: RSC 페이지 + 운동 ID 파라미터 hydration

**Files:**
- Create: `src/app/workout/[sessionId]/page.tsx` (RSC)
- Create: `src/app/workout/[sessionId]/SessionRunner.tsx` ('use client')

- [ ] **Step 4.1.1: page.tsx 작성**

```typescript
// src/app/workout/[sessionId]/page.tsx
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchSession } from "@/lib/queries/sessions";
import { fetchUserExercises } from "@/lib/queries/exercises";
import { fetchSessionSets } from "@/lib/queries/sets";
import { SessionRunner } from "./SessionRunner";

type PageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ exercises?: string }>;
};

export default async function SessionPage({
  params,
  searchParams,
}: PageProps) {
  const [{ sessionId }, { exercises: exParam }] = await Promise.all([
    params,
    searchParams,
  ]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const session = await fetchSession(sessionId);
  if (!session) notFound();
  if (session.user_id !== user.id) notFound(); // RLS도 막지만 명시

  const [allExercises, existingSets] = await Promise.all([
    fetchUserExercises(user.id),
    fetchSessionSets(sessionId),
  ]);

  const exerciseIds = exParam
    ? exParam.split(",").filter(Boolean)
    : [...new Set(existingSets.map((s) => s.exercise_id))];

  const selectedExercises = exerciseIds
    .map((id) => allExercises.find((e) => e.id === id))
    .filter(<T,>(x: T | undefined): x is T => !!x);

  return (
    <main className="p-4 max-w-md mx-auto pb-32">
      <SessionRunner
        session={session}
        exercises={selectedExercises}
        initialSets={existingSets}
      />
    </main>
  );
}
```

- [ ] **Step 4.1.2: SessionRunner skeleton (세트 INSERT 없이 표시만)**

```typescript
// src/app/workout/[sessionId]/SessionRunner.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { WorkoutSession } from "@/lib/queries/sessions";
import type { ExerciseWithBodyParts } from "@/lib/queries/exercises";
import type { WorkoutSet } from "@/lib/queries/sets";

type Props = {
  session: WorkoutSession;
  exercises: ExerciseWithBodyParts[];
  initialSets: WorkoutSet[];
};

type DraftSet = {
  setNumber: number;
  weightKg: string; // 입력 중간 상태는 문자열
  reps: string;
};

export function SessionRunner({ session, exercises, initialSets }: Props) {
  // exercise_id → drafted sets[]
  const [drafts, setDrafts] = useState<Record<string, DraftSet[]>>(() => {
    const out: Record<string, DraftSet[]> = {};
    for (const ex of exercises) {
      const existing = initialSets
        .filter((s) => s.exercise_id === ex.id && s.parent_set_id === null)
        .sort((a, b) => a.set_number - b.set_number);
      const n = ex.default_sets ?? 3;
      if (existing.length > 0) {
        out[ex.id] = existing.map((s) => ({
          setNumber: s.set_number,
          weightKg: s.weight_kg?.toString() ?? "",
          reps: s.reps?.toString() ?? "",
        }));
        // 부족하면 빈 세트 추가
        while (out[ex.id].length < n) {
          out[ex.id].push({
            setNumber: out[ex.id].length + 1,
            weightKg: "",
            reps: "",
          });
        }
      } else {
        out[ex.id] = Array.from({ length: n }, (_, i) => ({
          setNumber: i + 1,
          weightKg: "",
          reps: "",
        }));
      }
    }
    return out;
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">운동 진행 중</h1>
        <p className="text-xs text-muted-foreground">
          {new Date(session.started_at).toLocaleString("ko-KR")}
        </p>
      </header>

      {exercises.map((ex) => (
        <Card key={ex.id}>
          <CardHeader>
            <CardTitle className="text-base">{ex.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {drafts[ex.id].map((draft, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-sm"
              >
                <span className="w-8 text-muted-foreground">
                  {draft.setNumber}세트
                </span>
                <Input
                  inputMode="decimal"
                  type="number"
                  step="0.5"
                  placeholder="kg"
                  className="flex-1"
                  value={draft.weightKg}
                  onChange={(e) =>
                    setDrafts((prev) => {
                      const copy = { ...prev };
                      copy[ex.id] = [...copy[ex.id]];
                      copy[ex.id][idx] = { ...draft, weightKg: e.target.value };
                      return copy;
                    })
                  }
                />
                <span className="text-muted-foreground">×</span>
                <Input
                  inputMode="numeric"
                  type="number"
                  placeholder="회"
                  className="flex-1"
                  value={draft.reps}
                  onChange={(e) =>
                    setDrafts((prev) => {
                      const copy = { ...prev };
                      copy[ex.id] = [...copy[ex.id]];
                      copy[ex.id][idx] = { ...draft, reps: e.target.value };
                      return copy;
                    })
                  }
                />
                <Button size="sm" variant="outline" disabled>
                  ✓
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Separator />

      <Button className="w-full" size="lg" variant="default" disabled>
        운동 종료
      </Button>
    </div>
  );
}
```

- [ ] **Step 4.1.3: dev 서버에서 시각 확인**

```bash
pnpm dev
```

브라우저: `/workout/new` → 부위 2개 → 추천 보기 → 운동 시작 → 세션 페이지에서 운동 카드 N개 + 운동당 빈 세트 input N개 확인.

→ Ctrl+C.

- [ ] **Step 4.1.4: TypeCheck + lint + 커밋**

```bash
pnpm tsc --noEmit && pnpm lint
git add src/app/workout/\[sessionId\]/
git commit -m "feat(phase-3-1): session page skeleton — exercise cards + draft set rows"
```

---

### Task 4.2: 세트 INSERT (Optimistic Mutation)

**Files:**
- Modify: `src/app/workout/[sessionId]/SessionRunner.tsx` — add `useMutation`

- [ ] **Step 4.2.1: mutation hook 작성**

`SessionRunner.tsx`에 다음 추가 (기존 `useState` import 옆에 `useMemo`도 추가):

```typescript
import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { WorkoutSetInsert } from "@/lib/queries/sets";
```

`Props` 아래에:

```typescript
type SaveSetVars = {
  exerciseId: string;
  setNumber: number;
  weightKg: number;
  reps: number;
};
```

컴포넌트 본문에 mutation 정의:

```typescript
const supabase = useMemo(() => createClient(), []);

// initialSets을 캐시에 시딩 (server prefetch는 Plan 3.2에서 HydrationBoundary로 통합)
const [savedSets, setSavedSets] = useState<WorkoutSet[]>(initialSets);

// per-set pending 추적 — `${exerciseId}:${setNumber}` 키
const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
const setKey = (exId: string, n: number) => `${exId}:${n}`;

const saveSet = useMutation({
  mutationFn: async (vars: SaveSetVars) => {
    const payload: WorkoutSetInsert = {
      session_id: session.id,
      exercise_id: vars.exerciseId,
      set_number: vars.setNumber,
      weight_kg: vars.weightKg,
      reps: vars.reps,
      side: "both",
      drop_order: 0,
      parent_set_id: null,
    };
    const { data, error } = await supabase
      .from("workout_sets")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return data as WorkoutSet;
  },
  onMutate: async (vars) => {
    const tempId = `temp-${vars.exerciseId}-${vars.setNumber}-${Date.now()}`;
    const key = setKey(vars.exerciseId, vars.setNumber);
    const optimistic: WorkoutSet = {
      id: tempId,
      session_id: session.id,
      exercise_id: vars.exerciseId,
      set_number: vars.setNumber,
      weight_kg: vars.weightKg,
      reps: vars.reps,
      side: "both",
      drop_order: 0,
      parent_set_id: null,
      memo: null,
      created_at: new Date().toISOString(),
    };
    setPendingKeys((prev) => new Set(prev).add(key));
    const prev = savedSets;
    setSavedSets((curr) => [...curr, optimistic]);
    return { prev, tempId, key };
  },
  onError: (err, _vars, ctx) => {
    if (ctx) {
      setSavedSets(ctx.prev);
      setPendingKeys((p) => {
        const n = new Set(p);
        n.delete(ctx.key);
        return n;
      });
    }
    toast.error("저장 실패. 다시 시도해주세요.");
    console.error(err);
  },
  onSuccess: (data, _vars, ctx) => {
    // optimistic temp id를 실제 row로 교체
    setSavedSets((curr) =>
      curr.map((s) => (ctx && s.id === ctx.tempId ? data : s)),
    );
    if (ctx) {
      setPendingKeys((p) => {
        const n = new Set(p);
        n.delete(ctx.key);
        return n;
      });
    }
  },
});
```

체크 버튼을 활성화 (NaN guard + per-set pending):

```tsx
<Button
  size="sm"
  variant={isSaved(ex.id, draft.setNumber) ? "default" : "outline"}
  disabled={
    pendingKeys.has(setKey(ex.id, draft.setNumber)) ||
    isSaved(ex.id, draft.setNumber) ||
    !draft.weightKg ||
    !draft.reps
  }
  onClick={() => {
    const w = parseFloat(draft.weightKg);
    const r = parseInt(draft.reps, 10);
    if (!Number.isFinite(w) || !Number.isFinite(r) || w < 0 || r <= 0) {
      toast.error("무게(0 이상)와 회수(1 이상)를 올바르게 입력하세요");
      return;
    }
    saveSet.mutate({
      exerciseId: ex.id,
      setNumber: draft.setNumber,
      weightKg: w,
      reps: r,
    });
  }}
>
  ✓
</Button>
```

`isSaved` 헬퍼:

```typescript
const isSaved = (exerciseId: string, setNumber: number) =>
  savedSets.some(
    (s) =>
      s.exercise_id === exerciseId &&
      s.set_number === setNumber &&
      s.parent_set_id === null,
  );
```

> 주: 빠른 연속 입력(여러 ✓를 거의 동시에) 시 `useMutation`은 React 19에서 병렬 mutate를 처리합니다. `pendingKeys`가 per-set으로 추적하므로 다른 세트의 ✓는 막히지 않습니다. 단, 같은 세트의 ✓를 두 번 누르는 더블탭은 `pendingKeys` + `isSaved` 양쪽으로 차단.

저장된 세트는 input을 disabled로:

```tsx
<Input
  // ... 기존 props ...
  disabled={isSaved(ex.id, draft.setNumber)}
/>
```

- [ ] **Step 4.2.2: dev 서버에서 INSERT 동작 확인**

```bash
pnpm dev
```

브라우저:
1. `/workout/new` → 부위 2개 → 운동 시작
2. 첫 운동의 1세트에 무게 50, 회수 10 입력 → ✓ 클릭
3. UI가 즉시 "저장됨" 상태로 (input disabled, ✓ default 색)
4. Supabase Studio → `workout_sets` 새 row 확인

네트워크 throttling으로 optimistic 확인:
- Chrome DevTools → Network → "Slow 3G" → 다시 ✓ 클릭 → UI 즉시 반영 + 1~2초 후 실제 row 동기화

→ Ctrl+C.

- [ ] **Step 4.2.3: TypeCheck + lint + 커밋**

```bash
pnpm tsc --noEmit && pnpm lint
git add src/app/workout/\[sessionId\]/SessionRunner.tsx
git commit -m "feat(phase-3-1): set input with optimistic insert + savedSets state"
```

---

### Task 4.3: 운동 종료 + 대시보드 리턴

**Files:**
- Modify: `src/app/workout/actions.ts` — add `finishSession`
- Modify: `src/app/workout/[sessionId]/SessionRunner.tsx` — 종료 버튼 wiring

- [ ] **Step 4.3.1: finishSession Server Action 추가**

`src/app/workout/actions.ts` 끝에 추가:

```typescript
export type FinishSessionResult = { ok: false; error: string };

export async function finishSession(
  sessionId: string,
): Promise<FinishSessionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("workout_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", user.id); // RLS도 막지만 명시

  if (error) {
    console.error("finishSession failed", error);
    return { ok: false, error: "종료 실패" };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
```

- [ ] **Step 4.3.2: 종료 버튼 wiring**

`SessionRunner.tsx`에 추가:

```typescript
import { finishSession } from "@/app/workout/actions";
import { useTransition } from "react";

// component 본문에:
const [isFinishing, startFinish] = useTransition();

const handleFinish = () => {
  startFinish(async () => {
    const result = await finishSession(session.id);
    // 성공 시 redirect로 페이지 떠남. 도달했다면 실패.
    if (result && result.ok === false) {
      toast.error(result.error);
    }
  });
};
```

기존 종료 버튼 교체:

```tsx
<Button
  className="w-full"
  size="lg"
  variant="default"
  disabled={isFinishing || savedSets.length === 0}
  onClick={handleFinish}
>
  {isFinishing ? "종료 중..." : "운동 종료"}
</Button>
```

> `savedSets.length === 0`이면 종료 막음 (빈 세션 방지). 빈 세션 종료는 Plan 3.2에서 "포기" UX로 분리.

- [ ] **Step 4.3.3: dev 시각 확인**

```bash
pnpm dev
```

1. `/workout/new` → 시작 → 세트 1개 저장 → "운동 종료" 클릭 → `/dashboard`로 이동
2. Supabase Studio에서 `workout_sessions.ended_at` 채워졌는지 확인

→ Ctrl+C.

- [ ] **Step 4.3.4: TypeCheck + lint + 커밋**

```bash
pnpm tsc --noEmit && pnpm lint
git add src/app/workout/
git commit -m "feat(phase-3-1): finishSession + end-workout button + redirect to dashboard"
```

---

## Chunk 5: Route-level UX (loading / error / not-found)

**목표:** spec §8 (Error Handling & UX States)의 글로벌 정책 충족. workout 라우트에 skeleton/에러/404 페이지 scaffolding.

### Task 5.1: workout 라우트 loading.tsx + error.tsx + not-found.tsx

**Files:**
- Create: `src/app/workout/new/loading.tsx`
- Create: `src/app/workout/new/error.tsx`
- Create: `src/app/workout/[sessionId]/loading.tsx`
- Create: `src/app/workout/[sessionId]/error.tsx`
- Create: `src/app/workout/[sessionId]/not-found.tsx`

- [ ] **Step 5.1.1: `loading.tsx` 2개 (skeleton)**

`src/app/workout/new/loading.tsx`:
```typescript
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="p-4 max-w-md mx-auto space-y-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-10 w-full" />
    </main>
  );
}
```

`src/app/workout/[sessionId]/loading.tsx`:
```typescript
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="p-4 max-w-md mx-auto space-y-4">
      <Skeleton className="h-6 w-40" />
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
      <Skeleton className="h-12 w-full" />
    </main>
  );
}
```

- [ ] **Step 5.1.2: `error.tsx` 2개 (재시도 버튼 포함)**

`src/app/workout/new/error.tsx`:
```typescript
"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("workout/new error", error);
  }, [error]);

  return (
    <main className="p-4 max-w-md mx-auto space-y-4">
      <h2 className="text-lg font-semibold">문제가 발생했습니다</h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <Button onClick={reset}>다시 시도</Button>
    </main>
  );
}
```

`src/app/workout/[sessionId]/error.tsx`: 동일 패턴, 메시지만 "운동 세션을 불러올 수 없습니다"로.

- [ ] **Step 5.1.3: `not-found.tsx` (세션 라우트)**

`src/app/workout/[sessionId]/not-found.tsx`:
```typescript
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="p-4 max-w-md mx-auto space-y-4">
      <h2 className="text-lg font-semibold">세션을 찾을 수 없습니다</h2>
      <p className="text-sm text-muted-foreground">
        존재하지 않거나 다른 계정의 세션입니다.
      </p>
      <Link href="/dashboard">
        <Button variant="outline">대시보드로</Button>
      </Link>
    </main>
  );
}
```

- [ ] **Step 5.1.4: 비어있는 selectedExercises 가드**

`src/app/workout/[sessionId]/page.tsx`에서 추가:

```typescript
// 변조된 ?exercises= 또는 빈 세션 — 운동 없으면 not-found
if (selectedExercises.length === 0) {
  notFound();
}
```

- [ ] **Step 5.1.5: dev 시각 확인 (선택)**

```bash
pnpm dev
```

- `/workout/00000000-0000-0000-0000-000000000000` 접근 → not-found 페이지 표시
- `/workout/new` 첫 로드 시 skeleton (네트워크 throttle "Slow 3G"로 시뮬레이션) 표시

→ Ctrl+C.

- [ ] **Step 5.1.6: TypeCheck + lint + 커밋**

```bash
pnpm tsc --noEmit && pnpm lint
git add src/app/workout/
git commit -m "feat(phase-3-1): loading/error/not-found pages for workout routes + empty-exercises guard"
```

---

## Chunk 6: Verification + PR

### Task 6.1: Build + RLS regression

- [ ] **Step 6.1.1: 프로덕션 빌드**

```bash
pnpm build
```

Expected: 에러 0개, `/workout/new`, `/workout/[sessionId]` 라우트가 출력에 나타남.

- [ ] **Step 6.1.2: 기존 RLS 테스트 재실행**

```bash
pnpm test
```

Expected: 기존 `tests/rls/isolation.test.ts` PASS + 새 `tests/workout/recommendation.test.ts` PASS (총 6+ tests).

- [ ] **Step 6.1.3: 수동 E2E 시나리오 (헬스장 모바일 시뮬레이션)**

`pnpm dev` + Chrome DevTools → Device Toolbar → "iPhone 14 Pro"로 다음 흐름 1회:

1. `/login` → Google OAuth → `/dashboard`
2. "운동 시작" 클릭 → `/workout/new`
3. "가슴", "어깨" 부위 chip 선택 (2개)
4. "추천 보기" → 가슴 3개 + 어깨 3개 미리보기 카드 6개 표시
5. "이 분할 저장" → "가슴+어깨" 입력 → 저장 → 토스트 + 페이지 새로고침 시 chip에 표시
6. "운동 시작" → 세션 페이지
7. 6개 운동 카드 각각 default_sets(보통 3) 만큼 세트 input
8. 운동 1번의 1세트: 50kg × 10회 → ✓ → 저장됨 상태 (input disabled, ✓ 색 변경)
9. 운동 1번의 2세트: 52.5kg × 10회 → ✓
10. "운동 종료" → `/dashboard`로 리턴
11. (선택) Supabase Studio → `workout_sessions` 1행 + `workout_sets` 2행 + `routine_templates` 1행 확인

→ 모든 단계 동작하면 PASS.

- [ ] **Step 6.1.4: dev 종료**

Ctrl+C.

---

### Task 6.2: 결과 로그 + PR

**Files:**
- Create: `docs/import/workout-runner-basic-log.md` — Phase 3.1 완료 로그

- [ ] **Step 6.2.1: 완료 로그 작성**

```bash
TODAY=$(date +%Y-%m-%d)
cat > docs/import/workout-runner-basic-log.md <<EOF
# Phase 3.1 — Workout Runner Basic 완료

- **Date:** ${TODAY}
- **Branch:** feat/phase-3-1-workout-runner-basic
- **Tag:** v0.3.1-workout-runner-basic

## Implemented

- /workout/new — 부위 chip 토글 + 저장된 분할 chip + 추천 알고리즘 미리보기
- 추천 알고리즘: spec §7 (빈도 desc → 마지막 사용일 asc → created_at), `fetchRecentSets(uid, 30)` 실데이터 기반
- routine_templates 저장 + 부위 매핑 (M:N) + 명시적 user_id
- /workout/[sessionId] — 운동 카드 + 빈 세트 input + ✓ 체크
- Optimistic mutation (insertSet) — onMutate 즉시 UI, onError 롤백, per-set pending 추적
- NaN guard (Number.isFinite + 음수 차단)
- finishSession — ended_at 업데이트 + /dashboard 리턴
- Server Action 반환 컨벤션: { ok: false, error } | redirect (try/catch 불필요)
- workout 라우트 loading.tsx / error.tsx / not-found.tsx scaffold

## Out of Scope (Plan 3.2)

- 드롭세트 UI (+ 드롭 버튼)
- 좌/우 분리 입력 (side toggle)
- 휴식 타이머
- 지난번 기록을 default로 채우기
- 빈 세션 포기 / 임시 저장 / "운동 종료" 확인 다이얼로그
- 추천 결과 재정렬 / 수동 추가
- TanStack Query 캐시로 savedSets 통합 (현재 useState)

## Tests

- tests/workout/recommendation.test.ts — 5 unit tests
- tests/rls/isolation.test.ts — 3 cross-user isolation tests (regression)

## Manual E2E Performed

- iPhone 14 Pro 시뮬레이션으로 새 세션 1회 (운동 시작 → 세트 2개 저장 → 종료) 검증.
- Slow 3G throttling에서 optimistic UI < 100ms 반영 확인.
- NaN/음수 입력 시 에러 토스트 + INSERT 차단 확인.
EOF
```

- [ ] **Step 6.2.2: 로그 커밋**

```bash
git add docs/import/workout-runner-basic-log.md
git commit -m "docs(phase-3-1): completion log"
```

- [ ] **Step 6.2.3: 푸시 + PR**

```bash
git push -u origin feat/phase-3-1-workout-runner-basic
gh pr create --title "Phase 3.1: Workout Runner Basic (3a + 3b)" --body "$(cat <<'EOF'
## Summary

Phase 3의 1차 PR. /workout/new (부위 조합 + 추천 + 템플릿 저장) + /workout/[sessionId] (세트 입력 + optimistic mutation) + 세션 종료까지의 최소 흐름.

## Scope

- ✅ /workout/new 부위 chip + 템플릿 chip + 추천 미리보기 (실 사용 데이터 기반 정렬)
- ✅ recommendExercises() 순수 함수 (spec §7) + Vitest 5 케이스
- ✅ fetchRecentSets RSC 쿼리 (30일 메인 세트)
- ✅ routine_templates / routine_template_body_parts INSERT (M:N, 명시적 user_id)
- ✅ workout_sessions INSERT + redirect
- ✅ /workout/[sessionId] 세트 카드 + 무게/회수 input + ✓
- ✅ Optimistic mutation (useMutation onMutate/onError/onSuccess) + per-set pending 추적
- ✅ NaN/음수 입력 가드
- ✅ Server Action 반환 컨벤션 ({ ok: false, error } | redirect)
- ✅ workout 라우트 loading/error/not-found 페이지
- ✅ finishSession (ended_at) + dashboard 리턴

## Out of Scope (Plan 3.2)

- 드롭세트 UI, 좌/우 분리, 휴식 타이머, 지난번 기록 default, 빈 세션 포기, "운동 종료" 확인 다이얼로그, TanStack Query 캐시 통합.

## Test Plan

- [ ] tests/workout/recommendation.test.ts PASS (5/5)
- [ ] tests/rls/isolation.test.ts PASS (3/3 regression)
- [ ] pnpm build 성공
- [ ] iPhone 14 Pro 시뮬레이션 E2E 1회 (시작 → 세트 → 종료)
- [ ] Slow 3G에서 optimistic UI < 100ms 확인
- [ ] NaN/음수 입력 시 에러 토스트 + INSERT 차단
- [ ] `/workout/<random-uuid>` 직접 접근 시 not-found 페이지
EOF
)"
```

- [ ] **Step 6.2.4: 머지 + 태그**

```bash
gh pr merge --merge --delete-branch
git checkout main && git pull
git tag v0.3.1-workout-runner-basic
git push origin v0.3.1-workout-runner-basic
```

- [ ] **Step 6.2.5: 완료 보고**

사용자에게 다음 정보 제공:
- PR URL
- 머지 커밋 SHA
- 태그 v0.3.1-workout-runner-basic
- Plan 3.2 작성 시점: 1주일 실사용 후 피드백 받아서 시작

---

## Risks & Mitigations

| 리스크 | 영향 | 완화 |
|--------|------|------|
| URL `?exercises=...`로 추천 결과 전달 — 페이지 새로고침 시 동일 운동 유지되는가 | 중간 | searchParams에서 매번 파싱하므로 새로고침 OK. 운동 10개+ UUID 36자 ~400자 → URL 길이 안전 마진 충분. |
| Optimistic UI에서 set_number 중복 INSERT 시도 | 중간 | DB unique index `uniq_main_set`가 막음 → onError 토스트 + 롤백 + `pendingKeys` per-set 추적으로 더블탭 차단. |
| Server Action `redirect()`가 클라 try/catch에 잡혀 redirect 안 됨 | 해결됨 | **try/catch 제거 + Discriminated union `{ ok: false, error }` 반환 패턴**. `redirect()` 호출 시 throw가 자연 전파 → useTransition이 NEXT_REDIRECT 자동 처리. fragile한 메시지 매칭 없음. |
| `workout_sessions.Insert` / `routine_templates.Insert` 타입이 `user_id` require | 해결됨 | trigger는 defense-in-depth로 두고 Server Action에서 `user_id: user.id` 명시 전달. TS 컴파일 안전. |
| `routine_templates` 저장 후 부위 매핑 INSERT 실패 시 고아 row | 낮음 | saveTemplate에서 best-effort `delete` 정리 코드 추가. |
| 추천 알고리즘이 recentSets 비어있을 때 (신규 사용자) → 모두 0 빈도 | 낮음 | 정렬 3순위 created_at으로 deterministic. **기존 사용자(73개 운동, Phase 2 임포트 데이터)는 `fetchRecentSets(uid, 30)` prefetch로 실데이터 기반 추천 동작.** |
| NaN 입력 (예: "abc" → parseFloat) → Supabase reject | 해결됨 | 클라이언트 `Number.isFinite()` + 음수 차단 가드. 토스트로 명확한 메시지. |
| Optimistic UI에서 ✓ 연속 탭 시 다른 세트 ✓도 disabled | 해결됨 | `pendingKeys: Set<"exId:setNum">` 로 per-set 추적. 다른 세트는 영향 없음. |
| TanStack Query 캐시와 `savedSets` useState 중복 | 낮음 | Phase 3.1에서는 useState로 단순화 (TanStack Query는 추후 read query 확장 시 사용). Plan 3.2에서 일관성 검토. |
| 모바일 input number type의 iOS 키패드 이슈 | 중간 | `inputMode="decimal"` / `inputMode="numeric"` 명시. Plan 3.2에서 실사용 후 검증. |
| "운동 종료" 우발 탭으로 세션 강제 종료 | 중간 | Plan 3.1에서는 `savedSets.length === 0`이면 비활성. 확인 다이얼로그는 Plan 3.2에서 "포기 vs 종료" UX 분리와 함께. |
| `?exercises=` URL 변조로 빈 운동 리스트 | 낮음 | `selectedExercises.length === 0` 가드 → `notFound()` 호출. |
| Toaster `<Toaster />` 미마운트 시 `toast.error()` 무음 | 낮음 | `src/app/layout.tsx`에 이미 마운트됨 (Phase 0+1 결정). 변경 시 확인. |

## Recovery Path

PR1 머지 후 버그 발견 시:

1. **데이터 정합성 이슈** (예: orphan template):
   ```sql
   -- Supabase SQL Editor
   DELETE FROM routine_templates rt
   WHERE NOT EXISTS (
     SELECT 1 FROM routine_template_body_parts m
     WHERE m.routine_template_id = rt.id
   );
   ```

2. **잘못된 세션** (빈 세션 + 자동 종료):
   ```sql
   DELETE FROM workout_sessions
   WHERE id = '<session-uuid>'
     AND user_id = auth.uid();
   -- workout_sets은 CASCADE
   ```

3. **롤백** (PR 자체 revert):
   ```bash
   gh pr create --base main --head main --title "Revert Phase 3.1" --body "..."
   # 또는 직접 git revert <merge-commit>
   ```

---

## Reference Map

| 구현 항목 | 파일 | ADR/Spec |
|-----------|------|----------|
| 부위 M:N 쿼리 | `lib/queries/exercises.ts` | ADR-001 |
| `is_unilateral` 무시 (Plan 3.2) | `lib/queries/exercises.ts` | ADR-003 |
| `parent_set_id=null, drop_order=0, side='both'` 고정 | `SessionRunner.tsx` | ADR-002, ADR-003 |
| Optimistic mutation + per-set pending | `SessionRunner.tsx` | ADR-007 |
| RSC fetch + Client interaction | `app/workout/new/page.tsx`, `SessionRunner.tsx` | ADR-007 |
| 30일 메인 세트 prefetch | `lib/queries/sets.ts` fetchRecentSets | Spec §7 |
| 명시적 `user_id` INSERT + NULL-check trigger | `app/workout/actions.ts` | ADR-008 |
| 추천 알고리즘 | `lib/workout/recommendation.ts` | Spec §7 |
| Server Action 반환 컨벤션 ({ ok: false, error } / redirect) | `app/workout/actions.ts` | (Phase 3.1 critic round 1) |
| 라우트 UX states | `app/workout/{new,[sessionId]}/{loading,error,not-found}.tsx` | Spec §8 |

---

## Revision History

| Version | Date | Change |
|---------|------|--------|
| v1 | 2026-05-26 | Phase 3.1 (3a + 3b) 초안 — PR 1차 범위 분리, 템플릿 저장 포함, 타이머/드롭/좌우는 Plan 3.2로 연기 |
| v2 | 2026-05-26 | critic round 1 반영: (CRITICAL) Server Action 반환 컨벤션 변경 — try/catch 제거, `{ ok: false, error }` discriminated union 도입. (MAJOR) `user_id` 명시 INSERT (TS Insert 타입 require 대응). NaN/음수 가드 추가. `pendingKeys` per-set pending 추적. `fetchRecentSets` RSC 쿼리 신설 + StartForm에 `recentSets` prop 전달. (Missing) Chunk 5 신설 — loading/error/not-found 페이지 + `selectedExercises.length === 0` 가드. (MINOR) heredoc 변수 확장 fix. Chunk 5→6 리넘버. |
