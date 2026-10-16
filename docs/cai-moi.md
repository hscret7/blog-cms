# Cài mới trên Ubuntu/WSL

Chỉ dùng với checkout mới và database chưa có bảng. Máy đang chạy dự án của Minh Huệ
đã áp dụng 001–005: **không chạy lại phần khởi tạo này**.
Không dùng `docker compose down -v` để cập nhật.

Yêu cầu: Docker Engine rootful, Compose v2, Python 3, Node 24 (nvm), Git.
Cấu hình hiện tại dành cho người dùng UID/GID 1000; kiểm tra bằng `id -u; id -g`.
Các bind mount ảnh và secrets phải thuộc UID 1000. Nếu khác, cần điều chỉnh ownership
cho app/Grafana/exporter trước khi khởi động, không dùng chmod 777.
Kiểm tra cổng 18090, 18091, 13319, 13000, 19090, 13100 còn trống và subnet
172.26.0.0/24 không trùng mạng đang dùng. cAdvisor cần `/dev/kmsg` và cgroup v2.

Mọi khối bash/Python dưới đây dán vào Terminal Ubuntu/WSL, tại thư mục repo.

## 1. Tạo cấu hình riêng, không ghi đè tệp có sẵn

```bash
(
set -e
cd ~/projects/blog-cms
nvm use
npm ci
python3 - <<'PY'
import os, secrets
from pathlib import Path
os.umask(0o077)
template = Path('.env.example').read_text()
for key in ['MYSQL_PASSWORD', 'MYSQL_ROOT_PASSWORD', 'SESSION_SECRET']:
    lines = template.splitlines()
    template = '\n'.join(key + '=' + secrets.token_hex(32) if line.startswith(key + '=') else line for line in lines) + '\n'
with Path('.env').open('x') as f:
    f.write(template)
Path('uploads/covers').mkdir(parents=True, exist_ok=True)
for folder in ['uploads', 'uploads/covers', 'secrets']:
    Path(folder).mkdir(exist_ok=True)
    os.chmod(folder, 0o700)
print('Đã tạo .env và thư mục riêng; không in mật khẩu.')
PY
docker compose config --quiet
docker compose up -d --wait --wait-timeout 240 mysql phpmyadmin
)
```

SMTP và Google có thể để trống khi cài ban đầu: đăng nhập tài khoản ADMIN/CLI vẫn
dùng được. Đăng ký, xác minh, quên mật khẩu cần SMTP thật; nút Google cần OAuth
Client ID thật. Cách cấu hình nằm trong `cap-nhat-cong-dong.md` và
`cap-nhat-tuong-tac-google.md`. Không commit `.env` hoặc secrets.

## 2. Tạo đủ cấu trúc database — chỉ một lần

```bash
(
  set -e
  for file in db/migrations/00{1,2,3,4,5}_*.sql; do
    docker compose exec -T mysql sh -c '
      MYSQL_PWD="$MYSQL_PASSWORD" exec mysql \
        --protocol=TCP --host=127.0.0.1 --user="$MYSQL_USER" \
        --database="$MYSQL_DATABASE" --default-character-set=utf8mb4
    ' < "$file"
    printf 'Đã chạy %s\n' "$file"
  done
)
```

Nếu lỗi, dừng và kiểm tra migration đã áp dụng; DDL MySQL có thể đã chạy một phần.
Repo chưa có migration runner hoặc bảng theo dõi tự động.

## 3. Chuẩn bị tài khoản exporter và mật khẩu Grafana

Khối dưới dùng tên exporter cố định `blog_exporter`, chỉ cấp quyền đọc để giám sát.
Nó dừng nếu tệp bí mật đã tồn tại; không dùng cho thao tác đổi mật khẩu.

```bash
python3 - <<'PY'
import getpass, os, secrets, subprocess
from pathlib import Path
os.umask(0o077)
directory = Path('secrets')
directory.mkdir(mode=0o700, exist_ok=True)
exporter = directory / 'mysql-exporter.cnf'
grafana = directory / 'grafana-admin-password'
if exporter.exists() or grafana.exists():
    raise SystemExit('Đã có secrets; dừng để tránh ghi đè.')
password = getpass.getpass('Mật khẩu ADMIN Grafana (15–128 ký tự): ')
confirmation = getpass.getpass('Nhập lại mật khẩu Grafana: ')
if password != confirmation or not 15 <= len(password) <= 128 or '\n' in password or '\r' in password:
    raise SystemExit('Mật khẩu Grafana không hợp lệ hoặc không khớp.')
db_password = secrets.token_hex(32)
sql = ("CREATE USER 'blog_exporter'@'%' IDENTIFIED BY '" + db_password + "' WITH MAX_USER_CONNECTIONS 3;"
       "GRANT PROCESS, REPLICATION CLIENT, SELECT ON *.* TO 'blog_exporter'@'%';")
subprocess.run(['docker','compose','exec','-T','mysql','sh','-c',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --user=root'], input=sql, text=True, check=True)
with exporter.open('x') as f:
    f.write('[client]\nuser=blog_exporter\npassword=' + db_password + '\n')
with grafana.open('x') as f:
    f.write(password)
print('Đã chuẩn bị tài khoản giám sát và secrets, không in mật khẩu.')
PY
git check-ignore secrets/mysql-exporter.cnf secrets/grafana-admin-password
```

Nếu SQL lỗi do user đã có, không xóa user hoặc thay secrets tùy ý; đối chiếu trạng thái
database trước khi tiếp tục. Nếu ghi tệp thất bại sau CREATE USER, cần khôi phục
cấu hình tài khoản giám sát trước khi chạy lại. Không đưa tệp secrets vào ảnh chụp.

## 4. Build và chạy website, giám sát

```bash
(
set -e
docker build -t blog-cms-app:local .
docker compose run --rm --no-deps app npm run create-admin
docker compose up -d --no-build --wait --wait-timeout 240 \
  app nginx phpmyadmin prometheus grafana mysql-exporter nginx-exporter cadvisor
python3 scripts/prepare-log-targets.py
docker compose up -d --no-build --wait --wait-timeout 240 loki promtail
)
```

Không dùng `docker compose run nginx` để kiểm tra cấu hình khi Nginx đang chạy,
vì service có IP tĩnh. Nếu cần kiểm tra:

```bash
docker run --rm --network none \
  --mount "type=bind,src=$PWD/infra/nginx/default.conf,dst=/etc/nginx/conf.d/default.conf,readonly" \
  nginx:stable-alpine nginx -t
```

## 5. Kiểm chứng và truy cập

```bash
npm test
python3 tests/log-targets.test.py
docker compose ps
curl --max-time 10 -fsS http://127.0.0.1:18090/health/ready
python3 scripts/verify-central-logs.py
```

| Thành phần | URL trên trình duyệt |
|---|---|
| Website | http://localhost:18090/ |
| phpMyAdmin | http://localhost:18091/ |
| Prometheus targets | http://localhost:19090/targets |
| Grafana tổng quan | http://localhost:13000/d/blog-cms-overview |
| Grafana log | http://localhost:13000/d/blog-cms-logs |
| Grafana Explore | http://localhost:13000/explore |

phpMyAdmin dùng `MYSQL_USER` và `MYSQL_PASSWORD` trong `.env`; Grafana dùng `admin`
và mật khẩu đã nhập. Bộ kiểm thử không tự tạo dữ liệu demo trong MySQL; tạo danh
mục, bài viết, tài khoản từ giao diện sau khi đăng nhập ADMIN.

Sau mỗi lần recreate app/nginx/mysql/phpmyadmin, chạy lại
`python3 scripts/prepare-log-targets.py`, rồi verify log. Xem `log-tap-trung.md`
về retention và giới hạn thu thập. Hướng dẫn này được rà soát thứ tự/cấu hình;
chưa chạy thử toàn bộ trên một Docker host sạch trong đợt rà soát 16/10/2026.
