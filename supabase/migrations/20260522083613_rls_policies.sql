-- ADR-005, 008: 본인 row만 접근
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_body_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_template_body_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;

-- 본인 직접 소유 row
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
