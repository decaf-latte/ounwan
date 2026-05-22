# ADR-003: 좌우 비대칭(side) 처리 방식

- **Status:** Accepted
- **Date:** 2026-05-22
- **Decider:** HJ

## Context

운동의 좌우 비대칭(unilateral 변형, 좌/우 분리 기록)을 어떻게 표현할지 결정.

카톡 데이터에서 발견된 두 가지 패턴:

**패턴 1: 구조적으로 다른 운동 (unilateral 변형)**
- `한발씩 0 0 5` — "한발씩" 변형 (자세, 무게 범위, 자극 부위 다름)
- `원레그 데드리프트` — 단일 다리 변형
- `랫풀다운(한팔씩 1세트 15회)` — 단일 팔 변형
- `한팔 케이블컬` — 단일 팔

**패턴 2: 같은 운동에서 좌/우 차이 추적**
- `원레그데드리프트 (스미스) 빈바 5 5(한발떼고)` — 좌우 다르게 수행
- 세션 메모: `왼쪽 등이 너무 굳어있음`, `왼쪽 힙힌지 안됨`

이 둘은 **다른 도메인 개념**이므로 분리 모델링 필요.

## Considered Options

### Option X: side 컬럼만 추가
```sql
workout_sets ADD COLUMN side TEXT
  CHECK (side IN ('both','left','right')) DEFAULT 'both';
```
"레그프레스 한발씩"과 "레그프레스 (left)" 구분 불가 → 운동 카탈로그 메타데이터 부재.

### Option Y: 운동 변형을 별도 exercise로 등록
- "레그프레스", "레그프레스 한발씩 (좌)", "레그프레스 한발씩 (우)" 3개 row
- side 컬럼 없음
- 운동 카탈로그가 3배로 부풀어오름. "단측 운동" 필터링이 문자열 매칭 문제 됨.

### Option Z: 하이브리드
- 양측/단측 변형은 별도 exercise로 분리 (자세가 다름)
- `exercises.is_unilateral` 플래그 + `parent_exercise_id`로 base 운동 연결
- `workout_sets.side` 컬럼은 단측 변형 안에서 좌/우 구분에만 사용

## Decision

**Option Z (하이브리드) 채택.**

### 핵심 스키마

```sql
-- 운동 마스터 (부위 매핑은 ADR-001의 M:N 정션 exercise_body_parts로 처리)
exercises (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  is_unilateral BOOLEAN DEFAULT FALSE,
  parent_exercise_id UUID REFERENCES exercises(id),  -- base 운동 연결 (variant)
  ...
);

-- 부위 매핑은 별도 정션 (ADR-001 참조)
-- exercise_body_parts (exercise_id, body_part_id, is_primary)

-- ADR-002와 결합
ALTER TABLE workout_sets
  ADD COLUMN side TEXT
  CHECK (side IN ('both','left','right'))
  DEFAULT 'both';
```

### 운동 등록 예시

| name | is_unilateral | parent_exercise_id |
|------|---------------|---------------------|
| 레그프레스 | false | NULL |
| 레그프레스 (한발씩) | true | 레그프레스.id |
| 랫풀다운 | false | NULL |
| 랫풀다운 (한팔씩) | true | 랫풀다운.id |
| 원레그 데드리프트 | true | 데드리프트.id (선택) |

### 기각 이유

| 옵션 | 기각 이유 |
|------|-----------|
| X. side만 | "레그프레스 side=left"와 "한발 레그프레스 side=left" 구분 불가. 운동 단계의 분류가 빠짐. |
| Y. 변형 분리만 | 단측 운동 1개당 3개 row 필요. L/R 불균형 추적이 운동 분리되어 쿼리 복잡. 좌/우 메타가 변형 이름에 묻혀 분류 불가. |

## Consequences

### Positive
- **두 도메인 개념 분리**: "단측 변형"과 "좌/우 추적"이 독립적으로 모델링
- **UI 조건부 렌더**: `is_unilateral=true`일 때만 L/R 입력 UI 표시
- **임포트 친화적**: 대부분의 카톡 기록이 좌/우 구분 안 함 → `side='both'` 기본값으로 자연 흡수
- **장래 불균형 추적 가능**: `side='left'`/`'right'` 분리 기록으로 좌우 비교 차트 작성 가능
- **drop_order와 직교**: 단측 운동 + 드롭세트 조합도 모델 충돌 없음

### Negative
- exercises 테이블에 컬럼 2개 추가 (is_unilateral, parent_exercise_id)
- 초기 시드에서 변형 운동의 base 매핑 작업 필요

### Mitigation
- 시드 데이터는 운동 카탈로그(약 50개) 1회만 작성하면 끝
- parent_exercise_id는 nullable이라 base 매핑 선택 사항

## Implementation Notes

### 카톡 데이터 매핑

| 원본 텍스트 | exercise | side | 메모 |
|-----------|----------|------|------|
| `한발씩 5` | 레그프레스 (한발씩) | both | (좌우 분리 안 함) |
| `원레그데드리프트 5 5(한발떼고)` | 원레그 데드리프트 | both | "한발떼고" 메모 |
| `랫풀다운(한팔씩 15회)` | 랫풀다운 (한팔씩) | both | - |
| `왼쪽 등이 너무 굳어있음` | (세션 메모) | - | session.overall_notes |

대부분의 과거 기록은 `side='both'`로 임포트. 새 기록부터 좌/우 분리 가능.

### 통합 시나리오: 단측 드롭세트
"한팔 케이블컬, 왼팔, 15kg×10 → 10kg×12 드롭"

| set_number | weight_kg | reps | side | parent_set_id | drop_order |
|-----------|-----------|------|------|---------------|-----------|
| 1 | 15 | 10 | left | NULL | 0 |
| 1 | 10 | 12 | left | Row1.id | 1 |

side와 parent_set_id는 직교 차원 — 충돌 없음.

## References
- Architect 에이전트 검토 (2026-05-22)
- ADR-001 (body_parts), ADR-002 (drop sets)와 정합성 확인됨
