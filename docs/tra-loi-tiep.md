# Trả lời tiếp trong cuộc trao đổi

## Hành vi

- Có nút Trả lời ở từng bình luận gốc và từng câu trả lời đã hiển thị, cả tại bài
  viết và trang cuộc trao đổi. Không giới hạn việc B trả lời A, C trả lời B, A lại
  trả lời C. Các câu được nhóm trong cùng cuộc trao đổi để không thụt sâu vô hạn.
- Mỗi câu ghi rõ “Đang trả lời [tên]”. Bấm tên sẽ mở đúng bình luận được trả lời,
  kể cả nằm ở trang khác. Đích ẩn/xóa không bị lộ tên/nội dung qua nhãn này.
- Thông báo nội dung mới gửi đến người thực sự được trả lời và tác giả bài,
  loại người gửi và loại trùng người nhận. Bình luận cần duyệt chỉ báo cho người
  được trả lời sau khi ADMIN duyệt; không báo nhầm cho chủ bình luận gốc.
- Chính sách duyệt/quyền/xác minh email hiện có vẫn giữ. Không gửi trả lời vào
  đích chờ duyệt, đã ẩn/xóa, khác bài hoặc cuộc trao đổi có gốc đã ẩn/xóa.
- Xóa câu trả lời đã có người trả lời tiếp giữ bản đánh dấu đã xóa để không đứt
  cuộc trao đổi; nội dung cũ không được hiển thị. Giao diện gom tất cả câu trả lời
  trong nhóm, 10 câu/trang; xem nhanh 5 câu trên trang bài viết.
- Chưa bổ sung reaction, đính kèm ảnh bình luận, thông báo push hoặc rich-text.

## Dữ liệu

`parent_id` tiếp tục là ID bình luận gốc, giúp giữ phân trang/link cũ.
`reply_to_id` là đích trả lời trực tiếp (có thể là một câu trả lời khác).
Server tính gốc từ đích trong database, không tin root do trình duyệt gửi.
Migration 006 backfill câu trả lời cũ về đích gốc; không xóa nội dung hay đổi
updated_at của bình luận cũ. 001–005 không được sửa hoặc chạy lại.

## Cập nhật máy đang có database — Terminal Ubuntu/WSL

Chạy phần 1 trước. Nếu có thay đổi local, dừng để xử lý thay vì bỏ file.

```bash
(
  set -e
  cd ~/projects/blog-cms
  test -z "$(git status --porcelain)" || { printf 'Có thay đổi local, dừng.\n'; exit 1; }
  git pull --ff-only origin codex/cms-ui-navigation
  nvm use
  npm test
  python3 tests/log-targets.test.py
  git diff --check
)
```

Phần 2 **chỉ chạy khi chưa áp dụng 006**. Có khoảng dừng website trong khi nâng
cấp. Nếu SQL lỗi, dừng và gửi đầu ra, không chạy lại mù quáng hoặc xóa volume.

```bash
(
  set -e
  cd ~/projects/blog-cms
  umask 077
  mkdir -p backups
  docker compose stop app
  backup_file="backups/before-reply-targets-$(date -u +%Y%m%dT%H%M%SZ).sql"
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
  ' < db/migrations/006_reply_targets.sql
  printf 'PASS: Đã sao lưu và chạy migration 006.\n'
)
```

Phần 3 kiểm tra cột và backfill, build/rerun app rồi cập nhật nguồn log:

```bash
(
  set -e
  cd ~/projects/blog-cms
  docker compose exec -T mysql sh -c '
    MYSQL_PWD="$MYSQL_PASSWORD" exec mysql \
      --protocol=TCP --host=127.0.0.1 --user="$MYSQL_USER" \
      --database="$MYSQL_DATABASE" \
      --execute="SHOW COLUMNS FROM comments LIKE '\''reply_to_id'\''; SELECT COUNT(*) AS missing_reply_target FROM comments WHERE parent_id IS NOT NULL AND reply_to_id IS NULL;"
  '
  docker build -t blog-cms-app:local .
  docker compose up -d --no-build --no-deps --force-recreate \
    --wait --wait-timeout 240 app
  docker compose exec -T nginx nginx -s reload
  curl --max-time 10 -fsS -w '\nHTTP %{http_code}\n' \
    http://127.0.0.1:18090/health/ready
  python3 scripts/prepare-log-targets.py
  python3 scripts/verify-central-logs.py
)
```

Ngay sau backfill, `missing_reply_target` mong đợi là 0. Các lần sau giá trị có
thể khác nếu đã xóa dữ liệu bằng công cụ ngoài ứng dụng. Readiness SELECT 1 không
thay thế kiểm tra cột hoặc test giao diện.

## Nghiệm thu

Trên http://localhost:18090/, mở một bài đã xuất bản:

1. READER A gửi bình luận, ADMIN duyệt. B trả lời A, duyệt nếu cần.
2. Ngay dưới câu của B, A bấm Trả lời rồi gửi. Nhãn phải ghi đang trả lời B.
3. B nhận thông báo đúng câu mới sau duyệt, không gửi nhầm chỉ cho chủ bình luận
   gốc. B trả lời tiếp câu mới; có thể tiếp tục nhiều lượt.
4. ADMIN/AUTHOR trên bài của mình được hiển thị ngay; READER vẫn chờ duyệt.
5. Tạo hơn 10 câu trong nhóm, mở thông báo/nhãn người nhận: đúng trang và anchor.
6. Xóa một câu ở giữa đã có người trả lời: câu sau vẫn tồn tại, đích không còn
   khả dụng không lộ nội dung; không thể gửi thêm vào câu đã xóa/ẩn.

Đã chạy 153 Node test và 8 Python test tại môi trường kiểm tra. Ca mới bao gồm
chuỗi 40 lượt trả lời, thông báo đích chính xác sau duyệt, khác bài/ẩn/xóa,
tombstone và nút trả lời/escape trên cả hai trang. Database dùng fixture;
**chưa chạy migration 006 hoặc luồng này trên MySQL/trình duyệt thật của sinh viên**.
