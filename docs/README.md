# App Tổ Sư Thiền — Hoà thượng Thích Duy Lực

Tài liệu **duy nhất** cho toàn bộ dự án: app Flutter (Google Play) + backend VPS + PostgreSQL RAG.

**Phạm vi:** Chỉ **Hoà thượng Thích Duy Lực (1923–2000)** và phương pháp **Tổ Sư Thiền**.

---

## Mục lục

1. [Tổng quan app](#1-tổng-quan-app)
2. [Kiến trúc](#2-kiến-trúc)
3. [Database & RAG](#3-database--rag)
4. [Cấu trúc thư mục](#4-cấu-trúc-thư-mục)
5. [Docker local & VPS](#5-docker-local--vps)
6. [Use case 5 tab](#6-use-case-5-tab)
7. [Scripts Python (1 lần)](#7-scripts-python-chạy-1-lần)
8. [Lộ trình 4 tuần](#8-lộ-trình-4-tuần)
9. [Chi phí](#9-chi-phí)
10. [Schema & seed SQL](#10-schema--seed-sql)

---

## 1. Tổng quan app

| Có | Không (MVP) |
|----|-------------|
| PDF kinh / ngữ lục Duy Lực | Nhiều thiền sư |
| Hỏi đáp RAG trên text OCR | RAG trên MP3/video |
| MP3 giảng HT. Duy Lực (mục + năm) | S3, CDN, Qdrant |
| Video YouTube HT. Duy Lực | Đăng nhập / tài khoản |
| Thiền đường & khoá tu liên quan | Admin panel phức tạp |

**Luồng dữ liệu:**

```
PDF (1–15)  →  VPS /pdf/     →  App xem PDF
text/*.txt  →  ingest+embed  →  PostgreSQL  →  App hỏi đáp RAG
MP3         →  VPS /audio/   →  App nghe (just_audio)
YouTube     →  youtube_id    →  App embed player
```

**Nguồn đã có trong repo:**

| Folder | Dùng cho |
|--------|----------|
| `pdf/` → `data/pdf/` | Tab Kinh sách |
| `text/*.txt` (~12 file, ~7k chunks) | RAG — ưu tiên **13.txt, 14.txt** |
| `word/` | Không cần cho app |

SQL đầy đủ: [`schema.sql`](../schema.sql)

---

## 2. Kiến trúc

```
┌──────────── Google Play ────────────┐
│  Flutter — 5 tab                     │
└──────────────┬──────────────────────┘
               │ HTTPS
┌──────────────▼──────────────────────┐
│  VPS (Docker)                        │
│  nginx  →  /api/*  /pdf/*  /audio/* │
│  FastAPI (hoặc NestJS)               │
│  PostgreSQL + pgvector (1 DB)        │
└─────────────────────────────────────┘

ingest.py + embed.py  →  chạy tay 1 lần (Python, ngoài container)
```

| Quyết định | Chọn |
|------------|------|
| DB | PostgreSQL + **pgvector** (text + vector cùng 1 DB) |
| PDF / MP3 | Host **VPS** (không S3) |
| Backend | **FastAPI** (tái dùng Python OCR) hoặc NestJS + script Python |
| Mobile | **Flutter** → Google Play |

---

## 3. Database & RAG

### Một DB — không cần vector DB riêng

| Bảng | Mục đích |
|------|----------|
| `pdf_files` | **PDF riêng** — Tab Kinh sách (`public_url`, `storage_path`) |
| `reading_progress` | Tiến độ đọc PDF — `device_id` + `last_page` (LEFT JOIN, không đăng nhập) |
| `rag_sources`, `passages`, `passage_embeddings` | **Text RAG riêng** — Tab Hỏi đáp (`text/*.txt`) |
| `media_categories` | Shared categories (MP3 + YouTube) |
| `mp3_tracks` | MP3 tab — `folder_path`, `filename`, `public_url` |
| `youtube_videos` | Video tab — `youtube_id` |
| `centers` | Temple — `temple_name`, `abbot_name`, `address`, `google_maps_url`, `phone`, `abbot_phone`, `activity_hours`, `rules`, `customs` |
| `courses` | Retreat courses |

**Không có:** `users`, `sessions`, `chat_messages` — app **không đăng nhập**; lịch sử hỏi đáp lưu **local trên điện thoại** (Flutter SQLite/Hive).

### PDF vs RAG — hai hệ độc lập

- **PDF** → `pdf_files` → đọc scan trên VPS (`data/pdf/`)
- **Text** → `rag_sources` → `ingest.py` → `passages` → `embed.py` → RAG `/chat`
- **Không FK** giữa hai bảng — `13.pdf` và `13.txt` chỉ trùng tên theo quy ước, không liên kết DB

### RAG pipeline

```
POST /chat
  → embed câu hỏi
  → SELECT top 8 passages (pgvector <=>)
  → Claude qua ShopAIKey + system prompt
  → answer + citations (quyển, trang)
```

**System prompt:**

> Bạn trợ lý tra cứu lời dạy **Hoà thượng Thích Duy Lực** về **Tổ Sư Thiền**. Chỉ trả lời từ ngữ cảnh. Luôn trích dẫn quyển + trang. Không có trong tư liệu → nói rõ.

**Câu test:** nhắm mắt/mở mắt (tr.8), đợi ngộ, thoại đầu, trừ vọng.

---

## 4. Cấu trúc thư mục

```
kínhsạch/
├── pdf/                    # PDF gốc
├── text/                   # OCR → RAG
├── data/                   # Mount VPS
│   ├── pdf/
│   │   ├── 13.pdf
│   │   └── 14.pdf
│   └── audio/
│       └── duy-luc/        # Chỉ HT. Duy Lực
│           ├── phap-thoai-to-su-thien/
│           │   ├── 1993/
│           │   ├── 1994/
│           │   └── 1999/
│           ├── thien-huong-dan/
│           │   └── 2020/
│           └── phap-hoi/
│               └── 2023/
├── scripts/
│   ├── ingest.py
│   └── embed.py
├── backend/                # API (sau)
├── schema.sql
└── docker-compose.yml
```

**URL VPS:**

```
https://domain.com/pdf/13.pdf
https://domain.com/audio/duy-luc/phap-thoai-to-su-thien/1993/1993-10-20-tu-an.mp3
https://domain.com/api/books
https://domain.com/api/chat
```

**Đặt tên MP3:** `{YYYY}-{MM}-{DD}-{noi-rut-gon}.mp3` — chữ thường, không dấu.

**Thêm MP3 mới:** copy file → folder đúng trên VPS → INSERT `mp3_tracks` → không cần build lại app.

**Thêm YouTube:** INSERT `youtube_videos` — cùng `media_categories`.

---

## 5. Docker local & VPS

### Local (chỉ cần DB lúc đầu)

```bash
cp .env.example .env
docker compose up -d
psql "postgresql://tosuthien:thamthien@localhost:5432/tosuthien" -f schema.sql
```

Khi có API/nginx, thêm lại service vào `docker-compose.yml` rồi:

```bash
docker compose up -d --build
curl http://localhost/health
curl http://localhost/api/health
```

### VPS (hiện chỉ DB)

**→ Hướng dẫn đầy đủ từng bước:** [`docs/VPS-SETUP.md`](./VPS-SETUP.md)

```bash
git clone ... /opt/tosu-thien && cd /opt/tosu-thien
cp .env.example .env && nano .env
docker compose up -d
```

**Backup DB:**

```bash
docker compose exec db pg_dump -U tosuthien tosuthien > backup.sql
```

**`.env` quan trọng:**

```env
DATABASE_URL=postgresql://tosuthien:thamthien@db:5432/tosuthien
SHOPAIKEY_API_KEY=...
PUBLIC_BASE_URL=https://domain.com
```

---

## 6. Use case 5 tab

| Tab | User làm gì | API |
|-----|---------------|-----|
| **Kinh sách** | Chọn quyển → xem PDF, nhớ trang đã đọc | `GET /pdfs?device_id=`, `PUT /reading-progress` |
| **Hỏi đáp** | Hỏi tiếng Việt → AI + nguồn trang | `POST /chat` |
| **MP3** | Mục → Năm → Nghe | `GET /media/categories`, `GET /mp3/tracks?category=&year=` |
| **Video** | Danh sách → YouTube | `GET /media/categories`, `GET /youtube/videos?category=` |
| **Thiền đường** | Xem chùa: địa chỉ, Maps, gọi chùa/trụ trì, giờ sinh hoạt, nội quy, quy củ | `GET /centers`, `GET /courses` |

**MP3 categories (gợi ý):**

- `phap-thoai-to-su-thien` — Pháp thoại Tổ Sư Thiền  
- `thien-huong-dan` — Hướng dẫn thiền  
- `phap-hoi` — Pháp hội  
- `tung-kinh` — Tụng kinh (nếu có)

**Chùa gợi ý:** Chùa Từ Ân Q.11 (1993), Chùa Kim Cương.

**Disclaimer:** *"AI tra cứu ngữ lục, không thay thế thầy."*

---

## 7. Scripts Python (chạy 1 lần)

| Script | Khi nào | Làm gì |
|--------|---------|--------|
| `ingest.py` | Lần đầu / thêm sửa `text/*.txt` | Parse → `rag_sources` + `passages` |
| `embed.py` | Sau ingest | Vector → `passage_embeddings` |

**Không** chạy khi user mở app — backend chỉ đọc DB.

```bash
python3 scripts/ingest.py
python3 scripts/embed.py
```

Logic parse trang: tái dùng `text_to_word.py` (marker `12 DUY LỰC NGỮ LỤC`).

---

## 8. Lộ trình 4 tuần

**Tuần 1:** Docker DB + `schema.sql` + `ingest.py` + API `/pdfs`  
**Tuần 2:** `embed.py` + `/chat` RAG + copy PDF vào `data/pdf/`  
**Tuần 3:** Flutter 5 tab — PDF, Chat, MP3 player  
**Tuần 4:** Upload MP3, seed youtube/centers, deploy VPS, Google Play  

**Definition of Done:**

- [ ] Xem PDF *Duy Lực Ngữ Lục*  
- [ ] Hỏi "nhắm mắt hay mở mắt" → trang 8 + nguồn  
- [ ] Nghe 1 MP3 từ VPS  
- [ ] Xem 1 video YouTube  
- [ ] Thấy 1 thiền đường + bản đồ  

---

## 9. Chi phí

| Hạng mục | Chi phí |
|----------|---------|
| VPS SG/VN | ~$4–6/tháng |
| PostgreSQL trên VPS | $0 |
| Claude API (RAG) | vài USD theo lượng hỏi |
| Google Play | $25 một lần |
| **Tổng MVP** | **~$5–10/tháng** |

---

## 10. Schema & seed SQL

**Database:** `tosuthien` — user `tosuthien` / pass `thamthien` — chạy [`schema.sql`](../schema.sql).

**Bảng chính:**

| Bảng | Mục đích |
|------|----------|
| `pdf_files` | Tab Kinh sách (PDF) |
| `reading_progress` | Trang đã đọc theo `device_id` |
| `rag_sources`, `passages`, `passage_embeddings` | Tab Hỏi đáp (text RAG) |
| `media_categories` | Shared MP3 + YouTube categories |
| `mp3_tracks` | MP3 tab |
| `youtube_videos` | Video tab |
| `centers` | Temple (`temple_name`, `abbot_name`, `address`, `google_maps_url`, `phone`, `abbot_phone`, `activity_hours`, `rules`, `customs`) |
| `courses` | Retreat courses |

Lịch sử chat: **Flutter local** — không bảng PostgreSQL, không đăng nhập.

**Seed tối thiểu:**

```sql
-- PDF (riêng)
INSERT INTO pdf_files (slug, title, volume, filename, storage_path, public_url, sort_order) VALUES
  ('duy-luc-ngu-luc-ha-pdf',     'DUY LỰC NGỮ LỤC', 'QUYỂN HẠ',      '13.pdf', 'pdf/13.pdf', 'https://DOMAIN/pdf/13.pdf', 1),
  ('duy-luc-ngu-luc-thuong-pdf', 'DUY LỰC NGỮ LỤC', 'QUYỂN THƯỢNG', '14.pdf', 'pdf/14.pdf', 'https://DOMAIN/pdf/14.pdf', 2);

-- RAG text (riêng)
INSERT INTO rag_sources (slug, title, volume, source_file, sort_order) VALUES
  ('duy-luc-ngu-luc-ha-rag',     'DUY LỰC NGỮ LỤC', 'QUYỂN HẠ',      '13.txt', 1),
  ('duy-luc-ngu-luc-thuong-rag', 'DUY LỰC NGỮ LỤC', 'QUYỂN THƯỢNG', '14.txt', 2);

-- media_categories seeded in schema.sql

INSERT INTO mp3_tracks (
  category_id, title, year,
  folder_path, filename, storage_path, public_url, duration_sec
)
SELECT c.id, 'Pháp thoại Tổ Sư Thiền — buổi 1', 1993,
  'duy-luc/phap-thoai-to-su-thien/1993/',
  '1993-10-20-tu-an-01.mp3',
  'duy-luc/phap-thoai-to-su-thien/1993/1993-10-20-tu-an-01.mp3',
  'https://DOMAIN/audio/duy-luc/phap-thoai-to-su-thien/1993/1993-10-20-tu-an-01.mp3',
  3600
FROM media_categories c WHERE c.slug = 'phap-thoai-to-su-thien';

INSERT INTO youtube_videos (category_id, title, year, youtube_id)
SELECT c.id, 'Pháp thoại Tổ Sư Thiền', 1993, 'VIDEO_ID'
FROM media_categories c WHERE c.slug = 'phap-thoai-to-su-thien';

INSERT INTO centers (
  temple_name, abbot_name, address, phone, abbot_phone,
  google_maps_url, activity_hours, rules, customs, sort_order
) VALUES (
  'Chùa Từ Ân', 'HT. Thích ...', 'Quận 11, TP. Hồ Chí Minh',
  '028xxxxxxxx', '09xxxxxxxx',
  'https://maps.google.com/?q=Chùa+Từ+Ân',
  '5h00–11h00; 14h00–21h00',
  'Giữ im lặng trong thiền đường.',
  'Vào chánh điện chắp tay, vái 3 lạy.',
  1
);
```

**Query RAG mẫu:**

```sql
SELECT p.page_num, p.content, r.title, r.volume,
       1 - (e.embedding <=> :query_vector::vector) AS score
FROM passage_embeddings e
JOIN passages p ON p.id = e.passage_id
JOIN rag_sources r ON r.id = p.rag_source_id
ORDER BY e.embedding <=> :query_vector::vector
LIMIT 8;
```

---

## Tóm lại

1. **1 VPS** — nginx + API + PostgreSQL + PDF + MP3  
2. **1 DB pgvector** — RAG ~7k chunks, quá nhỏ, dư sức  
3. **PDF đọc sách** — text OCR **hỏi đáp**  
4. **MP3** — `data/audio/duy-luc/{muc}/{nam}/`  
5. **Flutter** trên Google Play gọi VPS  
6. **ingest + embed** một lần — backend chạy liên tục  

File code liên quan: `schema.sql`, `docker-compose.yml`, `text_to_word.py`, `text/*.txt`.
