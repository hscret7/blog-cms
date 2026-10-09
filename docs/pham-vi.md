# Phạm vi hệ thống Blog CMS

## 1. Mục tiêu

Website quản lý bài viết, danh mục và người dùng thuộc đề tài số 7.
Dữ liệu lưu trong MySQL, quản trị bằng phpMyAdmin.
Các dịch vụ triển khai bằng Docker Compose.

## 2. Phương án ứng dụng

Xây dựng ứng dụng Node.js và Express với giao diện dựng phía server.

Đây là phương án triển khai của dự án, không phải công nghệ
bắt buộc được đề bài quy định.

## 3. Người sử dụng

### Khách

- Xem danh sách và chi tiết bài đã xuất bản.
- Tìm kiếm bài theo tiêu đề.
- Lọc bài theo danh mục.
- Không truy cập chức năng quản trị hoặc bài nháp.

### Tác giả

- Đăng nhập và đăng xuất.
- Tạo bài viết.
- Sửa bài viết của mình.
- Lưu nháp và xuất bản bài của mình.
- Gỡ bài của mình về trạng thái nháp.
- Xóa bài của mình sau khi xác nhận.

### Quản trị viên

- Quản lý toàn bộ bài viết.
- Quản lý danh mục.
- Tạo và quản lý tài khoản.
- Phân vai trò và khóa tài khoản.

## 4. Chức năng phiên bản đầu

- Danh sách bài công khai có phân trang.
- Chi tiết bài viết.
- Tìm kiếm theo tiêu đề và lọc danh mục.
- Đăng nhập và đăng xuất.
- Quản lý bài viết với trạng thái nháp và đã xuất bản.
- Mỗi bài thuộc một danh mục.
- Mỗi bài có tối đa một ảnh đại diện.
- Quản lý danh mục và người dùng.
- Trang tổng quan quản trị.

Nội dung bài ở phiên bản đầu là văn bản thuần.
Giao diện phải hiển thị nội dung bằng cơ chế escape an toàn.

## 5. Quy tắc nghiệp vụ

- Email tài khoản và slug bài viết phải duy nhất.
- Chỉ bài đã xuất bản được hiển thị công khai.
- Quyền truy cập phải kiểm tra ở backend.
- Tác giả không được sửa hoặc xóa bài của người khác.
- Tài khoản bị khóa không được tiếp tục sử dụng quyền truy cập.
- Không xóa danh mục khi còn bài viết liên kết.
- Phiên bản đầu khóa tài khoản thay vì xóa người dùng.
- Không cho phép khóa quản trị viên đang thao tác với chính mình
  hoặc làm hệ thống mất quản trị viên đang hoạt động cuối cùng.
- Mật khẩu được băm, không lưu dạng văn bản rõ.
- File upload phải được kiểm tra loại và kích thước.
- Truy vấn database sử dụng tham số.
- Thao tác thay đổi dữ liệu dùng session cookie phải có bảo vệ CSRF.

## 6. Thành phần triển khai

- Ứng dụng Blog CMS.
- MySQL và phpMyAdmin.
- Nginx reverse proxy.
- Prometheus, Grafana và các thành phần cung cấp metrics.
- Loki và Promtail.
- Volume lưu dữ liệu MySQL và ảnh upload.

## 7. Ngoài phạm vi phiên bản đầu

- Bình luận và lượt thích.
- Chat realtime.
- Gửi email tự động.
- Đăng nhập bằng tài khoản bên thứ ba.
- Thanh toán.
- Trình soạn thảo HTML và quy trình duyệt nhiều cấp.

## 8. Điều kiện hoàn thành

- Chức năng và phân quyền được kiểm chứng.
- Chạy được hệ thống bằng Docker Compose.
- Website truy cập qua Nginx.
- Có dashboard container, web server và database.
- Có log tập trung và ít nhất 3 truy vấn LogQL minh chứng.
- Có ít nhất 4 biện pháp hardening được kiểm chứng.
- Repository có README và các commit có ý nghĩa.
- Có báo cáo tối thiểu 10 trang và demo theo yêu cầu đề.