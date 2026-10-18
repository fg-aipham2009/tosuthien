-- CBETA canons (Đại Tạng T / Tục Tạng X): source text per sentence + Vietnamese translation workflow.
-- Structure follows cbetaonline: collection → category tree → work (X1456) → juan → segment (sentence / verse line).
BEGIN;

CREATE TABLE IF NOT EXISTS canon_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_zh text NOT NULL,
  name_vi text,
  short_name_vi text,
  source_url text,
  license text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- scheme 'cbeta' = 部類 tree (e.g. 禪宗部); scheme 'orig' = original canon structure per collection.
CREATE TABLE IF NOT EXISTS canon_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme text NOT NULL CHECK (scheme IN ('cbeta', 'orig')),
  code text NOT NULL,
  parent_id uuid REFERENCES canon_categories (id) ON DELETE CASCADE,
  collection_id uuid REFERENCES canon_collections (id) ON DELETE CASCADE,
  name_zh text NOT NULL,
  name_vi text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scheme, code)
);

CREATE INDEX IF NOT EXISTS idx_canon_categories_parent
  ON canon_categories (parent_id, sort_order);

CREATE TABLE IF NOT EXISTS canon_works (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES canon_collections (id) ON DELETE CASCADE,
  work_code text NOT NULL UNIQUE,
  category_id uuid REFERENCES canon_categories (id) ON DELETE SET NULL,
  orig_category_id uuid REFERENCES canon_categories (id) ON DELETE SET NULL,
  title_zh text NOT NULL,
  title_vi text,
  byline_zh text,
  byline_vi text,
  dynasty text,
  volume_start text,
  volume_end text,
  juan_count int NOT NULL DEFAULT 0,
  cjk_chars int NOT NULL DEFAULT 0,
  priority int NOT NULL DEFAULT 0,
  translate_status text NOT NULL DEFAULT 'pending'
    CHECK (translate_status IN ('pending', 'in_progress', 'translated', 'reviewed', 'approved')),
  cbeta_version text,
  source_paths text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_canon_works_collection
  ON canon_works (collection_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_canon_works_category
  ON canon_works (category_id);
CREATE INDEX IF NOT EXISTS idx_canon_works_orig_category
  ON canon_works (orig_category_id);
CREATE INDEX IF NOT EXISTS idx_canon_works_queue
  ON canon_works (translate_status, priority DESC, sort_order);

CREATE TABLE IF NOT EXISTS canon_juans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES canon_works (id) ON DELETE CASCADE,
  -- Display order within the work; juan_label is CBETA's own juan n (e.g. '001', '001a'; '' = front matter).
  juan_no int NOT NULL,
  juan_label text NOT NULL,
  title_zh text,
  title_vi text,
  source_path text,
  cbeta_ref_start text,
  segment_count int NOT NULL DEFAULT 0,
  translated_count int NOT NULL DEFAULT 0,
  approved_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'translated', 'reviewed', 'approved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_id, juan_no),
  UNIQUE (work_id, juan_label)
);

CREATE INDEX IF NOT EXISTS idx_canon_juans_status
  ON canon_juans (status);

-- One row per source sentence / verse line; display joins rows by paragraph_no.
CREATE TABLE IF NOT EXISTS canon_segments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  juan_id uuid NOT NULL REFERENCES canon_juans (id) ON DELETE CASCADE,
  seq int NOT NULL,
  paragraph_no int NOT NULL,
  segment_type text NOT NULL DEFAULT 'prose'
    CHECK (segment_type IN ('heading', 'prose', 'verse', 'dharani', 'byline', 'note')),
  heading_level smallint,
  cbeta_ref text,
  content_zh text NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (juan_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_canon_segments_paragraph
  ON canon_segments (juan_id, paragraph_no);
CREATE INDEX IF NOT EXISTS idx_canon_segments_ref
  ON canon_segments (cbeta_ref);

-- Mandatory terminology injected into translation prompts and checked after translation.
CREATE TABLE IF NOT EXISTS canon_glossary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_zh text NOT NULL,
  term_vi text NOT NULL,
  alt_vi text[] NOT NULL DEFAULT '{}',
  note text,
  source_type text NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('duy_luc', 'tri_tinh', 'cbeta', 'manual')),
  source_ref text,
  scope text NOT NULL DEFAULT 'all',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (term_zh, scope)
);

-- Every AI run or human edit is a new version; exactly one version per segment is current.
CREATE TABLE IF NOT EXISTS canon_translations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  segment_id bigint NOT NULL REFERENCES canon_segments (id) ON DELETE CASCADE,
  version_no int NOT NULL,
  content_vi text NOT NULL,
  footnote_vi text,
  source text NOT NULL CHECK (source IN ('ai', 'human')),
  model text,
  prompt_version text,
  edited_by uuid REFERENCES admin_users (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ai_checked', 'flagged', 'approved', 'rejected')),
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (segment_id, version_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_canon_translations_current
  ON canon_translations (segment_id)
  WHERE is_current;
CREATE INDEX IF NOT EXISTS idx_canon_translations_status
  ON canon_translations (status)
  WHERE is_current;

CREATE TABLE IF NOT EXISTS canon_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  translation_id bigint NOT NULL REFERENCES canon_translations (id) ON DELETE CASCADE,
  reviewer_type text NOT NULL CHECK (reviewer_type IN ('ai', 'human')),
  reviewer text,
  admin_user_id uuid REFERENCES admin_users (id) ON DELETE SET NULL,
  verdict text NOT NULL CHECK (verdict IN ('ok', 'issue')),
  issues jsonb NOT NULL DEFAULT '[]',
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_canon_reviews_translation
  ON canon_reviews (translation_id);

-- Nightly single-thread runner log: resume point + token / credit usage.
CREATE TABLE IF NOT EXISTS canon_jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  juan_id uuid NOT NULL REFERENCES canon_juans (id) ON DELETE CASCADE,
  step text NOT NULL CHECK (step IN ('translate', 'review', 'retry')),
  model text NOT NULL,
  prompt_version text,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'done', 'failed')),
  segment_from int,
  segment_to int,
  tokens_in int,
  tokens_out int,
  credits numeric(14, 2),
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_canon_jobs_juan
  ON canon_jobs (juan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_canon_jobs_status
  ON canon_jobs (status);

CREATE TABLE IF NOT EXISTS canon_reading_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  work_id uuid NOT NULL REFERENCES canon_works (id) ON DELETE CASCADE,
  juan_id uuid REFERENCES canon_juans (id) ON DELETE SET NULL,
  segment_id bigint REFERENCES canon_segments (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, work_id)
);

CREATE INDEX IF NOT EXISTS idx_canon_reading_progress_device
  ON canon_reading_progress (device_id);

-- Chat RAG: distinguish Duy Lực books from canon works.
ALTER TABLE rag_sources
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'book';
ALTER TABLE rag_sources
  ADD COLUMN IF NOT EXISTS canon_work_id uuid REFERENCES canon_works (id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rag_sources_kind_check') THEN
    ALTER TABLE rag_sources
      ADD CONSTRAINT rag_sources_kind_check CHECK (kind IN ('book', 'canon'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rag_sources_kind
  ON rag_sources (kind);
CREATE UNIQUE INDEX IF NOT EXISTS uq_rag_sources_canon_work
  ON rag_sources (canon_work_id)
  WHERE canon_work_id IS NOT NULL;

COMMIT;
