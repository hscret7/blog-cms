> Bổ sung hiện tại: xem [hướng dẫn tương tác và Google](cap-nhat-tuong-tac-google.md), gồm migration 005, trả lời một cấp, duyệt yêu cầu AUTHOR và danh tính Google. Nội dung bên dưới mô tả mốc trước đó.

# Cập nhật tài khoản độc giả và chức năng cộng đồng

## Tiến độ

Mã nguồn đã bổ sung READER, đăng ký/xác minh email, khôi phục mật khẩu,
bình luận, thông báo, tìm kiếm/sắp xếp, nhật ký và lịch sử nội dung.
Nhánh làm việc: `codex/cms-ui-navigation`, PR #1.
Không tự merge vào main hoặc chạy migration trên máy WSL.

Kiểm thử độc lập: 99 test đạt; kiểm tra cú pháp 71 tệp JS;
Chromium render 30 trang ở 1440px/390px (60 lượt), không tràn viewport,
không lỗi JS; hiện/ẩn mật khẩu và chuyển token fragment vào POST hoạt động.
Các test nghiệp vụ mới dùng database giả lập, không chứng minh transaction
hoặc SQL chạy đúng trên MySQL thực. SMTP được giả lập khi kiểm thử thư.
Chưa chạy migration, Docker/Nginx với mã mới, gửi/nhận email thật, hoặc
kiểm tra font trên Windows. Cần hoàn tất danh sách tích hợp bên dưới.

## 1. Lấy mã mới — Terminal Ubuntu/WSL

Mở Terminal Ubuntu, tại dự án `~/projects/blog-cms`. Chạy nguyên khối:

```bash
cd ~/projects/blog-cms
git status --short
git fetch origin
git switch codex/cms-ui-navigation
git pull --ff-only origin codex/cms-ui-navigation
nvm use
npm ci
node --test tests/*.test.js
git diff --check
```

Nếu `git status --short` có sửa đổi của bạn, giữ chúng và xử lý trước khi
switch/pull; không dùng reset hoặc lệnh ghi đè. Không build/chạy app mới
trước khi hoàn thành hai migration sau.

## 2. Sao lưu trước migration — cũng tại Terminal WSL

Dừng app để tránh ghi dữ liệu trong lúc nâng cấp. MySQL vẫn chạy.
Khối dưới dừng nếu sao lưu thất bại:

```bash
(
  set -e
  cd ~/projects/blog-cms
  umask 077
  mkdir -p backups
  docker compose stop app
  backup_file="backups/before-community-$(date -u +%Y%m%dT%H%M%SZ).sql"
  docker compose exec -T mysql sh -c '
    MYSQL_PWD="$MYSQL_PASSWORD" exec mysqldump \
      --protocol=TCP --host=127.0.0.1 \
      --user="$MYSQL_USER" --single-transaction --no-tablespaces \
      --databases "$MYSQL_DATABASE"
  ' > "$backup_file"
  test -s "$backup_file"
  printf 'Đã lưu bản sao lưu: %s\n' "$backup_file"
)
```

File sao lưu chứa dữ liệu riêng, hash mật khẩu và phiên; không gửi hoặc commit.
Thư mục backups đã nằm trong .gitignore. Ảnh ở uploads không bị migration sửa.

## 3. Nâng cấu trúc dữ liệu — Terminal WSL

Chỉ chạy **mỗi tệp một lần**, theo thứ tự 003 rồi 004, trên database core
đã tồn tại. Session table vẫn do cấu hình session hiện có quản lý.
MySQL DDL không rollback nguyên khối. Nếu có lỗi, giữ app dừng, ghi lại lỗi
và kiểm tra phần đã áp dụng; không chạy lại cả tệp hoặc restore mù quáng.

```bash
(
  set -e
  cd ~/projects/blog-cms
  docker compose exec -T mysql sh -c '
    MYSQL_PWD="$MYSQL_PASSWORD" exec mysql \
      --protocol=TCP --host=127.0.0.1 --user="$MYSQL_USER" \
      --database="$MYSQL_DATABASE" --default-character-set=utf8mb4
  ' < db/migrations/003_reader_accounts.sql

  docker compose exec -T mysql sh -c '
    MYSQL_PWD="$MYSQL_PASSWORD" exec mysql \
      --protocol=TCP --host=127.0.0.1 --user="$MYSQL_USER" \
      --database="$MYSQL_DATABASE" --default-character-set=utf8mb4
  ' < db/migrations/004_community.sql
)
```

003 thêm READER, email_verified_at, session_version và account_tokens.
Các tài khoản cũ được coi là đã xác minh vì đã được quản trị viên/CLI cấp.
004 thêm comments, category_follows, notifications, audit_events và
post_versions; lưu bản nội dung ban đầu cho các bài đã có.
Không xóa users, posts, categories hoặc dữ liệu ảnh cũ.

## 4. Cấu hình email — sửa tệp .env trong trình soạn thảo

Mở **`~/projects/blog-cms/.env`**, thêm các khóa dưới đây với thông tin
SMTP của bạn; đây là cấu hình, không phải lệnh Terminal:

```dotenv
PUBLIC_BASE_URL=http://localhost:18090
SMTP_HOST=ten-may-chu-smtp-cua-ban
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tai-khoan-smtp-cua-ban
SMTP_PASSWORD=mat-khau-ung-dung-smtp-cua-ban
SMTP_FROM=dia-chi-gui-thu-cua-ban
```

Dùng thông tin do dịch vụ SMTP cung cấp. Với cổng 465, đặt SMTP_SECURE=true.
Cổng 587 dùng STARTTLS bắt buộc. Mã không tắt kiểm tra chứng chỉ TLS.
Không đưa tệp .env thật hoặc mật khẩu lên GitHub/chat.
PUBLIC_BASE_URL là địa chỉ gốc website, không có path/query. Bản local
cho phép HTTP localhost/127.0.0.1; host công khai phải là HTTPS.

Chưa có SMTP: app vẫn khởi động và các tài khoản cũ vẫn dùng được.
Đăng ký/quên mật khẩu/gửi lại xác minh trả lỗi dịch vụ, không giả vờ gửi thư.
Không thể xác nhận các luồng email đạt nếu chưa nhận được thư thực tế.

## 5. Build và chạy — Terminal WSL

Sau migration và lưu .env:

```bash
cd ~/projects/blog-cms
docker compose config --quiet
docker build -t blog-cms-app:local .
docker compose up -d --no-build --no-deps --wait --wait-timeout 240 app
docker compose exec -T nginx nginx -s reload
docker compose ps app nginx
curl --max-time 10 -fsS http://127.0.0.1:18090/health/ready
```

Dùng config --quiet để không in biến môi trường thật.
Mở **http://localhost:18090/** trên trình duyệt và Ctrl+F5.
Readiness chỉ kiểm tra kết nối bằng SELECT 1, không thay thế kiểm tra schema.

## 6. Thao tác và kiểm tra — hoàn toàn trên giao diện

Điểm bắt đầu duy nhất: http://localhost:18090/.
Các URL ở đây chỉ để nhận diện trang; dùng menu/nút để chuyển trang.

| Vai trò | Luồng thao tác |
| --- | --- |
| Khách | Đọc blog → tìm trong tiêu đề/nội dung → chọn danh mục/thứ tự → Tìm kiếm → Đọc bài. Bấm Đăng ký, Đăng nhập hoặc Quên mật khẩu. |
| READER | Đăng ký → mở email → Xác minh → đăng nhập. Từ tên trên menu mở Tài khoản, sửa tên/email, đổi mật khẩu, bình luận, theo dõi chủ đề, thông báo. Không có quản lý bài viết. |
| AUTHOR | Các thao tác READER, cộng thêm Bài viết → Tạo/Sửa/Ảnh/Xuất bản/Chuyển nháp/Xóa. Bấm Lịch sử để đọc bản nội dung cũ; Bình luận trên bài của tôi để xem. |
| ADMIN | Các thao tác trên, cộng thêm Danh mục, Người dùng, Bình luận (duyệt/ẩn/xóa), Nhật ký và các bộ lọc. |

Kiểm tra theo một đợt, không cần thay đổi SQL thủ công:

1. Trang Đăng nhập: chữ tiếng Việt rõ; Hiện/Ẩn mật khẩu hoạt động.
2. Đăng ký email thật: chỉ thành READER; xác minh qua email; mở lại liên kết
   đã sử dụng phải bị từ chối. Quên mật khẩu → nhận thư → đổi mật khẩu;
   phiên đăng nhập cũ không tiếp tục truy cập trang tài khoản.
3. Tài khoản → Sửa thông tin: đổi tên. Đổi email yêu cầu mật khẩu hiện tại,
   đăng nhập lại bằng email mới, xác minh email mới. Mật khẩu không được điền lại.
4. READER đã xác minh gửi bình luận trên bài xuất bản → trạng thái Chờ duyệt.
   ADMIN thấy thông báo → Bình luận → Duyệt. READER nhận thông báo, bài công
   khai hiển thị bình luận. Sửa bình luận của mình phải quay về Chờ duyệt;
   bình luận đó biến mất khỏi danh sách công khai cho đến khi duyệt lại.
5. Thử 11 bình luận đã duyệt để kiểm tra Trang trước/Trang sau (10/trang),
   thứ tự mới/cũ. AUTHOR khác không sửa/xóa bình luận của người khác.
6. READER theo dõi danh mục → AUTHOR xuất bản bài trong danh mục đó →
   nhận thông báo. Bấm Đánh dấu đã đọc/tất cả; kiểm tra số chưa đọc trên menu.
7. Danh sách quản lý: tìm kiếm, sắp xếp, trạng thái, vai trò, chọn tên tác giả/
   danh mục; bộ lọc giữ khi chuyển trang. READER không vào được quản trị.
8. AUTHOR sửa bài → Lịch sử: có nội dung đã lưu, dữ liệu HTML được escape.
   Không có nút khôi phục. AUTHOR không đọc lịch sử của bài người khác.
9. ADMIN → Nhật ký: lọc người/thao tác/đối tượng/ngày UTC, sắp xếp/phân trang.
   Có login/logout, sửa tài khoản, khóa/mở, bài viết, ảnh và bình luận.
10. Xóa bài thử có bình luận và ảnh: bài/bình luận được xóa trong transaction,
    ảnh được dọn sau commit. Phiên bản và audit vẫn giữ; không mở lịch sử bài
    đã xóa cho AUTHOR. Không xóa danh mục còn bài; theo dõi danh mục được dọn
    khi xóa thành công danh mục rỗng.

Bình luận một cấp, chỉ hiển thị bản đã duyệt trên bài xuất bản.
Thông báo nằm trong website và cập nhật khi tải trang; chưa có push trình
duyệt/email thông báo/realtime. Email chỉ dùng xác minh và khôi phục.
Nhật ký không ghi mật khẩu, raw token, cookie hoặc session.
Bản nội dung lịch sử vẫn là dữ liệu riêng cần bảo vệ trong sao lưu.

## Những phần còn lại của đề tài

Kiểm thử tích hợp MySQL/SMTP/Nginx của đợt này; Loki/collector và truy vấn
LogQL; backup/restore có kiểm chứng; cảnh báo; báo cáo và demo cuối kỳ.
Mã hiện tại không triển khai thích bài, trả lời bình luận nhiều cấp, OAuth,
khôi phục phiên bản, push hoặc công cụ dọn token/nhật ký theo lịch.

Giới hạn chống lạm dụng: thao tác tài khoản 5 lần/15 phút/IP, bình luận
5 lần/phút/IP; POST login giữ 10 lần/15 phút. Khi thử nhiều thao tác cùng
máy, chờ hết cửa sổ nếu nhận 429. Giới hạn dùng bộ nhớ một instance, khởi
động lại app làm mất bộ đếm; chưa hỗ trợ limiter dùng chung nhiều instance.
