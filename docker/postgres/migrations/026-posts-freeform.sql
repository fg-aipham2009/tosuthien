-- Free-form tin tức: optional body vs images, persist post kind.
BEGIN;

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'news';

ALTER TABLE posts
  DROP CONSTRAINT IF EXISTS posts_kind_check;

ALTER TABLE posts
  ADD CONSTRAINT posts_kind_check
  CHECK (kind IN ('news', 'class', 'center'));

ALTER TABLE posts
  ALTER COLUMN title SET DEFAULT 'Tin tức';

-- Infer kind for existing rows (class notices have teacher/schedule).
UPDATE posts
SET kind = 'class'
WHERE kind = 'news'
  AND (
    NULLIF(BTRIM(COALESCE(teacher_text, '')), '') IS NOT NULL
    OR NULLIF(BTRIM(COALESCE(schedule_text, '')), '') IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_posts_kind ON posts (kind);

COMMENT ON COLUMN posts.kind IS 'news = free-form (images and/or description); class = lớp học; center = thiền đường';
COMMENT ON COLUMN posts.description IS 'Optional body. A post may have description, images, or both.';
COMMENT ON COLUMN posts.content IS 'HTML/text body; kept in sync with description for free-form news.';

COMMIT;
