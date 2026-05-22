# ADR-008: 운동 카탈로그 소유권 모델 (Per-user Catalog)

- **Status:** Accepted
- **Date:** 2026-05-22
- **Decider:** HJ
- **Supersedes:** Spec 초안의 "exercises read-only public" RLS 정책

## Context

초기 설계에서는 `exercises` 테이블을 글로벌 카탈로그(read-only public)로 두고, 쓰기는 service_role에만 허용했음. 그러나 spec Phase 5에 **앱 내 운동 추가/편집/삭제 페이지** 요구사항이 존재 → 인증 사용자의 INSERT/UPDATE/DELETE 경로가 없어 **실행 불가**.

Critic 검토(2026-05-22)에서 Critical issue로 식별됨.

## Considered Options

| Option | 설명 | 트레이드오프 |
|--------|------|--------------|
| **A. Per-user catalog** | `exercises`에 `user_id` 추가, RLS는 본인 row만 | 가장 단순. 1인용에 적합. 친구 공유 시 자연 확장 (각자 카탈로그) |
| B. Server Action + service_role 프록시 | 카탈로그는 글로벌, 쓰기는 백엔드 API에서 service_role로만 | 보안 경계 명시 필요. 글로벌 의미가 1인용에 무의미 |
| C. Dashboard-only | Phase 5 UI 제거, Supabase Dashboard로만 운동 관리 | UX 후퇴. 헬스장에서 새 운동 즉시 추가 불가 |

## Decision

**Option A 채택**: per-user exercise catalog.

### 영향받는 테이블 스키마 변경

```sql
-- exercises 테이블
ALTER TABLE exercises
  ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX idx_exercises_user_id ON exercises (user_id);

-- 기존 read-only public 정책 제거
DROP POLICY IF EXISTS "read exercises" ON exercises;

-- 본인 row만 모든 작업 가능
CREATE POLICY "own exercises" ON exercises
  FOR ALL USING (auth.uid() = user_id);
```

### exercise_body_parts (junction table) RLS

부모 exercise의 소유자만 junction row 조작 가능:

```sql
-- 기존 read-only public 제거
DROP POLICY IF EXISTS "read exercise_body_parts" ON exercise_body_parts;

CREATE POLICY "own exercise_body_parts" ON exercise_body_parts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM exercises e
      WHERE e.id = exercise_id AND e.user_id = auth.uid()
    )
  );
```

### body_parts (마스터)는 글로벌 유지

부위 카테고리는 도메인 상수 수준 (가슴/등/어깨 등 8행) → 글로벌 read-only 유지.

```sql
-- 변경 없음 (read-only public 유지)
-- CREATE POLICY "read body_parts" ON body_parts FOR SELECT USING (true);
```

## Consequences

### Positive
- **Critical issue 해결**: 앱 내에서 정상적인 운동 CRUD 가능
- **RLS 단순화**: 모든 user-owned 테이블이 동일 패턴 (`auth.uid() = user_id`)
- **자연스러운 멀티유저 확장**: 친구가 가입하면 각자 카탈로그 분리됨
- **데이터 격리**: 본인 운동 카탈로그가 타인에게 노출되지 않음
- **시드 임포트 일관성**: ADR-004의 카톡 임포트도 본인 user_id로 INSERT

### Negative
- 카탈로그가 글로벌 공유 자산이 아님 → 추후 멀티유저 시 "공통 운동 사전"이 없음
- 카톡 임포트 시 `user_id`를 명시적으로 넣어야 함 (단순한 작업)

### Mitigation
- 추후 멀티유저 + 공통 카탈로그 필요해지면 ADR-XXX로 "global_exercises 베이스 + user_exercises 오버라이드" 패턴 검토
- 현재는 1인용이므로 무의미한 분리

## Implementation Notes

### 시드 데이터 (ADR-004 임포트) 처리
```typescript
// 임포트 시 user_id 명시
const exercises = parsedExercises.map(e => ({
  ...e,
  user_id: currentUser.id,  // OAuth 로그인 후 본인 ID
}));
```

### 운동 추가 UI 패턴
- Client component에서 `useMutation` + Supabase client 직접 INSERT
- RLS가 자동으로 user_id 검증
- INSERT 시 user_id 명시적 세팅 또는 trigger로 자동 세팅 가능

### Trigger로 user_id 자동 주입 (NULL-check 패턴)
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

CREATE TRIGGER trg_exercises_user_id
  BEFORE INSERT ON exercises
  FOR EACH ROW EXECUTE FUNCTION set_user_id_default();
```
→ 클라이언트가 user_id 안 보내도 자동 채워짐. 보안성 ↑.

**왜 NULL-check 패턴인가** (critic 재검토 반영):
- 무조건 `NEW.user_id := auth.uid()`로 덮어쓰면 **service_role 컨텍스트에서 `auth.uid()`가 NULL** → NOT NULL 제약 위반
- ADR-004의 카톡 임포트 파이프라인은 service_role로 시드 INSERT 수행 → 이때 명시적 user_id 세팅이 필요
- NULL-check 패턴은: 클라이언트 일반 사용 시 자동 주입 + service_role 임포트 시 명시적 user_id 허용 둘 다 지원

**SECURITY DEFINER 주의:** 함수가 owner(보통 postgres) 권한으로 실행되지만, `auth.uid()`는 호출자의 JWT 컨텍스트에서 작동. Phase 1 시작 시 동작 검증 권장.

## References
- Critic 에이전트 검토 결과 (2026-05-22) — Critical issue
- ADR-001 (M:N body parts), ADR-005 (Auth + RLS 패턴)와 정합
