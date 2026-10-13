# Cập nhật điều hướng, bình luận và đăng nhập Google

Thực hiện trên nhánh `codex/cms-ui-navigation`. Bản này giữ chính sách mật khẩu
8–128 ký tự, đủ chữ hoa A–Z, chữ thường a–z, số và ký tự đặc biệt.

## Chức năng đã bổ sung

- Mũi tên quay lại giữ bộ lọc và số trang; cảnh báo khi rời biểu mẫu chưa lưu.
- Bản nháp nội dung bài được giữ trong sessionStorage của tab, có khôi phục/xóa;
  không lưu mật khẩu. Bản nháp bị xóa khi đổi người đăng nhập trong tab.
- Thông báo có xem/ẩn nội dung, thu gọn, ẩn/khôi phục và liên kết bình luận.
  Thông báo mới lưu ID bình luận; thông báo cũ chưa có ID chỉ mở danh sách.
- ADMIN và AUTHOR bình luận trên bài của mình được duyệt ngay. READER và
  AUTHOR trên bài người khác vẫn chờ duyệt, kể cả khi sửa bình luận.
- Trả lời một cấp, 10 bình luận gốc/trang; xem trước 5 trả lời và mở trang
  trả lời riêng (10/trang). Xóa bình luận có trả lời giữ vị trí với nội dung trống.
- Đổi mật khẩu có liên kết Quên mật khẩu; tài khoản chỉ dùng Google được
  hướng dẫn tạo mật khẩu qua email trước khi gỡ kết nối Google.
- Đăng ký chọn Độc giả hoặc Muốn làm tác giả. Tài khoản luôn bắt đầu READER;
  xác minh email rồi ADMIN mới có thể duyệt yêu cầu AUTHOR.
- Đăng nhập Google; liên kết tài khoản hiện có cần xác nhận mật khẩu hiện tại,
  không tự gộp tài khoản chỉ vì cùng email. Không gỡ phương thức đăng nhập cuối cùng.
- Trang chặn đăng nhập có đếm thời gian chờ; thông báo thao tác thành công;
  giữ nội dung bình luận/yêu cầu tác giả khi dữ liệu không hợp lệ.

## 1. Lấy code — Terminal Ubuntu/WSL

Chạy từ thư mục dự án, không chạy trong DevTools hoặc PowerShell:

```bash
cd ~/projects/blog-cms
git status --short
git fetch origin
git switch codex/cms-ui-navigation
git pull --ff-only origin codex/cms-ui-navigation
nvm use
npm ci
node --test tests/*.test.js
npm audit
git diff --check
```

Nếu `git status --short` có thay đổi riêng, lưu/commit chúng trước khi pull;
không dùng reset để bỏ thay đổi. Hiện đã kiểm tra 129 test đạt, 0 thất bại.

## 2. Sao lưu và chạy migration 005 — Terminal WSL

Bạn đã chạy 003 và 004. **Không chạy lại hai migration đó.** Migration 005
chạy đúng một lần; cần dừng app trước khi thay đổi schema.

```bash
(
  set -e
  cd ~/projects/blog-cms
  umask 077
  mkdir -p backups
  docker compose stop app
  backup_file="backups/before-interactions-$(date -u +%Y%m%dT%H%M%SZ).sql"
  docker compose exec -T mysql sh -c '
    MYSQL_PWD="$MYSQL_PASSWORD" exec mysqldump \
      --protocol=TCP --host=127.0.0.1 --user="$MYSQL_USER" \
      --single-transaction --no-tablespaces --databases "$MYSQL_DATABASE"
  ' > "$backup_file"
  test -s "$backup_file"
  stat -c 'Quyền=%a | Dung lượng=%s byte | Tệp=%n' "$backup_file"
  docker compose exec -T mysql sh -c '
    MYSQL_PWD="$MYSQL_PASSWORD" exec mysql \
      --protocol=TCP --host=127.0.0.1 --user="$MYSQL_USER" \
      --database="$MYSQL_DATABASE" --default-character-set=utf8mb4
  ' < db/migrations/005_navigation_replies_google.sql
  printf 'Đã chạy migration 005.\n'
)
```

Nếu SQL báo lỗi, giữ app dừng và gửi lỗi để kiểm tra; không chạy lại toàn bộ
migration vì DDL MySQL có thể đã áp dụng một phần.

Kiểm tra schema:

```bash
docker compose exec -T mysql sh -c '
  MYSQL_PWD="$MYSQL_PASSWORD" exec mysql \
    --protocol=TCP --host=127.0.0.1 --user="$MYSQL_USER" \
    --database="$MYSQL_DATABASE" --execute="
      SHOW COLUMNS FROM comments;
      SHOW COLUMNS FROM notifications;
      SHOW COLUMNS FROM users LIKE '\''password_hash'\'';
      SHOW TABLES;
    "
'
```

Cần thấy `comments.parent_id`, `comments.is_deleted`, `notifications.hidden_at`,
`notifications.comment_id`, `password_hash` cho phép NULL và các bảng
`author_requests`, `user_identities`, `google_challenges`.

## 3. Cấu hình Google — trình duyệt và tệp .env

Mở [Google Cloud Clients](https://console.cloud.google.com/auth/clients).
Chọn/tạo project, cấu hình Branding/Audience theo Google, tạo OAuth client
loại **Web application**. Trong Authorized JavaScript origins thêm:

- `http://localhost`
- `http://localhost:18090`

Code dùng Google Identity Services với callback JavaScript, không dùng redirect
URI. Chỉ yêu cầu danh tính cơ bản, không yêu cầu quyền Gmail/Drive.

Mở tệp `~/projects/blog-cms/.env` trong trình soạn thảo và thêm:

```dotenv
GOOGLE_CLIENT_ID=CLIENT_ID_CUA_BAN.apps.googleusercontent.com
```

Thay bằng Client ID thực. Luồng này không cần Client Secret. Không commit `.env`.
Nếu chưa cấu hình, chức năng khác vẫn dùng được; trang Google báo chưa cấu hình.
Nếu truy cập bằng tên miền/IP khác, thêm origin tương ứng. Khi triển khai công
khai phải dùng HTTPS và cấu hình origin của website thực.

Tài liệu chính thức:
[Thiết lập client](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid),
[xác minh ID token](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## 4. Build và khởi động — Terminal WSL

Chỉ làm sau khi migration 005 hoàn tất:

```bash
(
  set -e
  cd ~/projects/blog-cms
  docker compose config --quiet
  docker build -t blog-cms-app:local .
  docker compose up -d --no-build --no-deps --force-recreate \
    --wait --wait-timeout 240 app
  docker compose exec -T nginx nginx -s reload
  curl --max-time 10 -fsS http://127.0.0.1:18090/health/ready
)
```

Health readiness chỉ chứng minh kết nối database, không thay thế kiểm tra schema
và nghiệp vụ. App vẫn dùng database/ảnh hiện có; không cần `down -v`.

## 5. Kiểm tra bằng giao diện

Mở [website](http://localhost:18090/); các chức năng có menu/nút từ giao diện.

1. Đăng nhập rồi mở bài, tìm/lọc/phân trang, chuyển sang một thao tác, bấm mũi
   tên quay lại: đúng trang trước và giữ query. Nhập nội dung chưa lưu rồi quay
   lại: có xác nhận. Khôi phục/xóa bản nháp ở trang sửa bài.
2. READER đã xác minh gửi bình luận và trả lời: chờ duyệt. ADMIN duyệt rồi
   mở thông báo của người gửi: Xem nội dung → Ẩn nội dung/Thu gọn; Đến bình luận
   phải mở đúng bài và vị trí. Thử ẩn/khôi phục thông báo.
3. ADMIN bình luận và AUTHOR bình luận trên bài mình: xuất hiện ngay. AUTHOR
   bình luận bài người khác: chờ duyệt. Người khác không sửa/xóa bình luận của bạn.
4. Tạo đủ 11 bình luận gốc và 11 trả lời bằng tài khoản thử để kiểm tra phân
   trang; xóa gốc có trả lời phải giữ trả lời và vị trí gốc đã xóa.
5. Đăng ký với lựa chọn Muốn làm tác giả, xác minh email; từ menu ADMIN mở
   Duyệt tác giả. Trước duyệt vẫn READER; sau duyệt mới có quản lý bài.
6. Từ Đổi mật khẩu bấm Quên mật khẩu. Kiểm tra email SMTP thực và token một lần.
7. Từ Đăng nhập bấm Google. Tài khoản Google mới là READER; tài khoản khóa không
   được đăng nhập. Email đã có tài khoản phải đăng nhập bằng mật khẩu và vào
   Tài khoản → Google để liên kết, không tự gộp.
8. Tài khoản chỉ Google: thử gỡ kết nối phải bị chặn; dùng Quên mật khẩu tạo
   mật khẩu qua email rồi mới gỡ. Tài khoản có hai phương thức: gỡ cần xác nhận
   mật khẩu, sau đó đăng nhập lại bằng mật khẩu.
9. Thử token/CSRF sai bằng tài khoản thử phải bị từ chối. Không gửi mật khẩu,
   token hoặc nội dung `.env` trong ảnh/log khi báo lỗi.

## Kiểm chứng và giới hạn

- Đã chạy 129 test: gồm quyền bình luận/trả lời, thông báo, xét AUTHOR, phiên,
  CSRF, Google nonce/audience/issuer/expiry và chữ ký RSA bằng khóa thử.
- Đã kiểm tra 37 trạng thái trang, mỗi trạng thái ở 1440px và 390px (74 lượt),
  không tràn ngang hoặc lỗi JavaScript; thử tương tác quay lại, bản nháp,
  hiện mật khẩu và thu gọn nội dung. SDK Google bị chặn trong fixture này.
- Chưa chạy migration 005 trên MySQL thật của bạn; chưa thử Google provider,
  SMTP thật hoặc bản cập nhật qua Nginx của bạn. Test SQL dùng dependency giả.
- Token Google được xác minh phía server, nonce gắn phiên và dùng một lần;
  không lưu credential thô. Bảng challenge chưa có tác vụ dọn định kỳ.
- Đăng nhập mật khẩu: 10 lần/15 phút/IP. Luồng Google có giới hạn riêng
  10 yêu cầu/15 phút/IP, tính cả mở trang và gửi callback. Bình luận: 5 lần/phút/IP.
- Trả lời chỉ một cấp; không tự suy đoán ID cho thông báo cũ. Chưa thêm Loki,
  thích bài, push trình duyệt hoặc đăng nhập Google cho Grafana.
