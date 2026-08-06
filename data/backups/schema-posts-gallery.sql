-- Tin tức + Hình ảnh cho site clone + admin Vue
-- Pattern khớp centers/media: uuid PK, slug, is_published, sort_order, URL string (/files/...)
-- Ảnh lưu disk: DATA_ROOT/images/posts/, DATA_ROOT/images/gallery/

BEGIN;

CREATE TABLE IF NOT EXISTS post_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wp_source_id integer UNIQUE,
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_categories_sort
  ON post_categories (sort_order);

CREATE TABLE IF NOT EXISTS posts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wp_source_id     integer UNIQUE,
  slug             text NOT NULL UNIQUE,
  title            text NOT NULL,
  excerpt          text,
  content          text,
  content_format   text NOT NULL DEFAULT 'html',
  cover_image_url  text,
  source_url       text,
  author_name      text,
  seo_title        text,
  seo_description  text,
  published_at     timestamptz,
  is_pinned        boolean NOT NULL DEFAULT false,
  sort_order       integer NOT NULL DEFAULT 0,
  is_published     boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_published_at
  ON posts (is_published, published_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_posts_pinned_sort
  ON posts (is_pinned, sort_order);

CREATE TABLE IF NOT EXISTS post_category_links (
  post_id     uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES post_categories (id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_post_category_links_category
  ON post_category_links (category_id);

CREATE TABLE IF NOT EXISTS post_images (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  wp_source_id integer,
  role         text NOT NULL DEFAULT 'content',
  source_url   text,
  url          text NOT NULL,
  alt_text     text,
  caption      text,
  mime_type    text,
  width        integer,
  height       integer,
  file_size    bigint,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, source_url)
);

CREATE INDEX IF NOT EXISTS idx_post_images_post_sort
  ON post_images (post_id, sort_order);

CREATE TABLE IF NOT EXISTS gallery_albums (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text NOT NULL UNIQUE,
  title            text NOT NULL,
  description      text,
  cover_image_url  text,
  sort_order       integer NOT NULL DEFAULT 0,
  is_published     boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gallery_albums_sort
  ON gallery_albums (sort_order);

CREATE INDEX IF NOT EXISTS idx_gallery_albums_published
  ON gallery_albums (is_published);

CREATE TABLE IF NOT EXISTS gallery_images (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id      uuid NOT NULL REFERENCES gallery_albums (id) ON DELETE CASCADE,
  url           text NOT NULL,
  caption       text,
  alt_text      text,
  width         integer,
  height        integer,
  sort_order    integer NOT NULL DEFAULT 0,
  is_published  boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gallery_images_album
  ON gallery_images (album_id);

CREATE INDEX IF NOT EXISTS idx_gallery_images_album_sort
  ON gallery_images (album_id, sort_order);

COMMENT ON TABLE post_categories IS 'Danh mục tin tức (admin Vue)';
COMMENT ON TABLE posts IS 'Tin tức / bài viết trang web';
COMMENT ON TABLE gallery_albums IS 'Album trang Hình ảnh';
COMMENT ON TABLE gallery_images IS 'Ảnh trong album; file trên disk images/gallery/';

-- Seed danh mục mặc định (tương ứng WP category tin-tuc)
INSERT INTO post_categories (wp_source_id, slug, name, description, sort_order)
VALUES
  (2, 'tin-tuc', 'Tin Tức', 'Tin tức và thông báo chung', 0)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
