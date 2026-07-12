-- Seed PDF rows for books 15 and 22 (matching text/15.txt and text/22.txt).
-- Files on disk: /data/pdf/15.pdf, /data/pdf/22.pdf
-- Safe to re-run: upserts by storage_path.

INSERT INTO pdf_files (
  slug, title, volume, author, filename, folder_path, storage_path, public_url,
  file_size_bytes, sort_order
) VALUES
  (
    'luoc-giang-kinh-lang-nghiem-pdf',
    'LƯỢC GIẢNG KINH LĂNG NGHIÊM',
    NULL,
    'Hòa thượng Thích Duy Lực',
    '15.pdf', 'pdf/', 'pdf/15.pdf',
    'https://api.tosuthien.net/files/pdf/15.pdf',
    40810611, 15
  ),
  (
    'luoc-giang-tin-tam-minh-tich-nghia-giai-pdf',
    'LƯỢC GIẢNG TÍN TÂM MINH TỊCH NGHĨA GIẢI',
    NULL,
    'Hòa thượng Thích Duy Lực',
    '22.pdf', 'pdf/', 'pdf/22.pdf',
    'https://api.tosuthien.net/files/pdf/22.pdf',
    45460799, 22
  )
ON CONFLICT (storage_path) DO UPDATE SET
  slug            = EXCLUDED.slug,
  title           = EXCLUDED.title,
  volume          = EXCLUDED.volume,
  author          = EXCLUDED.author,
  filename        = EXCLUDED.filename,
  folder_path     = EXCLUDED.folder_path,
  public_url      = EXCLUDED.public_url,
  file_size_bytes = EXCLUDED.file_size_bytes,
  sort_order      = EXCLUDED.sort_order;
