-- WordPress-compatible news schema.
-- Idempotent upgrade from the first posts/gallery draft.

BEGIN;

ALTER TABLE post_categories
  ADD COLUMN IF NOT EXISTS wp_source_id integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
DROP INDEX IF EXISTS post_categories_wp_source_id_key;
CREATE UNIQUE INDEX post_categories_wp_source_id_key
  ON post_categories (wp_source_id);

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS wp_source_id integer,
  ADD COLUMN IF NOT EXISTS content_format text NOT NULL DEFAULT 'html',
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS author_name text;
DROP INDEX IF EXISTS posts_wp_source_id_key;
CREATE UNIQUE INDEX posts_wp_source_id_key
  ON posts (wp_source_id);

CREATE TABLE IF NOT EXISTS post_category_links (
  post_id uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES post_categories (id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_post_category_links_category
  ON post_category_links (category_id);

-- Preserve a category from the initial one-to-many draft before removing it.
INSERT INTO post_category_links (post_id, category_id)
SELECT id, category_id FROM posts WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;
DROP INDEX IF EXISTS idx_posts_category;
ALTER TABLE posts DROP COLUMN IF EXISTS category_id;

CREATE TABLE IF NOT EXISTS post_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  wp_source_id integer,
  role text NOT NULL DEFAULT 'content',
  source_url text,
  url text NOT NULL,
  alt_text text,
  caption text,
  mime_type text,
  width integer,
  height integer,
  file_size bigint,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, source_url)
);
CREATE INDEX IF NOT EXISTS idx_post_images_post_sort
  ON post_images (post_id, sort_order);

COMMENT ON TABLE post_category_links IS 'Quan hệ nhiều-nhiều bài viết và danh mục WordPress';
COMMENT ON TABLE post_images IS 'Ảnh cover/content của bài; giữ URL nguồn và URL local';

COMMIT;
