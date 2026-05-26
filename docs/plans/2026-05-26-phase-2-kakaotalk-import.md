# Phase 2: KakaoTalk Workout Data Import Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1년치 카톡 셀프챗 운동 기록(`.eml`, ~6,500 lines)을 ADR-001~008 스키마에 맞게 파싱·검증·임포트해서 본인 user_id로 클라우드 Supabase에 적재.

**Architecture:** 일회성 데이터 마이그레이션 파이프라인. Claude Code (개발 도구로서)가 `.eml`을 청크로 읽어 `seeds/exercises.json` → `seeds/workout_sessions.json` 순서로 생성. Markdown 검증 테이블로 사용자가 sampling 검토. TypeScript 임포트 스크립트가 service_role로 의존성 순서대로 INSERT. 런타임 LLM 의존성 0.

**Tech Stack:** TypeScript, `tsx` (실행), `@supabase/supabase-js` v2 (service_role), `zod` (JSON 스키마 검증), Vitest (헬퍼 단위 테스트).

**Reference docs:**
- Spec: `docs/specs/2026-05-22-gym-routine-app-design.md` §10 Phase 2
- ADR: `docs/adr/004-kakaotalk-import-strategy.md` (Option B+ 절차)
- Schema: `docs/specs/2026-05-22-gym-routine-app-design.md` §5.2

**Source file:** `/Users/jeonhyejin/Downloads/HJ 님과 카카오톡 대화.eml` (gitignored, 본인 PC 전용)

**완료 시점에 검증되는 것:**
- `seeds/exercises.json` (commit) — 추출된 운동 카탈로그
- `seeds/workout_sessions.json` (**gitignored**, 개인 헬스 데이터)
- `docs/import/validation-summary.md` (commit) — 파싱 정확도 sampling demo (5 sessions Markdown)
- `scripts/import-from-json.ts` (commit) — 재현 가능한 임포트 코드
- Supabase 클라우드 DB에 본인 user_id로 INSERT 된 운동/세션/세트 데이터
- 본인 계정 로그인 시에만 RLS로 조회됨 (auth.uid() = user_id)

> Validation MD sample (5 sessions)으로 포트폴리오 demo 충분. 별도 JSON 샘플 파일은 불필요하다고 판단해 제거.

## 데이터 보존 원칙 (중요)

| 자원 | 저장 위치 | Git commit? | 이유 |
|------|-----------|------------|------|
| `.eml` 원본 | `~/Downloads` | ❌ `.gitignore` `*.eml` | 카톡 대화 전체 (운동 외 사적 메시지) |
| `seeds/exercises.json` | `seeds/` | ✅ | 운동 이름/장비/부위 (민감 X, 헬스 도메인 어휘) |
| `seeds/workout_sessions.json` | `seeds/` | ❌ `.gitignore` | 본인 날짜별 무게/체력 데이터 |
| 실제 데이터 | Supabase Postgres | (cloud) | RLS로 본인만 조회 |

---

## Chunk 1: Infrastructure Setup

**목표:** 디렉토리/스크립트/의존성 셋업. 빈 placeholder + npm scripts 등록.

### Task 1.1: 브랜치 + 디렉토리 + .gitignore 보강

**Files:**
- Create dirs: `seeds/`, `scripts/`, `docs/import/`
- Modify: `.gitignore`

- [ ] **Step 1.1.0: 브랜치 생성**

main에서 시작:
```bash
cd "/Users/jeonhyejin/Desktop/사이드프로젝트/gym-routine-app"
git checkout main && git pull
git checkout -b feat/phase-2-kakaotalk-import
```

- [ ] **Step 1.1.1: 디렉토리 생성 + placeholder 파일**

```bash
mkdir -p seeds scripts docs/import
touch seeds/.gitkeep scripts/.gitkeep docs/import/.gitkeep
```

> `.gitkeep`은 빈 디렉토리 git 추적용 관례. 실제 산출물이 들어가면 제거.

- [ ] **Step 1.1.2: .gitignore에 개인 데이터 제외 추가**

`.gitignore` 끝에 추가 (덮어쓰기 말고 append):
```
# 카톡 임포트 원본/중간 산출물 (개인 헬스 데이터, RLS로 Supabase에만 보관)
seeds/workout_sessions.json
seeds/import-source/
docs/import/validation-raw-*.md
```

> `*.eml`은 이미 .gitignore에 있음 (Phase 0+1에서 추가됨). 재확인만.

- [ ] **Step 1.1.3: 확인 + commit**

```bash
git status
git add seeds/ scripts/ docs/import/ .gitignore
git commit -m "chore: scaffold seeds/scripts/docs/import for Phase 2 import"
```

### Task 1.2: 의존성 + npm scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1.2.1: tsx + zod 설치**

```bash
pnpm add -D tsx zod
```

> `tsx` = TypeScript executor (`node`처럼 `.ts` 파일 직접 실행). `zod` = JSON 스키마 런타임 검증.

- [ ] **Step 1.2.2: package.json scripts 추가**

`scripts` 객체에 3개 추가:
```json
{
  "import:validate": "tsx scripts/validate-imports.ts",
  "import:apply": "tsx scripts/import-from-json.ts",
  "import:gen-md": "tsx scripts/gen-validation-md.ts"
}
```

- [ ] **Step 1.2.3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add tsx/zod and import npm scripts"
```

---

## Chunk 2: Exercises Catalog Parsing (Step 1)

**목표:** `.eml`에서 등장하는 모든 운동 이름을 추출 → `seeds/exercises.json` 생성. **카탈로그 확정이 세션 데이터 임포트의 전제** (운동명 오류가 모든 세트 데이터에 전파되는 것 차단).

### Task 2.1: 운동 카탈로그 추출

**Files:**
- Create: `seeds/exercises.json`
- Source: `/Users/jeonhyejin/Downloads/HJ 님과 카카오톡 대화.eml`

- [ ] **Step 2.1.1: `.eml` 청크 단위로 읽으면서 운동 라인 추출**

`.eml`은 ~367KB로 Read 도구 256KB 한계 초과. `offset`/`limit`으로 청크 읽기.

목표:
- 운동 키워드 매칭으로 운동 라인만 필터
- 핵심 키워드 후보: `랫풀다운, 리버스랫풀다운, 시티드케이블로우, 덤벨로우, 벤치프레스, 팔굽혀펴기, 누워서 버터플라이, 펙덱플라이, 사레레, 업라이트로우, 페이스풀, 와이레이즈, w레이즈, 리버스플라이, 스쿼트, 핵스쿼트, V스쿼트, 레그프레스, 레그익스텐션, 레그컬, 런지, 아웃타이, 이너타이, 데드리프트, 원레그데드리프트, 힙쓰러스트, 불스스(불가리안스쿼트), 몬스터글루트, 클램프셸, 힙힌지, 옆구리운동, 사이드플랭크, 버피, 스텝박스점프, 케이블 버터플라이, 로잉머신, 암풀다운, 암풀오버, 데드버그, 체스트프레스`
- 라인 텍스트 정규화 후 unique set 추출
- 변형 식별: `한발씩`, `한팔씩`, `원레그`, `숙이고`, `(와이드그립)`, `(멀티그립)` 등 → 별도 exercise

- [ ] **Step 2.1.2: 각 운동을 ADR-001/003 스키마로 분류**

각 운동에 대해 결정:
- `name` (한국어 표준 이름)
- `body_parts` (M:N): primary + secondary, code 사용 (chest/back/shoulder/trap/arm/leg/glute/core)
- `is_unilateral` (한발/한팔/원레그 변형)
- `parent_exercise_name` (variant인 경우 base 운동 이름; FK는 임포트 스크립트가 resolve)
- `equipment` (free_weight/machine/cable/bodyweight/other)
- `confidence` (high/medium/low)

매핑 사전 (ADR-004 핵심):
- `빈바` → bodyweight or 20kg base (운동 컨텍스트에 따라 결정)
- `0` → bodyweight (해당 운동이 무게 없이 가능한 경우)
- `한발씩 / 한팔씩 / 원레그` → unilateral variant

- [ ] **Step 2.1.3: `seeds/exercises.json` 작성**

스키마:
```jsonc
{
  "version": "2026-05-26",
  "source": "kakaotalk_self_chat",
  "exercises": [
    {
      "name": "랫풀다운",
      "equipment": "machine",
      "is_unilateral": false,
      "parent_exercise_name": null,
      "body_parts": [
        { "code": "back", "is_primary": true }
      ],
      "default_sets": 3,
      "default_reps_min": 10,
      "default_reps_max": 15,
      "notes": null,
      "confidence": "high"
    },
    {
      "name": "랫풀다운 (한팔씩)",
      "equipment": "machine",
      "is_unilateral": true,
      "parent_exercise_name": "랫풀다운",
      "body_parts": [
        { "code": "back", "is_primary": true }
      ],
      "default_sets": 3,
      "default_reps_min": 10,
      "default_reps_max": 15,
      "notes": "단측 변형",
      "confidence": "high"
    }
    // ...
  ]
}
```

대략 40~60개 exercises 예상.

- [ ] **Step 2.1.4: 검증 헬퍼 작성 (zod 스키마)**

`scripts/validate-imports.ts`:
```typescript
import { z } from "zod";
import { readFileSync } from "node:fs";

const ExerciseSchema = z.object({
  name: z.string().min(1),
  equipment: z.enum(["free_weight", "machine", "cable", "bodyweight", "other"]),
  is_unilateral: z.boolean(),
  parent_exercise_name: z.string().nullable(),
  body_parts: z
    .array(
      z.object({
        code: z.enum([
          "chest",
          "back",
          "shoulder",
          "trap",
          "arm",
          "leg",
          "glute",
          "core",
        ]),
        is_primary: z.boolean(),
      }),
    )
    .min(1),
  default_sets: z.number().int().min(1).max(10).nullable().optional(),
  default_reps_min: z.number().int().nullable().optional(),
  default_reps_max: z.number().int().nullable().optional(),
  notes: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
});

const FileSchema = z.object({
  version: z.string(),
  source: z.string(),
  exercises: z.array(ExerciseSchema).min(1),
});

const exercisesJson = JSON.parse(readFileSync("seeds/exercises.json", "utf8"));
const result = FileSchema.safeParse(exercisesJson);
if (!result.success) {
  console.error("❌ exercises.json schema invalid:");
  console.error(result.error.format());
  process.exit(1);
}

// Sanity checks
const exercises = result.data.exercises;
const names = new Set(exercises.map((e) => e.name));
if (names.size !== exercises.length) {
  console.error("❌ duplicate names detected");
  process.exit(1);
}
const orphanedVariants = exercises.filter(
  (e) => e.parent_exercise_name && !names.has(e.parent_exercise_name),
);
if (orphanedVariants.length > 0) {
  console.error("❌ parent_exercise_name references missing exercises:");
  console.error(orphanedVariants.map((e) => e.name));
  process.exit(1);
}
const primaryCounts = exercises.map(
  (e) => e.body_parts.filter((bp) => bp.is_primary).length,
);
if (primaryCounts.some((c) => c !== 1)) {
  console.error("❌ each exercise must have exactly 1 primary body_part");
  process.exit(1);
}

console.log(`✅ exercises.json valid (${exercises.length} exercises)`);
```

- [ ] **Step 2.1.5: 검증 실행**

```bash
pnpm run import:validate
```
Expected: `✅ exercises.json valid (N exercises)`. 에러 있으면 수정 후 재실행.

- [ ] **Step 2.1.6: Commit catalog (사용자 검토 게이트 통과 후)**

> ⚠️ **사용자 검토 필수**: subagent가 `seeds/exercises.json` 생성 후, 사용자가 운동 이름/부위 분류를 한 번 훑어봐야 함. 부위 매핑이 틀리면 모든 추이 차트가 잘못됨.

검토 OK 후:
```bash
git add seeds/exercises.json scripts/validate-imports.ts package.json pnpm-lock.yaml
git commit -m "feat(import): extract exercise catalog from kakaotalk archive

- N unique exercises identified (catalog + variants)
- M:N body_parts mapping per ADR-001/003
- Unilateral variants linked via parent_exercise_name
- Confidence tagged; schema validated by zod"
```

---

## Chunk 3: Workout Sessions Parsing (Step 2)

**목표:** `.eml` + 확정된 `seeds/exercises.json`을 입력으로 운동 세션 데이터 추출 → `seeds/workout_sessions.json` 생성.

### Task 3.1: 세션 데이터 파싱

**Files:**
- Create: `seeds/workout_sessions.json` (gitignored)
- Modify: `scripts/validate-imports.ts`

- [ ] **Step 3.1.1: 세션 헤더 + 세트 라인 추출**

`.eml` 청크 단위로 다시 읽으면서:

세션 헤더 패턴:
- `2026년 1월 7일 오후 8:02, HJ : 개인운동 등`
- `2026년 4월 6일 오후 7:59, HJ : Pt 상체 등`
- `2026년 1월 8일 오후 8:00, HJ : 가슴 어깨`

세션 시작 신호:
- 날짜+시간 라인 다음에 **부위 키워드 포함 + URL/링크/사진/이모지 없는** 짧은 라인

세트 라인 패턴 (다양):
- `랫풀다운 20(15회) 30(15회) 40(8회)+바로25(15회)`
- `벤치프레스(빈바15) 17.5 20`
- `사레레 1 2 (20회씩)`
- `핵스쿼트 0 5 10`

- [ ] **Step 3.1.2: 각 라인을 세트 row 배열로 변환**

매핑 규칙:
- 무게 단위: `5`, `5kg`, `5키로` → 5.0 (NUMERIC(5,1))
- `빈바` → 카탈로그에서 해당 운동의 base weight 참조 (스쿼트=20, 벤치=20 등). 없으면 NULL + low confidence
- `0` → 0.0 또는 NULL (bodyweight)
- `+바로` → drop_order +1 (parent_set_id는 임포트 스크립트가 resolve)
- `(8회)`, `(8번)`, `(8개)`, `8회씩` → reps=8
- `한발씩 / 한팔씩 / 원레그` 단어가 라인에 있으면 → unilateral variant exercise 선택, side='both' (좌우 분리 안 함)
- 본문에 `왼쪽 / 오른쪽 / 왼발 / 오른발` 분리 명시되면 → side='left' or 'right' (드물지만)

세션 메모:
- `왼쪽 등이 너무 굳어있음`, `천계 20분` 등 자유 텍스트 → `session.overall_notes`로 흡수

- [ ] **Step 3.1.3: `seeds/workout_sessions.json` 작성**

스키마:

> **`routine_label` 처리** (critic 검토 반영): `workout_sessions` 테이블에 `routine_label` 컬럼은 없음 (ADR 결정상 `routine_template_id` FK만 존재). 카톡에서 추출한 라벨("Pt 상체 등", "개인운동 등")은 임포트 스크립트가 **`overall_notes` 앞에 prefix로 합성**하여 저장. 형식: `[{routine_label}] {memo}` 또는 라벨만 있으면 `[{routine_label}]`. JSON에는 디버깅/검증 편의를 위해 별도 필드로 유지하되, DB 적재 시점에 변환.

```jsonc
{
  "version": "2026-05-26",
  "source": "kakaotalk_self_chat",
  "sessions": [
    {
      "date": "2026-01-07",
      "started_at": "2026-01-07T20:02:00+09:00",
      "routine_label": "개인운동 등",   // 임포트 시 overall_notes로 합성됨
      "overall_notes": null,
      "exercises": [
        {
          "exercise_name": "랫풀다운",
          "sets": [
            { "set_number": 1, "drop_order": 0, "weight_kg": 20.0, "reps": 15, "side": "both", "confidence": "high", "source_line": "20(15회)" },
            { "set_number": 2, "drop_order": 0, "weight_kg": 30.0, "reps": 15, "side": "both", "confidence": "high", "source_line": "30(15회)" },
            { "set_number": 3, "drop_order": 0, "weight_kg": 40.0, "reps": 8,  "side": "both", "confidence": "high", "source_line": "40(8회)" },
            { "set_number": 3, "drop_order": 1, "weight_kg": 25.0, "reps": 15, "side": "both", "confidence": "high", "source_line": "+바로25(15회)" }
          ]
        }
      ]
    }
  ],
  "unresolved": [
    {
      "session_date": "2026-01-10",
      "line": "5에서 7.5로 쥐어짜냄",
      "reason": "exercise_name 미상 (직전 운동 추정 가능하나 confidence low)",
      "suggested_handling": "session.overall_notes로 흡수 권장"
    }
  ]
}
```

대략 30~50 sessions, 총 300~800 sets 예상.

- [ ] **Step 3.1.4: zod 스키마 추가 + 검증**

`scripts/validate-imports.ts`에 SessionSchema 추가:
```typescript
const SetSchema = z.object({
  set_number: z.number().int().min(1).max(20),
  drop_order: z.number().int().min(0).max(5),
  weight_kg: z.number().nullable(),
  reps: z.number().int().nullable(),
  side: z.enum(["both", "left", "right"]),
  confidence: z.enum(["high", "medium", "low"]),
  source_line: z.string().optional(),
});

const SessionExerciseSchema = z.object({
  exercise_name: z.string(),
  sets: z.array(SetSchema).min(1),
});

const SessionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  started_at: z.string(),
  routine_label: z.string().nullable(),
  overall_notes: z.string().nullable(),
  exercises: z.array(SessionExerciseSchema).min(1),
});

const SessionFileSchema = z.object({
  version: z.string(),
  source: z.string(),
  sessions: z.array(SessionSchema),
  unresolved: z.array(
    z.object({
      session_date: z.string().nullable(),
      line: z.string(),
      reason: z.string(),
      suggested_handling: z.string().optional(),
    }),
  ),
});

// ... validation logic mirrors exercises validation
// Critical extra check: every exercise_name in sessions must exist in exercises.json
```

- [ ] **Step 3.1.5: 검증 실행**

```bash
pnpm run import:validate
```
Expected: 두 파일 모두 ✅. 미존재 운동명 발견 시 카탈로그 보강 후 재실행.

- [ ] **Step 3.1.6: 카운트 요약 출력**

검증 스크립트 마지막에 추가:
```typescript
const totalSets = sessions.flatMap(s => s.exercises.flatMap(e => e.sets)).length;
const dropSets = sessions.flatMap(s => s.exercises.flatMap(e => e.sets.filter(set => set.drop_order > 0))).length;
const unresolvedCount = sessionData.unresolved.length;
console.log(`📊 ${sessions.length} sessions, ${totalSets} total sets (${dropSets} drop sets), ${unresolvedCount} unresolved`);
```

---

## Chunk 4: Validation Markdown (사용자 게이트)

**목표:** 사용자가 원본 ↔ 파싱 결과를 눈으로 대조할 수 있는 Markdown 테이블 생성. **임포트 전 마지막 사용자 검토 게이트**.

### Task 4.1: Markdown 생성 스크립트

**Files:**
- Create: `scripts/gen-validation-md.ts`
- Create: `docs/import/validation-summary.md` (commit, sample 5~10 sessions만)
- Create: `docs/import/validation-raw-full.md` (**gitignored**, 전체)

- [ ] **Step 4.1.1: 스크립트 작성**

`scripts/gen-validation-md.ts`:
```typescript
import { readFileSync, writeFileSync } from "node:fs";

const sessions = JSON.parse(
  readFileSync("seeds/workout_sessions.json", "utf8"),
).sessions;

function renderSession(s: any): string {
  const rows = s.exercises.flatMap((ex: any) =>
    ex.sets.map((set: any) => {
      const dropMark =
        set.drop_order > 0 ? `→drop${set.drop_order}` : "";
      const sideMark = set.side !== "both" ? ` (${set.side})` : "";
      return `| \`${set.source_line ?? ""}\` | ${ex.exercise_name}${sideMark} | ${set.set_number}${dropMark} | ${set.weight_kg ?? "-"} | ${set.reps ?? "-"} | ${set.confidence} |`;
    }),
  );
  return `### ${s.date} — ${s.routine_label ?? "(no label)"}\n\n| 원본 | 운동 | set | kg | reps | conf |\n|---|---|---|---|---|---|\n${rows.join("\n")}\n${s.overall_notes ? `\n**메모:** ${s.overall_notes}\n` : ""}`;
}

// 전체 버전 (gitignored)
writeFileSync(
  "docs/import/validation-raw-full.md",
  `# KakaoTalk Import Validation (Full)\n\n${sessions.map(renderSession).join("\n\n---\n\n")}`,
);

// 샘플 선택: 대표 패턴(일반 / 드롭세트 / 단측 / 메모)이 각각 포함되도록 의도적으로 픽
function pickRepresentativeSample(all: any[]): any[] {
  const picked = new Map<string, any>();
  const hasDrop = (s: any) =>
    s.exercises.some((ex: any) => ex.sets.some((set: any) => set.drop_order > 0));
  const hasUnilateral = (s: any) =>
    s.exercises.some((ex: any) =>
      ex.sets.some((set: any) => set.side !== "both") ||
      ex.exercise_name.match(/한발|한팔|원레그/),
    );
  const hasNotes = (s: any) => !!s.overall_notes;
  const hasLowConfidence = (s: any) =>
    s.exercises.some((ex: any) => ex.sets.some((set: any) => set.confidence === "low"));

  for (const s of all) {
    if (!picked.has("drop") && hasDrop(s)) picked.set("drop", s);
    if (!picked.has("unilateral") && hasUnilateral(s)) picked.set("unilateral", s);
    if (!picked.has("notes") && hasNotes(s)) picked.set("notes", s);
    if (!picked.has("low") && hasLowConfidence(s)) picked.set("low", s);
  }
  // 채우기: 위 4개로 부족하면 chronological 처음에서 보충 (최대 5개)
  for (const s of all) {
    if (picked.size >= 5) break;
    if (![...picked.values()].includes(s)) picked.set(`extra-${picked.size}`, s);
  }
  return [...picked.values()];
}

const sample = pickRepresentativeSample(sessions);
writeFileSync(
  "docs/import/validation-summary.md",
  `# KakaoTalk Import Validation (Sample)\n\n> ${sample.length} representative sessions sampled from ${sessions.length} total. Full data is gitignored (personal health data).\n> Demonstrates parsing pipeline accuracy across the patterns found in the source (normal sets, drop sets, unilateral variants, session notes).\n\n${sample.map(renderSession).join("\n\n---\n\n")}`,
);

console.log(
  `📄 Full: docs/import/validation-raw-full.md (${sessions.length} sessions)`,
);
console.log(
  `📄 Sample: docs/import/validation-summary.md (${sample.length} sessions)`,
);
```

- [ ] **Step 4.1.2: 스크립트 실행 + 사용자 검토**

```bash
pnpm tsx scripts/gen-validation-md.ts
```

> ⚠️ **사용자 검토 필수**: `docs/import/validation-raw-full.md`을 사용자가 훑어봄 (~30 sessions × 5초 = ~3분). confidence=low 항목 + unresolved 배열 집중. 오류 발견 시 `seeds/workout_sessions.json` 수동 수정 또는 subagent에 재파싱 요청.

검토 통과 후 다음 chunk.

- [ ] **Step 4.1.3: Commit sample MD (full은 gitignored)**

```bash
git add scripts/gen-validation-md.ts docs/import/validation-summary.md
git commit -m "feat(import): validation markdown generator + 5-session sample

Full validation MD (validation-raw-full.md) is gitignored — contains
personal weight/reps history. Sample committed for portfolio
demonstration of the parsing pipeline (covers normal sets, drop sets,
unilateral variants, session notes)."
```

---

## Chunk 5: Import Script (apply to Supabase)

**목표:** 검증된 `seeds/*.json`을 service_role로 클라우드 Supabase에 INSERT. 의존성 순서대로 안전하게 적재, 부분 실패 시 명확한 에러.

### Task 5.1: Import 스크립트

**Files:**
- Create: `scripts/import-from-json.ts`

- [ ] **Step 5.1.1: 스켈레톤 + 사용자 ID 조회**

```typescript
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import type { Database } from "../src/types/database.types";

config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TARGET_EMAIL = process.env.IMPORT_TARGET_EMAIL ?? "hyejin.jeon940120@gmail.com";

if (!URL || !SR) {
  console.error("❌ Missing env vars. Check .env.local");
  process.exit(1);
}

const admin = createClient<Database>(URL, SR, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getTargetUserId(): Promise<string> {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  const user = data.users.find((u) => u.email === TARGET_EMAIL);
  if (!user) {
    throw new Error(
      `Target user ${TARGET_EMAIL} not found. Sign in to the app once before importing.`,
    );
  }
  return user.id;
}
```

- [ ] **Step 5.1.2: Body parts 캐시 + idempotency 체크**

```typescript
async function loadBodyPartIdMap(): Promise<Map<string, number>> {
  const { data, error } = await admin
    .from("body_parts")
    .select("id, code");
  if (error) throw error;
  return new Map(data.map((bp) => [bp.code, bp.id]));
}

async function existingExercisesForUser(userId: string): Promise<Set<string>> {
  const { data, error } = await admin
    .from("exercises")
    .select("name")
    .eq("user_id", userId);
  if (error) throw error;
  return new Set(data.map((e) => e.name));
}
```

- [ ] **Step 5.1.3: Exercises 임포트 (M:N junction 포함)**

```typescript
async function importExercises(userId: string, bodyPartIds: Map<string, number>) {
  const json = JSON.parse(readFileSync("seeds/exercises.json", "utf8"));
  const existing = await existingExercisesForUser(userId);
  const exercisesByName = new Map<string, string>(); // name -> id

  // Pass 1: insert base exercises (parent_exercise_name IS NULL)
  const bases = json.exercises.filter((e: any) => !e.parent_exercise_name);
  const variants = json.exercises.filter((e: any) => e.parent_exercise_name);

  for (const e of bases) {
    let exerciseId: string;
    if (existing.has(e.name)) {
      console.log(`  ↻ ${e.name} already exists, reusing id`);
      const { data } = await admin
        .from("exercises")
        .select("id")
        .eq("user_id", userId)
        .eq("name", e.name)
        .single();
      if (!data) throw new Error(`exercises.lookup(${e.name}): row missing`);
      exerciseId = data.id;
    } else {
      const { data, error } = await admin
        .from("exercises")
        .insert({
          user_id: userId,
          name: e.name,
          equipment: e.equipment,
          is_unilateral: e.is_unilateral,
          default_sets: e.default_sets,
          default_reps_min: e.default_reps_min,
          default_reps_max: e.default_reps_max,
          notes: e.notes,
        })
        .select("id")
        .single();
      if (error)
        throw new Error(`exercises.insert(${e.name}): ${error.message}`);
      exerciseId = data.id;
    }
    exercisesByName.set(e.name, exerciseId);
    // Always re-apply body part mappings; PK on (exercise_id, body_part_id)
    // makes it idempotent (duplicate-key swallowed by insertBodyPartMappings).
    await insertBodyPartMappings(exerciseId, e.body_parts, bodyPartIds);
  }

  // Pass 2: insert variants (with parent_exercise_id resolved)
  for (const e of variants) {
    let exerciseId: string;
    if (existing.has(e.name)) {
      console.log(`  ↻ ${e.name} already exists, reusing id`);
      const { data } = await admin
        .from("exercises")
        .select("id")
        .eq("user_id", userId)
        .eq("name", e.name)
        .single();
      if (!data) throw new Error(`exercises.lookup(${e.name}): row missing`);
      exerciseId = data.id;
    } else {
      const parentId = exercisesByName.get(e.parent_exercise_name);
      if (!parentId)
        throw new Error(
          `${e.name}: parent_exercise_name "${e.parent_exercise_name}" not found in catalog`,
        );

      const { data, error } = await admin
        .from("exercises")
        .insert({
          user_id: userId,
          name: e.name,
          equipment: e.equipment,
          is_unilateral: e.is_unilateral,
          parent_exercise_id: parentId,
          default_sets: e.default_sets,
          default_reps_min: e.default_reps_min,
          default_reps_max: e.default_reps_max,
          notes: e.notes,
        })
        .select("id")
        .single();
      if (error)
        throw new Error(`exercises.insert(${e.name}): ${error.message}`);
      exerciseId = data.id;
    }
    exercisesByName.set(e.name, exerciseId);
    await insertBodyPartMappings(exerciseId, e.body_parts, bodyPartIds);
  }

  return exercisesByName;
}

async function insertBodyPartMappings(
  exerciseId: string,
  bodyParts: { code: string; is_primary: boolean }[],
  bodyPartIds: Map<string, number>,
) {
  for (const bp of bodyParts) {
    const id = bodyPartIds.get(bp.code);
    if (!id) throw new Error(`body_part code ${bp.code} unknown`);
    const { error } = await admin
      .from("exercise_body_parts")
      .insert({ exercise_id: exerciseId, body_part_id: id, is_primary: bp.is_primary });
    if (error && !error.message.includes("duplicate")) {
      throw new Error(`exercise_body_parts: ${error.message}`);
    }
  }
}
```

- [ ] **Step 5.1.4: Sessions + sets 임포트 (parent_set_id resolution)**

```typescript
async function existingSessionStartedAts(userId: string): Promise<Set<string>> {
  const { data, error } = await admin
    .from("workout_sessions")
    .select("started_at")
    .eq("user_id", userId);
  if (error) throw error;
  return new Set(data.map((r) => new Date(r.started_at).toISOString()));
}

function composeOverallNotes(label: string | null, memo: string | null): string | null {
  if (!label && !memo) return null;
  if (!label) return memo;
  if (!memo) return `[${label}]`;
  return `[${label}] ${memo}`;
}

async function importSessions(
  userId: string,
  exercisesByName: Map<string, string>,
) {
  const json = JSON.parse(readFileSync("seeds/workout_sessions.json", "utf8"));
  const existing = await existingSessionStartedAts(userId);
  let sessionCount = 0;
  let skippedSessions = 0;
  let setCount = 0;

  for (const s of json.sessions) {
    // Idempotency: skip if a session with same started_at (ISO) already exists for user
    const isoKey = new Date(s.started_at).toISOString();
    if (existing.has(isoKey)) {
      console.log(`  ↻ session ${s.date} already imported, skipping`);
      skippedSessions++;
      continue;
    }

    const { data: session, error: sErr } = await admin
      .from("workout_sessions")
      .insert({
        user_id: userId,
        started_at: s.started_at,
        ended_at: null,
        overall_notes: composeOverallNotes(s.routine_label, s.overall_notes),
      })
      .select("id")
      .single();
    if (sErr) throw new Error(`workout_sessions[${s.date}]: ${sErr.message}`);
    sessionCount++;

    for (const ex of s.exercises) {
      const exerciseId = exercisesByName.get(ex.exercise_name);
      if (!exerciseId)
        throw new Error(
          `session ${s.date}: exercise ${ex.exercise_name} not in catalog`,
        );

      // Main sets first (parent_set_id NULL), then drops in second pass
      const mainSets = ex.sets.filter((set: any) => set.drop_order === 0);
      const dropSets = ex.sets.filter((set: any) => set.drop_order > 0);
      const mainSetIds = new Map<number, string>(); // set_number -> id

      for (const set of mainSets) {
        const { data, error } = await admin
          .from("workout_sets")
          .insert({
            session_id: session.id,
            exercise_id: exerciseId,
            set_number: set.set_number,
            weight_kg: set.weight_kg,
            reps: set.reps,
            side: set.side,
            drop_order: 0,
            parent_set_id: null,
          })
          .select("id")
          .single();
        if (error)
          throw new Error(
            `workout_sets main ${s.date}/${ex.exercise_name}/${set.set_number}: ${error.message}`,
          );
        mainSetIds.set(set.set_number, data.id);
        setCount++;
      }

      for (const set of dropSets) {
        const parentId = mainSetIds.get(set.set_number);
        if (!parentId)
          throw new Error(
            `drop set ${s.date}/${ex.exercise_name}/${set.set_number}: no main set`,
          );
        const { error } = await admin.from("workout_sets").insert({
          session_id: session.id,
          exercise_id: exerciseId,
          set_number: set.set_number,
          weight_kg: set.weight_kg,
          reps: set.reps,
          side: set.side,
          drop_order: set.drop_order,
          parent_set_id: parentId,
        });
        if (error)
          throw new Error(
            `workout_sets drop ${s.date}/${ex.exercise_name}/${set.set_number}@${set.drop_order}: ${error.message}`,
          );
        setCount++;
      }
    }
  }

  return { sessionCount, skippedSessions, setCount };
}

async function wipeUserData(userId: string) {
  console.log("🧹 Wiping all imported data for user...");
  // Order matters: sessions first (CASCADE removes sets), then exercises
  const { error: e1 } = await admin.from("workout_sessions").delete().eq("user_id", userId);
  if (e1) throw new Error(`wipe sessions: ${e1.message}`);
  const { error: e2 } = await admin.from("exercises").delete().eq("user_id", userId);
  if (e2) throw new Error(`wipe exercises: ${e2.message}`);
  console.log("✅ Wipe complete");
}
```

- [ ] **Step 5.1.5: main + dry-run 모드**

스크립트 끝부분:
```typescript
async function main() {
  const DRY_RUN = process.argv.includes("--dry-run");
  const WIPE = process.argv.includes("--wipe");
  console.log(`🚀 Import starting (DRY_RUN=${DRY_RUN}, WIPE=${WIPE})`);

  if (DRY_RUN) {
    console.log("ℹ️  Dry run: validating env + counts only, no INSERT.");
    if (WIPE) {
      console.log("ℹ️  --wipe ignored in dry-run mode (no DELETE either).");
    }
  }

  const userId = await getTargetUserId();
  console.log(`👤 Target user: ${TARGET_EMAIL} (${userId})`);

  const bodyPartIds = await loadBodyPartIdMap();
  console.log(`📚 body_parts loaded: ${bodyPartIds.size}`);

  if (DRY_RUN) {
    const exJson = JSON.parse(readFileSync("seeds/exercises.json", "utf8"));
    const sJson = JSON.parse(readFileSync("seeds/workout_sessions.json", "utf8"));
    const totalSets = sJson.sessions.flatMap((s: any) =>
      s.exercises.flatMap((e: any) => e.sets),
    ).length;
    console.log(
      `📊 Would import: ${exJson.exercises.length} exercises, ${sJson.sessions.length} sessions, ${totalSets} sets`,
    );
    return;
  }

  if (WIPE) {
    await wipeUserData(userId);
  }

  const exercisesByName = await importExercises(userId, bodyPartIds);
  console.log(`✅ Exercises imported: ${exercisesByName.size}`);

  const { sessionCount, skippedSessions, setCount } = await importSessions(
    userId,
    exercisesByName,
  );
  console.log(
    `✅ Sessions: ${sessionCount} new (${skippedSessions} skipped as existing), Sets: ${setCount}`,
  );
  console.log("🎉 Import complete");
}

main().catch((err) => {
  console.error("❌ Import failed:", err);
  process.exit(1);
});
```

- [ ] **Step 5.1.6: Dry run 실행**

```bash
pnpm run import:apply -- --dry-run
```
Expected: env 통과 + 사용자 ID 조회 OK + body_parts 8개 + counts 표시. 실제 INSERT 안 함.

- [ ] **Step 5.1.7: Commit import script**

```bash
git add scripts/import-from-json.ts
git commit -m "feat(import): TypeScript import script with dry-run + idempotency

- Resolves user_id from auth.users by email (TARGET_EMAIL env)
- 2-pass exercise insert (bases → variants, parent_exercise_id resolution)
- 2-pass sets insert (main → drop, parent_set_id resolution)
- Skip existing exercises (idempotent re-runs)
- --dry-run mode for env/count verification"
```

---

## Chunk 6: Apply + Verify

**목표:** 실제 클라우드에 적용. 카운트 검증 + RLS로 본인 계정에서 보이는지 확인.

### Task 6.1: 실 임포트

- [ ] **Step 6.1.1: 실 임포트 실행**

```bash
pnpm run import:apply
```
Expected: 콘솔에 진행 상황 + 최종 "🎉 Import complete" + counts.

에러 발생 시: 정확한 위치 (세션 날짜/운동/세트번호) 출력됨 → JSON 수정 후 재실행 (idempotent).

### Task 6.2: 카운트 검증

- [ ] **Step 6.2.1: Supabase SQL Editor에서 카운트 확인**

https://supabase.com/dashboard/project/wdypbeqyuqhbqdpwvgpj/sql/new

```sql
SELECT
  (SELECT COUNT(*) FROM exercises WHERE user_id = (SELECT id FROM auth.users WHERE email = 'hyejin.jeon940120@gmail.com')) AS exercises,
  (SELECT COUNT(*) FROM exercise_body_parts ebp JOIN exercises e ON e.id = ebp.exercise_id WHERE e.user_id = (SELECT id FROM auth.users WHERE email = 'hyejin.jeon940120@gmail.com')) AS exercise_body_parts,
  (SELECT COUNT(*) FROM workout_sessions WHERE user_id = (SELECT id FROM auth.users WHERE email = 'hyejin.jeon940120@gmail.com')) AS sessions,
  (SELECT COUNT(*) FROM workout_sets ws JOIN workout_sessions s ON s.id = ws.session_id WHERE s.user_id = (SELECT id FROM auth.users WHERE email = 'hyejin.jeon940120@gmail.com')) AS sets,
  (SELECT COUNT(*) FROM workout_sets ws JOIN workout_sessions s ON s.id = ws.session_id WHERE s.user_id = (SELECT id FROM auth.users WHERE email = 'hyejin.jeon940120@gmail.com') AND ws.drop_order > 0) AS drop_sets;
```

JSON과 카운트 일치 확인.

- [ ] **Step 6.2.2: RLS 격리 재검증**

알려진 세션 1개 spot-check (예: 2026-04-06 Pt 상체 등):
```sql
SELECT ws.set_number, e.name, ws.weight_kg, ws.reps, ws.drop_order, ws.side
FROM workout_sets ws
JOIN workout_sessions s ON s.id = ws.session_id
JOIN exercises e ON e.id = ws.exercise_id
WHERE s.user_id = (SELECT id FROM auth.users WHERE email = 'hyejin.jeon940120@gmail.com')
  AND s.started_at::date = '2026-04-06'
ORDER BY ws.set_number, ws.drop_order;
```
원본 카톡:
```
랫풀다운 30 45 50 (뉴트럴그립)
리버스랫풀다운  20 25
...
```
대조 확인.

- [ ] **Step 6.2.3: 기존 RLS 테스트 재실행 (회귀 검증)**

```bash
pnpm test
```
Expected: 3/3 통과 (새 사용자 격리 여전히 작동, 임포트된 데이터로 인한 RLS 깨짐 없음).

### Task 6.3: 임포트 로그

- [ ] **Step 6.3.1: 임포트 로그 작성**

`docs/import/import-log.md`:
```markdown
# KakaoTalk Import Log

- **Date:** 2026-05-XX
- **Source:** Personal KakaoTalk self-chat .eml (gitignored)
- **Target:** Supabase cloud (ounwan project)
- **Target user email:** hyejin.jeon940120@gmail.com

## Result

| Table | Count |
|-------|-------|
| exercises | N |
| exercise_body_parts | N |
| workout_sessions | N |
| workout_sets (main) | N |
| workout_sets (drop) | N |
| unresolved (manual review) | N |

## Caveats

- N items in `unresolved` array were absorbed into session notes / discarded
- Average parsing confidence: high X% / medium Y% / low Z%
- Spot-checked sessions: 2026-04-06, 2026-01-07, 2026-04-30
```

- [ ] **Step 6.3.2: Commit**

```bash
git add docs/import/import-log.md
git commit -m "docs(import): record import result counts and caveats"
```

---

## Chunk 7: PR, Merge, Tag

**목표:** Phase 2 완료 마무리.

- [ ] **Step 7.1: 브랜치 push + PR**

```bash
git push -u origin feat/phase-2-kakaotalk-import
gh pr create --title "Phase 2: KakaoTalk workout data import" --body "$(cat <<'EOF'
## Summary
Phase 2 of the implementation plan (docs/plans/2026-05-26-phase-2-kakaotalk-import.md) — migrates 1 year of personal workout logs from KakaoTalk self-chat into the Supabase schema established in Phase 0+1.

## What's in
- **Catalog extraction**: seeds/exercises.json (N exercises, ADR-001/003 schema with M:N body parts, unilateral variants)
- **Session extraction**: seeds/workout_sessions.json (gitignored) — N sessions, N sets, N drop sets
- **Sample validation MD**: docs/import/validation-summary.md (5 sessions, committed; full version gitignored)
- **Import script**: scripts/import-from-json.ts (TypeScript, service_role, idempotent, --dry-run)
- **Import log**: docs/import/import-log.md

## Verified
- pnpm run import:validate ✅
- pnpm run import:apply --dry-run ✅
- pnpm run import:apply (cloud) ✅
- SQL count matches JSON
- Spot-check of 3 sessions matches original kakaotalk text
- pnpm test (RLS regression) ✅

## Privacy
Per-row workout data is gitignored. Sample (5 sessions) and parsing pipeline committed for portfolio demonstration. Full data lives in Supabase under RLS — only target user can SELECT.
EOF
)"
```

- [ ] **Step 7.2: Merge via UI 또는 CLI**

UI 자체-리뷰 1개 (포트폴리오 가산점) 또는 CLI 머지:
```bash
gh pr merge <PR-N> --merge --delete-branch
git checkout main && git pull
```

- [ ] **Step 7.3: Tag v0.2.0**

```bash
git tag -a v0.2.0-import -m "Phase 2: KakaoTalk import complete

N exercises, N sessions, N sets migrated from .eml to Supabase.
Live at https://ounwan.vercel.app (data visible after login)."
git push --tags
```

---

## Completion Criteria

- [ ] `seeds/exercises.json` committed with N exercises (사용자 검토 후 승인)
- [ ] `seeds/workout_sessions.json` generated (gitignored, RLS 보호되며 클라우드에 적재)
- [ ] `docs/import/validation-summary.md` committed (5 sessions sample)
- [ ] `scripts/import-from-json.ts` committed + dry-run + 실 적용 모두 통과
- [ ] Supabase SQL count = JSON count
- [ ] `pnpm test` 통과 (회귀)
- [ ] Tag `v0.2.0-import` push됨

## Deferred to Later Phases

| 항목 | 어디로 | 이유 |
|------|--------|------|
| 임포트된 데이터를 UI에서 보기 | Phase 3 (운동 진행) + Phase 4 (기록 보기) | UI 별도 phase |
| 데이터 export (CSV/JSON) | Phase 5 | MVP 아닌 부가 기능 |
| 인바디/눈바디 데이터 임포트 | (보류, ADR-009/010) | 카톡 데이터에 없음 |

## Risks

| 리스크 | 영향 | 완화 |
|--------|------|------|
| 카탈로그 분류 오류 (부위 매핑 잘못) | 추이 차트 부정확 | Step 2.1.6 사용자 검토 게이트 |
| 드롭세트 parsing 오인식 | 무게 추이 차트 노이즈 | Step 4.1.2 validation MD 검토 |
| service_role 키 노출 | 보안 사고 | .env.local만 사용, 절대 commit 안 함, 스크립트도 stderr에만 출력 |
| 중간 실패 시 부분 적재 | 정합성 깨짐 | (a) 세션 idempotency: 동일 `started_at` skip → 재실행 안전. (b) 클린 재임포트: `pnpm run import:apply -- --wipe` 로 본인 user의 exercises/sessions/sets 전부 삭제 후 재적재 (스크립트 `wipeUserData()` 함수). (c) 수동 SQL: Supabase SQL Editor에서 `DELETE FROM workout_sessions WHERE user_id = '<uid>'; DELETE FROM exercises WHERE user_id = '<uid>';` |
| 임포트 후 운동명을 UI에서 바꾸고 싶을 때 | 카탈로그 수정 시 sessions의 exercise_id는 그대로 유지 (ON DELETE RESTRICT) | exercises.name UPDATE는 안전 (FK는 id 참조) |

## References

- ADR-004: KakaoTalk import strategy
- ADR-001, 003, 008: schema (catalog M:N + per-user)
- ADR-002: drop set self-ref
- ADR-005: RLS pattern
- Spec §10 Phase 2
