# Hệ thống Blog CMS

Đề tài số 7 môn Triển khai và Quản trị Hệ thống Phần mềm.

## Mục tiêu

Triển khai website Blog / CMS quản lý bài viết, danh mục và người dùng,
sử dụng MySQL và phpMyAdmin.

Mục tiêu cuối cùng là triển khai toàn bộ dịch vụ bằng Docker Compose.

## Phạm vi ứng dụng dự kiến

- Xem danh sách và chi tiết bài đã xuất bản.
- Tìm kiếm, lọc danh mục và phân trang.
- Đăng nhập, đăng xuất và phân quyền.
- Quản lý bài viết với trạng thái nháp và đã xuất bản.
- Quản lý danh mục và người dùng.
- Quản lý ảnh đại diện bài viết.

## Yêu cầu triển khai

- MySQL và phpMyAdmin.
- Nginx reverse proxy với HTTPS tự ký hoặc security headers.
- Prometheus và Grafana giám sát container, web server và database.
- Loki và Promtail thu thập log tập trung.
- Ít nhất 2–3 truy vấn LogQL có minh chứng.
- Ít nhất 3–4 biện pháp hardening có kiểm chứng.
- Báo cáo tối thiểu 10 trang và demo đầy đủ.

## Trạng thái

Đã hoàn thành nền tảng ứng dụng và database:

- Server Express với trang thử nghiệm tại `/`.
- Endpoint `/health/live` kiểm tra khả năng phục vụ HTTP.
- Endpoint `/health/ready` kiểm tra kết nối MySQL.
- Đường dẫn không tồn tại trả HTTP 404.
- MySQL và phpMyAdmin chạy bằng Docker Compose.
- Ba bảng nghiệp vụ: `users`, `categories`, `posts`.
- Express kết nối MySQL bằng connection pool.
- Đã kiểm tra một số ràng buộc dữ liệu, Unicode và khả năng
  kết nối lại khi MySQL hoạt động trở lại.

Chưa triển khai đăng nhập, phân quyền, chức năng quản lý nội dung,
đóng gói Express bằng Docker, Nginx, giám sát và log tập trung.

## Môi trường thực hiện

- WSL Ubuntu 24.04.
- Visual Studio Code kết nối WSL.
- Docker Engine và Docker Compose.
- Git.

## Hướng dẫn chạy

### Chạy bản phát triển trong WSL

Mở terminal tại thư mục dự án.

Chọn phiên bản Node.js:

```bash
nvm use
```

Cài dependency từ lockfile:

```bash
npm ci
```

Trước khi chạy Express, cần có `.env` với các biến bắt buộc
theo `.env.example` và khởi động MySQL:

```bash
docker compose up -d --wait --wait-timeout 240 mysql
```

Khởi động:

```bash

npm start
```

Truy cập: http://localhost:18090

Kiểm tra tiến trình:

```bash
curl -i http://127.0.0.1:18090/health/live
```

Kết quả mong đợi: HTTP 200 với JSON báo trạng thái `ok`.

Kiểm tra đường dẫn không tồn tại:

```bash
curl -i http://127.0.0.1:18090/khong-ton-tai
```

Kết quả mong đợi: HTTP 404.

Dừng ứng dụng bằng Ctrl + C tại terminal đang chạy server.

Endpoint `/health/live` chỉ kiểm tra khả năng phục vụ HTTP,
chưa kiểm tra kết nối database.

### Chạy MySQL và phpMyAdmin bằng Docker Compose

Cần có tệp `.env` theo mẫu `.env.example`, với hai mật khẩu
riêng biệt cho tài khoản ứng dụng và tài khoản root.

Kiểm tra cấu hình:

```bash
docker compose config --quiet
```

Tải image và khởi động:

```bash
docker compose pull
docker compose up -d --wait --wait-timeout 240
```

Xem trạng thái:

```bash
docker compose ps
```

| Thành phần | Địa chỉ |
| --- | --- |
| Website phát triển | http://localhost:18090 |
| MySQL từ WSL | 127.0.0.1:13319 |
| phpMyAdmin | http://localhost:18091 |

Đăng nhập phpMyAdmin bằng tài khoản `blog_app` và mật khẩu
`MYSQL_PASSWORD` trong `.env`.

phpMyAdmin kết nối MySQL qua mạng Docker tại `mysql:3306`.

Dữ liệu MySQL được lưu trong named volume `mysql_data` của dự án.

Các biến khởi tạo MySQL chỉ áp dụng khi thư mục dữ liệu chưa
chứa database. Sửa `.env` sau khi khởi tạo không tự thay đổi
mật khẩu đã lưu trong MySQL.

### Khởi tạo cấu trúc database

Sử dụng Docker Engine cài trực tiếp trong Ubuntu WSL.
Trước khi thao tác, kiểm tra đúng Engine:

```bash
docker info --format 'Name={{.Name}} | OS={{.OperatingSystem}}'
```

Database gồm ba bảng nghiệp vụ: `users`, `categories`, `posts`.

Sau khi MySQL healthy, chạy tệp SQL một lần trên database
chưa có các bảng này:

```bash
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql --protocol=TCP --host=127.0.0.1 --user="$MYSQL_USER" --database="$MYSQL_DATABASE" --default-character-set=utf8mb4' < db/migrations/001_create_core_tables.sql
```

Kiểm tra danh sách bảng:

```bash
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql --protocol=TCP --host=127.0.0.1 --user="$MYSQL_USER" --database="$MYSQL_DATABASE" --execute="SHOW TABLES;"'
```

Tệp SQL hiện được chạy thủ công; chưa có công cụ theo dõi migration.
Không chạy lại tệp tạo bảng trên database đã có các bảng này.

MySQL, phpMyAdmin và cấu trúc database đã được kiểm chứng.

Ứng dụng Express đã kết nối MySQL bằng thư viện `mysql2`,
sử dụng connection pool.

### Cấu hình kết nối ứng dụng

Khi Express chạy trực tiếp trong WSL, đặt trong `.env`:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=13319
```

Ứng dụng sử dụng `MYSQL_USER`, `MYSQL_PASSWORD` và
`MYSQL_DATABASE` từ cấu hình môi trường.

### Kiểm tra sức khỏe ứng dụng

| Endpoint | Ý nghĩa |
| --- | --- |
| `/health/live` | Kiểm tra server còn phục vụ HTTP |
| `/health/ready` | Kiểm tra ứng dụng truy vấn được MySQL |

Kiểm tra:

```bash
curl -sS -w '\nHTTP %{http_code}\n' http://127.0.0.1:18090/health/live
curl -sS -w '\nHTTP %{http_code}\n' http://127.0.0.1:18090/health/ready
```

Kết quả đã kiểm chứng:

- MySQL hoạt động: cả hai endpoint trả HTTP 200.
- MySQL dừng: liveness trả HTTP 200, readiness trả HTTP 503.
- MySQL chạy lại: readiness trở về HTTP 200 mà không cần
  khởi động lại Express.

Readiness hiện sử dụng `SELECT 1`; chưa kiểm tra đầy đủ
cấu trúc bảng hoặc các chức năng nghiệp vụ.

### Kiểm tra database đã thực hiện

- Tạo bài nháp với `published_at` bằng NULL: thành công.
- Xuất bản thiếu thời điểm: bị chặn bởi CHECK constraint.
- Xuất bản có thời điểm: thành công.
- Xóa danh mục đang có bài: bị chặn bởi khóa ngoại.
- Thêm email trùng: bị chặn bởi unique constraint.
- Rollback: các bản ghi thử không còn tồn tại.
- Kiểm tra Unicode qua đầu vào không tương tác: tiếng Việt
  và charset utf8mb4 đúng.

## Cấu hình và dữ liệu

Không đưa mật khẩu, file môi trường thật, khóa riêng,
log runtime hoặc dữ liệu database vào repository.