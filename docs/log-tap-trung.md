# Commit 3: Loki + Promtail và LogQL

Mục tiêu: thu log của **app, Nginx, MySQL, phpMyAdmin thuộc Compose Blog CMS**,
xem trên Grafana và demo ba truy vấn LogQL. Không thu các container WordPress
hoặc dự án khác đang chạy trên máy.

## Cấu trúc và giới hạn quyền

- Nginx ghi JSON ra stdout: thời gian, method, path, HTTP status, duration, bytes.
  Không ghi query string, cookie, Authorization, body hay referrer; bỏ healthcheck.
- Script `scripts/prepare-log-targets.py` đọc metadata bằng Docker CLI trên WSL,
  chỉ lấy nhãn Compose, LogPath và log driver, không đọc environment container.
- Danh sách đường dẫn container cụ thể nằm tại
  `runtime/promtail-targets/containers.json` (được Git bỏ qua), không dùng wildcard
  để chọn tất cả container. Chạy lại script sau khi recreate nguồn log.
- Promtail đọc Docker json-file qua mount chỉ đọc, giải mã envelope Docker,
  gắn nhãn `project="blog-cms"`, `service`, `environment`, loại log quá 7 ngày
  và che query string còn có trong log cũ/error log.
- Loki nhận log, lưu TSDB v13 + filesystem trong named volume, retention 7 ngày.
  Retention không phải quota dung lượng: theo dõi đĩa và sao lưu volume nếu cần.
  Docker vẫn xoay log theo giới hạn 10m × 3 file; collector dừng lâu có thể
  mất phần log đã bị xoay/xóa, retention Loki không khôi phục phần chưa thu.
- Grafana dùng datasource `Blog CMS Loki` (UID `blog-cms-loki`), cùng datasource
  Prometheus hiện có. Dashboard mới UID `blog-cms-logs` có ba panel mẫu.
- Loki chạy UID 10001, read-only rootfs, không capability và no-new-privileges.
  Loki chỉ nối monitoring network và publish **127.0.0.1:13100**, không dùng 3100
  của stack WordPress. Promtail không publish port và không gắn Docker socket.
- Promtail chạy root để đọc tệp log root-owned, nhưng drop ALL capabilities,
  read-only rootfs và chỉ ghi positions volume. Mount thư mục log Docker vẫn
  cho tiến trình khả năng đọc log khác nếu bị khai thác; filter chỉ giới hạn
  dữ liệu thu thập, không phải cách ly quyền đọc tuyệt đối. Đây là ngoại lệ cần
  nêu rõ khi demo hardening, không tuyên bố mọi container đều non-root.
- Đề bài yêu cầu Promtail. Công cụ này EOL từ 02/03/2026; dùng bản ghim 3.5.11
  cho bài thực hành local. Loki ghim 3.6.17. Khi vận hành lâu dài chuyển Alloy.
- Dữ liệu stdout app/MySQL/phpMyAdmin được giữ như nguồn phát ra, không tuyên
  bố pipeline che được mọi loại bí mật. Không bật log request body/password,
  Google token hoặc SQL general log chứa dữ liệu người dùng.

## 1. Lấy code, kiểm tra cổng — Terminal Ubuntu/WSL

Không chạy các lệnh này trong PowerShell, DevTools hoặc ô code của VS Code.

```bash
cd ~/projects/blog-cms
git status --short
git pull --ff-only origin codex/cms-ui-navigation
ss -ltn 'sport = :13100'
docker info --format 'DockerRoot={{.DockerRootDir}}'
docker compose config --quiet
python3 tests/log-targets.test.py
```

Nếu status có thay đổi riêng, lưu trước khi pull; không reset. Cổng 13100 cần
trống. Docker Root hiện tại của bạn là `/var/lib/docker`; nếu khác, đặt
`DOCKER_LOG_ROOT=<DockerRoot>/containers` trong `.env`. Nếu cổng bận, đặt
`LOKI_HOST_PORT` sang cổng localhost trống và dùng `--loki` tương ứng khi verify.
Không in toàn bộ `docker compose config` vì có thể chứa mật khẩu đã nội suy.

Không có migration database hoặc đổi mật khẩu. Không rebuild app cho phần này.

## 2. Pull image, tạo nguồn log, kiểm tra cấu hình — Terminal WSL

Bốn dịch vụ nguồn phải đã có container. Nếu thiếu, khởi động đúng dịch vụ đó
trước; script sẽ dừng khi thiếu hoặc gặp log driver/path không đúng.

```bash
(
  set -e
  cd ~/projects/blog-cms
  docker compose pull loki promtail
  python3 scripts/prepare-log-targets.py

  docker compose run --rm --no-deps \
    --entrypoint /usr/bin/loki loki \
    -config.file=/etc/loki/loki.yml -verify-config=true

  docker compose run --rm --no-deps \
    --entrypoint /usr/bin/promtail promtail \
    -config.file=/etc/promtail/promtail.yml -check-syntax

  docker compose run --rm --no-deps \
    --entrypoint nginx nginx -t
)
```

Mong đợi: Loki config valid, Promtail syntax valid, Nginx test successful.
Loki image là distroless, không có shell/wget: healthcheck dùng `/usr/bin/loki
-health`. Không thay bằng CMD-SHELL/wget cho image này.

## 3. Áp dụng cấu hình — Terminal WSL

Nginx được recreate để bind mount thấy đúng file sau git pull. Website có thể
ngắt ngắn lúc recreate Nginx. Grafana giữ database/password/dashboard trong
volume hiện có khi recreate. Không dùng `down -v`.

```bash
(
  set -e
  cd ~/projects/blog-cms

  docker compose up -d --no-build --no-deps --force-recreate \
    --wait --wait-timeout 120 nginx

  python3 scripts/prepare-log-targets.py

  docker compose up -d --no-build \
    --wait --wait-timeout 120 loki promtail

  docker compose up -d --no-build --no-deps --force-recreate \
    --wait --wait-timeout 120 grafana

  docker compose ps app nginx loki promtail grafana
  curl --max-time 10 -fsS http://127.0.0.1:13100/ready
  python3 scripts/verify-central-logs.py
)
```

Script verify gọi website bằng GET, tạo một đường dẫn ngẫu nhiên trả 404,
đợi log đi qua Promtail rồi chạy ba query API. Nó không tạo tài khoản/bài viết
và không in log thô. Cần PASS cho request 404 vừa tạo và cả ba query.

Promtail không có Docker healthcheck (image không bảo đảm wget); trạng thái
`Up` chưa đủ chứng minh scrape. Verify và `/ready` qua mạng nội bộ mới là bằng
chứng. Đọc readiness từ Grafana container khi cần:

```bash
docker compose exec -T grafana wget -q -O - http://promtail:9080/ready
docker compose logs --tail=40 loki promtail
```

Nếu chưa có log: kiểm tra JSON targets có bốn dịch vụ, Docker log root và quyền
đọc; không chmod 777 thư mục Docker, không gắn Docker socket để chữa nhanh.
Gửi lỗi cấu hình cụ thể, không in `.env`, inspect đầy đủ hoặc token.

## 4. Xem bằng Grafana — trình duyệt

Mở [Grafana đăng nhập](http://localhost:13000/login), dùng admin/password Grafana
đã tạo trước đây (khác tài khoản Google/Blog CMS).

- Mở [Connections → Data sources](http://localhost:13000/connections/datasources),
  chọn **Blog CMS Loki**, dùng **Save & test** nếu giao diện cho phép. Datasource
  provisioned bị khóa sửa; không thay URL thành localhost:13100 vì Grafana đang
  chạy trong container và kết nối đến `http://loki:3100` qua monitoring network.
- Mở [Explore](http://localhost:13000/explore), chọn **Blog CMS Loki**, chuyển
  sang **Code**, chọn khoảng thời gian **Last 1 hour**, nhập từng query và Run query.
- Mở [Dashboard Blog CMS - Logs](http://localhost:13000/d/blog-cms-logs) để xem
  ba panel. Dashboard Prometheus hiện có vẫn giữ nguyên.

### Query 1 — log của bốn dịch vụ Blog CMS

```logql
{project="blog-cms", service=~"app|nginx|mysql|phpmyadmin"}
```

Chụp minh chứng có nhãn project/service và nội dung log. Nếu muốn xem startup
MySQL/app cũ, tăng khoảng thời gian tới Last 7 days; không tạo log giả rồi gọi
đó là log MySQL thật. MySQL quiet sau startup là bình thường, không bật general
log chỉ để có thêm dữ liệu demo.

### Query 2 — các HTTP lỗi từ Nginx

```logql
{project="blog-cms", service="nginx"} | json | __error__="" | status >= 400
```

Request 404 do script verify vừa tạo phải xuất hiện. JSON parser chỉ áp dụng log
mới sau recreate Nginx; log text cũ/error log được bỏ khỏi query bởi `__error__`.

### Query 3 — số dòng log trong cửa sổ 10 phút theo dịch vụ

```logql
sum by (service) (
  count_over_time({project="blog-cms", service=~"app|nginx|mysql|phpmyadmin"}[10m])
)
```

Đây là số dòng log, không phải tổng request hoặc CPU/RAM. Không có mẫu trong
10 phút thì series có thể không hiện; tạo thêm traffic website rồi chạy lại.

## 5. Kiểm tra positions và recreate nguồn log

Recreate Promtail giữ positions volume để tránh đọc lại từ đầu:

```bash
docker compose up -d --no-build --no-deps --force-recreate promtail
python3 scripts/verify-central-logs.py
```

Khi recreate app/nginx/mysql/phpmyadmin, container ID và LogPath đổi. Chạy:

```bash
python3 scripts/prepare-log-targets.py
```

Promtail tự đọc targets file mới trong khoảng 10 giây. Không cần restart Loki.
Đây là thao tác thủ công được ghi rõ, chưa có cron/tự động đồng bộ mỗi lần deploy.
Nếu quên bước này, readiness có thể vẫn 200 do nguồn khác còn sống nhưng log
container mới chưa được thu. Hãy dùng request marker/verify để kiểm chứng.

## 6. Bằng chứng và commit theo đề bài

Sau khi kiểm chứng trên máy bạn, lưu:

1. Compose ps và kết quả config validators.
2. PASS từ `verify-central-logs.py` (request thật và 3 query thật).
3. Ảnh Grafana Explore mỗi query và dashboard log.
4. Docker inspect của riêng các trường user/cap_drop/mount read-only/network;
   không chụp mật khẩu, cookie hoặc token.

Code đã được kiểm tra độc lập: 8 test chọn đường dẫn/driver/project/service;
Compose model bằng CLI 2.40.3; config Loki 3.6.17 và Promtail 3.5.11 bằng binary
chính thức đã kiểm tra SHA256; pipeline native với bốn nguồn Docker JSON mẫu,
loại project khác, che query, bỏ healthcheck và restart collector giữ positions.
Nginx 1.30.5 đã kiểm tra cấu hình với cổng thích nghi trong môi trường test và
traffic HTTP mẫu, giữ security headers. **Chưa chạy các container thật của bạn,
chưa xác nhận dashboard Grafana hoặc MySQL log thật ở môi trường của bạn.**

Commit cấu hình riêng có tên “Triển khai log tập trung Loki Promtail và LogQL”.
Chỉ đánh dấu bước 5/commit 3 được nghiệm thu khi có các kết quả runtime phía trên.

Nguồn chính thức:
- https://grafana.com/docs/loki/latest/send-data/promtail/
- https://grafana.com/docs/loki/latest/operations/storage/retention/
- https://github.com/grafana/loki/blob/v3.5.11/docs/sources/send-data/promtail/configuration.md
