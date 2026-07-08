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
