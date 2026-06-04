-- 진행 중 세션의 "계획된 운동 목록"을 DB에 저장.
-- 기존: 운동 목록이 URL ?exercises= 로만 전달돼 세트 0개 운동은 복귀 시 손실.
-- 변경: 세션 시작 시 선택한 운동 ID 배열을 저장 → 세트 입력 전이라도 복원 가능.
ALTER TABLE workout_sessions
  ADD COLUMN IF NOT EXISTS planned_exercise_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];
