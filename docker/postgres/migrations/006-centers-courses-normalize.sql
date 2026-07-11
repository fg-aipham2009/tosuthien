-- Expand centers + courses for thiền đường directory
-- (region grouping, abbot metadata, typed khóa tu / an cư schedules)

ALTER TABLE centers
  ADD COLUMN IF NOT EXISTS abbot_rank text,
  ADD COLUMN IF NOT EXISTS abbot_title text,
  ADD COLUMN IF NOT EXISTS org_role text,
  ADD COLUMN IF NOT EXISTS gender_section text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS province text;

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS recurrence text,
  ADD COLUMN IF NOT EXISTS day_start integer,
  ADD COLUMN IF NOT EXISTS day_end integer,
  ADD COLUMN IF NOT EXISTS weekday integer,
  ADD COLUMN IF NOT EXISTS schedule_text text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_centers_region ON centers (region);
CREATE INDEX IF NOT EXISTS idx_centers_province ON centers (province);
CREATE INDEX IF NOT EXISTS idx_courses_center ON courses (center_id);
CREATE INDEX IF NOT EXISTS idx_courses_type ON courses (type);

COMMENT ON COLUMN centers.region IS 'BAC | TRUNG | NAM | NUOC_NGOAI';
COMMENT ON COLUMN centers.gender_section IS 'TANG | NI';
COMMENT ON COLUMN courses.type IS 'REGULAR | SPRING | WINTER | AN_CU | OTHER';
COMMENT ON COLUMN courses.recurrence IS 'ONCE | WEEKLY | MONTHLY_RANGE | YEARLY | SELF_PRACTICE';
