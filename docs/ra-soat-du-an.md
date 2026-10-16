# Rà soát dự án trước báo cáo — 16/10/2026

Đợt bổ sung về thông báo/bình luận sau phản hồi của sinh viên: xem
[thong-bao-binh-luan.md](thong-bao-binh-luan.md). Bộ test mới nhất là
**146 Node + 8 Python**, không phải các số lịch sử ở bảng rà soát ban đầu dưới đây.
README đã được sửa những mô tả lỗi thời; phần chưa kiểm chứng hoặc chưa triển khai
thực sự vẫn được giữ. Đây là tài liệu rà soát, chưa phải báo cáo nộp môn.

## Phạm vi và kết luận

Snapshot đầu vào: `ac7b89fff655d2bb086b7e68f58fe321566e4ceb`, nhánh
`codex/cms-ui-navigation`, repository `hscret7/blog-cms`. Đối chiếu yêu cầu chung
và đề tài số 7 trong tài liệu đề thực hành người học cung cấp.

Đã đọc các nhóm mã ứng dụng/config, SQL 001–005, các tuyến giao diện, Dockerfile,
11 service Compose, cấu hình giám sát/log và hướng dẫn triển khai. Không truy cập
`.env`, mật khẩu, database thật hoặc chỉnh container đang chạy của sinh viên.
Đợt này dùng Node 24.19.0 trong môi trường kiểm tra; máy sinh viên dùng 24.21.0.
Không có Docker daemon tại môi trường kiểm tra.

Kết luận: đã có đủ thành phần kỹ thuật của ba mốc triển khai chính; có các lỗi
cần sửa trước khi chốt bản demo, liệt kê bên dưới. Kết quả này không đồng nghĩa
chứng minh không còn lỗi hoặc đã kiểm thử toàn bộ luồng với database/email thật.

## Lỗi được xác nhận và sửa

| Mức | Vấn đề trước sửa | Cách sửa / bằng chứng |
|---|---|---|
| Cao | Request đã qua middleware trước thời điểm reset/thu hồi phiên có thể tiếp tục ghi bài, bình luận, quản trị, ảnh hoặc hồ sơ; transaction kiểm tra trạng thái/vai trò nhưng thiếu `session_version` | So sánh phiên bản actor với user đang khóa ngay trong transaction ở activity, admin-user, post-cover và account service. Bốn regression test chặn thao tác trước khi ghi/commit; thất bại trên snapshot cũ, đạt trên bản sửa |
| Cao | Khóa rồi mở khóa tài khoản trước khi người dùng gửi request tiếp theo có thể làm cookie phiên cũ dùng lại được | Khi chuyển sang LOCKED, tăng session_version. Khi ADMIN đổi email hoặc vai trò cũng tăng phiên bản; mở khóa không đặt phiên bản về giá trị cũ. SQL được rà soát thứ tự SET; cần xác nhận round-trip khóa/mở khóa với MySQL thật theo checklist bên dưới |
| Vừa | `notifications()` nhận q nhưng không dùng để lọc danh sách/tổng số | Thêm LIKE có tham số và escape wildcard. Regression test xác nhận cả count/select chỉ lấy user hiện tại và dùng cùng bộ lọc |
| Thấp | Lọc/sắp xếp tại danh sách thông báo đã ẩn làm mất hidden=1, quay về thông báo thường | Giữ hidden bằng input ẩn; thêm ô tìm kiếm thông báo trên giao diện. Test render xác nhận |
| Vừa | README hướng dẫn cài mới bỏ sót migration 002/005 tại mục khởi tạo; chưa tập hợp đủ bước tạo secret exporter/Grafana | Bổ sung `cai-moi.md`, đầy đủ 001→002→003→004→005, secrets, user giám sát, build, URL, kiểm chứng. Không hướng dẫn chạy lại trên database hiện có |
| Thấp | `npm test` chưa có script | Thêm script gọi bộ Node test hiện có |

Không thay đổi schema/migration, dependency, cấu hình SMTP/OAuth, cổng, volume,
dữ liệu hoặc quy tắc mật khẩu 8–128 ký tự/bốn nhóm.

## Kiểm tra đã thực hiện

| Kiểm tra | Kết quả và giới hạn |
|---|---|
| Bộ Node test trước sửa | 131/131 đạt |
| Regression trên mã cũ | 5/5 thất bại như mong đợi, tái hiện thiếu kiểm tra phiên và lọc thông báo |
| `npm test` sau sửa | 137/137 đạt: thêm 5 regression và 1 kiểm tra render; dùng fixtures cho database/SMTP/Google |
| Python nguồn log | `python3 tests/log-targets.test.py`: 8/8 đạt |
| JavaScript syntax | 91 tệp JS được `node --check` thành công trước khi thêm kiểm thử render cuối; `npm test` nạp lại tất cả các test sau sửa |
| Dependency | `npm ci --ignore-scripts` thành công; `npm audit --json`: 0 vulnerability tại thời điểm kiểm tra. Argon2 và Sharp thực sự chạy trong các test |
| Compose | CLI 2.40.3, `--env-file .env.example config --quiet`: đạt; chỉ render cấu hình, không tạo container |
| Config infra | YAML/JSON parse thành công; Loki 3.6.17 `-verify-config=true`, Promtail 3.5.11 `-check-syntax`: đạt |
| Hướng dẫn cài mới | Shell `bash -n`, Python AST parse đạt; chưa chạy end-to-end trên Docker host/database rỗng |
| Whitespace | `git diff --check`: đạt |
| Bí mật | Snapshot không chứa .env thật, secrets/, uploads/, runtime/, node_modules/; ignore rules đã có. Không phải secret scan toàn bộ lịch sử Git |

Bộ test có kiểm tra quyền ADMIN/AUTHOR/READER, CSRF callback Google, chữ ký Google
với khóa kiểm thử, token email dùng một lần, chống replay, quyền lịch sử bài,
escape HTML, upload và storage. Phần lớn test dùng database fixture nên không
thay thế kiểm tra SQL/DDL, khóa hàng/deadlock và filesystem/container thật.

Kết quả runtime do sinh viên cung cấp trước đợt sửa: website và database qua
Docker; metrics Prometheus/Grafana; Google đăng nhập sau sửa callback; log trả
HTTP 200, marker 404 qua Nginx→Promtail→Loki, ba query LogQL có dữ liệu. Không
coi đây là kiểm chứng tự động của phiên bản mới sau các sửa trong đợt này.

## Đối chiếu yêu cầu nộp bài

| Yêu cầu | Trạng thái |
|---|---|
| Source, Compose/config, README trên GitHub | Có; bản mới trên nhánh codex/cms-ui-navigation, PR #1 chưa merge main |
| Tài khoản/đặt tên theo mã SV | Chưa có thông tin chứng minh đáp ứng. Repo hiện thuộc hscret7; cần đối chiếu với yêu cầu giảng viên |
| Website + MySQL + phpMyAdmin | Có; cần chụp minh chứng phiên bản cuối |
| Nginx + HTTPS hoặc security headers | Có security headers, commit 9dadc5c; HTTP localhost phù hợp phương án của đề. Không tuyên bố có HTTPS |
| Prometheus/Grafana container, web, DB | Có, commit 15c40b4; cần lưu dashboard/targets minh chứng |
| Loki/Promtail và 2–3 LogQL | Có, commit c7f9586; sinh viên đã xác nhận marker và ba query. Cần ảnh Explore/Grafana |
| Hardening ít nhất 3–4 biện pháp | Có non-root/read-only/cap-drop cho app, network separation, mật khẩu băm, CSRF, headers, secrets ngoài Git. Phải mô tả ngoại lệ bên dưới |
| Tất cả service Compose | 11 service được khai báo; không triển khai service thay thế trên host trong đợt sửa |
| Báo cáo tối thiểu 10 trang, bìa chuẩn, ảnh, demo | Chưa hoàn thành báo cáo; cần thông tin sinh viên/lớp/MSSV/giảng viên và ảnh phiên bản cuối |

## Các giới hạn còn lại — ghi đúng trong báo cáo

1. **Ngoại lệ hardening:** cAdvisor privileged, đọc rootfs/var-run để lấy metrics;
   Promtail chạy root để đọc Docker logs. Bind mount logs read-only không giới hạn
   khả năng đọc chỉ vào một project: giới hạn project ở discovery/pipeline. Không
   mô tả mọi container đều non-root hoặc mọi mạng đều internal/air-gapped.
2. **HTTP localhost:** cookie Secure chưa bật. Không mở hệ thống ra Internet với
   cấu hình này. Đề cho phép security headers thay HTTPS; triển khai public cần
   TLS và cookie Secure phù hợp.
3. **Promtail:** đã EOL; giữ để đáp ứng đề thực hành, chuyển Alloy nếu vận hành lâu dài.
4. **Nguồn log:** chạy lại prepare-log-targets sau recreate bốn container nguồn.
   Retention Loki 7 ngày không khôi phục log Docker đã xoay trước khi thu; chưa
   có log shipping HA/cảnh báo collector và giới hạn dung lượng đĩa cứng cho Loki.
5. **Khôi phục dữ liệu:** đã có backup SQL thủ công theo lịch sử triển khai nhưng
   chưa có bằng chứng restore vào môi trường độc lập. Cần backup cả uploads và
   secrets ngoài Git; chưa có backup tự động hoặc diễn tập disaster recovery.
6. **Migration:** chạy thủ công một lần; không tự theo dõi phiên bản, DDL có thể áp
   dụng một phần. Readiness SELECT 1 không chứng minh schema đã đủ 001–005.
7. **Vận hành:** chưa có CI, cảnh báo tự động, retry deadlock có kiểm soát, dọn
   token/challenge hết hạn hoặc đối soát ảnh còn sót. Rate limit ở bộ nhớ của một
   app instance, mất bộ đếm khi restart và không chia sẻ giữa nhiều replica.
8. **Tái lập image:** Node 24, Nginx stable và MySQL 8.4 dùng tag có thể thay đổi.
   Nên lưu image digest/version của bản demo; không cập nhật dependency/image
   hàng loạt sát ngày nộp mà không kiểm chứng lại.
9. **Email thật:** Google sign-in và SMTP là hai tích hợp riêng. Không suy ra luồng
   đăng ký/xác minh/reset email hoạt động chỉ từ việc đăng nhập Google đạt.
10. **Quyền DB:** app dùng user của database, không dùng root; chưa tách user
    migration có DDL và user runtime chỉ có DML. Đây là cải tiến vận hành tiếp theo.

## Nghiệm thu sau khi lấy bản sửa trên máy sinh viên

Không chạy migration hoặc sửa `.env`. Lấy nhánh, `nvm use`, `npm test`, build lại
app, recreate app, reload Nginx, chờ readiness, refresh nguồn log rồi verify.

Kiểm tra bằng tài khoản thử, tránh tự khóa ADMIN đang dùng:

- Đăng nhập READER trong một cửa sổ; ADMIN khóa rồi mở khóa tài khoản đó trong
  cửa sổ khác, không truy cập cửa sổ READER giữa hai thao tác. Sau đó mở Tài khoản
  ở cửa sổ READER: phải buộc đăng nhập lại. Tài khoản vẫn đăng nhập được bằng đúng
  mật khẩu sau khi mở khóa.
- Đổi vai trò một tài khoản thử: phiên cũ phải đăng nhập lại, quyền mới phải đúng.
- Đổi mật khẩu, dùng phiên cũ gửi thao tác: phải bị chặn. Luồng đăng nhập mới vẫn đạt.
- Tại Thông báo, tìm một từ có và không có trong thông báo; kiểm tra tổng số/phân trang.
  Chuyển Thông báo đã ẩn, đổi sắp xếp/lọc: vẫn phải ở danh sách đã ẩn.
- Smoke test tạo/sửa/xuất bản bài, thay/gỡ ảnh, bình luận/trả lời/duyệt, thông báo,
  menu ADMIN/AUTHOR/READER, Google và email thật nếu đã cấu hình.
- Kiểm tra metrics và `verify-central-logs.py` sau recreate, lưu ảnh 3 LogQL.

Sau các bước này mới chốt ảnh minh chứng và viết báo cáo theo trạng thái thực tế.
