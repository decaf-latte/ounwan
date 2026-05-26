-- ADR-008: user_id 자동 주입 트리거 (NULL-check 패턴)
-- service_role 컨텍스트에서 auth.uid()는 NULL → 시드/임포트 시 명시적 user_id 세팅 허용
CREATE OR REPLACE FUNCTION set_user_id_default()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_exercises_user_id BEFORE INSERT ON exercises
  FOR EACH ROW EXECUTE FUNCTION set_user_id_default();
CREATE TRIGGER trg_routines_user_id BEFORE INSERT ON routine_templates
  FOR EACH ROW EXECUTE FUNCTION set_user_id_default();
CREATE TRIGGER trg_sessions_user_id BEFORE INSERT ON workout_sessions
  FOR EACH ROW EXECUTE FUNCTION set_user_id_default();
