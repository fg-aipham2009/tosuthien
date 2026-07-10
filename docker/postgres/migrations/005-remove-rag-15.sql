-- Remove obsolete RAG source 15.txt (duplicate content — file deleted from repo).
-- Numbering convention: 1–14, 16–21 (no 15.txt / 15.pdf).
-- Safe to re-run: DELETE affects 0 rows if already removed.
--
-- Cascades: rag_sources → passages → passage_embeddings

DELETE FROM rag_sources
WHERE source_file = '15.txt';

-- Optional: remove PDF row if it was seeded manually earlier
DELETE FROM pdf_files
WHERE storage_path = 'pdf/15.pdf' OR filename = '15.pdf';
