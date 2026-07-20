-- Distinguish Duy Lực Ngữ Lục volumes (same base title looked like duplicates).
-- 13 = Quyển Hạ, 14 = Quyển Thượng (matches text/OCR content).

UPDATE rag_sources
SET title = 'DUY LỰC NGỮ LỤC — QUYỂN HẠ',
    volume = 'QUYỂN HẠ',
    sort_order = 13
WHERE source_file = '13.txt';

UPDATE rag_sources
SET title = 'DUY LỰC NGỮ LỤC — QUYỂN THƯỢNG',
    volume = 'QUYỂN THƯỢNG',
    sort_order = 14
WHERE source_file = '14.txt';

UPDATE pdf_files
SET title = 'DUY LỰC NGỮ LỤC — QUYỂN HẠ',
    volume = 'QUYỂN HẠ',
    sort_order = 13
WHERE filename = '13.pdf';

UPDATE pdf_files
SET title = 'DUY LỰC NGỮ LỤC — QUYỂN THƯỢNG',
    volume = 'QUYỂN THƯỢNG',
    sort_order = 14
WHERE filename = '14.pdf';
