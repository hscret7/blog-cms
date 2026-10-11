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

Đã hoàn thành nền tảng ứng dụng, database, xác thực và phân quyền:

- Server Express với trang chủ tại `/`.
- Endpoint `/health/live` kiểm tra khả năng phục vụ HTTP.
- Endpoint `/health/ready` kiểm tra kết nối MySQL.
- Đường dẫn không tồn tại trả HTTP 404.
- MySQL và phpMyAdmin chạy bằng Docker Compose.
- Ba bảng nghiệp vụ (`users`, `categories`, `posts`) và bảng `sessions`.
- Express kết nối MySQL bằng connection pool.
- Đã kiểm tra một số ràng buộc dữ liệu, Unicode và khả năng
  kết nối lại khi MySQL hoạt động trở lại.
- Xác thực tài khoản với mật khẩu băm Argon2id (kèm script tạo ADMIN và AUTHOR).
- Quản lý phiên đăng nhập lưu trong MySQL qua express-mysql-session.
- Bảo vệ chống tấn công CSRF cho đăng nhập và đăng xuất.
- Phân quyền truy cập giữa vai trò ADMIN và AUTHOR.
- Giới hạn tần suất đăng nhập (rate limiting) cho `POST /login`.
- Quản lý danh mục cho ADMIN (danh sách, tạo mới, sửa, xóa với khóa ngoại RESTRICT).
- ADMIN có thể thêm, xem danh sách, sửa và xóa danh mục.
- Đã kiểm thử CRUD danh mục, slug trùng, slug sai định dạng,
  cập nhật không đổi nội dung và xử lý ID không hợp lệ.
- Đã kiểm thử quyền truy cập danh mục và chặn POST thiếu CSRF
  khi đang đăng nhập ADMIN.
- Có danh sách quản lý bài viết tại `/manage/posts`.
- ADMIN quản lý bài của mọi tác giả; AUTHOR chỉ quản lý bài của mình.
- Đã triển khai tạo bài nháp và sửa nội dung.
- Bài mới có trạng thái DRAFT và published_at bằng NULL.
- Chưa triển khai xuất bản, chuyển về nháp, xóa bài và ảnh đại diện.

Chưa triển khai chức năng quản lý bài viết và người dùng,
đóng gói Express bằng Docker, Nginx reverse proxy, giám sát và log tập trung.

### Kiểm thử quản lý danh mục

Đã kiểm thử thủ công:
- Thêm, sửa và xóa danh mục chưa có bài viết.
- Hiển thị và lưu dữ liệu tiếng Việt.
- Từ chối slug trùng và slug sai định dạng.
- Cập nhật không đổi nội dung vẫn thành công.
- Hủy xác nhận xóa không làm mất danh mục.
- ID sai định dạng trả HTTP 400; ID không tồn tại trả HTTP 404.
- Người chưa đăng nhập được chuyển về trang đăng nhập.
- AUTHOR bị từ chối truy cập quản lý danh mục với HTTP 403.
- ADMIN gửi POST thiếu CSRF bị từ chối với HTTP 403.

Test tự động cho validation danh mục và giới hạn đăng nhập:
10 mục PASS, 0 FAIL.

Chưa kiểm thử qua giao diện trường hợp xóa danh mục đang có
bài viết liên kết; sẽ thực hiện khi triển khai chức năng bài viết.

### Kiểm thử tạo và sửa bài nháp

Đã kiểm chứng:
- ADMIN và AUTHOR tạo bài nháp với tác giả đúng tài khoản đăng nhập.
- Sửa nội dung và lưu không đổi nội dung thành công.
- Slug trùng bị từ chối, không tạo thêm bài.
- AUTHOR chỉ thấy bài của mình trong danh sách.
- POST của AUTHOR nhằm sửa bài ADMIN bị từ chối với HTTP 404;
  dữ liệu bài ADMIN không thay đổi.
- ADMIN sửa bài AUTHOR nhưng không thay đổi tác giả.
- POST tạo và sửa bài thiếu CSRF bị từ chối với HTTP 403.
- Bộ test validation bài viết, danh mục và giới hạn đăng nhập:
  17 mục PASS, 0 FAIL.

Danh sách quản lý đã có mã phân trang; chưa kiểm chứng chuyển trang
với dữ liệu trên 20 bài.

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

### Kiểm tra xác thực và phân quyền đã thực hiện

- Đăng nhập đúng và sai mật khẩu: đăng nhập đúng thông tin thành công và chuyển hướng tới `/account`; nhập sai mật khẩu bị từ chối với HTTP 401 và hiển thị lỗi.
- Lưu trữ phiên trong MySQL: phiên đăng nhập được lưu chính xác trong bảng `sessions`, mã phiên (session ID) được tái tạo mới khi đăng nhập.
- Đăng xuất và chặn truy cập: đăng xuất hủy phiên trong MySQL và xóa cookie; truy cập `/account` sau khi đăng xuất bị chặn và chuyển hướng về `/login`.
- Bảo vệ CSRF: yêu cầu `POST /login` và `POST /logout` thiếu CSRF token (hoặc sai token) bị từ chối với HTTP 403.
- Phân quyền vai trò: tài khoản vai trò `AUTHOR` truy cập được `/account`, nhưng bị từ chối khi truy cập `/admin` (HTTP 403).
- Xử lý khóa tài khoản: khi đổi trạng thái tài khoản `AUTHOR` thành `LOCKED`, phiên hiện tại bị từ chối ngay lập tức, bị hủy trong MySQL và chuyển hướng về `/login`; tài khoản bị khóa không thể đăng nhập. Khi tài khoản được mở khóa lại (`ACTIVE`), người dùng phải đăng nhập lại để khởi tạo phiên mới.
- Hoạt động của rate limiter: 10 yêu cầu `POST /login` đầu tiên thiếu CSRF trả HTTP 403, yêu cầu thứ 11 vượt giới hạn bị chặn với HTTP 429.
- Tính độc lập của limiter: yêu cầu `GET /login` cùng hai endpoint `/health/live` và `/health/ready` không bị hạn chế và tiếp tục phục vụ với HTTP 200.

### Tạo tài khoản quản trị website

Sau khi database đã có các bảng nghiệp vụ, chạy:

```bash
npm run create-admin
```

Script hỏi tên hiển thị, email, mật khẩu và xác nhận mật khẩu.

- Email được bỏ khoảng trắng đầu/cuối và chuyển về chữ thường.
- Mật khẩu có từ 15 đến 128 ký tự, được nhập ẩn trên terminal.
- Mật khẩu được băm bằng Argon2id trước khi lưu.
- Tài khoản được tạo với vai trò ADMIN và trạng thái ACTIVE.
- Email đã tồn tại sẽ bị từ chối; tài khoản cũ không bị thay đổi.

Tài khoản ADMIN này dùng cho website, khác với tài khoản
MySQL `blog_app`.

### Tạo tài khoản tác giả (AUTHOR)

Để phục vụ kiểm tra phân quyền, chạy:

```bash
npm run create-author
```

Script tạo tài khoản với vai trò cố định AUTHOR và trạng thái ACTIVE,
sử dụng quy trình nhập tương tác và chính sách mật khẩu tương tự
tài khoản ADMIN.

Quy định phân quyền đối với vai trò AUTHOR:
- Được phép truy cập trang thông tin tài khoản `/account`.
- Không được phép truy cập khu vực quản trị `/admin` (bị từ chối HTTP 403).

### Phiên đăng nhập

Đã tích hợp express-session với session store MySQL.

- Bảng sessions được tạo bằng migration
  db/migrations/002_create_sessions_table.sql.
- SESSION_SECRET được lưu trong .env; không đưa vào Git.
- Cookie có tên blogcms.sid, bật HttpOnly và SameSite=Lax.
- Thời hạn cookie là 8 giờ.
- Hiện chạy HTTP tại máy phát triển nên Secure chưa bật.
- Không lưu phiên mới chưa có dữ liệu.
- Các endpoint health được đặt trước middleware session.

Đã kiểm chứng session store ghi, đọc và xóa dữ liệu trong MySQL.
Cookie phiên `blogcms.sid` được tạo khi đăng nhập thành công và bị xóa khi đăng xuất.

Khi nhận SIGINT hoặc SIGTERM, ứng dụng ngừng nhận yêu cầu,
đợi các yêu cầu đang chạy hoàn tất, đóng session store và
connection pool. Thời gian chờ tối đa là 10 giây.

### Giới hạn thử đăng nhập (Rate Limiting)

Đã triển khai giới hạn thử đăng nhập cho tuyến `POST /login` bằng `express-rate-limit`:

- Áp dụng tối đa 10 yêu cầu trong 15 phút theo địa chỉ IP.
- Tính cả lượt đăng nhập thành công và thất bại.
- Middleware rate limit được đặt trước `parseForm`, `requireCsrf` và `login`
  để các yêu cầu bị chặn không thực hiện kiểm tra form hoặc xác minh Argon2.
- Khi vượt giới hạn, hệ thống trả về HTTP 429 kèm thông báo:
  "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau."
  Phản hồi có các header `Retry-After` và `Cache-Control: no-store`.
- Chỉ áp dụng đối với `POST /login`. Không hạn chế `GET /login`, `/health/live`,
  `/health/ready`, `/account` hoặc `/logout`.
- Sử dụng `MemoryStore` cho phiên bản một tiến trình hiện tại. Bộ đếm sẽ bị mất
  khi khởi động lại ứng dụng và không được chia sẻ giữa nhiều tiến trình hoặc container.
- Giữ nguyên cấu hình `trust proxy` mặc định (chưa bật `trust proxy = true` và không
  tự lấy IP từ `X-Forwarded-For`). Proxy ngược Nginx sẽ được cấu hình ở giai đoạn sau.

### Quản lý danh mục (ADMIN)

Đã triển khai các chức năng quản lý danh mục theo cấu trúc repository → service → controller → routes:

- `GET /admin/categories`: Danh sách danh mục, thứ tự ID giảm dần.
- `GET /admin/categories/new`: Giao diện biểu mẫu thêm danh mục mới.
- `POST /admin/categories`: Tạo danh mục mới.
- `GET /admin/categories/:id/edit`: Giao diện chỉnh sửa danh mục theo ID.
- `POST /admin/categories/:id/update`: Cập nhật danh mục theo ID.
- `POST /admin/categories/:id/delete`: Xóa danh mục theo ID (có xác nhận trên giao diện).

Bảo vệ và quy tắc nghiệp vụ:
- Toàn bộ route quản lý danh mục yêu cầu đăng nhập với vai trò ADMIN (`requireAuth`, `requireRole('ADMIN')`).
- Mọi thao tác POST đều yêu cầu phân tích form (`parseForm`) và kiểm tra CSRF token (`requireCsrf`).
- Thiết lập `Cache-Control: no-store` cho toàn bộ khu vực quản trị.
- Ràng buộc dữ liệu: tên (1–100 code points), slug duy nhất (chữ thường, số, phân cách bằng dấu gạch ngang, tối đa 150 ký tự), mô tả (tùy chọn, tối đa 500 code points, để trống lưu NULL).
- Bắt lỗi trùng slug trả HTTP 409, dữ liệu form không hợp lệ trả HTTP 422, ID sai định dạng trả HTTP 400, không tìm thấy danh mục trả HTTP 404.
- Khóa ngoại: danh mục đang có bài viết liên kết sẽ bị chặn xóa bởi ràng buộc RESTRICT trong database, bắt lỗi `ER_ROW_IS_REFERENCED_2` để trả HTTP 409 kèm thông báo tiếng Việt rõ ràng.

## Cấu hình và dữ liệu

Không đưa mật khẩu, file môi trường thật, khóa riêng,
log runtime hoặc dữ liệu database vào repository.