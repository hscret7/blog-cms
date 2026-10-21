> Bổ sung hiện tại: xem [hướng dẫn tương tác và Google](cap-nhat-tuong-tac-google.md), gồm migration 005, trả lời một cấp, duyệt yêu cầu AUTHOR và danh tính Google. Nội dung bên dưới mô tả mốc trước đó.

# Kiểm tra giao diện Blog CMS

## Phạm vi

Giao diện dùng CSS/JavaScript nội bộ, không cần CDN.
Menu quản lý được hiển thị theo vai trò hiện tại của tài khoản đã xác thực.
Trang công khai nhận diện session nếu đã đăng nhập; CSS/JS vẫn được phục vụ trước session.
Ẩn menu không thay thế kiểm tra quyền trên server.

## Cập nhật bản mới trong WSL

Nhánh hiện tại đã mở rộng tài khoản và chức năng cộng đồng, cần migration.
**Không dùng hướng dẫn build cũ trước khi nâng database.** Thực hiện toàn bộ
thứ tự lấy mã, sao lưu, migration 003/004, SMTP và build trong
[Cập nhật cộng đồng](cap-nhat-cong-dong.md).

## Thao tác từ giao diện

Chỉ cần mở trang chủ http://localhost:18090. Các bước sau đều dùng nút/menu.

### Khách

- Tìm theo tiêu đề, chọn danh mục, bấm Tìm kiếm, Xóa bộ lọc.
- Bấm ảnh, tiêu đề hoặc Đọc bài để mở bài xuất bản.
- Bấm danh mục của bài để lọc theo chủ đề; Về trang chủ để quay lại.
- Với hơn 10 bài phù hợp, dùng Trang trước / Trang sau.
- Bấm Đăng nhập hoặc Không gian quản lý.

### AUTHOR

- Đăng nhập rồi bấm Bài viết hoặc Quản lý bài viết.
- Bấm Tạo bài nháp, điền biểu mẫu, Lưu bài nháp.
- Trong danh sách, bấm Sửa / ảnh để chỉnh nội dung và quản lý ảnh.
- Tải ảnh, thay ảnh, gỡ ảnh bằng các biểu mẫu riêng; kiểm tra xác nhận gỡ.
- Bấm Xuất bản, Xem bài, Chuyển về nháp hoặc Xóa trên danh sách.
- Kiểm tra menu không có Danh mục, Người dùng, Quản trị.
- Bấm tên tài khoản để về trang tài khoản, rồi Đăng xuất.

### ADMIN

- Thực hiện thao tác bài viết của tất cả tác giả.
- Dùng menu Danh mục: thêm, sửa, xóa; kiểm tra lỗi slug trùng hoặc danh mục có bài.
- Dùng menu Người dùng: tạo, sửa tên/email/vai trò, khóa và mở khóa.
- Kiểm tra bảo vệ tài khoản đang đăng nhập và ADMIN cuối cùng vẫn có hiệu lực.
- Có thể vào các mục trên từ thẻ trên trang tài khoản hoặc trang Quản trị.

## Responsive và khả năng truy cập

- Kiểm tra desktop và chiều rộng 390px; bảng quản lý cuộn ngang trong khung.
- Dùng Tab: liên kết Đến nội dung chính, menu, trường nhập và nút có focus rõ.
- Đăng nhập có nút Hiện/Ẩn mật khẩu; Enter vẫn gửi biểu mẫu bình thường.
- Nội dung bài giữ xuống dòng; tên, tiêu đề, nội dung và lỗi được escape HTML.
- Biểu mẫu vẫn có hidden CSRF và dùng POST cho các thao tác thay đổi dữ liệu.

## Kết quả tự động

Hai bộ test mới:

- `ui-render.test.js`: render 21 trang EJS và sáu chế độ biểu mẫu tài khoản; menu ADMIN/AUTHOR/READER;
  escape dữ liệu; liên kết ảnh, bộ lọc và phân trang; POST/CSRF; form ảnh riêng.
- `ui-assets.test.js`: chạy HTTP trên loopback với app wiring thật nhưng
  router/database/session giả lập; CSS/JS được trả trước session;
  không phục vụ đường dẫn uploads, secrets hoặc tệp ẩn.

Các kiểm tra trên không kết nối MySQL và không chứng minh thao tác CRUD
trên dữ liệu thật. Cần hoàn thành kiểm tra trình duyệt với Docker/WSL
trước khi ghi các bước nghiệp vụ của giao diện mới là PASS.

Lần kiểm tra nhánh giao diện: Node 24.19.0, 58 test đạt, 0 thất bại;
`npm audit --omit=dev` không báo lỗ hổng và `git diff --check` sạch.
Kiểm tra bằng Chromium với fixture (không dùng MySQL): 11 trang chính
ở chiều rộng 1440px và 390px, không tràn ngang toàn trang,
không có lỗi JavaScript; nút hiện/ẩn mật khẩu hoạt động.
Đã xem ảnh chụp trang chủ, tài khoản và trang chủ mobile.

Các test/luồng mới và giới hạn kiểm chứng được ghi ở [Cập nhật cộng đồng](cap-nhat-cong-dong.md).
