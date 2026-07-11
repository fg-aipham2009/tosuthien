-- Schema cho centers/courses (chạy TRƯỚC nếu chưa có cột)
ALTER TABLE centers ADD COLUMN IF NOT EXISTS abbot_rank text;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS abbot_title text;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS org_role text;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS gender_section text;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS country_code text;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS province text;
ALTER TABLE centers ALTER COLUMN address DROP NOT NULL;

ALTER TABLE courses ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS recurrence text;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS day_start integer;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS day_end integer;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS weekday integer;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS schedule_text text;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
UPDATE courses SET sort_order = 0 WHERE sort_order IS NULL;

CREATE INDEX IF NOT EXISTS idx_centers_region ON centers (region);
CREATE INDEX IF NOT EXISTS idx_centers_province ON centers (province);
CREATE INDEX IF NOT EXISTS idx_courses_center ON courses (center_id);
CREATE INDEX IF NOT EXISTS idx_courses_type ON courses (type);
