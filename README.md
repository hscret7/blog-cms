# Hệ thống Blog CMS

Đề tài số 7 môn Triển khai và Quản trị Hệ thống Phần mềm.

## Mục tiêu

Triển khai website Blog / CMS quản lý bài viết, danh mục và người dùng,
sử dụng MySQL và phpMyAdmin.

Toàn bộ dịch vụ được triển khai bằng Docker Compose.

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

Đã tạo server Express cơ bản.

- Trang thử nghiệm tại `/`.
- Endpoint kiểm tra tiến trình tại `/health/live`.
- Đường dẫn không tồn tại trả HTTP 404.

Chưa tích hợp MySQL, chức năng nghiệp vụ và các dịch vụ hạ tầng.

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

Hiện tại MySQL và phpMyAdmin đã chạy; ứng dụng Express chưa
kết nối database và các bảng nghiệp vụ chưa được tạo.

## Cấu hình và dữ liệu

Không đưa mật khẩu, file môi trường thật, khóa riêng,
log runtime hoặc dữ liệu database vào repository.