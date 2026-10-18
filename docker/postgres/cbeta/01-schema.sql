-- =============================================================================
-- CBETA vector RAG — separate database (NOT tosuthien book app)
--
-- Database name:  cbeta
-- Same Postgres instance / role as tosuthien is OK; no shared tables.
-- Source: data/cbeta/vector_export/{T,X}/*.jsonl (BGE-M3, dim 1024)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS collections (
  code        text PRIMARY KEY,
  name_zh     text,
  name_vi     text,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS works (
  work_code      text PRIMARY KEY,
  collection     text NOT NULL REFERENCES collections (code),
  title_zh       text NOT NULL DEFAULT '',
  source_xml     text,
  chunk_count    int NOT NULL DEFAULT 0,
  batch_chars    int,
  overlap_chars  int,
  model          text NOT NULL DEFAULT 'BAAI/bge-m3',
  dim            int NOT NULL DEFAULT 1024,
  status         text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'embedded', 'error')),
  metadata       jsonb NOT NULL DEFAULT '{}',
  embedded_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cbeta_works_collection
  ON works (collection, work_code);

CREATE TABLE IF NOT EXISTS chunks (
  id                 text PRIMARY KEY,
  work_code          text NOT NULL REFERENCES works (work_code) ON DELETE CASCADE,
  collection         text NOT NULL,
  chunk_index        int NOT NULL,
  content_zh         text NOT NULL,
  title_zh           text,
  juan_no            int,
  juan_label         text,
  paragraph_no_start int,
  paragraph_no_end   int,
  cbeta_ref_start    text,
  cbeta_ref_end      text,
  segment_count      int,
  char_count         int,
  overlap_prefix_chars int,
  metadata           jsonb NOT NULL DEFAULT '{}',
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_code, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_cbeta_chunks_work
  ON chunks (work_code, chunk_index);
CREATE INDEX IF NOT EXISTS idx_cbeta_chunks_collection
  ON chunks (collection);
CREATE INDEX IF NOT EXISTS idx_cbeta_chunks_fts
  ON chunks USING gin (to_tsvector('simple', content_zh));

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_cbeta_chunks_content_trgm
  ON chunks USING gin (content_zh gin_trgm_ops);

CREATE TABLE IF NOT EXISTS chunk_embeddings (
  chunk_id   text PRIMARY KEY REFERENCES chunks (id) ON DELETE CASCADE,
  embedding  vector(1024) NOT NULL,
  model      text NOT NULL DEFAULT 'BAAI/bge-m3',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cbeta_chunk_embeddings_hnsw
  ON chunk_embeddings USING hnsw (embedding vector_cosine_ops);

-- Extracted masters / names (coverage / deep path)
CREATE TABLE IF NOT EXISTS canon_entities (
  id             bigserial PRIMARY KEY,
  name_zh        text NOT NULL,
  kind           text NOT NULL DEFAULT 'master'
                   CHECK (kind IN ('master', 'other')),
  work_code      text REFERENCES works (work_code) ON DELETE CASCADE,
  collection     text,
  chunk_id       text REFERENCES chunks (id) ON DELETE SET NULL,
  juan_no        int,
  mention_count  int NOT NULL DEFAULT 1,
  metadata       jsonb NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name_zh, work_code, kind)
);

CREATE INDEX IF NOT EXISTS idx_cbeta_entities_name
  ON canon_entities (name_zh);
CREATE INDEX IF NOT EXISTS idx_cbeta_entities_work
  ON canon_entities (work_code);
CREATE INDEX IF NOT EXISTS idx_cbeta_entities_kind_count
  ON canon_entities (kind, mention_count DESC);

-- Router: question phrase → collection code (data-driven; not Nest hardcode)
CREATE TABLE IF NOT EXISTS collection_aliases (
  id               bigserial PRIMARY KEY,
  collection_code  text NOT NULL REFERENCES collections (code) ON DELETE CASCADE,
  alias            text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_code, alias)
);

CREATE INDEX IF NOT EXISTS idx_cbeta_collection_aliases_code
  ON collection_aliases (collection_code);

INSERT INTO collections (code, name_zh, name_vi, sort_order) VALUES
  ('T', '大正新脩大藏經', 'Đại Chính Tân Tu Đại Tạng Kinh', 1),
  ('X', '卍新纂大日本續藏經', 'Tân soạn Vạn Tục tạng', 2),
  ('J', '嘉興大藏經', 'Gia Hưng tạng', 3),
  ('B', '大藏經補編', 'Đại tạng kinh bổ biên', 4),
  ('ZW', '藏外佛教文獻', 'Tạng ngoại Phật giáo văn hiến', 5),
  ('I', '北朝佛教石刻拓片百品', 'Thác bản đá Bắc triều', 6),
  ('N', '漢譯南傳大藏經', 'Nam truyền Đại tạng kinh', 7),
  ('G', '佛教大藏經', 'Phật giáo Đại tạng kinh', 8),
  ('D', '國家圖書館善本佛典', 'Thiện bản Phật điển', 9),
  ('GA', '中國佛寺史志彙刊', 'Sử chí chùa TQ', 10),
  ('Y', '印順法師著作集', 'Ấn Thuận', 11),
  ('YP', '演培法師全集', 'Diễn Bồi', 12),
  ('F', '房山石經', 'Phòng Sơn thạch kinh', 13),
  ('L', '乾隆大藏經', 'Càn Long tạng', 14),
  ('P', '永樂北藏', 'Vĩnh Lạc Bắc tạng', 15),
  ('C', '中華大藏經', 'Trung Hoa Đại tạng', 16),
  ('A', '趙城金藏', 'Kim tạng Triệu Thành', 17),
  ('K', '高麗大藏經', 'Cao Ly tạng', 18),
  ('LC', '呂澂著作集', 'Lã Trừng', 19),
  ('CC', 'CBETA選集', 'Tuyển tập CBETA', 20),
  ('U', '洪武南藏', 'Hồng Vũ Nam tạng', 21),
  ('S', '宋藏遺珍', 'Tống tạng di trân', 22),
  ('GB', '中國佛寺志叢刊', 'Chí chùa TQ', 23),
  ('ZS', '正史佛教資料類編', 'Chính sử Phật giáo', 24),
  ('M', '卍正藏經', 'Vạn Chính tạng', 25),
  ('XY', '虛雲和尚全集（岑學呂法彙＋年譜）', 'Hư Vân toàn tập (Pháp hội + Niên phổ)', 90),
  ('LQ', '來果禪師語錄／開示錄', 'Lai Quả ngữ lục / khai thị lục', 91)
ON CONFLICT (code) DO NOTHING;

INSERT INTO collection_aliases (collection_code, alias) VALUES
  ('XY', '虛雲'),
  ('XY', 'hư vân'),
  ('XY', 'xuyun'),
  ('LQ', '來果'),
  ('LQ', 'lai quả'),
  ('LQ', 'laiguo')
ON CONFLICT (collection_code, alias) DO NOTHING;
