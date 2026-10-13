> Bổ sung hiện tại: xem [hướng dẫn tương tác và Google](cap-nhat-tuong-tac-google.md), gồm migration 005, trả lời một cấp, duyệt yêu cầu AUTHOR và danh tính Google. Nội dung bên dưới mô tả mốc trước đó.

# Thiết kế dữ liệu Blog CMS

## 1. Phạm vi

Thiết kế cho ứng dụng Blog CMS có bài viết, danh mục và người dùng.

Database sử dụng MySQL.
Các bảng nghiệp vụ dùng InnoDB và bộ ký tự utf8mb4.

Đây là thiết kế dự kiến. Chưa tạo bảng hoặc kiểm chứng SQL.

## 2. Quy ước chung

- Khóa chính dùng INT UNSIGNED AUTO_INCREMENT.
- Khóa ngoại dùng cùng kiểu với khóa chính được tham chiếu.
- Các trường thời gian dùng DATETIME và được ghi theo UTC.
- created_at là thời điểm tạo.
- updated_at là thời điểm cập nhật gần nhất.
- Ứng dụng chuyển thời gian sang múi giờ phù hợp khi hiển thị.
- Không lưu mật khẩu dạng văn bản rõ.
- Dùng truy vấn có tham số.
- Không sử dụng ON DELETE CASCADE cho các quan hệ nghiệp vụ này.

## 3. Bảng users

| Trường | Kiểu dự kiến | Quy định |
| --- | --- | --- |
| id | INT UNSIGNED | Khóa chính, tự tăng |
| name | VARCHAR(100) | Bắt buộc |
| email | VARCHAR(254) | Bắt buộc, duy nhất |
| password_hash | VARCHAR(255) | Bắt buộc, chứa mật khẩu đã băm |
| role | ENUM('ADMIN', 'AUTHOR', 'READER') | Bắt buộc |
| status | ENUM('ACTIVE', 'LOCKED') | Bắt buộc, mặc định ACTIVE |
| created_at | DATETIME | Bắt buộc |
| updated_at | DATETIME | Bắt buộc |

Quy tắc:

- Email được loại bỏ khoảng trắng ở đầu/cuối.
- Phiên bản đầu coi email không phân biệt chữ hoa và chữ thường.
- Chuẩn hóa email nhất quán trước khi kiểm tra và lưu.
- Tên không được rỗng sau khi loại bỏ khoảng trắng đầu/cuối.
- Quản trị viên cấp quyền; đăng ký công khai luôn tạo READER.
- Phiên bản đầu khóa tài khoản thay vì xóa.
- Backend kiểm tra trạng thái hiện tại của tài khoản khi sử dụng session.
- Không cho phép khóa hoặc hạ quyền quản trị viên đang thao tác
  với chính mình.
- Không cho phép thao tác làm mất quản trị viên ACTIVE cuối cùng.
- Kiểm tra quản trị viên cuối cùng phải bảo đảm đúng khi có
  các yêu cầu cập nhật đồng thời.

## 4. Bảng categories

| Trường | Kiểu dự kiến | Quy định |
| --- | --- | --- |
| id | INT UNSIGNED | Khóa chính, tự tăng |
| name | VARCHAR(100) | Bắt buộc |
| slug | VARCHAR(150) | Bắt buộc, duy nhất |
| description | VARCHAR(500) | Cho phép NULL |
| created_at | DATETIME | Bắt buộc |
| updated_at | DATETIME | Bắt buộc |

Quy tắc:

- Tên không được rỗng sau khi loại bỏ khoảng trắng đầu/cuối.
- Slug chỉ dùng chữ thường a-z, số và dấu gạch nối.
- Slug được kiểm tra độ dài và tính duy nhất.
- Không xóa danh mục khi còn bất kỳ bài viết nào liên kết,
  kể cả bài nháp.
- Backend kiểm tra và trả thông báo dễ hiểu.
- Khóa ngoại của posts là lớp bảo vệ bổ sung nếu có thao tác đồng thời.

## 5. Bảng posts

| Trường | Kiểu dự kiến | Quy định |
| --- | --- | --- |
| id | INT UNSIGNED | Khóa chính, tự tăng |
| author_id | INT UNSIGNED | Bắt buộc, khóa ngoại đến users.id |
| category_id | INT UNSIGNED | Bắt buộc, khóa ngoại đến categories.id |
| title | VARCHAR(200) | Bắt buộc |
| slug | VARCHAR(220) | Bắt buộc, duy nhất |
| content | MEDIUMTEXT | Bắt buộc |
| cover_path | VARCHAR(255) | Cho phép NULL |
| status | ENUM('DRAFT', 'PUBLISHED') | Bắt buộc, mặc định DRAFT |
| published_at | DATETIME | Cho phép NULL theo trạng thái |
| created_at | DATETIME | Bắt buộc |
| updated_at | DATETIME | Bắt buộc |

Quy tắc:

- Tiêu đề và nội dung không được rỗng sau khi kiểm tra khoảng trắng.
- Nội dung phiên bản đầu là văn bản thuần.
- Giao diện escape nội dung, không render như HTML do người dùng nhập.
- Ứng dụng giới hạn kích thước nội dung; MEDIUMTEXT không có nghĩa
  là chấp nhận request không giới hạn.
- Slug dùng chữ thường a-z, số và dấu gạch nối.
- Slug phải duy nhất; không tự ghi đè bài có cùng slug.
- Tác giả chỉ quản lý bài của mình.
- Quản trị viên quản lý mọi bài.
- author_id lấy từ tài khoản đăng nhập khi tạo bài,
  không tin giá trị tùy ý gửi từ trình duyệt.
- Chỉ bài PUBLISHED được truy cập công khai.
- Quy tắc công khai áp dụng cho danh sách, tìm kiếm và trang chi tiết.
- Tài khoản tác giả bị khóa không tự động làm ẩn các bài đã xuất bản.
- Nếu cần gỡ bài, người có quyền chuyển bài về DRAFT.
- Xóa bài là thao tác có xác nhận và kiểm tra quyền ở backend.

## 6. Quy tắc xuất bản

- Khi tạo bản nháp: status = DRAFT, published_at = NULL.
- Khi chuyển DRAFT sang PUBLISHED: đặt published_at bằng thời điểm UTC.
- Khi sửa bài đang PUBLISHED: giữ nguyên published_at.
- Khi gỡ về DRAFT: đặt published_at = NULL.
- Khi xuất bản lại: đặt published_at bằng thời điểm xuất bản lại.
- updated_at thay đổi khi cập nhật bài.

Hai trạng thái và quy tắc published_at phải nhất quán.
Migration sẽ bổ sung ràng buộc phù hợp với phiên bản MySQL được chọn.
Backend vẫn kiểm tra nghiệp vụ và cung cấp thông báo lỗi rõ ràng.

## 7. Khóa ngoại và chính sách xóa

- posts.author_id tham chiếu users.id.
- posts.category_id tham chiếu categories.id.
- Dùng ON DELETE RESTRICT và ON UPDATE RESTRICT.
- Không thay đổi id sau khi tạo.
- Không xóa dây chuyền bài khi xóa danh mục hoặc người dùng.
- Xóa một bài không xóa tác giả hoặc danh mục.

## 8. Chỉ mục dự kiến

- UNIQUE trên users.email.
- UNIQUE trên categories.slug.
- UNIQUE trên posts.slug.
- Chỉ mục phục vụ liên kết author_id và category_id.
- Chỉ mục ghép phục vụ danh sách công khai:
  (status, published_at, id).

Danh sách công khai sắp xếp published_at giảm dần và id giảm dần
để có thứ tự ổn định khi nhiều bài có cùng thời gian.

Các chỉ mục bổ sung được quyết định dựa trên truy vấn và EXPLAIN.
Không mặc định chỉ mục thông thường tối ưu được tìm kiếm
LIKE '%từ khóa%'.

## 9. Ảnh đại diện

- MySQL chỉ lưu đường dẫn tương đối trong cover_path.
- File ảnh lưu trong volume upload riêng.
- Không dùng tên file gốc làm đường dẫn lưu trực tiếp.
- Backend tạo tên file và kiểm tra nội dung, loại, kích thước.
- Không cho phép đường dẫn vượt ra ngoài thư mục upload.
- Không phục vụ thư mục upload như nơi thực thi mã.
- Việc thay hoặc xóa ảnh phải xử lý lỗi và tránh xóa ảnh đang được dùng.
- Backup và restore phải xét cả MySQL và file ảnh.

## 10. Session

- Session được lưu phía server.
- Không dùng bộ nhớ tạm của tiến trình làm nơi lưu vận hành lâu dài.
- Nếu dùng MySQL session store, bảng kỹ thuật sẽ được thiết kế
  theo thư viện được chọn.
- Cookie cấu hình HttpOnly, SameSite và Secure phù hợp HTTPS.
- Đổi session sau đăng nhập; vô hiệu session khi đăng xuất.
- Các thao tác thay đổi dữ liệu cần bảo vệ CSRF.

## 11. Kiểm chứng sau khi tạo database

- Tạo dữ liệu hợp lệ thành công.
- Email và slug trùng bị từ chối.
- author_id hoặc category_id không tồn tại bị từ chối.
- Xóa danh mục đang có bài bị từ chối.
- Bản nháp không xuất hiện trên các đường truy cập công khai.
- Tác giả không sửa hoặc xóa được bài người khác.
- Tài khoản bị khóa không tiếp tục sử dụng quyền.
- Các trạng thái xuất bản và published_at đúng quy tắc.
- Dữ liệu và ảnh còn tồn tại sau khi tạo lại container phù hợp.
## Bổ sung qua migration 003 và 004

users thêm email_verified_at (NULL khi chưa xác minh), session_version để
hủy hiệu lực các phiên cũ khi đổi email/mật khẩu. Tài khoản đã có được coi
là xác minh từ trước. account_tokens lưu SHA256 của token 32 byte ngẫu nhiên;
phân biệt VERIFY_EMAIL (24 giờ) và RESET_PASSWORD (30 phút); token một lần.

comments liên kết post/user với status PENDING/APPROVED/HIDDEN, nội dung
văn bản tối đa 2.000 ký tự. category_follows có khóa kép user/category.
notifications thuộc một user và có read_at, đường dẫn nội bộ.
audit_events giữ actor/action/object/time, không lưu bí mật.
post_versions giữ nội dung mỗi lần tạo/sửa và bản đầu của các bài cũ.
Không FK post_versions/audit_events đến posts để giữ vết khi bài bị xóa;
AUTHOR vẫn phải có quyền trên bài hiện tại mới xem lịch sử.

Xóa bài dọn comments trong transaction, dọn ảnh sau commit. Xóa danh mục
rỗng dọn follows trong transaction; bài liên kết vẫn chặn bằng FK RESTRICT.
DDL phải chạy một lần, có backup, theo [hướng dẫn cập nhật](cap-nhat-cong-dong.md).
