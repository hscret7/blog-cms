# Rà soát nhật ký kỹ thuật và đồng bộ README

Ngày 21/10/2026, dựa trên nhánh feature/ui-refresh-technical-logs tại 34852a9.

## Sửa lỗi

- Giữ timeout 8 giây đến khi đọc xong body Loki; trước đây timeout bị hủy ngay khi nhận headers.
- Giới hạn phản hồi 2 MiB, kiểm tra status/resultType/streams và cấu trúc timestamp/dòng log. Phản hồi lỗi không còn bị hiểu là danh sách rỗng thành công.
- Lỗi kết nối/dữ liệu trả 502; quá thời gian trả 504. Controller giữ mã HTTP và render thông báo, không trả 200 cho lỗi Loki.
- Không chuyển nội dung lỗi thô từ Loki ra giao diện. Đây không phải cơ chế che bí mật trong các dòng log hợp lệ; nguồn log phải tránh ghi credentials/token.
- buildLogQL chỉ nhận service trong danh sách cố định; giới hạn limit phải là số nguyên đầy đủ. Nhóm 5xx chặn trên ở 600.
- Đổi nhãn ERROR/ECONNREFUSED thành mô tả chuỗi lọc đúng thực tế. Lọc HTTP dựa vào trường status JSON, chủ yếu dành cho log Nginx; log app/MySQL không có status sẽ không khớp.
- Test menu dùng Loki fixture thay vì DNS thật. Test phân quyền dùng user fixture, không cần .env/database thật, kiểm tra cả ADMIN thành công và AUTHOR/READER/khách bị chặn.
- Đồng bộ README mới: thông tin sinh viên, công nghệ, cổng thực tế, cài mới/nâng cấp, vận hành, giới hạn và trang Nhật ký hệ thống. Không thay màu chủ đạo, schema hoặc nghiệp vụ bình luận/thông báo.

## Kết quả kiểm tra

- Trước sửa: 159/160 Node test đạt; một ca phụ thuộc SESSION_SECRET của môi trường thật.
- Sau sửa: 163/163 Node test và 8/8 Python test đạt; git diff --check sạch.
- Kiểm tra bằng Express/Loki HTTP fixture, EJS render và middleware phân quyền thật. Không thay thế nghiệm thu Docker/MySQL/Google/SMTP trên máy sinh viên.
- Chưa thực hiện kiểm thử tải, quét bảo mật toàn diện hoặc đánh giá trực quan mọi kích thước màn hình.

## Nghiệm thu trên máy sinh viên

Sau khi pull nhánh và chạy test: build lại app, recreate app, reload Nginx, sinh lại targets log và chạy verify-central-logs.py. Không chạy lại migration 006 cho bản sửa này.

1. Đăng nhập ADMIN tại http://localhost:18090/login, mở Nhật ký hệ thống: hai mục Nhật ký hoạt động và Nhật ký kỹ thuật đều vào được.
2. Nhật ký hoạt động: kiểm tra lọc, phân trang, thời gian và nội dung bảng.
3. Nhật ký kỹ thuật: lọc nginx/1h, tạo một URL 404 rồi tìm đường dẫn đó; kiểm tra 4xx và bỏ lọc. ERROR là tìm chuỗi, không tự phân loại mọi lỗi DB.
4. AUTHOR/READER không thấy menu; truy cập trực tiếp /admin/system-logs phải trả 403. Khách chuyển đăng nhập.
5. Kiểm tra thông báo/bình luận trên desktop và mobile: mở/thu gọn nội dung, đọc/ẩn/khôi phục, duyệt, trả lời và đích liên kết không bị thay đổi.
6. Nếu Loki không sẵn sàng, trang hiển thị lỗi 502/504; website và nhật ký hoạt động vẫn hoạt động.

Không gộp main trong lần rà soát này. Nhánh feature vẫn cần nghiệm thu trước khi merge.
