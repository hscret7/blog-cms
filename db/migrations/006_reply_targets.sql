-- Chạy đúng một lần sau 005, sao lưu và dừng app trước DDL.
-- parent_id vẫn là bình luận gốc của cuộc trao đổi.
-- reply_to_id xác định bình luận/câu trả lời được trả lời trực tiếp.
SET NAMES utf8mb4;
SET SESSION time_zone = '+00:00';
ALTER TABLE comments
  ADD reply_to_id INT UNSIGNED NULL,
  ADD KEY idx_comments_reply_target (reply_to_id, id),
  ADD CONSTRAINT fk_comment_reply_target FOREIGN KEY (reply_to_id)
    REFERENCES comments(id) ON DELETE SET NULL;
UPDATE comments SET reply_to_id = parent_id, updated_at = updated_at
WHERE parent_id IS NOT NULL;
