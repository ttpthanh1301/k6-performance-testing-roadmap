Markdown

## ⚙️ Bài 2.1: Hướng dẫn Cài đặt k6 (Windows, macOS & Docker)

> **Mục tiêu bài học:** Cài đặt thành công công cụ k6 lên máy tính cá nhân hoặc môi trường container (Docker).

### 🍎 1. Cài đặt trên macOS

Sử dụng Homebrew:

```bash
brew install k6
```

###🪟 2. Cài đặt trên Windows
Cách 1: Dùng Winget (Khuyên dùng)

```bash
winget install k6 --source winget
```

Cách 2: Dùng Chocolatey

```bash
choco install k6
```

Cách 3: Cài đặt thủ công
Tải file .msi mới nhất từ k6 Releases trên GitHub và cài đặt.

🐳 3. Sử dụng k6 qua Docker (Cho CI/CD)
Tải image k6 chính thức:

```bash
docker pull grafana/k6
```

Chạy thử để kiểm tra version:

```bash
docker run --rm -i grafana/k6 version
```

✅ 4. Kiểm tra cài đặt
Mở Terminal/PowerShell mới và gõ:

```bash
k6 version
```

(Nếu hệ thống in ra thông tin phiên bản k6, bạn đã cài đặt thành công!)
