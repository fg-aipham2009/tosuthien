BEGIN;

DELETE FROM mp3_tracks WHERE category_id=(SELECT id FROM media_categories WHERE slug='su-phu-giang-kinh')
  AND folder_path = 'Sư Phụ Giảng Kinh/Bồ Tát Giới/';

WITH base AS (
  SELECT COALESCE(MAX(sort_order),0) AS m FROM mp3_tracks
  WHERE category_id=(SELECT id FROM media_categories WHERE slug='su-phu-giang-kinh')
)
INSERT INTO mp3_tracks (
  category_id, title, year, recorded_at, location,
  folder_path, filename, storage_path, public_url,
  file_size_bytes, sort_order, is_published
)
SELECT
  (SELECT id FROM media_categories WHERE slug='su-phu-giang-kinh'),
  v.title, v.year, NULL, NULL,
  v.folder_path, v.filename, v.storage_path, v.public_url,
  v.file_size_bytes, base.m + v.ord, true
FROM base
CROSS JOIN (VALUES
  (1, '01 Bồ Tát Giới', 1990, 'Sư Phụ Giảng Kinh/Bồ Tát Giới/', '01 Bồ Tát Giới.mp3', 'Sư Phụ Giảng Kinh/Bồ Tát Giới/01 Bồ Tát Giới.mp3', 'https://api.tosuthien.net/files/mp3/S%C6%B0%20Ph%E1%BB%A5%20Gi%E1%BA%A3ng%20Kinh/B%E1%BB%93%20T%C3%A1t%20Gi%E1%BB%9Bi/01%20B%E1%BB%93%20T%C3%A1t%20Gi%E1%BB%9Bi.mp3', 43268013),
  (2, '02 Bồ Tát Giới', 1990, 'Sư Phụ Giảng Kinh/Bồ Tát Giới/', '02 Bồ Tát Giới.mp3', 'Sư Phụ Giảng Kinh/Bồ Tát Giới/02 Bồ Tát Giới.mp3', 'https://api.tosuthien.net/files/mp3/S%C6%B0%20Ph%E1%BB%A5%20Gi%E1%BA%A3ng%20Kinh/B%E1%BB%93%20T%C3%A1t%20Gi%E1%BB%9Bi/02%20B%E1%BB%93%20T%C3%A1t%20Gi%E1%BB%9Bi.mp3', 52828077),
  (3, '03 Bồ Tát Giới', 1990, 'Sư Phụ Giảng Kinh/Bồ Tát Giới/', '03 Bồ Tát Giới.mp3', 'Sư Phụ Giảng Kinh/Bồ Tát Giới/03 Bồ Tát Giới.mp3', 'https://api.tosuthien.net/files/mp3/S%C6%B0%20Ph%E1%BB%A5%20Gi%E1%BA%A3ng%20Kinh/B%E1%BB%93%20T%C3%A1t%20Gi%E1%BB%9Bi/03%20B%E1%BB%93%20T%C3%A1t%20Gi%E1%BB%9Bi.mp3', 39517101),
  (4, '04 Bồ Tát Giới', 1990, 'Sư Phụ Giảng Kinh/Bồ Tát Giới/', '04 Bồ Tát Giới.mp3', 'Sư Phụ Giảng Kinh/Bồ Tát Giới/04 Bồ Tát Giới.mp3', 'https://api.tosuthien.net/files/mp3/S%C6%B0%20Ph%E1%BB%A5%20Gi%E1%BA%A3ng%20Kinh/B%E1%BB%93%20T%C3%A1t%20Gi%E1%BB%9Bi/04%20B%E1%BB%93%20T%C3%A1t%20Gi%E1%BB%9Bi.mp3', 34783149),
  (5, '05 Bồ Tát Giới', 1990, 'Sư Phụ Giảng Kinh/Bồ Tát Giới/', '05 Bồ Tát Giới.mp3', 'Sư Phụ Giảng Kinh/Bồ Tát Giới/05 Bồ Tát Giới.mp3', 'https://api.tosuthien.net/files/mp3/S%C6%B0%20Ph%E1%BB%A5%20Gi%E1%BA%A3ng%20Kinh/B%E1%BB%93%20T%C3%A1t%20Gi%E1%BB%9Bi/05%20B%E1%BB%93%20T%C3%A1t%20Gi%E1%BB%9Bi.mp3', 44287149),
  (6, '06 Bồ Tát Giới', 1990, 'Sư Phụ Giảng Kinh/Bồ Tát Giới/', '06 Bồ Tát Giới.mp3', 'Sư Phụ Giảng Kinh/Bồ Tát Giới/06 Bồ Tát Giới.mp3', 'https://api.tosuthien.net/files/mp3/S%C6%B0%20Ph%E1%BB%A5%20Gi%E1%BA%A3ng%20Kinh/B%E1%BB%93%20T%C3%A1t%20Gi%E1%BB%9Bi/06%20B%E1%BB%93%20T%C3%A1t%20Gi%E1%BB%9Bi.mp3', 41679789),
  (7, '07 Bồ Tát Giới', 1990, 'Sư Phụ Giảng Kinh/Bồ Tát Giới/', '07 Bồ Tát Giới.mp3', 'Sư Phụ Giảng Kinh/Bồ Tát Giới/07 Bồ Tát Giới.mp3', 'https://api.tosuthien.net/files/mp3/S%C6%B0%20Ph%E1%BB%A5%20Gi%E1%BA%A3ng%20Kinh/B%E1%BB%93%20T%C3%A1t%20Gi%E1%BB%9Bi/07%20B%E1%BB%93%20T%C3%A1t%20Gi%E1%BB%9Bi.mp3', 48545325),
  (8, '08 Bồ Tát Giới', 1990, 'Sư Phụ Giảng Kinh/Bồ Tát Giới/', '08 Bồ Tát Giới.mp3', 'Sư Phụ Giảng Kinh/Bồ Tát Giới/08 Bồ Tát Giới.mp3', 'https://api.tosuthien.net/files/mp3/S%C6%B0%20Ph%E1%BB%A5%20Gi%E1%BA%A3ng%20Kinh/B%E1%BB%93%20T%C3%A1t%20Gi%E1%BB%9Bi/08%20B%E1%BB%93%20T%C3%A1t%20Gi%E1%BB%9Bi.mp3', 47514669),
  (9, '09 Bồ Tát Giới (Nguyên Bản)', 1990, 'Sư Phụ Giảng Kinh/Bồ Tát Giới/', '09 Bồ Tát Giới (Nguyên Bản).mp3', 'Sư Phụ Giảng Kinh/Bồ Tát Giới/09 Bồ Tát Giới (Nguyên Bản).mp3', 'https://api.tosuthien.net/files/mp3/S%C6%B0%20Ph%E1%BB%A5%20Gi%E1%BA%A3ng%20Kinh/B%E1%BB%93%20T%C3%A1t%20Gi%E1%BB%9Bi/09%20B%E1%BB%93%20T%C3%A1t%20Gi%E1%BB%9Bi%20%28Nguy%C3%AAn%20B%E1%BA%A3n%29.mp3', 47478573)
) AS v(ord, title, year, folder_path, filename, storage_path, public_url, file_size_bytes);

COMMIT;
