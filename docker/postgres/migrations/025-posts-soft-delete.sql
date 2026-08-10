-- Soft-delete for tin tức posts: hide from all lists when is_deleted = true.
BEGIN;

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_posts_not_deleted
  ON posts (is_deleted, created_at DESC)
  WHERE is_deleted = false;

COMMENT ON COLUMN posts.is_deleted IS 'Soft delete flag — excluded from API/site queries when true';

COMMIT;
