# App Tổ Sư Thiền — Hoà thượng Thích Duy Lực

Ứng dụng tra cứu kinh sách, hỏi đáp RAG, MP3, video và thiền đường — phương pháp **Tổ Sư Thiền** (HT. Thích Duy Lực).

**Repository:** https://github.com/fg-aipham2009/tosuthien

---

## Tài liệu

| File | Nội dung |
|------|----------|
| [`docs/README.md`](docs/README.md) | Tổng quan kiến trúc, DB, RAG, lộ trình |
| [`docs/HUONG-DAN-CO-BAN.md`](docs/HUONG-DAN-CO-BAN.md) | Chạy local + API hỏi đáp (ngắn gọn) |
| [`docs/VPS-SETUP.md`](docs/VPS-SETUP.md) | **Deploy Ubuntu VPS** từng bước |

---

## Stack

| Thành phần | Công nghệ |
|------------|-----------|
| Mobile | Flutter → Google Play |
| API | NestJS (`nestjs/`) — port 8000 |
| Admin | Vue (`vuejs/`) — port 5173 |
| DB | PostgreSQL 16 + pgvector (Docker) |
| Embedding | Python `scripts/embed_server.py` — port 7997 |
| OCR / ingest | `pdf_to_text.py`, `scripts/ingest.py`, `scripts/embed.py` |
| Chat RAG | Claude qua **HHTechAPI** / Nexus / ShopAIKey |

---

## Clone & chạy nhanh (local)

```bash
git clone https://github.com/fg-aipham2009/tosuthien.git
cd tosuthien
# .env đã có sẵn trong repo — chỉ sửa PUBLIC_BASE_URL khi deploy VPS
docker compose up -d --build
```

Embed server (terminal riêng):

```bash
pip3 install -r requirements.txt
python3 scripts/embed_server.py
```

Ingest + embed (lần đầu):

```bash
python3 scripts/ingest.py
python3 scripts/embed.py --all --create-index
```

Kiểm tra:

```bash
curl http://localhost:8000/api/health
curl http://localhost:7997/health
```

---

## Deploy VPS

Xem hướng dẫn đầy đủ: [`docs/VPS-SETUP.md`](docs/VPS-SETUP.md)

```bash
git clone https://github.com/fg-aipham2009/tosuthien.git /opt/tosu-thien
cd /opt/tosu-thien
# .env đã có sẵn — sửa PUBLIC_BASE_URL nếu có domain
docker compose up -d --build
```

---

## Cấu trúc repo

```
tosuthien/
├── flutter/           # App mobile
├── nestjs/            # API backend
├── vuejs/             # Admin web
├── scripts/           # ingest, embed, embed_server
├── text/              # OCR kinh sách → RAG
├── kinhsach/          # PDF gốc
├── data/              # PDF/MP3 serve trên VPS
├── docker-compose.yml
├── schema.sql
└── docs/
```

---

## License / ghi chú

Dữ liệu kinh sách Phật giáo — chỉ dùng cho mục đích tra cứu hợp pháp theo phạm vi dự án.
