-- =============================================================================
-- Schema — App Tổ Sư Thiền (Hoà thượng Thích Duy Lực)
-- PostgreSQL 15+ | extension pgvector
--
-- Database name:  tosuthien
-- User / pass:     tosuthien / thamthien
-- Tạo DB:         CREATE DATABASE tosuthien;
-- Chạy schema:    psql -U tosuthien -d tosuthien -f schema.sql
--
-- Kiến trúc (PDF và RAG tách hẳn — không FK, không bảng chung):
--   PDF     → pdf_files        → VPS /data/pdf/           → Tab Kinh sách
--   RAG     → rag_sources + passages + passage_embeddings → Tab Hỏi đáp (text/*.txt)
--   Media   → media_categories (shared) + mp3_tracks | youtube_videos
--   Centers → centers + courses
--   Reading → reading_progress (device_id + PDF page, không cần đăng nhập)
--
-- Tài liệu: docs/README.md
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- 1. PDF — riêng biệt, chỉ phục vụ đọc (Tab Kinh sách)
-- Path gốc VPS: /data/pdf/
-- Không liên kết RAG — cùng tên file (13.pdf / 13.txt) chỉ là quy ước đặt tên
-- =============================================================================

CREATE TABLE pdf_files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  volume          TEXT,
  author          TEXT NOT NULL DEFAULT 'Hòa thượng Thích Duy Lực',
  filename        TEXT NOT NULL,              -- '13.pdf'
  folder_path     TEXT NOT NULL DEFAULT 'pdf/',
  storage_path    TEXT NOT NULL UNIQUE,       -- 'pdf/13.pdf'
  public_url      TEXT NOT NULL,              -- 'https://domain.com/pdf/13.pdf'
  page_count      INT,
  file_size_bytes BIGINT,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pdf_files_sort ON pdf_files(sort_order);

-- Tiến độ đọc PDF theo máy (UUID app gửi lên, header X-Device-Id)
-- LEFT JOIN khi list sách → trả luôn last_page, mở đúng trang
CREATE TABLE reading_progress (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id    TEXT NOT NULL,                  -- UUID sinh 1 lần trên Flutter
  pdf_file_id  UUID NOT NULL REFERENCES pdf_files(id) ON DELETE CASCADE,
  last_page    INT NOT NULL DEFAULT 1 CHECK (last_page >= 1),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (device_id, pdf_file_id)
);

CREATE INDEX idx_reading_progress_device ON reading_progress(device_id);
CREATE INDEX idx_reading_progress_pdf ON reading_progress(pdf_file_id);

-- =============================================================================
-- 2. RAG — riêng biệt, chỉ phục vụ hỏi đáp (Tab Hỏi đáp)
-- Nguồn: text/*.txt → ingest.py → passages → embed.py
-- Không dùng PDF, không FK sang pdf_files
-- =============================================================================

CREATE TABLE rag_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  title         TEXT NOT NULL,
  volume        TEXT,
  author        TEXT NOT NULL DEFAULT 'Hòa thượng Thích Duy Lực',
  source_file   TEXT NOT NULL UNIQUE,         -- '13.txt'
  folder_path   TEXT NOT NULL DEFAULT 'text/',
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'ingested', 'embedded')),
  chunk_count   INT DEFAULT 0,
  ingested_at   TIMESTAMPTZ,
  embedded_at   TIMESTAMPTZ,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rag_sources_status ON rag_sources(status);
CREATE INDEX idx_rag_sources_sort ON rag_sources(sort_order);

CREATE TABLE passages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rag_source_id  UUID NOT NULL REFERENCES rag_sources(id) ON DELETE CASCADE,
  page_num       INT,
  chunk_type     TEXT NOT NULL DEFAULT 'prose'
                   CHECK (chunk_type IN ('qa', 'prose', 'verse')),
  question_num   INT,
  content        TEXT NOT NULL,
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_passages_rag_page ON passages(rag_source_id, page_num);
CREATE INDEX idx_passages_chunk_type ON passages(chunk_type);
CREATE INDEX idx_passages_fts ON passages USING gin(to_tsvector('simple', content));

CREATE TABLE passage_embeddings (
  passage_id  UUID PRIMARY KEY REFERENCES passages(id) ON DELETE CASCADE,
  embedding   vector(384) NOT NULL,
  model       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- CREATE INDEX idx_passage_embeddings_hnsw
--   ON passage_embeddings USING hnsw (embedding vector_cosine_ops);

-- Lịch sử chat: lưu local trên Flutter (SQLite/Hive), không bảng server — không đăng nhập

-- =============================================================================
-- 4. MEDIA — MP3 and YouTube in separate tables; shared media_categories
-- MP3 path on VPS: /data/audio/
-- e.g. duy-luc/phap-thoai-to-su-thien/1993/
-- =============================================================================

CREATE TABLE media_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE mp3_tracks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     UUID NOT NULL REFERENCES media_categories(id) ON DELETE RESTRICT,
  title           TEXT NOT NULL,
  year            INT NOT NULL,
  recorded_at     DATE,
  location        TEXT,
  description     TEXT,
  folder_path     TEXT NOT NULL,
  filename        TEXT NOT NULL,
  storage_path    TEXT NOT NULL UNIQUE,
  public_url      TEXT NOT NULL,
  duration_sec    INT,
  file_size_bytes BIGINT,
  sort_order      INT DEFAULT 0,
  is_published    BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mp3_tracks_category ON mp3_tracks(category_id);
CREATE INDEX idx_mp3_tracks_year ON mp3_tracks(year);
CREATE INDEX idx_mp3_tracks_category_year ON mp3_tracks(category_id, year DESC);
CREATE INDEX idx_mp3_tracks_folder ON mp3_tracks(folder_path);

CREATE TABLE youtube_videos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     UUID NOT NULL REFERENCES media_categories(id) ON DELETE RESTRICT,
  title           TEXT NOT NULL,
  youtube_id      TEXT NOT NULL,
  channel         TEXT DEFAULT 'Hoà thượng Thích Duy Lực',
  year            INT,
  published_at    DATE,
  description     TEXT,
  sort_order      INT DEFAULT 0,
  is_published    BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_youtube_videos_category ON youtube_videos(category_id);
CREATE INDEX idx_youtube_videos_year ON youtube_videos(year);
CREATE INDEX idx_youtube_videos_category_year ON youtube_videos(category_id, year DESC);

-- =============================================================================
-- 5. MEDITATION CENTERS & COURSES
-- =============================================================================

CREATE TABLE centers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             TEXT UNIQUE,
  temple_name      TEXT NOT NULL,
  abbot_name       TEXT,
  address          TEXT NOT NULL,
  phone            TEXT,
  abbot_phone      TEXT,
  google_maps_url  TEXT,
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  activity_hours   TEXT,
  rules            TEXT,
  customs          TEXT,
  main_image_url   TEXT,                       -- ảnh chính (cover)
  gallery_images   JSONB NOT NULL DEFAULT '[]', -- ảnh phụ [{url, caption?, sort_order}]
  detail_content   TEXT,                       -- trang giới thiệu chi tiết (HTML/Markdown)
  sort_order       INT DEFAULT 0,
  is_published     BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_centers_sort ON centers(sort_order);

CREATE TABLE courses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  start_date  DATE,
  end_date    DATE,
  center_id   UUID REFERENCES centers(id) ON DELETE SET NULL,
  contact     TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
-- =============================================================================
-- SEED — thiền đường (tùy chọn)
-- =============================================================================
-- INSERT INTO centers (
--   slug, temple_name, abbot_name, address, phone, abbot_phone,
--   google_maps_url, lat, lng, activity_hours, rules, customs,
--   main_image_url, gallery_images, detail_content, sort_order
-- ) VALUES (
--   'Chùa Từ Ân',
--   'HT. Thích ...',
--   'Quận 11, TP. Hồ Chí Minh',
--   '028xxxxxxxx',
--   '09xxxxxxxx',
--   'https://maps.google.com/?q=Chùa+Từ+Ân+Quận+11',
--   10.762622, 106.660172,
--   '5h00–11h00 sáng; 14h00–21h00 chiều',
--   'Giữ im lặng trong thiền đường. Tắt điện thoại khi vào chánh điện.',
--   'Vào chánh điện chắp tay, vái 3 lạy. Mặc trang phục trang nhã.',
--   1
-- );
-- =============================================================================
-- SEED — mục media (dùng chung cho MP3 và YouTube)
-- =============================================================================

INSERT INTO media_categories (slug, name, sort_order) VALUES
  ('phap-thoai-to-su-thien', 'Pháp thoại Tổ Sư Thiền', 1),
  ('thien-huong-dan',        'Hướng dẫn thiền',         2),
  ('phap-hoi',               'Pháp hội',                3),
  ('tung-kinh',              'Tụng kinh',               4);
-- =============================================================================
-- SEED — PDF (bỏ comment khi có DOMAIN)
-- =============================================================================
-- INSERT INTO pdf_files (slug, title, volume, filename, storage_path, public_url, sort_order) VALUES
--   ('duy-luc-ngu-luc-ha-pdf',     'DUY LỰC NGỮ LỤC', 'QUYỂN HẠ',      '13.pdf', 'pdf/13.pdf', 'https://DOMAIN/pdf/13.pdf', 1),
--   ('duy-luc-ngu-luc-thuong-pdf', 'DUY LỰC NGỮ LỤC', 'QUYỂN THƯỢNG', '14.pdf', 'pdf/14.pdf', 'https://DOMAIN/pdf/14.pdf', 2);

-- =============================================================================
-- SEED — RAG text (bỏ comment sau khi có file text/*.txt)
-- =============================================================================
-- INSERT INTO rag_sources (slug, title, volume, source_file, sort_order) VALUES
--   ('duy-luc-ngu-luc-ha-rag',     'DUY LỰC NGỮ LỤC', 'QUYỂN HẠ',      '13.txt', 1),
--   ('duy-luc-ngu-luc-thuong-rag', 'DUY LỰC NGỮ LỤC', 'QUYỂN THƯỢNG', '14.txt', 2);

-- =============================================================================
-- SEED — MP3 mẫu
-- =============================================================================
-- INSERT INTO mp3_tracks (
--   category_id, title, year, recorded_at, location,
--   folder_path, filename, storage_path, public_url, duration_sec
-- )
-- SELECT c.id,
--   'Pháp thoại Tổ Sư Thiền — buổi 1',
--   1993, '1993-10-20', 'Chùa Từ Ân, Q.11',
--   'duy-luc/phap-thoai-to-su-thien/1993/',
--   '1993-10-20-tu-an-01.mp3',
--   'duy-luc/phap-thoai-to-su-thien/1993/1993-10-20-tu-an-01.mp3',
--   'https://DOMAIN/audio/duy-luc/phap-thoai-to-su-thien/1993/1993-10-20-tu-an-01.mp3',
--   3600
-- FROM media_categories c WHERE c.slug = 'phap-thoai-to-su-thien';

-- =============================================================================
-- SEED — YouTube sample
-- =============================================================================
-- INSERT INTO youtube_videos (category_id, title, year, youtube_id)
-- SELECT c.id, 'Pháp thoại Tổ Sư Thiền', 1993, 'VIDEO_ID'
-- FROM media_categories c WHERE c.slug = 'phap-thoai-to-su-thien';

-- =============================================================================
-- Query — MP3 by category + year
-- =============================================================================
-- SELECT DISTINCT t.year, t.folder_path
-- FROM mp3_tracks t
-- JOIN media_categories c ON c.id = t.category_id
-- WHERE c.slug = 'phap-thoai-to-su-thien'
-- ORDER BY t.year DESC;

-- SELECT t.title, t.filename, t.public_url, t.duration_sec
-- FROM mp3_tracks t
-- JOIN media_categories c ON c.id = t.category_id
-- WHERE c.slug = 'phap-thoai-to-su-thien' AND t.year = 1993
-- ORDER BY t.recorded_at, t.sort_order;

-- =============================================================================
-- Query — YouTube same category
-- =============================================================================
-- SELECT v.title, v.youtube_id, v.year
-- FROM youtube_videos v
-- JOIN media_categories c ON c.id = v.category_id
-- WHERE c.slug = 'phap-thoai-to-su-thien'
-- ORDER BY v.year DESC NULLS LAST, v.sort_order;
-- =============================================================================
-- Query — RAG
-- =============================================================================
-- SELECT p.page_num, p.content, r.title, r.volume,
--        1 - (e.embedding <=> :query_vector::vector) AS score
-- FROM passage_embeddings e
-- JOIN passages p ON p.id = e.passage_id
-- JOIN rag_sources r ON r.id = p.rag_source_id
-- ORDER BY e.embedding <=> :query_vector::vector
-- LIMIT 8;

-- =============================================================================
-- Query — PDF list + trang đã đọc (LEFT JOIN)
-- =============================================================================
-- SELECT p.id, p.slug, p.title, p.volume, p.public_url,
--        rp.last_page, rp.updated_at AS last_read_at
-- FROM pdf_files p
-- LEFT JOIN reading_progress rp
--   ON rp.pdf_file_id = p.id AND rp.device_id = :device_id
-- ORDER BY p.sort_order;

-- Upsert khi user đọc / chuyển trang:
-- INSERT INTO reading_progress (device_id, pdf_file_id, last_page)
-- VALUES (:device_id, :pdf_file_id, :page)
-- ON CONFLICT (device_id, pdf_file_id) DO UPDATE SET
--   last_page = EXCLUDED.last_page,
--   updated_at = now();
