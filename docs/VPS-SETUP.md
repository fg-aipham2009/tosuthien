# Hướng dẫn cấu hình VPS Ubuntu — App Tổ Sư Thiền

Tài liệu từng bước để deploy backend + admin lên **Ubuntu VPS** (22.04 hoặc 24.04).

**Repository:** https://github.com/fg-aipham2009/tosuthien

**Stack trên VPS:**

| Thành phần | Cách chạy | Port |
|------------|-----------|------|
| PostgreSQL + pgvector | Docker (`db`) | 5432 |
| NestJS API | Docker (`api`) | 8000 |
| Vue Admin | Docker (`admin`) | 5173 → 80 trong container |
| Embed server (Python) | **Chạy trên host** | 7997 |
| Nginx + HTTPS (tùy chọn) | Cài trên host | 80, 443 |

**Flutter app** build riêng trên máy dev → đăng Google Play, trỏ `API_BASE_URL` về domain VPS.

---

## Bước 0 — Chuẩn bị

Bạn cần:

- 1 VPS Ubuntu (khuyến nghị **≥ 2 GB RAM**, **2 vCPU**, **40 GB SSD** — embed model cần RAM)
- Domain trỏ A record về IP VPS (nếu dùng HTTPS)
- SSH vào VPS: `ssh root@IP_VPS` hoặc `ssh ubuntu@IP_VPS`
- API key chat RAG: **HHTechAPI** (khuyến nghị), **Nexus**, hoặc **ShopAIKey**
- Đã có quyền clone repo: `git clone https://github.com/fg-aipham2009/tosuthien.git`

---

## Bước 1 — Cập nhật hệ thống

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ca-certificates gnupg ufw
```

---

## Bước 2 — Cài Docker + Docker Compose

```bash
# Docker official repo
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Cho user hiện tại chạy docker không cần sudo (đăng xuất SSH rồi vào lại)
sudo usermod -aG docker $USER

docker --version
docker compose version
```

> Nếu vừa thêm group `docker`, chạy `exit` rồi SSH lại trước khi tiếp tục.

---

## Bước 3 — Cài Python (embed server + ingest)

```bash
sudo apt install -y python3 python3-pip python3-venv
python3 --version   # nên >= 3.10
```

---

## Bước 4 — Clone code lên VPS

```bash
sudo mkdir -p /opt/tosu-thien
sudo chown $USER:$USER /opt/tosu-thien
cd /opt/tosu-thien

git clone https://github.com/fg-aipham2009/tosuthien.git .
```

**Repo private** — clone bằng PAT (đã cấu hình sẵn):

```bash
git clone https://fg-aipham2009:TOKEN@github.com/fg-aipham2009/tosuthien.git .
```

Hoặc clone public rồi lưu credential (thay `TOKEN` bằng PAT GitHub):

```bash
git clone https://github.com/fg-aipham2009/tosuthien.git .
printf '%s\n' "protocol=https" "host=github.com" "username=x-access-token" "password=TOKEN" | git credential approve
chmod 600 ~/.git-credentials 2>/dev/null
```

**Cập nhật code sau này:**

```bash
cd /opt/tosu-thien
git pull origin main
docker compose up -d --build
```

---

## Bước 5 — File `.env`

File `.env` **đã có sẵn trong repo** — clone xong là dùng được, **không cần** `cp .env.example .env`.

```bash
cd /opt/tosu-thien
ls -la .env
```

**Trên VPS production**, chỉ sửa domain (nếu có HTTPS):

```bash
nano .env
# Đổi: PUBLIC_BASE_URL=https://your-domain.com
docker compose up -d --force-recreate api
```

### Nội dung `.env` (tham khảo)

```env
# =============================================================================
# DATABASE (PostgreSQL + pgvector) — docker-compose service "db"
# =============================================================================
POSTGRES_USER=tosuthien
POSTGRES_PASSWORD=thamthien
POSTGRES_DB=tosuthien
POSTGRES_PORT=5432

# Script Python trên HOST (ingest.py, embed.py) — kết nối localhost
DATABASE_URL=postgresql://tosuthien:thamthien@localhost:5432/tosuthien
# Lưu ý: container "api" tự override DATABASE_URL → host "db" (không cần sửa)

# =============================================================================
# DOCKER COMPOSE — port map ra ngoài VPS
# =============================================================================
API_PORT=8000
ADMIN_PORT=5173

# =============================================================================
# API NESTJS — file tĩnh PDF/MP3/ảnh
# =============================================================================
PORT=8000
PUBLIC_BASE_URL=http://localhost:8000
DATA_ROOT=../data

# =============================================================================
# CHAT RAG — chọn 1 provider: hhtech | nexus | shopaikey
# =============================================================================
CHAT_PROVIDER=hhtech
CHAT_MODEL=claude-opus-4-6

# --- HHTechAPI (khuyến nghị) ---
HHTECH_API_KEY=sk-fbe41e3c5e6b46e5a887011e
HHTECH_BASE_URL=https://hhtechapi.com/v1
HHTECH_CHAT_MODEL=claude-opus-4-6

# --- Nexus (dự phòng) ---
NEXUS_API_KEY=
NEXUS_BASE_URL=https://nexusmmo.store/api/v1
NEXUS_CHAT_MODEL=claude-opus-4-6

# --- ShopAIKey (dự phòng) ---
SHOPAIKEY_API_KEY=
SHOPAIKEY_BASE_URL=https://api.shopaikey.com

# =============================================================================
# EMBEDDING — local miễn phí (scripts/embed_server.py)
# =============================================================================
EMBEDDING_API_KEY=local
EMBEDDING_BASE_URL=http://localhost:7997/v1
EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
EMBEDDING_DIM=384

# Container "api" gọi embed server trên HOST (Linux: cần extra_hosts trong compose)
EMBEDDING_BASE_URL_DOCKER=http://host.docker.internal:7997/v1

# Port embed server trên host (mặc định 7997 — chỉ đổi nếu conflict)
EMBED_PORT=7997

# =============================================================================
# OCR PDF — pdf_to_text.py (chạy trên máy dev / VPS khi cần OCR thêm sách)
# Provider: hhtech | taphoa | nexus | shopaikey
# =============================================================================
OCR_PROVIDER=hhtech
OCR_MODEL=claude-opus-4-6

# Dùng chung HHTECH_* ở trên khi OCR_PROVIDER=hhtech
# TaphoaAPI (nếu dùng OCR_PROVIDER=taphoa):
TAPHOA_API_KEY=
TAPHOA_BASE_URL=https://taphoaapi.info.vn

# =============================================================================
# NGINX host (tham chiếu — cấu hình trong /etc/nginx, không đọc từ .env)
# =============================================================================
HTTP_PORT=80
HTTPS_PORT=443
```

Lưu ý: giá trị thật nằm trong file `.env` ở root repo.

### Bảng giải thích từng biến

#### Database

| Biến | Bắt buộc | Ai dùng | Mô tả |
|------|----------|---------|-------|
| `POSTGRES_USER` | Có | Docker `db` | Username PostgreSQL |
| `POSTGRES_PASSWORD` | Có | Docker `db` | Mặc định project: `thamthien` (đổi nếu cần bảo mật hơn) |
| `POSTGRES_DB` | Có | Docker `db` | Tên database (`tosuthien`) |
| `POSTGRES_PORT` | Không | Docker `db` | Port map ra host (mặc định `5432`) |
| `DATABASE_URL` | Có | `ingest.py`, `embed.py` | URL kết nối từ **host** → `localhost:5432` |

#### Docker Compose

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| `API_PORT` | Không | Port NestJS ra ngoài (mặc định `8000`) |
| `ADMIN_PORT` | Không | Port Vue admin ra ngoài (mặc định `5173`) |

#### API NestJS

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| `PORT` | Không | Port API trong container (mặc định `8000`) |
| `PUBLIC_BASE_URL` | Có (prod) | URL công khai — dùng tạo link PDF/MP3 (`https://domain.com`) |
| `DATA_ROOT` | Không | Thư mục dữ liệu; trong Docker = `/data` (mount `./data`) |

#### Chat RAG (Claude)

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| `CHAT_PROVIDER` | Có | `hhtech` \| `nexus` \| `shopaikey` |
| `CHAT_MODEL` | Không | Model mặc định nếu provider không có model riêng |
| `HHTECH_API_KEY` | Khi `CHAT_PROVIDER=hhtech` | API key HHTechAPI |
| `HHTECH_BASE_URL` | Không | `https://hhtechapi.com/v1` |
| `HHTECH_CHAT_MODEL` | Không | Model chat (khuyên `claude-opus-4-6`) |
| `NEXUS_API_KEY` | Khi `CHAT_PROVIDER=nexus` | API key Nexus |
| `NEXUS_BASE_URL` | Không | `https://nexusmmo.store/api/v1` |
| `NEXUS_CHAT_MODEL` | Không | Model Nexus |
| `SHOPAIKEY_API_KEY` | Khi `CHAT_PROVIDER=shopaikey` | API key ShopAIKey |
| `SHOPAIKEY_BASE_URL` | Không | `https://api.shopaikey.com` |

#### Embedding (vector search)

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| `EMBEDDING_API_KEY` | Có | Đặt `local` khi dùng embed server |
| `EMBEDDING_BASE_URL` | Có | Host scripts: `http://localhost:7997/v1` |
| `EMBEDDING_BASE_URL_DOCKER` | Có (Docker) | API container gọi embed trên host |
| `EMBEDDING_MODEL` | Không | Model fastembed (384 dim) |
| `EMBEDDING_DIM` | Không | Phải khớp schema `vector(384)` |
| `EMBED_PORT` | Không | Port `embed_server.py` (mặc định `7997`) |

#### OCR PDF (`pdf_to_text.py`)

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| `OCR_PROVIDER` | Không | `hhtech` \| `taphoa` \| `nexus` \| `shopaikey` |
| `OCR_MODEL` | Không | Model OCR (khuyên `claude-opus-4-6`) |
| `TAPHOA_API_KEY` | Khi `OCR_PROVIDER=taphoa` | API key TaphoaAPI |
| `TAPHOA_BASE_URL` | Không | `https://taphoaapi.info.vn` (SDK Python) |

Khi `OCR_PROVIDER=hhtech`, OCR dùng chung `HHTECH_API_KEY` + `HHTECH_BASE_URL`.

#### Tham chiếu / không đọc trực tiếp bởi app

| Biến | Mô tả |
|------|-------|
| `HTTP_PORT` | Port 80 — cấu hình nginx host |
| `HTTPS_PORT` | Port 443 — Certbot / nginx |

### Chọn provider nhanh

| Mục đích | Cấu hình |
|----------|----------|
| **Production (khuyến nghị)** | `CHAT_PROVIDER=hhtech`, `OCR_PROVIDER=hhtech`, điền `HHTECH_API_KEY` |
| Nexus chat | `CHAT_PROVIDER=nexus`, điền `NEXUS_API_KEY` |
| ShopAIKey | `CHAT_PROVIDER=shopaikey`, điền `SHOPAIKEY_API_KEY` |

### Kiểm tra `.env` sau khi sửa

```bash
# Embed server đọc .env qua systemd EnvironmentFile
grep -v '^#' .env | grep -v '^$' | head -20

# Restart stack sau khi đổi key chat
docker compose up -d --force-recreate api
```

---

## Bước 6 — `docker-compose.yml` (Linux)

Repo đã có `extra_hosts` cho service `api` (API container gọi embed server trên host):

```yaml
  api:
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

Nếu clone bản cũ thiếu block này, thêm vào service `api` rồi:

```bash
docker compose up -d --build
```

Không cần sửa nếu file đã có sẵn từ repo mới nhất.

---

## Bước 7 — Tạo thư mục dữ liệu

```bash
cd /opt/tosu-thien
mkdir -p data/pdf data/mp3 data/images

# Copy PDF / MP3 lên VPS (ví dụ từ máy local)
# scp -r data/pdf/* ubuntu@IP_VPS:/opt/tosu-thien/data/pdf/
# scp -r data/mp3/* ubuntu@IP_VPS:/opt/tosu-thien/data/mp3/
```

Thư mục `text/*.txt` (OCR) giữ trong repo để chạy ingest.

---

## Bước 8 — Cài Python dependencies

```bash
cd /opt/tosu-thien
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

> Mỗi lần SSH mới, chạy `source /opt/tosu-thien/.venv/bin/activate` trước khi dùng `ingest.py` / `embed.py`.

---

## Bước 9 — Chạy Embed server (bắt buộc cho RAG)

Embed server **không nằm trong Docker** — phải chạy trên host port **7997**.

### Chạy thử

```bash
cd /opt/tosu-thien
source .venv/bin/activate
python3 scripts/embed_server.py
```

Terminal khác:

```bash
curl http://localhost:7997/health
# Kỳ vọng: {"status":"ok"} hoặc tương tự
```

`Ctrl+C` để dừng thử.

### Chạy nền với systemd (khuyến nghị)

```bash
sudo tee /etc/systemd/system/tosu-embed.service > /dev/null <<'EOF'
[Unit]
Description=Tosu Thien Embed Server (fastembed)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/tosu-thien
Environment=PATH=/opt/tosu-thien/.venv/bin:/usr/bin
EnvironmentFile=/opt/tosu-thien/.env
ExecStart=/opt/tosu-thien/.venv/bin/python3 scripts/embed_server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

> Đổi `User=ubuntu` thành user SSH của bạn nếu khác.

```bash
sudo systemctl daemon-reload
sudo systemctl enable tosu-embed
sudo systemctl start tosu-embed
sudo systemctl status tosu-embed
curl http://localhost:7997/health
```

---

## Bước 10 — Khởi động Docker stack

```bash
cd /opt/tosu-thien
docker compose up -d --build
```

Đợi ~1–2 phút, kiểm tra:

```bash
docker compose ps
curl http://localhost:8000/api/health
curl http://localhost:5173
```

**Kỳ vọng:**

- `db`, `api`, `admin` đều `healthy` / `running`
- `/api/health` trả JSON OK
- `:5173` mở được trang admin Vue

Xem log nếu lỗi:

```bash
docker compose logs -f api
docker compose logs -f db
```

---

## Bước 11 — Nạp dữ liệu RAG (chạy 1 lần)

Chỉ cần khi mới deploy hoặc thêm/sửa file `text/*.txt`.

```bash
cd /opt/tosu-thien
source .venv/bin/activate

# Đảm bảo DB đã sẵn sàng
docker compose ps db

# Chunk text → passages
python3 scripts/ingest.py

# Tạo embedding (cần embed server đang chạy)
python3 scripts/embed.py --all

# Tạo index vector (nhanh hơn khi search)
python3 scripts/embed.py --create-index
```

Thời gian embed phụ thuộc số passage — có thể **vài phút đến vài chục phút** trên VPS nhỏ.

---

## Bước 12 — Mở firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# Tùy chọn: mở trực tiếp API/admin khi chưa có nginx
# sudo ufw allow 8000/tcp
# sudo ufw allow 5173/tcp
sudo ufw enable
sudo ufw status
```

---

## Bước 13 — Nginx reverse proxy + HTTPS (production)

Khi đã có domain `your-domain.com` trỏ về IP VPS.

### Cài Nginx + Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Cấu hình site

```bash
sudo tee /etc/nginx/sites-available/tosu-thien > /dev/null <<'EOF'
server {
    listen 80;
    server_name your-domain.com;

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # PDF / MP3 / images
    location /files/ {
        proxy_pass http://127.0.0.1:8000/files/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Admin Vue (tùy chọn — hoặc dùng subdomain admin.your-domain.com)
    location / {
        proxy_pass http://127.0.0.1:5173/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
EOF
```

Sửa `your-domain.com` trong file:

```bash
sudo nano /etc/nginx/sites-available/tosu-thien
sudo ln -sf /etc/nginx/sites-available/tosu-thien /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL Let's Encrypt

```bash
sudo certbot --nginx -d your-domain.com
```

Cập nhật `.env`:

```env
PUBLIC_BASE_URL=https://your-domain.com
```

Restart API:

```bash
cd /opt/tosu-thien
docker compose up -d --force-recreate api
```

---

## Bước 14 — Build Flutter app trỏ về VPS

Trên máy dev (có Flutter SDK):

```bash
cd flutter
flutter build appbundle \
  --dart-define=API_BASE_URL=https://your-domain.com
```

File output: `build/app/outputs/bundle/release/app-release.aab` → upload Google Play Console.

---

## Bước 15 — Kiểm tra end-to-end

```bash
# Health
curl https://your-domain.com/api/health
curl http://localhost:7997/health

# RAG chat (thay câu hỏi)
curl -s -X POST https://your-domain.com/api/rag/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"tòng lâm là gì"}' | head -c 500

# PDF list
curl https://your-domain.com/api/pdfs
```

---

## Bước 16 — Backup database

```bash
cd /opt/tosu-thien
docker compose exec -T db pg_dump -U tosuthien tosuthien > backup-$(date +%F).sql
```

Khôi phục:

```bash
cat backup-2026-07-08.sql | docker compose exec -T db psql -U tosuthien tosuthien
```

---

## Lệnh vận hành thường dùng

| Việc | Lệnh |
|------|------|
| Xem container | `docker compose ps` |
| Log API | `docker compose logs -f api` |
| Restart API | `bash scripts/restart-api.sh` |
| Restart embed | `sudo systemctl restart tosu-embed` |
| Rebuild sau sửa code | `docker compose up -d --build` |
| Thêm text mới | `ingest.py` → `embed.py --source N` |

---

## Xử lý lỗi thường gặp

### `embed_failed` / RAG không search vector

- Embed server chưa chạy: `curl http://localhost:7997/health`
- Thiếu `extra_hosts` trong `docker-compose.yml` (Bước 6)
- Kiểm tra trong container: `docker compose exec api wget -qO- http://host.docker.internal:7997/health`

### API không kết nối DB

```bash
docker compose logs db
docker compose exec db pg_isready -U tosuthien
```

### Chat trả lỗi 503

- Kiểm tra `CHAT_PROVIDER` và API key trong `.env`
- `docker compose up -d --force-recreate api`

### Hết RAM khi embed

- VPS < 2 GB RAM dễ OOM khi load model
- Nâng RAM hoặc tạm dừng service khác khi chạy `embed.py --all`

### Port 5432 lộ ra internet

Trong production, có thể **bỏ** map port DB ra ngoài — sửa `docker-compose.yml` bỏ `ports: "5432:5432"` nếu chỉ dùng nội bộ Docker.

---

## Checklist nhanh

- [ ] Docker + Compose cài xong
- [ ] `.env` production (mật khẩu DB + API key)
- [ ] `extra_hosts` cho service `api`
- [ ] `data/pdf`, `data/mp3` đã copy
- [ ] Embed server systemd `active`
- [ ] `docker compose up -d --build` OK
- [ ] `ingest.py` + `embed.py --all` + `--create-index`
- [ ] `/api/health` OK
- [ ] Nginx + HTTPS (nếu có domain)
- [ ] Flutter `API_BASE_URL` trỏ domain
- [ ] Backup DB định kỳ

---

## Tham chiếu thêm

- Tổng quan dự án: [`docs/README.md`](./README.md)
- Schema DB: [`schema.sql`](../schema.sql)
- Env mẫu: [`.env.example`](../.env.example)
