# Quy tắc bình luận và thông báo — bản sửa 16/10/2026

Đây là tài liệu nghiệp vụ/kiểm tra, không phải báo cáo nộp môn.
Bản sửa không đổi schema, không chạy lại migration và không xóa thông báo lịch sử.

## Luồng người dùng

| Sự kiện | Người nhận và kết quả |
|---|---|
| READER hoặc AUTHOR bình luận trên bài người khác | Chờ duyệt; ADMIN khác người gửi nhận yêu cầu kiểm duyệt. Tác giả/người được trả lời chưa nhận báo có nội dung công khai |
| ADMIN hoặc AUTHOR bình luận trên bài của mình | Hiển thị ngay. Tác giả/người được trả lời nhận thông báo nếu khác người gửi; cùng một người nhận chỉ nhận một thông báo nội dung mới |
| ADMIN duyệt | Người gửi nhận kết quả duyệt; tác giả/người được trả lời nhận nội dung mới, loại người gửi. Thông báo kiểm duyệt liên quan của ADMIN được đánh dấu đã đọc |
| ADMIN bấm lại cùng trạng thái | Không ghi lại trạng thái hoặc tạo thông báo mới |
| ADMIN ẩn | Người gửi nhận thông báo đã ẩn nếu khác người thực hiện. Nội dung không còn công khai |
| Sửa không đổi nội dung | Không gửi lại thông báo, không đưa nội dung đã duyệt về chờ duyệt |
| Sửa thực sự | Áp dụng lại quy tắc vai trò/quyền trên bài; thông báo nói rõ chỉnh sửa thay vì gọi là bình luận mới |
| Bài đang nháp / bình luận gốc ẩn hoặc xóa | Không cho duyệt hiển thị câu trả lời rồi báo công khai sai thực tế |

Người dùng vẫn cần xác minh email. Trả lời chỉ một cấp, vào bình luận gốc cùng bài
đã được duyệt và chưa xóa. Không gửi thông báo cho chính người tạo nội dung.
Người được duyệt có thể nhận thông báo kết quả duyệt của chính bình luận mình.

Thông báo là sự kiện tại thời điểm phát sinh; nội dung xem trước là phiên bản
bình luận hiện tại mà người xem được phép đọc. Nhãn **Trạng thái hiện tại** giúp
phân biệt thông báo cũ “chờ duyệt” với bình luận hiện đã duyệt/ẩn/không khả dụng.
Không sửa lịch sử để giả như sự kiện cũ chưa từng xảy ra. Bản sửa không tự dọn
hoặc gộp các thông báo trùng đã được tạo trước đây.

## Thao tác trên giao diện

- Tại Thông báo, **Mở bình luận / Mở nội dung** kiểm tra chủ sở hữu, đánh dấu đã
  đọc rồi chuyển đến đích. Đây là POST có CSRF; không mở thông báo của người khác.
- Với ADMIN, thông báo bình luận mở đúng mục kiểm duyệt để thao tác.
- Tại danh sách bình luận đã duyệt, **Xem bình luận trên bài** mở cuộc trao đổi
  công khai, không quay vòng lại danh sách quản lý. Bình luận chưa duyệt/đã ẩn
  có liên kết bài viết, không giả vờ có vị trí công khai.
- Người gửi bình luận được hiển thị ngay quay lại vị trí công khai; người gửi
  bình luận chờ duyệt được chuyển đến đúng mục trong Bình luận của tôi.
- Thu gọn/xem trước và ẩn/khôi phục thông báo vẫn hoạt động. Ẩn thông báo không
  đồng nghĩa ẩn bình luận. Xóa bình luận vẫn tuân theo quyền đã có và giữ tombstone
  khi bình luận gốc có câu trả lời.

## Kiểm chứng

`npm test`: 146 test đạt (gồm 8 ca notification workflow mới và 1 ca render).
Các test mới kiểm tra chống vòng điều hướng ADMIN; quyền mở thông báo/CSRF/đích
nội bộ; kết thúc thông báo chờ duyệt; bấm duyệt lặp; bài nháp/gốc bị ẩn/xóa;
ẩn thông báo kết quả; nội dung không đổi; hiển thị trạng thái hiện tại.
Database dùng fixture: cần nghiệm thu dưới đây trên MySQL/trình duyệt thật.

1. READER đã xác minh gửi bình luận: chỉ ADMIN có việc chờ duyệt. ADMIN mở thông
   báo: số chưa đọc giảm, đúng bình luận cần duyệt được hiển thị.
2. Duyệt: READER thấy kết quả, AUTHOR thấy nội dung mới. ADMIN bấm duyệt lại:
   không phát thêm thông báo. Thông báo cũ của ADMIN không còn tính chưa đọc.
3. ADMIN bấm Xem bình luận trên bài: mở đúng cuộc trao đổi và anchor.
4. AUTHOR trả lời trên bài của mình: hiển thị ngay, READER được trả lời nhận đúng
   đích. Nếu AUTHOR đồng thời là người nhận theo hai vai trò, chỉ một thông báo.
5. READER lưu không sửa nội dung: không phát thêm thông báo, không mất duyệt.
6. ADMIN ẩn: READER biết đã bị ẩn; người không có quyền không đọc được nội dung
   từ thông báo hoặc link công khai. Duyệt câu trả lời khi gốc đang ẩn phải bị chặn.
7. Chuyển bài về nháp: không duyệt hiển thị thành công giả; nội dung công khai
   vẫn bị chặn. Bài bị xóa/thông báo cũ phải báo không khả dụng, không lộ nội dung.

Các lựa chọn chưa bổ sung: push thời gian thực, email từng bình luận, cấu hình
tắt/bật từng loại thông báo, lý do kiểm duyệt bắt buộc và gộp thông báo theo lô.
Đây là mở rộng sản phẩm; không tự coi là đã hoàn thành chỉ vì có menu.
