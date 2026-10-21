-- Sau 003; chạy một lần. Không xóa dữ liệu cũ.
SET NAMES utf8mb4;
SET SESSION time_zone = '+00:00';
CREATE TABLE comments (
 id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 post_id INT UNSIGNED NOT NULL, user_id INT UNSIGNED NOT NULL,
 content TEXT NOT NULL, status ENUM('PENDING','APPROVED','HIDDEN') NOT NULL DEFAULT 'PENDING',
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY idx_comments_public(post_id,status,created_at,id), KEY idx_comments_user(user_id,id),
 FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE RESTRICT,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE category_follows (
 user_id INT UNSIGNED NOT NULL, category_id INT UNSIGNED NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,category_id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT,
 FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE notifications (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id INT UNSIGNED NOT NULL,
 message VARCHAR(300) NOT NULL, target_path VARCHAR(300) NOT NULL,
 read_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_notifications_user(user_id,read_at,id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE TABLE audit_events (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 actor_id INT UNSIGNED NULL, action VARCHAR(50) NOT NULL,
 object_type VARCHAR(30) NOT NULL, object_id BIGINT UNSIGNED NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_audit_time(created_at,id), KEY idx_audit_actor(actor_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
-- Không FK đến posts: giữ phiên bản sau khi bài bị xóa; chỉ người có quyền mới đọc.
CREATE TABLE post_versions (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, post_id INT UNSIGNED NOT NULL,
 actor_id INT UNSIGNED NOT NULL, title VARCHAR(200) NOT NULL, slug VARCHAR(220) NOT NULL,
 content MEDIUMTEXT NOT NULL, category_id INT UNSIGNED NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_post_versions(post_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO post_versions (post_id, actor_id, title, slug, content, category_id)
SELECT id, author_id, title, slug, content, category_id FROM posts;
