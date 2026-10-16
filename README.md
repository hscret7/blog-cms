> Bản đang phát triển nằm trên nhánh `codex/cms-ui-navigation`; PR #1 chưa merge `main`.
> Bản trả lời tiếp vào mọi câu trả lời cần **migration 006 đúng một lần**, sau khi sao lưu và dừng app. Database hiện tại đã có 001–005: không chạy lại các migration đó. Xem [hướng dẫn cập nhật trả lời](docs/tra-loi-tiep.md).
> Quy tắc bình luận và thông báo hiện tại: [docs/thong-bao-binh-luan.md](docs/thong-bao-binh-luan.md).

# Hệ thống Blog CMS

Cài trên máy mới: [hướng dẫn đầy đủ từ database rỗng](docs/cai-moi.md).
Kết quả rà soát trước báo cáo: [docs/ra-soat-du-an.md](docs/ra-soat-du-an.md).

> Cài mới xem `docs/cai-moi.md`. Các tài liệu cập nhật 003/004/005 mô tả từng mốc lịch sử, không phải lệnh phải chạy lại mỗi lần pull.
> `docs/ra-soat-du-an.md` là bản rà soát kỹ thuật, không phải báo cáo nộp môn.


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
- Phân quyền ADMIN, AUTHOR và READER; đăng ký công khai luôn là READER.
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
- Đã triển khai xuất bản, chuyển về nháp và xóa bài
- Website công khai hiển thị danh sách và chi tiết bài đã xuất bản.
- Tìm kiếm tiêu đề/nội dung, lọc danh mục, sắp xếp và phân trang 10 bài/trang.
- Bài nháp không xuất hiện trên website công khai.
- Nội dung bài viết hiển thị dưới dạng văn bản, được escape HTML.
- ADMIN quản lý người dùng qua giao diện: danh sách, tạo tài khoản, sửa tên, email, vai trò và khóa/mở khóa.
- Chặn tự khóa và tự hạ quyền tài khoản ADMIN đang đăng nhập.
- Thay đổi vai trò và trạng thái được kiểm tra lại ở mỗi yêu cầu truy cập trang yêu cầu xác thực.
- Đã triển khai ảnh đại diện bài viết: tải, thay, gỡ ảnh, hiển thị trên website công khai và dọn ảnh khi xóa bài.
- Đã triển khai giám sát Nginx, MySQL và container bằng Prometheus, các exporter, cAdvisor và Grafana.

Đã triển khai Loki + Promtail, Grafana datasource/dashboard và ba query LogQL. Ngày 16/10/2026, sinh viên đã cung cấp kết quả Loki HTTP 200, request 404 đi qua Nginx → Promtail → Loki và cả ba query có dữ liệu. Ảnh minh chứng Grafana cần lưu cho báo cáo.
Express, MySQL và phpMyAdmin đã chạy bằng Docker Compose.
Đã triển khai Nginx reverse proxy với security headers.
Website được truy cập qua Nginx; app không công bố cổng ra host.
Hướng dẫn triển khai và minh chứng log tập trung: [docs/log-tap-trung.md](docs/log-tap-trung.md).


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
10 mục PASS, 0 FAIL tại mốc validation ban đầu; số này không phải tổng test hiện tại.

Ca còn cần nghiệm thu riêng trên giao diện: xóa danh mục đang có bài viết phải bị chặn; không coi có khóa ngoại là bằng chứng đã chạy ca UI này.

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
  17 mục PASS, 0 FAIL tại mốc tạo/sửa bài ban đầu.

Danh sách quản lý đã có mã phân trang; chưa kiểm chứng chuyển trang
với dữ liệu trên 20 bài.

### Xuất bản, chuyển về nháp và xóa bài

Đã kiểm chứng thủ công:
- AUTHOR xuất bản và chuyển bài của mình về nháp.
- Xuất bản lặp không thay đổi thời điểm xuất bản.
- Sửa nội dung bài đang xuất bản giữ nguyên published_at.
- Chuyển về nháp đặt published_at bằng NULL.
- Xuất bản lại ghi thời điểm mới.
- AUTHOR không thể xuất bản, gỡ hoặc xóa bài ADMIN:
  các yêu cầu bị từ chối với HTTP 404.
- Ba thao tác thiếu CSRF bị từ chối với HTTP 403.
- Hủy xác nhận xóa giữ lại bài; xác nhận xóa bài thử thành công.

Bộ test tại mốc triển khai xuất bản ban đầu: 17 mục PASS, 0 FAIL.
Các test này kiểm tra validation và giới hạn đăng nhập;
nghiệp vụ xuất bản và xóa được kiểm thử thủ công.

## Môi trường thực hiện

- WSL Ubuntu 24.04.
- Visual Studio Code kết nối WSL.
- Docker Engine và Docker Compose.
- Git.

### Website công khai

Không cần đăng nhập để truy cập:

| Địa chỉ | Chức năng |
| --- | --- |
| `/` | Danh sách bài đã xuất bản |
| `/posts/:slug` | Chi tiết bài đã xuất bản |

Trang chủ hỗ trợ các tham số:

- `q`: tìm kiếm theo tiêu đề và nội dung, tối đa 200 ký tự Unicode.
- `category_id`: lọc theo ID danh mục.
- `page`: số trang; mỗi trang hiển thị tối đa 10 bài.

Bài viết được sắp xếp theo thời điểm xuất bản giảm dần,
sau đó theo ID giảm dần.

Các trường hợp đã kiểm tra thủ công:

- Bài đã xuất bản trả HTTP 200; bài nháp trả HTTP 404.
- Chuyển về nháp làm bài biến mất khỏi danh sách công khai.
- Xuất bản lại cho phép truy cập chi tiết.
- Tìm kiếm kết hợp lọc danh mục cho kết quả phù hợp.
- Không có kết quả hiển thị danh sách rỗng.
- Số trang sai định dạng trả HTTP 400.
- Từ khóa `%` được tìm như ký tự thông thường.
- Nội dung chứa thẻ HTML được hiển thị nguyên văn.
- Với 11 bài, trang đầu có 10 bài và trang sau có 1 bài.
- Chuyển trang giữ từ khóa tìm kiếm và bộ lọc danh mục.

### Kiểm thử tự động

Chạy toàn bộ các bộ kiểm thử từ thư mục gốc dự án:

```bash
node --test tests/*.test.js
```

Kết quả kiểm tra mã hiện tại (16/10/2026): **153 test Node đạt, 0 thất bại**; thêm **8 test Python** bằng `python3 tests/log-targets.test.py`. Các ca database dùng fixture, không thay thế nghiệm thu MySQL thật.

Các bộ kiểm thử kiểm tra validation, middleware giới hạn đăng nhập,
xử lý ảnh và lưu tệp trong thư mục tạm. Chúng không thay thế
kiểm thử nghiệp vụ với database và kiểm thử trên trình duyệt.

Kiểm tra dependency:

```bash
npm audit
```

Kết quả lần kiểm tra gần nhất: không có lỗ hổng được npm audit báo cáo.

### Quản lý người dùng (ADMIN)

Các tuyến chức năng:

| Phương thức | Địa chỉ | Chức năng |
| --- | --- | --- |
| GET | `/admin/users` | Danh sách người dùng |
| GET | `/admin/users/new` | Biểu mẫu tạo tài khoản |
| POST | `/admin/users` | Tạo tài khoản |
| GET | `/admin/users/:id/edit` | Biểu mẫu sửa thông tin |
| POST | `/admin/users/:id/update` | Sửa tên, email và vai trò |
| POST | `/admin/users/:id/lock` | Khóa tài khoản |
| POST | `/admin/users/:id/unlock` | Mở khóa tài khoản |

Toàn bộ tuyến yêu cầu đăng nhập với vai trò ADMIN.
Các thao tác POST yêu cầu CSRF token.

Tài khoản mới có trạng thái ACTIVE; mật khẩu được băm bằng Argon2id.
Biểu mẫu lỗi không điền lại mật khẩu.
Danh sách và trang sửa không lấy hoặc hiển thị hash mật khẩu.

Khóa tài khoản giữ lại người dùng và bài viết.
Khóa tài khoản tăng `session_version`. Phiên cũ bị từ chối ở yêu cầu tiếp theo, kể cả ADMIN đã mở khóa trước yêu cầu đó. Đổi email/vai trò qua ADMIN cũng thu hồi phiên cũ. Middleware và transaction ghi kiểm tra phiên bản phiên.

Các thao tác sửa vai trò và trạng thái sử dụng transaction,
khóa hàng bằng SELECT ... FOR UPDATE và kiểm tra lại quyền
của ADMIN thực hiện thao tác.

Đã kiểm chứng:

- Tạo tài khoản, lưu tên tiếng Việt và hash Argon2id.
- Từ chối email trùng khi tạo và sửa với HTTP 409.
- Sửa thông tin và lưu không đổi nội dung thành công.
- Khóa, hủy xác nhận khóa, mở khóa và đăng nhập lại.
- Vai trò được đọc lại từ database; bản sửa thu hồi phiên khi ADMIN đổi vai trò cần nghiệm thu đăng nhập lại trên máy sinh viên.
- Chặn tự hạ quyền và tự khóa với HTTP 409.
- ID sai định dạng trả HTTP 400; ID không tồn tại trả HTTP 404.
- AUTHOR bị chặn truy cập và gửi thao tác quản trị với HTTP 403.
- Các POST thiếu CSRF bị chặn với HTTP 403.
- Trong một lần kiểm thử hai ADMIN tạm đồng thời khóa nhau,
  chỉ một thao tác thành công; thao tác còn lại bị từ chối
  sau khi kiểm tra lại quyền. Các tài khoản tạm đã được dọn.

Có quy tắc giữ ít nhất một ADMIN hoạt động trong service.
Chưa kiểm chứng riêng từng nhánh của quy tắc ADMIN cuối cùng.

Chưa hỗ trợ xóa người dùng; tài khoản có biểu mẫu tự đổi mật khẩu qua giao diện.

## Hướng dẫn chạy

### Chạy ứng dụng bằng Docker Compose

Cần có `.env` theo `.env.example`, với mật khẩu và SESSION_SECRET thật.
Không đưa `.env` vào Git hoặc image.

Ảnh được lưu bằng bind mount từ `./uploads` vào `/app/uploads`.
Chuẩn bị thư mục nếu chưa có:

```bash
mkdir -p uploads/covers
```

Container app chạy UID/GID 1000. Thư mục ảnh phải cho tài khoản này
đọc và ghi. Môi trường WSL đã kiểm chứng có UID/GID 1000.

Kiểm tra cấu hình:

```bash
docker compose config --quiet
```

Build image:

```bash
docker build -t blog-cms-app:local .
```

Môi trường hiện tại sử dụng legacy builder, chưa có Buildx.
Lệnh build trên đã được kiểm chứng.

Nếu Express đang chạy trực tiếp trong WSL, dừng bằng Ctrl + C
trước khi khởi động container vì cùng sử dụng cổng host 18090.

Khởi động các dịch vụ bằng image đã build:

```bash
docker compose up -d --no-build --wait --wait-timeout 240
```

Truy cập website: http://localhost:18090
Truy cập phpMyAdmin: http://localhost:18091

Trong container, app kết nối MySQL tại `mysql:3306`.
Khi chạy trực tiếp trong WSL, app dùng `127.0.0.1:13319`.

Xem trạng thái và log:

```bash
docker compose ps
docker compose logs --tail=30 app
```

Sau khi sửa mã ứng dụng, build lại image và cập nhật container:

```bash
docker build -t blog-cms-app:local .
docker compose up -d --no-build --no-deps --wait --wait-timeout 240 app
```

Đã kiểm chứng:

- App chạy trong Compose, liveness/readiness trả HTTP 200.
- Argon2 và Sharp hoạt động trong runtime image.
- Trang công khai, trang sửa bài và ảnh hiện có hoạt động.
- Tải/thay ảnh được khi filesystem chính chỉ đọc.
- Tên ảnh và SHA256 không đổi sau khi tạo lại container app.
- App chạy non-root, UID 1000.
- Root filesystem chỉ đọc; drop toàn bộ capability.
- no-new-privileges có hiệu lực.
- SIGTERM đóng tài nguyên và ứng dụng thoát với mã 0.

MySQL dùng named volume; ảnh dùng bind mount.
Dữ liệu được lưu ngoài container nhưng vẫn cần sao lưu riêng.

Base image hiện dùng tag `node:24-bookworm` và
`node:24-bookworm-slim`. Bản đã build được kiểm chứng chạy
Node.js 24.21.0; các tag này có thể thay đổi theo thời gian.

### Nginx reverse proxy

Website: http://localhost:18090

Nginx tiếp nhận cổng host 18090 và chuyển tiếp tới app:3000.
App không công bố cổng ra host.

Mạng triển khai:

- proxy: Nginx và app, subnet 172.26.0.0/24.
- database: app, MySQL và phpMyAdmin.
- Nginx có IP cố định 172.26.0.10.
- App chỉ tin IP này qua cấu hình TRUSTED_PROXY_IP.
- Chạy trực tiếp trong WSL: để TRUSTED_PROXY_IP trống.

Cấu hình Nginx: infra/nginx/default.conf.

Nginx ghi đè X-Forwarded-For bằng địa chỉ kết nối thực
và đặt X-Forwarded-Host, X-Forwarded-Proto.
Ứng dụng không tự lấy IP từ header do khách gửi.

Security headers:

- X-Content-Type-Options: nosniff.
- X-Frame-Options: DENY.
- Referrer-Policy: strict-origin-when-cross-origin.
- Permissions-Policy: camera=(), microphone=(), geolocation=().

Headers áp dụng cả với phản hồi lỗi.
Nginx nhận request body tối đa 6 MiB; ứng dụng vẫn giới hạn
tệp ảnh tối đa 5 MiB.

Kiểm tra cú pháp cấu hình:

```bash
docker compose exec nginx nginx -t
```

Sau khi sửa cấu hình và kiểm tra thành công, reload:

```bash
docker compose exec nginx nginx -s reload
```

Xem trạng thái và log:

```bash
docker compose ps
docker compose logs --tail=30 nginx
```

Đã kiểm chứng:

- Nginx và app healthy; trang chủ cùng ảnh hoạt động qua proxy.
- Readiness trả HTTP 200, đường dẫn không tồn tại trả HTTP 404.
- Cả phản hồi 200 và 404 có đủ bốn security headers.
- App chỉ tin IP Nginx và không có port binding ra host.
- 10 POST đăng nhập thiếu CSRF trả 403; lượt thứ 11 trả 429.
- Đổi X-Forwarded-For giả không vượt được giới hạn đăng nhập.
- Phản hồi 429 có Retry-After, Cache-Control: no-store
  và các security headers.
- GET /login và hai endpoint health vẫn trả HTTP 200.
- Đăng nhập lại qua Nginx thành công; tải lại trang vẫn giữ phiên.
- Tải/thay ảnh qua Nginx thành công; ảnh hiển thị trên trang sửa, trang chủ và trang chi tiết.

Phiên bản Nginx đã chạy và kiểm chứng: 1.30.5.
Compose hiện dùng tag nginx:stable-alpine; tag có thể thay đổi.

Hiện sử dụng HTTP với security headers, chưa cấu hình HTTPS.
Security headers không mã hóa đường truyền.

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

Database core gồm `users`, `categories`, `posts`; migration 003/004 bổ sung tài khoản và cộng đồng.

Sau khi MySQL healthy, chạy tệp SQL một lần trên database
chưa có các bảng này:

```bash
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql --protocol=TCP --host=127.0.0.1 --user="$MYSQL_USER" --database="$MYSQL_DATABASE" --default-character-set=utf8mb4' < db/migrations/001_create_core_tables.sql
```

Với cài mới, phải chạy lần lượt **001 → 002 → 003 → 004 → 005 → 006**, rồi mới chạy app/scripts tạo tài khoản. Xem [hướng dẫn cài mới](docs/cai-moi.md). Với database đang có, không chạy lại migration đã áp dụng; các hướng dẫn cập nhật mô tả từng mốc riêng.

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
- Mật khẩu có từ 8–128 và đủ 4 nhóm, được nhập ẩn trên terminal.
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
- Compose cấu hình app chỉ tin proxy IPv4 `172.26.0.10`. Nginx ghi đè `X-Forwarded-For` bằng địa chỉ kết nối; không dùng `trust proxy = true`. Khi chạy trực tiếp trong WSL, để `TRUSTED_PROXY_IP` trống.

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

### Ảnh đại diện bài viết

Tải ảnh tại trang sửa bài, bằng biểu mẫu riêng với nội dung bài viết.

- Nhận một ảnh JPEG, PNG hoặc WebP, tối đa 5 MiB.
- Kiểm tra định dạng thực bằng Sharp; không chỉ dựa vào tên tệp
  hoặc MIME do trình duyệt gửi.
- Giới hạn đầu vào 20 triệu pixel; từ chối ảnh động/nhiều trang.
- Chuyển sang WebP, giữ tỷ lệ và thu nhỏ trong khung 1600 × 1600.
- Lưu tại uploads/covers với tên UUID; database lưu tên trong cover_path.
- Không đưa tệp uploads vào Git.
- Ảnh được trả qua GET /media/posts/:id/cover, không mở uploads
  bằng express.static.
- Khách xem được ảnh bài đã xuất bản.
- Với bài nháp, route yêu cầu ADMIN hoặc tác giả đang hoạt động.
- Upload và gỡ ảnh yêu cầu đăng nhập, quyền trên bài và CSRF.
- Thay, gỡ ảnh và xóa bài sử dụng transaction, khóa hàng bài viết.
- Dọn ảnh cũ sau khi database commit.

Đã kiểm chứng:

- Tải ảnh, chuyển thành WebP và hiển thị trên trang sửa.
- Thay ảnh cập nhật tên mới và xóa tệp cũ.
- Gỡ ảnh đặt cover_path thành NULL và xóa tệp.
- Xóa bài thử có ảnh đồng thời dọn tệp ảnh.
- Khách nhận ảnh khi bài xuất bản, bị từ chối khi bài về nháp.
- AUTHOR khác bị chặn thay/gỡ ảnh của người khác.
- Upload thiếu CSRF trả 403; dữ liệu giả ảnh hoặc thiếu tệp trả 422.
- Tệp vượt 5 MiB trả 413; gỡ ảnh thiếu CSRF trả 403.
- Hiển thị ảnh trên trang chủ và trang chi tiết công khai.

Database và filesystem không dùng chung transaction.
Nếu dọn tệp cũ thất bại, thao tác database đã commit vẫn được giữ; ứng dụng ghi log và báo cần dọn tệp còn sót.
Nếu kết quả commit không chắc chắn, giữ tệp mới để tránh xóa ảnh có thể đang được database tham chiếu.

Chưa có công cụ tự động đối soát tệp còn sót.
Chưa kiểm thử riêng ảnh động/nhiều trang, hướng EXIF
hoặc các tình huống lỗi ghi tệp và commit không chắc chắn.

### Giám sát hệ thống

Các thành phần:

- Prometheus v3.15.0: thu thập metrics mỗi 15 giây.
- Nginx exporter: image tag 1.5.1.
- MySQL exporter v0.20.0: sử dụng tài khoản giám sát riêng.
- cAdvisor v0.60.6: thu thập CPU và RAM container.
- Grafana OSS 13.2.3: hiển thị dashboard.

Địa chỉ:

- Prometheus: http://localhost:19090
- Grafana: http://localhost:13000
- Dashboard: http://localhost:13000/d/blog-cms-overview

Prometheus lưu dữ liệu trong volume prometheus_data.
Cấu hình retention là 7 ngày hoặc ngưỡng kích thước 1GB;
đây không phải giới hạn cứng cho toàn bộ dung lượng volume.

Grafana lưu dữ liệu trong volume grafana_data.
Datasource và dashboard được provision từ infra/grafana.

Thông tin đăng nhập riêng được lưu trong secrets/,
không đưa vào Git hoặc Docker build context.
Mật khẩu Grafana trong tệp được dùng khi khởi tạo quản trị;
sửa tệp không tự thay đổi mật khẩu đã lưu trong database Grafana.

Tài khoản blog_exporter có PROCESS, REPLICATION CLIENT,
SELECT trên toàn server và tối đa 3 kết nối.
Tài khoản này chỉ dành cho giám sát, không dùng cho ứng dụng.

Prometheus chỉ lưu metrics cAdvisor có nhãn Compose
project bằng blog-cms. cAdvisor vẫn quan sát container
trên host, cần quyền privileged và các mount host;
không tính cAdvisor là minh chứng hardening của ứng dụng.

Đã kiểm chứng:

- Bốn job prometheus, nginx, mysql, cadvisor đều up = 1.
- nginx_up và mysql_up đều bằng 1.
- CPU và RAM có dữ liệu của các service Blog CMS.
- Grafana healthy, API health trả HTTP 200.
- Dashboard gồm 8 panel có dữ liệu.
- Tạo 30 yêu cầu website và quan sát tốc độ yêu cầu Nginx tăng.

CPU 100% tương ứng một lõi CPU.
RAM sử dụng chỉ số working set.
Các bộ đếm Nginx và MySQL bao gồm lưu lượng giám sát.

Chưa cấu hình cảnh báo tự động.
## Giao diện và điều hướng

Giao diện responsive dùng CSS nội bộ tại `public/css/site.css`.
Trang chủ có bộ lọc, thẻ bài viết và phân trang; trang chi tiết giữ
nội dung văn bản đã escape. Các trang tài khoản và quản lý dùng chung
header/footer, biểu mẫu và bảng có thể cuộn trên màn hình nhỏ.

Từ trang chủ, bấm **Đăng nhập** rồi dùng menu hoặc các thẻ chức năng
trên trang tài khoản. AUTHOR có mục Bài viết; ADMIN có thêm Danh mục,
Người dùng và Quản trị. Nút **Sửa / ảnh** mở cả chỉnh sửa nội dung và
quản lý ảnh. Nút **Xem bài** chỉ xuất hiện cho bài đã xuất bản.
Đăng xuất nằm trên trang tài khoản, truy cập bằng tên tài khoản trên menu.
Các route vẫn kiểm tra quyền trên server và CSRF cho thao tác POST.

Express chỉ phục vụ `/css` và `/js` trước session. Ảnh bài viết tiếp tục
được trả qua `/media/posts/:id/cover` có kiểm tra quyền.
Không có CDN; phần email bổ sung Nodemailer 10.1.0, được khóa phiên bản.

Kiểm tra tự động tất cả các bộ test bằng `node --test tests/*.test.js`.
Hướng dẫn cập nhật Docker và kiểm tra thao tác bằng nút/menu:
[Kiểm tra giao diện](docs/kiem-thu-giao-dien.md).

## Tài khoản độc giả và cộng đồng

- Đăng ký READER, xác minh email, quên/đặt lại mật khẩu bằng liên kết một lần.
- Hồ sơ sửa tên/email; đổi email yêu cầu mật khẩu và xác minh lại.
- Đổi/reset mật khẩu tăng session_version để vô hiệu hóa phiên cũ.
- Có thể trả lời bình luận hoặc bất kỳ câu trả lời nào; mỗi câu lưu đích trả lời và gom trong cùng cuộc trao đổi. Độc giả và AUTHOR trên bài người khác gửi/sửa thành PENDING. ADMIN và AUTHOR trên bài của mình được hiển thị ngay; nội dung không đổi không gửi lại thông báo.
- ADMIN duyệt/ẩn/xóa; công khai chỉ APPROVED trên bài PUBLISHED, phân trang 10 bình luận gốc hoặc 10 câu trả lời/trang.
- Thông báo phân biệt sự kiện đã xảy ra và trạng thái bình luận hiện tại; mở qua nút có CSRF để đánh dấu đã đọc; việc duyệt cập nhật đã đọc cho các thông báo kiểm duyệt liên quan.
- Theo dõi danh mục, nhận thông báo trong website; đánh dấu đã đọc/tất cả.
- Quản lý có tìm kiếm, bộ lọc, sắp xếp và phân trang.
- Nhật ký ADMIN; lịch sử nội dung bài chỉ để xem và kiểm tra quyền theo bài.
- Các thao tác ghi nhật ký dùng cùng transaction với thay đổi nghiệp vụ.

Bộ test hiện tại: 153 Node + 8 Python đạt; npm audit tại đợt rà soát 16/10 báo 0 lỗ hổng.
Database migrations 003–005 đã được sinh viên cung cấp kết quả chạy thành công; Google đăng nhập và log pipeline đã xác nhận trên WSL ở các mốc trước. SMTP/email thật vẫn cần nghiệm thu riêng. Bản trả lời tiếp cần chạy 006 và kiểm tra trên MySQL/giao diện thật; không suy ra chỉ từ test fixture.
Kết quả Chromium với fixture ở mốc giao diện trước đây không thay thế kiểm tra UI bản sửa hiện tại hoặc CRUD trên MySQL thật.
Hướng dẫn thao tác và trạng thái từng phần: [Cập nhật cộng đồng](docs/cap-nhat-cong-dong.md).

## Cấu hình và dữ liệu

Không đưa mật khẩu, file môi trường thật, khóa riêng, log runtime hoặc dữ liệu database vào repository.


### Commit 3 — Log tập trung Loki + Promtail

Xem [hướng dẫn đầy đủ](docs/log-tap-trung.md): chọn nguồn log đúng Compose,
kiểm tra cấu hình, chạy Loki/Promtail, mở Grafana và demo ba query LogQL.

- Loki: localhost:13100 → container 3100, retention 7 ngày, volume riêng.
- Promtail: đọc log app/nginx/mysql/phpmyadmin qua mount chỉ đọc, không Docker socket.
- Grafana datasource `Blog CMS Loki`, dashboard UID `blog-cms-logs`.
- Chạy `python3 scripts/prepare-log-targets.py` trước khi bật Promtail và sau
  mỗi lần recreate nguồn log; targets runtime không commit.
- Chạy `python3 scripts/verify-central-logs.py` để xác nhận request 404 vừa
  tạo và ba query có kết quả thật; không báo hoàn tất nếu script FAIL.
- Promtail EOL; dùng cho yêu cầu môn học local, chuyển Alloy khi vận hành dài hạn.
- Đã kiểm tra độc lập bằng native binaries và log fixture, 8 test chọn nguồn
  log đạt. Sinh viên đã cung cấp kết quả request 404 qua Nginx→Promtail→Loki và ba query có dữ liệu trên máy thật. Ảnh dashboard/Explore vẫn cần lưu cho báo cáo.
- Promtail root để đọc log và cAdvisor privileged là ngoại lệ hardening; không
  tuyên bố mọi dịch vụ đều non-root hoặc cách ly tuyệt đối.

