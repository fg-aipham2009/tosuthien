# VPS helpers

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
