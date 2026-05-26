-- ADR-001: body_parts 룩업 테이블 (글로벌 read-only)
CREATE TABLE body_parts (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name_ko TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  display_order INT NOT NULL
);

ALTER TABLE body_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read body_parts" ON body_parts FOR SELECT USING (true);
-- 쓰기는 service_role(시드/마이그레이션)에서만
