# VPS helpers

## One-shot deploy (Docker + nginx HTTP)

```bash
cd /opt/tosu-thien
git pull origin main
chmod +x deploy/vps/bootstrap.sh
sudo ./deploy/vps/bootstrap.sh
```

Then HTTPS:

```bash
sudo certbot --nginx \
  -d tosuthien.net -d www.tosuthien.net \
  -d api.tosuthien.net -d admin.tosuthien.net

# .env
nano .env   # PUBLIC_BASE_URL=https://api.tosuthien.net
docker compose up -d --force-recreate api
```

## Swap (RAM ảo từ SSD)

VPS 2GB RAM + SSD 50GB — mặc định **10GB swap**.

```bash
cd /opt/tosu-thien
git pull origin main
chmod +x deploy/vps/setup-swap.sh

sudo ./deploy/vps/setup-swap.sh
```

Kiểm tra:

```bash
free -h
swapon --show
```

Gỡ swap (nếu cần):

```bash
sudo swapoff /swapfile
sudo rm -f /swapfile
sudo sed -i '\|/swapfile|d' /etc/fstab
```

| RAM VPS | Swap (mặc định) | Ghi chú |
|---------|-----------------|---------|
| 2 GB | **10 GB** | Docker + embed + upload MP3 lớn |

`swappiness=10` — ưu tiên RAM, chỉ dùng swap khi thiếu (tốt cho SSD).

## Redeploy sau khi git pull

```bash
cd /opt/tosu-thien
git pull origin main
chmod +x deploy/vps/redeploy.sh
./deploy/vps/redeploy.sh
```

## CI/CD (GitHub Actions — tự deploy khi push `main`)

Workflow: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)

| Thay đổi | Việc CI làm |
|----------|-------------|
| `nestjs/**` | Build image trên GitHub → đẩy GHCR → VPS pull + restart API (nhanh, không build trên VPS) |
| `flutter/**` | Build Flutter web trên GitHub → upload tarball → publish `/opt/tosu-thien/www` |
| `vuejs/**` | SSH VPS `docker compose up -d --build admin` |

### Secret cần có (một lần)

Repo → **Settings → Secrets and variables → Actions**:

| Name | Value |
|------|--------|
| `VPS_SSH_PRIVATE_KEY` | Nội dung private key SSH vào VPS (cùng key đã add vào `authorized_keys`) |

Public key tương ứng phải có trên VPS (`~/.ssh/authorized_keys`).

Hoặc CLI:

```bash
gh secret set VPS_SSH_PRIVATE_KEY < ~/.ssh/id_ed25519_tosuthien
```

### Chạy tay

GitHub → **Actions → Deploy → Run workflow** (tick Force API / Force web nếu cần).

### Local vẫn dùng được

```bash
./deploy/scripts/deploy-api.sh
./deploy/scripts/deploy-flutter-web.sh
```

## Flutter web (build trên Mac)

```bash
cd /path/to/tosuthien
chmod +x deploy/scripts/deploy-flutter-web.sh
./deploy/scripts/deploy-flutter-web.sh
```

Hoặc chỉ build:

```bash
cd flutter
./scripts/build-web-prod.sh
rsync -avz build/web/ root@168.144.120.72:/opt/tosu-thien/www/
```
