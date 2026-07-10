-- Seed all kinh sách PDFs matching text/*.txt numbering:
--   N.pdf ↔ N.txt  (1–14, 16–21; no 15.txt / 15.pdf yet)
-- Public URLs: https://api.tosuthien.net/files/pdf/{N}.pdf
-- Files on VPS/docker: /data/pdf/{N}.pdf  (from kinhsach/)
--
-- Safe to re-run: upserts by storage_path.
--
-- If your API host differs:
--   UPDATE pdf_files
--   SET public_url = replace(public_url, 'https://api.tosuthien.net', 'https://YOUR_HOST');

INSERT INTO pdf_files (
  slug, title, volume, author, filename, folder_path, storage_path, public_url,
  file_size_bytes, sort_order
) VALUES
  (
    'nam-tuyen-ngu-luc-va-buu-tang-luan-pdf',
    'NAM TUYỀN NGỮ LỤC VÀ BỬU TẠNG LUẬN',
    NULL,
    'Hòa thượng Thích Duy Lực',
    '1.pdf', 'pdf/', 'pdf/1.pdf',
    'https://api.tosuthien.net/files/pdf/1.pdf',
    3251648, 1
  ),
  (
    'phat-phap-voi-thien-tong-pdf',
    'PHẬT PHÁP VỚI THIỀN TÔNG',
    'Phương pháp tu trì của Thiền tông · Đại Huệ ngữ lục · Tham thiền cảnh ngữ',
    'Hòa thượng Thích Duy Lực',
    '2.pdf', 'pdf/', 'pdf/2.pdf',
    'https://api.tosuthien.net/files/pdf/2.pdf',
    10538267, 2
  ),
  (
    'chu-kinh-tap-yeu-pdf',
    'CHƯ KINH TẬP YẾU',
    'Kim Cang · Bát Nhã · Pháp Hoa · Hoa Nghiêm · Duy Ma · Viên Giác',
    'Hòa thượng Thích Duy Lực',
    '3.pdf', 'pdf/', 'pdf/3.pdf',
    'https://api.tosuthien.net/files/pdf/3.pdf',
    12168315, 3
  ),
  (
    'kinh-phap-bao-dan-pdf',
    'KINH PHÁP BẢO ĐÀN',
    NULL,
    'Hòa thượng Thích Duy Lực',
    '4.pdf', 'pdf/', 'pdf/4.pdf',
    'https://api.tosuthien.net/files/pdf/4.pdf',
    4530364, 4
  ),
  (
    'trung-phong-phap-ngu-lam-te-ngu-luc-pdf',
    'TRUNG PHONG PHÁP NGỮ · LÂM TẾ NGỮ LỤC',
    NULL,
    'Hòa thượng Thích Duy Lực',
    '5.pdf', 'pdf/', 'pdf/5.pdf',
    'https://api.tosuthien.net/files/pdf/5.pdf',
    6325075, 5
  ),
  (
    'phat-phap-va-khoa-hoc-pdf',
    'PHẬT PHÁP VÀ KHOA HỌC',
    NULL,
    'Hòa thượng Thích Duy Lực',
    '6.pdf', 'pdf/', 'pdf/6.pdf',
    'https://api.tosuthien.net/files/pdf/6.pdf',
    2681587, 6
  ),
  (
    'tham-thien-pho-thuyet-pdf',
    'THAM THIỀN PHỔ THUYẾT',
    NULL,
    'Hòa thượng Thích Duy Lực',
    '7.pdf', 'pdf/', 'pdf/7.pdf',
    'https://api.tosuthien.net/files/pdf/7.pdf',
    14383352, 7
  ),
  (
    'gop-nhat-loi-phat-to-va-thanh-hien-pdf',
    'GÓP NHẶT LỜI PHẬT TỔ VÀ THÁNH HIỀN',
    'Công án Phật–Tổ · Bách Trượng · Truyền tâm pháp yếu',
    'Hòa thượng Thích Duy Lực',
    '8.pdf', 'pdf/', 'pdf/8.pdf',
    'https://api.tosuthien.net/files/pdf/8.pdf',
    9729518, 8
  ),
  (
    'luoc-giang-bo-tat-gioi-pdf',
    'LƯỢC GIẢNG BỒ TÁT GIỚI',
    NULL,
    'Hòa thượng Thích Duy Lực',
    '9.pdf', 'pdf/', 'pdf/9.pdf',
    'https://api.tosuthien.net/files/pdf/9.pdf',
    7265037, 9
  ),
  (
    'vu-tru-quan-the-ky-xxi-pdf',
    'VŨ TRỤ QUAN THẾ KỶ XXI',
    'Yếu chỉ Phật pháp · Yếu chỉ Trung Quán luận',
    'Hòa thượng Thích Duy Lực',
    '10.pdf', 'pdf/', 'pdf/10.pdf',
    'https://api.tosuthien.net/files/pdf/10.pdf',
    4356665, 10
  ),
  (
    'danh-tu-thien-hoc-chu-giai-pdf',
    'DANH TỪ THIỀN HỌC (CHÚ GIẢI)',
    NULL,
    'Hòa thượng Thích Duy Lực',
    '11.pdf', 'pdf/', 'pdf/11.pdf',
    'https://api.tosuthien.net/files/pdf/11.pdf',
    2332416, 11
  ),
  (
    'coi-nguon-truyen-thua-thien-that-khai-thi-luc-pdf',
    'CỘI NGUỒN TRUYỀN THỪA · THIỀN THẤT KHAI THỊ LỤC',
    NULL,
    'Hòa thượng Thích Duy Lực',
    '12.pdf', 'pdf/', 'pdf/12.pdf',
    'https://api.tosuthien.net/files/pdf/12.pdf',
    17813367, 12
  ),
  (
    'duy-luc-ngu-luc-thuong-pdf',
    'DUY LỰC NGỮ LỤC',
    'QUYỂN THƯỢNG',
    'Hòa thượng Thích Duy Lực',
    '14.pdf', 'pdf/', 'pdf/14.pdf',
    'https://api.tosuthien.net/files/pdf/14.pdf',
    27180493, 13
  ),
  (
    'duy-luc-ngu-luc-ha-pdf',
    'DUY LỰC NGỮ LỤC',
    'QUYỂN HẠ',
    'Hòa thượng Thích Duy Lực',
    '13.pdf', 'pdf/', 'pdf/13.pdf',
    'https://api.tosuthien.net/files/pdf/13.pdf',
    26977247, 14
  ),
  (
    'dai-thua-tuyet-doi-luan-pdf',
    'ĐẠI THỪA TUYỆT ĐỐI LUẬN',
    'Tín Tâm Minh Tịch Nghĩa Giải',
    'Hòa thượng Thích Duy Lực',
    '16.pdf', 'pdf/', 'pdf/16.pdf',
    'https://api.tosuthien.net/files/pdf/16.pdf',
    29435940, 16
  ),
  (
    'trieu-luan-luoc-giai-pdf',
    'TRIỆU LUẬN LƯỢC GIẢI',
    NULL,
    'Hòa thượng Thích Duy Lực',
    '17.pdf', 'pdf/', 'pdf/17.pdf',
    'https://api.tosuthien.net/files/pdf/17.pdf',
    57843172, 17
  ),
  (
    'luoc-giang-kinh-kim-cang-pdf',
    'LƯỢC GIẢNG KINH KIM CANG',
    NULL,
    'Hòa thượng Thích Duy Lực',
    '18.pdf', 'pdf/', 'pdf/18.pdf',
    'https://api.tosuthien.net/files/pdf/18.pdf',
    70803794, 18
  ),
  (
    'kinh-lang-nghiem-pdf',
    'KINH LĂNG NGHIÊM',
    NULL,
    'Hòa thượng Thích Duy Lực',
    '19.pdf', 'pdf/', 'pdf/19.pdf',
    'https://api.tosuthien.net/files/pdf/19.pdf',
    946639, 19
  ),
  (
    'kinh-lang-gia-pdf',
    'KINH LĂNG GIÀ',
    NULL,
    'Hòa thượng Thích Duy Lực',
    '20.pdf', 'pdf/', 'pdf/20.pdf',
    'https://api.tosuthien.net/files/pdf/20.pdf',
    831139, 20
  ),
  (
    'duong-loi-thuc-hanh-tham-to-su-thien-pdf',
    'ĐƯỜNG LỐI THỰC HÀNH THAM TỔ SƯ THIỀN',
    NULL,
    'Hòa thượng Thích Duy Lực',
    '21.pdf', 'pdf/', 'pdf/21.pdf',
    'https://api.tosuthien.net/files/pdf/21.pdf',
    336400, 21
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
