# ADR-001: 운동 부위(Body Part) 모델링 방식

- **Status:** Accepted
- **Date:** 2026-05-22
- **Decider:** HJ

## Context

1인용 헬스 루틴 관리 웹앱의 데이터 모델 설계 단계에서, "운동 부위(body part)"를 어떻게 표현할지 결정 필요.

카톡 셀프챗에 1년간 누적된 운동 기록을 분석한 결과, 다음 두 가지 제약이 확인됨:

1. **부위 분류가 유동적**: "하체"로 묶기도 하고 ("Pt 하체"), 때로는 "허벅지/엉덩이/하체"로 세분화 ("개인운동 허벅지 + 등", "하체 엉덩이").
2. **한 운동 = 복수 부위**: 데드리프트(등+하체), 업라이트로우+페이스풀(어깨+승모), 가슴+승모근 케어 운동(목디스크용) 등.

추가 제약:
- 추후 인바디/눈바디 기능 확장 가능성
- UI에서 부위별 색상/아이콘/정렬 순서 표현 필요
- 포트폴리오 어필 목적 (정규화된 설계 선호)

## Considered Options

### Option A: Postgres ENUM
```sql
CREATE TYPE body_part AS ENUM ('chest', 'back', 'shoulder', 'leg', ...);
ALTER TABLE exercises ADD COLUMN body_part body_part NOT NULL;
```

### Option B: Lookup table + Junction table (M:N)
```sql
body_parts (id, code, name_ko, color, icon, display_order)
exercises  (id, name, equipment, default_sets, ...)
exercise_body_parts (exercise_id, body_part_id, is_primary)
```

### Option C: TEXT 컬럼 + TypeScript Union 타입
```typescript
type BodyPart = 'chest' | 'back' | ...;
```

## Decision

**Option B** 채택: `body_parts` 룩업 테이블 + `exercise_body_parts` 정션 테이블 (M:N 관계, `is_primary` 플래그 포함).

### 기각 이유

| 옵션 | 기각 이유 |
|------|-----------|
| A. ENUM | M:N 불가능. ALTER TYPE 마이그레이션 고통 (값 삭제 불가, 순서 변경 workaround 필요). 부위 세분화 변경마다 DDL. UI 메타데이터 별도 관리. |
| C. TEXT + Union | 정규화 부재로 오타 취약. 런타임 타입 안전성만 의존. M:N은 JSON 배열로 우회 가능하나 쿼리 복잡. |

## Consequences

### Positive
- **M:N 자연 지원**: `데드리프트 → [등(primary), 하체(secondary)]` 표현 가능
- **UI 메타데이터 동거**: 색상/아이콘/정렬 순서를 DB에 함께 저장
- **Supabase PostgREST 활용**: nested select로 `?select=*,body_parts(*)` 한 줄 JOIN
- **타입 안전성 확보**: `supabase gen types typescript`로 DB 스키마에서 TS 타입 자동 생성
- **확장성**: 인바디 측정 부위, 눈바디 부위 등도 `body_part_id` FK로 자연스럽게 연결
- **포트폴리오 가치**: 정규화된 설계 역량 증명

### Negative
- 테이블 3개 추가 (body_parts, exercise_body_parts) → 초기 세팅 코드 증가
- 시드 데이터 1회 작성 필요 (`seed.sql`에 8~10행)

### Mitigation
- `seed.sql` 1회 작성으로 끝 (운영 중 부위 추가 시에도 INSERT 한 줄)
- Supabase PostgREST가 정션 테이블 쿼리를 단순화

## Implementation Notes

### body_parts 초기 시드 (예정)
| code | name_ko | color | display_order |
|------|---------|-------|---------------|
| chest | 가슴 | #FF6B6B | 1 |
| back | 등 | #4ECDC4 | 2 |
| shoulder | 어깨 | #FFE66D | 3 |
| trap | 승모근 | #95E1D3 | 4 |
| arm | 팔 | #C9B1FF | 5 |
| leg | 허벅지 | #F38181 | 6 |
| glute | 엉덩이 | #FCBAD3 | 7 |
| core | 복부 | #A8E6CF | 8 |

### is_primary 활용 시나리오
- 캘린더 오운완 표시 → primary body_part의 color/icon 사용
- 부위별 추이 차트 → primary 기준 분류
- 볼륨 집계 (총 운동량) → primary + secondary 모두 합산

## References

- Architect 에이전트 검토 결과 (2026-05-22)
- Supabase docs: PostgREST nested select, `supabase gen types typescript`
- Postgres docs: ENUM 제약 (ALTER TYPE 한계)
