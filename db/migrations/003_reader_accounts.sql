-- Chạy một lần sau cấu trúc core 001 đã triển khai. MySQL DDL không rollback như DML.
SET NAMES utf8mb4;
SET SESSION time_zone = '+00:00';
ALTER TABLE users
  MODIFY role ENUM('ADMIN','AUTHOR','READER') NOT NULL DEFAULT 'READER',
  ADD email_verified_at DATETIME NULL,
  ADD session_version INT UNSIGNED NOT NULL DEFAULT 0;
-- Tài khoản đã được ADMIN/CLI cấp trước migration được coi là đã xác minh.
UPDATE users SET email_verified_at = UTC_TIMESTAMP();
CREATE TABLE account_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  purpose ENUM('VERIFY_EMAIL','RESET_PASSWORD') NOT NULL,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_account_token_hash(token_hash),
  KEY idx_account_tokens_user(user_id, purpose),
  CONSTRAINT fk_account_tokens_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
