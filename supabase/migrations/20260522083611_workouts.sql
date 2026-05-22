-- 운동 세션
CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_template_id UUID REFERENCES routine_templates(id) ON DELETE SET NULL,
                                  -- nullable: ad-hoc 운동(템플릿 없이 즉흥) 허용
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  overall_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_workout_sessions_user_date ON workout_sessions (user_id, started_at);

-- 세트 기록 (ADR-002 self-ref drop sets + ADR-003 side)
CREATE TABLE workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
                                  -- 과거 기록 보호: 운동 삭제 시 history 있으면 차단
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
