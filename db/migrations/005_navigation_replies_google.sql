-- Chạy một lần sau 004. Sao lưu và dừng app trước khi chạy DDL.
SET NAMES utf8mb4;
SET SESSION time_zone = '+00:00';
ALTER TABLE comments
  ADD parent_id INT UNSIGNED NULL,
  ADD is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD KEY idx_comments_thread (parent_id, status, id),
  ADD CONSTRAINT fk_comment_parent FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE;
ALTER TABLE notifications
  ADD hidden_at DATETIME NULL,
  ADD comment_id INT UNSIGNED NULL,
  ADD KEY idx_notification_visibility (user_id, hidden_at, read_at, id);
CREATE TABLE author_requests (
  user_id INT UNSIGNED NOT NULL PRIMARY KEY,
  status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  reason VARCHAR(1000) NOT NULL,
  review_note VARCHAR(1000) NULL,
  reviewer_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  KEY idx_author_request_status (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
ALTER TABLE users MODIFY password_hash VARCHAR(255) NULL;
CREATE TABLE user_identities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  provider ENUM('GOOGLE') NOT NULL,
  subject VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_provider_subject (provider, subject),
  UNIQUE KEY uq_user_provider (user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE google_challenges (
  nonce_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  mode ENUM('LOGIN','LINK') NOT NULL,
  user_id INT UNSIGNED NULL,
  auth_version INT UNSIGNED NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  KEY idx_google_challenge_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
