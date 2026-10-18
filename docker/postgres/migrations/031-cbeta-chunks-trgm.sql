-- CBETA lexical hybrid: trigram index for Chinese substring match
-- Apply on database `cbeta`.
-- Prefer CONCURRENTLY on large corpora (cannot run inside a transaction block):
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cbeta_chunks_content_trgm
--     ON chunks USING gin (content_zh gin_trgm_ops);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_cbeta_chunks_content_trgm
  ON chunks USING gin (content_zh gin_trgm_ops);
