# ADR-002: 드롭세트 모델링 방식

- **Status:** Accepted
- **Date:** 2026-05-22
- **Decider:** HJ

## Context

`workout_sets` 테이블에서 드롭세트(같은 운동을 무게 줄이면서 휴식 없이 이어 수행)를 어떻게 표현할지 결정.

카톡 데이터에서 발견된 패턴:
- `랫풀다운 20(15회) 30(15회) 40(8회)+바로25(15회)` — 3세트 중 마지막만 드롭
- `15(10회)+바로20(10회) 25(15회) 35(8회)+바로20(15회)` — 1, 3세트가 드롭 (위치 가변)
- 드롭은 메인 세트의 마지막에만 오는 것이 아님
- 트리플 드롭(3단)은 데이터에 없지만 가능성 열어두면 좋음

요구사항:
- 운동별 무게 추이 차트 → 메인 세트 기준 단순 쿼리
- 카톡 데이터의 `+바로` 토큰을 자연스럽게 매핑
- Supabase 자동 생성 TS 타입의 정확성

## Considered Options

### Option A: Self-reference (parent_set_id)
메인 세트와 드롭이 각자 row, `parent_set_id`로 연결.
```sql
workout_sets (
  id, session_id, exercise_id,
  set_number,
  weight_kg, reps,
  parent_set_id REFERENCES workout_sets(id),
  drop_order
)
```

### Option B: Sub-table (set_phases)
모든 세트가 phase의 집합. 일반 세트는 phase 1개.
```sql
workout_sets (id, session_id, exercise_id, set_number)
set_phases (id, set_id, phase_order, weight_kg, reps)
```

### Option C: JSONB
```sql
workout_sets (id, ..., phases JSONB)
```

## Decision

**Option A 채택.**

### 핵심 스키마

```sql
workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES workout_sessions(id),
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  set_number SMALLINT NOT NULL,            -- 1, 2, 3 (메인 세트 번호)
  weight_kg NUMERIC(5,1),
  reps SMALLINT,
  parent_set_id UUID REFERENCES workout_sets(id) ON DELETE CASCADE,
  drop_order SMALLINT DEFAULT 0,           -- 0=메인, 1=1차 드롭, 2=2차 드롭
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),

  CHECK (drop_order = 0 OR parent_set_id IS NOT NULL),
  CHECK (drop_order >= 0)
);

-- 메인 세트 중복 방지 (side는 ADR-003에서 추가됨 — 단측 운동의 좌/우 분리 기록 허용)
CREATE UNIQUE INDEX uniq_main_set
  ON workout_sets (session_id, exercise_id, set_number, side)
  WHERE parent_set_id IS NULL;
```

**`is_drop_set` 컬럼은 제거** — `parent_set_id IS NOT NULL`로 도출 가능. 중복 컬럼은 정합성 리스크.

### 기각 이유

| 옵션 | 기각 이유 |
|------|-----------|
| B. set_phases | 80%+ 일반 세트도 매번 JOIN 필요. 무게 추이 쿼리에 비용 추가. |
| C. JSONB | Supabase 자동 TS 타입이 `Json`으로 무타입. 집계(`AVG/MAX`) 인덱싱/검증 어려움. 포트폴리오 시그널 약함. |

## Consequences

### Positive
- **쿼리 단순성**: 추이 차트는 `WHERE parent_set_id IS NULL` 한 줄로 메인 세트만 조회
- **타입 안전성**: Supabase `gen types`로 정확한 TS 타입 자동 생성
- **임포트 단순**: 카톡 `+바로` 토큰을 자식 row 생성 트리거로 직역 매핑
- **CASCADE 삭제**: 메인 세트 삭제 시 드롭 자식 자동 정리
- **확장성**: 트리플 드롭도 `drop_order=2`로 자연 지원

### Negative
- Self-reference 쿼리 패턴에 익숙하지 않으면 학습 비용
- 메인/드롭이 같은 row 형태라 UI에서 그룹핑 로직 필요

### Mitigation
- 임포트 시 검증 함수 작성 (drop_order, parent_set_id 일관성)
- UI 헬퍼 함수: `groupSetsByMain()` 등 단순한 클라이언트 헬퍼

## Implementation Notes

### 카톡 데이터 매핑 예시
`랫풀다운 20(15회) 30(15회) 40(8회)+바로25(15회)` →

| set_number | weight_kg | reps | parent_set_id | drop_order |
|-----------|-----------|------|---------------|-----------|
| 1 | 20 | 15 | NULL | 0 |
| 2 | 30 | 15 | NULL | 0 |
| 3 | 40 | 8 | NULL | 0 |
| 3 | 25 | 15 | Row3.id | 1 |

### 추이 차트 쿼리
```sql
SELECT s.started_at::date AS date, ws.weight_kg, ws.reps
FROM workout_sets ws
JOIN workout_sessions s ON s.id = ws.session_id
WHERE ws.exercise_id = :id
  AND ws.parent_set_id IS NULL
ORDER BY s.started_at, ws.set_number;
```

## References
- Architect 에이전트 검토 (2026-05-22)
- Supabase TypeScript type generation behavior (JSONB → `Json` untyped)
