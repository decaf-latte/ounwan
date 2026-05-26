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
-- 본인 카탈로그 내 운동명 중복 방지 (critic 검토 반영)
CREATE UNIQUE INDEX uniq_exercises_user_name ON exercises (user_id, name);

-- ADR-001: 운동-부위 M:N
CREATE TABLE exercise_body_parts (
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
  body_part_id INT REFERENCES body_parts(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (exercise_id, body_part_id)
);
